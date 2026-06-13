import { Readable } from "node:stream";
import { google } from "googleapis";
import { GOOGLE_DRIVE_IMAGE_FOLDER_ID, serviceAccount } from "./env.js";

const DRIVE_IMAGE_ROUTE_PREFIX = "/api/100ore/images";
const IMAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const imageCache = new Map();

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return { mimeType: "image/png", base64: "" };
  return { mimeType: match[1] || "image/png", base64: match[2] || "" };
}

function extensionForMimeType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("svg")) return "svg";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  return "bin";
}

function safeNamePart(value, fallback = "image") {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|\r\n]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || fallback;
}

export function isHundredOreDriveEnabled() {
  return Boolean(GOOGLE_DRIVE_IMAGE_FOLDER_ID && serviceAccount);
}

export async function getDriveClient() {
  if (!serviceAccount) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません");

  const auth = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ["https://www.googleapis.com/auth/drive"]
  );

  await auth.authorize();
  return google.drive({ version: "v3", auth });
}

export async function uploadHundredOreImageToDrive({
  imageDataUrl,
  imageHash,
  pageNumber,
  title,
  runId,
  cacheId,
  gameOver,
} = {}) {
  if (!GOOGLE_DRIVE_IMAGE_FOLDER_ID) return null;
  if (!imageDataUrl) return null;

  const { mimeType, base64 } = parseDataUrl(imageDataUrl);
  if (!base64) return null;

  const buffer = Buffer.from(base64, "base64");
  const drive = await getDriveClient();
  const ext = extensionForMimeType(mimeType);
  const name = [
    "100ore",
    safeNamePart(runId || "run"),
    `p${Number(pageNumber || 0) || 0}`,
    gameOver ? "badend" : "normal",
    safeNamePart(cacheId || imageHash || Date.now(), "image"),
    safeNamePart(title || "page", "page"),
  ].join("_");

  const res = await drive.files.create({
    requestBody: {
      name: `${name}.${ext}`,
      parents: [GOOGLE_DRIVE_IMAGE_FOLDER_ID],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id,mimeType,size",
  });

  const imageFileId = res.data.id;
  return imageFileId ? { imageFileId, imageDriveUrl: `${DRIVE_IMAGE_ROUTE_PREFIX}/${imageFileId}` } : null;
}

export async function getHundredOreDriveImage(fileId) {
  const key = String(fileId || "").trim();
  if (!key) return null;

  const now = Date.now();
  const cached = imageCache.get(key);
  if (cached && cached.expiresAt > now) return cached;
  if (cached) imageCache.delete(key);

  const drive = await getDriveClient();
  const metaRes = await drive.files.get({ fileId: key, fields: "id,mimeType,name,size" });
  const mediaRes = await drive.files.get({ fileId: key, alt: "media" }, { responseType: "arraybuffer" });
  const item = {
    buffer: Buffer.from(mediaRes.data),
    mimeType: metaRes.data.mimeType || "application/octet-stream",
    name: metaRes.data.name || "image",
    expiresAt: now + IMAGE_CACHE_TTL_MS,
  };
  imageCache.set(key, item);
  return item;
}
