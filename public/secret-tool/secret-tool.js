const messageEl = document.getElementById("message");
const waitingRoomEl = document.getElementById("waitingRoom");
const roomIdTextEl = document.getElementById("roomIdText");
const memberListEl = document.getElementById("memberList");
const confirmModalEl = document.getElementById("confirmModal");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const backToTitleBtn = document.getElementById("backToTitleBtn");
const confirmYesBtn = document.getElementById("confirmYesBtn");
const confirmNoBtn = document.getElementById("confirmNoBtn");

/*const username = window.currentUser?.username ?? "guest";

let clientId = localStorage.getItem("clientId");
if (!clientId) {
  clientId = crypto.randomUUID();
  localStorage.setItem("clientId", clientId);
}

const socket = io({
  auth: {
    clientId,
    username: window.currentUser?.username ?? "guest",
    roomId: localStorage.getItem("activeRoomId") ?? null,
  }
});*/

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
const clientId = storedUser.userTrackingId; // ★ UsersのD列を主体にする

const socket = io({
  auth: {
    clientId,
    username,
    roomId: localStorage.getItem("activeRoomId") ?? null,
  }
});


function setMessage(message) {
  messageEl.textContent = message;
}

function renderMembers(room) {
  if (!room) return;
  roomIdTextEl.textContent = room.roomId;
  memberListEl.innerHTML = "";

  for (const member of room.members || []) {
    const li = document.createElement("li");
    const roleLabel = member.role === "host" ? " (ホスト)" : "";
    li.textContent = `${member.name}${roleLabel}`;
    memberListEl.append(li);
  }

  waitingRoomEl.classList.remove("hidden");
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

createRoomBtn.addEventListener("click", async () => {
  setMessage("ルーム作成中...");
  try {
    const room = await requestJson("/api/secret-tool/rooms/create", { username, clientId });
    localStorage.setItem("activeRoomId", room.roomId);
    socket.emit("secret-tool:join-room", { roomId: room.roomId });
    renderMembers(room);
    setMessage(`ルーム ${room.roomId} を作成しました！`);
  } catch (error) {
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
      clientId,
    });
    localStorage.setItem("activeRoomId", room.roomId);
    socket.emit("secret-tool:join-room", { roomId: room.roomId });
    renderMembers(room);
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

backToTitleBtn.addEventListener("click", () => {
  confirmModalEl.classList.remove("hidden");
});

confirmNoBtn.addEventListener("click", () => {
  confirmModalEl.classList.add("hidden");
});

confirmYesBtn.addEventListener("click", () => {
  const roomId = localStorage.getItem("activeRoomId");
  if (roomId) {
    socket.emit("secret-tool:leave-room");
    localStorage.removeItem("activeRoomId");
  }
  window.location.href = "/";
});

socket.on("connect", () => {
  const roomId = localStorage.getItem("activeRoomId");
  if (!roomId) return;
  socket.emit("secret-tool:join-room", { roomId });
  socket.emit("secret-tool:sync-room", { roomId });
});

socket.on("secret-tool:members-updated", (room) => {
  if (!room?.roomId) return;
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (activeRoomId && activeRoomId !== room.roomId) return;

  if (room.status === "closed") {
    waitingRoomEl.classList.add("hidden");
    localStorage.removeItem("activeRoomId");
    setMessage("ルームが終了しました。");
    return;
  }

  renderMembers(room);
});
