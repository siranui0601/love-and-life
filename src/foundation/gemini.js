import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "./env.js";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export function stripJsonFence(s) {
  return typeof s === "string" ? s.replace(/^```json\s*|\s*```$/g, "") : s;
}

function isTransientGeminiError(err) {
  const msg = String(err?.message || "");
  const code = err?.status || err?.statusText || "";
  return (
    code === 429 ||
    code === 500 ||
    code === 503 ||
    code === 504 ||
    /Too Many Requests|QuotaFailure|Resource has been exhausted|high demand|Service Unavailable|UNAVAILABLE|INTERNAL|DEADLINE_EXCEEDED/i.test(msg)
  );
}

export async function genWithFallback(prompt, options = {}) {
  const primary = "gemini-2.5-flash-lite";
  const fallback = "gemini-2.5-flash";
  try {
    const m = genAI.getGenerativeModel({ model: primary, ...options });
    const res = await m.generateContent(prompt);
    return res.response.text();
  } catch (err) {
    if (!isTransientGeminiError(err)) throw err;
    const code = err?.status || err?.statusText || "unknown";
    console.warn(`[Gemini] ${primary} transient error (${code}). Fallback to ${fallback}`);
    await new Promise(r => setTimeout(r, 1200));
    try {
      const m2 = genAI.getGenerativeModel({ model: fallback, ...options });
      const res2 = await m2.generateContent(prompt);
      return res2.response.text();
    } catch (fallbackErr) {
      if (!isTransientGeminiError(fallbackErr)) throw fallbackErr;
      const fallbackCode = fallbackErr?.status || fallbackErr?.statusText || "unknown";
      console.warn(`[Gemini] ${fallback} transient error (${fallbackCode}). Retry once after delay`);
      await new Promise(r => setTimeout(r, 1800));
      const m3 = genAI.getGenerativeModel({ model: fallback, ...options });
      const res3 = await m3.generateContent(prompt);
      return res3.response.text();
    }
  }
}
