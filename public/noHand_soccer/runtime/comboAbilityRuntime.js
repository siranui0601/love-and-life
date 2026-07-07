import { COMBO_RUNTIME_VERSION, resolveComboParams } from './comboParamResolver.js';

const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const len = (v) => Math.hypot(v.x, v.y) || 0.0001;
const norm = (v) => { const l = len(v); return { x: v.x / l, y: v.y / l }; };
const rotate = (v, deg) => { const a = deg * Math.PI / 180; return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) }; };
const toward = (from, to) => norm({ x: to.x - from.x, y: to.y - from.y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const nowishId = (() => { let id = 1; return () => id += 1; })();

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2; }
function bezier(a, b, c, d, t) {
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * d.y,
  };
}
function tangentBezier(a, b, c, d, t) {
  const u = 1 - t;
  return norm({
    x: 3 * u ** 2 * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t ** 2 * (d.x - c.x),
    y: 3 * u ** 2 * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t ** 2 * (d.y - c.y),
  });
}
function goalCenter(goals) {
  const g = goals[0] ?? { x: 890, y: 240, w: 30, h: 160 };
  return { x: g.x + g.w / 2, y: g.y + g.h / 2 };
}
function goalDir(c) { return toward(c.ball, goalCenter(c.goals)); }
function setVelocity(ball, dir, speed) { const d = norm(dir); ball.vx = d.x * speed; ball.vy = d.y * speed; }
function impulse(ball, dir, force) { const d = norm(dir); ball.vx += d.x * force; ball.vy += d.y * force; }
function drawArrow(ctx, from, to, color = 'rgba(255,255,255,.75)') {
  const d = toward(from, to);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - d.x * 18 + d.y * 8, to.y - d.y * 18 - d.x * 8);
  ctx.lineTo(to.x - d.x * 18 - d.y * 8, to.y - d.y * 18 + d.x * 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export const comboAbilityParamSpec = {
  warpExit: {
    offsetX: { min: 130, max: 310 }, offsetY: { min: -190, max: 60 }, releaseSpeed: { min: 360, max: 620 },
    exitTiltDeg: { min: -24, max: 20 }, portalSize: { min: 34, max: 58 },
  },
  hiddenRoute: {
    routeType: { type: 'choice', choices: ['upperArc', 'sCurve', 'loopRail'] },
    endOffsetX: { min: 240, max: 390 }, endOffsetY: { min: -210, max: -70 }, lift: { min: 120, max: 230 },
    durationMs: { type: 'int', min: 850, max: 1450 }, releaseSpeed: { min: 430, max: 690 }, releaseAngleDeg: { min: -18, max: 14 },
  },
  lowGravityField: {
    radius: { min: 130, max: 210 }, pull: { min: 120, max: 230 }, orbit: { min: 150, max: 290 }, gravityScale: { min: 0.08, max: 0.34 },
    releaseBoost: { min: 120, max: 240 }, swirlDir: { type: 'choice', choices: [-1, 1] },
  },
  trapHold: {
    durationMs: { type: 'int', min: 520, max: 980 }, chargeRadius: { min: 44, max: 74 }, releaseSpeed: { min: 430, max: 680 }, angleDeg: { min: -38, max: -8 },
  },
  aimAssist: { radius: { min: 150, max: 270 }, lockMs: { type: 'int', min: 180, max: 360 }, releaseSpeed: { min: 390, max: 620 }, bendDeg: { min: -10, max: 10 } },
  precisionPass: { angleDeg: { min: -18, max: 10 }, releaseSpeed: { min: 430, max: 700 }, beamMs: { type: 'int', min: 180, max: 330 } },
  curveRedirect: { angleDeg: { min: -48, max: 48 }, force: { min: 260, max: 480 }, curveMs: { type: 'int', min: 260, max: 520 } },
  pushRedirect: { angleDeg: { min: -30, max: 30 }, force: { min: 300, max: 540 }, shoveMs: { type: 'int', min: 120, max: 260 } },
  spinRedirect: { angleDeg: { min: 38, max: 92 }, force: { min: 220, max: 390 }, spin: { type: 'choice', choices: [-1, 1] }, spinPower: { min: 0.55, max: 1.15 } },
  splitScatter: { count: { type: 'int', min: 2, max: 4 }, spreadDeg: { min: 18, max: 44 }, releaseSpeed: { min: 330, max: 530 }, cloneDelayMs: { type: 'int', min: 0, max: 110 } },
  paintTrail: { durationMs: { type: 'int', min: 1600, max: 3200 }, hue: { type: 'int', min: 0, max: 359 }, radius: { min: 18, max: 30 }, effectType: { type: 'choice', choices: ['boost', 'bounce', 'flow'] }, force: { min: 160, max: 300 } },
  reflectShield: { radius: { min: 68, max: 102 }, force: { min: 360, max: 650 }, flashMs: { type: 'int', min: 220, max: 460 } },
};

export function compileComboAbility({ comboKey, abilities = [], version = COMBO_RUNTIME_VERSION, maxAbilities = 6 }) {
  const unique = [...new Set(abilities)].filter((name) => comboAbilityParamSpec[name]).slice(0, maxAbilities);
  return {
    comboKey,
    version,
    abilities: unique,
    ...resolveComboParams(comboKey, Object.fromEntries(unique.map((a) => [a, comboAbilityParamSpec[a]])), { version }),
  };
}

export function createComboAbilityRuntime(compiled, options = {}) {
  const state = {
    field: options.field ?? { w: 960, h: 540, floor: 484, gravity: 760, deathY: 535 },
    goals: options.goals ?? [{ x: 890, y: 242, w: 28, h: 168 }],
    device: options.device ?? { x: 455, y: 292, r: 58 },
    balls: [], activeEffects: [], paintSegments: [], goalsScored: 0, deadBalls: 0, timeMs: 0,
    compiled,
  };
  const handlers = Object.fromEntries(compiled.abilities.map((name) => [name, makeHandler(name, compiled.params[name] ?? {})]));
  function ctx(ball) {
    return {
      state, ball, device: state.device, field: state.field, goals: state.goals, params: compiled.params,
      addEffect: (e) => state.activeEffects.push({ id: nowishId(), ...e, t: state.timeMs }),
      addBall,
    };
  }
  function addBall(ball) {
    state.balls.push({
      id: nowishId(), r: 15, alive: true, trail: [], flags: {}, contactInside: false,
      cooldowns: {}, consumed: {}, deviceImmuneUntil: 0, paintCooldownUntil: 0,
      ...ball,
    });
  }
  function reset(ball = {}) {
    state.balls = [];
    state.activeEffects = [];
    state.paintSegments = [];
    state.goalsScored = 0;
    state.deadBalls = 0;
    state.timeMs = 0;
    addBall({ x: 190, y: 90, vx: 260, vy: 0, ...ball });
  }
  function contactEnter(ball) {
    if (ball.deviceImmuneUntil > state.timeMs) return;
    const c = ctx(ball);
    for (const h of Object.values(handlers)) h.onContact?.(c);
  }
  function tick(dtMs) {
    state.timeMs += dtMs;
    const dt = Math.min(dtMs / 1000, 0.033);
    state.activeEffects = state.activeEffects.filter((e) => !e.until || e.until > state.timeMs);
    state.paintSegments = state.paintSegments.filter((segment) => segment.until > state.timeMs);

    for (const ball of [...state.balls]) {
      if (!ball.alive) continue;
      handleHeldAndRoutes(state, ball);
      const locked = ball.flags.heldUntil > state.timeMs || ball.route;
      if (!locked) {
        for (const h of Object.values(handlers)) h.tick?.(ctx(ball), dtMs);
        ball.vy += state.field.gravity * (ball.gravityScale ?? 1) * dt;
        ball.vx += (ball.gravityX ?? 0) * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        stepRuntimeCollisions(state, ball);
        applyPaintSegments(state, ball);
      }
      addTrailAndPaint(state, ball);
      updateDeviceContact(state, ball, contactEnter);
      checkGoalAndDeath(state, ball);
      ball.gravityScale = 1;
      ball.gravityX = 0;
    }
  }
  function draw(canvasCtx) {
    drawRuntimeBase(state, canvasCtx);
    for (const h of Object.values(handlers)) h.draw?.({ state, ctx: canvasCtx });
  }
  reset(options.ball);
  return { state, reset, addBall, tick, draw, handlers };
}

function updateDeviceContact(state, ball, enter) {
  const inside = dist(ball, state.device) <= ball.r + state.device.r;
  if (inside && !ball.contactInside) enter(ball);
  ball.contactInside = inside;
}

function checkGoalAndDeath(state, ball) {
  for (const g of state.goals) {
    if (ball.x + ball.r >= g.x && ball.x - ball.r <= g.x + g.w && ball.y >= g.y && ball.y <= g.y + g.h) {
      ball.alive = false;
      state.goalsScored += 1;
      state.activeEffects.push({ id: nowishId(), type: 'goalBurst', x: ball.x, y: ball.y, until: state.timeMs + 700 });
    }
  }
  if (ball.y - ball.r > state.field.deathY) {
    ball.alive = false;
    state.deadBalls += 1;
  }
}

function handleHeldAndRoutes(state, ball) {
  if (ball.flags.heldUntil > state.timeMs) {
    ball.x = ball.flags.holdX ?? state.device.x;
    ball.y = ball.flags.holdY ?? state.device.y;
    ball.vx = 0;
    ball.vy = 0;
    return;
  }
  if (ball.flags.trapRelease) {
    const release = ball.flags.trapRelease;
    setVelocity(ball, rotate(toward(ball, goalCenter(state.goals)), release.angleDeg), release.speed);
    ball.deviceImmuneUntil = state.timeMs + 420;
    ball.contactInside = true;
    delete ball.flags.trapRelease;
  }
  if (!ball.route) return;
  const route = ball.route;
  const t = clamp((state.timeMs - route.startMs) / route.durationMs, 0, 1);
  const eased = easeInOut(t);
  const p = bezier(route.start, route.c1, route.c2, route.end, eased);
  ball.x = p.x;
  ball.y = p.y;
  ball.vx = 0;
  ball.vy = 0;
  if (t >= 1) {
    const tangent = tangentBezier(route.start, route.c1, route.c2, route.end, 1);
    setVelocity(ball, rotate(tangent, route.releaseAngleDeg), route.releaseSpeed);
    ball.deviceImmuneUntil = state.timeMs + 460;
    ball.contactInside = true;
    delete ball.route;
  }
}

function addTrailAndPaint(state, ball) {
  ball.trail.push({ x: ball.x, y: ball.y, t: state.timeMs });
  if (ball.trail.length > 180) ball.trail.shift();
  if (!(ball.paintUntil > state.timeMs) || !ball.alive) return;
  const last = ball.lastPaintSegment;
  if (last && dist(last, ball) < 22) return;
  const segment = {
    id: nowishId(), ownerId: ball.id, x: ball.x, y: ball.y, hue: ball.paintHue, radius: ball.paintRadius,
    effectType: ball.paintEffectType, force: ball.paintForce, until: Math.min(ball.paintUntil, state.timeMs + 1800),
  };
  ball.lastPaintSegment = { x: ball.x, y: ball.y };
  state.paintSegments.push(segment);
}

function applyPaintSegments(state, ball) {
  if (ball.paintCooldownUntil > state.timeMs) return;
  for (const segment of state.paintSegments) {
    if (segment.ownerId === ball.id && state.timeMs - (ball.paintStartedAt ?? 0) < 420) continue;
    if (dist(ball, segment) > ball.r + segment.radius) continue;
    if (segment.effectType === 'boost') impulse(ball, toward(segment, goalCenter(state.goals)), segment.force);
    if (segment.effectType === 'bounce') ball.vy = -Math.max(Math.abs(ball.vy), segment.force * 1.25);
    if (segment.effectType === 'flow') { ball.vx += segment.force * 0.55; ball.vy -= segment.force * 0.22; }
    ball.paintCooldownUntil = state.timeMs + 240;
    state.activeEffects.push({ id: nowishId(), type: 'paintPop', x: segment.x, y: segment.y, hue: segment.hue, until: state.timeMs + 320 });
    return;
  }
}

function makeHandler(name, p) {
  const consume = (ball, key = name, cooldownMs = 700) => {
    if (ball.consumed[key]) return false;
    if ((ball.cooldowns[key] ?? 0) > ball.stateTime) return false;
    ball.consumed[key] = true;
    ball.cooldowns[key] = ball.stateTime + cooldownMs;
    return true;
  };
  const enterOnce = (c, key = name, cooldownMs = 700) => {
    c.ball.stateTime = c.state.timeMs;
    return consume(c.ball, key, cooldownMs);
  };
  const contact = {
    warpExit(c) {
      if (!enterOnce(c, 'warpExit', 900)) return;
      const exit = {
        x: clamp(c.device.x + p.offsetX, c.ball.r, c.field.w - c.ball.r),
        y: clamp(c.device.y + p.offsetY, c.ball.r, c.field.floor - c.ball.r),
      };
      c.addEffect({ type: 'portalPair', from: { x: c.device.x, y: c.device.y }, to: exit, size: p.portalSize, until: c.state.timeMs + 760 });
      c.ball.x = exit.x;
      c.ball.y = exit.y;
      setVelocity(c.ball, rotate(toward(c.device, exit), p.exitTiltDeg), p.releaseSpeed);
      c.ball.deviceImmuneUntil = c.state.timeMs + 360;
    },
    hiddenRoute(c) {
      if (!enterOnce(c, 'hiddenRoute', 1200)) return;
      const start = { x: c.ball.x, y: c.ball.y };
      const end = {
        x: clamp(c.device.x + p.endOffsetX, 80, c.field.w - 80),
        y: clamp(c.device.y + p.endOffsetY, 40, c.field.floor - 90),
      };
      const sign = p.routeType === 'sCurve' ? -1 : 1;
      const c1 = { x: c.device.x + 45 * sign, y: c.device.y - p.lift };
      const c2 = p.routeType === 'loopRail'
        ? { x: c.device.x + p.endOffsetX * 0.55, y: c.device.y - p.lift - 60 }
        : { x: end.x - 80 * sign, y: end.y - p.lift * 0.28 };
      c.ball.route = { type: p.routeType, start, c1, c2, end, startMs: c.state.timeMs, durationMs: p.durationMs, releaseSpeed: p.releaseSpeed, releaseAngleDeg: p.releaseAngleDeg };
      c.ball.deviceImmuneUntil = c.state.timeMs + p.durationMs + 360;
      c.addEffect({ type: 'routeRail', route: c.ball.route, until: c.state.timeMs + p.durationMs + 420 });
    },
    trapHold(c) {
      if (!enterOnce(c, 'trapHold', p.durationMs + 900)) return;
      c.ball.flags.heldUntil = c.state.timeMs + p.durationMs;
      c.ball.flags.holdX = c.device.x;
      c.ball.flags.holdY = c.device.y;
      c.ball.flags.trapRelease = { speed: p.releaseSpeed, angleDeg: p.angleDeg };
      c.ball.deviceImmuneUntil = c.state.timeMs + p.durationMs + 480;
      c.addEffect({ type: 'trapCharge', radius: p.chargeRadius, until: c.ball.flags.heldUntil });
    },
    aimAssist(c) {
      if (!enterOnce(c, 'aimAssist', 850)) return;
      const target = goalCenter(c.goals);
      c.addEffect({ type: 'aimLock', from: { x: c.ball.x, y: c.ball.y }, to: target, until: c.state.timeMs + p.lockMs + 260 });
      setVelocity(c.ball, rotate(toward(c.ball, target), p.bendDeg), p.releaseSpeed);
      c.ball.deviceImmuneUntil = c.state.timeMs + 320;
    },
    precisionPass(c) {
      if (!enterOnce(c, 'precisionPass', 850)) return;
      const target = goalCenter(c.goals);
      c.addEffect({ type: 'precisionBeam', from: { x: c.ball.x, y: c.ball.y }, to: target, until: c.state.timeMs + p.beamMs });
      setVelocity(c.ball, rotate(toward(c.ball, target), p.angleDeg), p.releaseSpeed);
      c.ball.deviceImmuneUntil = c.state.timeMs + 300;
    },
    curveRedirect(c) {
      if (!enterOnce(c, 'curveRedirect', 720)) return;
      const dir = rotate(goalDir(c), p.angleDeg);
      impulse(c.ball, dir, p.force);
      c.ball.curveUntil = c.state.timeMs + p.curveMs;
      c.ball.curveForce = p.force * 0.18 * Math.sign(p.angleDeg || 1);
      c.addEffect({ type: 'curveRibbon', x: c.ball.x, y: c.ball.y, dir, until: c.state.timeMs + p.curveMs });
    },
    pushRedirect(c) {
      if (!enterOnce(c, 'pushRedirect', 650)) return;
      const dir = rotate(toward(c.device, c.ball), p.angleDeg);
      impulse(c.ball, dir, p.force);
      c.ball.deviceImmuneUntil = c.state.timeMs + 280;
      c.addEffect({ type: 'shove', from: { x: c.device.x, y: c.device.y }, to: { x: c.ball.x + dir.x * 90, y: c.ball.y + dir.y * 90 }, until: c.state.timeMs + p.shoveMs });
    },
    spinRedirect(c) {
      if (!enterOnce(c, 'spinRedirect', 820)) return;
      const dir = rotate(goalDir(c), p.angleDeg * p.spin);
      impulse(c.ball, dir, p.force);
      c.ball.spin = clamp((c.ball.spin ?? 0) + p.spin * p.spinPower, -2.2, 2.2);
      c.addEffect({ type: 'spinDisc', x: c.ball.x, y: c.ball.y, spin: c.ball.spin, until: c.state.timeMs + 800 });
    },
    splitScatter(c) {
      if (!enterOnce(c, 'splitScatter', 999999)) return;
      const total = p.count;
      const base = goalDir(c);
      c.ball.flags.splitClone = false;
      c.ball.consumed.splitScatter = true;
      for (let i = 0; i < total; i += 1) {
        const a = (i - (total - 1) / 2) * p.spreadDeg;
        const d = rotate(base, a);
        if (i === 0) {
          setVelocity(c.ball, d, p.releaseSpeed);
          continue;
        }
        c.addBall({
          x: c.ball.x + d.x * (8 + i * 2), y: c.ball.y + d.y * (8 + i * 2), vx: d.x * p.releaseSpeed, vy: d.y * p.releaseSpeed,
          flags: { splitClone: true }, consumed: { splitScatter: true }, deviceImmuneUntil: c.state.timeMs + 520 + p.cloneDelayMs,
        });
      }
      c.addEffect({ type: 'splitBurst', x: c.ball.x, y: c.ball.y, count: total, until: c.state.timeMs + 640 });
    },
    paintTrail(c) {
      if (!enterOnce(c, 'paintTrail', p.durationMs + 600)) return;
      c.ball.paintUntil = c.state.timeMs + p.durationMs;
      c.ball.paintStartedAt = c.state.timeMs;
      c.ball.paintHue = p.hue;
      c.ball.paintRadius = p.radius;
      c.ball.paintEffectType = p.effectType;
      c.ball.paintForce = p.force;
      c.addEffect({ type: 'paintSplash', x: c.ball.x, y: c.ball.y, hue: p.hue, until: c.state.timeMs + 520 });
    },
    reflectShield(c) {
      if (!enterOnce(c, 'reflectShield', 620)) return;
      const d = toward(c.device, c.ball);
      c.ball.x = c.device.x + d.x * (Math.max(c.device.r, p.radius) + c.ball.r + 2);
      c.ball.y = c.device.y + d.y * (Math.max(c.device.r, p.radius) + c.ball.r + 2);
      impulse(c.ball, d, p.force);
      c.ball.deviceImmuneUntil = c.state.timeMs + 300;
      c.addEffect({ type: 'shield', radius: p.radius, until: c.state.timeMs + p.flashMs });
    },
  };
  return {
    onContact: contact[name] ?? (() => {}),
    tick(c, dtMs) {
      if (name === 'lowGravityField' && dist(c.ball, c.device) < p.radius) {
        const inward = toward(c.ball, c.device);
        const tangent = { x: -inward.y * p.swirlDir, y: inward.x * p.swirlDir };
        const closeness = 1 - clamp(dist(c.ball, c.device) / p.radius, 0, 1);
        c.ball.gravityScale = Math.min(c.ball.gravityScale ?? 1, p.gravityScale);
        c.ball.vx += (inward.x * p.pull + tangent.x * p.orbit) * closeness * (dtMs / 1000);
        c.ball.vy += (inward.y * p.pull + tangent.y * p.orbit - p.releaseBoost * 0.16) * closeness * (dtMs / 1000);
        c.addEffect({ type: 'gravityWell', radius: p.radius, until: c.state.timeMs + 90 });
      }
      if (name === 'aimAssist' && dist(c.ball, c.device) < p.radius && !c.ball.consumed.aimAssist) {
        impulse(c.ball, goalDir(c), 2.4);
      }
      if (c.ball.curveUntil > c.state.timeMs) {
        c.ball.gravityX = (c.ball.gravityX ?? 0) + c.ball.curveForce;
      }
    },
    draw({ state, ctx }) { drawAbilityEffects(name, p, state, ctx); },
  };
}

function drawRuntimeBase(state, ctx) {
  for (const segment of state.paintSegments) {
    const life = clamp((segment.until - state.timeMs) / 1800, 0, 1);
    ctx.save();
    ctx.fillStyle = `hsla(${segment.hue}, 92%, 58%, ${0.12 + life * 0.22})`;
    ctx.strokeStyle = `hsla(${segment.hue}, 96%, 68%, ${0.26 + life * 0.38})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(segment.x, segment.y, segment.radius * (0.9 + (1 - life) * 0.25), 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  for (const b of state.balls) {
    if (!b.alive || !b.spin) continue;
    ctx.save();
    ctx.strokeStyle = b.spin > 0 ? 'rgba(96,165,250,.85)' : 'rgba(244,114,182,.85)';
    ctx.lineWidth = 2.5;
    ctx.translate(b.x, b.y);
    ctx.rotate(state.timeMs / 120 * Math.sign(b.spin));
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, b.r + 5 + i * 3, i * 1.8, i * 1.8 + 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawAbilityEffects(name, p, state, ctx) {
  for (const e of state.activeEffects) {
    const life = e.until ? clamp((e.until - state.timeMs) / Math.max(1, e.until - e.t), 0, 1) : 1;
    ctx.save();
    if (e.type === 'portalPair') {
      ctx.strokeStyle = `rgba(244,114,182,${0.35 + life * 0.45})`;
      ctx.lineWidth = 4;
      for (const pt of [e.from, e.to]) {
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, e.size, e.size * 0.68, state.timeMs / 260, 0, TAU);
        ctx.stroke();
      }
      drawArrow(ctx, e.from, e.to, 'rgba(244,114,182,.55)');
    }
    if (e.type === 'routeRail') {
      const r = e.route;
      ctx.strokeStyle = `rgba(250,204,21,${0.28 + life * 0.5})`;
      ctx.lineWidth = 6;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      for (let i = 0; i <= 32; i += 1) {
        const t = i / 32;
        const pnt = bezier(r.start, r.c1, r.c2, r.end, t);
        if (i === 0) ctx.moveTo(pnt.x, pnt.y); else ctx.lineTo(pnt.x, pnt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      drawArrow(ctx, r.c2, r.end, 'rgba(250,204,21,.72)');
    }
    if (e.type === 'trapCharge') {
      ctx.strokeStyle = `rgba(251,191,36,${0.35 + life * 0.45})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(state.device.x, state.device.y, e.radius + Math.sin(state.timeMs / 90) * 8, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(state.device.x, state.device.y, state.device.r + 18, Math.sin(state.timeMs / 150), Math.PI + Math.sin(state.timeMs / 150));
      ctx.stroke();
    }
    if (e.type === 'aimLock' || e.type === 'precisionBeam') drawArrow(ctx, e.from, e.to, e.type === 'aimLock' ? 'rgba(253,224,71,.78)' : 'rgba(103,232,249,.85)');
    if (e.type === 'curveRibbon') {
      ctx.strokeStyle = 'rgba(192,132,252,.65)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 46 + (1 - life) * 28, 0, Math.PI * 1.4);
      ctx.stroke();
    }
    if (e.type === 'shove') drawArrow(ctx, e.from, e.to, 'rgba(248,250,252,.65)');
    if (e.type === 'spinDisc') {
      ctx.strokeStyle = e.spin > 0 ? 'rgba(96,165,250,.8)' : 'rgba(244,114,182,.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 38 + (1 - life) * 34, 0, TAU);
      ctx.stroke();
    }
    if (e.type === 'splitBurst') {
      ctx.strokeStyle = 'rgba(253,230,138,.85)';
      ctx.lineWidth = 3;
      for (let i = 0; i < e.count; i += 1) {
        const a = (i / e.count) * TAU + state.timeMs / 180;
        drawArrow(ctx, e, { x: e.x + Math.cos(a) * 68, y: e.y + Math.sin(a) * 68 }, 'rgba(253,230,138,.65)');
      }
    }
    if (e.type === 'paintSplash' || e.type === 'paintPop') {
      ctx.fillStyle = `hsla(${e.hue},95%,62%,${0.18 + life * 0.28})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 22 + (1 - life) * 35, 0, TAU);
      ctx.fill();
    }
    if (e.type === 'shield') {
      ctx.strokeStyle = `rgba(125,211,252,${0.32 + life * 0.48})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(state.device.x, state.device.y, e.radius + Math.sin(state.timeMs / 80) * 4, 0, TAU);
      ctx.stroke();
    }
    if (e.type === 'gravityWell') {
      ctx.strokeStyle = `rgba(52,211,153,${0.18 + life * 0.22})`;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse(state.device.x, state.device.y, e.radius - i * 22, (e.radius - i * 22) * 0.62, state.timeMs / 600 + i, 0, TAU);
        ctx.stroke();
      }
    }
    if (e.type === 'goalBurst') {
      ctx.strokeStyle = `rgba(232,255,89,${0.25 + life * 0.5})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 30 + (1 - life) * 70, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function stepRuntimeCollisions(state, ball) {
  const spinBend = () => {
    if (!ball.spin) return;
    const rotated = rotate({ x: ball.vx, y: ball.vy }, ball.spin * 13);
    ball.vx = rotated.x;
    ball.vy = rotated.y;
    ball.spin *= 0.52;
    if (Math.abs(ball.spin) < 0.08) ball.spin = 0;
    state.activeEffects.push({ id: nowishId(), type: 'spinDisc', x: ball.x, y: ball.y, spin: ball.spin || 1, until: state.timeMs + 360 });
  };
  if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * .82; spinBend(); }
  if (ball.x + ball.r > state.field.w) { ball.x = state.field.w - ball.r; ball.vx = -Math.abs(ball.vx) * .82; spinBend(); }
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * .82; spinBend(); }
  if (ball.y + ball.r > state.field.floor) { ball.y = state.field.floor - ball.r; ball.vy = -Math.abs(ball.vy) * .72; ball.vx *= .986; spinBend(); }
}
