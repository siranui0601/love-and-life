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
    fill2: '#dce7ff',
    stroke: '#2368f3',
    dark: '#0f3f9f',
    label: '味',
    shorts: '#1742a5',
    socks: '#f7f7ff',
  },
  enemy: {
    fill: '#ffe9e9',
    fill2: '#ffc9c9',
    stroke: '#e23b3b',
    dark: '#a91515',
    label: '敵',
    shorts: '#8f1111',
    socks: '#fff1f1',
  },
  keeper: {
    fill: '#fff1b5',
    fill2: '#ffd36b',
    stroke: '#d49300',
    dark: '#8c5f00',
    label: 'GK',
    shorts: '#57451d',
    socks: '#fff1b5',
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

function makePlayer({ x, y, team, role, patrolMinX = null, patrolMaxX = null, number = 0 }) {
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
    number,
  };
  players.push(body);
  return body;
}

function buildPlayers() {
  const bodies = [
    makePlayer({ x: FIELD.width / 2, y: 1248, team: 'ally', role: 'keeper', patrolMinX: 130, patrolMaxX: 770, number: 1 }),
    makePlayer({ x: 260, y: 1030, team: 'ally', role: 'field', number: 7 }),
    makePlayer({ x: 450, y: 955, team: 'ally', role: 'field', number: 10 }),
    makePlayer({ x: 640, y: 1030, team: 'ally', role: 'field', number: 11 }),
    makePlayer({ x: FIELD.width / 2, y: 154, team: 'enemy', role: 'keeper', patrolMinX: goalLeft + 24, patrolMaxX: goalRight - 24, number: 1 }),
    makePlayer({ x: 260, y: 430, team: 'enemy', role: 'field', number: 4 }),
    makePlayer({ x: 450, y: 510, team: 'enemy', role: 'field', number: 9 }),
    makePlayer({ x: 640, y: 430, team: 'enemy', role: 'field', number: 6 }),
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
  gradient.addColorStop(0, '#1a9653');
  gradient.addColorStop(0.48, '#0e7b45');
  gradient.addColorStop(1, '#064c2d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  drawGrassStripes(w, h);
  drawGrassNoise(w, h);
  drawSlopeShade(w, h);
  drawGoalBackdrops();
  drawGoalNet(goalLeft, 0, goalRight - goalLeft, FIELD.opponentGoalLineY, 'opponent');
  drawGoalNet(0, FIELD.ownGoalLineY, w, h - FIELD.ownGoalLineY, 'own');
  drawPitchLines(w, h);
  drawGoalFrames();
  drawSlopeArrows(w, h);
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

function drawSlopeShade(w, h) {
  ctx.save();
  const slope = ctx.createLinearGradient(0, h * 0.36, 0, h);
  slope.addColorStop(0, 'rgba(255,255,255,0)');
  slope.addColorStop(0.72, 'rgba(0,0,0,0.12)');
  slope.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = slope;
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

  const ownDepth = ctx.createLinearGradient(0, FIELD.ownGoalLineY, 0, FIELD.height);
  ownDepth.addColorStop(0, 'rgba(255,94,94,0.08)');
  ownDepth.addColorStop(1, 'rgba(255,94,94,0.28)');
  ctx.fillStyle = ownDepth;
  ctx.fillRect(0, FIELD.ownGoalLineY, FIELD.width, FIELD.height - FIELD.ownGoalLineY);
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
  ctx.strokeRect(120, h - 240, w - 240, 222);

  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.arc(w / 2, h - 130, 78, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
  ctx.setLineDash([]);
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

  ctx.shadowBlur = 6;
  ctx.strokeStyle = '#ff7777';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(18, FIELD.ownGoalLineY);
  ctx.lineTo(FIELD.width - 18, FIELD.ownGoalLineY);
  ctx.stroke();
  ctx.restore();
}

function drawSlopeArrows(w, h) {
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#e8f96a';
  ctx.fillStyle = '#e8f96a';
  ctx.lineWidth = 3;
  for (const x of [180, 360, 540, 720]) {
    const y = h - 178;
    ctx.beginPath();
    ctx.moveTo(x, y - 42);
    ctx.lineTo(x, y + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 8);
    ctx.lineTo(x, y + 28);
    ctx.lineTo(x + 10, y + 8);
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
  ctx.fillText('自陣ゴール全面', w / 2, h - 18);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font = '800 15px system-ui';
  ctx.fillText('緩やかな下り坂', w / 2, h - 83);
  ctx.restore();
}

function drawGoalNet(x, y, w, h, kind) {
  ctx.save();
  const isOwn = kind === 'own';
  ctx.fillStyle = isOwn ? 'rgba(255,82,82,.2)' : 'rgba(255,244,170,.22)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = isOwn ? 'rgba(255,160,160,.7)' : 'rgba(255,255,255,.7)';
  ctx.lineWidth = isOwn ? 2 : 1.9;
  ctx.shadowColor = isOwn ? 'rgba(255,80,80,.18)' : 'rgba(255,255,255,.18)';
  ctx.shadowBlur = 4;
  for (let gx = x; gx <= x + w + 1; gx += isOwn ? 30 : 20) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + (isOwn ? 9 : 5), y + h);
    ctx.stroke();
  }
  for (let gy = y; gy <= y + h + 1; gy += isOwn ? 16 : 13) {
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

  ctx.strokeStyle = 'rgba(0,0,0,.34)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0.12, Math.PI * 1.35);
  ctx.stroke();
  ctx.restore();
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
  const { team, role, radius, number } = body.game;
  const style = role === 'keeper' ? TEAM.keeper : TEAM[team];
  const direction = Math.atan2(ball.position.y - y, ball.position.x - x);
  const run = Math.sin((elapsedMs * 0.012) + x * 0.03) * 4;

  drawGroundShadow(x, y, radius * 1.16, radius * 0.52, 0.25);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(direction + Math.PI / 2);

  ctx.strokeStyle = style.dark;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(-8, 9);
  ctx.lineTo(-16, 22 + run);
  ctx.moveTo(8, 9);
  ctx.lineTo(16, 22 - run);
  ctx.stroke();

  ctx.globalAlpha = 1;
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

  drawPlayerHalo(body, style);
  if (role === 'keeper') drawKeeperRange(body);
}

function drawPlayerHalo(body, style) {
  const { x, y } = body.position;
  ctx.save();
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = 0.32;
  ctx.beginPath();
  ctx.arc(x, y, body.game.radius + 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawKeeperRange(body) {
  const { patrolMinX, patrolMaxX, home } = body.game;
  if (patrolMinX == null || patrolMaxX == null) return;
  ctx.save();
  ctx.strokeStyle = body.game.team === 'enemy' ? 'rgba(255,255,255,.2)' : 'rgba(232,249,106,.2)';
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
