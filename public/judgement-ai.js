// public/judgement-ai.js

// ------------------------------
// helpers
// ------------------------------
function mustLogin() {
  return !!(window.currentUser?.email && window.currentUser?.username);
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function isValidUsername(name) {
  // スプレッドシートD列は "/" 区切りなので禁止
  return typeof name === "string" && name.trim() && !name.includes("/");
}

function el(id) {
  return document.getElementById(id);
}

function setText(idOrEl, text) {
  const node = typeof idOrEl === "string" ? el(idOrEl) : idOrEl;
  if (node) node.textContent = text ?? "";
}

function show(node) {
  if (node) node.style.display = "block";
}

function hide(node) {
  if (node) node.style.display = "none";
}

function setDisplay(node, value) {
  if (node) node.style.display = value;
}

// ------------------------------
// main
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // top buttons
  const btnRoomMatch = el("btnRoomMatch");
  const btnRandom = el("btnRandomMatch");
  const btnRules = el("btnJudgementRules");

  // panels
  const roomMatchPanel = el("roomMatchPanel");
  const roomCreatePanel = el("roomCreatePanel");
  const roomJoinPanel = el("roomJoinPanel");
  const waitingRoom = el("waitingRoom");

  // room match panel buttons
  const btnCreate = el("btnRoomCreate");
  const btnJoin = el("btnRoomJoin");

  // create
  const chkAllowRandom = el("chkAllowRandom");
  const btnCreateConfirm = el("btnRoomCreateConfirm");
  const createdRoomInfo = el("createdRoomInfo");

  // join
  const roomIdInput = el("roomIdInput");
  const btnJoinConfirm = el("btnRoomJoinConfirm");
  const joinRoomInfo = el("joinRoomInfo");

  // waiting
  const waitingRoomId = el("waitingRoomId");
  const waitingMembers = el("waitingMembers");
  const btnStart = el("btnStartJudgementGame");
  const btnBackToMenu = el("btnBackToMenu");

  // optional: host-only UI container & controls
  const hostControls = el("hostControls");          // host用パネル（任意）
  const btnToggleRecruit = el("btnToggleRecruit");  // 募集停止/再開（任意）
  const aiCountInput = el("aiCountInput");          // AI数入力（任意）
  const btnSetAiCount = el("btnSetAiCount");        // AI数反映（任意）
  const waitingStatusText = el("waitingStatusText");// 状態表示（任意）

  // state
  let currentRoomId = null;
  let pollTimer = null;
  let lastState = null;

  // ------------------------------
  // UI utilities
  // ------------------------------
  function closeAllPanels() {
    hide(roomMatchPanel);
    hide(roomCreatePanel);
    hide(roomJoinPanel);
  }

  function showRoomMatchPanel() {
    if (!roomMatchPanel) return;
    // toggle
    const now = roomMatchPanel.style.display;
    setDisplay(roomMatchPanel, (now === "none" || !now) ? "block" : "none");
  }

  function openWaiting(roomId) {
    currentRoomId = roomId;

    // show waiting, hide others
    closeAllPanels();
    show(waitingRoom);

    if (createdRoomInfo) createdRoomInfo.textContent = "";
    if (joinRoomInfo) joinRoomInfo.textContent = "";

    setText(waitingRoomId, roomId);

    // start polling
    startPolling();
    // immediate refresh
    refreshRoom().catch((e) => console.error("refreshRoom error:", e));
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      refreshRoom().catch((e) => console.warn("poll failed:", e.message));
    }, 1500);
  }

  function isHost(state) {
    return !!(state?.host && window.currentUser?.username && state.host === window.currentUser.username);
  }

  function updateHostControlsVisibility(state) {
    // hostControls がある場合はそれをまとめて表示/非表示
    if (hostControls) {
      hostControls.style.display = isHost(state) ? "block" : "none";
    }

    // hostControls が無いケースでも、個別ボタンがあれば制御
    const hostOnly = isHost(state);
    if (btnToggleRecruit) btnToggleRecruit.style.display = hostOnly ? "inline-block" : "none";
    if (btnSetAiCount) btnSetAiCount.style.display = hostOnly ? "inline-block" : "none";
    if (aiCountInput) aiCountInput.style.display = hostOnly ? "inline-block" : "none";
    if (btnStart) btnStart.style.display = hostOnly ? "inline-block" : "none";
  }

  function renderMembers(members, state) {
    if (!waitingMembers) return;
    waitingMembers.innerHTML = "";

    const hostMode = isHost(state);
    const hostName = state?.host || null;

    (members || []).forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;

      // hostのみ：キックボタン（host自身は対象外）
      if (hostMode && hostName && name !== hostName) {
        const kickBtn = document.createElement("button");
        kickBtn.textContent = "キック";
        kickBtn.className = "kick-btn";
        kickBtn.addEventListener("click", async () => {
          try {
            if (!confirm(`${name} をキックしますか？`)) return;
            await postJSON("/api/judgement/room/kick", {
              roomId: currentRoomId,
              requesterName: window.currentUser.username,
              targetName: name,
            });
            await refreshRoom();
          } catch (e) {
            console.error(e);
            alert(`キックに失敗: ${e.message}`);
          }
        });

        li.appendChild(document.createTextNode(" "));
        li.appendChild(kickBtn);
      }

      waitingMembers.appendChild(li);
    });
  }

  function updateRecruitButtonText(state) {
    if (!btnToggleRecruit) return;
    const status = String(state?.status || "");
    const stopped = status.includes("/募集停止");
    btnToggleRecruit.textContent = stopped ? "募集を再開" : "募集停止";
  }

  function updateStatusText(state) {
    if (!waitingStatusText) return;
    const status = String(state?.status || "");
    waitingStatusText.textContent = status ? `状態: ${status}` : "";
  }

  async function refreshRoom() {
    if (!currentRoomId) return;

    const state = await postJSON("/api/judgement/room/state", { roomId: currentRoomId });
    lastState = state;

    setText(waitingRoomId, state.roomId || currentRoomId);
    renderMembers(state.members || [], state);
    updateHostControlsVisibility(state);
    updateRecruitButtonText(state);
    updateStatusText(state);

    // AI数：hostなら入力欄に反映（未設置なら無視）
    if (isHost(state) && aiCountInput) {
      const v = Number(state.aiCount);
      if (Number.isFinite(v) && v > 0) aiCountInput.value = String(v);
    }

    // 対戦中なら、ここでゲーム画面へ遷移させる等（今は通知だけ）
    if (String(state.status || "") === "対戦中") {
      // 例：対戦中の表示が必要ならここで
      // alert("対戦が開始されました");
    }
  }

  // ------------------------------
  // event handlers
  // ------------------------------
  btnRoomMatch?.addEventListener("click", () => {
    if (!mustLogin()) {
      alert("ログインが必要です");
      return;
    }
    showRoomMatchPanel();
  });

  btnCreate?.addEventListener("click", () => {
    setDisplay(roomCreatePanel, "grid");
    hide(roomJoinPanel);
  });

  btnJoin?.addEventListener("click", () => {
    setDisplay(roomJoinPanel, "grid");
    hide(roomCreatePanel);
  });

  btnCreateConfirm?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) {
        alert("ログインが必要です");
        return;
      }
      const hostName = window.currentUser.username;

      if (!isValidUsername(hostName)) {
        alert("ユーザーネームに「/」は使えません。ユーザー名を変更してください。");
        return;
      }

      const allowRandom = !!chkAllowRandom?.checked;
      const data = await postJSON("/api/judgement/room/create", { allowRandom, hostName });

      if (createdRoomInfo) createdRoomInfo.textContent = `作成しました：ルームID ${data.roomId}`;
      openWaiting(data.roomId);
    } catch (e) {
      console.error(e);
      alert(`作成に失敗: ${e.message}`);
    }
  });

  btnJoinConfirm?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) {
        alert("ログインが必要です");
        return;
      }
      const roomId = (roomIdInput?.value || "").trim();
      if (!/^\d{4}$/.test(roomId)) {
        alert("4桁の数字を入力してください");
        return;
      }

      const username = window.currentUser.username;
      if (!isValidUsername(username)) {
        alert("ユーザーネームに「/」は使えません。ユーザー名を変更してください。");
        return;
      }

      await postJSON("/api/judgement/room/join", { roomId, username });

      if (joinRoomInfo) joinRoomInfo.textContent = `入室しました：${roomId}`;
      openWaiting(roomId);
    } catch (e) {
      console.error(e);
      alert(`入室に失敗: ${e.message}`);
    }
  });

  btnRandom?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) {
        alert("ログインが必要です");
        return;
      }

      const username = window.currentUser.username;
      if (!isValidUsername(username)) {
        alert("ユーザーネームに「/」は使えません。ユーザー名を変更してください。");
        return;
      }

      const data = await postJSON("/api/judgement/room/randomJoin", { username });
      await postJSON("/api/judgement/room/join", { roomId: data.roomId, username });

      openWaiting(data.roomId);
    } catch (e) {
      console.error(e);
      alert(`ランダム対戦が見つかりません: ${e.message}`);
    }
  });

  btnRules?.addEventListener("click", () => {
    alert(
`【断罪AI ルール概要】
・1人が断罪狩人、他がレジスタント
・全員がお題に対して「AIっぽく」回答（各120文字以内）
・さらにAI回答も混ざる（AIの性格はゲームごとにランダム）
・断罪狩人は人間回答を見抜いて選ぶ
・狩人は的中数だけ得点、レジスタントは見抜かれなければ1点
（※本編フェーズはこれから実装）`
    );
  });

  // host：募集停止/再開
  btnToggleRecruit?.addEventListener("click", async () => {
    try {
      if (!currentRoomId || !lastState) return;
      if (!isHost(lastState)) {
        alert("作成者のみ操作できます");
        return;
      }

      const status = String(lastState.status || "");
      const stopped = status.includes("/募集停止");

      await postJSON("/api/judgement/room/toggleRecruit", {
        roomId: currentRoomId,
        requesterName: window.currentUser.username,
        stop: !stopped,
      });

      await refreshRoom();
    } catch (e) {
      console.error(e);
      alert(`募集状態の変更に失敗: ${e.message}`);
    }
  });

  // host：AI数反映
  btnSetAiCount?.addEventListener("click", async () => {
    try {
      if (!currentRoomId || !lastState) return;
      if (!isHost(lastState)) {
        alert("作成者のみ操作できます");
        return;
      }
      if (!aiCountInput) {
        alert("aiCountInput が見つかりません（HTMLを確認してください）");
        return;
      }

      const n = Number(aiCountInput.value);
      if (!Number.isInteger(n) || n <= 0 || n > 30) {
        alert("AI数は 1〜30 の整数で入力してください");
        return;
      }

      await postJSON("/api/judgement/room/aiCount", {
        roomId: currentRoomId,
        requesterName: window.currentUser.username,
        aiCount: n,
      });

      await refreshRoom();
      alert("AI数を更新しました");
    } catch (e) {
      console.error(e);
      alert(`AI数の更新に失敗: ${e.message}`);
    }
  });

  // host：開始
  btnStart?.addEventListener("click", async () => {
    try {
      if (!currentRoomId || !lastState) return;
      if (!isHost(lastState)) {
        alert("作成者のみ開始できます");
        return;
      }

      // 最低人数チェックを入れたい場合はここ（例：2人以上）
      const membersCount = (lastState.members || []).length;
      if (membersCount < 2) {
        alert("参加者が少なすぎます（最低2人）");
        return;
      }

      await postJSON("/api/judgement/room/start", {
        roomId: currentRoomId,
        requesterName: window.currentUser.username,
      });

      await refreshRoom();
      alert("対戦開始！（次はゲーム本編のフェーズ実装）");
    } catch (e) {
      console.error(e);
      alert(`開始に失敗: ${e.message}`);
    }
  });

  btnBackToMenu?.addEventListener("click", () => {
    stopPolling();
    location.reload();
  });

  // 初期状態：待機部屋は隠す（HTML側が表示でも上書き）
  hide(waitingRoom);
});
