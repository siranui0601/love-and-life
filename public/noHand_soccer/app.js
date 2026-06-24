const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const $ = (selector) => document.querySelector(selector);

const els = {
  venue: $('#venueScreen'),
  gen: $('#generateScreen'),
  nav: $('#bottomNav'),
  kick: $('#kickBtn'),
  center: $('#centerBtn'),
  generate: $('#generateBtn'),
  dock: $('#gimmickDock'),
  dockList: $('#dockList'),
  fieldHelp: $('#fieldHelp'),
  coachTitle: $('#coachTitle'),
  coachText: $('#coachText'),
  round: $('#roundLabel'),
  goal: $('#goalLabel'),
  emojiCount: $('#emojiCountLabel'),
  emojiGrid: $('#emojiGrid'),
  selectedRow: $('#selectedRow'),
  modal: $('#modal'),
  modalKicker: $('#modalKicker'),
  modalTitle: $('#modalTitle'),
  modalText: $('#modalText'),
  modalPrimary: $('#modalPrimary'),
  modalSecondary: $('#modalSecondary'),
  toast: $('#toast'),
};

const WORLD = { w: 900, gravity: 0.36, wallBounce: 0.78 };
const START = { x: 450, y: 165 };
const FALLBACK_EMOJIS = ['👻','🦀','🚀','💪🏾','🧱','🥝','🧲','🏘️','🐸','🎈','🍌','🌪️','🚪','🛞','🧊','☁️','⚡','🕳️','🪜','🧵','⚙️','🛝','🦘','🪭','🪨','🔘'];
let emojiPool = [...FALLBACK_EMOJIS];

const MOTOR_META = {
  kick: { label: 'キック', icon: '🦶', color: '#ffbd59', short: '強く蹴り出す' },
  cannon: { label: '大砲', icon: '💥', color: '#ff9f5a', short: '砲撃のように飛ばす' },
  spring: { label: 'バネ', icon: '🟩', color: '#e8ff59', short: '跳ね返して浮かす' },
  wind: { label: '風', icon: '🌪️', color: '#76e4ff', short: '範囲内を押す' },
  updraft: { label: '上昇気流', icon: '☁️', color: '#ffdf70', short: '落下を持ち上げる' },
  vortex: { label: '渦', icon: '🌀', color: '#b28cff', short: '回しながら運ぶ' },
  current: { label: '流れ', icon: '〰️', color: '#76e4ff', short: 'レーン状に流す' },
  antiFall: { label: '落下補助', icon: '🪂', color: '#ffe083', short: '落下中だけ支える' },
  redirect: { label: '方向転換', icon: '↪️', color: '#9cffc1', short: '進行方向を曲げる' },
  mirror: { label: '反射', icon: '🪞', color: '#ffffff', short: '角度を反射する' },
  curve: { label: 'カーブ', icon: '🌀', color: '#b28cff', short: '軌道を曲げる' },
  rail: { label: 'レール', icon: '🛤️', color: '#ffffff', short: '線に沿わせる' },
  oneWay: { label: '一方通行', icon: '➡️', color: '#d8ffb0', short: '片方向に通す' },
  carrier: { label: '運搬', icon: '☁️', color: '#ffdf70', short: '乗せて運ぶ' },
  tether: { label: 'ひも', icon: '🧵', color: '#ff8ad1', short: 'ゆるく引っ張る' },
  orbit: { label: '周回', icon: '🪐', color: '#b28cff', short: '周囲を回らせる' },
  catchRelease: { label: '捕球放出', icon: '🧤', color: '#ffbd59', short: '受け止めて放つ' },
  pendulum: { label: '振り子', icon: '🕰️', color: '#9cffc1', short: '揺れて弾く' },
  portal: { label: 'ワープ', icon: '🚪', color: '#c8a7ff', short: '別地点へ逃がす' },
  phase: { label: '透過', icon: '👻', color: '#c8d8ff', short: 'すり抜け気味に浮かす' },
  gravityFlip: { label: '重力反転', icon: '🔄', color: '#ff8ad1', short: '一瞬だけ落下を反転' },
  slow: { label: '減速', icon: '🧊', color: '#b7d7ff', short: '勢いを整える' },
  speedFloor: { label: '最低速度', icon: '⚡', color: '#e8ff59', short: '弱い速度を補う' },
};
const MOTOR_KINDS = Object.keys(MOTOR_META);
const BODY_SHAPES = ['point', 'line', 'area', 'fan', 'gate', 'rail', 'carrier', 'arm', 'platform'];
const BODY_MOTIONS = ['none', 'spin', 'slide', 'bob', 'swing', 'orbit', 'pendulum'];

let state = freshState();
let drag = null;
let modalAction = null;
let toastTimer = null;

function freshState() {
  return {
    tab: 'venue',
    tutorial: 'intro',
    phase: 'ready',
    round: 1,
    cameraY: 0,
    runTime: 0,
    ball: makeBall(),
    goals: [{ id: 1, x: 690, y: 360, w: 116, h: 78, done: false, label: 'A' }],
    ownGoals: [],
    fieldEmojis: [],
    inventory: [],
    selected: [],
    gimmicks: [],
    placing: null,
    focusGimmick: null,
    nextGimmick: 1,
    nextGoal: 2,
    generateUnlocked: false,
    tabUnlocked: false,
    gameover: false,
    last: 0,
  };
}

function makeBall() { return { x: START.x, y: START.y, vx: 0, vy: 0, r: 18, phaseUntil: 0 }; }
function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function pick(arr, n) { return arr[Math.abs(Number(n) || 0) % arr.length]; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function toast(msg) { els.toast.textContent = msg; els.toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { els.toast.hidden = true; }, 1800); }
function setCoach(title, text) { els.coachTitle.textContent = title; els.coachText.textContent = text; }
function showHelp(text) { els.fieldHelp.textContent = text; els.fieldHelp.hidden = false; }
function hideHelp() { els.fieldHelp.hidden = true; }
function showModal(kicker, title, text, primary, action, secondary) { els.modalKicker.textContent = kicker; els.modalTitle.textContent = title; els.modalText.textContent = text; els.modalPrimary.textContent = primary; els.modalSecondary.hidden = !secondary; els.modalSecondary.textContent = secondary || ''; modalAction = action; els.modal.classList.add('is-open'); }
function closeModal() { els.modal.classList.remove('is-open'); }

async function loadEmojiCatalog() {
  try {
    const res = await fetch('./emoji_catalog_full_ja.json', { cache: 'force-cache' });
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data) ? data : Object.values(data).flat();
    const normalized = list.map((item) => (typeof item === 'string' ? item : (item.emoji || item.char || item.symbol || item.unicode || ''))).filter(Boolean);
    if (normalized.length > 30) emojiPool = normalized;
  } catch (_) {}
}

async function boot() {
  await loadEmojiCatalog();
  grantEmojis(8);
  render();
  fitCameraToGoals();
  showModal('KICK OFF', '今宵はサッカー！', 'ボールを黄色いゴールへ入れるゲームです。まずは会場を見て、下のキックオフを押そう⚽️', '会場を見る', () => { closeModal(); showHelp('下の「キックオフ」を押すとボールが動きます。黄色いGOAL Aへ入れよう。'); });
  requestAnimationFrame(loop);
}

function grantEmojis(n) { for (let i = 0; i < n; i += 1) state.inventory.push({ id: uid(), emoji: pick(emojiPool, hash(`${Date.now()}-${i}-${state.inventory.length}`)) }); }
function spawnFieldEmojis(n) { const base = hash(`field-${state.round}-${state.fieldEmojis.length}`); for (let i = 0; i < n; i += 1) state.fieldEmojis.push({ id: uid(), emoji: pick(emojiPool, base + i * 37), x: 110 + ((base + i * 91) % 680), y: 250 + ((base + i * 141) % 640), r: 20 }); }
function setTab(tab) { if (tab === 'generate' && !state.generateUnlocked) { toast('まずキックオフして、細工を解禁しよう'); return; } state.tab = tab; els.venue.classList.toggle('is-active', tab === 'venue'); els.gen.classList.toggle('is-active', tab === 'generate'); document.querySelectorAll('.tab-btn').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tab)); render(); if (tab === 'venue') fitCameraToGoals(); }

function startRun() {
  if (state.phase === 'run' || state.phase === 'between') return;
  state.gameover = false;
  resetGimmicksToHome();
  state.phase = 'run';
  state.runTime = 0;
  state.ball = makeBall();
  setCoach('キックオフ中', 'この1回のキックオフで、黄色いゴールを全部くぐろう。');
  hideHelp();
  render();
  fitCameraToGoals();
}

function trialReset(title, text) {
  state.phase = 'edit';
  state.gameover = false;
  state.runTime = 0;
  state.ball = makeBall();
  state.goals.forEach((goal) => { goal.done = false; });
  resetGimmicksToHome();
  setCoach(title || '作戦タイム', text || 'ゴールは復活しました。次のキックオフで全ゴール通過を狙おう。');
  render();
  fitCameraToGoals();
}

function resetAll() { state = freshState(); grantEmojis(8); render(); fitCameraToGoals(); showModal('KICK OFF', '今宵はサッカー！', 'ボールを黄色いゴールへ入れるゲームです。まずは会場を見て、下のキックオフを押そう⚽️', '会場を見る', () => { closeModal(); showHelp('下の「キックオフ」を押すとボールが動きます。黄色いGOAL Aへ入れよう。'); }); }
function firstFallTutorial() { state.generateUnlocked = true; state.tabUnlocked = true; els.nav.hidden = false; trialReset('落下！このままだと届かない', '下の「生成」タブで絵文字を3つ選び、ボールを助けるギミックを作ろう。'); showModal('作戦タイム', 'そうだ、細工をしよう！', 'このままだとボールは落ちます。生成タブで絵文字を3つ選んで、ゴールへ導くギミックを作ろう。', '生成タブへ', () => { closeModal(); setTab('generate'); }); state.tutorial = 'generate'; }
function ownGoalReset() { showModal('OWN GOAL', 'オウンゴール！', 'これはその試走の失敗扱い。盤面はそのまま、ゴールだけ復活して作戦タイムに戻ります。', '作戦タイムへ', () => { closeModal(); trialReset('オウンゴール。作戦タイム', '盤面は維持。次のキックオフで全ゴール通過を狙おう。'); }); }

async function generateGimmick() {
  if (state.selected.length !== 3) { toast('絵文字を3つ選んで！'); return; }
  const recipe = state.selected.map((item) => item.emoji);
  const seed = hash(recipe.join('|'));
  const fallback = buildLocalGimmick(recipe, seed);
  const generated = await requestGeminiGimmick(recipe, fallback);
  const gimmick = makeGimmickFromData({ ...fallback, ...generated }, recipe, seed);
  state.nextGimmick += 1;
  state.gimmicks.push(gimmick);
  for (const item of state.selected) { const index = state.inventory.findIndex((owned) => owned.id === item.id); if (index >= 0) state.inventory.splice(index, 1); }
  state.selected = [];
  state.placing = gimmick.id;
  state.focusGimmick = gimmick.id;
  setTab('venue');
  setCoach('ギミックを設置しよう', `${gimmick.visualLabel}：${gimmick.shortEffect}`);
  showHelp(`「${gimmick.name}」を設置できます。下のカードを押したままコートへドラッグ。`);
  if (state.tutorial === 'generate') { showModal('配置しよう', '会場へ戻った！', '下のギミックカードを押したまま、コートへドラッグして離そう。設置後は本体ドラッグで移動できます。', '配置する', () => closeModal()); state.tutorial = 'place'; }
  render();
  fitCameraToGoals();
}

function makeGimmickFromData(data, recipe, seed) {
  const motors = normalizeMotors(data.motors || data.effects || []);
  const body = normalizeBody(data.body || { shape: data.shape }, motors);
  const x = 450;
  const y = 520;
  const angle = (seed % 360) * Math.PI / 180;
  return {
    id: `g${state.nextGimmick}`,
    recipe,
    name: String(data.name || `審議中${recipe.join('')}`).slice(0, 24),
    flavor: String(data.flavor || `${recipe.join('')}から生まれたボール細工。`).slice(0, 80),
    visualLabel: String(data.visualLabel || '装置').slice(0, 12),
    shortEffect: String(data.shortEffect || summarizeMotors(motors)).slice(0, 44),
    body,
    motors,
    x,
    y,
    homeX: x,
    homeY: y,
    angle,
    homeAngle: angle,
    placed: false,
    spin: 0,
    runtime: makeRuntime(),
  };
}

function makeRuntime() { return { t: 0, cooldowns: {}, holding: false, holdUntil: 0, lastX: 0, lastY: 0, dx: 0, dy: 0 }; }
function resetGimmicksToHome() { state.gimmicks.forEach((g) => resetGimmickToHome(g)); }
function resetGimmickToHome(g) { g.x = g.homeX ?? g.x; g.y = g.homeY ?? g.y; g.angle = g.homeAngle ?? g.angle; g.spin = 0; g.runtime = makeRuntime(); g.runtime.lastX = g.x; g.runtime.lastY = g.y; }
function saveGimmickHome(g) { g.homeX = g.x; g.homeY = g.y; g.homeAngle = g.angle; }

function buildLocalGimmick(recipe, seed) {
  const first = pick(MOTOR_KINDS, seed);
  const second = pick(MOTOR_KINDS.filter((kind) => kind !== first), seed >>> 5);
  const motors = [{ kind: first, trigger: 'contact', direction: 'angle', power: 0.72, range: 0.58, duration: 0.35 }, { kind: second, trigger: 'inside', direction: 'angle', power: 0.45, range: 0.52, duration: 0.6 }];
  return { name: `審議中${recipe.join('')}`, flavor: `${recipe.join('')}から生まれたボール細工。`, visualLabel: pick(['装置', '細工', '仕掛け', 'ゲート', '足場', '流れ', '振り子'], seed >>> 8), shortEffect: summarizeMotors(motors), body: { shape: defaultShapeForMotors(motors), solid: shouldBeSolid(defaultShapeForMotors(motors), motors), size: 0.65, motion: defaultMotionForMotors(motors), motionPower: 0.55 }, motors };
}
async function requestGeminiGimmick(recipe, fallback) {
  try {
    const response = await fetch('/api/nohand-soccer/gimmick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emojis: recipe }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data || fallback;
  } catch (error) { console.warn('[noHand] Gemini gimmick fallback', error); toast('AI生成が混雑中。ローカル生成で続行します。'); return fallback; }
}
function normalizeMotors(motors) { const source = Array.isArray(motors) ? motors : []; const normalized = source.slice(0, 5).map((motor) => ({ kind: normalizeMotorKind(motor?.kind), trigger: normalizeOne(motor?.trigger, ['contact', 'inside', 'enter', 'periodic', 'timer'], 'contact'), direction: normalizeOne(motor?.direction, ['angle', 'up', 'down', 'left', 'right', 'radialIn', 'radialOut', 'tangent', 'towardNextGoal', 'awayFromBall'], 'angle'), power: clamp(Number(motor?.power ?? 0.7), 0.18, 1), range: clamp(Number(motor?.range ?? 0.55), 0.15, 1), duration: clamp(Number(motor?.duration ?? 0.4), 0.05, 2.5) })); if (!normalized.length) normalized.push({ kind: 'kick', trigger: 'contact', direction: 'angle', power: 0.74, range: 0.55, duration: 0.35 }); const strong = normalized.some((m) => ['kick', 'cannon', 'spring', 'redirect', 'portal', 'carrier', 'pendulum', 'rail'].includes(m.kind)); const sustain = normalized.some((m) => ['wind', 'updraft', 'vortex', 'current', 'tether', 'orbit', 'antiFall', 'speedFloor'].includes(m.kind)); if (!strong && !sustain) normalized.push({ kind: 'speedFloor', trigger: 'inside', direction: 'angle', power: 0.55, range: 0.6, duration: 0.5 }); if (normalized.length === 1) normalized.push({ kind: ['kick', 'cannon', 'spring'].includes(normalized[0].kind) ? 'updraft' : 'speedFloor', trigger: 'inside', direction: normalized[0].direction, power: 0.35, range: Math.max(0.45, normalized[0].range), duration: 0.6 }); return normalized.slice(0, 5); }
function normalizeMotorKind(kind) { const raw = String(kind || '').toLowerCase(); if (MOTOR_KINDS.includes(raw)) return raw; if (/cannon|gun|shoot|砲|大砲|射/.test(raw)) return 'cannon'; if (/spring|jump|bounce|バネ|跳|弾/.test(raw)) return 'spring'; if (/wind|fan|flow|風|扇|流/.test(raw)) return 'wind'; if (/updraft|lift|float|上昇|浮|雲/.test(raw)) return 'updraft'; if (/vortex|spin|twister|渦|竜巻/.test(raw)) return 'vortex'; if (/current|river|belt|流れ|水流|ベルト/.test(raw)) return 'current'; if (/fall|parachute|落下|傘/.test(raw)) return 'antiFall'; if (/redirect|turn|curve|曲|向き/.test(raw)) return 'redirect'; if (/mirror|reflect|反射|鏡/.test(raw)) return 'mirror'; if (/rail|track|レール|軌道/.test(raw)) return 'rail'; if (/carrier|lift|move|運|リフト|台車/.test(raw)) return 'carrier'; if (/tether|rope|string|糸|鎖|引/.test(raw)) return 'tether'; if (/orbit|circle|周|衛星/.test(raw)) return 'orbit'; if (/catch|hold|release|掴|捕|放/.test(raw)) return 'catchRelease'; if (/pendulum|swing|振り子|揺/.test(raw)) return 'pendulum'; if (/portal|warp|door|ワープ|扉|穴/.test(raw)) return 'portal'; if (/phase|ghost|pass|透|幽霊/.test(raw)) return 'phase'; if (/gravity|重力/.test(raw)) return 'gravityFlip'; if (/slow|brake|減速/.test(raw)) return 'slow'; if (/speed|boost|加速/.test(raw)) return 'speedFloor'; return 'kick'; }
function normalizeOne(value, allowed, fallback) { const raw = String(value || '').trim(); return allowed.includes(raw) ? raw : fallback; }
function normalizeBody(body, motors) { const inferred = defaultShapeForMotors(motors); let shape = normalizeOne(body?.shape, BODY_SHAPES, inferred); if (['line', 'platform', 'rail'].includes(shape) && !shouldBeSolid(shape, motors)) shape = inferred; const motion = normalizeOne(body?.motion, BODY_MOTIONS, body?.motion || defaultMotionForMotors(motors)); return { shape, solid: Boolean(body?.solid ?? shouldBeSolid(shape, motors)), size: clamp(Number(body?.size ?? 0.65), 0.35, 1), motion, motionPower: clamp(Number(body?.motionPower ?? 0.55), 0, 1) }; }
function defaultShapeForMotors(motors) { if (motors.some((m) => ['rail', 'mirror', 'oneWay'].includes(m.kind))) return 'rail'; if (motors.some((m) => m.kind === 'carrier')) return 'carrier'; if (motors.some((m) => m.kind === 'pendulum')) return 'arm'; if (motors.some((m) => ['portal', 'phase'].includes(m.kind))) return 'gate'; if (motors.some((m) => ['wind', 'updraft', 'vortex', 'current'].includes(m.kind))) return 'fan'; if (motors.some((m) => ['tether', 'orbit', 'antiFall', 'slow', 'speedFloor', 'curve'].includes(m.kind))) return 'area'; return 'point'; }
function defaultMotionForMotors(motors) { if (motors.some((m) => m.kind === 'pendulum')) return 'pendulum'; if (motors.some((m) => m.kind === 'carrier')) return 'slide'; if (motors.some((m) => ['vortex', 'orbit'].includes(m.kind))) return 'spin'; return 'none'; }
function shouldBeSolid(shape, motors) { return ['rail', 'platform', 'line', 'carrier', 'arm'].includes(shape) || motors.some((m) => ['mirror', 'rail', 'oneWay', 'pendulum', 'carrier'].includes(m.kind)); }
function summarizeMotors(motors) { return motors.slice(0, 3).map((m) => MOTOR_META[m.kind]?.short || '動かす').join('＋'); }

function roundClearSequence() { state.phase = 'between'; resetGimmicksToHome(); render(); showModal('GOOOOL!', 'GOOOOL！', '全ゴール通過！ 次はコートが広がり、新しいゴールが増えます。', '次へ', () => { closeModal(); animateBallHome(() => { state.round += 1; state.goals.forEach((goal) => { goal.done = false; }); const newGoal = addGoal(); render(); focusCameraOn(newGoal.y); setTimeout(() => { fitCameraToGoals(); setTimeout(() => showAfterGoalTutorial(), 450); }, 650); }); }); }
function showAfterGoalTutorial() { showModal('ROUND UP', 'ゴールが増えた！', '大丈夫、ゴールが増えただけだ！素材が足りない……？ 安心してくれ。', '素材を見る', () => { closeModal(); spawnFieldEmojis(5); render(); showModal('素材出現', '絵文字が出現した！', 'ゴールを決めると、コートに絵文字が出ます。ボールで触れると素材回収。素材3つでギミックを作り、全ゴールを完遂するんだ！', '了解', () => { closeModal(); trialReset('全ゴールをくぐろう', '黄色いゴールをすべて通過すると次ラウンド。絵文字はボールで触れると素材になります。'); }); }); }
function animateBallHome(done) { const start = { x: state.ball.x, y: state.ball.y }; const end = { ...START }; const t0 = performance.now(); function step(now) { const t = clamp((now - t0) / 650, 0, 1); const ease = 1 - Math.pow(1 - t, 3); state.ball.x = start.x + (end.x - start.x) * ease; state.ball.y = start.y + (end.y - start.y) * ease; state.ball.vx = 0; state.ball.vy = 0; draw(); if (t < 1) requestAnimationFrame(step); else done(); } requestAnimationFrame(step); }
function addGoal() { const seed = hash(`goal-${state.round}-${state.goals.length}`); const lowest = Math.max(...state.goals.map((goal) => goal.y)); const x = 120 + (seed % 660); const y = clamp(260 + ((seed >>> 4) % 760), 200, lowest + 300); const goal = { id: state.nextGoal, x, y, w: 116, h: 78, done: false, label: String.fromCharCode(64 + state.nextGoal) }; state.goals.push(goal); state.nextGoal += 1; if (state.round >= 2 && state.ownGoals.length === 0) state.ownGoals.push({ id: 'own1', x: 210, y: 1030, w: 128, h: 55 }); return goal; }
function fallLine() { return Math.max(1110, Math.max(...state.goals.map((goal) => goal.y), ...state.ownGoals.map((goal) => goal.y), 0) + 210); }
function loop(ts) { if (!state.last) state.last = ts; const dt = Math.min(0.033, (ts - state.last) / 1000); state.last = ts; update(dt); draw(); requestAnimationFrame(loop); }
function update(dt) { if (state.phase !== 'run') return; const ball = state.ball; state.runTime += dt; for (const gimmick of state.gimmicks) if (gimmick.placed) updateDeviceMotion(gimmick, dt); for (const gimmick of state.gimmicks) if (gimmick.placed) applyGimmick(gimmick, dt); ball.vy += WORLD.gravity * dt * 60; ball.vx *= 0.996; ball.vy *= 0.999; ball.x += ball.vx * dt * 60; ball.y += ball.vy * dt * 60; if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * WORLD.wallBounce; } if (ball.x > WORLD.w - ball.r) { ball.x = WORLD.w - ball.r; ball.vx = -Math.abs(ball.vx) * WORLD.wallBounce; } checkCollect(); checkGoals(); state.cameraY += (ball.y - canvas.height / (canvas.width / WORLD.w) * 0.45 - state.cameraY) * 0.08; if (ball.y > fallLine()) { if (state.tutorial === 'intro') { firstFallTutorial(); return; } trialReset('落下。作戦タイム', '落下したので、その試走のゴール通過はリセット。次のキックオフで全ゴールを狙おう。'); } if (state.runTime > 30) trialReset('30秒ゴールなし', 'その試走は終了。ギミックの場所や角度を調整しよう。'); }

function updateDeviceMotion(g, dt) { const runtime = g.runtime || makeRuntime(); g.runtime = runtime; runtime.t += dt; const t = runtime.t; const body = g.body || {}; const p = clamp(body.motionPower ?? 0.55, 0, 1); const hx = g.homeX ?? g.x; const hy = g.homeY ?? g.y; const ha = g.homeAngle ?? g.angle; const prevX = g.x; const prevY = g.y; if (body.motion === 'slide') { g.x = hx + Math.sin(t * 1.25) * (95 + 75 * p); g.y = hy; g.angle = ha; } else if (body.motion === 'bob') { g.x = hx; g.y = hy + Math.sin(t * 1.65) * (55 + 80 * p); g.angle = ha; } else if (body.motion === 'swing' || body.motion === 'pendulum') { g.x = hx; g.y = hy; g.angle = ha + Math.sin(t * 1.28) * (0.45 + 0.75 * p); } else if (body.motion === 'orbit') { const r = 40 + 80 * p; g.x = hx + Math.cos(t * 1.05) * r; g.y = hy + Math.sin(t * 1.05) * r; g.angle = ha + t * 1.05; } else if (body.motion === 'spin') { g.x = hx; g.y = hy; g.angle = ha + t * (1.2 + 2.1 * p); } else { g.x = hx; g.y = hy; g.angle = ha; } runtime.dx = g.x - prevX; runtime.dy = g.y - prevY; }
function applyGimmick(g, dt) { const ball = state.ball; const dx = ball.x - g.x; const dy = ball.y - g.y; const distance = Math.hypot(dx, dy) || 1; if (g.body?.solid && ['line', 'platform', 'rail', 'carrier', 'arm'].includes(g.body.shape)) collideLine(g.x, g.y, g.angle, bodyLength(g), bodyBounce(g), g.runtime?.dx || 0, g.runtime?.dy || 0); g.motors.forEach((motor, index) => applyMotor(g, motor, index, distance, dx, dy, dt)); }
function bodyLength(g) { return 110 + clamp(g.body?.size ?? 0.65, 0.35, 1) * 130; }
function bodyBounce(g) { return g.motors.some((m) => ['mirror', 'pendulum', 'spring'].includes(m.kind)) ? 1.14 : 0.78; }
function motorRange(motor) { return 42 + clamp(motor.range ?? 0.55, 0.15, 1) * 205; }
function motorPower(motor, base) { return base * clamp(motor.power ?? 0.7, 0.18, 1); }
function motorReady(g, index, frames = 34) { const key = `${index}`; if ((g.runtime?.cooldowns?.[key] || 0) > 0) return false; g.runtime.cooldowns[key] = frames; return true; }
function decayCooldowns(g) { Object.keys(g.runtime.cooldowns || {}).forEach((key) => { g.runtime.cooldowns[key] = Math.max(0, g.runtime.cooldowns[key] - 1); }); }
function nextGoalVector(fromX, fromY) { const next = state.goals.find((goal) => !goal.done) || state.goals[0]; if (!next) return { x: 1, y: -0.15 }; const dx = next.x - fromX; const dy = next.y - fromY; const d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; }
function motorVector(g, motor, dx, dy) { const dir = String(motor.direction || 'angle'); if (dir === 'up') return { x: 0, y: -1 }; if (dir === 'down') return { x: 0, y: 1 }; if (dir === 'left') return { x: -1, y: 0 }; if (dir === 'right') return { x: 1, y: 0 }; if (dir === 'radialIn') { const d = Math.hypot(dx, dy) || 1; return { x: -dx / d, y: -dy / d }; } if (dir === 'radialOut') { const d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; } if (dir === 'tangent') { const d = Math.hypot(dx, dy) || 1; return { x: -dy / d, y: dx / d }; } if (dir === 'towardNextGoal') return nextGoalVector(state.ball.x, state.ball.y); if (dir === 'awayFromBall') { const d = Math.hypot(dx, dy) || 1; return { x: -dx / d, y: -dy / d }; } return { x: Math.cos(g.angle), y: Math.sin(g.angle) }; }
function applyMotor(g, motor, index, distance, dx, dy, dt) { decayCooldowns(g); const ball = state.ball; const range = motorRange(motor); const near = distance < range; const contact = distance < Math.max(52, 42 + (g.body?.size || 0.65) * 34); const falloff = near ? (1 - distance / range) : 0; const v = motorVector(g, motor, dx, dy); if (motor.kind === 'kick' && contact && motorReady(g, index, 28)) { launchBall(v, motorPower(motor, 10.5), -0.45); separate(g, 68); } else if (motor.kind === 'cannon' && contact && motorReady(g, index, 42)) { launchBall(v, motorPower(motor, 13.2), -0.85); separate(g, 72); } else if (motor.kind === 'spring' && contact && motorReady(g, index, 24)) { const d = distance || 1; const mix = { x: dx / d + v.x * 0.65, y: dy / d + v.y * 0.65 - 0.25 }; normalizeLaunch(mix, motorPower(motor, 11.2)); separate(g, 72); } else if (motor.kind === 'wind' && near) addForce(v.x, v.y, motorPower(motor, 0.48) * falloff * dt * 60); else if (motor.kind === 'updraft' && near) addForce(0, -1, motorPower(motor, 0.56) * falloff * dt * 60); else if (motor.kind === 'vortex' && near) { const d = distance || 1; addForce(-dy / d, dx / d, motorPower(motor, 0.34) * falloff * dt * 60); addForce(-dx / d, -dy / d, motorPower(motor, 0.16) * falloff * dt * 60); } else if (motor.kind === 'current' && near) addForce(v.x, v.y, motorPower(motor, 0.62) * falloff * dt * 60); else if (motor.kind === 'antiFall' && near && ball.vy > 0) addForce(0, -1, motorPower(motor, 0.72) * falloff * dt * 60); else if (motor.kind === 'redirect' && contact && motorReady(g, index, 22)) { const speed = Math.max(8.2, Math.hypot(ball.vx, ball.vy) * 0.92); normalizeLaunch(v, speed * (0.75 + motor.power * 0.55)); separate(g, 66); } else if (motor.kind === 'mirror') { if (g.body?.shape !== 'line' && g.body?.shape !== 'rail') collideLine(g.x, g.y, g.angle, bodyLength(g), 1.22, g.runtime?.dx || 0, g.runtime?.dy || 0); } else if (motor.kind === 'curve' && near) addForce(-v.y, v.x, motorPower(motor, 0.26) * falloff * dt * 60); else if (motor.kind === 'rail' && near) railAssist(g, motor, falloff, dt); else if (motor.kind === 'oneWay' && contact) { const forward = ball.vx * Math.cos(g.angle) + ball.vy * Math.sin(g.angle); if (forward < 0) normalizeLaunch({ x: Math.cos(g.angle), y: Math.sin(g.angle) }, motorPower(motor, 8.4)); } else if (motor.kind === 'carrier' && contact) { ball.x += (g.runtime?.dx || 0) * 1.04; ball.y += (g.runtime?.dy || 0) * 1.04; ball.vx += (g.runtime?.dx || 0) * 0.18; ball.vy += (g.runtime?.dy || 0) * 0.18; ball.y = Math.min(ball.y, g.y - 34); } else if (motor.kind === 'tether' && near) addForce((g.x - ball.x) / 90, (g.y - ball.y) / 90, motorPower(motor, 0.28) * falloff * dt * 60); else if (motor.kind === 'orbit' && near) { const d = distance || 1; addForce(-dy / d, dx / d, motorPower(motor, 0.42) * falloff * dt * 60); } else if (motor.kind === 'catchRelease') catchRelease(g, motor, index, contact); else if (motor.kind === 'pendulum') collideLine(g.x, g.y, g.angle, bodyLength(g), 1.28, g.runtime?.dx || 0, g.runtime?.dy || 0); else if (motor.kind === 'portal' && contact && motorReady(g, index, 70)) { const out = motorVector(g, { ...motor, direction: motor.direction === 'angle' ? 'angle' : motor.direction }, dx, dy); ball.x = clamp(g.x + out.x * (190 + motor.power * 150), 60, WORLD.w - 60); ball.y = Math.max(80, g.y + out.y * (190 + motor.power * 150)); launchBall(out, motorPower(motor, 7.4), -0.6); toast('ワープ！'); } else if (motor.kind === 'phase' && contact) { ball.phaseUntil = state.runTime + motor.duration; ball.vy -= motorPower(motor, 1.8); } else if (motor.kind === 'gravityFlip' && near) addForce(0, -1, motorPower(motor, 0.88) * falloff * dt * 60); else if (motor.kind === 'slow' && near) { const k = clamp(1 - motorPower(motor, 0.034) * falloff * dt * 60, 0.74, 1); ball.vx *= k; ball.vy *= k; } else if (motor.kind === 'speedFloor' && near) { const speed = Math.hypot(ball.vx, ball.vy); if (speed < 5.8) addForce(v.x, v.y, motorPower(motor, 0.48) * (1 - speed / 5.8) * dt * 60); } }
function addForce(x, y, f) { state.ball.vx += x * f; state.ball.vy += y * f; }
function launchBall(v, speed, extraY = 0) { const vec = { x: v.x, y: v.y + extraY }; normalizeLaunch(vec, speed); }
function normalizeLaunch(v, speed) { const d = Math.hypot(v.x, v.y) || 1; state.ball.vx = v.x / d * speed; state.ball.vy = v.y / d * speed; }
function railAssist(g, motor, falloff, dt) { const ball = state.ball; const ux = Math.cos(g.angle); const uy = Math.sin(g.angle); const vx = ball.x - g.x; const vy = ball.y - g.y; const projection = clamp(vx * ux + vy * uy, -bodyLength(g) / 2, bodyLength(g) / 2); const px = g.x + ux * projection; const py = g.y + uy * projection; ball.x += (px - ball.x) * 0.12; ball.y += (py - ball.y) * 0.12; addForce(ux, uy, motorPower(motor, 0.44) * falloff * dt * 60); }
function catchRelease(g, motor, index, contact) { const ball = state.ball; if (!g.runtime.holding && contact && motorReady(g, index, 80)) { g.runtime.holding = true; g.runtime.holdUntil = state.runTime + motor.duration; ball.x = g.x; ball.y = g.y - 36; ball.vx = 0; ball.vy = 0; } if (g.runtime.holding) { ball.x = g.x; ball.y = g.y - 36; ball.vx = 0; ball.vy = 0; if (state.runTime >= g.runtime.holdUntil) { g.runtime.holding = false; launchBall(motorVector(g, motor, ball.x - g.x, ball.y - g.y), motorPower(motor, 10.4), -0.35); } } }
function separate(g, radius) { const ball = state.ball; const dx = ball.x - g.x; const dy = ball.y - g.y; const distance = Math.hypot(dx, dy) || 1; ball.x = g.x + dx / distance * radius; ball.y = g.y + dy / distance * radius; }
function collideLine(cx, cy, angle, length, bounce, moveDx = 0, moveDy = 0) { const ball = state.ball; const ux = Math.cos(angle); const uy = Math.sin(angle); const vx = ball.x - cx; const vy = ball.y - cy; const projection = clamp(vx * ux + vy * uy, -length / 2, length / 2); const px = cx + ux * projection; const py = cy + uy * projection; const dx = ball.x - px; const dy = ball.y - py; const distance = Math.hypot(dx, dy) || 1; if (distance < ball.r + 8) { const nx = dx / distance; const ny = dy / distance; const dot = ball.vx * nx + ball.vy * ny; if (dot < 0) { ball.vx -= (1 + bounce) * dot * nx; ball.vy -= (1 + bounce) * dot * ny; ball.vx += moveDx * 0.2; ball.vy += moveDy * 0.2; ball.x = px + nx * (ball.r + 9); ball.y = py + ny * (ball.r + 9); } } }
function checkCollect() { state.fieldEmojis = state.fieldEmojis.filter((emoji) => { if (Math.hypot(state.ball.x - emoji.x, state.ball.y - emoji.y) < state.ball.r + emoji.r) { state.inventory.push({ id: uid(), emoji: emoji.emoji }); toast(`素材 ${emoji.emoji} 回収`); render(); return false; } return true; }); }
function checkGoals() { for (const ownGoal of state.ownGoals) { if (inRect(state.ball, ownGoal)) { ownGoalReset(); return; } } let scored = false; for (const goal of state.goals) { if (!goal.done && inRect(state.ball, goal)) { goal.done = true; scored = true; state.ball.vy = Math.min(state.ball.vy, -5); state.ball.vx += goal.x < WORLD.w / 2 ? 2 : -2; toast(`GOAL ${goal.label}`); } } if (scored) render(); if (state.goals.every((goal) => goal.done)) roundClearSequence(); }
function inRect(ball, rect) { return Math.abs(ball.x - rect.x) < rect.w / 2 && Math.abs(ball.y - rect.y) < rect.h / 2; }

function render() { els.nav.hidden = !state.tabUnlocked; els.dock.hidden = !state.generateUnlocked || !state.gimmicks.length; els.round.textContent = `R${state.round}`; els.goal.textContent = `${state.goals.filter((goal) => goal.done).length}/${state.goals.length}`; els.emojiCount.textContent = `${state.inventory.length}個`; document.querySelector('[data-tab="generate"]').classList.toggle('is-locked', !state.generateUnlocked); renderEmojis(); renderSelected(); renderDock(); els.kick.disabled = state.phase === 'run' || state.phase === 'between'; }
function renderEmojis() { els.emojiGrid.replaceChildren(); state.inventory.forEach((item) => { const button = document.createElement('button'); button.className = 'emoji-btn'; button.textContent = item.emoji; button.type = 'button'; if (state.selected.some((selected) => selected.id === item.id)) button.classList.add('is-selected'); button.onclick = () => toggleEmoji(item); els.emojiGrid.appendChild(button); }); }
function toggleEmoji(item) { const index = state.selected.findIndex((selected) => selected.id === item.id); if (index >= 0) state.selected.splice(index, 1); else { if (state.selected.length >= 3) state.selected.shift(); state.selected.push(item); } render(); }
function renderSelected() { els.selectedRow.replaceChildren(); for (let i = 0; i < 3; i += 1) { const slot = document.createElement('button'); slot.type = 'button'; slot.className = 'slot'; if (state.selected[i]) { slot.textContent = state.selected[i].emoji; slot.onclick = () => { state.selected.splice(i, 1); render(); }; } else { slot.textContent = '空'; slot.classList.add('empty'); } els.selectedRow.appendChild(slot); } els.generate.disabled = state.selected.length !== 3; }
function renderDock() { els.dockList.replaceChildren(); state.gimmicks.forEach((g) => { const card = document.createElement('article'); card.className = 'gimmick-card'; if (state.focusGimmick === g.id || state.placing === g.id) card.classList.add('is-selected'); const motorText = g.motors.map((m) => MOTOR_META[m.kind]?.label || m.kind).join('＋'); const motionText = g.body?.motion && g.body.motion !== 'none' ? ` / ${motionLabel(g.body.motion)}` : ''; card.innerHTML = `<span class="gimmick-name">${g.recipe.join('')} ${escapeHtml(g.name)}</span><div class="gimmick-meta">${escapeHtml(g.visualLabel || '装置')} / ${escapeHtml(motorText)}${escapeHtml(motionText)}</div><div class="gimmick-help">${escapeHtml(g.shortEffect || 'ボールの動きを変える')}</div>`; card.onpointerdown = (event) => startCardDrag(event, g); card.onclick = () => { state.placing = g.id; state.focusGimmick = g.id; setCoach('ギミックを選択中', `${g.visualLabel || '装置'}：${g.shortEffect || 'ボールの動きを変える'}`); showHelp('コートをタップ、またはカードをドラッグすると設置できます。'); render(); draw(); }; els.dockList.appendChild(card); }); }
function motionLabel(motion) { return { spin: '回転', slide: '左右移動', bob: '上下移動', swing: '揺れ', orbit: '周回', pendulum: '振り子' }[motion] || motion; }
function escapeHtml(text) { return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function fit() { const rect = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.floor(rect.width * dpr); const h = Math.floor(rect.height * dpr); if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; } }
function fitCameraToGoals() { fit(); const scale = canvas.width / WORLD.w; const viewH = canvas.height / scale; const ys = [START.y, ...state.goals.map((goal) => goal.y)]; const minY = Math.min(...ys) - 120; const maxY = Math.max(...ys) + 180; state.cameraY = clamp((minY + maxY - viewH) / 2, -120, fallLine() - viewH + 120); draw(); }
function focusCameraOn(y) { fit(); const scale = canvas.width / WORLD.w; const viewH = canvas.height / scale; state.cameraY = clamp(y - viewH * 0.45, -120, fallLine() - viewH + 120); draw(); }
function draw() { if (!state) return; fit(); const scale = canvas.width / WORLD.w; const viewH = canvas.height / scale; state.cameraY = clamp(state.cameraY, -120, fallLine() - viewH + 120); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.scale(scale, scale); ctx.translate(0, -state.cameraY); drawField(viewH); state.fieldEmojis.forEach(drawEmoji); state.goals.forEach(drawGoal); state.ownGoals.forEach(drawOwn); state.gimmicks.filter((g) => g.placed).forEach(drawGimmick); drawBall(); ctx.restore(); }
function drawField(viewH) { const top = state.cameraY - 80; const bottom = state.cameraY + viewH + 80; ctx.fillStyle = '#0f713e'; ctx.fillRect(0, top, WORLD.w, bottom - top); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; for (let y = Math.floor(top / 80) * 80; y < bottom; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); ctx.stroke(); } ctx.strokeStyle = 'rgba(232,255,89,.28)'; ctx.lineWidth = 5; round(18, top, WORLD.w - 36, bottom - top, 28); ctx.stroke(); const f = fallLine(); ctx.fillStyle = 'rgba(255,82,104,.16)'; ctx.fillRect(0, f, WORLD.w, 90); ctx.strokeStyle = '#ff5268'; ctx.setLineDash([18, 12]); ctx.beginPath(); ctx.moveTo(0, f); ctx.lineTo(WORLD.w, f); ctx.stroke(); ctx.setLineDash([]); }
function drawEmoji(emoji) { ctx.save(); ctx.translate(emoji.x, emoji.y); ctx.shadowColor = 'rgba(232,255,89,.7)'; ctx.shadowBlur = 14; ctx.font = '31px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emoji.emoji, 0, 0); ctx.restore(); }
function drawGoal(goal) { ctx.save(); ctx.translate(goal.x, goal.y); ctx.globalAlpha = goal.done ? 0.45 : 1; ctx.strokeStyle = goal.done ? '#d5ddd5' : '#e8ff59'; ctx.fillStyle = goal.done ? 'rgba(220,220,220,.08)' : 'rgba(232,255,89,.13)'; ctx.lineWidth = 9; round(-goal.w / 2, -goal.h / 2, goal.w, goal.h, 18); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; for (let x = -goal.w / 2 + 18; x < goal.w / 2; x += 18) { ctx.beginPath(); ctx.moveTo(x, -goal.h / 2); ctx.lineTo(x, goal.h / 2); ctx.stroke(); } ctx.fillStyle = '#fff'; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText(goal.done ? 'CLEAR' : `GOAL ${goal.label}`, 0, -goal.h / 2 - 12); ctx.restore(); }
function drawOwn(ownGoal) { ctx.save(); ctx.translate(ownGoal.x, ownGoal.y); ctx.fillStyle = 'rgba(255,82,104,.22)'; ctx.strokeStyle = '#ff5268'; ctx.lineWidth = 7; round(-ownGoal.w / 2, -ownGoal.h / 2, ownGoal.w, ownGoal.h, 14); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '900 24px system-ui'; ctx.textAlign = 'center'; ctx.fillText('☠️', 0, 8); ctx.restore(); }
function drawGimmick(g) { const primary = g.motors[0] || { kind: 'kick', range: 0.5 }; const meta = MOTOR_META[primary.kind] || MOTOR_META.kick; const shape = g.body?.shape || defaultShapeForMotors(g.motors); const focused = state.focusGimmick === g.id || state.placing === g.id; drawMotionPath(g, meta, focused); ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.angle); ctx.strokeStyle = meta.color; ctx.fillStyle = `${meta.color}33`; ctx.lineWidth = 6; const length = bodyLength(g); if (shape === 'fan') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 62, -0.62, 0.62); ctx.closePath(); ctx.fill(); ctx.stroke(); arrow(70, meta.color); } else if (shape === 'area') { ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } else if (shape === 'gate') { ctx.beginPath(); ctx.ellipse(0, 0, 38, 52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } else if (['line', 'platform', 'rail', 'carrier', 'arm'].includes(shape)) { ctx.beginPath(); ctx.moveTo(-length / 2, 0); ctx.lineTo(length / 2, 0); ctx.stroke(); if (shape === 'carrier') { round(-length / 2, -18, length, 36, 18); ctx.fill(); ctx.stroke(); } } else { ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); arrow(58, meta.color); } ctx.rotate(-g.angle); ctx.fillStyle = '#fff'; ctx.font = '23px system-ui'; ctx.textAlign = 'center'; ctx.fillText(meta.icon, 0, -24); ctx.font = '900 15px system-ui'; ctx.fillText(g.visualLabel || meta.label, 0, 31); if (focused) drawHandle(g); ctx.restore(); drawRangeHints(g, meta, focused); }
function drawMotionPath(g, meta, focused) { if (!focused && state.phase === 'run') return; const motion = g.body?.motion || 'none'; if (motion === 'none') return; ctx.save(); ctx.strokeStyle = meta.color; ctx.globalAlpha = 0.28; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); const hx = g.homeX ?? g.x; const hy = g.homeY ?? g.y; const p = clamp(g.body?.motionPower ?? 0.55, 0, 1); if (motion === 'slide') { const amp = 95 + 75 * p; ctx.beginPath(); ctx.moveTo(hx - amp, hy); ctx.lineTo(hx + amp, hy); ctx.stroke(); } else if (motion === 'bob') { const amp = 55 + 80 * p; ctx.beginPath(); ctx.moveTo(hx, hy - amp); ctx.lineTo(hx, hy + amp); ctx.stroke(); } else if (motion === 'orbit') { const r = 40 + 80 * p; ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.stroke(); } else if (motion === 'swing' || motion === 'pendulum') { ctx.beginPath(); ctx.arc(hx, hy, 86, -1.1, 1.1); ctx.stroke(); } else if (motion === 'spin') { ctx.beginPath(); ctx.arc(hx, hy, 72, 0, Math.PI * 2); ctx.stroke(); } ctx.setLineDash([]); ctx.restore(); }
function drawRangeHints(g, meta, focused) { if (!focused && state.phase === 'run') return; const fieldMotors = g.motors.filter((m) => ['wind', 'updraft', 'vortex', 'current', 'antiFall', 'tether', 'orbit', 'slow', 'speedFloor', 'gravityFlip', 'curve'].includes(m.kind)); if (!fieldMotors.length) return; const maxRange = Math.max(...fieldMotors.map(motorRange)); ctx.save(); ctx.translate(g.x, g.y); ctx.strokeStyle = meta.color; ctx.globalAlpha = 0.24; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, maxRange, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 0.82; ctx.fillStyle = meta.color; ctx.font = '900 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${MOTOR_META[fieldMotors[0].kind]?.label || '効果'}範囲`, 0, -maxRange - 10); ctx.restore(); }
function drawHandle(g) { const hx = Math.cos(g.angle) * 104; const hy = Math.sin(g.angle) * 104; ctx.save(); ctx.strokeStyle = '#e8ff59'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hx, hy); ctx.stroke(); ctx.fillStyle = '#e8ff59'; ctx.beginPath(); ctx.arc(hx, hy, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#06150e'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('回転', hx, hy); ctx.restore(); }
function arrow(length, color) { ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-length / 2, 0); ctx.lineTo(length / 2, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(length / 2 + 7, 0); ctx.lineTo(length / 2 - 10, -9); ctx.lineTo(length / 2 - 10, 9); ctx.closePath(); ctx.fill(); }
function drawBall() { const ball = state.ball; ctx.save(); ctx.translate(ball.x, ball.y); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.font = '19px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚽', 0, 1); ctx.restore(); }
function round(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); }
function worldFromEvent(event) { const rect = canvas.getBoundingClientRect(); const scale = canvas.width / WORLD.w; return { x: (event.clientX - rect.left) * (canvas.width / rect.width) / scale, y: (event.clientY - rect.top) * (canvas.height / rect.height) / scale + state.cameraY, inside: event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom }; }
function hitGimmick(point) { return [...state.gimmicks].reverse().find((g) => g.placed && Math.hypot(g.x - point.x, g.y - point.y) < 85); }
function handlePos(g) { return { x: g.x + Math.cos(g.angle) * 104, y: g.y + Math.sin(g.angle) * 104 }; }
function startCardDrag(event, g) { event.preventDefault(); state.placing = g.id; state.focusGimmick = g.id; drag = { type: 'new', id: g.id }; showHelp(`${g.visualLabel || '装置'}をコートへドラッグすると設置できます。`); render(); }
function onDown(event) { if (state.phase === 'run' || state.phase === 'between' || state.gameover) return; const point = worldFromEvent(event); const handleTarget = [...state.gimmicks].reverse().find((g) => g.placed && Math.hypot(handlePos(g).x - point.x, handlePos(g).y - point.y) < 34); if (handleTarget) { state.focusGimmick = handleTarget.id; drag = { type: 'rotate', id: handleTarget.id }; showHelp('黄色い「回転」ハンドルで角度を変えられます。'); return; } const hit = hitGimmick(point); if (hit) { state.focusGimmick = hit.id; drag = { type: 'move', id: hit.id, dx: hit.x - point.x, dy: hit.y - point.y }; showHelp('ドラッグで移動。黄色い「回転」ハンドルで角度変更。'); render(); draw(); return; } if (state.placing) { const g = state.gimmicks.find((item) => item.id === state.placing); if (g) { g.x = point.x; g.y = point.y; g.placed = true; saveGimmickHome(g); state.focusGimmick = g.id; drag = { type: 'move', id: g.id, dx: 0, dy: 0 }; render(); draw(); return; } } drag = { type: 'pan', startY: event.clientY, camera: state.cameraY }; }
function onMove(event) { if (!drag) return; event.preventDefault(); const point = worldFromEvent(event); const g = state.gimmicks.find((item) => item.id === drag.id); if (drag.type === 'new' && point.inside && g) { g.x = point.x; g.y = point.y; g.placed = true; state.focusGimmick = g.id; saveGimmickHome(g); draw(); return; } if (drag.type === 'move' && g) { g.x = clamp(point.x + (drag.dx || 0), 40, WORLD.w - 40); g.y = point.y + (drag.dy || 0); saveGimmickHome(g); draw(); return; } if (drag.type === 'rotate' && g) { g.angle = Math.atan2(point.y - g.y, point.x - g.x); saveGimmickHome(g); draw(); return; } if (drag.type === 'pan') { state.cameraY = drag.camera - (event.clientY - drag.startY) / (canvas.width / WORLD.w); draw(); } }
function onUp() { if (!drag) return; const g = state.gimmicks.find((item) => item.id === drag.id); if (g && g.placed) { saveGimmickHome(g); state.placing = null; state.focusGimmick = g.id; hideHelp(); setCoach('配置完了', `${g.visualLabel || '装置'}：${g.shortEffect || 'ボールの動きを変える'}`); if (state.tutorial === 'place') { showModal('角度も変えられる', '編集もサッカーのうち', '置いたギミックに出ている黄色い「回転」ハンドルをドラッグすると角度が変わります。調整したらキックオフ！', '了解', () => closeModal()); state.tutorial = 'edit'; } } drag = null; render(); draw(); }

els.modalPrimary.onclick = () => { if (modalAction) modalAction(); };
els.modalSecondary.onclick = closeModal;
els.kick.onclick = startRun;
els.center.onclick = fitCameraToGoals;
els.generate.onclick = generateGimmick;
document.querySelectorAll('.tab-btn').forEach((button) => { button.onclick = () => setTab(button.dataset.tab); });
canvas.addEventListener('pointerdown', onDown, { passive: false });
window.addEventListener('pointermove', onMove, { passive: false });
window.addEventListener('pointerup', onUp);
window.addEventListener('resize', fitCameraToGoals);
boot();
