const refs = {
  cover: document.getElementById("coverScreen"),
  game: document.getElementById("gameScreen"),
  start: document.getElementById("startBtn"),
  rankingTop: document.getElementById("rankingBtnTop"),
  ranking: document.getElementById("rankingBtn"),
  day: document.getElementById("dayBadge"),
  status: document.getElementById("statusBar"),
  pageTitle: document.getElementById("pageTitle"),
  story: document.getElementById("storyText"),
  scene: document.getElementById("sceneSummary"),
  outcome: document.getElementById("outcomeChip"),
  history: document.getElementById("historyList"),
  stage: document.getElementById("pictureStage"),
  img: document.getElementById("pageImage"),
  fallbackNotice: document.getElementById("imageFallbackNotice"),
  canvas: document.getElementById("drawCanvas"),
  overlay: document.getElementById("canvasOverlay"),
  stock: document.getElementById("canvasStock"),
  color: document.getElementById("colorInput"),
  size: document.getElementById("sizeInput"),
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
};

const ctx = refs.canvas.getContext("2d", { willReadFrequently: true });
const shapes = [
  { shape: "square", label: "小さな正方形", w: .24, h: .24 },
  { shape: "square", label: "大きな正方形", w: .38, h: .38 },
  { shape: "rect", label: "横長長方形", w: .46, h: .24 },
  { shape: "rect", label: "縦長長方形", w: .25, h: .48 },
  { shape: "circle", label: "円形", w: .34, h: .34 },
  { shape: "rect", label: "細長い帯", w: .62, h: .16 },
  { shape: "rounded", label: "角丸長方形", w: .42, h: .28 },
];
const state = {
  runId: null,
  day: 1,
  current: null,
  pages: [],
  stock: [],
  selected: null,
  placements: [],
  activePlacementId: null,
  dragStock: null,
  dragGhost: null,
  tool: "pen",
  drawing: false,
  last: null,
  undo: [],
  redo: [],
  gameOver: false,
  rewriting: false,
  loadingTimers: [],
};

function getUser() { try { return JSON.parse(localStorage.getItem("currentUser") || "null") || {}; } catch { return {}; } }
function clearLoadingTimers() { state.loadingTimers.forEach((timer) => clearTimeout(timer)); state.loadingTimers = []; }
function setLoading(show, text = "ページの端をめくっています…") { if (!show) clearLoadingTimers(); refs.loading.hidden = !show; refs.loadingText.textContent = text; }
function setLoadingSteps(steps) { clearLoadingTimers(); if (!steps.length) return; setLoading(true, steps[0].text); steps.slice(1).forEach((step) => { state.loadingTimers.push(setTimeout(() => { if (state.rewriting) refs.loadingText.textContent = step.text; }, step.delay)); }); }
function setStatus(text) { refs.status.textContent = text; }
function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c])); }
async function api(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[100ore api error]", { path, status: res.status, data });
    throw new Error(data.detail || data.error || `HTTP ${res.status}`);
  }
  return data;
}
function randomCanvas() { const base = shapes[Math.floor(Math.random() * shapes.length)]; return { ...base, id: `c_${Date.now()}_${Math.random().toString(16).slice(2)}`, power: Math.round((base.w * base.h) * 1000) }; }
function fillInitialStock() { while (state.stock.length < 3) state.stock.push(randomCanvas()); renderStock(); }
function replenishOneStock() { if (state.stock.length < 3) state.stock.push(randomCanvas()); renderStock(); }
function renderStock() {
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
    card.addEventListener("click", () => selectCanvas(item));
    card.addEventListener("pointerdown", (e) => startStockDrag(e, item));
    refs.stock.appendChild(card);
  });
}
function selectCanvas(item) {
  state.selected = item;
  state.activePlacementId = null;
  renderStock();
  renderOverlays();
  setStatus("使う枠を選びました。絵の上で位置を決めてください。押したまま運ぶこともできます。");
}
function startStockDrag(e, item) {
  if (state.rewriting || state.gameOver) return;
  e.preventDefault();
  state.dragStock = item;
  state.selected = item;
  renderStock();
  const ghost = document.createElement("div");
  ghost.className = `drag-ghost ${item.shape}`;
  ghost.style.width = `${Math.max(44, item.w * 170)}px`;
  ghost.style.height = `${Math.max(44, item.h * 170)}px`;
  document.body.appendChild(ghost);
  state.dragGhost = ghost;
  moveGhost(e.clientX, e.clientY);
  window.addEventListener("pointermove", onStockDragMove);
  window.addEventListener("pointerup", onStockDragEnd, { once: true });
}
function moveGhost(x, y) {
  if (!state.dragGhost) return;
  state.dragGhost.style.left = `${x}px`;
  state.dragGhost.style.top = `${y}px`;
}
function onStockDragMove(e) { moveGhost(e.clientX, e.clientY); }
function onStockDragEnd(e) {
  window.removeEventListener("pointermove", onStockDragMove);
  state.dragGhost?.remove();
  state.dragGhost = null;
  const item = state.dragStock;
  state.dragStock = null;
  if (!item) return;
  const r = refs.canvas.getBoundingClientRect();
  if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
    const p = { x: (e.clientX - r.left) * refs.canvas.width / r.width, y: (e.clientY - r.top) * refs.canvas.height / r.height };
    placeCanvas(item, p.x / refs.canvas.width, p.y / refs.canvas.height);
  }
}
function stageRect() { return refs.stage.getBoundingClientRect(); }
function canvasPixelsFor(item, xRatio = .5, yRatio = .5) { const w = refs.canvas.width * item.w, h = refs.canvas.height * item.h; return { x: refs.canvas.width * xRatio - w / 2, y: refs.canvas.height * yRatio - h / 2, w, h }; }
function clampPlacement(item, xRatio, yRatio) {
  const box = canvasPixelsFor(item, xRatio, yRatio);
  const nx = Math.max(0, Math.min(refs.canvas.width - box.w, box.x));
  const ny = Math.max(0, Math.min(refs.canvas.height - box.h, box.y));
  return { id: `p_${Date.now()}_${Math.random().toString(16).slice(2)}`, sourceCanvasId: item.id, x: nx / refs.canvas.width, y: ny / refs.canvas.height, w: box.w / refs.canvas.width, h: box.h / refs.canvas.height, shape: item.shape, label: item.label };
}
function placeCanvas(item, xRatio, yRatio) {
  if (!state.stock.some((stock) => stock.id === item.id)) return;
  const placement = clampPlacement(item, xRatio, yRatio);
  state.placements.push(placement);
  state.activePlacementId = placement.id;
  state.stock = state.stock.filter((stock) => stock.id !== item.id);
  state.selected = null;
  refs.confirm.disabled = state.placements.length === 0;
  renderStock();
  renderOverlays();
  setStatus("枠を置きました。点線の内側にだけ手を加えられます。複数置いてからまとめて確定できます。");
}
function renderOverlays() {
  refs.overlay.innerHTML = "";
  refs.overlay.style.display = state.placements.length ? "block" : "none";
  state.placements.forEach((p) => {
    const frame = document.createElement("div");
    frame.className = `placement-frame ${p.shape} ${state.activePlacementId === p.id ? "active" : ""}`;
    frame.style.left = `${p.x * 100}%`;
    frame.style.top = `${p.y * 100}%`;
    frame.style.width = `${p.w * 100}%`;
    frame.style.height = `${p.h * 100}%`;
    refs.overlay.appendChild(frame);
  });
}
function resizeCanvas() {
  const rect = stageRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const old = document.createElement("canvas");
  old.width = refs.canvas.width;
  old.height = refs.canvas.height;
  old.getContext("2d").drawImage(refs.canvas, 0, 0);
  refs.canvas.width = Math.max(1, Math.round(rect.width * dpr));
  refs.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.clearRect(0, 0, refs.canvas.width, refs.canvas.height);
  if (old.width && old.height) ctx.drawImage(old, 0, 0, refs.canvas.width, refs.canvas.height);
  renderOverlays();
}
function pushUndo() { state.undo.push(refs.canvas.toDataURL("image/png")); if (state.undo.length > 20) state.undo.shift(); state.redo = []; }
function restoreFrom(dataUrl) { const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, refs.canvas.width, refs.canvas.height); ctx.drawImage(img, 0, 0, refs.canvas.width, refs.canvas.height); }; img.src = dataUrl; }
function clearDrawing(skipUndo = false) { if (!skipUndo) pushUndo(); ctx.clearRect(0, 0, refs.canvas.width, refs.canvas.height); }
function pointFromEvent(e) { const r = refs.canvas.getBoundingClientRect(); const t = e.touches?.[0] || e.changedTouches?.[0] || e; return { x: (t.clientX - r.left) * refs.canvas.width / r.width, y: (t.clientY - r.top) * refs.canvas.height / r.height }; }
function isInsideShape(point, placement) {
  if (!placement) return false;
  const x = placement.x * refs.canvas.width, y = placement.y * refs.canvas.height, w = placement.w * refs.canvas.width, h = placement.h * refs.canvas.height;
  if (placement.shape === "circle") {
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
    return (((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2) <= 1;
  }
  return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;
}
function placementAt(point) { return [...state.placements].reverse().find((placement) => isInsideShape(point, placement)) || null; }
function clipToPlacement(placement) {
  const x = placement.x * refs.canvas.width, y = placement.y * refs.canvas.height, w = placement.w * refs.canvas.width, h = placement.h * refs.canvas.height;
  ctx.beginPath();
  if (placement.shape === "circle") ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (placement.shape === "rounded") { const r = Math.min(28, w / 5, h / 5); ctx.roundRect(x, y, w, h, r); }
  else ctx.rect(x, y, w, h);
  ctx.clip();
}
function drawLine(a, b) {
  const placement = state.placements.find((p) => p.id === state.activePlacementId);
  if (!placement) return;
  ctx.save();
  clipToPlacement(placement);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Number(refs.size.value);
  ctx.globalAlpha = state.tool === "marker" ? .42 : 1;
  ctx.globalCompositeOperation = state.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = state.tool === "eraser" ? "#000" : refs.color.value;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}
function onPointerDown(e) {
  e.preventDefault();
  const point = pointFromEvent(e);
  if (state.selected) return placeCanvas(state.selected, point.x / refs.canvas.width, point.y / refs.canvas.height);
  const placement = placementAt(point);
  if (!placement) return;
  state.activePlacementId = placement.id;
  renderOverlays();
  pushUndo();
  state.drawing = true;
  state.last = point;
}
function onPointerMove(e) { if (!state.drawing) return; e.preventDefault(); const point = pointFromEvent(e); drawLine(state.last, point); state.last = point; }
function onPointerUp() { state.drawing = false; state.last = null; }
async function loadImage(src) { return new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => resolve(img); img.onerror = reject; img.src = src; }); }
function drawPlacementPath(o, p, size) {
  const x = p.x * size, y = p.y * size, w = p.w * size, h = p.h * size;
  o.beginPath();
  if (p.shape === "circle") o.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (p.shape === "rounded") o.roundRect(x, y, w, h, 24);
  else o.rect(x, y, w, h);
}
async function buildOriginalImage() {
  const size = 512;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const o = out.getContext("2d");
  const img = await loadImage(refs.img.src);
  o.fillStyle = "#f7e8c3";
  o.fillRect(0, 0, size, size);
  o.drawImage(img, 0, 0, size, size);
  return out.toDataURL("image/jpeg", 0.72);
}
async function buildComposite() {
  const size = 512;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const o = out.getContext("2d");
  const img = await loadImage(refs.img.src);
  o.fillStyle = "#f7e8c3";
  o.fillRect(0, 0, size, size);
  o.drawImage(img, 0, 0, size, size);
  state.placements.forEach((p) => {
    o.save();
    drawPlacementPath(o, p, size);
    o.clip();
    o.drawImage(refs.canvas, 0, 0, size, size);
    o.restore();
    o.save();
    o.strokeStyle = "rgba(120,42,28,.9)";
    o.lineWidth = 5;
    o.setLineDash([16, 10]);
    drawPlacementPath(o, p, size);
    o.stroke();
    o.restore();
  });
  return out.toDataURL("image/jpeg", 0.72);
}
function applyPage(page, { append = true } = {}) {
  state.current = page;
  state.day = Number(page.day || state.day || 1);
  refs.day.textContent = `${state.day}日目`;
  refs.pageTitle.textContent = page.pageTitle || `${state.day}日目`;
  refs.story.textContent = page.bodyText || "";
  refs.scene.textContent = page.sceneSummary || "";
  refs.img.src = page.imageDataUrl || page.imageUrl || "";
  const imageFailed = Boolean(page.imageGenerationFailed);
  refs.stage.classList.toggle("image-generation-failed", imageFailed);
  refs.fallbackNotice.hidden = !imageFailed;
  if (imageFailed) setStatus("紙のプレースホルダーを表示しています。本文を一枚絵として扱ってください。");
  if (append) state.pages.push({ day: state.day, pageTitle: page.pageTitle, bodyText: page.bodyText, sceneSummary: page.sceneSummary, imageHash: page.imageHash, imageUrl: page.imageUrl || "", imageGenerationFailed: imageFailed });
  clearDrawing(true);
  state.undo = [];
  state.redo = [];
  state.selected = null;
  state.placements = [];
  state.activePlacementId = null;
  refs.confirm.disabled = true;
  renderStock();
  renderOverlays();
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
    setStatus("枠を最大3つまで置けます。ストックから絵の上へドラッグしてください。");
  } catch (e) {
    setStatus(`開始に失敗しました: ${e.message}`);
    refs.cover.hidden = false;
    refs.game.hidden = true;
  } finally { setLoading(false); }
}
function isGameOverValue(value) { return value === true || (typeof value === "string" && value.trim().toLowerCase() === "true") || value === 1; }
function liteCanvases() { return state.placements.map((p) => ({ id: p.id, sourceCanvasId: p.sourceCanvasId, x: p.x, y: p.y, w: p.w, h: p.h, shape: p.shape, label: p.label })); }
async function confirmRewrite() {
  if (!state.placements.length || state.gameOver || state.rewriting) return;
  state.rewriting = true;
  refs.confirm.disabled = true;
  setLoadingSteps([{ text: "新しい正史を読み取っています", delay: 0 }, { text: "次の物語を編んでいます", delay: 12000 }, { text: "次の一枚絵を描いています", delay: 22000 }]);
  try {
    const [originalImageDataUrl, compositeImageDataUrl] = await Promise.all([buildOriginalImage(), buildComposite()]);
    const canvases = liteCanvases();
    const strokesImageHash = await sha256(await (await fetch(refs.canvas.toDataURL("image/png"))).arrayBuffer());
    const currentPageLite = {
      day: state.current?.day,
      pageTitle: state.current?.pageTitle,
      bodyText: state.current?.bodyText,
      sceneSummary: state.current?.sceneSummary,
      imageHash: state.current?.imageHash,
    };
    const data = await api("/api/100ore/rewrite", { runId: state.runId, day: state.day, currentPage: currentPageLite, originalImageDataUrl, compositeImageDataUrl, canvases, canvas: canvases[0] || null, drawingHash: strokesImageHash });
    refs.outcome.textContent = data.outcome?.outcomeType || "転機";
    addHistory(data.outcome);
    if (state.pages.length) state.pages[state.pages.length - 1] = { ...state.pages[state.pages.length - 1], outcome: data.outcome, outcomeSummary: data.outcome?.outcomeSummary || data.outcome?.rewriteText || "", canvases, imageHash: state.current?.imageHash || "" };
    replenishOneStock();
    if (isGameOverValue(data.outcome?.gameOver)) { state.gameOver = true; await saveRun(data.outcome); showGameOver(data.outcome); return; }
    applyPage(data.nextPage);
    if (!data.nextPage?.imageGenerationFailed) setStatus("続きのページが現れました。残った枠と補充された1枚を使えます。");
  } catch (e) {
    console.error(e);
    setStatus(`確定に失敗しました: ${e.message}`);
    if (state.placements.length && !state.gameOver) refs.confirm.disabled = false;
  } finally { state.rewriting = false; setLoading(false); }
}
async function sha256(buffer) { const hash = await crypto.subtle.digest("SHA-256", buffer); return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join(""); }
function addHistory(outcome) { if (!outcome) return; const el = document.createElement("div"); el.className = "history-item"; el.textContent = `${state.day}日目: ${outcome.rewriteText || outcome.outcomeSummary || "物語が少し曲がった。"}`; refs.history.prepend(el); }
async function saveRun(outcome) { const user = getUser(); await api("/api/100ore/runs", { runId: state.runId, username: user.username || localStorage.getItem("username") || "名無しの俺", userTrackingId: user.userTrackingId || localStorage.getItem("userTrackingId") || "", score: state.day, gameOverReason: outcome.gameOverReason || outcome.outcomeSummary || "物語から退場", pages: state.pages, endedAt: new Date().toISOString() }).catch(e => setStatus(`ランキング保存に失敗しました: ${e.message}`)); }
function showGameOver(outcome) { const div = document.createElement("div"); div.className = "game-over-card"; div.innerHTML = `<h2>ゲームオーバー：${state.day}日目</h2><p>${escapeHtml(outcome.gameOverReason || outcome.outcomeSummary || "俺は絵本から消えた。")}</p><button class="primary-btn" id="againBtn">もう一度</button> <button class="ghost-btn" id="overRankBtn">ランキング</button>`; document.body.appendChild(div); div.querySelector("#againBtn").onclick = () => location.reload(); div.querySelector("#overRankBtn").onclick = showRanking; setStatus("記録を保存しました。ほかの俺の絵本も覗けます。"); }
async function showRanking() { refs.rankingDialog.showModal(); refs.rankingList.textContent = "読み込み中…"; try { const res = await fetch("/api/100ore/rankings"); const data = await res.json(); refs.rankingList.innerHTML = ""; (data.rankings || []).forEach((r, i) => { const row = document.createElement("div"); row.className = "rank-row"; row.innerHTML = `<b>${i + 1}</b><span>${escapeHtml(r.username || "名無しの俺")}<br><small>${escapeHtml(r.gameOverReason || "")}</small></span><strong>${r.score}日</strong>`; const btn = document.createElement("button"); btn.className = "small-btn"; btn.textContent = "絵本を見る"; btn.onclick = () => showRun(r.runId); row.appendChild(btn); refs.rankingList.appendChild(row); }); if (!refs.rankingList.children.length) refs.rankingList.textContent = "まだ記録がありません。"; } catch (e) { refs.rankingList.textContent = `ランキング取得に失敗: ${e.message}`; } }
async function showRun(runId) { refs.runDialog.showModal(); refs.runViewer.textContent = "読み込み中…"; try { const res = await fetch(`/api/100ore/runs/${encodeURIComponent(runId)}`); const data = await res.json(); refs.runTitle.textContent = `${data.run?.username || "誰か"}の絵本`; refs.runViewer.innerHTML = ""; (data.run?.pages || []).forEach(p => { const el = document.createElement("div"); el.className = "run-page"; el.innerHTML = `${p.imageUrl ? `<img src="${p.imageUrl}" alt="">` : `<div></div>`}<div><b>${escapeHtml(p.pageTitle || `${p.day}日目`)}</b><p>${escapeHtml(p.bodyText || "")}</p><small>${escapeHtml(p.sceneSummary || "")}</small>${(p.outcomeSummary || p.outcome) ? `<p><em>転機: ${escapeHtml(p.outcomeSummary || p.outcome?.outcomeSummary || p.outcome?.rewriteText || "")}</em></p>` : ""}</div>`; refs.runViewer.appendChild(el); }); } catch (e) { refs.runViewer.textContent = `閲覧に失敗: ${e.message}`; } }

refs.start.onclick = startGame;
refs.confirm.onclick = confirmRewrite;
refs.ranking.onclick = showRanking;
refs.rankingTop.onclick = showRanking;
refs.closeRanking.onclick = () => refs.rankingDialog.close();
refs.closeRun.onclick = () => refs.runDialog.close();
document.querySelectorAll(".tool-choice").forEach(btn => btn.onclick = () => { state.tool = btn.dataset.tool; document.querySelectorAll(".tool-choice").forEach(b => b.classList.toggle("active", b === btn)); });
refs.undo.onclick = () => { if (!state.undo.length) return; state.redo.push(refs.canvas.toDataURL("image/png")); restoreFrom(state.undo.pop()); };
refs.redo.onclick = () => { if (!state.redo.length) return; state.undo.push(refs.canvas.toDataURL("image/png")); restoreFrom(state.redo.pop()); };
refs.clear.onclick = () => clearDrawing();
refs.canvas.addEventListener("pointerdown", onPointerDown);
refs.canvas.addEventListener("pointermove", onPointerMove);
refs.canvas.addEventListener("pointerup", onPointerUp);
refs.canvas.addEventListener("pointerleave", onPointerUp);
window.addEventListener("resize", resizeCanvas);
fillInitialStock();
renderOverlays();
