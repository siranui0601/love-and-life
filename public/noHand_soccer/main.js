const FIELD = Object.freeze({
  width: 900,
  height: 1400,
  goalRatio: 0.3,
  opponentGoalY: 86,
  ownGoalY: 1314,
  ballRadius: 18,
  playerRadius: 26,
  keeperRadius: 30,
  fixedStep: 1 / 60,
});

const COST_LIMIT = 30;
const SPEEDS = [1, 2, 0.5];
const goalLeft = FIELD.width * (1 - FIELD.goalRatio) / 2;
const goalRight = FIELD.width * (1 + FIELD.goalRatio) / 2;
const opponentGoalCenter = { x: FIELD.width / 2, y: FIELD.opponentGoalY * 0.45 };
const ownGoalCenter = { x: FIELD.width / 2, y: FIELD.ownGoalY + 54 };

const FIXED_GIMMICKS = Object.freeze([
  { id: 'rocket_kick', icon: '🚀🦵', name: 'ロケットキック', cost: 6, allowed: ['allyPlayer', 'goalkeeper'], label: '味方選手/GK', summary: '装着した味方がボールに触れると、相手ゴールへ強く蹴る。' },
  { id: 'low_friction_ball', icon: '🧊⚽', name: '低摩擦ボール', cost: 4, allowed: ['ball'], label: 'ボール', summary: 'ボールの減速を抑え、転がりを長く保つ。' },
  { id: 'spring_pad', icon: '🟩🦘', name: 'バネ床', cost: 5, allowed: ['field'], label: 'コート', summary: '踏んだボールを相手ゴール方向へ跳ね上げる。' },
  { id: 'goal_magnet', icon: '🥅🧲', name: '吸引ゴール', cost: 7, allowed: ['opponentGoal'], label: '相手ゴール', summary: 'ゴール付近のボールをネット中央へじわっと引く。' },
  { id: 'flag_convert', icon: '🇯🇵🏃', name: '寝返り日の丸', cost: 8, allowed: ['enemyPlayer'], label: '敵選手', summary: '装着した敵選手を一定時間だけ味方扱いにする。' },
  { id: 'pitch_blade', icon: '🗡️', name: 'ピッチ刀', cost: 5, allowed: ['allyPlayer'], label: '味方選手', summary: '装着した味方の近くに来た敵を短時間ダウンさせる。' },
  { id: 'ice_lane', icon: '🧊🛣️', name: '氷の通路', cost: 5, allowed: ['field'], label: 'コート', summary: '指定した場所を低抵抗ゾーンにする。' },
]);

const ZONE_SIZE = Object.freeze({
  spring_pad: { w: 216, h: 88 },
  ice_lane: { w: 304, h: 164 },
});

const DEFAULT_PLACEMENTS = [
  { gimmickId: 'rocket_kick', target: { type: 'player', key: 'ally:field:10' } },
  { gimmickId: 'low_friction_ball', target: { type: 'ball' } },
  { gimmickId: 'spring_pad', target: { type: 'field', x: 450, y: 790 } },
  { gimmickId: 'pitch_blade', target: { type: 'player', key: 'ally:field:10' } },
];

const TEAM = Object.freeze({
  ally: { fill: '#f7f7ff', fill2: '#dce7ff', stroke: '#2368f3', dark: '#0f3f9f', shorts: '#1742a5', socks: '#f7f7ff' },
  enemy: { fill: '#ffe9e9', fill2: '#ffc9c9', stroke: '#e23b3b', dark: '#a91515', shorts: '#8f1111', socks: '#fff1f1' },
  converted: { fill: '#eafff0', fill2: '#bff7da', stroke: '#24b86e', dark: '#086a3b', shorts: '#0b7a45', socks: '#f7fff8' },
  keeper: { fill: '#fff1b5', fill2: '#ffd36b', stroke: '#d49300', dark: '#8c5f00', shorts: '#57451d', socks: '#fff1b5' },
});

const canvas = document.querySelector('#fieldCanvas');
const ctx = canvas.getContext('2d');
const fieldFrame = document.querySelector('#fieldFrame');
const timerEl = document.querySelector('#timer');
const matchStateEl = document.querySelector('#matchState');
const debugTextEl = document.querySelector('#debugText');
const resultOverlayEl = document.querySelector('#resultOverlay');
const logListEl = document.querySelector('#logList');
const gimmickListEl = document.querySelector('#gimmickList');
const installedListEl = document.querySelector('#installedList');
const installedCountEl = document.querySelector('#installedCount');
const costUsedEl = document.querySelector('#costUsed');
const costLimitEl = document.querySelector('#costLimit');
const costBadgeEl = document.querySelector('#costBadge');
const speedBadgeEl = document.querySelector('#speedBadge');
const kickBtn = document.querySelector('#kickBtn');
const pauseBtn = document.querySelector('#pauseBtn');
const retryBtn = document.querySelector('#retryBtn');
const speedBtn = document.querySelector('#speedBtn');
const presetBtn = document.querySelector('#presetBtn');
const clearGimmicksBtn = document.querySelector('#clearGimmicksBtn');
const angleInput = document.querySelector('#angleInput');
const powerInput = document.querySelector('#powerInput');
const angleValue = document.querySelector('#angleValue');
const powerValue = document.querySelector('#powerValue');
const hitboxBtn = document.querySelector('#hitboxBtn');
const forceGoalBtn = document.querySelector('#forceGoalBtn');
const forceOwnGoalBtn = document.querySelector('#forceOwnGoalBtn');
const stepBtn = document.querySelector('#stepBtn');

let ball;
let players = [];
let placements = [];
let nextPlacementId = 1;
let logs = [];
let cooldowns = new Map();
let running = false;
let ended = false;
let showHitboxes = false;
let speedIndex = 0;
let elapsed = 0;
let lastTs = performance.now();
let accumulator = 0;
let dragging = null;
let dragGhost = null;
let currentDrop = null;

function getGimmick(id) {
  return FIXED_GIMMICKS.find((g) => g.id === id);
}

function getCost() {
  return placements.reduce((sum, p) => sum + getGimmick(p.gimmickId).cost, 0);
}

function playerKey(p) {
  return `${p.baseTeam}:${p.role}:${p.number}`;
}

function findPlayer(key) {
  return players.find((p) => playerKey(p) === key);
}

function getEffectiveTeam(p) {
  if (p.baseTeam === 'enemy' && elapsed < p.convertedUntil) return 'ally';
  return p.baseTeam;
}

function hasPlacement(id, predicate = () => true) {
  return placements.some((p) => p.gimmickId === id && predicate(p));
}

function getPlacements(id) {
  return placements.filter((p) => p.gimmickId === id);
}

function log(text) {
  logs.unshift(`${elapsed.toFixed(2)}s　${text}`);
  logs = logs.slice(0, 30);
  renderLog();
}

function renderLog() {
  logListEl.replaceChildren(...logs.map((line) => {
    const row = document.createElement('div');
    row.className = 'log-line';
    row.textContent = line;
    return row;
  }));
}

function resetWorld() {
  ball = { x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, r: FIELD.ballRadius, angle: 0, spin: 0 };
  players = [
    makePlayer(450, 1246, 'ally', 'keeper', 1, goalLeft + 24, goalRight - 24),
    makePlayer(260, 920, 'ally', 'field', 7),
    makePlayer(450, 820, 'ally', 'field', 10),
    makePlayer(640, 920, 'ally', 'field', 11),
    makePlayer(450, 154, 'enemy', 'keeper', 1, goalLeft + 24, goalRight - 24),
    makePlayer(260, 480, 'enemy', 'field', 4),
    makePlayer(450, 620, 'enemy', 'field', 9),
    makePlayer(640, 480, 'enemy', 'field', 6),
  ];
  cooldowns = new Map();
  elapsed = 0;
  accumulator = 0;
  running = false;
  ended = false;
  logs = [];
  resultOverlayEl.classList.add('hidden');
  resultOverlayEl.replaceChildren();
  applyPlacementState();
  matchStateEl.textContent = '準備中';
  pauseBtn.textContent = '一時停止';
  log('中央キックオフ。敵は高速で詰めて自陣ゴールを狙います。');
  renderAll();
}

function makePlayer(x, y, baseTeam, role, number, patrolMin = null, patrolMax = null) {
  const r = role === 'keeper' ? FIELD.keeperRadius : FIELD.playerRadius;
  return { x, y, vx: 0, vy: 0, r, baseTeam, role, number, homeX: x, homeY: y, patrolMin, patrolMax, downUntil: 0, convertedUntil: 0, touchCooldown: 0 };
}

function applyPlacementState() {
  for (const p of players) p.convertedUntil = 0;
  for (const placement of getPlacements('flag_convert')) {
    const player = findPlayer(placement.target.key);
    if (player) player.convertedUntil = 12;
  }
}

function updateKickLabels() {
  angleValue.textContent = `${angleInput.value}°`;
  powerValue.textContent = (Number(powerInput.value) / 1000).toFixed(3);
}

function updateHud() {
  const cost = getCost();
  costLimitEl.textContent = String(COST_LIMIT);
  costUsedEl.textContent = String(cost);
  costBadgeEl.textContent = `COST ${cost}/${COST_LIMIT}`;
  speedBadgeEl.textContent = `${SPEEDS[speedIndex]}x`;
  speedBtn.textContent = SPEEDS[speedIndex] === 1 ? '等速' : `${SPEEDS[speedIndex]}x`;
  document.querySelector('.cost-meter')?.classList.toggle('over', cost > COST_LIMIT);
  kickBtn.disabled = cost > COST_LIMIT || (running && !ended);
  timerEl.textContent = `${elapsed.toFixed(2)}s`;
}

function renderGimmicks() {
  gimmickListEl.replaceChildren();
  const cost = getCost();
  for (const g of FIXED_GIMMICKS) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `gimmick-item ${cost + g.cost > COST_LIMIT ? 'is-locked' : ''}`;
    item.innerHTML = `
      <span class="gimmick-icon">${g.icon}</span>
      <span class="gimmick-main"><strong>${g.name}</strong><small>${g.label}｜${g.summary}</small></span>
      <span class="gimmick-cost-pill">${g.cost}</span>
    `;
    item.addEventListener('pointerdown', (e) => startDrag(e, g, item));
    item.addEventListener('click', () => log(`${g.name}：カードをコートへドラッグして装着。`));
    gimmickListEl.appendChild(item);
  }
}

function renderInstalled() {
  installedCountEl.textContent = String(placements.length);
  installedListEl.replaceChildren();
  if (!placements.length) {
    const empty = document.createElement('div');
    empty.className = 'installed-empty';
    empty.textContent = 'まだ何も配置されていません。';
    installedListEl.appendChild(empty);
    return;
  }
  for (const placement of placements) {
    const g = getGimmick(placement.gimmickId);
    const row = document.createElement('div');
    row.className = 'installed-item';
    row.innerHTML = `<span><strong>${g.icon} ${g.name}</strong><small>${describeTarget(placement.target)} / cost ${g.cost}</small></span><button type="button">撤去</button>`;
    row.querySelector('button').addEventListener('click', () => removePlacement(placement.id));
    installedListEl.appendChild(row);
  }
}

function renderAll() {
  updateHud();
  updateKickLabels();
  renderGimmicks();
  renderInstalled();
  renderLog();
  draw();
  updateDebug();
}

function describeTarget(target) {
  if (target.type === 'ball') return 'ボール';
  if (target.type === 'goal') return '相手ゴール';
  if (target.type === 'field') return `コート(${Math.round(target.x)}, ${Math.round(target.y)})`;
  if (target.type === 'player') {
    const p = findPlayer(target.key);
    if (!p) return '選手';
    return `${p.baseTeam === 'enemy' ? '敵' : '味方'}${p.role === 'keeper' ? 'GK' : `${p.number}番`}`;
  }
  return '不明';
}

function addPlacement(gimmickId, target, silent = false) {
  const g = getGimmick(gimmickId);
  if (!g) return false;
  if (getCost() + g.cost > COST_LIMIT) {
    if (!silent) log(`${g.name}はコスト超過で配置できない。`);
    return false;
  }
  placements.push({ id: nextPlacementId++, gimmickId, target });
  if (!silent) log(`${g.name}を${describeTarget(target)}へ装着。`);
  applyPlacementState();
  renderAll();
  return true;
}

function removePlacement(id) {
  const placement = placements.find((p) => p.id === id);
  if (!placement) return;
  const g = getGimmick(placement.gimmickId);
  placements = placements.filter((p) => p.id !== id);
  log(`${g.name}を撤去。`);
  applyPlacementState();
  renderAll();
}

function clearPlacements(silent = false) {
  placements = [];
  nextPlacementId = 1;
  if (!silent) log('固定ギミックを全撤去。');
  applyPlacementState();
  renderAll();
}

function applyPreset() {
  placements = [];
  nextPlacementId = 1;
  for (const p of DEFAULT_PLACEMENTS) addPlacement(p.gimmickId, p.target, true);
  applyPlacementState();
  log('おすすめ配置を適用。味方10番中心に反撃ラインを作成。');
  renderAll();
}

function startDrag(event, gimmick, sourceEl) {
  if (running && !ended) {
    log('試合中は装着できません。リトライ後に配置してください。');
    return;
  }
  if (getCost() + gimmick.cost > COST_LIMIT) {
    log(`${gimmick.name}はコスト超過で持てない。`);
    return;
  }
  event.preventDefault();
  dragging = { gimmick, sourceEl };
  sourceEl.classList.add('is-dragging-source');
  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  dragGhost.innerHTML = `<span>${gimmick.icon}</span><span><strong>${gimmick.name}</strong><small>${gimmick.label}</small></span>`;
  document.body.appendChild(dragGhost);
  moveDragGhost(event.clientX, event.clientY);
  window.addEventListener('pointermove', handleDragMove, { passive: false });
  window.addEventListener('pointerup', handleDragEnd, { once: true });
}

function handleDragMove(event) {
  if (!dragging) return;
  event.preventDefault();
  moveDragGhost(event.clientX, event.clientY);
  const point = getFieldPoint(event.clientX, event.clientY);
  currentDrop = point ? findDropTarget(point, dragging.gimmick) : null;
  draw();
}

function handleDragEnd(event) {
  window.removeEventListener('pointermove', handleDragMove);
  if (!dragging) return;
  const point = getFieldPoint(event.clientX, event.clientY);
  const target = point ? findDropTarget(point, dragging.gimmick) : null;
  if (target?.ok) addPlacement(dragging.gimmick.id, target.target);
  else log(`${dragging.gimmick.name}はそこには装着できない。`);
  dragging.sourceEl.classList.remove('is-dragging-source');
  dragGhost?.remove();
  dragging = null;
  dragGhost = null;
  currentDrop = null;
  draw();
}

function moveDragGhost(x, y) {
  if (!dragGhost) return;
  dragGhost.style.left = `${x}px`;
  dragGhost.style.top = `${y}px`;
}

function getFieldPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
  return { x: (clientX - rect.left) / rect.width * FIELD.width, y: (clientY - rect.top) / rect.height * FIELD.height };
}

function targetKindForPlayer(p) {
  if (p.role === 'keeper') return 'goalkeeper';
  return p.baseTeam === 'enemy' ? 'enemyPlayer' : 'allyPlayer';
}

function findDropTarget(point, gimmick) {
  if (gimmick.allowed.includes('opponentGoal') && point.x >= goalLeft && point.x <= goalRight && point.y <= FIELD.opponentGoalY + 95) {
    return { ok: true, kind: 'opponentGoal', target: { type: 'goal' } };
  }
  if (gimmick.allowed.includes('ball') && dist(point, ball) <= ball.r + 36) {
    return { ok: true, kind: 'ball', target: { type: 'ball' } };
  }
  const nearest = players.map((p) => ({ p, d: dist(point, p) })).sort((a, b) => a.d - b.d)[0];
  if (nearest && nearest.d <= nearest.p.r + 44) {
    const kind = targetKindForPlayer(nearest.p);
    if (gimmick.allowed.includes(kind)) return { ok: true, kind, target: { type: 'player', key: playerKey(nearest.p) } };
    return { ok: false, kind };
  }
  if (gimmick.allowed.includes('field') && point.y > FIELD.opponentGoalY + 100 && point.y < FIELD.ownGoalY - 58) {
    const size = ZONE_SIZE[gimmick.id] ?? { w: 180, h: 110 };
    return {
      ok: true,
      kind: 'field',
      target: {
        type: 'field',
        x: clamp(point.x, size.w / 2 + 28, FIELD.width - size.w / 2 - 28),
        y: clamp(point.y, FIELD.opponentGoalY + size.h / 2 + 54, FIELD.ownGoalY - size.h / 2 - 54),
      },
    };
  }
  return { ok: false };
}

function kick() {
  if (running && !ended) return;
  if (ended) resetWorld();
  if (getCost() > COST_LIMIT) {
    log('コスト超過中はキックできない。');
    return;
  }
  const angleDeg = Number(angleInput.value);
  const p = Number(powerInput.value);
  const angle = (-90 + angleDeg) * Math.PI / 180;
  const speed = 6 + p * 0.23;
  ball.x = FIELD.width / 2;
  ball.y = FIELD.height / 2;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.spin = angleDeg * 0.006;
  running = true;
  ended = false;
  matchStateEl.textContent = '試合中';
  updateHud();
  log(`中央キックオフ：角度 ${angleDeg}° / 威力 ${(p / 1000).toFixed(3)}`);
  fieldFrame.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function step(dt) {
  if (ended) return;
  elapsed += dt;
  applyGimmicks(dt);
  updatePlayers(dt);
  updateBall(dt);
  resolveCollisions();
  checkOutcome();
}

function updateBall(dt) {
  const ice = getFieldZones('ice_lane').some((z) => insideZone(ball, z));
  const lowFriction = hasPlacement('low_friction_ball', (p) => p.target.type === 'ball');
  const drag = ice ? 0.992 : lowFriction ? 0.988 : 0.978;
  ball.vx *= Math.pow(drag, dt * 60);
  ball.vy *= Math.pow(drag, dt * 60);
  ball.x += ball.vx * dt * 60;
  ball.y += ball.vy * dt * 60;
  ball.angle += ball.spin * dt * 60;
  ball.spin *= Math.pow(0.992, dt * 60);

  if (ball.x - ball.r < 18) { ball.x = 18 + ball.r; ball.vx = Math.abs(ball.vx) * 0.82; logOnce('wallL', '左壁に接触。', 0.8); }
  if (ball.x + ball.r > FIELD.width - 18) { ball.x = FIELD.width - 18 - ball.r; ball.vx = -Math.abs(ball.vx) * 0.82; logOnce('wallR', '右壁に接触。', 0.8); }
}

function updatePlayers(dt) {
  for (const p of players) {
    if (elapsed < p.downUntil) {
      p.vx *= 0.82;
      p.vy *= 0.82;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      continue;
    }
    const effective = getEffectiveTeam(p);
    const keeper = p.role === 'keeper';
    const enemy = effective === 'enemy';
    const maxSpeed = enemy ? (keeper ? 6.3 : 11.8) : (keeper ? 3.9 : 3.6);
    const accel = enemy ? (keeper ? 0.48 : 0.72) : (keeper ? 0.21 : 0.18);
    let targetX = ball.x;
    let targetY = ball.y;
    if (enemy) {
      targetX += ball.vx * 14;
      targetY += ball.vy * 14;
    }
    if (keeper) {
      targetX = clamp(ball.x, p.patrolMin, p.patrolMax);
      targetY = p.homeY;
    }
    const dx = targetX - p.x;
    const dy = targetY - p.y;
    const d = Math.max(Math.hypot(dx, dy), 1);
    p.vx += (dx / d) * accel * dt * 60;
    p.vy += (dy / d) * accel * dt * 60;
    const s = Math.hypot(p.vx, p.vy);
    if (s > maxSpeed) {
      p.vx = (p.vx / s) * maxSpeed;
      p.vy = (p.vy / s) * maxSpeed;
    }
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.x = clamp(p.x, 24 + p.r, FIELD.width - 24 - p.r);
    p.y = clamp(p.y, FIELD.opponentGoalY + 8 + p.r, FIELD.ownGoalY - 8 - p.r);
  }
}

function applyGimmicks() {
  if (hasPlacement('goal_magnet', (p) => p.target.type === 'goal')) {
    const dx = opponentGoalCenter.x - ball.x;
    const dy = opponentGoalCenter.y - ball.y;
    const d = Math.hypot(dx, dy);
    if (d < 360 && d > 1) {
      const pull = (1 - d / 360) * 0.12;
      ball.vx += (dx / d) * pull;
      ball.vy += (dy / d) * pull;
      logOnce('goal_magnet', '吸引ゴール：ネット中央へ引き寄せ中。', 1.4);
    }
  }

  for (const z of getFieldZones('spring_pad')) {
    if (insideZone(ball, z) && canTrigger(`spring:${z.id}`, 0.9)) {
      setBallVelocityToward(opponentGoalCenter, Math.max(speed(ball), 9.8) + 4.3);
      ball.spin += 0.18;
      log('バネ床発動：相手ゴール方向へ跳ね上げた。');
    }
  }

  for (const z of getFieldZones('ice_lane')) {
    if (insideZone(ball, z)) logOnce(`ice:${z.id}`, '氷の通路：通過中の減速を軽減。', 1.8);
  }

  for (const placement of getPlacements('pitch_blade')) {
    const owner = findPlayer(placement.target.key);
    if (!owner || elapsed < owner.downUntil) continue;
    let target = null;
    let best = Infinity;
    for (const p of players) {
      if (getEffectiveTeam(p) === 'ally' || elapsed < p.downUntil) continue;
      const d = dist(owner, p);
      if (d < best) { best = d; target = p; }
    }
    if (target && best < 155 && canTrigger(`blade:${placement.id}`, 1.4)) {
      target.downUntil = elapsed + 2.3;
      const dx = target.x - owner.x;
      const dy = target.y - owner.y;
      const d = Math.max(Math.hypot(dx, dy), 1);
      target.vx += (dx / d) * 8;
      target.vy += (dy / d) * 8;
      log(`ピッチ刀：敵${target.number}番を短時間ダウン。`);
    }
  }
}

function resolveCollisions() {
  for (const p of players) {
    const d = dist(ball, p);
    const min = ball.r + p.r;
    if (d < min && d > 0.001) {
      const nx = (ball.x - p.x) / d;
      const ny = (ball.y - p.y) / d;
      const overlap = min - d;
      ball.x += nx * overlap * 0.62;
      ball.y += ny * overlap * 0.62;
      p.x -= nx * overlap * 0.18;
      p.y -= ny * overlap * 0.18;
      handleBallPlayerTouch(p);
    }
  }
}

function handleBallPlayerTouch(p) {
  if (!canTrigger(`touch:${playerKey(p)}`, 0.58)) return;
  const effective = getEffectiveTeam(p);
  log(`ボールが${effective === 'ally' ? '味方側' : '敵側'}の選手に接触。`);
  if (effective === 'enemy') {
    setBallVelocityToward(ownGoalCenter, p.role === 'keeper' ? 13.0 : 19.5);
    ball.spin += 0.28;
    log(`敵${p.role === 'keeper' ? 'GK' : `${p.number}番`}が自陣ゴールへ強烈に蹴り込んだ。`);
    return;
  }
  const rocket = hasPlacement('rocket_kick', (placement) => placement.target.type === 'player' && placement.target.key === playerKey(p));
  setBallVelocityToward(opponentGoalCenter, rocket ? (p.role === 'keeper' ? 14.6 : 17.4) : (p.role === 'keeper' ? 7 : 8.6));
  ball.vx += clamp((ball.x - p.x) * 0.02, -1.5, 1.5);
  ball.spin -= 0.22;
  log(rocket ? `${p.role === 'keeper' ? 'GK' : `${p.number}番`}のロケットキック発動。` : `${p.role === 'keeper' ? 'GK' : `${p.number}番`}が弱くクリア。`);
}

function setBallVelocityToward(target, v) {
  const dx = target.x - ball.x;
  const dy = target.y - ball.y;
  const d = Math.max(Math.hypot(dx, dy), 1);
  ball.vx = (dx / d) * v;
  ball.vy = (dy / d) * v;
}

function checkOutcome() {
  const inGoal = ball.x > goalLeft && ball.x < goalRight;
  if (ball.y + ball.r < FIELD.opponentGoalY && inGoal) return finish('goal');
  if (ball.y - ball.r > FIELD.ownGoalY && inGoal) return finish('ownGoal');
  if (elapsed > 45) return finish('timeout');
}

function finish(type) {
  running = false;
  ended = true;
  updateHud();
  if (type === 'goal') {
    matchStateEl.textContent = 'GOAL';
    showResult('GOOOOAL!', `${elapsed.toFixed(2)}秒。ボール全体が相手ゴールラインを超えました。`, 'goal');
    log('相手ゴールラインを完全突破。');
  } else if (type === 'ownGoal') {
    matchStateEl.textContent = 'OWN GOAL';
    showResult('OWN GOAL', '自陣ゴールへ決められました。細工が足りません。', 'own');
    log('自陣ゴールへ失点。');
  } else {
    matchStateEl.textContent = 'TIME UP';
    showResult('TIME UP', '45秒経過。決めきれませんでした。', 'own');
    log('タイムアップ。');
  }
}

function showResult(title, text, kind) {
  resultOverlayEl.replaceChildren();
  const card = document.createElement('div');
  card.className = `result-card ${kind}`;
  card.innerHTML = `<strong>${title}</strong><p>${text}</p><button class="primary" type="button">リトライ</button>`;
  card.querySelector('button').addEventListener('click', resetWorld);
  resultOverlayEl.appendChild(card);
  resultOverlayEl.classList.remove('hidden');
}

function getFieldZones(gimmickId) {
  const size = ZONE_SIZE[gimmickId];
  if (!size) return [];
  return getPlacements(gimmickId)
    .filter((p) => p.target.type === 'field')
    .map((p) => ({ id: p.id, x: p.target.x - size.w / 2, y: p.target.y - size.h / 2, w: size.w, h: size.h }));
}

function draw() {
  drawField();
  drawFieldGimmicks();
  drawPlayers();
  drawBall();
  if (dragging) drawDropHints(dragging.gimmick);
  if (showHitboxes) drawHitboxes();
}

function drawField() {
  const w = FIELD.width;
  const h = FIELD.height;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1a9653');
  grad.addColorStop(0.48, '#0e7b45');
  grad.addColorStop(1, '#064c2d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 78) {
    ctx.fillStyle = Math.floor(y / 78) % 2 === 0 ? 'rgba(255,255,255,.048)' : 'rgba(0,0,0,.048)';
    ctx.fillRect(0, y, w, 78);
  }
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = '#eaffd5';
  for (let x = -h; x < w; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h, h);
    ctx.stroke();
  }
  ctx.restore();

  drawGoalNet(goalLeft, 0, goalRight - goalLeft, FIELD.opponentGoalY, false);
  drawGoalNet(goalLeft, FIELD.ownGoalY, goalRight - goalLeft, h - FIELD.ownGoalY, true);

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.86)';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.beginPath(); ctx.moveTo(18, h / 2); ctx.lineTo(w - 18, h / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 92, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeRect(goalLeft - 56, 18, goalRight - goalLeft + 112, 190);
  ctx.strokeRect(goalLeft - 56, h - 208, goalRight - goalLeft + 112, 190);
  ctx.restore();

  drawGoalFrames();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '900 22px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.fillText('相手ゴール', w / 2, 46);
  ctx.fillStyle = 'rgba(255,188,188,.95)';
  ctx.fillText('自陣ゴール', w / 2, h - 18);
  ctx.restore();
}

function drawGoalNet(x, y, w, h, own) {
  ctx.save();
  ctx.fillStyle = own ? 'rgba(255,82,82,.22)' : 'rgba(255,244,170,.22)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = own ? 'rgba(255,160,160,.75)' : 'rgba(255,255,255,.7)';
  ctx.lineWidth = 2;
  for (let gx = x; gx <= x + w + 1; gx += 20) {
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + (own ? -5 : 5), y + h); ctx.stroke();
  }
  for (let gy = y; gy <= y + h + 1; gy += 13) {
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }
  ctx.restore();
}

function drawGoalFrames() {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 14;
  ctx.shadowColor = 'rgba(0,0,0,.42)';
  ctx.shadowBlur = 9;
  ctx.beginPath();
  ctx.moveTo(goalLeft, FIELD.opponentGoalY); ctx.lineTo(goalLeft, 8);
  ctx.moveTo(goalRight, FIELD.opponentGoalY); ctx.lineTo(goalRight, 8);
  ctx.moveTo(goalLeft, FIELD.opponentGoalY); ctx.lineTo(goalRight, FIELD.opponentGoalY);
  ctx.moveTo(goalLeft, FIELD.ownGoalY); ctx.lineTo(goalLeft, FIELD.height - 8);
  ctx.moveTo(goalRight, FIELD.ownGoalY); ctx.lineTo(goalRight, FIELD.height - 8);
  ctx.moveTo(goalLeft, FIELD.ownGoalY); ctx.lineTo(goalRight, FIELD.ownGoalY);
  ctx.stroke();
  ctx.restore();
}

function drawFieldGimmicks() {
  getFieldZones('ice_lane').forEach((z) => drawZone(z, '氷の通路', 'rgba(96,220,255,.2)', 'rgba(130,235,255,.78)'));
  getFieldZones('spring_pad').forEach((z) => drawZone(z, 'バネ床', 'rgba(232,255,102,.22)', 'rgba(232,255,102,.86)'));
  if (hasPlacement('goal_magnet', (p) => p.target.type === 'goal')) {
    ctx.save();
    ctx.strokeStyle = 'rgba(232,255,102,.42)';
    ctx.fillStyle = 'rgba(232,255,102,.05)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(opponentGoalCenter.x, FIELD.opponentGoalY * 0.7, 285, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawTextIcon('🧲', opponentGoalCenter.x, FIELD.opponentGoalY + 24, 28);
    ctx.restore();
  }
}

function drawZone(z, label, fill, stroke) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  roundedRect(z.x, z.y, z.w, z.h, 18);
  ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = stroke;
  ctx.font = '900 20px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(label, z.x + z.w / 2, z.y + z.h / 2 + 7);
  ctx.restore();
}

function drawPlayers() {
  [...players].sort((a, b) => a.y - b.y).forEach(drawPlayer);
}

function drawPlayer(p) {
  const effective = getEffectiveTeam(p);
  const style = p.role === 'keeper' ? TEAM.keeper : effective === 'ally' && p.baseTeam === 'enemy' ? TEAM.converted : TEAM[p.baseTeam];
  const down = elapsed < p.downUntil;
  const angle = down ? Math.PI / 2 : Math.atan2(ball.y - p.y, ball.x - p.x) + Math.PI / 2;
  const run = Math.sin(elapsed * 12 + p.x * 0.03) * 4;
  shadow(p.x, p.y, p.r * 1.15, p.r * 0.5, down ? 0.12 : 0.25);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.globalAlpha = down ? 0.62 : 1;
  ctx.strokeStyle = style.dark;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, 9); ctx.lineTo(-16, 22 + run);
  ctx.moveTo(8, 9); ctx.lineTo(16, 22 - run);
  ctx.stroke();
  ctx.fillStyle = style.socks;
  ctx.beginPath(); ctx.ellipse(-16, 24 + run, 8, 4, 0.1, 0, Math.PI * 2); ctx.ellipse(16, 24 - run, 8, 4, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = style.shorts; roundedRect(-16, -2, 32, 21, 7); ctx.fill();
  const jersey = ctx.createLinearGradient(-22, -30, 22, 18);
  jersey.addColorStop(0, '#fff'); jersey.addColorStop(0.18, style.fill); jersey.addColorStop(1, style.fill2);
  ctx.fillStyle = jersey; ctx.strokeStyle = style.stroke; ctx.lineWidth = 3.3; roundedRect(-22, -30, 44, 45, 12); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = style.stroke; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, -17); ctx.lineTo(-31, -4); ctx.moveTo(20, -17); ctx.lineTo(31, -4); ctx.stroke();
  ctx.fillStyle = style.dark; ctx.font = `900 ${p.role === 'keeper' ? 14 : 15}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.role === 'keeper' ? 'GK' : String(p.number), 0, -8);
  ctx.fillStyle = '#ffd2a7'; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -39, p.role === 'keeper' ? 12 : 10.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = down ? '#fffb91' : style.stroke;
  ctx.globalAlpha = down ? 0.54 : 0.32;
  ctx.lineWidth = down ? 3 : 2.2;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 7, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  drawPlayerBadges(p);
}

function drawPlayerBadges(p) {
  const badges = [];
  const key = playerKey(p);
  if (hasPlacement('rocket_kick', (pl) => pl.target.type === 'player' && pl.target.key === key)) badges.push('🚀');
  if (hasPlacement('pitch_blade', (pl) => pl.target.type === 'player' && pl.target.key === key)) badges.push('🗡️');
  if (hasPlacement('flag_convert', (pl) => pl.target.type === 'player' && pl.target.key === key) && elapsed < p.convertedUntil) badges.push('🇯🇵');
  if (elapsed < p.downUntil) badges.push('💫');
  badges.forEach((b, i) => badge(b, p.x + 24 + i * 18, p.y - p.r - 18));
}

function drawBall() {
  shadow(ball.x, ball.y, ball.r * 1.18, ball.r * 0.5, 0.28);
  const r = ball.r * 1.16;
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.angle);
  const shine = ctx.createRadialGradient(-r * 0.38, -r * 0.52, r * 0.18, 0, 0, r * 1.16);
  shine.addColorStop(0, '#fff'); shine.addColorStop(0.52, '#f7f7f2'); shine.addColorStop(1, '#cfd1c7');
  ctx.fillStyle = shine; ctx.strokeStyle = '#101010'; ctx.lineWidth = 2.7; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111'; pentagon(0, 0, r * 0.43, -Math.PI / 2);
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const px = Math.cos(a) * r * 0.7;
    const py = Math.sin(a) * r * 0.7;
    pentagon(px, py, r * 0.22, a + Math.PI / 5);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.29, Math.sin(a) * r * 0.29); ctx.lineTo(px, py); ctx.stroke();
  }
  ctx.restore();
  if (hasPlacement('low_friction_ball', (p) => p.target.type === 'ball')) badge('🧊', ball.x + 24, ball.y - 26);
}

function drawDropHints(gimmick) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.setLineDash([9, 7]);
  const ok = 'rgba(232,255,102,.9)';
  const ng = 'rgba(255,255,255,.22)';
  if (gimmick.allowed.includes('ball')) hintCircle(ball.x, ball.y, ball.r + 36, currentDrop?.kind === 'ball' ? ok : ng);
  for (const p of players) {
    const kind = targetKindForPlayer(p);
    hintCircle(p.x, p.y, p.r + 44, gimmick.allowed.includes(kind) ? ok : ng);
  }
  if (gimmick.allowed.includes('opponentGoal')) {
    ctx.strokeStyle = currentDrop?.kind === 'opponentGoal' ? ok : ng;
    ctx.strokeRect(goalLeft - 8, 0, goalRight - goalLeft + 16, FIELD.opponentGoalY + 98);
  }
  if (gimmick.allowed.includes('field')) {
    ctx.strokeStyle = currentDrop?.kind === 'field' ? ok : ng;
    ctx.strokeRect(34, FIELD.opponentGoalY + 98, FIELD.width - 68, FIELD.ownGoalY - FIELD.opponentGoalY - 154);
  }
  ctx.restore();
}

function drawHitboxes() {
  ctx.save();
  ctx.strokeStyle = '#fffb91';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.stroke();
  for (const p of players) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

function shadow(x, y, rx, ry, a) {
  ctx.save(); ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x + 5, y + 8, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function badge(text, x, y) { ctx.save(); ctx.fillStyle = 'rgba(2,14,10,.78)'; ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1); ctx.restore(); }
function drawTextIcon(text, x, y, size) { ctx.save(); ctx.font = `${size}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y); ctx.restore(); }
function hintCircle(x, y, r, stroke) { ctx.strokeStyle = stroke; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
function pentagon(x, y, r, rot) { ctx.beginPath(); for (let i = 0; i < 5; i += 1) { const a = rot + i * Math.PI * 2 / 5; const px = x + Math.cos(a) * r; const py = y + Math.sin(a) * r; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.fill(); }
function roundedRect(x, y, w, h, r) { const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr); ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h); ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr); ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function speed(v) { return Math.hypot(v.vx, v.vy); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function insideZone(point, z) { return point.x > z.x && point.x < z.x + z.w && point.y > z.y && point.y < z.y + z.h; }
function canTrigger(key, seconds) { const last = cooldowns.get(key) ?? -Infinity; if (elapsed - last < seconds) return false; cooldowns.set(key, elapsed); return true; }
function logOnce(key, text, seconds) { if (canTrigger(`log:${key}`, seconds)) log(text); }

function updateDebug() {
  debugTextEl.textContent = [
    `state: ${matchStateEl.textContent}`,
    `time: ${elapsed.toFixed(2)}s`,
    `ball: x=${ball.x.toFixed(1)}, y=${ball.y.toFixed(1)}`,
    `velocity: ${speed(ball).toFixed(3)} (${ball.vx.toFixed(2)}, ${ball.vy.toFixed(2)})`,
    `field: ${FIELD.width}x${FIELD.height}`,
    `goal x: ${goalLeft.toFixed(0)}-${goalRight.toFixed(0)}`,
    `cost: ${getCost()}/${COST_LIMIT}`,
    `placements: ${placements.length}`,
    `engine: built-in deterministic 2D`,
    `hitbox: ${showHitboxes ? 'ON' : 'OFF'}`,
  ].join('\n');
}

function loop(now = performance.now()) {
  const delta = Math.min((now - lastTs) / 1000, 0.1);
  lastTs = now;
  if (running && !ended) {
    accumulator += delta * SPEEDS[speedIndex];
    while (accumulator >= FIELD.fixedStep) {
      step(FIELD.fixedStep);
      accumulator -= FIELD.fixedStep;
      if (ended) break;
    }
  }
  updateHud();
  draw();
  updateDebug();
  requestAnimationFrame(loop);
}

kickBtn.addEventListener('click', kick);
pauseBtn.addEventListener('click', () => {
  if (ended) return;
  running = !running;
  matchStateEl.textContent = running ? '試合中' : '一時停止';
  pauseBtn.textContent = running ? '一時停止' : '再開';
  updateHud();
});
retryBtn.addEventListener('click', resetWorld);
speedBtn.addEventListener('click', () => { speedIndex = (speedIndex + 1) % SPEEDS.length; updateHud(); });
presetBtn.addEventListener('click', applyPreset);
clearGimmicksBtn.addEventListener('click', () => clearPlacements(false));
angleInput.addEventListener('input', updateKickLabels);
powerInput.addEventListener('input', updateKickLabels);
hitboxBtn.addEventListener('click', () => { showHitboxes = !showHitboxes; draw(); });
forceGoalBtn.addEventListener('click', () => finish('goal'));
forceOwnGoalBtn.addEventListener('click', () => finish('ownGoal'));
stepBtn.addEventListener('click', () => { if (!running && !ended) { step(FIELD.fixedStep); draw(); updateDebug(); } });

updateKickLabels();
applyPreset();
resetWorld();
requestAnimationFrame(loop);
