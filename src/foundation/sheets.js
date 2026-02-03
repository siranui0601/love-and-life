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

export async function findUserByUsername(username) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:C`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  for (const row of rows) {
    const [, storedUsername] = row;
    if (storedUsername === username) return { username: storedUsername };
  }
  return null;
}

export async function findUserByUsernameAndPassword(username, password) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:B`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  for (const row of rows) {
    const [storedPassword, storedUsername] = row;
    if (storedUsername === username && storedPassword === password) {
      return { username: storedUsername };
    }
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

export async function addCredentialUser({ username, password }) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:B2`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[password, username]] },
  });
  return { username };
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

    if (cond?.ミユ?.relationship) lovers.push("ミユ");
    if (cond?.シオン?.relationship) lovers.push("シオン");
    if (cond?.ナナ?.relationship) lovers.push("ナナ");

    return lovers;
  } catch {
    return [];
  }
}

export async function buildBungeiTreeForPlayer(playerName, { maxDepth = 8, maxNodes = 2000 } = {}) {
  const rows = await loadBungeiRowsChunkedAllAD();

  // そのユーザーが関与した行だけ orderList + output + epilogue を集める
  const orders = [];
  for (const row of rows) {
    const { storedOrder, players, output, epilogue } = row;
    if (!players || !storedOrder) continue;

    let playerList = [];
    try { playerList = JSON.parse(players); } catch { playerList = []; }
    if (!Array.isArray(playerList) || !playerList.includes(playerName)) continue;

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
export async function listBungeiLinesForPlayer(playerName, speechOrder = []) {
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

export { SPREADSHEET_ID, SHEET_NAME };
