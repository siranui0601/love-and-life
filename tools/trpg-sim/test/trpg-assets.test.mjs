import assert from "node:assert/strict";
import test from "node:test";
import { chromaKeyPng, decodePng, encodePng } from "../../../src/server/trpg/assets/chroma-key.js";
import { generateGeminiImage } from "../../../src/server/trpg/assets/gemini-image.js";
import { buildBackgroundPrompt, buildPortraitPrompt } from "../../../src/server/trpg/assets/prompt.js";

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
});
