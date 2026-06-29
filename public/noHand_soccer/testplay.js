import { createAbilityEngine, createSeededRandom } from './runtime/abilityEngine.js';
import { abilityRegistry } from './runtime/abilityRegistry.js';
import { loadProfiles, filterProfiles } from './runtime/profileLoader.js';
import { renderDebug } from './runtime/debugOverlay.js';

const canvas = document.querySelector('#fieldCanvas');
const ctx = canvas.getContext('2d');
const search = document.querySelector('#emojiSearch');
const select = document.querySelector('#emojiSelect');
const launchButton = document.querySelector('#launchButton');
const retryButton = document.querySelector('#retryButton');
const debugTarget = document.querySelector('#debugOverlay');
const profileTitle = document.querySelector('#profileTitle');
const profileNote = document.querySelector('#profileNote');
const profileMeta = document.querySelector('#profileMeta');
const abilityList = document.querySelector('#abilityList');

const field = { w: canvas.width, h: canvas.height, floor: 484 };
const goal = { x: 890, y: 260, w: 24, h: 150 };
const gimmick = { x: 455, y: 292, r: 50 };
const routeDirection = { x: 1, y: -0.18 };
const hiddenRoute = { y: 250 };
let profiles = [];
let selected = null;
let seed = 20260629;
let random = createSeededRandom(seed);
let engine = createAbilityEngine(abilityRegistry, { maxSpeed: 880 });
let last = performance.now();
let dragTarget = { x: 315, y: 300 };
let dragging = false;
let lastEffect = '';
let trail = [];
let ball;

function resetBall() {
  seed += 1;
  random = createSeededRandom(seed);
  engine.reset();
  lastEffect = '';
  ball = { x: 100, y: field.floor - 18, vx: 0, vy: 0, r: 15, gravityScale: 1, holdUntil: 0, launched: false };
  trail = [{ x: ball.x, y: ball.y }];
}

function abilityContext(now) {
  return {
    now,
    random,
    goalCenter: { x: goal.x, y: goal.y + goal.h / 2 },
    gimmickCenter: { x: gimmick.x, y: gimmick.y },
    routeDirection,
    hiddenRoute,
    onWarning: (warning) => { lastEffect = warning; }
  };
}

function runAbilities(trigger, now) {
  for (const name of selected?.abilities ?? []) {
    const spec = abilityRegistry[name];
    if (!spec || spec.trigger.includes(trigger) || trigger === 'contact') {
      const result = engine.trigger(name, ball, abilityContext(now));
      if (result) lastEffect = `${name}: ${result.effect}`;
    }
  }
}

function launch() {
  const dx = dragTarget.x - ball.x;
  const dy = dragTarget.y - ball.y;
  const l = Math.hypot(dx, dy) || 1;
  ball.vx = (dx / l) * 520;
  ball.vy = (dy / l) * 520;
  ball.launched = true;
  runAbilities('launch', performance.now());
}

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  ball.gravityScale = 1;
  if (ball.launched) runAbilities('field', now);
  if (ball.y > field.floor - 55 && ball.vy > 120) runAbilities('floor', now);
  if (now > ball.holdUntil) ball.vy += 720 * ball.gravityScale * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  collide(now);
  engine.tick(ball, abilityContext(now));
  trail.push({ x: ball.x, y: ball.y });
  if (trail.length > 180) trail.shift();
  draw();
  renderDebug(debugTarget, { speed: Math.hypot(ball.vx, ball.vy), vx: ball.vx, vy: ball.vy, activeAbilities: engine.getActive(), lastEffect, warnings: engine.warnings, gravityScale: ball.gravityScale, seed });
  requestAnimationFrame(tick);
}

function collide(now) {
  if (ball.y + ball.r > field.floor) { ball.y = field.floor - ball.r; ball.vy = -Math.abs(ball.vy) * .58; ball.vx *= .985; runAbilities('wall', now); }
  if (ball.x - ball.r < 0 || ball.x + ball.r > field.w) { ball.x = Math.max(ball.r, Math.min(field.w - ball.r, ball.x)); ball.vx *= -0.72; runAbilities('wall', now); }
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -0.72; runAbilities('wall', now); }
  if (Math.hypot(ball.x - gimmick.x, ball.y - gimmick.y) < ball.r + gimmick.r) runAbilities('contact', now);
}

function draw() {
  ctx.clearRect(0, 0, field.w, field.h);
  ctx.fillStyle = '#0e1b31'; ctx.fillRect(0, 0, field.w, field.h);
  ctx.fillStyle = '#19314c'; ctx.fillRect(0, field.floor, field.w, field.h - field.floor);
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
  ctx.fillStyle = 'rgba(103,232,249,.10)'; ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
  ctx.strokeStyle = 'rgba(250,204,21,.36)'; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.moveTo(340, hiddenRoute.y); ctx.quadraticCurveTo(560, hiddenRoute.y - 80, goal.x, goal.y + goal.h / 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(168,85,247,.22)'; ctx.beginPath(); ctx.arc(gimmick.x, gimmick.y, gimmick.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#a855f7'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(selected?.emoji ?? '⚽', gimmick.x, gimmick.y + 12);
  ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 3; ctx.beginPath(); trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  if (!ball.launched) { ctx.strokeStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(dragTarget.x, dragTarget.y); ctx.stroke(); }
  ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#111827'; ctx.font = '20px sans-serif'; ctx.fillText('⚽', ball.x, ball.y + 7);
}

function renderProfileList(list) {
  select.innerHTML = list.map((p, i) => `<option value="${profiles.indexOf(p)}">${p.emoji} ${p.displayNameJa ?? p.sourceName} (${(p.abilities ?? []).join(', ') || 'no abilities'})</option>`).join('');
  if (!selected && list[0]) select.value = profiles.indexOf(list[0]);
}

function renderSelected() {
  profileTitle.textContent = `${selected.emoji} ${selected.displayNameJa ?? selected.sourceName}`;
  profileNote.textContent = selected.note ?? '';
  profileMeta.innerHTML = ['receive', 'path', 'release', 'motion', 'effects', 'confidence'].map((k) => `<dt>${k}</dt><dd>${Array.isArray(selected[k]) ? selected[k].join(', ') : (selected[k] ?? '-')}</dd>`).join('');
  abilityList.innerHTML = (selected.abilities ?? []).map((name) => {
    const spec = abilityRegistry[name];
    return `<div class="ability ${spec ? 'implemented' : 'missing'}"><strong>${name}${spec ? '' : ' ⚠未実装'}</strong><small>${spec ? `${spec.description} / trigger:${spec.trigger} / strength:${spec.strength}` : 'warning表示のみ。クラッシュせずスキップします。'}</small></div>`;
  }).join('') || '<p>abilitiesなし</p>';
}

canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const r = canvas.getBoundingClientRect(); dragTarget = { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; });
canvas.addEventListener('pointerup', () => { dragging = false; });
launchButton.addEventListener('click', launch);
retryButton.addEventListener('click', resetBall);
search.addEventListener('input', () => renderProfileList(filterProfiles(profiles, search.value)));
select.addEventListener('change', () => { selected = profiles[Number(select.value)]; resetBall(); renderSelected(); });

loadProfiles().then((loaded) => {
  profiles = loaded.profiles;
  selected = profiles.find((p) => (p.abilities ?? []).some((a) => abilityRegistry[a])) ?? profiles[0];
  renderProfileList(profiles);
  select.value = profiles.indexOf(selected);
  resetBall();
  renderSelected();
  requestAnimationFrame(tick);
}).catch((error) => { debugTarget.textContent = String(error); });
