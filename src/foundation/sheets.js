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

export async function listBungeiLinesForPlayer(playerName, speechOrder = []) {
  const sheets = await getSheetsClient();
  const ranges = [
    `${BUNGEI_SHEET_NAME}!A1:A100`,
    `${BUNGEI_SHEET_NAME}!C1:C100`,
  ];
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
  });
  const [orderRange, playersRange] = res.data.valueRanges || [];
  const orderValues = orderRange?.values || [];
  const playerValues = playersRange?.values || [];
  const maxRows = Math.max(orderValues.length, playerValues.length);
  const lines = new Set();
  const normalizedSpeechOrder = speechOrder.map((line) => String(line ?? "").trim());

  for (let index = 1; index < maxRows; index += 1) {
    const storedOrder = orderValues[index]?.[0];
    const players = playerValues[index]?.[0];
    if (!storedOrder || !players) continue;
    let playerList = [];
    try {
      playerList = JSON.parse(players);
    } catch {
      playerList = [];
    }
    if (!Array.isArray(playerList) || !playerList.includes(playerName)) continue;
    try {
      const orderList = JSON.parse(storedOrder);
      if (!Array.isArray(orderList)) continue;
      const normalizedOrderList = orderList.map((line) => String(line ?? "").trim());
      if (normalizedOrderList.length !== normalizedSpeechOrder.length + 1) continue;
      const matchesPrefix = normalizedSpeechOrder.every(
        (line, index) => line === normalizedOrderList[index]
      );
      if (!matchesPrefix) continue;
      const nextLine = normalizedOrderList[normalizedSpeechOrder.length];
      if (nextLine) {
        lines.add(nextLine);
      }
    } catch {
      // ignore invalid rows
    }
  }

  return Array.from(lines);
}

export { SPREADSHEET_ID, SHEET_NAME };
