import "./menu-auth.js";
import { getBgForPlace, getCharImg, preloadAllImages, FESTIVAL_BG_FALLBACK, yasumi_image } from "./game-assets.js";
import { PARTTIME_JOBS, applyTagToPlayer, buildPlayerTagBlock, formatTagName, maybeAwardTag } from "./player-tags.js";
import { showToast } from "./toast.js";
import * as THREE from "https://esm.sh/three@0.163.0";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "https://esm.sh/three@0.163.0/examples/jsm/renderers/CSS2DRenderer.js";
/* ================= Socket.io 接続 ================= */
const socket = io();

socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
  socket.emit("clientPing", "hello server");
});
socket.on("serverMessage", (msg) => console.log(msg));
socket.on("serverPong", (msg) => console.log(msg));

// 選択肢コンテナの直近高さを保持（ズレ防止用）
let lastChoicesHeight = 0;

// ▼ 追加（グローバル）：プレイヤー名 -> CSSカラー
let playerColorMap = {};


/* ========== AIイベント受信（1対1） ========== */
function eventGenerated(payload) {
  /* ===== 1) 先読み形式 ({requestId,data}) を優先 ===== */
  if (payload && payload.requestId && payload.data) {
    prefetchResult.set(payload.requestId, payload.data);

    /* --- もし今まさにその ID を待っている場合のみ表示を担当 --- */
    if (currentMatching && currentMatching.requestId === payload.requestId) {
      const elapsed = Date.now() - currentMatching.startedAt;
      const waitMore = Math.max(0, MATCH_MIN_MS - elapsed);

      setTimeout(() => {
        /* ① ルーレット停止 */
        if (rouletteTimer) {
          clearInterval(rouletteTimer);
          rouletteTimer = null;
        }

        /* ② 「◯◯ とマッチング！」演出 */
        const pawn = currentPawn;
        const characterName = pawn?.userData?.meetingCharacter || "???";
        const placeName = pawn?.userData?.currentPlaceName || "神社";
        const bgUrl = getBgForPlace(placeName);

        modal.style.display = "flex";
        modal.onclick = null;
        modalBox.innerHTML = `
          <img style="height:240px;display:block;margin:8px auto;" src="${getCharImg(characterName)}" alt="${characterName}">
          <div style="font-size:1.8rem;margin-top:.5rem;">${characterName} とマッチング！</div>
        `;

        /* ③ 1 秒静止 → 本編へ */
        setTimeout(() => {
          modal.style.display = "none";
          showMatchedEvent(payload.data, bgUrl, characterName);
        }, 2000);
      }, waitMore);
    }
    return; // ← 先読み分はここで終了
  }

  /* ===== 2) 後方互換：生 JSON のみの場合 ===== */
  const raw = payload;
  const data = typeof raw === "string" ? safeParseJSON(raw) : raw;
  if (!data || !data.message || !Array.isArray(data.choices)) {
    modalBox.innerHTML =
      "イベントの取得に失敗しました。もう一度お試しください。";
    const ok = document.createElement("button");
    ok.textContent = "OK";
    ok.onclick = () => {
      modal.style.display = "none";
      nextTurn();
    };
    modal.style.display = "flex";
    modalBox.appendChild(ok);
    return;
  }

  /* --- 後方互換フロー（最低 3 秒保証はなし） --- */
  if (rouletteTimer) {
    clearInterval(rouletteTimer);
    rouletteTimer = null;
  }
  pendingEvent = data;

  const pawn = currentPawn;
  const characterName = pawn.userData.meetingCharacter;
  const placeName = pawn.userData.currentPlaceName || "神社";
  const bgUrl = getBgForPlace(placeName);

  modal.style.display = "flex";
  modal.onclick = null;
  modalBox.innerHTML = `
    <img style="height:240px;display:block;margin:8px auto;" src="${getCharImg(characterName)}" alt="${characterName}">
    <div style="font-size:1.8rem;margin-top:.5rem;">${characterName} とマッチング！</div>
  `;
  setTimeout(() => showMatchedEvent(data, bgUrl, characterName), 1000);
}

/* ★ グローバルに再バインド（既存の socket.on を置き換え） */
socket.off("eventGenerated"); // 旧ハンドラ解除
socket.on("eventGenerated", eventGenerated);

// 先読み／通常どちらでも使う共通表示関数
function showMatchedEvent(data, bgUrlOpt, characterNameOpt) {
  const pawn = currentPawn;
  const characterName = characterNameOpt || pawn.userData.meetingCharacter;
  const placeName = pawn.userData.currentPlaceName || "神社";
  const bgUrl = bgUrlOpt || getBgForPlace(placeName);

  modal.style.display = "none";

  // ▼ 追加：このイベント内容を記録しておく（後で on1v1Choice で参照）
  pawn.userData.__lastEvent = {
    characterName,
    placeName,
    data, // {message, choices:[...]}
    day: gameState.day,
  };

  renderEventLayer({
    bgUrl,
    portraits: [{ name: characterName, mood: "neutral" }],
    speaker: characterName,
    message: data.message,
    choices: data.choices.map((c) => ({
      text: c.text,
      onClick: () => on1v1Choice(c, characterName),
    })),
    showChoicesOnTap: true,
  });

  // 待ち状態クリア
  currentMatching = null;
  // ★ このプレイヤーの先読みを消す（次ターンに備え毎回新規に作る）
  const plan = prefetchPlan.get(pawn.userData.name);
  if (plan) {
    prefetchResult.delete(plan.requestId);
    prefetchPlan.delete(pawn.userData.name);
  }
}

function on1v1Choice(choice, characterName) {
  const pawn = currentPawn;

  // ▼ 追加：直前イベントから、もう片方の選択肢を取得してログ化
  const ctx = pawn.userData.__lastEvent;
  if (ctx && ctx.data && Array.isArray(ctx.data.choices)) {
    const idx = ctx.data.choices.indexOf(choice); // 0 or 1（元オブジェクトなので参照一致OK）
    const other = ctx.data.choices[1 - (idx >= 0 ? idx : 0)];
    const pickedDelta = parseInt(choice.likabilityChange, 10) || 0;
    const otherDelta = other ? parseInt(other.likabilityChange, 10) || 0 : 0;
    gameLog.push({
      player: pawn.userData.name,
      day: ctx.day,
      place: ctx.placeName || pawn.userData.currentPlaceName || "",
      character: ctx.characterName || characterName,
      message: ctx.data.message || "",
      pickedIndex: idx >= 0 ? idx : 0,
      pickedText: String(choice.text || ""),
      pickedDelta,
      otherText: other ? String(other.text || "") : "",
      otherDelta,
      reaction: String(choice.reaction || "……"),
    });
  }

  // 既存処理（好感度反映など）
  const delta = parseInt(choice.likabilityChange, 10) || 0;
  pawn.userData.likability[characterName] =
    (pawn.userData.likability[characterName] || 0) + delta;

  const mood = delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";
  const isShiftEvent = !!ctx?.isShiftEvent;
  const shiftPayout = Number.isFinite(ctx?.shiftPayout) ? ctx.shiftPayout : 0;
  const shiftBgUrl = ctx?.shiftBgUrl || null;
  renderEventLayer({
    keepCurrentBg: true,
    portraits: [{ name: characterName, mood }],
    speaker: characterName,
    message: choice.reaction || "……",
    choices: [],
    advanceOnTap: () => {
      if (isShiftEvent) {
        showShiftPayoutLine(pawn, shiftPayout, shiftBgUrl);
        return;
      }
      hideEventLayer();
      nextTurn();
    },
  });
}

function formatShiftPayoutLine(payout) {
  return `${payout.toLocaleString()}円を手に入れた！`;
}

function showShiftPayoutLine(pawn, payout, bgUrl) {
  renderEventLayer({
    bgUrl: bgUrl || FESTIVAL_BG_FALLBACK,
    portraits: [],
    speaker: pawn.userData.name,
    message: formatShiftPayoutLine(payout),
    choices: [],
    advanceOnTap: async () => {
      hideEventLayer();
      const tagDetail = pawn.userData.lastAcquiredTagDetail;
      if (tagDetail?.name && tagDetail?.detail) {
        const text = `${pawn.userData.name}は🏷️${tagDetail.name}　を獲得した！\n${tagDetail.detail}`;
        pawn.userData.lastAcquiredTagDetail = null;
        await redCut(text);
      }
      clearPrefetchForPlayer(pawn.userData.name);
      nextTurn();
    },
  });
}

function playShiftDialogue(lines, pawn, payout, bgUrl) {
  const playerName = pawn.userData.name;
  const charSet = new Set(characters);
  const safeLines = Array.isArray(lines) && lines.length ? lines : [
    { name: playerName, message: "今日はバイトを終えた。" },
  ];

  let idx = 0;

  function showLine(i) {
    const { name, message } = safeLines[i];
    const isChar = charSet.has(name);
    const portraits = isChar ? [{ name, mood: "positive" }] : [];

    renderEventLayer({
      bgUrl: bgUrl || FESTIVAL_BG_FALLBACK,
      portraits,
      speaker: name,
      message,
      choices: [],
      advanceOnTap: () => {
        idx += 1;
        if (idx < safeLines.length) {
          showLine(idx);
        } else {
          showShiftPayoutLine(pawn, payout, bgUrl);
        }
      },
    });
  }

  showLine(0);
}

function renderShiftEventResult(payload, ctx) {
  const pawn = currentPawn;
  if (!pawn || !ctx) return;
  const job = getPlayerJob(pawn);
  const bgUrl = getBgForPlace(job?.place?.name || "");
  stopShiftDots();
  modal.style.display = "none";
  const awardedTagDetail =
    ctx?.newlyAcquiredTagDetail || payload?.newlyAcquiredTagDetail || null;
  if (awardedTagDetail) {
    applyTagToPlayer(pawn, awardedTagDetail);
    updateStepsHUD();
  }
  pawn.userData.lastAcquiredTagDetail = awardedTagDetail;

  if (payload?.kind === "encounter" && payload?.event) {
    const characterName = ctx.characterName || pawn.userData.meetingCharacter;
    const likeDelta = parseInt(payload.event.likabilityChange, 10) || 0;
    const candidateName = characterName || (() => {
      const charSet = new Set(characters);
      const line = (payload.event.lines || []).find((l) => charSet.has(l?.name));
      return line?.name || null;
    })();
    if (candidateName) {
      pawn.userData.likability[candidateName] =
        (pawn.userData.likability[candidateName] || 0) + likeDelta;
      gameLog.push({
        player: pawn.userData.name,
        day: gameState.day,
        place: job?.place?.name || pawn.userData.currentPlaceName || "",
        character: candidateName,
        message: `バイト中に${candidateName}と遭遇した。`,
        pickedIndex: 0,
        pickedText: "バイト遭遇イベント",
        pickedDelta: likeDelta,
        otherText: "",
        otherDelta: 0,
        reaction: "",
      });
    }
    pawn.userData.__lastEvent = {
      characterName: candidateName || characterName,
      placeName: job?.place?.name || pawn.userData.currentPlaceName || "",
      data: payload.event,
      day: gameState.day,
      isShiftEvent: true,
      shiftPayout: ctx.payout,
      shiftBgUrl: bgUrl,
    };
    playShiftDialogue(payload.event.lines || [], pawn, ctx.payout, bgUrl);
    currentMatching = null;
    return;
  }

  playShiftDialogue(payload?.lines || [], pawn, ctx.payout, bgUrl);
  currentMatching = null;
}

socket.on("shiftEventGenerated", (payload) => {
  if (!payload?.requestId) return;
  if (payload?.data) {
    shiftPrefetchResult.set(payload.requestId, payload.data);
  }

  if (
    currentMatching &&
    currentMatching.requestId === payload.requestId &&
    currentMatching.mode === "shift"
  ) {
    ensureShiftMatchingDelay(payload.data, currentMatching);
  }
});

/* ========== 既存：盆踊り（マルチ） ========== */
// 盆踊り：台詞配列を逐次表示
socket.on("festivalGenerated", (raw) => {
  try {
    const lines = Array.isArray(raw) ? raw : safeParseJSON(raw);
    if (!Array.isArray(lines) || !lines.length)
      throw new Error("invalid lines");

    // いま進行中のプレイヤー＆登場キャラ
    //const ctx = currentFestivalCtx; // 使っていない場合は不要
    const pawn = currentPawn; // 現在のプレイヤー
    //const dateChars = new Set((festivalQueue.length ? festivalQueue[0]?.chars : []) || []); // 参照用だが安全に

    // 実表示：1行ずつタップで進む
    playFestivalDialogue(lines, pawn);
  } catch (e) {
    console.error(e);
    modalBox.innerHTML = "イベントの取得に失敗しました。";
    //const ok = document.createElement("button");
    //ok.textContent = "OK";
    //ok.onclick = () => {
    modal.style.display = "none";
    playNextFestivalInQueue();
    //};
    //modalBox.appendChild(ok);
  }
});

/* 小ユーティリティ */
function safeParseJSON(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/* ====== 先読み＆最低待機コントロール ====== */
const MATCH_MIN_MS = 2000;

// 先読み計画: playerName -> { steps, destTile, place, character, requestId, startedAt }
const prefetchPlan = new Map();

// 先読み結果: requestId -> eventData(JSON)
const prefetchResult = new Map();

// バイト先読み結果: requestId -> shiftEventData
const shiftPrefetchResult = new Map();

// マッチングUIで待っている最中の情報
let currentMatching = null;
let shiftDotsTimer = null;

let __currentReverseCtx = null;

// 一意のID
function makeRequestId() {
  return "req_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// サイコロ1d6
function roll1d6() {
  return Math.ceil(Math.random() * 6);
}

// 指定歩数で到達するタイル番号（0〜11）を返す
function calcDestTile(currentTile, steps) {
  return (currentTile + steps) % 12;
}

// タイルID(1〜12)から場所オブジェクトを取得
function placeFromTileId(tileId) {
  return tileInfoGlobal[tileId];
}

// キャラをランダム選択
function randomCharacter() {
  const idx = Math.floor(Math.random() * characters.length);
  return characters[idx];
}

/**
 * プレイヤーの次イベントを先読み発注
 * - ダイス目・到着タイル・場所・会うキャラ・requestId を決めてサーバに投げる
 * - 既に計画済みなら何もしない（同じターン内の多重発注防止）
 */
function prefetchEventFor(playerName, dayForPlayer = gameState.day) {
  if (prefetchPlan.has(playerName)) return;
  const pawn = pawnsGlobal.find(p => p.userData.name === playerName);
  if (!pawn) return;

  // 翌日が盆踊り/最終日の人は先読みしない
  const nextTurnIndex = (gameState.turn + 1) % gameState.order.length;
  const nextDay = nextTurnIndex === 0 ? gameState.day + 1 : gameState.day;
  if (playerName === gameState.order[nextTurnIndex]) {
    if (nextDay === festivalDay && !gameState.festivalDone) return;
    if (nextDay === finalDay && !gameState.endingDone) return;
  }

  if (isShiftDay(pawn, dayForPlayer)) {
    const job = getPlayerJob(pawn);
    if (!job) return;
    const requestId = makeRequestId();
    const willMeet = (Math.random() * 100) < (job.encounterPct || 0);
    const character = willMeet ? randomCharacter() : null;
    const newlyAcquiredTagDetail = maybeAwardTag(pawn, job);
    const fishingDayCount =
      job.type === "weekly" ? getFishingDayCount(pawn, dayForPlayer) : null;
    prefetchPlan.set(playerName, {
      isShiftDay: true,
      day: dayForPlayer,
      jobKey: pawn.userData.jobKey,
      character,
      requestId,
      startedAt: Date.now(),
      willMeet,
      fishingDayCount,
      newlyAcquiredTagDetail,
    });
    socket.emit("requestShiftEvent", {
      requestId,
      playername: playerName,
      job: {
        label: job.label,
        type: job.type,
        place: job.place,
      },
      encounter: willMeet && !!character,
      characterName: character,
      likability: character ? pawn.userData.likability?.[character] || 0 : 0,
      fishingDayCount,
      newlyAcquiredTagDetail,
      playerTagBlock: buildPlayerTagBlock(pawn),
    });
    return;
  }

  const steps = roll1d6();
  const destTile = calcDestTile(pawn.userData.tile, steps);
  const tileId = destTile + 1;
  const place = placeFromTileId(tileId);

  const requestId = makeRequestId();
  const character = randomCharacter();
  prefetchPlan.set(playerName, {
    steps, destTile, place, character, requestId, startedAt: Date.now()
  });
  socket.emit("requestEvent", {
    requestId,
    characterName: character,
    place: { name: place.name, detail: place.detail },
    likability: pawn.userData.likability?.[character] || 0,
    playername: playerName,
    playerTagBlock: buildPlayerTagBlock(pawn),
  });
}


/**
 * 現在のプレイヤーの番が始まったら、次のプレイヤーを先読み
 */
function prefetchNextPlayerFromCurrentTurn() {
  if (!gameState.order.length) return;
  const nextIndex = (gameState.turn + 1) % gameState.order.length;
  const nextPlayer = gameState.order[nextIndex];

  // 日跨ぎして翌日が盆踊り or 最終日なら先読みしない
  const nextDay = nextIndex === 0 ? gameState.day + 1 : gameState.day;
  if (
    (nextDay === festivalDay && !gameState.festivalDone) ||
    (nextDay === finalDay && !gameState.endingDone)
  ) {
    return;
  }

  prefetchEventFor(nextPlayer, nextDay);
}






let __reverseQueue = [];
function buildReverseQueueIfAny() {
  console.log("--- buildReverseQueueIfAny 開始 ---"); // alert(0) の代わり
  __reverseQueue = [];

  // 重要な変数の状態を確認
  console.log("最終告白結果:", __lastConfessionResult);
  console.log("最終選択:", __lastSelections);

  if (!__lastConfessionResult || !__lastSelections) {
    console.log("告白結果がないため、処理を中断します。");
    return;
  }

  const { accepted = {} } = __lastConfessionResult;
  // 既にペア成立しているプレイヤーとキャラ
  const pairedPlayers = new Set(Object.values(accepted).filter(Boolean));
  const pairedChars = new Set(
    Object.keys(accepted).filter((ch) => !!accepted[ch]),
  );
  // まだ誰ともカップルでないキャラ
  const freeChars = ["ミユ", "シオン", "ナナ"].filter(
    (ch) => !pairedChars.has(ch),
  );

  // ★ここで重要な変数の内容を出力
  console.log("ペア成立済みのプレイヤー:", pairedPlayers);
  console.log("ペア成立済みのキャラクター:", pairedChars);
  console.log("フリーのキャラクター:", freeChars);

  if (freeChars.length === 0) {
      console.log("フリーのキャラクターがいないため、逆告白は発生しません。");
      return;
  }

  freeChars.forEach((ch) => {
    console.log(`--- ${ch} の逆告白相手を探索中 ---`);
    // 候補：未カップル & 自分の告白は失敗 & ch への好感度 > 70
    const ranked = pawnsGlobal
      .map((p) => {
        const name = p.userData.name;
        const like = p.userData?.likability?.[ch] ?? 0;
        const steps =
          typeof p.userData?.totalSteps === "number"
            ? p.userData.totalSteps
            : 0;
        const confessedTo = __lastSelections[name]; // その人が告白した相手
        const selfSucceeded = accepted[confessedTo] === name; // 自分の告白が成功したか
        const eligible =
          !pairedPlayers.has(name) && !selfSucceeded && like > 70;

        // ★各プレイヤーの eligibility を判定する詳細なログ
        console.log(`[${ch}への候補チェック] プレイヤー: ${name}, 好感度: ${like}, 告白成功: ${selfSucceeded}, ペア成立済み: ${pairedPlayers.has(name)}, eligible: ${eligible}`);

        return { name, like, steps, eligible };
      })
      .filter((x) => x.eligible)
      .sort(
        (a, b) =>
          b.like - a.like || // 好感度が最優先
          b.steps - a.steps || // 次に歩数
          a.name.localeCompare(b.name, "ja"), // 最後に名前
      );

    console.log(`${ch}への逆告白候補者リスト:`, ranked);
    const pick = ranked[0];
    if (pick) {
      console.log(`${ch} の逆告白相手は ${pick.name} に決定しました。`);
      __reverseQueue.push({ character: ch, playername: pick.name });
      pairedPlayers.add(pick.name); // 同一プレイヤーへの多重逆告白防止
    } else {
      console.log(`${ch} には条件を満たす逆告白相手がいませんでした。`);
    }
  });

  console.log("最終的な逆告白キュー:", __reverseQueue);
}

function __playNextReverseOrFinish() {
  if (!__reverseQueue.length) {
    // 全逆告白終了
    stepBonusWinners.clear();
    updateStepsHUD();
    gameState.endingDone = true;
    return; // ※ ここでリザルトは既に表示中
  }
  const next = __reverseQueue.shift();
  __currentReverseCtx = next;
  socket.emit("requestReverseConfession", next);
}






/* ================= Three.js & ゲーム本体 ================= */

/* ---------- DOM ---------- */
const title = document.getElementById("titleScreen");
const setup = document.getElementById("setupWrapper");
const listElm = document.getElementById("playerList");
const btnStart = document.getElementById("btnStart");
const btnAdd = document.getElementById("btnAdd");
const btnRem = document.getElementById("btnRemove");
const btnBegin = document.getElementById("btnBegin");
const canvas = document.getElementById("threeCanvas");
const modal = document.getElementById("modal");
const modalBox = modal.querySelector(".modal-content");

/* ---------- 状態 ---------- */
let playerCount = 0;
const MIN = 1,
  MAX = 6;
let theta = 0,
  phi = Math.PI / 4,
  dist = 130;
let camera,
  currentPawn = null;

// ==== AIイベント待機用の一時状態 ====
let pendingEvent = null; // サーバから返るイベントオブジェクトを保持
let rouletteTimer = null; // ルーレットのsetIntervalハンドル
let rouletteIdx = 0; // ルーレット表示の現在インデックス

// 盆踊り待機タイマー（サーバ未対応フォールバック用）
let festivalTimer = null;

/* ====== 日付HUD ====== */
let 日付はここで変更できるよのめあすになる変数;
const festivalDay = 15;
const finalDay = 30;
const SHIFT_WINDOWS = [
  { key: "first", label: "7日目〜14日目", start: 7, end: 14 },
  { key: "second", label: "16日目〜29日目", start: 16, end: 29 },
];
const DARK_SHIFT_RATE = 40;
let dayHUD;
let stepsHUD; // ★ 累計マス数用
let stepsHUDButtons;
let stepsHUDMode = "none"; // "none" | "steps" | "money" | "tags"
const stepsHUDModes = {
  none: "none",
  steps: "steps",
  money: "money",
  tags: "tags",
};

function createDayHUD() {
  dayHUD = document.createElement("div");
  dayHUD.id = "dayHUD";
  dayHUD.textContent = "";
  document.body.appendChild(dayHUD);

  // ★ 累計マス数用 HUD（固定配置 & dayHUD の直下に来るように）
  stepsHUD = document.createElement("div");
  stepsHUD.id = "stepsHUD";
  Object.assign(stepsHUD.style, {
    position: "fixed",
    left: "12px",
    top: "0px", // 実際の位置は positionStepsHUD() で決定
    zIndex: "50",
    padding: "6px 10px",
    borderRadius: "10px",
    background: "rgba(0,0,0,.45)",
    border: "1px solid rgba(255,255,255,.12)",
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: "8px",
    fontWeight: "700",
    fontSize: "13px",
    letterSpacing: ".03em",
  });
  document.body.appendChild(stepsHUD);

  stepsHUDButtons = document.createElement("div");
  stepsHUDButtons.id = "stepsHUDButtons";
  Object.assign(stepsHUDButtons.style, {
    position: "fixed",
    left: "12px",
    top: "0px",
    zIndex: "50",
    padding: "6px 8px",
    borderRadius: "10px",
    background: "rgba(0,0,0,.45)",
    border: "1px solid rgba(255,255,255,.12)",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "10px",
  });
  document.body.appendChild(stepsHUDButtons);

  // 初期配置 & リサイズ時に追従
  positionStepsHUD();
  window.addEventListener("resize", positionStepsHUD);
}

function updateDayHUD() {
  const d = gameState.day;
  let text = `夏休み${d}日目`;

  if (d < festivalDay) {
    text += `　盆踊りまであと${festivalDay - d}日`;
  } else if (d === festivalDay) {
    text += `　盆踊り当日`;
  } else if (d < finalDay) {
    text += `　夏休み最終日まで後${finalDay - d}日`;
  } else {
    text += `　夏休み最終日`;
  }

  dayHUD.textContent = text;
  positionStepsHUD();
}

// 告白ボーナス表示用：該当者の名前を保持（HUDに「歩数ボーナス」表示）
let stepBonusWinners = new Set();

function setStepsHUDMode(nextMode) {
  stepsHUDMode = stepsHUDMode === nextMode ? stepsHUDModes.none : nextMode;
  updateStepsHUD();
}

function formatStepsHUDValue(name, pawn) {
  const steps = pawn && typeof pawn.userData.totalSteps === "number"
    ? pawn.userData.totalSteps
    : 0;
  const money = pawn && typeof pawn.userData.money === "number"
    ? pawn.userData.money
    : 0;
  const tags = pawn && Array.isArray(pawn.userData.tags)
    ? pawn.userData.tags.filter(Boolean).map(formatTagName)
    : [];
  const bonusMark = stepBonusWinners.has(name) ? "　歩数ボーナス！ +10♡" : "";

  switch (stepsHUDMode) {
    case stepsHUDModes.steps:
      return `${steps}👣${bonusMark}`;
    case stepsHUDModes.money:
      return `${money.toLocaleString()}💰`;
    case stepsHUDModes.tags:
      return tags.length ? tags.map((tag) => `🏷️${tag}`).join(",") : "";
    default:
      return "";
  }
}

function updateStepsHUD() {
  if (!stepsHUD) return;
  const names = gameState.order?.length ? [...gameState.order] : pawnsGlobal.map(p=>p.userData.name);
  stepsHUD.replaceChildren();
  const rows = document.createElement("div");
  rows.className = "stepsHUD-rows";

  names.forEach((name) => {
    const pawn = pawnsGlobal.find(p=>p.userData.name===name);
    const row = document.createElement("div");
    row.className = "stepsHUD-row";

    const label = document.createElement("span");
    label.className = "stepsHUD-name";
    label.textContent = `${name}:`;

    const value = document.createElement("span");
    value.className = "stepsHUD-value";
    value.textContent = formatStepsHUDValue(name, pawn);

    row.appendChild(label);
    row.appendChild(value);
  rows.appendChild(row);
  });

  stepsHUDButtons?.replaceChildren();
  const buttons = document.createElement("span");
  buttons.className = "stepsHUD-buttons";

  const stepsBtn = document.createElement("button");
  stepsBtn.type = "button";
  stepsBtn.className = "stepsHUD-button";
  stepsBtn.textContent = "👣";
  stepsBtn.setAttribute("aria-label", "歩数表示");
  stepsBtn.classList.toggle("active", stepsHUDMode === stepsHUDModes.steps);
  stepsBtn.addEventListener("click", () => setStepsHUDMode(stepsHUDModes.steps));

  const moneyBtn = document.createElement("button");
  moneyBtn.type = "button";
  moneyBtn.className = "stepsHUD-button";
  moneyBtn.textContent = "💰";
  moneyBtn.setAttribute("aria-label", "所持金表示");
  moneyBtn.classList.toggle("active", stepsHUDMode === stepsHUDModes.money);
  moneyBtn.addEventListener("click", () => setStepsHUDMode(stepsHUDModes.money));

  const tagBtn = document.createElement("button");
  tagBtn.type = "button";
  tagBtn.className = "stepsHUD-button";
  tagBtn.textContent = "🏷️";
  tagBtn.setAttribute("aria-label", "タグ表示");
  tagBtn.classList.toggle("active", stepsHUDMode === stepsHUDModes.tags);
  tagBtn.addEventListener("click", () => setStepsHUDMode(stepsHUDModes.tags));

  buttons.appendChild(stepsBtn);
  buttons.appendChild(moneyBtn);
  buttons.appendChild(tagBtn);

  stepsHUD.appendChild(rows);
  if (stepsHUDButtons) {
    stepsHUDButtons.appendChild(buttons);
  }
  positionStepsHUD();
}



// ★ stepsHUD を dayHUD のすぐ下に固定配置する
function positionStepsHUD() {
  if (!dayHUD || !stepsHUD) return;
  const top = (dayHUD.offsetTop || 10) + dayHUD.offsetHeight + 6; // dayHUD の下に 6px 余白
  stepsHUD.style.top = `${top}px`;
  if (stepsHUDButtons) {
    stepsHUDButtons.style.top = `${top}px`;
    const left = stepsHUD.offsetLeft + stepsHUD.offsetWidth + 8;
    stepsHUDButtons.style.left = `${left}px`;
  }
}

/* ---------- 戻るボタン ---------- */
const backBtn = document.createElement("button");
Object.assign(backBtn.style, {
  position: "fixed",
  right: "1rem",
  bottom: "1rem",
  padding: ".6rem 1.2rem",
  border: "none",
  borderRadius: "8px",
  background: "var(--accent)",
  color: "#333",
  fontWeight: "700",
  display: "none",
  zIndex: 15,
});
backBtn.textContent = "戻る";
document.body.appendChild(backBtn);
backBtn.onclick = () => {
  backBtn.style.display = "none";
  startTurnModal(gameState.order[gameState.turn]);
};

/* ---------- タイル情報 ---------- */
const tileInfo = {
  1: { name: "駅前", detail: "改札を抜けると、噴水のある小さなロータリーが広がる。夏の日差しに照らされ、人々の行き交いが見える。" },
  2: { name: "カフェ", detail: "ナナがアルバイト中のカフェ。静かな BGM とラテの香りが漂う、落ち着いた雰囲気。" },
  3: { name: "商店街", detail: "レトロなアーケードには雑貨屋、駄菓子屋、洋品店が並び、どこか懐かしい賑わい。" },
  4: { name: "1回休み", type: "rest", detail: "思わぬアクシデント！次の自分の番はお休みになります。" },
  5: { name: "神社", detail: "蝉の声に包まれた石段の上。風鈴がチリンと鳴り、縁結びのお守りが人気のスポット。" },
  6: { name: "図書館", detail: "坂道の途中にある町の小さな図書館。ひんやりとした空気と紙の匂いが漂っている。" },
  7: { name: "展望台", detail: "高台にある絶景スポット。潮風に吹かれながら、夕焼けが海を赤く染めてゆく。" },
  8: { name: "古民家", detail: "木造の古民家の縁側で風鈴が揺れる。静かに流れる時間と風が心地よい。" },
  9: { name: "岩瀬", detail: "岩場にできた天然の水たまり。小魚やヤドカリを覗きこむ子どもたちの声が響く。" },
  10:{ name: "ビーチ", detail: "青い海と白い砂浜。波打ち際ではしゃぐ声が夏の空気に溶けていく。ミユが好きな場所。" },
  11:{ name: "港", detail: "漁船が並ぶ埠頭。潮の香りと波の音が静かに響く、どこか物寂しい場所。" },
  12:{ name: "銭湯", detail: "瓦屋根の昔ながらの銭湯。湯上がりのラムネと夕暮れが、どこか懐かしい気持ちにさせる。" },
};


/* ---------- キャラクター情報 ---------- */
const characters = ["ミユ", "シオン", "ナナ"];

/* ---------- ゲーム状態 ---------- */
let playerNamesGlobal = [];
//let gameState = { order: [], turn: 0, day: 1, festivalDone: false };
let gameState = {
  order: [],
  turn: 0,
  day: 1,
  festivalDone: false,
  endingDone: false,
  shiftWindow1Done: false,
  shiftWindow2Done: false,
};
let pawnsGlobal = [],
  tilesGlobal = [],
  tileInfoGlobal = {},
  placePawnGlobal = null;

// ▼ 追加：選択肢ログ（リザルト用）
const gameLog = []; // {player, day, place, character, message, pickedIndex, pickedText, pickedDelta, otherText, otherDelta, reaction}

// ▼ 追加（グローバル）
let __extraCouples = []; // { player, character }

/* ===== 1回休み：理由語彙 ===== */
const REST_REASONS = [
  { key: "cold",     label: "風邪をひいた" },
  { key: "lost",     label: "迷子になった" },
  { key: "phone",    label: "スマホが見つからない" },
  { key: "soaked",   label: "海に落ちてびしょ濡れ" },
];

function pickRestReason(){
  return REST_REASONS[Math.floor(Math.random()*REST_REASONS.length)];
}
function restLabelByKey(key){
  const f = REST_REASONS.find(r=>r.key===key);
  return f ? f.label : "体調不良";
}


/* ---------- プレイヤー入力欄 ---------- */
function addInput() {
  if (playerCount >= MAX) return;
  playerCount++;
  const div = document.createElement("div");
  div.className = "playerInput";
  div.innerHTML = `<input placeholder="プレイヤー${playerCount}" maxlength="10">`;
  listElm.appendChild(div);
  validate();
}
function removeInput() {
  if (playerCount <= MIN) return;
  listElm.lastChild.remove();
  playerCount--;
  validate();
}
function validate() {
  const names = [...listElm.querySelectorAll("input")].map((i) =>
    i.value.trim(),
  );
  const ok = names.every((n) => n) && new Set(names).size === names.length;
  btnBegin.classList.toggle("active", ok);

  // ボタンのクリック可能状態も制御
  if (ok) {
    btnBegin.style.pointerEvents = "auto";
    btnBegin.style.cursor = "pointer";
  } else {
    btnBegin.style.pointerEvents = "none";
    btnBegin.style.cursor = "not-allowed";
  }
}

/* ---------- 画面遷移 ---------- */
btnStart.onclick = () => {
  title.style.display = "none";
  setup.style.display = "flex";
  addInput();
  addInput();
};
btnAdd.onclick = addInput;
btnRem.onclick = removeInput;
listElm.addEventListener("input", validate);
btnBegin.onclick = async () => {
  // 念のため入力チェック
  const names = [...listElm.querySelectorAll("input")].map((i) =>
    i.value.trim(),
  );
  const isValid = names.every((n) => n) && new Set(names).size === names.length;

  if (!isValid) {
    alert("すべてのプレイヤー名を入力してください（重複不可）");
    return;
  }

  playerNamesGlobal = names;
  setup.style.display = "none";
  document.body.style.overflow = "hidden";
  createDayHUD();
  updateDayHUD();

  // ←ここでプリロードを待つ（待たずに開始したいなら await を外してOK）
  await preloadAllImages();

  initThree(playerNamesGlobal);
  showIntro();
};

/* ---------- モーダル ---------- */
function show(txt, closable = true) {
  modalBox.innerHTML = txt;
  modal.style.display = "flex";
  if (closable) modal.onclick = () => (modal.style.display = "none");
  else modal.onclick = null;
  // 余計なボタンや要素を消す
  Array.from(modalBox.querySelectorAll("button")).forEach((btn) =>
    btn.remove(),
  );
}

/* ---------- 世界観イントロ ---------- */
function showIntro() {
  show(
    [
      "🏖️ 夏休みスタート！ 🏖️",
      "",
      "ここは海辺の街「潮風町」。駅前の賑わいから、路地裏の猫、坂道の先の展望台、そして潮の匂いが漂う海辺まで——",
      "街をぐるっと一周しながら、出会いと小さな出来事を紡いでいくボードゲームです。",
      "",
      "・1人ずつサイコロを振って、盤面を進みます",
      "・止まった場所の“空気感”に合わせてイベントが発生します",
      "・選んだ言葉や行動で、相手の心が少しずつ動きます",
      "",
      "まずは『行動順』を決めましょう。",
    ].join("\n"),
    false,
  );
  modal.onclick = () => {
    modal.style.display = "none";
    launchOrderRoll(playerNamesGlobal);
  };
}

/* ======================= Three.js 初期化 ======================= */
let takasa = innerHeight;
function initThree(playerNames) {
  canvas.style.display = "block";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  camera = new THREE.PerspectiveCamera(60, innerWidth / takasa, 1, 2000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, takasa);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(innerWidth, takasa);
  Object.assign(labelRenderer.domElement.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: 5,
  });
  document.body.appendChild(labelRenderer.domElement);

  addEventListener("resize", () => {
    camera.aspect = innerWidth / takasa;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, takasa);
    labelRenderer.setSize(innerWidth, takasa);
  });

  /* ground & light */
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshStandardMaterial({ color: 0x228b22 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  /* board tiles */
  const CELL = 20,
    gap = 4,
    tiles = [],
    layout = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 1],
      [3, 2],
      [3, 3],
      [2, 3],
      [1, 3],
      [0, 3],
      [0, 2],
      [0, 1],
    ];
  const tileGeo = new THREE.BoxGeometry(CELL, CELL * 0.2, CELL),
    tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  layout.forEach((p, i) => {
    const m = new THREE.Mesh(tileGeo, tileMat.clone());
    m.position.set(
      (p[0] - 1.5) * (CELL + gap),
      (CELL * 0.1) / 2,
      (p[1] - 1.5) * (CELL + gap),
    );
    m.userData = { type: "tile", id: i + 1 };
    scene.add(m);
    tiles.push(m);
    const d = document.createElement("div");
    d.textContent = tileInfo[i + 1].name;
    d.style.color = "#000";
    d.style.fontWeight = "700";
    const lbl = new CSS2DObject(d);
    lbl.position.set(0, CELL * 0.15, 0);
    m.add(lbl);
  });
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      layout
        .concat([layout[0]])
        .map(
          (p) =>
            new THREE.Vector3(
              (p[0] - 1.5) * (CELL + gap),
              CELL * 0.1 + 0.01,
              (p[1] - 1.5) * (CELL + gap),
            ),
        ),
    ),
    new THREE.LineBasicMaterial({ color: 0x555555 }),
  );
  scene.add(line);

  /* players */
  const colors = [0xff3333, 0xffff33, 0x33ff33, 0x3333ff, 0x111111, 0xffffff],
    pawns = [];
  const pawnGeo = new THREE.ConeGeometry(CELL * 0.4, CELL, 6);
  function placePawn(pawn, tIdx) {
    const group = pawns.filter((p) => p.userData.tile === tIdx).concat(pawn);
    const r = CELL * 0.3;
    group.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / group.length,
        base = tiles[tIdx].position;
      p.position.set(
        base.x + Math.cos(angle) * r,
        CELL * 0.6,
        base.z + Math.sin(angle) * r,
      );
      p.scale.setScalar(1 / group.length);
    });
  }
  pawnsGlobal = pawns;
  tilesGlobal = tiles;
  tileInfoGlobal = tileInfo;
  placePawnGlobal = placePawn;

 // players（initThree内の該当ブロック）
playerNames.slice(0, 6).forEach((name, i) => {
  const mesh = new THREE.Mesh(pawnGeo, new THREE.MeshStandardMaterial({ color: colors[i] }));
  mesh.rotation.x = Math.PI;
  const cssColor = "#" + colors[i].toString(16).padStart(6, "0");
  playerColorMap[name] = cssColor;

  mesh.userData = {
    type: "player",
    name,
    tile: 0,
    money: 0, // ★ 所持金
    tags: [],
    lastAcquiredTagDetail: null,
    likability: (name==="2002"||name==="0601")
      ? { ミユ:220, シオン:220, ナナ:220 }
      : { ミユ:0, シオン:0, ナナ:0 },
  };

  placePawn(mesh, 0);
  scene.add(mesh);
  pawns.push(mesh);
  const tag = document.createElement("div");
  tag.textContent = name;
  tag.style.color = "#fff";
  tag.style.fontSize = "0.8rem";
  tag.style.textShadow = "0 0 2px #000";
  const tagObj = new CSS2DObject(tag);
  tagObj.position.set(0, CELL * 0.8 - 35, 0);
  mesh.add(tagObj);
});

  /* click inspect */
  const ray = new THREE.Raycaster(),
    mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown", (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = (-(e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(scene.children, false)[0];
    if (!hit) return;
    const o = hit.object;
    if (o.userData.type === "tile") {
      const t = tileInfo[o.userData.id];
      show(`【${t.name}】\n${t.detail}`);
    }
  });

  /* camera control & animate */
  const minPhi = 0.2,
    maxPhi = Math.PI / 2 - 0.05,
    minDist = 80,
    maxDist = 300;
  const activeTouches = new Map();
  let prevDist = null;
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  canvas.addEventListener("pointerup", (e) => {
    activeTouches.delete(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!activeTouches.has(e.pointerId)) return;
    const prev = activeTouches.get(e.pointerId),
      now = { x: e.clientX, y: e.clientY };
    activeTouches.set(e.pointerId, now);
    if (activeTouches.size === 1) {
      const dx = now.x - prev.x,
        dy = now.y - prev.y;
      theta -= dx * 0.006;
      phi -= dy * 0.006;
      phi = Math.min(maxPhi, Math.max(minPhi, phi));
    } else if (activeTouches.size === 2) {
      const pts = [...activeTouches.values()],
        dNow = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (prevDist !== null) {
        dist *= prevDist / dNow;
        dist = Math.min(maxDist, Math.max(minDist, dist));
      }
      prevDist = dNow;
    }
  });
  canvas.addEventListener("pointercancel", () => {
    prevDist = null;
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      dist *= 1 + e.deltaY * 0.001;
      dist = Math.min(maxDist, Math.max(minDist, dist));
    },
    { passive: true },
  );

  const clock = new THREE.Clock();
  (function animate() {
    requestAnimationFrame(animate);
    const target = (currentPawn ?? pawnsGlobal[0]).position;
    const x = target.x + dist * Math.sin(phi) * Math.sin(theta),
      y = target.y + dist * Math.cos(phi),
      z = target.z + dist * Math.sin(phi) * Math.cos(theta);
    camera.position.set(x, y, z);
    camera.lookAt(target);
    const t = clock.getElapsedTime(),
      g = 0x80 + Math.floor(((Math.sin(t * 0.6) + 1) / 2) * 0x40);
    ground.material.color.setRGB(0x22 / 255, g / 255, 0x22 / 255);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  })();
}

/* ======================= 順番決め 1d100 ======================= */
function launchOrderRoll(players) {
  const used = [],
    rollRes = [];
  let idx = 0,
    timer,
    n = 0;

  modal.style.display = "flex";
  modal.onclick = null;

  // ルーレット表示用DOM
  const spin = document.createElement("div");
  spin.style.fontSize = "2rem";
  spin.style.margin = ".5rem 0 1rem";

  // 共通ボタン
  const actionBtn = document.createElement("button");
  actionBtn.style.marginTop = "1rem";

  // -------- ボタンを押して数値を確定する処理 --------
  function decide() {
    clearInterval(timer);

    // 被り対策（同じ目が出続けたとき用の保険）
    while (used.includes(n)) n = Math.ceil(Math.random() * 100);

    used.push(n);
    rollRes.push({ name: players[idx], num: n });
    idx++;

    // 次があるか、結果確定か
    if (idx < players.length) {
      // ------- 次の人へ -------
      modalBox.innerHTML =
        `<strong style="font-size:1.2rem;">行動順を決めましょう！</strong>\n` +
        rollRes.map((o) => `${o.name}：${o.num}`).join("\n") +
        `\n\n${players[idx]} さん、準備はいい？\n\n`;
      actionBtn.textContent = "NEXT";
      actionBtn.onclick = startSpin;
      modalBox.appendChild(actionBtn);
    } else {
      // ------- 確定 -------
      rollRes.sort((a, b) => b.num - a.num);
      modalBox.innerHTML =
        `<strong style="font-size:1.2rem;">順番が決まりました！</strong>\n\n` +
        rollRes
          .map((o, i) => `${i + 1}番目　${o.name}　(${o.num})\n`)
          .join("\n");
      const ok = document.createElement("button");
      ok.textContent = "ゲーム開始！";
      ok.style.marginTop = "1rem";
      ok.onclick = () => {
        modal.style.display = "none";
        gameState.order = rollRes.map((r) => r.name);
        gameState.turn = 0;
        gameState.day = 1;
        gameState.festivalDone = false;

        gameState.endingDone = false;
        gameState.shiftWindow1Done = false;
        gameState.shiftWindow2Done = false;

        updateDayHUD();

        prefetchEventFor(gameState.order[0]); // ★ 1人目をここで先読み
        startTurn();
      };
      modalBox.appendChild(ok);
    }
  }

  // -------- サイコロを回し始める --------
  function startSpin() {
    // UI初期化
    modalBox.innerHTML =
      `<strong style="font-size:1.2rem;">行動順を決めましょう！</strong>\n` +
      `一番大きな数の人が先頭です\n\n${players[idx]} さん、ボタンを押してください`;
    modalBox.appendChild(spin);

    // ボタンを “決定” モードに
    actionBtn.textContent = "決定";
    actionBtn.onclick = decide;
    modalBox.appendChild(actionBtn);

    // ルーレット開始
    timer = setInterval(() => {
      n = Math.ceil(Math.random() * 100);
      spin.textContent = n;
    }, 40);
  }

  // 最初の人のスピン開始
  startSpin();
}

/* ---------- 手番開始 ---------- */
function startTurn() {
  const pawn = pawnsGlobal.find(p => p.userData.name === gameState.order[gameState.turn]);
  currentPawn = pawn;
  cameraInstantLook();
  updateStepsHUD();

  // ① 盆踊り当日
  if (gameState.day === festivalDay && !gameState.festivalDone) {
    runBonOdoriFestival();
    return;
  }
  // ② 最終日
  if (gameState.day === finalDay && !gameState.endingDone) {
    runFinalConfessionEvent();
    return;
  }
  // ★ ③ 7日目：全員の就業先を決める（未設定なら）
  if (gameState.day === 7 && !gameState.jobsChosen) {
    runJobsSelectionDay7(); // ← 下で定義
    return;
  }
  // ★ ③.5 シフト決定（7〜14日目）
  if (!gameState.shiftWindow1Done && gameState.day >= SHIFT_WINDOWS[0].start) {
    runShiftSelectionWindow(SHIFT_WINDOWS[0]);
    return;
  }
  // ★ ③.6 シフト決定（16〜29日目）
  if (!gameState.shiftWindow2Done && gameState.day >= SHIFT_WINDOWS[1].start) {
    runShiftSelectionWindow(SHIFT_WINDOWS[1]);
    return;
  }
  // ④ 休み消化
  if (pawn.userData.rest && pawn.userData.rest.active) {
    handleRestTurn(pawn);
    return;
  }
  // ⑤ 先読み
  prefetchNextPlayerFromCurrentTurn();
  // ⑥ シフト日ならバイト直行（サイコロ・通常イベントは省略）
  if (isShiftDay(pawn, gameState.day)) {
    const plan = prefetchPlan.get(pawn.userData.name);
    if (plan && plan.isShiftDay && plan.day !== gameState.day) {
      clearPrefetchForPlayer(pawn.userData.name);
    }
    const usePlan =
      plan && plan.isShiftDay && plan.day === gameState.day ? plan : null;
    runShiftWorkDay(pawn, usePlan);
    return;
  }
  startTurnModal(pawn.userData.name);
}



function startTurnModal(name) {
  show(`${name} の番です！\n\n`, false);
  const diceBtn = document.createElement("button");
  diceBtn.textContent = "サイコロを振る";
  diceBtn.onclick = () => {
    modal.style.display = "none";
    setTimeout(() => rollDice(name), 200);
  };
  const mapBtn = document.createElement("button");
  mapBtn.textContent = "マップを見る";
  mapBtn.style.marginLeft = ".5rem";
  mapBtn.onclick = () => {
    modal.style.display = "none";
    backBtn.style.display = "block";
  };
  modalBox.appendChild(diceBtn);
  modalBox.appendChild(mapBtn);
}
function cameraInstantLook() {
  if (!currentPawn) return;
  const t = currentPawn.position;
  const x = t.x + dist * Math.sin(phi) * Math.sin(theta),
    y = t.y + dist * Math.cos(phi),
    z = t.z + dist * Math.sin(phi) * Math.cos(theta);
  camera.position.set(x, y, z);
  camera.lookAt(t);
}

/* ---------- サイコロ 1d6 ---------- */
function rollDice(name) {
  modal.style.display = "flex";
  modal.onclick = null;
  const content = document.createElement("div");
  const rollDisplay = document.createElement("div");
  rollDisplay.textContent = "🎲 1 🎲";
  rollDisplay.style.fontSize = "2rem";
  rollDisplay.style.marginBottom = "1rem";
  const decide = document.createElement("button");
  decide.textContent = "決定";
  decide.style.marginTop = "1rem";
  content.appendChild(rollDisplay);
  content.appendChild(decide);
  modalBox.innerHTML = "";
  modalBox.appendChild(content);
  let n = 1;
  const timer = setInterval(() => {
    n = Math.ceil(Math.random() * 6);
    rollDisplay.textContent = `🎲 ${n} 🎲`;
  }, 70);

  decide.onclick = () => {
    clearInterval(timer);
    // ★ 事前決定のダイスがあればそれを使う
    const plan = prefetchPlan.get(name);
    const fixed = plan?.steps ?? n;
    rollDisplay.textContent = `🎲 ${fixed} 🎲\n\n確定！`;
    decide.remove();
    setTimeout(() => {
      modal.style.display = "none";
      movePawn(name, fixed);
    }, 1000);
  };
}

/* ---------- 駒移動 ---------- */
function movePawn(name, steps) {
  const pawn = pawnsGlobal.find(p => p.userData.name === name);
  currentPawn = pawn;

  if (typeof pawn.userData.totalSteps !== "number") pawn.userData.totalSteps = 0;
  pawn.userData.totalSteps += steps;
  updateStepsHUD();

  let remaining = steps;
  (function step(){
    if (remaining === 0) {
      resolveTileEvent(pawn);
      return;
    }
    pawn.userData.tile = (pawn.userData.tile + 1) % 12;
    placePawnGlobal(pawn, pawn.userData.tile);

    remaining--;
    setTimeout(step, 250);
  })();
}








/* ======================================================
   アルバイト：UI/処理
====================================================== */
function getPlayerJob(pawn){
  const k = pawn?.userData?.jobKey;
  return k ? PARTTIME_JOBS[k] : null;
}

function ensureShiftData(pawn) {
  if (!pawn.userData.shiftDays) pawn.userData.shiftDays = [];
  if (!pawn.userData.fishingPayDays) pawn.userData.fishingPayDays = [];
  if (!pawn.userData.fishingStartDays) pawn.userData.fishingStartDays = [];
}

function isShiftDay(pawn, day) {
  ensureShiftData(pawn);
  return pawn.userData.shiftDays.includes(day);
}

function isFishingPayDay(pawn, day) {
  ensureShiftData(pawn);
  return pawn.userData.fishingPayDays.includes(day);
}

function setShiftDaysForWindow(pawn, windowStart, windowEnd, days, fishingStartDays = [], fishingPayDays = []) {
  ensureShiftData(pawn);
  const inWindow = (d) => d >= windowStart && d <= windowEnd;
  pawn.userData.shiftDays = pawn.userData.shiftDays.filter((d) => !inWindow(d));
  pawn.userData.fishingPayDays = pawn.userData.fishingPayDays.filter((d) => !inWindow(d));
  pawn.userData.fishingStartDays = pawn.userData.fishingStartDays.filter((d) => !inWindow(d));

  const uniqueDays = Array.from(new Set(days)).sort((a, b) => a - b);
  pawn.userData.shiftDays.push(...uniqueDays);
  const uniqueStarts = Array.from(new Set(fishingStartDays)).sort((a, b) => a - b);
  const uniquePayDays = Array.from(new Set(fishingPayDays)).sort((a, b) => a - b);
  pawn.userData.fishingStartDays.push(...uniqueStarts);
  pawn.userData.fishingPayDays.push(...uniquePayDays);
}

function clearPrefetchForPlayer(playerName) {
  const plan = prefetchPlan.get(playerName);
  if (plan) {
    prefetchResult.delete(plan.requestId);
    shiftPrefetchResult.delete(plan.requestId);
    prefetchPlan.delete(playerName);
  }
}

function buildFishingDaysFromStarts(starts) {
  const days = [];
  starts.forEach((startDay) => {
    for (let d = startDay; d <= startDay + 6; d += 1) {
      days.push(d);
    }
  });
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

function buildFishingPayDays(starts) {
  return Array.from(new Set(starts.map((d) => d + 6))).sort((a, b) => a - b);
}

function hasOverlappingFishingStart(candidateStart, existingStarts) {
  const rangeEnd = candidateStart + 6;
  return existingStarts.some((start) => {
    const startEnd = start + 6;
    return !(rangeEnd < start || startEnd < candidateStart);
  });
}

function buildDarkShiftDays(windowStart, windowEnd) {
  const days = [];
  for (let d = windowStart; d <= windowEnd; d += 1) {
    if ((Math.random() * 100) < DARK_SHIFT_RATE) days.push(d);
  }
  return days;
}

function getFishingDayCount(pawn, day) {
  const starts = pawn.userData.fishingStartDays || [];
  const currentStart = starts.find((s) => day >= s && day <= s + 6);
  return currentStart ? day - currentStart + 1 : null;
}

function getShiftMatchingText(pawn, job, day) {
  if (job.type === "weekly") {
    const dayCount = getFishingDayCount(pawn, day) ?? 1;
    return `${pawn.userData.name}は今海の上、${dayCount}/7日目だ`;
  }
  return `${pawn.userData.name}は${job.label}に出勤中だ`;
}

function stopShiftDots() {
  if (shiftDotsTimer) {
    clearInterval(shiftDotsTimer);
    shiftDotsTimer = null;
  }
}

function startShiftDots(el, baseText) {
  stopShiftDots();
  const dots = [".", "..", "..."];
  let idx = 0;
  el.textContent = `${baseText}${dots[idx]}`;
  shiftDotsTimer = setInterval(() => {
    idx = (idx + 1) % dots.length;
    el.textContent = `${baseText}${dots[idx]}`;
  }, 600);
}

function ensureShiftMatchingDelay(payload, ctx) {
  if (!ctx?.requestId) {
    renderShiftEventResult(payload, ctx);
    return;
  }
  const elapsed = Date.now() - (ctx.startedAt || Date.now());
  const waitMs = Math.max(0, 1500 - elapsed);
  const requestId = ctx.requestId;
  const run = () => {
    if (!currentMatching || currentMatching.requestId !== requestId) return;
    renderShiftEventResult(payload, currentMatching);
  };
  if (waitMs > 0) {
    setTimeout(run, waitMs);
  } else {
    run();
  }
}

//七日目に職業に就く処理
function runJobsSelectionDay7(){
  modal.style.display = "flex";
  modal.onclick = null;

  const allPlayers = [...gameState.order];
  const keys = Object.keys(PARTTIME_JOBS);
  let currentPlayerIdx = 0;
  const selected = new Map(); // name -> jobKey
  const decided = new Set();  // 決定済みプレイヤー

  // 1枚ぶんの移動率（%）
  const PCT_PER_CARD = 100 / Math.max(1, keys.length);

  // ルート
  const root = document.createElement("div");
  root.style.width = "min(96vw, 860px)";
  root.style.maxWidth = "860px";

  const title = document.createElement("div");
  title.style.fontWeight = "900";
  title.style.fontSize = "1.2rem";
  title.style.marginBottom = ".5rem";
  title.textContent = "7日目：みんなでアルバイトを決めよう";
  root.appendChild(title);

  // プレイヤー切替（チップ）
  const chips = document.createElement("div");
  chips.style.display = "flex";
  chips.style.flexWrap = "wrap";
  chips.style.gap = "8px";
  chips.style.margin = "8px 0 12px";
  function renderChips(){
    chips.innerHTML = "";
    allPlayers.forEach((n, i) => {
      const b = document.createElement("button");
      b.textContent = selected.has(n) ? `${n} ✅` : n + (i===currentPlayerIdx ? "▷" : "");
      Object.assign(b.style, {
        border:"1px solid #2ea043",
        borderRadius:"999px",
        padding:"6px 10px",
        background: i===currentPlayerIdx ? "#2ea043" : "#111",
        color: i===currentPlayerIdx ? "#fff" : "#eee",
        cursor:"pointer",
        fontWeight:"800",
        boxShadow: i===currentPlayerIdx ? "0 0 0 2px rgba(46,160,67,.25)" : "none",
      });
      b.onclick = () => { currentPlayerIdx = i; renderAll(); };
      chips.appendChild(b);
    });
  }
  root.appendChild(chips);

  // カルーセル
  let jobIdx = 0;
  const viewport = document.createElement("div");
  Object.assign(viewport.style, {
    position:"relative",
    overflow:"hidden",
    height:"240px",
    border:"1px solid #333",
    borderRadius:"12px",
    background:"#101010"
  });

  const track = document.createElement("div");
  Object.assign(track.style, {
    display:"flex",
    height:"100%",
    width: `${keys.length * 100}%`,   // ← N枚ぶんの幅（維持）
    transition:"transform .35s ease",
    willChange:"transform",
  });
  viewport.appendChild(track);

  function renderCard(jobKey){
    const job = PARTTIME_JOBS[jobKey];
    let payLine = "";
    let extraLine = "";
    if (job.type === "daily") {
      payLine = `給料: ¥${job.dailyPay.toLocaleString()} / 日`;
    } else if (job.type === "weekly") {
      payLine = `給料: ¥${job.weeklyPay.toLocaleString()} / 週`;
      extraLine = "※ 1回のバイトで7日間固定";
    } else if (job.type === "dark") {
      payLine = "給料: ランダム";
      extraLine = "※ シフトはランダムで自動決定";
    }
    const card = document.createElement("div");
    card.style.flex = `0 0 ${PCT_PER_CARD}%`; // ← ★ここを 100% から修正（1枚＝画面1枚ぶん）
    card.style.padding = "14px";
    card.style.display = "grid";
    card.style.gridTemplateRows = "auto auto 1fr auto";
    card.style.gap = "8px";
    card.innerHTML = `
      <div style="font-weight:800; font-size:1.1rem">${job.label}</div>
      <div style="opacity:.85">${job.place.name}：${job.place.detail}</div>
      <div style="opacity:.85; font-size:.95rem">
        ${payLine}<br>
        出会い発生率: ${job.encounterPct}%
      </div>
      <div style="font-size:.85rem; opacity:.75">
        ${extraLine}
      </div>
    `;
    return card;
  }
  keys.forEach(k => track.appendChild(renderCard(k)));

  const btnL = document.createElement("button");
  btnL.className = "btn";
  btnL.textContent = "←";
  Object.assign(btnL.style, {position:"absolute", left:"8px", top:"calc(50% - 18px)"});
  const btnR = document.createElement("button");
  btnR.className = "btn";
  btnR.textContent = "→";
  Object.assign(btnR.style, {position:"absolute", right:"8px", top:"calc(50% - 18px)"});
  viewport.appendChild(btnL);
  viewport.appendChild(btnR);

  // 1枚ぶんずつ移動
  function updateTrack(){
    track.style.transform = `translateX(${-jobIdx * PCT_PER_CARD}%)`;
  }
  btnL.onclick = ()=>{ jobIdx = (jobIdx - 1 + keys.length) % keys.length; updateTrack(); };
  btnR.onclick = ()=>{ jobIdx = (jobIdx + 1) % keys.length; updateTrack(); };

  // スワイプ
  let startX=null;
  viewport.addEventListener("touchstart", e=>{ startX=e.touches[0].clientX; }, {passive:true});
  viewport.addEventListener("touchend", e=>{
    if (startX==null) return;
    const dx = e.changedTouches[0].clientX - startX; startX=null;
    if (Math.abs(dx)<30) return;
    if (dx<0) btnR.onclick(); else btnL.onclick();
  });

  root.appendChild(viewport);

  // 決定ボタン & 全員決定
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.justifyContent = "space-between";
  row.style.gap = "10px";
  row.style.marginTop = "10px";

  const decideBtn = document.createElement("button");
  decideBtn.className = "btn btn-primary";
  decideBtn.textContent = "このバイトにする";
  decideBtn.onclick = ()=>{
    const name = allPlayers[currentPlayerIdx];
    const key = keys[jobIdx];
    selected.set(name, key);
    decided.add(name);
    const nextIdx = allPlayers.findIndex(n=>!decided.has(n));
    currentPlayerIdx = (nextIdx>=0 ? nextIdx : currentPlayerIdx);
    renderAll();
  };

  const allDoneBtn = document.createElement("button");
  allDoneBtn.className = "btn";
  allDoneBtn.textContent = "全員決定！";
  allDoneBtn.onclick = ()=>{
    pawnsGlobal.forEach(p=>{
      const k = selected.get(p.userData.name);
      if (k) p.userData.jobKey = k;
    });
    gameState.jobsChosen = true;
    modal.style.display = "none";
    showToast("全員のアルバイトが決まりました！");
    startTurn();
  };

  function syncAllDoneState(){
    const ok = allPlayers.every(n => selected.has(n));
    allDoneBtn.disabled = !ok;
    allDoneBtn.style.opacity = ok ? "1" : ".5";
    allDoneBtn.style.cursor = ok ? "pointer" : "not-allowed";
  }

  row.appendChild(decideBtn);
  row.appendChild(allDoneBtn);
  root.appendChild(row);

  function renderAll(){
    renderChips();
    const curName = allPlayers[currentPlayerIdx];
    const k = selected.get(curName);
    jobIdx = (k ? Math.max(0, keys.indexOf(k)) : jobIdx);
    if (jobIdx < 0) jobIdx = 0;
    updateTrack();
    syncAllDoneState();
    title.textContent = `7日目：みんなでアルバイトを決めよう（いま：${curName}）`;
  }

  modalBox.innerHTML = "";
  modalBox.appendChild(root);
  renderAll();
}

function runShiftSelectionWindow(windowInfo) {
  const { start, end, label, key } = windowInfo;
  modal.style.display = "flex";
  modal.onclick = null;

  const allPlayers = [...gameState.order];
  let currentPlayerIdx = 0;
  const decided = new Set();
  const selections = new Map(); // name -> { days:[], fishingStarts:[], fishingPayDays:[] }
  const drafts = new Map(); // name -> { days:Set, fishingStarts:Set }

  const pawnsByName = new Map();
  allPlayers.forEach((name) => {
    const pawn = pawnsGlobal.find((p) => p.userData.name === name);
    if (!pawn) return;
    pawnsByName.set(name, pawn);
    ensureShiftData(pawn);
    const inWindow = (d) => d >= start && d <= end;
    let days = new Set(pawn.userData.shiftDays.filter(inWindow));
    let starts = new Set(pawn.userData.fishingStartDays.filter(inWindow));
    const job = getPlayerJob(pawn);
    if (job && job.type === "weekly" && !starts.size && days.size) {
      const dayList = Array.from(days).sort((a, b) => a - b);
      dayList.forEach((d, idx) => {
        const prev = dayList[idx - 1];
        if (!prev || d !== prev + 1) starts.add(d);
      });
    }
    if (job && job.type === "weekly" && starts.size) {
      days = new Set(buildFishingDaysFromStarts(Array.from(starts)));
    }
    if (job && job.type === "dark" && !days.size) {
      days = new Set(buildDarkShiftDays(start, end));
    }
    drafts.set(name, { days, fishingStarts: starts });
  });

  const root = document.createElement("div");
  root.style.width = "min(96vw, 860px)";
  root.style.maxWidth = "860px";

  const title = document.createElement("div");
  title.style.fontWeight = "900";
  title.style.fontSize = "1.2rem";
  title.style.marginBottom = ".5rem";
  title.textContent = `シフト提出：${label}`;
  root.appendChild(title);

  const hint = document.createElement("div");
  hint.style.fontSize = ".9rem";
  hint.style.opacity = ".85";
  hint.style.marginBottom = ".6rem";
  hint.textContent =
    "出勤日になったらバイトイベントへ直行します（通常の会話イベントは省略）。遭遇した場合は会話イベントが発生します。";
  root.appendChild(hint);

  const chips = document.createElement("div");
  chips.style.display = "flex";
  chips.style.flexWrap = "wrap";
  chips.style.gap = "8px";
  chips.style.margin = "8px 0 12px";
  function renderChips() {
    chips.innerHTML = "";
    allPlayers.forEach((n, i) => {
      const b = document.createElement("button");
      b.textContent = selections.has(n) ? `${n} ✅` : n + (i === currentPlayerIdx ? "▷" : "");
      Object.assign(b.style, {
        border: "1px solid #2ea043",
        borderRadius: "999px",
        padding: "6px 10px",
        background: i === currentPlayerIdx ? "#2ea043" : "#111",
        color: i === currentPlayerIdx ? "#fff" : "#eee",
        cursor: "pointer",
        fontWeight: "800",
        boxShadow: i === currentPlayerIdx ? "0 0 0 2px rgba(46,160,67,.25)" : "none",
      });
      b.onclick = () => {
        currentPlayerIdx = i;
        renderAll();
      };
      chips.appendChild(b);
    });
  }
  root.appendChild(chips);

  const scheduleBox = document.createElement("div");
  scheduleBox.style.border = "1px solid #333";
  scheduleBox.style.borderRadius = "12px";
  scheduleBox.style.padding = "12px";
  scheduleBox.style.background = "#101010";
  root.appendChild(scheduleBox);

  function renderSchedule() {
    scheduleBox.innerHTML = "";
    const name = allPlayers[currentPlayerIdx];
    const pawn = pawnsByName.get(name);
    const job = getPlayerJob(pawn);
    const draft = drafts.get(name);
    const header = document.createElement("div");
    header.style.fontWeight = "800";
    header.style.marginBottom = ".5rem";
    header.textContent = `${name}：${job ? job.label : "バイト未選択"}`;
    scheduleBox.appendChild(header);

    if (!job) {
      scheduleBox.appendChild(document.createTextNode("バイトが未設定です。"));
      return;
    }

    if (job.type === "dark") {
      const info = document.createElement("div");
      info.style.marginBottom = ".5rem";
      info.textContent = "シフトはランダムで自動決定されます。";
      scheduleBox.appendChild(info);

      const days = Array.from(draft.days).sort((a, b) => a - b);
      const list = document.createElement("div");
      list.textContent = '出勤日:？？？';
      scheduleBox.appendChild(list);
      return;
    }

    if (job.type === "weekly") {
      const starts = Array.from(draft.fishingStarts).sort((a, b) => a - b);
      const allowedStarts = [];
      for (let d = start; d <= end - 6; d += 1) {
        allowedStarts.push(d);
      }
      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(72px, 1fr))";
      grid.style.gap = "6px";
      allowedStarts.forEach((d) => {
        const btn = document.createElement("button");
        btn.className = "btn";
        const active = draft.fishingStarts.has(d);
        const overlap = !active && hasOverlappingFishingStart(d, Array.from(draft.fishingStarts));
        btn.disabled = overlap;
        btn.textContent = `${d}日開始`;
        btn.style.background = active ? "var(--accent)" : "#222";
        btn.style.color = active ? "#111" : "#eee";
        if (overlap) {
          btn.style.opacity = ".4";
          btn.style.cursor = "not-allowed";
        }
        btn.onclick = () => {
          if (btn.disabled) return;
          if (draft.fishingStarts.has(d)) {
            draft.fishingStarts.delete(d);
          } else {
            draft.fishingStarts.add(d);
          }
          draft.days = new Set(buildFishingDaysFromStarts(Array.from(draft.fishingStarts)));
          renderSchedule();
        };
        grid.appendChild(btn);
      });
      scheduleBox.appendChild(grid);

      const workDays = Array.from(draft.days).sort((a, b) => a - b);
      const payDays = buildFishingPayDays(starts);
      const summary = document.createElement("div");
      summary.style.marginTop = ".6rem";
      summary.textContent = workDays.length
        ? `稼働日: ${workDays.join(", ")}日 / 給料支給日: ${payDays.join(", ")}日`
        : "稼働日: なし";
      scheduleBox.appendChild(summary);
      return;
    }

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(48px, 1fr))";
    grid.style.gap = "6px";
    for (let d = start; d <= end; d += 1) {
      const btn = document.createElement("button");
      btn.className = "btn";
      const active = draft.days.has(d);
      btn.textContent = `${d}日`;
      btn.style.background = active ? "var(--accent)" : "#222";
      btn.style.color = active ? "#111" : "#eee";
      btn.onclick = () => {
        if (draft.days.has(d)) {
          draft.days.delete(d);
        } else {
          draft.days.add(d);
        }
        renderSchedule();
      };
      grid.appendChild(btn);
    }
    scheduleBox.appendChild(grid);

    const summary = document.createElement("div");
    const dayList = Array.from(draft.days).sort((a, b) => a - b);
    summary.style.marginTop = ".6rem";
    summary.textContent = dayList.length ? `出勤日: ${dayList.join(", ")}日` : "出勤日: なし";
    scheduleBox.appendChild(summary);
  }

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.justifyContent = "space-between";
  row.style.gap = "10px";
  row.style.marginTop = "10px";

  const decideBtn = document.createElement("button");
  decideBtn.className = "btn btn-primary";
  decideBtn.textContent = "このシフトにする";
  decideBtn.onclick = () => {
    const name = allPlayers[currentPlayerIdx];
    const pawn = pawnsByName.get(name);
    const job = getPlayerJob(pawn);
    const draft = drafts.get(name);
    let days = Array.from(draft.days);
    let fishingStarts = [];
    let fishingPayDays = [];
    if (job && job.type === "weekly") {
      fishingStarts = Array.from(draft.fishingStarts);
      days = buildFishingDaysFromStarts(fishingStarts);
      fishingPayDays = buildFishingPayDays(fishingStarts);
    }
    selections.set(name, {
      days,
      fishingStarts,
      fishingPayDays,
    });
    decided.add(name);
    const nextIdx = allPlayers.findIndex((n) => !decided.has(n));
    currentPlayerIdx = (nextIdx >= 0 ? nextIdx : currentPlayerIdx);
    renderAll();
  };

  const allDoneBtn = document.createElement("button");
  allDoneBtn.className = "btn";
  allDoneBtn.textContent = "全員決定！";
  allDoneBtn.onclick = () => {
    pawnsGlobal.forEach((p) => {
      const selection = selections.get(p.userData.name);
      if (!selection) return;
      setShiftDaysForWindow(
        p,
        start,
        end,
        selection.days,
        selection.fishingStarts,
        selection.fishingPayDays,
      );
    });
    if (key === "first") {
      gameState.shiftWindow1Done = true;
    } else if (key === "second") {
      gameState.shiftWindow2Done = true;
    }
    modal.style.display = "none";
    showToast(`${label} のシフトが決まりました！`);
    startTurn();
  };

  function syncAllDoneState() {
    const ok = allPlayers.every((n) => selections.has(n));
    allDoneBtn.disabled = !ok;
    allDoneBtn.style.opacity = ok ? "1" : ".5";
    allDoneBtn.style.cursor = ok ? "pointer" : "not-allowed";
  }

  row.appendChild(decideBtn);
  row.appendChild(allDoneBtn);
  root.appendChild(row);

  function renderAll() {
    renderChips();
    renderSchedule();
    syncAllDoneState();
    const curName = allPlayers[currentPlayerIdx];
    title.textContent = `シフト提出：${label}（いま：${curName}）`;
  }

  modalBox.innerHTML = "";
  modalBox.appendChild(root);
  renderAll();
}


function weightedPickFromList(list) {
  if (!list || !list.length) return null;
  const sum = list.reduce((s, item) => s + (item.weight || 0), 0);
  let r = Math.random() * sum;
  for (const item of list) {
    r -= item.weight || 0;
    if (r <= 0) return item;
  }
  return list[list.length - 1];
}

function ensureMoney(pawn) {
  if (typeof pawn.userData.money !== "number") pawn.userData.money = 0;
}

function rollDarkJobPayout(job) {
  const pick = weightedPickFromList(job.payouts || []);
  return pick || { label: "結果不明", amount: 0 };
}

async function runShiftWorkDay(pawn, planOpt) {
  const job = getPlayerJob(pawn);
  if (!job) {
    nextTurn();
    return;
  }

  ensureMoney(pawn);
  let payout = 0;
  let payoutLabel = null;
  let darkPayoutLabel = null;
  let extraLine = "";

  if (job.type === "daily") {
    payout = job.dailyPay || 0;
    payoutLabel = `→ ¥${payout.toLocaleString()} を受け取った。`;
  } else if (job.type === "weekly") {
    if (isFishingPayDay(pawn, gameState.day)) {
      payout = job.weeklyPay || 0;
      payoutLabel = `→ 最終日に ¥${payout.toLocaleString()} を受け取った。`;
    } else {
      payoutLabel = "→ 今日は航海の途中。給料の支給は最終日。";
    }
  } else if (job.type === "dark") {
    const result = rollDarkJobPayout(job);
    payout = result.amount || 0;
    darkPayoutLabel = result.label || null;
  }

  if (payout !== 0) {
    pawn.userData.money += payout;
    updateStepsHUD();
  }

  const fishingDayCount = job.type === "weekly"
    ? getFishingDayCount(pawn, gameState.day)
    : null;
  if (fishingDayCount) {
    extraLine = `（${fishingDayCount}日目／7日間）`;
  }

  let willMeet = false;
  let who = null;
  let requestId = null;
  let newlyAcquiredTagDetail = planOpt?.newlyAcquiredTagDetail || null;
  if (planOpt && planOpt.isShiftDay) {
    willMeet = !!planOpt.willMeet;
    who = planOpt.character || null;
    requestId = planOpt.requestId || makeRequestId();
  } else {
    willMeet = (Math.random() * 100) < (job.encounterPct || 0);
    who = willMeet ? randomCharacter() : null;
    requestId = makeRequestId();
    newlyAcquiredTagDetail = maybeAwardTag(pawn, job);
  }

  if (willMeet && who) {
    pawn.userData.meetingCharacter = who;
  }
  pawn.userData.currentPlaceName = job.place.name;

  currentMatching = {
    requestId,
    startedAt: Date.now(),
    player: pawn.userData.name,
    mode: "shift",
    payout,
    characterName: who,
    newlyAcquiredTagDetail,
  };

  if (rouletteTimer) {
    clearInterval(rouletteTimer);
    rouletteTimer = null;
  }
  modal.style.display = "flex";
  modal.onclick = null;
  const payoutLineHtml = payoutLabel
    ? `<div style="margin-top:.5rem; opacity:.8;">${payoutLabel}</div>`
    : "";
  modalBox.innerHTML = `
    <div id="shiftMatchingText" style="font-size:1.6rem;"></div>
    ${payoutLineHtml}
  `;
  const matchingText = document.getElementById("shiftMatchingText");
  if (matchingText) {
    startShiftDots(matchingText, getShiftMatchingText(pawn, job, gameState.day));
  }

  const ready = shiftPrefetchResult.get(requestId);
  if (ready) {
    ensureShiftMatchingDelay(ready, currentMatching);
  } else {
    socket.emit("requestShiftEvent", {
      requestId,
      playername: pawn.userData.name,
      job: {
        label: job.label,
        type: job.type,
        place: job.place,
        payoutLabel: darkPayoutLabel,
      },
      encounter: willMeet && !!who,
      characterName: who,
      likability: who ? pawn.userData.likability?.[who] || 0 : 0,
      fishingDayCount,
      newlyAcquiredTagDetail,
      playerTagBlock: buildPlayerTagBlock(pawn),
    });
  }
}







/* ---------- マスイベント ---------- */
function resolveTileEvent(pawn) {
  const tileId = pawn.userData.tile + 1;
  const place = tileInfoGlobal[tileId];

  // 1回休みマス
  if (place.type === "rest" || place.name === "1回休み") {
    const reason = pickRestReason();
    pawn.userData.rest = { active:true, reasonKey:reason.key, reasonLabel:reason.label, startedDay:gameState.day };
    show(`${pawn.userData.name} は ${reason.label}。1回休み`, false);
    modal.onclick = () => { modal.style.display = "none"; nextTurn(); };
    return;
  }

  // 以降は通常マッチング
  const plan = prefetchPlan.get(pawn.userData.name);
  let characterName, requestId, placeObj;

  if (plan) {
    characterName = plan.character;
    requestId = plan.requestId;
    placeObj = plan.place;
  } else {
    characterName = randomCharacter();
    requestId = makeRequestId();
    placeObj = place;
  }

  pawn.userData.meetingCharacter = characterName;
  pawn.userData.currentPlaceName = placeObj.name;

  currentMatching = { requestId, startedAt: Date.now(), player: pawn.userData.name };

  modal.style.display = "flex";
  modal.onclick = null;

  const ROULETTE_MS = 150;
  rouletteIdx = 0;
  modalBox.innerHTML = [
    `📍 ${pawn.userData.name} は ${placeObj.name} に着いた。`,
    "",
    "だれに会うだろう…？（マッチング中）",
    "",
    `<img id="rouletteImg" style="height:240px;display:block;margin:8px auto;" src="${getCharImg(characterName)}">`,
    `<div id="roulette" style="font-size:1.6rem; margin-top:.5rem;">${characterName}...</div>`,
  ].join("\n");

  const rouletteElm = () => document.getElementById("roulette");
  const rouletteImg = () => document.getElementById("rouletteImg");
  rouletteTimer = setInterval(() => {
    rouletteIdx = (rouletteIdx + 1) % characters.length;
    const el = rouletteElm(), imgEl = rouletteImg();
    if (el) el.textContent = `${characters[rouletteIdx]}...`;
    if (imgEl) imgEl.src = getCharImg(characters[rouletteIdx]);
  }, ROULETTE_MS);

  const ready = prefetchResult.get(requestId);
  if (ready) {
    eventGenerated({ requestId, data: ready });
  } else if (!plan) {
    socket.emit("requestEvent", {
      requestId,
      characterName,
      place: { name: placeObj.name, detail: placeObj.detail },
      likability: pawn.userData.likability[characterName] || 0,
      playername: pawn.userData.name,
      playerTagBlock: buildPlayerTagBlock(pawn),
    });
  }

  setTimeout(() => {
    if (currentMatching && currentMatching.requestId === requestId && rouletteTimer) {
      clearInterval(rouletteTimer);
      rouletteTimer = null;
      modalBox.innerHTML = "通信が混み合っています。少々お待ちください(ｺﾞﾒﾝﾈ)";
      /*const ok = document.createElement("button");
      ok.textContent = "OK";
      ok.onclick = () => { modal.style.display = "none"; nextTurn(); };
      modalBox.appendChild(ok);*/
    }
  }, 20000);
}


/* ---------- 盆踊りセットアップ ---------- */
const festivalPlace = {
  name: "盆踊り会場",
  detail: "提灯の明かりが揺れる夏祭り。太鼓の音、屋台の香り、夜風が甘い。",
};
let festivalQueue = [];
//let currentFestivalCtx = null;

function runBonOdoriFestival() {
  // ★「同率のときは累計マス数が多い人を採用」し、
  //   負けた人には「行きたかったが…」メッセージ用の印を付ける
  const THRESHOLD = 30; // 最低好感度（必要に応じて調整）
  let 盆踊り最低好感度;

  // 失恋（同率でマス数負け）した希望先: playerName -> [char,...]
  const wishLostByPlayer = new Map();

  // 1) 各キャラの勝者を決める（同率は totalSteps で決定）
  const charWinner = {};
  characters.forEach((ch) => {
    // 候補（好感度値）
    const scored = pawnsGlobal.map((pw) => {
      const like = pw.userData?.likability?.[ch] ?? 0;
      const steps =
        typeof pw.userData?.totalSteps === "number"
          ? pw.userData.totalSteps
          : 0;
      return { pawn: pw, name: pw.userData.name, like, steps };
    });

    // 最高好感度
    const maxLike = Math.max(...scored.map((s) => s.like));
    if (!Number.isFinite(maxLike) || maxLike < THRESHOLD) {
      charWinner[ch] = null; // 閾値未満 → デートなし
      return;
    }

    // 同率候補を抽出 → マス数降順で並べる
    const ties = scored.filter((s) => s.like === maxLike);
    ties.sort((a, b) => b.steps - a.steps);

    // 勝者（マス数最大）
    const winner = ties[0];
    charWinner[ch] = winner.name;

    // 負けた同率候補に「本当は◯◯と…」の印を付ける
    ties.slice(1).forEach((loser) => {
      const arr = wishLostByPlayer.get(loser.name) || [];
      arr.push(ch);
      wishLostByPlayer.set(loser.name, arr);
    });
  });

  // 2) プレイヤーごとに束ねる（同時デート対応）
  const byPlayer = new Map(); // playerName -> [char,...]
  Object.entries(charWinner).forEach(([ch, pname]) => {
    if (!pname) return;
    const arr = byPlayer.get(pname) || [];
    arr.push(ch);
    byPlayer.set(pname, arr);
  });

  // 3) キュー作成：全プレイヤー対象
  festivalQueue = [];
  const playerOrder = [...gameState.order];
  playerOrder.forEach((pname) => {
    const pawn = pawnsGlobal.find((pw) => pw.userData.name === pname);
    const chars = byPlayer.get(pname) || []; // 無ければ空配列＝デートなし
    const likabilities = {};
    chars.forEach((ch) => {
      likabilities[ch] = pawn.userData.likability[ch] || 0;
    });
    const wishLost = wishLostByPlayer.get(pname) || [];
    festivalQueue.push({ pawn, chars, likabilities, wishLost });
  });

  // 4) 進行順を「累計マス数の多い人 → 少ない人」に並べ替え
  festivalQueue.sort((a, b) => {
    const sa =
      typeof a.pawn.userData.totalSteps === "number"
        ? a.pawn.userData.totalSteps
        : 0;
    const sb =
      typeof b.pawn.userData.totalSteps === "number"
        ? b.pawn.userData.totalSteps
        : 0;
    return sb - sa;
  });

  // 5) イントロ表示
  show(
    [
      "🎐 盆踊りの夜、開幕 🎐",
      "",
      "ゆらめく提灯の灯り、響く太鼓の音。",
      "夏の夜風が浴衣を揺らし、甘い屋台の匂いが漂う。",
      "",
      "これは、ただのお祭りじゃない。",
      "想いがすれ違い、重なり合う、特別な夜。",
      "もし誰かに好かれているのなら——",
      "その人と、特別な時間を過ごせるかもしれません。",
      "",
      "静かに胸を高鳴らせて————",
    ].join("\n"),
    false,
  );
  modal.onclick = () => {
    modal.onclick = null; // 二重クリック防止
    modal.style.display = "none";
    playNextFestivalInQueue();
  };
}

function playNextFestivalInQueue() {
  if (festivalQueue.length === 0) {
    gameState.festivalDone = true;
    show(
      "提灯が揺れて、夜はゆっくり更けていく——。\n甘い余韻を胸に、夏の夜が終わる。",
      false,
    );

    // ★ 祭りの翌日に進める
    gameState.day = Math.min(finalDay, gameState.day + 1);
    updateDayHUD();

    const ok = document.createElement("button");
    ok.textContent = "OK";
    ok.onclick = () => {
      modal.style.display = "none";
      startTurn();
    };
    modalBox.appendChild(ok);
    return;
  }

  const { pawn, chars, likabilities, wishLost = [] } = festivalQueue.shift();
  currentPawn = pawn;
  cameraInstantLook();

  const label = chars.length ? `${chars.join("と")}` : "";
  const isSolo = chars.length === 0;

  // A) ぼっち
  if (isSolo) {
    // ★ 負けた“本当は行きたかった相手”があれば追記
    const extra =
      wishLost && wishLost.length
        ? `\n\n……本当は${wishLost[0]}と盆踊りに行きたかったが、既に出掛けてたみたいだ。`
        : "";

    show(
      `ー盆踊り当日ー\n${pawn.userData.name}は一人寂しく盆踊りを楽しんだ。。。${extra}\n\n`,
      false,
    );
    const ok = document.createElement("button");
    ok.textContent = "次へ";
    ok.onclick = () => {
      modal.style.display = "none";
      playNextFestivalInQueue();
    };
    modalBox.appendChild(ok);
    return;
  }

  const extra =
    wishLost && wishLost.length
      ? `\n\n……本当は${wishLost[0]}とも一緒に盆踊りに行きたかったが、既に出掛けてたみたいだ。`
      : "";
  // B) デートあり（当日→生成→会話）
  show(
    `ー盆踊り当日ー\n${pawn.userData.name}は${label}と一緒にデートをすることになった！\n\n${extra}\n\n`,
    false,
  );
  const next1 = document.createElement("button");
  next1.textContent = "OK";
  next1.onclick = () => {
    modal.style.display = "none";

    // ★ ここを修正：体調条件（休み理由）をオプションで同梱
    const condition = (pawn.userData.rest && pawn.userData.rest.active)
      ? restLabelByKey(pawn.userData.rest.reasonKey)
      : null;

    socket.emit("requestFestivalEvent", {
      playername: pawn.userData.name,
      characters: chars,
      place: festivalPlace,
      likabilities,
      condition, // ← 追加：例 "風邪をひいた" など（nullなら未指定）
      playerTagBlock: buildPlayerTagBlock(pawn),
    });

    show(`${pawn.userData.name}は、${label}とのデートを準備している…`, false);
  };
  modalBox.appendChild(next1);
}

/* ---------- ターン終了＆日付進行 ---------- */
function nextTurn() {
  gameState.turn = (gameState.turn + 1) % gameState.order.length;
  if (gameState.turn === 0) {
    gameState.day = Math.min(finalDay, gameState.day + 1);
    updateDayHUD();
    if (gameState.day > finalDay) {
      show(
        "🌅 夏休み最終日が終わった——\n告白パート（エンディング）は次フェーズで実装します。",
        false,
      );
      modal.onclick = () => {
        modal.style.display = "none";
      };
      return;
    }
  }
  setTimeout(startTurn, 500);
}

/* ===== 休みターン進行 ===== */
function handleRestTurn(pawn){
  pawn.userData.skipTurn = false;
  
  const name = pawn.userData.name;
  const like = pawn.userData.likability || {};
  const r = pawn.userData.rest || {};
  const reasonKey = r.reasonKey || "cold";
  const reasonLabel = r.reasonLabel || restLabelByKey(reasonKey);

  // 判定セット
  const gte50 = characters.filter(ch => (like[ch]||0) >= 50);
  const gte30 = characters.filter(ch => (like[ch]||0) >= 30);
  const lteM30= characters.filter(ch => (like[ch]||0) <= -30);
  const lteM15= characters.filter(ch => (like[ch]||0) <= -15);

  let type = "alone";
  let visitors = [];

  if (gte50.length){
    type = "visit";
    visitors = [...gte50];
  } else if (gte30.length){
    type = "visit";
    visitors = [ gte30[Math.floor(Math.random()*gte30.length)] ];
  } else if (lteM30.length){
    type = "spite"; // 意趣返し
    visitors = [ lteM30[Math.floor(Math.random()*lteM30.length)] ];
  } else if (lteM15.length){
    type = "mock";  // 冷笑
    visitors = [ lteM15[Math.floor(Math.random()*lteM15.length)] ];
  }

  // 会話なし
  if (type==="alone" || visitors.length===0){
    show(`${name} は休んでいる…`, false);
    modal.onclick = () => {
      modal.style.display = "none";
      // ★ 休み消化（クリア）
      pawn.userData.rest.active = false;
      nextTurn();
    };
    return;
  }

  // サーバー生成：見舞い/意趣返し/冷笑
  const likabilities = {};
  characters.forEach(ch => likabilities[ch] = like[ch]||0);

  socket.emit("requestRestEvent", {
    playername: name,
    visitors,             // ["ミユ","ナナ"] 等
    type,                 // "visit"|"spite"|"mock"
    reasonKey,            // "cold"|"lost"|"phone"|"soaked"
    reasonLabel,          // 例: "風邪をひいた"
    likabilities,         // 参照用
  });

  // 待機表示
  show(`様子を見に来ています…`, false);
}

/* ===== 休みイベント受信 ===== */
socket.off("restGenerated");
socket.on("restGenerated", (raw) => {
  try {
    const lines = Array.isArray(raw) ? raw : safeParseJSON(raw);
    if (!Array.isArray(lines) || !lines.length) throw new Error("invalid lines");
    playRestDialogue(lines, () => {
      // 終了時：休み消化
      if (currentPawn && currentPawn.userData && currentPawn.userData.rest){
        currentPawn.userData.rest.active = false;
      }
      nextTurn();
    });
  } catch (e) {
    console.error(e);
    modalBox.innerHTML = "休みイベントの取得に失敗しました。";
    const ok = document.createElement("button");
    ok.textContent = "OK";
    ok.onclick = () => {
      modal.style.display = "none";
      if (currentPawn && currentPawn.userData && currentPawn.userData.rest){
        currentPawn.userData.rest.active = false;
      }
      nextTurn();
    };
    modal.style.display = "flex";
    modalBox.appendChild(ok);
  }
});

/* ===== 台詞配列の再生（盆踊りと同形式） ===== */
function playRestDialogue(lines, onFinish){
  const charSet = new Set(["ミユ","シオン","ナナ"]);
  const bgUrl = yasumi_image;
/*https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjesnaOoawm-nfrRbhoGRCi7OYvD5PbklLyJfkm-OaZSTwaX7e6YwZ__GpugpG6kBPvyd_LwkRUwFnKasLMfete7Hq86UUt2cfb1JxJHWh6w4qWaNG31w4Pm0i7W1CI1sj4pb4ukqQxw731joBaA6MiZVGB4-QtuWwCNLg9ky2wtrFS9amdvjn27dV38cWP/s320/プレイヤーの部屋2.jpg*/
  let idx = 0;
  function step(){
    const { name, message } = lines[idx];
    const portraits = charSet.has(name) ? [{ name, mood: "positive" }] : [];
    renderEventLayer({
      bgUrl,
      portraits,
      speaker: name,
      message,
      choices: [],
      advanceOnTap: () => {
        idx++;
        if (idx < lines.length) step();
        else {
          hideEventLayer();
          onFinish && onFinish();
        }
      }
    });
  }
  step();
}


/* ======================================================
   ビジュアルノベル風 レイヤー描画
====================================================== */
function ensureDialogLayer() {
  let layer = document.getElementById("dialogLayer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "dialog-layer";
    layer.id = "dialogLayer";
    layer.innerHTML = `
      <div class="dialog-bg" id="dlgBg"></div>
      <div class="dialog-ui">
        <div class="dialog-portraits" id="dlgPortraits"></div>
        <!-- ▼▼▼ 順序を「テキスト → 選択肢」に変更 ▼▼▼ -->
        <div class="dialog-textbox">
          <div class="dialog-name" id="dlgName"></div>
          <div id="dlgText"></div>
        </div>
        <div class="dialog-choices" id="dlgChoices"></div>
        <!-- ▲▲▲ -->
      </div>
    `;
    document.body.appendChild(layer);
  }
  return {
    layer,
    bg: document.getElementById("dlgBg"),
    portraits: document.getElementById("dlgPortraits"),
    choices: document.getElementById("dlgChoices"),
    name: document.getElementById("dlgName"),
    text: document.getElementById("dlgText"),
  };
}

// テキストボックス直上に選択肢を配置する
function layoutDialogChoices(margin = 16) {
  const layer = document.getElementById("dialogLayer");
  const choices = document.getElementById("dlgChoices");
  const nameEl = document.getElementById("dlgName"); // .dialog-textbox 内
  const textbox = nameEl ? nameEl.parentElement : null; // .dialog-textbox

  if (!layer || !choices || !textbox || layer.style.display === "none") return;

  const layerRect = layer.getBoundingClientRect();
  const tbRect = textbox.getBoundingClientRect();

  // 非表示だと高さが測れないので、一瞬だけ見えない状態で測る
  const computedDisp = getComputedStyle(choices).display;
  const wasHidden = choices.style.display === "none" || computedDisp === "none";

  if (wasHidden) {
    choices.style.visibility = "hidden";
    choices.style.display = "grid";
  }

  const chRect = choices.getBoundingClientRect();
  let top = tbRect.top - chRect.height - margin;
  const minTop = layerRect.top + 8; // 画面最上部にくっつかないための余白
  if (top < minTop) top = minTop;

  choices.style.top = `${top}px`;
  choices.style.left = "50%";
  choices.style.transform = "translateX(-50%)";

  if (wasHidden) {
    choices.style.display = "none";
    choices.style.visibility = "";
  }
}

function hideEventLayer() {
  const layer = document.getElementById("dialogLayer");
  if (layer) layer.style.display = "none";
}

/* ===== ホワイトカット（白フェード） ===== */
let __cut;
function ensureWhiteCut() {
  if (__cut) return __cut;
  __cut = document.createElement("div");
  Object.assign(__cut.style, {
    position: "fixed",
    inset: "0",
    background: "#FDE8E9",
    color: "#111",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000, // 最前面
    opacity: 0,
    transition: "opacity 1s ease",
    textAlign: "center",
  });
  __cut.innerHTML = `
    <div id="cutInner" style="font-weight:900;font-size:20px;letter-spacing:.08em;white-space:pre-line"></div>
  `;
  document.body.appendChild(__cut);
  return __cut;
}

function whiteCut(text) {
  const cut = ensureWhiteCut();
  cut.querySelector("#cutInner").textContent = text;
  cut.style.display = "flex";
  requestAnimationFrame(() => (cut.style.opacity = "1"));
  return new Promise((resolve) => {
    const onTap = () => {
      cut.removeEventListener("click", onTap);
      cut.style.opacity = "0";
      setTimeout(() => {
        cut.style.display = "none";
        resolve();
      }, 250);
    };
    cut.addEventListener("click", onTap, { once: true });
  });
}

let __redCut;
function ensureRedCut() {
  if (__redCut) return __redCut;
  __redCut = document.createElement("div");
  Object.assign(__redCut.style, {
    position: "fixed",
    inset: "0",
    background: "#C62828",
    color: "#fff",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    opacity: 0,
    transition: "opacity 1s ease",
    textAlign: "center",
  });
  __redCut.innerHTML = `
    <div id="redCutInner" style="font-weight:900;font-size:20px;letter-spacing:.08em;white-space:pre-line"></div>
  `;
  document.body.appendChild(__redCut);
  return __redCut;
}

function redCut(text) {
  const cut = ensureRedCut();
  cut.querySelector("#redCutInner").textContent = text;
  cut.style.display = "flex";
  requestAnimationFrame(() => (cut.style.opacity = "1"));
  return new Promise((resolve) => {
    const onTap = () => {
      cut.removeEventListener("click", onTap);
      cut.style.opacity = "0";
      setTimeout(() => {
        cut.style.display = "none";
        resolve();
      }, 250);
    };
    cut.addEventListener("click", onTap, { once: true });
  });
}

function renderEventLayer({
  bgUrl,
  keepCurrentBg = false,
  portraits = [],
  speaker = "",
  message = "",
  choices = [],
  showChoicesOnTap = true, // ←★追加（デフォルト true）
  advanceOnTap = null, // 選択肢がないとき「どこでもタップで進む」
}) {
  if (modal) modal.style.display = "none";

  const ui = ensureDialogLayer();
  ui.layer.style.display = "block";

  // 背景
  if (bgUrl && !keepCurrentBg) {
    ui.bg.style.backgroundImage = `url(${bgUrl})`;
  }

  // 立ち絵
  ui.portraits.innerHTML = "";
  (portraits || []).forEach((p) => {
    const img = document.createElement("img");
    img.alt = p.name;
    img.src = getCharImg(p.name, p.mood || "neutral");
    ui.portraits.appendChild(img);
  });

  // セリフ
  ui.name.textContent = speaker || "";
  ui.text.innerText = message || "";

  // ★ ズレ防止のため、一旦 min-height をリセット
  ui.choices.style.minHeight = "";

  // 選択肢
  ui.choices.innerHTML = "";
  (choices || []).forEach((ch) => {
    const btn = document.createElement("button");
    btn.textContent = ch.text;
    btn.onclick = (e) => {
      e.stopPropagation();
      ch.onClick();
    };
    ui.choices.appendChild(btn);
  });

  // 表示制御
  if (choices.length) {
    ui.choices.style.display = showChoicesOnTap ? "none" : "grid";
  }

  // ★ 選択肢の高さを記録しておく（必要なら従来ロジック維持）
  if (choices && choices.length > 0) {
    requestAnimationFrame(() => {
      lastChoicesHeight = ui.choices.offsetHeight || lastChoicesHeight || 0;
      // すぐ表示する場合はここで位置決め
      if (!showChoicesOnTap) layoutDialogChoices(16);
    });
  } else {
    if (lastChoicesHeight > 0) {
      ui.choices.style.minHeight = `${lastChoicesHeight}px`;
    } else {
      ui.choices.style.minHeight = `96px`;
    }
  }

  // どこでもタップで進む／選択肢を出す
  ui.layer.onclick = null;

  if (choices.length && showChoicesOnTap) {
    // ① 1回目タップで選択肢を表示 → その瞬間に位置計算
    ui.layer.onclick = () => {
      ui.choices.style.display = "grid";
      layoutDialogChoices(16); // ← ここでテキストボックス直上に配置
      ui.layer.onclick = null; // 以降は通常のボタン処理だけ
    };
  } else if (!choices.length && typeof advanceOnTap === "function") {
    // ② 選択肢が無い画面は「タップで次へ」
    ui.layer.onclick = () => advanceOnTap();
  }

  // リサイズ時も再配置
  if (!window.__dlgChoicesResizeHooked) {
    window.addEventListener("resize", () => layoutDialogChoices(16));
    window.__dlgChoicesResizeHooked = true;
  }
}

function playFestivalDialogue(lines, pawn) {
  const playerName = pawn.userData.name;
  const charSet = new Set(characters); // ["ミユ","シオン","ナナ"]

  let idx = 0;
  const bgUrl = FESTIVAL_BG_FALLBACK;

  function showLine(i) {
    const { name, message } = lines[i];
    const isChar = charSet.has(name); // キャラの台詞？
    const isPlayer = name === playerName; // プレイヤーの台詞？

    // 表示する立ち絵：キャラのときだけ positive を1枚
    const portraits = isChar ? [{ name, mood: "positive" }] : [];

    renderEventLayer({
      bgUrl,
      portraits,
      speaker: name, // ← .dialog-name に話者名を出す
      message,
      choices: [], // 選択肢なし
      advanceOnTap: () => {
        // タップで次へ
        idx++;
        if (idx < lines.length) {
          showLine(idx);
        } else {
          hideEventLayer();
          playNextFestivalInQueue(); // 次のプレイヤーへ
        }
      },
    });
  }

  // 「◯◯と△△とのデート」タイトルを出してから開始
  const partners = Array.from(
    new Set(lines.map((l) => l.name).filter((n) => charSet.has(n))),
  );
  show(`${playerName}と${partners.join("・")}のデート\n\n`, false);
  const ok = document.createElement("button");
  ok.textContent = "はじめる";
  ok.onclick = () => {
    modal.style.display = "none";
    showLine(0);
  };
  modalBox.appendChild(ok);
}

function runFinalConfessionEvent() {
  show(
    [
      "🎇 夏休み、最後の夜 🎇",
      "",
      "長かったようで、あっという間だった夏休みも今日で終わり。",
      "日が暮れて、蝉の声も遠のいた静かな夜。",
      "それぞれの心に芽生えた想いが、そっと形になる時間。",
      "",
      "みんな同時に、告白したい相手を選んでください。",
    ].join("\n"),
    false,
  );

  // モーダルタップで選択UIへ
  modal.onclick = () => {
    modal.onclick = null;
    buildConfessionUI();
  };
}

let __lastSelections = null; // { [playername]: "ミユ|シオン|ナナ" }
let __lastConfessionResult = null; // { groups: ... } computeConfessionBonusesの返り
function buildPlayerTagBlocks() {
  const blocks = {};
  pawnsGlobal.forEach((pawn) => {
    if (!pawn?.userData?.name) return;
    blocks[pawn.userData.name] = buildPlayerTagBlock(pawn);
  });
  return blocks;
}
function buildConfessionUI() {
  // プレイヤーごとの選択状態
  const selections = new Map(); // name -> "ミユ"|"シオン"|"ナナ"

  modal.style.display = "flex";
  modal.onclick = null;

  // UI構築
  const wrap = document.createElement("div");
  wrap.style.whiteSpace = "pre-line";
  const title = document.createElement("div");
  title.style.fontSize = "1.1rem";
  title.style.marginBottom = ".6rem";
  title.textContent = "💌 告白する相手を選んでください（全員同時）";
  wrap.appendChild(title);

  const list = document.createElement("div");
  list.style.textAlign = "left";
  list.style.minWidth = "min(560px, 92vw)";
  list.style.margin = "0 auto";
  list.style.display = "grid";
  list.style.gap = ".6rem";

  // 行生成ヘルパ
  function makeRow(playerName) {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr auto auto auto";
    row.style.gap = ".4rem";
    const name = document.createElement("div");
    name.textContent = playerName;
    name.style.fontWeight = "800";
    name.style.alignSelf = "center";
    row.appendChild(name);

    const chars = ["ミユ", "シオン", "ナナ"];
    chars.forEach((ch) => {
      const btn = document.createElement("button");
      btn.textContent = ch;
      btn.style.padding = ".5rem 1rem";
      btn.style.border = "none";
      btn.style.borderRadius = "10px";
      btn.style.cursor = "pointer";
      btn.style.background = "#fff";
      btn.style.color = "#333";
      btn.style.fontWeight = "700";
      btn.style.boxShadow = "0 2px 8px rgba(0,0,0,.25)";
      btn.onclick = () => {
        // 行内のボタンの見た目をリセット
        Array.from(row.querySelectorAll("button")).forEach((b) => {
          b.style.background = "#fff";
          b.style.filter = "";
        });
        // 選択状態
        selections.set(playerName, ch);
        // 強調
        btn.style.background = "var(--accent)";
        btn.style.filter = "brightness(0.95)";
        // 全員選択済みなら決定ボタンを有効化
        updateConfirmBtnState();
      };
      row.appendChild(btn);
    });
    return row;
  }

  // 行を順番通りに並べる
  gameState.order.forEach((pname) => {
    list.appendChild(makeRow(pname));
  });
  wrap.appendChild(list);

  const confirm = document.createElement("button");
  confirm.textContent = "決定";
  confirm.style.marginTop = "1rem";
  confirm.style.padding = ".6rem 1.5rem";
  confirm.style.border = "none";
  confirm.style.borderRadius = "10px";
  confirm.style.background = "var(--accent)";
  confirm.style.color = "#333";
  confirm.style.fontWeight = "900";
  confirm.style.opacity = ".5";
  confirm.style.pointerEvents = "none";

  function updateConfirmBtnState() {
    const allChosen = gameState.order.every((n) => selections.has(n));
    confirm.style.opacity = allChosen ? "1" : ".5";
    confirm.style.pointerEvents = allChosen ? "auto" : "none";
  }

  confirm.onclick = () => {
    modal.style.display = "none";
    // ボーナス計算＋最終好感度を作ってサーバへ送る
    const payload = computeConfessionBonuses(selections); // {groups, accepted}
    payload.playerTagBlocks = buildPlayerTagBlocks();
    __lastConfessionResult = payload; // 後続（逆告白）でも使う
    __lastSelections = Object.fromEntries(selections);
    // 待機表示
    show("返事を待っています…", false);
    // サーバへ送信（生成依頼）
    socket.emit("requestEndingEvent", payload);
  };

  wrap.appendChild(confirm);

  modalBox.innerHTML = "";
  modalBox.appendChild(wrap);
  modal.style.display = "flex";
}

// selections: Map<playerName, "ミユ"|"シオン"|"ナナ">
function computeConfessionBonuses(selections) {
  // 1) キャラごとに告白者を束ねる
  const groups = { ミユ: [], シオン: [], ナナ: [] };
  const accepted = { ミユ: null, シオン: null, ナナ: null };

  gameState.order.forEach((pname) => {
    const target = selections.get(pname);
    const pawn = pawnsGlobal.find((p) => p.userData.name === pname);
    const steps =
      typeof pawn.userData.totalSteps === "number"
        ? pawn.userData.totalSteps
        : 0;
    const baseLike = pawn.userData.likability?.[target] ?? 0;
    groups[target].push({ playername: pname, pawn, steps, baseLike });
  });

  // 2) 同一ターゲット内で歩数トップの1人だけ +10（単独でも発動）
  const result = { groups: { ミユ: [], シオン: [], ナナ: [] } };
  stepBonusWinners.clear();
  ["ミユ", "シオン", "ナナ"].forEach((ch) => {
    const arr = groups[ch];
    if (!arr || !arr.length) return;
    // タイブレーク：歩数降順 → 名前昇順
    const sorted = [...arr].sort(
      (a, b) =>
        b.steps - a.steps || a.playername.localeCompare(b.playername, "ja"),
    );
    const top = sorted[0];
    arr.forEach((o) => {
      const bonus = o.playername === top.playername ? 10 : 0;
      const finalLike = o.baseLike + bonus;
      o.pawn.userData.likability[ch] = finalLike; // 反映
      result.groups[ch].push({
        playername: o.playername,
        steps: o.steps,
        bonus,
        baseLike: o.baseLike,
        finalLike,
      });
    });
    stepBonusWinners.add(top.playername); // HUD表示対象
  });

  // ★ここでOK相手を確定（>60 の中で finalLike 高い順 → 歩数 → 名前）
  ["ミユ", "シオン", "ナナ"].forEach((ch) => {
    const arr = result.groups[ch];
    if (!arr || !arr.length) return;
    const eligible = arr.filter((e) => (e.finalLike || 0) > 60);
    if (!eligible.length) {
      accepted[ch] = null;
      return;
    }
    eligible.sort(
      (a, b) =>
        b.finalLike - a.finalLike ||
        b.steps - a.steps ||
        a.playername.localeCompare(b.playername, "ja"),
    );
    accepted[ch] = eligible[0].playername;
  });
  updateStepsHUD(); // 画面に「歩数ボーナス」反映
  return { groups: result.groups, accepted };
}

socket.off("endingGenerated");
socket.on("endingGenerated", (raw) => {
  try {
    const lines = Array.isArray(raw) ? raw : safeParseJSON(raw);
    if (!Array.isArray(lines) || !lines.length)
      throw new Error("invalid lines");

    playEndingDialogue(lines);
  } catch (e) {
    console.error(e);
    modalBox.innerHTML = "エンディングの取得に失敗しました。";
    const ok = document.createElement("button");
    ok.textContent = "OK";
    ok.onclick = () => {
      modal.style.display = "none";
      // 失敗時も終了扱いにするなら下記を有効化
      gameState.endingDone = true;
    };
    modal.style.display = "flex";
    modalBox.appendChild(ok);
  }
});

socket.off("reverseConfessionGenerated");
socket.on("reverseConfessionGenerated", async (data) => {
  // リザルトを一時的に消す
  const ov = document.querySelector(".result-overlay");
  if (ov) ov.remove();

  const raw = Array.isArray(data) ? data : data && data.lines;
  const lines = (Array.isArray(raw) ? raw : []).filter(
    (l) => l && typeof l.message === "string" && l.message.trim(),
  );

  // セリフが無い場合でも流れだけは進める
  const proceed = () => {
    // 演出後はリザルトに戻る
    showResultsScreen();
    __playNextReverseOrFinish();
  };

  if (!lines.length) return proceed();

  await playReverseDialogue(lines, proceed); // ← 終了時に proceed 実行
});

//逆告白関連
async function playReverseDialogue(lines, onFinish) {
  const charSet = new Set(["ミユ", "シオン", "ナナ"]);
  const bgUrl = FESTIVAL_BG_FALLBACK;
  const charName = lines[0]?.name || __currentReverseCtx?.character || "???";
  const playerName = __currentReverseCtx?.playername || "";

  // ① サイド表示
  //await whiteCut(`side: ${charName}`);

  // ② 台詞本編
  //alert(1)
  await new Promise((resolve) => {
    let i = 0;
    (function step() {
      const { name, message } = lines[i];
      const portraits = charSet.has(name) ? [{ name, mood: "positive" }] : [];
      renderEventLayer({
        bgUrl,
        portraits,
        speaker: name,
        message,
        choices: [],
        advanceOnTap: () => {
          i++;
          if (i < lines.length) step();
          else {
            hideEventLayer();
            resolve();
          }
        },
      });
    })();
  });

  // ③ 結果表示（逆告白は成立前提の演出）
  await whiteCut(`${playerName}と${charName}はカップルになった！`);
  __extraCouples.push({ player: playerName, character: charName }); // ←追加
  onFinish && onFinish();
}




// 台詞配列を1キャラごとに分割（連続する name 単位）
function groupMonologuesByCharacter(lines) {
  const groups = [];
  let cur = null,
    bucket = [];
  for (const l of lines) {
    if (!cur || l.name !== cur) {
      if (bucket.length) groups.push({ name: cur, lines: bucket });
      cur = l.name;
      bucket = [];
    }
    bucket.push(l);
  }
  if (bucket.length) groups.push({ name: cur, lines: bucket });
  return groups;
}

// 1グループ（=1キャラ分）の台詞を順に表示して終わったら resolve
function playLinesSequence(lines) {
  return new Promise((resolve) => {
    const charSet = new Set(["ミユ", "シオン", "ナナ"]);
    const bgUrl = FESTIVAL_BG_FALLBACK;
    let i = 0;
    function step() {
      const { name, message } = lines[i];
      const portraits = charSet.has(name) ? [{ name, mood: "positive" }] : [];
      renderEventLayer({
        bgUrl,
        portraits,
        speaker: name,
        message,
        choices: [],
        advanceOnTap: () => {
          i++;
          if (i < lines.length) step();
          else {
            hideEventLayer();
            resolve();
          }
        },
      });
    }
    step();
  });
}

async function playEndingDialogue(lines) {
  const groups = groupMonologuesByCharacter(lines);

  for (const g of groups) {
    // ① サイド表示
    await whiteCut(`side: ${g.name}`);
    // ② 台詞本編
    await playLinesSequence(g.lines);
    // ③ 結果表示
    const winner = (__lastConfessionResult?.accepted || {})[g.name] || null;
    const resultText = winner
      ? `${winner}と${g.name}はカップルになった！`
      : "付き合えなかった…";
    await whiteCut(resultText);
  }

  // ④ 締め → 逆告白へ
  show(
    [
      "🎆 夏は、ここでおしまい。",
      "それでも、心に残る灯りはきっと消えない。",
      "",
      "ありがとう。また、どこかの夏で——",
    ].join("\n"),
    false,
  );
  const ok = document.createElement("button");
  ok.textContent = "OK";
  ok.onclick = () => {
    modal.style.display = "none";
    // 先にリザルトを出す
    showResultsScreen();
    // 逆告白の候補があればキュー化して即スタート
    buildReverseQueueIfAny();
    if (__reverseQueue && __reverseQueue.length) {
      __playNextReverseOrFinish();
    }
  };
  modalBox.appendChild(ok);
}

/* ▼ リザルト画面：スタイル注入（1回だけ） */
function ensureResultStyles() {
  if (document.getElementById("resultStyles")) return;
  const css = document.createElement("style");
  css.id = "resultStyles";
  css.textContent = `
  /* ===== Result (dark) ===== */
  .result-overlay{
    position:fixed; inset:0; z-index:10050; background:#070707f2;
    display:flex; align-items:center; justify-content:center;
  }
  .result-wrap{
    width:min(1100px, 98vw);
    height:min(96dvh, 1100px);
    background:#111; color:#eaeaea; border:1px solid #222; border-radius:14px;
    box-shadow:0 10px 40px rgba(0,0,0,.6);
    display:flex; flex-direction:column; overflow:hidden;
  }
  .result-header{
    padding:12px 16px; background:#0e0e0e; border-bottom:1px solid #222;
    display:flex; align-items:center; justify-content:space-between;
  }
  .result-title{ font-weight:900; letter-spacing:.04em; font-size:1.05rem }
  .result-body{ flex:1; overflow:auto; padding:12px; display:grid; gap:12px }

  /* couples + tabs */
  .couples{ padding:10px 12px; background:#141414; border:1px solid #222; border-radius:12px;
  max-height:18dvh;          /* ★ 追加：高さを 18dvh に制限 */
  overflow-y:auto;           /*        多いときはスクロール */ }
.tabs {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 12px 0;
}

.tabbtn {
  flex: 1;
  max-width: 100px;
  height: 40px; /* ← 高さ固定 */
  line-height: 40px; /* ← テキストを垂直中央に */
  background: #222;
  color: white;
  border: 1px solid #555;
  border-radius: 6px;
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  transition: background 0.3s;
}

.tabbtn.active {
  background: #444;
  border-color: #888;
}


  .char-section{
    display:none; /* 初期非表示（タブで表示） */
    background:#141414; border:1px solid #222; border-radius:12px; padding:12px;
    box-shadow:0 4px 14px rgba(0,0,0,.25);
  }
  .char-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px; flex-wrap:wrap }
  .char-name{ font-weight:900; font-size:1.05rem }
  .legend{ display:flex; gap:8px; flex-wrap:wrap; font-size:.85rem }
  .legend .dot{ width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:6px; vertical-align:middle; border:1px solid #0008 }

  .rank-table{ width:100%; border-collapse:collapse; margin-top:6px; font-size:.92rem }
  .rank-table th,.rank-table td{ padding:6px 8px; border-bottom:1px solid #222; text-align:left }
  .rank-table th{ background:#121212; position:sticky; top:0; z-index:1 }
  .rank-bar{ height:10px; border-radius:6px; background:#1d1d1d; overflow:hidden; position:relative }
  .rank-bar > i{ position:absolute; inset:0; transform-origin:left; background:currentColor; opacity:.9 }

  /* chart */
  .chart-wrap{ margin-top:10px; border:1px solid #222; border-radius:10px; background:#121212 }
  .chart-head{ padding:8px 10px; font-weight:800; border-bottom:1px solid #222; background:#0f0f0f }
  .chart-area{
    display:grid; grid-template-columns:64px 1fr; align-items:stretch;
  }
  .chart-y{
    position:sticky; left:0; top:0; z-index:2;
    background:#121212; border-right:1px solid #222;
    min-width:64px; height:100%;
  }
  .plot-scroll{
    overflow-x:auto; overflow-y:visible; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain;
  }
  .plot-scroll canvas{ display:block; max-width:none; background:#121212 }

  /* tooltip */
  .chart-tooltip{
    position:absolute; z-index:5; background:#111; color:#eee; padding:10px 12px; border-radius:12px;
    border:1px solid #222; box-shadow:0 12px 28px rgba(0,0,0,.55); max-width:min(520px, 86vw); font-size:.9rem;
  }
  .chart-tooltip .nav{ display:none; align-items:center; gap:8px; justify-content:flex-end; margin-bottom:6px }
  .chart-tooltip .navbtn{ background:#111; color:#eee; border:1px solid #333; border-radius:8px; padding:2px 8px; cursor:pointer }
  .chart-tooltip .idx{ font-weight:800; }
  .chart-tooltip .player{ font-weight:900; margin-bottom:4px }
  .chart-tooltip .msg{ margin:6px 0 4px; font-weight:800 }
  .chart-tooltip .opt{ border:1px solid #333; border-radius:8px; padding:6px 8px; background:#0f0f0f; margin-top:4px }
  .chart-tooltip .opt.picked{ border:2px solid #ffd54f }

  /* フッター */
  .footer-actions{ display:flex; justify-content:flex-end; gap:8px; padding:10px; border-top:1px solid #222; }
  .btn{ border:1px solid #333; border-radius:10px; padding:8px 14px; font-weight:900; cursor:pointer; color:#ddd; background:#141414 }
  .btn-primary{ background:var(--accent,#ffd166); color:#222; border-color:#ffd166 }
  .btn-ghost{ background:#111; }

  .result-overlay, .result-wrap, .result-body, .char-section{ overflow-x:hidden; }

  /* ===== toast (chart detail) ===== */
  .toast-scrim{
    position:fixed; inset:0; z-index:10100;
    background:rgba(0,0,0,.45);
    display:none;
  }
  .toast-scrim.show{ display:block; }

  .toast{
    position:fixed;
    left:50%;
    top:0;
    transform:translate(-50%,-110%);
    width:min(900px,94vw);
    background:#111;
    color:#eee;
    border:1px solid #222;
    border-radius:12px;
    box-shadow:0 20px 60px rgba(0,0,0,.6);
    padding:12px;
    z-index:10110;
    display:none;
  }

  .toast.show{
    display:block;
    animation:toastSlideIn .28s ease forwards;
  }
  .toast.hide{
    display:block;
    animation:toastSlideOut .22s ease forwards;
  }

  @keyframes toastSlideIn{
    from{ transform:translate(-50%,-110%); }
    to  { transform:translate(-50%, 2dvh); }
  }
  @keyframes toastSlideOut{
    from{ transform:translate(-50%, 2dvh); }
    to  { transform:translate(-50%,-110%); }
  }

  .toast .header{
    display:flex; align-items:center; justify-content:space-between; gap:8px;
    border-bottom:1px solid #222; padding:4px 2px 8px 2px; margin-bottom:8px;
    font-weight:900;
  }
  .toast .nav{
    display:none; /* 同点時のみJSでflexに */
    align-items:center; gap:8px;
  }
  .toast .navbtn{
    background:#111; color:#eee; border:1px solid #333; border-radius:8px; padding:4px 10px; cursor:pointer;
  }
  .toast .idx{ font-weight:800; }

  .toast .body{
    max-height:50dvh; overflow:auto;
    padding:4px 0;
  }
  .toast .player{ font-weight:900; margin-bottom:4px }
  .toast .msg{ margin:6px 0 4px; font-weight:800 }
  .toast .opt{ border:1px solid #333; border-radius:8px; padding:6px 8px; background:#0f0f0f; margin-top:4px }
  .toast .opt.picked{ border:2px solid #ffd54f }

  .toast .footer{
    display:flex; justify-content:flex-end; gap:8px; margin-top:10px; border-top:1px solid #222; padding-top:8px;
  }
  .toast .closebtn{
    border:1px solid #333; border-radius:10px; padding:8px 14px; font-weight:900; cursor:pointer; color:#ddd; background:#141414
  }

  /* トースト表示中は背後を操作不可に（スクロール＆クリック遮断） */
  .result-wrap.toast-lock{ pointer-events:none; }

  `;

  document.head.appendChild(css);
}

/* ▼ リザルト計算：プレイヤー×キャラごとの合計/ボーナス */
function buildResultsData() {
  const accepted =
    (__lastConfessionResult && __lastConfessionResult.accepted) || {};
  const pairByPlayer = {};
  Object.keys(accepted).forEach((ch) => {
    const p = accepted[ch];
    if (p) pairByPlayer[p] = ch;
  });

  const players = gameState.order.length
    ? [...gameState.order]
    : pawnsGlobal.map((p) => p.userData.name);

  // 総獲得：char -> [{player,total}]
  const perCharTotals = { ミユ: [], シオン: [], ナナ: [] };
  // 日別系列：char -> { player -> [{day, delta, logs:[...]}, ...] }
  const perCharDaily = { ミユ: {}, シオン: {}, ナナ: {} };

  const maxDay =
    gameLog.reduce((m, l) => Math.max(m, l.day || 1), finalDay || 1) || 1;

  ["ミユ", "シオン", "ナナ"].forEach((ch) => {
    players.forEach((name) => {
      // 日ごとの増減（選んだ方のみ）
      const daily = Array.from({ length: maxDay }, (_, i) => i + 1).map(
        (d) => {
          const logs = gameLog.filter(
            (l) => l.player === name && l.character === ch && l.day === d,
          );
          const delta = logs.reduce((s, l) => s + (l.pickedDelta || 0), 0);
          return { day: d, delta, logs };
        },
      );
      perCharDaily[ch][name] = daily;

      // 合計
      const total = daily.reduce((s, e) => s + e.delta, 0);
      perCharTotals[ch].push({ player: name, total });
    });

    // 降順ソート
    perCharTotals[ch].sort(
      (a, b) => b.total - a.total || a.player.localeCompare(b.player, "ja"),
    );
  });

  return { players, pairByPlayer, perCharTotals, perCharDaily, maxDay };
}

/* ▼ リザルト画面を表示 */
function showResultsScreen() {
  ensureResultStyles();
  const { players, pairByPlayer, perCharTotals, perCharDaily, maxDay } =
    buildResultsData();

  if (modal) modal.style.display = "none";
  hideEventLayer();

  const ov = document.createElement("div");
  ov.className = "result-overlay";
  ov.innerHTML = `
    <div class="result-wrap" id="resultWrap">
      <div class="result-header">
        <div class="result-title">🍉リザルト🍧</div>
      </div>
      <div class="result-body" id="resultBody"></div>
      <div class="footer-actions">
        <button class="btn btn-primary" id="btnPlayAgain">ホームに戻る</button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);
  const body = ov.querySelector("#resultBody");




  // --- トースト（共通・一個だけ） ---
  let __toastScrim = null, __toast = null;

  function ensureToast() {
    if (__toast) return;
    __toastScrim = document.createElement("div");
    __toastScrim.className = "toast-scrim";
    __toast = document.createElement("div");
    __toast.className = "toast";
    __toast.innerHTML = `
      <div class="header">
        <div class="title">詳細</div>
        <div class="nav">
          <button class="navbtn prev">◀</button>
          <span class="idx">1/1</span>
          <button class="navbtn next">▶</button>
        </div>
      </div>
      <div class="body"></div>
      <div class="footer">
        <button class="closebtn">閉じる</button>
      </div>
    `;
    document.body.appendChild(__toastScrim);
    document.body.appendChild(__toast);

    // 閉じる
    const close = __toast.querySelector(".closebtn");
    const doHide = () => hideToast();
    close.addEventListener("click", doHide);
    __toastScrim.addEventListener("click", doHide);
  }

  function showToastSetupLock(lock) {
    const wrap = document.getElementById("resultWrap");
    if (!wrap) return;
    if (lock) wrap.classList.add("toast-lock");
    else wrap.classList.remove("toast-lock");
  }

  function hideToast() {
    if (!__toast) return;
    // スライドアウト
    __toast.classList.remove("show");
    __toast.classList.add("hide");
    __toastScrim.classList.remove("show");
    showToastSetupLock(false);
    setTimeout(() => {
      if (__toast) __toast.style.display = "none";
      if (__toast) __toast.classList.remove("hide");
    }, 220);
  }

  // cluster: { day, list:[{player, logs:[]}, ...] }
  function showToastForCluster(cluster) {
    ensureToast();
    const nav = __toast.querySelector(".nav");
    const idxEl = __toast.querySelector(".idx");
    const bodyEl = __toast.querySelector(".body");

    let index = 0;

    function fmt(v){ return v >= 0 ? `+${v}` : `${v}`; }
    function render() {
      const item = cluster.list[index];
      let html = `<div class="player">${item.player}</div>`;
      const logs = item.logs || [];
      if (!logs.length) {
        html += `<div class="msg">この日は増減なし</div>`;
      } else {
        logs.forEach((l, i) => {
          html += `<div class="msg">${escapeHtml(l.message)}</div>`;
          html += `<div class="opt ${l.pickedIndex === 0 ? "picked" : ""}">
                      ${escapeHtml(l.pickedText)}　${fmt(l.pickedDelta || 0)}
                    </div>`;
           html += `<div class="opt ${l.pickedIndex === 1 ? "picked" : ""}">
                      ${escapeHtml(l.otherText)}　${fmt(l.otherDelta || 0)}
                    </div>`;
          if (i !== logs.length - 1) html += `<div style="height:6px"></div>`;
        });
      }
      bodyEl.innerHTML = html;
      idxEl.textContent = `${index + 1}/${cluster.list.length}`;
      // 同点（複数人）時のみナビ表示
      nav.style.display = cluster.list.length > 1 ? "flex" : "none";
    }

    // ナビ
    __toast.querySelector(".prev").onclick = () => {
      index = (index - 1 + cluster.list.length) % cluster.list.length;
      render();
    };
    __toast.querySelector(".next").onclick = () => {
      index = (index + 1) % cluster.list.length;
      render();
    };

    render();

    // スライドイン
    __toast.style.display = "block";
    __toast.classList.remove("hide");
    // 先にscrimを表示→本体をアニメーション
    __toastScrim.classList.add("show");
    requestAnimationFrame(() => {
      __toast.classList.add("show");
    });
    showToastSetupLock(true);
  }


  /* --- カップル一覧（告白成功 + 逆告白で成立分） --- */
  const couples = [];
  const accepted = (__lastConfessionResult && __lastConfessionResult.accepted) || {};
  Object.entries(accepted).forEach(([ch, p]) => {
    if (p) couples.push(`${p} × ${ch}`);
  });
  if (Array.isArray(__extraCouples)) {
    __extraCouples.forEach((e) => couples.push(`${e.player} × ${e.character}`));
  }
  const couplesBox = document.createElement("section");
  couplesBox.className = "couples";
  couplesBox.innerHTML = `<div style="font-weight:900;margin-bottom:6px;">💑 カップル</div>${
    couples.length ? couples.map((s) => `・${s}`).join("<br>") : "（まだ成立していません）"
  }`;
  body.appendChild(couplesBox);

  /* --- キャラ切り替えタブ（初期は未選択＝非表示） --- */
  const tabs = document.createElement("div");
  tabs.className = "tabs";
  ["ミユ", "シオン", "ナナ"].forEach((ch) => {
    const b = document.createElement("button");
    b.className = "tabbtn";
    b.textContent = ch;
    b.onclick = () => selectChar(ch);
    tabs.appendChild(b);
  });
  body.appendChild(tabs);

  /* --- キャラごとのセクション（最初は display:none） --- */
  const sections = {};
  ["ミユ", "シオン", "ナナ"].forEach((ch) => {
    const sec = renderCharSection(
      ch,
      players,
      perCharTotals,
      perCharDaily,
      maxDay
    );
    sec.id = `sec-${ch}`;
    sec.style.display = "none";
    body.appendChild(sec);
    sections[ch] = sec;
  });

  function selectChar(ch) {
    tabs.querySelectorAll(".tabbtn").forEach((b) =>
      b.classList.toggle("active", b.textContent === ch),
    );
    Object.entries(sections).forEach(
      ([key, el]) => (el.style.display = key === ch ? "block" : "none"),
    );
  }

  function renderCharSection(ch, players, perCharTotals, perCharDaily, maxDay) {
    const sec = document.createElement("section");
    sec.className = "char-section";

    // 見出し & 凡例
    const head = document.createElement("div");
    head.className = "char-head";
    head.innerHTML = `<div class="char-name">${ch}</div>`;
    const legend = document.createElement("div");
    legend.className = "legend";
    players.forEach((p) => {
      const col = playerColorMap[p] || "#888";
      const item = document.createElement("div");
      item.innerHTML = `<span class="dot" style="background:${col}"></span>${p}`;
      legend.appendChild(item);
    });
    head.appendChild(legend);
    sec.appendChild(head);

    // ランキング
    const tbl = document.createElement("table");
    tbl.className = "rank-table";
    tbl.innerHTML = `
      <thead><tr><th style="width:44px">#</th><th>プレイヤー</th><th style="width:90px">合計</th><th>比較バー</th></tr></thead>
      <tbody></tbody>`;
    const tbody = tbl.querySelector("tbody");
    const maxTotal = Math.max(1, ...perCharTotals[ch].map((r) => r.total));
    perCharTotals[ch].forEach((r, i) => {
      const tr = document.createElement("tr");
      const col = playerColorMap[r.player] || "#888";
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${r.player}</td>
        <td>${r.total >= 0 ? "+" + r.total : r.total}</td>
        <td>
          <div class="rank-bar" style="color:${col}">
            <i style="transform:scaleX(${(Math.max(0, r.total) / maxTotal) || 0})"></i>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
    sec.appendChild(tbl);

    // チャート（Y軸は左固定、右だけ横スクロール）
    const chartWrap = document.createElement("div");
    chartWrap.className = "chart-wrap";
    chartWrap.innerHTML = `
      <div class="chart-head">累計の推移（タップで詳細）</div>
      <div class="chart-area">
        <div class="chart-y"></div>
        <div class="plot-scroll"><canvas></canvas></div>
      </div>`;
    const canvas = chartWrap.querySelector("canvas");
    const yAxis = chartWrap.querySelector(".chart-y");
    const scroller = chartWrap.querySelector(".plot-scroll");
    scroller.style.position = "relative"; // ツールチップの基準

    const pxPerDay = 140;
    const height = 260; // 縦は隠れない
    const width = Math.max(scroller.clientWidth || 600, pxPerDay * (maxDay + 1));
    canvas.width = width;
    canvas.height = height;

    drawMultiLineChartForChar(canvas, yAxis, ch, players, perCharDaily, { maxDay });


    // ▼ キャンバスのクリック：トーストで詳細表示
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      const info = canvas.__hitTest && canvas.__hitTest(ox, oy);
      if (!info) return;

      // 名前昇順で安定化
      const sorted = [...info.cluster].sort((a, b) =>
        a.player.localeCompare(b.player, "ja"),
      );
      showToastForCluster({ day: info.day, list: sorted });
    });


    sec.appendChild(chartWrap);
    return sec;
  }

  // 複数ライン（プレイヤー）チャート描画：縦軸=累計（Y軸は別DOMに固定表示）
  function drawMultiLineChartForChar(
    canvas,
    yAxisEl,
    ch,
    players,
    perCharDaily,
    { maxDay },
  ) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width,
      H = canvas.height;

    // 余白（左はキャンバス内の目盛を描かないため小さめ）
    const L = 10,
      R = 24,
      T = 16,
      B = 30;

    // 累計系列を作成：{player -> [{day, val, logs}]}
    const series = {};
    let globalMin = 0,
      globalMax = 0;
    players.forEach((p) => {
      const daily = perCharDaily[ch][p] || [];
      let acc = 0;
      series[p] = daily.map((e) => {
        acc += e.delta || 0;
        globalMin = Math.min(globalMin, acc);
        globalMax = Math.max(globalMax, acc);
        return { day: e.day, val: acc, logs: e.logs || [] };
      });
    });
    if (globalMin === globalMax) {
      globalMin -= 5;
      globalMax += 5;
    }

    // スケール
    const xForDay = (d) =>
      L + ((W - L - R) * (d - 1)) / Math.max(1, maxDay - 1);
    const yForVal = (v) => {
      const h = H - T - B;
      return T + ((globalMax - v) * h) / Math.max(1, globalMax - globalMin);
    };

    // 背景
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, W, H);

    // グリッド（キャンバス） & Y軸ラベル（左固定DOM）
    ctx.strokeStyle = "#1f1f1f";
    ctx.lineWidth = 1;

    yAxisEl.innerHTML = "";
    yAxisEl.style.position = "sticky";
    yAxisEl.style.top = "0";
    yAxisEl.style.height = `${H}px`;
    for (let i = 0; i <= 4; i++) {
      const v = globalMin + ((globalMax - globalMin) * i) / 4;
      const y = yForVal(v);
      // grid
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      // label
      const lab = document.createElement("div");
      lab.textContent = String(Math.round(v));
      Object.assign(lab.style, {
        position: "absolute",
        left: "6px",
        top: `${y - 8}px`,
        fontSize: "12px",
        color: "#bdbdbd",
      });
      yAxisEl.appendChild(lab);
    }

    // X軸ラベル
    ctx.fillStyle = "#bdbdbd";
    ctx.font = "12px system-ui, sans-serif";
    function dayLabel(d) {
      if (d === festivalDay) return "盆踊り";
      if (d === finalDay) return "最終日";
      return d + "日目";
    }
    for (let d = 1; d <= maxDay; d++) {
      const x = xForDay(d);
      ctx.fillText(dayLabel(d), x - 18, H - 8);
    }

    // クリック判定用
    const clusters = new Map(); // `${day}::${val}` -> {x,y, items:[]}
    const hitDots = [];

    // 線＆点
    players.forEach((p) => {
      const col = playerColorMap[p] || "#888";
      const arr = series[p] || [];
      if (!arr.length) return;

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = col;
      arr.forEach((pt, idx) => {
        const x = xForDay(pt.day),
          y = yForVal(pt.val);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.fillStyle = col;
      arr.forEach((pt) => {
        const x = xForDay(pt.day),
          y = yForVal(pt.val);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        const key = `${pt.day}::${pt.val}`;
        if (!clusters.has(key)) clusters.set(key, { x, y, items: [] });
        clusters.get(key).items.push({ player: p, logs: pt.logs });

        hitDots.push({ x, y, r: 8, key });
      });
    });

    // クリック検出
    canvas.__hitTest = (ox, oy) => {
      let best = null,
        bestD = 9999;
      hitDots.forEach((pt) => {
        const d = Math.hypot(ox - pt.x, oy - pt.y);
        if (d < pt.r && d < bestD) {
          best = pt;
          bestD = d;
        }
      });
      if (!best) return null;
      const c = clusters.get(best.key);
      if (!c || !c.items.length) return null;
      const [dStr] = best.key.split("::");
      return { day: Number(dStr), cx: c.x, cy: c.y, cluster: c.items };
    };




    function drawMultiLineChartForChar(
      canvas,
      yAxisEl,
      ch,
      players,
      perCharDaily,
      { maxDay },
    ) {
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;

      // ←←← ここが“点のタップ判定半径”の調整箇所（必要に応じて数値を変更）
      const HIT_RADIUS = window.matchMedia("(pointer: coarse)").matches ? 16 : 8;

      // ...（略）...

      // クリック判定用コレクション
      const clusters = new Map(); // `${day}::${val}` -> {x,y, items:[]}
      const hitDots = [];

      // 点描画＆ヒット領域登録
      players.forEach((p) => {
        const col = playerColorMap[p] || "#888";
        const arr = series[p] || [];
        if (!arr.length) return;

        // 線（略）

        // 点
        ctx.fillStyle = col;
        arr.forEach((pt) => {
          const x = xForDay(pt.day), y = yForVal(pt.val);
          ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();

          const key = `${pt.day}::${pt.val}`;
          if (!clusters.has(key)) clusters.set(key, { x, y, items: [] });
          clusters.get(key).items.push({ player: p, logs: pt.logs });

          // ←←← ここで HIT_RADIUS を使っています
          hitDots.push({ x, y, r: HIT_RADIUS, key });
        });
      });

      // ヒットテスト
      canvas.__hitTest = (ox, oy) => {
        let best = null, bestD = 9999;
        hitDots.forEach((pt) => {
          const d = Math.hypot(ox - pt.x, oy - pt.y);
          if (d < pt.r && d < bestD){ best = pt; bestD = d; }
        });
        if (!best) return null;
        const c = clusters.get(best.key);
        if (!c || !c.items.length) return null;

        const [dStr] = best.key.split("::");
        return { day: Number(dStr), cx: c.x, cy: c.y, cluster: c.items };
      };
    }

  }

  /*ov.querySelector("#btnCloseResult").onclick = () => {
    document.body.removeChild(ov);
  };*/
  ov.querySelector("#btnPlayAgain").onclick = () => {
    location.reload();
  };
}


// 小ユーティリティ：XSS回避
function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

/* ---------- 補助：ボタン追加（旧モーダル用） ---------- */
function appendBtn(btn) {
  if ([...modalBox.children].some((el) => el.tagName === "BUTTON"))
    btn.style.marginLeft = ".6rem";
  modalBox.appendChild(btn);
}
