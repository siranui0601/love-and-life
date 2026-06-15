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
const PROGRESS_DIR = path.join(process.cwd(), "data/8-15-progress");
const JOB_INPUT_DIR = path.join(process.cwd(), "data/8-15-jobs");


const INITIAL_PAGE_TEXT = {
  pageNumber: 1,
  title: "1ページ目: 猫を追う少女",
  bodyText: `気がつくと、俺は真夏の公園に立っていた。記憶は曖昧なのに、ベンチの向こうで黒猫を追う少女だけは知っている気がする。守らなきゃ。そう思った瞬間、猫が柵を抜けて外へ逃げ、少女も追いかけて走り出した。時計は12時40分を指していた。`,
  storySoFar: `俺は理由も分からず真夏の公園に立っている。黒猫を追う少女を見て、強く守りたいと感じた。猫は柵の隙間から公園の外へ逃げ、少女も追い始めた。時計は12時40分。`,
  imageUrl: INITIAL_IMAGE_URL,
  gameOver: false,
};


function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(String(text || "")); } catch { return fallback; }
}
async function ensureProgressDir() {
  await fs.mkdir(PROGRESS_DIR, { recursive: true });
  await fs.mkdir(JOB_INPUT_DIR, { recursive: true });
}
function progressKey(userTrackingId) { return sha256(String(userTrackingId || "")).slice(0, 40); }
function progressPathForUser(userTrackingId) {
  const key = progressKey(userTrackingId);
  if (!key) return "";
  return path.join(PROGRESS_DIR, `${key}.json`);
}
async function readUserProgress(userTrackingId) {
  if (!userTrackingId) return null;
  const filePath = progressPathForUser(userTrackingId);
  const parsed = safeJsonParse(await fs.readFile(filePath, "utf8").catch(() => ""), null);
  return parsed && parsed.userTrackingId ? parsed : null;
}
function sanitizeProgressPage(page = {}) { return sanitizeSavedPage(page); }
function sanitizeProgressStock(stock = []) {
  return (Array.isArray(stock) ? stock : []).slice(0, 12).map((item) => {
    const w = Number(item?.w || 0);
    const h = Number(item?.h || 0);
    const power = Number.isFinite(Number(item?.power))
      ? Math.round(Number(item.power))
      : Math.round(w * h * 1000);

    return {
      id: clampText(item?.id, 80),
      shape: clampText(item?.shape, 30),
      label: clampText(item?.label, 80),
      w,
      h,
      power,
    };
  }).filter((item) => item.id || item.shape || item.label);
}
function sanitizeProgressPages(pages = []) {
  const seen = new Set();
  return (Array.isArray(pages) ? pages : []).map(sanitizeProgressPage).filter((page) => {
    const key = String(page.pageNumber || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 365);
}
function sanitizePendingTransition(pending = null) {
  if (!pending || typeof pending !== "object") return null;
  return {
    transitionId: clampText(pending.transitionId, 120),
    cacheId: clampText(pending.cacheId, 120),
    status: clampText(pending.status, 40),
    sourcePageNumber: Number(pending.sourcePageNumber || 0),
    sourceSceneKey: clampText(pending.sourceSceneKey, 80),
    currentPage: pending.currentPage ? sanitizeProgressPage(pending.currentPage) : {},
    changeLabels: normalizeChangeLabels(pending.changeLabels),
    nextPage: pending.nextPage ? sanitizeProgressPage(pending.nextPage) : null,
    referenceCompositeImagePath: clampText(pending.referenceCompositeImagePath, 260),
    originalImagePath: clampText(pending.originalImagePath, 260),
    labelCompositeImagePath: clampText(pending.labelCompositeImagePath, 260),
    error: clampText(pending.error, 220),
    createdAt: clampText(pending.createdAt, 40),
    updatedAt: clampText(pending.updatedAt, 40),
  };
}
async function writeUserProgress(progress) {
  if (!progress?.userTrackingId) return null;
  await ensureProgressDir();
  const now = new Date().toISOString();
  const clean = {
    userTrackingId: clampText(progress.userTrackingId, 160),
    username: clampText(progress.username, 40),
    runId: clampText(progress.runId, 100),
    status: clampText(progress.status || "active", 40),
    pageNumber: Number(progress.pageNumber || progress.currentPage?.pageNumber || 1),
    currentPage: sanitizeProgressPage(progress.currentPage || {}),
    pages: sanitizeProgressPages(progress.pages || []),
    stock: sanitizeProgressStock(progress.stock || []),
    gameOver: Boolean(progress.gameOver),
    pendingTransition: sanitizePendingTransition(progress.pendingTransition),
    updatedAt: clampText(progress.updatedAt || now, 40),
  };
  const filePath = progressPathForUser(clean.userTrackingId);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(clean, null, 2));
  await fs.rename(tmpPath, filePath);
  return clean;
}
async function clearUserProgress(userTrackingId) {
  if (!userTrackingId) return;
  await fs.rm(progressPathForUser(userTrackingId), { force: true }).catch(() => {});
}
function safeTransitionId(value) { return sanitizeFilePart(value || `trans_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`, 100); }

async function cleanupJobInputs(transitionId) {
  const safeId = safeTransitionId(transitionId);
  if (!safeId) return;
  const dir = path.join(JOB_INPUT_DIR, safeId);
  const resolved = path.resolve(dir);
  const root = path.resolve(JOB_INPUT_DIR);
  if (!resolved.startsWith(root)) return;
  await fs.rm(resolved, { recursive: true, force: true }).catch((error) => {
    console.warn("[8-15] job cleanup failed", { transitionId: safeId, error: errorMessage(error) });
  });
}
async function saveJobDataUrl({ transitionId, name, dataUrl }) {
  await ensureProgressDir();
  const dir = path.join(JOB_INPUT_DIR, safeTransitionId(transitionId));
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${sanitizeFilePart(name, 40)}.dataurl`);
  await fs.writeFile(filePath, String(dataUrl || ""));
  return filePath;
}
async function readJobDataUrl(filePath) {
  if (!filePath) return "";
  const resolved = path.resolve(String(filePath));
  if (!resolved.startsWith(path.resolve(JOB_INPUT_DIR))) return "";
  return fs.readFile(resolved, "utf8").catch(() => "");
}
function mergePagesWith(pageList, page) {
  const pages = sanitizeProgressPages(pageList);
  const saved = sanitizeProgressPage(page);
  const index = pages.findIndex((item) => Number(item.pageNumber) === Number(saved.pageNumber));
  if (index >= 0) pages[index] = saved;
  else pages.push(saved);
  return pages;
}

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
  const prompt = `1枚目は全体図。そこに2枚目のような変化が起きた。これと同様の変化ラベルを1つ下記から選べ。

候補: ${JSON.stringify(candidates.map((c) => ({ cacheId: c.cacheId, changeLabels: c.changeLabels })))}

意味がほぼ同じ変化だけmatched=true。
画像を注視し、既出か否かは慎重に判断すること。
出力するchangeLabelsは絵本世界の出来事として書く。
「落書き」「描いた」等のメタ語は使わない。絵として評価

既出なら: {"matched":true,"cacheId":"xxx","changeLabels":["候補側のラベル"]}
未出なら: {"matched":false,"cacheId":"","changeLabels":["猫に首輪,手紙が燃える　等の短い変化ラベル"]}

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
async function generateNormalStory(genAI, { currentPage, nextPageNumber, changeLabels }) {
  const prompt = `本文,あらすじ,変化ラベルを元に、次ページの物語を生成。
目的は、俺と少女が救われない運命を避けること。カゲロウデイズのようなイメージ。

この場面の説明を続けず、一難去ってまた一難にする。積極的に場面転換をすること
奇想天外で突拍子もない展開にすること。
必ず少女か俺に具体的な危機を発生させること
危機には、具体物を2つ以上描写し、何が危機なのかを明言する

現在の本文: ${currentPage.bodyText}

これまでのあらすじ: ${currentPage.storySoFar}

変化ラベル: ${JSON.stringify(changeLabels)}

返答はJSONのみ: {
  "title":"短いタイトル",
  "bodyText":"100字程度",
  "storySoFar":"300字以下"
}`;
  const raw = await generateTextJson(genAI, [{ text: prompt }], TEXT_TIMEOUT_MS);
  return normalizePage(raw, nextPageNumber);
}
async function generateBadEndStory(genAI, { currentPage, nextPageNumber, changeLabels }) {
  const prompt = `**変化ラベル(!IMPORTANT)**を主軸に、カゲロウデイズのようなバッドエンドストーリーを生成。

現在の本文: ${currentPage.bodyText}

これまでのあらすじ: ${currentPage.storySoFar}

変化ラベル: ${JSON.stringify(changeLabels)}

返答はJSONのみ: {
  "title":"短いタイトル",
  "bodyText":"100字程度"
}`;
  const raw = await generateTextJson(genAI, [{ text: prompt }], TEXT_TIMEOUT_MS);
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
これは次のページの新しい挿絵であり、前ページの微修正ではない。積極的に場面転換を行うこと
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
      const username = clampText(req.body?.username || "旅人", 40);
      const userTrackingId = clampText(req.body?.userTrackingId || "", 160);
      if (userTrackingId) {
        const progress = await readUserProgress(userTrackingId);
        if (progress && progress.currentPage?.pageNumber) {
          return res.json({ resumed: true, progress });
        }
      }
      const page = await buildInitialPage();
      const runId = `ore_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
      if (userTrackingId) {
        await writeUserProgress({
          userTrackingId, username, runId, status: "active", pageNumber: 1, currentPage: page,
          pages: [page], stock: sanitizeProgressStock(req.body?.stock || []), gameOver: false,
          pendingTransition: null, updatedAt: new Date().toISOString(),
        });
      }
      return res.json({ resumed: false, runId, page });
    } catch (error) {
      return res.status(500).json({ error: "start_failed", detail: errorMessage(error) });
    }
  });

  app.post("/api/100ore/progress", async (req, res) => {
    const userTrackingId = clampText(req.body?.userTrackingId || "", 160);
    if (!userTrackingId) return res.json({ progress: null });
    return res.json({ progress: await readUserProgress(userTrackingId) });
  });

  app.post("/api/100ore/progress/clear", async (req, res) => {
    try {
      const userTrackingId = clampText(req.body?.userTrackingId || "", 160);
      if (!userTrackingId) return res.json({ ok: true, cleared: false });
      await clearUserProgress(userTrackingId);
      return res.json({ ok: true, cleared: true });
    } catch (error) {
      console.warn("[8-15] progress clear failed", { error: errorMessage(error) });
      return res.status(500).json({ error: "progress_clear_failed", detail: errorMessage(error) });
    }
  });

  app.post("/api/100ore/rewrite", async (req, res) => {
    try {
      const username = clampText(req.body?.username || "旅人", 40);
      const userTrackingId = clampText(req.body?.userTrackingId || "", 160);
      const runId = clampText(req.body?.runId || "", 100);
      const transitionId = safeTransitionId(req.body?.transitionId);
      const currentPage = normalizePage(req.body?.currentPage || {}, Number(req.body?.currentPage?.pageNumber || req.body?.pageNumber || 1));
      if (!currentPage.sceneKey) return res.status(400).json({ error: "invalid_current_page" });
      const nextPageNumber = currentPage.pageNumber + 1;
      const currentStock = sanitizeProgressStock(req.body?.stock || []);
      const nextStock = sanitizeProgressStock(req.body?.nextStock || req.body?.stock || []);
      const { mimeType: originalMimeType, base64: originalBase64 } =
  parseDataUrl(req.body?.originalImageDataUrl);

const { mimeType: labelCompositeMimeType, base64: labelCompositeBase64 } =
  parseDataUrl(req.body?.labelCompositeImageDataUrl || req.body?.compositeImageDataUrl);

const { mimeType: referenceCompositeMimeType, base64: referenceCompositeBase64 } =
  parseDataUrl(req.body?.referenceCompositeImageDataUrl || req.body?.compositeImageDataUrl);

if (!originalBase64 || !labelCompositeBase64 || !referenceCompositeBase64) {
  return res.status(400).json({ error: "images_required" });
}

console.log("[8-15] rewrite image inputs", {
  originalBase64Length: originalBase64.length,
  labelCompositeBase64Length: labelCompositeBase64.length,
  referenceCompositeBase64Length: referenceCompositeBase64.length,
});

      let previousPending = null;
      if (userTrackingId) {
        const [originalImagePath, labelCompositeImagePath, referenceCompositeImagePath] = await Promise.all([
          saveJobDataUrl({ transitionId, name: "original", dataUrl: req.body?.originalImageDataUrl }),
          saveJobDataUrl({ transitionId, name: "label", dataUrl: req.body?.labelCompositeImageDataUrl || req.body?.compositeImageDataUrl }),
          saveJobDataUrl({ transitionId, name: "reference", dataUrl: req.body?.referenceCompositeImageDataUrl || req.body?.compositeImageDataUrl }),
        ]);
        previousPending = {
          transitionId, cacheId: "", status: "processing", sourcePageNumber: currentPage.pageNumber,
          sourceSceneKey: currentPage.sceneKey, currentPage, changeLabels: [], nextPage: null,
          originalImagePath, labelCompositeImagePath, referenceCompositeImagePath,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        await writeUserProgress({
          userTrackingId, username, runId, status: "processing", pageNumber: currentPage.pageNumber,
          currentPage, pages: sanitizeProgressPages(req.body?.pages || [currentPage]),
          stock: currentStock, gameOver: false,
          pendingTransition: previousPending, updatedAt: new Date().toISOString(),
        });
      }

      const sheetCandidates = await listHundredOreCacheBySceneKey(currentPage.sceneKey).catch((error) => { console.warn("[8-15] cache load fallback", { error: errorMessage(error) }); return []; });
      const memoryCandidates = MEMORY_CACHES.filter((cache) => cache.sourceSceneKey === currentPage.sceneKey);
      const candidates = [...sheetCandidates, ...memoryCandidates];
      const match = await labelAndMatchBranch(genAI, {
  currentPage,
  originalMimeType,
  originalBase64,
  compositeMimeType: labelCompositeMimeType,
  compositeBase64: labelCompositeBase64,
  candidates,
});
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
  ? await generateBadEndStory(genAI, {
      currentPage,
      nextPageNumber,
      changeLabels: match.changeLabels,
    })
  : await generateNormalStory(genAI, {
      currentPage,
      nextPageNumber,
      changeLabels: match.changeLabels,
    });
        page.gameOver = gameOver;
        page.sceneKey = buildResultSceneKey(currentPage.sceneKey, match.changeLabels, page.title, page.storySoFar);
        console.log("[8-15] story generated", { pageNumber: page.pageNumber, title: page.title, gameOver: page.gameOver, storySoFarLength: page.storySoFar.length });
      }

      if (!cacheHit) cacheId = `cache_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

      const nextPageForProgress = { ...page, changeLabels: match.changeLabels, ...(cacheHit ? {} : { imageLoading: true }) };
      const nextPages = mergePagesWith(req.body?.pages || [currentPage], nextPageForProgress);
      if (cacheHit) {
        if (userTrackingId) {
          await writeUserProgress({
            userTrackingId, username, runId, status: page.gameOver ? "gameOver" : "active",
            pageNumber: page.pageNumber, currentPage: nextPageForProgress, pages: nextPages,
            stock: nextStock, gameOver: Boolean(page.gameOver),
            pendingTransition: null, updatedAt: new Date().toISOString(),
          });
        }
        console.log("[8-15] cache image reused", { cacheId, pageNumber: page.pageNumber, imageHash: String(page.imageHash || "").slice(0, 12), imageUrl: page.imageUrl });
        await cleanupJobInputs(transitionId);
        return res.json({ page, changeLabels: match.changeLabels, cacheHit: true, cacheId, imagePending: false, nextStock });
      }

      if (userTrackingId) {
        await writeUserProgress({
          userTrackingId, username, runId, status: "story_done", pageNumber: page.pageNumber,
          currentPage: nextPageForProgress, pages: nextPages, stock: nextStock,
          gameOver: Boolean(page.gameOver),
          pendingTransition: { ...previousPending, cacheId, status: "story_done", changeLabels: match.changeLabels, nextPage: nextPageForProgress, updatedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString(),
        });
      }

      return res.json({ page, changeLabels: match.changeLabels, cacheHit: false, cacheId, imagePending: true, transitionId, nextStock });
    } catch (error) {
      const userTrackingId = clampText(req.body?.userTrackingId || "", 160);
      if (userTrackingId) {
        const progress = await readUserProgress(userTrackingId).catch(() => null);
        await writeUserProgress({
          ...(progress || {}), userTrackingId, username: clampText(req.body?.username || progress?.username || "旅人", 40),
          runId: clampText(req.body?.runId || progress?.runId || "", 100), status: "failed",
          pendingTransition: { ...(progress?.pendingTransition || {}), status: "failed", error: errorMessage(error), updatedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      console.error("[8-15] rewrite error", error);
      if (error?.statusCode === 503) return res.status(503).json({ error: "ai_busy", detail: "AIが混雑しています。もう一度試してください" });
      return res.status(500).json({ error: "rewrite_failed", detail: errorMessage(error) });
    }
  });

  app.post("/api/100ore/page-image", async (req, res) => {
    try {
      const username = clampText(req.body?.username || "旅人", 40);
      const userTrackingId = clampText(req.body?.userTrackingId || "", 160);
      const runId = clampText(req.body?.runId || "", 100);
      const transitionId = clampText(req.body?.transitionId || "", 120);
      const progress = userTrackingId ? await readUserProgress(userTrackingId) : null;
      const currentPage = normalizePage(req.body?.currentPage || progress?.pendingTransition?.currentPage || {}, Number(req.body?.currentPage?.pageNumber || progress?.pendingTransition?.currentPage?.pageNumber || 1));
      const page = normalizePage(req.body?.page || progress?.pendingTransition?.nextPage || {}, Number(req.body?.page?.pageNumber || progress?.pendingTransition?.nextPage?.pageNumber || currentPage.pageNumber + 1));
      const cacheId = clampText(req.body?.cacheId || progress?.pendingTransition?.cacheId || `cache_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`, 120);
      const changeLabels = Array.isArray(req.body?.changeLabels) ? req.body.changeLabels.map((label) => clampText(label, 80)).filter(Boolean) : normalizeChangeLabels(progress?.pendingTransition?.changeLabels);
      const progressStock = sanitizeProgressStock(req.body?.stock || progress?.stock || []);
      let referenceDataUrl = req.body?.referenceCompositeImageDataUrl || req.body?.compositeImageDataUrl || "";
      if (!referenceDataUrl && progress?.pendingTransition?.referenceCompositeImagePath) {
        referenceDataUrl = await readJobDataUrl(progress.pendingTransition.referenceCompositeImagePath);
      }
      const { mimeType: compositeMimeType, base64: compositeBase64 } = parseDataUrl(referenceDataUrl);
      if (!currentPage.sceneKey || !page.sceneKey) return res.status(400).json({ error: "invalid_page" });
      if (!compositeBase64) return res.status(400).json({ error: "image_required" });

      if (userTrackingId) {
        await writeUserProgress({
          ...(progress || {}), userTrackingId, username, runId: runId || progress?.runId, status: "image_generating",
          pageNumber: page.pageNumber, currentPage: { ...page, imageLoading: true, changeLabels },
          pages: mergePagesWith(req.body?.pages || progress?.pages || [], { ...page, imageLoading: true, changeLabels }),
          stock: progressStock, gameOver: Boolean(page.gameOver),
          pendingTransition: { ...(progress?.pendingTransition || {}), transitionId: transitionId || progress?.pendingTransition?.transitionId, cacheId, status: "image_generating", currentPage, changeLabels, nextPage: { ...page, imageLoading: true, changeLabels }, updatedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString(),
        });
      }

      const pageWithImage = await attachGeneratedImage(page, {
        originalMimeType: "",
        originalBase64: "",
        compositeMimeType,
        compositeBase64,
        runId: clampText(req.body?.runId, 80),
        cacheId,
      });

      if (!MEMORY_CACHES.some((cache) => cache.cacheId === cacheId)) {
        const cache = {
          cacheId,
          sourceSceneKey: currentPage.sceneKey,
          sourcePageNumber: currentPage.pageNumber,
          sourceTitle: currentPage.title,
          sourceImageHash: currentPage.imageHash,
          sourceImageHint: currentPage.pageNumber === 1 ? INITIAL_IMAGE_FILE : `generated:${String(currentPage.imageHash || "").slice(0, 12)}`,
          changeLabels,
          changeLabelsText: changeLabels.join(" / "),
          resultSceneKey: pageWithImage.sceneKey,
          resultPageNumber: pageWithImage.pageNumber,
          resultTitle: pageWithImage.title,
          resultBodyText: pageWithImage.bodyText,
          resultStorySoFar: pageWithImage.storySoFar,
          gameOver: pageWithImage.gameOver,
          resultImageHash: pageWithImage.imageHash,
          resultImageUrl: pageWithImage.imageUrl,
          createdAt: new Date().toISOString(),
        };
        MEMORY_CACHES.unshift(cache); MEMORY_CACHES.splice(200);
        await appendHundredOreCache(cache).catch((error) => console.warn("[8-15] branch save fallback", { error: errorMessage(error) }));
        console.log("[8-15] branch saved", { cacheId, sourceSceneKey: cache.sourceSceneKey, sourcePageNumber: cache.sourcePageNumber, changeLabels: cache.changeLabels, resultSceneKey: cache.resultSceneKey, resultPageNumber: cache.resultPageNumber, gameOver: cache.gameOver });
      }

      if (userTrackingId) {
        await writeUserProgress({
          userTrackingId, username, runId: runId || progress?.runId, status: pageWithImage.gameOver ? "gameOver" : "active",
          pageNumber: pageWithImage.pageNumber, currentPage: { ...pageWithImage, changeLabels },
          pages: mergePagesWith(req.body?.pages || progress?.pages || [], { ...pageWithImage, changeLabels }),
          stock: progressStock, gameOver: Boolean(pageWithImage.gameOver),
          pendingTransition: null, updatedAt: new Date().toISOString(),
        });
      }

      await cleanupJobInputs(transitionId || progress?.pendingTransition?.transitionId);

      return res.json({ page: pageWithImage, cacheId });
    } catch (error) {
      const userTrackingId = clampText(req.body?.userTrackingId || "", 160);
      if (userTrackingId) {
        const progress = await readUserProgress(userTrackingId).catch(() => null);
        await writeUserProgress({
          ...(progress || {}), userTrackingId, username: clampText(req.body?.username || progress?.username || "旅人", 40),
          runId: clampText(req.body?.runId || progress?.runId || "", 100), status: "image_failed",
          pendingTransition: { ...(progress?.pendingTransition || {}), status: "image_failed", error: errorMessage(error), updatedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      console.error("[8-15] page-image error", error);
      if (error?.statusCode === 503) return res.status(503).json({ error: "ai_busy", detail: "AIが混雑しています。もう一度試してください" });
      return res.status(500).json({ error: "page_image_failed", detail: errorMessage(error) });
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
