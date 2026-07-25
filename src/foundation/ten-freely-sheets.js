import { SPREADSHEET_ID } from "./env.js";
import { getSheetsClient } from "./sheets.js";

export const TEN_FREELY_RESULT_SHEET = "10を自由に";
export const TEN_FREELY_ROOM_SHEET = "10を自由に_rooms";

const RESULT_HEADERS = [
  "record_type",
  "run_id",
  "user_tracking_id",
  "username_snapshot",
  "mode",
  "digit_lengths",
  "condition_key",
  "question_count",
  "initial_lives",
  "solved_count",
  "total_time_ms",
  "average_time_ms",
  "completed",
  "finish_reason",
  "details_json",
  "created_at",
  "rule_version",
];

const ROOM_HEADERS = [
  "room_id",
  "members_json",
  "status",
  "expires_at",
  "settings_json",
  "state_json",
  "updated_at",
];

let initializationPromise = null;

function quoteSheetName(name) {
  return `'${String(name).replaceAll("'", "''")}'`;
}

async function ensureWorksheet(sheets, title) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties(sheetId,title)",
  });
  const existing = (metadata.data.sheets || []).find((sheet) => sheet.properties?.title === title);
  if (existing) return existing.properties;

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  return response.data.replies?.[0]?.addSheet?.properties || { title };
}

async function ensureHeaders(sheets, title, headers) {
  const range = `${quoteSheetName(title)}!A1:${String.fromCharCode(64 + headers.length)}1`;
  const current = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const row = current.data.values?.[0] || [];
  const matches = headers.every((header, index) => row[index] === header);
  if (matches) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });
}

export async function ensureTenFreelySheets() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (!SPREADSHEET_ID) throw new Error("SPREADSHEET_ID is not configured");
      const sheets = await getSheetsClient();
      await ensureWorksheet(sheets, TEN_FREELY_RESULT_SHEET);
      await ensureWorksheet(sheets, TEN_FREELY_ROOM_SHEET);
      await ensureHeaders(sheets, TEN_FREELY_RESULT_SHEET, RESULT_HEADERS);
      await ensureHeaders(sheets, TEN_FREELY_ROOM_SHEET, ROOM_HEADERS);
      return sheets;
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}

function normalizeDigitLengths(value) {
  return [...new Set((Array.isArray(value) ? value : String(value || "").split(","))
    .map(Number)
    .filter((number) => [3, 4, 5].includes(number)))]
    .sort((a, b) => a - b);
}

export function buildTenFreelyConditionKey({ digitLengths, questionCount, lives }) {
  const digits = normalizeDigitLengths(digitLengths).join(",");
  return `digits=${digits}|questions=${questionCount}|lives=${Number(lives)}`;
}

export async function appendTenFreelySoloResult({ run, user, ruleVersion = 1 }) {
  if (!user?.userTrackingId || !user?.username) return null;
  const sheets = await ensureTenFreelySheets();
  const completed = ["completed", "all_problems_completed"].includes(run.finishReason);
  const conditionKey = buildTenFreelyConditionKey({
    digitLengths: run.settings.digitLengths,
    questionCount: run.settings.questionCount,
    lives: run.settings.lives,
  });
  const details = {
    history: run.history || [],
    maximumQuestions: run.settings.maximumQuestions,
    remainingLives: run.lives,
  };

  const values = [[
    "solo_result",
    run.id,
    user.userTrackingId,
    user.username,
    "solo",
    run.settings.digitLengths.join(","),
    conditionKey,
    String(run.settings.questionCount),
    run.settings.lives,
    run.solvedCount,
    run.totalAnswerTimeMs,
    run.averageTimeMs ?? "",
    completed ? "TRUE" : "FALSE",
    run.finishReason,
    JSON.stringify(details),
    new Date(run.finishedAt || Date.now()).toISOString(),
    ruleVersion,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${quoteSheetName(TEN_FREELY_RESULT_SHEET)}!A2:Q2`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  return { conditionKey };
}

function rowToResult(row = []) {
  return {
    recordType: String(row[0] || ""),
    runId: String(row[1] || ""),
    userTrackingId: String(row[2] || ""),
    username: String(row[3] || "ゲスト"),
    mode: String(row[4] || ""),
    digitLengths: String(row[5] || "").split(",").map(Number).filter(Number.isFinite),
    conditionKey: String(row[6] || ""),
    questionCount: String(row[7] || ""),
    initialLives: Number(row[8] || 0),
    solvedCount: Number(row[9] || 0),
    totalTimeMs: Number(row[10] || 0),
    averageTimeMs: row[11] === "" || row[11] == null ? null : Number(row[11]),
    completed: String(row[12] || "").toUpperCase() === "TRUE",
    finishReason: String(row[13] || ""),
    createdAt: String(row[15] || ""),
  };
}

export async function getTenFreelyRanking({ digitLengths, questionCount, lives, limit = 50 }) {
  const sheets = await ensureTenFreelySheets();
  const conditionKey = buildTenFreelyConditionKey({ digitLengths, questionCount, lives });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${quoteSheetName(TEN_FREELY_RESULT_SHEET)}!A2:Q`,
  });
  const infinite = String(questionCount) === "infinity";
  const rows = (response.data.values || [])
    .map(rowToResult)
    .filter((result) => result.recordType === "solo_result" && result.conditionKey === conditionKey)
    .filter((result) => infinite || result.completed);

  const bestByUser = new Map();
  for (const result of rows) {
    const previous = bestByUser.get(result.userTrackingId);
    const better = !previous || (infinite
      ? result.solvedCount > previous.solvedCount
        || (result.solvedCount === previous.solvedCount && (result.averageTimeMs ?? Infinity) < (previous.averageTimeMs ?? Infinity))
        || (result.solvedCount === previous.solvedCount && result.averageTimeMs === previous.averageTimeMs && result.totalTimeMs < previous.totalTimeMs)
      : result.totalTimeMs < previous.totalTimeMs);
    if (better) bestByUser.set(result.userTrackingId, result);
  }

  const ranking = [...bestByUser.values()].sort((a, b) => {
    if (infinite) {
      return b.solvedCount - a.solvedCount
        || (a.averageTimeMs ?? Infinity) - (b.averageTimeMs ?? Infinity)
        || a.totalTimeMs - b.totalTimeMs;
    }
    return a.totalTimeMs - b.totalTimeMs;
  }).slice(0, Math.max(1, Math.min(100, Number(limit) || 50)));

  return ranking.map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    userTrackingId: entry.userTrackingId,
    solvedCount: entry.solvedCount,
    totalTimeMs: entry.totalTimeMs,
    averageTimeMs: entry.averageTimeMs,
    createdAt: entry.createdAt,
  }));
}

function serializeRoom(room) {
  return {
    ...room,
    usedProblemsByLength: Object.fromEntries(
      [...room.usedProblemsByLength.entries()].map(([length, values]) => [String(length), [...values]]),
    ),
  };
}

export function hydrateTenFreelyRoom(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    usedProblemsByLength: new Map(
      Object.entries(raw.usedProblemsByLength || {}).map(([length, values]) => [Number(length), new Set(values || [])]),
    ),
  };
}

export async function upsertTenFreelyRoom(room) {
  const sheets = await ensureTenFreelySheets();
  const range = `${quoteSheetName(TEN_FREELY_ROOM_SHEET)}!A2:G`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = response.data.values || [];
  const index = rows.findIndex((row) => String(row[0] || "") === room.id);
  const values = [[
    room.id,
    JSON.stringify(room.members || []),
    room.status,
    String(room.expiresAt || 0),
    JSON.stringify(room.settings || {}),
    JSON.stringify(serializeRoom(room)),
    new Date(room.updatedAt || Date.now()).toISOString(),
  ]];

  if (index >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${quoteSheetName(TEN_FREELY_ROOM_SHEET)}!A${index + 2}:G${index + 2}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${quoteSheetName(TEN_FREELY_ROOM_SHEET)}!A2:G2`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  }
}

export async function findTenFreelyRoomById(roomId) {
  const sheets = await ensureTenFreelySheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${quoteSheetName(TEN_FREELY_ROOM_SHEET)}!A2:G`,
  });
  const row = (response.data.values || []).find((entry) => String(entry[0] || "") === String(roomId || ""));
  if (!row?.[5]) return null;
  try { return hydrateTenFreelyRoom(JSON.parse(row[5])); } catch { return null; }
}

export async function findActiveTenFreelyRoomByUser(userTrackingId) {
  const sheets = await ensureTenFreelySheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${quoteSheetName(TEN_FREELY_ROOM_SHEET)}!A2:G`,
  });
  const now = Date.now();
  const candidates = [];
  for (const row of response.data.values || []) {
    if (!["lobby", "playing", "round_result", "finished"].includes(String(row[2] || ""))) continue;
    if (Number(row[3] || 0) <= now || !row[5]) continue;
    try {
      const room = hydrateTenFreelyRoom(JSON.parse(row[5]));
      if (room?.members?.some((member) => member.id === userTrackingId)) candidates.push(room);
    } catch {}
  }
  return candidates.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] || null;
}
