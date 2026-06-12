import { google } from "googleapis";
import { randomInt } from "node:crypto";
import { serviceAccount, SPREADSHEET_ID, SHEET_NAME } from "./env.js";

export const BUNGEI_SHEET_NAME = "時々文芸部！";
export const SECRET_TOOL_SHEET_NAME = "ひみつ道具";
export const ORIGIN_MAGIC_CIRCLE_SHEET_NAME = "オリジン魔法陣";
export const HUNDRED_ORE_CACHE_SHEET_NAME = "100俺_cache";
export const HUNDRED_ORE_RUNS_SHEET_NAME = "100俺_runs";
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
  const range = `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!A2:F`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  return res.data.values || [];
}




function parseOriginMagicCircleBattleStateJson(raw) {
  try {
    const parsed = JSON.parse(String(raw || "{}"));
    if (!parsed || typeof parsed !== "object") {
      return {
        turnOwnerId: "",
        turnSeq: 0,
      };
    }

    return {
      turnOwnerId: String(parsed.turnOwnerId || ""),
      turnSeq: Math.max(0, Math.round(Number(parsed.turnSeq) || 0)),
    };
  } catch {
    return {
      turnOwnerId: "",
      turnSeq: 0,
    };
  }
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




function parseOriginMagicCircleMembersJson(raw) {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => ({
        name: String(entry?.name || "guest"),
        id: String(entry?.id || ""),
        role: String(entry?.role || "guest"),
        hp: normalizeOriginMagicCircleHp(entry?.hp),
        loadReady: entry?.loadReady === true,
      }))
      .filter((entry) => entry.id);
  } catch {
    return [];
  }
}





function originMagicCircleRowToRoom(row = [], index = 0) {
  const roomId = String(row[0] || "").trim();
  const members = parseOriginMagicCircleMembersJson(row[1]);
  const status = String(row[2] || "").trim();
  const expiresAt = Number(row[3] || 0);
  const castLogs = parseOriginMagicCircleCastLogsJson(row[4]);
  const battleState = parseOriginMagicCircleBattleStateJson(row[5]);

  return {
    rowIndex: index + 2,
    roomId,
    members,
    status,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
    castLogs,
    battleState,
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




async function updateOriginMagicCircleBattleStateCell(rowIndex, battleState) {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!F${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[JSON.stringify(battleState || {})]],
    },
  });
}








export async function startOriginMagicCircleBattle({
  roomId,
  requestedByClientId = "",
  requireLoadReady = false,
} = {}) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");

  const members = room.members || [];
  if (members.length !== 2) throw new Error("room_not_ready");

  if (requestedByClientId) {
    const host = members.find((member) => member.role === "host");
    if (!host || host.id !== requestedByClientId) {
      throw new Error("forbidden");
    }
  }

  if (requireLoadReady) {
    const bothLoaded = members.every((member) => member.loadReady === true);
    if (!bothLoaded) throw new Error("opponent_loading");
  }

  const firstMember = members[Math.floor(Math.random() * members.length)];

  const nextMembers = members.map((member) => ({
    ...member,
    hp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
  }));

  const battleState = {
    turnOwnerId: firstMember.id,
    turnSeq: 1,
  };

  await updateOriginMagicCircleRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(nextMembers),
    "対戦中",
    String(room.expiresAt || originMagicCircleExpiresAtMs()),
  ]);

  await updateOriginMagicCircleBattleStateCell(room.rowIndex, battleState);

  return {
    ...room,
    status: "対戦中",
    members: nextMembers,
    battleState,
  };
}




export async function advanceOriginMagicCircleTurn({ roomId, clientId }) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");

  if (room.status !== "対戦中") {
    throw new Error("room_not_battle");
  }

  const members = room.members || [];
  if (members.length !== 2) throw new Error("room_not_ready");

  const currentTurnOwnerId = String(room.battleState?.turnOwnerId || "");
  if (currentTurnOwnerId && currentTurnOwnerId !== clientId) {
    throw new Error("not_your_turn");
  }

  const nextOwner = members.find((member) => member.id !== clientId);
  if (!nextOwner) throw new Error("room_not_ready");

  const battleState = {
    turnOwnerId: nextOwner.id,
    turnSeq: Math.max(0, Number(room.battleState?.turnSeq) || 0) + 1,
  };

  await updateOriginMagicCircleBattleStateCell(room.rowIndex, battleState);

  const updated = await getOriginMagicCircleRoomById(roomId);

  return updated || {
    ...room,
    battleState,
  };
}





export async function assertOriginMagicCircleTurnOwner({ roomId, clientId }) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");

  if (room.status !== "対戦中") {
    throw new Error("room_not_battle");
  }

  const turnOwnerId = String(room.battleState?.turnOwnerId || "");
  if (turnOwnerId && turnOwnerId !== clientId) {
    throw new Error("not_your_turn");
  }

  return room;
}







async function clearOriginMagicCircleRoomRow(rowIndex) {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!A${rowIndex}:F${rowIndex}`,
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




export async function findActiveOriginMagicCircleRoomByClientId(clientId) {
  const safeClientId = String(clientId || "").trim();
  if (!safeClientId) return null;

  const sheets = await getSheetsClient();
  const rows = await getOriginMagicCircleRows(sheets);
  const now = Date.now();

  const candidates = rows
    .map((row, index) => originMagicCircleRowToRoom(row, index))
    .filter((room) => {
      if (!room.roomId) return false;
      if (room.expiresAt > 0 && room.expiresAt < now) return false;
      if (!["lobby", "loading", "対戦中"].includes(room.status)) return false;
      return (room.members || []).some((member) => member.id === safeClientId);
    })
    .sort((a, b) => Number(b.expiresAt || 0) - Number(a.expiresAt || 0));

  return candidates[0] || null;
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
  String(room.expiresAt || originMagicCircleExpiresAtMs()),
]);

// B列への反映を確認してから返す。
// Google Sheets は update のPromiseが解決しても、直後の別リクエストで古い値が見えることがあるため。
for (let i = 0; i < 6; i += 1) {
  const savedRoom = await getOriginMagicCircleRoomById(room.roomId);
  const savedMembers = savedRoom?.members || [];

  const joined = savedMembers.some((member) => member.id === clientId);
  const memberCountOk = existingIndex >= 0
    ? savedMembers.length === members.length
    : savedMembers.length >= members.length;

  if (savedRoom && joined && memberCountOk) {
    return {
      roomId: savedRoom.roomId,
      members: savedRoom.members,
      status: savedRoom.status,
      expiresAt: savedRoom.expiresAt,
      battleState: savedRoom.battleState,
    };
  }

  await new Promise((resolve) => setTimeout(resolve, 180));
}

const fallbackRoom = await getOriginMagicCircleRoomById(room.roomId);
return fallbackRoom || {
  roomId: room.roomId,
  members,
  status: room.status,
  expiresAt: room.expiresAt,
};
}


export async function updateOriginMagicCircleMemberLoadState({ roomId, clientId, isLoaded }) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");

  const members = [...(room.members || [])];
  const targetIndex = members.findIndex((member) => member.id === clientId);
  if (targetIndex < 0) throw new Error("forbidden");

  members[targetIndex] = {
    ...members[targetIndex],
    loadReady: Boolean(isLoaded),
  };

  await updateOriginMagicCircleRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(members),
    room.status,
    String(room.expiresAt || roomExpiresAtMs()),
  ]);

  return {
    ...room,
    members,
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

  const nextMembers = (room.members || []).map((member) => ({
    ...member,
    hp: normalizedStatus === "loading"
      ? ORIGIN_MAGIC_CIRCLE_MAX_HP
      : normalizeOriginMagicCircleHp(member?.hp),
  }));

  await updateOriginMagicCircleRoomRow(room.rowIndex, [
    room.roomId,
    JSON.stringify(nextMembers),
    normalizedStatus,
    String(room.expiresAt || roomExpiresAtMs()),
  ]);

  return {
    roomId: room.roomId,
    members: nextMembers,
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

  await clearOriginMagicCircleRoomRow(room.rowIndex);
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
        range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!A${room.rowIndex}:F${room.rowIndex}`,
        values: [["", "", "", "", "", ""]],
      })),
    },
  });

  return targets.length;
}





export async function resetOriginMagicCircleRoomForRematch({ roomId, clientId }) {
  const room = await getOriginMagicCircleRoomById(roomId);
  if (!room) throw new Error("room_not_found");

  const members = [...(room.members || [])];
  const me = members.find((member) => member.id === clientId);
  if (!me) throw new Error("forbidden");
  if (members.length !== 2) throw new Error("room_not_ready");

  const resetMembers = members.map((member) => ({
    ...member,
    hp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
    loadReady: false,
  }));
  const nextExpiresAt = originMagicCircleExpiresAtMs();

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!A${room.rowIndex}:D${room.rowIndex}`,
          values: [[room.roomId, JSON.stringify(resetMembers), "lobby", String(nextExpiresAt)]],
        },
        {
          range: `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!E${room.rowIndex}:F${room.rowIndex}`,
          values: [["", ""]],
        },
      ],
    },
  });

  return {
    ...room,
    members: resetMembers,
    status: "lobby",
    castLogs: [],
    battleState: {},
    expiresAt: nextExpiresAt,
  };
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



function normalizeOriginMagicCircleCacheShape64(rawShape64) {
  const value = String(rawShape64 || "").trim().toLowerCase();

  // 64 * 64 = 4096文字。各文字は0〜fの濃淡。
  if (!/^[0-9a-f]{4096}$/.test(value)) return "";

  return value;
}

function originMagicCircleShape64ToLevels(shape64) {
  const normalized = normalizeOriginMagicCircleCacheShape64(shape64);
  if (!normalized) return [];

  return normalized.split("").map((ch) => {
    const n = Number.parseInt(ch, 16);
    return Number.isFinite(n) ? Math.max(0, Math.min(15, n)) : 0;
  });
}

function originMagicCircleLevelsToBinary(levels, threshold = 1) {
  if (!Array.isArray(levels) || levels.length !== 4096) return [];

  // threshold=1にしている理由：
  // アンチエイリアスの薄い線も拾いたいから。
  // ここを3や4にすると、薄い線・細い線が消えて別物判定されやすい。
  return levels.map((level) => (Number(level) >= threshold ? 1 : 0));
}

function getBinaryBounds(binary, size = 64) {
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!binary[y * size + x]) continue;

      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (count <= 0) {
    return {
      ok: false,
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
      count: 0,
    };
  }

  return {
    ok: true,
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    count,
  };
}

function normalizeBinaryShape(binary, sourceSize = 64, outputSize = 48, padding = 4) {
  const bounds = getBinaryBounds(binary, sourceSize);

  const result = new Array(outputSize * outputSize).fill(0);

  if (!bounds.ok) {
    return result;
  }

  const usableSize = outputSize - padding * 2;

  // 縦横比を維持して、黒部分だけを48×48内に正規化する。
  // これで「同じ円だけど少し大きい/小さい/位置が違う」に強くなる。
  const scale = Math.min(
    usableSize / Math.max(1, bounds.width),
    usableSize / Math.max(1, bounds.height)
  );

  const drawW = bounds.width * scale;
  const drawH = bounds.height * scale;

  const offsetX = (outputSize - drawW) / 2;
  const offsetY = (outputSize - drawH) / 2;

  for (let sy = bounds.minY; sy <= bounds.maxY; sy += 1) {
    for (let sx = bounds.minX; sx <= bounds.maxX; sx += 1) {
      if (!binary[sy * sourceSize + sx]) continue;

      const nx = Math.round(offsetX + (sx - bounds.minX) * scale);
      const ny = Math.round(offsetY + (sy - bounds.minY) * scale);

      if (nx < 0 || nx >= outputSize || ny < 0 || ny >= outputSize) continue;

      result[ny * outputSize + nx] = 1;
    }
  }

  return result;
}

function dilateBinary(binary, size = 48, radius = 1) {
  const result = new Array(size * size).fill(0);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!binary[y * size + x]) continue;

      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue;

          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

          result[ny * size + nx] = 1;
        }
      }
    }
  }

  return result;
}

function countBinaryPixels(binary) {
  return binary.reduce((sum, value) => sum + (value ? 1 : 0), 0);
}

function binaryIoU(a, b, size = 48, dilationRadius = 1) {
  const da = dilateBinary(a, size, dilationRadius);
  const db = dilateBinary(b, size, dilationRadius);

  let intersection = 0;
  let union = 0;

  for (let i = 0; i < size * size; i += 1) {
    const av = da[i] ? 1 : 0;
    const bv = db[i] ? 1 : 0;

    if (av && bv) intersection += 1;
    if (av || bv) union += 1;
  }

  if (union <= 0) return 0;

  return intersection / union;
}

function getForegroundPoints(binary, size = 48) {
  const points = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (binary[y * size + x]) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

function averageNearestDistanceScore(a, b, size = 48) {
  const pointsA = getForegroundPoints(a, size);
  const pointsB = getForegroundPoints(b, size);

  if (!pointsA.length || !pointsB.length) return 1;

  const nearestAverage = (from, to) => {
    let sum = 0;

    for (const p of from) {
      let bestSq = Infinity;

      for (const q of to) {
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const d2 = dx * dx + dy * dy;

        if (d2 < bestSq) bestSq = d2;
      }

      sum += Math.sqrt(bestSq);
    }

    return sum / from.length;
  };

  const ab = nearestAverage(pointsA, pointsB);
  const ba = nearestAverage(pointsB, pointsA);

  const avg = (ab + ba) / 2;

  // 48pxグリッドで、平均ズレ6px以上ならかなり別物扱い。
  return Math.min(1, avg / 6);
}

function compareNormalizedShapeBinary(a, b, size = 48) {
  const countA = countBinaryPixels(a);
  const countB = countBinaryPixels(b);

  if (countA <= 0 || countB <= 0) return 1;

  const densityA = countA / (size * size);
  const densityB = countB / (size * size);

  // 密度が極端に違う場合は、円 vs ぐちゃぐちゃ線を同一扱いしにくくする。
  const densityPenalty = Math.min(
    0.35,
    Math.abs(densityA - densityB) * 3.2
  );

  const iou = binaryIoU(a, b, size, 1);
  const iouDistance = 1 - iou;

  const nearestDistance = averageNearestDistanceScore(a, b, size);

  /*
    iouDistance:
      同じ場所に線があるか。
    nearestDistance:
      線同士が近いか。円の少しのズレに強い。
    densityPenalty:
      線量が違いすぎるものを弾く。
  */
  const score =
    iouDistance * 0.42 +
    nearestDistance * 0.48 +
    densityPenalty * 0.10;

  return Math.max(0, Math.min(1, score));
}

function compareOriginMagicCircleShape64(aShape64, bShape64) {
  const aLevels = originMagicCircleShape64ToLevels(aShape64);
  const bLevels = originMagicCircleShape64ToLevels(bShape64);

  if (aLevels.length !== 4096 || bLevels.length !== 4096) return 1;

  const aBinary64 = originMagicCircleLevelsToBinary(aLevels, 1);
  const bBinary64 = originMagicCircleLevelsToBinary(bLevels, 1);

  const aBounds = getBinaryBounds(aBinary64, 64);
  const bBounds = getBinaryBounds(bBinary64, 64);

  if (!aBounds.ok || !bBounds.ok) return 1;

  /*
    あまりに線量が違うものは先に弾く。
    ただし円の描き方によって点数はそこそこ変わるので、
    ここは緩めにする。
  */
  const countRatio =
    Math.min(aBounds.count, bBounds.count) /
    Math.max(aBounds.count, bBounds.count);

  if (countRatio < 0.32) {
    return 1;
  }

  const aNormalized = normalizeBinaryShape(aBinary64, 64, 48, 4);
  const bNormalized = normalizeBinaryShape(bBinary64, 64, 48, 4);

  return compareNormalizedShapeBinary(aNormalized, bNormalized, 48);
}

// 低いほど似ている。
// 閾値をやや厳しめにして、異なる形状が同一判定されるケースを減らす。
const SIMILARITY_THRESHOLD = 0.29;

export async function findSimilarOriginMagicCircleSpellCacheByShape64(shape64) {
  const targetShape64 = normalizeOriginMagicCircleCacheShape64(shape64);

  if (!targetShape64) {
    console.log("[origin-magic-circle] shape64 search skipped: invalid target", {
      length: String(shape64 || "").length,
    });
    return null;
  }

  const sheets = await getSheetsClient();

  // G: sha256, H: 魔法陣json, I: shape64
  const range = `${ORIGIN_MAGIC_CIRCLE_SHEET_NAME}!G2:I`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows = res.data.values || [];

  let best = null;
  const debugCandidates = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || [];

    const imageHash = String(row[0] || "").trim();
    const rawJson = String(row[1] || "").trim();
    const storedShape64 = normalizeOriginMagicCircleCacheShape64(row[2]);

    if (!imageHash || !rawJson || !storedShape64) continue;

    const score = compareOriginMagicCircleShape64(targetShape64, storedShape64);

    const candidate = {
      rowIndex: i + 2,
      imageHash,
      rawJson,
      shape64: storedShape64,
      similarScore: score,
    };

    debugCandidates.push({
      rowIndex: candidate.rowIndex,
      score: Number(score.toFixed(4)),
      imageHash: imageHash.slice(0, 10),
    });

    if (!best || score < best.similarScore) {
      best = candidate;
    }
  }

  debugCandidates.sort((a, b) => a.score - b.score);

  console.log("[origin-magic-circle] shape64 similarity search:", {
    threshold: SIMILARITY_THRESHOLD,
    rows: rows.length,
    candidates: debugCandidates.length,
    best: best
      ? {
          rowIndex: best.rowIndex,
          imageHash: best.imageHash.slice(0, 10),
          similarScore: Number(best.similarScore.toFixed(4)),
          hit: best.similarScore <= SIMILARITY_THRESHOLD,
        }
      : null,
    top5: debugCandidates.slice(0, 5),
  });

  if (best && best.similarScore <= SIMILARITY_THRESHOLD) {
    return best;
  }

  return null;
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

const HUNDRED_ORE_CACHE_HEADERS = [
  "cacheId",
  "sceneKey",
  "sourceDay",
  "sourcePageTitle",
  "changeLabelsText",
  "changeLabelsJson",
  "storyCard",
  "outcomeText",
  "nextPageTitle",
  "nextPageBody",
  "nextSceneKey",
  "outcomeJson",
  "nextPageJson",
  "createdAt",
];
const HUNDRED_ORE_RUNS_HEADERS = [
  "runId",
  "username",
  "userTrackingId",
  "startedAt",
  "endedAt",
  "score",
  "gameOverReason",
  "pagesJson",
  "metaJson",
];

function parseHundredOreRunRow(row, index = 0) {
  return {
    rowIndex: index + 2,
    recordType: "run",
    runId: String(row?.[0] || "").trim(),
    username: String(row?.[1] || "").trim(),
    userTrackingId: String(row?.[2] || "").trim(),
    startedAt: String(row?.[3] || "").trim(),
    endedAt: String(row?.[4] || "").trim(),
    score: Number(row?.[5] || 0),
    gameOverReason: String(row?.[6] || "").trim(),
    pages: safeParseJson(row?.[7], []),
    meta: safeParseJson(row?.[8], {}),
  };
}

function parseHundredOreCacheRow(row, index = 0) {
  const outcome = safeParseJson(row?.[11], null);
  const nextPage = safeParseJson(row?.[12], null);
  const changeLabels = safeParseJson(row?.[5], []);
  return {
    rowIndex: index + 2,
    recordType: "cache",
    cacheId: String(row?.[0] || "").trim(),
    sceneKey: String(row?.[1] || "").trim(),
    sourceDay: Number(row?.[2] || 0),
    sourcePageTitle: String(row?.[3] || "").trim(),
    changeLabelsText: String(row?.[4] || "").trim(),
    changeLabels: Array.isArray(changeLabels) ? changeLabels.map(String) : [],
    storyCard: String(row?.[6] || outcome?.storyCard || outcome?.outcomeMode || "").trim(),
    outcomeText: String(row?.[7] || outcome?.outcomeSummary || outcome?.rewriteText || "").trim(),
    nextPageTitle: String(row?.[8] || nextPage?.pageTitle || "").trim(),
    nextPageBody: String(row?.[9] || nextPage?.bodyText || "").trim(),
    nextSceneKey: String(row?.[10] || nextPage?.sceneKey || "").trim(),
    outcome,
    nextPage,
    createdAt: String(row?.[13] || "").trim(),
  };
}

function stripHundredOreImagePayload(value) {
  if (Array.isArray(value)) return value.map(stripHundredOreImagePayload);
  if (!value || typeof value !== "object") return value;
  const cleaned = {};
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = String(key || "").toLowerCase();
    if (
      key === "imageDataUrl" ||
      key === "originalImageDataUrl" ||
      key === "compositeImageDataUrl" ||
      key === "points" ||
      normalizedKey === "base64" ||
      normalizedKey.endsWith("base64") ||
      normalizedKey.includes("dataurl")
    ) continue;
    cleaned[key] = stripHundredOreImagePayload(child);
  }
  return cleaned;
}

function sanitizeHundredOreCacheOutcome(outcome) {
  if (!outcome || typeof outcome !== "object") return {};
  const storyCard = String(outcome.storyCard || outcome.outcomeMode || "");
  return {
    rewriteText: String(outcome.rewriteText || ""),
    outcomeSummary: String(outcome.outcomeSummary || ""),
    outcomeType: String(outcome.outcomeType || ""),
    gameOver: Boolean(outcome.gameOver),
    gameOverReason: String(outcome.gameOverReason || ""),
    nextSceneHint: String(outcome.nextSceneHint || ""),
    changeLabels: Array.isArray(outcome.changeLabels) ? outcome.changeLabels.map(String).slice(0, 8) : [],
    cacheId: String(outcome.cacheId || ""),
    storyCard,
    outcomeMode: storyCard,
  };
}

function sanitizeHundredOreCacheNextPage(page) {
  if (!page || typeof page !== "object") return null;
  return {
    day: Number(page.day || 1),
    pageTitle: String(page.pageTitle || ""),
    bodyText: String(page.bodyText || ""),
    sceneSummary: String(page.sceneSummary || ""),
    sceneKey: String(page.sceneKey || ""),
    imageHash: String(page.imageHash || ""),
    imageModel: String(page.imageModel || ""),
    imageGenerationFailed: Boolean(page.imageGenerationFailed),
    advancedAxis: String(page.advancedAxis || ""),
    nextTouchableObjects: Array.isArray(page.nextTouchableObjects) ? page.nextTouchableObjects.map(String).filter(Boolean).slice(0, 5) : [],
  };
}

async function ensureSheetHeader(sheets, sheetName, headers) {
  const endColumn = String.fromCharCode("A".charCodeAt(0) + headers.length - 1);
  const range = `${sheetName}!A1:${endColumn}1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range }).catch((error) => {
    if (error?.code === 400 || error?.code === 404) return { data: { values: [] } };
    throw error;
  });
  const row = res.data.values?.[0] || [];
  const headerMissing = headers.some((header, index) => String(row[index] || "").trim() !== header);
  if (!row.length || headerMissing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

async function ensureHundredOreCacheHeader(sheets) {
  console.log("[100ore] sheets target", { cacheSheet: HUNDRED_ORE_CACHE_SHEET_NAME, runsSheet: HUNDRED_ORE_RUNS_SHEET_NAME });
  await ensureSheetHeader(sheets, HUNDRED_ORE_CACHE_SHEET_NAME, HUNDRED_ORE_CACHE_HEADERS);
}

async function ensureHundredOreRunsHeader(sheets) {
  console.log("[100ore] sheets target", { cacheSheet: HUNDRED_ORE_CACHE_SHEET_NAME, runsSheet: HUNDRED_ORE_RUNS_SHEET_NAME });
  await ensureSheetHeader(sheets, HUNDRED_ORE_RUNS_SHEET_NAME, HUNDRED_ORE_RUNS_HEADERS);
}

export async function appendHundredOreRun(run) {
  const sheets = await getSheetsClient();
  await ensureHundredOreRunsHeader(sheets);
  const safePages = stripHundredOreImagePayload(run.pages || []);
  const pagesJson = JSON.stringify(safePages);
  console.debug("[100ore] run pagesJson length", pagesJson.length);
  const values = [[
    String(run.runId || ""),
    String(run.username || ""),
    String(run.userTrackingId || ""),
    String(run.startedAt || ""),
    String(run.endedAt || new Date().toISOString()),
    Number(run.score || 0),
    String(run.gameOverReason || ""),
    pagesJson,
    JSON.stringify(stripHundredOreImagePayload(run.meta || {})),
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HUNDRED_ORE_RUNS_SHEET_NAME}!A2:I`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  return { ok: true };
}

export async function appendHundredOreCache(cache) {
  const sheets = await getSheetsClient();
  await ensureHundredOreCacheHeader(sheets);
  const changeLabels = Array.isArray(cache.changeLabels) ? cache.changeLabels.map(String).filter(Boolean).slice(0, 8) : [];
  const safeOutcome = sanitizeHundredOreCacheOutcome(stripHundredOreImagePayload(cache.outcome || {}));
  const safeNextPage = sanitizeHundredOreCacheNextPage(stripHundredOreImagePayload(cache.nextPage || null));
  const outcomeJson = JSON.stringify(safeOutcome);
  const nextPageJson = JSON.stringify(safeNextPage || null);
  console.debug("[100ore] branch nextPageJson length", nextPageJson.length);
  const storyCard = String(cache.storyCard || safeOutcome.storyCard || safeOutcome.outcomeMode || "");
  const values = [[
    String(cache.cacheId || safeOutcome.cacheId || ""),
    String(cache.sceneKey || ""),
    Number(cache.sourceDay || 0),
    String(cache.sourcePageTitle || ""),
    String(cache.changeLabelsText || changeLabels.join(" / ")),
    JSON.stringify(changeLabels),
    storyCard,
    String(cache.outcomeText || safeOutcome.outcomeSummary || safeOutcome.rewriteText || ""),
    String(cache.nextPageTitle || safeNextPage?.pageTitle || ""),
    String(cache.nextPageBody || safeNextPage?.bodyText || ""),
    String(cache.nextSceneKey || safeNextPage?.sceneKey || ""),
    outcomeJson,
    nextPageJson,
    String(cache.createdAt || new Date().toISOString()),
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HUNDRED_ORE_CACHE_SHEET_NAME}!A2:N`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  return { ok: true };
}

export async function listHundredOreCacheBySceneKey(sceneKey) {
  const key = String(sceneKey || "").trim();
  if (!key) return [];
  const sheets = await getSheetsClient();
  await ensureHundredOreCacheHeader(sheets);
  const range = `${HUNDRED_ORE_CACHE_SHEET_NAME}!A2:N`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  return rows
    .map(parseHundredOreCacheRow)
    .filter((cache) => cache && cache.cacheId && cache.sceneKey === key);
}

export async function listHundredOreRankings({ limit = 30 } = {}) {
  const sheets = await getSheetsClient();
  await ensureHundredOreRunsHeader(sheets);
  const range = `${HUNDRED_ORE_RUNS_SHEET_NAME}!A2:I`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  return rows
    .map(parseHundredOreRunRow)
    .filter((run) => run && run.runId && run.recordType === "run")
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(b.endedAt || "").localeCompare(String(a.endedAt || "")))
    .slice(0, limit);
}

export async function getHundredOreRunById(runId) {
  const key = String(runId || "").trim();
  if (!key) return null;
  const sheets = await getSheetsClient();
  await ensureHundredOreRunsHeader(sheets);
  const range = `${HUNDRED_ORE_RUNS_SHEET_NAME}!A2:I`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i += 1) {
    const run = parseHundredOreRunRow(rows[i], i);
    if (run && run.recordType === "run" && run.runId === key) return run;
  }
  return null;
}


export { SPREADSHEET_ID, SHEET_NAME };
