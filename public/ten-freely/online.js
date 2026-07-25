import { TenCalculator } from "./calculator.js";

const app = window.tenFreelyApp;
if (!app) throw new Error("tenFreelyApp bridge is not ready");

const refs = {
  authCard: document.getElementById("onlineAuthCard"),
  loginButton: document.getElementById("onlineLoginButton"),
  console: document.getElementById("onlineConsole"),
  createForm: document.getElementById("onlineCreateForm"),
  joinForm: document.getElementById("onlineJoinForm"),
  roomCodeInput: document.getElementById("onlineRoomCodeInput"),
  lobby: document.getElementById("onlineRoomLobby"),
  roomCode: document.getElementById("onlineRoomCode"),
  copyCode: document.getElementById("onlineCopyCode"),
  memberList: document.getElementById("onlineMemberList"),
  ruleSummary: document.getElementById("onlineRuleSummary"),
  waitingText: document.getElementById("onlineWaitingText"),
  startButton: document.getElementById("onlineStartButton"),
  leaveButton: document.getElementById("onlineLeaveButton"),
  calculatorMount: document.getElementById("calculatorMount"),
  scoreboard: document.getElementById("onlineScoreboard"),
  modeLabel: document.getElementById("gameModeLabel"),
  progress: document.getElementById("gameProgressText"),
  lives: document.getElementById("gameLives"),
  timer: document.getElementById("gameTimer"),
  inactivity: document.getElementById("inactivityNotice"),
};

let authenticatedUser = null;
let room = null;
let socket = null;
let calculator = null;
let timerFrame = null;
let mountedProblem = "";
let resolvingRoundNumber = null;

function storedUser() {
  try {
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    if (user?.username && user?.userTrackingId) return user;
  } catch {}
  const username = localStorage.getItem("username");
  const userTrackingId = localStorage.getItem("userTrackingId");
  return username && userTrackingId ? { username, userTrackingId } : null;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.payload = data;
    throw error;
  }
  return data;
}

async function ensureSession() {
  const user = storedUser();
  if (!user) return null;
  try {
    const data = await request("/api/ten-freely/session", {
      method: "POST",
      body: JSON.stringify({ username: user.username, userTrackingId: user.userTrackingId }),
    });
    authenticatedUser = data.user;
    return authenticatedUser;
  } catch (error) {
    console.warn("[ten-freely] session exchange failed", error);
    authenticatedUser = null;
    return null;
  }
}

function setAuthenticatedUi(isAuthenticated) {
  refs.authCard.hidden = isAuthenticated;
  refs.console.hidden = !isAuthenticated || Boolean(room);
  if (!isAuthenticated) refs.lobby.hidden = true;
}

function switchTab(name) {
  for (const button of document.querySelectorAll("[data-online-tab]")) {
    button.classList.toggle("is-active", button.dataset.onlineTab === name);
  }
  for (const panel of document.querySelectorAll("[data-online-panel]")) {
    panel.classList.toggle("is-active", panel.dataset.onlinePanel === name);
  }
}

function selectedCreateSettings() {
  return {
    digitLengths: [...refs.createForm.querySelectorAll('input[name="onlineDigitLength"]:checked')].map((input) => Number(input.value)),
    lives: Number(refs.createForm.querySelector('input[name="onlineLives"]:checked')?.value || 3),
    winsToFinish: Number(refs.createForm.querySelector('input[name="onlineWins"]:checked')?.value || 3),
  };
}

function roomCodeFromInput() {
  return refs.roomCodeInput.value.replace(/\D/gu, "").slice(0, 6);
}

function connectSocket() {
  if (socket?.connected) return socket;
  if (!window.io) throw new Error("Socket.IO is unavailable");
  socket = window.io({ withCredentials: true });
  socket.on("connect", () => { if (room) joinSocketRoom(room.roomId); });
  socket.on("ten:room-state", handleRoomState);
  socket.on("ten:round-result", ({ room: nextRoom, result }) => {
    room = nextRoom;
    updateOnlineGameHeader();
    showRoundResult(result);
  });
  socket.on("ten:match-finished", ({ room: nextRoom, result }) => {
    room = nextRoom;
    showMatchResult(result);
  });
  socket.on("ten:inactivity-warning", ({ remainingMs }) => {
    refs.inactivity.hidden = false;
    refs.inactivity.textContent = `⚠️ 無操作状態が続いています。あと約${Math.max(1, Math.ceil(Number(remainingMs || 0) / 1000))}秒でルームが解散します`;
  });
  socket.on("ten:inactivity-clear", () => { refs.inactivity.hidden = true; });
  socket.on("ten:room-closed", ({ reason }) => {
    cleanupOnlineGame();
    room = null;
    refs.lobby.hidden = true;
    refs.console.hidden = false;
    app.closeModal(true);
    app.showToast(reason === "player_left" ? "対戦ルームが解散されました。" : "ルームを終了しました。", "warning");
    app.showScreen("online", { instant: true });
  });
  return socket;
}

function emitAck(event, payload = {}) {
  return new Promise((resolve, reject) => {
    connectSocket().emit(event, payload, (response = {}) => {
      if (response.ok) resolve(response);
      else {
        const error = new Error(response.error || "socket_error");
        error.payload = response;
        reject(error);
      }
    });
  });
}

async function joinSocketRoom(roomId) {
  try {
    const response = await emitAck("ten:join", { roomId });
    handleRoomState(response.room);
  } catch (error) {
    console.error(error);
    app.showToast("対戦ルームへの再接続に失敗しました。", "warning");
  }
}

async function initializeOnline() {
  const user = await ensureSession();
  setAuthenticatedUi(Boolean(user));
  if (!user) return;
  connectSocket();
  try {
    const data = await request("/api/ten-freely/online/active");
    if (data.room) {
      room = data.room;
      await joinSocketRoom(room.roomId);
    } else {
      room = null;
      refs.console.hidden = false;
      refs.lobby.hidden = true;
    }
  } catch (error) {
    console.error(error);
    app.showToast("参加中ルームを確認できませんでした。", "warning");
  }
}

function renderLobby() {
  if (!room) return;
  refs.console.hidden = true;
  refs.lobby.hidden = false;
  refs.roomCode.textContent = room.roomId;
  refs.memberList.replaceChildren();
  for (let index = 0; index < 2; index += 1) {
    const member = room.members[index];
    const card = document.createElement("div");
    card.className = `room-member${member ? "" : " is-empty"}`;
    card.innerHTML = member ? `
      <span class="room-member-avatar">${escapeHtml(member.username.slice(0, 1).toUpperCase())}</span>
      <span class="room-member-copy"><strong>${escapeHtml(member.username)}${member.isSelf ? "（あなた）" : ""}</strong><small>${member.role === "host" ? "ルームホスト" : "チャレンジャー"}</small></span>
      <span class="connection-dot${member.connected ? "" : " is-offline"}" title="${member.connected ? "接続中" : "再接続待ち"}"></span>` : `
      <span class="room-member-avatar">＋</span><span class="room-member-copy"><strong>対戦相手を待っています</strong><small>ルームコードを共有してください</small></span>`;
    refs.memberList.append(card);
  }
  refs.ruleSummary.innerHTML = [
    `${room.settings.digitLengths.map((value) => `${value}桁`).join("・")}`,
    `残機${room.settings.lives}`,
    `${room.settings.winsToFinish}勝先取`,
  ].map((text) => `<span>${text}</span>`).join("");
  const ready = room.members.length === 2;
  refs.startButton.hidden = !room.hostIsSelf;
  refs.startButton.disabled = !ready;
  refs.waitingText.className = `room-waiting-text${ready ? "" : " waiting-pulse"}`;
  refs.waitingText.textContent = ready
    ? room.hostIsSelf ? "2人揃いました。準備ができたら開始してください。" : "ホストが対戦を開始するのを待っています…"
    : "対戦相手を待っています";
}

function handleRoomState(nextRoom) {
  if (!nextRoom) return;
  room = nextRoom;
  if (room.status === "lobby") {
    cleanupOnlineGame();
    app.showScreen("online", { instant: true });
    renderLobby();
    return;
  }
  if (room.status === "playing") {
    refs.inactivity.hidden = true;
    mountOnlineGame();
    return;
  }
  if (room.status === "round_result") {
    mountOnlineGame({ locked: true });
    if (room.roundResult && resolvingRoundNumber !== room.roundResult.roundNumber) showRoundResult(room.roundResult);
    return;
  }
  if (room.status === "finished") {
    mountOnlineGame({ locked: true });
    if (room.matchResult) showMatchResult(room.matchResult);
  }
}

function mountOnlineGame({ locked = false } = {}) {
  if (!room?.currentProblem) return;
  app.prepareExternalGame();
  app.setExternalNavigationGuard(confirmLeaveDuringMatch);
  app.showScreen("game", { instant: true, force: true });
  refs.scoreboard.hidden = false;
  refs.modeLabel.textContent = "オンライン対戦";
  if (!calculator) {
    calculator = new TenCalculator(refs.calculatorMount, {
      problem: room.currentProblem,
      onActivity: registerActivity,
      onSubmit: submitExpression,
      onRetire: confirmRetire,
    });
    mountedProblem = room.currentProblem;
  } else if (mountedProblem !== room.currentProblem) {
    calculator.setProblem(room.currentProblem);
    mountedProblem = room.currentProblem;
    resolvingRoundNumber = null;
  }
  calculator.setLocked(locked);
  updateOnlineGameHeader();
  startTimer();
}

function updateOnlineGameHeader() {
  if (!room) return;
  refs.progress.textContent = `第${room.roundNumber}問 ／ ${room.settings.winsToFinish}勝先取`;
  refs.scoreboard.innerHTML = room.members.map((member, index) => `
    ${index === 1 ? '<span class="score-divider">VS</span>' : ""}
    <span class="score-player"><span>${escapeHtml(member.username)}${member.isSelf ? "・YOU" : ""}</span><strong>${member.wins}</strong></span>`).join("");
  const self = room.members.find((member) => member.isSelf);
  refs.lives.replaceChildren();
  for (let index = 0; index < room.settings.lives; index += 1) {
    const dot = document.createElement("span");
    dot.className = `life-dot${index >= Number(self?.lives || 0) ? " is-empty" : ""}`;
    refs.lives.append(dot);
  }
  refs.lives.setAttribute("aria-label", `残機${self?.lives || 0}`);
}

function startTimer() {
  stopTimer();
  const tick = () => {
    if (!room || room.status !== "playing") return;
    refs.timer.textContent = app.formatDuration(Date.now() - room.roundStartedAt, true);
    timerFrame = requestAnimationFrame(tick);
  };
  timerFrame = requestAnimationFrame(tick);
}

function stopTimer() {
  if (timerFrame) cancelAnimationFrame(timerFrame);
  timerFrame = null;
}

function registerActivity() {
  if (!room) return;
  refs.inactivity.hidden = true;
  connectSocket().emit("ten:activity", { roomId: room.roomId });
}

async function submitExpression(expression, instance) {
  if (!room) return;
  instance.setLocked(true);
  try {
    const response = await emitAck("ten:submit", { roomId: room.roomId, expression });
    if (response.correct) {
      instance.setResult("10 — SUCCESS", "ten");
      return;
    }
    if (response.expressionError) instance.setResult(response.expressionError.message, "error");
    else instance.setResult(`${app.formatResultValue(response.value)}　≠　10`, "error");
    room = response.room || room;
    updateOnlineGameHeader();
    if (room.status === "playing") instance.setLocked(false);
  } catch (error) {
    instance.setResult(error.payload?.expressionError?.message || "式を送信できませんでした。", "error");
    if (room?.status === "playing") instance.setLocked(false);
  }
}

function confirmRetire() {
  if (!room || room.status !== "playing") return;
  app.openModal(`
    <div class="result-icon is-failure">🏳️</div><h2 id="modalTitle">この問題をリタイアしますか？</h2>
    <p class="result-lead">残機が0になり、このラウンドは対戦相手の勝利になります。</p>
    <div class="modal-actions"><button class="modal-primary" type="button" data-online-retire>リタイアする</button><button class="modal-secondary" type="button" data-modal-close>続ける</button></div>`);
  document.querySelector("[data-online-retire]").onclick = async () => {
    app.closeModal();
    calculator?.setLocked(true);
    try { await emitAck("ten:retire", { roomId: room.roomId }); }
    catch { calculator?.setLocked(false); app.showToast("リタイア処理に失敗しました。", "warning"); }
  };
}

function roundReason(result) {
  if (result.reason === "made_ten") return `${result.winnerName}が10を作りました！`;
  if (result.reason === "lives_depleted") return `${result.loserName}の残機がなくなりました！`;
  if (result.reason === "retired") return `${result.loserName}がリタイアしました。`;
  return `${result.winnerName}の勝利です。`;
}

function showRoundResult(result) {
  if (!result || resolvingRoundNumber === result.roundNumber) return;
  resolvingRoundNumber = result.roundNumber;
  stopTimer();
  calculator?.setLocked(true);
  const self = room?.members.find((member) => member.isSelf);
  const won = result.winnerName === self?.username;
  app.openModal(`
    <div class="result-icon${won ? "" : " is-failure"}">${won ? "✓" : "×"}</div>
    <h2 id="modalTitle">${escapeHtml(roundReason(result))}</h2>
    <p class="result-lead">タイム ${app.formatDuration(result.answerTimeMs, true)}</p>
    ${result.expression ? `<div class="solution-card"><small>入力された式</small><div class="solution-expression">${escapeHtml(result.expression)}</div></div>` : ""}
    <div class="result-stats">${room.members.map((member) => `<div><strong>${member.wins}</strong><span>${escapeHtml(member.username)}</span></div>`).join("")}</div>
    <div class="modal-actions"><button class="modal-primary" type="button" data-online-next>次の試合へ</button><button class="modal-secondary" type="button" data-online-home>ホームに戻る</button></div>`, { closeable: false });
  const nextButton = document.querySelector("[data-online-next]");
  nextButton.onclick = async () => {
    nextButton.disabled = true;
    nextButton.textContent = "対戦相手を待っています…";
    try {
      const response = await emitAck("ten:ready-next", { roomId: room.roomId });
      room = response.room || room;
      if (room.status === "playing") app.closeModal(true);
    } catch { nextButton.disabled = false; nextButton.textContent = "次の試合へ"; }
  };
  document.querySelector("[data-online-home]").onclick = leaveRoom;
}

function showMatchResult(result) {
  if (!result) return;
  stopTimer();
  calculator?.setLocked(true);
  const self = room?.members.find((member) => member.isSelf);
  const escaped = result.reason === "opponent_escaped";
  const won = result.winnerName === self?.username;
  const title = escaped && won ? "対戦相手が逃げました" : won ? "MATCH WIN" : result.winnerName ? "MATCH LOSE" : "対戦終了";
  const scores = result.scores || room?.members?.map((member) => ({ username: member.username, wins: member.wins })) || [];
  app.openModal(`
    <div class="result-icon${won ? "" : " is-failure"}">${won ? "♛" : "×"}</div>
    <h2 id="modalTitle">${title}</h2>
    <p class="result-lead">${escaped ? `${escapeHtml(result.escapedName || "対戦相手")}の無操作が120秒続いたため、対戦を終了しました。` : `${escapeHtml(result.winnerName || "両者")}の最終結果です。`}</p>
    <div class="match-score-final">${scores.map((score) => `<div><span>${escapeHtml(score.username)}</span><strong>${score.wins}</strong><small>WIN</small></div>`).join('<b>—</b>')}</div>
    <div class="modal-actions"><button class="modal-primary" type="button" data-match-home>ホームに戻る</button></div>`, { closeable: false });
  document.querySelector("[data-match-home]").onclick = leaveRoom;
}

async function leaveRoom() {
  const currentRoomId = room?.roomId;
  if (currentRoomId) {
    try { await emitAck("ten:leave", { roomId: currentRoomId }); } catch {}
  }
  app.closeModal(true);
  cleanupOnlineGame();
  room = null;
  refs.lobby.hidden = true;
  refs.console.hidden = false;
  app.showScreen("online", { instant: true });
}

function confirmLeaveDuringMatch(targetScreen) {
  if (!room || !["playing", "round_result"].includes(room.status)) {
    app.finishExternalGame();
    app.showScreen(targetScreen, { force: true });
    return;
  }
  app.openModal(`
    <div class="result-icon is-failure">×</div><h2 id="modalTitle">対戦ルームを離れますか？</h2>
    <p class="result-lead">ホームへ戻るとルームは解散され、対戦相手も退出します。</p>
    <div class="modal-actions"><button class="modal-primary" type="button" data-confirm-online-leave>ルームを解散</button><button class="modal-secondary" type="button" data-modal-close>対戦を続ける</button></div>`);
  document.querySelector("[data-confirm-online-leave]").onclick = leaveRoom;
}

function cleanupOnlineGame() {
  stopTimer();
  calculator?.destroy();
  calculator = null;
  mountedProblem = "";
  resolvingRoundNumber = null;
  refs.scoreboard.hidden = true;
  refs.scoreboard.replaceChildren();
  refs.inactivity.hidden = true;
  app.finishExternalGame();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

for (const button of document.querySelectorAll("[data-online-tab]")) button.addEventListener("click", () => switchTab(button.dataset.onlineTab));
refs.loginButton.addEventListener("click", () => {
  sessionStorage.setItem("afterAuthRedirect", "/10を自由に");
  window.location.href = "/?openLogin=1";
});
refs.roomCodeInput.addEventListener("input", () => { refs.roomCodeInput.value = roomCodeFromInput(); });
refs.createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = selectedCreateSettings();
  if (!settings.digitLengths.length) return app.showToast("出題する桁数を1つ以上選んでください。", "warning");
  const submit = refs.createForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const data = await request("/api/ten-freely/online/rooms", { method: "POST", body: JSON.stringify({ settings }) });
    room = data.room;
    connectSocket();
    await joinSocketRoom(room.roomId);
  } catch (error) {
    console.error(error);
    app.showToast("ルームを作成できませんでした。", "warning");
  } finally { submit.disabled = false; }
});
refs.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const roomCode = roomCodeFromInput();
  if (roomCode.length !== 6) return app.showToast("6桁のルームコードを入力してください。", "warning");
  const submit = refs.joinForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const data = await request(`/api/ten-freely/online/rooms/${roomCode}/join`, { method: "POST", body: "{}" });
    room = data.room;
    connectSocket();
    await joinSocketRoom(room.roomId);
  } catch (error) {
    const message = error.message === "room_not_found" ? "ルームが見つかりません。" : error.message === "room_full" ? "このルームは満員です。" : "ルームに参加できませんでした。";
    app.showToast(message, "warning");
  } finally { submit.disabled = false; }
});
refs.copyCode.addEventListener("click", async () => {
  if (!room) return;
  try { await navigator.clipboard.writeText(room.roomId); app.showToast("ルームコードをコピーしました。", "success"); }
  catch { app.showToast(`ルームコードは ${room.roomId} です。`); }
});
refs.startButton.addEventListener("click", async () => {
  refs.startButton.disabled = true;
  try { await emitAck("ten:start", { roomId: room.roomId }); }
  catch (error) { refs.startButton.disabled = false; app.showToast(error.message === "room_not_ready" ? "対戦相手を待っています。" : "対戦を開始できませんでした。", "warning"); }
});
refs.leaveButton.addEventListener("click", leaveRoom);
for (const opener of document.querySelectorAll('[data-open-screen="online"]')) opener.addEventListener("click", initializeOnline);
window.addEventListener("ten-freely:screen-changed", (event) => {
  if (event.detail?.screen === "online") initializeOnline();
});
window.addEventListener("beforeunload", cleanupOnlineGame);
