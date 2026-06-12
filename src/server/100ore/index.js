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
前ページ画像の画風と主要キャラの見た目は保つ。ただし構図と状況は次ページ本文に合わせて大きく変える。
changeLabelsから生まれた中心事件を画面の主役として描く。
参照画像がある場合は、前ページ画像の主人公・少女・重要キャラの見た目、線の太さ、紙の質感をなるべく維持する。
前ページと同じ構図にしなくてよい。次ページ本文に合わせて、視点・場所・ポーズを変えてよい。
直前の重要変化は維持し、目的・危機・局面の変化が一目で分かるようにする。
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
function buildContinuityIllustrationPrompt({ current = {}, bodyText = "", sceneSummary = "", changeLabels = [], trouble = "", storyCard = "" } = {}) {
  const carry = inferCarryoverElements(current);
  return `前ページから引き継ぐ人物: ${carry.people.join("、") || "俺"}
前ページから引き継ぐ重要物体: ${carry.objects.slice(0, 3).join("、") || "前ページの主要物体"}
前ページからの因果・直前の結果: ${trouble || sceneSummary || bodyText}
今回の中心事件(changeLabels): ${changeLabels.join("、") || "前ページの変化"}
展開カード: ${storyCard || "ESCALATE"}
絵本風、紙の質感、文字なし。前ページ画像の画風と主要キャラの見た目は保つ。ただし構図と状況は次ページ本文に合わせて大きく変える。前ページと同じ構図にしなくてよい。視点・場所・ポーズを変えてよい。changeLabels由来の中心事件を画面の主役にする。`;
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
    storyCard: clampText(outcome.storyCard || outcome.outcomeMode, 30),
    outcomeMode: clampText(outcome.outcomeMode || outcome.storyCard, 30),
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
  if (day <= 5) return 0.13;
  if (day <= 10) return 0.23;
  return 0.33;
}
function chooseOutcomeMode(day) {
  if (Math.random() < gameOverProbability(day)) return "GAME_OVER";
  const storyCards = ["ESCALATE", "SHIFT_STAGE", "NEW_RULE", "SWAP_ROLE", "REVEAL", "PRICE"];
  return storyCards[Math.floor(Math.random() * storyCards.length)];
}
function modeInstruction(storyCard) {
  const map = {
    ESCALATE: "展開カード: ESCALATE。changeLabelsが原因で、事態の規模や方向を一段階大きく変える。解決で止めず、次に触れる具体物を置く。",
    SHIFT_STAGE: "展開カード: SHIFT_STAGE。changeLabelsに押し出される形で場所・視点・足場のどれかを変える。脈絡のない転移ではなく因果で移動する。",
    NEW_RULE: "展開カード: NEW_RULE。changeLabelsの結果として世界のルールを一つ増やす。ルール説明だけで終えず、見える道具・場所・現象を置く。",
    SWAP_ROLE: "展開カード: SWAP_ROLE。助ける側と助けられる側、追う側と追われる側など役割を入れ替え、次の局面を変える。",
    REVEAL: "展開カード: REVEAL。隠れていた正体・目的・構造が見える。ただし説明だけで終えず、触れそうな具体物を置く。",
    PRICE: "展開カード: PRICE。助かった代償や交換条件を発生させる。代償によって場所・目的・危機のどれかを変える。",
    GAME_OVER: "展開カード: GAME_OVER。changeLabelsが中心事件になった結果としてゲームオーバーに向かう。変化の内容は必ず反映する。",
  };
  return map[storyCard] || map.ESCALATE;
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
    console.warn("[100ore] branch lookup fallback:", error?.message || error);
    return [];
  });
  const seen = new Set();
  const candidates = [...sheetCaches, ...MEMORY_CACHES.filter((cache) => cache.sceneKey === sceneKey)]
    .filter((cache) => cache.cacheId && cache.outcome)
    .filter((cache) => {
      if (seen.has(cache.cacheId)) return false;
      seen.add(cache.cacheId);
      return true;
    })
    .slice(0, 40);
  console.log("[100ore] branch lookup", { sceneKey, changeLabels, candidateCount: candidates.length });
  if (!candidates.length) return null;
  const exactKey = normalizeChangeLabels(changeLabels).join("|");
  const exact = candidates.find((c) => normalizeChangeLabels(c.changeLabels).join("|") === exactKey);
  if (exact) return exact;
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const prompt = `同じ場面で、今回の変化ラベルが既存の分岐記録と同じ選択肢か判定してください。JSONだけ。
今回: ${JSON.stringify(changeLabels)}
分岐候補: ${JSON.stringify(candidates.map((c) => ({ cacheId: c.cacheId, changeLabels: c.changeLabels })))}
返却形式: {"matched":true,"cacheId":"xxx"} または {"matched":false,"cacheId":""}
意味がほぼ同じならmatched=true。`;
    const response = await withTimeout(model.generateContent([{ text: prompt }]), TEXT_TIMEOUT_MS, "branch_match");
    const match = jsonFromText(response.response.text());
    if (normalizeBoolean(match.matched)) return candidates.find((c) => c.cacheId === String(match.cacheId || "")) || null;
  } catch (error) {
    console.warn("[100ore] branch match fallback:", error?.message || error);
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
      const changeLabelsText = scrubDisplayText(changeLabels.join(" / "), 160);
      console.log("[100ore] changeLabels extracted", {
        day,
        sceneKey,
        changeLabels,
        compositeHash: compositeHash.slice(0, 12),
        fallback: Boolean(change.fallback),
      });

      const cached = await findCachedOutcome(genAI, sceneKey, changeLabels);
      if (cached) {
        const storyCard = cached.storyCard || cached.outcome?.storyCard || cached.outcome?.outcomeMode || "";
        const outcome = sanitizeOutcome({ ...cached.outcome, changeLabels, cacheId: cached.cacheId, cacheHit: true, compositeHash, storyCard, outcomeMode: storyCard });
        console.log("[100ore] branch hit", { cacheId: cached.cacheId, sceneKey, changeLabels });
        return res.json({ outcome, nextPage: hydratePageForResponse(cached.nextPage || null), cacheHit: true });
      }

      const storyCard = chooseOutcomeMode(day);
      console.log("[100ore] storyCard selected", { day, storyCard });
      const fallback = () => fallbackOutcome(day, changeLabelsText);
      let outcome = { ...fallback(), storyCard, outcomeMode: storyCard };
      if (genAI && compositeBase64) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const outcomePrompt = `絵本ゲーム「100日後も生きる俺」の現在ページの結果だけをJSONで返してください。
1枚目は変化前、2枚目は変化後です。変化はページ内で実際に起きた出来事として扱います。
${modeInstruction(storyCard)}
現在のsceneSummary: ${clampText(current.sceneSummary, 240)}
現在のbodyText: ${clampText(current.bodyText, 220)}
変化ラベル: ${JSON.stringify(changeLabels)}
変化ラベル詳細: ${clampText(changeLabelsText, 160)}
配置情報: ${JSON.stringify(canvases)}
方針:
- 変化ラベルを必ず中心事件として扱う。装飾や小さな改善だけで済ませない。
- 変化ラベルによって場所・目的・立場・危機のどれかを大きく動かす。
- 問題を少し解決して同じ危機を続けるのは禁止。変化の結果として物語を変な方向へ押し出す。
- 「描いた」「落書き」「キャンパス」「画像」「改変」などのメタ語は表示用フィールドに絶対に出さない。
- 「最初からそうだった」「正史」「昔からあった」「生まれつき」などの歴史改変表現は禁止。
- 絵本世界の中で、羽に引っぱられる、光の柱が曲がる、出口が開く、狙いが変わる、のような因果として書く。
- 前ページの出来事を一つ受け継ぎつつ、同じ会話や同じ危機に居座らない。
- 次ページで介入しやすい目に見える具体物を2つ以上残す。
- GAME_OVERのときだけgameOver=trueにし、gameOverReasonを書く。
- 禁止: 「まだ終わっていない」「どう動けばいい？」「どうすればいい？」「不穏な気配」「新たな誤解の種」。
- 表示用フィールド（rewriteText/outcomeSummary/gameOverReason/nextSceneHint）では次の語を絶対に使わない: ${DISPLAY_FORBIDDEN_TERMS.join("、")}
JSONだけ: {"rewriteText":"80字以内で俺視点。changeLabelsによる結果。","outcomeSummary":"具体的な結果要約。","outcomeType":"danger|chance|choice|embarrassment|mistake|weird|lucky|other","gameOver":false,"gameOverReason":"","nextSceneHint":"次ページへ受け継ぐ具体状況。見える物を2つ以上含める。"}`;
          const parts = [{ text: outcomePrompt }];
          if (originalBase64) parts.push({ inlineData: { mimeType: originalMimeType, data: originalBase64 } });
          parts.push({ inlineData: { mimeType: compositeMimeType, data: compositeBase64 } });
          const result = await withTimeout(model.generateContent(parts), VISION_TIMEOUT_MS, "vision_generation");
          outcome = { ...outcome, ...jsonFromText(result.response.text()) };
        } catch (error) { console.warn("[100ore] vision fallback:", error?.message || error); }
      }
      if (storyCard === "GAME_OVER") outcome.gameOver = true;
      outcome = sanitizeOutcome({ ...outcome, compositeHash, changeLabels, storyCard, outcomeMode: storyCard });
      let nextPage = null;
      if (!outcome.gameOver) {
        const nextDay = day + 1;
        const carryover = inferCarryoverElements(current);
        const pagePrompt = `ゲーム「100日後も生きる俺」の次ページをJSONで作る。JSONだけ返してください。
必須JSON: {"pageTitle":"","bodyText":"","sceneSummary":"","illustrationPrompt":""}
前ページの状況: ${clampText(current.sceneSummary, 260)}
前ページ本文: ${clampText(current.bodyText, 220)}
直前の結果: ${clampText(outcome.outcomeSummary || outcome.rewriteText, 240)}
次ページへ押し出す因果: ${clampText(outcome.nextSceneHint, 240)}
changeLabels（次ページの中心事件）: ${JSON.stringify(changeLabels)}
changeLabelsText: ${clampText(changeLabelsText, 160)}
展開カード: ${storyCard}
${modeInstruction(storyCard)}
前ページから引き継ぐ重要キャラ候補: ${carryover.people.join("、") || "俺"}
前ページから因果として残してよい具体物候補: ${carryover.objects.slice(0, 3).join("、")}

物語方針:
- 解決ではなく、転がす。維持ではなく、因果でつなぐ。
- changeLabelsを装飾ではなく次ページの中心事件にする。
- changeLabelsによって場所・目的・立場・危機のどれかを必ず大きく動かす。
- 主人公は必ず「俺」。俺視点で書く。
- 維持するもの: 主人公「俺」、直前のchangeLabels、直前の結果、重要キャラ1〜2人、因果関係。
- 維持しなくてよいもの: 同じ場所、同じ構図、同じ危機、同じ物体全部、初期ページの全要素。
- 前ページの説明を繰り返さず、状況を一段階進める。同じ場所・同じ危機に留まらない。
- 完全に脈絡なく別世界へ飛ばさず、changeLabelsと直前の結果に押し出される形で場面を進める。
- カードに従い、場所・目的・立場・危機のどれかを大きく変える。

bodyTextのルール:
- 100〜160字程度。
- changeLabelsが中心事件になっている。
- 前ページの説明を繰り返さない。
- 1ページ内で状況が明確に進む。
- 目的・場所・立場・危機のどれかが変わる。
- 次に介入できる具体物が2つ以上見える。
- 最後は次に触れそうな具体物・場所・人物・現象で終える。
- 禁止: 「まだ終わっていない」「俺はどう動けばいい？」「俺はどうすればいい？」「何が起きているのか分からないままだった」「不穏な気配がした」「新たな誤解の種が生まれた」「少し和らいだが、危機は続いている」。
- 同じ危機を言い換えて引き延ばさない。

sceneSummaryのルール:
- 次ページ画像生成と後続ページのための状況要約。
- 現在の場所または局面、俺の状態、重要キャラ、changeLabelsの結果、次に触れそうな具体物、次ページの目的/危機を含める。
- 本文より少し具体的に。ただし長すぎない。

illustrationPromptのルール:
- 次ページ本文と完全に対応させる。
- 主人公「俺」、重要キャラ、changeLabelsから生まれた中心事件、今回のstoryCardによる大きな変化、次に触れそうな具体物を含める。
- 絵本風、紙の質感。前ページ画像の人物・画風をなるべく維持。
- 前ページ画像の画風と主要キャラの見た目は保つ。ただし構図と状況は次ページ本文に合わせて大きく変える。
- 前ページと同じ構図にしなくてよい。次ページ本文に合わせて、視点・場所・ポーズを変えてよい。
- changeLabelsから生まれた中心事件を画面の主役として描く。
- 禁止: 文字、数字、看板、ラベル、吹き出し、キャプション。
- 表示用フィールド（pageTitle/bodyText/sceneSummary）では次の語を絶対に使わない: ${DISPLAY_FORBIDDEN_TERMS.join("、")}
- 「最初から」「正史」「昔からあった」「生まれつき」も禁止。
pageTitleは必ず「${nextDay}日目：」で始める。`;
        const rawNext = await generateTextJson(genAI, pagePrompt, 18000);
        const continuityPrompt = buildContinuityIllustrationPrompt({ current, bodyText: rawNext.bodyText, sceneSummary: rawNext.sceneSummary, changeLabels, trouble: outcome.nextSceneHint || outcome.outcomeSummary, storyCard });
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
          storyCard,
          outcomeMode: storyCard,
          currentPageTitle: current.pageTitle || "",
          nextPageTitle: nextPage.pageTitle || "",
          carriedCharacters: carryover.people,
          carriedObjects: carryover.objects,
          sceneKey,
          nextSceneKey: nextPage.sceneKey,
        });
      }
      const cacheId = `cache_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
      outcome = sanitizeOutcome({ ...outcome, cacheId, storyCard, outcomeMode: storyCard });
      const shouldCache = !nextPage?.imageGenerationFailed;
      if (shouldCache) {
        const cacheNextPage = sanitizeCacheNextPage(nextPage);
        console.debug("[100ore] branch nextPageJson length", JSON.stringify(cacheNextPage || null).length);
        const cache = {
          recordType: "cache",
          cacheId,
          sceneKey,
          sourceDay: day,
          sourcePageTitle: scrubDisplayText(current.pageTitle, 60),
          changeLabels,
          changeLabelsText,
          storyCard,
          outcomeText: outcome.outcomeSummary || outcome.rewriteText || "",
          nextPageTitle: cacheNextPage?.pageTitle || "",
          nextPageBody: cacheNextPage?.bodyText || "",
          nextSceneKey: cacheNextPage?.sceneKey || "",
          outcome,
          nextPage: cacheNextPage,
          createdAt: new Date().toISOString(),
        };
        MEMORY_CACHES.unshift(cache); MEMORY_CACHES.splice(200);
        console.log("[100ore] branch saved", { cacheId, sceneKey, changeLabels, storyCard, nextPageTitle: cache.nextPageTitle });
        appendHundredOreCache(cache).catch((error) => console.warn("[100ore] branch save fallback:", error?.message || error));
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
