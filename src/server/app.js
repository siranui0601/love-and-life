import crypto from "crypto";
import fs from "fs";
import express from "express";
import path from "path";
import { mountFloodNoHandSoccerVisualRoutes } from "./nohand-soccer/visual-cache-flood.js";

const TRPG_SKILL_CATALOG_PART_COUNT = 8;
const TRPG_SKILL_CATALOG_SHA256 =
  "4d3b277479fbb96138fb5ec65713b99cd74f06fe60faba2a24ea207e806755d5";

function createTrpgSkillCatalogLoader() {
  const dataDirectory = path.join(process.cwd(), "public/TRPG/data");
  const partPaths = Array.from(
    { length: TRPG_SKILL_CATALOG_PART_COUNT },
    (_, index) =>
      path.join(
        dataDirectory,
        `skills.beta.json.gz.b64.part-${String(index + 1).padStart(2, "0")}`
      )
  );

  let cachedGzip = null;

  return function getTrpgSkillCatalogGzip() {
    if (cachedGzip) return cachedGzip;

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

    cachedGzip = gzipCatalog;
    return cachedGzip;
  };
}

export function createApp() {
  const app = express();
  const getTrpgSkillCatalogGzip = createTrpgSkillCatalogLoader();

  // JSON
  app.use(express.json({ limit: "12mb" }));
  mountFloodNoHandSoccerVisualRoutes(app);

  // 既存トップページ用（必要なら）
  app.use(express.static("public"));

  // TRPG(仮題) スキルJSON β版。
  // リポジトリ内ではgzipをbase64分割して保持し、公開URLでは通常のJSONとして返す。
  app.get("/TRPG/data/skills.beta.json", (req, res, next) => {
    try {
      const gzipCatalog = getTrpgSkillCatalogGzip();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Content-Length", String(gzipCatalog.length));
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("Vary", "Accept-Encoding");
      res.send(gzipCatalog);
    } catch (error) {
      next(error);
    }
  });

  // 部分ツイートの新しい画像パス(/2D画像)を既存素材ディレクトリへ紐づける
  const twoDImagePath = "/2D画像";
  const twoDImageEncodedPath = encodeURI(twoDImagePath);
  const twoDImageAssets = express.static(
    path.join(process.cwd(), "public/2D素材")
  );

  app.use(twoDImagePath, twoDImageAssets);
  app.use(twoDImageEncodedPath, twoDImageAssets);

  // 時々文芸部！を /時々文芸部！ で配信
  app.use(
    "/時々文芸部！",
    express.static(path.join(process.cwd(), "public/bungei-bu"))
  );

  // 時々文芸部！を /時々文芸部！ で配信
  const literaryClubPath = "/時々文芸部！";
  const literaryClubEncodedPath = encodeURI(literaryClubPath);
  const literaryClubAssets = express.static(
    path.join(process.cwd(), "public/bungei-bu")
  );

  app.use(literaryClubPath, literaryClubAssets);
  app.use(literaryClubEncodedPath, literaryClubAssets);

  // 部分ツイートを /部分ツイート で配信
  const partialTweetPath = "/部分ツイート";
  const partialTweetEncodedPath = encodeURI(partialTweetPath);
  const partialTweetAssets = express.static(
    path.join(process.cwd(), "public/partial-tweet")
  );

  app.use(partialTweetPath, partialTweetAssets);
  app.use(partialTweetEncodedPath, partialTweetAssets);

  const hundredOrePath = "/100日後も生きる俺";
  const hundredOreEncodedPath = encodeURI(hundredOrePath);
  const hundredOreAssets = express.static(
    path.join(process.cwd(), "public/100ore")
  );

  app.use("/100ore", hundredOreAssets);
  app.use(hundredOrePath, hundredOreAssets);
  app.use(hundredOreEncodedPath, hundredOreAssets);

  return app;
}
