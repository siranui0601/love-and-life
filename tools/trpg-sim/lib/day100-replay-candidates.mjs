import fs from "node:fs";
import path from "node:path";

const REUSABLE_SOURCES = new Set([
  "gemini",
  "gemini_repaired",
  "approved_replay",
  "replay_cache",
]);

const SOURCE_PRIORITY = Object.freeze({
  approved_replay: 4,
  gemini_repaired: 3,
  gemini: 3,
  replay_cache: 2,
});

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? "").trim();
}

function validResponse(response) {
  return Boolean(response
    && typeof response === "object"
    && text(response.narrative)
    && Array.isArray(response.choices)
    && response.choices.length === 3
    && Array.isArray(response.speeches)
    && Array.isArray(response.proposals));
}

function sourcePriority(source) {
  return Number(SOURCE_PRIORITY[source] ?? 0);
}

function normalizedResponse(response) {
  return {
    narrative: text(response.narrative),
    choices: clone(response.choices),
    speeches: clone(response.speeches),
    proposals: clone(response.proposals),
  };
}

function normalizedEntry(record) {
  const key = text(record?.cacheKey);
  const source = text(record?.source);
  if (!key || !REUSABLE_SOURCES.has(source)) return null;
  if (record?.usedFallback === true || record?.evaluation?.passed !== true) return null;
  if (!validResponse(record?.response)) return null;
  return {
    key,
    response: normalizedResponse(record.response),
    metadata: {
      runId: text(record.runId) || null,
      scenarioId: text(record.scenarioId) || null,
      source,
      model: text(record.model) || null,
      promptVersion: text(record.promptVersion) || null,
      recordedAt: text(record.recordedAt) || null,
      time: clone(record.time ?? null),
      place: clone(record.place ?? null),
      action: clone(record.action ?? null),
      presentNpcIds: clone(record.presentNpcIds ?? []),
      evaluation: clone(record.evaluation ?? null),
    },
  };
}

function entrySort(left, right) {
  const leftDay = Number(left.metadata?.time?.day ?? Number.MAX_SAFE_INTEGER);
  const rightDay = Number(right.metadata?.time?.day ?? Number.MAX_SAFE_INTEGER);
  if (leftDay !== rightDay) return leftDay - rightDay;
  const leftHour = Number(left.metadata?.time?.hour ?? Number.MAX_SAFE_INTEGER);
  const rightHour = Number(right.metadata?.time?.hour ?? Number.MAX_SAFE_INTEGER);
  if (leftHour !== rightHour) return leftHour - rightHour;
  const leftMinute = Number(left.metadata?.time?.minute ?? Number.MAX_SAFE_INTEGER);
  const rightMinute = Number(right.metadata?.time?.minute ?? Number.MAX_SAFE_INTEGER);
  if (leftMinute !== rightMinute) return leftMinute - rightMinute;
  return left.key.localeCompare(right.key, "en");
}

export function readNarrativeAuditRecords(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function buildDay100ReplayCandidateManifest(records, {
  runId = "",
  seed = "",
  sourceCommit = "",
  generatedAt = new Date().toISOString(),
} = {}) {
  const entriesByKey = new Map();
  let rejectedRecords = 0;
  let duplicateRecords = 0;
  for (const record of records ?? []) {
    const entry = normalizedEntry(record);
    if (!entry) {
      rejectedRecords += 1;
      continue;
    }
    const existing = entriesByKey.get(entry.key);
    if (existing) {
      duplicateRecords += 1;
      if (sourcePriority(existing.metadata.source) >= sourcePriority(entry.metadata.source)) continue;
    }
    entriesByKey.set(entry.key, entry);
  }
  const entries = [...entriesByKey.values()].sort(entrySort);
  return {
    schemaVersion: "day100-narrative-replay-candidates-v1",
    generatedAt,
    runId: text(runId) || null,
    seed: text(seed) || null,
    sourceCommit: text(sourceCommit) || null,
    reviewStatus: "candidate_only",
    activationNote: "Entries are inert until a human review promotes them into approved-narrative-replays.json.",
    stats: {
      auditRecords: Array.isArray(records) ? records.length : 0,
      reusableEntries: entries.length,
      rejectedRecords,
      duplicateRecords,
    },
    entries,
  };
}

export function writeDay100ReplayCandidateManifest({
  auditFilePath,
  outputFilePath,
  runId = "",
  seed = "",
  sourceCommit = "",
} = {}) {
  const records = readNarrativeAuditRecords(auditFilePath);
  const manifest = buildDay100ReplayCandidateManifest(records, {
    runId,
    seed,
    sourceCommit,
  });
  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
  fs.writeFileSync(outputFilePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}
