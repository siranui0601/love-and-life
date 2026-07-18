#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTrpgGameData } from "../../src/server/trpg/game/game-data.js";
import { chromaKeyPng } from "../../src/server/trpg/assets/chroma-key.js";
import { generateGeminiImage, TRPG_IMAGE_MODELS } from "../../src/server/trpg/assets/gemini-image.js";
import { normalizeToPng } from "../../src/server/trpg/assets/normalize.js";
import { buildBackgroundPrompt, buildPortraitPrompt, TRPG_ASSET_PROMPT_VERSION } from "../../src/server/trpg/assets/prompt.js";
import { assetHash, extensionForMime, TrpgAssetStore } from "../../src/server/trpg/assets/store.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ASSET_ROOT = path.join(REPO_ROOT, "public", "TRPG", "assets");
const ASSET_METADATA_ROOT = path.join(REPO_ROOT, "runtime-data", "TRPG", "assets");
const ALLOWED_TYPES = new Set(["portrait", "background"]);

function option(name, fallback = null) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--") ? process.argv[index + 1] : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function mimeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  throw new Error(`unsupported_reference_extension:${extension}`);
}

async function allowedReference(relativePath) {
  const resolved = path.resolve(ASSET_ROOT, relativePath);
  if (!resolved.startsWith(`${ASSET_ROOT}${path.sep}`)) throw new Error("reference_path_escape");
  const data = await fs.readFile(resolved);
  if (data.length > 4 * 1024 * 1024) throw new Error(`reference_too_large:${relativePath}`);
  return { path: resolved, mimeType: mimeForPath(resolved), data, hash: assetHash(data) };
}

async function referencesFor(type) {
  const paths = type === "portrait"
    ? ["portraits/NPC004.png", "portraits/NPC002.png"]
    : ["backgrounds/farm-field.png", "backgrounds/farm-square.png"];
  const output = [];
  for (const relativePath of paths) {
    try { output.push(await allowedReference(relativePath)); } catch { /* A missing style reference must not stop generation. */ }
  }
  return output;
}

async function mappedAssetExists(uiManifest, type, id) {
  const url = type === "portrait" ? uiManifest.portraits?.[id]?.default : uiManifest.backgrounds?.[id];
  if (!url || !String(url).startsWith("/TRPG/assets/")) return false;
  const relative = decodeURIComponent(String(url).slice("/TRPG/assets/".length));
  const resolved = path.resolve(ASSET_ROOT, relative);
  if (!resolved.startsWith(`${ASSET_ROOT}${path.sep}`)) return false;
  return fs.access(resolved).then(() => true, () => false);
}

function targetList(data, types, idFilter) {
  const output = [];
  if (types.has("portrait")) {
    for (const npc of data.model.npcs) if (!idFilter || npc.id === idFilter) output.push({ type: "portrait", id: npc.id, source: npc });
  }
  if (types.has("background")) {
    for (const facility of data.model.facilities) if (!idFilter || facility.id === idFilter) output.push({ type: "background", id: facility.id, source: facility });
  }
  return output;
}

function updateUiManifest(uiManifest, target, outputUrl) {
  uiManifest.schemaVersion ??= "1.0.0";
  if (target.type === "portrait") {
    uiManifest.portraits ??= {};
    uiManifest.portraits[target.id] = { ...(uiManifest.portraits[target.id] ?? {}), default: outputUrl, neutral: outputUrl };
  } else {
    uiManifest.backgrounds ??= {};
    uiManifest.backgrounds[target.id] = outputUrl;
  }
}

async function generateTarget({ target, data, store, generationManifest, uiManifest, force, dryRun }) {
  const previous = generationManifest.assets?.[`${target.type}:${target.id}`] ?? null;
  const promptData = target.type === "portrait"
    ? buildPortraitPrompt(target.source, {
      visualProfile: previous?.promptVersion === TRPG_ASSET_PROMPT_VERSION ? previous.visualProfile : null,
    })
    : buildBackgroundPrompt(target.source);
  const references = await referencesFor(target.type);
  const cacheKey = assetHash({
    promptVersion: TRPG_ASSET_PROMPT_VERSION,
    contentRevision: data.contentRevision,
    type: target.type,
    id: target.id,
    prompt: promptData.prompt,
    keyColor: promptData.keyColor ?? null,
    referenceHashes: references.map((reference) => reference.hash),
    models: TRPG_IMAGE_MODELS,
  });
  if (!force && previous?.cacheKey === cacheKey && await store.ready(previous)) return { status: "cached", id: target.id };
  if (dryRun) return { status: "planned", id: target.id, keyColor: promptData.keyColor ?? null, prompt: promptData.prompt.slice(0, 180) };
  const base = {
    id: target.id,
    type: target.type,
    cacheKey,
    contentRevision: data.contentRevision,
    promptVersion: TRPG_ASSET_PROMPT_VERSION,
    prompt: promptData.prompt,
    visualProfile: promptData.visualProfile ?? null,
    keyColor: promptData.keyColor ?? null,
    referenceHashes: references.map((reference) => reference.hash),
    status: "generating",
    updatedAt: new Date().toISOString(),
  };
  generationManifest.assets[`${target.type}:${target.id}`] = base;
  await store.writeManifests(generationManifest, uiManifest);
  try {
    const image = await generateGeminiImage({
      apiKey: process.env.GEMINI_API_KEY,
      prompt: promptData.prompt,
      referenceImages: references.map(({ mimeType, data: bytes }) => ({ mimeType, data: bytes })),
    });
    const sourceExtension = extensionForMime(image.mimeType);
    const original = store.file("original", target.id, cacheKey.slice(0, 12), sourceExtension);
    await store.writeBinary(original, image.buffer);
    const normalized = await normalizeToPng(image.buffer, image.mimeType);
    let output;
    let chromaStats = null;
    const normalizedBy = normalized.normalizedBy;
    if (target.type === "portrait") {
      const keyed = chromaKeyPng(normalized.buffer, { keyColor: promptData.keyColor, featherRadius: 3 });
      chromaStats = keyed.stats;
      if (keyed.stats.transparentRatio < 0.12 || keyed.stats.foregroundRatio < 0.04 || keyed.stats.foregroundRatio > 0.88) {
        throw new Error(`chroma_quality_rejected:${JSON.stringify(keyed.stats)}`);
      }
      output = store.file("portrait", target.id, "", "png");
      await store.writeBinary(output, keyed.buffer);
    } else {
      output = store.file("background", target.id, "", "png");
      await store.writeBinary(output, normalized.buffer);
    }
    const record = {
      ...base,
      status: "ready",
      originalPath: original.url,
      outputPath: output.url,
      mimeType: image.mimeType,
      model: image.model,
      referenceCount: image.referenceCount,
      normalizedBy,
      chromaStats,
      updatedAt: new Date().toISOString(),
    };
    generationManifest.assets[`${target.type}:${target.id}`] = record;
    updateUiManifest(uiManifest, target, output.url);
    await store.writeManifests(generationManifest, uiManifest);
    return { status: "ready", id: target.id, outputPath: output.url, model: image.model };
  } catch (error) {
    const record = { ...base, status: "failed", error: String(error?.message ?? error).slice(0, 1_000), updatedAt: new Date().toISOString() };
    generationManifest.assets[`${target.type}:${target.id}`] = record;
    await store.writeManifests(generationManifest, uiManifest);
    return { status: "failed", id: target.id, error: record.error };
  }
}

async function main() {
  const requested = new Set(String(option("type", "portrait,background")).split(",").map((value) => value.trim()).filter(Boolean));
  if ([...requested].some((value) => !ALLOWED_TYPES.has(value))) throw new Error("type_must_be_portrait_or_background");
  const idFilter = option("id");
  const force = flag("force");
  const dryRun = flag("dry-run");
  const missingOnly = flag("missing-only") || !force;
  const limit = Math.max(1, Math.min(500, Number(option("limit", "12")) || 12));
  const data = loadTrpgGameData();
  const store = new TrpgAssetStore({ root: ASSET_ROOT, metadataRoot: ASSET_METADATA_ROOT });
  await store.ensure();
  const generationManifest = await store.readGenerationManifest();
  generationManifest.assets ??= {};
  const uiManifest = await store.readUiManifest();
  const targets = [];
  for (const target of targetList(data, requested, idFilter)) {
    if (missingOnly && await mappedAssetExists(uiManifest, target.type, target.id)) continue;
    targets.push(target);
    if (targets.length >= limit) break;
  }
  if (!targets.length) {
    console.log(JSON.stringify({ ok: true, generated: 0, message: "no_missing_assets" }, null, 2));
    return;
  }
  if (!dryRun && !process.env.GEMINI_API_KEY) {
    console.log(JSON.stringify({ ok: true, generated: 0, skipped: targets.length, reason: "GEMINI_API_KEY is not configured", targets: targets.map(({ type, id }) => ({ type, id })) }, null, 2));
    return;
  }
  const results = [];
  for (const target of targets) results.push(await generateTarget({ target, data, store, generationManifest, uiManifest, force, dryRun }));
  console.log(JSON.stringify({ ok: true, contentRevision: data.contentRevision, promptVersion: TRPG_ASSET_PROMPT_VERSION, results }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error).slice(0, 1_000) }, null, 2));
  process.exitCode = 1;
});
