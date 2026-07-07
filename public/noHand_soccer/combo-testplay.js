import { loadProfiles } from './runtime/profileLoader.js';
import { compileComboAbility, createComboAbilityRuntime, stepRuntimeCollisions } from './runtime/comboAbilityRuntime.js';
import { hashStringToUint32 } from './runtime/comboParamResolver.js';

const canvas = document.querySelector('#fieldCanvas');
const ctx = canvas.getContext('2d');
const selects = ['#emoji1', '#emoji2', '#emoji3'].map((s) => document.querySelector(s));
const debug = document.querySelector('#debugOverlay');
const abilityList = document.querySelector('#abilityList');
const comboTitle = document.querySelector('#comboTitle');
const launchButton = document.querySelector('#launchButton');
const retryButton = document.querySelector('#retryButton');
const launchMode = document.querySelector('#launchMode');

const field = { w: canvas.width, h: canvas.height, floor: 484, gravity: 760, deathY: 535 };
const goals = [{ x: 890, y: 242, w: 28, h: 168 }];
const device = { x: 455, y: 292, r: 58 };
let profiles = [];
let runtime;
let compiled;
let launched = false;
let dragging = false;
let last = performance.now();

function comboProfiles() { return selects.map((s) => profiles[Number(s.value)]).filter(Boolean); }
function comboKey() { return comboProfiles().map((p) => p.emoji).join('|'); }
function unit(name) { return hashStringToUint32(`${compiled?.comboKey ?? comboKey()}|${launchMode.value}|${name}`) / 4294967296; }
function range(name, min, max) { return min + (max - min) * unit(name); }

function ballPoseFor(mode, index = 0) {
  const jitter = range(`jitter${index}`, -34, 34);
  if (mode === 'topDrop') {
    return { x: device.x + jitter, y: 28 + index * 10, vx: range(`topVx${index}`, -45, 45), vy: range(`topVy${index}`, 40, 105) };
  }
  if (mode === 'diagonalDrop') {
    return { x: clamp(device.x - range(`diagDist${index}`, 170, 290), 28, field.w - 28), y: 36 + index * 14, vx: range(`diagVx${index}`, 155, 260), vy: range(`diagVy${index}`, 70, 155) };
  }
  if (mode === 'leftShot') {
    return { x: 52, y: clamp(device.y + range(`leftY${index}`, -140, 90), 38, field.floor - 38), vx: range(`leftVx${index}`, 310, 450), vy: range(`leftVy${index}`, -120, 70) };
  }
  return { x: device.x + jitter + (index - 1) * 76, y: 28 - index * 18, vx: range(`rainVx${index}`, -80, 80), vy: range(`rainVy${index}`, 55, 145) };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function buildCompiled() {
  const abilities = comboProfiles().flatMap((p) => p.abilities ?? []);
  return compileComboAbility({ comboKey: comboKey(), abilities });
}

function rebuild() {
  compiled = buildCompiled();
  const pose = ballPoseFor(launchMode.value, 0);
  runtime = createComboAbilityRuntime(compiled, { field, goals, device, ball: { ...pose, vx: 0, vy: 0 } });
  launched = false;
  last = performance.now();
  comboTitle.textContent = `${comboKey()} / ${launchMode.options[launchMode.selectedIndex]?.textContent ?? launchMode.value}`;
  abilityList.innerHTML = compiled.abilities.map((a) => `<div class="ability implemented"><strong>${a}</strong><small>${JSON.stringify(compiled.params[a])}</small></div>`).join('') || '<p>supported combo abilitiesなし</p>';
}

function launch() {
  if (!runtime) return;
  const mode = launchMode.value;
  const primary = ballPoseFor(mode, 0);
  runtime.reset(primary);
  if (mode === 'rain3') {
    runtime.addBall({ ...ballPoseFor(mode, 1), flags: { rainDrop: true } });
    runtime.addBall({ ...ballPoseFor(mode, 2), flags: { rainDrop: true } });
  }
  launched = true;
  last = performance.now();
}

function drawField() {
  ctx.clearRect(0, 0, field.w, field.h);
  ctx.fillStyle = '#071b12';
  ctx.fillRect(0, 0, field.w, field.h);
  const gradient = ctx.createLinearGradient(0, 0, field.w, field.h);
  gradient.addColorStop(0, '#0e7f45');
  gradient.addColorStop(1, '#07522f');
  ctx.fillStyle = gradient;
  ctx.fillRect(22, 28, field.w - 44, field.floor - 40);
  ctx.strokeStyle = 'rgba(232,255,89,.38)';
  ctx.lineWidth = 4;
  roundRect(48, 48, field.w - 96, field.floor - 78, 22);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 2;
  for (let y = 84; y < field.floor - 20; y += 72) { ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(field.w - 28, y); ctx.stroke(); }
  ctx.fillStyle = '#11233a';
  ctx.fillRect(0, field.floor, field.w, field.h - field.floor);
  ctx.fillStyle = 'rgba(248,113,113,.18)';
  ctx.fillRect(0, field.deathY - 4, field.w, 8);
  drawGoal();
  drawLauncherPreview();
}

function drawGoal() {
  const g = goals[0];
  ctx.save();
  ctx.strokeStyle = '#e8ff59';
  ctx.fillStyle = 'rgba(232,255,89,.14)';
  ctx.lineWidth = 8;
  roundRect(g.x, g.y, g.w, g.h, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 16px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('GOAL', g.x + g.w / 2, g.y - 14);
  ctx.restore();
}

function drawLauncherPreview() {
  if (launched || !compiled) return;
  const mode = launchMode.value;
  const count = mode === 'rain3' ? 3 : 1;
  for (let i = 0; i < count; i += 1) {
    const p = ballPoseFor(mode, i);
    ctx.save();
    ctx.strokeStyle = i === 0 ? 'rgba(232,255,89,.86)' : 'rgba(103,232,249,.66)';
    ctx.fillStyle = i === 0 ? 'rgba(232,255,89,.22)' : 'rgba(103,232,249,.16)';
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.vx * 0.42, p.y + p.vy * 0.42 + 160);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '20px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('⚽', p.x, p.y + 1);
    ctx.restore();
  }
}

function drawDevice() {
  const t = performance.now() / 1000;
  const pulse = 1 + Math.sin(t * 5) * 0.045;
  ctx.save();
  ctx.translate(device.x, device.y);
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 22;
  ctx.fillStyle = 'rgba(56,189,248,.22)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, device.r * 1.45 * pulse, device.r * 1.02 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(232,255,89,.58)';
  ctx.setLineDash([9, 7]);
  ctx.beginPath();
  ctx.arc(0, 0, device.r * 1.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,0,0,.26)';
  ctx.beginPath();
  ctx.roundRect(-58, -30, 116, 60, 28);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '30px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(comboProfiles().map((p) => p.emoji).join(''), 0, 3);
  ctx.restore();
}

function drawBalls() {
  for (const b of runtime.state.balls) {
    ctx.strokeStyle = b.paintHue == null ? '#67e8f9' : `hsl(${b.paintHue} 90% 60%)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    b.trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    if (!b.alive) continue;
    ctx.fillStyle = b.flags.splitClone ? '#fde68a' : '#f8fafc';
    ctx.strokeStyle = b.flags.splitClone ? '#f59e0b' : '#111827';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = '20px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚽', b.x, b.y + 1);
  }
}

function draw() {
  drawField();
  if (runtime) runtime.draw(ctx);
  drawDevice();
  if (runtime) drawBalls();
}

function tick(now) {
  const dt = Math.min(now - last, 33);
  last = now;
  if (runtime) {
    if (launched) runtime.tick(dt);
    else stepRuntimeCollisions(runtime.state, runtime.state.balls[0]);
    draw();
    debug.textContent = JSON.stringify({
      comboKey: compiled.comboKey,
      launchMode: launchMode.value,
      version: compiled.version,
      abilities: compiled.abilities,
      params: compiled.params,
      balls: runtime.state.balls.length,
      alive: runtime.state.balls.filter((b) => b.alive).length,
      goals: runtime.state.goalsScored,
      dead: runtime.state.deadBalls,
      paintSegments: runtime.state.paintSegments.length,
      effects: runtime.state.activeEffects.map((e) => e.type),
    }, null, 2);
  }
  requestAnimationFrame(tick);
}

function options() { return profiles.map((p, i) => `<option value="${i}">${p.emoji} ${p.displayNameJa ?? p.sourceName} / ${(p.abilities ?? []).slice(0, 3).join(', ')}</option>`).join(''); }
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); moveDevice(e); rebuild(); });
canvas.addEventListener('pointermove', (e) => { if (dragging) { moveDevice(e); rebuild(); } });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
function moveDevice(e) {
  const r = canvas.getBoundingClientRect();
  device.x = clamp((e.clientX - r.left) * canvas.width / r.width, 90, field.w - 160);
  device.y = clamp((e.clientY - r.top) * canvas.height / r.height, 100, field.floor - 90);
}

launchButton.addEventListener('click', launch);
retryButton.addEventListener('click', rebuild);
launchMode.addEventListener('change', rebuild);
selects.forEach((s) => s.addEventListener('change', rebuild));

loadProfiles().then((loaded) => {
  profiles = loaded.profiles;
  const defaults = ['🍀', '🤡', '🥸'];
  selects.forEach((s, i) => {
    s.innerHTML = options();
    const found = profiles.findIndex((p) => p.emoji === defaults[i]);
    s.value = String(found >= 0 ? found : i);
  });
  rebuild();
  requestAnimationFrame(tick);
}).catch((e) => { debug.textContent = String(e.stack || e); });
