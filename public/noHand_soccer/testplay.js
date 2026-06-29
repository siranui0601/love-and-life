import { createAbilityEngine, createSeededRandom } from './runtime/abilityEngine.js';
import { abilityRegistry } from './runtime/abilityRegistry.js';
import { loadProfiles, filterProfiles } from './runtime/profileLoader.js';
import { renderDebug } from './runtime/debugOverlay.js';

const canvas = document.querySelector('#fieldCanvas');
const ctx = canvas.getContext('2d');
const search = document.querySelector('#emojiSearch');
const select = document.querySelector('#emojiSelect');
const modeSelect = document.querySelector('#contactMode');
const launchButton = document.querySelector('#launchButton');
const retryButton = document.querySelector('#retryButton');
const debugTarget = document.querySelector('#debugOverlay');
const profileTitle = document.querySelector('#profileTitle');
const profileNote = document.querySelector('#profileNote');
const profileMeta = document.querySelector('#profileMeta');
const abilityList = document.querySelector('#abilityList');

const field = { w: canvas.width, h: canvas.height, floor: 484 };
const goal = { x: 890, y: 260, w: 24, h: 150 };
const gimmick = { x: 455, y: 292, r: 58, contactPadding: 12 };
const routeDirection = { x: 1, y: -0.18 };
const hiddenRoute = { y: 250 };
const contactCooldownMs = 180;
const modeConfigs = {
  drop: { label: '落下接触', x: gimmick.x, y: gimmick.y - 180, vx: 0, vy: 0, drag: 'free' },
  side: { label: '横から接触', x: gimmick.x - 235, y: gimmick.y - 8, vx: 390, vy: -8, drag: 'free' },
  bounce: { label: '下からバウンド接触', x: gimmick.x, y: field.floor - 18, vx: 0, vy: -520, drag: 'x' },
  fast: { label: '高速衝突', x: gimmick.x - 285, y: gimmick.y - 26, vx: 720, vy: -20, drag: 'free' },
  still: { label: '静止接触', x: gimmick.x, y: gimmick.y - gimmick.r - 15, vx: 0, vy: 0, drag: 'free' }
};
let contactMode = 'drop';
let profiles = [];
let selected = null;
let seed = 20260629;
let random = createSeededRandom(seed);
let engine = createAbilityEngine(abilityRegistry, { maxSpeed: 880 });
let last = performance.now();
let dragging = false;
let lastEffect = '';
let lastTriggeredAbilities = [];
let trail = [];
let ball;
let contactActive = false;
let lastContactTime = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetBall() {
  seed += 1;
  random = createSeededRandom(seed);
  engine.reset();
  lastEffect = '';
  lastTriggeredAbilities = [];
  contactActive = false;
  lastContactTime = 0;
  const config = modeConfigs[contactMode];
  ball = {
    x: config.x,
    y: config.y,
    vx: 0,
    vy: 0,
    r: 15,
    gravity: { x: 0, y: 720 },
    gravityScale: 1,
    lastWarpOffset: null,
    lastWarpTarget: null,
    lastWarpFrom: null,
    holdUntil: 0,
    launched: false
  };
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
    bounds: { minX: ball.r, maxX: field.w - ball.r, minY: ball.r, maxY: field.floor - ball.r },
    onWarning: (warning) => { lastEffect = warning; }
  };
}

function runAbilities(trigger, now) {
  const triggered = [];
  for (const name of selected?.abilities ?? []) {
    const spec = abilityRegistry[name];
    if (!spec || spec.trigger.includes(trigger) || trigger === 'contact') {
      const result = engine.trigger(name, ball, abilityContext(now));
      triggered.push(name);
      if (result) lastEffect = `${name}: ${result.effect}`;
    }
  }
  if (triggered.length) lastTriggeredAbilities = triggered;
}

function launch() {
  if (ball.launched) return;
  const config = modeConfigs[contactMode];
  ball.vx = config.vx;
  ball.vy = config.vy;
  ball.launched = true;
  runAbilities('launch', performance.now());
}

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  ball.gravity.x = 0;
  ball.gravity.y = 720;
  ball.gravityScale = 1;
  if (ball.launched) {
    runAbilities('field', now);
    if (ball.y > field.floor - 55 && ball.vy > 120) runAbilities('floor', now);
    if (now > ball.holdUntil) {
      ball.vx += ball.gravity.x * ball.gravityScale * dt;
      ball.vy += ball.gravity.y * ball.gravityScale * dt;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    collide(now);
    engine.tick(ball, abilityContext(now));
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 180) trail.shift();
  }
  draw();
  renderDebug(debugTarget, {
    mode: `drop test / ${modeConfigs[contactMode].label}`,
    launched: ball.launched,
    ballX: ball.x,
    ballY: ball.y,
    gimmickContact: contactActive,
    lastContactTime,
    lastTriggeredAbilities,
    speed: Math.hypot(ball.vx, ball.vy),
    vx: ball.vx,
    vy: ball.vy,
    activeAbilities: engine.getActive(),
    lastEffect,
    warnings: engine.warnings,
    gravityScale: ball.gravityScale,
    gravityX: ball.gravity.x,
    gravityY: ball.gravity.y,
    lastWarpOffset: ball.lastWarpOffset,
    lastWarpTarget: ball.lastWarpTarget,
    seed
  });
  requestAnimationFrame(tick);
}

function collide(now) {
  if (ball.y + ball.r > field.floor) { ball.y = field.floor - ball.r; ball.vy = -Math.abs(ball.vy) * .58; ball.vx *= .985; runAbilities('wall', now); }
  if (ball.x - ball.r < 0 || ball.x + ball.r > field.w) { ball.x = clamp(ball.x, ball.r, field.w - ball.r); ball.vx *= -0.72; runAbilities('wall', now); }
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -0.72; runAbilities('wall', now); }

  const contactDistance = ball.r + gimmick.r + gimmick.contactPadding;
  const distance = Math.hypot(ball.x - gimmick.x, ball.y - gimmick.y);
  contactActive = distance < contactDistance;
  if (contactActive && now - lastContactTime > contactCooldownMs) {
    lastContactTime = now;
    runAbilities('contact', now);
  }
}

function drawGuide() {
  const contactDistance = ball.r + gimmick.r + gimmick.contactPadding;
  ctx.save();
  ctx.strokeStyle = 'rgba(251,191,36,.82)';
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 8]);
  ctx.beginPath();
  if (contactMode === 'drop' || contactMode === 'bounce' || contactMode === 'still') {
    ctx.moveTo(ball.x, Math.max(ball.r, ball.y - 50));
    ctx.lineTo(ball.x, field.floor);
  } else {
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(gimmick.x, gimmick.y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(251,191,36,.36)';
  ctx.beginPath();
  ctx.arc(gimmick.x, gimmick.y, contactDistance, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, field.w, field.h);
  ctx.fillStyle = '#0e1b31'; ctx.fillRect(0, 0, field.w, field.h);
  ctx.fillStyle = '#19314c'; ctx.fillRect(0, field.floor, field.w, field.h - field.floor);
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
  ctx.fillStyle = 'rgba(103,232,249,.10)'; ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
  ctx.strokeStyle = 'rgba(250,204,21,.36)'; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.moveTo(340, hiddenRoute.y); ctx.quadraticCurveTo(560, hiddenRoute.y - 80, goal.x, goal.y + goal.h / 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(168,85,247,.22)'; ctx.beginPath(); ctx.arc(gimmick.x, gimmick.y, gimmick.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = contactActive ? '#fbbf24' : '#a855f7'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(selected?.emoji ?? '⚽', gimmick.x, gimmick.y + 12);
  ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 3; ctx.beginPath(); trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  drawWarpVisuals();
  drawGravityVector();
  if (!ball.launched) drawGuide();
  ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#111827'; ctx.font = '20px sans-serif'; ctx.fillText('⚽', ball.x, ball.y + 7);
}

function drawWarpVisuals() {
  if (!ball.lastWarpTarget) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(244,114,182,.92)';
  ctx.fillStyle = 'rgba(244,114,182,.18)';
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 7]);
  if (ball.lastWarpFrom) {
    ctx.beginPath();
    ctx.moveTo(ball.lastWarpFrom.x, ball.lastWarpFrom.y);
    ctx.lineTo(ball.lastWarpTarget.x, ball.lastWarpTarget.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(ball.lastWarpTarget.x, ball.lastWarpTarget.y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  const o = ball.lastWarpOffset;
  ctx.fillStyle = '#fbcfe8';
  ctx.fillText(`warpExit(${o.x >= 0 ? '+' : ''}${o.x},${o.y >= 0 ? '+' : ''}${o.y})`, ball.lastWarpTarget.x, ball.lastWarpTarget.y - 32);
  ctx.restore();
}

function drawGravityVector() {
  if (!ball.launched || (Math.abs(ball.gravity.x) < 1 && Math.abs(ball.gravity.y - 720) < 1)) return;
  const scale = 0.18;
  const start = { x: 90, y: 110 };
  const end = { x: start.x + ball.gravity.x * scale, y: start.y + ball.gravity.y * scale };
  ctx.save();
  ctx.strokeStyle = '#34d399';
  ctx.fillStyle = '#34d399';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - Math.cos(angle - .5) * 13, end.y - Math.sin(angle - .5) * 13);
  ctx.lineTo(end.x - Math.cos(angle + .5) * 13, end.y - Math.sin(angle + .5) * 13);
  ctx.closePath();
  ctx.fill();
  ctx.font = '13px sans-serif';
  ctx.fillText(`gravity (${ball.gravity.x.toFixed(0)}, ${ball.gravity.y.toFixed(0)})`, start.x, start.y - 12);
  ctx.restore();
}

function renderProfileList(list) {
  select.innerHTML = list.map((p) => `<option value="${profiles.indexOf(p)}">${p.emoji} ${p.displayNameJa ?? p.sourceName} (${(p.abilities ?? []).join(', ') || 'no abilities'})</option>`).join('');
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

function moveHeldBall(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * canvas.width / r.width;
  const y = (e.clientY - r.top) * canvas.height / r.height;
  const config = modeConfigs[contactMode];
  ball.x = clamp(x, ball.r, field.w - ball.r);
  if (config.drag === 'free') ball.y = clamp(y, ball.r, field.floor - ball.r);
  trail = [{ x: ball.x, y: ball.y }];
}

canvas.addEventListener('pointerdown', (e) => { if (ball.launched) return; dragging = true; canvas.setPointerCapture(e.pointerId); moveHeldBall(e); });
canvas.addEventListener('pointermove', (e) => { if (!dragging || ball.launched) return; moveHeldBall(e); });
canvas.addEventListener('pointerup', () => { dragging = false; });
launchButton.addEventListener('click', launch);
retryButton.addEventListener('click', resetBall);
modeSelect.addEventListener('change', () => { contactMode = modeSelect.value; resetBall(); });
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
