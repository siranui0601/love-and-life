export const TRPG_IMAGE_MODELS = Object.freeze([
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image-preview",
]);

function errorText(error) {
  return String(error?.message ?? error ?? "unknown_error").replace(/\s+/gu, " ").slice(0, 240);
}

function validateReferences(referenceImages) {
  if (!Array.isArray(referenceImages)) return [];
  if (referenceImages.length > 4) throw new Error("too_many_reference_images");
  return referenceImages.map((reference) => {
    if (!Buffer.isBuffer(reference?.data) || !reference.data.length) throw new Error("invalid_reference_image");
    if (reference.data.length > 4 * 1024 * 1024) throw new Error("reference_image_too_large");
    const mimeType = String(reference.mimeType ?? "").toLowerCase();
    if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(mimeType)) throw new Error("unsupported_reference_mime");
    return { mimeType, data: reference.data };
  });
}

function referenceModes(references) {
  if (!references.length) return [[]];
  const result = [references];
  if (references.length > 1) result.push([references[0]]);
  result.push([]);
  return result;
}

function validatedImageMime(buffer, claimedMimeType) {
  const mimeType = String(claimedMimeType ?? "").toLowerCase();
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "image/png" && isPng) return mimeType;
  if (mimeType === "image/jpeg" && isJpeg) return mimeType;
  if (mimeType === "image/webp" && isWebp) return mimeType;
  throw new Error("unsupported_or_mismatched_image_output");
}

export async function generateGeminiImage({
  apiKey,
  prompt,
  referenceImages = [],
  models = TRPG_IMAGE_MODELS,
  timeoutMs = 30_000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) throw new Error("gemini_api_key_missing");
  if (!String(prompt ?? "").trim()) throw new Error("image_prompt_missing");
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
  const references = validateReferences(referenceImages);
  const failures = [];
  for (const selectedReferences of referenceModes(references)) {
    for (const model of models) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error("image_timeout")), Math.max(1_000, Number(timeoutMs) || 30_000));
      try {
        const parts = [
          { text: String(prompt) },
          ...selectedReferences.map((reference) => ({
            inlineData: { mimeType: reference.mimeType, data: reference.data.toString("base64") },
          })),
        ];
        const response = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            signal: controller.signal,
            body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }),
          },
        );
        const json = await response.json().catch(() => ({}));
        const imagePart = (json?.candidates?.[0]?.content?.parts ?? []).find((part) => part?.inlineData?.data);
        if (!response.ok || !imagePart) throw new Error(json?.error?.message ?? "image_not_returned");
        const buffer = Buffer.from(imagePart.inlineData.data, "base64");
        if (!buffer.length || buffer.length > 16 * 1024 * 1024) throw new Error("invalid_image_buffer");
        const mimeType = validatedImageMime(buffer, imagePart.inlineData.mimeType);
        return {
          buffer,
          mimeType,
          model,
          referenceCount: selectedReferences.length,
          failures,
        };
      } catch (error) {
        failures.push({ model, referenceCount: selectedReferences.length, error: errorText(error) });
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw new Error(`gemini_image_generation_failed:${failures.map((failure) => `${failure.model}/${failure.referenceCount}:${failure.error}`).join("|").slice(0, 1_200)}`);
}
