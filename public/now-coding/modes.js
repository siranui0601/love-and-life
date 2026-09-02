import {
  DIRECTIONS,
  PLAYER_COLORS,
  NOW_CODING_RULE_VERSION,
  createBalancedSpawns,
  createSeededRandom,
  createTerritoryState,
  decideAction,
  makeNpcProgram,
  stepTerritory,
  territoryResults,
} from "./engine.js";
import { createBattleSpawns, createBoardDefinition, isPlayableCell, validateSpawnList } from "./boards.js";

export const MODE_LABELS = {
  territory: "陣取り",
  cobra: "コブラ",
  fall: "床抜け",
  splat: "スプラ",
};

export const MODE_RULE_VERSION = {
  territory: NOW_CODING_RULE_VERSION,
  cobra: "cobra-v3",
  fall: "fall-v3",
  splat: "splat-v3",
};

const VALID_MODES = new Set(Object.keys(MODE_LABELS));
const VALID_DIFFICULTIES = new Set(["weak", "medium", "strong"]);

function clampSize(value) {
  const raw = Math.max(9, Math.min(51, Number(value) || 21));
  return raw % 2 === 0 ? raw + 1 : raw;
}

function board(size, fill = -1) {
  return Array.from({ length: size }, () => Array(size).fill(fill));
}

function normalizeProgram(program) {
  return Array.isArray(program) ? structuredClone(program.slice(0, 10000)) : [];
}

function makeAgents({ players, size, seed, spawns, allowSolo = false, boardDef = null }) {
  const random = createSeededRandom(seed);
  const definition = boardDef || createBoardDefinition({ size, seed });
  const safePlayers = (Array.isArray(players) ? players : []).slice(0, 4);
  while (safePlayers.length < (allowSolo ? 1 : 2)) {
    const index = safePlayers.length;
    safePlayers.push({ id: `npc-${index}`, name: `NPC ${index + 1}`, color: PLAYER_COLORS[index], program: makeNpcProgram("medium", index) });
  }
  let resolvedSpawns;
  if (Array.isArray(spawns) && spawns.length >= safePlayers.length) {
    const proposed = spawns.slice(0, safePlayers.length).map((spawn) => ({ x: Number(spawn.x), y: Number(spawn.y), dir: Number(spawn.dir) }));
    if (!validateSpawnList(definition, proposed, safePlayers.length)) throw new Error("invalid_spawn");
    resolvedSpawns = proposed;
  } else {
    resolvedSpawns = createBattleSpawns(definition, safePlayers.length, random);
  }
  const agents = safePlayers.map((player, index) => {
    const spawn = resolvedSpawns[index];
    return {
      id: String(player.id ?? `p${index + 1}`),
      userTrackingId: String(player.userTrackingId || ""),
      name: String(player.name || `プレイヤー${index + 1}`),
      color: player.color || PLAYER_COLORS[index],
      programName: String(player.programName || ""),
      program: normalizeProgram(player.program),
      x: spawn.x,
      y: spawn.y,
      dir: spawn.dir,
      alive: true,
      deathReason: "",
      deathTick: null,
      pc: 0,
      vars: Object.create(null),
      control: Object.create(null),
      lastAction: "",
      lastSensor: null,
      ink: 0,
      maxInk: 10,
      tail: [],
      noMoveTicks: 0,
    };
  });
  return { agents, spawns: resolvedSpawns, random };
}

function relativeDirection(dir, relative) {
  if (relative === "left") return (dir + 3) % 4;
  if (relative === "right") return (dir + 1) % 4;
  return dir;
}

function targetAt(agent, relative = "front") {
  const dir = relativeDirection(agent.dir, relative);
  const vector = DIRECTIONS[dir];
  return { x: agent.x + vector.x, y: agent.y + vector.y, dir };
}

function out(state, x, y) {
  return !isPlayableCell(state, x, y);
}

function headAt(state, x, y, ignoreId = "") {
  return state.agents.find((agent) => agent.alive && agent.id !== ignoreId && agent.x === x && agent.y === y) || null;
}

function tailOwnerAt(state, x, y) {
  for (let i = 0; i < state.agents.length; i += 1) {
    if (state.agents[i].tail.some((cell) => cell.x === x && cell.y === y)) return i;
  }
  return -1;
}

export function senseModeCell(state, agent, relative = "front") {
  if (state.mode === "territory") {
    const dir = relativeDirection(agent.dir, relative);
    const vector = DIRECTIONS[dir];
    const x = agent.x + vector.x;
    const y = agent.y + vector.y;
    if (out(state, x, y)) return { state: "cliff", x, y, owner: -1 };
    const head = headAt(state, x, y, agent.id);
    if (head) return { state: "player", x, y, owner: state.agents.indexOf(head), playerId: head.id };
    const owner = state.board[y][x];
    if (owner < 0) return { state: "unclaimed", x, y, owner };
    return { state: owner === state.agents.indexOf(agent) ? "own" : "enemy", x, y, owner };
  }

  const { x, y } = targetAt(agent, relative);
  if (out(state, x, y)) return { state: "cliff", x, y, owner: -1 };
  if (state.mode === "fall" && state.holes?.has(`${x},${y}`)) return { state: "cliff", x, y, owner: -1 };
  const head = headAt(state, x, y, agent.id);
  if (head) return { state: "player", x, y, owner: state.agents.indexOf(head), playerId: head.id };
  if (state.mode === "cobra") {
    const tailOwner = tailOwnerAt(state, x, y);
    if (tailOwner >= 0) return { state: "tail", x, y, owner: tailOwner };
    return { state: "unclaimed", x, y, owner: -1 };
  }
  if (state.mode === "splat") {
    const owner = state.board[y][x];
    if (owner < 0) return { state: "unclaimed", x, y, owner };
    return { state: owner === state.agents.indexOf(agent) ? "own" : "enemy", x, y, owner };
  }
  return { state: "unclaimed", x, y, owner: -1 };
}

function skipUnsupportedAction(state, agent, allowAttack) {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const action = decideAction(state, agent, 10000, { sense: senseModeCell });
    if (action === "none") return "none";
    if (typeof action === "object" && action?.type === "attack") {
      // Unsupported mode, invalid range, or insufficient ink are all zero-tick:
      // continue interpreting the next instruction instead of manufacturing a
      // stand-still action.
      if (!allowAttack) continue;
      const rawRange = Math.floor(Number(action.range));
      if (!Number.isFinite(rawRange) || rawRange < 1) continue;
      const range = Math.min(20, rawRange);
      if (agent.ink < range + 1) continue;
      return { type: "attack", range };
    }
    return action;
  }
  return "none";
}

function markDead(state, agent, reason) {
  if (!agent.alive) return;
  agent.alive = false;
  agent.deathReason = reason;
  agent.deathTick = state.tick;
  agent.lastAction = "dead";
}

function collisionSet(intents) {
  const dead = new Set();
  for (let i = 0; i < intents.length; i += 1) {
    for (let j = i + 1; j < intents.length; j += 1) {
      const a = intents[i];
      const b = intents[j];
      const sameTarget = a.target.x === b.target.x && a.target.y === b.target.y;
      const swapped = a.target.x === b.from.x && a.target.y === b.from.y && b.target.x === a.from.x && b.target.y === a.from.y;
      if (sameTarget || swapped) {
        dead.add(a.agent.id);
        dead.add(b.agent.id);
      }
    }
  }
  return dead;
}

function finishSurvival(state) {
  const alive = state.agents.filter((agent) => agent.alive);
  if (state.allowSolo) { if (alive.length === 0) { state.finished = true; state.finishReason = "all_dead"; } else if (state.tick >= state.maxTicks) { state.finished = true; state.finishReason = "tick_limit"; } return; }
  if (alive.length <= 1) {
    state.finished = true;
    state.finishReason = alive.length === 1 ? "last_survivor" : "all_dead";
  } else if (state.tick >= state.maxTicks) {
    state.finished = true;
    state.finishReason = "tick_limit";
  }
}

function createCobraState(config = {}) {
  const seed = String(config.seed ?? "1");
  const boardDef = createBoardDefinition({ ...config, seed });
  const size = boardDef.size;
  const made = makeAgents({ players: config.players, size, seed, spawns: config.spawns, allowSolo: Boolean(config.allowSolo), boardDef });
  return {
    mode: "cobra",
    ruleVersion: MODE_RULE_VERSION.cobra,
    seed,
    size,
    boardShape: boardDef.shape,
    boardSizeKey: boardDef.sizeKey,
    mask: boardDef.mask.map((row) => [...row]),
    playableCount: boardDef.playableCount,
    board: board(size),
    agents: made.agents,
    spawns: made.spawns,
    random: made.random,
    tick: 0,
    maxTicks: Math.max(60, Number(config.maxTicks) || Math.max(600, boardDef.playableCount * 2)),
    growthEvery: Math.max(2, Number(config.growthEvery) || 5),
    finished: false,
    finishReason: "",
    effects: [],
    allowSolo: Boolean(config.allowSolo),
  };
}

function stepCobra(state) {
  if (state.finished) return state;
  state.tick += 1;
  state.effects = [];
  const growthTick = state.tick % state.growthEvery === 0;
  const vacating = new Set();
  if (!growthTick) {
    for (const agent of state.agents) {
      if (agent.alive && agent.tail[0]) vacating.add(`${agent.tail[0].x},${agent.tail[0].y}`);
    }
  }

  const intents = [];
  for (const agent of state.agents) {
    if (!agent.alive) continue;
    agent.lastSensor = {
      front: senseModeCell(state, agent, "front").state,
      left: senseModeCell(state, agent, "left").state,
      right: senseModeCell(state, agent, "right").state,
    };
    let action = skipUnsupportedAction(state, agent, false);
    // Cobra's body advances every simulation tick. A halted program simply
    // stops steering and therefore continues straight.
    if (action === "none") action = "move";
    if (action === "turnLeft") agent.dir = (agent.dir + 3) % 4;
    if (action === "turnRight") agent.dir = (agent.dir + 1) % 4;
    agent.lastAction = action;
    const target = targetAt(agent, "front");
    if (out(state, target.x, target.y)) {
      markDead(state, agent, "cliff");
      continue;
    }
    intents.push({ agent, from: { x: agent.x, y: agent.y }, target });
  }

  const dead = collisionSet(intents);
  for (const intent of intents) {
    if (!intent.agent.alive || dead.has(intent.agent.id)) continue;
    const tailOwner = tailOwnerAt(state, intent.target.x, intent.target.y);
    if (tailOwner >= 0 && !vacating.has(`${intent.target.x},${intent.target.y}`)) dead.add(intent.agent.id);
  }
  for (const id of dead) {
    const agent = state.agents.find((entry) => entry.id === id);
    if (agent) markDead(state, agent, "collision");
  }

  for (const intent of intents) {
    const agent = intent.agent;
    if (!agent.alive) continue;
    const oldHead = { x: agent.x, y: agent.y };
    agent.x = intent.target.x;
    agent.y = intent.target.y;
    agent.tail.push(oldHead);
    if (!growthTick && agent.tail.length) agent.tail.shift();
  }
  for (const agent of state.agents) if (!agent.alive) agent.tail = [];
  finishSurvival(state);
  return state;
}

function createFallState(config = {}) {
  const seed = String(config.seed ?? "1");
  const boardDef = createBoardDefinition({ ...config, seed });
  const size = boardDef.size;
  const made = makeAgents({ players: config.players, size, seed, spawns: config.spawns, allowSolo: Boolean(config.allowSolo), boardDef });
  return {
    mode: "fall",
    ruleVersion: MODE_RULE_VERSION.fall,
    seed,
    size,
    boardShape: boardDef.shape,
    boardSizeKey: boardDef.sizeKey,
    mask: boardDef.mask.map((row) => [...row]),
    playableCount: boardDef.playableCount,
    board: board(size),
    agents: made.agents,
    spawns: made.spawns,
    random: made.random,
    holes: new Set(),
    tick: 0,
    maxTicks: Math.max(60, Number(config.maxTicks) || Math.max(600, boardDef.playableCount * 2)),
    finished: false,
    finishReason: "",
    effects: [],
    allowSolo: Boolean(config.allowSolo),
  };
}

function stepFall(state) {
  if (state.finished) return state;
  state.tick += 1;
  state.effects = [];
  const actions = new Map();
  for (const agent of state.agents) {
    if (!agent.alive) continue;
    agent.lastSensor = {
      front: senseModeCell(state, agent, "front").state,
      left: senseModeCell(state, agent, "left").state,
      right: senseModeCell(state, agent, "right").state,
    };
    const action = skipUnsupportedAction(state, agent, false);
    actions.set(agent.id, action);
    agent.lastAction = action;
    if (action === "turnLeft") agent.dir = (agent.dir + 3) % 4;
    if (action === "turnRight") agent.dir = (agent.dir + 1) % 4;
    if (action !== "move") {
      agent.noMoveTicks += 1;
      if (agent.noMoveTicks >= 2) {
        state.holes.add(`${agent.x},${agent.y}`);
        state.effects.push({ type: "collapse", x: agent.x, y: agent.y });
        markDead(state, agent, "floor_collapse");
      }
    }
  }

  const intents = [];
  for (const agent of state.agents) {
    if (!agent.alive || actions.get(agent.id) !== "move") continue;
    const target = targetAt(agent, "front");
    if (out(state, target.x, target.y) || state.holes.has(`${target.x},${target.y}`)) {
      markDead(state, agent, "cliff");
      continue;
    }
    intents.push({ agent, from: { x: agent.x, y: agent.y }, target });
  }
  const dead = collisionSet(intents);
  for (const id of dead) {
    const agent = state.agents.find((entry) => entry.id === id);
    if (agent) markDead(state, agent, "collision");
  }
  for (const intent of intents) {
    const agent = intent.agent;
    if (!agent.alive) continue;
    const stationary = state.agents.find((other) => other.alive && other.id !== agent.id && other.x === intent.target.x && other.y === intent.target.y && !intents.some((candidate) => candidate.agent.id === other.id));
    if (stationary) {
      markDead(state, agent, "collision");
      markDead(state, stationary, "collision");
      continue;
    }
    agent.x = intent.target.x;
    agent.y = intent.target.y;
    agent.noMoveTicks = 0;
  }
  finishSurvival(state);
  return state;
}

function createSplatState(config = {}) {
  const seed = String(config.seed ?? "1");
  const boardDef = createBoardDefinition({ ...config, seed });
  const size = boardDef.size;
  const made = makeAgents({ players: config.players, size, seed, spawns: config.spawns, allowSolo: Boolean(config.allowSolo), boardDef });
  const paint = board(size);
  made.agents.forEach((agent, index) => { paint[agent.y][agent.x] = index; });
  return {
    mode: "splat",
    ruleVersion: MODE_RULE_VERSION.splat,
    seed,
    size,
    boardShape: boardDef.shape,
    boardSizeKey: boardDef.sizeKey,
    mask: boardDef.mask.map((row) => [...row]),
    playableCount: boardDef.playableCount,
    board: paint,
    agents: made.agents,
    spawns: made.spawns,
    random: made.random,
    tick: 0,
    maxTicks: Math.max(60, Number(config.maxTicks) || Math.max(500, boardDef.playableCount * 2)),
    finished: false,
    finishReason: "",
    effects: [],
    allowSolo: Boolean(config.allowSolo),
  };
}

function attackCells(state, agent, range) {
  const vector = DIRECTIONS[agent.dir];
  const cells = [];
  for (let distance = 1; distance <= range; distance += 1) {
    const x = agent.x + vector.x * distance;
    const y = agent.y + vector.y * distance;
    if (out(state, x, y)) break;
    cells.push({ x, y });
  }
  return cells;
}

function stepSplat(state) {
  if (state.finished) return state;
  state.tick += 1;
  state.effects = [];
  const actions = new Map();
  const startBoard = state.board.map((row) => [...row]);

  for (const agent of state.agents) {
    if (!agent.alive) continue;
    agent.lastSensor = {
      front: senseModeCell(state, agent, "front").state,
      left: senseModeCell(state, agent, "left").state,
      right: senseModeCell(state, agent, "right").state,
    };
    const action = skipUnsupportedAction(state, agent, true);
    actions.set(agent.id, action);
    agent.lastAction = typeof action === "object" ? `attack:${action.range}` : action;
  }

  const shotVictims = new Set();
  for (const agent of state.agents) {
    if (!agent.alive) continue;
    const action = actions.get(agent.id);
    if (typeof action !== "object" || action?.type !== "attack") continue;
    const range = action.range;
    agent.ink = Math.max(0, agent.ink - (range + 1));
    const cells = attackCells(state, agent, range);
    for (const cell of cells) {
      state.effects.push({ type: "shot", x: cell.x, y: cell.y, color: agent.color });
      const victim = headAt(state, cell.x, cell.y, agent.id);
      if (victim) {
        shotVictims.add(victim.id);
        break;
      }
    }
  }
  for (const id of shotVictims) {
    const victim = state.agents.find((agent) => agent.id === id);
    if (victim) markDead(state, victim, "shot");
  }

  for (const agent of state.agents) {
    if (!agent.alive) continue;
    const action = actions.get(agent.id);
    if (action === "turnLeft") agent.dir = (agent.dir + 3) % 4;
    if (action === "turnRight") agent.dir = (agent.dir + 1) % 4;
  }

  const intents = [];
  for (const agent of state.agents) {
    if (!agent.alive || actions.get(agent.id) !== "move") continue;
    const target = targetAt(agent, "front");
    if (out(state, target.x, target.y)) {
      markDead(state, agent, "cliff");
      continue;
    }
    intents.push({ agent, from: { x: agent.x, y: agent.y }, target });
  }
  const dead = collisionSet(intents);
  for (const id of dead) {
    const agent = state.agents.find((entry) => entry.id === id);
    if (agent) markDead(state, agent, "collision");
  }

  for (const intent of intents) {
    const agent = intent.agent;
    if (!agent.alive) continue;
    const stationary = state.agents.find((other) => other.alive && other.id !== agent.id && other.x === intent.target.x && other.y === intent.target.y && !intents.some((candidate) => candidate.agent.id === other.id));
    if (stationary) {
      markDead(state, agent, "collision");
      markDead(state, stationary, "collision");
      continue;
    }
    const ownIndex = state.agents.indexOf(agent);
    const wasOwn = startBoard[intent.target.y][intent.target.x] === ownIndex;
    agent.x = intent.target.x;
    agent.y = intent.target.y;
    state.board[agent.y][agent.x] = ownIndex;
    if (wasOwn) agent.ink = Math.min(agent.maxInk, agent.ink + 1);
  }

  for (const agent of state.agents) {
    if (!agent.alive) continue;
    const action = actions.get(agent.id);
    if (action === "turnLeft" || action === "turnRight") {
      const ownIndex = state.agents.indexOf(agent);
      if (startBoard[agent.y][agent.x] === ownIndex) agent.ink = Math.min(agent.maxInk, agent.ink + 1);
    }
  }

  if (!state.agents.some((agent) => agent.alive)) {
    state.finished = true;
    state.finishReason = "all_dead";
  } else if (state.tick >= state.maxTicks) {
    state.finished = true;
    state.finishReason = "tick_limit";
  }
  return state;
}

function survivalResults(state) {
  const sorted = state.agents.map((agent) => ({
    id: agent.id,
    userTrackingId: agent.userTrackingId,
    name: agent.name,
    color: agent.color,
    alive: agent.alive,
    deathReason: agent.deathReason,
    survivedTicks: agent.alive ? state.tick : Number(agent.deathTick || 0),
    tailLength: agent.tail?.length || 0,
  })).sort((a, b) => Number(b.alive) - Number(a.alive) || b.survivedTicks - a.survivedTicks || a.name.localeCompare(b.name, "ja"));
  let rank = 0;
  let previous = null;
  return sorted.map((result, index) => {
    const key = `${Number(result.alive)}:${result.survivedTicks}`;
    if (key !== previous) rank = index + 1;
    previous = key;
    return { ...result, rank, score: result.survivedTicks, metric: `${result.survivedTicks}tick 生存` };
  });
}

function splatResults(state) {
  const rows = state.agents.map((agent, index) => {
    const colored = state.board.reduce((sum, row) => sum + row.filter((owner) => owner === index).length, 0);
    return {
      id: agent.id,
      userTrackingId: agent.userTrackingId,
      name: agent.name,
      color: agent.color,
      alive: agent.alive,
      deathReason: agent.deathReason,
      colored,
      ink: agent.ink,
      score: colored,
      metric: `${colored}マス`,
    };
  }).sort((a, b) => b.colored - a.colored || Number(b.alive) - Number(a.alive) || a.name.localeCompare(b.name, "ja"));
  let rank = 0;
  let previous = null;
  return rows.map((result, index) => {
    if (result.colored !== previous) rank = index + 1;
    previous = result.colored;
    return { ...result, rank };
  });
}

export function createGameState(config = {}) {
  const mode = VALID_MODES.has(config.mode) ? config.mode : "territory";
  if (mode === "territory") return createTerritoryState(config);
  if (mode === "cobra") return createCobraState(config);
  if (mode === "fall") return createFallState(config);
  return createSplatState(config);
}

export function stepGame(state) {
  if (state.mode === "territory") return stepTerritory(state);
  if (state.mode === "cobra") return stepCobra(state);
  if (state.mode === "fall") return stepFall(state);
  return stepSplat(state);
}

export function gameResults(state) {
  if (state.mode === "territory") return territoryResults(state).map((result) => ({ ...result, score: result.claimed, metric: `${result.claimed}マス` }));
  if (state.mode === "splat") return splatResults(state);
  return survivalResults(state);
}

function action(name, range = 1) {
  return name === "attack" ? { type: "action", action: "attack", range: { type: "literal", value: range } } : { type: "action", action: name };
}

function cellIf(direction, value, thenBranch, elseBranch) {
  return { type: "if", condition: { type: "cell", direction, value }, then: thenBranch, else: elseBranch };
}

function forever(body) {
  return [{ type: "forever", body }];
}

export function makeModeNpcProgram(mode = "territory", difficulty = "medium", variant = 0) {
  const safeMode = VALID_MODES.has(mode) ? mode : "territory";
  const level = VALID_DIFFICULTIES.has(difficulty) ? difficulty : "medium";
  if (safeMode === "territory") return makeNpcProgram(level, variant);
  const turn = variant % 2 ? "turnLeft" : "turnRight";
  const other = turn === "turnLeft" ? "turnRight" : "turnLeft";

  if (safeMode === "cobra") {
    if (level === "weak") return forever([{ type: "if", condition: { type: "random", chance: 0.7 }, then: [action("move")], else: [action(turn)] }]);
    if (level === "medium") return forever([cellIf("front", "cliff", [action(turn)], [cellIf("front", "tail", [action(other)], [action("move")])])]);
    return forever([cellIf("front", "cliff", [cellIf("left", "cliff", [action("turnRight")], [action("turnLeft")])], [cellIf("front", "tail", [cellIf("left", "unclaimed", [action("turnLeft")], [action("turnRight")])], [action("move")])])]);
  }

  if (safeMode === "fall") {
    if (level === "weak") return forever([{ type: "if", condition: { type: "random", chance: 0.76 }, then: [action("move")], else: [action(turn)] }]);
    if (level === "medium") return forever([cellIf("front", "cliff", [action(turn)], [action("move")])]);
    return forever([cellIf("front", "cliff", [cellIf("left", "cliff", [action("turnRight")], [action("turnLeft")])], [action("move")])]);
  }

  if (level === "weak") return forever([{ type: "if", condition: { type: "random", chance: 0.15 }, then: [action("attack", 1)], else: [action("move")] }]);
  if (level === "medium") return forever([cellIf("front", "player", [action("attack", 2)], [cellIf("front", "cliff", [action(turn)], [action("move")])])]);
  return forever([cellIf("front", "player", [action("attack", 4)], [cellIf("front", "cliff", [cellIf("left", "cliff", [action("turnRight")], [action("turnLeft")])], [cellIf("front", "own", [
    { type: "if", condition: { type: "random", chance: 0.18 }, then: [action("attack", 2)], else: [action("move")] },
  ], [action("move")])])])]);
}


export const TEST_NPC_TYPES = ["straight","wall","explore","evade","chase","random","beginner","intermediate","advanced"];
export function makeTestNpcProgram(mode="territory",type="straight",variant=0){const safe=VALID_MODES.has(mode)?mode:"territory",turn=variant%2?"turnLeft":"turnRight",other=turn==="turnLeft"?"turnRight":"turnLeft";if(type==="beginner")return makeModeNpcProgram(safe,"weak",variant);if(type==="intermediate")return makeModeNpcProgram(safe,"medium",variant);if(type==="advanced")return makeModeNpcProgram(safe,"strong",variant);if(type==="straight")return forever([action("move")]);if(type==="wall")return forever([cellIf("front","cliff",[action(turn)],[action("move")])]);if(type==="explore")return forever([cellIf("front","unclaimed",[action("move")],[cellIf("left","unclaimed",[action("turnLeft")],[cellIf("right","unclaimed",[action("turnRight")],[action(turn)])])])]);if(type==="evade")return forever([{type:"if",condition:{type:"binary",op:"<=",left:{type:"builtin",name:"enemyDistance"},right:{type:"literal",value:2}},then:[action(turn)],else:[cellIf("front","cliff",[action(other)],[action("move")])]}]);if(type==="chase")return forever([cellIf("front","player",[action("move")],[cellIf("left","player",[action("turnLeft")],[cellIf("right","player",[action("turnRight")],[cellIf("front","cliff",[action(turn)],[action("move")])])])])]);return forever([{type:"if",condition:{type:"random",chance:.72},then:[action("move")],else:[action(turn)]}]);}
