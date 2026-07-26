import crypto from "node:crypto";
import {
  evaluateExpression,
  ExpressionError,
  isTen,
  validateDigitUsage,
} from "../../public/10を自由に/expression-engine.js";
import { readUserSessionFromCookieHeader } from "./storage.js";
import {
  findActiveTenFreelyRoomByUser,
  findTenFreelyRoomById,
  upsertTenFreelyRoom,
} from "./storage.js";
import {
  AVAILABLE_PROBLEM_COUNTS,
  createRandomProblem,
  createUsedProblemMap,
  VALID_DIGIT_LENGTHS,
} from "./problems.js";

const rooms = new Map();
const VALID_LIVES = new Set([1, 3, 5]);
const VALID_WIN_TARGETS = new Set([3, 5, 10]);
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const INACTIVITY_WARNING_MS = 60 * 1000;
const INACTIVITY_ESCAPE_MS = 120 * 1000;
const RULE_VERSION = 1;
let maintenanceTimer = null;

function roomSocketName(roomId) {
  return `ten-freely:${roomId}`;
}

function userSocketName(userTrackingId) {
  return `ten-freely-user:${userTrackingId}`;
}

function normalizeSettings(raw = {}) {
  const digitLengths = [...new Set((Array.isArray(raw.digitLengths) ? raw.digitLengths : [])
    .map(Number)
    .filter((value) => VALID_DIGIT_LENGTHS.has(value)))]
    .sort((a, b) => a - b);
  const lives = Number(raw.lives);
  const winsToFinish = Number(raw.winsToFinish);
  if (!digitLengths.length) throw new Error("invalid_digit_lengths");
  if (!VALID_LIVES.has(lives)) throw new Error("invalid_lives");
  if (!VALID_WIN_TARGETS.has(winsToFinish)) throw new Error("invalid_win_target");
  return { digitLengths, lives, winsToFinish };
}

async function makeRoomId() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = String(crypto.randomInt(100000, 1000000));
    if (rooms.has(id)) continue;
    const stored = await findTenFreelyRoomById(id).catch(() => null);
    if (!stored || stored.status === "closed" || Number(stored.expiresAt || 0) <= Date.now()) return id;
  }
  throw new Error("room_create_failed");
}

function createMember(session, role) {
  return {
    id: session.userTrackingId,
    username: session.username,
    role,
    wins: 0,
    lives: 0,
    readyForNext: false,
    connected: false,
    lastActivityAt: Date.now(),
    inactivityWarned: false,
    stats: { submissions: 0, incorrect: 0, mathErrors: 0, solves: 0, totalSolveTimeMs: 0, fastestSolveMs: null, retires: 0 },
  };
}

function touchRoom(room) {
  room.updatedAt = Date.now();
  room.expiresAt = room.updatedAt + ROOM_TTL_MS;
}

function touchMember(room, member) {
  member.lastActivityAt = Date.now();
  member.inactivityWarned = false;
  touchRoom(room);
}

function publicRoundResult(result) {
  if (!result) return null;
  const { winnerId, ...safe } = result;
  return safe;
}

function publicMatchResult(result) {
  if (!result) return null;
  const { winnerId, ...safe } = result;
  return safe;
}

function publicRoom(room, viewerId = "") {
  return {
    roomId: room.id,
    status: room.status,
    settings: room.settings,
    hostIsSelf: room.hostId === viewerId,
    members: room.members.map((member) => ({
      username: member.username,
      role: member.role,
      wins: member.wins,
      lives: member.lives,
      readyForNext: member.readyForNext,
      connected: member.connected,
      isSelf: member.id === viewerId,
    })),
    currentProblem: room.currentProblem,
    roundNumber: room.roundNumber,
    roundStartedAt: room.roundStartedAt,
    roundResult: publicRoundResult(room.roundResult),
    matchResult: publicMatchResult(room.matchResult),
    expiresAt: room.expiresAt,
    ruleVersion: RULE_VERSION,
  };
}

async function checkpointQuietly(room) {
  try { await upsertTenFreelyRoom(room); }
  catch (error) { console.warn("[ten-freely] room checkpoint failed", room.id, error?.message || error); }
}

function normalizeRestoredRoom(room) {
  if (!room) return null;
  room.members = Array.isArray(room.members) ? room.members : [];
  room.usedProblemsByLength = room.usedProblemsByLength instanceof Map
    ? room.usedProblemsByLength
    : createUsedProblemMap(room.settings?.digitLengths || [3]);
  for (const member of room.members) {
    member.connected = false;
    member.readyForNext = Boolean(member.readyForNext);
    member.inactivityWarned = false;
    member.lastActivityAt = Date.now();
    member.stats = { submissions: 0, incorrect: 0, mathErrors: 0, solves: 0, totalSolveTimeMs: 0, fastestSolveMs: null, retires: 0, ...(member.stats || {}) };
  }
  room.roundHistory = Array.isArray(room.roundHistory) ? room.roundHistory : [];
  return room;
}

async function loadRoom(roomId) {
  const id = String(roomId || "").trim();
  if (!id) return null;
  const memoryRoom = rooms.get(id);
  if (memoryRoom) return memoryRoom;
  const stored = normalizeRestoredRoom(await findTenFreelyRoomById(id));
  if (!stored || Number(stored.expiresAt || 0) <= Date.now() || stored.status === "closed") return null;
  rooms.set(stored.id, stored);
  return stored;
}

export async function createOnlineRoom({ session, settings }) {
  const normalized = normalizeSettings(settings);
  const now = Date.now();
  const room = {
    id: await makeRoomId(),
    hostId: session.userTrackingId,
    status: "lobby",
    settings: normalized,
    members: [createMember(session, "host")],
    usedProblemsByLength: createUsedProblemMap(normalized.digitLengths),
    currentProblem: null,
    roundNumber: 0,
    roundStartedAt: null,
    roundResult: null,
    roundHistory: [],
    matchResult: null,
    matchStartedAt: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ROOM_TTL_MS,
    ruleVersion: RULE_VERSION,
  };
  rooms.set(room.id, room);
  await checkpointQuietly(room);
  return publicRoom(room, session.userTrackingId);
}

export async function joinOnlineRoom({ roomId, session }) {
  const room = await loadRoom(roomId);
  if (!room) throw new Error("room_not_found");
  if (room.status !== "lobby") throw new Error("room_not_lobby");
  const existing = room.members.find((member) => member.id === session.userTrackingId);
  if (existing) {
    existing.username = session.username;
    touchMember(room, existing);
  } else {
    if (room.members.length >= 2) throw new Error("room_full");
    room.members.push(createMember(session, "guest"));
    touchRoom(room);
  }
  await checkpointQuietly(room);
  return publicRoom(room, session.userTrackingId);
}

export async function getActiveOnlineRoom(session) {
  let room = [...rooms.values()]
    .filter((candidate) => candidate.status !== "closed" && candidate.expiresAt > Date.now())
    .find((candidate) => candidate.members.some((member) => member.id === session.userTrackingId));
  if (!room) {
    room = normalizeRestoredRoom(await findActiveTenFreelyRoomByUser(session.userTrackingId));
    if (room) rooms.set(room.id, room);
  }
  return room ? publicRoom(room, session.userTrackingId) : null;
}

export async function getOnlineRoomForUser(roomId, session) {
  const room = await loadRoom(roomId);
  if (!room) throw new Error("room_not_found");
  if (!room.members.some((member) => member.id === session.userTrackingId)) throw new Error("forbidden");
  return publicRoom(room, session.userTrackingId);
}

function beginRound(room) {
  const problem = createRandomProblem({
    digitLengths: room.settings.digitLengths,
    usedProblemsByLength: room.usedProblemsByLength,
  });
  if (!problem) {
    room.status = "finished";
    room.matchResult = buildMatchResult(room, "all_problems_completed");
    touchRoom(room);
    return;
  }
  room.status = "playing";
  room.matchStartedAt ||= Date.now();
  room.currentProblem = problem;
  room.roundNumber += 1;
  room.roundStartedAt = Date.now();
  room.roundResult = null;
  for (const member of room.members) {
    member.lives = room.settings.lives;
    member.readyForNext = false;
    member.lastActivityAt = room.roundStartedAt;
    member.inactivityWarned = false;
  }
  touchRoom(room);
}

function buildMatchResult(room, reason = "win_target_reached") {
  const ordered = [...room.members].sort((a, b) => b.wins - a.wins);
  const isTie = ordered.length < 2 || ordered[0]?.wins === ordered[1]?.wins;
  const finishedAt = Date.now();
  return {
    reason,
    winnerName: isTie ? null : ordered[0]?.username || null,
    winnerId: isTie ? null : ordered[0]?.id || null,
    scores: room.members.map((member) => ({ username: member.username, wins: member.wins })),
    players: room.members.map((member) => {
      const stats = member.stats || {};
      return {
        username: member.username,
        wins: member.wins,
        submissions: Number(stats.submissions || 0),
        incorrect: Number(stats.incorrect || 0),
        mathErrors: Number(stats.mathErrors || 0),
        solves: Number(stats.solves || 0),
        fastestSolveMs: Number.isFinite(stats.fastestSolveMs) ? stats.fastestSolveMs : null,
        averageSolveMs: stats.solves ? Math.round(Number(stats.totalSolveTimeMs || 0) / stats.solves) : null,
        accuracy: stats.submissions ? Number(stats.solves || 0) / stats.submissions : 0,
        retires: Number(stats.retires || 0),
      };
    }),
    rounds: room.roundHistory.map(publicRoundResult),
    roundCount: room.roundHistory.length,
    startedAt: room.matchStartedAt || room.createdAt,
    finishedAt,
    durationMs: Math.max(0, finishedAt - Number(room.matchStartedAt || room.createdAt || finishedAt)),
  };
}

function resolveRound(room, winner, loser, { reason, expression = "", answerTimeMs = null } = {}) {
  if (room.status !== "playing") return null;
  winner.wins += 1;
  const result = {
    roundNumber: room.roundNumber,
    problem: room.currentProblem,
    winnerName: winner.username,
    winnerId: winner.id,
    loserName: loser.username,
    reason,
    expression,
    answerTimeMs: Number.isFinite(answerTimeMs) ? answerTimeMs : Math.max(0, Date.now() - room.roundStartedAt),
    resolvedAt: Date.now(),
  };
  room.roundResult = result;
  room.roundHistory.push(result);
  room.status = winner.wins >= room.settings.winsToFinish ? "finished" : "round_result";
  if (room.status === "finished") room.matchResult = buildMatchResult(room);
  for (const member of room.members) member.readyForNext = false;
  touchRoom(room);
  checkpointQuietly(room);
  return result;
}

function mathematicalFailure(error) {
  return error instanceof ExpressionError && [
    "division_by_zero",
    "negative_sqrt",
    "invalid_factorial",
    "invalid_permutation",
    "invalid_combination",
    "not_finite",
    "too_large",
  ].includes(error.code);
}

function emitRoomState(io, room) {
  for (const member of room.members) {
    io.to(userSocketName(member.id)).emit("ten:room-state", publicRoom(room, member.id));
  }
}

function emitRoundResult(io, room) {
  for (const member of room.members) {
    io.to(userSocketName(member.id)).emit("ten:round-result", {
      room: publicRoom(room, member.id),
      result: publicRoundResult(room.roundResult),
    });
  }
  if (room.status === "finished") {
    for (const member of room.members) {
      io.to(userSocketName(member.id)).emit("ten:match-finished", {
        room: publicRoom(room, member.id),
        result: publicMatchResult(room.matchResult),
      });
    }
  }
}

async function closeRoom(io, room, reason, requestedBy = "") {
  if (!room || room.status === "closed") return;
  room.status = "closed";
  room.matchResult ||= buildMatchResult(room, reason);
  room.matchResult.reason = reason;
  room.matchResult.requestedBy = requestedBy;
  touchRoom(room);
  await checkpointQuietly(room);
  io.to(roomSocketName(room.id)).emit("ten:room-closed", { reason, requestedBy, result: publicMatchResult(room.matchResult) });
  for (const member of room.members) io.in(userSocketName(member.id)).socketsLeave(roomSocketName(room.id));
}

export function registerTenFreelyOnlineSockets(io) {
  io.on("connection", (socket) => {
    const session = readUserSessionFromCookieHeader(socket.request?.headers?.cookie || "");
    if (!session) return;
    socket.data.tenUser = session;
    socket.join(userSocketName(session.userTrackingId));

    socket.on("ten:join", async (payload = {}, ack) => {
      try {
        const room = await loadRoom(payload.roomId);
        if (!room) throw new Error("room_not_found");
        const member = room.members.find((entry) => entry.id === session.userTrackingId);
        if (!member) throw new Error("forbidden");
        socket.data.tenRoomId = room.id;
        socket.join(roomSocketName(room.id));
        member.connected = true;
        member.username = session.username;
        touchMember(room, member);
        checkpointQuietly(room);
        emitRoomState(io, room);
        ack?.({ ok: true, room: publicRoom(room, member.id) });
      } catch (error) {
        ack?.({ ok: false, error: error.message || "server_error" });
      }
    });

    socket.on("ten:activity", async (payload = {}, ack) => {
      try {
        const room = await loadRoom(payload.roomId || socket.data.tenRoomId);
        const member = room?.members.find((entry) => entry.id === session.userTrackingId);
        if (!room || !member) throw new Error("forbidden");
        touchMember(room, member);
        io.to(userSocketName(member.id)).emit("ten:inactivity-clear");
        ack?.({ ok: true });
      } catch (error) { ack?.({ ok: false, error: error.message || "server_error" }); }
    });

    socket.on("ten:start", async (payload = {}, ack) => {
      try {
        const room = await loadRoom(payload.roomId || socket.data.tenRoomId);
        if (!room) throw new Error("room_not_found");
        if (room.hostId !== session.userTrackingId) throw new Error("forbidden");
        if (room.status !== "lobby") throw new Error("room_not_lobby");
        if (room.members.length !== 2) throw new Error("room_not_ready");
        beginRound(room);
        await checkpointQuietly(room);
        emitRoomState(io, room);
        ack?.({ ok: true, room: publicRoom(room, session.userTrackingId) });
      } catch (error) { ack?.({ ok: false, error: error.message || "server_error" }); }
    });

    socket.on("ten:submit", async (payload = {}, ack) => {
      try {
        const room = await loadRoom(payload.roomId || socket.data.tenRoomId);
        if (!room || room.status !== "playing") throw new Error("round_not_playing");
        const member = room.members.find((entry) => entry.id === session.userTrackingId);
        const opponent = room.members.find((entry) => entry.id !== session.userTrackingId);
        if (!member || !opponent) throw new Error("forbidden");
        touchMember(room, member);
        member.stats.submissions += 1;
        const expression = String(payload.expression || "").trim();
        let evaluated;
        try { evaluated = evaluateExpression(expression); }
        catch (error) {
          if (!mathematicalFailure(error)) {
            return ack?.({ ok: false, error: "invalid_expression", expressionError: { code: error.code, message: error.message } });
          }
          member.stats.incorrect += 1;
          member.stats.mathErrors += 1;
          member.lives -= 1;
          if (member.lives <= 0) {
            resolveRound(room, opponent, member, { reason: "lives_depleted" });
            emitRoundResult(io, room);
          } else {
            emitRoomState(io, room);
          }
          return ack?.({
            ok: true,
            correct: false,
            expressionError: { code: error.code, message: error.message },
            room: publicRoom(room, member.id),
          });
        }

        const usage = validateDigitUsage(evaluated.ast, room.currentProblem);
        if (!usage.valid) return ack?.({ ok: false, error: "digits_not_used_exactly" });
        const answerTimeMs = Math.max(0, Date.now() - room.roundStartedAt);
        if (isTen(evaluated.value)) {
          member.stats.solves += 1;
          member.stats.totalSolveTimeMs += answerTimeMs;
          member.stats.fastestSolveMs = member.stats.fastestSolveMs == null ? answerTimeMs : Math.min(member.stats.fastestSolveMs, answerTimeMs);
          resolveRound(room, member, opponent, { reason: "made_ten", expression, answerTimeMs });
          emitRoundResult(io, room);
          return ack?.({ ok: true, correct: true, answerTimeMs, value: evaluated.value, room: publicRoom(room, member.id) });
        }

        member.stats.incorrect += 1;
        member.lives -= 1;
        if (member.lives <= 0) {
          resolveRound(room, opponent, member, { reason: "lives_depleted", expression, answerTimeMs });
          emitRoundResult(io, room);
        } else {
          emitRoomState(io, room);
        }
        return ack?.({ ok: true, correct: false, value: evaluated.value, answerTimeMs, room: publicRoom(room, member.id) });
      } catch (error) {
        ack?.({ ok: false, error: error.message || "server_error" });
      }
    });

    socket.on("ten:retire", async (payload = {}, ack) => {
      try {
        const room = await loadRoom(payload.roomId || socket.data.tenRoomId);
        if (!room || room.status !== "playing") throw new Error("round_not_playing");
        const member = room.members.find((entry) => entry.id === session.userTrackingId);
        const opponent = room.members.find((entry) => entry.id !== session.userTrackingId);
        if (!member || !opponent) throw new Error("forbidden");
        member.lives = 0;
        member.stats.retires += 1;
        touchMember(room, member);
        resolveRound(room, opponent, member, { reason: "retired" });
        emitRoundResult(io, room);
        ack?.({ ok: true });
      } catch (error) { ack?.({ ok: false, error: error.message || "server_error" }); }
    });

    socket.on("ten:ready-next", async (payload = {}, ack) => {
      try {
        const room = await loadRoom(payload.roomId || socket.data.tenRoomId);
        if (!room || room.status !== "round_result") throw new Error("round_not_waiting");
        const member = room.members.find((entry) => entry.id === session.userTrackingId);
        if (!member) throw new Error("forbidden");
        member.readyForNext = true;
        touchMember(room, member);
        if (room.members.every((entry) => entry.readyForNext)) beginRound(room);
        await checkpointQuietly(room);
        emitRoomState(io, room);
        ack?.({ ok: true, room: publicRoom(room, member.id) });
      } catch (error) { ack?.({ ok: false, error: error.message || "server_error" }); }
    });

    socket.on("ten:leave", async (payload = {}, ack) => {
      try {
        const room = await loadRoom(payload.roomId || socket.data.tenRoomId);
        if (!room || !room.members.some((entry) => entry.id === session.userTrackingId)) throw new Error("forbidden");
        await closeRoom(io, room, "player_left", session.username);
        ack?.({ ok: true });
      } catch (error) { ack?.({ ok: false, error: error.message || "server_error" }); }
    });

    socket.on("disconnect", async () => {
      const room = await loadRoom(socket.data.tenRoomId).catch(() => null);
      const member = room?.members.find((entry) => entry.id === session.userTrackingId);
      if (!room || !member) return;
      member.connected = false;
      touchRoom(room);
      checkpointQuietly(room);
      emitRoomState(io, room);
    });
  });
}

export function startTenFreelyOnlineMaintenance(io) {
  if (maintenanceTimer) return;
  maintenanceTimer = setInterval(async () => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.status === "closed") continue;
      if (room.expiresAt <= now) {
        await closeRoom(io, room, "expired");
        continue;
      }
      if (!["playing", "round_result"].includes(room.status)) continue;

      const inactive = room.members.filter((member) => now - Number(member.lastActivityAt || 0) >= INACTIVITY_ESCAPE_MS);
      if (inactive.length === room.members.length) {
        await closeRoom(io, room, "both_inactive");
        continue;
      }
      if (inactive.length) {
        const escaped = inactive[0];
        const opponent = room.members.find((member) => member.id !== escaped.id);
        room.status = "finished";
        room.matchResult = buildMatchResult(room, "opponent_escaped");
        room.matchResult.winnerName = opponent?.username || null;
        room.matchResult.winnerId = opponent?.id || null;
        room.matchResult.escapedName = escaped.username;
        touchRoom(room);
        await checkpointQuietly(room);
        for (const member of room.members) {
          io.to(userSocketName(member.id)).emit("ten:match-finished", {
            room: publicRoom(room, member.id),
            result: publicMatchResult(room.matchResult),
          });
        }
        continue;
      }

      for (const member of room.members) {
        if (!member.inactivityWarned && now - Number(member.lastActivityAt || 0) >= INACTIVITY_WARNING_MS) {
          member.inactivityWarned = true;
          io.to(userSocketName(member.id)).emit("ten:inactivity-warning", {
            remainingMs: INACTIVITY_ESCAPE_MS - (now - member.lastActivityAt),
          });
        }
      }
    }
  }, 5000);
  maintenanceTimer.unref?.();
}

export const onlineConstants = {
  availableProblemCounts: AVAILABLE_PROBLEM_COUNTS,
  inactivityWarningMs: INACTIVITY_WARNING_MS,
  inactivityEscapeMs: INACTIVITY_ESCAPE_MS,
};
