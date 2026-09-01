export const NOW_CODING_RULE_VERSION = "territory-v2";
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
  const playerCount = Math.max(2, Math.min(4, Number(playerCountInput) || 2));
  const edge = Math.max(1, Math.round(size * 0.1));
  const corners = [
    { x: edge, y: edge },
    { x: size - 1 - edge, y: edge },
    { x: size - 1 - edge, y: size - 1 - edge },
    { x: edge, y: size - 1 - edge },
  ];

  let selected;
  if (playerCount === 2) selected = random() < 0.5 ? [corners[0], corners[2]] : [corners[1], corners[3]];
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
  if (!Array.isArray(program) || program.length === 0) return [{ type: "action", action: "move" }];
  return program.slice(0, 10000);
}

export function createTerritoryState({ seed = "1", size = 21, players = [], maxTicks = 600, stagnationTicks = 120, spawns = null } = {}) {
  const boardSize = clampBoardSize(size);
  const random = createSeededRandom(seed);
  const safePlayers = players.slice(0, 4);
  while (safePlayers.length < 2) {
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

function evaluateExpression(expr, context, budget) {
  if (budget.count++ > budget.limit) throw new Error("instruction_budget_exceeded");
  if (expr === null || expr === undefined) return 0;
  if (["number", "boolean", "string"].includes(typeof expr)) return expr;
  if (typeof expr !== "object") return 0;
  if (expr.type === "literal") return expr.value;
  if (expr.type === "var") return context.agent.vars[String(expr.name || "")] ?? 0;
  if (expr.type === "builtin") {
    if (expr.name === "ink") return Number(context.agent.ink || 0);
    if (expr.name === "tailLength") return Array.isArray(context.agent.tail) ? context.agent.tail.length : 0;
    if (expr.name === "noMoveTicks") return Number(context.agent.noMoveTicks || 0);
    return 0;
  }
  if (expr.type === "sensor") return context.sense(context.state, context.agent, expr.direction || "front").state;
  if (expr.type === "random") {
    const min = Number(evaluateExpression(expr.min ?? 0, context, budget)) || 0;
    const max = Number(evaluateExpression(expr.max ?? 1, context, budget)) || 1;
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.floor(context.state.random() * (high - low + 1)) + low;
  }
  if (expr.type === "not") return !Boolean(evaluateExpression(expr.value, context, budget));
  if (expr.type === "binary") {
    const op = expr.op;
    if (op === "and") return Boolean(evaluateExpression(expr.left, context, budget)) && Boolean(evaluateExpression(expr.right, context, budget));
    if (op === "or") return Boolean(evaluateExpression(expr.left, context, budget)) || Boolean(evaluateExpression(expr.right, context, budget));
    const left = evaluateExpression(expr.left, context, budget);
    const right = evaluateExpression(expr.right, context, budget);
    switch (op) {
      case "+": return Number(left) + Number(right);
      case "-": return Number(left) - Number(right);
      case "*": return Number(left) * Number(right);
      case "/": return Number(right) === 0 ? 0 : Number(left) / Number(right);
      case "%": return Number(right) === 0 ? 0 : Number(left) % Number(right);
      case "==": return left === right;
      case "!=": return left !== right;
      case "<": return Number(left) < Number(right);
      case "<=": return Number(left) <= Number(right);
      case ">": return Number(left) > Number(right);
      case ">=": return Number(left) >= Number(right);
      default: return 0;
    }
  }
  return 0;
}

function legacyConditionToExpression(block) {
  if (block?.condition?.type === "cell") {
    return {
      type: "binary", op: "==",
      left: { type: "sensor", direction: block.condition.direction || "front" },
      right: { type: "literal", value: block.condition.value || "unclaimed" },
    };
  }
  if (block?.condition?.type === "random") {
    return {
      type: "binary", op: "<",
      left: { type: "random", min: 0, max: 9999 },
      right: { type: "literal", value: Math.round(Math.max(0, Math.min(1, Number(block.condition.chance) || 0.5)) * 10000) },
    };
  }
  return block?.condition || { type: "literal", value: false };
}

function executeSequence(statements, context, budget, path, startIndex = 0) {
  const list = Array.isArray(statements) ? statements : statements ? [statements] : [];
  if (!list.length) return { action: null, nextIndex: 0, wrapped: true };
  let index = Math.max(0, Number(startIndex) || 0) % list.length;
  for (let scanned = 0; scanned < list.length; scanned += 1) {
    const current = index;
    index = (index + 1) % list.length;
    const action = executeStatement(list[current], context, budget, `${path}/${current}`);
    if (action) return { action, nextIndex: index, wrapped: index === 0 };
  }
  return { action: null, nextIndex: index, wrapped: index === 0 };
}

function executeStatement(statement, context, budget, path = "root") {
  if (budget.count++ > budget.limit) throw new Error("instruction_budget_exceeded");
  if (!statement || typeof statement !== "object") return null;

  if (statement.type === "action") {
    if (statement.action === "attack") {
      const range = Math.max(1, Math.min(20, Math.floor(Number(evaluateExpression(statement.range ?? 1, context, budget)) || 1)));
      return { type: "attack", range };
    }
    return ["move", "turnLeft", "turnRight"].includes(statement.action) ? statement.action : "move";
  }

  if (statement.type === "set") {
    const name = String(statement.name || "value").slice(0, 40);
    context.agent.vars[name] = evaluateExpression(statement.value, context, budget);
    return null;
  }

  if (statement.type === "change") {
    const name = String(statement.name || "value").slice(0, 40);
    const current = Number(context.agent.vars[name] || 0);
    context.agent.vars[name] = current + Number(evaluateExpression(statement.value ?? 1, context, budget) || 0);
    return null;
  }

  if (statement.type === "if") {
    const passed = Boolean(evaluateExpression(legacyConditionToExpression(statement), context, budget));
    const branch = passed ? statement.then : statement.else;
    if (typeof branch === "string") return branch;
    return executeSequence(branch, context, budget, `${path}/if`).action;
  }

  if (statement.type === "forever") {
    const body = Array.isArray(statement.body) ? statement.body : [];
    if (!body.length) return null;
    const key = `forever:${path}`;
    const state = context.agent.control[key] || { cursor: 0 };
    const result = executeSequence(body, context, budget, `${path}/forever`, state.cursor);
    state.cursor = result.nextIndex;
    context.agent.control[key] = state;
    return result.action;
  }

  if (statement.type === "repeat") {
    const body = Array.isArray(statement.body) ? statement.body : [];
    if (!body.length) return null;
    const key = `repeat:${path}`;
    const configured = Math.max(0, Math.min(10000, Math.floor(Number(evaluateExpression(statement.times ?? 1, context, budget)) || 0)));
    let state = context.agent.control[key];
    if (!state) state = { cursor: 0, remaining: configured };
    if (state.remaining <= 0) {
      delete context.agent.control[key];
      return null;
    }
    const result = executeSequence(body, context, budget, `${path}/repeat`, state.cursor);
    state.cursor = result.nextIndex;
    if (result.wrapped) state.remaining -= 1;
    if (state.remaining <= 0) delete context.agent.control[key];
    else context.agent.control[key] = state;
    return result.action;
  }

  return null;
}

export function decideAction(state, agent, instructionBudget = 10000, options = {}) {
  if (!agent.alive) return "none";
  const program = agent.program;
  if (!program.length) return "none";
  const budget = { count: 0, limit: instructionBudget };
  const context = { state, agent, sense: typeof options.sense === "function" ? options.sense : senseCell };
  for (let scanned = 0; scanned < program.length; scanned += 1) {
    const index = agent.pc % program.length;
    const statement = program[index];
    agent.pc = (index + 1) % program.length;
    try {
      const action = executeStatement(statement, context, budget, `top:${index}`);
      if (action) {
        if (statement?.type === "forever") agent.pc = index;
        if (statement?.type === "repeat" && agent.control[`repeat:top:${index}`]) agent.pc = index;
        return action;
      }
      if (statement?.type === "forever") agent.pc = index;
    } catch (error) {
      if (error?.message === "instruction_budget_exceeded") return "none";
      throw error;
    }
  }
  return "none";
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
    const ownIndex = state.agents.indexOf(agent);
    if (owner >= 0 && owner !== ownIndex) {
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

export function makeNpcProgram(level = "medium", variant = 0) {
  const safeLevel = NPC_LEVELS.includes(level) ? level : "medium";
  const preferredTurn = variant % 2 === 0 ? "turnRight" : "turnLeft";
  const otherTurn = preferredTurn === "turnRight" ? "turnLeft" : "turnRight";
  const action = (name) => ({ type: "action", action: name });
  if (safeLevel === "weak") {
    return [{
      type: "if",
      condition: { type: "random", chance: 0.72 },
      then: [action("move")],
      else: [action(preferredTurn)],
    }];
  }
  if (safeLevel === "medium") {
    return [cellIf("front", "unclaimed", [action("move")], [
      cellIf("front", "own", [action("move")], [action(preferredTurn)]),
    ])];
  }
  return [cellIf("front", "unclaimed", [action("move")], [
    cellIf("left", "unclaimed", [action("turnLeft")], [
      cellIf("right", "unclaimed", [action("turnRight")], [
        cellIf("front", "own", [action("move")], [
          cellIf("left", "own", [action("turnLeft")], [
            cellIf("right", "own", [action("turnRight")], [
              { type: "if", condition: { type: "random", chance: 0.5 }, then: [action(preferredTurn)], else: [action(otherTurn)] },
            ]),
          ]),
        ]),
      ]),
    ]),
  ])];
}

export function makeDefaultProgram(variant = 0) {
  return makeNpcProgram("medium", variant);
}
