const refs = {
  cover: document.getElementById("coverScreen"), game: document.getElementById("gameScreen"), start: document.getElementById("startBtn"),
  rankingTop: document.getElementById("rankingBtnTop"), ranking: document.getElementById("rankingBtn"), day: document.getElementById("dayBadge"),
  status: document.getElementById("statusBar"), pageTitle: document.getElementById("pageTitle"), story: document.getElementById("storyText"), scene: document.getElementById("sceneSummary"),
  outcome: document.getElementById("outcomeChip"), history: document.getElementById("historyList"), stage: document.getElementById("pictureStage"), img: document.getElementById("pageImage"), fallbackNotice: document.getElementById("imageFallbackNotice"),
  canvas: document.getElementById("drawCanvas"), overlay: document.getElementById("canvasOverlay"), stock: document.getElementById("canvasStock"), color: document.getElementById("colorInput"),
  size: document.getElementById("sizeInput"), confirm: document.getElementById("confirmBtn"), undo: document.getElementById("undoBtn"), redo: document.getElementById("redoBtn"), clear: document.getElementById("clearBtn"),
  loading: document.getElementById("loadingVeil"), loadingText: document.getElementById("loadingText"), rankingDialog: document.getElementById("rankingDialog"), rankingList: document.getElementById("rankingList"),
  closeRanking: document.getElementById("closeRankingBtn"), runDialog: document.getElementById("runDialog"), runTitle: document.getElementById("runTitle"), runViewer: document.getElementById("runViewer"), closeRun: document.getElementById("closeRunBtn"),
};
const ctx = refs.canvas.getContext("2d", { willReadFrequently: true });
const shapes = [
  { shape:"square", label:"小さな正方形", w:.24, h:.24 }, { shape:"square", label:"大きな正方形", w:.38, h:.38 }, { shape:"rect", label:"横長長方形", w:.46, h:.24 },
  { shape:"rect", label:"縦長長方形", w:.25, h:.48 }, { shape:"circle", label:"円形", w:.34, h:.34 }, { shape:"rect", label:"細長い帯", w:.62, h:.16 }, { shape:"rounded", label:"角丸長方形", w:.42, h:.28 },
];
const state = { runId:null, day:1, current:null, pages:[], stock:[], selected:null, placed:null, tool:"pen", drawing:false, last:null, undo:[], redo:[], gameOver:false, rewriting:false, loadingTimers:[] };

function getUser(){ try { return JSON.parse(localStorage.getItem("currentUser") || "null") || {}; } catch { return {}; } }
function clearLoadingTimers(){ state.loadingTimers.forEach((timer) => clearTimeout(timer)); state.loadingTimers = []; }
function setLoading(show, text="AIがページの端をめくっています…"){ if (!show) clearLoadingTimers(); refs.loading.hidden = !show; refs.loadingText.textContent = text; }
function setLoadingSteps(steps){ clearLoadingTimers(); if (!steps.length) return; setLoading(true, steps[0].text); steps.slice(1).forEach((step) => { state.loadingTimers.push(setTimeout(() => { if (state.rewriting) refs.loadingText.textContent = step.text; }, step.delay)); }); }
function setStatus(text){ refs.status.textContent = text; }
function escapeHtml(s){ return String(s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
async function api(path, body){
  const res = await fetch(path, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[100ore api error]", { path, status: res.status, data });
    throw new Error(data.detail || data.error || `HTTP ${res.status}`);
  }
  return data;
}
function randomCanvas(){ const base = shapes[Math.floor(Math.random()*shapes.length)]; return { ...base, id:`c_${Date.now()}_${Math.random().toString(16).slice(2)}`, power:Math.round((base.w*base.h)*1000) }; }
function ensureStock(){ while(state.stock.length < 3) state.stock.push(randomCanvas()); renderStock(); }
function renderStock(){
  refs.stock.innerHTML = "";
  state.stock.forEach((item) => {
    const card = document.createElement("button"); card.type = "button"; card.className = `stock-card ${state.selected?.id === item.id ? "active" : ""}`;
    const shape = document.createElement("div"); shape.className = `stock-shape ${item.shape}`; shape.style.width = `${Math.round(item.w*130)}px`; shape.style.height = `${Math.round(item.h*130)}px`;
    const label = document.createElement("div"); label.className = "stock-label"; label.textContent = `${item.label} / 面積${item.power}`;
    card.append(shape,label); card.addEventListener("click", () => selectCanvas(item)); refs.stock.appendChild(card);
  });
}
function selectCanvas(item){ state.selected = item; state.placed = null; refs.confirm.disabled = true; clearDrawing(true); renderStock(); positionOverlay(null); setStatus("絵の上をタップしてキャンパスを配置してください。ドラッグで描くのは配置後です。"); }
function stageRect(){ return refs.stage.getBoundingClientRect(); }
function canvasPixelsFor(item, xRatio=.5, yRatio=.5){ const w = refs.canvas.width * item.w, h = refs.canvas.height * item.h; return { x:refs.canvas.width*xRatio-w/2, y:refs.canvas.height*yRatio-h/2, w, h }; }
function clampPlacement(item, xRatio, yRatio){ const box = canvasPixelsFor(item, xRatio, yRatio); const nx = Math.max(0, Math.min(refs.canvas.width - box.w, box.x)); const ny = Math.max(0, Math.min(refs.canvas.height - box.h, box.y)); return { x:nx/refs.canvas.width, y:ny/refs.canvas.height, w:box.w/refs.canvas.width, h:box.h/refs.canvas.height, shape:item.shape, label:item.label, id:item.id }; }
function positionOverlay(p){
  if (!p) { refs.overlay.style.display = "none"; return; }
  refs.overlay.style.display = "block"; refs.overlay.className = `canvas-overlay ${p.shape}`; refs.overlay.style.left = `${p.x*100}%`; refs.overlay.style.top = `${p.y*100}%`; refs.overlay.style.width = `${p.w*100}%`; refs.overlay.style.height = `${p.h*100}%`;
}
function resizeCanvas(){
  const rect = stageRect(); const dpr = Math.max(1, window.devicePixelRatio || 1); const old = document.createElement("canvas"); old.width = refs.canvas.width; old.height = refs.canvas.height; old.getContext("2d").drawImage(refs.canvas,0,0);
  refs.canvas.width = Math.max(1, Math.round(rect.width*dpr)); refs.canvas.height = Math.max(1, Math.round(rect.height*dpr)); refs.canvas.style.width = `${rect.width}px`; refs.canvas.style.height = `${rect.height}px`; ctx.setTransform(1,0,0,1,0,0);
  if (old.width && old.height) ctx.drawImage(old,0,0,refs.canvas.width,refs.canvas.height); if (state.placed) positionOverlay(state.placed);
}
function pushUndo(){ state.undo.push(refs.canvas.toDataURL("image/png")); if (state.undo.length > 20) state.undo.shift(); state.redo = []; }
function restoreFrom(dataUrl){ const img = new Image(); img.onload = () => { ctx.clearRect(0,0,refs.canvas.width,refs.canvas.height); ctx.drawImage(img,0,0,refs.canvas.width,refs.canvas.height); }; img.src = dataUrl; }
function clearDrawing(skipUndo=false){ if (!skipUndo) pushUndo(); ctx.clearRect(0,0,refs.canvas.width,refs.canvas.height); }
function pointFromEvent(e){ const r = refs.canvas.getBoundingClientRect(); const t = e.touches?.[0] || e.changedTouches?.[0] || e; return { x:(t.clientX-r.left) * refs.canvas.width/r.width, y:(t.clientY-r.top) * refs.canvas.height/r.height }; }
function isInsideShape(p, placed=state.placed){ if (!placed) return false; const x=placed.x*refs.canvas.width, y=placed.y*refs.canvas.height, w=placed.w*refs.canvas.width, h=placed.h*refs.canvas.height; if (placed.shape === "circle") { const cx=x+w/2, cy=y+h/2, rx=w/2, ry=h/2; return (((p.x-cx)/rx)**2 + ((p.y-cy)/ry)**2) <= 1; } return p.x>=x && p.x<=x+w && p.y>=y && p.y<=y+h; }
function clipToPlaced(){ const p=state.placed; const x=p.x*refs.canvas.width, y=p.y*refs.canvas.height, w=p.w*refs.canvas.width, h=p.h*refs.canvas.height; ctx.beginPath(); if (p.shape === "circle") ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2); else if (p.shape === "rounded") { const r=Math.min(28,w/5,h/5); ctx.roundRect(x,y,w,h,r); } else ctx.rect(x,y,w,h); ctx.clip(); }
function drawLine(a,b){ ctx.save(); clipToPlaced(); ctx.lineCap="round"; ctx.lineJoin="round"; ctx.lineWidth=Number(refs.size.value); ctx.globalAlpha=state.tool === "marker" ? .42 : 1; ctx.globalCompositeOperation=state.tool === "eraser" ? "destination-out" : "source-over"; ctx.strokeStyle=state.tool === "eraser" ? "#000" : refs.color.value; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.restore(); }
function onPointerDown(e){
  e.preventDefault(); const p = pointFromEvent(e);
  if (!state.placed) { if (!state.selected) return setStatus("先にキャンパスストックを1枚選んでください。"); state.placed = clampPlacement(state.selected, p.x/refs.canvas.width, p.y/refs.canvas.height); positionOverlay(state.placed); refs.confirm.disabled = false; pushUndo(); setStatus("配置しました。キャンパス内に落書きして、改変を確定してください。"); return; }
  if (!isInsideShape(p)) return; pushUndo(); state.drawing = true; state.last = p;
}
function onPointerMove(e){ if (!state.drawing) return; e.preventDefault(); const p=pointFromEvent(e); drawLine(state.last,p); state.last=p; }
function onPointerUp(){ state.drawing=false; state.last=null; }
async function loadImage(src){ return new Promise((resolve,reject)=>{ const img = new Image(); img.crossOrigin="anonymous"; img.onload=()=>resolve(img); img.onerror=reject; img.src=src; }); }
async function buildComposite(){
  const size = 512; const out = document.createElement("canvas"); out.width=size; out.height=size; const o=out.getContext("2d"); const img=await loadImage(refs.img.src); o.fillStyle="#f7e8c3"; o.fillRect(0,0,size,size); o.drawImage(img,0,0,size,size);
  if (state.placed) { const p=state.placed; const x=p.x*size, y=p.y*size, w=p.w*size, h=p.h*size; o.save(); o.beginPath(); if(p.shape==="circle") o.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2); else if(p.shape==="rounded") o.roundRect(x,y,w,h,24); else o.rect(x,y,w,h); o.clip(); o.drawImage(refs.canvas,0,0,size,size); o.restore(); o.save(); o.strokeStyle="rgba(120,42,28,.9)"; o.lineWidth=5; o.setLineDash([16,10]); o.beginPath(); if(p.shape==="circle") o.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2); else if(p.shape==="rounded") o.roundRect(x,y,w,h,24); else o.rect(x,y,w,h); o.stroke(); o.restore(); }
  return out.toDataURL("image/jpeg", 0.72);
}
function applyPage(page, { append=true } = {}){
  state.current = page; state.day = Number(page.day || state.day || 1); refs.day.textContent = `${state.day}日目`; refs.pageTitle.textContent = page.pageTitle || `${state.day}日目`; refs.story.textContent = page.bodyText || ""; refs.scene.textContent = page.sceneSummary || ""; refs.img.src = page.imageDataUrl || page.imageUrl || "";
  const imageFailed = Boolean(page.imageGenerationFailed); refs.stage.classList.toggle("image-generation-failed", imageFailed); refs.fallbackNotice.hidden = !imageFailed;
  if (imageFailed) setStatus("挿絵生成に失敗したため、紙のプレースホルダーを表示しています。本文を本物の挿絵として扱ってください。");
  if (append) state.pages.push({ day:state.day, pageTitle:page.pageTitle, bodyText:page.bodyText, sceneSummary:page.sceneSummary, imageHash:page.imageHash, imageUrl:page.imageUrl || "", imageGenerationFailed:imageFailed });
  clearDrawing(true); state.undo=[]; state.redo=[]; state.selected=null; state.placed=null; positionOverlay(null); refs.confirm.disabled=true; renderStock(); setTimeout(resizeCanvas, 60);
}
async function startGame(){
  refs.cover.hidden = true; refs.game.hidden = false; resizeCanvas(); ensureStock(); setLoading(true,"表紙をめくっています…");
  try { const user=getUser(); const data = await api("/api/100ore/start", { username:user.username || localStorage.getItem("username") || "旅人", userTrackingId:user.userTrackingId || localStorage.getItem("userTrackingId") || "" }); state.runId=data.runId; applyPage(data.page); setStatus("キャンパスを選び、絵の中に小さな運命を描き込んでください。"); }
  catch(e){ setStatus(`開始に失敗しました: ${e.message}`); refs.cover.hidden=false; refs.game.hidden=true; }
  finally{ setLoading(false); }
}
function isGameOverValue(value){ return value === true || (typeof value === "string" && value.trim().toLowerCase() === "true") || value === 1; }
async function confirmRewrite(){
  if (!state.placed || state.gameOver || state.rewriting) return;
  state.rewriting = true;
  refs.confirm.disabled = true;
  setLoadingSteps([{ text:"落書きを読み取っています", delay:0 }, { text:"次の物語を編んでいます", delay:12000 }, { text:"挿絵を描いています", delay:22000 }]);
  try {
    const compositeImageDataUrl = await buildComposite(); const usedCanvas = state.placed; const strokesImageHash = await sha256(await (await fetch(refs.canvas.toDataURL("image/png"))).arrayBuffer());
    const currentPageLite = {
      day: state.current?.day,
      pageTitle: state.current?.pageTitle,
      bodyText: state.current?.bodyText,
      sceneSummary: state.current?.sceneSummary,
      imageHash: state.current?.imageHash,
    };
    const data = await api("/api/100ore/rewrite", { runId:state.runId, day:state.day, currentPage:currentPageLite, compositeImageDataUrl, canvas:usedCanvas, drawingHash:strokesImageHash });
    refs.outcome.textContent = data.outcome?.outcomeType || "改変"; addHistory(data.outcome);
    if (state.pages.length) state.pages[state.pages.length - 1] = { ...state.pages[state.pages.length - 1], outcome: data.outcome, canvas: usedCanvas };
    state.stock = state.stock.filter(c => c.id !== state.selected?.id); ensureStock();
    if (isGameOverValue(data.outcome?.gameOver)) { state.gameOver = true; await saveRun(data.outcome); showGameOver(data.outcome); return; }
    applyPage(data.nextPage); if (!data.nextPage?.imageGenerationFailed) setStatus("続きのページが現れました。残りのキャンパスでまた介入できます。");
  } catch(e) { console.error(e); setStatus(`改変に失敗しました: ${e.message}`); if (state.placed && !state.gameOver) refs.confirm.disabled = false; }
  finally{ state.rewriting = false; setLoading(false); }
}
async function sha256(buffer){ const hash = await crypto.subtle.digest("SHA-256", buffer); return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
function addHistory(outcome){ if(!outcome) return; const el=document.createElement("div"); el.className="history-item"; el.textContent = `${state.day}日目: ${outcome.rewriteText || outcome.outcomeSummary || "物語が少し曲がった。"}`; refs.history.prepend(el); }
async function saveRun(outcome){ const user=getUser(); await api("/api/100ore/runs", { runId:state.runId, username:user.username || localStorage.getItem("username") || "名無しの俺", userTrackingId:user.userTrackingId || localStorage.getItem("userTrackingId") || "", score:state.day, gameOverReason:outcome.gameOverReason || outcome.outcomeSummary || "物語から退場", pages:state.pages, endedAt:new Date().toISOString() }).catch(e => setStatus(`ランキング保存に失敗しました: ${e.message}`)); }
function showGameOver(outcome){ const div=document.createElement("div"); div.className="game-over-card"; div.innerHTML=`<h2>ゲームオーバー：${state.day}日目</h2><p>${escapeHtml(outcome.gameOverReason || outcome.outcomeSummary || "俺は絵本から消えた。")}</p><button class="primary-btn" id="againBtn">もう一度</button> <button class="ghost-btn" id="overRankBtn">ランキング</button>`; document.body.appendChild(div); div.querySelector("#againBtn").onclick=()=>location.reload(); div.querySelector("#overRankBtn").onclick=showRanking; setStatus("記録を保存しました。ほかの俺の絵本も覗けます。"); }
async function showRanking(){ refs.rankingDialog.showModal(); refs.rankingList.textContent="読み込み中…"; try{ const res=await fetch("/api/100ore/rankings"); const data=await res.json(); refs.rankingList.innerHTML=""; (data.rankings||[]).forEach((r,i)=>{ const row=document.createElement("div"); row.className="rank-row"; row.innerHTML=`<b>${i+1}</b><span>${escapeHtml(r.username||"名無しの俺")}<br><small>${escapeHtml(r.gameOverReason||"")}</small></span><strong>${r.score}日</strong>`; const btn=document.createElement("button"); btn.className="small-btn"; btn.textContent="絵本を見る"; btn.onclick=()=>showRun(r.runId); row.appendChild(btn); refs.rankingList.appendChild(row); }); if(!refs.rankingList.children.length) refs.rankingList.textContent="まだ記録がありません。"; }catch(e){ refs.rankingList.textContent=`ランキング取得に失敗: ${e.message}`; } }
async function showRun(runId){ refs.runDialog.showModal(); refs.runViewer.textContent="読み込み中…"; try{ const res=await fetch(`/api/100ore/runs/${encodeURIComponent(runId)}`); const data=await res.json(); refs.runTitle.textContent=`${data.run?.username || "誰か"}の絵本`; refs.runViewer.innerHTML=""; (data.run?.pages||[]).forEach(p=>{ const el=document.createElement("div"); el.className="run-page"; el.innerHTML=`${p.imageUrl ? `<img src="${p.imageUrl}" alt="">` : `<div></div>`}<div><b>${escapeHtml(p.pageTitle||`${p.day}日目`)}</b><p>${escapeHtml(p.bodyText||"")}</p><small>${escapeHtml(p.sceneSummary||"")}</small>${(p.outcomeSummary || p.outcome) ? `<p><em>改変: ${escapeHtml(p.outcomeSummary || p.outcome?.outcomeSummary || p.outcome?.rewriteText || "")}</em></p>` : ""}</div>`; refs.runViewer.appendChild(el); }); }catch(e){ refs.runViewer.textContent=`閲覧に失敗: ${e.message}`; } }

refs.start.onclick = startGame; refs.confirm.onclick = confirmRewrite; refs.ranking.onclick=showRanking; refs.rankingTop.onclick=showRanking; refs.closeRanking.onclick=()=>refs.rankingDialog.close(); refs.closeRun.onclick=()=>refs.runDialog.close();
document.querySelectorAll(".tool-choice").forEach(btn => btn.onclick=()=>{ state.tool=btn.dataset.tool; document.querySelectorAll(".tool-choice").forEach(b=>b.classList.toggle("active", b===btn)); });
refs.undo.onclick=()=>{ if(!state.undo.length) return; state.redo.push(refs.canvas.toDataURL("image/png")); restoreFrom(state.undo.pop()); }; refs.redo.onclick=()=>{ if(!state.redo.length) return; state.undo.push(refs.canvas.toDataURL("image/png")); restoreFrom(state.redo.pop()); }; refs.clear.onclick=()=>clearDrawing();
refs.canvas.addEventListener("pointerdown", onPointerDown); refs.canvas.addEventListener("pointermove", onPointerMove); refs.canvas.addEventListener("pointerup", onPointerUp); refs.canvas.addEventListener("pointerleave", onPointerUp); window.addEventListener("resize", resizeCanvas);
ensureStock(); positionOverlay(null);
