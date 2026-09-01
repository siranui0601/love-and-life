// Now Coding stack-based VM.
// Logical work is zero-tick; this function runs until it emits one physical action
// or the program genuinely finishes.

function consumeBudget(budget) {
  budget.count += 1;
  if (budget.count > budget.limit) throw new Error("instruction_budget_exceeded");
}

function nearestEnemyDistance(state, agent) {
  let best = Infinity;
  for (const other of state.agents || []) {
    if (!other?.alive || other.id === agent.id) continue;
    const distance = Math.abs(Number(other.x) - Number(agent.x)) + Math.abs(Number(other.y) - Number(agent.y));
    if (distance < best) best = distance;
  }
  return Number.isFinite(best) ? best : -1;
}

export function evaluateVmExpression(expr, context, budget = { count: 0, limit: 10000 }) {
  consumeBudget(budget);
  if (expr === null || expr === undefined) return 0;
  if (["number", "boolean", "string"].includes(typeof expr)) return expr;
  if (typeof expr !== "object") return 0;

  if (expr.type === "literal") return expr.value;
  if (expr.type === "var") return context.agent.vars?.[String(expr.name || "")] ?? 0;

  if (expr.type === "builtin") {
    if (expr.name === "ink") return Number(context.agent.ink || 0);
    if (expr.name === "tailLength") return Array.isArray(context.agent.tail) ? context.agent.tail.length : 0;
    if (expr.name === "noMoveTicks") return Number(context.agent.noMoveTicks || 0);
    if (expr.name === "enemyDistance") return nearestEnemyDistance(context.state, context.agent);
    return 0;
  }

  if (expr.type === "sensor") {
    return context.sense(context.state, context.agent, expr.direction || "front").state;
  }

  if (expr.type === "sensorProperty") {
    const sensed = context.sense(context.state, context.agent, expr.direction || "front");
    if (expr.property === "owner") return Number.isInteger(sensed.owner) ? sensed.owner : -1;
    if (expr.property === "ownerColor") {
      const owner = Number.isInteger(sensed.owner) ? sensed.owner : -1;
      return owner >= 0 ? String(context.state.agents?.[owner]?.color || "") : "";
    }
    return "";
  }

  if (expr.type === "random") {
    const min = Number(evaluateVmExpression(expr.min ?? 0, context, budget));
    const max = Number(evaluateVmExpression(expr.max ?? 1, context, budget));
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : 1;
    const low = Math.ceil(Math.min(safeMin, safeMax));
    const high = Math.floor(Math.max(safeMin, safeMax));
    if (high < low) return low;
    return Math.floor(context.state.random() * (high - low + 1)) + low;
  }

  if (expr.type === "not") return !Boolean(evaluateVmExpression(expr.value, context, budget));

  if (expr.type === "binary") {
    const op = expr.op;
    if (op === "and") return Boolean(evaluateVmExpression(expr.left, context, budget)) && Boolean(evaluateVmExpression(expr.right, context, budget));
    if (op === "or") return Boolean(evaluateVmExpression(expr.left, context, budget)) || Boolean(evaluateVmExpression(expr.right, context, budget));

    const left = evaluateVmExpression(expr.left, context, budget);
    const right = evaluateVmExpression(expr.right, context, budget);
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

function legacyConditionToExpression(statement) {
  if (statement?.condition?.type === "cell") {
    return {
      type: "binary",
      op: "==",
      left: { type: "sensor", direction: statement.condition.direction || "front" },
      right: { type: "literal", value: statement.condition.value || "unclaimed" },
    };
  }
  if (statement?.condition?.type === "random") {
    return {
      type: "binary",
      op: "<",
      left: { type: "random", min: 0, max: 9999 },
      right: { type: "literal", value: Math.round(Math.max(0, Math.min(1, Number(statement.condition.chance) || 0.5)) * 10000) },
    };
  }
  return statement?.condition || { type: "literal", value: false };
}

function makeSequenceFrame(statements, ownerLoopId = "") {
  return {
    kind: "sequence",
    statements: Array.isArray(statements) ? statements : [],
    index: 0,
    ownerLoopId,
  };
}

function ensureVm(agent) {
  if (!agent.vm || agent.vm.programRef !== agent.program) {
    agent.vm = {
      programRef: agent.program,
      stack: [makeSequenceFrame(agent.program)],
      halted: false,
      nextLoopId: 1,
    };
  }
  return agent.vm;
}

function pushLoop(vm, statement, context, budget) {
  const loopId = `loop-${vm.nextLoopId++}`;
  if (statement.type === "repeat") {
    const raw = Math.floor(Number(evaluateVmExpression(statement.times ?? 1, context, budget)) || 0);
    const remaining = Math.max(0, Math.min(10000, raw));
    if (remaining <= 0) return;
    vm.stack.push({ kind: "loop", loopId, loopType: "repeat", statement, remaining });
    return;
  }
  if (statement.type === "while") {
    vm.stack.push({ kind: "loop", loopId, loopType: "while", statement });
    return;
  }
  vm.stack.push({ kind: "loop", loopId, loopType: "forever", statement });
}

function breakNearestLoop(vm) {
  let loopIndex = -1;
  for (let index = vm.stack.length - 1; index >= 0; index -= 1) {
    if (vm.stack[index]?.kind === "loop") {
      loopIndex = index;
      break;
    }
  }
  if (loopIndex < 0) return false;
  vm.stack.splice(loopIndex);
  return true;
}

function loopBody(loopFrame, context, budget) {
  const statement = loopFrame.statement || {};
  const body = Array.isArray(statement.body) ? statement.body : [];
  if (!body.length) return null;

  if (loopFrame.loopType === "repeat") {
    if (loopFrame.remaining <= 0) return null;
    loopFrame.remaining -= 1;
    return makeSequenceFrame(body, loopFrame.loopId);
  }

  if (loopFrame.loopType === "while") {
    const condition = Boolean(evaluateVmExpression(legacyConditionToExpression(statement), context, budget));
    if (!condition) return null;
    return makeSequenceFrame(body, loopFrame.loopId);
  }

  return makeSequenceFrame(body, loopFrame.loopId);
}

function emitAction(statement, context, budget) {
  if (statement.action === "attack") {
    const raw = Number(evaluateVmExpression(statement.range ?? 1, context, budget));
    const range = Number.isFinite(raw) ? Math.floor(raw) : 0;
    return { type: "attack", range };
  }
  if (statement.action === "turn") {
    return statement.direction === "left" ? "turnLeft" : "turnRight";
  }
  if (["move", "turnLeft", "turnRight"].includes(statement.action)) return statement.action;
  return null;
}

export function resetVm(agent) {
  if (agent) delete agent.vm;
}

export function runProgramUntilAction(state, agent, instructionBudget = 10000, options = {}) {
  if (!agent?.alive) return "none";
  const program = Array.isArray(agent.program) ? agent.program : [];
  if (!program.length) return "none";

  const vm = ensureVm(agent);
  if (vm.halted) return "none";

  const budget = { count: 0, limit: instructionBudget };
  const context = {
    state,
    agent,
    sense: typeof options.sense === "function" ? options.sense : (() => ({ state: "unclaimed", owner: -1 })),
  };

  try {
    while (vm.stack.length) {
      consumeBudget(budget);
      const frame = vm.stack[vm.stack.length - 1];

      if (frame.kind === "loop") {
        const bodyFrame = loopBody(frame, context, budget);
        if (!bodyFrame) {
          vm.stack.pop();
          continue;
        }
        vm.stack.push(bodyFrame);
        continue;
      }

      if (frame.index >= frame.statements.length) {
        vm.stack.pop();
        continue;
      }

      const statement = frame.statements[frame.index];
      frame.index += 1;
      if (!statement || typeof statement !== "object") continue;
      consumeBudget(budget);

      if (statement.type === "action") {
        const action = emitAction(statement, context, budget);
        if (action) return action;
        continue;
      }

      if (statement.type === "set") {
        const name = String(statement.name || "value").slice(0, 40);
        agent.vars[name] = evaluateVmExpression(statement.value, context, budget);
        continue;
      }

      if (statement.type === "change") {
        const name = String(statement.name || "value").slice(0, 40);
        agent.vars[name] = Number(agent.vars[name] || 0) + Number(evaluateVmExpression(statement.value ?? 1, context, budget) || 0);
        continue;
      }

      if (statement.type === "if") {
        const passed = Boolean(evaluateVmExpression(legacyConditionToExpression(statement), context, budget));
        const branch = passed ? statement.then : statement.else;
        if (typeof branch === "string") {
          const action = emitAction({ type: "action", action: branch }, context, budget);
          if (action) return action;
        } else if (Array.isArray(branch) && branch.length) {
          vm.stack.push(makeSequenceFrame(branch));
        }
        continue;
      }

      if (["forever", "repeat", "while"].includes(statement.type)) {
        pushLoop(vm, statement, context, budget);
        continue;
      }

      if (statement.type === "break") {
        breakNearestLoop(vm);
        continue;
      }
    }

    vm.halted = true;
    return "none";
  } catch (error) {
    if (error?.message === "instruction_budget_exceeded") return "none";
    throw error;
  }
}
