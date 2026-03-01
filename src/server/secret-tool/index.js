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

function sanitizePublicCards(cardList = []) {
  return (cardList || []).map((card) => ({
    name: card?.name,
    type: card?.type,
    text: card?.text,
    flavor: card?.flavor,
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
    installedByPlayer: Object.fromEntries(Object.entries(gameState.installedByPlayer || {}).map(([playerId, cards]) => [playerId, sanitizePublicCards(cards)])),
    discardByPlayer: Object.fromEntries(Object.entries(gameState.discardByPlayer || {}).map(([playerId, cards]) => [playerId, sanitizePublicCards(cards)])),
    drewThisTurn: gameState.drewThisTurn,
    placements: gameState.placements,
    logs: (gameState.logs || []).slice(-30),
  };
}

function pushGameLog(gameState, message) {
  if (!gameState.logs) gameState.logs = [];
  gameState.logs.push(`${new Date().toLocaleTimeString("ja-JP", { hour12: false })} ${message}`);
  if (gameState.logs.length > 100) {
    gameState.logs = gameState.logs.slice(-100);
  }
}

function refreshPlayerStats(gameState) {
  const playerStats = gameState.playerStats || {};
  for (const seat of gameState.seatOrder || []) {
    const playerId = seat.id;
    const hand = gameState.hands?.[playerId] || [];
    const discardCount = (gameState.discardByPlayer?.[playerId] || []).length;
    const installedCount = (gameState.installedByPlayer?.[playerId] || []).length;
    if (!playerStats[playerId]) {
      playerStats[playerId] = { hearts: 10, trashCount: 0, handCount: hand.length, installedCount: 0, active: true };
    }
    playerStats[playerId].handCount = hand.length;
    playerStats[playerId].trashCount = discardCount;
    playerStats[playerId].installedCount = installedCount;
  }
  gameState.playerStats = playerStats;
}

function emitRoomGameState(io, roomId) {
  const gameState = gameStateByRoomId.get(roomId);
  if (!gameState) return;
  refreshPlayerStats(gameState);
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

function ensureDeckCards(gameState, neededCount = 1) {
  if ((gameState.deck || []).length >= neededCount) return;
  const recyclePool = [];
  for (const cards of Object.values(gameState.discardByPlayer || {})) {
    recyclePool.push(...cards);
  }
  if (!recyclePool.length) return;

  gameState.deck.push(...shuffleArray(recyclePool));
  for (const playerId of Object.keys(gameState.discardByPlayer || {})) {
    gameState.discardByPlayer[playerId] = [];
  }
  pushGameLog(gameState, "四次元くずかごを回収して山札を再構築しました。");
}

function evaluatePlacements(gameState) {
  const activePlayerIds = gameState.turnOrder
    .map((seat) => seat.id)
    .filter((playerId) => gameState.playerStats?.[playerId]?.active !== false);
  const assigned = new Set((gameState.placements || []).map((entry) => entry.playerId));

  for (const playerId of activePlayerIds) {
    const hearts = Number(gameState.playerStats?.[playerId]?.hearts || 0);
    if (hearts <= 0 && !assigned.has(playerId)) {
      gameState.placements.push({ playerId, result: "lose" });
      assigned.add(playerId);
      gameState.playerStats[playerId].active = false;
      pushGameLog(gameState, `${gameState.seatOrder.find((p) => p.id === playerId)?.name || "プレイヤー"}が脱落しました。`);
    }
    if (hearts >= 20 && !assigned.has(playerId)) {
      gameState.placements.unshift({ playerId, result: "win" });
      assigned.add(playerId);
      gameState.playerStats[playerId].active = false;
      pushGameLog(gameState, `${gameState.seatOrder.find((p) => p.id === playerId)?.name || "プレイヤー"}が勝ち抜けしました。`);
    }
  }

  const remainingActive = activePlayerIds.filter((playerId) => gameState.playerStats?.[playerId]?.active !== false);
  if (remainingActive.length === 1) {
    const lastPlayerId = remainingActive[0];
    if (!assigned.has(lastPlayerId)) {
      gameState.placements.unshift({ playerId: lastPlayerId, result: "win" });
      gameState.playerStats[lastPlayerId].active = false;
      pushGameLog(gameState, `${gameState.seatOrder.find((p) => p.id === lastPlayerId)?.name || "プレイヤー"}の順位が確定しました。`);
    }
  }

  if (gameState.currentTurnPlayerId && gameState.playerStats?.[gameState.currentTurnPlayerId]?.active === false) {
    gameState.currentTurnPlayerId = null;
  }
}

function moveTurnToNextActive(gameState, fromPlayerId) {
  const activeTurnOrder = (gameState.turnOrder || []).filter((seat) => gameState.playerStats?.[seat.id]?.active !== false);
  if (!activeTurnOrder.length) {
    gameState.currentTurnPlayerId = null;
    return;
  }

  const index = activeTurnOrder.findIndex((seat) => seat.id === fromPlayerId);
  const next = activeTurnOrder[(index + 1 + activeTurnOrder.length) % activeTurnOrder.length];
  gameState.currentTurnPlayerId = next?.id || activeTurnOrder[0].id;
  gameState.drewThisTurn = false;
}

function getActivePlayerIds(gameState) {
  return (gameState.turnOrder || [])
    .map((seat) => seat.id)
    .filter((playerId) => gameState.playerStats?.[playerId]?.active !== false);
}

function resolveTargetPlayerIds(gameState, target, actorPlayerId, context = {}) {
  if (!target) return [];
  const activePlayerIds = getActivePlayerIds(gameState);
  if (!activePlayerIds.length) return [];

  if (target === "self") return actorPlayerId ? [actorPlayerId] : [];
  if (target === "allPlayers") return activePlayerIds;
  if (target === "allOpponents") return activePlayerIds.filter((id) => id !== actorPlayerId);
  if (target === "thatPlayer") return context.thatPlayerId ? [context.thatPlayerId] : [];

  if (target?.type === "choosePlayer") {
    if (target.who === "anyOpponent") {
      const opponents = activePlayerIds.filter((id) => id !== actorPlayerId);
      return opponents[0] ? [opponents[0]] : [];
    }
    if (target.who === "anyPlayer") {
      return activePlayerIds[0] ? [activePlayerIds[0]] : [];
    }
  }

  return [];
}

function resolveNumericValue(action, context = {}) {
  if (typeof action.value === "number") return action.value;
  if (typeof action.count === "number") return action.count;
  const valueFrom = action.valueFrom || {};
  let base = Number(context[valueFrom.var] ?? 0);
  if (valueFrom.abs) base = Math.abs(base);
  if (typeof valueFrom.mul === "number") base *= valueFrom.mul;
  if (valueFrom.negate) base *= -1;
  return Number.isFinite(base) ? base : 0;
}

function runCardActions({ gameState, ownerPlayerId, card, actions = [], context = {} }) {
  const queue = Array.isArray(actions) ? actions : [actions];

  for (const action of queue) {
    if (!action || typeof action !== "object") continue;

    if (action.type === "chooseOne") {
      const choice = (action.choices || [])[0];
      if (choice?.do) {
        runCardActions({ gameState, ownerPlayerId, card, actions: choice.do, context });
      }
      continue;
    }

    if (action.type === "eachPlayer") {
      const targets = resolveTargetPlayerIds(gameState, action.players, ownerPlayerId, context);
      for (const targetPlayerId of targets) {
        runCardActions({
          gameState,
          ownerPlayerId,
          card,
          actions: action.do,
          context: { ...context, thatPlayerId: targetPlayerId },
        });
      }
      continue;
    }

    if (action.type === "drawCards" || action.type === "draw") {
      const count = Math.max(0, Math.trunc(resolveNumericValue(action, context) || 0));
      const targets = resolveTargetPlayerIds(gameState, action.target || "self", ownerPlayerId, context);
      for (const playerId of targets) {
        ensureDeckCards(gameState, count);
        const draw = sanitizeHand(gameState.deck.splice(0, count));
        gameState.hands[playerId].push(...draw);
      }
      continue;
    }

    if (action.type === "modifyResource" && action.resource === "heart") {
      const delta = Math.trunc(resolveNumericValue(action, context));
      if (!delta) continue;
      const targets = resolveTargetPlayerIds(gameState, action.target || "self", ownerPlayerId, context);
      for (const playerId of targets) {
        const stats = gameState.playerStats[playerId];
        if (!stats || stats.active === false) continue;
        stats.hearts = Math.max(0, Number(stats.hearts || 0) + delta);
      }
      continue;
    }

    if (action.type === "destroyInstalled") {
      const targets = resolveTargetPlayerIds(gameState, action.targetPlayer, ownerPlayerId, context);
      const count = Math.max(1, Math.trunc(action.count || 1));
      for (const playerId of targets) {
        const installed = gameState.installedByPlayer[playerId] || [];
        const removed = installed.splice(0, count);
        if (removed.length) {
          gameState.discardByPlayer[playerId].push(...removed);
        }
      }
      continue;
    }

    if (action.type === "moveChosenCards" && action.from === "selfHand" && action.to === "pocket") {
      const hand = gameState.hands[ownerPlayerId] || [];
      const moveCount = action.count === "any" ? hand.length : Math.max(0, Math.trunc(action.count || 0));
      const moved = hand.splice(0, moveCount);
      gameState.deck.push(...moved);
      gameState.deck = shuffleArray(gameState.deck);
      if (action.storeMovedCountAs) {
        context[action.storeMovedCountAs] = moved.length;
      }
      continue;
    }

    if (action.type === "endGameForPlayer") {
      const targets = resolveTargetPlayerIds(gameState, action.player || action.target || "self", ownerPlayerId, context);
      for (const playerId of targets) {
        if (!gameState.playerStats[playerId]) continue;
        if (action.result === "win") {
          gameState.playerStats[playerId].hearts = Math.max(20, Number(gameState.playerStats[playerId].hearts || 0));
        } else if (action.result === "lose") {
          gameState.playerStats[playerId].hearts = 0;
        }
      }
    }
  }
}

function resolveEffectsForTiming({ gameState, ownerPlayerId, card, timing }) {
  const matched = (card.effects || []).filter((effect) => effect?.timing === timing);
  for (const effect of matched) {
    runCardActions({
      gameState,
      ownerPlayerId,
      card,
      actions: effect.action || [],
      context: {},
    });
  }
}

function resolveInstalledTimingEffects(gameState, ownerPlayerId, timing) {
  for (const [controllerId, installedCards] of Object.entries(gameState.installedByPlayer || {})) {
    for (const card of installedCards || []) {
      const effects = card.effects || [];
      const hasMatchedTiming = effects.some((effect) => effect?.timing === timing);
      if (!hasMatchedTiming) continue;

      const shouldRun = (
        timing === "onTurnStart" || timing === "onTurnEnd" || controllerId === ownerPlayerId
      );
      if (!shouldRun) continue;

      resolveEffectsForTiming({ gameState, ownerPlayerId: controllerId, card, timing });
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
      discardByPlayer: Object.fromEntries(seatOrder.map((seat) => [seat.id, []])),
      discardCountByPlayer: Object.fromEntries(seatOrder.map((seat) => [seat.id, 0])),
      installedByPlayer: Object.fromEntries(seatOrder.map((seat) => [seat.id, []])),
      playerStats: Object.fromEntries(seatOrder.map((seat) => [seat.id, {
        hearts: 10,
        trashCount: 0,
        handCount: (hands[seat.id] || []).length,
        installedCount: 0,
        active: true,
      }])),
      mulliganDoneByPlayer: {},
      mulliganReturnByPlayer: {},
      firstFinisherId: null,
      parentId: null,
      turnOrder: [],
      currentTurnPlayerId: null,
      drewThisTurn: false,
      placements: [],
      logs: [],
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
    gameState.drewThisTurn = false;
    resolveInstalledTimingEffects(gameState, gameState.currentTurnPlayerId, "onOwnerTurnStart");
    resolveInstalledTimingEffects(gameState, gameState.currentTurnPlayerId, "onTurnStart");
    pushGameLog(gameState, "ゲーム開始。親からターンを始めます。");

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
    if (gameState.drewThisTurn) return;

    ensureDeckCards(gameState, 1);
    if (!gameState.deck.length) {
      gameState.drewThisTurn = true;
      emitRoomGameState(io, normalizedRoomId);
      return;
    }

    const drawCard = sanitizeHand(gameState.deck.splice(0, 1));
    gameState.hands[currentUserTrackingId].push(...drawCard);
    gameState.drewThisTurn = true;
    pushGameLog(gameState, `${socket.data.username} がカードを1枚ドローしました。`);

    emitRoomGameState(io, normalizedRoomId);
  });

  socket.on("secret-tool:play-card", ({ roomId, handId } = {}) => {
    const normalizedRoomId = String(roomId || socket.data.roomId || "").trim();
    const currentUserTrackingId = String(socket.data.clientId || "").trim();
    const normalizedHandId = String(handId || "").trim();
    if (!normalizedRoomId || !currentUserTrackingId || !normalizedHandId) return;

    const gameState = gameStateByRoomId.get(normalizedRoomId);
    if (!gameState || gameState.phase !== "in_game") return;
    if (gameState.currentTurnPlayerId !== currentUserTrackingId) return;

    const hand = gameState.hands[currentUserTrackingId] || [];
    const cardIndex = hand.findIndex((card) => card.handId === normalizedHandId);
    if (cardIndex < 0) return;

    const [card] = hand.splice(cardIndex, 1);
    if (card.type === "設置型" || card.type === "installed") {
      const installed = gameState.installedByPlayer[currentUserTrackingId] || [];
      if (installed.length >= 3) {
        hand.push(card);
        return;
      }
      installed.push(card);
      gameState.installedByPlayer[currentUserTrackingId] = installed;
      pushGameLog(gameState, `${socket.data.username} が ${card.name} を設置しました。`);
      resolveEffectsForTiming({ gameState, ownerPlayerId: currentUserTrackingId, card, timing: "onInstall" });
      resolveEffectsForTiming({ gameState, ownerPlayerId: currentUserTrackingId, card, timing: "onPlay" });
    } else {
      const discard = gameState.discardByPlayer[currentUserTrackingId] || [];
      discard.push(card);
      gameState.discardByPlayer[currentUserTrackingId] = discard;
      pushGameLog(gameState, `${socket.data.username} が ${card.name} を使用しました。`);
      resolveEffectsForTiming({ gameState, ownerPlayerId: currentUserTrackingId, card, timing: "onPlay" });
    }

    evaluatePlacements(gameState);
    emitRoomGameState(io, normalizedRoomId);
  });

  socket.on("secret-tool:adjust-heart", ({ roomId, targetPlayerId, delta } = {}) => {
    const normalizedRoomId = String(roomId || socket.data.roomId || "").trim();
    const currentUserTrackingId = String(socket.data.clientId || "").trim();
    const normalizedTargetId = String(targetPlayerId || "").trim();
    const numericDelta = Math.trunc(Number(delta || 0));
    if (!normalizedRoomId || !currentUserTrackingId || !normalizedTargetId || !numericDelta) return;

    const gameState = gameStateByRoomId.get(normalizedRoomId);
    if (!gameState || gameState.phase !== "in_game") return;
    if (gameState.currentTurnPlayerId !== currentUserTrackingId) return;
    if (!gameState.playerStats[normalizedTargetId] || gameState.playerStats[normalizedTargetId].active === false) return;

    gameState.playerStats[normalizedTargetId].hearts = Math.max(0, gameState.playerStats[normalizedTargetId].hearts + numericDelta);
    pushGameLog(gameState, `${socket.data.username} が ${gameState.seatOrder.find((p) => p.id === normalizedTargetId)?.name || "プレイヤー"} のハートを ${numericDelta > 0 ? "+" : ""}${numericDelta} しました。`);
    evaluatePlacements(gameState);
    emitRoomGameState(io, normalizedRoomId);
  });

  socket.on("secret-tool:end-turn", ({ roomId } = {}) => {
    const normalizedRoomId = String(roomId || socket.data.roomId || "").trim();
    const currentUserTrackingId = String(socket.data.clientId || "").trim();
    if (!normalizedRoomId || !currentUserTrackingId) return;

    const gameState = gameStateByRoomId.get(normalizedRoomId);
    if (!gameState || gameState.phase !== "in_game") return;
    if (gameState.currentTurnPlayerId !== currentUserTrackingId) return;
    if (!gameState.drewThisTurn) return;

    evaluatePlacements(gameState);
    resolveInstalledTimingEffects(gameState, currentUserTrackingId, "onOwnerTurnEnd");
    resolveInstalledTimingEffects(gameState, currentUserTrackingId, "onTurnEnd");
    moveTurnToNextActive(gameState, currentUserTrackingId);
    pushGameLog(gameState, `${socket.data.username} がターンを終了しました。`);

    if (gameState.currentTurnPlayerId) {
      resolveInstalledTimingEffects(gameState, gameState.currentTurnPlayerId, "onOwnerTurnStart");
      resolveInstalledTimingEffects(gameState, gameState.currentTurnPlayerId, "onTurnStart");
      evaluatePlacements(gameState);
    }

    if (!gameState.currentTurnPlayerId) {
      gameState.phase = "finished";
      pushGameLog(gameState, "全プレイヤーの順位が確定しました。ゲーム終了です。");
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
