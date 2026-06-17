const { Engine, World, Bodies, Body, Vector, Events } = Matter;

const FIELD = Object.freeze({
  width: 900,
  height: 1400,
  wallThickness: 48,
  opponentGoalWidthRatio: 0.3,
  opponentGoalLineY: 86,
  ownGoalLineY: 1314,
  ballRadius: 18,
  playerRadius: 26,
  keeperRadius: 30,
  fixedStepMs: 1000 / 60,
});

const COST_LIMIT = 30;
const DEFAULT_PLACEMENTS = [
  { gimmickId: 'rocket_kick', target: { type: 'player', playerKey: 'ally:field:10' } },
  { gimmickId: 'low_friction_ball', target: { type: 'ball' } },
  { gimmickId: 'spring_pad', target: { type: 'field', x: 450, y: 790 } },
  { gimmickId: 'pitch_blade', target: { type: 'player', playerKey: 'ally:field:10' } },
];

const FIXED_GIMMICKS = Object.freeze([
  {
    id: 'rocket_kick',
    icon: '🚀🦵',
    name: 'ロケットキック',
    cost: 6,
    allowedTargets: ['allyPlayer', 'goalkeeper'],
    attachLabel: '味方選手/GK',
    summary: '味方がボールに触れた瞬間、相手ゴール方向へ強く蹴り出す。',
  },
  {
    id: 'low_friction_ball',
    icon: '🧊⚽',
    name: '低摩擦ボール',
    cost: 4,
    allowedTargets: ['ball'],
    attachLabel: 'ボール',
    summary: 'ボールの空気抵抗と摩擦を下げ、転がりを長く保つ。',
  },
  {
    id: 'spring_pad',
    icon: '🟩🦘',
    name: 'バネ床',
    cost: 5,
    allowedTargets: ['field'],
    attachLabel: 'コート',
    summary: '踏んだボールを相手ゴール方向へ跳ね上げる。',
  },
  {
    id: 'goal_magnet',
    icon: '🥅🧲',
    name: '吸引ゴール',
    cost: 7,
    allowedTargets: ['opponentGoal'],
    attachLabel: '相手ゴール',
    summary: 'ゴール付近のボールを、ネット中央へじわっと引き寄せる。',
  },
  {
    id: 'flag_convert',
    icon: '🇯🇵🏃',
    name: '寝返り日の丸',
    cost: 8,
    allowedTargets: ['enemyPlayer'],
    attachLabel: '敵選手',
    summary: '装着した敵選手を一定時間だけ味方扱いにする。',
  },
  {
    id: 'pitch_blade',
    icon: '🗡️',
    name: 'ピッチ刀',
    cost: 5,
    allowedTargets: ['allyPlayer'],
    attachLabel: '味方選手',
    summary: '装着した味方の近くに敵が来ると、短時間ダウンさせて押し返す。',
  },
  {
    id: 'ice_lane',
    icon: '🧊🛣️',
    name: '氷の通路',
    cost: 5,
    allowedTargets: ['field'],
    attachLabel: 'コート',
    summary: '指定した場所を低抵抗ゾーンにして、通過中の減速を抑える。',
  },
]);

const FIELD_ZONE_SIZE = Object.freeze({
  spring_pad: { w: 216, h: 88 },
  ice_lane: { w: 304, h: 164 },
});

const TEAM = Object.freeze({
  ally: { fill: '#f7f7ff', fill2: '#dce7ff', stroke: '#2368f3', dark: '#0f3f9f', label: '味', shorts: '#1742a5', socks: '#f7f7ff' },
  enemy: { fill: '#ffe9e9', fill2: '#ffc9c9', stroke: '#e23b3b', dark: '#a91515', label: '敵', shorts: '#8f1111', socks: '#fff1f1' },
  converted: { fill: '#eefcff', fill2: '#bff7da', stroke: '#24b86e', dark: '#086a3b', label: '寝', shorts: '#0b7a45', socks: '#f7fff8' },
  keeper: { fill: '#fff1b5', fill2: '#ffd36b', stroke: '#d49300', dark: '#8c5f00', label: 'GK', shorts: '#57451d', socks: '#fff1b5' },
});

const canvas = document.querySelector('#fieldCanvas');
const ctx = canvas.getContext('2d');
const timerEl = document.querySelector('#timer');
const matchStateEl = document.querySelector('#matchState');
const debugTextEl = document.querySelector('#debugText');
const resultOverlayEl = document.querySelector('#resultOverlay');
const logListEl = document.querySelector('#logList');
const kickBtn = document.querySelector('#kickBtn');
const pauseBtn = document.querySelector('#pauseBtn');
const retryBtn = document.querySelector('#retryBtn');
const speedBtn = document.querySelector('#speedBtn');
const stepBtn = document.querySelector('#stepBtn');
const hitboxBtn = document.querySelector('#hitboxBtn');
const forceGoalBtn = document.querySelector('#forceGoalBtn');
const forceOwnGoalBtn = document.querySelector('#forceOwnGoalBtn');
const angleInput = document.querySelector('#angleInput');
const powerInput = document.querySelector('#powerInput');
const angleValue = document.querySelector('#angleValue');
const powerValue = document.querySelector('#powerValue');
const gimmickListEl = document.querySelector('#gimmickList');
const installedListEl = document.querySelector('#installedList');
const costUsedEl = document.querySelector('#costUsed');
const costLimitEl = document.querySelector('#costLimit');
const presetBtn = document.querySelector('#presetBtn');
const clearGimmicksBtn = document.querySelector('#clearGimmicksBtn');
const costMeterEl = document.querySelector('.cost-meter');

let engine;
let ball;
let walls = [];
let players = [];
let running = false;
let ended = false;
let showHitboxes = false;
let speedIndex = 0;
let elapsedMs = 0;
let lastFrameTs = performance.now();
let accumulatorMs = 0;
let logs = [];
let placements = [];
let nextPlacementId = 1;
let effectCooldowns = new Map();
let dragging = null;
let dragGhost = null;
let currentDropTarget = null;

const SPEEDS = [1, 2, 0.5];
const goalLeft = FIELD.width * (1 - FIELD.opponentGoalWidthRatio) / 2;
const goalRight = FIELD.width * (1 + FIELD.opponentGoalWidthRatio) / 2;
const opponentGoalCenter = Object.freeze({ x: FIELD.width / 2, y: FIELD.opponentGoalLineY * 0.45 });
const ownGoalCenter = Object.freeze({ x: FIELD.width / 2, y: FIELD.ownGoalLineY + 48 });

function getGimmick(id) {
  return FIXED_GIMMICKS.find((g) => g.id === id);
}

function getActiveCost() {
  return placements.reduce((sum, placement) => sum + getGimmick(placement.gimmickId).cost, 0);
}

function getPlayerKey(player) {
  return `${player.game.baseTeam}:${player.game.role}:${player.game.number}`;
}

function findPlayerByKey(key) {
  return players.find((player) => getPlayerKey(player) === key);
}

function hasPlacement(gimmickId, predicate = () => true) {
  return placements.some((placement) => placement.gimmickId === gimmickId && predicate(placement));
}

function getPlacements(gimmickId) {
  return placements.filter((placement) => placement.gimmickId === gimmickId);
}

function updateKickButtonState() {
  kickBtn.disabled = getActiveCost() > COST_LIMIT || (running && !ended);
}

function log(text) {
  const time = (elapsedMs / 1000).toFixed(2);
  logs.unshift(`${time}s　${text}`);
  logs = logs.slice(0, 30);
  renderLog();
}

function renderLog() {
  logListEl.replaceChildren();
  logs.forEach((line) => {
    const row = document.createElement('div');
    row.className = 'log-line';
    row.textContent = line;
    logListEl.appendChild(row);
  });
}

function renderGimmicks() {
  const cost = getActiveCost();
  costLimitEl.textContent = String(COST_LIMIT);
  costUsedEl.textContent = String(cost);
  costMeterEl.classList.toggle('over', cost > COST_LIMIT);
  updateKickButtonState();

  gimmickListEl.replaceChildren();
  for (const gimmick of FIXED_GIMMICKS) {
    const wouldExceed = cost + gimmick.cost > COST_LIMIT;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `gimmick-item ${wouldExceed ? 'is-locked' : ''}`;
    item.innerHTML = `
      <span class="gimmick-icon">${gimmick.icon}</span>
      <span class="gimmick-main">
        <strong>${gimmick.name}</strong>
        <small>${gimmick.attachLabel}｜${gimmick.summary}</small>
      </span>
      <span class="gimmick-cost-pill">${gimmick.cost}</span>
    `;
    item.addEventListener('pointerdown', (event) => startDrag(event, gimmick, item));
    item.addEventListener('click', () => log(`${gimmick.name}：${gimmick.attachLabel}へドラッグして装着。`));
    gimmickListEl.appendChild(item);
  }
  renderInstalled();
}

function renderInstalled() {
  installedListEl.replaceChildren();
  if (!placements.length) {
    const empty = document.createElement('div');
    empty.className = 'installed-empty';
    empty.textContent = 'まだ何も配置されていません。';
    installedListEl.appendChild(empty);
    return;
  }
  for (const placement of placements) {
    const gimmick = getGimmick(placement.gimmickId);
    const row = document.createElement('div');
    row.className = 'installed-item';
    row.innerHTML = `
      <span>
        <strong>${gimmick.icon} ${gimmick.name}</strong>
        <small>${describeTarget(placement.target)} / cost ${gimmick.cost}</small>
      </span>
      <button type="button">撤去</button>
    `;
    row.querySelector('button').addEventListener('click', () => removePlacement(placement.id));
    installedListEl.appendChild(row);
  }
}

function describeTarget(target) {
  if (target.type === 'ball') return 'ボール';
  if (target.type === 'goal') return '相手ゴール';
  if (target.type === 'field') return `コート (${Math.round(target.x)}, ${Math.round(target.y)})`;
  if (target.type === 'player') {
    const [, role, number] = target.playerKey.split(':');
    const player = findPlayerByKey(target.playerKey);
    const team = player?.game.baseTeam === 'enemy' ? '敵' : '味方';
    return `${team}${role === 'keeper' ? 'GK' : `${number}番`}`;
  }
  return '不明';
}

function addPlacement(gimmickId, target, silent = false) {
  const gimmick = getGimmick(gimmickId);
  if (!gimmick) return false;
  if (getActiveCost() + gimmick.cost > COST_LIMIT) {
    if (!silent) log(`${gimmick.name}はコスト超過で配置できない。`);
    return false;
  }
  placements.push({ id: nextPlacementId++, gimmickId, target });
  if (!silent) log(`${gimmick.name}を${describeTarget(target)}へ装着。`);
  applyGimmickStateToBodies(false);
  renderGimmicks();
  return true;
}

function removePlacement(id) {
  const placement = placements.find((item) => item.id === id);
  if (!placement) return;
  const gimmick = getGimmick(placement.gimmickId);
  placements = placements.filter((item) => item.id !== id);
  log(`${gimmick.name}を撤去。`);
  applyGimmickStateToBodies(false);
  renderGimmicks();
}

function clearPlacements(silent = false) {
  placements = [];
  nextPlacementId = 1;
  if (!silent) log('固定ギミックを全撤去。');
  applyGimmickStateToBodies(false);
  renderGimmicks();
}

function applyPreset() {
  placements = [];
  nextPlacementId = 1;
  for (const entry of DEFAULT_PLACEMENTS) addPlacement(entry.gimmickId, entry.target, true);
  log('おすすめ配置を適用。味方10番中心に反撃ラインを作成。');
  applyGimmickStateToBodies(false);
  renderGimmicks();
}

function startDrag(event, gimmick, sourceEl) {
  if (running && !ended) {
    log('試合中は装着できません。リトライ後に配置してください。');
    return;
  }
  if (getActiveCost() + gimmick.cost > COST_LIMIT) {
    log(`${gimmick.name}はコスト超過で持てない。`);
    return;
  }
  event.preventDefault();
  dragging = { gimmick, sourceEl };
  sourceEl.classList.add('is-dragging-source');
  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  dragGhost.innerHTML = `<span>${gimmick.icon}</span><span><strong>${gimmick.name}</strong><small>${gimmick.attachLabel}</small></span>`;
  document.body.appendChild(dragGhost);
  moveDragGhost(event.clientX, event.clientY);
  currentDropTarget = null;
  window.addEventListener('pointermove', handleDragMove, { passive: false });
  window.addEventListener('pointerup', handleDragEnd, { once: true });
}

function handleDragMove(event) {
  if (!dragging) return;
  event.preventDefault();
  moveDragGhost(event.clientX, event.clientY);
  const point = getFieldPointFromClient(event.clientX, event.clientY);
  currentDropTarget = point ? findDropTarget(point, dragging.gimmick) : null;
}

function handleDragEnd(event) {
  window.removeEventListener('pointermove', handleDragMove);
  if (!dragging) return;
  const point = getFieldPointFromClient(event.clientX, event.clientY);
  const target = point ? findDropTarget(point, dragging.gimmick) : null;
  if (target?.ok) addPlacement(dragging.gimmick.id, target.target);
  else log(`${dragging.gimmick.name}はそこには装着できない。`);
  dragging.sourceEl.classList.remove('is-dragging-source');
  dragGhost?.remove();
  dragging = null;
  dragGhost = null;
  currentDropTarget = null;
}

function moveDragGhost(x, y) {
  if (!dragGhost) return;
  dragGhost.style.left = `${x}px`;
  dragGhost.style.top = `${y}px`;
}

function getFieldPointFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
  return {
    x: (clientX - rect.left) / rect.width * FIELD.width,
    y: (clientY - rect.top) / rect.height * FIELD.height,
  };
}

function targetKindForPlayer(player) {
  if (player.game.role === 'keeper') return 'goalkeeper';
  return player.game.baseTeam === 'enemy' ? 'enemyPlayer' : 'allyPlayer';
}

function isTargetAllowed(gimmick, kind) {
  return gimmick.allowedTargets.includes(kind);
}

function findDropTarget(point, gimmick) {
  if (point.x < 0 || point.x > FIELD.width || point.y < 0 || point.y > FIELD.height) return { ok: false };

  if (isTargetAllowed(gimmick, 'opponentGoal') && point.x >= goalLeft && point.x <= goalRight && point.y <= FIELD.opponentGoalLineY + 95) {
    return { ok: true, kind: 'opponentGoal', target: { type: 'goal' } };
  }

  if (isTargetAllowed(gimmick, 'ball') && Math.hypot(point.x - ball.position.x, point.y - ball.position.y) <= FIELD.ballRadius + 34) {
    return { ok: true, kind: 'ball', target: { type: 'ball' } };
  }

  const closest = players
    .map((player) => ({ player, distance: Math.hypot(point.x - player.position.x, point.y - player.position.y) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (closest && closest.distance <= closest.player.game.radius + 42) {
    const kind = targetKindForPlayer(closest.player);
    if (isTargetAllowed(gimmick, kind)) return { ok: true, kind, target: { type: 'player', playerKey: getPlayerKey(closest.player) } };
    return { ok: false, kind };
  }

  if (isTargetAllowed(gimmick, 'field') && point.y > FIELD.opponentGoalLineY + 96 && point.y < FIELD.ownGoalLineY - 56) {
    const size = FIELD_ZONE_SIZE[gimmick.id] ?? { w: 180, h: 120 };
    return {
      ok: true,
      kind: 'field',
      target: {
        type: 'field',
        x: Math.max(size.w / 2 + 28, Math.min(FIELD.width - size.w / 2 - 28, point.x)),
        y: Math.max(FIELD.opponentGoalLineY + size.h / 2 + 54, Math.min(FIELD.ownGoalLineY - size.h / 2 - 54, point.y)),
      },
    };
  }

  return { ok: false };
}

function resetWorld() {
  engine = Engine.create({ enableSleeping: false, gravity: { x: 0, y: 0, scale: 0 } });
  engine.positionIterations = 8;
  engine.velocityIterations = 6;

  ended = false;
  running = false;
  elapsedMs = 0;
  accumulatorMs = 0;
  logs = [];
  players = [];
  walls = [];
  effectCooldowns = new Map();
  resultOverlayEl.classList.add('hidden');
  resultOverlayEl.replaceChildren();

  buildStaticWalls();
  buildBall();
  buildPlayers();
  bindCollisionLogging();
  applyGimmickStateToBodies(true);
  matchStateEl.textContent = '準備中';
  timerEl.textContent = '0.00s';
  pauseBtn.textContent = '一時停止';
  updateKickButtonState();
  log('中央キックオフ。敵は高速で寄せ、触れると自陣ゴールへ蹴り込みます。');
  draw();
  updateDebug();
  renderGimmicks();
}

function buildStaticWalls() {
  const t = FIELD.wallThickness;
  const leftWall = Bodies.rectangle(-t / 2, FIELD.height / 2, t, FIELD.height * 2, { isStatic: true, label: 'leftWall' });
  const rightWall = Bodies.rectangle(FIELD.width + t / 2, FIELD.height / 2, t, FIELD.height * 2, { isStatic: true, label: 'rightWall' });
  const topWallLeft = Bodies.rectangle(goalLeft / 2, FIELD.opponentGoalLineY - t / 2, goalLeft, t, { isStatic: true, label: 'topWallLeft' });
  const topWallRight = Bodies.rectangle((FIELD.width + goalRight) / 2, FIELD.opponentGoalLineY - t / 2, FIELD.width - goalRight, t, { isStatic: true, label: 'topWallRight' });
  const bottomWallLeft = Bodies.rectangle(goalLeft / 2, FIELD.ownGoalLineY + t / 2, goalLeft, t, { isStatic: true, label: 'bottomWallLeft' });
  const bottomWallRight = Bodies.rectangle((FIELD.width + goalRight) / 2, FIELD.ownGoalLineY + t / 2, FIELD.width - goalRight, t, { isStatic: true, label: 'bottomWallRight' });
  walls = [leftWall, rightWall, topWallLeft, topWallRight, bottomWallLeft, bottomWallRight];
  World.add(engine.world, walls);
}

function buildBall() {
  ball = Bodies.circle(FIELD.width / 2, FIELD.height / 2, FIELD.ballRadius, {
    label: 'ball', restitution: 0.72, friction: 0.025, frictionAir: 0.012, density: 0.0022,
  });
  Body.setVelocity(ball, { x: 0, y: 0 });
  World.add(engine.world, ball);
}

function makePlayer({ x, y, team, role, patrolMinX = null, patrolMaxX = null, number = 0 }) {
  const radius = role === 'keeper' ? FIELD.keeperRadius : FIELD.playerRadius;
  const body = Bodies.circle(x, y, radius, {
    label: `${team}-${role}`, restitution: 0.45, friction: 0.08, frictionAir: 0.05, density: role === 'keeper' ? 0.004 : 0.0032,
  });
  body.game = { team, baseTeam: team, role, home: { x, y }, patrolMinX, patrolMaxX, radius, downUntil: 0, convertedUntil: 0, number };
  players.push(body);
  return body;
}

function buildPlayers() {
  World.add(engine.world, [
    makePlayer({ x: FIELD.width / 2, y: FIELD.height - 154, team: 'ally', role: 'keeper', patrolMinX: goalLeft + 24, patrolMaxX: goalRight - 24, number: 1 }),
    makePlayer({ x: 260, y: 920, team: 'ally', role: 'field', number: 7 }),
    makePlayer({ x: 450, y: 820, team: 'ally', role: 'field', number: 10 }),
    makePlayer({ x: 640, y: 920, team: 'ally', role: 'field', number: 11 }),
    makePlayer({ x: FIELD.width / 2, y: 154, team: 'enemy', role: 'keeper', patrolMinX: goalLeft + 24, patrolMaxX: goalRight - 24, number: 1 }),
    makePlayer({ x: 260, y: 480, team: 'enemy', role: 'field', number: 4 }),
    makePlayer({ x: 450, y: 620, team: 'enemy', role: 'field', number: 9 }),
    makePlayer({ x: 640, y: 480, team: 'enemy', role: 'field', number: 6 }),
  ]);
}

function bindCollisionLogging() {
  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (labels.includes('ball') && labels.some((label) => label.includes('field') || label.includes('keeper'))) {
        const player = pair.bodyA.label === 'ball' ? pair.bodyB : pair.bodyA;
        log(`ボールが${getEffectiveTeam(player) === 'ally' ? '味方側' : '敵側'}の選手に接触。`);
        handleBallPlayerTouch(player);
      }
      if (labels.includes('ball') && labels.includes('leftWall')) log('左壁に接触。');
      if (labels.includes('ball') && labels.includes('rightWall')) log('右壁に接触。');
    }
  });
}

function getBaseBallFrictionAir() {
  return hasPlacement('low_friction_ball', (p) => p.target.type === 'ball') ? 0.005 : 0.012;
}

function applyGimmickStateToBodies(isReset) {
  if (!ball) return;
  const lowFriction = hasPlacement('low_friction_ball', (p) => p.target.type === 'ball');
  ball.friction = lowFriction ? 0.008 : 0.025;
  ball.frictionAir = getBaseBallFrictionAir();
  ball.restitution = lowFriction ? 0.78 : 0.72;

  for (const player of players) player.game.convertedUntil = 0;
  for (const placement of getPlacements('flag_convert')) {
    const player = findPlayerByKey(placement.target.playerKey);
    if (player) player.game.convertedUntil = 12000;
  }
  if (isReset && lowFriction) log('低摩擦ボール：ボールの抵抗を軽減。');
  if (isReset && getPlacements('flag_convert').length) log('寝返り日の丸：装着された敵が12秒だけ味方扱い。');
}

function kick() {
  if (running && !ended) return;
  if (ended) resetWorld();
  if (getActiveCost() > COST_LIMIT) {
    log('コスト超過中はキックできない。');
    return;
  }
  const angleDeg = Number(angleInput.value);
  const power = Number(powerInput.value) / 1000;
  const angleRad = (-90 + angleDeg) * Math.PI / 180;
  const kickoffSpeed = 6 + Number(powerInput.value) * 0.23;
  Body.setPosition(ball, { x: FIELD.width / 2, y: FIELD.height / 2 });
  Body.setVelocity(ball, { x: Math.cos(angleRad) * kickoffSpeed, y: Math.sin(angleRad) * kickoffSpeed });
  Body.setAngularVelocity(ball, angleDeg * 0.006);
  running = true;
  ended = false;
  matchStateEl.textContent = '試合中';
  updateKickButtonState();
  log(`中央キックオフ：角度 ${angleDeg}° / 威力 ${power.toFixed(3)}`);
}

function getEffectiveTeam(player) {
  if (!player?.game) return null;
  if (player.game.baseTeam === 'enemy' && elapsedMs < player.game.convertedUntil) return 'ally';
  return player.game.baseTeam;
}

function canTrigger(key, cooldownMs) {
  const last = effectCooldowns.get(key) ?? -Infinity;
  if (elapsedMs - last < cooldownMs) return false;
  effectCooldowns.set(key, elapsedMs);
  return true;
}

function aimVelocityToward(target, speed) {
  const dx = target.x - ball.position.x;
  const dy = target.y - ball.position.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  return { x: (dx / distance) * speed, y: (dy / distance) * speed };
}

function handleBallPlayerTouch(player) {
  if (!player?.game) return;
  const key = `touch_kick:${getPlayerKey(player)}`;
  if (!canTrigger(key, 620)) return;

  if (getEffectiveTeam(player) === 'enemy') {
    const speed = player.game.role === 'keeper' ? 13 : 19.5;
    Body.setVelocity(ball, aimVelocityToward(ownGoalCenter, speed));
    Body.setAngularVelocity(ball, ball.angularVelocity + 0.28);
    log(`敵${player.game.role === 'keeper' ? 'GK' : `${player.game.number}番`}が自陣ゴールへ強烈に蹴り込んだ。`);
    return;
  }

  const rocket = hasPlacement('rocket_kick', (placement) => placement.target.type === 'player' && placement.target.playerKey === getPlayerKey(player));
  const speed = rocket ? (player.game.role === 'keeper' ? 14.6 : 17.4) : (player.game.role === 'keeper' ? 7 : 8.6);
  const lateralAssist = Math.max(-1.5, Math.min(1.5, (ball.position.x - player.position.x) * 0.02));
  const velocity = aimVelocityToward(opponentGoalCenter, speed);
  Body.setVelocity(ball, { x: velocity.x + lateralAssist, y: velocity.y });
  Body.setAngularVelocity(ball, ball.angularVelocity - 0.22);
  log(rocket ? `${player.game.role === 'keeper' ? 'GK' : `${player.game.number}番`}のロケットキック発動。` : `${player.game.role === 'keeper' ? 'GK' : `${player.game.number}番`}が弱くクリア。`);
}

function getPlayerTuning(player) {
  const effectiveTeam = getEffectiveTeam(player);
  const isKeeper = player.game.role === 'keeper';
  if (effectiveTeam === 'enemy') {
    return { baseForce: isKeeper ? 0.00006 : 0.00014, maxSpeed: isKeeper ? 6.2 : 11.4 };
  }
  return { baseForce: isKeeper ? 0.000024 : 0.000022, maxSpeed: isKeeper ? 3.9 : 3.5 };
}

function updatePlayerAI() {
  for (const player of players) {
    if (elapsedMs < player.game.downUntil) {
      Body.setVelocity(player, Vector.mult(player.velocity, 0.82));
      continue;
    }
    const tuning = getPlayerTuning(player);
    const isKeeper = player.game.role === 'keeper';
    const effectiveTeam = getEffectiveTeam(player);
    const predictedBall = effectiveTeam === 'enemy'
      ? { x: ball.position.x + ball.velocity.x * 18, y: ball.position.y + ball.velocity.y * 18 }
      : ball.position;
    const toTarget = Vector.sub(predictedBall, player.position);
    const distance = Math.max(Vector.magnitude(toTarget), 1);
    const dir = Vector.div(toTarget, distance);
    let force = Vector.mult(dir, tuning.baseForce * player.mass * (effectiveTeam === 'enemy' && distance > 210 ? 1.38 : 1));

    if (isKeeper) {
      const targetX = Math.max(player.game.patrolMinX, Math.min(player.game.patrolMaxX, ball.position.x));
      const xDir = Math.sign(targetX - player.position.x);
      force = {
        x: xDir * tuning.baseForce * player.mass * 1.9,
        y: (player.game.home.y - player.position.y) * 0.0000009 * player.mass,
      };
      if (player.position.x < player.game.patrolMinX) Body.setPosition(player, { x: player.game.patrolMinX, y: player.position.y });
      if (player.position.x > player.game.patrolMaxX) Body.setPosition(player, { x: player.game.patrolMaxX, y: player.position.y });
    }

    Body.applyForce(player, player.position, force);
    const speed = Vector.magnitude(player.velocity);
    if (speed > tuning.maxSpeed) Body.setVelocity(player, Vector.mult(Vector.normalise(player.velocity), tuning.maxSpeed));
  }
}

function stepSimulation() {
  if (ended) return;
  elapsedMs += FIELD.fixedStepMs;
  applyContinuousGimmicks();
  updatePlayerAI();
  Engine.update(engine, FIELD.fixedStepMs);
  applyPostPhysicsGimmicks();
  checkOutcome();
}

function applyContinuousGimmicks() {
  ball.frictionAir = getBaseBallFrictionAir();
  if (hasPlacement('goal_magnet', (p) => p.target.type === 'goal')) applyGoalMagnet();
  applyPitchBlade();
  for (const zone of getFieldZones('ice_lane')) {
    if (isBallInsideZone(zone)) {
      ball.frictionAir = 0.002;
      if (canTrigger(`ice_lane_log:${zone.id}`, 1800)) log('氷の通路：通過中の減速を軽減。');
    }
  }
}

function applyPostPhysicsGimmicks() {
  for (const zone of getFieldZones('spring_pad')) {
    if (isBallInsideZone(zone) && canTrigger(`spring_pad:${zone.id}`, 900)) {
      const speed = Math.max(Vector.magnitude(ball.velocity), 9.5);
      Body.setVelocity(ball, aimVelocityToward(opponentGoalCenter, speed + 4.2));
      Body.setAngularVelocity(ball, ball.angularVelocity + 0.18);
      log('バネ床発動：ボールを相手ゴール方向へ跳ね上げた。');
    }
  }
}

function getFieldZones(gimmickId) {
  const size = FIELD_ZONE_SIZE[gimmickId];
  if (!size) return [];
  return getPlacements(gimmickId)
    .filter((placement) => placement.target.type === 'field')
    .map((placement) => ({ id: placement.id, x: placement.target.x - size.w / 2, y: placement.target.y - size.h / 2, w: size.w, h: size.h }));
}

function applyGoalMagnet() {
  const dx = opponentGoalCenter.x - ball.position.x;
  const dy = opponentGoalCenter.y - ball.position.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 360 || dist < 1) return;
  const pull = (1 - dist / 360) * 0.00034 * ball.mass;
  Body.applyForce(ball, ball.position, { x: (dx / dist) * pull, y: (dy / dist) * pull });
  if (canTrigger('goal_magnet_log', 1400)) log('吸引ゴール：ネット中央へ引き寄せ中。');
}

function applyPitchBlade() {
  const bladePlacements = getPlacements('pitch_blade').filter((placement) => placement.target.type === 'player');
  for (const placement of bladePlacements) {
    const owner = findPlayerByKey(placement.target.playerKey);
    if (!owner || elapsedMs < owner.game.downUntil) continue;
    let target = null;
    let best = Infinity;
    for (const player of players) {
      if (getEffectiveTeam(player) === 'ally' || elapsedMs < player.game.downUntil) continue;
      const distance = Vector.magnitude(Vector.sub(player.position, owner.position));
      if (distance < best) {
        best = distance;
        target = player;
      }
    }
    if (!target || best > 155 || !canTrigger(`pitch_blade:${placement.id}`, 1400)) continue;
    target.game.downUntil = elapsedMs + 2300;
    const away = Vector.normalise(Vector.sub(target.position, owner.position));
    Body.applyForce(target, target.position, { x: away.x * 0.016, y: away.y * 0.016 });
    log(`ピッチ刀：敵${target.game.number}番を短時間ダウン。`);
  }
}

function isBallInsideZone(zone) {
  return ball.position.x > zone.x && ball.position.x < zone.x + zone.w && ball.position.y > zone.y && ball.position.y < zone.y + zone.h;
}

function checkOutcome() {
  const inGoalMouth = ball.position.x > goalLeft && ball.position.x < goalRight;
  if (ball.position.y + FIELD.ballRadius < FIELD.opponentGoalLineY && inGoalMouth) return finish('goal');
  if (ball.position.y - FIELD.ballRadius > FIELD.ownGoalLineY && inGoalMouth) return finish('ownGoal');
  if (elapsedMs > 45000) return finish('timeout');
}

function finish(type) {
  running = false;
  ended = true;
  updateKickButtonState();
  const seconds = (elapsedMs / 1000).toFixed(2);
  if (type === 'goal') {
    matchStateEl.textContent = 'GOAL';
    showResult('GOOOOAL!', `${seconds}秒。ボール全体が相手ゴールラインを超えました。`, 'goal');
    log('相手ゴールラインを完全突破。');
  } else if (type === 'ownGoal') {
    matchStateEl.textContent = 'OWN GOAL';
    showResult('OWN GOAL', '敵に中央ゴールへ押し込まれました。細工が必要です。', 'own');
    log('自陣中央ゴールへ失点。');
  } else {
    matchStateEl.textContent = 'TIME UP';
    showResult('TIME UP', '45秒経過。第3段階では制限時間で終了します。', 'own');
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

function draw() {
  drawField();
  drawBodies();
  if (dragging) drawDropHints(dragging.gimmick);
  if (showHitboxes) drawHitboxes();
}

function drawField() {
  const w = FIELD.width;
  const h = FIELD.height;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#1a9653');
  gradient.addColorStop(0.48, '#0e7b45');
  gradient.addColorStop(1, '#064c2d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  drawGrassStripes(w, h);
  drawGrassNoise(w, h);
  drawCenterPressureShade(w, h);
  drawGoalBackdrops();
  drawGoalNet(goalLeft, 0, goalRight - goalLeft, FIELD.opponentGoalLineY, 'opponent');
  drawGoalNet(goalLeft, FIELD.ownGoalLineY, goalRight - goalLeft, h - FIELD.ownGoalLineY, 'own');
  drawPitchLines(w, h);
  drawFieldGimmicks();
  drawGoalFrames();
  drawPressureArrows(w, h);
  drawPitchLabels(w, h);
}

function drawGrassStripes(w, h) {
  ctx.save();
  for (let y = 0; y < h; y += 78) {
    const even = Math.floor(y / 78) % 2 === 0;
    const stripe = ctx.createLinearGradient(0, y, w, y + 78);
    stripe.addColorStop(0, even ? 'rgba(255,255,255,.055)' : 'rgba(0,0,0,.055)');
    stripe.addColorStop(1, even ? 'rgba(255,255,255,.012)' : 'rgba(0,0,0,.038)');
    ctx.fillStyle = stripe;
    ctx.fillRect(0, y, w, 78);
  }
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#eaffd5';
  ctx.lineWidth = 1;
  for (let x = -h; x < w; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h, h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGrassNoise(w, h) {
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 700; i += 1) {
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#002b18';
    ctx.fillRect((i * 137.37) % w, (i * 241.19) % h, 1.2, 1.2);
  }
  ctx.restore();
}

function drawCenterPressureShade(w, h) {
  ctx.save();
  const shade = ctx.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, 460);
  shade.addColorStop(0, 'rgba(255,255,255,0.04)');
  shade.addColorStop(0.55, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGoalBackdrops() {
  ctx.save();
  ctx.fillStyle = 'rgba(255,244,170,.22)';
  ctx.fillRect(goalLeft, 0, goalRight - goalLeft, FIELD.opponentGoalLineY);
  ctx.fillStyle = 'rgba(255,82,82,.22)';
  ctx.fillRect(goalLeft, FIELD.ownGoalLineY, goalRight - goalLeft, FIELD.height - FIELD.ownGoalLineY);
  ctx.restore();
}

function drawPitchLines(w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.86)';
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(0,0,0,.24)';
  ctx.shadowBlur = 4;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.beginPath();
  ctx.moveTo(18, h / 2);
  ctx.lineTo(w - 18, h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.94)';
  ctx.fill();
  ctx.strokeRect(goalLeft - 56, 18, goalRight - goalLeft + 112, 190);
  ctx.strokeRect(goalLeft - 56, h - 208, goalRight - goalLeft + 112, 190);
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.arc(w / 2, h - 130, 78, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, 130, 78, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();
  ctx.restore();
}

function drawFieldGimmicks() {
  getFieldZones('ice_lane').forEach((zone) => drawZone(zone, '氷の通路', 'rgba(96,220,255,.2)', 'rgba(130,235,255,.78)'));
  getFieldZones('spring_pad').forEach((zone) => drawZone(zone, 'バネ床', 'rgba(232,255,102,.22)', 'rgba(232,255,102,.86)'));
  if (hasPlacement('goal_magnet', (p) => p.target.type === 'goal')) {
    ctx.save();
    const pulse = 1 + Math.sin(elapsedMs * 0.006) * 0.04;
    ctx.strokeStyle = 'rgba(232,255,102,.42)';
    ctx.fillStyle = 'rgba(232,255,102,.05)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(opponentGoalCenter.x, FIELD.opponentGoalLineY * 0.7, 285 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawFieldIcon('🧲', opponentGoalCenter.x, FIELD.opponentGoalLineY + 24, 28);
    ctx.restore();
  }
}

function drawZone(zone, label, fill, stroke) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  roundedRectPath(zone.x, zone.y, zone.w, zone.h, 18);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = stroke;
  ctx.font = '900 20px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(label, zone.x + zone.w / 2, zone.y + zone.h / 2 + 7);
  ctx.restore();
}

function drawFieldIcon(text, x, y, size) {
  ctx.save();
  ctx.font = `${size}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawGoalFrames() {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.42)';
  ctx.shadowBlur = 9;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(goalLeft, FIELD.opponentGoalLineY + 2);
  ctx.lineTo(goalLeft, 8);
  ctx.moveTo(goalRight, FIELD.opponentGoalLineY + 2);
  ctx.lineTo(goalRight, 8);
  ctx.moveTo(goalLeft, FIELD.opponentGoalLineY);
  ctx.lineTo(goalRight, FIELD.opponentGoalLineY);
  ctx.moveTo(goalLeft, FIELD.ownGoalLineY - 2);
  ctx.lineTo(goalLeft, FIELD.height - 8);
  ctx.moveTo(goalRight, FIELD.ownGoalLineY - 2);
  ctx.lineTo(goalRight, FIELD.height - 8);
  ctx.moveTo(goalLeft, FIELD.ownGoalLineY);
  ctx.lineTo(goalRight, FIELD.ownGoalLineY);
  ctx.stroke();
  ctx.restore();
}

function drawPressureArrows(w, h) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#ff7777';
  ctx.fillStyle = '#ff7777';
  ctx.lineWidth = 3;
  for (const x of [330, 450, 570]) {
    const y = h / 2 + 75;
    ctx.beginPath();
    ctx.moveTo(x, y - 34);
    ctx.lineTo(x, y + 38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 11, y + 25);
    ctx.lineTo(x, y + 47);
    ctx.lineTo(x + 11, y + 25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPitchLabels(w, h) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.font = '900 22px system-ui';
  ctx.fillText('相手ゴール', w / 2, 46);
  ctx.fillStyle = 'rgba(255,188,188,.95)';
  ctx.fillText('自陣ゴール', w / 2, h - 18);
  ctx.fillStyle = 'rgba(255,255,255,.54)';
  ctx.font = '800 15px system-ui';
  ctx.fillText('中央キックオフ / 敵の高速プレス', w / 2, h / 2 + 132);
  ctx.restore();
}

function drawGoalNet(x, y, w, h, kind) {
  ctx.save();
  const isOwn = kind === 'own';
  ctx.fillStyle = isOwn ? 'rgba(255,82,82,.22)' : 'rgba(255,244,170,.22)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = isOwn ? 'rgba(255,160,160,.75)' : 'rgba(255,255,255,.7)';
  ctx.lineWidth = 2;
  for (let gx = x; gx <= x + w + 1; gx += 20) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + (isOwn ? -5 : 5), y + h);
    ctx.stroke();
  }
  for (let gy = y; gy <= y + h + 1; gy += 13) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy + Math.sin(gy * 0.08) * 3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBodies() {
  [...players].sort((a, b) => a.position.y - b.position.y).forEach(drawPlayer);
  drawBall(ball);
}

function drawGroundShadow(x, y, rx, ry, alpha = 0.25) {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x + 5, y + 8, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBall(body) {
  const { x, y } = body.position;
  const r = FIELD.ballRadius * 1.16;
  drawGroundShadow(x, y, r * 1.05, r * 0.48, 0.28);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle);
  const shine = ctx.createRadialGradient(-r * 0.38, -r * 0.52, r * 0.18, 0, 0, r * 1.16);
  shine.addColorStop(0, '#ffffff');
  shine.addColorStop(0.52, '#f7f7f2');
  shine.addColorStop(1, '#cfd1c7');
  ctx.fillStyle = shine;
  ctx.strokeStyle = '#101010';
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  drawPentagon(0, 0, r * 0.43, -Math.PI / 2);
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const px = Math.cos(a) * r * 0.7;
    const py = Math.sin(a) * r * 0.7;
    drawPentagon(px, py, r * 0.22, a + Math.PI / 5);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.29, Math.sin(a) * r * 0.29);
    ctx.lineTo(px, py);
    ctx.stroke();
  }
  ctx.restore();
  drawBallGimmickBadges(x, y);
}

function drawBallGimmickBadges(x, y) {
  const badges = [];
  if (hasPlacement('low_friction_ball', (p) => p.target.type === 'ball')) badges.push('🧊');
  badges.forEach((badge, i) => drawTinyBadge(badge, x + 24 + i * 18, y - 26));
}

function drawPentagon(x, y, radius, rotation) {
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const a = rotation + i * Math.PI * 2 / 5;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function roundedRectPath(x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
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

function drawPlayer(body) {
  const { x, y } = body.position;
  const { role, radius, number } = body.game;
  const style = role === 'keeper' ? TEAM.keeper : getEffectiveTeam(body) === 'ally' && body.game.baseTeam === 'enemy' ? TEAM.converted : TEAM[body.game.baseTeam];
  const direction = Math.atan2(ball.position.y - y, ball.position.x - x);
  const run = Math.sin((elapsedMs * 0.018) + x * 0.03) * 4;
  const isDown = elapsedMs < body.game.downUntil;
  drawGroundShadow(x, y, radius * 1.16, radius * 0.52, isDown ? 0.12 : 0.25);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(isDown ? Math.PI / 2 : direction + Math.PI / 2);
  ctx.globalAlpha = isDown ? 0.62 : 1;
  ctx.strokeStyle = style.dark;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, 9);
  ctx.lineTo(-16, 22 + run);
  ctx.moveTo(8, 9);
  ctx.lineTo(16, 22 - run);
  ctx.stroke();
  ctx.fillStyle = style.socks;
  ctx.beginPath();
  ctx.ellipse(-16, 24 + run, 8, 4, 0.1, 0, Math.PI * 2);
  ctx.ellipse(16, 24 - run, 8, 4, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = style.shorts;
  roundedRectPath(-16, -2, 32, 21, 7);
  ctx.fill();
  const jersey = ctx.createLinearGradient(-22, -30, 22, 18);
  jersey.addColorStop(0, '#ffffff');
  jersey.addColorStop(0.18, style.fill);
  jersey.addColorStop(1, style.fill2);
  ctx.fillStyle = jersey;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 3.3;
  roundedRectPath(-22, -30, 44, 45, 12);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-20, -17);
  ctx.lineTo(-31, -4);
  ctx.moveTo(20, -17);
  ctx.lineTo(31, -4);
  ctx.stroke();
  if (role === 'keeper') {
    ctx.fillStyle = '#f3f5ff';
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-34, -2, 6, 0, Math.PI * 2);
    ctx.arc(34, -2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.68)';
  ctx.fillRect(-12, -26, 5, 36);
  ctx.fillRect(7, -26, 5, 36);
  ctx.fillStyle = style.dark;
  ctx.font = `900 ${role === 'keeper' ? 14 : 15}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(role === 'keeper' ? 'GK' : String(number), 0, -8);
  const skin = ctx.createRadialGradient(-4, -40, 2, 0, -38, 13);
  skin.addColorStop(0, '#ffd9b8');
  skin.addColorStop(1, '#e9aa75');
  ctx.fillStyle = skin;
  ctx.strokeStyle = 'rgba(0,0,0,.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -39, role === 'keeper' ? 12 : 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = style.dark;
  ctx.beginPath();
  ctx.ellipse(0, -48, role === 'keeper' ? 10 : 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawPlayerHalo(body, style, isDown);
  drawPlayerGimmickBadges(body);
  if (role === 'keeper') drawKeeperRange(body);
}

function drawPlayerGimmickBadges(body) {
  const badges = [];
  const key = getPlayerKey(body);
  if (hasPlacement('rocket_kick', (p) => p.target.type === 'player' && p.target.playerKey === key)) badges.push('🚀');
  if (hasPlacement('pitch_blade', (p) => p.target.type === 'player' && p.target.playerKey === key)) badges.push('🗡️');
  if (hasPlacement('flag_convert', (p) => p.target.type === 'player' && p.target.playerKey === key) && elapsedMs < body.game.convertedUntil) badges.push('🇯🇵');
  if (elapsedMs < body.game.downUntil) badges.push('💫');
  badges.forEach((badge, i) => drawTinyBadge(badge, body.position.x + 24 + i * 18, body.position.y - body.game.radius - 18));
}

function drawTinyBadge(text, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(2,14,10,.78)';
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = '16px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function drawPlayerHalo(body, style, isDown) {
  ctx.save();
  ctx.strokeStyle = isDown ? '#fffb91' : style.stroke;
  ctx.lineWidth = isDown ? 3 : 2.2;
  ctx.globalAlpha = isDown ? 0.54 : 0.32;
  ctx.beginPath();
  ctx.arc(body.position.x, body.position.y, body.game.radius + 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawKeeperRange(body) {
  if (body.game.patrolMinX == null || body.game.patrolMaxX == null) return;
  ctx.save();
  ctx.strokeStyle = body.game.baseTeam === 'enemy' ? 'rgba(255,255,255,.2)' : 'rgba(232,249,106,.2)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(body.game.patrolMinX, body.game.home.y);
  ctx.lineTo(body.game.patrolMaxX, body.game.home.y);
  ctx.stroke();
  ctx.restore();
}

function drawDropHints(gimmick) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.setLineDash([9, 7]);
  const ok = 'rgba(232,255,102,.88)';
  const ng = 'rgba(255,255,255,.22)';
  if (gimmick.allowedTargets.includes('ball')) drawHintCircle(ball.position.x, ball.position.y, FIELD.ballRadius + 34, currentDropTarget?.kind === 'ball' ? ok : ng);
  for (const player of players) {
    const kind = targetKindForPlayer(player);
    const allowed = gimmick.allowedTargets.includes(kind);
    drawHintCircle(player.position.x, player.position.y, player.game.radius + 42, allowed ? ok : ng);
  }
  if (gimmick.allowedTargets.includes('opponentGoal')) {
    ctx.strokeStyle = currentDropTarget?.kind === 'opponentGoal' ? ok : ng;
    ctx.strokeRect(goalLeft - 8, 0, goalRight - goalLeft + 16, FIELD.opponentGoalLineY + 98);
  }
  if (gimmick.allowedTargets.includes('field')) {
    ctx.strokeStyle = currentDropTarget?.kind === 'field' ? ok : ng;
    ctx.strokeRect(34, FIELD.opponentGoalLineY + 98, FIELD.width - 68, FIELD.ownGoalLineY - FIELD.opponentGoalLineY - 154);
  }
  ctx.restore();
}

function drawHintCircle(x, y, r, stroke) {
  ctx.strokeStyle = stroke;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHitboxes() {
  ctx.save();
  ctx.strokeStyle = '#fffb91';
  ctx.lineWidth = 2;
  for (const body of [ball, ...players, ...walls]) {
    ctx.beginPath();
    const vertices = body.vertices;
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i += 1) ctx.lineTo(vertices[i].x, vertices[i].y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function updateDebug() {
  const speed = Vector.magnitude(ball.velocity);
  debugTextEl.textContent = [
    `state: ${matchStateEl.textContent}`,
    `time: ${(elapsedMs / 1000).toFixed(2)}s`,
    `ball: x=${ball.position.x.toFixed(1)}, y=${ball.position.y.toFixed(1)}`,
    `velocity: ${speed.toFixed(3)} (${ball.velocity.x.toFixed(2)}, ${ball.velocity.y.toFixed(2)})`,
    `bodies: ${engine.world.bodies.length}`,
    `fixedStep: ${FIELD.fixedStepMs.toFixed(3)}ms`,
    `field: ${FIELD.width}x${FIELD.height}`,
    `goal x: ${goalLeft.toFixed(0)}-${goalRight.toFixed(0)}`,
    `cost: ${getActiveCost()}/${COST_LIMIT}`,
    `placements: ${placements.length}`,
    `hitbox: ${showHitboxes ? 'ON' : 'OFF'}`,
  ].join('\n');
}

function loop(now = performance.now()) {
  const delta = Math.min(now - lastFrameTs, 100);
  lastFrameTs = now;
  if (running && !ended) {
    accumulatorMs += delta * SPEEDS[speedIndex];
    while (accumulatorMs >= FIELD.fixedStepMs) {
      stepSimulation();
      accumulatorMs -= FIELD.fixedStepMs;
      if (ended) break;
    }
  }
  timerEl.textContent = `${(elapsedMs / 1000).toFixed(2)}s`;
  draw();
  updateDebug();
  requestAnimationFrame(loop);
}

function updateKickLabels() {
  angleValue.textContent = `${angleInput.value}°`;
  powerValue.textContent = (Number(powerInput.value) / 1000).toFixed(3);
}

kickBtn.addEventListener('click', kick);
pauseBtn.addEventListener('click', () => {
  if (ended) return;
  running = !running;
  matchStateEl.textContent = running ? '試合中' : '一時停止';
  pauseBtn.textContent = running ? '一時停止' : '再開';
  updateKickButtonState();
});
retryBtn.addEventListener('click', resetWorld);
speedBtn.addEventListener('click', () => {
  speedIndex = (speedIndex + 1) % SPEEDS.length;
  speedBtn.textContent = `${SPEEDS[speedIndex]}x`;
});
stepBtn.addEventListener('click', () => {
  if (!running && !ended) stepSimulation();
});
hitboxBtn.addEventListener('click', () => {
  showHitboxes = !showHitboxes;
});
forceGoalBtn.addEventListener('click', () => finish('goal'));
forceOwnGoalBtn.addEventListener('click', () => finish('ownGoal'));
angleInput.addEventListener('input', updateKickLabels);
powerInput.addEventListener('input', updateKickLabels);
presetBtn.addEventListener('click', applyPreset);
clearGimmicksBtn.addEventListener('click', () => clearPlacements(false));

updateKickLabels();
applyPreset();
resetWorld();
requestAnimationFrame(loop);
