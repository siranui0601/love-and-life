import { boardPoint, rootPoint, SVG_NS } from "./view.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reduced = () => matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
const svgEl = (name, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
};

function viewPoint(point, viewPlayer) {
  if (!point) return { x: 500, y: 400 };
  if (Number.isInteger(point.x) && Number.isInteger(point.y)) return boardPoint(point, viewPlayer);
  let x = (Number(point.x) + .5) * 100;
  let y = (Number(point.y) + .5) * 100;
  if (viewPlayer === 1) { x = 1000 - x; y = 800 - y; }
  return { x, y };
}

function boardNudge(boardWrap, strength = 1) {
  if (!boardWrap || reduced()) return Promise.resolve();
  const d = 3 * strength;
  return boardWrap.animate([
    { transform: "translate(0,0)" },
    { transform: `translate(${d}px,${-d * .45}px)` },
    { transform: `translate(${-d * .65}px,${d * .3}px)` },
    { transform: "translate(0,0)" },
  ], { duration: 145, easing: "ease-out" }).finished.catch(() => {});
}

function clearFx(fxSvg, fxLayer) {
  if (fxSvg) fxSvg.innerHTML = "";
  if (fxLayer) fxLayer.innerHTML = "";
}

async function growOne(event, ctx) {
  if (!event.from || !event.to) return;
  const a = viewPoint(event.from, ctx.viewPlayer);
  const b = viewPoint(event.to, ctx.viewPlayer);
  const line = svgEl("line", {
    class: `fx-growth p${event.player ?? 0}`,
    x1: a.x, y1: a.y, x2: b.x, y2: b.y,
  });
  ctx.fxSvg.append(line);
  if (reduced()) { await sleep(45); line.remove(); return; }
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 100;
  line.style.strokeDasharray = `${length}`;
  line.style.strokeDashoffset = `${length}`;
  await line.animate([
    { strokeDashoffset: length, opacity: .4 },
    { strokeDashoffset: 0, opacity: 1 },
  ], { duration: event.type === "sculpt-grow" ? 155 : 205, easing: "cubic-bezier(.2,.8,.25,1)" }).finished.catch(() => {});
  line.remove();
}

async function growthWave(events, ctx) {
  const natural = events.filter((e) => e.type === "grow");
  const sculpt = events.filter((e) => e.type === "sculpt-grow");
  if (natural.length) await Promise.all(natural.map((e) => growOne(e, ctx)));
  if (sculpt.length) {
    if (!reduced()) await sleep(35);
    await Promise.all(sculpt.map((e) => growOne(e, ctx)));
  }
}

function impactStar(point, ctx) {
  const p = viewPoint(point, ctx.viewPlayer);
  const ring = svgEl("circle", { class: "fx-impact-ring", cx: p.x, cy: p.y, r: 24 });
  const star = svgEl("path", {
    class: "fx-impact-star",
    d: `M ${p.x} ${p.y-30} L ${p.x+9} ${p.y-10} L ${p.x+31} ${p.y-8} L ${p.x+13} ${p.y+5} L ${p.x+18} ${p.y+28} L ${p.x} ${p.y+15} L ${p.x-19} ${p.y+29} L ${p.x-13} ${p.y+6} L ${p.x-31} ${p.y-7} L ${p.x-9} ${p.y-10} Z`,
  });
  ctx.fxSvg.append(ring, star);
  if (reduced()) return sleep(80).then(() => { ring.remove(); star.remove(); });
  const a = ring.animate([{ transformOrigin: `${p.x}px ${p.y}px`, transform: "scale(.3)", opacity: 1 }, { transformOrigin: `${p.x}px ${p.y}px`, transform: "scale(1.9)", opacity: 0 }], { duration: 260, easing: "ease-out" });
  const b = star.animate([{ transformOrigin: `${p.x}px ${p.y}px`, transform: "scale(.4) rotate(-10deg)", opacity: 1 }, { transformOrigin: `${p.x}px ${p.y}px`, transform: "scale(1.15) rotate(8deg)", opacity: 1 }, { transformOrigin: `${p.x}px ${p.y}px`, transform: "scale(.8) rotate(16deg)", opacity: 0 }], { duration: 250, easing: "ease-out" });
  return Promise.allSettled([a.finished,b.finished]).then(() => { ring.remove(); star.remove(); });
}

async function hookSwipe(event, ctx) {
  const p = viewPoint(event.point, ctx.viewPlayer);
  const side = event.attackerPlayer === ctx.viewPlayer ? 1 : -1;
  const hook = svgEl("path", {
    class: "fx-hook-swipe",
    d: `M ${p.x-62*side} ${p.y+10} Q ${p.x-8*side} ${p.y-58} ${p.x+23*side} ${p.y-3} Q ${p.x+35*side} ${p.y+23} ${p.x+9*side} ${p.y+30}`,
  });
  const slash = svgEl("line", {
    class: "fx-hook-slash",
    x1: p.x - 34, y1: p.y + 34,
    x2: p.x + 34, y2: p.y - 34,
  });
  ctx.fxSvg.append(hook, slash);
  navigator.vibrate?.([18, 16, 32]);
  if (reduced()) {
    await sleep(100);
    hook.remove(); slash.remove();
    return;
  }
  const hookLen = 150;
  hook.style.strokeDasharray = `${hookLen}`;
  hook.style.strokeDashoffset = `${hookLen}`;
  const a = hook.animate([
    { strokeDashoffset: hookLen, opacity: .2, transform: `translate(${-18*side}px,0)` },
    { strokeDashoffset: 0, opacity: 1, transform: "translate(0,0)", offset: .62 },
    { strokeDashoffset: 0, opacity: 0, transform: `translate(${16*side}px,4px)` },
  ], { duration: 340, easing: "cubic-bezier(.2,.85,.3,1)" });
  const b = slash.animate([
    { opacity: 0, transformOrigin: `${p.x}px ${p.y}px`, transform: "scale(.35)" },
    { opacity: 1, transformOrigin: `${p.x}px ${p.y}px`, transform: "scale(1.1)", offset: .45 },
    { opacity: 0, transformOrigin: `${p.x}px ${p.y}px`, transform: "scale(1.25)" },
  ], { duration: 300, delay: 110, easing: "ease-out" });
  boardNudge(ctx.boardWrap, 1.25);
  await Promise.allSettled([a.finished, b.finished]);
  hook.remove(); slash.remove();
}

async function fragments(event, ctx) {
  const removed = Array.isArray(event.removed) ? event.removed : [];
  if (!removed.length) return;
  const tasks = removed.map((item, i) => {
    const p = viewPoint(item.cell, ctx.viewPlayer);
    const rect = svgEl("rect", { class: `fx-fragment p${event.player ?? 0}`, x: p.x - 16, y: p.y - 23, width: 32, height: 46, rx: 14 });
    ctx.fxSvg.append(rect);
    if (reduced()) return rect.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100 }).finished.finally(() => rect.remove());
    const side = i % 2 ? 1 : -1;
    const dx = side * (35 + i * 8);
    const dy = 70 + Math.min(i * 14, 90);
    return rect.animate([
      { transformOrigin: `${p.x}px ${p.y}px`, transform: "translate(0,0) rotate(0deg)", opacity: 1 },
      { transformOrigin: `${p.x}px ${p.y}px`, transform: `translate(${dx*.35}px,${-18-i*4}px) rotate(${side*12}deg)`, opacity: 1, offset: .3 },
      { transformOrigin: `${p.x}px ${p.y}px`, transform: `translate(${dx}px,${dy}px) rotate(${side*(70+i*11)}deg)`, opacity: 0 },
    ], { duration: 360 + i * 32, delay: i * 16, easing: "cubic-bezier(.25,.7,.35,1)" }).finished.finally(() => rect.remove());
  });
  await Promise.allSettled(tasks);
}

async function collisionWave(events, ctx) {
  const collisionEvents = events.filter((e) => ["tip-collision","segment-collision","own-block"].includes(e.type));
  const hookEvents = collisionEvents.filter((e) => e.type === "segment-collision" && e.hookCut);
  const ordinary = collisionEvents.filter((e) => !e.hookCut);
  const removalEvents = events.filter((e) => ["break","sever"].includes(e.type));
  if (!collisionEvents.length && !removalEvents.length) return;
  navigator.vibrate?.(collisionEvents.length ? 28 : 12);
  await Promise.allSettled([
    ...ordinary.map((event) => impactStar(event.point, ctx)),
    ...hookEvents.map((event) => hookSwipe(event, ctx)),
  ]);
  if (ordinary.length) boardNudge(ctx.boardWrap, Math.min(1.7, .8 + ordinary.length * .15));
  await Promise.allSettled(removalEvents.map((event) => fragments(event, ctx)));
}

function snapshotPolyline(snapshot, viewPlayer, player, fingerIndex) {
  const root = rootPoint(player, fingerIndex, viewPlayer);
  const pts = [root, ...snapshot.map((item) => viewPoint(item.cell, viewPlayer))];
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

async function captureOne(event, ctx) {
  const target = viewPoint(event.cell, ctx.viewPlayer);
  const attackerPts = Array.isArray(event.attackPath) ? event.attackPath : [];
  const defenderPts = Array.isArray(event.defenderPath) ? event.defenderPath : [];
  const attackLine = svgEl("polyline", { class: "fx-capture-nail", points: snapshotPolyline(attackerPts, ctx.viewPlayer, event.attackerPlayer, event.attackerFinger) });
  const defendLine = defenderPts.length ? svgEl("polyline", { class: "fx-capture-nail", points: snapshotPolyline(defenderPts, ctx.viewPlayer, event.defenderPlayer, event.defenderFinger) }) : null;
  const finger = svgEl("rect", { class: "fx-capture-finger", x: target.x - 29, y: target.y - 43, width: 58, height: 86, rx: 27, fill: event.defenderPlayer === 0 ? "#f2ad87" : "#e3bc94" });
  const nailBed = svgEl("rect", { class: "fx-fragment", x: target.x - 15, y: target.y - 28, width: 30, height: 40, rx: 13 });
  ctx.fxSvg.append(attackLine);
  if (defendLine) ctx.fxSvg.append(defendLine);
  ctx.fxSvg.append(finger,nailBed);
  const word = document.createElement("div");
  word.className = "capture-word";
  word.textContent = "詰み！";
  ctx.fxLayer.append(word);
  navigator.vibrate?.([25,25,45]);
  if (reduced()) {
    await sleep(150);
    [attackLine,defendLine,finger,nailBed,word].forEach((el) => el?.remove());
    return;
  }
  boardNudge(ctx.boardWrap, 1.5);
  const flyX = event.defenderPlayer === ctx.viewPlayer ? -95 : 95;
  const fingerA = finger.animate([
    { transformOrigin:`${target.x}px ${target.y}px`, transform:"translate(0,0) rotate(0deg) scale(1)", opacity:1 },
    { transformOrigin:`${target.x}px ${target.y}px`, transform:`translate(${flyX*.35}px,-35px) rotate(${flyX>0?14:-14}deg) scale(1.08)`, opacity:1, offset:.35 },
    { transformOrigin:`${target.x}px ${target.y}px`, transform:`translate(${flyX}px,-120px) rotate(${flyX>0?54:-54}deg) scale(.82)`, opacity:0 },
  ], { duration: 560, easing:"cubic-bezier(.2,.75,.25,1)" });
  const bedA = nailBed.animate([
    { transformOrigin:`${target.x}px ${target.y}px`, transform:"translate(0,0) rotate(0deg)",opacity:1 },
    { transformOrigin:`${target.x}px ${target.y}px`, transform:`translate(${-flyX*.45}px,-75px) rotate(${flyX>0?-80:80}deg)`,opacity:0 },
  ], { duration: 430, delay:60, easing:"ease-out" });
  const defA = defendLine?.animate([{opacity:1},{transform:`translate(${flyX*.35}px,-55px) rotate(${flyX>0?12:-12}deg)`,opacity:0}],{duration:420,easing:"ease-out"});
  const attackA = attackLine.animate([
    { opacity:1, strokeDasharray:"1 0" },
    { opacity:1, strokeDasharray:"28 13", offset:.25 },
    { transform:`translate(${flyX*.12}px,35px) rotate(${flyX>0?-5:5}deg)`, opacity:0, strokeDasharray:"18 20" },
  ], { duration: 520, delay:80, easing:"ease-in" });
  const wordA = word.animate([
    { transform:"translate(-50%,-50%) rotate(-7deg) scale(.25)",opacity:0 },
    { transform:"translate(-50%,-50%) rotate(4deg) scale(1.18)",opacity:1,offset:.5 },
    { transform:"translate(-50%,-50%) rotate(-4deg) scale(1)",opacity:1,offset:.76 },
    { transform:"translate(-50%,-50%) rotate(-4deg) scale(.94)",opacity:0 },
  ], { duration:600,easing:"cubic-bezier(.2,.9,.25,1)" });
  await Promise.allSettled([fingerA.finished,bedA.finished,defA?.finished,attackA.finished,wordA.finished].filter(Boolean));
  [attackLine,defendLine,finger,nailBed,word].forEach((el) => el?.remove());
}

async function captureWave(events, ctx) {
  const captures = events.filter((e) => e.type === "capture");
  for (const event of captures) await captureOne(event, ctx);
}

export async function animateCare(effect, ctx) {
  if (!effect?.cell || !ctx.fxSvg) return;
  const p = viewPoint(effect.cell, ctx.viewPlayer);
  const ring = svgEl("circle", { class:"care-pop", cx:p.x, cy:p.y, r:22 });
  ctx.fxSvg.append(ring);
  const sparkCount = reduced() ? 0 : 5;
  const sparks = [];
  for (let i=0;i<sparkCount;i+=1) {
    const angle = Math.PI * 2 * i / sparkCount;
    const tri = svgEl("circle", { class:"care-spark", cx:p.x, cy:p.y, r:5 });
    ctx.fxSvg.append(tri);
    sparks.push({el:tri,dx:Math.cos(angle)*42,dy:Math.sin(angle)*42});
  }
  const tasks = [ring.animate([{r:16,opacity:1},{r:44,opacity:0}],{duration:reduced()?90:280,easing:"ease-out"}).finished];
  for (const s of sparks) tasks.push(s.el.animate([{transform:"translate(0,0)",opacity:1},{transform:`translate(${s.dx}px,${s.dy}px)`,opacity:0}],{duration:260,easing:"ease-out"}).finished);
  await Promise.allSettled(tasks);
  ring.remove(); sparks.forEach((s)=>s.el.remove());
}

export async function animateTurn({ events = [], beforeState, nextState, viewPlayer = 0, renderFinal }) {
  const fxSvg = document.getElementById("fxSvg");
  const fxLayer = document.getElementById("fxLayer");
  const boardWrap = document.getElementById("boardWrap");
  if (!fxSvg || !fxLayer) { renderFinal?.(); return; }
  clearFx(fxSvg,fxLayer);
  const ctx = { fxSvg,fxLayer,boardWrap,viewPlayer };
  const careEvents = events.filter((e)=>String(e.type).startsWith("care-"));
  for (const event of careEvents) await animateCare(event,ctx);
  await growthWave(events,ctx);
  renderFinal?.();
  await collisionWave(events,ctx);
  await captureWave(events,ctx);
  clearFx(fxSvg,fxLayer);
}

export function careFxContext(viewPlayer = 0) {
  return {
    fxSvg: document.getElementById("fxSvg"),
    fxLayer: document.getElementById("fxLayer"),
    boardWrap: document.getElementById("boardWrap"),
    viewPlayer,
  };
}
