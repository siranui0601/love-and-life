import path from "path";
import {
  cleanupExpiredSecretToolRooms,
  createSecretToolRoom,
  getSecretToolRoomById,
  removeSecretToolMember,
  joinSecretToolRoom,
} from "../../foundation/sheets.js";

const PENDING_LEAVE_GRACE_MS = 60 * 1000;
const pendingLeave = new Map();
const activeSocketsByTrackingId = new Map();

function addActiveSocket(userTrackingId, socketId) {
  const normalizedTrackingId = String(userTrackingId || "").trim();
  const normalizedSocketId = String(socketId || "").trim();
  if (!normalizedTrackingId || !normalizedSocketId) return;

  let socketIdSet = activeSocketsByTrackingId.get(normalizedTrackingId);
  if (!socketIdSet) {
    socketIdSet = new Set();
    activeSocketsByTrackingId.set(normalizedTrackingId, socketIdSet);
  }
  socketIdSet.add(normalizedSocketId);
}

function removeActiveSocket(userTrackingId, socketId) {
  const normalizedTrackingId = String(userTrackingId || "").trim();
  const normalizedSocketId = String(socketId || "").trim();
  if (!normalizedTrackingId || !normalizedSocketId) return;

  const socketIdSet = activeSocketsByTrackingId.get(normalizedTrackingId);
  if (!socketIdSet) return;

  socketIdSet.delete(normalizedSocketId);
  if (!socketIdSet.size) {
    activeSocketsByTrackingId.delete(normalizedTrackingId);
  }
}

function hasActiveSocket(userTrackingId) {
  const normalizedTrackingId = String(userTrackingId || "").trim();
  if (!normalizedTrackingId) return false;
  const socketIdSet = activeSocketsByTrackingId.get(normalizedTrackingId);
  return Boolean(socketIdSet && socketIdSet.size > 0);
}

function getPendingLeaveRoomMap(roomId) {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) return null;

  let roomMap = pendingLeave.get(normalizedRoomId);
  if (!roomMap) {
    roomMap = new Map();
    pendingLeave.set(normalizedRoomId, roomMap);
  }

  return roomMap;
}

export function cancelPendingLeave(roomId, userTrackingId) {
  const normalizedRoomId = String(roomId || "").trim();
  const normalizedTrackingId = String(userTrackingId || "").trim();
  if (!normalizedRoomId || !normalizedTrackingId) return false;

  const roomMap = pendingLeave.get(normalizedRoomId);
  if (!roomMap) return false;

  const timeoutId = roomMap.get(normalizedTrackingId);
  if (!timeoutId) return false;

  clearTimeout(timeoutId);
  roomMap.delete(normalizedTrackingId);

  if (!roomMap.size) {
    pendingLeave.delete(normalizedRoomId);
  }

  return true;
}

export function schedulePendingLeave(roomId, userTrackingId, callback) {
  const normalizedRoomId = String(roomId || "").trim();
  const normalizedTrackingId = String(userTrackingId || "").trim();
  if (!normalizedRoomId || !normalizedTrackingId) return null;

  cancelPendingLeave(normalizedRoomId, normalizedTrackingId);
  const roomMap = getPendingLeaveRoomMap(normalizedRoomId);
  if (!roomMap) return null;

  const timeoutId = setTimeout(async () => {
    const latestRoomMap = pendingLeave.get(normalizedRoomId);
    const latestTimeoutId = latestRoomMap?.get(normalizedTrackingId);
    if (latestTimeoutId !== timeoutId) return;

    latestRoomMap.delete(normalizedTrackingId);
    if (!latestRoomMap.size) {
      pendingLeave.delete(normalizedRoomId);
    }

    await callback();
  }, PENDING_LEAVE_GRACE_MS);

  roomMap.set(normalizedTrackingId, timeoutId);
  return timeoutId;
}

function secretSocketRoom(roomId) {
  return `secret-tool:${String(roomId || "").trim()}`;
}

export function mountSecretToolRoutes(app, io) {
  const secretToolPath = "/ひみつ道具バトル";
  const encodedPath = encodeURI(secretToolPath);
  const htmlPath = path.join(process.cwd(), "public/secret-tool/index.html");

  app.get(secretToolPath, (_req, res) => {
    res.sendFile(htmlPath);
  });

  app.get(encodedPath, (_req, res) => {
    res.sendFile(htmlPath);
  });

  app.post("/api/secret-tool/rooms/create", async (req, res) => {
    const username = String(req.body?.username || "guest").trim() || "guest";
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();

    if (!userTrackingId) {
      return res.status(400).json({ error: "userTrackingId is required" });
    }

    try {
      const room = await createSecretToolRoom({ username, clientId: userTrackingId });
      io.to(secretSocketRoom(room.roomId)).emit("secret-tool:members-updated", room);
      return res.json(room);
    } catch (error) {
      console.error("[secret-tool] create room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/secret-tool/rooms/join", async (req, res) => {
    const username = String(req.body?.username || "guest").trim() || "guest";
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();
    const roomId = String(req.body?.roomId || "").trim();

    if (!userTrackingId || !roomId) {
      return res.status(400).json({ error: "userTrackingId and roomId are required" });
    }

    try {
      const room = await joinSecretToolRoom({ username, clientId: userTrackingId, roomId });
      io.to(secretSocketRoom(room.roomId)).emit("secret-tool:members-updated", room);
      return res.json(room);
    } catch (error) {
      if (error.message === "room_not_found") {
        return res.status(404).json({ error: "room_not_found" });
      }
      if (error.message === "room_not_lobby") {
        return res.status(409).json({ error: "room_not_lobby" });
      }
      console.error("[secret-tool] join room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/secret-tool/rooms/:roomId", async (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    if (!roomId) {
      return res.status(400).json({ error: "roomId is required" });
    }

    try {
      const room = await getSecretToolRoomById(roomId);
      if (!room) return res.status(404).json({ error: "room_not_found" });
      return res.json(room);
    } catch (error) {
      console.error("[secret-tool] get room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });
}

export function registerSecretToolSocketHandlers(socket, io) {
  const auth = socket.handshake.auth || {};
  socket.data.clientId = String(auth.clientId || auth.userTrackingId || socket.data.clientId || "").trim();
  socket.data.username = String(auth.username || socket.data.username || "guest").trim() || "guest";
  socket.data.roomId = String(auth.roomId || socket.data.roomId || "").trim() || null;

  const userTrackingId = String(socket.data.clientId || "").trim();
  if (userTrackingId) {
    addActiveSocket(userTrackingId, socket.id);
    if (socket.data.roomId) {
      cancelPendingLeave(socket.data.roomId, userTrackingId);
    }
  }

  socket.on("secret-tool:join-room", async ({ roomId } = {}) => {
    const normalizedRoomId = String(roomId || socket.data.roomId || "").trim();
    const currentUserTrackingId = String(socket.data.clientId || "").trim();
    const username = String(socket.data.username || "guest").trim() || "guest";
    if (!normalizedRoomId || !currentUserTrackingId) return;

    cancelPendingLeave(normalizedRoomId, currentUserTrackingId);
    socket.join(secretSocketRoom(normalizedRoomId));
    socket.data.secretToolRoomId = normalizedRoomId;
    socket.data.roomId = normalizedRoomId;

    try {
      const room = await joinSecretToolRoom({ roomId: normalizedRoomId, username, clientId: currentUserTrackingId });
      io.to(secretSocketRoom(normalizedRoomId)).emit("secret-tool:members-updated", room);
    } catch (error) {
      if (error.message !== "room_not_found" && error.message !== "room_not_lobby") {
        console.error("[secret-tool] join-room socket error:", error);
      }
    }
  });

  socket.on("secret-tool:leave-room", async () => {
    const roomId = String(socket.data.secretToolRoomId || "").trim();
    const currentUserTrackingId = String(socket.data.clientId || "").trim();
    if (!roomId || !currentUserTrackingId) return;

    cancelPendingLeave(roomId, currentUserTrackingId);
    const updated = await removeSecretToolMember({ roomId, clientId: currentUserTrackingId });
    socket.leave(secretSocketRoom(roomId));
    socket.data.secretToolRoomId = null;

    if (updated) {
      io.to(secretSocketRoom(roomId)).emit("secret-tool:members-updated", updated);
    }
  });

  socket.on("disconnect", () => {
    const roomId = String(socket.data.secretToolRoomId || socket.data.roomId || "").trim();
    const currentUserTrackingId = String(socket.data.clientId || "").trim();
    if (!currentUserTrackingId) return;

    removeActiveSocket(currentUserTrackingId, socket.id);
    if (!roomId) return;

    schedulePendingLeave(roomId, currentUserTrackingId, async () => {
      if (hasActiveSocket(currentUserTrackingId)) return;

      const updated = await removeSecretToolMember({ roomId, clientId: currentUserTrackingId });
      if (!updated) return;
      io.to(secretSocketRoom(roomId)).emit("secret-tool:members-updated", updated);
    });
  });

  socket.on("secret-tool:sync-room", async ({ roomId } = {}) => {
    const normalizedRoomId = String(roomId || "").trim();
    if (!normalizedRoomId) return;
    const room = await getSecretToolRoomById(normalizedRoomId);
    if (room) {
      socket.emit("secret-tool:members-updated", room);
    }
  });
}

export function startSecretToolTtlCleanup() {
  const executeCleanup = async () => {
    try {
      const count = await cleanupExpiredSecretToolRooms();
      if (count > 0) {
        console.log(`[secret-tool] cleaned up ${count} expired lobby rooms`);
      }
    } catch (error) {
      console.error("[secret-tool] cleanup error:", error);
    }
  };

  executeCleanup();
  setInterval(executeCleanup, 15 * 60 * 1000);
}
