import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export function assetHash(value) {
  const input = Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value);
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function extensionForMime(mimeType) {
  const mime = String(mimeType ?? "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "bin";
}

function safeName(value) {
  return String(value ?? "asset").normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "-").replace(/\s+/gu, "-").replace(/-+/gu, "-").replace(/^-|-$/gu, "").slice(0, 80) || "asset";
}

async function atomicJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, filePath);
}

export class TrpgAssetStore {
  constructor({
    root,
    metadataRoot,
    urlRoot = "/TRPG/assets",
    generationManifestPath = null,
    uiManifestPath = null,
  }) {
    if (!metadataRoot) throw new Error("asset_metadata_root_required");
    this.root = path.resolve(root);
    this.metadataRoot = path.resolve(metadataRoot);
    this.urlRoot = urlRoot.replace(/\/$/u, "");
    this.generationManifestPath = generationManifestPath
      ? path.resolve(generationManifestPath)
      : path.join(this.metadataRoot, "generation-manifest.json");
    this.uiManifestPath = uiManifestPath
      ? path.resolve(uiManifestPath)
      : path.join(this.root, "manifest.json");
  }

  async ensure() {
    await Promise.all([
      fs.mkdir(path.join(this.root, "portraits"), { recursive: true }),
      fs.mkdir(path.join(this.root, "backgrounds"), { recursive: true }),
      fs.mkdir(path.join(this.root, "monsters"), { recursive: true }),
      fs.mkdir(path.join(this.metadataRoot, "originals"), { recursive: true }),
    ]);
  }

  async readGenerationManifest() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.generationManifestPath, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : { version: 1, assets: {} };
    } catch {
      return { version: 1, assets: {} };
    }
  }

  async readUiManifest() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.uiManifestPath, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  async writeManifests(generationManifest, uiManifest) {
    await this.ensure();
    generationManifest.version = 1;
    generationManifest.updatedAt = new Date().toISOString();
    await atomicJson(this.generationManifestPath, generationManifest);
    await atomicJson(this.uiManifestPath, uiManifest);
  }

  file(type, id, suffix, extension) {
    const directory = type === "portrait"
      ? "portraits"
      : type === "background"
        ? "backgrounds"
        : type === "monster"
          ? "monsters"
          : "originals";
    const fileName = `${safeName(id)}${suffix ? `-${safeName(suffix)}` : ""}.${extension}`;
    const privateAsset = type === "original";
    const targetRoot = privateAsset ? this.metadataRoot : this.root;
    return {
      path: path.join(targetRoot, directory, fileName),
      url: privateAsset ? `originals/${encodeURIComponent(fileName)}` : `${this.urlRoot}/${directory}/${encodeURIComponent(fileName)}`,
      fileName,
      root: targetRoot,
    };
  }

  async writeBinary(target, buffer) {
    await this.ensure();
    const resolved = path.resolve(target.path);
    const targetRoot = path.resolve(target.root ?? this.root);
    if (![this.root, this.metadataRoot].includes(targetRoot) || !resolved.startsWith(`${targetRoot}${path.sep}`)) {
      throw new Error("asset_path_escape");
    }
    const temporary = `${resolved}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, buffer);
    await fs.rename(temporary, resolved);
  }

  async ready(record) {
    if (record?.status !== "ready" || !record.outputPath) return false;
    const relative = decodeURIComponent(String(record.outputPath).replace(`${this.urlRoot}/`, ""));
    const resolved = path.resolve(this.root, relative);
    if (!resolved.startsWith(`${this.root}${path.sep}`)) return false;
    return fs.access(resolved).then(() => true, () => false);
  }
}
