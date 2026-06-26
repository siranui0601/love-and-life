import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { GEMINI_API_KEY } from "../../foundation/env.js";

const MODELS = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview", "gemini-2.5-flash-image-preview"];
const ROOT = path.join(process.cwd(), "public/generated/nohand-soccer");
const ORIGINAL_DIR = path.join(ROOT, "original");
const TRANSPARENT_DIR = path.join(ROOT, "transparent");
const MANIFEST_PATH = path.join(ROOT, "visual-cache.json");
const URL_ROOT = "/generated/nohand-soccer";
const SHAPES = new Set(["point", "line", "area", "fan", "gate", "rail", "carrier", "arm", "platform"]);
const GREEN = [0, 255, 0];
const SOLID_TOLERANCE = 46;
const EDGE_TOLERANCE = 118;
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC_TABLE = makeCrcTable();

function text(value, max = 80) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function err(error) { return String(error?.message || error || "unknown_error").slice(0, 220); }
function sha(input) { return crypto.createHash("sha256").update(String(input || "")).digest("hex"); }
function shapeOf(value) { const shape = text(value, 24); return SHAPES.has(shape) ? shape : "point"; }
function safeFile(value, max = 42) {
  return String(value || "visual").normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, max) || "visual";
}
function extFromMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpg") || mime.includes("jpeg")) return "jpg";
  return "bin";
}
async function ensureDirs() { await fs.mkdir(ORIGINAL_DIR, { recursive: true }); await fs.mkdir(TRANSPARENT_DIR, { recursive: true }); }
async function readManifest() { try { const data = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8")); return data && typeof data === "object" ? data : {}; } catch { return {}; } }
async function writeManifest(manifest) { await ensureDirs(); const tmp = `${MANIFEST_PATH}.${process.pid}.${Date.now()}.tmp`; await fs.writeFile(tmp, JSON.stringify(manifest, null, 2)); await fs.rename(tmp, MANIFEST_PATH); }
function urlFor(kind, fileName) { return `${URL_ROOT}/${kind}/${encodeURIComponent(fileName)}`; }
async function hasCachedFile(url) {
  if (!url || !url.startsWith(URL_ROOT)) return false;
  const rel = decodeURIComponent(url.slice(URL_ROOT.length).replace(/^\//, ""));
  const filePath = path.resolve(ROOT, rel);
  if (!filePath.startsWith(path.resolve(ROOT))) return false;
  await fs.access(filePath);
  return true;
}
function shapePrompt(shape) {
  return {
    arm: "横長の棒・アーム・フリッパー状。左右に長く、当たり判定が想像しやすい形。",
    platform: "横長の足場・板・台。ボールが乗れそうな厚みのある形。",
    line: "横長の棒・ガイド。細すぎず、衝突する実体として見える形。",
    rail: "横長または緩い曲線のレール。ボールが沿って動けそうな形。",
    carrier: "横長の動く足場や台車。足場部分と移動装置が一体に見える形。",
    gate: "縦長の門・通過ゲート。中央に通過口がある形。",
    fan: "扇形または放射状の装置。風を出す機械として分かる形。",
    area: "正方形寄りの範囲装置。床置きの機械・フィールド発生器の形。",
    point: "正方形寄りの小型装置。発射台・反発装置・スイッチのような形。",
  }[shape] || "単体のゲーム用ギミック装置。";
}
function buildPrompt(visualLabel, shape) {
  return `ゲーム用の単体ギミック素材を1つだけ描く。テーマ:${visualLabel}\n構図:${shapePrompt(shape)}\n必須: 背景は完全な #00FF00 の単色グリーンバック。背景にグラデーション、模様、影、床面を入れない。文字、数字、UI、ラベル、アイコン、ボール、ゴール、サッカー場、人物を描かない。装置だけを中央に大きく描く。輪郭をはっきり描く。背景と装置の境界を明確にする。影は最小限。かわいいが物理的な当たり判定が想像しやすい形にする。`;
}
async function generateImage(prompt) {
  if (!GEMINI_API_KEY) throw new Error("gemini_api_key_missing");
  let lastError = null;
  for (const model of MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("image_timeout")), 30000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }) });
      const json = await res.json().catch(() => ({}));
      const imagePart = (json?.candidates?.[0]?.content?.parts || []).find((part) => part.inlineData?.data);
      if (!res.ok || !imagePart) throw new Error(json?.error?.message || "image_not_returned");
      const buffer = Buffer.from(imagePart.inlineData.data || "", "base64");
      if (!buffer.length) throw new Error("image_buffer_empty");
      return { buffer, mimeType: imagePart.inlineData.mimeType || "image/png", model };
    } catch (error) {
      lastError = error;
      console.warn("[noHand-soccer] visual image model failed", { model, error: err(error) });
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`image_generation_failed:${err(lastError)}`);
}
function chunks(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIG)) throw new Error("not_png");
  const out = [];
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const len = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + len);
    out.push({ type, data });
    offset += len + 12;
    if (type === "IEND") break;
  }
  return out;
}
function paeth(a, b, c) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
function unfilter(data, width, height, bpp) {
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = data[input++];
    const row = y * stride;
    const prev = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = data[input++];
      const left = x >= bpp ? out[row + x - bpp] : 0;
      const up = y ? out[prev + x] : 0;
      const upLeft = y && x >= bpp ? out[prev + x - bpp] : 0;
      let v = raw;
      if (filter === 1) v += left;
      else if (filter === 2) v += up;
      else if (filter === 3) v += Math.floor((left + up) / 2);
      else if (filter === 4) v += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`unsupported_filter_${filter}`);
      out[row + x] = v & 255;
    }
  }
  return out;
}
function alphaFor(r, g, b, a) {
  const distance = Math.max(Math.abs(r - GREEN[0]), Math.abs(g - GREEN[1]), Math.abs(b - GREEN[2]));
  if (distance <= SOLID_TOLERANCE) return 0;
  if (g > r + 38 && g > b + 38 && distance <= EDGE_TOLERANCE) {
    return Math.round(a * ((distance - SOLID_TOLERANCE) / (EDGE_TOLERANCE - SOLID_TOLERANCE)));
  }
  return a;
}
function chromaKeyPng(buffer) {
  const list = chunks(buffer);
  const ihdr = list.find((c) => c.type === "IHDR")?.data;
  if (!ihdr) throw new Error("png_ihdr_missing");
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4), bitDepth = ihdr[8], colorType = ihdr[9], interlace = ihdr[12];
  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) throw new Error(`unsupported_png_${bitDepth}_${colorType}_${interlace}`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(list.filter((c) => c.type === "IDAT").map((c) => c.data)));
  const pixels = unfilter(raw, width, height, bpp);
  const rgba = Buffer.alloc(width * height * 4);
  const stride = width * bpp;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const source = y * stride + x * bpp;
    const target = (y * width + x) * 4;
    const r = pixels[source], g = pixels[source + 1], b = pixels[source + 2], a = colorType === 6 ? pixels[source + 3] : 255;
    rgba[target] = r; rgba[target + 1] = g; rgba[target + 2] = b; rgba[target + 3] = alphaFor(r, g, b, a);
  }
  return encodePng(width, height, rgba);
}
function makeCrcTable() { const table = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; }
function crc32(buffer) { let c = 0xffffffff; for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const name = Buffer.from(type, "ascii"), len = Buffer.alloc(4), crc = Buffer.alloc(4); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([len, name, data, crc]); }
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const scan = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) { scan[y * (stride + 1)] = 0; rgba.copy(scan, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([PNG_SIG, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(scan)), chunk("IEND", Buffer.alloc(0))]);
}
function response(record, cached) { return { visualLabel: record.visualLabel, shape: record.shape, imageUrl: record.status === "ready" ? record.transparentImagePath : "", originalImageUrl: record.originalImagePath || "", cached, status: record.status }; }
export async function getOrCreateNoHandGimmickVisual({ visualLabel, shape } = {}) {
  const label = text(visualLabel, 12);
  const cleanShape = shapeOf(shape);
  if (!label || label === "undefined" || label === "null") return { visualLabel: label, shape: cleanShape, imageUrl: "", originalImageUrl: "", cached: false, status: "skipped" };
  await ensureDirs();
  const manifest = await readManifest();
  const existing = manifest[label];
  if (existing?.status === "ready" && await hasCachedFile(existing.transparentImagePath).catch(() => false)) return response(existing, true);
  const now = new Date().toISOString();
  const key = sha(label).slice(0, 16);
  const prompt = buildPrompt(label, cleanShape);
  const base = { visualLabel: label, shape: existing?.shape || cleanShape, imagePrompt: prompt, originalImagePath: existing?.originalImagePath || "", transparentImagePath: existing?.transparentImagePath || "", createdAt: existing?.createdAt || now, updatedAt: now, status: "generating" };
  manifest[label] = base;
  await writeManifest(manifest);
  try {
    const image = await generateImage(prompt);
    const originalName = `${key}-${safeFile(label)}-greenback.${extFromMime(image.mimeType)}`;
    const transparentName = `${key}-${safeFile(label)}-transparent.png`;
    await fs.writeFile(path.join(ORIGINAL_DIR, originalName), image.buffer);
    const record = { ...base, originalImagePath: urlFor("original", originalName), updatedAt: new Date().toISOString(), status: "original-only", modelName: image.model, mimeType: image.mimeType };
    try {
      await fs.writeFile(path.join(TRANSPARENT_DIR, transparentName), chromaKeyPng(image.buffer));
      record.transparentImagePath = urlFor("transparent", transparentName);
      record.status = "ready";
    } catch (error) {
      record.error = `transparent_failed:${err(error)}`;
      console.warn("[noHand-soccer] chroma key failed", { visualLabel: label, error: err(error) });
    }
    const latest = await readManifest(); latest[label] = record; await writeManifest(latest);
    return response(record, false);
  } catch (error) {
    const failed = { ...base, updatedAt: new Date().toISOString(), status: "failed", error: err(error) };
    const latest = await readManifest(); latest[label] = failed; await writeManifest(latest);
    console.warn("[noHand-soccer] gimmick visual generation failed", { visualLabel: label, error: err(error) });
    return response(failed, false);
  }
}
export function mountNoHandSoccerVisualRoutes(app) {
  app.post("/api/nohand-soccer/gimmick-visual", async (req, res) => {
    const visualLabel = text(req.body?.visualLabel, 12);
    if (!visualLabel) return res.status(400).json({ error: "visualLabel is required." });
    return res.json(await getOrCreateNoHandGimmickVisual({ visualLabel, shape: req.body?.shape }));
  });
}
