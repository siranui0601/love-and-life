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

const DISPLAY_FORBIDDEN_TERMS = [
  "落書き", "キャンパス", "プレイヤー", "ユーザー", "描いた", "書いた", "改変", "画像", "挿絵", "AI", "プロンプト", "画面", "差分", "生成", "追加された", "突然現れた", "急に出現した",
];
const DISPLAY_REPLACEMENTS = new Map([
  ["落書き", "しるし"], ["キャンパス", "枠"], ["プレイヤー", "俺"], ["ユーザー", "俺"], ["描いた", "生まれつきあった"], ["書いた", "刻まれていた"],
  ["改変", "正史"], ["画像", "一枚絵"], ["挿絵", "一枚絵"], ["AI", ""], ["プロンプト", ""], ["画面", "場面"], ["差分", "違い"], ["生成", "成立"],
  ["追加された", "昔からあった"], ["突然現れた", "昔からそこにあった"], ["急に出現した", "昔からそこにあった"],
]);

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
function scrubDisplayText(value, max = 260) {
  let text = clampText(value, max);
  for (const [term, replacement] of DISPLAY_REPLACEMENTS.entries()) text = text.split(term).join(replacement);
  return text.replace(/\s{2,}/g, " ").trim();
}
function normalizePage(page = {}, day = 1) {
  return {
    day,
    pageTitle: scrubDisplayText(page.pageTitle || `${day}日目`, 40),
    bodyText: scrubDisplayText(page.bodyText || "俺は余白の多いページに立っていた。", 180),
    sceneSummary: scrubDisplayText(page.sceneSummary || "絵本の世界で俺が次の出来事を待っている。", 240),
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
  return { rewriteText:"そのしるしは昔から王家の紋章だったことになり、俺の足元で小さな事件を起こした。", outcomeSummary:"古い紋章の由来から新しい道具と誤解が生まれた。", outcomeType:type, gameOver, gameOverReason:gameOver ? "その印は王立しおり係の紋章と間違われ、俺は物語の欄外へ丁寧に追放された。" : "", nextSceneHint: gameOver ? "" : "俺は新しい誤解を抱えたまま次のページへ進む。" };
}
function fallbackNextPage(day, hint = "") {
  const carried = hint || "前ページから続く王家の紋章騒ぎで、俺はなぜか王立パンくず裁判に呼ばれた。";
  return normalizePage({
    pageTitle: `${day}日目：パンくず裁判の証人`,
    bodyText: `${carried} 俺が咳をした瞬間、証拠品のパンくずが鳩の群れになって飛び、裁判長のかつらを巣にした。`,
    sceneSummary: `前ページの正史を引きずった俺が、パンくず裁判で証人席に立つ。パンくずは鳩になり、裁判長のかつらに巣を作って法廷が混乱する。`,
    illustrationPrompt: buildIllustrationPrompt({
      bodyText: `${carried} 俺が咳をした瞬間、証拠品のパンくずが鳩の群れになって飛び、裁判長のかつらを巣にした。`,
      sceneSummary: `俺が絵本の法廷で証人席に立ち、パンくずの鳩たちが裁判長の大きなかつらへ飛び込む。前ページから受け継いだ正史の要素が小道具や表情に残っている。`,
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
    rewriteText: scrubDisplayText(outcome.rewriteText, 180),
    outcomeSummary: scrubDisplayText(outcome.outcomeSummary, 180),
    outcomeType: normalizeOutcomeType(outcome.outcomeType),
    gameOver: normalizeBoolean(outcome.gameOver),
    gameOverReason: scrubDisplayText(outcome.gameOverReason, 180),
    nextSceneHint: scrubDisplayText(outcome.nextSceneHint, 180),
    compositeHash: clampText(outcome.compositeHash, 80),
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
  };
}
function sanitizeSavedPage(p = {}) {
  return {
    day: Math.max(1, Math.min(365, Number(p.day || 1))),
    pageTitle: scrubDisplayText(p.pageTitle, 60),
    bodyText: scrubDisplayText(p.bodyText, 220),
    sceneSummary: scrubDisplayText(p.sceneSummary, 220),
    outcomeSummary: scrubDisplayText(p.outcomeSummary || p.outcome?.outcomeSummary || p.outcome?.rewriteText || "", 180),
    canvases: Array.isArray(p.canvases) ? p.canvases.slice(0, 3).map(sanitizeCanvas) : (p.canvas ? [sanitizeCanvas(p.canvas)] : []),
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
      const { mimeType: originalMimeType, base64: originalBase64 } = parseDataUrl(req.body?.originalImageDataUrl || "");
      const { mimeType: compositeMimeType, base64: compositeBase64 } = parseDataUrl(req.body?.compositeImageDataUrl || "");
      const compositeHash = sha256(compositeBase64);
      const canvases = Array.isArray(req.body?.canvases) ? req.body.canvases.slice(0, 3).map(sanitizeCanvas) : (req.body?.canvas ? [sanitizeCanvas(req.body.canvas)] : []);
      const fallback = () => fallbackOutcome(day);
      let outcome = fallback();
      if (genAI && compositeBase64) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const outcomePrompt = `絵本ゲーム「100日後も生きる俺」の正史再構成判定です。
1枚目は改変前、2枚目は改変後です。差分を見つけてください。ただし、表示本文では“差分”“落書き”“キャンパス”“ユーザーが描いた”とは言わないでください。2枚目の絵が最初から正しい世界だったものとして、物語を再構成してください。
ここでは次ページ本文を作らず、現在ページに起きた outcome だけを返してください。
現在のsceneSummary: ${clampText(current.sceneSummary, 240)}
現在のbodyText: ${clampText(current.bodyText, 220)}
配置情報: ${JSON.stringify(canvases)}
方針:
- before画像とafter画像を比較する。
- after画像を「本来の正史」として扱う。
- beforeとの差分は、世界の歴史や設定が書き換わった結果として解釈する。
- 登場人物は、キャンパスや落書きやプレイヤーを認識しない。
- 登場人物は、after画像の状態を最初から当然のものとして受け入れている。
- 「黒い線が突然現れた」「王冠が急に消えた」のような出現描写は禁止。
- 「その皿には昔から王家の紋章のような黒い線が刻まれていた」のように、歴史・文化・設定として自然に言い換える。
- ただし、その正史のせいで新しい問題、好機、誤解、恥、危機のどれかを生む。
- 次ページで介入しやすいよう、目に見える具体物を2〜3個残す。
- 前ページの出来事を必ず受け継ぐ。主人公は必ず「俺」。
- 表示用フィールド（rewriteText/outcomeSummary/gameOverReason/nextSceneHint）では次の語を絶対に使わない: ${DISPLAY_FORBIDDEN_TERMS.join("、")}
- 即死にしすぎない。gameOverの場合だけgameOverReasonを書く。
JSONだけ: {"rewriteText":"正史化された結果。80字以内で俺視点。禁止語なし。","outcomeSummary":"具体的な正史の要約。禁止語なし。","outcomeType":"danger|chance|choice|embarrassment|mistake|weird|lucky|other","gameOver":false,"gameOverReason":"","nextSceneHint":"次ページへ受け継ぐ具体状況。見える物を含める。禁止語なし。"}`;
          const parts = [{ text: outcomePrompt }];
          if (originalBase64) parts.push({ inlineData: { mimeType: originalMimeType, data: originalBase64 } });
          parts.push({ inlineData: { mimeType: compositeMimeType, data: compositeBase64 } });
          const result = await withTimeout(model.generateContent(parts), VISION_TIMEOUT_MS, "vision_generation");
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
正史化された結果: ${clampText(outcome.outcomeSummary || outcome.rewriteText, 220)}
次ページへ受け継ぐ状況: ${clampText(outcome.nextSceneHint, 220)}
方針:
- 主人公は必ず「俺」。前ページの出来事と正史化された結果を必ず1つ受け継ぐ。
- ただ説明するだけにせず、奇想天外、絵本らしい、少し理不尽にする。
- 笑える危機、好機、恥、誤解、うっかりのうち2つ以上を混ぜる。
- bodyTextは90〜130字程度。誰がどこで何をして何が困る/面白いのか分かる具体文にする。
- 正史に基づく新しい奇想天外な状況を1つ起こす。
- 目に見える困りごとを1つ置く。
- 介入できそうな具体物を2〜3個置く。
- 危機だけでなく、好機・恥・誤解・うっかり・変なチャンスも混ぜる。
- ゲームオーバーでないので、次に手を加えたくなる余地を残す。
- 「新たな誤解の種が」のような抽象だけで終わらない。画像にしづらい棒、円、謎の物体だけの状況にしない。
- illustrationPromptはbodyTextとsceneSummaryに完全対応した一枚絵用プロンプトにする。
- illustrationPromptには、本文に出てきた具体物、主人公「俺」、主要キャラ、困りごと、介入対象、前ページから引き継いだ正史要素を必ず含める。
- illustrationPromptに文字、看板、ラベル、吹き出し、数字、キャプションを描く指示を絶対に入れない。
- illustrationPromptには温かい手描き絵本風、紙の質感、本文に合う一枚絵、画像内に文字を描かないことを含める。
- 表示用フィールド（pageTitle/bodyText/sceneSummary/nextSceneHint）では次の語を絶対に使わない: ${DISPLAY_FORBIDDEN_TERMS.join("、")}
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
