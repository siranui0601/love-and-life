import { google } from "googleapis";
import { randomInt } from "node:crypto";
import { serviceAccount, SPREADSHEET_ID, SHEET_NAME } from "./env.js";

export const BUNGEI_SHEET_NAME = "時々文芸部！";
export const SECRET_TOOL_SHEET_NAME = "ひみつ道具";
export const ORIGIN_MAGIC_CIRCLE_SHEET_NAME = "オリジン魔法陣";
const SECRET_TOOL_MAX_MEMBERS = 4;
const ORIGIN_MAGIC_CIRCLE_MAX_MEMBERS = 2;



const ORIGIN_MAGIC_CIRCLE_MAX_HP = 100;




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

function roomExpiresAtMs() {
  return Date.now() + 30 * 60 * 1000;
}

async function getSecretToolRows(sheets) {
  const range = `${SECRET_TOOL_SHEET_NAME}!A2:D`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  return res.data.values || [];
}

function secretRowToRoom(row = [], index = 0) {
  const roomId = String(row[0] || "").trim();
  const members = parseSecretMembersJson(row[1]).map((m) => ({ ...m, hp: Number.isFinite(Number(m?.hp)) ? Number(m.hp) : 1000 }));
  const status = String(row[2] || "").trim();
  const expiresAt = Number(row[3] || 0);
  return {
    rowIndex: index + 2,
    roomId,
    members,
    status,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
  };
}

function buildSecretToolRoomId() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

async function updateSecretToolRoomRow(rowIndex, values) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SECRET_TOOL_SHEET_NAME}!A${rowIndex}:D${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

export async function createSecretToolRoom({ username, clientId }) {
  const sheets = await getSheetsClient();
  const rows = await getSecretToolRows(sheets);
  const usedRoomIds = new Set(rows.map((row) => String(row?.[0] || "").trim()).filter(Boolean));

  let roomId = "";
  for (let i = 0; i < 30; i += 1) {
    const candidate = buildSecretToolRoomId();
    if (!usedRoomIds.has(candidate)) {
      roomId = candidate;
      break;
    }
  }

  if (!roomId) {
    throw new Error("room_create_failed");
  }

  const members = [{ name: username, id: clientId, role: "host", hp: 1000 }];
  const status = "lobby";
  const expiresAt = roomExpiresAtMs();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SECRET_TOOL_SHEET_NAME}!A2:D2`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[roomId, JSON.stringify(members), status, String(expiresAt)]],
    },
  });

  return { roomId, members, status, expiresAt };
}

export async function getSecretToolRoomById(roomId) {
  const sheets = await getSheetsClient();
  const rows = await getSecretToolRows(sheets);
  const normalizedRoomId = String(roomId || "").trim();
  const rowIndex = rows.findIndex((row) => String(row?.[0] || "").trim() === normalizedRoomId);
  if (rowIndex < 0) return null;
  return secretRowToRoom(rows[rowIndex], rowIndex);
}

export async function joinSecretToolRoom({ roomId, username, clientId }) {
  const room = await getSecretToolRoomById(roomId);
  if (!room) throw new Error("room_not_found");
  if (room.status !== "lobby") throw new Error("room_not_lobby");

  const members = [...room.members];
  let joined = false;
  const existingIndex = members.findIndex((member) => member.id === clientId);
  if (existingIndex >= 0) {
    members[existingIndex] = { ...members[existingIndex], name: username, hp: Number.isFinite(Number(members[existingIndex].hp)) ? Number(members[existingIndex].hp) : 1000 };
  } else {
    if (members.length >= SECRET_TOOL_MAX_MEMBERS) {
      throw new Error("room_full");
    }
    members.push({ name: username, id: clientId, role: "guest", hp: 1000 });
    joined = true;
  }

  await updateSecretToolRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(members),
    room.status,
    String(room.expiresAt || roomExpiresAtMs()),
  ]);

  return {
    roomId: room.roomId,
    members,
    status: room.status,
    expiresAt: room.expiresAt,
    joined,
  };
}

export async function updateSecretToolRoomStatus({ roomId, status }) {
  const room = await getSecretToolRoomById(roomId);
  if (!room) throw new Error("room_not_found");

  await updateSecretToolRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(room.members || []),
    String(status || "").trim(),
    String(room.expiresAt || roomExpiresAtMs()),
  ]);

  return {
    ...room,
    status: String(status || "").trim(),
  };
}

export async function deleteSecretToolRoom({ roomId, hostClientId }) {
  const room = await getSecretToolRoomById(roomId);
  if (!room) throw new Error("room_not_found");
  if (room.status !== "lobby") throw new Error("room_not_lobby");

  const host = room.members.find((member) => member.role === "host");
  if (!host || host.id !== hostClientId) throw new Error("forbidden");

  await updateSecretToolRoomRow(room.rowIndex, ["", "", "", ""]);
  return { roomId: room.roomId, members: [], status: "closed", expiresAt: 0 };
}

export async function removeSecretToolMember({ roomId, clientId }) {
  const room = await getSecretToolRoomById(roomId);
  if (!room || room.status !== "lobby") return null;

  const members = room.members.filter((member) => member.id !== clientId);
  if (!members.length) {
    await updateSecretToolRoomRow(room.rowIndex, ["", "", "", ""]);
    return { roomId: room.roomId, members: [], status: "closed", expiresAt: 0 };
  }

  if (!members.some((member) => member.role === "host")) {
    members[0].role = "host";
  }

  await updateSecretToolRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(members),
    room.status,
    String(room.expiresAt || roomExpiresAtMs()),
  ]);

  return {
    roomId: room.roomId,
    members,
    status: room.status,
    expiresAt: room.expiresAt,
  };
}

export async function cleanupExpiredSecretToolRooms() {
  const sheets = await getSheetsClient();
  const rows = await getSecretToolRows(sheets);
  const now = Date.now();
  const targets = rows
    .map((row, index) => secretRowToRoom(row, index))
    .filter((room) => room.roomId && room.status === "lobby" && room.expiresAt > 0 && room.expiresAt < now);

  if (!targets.length) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: targets.map((room) => ({
        range: `${SECRET_TOOL_SHEET_NAME}!A${room.rowIndex}:D${room.rowIndex}`,
        values: [["", "", "", ""]],
      })),
    },
  });

  return targets.length;
}

async function getOriginMagicCircleRows(sheets) {
  const range = `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!A2:E`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  return res.data.values || [];
}

function parseOriginMagicCircleCastLogsJson(raw) {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => ({
        id: String(entry?.id || ""),
        at: Number(entry?.at) || 0,
        casterId: String(entry?.casterId || ""),
        casterName: String(entry?.casterName || "unknown"),
        spellHash: String(entry?.spellHash || "").trim(),
        strokeJson: String(entry?.strokeJson || ""),
      }))
      .filter((entry) => entry.id && entry.casterId && entry.spellHash);
  } catch {
    return [];
  }
}




function normalizeOriginMagicCircleHp(value) {
  const hp = Number(value);
  if (!Number.isFinite(hp)) return ORIGIN_MAGIC_CIRCLE_MAX_HP;
  return Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, hp));
}

function normalizeOriginMagicCircleMember(member) {
  return {
    ...member,
    hp: normalizeOriginMagicCircleHp(member?.hp),
  };
}





function originMagicCircleRowToRoom(row = [], index = 0) {
  const roomId = String(row[0] || "").trim();
  const members = parseSecretMembersJson(row[1]).map(normalizeOriginMagicCircleMember);
  const status = String(row[2] || "").trim();
  const expiresAt = Number(row[3] || 0);
  const castLogs = parseOriginMagicCircleCastLogsJson(row[4]);

  return {
    rowIndex: index + 2,
    roomId,
    members,
    status,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
    castLogs,
  };
}

async function updateOriginMagicCircleRoomRow(rowIndex, values) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!A${rowIndex}:D${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}


async function clearOriginMagicCircleRoomRow(rowIndex) {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!A${rowIndex}:E${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["", "", "", "", ""]],
    },
  });
}




function buildOriginMagicCircleRoomId() {
  return String(randomInt(100000, 1000000));
}




export async function createOriginMagicCircleRoom({ username, clientId }) {
  const sheets = await getSheetsClient();
  const rows = await getOriginMagicCircleRows(sheets);
  const usedRoomIds = new Set(rows.map((row) => String(row?.[0] || "").trim()).filter(Boolean));

  let roomId = "";
  for (let i = 0; i < 30; i += 1) {
    const candidate = buildOriginMagicCircleRoomId();
        if (!usedRoomIds.has(candidate)) {
      roomId = candidate;
      break;
    }
  }
  if (!roomId) throw new Error("room_create_failed");

  const members = [{ name: username, id: clientId, role: "host", hp: ORIGIN_MAGIC_CIRCLE_MAX_HP }];

  const status = "lobby";
  const expiresAt = originMagicCircleExpiresAtMs();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!A2:D2`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[roomId, JSON.stringify(members), status, String(expiresAt)]],
    },
  });

  return { roomId, members, status, expiresAt };
}

export async function getOriginMagicCircleRoomById(roomId) {
  const sheets = await getSheetsClient();
  const rows = await getOriginMagicCircleRows(sheets);
  const normalizedRoomId = String(roomId || "").trim();
  const rowIndex = rows.findIndex((row) => String(row?.[0] || "").trim() === normalizedRoomId);
  if (rowIndex < 0) return null;
  return originMagicCircleRowToRoom(rows[rowIndex], rowIndex);
}

export async function joinOriginMagicCircleRoom({ roomId, username, clientId }) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");
  if (room.status !== "lobby") throw new Error("room_not_lobby");

  const members = [...room.members];
  const existingIndex = members.findIndex((member) => member.id === clientId);
  if (existingIndex >= 0) {
    members[existingIndex] = {
  ...members[existingIndex],
  name: username,
  hp: normalizeOriginMagicCircleHp(members[existingIndex].hp),
};
  } else {
    if (members.length >= ORIGIN_MAGIC_CIRCLE_MAX_MEMBERS) throw new Error("room_full");
    members.push({
  name: username,
  id: clientId,
  role: "guest",
  hp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
});
  }

  await updateOriginMagicCircleRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(members),
    room.status,
    String(room.expiresAt || roomExpiresAtMs()),
  ]);

  return {
    roomId: room.roomId,
    members,
    status: room.status,
    expiresAt: room.expiresAt,
  };
}

export async function updateOriginMagicCircleRoomStatus({ roomId, status, requestedByClientId = "" }) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");

  const normalizedStatus = String(status || "").trim();
  if (!normalizedStatus) throw new Error("invalid_status");

  if (requestedByClientId) {
    const host = room.members.find((member) => member.role === "host");
    if (!host || host.id !== requestedByClientId) throw new Error("forbidden");
  }

  await updateOriginMagicCircleRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(room.members || []),
    normalizedStatus,
    String(room.expiresAt || roomExpiresAtMs()),
  ]);

  return {
    roomId: room.roomId,
    members: room.members,
    status: normalizedStatus,
    expiresAt: room.expiresAt,
  };
}

export async function deleteOriginMagicCircleRoom({ roomId, hostClientId }) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");
  if (room.status !== "lobby") throw new Error("room_not_lobby");

  const host = room.members.find((member) => member.role === "host");
  if (!host || host.id !== hostClientId) throw new Error("forbidden");

  await updateOriginMagicCircleRoomRow(room.rowIndex, ["", "", "", ""]);
  return { roomId: room.roomId, members: [], status: "closed", expiresAt: 0 };
}

export async function removeOriginMagicCircleMember({ roomId, clientId }) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room || room.status !== "lobby") return null;

  const members = room.members.filter((member) => member.id !== clientId);
  if (!members.length) {
  await clearOriginMagicCircleRoomRow(room.rowIndex);
  return { roomId: room.roomId, members: [], status: "closed", expiresAt: 0, castLogs: [] };
}

  if (!members.some((member) => member.role === "host")) {
    members[0].role = "host";
  }

  await updateOriginMagicCircleRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(members),
    room.status,
    String(room.expiresAt || roomExpiresAtMs()),
  ]);

  return {
    roomId: room.roomId,
    members,
    status: room.status,
    expiresAt: room.expiresAt,
  };
}





const ORIGIN_MAGIC_CIRCLE_ACTIVE_MS = 60 * 60 * 1000;

function originMagicCircleExpiresAtMs(baseMs = Date.now()) {
  return Number(baseMs) + ORIGIN_MAGIC_CIRCLE_ACTIVE_MS;
}

export async function touchOriginMagicCircleRoomExpiresAt({ roomId, baseMs = Date.now() }) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");

  const expiresAt = originMagicCircleExpiresAtMs(baseMs);

  await updateOriginMagicCircleRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(room.members || []),
    room.status,
    String(expiresAt),
  ]);

  return {
    ...room,
    expiresAt,
  };
}

export async function cleanupExpiredOriginMagicCircleRooms() {
  const sheets = await getSheetsClient();
  const rows = await getOriginMagicCircleRows(sheets);
  const now = Date.now();

  const targets = rows
    .map((row, index) => originMagicCircleRowToRoom(row, index))
    .filter((room) => room.roomId && room.expiresAt > 0 && room.expiresAt < now);

  if (!targets.length) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: targets.map((room) => ({
        range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!A${room.rowIndex}:E${room.rowIndex}`,
        values: [["", "", "", "", ""]],
      })),
    },
  });

  return targets.length;
}




export async function updateOriginMagicCircleRoomHp({ roomId, clientId, selfHp, enemyHp }) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");
  const members = [...(room.members || [])];
  const meIndex = members.findIndex((member) => member.id === clientId);
  if (meIndex < 0) throw new Error("forbidden");
  const enemyIndex = members.findIndex((member) => member.id !== clientId);
  members[meIndex] = { ...members[meIndex], hp: Math.max(0, Number(selfHp) || 0) };
  if (enemyIndex >= 0 && Number.isFinite(Number(enemyHp))) {
    members[enemyIndex] = { ...members[enemyIndex], hp: Math.max(0, Number(enemyHp) || 0) };
  }
  await updateOriginMagicCircleRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(members),
    room.status,
    String(room.expiresAt || roomExpiresAtMs()),
  ]);
  return { ...room, members };
}





export async function appendOriginMagicCircleRoomCastLog({
  roomId,
  castId,
  at,
  casterId,
  casterName,
  spellHash,
  strokeJson = "",
}) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");

  const safeSpellHash = String(spellHash || "").trim();
  if (!safeSpellHash) throw new Error("spellHash is required");

  const nextLog = {
    id: String(castId || `${Date.now()}_${Math.random()}`),
    at: Number(at) || Date.now(),
    casterId: String(casterId || ""),
    casterName: String(casterName || "unknown"),
    spellHash: safeSpellHash,
    strokeJson: String(strokeJson || ""),
  };

  const logs = Array.isArray(room.castLogs) ? [...room.castLogs] : [];

  if (!logs.some((log) => log.id === nextLog.id)) {
    logs.push(nextLog);
  }

  logs.sort((a, b) => Number(a.at || 0) - Number(b.at || 0));

  const trimmedLogs = logs.slice(-80);

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!E${room.rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[JSON.stringify(trimmedLogs)]],
    },
  });

  return {
    ...room,
    castLogs: trimmedLogs,
  };
}





async function findNextOriginMagicCircleSpellCacheRowIndex(sheets) {
  const range = `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!G2:G`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows = res.data.values || [];

  for (let i = 0; i < rows.length; i += 1) {
    const imageHash = String(rows[i]?.[0] || "").trim();

    if (!imageHash) {
      return i + 2;
    }
  }

  return rows.length + 2;
}




export async function findOriginMagicCircleSpellCachesByHashes(imageHashes = []) {
  const keys = [...new Set(
    imageHashes
      .map((hash) => String(hash || "").trim())
      .filter(Boolean)
  )];

  if (!keys.length) return new Map();

  const keySet = new Set(keys);

  const sheets = await getSheetsClient();
  const range = `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!G2:I`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];

  const result = new Map();

  rows.forEach((row, index) => {
    const imageHash = String(row?.[0] || "").trim();
    if (!keySet.has(imageHash)) return;

    result.set(imageHash, {
      rowIndex: index + 2,
      imageHash,
      rawJson: String(row?.[1] || "").trim(),
      shape64: String(row?.[2] || "").trim().toLowerCase(),
    });
  });

  return result;
}

export async function findOriginMagicCircleSpellCache(imageHash) {
  const sheets = await getSheetsClient();
  const range = `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!G2:I`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];

  const key = String(imageHash || "").trim();
  const idx = rows.findIndex((row) => String(row?.[0] || "").trim() === key);

  if (idx < 0) return null;

  const rawJson = String(rows[idx]?.[1] || "").trim();
  const shape64 = String(rows[idx]?.[2] || "").trim().toLowerCase();

  return {
    rowIndex: idx + 2,
    imageHash: key,
    rawJson,
    shape64,
  };
}

export async function appendOriginMagicCircleSpellCache({ imageHash, rawJson, shape64 = "" }) {
  const sheets = await getSheetsClient();
  const rowIndex = await findNextOriginMagicCircleSpellCacheRowIndex(sheets);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!G${rowIndex}:I${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[String(imageHash || ""), String(rawJson || ""), String(shape64 || "").trim().toLowerCase()]],
    },
  });

  return { rowIndex };
}

function compareOriginMagicCircleShape64(a, b) {
  const shapeA = String(a || "").trim().toLowerCase();
  const shapeB = String(b || "").trim().toLowerCase();

  if (!/^[0-9a-f]{4096}$/.test(shapeA)) return Infinity;
  if (!/^[0-9a-f]{4096}$/.test(shapeB)) return Infinity;

  let intersection = 0;
  let union = 0;
  let weightedDiff = 0;
  let activeCount = 0;

  for (let i = 0; i < 4096; i += 1) {
    const av = parseInt(shapeA[i], 16);
    const bv = parseInt(shapeB[i], 16);

    const aInk = av >= 2;
    const bInk = bv >= 2;

    // 両方空白なら無視。ここが最重要。
    if (!aInk && !bInk) continue;

    if (aInk || bInk) union += 1;
    if (aInk && bInk) intersection += 1;

    weightedDiff += Math.abs(av - bv) / 15;
    activeCount += 1;
  }

  if (union <= 0 || activeCount <= 0) return Infinity;

  const iou = intersection / union;
  const avgDiff = weightedDiff / activeCount;

  // 小さいほど似ている
  return (1 - iou) * 0.75 + avgDiff * 0.25;
}


  export async function findSimilarOriginMagicCircleSpellCacheByShape64(shape64) {
  const normalizedShape64 = String(shape64 || "").trim().toLowerCase();

  if (!/^[0-9a-f]{4096}$/.test(normalizedShape64)) {
    return null;
  }

  const sheets = await getSheetsClient();
  const range = `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!G2:I`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows = res.data.values || [];

  let best = null;

  rows.forEach((row, index) => {
    const imageHash = String(row?.[0] || "").trim();
    const magicEffectJsonRaw = String(row?.[1] || "").trim();
    const storedShape64 = String(row?.[2] || "").trim().toLowerCase();

    if (!imageHash || !magicEffectJsonRaw || !storedShape64) return;

    const score = compareOriginMagicCircleShape64(
      normalizedShape64,
      storedShape64
    );

    if (!Number.isFinite(score)) return;

    if (!best || score < best.similarScore) {
      best = {
        rowIndex: index + 2,
        imageHash,
        magicEffectJson: safeParseJson(magicEffectJsonRaw),
        shape64: storedShape64,
        similarScore: score,
      };
    }
  });

  const SIMILARITY_THRESHOLD = 0.42;

  if (!best || best.similarScore > SIMILARITY_THRESHOLD) {
    return null;
  }

  return best;
}

// ====== 時々文芸部：options用の高速キャッシュ ======
// ====== 時々文芸部：ツリー用（毎回最新取得・A:D一括） ======

async function loadBungeiRowsChunkedAllAD() {
  const sheets = await getSheetsClient();
  const rows = [];
  const CHUNK = 200; // 100でもOK
  let start = 2;

  while (true) {
    const end = start + CHUNK - 1;
    const range = `${BUNGEI_SHEET_NAME}!A${start}:D${end}`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const values = res.data.values || [];
    if (!values.length) break;

    for (const r of values) {
      const storedOrder = r?.[0] ?? "";
      const output = r?.[1] ?? "";
      const players = r?.[2] ?? "";
      const epilogue = r?.[3] ?? "";
      rows.push({ storedOrder, output, players, epilogue });
    }

    // CHUNK未満なら末尾の可能性が高いので終了
    if (values.length < CHUNK) break;

    // 最終行が完全空なら終了（保険）
    const last = values[values.length - 1] || [];
    const lastA = String(last?.[0] ?? "").trim();
    const lastB = String(last?.[1] ?? "").trim();
    const lastC = String(last?.[2] ?? "").trim();
    const lastD = String(last?.[3] ?? "").trim();
    if (!lastA && !lastB && !lastC && !lastD) break;

    start += CHUNK;
  }

  return rows;
}


//ここに追加で良いのか...？
function parseEpilogueMeta(epilogueRaw) {
  if (!epilogueRaw) return { backgroundName: null };

  try {
    const parsed = JSON.parse(epilogueRaw);
    const backgroundName =
      parsed && typeof parsed === "object" ? String(parsed.backgroundName || "") : "";
    return { backgroundName: backgroundName || null };
  } catch {
    return { backgroundName: null };
  }
}
function parseLoversFromOutput(outputRaw) {
  if (!outputRaw) return [];
  try {
    const parsed = JSON.parse(outputRaw);
    const cond = parsed?.condition;
    const lovers = [];

    if (cond?.ミユ?.恋人関係) lovers.push("ミユ");
    if (cond?.シオン?.恋人関係) lovers.push("シオン");
    if (cond?.ナナ?.恋人関係) lovers.push("ナナ");

    return lovers;
  } catch {
    return [];
  }
}

export async function buildBungeiTreeForPlayer(playerTrackingId, { maxDepth = 8, maxNodes = 2000 } = {}) {
  const rows = await loadBungeiRowsChunkedAllAD();

  // そのユーザーが関与した行だけ orderList + output + epilogue を集める
  const orders = [];
  for (const row of rows) {
    const { storedOrder, players, output, epilogue } = row;
    if (!players || !storedOrder) continue;

    let playerList = [];
    try { playerList = JSON.parse(players); } catch { playerList = []; }
    if (!Array.isArray(playerList) || !playerList.includes(playerTrackingId)) continue;

    try {
      const orderList = JSON.parse(storedOrder);
      if (!Array.isArray(orderList) || !orderList.length) continue;

      orders.push({
        orderList: orderList.map((v) => String(v ?? "").trim()).filter(Boolean),
        storedOrder,
        output: output ?? "",
        epilogue: epilogue ?? "",
      });
    } catch {
      // ignore
    }
  }

  // ツリー本体（prefix一意化）
  const nodes = [{ id: "root", parentId: null, line: null, depth: 0 }];
  const idByPrefix = new Map();
  idByPrefix.set("[]", "root");

  let nodeCount = 1;

  for (const item of orders) {
    const limited = item.orderList.slice(0, maxDepth);

    for (let i = 0; i < limited.length; i += 1) {
      const prefix = JSON.stringify(limited.slice(0, i + 1));
      if (idByPrefix.has(prefix)) continue;

      const parentPrefix = JSON.stringify(limited.slice(0, i));
      const parentId = idByPrefix.get(parentPrefix) || "root";

      const id = `node-${nodes.length}`;
      //nodes.push({ id, parentId, line: limited[i], depth: i + 1 });
      nodes.push({
  id,
  parentId,
  line: limited[i],
  depth: i + 1,
  jump: {
    orderList: limited.slice(0, i + 1),
    output: item.output,
    epilogue: item.epilogue,

    // ✅ 追加：B列があるか
    hasOutput: !!String(item.output || "").trim(),
    // ✅ 追加：D列があるか
    hasEpilogue: !!String(item.epilogue || "").trim(),
    
    // ✅ 追加
    jumpKind: "scene",
  },
});
      idByPrefix.set(prefix, id);

      nodeCount += 1;
      if (nodeCount >= maxNodes) return nodes;
    }
  }

  // ★ここから追加：エピローグノード
  const epilogueAdded = new Set(); // 同じ枝に重複追加しない保険

  for (const item of orders) {
    if (!item.epilogue) continue;

    const limited = item.orderList.slice(0, maxDepth);
    const leafPrefix = JSON.stringify(limited);
    const leafId = idByPrefix.get(leafPrefix);
    if (!leafId) continue;

    if (epilogueAdded.has(leafPrefix)) continue;
    epilogueAdded.add(leafPrefix);

    const { backgroundName } = parseEpilogueMeta(item.epilogue);
    const lovers = parseLoversFromOutput(item.output);

    nodes.push({
      id: `ep-${leafId}`,
      parentId: leafId,
      depth: limited.length + 1,
      line: `エピローグ\n${backgroundName || "不明"}`,
      epilogue: true,
      backgroundName: backgroundName || null,
      lovers,
      jump: {
  orderList: limited,
  output: item.output,
  epilogue: item.epilogue,
  hasOutput: !!String(item.output || "").trim(),
  hasEpilogue: !!String(item.epilogue || "").trim(),
  
  // ✅ 追加
  jumpKind: "epilogue",
},
    });

    nodeCount += 1;
    if (nodeCount >= maxNodes) return nodes;
  }

  return nodes;
}




// 既存の listBungeiLinesForPlayer を置き換え
export async function listBungeiLinesForPlayer(playerTrackingId, speechOrder = []) {
  const rows = await loadBungeiRowsChunkedAllAD();

  const lines = new Set();
  const normalizedSpeechOrder = (speechOrder || []).map((v) => String(v ?? "").trim());

  for (const row of rows) {
    const storedOrder = row.storedOrder;
    const playersRaw = row.players;
    if (!storedOrder || !playersRaw) continue;

    let playerList = [];
    try {
      playerList = JSON.parse(playersRaw);
    } catch {
      playerList = [];
    }
    if (!Array.isArray(playerList) || !playerList.includes(playerTrackingId)) continue;

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

export { SPREADSHEET_ID, SHEET_NAME };
