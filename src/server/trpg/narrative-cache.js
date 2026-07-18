import fs from "node:fs";
import path from "node:path";

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export class NarrativeReplayCache {
  constructor({ filePath = null, memoryOnly = false } = {}) {
    this.filePath = filePath;
    this.memoryOnly = memoryOnly || !filePath;
    this.entries = new Map();
    this.writeQueue = Promise.resolve();
    this.stats = { loaded: 0, hits: 0, misses: 0, writes: 0, corruptLines: 0 };
    if (!this.memoryOnly) this.load();
  }

  load() {
    ensureParent(this.filePath);
    if (!fs.existsSync(this.filePath)) return;
    const lines = fs.readFileSync(this.filePath, "utf8").split(/\r?\n/u).filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (!entry?.key || !entry?.response) continue;
        this.entries.set(entry.key, entry);
        this.stats.loaded += 1;
      } catch {
        this.stats.corruptLines += 1;
      }
    }
  }

  has(key) {
    return this.entries.has(key);
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      this.stats.misses += 1;
      return null;
    }
    this.stats.hits += 1;
    return clone(entry);
  }

  async set(key, response, metadata = {}) {
    const existing = this.entries.get(key);
    if (existing) return clone(existing);
    const entry = {
      key,
      response: clone(response),
      metadata: clone(metadata),
      createdAt: new Date().toISOString(),
    };
    this.entries.set(key, entry);
    this.stats.writes += 1;
    if (!this.memoryOnly) {
      ensureParent(this.filePath);
      this.writeQueue = this.writeQueue.then(() => fs.promises.appendFile(this.filePath, `${JSON.stringify(entry)}\n`, "utf8"));
      await this.writeQueue;
    }
    return clone(entry);
  }

  snapshot() {
    return {
      entries: this.entries.size,
      filePath: this.memoryOnly ? null : this.filePath,
      ...this.stats,
    };
  }
}

export function createNarrativeReplayCache(options = {}) {
  return new NarrativeReplayCache(options);
}
