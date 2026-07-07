import { loadProfiles } from './runtime/profileLoader.js';
import { compileComboAbility, createComboAbilityRuntime } from './runtime/comboAbilityRuntime.js';
import { hashStringToUint32 } from './runtime/comboParamResolver.js';

const canvas = document.querySelector('#fieldCanvas');
const ctx = canvas.getContext('2d');
const selects = ['#emoji1', '#emoji2', '#emoji3'].map((s) => document.querySelector(s));
const debug = document.querySelector('#debugOverlay');
const abilityList = document.querySelector('#abilityList');
const actionList = document.querySelector('#actionList');
const comboTitle = document.querySelector('#comboTitle');
const comboSummary = document.querySelector('#comboSummary');
const launchButton = document.querySelector('#launchButton');
const retryButton = document.querySelector('#retryButton');
const launchMode = document.querySelector('#launchMode');

const field = { w: canvas.width, h: canvas.height, floor: 484, gravity: 760, deathY: 535 };
const goals = [{ x: 890, y: 230, w: 34, h: 174 }];
const device = { x: 462, y: 292, r: 62 };
const roleLabels = { core: '主役', modifier: '変質', output: '出口' };
const familyByAbility = {
  hiddenRoute: 'route', warpExit: 'space', lowGravityField: 'gravity', trapHold: 'hold', aimAssist: 'targeting', precisionPass: 'targeting',
  curveRedirect: 'targeting', pushRedirect: 'impact', spinRedirect: 'spin', splitScatter: 'split', paintTrail: 'paint', reflectShield: 'guard',
};
const intentByAbility = {
  hiddenRoute: '青い矢印レールに乗せ、特殊ルートを通って終点で放出する。',
  warpExit: '入口と出口ポータルを開き、離れた位置へワープ射出する。',
  lowGravityField: '低重力の渦で吸引し、周回しながら落下速度を変える。',
  trapHold: '一度捕獲してチャージし、狙った方向へ再射出する。',
  aimAssist: 'ゴールへ照準線を出してロックオン射出する。',
  precisionPass: '細いビームのように、狙った方向へ正確に通す。',
  curveRedirect: 'スイングバイのように速度を保って弧を描かせる。',
  pushRedirect: '装置外周で押し出し、接触方向へ強く弾く。',
  spinRedirect: '高速回転で弾き、次の壁反射を曲げるspinを付与する。',
  splitScatter: 'ボールを複数へ分裂させ、扇状に散らして突破口を増やす。',
  paintTrail: '軌跡に効果床を塗り、後続球が踏むと再加速・跳ね返りが起きる。',
  reflectShield: '反射シールドで食い込みを防ぎ、外側へ強く返す。',
};

let profiles = [];
let compiledDevice = null;
let compiledRuntime = null;
let runtime = null;
let launched = false;
let dragging = false;
let last = performance.now();
let spawnQueue = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function comboProfiles() { return selects.map((s) => profiles[Number(s.value)]).filter(Boolean).slice(0, 3); }
function comboKey() { return comboProfiles().map((p) => p.emoji).join('|'); }
function unit(name) { return hashStringToUint32(`live-lab:v2|${comboKey()}|${launchMode.value}|${name}`) / 4294967296; }
function range(name, min, max) { return min + (max - min) * unit(name); }

function pickAbility(profile, preferredFamilies, fallbackIndex = 0) {
  const abilities = (profile?.abilities ?? []).filter(Boolean);
  for (const family of preferredFamilies) {
    const found = abilities.find((ability) => familyByAbility[ability] === family);
    if (found) return found;
  }
  return abilities[fallbackIndex % Math.max(abilities.length, 1)] ?? null;
}

function compileLabDevice(selected) {
  const combo = selected.map((profile) => profile.emoji).join('|');
  const core = pickAbility(selected[0], ['route', 'space', 'hold', 'gravity', 'split', 'targeting'], 0);
  const modifier = pickAbility(selected[1], ['targeting', 'spin', 'paint', 'gravity', 'impact'], 1) ?? core;
  const output = pickAbility(selected[2], ['spin', 'space', 'split', 'guard', 'targeting', 'impact'], 2) ?? modifier ?? core;
  const actionDefs = [
    { role: 'core', ability: core, source: selected[0] },
    { role: 'modifier', ability: modifier, source: selected[1] },
    { role: 'output', ability: output, source: selected[2] },
  ].filter((entry) => entry.ability);
  const actions = actionDefs.map((entry, index) => ({
    index,
    role: entry.role,
    name: entry.ability,
    sourceAbility: entry.ability,
    sourceEmoji: entry.source.emoji,
    sourceName: entry.source.displayNameJa ?? entry.source.sourceName,
    family: familyByAbility[entry.ability] ?? 'general',
    action: `${entry.ability}Runtime`,
    intent: intentByAbility[entry.ability] ?? '装置に触れたボールへ可視の物理イベントを起こす。',
  }));
  return {
    comboKey: combo,
    recipe: selected.map((profile) => profile.emoji),
    seed: hashStringToUint32(`live-lab-device|${combo}`),
    summary: `${selected.map((p) => p.emoji).join('')} は ${actions.map((a) => `${a.role}:${a.name}`).join(' → ')} を実機テストする合成装置`,
    actions,
  };
}

function poseFor(mode, index = 0) {
  const jitter = range(`jitter:${index}`, -42, 42);
  if (mode === 'topDrop') return { x: device.x + jitter, y: 30 + index * 12, vx: range(`topVx:${index}`, -55, 55), vy: range(`topVy:${index}`, 70, 150) };
  if (mode === 'diagonalDrop') return { x: clamp(device.x - range(`diagDist:${index}`, 190, 320), 34, field.w - 34), y: 34 + index * 12, vx: range(`diagVx:${index}`, 170, 285), vy: range(`diagVy:${index}`, 85, 185) };
  if (mode === 'leftShot') return { x: 58, y: clamp(device.y + range(`leftY:${index}`, -145, 95), 45, field.floor - 45), vx: range(`leftVx:${index}`, 320, 485), vy: range(`leftVy:${index}`, -125, 70) };
  if (mode === 'wallBank') return { x: field.w - 62, y: clamp(device.y - range(`bankY:${index}`, 120, 210), 44, field.floor - 90), vx: -range(`bankVx:${index}`, 310, 470), vy: range(`bankVy:${index}`, 95, 210) };
  if (mode === 'paintFollow') return { x: device.x + jitter + index * 26, y: 28 - index * 44, vx: range(`paintVx:${index}`, -35, 60), vy: range(`paintVy:${index}`, 80, 160) };
  return { x: device.x + jitter + (index - 1) * 78, y: 28 - index * 28, vx: range(`rainVx:${index}`, -82, 82), vy: range(`rainVy:${index}`, 70, 165) };
}

function buildCompiled() {
  const selected = comboProfiles();
  if (selected.length !== 3) return;
  compiledDevice = compileLabDevice(selected);
  const actionAbilities = compiledDevice.actions.map((action) => action.name);
  const fallbackAbilities = selected.flatMap((profile) => profile.abilities ?? []);
  compiledRuntime = compileComboAbility({ comboKey: compiledDevice.comboKey, abilities: actionAbilities.length ? actionAbilities : fallbackAbilities, maxAbilities: 6 });
  runtime = createComboAbilityRuntime(compiledRuntime, { field, goals, device, ball: { ...poseFor(launchMode.value, 0), vx: 0, vy: 0 } });
}

function rebuild() {
  launched = false;
  spawnQueue = [];
  last = performance.now();
  try {
    buildCompiled();
    renderPanels();
  } catch (error) {
    comboTitle.textContent = 'compile error';
    comboSummary.textContent = String(error?.stack || error);
  }
}

function renderPanels() {
  if (!compiledDevice || !compiledRuntime) return;
  comboTitle.textContent = `${compiledDevice.recipe.join('')} 合成装置`;
  comboSummary.textContent = compiledDevice.summary;
  actionList.innerHTML = compiledDevice.actions.map((action) => `
    <article class="ability action-card ${escapeHtml(action.role)}">
      <strong>${escapeHtml(roleLabels[action.role] ?? action.role)}: ${escapeHtml(action.sourceEmoji)} ${escapeHtml(action.name)}</strong>
      <small>${escapeHtml(action.intent)}</small>
      <code>${escapeHtml(action.action)} / ${escapeHtml(action.family)}</code>
    </article>
  `).join('');
  abilityList.innerHTML = compiledRuntime.abilities.map((name) => `
    <article class="ability implemented">
      <strong>${escapeHtml(name)}</strong>
      <small>${escapeHtml(JSON.stringify(compiledRuntime.params[name]))}</small>
    </article>
  `).join('') || '<p>runtime対応abilityなし</p>';
}

function launch() {
  if (!runtime) return;
  const mode = launchMode.value;
  runtime.reset(poseFor(mode, 0));
  spawnQueue = [];
  if (mode === 'rain3') spawnQueue.push({ at: 260, pose: poseFor(mode, 1) }, { at: 520, pose: poseFor(mode, 2) });
  if (mode === 'paintFollow') spawnQueue.push({ at: 560, pose: poseFor(mode, 1) }, { at: 1040, pose: poseFor(mode, 2) });
  launched = true;
  last = performance.now();
}

function tick(now) {
  const dt = Math.min(now - last, 33);
  last = now;
  if (runtime && launched) {
    runtime.tick(dt);
    const due = spawnQueue.filter((item) => item.at <= runtime.state.timeMs);
    spawnQueue = spawnQueue.filter((item) => item.at > runtime.state.timeMs);
    for (const item of due) runtime.addBall({ ...item.pose, flags: { labQueued: true } });
  }
  draw();
  renderDebug();
  requestAnimationFrame(tick);
}

function draw() {
  drawField();
  drawPrediction();
  if (runtime) runtime.draw(ctx);
  drawDevice();
  if (runtime) drawBalls();
}

function drawField() {
  ctx.clearRect(0, 0, field.w, field.h);
  const bg = ctx.createLinearGradient(0, 0, field.w, field.h);
  bg.addColorStop(0, '#0b8b48'); bg.addColorStop(0.6, '#076533'); bg.addColorStop(1, '#04391f');
  ctx.fillStyle = '#04120c'; ctx.fillRect(0, 0, field.w, field.h);
  ctx.fillStyle = bg; roundedRect(22, 28, field.w - 44, field.floor - 42, 20, true, false);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
  for (let y = 78; y < field.floor - 20; y += 68) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(field.w - 30, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(232,255,89,.36)'; ctx.lineWidth = 4; roundedRect(50, 50, field.w - 100, field.floor - 86, 22, false, true);
  ctx.fillStyle = '#10283d'; ctx.fillRect(0, field.floor, field.w, field.h - field.floor);
  ctx.fillStyle = 'rgba(248,113,113,.2)'; ctx.fillRect(0, field.deathY - 4, field.w, 8);
  drawGoal();
}

function drawGoal() {
  const g = goals[0];
  ctx.save();
  ctx.strokeStyle = '#e8ff59'; ctx.fillStyle = 'rgba(232,255,89,.16)'; ctx.lineWidth = 8;
  roundedRect(g.x, g.y, g.w, g.h, 16, true, true);
  ctx.fillStyle = '#ffffff'; ctx.font = '900 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('GOAL', g.x + g.w / 2, g.y - 14);
  ctx.restore();
}

function drawPrediction() {
  if (!compiledRuntime || launched) return;
  const count = launchMode.value === 'rain3' || launchMode.value === 'paintFollow' ? 3 : 1;
  for (let i = 0; i < count; i += 1) {
    const p = poseFor(launchMode.value, i);
    const alpha = i === 0 ? 1 : 0.58;
    ctx.save();
    ctx.strokeStyle = `rgba(232,255,89,${0.72 * alpha})`; ctx.fillStyle = `rgba(232,255,89,${0.16 * alpha})`; ctx.lineWidth = 4; ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo((p.x + device.x) / 2, p.y + 120 + i * 26, device.x, device.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚽', p.x, p.y + 1);
    ctx.restore();
  }
}

function drawDevice() {
  const selected = comboProfiles();
  const t = performance.now() / 1000;
  ctx.save(); ctx.translate(device.x, device.y);
  ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 24; ctx.fillStyle = 'rgba(56,189,248,.20)'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(0, 0, device.r * 1.55, device.r * 1.08, Math.sin(t * 1.4) * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(232,255,89,.65)'; ctx.lineWidth = 3; ctx.setLineDash([9, 8]); ctx.beginPath(); ctx.arc(0, 0, device.r * 1.85 + Math.sin(t * 5) * 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  const points = [{ x: -48, y: -10 }, { x: 0, y: 26 }, { x: 48, y: -10 }];
  selected.forEach((profile, index) => {
    const p = points[index]; ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.beginPath(); ctx.arc(p.x, p.y, 27, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = '31px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(profile.emoji, p.x, p.y + 1);
  });
  ctx.restore();
}

function drawBalls() {
  for (const b of runtime.state.balls) {
    ctx.save();
    ctx.strokeStyle = b.paintHue == null ? '#67e8f9' : `hsl(${b.paintHue} 90% 62%)`; ctx.lineWidth = 3; ctx.beginPath();
    b.trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    if (!b.alive) { ctx.restore(); continue; }
    ctx.fillStyle = b.flags.splitClone || b.flags.labQueued ? '#fde68a' : '#f8fafc'; ctx.strokeStyle = b.flags.splitClone ? '#f59e0b' : '#111827'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111827'; ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚽', b.x, b.y + 1);
    ctx.restore();
  }
}

function renderDebug() {
  if (!compiledRuntime || !runtime) return;
  debug.textContent = JSON.stringify({
    comboKey: compiledRuntime.comboKey,
    launchMode: launchMode.value,
    compilerActions: compiledDevice.actions.map((a) => `${a.role}:${a.name}`),
    runtimeAbilities: compiledRuntime.abilities,
    seed: compiledDevice.seed,
    balls: runtime.state.balls.length,
    alive: runtime.state.balls.filter((b) => b.alive).length,
    goals: runtime.state.goalsScored,
    dead: runtime.state.deadBalls,
    paintSegments: runtime.state.paintSegments.length,
    effects: runtime.state.activeEffects.map((e) => e.type),
  }, null, 2);
}

function options() {
  return profiles.map((p, i) => `<option value="${i}">${escapeHtml(p.emoji)} ${escapeHtml(p.displayNameJa ?? p.sourceName)} / ${escapeHtml((p.abilities ?? []).slice(0, 3).join(', '))}</option>`).join('');
}
function roundedRect(x, y, w, h, r, fill = false, stroke = false) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr); ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h); ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr); ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y); if (fill) ctx.fill(); if (stroke) ctx.stroke();
}

canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); moveDevice(e); rebuild(); });
canvas.addEventListener('pointermove', (e) => { if (!dragging) return; moveDevice(e); if (!launched) rebuild(); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
function moveDevice(e) {
  const r = canvas.getBoundingClientRect();
  device.x = clamp((e.clientX - r.left) * canvas.width / r.width, 120, field.w - 190);
  device.y = clamp((e.clientY - r.top) * canvas.height / r.height, 115, field.floor - 100);
}

launchButton.addEventListener('click', launch);
retryButton.addEventListener('click', rebuild);
launchMode.addEventListener('change', rebuild);
selects.forEach((s) => s.addEventListener('change', rebuild));

loadProfiles().then((loaded) => {
  profiles = loaded.profiles;
  if (!profiles.length) throw new Error('no profiles loaded from emoji_physics_profiles.json');
  const defaults = ['🍀', '🤡', '🥸'];
  selects.forEach((s, index) => {
    s.innerHTML = options();
    const found = profiles.findIndex((profile) => profile.emoji === defaults[index]);
    s.value = String(found >= 0 ? found : index);
  });
  rebuild();
  requestAnimationFrame(tick);
}).catch((error) => { debug.textContent = String(error?.stack || error); });
