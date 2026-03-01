import { showToast } from "../toast.js";

const messageEl = document.getElementById("message");
const homePanelEl = document.getElementById("homePanel");
const waitingRoomEl = document.getElementById("waitingRoom");
const roomIdTextEl = document.getElementById("roomIdText");
const memberListEl = document.getElementById("memberList");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const backToTitleBtn = document.getElementById("backToTitleBtn");

const startGameBtn = document.getElementById("startGameBtn");
const deleteRoomBtn = document.getElementById("deleteRoomBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const waitingNoteEl = document.getElementById("waitingNote");

const battlePanelEl = document.getElementById("battlePanel");
const battlePhaseEl = document.getElementById("battlePhase");
const battleArenaEl = document.getElementById("battleArena");
const deckPocketEl = document.getElementById("deckPocket");
const battlePlayerListEl = document.getElementById("battlePlayerList");
const toggleBattleLogBtn = document.getElementById("toggleBattleLogBtn");
const closeBattleLogBtn = document.getElementById("closeBattleLogBtn");
const battleLogPanelEl = document.getElementById("battleLogPanel");
const mulliganPanelEl = document.getElementById("mulliganPanel");
const mulliganTopControlsEl = document.getElementById("mulliganTopControls");
const mulliganCounterEl = document.getElementById("mulliganCounter");
const finishMulliganBtn = document.getElementById("finishMulliganBtn");
const endTurnBtn = document.getElementById("endTurnBtn");
const toggleMulliganPanelBtn = document.getElementById("toggleMulliganPanelBtn");
const playerHandEl = document.getElementById("playerHand");
const battleLogEl = document.getElementById("battleLog");

const actionModalEl = document.getElementById("actionModal");
const actionModalTextEl = document.getElementById("actionModalText");
const actionYesBtn = document.getElementById("actionYesBtn");
const actionNoBtn = document.getElementById("actionNoBtn");

const infoModalEl = document.getElementById("infoModal");
const infoModalTextEl = document.getElementById("infoModalText");
const infoModalCloseBtn = document.getElementById("infoModalCloseBtn");

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("currentUser") || "null"); }
  catch { return null; }
}

const storedUser = getStoredUser();
if (!storedUser?.username || !storedUser?.userTrackingId) {
  alert("ひみつ道具バトルはログインが必要です");
  window.location.href = "/";
}

const username = storedUser.username;
const userTrackingId = storedUser.userTrackingId;

const socket = io({
  auth: {
    userTrackingId,
    username,
  }
});

const state = {
  room: null,
  modalOnYes: null,
  game: null,
  hand: [],
  selectedMulliganIds: new Set(),
  mulliganSubmitted: false,
  isMulliganPanelCollapsed: false,
  myHandContainer: null,
};

function getCardRoleLabel(type) {
  if (type === "installed") return "設置型";
  if (type === "counter") return "反撃型";
  return "手札型";
}

function getCardRoleClass(type) {
  if (type === "installed") return "installed";
  if (type === "counter") return "counter";
  return "hand";
}

function getLayoutRegions(playerCount) {
  if (playerCount === 2) return ["region-bottom", "region-top"];
  if (playerCount === 3) return ["region-bottom", "region-top-left", "region-top-right"];
  if (playerCount === 4) return ["region-bottom-left", "region-top-left", "region-top-right", "region-bottom-right"];
  return ["region-bottom"];
}

function setMessage(message) {
  messageEl.textContent = message;
}

function showHomePanel() {
  homePanelEl.classList.remove("hidden");
  homePanelEl.classList.remove("note");
}

function hideHomePanel() {
  homePanelEl.classList.add("hidden");
}

function showWaitingRoom(room) {
  state.room = room;
  const members = room.members || [];
  roomIdTextEl.textContent = room.roomId;
  memberListEl.innerHTML = "";

  for (const member of members) {
    const li = document.createElement("li");
    const roleLabel = member.role === "host" ? " (ホスト)" : "";
    li.textContent = `${member.name}${roleLabel}`;
    memberListEl.append(li);
  }

  const isHost = members.some((member) => member.id === userTrackingId && member.role === "host");
  const memberCount = members.length;

  startGameBtn.disabled = !(isHost && memberCount >= 2 && memberCount <= 4);
  deleteRoomBtn.classList.toggle("hidden", !isHost);
  leaveRoomBtn.classList.toggle("hidden", isHost);

  hideHomePanel();
  battlePanelEl.classList.add("hidden");
  waitingRoomEl.classList.remove("hidden");
  waitingRoomEl.classList.add("note");
  waitingNoteEl.classList.remove("hidden");
}

function showBattlePanel() {
  hideHomePanel();
  waitingRoomEl.classList.add("hidden");
  waitingNoteEl.classList.add("hidden");
  battlePanelEl.classList.remove("hidden");
}

function renderSeats() {
  const seats = state.game?.seatOrder || [];
  const playerStats = state.game?.playerStats || {};
  const mySeat = seats.find((seat) => seat.id === userTrackingId);
  const opponents = seats.filter((seat) => seat.id !== userTrackingId);
  const orderedSeats = mySeat ? [mySeat, ...opponents] : seats;
  const regions = getLayoutRegions(orderedSeats.length);

  battleArenaEl.className = `battle-arena players-${Math.max(2, Math.min(4, orderedSeats.length))}`;
  battlePlayerListEl.innerHTML = "";
  state.myHandContainer = null;

  orderedSeats.forEach((seat, index) => {
    const stats = playerStats[seat.id] || {};
    const row = document.createElement("li");
    row.className = `battle-player-row ${regions[index] || ""}`;
    const isParent = seat.id === state.game?.parentId;
    const isSelf = seat.id === userTrackingId;
    if (stats.active === false) {
      row.classList.add("inactive");
    }
    if (isSelf) {
      row.classList.add("self");
    }

    const header = document.createElement("div");
    header.className = "player-header";

    const hp = document.createElement("span");
    hp.className = "player-hp";
    hp.textContent = `♡×${Number(stats.hearts || 10)}`;

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = `${seat.name || "プレイヤー"}${isSelf ? "（あなた）" : ""}${isParent ? " 👑" : ""}`;

    header.append(name, hp);

    const handZone = document.createElement("div");
    handZone.className = "player-hand-zone";
    handZone.setAttribute("aria-label", `${seat.name || "プレイヤー"}の手札`);

    const handCount = Math.max(0, Number(stats.handCount || 0));
    if (isSelf) {
      handZone.id = "myBattleHand";
      state.myHandContainer = handZone;
    } else {
      for (let i = 0; i < handCount; i += 1) {
        const hiddenCard = document.createElement("div");
        hiddenCard.className = "mini-card hidden";
        hiddenCard.textContent = "🎴";
        handZone.append(hiddenCard);
      }
    }

    const equipmentZone = document.createElement("div");
    equipmentZone.className = "player-equipment-zone";
    equipmentZone.setAttribute("aria-label", "設置枠");
    const slotCount = Math.max(3, Number(stats.installedCount || 0) + 2);
    for (let i = 0; i < slotCount; i += 1) {
      const slot = document.createElement("span");
      const isFilled = i < Number(stats.installedCount || 0);
      slot.className = `equipment-slot ${isFilled ? "filled" : "empty"}`;
      slot.textContent = isFilled ? "🛠" : "＋";
      equipmentZone.append(slot);
    }

    const zone = document.createElement("span");
    zone.className = "player-trash";
    zone.setAttribute("aria-label", "四次元くずかご");
    zone.textContent = `🗑 ${Number(stats.trashCount || 0)}`;

    row.append(header, handZone, equipmentZone, zone);
    battlePlayerListEl.append(row);
  });

  battleLogEl.innerHTML = (state.game?.logs || []).map((log) => `<div>${log}</div>`).join("");
  battleLogEl.scrollTop = battleLogEl.scrollHeight;
}

function createHandCardEl(card = {}) {
  const cardEl = document.createElement("button");
  cardEl.type = "button";
  cardEl.className = "hand-card";
  cardEl.dataset.handId = card.handId;

  if (state.selectedMulliganIds.has(card.handId)) {
    cardEl.classList.add("selected");
  }

  cardEl.innerHTML = `
    <div class="hand-card-role ${getCardRoleClass(card.type)}">${getCardRoleLabel(card.type)}</div>
    <div class="hand-card-name">${card.name || "カード"}</div>
    <div class="hand-card-effect">${card.text || card.type || "効果なし"}</div>
    <div class="hand-card-flavor">${card.flavor || ""}</div>
  `;

  const isMulligan = state.game?.phase === "mulligan";
  const isInGame = state.game?.phase === "in_game";
  const canPlay = isInGame && state.game?.currentTurnPlayerId === userTrackingId;
  cardEl.disabled = (isMulligan && state.mulliganSubmitted) || (!isMulligan && !canPlay);
  cardEl.addEventListener("click", () => {
    const { handId } = cardEl.dataset;
    if (!handId) return;

    if (isMulligan) {
      if (state.mulliganSubmitted) return;
      if (state.selectedMulliganIds.has(handId)) {
        state.selectedMulliganIds.delete(handId);
      } else {
        if (state.selectedMulliganIds.size >= 3) return;
        state.selectedMulliganIds.add(handId);
      }
      renderHand();
      return;
    }

    if (canPlay) {
      socket.emit("secret-tool:play-card", { roomId: state.room?.roomId, handId });
    }
  });

  return cardEl;
}

function renderHand() {
  const cards = state.hand || [];
  const isMulligan = state.game?.phase === "mulligan";
  const handContainer = state.myHandContainer || playerHandEl;

  handContainer.innerHTML = "";
  cards.forEach((card) => {
    handContainer.append(createHandCardEl(card));
  });

  if (isMulligan) {
    mulliganCounterEl.textContent = `${state.selectedMulliganIds.size}/3 枚選択中`;
  }
  finishMulliganBtn.disabled = state.mulliganSubmitted || !isMulligan;
  endTurnBtn.disabled = !(state.game?.phase === "in_game" && state.game?.currentTurnPlayerId === userTrackingId && state.game?.drewThisTurn);
  deckPocketEl.classList.toggle("deal", isMulligan);
}

function renderMulliganPanelVisibility() {
  mulliganPanelEl.classList.toggle("collapsed", state.isMulliganPanelCollapsed);
  toggleMulliganPanelBtn.textContent = state.isMulliganPanelCollapsed ? "手札を表示" : "手札をたたむ";
}

function renderBattleState() {
  if (!state.game) return;
  showBattlePanel();
  renderSeats();
  renderHand();
  const currentTurn = state.game.turnOrder?.find((player) => player.id === state.game.currentTurnPlayerId);
  const isMyTurn = state.game.currentTurnPlayerId && state.game.currentTurnPlayerId === userTrackingId;
  deckPocketEl.classList.toggle("can-draw", Boolean(isMyTurn && state.game.phase === "in_game" && !state.game?.drewThisTurn));

  if (state.game.phase === "mulligan") {
    battlePhaseEl.textContent = "カードを3枚まで選んで交換できます。最初に終えた人が親です。";
    battlePhaseEl.classList.remove("your-turn");
    mulliganTopControlsEl.classList.remove("hidden");
    mulliganTopControlsEl.classList.remove("as-note");
    finishMulliganBtn.classList.remove("hidden");
    endTurnBtn.classList.add("hidden");
    mulliganPanelEl.classList.add("hidden");
  } else {
    if (isMyTurn) {
      battlePhaseEl.textContent = state.game?.drewThisTurn
        ? "あなたの番です。カードを好きなだけ使用してターンを終了してください。"
        : "あなたの番です。まず四次元ポケットから1枚ドローしてください。";
      battlePhaseEl.classList.add("your-turn");
    } else {
      battlePhaseEl.textContent = `${currentTurn?.name || "プレイヤー"}の番です！`;
      battlePhaseEl.classList.remove("your-turn");
    }

    mulliganTopControlsEl.classList.remove("hidden");
    mulliganTopControlsEl.classList.add("as-note");
    mulliganCounterEl.textContent = "手札のカードをタップで使用します（効果は自動反映）。";
    finishMulliganBtn.classList.add("hidden");
    endTurnBtn.classList.remove("hidden");
    toggleMulliganPanelBtn.classList.add("hidden");
    mulliganPanelEl.classList.add("hidden");
    deckPocketEl.classList.remove("deal");
  }
}

function resetToLobbyState({ clearActiveRoom = true } = {}) {
  state.room = null;
  state.game = null;
  state.hand = [];
  state.selectedMulliganIds = new Set();
  state.mulliganSubmitted = false;
  state.isMulliganPanelCollapsed = false;
  if (clearActiveRoom) {
    localStorage.removeItem("activeRoomId");
  }
  showHomePanel();
  waitingRoomEl.classList.add("hidden");
  battlePanelEl.classList.add("hidden");
  waitingNoteEl.classList.remove("hidden");
}

async function fetchRoom(roomId) {
  const response = await fetch(`/api/secret-tool/rooms/${encodeURIComponent(roomId)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "request_failed");
  }
  return payload;
}

async function restoreActiveRoomIfExists() {
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!activeRoomId) {
    resetToLobbyState({ clearActiveRoom: false });
    setMessage("ルームを作成するか、IDを入力して参加してください。");
    return;
  }

  setMessage("ルームを再接続中...");
  try {
    const room = await fetchRoom(activeRoomId);
    const joined = (room.members || []).some((member) => member.id === userTrackingId);

    if (!joined) {
      resetToLobbyState();
      setMessage("前回のルームには再接続できませんでした。");
      return;
    }

    socket.emit("secret-tool:join-room", { roomId: room.roomId });
    socket.emit("secret-tool:sync-room", { roomId: room.roomId });
    if (room.status === "lobby") {
      showWaitingRoom(room);
    } else {
      showBattlePanel();
    }
    setMessage(`ルーム ${room.roomId} に再接続しました。`);
  } catch (error) {
    resetToLobbyState();
    if (error.message === "room_not_found") {
      setMessage("前回のルームは見つかりませんでした。");
      return;
    }
    setMessage("ルームの再接続に失敗しました。");
  }
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "request_failed");
  }
  return payload;
}

function openConfirmModal(message, onYes) {
  state.modalOnYes = onYes;
  actionModalTextEl.textContent = message;
  actionModalEl.classList.remove("hidden");
}

function closeConfirmModal() {
  actionModalEl.classList.add("hidden");
  state.modalOnYes = null;
}

function openInfoModal(message) {
  infoModalTextEl.textContent = message;
  infoModalEl.classList.remove("hidden");
}

createRoomBtn.addEventListener("click", async () => {
  setMessage("ルーム作成中...");
  try {
    const room = await requestJson("/api/secret-tool/rooms/create", { username, userTrackingId });
    localStorage.setItem("activeRoomId", room.roomId);
    socket.emit("secret-tool:join-room", { roomId: room.roomId });
    showWaitingRoom(room);
    setMessage(`ルーム ${room.roomId} を作成しました！`);
  } catch {
    setMessage("ルーム作成に失敗しました。");
  }
});

joinRoomBtn.addEventListener("click", async () => {
  const roomId = window.prompt("6桁のルームIDを入力してください");
  if (!roomId) return;

  setMessage("ルーム入室中...");
  try {
    const room = await requestJson("/api/secret-tool/rooms/join", {
      roomId: roomId.trim(),
      username,
      userTrackingId,
    });
    localStorage.setItem("activeRoomId", room.roomId);
    socket.emit("secret-tool:join-room", { roomId: room.roomId, announceJoin: true });
    showWaitingRoom(room);
    setMessage(`ルーム ${room.roomId} に入室しました！`);
  } catch (error) {
    if (error.message === "room_not_found") {
      setMessage("ルームが見つかりません。");
      return;
    }
    if (error.message === "room_not_lobby") {
      setMessage("このルームは入室できません。");
      return;
    }
    if (error.message === "room_full") {
      setMessage("このルームは満員です（最大4人）。");
      return;
    }
    setMessage("ルーム入室に失敗しました。");
  }
});

startGameBtn.addEventListener("click", () => {
  if (startGameBtn.disabled || !state.room?.roomId) return;
  socket.emit("secret-tool:start-game", { roomId: state.room.roomId });
  setMessage("ゲーム開始を送信しました。");
});

finishMulliganBtn.addEventListener("click", () => {
  if (!state.room?.roomId || state.mulliganSubmitted || !state.game || state.game.phase !== "mulligan") return;
  state.mulliganSubmitted = true;
  renderHand();
  socket.emit("secret-tool:mulligan-finish", {
    roomId: state.room.roomId,
    selectedHandIds: Array.from(state.selectedMulliganIds),
  });
});

deckPocketEl.addEventListener("click", () => {
  if (!state.room?.roomId || !state.game || state.game.phase !== "in_game") return;
  if (state.game.currentTurnPlayerId !== userTrackingId) return;
  socket.emit("secret-tool:draw-card", { roomId: state.room.roomId });
});

endTurnBtn.addEventListener("click", () => {
  if (!state.room?.roomId || !state.game || state.game.phase !== "in_game") return;
  if (state.game.currentTurnPlayerId !== userTrackingId) return;
  socket.emit("secret-tool:end-turn", { roomId: state.room.roomId });
});

toggleMulliganPanelBtn.addEventListener("click", () => {
  state.isMulliganPanelCollapsed = !state.isMulliganPanelCollapsed;
  renderMulliganPanelVisibility();
});

toggleBattleLogBtn.addEventListener("click", () => {
  battleLogPanelEl.classList.remove("hidden");
});

closeBattleLogBtn.addEventListener("click", () => {
  battleLogPanelEl.classList.add("hidden");
});

deleteRoomBtn.addEventListener("click", () => {
  const roomId = state.room?.roomId;
  if (!roomId) return;

  openConfirmModal("本当にルームを削除しますか？", async () => {
    try {
      await requestJson("/api/secret-tool/rooms/delete", { roomId, userTrackingId });
      resetToLobbyState();
      setMessage("ルームを削除しました。");
    } catch {
      setMessage("ルーム削除に失敗しました。");
    }
  });
});

leaveRoomBtn.addEventListener("click", () => {
  const roomId = state.room?.roomId;
  if (!roomId) return;

  openConfirmModal("本当にルームを抜けますか？", () => {
    socket.emit("secret-tool:leave-room");
    resetToLobbyState();
    setMessage("ルームを退室しました。");
  });
});

backToTitleBtn.addEventListener("click", () => {
  openConfirmModal("本当に戻りますか？", () => {
    const roomId = localStorage.getItem("activeRoomId");
    if (roomId) {
      socket.emit("secret-tool:leave-room");
      localStorage.removeItem("activeRoomId");
    }
    window.location.href = "/";
  });
});

actionNoBtn.addEventListener("click", closeConfirmModal);

actionYesBtn.addEventListener("click", async () => {
  const onYes = state.modalOnYes;
  closeConfirmModal();
  if (!onYes) return;
  await onYes();
});

infoModalCloseBtn.addEventListener("click", () => {
  infoModalEl.classList.add("hidden");
});

socket.on("secret-tool:members-updated", (room) => {
  if (!room?.roomId) return;
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!activeRoomId || activeRoomId !== room.roomId) return;

  state.room = room;
  if (room.status === "closed") {
    resetToLobbyState();
    setMessage("ルームが終了しました。");
    return;
  }

  if (room.status === "lobby") {
    showWaitingRoom(room);
  } else {
    showBattlePanel();
  }
});

socket.on("secret-tool:game-started", ({ roomId } = {}) => {
  if (!roomId) return;
  setMessage("ゲームが開始されました。カード配布中...");
  showBattlePanel();
});

socket.on("secret-tool:game-state", (gameState) => {
  if (!gameState) return;
  state.game = gameState;
  if (gameState.phase !== "mulligan") {
    state.mulliganSubmitted = true;
    state.selectedMulliganIds = new Set();
    state.isMulliganPanelCollapsed = false;
  }
  renderBattleState();
});

socket.on("secret-tool:your-hand", ({ cards = [] } = {}) => {
  state.hand = cards;
  renderHand();
});

socket.on("secret-tool:mulligan-player-finished", ({ playerId, returnedCount } = {}) => {
  if (!playerId || playerId === userTrackingId) return;
  showToast(`他プレイヤーがマリガンを完了（${returnedCount}枚交換）`, 2500);
});

socket.on("secret-tool:mulligan-completed", ({ parentId, turnOrder = [] } = {}) => {
  const parentName = (turnOrder.find((player) => player.id === parentId) || {}).name || "プレイヤー";
  setMessage(`マリガン終了。親は${parentName}です。`);
});

socket.on("secret-tool:room-deleted", ({ roomId } = {}) => {
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!roomId || activeRoomId !== roomId) return;

  const isGuest = !(state.room?.members || []).some((member) => member.id === userTrackingId && member.role === "host");
  resetToLobbyState();
  if (isGuest) {
    openInfoModal("ホストがルームを削除しました");
  }
  setMessage("待機部屋に戻りました。");
});

socket.on("secret-tool:member-joined", ({ roomId, name } = {}) => {
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!activeRoomId || activeRoomId !== roomId || !name) return;
  showToast(`${name}が参加しました`, 3000);
});

socket.on("secret-tool:member-left", ({ roomId, id, name } = {}) => {
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!activeRoomId || activeRoomId !== roomId || !name) return;

  if (state.room?.roomId === roomId) {
    const filteredMembers = (state.room.members || []).filter((member) => {
      if (id) return member.id !== id;
      return member.name !== name;
    });
    state.room = { ...state.room, members: filteredMembers };
    if (state.room.status === "lobby") {
      showWaitingRoom(state.room);
    }
  }

  showToast(`${name}が退室しました`, 3000);
});

socket.on("connect", () => {
  restoreActiveRoomIfExists();
});
