import 'dotenv/config';
// これだけで process.env に .env の内容が入る

import { google } from "googleapis";


// ================================
// Google Sheets クライアント
// ================================
const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  : null;

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || "Users";


async function getSheetsClient() {
  if (!serviceAccount) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません");
  }

  const auth = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  await auth.authorize();

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}






















// email からユーザーを探す
async function findUserByEmail(email) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:C`; // ヘッダー行(A1:C1)をスキップ

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows = res.data.values || [];
  for (const row of rows) {
    const [rowEmail, username, displayName] = row;
    if (rowEmail === email) {
      return { email: rowEmail, username, displayName };
    }
  }
  return null;
}

// 新規ユーザー追加
async function addUser({ email, username, displayName }) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:C2`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[email, username, displayName]],
    },
  });

  return { email, username, displayName };
}



// ---------- 基本サーバー ----------
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
// ---------- Gemini API ----------
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// 静的ファイルを /public から配信
app.use(express.static("public"));

app.use(express.json());












// ================================
// 断罪AI（Sheets: "断罪AI"）
//  A: roomId(4桁)
//  B: 状態 "状態:ランダム対戦許可" / "状態:ランダム対戦不許可" / "対戦中" + optional "/募集停止"
//  C: 作成者ユーザー名
//  D: 参加者ユーザー名（"/"区切り） 例: "alice/bob/charlie"
//  E: AI数（数値）※最終開始時にだけ反映
//  F: キック済みユーザー名（"/"区切り） 例: "eve/mallory"
// ================================
const JUDGE_SHEET_NAME = "断罪AI";

// "/" 禁止（参加者列が "/" 区切りのため）
function validateUsername(username) {
  if (!username || typeof username !== "string") return "username is required";
  const u = username.trim();
  if (!u) return "username is empty";
  if (u.includes("/")) return "username must not include '/'";
  return null;
}

function isRecruitStopped(statusB) {
  return String(statusB || "").includes("/募集停止");
}
function stripRecruitSuffix(statusB) {
  return String(statusB || "").replace("/募集停止", "");
}
function withRecruitSuffix(statusB) {
  const base = stripRecruitSuffix(statusB);
  return isRecruitStopped(statusB) ? String(statusB) : `${base}/募集停止`;
}
function withoutRecruitSuffix(statusB) {
  return stripRecruitSuffix(statusB);
}

function pad4(n) {
  return String(n).padStart(4, "0");
}

function parseSlashList(cell) {
  const s = String(cell || "").trim();
  if (!s) return [];
  return s.split("/").map(x => x.trim()).filter(Boolean);
}
function formatSlashList(arr) {
  return (arr || []).map(x => String(x).trim()).filter(Boolean).join("/");
}
function includesName(listArr, username) {
  return (listArr || []).includes(username);
}
function addUnique(listArr, username) {
  const a = Array.isArray(listArr) ? listArr : [];
  if (a.includes(username)) return a;
  return [...a, username];
}
function removeName(listArr, username) {
  return (listArr || []).filter(x => x !== username);
}

// ★ F列まで → ★ G列まで
async function getJudgeRows(sheets) {
  const range = `${JUDGE_SHEET_NAME}!A2:G`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return res.data.values || []; // 各行: [A,B,C,D,E,F,G]
}


function findJudgeRowIndex(rows, roomId) {
  const rid = String(roomId || "").trim();
  for (let i = 0; i < rows.length; i++) {
    const a = String(rows[i]?.[0] || "").trim();
    if (a === rid) return i;
  }
  return -1;
}

function sheetRowNumberFromIndex(idx0) {
  return idx0 + 2; // rows[0] = sheet row 2
}

async function updateJudgeCells(sheets, rowNumber, updates) {
  const data = updates.map(u => ({
    range: `${JUDGE_SHEET_NAME}!${u.col}${rowNumber}`,
    values: [[u.value]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

async function generateUniqueRoomId(sheets) {
  const rows = await getJudgeRows(sheets);
  const used = new Set(rows.map(r => String(r?.[0] || "").trim()).filter(Boolean));
  for (let i = 0; i < 30; i++) {
    const id = pad4(Math.floor(Math.random() * 10000));
    if (!used.has(id)) return id;
  }
  throw new Error("ルームID生成に失敗しました（混雑）");
}

function normalizeStatusForDisplay(statusB) {
  // シート上の古い値が残っていても表示を合わせたい場合はここで吸収
  let t = String(statusB || "");
  t = t.replace("ランダム可", "状態:ランダム対戦許可");
  t = t.replace("ランダム不可", "状態:ランダム対戦不許可");
  return t;
}

function statusFromAllowRandom(allowRandom) {
  return allowRandom ? "状態:ランダム対戦許可" : "状態:ランダム対戦不許可";
}

function isRandomAllowed(statusB) {
  const base = stripRecruitSuffix(statusB);
  return base === "状態:ランダム対戦許可";
}

function isInBattle(statusB) {
  const base = stripRecruitSuffix(statusB);
  return base === "対戦中";
}










// ================================
// Socket.IO用：断罪AI状態取得＆ブロードキャスト
// ================================
// ================================
// 断罪AI：ゲーム（G列に gameJson を保存）
// ================================
const TOPICS = [
  "好きな季節について、その理由や情景も含めて教えて",
  "最近よく食べているものと、それを選ぶ理由は？",
  "何も予定がない一日をどう過ごすことが多い？",
  "日常の中で小さな楽しみだと感じていることは？",
  "気づくとやってしまう習慣や癖はある？",
  "一日の中で好きな時間は？",
  "早起き出来たら何をする？",
  "最近「ちょっと嬉しかった」出来事は？",
  "生活の中で地味に助かっているものは？",
  "外出と在宅、それぞれの良さをどう感じている？",
  "落ち着く瞬間はどんな時？",
  "イライラした時、どう対処する？",
  "不安を感じた時、考えがちになることは？",
  "自分なりの「幸せ」の定義は？",
  "苦手だと感じる人の特徴は？",
  "自分の感情を抑えてしまう場面はある？",
  "人から言われて印象に残っている言葉は？",
  "気分転換に効果があると感じていることは？",
  "座右の銘は？",
  "何かを選ぶ時、重視している基準は？",
  "買い物で迷った時、最後の決め手になるものは？",
  "失敗した経験を教えて",
  "もし一日だけ自由に使える時間が増えたら何をする？",
  "もし過去の自分に一言伝えられるなら何を言う？",
  "もし制限が一切なかったら挑戦したいことは？",
  "もし世界の一つの仕組みを変えられるなら？",
  "もし今の知識のまま別の人生を始めたらどうする？",
  "もし失敗が記録されない世界だったら？",
  "もし一つだけ才能を選べるとしたら？",
  "もし誰にも評価されないとしたら何をする？",
  "もし時間の流れを変えられるならどうしたい？",
  "もし魔法が使えたらなにをする？",
  "子どもの頃の記憶で印象に残っているものは？",
  "初めての経験で覚えている感情は？",
  "失敗から学んだことは？",
  "恥ずかしいと感じた過去の出来事は？",
  "忘れられない一日を挙げるなら？",
  "昔と今で変わった考え方は？",
  "嘘をつく時に気をつけていることは？",
  "信頼を得るために必要だと思うことは？",
  "自分がAIだと疑われたらどう説明する？",
  "他人との差を感じる瞬間は？",
];

// いまはあなたが貼ってくれた画像を採用（増やすのはここに追加するだけ）
const AVATAR_URLS = [
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh7Bps552TusX-PHewhpJCckYFrng7gqp8Oa-EwN29rkxYK6aNDEmBnHLg0X9VdEvfpWEdgHUMF4ilowhGE4qVoVhIjVXZzSGT1hWjepTd5Jb6oL0g0O8C0x4mXsWJFeSjmWq3tWHG_8rY/s800/native_american_indian.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEibShkfd-GiPO6BvtEgtnSb5x_5y8d390TwtJlAR6lwcUctbg_1uRkSCkpnC15tVyR5wNZVCKdzoKnoEw9-C54avMZtVhbYEGbBuj9b1YCqJYVxOcadifUMq15YpES5o9MWJPCsTAoS7hk/s800/pose_inoru_man_hisshi.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEieNtsT4AQJwI3Qo4IWgatDRUMJyEVv3jhKow-yAUzD7cWuKnYMec0uqi-W7PtIE7UQJWY1qY11XT2YKABsXLaRrSoSVdlrWQMHGjaIisGlaF8wNLkM10joFCtC70s-EGSkBXIkeL56RoQ/s800/dogeza_businessman.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg68FSEkRuBlFi_WgDu6U7R7mjDwPXcbPQ2yt0i8doApCnRRq8bTWZOy7BNHeCKd-VvoPnp-egH0iFFcpcmVf68XdRL-2n6zXRh8gwhm_AZrbNbCCT28NnjAL48JUBr4WgAsVv9j1DDuJuK/s800/megami.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhv6R7VMLpnU3jAPgcVWmwqBuJqxoK65Xj7cJxBko71E8IPNSH1j9h0fxXENXFNdg6jNjrCUBMZcRfdnPuxuLQMknVeIj36f-9WMYiwFI8LDtctyd1h0xlSa8HdrQC5zqrH-84ckKCmJNM/s800/musician_shikisya.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjv_UN__F3qC2YWFijUl2UWwpM1M9al7CXo6rpeMVyo6QiJKChp9gN1SEk-aJAQE4lXwP28NKZldlrH4EoP0LVbyxKonfvJAdR22URggDYr6jwHaWnNgqlAgdA6a6ramFvCxjE_5J1JTciE/s800/nigaoe_samurai_yasuke.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhy6xlfKWWn6NHtMPNU9DC10EYC9XKc7_OK0msapTZHIrmvqZLoq-z1PeXfNyXC1LHtcblqKCSmKYGRLrNHCyQAN4yWpkSJ3paF6LD_a880_fIHL7COo1mWHwmyqOZBikCnG14pBtU7Bt0m/s803/animal_kiboshi_iwa_hyrax.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhIFH9L78vesNF_2-67ZlN-sSlc3begQhBYQ9Hk8PZFyXpSG8rIgQhg-xbfDr4tojZJB8tHLRAQwCRpwWDI04dEEiY4t_5sxXRIRApdtIezWwi-54YPasIFVOLqAFvevmewmpx7Izmk2Xyv/s1600/medical_datsumou_happy.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjABhZ_X9wkB7m2djeKrUfJTUFIz9Quy7wk4o9eus7brZtRa4TQ3ONlqN6T9cQG2_NQtErNUivDkVCzgUv09cjd5uQ0SSFVZ4iuRi6lcLG7gYzh3sJtD4xzjx7sIUtZws98hlfJ_OUEIaE/s800/animal_okapi.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgPsjvxx688g3kNhZ4I3Heb6PKrkOgraJimkbwNOXMFmWirvtfkl1Oz5_CFViIFnkTefzQaOoEMuw8WPKCm4hZK2X0PsYVBFXWH5i84s-wYfI8SubvZ1V3fCo4HXpgWpASf_yTZrkLmNL4/s1600/osyousan.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEifnaalpQrY1Hm5zrDAgnqSpPGZDAeXXlGDWXsoKtIKIBAWU8I08EYr3lw4zKZb4K8YWh0inUiBEdiwuu83Hu8PLc5FzJTdVni6lN_noyHRHANiGekkKWfoUwNDrq3mPZksWa8kZmh9mCTj/s676/pet_robot_dog.png",
];

function nowMs() { return Date.now(); }
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function safeJsonParse(s, fallback = null) {
  try {
    const t = String(s ?? "").trim();
    if (!t) return fallback;
    return JSON.parse(t);
  } catch {
    return fallback;
  }
}
function clampText120(s) {
  const t = String(s ?? "");
  return t.length > 120 ? t.slice(0, 120) : t;
}

function judgeSocketRoom(roomId) {
  return `judgement:${String(roomId).trim()}`;
}

// ---- in-memory cache + debounce flush（読み過多防止）
const gameCache = new Map(); // roomId -> { state, flushTimer, phaseTimers:{answer,result} }
function scheduleFlushGameToSheet(roomId) {
  const ent = gameCache.get(roomId);
  if (!ent?.state) return;
  if (ent.flushTimer) return;
  ent.flushTimer = setTimeout(async () => {
    ent.flushTimer = null;
    try {
      const sheets = await getSheetsClient();
      const rows = await getJudgeRows(sheets);
      const idx = findJudgeRowIndex(rows, roomId);
      if (idx < 0) return;

      const rowNumber = sheetRowNumberFromIndex(idx);
      await updateJudgeCells(sheets, rowNumber, [
        { col: "G", value: JSON.stringify(ent.state) }, // ★ gameJson
      ]);
    } catch (e) {
      console.error("[game] flush error:", e);
    }
  }, 250); // 0.25sでまとめて書く
}

async function loadGameState(roomId) {
  const cached = gameCache.get(roomId)?.state;
  if (cached) return cached;

  const sheets = await getSheetsClient();
  const rows = await getJudgeRows(sheets);
  const idx = findJudgeRowIndex(rows, roomId);
  if (idx < 0) return null;

  const row = rows[idx];
  const gameJson = row[6]; // G列
  const st = safeJsonParse(gameJson, null);
  if (!st) return null;

  gameCache.set(roomId, { state: st, flushTimer: null, phaseTimers: {} });
  return st;
}

function setGameState(roomId, newState) {
  const ent = gameCache.get(roomId) || { state: null, flushTimer: null, phaseTimers: {} };
  ent.state = newState;
  gameCache.set(roomId, ent);
  scheduleFlushGameToSheet(roomId);
}

// ---- 公開用state（断罪前に「誰がどのカードか」を隠す）
function publicGameView(state) {
  if (!state) return null;

  const phase = state.phase;
  const revealIdentity = (phase === "RESULT" || phase === "GAME_OVER");
  const hideAnswers = (phase === "ANSWER" || phase === "BRIEF" || phase === "INTRO");

  const cards = (state.round?.cards || []).map(c => ({
    slotId: c.slotId,
    avatar: c.avatar,
    answer: hideAnswers ? "???" : (c.answer || ""),
    name: revealIdentity ? (c.kind === "ai" ? "AI" : c.owner) : "???",
    kind: revealIdentity ? c.kind : "???",
    pickedByHunter: revealIdentity ? !!c.pickedByHunter : false,
  }));

  return {
    roomId: state.roomId,
    phase: state.phase,
    roundIndex: state.roundIndex,
    hunter: state.round?.hunter || null, // 狩人名はあなたの仕様通り出してOK
    topic: state.round?.topic || "",
    answerDeadlineAt: state.round?.answerDeadlineAt || null,
    resultDeadlineAt: state.round?.resultDeadlineAt || null,
    picksRequired: state.round?.picksRequired ?? null,
    ranking: state.phase === "GAME_OVER" ? (state.ranking || []) : null,
    stats: state.stats || null,
    cards,
    intro: state.intro || null,
  };
}


async function broadcastGame(io, roomId) {
  const ent = gameCache.get(roomId);
  if (!ent?.state) return;
  io.to(judgeSocketRoom(roomId)).emit("judgement:gameState", publicGameView(ent.state));
}

// ---- AI一括生成（配列だけ返させる）
async function generateAIAnswers(topic, aiCount) {
  const prompt = `
${topic} に関して、感情や価値判断を含む「人間らしい意見」を ${aiCount} 件生成してください。
各意見は **1〜2文**、120文字以内、日本語、装飾なし。
説明文は出力せず、以下形式の配列のみを返してください。
["回答1","回答2"]
`.trim();


  const text = stripJsonFence(await genWithFallback(prompt));
  const arr = safeJsonParse(text, []);
  const out = Array.isArray(arr) ? arr.map(s => clampText120(String(s))).filter(Boolean) : [];
  while (out.length < aiCount) out.push("……（沈黙）");
  return out.slice(0, aiCount);
}

// ---- ラウンド開始
async function startNextRound(io, roomId) {
  const state = await loadGameState(roomId);
  if (!state) throw new Error("game_not_initialized");

  // 全員が狩人を1回やったら終了
  if (!state.remainingHunters || state.remainingHunters.length === 0) {
    // GAME_OVER
    const points = state.stats?.points || {};
    const fp = state.stats?.aiFalsePositives || {};
    const members = state.members || [];

    const ranking = members.map(u => ({
      name: u,
      points: Number(points[u] || 0),
      aiFalsePositives: Number(fp[u] || 0),
    }))
    .sort((a,b) => (b.points - a.points) || (a.aiFalsePositives - b.aiFalsePositives));

    state.phase = "GAME_OVER";
    state.ranking = ranking;
    setGameState(roomId, state);
    await broadcastGame(io, roomId);
    return;
  }

  const hunter = pickOne(state.remainingHunters);
  state.remainingHunters = state.remainingHunters.filter(x => x !== hunter);

  const topic = pickOne(TOPICS);

  const members = state.members || [];
  const resistants = members.filter(x => x !== hunter);

  const aiCount = Number(state.aiCount || 1);
  const totalCards = resistants.length + aiCount;
  if (AVATAR_URLS.length < totalCards) {
    throw new Error(`not_enough_avatars: need ${totalCards}, have ${AVATAR_URLS.length}`);
  }

  const avatars = shuffle(AVATAR_URLS).slice(0, totalCards);
  const cards = [];

  // 人間（レジスタント）カード
  resistants.forEach((u, i) => {
    cards.push({
      slotId: `H:${u}`,
      kind: "human",
      owner: u,
      avatar: avatars[i],
      answer: "",
      pickedByHunter: false,
    });
  });

  // AIカード
  for (let i = 0; i < aiCount; i++) {
    cards.push({
      slotId: `A:${i}`,
      kind: "ai",
      owner: "AI",
      avatar: avatars[resistants.length + i],
      answer: "",
      pickedByHunter: false,
    });
  }

  // シャッフルして配置（見た目順）
  state.roundIndex = (state.roundIndex || 0) + 1;
  state.phase = "ANSWER";
  state.round = {
    hunter,
    topic,
    cards: shuffle(cards),
    picksRequired: resistants.length,
    answerDeadlineAt: nowMs() + 60_000,
    resultDeadlineAt: null,
    ready: {}, // RESULTで使う
  };

  setGameState(roomId, state);
  await broadcastGame(io, roomId);

  // AI生成（非同期）→ でき次第カードに埋める
  generateAIAnswers(topic, aiCount)
    .then(list => {
      const st = gameCache.get(roomId)?.state;
      if (!st || st.phase !== "ANSWER") return;

      let k = 0;
      st.round.cards.forEach(c => {
        if (c.kind === "ai") {
          c.answer = clampText120(list[k] || "……");
          k++;
        }
      });
      setGameState(roomId, st);
      broadcastGame(io, roomId).catch(console.error);
    })
    .catch(e => console.error("[AI answers] error:", e));

  // 60秒締切
  const ent = gameCache.get(roomId);
  if (ent.phaseTimers?.answer) clearTimeout(ent.phaseTimers.answer);
  ent.phaseTimers.answer = setTimeout(async () => {
    try {
      const st = gameCache.get(roomId)?.state;
      if (!st || st.phase !== "ANSWER") return;

      st.phase = "JUDGE";
      // JUDGEに入ったら、カードの回答は確定（そのまま）
      setGameState(roomId, st);
      await broadcastGame(io, roomId);
    } catch (e) {
      console.error("[ANSWER->JUDGE] timer error:", e);
    }
  }, 60_000 + 50);
}

// ---- 初期化（ホストが開始）
async function initGame(io, roomId, aiCount) {
  const sheets = await getSheetsClient();
  const rows = await getJudgeRows(sheets);
  const idx = findJudgeRowIndex(rows, roomId);
  if (idx < 0) throw new Error("room_not_found");

  const row = rows[idx];
  const host = String(row[2] || "");
  const members = parseSlashList(row[3]);

  const st = {
    roomId,
    phase: "INTRO",
    aiCount: Number(aiCount || 1),
    members,
    remainingHunters: shuffle(members), // 全員1回やる（ランダム順の母集団としてもOK）
    roundIndex: 0,
    round: null,
    stats: {
      points: Object.fromEntries(members.map(u => [u, 0])),
      aiFalsePositives: Object.fromEntries(members.map(u => [u, 0])),
    },
    intro: {
      title: "断罪AI",
      text: "AIが勝利した世界。あなたたちは“AIっぽい”言葉で生き延びるレジスタント。狩人は混ざった人間を見抜け。",
    },
    ranking: null,
  };

  // ★ E列へAI数 / ★ B列を対戦中へ / ★ G列へgameJson初期化
  const rowNumber = sheetRowNumberFromIndex(idx);
  await updateJudgeCells(sheets, rowNumber, [
    { col: "E", value: String(st.aiCount) },
    { col: "B", value: "対戦中" },
    { col: "G", value: JSON.stringify(st) },
  ]);

  gameCache.set(roomId, { state: st, flushTimer: null, phaseTimers: {} });
  await broadcastGame(io, roomId);

  // INTROは「表示だけ」なので、すぐ次のラウンドへ進めてもいいし、
  // クライアント側で「世界観OK」ボタン→ startNextRound を叩くでもOK。
  // ここでは自動でラウンド開始にします。
  //await startNextRound(io, roomId);
}

// ---- 狩人の断罪確定 → RESULTへ
async function resolveJudgement(io, roomId, hunterName, pickedSlotIds) {
  const st = gameCache.get(roomId)?.state || await loadGameState(roomId);
  if (!st) throw new Error("game_not_found");
  if (st.phase !== "JUDGE") throw new Error("invalid_phase");

  const round = st.round;
  if (!round) throw new Error("round_missing");
  if (round.hunter !== hunterName) throw new Error("only_hunter");

  const need = Number(round.picksRequired || 0);
  const picked = Array.isArray(pickedSlotIds) ? pickedSlotIds : [];
  const unique = Array.from(new Set(picked.map(String)));

  if (unique.length !== need) throw new Error(`pick_count_must_be_${need}`);

  // マーク
  round.cards.forEach(c => { c.pickedByHunter = unique.includes(c.slotId); });

  // 採点
  let correctHuman = 0;
  let aiFalse = 0;

  round.cards.forEach(c => {
    if (!c.pickedByHunter) return;
    if (c.kind === "human") correctHuman++;
    if (c.kind === "ai") aiFalse++;
  });

  // 狩人得点
  st.stats.points[hunterName] = Number(st.stats.points[hunterName] || 0) + correctHuman;
  // 狩人のAI誤断罪
  st.stats.aiFalsePositives[hunterName] = Number(st.stats.aiFalsePositives[hunterName] || 0) + aiFalse;

  // レジスタント：見抜かれなかったら+1
  round.cards.forEach(c => {
    if (c.kind !== "human") return;
    const u = c.owner;
    const survived = !c.pickedByHunter;
    if (survived) {
      st.stats.points[u] = Number(st.stats.points[u] || 0) + 1;
    }
  });

  // RESULTへ
  st.phase = "RESULT";
  st.round.resultDeadlineAt = nowMs() + 30_000;
  st.round.ready = Object.fromEntries((st.members || []).map(u => [u, false]));

  setGameState(roomId, st);
  await broadcastGame(io, roomId);

  // 30秒タイムアウトで次へ
  const ent = gameCache.get(roomId);
  if (ent.phaseTimers?.result) clearTimeout(ent.phaseTimers.result);
  ent.phaseTimers.result = setTimeout(async () => {
    try {
      const cur = gameCache.get(roomId)?.state;
      if (!cur || cur.phase !== "RESULT") return;
      await startNextRound(io, roomId);
    } catch (e) {
      console.error("[RESULT timeout] error:", e);
    }
  }, 30_000 + 50);
}




// 「今のルーム状態」を1発で作って返す
async function buildJudgeState(roomId) {
  const sheets = await getSheetsClient();
  const rows = await getJudgeRows(sheets);
  const idx = findJudgeRowIndex(rows, roomId);
  if (idx < 0) return null;

  const row = rows[idx];
  const statusB = String(row[1] || "");
  const hostName = String(row[2] || "");
  
  //const members = parseMembers(row[3]);
  const members = parseSlashList(row[3]);
  
  const aiCount = row[4] !== undefined && row[4] !== "" ? Number(row[4]) : null;

  return {
    roomId: String(row[0] || roomId),
    status: statusB,
    hostName,
    members,
    aiCount: Number.isFinite(aiCount) ? aiCount : null,
  };
}

// ルーム内の全員へ最新stateをPush
async function broadcastJudgeState(io, roomId) {
  const state = await buildJudgeState(roomId);
  if (!state) return;
  io.to(judgeSocketRoom(roomId)).emit("judgement:state", state);
}





// --------------------
// ルーム状態取得（ポーリング用）
// --------------------
app.post("/api/judgement/room/state", async (req, res) => {
  const { roomId } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "roomId is required" });

  try {
    const sheets = await getSheetsClient();
    const rows = await getJudgeRows(sheets);
    const idx = findJudgeRowIndex(rows, roomId);
    if (idx < 0) return res.status(404).json({ error: "room_not_found" });

    const row = rows[idx];
    const statusB = row[1] || "";
    const hostName = row[2] || "";
    const members = parseSlashList(row[3]);
    const aiCount = row[4] !== undefined && row[4] !== "" ? Number(row[4]) : null;
    const kicked = parseSlashList(row[5]); // ★ F列

    return res.json({
      roomId: String(row[0]),
      status: normalizeStatusForDisplay(String(statusB)),
      hostName: String(hostName),
      members,
      aiCount: Number.isFinite(aiCount) ? aiCount : null,
      kicked,
    });
  } catch (e) {
    console.error("room/state error:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// --------------------
// ルーム作成
// --------------------
app.post("/api/judgement/room/create", async (req, res) => {
  const { allowRandom, hostName } = req.body || {};
  const err = validateUsername(hostName);
  if (err) return res.status(400).json({ error: err });

  //try {
    const sheets = await getSheetsClient();
    const roomId = await generateUniqueRoomId(sheets);

    const statusB = statusFromAllowRandom(!!allowRandom);
    const initialMembers = hostName; // 作成者は自動参加
    const aiCount = "";             // 最終開始時に反映
    const kicked = "";              // ★ F列

    const gameJson = ""; // ★ G列

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${JUDGE_SHEET_NAME}!A2:G2`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[roomId, statusB, hostName, initialMembers, aiCount, kicked, gameJson]],
    },
  });

  return res.json({ roomId });
});

// --------------------
// ルーム入室（指定ID）
// --------------------
app.post("/api/judgement/room/join", async (req, res) => {
  const { roomId, username } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "roomId is required" });
  const err = validateUsername(username);
  if (err) return res.status(400).json({ error: err });

  try {
    const sheets = await getSheetsClient();
    const rows = await getJudgeRows(sheets);
    const idx = findJudgeRowIndex(rows, roomId);
    if (idx < 0) return res.status(404).json({ error: "room_not_found" });

    const row = rows[idx];
    const statusB = String(row[1] || "");
    const hostName = String(row[2] || "");
    const members = parseSlashList(row[3]);
    const kicked = parseSlashList(row[5]);

    // ★ キック済みは入室不可
    if (includesName(kicked, username)) {
      return res.status(403).json({ error: "kicked" });
    }

    // 対戦中は不可
    if (isInBattle(statusB)) {
      return res.status(409).json({ error: "match_in_progress" });
    }

    // 募集停止中は不可（ホストは入室済みのはず）
    if (isRecruitStopped(statusB) && username !== hostName) {
      return res.status(409).json({ error: "recruit_stopped" });
    }

    const newMembers = addUnique(members, username);

    const rowNumber = sheetRowNumberFromIndex(idx);
    await updateJudgeCells(sheets, rowNumber, [
      { col: "D", value: formatSlashList(newMembers) },
    ]);

    // ★ 追加：Socket.IOで待機部屋へ即時反映（ポーリング不要）
    broadcastJudgeState(io, roomId).catch(console.error);

    return res.json({ ok: true, members: newMembers });
  } catch (e) {
    console.error("room/join error:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// --------------------
// ランダム入室（Bが「状態:ランダム対戦許可」で、募集停止でも対戦中でもない最上段）
// --------------------
app.post("/api/judgement/room/randomJoin", async (req, res) => {
  const { username } = req.body || {};
  const err = validateUsername(username);
  if (err) return res.status(400).json({ error: err });

  try {
    const sheets = await getSheetsClient();
    const rows = await getJudgeRows(sheets);

    let targetIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const statusB = String(rows[i]?.[1] || "");
      const kicked = parseSlashList(rows[i]?.[5]);
      if (!isRandomAllowed(statusB)) continue;
      if (isRecruitStopped(statusB)) continue;
      if (isInBattle(statusB)) continue;
      // ★ キック済みは対象から除外（無限ループ回避）
      if (includesName(kicked, username)) continue;
      targetIdx = i;
      break;
    }

    if (targetIdx < 0) return res.status(404).json({ error: "no_random_room" });

    // ※このAPIは「部屋IDを返すだけ」で、参加者追加は /join が行う設計
    //   反映（broadcast）は /join 側で実行されるのでここは不要

    return res.json({ roomId: String(rows[targetIdx][0]) });
  } catch (e) {
    console.error("room/randomJoin error:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// --------------------
// 募集停止/再開（ホストのみ）
// stop=true で停止、stop=falseで再開
// ※フロントは toggle にしているので stop を省略した場合はトグル
// --------------------
app.post("/api/judgement/room/toggleRecruit", async (req, res) => {
  const { roomId, hostName, stop } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "roomId is required" });
  const err = validateUsername(hostName);
  if (err) return res.status(400).json({ error: err });

  try {
    const sheets = await getSheetsClient();
    const rows = await getJudgeRows(sheets);
    const idx = findJudgeRowIndex(rows, roomId);
    if (idx < 0) return res.status(404).json({ error: "room_not_found" });

    const row = rows[idx];
    const statusB = String(row[1] || "");
    const host = String(row[2] || "");
    if (host !== hostName) return res.status(403).json({ error: "only_host" });
    if (isInBattle(statusB)) return res.status(409).json({ error: "match_in_progress" });

    const currentlyStopped = isRecruitStopped(statusB);
    const shouldStop = (typeof stop === "boolean") ? stop : !currentlyStopped;

    const newStatus = shouldStop ? withRecruitSuffix(statusB) : withoutRecruitSuffix(statusB);

    const rowNumber = sheetRowNumberFromIndex(idx);
    await updateJudgeCells(sheets, rowNumber, [{ col: "B", value: newStatus }]);

    // ★ 追加：Socket.IOで待機部屋へ即時反映
    broadcastJudgeState(io, roomId).catch(console.error);

    return res.json({ ok: true, status: normalizeStatusForDisplay(newStatus) });
  } catch (e) {
    console.error("room/toggleRecruit error:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// --------------------
// 「このメンバーで遊ぶ！」（募集締切）＝ホストが募集停止にする
// 既に募集停止ならOK（冪等）
// --------------------
app.post("/api/judgement/room/lockForStart", async (req, res) => {
  const { roomId, hostName } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "roomId is required" });
  const err = validateUsername(hostName);
  if (err) return res.status(400).json({ error: err });

  try {
    const sheets = await getSheetsClient();
    const rows = await getJudgeRows(sheets);
    const idx = findJudgeRowIndex(rows, roomId);
    if (idx < 0) return res.status(404).json({ error: "room_not_found" });

    const row = rows[idx];
    const statusB = String(row[1] || "");
    const host = String(row[2] || "");
    if (host !== hostName) return res.status(403).json({ error: "only_host" });
    if (isInBattle(statusB)) return res.status(409).json({ error: "match_in_progress" });

    const newStatus = withRecruitSuffix(statusB);

    const rowNumber = sheetRowNumberFromIndex(idx);
    await updateJudgeCells(sheets, rowNumber, [{ col: "B", value: newStatus }]);

    // ★ 追加：Socket.IOで待機部屋へ即時反映
    broadcastJudgeState(io, roomId).catch(console.error);

    return res.json({ ok: true, status: normalizeStatusForDisplay(newStatus) });
  } catch (e) {
    console.error("room/lockForStart error:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// --------------------
// キック（ホストのみ）
// Dから除外 + Fへ追記（/区切り）
// --------------------
app.post("/api/judgement/room/kick", async (req, res) => {
  const { roomId, hostName, targetName } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "roomId is required" });
  const e1 = validateUsername(hostName);
  if (e1) return res.status(400).json({ error: e1 });
  const e2 = validateUsername(targetName);
  if (e2) return res.status(400).json({ error: e2 });

  try {
    const sheets = await getSheetsClient();
    const rows = await getJudgeRows(sheets);
    const idx = findJudgeRowIndex(rows, roomId);
    if (idx < 0) return res.status(404).json({ error: "room_not_found" });

    const row = rows[idx];
    const statusB = String(row[1] || "");
    const host = String(row[2] || "");
    if (host !== hostName) return res.status(403).json({ error: "only_host" });
    if (isInBattle(statusB)) return res.status(409).json({ error: "match_in_progress" });
    if (targetName === host) return res.status(400).json({ error: "cannot_kick_host" });

    const members = parseSlashList(row[3]);
    const kicked = parseSlashList(row[5]);

    const newMembers = removeName(members, targetName);
    const newKicked = addUnique(kicked, targetName);

    const rowNumber = sheetRowNumberFromIndex(idx);
    await updateJudgeCells(sheets, rowNumber, [
      { col: "D", value: formatSlashList(newMembers) },
      { col: "F", value: formatSlashList(newKicked) },
    ]);

    // ★ 追加：Socket.IOで待機部屋へ即時反映
    broadcastJudgeState(io, roomId).catch(console.error);

    return res.json({ ok: true, members: newMembers, kicked: newKicked });
  } catch (e) {
    console.error("room/kick error:", e);
    return res.status(500).json({ error: "server_error" });
  }
});

// --------------------
// 最終開始（ホストのみ）
// ここで初めて E列 aiCount を反映し、B列を対戦中へ
// --------------------
/*app.post("/api/judgement/room/finalStart", async (req, res) => {
  const { roomId, hostName, aiCount } = req.body || {};
  if (!roomId) return res.status(400).json({ error: "roomId is required" });
  const err = validateUsername(hostName);
  if (err) return res.status(400).json({ error: err });

  const n = Number(aiCount);
  if (!Number.isInteger(n) || n < 1) {
    return res.status(400).json({ error: "aiCount must be integer (>=1)" });
  }

  try {
    const sheets = await getSheetsClient();
    const rows = await getJudgeRows(sheets);
    const idx = findJudgeRowIndex(rows, roomId);
    if (idx < 0) return res.status(404).json({ error: "room_not_found" });

    const row = rows[idx];
    const statusB = String(row[1] || "");
    const host = String(row[2] || "");
    const members = parseSlashList(row[3]);

    if (host !== hostName) return res.status(403).json({ error: "only_host" });
    if (isInBattle(statusB)) return res.status(409).json({ error: "match_in_progress" });

    // 募集停止されていないなら、最終開始の前提が崩れるので止める（任意）
    if (!isRecruitStopped(statusB)) {
      return res.status(409).json({ error: "not_locked" });
    }

    // 上限: 参加人数*3（要望）
    const maxAI = Math.max(1, members.length * 3);
    if (n > maxAI) {
      return res.status(400).json({ error: `aiCount too large (max ${maxAI})` });
    }

    const rowNumber = sheetRowNumberFromIndex(idx);
    await updateJudgeCells(sheets, rowNumber, [
      { col: "E", value: String(n) },
      { col: "B", value: "対戦中" }, // 募集停止は不要なので剥がす
    ]);

    // ★ 追加：Socket.IOで待機部屋へ即時反映（対戦中になったことも伝わる）
    broadcastJudgeState(io, roomId).catch(console.error);

    return res.json({ ok: true, aiCount: n });
  } catch (e) {
    console.error("room/finalStart error:", e);
    return res.status(500).json({ error: "server_error" });
  }
});*/
app.get("/api/judgement/room/state", async (req, res) => {
  console.warn("[DEPRECATED] /api/judgement/room/state called", {
    ip: req.ip,
    ua: req.headers["user-agent"],
    t: new Date().toISOString(),
  });
  return res.status(410).json({ error: "deprecated_use_socket" });
});














// ログイン時に呼ぶ：既存ユーザーかどうかチェック
app.post("/api/user/lookup", async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.json({ exists: false });
    }
    return res.json({
      exists: true,
      username: user.username,
      displayName: user.displayName,
    });
  } catch (e) {
    console.error("lookup error:", e);
    return res.status(500).json({ error: "server_error" });
  }
});



// 初回ログイン時：ユーザーネーム登録
app.post("/api/user/register", async (req, res) => {
  const { email, username, googleDisplayName } = req.body || {};

  if (!email || !username) {
    return res.status(400).json({ error: "email and username are required" });
  }

  try {
    // すでに存在するならそのまま返す（2重登録防止）
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.json({
        exists: true,
        username: existing.username,
        displayName: existing.displayName,
      });
    }

    const user = await addUser({
      email,
      username,
      displayName: googleDisplayName || "",
    });

    return res.json({
      exists: true,
      username: user.username,
      displayName: user.displayName,
    });
  } catch (e) {
    console.error("register error:", e);
    return res.status(500).json({ error: "server_error" });
  }
});



























// ---------- Gemini API 初期化 ----------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });
//const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
// ★追加：429/Quota時に flash-lite に切替えて再試行する共通関数
async function genWithFallback(prompt, options = {}) {
  const primary = "gemini-2.5-flash";
  const fallback = "gemini-2.5-flash-lite";
  try {
    const m = genAI.getGenerativeModel({ model: primary, ...options });
    const res = await m.generateContent(prompt);
    return res.response.text();
  } catch (err) {
    const msg = String(err?.message || "");
    const code = err?.status || err?.statusText || "";
    const isQuota =
      code === 429 ||
      /Too Many Requests|QuotaFailure|Resource has been exhausted/i.test(msg);
    if (!isQuota) throw err;
    // 429系だけフォールバック
    console.warn(`[Gemini] ${primary} quota hit. Fallback to ${fallback}`);
    // もしエラーメッセージに retryDelay が含まれていたら軽く待つ
    await new Promise(r => setTimeout(r, 2000));
    const m2 = genAI.getGenerativeModel({ model: fallback, ...options });
    const res2 = await m2.generateContent(prompt);
    return res2.response.text();
  }
}

function stripJsonFence(s) {
  return typeof s === "string" ? s.replace(/^```json\s*|\s*```$/g, "") : s;
}

// ---------- エンディング（最終日）用：キャラ話法スタイル ----------
const CHARACTER_STYLE = {
  ミユ: `
【性格】明るく元気で素直。感情が顔に出やすい。少し甘えん坊。
【話し方】テンション高め、感嘆詞多め（〜だねっ！ 〜じゃん！ など）
【呼称】相手は基本「呼び捨て」`,
  シオン: `
【性格】無口で真面目。不器用だが根は優しい。ツンデレ傾向。
【話し方】丁寧で冷静。ちょっと心配症。
【呼称】相手は「さん」付け`,
  ナナ: `
【性格】落ち着きがあり柔らかい。時々ミステリアス。面倒見が良い。
【話し方】丁寧でやわらかい。少し含みのある冗談も。
【呼称】相手は「くん」付け`,
};

// ---------- 共通プロファイル ----------
function profileBlock(playername) {
  return {
    ミユ: `
【関係性】${playername}の幼馴染。呼び方は「${playername}」と呼び捨て。
【性格】明るく元気で素直。感情が顔に出やすい。少し甘えん坊。
【話し方】テンション高め、感嘆詞多め（〜だねっ！ 〜じゃん！ など）
【好き】海・夏祭り・ラムネ
【苦手】静かな場所・長時間の読書
【一人称】あたし
`,
    シオン: `
【関係性】${playername}のクラスメイト。呼び方は「${playername}さん」。
【性格】無口で真面目。不器用だが根は優しい。ツンデレ傾向。
【話し方】丁寧で冷静。ちょっと心配症。
【好き】神社・静かな景色・本
【苦手】騒がしい場所・大人数の会話
【一人称】私
`,
    ナナ: `
【関係性】近所のカフェで働く年上の先輩。呼び方は「${playername}くん」。
【性格】落ち着きがあり柔らかい。時々ミステリアス。面倒見が良い。
【話し方】丁寧でやわらかい。少し含みのある冗談も。
【好き】カフェ・商店街・紅茶
【苦手】騒がしい場所・虫
【一人称】私
`,
  };
}

// ===== 休みイベント：台詞生成（訪問／意趣返し／冷笑） =====
function jsonOnly(s){ return typeof s === "string" ? s.replace(/^```json\s*|\s*```$/g, "") : s; }
async function generateRestDialogue(payload) {
  // payload = { playername, visitors:["ミユ","シオン",...], type:"visit"|"spite"|"mock", reasonKey, reasonLabel, likabilities:{ミユ:number,シオン:number,ナナ:number} }
  const {
    playername = "プレイヤー",
    visitors = [],
    type = "visit",
    reasonLabel = "体調不良",
    likabilities = {}
  } = payload || {};

  // トーン定義
  const tone =
    type === "visit" ? "優しく励ます、見舞いにふさわしい口調（温かい）" :
    type === "spite" ? "きつく刺すような皮肉（意趣返し）。暴力・過度な罵倒は避けるが、冷淡さは明確。" :
    "軽く見下すような冷笑（ドライ）。罵倒や暴力表現は避ける。";

  // 来訪者が空の場合は最小のフォールバック（通常、クライアント側で呼ばれない想定）
  if (!Array.isArray(visitors) || visitors.length === 0) {
    return [{ name: playername, message: "今日はおとなしく休むしかないな……。" }];
  }

  const profiles = profileBlock(playername);
  const joinedProfiles = visitors.map(ch => `【${ch}】\n${profiles[ch] || ""}`).join("\n");
  const likeTable = Object.entries(likabilities).map(([k,v])=>`${k}:${v}`).join(", ");

  const prompt = `
あなたは恋愛ADVの脚本家です。**出力は必ず JSON 配列のみ**にしてください。コードフェンス・地の文・括弧書きは禁止。

【状況】
- プレイヤー名: ${playername}
- 理由: ${reasonLabel}（1回休み）
- 来訪者: ${visitors.join("・")}
- 来訪タイプ: ${type}（visit=見舞い / spite=意趣返し / mock=冷笑）
- 各キャラの${playername}への好感度: ${likeTable || "不明"}

【キャラ設定（話し方・呼称の参考）】
${joinedProfiles}

【会話方針】
- 会話は ${visitors.join("・")} と ${playername} のセリフだけで進める。三人称ナレーション禁止。
- 1人の来訪者につき最低2回は喋らせる。プレイヤー（${playername}）も適度に応じる。
- プレイヤーの一人称は「俺」。
- ${tone}
- ${reasonLabel} を自然に会話へ織り込む（毎行に入れる必要はない）。

【ボリューム】
- 全体で 6〜12 行程度。

【出力形式（これ以外は絶対に出力しない）】
[
  {"name":"登場人物名","message":"セリフ"},
  ...
]
`.trim();

  const text = jsonOnly(await genWithFallback(prompt));
  let arr;
  try {
    arr = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned non-JSON");
  }
  // 整形＆バリデーション
  const cleaned = (Array.isArray(arr) ? arr : [])
    .filter(l => l && typeof l.name === "string" && typeof l.message === "string")
    .map(l => ({ name: l.name.trim(), message: l.message.trim() }))
    .filter(l => l.name && l.message);

  if (!cleaned.length) {
    // フォールバック：非常に短い来訪
    const who = visitors[0];
    return [
      { name: who,        message: `${playername}、${reasonLabel}って聞いて…大丈夫？` },
      { name: playername, message: "心配かけた。来てくれて助かったよ。" }
    ];
  }
  return cleaned;
}
// 明示フォールバック（生成失敗時）
function fallbackRestDialogue(payload) {
  const { playername, visitors = [], type = "visit", reasonLabel = "体調不良" } = payload || {};
  if (!visitors.length) {
    return [{ name: playername, message: "今日は休もう……。" }];
  }
  const lines = [];
  visitors.forEach(v => {
    if (type === "visit") {
      lines.push({ name: v,          message: `${playername}、${reasonLabel}だって？無理しないで。` });
      lines.push({ name: playername, message: "ありがとな。少し元気出た。" });
    } else if (type === "spite") {
      lines.push({ name: v,          message: `${reasonLabel}ね。…前の仕返し、ってわけじゃないけど。` });
      lines.push({ name: playername, message: "今日は勘弁してくれ……。" });
    } else {
      lines.push({ name: v,          message: `${reasonLabel}？…そっか。そうなんだ。` });
      lines.push({ name: playername, message: "…………。" });
    }
  });
  return lines;
}


// ---------- 通常（1対1）イベント ----------
async function generateGameEvent(character, place, likability, playername) {
  const characterProfiles = profileBlock(playername);

  const prompt = `
あなたの名前は${character}です。
特徴:${characterProfiles[character]}

ここは海辺の町「潮風町」。今、${place.name}（詳細: ${place.detail}）で${playername}（＝プレイヤー）と出会いました。
あなたの${playername}への現在の好感度は ${likability}です。(0は顔見知り程度、100は大大大好き！　0未満は嫌い。-30は顔も見たくない。 -60はいっその事殺したいレベル)
以下の要件をもとに、イベントを1つ生成してください：

【登場シーン】
- ${playername}が${place.name}に到着すると、偶然${character}と出会う。
- キャラの性格に合ったセリフを描写してください。

【会話・描写】
- あなたは${playername}に話しかけます
- 好感度が低いほど素っ気なく、好感度が高いほど親密さ・照れ・冗談などを含めてください。
- 口調や一人称も個性に沿って統一してください。
- 〇〇等のplaceholderは使用しないこと。
- messageは短く、playerの選択肢を促すものにすること。
- choicesの各選択肢は、一見どちらも好感度が上昇しそうな文章にしてください。ただし、実際はどちらか一方は好感度を-にしてください。
- プレイヤーの一人称は「俺」です
- messageは${character}がプレイヤーである${playername}に直接話しかけるセリフに限定すること。
- 三人称ナレーションは禁止（例:「${playername}さんが現れた」「${character}は目を見開いた」などの記述はNG）。
- あなた（${character}）は、今この瞬間に目の前にいる${playername}に向けて、何かを話しかけるつもりで書いてください。
- 好感度がマイナスの場合、その値に応じて毛嫌いすること。0未満は嫌い。-30は顔も見たくない。 -60はいっその事殺したいレベルです。

【選択肢】
- ${playername}がどう返すかを選べる2つの選択肢を用意してください。
- 絶対に、一見どちらも好感度が上昇しそうな選択肢にすること。これは必ず守りなさい。
- 各選択肢には、好感度の変化（-15〜15の整数）を指定してください。

【出力形式】※このJSON以外の出力は絶対に含めないこと。改行は\nで表現すること。brは用いないでください。
{
  "message": "${character}の質問（1文。好感度がマイナスなら毛嫌いする）",
  "choices": [
     {
      "text": "選択肢1（${playername}の返答。1文）",
      "likabilityChange": 整数値（例: -5）,
       "reaction": "選択肢1を選んだ後の${character}の返答（1文。一見好感度が上昇しそうな文章）"
    },
    {
      "text": "選択肢2（${playername}の返答。1文）",
      "likabilityChange": 整数値（例: 10）,
      "reaction": "選択肢2を選んだ後の${character}の返答（1文。一見好感度が上昇しそうな文章）"
    }
  ]
}
`.trim();

  try {
     const text = await genWithFallback(prompt);
    const jsonString = text.replace(/^```json\n?|\n?```$/g, "");
    console.log(jsonString);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("❌ Gemini API Error (1v1):", error);
    return {
      message: "（AIが考え中です…少し待ってね）",
      choices: [
        { text: "うん、待つよ", likabilityChange: 0, reaction: "ありがとう！" },
        { text: "また今度で", likabilityChange: 0, reaction: "そ、そうだね…" },
      ],
    };
  }
}

// ---------- 盆踊り（選択肢なし・甘々会話：台詞配列） ----------
async function generateFestivalDialogue(
  characters,
  place,
  likabilities,
  playername,
  condition // ★ 追加: "風邪気味" / "迷子だった" / "スマホを失くした" / "海に落ちて濡れている" など or null
) {
  const profiles = profileBlock(playername);
  const joinedProfiles = characters
    .map((ch) => `【${ch}】\n${profiles[ch]}`)
    .join("\n");
  const likeTable = Object.entries(likabilities || {})
    .map(([ch, v]) => `${ch}: ${v}`)
    .join(", ");

  const condLine = condition
    ? `- ${playername}は現在「${condition}」。体調／不調の様子に軽く触れつつ、からかいすぎたり重くしすぎない。`
    : "- 特筆する不調はなし。";

  const prompt = `
あなたは恋愛イベントの脚本家です。出力は必ず指定のJSONのみ。

【登場キャラ】${characters.join("・")}（プレイヤー: ${playername}）
【好感度】${likeTable || "不明"}
【場所】${place.name}（詳細: ${place.detail}）
${condLine}

【性格・話し方】
${joinedProfiles}

【要件】
- 盆踊り当夜の「甘めの会話」。
- キャラが複数なら、全員が最低2回は話す。プレイヤー（${playername}）も適度に応じる。
- 三人称の地の文は不可。必ず話し言葉（1行目のみ）。
- プレースホルダー、コードフェンス禁止。余計なキー禁止。
- 登場キャラ以外のキャラは絶対に出現させない。

【出力の形】
[
  { "name": "ミユ", "message": "～" },
  { "name": "${playername}", "message": "～" },
  { "name": "ナナ", "message": "～" }
  *全体で6行以上
]
`.trim();

  try {
    const text = stripJsonFence(await genWithFallback(prompt));
    return JSON.parse(text);
  } catch (e) {
    console.error("❌ Gemini API Error (festival lines):", e);
    const who = characters[0] || "ミユ";
    return [
      { name: who,         message: `${playername}${who === "シオン" ? "さん" : who === "ナナ" ? "くん" : ""}、隣、いい？` },
      { name: playername,  message: "もちろん。…手、繋いでもいい？" },
      { name: who,         message: "…うん。太鼓、近くで一緒に聞こ？" },
    ];
  }
}


// ---------- キャラごとの呼称（呼び捨て／さん／くん） ----------
function formatNameFor(character, playername) {
  if (!playername) return "";
  if (character === "シオン") return `${playername}さん`;
  if (character === "ナナ") return `${playername}くん`;
  return playername; // ミユ=呼び捨て
}

function rejectionBandFromLike(like) {
  // 好感度に応じてトーンを4段階に
  if (like >= 0) return 0;        // 0〜：ふつうの拒絶
  if (like >= -30) return 1;      // -1〜-30：冷たく/嫌いを明言
  if (like >= -60) return 2;      // -31〜-60：強い拒絶＋距離/通報の示唆
  return 3;                       // -61以下：非常に強い拒絶＋通報を明言
}

// ---------- 各キャラの最終返事モノローグ（台詞配列） ----------
async function generateEndingMonologue(character, entries, okName) {
  if (!entries || entries.length === 0) return [];

  const style = CHARACTER_STYLE[character] || "";
  const names = entries.map((e) => e.playername);
  const listForPrompt = names.map((n) => `- ${n}`).join("\n"); // ← 名前のみ
  const isSingle = entries.length === 1;
  const soleName = isSingle ? names[0] : null;
  const okToName = okName ? formatNameFor(character, okName) : null;

  // ---- ケース分岐：お断り（accepted が null） ----
  if (!okName) {
    // 単独告白への丁寧なお断り
    if (isSingle) {
      const toSole = formatNameFor(character, soleName);
      const finalLike = Number(entries[0]?.finalLike ?? 0);
      const band = rejectionBandFromLike(finalLike);
      try {
        const prompt = `
あなたは${character}です。以下の条件で台詞を返してください。
${style}

【状況】
告白してきたのは${toSole}。
今は付き合えないため、お断りします。
相手への最終好感度は ${finalLike} です。拒絶トーンの強さは次のLEVELに従ってください：
LEVEL 0: 丁寧に感謝し、穏やかにお断り。
LEVEL 1: はっきり嫌い/合わないと伝え、突き放す。
LEVEL 2: 非常に強い拒絶。即時に関わりを断つことを厳しく明言。「これ以上は警察に通報します」を明言。
LEVEL 3: さらに強い拒絶。泥を投げるなどの行為も行ってください。
採用するLEVELは ${band} です。

【要件】
- 出力はJSON配列のみ。各要素は {"name":"${character}","message":"…"} 形式。
- ${toSole}に話しかけてください。
- 三人称の地の文やプレースホルダー禁止。

【出力の形】
[
  {"name":"${character}","message":"…"},
  {"name":"${character}","message":"…"},
  *全体で6行以上
]
`.trim();
         const text = stripJsonFence(await genWithFallback(prompt));
        const arr = JSON.parse(text);
        return arr
          .map((l) => ({
            name: character,
            message: String(l.message || "").trim(),
          }))
          .filter((l) => l.message);
      } catch (e) {
        console.error("❌ Gemini API Error (ending reject/single):", e);
        return [
          {
            name: character,
            message: `${toSole}、想いを伝えてくれて本当にありがとう。`,
          },
          {
            name: character,
            message: "でも、今は気持ちに応えられないの。ごめんね。",
          },
          {
            name: character,
            message: "大切に思ってるからこそ、曖昧にはできないんだ。",
          },
        ];
      }
    }
    // 複数から来たがお断り
    try {
      const prompt = `
あなたは${character}です。以下の条件で「丁寧なお断り」だけを台詞で返してください。
${style}

【状況】
複数人から告白されたが、今は誰にもOKを出さないと決めている。
【告白してきた相手】
${listForPrompt}
全員への感謝(告白してきた人の名前をちゃんと呼ぶこと)→今は答えられない旨→優しい締め　という流れにすること

【出力の形】
[
  {"name":"${character}","message":"…"},
  {"name":"${character}","message":"…"},
  *全体で6行以上
]
`.trim();
       const text = stripJsonFence(await genWithFallback(prompt));
      const arr = JSON.parse(text);
      return arr
        .map((l) => ({
          name: character,
          message: String(l.message || "").trim(),
        }))
        .filter((l) => l.message);
    } catch (e) {
      console.error("❌ Gemini API Error (ending reject/multi):", e);
      return [
        { name: character, message: "想いを伝えてくれて…本当にありがとう。" },
        {
          name: character,
          message: "ごめんね、今は誰にも『はい』って言えないの。",
        },
        {
          name: character,
          message: "大切に受け取ったから、きっと忘れないよ。",
        },
      ];
    }
  }

  // ---- ケース分岐：OK を伝える（accepted が存在） ----
  const winnerAddress = okToName;

  // 単独告白 → 誰かと「比べる・選ぶ」表現は禁止
  if (isSingle) {
    const toSole = formatNameFor(character, soleName);
    try {
      const prompt = `
あなたは${character}です。以下の条件で「OKの返事」だけを台詞で返してください。
${style}

【状況】
告白してきたのは「${toSole}」
あなたは既に ${winnerAddress} にOKを伝えると決めています。

【要件】
- 感謝→少しの照れ→最後に「${winnerAddress}」の名前を入れてはっきりOK。
- 「誰を選ぶ／迷う／比較する」趣旨の表現は絶対に使わない。
- プレースホルダー、三人称の地の文は禁止。

【出力の形】
[
  {"name":"${character}","message":"…"},
  {"name":"${character}","message":"…"},
  *全体で6行以上
]
`.trim();
       const text = stripJsonFence(await genWithFallback(prompt));
      const arr = JSON.parse(text);
      const out = arr
        .map((l) => ({
          name: character,
          message: String(l.message || "").trim(),
        }))
        .filter((l) => l.message);

      const last = out[out.length - 1]?.message || "";
      if (!last.includes(okName)) {
        out.push({
          name: character,
          message: `${winnerAddress}——私の答えは、OKだよ。これから、よろしくね。`,
        });
      }
      return out;
    } catch (e) {
      console.error("❌ Gemini API Error (ending ok/single):", e);
      return [
        { name: character, message: `${winnerAddress}、告白…嬉しかった。` },
        { name: character, message: "私もね、ずっと君のことを考えてたの。" },
        {
          name: character,
          message: `${winnerAddress}、私の答えはOK。これから、よろしくね。`,
        },
      ];
    }
  }

  // 複数からの告白 → 少し迷いOK。ただしOK相手は固定で明示。
  const prompt = `
あなたは${character}です。以下の条件で、セリフだけの短い台本（JSON配列）を作成してください。
${style}

【告白してきた相手（名前のみ）】
${listForPrompt}

【必ずOKを出す相手（確定済み・変更不可）】
- ${okName}（呼び方は「${winnerAddress}」）

【要件】
- 最初は全員への感謝(全員の名前をちゃんと呼ぶ))中盤で“少しだけ”迷いをにじませる→最後は「${winnerAddress}」を名指しでOK。
- プレイヤー側の台詞は入れない。三人称の地の文とプレースホルダーは禁止。

【出力の形】
[
  {"name":"${character}","message":"…"},
  {"name":"${character}","message":"…"},
  *全体で6行以上
]
`.trim();

  try {
    const text = stripJsonFence(await genWithFallback(prompt));
    const arr = JSON.parse(text);
    const out = arr
      .map((l) => ({
        name: character,
        message: String(l.message || "").trim(),
      }))
      .filter((l) => l.message);
    const last = out[out.length - 1]?.message || "";
    if (!last.includes(okName)) {
      out.push({
        name: character,
        message: `${winnerAddress}——私の答えは、OKだよ。これから、よろしくね。`,
      });
    }
    return out;
  } catch (e) {
    console.error("❌ Gemini API Error (ending ok/multi):", e);
    return [
      {
        name: character,
        message: "みんな、想いを伝えてくれて…本当にありがとう。",
      },
      { name: character, message: "たくさん考えたけど、やっと決められた。" },
      {
        name: character,
        message: `${winnerAddress}——私の気持ちは、あなたに向いてる。よろしくね。`,
      },
    ];
  }
}

// ---------- エンディング（最終日）全体台本 ----------
async function generateEndingDialogue(groups, accepted) {
  // groups: { ミユ:[{playername,steps,bonus,baseLike,finalLike}], シオン:[...], ナナ:[...] }
  const order = ["ミユ", "シオン", "ナナ"]; // ミユ→シオン→ナナの順に返事
  const allLines = [];

  for (const ch of order) {
    const entries = Array.isArray(groups?.[ch]) ? groups[ch] : [];
    if (!entries.length) continue; // ← 追加：ゼロはスキップ
    const okName = accepted?.[ch] ?? null;
    const lines = await generateEndingMonologue(ch, entries, okName);
    allLines.push(...lines);
  }
  return allLines;
}

// ---------- 逆告白（割り込み） ----------
async function generateReverseMonologue(character, playername) {
  const style = CHARACTER_STYLE[character] || "";
  const toName = formatNameFor(character, playername);

  const prompt = `
あなたは${character}です。以下の条件で短い逆告白のセリフ台本（JSON配列）を出力してください。
${style}

【状況】
エンディング後、${toName}に向けて呼び止め、あなたのほうから逆告白をする。

【出力要件】
- 1行目は必ず「まって！！」で始めてください。
- 最後の台詞では、${toName}に「好き」「付き合って」等を明言し、必ず名前（${toName}）を含めてください。
- プレースホルダー（〇〇など）と三人称ナレーションは禁止です。

【出力の形】
[
  {"name":"${character}","message":"まって！！"},
  {"name":"${character}","message":"…"},
  {"name":"${character}","message":"…"},
  *全体で6行以上
]
`.trim();

  try {
    const text = stripJsonFence(await genWithFallback(prompt));
    let arr = JSON.parse(text);

    // 空メッセージ除去
    arr = (Array.isArray(arr) ? arr : []).filter(
      (l) => l && typeof l.message === "string" && l.message.trim(),
    );

    // 不正 or 全部空ならフォールバック
    if (!arr.length) throw new Error("Empty reverse confession lines");

    // name 正規化 & 文面トリム
    return arr.map((l) => ({
      name: character,
      message: String(l.message).trim(),
    }));
  } catch (e) {
    console.error("❌ Gemini API Error (reverse confession):", e);
    return [
      { name: character, message: "まって！！" },
      {
        name: character,
        message: `${toName}…私から言わせて。ずっと、あなたが好き。`,
      },
      { name: character, message: "よかったら…わたしと、付き合ってください。" },
    ];
  }
}

// ---------- Socket.io ----------
io.on("connection", (socket) => {
  console.log("✅ client connected:", socket.id);


  if (window.currentUser?.username) {
    socket.emit("judgement:auth", { username: window.currentUser.username });
  }
  
  // ---- クライアントが自分のusernameを紐付ける（必須）
  socket.on("judgement:auth", ({ username } = {}) => {
    socket.data.username = String(username || "").trim();
  });

  // ---- 待機ルーム監視（あなたの既存 watch をこちらへ寄せる）
  socket.on("judgement:watch", async ({ roomId } = {}) => {
    const rid = String(roomId || "").trim();
    if (!rid) return;

    socket.join(judgeSocketRoom(rid));

    // 待機状態（members等）を1回だけpush（あなたの broadcastJudgeState を使うならそれでもOK）
    try {
      const st = await buildJudgeState(rid);
      if (st) socket.emit("judgement:state", st);
    } catch (e) {
      console.error("[judgement:watch] buildJudgeState error:", e);
    }

    // ゲームが既に始まっているなら gameState もpush
    try {
      const g = await loadGameState(rid);
      if (g) socket.emit("judgement:gameState", publicGameView(g));
    } catch (e) {
      console.error("[judgement:watch] loadGameState error:", e);
    }
  });

  socket.on("judgement:unwatch", ({ roomId } = {}) => {
    const rid = String(roomId || "").trim();
    if (!rid) return;
    socket.leave(judgeSocketRoom(rid));
  });

  // ---- ホスト：ゲーム開始（E列へAI数→G列初期化→ラウンド開始）
  socket.on("judgement:gameStart", async ({ roomId, aiCount } = {}) => {
    try {
      const rid = String(roomId || "").trim();
      const me = String(socket.data.username || "").trim();
      if (!rid) throw new Error("roomId_required");
      if (!me) throw new Error("not_authed");

      // host判定（シートから確認）
      const sheets = await getSheetsClient();
      const rows = await getJudgeRows(sheets);
      const idx = findJudgeRowIndex(rows, rid);
      if (idx < 0) throw new Error("room_not_found");
      const host = String(rows[idx]?.[2] || "");
      if (host !== me) throw new Error("only_host");

      await initGame(io, rid, Number(aiCount || 1));
    } catch (e) {
      console.error("[judgement:gameStart] error:", e);
      socket.emit("judgement:error", { message: String(e.message || e) });
    }
  });

socket.on("judgement:roundOk", async ({ roomId } = {}) => {
  try {
    const rid = String(roomId || "").trim();
    const me = String(socket.data.username || "").trim();
    if (!rid) throw new Error("roomId_required");
    if (!me) throw new Error("not_authed");

    const st = gameCache.get(rid)?.state || await loadGameState(rid);
    if (!st) throw new Error("game_not_found");
    if (st.phase !== "BRIEF") throw new Error("invalid_phase");

    if (st.round?.briefReady && typeof st.round.briefReady === "object") {
      st.round.briefReady[me] = true;
    }
    setGameState(rid, st);
    await broadcastGame(io, rid);

    const allReady = Object.values(st.round.briefReady || {}).every(v => v === true);
    if (!allReady) return;

    // ★ 全員OK → ANSWER開始
    st.phase = "ANSWER";
    st.round.answerDeadlineAt = nowMs() + 120_000; // ★120秒
    setGameState(rid, st);
    await broadcastGame(io, rid);

    // ★ 120秒締切タイマー
    const ent = gameCache.get(rid);
    if (ent.phaseTimers?.answer) clearTimeout(ent.phaseTimers.answer);
    ent.phaseTimers.answer = setTimeout(async () => {
      try {
        const cur = gameCache.get(rid)?.state;
        if (!cur || cur.phase !== "ANSWER") return;
        cur.phase = "JUDGE";
        setGameState(rid, cur);
        await broadcastGame(io, rid);
      } catch (e) {
        console.error("[ANSWER->JUDGE] timer error:", e);
      }
    }, 120_000 + 50);

  } catch (e) {
    socket.emit("judgement:error", { message: String(e.message || e) });
  }
});


socket.on("judgement:introOk", async ({ roomId } = {}) => {
  try {
    const rid = String(roomId || "").trim();
    const me = String(socket.data.username || "").trim();
    if (!rid) throw new Error("roomId_required");
    if (!me) throw new Error("not_authed");

    const st = gameCache.get(rid)?.state || await loadGameState(rid);
    if (!st) throw new Error("game_not_found");
    if (st.phase !== "INTRO") throw new Error("invalid_phase");

    // ホストだけ進める運用にしたいならここで host判定してもOK
    await startNextRound(io, rid); // ★ここで初ラウンド（BRIEF）へ
  } catch (e) {
    socket.emit("judgement:error", { message: String(e.message || e) });
  }
});


  // ---- レジスタント：回答提出（上書き可、120字、ANSWERフェーズのみ）
  socket.on("judgement:submitAnswer", async ({ roomId, text } = {}) => {
    try {
      const rid = String(roomId || "").trim();
      const me = String(socket.data.username || "").trim();
      if (!rid) throw new Error("roomId_required");
      if (!me) throw new Error("not_authed");

      const st = gameCache.get(rid)?.state || await loadGameState(rid);
      if (!st) throw new Error("game_not_found");
      if (st.phase !== "ANSWER") throw new Error("invalid_phase");

      if (st.round?.hunter === me) throw new Error("hunter_cannot_answer");
      if (nowMs() > Number(st.round?.answerDeadlineAt || 0)) throw new Error("deadline_passed");

      const t = clampText120(String(text || "").replace(/\r/g, ""));
      // 空も許容するならここを緩める。今回は「1人1件」なので空は弾く。
      if (!t.trim()) throw new Error("empty_answer");

      // 自分のカードへ書く（H:username）
      const slotId = `H:${me}`;
      const card = (st.round?.cards || []).find(c => c.slotId === slotId);
      if (!card) throw new Error("not_resistant");

      card.answer = t;

      setGameState(rid, st);
      await broadcastGame(io, rid);
    } catch (e) {
      socket.emit("judgement:error", { message: String(e.message || e) });
    }
  });

  // ---- 狩人：断罪確定（JUDGEフェーズ）
  socket.on("judgement:judgePick", async ({ roomId, pickedSlotIds } = {}) => {
    try {
      const rid = String(roomId || "").trim();
      const me = String(socket.data.username || "").trim();
      if (!rid) throw new Error("roomId_required");
      if (!me) throw new Error("not_authed");
      await resolveJudgement(io, rid, me, pickedSlotIds);
    } catch (e) {
      socket.emit("judgement:error", { message: String(e.message || e) });
    }
  });

  // ---- RESULT：次へ準備完了（全員 or 30s）
  socket.on("judgement:resultReady", async ({ roomId } = {}) => {
    try {
      const rid = String(roomId || "").trim();
      const me = String(socket.data.username || "").trim();
      if (!rid) throw new Error("roomId_required");
      if (!me) throw new Error("not_authed");

      const st = gameCache.get(rid)?.state || await loadGameState(rid);
      if (!st) throw new Error("game_not_found");
      if (st.phase !== "RESULT") throw new Error("invalid_phase");

      if (st.round?.ready && typeof st.round.ready === "object") {
        st.round.ready[me] = true;
      }

      setGameState(rid, st);
      await broadcastGame(io, rid);

      const allReady = Object.values(st.round.ready || {}).every(v => v === true);
      if (allReady) {
        await startNextRound(io, rid);
      }
    } catch (e) {
      socket.emit("judgement:error", { message: String(e.message || e) });
    }
  });


  // 休みイベントの生成
  socket.on("requestRestEvent", async (payload) => {
    try {
      const lines = await generateRestDialogue(payload);
      socket.emit("restGenerated", lines);
    } catch (err) {
      console.error("[requestRestEvent] generation failed:", err);
      socket.emit("restGenerated", fallbackRestDialogue(payload || {}));
    }
  });


  // 通常イベント
  socket.on("requestEvent", async (data) => {
    console.log("📩 Event requested:", data);
    const { characterName, place, likability, playername } = data;

    const { requestId } = data; // ★ 追加

    const eventData = await generateGameEvent(
      characterName,
      place,
      likability,
      playername,
    );
    socket.emit("eventGenerated", { requestId, data: eventData }); // ★ 追加：IDごと返す
  });

  // 盆踊りイベント（台詞配列）
  socket.on("requestFestivalEvent", async (data) => {
    const { characters, place, likabilities, playername, condition = null } = data;
    const lines = await generateFestivalDialogue(
      characters,
      place,
      likabilities,
      playername,
      condition // ★ 追加
    );
    socket.emit("festivalGenerated", lines);
  });


  // 最終日エンディング（告白返事）
  socket.on("requestEndingEvent", async (payload) => {
    try {
      // payload: { groups, accepted }  ← クライアント確定済み
      const { groups = {}, accepted = {} } = payload || {};
      const lines = await generateEndingDialogue(groups, accepted);
      socket.emit("endingGenerated", lines); // クライアントの event handler へ
    } catch (e) {
      console.error("❌ Ending generation error:", e);
      // 失敗時は簡易フォールバック
      const lines = [
        {
          name: "ミユ",
          message:
            "ごめん、今はうまく言葉にできないや…でも、気持ちはちゃんと受け取ったから！",
        },
        {
          name: "シオン",
          message: "……混み合っているようです。少しだけ、待っていただけますか。",
        },
        {
          name: "ナナ",
          message:
            "ふふ、最後の最後で焦らしちゃったね。またすぐに、返事を届けるよ。",
        },
      ];
      socket.emit("endingGenerated", lines);
    }
  });

  // 逆告白
  socket.on("requestReverseConfession", async (data) => {
    try {
      console.log("🔁 Reverse confession requested:", data);
      const lines = await generateReverseMonologue(
        data.character,
        data.playername,
      );
      console.log("🔁 Reverse lines:", lines);
      //socket.emit("reverseGenerated", lines);
      socket.emit("reverseConfessionGenerated", { lines });
    } catch (e) {
      console.error("❌ Reverse confession error:", e);
      socket.emit("reverseConfessionGenerated", { lines: [] });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ client disconnected:", socket.id);
  });
});

// ---------- 起動 ----------
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT}`);
});






















