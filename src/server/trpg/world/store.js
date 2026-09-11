import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_WORLD_SAVE_DIRECTORY = fileURLToPath(new URL("../../../../runtime-data/TRPG/world-saves/", import.meta.url));
const OWNER_KEY = /^[a-f0-9]{64}$/u;

function assertOwnerKey(key) {
  if (!OWNER_KEY.test(String(key))) throw new TypeError("Invalid world save owner key");
}

/** Single-writer durable adapter. Never share this directory between Node replicas. */
export class FileWorldStore {
  constructor({ directory = process.env.TRPG_WORLD_SAVE_DIRECTORY ?? DEFAULT_WORLD_SAVE_DIRECTORY } = {}) {
    this.directory = path.resolve(directory);
  }

  filePath(ownerKey) {
    assertOwnerKey(ownerKey);
    return path.join(this.directory, `${ownerKey}.json`);
  }

  async get(ownerKey) {
    try {
      return JSON.parse(await fs.readFile(this.filePath(ownerKey), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async put(ownerKey, record) {
    const target = this.filePath(ownerKey);
    await fs.mkdir(this.directory, { recursive: true });
    const temporary = `${target}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
    try {
      const handle = await fs.open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temporary, target);
      // fsync the directory entry as well as the file on deployments that support it.
      // Windows does not expose directory fsync through Node; atomic rename still applies.
      if (process.platform !== "win32") {
        const directoryHandle = await fs.open(this.directory, "r");
        try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
      }
    } catch (error) {
      await fs.unlink(temporary).catch(() => {});
      throw error;
    }
  }
}

export class MemoryWorldStore {
  constructor() { this.records = new Map(); }
  async get(ownerKey) {
    assertOwnerKey(ownerKey);
    return this.records.has(ownerKey) ? structuredClone(this.records.get(ownerKey)) : null;
  }
  async put(ownerKey, record) {
    assertOwnerKey(ownerKey);
    this.records.set(ownerKey, structuredClone(record));
  }
}
