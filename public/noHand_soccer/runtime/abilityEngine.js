const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const len = (v) => Math.hypot(v.x, v.y) || 0.0001;
const norm = (v) => { const l = len(v); return { x: v.x / l, y: v.y / l }; };
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (v, s) => ({ x: v.x * s, y: v.y * s });
const rotate = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
const toward = (from, to) => norm({ x: to.x - from.x, y: to.y - from.y });

export function createSeededRandom(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function createAbilityEngine(registry, options = {}) {
  const cooldowns = new Map();
  const active = new Map();
  const warnings = [];
  const maxSpeed = options.maxSpeed ?? 880;
  const primitives = createPrimitives(maxSpeed);

  function trigger(name, ball, context = {}) {
    const spec = registry[name];
    if (!spec) {
      const warning = `未実装 ability: ${name}`;
      if (!warnings.includes(warning)) warnings.push(warning);
      context.onWarning?.(warning);
      return null;
    }
    const now = context.now ?? 0;
    if ((cooldowns.get(name) ?? -Infinity) > now) return null;
    const duration = clamp(spec.duration ?? 0, 0, 2400);
    cooldowns.set(name, now + clamp(spec.cooldown ?? 0, 0, 6000));
    active.set(name, { until: now + duration, spec });
    const result = spec.apply(ball, { ...context, primitives, random: context.random ?? Math.random });
    clampVelocity(ball, maxSpeed);
    return { name, visualHint: spec.visualHint, effect: result ?? spec.description };
  }

  function tick(ball, context = {}) {
    const now = context.now ?? 0;
    for (const [name, item] of active) {
      if (item.until <= now) active.delete(name);
    }
    clampVelocity(ball, maxSpeed);
  }

  return { trigger, tick, warnings, getActive: () => [...active.keys()], reset: () => { cooldowns.clear(); active.clear(); warnings.length = 0; } };
}

function clampVelocity(ball, maxSpeed) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > maxSpeed) {
    ball.vx = (ball.vx / speed) * maxSpeed;
    ball.vy = (ball.vy / speed) * maxSpeed;
  }
}

function createPrimitives(maxSpeed) {
  const capDelta = (delta, max) => { const l = len(delta); return l > max ? mul(delta, max / l) : delta; };
  return {
    applyImpulse(ball, dir, strength, maxDelta) {
      const d = capDelta(mul(norm(dir), strength), maxDelta);
      ball.vx += d.x; ball.vy += d.y; return `impulse(${d.x.toFixed(1)}, ${d.y.toFixed(1)})`;
    },
    applyCarryForce(ball, dir, strength, maxDelta) {
      const d = capDelta(mul(norm(dir), strength), maxDelta);
      ball.vx += d.x; ball.vy += d.y; return `carry(${d.x.toFixed(1)}, ${d.y.toFixed(1)})`;
    },
    redirectVelocity(ball, dir, blend, maxAngle) {
      const speed = Math.min(len({ x: ball.vx, y: ball.vy }), maxSpeed);
      const current = norm({ x: ball.vx, y: ball.vy });
      const target = norm(dir);
      const cross = current.x * target.y - current.y * target.x;
      const dot = clamp(current.x * target.x + current.y * target.y, -1, 1);
      const angle = clamp(Math.atan2(cross, dot) * blend, -maxAngle, maxAngle);
      const out = rotate(current, angle);
      ball.vx = out.x * speed; ball.vy = out.y * speed; return `redirect(${(angle * 180 / Math.PI).toFixed(1)}deg)`;
    },
    dampenVelocity(ball, factor, floor = 0) {
      const f = clamp(factor, 0, 1); ball.vx *= f; ball.vy *= f; if (Math.abs(ball.vx) < floor) ball.vx = 0; if (Math.abs(ball.vy) < floor) ball.vy = 0; return `dampen(${f.toFixed(2)})`;
    },
    holdBall(ball, anchor, strength, maxHoldMs, now) {
      ball.holdUntil = Math.min(now + maxHoldMs, now + 1200); ball.x += (anchor.x - ball.x) * strength; ball.y += (anchor.y - ball.y) * strength; ball.vx *= .24; ball.vy *= .24; return `hold(${maxHoldMs}ms)`;
    },
    releaseBall(ball, dir, strength, maxDelta) { ball.holdUntil = 0; return this.applyImpulse(ball, dir, strength, maxDelta); },
    applyLift(ball, strength, maxDelta) { return this.applyImpulse(ball, { x: 0, y: -1 }, strength, maxDelta); },
    applyOrbit(ball, center, strength, maxDelta) { const radial = toward(center, ball); const tangent = { x: -radial.y, y: radial.x }; return this.applyCarryForce(ball, add(tangent, mul(toward(ball, center), .45)), strength, maxDelta); },
    applySeededJitter(ball, random, strength, maxDelta) { const a = (random() * 2 - 1) * Math.PI; return this.applyImpulse(ball, { x: Math.cos(a), y: Math.sin(a) }, strength, maxDelta); },
    clampPosition(ball, bounds = {}) {
      const minX = bounds.minX ?? ball.r ?? 0;
      const maxX = bounds.maxX ?? ((bounds.width ?? 0) - (ball.r ?? 0));
      const minY = bounds.minY ?? ball.r ?? 0;
      const maxY = bounds.maxY ?? ((bounds.height ?? 0) - (ball.r ?? 0));
      ball.x = clamp(ball.x, minX, maxX);
      ball.y = clamp(ball.y, minY, maxY);
      return `clampPosition(${ball.x.toFixed(1)}, ${ball.y.toFixed(1)})`;
    },
    warpToRelative(ball, anchor, offset, bounds) {
      const from = { x: ball.x, y: ball.y };
      ball.x = (anchor?.x ?? 0) + (offset?.x ?? 0);
      ball.y = (anchor?.y ?? 0) + (offset?.y ?? 0);
      this.clampPosition(ball, bounds);
      return { from, target: { x: ball.x, y: ball.y }, offset: { x: offset?.x ?? 0, y: offset?.y ?? 0 } };
    },
    toward, norm, clamp
  };
}
