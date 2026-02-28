import path from "path";
import fs from "fs/promises";
import {
  cleanupExpiredSecretToolRooms,
  createSecretToolRoom,
  deleteSecretToolRoom,
  getSecretToolRoomById,
  removeSecretToolMember,
  joinSecretToolRoom,
  updateSecretToolRoomStatus,
} from "../../foundation/sheets.js";

const PENDING_LEAVE_GRACE_MS = 60 * 1000;
const pendingLeave = new Map();
const activeSocketsByTrackingId = new Map();
const gameStateByRoomId = new Map();

let secretToolCards = [];

async function loadSecretToolCards() {
  const jsonPath = path.join(process.cwd(), "public/secret-tool/secret-tool.json");
  const raw = await fs.readFile(jsonPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("invalid_secret_tool_json");
  secretToolCards = parsed;
}

function shuffleArray(source) {
  const arr = [...source];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rotatePlayersFromParent(order, parentId) {
  const parentIndex = order.findIndex((player) => player.id === parentId);
  if (parentIndex < 0) return order;
  return [...order.slice(parentIndex), ...order.slice(0, parentIndex)];
}

function sanitizeHand(cardList = []) {
  return cardList.map((card, index) => ({
    handId: `${String(card.name || "card")}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: card.name,
    type: card.type,
    text: card.text,
    flavor: card.flavor,
    initial: card.initial,
  }));
}

function buildPublicRoomState(gameState) {
  if (!gameState) return null;
  return {
    phase: gameState.phase,
    seatOrder: gameState.seatOrder,
    parentId: gameState.parentId,
    turnOrder: gameState.turnOrder,
    currentTurnPlayerId: gameState.currentTurnPlayerId,
    playerStats: gameState.playerStats,
  };
}

function emitRoomGameState(io, roomId) {
  const gameState = gameStateByRoomId.get(roomId);
  if (!gameState) return;
  const playerStats = gameState.playerStats || {};
  for (const seat of gameState.seatOrder || []) {
    const playerId = seat.id;
    const hand = gameState.hands?.[playerId] || [];
    if (!playerStats[playerId]) {
      playerStats[playerId] = { hearts: 10, trashCount: 0, handCount: hand.length };
    }
    playerStats[playerId].handCount = hand.length;
  }
  gameState.playerStats = playerStats;
  io.to(secretSocketRoom(roomId)).emit("secret-tool:game-state", buildPublicRoomState(gameState));
  for (const [playerId, hand] of Object.entries(gameState.hands || {})) {
    for (const socketId of activeSocketsByTrackingId.get(playerId) || []) {
      io.to(socketId).emit("secret-tool:your-hand", {
        roomId,
        phase: gameState.phase,
        cards: hand,
      });
    }
  }
}

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
      if (error.message === "room_full") {
        return res.status(409).json({ error: "room_full" });
      }
      console.error("[secret-tool] join room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/secret-tool/rooms/delete", async (req, res) => {
    const roomId = String(req.body?.roomId || "").trim();
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();
    if (!roomId || !userTrackingId) {
      return res.status(400).json({ error: "roomId and userTrackingId are required" });
    }

    try {
      const room = await deleteSecretToolRoom({ roomId, hostClientId: userTrackingId });
      gameStateByRoomId.delete(roomId);
      io.to(secretSocketRoom(roomId)).emit("secret-tool:room-deleted", { roomId });
      io.to(secretSocketRoom(roomId)).emit("secret-tool:members-updated", room);
      return res.json(room);
    } catch (error) {
      if (error.message === "room_not_found") {
        return res.status(404).json({ error: "room_not_found" });
      }
      if (error.message === "room_not_lobby") {
        return res.status(409).json({ error: "room_not_lobby" });
      }
      if (error.message === "forbidden") {
        return res.status(403).json({ error: "forbidden" });
      }
      console.error("[secret-tool] delete room error:", error);
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

  socket.on("secret-tool:join-room", async ({ roomId, announceJoin = false } = {}) => {
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
      emitRoomGameState(io, normalizedRoomId);
      if (room.joined || announceJoin) {
        socket.to(secretSocketRoom(normalizedRoomId)).emit("secret-tool:member-joined", {
          roomId: normalizedRoomId,
          name: username,
        });
      }
    } catch (error) {
      if (error.message !== "room_not_found" && error.message !== "room_not_lobby" && error.message !== "room_full") {
        console.error("[secret-tool] join-room socket error:", error);
      }
    }
  });

  socket.on("secret-tool:leave-room", async () => {
    const roomId = String(socket.data.secretToolRoomId || "").trim();
    const currentUserTrackingId = String(socket.data.clientId || "").trim();
    if (!roomId || !currentUserTrackingId) return;

    cancelPendingLeave(roomId, currentUserTrackingId);
    const previousRoom = await getSecretToolRoomById(roomId);
    const leavingMember = previousRoom?.members.find((member) => member.id === currentUserTrackingId);
    const updated = await removeSecretToolMember({ roomId, clientId: currentUserTrackingId });
    socket.leave(secretSocketRoom(roomId));
    socket.data.secretToolRoomId = null;

    if (updated) {
      if (updated.status === "closed") gameStateByRoomId.delete(roomId);
      io.to(secretSocketRoom(roomId)).emit("secret-tool:members-updated", updated);
      emitRoomGameState(io, roomId);
      if (leavingMember?.name && updated.status !== "closed") {
        io.to(secretSocketRoom(roomId)).emit("secret-tool:member-left", {
          roomId,
          id: leavingMember.id,
          name: leavingMember.name,
        });
      }
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

      const previousRoom = await getSecretToolRoomById(roomId);
      const leavingMember = previousRoom?.members.find((member) => member.id === currentUserTrackingId);
      const updated = await removeSecretToolMember({ roomId, clientId: currentUserTrackingId });
      if (!updated) return;
      if (updated.status === "closed") gameStateByRoomId.delete(roomId);
      io.to(secretSocketRoom(roomId)).emit("secret-tool:members-updated", updated);
      emitRoomGameState(io, roomId);
      if (leavingMember?.name && updated.status !== "closed") {
        io.to(secretSocketRoom(roomId)).emit("secret-tool:member-left", {
          roomId,
          id: leavingMember.id,
          name: leavingMember.name,
        });
      }
    });
  });

  socket.on("secret-tool:sync-room", async ({ roomId } = {}) => {
    const normalizedRoomId = String(roomId || "").trim();
    if (!normalizedRoomId) return;
    if (!secretToolCards.length) {
      await loadSecretToolCards();
    }

    const room = await getSecretToolRoomById(normalizedRoomId);
    if (room) {
      socket.emit("secret-tool:members-updated", room);
      const gameState = gameStateByRoomId.get(normalizedRoomId);
      if (gameState) {
        socket.emit("secret-tool:game-state", buildPublicRoomState(gameState));
        const hand = gameState.hands?.[String(socket.data.clientId || "").trim()] || [];
        socket.emit("secret-tool:your-hand", {
          roomId: normalizedRoomId,
          phase: gameState.phase,
          cards: hand,
        });
      }
    }
  });

  socket.on("secret-tool:start-game", async ({ roomId } = {}) => {
    const normalizedRoomId = String(roomId || socket.data.roomId || "").trim();
    const currentUserTrackingId = String(socket.data.clientId || "").trim();
    if (!normalizedRoomId || !currentUserTrackingId) return;
    if (!secretToolCards.length) {
      await loadSecretToolCards();
    }

    const room = await getSecretToolRoomById(normalizedRoomId);
    if (!room || room.status !== "lobby") return;
    const host = room.members.find((member) => member.role === "host");
    if (!host || host.id !== currentUserTrackingId) return;
    if (room.members.length < 2 || room.members.length > 4) return;

    const startedRoom = await updateSecretToolRoomStatus({ roomId: normalizedRoomId, status: "started" });

    const seatOrder = shuffleArray(room.members.map((member) => ({ id: member.id, name: member.name })));
    const deck = shuffleArray(secretToolCards);
    const hands = {};
    for (const seat of seatOrder) {
      hands[seat.id] = sanitizeHand(deck.splice(0, 5));
    }

    gameStateByRoomId.set(normalizedRoomId, {
      phase: "mulligan",
      seatOrder,
      hands,
      deck,
      playerStats: Object.fromEntries(seatOrder.map((seat) => [seat.id, {
        hearts: 10,
        trashCount: 0,
        handCount: (hands[seat.id] || []).length,
      }])),
      mulliganDoneByPlayer: {},
      mulliganReturnByPlayer: {},
      firstFinisherId: null,
      parentId: null,
      turnOrder: [],
      currentTurnPlayerId: null,
    });

    io.to(secretSocketRoom(normalizedRoomId)).emit("secret-tool:members-updated", startedRoom);
    io.to(secretSocketRoom(normalizedRoomId)).emit("secret-tool:game-started", {
      roomId: normalizedRoomId,
      phase: "mulligan",
    });
    emitRoomGameState(io, normalizedRoomId);
  });

  socket.on("secret-tool:mulligan-finish", ({ roomId, selectedHandIds = [] } = {}) => {
    const normalizedRoomId = String(roomId || socket.data.roomId || "").trim();
    const currentUserTrackingId = String(socket.data.clientId || "").trim();
    if (!normalizedRoomId || !currentUserTrackingId) return;

    const gameState = gameStateByRoomId.get(normalizedRoomId);
    if (!gameState || gameState.phase !== "mulligan") return;
    if (gameState.mulliganDoneByPlayer[currentUserTrackingId]) return;

    const currentHand = gameState.hands[currentUserTrackingId] || [];
    const uniqueSelectedIds = Array.from(new Set((selectedHandIds || []).map((id) => String(id || "").trim()).filter(Boolean))).slice(0, 3);
    const selectedCards = currentHand.filter((card) => uniqueSelectedIds.includes(card.handId));
    const stayingCards = currentHand.filter((card) => !uniqueSelectedIds.includes(card.handId));

    gameState.hands[currentUserTrackingId] = stayingCards;
    gameState.mulliganReturnByPlayer[currentUserTrackingId] = selectedCards;
    gameState.mulliganDoneByPlayer[currentUserTrackingId] = Date.now();
    if (!gameState.firstFinisherId) {
      gameState.firstFinisherId = currentUserTrackingId;
    }

    io.to(secretSocketRoom(normalizedRoomId)).emit("secret-tool:mulligan-player-finished", {
      playerId: currentUserTrackingId,
      returnedCount: selectedCards.length,
    });

    const allPlayerIds = gameState.seatOrder.map((seat) => seat.id);
    const allDone = allPlayerIds.every((playerId) => gameState.mulliganDoneByPlayer[playerId]);
    if (!allDone) {
      emitRoomGameState(io, normalizedRoomId);
      return;
    }

    for (const playerId of allPlayerIds) {
      const returned = gameState.mulliganReturnByPlayer[playerId] || [];
      gameState.deck.push(...returned);
    }
    gameState.deck = shuffleArray(gameState.deck);

    for (const playerId of allPlayerIds) {
      const drawCount = (gameState.mulliganReturnByPlayer[playerId] || []).length;
      const nextDraw = sanitizeHand(gameState.deck.splice(0, drawCount));
      gameState.hands[playerId].push(...nextDraw);
    }

    gameState.parentId = gameState.firstFinisherId;
    gameState.turnOrder = rotatePlayersFromParent([...gameState.seatOrder], gameState.parentId);
    gameState.currentTurnPlayerId = gameState.parentId;
    gameState.phase = "in_game";

    io.to(secretSocketRoom(normalizedRoomId)).emit("secret-tool:mulligan-completed", {
      roomId: normalizedRoomId,
      parentId: gameState.parentId,
      turnOrder: gameState.turnOrder,
    });
    emitRoomGameState(io, normalizedRoomId);
  });

  socket.on("secret-tool:draw-card", ({ roomId } = {}) => {
    const normalizedRoomId = String(roomId || socket.data.roomId || "").trim();
    const currentUserTrackingId = String(socket.data.clientId || "").trim();
    if (!normalizedRoomId || !currentUserTrackingId) return;

    const gameState = gameStateByRoomId.get(normalizedRoomId);
    if (!gameState || gameState.phase !== "in_game") return;
    if (gameState.currentTurnPlayerId !== currentUserTrackingId) return;
    if (!gameState.deck.length) return;

    const drawCard = sanitizeHand(gameState.deck.splice(0, 1));
    gameState.hands[currentUserTrackingId].push(...drawCard);

    const turnIndex = gameState.turnOrder.findIndex((seat) => seat.id === currentUserTrackingId);
    if (turnIndex >= 0) {
      const nextPlayer = gameState.turnOrder[(turnIndex + 1) % gameState.turnOrder.length];
      gameState.currentTurnPlayerId = nextPlayer?.id || currentUserTrackingId;
    }

    emitRoomGameState(io, normalizedRoomId);
  });
}

export function startSecretToolTtlCleanup() {
  loadSecretToolCards().catch((error) => {
    console.error("[secret-tool] failed to load cards:", error);
  });
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
