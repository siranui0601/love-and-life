import {
  evaluateAst,
  formatAst,
  isTen,
  multifactorial,
} from "../../../public/ten-freely/expression-engine.js";

const BASIC_OPERATORS = new Set(["+", "-", "*", "/"]);
const MAX_VALUE = 1e9;
const MAX_CANDIDATES_PER_SET = 900;
const EPSILON = 1e-10;

const STAGES = [
  { name: "basic", unarySteps: [], binary: ["+", "-", "*", "/"], maxUnaryDepth: 0 },
  { name: "common", unarySteps: [1], allowAbs: true, allowSqrt: true, binary: ["+", "-", "*", "/"], maxUnaryDepth: 2 },
  { name: "multifactorial", unarySteps: [1, 2, 3, 4, 5, 6, 7, 8, 9], allowAbs: true, allowSqrt: true, binary: ["+", "-", "*", "/"], maxUnaryDepth: 2 },
  { name: "advanced", unarySteps: [1, 2, 3, 4, 5, 6, 7, 8, 9], allowAbs: true, allowSqrt: true, binary: ["+", "-", "*", "/", "^", "P", "C"], maxUnaryDepth: 2 },
];

function nearInteger(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return Math.abs(value - rounded) <= EPSILON ? rounded : null;
}

function valueKey(value) {
  const integer = nearInteger(value);
  if (integer !== null) return `i:${integer}`;
  return `f:${Number(value.toPrecision(12))}`;
}

function compareRank(a, b) {
  const length = Math.max(a.rank.length, b.rank.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a.rank[index] ?? 0) - (b.rank[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.expression.localeCompare(b.expression, "ja");
}

function createCandidate({ value, ast, stats }) {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_VALUE) return null;
  const normalized = Math.abs(value) <= EPSILON ? 0 : value;
  const expression = formatAst(ast);
  const rank = [
    stats.specialCount === 0 ? 0 : 1,
    stats.specialCount,
    stats.specialWeight,
    stats.nonIntegerIntermediates,
    stats.depth,
    stats.nodeCount,
    expression.length,
    Math.log10(1 + stats.maxMagnitude),
  ];
  return { value: normalized, ast, stats, expression, rank };
}

function baseCandidate(value) {
  return createCandidate({
    value,
    ast: { type: "number", value, raw: String(value) },
    stats: {
      specialCount: 0,
      specialWeight: 0,
      nonIntegerIntermediates: 0,
      maxMagnitude: Math.abs(value),
      depth: 1,
      nodeCount: 1,
    },
  });
}

function mergeStats(left, right, operator, value) {
  const special = BASIC_OPERATORS.has(operator) ? 0 : 1;
  const weight = operator === "^" ? 2 : operator === "P" || operator === "C" ? 4 : 0;
  return {
    specialCount: left.stats.specialCount + right.stats.specialCount + special,
    specialWeight: left.stats.specialWeight + right.stats.specialWeight + weight,
    nonIntegerIntermediates:
      left.stats.nonIntegerIntermediates
      + right.stats.nonIntegerIntermediates
      + (nearInteger(value) === null ? 1 : 0),
    maxMagnitude: Math.max(left.stats.maxMagnitude, right.stats.maxMagnitude, Math.abs(value)),
    depth: Math.max(left.stats.depth, right.stats.depth) + 1,
    nodeCount: left.stats.nodeCount + right.stats.nodeCount + 1,
  };
}

function unaryStats(candidate, kind, value, step = 1) {
  const weight = kind === "abs" || kind === "sqrt" ? 2 : step === 1 ? 3 : 5 + step;
  return {
    specialCount: candidate.stats.specialCount + 1,
    specialWeight: candidate.stats.specialWeight + weight,
    nonIntegerIntermediates: candidate.stats.nonIntegerIntermediates + (nearInteger(value) === null ? 1 : 0),
    maxMagnitude: Math.max(candidate.stats.maxMagnitude, Math.abs(value)),
    depth: candidate.stats.depth + 1,
    nodeCount: candidate.stats.nodeCount + 1,
  };
}

function insertCandidate(map, candidate) {
  if (!candidate) return false;
  const key = valueKey(candidate.value);
  const existing = map.get(key);
  if (!existing || compareRank(candidate, existing) < 0) {
    map.set(key, candidate);
    return true;
  }
  return false;
}

function unaryVariants(candidate, stage) {
  const variants = [];
  const value = candidate.value;

  if (stage.allowAbs && value < -EPSILON) {
    variants.push(createCandidate({
      value: Math.abs(value),
      ast: { type: "unary", operator: "abs", argument: candidate.ast },
      stats: unaryStats(candidate, "abs", Math.abs(value)),
    }));
  }

  if (stage.allowSqrt && value >= 0 && Math.abs(value) > EPSILON && Math.abs(value - 1) > EPSILON) {
    const result = Math.sqrt(value);
    variants.push(createCandidate({
      value: result,
      ast: { type: "unary", operator: "sqrt", argument: candidate.ast },
      stats: unaryStats(candidate, "sqrt", result),
    }));
  }

  const integer = nearInteger(value);
  if (integer !== null && integer >= 0 && integer <= 30) {
    for (const step of stage.unarySteps) {
      let result;
      try {
        result = multifactorial(integer, step);
      } catch {
        continue;
      }
      if (Math.abs(result - value) <= EPSILON || Math.abs(result) > MAX_VALUE) continue;
      variants.push(createCandidate({
        value: result,
        ast: { type: "multifactorial", step, argument: candidate.ast },
        stats: unaryStats(candidate, "factorial", result, step),
      }));
    }
  }

  return variants.filter(Boolean);
}

function insertWithUnary(map, candidate, stage, depth = 0) {
  if (!candidate) return;
  const inserted = insertCandidate(map, candidate);
  if (!inserted || depth >= stage.maxUnaryDepth) return;
  for (const variant of unaryVariants(candidate, stage)) {
    insertWithUnary(map, variant, stage, depth + 1);
  }
}

function calculateBinary(left, right, operator) {
  const a = left.value;
  const b = right.value;
  let value;

  if (operator === "+") value = a + b;
  else if (operator === "-") value = a - b;
  else if (operator === "*") value = a * b;
  else if (operator === "/") {
    if (Math.abs(b) <= EPSILON) return null;
    value = a / b;
  } else if (operator === "^") {
    if (Math.abs(a) <= EPSILON && b < 0) return null;
    if (Math.abs(b) > 12 || Math.abs(a) > 1e6) return null;
    value = Math.pow(a, b);
  } else if (operator === "P" || operator === "C") {
    const n = nearInteger(a);
    const r = nearInteger(b);
    if (n === null || r === null || n < 0 || r < 0 || r > n || n > 30) return null;
    const ast = { type: "binary", operator, left: left.ast, right: right.ast };
    try {
      value = evaluateAst(ast).value;
    } catch {
      return null;
    }
  } else return null;

  if (!Number.isFinite(value) || Math.abs(value) > MAX_VALUE) return null;
  return createCandidate({
    value,
    ast: { type: "binary", operator, left: left.ast, right: right.ast },
    stats: mergeStats(left, right, operator, value),
  });
}

function pruneMap(map) {
  if (map.size <= MAX_CANDIDATES_PER_SET) return map;
  const values = [...map.values()];
  values.sort((a, b) => {
    const rankCompare = compareRank(a, b);
    if (rankCompare !== 0) return rankCompare;
    return Math.abs(a.value - 10) - Math.abs(b.value - 10);
  });

  const selected = values.slice(0, Math.floor(MAX_CANDIDATES_PER_SET * 0.72));
  const landmarkValues = values
    .slice()
    .sort((a, b) => {
      const aLandmark = Math.min(Math.abs(a.value - 5), Math.abs(a.value - 10), Math.abs(a.value - 100), Math.abs(a.value - 504), Math.abs(a.value - 5040));
      const bLandmark = Math.min(Math.abs(b.value - 5), Math.abs(b.value - 10), Math.abs(b.value - 100), Math.abs(b.value - 504), Math.abs(b.value - 5040));
      return aLandmark - bLandmark;
    })
    .slice(0, MAX_CANDIDATES_PER_SET - selected.length);

  const pruned = new Map();
  for (const candidate of [...selected, ...landmarkValues]) insertCandidate(pruned, candidate);
  return pruned;
}

function subsetDigitsKey(digits, mask) {
  const values = [];
  for (let index = 0; index < digits.length; index += 1) {
    if (mask & (1 << index)) values.push(digits[index]);
  }
  return values.sort((a, b) => a - b).join("");
}

function buildSubsetMap(digits, mask, stage, mapByMask, memoByDigits) {
  if (mapByMask[mask]) return mapByMask[mask];
  const key = subsetDigitsKey(digits, mask);
  if (memoByDigits.has(key)) {
    mapByMask[mask] = memoByDigits.get(key);
    return mapByMask[mask];
  }

  const map = new Map();
  if ((mask & (mask - 1)) === 0) {
    const index = Math.log2(mask);
    insertWithUnary(map, baseCandidate(digits[index]), stage);
  } else {
    const seenPartitions = new Set();
    for (let leftMask = (mask - 1) & mask; leftMask > 0; leftMask = (leftMask - 1) & mask) {
      const rightMask = mask ^ leftMask;
      if (rightMask === 0 || leftMask > rightMask) continue;
      const leftKey = subsetDigitsKey(digits, leftMask);
      const rightKey = subsetDigitsKey(digits, rightMask);
      const partitionKey = [leftKey, rightKey].sort().join("|");
      if (seenPartitions.has(partitionKey)) continue;
      seenPartitions.add(partitionKey);

      const leftMap = buildSubsetMap(digits, leftMask, stage, mapByMask, memoByDigits);
      const rightMap = buildSubsetMap(digits, rightMask, stage, mapByMask, memoByDigits);

      for (const left of leftMap.values()) {
        for (const right of rightMap.values()) {
          for (const operator of stage.binary) {
            if (operator === "+" || operator === "*") {
              insertWithUnary(map, calculateBinary(left, right, operator), stage);
            } else {
              insertWithUnary(map, calculateBinary(left, right, operator), stage);
              insertWithUnary(map, calculateBinary(right, left, operator), stage);
            }
          }
        }
      }

      if (map.size > MAX_CANDIDATES_PER_SET * 2) {
        const compact = pruneMap(map);
        map.clear();
        for (const [candidateKey, candidate] of compact) map.set(candidateKey, candidate);
      }
    }
  }

  const pruned = pruneMap(map);
  memoByDigits.set(key, pruned);
  mapByMask[mask] = pruned;
  return pruned;
}

function reverseUnaryTargets(stage) {
  const specs = [{ value: 10, wrappers: [] }];
  const seen = new Set(["i:10|"]);
  let frontier = specs;

  for (let depth = 0; depth < stage.maxUnaryDepth; depth += 1) {
    const next = [];
    for (const spec of frontier) {
      const predecessors = [];
      if (stage.allowAbs && spec.value >= 0) {
        predecessors.push({ value: -spec.value, wrapper: { kind: "abs" } });
      }
      if (stage.allowSqrt && spec.value >= 0 && spec.value <= Math.sqrt(MAX_VALUE)) {
        predecessors.push({ value: spec.value ** 2, wrapper: { kind: "sqrt" } });
      }
      for (const step of stage.unarySteps) {
        for (let integer = 0; integer <= 30; integer += 1) {
          let output;
          try {
            output = multifactorial(integer, step);
          } catch {
            continue;
          }
          if (Math.abs(output - spec.value) <= EPSILON && Math.abs(integer - spec.value) > EPSILON) {
            predecessors.push({ value: integer, wrapper: { kind: "factorial", step } });
          }
        }
      }

      for (const predecessor of predecessors) {
        const wrappers = [predecessor.wrapper, ...spec.wrappers];
        const key = `${valueKey(predecessor.value)}|${JSON.stringify(wrappers)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const entry = { value: predecessor.value, wrappers };
        specs.push(entry);
        next.push(entry);
      }
    }
    frontier = next;
  }

  return specs;
}

function wrapCandidate(candidate, wrappers) {
  let current = candidate;
  for (const wrapper of wrappers) {
    if (wrapper.kind === "abs") {
      const value = Math.abs(current.value);
      current = createCandidate({
        value,
        ast: { type: "unary", operator: "abs", argument: current.ast },
        stats: unaryStats(current, "abs", value),
      });
    } else if (wrapper.kind === "sqrt") {
      if (current.value < 0) return null;
      const value = Math.sqrt(current.value);
      current = createCandidate({
        value,
        ast: { type: "unary", operator: "sqrt", argument: current.ast },
        stats: unaryStats(current, "sqrt", value),
      });
    } else if (wrapper.kind === "factorial") {
      let value;
      try {
        value = multifactorial(current.value, wrapper.step);
      } catch {
        return null;
      }
      current = createCandidate({
        value,
        ast: { type: "multifactorial", step: wrapper.step, argument: current.ast },
        stats: unaryStats(current, "factorial", value, wrapper.step),
      });
    }
  }
  return current;
}

function findInMap(map, value) {
  return map.get(valueKey(value)) ?? null;
}

function directCandidatesForTarget(leftMap, rightMap, target, stage) {
  const found = [];

  for (const left of leftMap.values()) {
    const addRight = findInMap(rightMap, target - left.value);
    if (addRight) found.push(calculateBinary(left, addRight, "+"));

    const subtractRight = findInMap(rightMap, left.value - target);
    if (subtractRight) found.push(calculateBinary(left, subtractRight, "-"));

    const reverseSubtractLeft = findInMap(rightMap, target + left.value);
    if (reverseSubtractLeft) found.push(calculateBinary(reverseSubtractLeft, left, "-"));

    if (Math.abs(left.value) > EPSILON) {
      const multiplyRight = findInMap(rightMap, target / left.value);
      if (multiplyRight) found.push(calculateBinary(left, multiplyRight, "*"));
    }

    if (Math.abs(target) > EPSILON) {
      const divideRight = findInMap(rightMap, left.value / target);
      if (divideRight && Math.abs(divideRight.value) > EPSILON) {
        found.push(calculateBinary(left, divideRight, "/"));
      }
    }

    const reverseDivideLeft = findInMap(rightMap, target * left.value);
    if (reverseDivideLeft && Math.abs(left.value) > EPSILON) {
      found.push(calculateBinary(reverseDivideLeft, left, "/"));
    }
  }

  if (stage.binary.some((operator) => ["^", "P", "C"].includes(operator))) {
    const leftBeam = [...leftMap.values()].slice(0, 250);
    const rightBeam = [...rightMap.values()].slice(0, 250);
    for (const left of leftBeam) {
      for (const right of rightBeam) {
        for (const operator of stage.binary) {
          if (!["^", "P", "C"].includes(operator)) continue;
          const direct = calculateBinary(left, right, operator);
          if (direct && Math.abs(direct.value - target) <= EPSILON) found.push(direct);
          const reverse = calculateBinary(right, left, operator);
          if (reverse && Math.abs(reverse.value - target) <= EPSILON) found.push(reverse);
        }
      }
    }
  }

  return found.filter(Boolean);
}

function solveStage(digits, stage) {
  const fullMask = (1 << digits.length) - 1;
  const mapByMask = Array(fullMask + 1).fill(null);
  const memoByDigits = new Map();
  const targetSpecs = reverseUnaryTargets(stage);
  const solutions = [];
  const seenPartitions = new Set();

  for (let leftMask = (fullMask - 1) & fullMask; leftMask > 0; leftMask = (leftMask - 1) & fullMask) {
    const rightMask = fullMask ^ leftMask;
    if (rightMask === 0 || leftMask > rightMask) continue;
    const leftKey = subsetDigitsKey(digits, leftMask);
    const rightKey = subsetDigitsKey(digits, rightMask);
    const partitionKey = [leftKey, rightKey].sort().join("|");
    if (seenPartitions.has(partitionKey)) continue;
    seenPartitions.add(partitionKey);

    const leftMap = buildSubsetMap(digits, leftMask, stage, mapByMask, memoByDigits);
    const rightMap = buildSubsetMap(digits, rightMask, stage, mapByMask, memoByDigits);

    for (const targetSpec of targetSpecs) {
      const direct = directCandidatesForTarget(leftMap, rightMap, targetSpec.value, stage);
      for (const candidate of direct) {
        const wrapped = wrapCandidate(candidate, targetSpec.wrappers);
        if (!wrapped || !isTen(wrapped.value)) continue;
        solutions.push(wrapped);
      }
    }
  }

  solutions.sort(compareRank);
  return solutions[0] ?? null;
}

const solutionCache = new Map();

export function normalizeProblemKey(problem) {
  const normalized = String(problem ?? "").trim();
  if (!/^[0-9]{3,5}$/u.test(normalized)) {
    throw new TypeError("problem must contain 3 to 5 digits");
  }
  return [...normalized].sort().join("");
}

export function solveTenProblem(problem) {
  const key = normalizeProblemKey(problem);
  if (solutionCache.has(key)) return solutionCache.get(key);
  const digits = [...key].map(Number);

  for (const stage of STAGES) {
    const candidate = solveStage(digits, stage);
    if (!candidate) continue;
    const result = {
      key,
      expression: candidate.expression,
      compactExpression: candidate.expression.replaceAll(" ", ""),
      value: candidate.value,
      stage: stage.name,
      rank: candidate.rank,
      stats: candidate.stats,
    };
    solutionCache.set(key, result);
    return result;
  }

  solutionCache.set(key, null);
  return null;
}

export function clearSolutionCache() {
  solutionCache.clear();
}
