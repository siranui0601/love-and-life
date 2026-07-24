import crypto from "crypto";
import fs from "fs";
import express from "express";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";
import { mountFloodNoHandSoccerVisualRoutes } from "./nohand-soccer/visual-cache-flood.js";
import { mountTrpgNarrativeRoutes } from "./trpg/routes.js";
import { mountTrpgGameRoutes } from "./trpg/game/routes.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, "../..");
const publicDirectory = path.join(projectRoot, "public");

const TRPG_SKILL_CATALOG_PART_COUNT = 8;
const TRPG_SKILL_CATALOG_SHA256 =
  "4d3b277479fbb96138fb5ec65713b99cd74f06fe60faba2a24ea207e806755d5";

function createTrpgSkillCatalogLoader() {
  const dataDirectory = path.join(publicDirectory, "TRPG/data");
  const partPaths = Array.from(
    { length: TRPG_SKILL_CATALOG_PART_COUNT },
    (_, index) =>
      path.join(
        dataDirectory,
        `skills.beta.json.gz.b64.part-${String(index + 1).padStart(2, "0")}`
      )
  );

  let cachedJsonBuffer = null;
  let cachedSummary = null;

  function loadCatalog() {
    if (cachedJsonBuffer && cachedSummary) {
      return { jsonBuffer: cachedJsonBuffer, summary: cachedSummary };
    }

    const missingParts = partPaths.filter((partPath) => !fs.existsSync(partPath));
    if (missingParts.length > 0) {
      throw new Error(
        `TRPG skill catalog parts are missing: ${missingParts
          .map((partPath) => path.basename(partPath))
          .join(", ")}`
      );
    }

    const encodedCatalog = partPaths
      .map((partPath) => fs.readFileSync(partPath, "utf8").trim())
      .join("");

    const gzipCatalog = Buffer.from(encodedCatalog, "base64");
    const actualSha256 = crypto
      .createHash("sha256")
      .update(gzipCatalog)
      .digest("hex");

    if (actualSha256 !== TRPG_SKILL_CATALOG_SHA256) {
      throw new Error(
        `TRPG skill catalog checksum mismatch: expected ${TRPG_SKILL_CATALOG_SHA256}, got ${actualSha256}`
      );
    }

    const jsonBuffer = zlib.gunzipSync(gzipCatalog);
    const parsed = JSON.parse(jsonBuffer.toString("utf8"));

    if (!Array.isArray(parsed.skills) || !parsed.runtime?.commands) {
      throw new Error("TRPG skill catalog structure is invalid");
    }

    cachedJsonBuffer = jsonBuffer;
    cachedSummary = {
      schemaVersion: parsed.schemaVersion,
      catalogVersion: parsed.catalogVersion,
      total: parsed.summary?.total ?? parsed.skills.length,
      enabled: parsed.summary?.enabled ?? parsed.skills.filter((skill) => skill.enabled).length,
      runtimeReady: parsed.summary?.implementation?.runtime_ready ?? 0,
      customHandlers: parsed.summary?.implementation?.custom_handler_required ?? 0,
      bytes: jsonBuffer.length,
      sourceParts: TRPG_SKILL_CATALOG_PART_COUNT,
      checksum: actualSha256,
    };

    return { jsonBuffer: cachedJsonBuffer, summary: cachedSummary };
  }

  return {
    getJsonBuffer() {
      return loadCatalog().jsonBuffer;
    },
    getSummary() {
      return loadCatalog().summary;
    },
  };
}

export function createApp() {
  const app = express();
  const trpgSkillCatalog = createTrpgSkillCatalogLoader();

  // Game commands contain only short IDs. Parse them under a tight limit
  // before the wider legacy JSON parser so journal storage cannot be abused.
  app.use("/TRPG/api/game", express.json({ limit: "16kb" }));
  app.use(express.json({ limit: "12mb" }));
  mountFloodNoHandSoccerVisualRoutes(app);
  const trpgNarrator = mountTrpgNarrativeRoutes(app);
  // Keep approved/runtime replay reuse available even when paid generation is
  // disabled. The narrator itself owns the explicit Gemini opt-in boundary.
  mountTrpgGameRoutes(app, { narrator: trpgNarrator });
  app.use("/TRPG/api/game", (error, req, res, next) => {
    if (error?.type === "entity.too.large") return res.status(413).json({ ok: false, error: "game_command_body_too_large" });
    if (error instanceof SyntaxError && error?.status === 400) return res.status(400).json({ ok: false, error: "invalid_game_command_json" });
    return next(error);
  });

  // Reverse proxies and some mobile clients handle a normal JSON response more
  // reliably than a manually tagged gzip body. The source remains compressed
  // in Git, but the server validates and expands it once, then caches it.
  app.get("/TRPG/data/skills.beta.json", (req, res, next) => {
    try {
      const jsonBuffer = trpgSkillCatalog.getJsonBuffer();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Length", String(jsonBuffer.length));
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
      res.send(jsonBuffer);
    } catch (error) {
      console.error("TRPG skill catalog load failed", error);
      next(error);
    }
  });

  app.get("/TRPG/data/skills.beta.health.json", (req, res) => {
    try {
      res.json({ ok: true, ...trpgSkillCatalog.getSummary() });
    } catch (error) {
      console.error("TRPG skill catalog health check failed", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // There is only one physical directory: public/TRPG.
  // The temporary Japanese title remains as a public URL alias.
  const trpgPath = "/TRPG(仮題)";
  const trpgEncodedPath = encodeURI(trpgPath);
  const trpgAssets = express.static(path.join(publicDirectory, "TRPG"));
  app.use(trpgPath, trpgAssets);
  app.use(trpgEncodedPath, trpgAssets);

  // Existing top page and game assets.
  app.use(express.static(publicDirectory));

  // 部分ツイートの新しい画像パス(/2D画像)を既存素材ディレクトリへ紐づける
  const twoDImagePath = "/2D画像";
  const twoDImageEncodedPath = encodeURI(twoDImagePath);
  const twoDImageAssets = express.static(path.join(publicDirectory, "2D素材"));
  app.use(twoDImagePath, twoDImageAssets);
  app.use(twoDImageEncodedPath, twoDImageAssets);

  // 時々文芸部！を /時々文芸部！ で配信
  const literaryClubPath = "/時々文芸部！";
  const literaryClubEncodedPath = encodeURI(literaryClubPath);
  const literaryClubAssets = express.static(path.join(publicDirectory, "bungei-bu"));
  app.use(literaryClubPath, literaryClubAssets);
  app.use(literaryClubEncodedPath, literaryClubAssets);

  // 部分ツイートを /部分ツイート で配信
  const partialTweetPath = "/部分ツイート";
  const partialTweetEncodedPath = encodeURI(partialTweetPath);
  const partialTweetAssets = express.static(path.join(publicDirectory, "partial-tweet"));
  app.use(partialTweetPath, partialTweetAssets);
  app.use(partialTweetEncodedPath, partialTweetAssets);

  const hundredOrePath = "/100日後も生きる俺";
  const hundredOreEncodedPath = encodeURI(hundredOrePath);
  const hundredOreAssets = express.static(path.join(publicDirectory, "100ore"));
  app.use("/100ore", hundredOreAssets);
  app.use(hundredOrePath, hundredOreAssets);
  app.use(hundredOreEncodedPath, hundredOreAssets);

  return app;
}
