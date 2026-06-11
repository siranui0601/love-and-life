import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../../foundation/env.js";
import { appendHundredOreRun, getHundredOreRunById, listHundredOreRankings } from "../../foundation/sheets.js";

const HUNDRED_ORE_PUBLIC_PATH = "/100日後も生きる俺";
const HUNDRED_ORE_ENCODED_PATH = encodeURI(HUNDRED_ORE_PUBLIC_PATH);
const FALLBACK_IMAGES = new Map();
const MEMORY_RUNS = [];
const INITIAL_IMAGE_FILE = "57AC36E4-B396-48E0-9386-60ED107CA964.png";
const INITIAL_IMAGE_PATH = path.join(process.cwd(), "public/2D素材", INITIAL_IMAGE_FILE);
const INITIAL_IMAGE_URL = `/2D画像/${INITIAL_IMAGE_FILE}`;
const OUTCOME_TYPES = new Set(["danger", "chance", "choice", "embarrassment", "mistake", "weird", "lucky", "other"]);
const TEXT_TIMEOUT_MS = 12000;
const IMAGE_TIMEOUT_MS = 30000;
const VISION_TIMEOUT_MS = 30000;
const IMAGE_MODEL_CANDIDATES = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image-preview",
];

const INITIAL_PAGE = {
  day: 1,
  pageTitle: "1日目：王様の朝ごはんが逃げた",
  bodyText:
    "目が覚めると、俺は王様の城の食堂係になっていた。今日は大事な朝食会。ところが、主役のパンケーキに小さな足が生え、皿から逃げ出そうとしている。",
  sceneSummary:
    "俺は王様の城の食堂係。朝食会の主役であるパンケーキが足を生やして逃げ出そうとしている。王様は怒っており、失敗すると俺が朝ごはんの代わりにされる。",
  imagePrompt:
    "王様の城の食堂、怒った王様、足が生えて逃げ出すパンケーキ、慌てる食堂係の俺、絵本風",
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
function normalizePage(page = {}, day = 1) {
  return {
    day,
    pageTitle: clampText(page.pageTitle || `${day}日目`, 40),
    bodyText: clampText(page.bodyText || "俺は余白の多いページに立っていた。", 180),
    sceneSummary: clampText(page.sceneSummary || "絵本の世界で俺が次の出来事を待っている。", 240),
    illustrationPrompt: clampText(page.illustrationPrompt || page.imagePrompt || "奇妙な絵本の一場面、主人公の俺、余白のある画面", 900),
    imagePrompt: clampText(page.illustrationPrompt || page.imagePrompt || "奇妙な絵本の一場面、主人公の俺、余白のある画面", 900),
  };
}
function fallbackInitialPage(seed) {
  const roles = ["空飛ぶ郵便屋", "王様の使い", "森の迷子", "パン職人", "勇者見習い"];
  const role = roles[parseInt(sha256(seed).slice(0, 2), 16) % roles.length];
  return normalizePage({ pageTitle:"1日目：余白つきの朝", bodyText:`俺は${role}として、しゃべる月の下に立っていた。道の先では小さな王冠がくしゃみをしている。`, sceneSummary:`俺は${role}。しゃべる月とくしゃみする王冠がある道で、最初の介入を待っている。`, imagePrompt:`storybook illustration, Japanese weird fairy tale, a man as ${role}, talking moon, sneezing crown, warm paper, blank spaces` }, 1);
}
function fallbackOutcome(day) {
  const types = ["danger","chance","choice","embarrassment","mistake","weird","lucky"];
  const type = types[day % types.length];
  const gameOver = day >= 4 && Math.random() < Math.min(.18 + day * .025, .52);
  return { rewriteText:"落書きはページの法則に化け、俺の足元で小さな事件を起こした。", outcomeSummary:"絵の余白から新しい道具と誤解が生まれた。", outcomeType:type, gameOver, gameOverReason:gameOver ? "描いた印が王立しおり係の紋章と間違われ、俺は物語の欄外へ丁寧に追放された。" : "", nextSceneHint: gameOver ? "" : "俺は新しい誤解を抱えたまま次のページへ進む。" };
}
function fallbackNextPage(day, hint = "") {
  const carried = hint || "前ページの落書きのせいで、俺はなぜか王立パンくず裁判に呼ばれた。";
  return normalizePage({
    pageTitle: `${day}日目：パンくず裁判の証人`,
    bodyText: `${carried} 俺が咳をした瞬間、証拠品のパンくずが鳩の群れになって飛び、裁判長のかつらを巣にした。`,
    sceneSummary: `前ページの改変を引きずった俺が、パンくず裁判で証人席に立つ。パンくずは鳩になり、裁判長のかつらに巣を作って法廷が混乱する。`,
    illustrationPrompt: buildIllustrationPrompt({
      bodyText: `${carried} 俺が咳をした瞬間、証拠品のパンくずが鳩の群れになって飛び、裁判長のかつらを巣にした。`,
      sceneSummary: `俺が絵本の法廷で証人席に立ち、パンくずの鳩たちが裁判長の大きなかつらへ飛び込む。前ページの改変の影響が小道具や表情に残っている。`,
    }),
  }, day);
}
function svgDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 768"><defs><filter id="paper"><feTurbulence baseFrequency="0.018" numOctaves="4"/><feColorMatrix type="saturate" values="0.12"/><feBlend in="SourceGraphic" mode="multiply"/></filter><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff3d0"/><stop offset="1" stop-color="#ead2a0"/></linearGradient></defs><rect width="768" height="768" fill="url(#g)"/><g filter="url(#paper)" opacity=".72"><path d="M96 120c120-36 250-32 374 0 80 21 137 14 202-12v540c-78 31-152 30-232 6-111-34-228-37-344-3z" fill="#f8e8bf" stroke="#d5b779" stroke-width="8"/><path d="M132 188c154-22 296-18 502 8M132 278c168-20 320-12 502 8M132 368c160-18 316-15 502 6M132 458c172-20 318-10 502 8M132 548c154-17 304-13 502 7" fill="none" stroke="#d8bf86" stroke-width="5" stroke-linecap="round" opacity=".55"/></g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
function buildIllustrationPrompt({ bodyText = "", sceneSummary = "", illustrationPrompt = "" } = {}) {
  const detail = illustrationPrompt ? `挿絵の具体案: ${clampText(illustrationPrompt, 420)}\n` : "";
  return `以下の物語本文に合う、絵本の一枚絵を描いてください。
画像内に文字・看板・ラベル・吹き出し・数字は絶対に入れない。
日本語文字、英字、記号、吹き出し、看板、ラベル、キャプションを描かない。
絵本の一枚絵。1ページ目の画風に近い、温かい手描き絵本風。紙の質感。少し奇妙でユーモラス。
現在の日数や本文を画像内に描かない。
必ず本文の状況に合う挿絵にする。
主人公は必ず「俺」。棒人間、単純な円や謎の物体だけで済ませない。
${detail}本文: ${clampText(bodyText, 360)}
状況: ${clampText(sceneSummary, 420)}`;
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
async function generateTextJson(genAI, prompt, fallback, timeoutMs = TEXT_TIMEOUT_MS) {
  if (!genAI) return fallback();
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await withTimeout(model.generateContent([{ text: prompt }]), timeoutMs, "text_generation");
    return jsonFromText(result.response.text());
  } catch (error) {
    console.warn("[100ore] text generation fallback:", error?.message || error);
    return fallback();
  }
}
async function generateImageWithModel(modelName, prompt) {
  console.log("[100ore] trying image model:", modelName);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("image_generation_timeout")), IMAGE_TIMEOUT_MS);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });
    const json = await res.json().catch(() => ({}));
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part) => part.inlineData?.data);
    if (!res.ok || !imagePart) throw new Error(json?.error?.message || "image_not_returned");
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const base64 = imagePart.inlineData.data || "";
    console.log("[100ore] image generation succeeded:", { modelName, mimeType, base64Length: base64.length });
    return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType, base64Length: base64.length, modelName, fallback: false };
  } finally {
    clearTimeout(timeoutId);
  }
}
async function generateImageDataUrl(page) {
  const prompt = buildIllustrationPrompt(page);
  if (!GEMINI_API_KEY) {
    console.warn("[100ore] image generation fallback: GEMINI_API_KEY is not set");
    return imageGenerationPlaceholder();
  }
  for (const modelName of IMAGE_MODEL_CANDIDATES) {
    try {
      const image = await generateImageWithModel(modelName, prompt);
      console.log("[100ore] successful image model:", modelName);
      return image;
    } catch (error) {
      console.warn("[100ore] image model failed:", { modelName, error: errorMessage(error) });
    }
  }
  console.warn("[100ore] image generation fallback: all image model candidates failed");
  return imageGenerationPlaceholder();
}
async function buildPageWithImage(page) {
  const image = await generateImageDataUrl(page);
  const imageHash = sha256(dataUrlToBase64(image.dataUrl));
  FALLBACK_IMAGES.set(imageHash, image.dataUrl);
  console.log("[100ore] generated image payload:", {
    day: page.day,
    mimeType: image.mimeType,
    base64Length: image.base64Length,
    fallback: image.fallback,
    modelName: image.modelName || "none",
  });
  return { ...page, imageHash, imageDataUrl: image.dataUrl, imageGenerationFailed: Boolean(image.fallback), imageModel: image.modelName || "" };
}
async function buildInitialPage() {
  let imageHash = "initial-57AC36E4-B396-48E0-9386-60ED107CA964";
  try {
    imageHash = sha256Buffer(await fs.readFile(INITIAL_IMAGE_PATH));
  } catch (error) {
    console.warn("[100ore] initial image hash fallback:", error?.message || error);
  }
  return { ...INITIAL_PAGE, imageHash };
}
function sanitizeOutcome(outcome = {}) {
  return {
    rewriteText: clampText(outcome.rewriteText, 180),
    outcomeSummary: clampText(outcome.outcomeSummary, 180),
    outcomeType: normalizeOutcomeType(outcome.outcomeType),
    gameOver: normalizeBoolean(outcome.gameOver),
    gameOverReason: clampText(outcome.gameOverReason, 180),
    nextSceneHint: clampText(outcome.nextSceneHint, 180),
    compositeHash: clampText(outcome.compositeHash, 80),
  };
}
function sanitizeCanvas(canvas = {}) {
  return {
    x: Number(canvas.x || 0),
    y: Number(canvas.y || 0),
    w: Number(canvas.w || 0),
    h: Number(canvas.h || 0),
    shape: clampText(canvas.shape, 20),
    label: clampText(canvas.label, 40),
  };
}
function sanitizeSavedPage(p = {}) {
  return {
    day: Math.max(1, Math.min(365, Number(p.day || 1))),
    pageTitle: clampText(p.pageTitle, 60),
    bodyText: clampText(p.bodyText, 220),
    sceneSummary: clampText(p.sceneSummary, 220),
    outcomeSummary: clampText(p.outcomeSummary || p.outcome?.outcomeSummary || p.outcome?.rewriteText || "", 180),
    canvas: p.canvas ? sanitizeCanvas(p.canvas) : null,
    imageHash: clampText(p.imageHash, 80),
  };
}
function serializeRun(run) {
  return { ...run, pages: (run.pages || []).map((p) => ({ ...p, imageUrl: Number(p.day) === 1 ? INITIAL_IMAGE_URL : p.imageUrl || "" })) };
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
      const { mimeType, base64: compositeBase64 } = parseDataUrl(req.body?.compositeImageDataUrl || "");
      const compositeHash = sha256(compositeBase64);
      const canvas = req.body?.canvas || {};
      const fallback = () => fallbackOutcome(day);
      let outcome = fallback();
      if (genAI && compositeBase64) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const outcomePrompt = `絵本ゲーム「100日後も生きる俺」の落書き改変判定です。
入力画像は「現在の挿絵 + ユーザーが配置したキャンパス + その中の落書き」です。
ここでは次ページ本文を作らず、落書きが現在ページに起こした outcome だけを返してください。
現在のsceneSummary: ${clampText(current.sceneSummary, 240)}
現在のbodyText: ${clampText(current.bodyText, 220)}
キャンパス情報: ${JSON.stringify(sanitizeCanvas(canvas))}
方針:
- 落書きの位置、色、形を観察し、こじつけでも具体的な出来事に変える。
- 前ページの出来事を必ず受け継ぐ。
- 主人公は必ず「俺」。
- 奇想天外、絵本らしい、少し理不尽。笑える危機、好機、恥、誤解、うっかりのどれかを混ぜる。
- 何が起きたか分かる具体文にする。「新たな誤解の種が」のような抽象だけで終わらない。
- 即死にしすぎない。gameOverの場合だけgameOverReasonを書く。
JSONだけ: {"rewriteText":"改変後本文。80字以内で俺視点。","outcomeSummary":"具体的な改変要約。","outcomeType":"danger|chance|choice|embarrassment|mistake|weird|lucky|other","gameOver":false,"gameOverReason":"","nextSceneHint":"次ページへ受け継ぐ具体状況。画像化しやすく。"}`;
          const result = await withTimeout(model.generateContent([{ text: outcomePrompt }, { inlineData: { mimeType, data: compositeBase64 } }]), VISION_TIMEOUT_MS, "vision_generation");
          outcome = { ...outcome, ...jsonFromText(result.response.text()) };
        } catch (error) { console.warn("[100ore] vision fallback:", error?.message || error); }
      }
      outcome = sanitizeOutcome({ ...outcome, compositeHash });
      let nextPage = null;
      if (!outcome.gameOver) {
        const nextDay = day + 1;
        const pagePrompt = `ゲーム「100日後も生きる俺」の次ページを作る。JSONだけ返してください。
必須形式: {"pageTitle":"","bodyText":"","sceneSummary":"","illustrationPrompt":""}
前ページの状況: ${clampText(current.sceneSummary, 220)}
前ページ本文: ${clampText(current.bodyText, 220)}
落書き改変結果: ${clampText(outcome.outcomeSummary || outcome.rewriteText, 220)}
次ページへ受け継ぐ状況: ${clampText(outcome.nextSceneHint, 220)}
方針:
- 主人公は必ず「俺」。前ページの出来事と落書き改変結果を必ず受け継ぐ。
- ただ説明するだけにせず、奇想天外、絵本らしい、少し理不尽にする。
- 笑える危機、好機、恥、誤解、うっかりのうち2つ以上を混ぜる。
- bodyTextは短いが、誰がどこで何をして何が困る/面白いのか分かる具体文にする。90字以内。
- ゲームオーバーでないので、次に描きたくなる余地を残す。
- 「新たな誤解の種が」のような抽象だけで終わらない。画像にしづらい棒、円、謎の物体だけの状況にしない。
- illustrationPromptはbodyTextとsceneSummaryに完全対応した挿絵用プロンプトにする。
- illustrationPromptに文字、看板、ラベル、吹き出し、数字、キャプションを描く指示を絶対に入れない。
- illustrationPromptには温かい手描き絵本風、紙の質感、本文に合う一枚絵、画像内に文字を描かないことを含める。
pageTitleは必ず「${nextDay}日目：」で始める。`;
        const rawNext = await generateTextJson(genAI, pagePrompt, () => fallbackNextPage(nextDay, outcome.nextSceneHint), 18000);
        nextPage = await buildPageWithImage(normalizePage(rawNext, nextDay));
      }
      return res.json({ outcome, nextPage });
    } catch (error) { console.error("[100ore] rewrite error:", error); return res.status(500).json({ error:"rewrite_failed", detail:String(error?.message || "").slice(0, 180) }); }
  });

  app.post("/api/100ore/runs", async (req, res) => {
    const rawPages = Array.isArray(req.body?.pages) ? req.body.pages : [];
    const score = Math.floor(Number(req.body?.score || 0));
    if (!Number.isFinite(score) || score < 1 || score > 365 || score !== rawPages.length) {
      return res.status(400).json({ error:"invalid_score", detail:"score must be 1-365 and match pages.length" });
    }
    const pages = rawPages.slice(0, 365).map(sanitizeSavedPage);
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
