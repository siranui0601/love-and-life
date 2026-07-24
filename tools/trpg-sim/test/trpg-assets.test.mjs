import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import { chromaKeyPng, decodePng, encodePng } from "../../../src/server/trpg/assets/chroma-key.js";
import { generateGeminiImage } from "../../../src/server/trpg/assets/gemini-image.js";
import { buildBackgroundPrompt, buildMonsterPrompt, buildPortraitPrompt } from "../../../src/server/trpg/assets/prompt.js";
import {
  mergeAssetManifests,
  resolveGeneratedAssetPath,
  trpgGeminiAssetGenerationEnabled,
  TrpgRuntimeAssetManager,
  visibleAssetTargets,
} from "../../../src/server/trpg/assets/runtime.js";
import { mountTrpgGameRoutes } from "../../../src/server/trpg/game/routes.js";

function keyedFixture(key) {
  const width = 13;
  const height = 13;
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const pixel = index * 4;
    rgba[pixel] = key[0];
    rgba[pixel + 1] = key[1];
    rgba[pixel + 2] = key[2];
    rgba[pixel + 3] = 255;
  }
  for (let y = 3; y <= 9; y += 1) for (let x = 3; x <= 9; x += 1) {
    const pixel = (y * width + x) * 4;
    rgba[pixel] = 140;
    rgba[pixel + 1] = 55;
    rgba[pixel + 2] = 35;
  }
  return encodePng(width, height, rgba);
}

test("TRPG runtime Gemini assets require a separate opt-in while explicit test keys still work", (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousOptIn = process.env.TRPG_GEMINI_ASSET_GENERATION_ENABLED;
  process.env.GEMINI_API_KEY = "configured-environment-key";
  delete process.env.TRPG_GEMINI_ASSET_GENERATION_ENABLED;
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousOptIn === undefined) delete process.env.TRPG_GEMINI_ASSET_GENERATION_ENABLED;
    else process.env.TRPG_GEMINI_ASSET_GENERATION_ENABLED = previousOptIn;
  });

  assert.equal(trpgGeminiAssetGenerationEnabled(undefined), false);
  assert.equal(trpgGeminiAssetGenerationEnabled("false"), false);
  assert.equal(trpgGeminiAssetGenerationEnabled("yes"), true);
  const data = {
    model: { npcs: [], npcById: {}, facilities: [], facilityById: {} },
    battleData: { monsters: [], monsterById: new Map() },
  };
  const disabled = new TrpgRuntimeAssetManager({ data });
  assert.deepEqual(disabled.health(), {
    enabled: false,
    configured: true,
    paidOptIn: false,
    injected: false,
    mode: "static_assets_only",
    queueLength: 0,
    running: false,
    concurrency: 1,
    manifestUrl: "/TRPG/assets/manifest.json",
  });

  const injected = new TrpgRuntimeAssetManager({ data, apiKey: "test-key" });
  assert.equal(injected.health().enabled, true);
  assert.equal(injected.health().paidOptIn, true);
  assert.equal(injected.health().injected, true);
  assert.equal(injected.health().mode, "gemini_on_first_encounter");
});

for (const [keyColor, rgb] of [["green", [0, 255, 0]], ["pink", [255, 0, 255]]]) {
  test(`${keyColor} chroma key removes only the edge-connected background`, () => {
    const result = chromaKeyPng(keyedFixture(rgb), { keyColor, featherRadius: 3 });
    const decoded = decodePng(result.buffer);
    assert.equal(decoded.rgba[3], 0);
    assert.equal(decoded.rgba[(6 * decoded.width + 6) * 4 + 3], 255);
    assert.ok(result.stats.transparentRatio > 0.5);
    assert.ok(result.stats.foregroundRatio > 0.1);
  });
}

test("Gemini image generation sends bounded references and falls back between models", async () => {
  const calls = [];
  const expected = encodePng(1, 1, Buffer.from([20, 30, 40, 255]));
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (calls.length === 1) return { ok: false, json: async () => ({ error: { message: "model busy" } }) };
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: expected.toString("base64") } }] } }] }),
    };
  };
  const result = await generateGeminiImage({
    apiKey: "test-key",
    prompt: "safe prompt",
    referenceImages: [{ mimeType: "image/png", data: Buffer.from("reference") }],
    models: ["model-a", "model-b"],
    fetchImpl,
  });
  assert.equal(result.model, "model-b");
  assert.deepEqual(result.buffer, expected);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.contents[0].parts.filter((part) => part.inlineData).length, 1);
  assert.equal(calls[0].url.includes("test-key"), false);
  assert.equal(calls[0].headers["x-goog-api-key"], "test-key");
});

test("image generation rejects a claimed MIME type that does not match the bytes", async () => {
  await assert.rejects(() => generateGeminiImage({
    apiKey: "test-key",
    prompt: "safe prompt",
    models: ["model-a"],
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: Buffer.from("not-png").toString("base64") } }] } }] }),
    }),
  }), /unsupported_or_mismatched_image_output/u);
});

test("native PNG decoding rejects oversized declared dimensions before inflation", () => {
  const oversized = Buffer.from(keyedFixture([0, 255, 0]));
  oversized.writeUInt32BE(9_000, 16);
  assert.throws(() => decodePng(oversized), /png_dimensions_too_large/u);
});

test("asset prompts use only supplied public visual fields", () => {
  const portrait = buildPortraitPrompt({
    id: "NPC999",
    name: "公開名",
    species: "人間",
    age: 30,
    gender: "女性",
    home: "田園の村",
    occupation: "毒を盛った使用人・王位を狙う首魁",
    secrets: "絶対に出してはいけない秘密",
    nonInterventionFate: "未来の死亡情報",
  });
  assert.match(portrait.prompt, /公開名/u);
  assert.doesNotMatch(portrait.prompt, /絶対に出してはいけない秘密|未来の死亡情報|毒を盛った|王位を狙う|首魁/u);
  assert.match(portrait.prompt, /#00FF00|#FF00FF/u);
  const background = buildBackgroundPrompt({
    hub: "田園の村",
    name: "村の広場",
    type: "広場",
    function: "T13真因証明・巨神兵封印連動",
    relatedTroubleText: "未発生の破滅",
  });
  assert.match(background.prompt, /田園の村/u);
  assert.doesNotMatch(background.prompt, /未発生の破滅|T13真因証明|巨神兵封印/u);
  const monster = buildMonsterPrompt({
    id: "MON-TEST",
    name: "角兎",
    classification: "monster",
    role: "fast",
    region: "田園の村",
    zone: "村外れ",
    raw: { "説明": "素早く跳ね回る草食魔獣。", "出現条件": "秘密の事件フラグ" },
  });
  assert.match(monster.prompt, /角兎/u);
  assert.match(monster.prompt, /#00FF00|#FF00FF/u);
  assert.doesNotMatch(monster.prompt, /秘密の事件フラグ/u);
});

test("runtime manifest merge accepts only generated asset URLs and path resolution rejects traversal", () => {
  const merged = mergeAssetManifests(
    { schemaVersion: "1.0.0", backgrounds: { STATIC: "/TRPG/assets/backgrounds/static.png" }, portraits: {} },
    {
      updatedAt: "2026-07-19T00:00:00.000Z",
      backgrounds: {
        SAFE: "/TRPG/assets/generated/backgrounds/LOC_SAFE-a1b2c3.png",
        ESCAPE: "/TRPG/assets/generated/backgrounds/../secret.png",
      },
      monsters: { MON1: { default: "/TRPG/assets/generated/monsters/MON1-a1b2c3.png" } },
      prompts: { secret: "must never be exposed" },
    },
  );
  assert.equal(merged.backgrounds.STATIC, "/TRPG/assets/backgrounds/static.png");
  assert.equal(merged.backgrounds.SAFE, "/TRPG/assets/generated/backgrounds/LOC_SAFE-a1b2c3.png");
  assert.equal(merged.backgrounds.ESCAPE, undefined);
  assert.equal(merged.monsters.MON1.default, "/TRPG/assets/generated/monsters/MON1-a1b2c3.png");
  assert.equal(merged.prompts, undefined);
  const root = path.resolve("runtime-test-output");
  assert.equal(resolveGeneratedAssetPath(root, "portraits", "NPC001-a1.png"), path.join(root, "portraits", "NPC001-a1.png"));
  assert.equal(resolveGeneratedAssetPath(root, "portraits", "../secret.png"), null);
  assert.equal(resolveGeneratedAssetPath(root, "private", "NPC001-a1.png"), null);
});

test("authoritative game views are the only source of first-encounter asset ids", () => {
  assert.deepEqual(visibleAssetTargets({
    scene: {
      facilityId: "LOC_FARM_WELL",
      backgroundKey: "LOC_FARM_WELL",
      presentNpcs: [{ id: "NPC004" }, { id: "NPC004" }, { name: "no id" }],
    },
    battle: { actors: [
      { actorId: "PLAYER", side: "player" },
      { actorId: "MON-0002", side: "enemy" },
      { actorId: "MON-0002", side: "enemy" },
    ] },
  }), [
    { type: "background", id: "LOC_FARM_WELL" },
    { type: "portrait", id: "NPC004" },
    { type: "monster", id: "MON-0002" },
  ]);
});

test("runtime generation is deduplicated, serialized, persisted separately, and reused", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "trpg-runtime-assets-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const staticRoot = path.join(temporary, "static");
  const metadataRoot = path.join(temporary, "runtime");
  const outputRoot = path.join(metadataRoot, "outputs");
  await fs.mkdir(staticRoot, { recursive: true });
  const staticManifest = { schemaVersion: "1.0.0", backgrounds: {}, portraits: {}, notes: "tracked-static" };
  await fs.writeFile(path.join(staticRoot, "manifest.json"), JSON.stringify(staticManifest));
  const npcs = [
    { id: "NPC_A", name: "A", species: "人間", home: "田園の村" },
    { id: "NPC_B", name: "B", species: "人間", home: "田園の村" },
  ];
  const facilities = [{ id: "LOC_A", name: "井戸", hub: "田園の村", type: "井戸" }];
  const monsters = [{ id: "MON_A", name: "角兎", region: "田園の村", zone: "村外れ", raw: { "説明": "角のある兎。" } }];
  const data = {
    contentRevision: "test-revision",
    model: {
      npcs,
      npcById: Object.fromEntries(npcs.map((npc) => [npc.id, npc])),
      facilities,
      facilityById: Object.fromEntries(facilities.map((facility) => [facility.id, facility])),
    },
    battleData: { monsters, monsterById: new Map(monsters.map((monster) => [monster.id, monster])) },
  };
  let active = 0;
  let maximumActive = 0;
  const calls = [];
  const generatedPng = keyedFixture([0, 255, 0]);
  const manager = new TrpgRuntimeAssetManager({
    data,
    apiKey: "test-key",
    staticRoot,
    metadataRoot,
    outputRoot,
    logger: { warn() {} },
    generateImage: async ({ prompt }) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      calls.push(prompt);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { buffer: generatedPng, mimeType: "image/png", model: "fake-gemini", referenceCount: 0 };
    },
  });
  manager.enqueueForSave({
    scene: { facilityId: "LOC_A", presentNpcs: [{ id: "NPC_A" }, { id: "NPC_B" }, { id: "NPC_A" }] },
    battle: { actors: [{ actorId: "MON_A", side: "enemy" }] },
  });
  manager.enqueue({ type: "portrait", id: "NPC_A" });
  manager.enqueue({ type: "portrait", id: "UNKNOWN_FROM_CLIENT" });
  await manager.waitForIdle();
  assert.equal(calls.length, 4);
  assert.equal(maximumActive, 1, "Gemini image generation concurrency must remain one");
  const runtimeManifest = JSON.parse(await fs.readFile(path.join(metadataRoot, "runtime-manifest.json"), "utf8"));
  assert.match(runtimeManifest.backgrounds.LOC_A, /^\/TRPG\/assets\/generated\/backgrounds\//u);
  assert.match(runtimeManifest.portraits.NPC_A.default, /^\/TRPG\/assets\/generated\/portraits\//u);
  assert.match(runtimeManifest.monsters.MON_A.default, /^\/TRPG\/assets\/generated\/monsters\//u);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(staticRoot, "manifest.json"), "utf8")), staticManifest);
  const combined = await manager.combinedManifest();
  assert.equal(combined.notes, "tracked-static");
  assert.equal(combined.portraits.NPC_A.default, runtimeManifest.portraits.NPC_A.default);
  manager.enqueue({ type: "portrait", id: "NPC_A" });
  await manager.waitForIdle();
  assert.equal(calls.length, 4, "same cache key must reuse the stored output");
});

test("runtime generation failure is contained and enters retry backoff", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "trpg-runtime-assets-failure-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const staticRoot = path.join(temporary, "static");
  const metadataRoot = path.join(temporary, "runtime");
  await fs.mkdir(staticRoot, { recursive: true });
  await fs.writeFile(path.join(staticRoot, "manifest.json"), "{}");
  const npc = { id: "NPC_FAIL", name: "Fail", species: "人間", home: "田園の村" };
  const data = {
    contentRevision: "failure-revision",
    model: { npcs: [npc], npcById: { NPC_FAIL: npc }, facilities: [], facilityById: {} },
    battleData: { monsters: [], monsterById: new Map() },
  };
  let calls = 0;
  const manager = new TrpgRuntimeAssetManager({
    data,
    apiKey: "test-key",
    staticRoot,
    metadataRoot,
    outputRoot: path.join(metadataRoot, "outputs"),
    logger: { warn() {} },
    generateImage: async () => { calls += 1; throw new Error("temporary image outage"); },
  });
  assert.equal(manager.enqueue({ type: "portrait", id: "NPC_FAIL" }), true);
  await manager.waitForIdle();
  assert.equal(calls, 1);
  assert.equal(manager.enqueue({ type: "portrait", id: "NPC_FAIL" }), true);
  await manager.waitForIdle();
  assert.equal(calls, 1, "failed cache keys must not hammer Gemini on each save GET");
  const generation = JSON.parse(await fs.readFile(path.join(metadataRoot, "runtime-generation-manifest.json"), "utf8"));
  assert.equal(generation.assets["portrait:NPC_FAIL"].status, "failed");
});

test("the legacy manifest URL is served by the static/runtime merger", async (t) => {
  const app = express();
  const assetManager = {
    async combinedManifest() { return { schemaVersion: "1.0.0", backgrounds: { RUNTIME: "/TRPG/assets/generated/backgrounds/RUNTIME-a1.png" } }; },
    generatedFilePath() { return null; },
    enqueueForSave() {},
    health() { return { enabled: true, concurrency: 1 }; },
  };
  const service = { data: {}, health() { return { ok: true }; } };
  mountTrpgGameRoutes(app, { service, assetManager });
  const server = http.createServer(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const manifestResponse = await fetch(`http://127.0.0.1:${port}/TRPG/assets/manifest.json`);
  assert.equal(manifestResponse.status, 200);
  assert.equal((await manifestResponse.json()).backgrounds.RUNTIME, "/TRPG/assets/generated/backgrounds/RUNTIME-a1.png");
  const healthResponse = await fetch(`http://127.0.0.1:${port}/TRPG/api/game/health`);
  assert.equal((await healthResponse.json()).assetGeneration.enabled, true);
});
