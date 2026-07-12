import crypto from "node:crypto";
import { SPREADSHEET_ID } from "../../foundation/env.js";
import { getSheetsClient } from "../../foundation/sheets.js";

export const NO_HAND_SAFE_SHEET_NAME = "素手以外セーフ";

const HEADER = [
  "slot",
  "emoji",
  "comboKey",
  "codeKey",
  "codeJson",
  "codeHash",
  "source",
  "updatedAt",
];

const SLOT_ORDER = ["core", "motion", "trigger"];

function nowIso() {
  return new Date().toISOString();
}

export function hashCodeJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value || {})).digest("hex").slice(0, 16);
}

function parseJson(raw, fallback = null) {
  try {
    if (!raw) return fallback;
    return JSON.parse(String(raw));
  } catch {
    return fallback;
  }
}

function rowToEntry(row, index) {
  const [slot, emoji, comboKey, codeKey, codeJson, codeHash, source, updatedAt] = row;
  if (!slot || !emoji || !codeJson) return null;
  const code = parseJson(codeJson);
  if (!code) return null;
  return {
    rowIndex: index + 2,
    slot,
    emoji,
    comboKey: comboKey || "",
    codeKey: codeKey || `${slot}:${emoji}`,
    code,
    codeHash: codeHash || hashCodeJson(code),
    source: source || "",
    updatedAt: updatedAt || "",
  };
}

async function ensureHeaderRow(sheets) {
  const range = `${NO_HAND_SAFE_SHEET_NAME}!A1:H1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const row = res.data.values?.[0] || [];
  const isCurrent = HEADER.every((value, index) => row[index] === value);
  if (isCurrent) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [HEADER] },
  });
}

async function readRows(sheets) {
  await ensureHeaderRow(sheets);
  const range = `${NO_HAND_SAFE_SHEET_NAME}!A2:H`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  return res.data.values || [];
}

export async function readNoHandCodeEntries() {
  const sheets = await getSheetsClient();
  const rows = await readRows(sheets);
  return rows.map(rowToEntry).filter(Boolean);
}

export async function readNoHandCodeSlots(targets) {
  const entries = await readNoHandCodeEntries();
  const byKey = new Map(entries.map((entry) => [`${entry.slot}:${entry.emoji}`, entry]));
  const result = {};
  for (const target of targets) {
    const key = `${target.slot}:${target.emoji}`;
    const found = byKey.get(key);
    if (found) result[target.slot] = found;
  }
  return result;
}

export async function saveNoHandCodeSlots({ entries, comboKey = "", source = "gemini-code-toolbox" }) {
  const sheets = await getSheetsClient();
  const rows = await readRows(sheets);
  const existing = new Map();
  rows.forEach((row, index) => {
    const slot = row[0];
    const emoji = row[1];
    if (slot && emoji) existing.set(`${slot}:${emoji}`, index + 2);
  });

  await Promise.all(entries.map(async (entry) => {
    const slot = String(entry.slot || "");
    const emoji = String(entry.emoji || "");
    if (!SLOT_ORDER.includes(slot) || !emoji) throw new Error(`Invalid noHand code slot: ${slot}:${emoji}`);
    const code = entry.code || {};
    const codeKey = `${slot}:${emoji}`;
    const codeJson = JSON.stringify(code);
    const codeHash = hashCodeJson(code);
    const values = [[slot, emoji, comboKey, codeKey, codeJson, codeHash, source, nowIso()]];
    const rowIndex = existing.get(codeKey);
    if (rowIndex) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${NO_HAND_SAFE_SHEET_NAME}!A${rowIndex}:H${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${NO_HAND_SAFE_SHEET_NAME}!A2:H2`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    }
  }));
}
