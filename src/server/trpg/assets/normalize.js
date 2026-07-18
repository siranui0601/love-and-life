import { decodePng } from "./chroma-key.js";

export async function normalizeToPng(buffer, mimeType) {
  if (String(mimeType).includes("png")) {
    try {
      decodePng(buffer);
      return { buffer, normalizedBy: "native-png" };
    } catch {
      // Fall through to sharp for indexed, interlaced or unusual PNG files.
    }
  }
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default ?? sharpModule;
    const output = await sharp(buffer, { failOn: "error", limitInputPixels: 32_000_000 }).ensureAlpha().png().toBuffer();
    decodePng(output);
    return { buffer: output, normalizedBy: "sharp" };
  } catch (error) {
    throw new Error(`png_normalization_unavailable:${String(error?.message ?? error).slice(0, 180)}`);
  }
}
