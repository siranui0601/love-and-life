import { randomUUID, createHash } from "node:crypto";
import { getSheetsClient } from "../../foundation/sheets.js";
import { SPREADSHEET_ID, SHEET_NAME } from "../../foundation/env.js";

export const NOW_CODING_PROFILE_SHEET = "NowCoding_profiles";
export const NOW_CODING_PROGRAM_SHEET = "NowCoding_programs";
export const NOW_CODING_MATCH_SHEET = "NowCoding_matches";
export const NOW_CODING_REPLAY_SHEET = "NowCoding_replays";

const PROFILE_SCHEMA_VERSION = 1;
const PROGRAM_VERSION = 1;
const RULE_VERSION = "territory-v1";

function parseJson(value, fallback) {
  try {
    if (value === undefined || value === null || value === "") return fallback;
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function asBoolean(value) {
  return value === true || String(value).toUpperCase() === "TRUE";
}

function isoNow() {
  return new Date().toISOString();
}

async function readRows(sheetName, endColumn) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:${endColumn}`,
  });
  return { sheets, rows: response.data.values || [] };
}

export async function resolveNowCodingUser(userTrackingId) {
  const trackingId = String(userTrackingId || "").trim();
  if (!trackingId) return null;

  const { rows } = await readRows(SHEET_NAME, "D");
  for (const row of rows) {
    if (String(row?.[3] || "") === trackingId) {
      return {
        identity: String(row?.[0] || ""),
        username: String(row?.[1] || ""),
        displayName: String(row?.[2] || ""),
        userTrackingId: trackingId,
      };
    }
  }
  return null;
}

export async function getNowCodingProfile(userTrackingId) {
  const trackingId = String(userTrackingId || "").trim();
  const { rows } = await readRows(NOW_CODING_PROFILE_SHEET, "H");
  const row = rows.find((entry) => String(entry?.[0] || "") === trackingId);
  if (!row) {
    return {
      userTrackingId: trackingId,
      usernameSnapshot: "",
      tutorialStep: 0,
      tutorialDone: false,
      prefs: {},
      schemaVersion: PROFILE_SCHEMA_VERSION,
    };
  }
  return {
    userTrackingId: String(row[0] || ""),
    usernameSnapshot: String(row[1] || ""),
    tutorialStep: Number(row[2] || 0),
    tutorialDone: asBoolean(row[3]),
    prefs: parseJson(row[4], {}),
    createdAt: String(row[5] || ""),
    updatedAt: String(row[6] || ""),
    schemaVersion: Number(row[7] || PROFILE_SCHEMA_VERSION),
  };
}

export async function upsertNowCodingProfile({
  userTrackingId,
  usernameSnapshot = "",
  tutorialStep = 0,
  tutorialDone = false,
  prefs = {},
}) {
  const trackingId = String(userTrackingId || "").trim();
  const { sheets, rows } = await readRows(NOW_CODING_PROFILE_SHEET, "H");
  const index = rows.findIndex((entry) => String(entry?.[0] || "") === trackingId);
  const now = isoNow();
  const existing = index >= 0 ? rows[index] : null;
  const values = [[
    trackingId,
    String(usernameSnapshot || existing?.[1] || ""),
    Math.max(0, Number(tutorialStep || 0)),
    Boolean(tutorialDone),
    JSON.stringify(prefs && typeof prefs === "object" ? prefs : {}),
    String(existing?.[5] || now),
    now,
    PROFILE_SCHEMA_VERSION,
  ]];

  if (index >= 0) {
    const rowNumber = index + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOW_CODING_PROFILE_SHEET}!A${rowNumber}:H${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOW_CODING_PROFILE_SHEET}!A2:H2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
  }

  return getNowCodingProfile(trackingId);
}

function programFromRow(row = []) {
  return {
    programId: String(row[0] || ""),
    userTrackingId: String(row[1] || ""),
    name: String(row[2] || "無題の駒"),
    blocks: parseJson(row[3], []),
    createdAt: String(row[4] || ""),
    updatedAt: String(row[5] || ""),
    version: Number(row[6] || PROGRAM_VERSION),
    archived: asBoolean(row[7]),
    lastUsedAt: String(row[8] || ""),
    notes: String(row[9] || ""),
  };
}

export async function listNowCodingPrograms(userTrackingId) {
  const trackingId = String(userTrackingId || "").trim();
  const { rows } = await readRows(NOW_CODING_PROGRAM_SHEET, "J");
  return rows
    .map(programFromRow)
    .filter((program) => program.userTrackingId === trackingId && !program.archived)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function saveNowCodingProgram({
  userTrackingId,
  programId = "",
  name = "無題の駒",
  blocks = [],
  notes = "",
}) {
  const trackingId = String(userTrackingId || "").trim();
  const safeBlocks = Array.isArray(blocks) ? blocks.slice(0, 10000) : [];
  const serialized = JSON.stringify(safeBlocks);
  if (serialized.length > 45000) throw new Error("program_too_large");

  const { sheets, rows } = await readRows(NOW_CODING_PROGRAM_SHEET, "J");
  const requestedId = String(programId || "").trim();
  const index = requestedId
    ? rows.findIndex((row) => String(row?.[0] || "") === requestedId && String(row?.[1] || "") === trackingId)
    : -1;
  const existing = index >= 0 ? programFromRow(rows[index]) : null;
  const id = existing?.programId || requestedId || randomUUID();
  const now = isoNow();
  const values = [[
    id,
    trackingId,
    String(name || "無題の駒").trim().slice(0, 60) || "無題の駒",
    serialized,
    existing?.createdAt || now,
    now,
    existing ? existing.version + 1 : PROGRAM_VERSION,
    false,
    existing?.lastUsedAt || "",
    String(notes || "").slice(0, 500),
  ]];

  if (index >= 0) {
    const rowNumber = index + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOW_CODING_PROGRAM_SHEET}!A${rowNumber}:J${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOW_CODING_PROGRAM_SHEET}!A2:J2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
  }

  return programFromRow(values[0]);
}

export async function archiveNowCodingProgram({ userTrackingId, programId }) {
  const trackingId = String(userTrackingId || "").trim();
  const id = String(programId || "").trim();
  const { sheets, rows } = await readRows(NOW_CODING_PROGRAM_SHEET, "J");
  const index = rows.findIndex((row) => String(row?.[0] || "") === id && String(row?.[1] || "") === trackingId);
  if (index < 0) return false;
  const rowNumber = index + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${NOW_CODING_PROGRAM_SHEET}!H${rowNumber}:I${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[true, isoNow()]] },
  });
  return true;
}

function matchFromRow(row = []) {
  return {
    matchId: String(row[0] || ""),
    mode: String(row[1] || "territory"),
    seed: String(row[2] || ""),
    settings: parseJson(row[3], {}),
    participants: parseJson(row[4], []),
    results: parseJson(row[5], []),
    winnerTrackingIds: parseJson(row[6], []),
    createdAt: String(row[7] || ""),
    ruleVersion: String(row[8] || RULE_VERSION),
    replayId: String(row[9] || ""),
    durationTicks: Number(row[10] || 0),
    finishReason: String(row[11] || ""),
  };
}

export async function listNowCodingMatches(userTrackingId, limit = 20) {
  const trackingId = String(userTrackingId || "").trim();
  const { rows } = await readRows(NOW_CODING_MATCH_SHEET, "L");
  return rows
    .map(matchFromRow)
    .filter((match) => match.participants.some((participant) => String(participant?.userTrackingId || "") === trackingId))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, Math.min(Math.max(Number(limit) || 20, 1), 100));
}

export async function saveNowCodingMatch({
  mode = "territory",
  seed,
  settings = {},
  participants = [],
  results = [],
  programs = [],
  spawn = [],
  durationTicks = 0,
  finishReason = "tick_limit",
  ruleVersion = RULE_VERSION,
}) {
  const sheets = await getSheetsClient();
  const matchId = randomUUID();
  const replayId = randomUUID();
  const createdAt = isoNow();
  const winners = results
    .filter((result) => result?.rank === 1 && result?.userTrackingId)
    .map((result) => String(result.userTrackingId));
  const ownerIds = [...new Set(participants.map((participant) => String(participant?.userTrackingId || "")).filter(Boolean))];
  const replayCore = {
    replayId,
    matchId,
    mode,
    seed: String(seed || ""),
    settings,
    programs,
    spawn,
    result: results,
    ruleVersion,
  };
  const checksum = createHash("sha256").update(JSON.stringify(replayCore)).digest("hex");

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${NOW_CODING_REPLAY_SHEET}!A2:L2`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        replayId,
        matchId,
        String(mode),
        String(seed || ""),
        JSON.stringify(settings),
        JSON.stringify(programs),
        JSON.stringify(spawn),
        JSON.stringify(results),
        createdAt,
        String(ruleVersion),
        JSON.stringify(ownerIds),
        checksum,
      ]],
    },
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${NOW_CODING_MATCH_SHEET}!A2:L2`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        matchId,
        String(mode),
        String(seed || ""),
        JSON.stringify(settings),
        JSON.stringify(participants),
        JSON.stringify(results),
        JSON.stringify(winners),
        createdAt,
        String(ruleVersion),
        replayId,
        Math.max(0, Number(durationTicks || 0)),
        String(finishReason || ""),
      ]],
    },
  });

  return { matchId, replayId, checksum, createdAt };
}

export async function getNowCodingReplay({ replayId, userTrackingId }) {
  const id = String(replayId || "").trim();
  const trackingId = String(userTrackingId || "").trim();
  const { rows } = await readRows(NOW_CODING_REPLAY_SHEET, "L");
  const row = rows.find((entry) => String(entry?.[0] || "") === id);
  if (!row) return null;
  const owners = parseJson(row[10], []);
  if (!owners.includes(trackingId)) return null;
  return {
    replayId: String(row[0] || ""),
    matchId: String(row[1] || ""),
    mode: String(row[2] || "territory"),
    seed: String(row[3] || ""),
    settings: parseJson(row[4], {}),
    programs: parseJson(row[5], []),
    spawn: parseJson(row[6], []),
    result: parseJson(row[7], []),
    createdAt: String(row[8] || ""),
    ruleVersion: String(row[9] || RULE_VERSION),
    ownerTrackingIds: owners,
    checksum: String(row[11] || ""),
  };
}
