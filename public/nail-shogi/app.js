import {
  BOARD,
  FINGER_NAMES,
  applyCare,
  chooseCpuCommands,
  createInitialState,
  finishCommand,
  getNail,
  setDirection,
} from "./engine.js";

const svg = document.getElementById("boardSvg");
const boardWrap = document.getElementById("boardWrap");
const fxLayer = document.getElementById("fxLayer");
const startScreen = document.getElementById("startScreen");
const gameShell = document.getElementById("gameShell");
const rulesDialog = document.getElementById("rulesDialog");
const rulesBtn = document.getElementById("rulesBtn");
const handoff = document.getElementById("handoff");
const handoffBtn = document.getElementById("handoffBtn");
const handoffText = document.getElementById("handoffText");
const resultScreen = document.getElementById("resultScreen");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const rematchBtn = document.getElementById("rematchBtn");
const liveRegion = document.getElementById("liveRegion");
const roundValue = document.getElementById("roundValue");
const turnText = document.getElementById("turnText");
const careCount = document.getElementById("careCount");
const turnBanner = document.getElementById("turnBanner");
const selectedFingerName = document.getElementById("selectedFingerName");
const selectedState = document.getElementById("selectedState");
const boardHint = document.getElementById("boardHint");
const directionPad = document.getElementById("directionPad");
const careGrid = document.getElementById("careGrid");
const commitBtn = document.getElementById("commitBtn");
const captureEls = [document.getElementById("capture0"), document.getElementById("capture1")];
const playerCards = [document.getElementById("player0Card"), document.getElementById("player1Card")];
const player1Label = document.getElementById("player1Label");
const player1Name = document.getElementById("player1Name");
const gelStock = document.getElementById("gelStock");
const hookStock = document.getElementById("hookStock");
const sculptStock = document.getElementById("sculptStock");

const NS = "http://www.w3.org/2000/svg";
const CELL_W = 100;
const CELL_H = 100;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let state = null;
let mode = "cpu";
let selectedFinger = 0;
let selectedSegment = null;
let busy = false;

const svgEl = (name, attrs = {}) => {
  const el = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
};

const centerOf = (cell) => ({ x: cell.x * CELL_W + CELL_W / 2, y: cell.y * CELL_H + CELL_H / 2 });
const visualArrow = (player, dir) => {
  if (player === 0) return dir === -1 ? "↖" : dir === 0 ? "↑" : "↗";
  return dir === -1 ? "↙" : dir === 0 ? "↓" : "↘";
};

function beginGame(nextMode) {
  mode = nextMode;
  state = createInitialState({ mode });
  selectedFinger = 0;
  selectedSegment = null;
  busy = false;
  player1Label.textContent = mode === "cpu" ? "CPU / P2" : "P2";
  player1Name.textContent = mode === "cpu" ? "CPU" : "プレイヤー2";
  startScreen.hidden = true;
  gameShell.hidden = false;
  resultScreen.hidden = true;
  render();
  queueCpuIfNeeded();
}

function segmentDescription(nail) {
  if (!nail?.alive) return "詰み・退場";
  const tip = nail.materials[nail.materials.length - 1];
  const labels = [];
  if (tip?.sharpened) labels.push("研ぎ済み");
  if (tip?.gel) labels.push("ジェル先端");
  if (tip?.kind === "hook") labels.push("鉤爪先端");
  if (tip?.kind === "sculpt") labels.push("スカルプ先端");
  if (nail.hiddenThisRound) labels.push("隠し中");
  return labels.length ? labels.join("・") : `長さ ${nail.path.length}`;
}

function drawGrid() {
  for (let y = 0; y < BOARD.rows; y += 1) {
    for (let x = 0; x < BOARD.cols; x += 1) {
      svg.appendChild(svgEl("rect", {
        x: x * CELL_W,
        y: y * CELL_H,
        width: CELL_W,
        height: CELL_H,
        class: `grid-cell ${(x + y) % 2 ? "alt" : ""}`,
      }));
    }
  }
}

function drawFinger(player, fingerIndex, captured) {
  const nail = getNail(state, player, fingerIndex);
  const cell = player === 0 ? { x: [0,2,4,6,8][fingerIndex], y: 7 } : { x: [1,3,5,7,9][fingerIndex], y: 0 };
  const cx = cell.x * CELL_W + 50;
  const cy = cell.y * CELL_H + 50;
  const g = svgEl("g", { class: "finger", "data-player": player, "data-finger": fingerIndex, role: "button", tabindex: "0", "aria-label": `${player === 0 ? "プレイヤー1" : "プレイヤー2"} ${FINGER_NAMES[fingerIndex]}` });
  const y = player === 0 ? cy + 23 : cy - 77;
  g.appendChild(svgEl("rect", { x: cx - 31, y, width: 62, height: 108, rx: 31, class: `finger-body p${player} ${captured ? "captured" : ""}` }));
  if (captured) {
    g.appendChild(svgEl("line", { x1: cx - 24, y1: cy - 24, x2: cx + 24, y2: cy + 24, stroke: "#221e1a", "stroke-width": 5 }));
    g.appendChild(svgEl("line", { x1: cx + 24, y1: cy - 24, x2: cx - 24, y2: cy + 24, stroke: "#221e1a", "stroke-width": 5 }));
  }
  if (nail?.alive && state.commander === player) {
    const text = svgEl("text", { x: cx, y: player === 0 ? cy + 45 : cy - 32, "text-anchor": "middle", class: "finger-label" });
    text.textContent = fingerIndex + 1;
    g.appendChild(text);
  }
  g.addEventListener("click", () => selectFinger(player, fingerIndex));
  g.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectFinger(player, fingerIndex);
    }
  });
  svg.appendChild(g);
}

function drawNail(nail) {
  if (!nail.alive || !nail.path.length) return;
  if (nail.path.length > 1) {
    const points = nail.path.map(centerOf).map((p) => `${p.x},${p.y}`).join(" ");
    svg.appendChild(svgEl("polyline", { points, class: `nail-link p${nail.player}` }));
  }

  nail.path.forEach((cell, index) => {
    const center = centerOf(cell);
    const material = nail.materials[index] || { kind: "bare" };
    const cls = [
      "nail-segment",
      `p${nail.player}`,
      material.kind,
      material.gel ? "gel" : "",
      material.sharpened ? "sharp" : "",
      nail.hiddenThisRound ? "hidden" : "",
      nail.player === state.commander && nail.fingerIndex === selectedFinger && index === selectedSegment ? "selected" : "",
    ].filter(Boolean).join(" ");
    const rect = svgEl("rect", {
      x: center.x - 18,
      y: center.y - 29,
      width: 36,
      height: 58,
      rx: 17,
      class: cls,
      transform: `rotate(${nail.player === 0 ? 0 : 180} ${center.x} ${center.y})`,
      tabindex: nail.player === state.commander ? "0" : "-1",
      role: "button",
      "aria-label": `${FINGER_NAMES[nail.fingerIndex]} 爪 ${index + 1}節目`,
    });
    rect.addEventListener("click", (event) => {
      event.stopPropagation();
      selectFinger(nail.player, nail.fingerIndex);
      selectedSegment = index;
      render();
    });
    rect.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && nail.player === state.commander) {
        event.preventDefault();
        selectedFinger = nail.fingerIndex;
        selectedSegment = index;
        render();
      }
    });
    svg.appendChild(rect);
  });

  if (nail.player === state.commander && nail.fingerIndex === selectedFinger) {
    const tip = centerOf(nail.path[nail.path.length - 1]);
    const dy = nail.player === 0 ? -1 : 1;
    const ghost = { x: tip.x + nail.direction * CELL_W, y: tip.y + dy * CELL_H };
    if (ghost.x >= 0 && ghost.x <= 1000 && ghost.y >= 0 && ghost.y <= 800) {
      svg.appendChild(svgEl("circle", { cx: ghost.x, cy: ghost.y, r: 14, class: "direction-ghost" }));
    }
  }
}

function renderBoard() {
  svg.replaceChildren();
  drawGrid();
  for (let player = 0; player < 2; player += 1) {
    for (let finger = 0; finger < 5; finger += 1) {
      drawFinger(player, finger, state.capturedFingers[player].includes(finger));
    }
  }
  state.nails.forEach(drawNail);
}

function renderPips() {
  captureEls.forEach((container, player) => {
    container.replaceChildren();
    for (let i = 0; i < BOARD.capturesToWin; i += 1) {
      const pip = document.createElement("i");
      if (i < state.captures[player]) pip.classList.add("on");
      container.appendChild(pip);
    }
  });
}

function renderControls() {
  const player = state.commander;
  const nail = getNail(state, player, selectedFinger);
  if (!nail?.alive) {
    const firstAlive = state.nails.find((item) => item.player === player && item.alive);
    if (firstAlive) selectedFinger = firstAlive.fingerIndex;
  }
  const selected = getNail(state, player, selectedFinger);
  selectedFingerName.textContent = selected ? FINGER_NAMES[selectedFinger] : "—";
  selectedState.textContent = segmentDescription(selected);

  const arrows = directionPad.querySelectorAll("button");
  arrows.forEach((button) => {
    const dir = Number(button.dataset.dir);
    button.textContent = visualArrow(player, dir);
    button.classList.toggle("is-selected", selected?.direction === dir);
    button.disabled = busy || !selected?.alive || state.phase !== "command";
  });

  gelStock.textContent = `×${state.stock[player].gel}`;
  hookStock.textContent = `×${state.stock[player].hook}`;
  sculptStock.textContent = `×${state.stock[player].sculpt}`;

  careGrid.querySelectorAll("button").forEach((button) => {
    const type = button.dataset.care;
    let disabled = busy || !selected?.alive || selected?.careUsedThisRound || state.careRemaining[player] <= 0 || state.phase !== "command";
    if (type === "gel" && state.stock[player].gel <= 0) disabled = true;
    if (type === "hook" && state.stock[player].hook <= 0) disabled = true;
    if (type === "sculpt" && state.stock[player].sculpt <= 0) disabled = true;
    if (type === "hide" && selected?.hidLastRound) disabled = true;
    if (type === "cut" && selected?.path.length <= 1) disabled = true;
    button.disabled = disabled;
  });
  commitBtn.disabled = busy || state.phase !== "command" || (mode === "cpu" && player === 1);
}

function renderHeader() {
  roundValue.textContent = state.round;
  const isCpu = mode === "cpu" && state.commander === 1;
  turnText.textContent = isCpu ? "CPUが考えています" : `${state.commander === 0 ? "プレイヤー1" : "プレイヤー2"}の操作`;
  careCount.textContent = `ケア ${state.careRemaining[state.commander]} / ${BOARD.carePerTurn}`;
  turnBanner.querySelector(".turn-dot").style.background = state.commander === 0 ? "var(--a)" : "var(--b)";
  playerCards.forEach((card, player) => { card.style.opacity = state.commander === player ? "1" : ".56"; });
  renderPips();
}

function render() {
  if (!state) return;
  renderHeader();
  renderBoard();
  renderControls();
}

function selectFinger(player, fingerIndex) {
  if (!state || busy || state.phase !== "command" || state.commander !== player) return;
  const nail = getNail(state, player, fingerIndex);
  if (!nail?.alive) return;
  selectedFinger = fingerIndex;
  selectedSegment = nail.path.length - 1;
  render();
}

function announce(message) {
  liveRegion.textContent = "";
  requestAnimationFrame(() => { liveRegion.textContent = message; });
}

function careMessage(type) {
  return ({
    sharpen: "先端を研ぎました",
    gel: "ジェルを塗りました",
    hook: "根元に鉤爪を仕込みました",
    sculpt: "スカルプを装着しました",
    hide: "このラウンド、爪を隠します",
    cut: "先端を切りました",
  })[type] || "ケアしました";
}

directionPad.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-dir]");
  if (!button || !state) return;
  if (setDirection(state, state.commander, selectedFinger, Number(button.dataset.dir))) {
    selectedSegment = getNail(state, state.commander, selectedFinger)?.path.length - 1 ?? null;
    render();
  }
});

careGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-care]");
  if (!button || !state) return;
  const type = button.dataset.care;
  const options = type === "gel"
    ? { segmentIndex: selectedSegment ?? getNail(state, state.commander, selectedFinger)?.path.length - 1 }
    : {};
  const result = applyCare(state, state.commander, selectedFinger, type, options);
  if (!result.ok) {
    boardHint.textContent = result.reason === "hide-cooldown"
      ? "隠すは同じ指に2ラウンド連続では使えません。"
      : "そのケアは今は使えません。";
    return;
  }
  boardHint.textContent = careMessage(type);
  announce(`${FINGER_NAMES[selectedFinger]}。${careMessage(type)}`);
  render();
});

async function commitCurrentPlayer() {
  if (!state || busy || state.phase !== "command") return;
  busy = true;
  commitBtn.disabled = true;
  const player = state.commander;
  const result = finishCommand(state, player);
  if (!result.ok) {
    busy = false;
    render();
    return;
  }

  if (!result.resolved) {
    busy = false;
    selectedFinger = 0;
    selectedSegment = null;
    if (mode === "local") {
      handoffText.textContent = `プレイヤー${state.commander + 1}へ端末を渡してください`;
      handoff.hidden = false;
    }
    render();
    queueCpuIfNeeded();
    return;
  }

  await playEvents(result.events || []);
  busy = false;
  selectedFinger = 0;
  selectedSegment = null;
  render();
  if (result.winner != null) showResult(result.winner);
  else queueCpuIfNeeded();
}

commitBtn.addEventListener("click", commitCurrentPlayer);
handoffBtn.addEventListener("click", () => {
  handoff.hidden = true;
  render();
});

function queueCpuIfNeeded() {
  if (!state || mode !== "cpu" || state.phase !== "command" || state.commander !== 1 || busy) return;
  busy = true;
  render();
  window.setTimeout(async () => {
    chooseCpuCommands(state, 1);
    const result = finishCommand(state, 1);
    if (result.resolved) await playEvents(result.events || []);
    busy = false;
    selectedFinger = 0;
    selectedSegment = null;
    render();
    if (result.winner != null) showResult(result.winner);
    else if (state.commander === 1) queueCpuIfNeeded();
  }, reduceMotion ? 80 : 520);
}

async function playEvents(events) {
  const captures = events.filter((event) => event.type === "capture");
  const collisions = events.filter((event) => event.type.includes("collision"));
  if (collisions.length && !captures.length) {
    boardWrap.classList.remove("is-hit");
    void boardWrap.offsetWidth;
    boardWrap.classList.add("is-hit");
    boardHint.textContent = collisions.some((event) => event.p === event.d)
      ? "相打ち！ 両方の爪が折れた。"
      : "爪がぶつかった！";
    await wait(reduceMotion ? 30 : 180);
  }
  for (const event of captures) await playCapture(event);
}

function makeFx(className, left, top) {
  const el = document.createElement("span");
  el.className = className;
  el.style.left = `${left}%`;
  el.style.top = `${top}%`;
  fxLayer.appendChild(el);
  return el;
}

async function playCapture(event) {
  fxLayer.replaceChildren();
  boardWrap.classList.remove("is-hit");
  void boardWrap.offsetWidth;
  boardWrap.classList.add("is-hit");
  const left = (event.cell.x + .5) / BOARD.cols * 100;
  const top = (event.cell.y + .5) / BOARD.rows * 100;
  const pop = makeFx("capture-pop", left - 3.6, top - 7);
  pop.style.background = event.defenderPlayer === 0 ? "#fff0eb" : "#eaf8f4";
  const word = makeFx("capture-word", Math.max(4, Math.min(79, left - 8)), Math.max(5, top - 10));
  word.textContent = "詰み！";

  if (!reduceMotion) {
    event.attackPath.forEach((cell, index) => {
      const px = (cell.x + .5) / BOARD.cols * 100;
      const py = (cell.y + .5) / BOARD.rows * 100;
      const piece = makeFx("fracture-piece", px - 2.75, py - 4.2);
      piece.style.setProperty("--dx", `${(Math.random() * 70 - 35).toFixed(0)}px`);
      piece.style.setProperty("--dy", `${(-30 - Math.random() * 80).toFixed(0)}px`);
      piece.style.setProperty("--rot", `${(Math.random() * 160 - 80).toFixed(0)}deg`);
      piece.style.animationDelay = `${90 + index * 34}ms`;
    });
    for (let i = 0; i < 9; i += 1) {
      const spark = makeFx("spark-piece", left, top);
      spark.style.setProperty("--dx", `${Math.cos(i / 9 * Math.PI * 2) * (35 + Math.random() * 35)}px`);
      spark.style.setProperty("--dy", `${Math.sin(i / 9 * Math.PI * 2) * (35 + Math.random() * 35)}px`);
    }
  }

  boardHint.textContent = `${FINGER_NAMES[event.defenderFinger]}を詰めた！ 攻めた爪も根元まで折れる。`;
  announce(`${event.attackerPlayer === 0 ? "プレイヤー1" : "プレイヤー2"}が${FINGER_NAMES[event.defenderFinger]}を詰めました。`);
  await wait(reduceMotion ? 160 : 650);
  fxLayer.replaceChildren();
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function showResult(winner) {
  resultScreen.hidden = false;
  if (winner === "draw") {
    resultTitle.textContent = "同時詰み";
    resultText.textContent = "同じ成長で双方が2本目を詰めました。今回は引き分け。";
    return;
  }
  const youWin = winner === 0;
  resultTitle.textContent = mode === "cpu"
    ? (youWin ? "勝利！" : "敗北")
    : `プレイヤー${winner + 1} 勝利`;
  resultText.textContent = `${state.captures[winner]}本の指を詰めて決着。`;
}

rulesBtn.addEventListener("click", () => rulesDialog.showModal());
rematchBtn.addEventListener("click", () => beginGame(mode));
document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => beginGame(button.dataset.mode));
});

window.addEventListener("keydown", (event) => {
  if (!state || gameShell.hidden || busy || state.phase !== "command") return;
  if (["ArrowLeft", "ArrowUp", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    const dir = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    setDirection(state, state.commander, selectedFinger, dir);
    render();
  }
  if (event.key >= "1" && event.key <= "5") {
    selectFinger(state.commander, Number(event.key) - 1);
  }
});
