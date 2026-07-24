import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTrpgGameData } from "../game/game-data.js";
import { chromaKeyPng } from "./chroma-key.js";
import { generateGeminiImage, TRPG_IMAGE_MODELS } from "./gemini-image.js";
import { normalizeToPng } from "./normalize.js";
import {
  buildBackgroundPrompt,
  buildMonsterPrompt,
  buildPortraitPrompt,
  TRPG_ASSET_PROMPT_VERSION,
} from "./prompt.js";
import { assetHash, extensionForMime, TrpgAssetStore } from "./store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../..");

export const TRPG_RUNTIME_ASSET_URL_ROOT = "/TRPG/assets/generated";
export const TRPG_STATIC_ASSET_ROOT = path.join(REPO_ROOT, "public", "TRPG", "assets");
export const TRPG_RUNTIME_ASSET_METADATA_ROOT = path.join(REPO_ROOT, "runtime-data", "TRPG", "assets");
export const TRPG_RUNTIME_ASSET_OUTPUT_ROOT = path.join(TRPG_RUNTIME_ASSET_METADATA_ROOT, "outputs");
export const TRPG_RUNTIME_ASSET_MANIFEST = path.join(TRPG_RUNTIME_ASSET_METADATA_ROOT, "runtime-manifest.json");

const ENV_API_KEY = Symbol("environment-api-key");
const TYPE_DIRECTORY = Object.freeze({
  portrait: "portraits",
  background: "backgrounds",
  monster: "monsters",
});
const SAFE_GENERATED_FILE = /^[A-Za-z0-9_-]{1,120}\.(?:png|webp|jpe?g)$/iu;

export function trpgGeminiAssetGenerationEnabled(
  value = process.env.TRPG_GEMINI_ASSET_GENERATION_ENABLED,
) {
  return /^(?:1|true|yes|on)$/iu.test(String(value ?? "").trim());
}

async function readJson(filePath, fallback = {}) {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function mimeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  throw new Error("unsupported_reference_extension");
}

function manifestAsset(manifest, type, id) {
  if (type === "background") return manifest?.backgrounds?.[id] ?? null;
  if (type === "portrait") return manifest?.portraits?.[id]?.default ?? manifest?.portraits?.[id] ?? null;
  if (type === "monster") return manifest?.monsters?.[id]?.default ?? manifest?.monsters?.[id] ?? null;
  return null;
}

function runtimeUrl(type, value) {
  const directory = TYPE_DIRECTORY[type];
  const prefix = `${TRPG_RUNTIME_ASSET_URL_ROOT}/${directory}/`;
  if (typeof value !== "string" || !value.startsWith(prefix)) return null;
  const fileName = value.slice(prefix.length);
  return SAFE_GENERATED_FILE.test(fileName) && !fileName.includes("..") ? value : null;
}

function runtimeEntries(manifest, type) {
  const sourceKey = type === "background" ? "backgrounds" : type === "portrait" ? "portraits" : "monsters";
  const source = manifest?.[sourceKey];
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source).flatMap(([id, entry]) => {
    const url = runtimeUrl(type, typeof entry === "string" ? entry : entry?.default);
    if (!url) return [];
    if (type === "background") return [[id, url]];
    return [[id, { default: url, neutral: url }]];
  }));
}

/** Merge only public URL mappings. Generation prompts/errors never cross the API boundary. */
export function mergeAssetManifests(staticManifest = {}, runtimeManifest = {}) {
  const staticBackgrounds = staticManifest?.backgrounds && typeof staticManifest.backgrounds === "object"
    ? staticManifest.backgrounds
    : {};
  const staticPortraits = staticManifest?.portraits && typeof staticManifest.portraits === "object"
    ? staticManifest.portraits
    : {};
  const staticMonsters = staticManifest?.monsters && typeof staticManifest.monsters === "object"
    ? staticManifest.monsters
    : {};
  return {
    ...staticManifest,
    schemaVersion: staticManifest.schemaVersion ?? "1.0.0",
    backgrounds: { ...staticBackgrounds, ...runtimeEntries(runtimeManifest, "background") },
    portraits: { ...staticPortraits, ...runtimeEntries(runtimeManifest, "portrait") },
    monsters: { ...staticMonsters, ...runtimeEntries(runtimeManifest, "monster") },
    runtimeAssets: {
      source: "gemini-on-first-encounter",
      updatedAt: typeof runtimeManifest.updatedAt === "string" ? runtimeManifest.updatedAt : null,
    },
  };
}

export function resolveGeneratedAssetPath(outputRoot, kind, fileName) {
  if (!Object.values(TYPE_DIRECTORY).includes(kind)) return null;
  if (!SAFE_GENERATED_FILE.test(String(fileName ?? "")) || String(fileName).includes("..")) return null;
  const root = path.resolve(outputRoot);
  const typeRoot = path.resolve(root, kind);
  const resolved = path.resolve(typeRoot, fileName);
  if (!resolved.startsWith(`${typeRoot}${path.sep}`)) return null;
  return resolved;
}

function uniqueTargets(targets) {
  const seen = new Set();
  return targets.filter((target) => {
    const key = `${target.type}:${target.id}`;
    if (!target.id || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The browser cannot submit a prompt or arbitrary asset id. Only identifiers
 * already present in the authoritative game view are collected here.
 */
export function visibleAssetTargets(save) {
  const targets = [];
  const facilityId = String(save?.scene?.facilityId ?? "").trim();
  const backgroundKey = String(save?.scene?.backgroundKey ?? "").trim();
  if (facilityId) targets.push({ type: "background", id: facilityId });
  if (backgroundKey && backgroundKey !== facilityId) targets.push({ type: "background", id: backgroundKey });
  for (const npc of Array.isArray(save?.scene?.presentNpcs) ? save.scene.presentNpcs : []) {
    const id = String(npc?.id ?? "").trim();
    if (id) targets.push({ type: "portrait", id });
  }
  for (const actor of Array.isArray(save?.battle?.actors) ? save.battle.actors : []) {
    const id = String(actor?.actorId ?? "").trim();
    if (actor?.side === "enemy" && id) targets.push({ type: "monster", id });
  }
  return uniqueTargets(targets);
}

function updateRuntimeManifest(manifest, target, outputUrl) {
  manifest.schemaVersion ??= "1.0.0";
  if (target.type === "background") {
    manifest.backgrounds ??= {};
    manifest.backgrounds[target.id] = outputUrl;
    return;
  }
  const key = target.type === "portrait" ? "portraits" : "monsters";
  manifest[key] ??= {};
  manifest[key][target.id] = { default: outputUrl, neutral: outputUrl };
}

export class TrpgRuntimeAssetManager {
  constructor({
    data = loadTrpgGameData(),
    apiKey = ENV_API_KEY,
    staticRoot = TRPG_STATIC_ASSET_ROOT,
    metadataRoot = TRPG_RUNTIME_ASSET_METADATA_ROOT,
    outputRoot = TRPG_RUNTIME_ASSET_OUTPUT_ROOT,
    models = TRPG_IMAGE_MODELS,
    generateImage = generateGeminiImage,
    fetchImpl = globalThis.fetch,
    retryMs = 6 * 60 * 60_000,
    maxQueue = 256,
    logger = console,
  } = {}) {
    const apiKeyInjected = apiKey !== ENV_API_KEY;
    const configuredApiKey = apiKeyInjected ? apiKey : process.env.GEMINI_API_KEY;
    const paidOptIn = apiKeyInjected || trpgGeminiAssetGenerationEnabled();
    this.data = data;
    this.apiKey = paidOptIn ? configuredApiKey : null;
    this.providerStatus = Object.freeze({
      enabled: Boolean(this.apiKey),
      configured: Boolean(configuredApiKey),
      paidOptIn,
      injected: apiKeyInjected,
      mode: this.apiKey ? "gemini_on_first_encounter" : "static_assets_only",
    });
    this.staticRoot = path.resolve(staticRoot);
    this.metadataRoot = path.resolve(metadataRoot);
    this.outputRoot = path.resolve(outputRoot);
    this.models = [...models];
    this.generateImage = generateImage;
    this.fetchImpl = fetchImpl;
    this.retryMs = Math.max(60_000, Number(retryMs) || 6 * 60 * 60_000);
    this.maxQueue = Math.max(1, Number(maxQueue) || 256);
    this.logger = logger;
    this.staticManifestPath = path.join(this.staticRoot, "manifest.json");
    this.runtimeManifestPath = path.join(this.metadataRoot, "runtime-manifest.json");
    this.store = new TrpgAssetStore({
      root: this.outputRoot,
      metadataRoot: this.metadataRoot,
      urlRoot: TRPG_RUNTIME_ASSET_URL_ROOT,
      generationManifestPath: path.join(this.metadataRoot, "runtime-generation-manifest.json"),
      uiManifestPath: this.runtimeManifestPath,
    });
    this.queue = [];
    this.scheduled = new Set();
    this.running = false;
    this.idleWaiters = [];
    this.warnedMissingKey = false;
  }

  health() {
    return {
      ...this.providerStatus,
      queueLength: this.queue.length,
      running: this.running,
      concurrency: 1,
      manifestUrl: "/TRPG/assets/manifest.json",
    };
  }

  async combinedManifest() {
    const [staticManifest, runtimeManifest] = await Promise.all([
      readJson(this.staticManifestPath, {}),
      readJson(this.runtimeManifestPath, {}),
    ]);
    return mergeAssetManifests(staticManifest, runtimeManifest);
  }

  generatedFilePath(kind, fileName) {
    return resolveGeneratedAssetPath(this.outputRoot, kind, fileName);
  }

  enqueueForSave(save) {
    for (const target of visibleAssetTargets(save)) this.enqueue(target);
  }

  enqueue(target) {
    const normalized = this.#knownTarget(target);
    if (!normalized) return false;
    const key = `${normalized.type}:${normalized.id}`;
    if (this.scheduled.has(key) || this.queue.length >= this.maxQueue) return false;
    this.scheduled.add(key);
    this.queue.push(normalized);
    queueMicrotask(() => { void this.#drain(); });
    return true;
  }

  waitForIdle() {
    if (!this.running && !this.queue.length) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  #knownTarget(target) {
    const type = String(target?.type ?? "");
    const id = String(target?.id ?? "").trim();
    let source = null;
    if (type === "portrait") source = this.data.model.npcById?.[id] ?? this.data.model.npcs.find((entry) => entry.id === id);
    if (type === "background") source = this.data.model.facilityById?.[id] ?? this.data.model.facilities.find((entry) => entry.id === id);
    if (type === "monster") source = this.data.battleData.monsterById?.get(id) ?? this.data.battleData.monsters.find((entry) => entry.id === id);
    return source ? { type, id, source } : null;
  }

  async #drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const target = this.queue.shift();
        const key = `${target.type}:${target.id}`;
        try {
          await this.#ensureTarget(target);
        } catch (error) {
          this.logger?.warn?.("[TRPG assets] asynchronous generation failed", {
            type: target.type,
            id: target.id,
            error: String(error?.message ?? error).slice(0, 240),
          });
        } finally {
          this.scheduled.delete(key);
        }
      }
    } finally {
      this.running = false;
      for (const resolve of this.idleWaiters.splice(0)) resolve();
    }
  }

  async #staticAssetExists(target, staticManifest) {
    const url = manifestAsset(staticManifest, target.type, target.id);
    if (!url || typeof url !== "string" || !url.startsWith("/TRPG/assets/")) return false;
    if (url.startsWith(`${TRPG_RUNTIME_ASSET_URL_ROOT}/`)) return false;
    const relative = decodeURIComponent(url.slice("/TRPG/assets/".length));
    const resolved = path.resolve(this.staticRoot, relative);
    if (!resolved.startsWith(`${this.staticRoot}${path.sep}`)) return false;
    return fs.access(resolved).then(() => true, () => false);
  }

  async #reference(relativePath) {
    const resolved = path.resolve(this.staticRoot, relativePath);
    if (!resolved.startsWith(`${this.staticRoot}${path.sep}`)) return null;
    try {
      const data = await fs.readFile(resolved);
      if (!data.length || data.length > 4 * 1024 * 1024) return null;
      return { mimeType: mimeForPath(resolved), data, hash: assetHash(data) };
    } catch {
      return null;
    }
  }

  async #references(type) {
    const paths = type === "background"
      ? ["backgrounds/farm-field.png", "backgrounds/farm-square.png"]
      : type === "monster"
        ? ["portraits/NPC004-cutout.png", "backgrounds/farm-edge.png"]
        : ["portraits/NPC004-cutout.png", "portraits/NPC002-cutout.png"];
    return (await Promise.all(paths.map((relativePath) => this.#reference(relativePath)))).filter(Boolean);
  }

  #promptFor(target, previous) {
    if (target.type === "portrait") {
      return buildPortraitPrompt(target.source, {
        visualProfile: previous?.promptVersion === TRPG_ASSET_PROMPT_VERSION ? previous.visualProfile : null,
        keyColor: previous?.keyColor,
      });
    }
    if (target.type === "monster") return buildMonsterPrompt(target.source, { keyColor: previous?.keyColor });
    return buildBackgroundPrompt(target.source);
  }

  async #ensureTarget(target) {
    const staticManifest = await readJson(this.staticManifestPath, {});
    if (await this.#staticAssetExists(target, staticManifest)) return { status: "static" };
    if (!this.apiKey) {
      if (!this.warnedMissingKey) {
        this.warnedMissingKey = true;
        const reason = this.providerStatus.configured
          ? "TRPG_GEMINI_ASSET_GENERATION_ENABLED is not opted in"
          : "GEMINI_API_KEY is absent";
        this.logger?.warn?.(`[TRPG assets] ${reason}; first-encounter images stay on fallback art`);
      }
      return { status: "disabled" };
    }
    await this.store.ensure();
    const generationManifest = await this.store.readGenerationManifest();
    generationManifest.assets ??= {};
    const runtimeManifest = await this.store.readUiManifest();
    const manifestKey = `${target.type}:${target.id}`;
    const previous = generationManifest.assets[manifestKey] ?? null;
    const promptData = this.#promptFor(target, previous);
    const references = await this.#references(target.type);
    const cacheKey = assetHash({
      promptVersion: TRPG_ASSET_PROMPT_VERSION,
      contentRevision: this.data.contentRevision,
      type: target.type,
      id: target.id,
      prompt: promptData.prompt,
      keyColor: promptData.keyColor ?? null,
      referenceHashes: references.map((reference) => reference.hash),
      models: this.models,
    });
    if (previous?.cacheKey === cacheKey && await this.store.ready(previous)) return { status: "cached" };
    const previousTime = Date.parse(previous?.updatedAt ?? "");
    if (previous?.cacheKey === cacheKey && previous?.status === "failed"
      && Number.isFinite(previousTime) && Date.now() - previousTime < this.retryMs) {
      return { status: "backoff" };
    }
    const base = {
      id: target.id,
      type: target.type,
      cacheKey,
      contentRevision: this.data.contentRevision,
      promptVersion: TRPG_ASSET_PROMPT_VERSION,
      prompt: promptData.prompt,
      visualProfile: promptData.visualProfile ?? null,
      keyColor: promptData.keyColor ?? null,
      referenceHashes: references.map((reference) => reference.hash),
      attempts: Number(previous?.attempts ?? 0) + 1,
      status: "generating",
      updatedAt: new Date().toISOString(),
    };
    generationManifest.assets[manifestKey] = base;
    await this.store.writeManifests(generationManifest, runtimeManifest);
    try {
      const image = await this.generateImage({
        apiKey: this.apiKey,
        prompt: promptData.prompt,
        referenceImages: references.map(({ mimeType, data }) => ({ mimeType, data })),
        models: this.models,
        fetchImpl: this.fetchImpl,
      });
      const original = this.store.file("original", `${target.type}-${target.id}`, cacheKey.slice(0, 12), extensionForMime(image.mimeType));
      await this.store.writeBinary(original, image.buffer);
      const normalized = await normalizeToPng(image.buffer, image.mimeType);
      let outputBuffer = normalized.buffer;
      let chromaStats = null;
      if (target.type === "portrait" || target.type === "monster") {
        const keyed = chromaKeyPng(normalized.buffer, { keyColor: promptData.keyColor, featherRadius: 3 });
        chromaStats = keyed.stats;
        if (keyed.stats.transparentRatio < 0.12 || keyed.stats.foregroundRatio < 0.04 || keyed.stats.foregroundRatio > 0.88) {
          throw new Error(`chroma_quality_rejected:${JSON.stringify(keyed.stats)}`);
        }
        outputBuffer = keyed.buffer;
      }
      const output = this.store.file(target.type, target.id, cacheKey.slice(0, 12), "png");
      await this.store.writeBinary(output, outputBuffer);
      generationManifest.assets[manifestKey] = {
        ...base,
        status: "ready",
        originalPath: original.url,
        outputPath: output.url,
        mimeType: image.mimeType,
        model: image.model,
        referenceCount: image.referenceCount,
        normalizedBy: normalized.normalizedBy,
        chromaStats,
        updatedAt: new Date().toISOString(),
      };
      updateRuntimeManifest(runtimeManifest, target, output.url);
      await this.store.writeManifests(generationManifest, runtimeManifest);
      return { status: "ready", outputPath: output.url };
    } catch (error) {
      generationManifest.assets[manifestKey] = {
        ...base,
        status: "failed",
        error: String(error?.message ?? error).slice(0, 1_000),
        updatedAt: new Date().toISOString(),
      };
      await this.store.writeManifests(generationManifest, runtimeManifest);
      throw error;
    }
  }
}
