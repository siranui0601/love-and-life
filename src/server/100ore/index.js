import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../../foundation/env.js";
import { appendHundredOreCache, appendHundredOreRun, getHundredOreRunById, listHundredOreCacheBySceneKey, listHundredOreRankings } from "../../foundation/sheets.js";

const HUNDRED_ORE_PUBLIC_PATH = "/100日後も生きる俺";
const HUNDRED_ORE_ENCODED_PATH = encodeURI(HUNDRED_ORE_PUBLIC_PATH);
const FALLBACK_IMAGES = new Map();
const MEMORY_RUNS = [];
const MEMORY_CACHES = [];
const INITIAL_IMAGE_FILE = "C4BBDE78-975C-45BC-8208-32BB45063795.png";
const INITIAL_IMAGE_PATH = path.join(process.cwd(), "public/2D素材", INITIAL_IMAGE_FILE);
const INITIAL_IMAGE_URL = `/2D画像/${INITIAL_IMAGE_FILE}`;
const OUTCOME_TYPES = new Set(["danger", "chance", "choice", "embarrassment", "mistake", "weird", "lucky", "other"]);
const TEXT_TIMEOUT_MS = 12000;
const IMAGE_TIMEOUT_MS = 30000;
const VISION_TIMEOUT_MS = 30000;
const TEXT_MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];
const IMAGE_MODEL_CANDIDATES = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image-preview",
];

const DISPLAY_FORBIDDEN_TERMS = [
  "落書き", "キャンパス", "プレイヤー", "ユーザー", "描いた", "書いた", "改変", "画像", "挿絵", "AI", "プロンプト", "画面", "差分", "生成", "追加された", "突然現れた", "急に出現した",
];
const CHANGE_LABEL_FORBIDDEN_TERMS = [...DISPLAY_FORBIDDEN_TERMS, "UI", "枠", "点線", "選択範囲"];

const DISPLAY_REPLACEMENTS = new Map([
  ["落書き", "しるし"], ["キャンパス", "場所"], ["プレイヤー", "俺"], ["ユーザー", "俺"], ["描いた", "起きた"], ["書いた", "起きた"],
  ["改変", "変化"], ["画像", "場面"], ["挿絵", "場面"], ["AI", ""], ["プロンプト", ""], ["画面", "場面"], ["差分", "変化"], ["生成", ""],
  ["追加された", "現れた"], ["突然現れた", "現れた"], ["急に出現した", "現れた"], ["正史", "出来事"], ["生まれつきあった", "あった"], ["昔からあった", "あった"],
]);

const INITIAL_PAGE = {
  day: 1,
  pageTitle: "1日目：路地裏で全部が同時に起きた",
  bodyText:
    `足元では紫色の召喚陣が回り続け、目の前では車が猛スピードで突っ込んできている。

しかも空からは少女が落下中だ。

路地裏の壁を突き破った巨大な魚は、なぜか車を狙っている。

何が起きているのか全く分からない。

ただ一つ分かるのは、このままだと誰かがひどい目に遭うということだけだった。`,
  sceneSummary:
    "寝間着姿の俺は、石畳の路地裏で紫色の召喚陣の上に立っている。目の前では車が突っ込み、空から少女が落ち、壁から巨大魚が飛び出して車を狙っている。",
  imagePrompt:
    "石畳の路地裏、寝間着姿の俺、足元で紫色の召喚陣が回る、猛スピードの車、空から落下する少女、壁を突き破った巨大魚が車を狙う、混乱した絵本風、紙の質感、文字なし",
  illustrationPrompt:
    "石畳の路地裏、寝間着姿の俺、足元で紫色の召喚陣が回る、猛スピードの車、空から落下する少女、壁を突き破った巨大魚が車を狙う、混乱した絵本風、紙の質感、文字なし",
  imageUrl: INITIAL_IMAGE_URL,
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
function sha256(input) { return crypto.createHash("sha256").update(String(input || "")).digest("hex"); }
function sha256Buffer(input) { return crypto.createHash("sha256").update(input).digest("hex"); }
function buildSceneKey(imageHash = "", sceneSummary = "") { return sha256(`${imageHash}${sceneSummary}`).slice(0, 16); }
function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
function normalizeBoolean(value) {
  if (value === true) return true;
  if (value === false || value === undefined || value === null) return false;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "1", "yes", "はい"].includes(value.trim().toLowerCase());
  return false;
}
function normalizeOutcomeType(value) {
  const type = String(value || "other").trim();
  return OUTCOME_TYPES.has(type) ? type : "other";
}
function clampText(value, max = 260) { return String(value || "").trim().slice(0, max); }
function scrubDisplayText(value, max = 260) {
  let text = clampText(value, max);
  for (const [term, replacement] of DISPLAY_REPLACEMENTS.entries()) text = text.split(term).join(replacement);
  return text.replace(/\s{2,}/g, " ").trim();
}
function normalizePage(page = {}, day = 1) {
  const normalized = {
    day,
    pageTitle: scrubDisplayText(page.pageTitle || `${day}日目`, 40),
    bodyText: scrubDisplayText(page.bodyText || "俺は余白の多いページに立っていた。", 180),
    sceneSummary: scrubDisplayText(page.sceneSummary || "絵本の世界で俺が次の出来事を待っている。", 240),
    illustrationPrompt: clampText(page.illustrationPrompt || page.imagePrompt || "奇妙な絵本の一場面、主人公の俺、余白のある画面", 900),
    imagePrompt: clampText(page.illustrationPrompt || page.imagePrompt || "奇妙な絵本の一場面、主人公の俺、余白のある場面", 900),
  };
  normalized.sceneKey = clampText(page.sceneKey || buildSceneKey(page.imageHash || "", normalized.sceneSummary), 40);
  return normalized;
}
function fallbackInitialPage(seed) {
  const roles = ["空飛ぶ郵便屋", "王様の使い", "森の迷子", "パン職人", "勇者見習い"];
  const role = roles[parseInt(sha256(seed).slice(0, 2), 16) % roles.length];
  return normalizePage({ pageTitle:"1日目：余白つきの朝", bodyText:`俺は${role}として、しゃべる月の下に立っていた。道の先では小さな王冠がくしゃみをしている。`, sceneSummary:`俺は${role}。しゃべる月とくしゃみする王冠がある道で、最初の介入を待っている。`, imagePrompt:`storybook illustration, Japanese weird fairy tale, a man as ${role}, talking moon, sneezing crown, warm paper, blank spaces` }, 1);
}
function fallbackOutcome(day, labelsText = "") {
  const types = ["danger","chance","choice","embarrassment","mistake","weird","lucky"];
  const type = types[day % types.length];
  const gameOver = day >= 4 && Math.random() < Math.min(.08 + day * .02, .35);
  const base = labelsText || "車の進路が石畳の溝へずれる";
  return { rewriteText:`${base}。俺の前の危機は形を変え、次の出口が開いた。`, outcomeSummary:`${base}ため、路地裏の危機が別の方向へ動いた。`, outcomeType:type, gameOver, gameOverReason:gameOver ? `${base}が裏目に出て、俺は逃げ場を失った。` : "", nextSceneHint: gameOver ? "" : `${base}結果、俺は別の場所へ押し出される。` };
}
function fallbackNextPage(day, { current = {}, outcome = {}, changeLabels = [] } = {}) {
  const carry = inferCarryoverElements(current);
  const location = carry.location || "次の曲がり角";
  const people = carry.people.join("、") || "俺";
  const objects = carry.objects.slice(0, 3).join("、") || "目の前の物";
  const changed = changeLabels.join("、") || outcome.outcomeSummary || outcome.rewriteText || "小さな変化";
  const trouble = outcome.nextSceneHint || `${changed}の結果、俺たちは${location}から次の足場へ押し出される。`;
  return normalizePage({
    pageTitle: `${day}日目：次の足場が光る`,
    bodyText: `${people}は${objects}を抱え、${changed}の勢いで${location}の先へ進んだ。${trouble} 足元では次に触れそうな金具と細い扉が光っている。`,
    sceneSummary: `${people}と${objects}は前ページの変化を受け、${location}から次の局面へ移る。足元に金具と細い扉がある。`,
    illustrationPrompt: buildContinuityIllustrationPrompt({ current, bodyText: `${people}が${objects}と次の足場へ進む。`, sceneSummary: `${people}、${objects}、${trouble}`, changeLabels, trouble }),
  }, day);
}
function svgDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 768"><defs><filter id="paper"><feTurbulence baseFrequency="0.018" numOctaves="4"/><feColorMatrix type="saturate" values="0.12"/><feBlend in="SourceGraphic" mode="multiply"/></filter><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff3d0"/><stop offset="1" stop-color="#ead2a0"/></linearGradient></defs><rect width="768" height="768" fill="url(#g)"/><g filter="url(#paper)" opacity=".72"><path d="M96 120c120-36 250-32 374 0 80 21 137 14 202-12v540c-78 31-152 30-232 6-111-34-228-37-344-3z" fill="#f8e8bf" stroke="#d5b779" stroke-width="8"/><path d="M132 188c154-22 296-18 502 8M132 278c168-20 320-12 502 8M132 368c160-18 316-15 502 6M132 458c172-20 318-10 502 8M132 548c154-17 304-13 502 7" fill="none" stroke="#d8bf86" stroke-width="5" stroke-linecap="round" opacity=".55"/></g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
function buildIllustrationPrompt({ bodyText = "", sceneSummary = "", illustrationPrompt = "" } = {}) {
  const detail = illustrationPrompt ? `具体案: ${clampText(illustrationPrompt, 420)}\n` : "";
  return `以下の物語本文に合う、絵本の一枚絵を作ってください。
画像内に文字・看板・ラベル・吹き出し・数字は絶対に入れない。
日本語文字、英字、記号、吹き出し、看板、ラベル、キャプションを描かない。
絵本の一枚絵。1ページ目の画風に近い、温かい手描き絵本風。紙の質感。少し奇妙でユーモラス。
参照画像がある場合は、前ページ画像の主人公・少女・主要キャラの見た目をなるべく維持する。
参照画像がある場合は、前ページ画像の画風、線の太さ、紙の質感、主要物体の見た目を維持する。
場所が変わる場合でも、前ページ由来のキャラや物体を完全に別人・別物にしない。
現在の日数や本文を画像内に描かない。
必ず本文の状況に合う挿絵にする。
主人公は必ず「俺」。棒人間、単純な円や謎の物体だけで済ませない。
${detail}本文: ${clampText(bodyText, 360)}
状況: ${clampText(sceneSummary, 420)}`;
}

function inferCarryoverElements(page = {}) {
  const text = `${page.sceneSummary || ""} ${page.bodyText || ""} ${page.illustrationPrompt || page.imagePrompt || ""}`;
  const locationKeywords = ["路地裏", "石畳", "駅前", "改札", "森", "城", "部屋", "道", "川", "広場", "店", "車内"];
  const peopleKeywords = ["俺", "少女", "駅員", "王様", "郵便屋", "使い", "迷子", "職人", "勇者"];
  const objectKeywords = ["車", "召喚陣", "巨大魚", "コイン", "紫の光", "小石", "車輪", "壁", "影", "切符", "網", "王冠", "月"];
  const firstMatch = (keywords) => keywords.find((keyword) => text.includes(keyword)) || "";
  const allMatches = (keywords, min = 1) => {
    const found = keywords.filter((keyword) => text.includes(keyword));
    return found.length >= min ? found : keywords.slice(0, min);
  };
  return {
    location: firstMatch(locationKeywords),
    people: allMatches(peopleKeywords, 1),
    objects: allMatches(objectKeywords, 2),
  };
}
function buildContinuityIllustrationPrompt({ current = {}, bodyText = "", sceneSummary = "", changeLabels = [], trouble = "" } = {}) {
  const carry = inferCarryoverElements(current);
  return `前ページから引き継ぐ人物: ${carry.people.join("、") || "俺"}
前ページから引き継ぐ重要物体: ${carry.objects.slice(0, 4).join("、") || "前ページの主要物体"}
前ページからの関係・目的: ${trouble || sceneSummary || bodyText}
今回変化したもの: ${changeLabels.join("、") || "前ページの変化"}
絵本風、紙の質感、文字なし。場所の完全維持より目的の進行を優先し、前ページ由来の人物・物体の見た目と因果関係を保つ。`;
}

function errorMessage(error) {
  return String(error?.message || error || "unknown_error").slice(0, 500);
}
function imageGenerationPlaceholder() {
  const dataUrl = svgDataUrl();
  return { dataUrl, mimeType: "image/svg+xml", base64Length: dataUrlToBase64(dataUrl).length, fallback: true };
}
async function listGeminiModelsForDebug() {
  if (!GEMINI_API_KEY) {
    console.warn("[100ore] Gemini models.list skipped: GEMINI_API_KEY is not set");
    return [];
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `models_list_failed_${res.status}`);
  const models = (json.models || []).map((model) => ({
    name: model.name,
    supportedGenerationMethods: model.supportedGenerationMethods || [],
  }));
  console.log("[100ore] available Gemini models:", models);
  return models;
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function isRetryableGeminiError(error) {
  const message = errorMessage(error).toLowerCase();
  return message.includes("503") || message.includes("overload") || message.includes("unavailable") || message.includes("rate") || message.includes("timeout");
}
async function generateTextJson(genAI, prompt, timeoutMs = TEXT_TIMEOUT_MS) {
  if (!genAI) {
    const error = new Error("text_generation_unavailable");
    error.statusCode = 503;
    throw error;
  }
  let lastError = null;
  let retriedBusyOnce = false;
  for (const modelName of TEXT_MODEL_CANDIDATES) {
    let attempt = 0;
    while (attempt < 2) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await withTimeout(model.generateContent([{ text: prompt }]), timeoutMs, "text_generation");
        return jsonFromText(result.response.text());
      } catch (error) {
        lastError = error;
        console.warn("[100ore] text model failed:", { modelName, attempt: attempt + 1, error: errorMessage(error) });
        if (!retriedBusyOnce && isRetryableGeminiError(error)) {
          retriedBusyOnce = true;
          attempt += 1;
          await sleep(650);
          continue;
        }
        break;
      }
    }
  }
  const error = new Error(`text_generation_unavailable: ${errorMessage(lastError)}`);
  error.statusCode = 503;
  throw error;
}
async function generateImageWithModel(modelName, prompt, { referenceMimeType = "", referenceBase64 = "" } = {}) {
  const useReference = Boolean(referenceBase64);
  console.log("[100ore] trying image model:", { modelName, useReference, referenceBase64Length: referenceBase64.length });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("image_generation_timeout")), IMAGE_TIMEOUT_MS);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const parts = [{ text: prompt }];
    if (useReference) parts.push({ inlineData: { mimeType: referenceMimeType || "image/jpeg", data: referenceBase64 } });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });
    const json = await res.json().catch(() => ({}));
    const responseParts = json?.candidates?.[0]?.content?.parts || [];
    const imagePart = responseParts.find((part) => part.inlineData?.data);
    if (!res.ok || !imagePart) throw new Error(json?.error?.message || "image_not_returned");
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const base64 = imagePart.inlineData.data || "";
    console.log("[100ore] image generation succeeded:", { modelName, mimeType, base64Length: base64.length, usedReference: useReference, fallback: false });
    return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType, base64Length: base64.length, modelName, fallback: false, usedReference: useReference };
  } finally {
    clearTimeout(timeoutId);
  }
}
async function generateImageDataUrl(page, { referenceMimeType = "", referenceBase64 = "" } = {}) {
  const prompt = buildIllustrationPrompt(page);
  const hasReference = Boolean(referenceBase64);
  if (!GEMINI_API_KEY) {
    console.warn("[100ore] image generation fallback: GEMINI_API_KEY is not set", { hasReference, referenceBase64Length: referenceBase64.length });
    return imageGenerationPlaceholder();
  }
  for (const modelName of IMAGE_MODEL_CANDIDATES) {
    if (hasReference) {
      try {
        const image = await generateImageWithModel(modelName, prompt, { referenceMimeType, referenceBase64 });
        console.log("[100ore] successful image model:", { modelName, usedReference: true, fallback: false, generatedBase64Length: image.base64Length });
        return image;
      } catch (error) {
        console.warn("[100ore] reference image generation failed, retrying text-only", { modelName, referenceBase64Length: referenceBase64.length, error: errorMessage(error) });
      }
    }
    try {
      const image = await generateImageWithModel(modelName, prompt);
      console.log("[100ore] successful image model:", { modelName, usedReference: false, fallback: hasReference, generatedBase64Length: image.base64Length });
      return { ...image, referenceFallback: hasReference };
    } catch (error) {
      console.warn("[100ore] image model failed:", { modelName, usedReference: false, error: errorMessage(error) });
    }
  }
  console.warn("[100ore] image generation fallback: all image model candidates failed", { hasReference, referenceBase64Length: referenceBase64.length });
  return imageGenerationPlaceholder();
}
async function buildPageWithImage(page, options = {}) {
  const image = await generateImageDataUrl(page, options);
  const imageHash = sha256(dataUrlToBase64(image.dataUrl));
  FALLBACK_IMAGES.set(imageHash, image.dataUrl);
  console.log("[100ore] generated image payload:", {
    day: page.day,
    mimeType: image.mimeType,
    base64Length: image.base64Length,
    fallback: image.fallback,
    referenceImageUsed: Boolean(image.usedReference),
    referenceBase64Length: options.referenceBase64?.length || 0,
    referenceFallback: Boolean(image.referenceFallback),
    modelName: image.modelName || "none",
  });
  return { ...page, imageHash, imageDataUrl: image.dataUrl, imageGenerationFailed: Boolean(image.fallback), imageModel: image.modelName || "" };
}
async function buildInitialPage() {
  let imageHash = "initial-C4BBDE78-975C-45BC-8208-32BB45063795";
  try {
    imageHash = sha256Buffer(await fs.readFile(INITIAL_IMAGE_PATH));
  } catch (error) {
    console.warn("[100ore] initial image hash fallback:", error?.message || error);
  }
  return { ...INITIAL_PAGE, imageHash, sceneKey: buildSceneKey(imageHash, INITIAL_PAGE.sceneSummary) };
}
function sanitizeOutcome(outcome = {}) {
  return {
    rewriteText: scrubDisplayText(outcome.rewriteText, 180),
    outcomeSummary: scrubDisplayText(outcome.outcomeSummary, 180),
    outcomeType: normalizeOutcomeType(outcome.outcomeType),
    gameOver: normalizeBoolean(outcome.gameOver),
    gameOverReason: scrubDisplayText(outcome.gameOverReason, 180),
    nextSceneHint: scrubDisplayText(outcome.nextSceneHint, 180),
    compositeHash: clampText(outcome.compositeHash, 80),
    changeLabels: Array.isArray(outcome.changeLabels) ? outcome.changeLabels.map((v) => scrubDisplayText(v, 40)).filter(Boolean).slice(0, 8) : [],
    cacheId: clampText(outcome.cacheId, 80),
    cacheHit: normalizeBoolean(outcome.cacheHit),
    outcomeMode: clampText(outcome.outcomeMode, 30),
  };
}
function sanitizeCanvas(canvas = {}) {
  return {
    id: clampText(canvas.id, 80),
    sourceCanvasId: clampText(canvas.sourceCanvasId, 80),
    x: Number(canvas.x || 0),
    y: Number(canvas.y || 0),
    w: Number(canvas.w || 0),
    h: Number(canvas.h || 0),
    shape: clampText(canvas.shape, 20),
    label: clampText(canvas.label, 40),
    angle: Number(canvas.angle || 0),
    strokeCount: Math.max(0, Number(canvas.strokeCount || 0)),
    inkStrokeCount: Math.max(0, Number(canvas.inkStrokeCount || 0)),
    eraserStrokeCount: Math.max(0, Number(canvas.eraserStrokeCount || 0)),
    tools: Array.isArray(canvas.tools) ? canvas.tools.map((tool) => clampText(tool, 20)).filter(Boolean).slice(0, 4) : [],
  };
}
function sanitizeSavedPage(p = {}) {
  return {
    day: Math.max(1, Math.min(365, Number(p.day || 1))),
    pageTitle: scrubDisplayText(p.pageTitle, 60),
    bodyText: scrubDisplayText(p.bodyText, 220),
    sceneSummary: scrubDisplayText(p.sceneSummary, 220),
    sceneKey: clampText(p.sceneKey || buildSceneKey(p.imageHash || "", p.sceneSummary || ""), 40),
    changeLabels: Array.isArray(p.changeLabels) ? p.changeLabels.map((v) => scrubDisplayText(v, 40)).filter(Boolean).slice(0, 8) : [],
    outcomeSummary: scrubDisplayText(p.outcomeSummary || p.outcome?.outcomeSummary || p.outcome?.rewriteText || "", 180),
    canvases: Array.isArray(p.canvases) ? p.canvases.slice(0, 3).map(sanitizeCanvas) : (p.canvas ? [sanitizeCanvas(p.canvas)] : []),
    imageHash: clampText(p.imageHash, 80),
  };
}
function hydratePageForResponse(page = null) {
  if (!page) return null;
  if (page.imageDataUrl) return page;
  const imageDataUrl = FALLBACK_IMAGES.get(page.imageHash || "");
  if (imageDataUrl) return { ...page, imageDataUrl };
  const placeholder = imageGenerationPlaceholder();
  return { ...page, imageDataUrl: placeholder.dataUrl, imageGenerationFailed: true, imageModel: page.imageModel || "" };
}
function sanitizeCacheNextPage(page = null) {
  if (!page) return null;
  return {
    day: Math.max(1, Math.min(365, Number(page.day || 1))),
    pageTitle: scrubDisplayText(page.pageTitle, 60),
    bodyText: scrubDisplayText(page.bodyText, 220),
    sceneSummary: scrubDisplayText(page.sceneSummary, 220),
    sceneKey: clampText(page.sceneKey || buildSceneKey(page.imageHash || "", page.sceneSummary || ""), 40),
    imageHash: clampText(page.imageHash, 80),
    imageModel: clampText(page.imageModel, 80),
    imageGenerationFailed: normalizeBoolean(page.imageGenerationFailed),
  };
}
function serializeRun(run) {
  return { ...run, pages: (run.pages || []).map((p) => ({ ...p, imageUrl: Number(p.day) === 1 ? INITIAL_IMAGE_URL : p.imageUrl || "" })) };
}

function normalizeChangeLabels(labels = []) {
  return (Array.isArray(labels) ? labels : [])
    .map((label) => clampText(label, 40))
    .map((label) => label.replace(/[「」『』。.!！?？\s]+$/g, "").trim())
    .filter((label) => label && !CHANGE_LABEL_FORBIDDEN_TERMS.some((term) => label.includes(term)))
    .map((label) => scrubDisplayText(label, 40))
    .filter(Boolean)
    .slice(0, 8);
}
function fallbackChangeLabels(day, canvases = []) {
  const base = ["車の進路がずれる", "少女の落下がゆるむ", "召喚陣の線が歪む", "巨大魚の狙いが変わる"];
  const count = Math.max(1, Math.min(3, canvases.length || 2));
  return { changeLabels: base.slice(day % 2, day % 2 + count) };
}
function gameOverProbability(day) {
  if (day <= 2) return 0;
  if (day <= 5) return 0.12;
  if (day <= 10) return 0.23;
  return 0.33;
}
function chooseOutcomeMode(day) {
  if (Math.random() < gameOverProbability(day)) return "GAME_OVER";
  const earlyModes = ["RESOLVE", "BACKFIRE", "RESOLVE", "CHASE", "DEAL", "TRIAL"];
  const modes = ["RESOLVE", "BACKFIRE", "RESOLVE", "DEAL", "CHASE", "TRIAL", "NEW_ROLE", "SCENE_JUMP"];
  const pool = day >= 2 && day <= 4 ? earlyModes : modes;
  return pool[Math.floor(Math.random() * pool.length)];
}
function modeInstruction(mode) {
  const map = {
    RESOLVE: "今回の展開タイプ: RESOLVE。前の危機を一つ解決し、その結果として新しい目的・移動先・選択へ進める。",
    BACKFIRE: "今回の展開タイプ: BACKFIRE。変化が裏目に出るが、人物・因果関係・目的を保ったまま状況を一段階進める。",
    SCENE_JUMP: "今回の展開タイプ: SCENE_JUMP。場面を大きく変えてよいが、前ページ由来の人物・関係・主要物体を持ち越す。",
    NEW_ROLE: "今回の展開タイプ: NEW_ROLE。俺の役割や立場を変え、その役割で向かう具体的な目的物を置く。",
    DEAL: "今回の展開タイプ: DEAL。奇妙な取引を発生させ、成立または失敗の結果として次の局面へ進める。",
    CHASE: "今回の展開タイプ: CHASE。追跡や逃走へ移り、進路・移動先・障害物をはっきり置く。",
    TRIAL: "今回の展開タイプ: TRIAL。試練や審査へ移り、結果によって次に触れる証拠品や道具を置く。",
    GAME_OVER: "今回の展開タイプ: GAME_OVER。どんな変化でもゲームオーバーへ向かわせる。ただし変化の内容は必ず反映する。",
  };
  return map[mode] || map.SCENE_JUMP;
}
async function extractChangeLabels(genAI, { current, canvases, originalMimeType, originalBase64, compositeMimeType, compositeBase64, compositeHash, sceneKey, day }) {
  const logBase = {
    day,
    sceneKey,
    canvasCount: canvases.length,
    canvases: canvases.map((canvas) => ({
      id: canvas.id,
      shape: canvas.shape,
      label: canvas.label,
      x: Number(canvas.x || 0).toFixed(3),
      y: Number(canvas.y || 0).toFixed(3),
      w: Number(canvas.w || 0).toFixed(3),
      h: Number(canvas.h || 0).toFixed(3),
      angle: canvas.angle,
      strokeCount: canvas.strokeCount,
      inkStrokeCount: canvas.inkStrokeCount,
      tools: canvas.tools,
    })),
    compositeHash: String(compositeHash || "").slice(0, 12),
    originalBase64Length: originalBase64.length,
    compositeBase64Length: compositeBase64.length,
  };
  if (!compositeBase64) {
    const fallbackResult = fallbackChangeLabels(day, canvases);
    console.warn("[100ore] changeLabels fallback used", { ...logBase, reason: "missing_composite_image", fallbackLabels: fallbackResult.changeLabels, fallback: true, success: false });
    return { changeLabels: normalizeChangeLabels(fallbackResult.changeLabels), fallback: true };
  }
  if (!genAI) {
    const fallbackResult = fallbackChangeLabels(day, canvases);
    console.warn("[100ore] changeLabels fallback used", { ...logBase, reason: "GEMINI_API_KEY is not set", fallbackLabels: fallbackResult.changeLabels, fallback: true, success: false });
    return { changeLabels: normalizeChangeLabels(fallbackResult.changeLabels), fallback: true };
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `1枚目は変化前、2枚目は変化後です。beforeとafterを比較し、2枚目でユーザー描画によって増えた主な視覚変化だけを短いラベルにしてください。JSONだけ返してください。
現在の状況: ${clampText(current.sceneSummary, 240)}
本文: ${clampText(current.bodyText, 220)}
配置情報: ${JSON.stringify(canvases)}
返却形式: {"changeLabels":["主人公に羽","主人公に天使の輪"]}
読み取り方針:
- 2枚目で増えた線・色・形を探す。
- キャンパス枠、点線枠、選択枠、回転ハンドル、UI、操作用の枠は無視する。
- 人物の背中付近に翼のような形があれば「主人公に羽」。
- 頭上の輪のような形があれば「主人公に天使の輪」。
- 車輪付近の変化なら「車のタイヤが変化」。
- 少女の周囲の線なら「少女の落下に変化」。
- 召喚陣付近の変化なら「召喚陣が変化」。
- 変化が小さくても、最も目立つユーザー描画を優先する。
- 物語として面白くなるように勝手に飛躍させず、まずは視覚変化を素直に読む。
ルール:
- changeLabelsは同一判定用。短い名詞句/動詞句。
- 物語世界で起きた変化だけを書く。
- 次の語をchangeLabelsに絶対に使わない: ${CHANGE_LABEL_FORBIDDEN_TERMS.join("、")}
- 「最初から」「正史」「生まれつき」「昔から」のような歴史改変表現も禁止。`;
    const parts = [{ text: prompt }];
    if (originalBase64) parts.push({ inlineData: { mimeType: originalMimeType, data: originalBase64 } });
    parts.push({ inlineData: { mimeType: compositeMimeType, data: compositeBase64 } });
    const response = await withTimeout(model.generateContent(parts), VISION_TIMEOUT_MS, "change_labels");
    const parsed = jsonFromText(response.response.text());
    const changeLabels = normalizeChangeLabels(parsed.changeLabels);
    if (!changeLabels.length) throw new Error("change_labels_empty");
    console.log("[100ore] changeLabels extracted", { ...logBase, changeLabels, fallback: false, success: true });
    return { changeLabels, fallback: false };
  } catch (error) {
    console.warn("[100ore] changeLabels extraction failed", { ...logBase, reason: errorMessage(error), fallback: false, success: false });
    const transient = new Error(`change_labels_unavailable: ${errorMessage(error)}`);
    transient.statusCode = 503;
    throw transient;
  }
}
async function findCachedOutcome(genAI, sceneKey, changeLabels) {
  const sheetCaches = await listHundredOreCacheBySceneKey(sceneKey).catch((error) => {
    console.warn("[100ore] cache lookup fallback:", error?.message || error);
    return [];
  });
  const candidates = [...sheetCaches, ...MEMORY_CACHES.filter((cache) => cache.sceneKey === sceneKey)]
    .filter((cache) => cache.cacheId && cache.outcome)
    .slice(0, 40);
  if (!candidates.length) return null;
  if (!genAI) {
    const key = changeLabels.join("|");
    return candidates.find((c) => normalizeChangeLabels(c.changeLabels).join("|") === key) || null;
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const prompt = `同じ場面で、今回の変化ラベルが既存候補と同じ選択肢か判定してください。JSONだけ。
今回: ${JSON.stringify(changeLabels)}
候補: ${JSON.stringify(candidates.map((c) => ({ cacheId: c.cacheId, changeLabels: c.changeLabels })))}
返却形式: {"matched":true,"cacheId":"xxx"} または {"matched":false,"cacheId":""}
意味がほぼ同じならmatched=true。`;
    const response = await withTimeout(model.generateContent([{ text: prompt }]), TEXT_TIMEOUT_MS, "cache_match");
    const match = jsonFromText(response.response.text());
    if (normalizeBoolean(match.matched)) return candidates.find((c) => c.cacheId === String(match.cacheId || "")) || null;
  } catch (error) {
    console.warn("[100ore] cache match fallback:", error?.message || error);
  }
  return null;
}

export function mountHundredOreRoutes(app) {
  const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
  listGeminiModelsForDebug().catch((error) => console.warn("[100ore] Gemini models.list failed:", errorMessage(error)));
  app.get(HUNDRED_ORE_PUBLIC_PATH, (_req, res) => res.sendFile(path.join(process.cwd(), "public/100ore/index.html")));
  app.get(HUNDRED_ORE_ENCODED_PATH, (_req, res) => res.sendFile(path.join(process.cwd(), "public/100ore/index.html")));

  app.get("/api/100ore/debug/models", async (_req, res) => {
    try {
      const models = await listGeminiModelsForDebug();
      return res.json({ models });
    } catch (error) {
      console.warn("[100ore] debug models failed:", errorMessage(error));
      return res.status(500).json({ error:"models_list_failed", detail:errorMessage(error) });
    }
  });

  app.post("/api/100ore/start", async (req, res) => {
    try {
      const runId = `ore_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
      const page = await buildInitialPage();
      return res.json({ runId, page });
    } catch (error) { console.error("[100ore] start error:", error); return res.status(500).json({ error:"start_failed", detail:String(error?.message || "").slice(0, 180) }); }
  });

  app.post("/api/100ore/rewrite", async (req, res) => {
    try {
      const day = Math.max(1, Number(req.body?.day || 1));
      const current = req.body?.currentPage || {};
      const { mimeType: originalMimeType, base64: originalBase64 } = parseDataUrl(req.body?.originalImageDataUrl || "");
      const { mimeType: compositeMimeType, base64: compositeBase64 } = parseDataUrl(req.body?.compositeImageDataUrl || "");
      const compositeHash = sha256(compositeBase64);
      const canvases = Array.isArray(req.body?.canvases) ? req.body.canvases.slice(0, 3).map(sanitizeCanvas) : [];
      const sceneKey = clampText(current.sceneKey || buildSceneKey(current.imageHash || "", current.sceneSummary || ""), 40);
      const change = await extractChangeLabels(genAI, { current, canvases, originalMimeType, originalBase64, compositeMimeType, compositeBase64, compositeHash, sceneKey, day });
      const changeLabels = normalizeChangeLabels(change.changeLabels);
      const changeLabelsText = scrubDisplayText(changeLabels.join("、"), 160);

      const cached = await findCachedOutcome(genAI, sceneKey, changeLabels);
      if (cached) {
        const outcome = sanitizeOutcome({ ...cached.outcome, changeLabels, cacheId: cached.cacheId, cacheHit: true, compositeHash });
        return res.json({ outcome, nextPage: hydratePageForResponse(cached.nextPage || null), cacheHit: true });
      }

      const outcomeMode = chooseOutcomeMode(day);
      const fallback = () => fallbackOutcome(day, changeLabelsText);
      let outcome = { ...fallback(), outcomeMode };
      if (genAI && compositeBase64) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const outcomePrompt = `絵本ゲーム「100日後も生きる俺」の現在ページの結果だけをJSONで返してください。
1枚目は変化前、2枚目は変化後です。変化はページ内で実際に起きた出来事として扱います。
${modeInstruction(outcomeMode)}
現在のsceneSummary: ${clampText(current.sceneSummary, 240)}
現在のbodyText: ${clampText(current.bodyText, 220)}
変化ラベル: ${JSON.stringify(changeLabels)}
変化ラベル詳細: ${clampText(changeLabelsText, 160)}
配置情報: ${JSON.stringify(canvases)}
方針:
- 変化ラベルを必ず反映する。
- 「描いた」「落書き」「キャンパス」「画像」「改変」などのメタ語は表示用フィールドに絶対に出さない。
- 「最初からそうだった」「正史」「昔からあった」「生まれつき」などの歴史改変表現は禁止。
- 絵本世界の中で、タイヤがへこむ、影が広がる、線が歪む、狙いが変わる、のような因果として書く。
- 前ページの出来事を一つ受け継ぎつつ、同じ会話や同じ危機に居座らない。
- 次ページで介入しやすい目に見える具体物を2つ以上残す。
- GAME_OVERのときだけgameOver=trueにし、gameOverReasonを書く。
- 表示用フィールド（rewriteText/outcomeSummary/gameOverReason/nextSceneHint）では次の語を絶対に使わない: ${DISPLAY_FORBIDDEN_TERMS.join("、")}
JSONだけ: {"rewriteText":"80字以内で俺視点。","outcomeSummary":"具体的な結果要約。","outcomeType":"danger|chance|choice|embarrassment|mistake|weird|lucky|other","gameOver":false,"gameOverReason":"","nextSceneHint":"次ページへ受け継ぐ具体状況。見える物を含める。"}`;
          const parts = [{ text: outcomePrompt }];
          if (originalBase64) parts.push({ inlineData: { mimeType: originalMimeType, data: originalBase64 } });
          parts.push({ inlineData: { mimeType: compositeMimeType, data: compositeBase64 } });
          const result = await withTimeout(model.generateContent(parts), VISION_TIMEOUT_MS, "vision_generation");
          outcome = { ...outcome, ...jsonFromText(result.response.text()) };
        } catch (error) { console.warn("[100ore] vision fallback:", error?.message || error); }
      }
      if (outcomeMode === "GAME_OVER") outcome.gameOver = true;
      outcome = sanitizeOutcome({ ...outcome, compositeHash, changeLabels, outcomeMode });
      let nextPage = null;
      if (!outcome.gameOver) {
        const nextDay = day + 1;
        const carryover = inferCarryoverElements(current);
        const pagePrompt = `ゲーム「100日後も生きる俺」の次ページを作る。JSONだけ返してください。
必須形式: {"pageTitle":"","bodyText":"","sceneSummary":"","illustrationPrompt":""}
前ページの状況: ${clampText(current.sceneSummary, 220)}
前ページ本文: ${clampText(current.bodyText, 220)}
ページ内で起きた変化: ${clampText(changeLabelsText, 160)}
結果: ${clampText(outcome.outcomeSummary || outcome.rewriteText, 220)}
次ページへ受け継ぐ状況: ${clampText(outcome.nextSceneHint, 220)}
前ページから引き継ぐ場所: ${carryover.location || "同じ場所"}
前ページから引き継ぐ人物: ${carryover.people.join("、") || "俺"}
前ページから引き継ぐ物体: ${carryover.objects.slice(0, 4).join("、")}
今回変化したもの: ${changeLabels.join("、") || changeLabelsText}
今回の困りごと: ${clampText(outcome.nextSceneHint || outcome.outcomeSummary, 160)}
${modeInstruction(outcomeMode)}
方針:
- 主人公は必ず「俺」。前ページの登場人物、重要な関係、直前の変化を受け継ぐ。
- 場所の完全維持よりも、目的の進行を優先する。
- 毎ページ、状況を一段階前へ進める。同じ危機を言い換えて引き延ばさない。
- 「まだ終わっていない」「どう動けばいい？」で停滞させない。
- 何かを解決したら、その結果として新しい目的・移動先・役割・選択へ進む。
- 同じ場所に留まり続けない。SCENE_JUMP以外でも小規模な場面転換は許可する。
- ただし、主人公や重要キャラが別人に見えるような断絶は避ける。
- 前ページの主要人物を維持し、主要物体も最低1〜2個は因果関係として持ち越す。
- 2〜4日目は初期ページの路地裏・少女・車・召喚陣・巨大魚・コインなどを発展させる。
- bodyTextは90〜130字程度。短めで画像化しやすくする。
- 目に見える困りごと、または次に触れそうな具体物を1つ以上置く。
- bodyTextの最後は、次に介入できる具体物・状況で終える。
- 「どう動けばいい？」「どうすればいい？」のような曖昧な締めは禁止。
- 王様が怒るだけ、剣が迫るだけ、会話だけ、不穏な空気だけは禁止。
- 「新たな誤解の種が」のような抽象だけで終わらない。
- illustrationPromptは本文とsceneSummaryに完全対応し、「前ページから引き継ぐ人物」「前ページから引き継ぐ重要物体」「今回変化したもの」「次の目的・移動先・具体物」を必ず明記する。
- illustrationPromptに文字、看板、ラベル、吹き出し、数字、キャプションを描く指示を絶対に入れない。
- 表示用フィールド（pageTitle/bodyText/sceneSummary）では次の語を絶対に使わない: ${DISPLAY_FORBIDDEN_TERMS.join("、")}
- 「最初から」「正史」「昔からあった」「生まれつき」も禁止。
pageTitleは必ず「${nextDay}日目：」で始める。`;
        const rawNext = await generateTextJson(genAI, pagePrompt, 18000);
        const continuityPrompt = buildContinuityIllustrationPrompt({ current, bodyText: rawNext.bodyText, sceneSummary: rawNext.sceneSummary, changeLabels, trouble: outcome.nextSceneHint || outcome.outcomeSummary });
        rawNext.illustrationPrompt = rawNext.illustrationPrompt
          ? `${continuityPrompt}
具体案: ${clampText(rawNext.illustrationPrompt, 420)}`
          : continuityPrompt;
        nextPage = await buildPageWithImage(
          normalizePage(rawNext, nextDay),
          { referenceImageDataUrl: req.body?.originalImageDataUrl || "", referenceMimeType: originalMimeType, referenceBase64: originalBase64 }
        );
        nextPage.sceneKey = buildSceneKey(nextPage.imageHash || "", nextPage.sceneSummary || "");
        console.log("[100ore] next page generated", {
          outcomeMode,
          currentPageTitle: current.pageTitle || "",
          nextPageTitle: nextPage.pageTitle || "",
          carriedCharacters: carryover.people,
          carriedObjects: carryover.objects,
          sceneKey,
          nextSceneKey: nextPage.sceneKey,
        });
      }
      const cacheId = `cache_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
      outcome = sanitizeOutcome({ ...outcome, cacheId });
      const shouldCache = !nextPage?.imageGenerationFailed;
      if (shouldCache) {
        const cacheNextPage = sanitizeCacheNextPage(nextPage);
        console.debug("[100ore] cache nextPageJson length", JSON.stringify(cacheNextPage || null).length);
        const cache = { recordType:"cache", cacheId, sceneKey, changeLabels, outcome, nextPage: cacheNextPage, createdAt:new Date().toISOString() };
        MEMORY_CACHES.unshift(cache); MEMORY_CACHES.splice(200);
        appendHundredOreCache(cache).catch((error) => console.warn("[100ore] cache save fallback:", error?.message || error));
      }
      return res.json({ outcome, nextPage, cacheHit: false, transientError: !shouldCache });
    } catch (error) {
      console.error("[100ore] rewrite error:", error);
      if (error?.statusCode === 503) return res.status(503).json({ error:"ai_busy", detail:"AIが混雑しています。もう一度試してください", transientError:true });
      return res.status(500).json({ error:"rewrite_failed", detail:String(error?.message || "").slice(0, 180) });
    }
  });

  app.post("/api/100ore/runs", async (req, res) => {
    const rawPages = Array.isArray(req.body?.pages) ? req.body.pages : [];
    const score = Math.floor(Number(req.body?.score || 0));
    if (!Number.isFinite(score) || score < 1 || score > 365 || score !== rawPages.length) {
      return res.status(400).json({ error:"invalid_score", detail:"score must be 1-365 and match pages.length" });
    }
    const pages = rawPages.slice(0, 365).map(sanitizeSavedPage);
    console.debug("[100ore] run pagesJson length", JSON.stringify(pages).length);
    const run = {
      runId: clampText(req.body?.runId || `ore_${Date.now()}`, 80),
      username: clampText(req.body?.username || "名無しの俺", 40),
      userTrackingId: clampText(req.body?.userTrackingId || "", 120),
      startedAt: clampText(req.body?.startedAt || "", 40),
      endedAt: clampText(req.body?.endedAt || new Date().toISOString(), 40),
      score,
      gameOverReason: clampText(req.body?.gameOverReason || "", 220),
      pages,
      meta: { version: 2, pageCount: pages.length },
    };
    try { await appendHundredOreRun(run); } catch (error) { console.warn("[100ore] sheets save fallback:", error?.message || error); }
    MEMORY_RUNS.unshift(run); MEMORY_RUNS.splice(100);
    return res.json({ ok:true, runId:run.runId });
  });

  app.get("/api/100ore/rankings", async (_req, res) => {
    try {
      const rankings = await listHundredOreRankings({ limit: 30 });
      const merged = [...rankings, ...MEMORY_RUNS].sort((a,b) => Number(b.score)-Number(a.score) || String(b.endedAt).localeCompare(String(a.endedAt))).slice(0,30);
      return res.json({ rankings: merged.map((r) => ({ runId:r.runId, username:r.username, score:r.score, endedAt:r.endedAt, gameOverReason:r.gameOverReason })) });
    } catch { const rankings = MEMORY_RUNS.slice(0,30); return res.json({ rankings }); }
  });

  app.get("/api/100ore/runs/:runId", async (req, res) => {
    const runId = String(req.params.runId || "");
    try {
      const run = await getHundredOreRunById(runId);
      if (run) return res.json({ run: serializeRun(run) });
    } catch (error) { console.warn("[100ore] sheets get fallback:", error?.message || error); }
    const run = MEMORY_RUNS.find((item) => item.runId === runId);
    if (!run) return res.status(404).json({ error:"run_not_found" });
    return res.json({ run: serializeRun(run) });
  });
}
