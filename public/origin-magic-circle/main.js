const refs = {
  message: document.getElementById("message"),
  homePanel: document.getElementById("homePanel"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  backToTitleBtn: document.getElementById("backToTitleBtn"),
  waitingRoom: document.getElementById("waitingRoom"),
  waitingNote: document.getElementById("waitingNote"),
  roomIdText: document.getElementById("roomIdText"),
  memberList: document.getElementById("memberList"),
  startGameBtn: document.getElementById("startGameBtn"),
  deleteRoomBtn: document.getElementById("deleteRoomBtn"),
  leaveRoomBtn: document.getElementById("leaveRoomBtn"),
};

const user = JSON.parse(localStorage.getItem("currentUser") || "null");
const username = String(user?.username || "ゲスト");
const userTrackingId = String(user?.userTrackingId || "");

let currentRoom = null;
let refreshTimer = null;
const ACTIVE_ROOM_STORAGE_KEY = "originMagicCircleActiveRoomId";

function setMessage(text) {
  refs.message.textContent = text || "";
}

function showHomePanel() {
  refs.homePanel?.classList.remove("hidden");
}

function hideHomePanel() {
  refs.homePanel?.classList.add("hidden");
}

function saveActiveRoomId(roomId) {
  if (!roomId) return;
  localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, roomId);
}

function clearActiveRoomId() {
  localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
}

function showWaitingRoom(room) {
  currentRoom = room;
  hideHomePanel();
  refs.waitingRoom.classList.remove("hidden");
  refs.waitingNote.classList.add("hidden");
  refs.roomIdText.textContent = room.roomId;
  refs.memberList.innerHTML = "";

  const isHost = room.members.some((member) => member.id === userTrackingId && member.role === "host");
  room.members.forEach((member) => {
    const li = document.createElement("li");
    li.textContent = `${member.name}${member.role === "host" ? "（ホスト）" : ""}`;
    refs.memberList.appendChild(li);
  });

  refs.startGameBtn.disabled = !isHost || room.members.length !== 2;
  refs.deleteRoomBtn.classList.toggle("hidden", !isHost);
  refs.leaveRoomBtn.classList.toggle("hidden", isHost);
}

async function callApi(path, body = undefined, method = "GET") {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data;
}

async function refreshRoom() {
  if (!currentRoom?.roomId) return;
  try {
    const room = await callApi(`/api/origin-magic-circle/rooms/${encodeURIComponent(currentRoom.roomId)}`);
    showWaitingRoom(room);
  } catch {
    stopRefresh();
    clearActiveRoomId();
    currentRoom = null;
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    setMessage("ルームが見つかりませんでした。再作成してください。");
  }
}

function startRefresh() {
  stopRefresh();
  refreshTimer = setInterval(refreshRoom, 2500);
}

function stopRefresh() {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

refs.createRoomBtn?.addEventListener("click", async () => {
  if (!userTrackingId) {
    alert("ログイン情報が見つかりません。タイトルに戻って再ログインしてください。");
    return;
  }

  try {
    const room = await callApi("/api/origin-magic-circle/rooms/create", { username, userTrackingId }, "POST");
    saveActiveRoomId(room.roomId);
    showWaitingRoom(room);
    setMessage("ルームを作成しました。対戦相手の入室を待ってください。");
    startRefresh();
  } catch (error) {
    setMessage(`ルーム作成に失敗しました: ${error.message}`);
  }
});

refs.joinRoomBtn?.addEventListener("click", async () => {
  if (!userTrackingId) {
    alert("ログイン情報が見つかりません。タイトルに戻って再ログインしてください。");
    return;
  }
  const roomId = prompt("6桁のルームIDを入力してください");
  if (!roomId) return;

  try {
    const room = await callApi("/api/origin-magic-circle/rooms/join", { roomId, username, userTrackingId }, "POST");
    saveActiveRoomId(room.roomId);
    showWaitingRoom(room);
    setMessage("ルームに入室しました。");
    startRefresh();
  } catch (error) {
    if (error.message === "room_full") {
      setMessage("このルームは満員です（最大2名）。");
      return;
    }
    setMessage(`入室に失敗しました: ${error.message}`);
  }
});

refs.deleteRoomBtn?.addEventListener("click", async () => {
  if (!currentRoom?.roomId) return;
  try {
    await callApi("/api/origin-magic-circle/rooms/delete", { roomId: currentRoom.roomId, userTrackingId }, "POST");
    stopRefresh();
    clearActiveRoomId();
    currentRoom = null;
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    setMessage("ルームを削除しました。");
  } catch (error) {
    setMessage(`ルーム削除に失敗しました: ${error.message}`);
  }
});

refs.leaveRoomBtn?.addEventListener("click", async () => {
  if (!currentRoom?.roomId) return;
  try {
    await callApi("/api/origin-magic-circle/rooms/leave", { roomId: currentRoom.roomId, userTrackingId }, "POST");
    stopRefresh();
    clearActiveRoomId();
    currentRoom = null;
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    setMessage("ルームを退出しました。");
  } catch (error) {
    setMessage(`ルーム退出に失敗しました: ${error.message}`);
  }
});

refs.startGameBtn?.addEventListener("click", () => {
  alert("作成中...");
});

refs.backToTitleBtn?.addEventListener("click", () => {
  window.location.href = "/";
});

async function restoreActiveRoomIfExists() {
  const activeRoomId = localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
  if (!activeRoomId) {
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    return;
  }

  setMessage("前回の待機部屋に再接続中...");
  try {
    const room = await callApi(`/api/origin-magic-circle/rooms/${encodeURIComponent(activeRoomId)}`);
    const joined = room.members?.some((member) => member.id === userTrackingId);

    if (!joined) {
      clearActiveRoomId();
      showHomePanel();
      refs.waitingRoom.classList.add("hidden");
      refs.waitingNote.classList.remove("hidden");
      setMessage("前回の待機部屋には再接続できませんでした。");
      return;
    }

    showWaitingRoom(room);
    startRefresh();
    setMessage(`ルーム ${room.roomId} に再接続しました。`);
  } catch (error) {
    clearActiveRoomId();
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    if (error.message === "room_not_found") {
      setMessage("前回の待機部屋は見つかりませんでした。");
      return;
    }
    setMessage("待機部屋の再接続に失敗しました。");
  }
}

restoreActiveRoomIfExists();
