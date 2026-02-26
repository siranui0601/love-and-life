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

export function cancelPendingLeave(roomId, clientId) {
  const normalizedRoomId = String(roomId || "").trim();
  const normalizedClientId = String(clientId || "").trim();
  if (!normalizedRoomId || !normalizedClientId) return false;

  const roomMap = pendingLeave.get(normalizedRoomId);
  if (!roomMap) return false;

  const timeoutId = roomMap.get(normalizedClientId);
  if (!timeoutId) return false;

  clearTimeout(timeoutId);
  roomMap.delete(normalizedClientId);

  if (!roomMap.size) {
    pendingLeave.delete(normalizedRoomId);
  }

  return true;
}

export function schedulePendingLeave(roomId, clientId, callback) {
  const normalizedRoomId = String(roomId || "").trim();
  const normalizedClientId = String(clientId || "").trim();
  if (!normalizedRoomId || !normalizedClientId) return null;

  cancelPendingLeave(normalizedRoomId, normalizedClientId);
  const roomMap = getPendingLeaveRoomMap(normalizedRoomId);
  if (!roomMap) return null;

  const timeoutId = setTimeout(async () => {
    const latestRoomMap = pendingLeave.get(normalizedRoomId);
    const latestTimeoutId = latestRoomMap?.get(normalizedClientId);
    if (latestTimeoutId !== timeoutId) return;

    latestRoomMap.delete(normalizedClientId);
    if (!latestRoomMap.size) {
      pendingLeave.delete(normalizedRoomId);
    }

    await callback();
  }, PENDING_LEAVE_GRACE_MS);

  roomMap.set(normalizedClientId, timeoutId);
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
    const clientId = String(req.body?.clientId || "").trim();

    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }

    try {
      const room = await createSecretToolRoom({ username, clientId });
      io.to(secretSocketRoom(room.roomId)).emit("secret-tool:members-updated", room);
      return res.json(room);
    } catch (error) {
      console.error("[secret-tool] create room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/secret-tool/rooms/join", async (req, res) => {
    const username = String(req.body?.username || "guest").trim() || "guest";
    const clientId = String(req.body?.clientId || "").trim();
    const roomId = String(req.body?.roomId || "").trim();

    if (!clientId || !roomId) {
      return res.status(400).json({ error: "clientId and roomId are required" });
    }

    try {
      const room = await joinSecretToolRoom({ username, clientId, roomId });
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
  socket.data.clientId = String(auth.clientId || socket.data.clientId || "").trim();
  socket.data.username = String(auth.username || socket.data.username || "guest").trim() || "guest";
  socket.data.roomId = String(auth.roomId || socket.data.roomId || "").trim() || null;

  socket.on("secret-tool:join-room", async ({ roomId } = {}) => {
    const normalizedRoomId = String(roomId || socket.data.roomId || "").trim();
    const clientId = String(socket.data.clientId || "").trim();
    const username = String(socket.data.username || "guest").trim() || "guest";
    if (!normalizedRoomId || !clientId) return;

    cancelPendingLeave(normalizedRoomId, clientId);
    socket.join(secretSocketRoom(normalizedRoomId));
    socket.data.secretToolRoomId = normalizedRoomId;
    socket.data.roomId = normalizedRoomId;

    try {
      const room = await joinSecretToolRoom({ roomId: normalizedRoomId, username, clientId });
      io.to(secretSocketRoom(normalizedRoomId)).emit("secret-tool:members-updated", room);
    } catch (error) {
      if (error.message !== "room_not_found" && error.message !== "room_not_lobby") {
        console.error("[secret-tool] join-room socket error:", error);
      }
    }
  });

  socket.on("secret-tool:leave-room", async () => {
    const roomId = String(socket.data.secretToolRoomId || "").trim();
    const clientId = String(socket.data.clientId || "").trim();
    if (!roomId || !clientId) return;

    cancelPendingLeave(roomId, clientId);
    const updated = await removeSecretToolMember({ roomId, clientId });
    socket.leave(secretSocketRoom(roomId));
    socket.data.secretToolRoomId = null;

    if (updated) {
      io.to(secretSocketRoom(roomId)).emit("secret-tool:members-updated", updated);
    }
  });

  socket.on("disconnect", () => {
    const roomId = String(socket.data.secretToolRoomId || socket.data.roomId || "").trim();
    const clientId = String(socket.data.clientId || "").trim();
    if (!roomId || !clientId) return;

    schedulePendingLeave(roomId, clientId, async () => {
      const updated = await removeSecretToolMember({ roomId, clientId });
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
