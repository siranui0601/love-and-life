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

const TEMPLATE_ORDER = ['BOUNCE','LAUNCH','FLOW','SHAPE','WARP','ATTACH','ROTATE','CARRY','PHASE','SWITCH'];
const META = {
  BOUNCE: { label: '反発', color: '#e8ff59', icon: '🟩', visualLabel: 'バンパー', shortEffect: '触れたボールを強く跳ね返す', radius: 62 },
  LAUNCH: { label: '発射', color: '#ffbd59', icon: '🚀', visualLabel: '大砲', shortEffect: '触れたボールを矢印方向へ飛ばす', radius: 74 },
  FLOW: { label: '風・流れ', color: '#76e4ff', icon: '🌪️', visualLabel: '送風機', shortEffect: '範囲内のボールを矢印方向へ流す', radius: 145 },
  SHAPE: { label: '地形', color: '#ffffff', icon: '🛝', visualLabel: '坂', shortEffect: 'ボールを受け止めて角度を変える', radius: 82 },
  WARP: { label: 'ワープ', color: '#b28cff', icon: '🚪', visualLabel: 'ワープ扉', shortEffect: '触れたボールを反対側へ逃がす', radius: 58 },
  ATTACH: { label: '糸・連結', color: '#ff8ad1', icon: '🧵', visualLabel: '糸巻き', shortEffect: '近くのボールをゆるく引き寄せる', radius: 190 },
  ROTATE: { label: '回転', color: '#9cffc1', icon: '⚙️', visualLabel: '回転棒', shortEffect: '回転する棒でボールを弾く', radius: 86 },
  CARRY: { label: '運搬', color: '#ffdf70', icon: '☁️', visualLabel: 'リフト', shortEffect: '乗ったボールを少し運ぶ', radius: 78 },
  PHASE: { label: '透過', color: '#c8d8ff', icon: '👻', visualLabel: '幽霊門', shortEffect: '触れたボールを少し浮かせる', radius: 64 },
  SWITCH: { label: '切替', color: '#ff9b9b', icon: '🔘', visualLabel: 'スイッチ', shortEffect: '近くのギミックの向きを少し変える', radius: 62 },
};

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

function makeBall() {
  return { x: START.x, y: START.y, vx: 0, vy: 0, r: 18, phaseUntil: 0 };
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, n) {
  return arr[Math.abs(Number(n) || 0) % arr.length];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 1800);
}

function setCoach(title, text) {
  els.coachTitle.textContent = title;
  els.coachText.textContent = text;
}

function showHelp(text) {
  els.fieldHelp.textContent = text;
  els.fieldHelp.hidden = false;
}

function hideHelp() {
  els.fieldHelp.hidden = true;
}

function showModal(kicker, title, text, primary, action, secondary) {
  els.modalKicker.textContent = kicker;
  els.modalTitle.textContent = title;
  els.modalText.textContent = text;
  els.modalPrimary.textContent = primary;
  els.modalSecondary.hidden = !secondary;
  els.modalSecondary.textContent = secondary || '';
  modalAction = action;
  els.modal.classList.add('is-open');
}

function closeModal() {
  els.modal.classList.remove('is-open');
}

async function loadEmojiCatalog() {
  try {
    const res = await fetch('./emoji_catalog_full_ja.json', { cache: 'force-cache' });
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data) ? data : Object.values(data).flat();
    const normalized = list
      .map((item) => (typeof item === 'string' ? item : (item.emoji || item.char || item.symbol || item.unicode || '')))
      .filter(Boolean);
    if (normalized.length > 30) emojiPool = normalized;
  } catch (_) {
    // Fallback set is enough for offline prototype safety.
  }
}

async function boot() {
  await loadEmojiCatalog();
  grantEmojis(8);
  render();
  fitCameraToGoals();
  showModal(
    'KICK OFF',
    '今宵はサッカー！',
    'ボールを黄色いゴールへ入れるゲームです。まずは会場を見て、下のキックオフを押そう⚽️',
    '会場を見る',
    () => {
      closeModal();
      showHelp('下の「キックオフ」を押すとボールが動きます。黄色いGOAL Aへ入れよう。');
    }
  );
  requestAnimationFrame(loop);
}

function grantEmojis(n) {
  for (let i = 0; i < n; i += 1) {
    state.inventory.push({ id: uid(), emoji: pick(emojiPool, hash(`${Date.now()}-${i}-${state.inventory.length}`)) });
  }
}

function spawnFieldEmojis(n) {
  const base = hash(`field-${state.round}-${state.fieldEmojis.length}`);
  for (let i = 0; i < n; i += 1) {
    state.fieldEmojis.push({
      id: uid(),
      emoji: pick(emojiPool, base + i * 37),
      x: 110 + ((base + i * 91) % 680),
      y: 250 + ((base + i * 141) % 640),
      r: 20,
    });
  }
}

function setTab(tab) {
  if (tab === 'generate' && !state.generateUnlocked) {
    toast('まずキックオフして、細工を解禁しよう');
    return;
  }
  state.tab = tab;
  els.venue.classList.toggle('is-active', tab === 'venue');
  els.gen.classList.toggle('is-active', tab === 'generate');
  document.querySelectorAll('.tab-btn').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tab));
  render();
  if (tab === 'venue') fitCameraToGoals();
}

function startRun() {
  if (state.phase === 'run' || state.phase === 'between') return;
  state.gameover = false;
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
  setCoach(title || '作戦タイム', text || 'ゴールは復活しました。次のキックオフで全ゴール通過を狙おう。');
  render();
  fitCameraToGoals();
}

function resetAll() {
  state = freshState();
  grantEmojis(8);
  render();
  fitCameraToGoals();
  showModal(
    'KICK OFF',
    '今宵はサッカー！',
    'ボールを黄色いゴールへ入れるゲームです。まずは会場を見て、下のキックオフを押そう⚽️',
    '会場を見る',
    () => {
      closeModal();
      showHelp('下の「キックオフ」を押すとボールが動きます。黄色いGOAL Aへ入れよう。');
    }
  );
}

function firstFallTutorial() {
  state.generateUnlocked = true;
  state.tabUnlocked = true;
  els.nav.hidden = false;
  trialReset('落下！このままだと届かない', '下の「生成」タブで絵文字を3つ選び、ボールを助けるギミックを作ろう。');
  showModal(
    '作戦タイム',
    'そうだ、細工をしよう！',
    'このままだとボールは落ちます。生成タブで絵文字を3つ選んで、ゴールへ導くギミックを作ろう。',
    '生成タブへ',
    () => { closeModal(); setTab('generate'); }
  );
  state.tutorial = 'generate';
}

function ownGoalReset() {
  showModal(
    'OWN GOAL',
    'オウンゴール！',
    'これはその試走の失敗扱い。盤面はそのまま、ゴールだけ復活して作戦タイムに戻ります。',
    '作戦タイムへ',
    () => {
      closeModal();
      trialReset('オウンゴール。作戦タイム', '盤面は維持。次のキックオフで全ゴール通過を狙おう。');
    }
  );
}

async function generateGimmick() {
  if (state.selected.length !== 3) {
    toast('絵文字を3つ選んで！');
    return;
  }

  const recipe = state.selected.map((item) => item.emoji);
  const seed = hash(recipe.join('|'));
  const fallback = buildLocalGimmick(recipe, seed);
  const generated = await requestGeminiGimmick(recipe, fallback);
  const meta = META[generated.template] || META[fallback.template];
  const gimmick = {
    id: `g${state.nextGimmick}`,
    recipe,
    template: generated.template,
    name: generated.name || fallback.name,
    flavor: generated.flavor || fallback.flavor,
    visualLabel: generated.visualLabel || meta.visualLabel,
    shortEffect: generated.shortEffect || meta.shortEffect,
    x: 450,
    y: 520,
    angle: (seed % 360) * Math.PI / 180,
    power: 1 + (seed % 5) * 0.13,
    placed: false,
    spin: 0,
  };

  state.nextGimmick += 1;
  state.gimmicks.push(gimmick);
  for (const item of state.selected) {
    const index = state.inventory.findIndex((owned) => owned.id === item.id);
    if (index >= 0) state.inventory.splice(index, 1);
  }
  state.selected = [];
  state.placing = gimmick.id;
  state.focusGimmick = gimmick.id;

  setTab('venue');
  setCoach('ギミックを設置しよう', `${gimmick.visualLabel}：${gimmick.shortEffect}`);
  showHelp(`「${gimmick.name}」を設置できます。下のカードを押したままコートへドラッグ。`);
  if (state.tutorial === 'generate') {
    showModal(
      '配置しよう',
      '会場へ戻った！',
      '下のギミックカードを押したまま、コートへドラッグして離そう。設置後は本体ドラッグで移動できます。',
      '配置する',
      () => closeModal()
    );
    state.tutorial = 'place';
  }
  render();
  fitCameraToGoals();
}

function buildLocalGimmick(recipe, seed) {
  const template = pick(TEMPLATE_ORDER, seed);
  const meta = META[template];
  const adjective = pick(['合法', '会場騒然', '反則気味', 'ふわふわ', '逆転', 'VAR泣かせ', '不器用', '謎の'], seed >>> 3);
  return {
    name: `${adjective}${recipe.join('')}`,
    flavor: `${recipe.join('')}がサッカーとして扱われるかは審議中。`,
    template,
    visualLabel: meta.visualLabel,
    shortEffect: meta.shortEffect,
  };
}

async function requestGeminiGimmick(recipe, fallback) {
  try {
    const response = await fetch('/api/nohand-soccer/gimmick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emojis: recipe, fallbackTemplate: fallback.template }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data || !META[data.template]) throw new Error('Invalid gimmick template');
    return {
      name: String(data.name || fallback.name).slice(0, 24),
      flavor: String(data.flavor || fallback.flavor).slice(0, 80),
      template: data.template,
      visualLabel: String(data.visualLabel || META[data.template].visualLabel).slice(0, 12),
      shortEffect: String(data.shortEffect || META[data.template].shortEffect).slice(0, 34),
    };
  } catch (error) {
    console.warn('[noHand] Gemini gimmick fallback', error);
    toast('AI生成が混雑中。ローカル生成で続行します。');
    return fallback;
  }
}

function roundClearSequence() {
  state.phase = 'between';
  render();
  showModal(
    'GOOOOL!',
    'GOOOOL！',
    '全ゴール通過！ 次はコートが広がり、新しいゴールが増えます。',
    '次へ',
    () => {
      closeModal();
      animateBallHome(() => {
        state.round += 1;
        state.goals.forEach((goal) => { goal.done = false; });
        const newGoal = addGoal();
        render();
        focusCameraOn(newGoal.y);
        setTimeout(() => {
          fitCameraToGoals();
          setTimeout(() => showAfterGoalTutorial(), 450);
        }, 650);
      });
    }
  );
}

function showAfterGoalTutorial() {
  showModal(
    'ROUND UP',
    'ゴールが増えた！',
    '大丈夫、ゴールが増えただけだ！素材が足りない……？ 安心してくれ。',
    '素材を見る',
    () => {
      closeModal();
      spawnFieldEmojis(5);
      render();
      showModal(
        '素材出現',
        '絵文字が出現した！',
        'ゴールを決めると、コートに絵文字が出ます。ボールで触れると素材回収。素材3つでギミックを作り、全ゴールを完遂するんだ！',
        '了解',
        () => {
          closeModal();
          trialReset('全ゴールをくぐろう', '黄色いゴールをすべて通過すると次ラウンド。絵文字はボールで触れると素材になります。');
        }
      );
    }
  );
}

function animateBallHome(done) {
  const start = { x: state.ball.x, y: state.ball.y };
  const end = { ...START };
  const t0 = performance.now();
  function step(now) {
    const t = clamp((now - t0) / 650, 0, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    state.ball.x = start.x + (end.x - start.x) * ease;
    state.ball.y = start.y + (end.y - start.y) * ease;
    state.ball.vx = 0;
    state.ball.vy = 0;
    draw();
    if (t < 1) requestAnimationFrame(step);
    else done();
  }
  requestAnimationFrame(step);
}

function addGoal() {
  const seed = hash(`goal-${state.round}-${state.goals.length}`);
  const lowest = Math.max(...state.goals.map((goal) => goal.y));
  const x = 120 + (seed % 660);
  const y = clamp(260 + ((seed >>> 4) % 760), 200, lowest + 300);
  const goal = { id: state.nextGoal, x, y, w: 116, h: 78, done: false, label: String.fromCharCode(64 + state.nextGoal) };
  state.goals.push(goal);
  state.nextGoal += 1;
  if (state.round >= 2 && state.ownGoals.length === 0) {
    state.ownGoals.push({ id: 'own1', x: 210, y: 1030, w: 128, h: 55 });
  }
  return goal;
}

function fallLine() {
  return Math.max(1110, Math.max(...state.goals.map((goal) => goal.y), ...state.ownGoals.map((goal) => goal.y), 0) + 210);
}

function loop(ts) {
  if (!state.last) state.last = ts;
  const dt = Math.min(0.033, (ts - state.last) / 1000);
  state.last = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (state.phase !== 'run') return;
  const ball = state.ball;
  state.runTime += dt;
  for (const gimmick of state.gimmicks) {
    if (gimmick.placed) applyGimmick(gimmick, dt);
  }
  ball.vy += WORLD.gravity * dt * 60;
  ball.vx *= 0.996;
  ball.vy *= 0.999;
  ball.x += ball.vx * dt * 60;
  ball.y += ball.vy * dt * 60;
  if (ball.x < ball.r) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx) * WORLD.wallBounce;
  }
  if (ball.x > WORLD.w - ball.r) {
    ball.x = WORLD.w - ball.r;
    ball.vx = -Math.abs(ball.vx) * WORLD.wallBounce;
  }
  checkCollect();
  checkGoals();
  state.cameraY += (ball.y - canvas.height / (canvas.width / WORLD.w) * 0.45 - state.cameraY) * 0.08;
  if (ball.y > fallLine()) {
    if (state.tutorial === 'intro') {
      firstFallTutorial();
      return;
    }
    trialReset('落下。作戦タイム', '落下したので、その試走のゴール通過はリセット。次のキックオフで全ゴールを狙おう。');
  }
  if (state.runTime > 30) {
    trialReset('30秒ゴールなし', 'その試走は終了。ギミックの場所や角度を調整しよう。');
  }
}

function applyGimmick(gimmick, dt) {
  const ball = state.ball;
  const dx = ball.x - gimmick.x;
  const dy = ball.y - gimmick.y;
  const distance = Math.hypot(dx, dy) || 1;
  if (gimmick.template === 'FLOW' && distance < 145) {
    const force = (1 - distance / 145) * 0.24 * gimmick.power;
    ball.vx += Math.cos(gimmick.angle) * force * dt * 60;
    ball.vy += Math.sin(gimmick.angle) * force * dt * 60;
  }
  if (gimmick.template === 'ATTACH' && distance < 190) {
    ball.vx += (gimmick.x - ball.x) * 0.0009 * dt * 60;
    ball.vy += (gimmick.y - ball.y) * 0.0009 * dt * 60;
  }
  if (gimmick.template === 'CARRY' && Math.abs(dx) < 66 && Math.abs(dy) < 34 && ball.vy > -3) {
    ball.y = gimmick.y - 36;
    ball.vx += Math.cos(gimmick.angle) * 0.09;
    ball.vy *= 0.8;
  }
  if (gimmick.template === 'ROTATE') gimmick.spin += dt * 2.2;
  collideGimmick(gimmick, distance, dx, dy);
}

function collideGimmick(gimmick, distance, dx, dy) {
  const ball = state.ball;
  if (gimmick.template === 'BOUNCE' && distance < 58) {
    const nx = dx / distance;
    const ny = dy / distance;
    ball.vx = nx * 5.7 * gimmick.power + Math.cos(gimmick.angle);
    ball.vy = ny * 5.7 * gimmick.power + Math.sin(gimmick.angle);
    separate(gimmick, 62);
  }
  if (gimmick.template === 'LAUNCH' && distance < 58) {
    ball.vx = Math.cos(gimmick.angle) * 7.2 * gimmick.power;
    ball.vy = Math.sin(gimmick.angle) * 7.2 * gimmick.power;
    separate(gimmick, 62);
  }
  if (gimmick.template === 'SHAPE') collideLine(gimmick.x, gimmick.y, gimmick.angle, 155, 0.76);
  if (gimmick.template === 'ROTATE') collideLine(gimmick.x, gimmick.y, gimmick.angle + gimmick.spin, 135, 1.08);
  if (gimmick.template === 'WARP' && distance < 42 && !gimmick.cool) {
    ball.x = WORLD.w - gimmick.x;
    ball.y = Math.max(80, gimmick.y - 260);
    ball.vy = Math.min(ball.vy, -4);
    gimmick.cool = 60;
    toast('ワープ！');
  }
  if (gimmick.cool) gimmick.cool -= 1;
  if (gimmick.template === 'PHASE' && distance < 52) {
    ball.phaseUntil = state.runTime + 2.5;
    ball.vy -= 1.1;
  }
  if (gimmick.template === 'SWITCH' && distance < 55 && !gimmick.cool) {
    state.gimmicks.forEach((other) => {
      if (other.id !== gimmick.id && Math.hypot(other.x - gimmick.x, other.y - gimmick.y) < 230) other.angle += Math.PI / 5;
    });
    gimmick.cool = 70;
    toast('近くの向きが変わった');
  }
}

function separate(gimmick, radius) {
  const ball = state.ball;
  const dx = ball.x - gimmick.x;
  const dy = ball.y - gimmick.y;
  const distance = Math.hypot(dx, dy) || 1;
  ball.x = gimmick.x + dx / distance * radius;
  ball.y = gimmick.y + dy / distance * radius;
}

function collideLine(cx, cy, angle, length, bounce) {
  const ball = state.ball;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const vx = ball.x - cx;
  const vy = ball.y - cy;
  const projection = clamp(vx * ux + vy * uy, -length / 2, length / 2);
  const px = cx + ux * projection;
  const py = cy + uy * projection;
  const dx = ball.x - px;
  const dy = ball.y - py;
  const distance = Math.hypot(dx, dy) || 1;
  if (distance < ball.r + 8) {
    const nx = dx / distance;
    const ny = dy / distance;
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= (1 + bounce) * dot * nx;
      ball.vy -= (1 + bounce) * dot * ny;
      ball.x = px + nx * (ball.r + 9);
      ball.y = py + ny * (ball.r + 9);
    }
  }
}

function checkCollect() {
  state.fieldEmojis = state.fieldEmojis.filter((emoji) => {
    if (Math.hypot(state.ball.x - emoji.x, state.ball.y - emoji.y) < state.ball.r + emoji.r) {
      state.inventory.push({ id: uid(), emoji: emoji.emoji });
      toast(`素材 ${emoji.emoji} 回収`);
      render();
      return false;
    }
    return true;
  });
}

function checkGoals() {
  for (const ownGoal of state.ownGoals) {
    if (inRect(state.ball, ownGoal)) {
      ownGoalReset();
      return;
    }
  }
  let scored = false;
  for (const goal of state.goals) {
    if (!goal.done && inRect(state.ball, goal)) {
      goal.done = true;
      scored = true;
      state.ball.vy = Math.min(state.ball.vy, -5);
      state.ball.vx += goal.x < WORLD.w / 2 ? 2 : -2;
      toast(`GOAL ${goal.label}`);
    }
  }
  if (scored) render();
  if (state.goals.every((goal) => goal.done)) roundClearSequence();
}

function inRect(ball, rect) {
  return Math.abs(ball.x - rect.x) < rect.w / 2 && Math.abs(ball.y - rect.y) < rect.h / 2;
}

function render() {
  els.nav.hidden = !state.tabUnlocked;
  els.dock.hidden = !state.generateUnlocked || !state.gimmicks.length;
  els.round.textContent = `R${state.round}`;
  els.goal.textContent = `${state.goals.filter((goal) => goal.done).length}/${state.goals.length}`;
  els.emojiCount.textContent = `${state.inventory.length}個`;
  document.querySelector('[data-tab="generate"]').classList.toggle('is-locked', !state.generateUnlocked);
  renderEmojis();
  renderSelected();
  renderDock();
  els.kick.disabled = state.phase === 'run' || state.phase === 'between';
}

function renderEmojis() {
  els.emojiGrid.replaceChildren();
  state.inventory.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'emoji-btn';
    button.textContent = item.emoji;
    button.type = 'button';
    if (state.selected.some((selected) => selected.id === item.id)) button.classList.add('is-selected');
    button.onclick = () => toggleEmoji(item);
    els.emojiGrid.appendChild(button);
  });
}

function toggleEmoji(item) {
  const index = state.selected.findIndex((selected) => selected.id === item.id);
  if (index >= 0) state.selected.splice(index, 1);
  else {
    if (state.selected.length >= 3) state.selected.shift();
    state.selected.push(item);
  }
  render();
}

function renderSelected() {
  els.selectedRow.replaceChildren();
  for (let i = 0; i < 3; i += 1) {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'slot';
    if (state.selected[i]) {
      slot.textContent = state.selected[i].emoji;
      slot.onclick = () => {
        state.selected.splice(i, 1);
        render();
      };
    } else {
      slot.textContent = '空';
      slot.classList.add('empty');
    }
    els.selectedRow.appendChild(slot);
  }
  els.generate.disabled = state.selected.length !== 3;
}

function renderDock() {
  els.dockList.replaceChildren();
  state.gimmicks.forEach((gimmick) => {
    const meta = META[gimmick.template];
    const card = document.createElement('article');
    card.className = 'gimmick-card';
    if (state.focusGimmick === gimmick.id || state.placing === gimmick.id) card.classList.add('is-selected');
    card.innerHTML = `
      <span class="gimmick-name">${gimmick.recipe.join('')} ${escapeHtml(gimmick.name)}</span>
      <div class="gimmick-meta">${meta.icon} ${escapeHtml(gimmick.visualLabel || meta.visualLabel)} / ${gimmick.placed ? '配置済み' : '未配置'}</div>
      <div class="gimmick-help">${escapeHtml(gimmick.shortEffect || meta.shortEffect)}</div>
    `;
    card.onpointerdown = (event) => startCardDrag(event, gimmick);
    card.onclick = () => {
      state.placing = gimmick.id;
      state.focusGimmick = gimmick.id;
      setCoach('ギミックを選択中', `${gimmick.visualLabel || meta.visualLabel}：${gimmick.shortEffect || meta.shortEffect}`);
      showHelp('コートをタップ、またはカードをドラッグすると設置できます。');
      render();
      draw();
    };
    els.dockList.appendChild(card);
  });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function fit() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.floor(rect.width * dpr);
  const h = Math.floor(rect.height * dpr);
  if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
    canvas.width = w;
    canvas.height = h;
  }
}

function fitCameraToGoals() {
  fit();
  const scale = canvas.width / WORLD.w;
  const viewH = canvas.height / scale;
  const ys = [START.y, ...state.goals.map((goal) => goal.y)];
  const minY = Math.min(...ys) - 120;
  const maxY = Math.max(...ys) + 180;
  state.cameraY = clamp((minY + maxY - viewH) / 2, -120, fallLine() - viewH + 120);
  draw();
}

function focusCameraOn(y) {
  fit();
  const scale = canvas.width / WORLD.w;
  const viewH = canvas.height / scale;
  state.cameraY = clamp(y - viewH * 0.45, -120, fallLine() - viewH + 120);
  draw();
}

function draw() {
  if (!state) return;
  fit();
  const scale = canvas.width / WORLD.w;
  const viewH = canvas.height / scale;
  state.cameraY = clamp(state.cameraY, -120, fallLine() - viewH + 120);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(0, -state.cameraY);
  drawField(viewH);
  state.fieldEmojis.forEach(drawEmoji);
  state.goals.forEach(drawGoal);
  state.ownGoals.forEach(drawOwn);
  state.gimmicks.filter((gimmick) => gimmick.placed).forEach(drawGimmick);
  drawBall();
  ctx.restore();
}

function drawField(viewH) {
  const top = state.cameraY - 80;
  const bottom = state.cameraY + viewH + 80;
  ctx.fillStyle = '#0f713e';
  ctx.fillRect(0, top, WORLD.w, bottom - top);
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 2;
  for (let y = Math.floor(top / 80) * 80; y < bottom; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(232,255,89,.28)';
  ctx.lineWidth = 5;
  round(18, top, WORLD.w - 36, bottom - top, 28);
  ctx.stroke();
  const f = fallLine();
  ctx.fillStyle = 'rgba(255,82,104,.16)';
  ctx.fillRect(0, f, WORLD.w, 90);
  ctx.strokeStyle = '#ff5268';
  ctx.setLineDash([18, 12]);
  ctx.beginPath();
  ctx.moveTo(0, f);
  ctx.lineTo(WORLD.w, f);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawEmoji(emoji) {
  ctx.save();
  ctx.translate(emoji.x, emoji.y);
  ctx.shadowColor = 'rgba(232,255,89,.7)';
  ctx.shadowBlur = 14;
  ctx.font = '31px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji.emoji, 0, 0);
  ctx.restore();
}

function drawGoal(goal) {
  ctx.save();
  ctx.translate(goal.x, goal.y);
  ctx.globalAlpha = goal.done ? 0.45 : 1;
  ctx.strokeStyle = goal.done ? '#d5ddd5' : '#e8ff59';
  ctx.fillStyle = goal.done ? 'rgba(220,220,220,.08)' : 'rgba(232,255,89,.13)';
  ctx.lineWidth = 9;
  round(-goal.w / 2, -goal.h / 2, goal.w, goal.h, 18);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = 2;
  for (let x = -goal.w / 2 + 18; x < goal.w / 2; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, -goal.h / 2);
    ctx.lineTo(x, goal.h / 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.font = '900 18px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(goal.done ? 'CLEAR' : `GOAL ${goal.label}`, 0, -goal.h / 2 - 12);
  ctx.restore();
}

function drawOwn(ownGoal) {
  ctx.save();
  ctx.translate(ownGoal.x, ownGoal.y);
  ctx.fillStyle = 'rgba(255,82,104,.22)';
  ctx.strokeStyle = '#ff5268';
  ctx.lineWidth = 7;
  round(-ownGoal.w / 2, -ownGoal.h / 2, ownGoal.w, ownGoal.h, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '900 24px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('☠️', 0, 8);
  ctx.restore();
}

function drawGimmick(gimmick) {
  const meta = META[gimmick.template];
  ctx.save();
  ctx.translate(gimmick.x, gimmick.y);
  ctx.rotate(gimmick.angle + (gimmick.template === 'ROTATE' ? gimmick.spin : 0));
  ctx.strokeStyle = meta.color;
  ctx.fillStyle = `${meta.color}33`;
  ctx.lineWidth = 6;
  if (['FLOW', 'ATTACH'].includes(gimmick.template)) {
    ctx.beginPath();
    ctx.arc(0, 0, gimmick.template === 'ATTACH' ? 86 : 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    arrow(58, meta.color);
  } else if (gimmick.template === 'WARP') {
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (gimmick.template === 'CARRY') {
    round(-62, -18, 124, 36, 18);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-76, 0);
    ctx.lineTo(76, 0);
    ctx.stroke();
    if (['LAUNCH', 'SWITCH'].includes(gimmick.template)) arrow(72, meta.color);
  }
  ctx.rotate(-gimmick.angle - (gimmick.template === 'ROTATE' ? gimmick.spin : 0));
  ctx.fillStyle = '#fff';
  ctx.font = '23px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(meta.icon, 0, -24);
  ctx.font = '900 15px system-ui';
  ctx.fillText(gimmick.visualLabel || meta.visualLabel, 0, 30);
  if (state.focusGimmick === gimmick.id || state.placing === gimmick.id) drawHandle(gimmick);
  ctx.restore();

  if (['FLOW', 'ATTACH'].includes(gimmick.template) && (state.focusGimmick === gimmick.id || state.phase !== 'run')) {
    ctx.save();
    ctx.translate(gimmick.x, gimmick.y);
    ctx.strokeStyle = meta.color;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, META[gimmick.template].radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawHandle(gimmick) {
  const hx = Math.cos(gimmick.angle) * 104;
  const hy = Math.sin(gimmick.angle) * 104;
  ctx.save();
  ctx.strokeStyle = '#e8ff59';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.fillStyle = '#e8ff59';
  ctx.beginPath();
  ctx.arc(hx, hy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#06150e';
  ctx.font = '900 13px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('回転', hx, hy);
  ctx.restore();
}

function arrow(length, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-length / 2, 0);
  ctx.lineTo(length / 2, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(length / 2 + 7, 0);
  ctx.lineTo(length / 2 - 10, -9);
  ctx.lineTo(length / 2 - 10, 9);
  ctx.closePath();
  ctx.fill();
}

function drawBall() {
  const ball = state.ball;
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = '19px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚽', 0, 1);
  ctx.restore();
}

function round(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function worldFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / WORLD.w;
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width) / scale,
    y: (event.clientY - rect.top) * (canvas.height / rect.height) / scale + state.cameraY,
    inside: event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom,
  };
}

function hitGimmick(point) {
  return [...state.gimmicks].reverse().find((gimmick) => gimmick.placed && Math.hypot(gimmick.x - point.x, gimmick.y - point.y) < 85);
}

function handlePos(gimmick) {
  return { x: gimmick.x + Math.cos(gimmick.angle) * 104, y: gimmick.y + Math.sin(gimmick.angle) * 104 };
}

function startCardDrag(event, gimmick) {
  event.preventDefault();
  state.placing = gimmick.id;
  state.focusGimmick = gimmick.id;
  drag = { type: 'new', id: gimmick.id };
  showHelp(`${gimmick.visualLabel || META[gimmick.template].visualLabel}をコートへドラッグすると設置できます。`);
  render();
}

function onDown(event) {
  if (state.phase === 'run' || state.phase === 'between' || state.gameover) return;
  const point = worldFromEvent(event);
  const handleTarget = [...state.gimmicks].reverse().find((gimmick) => gimmick.placed && Math.hypot(handlePos(gimmick).x - point.x, handlePos(gimmick).y - point.y) < 34);
  if (handleTarget) {
    state.focusGimmick = handleTarget.id;
    drag = { type: 'rotate', id: handleTarget.id };
    showHelp('黄色い「回転」ハンドルで角度を変えられます。');
    return;
  }
  const hit = hitGimmick(point);
  if (hit) {
    state.focusGimmick = hit.id;
    drag = { type: 'move', id: hit.id, dx: hit.x - point.x, dy: hit.y - point.y };
    showHelp('ドラッグで移動。黄色い「回転」ハンドルで角度変更。');
    render();
    draw();
    return;
  }
  if (state.placing) {
    const gimmick = state.gimmicks.find((g) => g.id === state.placing);
    if (gimmick) {
      gimmick.x = point.x;
      gimmick.y = point.y;
      gimmick.placed = true;
      state.focusGimmick = gimmick.id;
      drag = { type: 'move', id: gimmick.id, dx: 0, dy: 0 };
      render();
      draw();
      return;
    }
  }
  drag = { type: 'pan', startY: event.clientY, camera: state.cameraY };
}

function onMove(event) {
  if (!drag) return;
  event.preventDefault();
  const point = worldFromEvent(event);
  const gimmick = state.gimmicks.find((g) => g.id === drag.id);
  if (drag.type === 'new' && point.inside && gimmick) {
    gimmick.x = point.x;
    gimmick.y = point.y;
    gimmick.placed = true;
    state.focusGimmick = gimmick.id;
    draw();
    return;
  }
  if (drag.type === 'move' && gimmick) {
    gimmick.x = clamp(point.x + (drag.dx || 0), 40, WORLD.w - 40);
    gimmick.y = point.y + (drag.dy || 0);
    draw();
    return;
  }
  if (drag.type === 'rotate' && gimmick) {
    gimmick.angle = Math.atan2(point.y - gimmick.y, point.x - gimmick.x);
    draw();
    return;
  }
  if (drag.type === 'pan') {
    state.cameraY = drag.camera - (event.clientY - drag.startY) / (canvas.width / WORLD.w);
    draw();
  }
}

function onUp() {
  if (!drag) return;
  const gimmick = state.gimmicks.find((g) => g.id === drag.id);
  if (gimmick && gimmick.placed) {
    state.placing = null;
    state.focusGimmick = gimmick.id;
    hideHelp();
    setCoach('配置完了', `${gimmick.visualLabel || META[gimmick.template].visualLabel}：${gimmick.shortEffect || META[gimmick.template].shortEffect}`);
    if (state.tutorial === 'place') {
      showModal(
        '角度も変えられる',
        '編集もサッカーのうち',
        '置いたギミックに出ている黄色い「回転」ハンドルをドラッグすると角度が変わります。調整したらキックオフ！',
        '了解',
        () => closeModal()
      );
      state.tutorial = 'edit';
    }
  }
  drag = null;
  render();
  draw();
}

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
