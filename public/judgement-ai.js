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

function setMembers(listEl, members, { hostName = null, showKick = false, onKick = null } = {}) {
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
      btn.style.marginLeft = "auto";
      btn.addEventListener("click", () => onKick && onKick(name));
      li.appendChild(btn);
    }

    listEl.appendChild(li);
  });
}

function normalizeStatusText(status) {
  // サーバ側は「状態:ランダム対戦許可」等だが、念のため古い値も吸収
  let t = String(status || "");
  t = t.replace("ランダム可", "状態:ランダム対戦許可");
  t = t.replace("ランダム不可", "状態:ランダム対戦不許可");

  // 表示をさらに自然に
  t = t.replace("状態:ランダム対戦許可", "ランダム対戦許可");
  t = t.replace("状態:ランダム対戦不許可", "ランダム対戦不許可");
  return t;
}

document.addEventListener("DOMContentLoaded", () => {
  // ---- sections
  const gameMenu = document.getElementById("gameMenu");
  const judgementAISection = document.getElementById("judgementAI");

  // ---- main buttons
  const btnRandom = document.getElementById("btnRandomMatch");
  const btnRoomMatch = document.getElementById("btnRoomMatch");
  const btnRules = document.getElementById("btnJudgementRules");

  // ---- room panel
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

  // ---- waiting room
  const waitingRoom = document.getElementById("waitingRoom");
  const waitingRoomId = document.getElementById("waitingRoomId");
  const waitingStatusText = document.getElementById("waitingStatusText");

  const waitingMembersPanel = document.getElementById("waitingMembersPanel");
  const waitingMembers = document.getElementById("waitingMembers");

  const btnPlayWithMembers = document.getElementById("btnPlayWithMembers");

  // non-host locked panel
  const nonHostLockedPanel = document.getElementById("nonHostLockedPanel");
  const waitingMembersLocked = document.getElementById("waitingMembersLocked");

  // host config panel
  const hostConfigPanel = document.getElementById("hostConfigPanel");
  const memberCountText = document.getElementById("memberCountText");
  const aiCountInput = document.getElementById("aiCountInput");
  const aiHintText = document.getElementById("aiHintText");
  const btnFinalStart = document.getElementById("btnFinalStart");
  const btnToggleRecruit = document.getElementById("btnToggleRecruit");

  // back buttons (id重複があるので全部拾う)
  const backButtons = Array.from(document.querySelectorAll("#btnBackToMenu"));

  // ---- state
  let currentRoomId = null;
  let currentHostName = null;
  let currentMembers = [];
  let currentStatusRaw = "";
  let stateTimer = null;

  function stopPolling() {
    if (stateTimer) clearInterval(stateTimer);
    stateTimer = null;
  }

  function goJudgementTop() {
    // 「断罪AIの最初」に戻す＝judgementAIセクションのトップ状態へ戻す
    stopPolling();
    currentRoomId = null;
    currentHostName = null;
    currentMembers = [];
    currentStatusRaw = "";

    // panels reset
    roomMatchPanel.style.display = "none";
    roomCreatePanel.style.display = "none";
    roomJoinPanel.style.display = "none";
    createdRoomInfo.textContent = "";
    joinRoomInfo.textContent = "";

    waitingRoom.style.display = "none";
    nonHostLockedPanel.style.display = "none";
    hostConfigPanel.style.display = "none";
    if (waitingMembersPanel) waitingMembersPanel.style.display = "block";

    if (waitingStatusText) waitingStatusText.textContent = "";

    // judgementAI は表示したまま
    if (judgementAISection) judgementAISection.style.display = "block";
    if (gameMenu) gameMenu.style.display = "none";
  }

  function backToMenu() {
    // メニューへ戻る
    stopPolling();
    currentRoomId = null;

    // judgementAI 非表示、gameMenu 表示
    if (judgementAISection) judgementAISection.style.display = "none";
    if (gameMenu) gameMenu.style.display = "block";

    // 各UI初期化
    roomMatchPanel.style.display = "none";
    roomCreatePanel.style.display = "none";
    roomJoinPanel.style.display = "none";
    waitingRoom.style.display = "none";
    createdRoomInfo.textContent = "";
    joinRoomInfo.textContent = "";
  }

  function isHost() {
    return mustLogin() && window.currentUser.username === currentHostName;
  }

  function updateAIHints(membersCount) {
    const count = Number(membersCount || 0);
    const min = 1;
    const max = Math.max(1, count * 3);
    const rec = Math.max(1, count * 2);

    if (aiCountInput) {
      aiCountInput.min = String(min);
      aiCountInput.max = String(max);

      // 値が範囲外なら補正
      const v = Number(aiCountInput.value || 0);
      if (!Number.isFinite(v) || v < min) aiCountInput.value = String(rec);
      if (v > max) aiCountInput.value = String(max);
    }

    if (aiHintText) {
      aiHintText.textContent = `設定可能: ${min}〜${max}（おすすめ: ${rec}）`;
    }
  }

  function showWaitingBase(roomId) {
    // 待機部屋のベース表示
    waitingRoom.style.display = "block";
    roomMatchPanel.style.display = "none";
    roomCreatePanel.style.display = "none";
    roomJoinPanel.style.display = "none";
    createdRoomInfo.textContent = "";
    joinRoomInfo.textContent = "";
    waitingRoomId.textContent = roomId;

    // まずは通常待機表示
    nonHostLockedPanel.style.display = "none";
    hostConfigPanel.style.display = "none";
    if (waitingMembersPanel) waitingMembersPanel.style.display = "block";
  }

  function applyStateToUI(state) {
    // state: {roomId,status,hostName,members,aiCount,kicked}
    currentHostName = state.hostName || "";
    currentMembers = Array.isArray(state.members) ? state.members : [];
    currentStatusRaw = String(state.status || "");

    // キック済み判定（サーバが kicked 配列も返す）
    const kicked = Array.isArray(state.kicked) ? state.kicked : [];
    const me = window.currentUser?.username;
    if (me && kicked.includes(me)) {
      alert("このルームからキックされました。");
      // 断罪AIトップへ戻す
      goJudgementTop();
      return;
    }

    // status 表示
    if (waitingStatusText) {
      waitingStatusText.textContent = normalizeStatusText(currentStatusRaw);
    }

    // 参加者リスト
    setMembers(waitingMembers, currentMembers, {
      hostName: currentHostName,
      showKick: isHost(), // ホストならキックボタン付与
      onKick: async (targetName) => {
        try {
          if (!currentRoomId) return;
          if (!isHost()) return;
          await postJSON("/api/judgement/room/kick", {
            roomId: currentRoomId,
            hostName: window.currentUser.username,
            targetName,
          });
          // 反映は次回ポーリングでOK（即時に見せたいなら refreshRoom()）
        } catch (e) {
          alert(`キックに失敗: ${e.message}`);
        }
      },
    });

    // 募集停止（締切）状態なら表示を切替
    const locked = String(currentStatusRaw).includes("/募集停止");

    if (locked) {
      if (isHost()) {
        // ホスト：AI設定フェーズ
        nonHostLockedPanel.style.display = "none";
        hostConfigPanel.style.display = "block";
        if (waitingMembersPanel) waitingMembersPanel.style.display = "none";

        if (memberCountText) {
          memberCountText.textContent = `参加人数: ${currentMembers.length}人（AIはこの後決めます）`;
        }
        updateAIHints(currentMembers.length);
      } else {
        // 非ホスト：締切メッセージ
        hostConfigPanel.style.display = "none";
        nonHostLockedPanel.style.display = "block";
        if (waitingMembersPanel) waitingMembersPanel.style.display = "none";

        setMembers(waitingMembersLocked, currentMembers, {
          hostName: currentHostName,
          showKick: false,
        });
      }
    } else {
      // 通常待機状態
      nonHostLockedPanel.style.display = "none";
      hostConfigPanel.style.display = "none";
      if (waitingMembersPanel) waitingMembersPanel.style.display = "block";
    }
  }

  async function refreshRoom() {
    if (!currentRoomId) return;
    try {
      const st = await postJSON("/api/judgement/room/state", { roomId: currentRoomId });
      applyStateToUI(st);
    } catch (e) {
      console.error(e);
      // ルーム消滅など
      alert(`ルーム状態の取得に失敗: ${e.message}`);
      goJudgementTop();
    }
  }

  function startPolling() {
    stopPolling();
    stateTimer = setInterval(refreshRoom, 1500);
  }

  // ---- navigation from menu card
  // data-game="judgement-ai" のカードクリックで section 表示する処理は script.js 側かもしれないので、
  // ここでは「judgementAIに入った前提」で動くようにする。
  // ただ、戻るは本JSで管理する。

  // ---- buttons
  btnRoomMatch?.addEventListener("click", () => {
    if (!mustLogin()) {
      alert("ログインが必要です");
      return;
    }
    roomMatchPanel.style.display = (roomMatchPanel.style.display === "none" ? "block" : "none");
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
      if (!mustLogin()) {
        alert("ログインが必要です");
        return;
      }
      const allowRandom = !!chkAllowRandom?.checked;
      const hostName = window.currentUser.username;

      const data = await postJSON("/api/judgement/room/create", { allowRandom, hostName });

      createdRoomInfo.textContent = `作成しました：ルームID ${data.roomId}`;

      // create時点でホストは参加済みだが、join API でmembers返す仕様に寄せるため join を呼ぶ（冪等）
      const joined = await postJSON("/api/judgement/room/join", {
        roomId: data.roomId,
        username: hostName,
      });

      currentRoomId = data.roomId;
      showWaitingBase(currentRoomId);
      setMembers(waitingMembers, joined.members || [hostName], { hostName });
      await refreshRoom();
      startPolling();
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

      const joined = await postJSON("/api/judgement/room/join", { roomId, username });

      joinRoomInfo.textContent = `入室しました：${roomId}`;

      currentRoomId = roomId;
      showWaitingBase(currentRoomId);
      setMembers(waitingMembers, joined.members, { hostName: null });
      await refreshRoom();
      startPolling();
    } catch (e) {
      console.error(e);

      // kicked のときは「断罪AIトップへ戻す」
      if (String(e.message).includes("kicked")) {
        alert("このルームには入れません（キック済み）");
        goJudgementTop();
        return;
      }

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

      const data = await postJSON("/api/judgement/room/randomJoin", { username });
      const joined = await postJSON("/api/judgement/room/join", {
        roomId: data.roomId,
        username,
      });

      currentRoomId = data.roomId;
      showWaitingBase(currentRoomId);
      setMembers(waitingMembers, joined.members);
      await refreshRoom();
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

  // ---- 「このメンバーで遊ぶ！」：募集停止にして締切→ホストはAI設定、非ホストは締切表示
  btnPlayWithMembers?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) {
        alert("ログインが必要です");
        return;
      }
      if (!currentRoomId) return;

      // ★ホストだけが締切操作
      // 非ホストが押しても意味がないので、状態を取りにいって表示更新だけして終わる
      await refreshRoom();
      if (!isHost()) {
        alert("ホストが募集を締め切るまでお待ちください。");
        return;
      }

      await postJSON("/api/judgement/room/lockForStart", {
        roomId: currentRoomId,
        hostName: window.currentUser.username,
      });

      await refreshRoom(); // すぐ反映
    } catch (e) {
      console.error(e);
      alert(`締切に失敗: ${e.message}`);
    }
  });

  // ---- ホスト：募集停止/再開
  btnToggleRecruit?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) {
        alert("ログインが必要です");
        return;
      }
      if (!currentRoomId) return;
      if (!isHost()) {
        alert("ホストのみ操作できます");
        return;
      }

      await postJSON("/api/judgement/room/toggleRecruit", {
        roomId: currentRoomId,
        hostName: window.currentUser.username,
      });

      await refreshRoom();
    } catch (e) {
      console.error(e);
      alert(`募集停止/再開に失敗: ${e.message}`);
    }
  });

  // ---- ホスト：最終開始（ここで初めてAI数をSheetへ書き込み）
  btnFinalStart?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) {
        alert("ログインが必要です");
        return;
      }
      if (!currentRoomId) return;
      if (!isHost()) {
        alert("ホストのみ操作できます");
        return;
      }

      const n = Number(aiCountInput?.value || 0);
      if (!Number.isInteger(n) || n < 1) {
        alert("AIの数は1以上の整数で入力してください");
        return;
      }

      await postJSON("/api/judgement/room/finalStart", {
        roomId: currentRoomId,
        hostName: window.currentUser.username,
        aiCount: n,
      });

      // ここからゲーム本編へ繋ぐ
      alert("対戦開始！（次はゲーム本編フェーズへ遷移）");
      await refreshRoom();
    } catch (e) {
      console.error(e);
      alert(`開始に失敗: ${e.message}`);
    }
  });

  // ---- 戻る系
  backButtons.forEach((btn) => {
    btn?.addEventListener("click", () => {
      // 仕様：メニュー戻りも「断罪AIの最初」に戻す、ではなく「メニューに戻る」指定だったので、
      // あなたの要望に合わせ「断罪AIの最初」へ戻したい場合は goJudgementTop() に変えてください。
      // ここはユーザー要望：「メニューに戻るボタンも断罪AIの最初に戻る」なので goJudgementTop() にする。
      goJudgementTop();
    });
  });

  // もう一つの「戻る」（待機部屋の下にあるボタン）も同じ挙動にしたいなら、
  // HTML側の文言が「戻る」なので、同じidで拾えている（重複id問題はあるが動作はする）
  // 断罪AIトップではなく “ゲームメニュー” に戻したい場合はここを backToMenu() にしてください。

  // ---- 初期表示：断罪AIが開かれた時にトップに整える（他JSで表示切替されるため）
  // judgementAIが表示されていて待機部屋が出てないならトップ扱いでよい
});
