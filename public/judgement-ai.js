// public/judgement-ai.js

function mustLogin() {
  return window.currentUser?.email && window.currentUser?.username;
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

function normalizeStatusText(status) {
  let t = String(status || "");

  // 旧表記 → 新表記へ寄せる
  t = t.replace("ランダム可", "ランダム対戦許可");
  t = t.replace("ランダム不可", "ランダム対戦不許可");

  // 先頭の「状態:」「状態;」が混ざっていても、表示は自然にする
  t = t.replace(/^状態[:;]\s*/g, "");
  return t;
}

document.addEventListener("DOMContentLoaded", () => {
  const judgementAISection = document.getElementById("judgementAI");
  const judgementActions = judgementAISection?.querySelector(".judgement-actions");

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

  const waitingRoom = document.getElementById("waitingRoom");
  const waitingRoomId = document.getElementById("waitingRoomId");
  const waitingStatusText = document.getElementById("waitingStatusText");

  const btnPlayWithMembers = document.getElementById("btnPlayWithMembers");

  const nonHostLockedPanel = document.getElementById("nonHostLockedPanel");
  const waitingMembersLocked = document.getElementById("waitingMembersLocked");

  const hostConfigPanel = document.getElementById("hostConfigPanel");
  const memberCountText = document.getElementById("memberCountText");
  const aiCountInput = document.getElementById("aiCountInput"); // range
  const aiCountValue = document.getElementById("aiCountValue");
  const aiHintText = document.getElementById("aiHintText");

  const btnFinalStart = document.getElementById("btnFinalStart");
  const btnToggleRecruit = document.getElementById("btnToggleRecruit");

  const waitingMembersPanel = document.getElementById("waitingMembersPanel");
  const waitingMembers = document.getElementById("waitingMembers");

  const btnBackToMenu = document.getElementById("btnBackToMenu");

  // ---- state
  let currentRoomId = null;
  let currentHost = "";
  let currentMembers = [];
  let lastMembers = [];
  let pollingTimer = null;
  let joinedOnce = false;

  function isHost() {
    return mustLogin() && window.currentUser.username === currentHost;
  }

  function stopPolling() {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = null;
  }

  function showTop() {
    stopPolling();
    currentRoomId = null;
    currentHost = "";
    currentMembers = [];
    lastMembers = [];
    joinedOnce = false;

    // waiting を閉じて、トップUIを開く
    if (waitingRoom) waitingRoom.style.display = "none";
    if (roomMatchPanel) roomMatchPanel.style.display = "none";
    if (roomCreatePanel) roomCreatePanel.style.display = "none";
    if (roomJoinPanel) roomJoinPanel.style.display = "none";
    if (createdRoomInfo) createdRoomInfo.textContent = "";
    if (joinRoomInfo) joinRoomInfo.textContent = "";

    if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";
    if (hostConfigPanel) hostConfigPanel.style.display = "none";
    if (waitingMembersPanel) waitingMembersPanel.style.display = "block";

    if (judgementActions) judgementActions.style.display = "flex";
    // ルーム対戦パネルは開かない（必要ならユーザーが押す）
  }

  function openWaiting(roomId) {
    currentRoomId = roomId;
    joinedOnce = true;

    if (waitingRoom) waitingRoom.style.display = "block";
    if (roomMatchPanel) roomMatchPanel.style.display = "none";
    if (roomCreatePanel) roomCreatePanel.style.display = "none";
    if (roomJoinPanel) roomJoinPanel.style.display = "none";
    if (createdRoomInfo) createdRoomInfo.textContent = "";
    if (joinRoomInfo) joinRoomInfo.textContent = "";

    // 待機に入ったら「ランダム/ルーム対戦」などのトップ操作群は隠す
    if (judgementActions) judgementActions.style.display = "none";

    if (waitingRoomId) waitingRoomId.textContent = roomId;

    // 初期は通常待機表示
    if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";
    if (hostConfigPanel) hostConfigPanel.style.display = "none";
    if (waitingMembersPanel) waitingMembersPanel.style.display = "block";
  }

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

    if (aiHintText) {
      aiHintText.textContent = `設定可能: ${min}〜${max}（おすすめ: ${rec}）`;
    }
  }

  function applyState(state) {
    // state: { roomId, status, hostName, members, aiCount, kicked? }
    currentHost = String(state.hostName || "");
    currentMembers = Array.isArray(state.members) ? state.members : [];

    // ---- キック検知（kicked配列が無くても動く）
    const me = window.currentUser?.username;
    const iWasIn = lastMembers.includes(me);
    const iAmIn = currentMembers.includes(me);

    if (joinedOnce && me && iWasIn && !iAmIn) {
      alert("このルームからキックされました。");
      showTop();
      return;
    }

    // kicked配列がある場合はそれも優先
    const kicked = Array.isArray(state.kicked) ? state.kicked : null;
    if (joinedOnce && me && kicked && kicked.includes(me)) {
      alert("このルームからキックされました。");
      showTop();
      return;
    }

    lastMembers = currentMembers.slice();

    // ステータス表示
    if (waitingStatusText) waitingStatusText.textContent = normalizeStatusText(state.status);

    // 「このメンバーで遊ぶ！」はホストのみ表示
    const locked = String(state.status || "").includes("/募集停止");
    if (btnPlayWithMembers) {
      btnPlayWithMembers.style.display = isHost() && !locked ? "inline-block" : "none";
    }

    // 参加者リスト（通常）
    setMembers(waitingMembers, currentMembers, {
      hostName: currentHost,
      showKick: isHost() && !locked, // 締切後はキックUIを消す（必要なら true に変更可）
      onKick: async (targetName) => {
        try {
          await postJSON("/api/judgement/room/kick", {
            roomId: currentRoomId,
            hostName: window.currentUser.username,
            targetName,
          });
          // 次回pollで反映
        } catch (e) {
          alert(`キックに失敗: ${e.message}`);
        }
      },
    });

    // 締切後の表示切替
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

  async function refreshRoom() {
    if (!currentRoomId) return;
    try {
      const st = await postJSON("/api/judgement/room/state", { roomId: currentRoomId });
      applyState(st);
    } catch (e) {
      console.error(e);
      alert(`ルーム情報の取得に失敗: ${e.message}`);
      showTop();
    }
  }

  function startPolling() {
    stopPolling();
    refreshRoom(); // 即時
    pollingTimer = setInterval(refreshRoom, 1500);
  }

  // タブ復帰時にズレた表示を戻す
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && currentRoomId) refreshRoom();
  });

  // ---- UI events
  btnRoomMatch?.addEventListener("click", () => {
    if (!mustLogin()) return alert("ログインが必要です");
    roomMatchPanel.style.display = roomMatchPanel.style.display === "none" ? "block" : "none";
  });

  btnCreate?.addEventListener("click", () => {
    roomCreatePanel.style.display = "block";
    roomJoinPanel.style.display = "none";
  });

  btnJoin?.addEventListener("click", () => {
    roomJoinPanel.style.display = "block";
    roomCreatePanel.style.display = "none";
  });

  btnCreateConfirm?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");

      const hostName = window.currentUser.username;
      const allowRandom = !!chkAllowRandom?.checked;

      const data = await postJSON("/api/judgement/room/create", { allowRandom, hostName });
      createdRoomInfo.textContent = `作成しました：ルームID ${data.roomId}`;

      // 冪等 join（members一覧取得目的）
      await postJSON("/api/judgement/room/join", { roomId: data.roomId, username: hostName });

      openWaiting(data.roomId);
      startPolling();
    } catch (e) {
      console.error(e);
      alert(`作成に失敗: ${e.message}`);
    }
  });

  btnJoinConfirm?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");

      const roomId = (roomIdInput?.value || "").trim();
      if (!/^\d{4}$/.test(roomId)) return alert("4桁の数字を入力してください");

      const username = window.currentUser.username;
      await postJSON("/api/judgement/room/join", { roomId, username });

      openWaiting(roomId);
      startPolling();
    } catch (e) {
      console.error(e);
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

      const username = window.currentUser.username;

      const data = await postJSON("/api/judgement/room/randomJoin", { username });
      await postJSON("/api/judgement/room/join", { roomId: data.roomId, username });

      openWaiting(data.roomId);
      startPolling();
    } catch (e) {
      console.error(e);
      alert(`ランダム対戦が見つかりません: ${e.message}`);
    }
  });

  btnRules?.addEventListener("click", () => {
    alert(
`【断罪AI ルール概要】
・1人が断罪狩人、他がレジスタント
・全員がお題に対して「AIっぽく」回答
・さらにAI回答も混ざる
・断罪狩人は人間回答を見抜いて選ぶ
・狩人は的中数だけ得点、レジスタントは見抜かれなければ1点`
    );
  });

  // ---- 「このメンバーで遊ぶ！」（ホストのみ）
  btnPlayWithMembers?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      if (!currentRoomId) return;
      if (!isHost()) return; // 非ホストはそもそも非表示だが念のため

      await postJSON("/api/judgement/room/lockForStart", {
        roomId: currentRoomId,
        hostName: window.currentUser.username,
      });

      await refreshRoom(); // 即反映
    } catch (e) {
      console.error(e);
      alert(`締切に失敗: ${e.message}`);
    }
  });

  // ---- スライダー値表示
  aiCountInput?.addEventListener("input", () => {
    if (aiCountValue) aiCountValue.textContent = String(aiCountInput.value);
  });

  // ---- ゲーム開始（最終：ここでAI数をSheetへ）
  btnFinalStart?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      if (!currentRoomId) return;
      if (!isHost()) return alert("ホストのみ操作できます");

      const n = Number(aiCountInput?.value || 0);
      if (!Number.isInteger(n) || n < 1) return alert("AIの数が不正です");

      await postJSON("/api/judgement/room/finalStart", {
        roomId: currentRoomId,
        hostName: window.currentUser.username,
        aiCount: n,
      });

      alert("対戦開始！（次はゲーム本編フェーズへ遷移）");
      await refreshRoom();
    } catch (e) {
      console.error(e);
      alert(`開始に失敗: ${e.message}`);
    }
  });

  // ---- 募集再開（締切解除）
  btnToggleRecruit?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      if (!currentRoomId) return;
      if (!isHost()) return alert("ホストのみ操作できます");

      // サーバの toggleRecruit 実装が「トグル」ならこれでOK
      await postJSON("/api/judgement/room/toggleRecruit", {
        roomId: currentRoomId,
        hostName: window.currentUser.username,
      });

      await refreshRoom();
    } catch (e) {
      console.error(e);
      alert(`募集再開に失敗: ${e.message}`);
    }
  });

  // ---- 断罪AIトップに戻る
  btnBackToMenu?.addEventListener("click", () => {
    showTop();
  });

  // 初期状態を整える（断罪AIを開いた時にトップ想定）
  showTop();
});
