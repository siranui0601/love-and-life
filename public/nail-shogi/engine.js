export const BOARD = Object.freeze({ cols: 10, rows: 8, capturesToWin: 2, carePerTurn: 2 });
export const FINGER_NAMES = Object.freeze(["親指", "人差し指", "中指", "薬指", "小指"]);
export const DIRECTIONS = Object.freeze([-1, 0, 1]);

const ROOT_COLS = {
  0: [0, 2, 4, 6, 8],
  1: [1, 3, 5, 7, 9],
};

const START_STOCK = Object.freeze({ gel: 4, hook: 2, sculpt: 2 });

const clone = (value) => structuredClone(value);
const key = (x, y) => `${x},${y}`;
const inBounds = (x, y) => x >= 0 && x < BOARD.cols && y >= 0 && y < BOARD.rows;

function makeMaterial(kind = "bare") {
  return { kind, gel: false, sharpened: false };
}

function rootFor(player, fingerIndex) {
  return {
    x: ROOT_COLS[player][fingerIndex],
    y: player === 0 ? BOARD.rows : -1,
  };
}

function firstCellFor(player, fingerIndex) {
  const root = rootFor(player, fingerIndex);
  return { x: root.x, y: player === 0 ? BOARD.rows - 1 : 0 };
}

function makeNail(player, fingerIndex) {
  const first = firstCellFor(player, fingerIndex);
  return {
    id: `${player}:${fingerIndex}`,
    player,
    fingerIndex,
    alive: true,
    direction: 0,
    path: [first],
    materials: [makeMaterial()],
    hiddenThisRound: false,
    hidLastRound: false,
    sculptPending: false,
    careUsedThisRound: false,
  };
}

export function createInitialState({ mode = "cpu" } = {}) {
  const nails = [];
  for (let player = 0; player < 2; player += 1) {
    for (let finger = 0; finger < 5; finger += 1) nails.push(makeNail(player, finger));
  }
  return {
    version: 1,
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

function tipMaterial(nail) {
  return nail.materials[nail.materials.length - 1] || makeMaterial();
}

function attackPower(nail, contactKind = "tip") {
  const material = tipMaterial(nail);
  if (contactKind === "body" && material.kind === "hook") return 3;
  return 1 + (material.sharpened ? 1 : 0);
}

function segmentDefense(nail, segmentIndex) {
  const material = nail.materials[segmentIndex] || makeMaterial();
  const isTip = segmentIndex === nail.path.length - 1;
  const base = isTip ? 1 : 2;
  return base + (material.gel ? 1 : 0);
}

function candidateFor(nail, extra = false) {
  const tip = currentTip(nail);
  const dy = nail.player === 0 ? -1 : 1;
  const dx = nail.direction;
  return { x: tip.x + dx, y: tip.y + dy, extra };
}

function segmentIndexAt(nail, cell) {
  for (let i = 0; i < nail.path.length; i += 1) {
    const point = nail.path[i];
    if (point.x === cell.x && point.y === cell.y) return i;
  }
  return -1;
}

function enemyFingerAt(state, attacker, cell) {
  const enemy = 1 - attacker.player;
  const fingerIndex = ROOT_COLS[enemy].indexOf(cell.x);
  if (fingerIndex < 0) return null;
  const targetY = enemy === 0 ? BOARD.rows - 1 : 0;
  if (cell.y !== targetY) return null;
  if (state.capturedFingers[enemy].includes(fingerIndex)) return null;
  const ownNail = getNail(state, enemy, fingerIndex);
  if (ownNail?.path.length > 1) return null;
  return { player: enemy, fingerIndex };
}

function cutFrom(nail, index) {
  if (index < 0 || index >= nail.path.length) return;
  if (index === 0) {
    nail.path = [firstCellFor(nail.player, nail.fingerIndex)];
    nail.materials = [makeMaterial()];
    return;
  }
  nail.path = nail.path.slice(0, index);
  nail.materials = nail.materials.slice(0, index);
  if (!nail.path.length) {
    nail.path = [firstCellFor(nail.player, nail.fingerIndex)];
    nail.materials = [makeMaterial()];
  }
}

function breakTip(nail) {
  if (nail.path.length <= 1) {
    nail.materials[0] = makeMaterial();
    return;
  }
  nail.path.pop();
  nail.materials.pop();
}

function resetNail(nail) {
  nail.path = [firstCellFor(nail.player, nail.fingerIndex)];
  nail.materials = [makeMaterial()];
  nail.direction = 0;
  nail.sculptPending = false;
  nail.hiddenThisRound = false;
}

function capturedFingerCell(player, fingerIndex) {
  return firstCellFor(player, fingerIndex);
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

function lineIntersection(a1, a2, b1, b2) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const c1 = cross(a1, a2, b1);
  const c2 = cross(a1, a2, b2);
  const c3 = cross(b1, b2, a1);
  const c4 = cross(b1, b2, a2);
  return c1 * c2 < 0 && c3 * c4 < 0;
}

function applyHeadOn(a, b, breakIds, events) {
  const pa = attackPower(a, "tip");
  const pb = attackPower(b, "tip");
  const da = segmentDefense(a, a.path.length - 1);
  const db = segmentDefense(b, b.path.length - 1);
  if (pb >= da) breakIds.add(a.id);
  if (pa >= db) breakIds.add(b.id);
  events.push({ type: "tip-collision", nails: [a.id, b.id], powers: [pa, pb], defenses: [da, db] });
}

function resolveDeferred(state, events) {
  const pending = state.deferred;
  state.deferred = [];
  for (const contact of pending) {
    const attacker = state.nails.find((n) => n.id === contact.attackerId);
    const defender = state.nails.find((n) => n.id === contact.defenderId);
    if (!attacker?.alive || !defender?.alive) continue;
    const index = segmentIndexAt(defender, contact.cell);
    if (index < 0) continue;
    const p = contact.attackPower;
    const d = segmentDefense(defender, index);
    if (p <= d) breakTip(attacker);
    if (p >= d) cutFrom(defender, index);
    events.push({ type: "reveal-collision", attackerId: attacker.id, defenderId: defender.id, cell: contact.cell, p, d });
  }
}

function captureFinger(state, attacker, target, events) {
  const pathSnapshot = attacker.path.map((cell) => ({ ...cell }));
  const targetNail = getNail(state, target.player, target.fingerIndex);
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
    defenderPlayer: target.player,
    defenderFinger: target.fingerIndex,
    cell: capturedFingerCell(target.player, target.fingerIndex),
    attackPath: pathSnapshot,
  });
}

function resolveGrowthStep(state, activeNails, { extra = false } = {}) {
  const events = [];
  const occupancy = cellsByOccupant(state);
  const candidates = new Map();
  const blocked = new Set();
  const breakTips = new Set();
  const cuts = [];
  const captures = [];

  for (const nail of activeNails) {
    if (!nail.alive) continue;
    const cell = candidateFor(nail, extra);
    candidates.set(nail.id, cell);
    if (!inBounds(cell.x, cell.y)) {
      blocked.add(nail.id);
      events.push({ type: "edge-block", nailId: nail.id, cell });
    }
  }

  const candidateEntries = [...candidates.entries()];
  for (let i = 0; i < candidateEntries.length; i += 1) {
    const [idA, cellA] = candidateEntries[i];
    if (blocked.has(idA)) continue;
    const nailA = state.nails.find((n) => n.id === idA);
    for (let j = i + 1; j < candidateEntries.length; j += 1) {
      const [idB, cellB] = candidateEntries[j];
      if (blocked.has(idB)) continue;
      const nailB = state.nails.find((n) => n.id === idB);
      if (!nailA || !nailB || nailA.player === nailB.player) continue;
      if (nailA.hiddenThisRound || nailB.hiddenThisRound) continue;
      const sameCell = cellA.x === cellB.x && cellA.y === cellB.y;
      const aPrev = currentTip(nailA);
      const bPrev = currentTip(nailB);
      const swap = cellA.x === bPrev.x && cellA.y === bPrev.y && cellB.x === aPrev.x && cellB.y === aPrev.y;
      const cross = lineIntersection(aPrev, cellA, bPrev, cellB);
      if (sameCell || swap || cross) {
        applyHeadOn(nailA, nailB, breakTips, events);
        blocked.add(idA);
        blocked.add(idB);
      }
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
      events.push({ type: "own-block", nailId: nail.id, cell });
      continue;
    }

    const enemies = occupants.filter((entry) => entry.nail.player !== nail.player);
    if (!enemies.length) continue;

    if (nail.hiddenThisRound || enemies.every((entry) => entry.nail.hiddenThisRound)) {
      for (const enemy of enemies) {
        state.deferred.push({
          attackerId: nail.id,
          defenderId: enemy.nail.id,
          cell: { ...cell },
          attackPower: attackPower(nail, enemy.index === enemy.nail.path.length - 1 ? "tip" : "body"),
        });
      }
      continue;
    }

    let survives = true;
    for (const enemy of enemies) {
      const contactKind = enemy.index === enemy.nail.path.length - 1 ? "tip" : "body";
      const p = attackPower(nail, contactKind);
      const d = segmentDefense(enemy.nail, enemy.index);
      if (p <= d) survives = false;
      if (p >= d) cuts.push({ nail: enemy.nail, index: enemy.index });
      events.push({ type: "segment-collision", attackerId: nail.id, defenderId: enemy.nail.id, cell: { ...cell }, p, d, contactKind });
    }
    if (!survives) breakTips.add(nail.id);
    blocked.add(nail.id);
  }

  for (const id of breakTips) {
    const nail = state.nails.find((n) => n.id === id);
    if (nail) breakTip(nail);
  }

  const earliestCut = new Map();
  for (const cut of cuts) {
    const prev = earliestCut.get(cut.nail.id);
    if (prev == null || cut.index < prev) earliestCut.set(cut.nail.id, cut.index);
  }
  for (const [id, index] of earliestCut.entries()) {
    const nail = state.nails.find((n) => n.id === id);
    if (nail) cutFrom(nail, index);
  }

  for (const { nail, target } of captures) captureFinger(state, nail, target, events);

  for (const nail of activeNails) {
    if (!nail.alive || blocked.has(nail.id)) continue;
    const cell = candidates.get(nail.id);
    if (!cell) continue;
    if (extra) {
      nail.path.push({ ...cell });
      nail.materials.push(makeMaterial("sculpt"));
    } else {
      nail.path.push({ ...cell });
      nail.materials = [makeMaterial(), ...nail.materials];
      while (nail.materials.length > nail.path.length) nail.materials.pop();
    }
    events.push({ type: extra ? "sculpt-grow" : "grow", nailId: nail.id, cell: { ...cell } });
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

function beginNextRound(state) {
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
  const revealEvents = [];
  resolveDeferred(state, revealEvents);
  state.lastEvents = revealEvents;
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

  if (type === "sharpen") {
    tipMaterial(nail).sharpened = true;
  } else if (type === "gel") {
    if (state.stock[player].gel <= 0) return { ok: false, reason: "out-of-stock" };
    const index = Number.isInteger(options.segmentIndex) ? options.segmentIndex : nail.materials.length - 1;
    if (index < 0 || index >= nail.materials.length) return { ok: false, reason: "bad-segment" };
    nail.materials[index].gel = true;
    state.stock[player].gel -= 1;
  } else if (type === "hook") {
    if (state.stock[player].hook <= 0) return { ok: false, reason: "out-of-stock" };
    nail.materials[0].kind = "hook";
    state.stock[player].hook -= 1;
  } else if (type === "sculpt") {
    if (state.stock[player].sculpt <= 0) return { ok: false, reason: "out-of-stock" };
    nail.sculptPending = true;
    state.stock[player].sculpt -= 1;
  } else if (type === "hide") {
    if (nail.hidLastRound) return { ok: false, reason: "hide-cooldown" };
    nail.hiddenThisRound = true;
  } else if (type === "cut") {
    if (nail.path.length <= 1) return { ok: false, reason: "nothing-to-cut" };
    breakTip(nail);
  } else {
    return { ok: false, reason: "unknown-care" };
  }

  spendCare(state, nail);
  return { ok: true };
}

export function finishCommand(state, player) {
  if (state.phase !== "command" || state.commander !== player) return { ok: false };
  const second = 1 - state.firstCommander;
  if (player === state.firstCommander) {
    state.commander = second;
    return { ok: true, resolved: false };
  }

  state.phase = "resolve";
  const events = [];
  const live = state.nails.filter((nail) => nail.alive);
  events.push(...resolveGrowthStep(state, live, { extra: false }));

  const sculptNails = state.nails.filter((nail) => nail.alive && nail.sculptPending);
  if (sculptNails.length) events.push(...resolveGrowthStep(state, sculptNails, { extra: true }));

  for (const nail of state.nails) nail.sculptPending = false;
  state.lastEvents = events;
  state.winner = checkWinner(state);
  if (state.winner == null) beginNextRound(state);
  else state.phase = "over";
  return { ok: true, resolved: true, events: clone(events), winner: state.winner };
}

function distanceToEnemyFinger(nail) {
  const tip = currentTip(nail);
  const targetY = nail.player === 0 ? 0 : BOARD.rows - 1;
  return Math.abs(tip.y - targetY);
}

function directionScore(state, nail, direction) {
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
    if (hit.nail.player === nail.player) score -= 4;
    else {
      const kind = hit.index === hit.nail.path.length - 1 ? "tip" : "body";
      score += attackPower(nail, kind) >= segmentDefense(hit.nail, hit.index) ? 2.2 : -1.7;
    }
  }
  if (enemyFingerAt(state, nail, c)) score += 20;
  return score + Math.random() * 0.15;
}

export function chooseCpuCommands(state, player) {
  if (state.phase !== "command" || state.commander !== player) return;
  const nails = state.nails.filter((n) => n.player === player && n.alive);
  for (const nail of nails) {
    const best = DIRECTIONS
      .map((direction) => ({ direction, score: directionScore(state, nail, direction) }))
      .sort((a, b) => b.score - a.score)[0];
    nail.direction = best.direction;
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
    if (state.stock[player].gel > 0) applyCare(state, player, nail.fingerIndex, "gel", { segmentIndex: nail.materials.length - 1 });
  }
}

export function getPublicSnapshot(state) {
  return clone(state);
}
