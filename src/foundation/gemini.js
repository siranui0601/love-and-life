import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "./env.js";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export function stripJsonFence(s) {
  return typeof s === "string" ? s.replace(/^```json\s*|\s*```$/g, "") : s;
}

export async function genWithFallback(prompt, options = {}) {
  const primary = "gemini-2.5-flash-lite";
  const fallback = "gemini-2.5-flash";
  try {
    const m = genAI.getGenerativeModel({ model: primary, ...options });
    const res = await m.generateContent(prompt);
    return res.response.text();
  } catch (err) {
    const msg = String(err?.message || "");
    const code = err?.status || err?.statusText || "";
    const isQuota =
      code === 429 || /Too Many Requests|QuotaFailure|Resource has been exhausted/i.test(msg);
    if (!isQuota) throw err;
    console.warn(`[Gemini] ${primary} quota hit. Fallback to ${fallback}`);
    await new Promise(r => setTimeout(r, 2000));
    const m2 = genAI.getGenerativeModel({ model: fallback, ...options });
    const res2 = await m2.generateContent(prompt);
    return res2.response.text();
  }
}