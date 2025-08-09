/* ================= Socket.io 接続 ================= */
const socket = io();

socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
  socket.emit("clientPing", "hello server");
});
socket.on("serverMessage", (msg) => console.log(msg));
socket.on("serverPong", (msg) => console.log(msg));

/* ======================================================
   画像アセット（背景＆立ち絵）
====================================================== */
// 背景（場所名 → URL）
const BG_IMAGES = {
  駅前: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhJ38nh4-nTvWmgBOe-QfLXBeDxQeXQsrZX7CITOuyRwEJBvF3uEwc6iL42RDX26VsHMbdkvTolCzjLgcQfpsvD1Cxrg3nguKHG9MuD7tCg98QmlaJOYt69Nke4CNXLa9Nu8Yev_TcpR5qYxoi1aVPD6ehDkb1VXacURyQIGxyDMdUh2Bn9jW2BkzuRs2a9/s900/IMG_1868.jpeg",
  カフェ:
    "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgLmJAlRLZ3_EvhjZswnUt7IvnnU79Qop3zg5ms8y6cuUQR51D5AeBU1aVdYwL_4RJhGGmE46fXaqFBvkvAwJUkXVFqFdpNSyVOq_BiIDTXymGwsb7Kb-XuFISxIGehdeZNX7LwJr3xXJiKKSOoiWKwF0pVrnW6GXc_EwJ0sMXii4WIuTSTQdRgXkCEWqVL/s739/IMG_1863.jpeg",
  商店街:
    "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiowP3iHAZcpNsRNTqVS8aHC4pHax8Y7yVlStqIt-FTVEuCo_wY_lQMxLixoeLxJNM33bZYPHBzgLfeikBkcqd1fuXJTULUsZlsNNZI8tH1TmzylkernvKV2pGqzQuJJckwmGo0uBR5vd-ipt0F76pnQ8_qO5nSLKU0zOqHVndza1-gkOU2P2hG4hvRcURq/s900/IMG_1864.jpeg",
  路地裏:
    "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhHmcd4O0jvDcW4P7y-JgGbLl_viGnGZLMcogi3UsVkcceusk5wy_j7HoVckJgC2T8yIZ-QFlzY5VPkTfuWwo6sLNCgD9LB4KAGzCRcsHNIy8iz7ge9HZy0tFjRjzOLifCQIJCpCS3u9IGSNaTv3UJY2WwHbxSUZm9SWH9WQL2hBhxDNNwMSN86kQS7qHHj/s679/IMG_1866.jpeg",
  神社: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjjFSDpzoOJIdhcWZXC13LMdZDZAmluiSp0KhUo3Klx2cDvv20BUvfBU_h3DE3BpfUBk51eGEb1sFi0QuBKAVs9v4ygEMDayETsl7kT8vBd2sugUYmQtoUU7-GC9YR5q_4ihObJ5v1FLBxwJJw9xhOlRc4T-nNP-L-1Hxp2TTixDcBW92U6EGjZUt05f9BZ/s900/IMG_1867.jpeg",
  図書館:
    "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgujLj2YmRahnGFvwmAzuvEUzwnQl6doy49FSnpr3P6eUgV3BqSSXlhRRNVpvrd2R8jG7yD_yCd3ABVTIAMZp9FIwWbKlFgCHIvStKM29rEmK551fa3AVliMQ7e-oFnpXvf1RZ8dREZ8yEAkjT1t3czBa8jo4jm1J_DYXENjJNHwNBGiUCEwwMbUbPXeC2f/s900/IMG_1869.jpeg",
  展望台:
    "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhG8WVB8_bj-jI5eUdiekCZkThmXNLt9zM8HUaxN5iRQBEBICSnbLCmVZECwiVygTF7Iev09TosOOT42tuxkKFtpuqwE-bBX4qFAVapN5DbXgO9huMonCSqoPIY7WmqzPwMTGw_0OYCvkoYQ4UsZWZKFn6rvS7kg08LfZc5GiMJTHgsu9plXndneZVSLd2s/s1024/A3E19760-0F52-4A8E-A653-F25BAE55321A.png",
  古民家:
    "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhBGOpq291vyfdRUJcsf-r90OjQRsYVFqLclmzofmWkiAMgmp7IosEcJjycLOLbuZojT-EKJQINoWE3dWLrYp-iLamFQL-7cPe-eP484KaEq7PQsE7Sdf1mXgevWNSk_to8QCEw5bsbYrQOCUIYrbxnItn0afan17X_-yLTDR61Ctd05WVY6Di-6Vgd68zL/s900/IMG_1871.jpeg",
  岩瀬: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEifp0iOPsblCE37Bh5VYw53BwqM6_X-0MggEKPr_5cZ2MQBl1G1PbpfUu5SPS2dmCkQnJV7A_fcydAIaVonC_X_xV4Q19JiVkMl7Zoq6wpS0aP4ghoXCoPfa5ssauB8NZXuVTdTtJg-l7-hAsAZD3vkeFLUb3pQ_hi9h4fG0Hk_DTocJQ9pjPt9-aFUIcwG/s1024/457E58AC-74C0-4BB1-97A7-7A85D1276474.png",
  ビーチ:
    "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjTZj0DkgeJPL12E3vkqwn71ZZt7qLWjsTkaU8KXlMlO4UoYN2qGRbZLLPEoDGvyfZgX6O1xg7lt4FVV5f1PDrXKwMSTf6tjYg8BPHjPMHRtMM63MKZcZaYJyClHfUNiYZsyT_e7vXNv_kuWlWbvSkllYe4vEMpzBlkIvQ0D-Vj2GA3ICYeiqAwncHH4r_2/s900/IMG_1873.jpeg",
  港: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiq56t_WN1dx2jkJB94wynQNrqrWrzuzycyHe19utHdj_4folrZE98mr8orSnZQQJKvwjnNoKsQ3ZLFz_em37coYvFdpUw5jANI0nostRaJGPvUsz5m36znZpr_pbczCeV3uqtYjTqGN9hPvOGSxaVGVXqRHDcC64I3TDo0s3SuF00ZGpF8FWHMQzyI4PZy/s1536/461ECD25-33DF-4EFD-8DD3-65FE8B425821.png",
  銭湯: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiKNYsyLvWE9OLmnZRkEyBKstfhPaNKlPq1h2vXQ5-siFmv4IXKhpfz0bjilVLYieXWCS0dCrLybD4_qofB4QEoRmJZKGrLTlgybTnjQsydzOFcVFenlPwT0yuDjQ-VRmhiEePuHxSOSFx57qZW1HKh7FOqtT0nkiww_8RE1cW0EU6zLNQZKbNRwXlzKW44/s900/IMG_1875.jpeg",
};
// 盆踊りは指定がないため神社背景を既定使用
const FESTIVAL_BG_FALLBACK = BG_IMAGES["神社"];

/* ========= 画像プリロード ========= */
const IMG_CACHE = new Map();

function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url || IMG_CACHE.has(url)) return resolve();
    const img = new Image();
    img.onload = () => {
      IMG_CACHE.set(url, img);
      resolve();
    };
    img.onerror = () => resolve(); // 失敗は無視
    img.src = url;
  });
}

function collectAllImageUrls() {
  const set = new Set();
  // 背景
  Object.values(BG_IMAGES).forEach((u) => set.add(u));
  // 立ち絵
  Object.values(CHAR_IMAGES).forEach((v) => {
    if (v.neutral) set.add(v.neutral);
    if (v.positive) set.add(v.positive);
    if (v.negative) set.add(v.negative);
  });
  return [...set];
}

async function preloadAllImages() {
  const urls = collectAllImageUrls();
  await Promise.all(urls.map(preloadImage));
  console.log(`🖼️ preloaded ${urls.length} images`);
}
// できるだけ早く温める
window.addEventListener("load", () => {
  preloadAllImages();
});

// 立ち絵（キャラ名 → {neutral,positive,negative}）
const CHAR_IMAGES = {
  ミユ: {
    neutral:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfhtMGsMdsW-a8Wultssz0pPQ91au9yRa9pon9URObB_gtUTLZv6HsCVOurlBii5nX4ab3FKSNtrCgiySFJRsG967FOq_EOJcGKzXuizlnORoT4vTRrMJNcABKy7VE7yZL0ePqJUq92IRdQV1XRw1bdQ6A5oZ4CmDkVEEBTolcfkNbgboGF_swoagMaiAx/s600/IMG_1840.png",
    positive:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgEuZiYvFfedcQ_S_LDkB83h6RaW8VWoyMVMsDgw1j01wjUCOxzkhJgOl8qzSN2lyGUqKrzJxMboAP1VMgUtJKj4JfcgfO71IwX7ofFb4HKIrZCmljxziGkVxZj1JrdFBLF_SicRdKZ7NVDnWHJd1fNO7ZYj_1hb1pkwH7z4UeI2ZVCEDUtae3bU7Qqo2LA/s600/IMG_1838.png",
    negative:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiOvZt77W7yy5T1nTagcygXDLTazAO_yvNAUE-VBg4Wbn9Ko8_GLiqtLJ8ljRzxnLwW_SmbSNnp-gwNtwAs_-MGgJUe4JysGRjoPPsQLCde4SILTncFUWyhr8-ZydpYmf0h4GumMXPij9JcWXTlrnLVA-tIS38Z13tGzTil1dWQJP3yrZhtADYPEv2rO-Qy/s600/IMG_1839.png",
  },
  シオン: {
    neutral:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjGEh6kyvWiD1ibr-Bu0H8Y_70Uwed4QYol7IHPeDm4FYIsEMgfKtrvo1rXw7-wHlybaDbXP5HVIxOiUC18C5uLfWps0KZnefepFYeoWeHt5EgsnZaT2XSvQaozW3diBoj9SmqJUaKuFmnI5lvujXFhxC0qX8eDv6h1lW2AWryXm8NoY51AbOTLaFpsIHJJ/s600/picrew_1753888317862674.png",
    positive:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjZL_iaBsKoZFIusK36VmehjNn2OAfs2FVspUY1aREbIlQjQQLBpWSpvdAILTOLDKI79B_p-WACILlEZLDW9JcsL-iqGMCQtg5Mg1RqRjFJ-iEVuwZ2JFimtjzVMLsTGfWwk0zoSI_D2qKqYXC4TCl5vqr9PcNJUVU45fwRBm4Y3yU3YcayPWOkMUL9h5_L/s600/picrew_1753889462028372.png",
    negative:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj1umP21mTMT6RXExE5BgMeAUOtTtpOfQdMCPog4Hu2m0HtTN8g6JfZWHggT8IOyIfOWsgoO6d7m38y9tFjoE8PcAckC_aLMA8a4JQ-7kWMu9FftZM-Vlmcw6ICxszoNm4INJroBq0l_z6b0Ifi6Kq7Y08PqLULO4jFEYDGocfUcG8MMr571QNcEjPZjyuP/s600/picrew_1753889803207882.png",
  },
  ナナ: {
    neutral:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjZWcyFzMqJN4mXusc-K2w-LMKYXBVCFO-l1TujCbG6EW-k4Zs8ipEyD5TQjucNQ7el2YKW6sIjOW8x4u99Yk0u8jIL_eEp0XMwhK7KXPx60ScFUm89Ai7uJ-UDifdrLvCOK-LaF-oOCizsOcDQA_Ao_K1ckpFIGOvEmwzImNPY6_mfkubPn6rMLyVErZUY/s600/picrew_1753887338233804.png",
    positive:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjqN1QHAHjZ8b2RFslaxgc-ywvq3IISjHehsS3OTuEDCMil5yJMs5kCKpffJXks8jneulyRsK9aOC09YYem3rsMg5sNwwS_ABiSVC2pqLZ7bYJfIuXedTtsj3D5H8h-qFPIwL74iTNyzRiMEr3ldJ2POP1zituIhSss5eWG1-9gwumdoI0fKATVOsBPd6pY/s600/picrew_1753887404693737.png",
    negative:
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhuFObSd3H3L2vUFA0YK_SLKHUHwo_p0ZUr7sV4oDAWFoxewddh555TqwcjRyeGqhltfVjnz71I3ye0nvIEgCc955Y8YoyoUet15yd6fazvac7iBGKD_mZLg2Oyjo4OXuquJKb9GKJsCMJmDQ9D4-W3kzNwgn0ZJD-L-GBHwTN-aTmtkJNAJR4kdeGqkH99/s600/picrew_1753887513783856.png",
  },
};

// 選択肢コンテナの直近高さを保持（ズレ防止用）
let lastChoicesHeight = 0;

// ▼ 追加（グローバル）：プレイヤー名 -> CSSカラー
let playerColorMap = {};

function getBgForPlace(name) {
  return BG_IMAGES[name] || FESTIVAL_BG_FALLBACK;
}
function getCharImg(name, mood = "neutral") {
  const def = CHAR_IMAGES[name];
  if (!def) return "";
  return def[mood] || def.neutral;
}

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
        }, 1000);
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
  renderEventLayer({
    keepCurrentBg: true,
    portraits: [{ name: characterName, mood }],
    speaker: characterName,
    message: choice.reaction || "……",
    choices: [],
    advanceOnTap: () => {
      hideEventLayer();
      nextTurn();
    },
  });
}

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
const MATCH_MIN_MS = 3000;

// 先読み計画: playerName -> { steps, destTile, place, character, requestId, startedAt }
const prefetchPlan = new Map();

// 先読み結果: requestId -> eventData(JSON)
const prefetchResult = new Map();

// マッチングUIで待っている最中の情報
let currentMatching = null;

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
function prefetchEventFor(playerName) {
  if (prefetchPlan.has(playerName)) return;

  const pawn = pawnsGlobal.find((p) => p.userData.name === playerName);
  if (!pawn) return;

  // 既に盆踊り／最終日が来る直前の人（＝次が日跨ぎ）への先読みは禁止
  const nextTurnIndex = (gameState.turn + 1) % gameState.order.length;
  const nextDay = nextTurnIndex === 0 ? gameState.day + 1 : gameState.day;
  if (playerName === gameState.order[nextTurnIndex]) {
    if (nextDay === festivalDay && !gameState.festivalDone) return; // 翌日が盆踊り
    if (nextDay === finalDay && !gameState.endingDone) return; // 翌日が最終日 ★追加
  }

  const steps = roll1d6(); // 固定ダイス
  const destTile = calcDestTile(pawn.userData.tile, steps);
  const tileId = destTile + 1;
  const place = placeFromTileId(tileId);
  const characterName = randomCharacter();
  const likability = pawn.userData.likability?.[characterName] || 0;

  const requestId = makeRequestId();
  prefetchPlan.set(playerName, {
    steps,
    destTile,
    place,
    character: characterName,
    requestId,
    startedAt: Date.now(),
  });

  // サーバに先読み発注（※ requestId を付けて返してもらう）
  socket.emit("requestEvent", {
    requestId,
    characterName,
    place: { name: place.name, detail: place.detail },
    likability,
    playername: playerName,
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

  prefetchEventFor(nextPlayer);
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
import * as THREE from "https://esm.sh/three@0.163.0";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "https://esm.sh/three@0.163.0/examples/jsm/renderers/CSS2DRenderer.js";

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
const festivalDay = 2;
const finalDay = 3;
let dayHUD;
let stepsHUD; // ★ 累計マス数用

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
    whiteSpace: "pre", // 改行そのまま表示
    fontWeight: "700",
    fontSize: "13px",
    letterSpacing: ".03em",
  });
  document.body.appendChild(stepsHUD);

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

function updateStepsHUD() {
  if (!stepsHUD) return;
  const names =
    gameState.order && gameState.order.length
      ? [...gameState.order]
      : pawnsGlobal.map((p) => p.userData.name);

  const lines = names.map((n) => {
    const pawn = pawnsGlobal.find((p) => p.userData.name === n);
    const steps =
      pawn && typeof pawn.userData.totalSteps === "number"
        ? pawn.userData.totalSteps
        : 0;
    const bonusMark = stepBonusWinners.has(n) ? "　歩数ボーナス！ +10♡" : "";
    return `${n}: ${steps}マス${bonusMark}`;
  });

  stepsHUD.textContent = lines.join("\n");
}

// ★ stepsHUD を dayHUD のすぐ下に固定配置する
function positionStepsHUD() {
  if (!dayHUD || !stepsHUD) return;
  const top = (dayHUD.offsetTop || 10) + dayHUD.offsetHeight + 6; // dayHUD の下に 6px 余白
  stepsHUD.style.top = `${top}px`;
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
  1: {
    name: "駅前",
    detail:
      "改札を抜けると、噴水のある小さなロータリーが広がる。夏の日差しに照らされ、人々の行き交いが見える。",
  },
  2: {
    name: "カフェ",
    detail:
      "ナナがアルバイト中のカフェ。静かな BGM とラテの香りが漂う、落ち着いた雰囲気。",
  },
  3: {
    name: "商店街",
    detail:
      "レトロなアーケードには雑貨屋、駄菓子屋、洋品店が並び、どこか懐かしい賑わい。",
  },
  4: {
    name: "路地裏",
    detail:
      "商店街の裏手にある細い道。野良猫がひなたで丸くなっている、静かな抜け道。",
  },
  5: {
    name: "神社",
    detail:
      "蝉の声に包まれた石段の上。風鈴がチリンと鳴り、縁結びのお守りが人気のスポット。",
  },
  6: {
    name: "図書館",
    detail:
      "坂道の途中にある町の小さな図書館。ひんやりとした空気と紙の匂いが漂っている。",
  },
  7: {
    name: "展望台",
    detail:
      "高台にある絶景スポット。潮風に吹かれながら、夕焼けが海を赤く染めてゆく。",
  },
  8: {
    name: "古民家",
    detail:
      "木造の古民家の縁側で風鈴が揺れる。静かに流れる時間と風が心地よい。",
  },
  9: {
    name: "岩瀬",
    detail:
      "岩場にできた天然の水たまり。小魚やヤドカリを覗きこむ子どもたちの声が響く。",
  },
  10: {
    name: "ビーチ",
    detail:
      "青い海と白い砂浜。波打ち際ではしゃぐ声が夏の空気に溶けていく。ミユが好きな場所。",
  },
  11: {
    name: "港",
    detail:
      "漁船が並ぶ埠頭。潮の香りと波の音が静かに響く、どこか物寂しい場所。",
  },
  12: {
    name: "銭湯",
    detail:
      "瓦屋根の昔ながらの銭湯。湯上がりのラムネと夕暮れが、どこか懐かしい気持ちにさせる。",
  },
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
};
let pawnsGlobal = [],
  tilesGlobal = [],
  tileInfoGlobal = {},
  placePawnGlobal = null;

// ▼ 追加：選択肢ログ（リザルト用）
const gameLog = []; // {player, day, place, character, message, pickedIndex, pickedText, pickedDelta, otherText, otherDelta, reaction}

// ▼ 追加（グローバル）
let __extraCouples = []; // { player, character }

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
  playerNamesGlobal = [...listElm.querySelectorAll("input")].map((i) =>
    i.value.trim(),
  );
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

  playerNames.slice(0, 6).forEach((name, i) => {
    const mesh = new THREE.Mesh(
      pawnGeo,
      new THREE.MeshStandardMaterial({ color: colors[i] }),
    );
    mesh.rotation.x = Math.PI;

    // ▼ 追加：駒カラーをCSS表記で保存（結果画面の線色に使う）
    const cssColor = "#" + colors[i].toString(16).padStart(6, "0");
    playerColorMap[name] = cssColor;

    if (name === "1") {
      mesh.userData = {
        type: "player",
        name,
        tile: 0,
        likability: { ミユ: 220, シオン: 220, ナナ: 220 }, // 好感度
      };
    } else if (name === "11") {
      mesh.userData = {
        type: "player",
        name,
        tile: 0,
        likability: { ミユ: 220, シオン: 220, ナナ: 220 }, // 好感度
      };
    } else {
      mesh.userData = {
        type: "player",
        name,
        tile: 0,
        likability: { ミユ: 0, シオン: 0, ナナ: 0 }, // 好感度
      };
    }

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
  const pawn = pawnsGlobal.find(
    (p) => p.userData.name === gameState.order[gameState.turn],
  );

  // 盆踊り当日なら先に祭りへ
  if (gameState.day === festivalDay) {
    if (!gameState.festivalDone) {
      currentPawn = pawn;
      cameraInstantLook();
      // 表示を毎ターン更新
      updateStepsHUD();
      runBonOdoriFestival();
      return;
    }
  }

  // ★ 最終日：通常イベントを止め、エンディング（夏祭りイベント）へ
  if (gameState.day === finalDay) {
    if (!gameState.endingDone) {
      currentPawn = pawn;
      cameraInstantLook();
      updateStepsHUD();
      runFinalConfessionEvent(); // ★ここへ
      return;
    }
  }

  currentPawn = pawn;
  cameraInstantLook();

  // 表示を毎ターン更新
  updateStepsHUD();

  // 次のプレイヤーを先読み
  prefetchNextPlayerFromCurrentTurn();

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
  const pawn = pawnsGlobal.find((p) => p.userData.name === name);
  currentPawn = pawn;

  // ★ 累計マス数をここで加算（未定義なら 0 から）
  if (typeof pawn.userData.totalSteps !== "number") {
    pawn.userData.totalSteps = 0;
  }
  pawn.userData.totalSteps += steps;

  // 表示も更新
  updateStepsHUD();

  let remaining = steps;
  (function step() {
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

/* ---------- マスイベント ---------- */
function resolveTileEvent(pawn) {
  /* ===== 1) 事前計画の有無確認 ===== */
  const plan = prefetchPlan.get(pawn.userData.name);
  let place, characterName, requestId;

  if (plan) {
    place = plan.place;
    characterName = plan.character;
    requestId = plan.requestId;
  } else {
    const tileId = pawn.userData.tile + 1;
    place = tileInfoGlobal[tileId];
    characterName = randomCharacter();
    requestId = makeRequestId();
  }

  /* --- 場所情報が無い場合はエラー --- */
  if (!place) {
    show(`⚠️ タイル ID の情報が存在しません`);
    modal.onclick = () => {
      modal.style.display = "none";
      nextTurn();
    };
    return;
  }

  /* ===== 2) プレイヤーの内部状態を更新 ===== */
  pawn.userData.meetingCharacter = characterName;
  pawn.userData.currentPlaceName = place.name;

  /* ===== 3) マッチング待機 UI を開始 ===== */
  currentMatching = {
    requestId,
    startedAt: Date.now(),
    player: pawn.userData.name,
  };

  modal.style.display = "flex";
  modal.onclick = null;

  const ROULETTE_MS = 150; // ← 切り替え速度を 150ms に統一
  rouletteIdx = 0;
  modalBox.innerHTML = [
    `📍 ${pawn.userData.name} は ${place.name} に着いた。`,
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
    const el = rouletteElm();
    const imgEl = rouletteImg();
    if (el) el.textContent = `${characters[rouletteIdx]}...`;
    if (imgEl) imgEl.src = getCharImg(characters[rouletteIdx]);
  }, ROULETTE_MS);

  /* ===== 4) 先読み済みなら “自家発火” で eventGenerated を呼ぶ ===== */
  const ready = prefetchResult.get(requestId);
  if (ready) {
    // ─ ここでは表示せず、handler 側に任せる ─
    eventGenerated({ requestId, data: ready });
  } else if (!plan) {
    /* ===== 5) サーバへ正式リクエスト（未先読み時のみ） ===== */
    socket.emit("requestEvent", {
      requestId,
      characterName,
      place: { name: place.name, detail: place.detail },
      likability: pawn.userData.likability[characterName] || 0,
      playername: pawn.userData.name,
    });
  }

  /* ===== 6) タイムアウト・フォールバック ===== */
  setTimeout(() => {
    if (
      currentMatching &&
      currentMatching.requestId === requestId &&
      rouletteTimer
    ) {
      clearInterval(rouletteTimer);
      rouletteTimer = null;
      modalBox.innerHTML = "通信が混み合っています。もう一度お試しください。";
      const ok = document.createElement("button");
      ok.textContent = "OK";
      ok.onclick = () => {
        modal.style.display = "none";
        nextTurn();
      };
      appendBtn(ok);
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
  const THRESHOLD = 300000000; // 最低好感度（必要に応じて調整）
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
    // 生成リクエスト
    socket.emit("requestFestivalEvent", {
      playername: pawn.userData.name,
      characters: chars,
      place: festivalPlace,
      likabilities,
    });

    modalBox.innerHTML = ""; // 前のボタンを消す
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
  alert(1)
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
        <button class="btn btn-primary" id="btnPlayAgain">もう一度あそぶ</button>
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
