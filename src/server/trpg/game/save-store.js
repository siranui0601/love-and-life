import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const DEFAULT_TRPG_SAVE_DIRECTORY = fileURLToPath(
  new URL("../../../../runtime-data/TRPG/game-saves/", import.meta.url),
);

const SAVE_ID = /^[a-z0-9][a-z0-9-]{7,80}$/u;

function assertSaveId(id) {
  if (!SAVE_ID.test(String(id ?? ""))) throw new Error("Invalid TRPG save id");
}

function indexedRecord(record) {
  return {
    id: record.id,
    ownerHash: record.ownerHash,
    schemaVersion: record.schemaVersion,
    resolverVersion: record.resolverVersion,
    contentRevision: record.contentRevision,
    playerName: record.playerName,
    profileId: record.profileId,
    tutorialVersion: record.tutorialVersion,
    revision: record.revision,
    stateHash: record.stateHash,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    summary: record.summary,
  };
}

export class FileTrpgSaveStore {
  constructor({ directory = process.env.TRPG_GAME_SAVE_DIRECTORY ?? DEFAULT_TRPG_SAVE_DIRECTORY } = {}) {
    this.directory = path.resolve(directory);
    this.index = null;
    this.indexPromise = null;
  }

  filePath(id) {
    assertSaveId(id);
    return path.join(this.directory, `${id}.json`);
  }

  async put(record) {
    await this.ensureIndex();
    await fs.mkdir(this.directory, { recursive: true });
    const target = this.filePath(record.id);
    const temporary = `${target}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporary, target);
    this.index.set(record.id, indexedRecord(record));
    return record;
  }

  async ensureIndex() {
    if (this.index) return this.index;
    if (!this.indexPromise) {
      this.indexPromise = (async () => {
        const index = new Map();
        try {
          for (const entry of (await fs.readdir(this.directory, { withFileTypes: true }))) {
            if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
            try {
              const record = JSON.parse(await fs.readFile(path.join(this.directory, entry.name), "utf8"));
              if (record?.id && record?.ownerHash) index.set(record.id, indexedRecord(record));
            } catch (error) {
              console.error(`TRPG save could not be indexed: ${entry.name}`, error);
            }
          }
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
        this.index = index;
        return index;
      })().finally(() => { this.indexPromise = null; });
    }
    return this.indexPromise;
  }

  async get(id) {
    try {
      return JSON.parse(await fs.readFile(this.filePath(id), "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async listByOwner(ownerHash) {
    return [...(await this.ensureIndex()).values()]
      .filter((record) => record.ownerHash === ownerHash)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  }

  async count() {
    return (await this.ensureIndex()).size;
  }

  async all() {
    return [...(await this.ensureIndex()).values()];
  }

  async delete(id) {
    const index = await this.ensureIndex();
    try {
      await fs.unlink(this.filePath(id));
      index.delete(id);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") {
        index.delete(id);
        return false;
      }
      throw error;
    }
  }
}

export class MemoryTrpgSaveStore {
  constructor() {
    this.records = new Map();
  }

  async put(record) {
    this.records.set(record.id, structuredClone(record));
    return record;
  }

  async get(id) {
    const record = this.records.get(id);
    return record ? structuredClone(record) : null;
  }

  async listByOwner(ownerHash) {
    return [...this.records.values()]
      .filter((record) => record.ownerHash === ownerHash)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .map((record) => structuredClone(record));
  }

  async count() {
    return this.records.size;
  }

  async all() {
    return [...this.records.values()].map((record) => structuredClone(record));
  }

  async delete(id) {
    return this.records.delete(id);
  }
}
