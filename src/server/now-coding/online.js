import crypto from "node:crypto";
import { PLAYER_COLORS } from "../../../public/now-coding/engine.js";
import { MODE_LABELS, makeModeNpcProgram } from "../../../public/now-coding/modes.js";
import { resolveNowCodingUser } from "./store.js";

const rooms = new Map();
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const ROOM_ID_MIN = 100000;
const ROOM_ID_MAX = 1000000;
const VALID_SIZES = new Set([15, 21, 31]);
const VALID_DIFFICULTIES = new Set(["weak", "medium", "strong"]);
const VALID_MODES = new Set(Object.keys(MODE_LABELS));
let cleanupTimer = null;

function roomChannel(roomId) {
  return `now-coding:${roomId}`;
}

function safeAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function text(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeSettings(raw = {}) {
  const playerCount = Math.max(2, Math.min(4, Number(raw.playerCount) || 2));
  const size = VALID_SIZES.has(Number(raw.size)) ? Number(raw.size) : 21;
  const npcDifficulty = VALID_DIFFICULTIES.has(raw.npcDifficulty) ? raw.npcDifficulty : "medium";
  const mode = VALID_MODES.has(raw.mode) ? raw.mode : "territory";
  return {
    mode,
    playerCount,
    size,
    seed: text(raw.seed, 128),
    fillWithNpc: Boolean(raw.fillWithNpc),
    npcDifficulty,
  };
}

function makeRoomId() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = String(crypto.randomInt(ROOM_ID_MIN, ROOM_ID_MAX));
    if (!rooms.has(id)) return id;
  }
  throw new Error("room_id_exhausted");
}

function makeSeed() {
  return `${crypto.randomBytes(4).toString("hex")}-${crypto.randomBytes(4).toString("hex")}`;
}

function modeMaxTicks(mode, size) {
  if (mode === "cobra" || mode === "fall") return Math.max(600, size * size * 2);
  if (mode === "splat") return Math.max(500, size * size * 2);
  return Math.max(420, size * size * 2);
}

function touch(room) {
  room.updatedAt = Date.now();
  room.expiresAt = room.updatedAt + ROOM_TTL_MS;
}

function memberPublic(member, viewerId) {
  return {
    userTrackingId: member.userTrackingId,
    username: member.username,
    role: member.role,
    connected: member.socketIds.size > 0,
    ready: Boolean(member.ready),
    programName: member.program?.name || "",
    hasProgram: Boolean(member.program?.blocks?.length),
    isSelf: member.userTrackingId === viewerId,
  };
}

function publicRoom(room, viewerId = "") {
  return {
    roomId: room.id,
    status: room.status,
    privateRoom: room.privateRoom,
    hostIsSelf: room.hostId === viewerId,
    settings: { ...room.settings },
    members: room.members.map((member) => memberPublic(member, viewerId)),
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
  };
}

function publicSummary(room) {
  const connected = room.members.filter((member) => member.socketIds.size > 0).length;
  return {
    roomId: room.id,
    hostName: room.members.find((member) => member.userTrackingId === room.hostId)?.username || "",
    mode: room.settings.mode,
    modeLabel: MODE_LABELS[room.settings.mode] || "陣取り",
    size: room.settings.size,
    playerCount: room.settings.playerCount,
    currentPlayers: connected,
    fillWithNpc: room.settings.fillWithNpc,
    npcDifficulty: room.settings.npcDifficulty,
    createdAt: room.createdAt,
  };
}

function listPublicRooms() {
  const now = Date.now();
  return [...rooms.values()]
    .filter((room) => room.status === "lobby" && !room.privateRoom && room.expiresAt > now)
    .filter((room) => room.members.some((member) => member.userTrackingId === room.hostId && member.socketIds.size > 0))
    .filter((room) => room.members.length < room.settings.playerCount)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 40)
    .map(publicSummary);
}

async function resolveSocketUser(socket) {
  const userTrackingId = text(socket.data?.clientId, 128);
  if (!userTrackingId) return null;
  return resolveNowCodingUser(userTrackingId);
}

function findMember(room, userTrackingId) {
  return room.members.find((member) => member.userTrackingId === userTrackingId) || null;
}

function createMember(user, role, socketId) {
  return {
    userTrackingId: user.userTrackingId,
    username: user.username,
    role,
    socketIds: new Set(socketId ? [socketId] : []),
    ready: false,
    program: null,
  };
}

function emitRoom(io, room) {
  for (const member of room.members) {
    for (const socketId of member.socketIds) {
      io.to(socketId).emit("now:room-state", publicRoom(room, member.userTrackingId));
    }
  }
  io.emit("now:rooms-changed");
}

function sanitizeProgram(raw = {}) {
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const encoded = JSON.stringify(blocks);
  if (encoded.length > 220000) throw new Error("program_too_large");
  return {
    programId: text(raw.programId, 128),
    name: text(raw.name || "無題の駒", 60),
    blocks: JSON.parse(encoded),
  };
}

function removeSocketFromRooms(io, socket) {
  for (const room of rooms.values()) {
    let changed = false;
    for (const member of room.members) {
      if (member.socketIds.delete(socket.id)) changed = true;
    }
    if (changed) {
      touch(room);
      emitRoom(io, room);
    }
  }
}

function closeRoom(io, room) {
  rooms.delete(room.id);
  io.to(roomChannel(room.id)).emit("now:room-closed", { roomId: room.id });
  io.in(roomChannel(room.id)).socketsLeave(roomChannel(room.id));
  io.emit("now:rooms-changed");
}

function cleanupExpired(io) {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.expiresAt <= now) closeRoom(io, room);
  }
}

function startCleanup(io) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => cleanupExpired(io), 60_000);
  cleanupTimer.unref?.();
}

export function mountNowCodingSocketHandlers(io) {
  startCleanup(io);
  io.on("connection", (socket) => {
    socket.on("now:list-rooms", async (_payload, ack) => {
      safeAck(ack, { ok: true, rooms: listPublicRooms() });
    });

    socket.on("now:create-room", async (payload = {}, ack) => {
      try {
        const user = await resolveSocketUser(socket);
        if (!user) throw new Error("login_required");
        const settings = normalizeSettings(payload.settings || {});
        const room = {
          id: makeRoomId(),
          hostId: user.userTrackingId,
          status: "lobby",
          privateRoom: Boolean(payload.privateRoom),
          settings,
          members: [createMember(user, "host", socket.id)],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + ROOM_TTL_MS,
        };
        rooms.set(room.id, room);
        socket.join(roomChannel(room.id));
        safeAck(ack, { ok: true, room: publicRoom(room, user.userTrackingId) });
        emitRoom(io, room);
      } catch (error) {
        safeAck(ack, { ok: false, error: error?.message || "room_create_failed" });
      }
    });

    socket.on("now:join-room", async (payload = {}, ack) => {
      try {
        const user = await resolveSocketUser(socket);
        if (!user) throw new Error("login_required");
        const roomId = text(payload.roomId, 20);
        const room = rooms.get(roomId);
        if (!room || room.expiresAt <= Date.now()) throw new Error("room_not_found");
        if (room.status !== "lobby") throw new Error("room_not_open");
        let member = findMember(room, user.userTrackingId);
        if (!member) {
          if (room.members.length >= room.settings.playerCount) throw new Error("room_full");
          member = createMember(user, "guest", socket.id);
          room.members.push(member);
        } else {
          member.username = user.username;
          member.socketIds.add(socket.id);
        }
        touch(room);
        socket.join(roomChannel(room.id));
        safeAck(ack, { ok: true, room: publicRoom(room, user.userTrackingId) });
        emitRoom(io, room);
      } catch (error) {
        safeAck(ack, { ok: false, error: error?.message || "room_join_failed" });
      }
    });

    socket.on("now:set-program", async (payload = {}, ack) => {
      try {
        const user = await resolveSocketUser(socket);
        if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20));
        if (!room || room.status !== "lobby") throw new Error("room_not_open");
        const member = findMember(room, user.userTrackingId);
        if (!member) throw new Error("not_in_room");
        member.program = sanitizeProgram(payload.program || {});
        member.ready = false;
        touch(room);
        safeAck(ack, { ok: true });
        emitRoom(io, room);
      } catch (error) {
        safeAck(ack, { ok: false, error: error?.message || "program_select_failed" });
      }
    });

    socket.on("now:set-ready", async (payload = {}, ack) => {
      try {
        const user = await resolveSocketUser(socket);
        if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20));
        if (!room || room.status !== "lobby") throw new Error("room_not_open");
        const member = findMember(room, user.userTrackingId);
        if (!member) throw new Error("not_in_room");
        if (payload.ready && !member.program?.blocks?.length) throw new Error("program_required");
        member.ready = Boolean(payload.ready);
        touch(room);
        safeAck(ack, { ok: true });
        emitRoom(io, room);
      } catch (error) {
        safeAck(ack, { ok: false, error: error?.message || "ready_failed" });
      }
    });

    socket.on("now:start-room", async (payload = {}, ack) => {
      try {
        const user = await resolveSocketUser(socket);
        if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20));
        if (!room || room.status !== "lobby") throw new Error("room_not_open");
        if (room.hostId !== user.userTrackingId) throw new Error("host_only");
        const connectedMembers = room.members.filter((member) => member.socketIds.size > 0);
        if (connectedMembers.some((member) => !member.program?.blocks?.length || !member.ready)) throw new Error("members_not_ready");
        if (connectedMembers.length < 2 && !room.settings.fillWithNpc) throw new Error("need_two_players");
        const targetCount = room.settings.fillWithNpc ? room.settings.playerCount : Math.max(2, connectedMembers.length);
        const players = connectedMembers.slice(0, targetCount).map((member, index) => ({
          id: member.userTrackingId,
          userTrackingId: member.userTrackingId,
          name: member.username,
          color: PLAYER_COLORS[index],
          program: member.program.blocks,
          programName: member.program.name,
        }));
        while (players.length < targetCount) {
          const index = players.length;
          players.push({
            id: `npc-${room.id}-${index}`,
            userTrackingId: "",
            name: `NPC・${room.settings.npcDifficulty === "weak" ? "弱" : room.settings.npcDifficulty === "strong" ? "強" : "中"} ${index}`,
            color: PLAYER_COLORS[index],
            program: makeModeNpcProgram(room.settings.mode, room.settings.npcDifficulty, index),
            npcDifficulty: room.settings.npcDifficulty,
          });
        }
        const seed = room.settings.seed || makeSeed();
        room.status = "playing";
        room.startedAt = Date.now();
        touch(room);
        const config = {
          mode: room.settings.mode,
          seed,
          size: room.settings.size,
          players,
          maxTicks: modeMaxTicks(room.settings.mode, room.settings.size),
          online: { roomId: room.id, saveOwnerId: room.hostId },
        };
        safeAck(ack, { ok: true });
        io.to(roomChannel(room.id)).emit("now:match-start", config);
        io.emit("now:rooms-changed");
      } catch (error) {
        safeAck(ack, { ok: false, error: error?.message || "room_start_failed" });
      }
    });

    socket.on("now:leave-room", async (payload = {}, ack) => {
      try {
        const user = await resolveSocketUser(socket);
        if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20));
        if (!room) throw new Error("room_not_found");
        const memberIndex = room.members.findIndex((member) => member.userTrackingId === user.userTrackingId);
        if (memberIndex < 0) throw new Error("not_in_room");
        if (room.hostId === user.userTrackingId) {
          closeRoom(io, room);
        } else {
          room.members.splice(memberIndex, 1);
          touch(room);
          emitRoom(io, room);
        }
        socket.leave(roomChannel(room.id));
        safeAck(ack, { ok: true });
      } catch (error) {
        safeAck(ack, { ok: false, error: error?.message || "leave_failed" });
      }
    });

    socket.on("now:finish-room", async (payload = {}, ack) => {
      try {
        const user = await resolveSocketUser(socket);
        if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20));
        if (!room) return safeAck(ack, { ok: true });
        if (room.hostId !== user.userTrackingId) throw new Error("host_only");
        closeRoom(io, room);
        safeAck(ack, { ok: true });
      } catch (error) {
        safeAck(ack, { ok: false, error: error?.message || "finish_failed" });
      }
    });

    socket.on("disconnect", () => removeSocketFromRooms(io, socket));
  });
}
