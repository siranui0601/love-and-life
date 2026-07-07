import { loadProfiles } from './runtime/profileLoader.js';
import { compileComboAbility, createComboAbilityRuntime, stepRuntimeCollisions } from './runtime/comboAbilityRuntime.js';

const canvas = document.querySelector('#fieldCanvas');
const ctx = canvas.getContext('2d');
const selects = ['#emoji1', '#emoji2', '#emoji3'].map((s) => document.querySelector(s));
const debug = document.querySelector('#debugOverlay');
const abilityList = document.querySelector('#abilityList');
const comboTitle = document.querySelector('#comboTitle');
const launchButton = document.querySelector('#launchButton');
const retryButton = document.querySelector('#retryButton');
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
function rebuild() {
  const abilities = comboProfiles().flatMap((p) => p.abilities ?? []);
  compiled = compileComboAbility({ comboKey: comboKey(), abilities });
  runtime = createComboAbilityRuntime(compiled, { field, goals, device, ball: { x: 180, y: 80, vx: 0, vy: 0 } });
  launched = false;
  comboTitle.textContent = comboKey();
  abilityList.innerHTML = compiled.abilities.map((a) => `<div class="ability implemented"><strong>${a}</strong><small>${JSON.stringify(compiled.params[a])}</small></div>`).join('') || '<p>supported combo abilitiesなし</p>';
}
function launch() { const b = runtime.state.balls[0]; b.vx = 285; b.vy = -20; launched = true; }
function draw() {
  ctx.clearRect(0, 0, field.w, field.h); ctx.fillStyle = '#0e1b31'; ctx.fillRect(0, 0, field.w, field.h); ctx.fillStyle = '#19314c'; ctx.fillRect(0, field.floor, field.w, field.h - field.floor);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.strokeRect(goals[0].x, goals[0].y, goals[0].w, goals[0].h); ctx.fillStyle = 'rgba(103,232,249,.10)'; ctx.fillRect(goals[0].x, goals[0].y, goals[0].w, goals[0].h);
  ctx.fillStyle = 'rgba(168,85,247,.22)'; ctx.beginPath(); ctx.arc(device.x, device.y, device.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#a855f7'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(comboProfiles().map((p) => p.emoji).join(''), device.x, device.y + 10);
  runtime.draw(ctx);
  for (const b of runtime.state.balls) {
    ctx.strokeStyle = b.paintHue == null ? '#67e8f9' : `hsl(${b.paintHue} 90% 60%)`; ctx.beginPath(); b.trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    if (!b.alive) continue; ctx.fillStyle = b.flags.splitClone ? '#fde68a' : '#f8fafc'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#111827'; ctx.font = '20px sans-serif'; ctx.fillText('⚽', b.x, b.y + 7);
  }
}
function tick(now) {
  const dt = Math.min(now - last, 33); last = now; if (launched) runtime.tick(dt); else stepRuntimeCollisions(runtime.state, runtime.state.balls[0]); draw();
  debug.textContent = JSON.stringify({ comboKey: compiled.comboKey, version: compiled.version, params: compiled.params, balls: runtime.state.balls.length, goals: runtime.state.goalsScored, dead: runtime.state.deadBalls }, null, 2);
  requestAnimationFrame(tick);
}
function options() { return profiles.map((p, i) => `<option value="${i}">${p.emoji} ${p.displayNameJa ?? p.sourceName}</option>`).join(''); }
canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); moveDevice(e); });
canvas.addEventListener('pointermove', (e) => { if (dragging) moveDevice(e); });
canvas.addEventListener('pointerup', () => { dragging = false; });
function moveDevice(e) { const r = canvas.getBoundingClientRect(); device.x = (e.clientX - r.left) * canvas.width / r.width; device.y = (e.clientY - r.top) * canvas.height / r.height; }
launchButton.addEventListener('click', launch); retryButton.addEventListener('click', rebuild); selects.forEach((s) => s.addEventListener('change', rebuild));
loadProfiles().then((loaded) => { profiles = loaded.profiles; selects.forEach((s, i) => { s.innerHTML = options(); s.value = i; }); rebuild(); requestAnimationFrame(tick); }).catch((e) => { debug.textContent = String(e.stack || e); });
