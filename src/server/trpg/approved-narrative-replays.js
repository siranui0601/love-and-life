import fs from "node:fs";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function validResponse(response) {
  return Boolean(response
    && typeof response === "object"
    && typeof response.narrative === "string"
    && response.narrative.trim()
    && Array.isArray(response.choices)
    && response.choices.length === 3
    && Array.isArray(response.speeches)
    && Array.isArray(response.proposals));
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const key = String(entry.key ?? "").trim();
  if (!key || !validResponse(entry.response)) return null;
  return {
    key,
    response: {
      narrative: entry.response.narrative,
      choices: clone(entry.response.choices),
      speeches: clone(entry.response.speeches),
      proposals: clone(entry.response.proposals),
    },
    metadata: clone(entry.metadata ?? {}),
    approvedAt: entry.approvedAt ? String(entry.approvedAt) : null,
  };
}

export class ApprovedNarrativeReplayCache {
  constructor({ filePath = null } = {}) {
    this.filePath = filePath;
    this.entries = new Map();
    this.stats = { loaded: 0, hits: 0, misses: 0, rejected: 0, duplicates: 0 };
    this.load();
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch {
      this.stats.rejected += 1;
      return;
    }
    if (manifest?.schemaVersion !== "approved-narrative-replays-v1" || !Array.isArray(manifest.entries)) {
      this.stats.rejected += 1;
      return;
    }
    for (const rawEntry of manifest.entries) {
      const entry = normalizeEntry(rawEntry);
      if (!entry) {
        this.stats.rejected += 1;
        continue;
      }
      if (this.entries.has(entry.key)) {
        this.stats.duplicates += 1;
        continue;
      }
      this.entries.set(entry.key, entry);
      this.stats.loaded += 1;
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

  snapshot() {
    return {
      entries: this.entries.size,
      filePath: this.filePath,
      readOnly: true,
      ...this.stats,
    };
  }
}

export function createApprovedNarrativeReplayCache(options = {}) {
  return new ApprovedNarrativeReplayCache(options);
}
