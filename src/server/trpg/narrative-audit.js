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

function normalizedChoiceLabel(value) {
  return String(value ?? "").replace(/[\s、。！？!?・「」『』（）()]/gu, "").toLowerCase();
}

function bigrams(value) {
  const text = normalizedChoiceLabel(value);
  if (text.length < 2) return new Set(text ? [text] : []);
  return new Set(Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)));
}

function labelSimilarity(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / Math.max(a.size, b.size);
}

function choicesAreMeaningfullyDifferent(choices) {
  for (let left = 0; left < choices.length; left += 1) {
    for (let right = left + 1; right < choices.length; right += 1) {
      const a = choices[left] ?? {};
      const b = choices[right] ?? {};
      const sameIntent = String(a.intentType ?? "") === String(b.intentType ?? "");
      const sameTarget = String(a.targetNpcId ?? "") === String(b.targetNpcId ?? "");
      if (sameIntent && sameTarget && labelSimilarity(a.label, b.label) >= 0.58) return false;
    }
  }
  return true;
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
  const speeches = response?.speeches ?? [];
  const speechActors = speeches.map((speech) => speech.actorId).filter(Boolean);
  const remoteSpeechActors = speechActors.filter((id) => !localNpcIds.has(id));
  const choices = response?.choices ?? [];
  const rejected = response?.proposalResolution?.rejected ?? [];
  const validationErrors = response?.meta?.validationErrors ?? [];
  const action = context?.action ?? {};
  const targetReplies = action.targetNpcId
    ? speeches.filter((speech) => speech.actorId === action.targetNpcId).map((speech) => String(speech.text ?? "")).join("\n")
    : "";
  const requiredDisclosure = String(action.requiredDisclosure ?? "").trim();
  const choiceSignatures = new Set(choices.map((choice) => [
    String(choice.intentType ?? ""),
    String(choice.targetNpcId ?? ""),
    String(choice.label ?? "").replace(/[\s、。！？!?・「」『』（）()]/gu, "").slice(0, 18),
  ].join("|")));
  const genericSpeech = speeches.some((speech) => /^(?:[.．。…・⋯—―\-\s]+|(?:ふむ|そうだな|なるほど)[。…\s]*)$/u.test(String(speech.text ?? "").trim()));
  const isConversation = ["conversation", "talk"].includes(String(action.type ?? ""));
  const isWorkOffer = action.dialogueTopic === "work_offer";
  const allSpeechText = speeches.map((speech) => String(speech.text ?? "")).join("\n");
  const workOfferSpeech = targetReplies || allSpeechText;
  const concreteWorkOffer = /(?:\d+分|半日|一日|数時間)/u.test(workOfferSpeech)
    && /(?:\d+G|賃金|報酬)/u.test(workOfferSpeech)
    && workOfferSpeech.length >= 18;
  const isEscort = ["t01_escort", "t01_rescue_aftermath"].includes(action.dialogueTopic);
  const candidateIds = new Set((context?.allowedActionCandidates ?? []).map((candidate) => candidate.id));
  const generatedKinds = new Set(context?.actionAffordances?.allowedKinds ?? []);
  const progressAnchors = new Set(context?.progressContract?.anchorCandidateIds ?? []);
  const continuityCandidates = new Set(context?.continuityContract?.candidateIds ?? []);
  const requiredReactionActors = (context?.reactionContract?.requiredActorIds ?? []).filter((id) => localNpcIds.has(id));
  const visibleText = [response?.narrative, ...speeches.map((speech) => speech.text), ...choices.map((choice) => choice.label)].join("\n");
  const checks = {
    narrativePresent: Boolean(String(response?.narrative ?? "").trim()),
    threeChoices: choices.length === 3,
    uniqueChoiceIds: new Set(choices.map((choice) => choice.id)).size === choices.length,
    choiceMeaningsDiffer: choiceSignatures.size === choices.length && choicesAreMeaningfullyDifferent(choices),
    choicesAreExecutable: choices.every((choice) => candidateIds.has(choice.id)
      || (choice.generatedAction?.kind && generatedKinds.has(choice.generatedAction.kind))),
    choicesUseDistinctActionFamilies: new Set(choices.map((choice) => choice.generatedAction?.kind ?? choice.intentType ?? "")).size >= 2,
    progressRouteOffered: context?.progressContract?.mode !== "must_offer_progress"
      || choices.some((choice) => progressAnchors.has(choice.id)),
    activeIntentContinuationOffered: context?.continuityContract?.mode !== "must_offer_continuation"
      || !continuityCandidates.size
      || choices.some((choice) => continuityCandidates.has(choice.id)),
    requiredActorsReact: requiredReactionActors.every((actorId) => speeches.some((speech) => speech.actorId === actorId
      && !/^(?:[.．。…・⋯—―\-\s]+)$/u.test(String(speech.text ?? "").trim()))),
    localNpcOnly: remoteSpeechActors.length === 0,
    authorityFiltered: rejected.every((entry) => entry && entry.reason),
    conversationHasSubstance: !isConversation || (isWorkOffer ? workOfferSpeech.length >= 12 : targetReplies.length >= 12),
    requiredDisclosurePresent: !requiredDisclosure || targetReplies.includes(requiredDisclosure) || (isWorkOffer && concreteWorkOffer),
    workOfferIsConcrete: !isWorkOffer || concreteWorkOffer,
    escortHasHumanRequest: !isEscort || /(?:歩け|足|戻|広場|一緒|置いて)/u.test(targetReplies),
    noEmptyReactionSpeech: !genericSpeech,
    noInternalIdsInVisibleText: !/(?:SKL-|NPC\d|LOC_[A-Z]|MSN-[A-Z]|ACTION:)/u.test(visibleText),
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
    contracts: {
      progress: context?.progressContract ?? null,
      continuity: context?.continuityContract ?? null,
      reaction: context?.reactionContract ?? null,
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

export function createNarrativeAuditLog({
  filePath = process.env.TRPG_NARRATIVE_AUDIT_FILE ?? DEFAULT_NARRATIVE_AUDIT_FILE,
  memoryOnly = false,
  memoryLimit = Number(process.env.TRPG_NARRATIVE_AUDIT_MEMORY_LIMIT ?? 100),
} = {}) {
  const records = [];
  const normalizedMemoryLimit = memoryOnly ? Infinity : Math.max(0, Number(memoryLimit) || 0);
  const state = {
    filePath,
    memoryOnly,
    memoryLimit: normalizedMemoryLimit,
    totalRecords: 0,
    writes: 0,
    errors: 0,
    lastRecordAt: null,
  };
  let queue = Promise.resolve();
  if (!memoryOnly) fs.mkdirSync(path.dirname(filePath), { recursive: true });

  return {
    async record(entry) {
      const normalized = { ...entry, recordedAt: entry?.recordedAt ?? new Date().toISOString() };
      state.totalRecords += 1;
      state.lastRecordAt = normalized.recordedAt;
      if (normalizedMemoryLimit > 0) {
        records.push(normalized);
        if (records.length > normalizedMemoryLimit) records.splice(0, records.length - normalizedMemoryLimit);
      }
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

function writeCursor(cursorFilePath, payload) {
  fs.mkdirSync(path.dirname(cursorFilePath), { recursive: true });
  fs.writeFileSync(cursorFilePath, JSON.stringify(payload, null, 2));
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
  let cursorIndex = Math.max(0, Math.min(lines.length, Number(cursor.syncedLines ?? 0)));
  if (cursorIndex >= lines.length) return { ok: true, found: lines.length, synced: 0, remaining: 0, corrupt: 0 };

  let sheets = options.sheets;
  if (!sheets) {
    const { getSheetsClient } = await import("../../foundation/sheets.js");
    sheets = await getSheetsClient();
  }

  let synced = 0;
  let corrupt = 0;
  while (cursorIndex < lines.length) {
    const rawBatch = lines.slice(cursorIndex, cursorIndex + batchSize);
    const parsedBatch = rawBatch.map(safeJsonLine);
    const records = parsedBatch.filter(Boolean);
    corrupt += parsedBatch.length - records.length;
    if (records.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetName}'!A2:AJ`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: records.map(narrativeAuditRecordToSheetRow) },
      });
      synced += records.length;
    }
    cursorIndex += rawBatch.length;
    writeCursor(cursorFilePath, {
      syncedLines: cursorIndex,
      updatedAt: new Date().toISOString(),
      spreadsheetId,
      sheetName,
      syncedRecords: Number(cursor.syncedRecords ?? 0) + synced,
      corruptLines: Number(cursor.corruptLines ?? 0) + corrupt,
    });
  }

  return {
    ok: true,
    found: lines.length,
    synced,
    remaining: Math.max(0, lines.length - cursorIndex),
    corrupt,
    spreadsheetId,
    sheetName,
    cursorFilePath,
  };
}
