const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const els = {
  titleCard: document.querySelector("#titleCard"),
  startBtn: document.querySelector("#startBtn"),
  demoBtn: document.querySelector("#demoBtn"),
  runBtn: document.querySelector("#runBtn"),
  editBtn: document.querySelector("#editBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  rewardBtn: document.querySelector("#rewardBtn"),
  generateBtn: document.querySelector("#generateBtn"),
  roundValue: document.querySelector("#roundValue"),
  goalValue: document.querySelector("#goalValue"),
  emojiValue: document.querySelector("#emojiValue"),
  phaseValue: document.querySelector("#phaseValue"),
  coachLine: document.querySelector("#coachLine"),
  subLine: document.querySelector("#subLine"),
  emojiInventory: document.querySelector("#emojiInventory"),
  selectedTray: document.querySelector("#selectedTray"),
  selectionHint: document.querySelector("#selectionHint"),
  gimmickList: document.querySelector("#gimmickList"),
  logList: document.querySelector("#logList"),
};

const WORLD = {
  w: 900,
  baseH: 1180,
  gravity: 0.34,
  wallBounce: 0.78,
  floorMargin: 210,
};

const TEMPLATE_META = {
  BOUNCE: { label: "反発", color: "#e7ff5b", icon: "🟩" },
  LAUNCH: { label: "発射", color: "#ffbd59", icon: "🚀" },
  FLOW: { label: "流れ", color: "#70dfff", icon: "🌪️" },
  SHAPE: { label: "地形", color: "#ffffff", icon: "🛝" },
  WARP: { label: "ワープ", color: "#b28cff", icon: "🚪" },
  ATTACH: { label: "連結", color: "#ff8ad1", icon: "🕸️" },
  ROTATE: { label: "回転", color: "#9cffc1", icon: "⚙️" },
  CARRY: { label: "運搬", color: "#ffdf70", icon: "☁️" },
  PHASE: { label: "透過", color: "#c8d8ff", icon: "👻" },
  SWITCH: { label: "切替", color: "#ff9b9b", icon: "🔘" },
};

const FALLBACK_EMOJIS = [
  ["🐸", "カエル"], ["🎈", "風船"], ["🧱", "レンガ"], ["🧲", "磁石"], ["🍌", "バナナ"],
  ["🌪️", "竜巻"], ["🚪", "ドア"], ["🛞", "車輪"], ["🪃", "ブーメラン"], ["🧊", "氷"],
  ["🦀", "カニ"], ["☁️", "雲"], ["⚡", "稲妻"], ["🕳️", "穴"], ["🪜", "はしご"],
  ["🧵", "糸"], ["⚙️", "歯車"], ["🛝", "すべり台"], ["🦘", "カンガルー"], ["🦅", "ワシ"],
  ["🚀", "ロケット"], ["🧪", "試験管"], ["🎺", "ラッパ"], ["🧸", "くま"], ["🥁", "太鼓"],
  ["🪭", "扇"], ["🧽", "スポンジ"], ["🪨", "岩"], ["🪩", "ミラーボール"], ["🦋", "蝶"]
];

let emojiPool = FALLBACK_EMOJIS.map(([emoji, name]) => ({ emoji, name }));
let state;

function newState() {
  return {
    phase: "edit",
    round: 1,
    time: 0,
    idleTime: 0,
    cameraY: 0,
    placingId: null,
    draggingId: null,
    dragOffset: { x: 0, y: 0 },
    ball: makeBall(),
    goals: [
      { id: 1, x: 675, y: 270, w: 112, h: 78, done: false, label: "A" },
    ],
    ownGoals: [
      { id: "own-1", x: 450, y: 1065, w: 150, h: 58 },
    ],
    emojis: [],
    inventory: [],
    selected: [],
    gimmicks: [],
    logs: [],
    nextGoalId: 2,
    nextGimmickId: 1,
    lastTs: 0,
  };
}

function makeBall() {
  return { x: 450, y: 130, vx: 0, vy: 0, r: 17, phaseUntil: 0 };
}

function seededNumber(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function pick(arr, seed, offset = 0) {
  return arr[(seed + offset) % arr.length];
}

function randomEmoji(seed) {
  return emojiPool[seed % emojiPool.length] || emojiPool[0];
}

async function loadEmojiCatalog() {
  try {
    const res = await fetch("./emoji_catalog_full_ja.json", { cache: "force-cache" });
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data) ? data : Object.values(data).flat();
    const normalized = list
      .map((item) => {
        if (typeof item === "string") return { emoji: item, name: item };
        return {
          emoji: item.emoji || item.char || item.symbol,
          name: item.jaName || item.japaneseName || item.name || item.label || item.emoji,
        };
      })
      .filter((item) => item.emoji);
    if (normalized.length > 50) {
      emojiPool = normalized;
      if (state) renderAll();
    }
  } catch (error) {
    console.info("emoji catalog fallback", error);
  }
}

function log(text) {
  state.logs.unshift(text);
  state.logs = state.logs.slice(0, 24);
  renderLogs();
}

function grantEmojis(count, reason = "絵文字を獲得") {
  const base = seededNumber(`${Date.now()}:${state.round}:${state.inventory.length}:${reason}`);
  const granted = [];
  for (let i = 0; i < count; i += 1) {
    const item = randomEmoji(base + i * 97);
    state.inventory.push({ ...item, uid: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}` });
    granted.push(item.emoji);
  }
  log(`${reason}：${granted.join(" ")}`);
  renderAll();
}

function addFieldEmojis(count) {
  const base = seededNumber(`field:${state.round}:${state.emojis.length}:${state.goals.length}`);
  const minY = Math.min(...state.goals.map((g) => g.y), 160) - 150;
  const maxY = getFallLine() - 120;
  for (let i = 0; i < count; i += 1) {
    const item = randomEmoji(base + i * 31);
    let x = 100 + ((base + i * 193) % 700);
    let y = minY + ((base + i * 151) % Math.max(300, maxY - minY));
    for (let tries = 0; tries < 8 && isOccupied(x, y, 56); tries += 1) {
      x = 100 + ((base + tries * 61 + i * 47) % 700);
      y = minY + ((base + tries * 83 + i * 37) % Math.max(300, maxY - minY));
    }
    state.emojis.push({ id: `emoji-${Date.now()}-${i}-${base}`, x, y, r: 19, emoji: item.emoji, name: item.name });
  }
}

function isOccupied(x, y, radius) {
  const nearGoal = state?.goals?.some((g) => Math.abs(g.x - x) < (g.w / 2 + radius) && Math.abs(g.y - y) < (g.h / 2 + radius));
  const nearOwn = state?.ownGoals?.some((g) => Math.abs(g.x - x) < (g.w / 2 + radius) && Math.abs(g.y - y) < (g.h / 2 + radius));
  const nearGimmick = state?.gimmicks?.some((g) => Math.hypot(g.x - x, g.y - y) < 70);
  return nearGoal || nearOwn || nearGimmick;
}

function generateGimmick() {
  if (state.selected.length !== 3) {
    log("絵文字を3つ選んでください。");
    return;
  }

  const recipe = state.selected.map((item) => item.emoji);
  const recipeNames = state.selected.map((item) => item.name || item.emoji);
  const seed = seededNumber(recipe.join("|"));
  const templates = Object.keys(TEMPLATE_META);
  const template = pick(templates, seed);
  const adjective = pick(["反則気味", "合法", "眠れる", "逆転", "不器用", "会場騒然", "VAR泣かせ", "ふわふわ", "暴れん坊", "静かな"], seed, 3);
  const base = recipeNames.map((n) => String(n).replace(/\s+/g, "")).join("");
  const name = `${adjective}${base}`.slice(0, 18);
  const gimmick = {
    id: `g-${state.nextGimmickId++}`,
    name,
    recipe,
    template,
    x: 450,
    y: 520,
    angle: ((seed % 12) / 12) * Math.PI * 2,
    power: 1 + (seed % 5) * 0.15,
    placed: false,
    active: true,
    color: TEMPLATE_META[template].color,
  };

  state.gimmicks.push(gimmick);
  for (const item of state.selected) {
    const index = state.inventory.findIndex((owned) => owned.uid === item.uid);
    if (index >= 0) state.inventory.splice(index, 1);
  }
  state.selected = [];
  state.placingId = gimmick.id;
  log(`${recipe.join("")} から「${name}」を生成。ピッチをタップして配置。`);
  renderAll();
}

function placeDemo() {
  if (!state) return;
  state.gimmicks = [
    { id: `g-${state.nextGimmickId++}`, name: "合法カエルバンパー", recipe: ["🐸", "🧱", "🎈"], template: "BOUNCE", x: 430, y: 720, angle: -0.35, power: 1.35, placed: true, active: true, color: TEMPLATE_META.BOUNCE.color },
    { id: `g-${state.nextGimmickId++}`, name: "竜巻スロープ", recipe: ["🌪️", "🛝", "🛞"], template: "SHAPE", x: 575, y: 510, angle: -0.55, power: 1, placed: true, active: true, color: TEMPLATE_META.SHAPE.color },
    { id: `g-${state.nextGimmickId++}`, name: "ドアワープ", recipe: ["🚪", "🕳️", "⚽"], template: "WARP", x: 250, y: 890, angle: 0, power: 1, placed: true, active: true, color: TEMPLATE_META.WARP.color, exitX: 640, exitY: 360 },
  ];
  state.placingId = null;
  log("おすすめ配置を置いた。まずは試走して感触を確認。");
  renderAll();
}

function startRun() {
  state.phase = "run";
  state.time = 0;
  state.idleTime = 0;
  state.ball = makeBall();
  state.ball.vx = 0;
  state.ball.vy = 0;
  log("キックオフ。これはサッカーです。");
  renderAll();
}

function enterEdit(reason) {
  state.phase = "edit";
  state.time = 0;
  state.idleTime = 0;
  state.ball = makeBall();
  log(reason);
  renderAll();
}

function completeRound() {
  state.phase = "edit";
  log(`ROUND ${state.round} 完了！ 全ゴールが再び有効化され、新ゴールが追加。`);
  state.round += 1;
  state.goals.forEach((goal) => { goal.done = false; });
  addNewGoal();
  if (state.round === 3) {
    addOwnGoal();
  }
  grantEmojis(3, "ラウンド報酬");
  addFieldEmojis(4);
  state.ball = makeBall();
  renderAll();
}

function addNewGoal() {
  const seed = seededNumber(`goal:${state.round}:${state.goals.length}`);
  const lowest = Math.max(...state.goals.map((g) => g.y));
  const zones = [
    { x1: 160, x2: 360, y1: 260, y2: 560 },
    { x1: 560, x2: 760, y1: 420, y2: 760 },
    { x1: 170, x2: 360, y1: lowest + 130, y2: lowest + 360 },
    { x1: 540, x2: 760, y1: lowest - 240, y2: lowest + 120 },
  ];
  const zone = zones[state.goals.length % zones.length];
  let x = zone.x1 + (seed % Math.max(1, zone.x2 - zone.x1));
  let y = zone.y1 + ((seed >> 3) % Math.max(1, zone.y2 - zone.y1));
  for (let tries = 0; tries < 20 && isOccupied(x, y, 90); tries += 1) {
    x = 120 + ((seed + tries * 83) % 660);
    y = Math.max(160, zone.y1 + ((seed + tries * 131) % Math.max(260, zone.y2 - zone.y1 + 160)));
  }
  state.goals.push({ id: state.nextGoalId, x, y, w: 112, h: 78, done: false, label: String.fromCharCode(64 + state.nextGoalId) });
  state.nextGoalId += 1;
}

function addOwnGoal() {
  const lowest = Math.max(...state.goals.map((g) => g.y));
  state.ownGoals.push({ id: `own-${state.ownGoals.length + 1}`, x: 160, y: lowest + 210, w: 132, h: 54 });
}

function getFallLine() {
  const lowest = Math.max(...state.goals.map((g) => g.y), ...state.ownGoals.map((g) => g.y));
  return Math.max(WORLD.baseH, lowest + WORLD.floorMargin);
}

function update(dt) {
  if (!state || state.phase !== "run") return;
  const ball = state.ball;
  state.time += dt;

  applyGimmickForces(dt);

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

  checkGimmickCollisions();
  checkEmojiCollection();
  checkGoals();

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < 0.3) state.idleTime += dt;
  else state.idleTime = 0;

  if (ball.y > getFallLine()) {
    enterEdit("落下。配置を変えれば、まだサッカーです。");
    return;
  }

  if (state.time > 30 || state.idleTime > 5) {
    enterEdit("30秒ゴールなし。作戦タイムに戻ります。");
    return;
  }

  const cameraTarget = ball.y - canvas.height * 0.43;
  state.cameraY += (cameraTarget - state.cameraY) * 0.08;
}

function applyGimmickForces(dt) {
  const ball = state.ball;
  const t = state.time;
  for (const g of state.gimmicks) {
    if (!g.placed || !g.active) continue;
    if (g.template === "FLOW") {
      const dist = Math.hypot(ball.x - g.x, ball.y - g.y);
      if (dist < 135) {
        const force = (1 - dist / 135) * 0.24 * g.power;
        ball.vx += Math.cos(g.angle) * force * dt * 60;
        ball.vy += Math.sin(g.angle) * force * dt * 60;
      }
    }
    if (g.template === "ATTACH") {
      const dist = Math.hypot(ball.x - g.x, ball.y - g.y);
      if (dist < 185) {
        ball.vx += (g.x - ball.x) * 0.0009 * dt * 60;
        ball.vy += (g.y - ball.y) * 0.0009 * dt * 60;
      }
    }
    if (g.template === "CARRY") {
      g.x += Math.cos(t * 1.2 + g.power) * 0.35;
      if (Math.abs(ball.x - g.x) < 56 && Math.abs(ball.y - g.y) < 26 && ball.vy > -2) {
        ball.vx += 0.05 * Math.sign(Math.cos(g.angle) || 1);
        ball.vy *= 0.85;
        ball.y = g.y - 28;
      }
    }
    if (g.template === "ROTATE") {
      g.spin = (g.spin || 0) + dt * 2.2;
    }
  }
}

function checkGimmickCollisions() {
  const ball = state.ball;
  for (const g of state.gimmicks) {
    if (!g.placed || !g.active) continue;
    const dx = ball.x - g.x;
    const dy = ball.y - g.y;
    const dist = Math.hypot(dx, dy);

    if (g.template === "BOUNCE" && dist < 58) {
      const nx = dx / Math.max(1, dist);
      const ny = dy / Math.max(1, dist);
      ball.vx = nx * 5.6 * g.power + Math.cos(g.angle) * 1.2;
      ball.vy = ny * 5.6 * g.power + Math.sin(g.angle) * 1.2;
      separate(ball, g, 60);
    }

    if (g.template === "LAUNCH" && dist < 56) {
      ball.vx = Math.cos(g.angle) * 7.2 * g.power;
      ball.vy = Math.sin(g.angle) * 7.2 * g.power;
      separate(ball, g, 62);
    }

    if (g.template === "SHAPE") {
      collideLine(g.x, g.y, g.angle, 145, 0.76);
    }

    if (g.template === "WARP" && dist < 42 && !g.cooldown) {
      ball.x = g.exitX || (WORLD.w - g.x);
      ball.y = g.exitY || (g.y - 260);
      ball.vx *= 0.85;
      ball.vy = Math.min(ball.vy, -3.4);
      g.cooldown = 50;
      log(`${g.name}：ワープ成功`);
    }
    if (g.cooldown) g.cooldown -= 1;

    if (g.template === "PHASE" && dist < 50) {
      ball.phaseUntil = state.time + 2.8;
      ball.vy -= 1.2;
    }

    if (g.template === "ROTATE") {
      const angle = g.angle + (g.spin || 0);
      collideLine(g.x, g.y, angle, 130, 1.1);
    }

    if (g.template === "SWITCH" && dist < 54 && !g.cooldown) {
      for (const other of state.gimmicks) {
        if (other.id !== g.id && Math.hypot(other.x - g.x, other.y - g.y) < 220) {
          other.angle += Math.PI / 5;
        }
      }
      g.cooldown = 60;
      log(`${g.name}：近くのギミックの向きが変わった`);
    }
  }
}

function separate(ball, g, distance) {
  const dx = ball.x - g.x;
  const dy = ball.y - g.y;
  const len = Math.hypot(dx, dy) || 1;
  ball.x = g.x + (dx / len) * distance;
  ball.y = g.y + (dy / len) * distance;
}

function collideLine(cx, cy, angle, length, bounce) {
  const ball = state.ball;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const vx = ball.x - cx;
  const vy = ball.y - cy;
  const proj = Math.max(-length / 2, Math.min(length / 2, vx * ux + vy * uy));
  const px = cx + ux * proj;
  const py = cy + uy * proj;
  const dx = ball.x - px;
  const dy = ball.y - py;
  const dist = Math.hypot(dx, dy);
  if (dist < ball.r + 7) {
    const nx = dx / Math.max(1, dist);
    const ny = dy / Math.max(1, dist);
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= (1 + bounce) * dot * nx;
      ball.vy -= (1 + bounce) * dot * ny;
      ball.x = px + nx * (ball.r + 8);
      ball.y = py + ny * (ball.r + 8);
    }
  }
}

function checkEmojiCollection() {
  const ball = state.ball;
  const remaining = [];
  for (const emoji of state.emojis) {
    const hit = Math.hypot(ball.x - emoji.x, ball.y - emoji.y) < ball.r + emoji.r;
    if (hit) {
      state.inventory.push({ emoji: emoji.emoji, name: emoji.name, uid: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}` });
      log(`素材回収：${emoji.emoji} ${emoji.name}`);
    } else {
      remaining.push(emoji);
    }
  }
  state.emojis = remaining;
}

function checkGoals() {
  const ball = state.ball;
  for (const own of state.ownGoals) {
    if (isInsideRect(ball, own)) {
      state.phase = "gameover";
      log("オウンゴール。手は使ってないのに終わりました。");
      renderAll();
      return;
    }
  }

  for (const goal of state.goals) {
    if (!goal.done && isInsideRect(ball, goal)) {
      goal.done = true;
      ball.vy = Math.min(ball.vy, -5.5);
      ball.vx += (goal.x < WORLD.w / 2 ? 2 : -2);
      log(`GOAL ${goal.label} 通過！`);
    }
  }

  if (state.goals.every((goal) => goal.done)) {
    completeRound();
  }
}

function isInsideRect(ball, rect) {
  return Math.abs(ball.x - rect.x) < rect.w / 2 && Math.abs(ball.y - rect.y) < rect.h / 2;
}

function renderAll() {
  renderHud();
  renderInventory();
  renderSelection();
  renderGimmicks();
  renderLogs();
  draw();
}

function renderHud() {
  const done = state.goals.filter((g) => g.done).length;
  els.roundValue.textContent = state.round;
  els.goalValue.textContent = `${done}/${state.goals.length}`;
  els.emojiValue.textContent = state.inventory.length;
  els.phaseValue.textContent = state.phase === "run" ? "試走" : state.phase === "gameover" ? "終了" : "編集";
  els.runBtn.disabled = state.phase === "run" || state.phase === "gameover";
  els.editBtn.disabled = state.phase === "edit";
  els.generateBtn.disabled = state.selected.length !== 3;
  if (state.phase === "gameover") {
    els.coachLine.textContent = "オウンゴールで試合終了。最初から再挑戦できます。";
    els.subLine.textContent = "赤いゴールは罠。近くの素材ほど危険です。";
  } else if (state.phase === "run") {
    els.coachLine.textContent = "試走中。ボールの軌道と素材回収を見よう。";
    els.subLine.textContent = "観戦中も絵文字選択と生成は可能。配置は編集フェーズで。";
  } else {
    els.coachLine.textContent = state.placingId ? "配置先をタップ。既存ギミックはドラッグで調整できます。" : "編集フェーズ。ギミックを選んでピッチに配置。";
    els.subLine.textContent = "全ゴール通過で新ラウンド。灰色ゴールは次ラウンドで復活します。";
  }
}

function renderInventory() {
  els.emojiInventory.replaceChildren();
  for (const item of state.inventory) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-card";
    button.textContent = item.emoji;
    button.title = item.name || item.emoji;
    if (state.selected.some((selected) => selected.uid === item.uid)) button.classList.add("is-selected");
    button.addEventListener("click", () => toggleEmoji(item));
    els.emojiInventory.appendChild(button);
  }
}

function toggleEmoji(item) {
  const index = state.selected.findIndex((selected) => selected.uid === item.uid);
  if (index >= 0) {
    state.selected.splice(index, 1);
  } else if (state.selected.length < 3) {
    state.selected.push(item);
  } else {
    state.selected.shift();
    state.selected.push(item);
  }
  renderAll();
}

function renderSelection() {
  els.selectedTray.replaceChildren();
  els.selectionHint.textContent = `${state.selected.length}/3`;
  for (let i = 0; i < 3; i += 1) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "selected-chip";
    const item = state.selected[i];
    if (item) {
      chip.textContent = item.emoji;
      chip.title = item.name || item.emoji;
      chip.addEventListener("click", () => {
        state.selected = state.selected.filter((selected) => selected.uid !== item.uid);
        renderAll();
      });
    } else {
      chip.textContent = "空";
      chip.classList.add("empty");
    }
    els.selectedTray.appendChild(chip);
  }
}

function renderGimmicks() {
  els.gimmickList.replaceChildren();
  if (!state.gimmicks.length) {
    const empty = document.createElement("div");
    empty.className = "log-line";
    empty.textContent = "まだギミックがありません。絵文字3つで生成しよう。";
    els.gimmickList.appendChild(empty);
    return;
  }

  for (const g of state.gimmicks) {
    const card = document.createElement("article");
    card.className = "gimmick-card";
    if (state.placingId === g.id) card.classList.add("is-placing");
    const meta = TEMPLATE_META[g.template];
    card.innerHTML = `
      <div class="gimmick-main">
        <span class="gimmick-icon">${g.recipe.join("")}</span>
        <span>
          <span class="gimmick-name">${escapeHtml(g.name)}</span>
          <span class="gimmick-desc">${meta.icon} ${meta.label} / ${g.placed ? "配置済み" : "未配置"}</span>
        </span>
      </div>
      <div class="gimmick-actions">
        <button type="button" data-action="place">${g.placed ? "動かす" : "置く"}</button>
        <button type="button" data-action="rotate">↻</button>
        <button type="button" data-action="stash">しまう</button>
      </div>
    `;
    card.querySelector('[data-action="place"]').addEventListener("click", () => {
      state.placingId = g.id;
      renderAll();
    });
    card.querySelector('[data-action="rotate"]').addEventListener("click", () => {
      g.angle += Math.PI / 8;
      renderAll();
    });
    card.querySelector('[data-action="stash"]').addEventListener("click", () => {
      g.placed = false;
      if (state.placingId === g.id) state.placingId = null;
      renderAll();
    });
    els.gimmickList.appendChild(card);
  }
}

function renderLogs() {
  els.logList.replaceChildren();
  for (const logText of state.logs) {
    const row = document.createElement("div");
    row.className = "log-line";
    row.textContent = logText;
    els.logList.appendChild(row);
  }
}

function draw() {
  if (!state) return;
  fitCanvasPixels();
  const viewW = canvas.width;
  const viewH = canvas.height;
  const scale = viewW / WORLD.w;
  const viewWorldH = viewH / scale;
  const minCameraY = Math.min(-200, state.ball.y - viewWorldH * 0.72);
  const maxCameraY = getFallLine() - viewWorldH + 180;
  state.cameraY = Math.max(minCameraY, Math.min(maxCameraY, state.cameraY));

  ctx.clearRect(0, 0, viewW, viewH);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(0, -state.cameraY);

  drawField(viewWorldH);
  for (const emoji of state.emojis) drawEmoji(emoji);
  for (const goal of state.goals) drawGoal(goal);
  for (const own of state.ownGoals) drawOwnGoal(own);
  for (const g of state.gimmicks) if (g.placed) drawGimmick(g);
  drawBall();

  ctx.restore();
  drawOverlay();
}

function fitCanvasPixels() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(320, Math.floor(rect.width * dpr));
  const h = Math.max(320, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function drawField(viewWorldH) {
  const top = state.cameraY - 80;
  const bottom = state.cameraY + viewWorldH + 80;
  ctx.fillStyle = "#116337";
  ctx.fillRect(0, top, WORLD.w, bottom - top);
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = 2;
  for (let y = Math.floor(top / 80) * 80; y < bottom; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(231,255,91,.28)";
  ctx.lineWidth = 5;
  ctx.strokeRect(14, top, WORLD.w - 28, bottom - top);

  const fall = getFallLine();
  ctx.fillStyle = "rgba(255,92,108,.14)";
  ctx.fillRect(0, fall, WORLD.w, 80);
  ctx.strokeStyle = "rgba(255,92,108,.8)";
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.moveTo(0, fall);
  ctx.lineTo(WORLD.w, fall);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.font = "700 24px system-ui";
  ctx.fillText("落下ライン", 28, fall - 12);
}

function drawGoal(goal) {
  ctx.save();
  ctx.translate(goal.x, goal.y);
  ctx.globalAlpha = goal.done ? 0.42 : 1;
  ctx.strokeStyle = goal.done ? "rgba(220,230,220,.75)" : "#e7ff5b";
  ctx.fillStyle = goal.done ? "rgba(220,230,220,.12)" : "rgba(231,255,91,.14)";
  ctx.lineWidth = 9;
  roundRect(-goal.w / 2, -goal.h / 2, goal.w, goal.h, 18);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = goal.done ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.36)";
  for (let x = -goal.w / 2 + 18; x < goal.w / 2; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, -goal.h / 2);
    ctx.lineTo(x, goal.h / 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  ctx.font = "900 20px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(goal.done ? "CLEAR" : `GOAL ${goal.label}`, 0, -goal.h / 2 - 12);
  ctx.restore();
}

function drawOwnGoal(goal) {
  ctx.save();
  ctx.translate(goal.x, goal.y);
  ctx.strokeStyle = "#ff5c6c";
  ctx.fillStyle = "rgba(255,92,108,.18)";
  ctx.lineWidth = 8;
  roundRect(-goal.w / 2, -goal.h / 2, goal.w, goal.h, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "900 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("OWN GOAL", 0, -goal.h / 2 - 10);
  ctx.restore();
}

function drawEmoji(emoji) {
  ctx.save();
  ctx.translate(emoji.x, emoji.y);
  ctx.fillStyle = "rgba(255,255,255,.20)";
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "28px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji.emoji, 0, 1);
  ctx.restore();
}

function drawGimmick(g) {
  const meta = TEMPLATE_META[g.template];
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.angle + (g.template === "ROTATE" ? (g.spin || 0) : 0));
  ctx.strokeStyle = meta.color;
  ctx.fillStyle = `${meta.color}33`;
  ctx.lineWidth = state.placingId === g.id ? 8 : 5;

  if (g.template === "FLOW" || g.template === "ATTACH") {
    ctx.beginPath();
    ctx.arc(0, 0, g.template === "ATTACH" ? 92 : 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawArrow(0, 0, 58, meta.color);
  } else if (g.template === "WARP") {
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-g.angle);
    ctx.fillStyle = "#fff";
    ctx.font = "24px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("⇄", 0, 8);
  } else if (g.template === "CARRY") {
    roundRect(-58, -16, 116, 32, 16);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-70, 0);
    ctx.lineTo(70, 0);
    ctx.stroke();
    if (g.template === "LAUNCH" || g.template === "SWITCH") drawArrow(0, 0, 72, meta.color);
  }

  ctx.rotate(-g.angle - (g.template === "ROTATE" ? (g.spin || 0) : 0));
  ctx.fillStyle = "#fff";
  ctx.font = "20px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(meta.icon, 0, -22);
  ctx.restore();
}

function drawArrow(x, y, length, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - length / 2, y);
  ctx.lineTo(x + length / 2, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + length / 2 + 8, y);
  ctx.lineTo(x + length / 2 - 12, y - 10);
  ctx.lineTo(x + length / 2 - 12, y + 10);
  ctx.closePath();
  ctx.fill();
}

function drawBall() {
  const b = state.ball;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#101510";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#111";
  ctx.font = "18px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⚽", 0, 1);
  if (b.phaseUntil > state.time) {
    ctx.strokeStyle = "rgba(200,216,255,.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, b.r + 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOverlay() {
  if (!state.placingId) return;
  const g = state.gimmicks.find((item) => item.id === state.placingId);
  if (!g) return;
  ctx.save();
  ctx.fillStyle = "rgba(6,19,13,.76)";
  ctx.fillRect(12, 12, Math.min(canvas.width - 24, 540), 52);
  ctx.fillStyle = "#e7ff5b";
  ctx.font = "900 20px system-ui";
  ctx.fillText(`配置中：${g.recipe.join("")} ${g.name}`, 28, 46);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
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

function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const dprX = canvas.width / rect.width;
  const dprY = canvas.height / rect.height;
  const sx = (clientX - rect.left) * dprX;
  const sy = (clientY - rect.top) * dprY;
  const scale = canvas.width / WORLD.w;
  return { x: sx / scale, y: sy / scale + state.cameraY };
}

function hitGimmick(point) {
  return [...state.gimmicks].reverse().find((g) => g.placed && Math.hypot(g.x - point.x, g.y - point.y) < 70);
}

function onCanvasDown(event) {
  event.preventDefault();
  if (!state || state.phase === "run" || state.phase === "gameover") return;
  const point = canvasToWorld(event.clientX, event.clientY);
  const placing = state.gimmicks.find((g) => g.id === state.placingId);
  if (placing) {
    placing.x = Math.max(42, Math.min(WORLD.w - 42, point.x));
    placing.y = point.y;
    placing.placed = true;
    state.placingId = null;
    log(`${placing.name}を配置。`);
    renderAll();
    return;
  }
  const hit = hitGimmick(point);
  if (hit) {
    state.draggingId = hit.id;
    state.dragOffset = { x: hit.x - point.x, y: hit.y - point.y };
  }
}

function onCanvasMove(event) {
  if (!state?.draggingId || state.phase !== "edit") return;
  event.preventDefault();
  const point = canvasToWorld(event.clientX, event.clientY);
  const g = state.gimmicks.find((item) => item.id === state.draggingId);
  if (!g) return;
  g.x = Math.max(42, Math.min(WORLD.w - 42, point.x + state.dragOffset.x));
  g.y = point.y + state.dragOffset.y;
  draw();
}

function onCanvasUp() {
  if (state?.draggingId) {
    state.draggingId = null;
    renderAll();
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function loop(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(0.033, (ts - state.lastTs) / 1000);
  state.lastTs = ts;
  update(dt);
  draw();
  renderHud();
  requestAnimationFrame(loop);
}

function boot() {
  state = newState();
  grantEmojis(8, "初期支給");
  addFieldEmojis(5);
  log("プロトタイプ版。AI生成はまだローカル雛形で代用中。");
  renderAll();
  requestAnimationFrame(loop);
}

els.startBtn.addEventListener("click", () => {
  els.titleCard.scrollIntoView({ behavior: "smooth", block: "start" });
  startRun();
});

els.runBtn.addEventListener("click", startRun);
els.editBtn.addEventListener("click", () => enterEdit("手動で編集フェーズへ。"));
els.resetBtn.addEventListener("click", () => {
  state = newState();
  grantEmojis(8, "初期支給");
  addFieldEmojis(5);
  log("最初から再開。");
  renderAll();
});
els.rewardBtn.addEventListener("click", () => grantEmojis(3, "試作用支給"));
els.generateBtn.addEventListener("click", generateGimmick);
els.demoBtn.addEventListener("click", placeDemo);

canvas.addEventListener("pointerdown", onCanvasDown, { passive: false });
canvas.addEventListener("pointermove", onCanvasMove, { passive: false });
canvas.addEventListener("pointerup", onCanvasUp);
canvas.addEventListener("pointercancel", onCanvasUp);
window.addEventListener("resize", draw);

loadEmojiCatalog();
boot();
