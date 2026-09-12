import { BOARD, FINGER_NAMES, currentTip, getNail, previewMove, rootFor, segmentDefense, tipMaterial } from "./engine.js";

const CELL = 100;
const NS = "http://www.w3.org/2000/svg";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const FINGER_VISUALS = Object.freeze([
  { width: 86, depth: 88, nailW: 42, nailH: 42, taper: 9 },
  { width: 58, depth: 108, nailW: 31, nailH: 47, taper: 7 },
  { width: 62, depth: 124, nailW: 33, nailH: 50, taper: 7 },
  { width: 57, depth: 111, nailW: 30, nailH: 46, taper: 7 },
  { width: 47, depth: 86, nailW: 25, nailH: 38, taper: 6 },
]);

export function boardPoint(cell, viewPlayer = 0) {
  let x = (cell.x + 0.5) * CELL;
  let y = (cell.y + 0.5) * CELL;
  if (viewPlayer === 1) {
    x = BOARD.cols * CELL - x;
    y = BOARD.rows * CELL - y;
  }
  return { x, y };
}

export function rootPoint(player, fingerIndex, viewPlayer = 0) {
  const root = rootFor(player, fingerIndex);
  let x = (root.x + 0.5) * CELL;
  let y = player === 0 ? BOARD.rows * CELL : 0;
  if (viewPlayer === 1) {
    x = BOARD.cols * CELL - x;
    y = BOARD.rows * CELL - y;
  }
  return { x, y };
}

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function pointsAttr(points) { return points.map((p) => `${p.x},${p.y}`).join(" "); }
function worldDirectionToView(nail, viewPlayer) { return viewPlayer === 1 ? -nail.direction : nail.direction; }
function segmentMid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function defenseLabel(value) { return value >= 3 ? "かなりかたい" : value >= 2 ? "かたい" : "ふつう"; }

function fingerBodyPath(visual, onBottom) {
  const w = visual.width;
  const half = w / 2;
  const t = visual.taper;
  if (onBottom) {
    const tip = -visual.depth;
    return `M ${-half} 28 L ${-half + t} ${tip + 30} C ${-half + t + 2} ${tip + 9} ${-w * .24} ${tip} 0 ${tip} C ${w * .24} ${tip} ${half - t - 2} ${tip + 9} ${half - t} ${tip + 30} L ${half} 28 Z`;
  }
  const tip = visual.depth;
  return `M ${-half} -28 L ${-half + t} ${tip - 30} C ${-half + t + 2} ${tip - 9} ${-w * .24} ${tip} 0 ${tip} C ${w * .24} ${tip} ${half - t - 2} ${tip - 9} ${half - t} ${tip - 30} L ${half} -28 Z`;
}

function fingerMarkup(state, player, fingerIndex, options) {
  const { viewPlayer, selectedFinger, localPlayer, canEdit } = options;
  const captured = state.capturedFingers[player].includes(fingerIndex);
  const anchor = rootPoint(player, fingerIndex, viewPlayer);
  const visual = FINGER_VISUALS[fingerIndex];
  const onBottom = anchor.y > BOARD.rows * CELL / 2;
  const own = player === localPlayer;
  const selected = own && fingerIndex === selectedFinger && !captured;
  const direction = onBottom ? -1 : 1;
  const nailY = onBottom ? -visual.depth + 17 : visual.depth - 17 - visual.nailH;
  const nailCY = nailY + visual.nailH / 2;
  const klass = `finger-group finger-${fingerIndex}${own ? " is-own" : ""}${own && canEdit && !captured ? " is-interactive" : ""}`;
  const data = own && canEdit && !captured ? ` data-finger="${fingerIndex}"` : "";
  if (captured) {
    const y = anchor.y + direction * 12;
    return `<g class="finger-group"><path class="missing-finger" d="M ${anchor.x - visual.width * .36} ${y} Q ${anchor.x} ${y + direction * 22} ${anchor.x + visual.width * .36} ${y}"/></g>`;
  }
  const body = fingerBodyPath(visual, onBottom);
  const cuticleY = onBottom ? nailY + visual.nailH + 5 : nailY - 5;
  return `<g class="${klass}"${data} role="button" aria-label="${esc(FINGER_NAMES[fingerIndex])}を選ぶ" tabindex="${own && canEdit ? 0 : -1}" transform="translate(${anchor.x} ${anchor.y})">
    ${selected ? `<ellipse class="finger-select-ring" cx="0" cy="${nailCY}" rx="${visual.nailW * .86}" ry="${visual.nailH * .82}"/>` : ""}
    <path class="finger-body p${player}" d="${body}"/>
    <path class="finger-cuticle p${player}" d="M ${-visual.nailW * .43} ${cuticleY} Q 0 ${cuticleY + (onBottom ? 6 : -6)} ${visual.nailW * .43} ${cuticleY}"/>
    <rect class="finger-nail-bed p${player}" x="${-visual.nailW / 2}" y="${nailY}" width="${visual.nailW}" height="${visual.nailH}" rx="${Math.round(visual.nailW * .44)}"/>
  </g>`;
}

function materialMarkup(nail, points) {
  const out = [];
  for (let i = 0; i < nail.path.length; i += 1) {
    const from = points[i], to = points[i + 1];
    if (!from || !to) continue;
    const mat = nail.materials[i] || {};
    if (mat.gel) out.push(`<line class="material-segment gel" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`);
    if (mat.kind === "sculpt") out.push(`<line class="material-segment sculpt" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`);
    if (mat.kind === "hook" && i !== nail.path.length - 1) {
      const m = segmentMid(from, to);
      const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
      out.push(`<g class="hook-seed" transform="translate(${m.x} ${m.y}) rotate(${angle})"><rect class="hook-seed-collar" x="-17" y="-13" width="31" height="26" rx="9"/><path class="hook-seed-tooth" d="M 8 -10 C 25 -6 26 10 11 15 L 6 7 C 14 5 15 -2 8 -3 Z"/></g>`);
    }
  }
  return out.join("");
}

function hookTipMarkup(nail, points) {
  if (tipMaterial(nail).kind !== "hook" || points.length < 2) return "";
  const tip = points.at(-1), prev = points.at(-2);
  const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x) * 180 / Math.PI;
  return `<g class="hook-tip" transform="translate(${tip.x} ${tip.y}) rotate(${angle})"><path class="hook-tip-shadow" d="M -34 -23 L 5 -23 C 34 -23 50 -6 47 17 C 44 43 18 57 -10 43 L -2 24 C 11 32 26 24 28 13 C 29 3 20 -2 5 -2 L -34 -2 Z"/><path class="hook-tip-body" d="M -31 -18 L 5 -18 C 28 -18 41 -5 39 14 C 37 35 17 47 -6 37 L 1 22 C 12 27 23 21 24 12 C 25 4 18 0 5 0 L -31 0 Z"/><path class="hook-tip-ridge" d="M -23 -9 L 6 -9 C 21 -9 30 -1 29 11 C 28 21 20 29 10 31"/><path class="hook-tip-barb" d="M 7 31 L 21 39 L 12 23 Z"/></g>`;
}

function sharpenMarkup(nail, points) {
  const mat = tipMaterial(nail);
  if (!mat.sharpened || points.length < 2 || mat.kind === "hook") return "";
  const tip = points.at(-1), prev = points.at(-2);
  const dx = tip.x - prev.x, dy = tip.y - prev.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const p1 = { x: tip.x + ux * 22, y: tip.y + uy * 22 };
  const p2 = { x: tip.x - ux * 5 + px * 11, y: tip.y - uy * 5 + py * 11 };
  const p3 = { x: tip.x - ux * 5 - px * 11, y: tip.y - uy * 5 - py * 11 };
  return `<polygon class="sharpen-tip" points="${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}"/>`;
}

function targetMarkup(nail, points, options) {
  if (options.targeting !== "gel" || nail.player !== options.localPlayer || nail.fingerIndex !== options.selectedFinger || !options.canEdit) return "";
  return nail.path.map((_, i) => {
    const from = points[i], to = points[i + 1];
    if (!from || !to) return "";
    const m = segmentMid(from, to);
    return `<circle class="segment-target" data-segment="${i}" data-finger="${nail.fingerIndex}" cx="${m.x}" cy="${m.y}" r="29"><title>${esc(FINGER_NAMES[nail.fingerIndex])}・${defenseLabel(segmentDefense(nail, i))}</title></circle>`;
  }).join("");
}

function nailMarkup(nail, options) {
  if (!nail.alive || !nail.path.length) return "";
  const points = [rootPoint(nail.player, nail.fingerIndex, options.viewPlayer), ...nail.path.map((cell) => boardPoint(cell, options.viewPlayer))];
  const attr = pointsAttr(points);
  const own = nail.player === options.localPlayer;
  const selected = own && nail.fingerIndex === options.selectedFinger;
  const hidden = nail.hiddenThisRound;
  return `<g class="nail-group${hidden ? " is-hidden" : ""}" data-nail="${nail.id}">${selected ? `<polyline class="nail-selection" points="${attr}"/>` : ""}<polyline class="nail-outline" points="${attr}"/><polyline class="nail-core p${nail.player}" points="${attr}"/>${materialMarkup(nail, points)}<polyline class="nail-highlight" points="${attr}"/>${hidden ? `<polyline class="hidden-veil" points="${attr}"/>` : ""}${hookTipMarkup(nail, points)}${sharpenMarkup(nail, points)}${own && options.canEdit ? `<polyline class="nail-hit" data-finger="${nail.fingerIndex}" points="${attr}" aria-label="${esc(FINGER_NAMES[nail.fingerIndex])}の爪"/>` : ""}${targetMarkup(nail, points, options)}</g>`;
}

function arrowTriangle(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const apex = { x: to.x + ux * 7, y: to.y + uy * 7 };
  const base = { x: to.x - ux * 12, y: to.y - uy * 12 };
  return `${apex.x},${apex.y} ${base.x + px * 8},${base.y + py * 8} ${base.x - px * 8},${base.y - py * 8}`;
}

function previewForFinger(state, options, fingerIndex) {
  if (!options.canEdit) return "";
  const nail = getNail(state, options.localPlayer, fingerIndex);
  if (!nail?.alive) return "";
  const info = previewMove(state, options.localPlayer, fingerIndex);
  if (!info?.to) return "";
  const from = boardPoint(currentTip(nail), options.viewPlayer);
  const to = boardPoint(info.to, options.viewPlayer);
  const selected = fingerIndex === options.selectedFinger;
  const arrow = arrowTriangle(from, to);
  let endpoint = `<polygon class="direction-arrowhead" points="${arrow}"/>`;
  if (["collision", "own-block", "edge"].includes(info.kind)) endpoint += `<circle class="preview-stop" cx="${to.x}" cy="${to.y}" r="18"/>`;
  if (info.kind === "capture") endpoint += `<circle class="preview-capture" cx="${to.x}" cy="${to.y}" r="25"/>`;
  if (info.kind === "hook-cut") endpoint += `<circle class="hook-cut-target" cx="${to.x}" cy="${to.y}" r="38"/><path class="hook-cut-slash" d="M ${to.x - 24} ${to.y + 24} L ${to.x + 24} ${to.y - 24}"/><text class="hook-cut-label" x="${to.x}" y="${to.y - 46}">鉤爪</text>`;
  return `<g class="move-preview kind-${info.kind}${selected ? " is-selected" : " is-passive"}" data-preview-finger="${fingerIndex}"><line class="direction-ghost" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>${endpoint}</g>`;
}

function previewsMarkup(state, options) {
  if (!options.canEdit) return "";
  return `<g class="move-previews">${[0,1,2,3,4].map((fingerIndex) => previewForFinger(state, options, fingerIndex)).join("")}</g>`;
}

export function renderBoard(svg, state, options = {}) {
  if (!svg || !state) return;
  const opts = { viewPlayer: options.viewPlayer ?? 0, localPlayer: options.localPlayer ?? 0, selectedFinger: clamp(options.selectedFinger ?? 0, 0, 4), targeting: options.targeting || null, canEdit: Boolean(options.canEdit) };
  const grid = [];
  for (let y = 0; y < BOARD.rows; y += 1) for (let x = 0; x < BOARD.cols; x += 1) grid.push(`<rect class="grid-cell${(x + y) % 2 ? " alt" : ""}" x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}"/>`);
  const fingers = [];
  for (let player = 0; player < 2; player += 1) for (let finger = 0; finger < 5; finger += 1) fingers.push(fingerMarkup(state, player, finger, opts));
  const nails = state.nails.map((nail) => nailMarkup(nail, opts));
  const selectedPreview = opts.canEdit ? previewMove(state, opts.localPlayer, opts.selectedFinger) : null;
  svg.dataset.movePreview = selectedPreview?.kind || "";
  svg.dataset.movePreviewText = selectedPreview?.label || "";
  svg.innerHTML = `<title>爪将棋の盤面</title><desc>形の違う5本の指と、全ての自分の爪が次に伸びる方向を表示します。</desc>${grid.join("")}<g class="fingers">${fingers.join("")}</g><g class="nails">${nails.join("")}</g>${previewsMarkup(state, opts)}`;
}

export function fingerStateText(state, player, fingerIndex) {
  const nail = getNail(state, player, fingerIndex);
  if (!nail?.alive) return "退場";
  const tip = tipMaterial(nail), labels = [];
  const hookIndex = nail.materials.findIndex((material) => material?.kind === "hook");
  if (hookIndex >= 0) {
    if (hookIndex === nail.materials.length - 1) {
      const next = previewMove(state, player, fingerIndex);
      labels.push(next.kind === "hook-cut" ? "鉤爪・切断可" : "鉤爪・先端");
    } else {
      labels.push("鉤爪・仕込み中");
    }
  } else if (tip.kind === "sculpt") labels.push("スカルプ");
  else if (tip.sharpened) labels.push("研ぎ済み");
  if (tip.gel) labels.push("ジェル");
  if (nail.hiddenThisRound) labels.push("隠し中");
  if (!labels.length) labels.push("ふつうの爪");
  return labels.join("・");
}
export function directionForView(nail, viewPlayer) { return worldDirectionToView(nail, viewPlayer); }
export function engineDirectionFromView(viewDirection, viewPlayer) { return viewPlayer === 1 ? -viewDirection : viewDirection; }
export const SVG_NS = NS;
