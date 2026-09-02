import { runProgramUntilAction } from "./vm.js";

export const NOW_CODING_RULE_VERSION = "territory-v4";
export const PLAYER_COLORS = ["blue", "red", "yellow", "green"];
export const NPC_LEVELS = ["weak", "medium", "strong"];
export const DIRECTIONS = [
  { x: 0, y: -1, name: "north" },
  { x: 1, y: 0, name: "east" },
  { x: 0, y: 1, name: "south" },
  { x: -1, y: 0, name: "west" },
];

function hashSeed(seed) {
  const source = String(seed ?? "now-coding");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < source.length; i += 1) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampBoardSize(value) {
  const raw = Math.max(9, Math.min(51, Number(value) || 21));
  return raw % 2 === 0 ? raw + 1 : raw;
}

function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function directionTowardCenter(x, y, size) {
  const center = (size - 1) / 2;
  const dx = center - x;
  const dy = center - y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 1 : 3;
  return dy >= 0 ? 2 : 0;
}

export function createBalancedSpawns(sizeInput, playerCountInput, random) {
  const size = clampBoardSize(sizeInput);
  const playerCount = Math.max(1, Math.min(4, Number(playerCountInput) || 2));
  const edge = Math.max(1, Math.round(size * 0.1));
  const corners = [
    { x: edge, y: edge },
    { x: size - 1 - edge, y: edge },
    { x: size - 1 - edge, y: size - 1 - edge },
    { x: edge, y: size - 1 - edge },
  ];

  let selected;
  if (playerCount === 1) selected = [corners[Math.floor(random() * corners.length)]];
  else if (playerCount === 2) selected = random() < 0.5 ? [corners[0], corners[2]] : [corners[1], corners[3]];
  else if (playerCount === 3) selected = shuffled(corners, random).slice(0, 3);
  else selected = [...corners];

  return shuffled(selected, random).map((spawn) => ({
    ...spawn,
    dir: directionTowardCenter(spawn.x, spawn.y, size),
  }));
}

function makeBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(-1));
}

function normalizeProgram(program) {
  return Array.isArray(program) ? structuredClone(program.slice(0, 10000)) : [];
}

export function createTerritoryState({ seed = "1", size = 21, players = [], maxTicks = 600, stagnationTicks = 120, spawns = null, allowSolo = false } = {}) {
  const boardSize = clampBoardSize(size);
  const random = createSeededRandom(seed);
  const safePlayers = players.slice(0, 4);
  while (safePlayers.length < (allowSolo ? 1 : 2)) {
    const index = safePlayers.length;
    safePlayers.push({ id: `cpu-${index}`, name: `NPC ${index + 1}`, color: PLAYER_COLORS[index], program: makeNpcProgram("medium", index) });
  }
  const resolvedSpawns = Array.isArray(spawns) && spawns.length >= safePlayers.length
    ? spawns.slice(0, safePlayers.length)
    : createBalancedSpawns(boardSize, safePlayers.length, random);
  const board = makeBoard(boardSize);

  const agents = safePlayers.map((player, index) => {
    const spawn = resolvedSpawns[index];
    board[spawn.y][spawn.x] = index;
    return {
      id: String(player.id ?? `p${index + 1}`),
      userTrackingId: String(player.userTrackingId || ""),
      name: String(player.name || `プレイヤー${index + 1}`),
      color: player.color || PLAYER_COLORS[index],
      x: spawn.x,
      y: spawn.y,
      dir: Number.isInteger(spawn.dir) ? spawn.dir : 0,
      alive: true,
      deathReason: "",
      program: normalizeProgram(player.program),
      pc: 0,
      vars: Object.create(null),
      control: Object.create(null),
      claimed: 1,
      lastAction: "",
      lastSensor: null,
    };
  });

  return {
    mode: "territory",
    ruleVersion: NOW_CODING_RULE_VERSION,
    seed: String(seed),
    size: boardSize,
    board,
    agents,
    tick: 0,
    maxTicks: Math.max(20, Number(maxTicks) || 600),
    stagnationTicks: Math.max(20, Number(stagnationTicks) || 120),
    ticksSinceCapture: 0,
    random,
    finished: false,
    finishReason: "",
    spawns: resolvedSpawns.map((spawn) => ({ ...spawn })),
  };
}

function relativeDirection(dir, relative) {
  if (relative === "left") return (dir + 3) % 4;
  if (relative === "right") return (dir + 1) % 4;
  return dir;
}

function headAt(state, x, y, ignoreAgentId = "") {
  return state.agents.find((agent) => agent.alive && agent.id !== ignoreAgentId && agent.x === x && agent.y === y) || null;
}

export function senseCell(state, agent, relative = "front") {
  const dir = relativeDirection(agent.dir, relative);
  const vector = DIRECTIONS[dir];
  const x = agent.x + vector.x;
  const y = agent.y + vector.y;
  if (x < 0 || y < 0 || x >= state.size || y >= state.size) return { state: "cliff", x, y, owner: -1 };
  const head = headAt(state, x, y, agent.id);
  if (head) return { state: "player", x, y, owner: state.agents.indexOf(head), playerId: head.id };
  const owner = state.board[y][x];
  if (owner < 0) return { state: "unclaimed", x, y, owner };
  const ownIndex = state.agents.indexOf(agent);
  return { state: owner === ownIndex ? "own" : "enemy", x, y, owner };
}

export function decideAction(state, agent, instructionBudget = 10000, options = {}) {
  return runProgramUntilAction(state, agent, instructionBudget, {
    sense: typeof options.sense === "function" ? options.sense : senseCell,
  });
}

function nextPosition(agent) {
  const vector = DIRECTIONS[agent.dir];
  return { x: agent.x + vector.x, y: agent.y + vector.y };
}

function markDead(agent, reason) {
  agent.alive = false;
  agent.deathReason = reason;
  agent.lastAction = "dead";
}

function allCellsClaimed(state) {
  return state.board.every((row) => !row.includes(-1));
}

function hasLegalTerritoryMove(state, agent) {
  if (!agent.alive) return false;
  return DIRECTIONS.some((vector) => {
    const x = agent.x + vector.x;
    const y = agent.y + vector.y;
    if (x < 0 || y < 0 || x >= state.size || y >= state.size) return false;
    if (headAt(state, x, y, agent.id)) return false;
    // In territory mode every claimed cell is a wall, including your own trail.
    return state.board[y][x] < 0;
  });
}

function noAliveAgentCanMove(state) {
  const alive = state.agents.filter((agent) => agent.alive);
  return alive.length > 0 && alive.every((agent) => !hasLegalTerritoryMove(state, agent));
}

export function stepTerritory(state) {
  if (state.finished) return state;
  state.tick += 1;
  let captures = 0;
  const actions = new Map();

  for (const agent of state.agents) {
    if (!agent.alive) continue;
    agent.lastSensor = {
      front: senseCell(state, agent, "front").state,
      left: senseCell(state, agent, "left").state,
      right: senseCell(state, agent, "right").state,
    };
    let action = decideAction(state, agent);
    // Attack is a valid language instruction but unsupported in territory.
    // It consumes zero ticks here, so continue interpreting until a supported
    // physical action or the end of the program.
    for (let skipped = 0; skipped < 64 && typeof action === "object" && action?.type === "attack"; skipped += 1) {
      action = decideAction(state, agent);
    }
    actions.set(agent.id, action);
    agent.lastAction = action;
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
    const target = nextPosition(agent);
    if (target.x < 0 || target.y < 0 || target.x >= state.size || target.y >= state.size) {
      markDead(agent, "cliff");
      continue;
    }
    const owner = state.board[target.y][target.x];
    // Once a cell is colored it becomes a wall for everyone, even its owner.
    if (owner >= 0) {
      agent.lastAction = "blocked";
      continue;
    }
    intents.push({ agent, from: { x: agent.x, y: agent.y }, target });
  }

  const deadByCollision = new Set();
  for (let i = 0; i < intents.length; i += 1) {
    for (let j = i + 1; j < intents.length; j += 1) {
      const a = intents[i];
      const b = intents[j];
      const sameTarget = a.target.x === b.target.x && a.target.y === b.target.y;
      const swapped = a.target.x === b.from.x && a.target.y === b.from.y && b.target.x === a.from.x && b.target.y === a.from.y;
      if (sameTarget || swapped) {
        deadByCollision.add(a.agent.id);
        deadByCollision.add(b.agent.id);
      }
    }
  }

  for (const intent of intents) {
    const { agent, target } = intent;
    if (!agent.alive) continue;
    if (deadByCollision.has(agent.id)) {
      markDead(agent, "collision");
      continue;
    }
    const stationaryHead = state.agents.find((other) => other.alive && other.id !== agent.id && other.x === target.x && other.y === target.y && !intents.some((moveIntent) => moveIntent.agent.id === other.id));
    if (stationaryHead) {
      markDead(agent, "collision");
      markDead(stationaryHead, "collision");
      continue;
    }
    agent.x = target.x;
    agent.y = target.y;
    const owner = state.board[target.y][target.x];
    if (owner < 0) {
      const ownIndex = state.agents.indexOf(agent);
      state.board[target.y][target.x] = ownIndex;
      agent.claimed += 1;
      captures += 1;
    }
  }

  state.ticksSinceCapture = captures > 0 ? 0 : state.ticksSinceCapture + 1;
  if (allCellsClaimed(state)) {
    state.finished = true;
    state.finishReason = "board_filled";
  } else if (!state.agents.some((agent) => agent.alive)) {
    state.finished = true;
    state.finishReason = "all_dead";
  } else if (noAliveAgentCanMove(state)) {
    state.finished = true;
    state.finishReason = "no_moves";
  } else if (state.ticksSinceCapture >= state.stagnationTicks) {
    state.finished = true;
    state.finishReason = "stagnation";
  } else if (state.tick >= state.maxTicks) {
    state.finished = true;
    state.finishReason = "tick_limit";
  }
  return state;
}

export function territoryResults(state) {
  const sorted = state.agents
    .map((agent, index) => ({
      id: agent.id,
      userTrackingId: agent.userTrackingId,
      name: agent.name,
      color: agent.color,
      claimed: state.board.reduce((count, row) => count + row.filter((owner) => owner === index).length, 0),
      alive: agent.alive,
      deathReason: agent.deathReason,
    }))
    .sort((a, b) => b.claimed - a.claimed || Number(b.alive) - Number(a.alive) || a.name.localeCompare(b.name, "ja"));
  let rank = 0;
  let previousClaimed = null;
  return sorted.map((result, index) => {
    if (previousClaimed !== result.claimed) rank = index + 1;
    previousClaimed = result.claimed;
    return { ...result, rank };
  });
}

export function runTerritoryToEnd(config) {
  const state = createTerritoryState(config);
  while (!state.finished) stepTerritory(state);
  return { state, results: territoryResults(state) };
}

function cellIf(direction, value, thenBranch, elseBranch) {
  return { type: "if", condition: { type: "cell", direction, value }, then: thenBranch, else: elseBranch };
}

function forever(body) {
  return [{ type: "forever", body }];
}

export function makeNpcProgram(level = "medium", variant = 0) {
  const safeLevel = NPC_LEVELS.includes(level) ? level : "medium";
  const preferredTurn = variant % 2 === 0 ? "turnRight" : "turnLeft";
  const otherTurn = preferredTurn === "turnRight" ? "turnLeft" : "turnRight";
  const action = (name) => ({ type: "action", action: name });
  if (safeLevel === "weak") {
    return forever([{
      type: "if",
      condition: { type: "random", chance: 0.72 },
      then: [action("move")],
      else: [action(preferredTurn)],
    }]);
  }
  if (safeLevel === "medium") {
    return forever([cellIf("front", "unclaimed", [action("move")], [action(preferredTurn)])]);
  }
  return forever([cellIf("front", "unclaimed", [action("move")], [
    cellIf("left", "unclaimed", [action("turnLeft")], [
      cellIf("right", "unclaimed", [action("turnRight")], [
        { type: "if", condition: { type: "random", chance: 0.5 }, then: [action(preferredTurn)], else: [action(otherTurn)] },
      ]),
    ]),
  ])]);
}

export function makeDefaultProgram(variant = 0) {
  return makeNpcProgram("medium", variant);
}
