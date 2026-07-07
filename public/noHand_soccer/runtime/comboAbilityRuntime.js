import { COMBO_RUNTIME_VERSION, resolveComboParams } from './comboParamResolver.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const len = (v) => Math.hypot(v.x, v.y) || 0.0001;
const norm = (v) => { const l = len(v); return { x: v.x / l, y: v.y / l }; };
const rotate = (v, deg) => { const a = deg * Math.PI / 180; return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) }; };
const toward = (from, to) => norm({ x: to.x - from.x, y: to.y - from.y });

export const comboAbilityParamSpec = {
  warpExit: { offsetX: { min: 120, max: 280 }, offsetY: { min: -150, max: 70 }, releaseSpeed: { min: 240, max: 520 } },
  hiddenRoute: { offsetY: { min: -90, max: 70 }, force: { min: 180, max: 360 }, durationMs: { type: 'int', min: 700, max: 1400 } },
  lowGravityField: { gravityScale: { min: 0.15, max: 0.45 }, angleDeg: { min: -35, max: 35 }, radius: { min: 115, max: 190 }, durationMs: { type: 'int', min: 1000, max: 2200 } },
  trapHold: { durationMs: { type: 'int', min: 420, max: 950 }, releaseSpeed: { min: 180, max: 420 }, angleDeg: { min: -45, max: -10 } },
  aimAssist: { force: { min: 90, max: 190 }, radius: { min: 140, max: 260 } },
  precisionPass: { angleDeg: { min: -18, max: 10 }, releaseSpeed: { min: 360, max: 620 } },
  curveRedirect: { angleDeg: { min: -42, max: 42 }, force: { min: 180, max: 360 } },
  pushRedirect: { angleDeg: { min: -28, max: 28 }, force: { min: 220, max: 430 } },
  spinRedirect: { angleDeg: { min: 35, max: 95 }, force: { min: 140, max: 300 }, spin: { type: 'choice', choices: [-1, 1] } },
  splitScatter: { count: { type: 'int', min: 2, max: 4 }, angleDeg: { min: 18, max: 42 }, releaseSpeed: { min: 220, max: 420 } },
  paintTrail: { durationMs: { type: 'int', min: 1200, max: 2600 }, hue: { type: 'int', min: 0, max: 359 } },
  reflectShield: { radius: { min: 62, max: 95 }, force: { min: 260, max: 520 } },
};

export function compileComboAbility({ comboKey, abilities = [], version = COMBO_RUNTIME_VERSION }) {
  const unique = [...new Set(abilities)].filter((name) => comboAbilityParamSpec[name]);
  return { comboKey, version, abilities: unique, ...resolveComboParams(comboKey, Object.fromEntries(unique.map((a) => [a, comboAbilityParamSpec[a]])), { version }) };
}

export function createComboAbilityRuntime(compiled, options = {}) {
  const state = {
    field: options.field ?? { w: 960, h: 540, floor: 484, gravity: 760, deathY: 535 },
    goals: options.goals ?? [{ x: 890, y: 242, w: 28, h: 168 }],
    device: options.device ?? { x: 455, y: 292, r: 58 },
    balls: [], activeEffects: [], goalsScored: 0, deadBalls: 0, timeMs: 0,
    compiled,
  };
  const handlers = Object.fromEntries(compiled.abilities.map((name) => [name, makeHandler(name, compiled.params[name] ?? {})]));
  function ctx(ball) { return { state, ball, device: state.device, field: state.field, goals: state.goals, params: compiled.params, addEffect: (e) => state.activeEffects.push({ ...e, t: state.timeMs }) }; }
  function addBall(ball) { state.balls.push({ id: state.balls.length + 1, r: 15, alive: true, trail: [], flags: {}, ...ball }); }
  function reset(ball = {}) { state.balls = []; state.activeEffects = []; state.goalsScored = 0; state.deadBalls = 0; state.timeMs = 0; addBall({ x: 190, y: 90, vx: 260, vy: 0, ...ball }); }
  function contact(ball) { for (const h of Object.values(handlers)) h.onContact?.(ctx(ball)); }
  function tick(dtMs) {
    state.timeMs += dtMs; const dt = Math.min(dtMs / 1000, 0.033);
    for (const ball of [...state.balls]) {
      if (!ball.alive) continue;
      for (const h of Object.values(handlers)) h.tick?.(ctx(ball), dtMs);
      if (!(ball.flags.heldUntil > state.timeMs)) { ball.vy += state.field.gravity * (ball.gravityScale ?? 1) * dt; ball.vx += (ball.gravityX ?? 0) * dt; }
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; stepRuntimeCollisions(state, ball); ball.trail.push({ x: ball.x, y: ball.y, t: state.timeMs }); if (ball.trail.length > 180) ball.trail.shift();
      if (Math.hypot(ball.x - state.device.x, ball.y - state.device.y) <= ball.r + state.device.r) contact(ball);
      for (const g of state.goals) if (ball.x + ball.r >= g.x && ball.y >= g.y && ball.y <= g.y + g.h) { ball.alive = false; state.goalsScored += 1; }
      if (ball.y - ball.r > state.field.deathY) { ball.alive = false; state.deadBalls += 1; }
      ball.gravityScale = 1; ball.gravityX = 0;
    }
    state.activeEffects = state.activeEffects.filter((e) => !e.until || e.until > state.timeMs);
  }
  function draw(canvasCtx) { for (const h of Object.values(handlers)) h.draw?.({ state, ctx: canvasCtx }); }
  reset(options.ball);
  return { state, reset, addBall, tick, draw, handlers };
}

function makeHandler(name, p) {
  const once = (ball, key) => { if (ball.flags[key]) return false; ball.flags[key] = true; return true; };
  const goalDir = (c) => toward(c.ball, { x: c.goals[0].x, y: c.goals[0].y + c.goals[0].h / 2 });
  const setVelocity = (b, dir, speed) => { const d = norm(dir); b.vx = d.x * speed; b.vy = d.y * speed; };
  const impulse = (b, dir, force) => { const d = norm(dir); b.vx += d.x * force; b.vy += d.y * force; };
  const contact = {
    warpExit(c) { if (!once(c.ball, 'warpExit')) return; c.ball.x = clamp(c.device.x + p.offsetX, c.ball.r, c.field.w - c.ball.r); c.ball.y = clamp(c.device.y + p.offsetY, c.ball.r, c.field.floor - c.ball.r); setVelocity(c.ball, { x: p.offsetX, y: p.offsetY }, p.releaseSpeed); c.addEffect({ type: 'warp', x: c.ball.x, y: c.ball.y, until: c.state.timeMs + 650 }); },
    trapHold(c) { c.ball.x = c.device.x; c.ball.y = c.device.y; c.ball.vx = 0; c.ball.vy = 0; c.ball.flags.heldUntil = c.state.timeMs + p.durationMs; c.ball.flags.trapRelease = { speed: p.releaseSpeed, angleDeg: p.angleDeg }; c.addEffect({ type: 'hold', until: c.ball.flags.heldUntil }); },
    precisionPass(c) { setVelocity(c.ball, rotate(goalDir(c), p.angleDeg), p.releaseSpeed); },
    curveRedirect(c) { impulse(c.ball, rotate(goalDir(c), p.angleDeg), p.force); },
    pushRedirect(c) { impulse(c.ball, rotate(toward(c.device, c.ball), p.angleDeg), p.force); },
    spinRedirect(c) { impulse(c.ball, rotate(goalDir(c), p.angleDeg * p.spin), p.force); c.ball.spin = (c.ball.spin ?? 0) + p.spin; },
    splitScatter(c) { if (!once(c.ball, 'splitScatter')) return; const base = goalDir(c); for (let i = 1; i < p.count; i += 1) { const a = (i - (p.count - 1) / 2) * p.angleDeg; const d = rotate(base, a); c.state.balls.push({ ...c.ball, id: c.state.balls.length + 1, vx: d.x * p.releaseSpeed, vy: d.y * p.releaseSpeed, flags: { splitClone: true }, trail: [] }); } },
    reflectShield(c) { const d = toward(c.device, c.ball); c.ball.x = c.device.x + d.x * (c.device.r + c.ball.r + 2); c.ball.y = c.device.y + d.y * (c.device.r + c.ball.r + 2); impulse(c.ball, d, p.force); c.addEffect({ type: 'shield', radius: p.radius, until: c.state.timeMs + 500 }); },
    hiddenRoute(c) { c.ball.y += (c.device.y + p.offsetY - c.ball.y) * 0.45; impulse(c.ball, goalDir(c), p.force); c.addEffect({ type: 'route', y: c.device.y + p.offsetY, until: c.state.timeMs + p.durationMs }); },
  };
  return {
    onContact: contact[name] ?? (() => {}),
    tick(c) {
      if (name === 'lowGravityField' && Math.hypot(c.ball.x - c.device.x, c.ball.y - c.device.y) < p.radius) { c.ball.gravityScale = p.gravityScale; c.ball.gravityX = Math.sin(p.angleDeg * Math.PI / 180) * 260; c.addEffect({ type: 'gravity', radius: p.radius, until: c.state.timeMs + 80 }); }
      if (name === 'aimAssist' && Math.hypot(c.ball.x - c.device.x, c.ball.y - c.device.y) < p.radius) impulse(c.ball, goalDir(c), p.force / 60);
      if (name === 'paintTrail') c.ball.paintHue = p.hue;
      if (c.ball.flags.trapRelease && c.ball.flags.heldUntil <= c.state.timeMs) { setVelocity(c.ball, rotate(goalDir(c), c.ball.flags.trapRelease.angleDeg), c.ball.flags.trapRelease.speed); delete c.ball.flags.trapRelease; }
    },
    draw({ state, ctx }) {
      if (name === 'paintTrail') for (const b of state.balls) { ctx.strokeStyle = `hsla(${p.hue},90%,60%,.55)`; ctx.beginPath(); b.trail.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)); ctx.stroke(); }
      for (const e of state.activeEffects) {
        if (e.type === 'shield') { ctx.strokeStyle = 'rgba(125,211,252,.75)'; ctx.beginPath(); ctx.arc(state.device.x, state.device.y, e.radius, 0, Math.PI * 2); ctx.stroke(); }
        if (e.type === 'warp') { ctx.strokeStyle = '#f472b6'; ctx.strokeRect(e.x - 18, e.y - 18, 36, 36); }
        if (e.type === 'route') { ctx.strokeStyle = 'rgba(250,204,21,.55)'; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(state.device.x, e.y); ctx.lineTo(state.goals[0].x, state.goals[0].y + state.goals[0].h / 2); ctx.stroke(); ctx.setLineDash([]); }
        if (e.type === 'gravity') { ctx.strokeStyle = 'rgba(52,211,153,.42)'; ctx.beginPath(); ctx.arc(state.device.x, state.device.y, e.radius, 0, Math.PI * 2); ctx.stroke(); }
        if (e.type === 'hold') { ctx.strokeStyle = 'rgba(251,191,36,.78)'; ctx.beginPath(); ctx.arc(state.device.x, state.device.y, state.device.r + 12, 0, Math.PI * 2); ctx.stroke(); }
      }
    },
  };
}

export function stepRuntimeCollisions(state, ball) {
  if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * .78; }
  if (ball.x + ball.r > state.field.w) { ball.x = state.field.w - ball.r; ball.vx = -Math.abs(ball.vx) * .78; }
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * .78; }
  if (ball.y + ball.r > state.field.floor) { ball.y = state.field.floor - ball.r; ball.vy = -Math.abs(ball.vy) * .68; ball.vx *= .985; }
}
