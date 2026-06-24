import { google } from "googleapis";
import { randomInt } from "node:crypto";
import { serviceAccount, SPREADSHEET_ID, SHEET_NAME } from "./env.js";

export const BUNGEI_SHEET_NAME = "時々文芸部！";
export const SECRET_TOOL_SHEET_NAME = "ひみつ道具";
export const ORIGIN_MAGIC_CIRCLE_SHEET_NAME = "オリジン魔法陣";
export const HUNDRED_ORE_CACHE_SHEET_NAME = "100俺_cache";
export const HUNDRED_ORE_RUNS_SHEET_NAME = "100俺_runs";
export const NO_HAND_SOCCER_SHEET_NAME = "素手以外セーフ";
const SECRET_TOOL_MAX_MEMBERS = 4;
const ORIGIN_MAGIC_CIRCLE_MAX_MEMBERS = 2;

const ORIGIN_MAGIC_CIRCLE_MAX_HP = 1000;

function safeParseJson(raw, fallback = null) {
  try {
    if (raw === undefined || raw === null || raw === "") return fallback;
    return JSON.parse(String(raw));
  } catch {
    return fallback;
  }
}

export async function getSheetsClient() {
  if (!serviceAccount) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません");

  const auth = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

// email からユーザーを探す
export async function findUserByEmail(email) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:D`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  for (const row of rows) {
    const [rowEmail, username, displayName, userTrackingId] = row;
    if (rowEmail === email) return { email: rowEmail, username, displayName, userTrackingId };
  }
  return null;
}

export async function findUserByUsername(username) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:D`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  for (const row of rows) {
    const [rowA, storedUsername, displayName, userTrackingId] = row;
    if (storedUsername === username) {
      return {
        identity: rowA,
        username: storedUsername,
        displayName,
        userTrackingId,
      };
    }
  }
  return null;
}

export async function findUserByIdentity({ email = "", username = "" } = {}) {
  const trimmedEmail = String(email || "").trim();
  const trimmedUsername = String(username || "").trim();
  if (!trimmedEmail && !trimmedUsername) return null;

  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:D`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];

  for (const row of rows) {
    const [rowA, rowUsername, displayName, userTrackingId] = row;
    if ((trimmedEmail && rowA === trimmedEmail) || (trimmedUsername && rowUsername === trimmedUsername)) {
      return {
        identity: rowA,
        username: rowUsername,
        displayName,
        userTrackingId,
      };
    }
  }

  return null;
}

export async function findUserByUsernameAndPassword(username, password) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:D`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  for (const row of rows) {
    const [storedPassword, storedUsername, displayName, userTrackingId] = row;
    if (storedUsername === username && storedPassword === password) {
      return { username: storedUsername, displayName, userTrackingId };
    }
  }
  return null;
}

function generateUserTrackingId() {
  const timestampPart = Date.now().toString(36);
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 8; i += 1) {
    randomPart += chars[randomInt(chars.length)];
  }
  return `${timestampPart}${randomPart}`;
}

// 新規ユーザー追加
export async function addUser({ email, username, displayName }) {
  const sheets = await getSheetsClient();
  const userTrackingId = generateUserTrackingId();
  const range = `${SHEET_NAME}!A2:D2`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[email, username, displayName, userTrackingId]] },
  });
  return { email, username, displayName, userTrackingId };
}

export async function addCredentialUser({ username, password }) {
  const sheets = await getSheetsClient();
  const userTrackingId = generateUserTrackingId();
  const range = `${SHEET_NAME}!A2:D2`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[password, username, "", userTrackingId]] },
  });
  return { username, userTrackingId };
}

export async function updateUsernameByIdentity({ email, currentUsername, nextUsername }) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:C`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];

  let targetRowIndex = null;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const rowA = row[0] || "";
    const rowUsername = row[1] || "";
    if ((email && rowA === email) || (currentUsername && rowUsername === currentUsername)) {
      targetRowIndex = i + 2;
      break;
    }
  }

  if (!targetRowIndex) {
    return null;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!B${targetRowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[nextUsername]] },
  });

  return { rowIndex: targetRowIndex, username: nextUsername };
}

export async function findBungeiEntryByOrder(orderList) {
  const sheets = await getSheetsClient();
  const range = `${BUNGEI_SHEET_NAME}!A2:D`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  const orderKey = JSON.stringify(orderList);
  for (let i = 0; i < rows.length; i += 1) {
    const [storedOrder, output, players, epilogue] = rows[i];
    if (storedOrder === orderKey) {
      return {
        rowIndex: i + 2,
        output,
        players,
        epilogue,
      };
    }
  }
  return null;
}

export async function appendBungeiEntry({ orderList, output, players, epilogue = "" }) {
  const sheets = await getSheetsClient();
  const range = `${BUNGEI_SHEET_NAME}!A2:D2`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[JSON.stringify(orderList), output, JSON.stringify(players), epilogue]],
    },
  });
}

export async function appendNoHandSoccerGimmick({ emojis, gimmick, source = "gemini" }) {
  const sheets = await getSheetsClient();
  const range = `${NO_HAND_SOCCER_SHEET_NAME}!A2:H2`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "絵文字の組み合わせ",
        Array.isArray(emojis) ? emojis.join(" ") : String(emojis || ""),
        gimmick?.name || "",
        gimmick?.visualLabel || "",
        gimmick?.shortEffect || "",
        gimmick?.flavor || "",
        JSON.stringify(gimmick || {}),
        source,
      ]],
    },
  });
}

export async function updateBungeiPlayers(rowIndex, players) {
  const sheets = await getSheetsClient();
  const range = `${BUNGEI_SHEET_NAME}!C${rowIndex}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[JSON.stringify(players)]] },
  });
}

export async function updateBungeiEpilogue(rowIndex, epilogue) {
  const sheets = await getSheetsClient();
  const range = `${BUNGEI_SHEET_NAME}!D${rowIndex}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[epilogue]] },
  });
}

function parseSecretMembersJson(raw) {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        const hp = Number(entry?.hp);

        return {
          name: String(entry?.name || "guest"),
          id: String(entry?.id || ""),
          role: String(entry?.role || "guest"),
          hp: Number.isFinite(hp) ? Math.max(0, hp) : 1000,
        };
      })
      .filter((entry) => entry.id);
  } catch {
    return [];
  }
}
