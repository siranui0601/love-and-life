import crypto from "node:crypto";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../../foundation/env.js";
import { appendHundredOreRun, getHundredOreRunById, listHundredOreRankings } from "../../foundation/sheets.js";

const HUNDRED_ORE_PUBLIC_PATH = "/100日後も生きる俺";
const HUNDRED_ORE_ENCODED_PATH = encodeURI(HUNDRED_ORE_PUBLIC_PATH);
const FALLBACK_IMAGES = new Map();
const MEMORY_RUNS = [];

function jsonFromText(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const target = fenced || raw.match(/\{[\s\S]*\}/)?.[0] || raw;
  return JSON.parse(target);
}
function dataUrlToBase64(dataUrl) { return String(dataUrl || "").replace(/^data:[^;]+;base64,/, ""); }
function sha256(input) { return crypto.createHash("sha256").update(String(input || "")).digest("hex"); }
function clampText(value, max = 260) { return String(value || "").trim().slice(0, max); }
function normalizePage(page = {}, day = 1) {
  return {
    day,
    pageTitle: clampText(page.pageTitle || `${day}日目`, 40),
    bodyText: clampText(page.bodyText || "俺は余白の多いページに立っていた。", 180),
    sceneSummary: clampText(page.sceneSummary || "絵本の世界で俺が次の出来事を待っている。", 180),
    imagePrompt: clampText(page.imagePrompt || "奇妙な絵本の一場面、主人公の俺、余白のある画面", 320),
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
  return normalizePage({ pageTitle:`${day}日目：欄外からの続き`, bodyText:`${hint || "俺は変な誤解を背負ったまま歩いた。"} 次の角では、パンの形をした門番が通行料として秘密を要求している。`, sceneSummary:`パンの門番が秘密を要求する道。俺は前ページの改変の影響をまだ受けている。`, imagePrompt:"whimsical eerie picture book page, bread shaped gatekeeper, Japanese man protagonist, paper texture, strange road" }, day);
}
function svgDataUrl(prompt, day) {
  const hash = sha256(`${prompt}:${day}`);
  const hue = parseInt(hash.slice(0, 2), 16);
  const accent = `hsl(${hue},55%,45%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 768"><defs><filter id="paper"><feTurbulence baseFrequency="0.018" numOctaves="4"/><feColorMatrix type="saturate" values="0.18"/><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><rect width="768" height="768" fill="#f7e5bd"/><g filter="url(#paper)"><circle cx="610" cy="135" r="74" fill="#f7d67e"/><path d="M90 610C240 465 381 706 680 520" fill="none" stroke="${accent}" stroke-width="42" stroke-linecap="round"/><rect x="165" y="260" width="190" height="250" rx="88" fill="#33415c"/><circle cx="260" cy="210" r="70" fill="#f1b881"/><path d="M218 210h84M230 245c35 28 62 28 92 0" stroke="#2d2118" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M440 250c95 18 145 90 118 160-25 65-112 70-152 18-36-47-18-133 34-178Z" fill="${accent}" opacity=".82"/><text x="52" y="86" font-family="serif" font-size="38" fill="#3c2a1d">${day}日目</text><text x="56" y="706" font-family="serif" font-size="24" fill="#5f4934">${escapeXml(String(prompt).slice(0, 34))}</text></g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
function escapeXml(s) { return s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
async function generateTextJson(genAI, prompt, fallback) {
  if (!genAI) return fallback();
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent([{ text: prompt }]);
    return jsonFromText(result.response.text());
  } catch (error) {
    console.warn("[100ore] text generation fallback:", error?.message || error);
    return fallback();
  }
}
async function generateImageDataUrl(prompt, day) {
  if (!GEMINI_API_KEY) return svgDataUrl(prompt, day);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: `絵本の1ページの一枚絵。文字は入れない。紙とインクの質感。少し奇妙で温かい。${prompt}` }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } })
    });
    const json = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!res.ok || !imagePart) throw new Error(json?.error?.message || "image_not_returned");
    return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
  } catch (error) {
    console.warn("[100ore] image generation fallback:", error?.message || error);
    return svgDataUrl(prompt, day);
  }
}
async function buildPageWithImage(page) {
  const imageDataUrl = await generateImageDataUrl(page.imagePrompt, page.day);
  const imageHash = sha256(dataUrlToBase64(imageDataUrl));
  FALLBACK_IMAGES.set(imageHash, imageDataUrl);
  return { ...page, imageHash, imageDataUrl };
}
function serializeRun(run) {
  return { ...run, pages: (run.pages || []).map((p) => ({ ...p, imageDataUrl: p.imageDataUrl || FALLBACK_IMAGES.get(p.imageHash) || "" })) };
}

export function mountHundredOreRoutes(app) {
  const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
  app.get(HUNDRED_ORE_PUBLIC_PATH, (_req, res) => res.sendFile(path.join(process.cwd(), "public/100ore/index.html")));
  app.get(HUNDRED_ORE_ENCODED_PATH, (_req, res) => res.sendFile(path.join(process.cwd(), "public/100ore/index.html")));

  app.post("/api/100ore/start", async (req, res) => {
    try {
      const username = clampText(req.body?.username || "旅人", 30);
      const runId = `ore_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
      const prompt = `ゲーム「100日後も生きる俺」の初期ページをJSONだけで返す。絵本らしく奇想天外、本文は70字以内。主人公は「俺」。形式:{"pageTitle":"1日目...","bodyText":"...","sceneSummary":"...","imagePrompt":"..."} プレイヤー:${username}`;
      const rawPage = await generateTextJson(genAI, prompt, () => fallbackInitialPage(runId));
      const page = await buildPageWithImage(normalizePage(rawPage, 1));
      return res.json({ runId, page });
    } catch (error) { console.error("[100ore] start error:", error); return res.status(500).json({ error:"start_failed", detail:String(error?.message || "").slice(0, 180) }); }
  });

  app.post("/api/100ore/rewrite", async (req, res) => {
    try {
      const day = Math.max(1, Number(req.body?.day || 1));
      const current = req.body?.currentPage || {};
      const compositeBase64 = dataUrlToBase64(req.body?.compositeImageDataUrl || "");
      const compositeHash = sha256(compositeBase64);
      const canvas = req.body?.canvas || {};
      const fallback = () => fallbackOutcome(day);
      let outcome = fallback();
      if (genAI && compositeBase64) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const result = await model.generateContent([{ text: `絵本ゲームの改変判定。画像は元絵+配置キャンパス+落書きの完成画像。現在:${clampText(current.sceneSummary, 220)} 本文:${clampText(current.bodyText, 180)} キャンパス:${JSON.stringify(canvas)}。落書きの位置と内容をこじつけでも物語化。即死にしすぎない。JSONだけ:{"rewriteText":"改変後本文80字以内","outcomeSummary":"要約","outcomeType":"danger|chance|choice|embarrassment|mistake|weird|lucky|other","gameOver":false,"gameOverReason":"","nextSceneHint":"次ページ状況"}` }, { inlineData: { mimeType: "image/png", data: compositeBase64 } }]);
          outcome = { ...outcome, ...jsonFromText(result.response.text()) };
        } catch (error) { console.warn("[100ore] vision fallback:", error?.message || error); }
      }
      outcome.rewriteText = clampText(outcome.rewriteText, 180); outcome.outcomeSummary = clampText(outcome.outcomeSummary, 180); outcome.gameOverReason = clampText(outcome.gameOverReason, 180); outcome.nextSceneHint = clampText(outcome.nextSceneHint, 180); outcome.compositeHash = compositeHash;
      let nextPage = null;
      if (!outcome.gameOver) {
        const nextDay = day + 1;
        const pagePrompt = `ゲーム「100日後も生きる俺」の次ページJSONだけ。前状況:${clampText(current.sceneSummary, 160)} 改変結果:${outcome.outcomeSummary} 次:${outcome.nextSceneHint} 危機/好機/恥/間抜けを混ぜる。本文80字以内。形式:{"pageTitle":"${nextDay}日目...","bodyText":"...","sceneSummary":"...","imagePrompt":"..."}`;
        const rawNext = await generateTextJson(genAI, pagePrompt, () => fallbackNextPage(nextDay, outcome.nextSceneHint));
        nextPage = await buildPageWithImage(normalizePage(rawNext, nextDay));
      }
      return res.json({ outcome, nextPage });
    } catch (error) { console.error("[100ore] rewrite error:", error); return res.status(500).json({ error:"rewrite_failed", detail:String(error?.message || "").slice(0, 180) }); }
  });

  app.post("/api/100ore/runs", async (req, res) => {
    const run = { runId: clampText(req.body?.runId || `ore_${Date.now()}`, 80), username: clampText(req.body?.username || "名無しの俺", 40), userTrackingId: clampText(req.body?.userTrackingId || "", 120), startedAt: clampText(req.body?.startedAt || "", 40), endedAt: clampText(req.body?.endedAt || new Date().toISOString(), 40), score: Math.max(1, Number(req.body?.score || 1)), gameOverReason: clampText(req.body?.gameOverReason || "", 220), pages: Array.isArray(req.body?.pages) ? req.body.pages.slice(0, 120).map((p) => ({ day:p.day, pageTitle:clampText(p.pageTitle,60), bodyText:clampText(p.bodyText,220), sceneSummary:clampText(p.sceneSummary,220), imageHash:clampText(p.imageHash,80), outcome:p.outcome || null, canvas:p.canvas || null, imageDataUrl:p.imageDataUrl && String(p.imageDataUrl).startsWith("data:image/svg") ? p.imageDataUrl : "" })) : [] };
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
