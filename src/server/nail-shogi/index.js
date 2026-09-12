import crypto from "node:crypto";
import {
  applyCommandBundle,
  createInitialState,
  getPublicSnapshot,
} from "../../../public/nail-shogi/engine.js";

const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const rooms = new Map();

const normalizeRoomId = (value) => String(value || "").replace(/\D/g, "").slice(0, 4);
const normalizeClientId = (value) => String(value || "").trim().slice(0, 160);
const normalizeName = (value) => String(value || "ゲスト").trim().slice(0, 20) || "ゲスト";
const channelFor = (roomId) => `nail-shogi:${roomId}`;

function touch(room) {
  room.updatedAt = Date.now();
}

function pruneRooms() {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (now - room.updatedAt > ROOM_TTL_MS) rooms.delete(roomId);
  }
}

function createRoomId() {
  for (let i = 0; i < 100; i += 1) {
    const roomId = String(crypto.randomInt(1000, 10000));
    if (!rooms.has(roomId)) return roomId;
  }
  return String(Date.now()).slice(-4);
}

function memberFor(room, clientId) {
  return room.members.find((member) => member.clientId === clientId) || null;
}

function roomPayload(room) {
  return {
    roomId: room.roomId,
    status: room.status,
    version: room.version,
    members: room.members.map(({ username, player }) => ({ username, player })),
    state: room.state ? getPublicSnapshot(room.state) : null,
    lastAction: room.lastAction ? structuredClone(room.lastAction) : null,
    updatedAt: room.updatedAt,
  };
}

function responsePayload(room, clientId) {
  const member = memberFor(room, clientId);
  return {
    ok: true,
    room: roomPayload(room),
    you: member
      ? { player: member.player, username: member.username, isHost: room.hostId === clientId }
      : null,
  };
}

function emitRoom(io, room) {
  io.to(channelFor(room.roomId)).emit("nail-shogi:room", roomPayload(room));
}

function fail(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

export function mountNailShogiRoutes(app, io) {
  app.post("/api/nail-shogi/rooms/create", (req, res) => {
    pruneRooms();
    const clientId = normalizeClientId(req.body?.clientId || req.body?.userTrackingId);
    const username = normalizeName(req.body?.username);
    if (!clientId) return fail(res, 400, "client_id_required");

    const roomId = createRoomId();
    const room = {
      roomId,
      hostId: clientId,
      status: "lobby",
      version: 1,
      members: [{ clientId, username, player: 0 }],
      state: null,
      lastAction: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    rooms.set(roomId, room);
    return res.json(responsePayload(room, clientId));
  });

  app.post("/api/nail-shogi/rooms/join", (req, res) => {
    pruneRooms();
    const roomId = normalizeRoomId(req.body?.roomId);
    const clientId = normalizeClientId(req.body?.clientId || req.body?.userTrackingId);
    const username = normalizeName(req.body?.username);
    if (!roomId || !clientId) return fail(res, 400, "room_and_client_required");
    const room = rooms.get(roomId);
    if (!room) return fail(res, 404, "room_not_found");

    const existing = memberFor(room, clientId);
    if (existing) {
      existing.username = username;
      touch(room);
      return res.json(responsePayload(room, clientId));
    }
    if (room.status !== "lobby") return fail(res, 409, "game_already_started");
    if (room.members.length >= 2) return fail(res, 409, "room_full");

    room.members.push({ clientId, username, player: 1 });
    room.version += 1;
    room.lastAction = { id: crypto.randomUUID(), type: "member-joined", player: 1, events: [] };
    touch(room);
    emitRoom(io, room);
    return res.json(responsePayload(room, clientId));
  });

  app.get("/api/nail-shogi/rooms/:roomId", (req, res) => {
    pruneRooms();
    const roomId = normalizeRoomId(req.params.roomId);
    const clientId = normalizeClientId(req.query?.clientId || req.query?.userTrackingId);
    const room = rooms.get(roomId);
    if (!room) return fail(res, 404, "room_not_found");
    return res.json(responsePayload(room, clientId));
  });

  app.post("/api/nail-shogi/rooms/:roomId/start", (req, res) => {
    pruneRooms();
    const roomId = normalizeRoomId(req.params.roomId);
    const clientId = normalizeClientId(req.body?.clientId || req.body?.userTrackingId);
    const room = rooms.get(roomId);
    if (!room) return fail(res, 404, "room_not_found");
    if (room.hostId !== clientId) return fail(res, 403, "host_only");
    if (room.status !== "lobby") return fail(res, 409, "room_not_in_lobby");
    if (room.members.length !== 2) return fail(res, 409, "need_two_players");

    room.state = createInitialState({ mode: "online" });
    room.status = "playing";
    room.version += 1;
    room.lastAction = { id: crypto.randomUUID(), type: "game-started", player: null, events: [] };
    touch(room);
    emitRoom(io, room);
    return res.json(responsePayload(room, clientId));
  });

  app.post("/api/nail-shogi/rooms/:roomId/command", (req, res) => {
    pruneRooms();
    const roomId = normalizeRoomId(req.params.roomId);
    const clientId = normalizeClientId(req.body?.clientId || req.body?.userTrackingId);
    const room = rooms.get(roomId);
    if (!room) return fail(res, 404, "room_not_found");
    if (room.status !== "playing" || !room.state) return fail(res, 409, "room_not_playing");
    const member = memberFor(room, clientId);
    if (!member) return fail(res, 403, "not_a_member");

    const expectedVersion = Number(req.body?.expectedVersion);
    if (Number.isFinite(expectedVersion) && expectedVersion !== room.version) {
      return res.status(409).json({ ok: false, error: "stale_state", ...responsePayload(room, clientId) });
    }

    const applied = applyCommandBundle(room.state, member.player, {
      directions: req.body?.directions,
      cares: req.body?.cares,
    });
    if (!applied.ok) return fail(res, 400, applied.reason || "invalid_command");

    room.state = applied.state;
    room.version += 1;
    if (room.state.phase === "over") room.status = "finished";
    room.lastAction = {
      id: crypto.randomUUID(),
      type: "command",
      player: member.player,
      resolved: Boolean(applied.result?.resolved),
      winner: applied.result?.winner ?? null,
      events: applied.result?.events || [],
    };
    touch(room);
    emitRoom(io, room);
    return res.json(responsePayload(room, clientId));
  });

  app.post("/api/nail-shogi/rooms/:roomId/rematch", (req, res) => {
    pruneRooms();
    const roomId = normalizeRoomId(req.params.roomId);
    const clientId = normalizeClientId(req.body?.clientId || req.body?.userTrackingId);
    const room = rooms.get(roomId);
    if (!room) return fail(res, 404, "room_not_found");
    if (room.hostId !== clientId) return fail(res, 403, "host_only");
    if (room.members.length !== 2) return fail(res, 409, "need_two_players");

    room.state = createInitialState({ mode: "online" });
    room.status = "playing";
    room.version += 1;
    room.lastAction = { id: crypto.randomUUID(), type: "rematch", player: null, events: [] };
    touch(room);
    emitRoom(io, room);
    return res.json(responsePayload(room, clientId));
  });

  app.post("/api/nail-shogi/rooms/:roomId/leave", (req, res) => {
    pruneRooms();
    const roomId = normalizeRoomId(req.params.roomId);
    const clientId = normalizeClientId(req.body?.clientId || req.body?.userTrackingId);
    const room = rooms.get(roomId);
    if (!room) return res.json({ ok: true });
    const member = memberFor(room, clientId);
    if (!member) return res.json({ ok: true });

    if (room.status === "playing") {
      room.status = "closed";
      room.version += 1;
      room.lastAction = { id: crypto.randomUUID(), type: "opponent-left", player: member.player, events: [] };
      touch(room);
      emitRoom(io, room);
      const timer = setTimeout(() => rooms.delete(roomId), 15_000);
      timer.unref?.();
      return res.json({ ok: true });
    }

    room.members = room.members.filter((item) => item.clientId !== clientId);
    room.members.forEach((item, index) => { item.player = index; });
    if (!room.members.length) {
      rooms.delete(roomId);
      return res.json({ ok: true });
    }
    if (room.hostId === clientId) room.hostId = room.members[0].clientId;
    room.version += 1;
    room.lastAction = { id: crypto.randomUUID(), type: "member-left", player: member.player, events: [] };
    touch(room);
    emitRoom(io, room);
    return res.json({ ok: true });
  });

  io.on("connection", (socket) => {
    socket.on("nail-shogi:subscribe", (payload = {}) => {
      pruneRooms();
      const roomId = normalizeRoomId(payload.roomId);
      if (!roomId || !rooms.has(roomId)) return;
      socket.join(channelFor(roomId));
    });
    socket.on("nail-shogi:unsubscribe", (payload = {}) => {
      const roomId = normalizeRoomId(payload.roomId);
      if (!roomId) return;
      socket.leave(channelFor(roomId));
    });
  });
}
