// public/judgement-ai.js

function mustLogin() {
  return window.currentUser?.email && window.currentUser?.username;
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function setMembers(listEl, members, options = {}) {
  const { isHost = false, onKick = null } = options;
  listEl.innerHTML = "";

  (members || []).forEach(name => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = "8px";

    const span = document.createElement("span");
    span.textContent = name;
    li.appendChild(span);

    if (isHost && typeof onKick === "function" && name !== window.currentUser?.username) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "キック";
      btn.addEventListener("click", () => onKick(name));
      li.appendChild(btn);
    }

    listEl.appendChild(li);
  });
}

function containsSlash(name) {
  return typeof name === "string" && name.includes("/");
}

// 断罪AIトップへ戻す（※ページ遷移ではなく、UIを戻す想定）
function backToJudgementTop() {
  // ここはあなたのページ構造に合わせて調整ポイント。
  // 例：断罪AIのトップ要素が #judgementTop ならそれを表示し、
  // waitingRoom等を隠す。
  const waitingRoom = document.getElementById("waitingRoom");
  const roomMatchPanel = document.getElementById("roomMatchPanel");
  const roomCreatePanel = document.getElementById("roomCreatePanel");
  const roomJoinPanel = document.getElementById("roomJoinPanel");

  if (waitingRoom) waitingRoom.style.display = "none";
  if (roomMatchPanel) roomMatchPanel.style.display = "block";
  if (roomCreatePanel) roomCreatePanel.style.display = "none";
  if (roomJoinPanel) roomJoinPanel.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  const btnRoomMatch = document.getElementById("btnRoomMatch");
  const btnRandom = document.getElementById("btnRandomMatch");
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

  const waitingMembersPanel = document.getElementById("waitingMembersPanel");
  const waitingMembers = document.getElementById("waitingMembers");

  const btnPlayWithMembers = document.getElementById("btnPlayWithMembers");
  const btnBackToMenu = document.getElementById("btnBackToMenu");

  const hostConfigPanel = document.getElementById("hostConfigPanel");
  const memberCountText = document.getElementById("memberCountText");
  const aiCountInput = document.getElementById("aiCountInput");
  const aiHintText = document.getElementById("aiHintText");
  const btnFinalStart = document.getElementById("btnFinalStart");
  const btnToggleRecruit = document.getElementById("btnToggleRecruit");

  const nonHostLockedPanel = document.getElementById("nonHostLockedPanel");
  const waitingMembersLocked = document.getElementById("waitingMembersLocked");

  let currentRoomId = null;
  let pollTimer = null;

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        await refreshRoomState();
      } catch (e) {
        // 通信エラー程度は黙って継続
        console.warn("poll error:", e?.message || e);
      }
    }, 1500);
  }

  function openWaiting(roomId) {
    currentRoomId = roomId;

    if (waitingRoom) waitingRoom.style.display = "block";
    if (roomMatchPanel) roomMatchPanel.style.display = "none";
    if (roomCreatePanel) roomCreatePanel.style.display = "none";
    if (roomJoinPanel) roomJoinPanel.style.display = "none";

    if (createdRoomInfo) createdRoomInfo.textContent = "";
    if (joinRoomInfo) joinRoomInfo.textContent = "";
    if (waitingRoomId) waitingRoomId.textContent = roomId;

    // 初期は通常待機UI
    if (waitingMembersPanel) waitingMembersPanel.style.display = "block";
    if (hostConfigPanel) hostConfigPanel.style.display = "none";
    if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";

    startPolling();
    refreshRoomState(); // 初回即反映
  }

  function normalizeStatusText(bCellText) {
    // 表示だけ変えたい場合：サーバが旧文言でもここで吸収できる
    let t = String(bCellText || "");
    t = t.replace("ランダム可", "ランダム対戦許可");
    t = t.replace("ランダム不可", "ランダム対戦不許可");
    return t;
  }

  function isRecruitStopped(statusText) {
    return String(statusText || "").includes("/募集停止");
  }

  function isInBattle(statusText) {
    return String(statusText || "").includes("対戦中");
  }

  async function refreshRoomState() {
    if (!currentRoomId) return;
    const me = window.currentUser?.username;
    if (!me) return;

    const state = await postJSON("/api/judgement/room/state", { roomId: currentRoomId });
    const members = state.members || [];
    const kicked = state.kicked || [];
    const hostName = state.hostName;
    const isHost = (me === hostName);

    const statusText = normalizeStatusText(state.status || "");
    if (waitingStatusText) waitingStatusText.textContent = statusText;

    // キック済みなら即追い出し（断罪AIトップへ戻す）
    if (kicked.includes(me)) {
      stopPolling();
      alert("キックされました。");
      // UIを断罪AIトップへ
      backToJudgementTop();
      currentRoomId = null;
      return;
    }

    // メンバー一覧更新（ホストだけキックボタン）
    if (waitingMembers) {
      setMembers(waitingMembers, members, {
        isHost,
        onKick: async (targetName) => {
          try {
            if (!currentRoomId) return;
            await postJSON("/api/judgement/room/kick", {
              roomId: currentRoomId,
              hostName: me,
              targetName
            });
            await refreshRoomState();
          } catch (e) {
            console.error(e);
            alert(`キックに失敗: ${e.message}`);
          }
        }
      });
    }

    // 「このメンバーで遊ぶ！」ボタン名／表示制御
    if (btnPlayWithMembers) {
      btnPlayWithMembers.textContent = "このメンバーで遊ぶ！";
      // 対戦中になったら押せない（必要なら）
      btnPlayWithMembers.disabled = isInBattle(statusText);
    }

    // 募集停止後の表示分岐
    const stopped = isRecruitStopped(statusText);

    if (stopped) {
      // ホスト以外：締切メッセージ画面
      if (!isHost) {
        if (waitingMembersPanel) waitingMembersPanel.style.display = "none";
        if (hostConfigPanel) hostConfigPanel.style.display = "none";
        if (nonHostLockedPanel) nonHostLockedPanel.style.display = "block";
        if (waitingMembersLocked) setMembers(waitingMembersLocked, members);
      } else {
        // ホスト：AI設定画面へ（締切済みならここへ）
        if (waitingMembersPanel) waitingMembersPanel.style.display = "none";
        if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";
        if (hostConfigPanel) hostConfigPanel.style.display = "block";

        const humanCount = members.length;
        const maxAI = Math.max(1, humanCount * 3);
        const recommend = humanCount * 2;

        if (memberCountText) memberCountText.textContent = `参加者: ${humanCount}人`;
        if (aiCountInput) {
          aiCountInput.min = "1";
          aiCountInput.max = String(maxAI);
          // 入力が上限超えてたら丸める
          const v = Number(aiCountInput.value || 1);
          if (v > maxAI) aiCountInput.value = String(maxAI);
          if (v < 1) aiCountInput.value = "1";
        }
        if (aiHintText) {
          aiHintText.textContent = `設定範囲: 1〜${maxAI}（おすすめ: ${recommend}）`;
        }
      }
    } else {
      // 募集停止前：通常待機画面
      if (waitingMembersPanel) waitingMembersPanel.style.display = "block";
      if (hostConfigPanel) hostConfigPanel.style.display = "none";
      if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";
    }
  }

  // ---------- ルームメニュー ----------
  btnRoomMatch?.addEventListener("click", () => {
    if (!mustLogin()) { alert("ログインが必要です"); return; }
    if (roomMatchPanel) {
      roomMatchPanel.style.display = (roomMatchPanel.style.display === "none" ? "block" : "none");
    }
  });

  btnCreate?.addEventListener("click", () => {
    if (roomCreatePanel) roomCreatePanel.style.display = "grid";
    if (roomJoinPanel) roomJoinPanel.style.display = "none";
  });

  btnJoin?.addEventListener("click", () => {
    if (roomJoinPanel) roomJoinPanel.style.display = "grid";
    if (roomCreatePanel) roomCreatePanel.style.display = "none";
  });

  // ---------- ルーム作成 ----------
  btnCreateConfirm?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) { alert("ログインが必要です"); return; }
      const hostName = window.currentUser.username;

      if (containsSlash(hostName)) {
        alert("ユーザー名に「/」は使用できません。ユーザー名を変更してください。");
        return;
      }

      const allowRandom = !!chkAllowRandom?.checked;
      const data = await postJSON("/api/judgement/room/create", {
        allowRandom,
        hostName
      });

      if (createdRoomInfo) createdRoomInfo.textContent = `作成しました：ルームID ${data.roomId}`;

      // 作成者を入室させる
      await postJSON("/api/judgement/room/join", { roomId: data.roomId, username: hostName });

      openWaiting(data.roomId);
    } catch (e) {
      console.error(e);
      alert(`作成に失敗: ${e.message}`);
    }
  });

  // ---------- ルーム入室 ----------
  btnJoinConfirm?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) { alert("ログインが必要です"); return; }
      const roomId = (roomIdInput?.value || "").trim();
      if (!/^\d{4}$/.test(roomId)) { alert("4桁の数字を入力してください"); return; }

      const username = window.currentUser.username;
      if (containsSlash(username)) {
        alert("ユーザー名に「/」は使用できません。ユーザー名を変更してください。");
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

  // ---------- ランダム参加 ----------
  btnRandom?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) { alert("ログインが必要です"); return; }
      const username = window.currentUser.username;

      if (containsSlash(username)) {
        alert("ユーザー名に「/」は使用できません。ユーザー名を変更してください。");
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

  // ---------- ルール ----------
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

  // ---------- 「このメンバーで遊ぶ！」（募集締切→ホストAI設定へ） ----------
  btnPlayWithMembers?.addEventListener("click", async () => {
    try {
      if (!currentRoomId) return;
      const me = window.currentUser?.username;
      if (!me) return;

      // ここで募集停止（＝締切）にする
      await postJSON("/api/judgement/room/lockForStart", {
        roomId: currentRoomId,
        hostName: me
      });

      // すぐ反映
      await refreshRoomState();
    } catch (e) {
      console.error(e);
      alert(`締切に失敗: ${e.message}`);
    }
  });

  // ---------- 募集停止/再開（ホストのみ） ----------
  btnToggleRecruit?.addEventListener("click", async () => {
    try {
      if (!currentRoomId) return;
      const me = window.currentUser?.username;
      if (!me) return;

      await postJSON("/api/judgement/room/toggleRecruit", {
        roomId: currentRoomId,
        hostName: me
      });

      await refreshRoomState();
    } catch (e) {
      console.error(e);
      alert(`募集切替に失敗: ${e.message}`);
    }
  });

  // ---------- ホスト最終開始（ここで初めてAI数をSheetへ反映） ----------
  btnFinalStart?.addEventListener("click", async () => {
    try {
      if (!currentRoomId) return;
      const me = window.currentUser?.username;
      if (!me) return;

      const aiCount = Number(aiCountInput?.value || 1);
      if (!Number.isFinite(aiCount) || aiCount < 1) {
        alert("AIの数は1以上で入力してください");
        return;
      }

      await postJSON("/api/judgement/room/finalStart", {
        roomId: currentRoomId,
        hostName: me,
        aiCount
      });

      alert("対戦開始！（次はゲーム本編のフェーズ実装）");
      await refreshRoomState();
    } catch (e) {
      console.error(e);
      alert(`開始に失敗: ${e.message}`);
    }
  });

  // ---------- 戻る（断罪AIトップへ） ----------
  btnBackToMenu?.addEventListener("click", () => {
    stopPolling();
    currentRoomId = null;
    backToJudgementTop();
  });
});
