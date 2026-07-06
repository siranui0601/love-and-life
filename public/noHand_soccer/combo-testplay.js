import { loadProfiles, filterProfiles } from './runtime/profileLoader.js';
import { compileComboDevice } from './runtime/comboDeviceCompiler.js';

const canvas = document.querySelector('#comboCanvas');
const ctx = canvas.getContext('2d');
const selectorsRoot = document.querySelector('#selectors');
const randomButton = document.querySelector('#randomButton');
const compileButton = document.querySelector('#compileButton');
const deviceTitle = document.querySelector('#deviceTitle');
const deviceSummary = document.querySelector('#deviceSummary');
const deviceMeta = document.querySelector('#deviceMeta');
const actionList = document.querySelector('#actionList');
const jsonPreview = document.querySelector('#jsonPreview');

const field = { w: canvas.width, h: canvas.height };
const start = { x: 120, y: 420 };
const deviceCenter = { x: 470, y: 285 };
const goal = { x: 820, y: 235, w: 78, h: 112 };
const slotLabels = ['主役', '変質', '出口'];
let profiles = [];
let filtered = [[], [], []];
let selected = [null, null, null];
let device = null;
let startedAt = performance.now();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function optionLabel(profile) {
  return `${profile.emoji} ${profile.displayNameJa ?? profile.sourceName} / ${(profile.abilities ?? []).slice(0, 3).join(', ') || 'abilitiesなし'}`;
}

function makeSelectors() {
  selectorsRoot.replaceChildren();
  for (let i = 0; i < 3; i += 1) {
    const box = document.createElement('div');
    box.className = 'selector';
    box.innerHTML = `<label><span>${slotLabels[i]}</span><b id="slotEmoji${i}">-</b></label><input id="slotSearch${i}" type="search" placeholder="検索: 猫 / warp / 🐱" autocomplete="off"><select id="slotSelect${i}" size="4"></select>`;
    selectorsRoot.appendChild(box);
    const input = box.querySelector('input');
    const select = box.querySelector('select');
    input.addEventListener('input', () => { filtered[i] = filterProfiles(profiles, input.value).slice(0, 80); renderSelect(i); });
    select.addEventListener('change', () => { selected[i] = profiles[Number(select.value)] || selected[i]; renderSlotEmoji(i); compile(); });
  }
}

function renderSlotEmoji(index) {
  const target = document.querySelector(`#slotEmoji${index}`);
  if (target) target.textContent = selected[index]?.emoji ?? '-';
}

function renderSelect(index) {
  const select = document.querySelector(`#slotSelect${index}`);
  const list = filtered[index].length ? filtered[index] : profiles.slice(0, 80);
  select.innerHTML = list.map((profile) => `<option value="${profiles.indexOf(profile)}">${escapeHtml(optionLabel(profile))}</option>`).join('');
  if (selected[index]) select.value = String(profiles.indexOf(selected[index]));
  renderSlotEmoji(index);
}

function chooseInterestingProfiles() {
  const interesting = profiles.filter((profile) => (profile.abilities ?? []).some((ability) => !['softLanding', 'slowDampen', 'aimAssist'].includes(ability)));
  const source = interesting.length >= 3 ? interesting : profiles;
  const seed = Math.floor(performance.now()) % Math.max(1, source.length);
  selected = [0, 1, 2].map((offset) => source[(seed + offset * 37) % source.length]);
  for (let i = 0; i < 3; i += 1) {
    filtered[i] = profiles.slice(0, 80);
    const input = document.querySelector(`#slotSearch${i}`);
    if (input) input.value = '';
    renderSelect(i);
  }
  compile();
}

function compile() {
  if (selected.some((profile) => !profile)) return;
  try {
    device = compileComboDevice(selected);
    startedAt = performance.now();
    renderDevice();
  } catch (error) {
    deviceTitle.textContent = '合成エラー';
    deviceSummary.textContent = String(error);
  }
}

function renderDevice() {
  deviceTitle.textContent = device.name;
  deviceSummary.textContent = device.summary;
  deviceMeta.innerHTML = `<dt>shape</dt><dd>${escapeHtml(device.visual.shape)}</dd><dt>frame</dt><dd>${escapeHtml(device.visual.frame)}</dd><dt>family</dt><dd>${escapeHtml(device.visual.mixedFamilies.join(' / '))}</dd><dt>seed</dt><dd>${device.seed}</dd>`;
  actionList.innerHTML = device.actions.map((action) => `<article class="action" style="--accent:${escapeHtml(device.visual.accent)}"><strong>${escapeHtml(action.sourceEmoji)} ${escapeHtml(action.role)}: ${escapeHtml(action.name)} → ${escapeHtml(action.action)}</strong><small>${escapeHtml(action.intent)}</small><small>params: ${escapeHtml(JSON.stringify(action.params))}</small></article>`).join('');
  jsonPreview.textContent = JSON.stringify(device, null, 2);
}

function roundedRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

function drawField() {
  ctx.fillStyle = '#11733f';
  ctx.fillRect(0, 0, field.w, field.h);
  ctx.strokeStyle = 'rgba(255,255,255,.13)';
  ctx.lineWidth = 2;
  for (let y = 36; y < field.h; y += 70) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(field.w, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(232,255,89,.38)';
  ctx.lineWidth = 5;
  roundedRect(24, 24, field.w - 48, field.h - 48, 28);
  ctx.stroke();
  ctx.save();
  ctx.translate(goal.x, goal.y);
  ctx.strokeStyle = '#e8ff59';
  ctx.fillStyle = 'rgba(232,255,89,.16)';
  ctx.lineWidth = 8;
  roundedRect(-goal.w / 2, -goal.h / 2, goal.w, goal.h, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 16px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('GOAL', 0, -goal.h / 2 - 14);
  ctx.restore();
}

function previewPath() {
  const primary = device?.actions[0]?.family;
  if (primary === 'route') return [start, deviceCenter, { x: 385, y: 155 }, { x: 575, y: 155 }, { x: 610, y: 255 }, { x: goal.x - 70, y: goal.y }];
  if (primary === 'gravity') {
    const points = [start, deviceCenter];
    for (let i = 0; i <= 24; i += 1) {
      const a = i / 24 * Math.PI * 1.75;
      const r = 130 - i * 3.2;
      points.push({ x: deviceCenter.x + Math.cos(a) * r, y: deviceCenter.y + Math.sin(a) * r * 0.66 });
    }
    points.push({ x: goal.x - 80, y: goal.y });
    return points;
  }
  if (primary === 'space') return [start, deviceCenter, { x: deviceCenter.x + 28, y: deviceCenter.y - 18 }, { x: goal.x - 160, y: goal.y - 120 }, { x: goal.x - 70, y: goal.y }];
  return [start, deviceCenter, { x: deviceCenter.x + 120, y: deviceCenter.y - 80 }, { x: goal.x - 70, y: goal.y }];
}

function drawPath(points, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
}

function samplePath(points, t) {
  const scaled = t * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const a = points[index];
  const b = points[index + 1];
  return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
}

function drawDevice(t) {
  if (!device) return;
  const { accent, secondary, background, shape } = device.visual;
  ctx.save();
  ctx.translate(deviceCenter.x, deviceCenter.y);
  ctx.fillStyle = background;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  if (['routeRibbon', 'dashCapsule', 'lightRail', 'effectLane'].includes(shape)) roundedRect(-118, -62, 236, 124, 62);
  else if (['portalGate', 'multiGate'].includes(shape)) { ctx.beginPath(); ctx.ellipse(0, 0, 102, 76, 0, 0, Math.PI * 2); }
  else if (shape === 'trapJaw') roundedRect(-96, -72, 192, 144, 30);
  else { ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); }
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  const wobble = Math.sin(t * Math.PI * 2) * 8;
  const positions = [{ x: -48, y: -16 + wobble }, { x: 0, y: 34 - wobble * .5 }, { x: 48, y: -16 + wobble * .7 }];
  selected.forEach((profile, i) => {
    ctx.fillStyle = 'rgba(0,0,0,.24)';
    ctx.beginPath();
    ctx.arc(positions[i].x, positions[i].y, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '38px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(profile.emoji, positions[i].x, positions[i].y + 1);
  });
  ctx.strokeStyle = secondary;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(0, 0, 118 + Math.sin(t * Math.PI * 2) * 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBall(now) {
  const elapsed = ((now - startedAt) % 3800) / 3800;
  const p = samplePath(previewPath(), elapsed);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = '20px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚽', p.x, p.y + 1);
  ctx.restore();
}

function draw(now) {
  drawField();
  drawPath(previewPath(), device?.visual?.accent || '#38bdf8');
  drawDevice(((now - startedAt) % 1800) / 1800);
  drawBall(now);
  requestAnimationFrame(draw);
}

randomButton.addEventListener('click', chooseInterestingProfiles);
compileButton.addEventListener('click', compile);
makeSelectors();

loadProfiles().then((loaded) => {
  profiles = loaded.profiles;
  filtered = [profiles.slice(0, 80), profiles.slice(0, 80), profiles.slice(0, 80)];
  const defaults = ['👽', '🧲', '🎨'];
  selected = defaults.map((emoji, index) => profiles.find((profile) => profile.emoji === emoji) || profiles[index]);
  for (let i = 0; i < 3; i += 1) renderSelect(i);
  compile();
  requestAnimationFrame(draw);
}).catch((error) => {
  deviceTitle.textContent = '読み込み失敗';
  deviceSummary.textContent = String(error);
});
