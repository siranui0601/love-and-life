const FIELD = { w: 900, h: 1400, topGoalY: 86, bottomGoalY: 1314, ballR: 18, playerR: 26, keeperR: 30 };
const COST_LIMIT = 30;
const SIM_SPEEDS = [0.5, 1, 2];
const SPEED_LABELS = ['等速', '2x', '4x'];
const goalLeft = FIELD.w * 0.35;
const goalRight = FIELD.w * 0.65;
const topGoal = { x: FIELD.w / 2, y: FIELD.topGoalY * 0.45 };
const ownGoal = { x: FIELD.w / 2, y: FIELD.bottomGoalY + 54 };

const GIMMICKS = [
  { id: 'rocket', icon: '🚀🦵', name: 'ロケットキック', cost: 6, allowed: ['ally', 'keeper'], label: '味方/GK', desc: '味方が強烈に蹴る。', recipe: ['🚀', '🦵'] },
  { id: 'iceBall', icon: '🧊⚽', name: '低摩擦ボール', cost: 4, allowed: ['ball'], label: 'ボール', desc: '減速を抑える。', recipe: ['🧊', '⚽'] },
  { id: 'spring', icon: '🟩🦘', name: 'バネ床', cost: 5, allowed: ['field'], label: 'コート', desc: '踏むと跳ね返す。', recipe: ['🟩', '🦘'] },
  { id: 'magnet', icon: '🥅🧲', name: '吸引ゴール', cost: 7, allowed: ['goal'], label: '相手ゴール', desc: 'ネットへ吸う。', recipe: ['🥅', '🧲'] },
  { id: 'convert', icon: '🇯🇵🏃', name: '寝返り日の丸', cost: 8, allowed: ['enemy'], label: '敵選手', desc: '敵を味方扱い。', recipe: ['🇯🇵', '🏃'] },
  { id: 'blade', icon: '🗡️', name: 'ピッチ刀', cost: 5, allowed: ['ally'], label: '味方選手', desc: '近い敵をダウン。', recipe: ['🗡️'] },
  { id: 'lane', icon: '🧊🛣️', name: '氷の通路', cost: 5, allowed: ['field'], label: 'コート', desc: '減速を抑える道。', recipe: ['🧊', '🛣️'] },
];

const ZONE = { spring: { w: 216, h: 88 }, lane: { w: 304, h: 164 } };
const PRESET = [
  { gid: 'rocket', target: { type: 'player', key: 'ally:field:10' } },
  { gid: 'iceBall', target: { type: 'ball' } },
  { gid: 'spring', target: { type: 'field', x: 450, y: 790 } },
  { gid: 'blade', target: { type: 'player', key: 'ally:field:10' } },
];

const FALLBACK_EMOJIS = [
  { emoji: '🦵', jaName: '脚', shopCategory: '身体・人物', price: 18 },
  { emoji: '🚀', jaName: 'ロケット', shopCategory: '場所・乗り物', price: 28 },
  { emoji: '💨', jaName: '突風', shopCategory: '自然・天気', price: 16 },
  { emoji: '🥅', jaName: 'ゴール', shopCategory: 'スポーツ', price: 22 },
  { emoji: '🏃', jaName: '走る人', shopCategory: '身体・人物', price: 20 },
  { emoji: '🇯🇵', jaName: '日本国旗', shopCategory: '旗', price: 24 },
  { emoji: '🧊', jaName: '氷', shopCategory: '自然・天気', price: 15 },
  { emoji: '🧲', jaName: '磁石', shopCategory: '道具', price: 26 },
  { emoji: '🗡️', jaName: '短剣', shopCategory: '道具', price: 22 },
  { emoji: '🦘', jaName: 'カンガルー', shopCategory: '動物', price: 14 },
  { emoji: '⚽', jaName: 'サッカーボール', shopCategory: 'スポーツ', price: 20 },
  { emoji: '🛣️', jaName: '道路', shopCategory: '場所・乗り物', price: 12 },
  { emoji: '🔥', jaName: '炎', shopCategory: '自然・天気', price: 24 },
  { emoji: '🛡️', jaName: '盾', shopCategory: '道具', price: 24 },
  { emoji: '🌀', jaName: '渦', shopCategory: '記号', price: 18 },
];

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const canvas = $('#fieldCanvas');
const ctx = canvas.getContext('2d');
const fieldFrame = $('#fieldFrame');

const els = {
  state: $('#matchState'), timer: $('#timer'), debug: $('#debugText'), result: $('#resultOverlay'), logs: $('#logList'),
  list: $('#gimmickList'), installed: $('#installedList'), installedCount: $('#installedCount'), cost: $('#costUsed'), limit: $('#costLimit'), costBadge: $('#costBadge'), speedBadge: $('#speedBadge'),
  kick: $('#kickBtn'), pause: $('#pauseBtn'), retry: $('#retryBtn'), speed: $('#speedBtn'), preset: $('#presetBtn'), clear: $('#clearGimmicksBtn'),
  angle: $('#angleInput'), power: $('#powerInput'), angleVal: $('#angleValue'), powerVal: $('#powerValue'), hitbox: $('#hitboxBtn'), goal: $('#forceGoalBtn'), own: $('#forceOwnGoalBtn'), step: $('#stepBtn'),
  points: $('#pointsValue'), shopCategoryTabs: $('#shopCategoryTabs'), shopGrid: $('#emojiShopGrid'), cartList: $('#cartList'), cartTotal: $('#cartTotal'),
  buyCart: $('#buyCartBtn'), clearCart: $('#clearCartBtn'), ownedList: $('#ownedEmojiList'), recipes: $('#generatedRecipeList'),
};

let ball, players, placements, nextId, logs, running, ended, hitbox, speedIndex, elapsed, acc, lastTs, currentDrop, cooldown;
let selectedGimmick = null;
let editingPlacement = null;
let deletePreview = false;
let placePointerId = null;

let points = 120;
let emojiCatalog = [];
let shopCategory = 'すべて';
let cart = [];
const owned = new Map();

function initState() {
  ball = { x: 450, y: 700, vx: 0, vy: 0, r: FIELD.ballR, a: 0, spin: 0 };
  players = [
    makePlayer(450, 1246, 'ally', 'keeper', 1), makePlayer(260, 920, 'ally', 'field', 7), makePlayer(450, 820, 'ally', 'field', 10), makePlayer(640, 920, 'ally', 'field', 11),
    makePlayer(450, 154, 'enemy', 'keeper', 1), makePlayer(260, 480, 'enemy', 'field', 4), makePlayer(450, 620, 'enemy', 'field', 9), makePlayer(640, 480, 'enemy', 'field', 6),
  ];
  for (const p of players) if (p.role === 'keeper') { p.minX = goalLeft + 24; p.maxX = goalRight - 24; }
  cooldown = new Map();
  running = false; ended = false; elapsed = 0; acc = 0; logs = [];
  currentDrop = null; deletePreview = false; editingPlacement = null;
  els.result.classList.add('hidden'); els.result.replaceChildren(); els.state.textContent = '準備中'; els.pause.textContent = '一時停止';
  applyStatusEffects();
  log('中央キックオフ。敵は高速で詰めて自陣ゴールを狙います。');
  render();
}

function makePlayer(x, y, team, role, no) { return { x, y, vx: 0, vy: 0, team, role, no, homeX: x, homeY: y, r: role === 'keeper' ? FIELD.keeperR : FIELD.playerR, down: 0, convert: 0 }; }
function key(p) { return `${p.team}:${p.role}:${p.no}`; }
function findPlayer(k) { return players.find((p) => key(p) === k); }
function effective(p) { return p.team === 'enemy' && elapsed < p.convert ? 'ally' : p.team; }
function gimmick(id) { return GIMMICKS.find((g) => g.id === id); }
function activeGimmick() { return editingPlacement ? gimmick(editingPlacement.gid) : selectedGimmick; }
function cost() { return placements.reduce((n, p) => n + gimmick(p.gid).cost, 0); }
function has(id, fn = () => true) { return placements.some((p) => p.gid === id && fn(p)); }
function byGimmick(id) { return placements.filter((p) => p.gid === id); }
function d(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function mag(v) { return Math.hypot(v.vx, v.vy); }
function can(k, sec) { const last = cooldown.get(k) ?? -Infinity; if (elapsed - last < sec) return false; cooldown.set(k, elapsed); return true; }
function isMultiIcon(icon) { return Array.from(icon).length > 2; }
function speedText() { return SPEED_LABELS[speedIndex] ?? '等速'; }

function log(text) { logs.unshift(`${elapsed.toFixed(2)}s　${text}`); logs = logs.slice(0, 30); renderLogs(); }
function renderLogs() { els.logs.replaceChildren(...logs.map((t) => { const r = document.createElement('div'); r.className = 'log-line'; r.textContent = t; return r; })); }

function openTab(name) {
  $$('.tab-button').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
  $$('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
}

function applyStatusEffects() {
  for (const p of players) p.convert = 0;
  for (const pl of byGimmick('convert')) {
    const p = findPlayer(pl.target.key);
    if (p) p.convert = 12;
  }
}

function updateHud() {
  const c = cost();
  els.limit.textContent = COST_LIMIT;
  els.cost.textContent = c;
  els.costBadge.textContent = `COST ${c}/${COST_LIMIT}`;
  els.speedBadge.textContent = speedText();
  els.timer.textContent = `${elapsed.toFixed(2)}s`;
  els.kick.disabled = c > COST_LIMIT || (running && !ended);
  els.speed.textContent = speedText();
  $('.cost-meter')?.classList.toggle('over', c > COST_LIMIT);
  els.angleVal.textContent = `${els.angle.value}°`;
  els.powerVal.textContent = (Number(els.power.value) / 1000).toFixed(3);
}

function renderGimmicks() {
  els.list.replaceChildren();
  const c = cost();
  const active = activeGimmick();
  for (const g of GIMMICKS) {
    const b = document.createElement('button');
    const locked = c + g.cost > COST_LIMIT && active?.id !== g.id;
    const activeCard = active?.id === g.id;
    const iconClass = `gimmick-icon ${isMultiIcon(g.icon) ? 'multi-icon' : ''}`;
    b.type = 'button';
    b.className = `gimmick-item ${locked ? 'is-locked' : ''} ${activeCard ? 'is-active' : ''}`;
    b.setAttribute('aria-label', `${g.name}。${g.label}へ配置。タップして選択。`);
    b.innerHTML = `<span class="${iconClass}">${g.icon}</span><span class="gimmick-main"><strong>${g.name}</strong><small>${g.label}｜${g.desc}</small></span><span class="gimmick-cost-pill">${g.cost}</span>`;
    b.addEventListener('click', () => selectGimmick(g));
    els.list.appendChild(b);
  }
}

function renderInstalled() {
  els.installedCount.textContent = placements.length;
  els.installed.replaceChildren();
  if (!placements.length) {
    const e = document.createElement('div');
    e.className = 'installed-empty';
    e.textContent = 'まだ何も配置されていません。';
    els.installed.appendChild(e);
    return;
  }
  for (const pl of placements) {
    const g = gimmick(pl.gid);
    const r = document.createElement('div');
    r.className = 'installed-item';
    const extra = pl.target.type === 'field' ? ' / コート上の枠をタップで再配置' : '';
    r.innerHTML = `<span><strong>${g.icon} ${g.name}</strong><small>${describe(pl.target)} / cost ${g.cost}${extra}</small></span><button type="button">撤去</button>`;
    r.querySelector('button').addEventListener('click', () => removePlacement(pl.id));
    els.installed.appendChild(r);
  }
}

function render() {
  updateHud();
  renderGimmicks();
  renderInstalled();
  renderLogs();
  draw();
  updateDebug();
}

function describe(t) {
  if (t.type === 'ball') return 'ボール';
  if (t.type === 'goal') return '相手ゴール';
  if (t.type === 'field') return `コート(${Math.round(t.x)}, ${Math.round(t.y)})`;
  const p = findPlayer(t.key);
  return p ? `${p.team === 'enemy' ? '敵' : '味方'}${p.role === 'keeper' ? 'GK' : `${p.no}番`}` : '選手';
}

function addPlacement(gid, target, silent = false) {
  const g = gimmick(gid);
  if (cost() + g.cost > COST_LIMIT) {
    if (!silent) log(`${g.name}はコスト超過で配置できない。`);
    return false;
  }
  placements.push({ id: nextId++, gid, target });
  if (!silent) log(`${g.name}を${describe(target)}へ装着。`);
  applyStatusEffects();
  render();
  return true;
}

function removePlacement(id) {
  const pl = placements.find((p) => p.id === id);
  if (!pl) return;
  placements = placements.filter((p) => p.id !== id);
  log(`${gimmick(pl.gid).name}を撤去。`);
  applyStatusEffects();
  render();
}

function clearPlacements(silent = false) {
  placements = [];
  nextId = 1;
  selectedGimmick = null;
  editingPlacement = null;
  currentDrop = null;
  deletePreview = false;
  if (!silent) log('固定ギミックを全撤去。');
  applyStatusEffects();
  render();
}

function preset() {
  placements = [];
  nextId = 1;
  selectedGimmick = null;
  editingPlacement = null;
  currentDrop = null;
  deletePreview = false;
  for (const p of PRESET) addPlacement(p.gid, p.target, true);
  log('おすすめ配置を適用。味方10番中心に反撃ラインを作成。');
  render();
  openTab('play');
}

function selectGimmick(g) {
  if (running && !ended) return log('試合中は装着できません。リトライ後に配置してください。');
  if (cost() + g.cost > COST_LIMIT) return log(`${g.name}はコスト超過で選択できない。`);
  editingPlacement = null; deletePreview = false;
  if (selectedGimmick?.id === g.id) {
    selectedGimmick = null;
    currentDrop = null;
    log(`${g.name}の選択を解除。`);
    render();
    return;
  }
  selectedGimmick = g;
  currentDrop = null;
  log(`${g.icon} ${g.name}を選択。コート上の光る場所をタップ、コート設置系は押したままなぞって位置調整できます。`);
  render();
  openTab('play');
  fieldFrame.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function fieldPoint(cx, cy) {
  const r = canvas.getBoundingClientRect();
  if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
  return { x: (cx - r.left) / r.width * FIELD.w, y: (cy - r.top) / r.height * FIELD.h };
}
function kind(p) { if (p.role === 'keeper') return 'keeper'; return p.team === 'enemy' ? 'enemy' : 'ally'; }

function dropTarget(p, g) {
  if (g.allowed.includes('field')) {
    const s = ZONE[g.id] ?? { w: 180, h: 110 };
    return {
      ok: true,
      kind: 'field',
      target: {
        type: 'field',
        x: clamp(p.x, s.w / 2, FIELD.w - s.w / 2),
        y: clamp(p.y, s.h / 2, FIELD.h - s.h / 2),
      },
    };
  }
  if (g.allowed.includes('goal') && p.x >= goalLeft && p.x <= goalRight && p.y <= FIELD.topGoalY + 95) return { ok: true, kind: 'goal', target: { type: 'goal' } };
  if (g.allowed.includes('ball') && d(p, ball) <= ball.r + 50) return { ok: true, kind: 'ball', target: { type: 'ball' } };
  const near = players.map((pl) => ({ pl, dd: d(p, pl) })).sort((a, b) => a.dd - b.dd)[0];
  if (near && near.dd <= near.pl.r + 58) {
    const k = kind(near.pl);
    return g.allowed.includes(k) ? { ok: true, kind: k, target: { type: 'player', key: key(near.pl) } } : { ok: false, kind: k };
  }
  return { ok: false };
}

function findFieldPlacementAt(point) {
  const fieldPlacements = placements.filter((p) => p.target.type === 'field').slice().reverse();
  return fieldPlacements.find((pl) => {
    const size = ZONE[pl.gid] ?? { w: 180, h: 110 };
    const z = { x: pl.target.x - size.w / 2, y: pl.target.y - size.h / 2, w: size.w, h: size.h };
    return inside(point, z);
  }) ?? null;
}

function updatePlacementPreviewFromEvent(e) {
  const g = activeGimmick();
  if (!g) return null;
  const p = fieldPoint(e.clientX, e.clientY);
  if (!p) {
    currentDrop = null;
    deletePreview = !!editingPlacement;
    draw();
    return null;
  }
  deletePreview = false;
  currentDrop = dropTarget(p, g);
  draw();
  return currentDrop;
}

function handleFieldPointerDown(e) {
  if (running && !ended) return;
  const point = fieldPoint(e.clientX, e.clientY);
  if (!selectedGimmick && !editingPlacement && point) {
    const hit = findFieldPlacementAt(point);
    if (hit) {
      e.preventDefault();
      editingPlacement = hit;
      currentDrop = dropTarget(point, gimmick(hit.gid));
      deletePreview = false;
      placePointerId = e.pointerId;
      canvas.setPointerCapture?.(e.pointerId);
      log(`${gimmick(hit.gid).name}を再配置中。動かして離すと移動、コート外で離すと撤去。`);
      render();
      return;
    }
  }
  if (!selectedGimmick || editingPlacement) return;
  e.preventDefault();
  placePointerId = e.pointerId;
  canvas.setPointerCapture?.(e.pointerId);
  updatePlacementPreviewFromEvent(e);
}

function handleFieldPointerMove(e) {
  if (placePointerId !== e.pointerId || !activeGimmick()) return;
  e.preventDefault();
  updatePlacementPreviewFromEvent(e);
}

function handleFieldPointerUp(e) {
  if (placePointerId !== e.pointerId || !activeGimmick()) return;
  e.preventDefault();
  canvas.releasePointerCapture?.(e.pointerId);
  const point = fieldPoint(e.clientX, e.clientY);
  const g = activeGimmick();

  if (editingPlacement) {
    if (!point) {
      const removedName = gimmick(editingPlacement.gid).name;
      placements = placements.filter((p) => p.id !== editingPlacement.id);
      log(`${removedName}をコート外へ出して撤去。`);
      editingPlacement = null;
      currentDrop = null;
      deletePreview = false;
      placePointerId = null;
      applyStatusEffects();
      render();
      return;
    }
    const target = dropTarget(point, g);
    if (target?.ok && target.target.type === 'field') {
      editingPlacement.target = target.target;
      log(`${g.name}を${describe(target.target)}へ再配置。`);
    } else {
      log(`${g.name}はそこには再配置できない。`);
    }
    editingPlacement = null;
    currentDrop = null;
    deletePreview = false;
    placePointerId = null;
    applyStatusEffects();
    render();
    return;
  }

  const target = point ? dropTarget(point, g) : null;
  if (target?.ok) {
    addPlacement(g.id, target.target);
    selectedGimmick = null;
    currentDrop = null;
    deletePreview = false;
    render();
  } else {
    log(`${g.name}はそこには装着できない。光っている場所に置いてください。`);
    currentDrop = null;
    deletePreview = false;
    draw();
  }
  placePointerId = null;
}

function kick() {
  if (running && !ended) return;
  if (ended) initState();
  if (cost() > COST_LIMIT) return log('コスト超過中はキックできない。');
  selectedGimmick = null; editingPlacement = null; currentDrop = null; deletePreview = false;
  const angle = (-90 + Number(els.angle.value)) * Math.PI / 180;
  const v = 6 + Number(els.power.value) * 0.23;
  Object.assign(ball, { x: 450, y: 700, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, spin: Number(els.angle.value) * 0.006 });
  running = true; ended = false; els.state.textContent = '試合中'; updateHud();
  log(`中央キックオフ：角度 ${els.angle.value}° / 威力 ${(Number(els.power.value) / 1000).toFixed(3)}`);
  openTab('play');
  fieldFrame.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function step(dt) { if (ended) return; elapsed += dt; effects(); movePlayers(dt); moveBall(dt); collisions(); outcome(); }
function moveBall(dt) {
  const low = has('iceBall', (p) => p.target.type === 'ball');
  const iced = zones('lane').some((z) => inside(ball, z));
  const drag = iced ? 0.992 : low ? 0.988 : 0.978;
  ball.vx *= drag ** (dt * 60); ball.vy *= drag ** (dt * 60);
  ball.x += ball.vx * dt * 60; ball.y += ball.vy * dt * 60;
  ball.a += ball.spin * dt * 60; ball.spin *= 0.992 ** (dt * 60);
  if (ball.x - ball.r < 18) { ball.x = 18 + ball.r; ball.vx = Math.abs(ball.vx) * 0.82; }
  if (ball.x + ball.r > FIELD.w - 18) { ball.x = FIELD.w - 18 - ball.r; ball.vx = -Math.abs(ball.vx) * 0.82; }
}
function movePlayers(dt) {
  for (const p of players) {
    if (elapsed < p.down) { p.vx *= 0.82; p.vy *= 0.82; p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; continue; }
    const enemy = effective(p) === 'enemy';
    const keep = p.role === 'keeper';
    const max = enemy ? keep ? 6.3 : 11.8 : keep ? 3.9 : 3.6;
    const accel = enemy ? keep ? 0.48 : 0.72 : keep ? 0.21 : 0.18;
    let tx = enemy ? ball.x + ball.vx * 14 : ball.x;
    let ty = enemy ? ball.y + ball.vy * 14 : ball.y;
    if (keep) { tx = clamp(ball.x, p.minX, p.maxX); ty = p.homeY; }
    const dx = tx - p.x, dy = ty - p.y, dd = Math.max(Math.hypot(dx, dy), 1);
    p.vx += dx / dd * accel * dt * 60; p.vy += dy / dd * accel * dt * 60;
    const s = Math.hypot(p.vx, p.vy);
    if (s > max) { p.vx = p.vx / s * max; p.vy = p.vy / s * max; }
    p.x = clamp(p.x + p.vx * dt * 60, 24 + p.r, FIELD.w - 24 - p.r);
    p.y = clamp(p.y + p.vy * dt * 60, FIELD.topGoalY + 8 + p.r, FIELD.bottomGoalY - 8 - p.r);
  }
}
function effects() {
  if (has('magnet', (p) => p.target.type === 'goal')) {
    const dx = topGoal.x - ball.x, dy = topGoal.y - ball.y, dd = Math.hypot(dx, dy);
    if (dd < 360 && dd > 1) {
      ball.vx += dx / dd * 0.12 * (1 - dd / 360);
      ball.vy += dy / dd * 0.12 * (1 - dd / 360);
      if (can('maglog', 1.4)) log('吸引ゴール：ネット中央へ引き寄せ中。');
    }
  }
  for (const z of zones('spring')) if (inside(ball, z) && can(`spring:${z.id}`, 0.9)) { aim(topGoal, Math.max(mag(ball), 9.8) + 4.3); log('バネ床発動：相手ゴール方向へ跳ね上げた。'); }
  for (const z of zones('lane')) if (inside(ball, z) && can(`ice:${z.id}`, 1.8)) log('氷の通路：通過中の減速を軽減。');
  for (const pl of byGimmick('blade')) {
    const owner = findPlayer(pl.target.key);
    if (!owner || elapsed < owner.down) continue;
    let target = null, best = 9999;
    for (const p of players) {
      if (effective(p) === 'ally' || elapsed < p.down) continue;
      const dd = d(owner, p);
      if (dd < best) { best = dd; target = p; }
    }
    if (target && best < 155 && can(`blade:${pl.id}`, 1.4)) {
      target.down = elapsed + 2.3;
      target.vx += (target.x - owner.x) / Math.max(best, 1) * 8;
      target.vy += (target.y - owner.y) / Math.max(best, 1) * 8;
      log(`ピッチ刀：敵${target.no}番を短時間ダウン。`);
    }
  }
}
function collisions() {
  for (const p of players) {
    if (elapsed < p.down) continue;
    const dd = d(ball, p), min = ball.r + p.r;
    if (dd < min && dd > 0.001) {
      const nx = (ball.x - p.x) / dd, ny = (ball.y - p.y) / dd, ov = min - dd;
      ball.x += nx * ov * 0.62; ball.y += ny * ov * 0.62;
      touch(p);
    }
  }
}
function touch(p) {
  if (!can(`touch:${key(p)}`, 0.58)) return;
  const e = effective(p);
  log(`ボールが${e === 'ally' ? '味方側' : '敵側'}の選手に接触。`);
  if (e === 'enemy') {
    aim(ownGoal, p.role === 'keeper' ? 13 : 19.5);
    ball.spin += 0.28;
    log(`敵${p.role === 'keeper' ? 'GK' : `${p.no}番`}が自陣ゴールへ強烈に蹴り込んだ。`);
    return;
  }
  const rocket = has('rocket', (pl) => pl.target.type === 'player' && pl.target.key === key(p));
  aim(topGoal, rocket ? p.role === 'keeper' ? 14.6 : 17.4 : p.role === 'keeper' ? 7 : 8.6);
  ball.vx += clamp((ball.x - p.x) * 0.02, -1.5, 1.5);
  ball.spin -= 0.22;
  log(rocket ? `${p.role === 'keeper' ? 'GK' : `${p.no}番`}のロケットキック発動。` : `${p.role === 'keeper' ? 'GK' : `${p.no}番`}が弱くクリア。`);
}
function aim(t, v) { const dx = t.x - ball.x, dy = t.y - ball.y, dd = Math.max(Math.hypot(dx, dy), 1); ball.vx = dx / dd * v; ball.vy = dy / dd * v; }
function outcome() {
  const inGoal = ball.x > goalLeft && ball.x < goalRight;
  if (ball.y + ball.r < FIELD.topGoalY && inGoal) return finish('goal');
  if (ball.y - ball.r > FIELD.bottomGoalY && inGoal) return finish('own');
  if (elapsed > 45) return finish('time');
}
function finish(type) {
  running = false; ended = true;
  const msg = type === 'goal' ? ['GOOOOAL!', `${elapsed.toFixed(2)}秒。ボール全体が相手ゴールラインを超えました。`, 'goal'] : type === 'own' ? ['OWN GOAL', '自陣ゴールへ決められました。細工が足りません。', 'own'] : ['TIME UP', '45秒経過。決めきれませんでした。', 'own'];
  els.state.textContent = type === 'goal' ? 'GOAL' : type === 'own' ? 'OWN GOAL' : 'TIME UP';
  showResult(...msg);
  log(type === 'goal' ? '相手ゴールラインを完全突破。' : type === 'own' ? '自陣ゴールへ失点。' : 'タイムアップ。');
}
function showResult(title, text, kind) {
  els.result.replaceChildren();
  const card = document.createElement('div');
  card.className = `result-card ${kind}`;
  card.innerHTML = `<strong>${title}</strong><p>${text}</p><button class="primary" type="button">リトライ</button>`;
  card.querySelector('button').addEventListener('click', initState);
  els.result.appendChild(card);
  els.result.classList.remove('hidden');
}

function zones(id) { const s = ZONE[id]; if (!s) return []; return byGimmick(id).filter((p) => p.target.type === 'field').map((p) => ({ id: p.id, x: p.target.x - s.w / 2, y: p.target.y - s.h / 2, w: s.w, h: s.h })); }
function inside(p, z) { return p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h; }

function draw() {
  field();
  if (!activeGimmick()) {
    zones('lane').forEach((z) => zone(z, '氷の通路', 'rgba(96,220,255,.2)', 'rgba(130,235,255,.78)'));
    zones('spring').forEach((z) => zone(z, 'バネ床', 'rgba(232,255,102,.22)', 'rgba(232,255,102,.86)'));
  }
  if (has('magnet', (p) => p.target.type === 'goal') && !activeGimmick()) { ctx.strokeStyle = 'rgba(232,255,102,.42)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(topGoal.x, FIELD.topGoalY * 0.7, 285, 0, Math.PI * 2); ctx.stroke(); text('🧲', topGoal.x, FIELD.topGoalY + 24, 28); }
  players.slice().sort((a, b) => a.y - b.y).forEach(player);
  soccerBall();
  if (activeGimmick()) hints(activeGimmick());
  if (hitbox) drawHitbox();
}
function field() {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.h);
  g.addColorStop(0, '#1a9653'); g.addColorStop(.48, '#0e7b45'); g.addColorStop(1, '#064c2d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  for (let y = 0; y < FIELD.h; y += 78) { ctx.fillStyle = Math.floor(y / 78) % 2 ? 'rgba(0,0,0,.048)' : 'rgba(255,255,255,.048)'; ctx.fillRect(0, y, FIELD.w, 78); }
  net(goalLeft, 0, goalRight - goalLeft, FIELD.topGoalY, false);
  net(goalLeft, FIELD.bottomGoalY, goalRight - goalLeft, FIELD.h - FIELD.bottomGoalY, true);
  ctx.strokeStyle = 'rgba(255,255,255,.86)'; ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, FIELD.w - 36, FIELD.h - 36);
  ctx.beginPath(); ctx.moveTo(18, FIELD.h / 2); ctx.lineTo(FIELD.w - 18, FIELD.h / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(450, 700, 92, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(goalLeft - 56, 18, goalRight - goalLeft + 112, 190);
  ctx.strokeRect(goalLeft - 56, FIELD.h - 208, goalRight - goalLeft + 112, 190);
  posts();
}
function net(x, y, w, h, own) {
  ctx.fillStyle = own ? 'rgba(255,82,82,.22)' : 'rgba(255,244,170,.22)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = own ? 'rgba(255,160,160,.75)' : 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
  for (let gx = x; gx <= x + w; gx += 20) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let gy = y; gy <= y + h; gy += 13) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
}
function posts() {
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 14; ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = 9;
  ctx.beginPath();
  ctx.moveTo(goalLeft, FIELD.topGoalY); ctx.lineTo(goalLeft, 8); ctx.moveTo(goalRight, FIELD.topGoalY); ctx.lineTo(goalRight, 8); ctx.moveTo(goalLeft, FIELD.topGoalY); ctx.lineTo(goalRight, FIELD.topGoalY);
  ctx.moveTo(goalLeft, FIELD.bottomGoalY); ctx.lineTo(goalLeft, FIELD.h - 8); ctx.moveTo(goalRight, FIELD.bottomGoalY); ctx.lineTo(goalRight, FIELD.h - 8); ctx.moveTo(goalLeft, FIELD.bottomGoalY); ctx.lineTo(goalRight, FIELD.bottomGoalY);
  ctx.stroke(); ctx.restore();
}
function zone(z, label, fill, stroke) { ctx.save(); ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); rr(z.x, z.y, z.w, z.h, 18); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = stroke; ctx.font = '900 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, z.x + z.w / 2, z.y + z.h / 2 + 7); ctx.restore(); }
function player(p) {
  const e = effective(p); const down = elapsed < p.down;
  const c = p.role === 'keeper' ? ['#ffd36b', '#d49300', '#8c5f00'] : e === 'ally' && p.team === 'enemy' ? ['#bff7da', '#24b86e', '#086a3b'] : p.team === 'ally' ? ['#dce7ff', '#2368f3', '#0f3f9f'] : ['#ffc9c9', '#e23b3b', '#a91515'];
  shadow(p.x, p.y, p.r * 1.15, p.r * .5, down ? .12 : .25);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(down ? Math.PI / 2 : Math.atan2(ball.y - p.y, ball.x - p.x) + Math.PI / 2);
  ctx.globalAlpha = down ? .45 : 1; ctx.fillStyle = c[0]; ctx.strokeStyle = c[1]; ctx.lineWidth = 4; rr(-22, -30, 44, 45, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c[2]; ctx.font = '900 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.role === 'keeper' ? 'GK' : p.no, 0, -8);
  ctx.fillStyle = '#ffd2a7'; ctx.beginPath(); ctx.arc(0, -39, p.role === 'keeper' ? 12 : 10, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const badges = [];
  if (has('rocket', (pl) => pl.target.type === 'player' && pl.target.key === key(p))) badges.push('🚀');
  if (has('blade', (pl) => pl.target.type === 'player' && pl.target.key === key(p))) badges.push('🗡️');
  if (has('convert', (pl) => pl.target.type === 'player' && pl.target.key === key(p)) && elapsed < p.convert) badges.push('🇯🇵');
  if (down) badges.push('💫');
  badges.forEach((b, i) => badge(b, p.x + 24 + i * 18, p.y - p.r - 18));
}
function soccerBall() { shadow(ball.x, ball.y, ball.r * 1.18, ball.r * .5, .28); ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.a); ctx.fillStyle = '#f7f7f2'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, ball.r * 1.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, ball.r * .42, 0, Math.PI * 2); ctx.fill(); ctx.restore(); if (has('iceBall', (p) => p.target.type === 'ball')) badge('🧊', ball.x + 24, ball.y - 26); }
function hints(g) {
  ctx.save();
  const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 180);
  const valid = 'rgba(232,255,102,.98)';
  const glow = `rgba(101,242,164,${0.18 + pulse * 0.2})`;
  const soft = 'rgba(232,255,102,.72)';
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);

  if (deletePreview) {
    ctx.fillStyle = 'rgba(255,65,84,.34)';
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);
    labelBox('コート外で離すと撤去', FIELD.w / 2, FIELD.h / 2, '#ffffff');
    ctx.restore();
    return;
  }

  if (g.allowed.includes('field')) {
    ctx.fillStyle = 'rgba(101, 242, 164, .12)';
    ctx.strokeStyle = currentDrop?.kind === 'field' ? valid : 'rgba(101,242,164,.62)';
    ctx.lineWidth = currentDrop?.kind === 'field' ? 9 : 5;
    rr(18, 18, FIELD.w - 36, FIELD.h - 36, 28); ctx.fill(); ctx.stroke();
    labelBox(editingPlacement ? '動かして再配置 / コート外で撤去' : 'ゴール際も選手の真上も設置可', FIELD.w / 2, FIELD.topGoalY + 150, '#e8ff66');
    if (currentDrop?.kind === 'field') {
      const s = ZONE[g.id] ?? { w: 180, h: 110 };
      const z = { x: currentDrop.target.x - s.w / 2, y: currentDrop.target.y - s.h / 2, w: s.w, h: s.h };
      ctx.fillStyle = 'rgba(232,255,102,.28)'; ctx.strokeStyle = valid; ctx.lineWidth = 9;
      ctx.shadowColor = 'rgba(232,255,102,.95)'; ctx.shadowBlur = 28;
      rr(z.x, z.y, z.w, z.h, 18); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      cross(currentDrop.target.x, currentDrop.target.y, 44, valid);
      labelBox(editingPlacement ? '離すと移動' : '離すとここに設置', currentDrop.target.x, z.y - 24, '#ffffff');
    }
  }
  if (g.allowed.includes('goal')) targetRect(goalLeft - 16, 0, goalRight - goalLeft + 32, FIELD.topGoalY + 100, '相手ゴールに装着', currentDrop?.kind === 'goal');
  if (g.allowed.includes('ball')) targetCircle(ball.x, ball.y, ball.r + 66, 'ボールに装着', currentDrop?.kind === 'ball');
  for (const p of players) {
    const k = kind(p);
    if (!g.allowed.includes(k)) continue;
    targetCircle(p.x, p.y, p.r + 58, `${targetName(k, p)}に装着`, currentDrop?.target?.key === key(p));
  }
  labelBox(`${g.icon} ${g.name}：${editingPlacement ? '再配置中' : `${g.label}へ配置`}`, FIELD.w / 2, FIELD.h - 62, '#e8ff66');
  ctx.restore();

  function targetCircle(x, y, r, label, active) {
    ctx.save();
    const halo = ctx.createRadialGradient(x, y, r * 0.22, x, y, r * 1.45);
    halo.addColorStop(0, active ? 'rgba(232,255,102,.42)' : 'rgba(101,242,164,.22)');
    halo.addColorStop(0.56, active ? glow : 'rgba(232,255,102,.1)');
    halo.addColorStop(1, 'rgba(232,255,102,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, r * 1.45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = active ? valid : soft;
    ctx.lineWidth = active ? 10 : 6;
    ctx.shadowColor = active ? 'rgba(232,255,102,.95)' : 'rgba(101,242,164,.5)';
    ctx.shadowBlur = active ? 28 : 14;
    ctx.beginPath(); ctx.arc(x, y, r + pulse * 10, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = active ? '#ffffff' : 'rgba(255,255,255,.62)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, Math.max(18, r * .42), 0, Math.PI * 2); ctx.stroke();
    labelBox(label, x, y - r - 22, active ? '#ffffff' : '#e8ff66');
    if (active) cross(x, y, 34, valid);
    ctx.restore();
  }
  function targetRect(x, y, w, h, label, active) {
    ctx.save();
    ctx.fillStyle = active ? glow : 'rgba(232,255,102,.11)';
    ctx.strokeStyle = active ? valid : soft;
    ctx.lineWidth = active ? 10 : 6;
    ctx.shadowColor = active ? 'rgba(232,255,102,.95)' : 'rgba(101,242,164,.5)';
    ctx.shadowBlur = active ? 30 : 14;
    rr(x, y, w, h, 20); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    labelBox(label, x + w / 2, y + h + 30, active ? '#ffffff' : '#e8ff66');
    ctx.restore();
  }
}
function targetName(k, p) { if (k === 'keeper') return p.team === 'enemy' ? '敵GK' : '味方GK'; if (k === 'enemy') return `敵${p.no}番`; return `味方${p.no}番`; }
function labelBox(t, x, y, color) { ctx.save(); ctx.setLineDash([]); ctx.font = '900 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const m = ctx.measureText(t); const width = Math.min(FIELD.w - 42, m.width + 28); const left = clamp(x - width / 2, 21, FIELD.w - width - 21); ctx.fillStyle = 'rgba(2,14,9,.78)'; rr(left, y - 17, width, 34, 17); ctx.fill(); ctx.fillStyle = color; ctx.fillText(t, left + width / 2, y + 1, width - 18); ctx.restore(); }
function cross(x, y, r, stroke) { ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = stroke; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); ctx.restore(); }
function drawHitbox() { circle(ball.x, ball.y, ball.r, '#fffb91'); players.forEach((p) => { if (elapsed >= p.down) circle(p.x, p.y, p.r, '#fffb91'); }); }
function shadow(x, y, rx, ry, a) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x + 5, y + 8, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function badge(t, x, y) { ctx.fillStyle = 'rgba(2,14,10,.78)'; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); text(t, x, y + 1, 16); }
function text(t, x, y, s) { ctx.font = `${s}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(t, x, y); }
function circle(x, y, r, stroke) { ctx.strokeStyle = stroke; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
function rr(x, y, w, h, r) { const m = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); ctx.beginPath(); ctx.moveTo(x + m, y); ctx.lineTo(x + w - m, y); ctx.quadraticCurveTo(x + w, y, x + w, y + m); ctx.lineTo(x + w, y + h - m); ctx.quadraticCurveTo(x + w, y + h, x + w - m, y + h); ctx.lineTo(x + m, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - m); ctx.lineTo(x, y + m); ctx.quadraticCurveTo(x, y, x + m, y); }
function updateDebug() { els.debug.textContent = [`state: ${els.state.textContent}`, `time: ${elapsed.toFixed(2)}s`, `ball: x=${ball.x.toFixed(1)}, y=${ball.y.toFixed(1)}`, `velocity: ${mag(ball).toFixed(3)} (${ball.vx.toFixed(2)}, ${ball.vy.toFixed(2)})`, `field: ${FIELD.w}x${FIELD.h}`, `goal x: ${goalLeft.toFixed(0)}-${goalRight.toFixed(0)}`, `cost: ${cost()}/${COST_LIMIT}`, `placements: ${placements.length}`, `selected: ${activeGimmick()?.name ?? 'なし'}`, `editing: ${editingPlacement ? gimmick(editingPlacement.gid).name : 'なし'}`, `speed label: ${speedText()} / sim=${SIM_SPEEDS[speedIndex]}x`, `points: ${points}`, `engine: built-in deterministic 2D`, `hitbox: ${hitbox ? 'ON' : 'OFF'}`].join('\n'); }

async function loadShopCatalog() {
  seedOwned(['🦵', '🚀', '💨', '🥅', '🏃', '🇯🇵']);
  try {
    const res = await fetch('./emoji_catalog_full_ja.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const data = await res.json();
    const raw = Array.isArray(data) ? data : (data.emojis ?? data.items ?? []);
    emojiCatalog = raw
      .filter((item) => item && item.emoji)
      .map((item) => ({
        emoji: item.emoji,
        jaName: item.jaName || item.name || item.emoji,
        shopCategory: item.shopCategory || 'その他',
        price: Number.isFinite(Number(item.price)) ? Number(item.price) : estimateEmojiPrice(item),
      }));
  } catch (err) {
    emojiCatalog = FALLBACK_EMOJIS;
    log('絵文字カタログの読み込みに失敗。内蔵ミニショップで続行。');
  }
  emojiCatalog.sort((a, b) => a.shopCategory.localeCompare(b.shopCategory, 'ja') || a.price - b.price || a.jaName.localeCompare(b.jaName, 'ja'));
  renderShop();
}

function estimateEmojiPrice(item) {
  const category = item.shopCategory || '';
  if (/旗|記号|顔/.test(category)) return 10;
  if (/道具|スポーツ|乗り物/.test(category)) return 22;
  if (/自然|動物/.test(category)) return 16;
  return 14;
}

function seedOwned(list) {
  for (const emoji of list) owned.set(emoji, (owned.get(emoji) ?? 0) + 1);
}

function renderShop() {
  renderCategoryTabs();
  renderShopGrid();
  renderCart();
  renderOwned();
  renderGeneratedRecipes();
}

function renderCategoryTabs() {
  if (!els.shopCategoryTabs) return;
  const categories = ['すべて', ...new Set(emojiCatalog.map((e) => e.shopCategory || 'その他'))];
  if (!categories.includes(shopCategory)) shopCategory = 'すべて';
  els.shopCategoryTabs.replaceChildren(...categories.map((cat) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cat === shopCategory ? 'is-active' : '';
    b.textContent = cat;
    b.addEventListener('click', () => { shopCategory = cat; renderShop(); });
    return b;
  }));
}

function renderShopGrid() {
  if (!els.shopGrid) return;
  const filtered = shopCategory === 'すべて' ? emojiCatalog : emojiCatalog.filter((e) => e.shopCategory === shopCategory);
  const page = filtered.slice(0, 240);
  els.shopGrid.replaceChildren(...page.map((item) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'emoji-shop-card';
    card.innerHTML = `<span class="shop-emoji">${item.emoji}</span><strong class="emoji-name">${item.jaName}</strong><span class="emoji-add">カートへ</span><span class="emoji-price">${item.price}</span>`;
    card.addEventListener('click', () => addToCart(item));
    return card;
  }));
}

function addToCart(item) {
  cart.push(item);
  log(`${item.emoji} ${item.jaName}をカートへ追加。`);
  renderShop();
}

function renderCart() {
  if (!els.cartList) return;
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  els.cartTotal.textContent = total;
  els.buyCart.disabled = !cart.length || total > points;
  if (!cart.length) {
    const empty = document.createElement('div');
    empty.className = 'cart-empty';
    empty.textContent = 'カードをタップして追加';
    els.cartList.replaceChildren(empty);
    return;
  }
  els.cartList.replaceChildren(...cart.map((item, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cart-chip';
    chip.textContent = `${item.emoji} ${item.price}`;
    chip.addEventListener('click', () => { cart.splice(index, 1); renderShop(); });
    return chip;
  }));
}

function buyCart() {
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  if (!cart.length) return;
  if (total > points) return log('発想ポイントが足りません。');
  points -= total;
  for (const item of cart) owned.set(item.emoji, (owned.get(item.emoji) ?? 0) + 1);
  log(`${cart.map((i) => i.emoji).join(' ')} を購入。-${total}pt`);
  cart = [];
  renderShop();
}

function renderOwned() {
  if (!els.ownedList) return;
  els.points.textContent = points;
  const chips = Array.from(owned.entries()).map(([emoji, count]) => {
    const span = document.createElement('span');
    span.className = 'owned-chip';
    span.textContent = count > 1 ? `${emoji}×${count}` : emoji;
    return span;
  });
  els.ownedList.replaceChildren(...chips);
}

function renderGeneratedRecipes() {
  if (!els.recipes) return;
  els.recipes.replaceChildren(...GIMMICKS.map((g) => {
    const row = document.createElement('div');
    row.className = 'recipe-item';
    row.innerHTML = `<span><strong>${g.icon} ${g.name}</strong><small>${g.recipe.join(' + ')} / ${g.label} / cost ${g.cost}</small></span><span>${g.cost}</span>`;
    return row;
  }));
}

function loop(now = performance.now()) {
  const delta = Math.min((now - lastTs) / 1000, .1);
  lastTs = now;
  if (running && !ended) {
    acc += delta * SIM_SPEEDS[speedIndex];
    while (acc >= 1 / 60) {
      step(1 / 60);
      acc -= 1 / 60;
      if (ended) break;
    }
  }
  updateHud();
  draw();
  updateDebug();
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', handleFieldPointerDown, { passive: false });
canvas.addEventListener('pointermove', handleFieldPointerMove, { passive: false });
canvas.addEventListener('pointerup', handleFieldPointerUp, { passive: false });
canvas.addEventListener('pointercancel', (e) => { if (placePointerId === e.pointerId) { placePointerId = null; currentDrop = null; deletePreview = false; editingPlacement = null; draw(); } });

$$('.tab-button').forEach((button) => button.addEventListener('click', () => openTab(button.dataset.tab)));
els.kick.addEventListener('click', kick);
els.pause.addEventListener('click', () => { if (ended) return; running = !running; els.state.textContent = running ? '試合中' : '一時停止'; els.pause.textContent = running ? '一時停止' : '再開'; updateHud(); });
els.retry.addEventListener('click', initState);
els.speed.addEventListener('click', () => { speedIndex = (speedIndex + 1) % SIM_SPEEDS.length; updateHud(); });
els.preset.addEventListener('click', preset);
els.clear.addEventListener('click', () => clearPlacements(false));
els.angle.addEventListener('input', updateHud);
els.power.addEventListener('input', updateHud);
els.hitbox.addEventListener('click', () => { hitbox = !hitbox; draw(); });
els.goal.addEventListener('click', () => finish('goal'));
els.own.addEventListener('click', () => finish('own'));
els.step.addEventListener('click', () => { if (!running && !ended) { step(1 / 60); draw(); updateDebug(); } });
els.buyCart?.addEventListener('click', buyCart);
els.clearCart?.addEventListener('click', () => { cart = []; renderShop(); });

placements = [];
nextId = 1;
speedIndex = 0;
hitbox = false;
initState();
preset();
loadShopCatalog();
requestAnimationFrame((t) => { lastTs = t; loop(t); });
