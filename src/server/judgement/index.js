import { getSheetsClient, SPREADSHEET_ID } from "../../foundation/sheets.js";





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
function getAuthedName(socket, payload) {
  const u = String(socket.data.username || payload?.username || "").trim();
  if (!u) throw new Error("not_authed");
  socket.data.username = u; // 一度取れたら固定
  return u;
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
  "好きな季節について、その理由も含めて教えて",
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


// ★ フェーズ自動遷移の時間（ms）
const INTRO_MS  = 0;
const RULES_MS  = 0;
const ROLE_MS   = 20000;
const BRIEF_MS  = 15000;
const ANSWER_MS = 120_000;
const RESULT_MS = 30_000;

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
function stripJsonFence(s = "") {
  const t = String(s ?? "").trim();

  // ```json ... ``` または ``` ... ``` を剥がす
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (m) return m[1].trim();

  return t;
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


function ensureCacheEntry(roomId, stateIfMissing = null) {
  const rid = String(roomId || "").trim();
  if (!rid) return null;

  const ent = gameCache.get(rid);
  if (ent) {
    ent.phaseTimers ||= {};
    return ent;
  }

  const created = { state: stateIfMissing, flushTimer: null, phaseTimers: {} };
  gameCache.set(rid, created);
  return created;
}

function clearTimer(ent, key) {
  if (ent?.phaseTimers?.[key]) {
    clearTimeout(ent.phaseTimers[key]);
    ent.phaseTimers[key] = null;
  }
}

function scheduleAt(ent, key, deadlineAt, fn) {
  clearTimer(ent, key);
  if (!deadlineAt) return;
  const delay = Math.max(0, Number(deadlineAt) - Date.now());
  ent.phaseTimers[key] = setTimeout(fn, delay + 25);
}

async function scheduleAllTimers(io, roomId) {
  const rid = String(roomId || "").trim();
  const ent = ensureCacheEntry(rid);
  if (!ent?.state) return;

  // いったん全部クリアして「今のphaseに必要なものだけ」貼り直す
  for (const k of ["intro", "rules", "role", "brief", "answer", "result"]) {
    clearTimer(ent, k);
  }

  const st = ent.state;

  if (st.phase === "INTRO") {
    scheduleAt(ent, "intro", st.introDeadlineAt, () => advanceFromIntro(io, rid));
    return;
  }

  if (st.phase === "RULES") {
    scheduleAt(ent, "rules", st.rulesDeadlineAt, () => advanceFromRules(io, rid));
    return;
  }

  if (st.phase === "ROLE") {
    scheduleAt(ent, "role", st.roleDeadlineAt, () => advanceFromRole(io, rid));
    return;
  }

  if (st.phase === "BRIEF") {
    scheduleAt(ent, "brief", st.briefDeadlineAt, () => advanceFromBrief(io, rid));
    return;
  }

  if (st.phase === "ANSWER") {
    scheduleAt(ent, "answer", st.round?.answerDeadlineAt, () => advanceFromAnswer(io, rid));
    return;
  }

  if (st.phase === "RESULT") {
    scheduleAt(ent, "result", st.round?.resultDeadlineAt, () => advanceFromResult(io, rid));
    return;
  }
}

// ---- 進行：INTRO → RULES
async function advanceFromIntro(io, roomId) {
  const st = gameCache.get(roomId)?.state || await loadGameState(roomId);
  if (!st || st.phase !== "INTRO") return;
  if (Date.now() < Number(st.introDeadlineAt || 0)) return;

  st.phase = "RULES";
  st.introDeadlineAt = null;
  st.rulesDeadlineAt = nowMs() + RULES_MS;

  setGameState(roomId, st);
  await broadcastGame(io, roomId);
  await scheduleAllTimers(io, roomId);
}

// ---- 進行：RULES → 1st round（ROLE）
async function advanceFromRules(io, roomId) {
  const st = gameCache.get(roomId)?.state || await loadGameState(roomId);
  if (!st || st.phase !== "RULES") return;
  if (Date.now() < Number(st.rulesDeadlineAt || 0)) return;

  // ルール表示が終わったらラウンド作成
  await startNextRound(io, roomId);
}

// ---- 進行：ROLE → BRIEF
async function advanceFromRole(io, roomId) {
  const st = gameCache.get(roomId)?.state || await loadGameState(roomId);
  if (!st || st.phase !== "ROLE") return;
  if (Date.now() < Number(st.roleDeadlineAt || 0)) return;

  st.phase = "BRIEF";
  st.roleDeadlineAt = null;
  st.briefDeadlineAt = nowMs() + BRIEF_MS;
  st.phaseReady ||= {};
st.phaseReady.BRIEF = {};

  setGameState(roomId, st);
  await broadcastGame(io, roomId);
  await scheduleAllTimers(io, roomId);
}

// ---- 進行：BRIEF → ANSWER
async function advanceFromBrief(io, roomId) {
  const st = gameCache.get(roomId)?.state || await loadGameState(roomId);
  if (!st || st.phase !== "BRIEF") return;
  if (Date.now() < Number(st.briefDeadlineAt || 0)) return;

  await beginAnswerPhase(io, roomId);
}

// ---- ANSWER開始（締切タイマーもここで確定）
async function beginAnswerPhase(io, roomId) {
  const st = gameCache.get(roomId)?.state || await loadGameState(roomId);
  if (!st) throw new Error("game_not_found");
  if (st.phase !== "BRIEF") throw new Error("invalid_phase");
  if (!st.round) throw new Error("round_missing");

  st.phase = "ANSWER";
  st.briefDeadlineAt = null;
  st.round.answerDeadlineAt = nowMs() + ANSWER_MS;

  setGameState(roomId, st);
  await broadcastGame(io, roomId);
  await scheduleAllTimers(io, roomId);
}

// ---- 進行：ANSWER → JUDGE（締切で自動）
async function advanceFromAnswer(io, roomId) {
  const st = gameCache.get(roomId)?.state || await loadGameState(roomId);
  if (!st || st.phase !== "ANSWER") return;
  if (Date.now() < Number(st.round?.answerDeadlineAt || 0)) return;

  st.phase = "JUDGE";
  setGameState(roomId, st);
  await broadcastGame(io, roomId);
  // JUDGEはタイマー不要
}

// ---- 進行：RESULT → 次ラウンド（締切で自動）
async function advanceFromResult(io, roomId) {
  const st = gameCache.get(roomId)?.state || await loadGameState(roomId);
  if (!st || st.phase !== "RESULT") return;
  if (Date.now() < Number(st.round?.resultDeadlineAt || 0)) return;

  await startNextRound(io, roomId);
}





function buildScoreMap(state) {
  const points = state?.stats?.points || {};
  const fp = state?.stats?.aiFalsePositives || {};
  const members = state?.members || [];

  return Object.fromEntries(
    members.map(u => [
      u,
      {
        points: Number(points[u] || 0),
        aiFalsePositives: Number(fp[u] || 0),
      }
    ])
  );
}

function buildRankingFromScoreMap(scoreMap) {
  const arr = Object.entries(scoreMap || {}).map(([name, v]) => ({
    name,
    points: Number(v?.points || 0),
    aiFalsePositives: Number(v?.aiFalsePositives || 0),
  }));

  // points desc, aiFalsePositives asc
  arr.sort((a, b) => (b.points - a.points) || (a.aiFalsePositives - b.aiFalsePositives));
  return arr;
}



// ---- 公開用state（断罪前に「誰がどのカードか」を隠す）
// ---- 公開用state（断罪前に「誰がどのカードか」を隠す）
// viewerUsername を渡すと selfSlotId を返す（自分カード特定用）
function publicGameView(state, viewerUsername = null) {
  if (!state) return null;

  const phase = state.phase;

  const revealIdentity = (phase === "RESULT" || phase === "GAME_OVER");
  const hideAnswers = (phase === "ANSWER" || phase === "BRIEF" || phase === "INTRO" || phase === "RULES" || phase === "ROLE");

  // INTRO/RULES/ROLE はオーバーレイ専用（カード表示を消す）
  const hideTopicAndCards = (phase === "INTRO" || phase === "RULES" || phase === "ROLE");

  // --- selfSlotId（この viewer が human の場合、H:<username> を返す）
  // 狩人は "自分のカード" を持たないので null のままでもOK
  let selfSlotId = null;
  const v = String(viewerUsername || "").trim();
  if (v && state.round?.cards?.length) {
    const mine = state.round.cards.find(c => c.kind === "human" && c.owner === v);
    if (mine) selfSlotId = mine.slotId; // 例: "H:alice"
  }

  // --- スコアは常に送る（UIがいつでも描画できるように）
  const scoreMap = buildScoreMap(state);
  const ranking = buildRankingFromScoreMap(scoreMap);

    const cards = hideTopicAndCards
    ? []
    : (state.round?.cards || []).map(c => {
        const isSelf =
          v && c.kind === "human" && String(c.owner || "").trim() === v;

        return {
          slotId: c.slotId,
          avatar: c.avatar,

          // ★ここが重要：ANSWER等で隠すが「自分だけ」見える
          answer: hideAnswers
            ? (isSelf ? (c.answer || "") : "???")
            : (c.answer || ""),

          name: revealIdentity ? (c.kind === "ai" ? "AI" : c.owner) : "???",
          kind: revealIdentity ? c.kind : "???",

          pickedByHunter: revealIdentity ? !!c.pickedByHunter : false,
        };
      });


  return {
    roomId: state.roomId,
    phase: state.phase,
    roundIndex: state.roundIndex,

    // viewer情報（自分カード特定）
    viewer: v || null,
    selfSlotId, // ★追加

    // ラウンド情報
    hunter: state.round?.hunter || null,
    topic: hideTopicAndCards ? "" : (state.round?.topic || ""),

    answerDeadlineAt: state.round?.answerDeadlineAt || null,
    resultDeadlineAt: state.round?.resultDeadlineAt || null,
    picksRequired: state.round?.picksRequired ?? null,

    // INTRO/RULES/ROLE/BRIEF のdeadline
    introDeadlineAt: state.introDeadlineAt || null,
    rulesDeadlineAt: state.rulesDeadlineAt || null,
    roleDeadlineAt: state.roleDeadlineAt || null,
    briefDeadlineAt: state.briefDeadlineAt || null,

    // ★スコアは常に送る（要求）
    scoreMap,   // ★追加（常時）
    ranking,    // ★追加（常時）

    // ★RESULT時の差分（後述で round.deltas を作る）
    deltas: state.round?.deltas || null,  // ★追加（RESULTで使う）

    cards,

    // 世界観/ルール本文
    intro: state.intro || null,
    rules: state.rules || null,
  };
}





async function broadcastGame(io, roomId) {
  const ent = gameCache.get(roomId);
  if (!ent?.state) return;

  const room = judgeSocketRoom(roomId);

  // ルーム参加者ごとに、viewerUsername を見て出し分けて送る
  const sockets = await io.in(room).fetchSockets();

  for (const s of sockets) {
    const viewer = String(s.data?.username || "").trim() || null;
    s.emit("judgement:gameState", publicGameView(ent.state, viewer));
  }
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

    // タイマー用deadlineはクリア
    state.introDeadlineAt = null;
    state.rulesDeadlineAt = null;
    state.roleDeadlineAt = null;
    state.briefDeadlineAt = null;

    setGameState(roomId, state);
    await broadcastGame(io, roomId);
    await scheduleAllTimers(io, roomId);
    return;
  }

  const hunter = pickOne(state.remainingHunters);
  state.remainingHunters = state.remainingHunters.filter(x => x !== hunter);

  const topic = pickOne(TOPICS);

  const members = state.members || [];
  const resistants = members.filter(x => x !== hunter);

  const aiCount = Number(state.aiCount || 1);
  const totalCards = resistants.length + aiCount;

  // アバター不足でも落とさない（循環）
  const baseAvatars = shuffle(AVATAR_URLS);
  const avatars = Array.from({ length: totalCards }, (_, i) => baseAvatars[i % baseAvatars.length]);

  const cards = [];

  // 人間（レジスタント）
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

  // AI
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

  state.roundIndex = (state.roundIndex || 0) + 1;

  // ★ ここから ROLE → BRIEF → ANSWER は時間で自動遷移
  state.phase = "ROLE";
  state.roleDeadlineAt = nowMs() + ROLE_MS;// ★追加：ROLEのready初期化
state.phaseReady ||= {};
state.phaseReady.ROLE = {};
  state.briefDeadlineAt = null;
  state.introDeadlineAt = null;
  state.rulesDeadlineAt = null;

  state.round = {
    hunter,
    topic,
    cards: shuffle(cards),
    picksRequired: resistants.length,
    answerDeadlineAt: null,
    resultDeadlineAt: null,
  };

  setGameState(roomId, state);
  await broadcastGame(io, roomId);
  await scheduleAllTimers(io, roomId);

  // ★ AI生成（ROLE/BRIEF/ANSWER のどこで完了しても反映してOK）
  generateAIAnswers(topic, aiCount)
    .then(list => {
      const st = gameCache.get(roomId)?.state;
      if (!st || !st.round) return;
      if (!(st.phase === "ROLE" || st.phase === "BRIEF" || st.phase === "ANSWER")) return;

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
}



// ---- 初期化（ホストが開始）
async function initGame(io, roomId, aiCount) {
  //phaseReady: {}, // ★追加：{ ROLE: {alice:true,...}, BRIEF:{...}, RESULT:{...}, ... }
  const sheets = await getSheetsClient();
  const rows = await getJudgeRows(sheets);
  const idx = findJudgeRowIndex(rows, roomId);
  if (idx < 0) throw new Error("room_not_found");

  const row = rows[idx];
  const members = parseSlashList(row[3]);

  const st = {
    roomId,
    phase: "INTRO",
    aiCount: Number(aiCount || 1),
    members,
    remainingHunters: shuffle(members),
    roundIndex: 0,
    round: null,
    phaseReady: {},
    stats: {
      points: Object.fromEntries(members.map(u => [u, 0])),
      aiFalsePositives: Object.fromEntries(members.map(u => [u, 0])),
    },

    intro: {
      title: "断罪AI",
      text: "AIが勝利した世界。あなたたちは“AIっぽい”言葉で生き延びるレジスタント。狩人は混ざった人間を見抜け。",
    },
    rules: {
      title: "ルール",
      text:
        "断罪狩人1人・レジスタント複数人。お題に対してレジスタントはAIっぽい回答（120文字以内）を出す。AI回答も混ざる。狩人は人間を見抜いて断罪。狩人は的中数だけ得点。レジスタントは見抜かれなければ+1点。",
    },

    // ★ 自動遷移用deadline
    introDeadlineAt: nowMs() + INTRO_MS,
    rulesDeadlineAt: null,
    roleDeadlineAt: null,
    briefDeadlineAt: null,

    ranking: null,
  };

  // ★ E列へAI数 / B列を対戦中 / G列へgameJson初期化（stを確定させてから書く）
  const rowNumber = sheetRowNumberFromIndex(idx);
  await updateJudgeCells(sheets, rowNumber, [
    { col: "E", value: String(st.aiCount) },
    { col: "B", value: "対戦中" },
    { col: "G", value: JSON.stringify(st) },
  ]);

  // cacheに載せる
  gameCache.set(roomId, { state: st, flushTimer: null, phaseTimers: {} });

  await broadcastGame(io, roomId);
  await scheduleAllTimers(io, roomId);
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

  // ---- 加算前のスコア（before）
  const before = buildScoreMap(st);

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

  // ---- 加算後のスコア（after）
  const after = buildScoreMap(st);

  // ---- gained（増分）
  const gained = {};
  for (const u of Object.keys(after)) {
    const bp = Number(before[u]?.points || 0);
    const bfp = Number(before[u]?.aiFalsePositives || 0);
    const ap = Number(after[u]?.points || 0);
    const afp = Number(after[u]?.aiFalsePositives || 0);

    gained[u] = {
      points: ap - bp,
      aiFalsePositives: afp - bfp,
    };
  }

  // ---- RESULTで表示しやすいメタ
  const pickedHumans = round.cards
    .filter(c => c.pickedByHunter && c.kind === "human")
    .map(c => c.owner);

  const pickedAI = round.cards
    .filter(c => c.pickedByHunter && c.kind === "ai")
    .map(c => c.slotId);

  round.deltas = {
    before,
    gained,
    after,
    meta: {
      hunter: hunterName,
      picksRequired: Number(round.picksRequired || 0),
      correctHuman,
      aiFalse,
      pickedHumans,
      pickedAI,
    }
  };

  // RESULTへ（30秒で自動で次ラウンドへ）
  st.phase = "RESULT";
  st.round.resultDeadlineAt = nowMs() + RESULT_MS;

  // ★追加：RESULTのready管理
  st.round.ready = {}; // { username: true }


  setGameState(roomId, st);
  await broadcastGame(io, roomId);
  await scheduleAllTimers(io, roomId);
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
    status: normalizeStatusForDisplay(statusB),
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
export function mountJudgementRoutes(app, io) {
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

    try {
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
    } catch (e) {
      console.error("room/create error:", e);
      return res.status(500).json({ error: "server_error" });
    }
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
}

export function registerJudgementSocketHandlers(socket, io) {
  socket.on("judgement:auth", ({ username } = {}) => {
    const u = String(username || "").trim();
    const err = validateUsername(u);
    if (err) return; // 不正なら無視
    socket.data.username = u;
  });

  // ---- 待機ルーム監視
  socket.on("judgement:watch", async ({ roomId, username } = {}) => {
    const rid = String(roomId || "").trim();
    if (!rid) return;

    // authを送ってないクライアント救済（watchにusernameを入れてくればここで紐付け）
    if (!socket.data.username && username) {
      const u = String(username).trim();
      const err = validateUsername(u);
      if (!err) socket.data.username = u;
    }

    socket.join(judgeSocketRoom(rid));

    // 待機状態
    try {
      const st = await buildJudgeState(rid);
      if (st) socket.emit("judgement:state", st);
    } catch (e) {
      console.error("[judgement:watch] buildJudgeState error:", e);
    }

    // ゲーム状態
    try {
      const g = await loadGameState(rid);
      if (g) {
        const viewer = String(socket.data?.username || username || "").trim() || null;
        socket.emit("judgement:gameState", publicGameView(g, viewer));
      }

      // ★ サーバ再起動後などでもタイマーが復活するよう、watch時に再スケジュール
      if (g) await scheduleAllTimers(io, rid);
    } catch (e) {
      console.error("[judgement:watch] loadGameState error:", e);
    }
  });

  socket.on("judgement:unwatch", ({ roomId } = {}) => {
    const rid = String(roomId || "").trim();
    if (!rid) return;
    socket.leave(judgeSocketRoom(rid));
  });

  // ---- ホスト：ゲーム開始
  socket.on("judgement:gameStart", async (payload = {}) => {
    try {
      const rid = String(payload.roomId || "").trim();
      if (!rid) throw new Error("roomId_required");

      const me = getAuthedName(socket, payload);

      // host判定（シートから確認）
      const sheets = await getSheetsClient();
      const rows = await getJudgeRows(sheets);
      const idx = findJudgeRowIndex(rows, rid);
      if (idx < 0) throw new Error("room_not_found");
      const host = String(rows[idx]?.[2] || "");
      if (host !== me) throw new Error("only_host");

      await initGame(io, rid, Number(payload.aiCount || 1));
    } catch (e) {
      console.error("[judgement:gameStart] error:", e);
      socket.emit("judgement:error", { message: String(e.message || e) });
    }
  });

  // ---- レジスタント：回答提出（ANSWERフェーズのみ）
  socket.on("judgement:submitAnswer", async (payload = {}) => {
    try {
      const rid = String(payload.roomId || "").trim();
      if (!rid) throw new Error("roomId_required");

      const me = getAuthedName(socket, payload);

      const st = gameCache.get(rid)?.state || await loadGameState(rid);
      if (!st) throw new Error("game_not_found");
      if (st.phase !== "ANSWER") throw new Error("invalid_phase");

      if (st.round?.hunter === me) throw new Error("hunter_cannot_answer");
      if (nowMs() > Number(st.round?.answerDeadlineAt || 0)) throw new Error("deadline_passed");

      const t = clampText120(String(payload.text || "").replace(/\r/g, ""));
      if (!t.trim()) throw new Error("empty_answer");

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
  socket.on("judgement:judgePick", async (payload = {}) => {
    try {
      const rid = String(payload.roomId || "").trim();
      if (!rid) throw new Error("roomId_required");

      const me = getAuthedName(socket, payload);

      await resolveJudgement(io, rid, me, payload.pickedSlotIds);
    } catch (e) {
      socket.emit("judgement:error", { message: String(e.message || e) });
    }
  });

  // ---- RESULT：次へ準備完了（全員Readyで即次へ）※残してもOK、タイマーもあるので必須ではない
  socket.on("judgement:resultReady", async (payload = {}) => {
    try {
      const rid = String(payload.roomId || "").trim();
      if (!rid) throw new Error("roomId_required");

      const me = getAuthedName(socket, payload);

      const st = gameCache.get(rid)?.state || await loadGameState(rid);
      if (!st) throw new Error("game_not_found");
      if (st.phase !== "RESULT") throw new Error("invalid_phase");
      if (!st.round) throw new Error("round_missing");

      // ★ ready記録（RESULTは phaseReady に統一しても良い。互換のため両方更新）
      st.round.ready ||= {};
      st.round.ready[me] = true;
      st.phaseReady ||= {};
      st.phaseReady.RESULT ||= {};
      st.phaseReady.RESULT[me] = true;

      setGameState(rid, st);
      await broadcastGame(io, rid);

      // ★全員ready判定（members基準）
      const members = Array.isArray(st.members) ? st.members : [];
      const allReady = members.length > 0 && members.every(u => st.phaseReady?.RESULT?.[u]);

      if (allReady) {
        // RESULTタイマーを止めて即次ラウンド
        const ent = ensureCacheEntry(rid);
        clearTimer(ent, "result");
        await startNextRound(io, rid);
      }
    } catch (e) {
      socket.emit("judgement:error", { message: String(e.message || e) });
    }
  });

  socket.on("judgement:phaseReady", async (payload = {}) => {
    try {
      const rid = String(payload.roomId || "").trim();
      if (!rid) throw new Error("roomId_required");

      const me = getAuthedName(socket, payload);

      const st = gameCache.get(rid)?.state || await loadGameState(rid);
      if (!st) throw new Error("game_not_found");

      const phase = st.phase;
      if (!["ROLE", "BRIEF", "RESULT", "INTRO", "RULES"].includes(phase)) {
        throw new Error("invalid_phase_for_ready");
      }

      st.phaseReady ||= {};
      st.phaseReady[phase] ||= {};
      st.phaseReady[phase][me] = true;

      setGameState(rid, st);
      await broadcastGame(io, rid);

      // 全員ready判定
      const members = Array.isArray(st.members) ? st.members : [];
      const allReady = members.length > 0 && members.every(u => st.phaseReady?.[phase]?.[u]);

      if (!allReady) return;

      // ready全員 → タイマー停止して即遷移
      const ent = ensureCacheEntry(rid);

      if (phase === "ROLE") {
        clearTimer(ent, "role");
        await advanceFromRole(io, rid);
        return;
      }
      if (phase === "BRIEF") {
        clearTimer(ent, "brief");
        await advanceFromBrief(io, rid);
        return;
      }
      if (phase === "RESULT") {
        clearTimer(ent, "result");
        await startNextRound(io, rid);
        return;
      }
      if (phase === "INTRO") {
        clearTimer(ent, "intro");
        await advanceFromIntro(io, rid);
        return;
      }
      if (phase === "RULES") {
        clearTimer(ent, "rules");
        await advanceFromRules(io, rid);
        return;
      }
    } catch (e) {
      socket.emit("judgement:error", { message: String(e.message || e) });
    }
  });
}
