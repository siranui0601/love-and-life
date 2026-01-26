import { google } from "googleapis";
import { serviceAccount, SPREADSHEET_ID, SHEET_NAME } from "./env.js";

export const BUNGEI_SHEET_NAME = "時々文芸部！";

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
  const range = `${SHEET_NAME}!A2:C`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  for (const row of rows) {
    const [rowEmail, username, displayName] = row;
    if (rowEmail === email) return { email: rowEmail, username, displayName };
  }
  return null;
}

// 新規ユーザー追加
export async function addUser({ email, username, displayName }) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:C2`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[email, username, displayName]] },
  });
  return { email, username, displayName };
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

// ====== 時々文芸部：options用の高速キャッシュ ======
const BUNGEI_CACHE_TTL_MS = 30_000; // 30秒（必要なら調整）
let bungeiCache = {
  fetchedAt: 0,
  rows: null, // [{ storedOrder: string, players: string }]
};

async function loadBungeiRowsChunked() {
  const sheets = await getSheetsClient();
  const rows = [];
  const CHUNK = 200; // 100でもOK。API回数減らしたいなら200が良い
  let start = 2;

  while (true) {
    const end = start + CHUNK - 1;
    const range = `${BUNGEI_SHEET_NAME}!A${start}:C${end}`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const values = res.data.values || [];
    if (!values.length) break;

    for (const row of values) {
      const storedOrder = row?.[0] ?? "";
      const players = row?.[2] ?? ""; // A..Cなので index 2 が C列
      rows.push({ storedOrder, players });
    }

    // 取得した最後の行が空っぽっぽいなら終了（追加読み不要）
    const last = values[values.length - 1] || [];
    const lastA = String(last?.[0] ?? "").trim();
    const lastC = String(last?.[2] ?? "").trim();
    if (!lastA && !lastC) break;

    // CHUNKより少なければ末尾まで来た可能性が高い
    if (values.length < CHUNK) break;

    start += CHUNK;
  }

  return rows;
}

async function getBungeiRowsCached({ force = false } = {}) {
  const now = Date.now();
  if (!force && bungeiCache.rows && now - bungeiCache.fetchedAt < BUNGEI_CACHE_TTL_MS) {
    return bungeiCache.rows;
  }
  const rows = await loadBungeiRowsChunked();
  bungeiCache = { fetchedAt: now, rows };
  return rows;
}

function computeNextLinesFromRows(playerName, speechOrder, rows) {
  const lines = new Set();
  const normalizedSpeechOrder = (speechOrder || []).map((v) => String(v ?? "").trim());

  for (let i = 0; i < rows.length; i += 1) {
    const storedOrder = rows[i].storedOrder;
    const playersRaw = rows[i].players;
    if (!storedOrder || !playersRaw) continue;

    let playerList = [];
    try {
      playerList = JSON.parse(playersRaw);
    } catch {
      playerList = [];
    }
    if (!Array.isArray(playerList) || !playerList.includes(playerName)) continue;

    try {
      const orderList = JSON.parse(storedOrder);
      if (!Array.isArray(orderList)) continue;

      const normalizedOrderList = orderList.map((v) => String(v ?? "").trim());
      if (normalizedOrderList.length !== normalizedSpeechOrder.length + 1) continue;

      const ok = normalizedSpeechOrder.every((line, idx) => line === normalizedOrderList[idx]);
      if (!ok) continue;

      const nextLine = normalizedOrderList[normalizedSpeechOrder.length];
      if (nextLine) lines.add(nextLine);
    } catch {
      // ignore
    }
  }

  return Array.from(lines);
}

// 既存の listBungeiLinesForPlayer を置き換え
export async function listBungeiLinesForPlayer(playerName, speechOrder = []) {
  const rows = await getBungeiRowsCached();
  return computeNextLinesFromRows(playerName, speechOrder, rows);
}

export { SPREADSHEET_ID, SHEET_NAME };
