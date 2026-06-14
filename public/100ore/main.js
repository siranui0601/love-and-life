const refs = {
  cover: document.getElementById("coverScreen"),
  game: document.getElementById("gameScreen"),
  start: document.getElementById("startBtn"),
  rankingTop: document.getElementById("rankingBtnTop"),
  ranking: document.getElementById("rankingBtn"),
  pageBadge: document.getElementById("dayBadge"),
  status: document.getElementById("statusBar"),
  title: document.getElementById("title"),
  story: document.getElementById("storyText"),
  scene: document.getElementById("storySoFar"),
  history: document.getElementById("historyList"),
  stage: document.getElementById("pictureStage"),
  viewport: document.getElementById("stageViewport"),
  img: document.getElementById("pageImage"),
  fallbackNotice: document.getElementById("imageFallbackNotice"),
  canvas: document.getElementById("drawCanvas"),
  overlay: document.getElementById("canvasOverlay"),
  stock: document.getElementById("canvasStock"),
  placedList: document.getElementById("placedList"),
  color: document.getElementById("colorInput"),
  size: document.getElementById("sizeInput"),
  zoom: document.getElementById("zoomInput"),
  angle: document.getElementById("angleInput"),
  confirm: document.getElementById("confirmBtn"),
  undo: document.getElementById("undoBtn"),
  redo: document.getElementById("redoBtn"),
  clear: document.getElementById("clearBtn"),
  loading: document.getElementById("loadingVeil"),
  loadingText: document.getElementById("loadingText"),
  rankingDialog: document.getElementById("rankingDialog"),
  rankingList: document.getElementById("rankingList"),
  closeRanking: document.getElementById("closeRankingBtn"),
  runDialog: document.getElementById("runDialog"),
  runTitle: document.getElementById("runTitle"),
  runViewer: document.getElementById("runViewer"),
  closeRun: document.getElementById("closeRunBtn"),
  flip: document.getElementById("flipPanelBtn"),
  panelTitle: document.getElementById("panelTitle"),
  canvasPanel: document.getElementById("canvasPanel"),
  penPanel: document.getElementById("penPanel"),
  deletePlacement: document.getElementById("deletePlacementBtn"),
};

const ctx = refs.canvas.getContext("2d", { willReadFrequently: true });
const shapes = [
  { shape: "square", label: "小さな正方形", w: 0.24, h: 0.24 },
  { shape: "square", label: "大きな正方形", w: 0.38, h: 0.38 },
  { shape: "rect", label: "横長長方形", w: 0.46, h: 0.24 },
  { shape: "rect", label: "縦長長方形", w: 0.25, h: 0.48 },
  { shape: "circle", label: "円形", w: 0.34, h: 0.34 },
  { shape: "rect", label: "細長い帯", w: 0.62, h: 0.16 },
  { shape: "rounded", label: "角丸長方形", w: 0.42, h: 0.28 },
];
const state = {
  runId: null,
  pageNumber: 1,
  current: null,
  pages: [],
  stock: [],
  selected: null,
  placements: [],
  activePlacementId: null,
  strokes: [],
  currentStroke: null,
  pointerMode: null,
  pointerStart: null,
  tool: "pen",
  editMode: "canvas",
  undo: [],
  redo: [],
  gameOver: false,
  rewriting: false,
  loadingTimers: [],
  viewport: { zoom: 1, panX: 0, panY: 0 },
};

function getUser() {
  try { return JSON.parse(localStorage.getItem("currentUser") || "null") || {}; } catch { return {}; }
}
function setStatus(text) { refs.status.textContent = text; }
function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c])); }
const AI_LABEL_IMAGE_SIZE = 512;
const AI_LABEL_IMAGE_QUALITY = 0.72;

// ラベル判定用：落書き周辺だけを切り出す時の設定
const LABEL_CROP_LONG_SIDE = 512;
const LABEL_CROP_PADDING_RATIO = 1.0;
const LABEL_CROP_MIN_PADDING = 32;

function pageImageSrc(page = {}) {
  if (page.imageDataUrl) return String(page.imageDataUrl);
  if (page.imageUrl) return String(page.imageUrl);
  if (page.imageDriveUrl) return String(page.imageDriveUrl);
  if (page.imageFileId) return `/api/100ore/images/${encodeURIComponent(page.imageFileId)}`;
  return "";
}
function savedPage(page = {}) {
  return {
    pageNumber: Number(page.pageNumber || 1),
    title: page.title || "",
    bodyText: page.bodyText || "",
    storySoFar: page.storySoFar || "",
    sceneKey: page.sceneKey || "",
    imageHash: page.imageHash || "",
    imageFileId: page.imageFileId || "",
    imageDriveUrl: page.imageDriveUrl || "",
    imageUrl: page.imageUrl || "",
    gameOver: Boolean(page.gameOver),
    changeLabels: Array.isArray(page.changeLabels) ? page.changeLabels : [],
  };
}
function changeLabelsHtml(labels) {
  const safe = Array.isArray(labels) ? labels.filter(Boolean) : [];
  if (!safe.length) return "";
  return `<div class="page-labels">${safe.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>`;
}

function clearLoadingTimers() { state.loadingTimers.forEach((timer) => clearTimeout(timer)); state.loadingTimers = []; }
function setLoading(show, text = "ページの端をめくっています…") { if (!show) clearLoadingTimers(); refs.loading.hidden = !show; refs.loadingText.textContent = text; }
function setLoadingSteps(steps) {
  clearLoadingTimers();
  if (!steps.length) return;
  setLoading(true, steps[0].text);
  steps.slice(1).forEach((step) => state.loadingTimers.push(setTimeout(() => { if (state.rewriting) refs.loadingText.textContent = step.text; }, step.delay)));
}
async function api(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
  return data;
}
async function sha256(buffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomCanvas() {
  const base = shapes[Math.floor(Math.random() * shapes.length)];
  return { ...base, id: `c_${Date.now()}_${Math.random().toString(16).slice(2)}`, power: Math.round(base.w * base.h * 1000) };
}
function fillInitialStock() { while (state.stock.length < 3) state.stock.push(randomCanvas()); renderPanels(); }
function replenishOneStock() { if (state.stock.length < 3) state.stock.push(randomCanvas()); renderPanels(); }
function activePlacement() { return state.placements.find((p) => p.id === state.activePlacementId) || null; }
function setActivePlacement(id) {
  state.activePlacementId = id;
  const p = activePlacement();
  if (refs.angle) refs.angle.value = p ? String(Math.round(p.angle || 0)) : "0";
  renderPanels();
  drawScene();
}
function hasMeaningfulDrawing() {
  return state.placements.some((placement) => placementHasVisibleInk(placement));
}
function updateConfirmState() {
  const hasPlacement = state.placements.length > 0;
  const hasDrawing = hasMeaningfulDrawing();
  refs.confirm.disabled = !hasPlacement || !hasDrawing || state.rewriting || state.gameOver;
  console.debug("[8-15] confirm state", { hasPlacement, hasDrawing, rewriting: state.rewriting, gameOver: state.gameOver, disabled: refs.confirm.disabled });
}
function renderPanels() {
  refs.stock.innerHTML = "";
  state.stock.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `stock-card ${state.selected?.id === item.id ? "active" : ""}`;
    const shape = document.createElement("div");
    shape.className = `stock-shape ${item.shape}`;
    shape.style.width = `${Math.round(item.w * 130)}px`;
    shape.style.height = `${Math.round(item.h * 130)}px`;
    const label = document.createElement("div");
    label.className = "stock-label";
    label.textContent = `${item.label} / 面積${item.power}`;
    card.append(shape, label);
    card.onclick = () => selectCanvas(item);
    card.addEventListener("pointerdown", (e) => startStockDrag(e, item));
    refs.stock.appendChild(card);
  });
  refs.placedList.innerHTML = "";
  state.placements.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `placed-card ${p.id === state.activePlacementId ? "active" : ""}`;
    btn.textContent = `${i + 1}. ${p.label} / ${Math.round(p.angle || 0)}°`;
    btn.onclick = () => setActivePlacement(p.id);
    refs.placedList.appendChild(btn);
  });
  if (!refs.placedList.children.length) refs.placedList.textContent = "まだ置いていません。";
  updateConfirmState();
}
function setEditMode(mode) {
  state.editMode = mode;
  const toPen = mode === "pen";
  refs.penPanel.hidden = !toPen;
  refs.canvasPanel.hidden = toPen;
  refs.panelTitle.textContent = toPen ? "ペンパネル" : "キャンパスパネル";
  refs.flip.textContent = toPen ? "キャンパスパネルへ" : "ペンパネルへ";
  refs.flip.closest(".flip-panel")?.setAttribute("data-side", toPen ? "pen" : "canvas");
  console.debug("[8-15] panel flip", { editMode: state.editMode });
}
function selectCanvas(item) {
  if (state.rewriting || state.gameOver) return;
  state.selected = item;
  state.activePlacementId = null;
  setEditMode("canvas");
  renderPanels();
  drawScene();
  setStatus("ストックを選びました。絵の上を押すかドラッグして置けます。置いた後は直接動かせます。");
}
function startStockDrag(e, item) {
  if (state.rewriting || state.gameOver) return;
  e.preventDefault();
  state.selected = item;
  setEditMode("canvas");
  const ghost = document.createElement("div");
  ghost.className = `drag-ghost ${item.shape}`;
  ghost.style.width = `${Math.max(44, item.w * 170)}px`;
  ghost.style.height = `${Math.max(44, item.h * 170)}px`;
  document.body.appendChild(ghost);
  const move = (ev) => { ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`; };
  const up = (ev) => {
    window.removeEventListener("pointermove", move);
    ghost.remove();
    const p = pointFromEvent(ev);
    if (p.inside) placeCanvas(item, p.x / refs.canvas.width, p.y / refs.canvas.height);
  };
  move(e);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once: true });
}
function canvasPixelsFor(item, xRatio = 0.5, yRatio = 0.5) {
  const w = refs.canvas.width * item.w;
  const h = refs.canvas.height * item.h;
  return { x: refs.canvas.width * xRatio - w / 2, y: refs.canvas.height * yRatio - h / 2, w, h };
}
function clampPlacementBox(p) {
  p.x = Math.max(0, Math.min(1 - p.w, p.x));
  p.y = Math.max(0, Math.min(1 - p.h, p.y));
  return p;
}
function placeCanvas(item, xRatio, yRatio) {
  if (!state.stock.some((stock) => stock.id === item.id)) return;
  const box = canvasPixelsFor(item, xRatio, yRatio);
  const p = clampPlacementBox({
    id: `p_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    sourceCanvasId: item.id,
    x: box.x / refs.canvas.width,
    y: box.y / refs.canvas.height,
    w: box.w / refs.canvas.width,
    h: box.h / refs.canvas.height,
    shape: item.shape,
    label: item.label,
    angle: 0,
  });
  state.placements.push(p);
  state.stock = state.stock.filter((stock) => stock.id !== item.id);
  state.selected = null;
  setActivePlacement(p.id);
  setStatus("置きました。直接ドラッグで移動、右上のハンドルをドラッグで回転できます。");
  updateConfirmState();
}

function eventClientPoint(e) {
  const t = e.touches?.[0] || e.changedTouches?.[0] || e;
  return { clientX: t.clientX, clientY: t.clientY };
}
function pointFromEvent(e) {
  const r = refs.canvas.getBoundingClientRect();
  const t = eventClientPoint(e);
  return {
    x: (t.clientX - r.left) * refs.canvas.width / r.width,
    y: (t.clientY - r.top) * refs.canvas.height / r.height,
    inside: t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom,
  };
}
function clampViewportPan() {
  const zoom = Number(state.viewport.zoom || 1);
  if (zoom <= 1) {
    state.viewport.zoom = 1;
    state.viewport.panX = 0;
    state.viewport.panY = 0;
    return;
  }
  const rect = refs.stage.getBoundingClientRect();
  const maxX = Math.max(0, rect.width * (zoom - 1) / 2);
  const maxY = Math.max(0, rect.height * (zoom - 1) / 2);
  state.viewport.panX = Math.max(-maxX, Math.min(maxX, Number(state.viewport.panX || 0)));
  state.viewport.panY = Math.max(-maxY, Math.min(maxY, Number(state.viewport.panY || 0)));
}
function applyViewportTransform() {
  clampViewportPan();
  refs.viewport.style.setProperty("--stage-zoom", state.viewport.zoom);
  refs.viewport.style.setProperty("--stage-pan-x", `${state.viewport.panX}px`);
  refs.viewport.style.setProperty("--stage-pan-y", `${state.viewport.panY}px`);
}
function resetViewport() {
  state.viewport = { zoom: 1, panX: 0, panY: 0 };
  if (refs.zoom) refs.zoom.value = "100";
  applyViewportTransform();
}
function placementCenter(p, width = refs.canvas.width, height = refs.canvas.height) {
  return {
    cx: (p.x + p.w / 2) * width,
    cy: (p.y + p.h / 2) * height,
    w: p.w * width,
    h: p.h * height,
  };
}
function toLocal(point, p, width = refs.canvas.width, height = refs.canvas.height) {
  const { cx, cy, w, h } = placementCenter(p, width, height);
  const rad = -(p.angle || 0) * Math.PI / 180;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
  return { x: rx / w + 0.5, y: ry / h + 0.5 };
}
function fromLocal(pt, p, width = refs.canvas.width, height = refs.canvas.height) {
  const { cx, cy, w, h } = placementCenter(p, width, height);
  const rad = (p.angle || 0) * Math.PI / 180;
  const lx = (pt.x - 0.5) * w;
  const ly = (pt.y - 0.5) * h;
  return {
    x: cx + lx * Math.cos(rad) - ly * Math.sin(rad),
    y: cy + lx * Math.sin(rad) + ly * Math.cos(rad),
  };
}
function isLocalInside(local, p) {
  if (local.x < 0 || local.x > 1 || local.y < 0 || local.y > 1) return false;
  if (p.shape !== "circle") return true;
  return ((local.x - 0.5) / 0.5) ** 2 + ((local.y - 0.5) / 0.5) ** 2 <= 1;
}
function placementAt(point) { return [...state.placements].reverse().find((p) => isLocalInside(toLocal(point, p), p)) || null; }
function rotateHandlePoint(p) { return fromLocal({ x: 1.06, y: -0.06 }, p); }
function rotateHandleAt(point) {
  const radius = Math.max(22, 22 * (window.devicePixelRatio || 1));
  return [...state.placements].reverse().find((p) => {
    if (p.id !== state.activePlacementId) return false;
    const h = rotateHandlePoint(p);
    return Math.hypot(point.x - h.x, point.y - h.y) <= radius;
  }) || null;
}
function angleFromCenter(point, p) {
  const { cx, cy } = placementCenter(p);
  return Math.atan2(point.y - cy, point.x - cx) * 180 / Math.PI;
}
function pathPlacement(o, p, width = refs.canvas.width, height = refs.canvas.height) {
  const { cx, cy, w, h } = placementCenter(p, width, height);
  o.beginPath();
  o.save();
  o.translate(cx, cy);
  o.rotate((p.angle || 0) * Math.PI / 180);
  if (p.shape === "circle") o.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (p.shape === "rounded") o.roundRect(-w / 2, -h / 2, w, h, Math.min(24, w / 5, h / 5));
  else o.rect(-w / 2, -h / 2, w, h);
  o.restore();
}
function drawStroke(o, stroke, p, width = refs.canvas.width, height = refs.canvas.height) {
  if (!p || !Array.isArray(stroke.points) || stroke.points.length < 2) return;

  o.save();
  pathPlacement(o, p, width, height);
  o.clip();
  o.lineCap = "round";
  o.lineJoin = "round";

  const scaleX = width / refs.canvas.width;
  const scaleY = height / refs.canvas.height;
  const scale = Math.min(scaleX, scaleY);

  o.lineWidth = Number(stroke.size || 8) * scale;
  o.globalAlpha = stroke.tool === "marker" ? 0.42 : 1;
  o.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  o.strokeStyle = stroke.tool === "eraser" ? "#000" : stroke.color;

  o.beginPath();
  stroke.points.forEach((pt, i) => {
    const gp = fromLocal(pt, p, width, height);
    if (i) o.lineTo(gp.x, gp.y);
    else o.moveTo(gp.x, gp.y);
  });
  o.stroke();
  o.restore();
}
function drawScene() {
  ctx.clearRect(0, 0, refs.canvas.width, refs.canvas.height);
  state.strokes.forEach((stroke) => {
  const placement = state.placements.find((p) => p.id === stroke.placementId);
  drawStroke(ctx, stroke, placement, refs.canvas.width, refs.canvas.height);
});
  renderOverlay();
}
function renderOverlay() {
  refs.overlay.innerHTML = "";
  refs.overlay.style.display = state.placements.length ? "block" : "none";
  state.placements.forEach((p) => {
    const frame = document.createElement("div");
    frame.className = `placement-frame ${p.shape} ${p.id === state.activePlacementId ? "active" : ""}`;
    frame.style.left = `${(p.x + p.w / 2) * 100}%`;
    frame.style.top = `${(p.y + p.h / 2) * 100}%`;
    frame.style.width = `${p.w * 100}%`;
    frame.style.height = `${p.h * 100}%`;
    frame.style.transform = `translate(-50%, -50%) rotate(${p.angle || 0}deg)`;
    if (p.id === state.activePlacementId) {
      const handle = document.createElement("div");
      handle.className = "rotate-handle";
      handle.setAttribute("aria-hidden", "true");
      frame.appendChild(handle);
    }
    refs.overlay.appendChild(frame);
  });
}
function snapshot() { return JSON.stringify({ placements: state.placements, strokes: state.strokes }); }
function restoreSnapshot(raw) {
  try {
    const data = JSON.parse(raw);
    state.placements = data.placements || [];
    state.strokes = data.strokes || [];
    state.activePlacementId = state.placements.at(-1)?.id || null;
  } catch { /* noop */ }
  renderPanels();
  drawScene();
}
function pushUndo() { state.undo.push(snapshot()); if (state.undo.length > 30) state.undo.shift(); state.redo = []; }
function clearDrawing(skipUndo = false) {
  if (!skipUndo) pushUndo();
  state.strokes = state.activePlacementId ? state.strokes.filter((s) => s.placementId !== state.activePlacementId) : [];
  drawScene();
  updateConfirmState();
}
function drawStrokeLocal(o, stroke) {
  if (!Array.isArray(stroke.points) || stroke.points.length < 2) return;
  const scale = 128;
  o.save();
  o.lineCap = "round";
  o.lineJoin = "round";
  o.lineWidth = Math.max(1, Number(stroke.size || 8) * 0.25);
  o.globalAlpha = stroke.tool === "marker" ? 0.42 : 1;
  o.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  o.strokeStyle = stroke.tool === "eraser" ? "#000" : (stroke.color || "#000");
  o.beginPath();
  stroke.points.forEach((pt, i) => {
    const x = Number(pt.x || 0) * scale;
    const y = Number(pt.y || 0) * scale;
    if (i) o.lineTo(x, y); else o.moveTo(x, y);
  });
  o.stroke();
  o.restore();
}
function placementHasVisibleInk(placement) {
  const strokes = state.strokes.filter((s) => s.placementId === placement.id && Array.isArray(s.points) && s.points.length >= 2);
  if (!strokes.some((s) => s.tool !== "eraser")) return false;
  const out = document.createElement("canvas");
  out.width = 128;
  out.height = 128;
  const o = out.getContext("2d", { willReadFrequently: true });
  strokes.forEach((stroke) => drawStrokeLocal(o, stroke));
  const alpha = o.getImageData(0, 0, out.width, out.height).data;
  for (let i = 3; i < alpha.length; i += 4) if (alpha[i] > 8) return true;
  return false;
}

function onPointerDown(e) {
  if (state.rewriting || state.gameOver) return;
  e.preventDefault();
  refs.stage.setPointerCapture?.(e.pointerId);
  const point = pointFromEvent(e);
  const handleHit = state.editMode === "canvas" ? rotateHandleAt(point) : null;
  const placementHit = placementAt(point);
  console.debug("[8-15] pointerdown", { editMode: state.editMode, selected: state.selected?.id || null, activePlacementId: state.activePlacementId, hitPlacement: placementHit?.id || null, hitRotateHandle: handleHit?.id || null });
  if (state.editMode === "canvas") {
    if (handleHit) {
      setActivePlacement(handleHit.id);
      pushUndo();
      state.pointerMode = "rotate";
      state.pointerStart = { point, start: { ...handleHit }, startPointerAngle: angleFromCenter(point, handleHit) };
      return;
    }
    if (placementHit) {
      setActivePlacement(placementHit.id);
      pushUndo();
      state.pointerMode = "move";
      state.pointerStart = { point, start: { ...placementHit } };
      return;
    }
    if (state.selected && point.inside) placeCanvas(state.selected, point.x / refs.canvas.width, point.y / refs.canvas.height);
    return;
  }

  if (!placementHit) {
    if (state.viewport.zoom > 1) {
      const start = eventClientPoint(e);
      state.pointerMode = "pan";
      state.pointerStart = { point, startClient: start, startViewport: { ...state.viewport } };
    }
    return;
  }
  setActivePlacement(placementHit.id);
  const local = toLocal(point, placementHit);
  if (!isLocalInside(local, placementHit)) return;
  pushUndo();
  state.pointerMode = "draw";
  state.currentStroke = { placementId: placementHit.id, tool: state.tool, color: refs.color.value, size: Number(refs.size.value), points: [local] };
}
function onPointerMove(e) {
  if (!state.pointerMode) return;
  e.preventDefault();
  const point = pointFromEvent(e);
  console.debug("[8-15] pointermove", { pointerMode: state.pointerMode });
  if (state.pointerMode === "pan") {
    const now = eventClientPoint(e);
    state.viewport.panX = state.pointerStart.startViewport.panX + (now.clientX - state.pointerStart.startClient.clientX);
    state.viewport.panY = state.pointerStart.startViewport.panY + (now.clientY - state.pointerStart.startClient.clientY);
    applyViewportTransform();
    return;
  }
  const p = activePlacement();
  if (!p) return;
  if (state.pointerMode === "move") {
    const dx = (point.x - state.pointerStart.point.x) / refs.canvas.width;
    const dy = (point.y - state.pointerStart.point.y) / refs.canvas.height;
    p.x = state.pointerStart.start.x + dx;
    p.y = state.pointerStart.start.y + dy;
    clampPlacementBox(p);
    drawScene();
    return;
  }
  if (state.pointerMode === "rotate") {
    const delta = angleFromCenter(point, p) - state.pointerStart.startPointerAngle;
    p.angle = ((Number(state.pointerStart.start.angle || 0) + delta + 540) % 360) - 180;
    if (refs.angle) refs.angle.value = String(Math.round(p.angle));
    drawScene();
    renderPanels();
    return;
  }
  const local = toLocal(point, p);
  if (!isLocalInside(local, p)) return;
  state.currentStroke.points.push(local);
  drawScene();
  drawStroke(ctx, state.currentStroke, p, refs.canvas.width, refs.canvas.height);
}
function onPointerUp(e) {
  if (e?.pointerId !== undefined) refs.stage.releasePointerCapture?.(e.pointerId);
  if (state.pointerMode === "draw" && state.currentStroke?.points.length > 1) state.strokes.push(state.currentStroke);
  state.pointerMode = null;
  state.pointerStart = null;
  state.currentStroke = null;
  drawScene();
  renderPanels();
}
function deleteActive() {
  const p = activePlacement();
  if (!p) return;
  pushUndo();
  if (state.stock.length < 3) state.stock.push({ id: p.sourceCanvasId || `c_${Date.now()}`, shape: p.shape, label: p.label, w: p.w, h: p.h, power: Math.round(p.w * p.h * 1000) });
  state.placements = state.placements.filter((item) => item.id !== p.id);
  state.strokes = state.strokes.filter((s) => s.placementId !== p.id);
  state.activePlacementId = state.placements.at(-1)?.id || null;
  drawScene();
  renderPanels();
}
function resizeCanvas() {
  const rect = refs.stage.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  refs.canvas.width = Math.max(1, Math.round(rect.width * dpr));
  refs.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  drawScene();
  updateConfirmState();
}
function setZoom(value) {
  state.viewport.zoom = Math.max(1, Number(value || 100) / 100);
  applyViewportTransform();
}
function handleResize() {
  resizeCanvas();
  applyViewportTransform();
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}


function drawImageCover(ctx, img, x, y, w, h) {
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;

  const scale = Math.max(w / imgW, h / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  const dx = x + (w - drawW) / 2;
  const dy = y + (h - drawH) / 2;

  ctx.drawImage(img, dx, dy, drawW, drawH);
}
async function renderOriginalCanvasForAI(size = AI_LABEL_IMAGE_SIZE) {
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;

  const o = out.getContext("2d");
  const img = await loadImage(refs.img.src);

  o.fillStyle = "#f7e8c3";
o.fillRect(0, 0, size, size);
drawImageCover(o, img, 0, 0, out.width, out.height);

  return out;
}

async function renderCompositeCanvasForAI(size = AI_LABEL_IMAGE_SIZE) {
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;

  const o = out.getContext("2d");
  const img = await loadImage(refs.img.src);

  o.fillStyle = "#f7e8c3";
o.fillRect(0, 0, size, size);
drawImageCover(o, img, 0, 0, out.width, out.height);

  state.strokes.forEach((stroke) => {
  const placement = state.placements.find((p) => p.id === stroke.placementId);
  drawStroke(o, stroke, placement, out.width, out.height);
});

  return out;
}

function canvasToJpegDataUrl(canvas, quality = AI_LABEL_IMAGE_QUALITY) {
  return canvas.toDataURL("image/jpeg", quality);
}


//デバック用
function showDebugLabelCrop(images = [], meta = {}) {
  document.getElementById("debugLabelCropBox")?.remove();

  const safeImages = Array.isArray(images) ? images.filter((item) => item?.src) : [];
  if (!safeImages.length) return;

  const box = document.createElement("div");
  box.id = "debugLabelCropBox";
  box.style.position = "fixed";
  box.style.left = "50%";
  box.style.top = "50%";
  box.style.transform = "translate(-50%, -50%)";
  box.style.zIndex = "99999";
  box.style.width = "min(92vw, 560px)";
  box.style.maxHeight = "78vh";
  box.style.overflow = "auto";
  box.style.background = "rgba(20, 12, 8, 0.96)";
  box.style.color = "#fff";
  box.style.border = "2px solid #f7d38a";
  box.style.borderRadius = "14px";
  box.style.padding = "12px";
  box.style.boxShadow = "0 12px 32px rgba(0,0,0,.45)";
  box.style.fontSize = "12px";

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px;">
      <b>AI送信用デバッグ</b>
      <button type="button" id="closeDebugLabelCrop" style="font-size:12px;">閉じる</button>
    </div>

    ${safeImages.map((item) => `
      <section style="margin:0 0 12px;">
        <div style="font-weight:bold;margin:0 0 6px;color:#f7d38a;">${escapeHtml(item.label || "image")}</div>
        <img
          src="${item.src}"
          alt="${escapeHtml(item.label || "debug image")}"
          style="width:100%;display:block;border-radius:10px;background:#f7e8c3;"
        >
      </section>
    `).join("")}

    <pre style="white-space:pre-wrap;font-size:11px;margin:8px 0 0;">${escapeHtml(JSON.stringify(meta, null, 2))}</pre>
  `;

  document.body.appendChild(box);
  box.querySelector("#closeDebugLabelCrop").onclick = () => box.remove();
}



async function buildOriginalImage() {
  const canvas = await renderOriginalCanvasForAI(AI_LABEL_IMAGE_SIZE);
  return canvasToJpegDataUrl(canvas);
}

// after全体画像。文章生成には使わず、画像生成AIの参照画像に使う。
async function buildCompositeForAI() {
  const canvas = await renderCompositeCanvasForAI(AI_LABEL_IMAGE_SIZE);
  return canvasToJpegDataUrl(canvas);
}

function getInkStrokeBounds(size = AI_LABEL_IMAGE_SIZE) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let strokeCount = 0;
  let pointCount = 0;

  state.strokes.forEach((stroke) => {
    // 「実際に描いたもの」の周辺を切りたいので、消しゴムだけの線は外接矩形に含めない
    if (stroke.tool === "eraser") return;
    if (!Array.isArray(stroke.points) || stroke.points.length < 2) return;

    const placement = state.placements.find((p) => p.id === stroke.placementId);
    if (!placement) return;

    const scale = size / refs.canvas.width;
    const lineWidth = Number(stroke.size || 8) * scale;
    const pad = Math.max(2, lineWidth / 2);

    stroke.points.forEach((pt) => {
      const gp = fromLocal(pt, placement, size, size);
      if (!Number.isFinite(gp.x) || !Number.isFinite(gp.y)) return;

      minX = Math.min(minX, gp.x - pad);
      minY = Math.min(minY, gp.y - pad);
      maxX = Math.max(maxX, gp.x + pad);
      maxY = Math.max(maxY, gp.y + pad);
      pointCount += 1;
    });

    strokeCount += 1;
  });

  if (!strokeCount || !pointCount) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    strokeCount,
    pointCount,
  };
}

function expandCropRect(bounds, canvasWidth, canvasHeight) {
  const padX = Math.max(LABEL_CROP_MIN_PADDING, bounds.width * LABEL_CROP_PADDING_RATIO);
  const padY = Math.max(LABEL_CROP_MIN_PADDING, bounds.height * LABEL_CROP_PADDING_RATIO);

  const x = Math.max(0, bounds.minX - padX);
  const y = Math.max(0, bounds.minY - padY);
  const right = Math.min(canvasWidth, bounds.maxX + padX);
  const bottom = Math.min(canvasHeight, bounds.maxY + padY);

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

// ラベル判定AI専用：落書き周辺だけを切り出して拡大する
// ラベル判定AI専用：落書き周辺だけを切り出して拡大する
async function buildLabelCompositeForAI() {
  const sourceCanvas = await renderCompositeCanvasForAI(AI_LABEL_IMAGE_SIZE);
  const bounds = getInkStrokeBounds(AI_LABEL_IMAGE_SIZE);

  if (!bounds) {
    console.warn("[8-15] label crop fallback: no ink bounds");
    return buildCompositeForAI();
  }

  const crop = expandCropRect(bounds, sourceCanvas.width, sourceCanvas.height);
  const cropLongSide = Math.max(crop.width, crop.height);
  const scale = LABEL_CROP_LONG_SIDE / cropLongSide;

  const outputWidth = Math.max(1, Math.round(crop.width * scale));
  const outputHeight = Math.max(1, Math.round(crop.height * scale));

  const out = document.createElement("canvas");
  out.width = outputWidth;
  out.height = outputHeight;

  const o = out.getContext("2d");
  o.fillStyle = "#f7e8c3";
  o.fillRect(0, 0, outputWidth, outputHeight);

  o.drawImage(
    sourceCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  const debugMeta = {
    sourceSize: AI_LABEL_IMAGE_SIZE,

    boundsMinX: Math.round(bounds.minX),
    boundsMinY: Math.round(bounds.minY),
    boundsMaxX: Math.round(bounds.maxX),
    boundsMaxY: Math.round(bounds.maxY),
    boundsWidth: Math.round(bounds.width),
    boundsHeight: Math.round(bounds.height),

    cropX: Math.round(crop.x),
    cropY: Math.round(crop.y),
    cropWidth: Math.round(crop.width),
    cropHeight: Math.round(crop.height),

    outputWidth,
    outputHeight,
    outputLongSide: Math.max(outputWidth, outputHeight),

    quality: AI_LABEL_IMAGE_QUALITY,
    strokeCount: bounds.strokeCount,
    pointCount: bounds.pointCount,
  };

  const dataUrl = canvasToJpegDataUrl(out);

console.debug("[8-15] label crop built", debugMeta);

/*
// before全体図も同じモーダルで確認する
const beforeCanvas = await renderOriginalCanvasForAI(AI_LABEL_IMAGE_SIZE);
const beforeDataUrl = canvasToJpegDataUrl(beforeCanvas);

// after全体図も一緒に見る。cropのズレ確認に役立つ
const afterFullDataUrl = canvasToJpegDataUrl(sourceCanvas);

showDebugLabelCrop(
  [
    { label: "1. before全体 / originalImageDataUrl", src: beforeDataUrl },
    { label: "2. after全体 / referenceCompositeImageDataUrl", src: afterFullDataUrl },
    { label: "3. after局所crop / labelCompositeImageDataUrl", src: dataUrl },
  ],
  debugMeta
);
*/

return dataUrl;
}
async function buildCompositeForPreview() {
  const size = 512;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const o = out.getContext("2d");
  const img = await loadImage(refs.img.src);
  o.fillStyle = "#f7e8c3";
o.fillRect(0, 0, size, size);
drawImageCover(o, img, 0, 0, out.width, out.height);
  state.strokes.forEach((stroke) => {
  const placement = state.placements.find((p) => p.id === stroke.placementId);
  drawStroke(o, stroke, placement, out.width, out.height);
});
  
    state.placements.forEach((p) => {
    o.save();
    o.strokeStyle = "rgba(120,42,28,.9)";
    o.lineWidth = 4;
    o.setLineDash([14, 8]);
    pathPlacement(o, p, out.width, out.height);
    o.stroke();
    o.restore();
  });
  return out.toDataURL("image/jpeg", 0.72);
}
function liteCanvases() {
  return state.placements.map((p) => {
    const strokes = state.strokes.filter((s) => s.placementId === p.id && Array.isArray(s.points) && s.points.length >= 2);
    return {
      id: p.id,
      sourceCanvasId: p.sourceCanvasId,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      shape: p.shape,
      label: p.label,
      angle: p.angle || 0,
      strokeCount: strokes.length,
      inkStrokeCount: strokes.filter((s) => s.tool !== "eraser").length,
      eraserStrokeCount: strokes.filter((s) => s.tool === "eraser").length,
      tools: [...new Set(strokes.map((s) => s.tool || "pen"))].slice(0, 4),
    };
  });
}
function applyPage(page, { append = true } = {}) {
  state.current = page;
  state.pageNumber = Number(page.pageNumber || state.pageNumber || 1);
  refs.pageBadge.textContent = `${state.pageNumber}ページ目`;
  refs.title.textContent = page.title || `${state.pageNumber}ページ目`;
  refs.story.textContent = page.bodyText || "";
  refs.scene.textContent = page.storySoFar || "";
  refs.img.src = pageImageSrc(page);
  refs.stage.classList.remove("image-generation-failed");
  refs.fallbackNotice.hidden = true;
  if (append) state.pages.push(savedPage(page));
  state.selected = null;
  state.placements = [];
  state.strokes = [];
  state.activePlacementId = null;
  state.undo = [];
  state.redo = [];
    resetViewport();
  setEditMode("canvas");
  renderPanels();
  setTimeout(resizeCanvas, 60);
}
async function startGame() {
  refs.cover.hidden = true;
  refs.game.hidden = false;
  resizeCanvas();
  fillInitialStock();
  setLoading(true, "表紙をめくっています…");
  try {
    const user = getUser();
    const data = await api("/api/100ore/start", { username: user.username || localStorage.getItem("username") || "旅人", userTrackingId: user.userTrackingId || localStorage.getItem("userTrackingId") || "" });
    state.runId = data.runId;
    applyPage(data.page);
    setStatus("1ページに1〜3枚置けます。使った分は消え、次ページで1枚だけ補充されます。");
  } catch (e) {
    setStatus(`開始に失敗しました: ${e.message}`);
    refs.cover.hidden = false;
    refs.game.hidden = true;
  } finally {
    setLoading(false);
  }
}
async function confirmRewrite() {
  if (!state.placements.length || !hasMeaningfulDrawing() || state.gameOver || state.rewriting) return;
  state.rewriting = true;
  updateConfirmState();
  setLoadingSteps([{ text: "変化を読み取っています", delay: 0 }, { text: "次の物語を編んでいます", delay: 12000 }, { text: "次の一枚絵を用意しています", delay: 22000 }]);
  try {
    const [
  originalImageDataUrl,
  labelCompositeImageDataUrl,
  referenceCompositeImageDataUrl,
] = await Promise.all([
  buildOriginalImage(),          // before全体
  buildLabelCompositeForAI(),    // after落書き周辺crop。ラベル判定用
  buildCompositeForAI(),         // after全体。画像生成参照用
]);

console.debug("[8-15] rewrite image payload", {
  originalLength: originalImageDataUrl.length,
  labelCompositeLength: labelCompositeImageDataUrl.length,
  referenceCompositeLength: referenceCompositeImageDataUrl.length,
  totalLength:
    originalImageDataUrl.length +
    labelCompositeImageDataUrl.length +
    referenceCompositeImageDataUrl.length,
});

const canvases = liteCanvases();
const drawingHash = await sha256(await (await fetch(labelCompositeImageDataUrl)).arrayBuffer());
const currentPage = savedPage(state.current || {});

const data = await api("/api/100ore/rewrite", {
  runId: state.runId,
  pageNumber: state.pageNumber,
  currentPage,
  originalImageDataUrl,
  labelCompositeImageDataUrl,
  referenceCompositeImageDataUrl,
  canvases,
  drawingHash,
});
    addHistory(data.changeLabels);
    if (state.pages.length) state.pages[state.pages.length - 1] = { ...state.pages[state.pages.length - 1], changeLabels: data.changeLabels || [] };
    replenishOneStock();
    applyPage({ ...data.page, changeLabels: data.changeLabels || [] });
    if (data.page?.gameOver) {
      state.gameOver = true;
      await saveRun();
      showGameOver(data.page);
      return;
    }
    setStatus(data.cacheHit ? "同じような変化だったので、前と同じ展開へ進みました。" : "続きのページが現れました。残りの紙片と補充1枚を使えます。");
  } catch (e) {
    console.error(e);
    setStatus(e.message.includes("AIが混雑") ? "AIが混雑しています。もう一度試してください" : `確定に失敗しました: ${e.message}`);
  } finally {
    state.rewriting = false;
    setLoading(false);
    updateConfirmState();
  }
}
function addHistory(changeLabels) {
  const labels = Array.isArray(changeLabels) && changeLabels.length ? changeLabels.join(" / ") : "物語が動いた";
  const el = document.createElement("div");
  el.className = "history-item";
  el.textContent = `${state.pageNumber}ページ目の変化: ${labels}`;
  refs.history.prepend(el);
}
async function saveRun() {
  const user = getUser();
  const finalPage = state.pages[state.pages.length - 1] || state.current || {};
  await api("/api/100ore/runs", { runId: state.runId, username: user.username || localStorage.getItem("username") || "名無しの俺", userTrackingId: user.userTrackingId || localStorage.getItem("userTrackingId") || "", score: state.pageNumber, gameOver: true, finalTitle: finalPage.title || "", finalBodyText: finalPage.bodyText || "", pages: state.pages, endedAt: new Date().toISOString() }).catch((e) => setStatus(`ランキング保存に失敗しました: ${e.message}`));
}
function renderReviewPage(p, className = "bad-review-page") {
  const src = pageImageSrc(p);
  return `<article class="${className}">
    ${src ? `<img src="${src}" alt="${escapeHtml(p.title || "絵本のページ")}">` : `<div class="image-missing">画像なし</div>`}
    <div class="review-text">
      <b>${escapeHtml(p.title || `${p.pageNumber || "?"}ページ目`)}</b>
      <p>${escapeHtml(p.bodyText || "")}</p>
      ${changeLabelsHtml(p.changeLabels)}
    </div>
  </article>`;
}
function showGameOver(page) {
  document.querySelector(".game-over-card")?.remove();
  const div = document.createElement("div");
  div.className = "game-over-card";
  const reviewPages = state.pages.map((p) => (p.pageNumber === page.pageNumber ? { ...p, ...savedPage(page), changeLabels: p.changeLabels || page.changeLabels || [] } : p));
  const heroSrc = pageImageSrc(page);
  div.innerHTML = `<div class="game-over-panel">
    <div class="game-over-head">
      <p class="eyebrow">運命は赤黒く閉じた</p>
      <h2>バッドエンド：${state.pageNumber}ページ目</h2>
      <button class="small-btn close-over-btn" id="closeOverBtn" type="button">閉じる</button>
    </div>
    <section class="bad-end-hero">
      ${heroSrc ? `<img src="${heroSrc}" alt="${escapeHtml(page.title || "バッドエンド")}">` : `<div class="image-missing">画像なし</div>`}
      <div>
        <h3>${escapeHtml(page.title || "終わりのページ")}</h3>
        <p>${escapeHtml(page.bodyText || "俺は絵本から消えた。")}</p>
      </div>
    </section>
    <h3 class="review-heading">ここまでの絵本</h3>
    <div class="bad-review-list">${reviewPages.map((p) => renderReviewPage(p)).join("")}</div>
    <div class="game-over-actions">
      <button class="primary-btn" id="againBtn" type="button">もう一度</button>
      <button class="ghost-btn" id="overRankBtn" type="button">ランキング</button>
      <button class="ghost-btn" id="closeOverBtnBottom" type="button">絵本を閉じる</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  div.querySelector("#againBtn").onclick = () => location.reload();
  div.querySelector("#overRankBtn").onclick = showRanking;
  div.querySelector("#closeOverBtn").onclick = () => div.remove();
  div.querySelector("#closeOverBtnBottom").onclick = () => div.remove();
  setStatus("記録を保存しました。ほかの俺の絵本も覗けます。");
}
async function showRanking() {
  refs.rankingDialog.showModal();
  refs.rankingList.textContent = "読み込み中…";
  try {
    const res = await fetch("/api/100ore/rankings");
    const data = await res.json();
    refs.rankingList.innerHTML = "";
    (data.rankings || []).forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "rank-row";
      row.innerHTML = `<b>${i + 1}</b><span>${escapeHtml(r.username || "名無しの俺")}<br><small>${escapeHtml(r.finalTitle || "")}</small></span><strong>${r.score}ページ</strong>`;
      const btn = document.createElement("button");
      btn.className = "small-btn";
      btn.textContent = "絵本を見る";
      btn.onclick = () => showRun(r.runId);
      row.appendChild(btn);
      refs.rankingList.appendChild(row);
    });
    if (!refs.rankingList.children.length) refs.rankingList.textContent = "まだ記録がありません。";
  } catch (e) {
    refs.rankingList.textContent = `ランキング取得に失敗: ${e.message}`;
  }
}
async function showRun(runId) {
  refs.runDialog.showModal();
  refs.runViewer.textContent = "読み込み中…";
  try {
    const res = await fetch(`/api/100ore/runs/${encodeURIComponent(runId)}`);
    const data = await res.json();
    refs.runTitle.textContent = `${data.run?.username || "誰か"}の絵本`;
    refs.runViewer.innerHTML = "";
    (data.run?.pages || []).forEach((p) => {
      const el = document.createElement("div");
      el.className = "run-page";
      const src = pageImageSrc(p);
      el.innerHTML = `${src ? `<img src="${src}" alt="${escapeHtml(p.title || "絵本のページ")}">` : `<div class="image-missing">画像なし</div>`}<div><b>${escapeHtml(p.title || `${p.pageNumber}ページ目`)}</b><p>${escapeHtml(p.bodyText || "")}</p>${changeLabelsHtml(p.changeLabels)}<small>${escapeHtml(p.storySoFar || "")}</small></div>`;
      refs.runViewer.appendChild(el);
    });
  } catch (e) {
    refs.runViewer.textContent = `閲覧に失敗: ${e.message}`;
  }
}

refs.start.onclick = startGame;
refs.confirm.onclick = confirmRewrite;
refs.ranking.onclick = showRanking;
refs.rankingTop.onclick = showRanking;
refs.closeRanking.onclick = () => refs.rankingDialog.close();
refs.closeRun.onclick = () => refs.runDialog.close();
refs.stage.addEventListener("pointerdown", onPointerDown);
refs.stage.addEventListener("pointermove", onPointerMove);
refs.stage.addEventListener("pointerup", onPointerUp);
refs.stage.addEventListener("pointercancel", onPointerUp);
refs.stage.addEventListener("pointerleave", onPointerUp);
window.addEventListener("resize", handleResize);
document.querySelectorAll(".tool-choice").forEach((btn) => btn.onclick = () => { state.tool = btn.dataset.tool; document.querySelectorAll(".tool-choice").forEach((b) => b.classList.toggle("active", b === btn)); });
refs.undo.onclick = () => { if (!state.undo.length) return; state.redo.push(snapshot()); restoreSnapshot(state.undo.pop()); updateConfirmState(); };
refs.redo.onclick = () => { if (!state.redo.length) return; state.undo.push(snapshot()); restoreSnapshot(state.redo.pop()); updateConfirmState(); };
refs.clear.onclick = () => clearDrawing();
refs.deletePlacement.onclick = deleteActive;
if (refs.angle) refs.angle.oninput = () => { const p = activePlacement(); if (!p) return; p.angle = Number(refs.angle.value); drawScene(); renderPanels(); };
refs.zoom.oninput = () => setZoom(refs.zoom.value);
refs.flip.onclick = () => setEditMode(state.editMode === "canvas" ? "pen" : "canvas");
fillInitialStock();
renderOverlay();
applyViewportTransform();
updateConfirmState();
