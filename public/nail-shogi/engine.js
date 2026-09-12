export const BOARD = Object.freeze({ cols: 10, rows: 8, capturesToWin: 2, carePerTurn: 2 });
export const FINGER_NAMES = Object.freeze(["親指", "人差し指", "中指", "薬指", "小指"]);
export const DIRECTIONS = Object.freeze([-1, 0, 1]);
export const ROOT_COLS = Object.freeze({
  0: Object.freeze([0, 2, 4, 6, 8]),
  1: Object.freeze([1, 3, 5, 7, 9]),
});
export const START_STOCK = Object.freeze({ gel: 4, hook: 2, sculpt: 2 });

const clone = (value) => structuredClone(value);
const key = (x, y) => `${x},${y}`;
const inBounds = (x, y) => x >= 0 && x < BOARD.cols && y >= 0 && y < BOARD.rows;
const sameCell = (a, b) => a.x === b.x && a.y === b.y;

function makeMaterial(kind = "bare") {
  return { kind, gel: false, sharpened: false };
}

export function rootFor(player, fingerIndex) {
  return {
    x: ROOT_COLS[player][fingerIndex],
    y: player === 0 ? BOARD.rows : -1,
  };
}

export function firstCellFor(player, fingerIndex) {
  const root = rootFor(player, fingerIndex);
  return { x: root.x, y: player === 0 ? BOARD.rows - 1 : 0 };
}

function makeNail(player, fingerIndex) {
  return {
    id: `${player}:${fingerIndex}`,
    player,
    fingerIndex,
    alive: true,
    direction: 0,
    path: [firstCellFor(player, fingerIndex)],
    materials: [makeMaterial()],
    hiddenThisRound: false,
    hidLastRound: false,
    sculptPending: false,
    careUsedThisRound: false,
  };
}

export function createInitialState({ mode = "online" } = {}) {
  const nails = [];
  for (let player = 0; player < 2; player += 1) {
    for (let finger = 0; finger < 5; finger += 1) nails.push(makeNail(player, finger));
  }
  return {
    version: 2,
    mode,
    round: 1,
    phase: "command",
    firstCommander: 0,
    commander: 0,
    careRemaining: [BOARD.carePerTurn, BOARD.carePerTurn],
    captures: [0, 0],
    capturedFingers: [[], []],
    stock: [clone(START_STOCK), clone(START_STOCK)],
    nails,
    deferred: [],
    winner: null,
    lastEvents: [],
  };
}

export function getNail(state, player, fingerIndex) {
  return state.nails.find((nail) => nail.player === player && nail.fingerIndex === fingerIndex);
}

export function currentTip(nail) {
  return nail.path[nail.path.length - 1] || firstCellFor(nail.player, nail.fingerIndex);
}

export function tipMaterial(nail) {
  return nail.materials[nail.materials.length - 1] || makeMaterial();
}

export function attackPower(nail, contactKind = "tip") {
  const material = tipMaterial(nail);
  if (contactKind === "body" && material.kind === "hook") return 3;
  return 1 + (material.sharpened ? 1 : 0);
}

export function segmentDefense(nail, segmentIndex) {
  const material = nail.materials[segmentIndex] || makeMaterial();
  const isTip = segmentIndex === nail.path.length - 1;
  const base = isTip ? 1 : 2;
  return base + (material.gel ? 1 : 0);
}

function candidateFor(nail) {
  const tip = currentTip(nail);
  const dy = nail.player === 0 ? -1 : 1;
  return { x: tip.x + nail.direction, y: tip.y + dy };
}

function segmentIndexAt(nail, cell) {
  return nail.path.findIndex((point) => sameCell(point, cell));
}

function enemyFingerAt(state, attacker, cell) {
  const enemy = 1 - attacker.player;
  const fingerIndex = ROOT_COLS[enemy].indexOf(cell.x);
  if (fingerIndex < 0) return null;
  const targetY = enemy === 0 ? BOARD.rows - 1 : 0;
  if (cell.y !== targetY) return null;
  if (state.capturedFingers[enemy].includes(fingerIndex)) return null;
  return { player: enemy, fingerIndex };
}

function segmentSnapshot(nail, start = 0) {
  return nail.path.slice(start).map((cell, offset) => ({
    cell: { ...cell },
    material: clone(nail.materials[start + offset] || makeMaterial()),
  }));
}

function cutFrom(nail, index) {
  if (index < 0 || index >= nail.path.length) return [];
  const removed = segmentSnapshot(nail, index);
  if (index === 0) {
    nail.path = [firstCellFor(nail.player, nail.fingerIndex)];
    nail.materials = [makeMaterial()];
    return removed;
  }
  nail.path = nail.path.slice(0, index);
  nail.materials = nail.materials.slice(0, index);
  return removed;
}

function breakTip(nail) {
  if (!nail.path.length) return [];
  if (nail.path.length === 1) {
    const removed = segmentSnapshot(nail, 0);
    nail.path = [firstCellFor(nail.player, nail.fingerIndex)];
    nail.materials = [makeMaterial()];
    return removed;
  }
  return cutFrom(nail, nail.path.length - 1);
}

function resetNail(nail) {
  nail.path = [firstCellFor(nail.player, nail.fingerIndex)];
  nail.materials = [makeMaterial()];
  nail.direction = 0;
  nail.sculptPending = false;
  nail.hiddenThisRound = false;
}

function cellsByOccupant(state) {
  const map = new Map();
  for (const nail of state.nails) {
    if (!nail.alive) continue;
    nail.path.forEach((cell, index) => {
      const k = key(cell.x, cell.y);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({ nail, index });
    });
  }
  return map;
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsCrossStrict(a1, a2, b1, b2) {
  const c1 = orientation(a1, a2, b1);
  const c2 = orientation(a1, a2, b2);
  const c3 = orientation(b1, b2, a1);
  const c4 = orientation(b1, b2, a2);
  return c1 * c2 < 0 && c3 * c4 < 0;
}

function movementContact(a, aNext, b, bNext) {
  const aPrev = currentTip(a);
  const bPrev = currentTip(b);
  if (sameCell(aNext, bNext)) return { kind: "same-cell", point: { ...aNext } };
  if (sameCell(aNext, bPrev) && sameCell(bNext, aPrev)) {
    return { kind: "swap", point: { x: (aPrev.x + bPrev.x) / 2, y: (aPrev.y + bPrev.y) / 2 } };
  }
  if (segmentsCrossStrict(aPrev, aNext, bPrev, bNext)) {
    return {
      kind: "cross",
      point: {
        x: (aPrev.x + aNext.x + bPrev.x + bNext.x) / 4,
        y: (aPrev.y + aNext.y + bPrev.y + bNext.y) / 4,
      },
    };
  }
  return null;
}

function resolveTipPair(a, b, breakIds, events, point, source = "growth") {
  const pa = attackPower(a, "tip");
  const pb = attackPower(b, "tip");
  const da = segmentDefense(a, a.path.length - 1);
  const db = segmentDefense(b, b.path.length - 1);
  if (pb >= da) breakIds.add(a.id);
  if (pa >= db) breakIds.add(b.id);
  events.push({
    type: "tip-collision",
    source,
    nails: [a.id, b.id],
    point: { ...point },
    powers: [pa, pb],
    defenses: [da, db],
  });
}

function emitRemoval(events, type, nail, removed, cause, point = null) {
  if (!removed?.length) return;
  events.push({
    type,
    nailId: nail.id,
    player: nail.player,
    fingerIndex: nail.fingerIndex,
    removed,
    cause,
    point: point ? { ...point } : { ...removed[0].cell },
  });
}

function resolveDeferred(state, events) {
  const pending = state.deferred;
  state.deferred = [];
  const tipBreakIds = new Set();
  const cutIndexById = new Map();

  for (const contact of pending) {
    if (contact.kind === "tip-pair") {
      const a = state.nails.find((nail) => nail.id === contact.aId);
      const b = state.nails.find((nail) => nail.id === contact.bId);
      if (!a?.alive || !b?.alive) continue;
      resolveTipPair(a, b, tipBreakIds, events, contact.point, "reveal");
      continue;
    }

    const attacker = state.nails.find((nail) => nail.id === contact.attackerId);
    const defender = state.nails.find((nail) => nail.id === contact.defenderId);
    if (!attacker?.alive || !defender?.alive) continue;
    const index = segmentIndexAt(defender, contact.cell);
    if (index < 0) continue;
    const kind = index === defender.path.length - 1 ? "tip" : "body";
    const p = attackPower(attacker, kind);
    const d = segmentDefense(defender, index);
    events.push({
      type: "segment-collision",
      source: "reveal",
      attackerId: attacker.id,
      defenderId: defender.id,
      point: { ...contact.cell },
      p,
      d,
      contactKind: kind,
    });
    if (p <= d) tipBreakIds.add(attacker.id);
    if (p >= d) {
      const previous = cutIndexById.get(defender.id);
      if (previous == null || index < previous) cutIndexById.set(defender.id, index);
    }
  }

  for (const id of tipBreakIds) {
    const nail = state.nails.find((item) => item.id === id);
    if (!nail?.alive) continue;
    emitRemoval(events, "break", nail, breakTip(nail), "reveal");
  }
  for (const [id, index] of cutIndexById) {
    const nail = state.nails.find((item) => item.id === id);
    if (!nail?.alive) continue;
    emitRemoval(events, "sever", nail, cutFrom(nail, index), "reveal");
  }
}

function captureFinger(state, attacker, target, events) {
  const attackPath = segmentSnapshot(attacker, 0);
  const targetNail = getNail(state, target.player, target.fingerIndex);
  const defenderPath = targetNail?.alive ? segmentSnapshot(targetNail, 0) : [];

  if (!state.capturedFingers[target.player].includes(target.fingerIndex)) {
    state.capturedFingers[target.player].push(target.fingerIndex);
    state.captures[attacker.player] += 1;
  }
  if (targetNail) {
    targetNail.alive = false;
    targetNail.path = [];
    targetNail.materials = [];
  }
  resetNail(attacker);
  events.push({
    type: "capture",
    attackerPlayer: attacker.player,
    attackerFinger: attacker.fingerIndex,
    attackerId: attacker.id,
    defenderPlayer: target.player,
    defenderFinger: target.fingerIndex,
    defenderId: targetNail?.id || `${target.player}:${target.fingerIndex}`,
    cell: firstCellFor(target.player, target.fingerIndex),
    attackPath,
    defenderPath,
  });
}

function resolveGrowthStep(state, activeNails, { extra = false } = {}) {
  const events = [];
  const occupancy = cellsByOccupant(state);
  const candidates = new Map();
  const blocked = new Set();
  const tipBreakIds = new Set();
  const cutIndexById = new Map();
  const captures = [];
  const collisionPointById = new Map();

  for (const nail of activeNails) {
    if (!nail.alive) continue;
    const cell = candidateFor(nail);
    candidates.set(nail.id, cell);
    if (!inBounds(cell.x, cell.y)) {
      blocked.add(nail.id);
      events.push({ type: "edge-block", nailId: nail.id, player: nail.player, fingerIndex: nail.fingerIndex, point: cell });
    }
  }

  const entries = [...candidates.entries()];
  for (let i = 0; i < entries.length; i += 1) {
    const [idA, nextA] = entries[i];
    const a = state.nails.find((nail) => nail.id === idA);
    if (!a?.alive || blocked.has(idA)) continue;

    for (let j = i + 1; j < entries.length; j += 1) {
      const [idB, nextB] = entries[j];
      const b = state.nails.find((nail) => nail.id === idB);
      if (!b?.alive || blocked.has(idB)) continue;
      const contact = movementContact(a, nextA, b, nextB);
      if (!contact) continue;

      if (a.player === b.player) {
        blocked.add(a.id);
        blocked.add(b.id);
        events.push({
          type: "own-block",
          nails: [a.id, b.id],
          player: a.player,
          point: contact.point,
          reason: contact.kind,
        });
        continue;
      }

      if (a.hiddenThisRound || b.hiddenThisRound) {
        state.deferred.push({ kind: "tip-pair", aId: a.id, bId: b.id, point: contact.point });
        events.push({ type: "phase-through", nails: [a.id, b.id], point: contact.point });
        continue;
      }

      resolveTipPair(a, b, tipBreakIds, events, contact.point);
      collisionPointById.set(a.id, contact.point);
      collisionPointById.set(b.id, contact.point);
      blocked.add(a.id);
      blocked.add(b.id);
    }
  }

  for (const nail of activeNails) {
    if (!nail.alive || blocked.has(nail.id)) continue;
    const cell = candidates.get(nail.id);
    if (!cell) continue;

    const targetFinger = enemyFingerAt(state, nail, cell);
    if (targetFinger) {
      captures.push({ nail, target: targetFinger });
      blocked.add(nail.id);
      continue;
    }

    const occupants = occupancy.get(key(cell.x, cell.y)) || [];
    const own = occupants.find((entry) => entry.nail.player === nail.player && entry.nail.id !== nail.id);
    if (own) {
      blocked.add(nail.id);
      events.push({
        type: "own-block",
        nails: [nail.id, own.nail.id],
        player: nail.player,
        point: { ...cell },
        reason: "occupied",
      });
      continue;
    }

    const enemies = occupants.filter((entry) => entry.nail.player !== nail.player);
    if (!enemies.length) continue;

    if (nail.hiddenThisRound || enemies.every((entry) => entry.nail.hiddenThisRound)) {
      for (const enemy of enemies) {
        state.deferred.push({
          kind: "segment",
          attackerId: nail.id,
          defenderId: enemy.nail.id,
          cell: { ...cell },
        });
      }
      events.push({ type: "phase-through", nails: [nail.id, ...enemies.map((entry) => entry.nail.id)], point: { ...cell } });
      continue;
    }

    let survives = true;
    for (const enemy of enemies) {
      const contactKind = enemy.index === enemy.nail.path.length - 1 ? "tip" : "body";
      const p = attackPower(nail, contactKind);
      const d = segmentDefense(enemy.nail, enemy.index);
      events.push({
        type: "segment-collision",
        source: "growth",
        attackerId: nail.id,
        defenderId: enemy.nail.id,
        point: { ...cell },
        p,
        d,
        contactKind,
      });
      collisionPointById.set(nail.id, cell);
      collisionPointById.set(enemy.nail.id, cell);
      if (p <= d) survives = false;
      if (p >= d) {
        const previous = cutIndexById.get(enemy.nail.id);
        if (previous == null || enemy.index < previous) cutIndexById.set(enemy.nail.id, enemy.index);
      }
    }
    if (!survives) tipBreakIds.add(nail.id);
    blocked.add(nail.id);
  }

  for (const id of tipBreakIds) {
    const nail = state.nails.find((item) => item.id === id);
    if (!nail?.alive) continue;
    emitRemoval(events, "break", nail, breakTip(nail), "collision", collisionPointById.get(id));
  }

  for (const [id, index] of cutIndexById) {
    const nail = state.nails.find((item) => item.id === id);
    if (!nail?.alive) continue;
    emitRemoval(events, "sever", nail, cutFrom(nail, index), "collision", collisionPointById.get(id));
  }

  for (const { nail, target } of captures) {
    if (nail.alive) captureFinger(state, nail, target, events);
  }

  for (const nail of activeNails) {
    if (!nail.alive || blocked.has(nail.id)) continue;
    const cell = candidates.get(nail.id);
    if (!cell) continue;
    const from = { ...currentTip(nail) };
    nail.path.push({ ...cell });
    if (extra) {
      nail.materials.push(makeMaterial("sculpt"));
    } else {
      // Tokoroten: new bare material is born at the root; every existing
      // material shifts one geometric segment toward the tip.
      nail.materials = [makeMaterial(), ...nail.materials];
      while (nail.materials.length > nail.path.length) nail.materials.pop();
    }
    events.push({
      type: extra ? "sculpt-grow" : "grow",
      nailId: nail.id,
      player: nail.player,
      fingerIndex: nail.fingerIndex,
      from,
      to: { ...cell },
    });
  }

  return events;
}

function checkWinner(state) {
  const a = state.captures[0] >= BOARD.capturesToWin;
  const b = state.captures[1] >= BOARD.capturesToWin;
  if (a && b) return "draw";
  if (a) return 0;
  if (b) return 1;
  return null;
}

function beginNextRound(state, events) {
  state.round += 1;
  state.firstCommander = 1 - state.firstCommander;
  state.commander = state.firstCommander;
  state.careRemaining = [BOARD.carePerTurn, BOARD.carePerTurn];
  for (const nail of state.nails) {
    nail.hidLastRound = nail.hiddenThisRound;
    nail.hiddenThisRound = false;
    nail.careUsedThisRound = false;
    nail.sculptPending = false;
  }
  resolveDeferred(state, events);
  state.phase = "command";
}

export function setDirection(state, player, fingerIndex, direction) {
  if (state.phase !== "command" || state.commander !== player) return false;
  if (!DIRECTIONS.includes(direction)) return false;
  const nail = getNail(state, player, fingerIndex);
  if (!nail?.alive) return false;
  nail.direction = direction;
  return true;
}

function canCare(state, player, fingerIndex) {
  if (state.phase !== "command" || state.commander !== player) return false;
  if (state.careRemaining[player] <= 0) return false;
  const nail = getNail(state, player, fingerIndex);
  return Boolean(nail?.alive && !nail.careUsedThisRound);
}

function spendCare(state, nail) {
  state.careRemaining[nail.player] -= 1;
  nail.careUsedThisRound = true;
}

export function applyCare(state, player, fingerIndex, type, options = {}) {
  if (!canCare(state, player, fingerIndex)) return { ok: false, reason: "care-unavailable" };
  const nail = getNail(state, player, fingerIndex);
  if (!nail) return { ok: false, reason: "missing-nail" };

  let effect = null;
  if (type === "sharpen") {
    tipMaterial(nail).sharpened = true;
    effect = { type: "care-sharpen", player, fingerIndex, segmentIndex: nail.path.length - 1, cell: { ...currentTip(nail) } };
  } else if (type === "gel") {
    if (state.stock[player].gel <= 0) return { ok: false, reason: "out-of-stock" };
    const index = Number.isInteger(options.segmentIndex) ? options.segmentIndex : nail.materials.length - 1;
    if (index < 0 || index >= nail.materials.length) return { ok: false, reason: "bad-segment" };
    nail.materials[index].gel = true;
    state.stock[player].gel -= 1;
    effect = { type: "care-gel", player, fingerIndex, segmentIndex: index, cell: { ...nail.path[index] } };
  } else if (type === "hook") {
    if (state.stock[player].hook <= 0) return { ok: false, reason: "out-of-stock" };
    nail.materials[0].kind = "hook";
    state.stock[player].hook -= 1;
    effect = { type: "care-hook", player, fingerIndex, segmentIndex: 0, cell: { ...nail.path[0] }, turnsToTip: Math.max(0, nail.path.length - 1) };
  } else if (type === "sculpt") {
    if (state.stock[player].sculpt <= 0) return { ok: false, reason: "out-of-stock" };
    nail.sculptPending = true;
    state.stock[player].sculpt -= 1;
    effect = { type: "care-sculpt", player, fingerIndex, cell: { ...currentTip(nail) } };
  } else if (type === "hide") {
    if (nail.hidLastRound) return { ok: false, reason: "hide-cooldown" };
    nail.hiddenThisRound = true;
    effect = { type: "care-hide", player, fingerIndex, cell: { ...currentTip(nail) } };
  } else if (type === "cut") {
    if (nail.path.length <= 1) return { ok: false, reason: "nothing-to-cut" };
    const removed = breakTip(nail);
    effect = { type: "care-cut", player, fingerIndex, removed, cell: removed[0]?.cell || { ...currentTip(nail) } };
  } else {
    return { ok: false, reason: "unknown-care" };
  }

  spendCare(state, nail);
  return { ok: true, effect };
}

export function finishCommand(state, player) {
  if (state.phase !== "command" || state.commander !== player) return { ok: false, reason: "not-your-turn" };
  const second = 1 - state.firstCommander;
  if (player === state.firstCommander) {
    state.commander = second;
    return { ok: true, resolved: false, events: [], winner: null };
  }

  state.phase = "resolve";
  const events = [];
  const live = state.nails.filter((nail) => nail.alive);
  events.push(...resolveGrowthStep(state, live, { extra: false }));

  const sculptNails = state.nails.filter((nail) => nail.alive && nail.sculptPending);
  if (sculptNails.length) events.push(...resolveGrowthStep(state, sculptNails, { extra: true }));

  for (const nail of state.nails) nail.sculptPending = false;
  state.winner = checkWinner(state);
  if (state.winner == null) beginNextRound(state, events);
  else state.phase = "over";
  state.lastEvents = clone(events);
  return { ok: true, resolved: true, events: clone(events), winner: state.winner };
}

export function applyCommandBundle(state, player, bundle = {}) {
  if (state.phase !== "command" || state.commander !== player) return { ok: false, reason: "not-your-turn" };
  const next = clone(state);
  const careEvents = [];

  const directions = Array.isArray(bundle.directions) ? bundle.directions : [];
  for (const item of directions) {
    const fingerIndex = Number(item?.fingerIndex);
    const direction = Number(item?.direction);
    if (!Number.isInteger(fingerIndex) || fingerIndex < 0 || fingerIndex > 4 || !DIRECTIONS.includes(direction)) {
      return { ok: false, reason: "bad-direction" };
    }
    if (!setDirection(next, player, fingerIndex, direction)) return { ok: false, reason: "bad-direction" };
  }

  const cares = Array.isArray(bundle.cares) ? bundle.cares : [];
  if (cares.length > BOARD.carePerTurn) return { ok: false, reason: "too-many-cares" };
  for (const item of cares) {
    const fingerIndex = Number(item?.fingerIndex);
    const type = String(item?.type || "");
    const options = {};
    if (Number.isInteger(item?.segmentIndex)) options.segmentIndex = item.segmentIndex;
    const result = applyCare(next, player, fingerIndex, type, options);
    if (!result.ok) return { ok: false, reason: result.reason || "bad-care" };
    if (result.effect) careEvents.push(result.effect);
  }

  const finish = finishCommand(next, player);
  if (!finish.ok) return { ok: false, reason: finish.reason || "finish-failed" };
  return {
    ok: true,
    state: next,
    result: {
      ...finish,
      events: [...careEvents, ...(finish.events || [])],
    },
  };
}

function distanceToEnemyFinger(nail) {
  const tip = currentTip(nail);
  const targetY = nail.player === 0 ? 0 : BOARD.rows - 1;
  return Math.abs(tip.y - targetY);
}

function directionScore(state, nail, direction, reserved = new Set()) {
  const old = nail.direction;
  nail.direction = direction;
  const c = candidateFor(nail);
  nail.direction = old;
  if (!inBounds(c.x, c.y)) return -999;
  let score = -distanceToEnemyFinger(nail) * 0.05;
  const enemy = 1 - nail.player;
  const enemyRoots = ROOT_COLS[enemy].filter((_, i) => !state.capturedFingers[enemy].includes(i));
  if (enemyRoots.length) score -= Math.min(...enemyRoots.map((x) => Math.abs(c.x - x))) * 0.28;
  const occupancy = cellsByOccupant(state).get(key(c.x, c.y)) || [];
  for (const hit of occupancy) {
    if (hit.nail.player === nail.player) score -= 8;
    else {
      const kind = hit.index === hit.nail.path.length - 1 ? "tip" : "body";
      score += attackPower(nail, kind) >= segmentDefense(hit.nail, hit.index) ? 2.2 : -1.7;
    }
  }
  if (reserved.has(key(c.x, c.y))) score -= 7;
  if (enemyFingerAt(state, nail, c)) score += 20;
  return score + Math.random() * 0.12;
}

export function chooseCpuCommands(state, player) {
  if (state.phase !== "command" || state.commander !== player) return;
  const nails = state.nails.filter((nail) => nail.player === player && nail.alive);
  const reserved = new Set();
  for (const nail of nails) {
    const best = DIRECTIONS
      .map((direction) => ({ direction, score: directionScore(state, nail, direction, reserved) }))
      .sort((a, b) => b.score - a.score)[0];
    nail.direction = best.direction;
    const c = candidateFor(nail);
    if (inBounds(c.x, c.y)) reserved.add(key(c.x, c.y));
  }

  const threats = nails
    .map((nail) => ({ nail, dist: distanceToEnemyFinger(nail), tip: tipMaterial(nail) }))
    .sort((a, b) => a.dist - b.dist);

  for (const entry of threats) {
    if (state.careRemaining[player] <= 0) break;
    const nail = entry.nail;
    if (nail.careUsedThisRound) continue;
    if (entry.dist <= 2 && state.stock[player].sculpt > 0) {
      applyCare(state, player, nail.fingerIndex, "sculpt");
      continue;
    }
    if (!entry.tip.sharpened && entry.dist <= 4) {
      applyCare(state, player, nail.fingerIndex, "sharpen");
      continue;
    }
    if (state.stock[player].hook > 0 && nail.path.length <= 3) {
      applyCare(state, player, nail.fingerIndex, "hook");
      continue;
    }
    if (state.stock[player].gel > 0) {
      applyCare(state, player, nail.fingerIndex, "gel", { segmentIndex: nail.materials.length - 1 });
    }
  }
}

export function getPublicSnapshot(state) {
  return clone(state);
}
