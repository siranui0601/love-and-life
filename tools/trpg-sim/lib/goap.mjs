/**
 * Deterministic generic GOAP planner.
 *
 * The planner is A* when a heuristic is supplied and Dijkstra otherwise.  It
 * deliberately knows nothing about the TRPG world; callers provide state,
 * actions, preconditions/effects and (optionally) a heuristic.
 */

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function cloneState(state) {
  if (typeof structuredClone === "function") return structuredClone(state);
  return JSON.parse(JSON.stringify(state));
}

function matchesPartial(state, expected) {
  if (!isPlainObject(expected)) return Object.is(state, expected);
  if (!isPlainObject(state)) return false;
  return Object.entries(expected).every(([key, value]) => {
    if (isPlainObject(value)) return matchesPartial(state[key], value);
    if (Array.isArray(value)) {
      return Array.isArray(state[key]) && stableStringify(state[key]) === stableStringify(value);
    }
    return Object.is(state[key], value);
  });
}

function predicateMatches(state, preconditions, context) {
  if (typeof preconditions === "function") {
    return Boolean(preconditions(state, context));
  }
  if (preconditions == null) return true;
  return matchesPartial(state, preconditions);
}

function applyEffects(state, effects, context) {
  if (typeof effects === "function") {
    const produced = effects(cloneState(state), context);
    if (produced == null || typeof produced !== "object") {
      throw new TypeError("GOAP action effect function must return a state object");
    }
    return produced;
  }
  if (!isPlainObject(effects)) {
    throw new TypeError("GOAP action effects must be an object or function");
  }
  return { ...cloneState(state), ...cloneState(effects) };
}

function goalPredicate(goal) {
  if (typeof goal === "function") return goal;
  if (isPlainObject(goal)) return (state) => matchesPartial(state, goal);
  throw new TypeError("GOAP goal must be a predicate or partial state object");
}

function actionCost(action, state, nextState, context) {
  const raw = typeof action.cost === "function"
    ? action.cost(state, nextState, context)
    : (action.cost ?? 1);
  const cost = Number(raw);
  if (!Number.isFinite(cost) || cost < 0) {
    throw new RangeError(`GOAP action ${action.id} has invalid cost ${String(raw)}`);
  }
  return cost;
}

function normalizeActions(actions) {
  if (!Array.isArray(actions)) throw new TypeError("GOAP actions must be an array");
  const ids = new Set();
  return actions.map((action, index) => {
    if (!action || typeof action !== "object") {
      throw new TypeError(`GOAP action at index ${index} is not an object`);
    }
    const id = String(action.id ?? "").trim();
    if (!id) throw new TypeError(`GOAP action at index ${index} has no id`);
    if (ids.has(id)) throw new TypeError(`Duplicate GOAP action id: ${id}`);
    ids.add(id);
    return { ...action, id };
  }).sort((a, b) => a.id.localeCompare(b.id, "en"));
}

class MinQueue {
  constructor() {
    this.items = [];
    this.sequence = 0;
  }

  push(node) {
    this.items.push({ ...node, sequence: this.sequence++ });
    this.items.sort((a, b) =>
      a.f - b.f ||
      a.g - b.g ||
      a.depth - b.depth ||
      a.tieKey.localeCompare(b.tieKey, "en") ||
      a.sequence - b.sequence
    );
  }

  pop() {
    return this.items.shift();
  }

  get size() {
    return this.items.length;
  }
}

function reconstruct(goalKey, records) {
  const actionPath = [];
  const statePath = [];
  let key = goalKey;
  while (key != null) {
    const record = records.get(key);
    if (!record) break;
    statePath.push(record.state);
    if (record.action) actionPath.push(record.action);
    key = record.parentKey;
  }
  statePath.reverse();
  actionPath.reverse();
  return { actions: actionPath, states: statePath };
}

/**
 * @param {object} options
 * @returns {{status: "success"|"failure", actions: object[], states: object[], cost: number, expanded: number, visited: number, reason?: string}}
 */
export function planGoap({
  initialState,
  goal,
  actions,
  heuristic = () => 0,
  stateKey = stableStringify,
  maxExpansions = 50_000,
  context = {},
} = {}) {
  if (initialState == null || typeof initialState !== "object") {
    throw new TypeError("GOAP initialState must be an object");
  }
  if (!Number.isInteger(maxExpansions) || maxExpansions < 1) {
    throw new RangeError("GOAP maxExpansions must be a positive integer");
  }

  const isGoal = goalPredicate(goal);
  const availableActions = normalizeActions(actions);
  const start = cloneState(initialState);
  const startKey = String(stateKey(start));
  const startHeuristic = Number(heuristic(start, context));
  if (!Number.isFinite(startHeuristic) || startHeuristic < 0) {
    throw new RangeError("GOAP heuristic must return a finite non-negative number");
  }

  const records = new Map([[startKey, {
    state: start,
    g: 0,
    parentKey: null,
    action: null,
  }]]);
  const bestCost = new Map([[startKey, 0]]);
  const open = new MinQueue();
  open.push({ key: startKey, state: start, g: 0, f: startHeuristic, depth: 0, tieKey: "" });

  let expanded = 0;
  while (open.size > 0) {
    const current = open.pop();
    if (current.g !== bestCost.get(current.key)) continue;

    if (isGoal(current.state, context)) {
      const path = reconstruct(current.key, records);
      return {
        status: "success",
        ...path,
        cost: current.g,
        expanded,
        visited: bestCost.size,
      };
    }

    if (expanded >= maxExpansions) {
      return {
        status: "failure",
        actions: [],
        states: [start],
        cost: Number.POSITIVE_INFINITY,
        expanded,
        visited: bestCost.size,
        reason: "max-expansions",
      };
    }
    expanded += 1;

    for (const action of availableActions) {
      const canApply = action.isApplicable
        ? action.isApplicable(current.state, context)
        : predicateMatches(current.state, action.preconditions, context);
      if (!canApply) continue;

      const nextState = action.apply
        ? action.apply(cloneState(current.state), context)
        : applyEffects(current.state, action.effects, context);
      if (nextState == null || typeof nextState !== "object") {
        throw new TypeError(`GOAP action ${action.id} did not return a state object`);
      }
      const stepCost = actionCost(action, current.state, nextState, context);
      const nextG = current.g + stepCost;
      const nextKey = String(stateKey(nextState));
      const known = bestCost.get(nextKey);
      if (known != null && nextG >= known - Number.EPSILON) continue;

      const h = Number(heuristic(nextState, context));
      if (!Number.isFinite(h) || h < 0) {
        throw new RangeError("GOAP heuristic must return a finite non-negative number");
      }

      bestCost.set(nextKey, nextG);
      records.set(nextKey, {
        state: cloneState(nextState),
        g: nextG,
        parentKey: current.key,
        action,
      });
      open.push({
        key: nextKey,
        state: nextState,
        g: nextG,
        f: nextG + h,
        depth: current.depth + 1,
        tieKey: `${current.tieKey}\u0000${action.id}`,
      });
    }
  }

  return {
    status: "failure",
    actions: [],
    states: [start],
    cost: Number.POSITIVE_INFINITY,
    expanded,
    visited: bestCost.size,
    reason: "no-plan",
  };
}

export function planDijkstra(options = {}) {
  return planGoap({ ...options, heuristic: () => 0 });
}

