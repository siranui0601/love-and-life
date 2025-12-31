// public/judgement-ai.js

let currentRoomId = null;
let currentHost = "";
let currentMembers = [];
let lastMembers = [];
let joinedOnce = false;

let gameState = null;            // 最新の publicGameView
let lastPhase = null;            // フェーズ変化検出用
let selectedSlotIds = new Set(); // 狩人がJUDGEで選ぶカード（確定までローカル保持）
let localTimerTick = null;

function mustLogin() {
  return !!(window.currentUser?.email && window.currentUser?.username);
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeStatusText(status) {
  let t = String(status || "");
  t = t.replace("ランダム可", "ランダム対戦許可");
  t = t.replace("ランダム不可", "ランダム対戦不許可");
  t = t.replace(/^状態[:;]\s*/g, "");
  return t;
}

function setMembers(listEl, members, opts = {}) {
  const { hostName = null, showKick = false, onKick = null } = opts;
  if (!listEl) return;
  listEl.innerHTML = "";

  (members || []).forEach((name) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = "8px";

    const label = document.createElement("span");
    label.textContent = name + (hostName && name === hostName ? "（ホスト）" : "");
    li.appendChild(label);

    if (showKick && hostName && name !== hostName) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "キック";
      btn.addEventListener("click", () => onKick && onKick(name));
      li.appendChild(btn);
    }

    listEl.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  // ---- DOM（1回だけ取得）
  const judgementTopActions = document.querySelector("#judgementAI .judgement-actions");
  const judgementTitle = document.querySelector("#judgementAI .menu-title");
  const waitingRoom = document.getElementById("waitingRoom");
  const gamePanel = document.getElementById("gamePanel");
  const btnBackToMenu = document.getElementById("btnBackToMenu");

  const btnRandom = document.getElementById("btnRandomMatch");
  const btnRoomMatch = document.getElementById("btnRoomMatch");
  const btnRules = document.getElementById("btnJudgementRules");

  const roomMatchPanel = document.getElementById("roomMatchPanel");
  const btnCreate = document.getElementById("btnRoomCreate");
  const btnJoin = document.getElementById("btnRoomJoin");

  const roomCreatePanel = document.getElementById("roomCreatePanel");
  const chkAllowRandom = document.getElementById("chkAllowRandom");
  const btnCreateConfirm = document.getElementById("btnRoomCreateConfirm");
  const createdRoomInfo = document.getElementById("createdRoomInfo");

  const roomJoinPanel = document.getElementById("roomJoinPanel");
  const roomIdInput = document.getElementById("roomIdInput");
  const btnJoinConfirm = document.getElementById("btnRoomJoinConfirm");
  const joinRoomInfo = document.getElementById("joinRoomInfo");

  const waitingRoomId = document.getElementById("waitingRoomId");
  const waitingStatusText = document.getElementById("waitingStatusText");

  const btnPlayWithMembers = document.getElementById("btnPlayWithMembers");
  const nonHostLockedPanel = document.getElementById("nonHostLockedPanel");
  const waitingMembersLocked = document.getElementById("waitingMembersLocked");

  const hostConfigPanel = document.getElementById("hostConfigPanel");
  const memberCountText = document.getElementById("memberCountText");
  const aiCountInput = document.getElementById("aiCountInput");
  const aiCountValue = document.getElementById("aiCountValue");
  const aiHintText = document.getElementById("aiHintText");
  const btnFinalStart = document.getElementById("btnFinalStart");
  const btnToggleRecruit = document.getElementById("btnToggleRecruit");

  const waitingMembersPanel = document.getElementById("waitingMembersPanel");
  const waitingMembers = document.getElementById("waitingMembers");

  // ---- game UI
  const gameTopic = document.getElementById("gameTopic");
  const gameMeta = document.getElementById("gameMeta");
  const gameTimer = document.getElementById("gameTimer");
  const gameArea = document.getElementById("gameArea");

  const answerPanel = document.getElementById("answerPanel");
  const answerInput = document.getElementById("answerInput");
  const btnSubmitAnswer = document.getElementById("btnSubmitAnswer");
  const answerCharCount = document.getElementById("answerCharCount");

  const judgePanel = document.getElementById("judgePanel");
  const picksRequiredEl = document.getElementById("picksRequired");
  const btnConfirmJudgement = document.getElementById("btnConfirmJudgement");

  const resultPanel = document.getElementById("resultPanel");
  const btnReadyNext = document.getElementById("btnReadyNext");
  const resultCountdown = document.getElementById("resultCountdown");





  // ====== Modal manager (ROLE / ANSWER / RESULT) ======
let roleModal = null;
let answerModal = null;
let resultModal = null;

function ensureModal(id) {
  let el = document.getElementById(id);
  if (el) return el;

  el = document.createElement("div");
  el.id = id;
  el.className = "jai-modal";
  el.innerHTML = `<div class="jai-modal-card"></div>`;
  document.body.appendChild(el);
  return el;
}

function showModal(el, html) {
  const card = el.querySelector(".jai-modal-card");
  card.innerHTML = html;
  el.classList.add("show");
}

function hideModal(el) {
  el.classList.remove("show");
}

function me() {
  return window.currentUser?.username || "";
}



  
  // ---- small helpers
  function toggleDisplay(el, displayWhenShown = "block") {
    if (!el) return;
    const isHidden = getComputedStyle(el).display === "none";
    el.style.display = isHidden ? displayWhenShown : "none";
  }

  // ---- phase overlay (INTRO/ROLE/BRIEF)
  let phaseOverlay = null;
  let phaseOverlayInner = null;

  function ensurePhaseOverlay() {
    if (phaseOverlay) return;
    if (!gamePanel) return;

    // gamePanelが absolute の基準になれるように
    if (!gamePanel.style.position) gamePanel.style.position = "relative";

    phaseOverlay = document.createElement("div");
    phaseOverlay.id = "phaseOverlay";
    phaseOverlay.style.position = "absolute";
    phaseOverlay.style.inset = "0";
    phaseOverlay.style.display = "none";
    phaseOverlay.style.alignItems = "center";
    phaseOverlay.style.justifyContent = "center";
    phaseOverlay.style.background = "rgba(0,0,0,0.55)";
    phaseOverlay.style.zIndex = "50";

    phaseOverlayInner = document.createElement("div");
    phaseOverlayInner.style.width = "min(720px, 92vw)";
    phaseOverlayInner.style.background = "rgba(20,20,20,0.92)";
    phaseOverlayInner.style.border = "1px solid #444";
    phaseOverlayInner.style.borderRadius = "12px";
    phaseOverlayInner.style.padding = "16px";
    phaseOverlayInner.style.lineHeight = "1.6";

    phaseOverlay.appendChild(phaseOverlayInner);
    gamePanel.appendChild(phaseOverlay);
  }

  function countReady(mapObj) {
    const m = mapObj && typeof mapObj === "object" ? mapObj : null;
    if (!m) return { ok: 0, total: 0 };
    const total = Object.keys(m).length;
    const ok = Object.values(m).filter((v) => v === true).length;
    return { ok, total };
  }

  function isHost() {
    return mustLogin() && me() === currentHost;
  }
  function isHunter(st) {
    return st?.hunter && st.hunter === me();
  }


  let autoOkTimers = { ROLE: null, BRIEF: null };

function clearAutoOkTimers() {
  if (autoOkTimers.ROLE) clearTimeout(autoOkTimers.ROLE);
  if (autoOkTimers.BRIEF) clearTimeout(autoOkTimers.BRIEF);
  autoOkTimers.ROLE = null;
  autoOkTimers.BRIEF = null;
}

function renderRoleOrBriefModal(st, socket) {
  // INTRO は即スキップ
  if (st.phase === "INTRO") {
    socket.emit("judgement:introOk", { roomId: currentRoomId });
    return;
  }

  const myName = me();

  // ROLE
  if (st.phase === "ROLE") {
    roleModal = roleModal || ensureModal("jaiRoleModal");

    const isMeHunter = (st?.hunter === myName);
    const pill = isMeHunter ? "断罪狩人" : "レジスタンス";
    const title = `あなたは <span class="jai-pill">${pill}</span> です`;

    const body = isMeHunter
      ? `目的：<b>人間（レジスタンス）</b>を見抜いて断罪し、的中数ぶん得点します。<br>
         操作：JUDGEで「断罪するカード」を必要数だけ選び、確定してください。`
      : `目的：<b>AIっぽい回答</b>で紛れ込み、狩人に見抜かれないようにします。<br>
         操作：ANSWERでお題に対し<b>120文字以内</b>で回答を入力して送信してください。`;

    const readyMap = st?.roleReady || null;
    const myReady = readyMap && myName ? readyMap[myName] === true : false;
    const ok = readyMap ? Object.values(readyMap).filter(v => v === true).length : 0;
    const total = readyMap ? Object.keys(readyMap).length : 0;

    showModal(roleModal, `
      <div class="jai-modal-head">
        <div>
          <div class="jai-modal-title">${title}</div>
          <div class="jai-modal-sub">${body}</div>
          <div class="jai-modal-sub" style="opacity:.75;margin-top:10px;">準備OK: ${ok}/${total}（30秒で自動進行）</div>
        </div>
        <button class="jai-modal-close" id="btnRoleClose" ${myReady ? "disabled" : ""}>
          ${myReady ? "OK済み" : "OK"}
        </button>
      </div>
    `);

    const btn = roleModal.querySelector("#btnRoleClose");
if (btn) {
  btn.onclick = () => socket.emit("judgement:roleOk", { roomId: currentRoomId });
}


    // 30秒自動OK（未OKのみ）
    clearAutoOkTimers();
    if (!myReady) {
      autoOkTimers.ROLE = setTimeout(() => {
        socket.emit("judgement:roleOk", { roomId: currentRoomId });
      }, 30000);
    }
    return;
  }

  // BRIEF（お題確認→30秒 or 全員閉じで ANSWERへ）
  if (st.phase === "BRIEF") {
    roleModal = roleModal || ensureModal("jaiRoleModal");

    const topic = st?.topic || "";
    const readyMap = st?.briefReady || null;
    const myReady = readyMap && myName ? readyMap[myName] === true : false;
    const ok = readyMap ? Object.values(readyMap).filter(v => v === true).length : 0;
    const total = readyMap ? Object.keys(readyMap).length : 0;

    showModal(roleModal, `
      <div class="jai-modal-head">
        <div>
          <div class="jai-modal-title">お題の確認</div>
          <div class="jai-answer-topic">【お題】${escapeHtml(topic)}</div>
          <div class="jai-modal-sub">レジスタンスはこのあと回答モーダルが開きます。120文字以内で入力してください。</div>
          <div class="jai-modal-sub" style="opacity:.75;margin-top:10px;">準備OK: ${ok}/${total}（30秒で自動進行）</div>
        </div>
        <button class="jai-modal-close" id="btnBriefClose" ${myReady ? "disabled" : ""}>
          ${myReady ? "OK済み" : "OK"}
        </button>
      </div>
    `);

    const btn2 = roleModal.querySelector("#btnBriefClose");
if (btn2) {
  btn2.onclick = () => socket.emit("judgement:roundOk", { roomId: currentRoomId });
}


    clearAutoOkTimers();
    if (!myReady) {
      autoOkTimers.BRIEF = setTimeout(() => {
        socket.emit("judgement:roundOk", { roomId: currentRoomId });
      }, 30000);
    }
    return;
  }

  // それ以外は閉じる
  if (roleModal) hideModal(roleModal);
}



  let draftAnswerText = "";     // ローカル下書き
let hasSubmittedAnswer = false;

function openAnswerModal(st, socket) {
  if (st.phase !== "ANSWER") return;
  if (st.hunter === me()) return; // 狩人は回答しない
  if (hasSubmittedAnswer) return; // 送信後は原則閉じたまま（再編集したいなら自己カードタップで開く）

  answerModal = answerModal || ensureModal("jaiAnswerModal");

  const topic = st?.topic || "";
  const now = Date.now();
  const remain = st.answerDeadlineAt ? Math.max(0, Math.ceil((st.answerDeadlineAt - now) / 1000)) : null;

  const current = draftAnswerText || "";
  showModal(answerModal, `
    <div class="jai-modal-head">
      <div>
        <div class="jai-modal-title">回答入力 <span class="jai-pill">120文字以内</span></div>
        <div class="jai-modal-sub">締切まで: <b>${remain ?? "-"}</b> 秒</div>
      </div>
      <button class="jai-modal-close" id="btnAnswerHide">閉じる</button>
    </div>

    <div class="jai-answer-topic">【お題】${escapeHtml(topic)}</div>

    <textarea class="jai-answer-textarea" id="jaiAnswerInput" maxlength="120"
      placeholder="AIっぽい回答を120文字以内で入力">${escapeHtml(current)}</textarea>

    <div class="jai-answer-foot">
      <div class="jai-charcount" id="jaiCharCount">${current.length}/120</div>
      <button class="jai-primary" id="jaiSubmitAnswer">送信</button>
    </div>

    <div class="jai-modal-sub" style="opacity:.8;margin-top:10px;">
      送信後も、あなたのカードをタップすれば締切まで再編集できます。
    </div>
  `);

  const ta = answerModal.querySelector("#jaiAnswerInput");
  const cc = answerModal.querySelector("#jaiCharCount");
  const btnHide = answerModal.querySelector("#btnAnswerHide");
  const btnSend = answerModal.querySelector("#jaiSubmitAnswer");

  const sync = () => {
    const t = String(ta.value || "");
    draftAnswerText = t;
    cc.textContent = `${t.length}/120`;
    btnSend.disabled = (t.trim().length === 0);
  };
  ta.addEventListener("input", sync);
  sync();

  btnHide.addEventListener("click", () => hideModal(answerModal));

  btnSend.addEventListener("click", () => {
    const text = String(ta.value || "").trim();
    if (!text) return alert("回答が空です");
    if (text.length > 120) return alert("120文字以内にしてください");
    if (st.answerDeadlineAt && Date.now() > st.answerDeadlineAt) return alert("締切を過ぎています");

    hasSubmittedAnswer = true;       // 連打防止
    socket.emit("judgement:submitAnswer", { roomId: currentRoomId, username: me(), text });
    hideModal(answerModal);
  });
}

function reopenAnswerModalIfPossible(st, socket) {
  // 自己カードタップから呼ぶ
  if (st.phase !== "ANSWER") return;
  if (st.hunter === me()) return;
  if (st.answerDeadlineAt && Date.now() > st.answerDeadlineAt) return;
  // 再編集を許可するので、送信済みでもOK（送るのは上書き扱いにしたいならサーバも対応が必要）
  hasSubmittedAnswer = false;
  openAnswerModal(st, socket);
}


  let hasSubmittedJudge = false;

function renderCards(st, socket) {
  if (!gameArea) return;
  const cards = Array.isArray(st.cards) ? st.cards : [];

  const isMeHunter = (st.hunter === me());
  const selectable = (st.phase === "JUDGE" && isMeHunter && !hasSubmittedJudge);

  // RESULT用（サーバが持っていれば使う：無ければ何もしない）
  const picked = new Set((st?.result?.pickedSlotIds || st?.pickedSlotIds || []).map(String));
  const hit = new Set((st?.result?.hitSlotIds || []).map(String));
  const miss = new Set((st?.result?.missSlotIds || []).map(String));

  gameArea.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "judge-cards";

  cards.forEach((c) => {
    const slotId = String(c.slotId);

    // ---- 自分判定：サーバが name を隠すなら、少なくとも slotId 側で self フラグが欲しい。
    // ここは「nameが自分と一致」または「c.isSelf」などがある想定で両対応にしておく。
    const isSelf = (c.isSelf === true) || (c.name && c.name === me()) || (c.username && c.username === me());

    // 表示名：自分だけ見える。他人は伏せる（ゲーム性）
    const displayName = isSelf ? (me() || "YOU") : (st.phase === "RESULT" || st.phase === "GAME_OVER" ? (c.name || "???") : "???");

    // 回答表示：自分だけ見える（常時）。他人は RESULT 以降は見える
    const displayAnswer = isSelf
      ? (c.answer || "(未回答)")
      : ((st.phase === "RESULT" || st.phase === "JUDGE" || st.phase === "GAME_OVER")
          ? (c.answer || "(未回答)")
          : "???");

    const card = document.createElement("div");
    card.className = "judge-card";
    if (selectable || (st.phase === "ANSWER" && isSelf)) card.classList.add("tapable");
    if (isSelf) card.classList.add("self");
    if (selectedSlotIds.has(slotId)) card.classList.add("selected");

    // RESULTのエフェクト
    if (picked.has(slotId)) card.classList.add("picked");
    if (hit.has(slotId)) card.classList.add("hit");
    if (miss.has(slotId)) card.classList.add("miss");

    card.dataset.slotId = slotId;

    const img = document.createElement("img");
    img.src = c.avatar;
    img.alt = "avatar";

    const ans = document.createElement("div");
    ans.className = "answer";
    ans.textContent = displayAnswer;

    const nm = document.createElement("div");
    nm.className = "name";
    nm.textContent = displayName;

    card.appendChild(img);
    card.appendChild(ans);
    card.appendChild(nm);

    // --- click behavior
    card.addEventListener("click", () => {
      // 自分のカード → 回答モーダル再開（ANSWER中のみ）
      if (st.phase === "ANSWER" && isSelf && !isMeHunter) {
        reopenAnswerModalIfPossible(st, socket);
        return;
      }

      // 狩人の選択
      if (selectable) {
        const need = Number(st.picksRequired || 0);
        if (selectedSlotIds.has(slotId)) selectedSlotIds.delete(slotId);
        else {
          if (selectedSlotIds.size >= need) return;
          selectedSlotIds.add(slotId);
        }
        renderCards(st, socket);
        renderJudgePanel(st, socket);
      }
    });

    wrap.appendChild(card);
  });

  gameArea.appendChild(wrap);
}

  function openResultModal(st, socket) {
  if (st.phase !== "RESULT") return;

  resultModal = resultModal || ensureModal("jaiResultModal");

  const now = Date.now();
  const sec = st.resultDeadlineAt ? Math.max(0, Math.ceil((st.resultDeadlineAt - now) / 1000)) : null;

  // サーバが持ってる情報に合わせて表示（無ければ “ランキングのみ” でも可）
  const ranking =
  Array.isArray(st.ranking) ? st.ranking :
  (st.scoreMap && typeof st.scoreMap === "object")
    ? Object.entries(st.scoreMap)
        .map(([name, points]) => ({ name, points: Number(points || 0) }))
        .sort((a,b) => b.points - a.points)
    : [];

  const deltas = st?.result?.deltas || st?.deltas || null; // あるなら使う

  const deltaHtml = Array.isArray(deltas)
    ? `<div class="jai-modal-sub" style="margin-top:10px;">
         <b>今回の得点</b><br>
         ${deltas.map(d => `${escapeHtml(d.name)} : ${d.delta >= 0 ? "+" : ""}${d.delta}`).join("<br>")}
       </div>`
    : "";

  const rankHtml = ranking.length
    ? `<div class="jai-modal-sub" style="margin-top:12px;">
         <b>現在ランキング</b><br>
         ${ranking.map((r,i) => `${i+1}位 ${escapeHtml(r.name)} : ${r.points}点`).join("<br>")}
       </div>`
    : `<div class="jai-modal-sub" style="margin-top:12px;opacity:.85;">ランキング情報が未取得です</div>`;

  showModal(resultModal, `
    <div class="jai-modal-head">
      <div>
        <div class="jai-modal-title">ラウンド結果</div>
        <div class="jai-modal-sub">次ラウンドまで: <b>${sec ?? "-"}</b> 秒（全員が閉じると即開始）</div>
      </div>
      <button class="jai-modal-close" id="btnResultClose">閉じる</button>
    </div>
    ${deltaHtml}
    ${rankHtml}
  `);

  resultModal.querySelector("#btnResultClose")?.addEventListener("click", () => {
    hideModal(resultModal);
    socket.emit("judgement:resultReady", { roomId: currentRoomId, username: me() });
  });

  // 時間でも自動 close（= resultReady）したいなら
  // ※サーバが既に deadline で進むなら “閉じる” は任意。ここは好み。
  if (sec != null && sec <= 1) {
    hideModal(resultModal);
  }
}

  /*
  function renderPhaseOverlay(st) {
    ensurePhaseOverlay();
    if (!phaseOverlay || !phaseOverlayInner) return;

    const phase = st?.phase || "";
    const myName = me();

    // INTRO
    if (phase === "INTRO") {
      const title = st?.intro?.title || "断罪AI";
      const text = st?.intro?.text || "";
      const readyMap = st?.introReady || null;
      const myReady = readyMap && myName ? readyMap[myName] === true : false;
      const { ok, total } = countReady(readyMap);

      phaseOverlay.style.display = "flex";
      phaseOverlayInner.innerHTML = `
        <div style="font-size:18px; font-weight:700; margin-bottom:10px;">${escapeHtml(title)}</div>
        <div style="opacity:0.95; white-space:pre-wrap; margin-bottom:12px;">${escapeHtml(text)}</div>
        <div style="opacity:0.75; margin-bottom:12px;">準備OK: ${ok}/${total}</div>
        <button id="btnIntroOk" type="button" ${myReady ? "disabled" : ""} style="width:100%; padding:10px; border-radius:10px;">
          ${myReady ? "OK済み（他プレイヤー待ち）" : "次へ（OK）"}
        </button>
      `;

      phaseOverlayInner.querySelector("#btnIntroOk")?.addEventListener("click", () => {
        socket.emit("judgement:introOk", { roomId: currentRoomId });
      });
      return;
    }

    // ROLE
    if (phase === "ROLE") {
      const isMeHunter = isHunter(st);
      const roleText = isMeHunter ? "あなたは断罪狩人です" : "あなたはレジスタントです";
      const subText = isMeHunter
        ? "回答を見て、人間（レジスタント）を断罪してください。"
        : "AIっぽい回答をして、狩人の断罪を回避してください。";

      const readyMap = st?.roleReady || null;
      const myReady = readyMap && myName ? readyMap[myName] === true : false;
      const { ok, total } = countReady(readyMap);

      phaseOverlay.style.display = "flex";
      phaseOverlayInner.innerHTML = `
        <div style="font-size:18px; font-weight:700; margin-bottom:10px;">職業の通知</div>
        <div style="font-size:16px; margin-bottom:6px;">${escapeHtml(roleText)}</div>
        <div style="opacity:0.9; margin-bottom:12px;">${escapeHtml(subText)}</div>
        <div style="opacity:0.75; margin-bottom:12px;">準備OK: ${ok}/${total}</div>
        <button id="btnRoleOk" type="button" ${myReady ? "disabled" : ""} style="width:100%; padding:10px; border-radius:10px;">
          ${myReady ? "OK済み（他プレイヤー待ち）" : "OK（次へ）"}
        </button>
      `;
      phaseOverlayInner.querySelector("#btnRoleOk")?.addEventListener("click", () => {
        socket.emit("judgement:roleOk", { roomId: currentRoomId });
      });
      return;
    }

    // BRIEF（お題表示＋回答開始前）
    if (phase === "BRIEF") {
      const topic = st?.topic || "";
      const readyMap = st?.briefReady || null;
      const myReady = readyMap && myName ? readyMap[myName] === true : false;
      const { ok, total } = countReady(readyMap);

      phaseOverlay.style.display = "flex";
      phaseOverlayInner.innerHTML = `
        <div style="font-size:18px; font-weight:700; margin-bottom:10px;">お題の確認</div>
        <div style="opacity:0.95; margin-bottom:12px;">【お題】${escapeHtml(topic)}</div>
        <div style="opacity:0.9; margin-bottom:12px;">レジスタントは120文字以内で回答を入力してください。全員がOKで回答フェーズが開始します。</div>
        <div style="opacity:0.75; margin-bottom:12px;">準備OK: ${ok}/${total}</div>
        <button id="btnBriefOk" type="button" ${myReady ? "disabled" : ""} style="width:100%; padding:10px; border-radius:10px;">
          ${myReady ? "OK済み（他プレイヤー待ち）" : "OK（回答開始）"}
        </button>
      `;
      phaseOverlayInner.querySelector("#btnBriefOk")?.addEventListener("click", () => {
        socket.emit("judgement:roundOk", { roomId: currentRoomId });
      });
      return;
    }

    // それ以外は非表示
    phaseOverlay.style.display = "none";
  }*/

  // ---- auth
  function sendAuthIfPossible() {
    if (!mustLogin()) return;
    socket.emit("judgement:auth", {
      username: window.currentUser.username,
      email: window.currentUser.email, // サーバが使わなくてもOK
    });
  }

  socket.on("connect", sendAuthIfPossible); // 再接続にも強い
  sendAuthIfPossible();
  window.addEventListener("user:login", sendAuthIfPossible);

  // ---- UI切替
  function showTop() {
    if (currentRoomId) socket.emit("judgement:unwatch", { roomId: currentRoomId });

    currentRoomId = null;
    currentHost = "";
    currentMembers = [];
    lastMembers = [];
    joinedOnce = false;

    gameState = null;
    lastPhase = null;
    selectedSlotIds.clear();
    stopLocalTimer();

    hasSubmittedAnswer = false;
    hasSubmittedJudge = false;
    if (answerInput) answerInput.value = "";
    if (answerCharCount) answerCharCount.textContent = "0/120";

    if (gamePanel) gamePanel.style.display = "none";
    if (waitingRoom) waitingRoom.style.display = "none";
    if (roomMatchPanel) roomMatchPanel.style.display = "none";
    if (roomCreatePanel) roomCreatePanel.style.display = "none";
    if (roomJoinPanel) roomJoinPanel.style.display = "none";
    if (createdRoomInfo) createdRoomInfo.textContent = "";
    if (joinRoomInfo) joinRoomInfo.textContent = "";

    if (judgementTitle) judgementTitle.style.display = "block";
    if (judgementTopActions) judgementTopActions.style.display = "flex";
    if (btnBackToMenu) btnBackToMenu.style.display = "none";
  }

  function openWaiting(roomId) {
    currentRoomId = roomId;
    joinedOnce = true;

    if (judgementTopActions) judgementTopActions.style.display = "none";
    if (roomMatchPanel) roomMatchPanel.style.display = "none";
    if (roomCreatePanel) roomCreatePanel.style.display = "none";
    if (roomJoinPanel) roomJoinPanel.style.display = "none";
    if (createdRoomInfo) createdRoomInfo.textContent = "";
    if (joinRoomInfo) joinRoomInfo.textContent = "";

    if (waitingRoomId) waitingRoomId.textContent = roomId;
    if (waitingRoom) waitingRoom.style.display = "block";
    if (btnBackToMenu) btnBackToMenu.style.display = "block";

    socket.emit("judgement:watch", { roomId });
  }

  function openGame() {
    if (judgementTitle) judgementTitle.style.display = "none";
    if (judgementTopActions) judgementTopActions.style.display = "none";
    if (waitingRoom) waitingRoom.style.display = "none";
    if (gamePanel) gamePanel.style.display = "block";
    if (btnBackToMenu) btnBackToMenu.style.display = "block";
  }

  function stopLocalTimer() {
    if (localTimerTick) clearInterval(localTimerTick);
    localTimerTick = null;
  }
  function startLocalTimer() {
    stopLocalTimer();
    localTimerTick = setInterval(() => {
      if (!gameState) return;
      renderTopBar(gameState);
      renderResultCountdown(gameState);
    }, 250);
  }

  // ---- waiting state描画
  function updateAIHints(membersCount) {
    const count = Number(membersCount || 0);
    const min = 1;
    const max = Math.max(1, count * 3);
    const rec = Math.max(1, count * 2);

    if (aiCountInput) {
      aiCountInput.min = String(min);
      aiCountInput.max = String(max);

      const v = Number(aiCountInput.value || 0);
      if (!Number.isFinite(v) || v < min) aiCountInput.value = String(rec);
      if (v > max) aiCountInput.value = String(max);
    }

    if (aiCountValue && aiCountInput) aiCountValue.textContent = String(aiCountInput.value);
    if (aiHintText) aiHintText.textContent = `設定可能: ${min}〜${max}（おすすめ: ${rec}）`;
  }

  function applyState(state) {
    currentHost = String(state.hostName || "");
    currentMembers = Array.isArray(state.members) ? state.members : [];

    // ---- キック検知
    const myName = me();
    const iWasIn = lastMembers.includes(myName);
    const iAmIn = currentMembers.includes(myName);

    if (joinedOnce && myName && iWasIn && !iAmIn) {
      alert("このルームからキックされました。");
      showTop();
      return;
    }
    const kicked = Array.isArray(state.kicked) ? state.kicked : null;
    if (joinedOnce && myName && kicked && kicked.includes(myName)) {
      alert("このルームからキックされました。");
      showTop();
      return;
    }
    lastMembers = currentMembers.slice();

    if (waitingStatusText) waitingStatusText.textContent = normalizeStatusText(state.status);

    const locked = String(state.status || "").includes("/募集停止");
    if (btnPlayWithMembers) {
      btnPlayWithMembers.style.display = isHost() && !locked ? "inline-block" : "none";
    }

    setMembers(waitingMembers, currentMembers, {
      hostName: currentHost,
      showKick: isHost() && !locked,
      onKick: async (targetName) => {
        try {
          await postJSON("/api/judgement/room/kick", {
            roomId: currentRoomId,
            hostName: me(),
            targetName,
          });
        } catch (e) {
          alert(`キックに失敗: ${e.message}`);
        }
      },
    });

    if (locked) {
      if (isHost()) {
        if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";
        if (hostConfigPanel) hostConfigPanel.style.display = "block";
        if (waitingMembersPanel) waitingMembersPanel.style.display = "none";
        if (memberCountText) memberCountText.textContent = `参加人数: ${currentMembers.length}人`;
        updateAIHints(currentMembers.length);
      } else {
        if (hostConfigPanel) hostConfigPanel.style.display = "none";
        if (nonHostLockedPanel) nonHostLockedPanel.style.display = "block";
        if (waitingMembersPanel) waitingMembersPanel.style.display = "none";
        setMembers(waitingMembersLocked, currentMembers, { hostName: currentHost });
      }
    } else {
      if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";
      if (hostConfigPanel) hostConfigPanel.style.display = "none";
      if (waitingMembersPanel) waitingMembersPanel.style.display = "block";
    }
  }

  // ---- game描画
  function renderTopBar(st) {
    if (gameTopic) gameTopic.textContent = st.topic ? `【お題】${st.topic}` : "";
    if (gameMeta) {
      const total = st.cards?.length || 0;
      const req = st.picksRequired ?? "-";
      gameMeta.textContent =
        `フェーズ: ${st.phase} / ラウンド: ${st.roundIndex} / 狩人: ${st.hunter} / カード: ${total}（断罪必要数: ${req}）`;
    }

    const now = Date.now();
    let line = "";
    if (st.phase === "ANSWER" && st.answerDeadlineAt) {
      const sec = Math.max(0, Math.ceil((st.answerDeadlineAt - now) / 1000));
      line = `回答締切まで: ${sec}s`;
    } else if (st.phase === "RESULT" && st.resultDeadlineAt) {
      const sec = Math.max(0, Math.ceil((st.resultDeadlineAt - now) / 1000));
      line = `次ラウンドまで: ${sec}s（全員準備OKでも即開始）`;
    }
    if (gameTimer) gameTimer.textContent = line;
  }

  function renderJudgePanel(st) {
    if (!judgePanel) return;
    const show = st.phase === "JUDGE" && isHunter(st);
    judgePanel.style.display = show ? "block" : "none";
    if (!show) return;

    const need = Number(st.picksRequired || 0);
    if (picksRequiredEl) picksRequiredEl.textContent = String(need);

    const enough = selectedSlotIds.size === need;
    if (btnConfirmJudgement) {
      btnConfirmJudgement.disabled = hasSubmittedJudge || !enough;
      btnConfirmJudgement.textContent = hasSubmittedJudge
        ? "断罪を送信済み"
        : (enough ? "断罪を確定" : `断罪を確定（${selectedSlotIds.size}/${need}）`);
    }
  }

  function renderResultPanel(st) {
    if (!resultPanel) return;
    const show = st.phase === "RESULT";
    resultPanel.style.display = show ? "block" : "none";
    if (!show) return;
    renderResultCountdown(st);
  }

  function renderResultCountdown(st) {
    if (!resultCountdown) return;
    if (st.phase !== "RESULT" || !st.resultDeadlineAt) {
      resultCountdown.textContent = "";
      return;
    }
    const now = Date.now();
    const sec = Math.max(0, Math.ceil((st.resultDeadlineAt - now) / 1000));
    resultCountdown.textContent = `自動で次ラウンド: ${sec}s`;
  }

  function renderGame(st) {
  openGame();
  renderTopBar(st);

  // フェーズ変化で状態リセット
  if (st.phase !== lastPhase) {
    if (st.phase === "ANSWER") {
      hasSubmittedAnswer = false;
      draftAnswerText = "";
    }
    if (st.phase === "JUDGE") {
      selectedSlotIds.clear();
      hasSubmittedJudge = false;
    }
    lastPhase = st.phase;
  }

  // ROLE/BRIEF（INTROは自動スキップ）
  renderRoleOrBriefModal(st, socket);

  // カード描画（スマホ1列・自己可視・タップで再編集）
  renderCards(st, socket);

  // ANSWERになったら自動で回答モーダル（レジスタントのみ）
  if (st.phase === "ANSWER") {
    openAnswerModal(st, socket);
  } else {
    if (answerModal) hideModal(answerModal);
  }

  // JUDGEパネルは従来どおり（ボタン表示）
  renderJudgePanel(st, socket);

  // RESULTになったらランキングモーダル
  if (st.phase === "RESULT") {
    openResultModal(st, socket);
  } else {
    if (resultModal) hideModal(resultModal);
  }

  startLocalTimer();
}


  // ---- socket handlers
  socket.on("judgement:state", (state) => {
    if (!currentRoomId) return;
    if (String(state.roomId) !== String(currentRoomId)) return;
    applyState(state);
  });

  socket.on("judgement:gameState", (st) => {
    if (!st?.roomId) return;
    currentRoomId = st.roomId;
    gameState = st;
    renderGame(st);
  });

  socket.on("judgement:error", (e) => {
    const msg = e?.message ? String(e.message) : "Unknown error";
    console.error("[judgement:error]", msg);
    alert(`エラー: ${msg}`);
  });

  // ---- waiting UI events
  btnRoomMatch?.addEventListener("click", () => {
    if (!mustLogin()) return alert("ログインが必要です");
    toggleDisplay(roomMatchPanel, "block");
  });

  btnCreate?.addEventListener("click", () => {
    if (roomCreatePanel) roomCreatePanel.style.display = "block";
    if (roomJoinPanel) roomJoinPanel.style.display = "none";
  });

  btnJoin?.addEventListener("click", () => {
    if (roomJoinPanel) roomJoinPanel.style.display = "block";
    if (roomCreatePanel) roomCreatePanel.style.display = "none";
  });

  btnCreateConfirm?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      const hostName = me();
      const allowRandom = !!chkAllowRandom?.checked;

      const data = await postJSON("/api/judgement/room/create", { allowRandom, hostName });
      if (createdRoomInfo) createdRoomInfo.textContent = `作成しました：ルームID ${data.roomId}`;

      await postJSON("/api/judgement/room/join", { roomId: data.roomId, username: hostName });
      openWaiting(data.roomId);
    } catch (e) {
      alert(`作成に失敗: ${e.message}`);
    }
  });

  btnJoinConfirm?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      const roomId = (roomIdInput?.value || "").trim();
      if (!/^\d{4}$/.test(roomId)) return alert("4桁の数字を入力してください");

      await postJSON("/api/judgement/room/join", { roomId, username: me() });
      openWaiting(roomId);
    } catch (e) {
      if (String(e.message).includes("kicked")) {
        alert("このルームには入れません（キック済み）");
        showTop();
        return;
      }
      alert(`入室に失敗: ${e.message}`);
    }
  });

  btnRandom?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      const data = await postJSON("/api/judgement/room/randomJoin", { username: me() });
      await postJSON("/api/judgement/room/join", { roomId: data.roomId, username: me() });
      openWaiting(data.roomId);
    } catch (e) {
      alert(`ランダム対戦が見つかりません: ${e.message}`);
    }
  });

  btnRules?.addEventListener("click", () => {
    alert(
      `【断罪AI ルール概要】
・1人が断罪狩人、他がレジスタント
・お題に対して「AIっぽい」回答をする
・AI回答も混ざる
・狩人は人間回答を見抜いて選ぶ
・狩人は的中数だけ得点、レジスタントは見抜かれなければ1点`
    );
  });

  btnPlayWithMembers?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      if (!currentRoomId) return;
      if (!isHost()) return;

      await postJSON("/api/judgement/room/lockForStart", {
        roomId: currentRoomId,
        hostName: me(),
      });
    } catch (e) {
      alert(`締切に失敗: ${e.message}`);
    }
  });

  aiCountInput?.addEventListener("input", () => {
    if (aiCountValue && aiCountInput) aiCountValue.textContent = String(aiCountInput.value);
  });

  btnFinalStart?.addEventListener("click", () => {
    if (!mustLogin()) return alert("ログインが必要です");
    if (!currentRoomId) return;
    if (!isHost()) return alert("ホストのみ操作できます");

    sendAuthIfPossible();

    const n = Number(aiCountInput?.value || 0);
    if (!Number.isInteger(n) || n < 1) return alert("AIの数が不正です");
    socket.emit("judgement:gameStart", { roomId: currentRoomId, aiCount: n });
  });

  btnToggleRecruit?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      if (!currentRoomId) return;
      if (!isHost()) return alert("ホストのみ操作できます");

      await postJSON("/api/judgement/room/toggleRecruit", {
        roomId: currentRoomId,
        hostName: me(),
      });
    } catch (e) {
      alert(`募集再開に失敗: ${e.message}`);
    }
  });

  // ---- game events
  /*answerInput?.addEventListener("input", () => {
    const t = String(answerInput.value || "");
    if (answerCharCount) answerCharCount.textContent = `${t.length}/120`;
  });

  btnSubmitAnswer?.addEventListener("click", () => {
    if (!mustLogin()) return alert("ログインが必要です");
    if (!currentRoomId) return;
    if (!gameState || gameState.phase !== "ANSWER") return alert("回答フェーズではありません");
    if (hasSubmittedAnswer) return;

    const text = String(answerInput?.value || "").trim();
    if (!text) return alert("回答が空です");
    if (text.length > 120) return alert("120文字以内にしてください");

    hasSubmittedAnswer = true;
    if (btnSubmitAnswer) {
      btnSubmitAnswer.disabled = true;
      btnSubmitAnswer.textContent = "送信済み";
    }

    socket.emit("judgement:submitAnswer", { roomId: currentRoomId, username: me(), text });
  });*/

  btnConfirmJudgement?.addEventListener("click", () => {
    if (!mustLogin()) return alert("ログインが必要です");
    if (!currentRoomId) return;
    if (!gameState || gameState.phase !== "JUDGE") return alert("断罪フェーズではありません");
    if (!isHunter(gameState)) return alert("狩人のみ断罪できます");
    if (hasSubmittedJudge) return;

    const need = Number(gameState.picksRequired || 0);
    if (selectedSlotIds.size !== need) return alert(`選択数が不足しています（${need}件）`);

    hasSubmittedJudge = true;
    if (btnConfirmJudgement) {
      btnConfirmJudgement.disabled = true;
      btnConfirmJudgement.textContent = "断罪を送信済み";
    }

    socket.emit("judgement:judgePick", {
      roomId: currentRoomId,
      username: me(),
      pickedSlotIds: Array.from(selectedSlotIds),
    });
  });

  btnReadyNext?.addEventListener("click", () => {
    if (!mustLogin()) return alert("ログインが必要です");
    if (!currentRoomId) return;
    if (!gameState || gameState.phase !== "RESULT") return alert("結果表示中ではありません");
    socket.emit("judgement:resultReady", { roomId: currentRoomId, username: me() });
  });

  // ---- back
  btnBackToMenu?.addEventListener("click", showTop);

  // 初期
  showTop();
});
