import crypto from "node:crypto";
import { PLAYER_COLORS } from "../../../public/now-coding/engine.js";
import { MODE_LABELS, makeModeNpcProgram } from "../../../public/now-coding/modes.js";
import { resolveNowCodingUser } from "./store.js";

const rooms = new Map();
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const ROUND_SELECT_MS = 30_000;
const VALID_SIZES = new Set([15, 21, 31]);
const VALID_DIFFICULTIES = new Set(["weak", "medium", "strong"]);
const VALID_MODES = new Set(Object.keys(MODE_LABELS));
let cleanupTimer = null;

const channel = (id) => `now-coding:${id}`;
const text = (value, max = 120) => String(value ?? "").trim().slice(0, max);
const ack = (fn, payload) => { if (typeof fn === "function") fn(payload); };

function makeRoomId() {
  for (let i = 0; i < 100; i += 1) {
    const id = String(crypto.randomInt(100000, 1000000));
    if (!rooms.has(id)) return id;
  }
  throw new Error("room_id_exhausted");
}
function makeSeed() { return `${crypto.randomBytes(4).toString("hex")}-${crypto.randomBytes(4).toString("hex")}`; }
function normalizeModes(raw) {
  const source = Array.isArray(raw) ? raw : raw ? [raw] : ["territory"];
  const result = [];
  for (const mode of source) if (VALID_MODES.has(mode) && !result.includes(mode)) result.push(mode);
  return result.length ? result.slice(0, 4) : ["territory"];
}
function normalizeSettings(raw = {}) {
  const modes = normalizeModes(raw.modes || raw.mode);
  return {
    modes,
    mode: modes[0],
    playerCount: Math.max(2, Math.min(4, Number(raw.playerCount) || 2)),
    size: VALID_SIZES.has(Number(raw.size)) ? Number(raw.size) : 21,
    seed: text(raw.seed, 128),
    fillWithNpc: Boolean(raw.fillWithNpc),
    npcDifficulty: VALID_DIFFICULTIES.has(raw.npcDifficulty) ? raw.npcDifficulty : "medium",
    allowRoundProgramChange: modes.length > 1 && Boolean(raw.allowRoundProgramChange),
  };
}
function modeMaxTicks(mode, size) {
  if (mode === "cobra" || mode === "fall") return Math.max(600, size * size * 2);
  if (mode === "splat") return Math.max(500, size * size * 2);
  return Math.max(420, size * size * 2);
}
function seededShuffle(values, seed) {
  let h = 2166136261 >>> 0;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const random = () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function touch(room) { room.updatedAt = Date.now(); room.expiresAt = room.updatedAt + ROOM_TTL_MS; }
function sanitizeProgram(raw = {}) {
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const encoded = JSON.stringify(blocks);
  if (encoded.length > 220000) throw new Error("program_too_large");
  return { programId: text(raw.programId, 128), name: text(raw.name || "無題の駒", 60), blocks: JSON.parse(encoded) };
}
async function resolveSocketUser(socket) {
  const id = text(socket.data?.clientId, 128);
  return id ? resolveNowCodingUser(id) : null;
}
function createMember(user, role, socketId) {
  return { userTrackingId: user.userTrackingId, username: user.username, role, socketIds: new Set(socketId ? [socketId] : []), ready: false, program: null, roundProgramReady: false, color: "" };
}
const findMember = (room, id) => room.members.find((m) => m.userTrackingId === id) || null;
function memberPublic(member, viewerId) {
  return { userTrackingId: member.userTrackingId, username: member.username, role: member.role, connected: member.socketIds.size > 0, ready: Boolean(member.ready), programName: member.program?.name || "", hasProgram: Boolean(member.program?.blocks?.length), roundProgramReady: Boolean(member.roundProgramReady), color: member.color || "", isSelf: member.userTrackingId === viewerId };
}
function publicRoom(room, viewerId = "") {
  return { roomId: room.id, status: room.status, privateRoom: room.privateRoom, hostIsSelf: room.hostId === viewerId, settings: { ...room.settings }, members: room.members.map((m) => memberPublic(m, viewerId)), currentRound: room.currentRound ?? -1, roundOrder: room.status === "lobby" ? [] : [...(room.roundOrder || [])], roundDeadline: room.roundDeadline || 0, createdAt: room.createdAt, expiresAt: room.expiresAt };
}
function publicSummary(room) {
  const connected = room.members.filter((m) => m.socketIds.size > 0).length;
  return { roomId: room.id, hostName: room.members.find((m) => m.userTrackingId === room.hostId)?.username || "", modes: [...room.settings.modes], mode: room.settings.modes[0], modeLabel: room.settings.modes.map((m) => MODE_LABELS[m]).join(" / "), size: room.settings.size, playerCount: room.settings.playerCount, currentPlayers: connected, fillWithNpc: room.settings.fillWithNpc, npcDifficulty: room.settings.npcDifficulty, createdAt: room.createdAt };
}
function listPublicRooms() {
  const now = Date.now();
  return [...rooms.values()].filter((r) => r.status === "lobby" && !r.privateRoom && r.expiresAt > now).filter((r) => r.members.some((m) => m.userTrackingId === r.hostId && m.socketIds.size > 0)).filter((r) => r.members.length < r.settings.playerCount).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,40).map(publicSummary);
}
function emitRoom(io, room) {
  for (const member of room.members) for (const socketId of member.socketIds) io.to(socketId).emit("now:room-state", publicRoom(room, member.userTrackingId));
  io.emit("now:rooms-changed");
}
function closeRoom(io, room) {
  if (room.roundTimer) clearTimeout(room.roundTimer);
  rooms.delete(room.id);
  io.to(channel(room.id)).emit("now:room-closed", { roomId: room.id });
  io.in(channel(room.id)).socketsLeave(channel(room.id));
  io.emit("now:rooms-changed");
}
function removeSocketFromRooms(io, socket) {
  for (const room of rooms.values()) {
    let changed = false;
    for (const member of room.members) if (member.socketIds.delete(socket.id)) changed = true;
    if (changed) { touch(room); emitRoom(io, room); }
  }
}
function cleanupExpired(io) { const now = Date.now(); for (const room of rooms.values()) if (room.expiresAt <= now) closeRoom(io, room); }
function startCleanup(io) { if (cleanupTimer) return; cleanupTimer = setInterval(() => cleanupExpired(io), 60_000); cleanupTimer.unref?.(); }

function connectedHumans(room) { return room.members.filter((m) => m.socketIds.size > 0); }
function assignFixedColors(room) { room.members.forEach((m, i) => { m.color = PLAYER_COLORS[i] || PLAYER_COLORS[0]; }); }
function buildPlayers(room, mode) {
  const humans = connectedHumans(room).slice(0, room.settings.playerCount);
  const players = humans.map((m, i) => ({ id: m.userTrackingId, userTrackingId: m.userTrackingId, name: m.username, color: m.color || PLAYER_COLORS[i], program: m.program.blocks, programName: m.program.name }));
  const targetCount = room.settings.fillWithNpc ? room.settings.playerCount : Math.max(2, humans.length);
  while (players.length < targetCount) {
    const i = players.length;
    players.push({ id: `npc-${room.id}-${i}`, userTrackingId: "", name: `NPC${i}`, color: PLAYER_COLORS[i], program: makeModeNpcProgram(mode, room.settings.npcDifficulty, i), npcDifficulty: room.settings.npcDifficulty });
  }
  return players;
}
function emitMatchStart(io, room) {
  const mode = room.roundOrder[room.currentRound];
  const players = buildPlayers(room, mode);
  room.status = "playing";
  room.roundFinished = new Set();
  room.roundDeadline = 0;
  touch(room);
  io.to(channel(room.id)).emit("now:match-start", {
    mode,
    seed: `${room.masterSeed}:round:${room.currentRound}`,
    size: room.settings.size,
    players,
    maxTicks: modeMaxTicks(mode, room.settings.size),
    online: { roomId: room.id, saveOwnerId: room.hostId, series: true, roundIndex: room.currentRound, totalRounds: room.roundOrder.length, mode, colors: players.map((p) => p.color), allowRoundProgramChange: room.settings.allowRoundProgramChange },
  });
  emitRoom(io, room);
}
function beginRoundSelection(io, room) {
  const mode = room.roundOrder[room.currentRound];
  room.status = "round_select";
  room.roundDeadline = Date.now() + ROUND_SELECT_MS;
  for (const member of room.members) member.roundProgramReady = false;
  touch(room);
  io.to(channel(room.id)).emit("now:round-prepare", { roomId: room.id, mode, roundIndex: room.currentRound, totalRounds: room.roundOrder.length, deadline: room.roundDeadline });
  emitRoom(io, room);
  if (room.roundTimer) clearTimeout(room.roundTimer);
  room.roundTimer = setTimeout(() => { room.roundTimer = null; if (rooms.get(room.id) === room && room.status === "round_select") emitMatchStart(io, room); }, ROUND_SELECT_MS);
  room.roundTimer.unref?.();
}
function maybeStartSelectedRound(io, room) {
  if (room.status !== "round_select") return;
  const humans = connectedHumans(room);
  if (humans.length && humans.every((m) => m.roundProgramReady)) {
    if (room.roundTimer) clearTimeout(room.roundTimer);
    room.roundTimer = null;
    emitMatchStart(io, room);
  }
}
function advanceAfterRound(io, room) {
  if (room.currentRound >= room.roundOrder.length - 1) {
    room.status = "finished";
    touch(room);
    io.to(channel(room.id)).emit("now:series-finished", { roomId: room.id });
    emitRoom(io, room);
    return;
  }
  room.currentRound += 1;
  if (room.settings.allowRoundProgramChange) beginRoundSelection(io, room);
  else emitMatchStart(io, room);
}

export function mountNowCodingSocketHandlers(io) {
  startCleanup(io);
  io.on("connection", (socket) => {
    socket.on("now:list-rooms", (_payload, cb) => ack(cb, { ok: true, rooms: listPublicRooms() }));

    socket.on("now:create-room", async (payload = {}, cb) => {
      try {
        const user = await resolveSocketUser(socket); if (!user) throw new Error("login_required");
        const room = { id: makeRoomId(), hostId: user.userTrackingId, status: "lobby", privateRoom: Boolean(payload.privateRoom), settings: normalizeSettings(payload.settings || {}), members: [createMember(user, "host", socket.id)], createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + ROOM_TTL_MS, currentRound: -1, roundOrder: [], roundFinished: new Set(), roundDeadline: 0, roundTimer: null };
        rooms.set(room.id, room); socket.join(channel(room.id)); ack(cb, { ok: true, room: publicRoom(room, user.userTrackingId) }); emitRoom(io, room);
      } catch (e) { ack(cb, { ok: false, error: e?.message || "room_create_failed" }); }
    });

    socket.on("now:join-room", async (payload = {}, cb) => {
      try {
        const user = await resolveSocketUser(socket); if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20)); if (!room || room.expiresAt <= Date.now()) throw new Error("room_not_found"); if (room.status !== "lobby") throw new Error("room_not_open");
        let member = findMember(room, user.userTrackingId);
        if (!member) { if (room.members.length >= room.settings.playerCount) throw new Error("room_full"); member = createMember(user, "guest", socket.id); room.members.push(member); }
        else { member.username = user.username; member.socketIds.add(socket.id); }
        touch(room); socket.join(channel(room.id)); ack(cb, { ok: true, room: publicRoom(room, user.userTrackingId) }); emitRoom(io, room);
      } catch (e) { ack(cb, { ok: false, error: e?.message || "room_join_failed" }); }
    });

    socket.on("now:set-program", async (payload = {}, cb) => {
      try {
        const user = await resolveSocketUser(socket); if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20)); if (!room || room.status !== "lobby") throw new Error("room_not_open");
        const member = findMember(room, user.userTrackingId); if (!member) throw new Error("not_in_room");
        member.program = sanitizeProgram(payload.program || {}); member.ready = false; touch(room); ack(cb, { ok: true }); emitRoom(io, room);
      } catch (e) { ack(cb, { ok: false, error: e?.message || "program_select_failed" }); }
    });

    socket.on("now:set-ready", async (payload = {}, cb) => {
      try {
        const user = await resolveSocketUser(socket); if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20)); if (!room || room.status !== "lobby") throw new Error("room_not_open");
        const member = findMember(room, user.userTrackingId); if (!member) throw new Error("not_in_room");
        if (payload.ready && !member.program?.blocks?.length) throw new Error("program_required"); member.ready = Boolean(payload.ready); touch(room); ack(cb, { ok: true }); emitRoom(io, room);
      } catch (e) { ack(cb, { ok: false, error: e?.message || "ready_failed" }); }
    });

    socket.on("now:start-room", async (payload = {}, cb) => {
      try {
        const user = await resolveSocketUser(socket); if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20)); if (!room || room.status !== "lobby") throw new Error("room_not_open"); if (room.hostId !== user.userTrackingId) throw new Error("host_only");
        const humans = connectedHumans(room); if (humans.some((m) => !m.program?.blocks?.length || !m.ready)) throw new Error("members_not_ready"); if (humans.length < 2 && !room.settings.fillWithNpc) throw new Error("need_two_players");
        assignFixedColors(room); room.masterSeed = room.settings.seed || makeSeed(); room.roundOrder = seededShuffle(room.settings.modes, room.masterSeed); room.currentRound = 0; room.startedAt = Date.now(); ack(cb, { ok: true }); emitMatchStart(io, room); io.emit("now:rooms-changed");
      } catch (e) { ack(cb, { ok: false, error: e?.message || "room_start_failed" }); }
    });

    socket.on("now:round-finished", async (payload = {}, cb) => {
      try {
        const user = await resolveSocketUser(socket); if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20)); if (!room || room.status !== "playing") throw new Error("room_not_playing");
        if (Number(payload.roundIndex) !== room.currentRound) throw new Error("round_mismatch"); const member = findMember(room, user.userTrackingId); if (!member) throw new Error("not_in_room");
        room.roundFinished.add(user.userTrackingId); touch(room); ack(cb, { ok: true });
        const humans = connectedHumans(room); if (humans.length && humans.every((m) => room.roundFinished.has(m.userTrackingId))) advanceAfterRound(io, room);
      } catch (e) { ack(cb, { ok: false, error: e?.message || "round_finish_failed" }); }
    });

    socket.on("now:set-round-program", async (payload = {}, cb) => {
      try {
        const user = await resolveSocketUser(socket); if (!user) throw new Error("login_required");
        const room = rooms.get(text(payload.roomId, 20)); if (!room || room.status !== "round_select") throw new Error("round_not_selecting");
        const member = findMember(room, user.userTrackingId); if (!member) throw new Error("not_in_room"); member.program = sanitizeProgram(payload.program || {}); member.roundProgramReady = true; touch(room); ack(cb, { ok: true }); emitRoom(io, room); maybeStartSelectedRound(io, room);
      } catch (e) { ack(cb, { ok: false, error: e?.message || "round_program_failed" }); }
    });

    socket.on("now:leave-room", async (payload = {}, cb) => {
      try {
        const user = await resolveSocketUser(socket); if (!user) throw new Error("login_required"); const room = rooms.get(text(payload.roomId, 20)); if (!room) throw new Error("room_not_found");
        const index = room.members.findIndex((m) => m.userTrackingId === user.userTrackingId); if (index < 0) throw new Error("not_in_room");
        if (room.hostId === user.userTrackingId) closeRoom(io, room); else { room.members.splice(index, 1); touch(room); emitRoom(io, room); }
        socket.leave(channel(room.id)); ack(cb, { ok: true });
      } catch (e) { ack(cb, { ok: false, error: e?.message || "leave_failed" }); }
    });

    socket.on("now:finish-room", async (payload = {}, cb) => {
      try { const user = await resolveSocketUser(socket); if (!user) throw new Error("login_required"); const room = rooms.get(text(payload.roomId, 20)); if (!room) return ack(cb, { ok: true }); if (room.hostId !== user.userTrackingId) throw new Error("host_only"); closeRoom(io, room); ack(cb, { ok: true }); }
      catch (e) { ack(cb, { ok: false, error: e?.message || "finish_failed" }); }
    });

    socket.on("disconnect", () => removeSocketFromRooms(io, socket));
  });
}
