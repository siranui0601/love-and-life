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
const SPEEDS = [1, 2, 0.5];
const goalLeft = FIELD.width * (1 - FIELD.opponentGoalWidthRatio) / 2;
const goalRight = FIELD.width * (1 + FIELD.opponentGoalWidthRatio) / 2;
const opponentGoalCenter = Object.freeze({ x: FIELD.width / 2, y: FIELD.opponentGoalLineY * 0.45 });
const ownGoalCenter = Object.freeze({ x: FIELD.width / 2, y: FIELD.ownGoalLineY + 48 });

const FIXED_GIMMICKS = Object.freeze([
  {
    id: 'rocket_kick',
    icon: '🚀🦵',
    name: 'ロケットキック',
    cost: 6,
    attachLabel: '味方選手/GK',
    summary: '味方がボールに触れた瞬間、相手ゴール方向へ強く蹴り出す。',
    targets: ['allyPlayer', 'allyKeeper'],
  },
  {
    id: 'low_friction_ball',
    icon: '🧊⚽',
    name: '低摩擦ボール',
    cost: 4,
    attachLabel: 'ボール',
    summary: 'ボールの空気抵抗と摩擦を下げ、転がりを長く保つ。',
    targets: ['ball'],
  },
  {
    id: 'spring_pad',
    icon: '🟩🦘',
    name: 'バネ床',
    cost: 5,
    attachLabel: 'コート',
    summary: '設置した床を踏んだボールを相手ゴール方向へ跳ね上げる。',
    targets: ['field'],
  },
  {
    id: 'goal_magnet',
    icon: '🥅🧲',
    name: '吸引ゴール',
    cost: 7,
    attachLabel: '相手ゴール',
    summary: 'ゴール付近に入ったボールを、ネット中央へじわっと引き寄せる。',
    targets: ['opponentGoal'],
  },
  {
    id: 'flag_convert',
    icon: '🇯🇵🏃',
    name: '寝返り日の丸',
    cost: 8,
    attachLabel: '敵選手',
    summary: '装着した敵選手を一定時間だけ味方扱いにする。',
    targets: ['enemyPlayer'],
  },
  {
    id: 'pitch_blade',
    icon: '🗡️',
    name: 'ピッチ刀',
    cost: 5,
    attachLabel: '味方選手',
    summary: '装着した味方の近くに敵が来ると、短時間ダウンさせて押し返す。',
    targets: ['allyPlayer'],
  },
  {
    id: 'ice_lane',
    icon: '🧊🛣️',
    name: '氷の通路',
    cost: 5,
    attachLabel: 'コート',
    summary: '設置した範囲を低抵抗ゾーンにして、通過中の減速を抑える。',
    targets: ['field'],
  },
]);

const TEAM = Object.freeze({
  ally: {
    fill: '#f7f7ff', fill2: '#dce7ff', stroke: '#2368f3', dark: '#0f3f9f', label: '味', shorts: '#1742a5', socks: '#f7f7ff',
  },
  enemy: {
    fill: '#ffe9e9', fill2: '#ffc9c9', stroke: '#e23b3b', dark: '#a91515', label: '敵', shorts: '#8f1111', socks: '#fff1f1',
  },
  converted: {
    fill: '#eefcff', fill2: '#bff7da', stroke: '#24b86e', dark: '#086a3b', label: '寝', shorts: '#0b7a45', socks: '#f7fff8',
  },
  keeper: {
    fill: '#fff1b5', fill2: '#ffd36b', stroke: '#d49300', dark: '#8c5f00', label: 'GK', shorts: '#57451d', socks: '#fff1b5',
  },
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
const placementListEl = document.querySelector('#placementList');
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
let selectedGimmickId = null;
let dragState = null;
let hoverTarget = null;
let effectCooldowns = new Map();

function getGimmick(id) {
  return FIXED_GIMMICKS.find((g) => g.id === id);
}

function getActiveCost() {
  return placements.reduce((sum, placement) => sum + getGimmick(placement.gimmickId).cost, 0);
}

function countPlacements(gimmickId) {
  return placements.filter((p) => p.gimmickId === gimmickId).length;
}

function isGimmickActive(id) {
  return countPlacements(id) > 0;
}

function getPlayerById(playerId) {
  return players.find((p) => p.game.id === playerId) ?? null;
}

function getPlayerLabel(player) {
  if (!player?.game) return '対象不明';
  if (player.game.role === 'keeper') return player.game.baseTeam === 'ally' ? '味方GK' : '敵GK';
  return `${player.game.baseTeam === 'ally' ? '味方' : '敵'}${player.game.number}番`;
}

function describePlacementTarget(placement) {
  if (placement.targetType === 'ball') return 'ボール';
  if (placement.targetType === 'opponentGoal') return '相手ゴール';
  if (placement.targetType === 'field') return `コート(${Math.round(placement.x)},${Math.round(placement.y)})`;
  if (placement.targetType === 'player') return getPlayerLabel(getPlayerById(placement.playerId));
  return '対象不明';
}

function getPlacementsForPlayer(player, gimmickId) {
  return placements.filter((p) => p.gimmickId === gimmickId && p.targetType === 'player' && p.playerId === player.game.id);
}

function playerHasGimmick(player, gimmickId) {
  return getPlacementsForPlayer(player, gimmickId).length > 0;
}

function updateKickButtonState() {
  kickBtn.disabled = getActiveCost() > COST_LIMIT || (running && !ended);
}

function log(text) {
  const time = (elapsedMs / 1000).toFixed(2);
  logs.unshift(`${time}s　${text}`);
  logs = logs.slice(0, 34);
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
  costLimitEl.textContent = String(COST_LIMIT);
  const cost = getActiveCost();
  costUsedEl.textContent = String(cost);
  costMeterEl.classList.toggle('over', cost > COST_LIMIT);
  updateKickButtonState();

  gimmickListEl.replaceChildren();
  for (const gimmick of FIXED_GIMMICKS) {
    const placed = countPlacements(gimmick.id);
    const wouldExceed = cost + gimmick.cost > COST_LIMIT;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = [
      'gimmick-item',
      selectedGimmickId === gimmick.id ? 'is-selected' : '',
      placed > 0 ? 'has-placement' : '',
      wouldExceed ? 'is-locked' : '',
    ].filter(Boolean).join(' ');
    button.setAttribute('aria-pressed', String(selectedGimmickId === gimmick.id));
    button.innerHTML = `
      <span class="gimmick-icon">${gimmick.icon}</span>
      <span class="gimmick-main">
        <strong>${gimmick.name}${placed ? ` ×${placed}` : ''}</strong>
        <small>${gimmick.attachLabel}｜${gimmick.summary}</small>
      </span>
      <span class="gimmick-cost-pill">${gimmick.cost}</span>
    `;
    button.addEventListener('pointerdown', (event) => startDragGimmick(event, gimmick.id));
    button.addEventListener('click', () => selectGimmick(gimmick.id));
    gimmickListEl.appendChild(button);
  }

  renderPlacements();
}

function renderPlacements() {
  placementListEl.replaceChildren();
  if (!placements.length) {
    const empty = document.createElement('div');
    empty.className = 'placement-empty';
    empty.textContent = '未配置。カードを選んでコート上の対象をタップ、またはカードをドラッグしてください。';
    placementListEl.appendChild(empty);
    return;
  }

  for (const placement of placements) {
    const gimmick = getGimmick(placement.gimmickId);
    const row = document.createElement('div');
    row.className = 'placement-chip';
    row.innerHTML = `<strong>${gimmick.icon} ${gimmick.name}</strong><span>${describePlacementTarget(placement)}</span><button type="button">外す</button>`;
    row.querySelector('button').addEventListener('click', () => removePlacement(placement.id));
    placementListEl.appendChild(row);
  }
}

function selectGimmick(id) {
  if (dragState?.moved) return;
  const gimmick = getGimmick(id);
  if (!gimmick) return;
  selectedGimmickId = selectedGimmickId === id ? null : id;
  log(selectedGimmickId ? `${gimmick.name}を選択。コート上の対象をタップ。` : `${gimmick.name}の選択を解除。`);
  renderGimmicks();
}

function startDragGimmick(event, gimmickId) {
  if (running && !ended) {
    log('試合中は配置を変更できません。リトライ後に調整してください。');
    return;
  }
  const gimmick = getGimmick(gimmickId);
  if (!gimmick) return;
  selectedGimmickId = gimmickId;
  dragState = {
    gimmickId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    ghost: createDragGhost(gimmick),
  };
  moveGhost(event.clientX, event.clientY);
  document.addEventListener('pointermove', moveDragGimmick);
  document.addEventListener('pointerup', endDragGimmick, { once: true });
  renderGimmicks();
}

function createDragGhost(gimmick) {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.innerHTML = `<span>${gimmick.icon}</span><span>${gimmick.name}</span>`;
  document.body.appendChild(ghost);
  return ghost;
}

function moveGhost(x, y) {
  if (!dragState?.ghost) return;
  dragState.ghost.style.left = `${x}px`;
  dragState.ghost.style.top = `${y}px`;
}

function moveDragGimmick(event) {
  if (!dragState) return;
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
  if (Math.hypot(dx, dy) > 6) dragState.moved = true;
  moveGhost(event.clientX, event.clientY);
  const point = clientToField(event.clientX, event.clientY);
  hoverTarget = point ? findDropTarget(dragState.gimmickId, point) : null;
}

function endDragGimmick(event) {
  if (!dragState) return;
  document.removeEventListener('pointermove', moveDragGimmick);
  dragState.ghost?.remove();
  const { gimmickId, moved } = dragState;
  dragState = null;
  const point = clientToField(event.clientX, event.clientY);
  if (moved && point) placeSelectedGimmick(gimmickId, point);
  hoverTarget = null;
  renderGimmicks();
}

function clientToField(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
  return {
    x: (clientX - rect.left) / rect.width * FIELD.width,
    y: (clientY - rect.top) / rect.height * FIELD.height,
  };
}

function isTargetAllowed(gimmick, targetType) {
  return gimmick.targets.includes(targetType);
}

function findNearestPlayer(point, predicate, maxDistance = 92) {
  let best = null;
  let bestDistance = Infinity;
  for (const player of players) {
    if (!predicate(player)) continue;
    const distance = Math.hypot(player.position.x - point.x, player.position.y - point.y);
    if (distance < bestDistance) {
      best = player;
      bestDistance = distance;
    }
  }
  return best && bestDistance <= maxDistance ? { player: best, distance: bestDistance } : null;
}

function findDropTarget(gimmickId, point) {
  const gimmick = getGimmick(gimmickId);
  if (!gimmick) return null;

  if (isTargetAllowed(gimmick, 'ball') && Math.hypot(ball.position.x - point.x, ball.position.y - point.y) <= 82) {
    return { targetType: 'ball', x: ball.position.x, y: ball.position.y, label: 'ボール' };
  }

  const playerTarget = findNearestPlayer(point, (player) => {
    const effective = getEffectiveTeam(player);
    if (isTargetAllowed(gimmick, 'allyKeeper') && effective === 'ally' && player.game.role === 'keeper') return true;
    if (isTargetAllowed(gimmick, 'allyPlayer') && effective === 'ally' && player.game.role === 'field') return true;
    if (isTargetAllowed(gimmick, 'enemyPlayer') && player.game.baseTeam === 'enemy' && player.game.role === 'field') return true;
    if (isTargetAllowed(gimmick, 'enemyKeeper') && player.game.baseTeam === 'enemy' && player.game.role === 'keeper') return true;
    return false;
  });
  if (playerTarget) {
    return {
      targetType: 'player',
      playerId: playerTarget.player.game.id,
      x: playerTarget.player.position.x,
      y: playerTarget.player.position.y,
      label: getPlayerLabel(playerTarget.player),
    };
  }

  if (isTargetAllowed(gimmick, 'opponentGoal') && point.y <= 240 && point.x >= goalLeft - 110 && point.x <= goalRight + 110) {
    return { targetType: 'opponentGoal', x: opponentGoalCenter.x, y: FIELD.opponentGoalLineY + 22, label: '相手ゴール' };
  }

  if (isTargetAllowed(gimmick, 'field') && point.x >= 44 && point.x <= FIELD.width - 44 && point.y >= 160 && point.y <= FIELD.ownGoalLineY - 130) {
    return { targetType: 'field', x: point.x, y: point.y, label: 'コート' };
  }

  return null;
}

function placeSelectedGimmick(gimmickId, point) {
  const gimmick = getGimmick(gimmickId);
  if (!gimmick) return;
  if (running && !ended) {
    log('試合中は配置を変更できません。');
    return;
  }
  if (getActiveCost() + gimmick.cost > COST_LIMIT) {
    log(`${gimmick.name}はコスト超過で配置できません。`);
    return;
  }
  const target = findDropTarget(gimmickId, point);
  if (!target) {
    log(`${gimmick.name}はその場所には配置できません。`);
    return;
  }
  const placement = {
    id: nextPlacementId,
    gimmickId,
    targetType: target.targetType,
    playerId: target.playerId ?? null,
    x: target.x,
    y: target.y,
  };
  nextPlacementId += 1;
  placements.push(placement);
  applyPlacementStateToBodies(true);
  log(`${gimmick.name}を${target.label}へ配置。`);
  selectedGimmickId = null;
  renderGimmicks();
}

function removePlacement(id) {
  const placement = placements.find((p) => p.id === id);
  if (!placement) return;
  if (running && !ended) {
    log('試合中は配置を変更できません。');
    return;
  }
  const gimmick = getGimmick(placement.gimmickId);
  placements = placements.filter((p) => p.id !== id);
  applyPlacementStateToBodies(false);
  log(`${gimmick.name}を外しました。`);
  renderGimmicks();
}

function clearPlacements() {
  if (running && !ended) {
    log('試合中は配置を変更できません。');
    return;
  }
  placements = [];
  selectedGimmickId = null;
  applyPlacementStateToBodies(false);
  log('ギミックを全撤去。');
  renderGimmicks();
}

function addPlacementDirect(gimmickId, target) {
  const gimmick = getGimmick(gimmickId);
  if (!gimmick || getActiveCost() + gimmick.cost > COST_LIMIT) return;
  placements.push({ id: nextPlacementId++, gimmickId, ...target });
}

function applyRecommendedPlacements() {
  if (running && !ended) {
    log('試合中は配置を変更できません。');
    return;
  }
  placements = [];
  selectedGimmickId = null;
  const ally10 = players.find((p) => p.game.baseTeam === 'ally' && p.game.role === 'field' && p.game.number === 10);
  const ally7 = players.find((p) => p.game.baseTeam === 'ally' && p.game.role === 'field' && p.game.number === 7);
  addPlacementDirect('low_friction_ball', { targetType: 'ball', x: ball.position.x, y: ball.position.y, playerId: null });
  if (ally10) addPlacementDirect('rocket_kick', { targetType: 'player', playerId: ally10.game.id, x: ally10.position.x, y: ally10.position.y });
  if (ally10) addPlacementDirect('pitch_blade', { targetType: 'player', playerId: ally10.game.id, x: ally10.position.x, y: ally10.position.y });
  if (ally7) addPlacementDirect('rocket_kick', { targetType: 'player', playerId: ally7.game.id, x: ally7.position.x, y: ally7.position.y });
  addPlacementDirect('spring_pad', { targetType: 'field', x: FIELD.width / 2, y: 760, playerId: null });
  addPlacementDirect('ice_lane', { targetType: 'field', x: FIELD.width / 2, y: 620, playerId: null });
  applyPlacementStateToBodies(true);
  log('おすすめ配置をセット。コートを見ながら調整できます。');
  renderGimmicks();
}

function resetWorld() {
  engine = Engine.create({
    enableSleeping: false,
    gravity: { x: 0, y: 0, scale: 0 },
  });
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
  applyPlacementStateToBodies(true);
  matchStateEl.textContent = '準備中';
  timerEl.textContent = '0.00s';
  pauseBtn.textContent = '一時停止';
  updateKickButtonState();
  log('中央キックオフ。敵の寄せを速くし、待機時間を減らしました。');
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

function makePlayer({ id, x, y, team, role, patrolMinX = null, patrolMaxX = null, number = 0 }) {
  const radius = role === 'keeper' ? FIELD.keeperRadius : FIELD.playerRadius;
  const body = Bodies.circle(x, y, radius, {
    label: `${team}-${role}`, restitution: 0.45, friction: 0.08, frictionAir: 0.045, density: role === 'keeper' ? 0.004 : 0.0032,
  });
  body.game = { id, team, baseTeam: team, role, home: { x, y }, patrolMinX, patrolMaxX, radius, downUntil: 0, convertedUntil: 0, number };
  players.push(body);
  return body;
}

function buildPlayers() {
  const bodies = [
    makePlayer({ id: 'ally-gk', x: FIELD.width / 2, y: FIELD.height - 154, team: 'ally', role: 'keeper', patrolMinX: goalLeft + 24, patrolMaxX: goalRight - 24, number: 1 }),
    makePlayer({ id: 'ally-7', x: 260, y: 920, team: 'ally', role: 'field', number: 7 }),
    makePlayer({ id: 'ally-10', x: 450, y: 820, team: 'ally', role: 'field', number: 10 }),
    makePlayer({ id: 'ally-11', x: 640, y: 920, team: 'ally', role: 'field', number: 11 }),
    makePlayer({ id: 'enemy-gk', x: FIELD.width / 2, y: 154, team: 'enemy', role: 'keeper', patrolMinX: goalLeft + 24, patrolMaxX: goalRight - 24, number: 1 }),
    makePlayer({ id: 'enemy-4', x: 260, y: 480, team: 'enemy', role: 'field', number: 4 }),
    makePlayer({ id: 'enemy-9', x: 450, y: 620, team: 'enemy', role: 'field', number: 9 }),
    makePlayer({ id: 'enemy-6', x: 640, y: 480, team: 'enemy', role: 'field', number: 6 }),
  ];
  World.add(engine.world, bodies);
}

function bindCollisionLogging() {
  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (labels.includes('ball') && labels.some((label) => label.includes('field') || label.includes('keeper'))) {
        const player = pair.bodyA.label === 'ball' ? pair.bodyB : pair.bodyA;
        const name = getEffectiveTeam(player) === 'ally' ? '味方側' : '敵側';
        log(`ボールが${name}の選手に接触。`);
        handleBallPlayerTouch(player);
      }
      if (labels.includes('ball') && labels.includes('leftWall')) log('左壁に接触。');
      if (labels.includes('ball') && labels.includes('rightWall')) log('右壁に接触。');
      if (labels.includes('ball') && labels.includes('bottomWallLeft')) log('自陣ゴール左の壁に接触。');
      if (labels.includes('ball') && labels.includes('bottomWallRight')) log('自陣ゴール右の壁に接触。');
    }
  });
}

function getBaseBallFrictionAir() {
  return isGimmickActive('low_friction_ball') ? 0.005 : 0.012;
}

function applyPlacementStateToBodies(isReset) {
  if (!ball) return;
  ball.friction = isGimmickActive('low_friction_ball') ? 0.008 : 0.025;
  ball.frictionAir = getBaseBallFrictionAir();
  ball.restitution = isGimmickActive('low_friction_ball') ? 0.78 : 0.72;

  for (const player of players) {
    if (player.game.baseTeam === 'enemy') player.game.convertedUntil = 0;
  }
  for (const placement of placements.filter((p) => p.gimmickId === 'flag_convert')) {
    const player = getPlayerById(placement.playerId);
    if (player) player.game.convertedUntil = 10000;
  }

  if (isReset && isGimmickActive('flag_convert')) log('寝返り日の丸：対象の敵が10秒間だけ味方扱い。');
  if (isReset && isGimmickActive('low_friction_ball')) log('低摩擦ボール：ボールの抵抗を軽減。');
}

function kick() {
  if (running && !ended) return;
  if (ended) resetWorld();
  if (getActiveCost() > COST_LIMIT) {
    log('コスト超過中はキックできません。');
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
  const effectiveTeam = getEffectiveTeam(player);
  const key = `touch_kick:${player.game.id}`;
  if (!canTrigger(key, 520)) return;

  if (effectiveTeam === 'enemy') {
    const speed = player.game.role === 'keeper' ? 12.5 : 18.4;
    Body.setVelocity(ball, aimVelocityToward(ownGoalCenter, speed));
    Body.setAngularVelocity(ball, ball.angularVelocity + 0.26);
    log(`敵${player.game.role === 'keeper' ? 'GK' : player.game.number + '番'}が自陣ゴールへ強烈に蹴り込んだ。`);
    return;
  }

  const rocketCount = getPlacementsForPlayer(player, 'rocket_kick').length;
  const speed = rocketCount > 0 ? (player.game.role === 'keeper' ? 15.2 : 18.3 + rocketCount * 1.8) : (player.game.role === 'keeper' ? 7.1 : 8.6);
  const lateralAssist = Math.max(-1.6, Math.min(1.6, (ball.position.x - player.position.x) * 0.018));
  const velocity = aimVelocityToward(opponentGoalCenter, speed);
  Body.setVelocity(ball, { x: velocity.x + lateralAssist, y: velocity.y });
  Body.setAngularVelocity(ball, ball.angularVelocity - 0.22);
  log(rocketCount > 0
    ? `${player.game.role === 'keeper' ? 'GK' : player.game.number + '番'}のロケットキック発動。`
    : `${player.game.role === 'keeper' ? 'GK' : player.game.number + '番'}が弱くクリア。`);
}

function minBallPlayerDistance() {
  return players.reduce((best, p) => Math.min(best, Vector.magnitude(Vector.sub(p.position, ball.position))), Infinity);
}

function getPlayerTuning(player) {
  const effectiveTeam = getEffectiveTeam(player);
  const isKeeper = player.game.role === 'keeper';
  const ballSpeed = Vector.magnitude(ball.velocity);
  const idleChaseBoost = ballSpeed < 5.5 && minBallPlayerDistance() > 165 ? 1.55 : 1;
  if (effectiveTeam === 'enemy') {
    return {
      baseForce: (isKeeper ? 0.000055 : 0.000145) * idleChaseBoost,
      maxSpeed: (isKeeper ? 6.2 : 10.8) * (idleChaseBoost > 1 ? 1.08 : 1),
    };
  }
  return {
    baseForce: isKeeper ? 0.000024 : 0.000022,
    maxSpeed: isKeeper ? 3.9 : 3.5,
  };
}

function updatePlayerAI() {
  for (const p of players) {
    if (elapsedMs < p.game.downUntil) {
      Body.setVelocity(p, Vector.mult(p.velocity, 0.84));
      continue;
    }
    const toBall = Vector.sub(ball.position, p.position);
    const distance = Math.max(Vector.magnitude(toBall), 1);
    const dir = Vector.div(toBall, distance);
    const isKeeper = p.game.role === 'keeper';
    const tuning = getPlayerTuning(p);
    let force = Vector.mult(dir, tuning.baseForce * p.mass);

    if (isKeeper) {
      const minX = p.game.patrolMinX;
      const maxX = p.game.patrolMaxX;
      const targetX = Math.max(minX, Math.min(maxX, ball.position.x));
      const xDir = Math.sign(targetX - p.position.x);
      force = { x: xDir * tuning.baseForce * p.mass * 1.9, y: (p.game.home.y - p.position.y) * 0.0000008 * p.mass };
      if (p.position.x < minX) Body.setPosition(p, { x: minX, y: p.position.y });
      if (p.position.x > maxX) Body.setPosition(p, { x: maxX, y: p.position.y });
    }

    Body.applyForce(p, p.position, force);
    const speed = Vector.magnitude(p.velocity);
    if (speed > tuning.maxSpeed) Body.setVelocity(p, Vector.mult(Vector.normalise(p.velocity), tuning.maxSpeed));
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
  if (isGimmickActive('goal_magnet')) applyGoalMagnet();
  if (isGimmickActive('pitch_blade')) applyPitchBlade();
  if (isBallInsideAnyZone('ice_lane')) {
    ball.frictionAir = 0.002;
    if (canTrigger('ice_lane_log', 1800)) log('氷の通路：通過中の減速を軽減。');
  }
}

function applyPostPhysicsGimmicks() {
  const spring = getBallZonePlacement('spring_pad');
  if (spring && canTrigger(`spring_pad:${spring.id}`, 900)) {
    const speed = Math.max(Vector.magnitude(ball.velocity), 9.5);
    Body.setVelocity(ball, aimVelocityToward(opponentGoalCenter, speed + 4.4));
    Body.setAngularVelocity(ball, ball.angularVelocity + 0.18);
    log('バネ床発動：ボールを相手ゴール方向へ跳ね上げた。');
  }
}

function getFieldZone(placement) {
  const base = placement.gimmickId === 'ice_lane' ? { w: 304, h: 164 } : { w: 216, h: 88 };
  return { x: placement.x - base.w / 2, y: placement.y - base.h / 2, w: base.w, h: base.h };
}

function isBallInsideZone(zone) {
  return ball.position.x > zone.x && ball.position.x < zone.x + zone.w && ball.position.y > zone.y && ball.position.y < zone.y + zone.h;
}

function isBallInsideAnyZone(gimmickId) {
  return placements.some((p) => p.gimmickId === gimmickId && p.targetType === 'field' && isBallInsideZone(getFieldZone(p)));
}

function getBallZonePlacement(gimmickId) {
  return placements.find((p) => p.gimmickId === gimmickId && p.targetType === 'field' && isBallInsideZone(getFieldZone(p))) ?? null;
}

function applyGoalMagnet() {
  const magnetCount = countPlacements('goal_magnet');
  if (magnetCount <= 0) return;
  const dx = opponentGoalCenter.x - ball.position.x;
  const dy = opponentGoalCenter.y - ball.position.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 390 || dist < 1) return;
  const pull = (1 - dist / 390) * (0.00038 + 0.00008 * Math.min(2, magnetCount - 1)) * ball.mass;
  Body.applyForce(ball, ball.position, { x: (dx / dist) * pull, y: (dy / dist) * pull });
  if (canTrigger('goal_magnet_log', 1400)) log('吸引ゴール：ネット中央へ引き寄せ中。');
}

function applyPitchBlade() {
  for (const placement of placements.filter((p) => p.gimmickId === 'pitch_blade')) {
    const bladeOwner = getPlayerById(placement.playerId);
    if (!bladeOwner || elapsedMs < bladeOwner.game.downUntil) continue;
    let target = null;
    let best = Infinity;
    for (const p of players) {
      if (getEffectiveTeam(p) === 'ally') continue;
      if (elapsedMs < p.game.downUntil) continue;
      const d = Vector.magnitude(Vector.sub(p.position, bladeOwner.position));
      if (d < best) { best = d; target = p; }
    }
    if (!target || best > 165) continue;
    if (!canTrigger(`pitch_blade:${bladeOwner.game.id}`, 1300)) continue;
    target.game.downUntil = elapsedMs + 2400;
    const away = Vector.normalise(Vector.sub(target.position, bladeOwner.position));
    Body.applyForce(target, target.position, { x: away.x * 0.018, y: away.y * 0.018 });
    log(`ピッチ刀：敵${target.game.number}番を短時間ダウン。`);
  }
}

function checkOutcome() {
  const inGoalMouth = ball.position.x > goalLeft && ball.position.x < goalRight;
  if (ball.position.y + FIELD.ballRadius < FIELD.opponentGoalLineY && inGoalMouth) {
    finish('goal');
    return;
  }
  if (ball.position.y - FIELD.ballRadius > FIELD.ownGoalLineY && inGoalMouth) {
    finish('ownGoal');
    return;
  }
  if (elapsedMs > 45000) finish('timeout');
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
  drawDropTargetHint();
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
    stripe.addColorStop(0.52, even ? 'rgba(255,255,255,.028)' : 'rgba(0,0,0,.025)');
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
    const x = (i * 137.37) % w;
    const y = (i * 241.19) % h;
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#002b18';
    ctx.fillRect(x, y, 1.2, 1.2);
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
  const topDepth = ctx.createLinearGradient(goalLeft, 0, goalRight, FIELD.opponentGoalLineY);
  topDepth.addColorStop(0, 'rgba(255,255,255,0.22)');
  topDepth.addColorStop(0.5, 'rgba(255,252,184,0.16)');
  topDepth.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = topDepth;
  ctx.fillRect(goalLeft, 0, goalRight - goalLeft, FIELD.opponentGoalLineY);
  const ownDepth = ctx.createLinearGradient(goalLeft, FIELD.ownGoalLineY, goalRight, FIELD.height);
  ownDepth.addColorStop(0, 'rgba(255,94,94,0.1)');
  ownDepth.addColorStop(1, 'rgba(255,94,94,0.34)');
  ctx.fillStyle = ownDepth;
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
  ctx.setLineDash([]);
  ctx.restore();
}

function drawFieldGimmicks() {
  for (const placement of placements) {
    if (placement.gimmickId === 'ice_lane' && placement.targetType === 'field') drawZone(getFieldZone(placement), '氷の通路', 'rgba(96, 220, 255, 0.2)', 'rgba(130, 235, 255, 0.78)');
    if (placement.gimmickId === 'spring_pad' && placement.targetType === 'field') drawZone(getFieldZone(placement), 'バネ床', 'rgba(232, 255, 102, 0.22)', 'rgba(232, 255, 102, 0.86)');
  }
  if (isGimmickActive('goal_magnet')) {
    ctx.save();
    const pulse = 1 + Math.sin(elapsedMs * 0.006) * 0.04;
    ctx.strokeStyle = 'rgba(232, 255, 102, 0.42)';
    ctx.fillStyle = 'rgba(232, 255, 102, 0.05)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(opponentGoalCenter.x, FIELD.opponentGoalLineY * 0.7, 285 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawFieldIcon('🧲', opponentGoalCenter.x, FIELD.opponentGoalLineY + 24, 28);
    ctx.restore();
  }
}

function drawDropTargetHint() {
  if (!hoverTarget) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(107,231,255,.95)';
  ctx.fillStyle = 'rgba(107,231,255,.12)';
  ctx.lineWidth = 5;
  ctx.setLineDash([12, 9]);
  if (hoverTarget.targetType === 'field') {
    roundedRectPath(hoverTarget.x - 90, hoverTarget.y - 44, 180, 88, 18);
    ctx.fill();
    ctx.stroke();
  } else if (hoverTarget.targetType === 'opponentGoal') {
    roundedRectPath(goalLeft - 12, 10, goalRight - goalLeft + 24, 110, 18);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(hoverTarget.x, hoverTarget.y, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(220,255,255,.96)';
  ctx.font = '900 20px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(hoverTarget.label, hoverTarget.x, hoverTarget.y - 64);
  ctx.restore();
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
  const postGrad = ctx.createLinearGradient(goalLeft, 0, goalRight, FIELD.opponentGoalLineY);
  postGrad.addColorStop(0, '#ffffff');
  postGrad.addColorStop(0.5, '#f7ffe8');
  postGrad.addColorStop(1, '#dfe8d8');
  ctx.strokeStyle = postGrad;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(goalLeft, FIELD.opponentGoalLineY + 2);
  ctx.lineTo(goalLeft, 8);
  ctx.moveTo(goalRight, FIELD.opponentGoalLineY + 2);
  ctx.lineTo(goalRight, 8);
  ctx.moveTo(goalLeft, FIELD.opponentGoalLineY);
  ctx.lineTo(goalRight, FIELD.opponentGoalLineY);
  ctx.stroke();
  ctx.strokeStyle = '#ffe8e8';
  ctx.beginPath();
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
  ctx.fillText('中央キックオフ / 敵の強烈カウンター', w / 2, h / 2 + 132);
  ctx.restore();
}

function drawGoalNet(x, y, w, h, kind) {
  ctx.save();
  const isOwn = kind === 'own';
  ctx.fillStyle = isOwn ? 'rgba(255,82,82,.22)' : 'rgba(255,244,170,.22)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = isOwn ? 'rgba(255,160,160,.75)' : 'rgba(255,255,255,.7)';
  ctx.lineWidth = isOwn ? 2 : 1.9;
  ctx.shadowColor = isOwn ? 'rgba(255,80,80,.18)' : 'rgba(255,255,255,.18)';
  ctx.shadowBlur = 4;
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
  const sorted = [...players].sort((a, b) => a.position.y - b.position.y);
  sorted.forEach(drawPlayer);
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
  if (isGimmickActive('low_friction_ball')) badges.push('🧊');
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
  const effectiveTeam = getEffectiveTeam(body);
  const style = role === 'keeper' ? TEAM.keeper : effectiveTeam === 'ally' && body.game.baseTeam === 'enemy' ? TEAM.converted : TEAM[body.game.baseTeam];
  const direction = Math.atan2(ball.position.y - y, ball.position.x - x);
  const run = Math.sin((elapsedMs * 0.012) + x * 0.03) * 4;
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
  ctx.moveTo(-8, 9); ctx.lineTo(-16, 22 + run);
  ctx.moveTo(8, 9); ctx.lineTo(16, 22 - run);
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
  ctx.moveTo(-20, -17); ctx.lineTo(-31, -4);
  ctx.moveTo(20, -17); ctx.lineTo(31, -4);
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
  if (playerHasGimmick(body, 'rocket_kick')) badges.push('🚀');
  if (playerHasGimmick(body, 'pitch_blade')) badges.push('🗡️');
  if (playerHasGimmick(body, 'flag_convert') && elapsedMs < body.game.convertedUntil) badges.push('🇯🇵');
  if (elapsedMs < body.game.downUntil) badges.push('💫');
  badges.forEach((badge, i) => drawTinyBadge(badge, body.position.x + 24 + i * 18, body.position.y - body.game.radius - 18));
}

function drawTinyBadge(text, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 14, 10, 0.78)';
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
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
  const { x, y } = body.position;
  ctx.save();
  ctx.strokeStyle = isDown ? '#fffb91' : style.stroke;
  ctx.lineWidth = isDown ? 3 : 2.2;
  ctx.globalAlpha = isDown ? 0.54 : 0.32;
  ctx.beginPath();
  ctx.arc(x, y, body.game.radius + 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawKeeperRange(body) {
  const { patrolMinX, patrolMaxX, home } = body.game;
  if (patrolMinX == null || patrolMaxX == null) return;
  ctx.save();
  ctx.strokeStyle = body.game.baseTeam === 'enemy' ? 'rgba(255,255,255,.2)' : 'rgba(232,249,106,.2)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(patrolMinX, home.y);
  ctx.lineTo(patrolMaxX, home.y);
  ctx.stroke();
  ctx.restore();
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
  for (const placement of placements.filter((p) => p.targetType === 'field')) {
    const zone = getFieldZone(placement);
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
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
    `ownGoalY: ${FIELD.ownGoalLineY}`,
    `cost: ${getActiveCost()}/${COST_LIMIT}`,
    `placements: ${placements.length}`,
    `selected: ${selectedGimmickId ?? 'none'}`,
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

canvas.addEventListener('pointermove', (event) => {
  const point = clientToField(event.clientX, event.clientY);
  hoverTarget = point && selectedGimmickId ? findDropTarget(selectedGimmickId, point) : null;
});
canvas.addEventListener('pointerleave', () => { if (!dragState) hoverTarget = null; });
canvas.addEventListener('pointerdown', (event) => {
  if (!selectedGimmickId) return;
  const point = clientToField(event.clientX, event.clientY);
  if (point) placeSelectedGimmick(selectedGimmickId, point);
});

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
hitboxBtn.addEventListener('click', () => { showHitboxes = !showHitboxes; });
forceGoalBtn.addEventListener('click', () => finish('goal'));
forceOwnGoalBtn.addEventListener('click', () => finish('ownGoal'));
angleInput.addEventListener('input', updateKickLabels);
powerInput.addEventListener('input', updateKickLabels);
presetBtn.addEventListener('click', applyRecommendedPlacements);
clearGimmicksBtn.addEventListener('click', clearPlacements);

updateKickLabels();
renderGimmicks();
resetWorld();
requestAnimationFrame(loop);
