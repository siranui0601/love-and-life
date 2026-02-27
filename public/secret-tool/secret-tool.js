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
};

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
  roomIdTextEl.textContent = room.roomId;
  memberListEl.innerHTML = "";

  for (const member of room.members || []) {
    const li = document.createElement("li");
    const roleLabel = member.role === "host" ? " (ホスト)" : "";
    li.textContent = `${member.name}${roleLabel}`;
    memberListEl.append(li);
  }

  const isHost = room.members.some((member) => member.id === userTrackingId && member.role === "host");
  const memberCount = room.members.length;

  startGameBtn.disabled = !(isHost && memberCount >= 2);
  deleteRoomBtn.classList.toggle("hidden", !isHost);
  leaveRoomBtn.classList.toggle("hidden", isHost);

  hideHomePanel();
  waitingRoomEl.classList.remove("hidden");
  waitingRoomEl.classList.add("note");
  waitingNoteEl.classList.remove("hidden");
}

function resetToLobbyState() {
  state.room = null;
  localStorage.removeItem("activeRoomId");
  showHomePanel();
  waitingRoomEl.classList.add("hidden");
  waitingNoteEl.classList.remove("hidden");
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
    setMessage("ルーム入室に失敗しました。");
  }
});

startGameBtn.addEventListener("click", () => {
  if (startGameBtn.disabled) return;
  setMessage("ゲーム開始準備中です...");
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

  if (room.status === "closed") {
    resetToLobbyState();
    setMessage("ルームが終了しました。");
    return;
  }

  showWaitingRoom(room);
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

socket.on("secret-tool:member-left", ({ roomId, name } = {}) => {
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!activeRoomId || activeRoomId !== roomId || !name) return;
  showToast(`${name}が退室しました`, 3000);
});

resetToLobbyState();
setMessage("ルームを作成するか、IDを入力して参加してください。");
