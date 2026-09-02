export const BOARD_SHAPES = ["square", "diamond", "cross", "donut"];
export const BOARD_SIZE_KEYS = ["small", "large"];
export const BOARD_SHAPE_LABELS = {
  square: "正方形",
  diamond: "ひし形",
  cross: "十字",
  donut: "ドーナツ",
  random: "ランダム",
};
export const BOARD_SIZE_LABELS = {
  small: "小",
  large: "大",
  random: "ランダム",
};

const DIMENSIONS = {
  square: { small: 15, large: 21 },
  diamond: { small: 21, large: 29 },
  cross: { small: 19, large: 27 },
  donut: { small: 19, large: 27 },
};

function hashSeed(seed) {
  const source = String(seed ?? "now-coding-board");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < source.length; i += 1) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createBoardRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function asRandom(seedOrRandom) {
  return typeof seedOrRandom === "function" ? seedOrRandom : createBoardRandom(seedOrRandom);
}

function oddSize(value, fallback = 21) {
  const raw = Math.max(9, Math.min(51, Number(value) || fallback));
  return raw % 2 === 0 ? raw + 1 : raw;
}

export function resolveBoardChoice({ shape = "square", sizeKey = "large", seed = "board" } = {}) {
  const random = createBoardRandom(`${seed}:selection`);
  const resolvedShape = shape === "random"
    ? BOARD_SHAPES[Math.floor(random() * BOARD_SHAPES.length)]
    : (BOARD_SHAPES.includes(shape) ? shape : "square");
  const resolvedSizeKey = sizeKey === "random"
    ? BOARD_SIZE_KEYS[Math.floor(random() * BOARD_SIZE_KEYS.length)]
    : (BOARD_SIZE_KEYS.includes(sizeKey) ? sizeKey : "large");
  return { shape: resolvedShape, sizeKey: resolvedSizeKey };
}

function buildMask(shape, sizeKey, size) {
  const center = (size - 1) / 2;
  const mask = Array.from({ length: size }, () => Array(size).fill(false));
  const crossWidth = sizeKey === "small" ? 7 : 9;
  const crossHalf = Math.floor(crossWidth / 2);
  const donutInner = sizeKey === "small" ? 3.5 : 6;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let playable = false;
      if (shape === "square") playable = true;
      else if (shape === "diamond") playable = Math.abs(x - center) + Math.abs(y - center) <= center;
      else if (shape === "cross") playable = Math.abs(x - center) <= crossHalf || Math.abs(y - center) <= crossHalf;
      else if (shape === "donut") {
        const distance = Math.hypot(x - center, y - center);
        playable = distance <= center + 1e-9 && distance >= donutInner;
      }
      mask[y][x] = playable;
    }
  }
  return mask;
}

export function createBoardDefinition(config = {}) {
  const requestedShape = config.boardShape ?? config.shape ?? null;
  const requestedSizeKey = config.boardSizeKey ?? config.sizeKey ?? null;
  const hasPreset = requestedShape != null || requestedSizeKey != null;

  if (!hasPreset && Number.isFinite(Number(config.size))) {
    const size = oddSize(config.size);
    const mask = Array.from({ length: size }, () => Array(size).fill(true));
    return {
      shape: "square",
      sizeKey: size === 15 ? "small" : size === 21 ? "large" : "custom",
      size,
      mask,
      playableCount: size * size,
      requestedShape: "square",
      requestedSizeKey: "custom",
    };
  }

  const requested = {
    shape: requestedShape || "square",
    sizeKey: requestedSizeKey || "large",
    seed: config.seed ?? "board",
  };
  const resolved = resolveBoardChoice(requested);
  const size = DIMENSIONS[resolved.shape][resolved.sizeKey];
  const mask = buildMask(resolved.shape, resolved.sizeKey, size);
  const playableCount = mask.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  return {
    ...resolved,
    size,
    mask,
    playableCount,
    requestedShape: requested.shape,
    requestedSizeKey: requested.sizeKey,
  };
}

export function isPlayableCell(boardLike, x, y) {
  const size = Number(boardLike?.size || boardLike?.length || 0);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) return false;
  const mask = Array.isArray(boardLike?.mask) ? boardLike.mask : (Array.isArray(boardLike) ? boardLike : null);
  return mask ? mask[y]?.[x] === true : true;
}

export function playableCells(boardDef) {
  const cells = [];
  for (let y = 0; y < boardDef.size; y += 1) {
    for (let x = 0; x < boardDef.size; x += 1) if (isPlayableCell(boardDef, x, y)) cells.push({ x, y });
  }
  return cells;
}

function nearestPlayable(boardDef, nx, ny, used = new Set()) {
  const targetX = nx * (boardDef.size - 1);
  const targetY = ny * (boardDef.size - 1);
  let best = null;
  let bestDistance = Infinity;
  for (const cell of playableCells(boardDef)) {
    const key = `${cell.x},${cell.y}`;
    if (used.has(key)) continue;
    const distance = (cell.x - targetX) ** 2 + (cell.y - targetY) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cell;
    }
  }
  return best;
}

function directionTowardCenter(boardDef, cell) {
  const center = (boardDef.size - 1) / 2;
  const vectors = [
    { x: 0, y: -1, dir: 0 },
    { x: 1, y: 0, dir: 1 },
    { x: 0, y: 1, dir: 2 },
    { x: -1, y: 0, dir: 3 },
  ];
  const candidates = vectors
    .filter((v) => isPlayableCell(boardDef, cell.x + v.x, cell.y + v.y))
    .map((v) => ({ ...v, score: (cell.x + v.x - center) ** 2 + (cell.y + v.y - center) ** 2 }))
    .sort((a, b) => a.score - b.score || a.dir - b.dir);
  return candidates[0]?.dir ?? 0;
}

function anchorTargets(shape) {
  if (shape === "square") return [[0.12, 0.12], [0.88, 0.12], [0.88, 0.88], [0.12, 0.88]];
  if (shape === "donut") return [[0.22, 0.22], [0.78, 0.22], [0.78, 0.78], [0.22, 0.78]];
  return [[0.5, 0.04], [0.96, 0.5], [0.5, 0.96], [0.04, 0.5]];
}

function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createBattleSpawns(boardDef, playerCountInput, seedOrRandom = "battle-spawns") {
  const random = asRandom(seedOrRandom);
  const count = Math.max(1, Math.min(4, Number(playerCountInput) || 2));
  const used = new Set();
  const anchors = anchorTargets(boardDef.shape).map(([nx, ny]) => {
    const cell = nearestPlayable(boardDef, nx, ny, used);
    if (!cell) return null;
    used.add(`${cell.x},${cell.y}`);
    return { ...cell, dir: directionTowardCenter(boardDef, cell) };
  }).filter(Boolean);

  let selected;
  if (count === 1) selected = [anchors[Math.floor(random() * anchors.length)]];
  else if (count === 2) selected = random() < 0.5 ? [anchors[0], anchors[2]] : [anchors[1], anchors[3]];
  else if (count === 3) selected = shuffled(anchors, random).slice(0, 3);
  else selected = [...anchors];
  return shuffled(selected, random).map((spawn) => ({ ...spawn }));
}

export function createRandomSpawns(boardDef, playerCountInput, seedOrRandom = "random-spawns") {
  const random = asRandom(seedOrRandom);
  const count = Math.max(1, Math.min(4, Number(playerCountInput) || 2));
  const cells = shuffled(playableCells(boardDef), random).slice(0, count);
  return cells.map((cell) => ({ ...cell, dir: Math.floor(random() * 4) }));
}

export function validateSpawnList(boardDef, spawns, count = spawns?.length || 0) {
  if (!Array.isArray(spawns) || spawns.length < count) return false;
  const used = new Set();
  for (let i = 0; i < count; i += 1) {
    const spawn = spawns[i];
    if (!spawn || !isPlayableCell(boardDef, Number(spawn.x), Number(spawn.y))) return false;
    const key = `${Number(spawn.x)},${Number(spawn.y)}`;
    if (used.has(key)) return false;
    used.add(key);
    const dir = Number(spawn.dir);
    if (!Number.isInteger(dir) || dir < 0 || dir > 3) return false;
  }
  return true;
}

export function boardChoiceLabel(shape, sizeKey) {
  return `${BOARD_SHAPE_LABELS[shape] || shape}・${BOARD_SIZE_LABELS[sizeKey] || sizeKey}`;
}
