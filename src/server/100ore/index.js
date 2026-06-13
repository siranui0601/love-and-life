import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../../foundation/env.js";
import { appendHundredOreCache, appendHundredOreRun, getHundredOreRunById, listHundredOreCacheBySceneKey, listHundredOreRankings } from "../../foundation/sheets.js";

const HUNDRED_ORE_PUBLIC_PATH = "/100日後も生きる俺";
const FALLBACK_IMAGES = new Map();
const MEMORY_RUNS = [];
const MEMORY_CACHES = [];
const INITIAL_IMAGE_FILE = "BF66A272-598E-4054-BC65-FBD62E988BA9.png";
const INITIAL_IMAGE_PATH = path.join(process.cwd(), "public/2D素材", INITIAL_IMAGE_FILE);
const INITIAL_IMAGE_URL = `/2D画像/${INITIAL_IMAGE_FILE}`;
const TEXT_TIMEOUT_MS = 12000;
const IMAGE_TIMEOUT_MS = 30000;
const VISION_TIMEOUT_MS = 30000;
const BAD_END_RATE = 0.3;
const VERSION = "eight-fifteen-simple-flow-v1";
const TEXT_MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const IMAGE_MODEL_CANDIDATES = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview", "gemini-2.5-flash-image-preview"];
const LOCAL_IMAGE_DIR = path.join(process.cwd(), "public/8-15-images");
const LOCAL_IMAGE_URL_PREFIX = "/8-15-images";


const INITIAL_PAGE_TEXT = {
  pageNumber: 1,
  title: "1ページ目: 猫を追う少女",
  bodyText: `気がつくと、俺は真夏の公園に立っていた。記憶は曖昧なのに、ベンチの向こうで黒猫を追う少女だけは知っている気がする。守らなきゃ。そう思った瞬間、猫が柵を抜けて外へ逃げ、少女も追いかけて走り出した。時計は12時40分を指していた。`,
  storySoFar: `俺は理由も分からず真夏の公園に立っている。黒猫を追う少女を見て、強く守りたいと感じた。猫は柵の隙間から公園の外へ逃げ、少女も追い始めた。時計は12時40分。`,
  imageUrl: INITIAL_IMAGE_URL,
  gameOver: false,
};

function jsonFromText(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const target = fenced || raw.match(/\{[\s\S]*\}/)?.[0] || raw;
  return JSON.parse(target);
}
function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return { mimeType: "image/jpeg", base64: "" };
  return { mimeType: match[1], base64: match[2] };
}
function dataUrlToBase64(dataUrl) { return parseDataUrl(dataUrl).base64; }
function imageExtensionFromMimeType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("svg")) return "svg";
  if (normalized.includes("webp")) return "webp";
  return "jpg";
}
function sanitizeFilePart(value, max = 48) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max) || "image";
}
async function saveHundredOreImageLocally({ imageDataUrl, imageHash, pageNumber, title, runId, cacheId, gameOver } = {}) {
  const { mimeType, base64 } = parseDataUrl(imageDataUrl);
  if (!base64) throw new Error("image_data_url_required");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("image_buffer_empty");
  await fs.mkdir(LOCAL_IMAGE_DIR, { recursive: true });
  const ext = imageExtensionFromMimeType(mimeType);
  const ownerId = sanitizeFilePart(cacheId || runId || "run", 40);
  const titlePart = sanitizeFilePart(title, 40);
  const parts = [
    ownerId,
    `p${Number(pageNumber || 0) || 0}`,
    gameOver ? "badend" : "page",
    sanitizeFilePart(String(imageHash || "").slice(0, 12), 12),
    titlePart,
  ].filter(Boolean);
  const fileName = `${parts.join("-")}.${ext}`;
  await fs.writeFile(path.join(LOCAL_IMAGE_DIR, fileName), buffer);
  return { imageUrl: `${LOCAL_IMAGE_URL_PREFIX}/${encodeURIComponent(fileName)}` };
}
function sha256(input) { return crypto.createHash("sha256").update(String(input || "")).digest("hex"); }
function sha256Buffer(input) { return crypto.createHash("sha256").update(input).digest("hex"); }
function clampText(value, max = 260) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function errorMessage(error) { return String(error?.message || error || "unknown_error").slice(0, 220); }
function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
function normalizeChangeLabels(labels) {
  return (Array.isArray(labels) ? labels : [])
    .map((label) => clampText(label, 40))
    .filter(Boolean)
    .slice(0, 5);
}
function buildResultSceneKey(sourceSceneKey, changeLabels, title, storySoFar) {
  return sha256(`${sourceSceneKey}|${normalizeChangeLabels(changeLabels).join("|")}|${title}|${storySoFar}`).slice(0, 16);
}
function titlePrefix(pageNumber) { return `${pageNumber}ページ目: `; }
function fixTitle(title, pageNumber) {
  const prefix = titlePrefix(pageNumber);
  const raw = clampText(title, 40).replace(/^\d+\s*(?:日|ページ)目[：: ]\s*/, "");
  return raw.startsWith(prefix) ? raw : `${prefix}${raw || "次の場面"}`;
}
async function initialImageHash() {
  const buffer = await fs.readFile(INITIAL_IMAGE_PATH);
  return sha256Buffer(buffer);
}
async function buildInitialPage() {
  const imageHash = await initialImageHash();
  return {
    ...INITIAL_PAGE_TEXT,
    sceneKey: sha256(`${imageHash}|${INITIAL_PAGE_TEXT.storySoFar}`).slice(0, 16),
    imageHash,
  };
}
function normalizePage(page = {}, pageNumber = 1) {
  return {
    pageNumber,
    title: fixTitle(page.title, pageNumber),
    bodyText: clampText(page.bodyText, 160) || "物語が動いた。",
    storySoFar: clampText(page.storySoFar, 300) || "物語が動いた。",
    sceneKey: clampText(page.sceneKey, 80),
    imageHash: clampText(page.imageHash, 80),
    ...(page.imageDataUrl ? { imageDataUrl: String(page.imageDataUrl) } : {}),
    ...(page.imageDriveUrl ? { imageDriveUrl: String(page.imageDriveUrl) } : {}),
    ...(page.imageFileId ? { imageFileId: String(page.imageFileId) } : {}),
    ...(page.imageUrl ? { imageUrl: String(page.imageUrl) } : {}),
    gameOver: Boolean(page.gameOver),
  };
}
function sanitizeSavedPage(page = {}) {
  return {
    pageNumber: Number(page.pageNumber || 1),
    title: clampText(page.title, 60),
    bodyText: clampText(page.bodyText, 180),
    storySoFar: clampText(page.storySoFar, 300),
    sceneKey: clampText(page.sceneKey, 80),
    imageHash: clampText(page.imageHash, 80),
    imageUrl: clampText(page.imageUrl, 220),
    gameOver: Boolean(page.gameOver),
    changeLabels: normalizeChangeLabels(page.changeLabels),
  };
}
function imageGenerationPlaceholder() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768"><rect width="768" height="768" fill="#f3e4bf"/><circle cx="384" cy="350" r="120" fill="#d8b36a" opacity=".55"/><path d="M180 560 Q384 450 588 560" fill="none" stroke="#8d6a33" stroke-width="18" stroke-linecap="round"/></svg>`;
  const base64 = Buffer.from(svg).toString("base64");
  return { dataUrl: `data:image/svg+xml;base64,${base64}`, mimeType: "image/svg+xml", referenceMode: "placeholder" };
}
async function generateTextJson(genAI, parts, timeoutMs = TEXT_TIMEOUT_MS) {
  if (!genAI) { const error = new Error("text_generation_unavailable"); error.statusCode = 503; throw error; }
  let lastError = null;
  for (const modelName of TEXT_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await withTimeout(model.generateContent(parts), timeoutMs, "text_generation");
      return jsonFromText(result.response.text());
    } catch (error) {
      lastError = error;
      console.warn("[8-15] text model failed", { modelName, error: errorMessage(error) });
    }
  }
  const error = new Error(`text_generation_unavailable: ${errorMessage(lastError)}`);
  error.statusCode = 503;
  throw error;
}
function imageParts(prompt, originalMimeType, originalBase64, compositeMimeType, compositeBase64) {
  const parts = [{ text: prompt }];
  if (originalBase64) parts.push({ inlineData: { mimeType: originalMimeType || "image/jpeg", data: originalBase64 } });
  if (compositeBase64) parts.push({ inlineData: { mimeType: compositeMimeType || "image/jpeg", data: compositeBase64 } });
  return parts;
}
async function labelAndMatchBranch(genAI, { currentPage, originalMimeType, originalBase64, compositeMimeType, compositeBase64, candidates }) {
  const prompt = `1→2枚目の変化を抽出し、これと同様の変化ラベルを1つ下記から選べ。

候補: ${JSON.stringify(candidates.map((c) => ({ cacheId: c.cacheId, changeLabels: c.changeLabels })))}

同じ場面で、意味がほぼ同じ変化だけmatched=true。
画像を注視し、既出か未出かは慎重に判断すること。
出力するchangeLabelsは絵本世界の出来事として書く。
「落書き」「描いた」等のメタ語は使わない。絵として評価

既出なら: {"matched":true,"cacheId":"xxx","changeLabels":["候補側のラベル"]}
未出なら: {"matched":false,"cacheId":"","changeLabels":["1→2枚目の短い変化ラベル"]}

返答はコメントなしのJSONのみ。`;
  const raw = await generateTextJson(genAI, imageParts(prompt, originalMimeType, originalBase64, compositeMimeType, compositeBase64), VISION_TIMEOUT_MS);
  const matched = raw?.matched === true;
  const cacheId = clampText(raw?.cacheId, 100);
  if (typeof raw?.matched !== "boolean") throw new Error("invalid_label_match_matched");
  if (matched) {
    if (!cacheId) throw new Error("invalid_label_match_cacheId");
    const cache = candidates.find((item) => item.cacheId === cacheId);
    if (!cache) throw new Error("matched_cache_not_found");
    return { matched: true, cacheId, changeLabels: normalizeChangeLabels(cache.changeLabels), cache };
  }
  const changeLabels = normalizeChangeLabels(raw?.changeLabels);
  if (!changeLabels.length) throw new Error("invalid_label_match_empty_labels");
  return { matched: false, cacheId: "", changeLabels, cache: null };
}
async function generateNormalStory(genAI, { currentPage, nextPageNumber, changeLabels, originalMimeType, originalBase64, compositeMimeType, compositeBase64 }) {
  const prompt = `1→2枚目の変化と変化ラベルを元に、次ページの物語を生成。
目的は、俺と少女が救われない運命を避けること。カゲロウデイズのようなイメージです。

この場面の説明を続けず、一難去ってまた一難にする。
奇想天外で突拍子もない展開にすること。
必ず少女か俺に具体的な危機を発生させること。
危機には、具体物を2つ以上描写し、何が危機なのかを明言する

titleは必ず「${nextPageNumber}ページ目: ○○」にする。
bodyTextは100字程度。
storySoFarは300字以下。

現在の本文: ${currentPage.bodyText}

これまでのあらすじ: ${currentPage.storySoFar}

変化ラベル: ${JSON.stringify(changeLabels)}

返答はJSONのみ: {
  "title":"",
  "bodyText":"",
  "storySoFar":""
}`;
  const raw = await generateTextJson(genAI, imageParts(prompt, originalMimeType, originalBase64, compositeMimeType, compositeBase64));
  return normalizePage(raw, nextPageNumber);
}
async function generateBadEndStory(genAI, { currentPage, nextPageNumber, changeLabels, originalMimeType, originalBase64, compositeMimeType, compositeBase64 }) {
  const prompt = `1→2枚目の変化を主軸に、カゲロウデイズのようなバッドエンドストーリーを生成。
必ず1→2枚目の変化を主軸にすること。

titleは必ず「${nextPageNumber}ページ目: ○○」にする。
bodyTextは100字程度。

現在の本文: ${currentPage.bodyText}

これまでのあらすじ: ${currentPage.storySoFar}

変化ラベル: ${JSON.stringify(changeLabels)}

返答はJSONのみ: {
  "title":"",
  "bodyText":""
}`;
  const raw = await generateTextJson(genAI, imageParts(prompt, originalMimeType, originalBase64, compositeMimeType, compositeBase64));
  const bodyText = clampText(raw?.bodyText, 160) || "逃げ道を見失い、俺たちはそこで終わった。";
  return normalizePage({ title: raw?.title, bodyText, storySoFar: clampText(`${currentPage.storySoFar} ${bodyText}`, 300), gameOver: true }, nextPageNumber);
}
async function generateImageWithModel(modelName, prompt, references = []) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("image_generation_timeout")), IMAGE_TIMEOUT_MS);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const parts = [{ text: prompt }, ...references.map((ref) => ({ inlineData: { mimeType: ref.mimeType || "image/jpeg", data: ref.base64 } }))];
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }) });
    const json = await res.json().catch(() => ({}));
    const imagePart = (json?.candidates?.[0]?.content?.parts || []).find((part) => part.inlineData?.data);
    if (!res.ok || !imagePart) throw new Error(json?.error?.message || "image_not_returned");
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const base64 = imagePart.inlineData.data || "";
    return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
  } finally {
    clearTimeout(timeoutId);
  }
}
async function generatePageImage(page, { originalMimeType, originalBase64, compositeMimeType, compositeBase64 }) {
  const prompt = `本文を元に、挿絵を生成。
添付画像の画風、キャラ等を参考にしつつ、背景、構図、ポーズ、状況等は本文に合わせて適切に変更。
これは次のページの新しい挿絵であり、前ページの微修正ではない。
画像内に文字、数字、看板、吹き出し、ラベルは入れない。

本文:${page.bodyText}
これまでのあらすじ:${page.storySoFar}`;
  if (!GEMINI_API_KEY) return imageGenerationPlaceholder();
  const modes = [
    { referenceMode: "original+composite", refs: [{ mimeType: originalMimeType, base64: originalBase64 }, { mimeType: compositeMimeType, base64: compositeBase64 }].filter((r) => r.base64) },
    { referenceMode: "composite", refs: compositeBase64 ? [{ mimeType: compositeMimeType, base64: compositeBase64 }] : [] },
    { referenceMode: "original", refs: originalBase64 ? [{ mimeType: originalMimeType, base64: originalBase64 }] : [] },
    { referenceMode: "text-only", refs: [] },
  ];
  for (const mode of modes) {
    if (mode.referenceMode !== "text-only" && !mode.refs.length) continue;
    for (const modelName of IMAGE_MODEL_CANDIDATES) {
      try {
        const image = await generateImageWithModel(modelName, prompt, mode.refs);
        return { ...image, referenceMode: mode.referenceMode };
      } catch (error) {
        console.warn("[8-15] image model failed", { modelName, referenceMode: mode.referenceMode, error: errorMessage(error) });
      }
    }
  }
  return imageGenerationPlaceholder();
}
async function attachGeneratedImage(page, refs = {}) {
  const image = await generatePageImage(page, refs);
  const imageHash = sha256(dataUrlToBase64(image.dataUrl));
  FALLBACK_IMAGES.set(imageHash, image.dataUrl);
  const nextPage = { ...page, imageDataUrl: image.dataUrl, imageHash };
  console.log("[8-15] image generated", { pageNumber: page.pageNumber, imageHash: imageHash.slice(0, 12), referenceMode: image.referenceMode });
  try {
    const saved = await saveHundredOreImageLocally({
      imageDataUrl: image.dataUrl,
      imageHash,
      pageNumber: page.pageNumber,
      title: page.title,
      runId: refs.runId,
      cacheId: refs.cacheId,
      gameOver: page.gameOver,
    });
    if (saved?.imageUrl) {
      nextPage.imageUrl = saved.imageUrl;
      console.log("[8-15] local image saved", { pageNumber: page.pageNumber, imageHash: imageHash.slice(0, 12), imageUrl: saved.imageUrl });
    }
  } catch (error) {
    console.warn("[8-15] local image save failed", { pageNumber: page.pageNumber, imageHash: imageHash.slice(0, 12), error: errorMessage(error) });
  }
  return nextPage;
}
function serializeRun(run) { return { ...run, pages: Array.isArray(run.pages) ? run.pages : [] }; }
function dedupeRankings(runs = []) {
  const byRunId = new Map();
  runs.forEach((run) => {
    const runId = String(run?.runId || "").trim();
    if (!runId) return;
    const existing = byRunId.get(runId);
    if (!existing) { byRunId.set(runId, run); return; }
    const existingSheet = existing.recordType === "run";
    const incomingSheet = run.recordType === "run";
    if (incomingSheet && !existingSheet) { byRunId.set(runId, run); return; }
    if (incomingSheet === existingSheet && String(run.endedAt || "").localeCompare(String(existing.endedAt || "")) > 0) byRunId.set(runId, run);
  });
  return [...byRunId.values()];
}

export function mountHundredOreRoutes(app) {
  console.log("[8-15] started", { cacheSheet: "100俺_cache", runsSheet: "100俺_runs", version: VERSION });
  const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

  app.get(`${HUNDRED_ORE_PUBLIC_PATH}/generated/:hash`, (req, res) => {
    const dataUrl = FALLBACK_IMAGES.get(String(req.params.hash || ""));
    if (!dataUrl) return res.status(404).send("not found");
    const { mimeType, base64 } = parseDataUrl(dataUrl);
    res.type(mimeType).send(Buffer.from(base64, "base64"));
  });

  app.post("/api/100ore/start", async (req, res) => {
    try {
      const page = await buildInitialPage();
      const runId = `ore_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
      return res.json({ runId, page });
    } catch (error) {
      return res.status(500).json({ error: "start_failed", detail: errorMessage(error) });
    }
  });

  app.post("/api/100ore/rewrite", async (req, res) => {
    try {
      const currentPage = normalizePage(req.body?.currentPage || {}, Number(req.body?.currentPage?.pageNumber || req.body?.pageNumber || 1));
      if (!currentPage.sceneKey) return res.status(400).json({ error: "invalid_current_page" });
      const nextPageNumber = currentPage.pageNumber + 1;
      const { mimeType: originalMimeType, base64: originalBase64 } = parseDataUrl(req.body?.originalImageDataUrl);
      const { mimeType: compositeMimeType, base64: compositeBase64 } = parseDataUrl(req.body?.compositeImageDataUrl);
      if (!originalBase64 || !compositeBase64) return res.status(400).json({ error: "images_required" });
      const sheetCandidates = await listHundredOreCacheBySceneKey(currentPage.sceneKey).catch((error) => { console.warn("[8-15] cache load fallback", { error: errorMessage(error) }); return []; });
      const memoryCandidates = MEMORY_CACHES.filter((cache) => cache.sourceSceneKey === currentPage.sceneKey);
      const candidates = [...sheetCandidates, ...memoryCandidates];
      const match = await labelAndMatchBranch(genAI, { currentPage, originalMimeType, originalBase64, compositeMimeType, compositeBase64, candidates });
      console.log("[8-15] label/match", { sourceSceneKey: currentPage.sceneKey, sourcePageNumber: currentPage.pageNumber, matched: match.matched, cacheId: match.cacheId, changeLabels: match.changeLabels });

      let page;
      let cacheId = match.cacheId;
      let cacheHit = match.matched;
      if (cacheHit) {
        const cached = match.cache;
        page = normalizePage({
          pageNumber: Number(cached.resultPageNumber || nextPageNumber),
          title: cached.resultTitle,
          bodyText: cached.resultBodyText,
          storySoFar: cached.resultStorySoFar,
          sceneKey: cached.resultSceneKey,
          imageHash: cached.resultImageHash,
          imageUrl: cached.resultImageUrl,
          imageFileId: cached.resultImageFileId,
          imageDriveUrl: cached.resultImageDriveUrl,
          gameOver: cached.gameOver,
        }, Number(cached.resultPageNumber || nextPageNumber));
      } else {
        const gameOver = Math.random() < BAD_END_RATE;
        page = gameOver
          ? await generateBadEndStory(genAI, { currentPage, nextPageNumber, changeLabels: match.changeLabels, originalMimeType, originalBase64, compositeMimeType, compositeBase64 })
          : await generateNormalStory(genAI, { currentPage, nextPageNumber, changeLabels: match.changeLabels, originalMimeType, originalBase64, compositeMimeType, compositeBase64 });
        page.gameOver = gameOver;
        page.sceneKey = buildResultSceneKey(currentPage.sceneKey, match.changeLabels, page.title, page.storySoFar);
        console.log("[8-15] story generated", { pageNumber: page.pageNumber, title: page.title, gameOver: page.gameOver, storySoFarLength: page.storySoFar.length });
      }

      if (!cacheHit) cacheId = `cache_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

      if (!cacheHit || !page.imageUrl) {
        if (cacheHit) console.warn("[8-15] cache image missing; regenerating image", { cacheId, resultSceneKey: page.sceneKey, resultImageHash: page.imageHash });
        page = await attachGeneratedImage(page, { originalMimeType, originalBase64, compositeMimeType, compositeBase64, runId: clampText(req.body?.runId, 80), cacheId });
      } else {
        console.log("[8-15] cache image reused", { cacheId, pageNumber: page.pageNumber, imageHash: String(page.imageHash || "").slice(0, 12), imageUrl: page.imageUrl });
      }

      if (!cacheHit) {
        const cache = {
          cacheId,
          sourceSceneKey: currentPage.sceneKey,
          sourcePageNumber: currentPage.pageNumber,
          sourceTitle: currentPage.title,
          sourceImageHash: currentPage.imageHash,
          sourceImageHint: currentPage.pageNumber === 1 ? INITIAL_IMAGE_FILE : `generated:${String(currentPage.imageHash || "").slice(0, 12)}`,
          changeLabels: match.changeLabels,
          changeLabelsText: match.changeLabels.join(" / "),
          resultSceneKey: page.sceneKey,
          resultPageNumber: page.pageNumber,
          resultTitle: page.title,
          resultBodyText: page.bodyText,
          resultStorySoFar: page.storySoFar,
          gameOver: page.gameOver,
          resultImageHash: page.imageHash,
          resultImageUrl: page.imageUrl,
          createdAt: new Date().toISOString(),
        };
        MEMORY_CACHES.unshift(cache); MEMORY_CACHES.splice(200);
        await appendHundredOreCache(cache).catch((error) => console.warn("[8-15] branch save fallback", { error: errorMessage(error) }));
        console.log("[8-15] branch saved", { cacheId, sourceSceneKey: cache.sourceSceneKey, sourcePageNumber: cache.sourcePageNumber, changeLabels: cache.changeLabels, resultSceneKey: cache.resultSceneKey, resultPageNumber: cache.resultPageNumber, gameOver: cache.gameOver });
      }

      return res.json({ page, changeLabels: match.changeLabels, cacheHit, cacheId });
    } catch (error) {
      console.error("[8-15] rewrite error", error);
      if (error?.statusCode === 503) return res.status(503).json({ error: "ai_busy", detail: "AIが混雑しています。もう一度試してください" });
      return res.status(500).json({ error: "rewrite_failed", detail: errorMessage(error) });
    }
  });

  app.post("/api/100ore/runs", async (req, res) => {
    const rawPages = Array.isArray(req.body?.pages) ? req.body.pages : [];
    const pages = rawPages.slice(0, 365).map(sanitizeSavedPage);
    const score = Math.max(1, Math.floor(Number(req.body?.score || pages.length || 1)));
    const finalPage = pages[pages.length - 1] || {};
    const run = {
      runId: clampText(req.body?.runId || `ore_${Date.now()}`, 80),
      username: clampText(req.body?.username || "名無しの俺", 40),
      userTrackingId: clampText(req.body?.userTrackingId || "", 120),
      startedAt: clampText(req.body?.startedAt || "", 40),
      endedAt: clampText(req.body?.endedAt || new Date().toISOString(), 40),
      score,
      gameOver: Boolean(req.body?.gameOver ?? finalPage.gameOver),
      finalTitle: clampText(req.body?.finalTitle || finalPage.title, 80),
      finalBodyText: clampText(req.body?.finalBodyText || finalPage.bodyText, 180),
      pages,
      meta: { version: VERSION, pageCount: pages.length },
    };
    try { await appendHundredOreRun(run); } catch (error) { console.warn("[8-15] sheets save fallback", { error: errorMessage(error) }); }
    MEMORY_RUNS.unshift(run); MEMORY_RUNS.splice(100);
    return res.json({ ok: true, runId: run.runId });
  });

  app.get("/api/100ore/rankings", async (_req, res) => {
    try {
      const rankings = await listHundredOreRankings({ limit: 30 });
      const merged = dedupeRankings([...rankings, ...MEMORY_RUNS]).sort((a, b) => Number(b.score) - Number(a.score) || String(b.endedAt).localeCompare(String(a.endedAt))).slice(0, 30);
      return res.json({ rankings: merged.map((r) => ({ runId: r.runId, username: r.username, score: r.score, endedAt: r.endedAt, finalTitle: r.finalTitle, finalBodyText: r.finalBodyText })) });
    } catch {
      const rankings = dedupeRankings(MEMORY_RUNS).sort((a, b) => Number(b.score) - Number(a.score) || String(b.endedAt).localeCompare(String(a.endedAt))).slice(0, 30);
      return res.json({ rankings });
    }
  });

  app.get("/api/100ore/runs/:runId", async (req, res) => {
    const runId = String(req.params.runId || "");
    try {
      const run = await getHundredOreRunById(runId);
      if (run) return res.json({ run: serializeRun(run) });
    } catch (error) { console.warn("[8-15] sheets get fallback", { error: errorMessage(error) }); }
    const run = MEMORY_RUNS.find((item) => item.runId === runId);
    if (!run) return res.status(404).json({ error: "run_not_found" });
    return res.json({ run: serializeRun(run) });
  });
}
