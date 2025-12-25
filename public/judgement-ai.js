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

function setMembers(listEl, members) {
  listEl.innerHTML = "";
  (members || []).forEach(name => {
    const li = document.createElement("li");
    li.textContent = name;
    listEl.appendChild(li);
  });
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
  const waitingMembers = document.getElementById("waitingMembers");
  const maxPlayersInput = document.getElementById("maxPlayersInput");
  const aiCountInput = document.getElementById("aiCountInput");
  const btnStart = document.getElementById("btnStartJudgementGame");

  const btnBackToMenu = document.getElementById("btnBackToMenu");

  let currentRoomId = null;

  function openWaiting(roomId, members=[]) {
    currentRoomId = roomId;
    waitingRoom.style.display = "block";
    roomMatchPanel.style.display = "none";
    roomCreatePanel.style.display = "none";
    roomJoinPanel.style.display = "none";
    createdRoomInfo.textContent = "";
    joinRoomInfo.textContent = "";
    waitingRoomId.textContent = roomId;
    setMembers(waitingMembers, members);

    // 開始ボタンの活性条件（人数一致）
    const maxPlayers = Number(maxPlayersInput.value || 0);
    btnStart.disabled = !(members.length === maxPlayers);
  }

  async function refreshRoom() {
    if (!currentRoomId) return;
    // シンプルに join API を “members確認用” に使うのは副作用があるので、
    // 本来は GET /api/judgement/room/state を作るのが正道。
    // MVPでは /api/judgement/room/state をサーバ側に追加するのを推奨。
  }

  btnRoomMatch?.addEventListener("click", () => {
    if (!mustLogin()) { alert("ログインが必要です"); return; }
    roomMatchPanel.style.display = (roomMatchPanel.style.display === "none" ? "block" : "none");
  });

  btnCreate?.addEventListener("click", () => {
    roomCreatePanel.style.display = "grid";
    roomJoinPanel.style.display = "none";
  });

  btnJoin?.addEventListener("click", () => {
    roomJoinPanel.style.display = "grid";
    roomCreatePanel.style.display = "none";
  });

  btnCreateConfirm?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) { alert("ログインが必要です"); return; }
      const allowRandom = !!chkAllowRandom?.checked;
      const hostName = window.currentUser.username;

      const data = await postJSON("/api/judgement/room/create", { allowRandom, hostName });
      createdRoomInfo.textContent = `作成しました：ルームID ${data.roomId}`;
      // 作成者も待機部屋へ（参加者として追加したいなら join を呼ぶ）
      const joined = await postJSON("/api/judgement/room/join", { roomId: data.roomId, username: hostName });
      openWaiting(data.roomId, joined.members || [hostName]);
    } catch (e) {
      console.error(e);
      alert(`作成に失敗: ${e.message}`);
    }
  });

  btnJoinConfirm?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) { alert("ログインが必要です"); return; }
      const roomId = (roomIdInput?.value || "").trim();
      if (!/^\d{4}$/.test(roomId)) { alert("4桁の数字を入力してください"); return; }

      const username = window.currentUser.username;
      const joined = await postJSON("/api/judgement/room/join", { roomId, username });
      joinRoomInfo.textContent = `入室しました：${roomId}`;
      openWaiting(roomId, joined.members);
    } catch (e) {
      console.error(e);
      alert(`入室に失敗: ${e.message}`);
    }
  });

  btnRandom?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) { alert("ログインが必要です"); return; }
      const username = window.currentUser.username;
      const data = await postJSON("/api/judgement/room/randomJoin", { username });
      const joined = await postJSON("/api/judgement/room/join", { roomId: data.roomId, username });
      openWaiting(data.roomId, joined.members);
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

  // 待機部屋の開始条件：メンバー数==設定人数
  maxPlayersInput?.addEventListener("input", () => {
    const maxPlayers = Number(maxPlayersInput.value || 0);
    const current = waitingMembers?.children?.length || 0;
    btnStart.disabled = !(current === maxPlayers);
  });

  btnStart?.addEventListener("click", async () => {
    try {
      if (!currentRoomId) return;
      // スプレットシートB列を「対戦中」へ
      await postJSON("/api/judgement/room/status", { roomId: currentRoomId, status: "対戦中" });

      // settings はまずサーバメモリ保持（後でゲームロジックに接続）
      await postJSON("/api/judgement/room/settings", {
        roomId: currentRoomId,
        maxPlayers: Number(maxPlayersInput.value),
        aiCount: Number(aiCountInput.value),
      });

      alert("対戦開始！（次はゲーム本編のフェーズ実装）");
    } catch (e) {
      console.error(e);
      alert(`開始に失敗: ${e.message}`);
    }
  });

  btnBackToMenu?.addEventListener("click", () => {
    location.reload();
  });
});

