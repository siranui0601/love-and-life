import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_TRPG_SPREADSHEET_ID = "15slftR2b-76VKaUqTisYolhN1iCpHeB7asUBoyMnmRk";
export const DEFAULT_NARRATIVE_AUDIT_FILE = path.resolve(HERE, "../../../runtime-data/TRPG/narrative-audit.jsonl");
export const DEFAULT_NARRATIVE_AUDIT_CURSOR_FILE = path.resolve(HERE, "../../../runtime-data/TRPG/narrative-audit-sheet-cursor.json");
export const NARRATIVE_AUDIT_SHEET_NAME = "Gemini応答ログ";

function compactJson(value, limit = 30000) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

function numeric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : "";
}

function bool(value) {
  return Boolean(value);
}

function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function safeJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function usageFromMeta(meta = {}) {
  const usage = meta.usageMetadata ?? {};
  return {
    inputTokens: numeric(usage.promptTokenCount ?? usage.inputTokenCount),
    outputTokens: numeric(usage.candidatesTokenCount ?? usage.outputTokenCount),
    totalTokens: numeric(usage.totalTokenCount),
  };
}

export function evaluateNarrativeAuditRecord({ context, response }) {
  const localNpcIds = new Set((context?.localNpcs ?? []).map((npc) => npc.id));
  const speechActors = (response?.speeches ?? []).map((speech) => speech.actorId).filter(Boolean);
  const remoteSpeechActors = speechActors.filter((id) => !localNpcIds.has(id));
  const choices = response?.choices ?? [];
  const rejected = response?.proposalResolution?.rejected ?? [];
  const validationErrors = response?.meta?.validationErrors ?? [];
  const checks = {
    threeChoices: choices.length === 3,
    uniqueChoiceIds: new Set(choices.map((choice) => choice.id)).size === choices.length,
    localNpcOnly: remoteSpeechActors.length === 0,
    noFinalInvalid: !response?.meta?.usedFallback || validationErrors.length >= 0,
    authorityFiltered: rejected.every((entry) => entry && entry.reason),
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    remoteSpeechActors,
    rejectedProposalCount: rejected.length,
    validationErrorCount: validationErrors.length,
  };
}

export function createNarrativeAuditRecord({
  input,
  context,
  response,
  rawPrimary = "",
  rawFinal = "",
  startedAt,
  finishedAt,
  runId = "",
  scenarioId = "",
} = {}) {
  const meta = response?.meta ?? {};
  const usage = usageFromMeta(meta);
  const evaluation = evaluateNarrativeAuditRecord({ context, response });
  return {
    recordId: crypto.randomUUID(),
    recordedAt: new Date(finishedAt ?? Date.now()).toISOString(),
    runId: runId || input?.runId || input?.auditRunId || "",
    scenarioId: scenarioId || input?.scenarioId || input?.action?.id || "",
    cacheKey: meta.cacheKey ?? "",
    source: meta.source ?? "unknown",
    model: meta.model ?? "",
    promptVersion: meta.promptVersion ?? "",
    time: {
      day: context?.time?.day ?? input?.authoritativeState?.day ?? "",
      hour: context?.time?.hour ?? input?.authoritativeState?.hour ?? "",
      minute: context?.time?.minute ?? input?.authoritativeState?.minute ?? "",
    },
    place: {
      locationId: context?.place?.locationId ?? input?.authoritativeState?.locationId ?? "",
      facilityId: context?.place?.facilityId ?? input?.authoritativeState?.facilityId ?? "",
      facilityName: context?.place?.facilityName ?? input?.authoritativeState?.facilityName ?? "",
    },
    action: {
      id: context?.action?.id ?? input?.action?.id ?? "",
      type: context?.action?.type ?? input?.action?.type ?? "",
      label: context?.action?.label ?? input?.action?.label ?? "",
    },
    presentNpcIds: (context?.localNpcs ?? []).map((npc) => npc.id),
    authoritativeOutcome: context?.authoritativeOutcome ?? input?.authoritativeState?.authoritativeOutcome ?? null,
    rawPrimary: compactJson(rawPrimary),
    rawFinal: compactJson(rawFinal || rawPrimary),
    response: {
      narrative: response?.narrative ?? "",
      choices: response?.choices ?? [],
      speeches: response?.speeches ?? [],
      proposals: response?.proposals ?? [],
      proposalResolution: response?.proposalResolution ?? { accepted: [], rejected: [] },
    },
    validationErrors: meta.validationErrors ?? [],
    repairCalls: Number(meta.repairCalls ?? 0),
    usedFallback: Boolean(meta.usedFallback),
    cacheHit: meta.source === "replay_cache",
    providerCalls: Number(meta.providerCalls ?? 0),
    providerErrors: meta.providerErrors ?? [],
    latencyMs: Math.max(0, Number((finishedAt ?? Date.now()) - (startedAt ?? finishedAt ?? Date.now()))),
    usage,
    evaluation,
  };
}

export function narrativeAuditRecordToSheetRow(record) {
  const response = record?.response ?? {};
  const choices = response.choices ?? [];
  const resolution = response.proposalResolution ?? {};
  return [
    record?.recordId ?? "",
    record?.recordedAt ?? "",
    record?.runId ?? "",
    record?.scenarioId ?? "",
    record?.cacheKey ?? "",
    record?.source ?? "",
    record?.model ?? "",
    record?.promptVersion ?? "",
    numeric(record?.time?.day),
    [record?.time?.hour, record?.time?.minute].every((value) => value !== "" && value !== undefined)
      ? `${String(record.time.hour).padStart(2, "0")}:${String(record.time.minute).padStart(2, "0")}`
      : "",
    record?.place?.locationId ?? "",
    record?.place?.facilityName || record?.place?.facilityId || "",
    record?.action?.id ?? "",
    record?.action?.type ?? "",
    (record?.presentNpcIds ?? []).join(","),
    compactJson(record?.authoritativeOutcome, 12000),
    compactJson(record?.rawFinal || record?.rawPrimary, 30000),
    response.narrative ?? "",
    choices[0]?.label ?? "",
    choices[1]?.label ?? "",
    choices[2]?.label ?? "",
    compactJson(response.speeches, 12000),
    compactJson(response.proposals, 12000),
    compactJson(resolution.accepted ?? [], 12000),
    compactJson(resolution.rejected ?? [], 12000),
    compactJson(record?.validationErrors ?? [], 12000),
    numeric(record?.repairCalls),
    bool(record?.usedFallback),
    bool(record?.cacheHit),
    numeric(record?.latencyMs),
    numeric(record?.usage?.inputTokens),
    numeric(record?.usage?.outputTokens),
    numeric(record?.usage?.totalTokens),
    compactJson(record?.evaluation, 12000),
    "",
    "",
  ];
}

export function createNarrativeAuditLog({ filePath = process.env.TRPG_NARRATIVE_AUDIT_FILE ?? DEFAULT_NARRATIVE_AUDIT_FILE, memoryOnly = false } = {}) {
  const records = [];
  const state = {
    filePath,
    memoryOnly,
    writes: 0,
    errors: 0,
    lastRecordAt: null,
  };
  let queue = Promise.resolve();
  if (!memoryOnly) fs.mkdirSync(path.dirname(filePath), { recursive: true });

  return {
    async record(entry) {
      const normalized = { ...entry, recordedAt: entry?.recordedAt ?? new Date().toISOString() };
      records.push(normalized);
      state.lastRecordAt = normalized.recordedAt;
      if (memoryOnly) {
        state.writes += 1;
        return normalized;
      }
      queue = queue.then(async () => {
        try {
          await fs.promises.appendFile(filePath, `${JSON.stringify(normalized)}\n`, "utf8");
          state.writes += 1;
        } catch (error) {
          state.errors += 1;
          console.error("TRPG narrative audit append failed", error);
        }
      });
      await queue;
      return normalized;
    },
    records() {
      return [...records];
    },
    snapshot() {
      return { ...state, inMemoryRecords: records.length };
    },
  };
}

export async function syncNarrativeAuditToSheet(options = {}) {
  const filePath = options.filePath ?? process.env.TRPG_NARRATIVE_AUDIT_FILE ?? DEFAULT_NARRATIVE_AUDIT_FILE;
  const cursorFilePath = options.cursorFilePath ?? process.env.TRPG_NARRATIVE_AUDIT_CURSOR_FILE ?? DEFAULT_NARRATIVE_AUDIT_CURSOR_FILE;
  const spreadsheetId = options.spreadsheetId ?? process.env.TRPG_SPREADSHEET_ID ?? DEFAULT_TRPG_SPREADSHEET_ID;
  const sheetName = options.sheetName ?? NARRATIVE_AUDIT_SHEET_NAME;
  const batchSize = Math.max(1, Number(options.batchSize ?? 200));
  if (!fs.existsSync(filePath)) return { ok: true, found: 0, synced: 0, remaining: 0, reason: "audit_file_missing" };

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u).filter(Boolean);
  const cursor = safeReadJson(cursorFilePath, { syncedLines: 0 });
  const start = Math.max(0, Math.min(lines.length, Number(cursor.syncedLines ?? 0)));
  const parsed = lines.slice(start).map(safeJsonLine);
  const corrupt = parsed.filter((entry) => !entry).length;
  const records = parsed.filter(Boolean);
  if (!records.length) return { ok: true, found: lines.length, synced: 0, remaining: 0, corrupt };

  let sheets = options.sheets;
  if (!sheets) {
    const { getSheetsClient } = await import("../../foundation/sheets.js");
    sheets = await getSheetsClient();
  }

  let synced = 0;
  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetName}'!A2:AJ`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: batch.map(narrativeAuditRecordToSheetRow) },
    });
    synced += batch.length;
    fs.mkdirSync(path.dirname(cursorFilePath), { recursive: true });
    fs.writeFileSync(cursorFilePath, JSON.stringify({
      syncedLines: start + synced + corrupt,
      updatedAt: new Date().toISOString(),
      spreadsheetId,
      sheetName,
    }, null, 2));
  }
  return {
    ok: true,
    found: lines.length,
    synced,
    remaining: Math.max(0, records.length - synced),
    corrupt,
    spreadsheetId,
    sheetName,
    cursorFilePath,
  };
}
