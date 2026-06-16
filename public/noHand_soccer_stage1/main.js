const { Engine, World, Bodies, Body, Vector, Events } = Matter;

const FIELD = Object.freeze({
  width: 900,
  height: 1400,
  wallThickness: 48,
  opponentGoalWidthRatio: 0.3,
  opponentGoalLineY: 86,
  ownGoalLineY: 1372,
  ballRadius: 18,
  playerRadius: 26,
  keeperRadius: 30,
  fixedStepMs: 1000 / 60,
  slopeForce: 0.000045,
});

const TEAM = Object.freeze({
  ally: {
    fill: '#f7f7ff',
    stroke: '#1f6feb',
    label: '味',
  },
  enemy: {
    fill: '#ffe7e7',
    stroke: '#df3030',
    label: '敵',
  },
  keeper: {
    fill: '#fff5c9',
    stroke: '#d69a00',
    label: 'GK',
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

const SPEEDS = [1, 2, 0.5];
const goalLeft = FIELD.width * (1 - FIELD.opponentGoalWidthRatio) / 2;
const goalRight = FIELD.width * (1 + FIELD.opponentGoalWidthRatio) / 2;

function log(text) {
  const time = (elapsedMs / 1000).toFixed(2);
  logs.unshift(`${time}s　${text}`);
  logs = logs.slice(0, 24);
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
  resultOverlayEl.classList.add('hidden');
  resultOverlayEl.replaceChildren();

  buildStaticWalls();
  buildBall();
  buildPlayers();
  bindCollisionLogging();
  matchStateEl.textContent = '準備中';
  timerEl.textContent = '0.00s';
  pauseBtn.textContent = '一時停止';
  kickBtn.disabled = false;
  log('配置完了。何もしなければ自陣側へ落ちる。');
  draw();
  updateDebug();
}

function buildStaticWalls() {
  const t = FIELD.wallThickness;
  const leftWall = Bodies.rectangle(-t / 2, FIELD.height / 2, t, FIELD.height * 2, {
    isStatic: true,
    label: 'leftWall',
    renderKind: 'wall',
  });
  const rightWall = Bodies.rectangle(FIELD.width + t / 2, FIELD.height / 2, t, FIELD.height * 2, {
    isStatic: true,
    label: 'rightWall',
    renderKind: 'wall',
  });

  const topWallLeft = Bodies.rectangle(goalLeft / 2, FIELD.opponentGoalLineY - t / 2, goalLeft, t, {
    isStatic: true,
    label: 'topWallLeft',
    renderKind: 'wall',
  });
  const topWallRight = Bodies.rectangle((FIELD.width + goalRight) / 2, FIELD.opponentGoalLineY - t / 2, FIELD.width - goalRight, t, {
    isStatic: true,
    label: 'topWallRight',
    renderKind: 'wall',
  });

  walls = [leftWall, rightWall, topWallLeft, topWallRight];
  World.add(engine.world, walls);
}

function buildBall() {
  ball = Bodies.circle(FIELD.width / 2, 1090, FIELD.ballRadius, {
    label: 'ball',
    restitution: 0.72,
    friction: 0.025,
    frictionAir: 0.012,
    density: 0.0022,
    renderKind: 'ball',
  });
  Body.setVelocity(ball, { x: 0, y: 0 });
  World.add(engine.world, ball);
}

function makePlayer({ x, y, team, role, patrolMinX = null, patrolMaxX = null }) {
  const radius = role === 'keeper' ? FIELD.keeperRadius : FIELD.playerRadius;
  const body = Bodies.circle(x, y, radius, {
    label: `${team}-${role}`,
    restitution: 0.45,
    friction: 0.08,
    frictionAir: 0.06,
    density: role === 'keeper' ? 0.004 : 0.0032,
    renderKind: 'player',
  });
  body.game = {
    team,
    role,
    home: { x, y },
    patrolMinX,
    patrolMaxX,
    radius,
    downUntil: 0,
  };
  players.push(body);
  return body;
}

function buildPlayers() {
  const bodies = [
    makePlayer({ x: FIELD.width / 2, y: 1248, team: 'ally', role: 'keeper', patrolMinX: 130, patrolMaxX: 770 }),
    makePlayer({ x: 260, y: 1030, team: 'ally', role: 'field' }),
    makePlayer({ x: 450, y: 955, team: 'ally', role: 'field' }),
    makePlayer({ x: 640, y: 1030, team: 'ally', role: 'field' }),
    makePlayer({ x: FIELD.width / 2, y: 154, team: 'enemy', role: 'keeper', patrolMinX: goalLeft + 24, patrolMaxX: goalRight - 24 }),
    makePlayer({ x: 260, y: 430, team: 'enemy', role: 'field' }),
    makePlayer({ x: 450, y: 510, team: 'enemy', role: 'field' }),
    makePlayer({ x: 640, y: 430, team: 'enemy', role: 'field' }),
  ];
  World.add(engine.world, bodies);
}

function bindCollisionLogging() {
  Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (labels.includes('ball') && labels.some((label) => label.includes('field'))) {
        const player = pair.bodyA.label === 'ball' ? pair.bodyB : pair.bodyA;
        const name = player.game?.team === 'ally' ? '味方選手' : '敵選手';
        log(`ボールが${name}に接触。`);
      }
      if (labels.includes('ball') && labels.includes('leftWall')) log('左壁に接触。');
      if (labels.includes('ball') && labels.includes('rightWall')) log('右壁に接触。');
    }
  });
}

function kick() {
  if (ended) resetWorld();
  const angleDeg = Number(angleInput.value);
  const power = Number(powerInput.value) / 1000;
  const angleRad = (-90 + angleDeg) * Math.PI / 180;
  const impulse = {
    x: Math.cos(angleRad) * power,
    y: Math.sin(angleRad) * power,
  };
  Body.setVelocity(ball, { x: 0, y: 0 });
  Body.setAngularVelocity(ball, 0);
  Body.applyForce(ball, ball.position, impulse);
  running = true;
  ended = false;
  matchStateEl.textContent = '試合中';
  kickBtn.disabled = true;
  log(`キック：角度 ${angleDeg}° / 威力 ${power.toFixed(3)}`);
}

function updatePlayerAI() {
  for (const p of players) {
    if (elapsedMs < p.game.downUntil) continue;
    const toBall = Vector.sub(ball.position, p.position);
    const distance = Math.max(Vector.magnitude(toBall), 1);
    const dir = Vector.div(toBall, distance);
    const isKeeper = p.game.role === 'keeper';
    const baseForce = isKeeper ? 0.000028 : 0.000022;

    let force = Vector.mult(dir, baseForce * p.mass);

    if (isKeeper) {
      const minX = p.game.patrolMinX;
      const maxX = p.game.patrolMaxX;
      const targetX = Math.max(minX, Math.min(maxX, ball.position.x));
      const xDir = Math.sign(targetX - p.position.x);
      force = { x: xDir * baseForce * p.mass * 1.6, y: (p.game.home.y - p.position.y) * 0.0000008 * p.mass };
      if (p.position.x < minX) Body.setPosition(p, { x: minX, y: p.position.y });
      if (p.position.x > maxX) Body.setPosition(p, { x: maxX, y: p.position.y });
    }

    Body.applyForce(p, p.position, force);

    const maxSpeed = isKeeper ? 4.2 : 3.6;
    const speed = Vector.magnitude(p.velocity);
    if (speed > maxSpeed) {
      Body.setVelocity(p, Vector.mult(Vector.normalise(p.velocity), maxSpeed));
    }
  }
}

function applySlopeForce() {
  Body.applyForce(ball, ball.position, { x: 0, y: FIELD.slopeForce * ball.mass });
  for (const p of players) {
    Body.applyForce(p, p.position, { x: 0, y: FIELD.slopeForce * p.mass * 0.32 });
  }
}

function stepSimulation() {
  if (ended) return;
  elapsedMs += FIELD.fixedStepMs;
  applySlopeForce();
  updatePlayerAI();
  Engine.update(engine, FIELD.fixedStepMs);
  checkOutcome();
}

function checkOutcome() {
  if (ball.position.y + FIELD.ballRadius < FIELD.opponentGoalLineY && ball.position.x > goalLeft && ball.position.x < goalRight) {
    finish('goal');
    return;
  }
  if (ball.position.y - FIELD.ballRadius > FIELD.ownGoalLineY) {
    finish('ownGoal');
    return;
  }
  if (elapsedMs > 45000) {
    finish('timeout');
  }
}

function finish(type) {
  running = false;
  ended = true;
  kickBtn.disabled = false;
  const seconds = (elapsedMs / 1000).toFixed(2);
  if (type === 'goal') {
    matchStateEl.textContent = 'GOAL';
    showResult('GOOOOAL!', `${seconds}秒。ボール全体が相手ゴールラインを超えました。`, 'goal');
    log('相手ゴールラインを完全突破。');
  } else if (type === 'ownGoal') {
    matchStateEl.textContent = 'OWN GOAL';
    showResult('OWN GOAL', '何もしないと自陣ネットへ落ちます。細工が必要です。', 'own');
    log('自陣ゴールへ落下。');
  } else {
    matchStateEl.textContent = 'TIME UP';
    showResult('TIME UP', '45秒経過。第1段階では制限時間で終了します。', 'own');
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
  gradient.addColorStop(0, '#11834b');
  gradient.addColorStop(1, '#0a5f35');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let y = 0; y < h; y += 140) {
    ctx.fillStyle = y % 280 === 0 ? '#ffffff' : '#001b12';
    ctx.fillRect(0, y, w, 70);
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, w - 32, h - 32);
  ctx.beginPath();
  ctx.moveTo(16, h / 2);
  ctx.lineTo(w - 16, h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 92, 0, Math.PI * 2);
  ctx.stroke();

  drawGoalNet(goalLeft, 0, goalRight - goalLeft, FIELD.opponentGoalLineY, 'opponent');
  drawGoalNet(0, FIELD.ownGoalLineY, w, h - FIELD.ownGoalLineY, 'own');

  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.font = '900 22px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('相手ゴール', w / 2, 44);
  ctx.fillText('自陣ゴール全面', w / 2, h - 18);

  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.font = '700 16px system-ui';
  ctx.fillText('コートは常にこちらへ緩く下る', w / 2, h - 76);
}

function drawGoalNet(x, y, w, h, kind) {
  ctx.save();
  ctx.fillStyle = kind === 'own' ? 'rgba(255,80,80,.18)' : 'rgba(255,244,170,.2)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = kind === 'own' ? 'rgba(255,120,120,.55)' : 'rgba(255,255,255,.6)';
  ctx.lineWidth = 2;
  for (let gx = x; gx <= x + w; gx += 28) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let gy = y; gy <= y + h; gy += 18) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBodies() {
  for (const p of players) drawPlayer(p);
  drawBall(ball);
}

function drawBall(body) {
  const { x, y } = body.position;
  const r = FIELD.ballRadius;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle);
  ctx.fillStyle = '#f9f9f9';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(9, -2);
  ctx.lineTo(6, 9);
  ctx.lineTo(-6, 9);
  ctx.lineTo(-9, -2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlayer(body) {
  const { x, y } = body.position;
  const { team, role, radius } = body.game;
  const style = role === 'keeper' ? TEAM.keeper : TEAM[team];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle);
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = style.stroke;
  ctx.font = `900 ${role === 'keeper' ? 16 : 15}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(role === 'keeper' ? 'GK' : TEAM[team].label, 0, 1);
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

updateKickLabels();
resetWorld();
requestAnimationFrame(loop);
