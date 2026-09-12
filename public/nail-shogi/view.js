import { BOARD, FINGER_NAMES, currentTip, getNail, previewMove, rootFor, segmentDefense, tipMaterial } from "./engine.js";

const CELL = 100;
const NS = "http://www.w3.org/2000/svg";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// 指の判別は番号ではなく輪郭で行う。爪床は必ずグリッド中心線に残す。
const FINGER_VISUALS = Object.freeze([
  { width: 92, depth: 102, nailW: 42, nailH: 42, bodyOffset: -17, shoulder: 34 },
  { width: 62, depth: 122, nailW: 31, nailH: 48, bodyOffset: -4, shoulder: 27 },
  { width: 66, depth: 142, nailW: 33, nailH: 51, bodyOffset: 0, shoulder: 28 },
  { width: 60, depth: 124, nailW: 30, nailH: 47, bodyOffset: 4, shoulder: 26 },
  { width: 50, depth: 94, nailW: 25, nailH: 39, bodyOffset: 10, shoulder: 22 },
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
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pointsAttr(points) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function worldDirectionToView(nail, viewPlayer) {
  return viewPlayer === 1 ? -nail.direction : nail.direction;
}

function segmentMid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function defenseLabel(value) {
  if (value >= 3) return "かなりかたい";
  if (value >= 2) return "かたい";
  return "ふつう";
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
  const bodyOffset = visual.bodyOffset * (onBottom ? 1 : -1);
  const bodyY = onBottom ? -visual.depth + 38 : -38;
  const nailY = onBottom ? -72 : 25;
  const klass = `finger-group${own ? " is-own" : ""}${own && canEdit && !captured ? " is-interactive" : ""}`;
  const data = own && canEdit && !captured ? ` data-finger="${fingerIndex}"` : "";

  if (captured) {
    const y = anchor.y + direction * 12;
    return `<g class="finger-group"><path class="missing-finger" d="M ${anchor.x - visual.width * .38} ${y} Q ${anchor.x} ${y + direction * 24} ${anchor.x + visual.width * .38} ${y}"/></g>`;
  }

  return `<g class="${klass}"${data} role="button" aria-label="${esc(FINGER_NAMES[fingerIndex])}を選ぶ" tabindex="${own && canEdit ? 0 : -1}" transform="translate(${anchor.x} ${anchor.y})">
    ${selected ? `<ellipse class="finger-select-ring" cx="0" cy="${onBottom ? -43 : 43}" rx="${visual.nailW * .9}" ry="${visual.nailH * .9}"/>` : ""}
    <rect class="finger-body p${player}" x="${-visual.width / 2 + bodyOffset}" y="${bodyY}" width="${visual.width}" height="${visual.depth}" rx="${visual.shoulder}"/>
    <path class="finger-crease p${player}" d="M ${-visual.width*.27 + bodyOffset} ${onBottom ? -18 : 18} Q ${bodyOffset} ${onBottom ? -9 : 9} ${visual.width*.27 + bodyOffset} ${onBottom ? -18 : 18}"/>
    <rect class="finger-nail-bed p${player}" x="${-visual.nailW / 2}" y="${nailY}" width="${visual.nailW}" height="${visual.nailH}" rx="${Math.round(visual.nailW * .44)}"/>
  </g>`;
}

function materialMarkup(nail, points) {
  const out = [];
  for (let i = 0; i < nail.path.length; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    if (!from || !to) continue;
    const mat = nail.materials[i] || {};
    if (mat.gel) out.push(`<line class="material-segment gel" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`);
    if (mat.kind === "sculpt") out.push(`<line class="material-segment sculpt" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`);
    if (mat.kind === "hook" && i !== nail.path.length - 1) {
      const m = segmentMid(from, to);
      const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
      out.push(`<g class="hook-seed" transform="translate(${m.x} ${m.y}) rotate(${angle})"><path d="M -12 -8 L 7 -8 C 16 -8 18 5 11 10 C 6 14 0 11 -2 7 L 4 3 C 6 6 9 6 10 3 C 11 0 8 -1 5 -1 L -12 -1 Z"/></g>`);
    }
  }
  return out.join("");
}

function hookTipMarkup(nail, points) {
  if (tipMaterial(nail).kind !== "hook" || points.length < 2) return "";
  const tip = points.at(-1);
  const prev = points.at(-2);
  const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x) * 180 / Math.PI;
  return `<g class="hook-tip" transform="translate(${tip.x} ${tip.y}) rotate(${angle})">
    <path class="hook-tip-body" d="M -30 -16 L 4 -16 C 25 -16 37 -4 34 13 C 31 31 14 42 -5 34 L 2 19 C 11 23 18 18 19 11 C 20 3 13 0 3 0 L -30 0 Z"/>
    <path class="hook-tip-ridge" d="M -22 -8 L 5 -8 C 19 -8 27 -1 26 10 C 25 18 18 25 10 27"/>
  </g>`;
}

function sharpenMarkup(nail, points) {
  const mat = tipMaterial(nail);
  if (!mat.sharpened || points.length < 2 || mat.kind === "hook") return "";
  const tip = points.at(-1);
  const prev = points.at(-2);
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
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
  return `<g class="nail-group${hidden ? " is-hidden" : ""}" data-nail="${nail.id}">
    ${selected ? `<polyline class="nail-selection" points="${attr}"/>` : ""}
    <polyline class="nail-outline" points="${attr}"/>
    <polyline class="nail-core p${nail.player}" points="${attr}"/>
    ${materialMarkup(nail, points)}
    <polyline class="nail-highlight" points="${attr}"/>
    ${hidden ? `<polyline class="hidden-veil" points="${attr}"/>` : ""}
    ${hookTipMarkup(nail, points)}
    ${sharpenMarkup(nail, points)}
    ${own && options.canEdit ? `<polyline class="nail-hit" data-finger="${nail.fingerIndex}" points="${attr}" aria-label="${esc(FINGER_NAMES[nail.fingerIndex])}の爪"/>` : ""}
    ${targetMarkup(nail, points, options)}
  </g>`;
}

function previewMarkup(state, options) {
  if (!options.canEdit) return "";
  const info = previewMove(state, options.localPlayer, options.selectedFinger);
  const nail = getNail(state, options.localPlayer, options.selectedFinger);
  if (!nail?.alive || !info?.to) return "";
  const tip = boardPoint(currentTip(nail), options.viewPlayer);
  const next = boardPoint(info.to, options.viewPlayer);
  let extra = "";
  if (info.kind === "hook-cut") {
    extra = `<g class="hook-cut-preview"><circle class="hook-cut-target" cx="${next.x}" cy="${next.y}" r="41"/><path class="hook-cut-slash" d="M ${next.x-25} ${next.y+25} L ${next.x+25} ${next.y-25}"/></g>`;
  } else if (["collision","own-block","capture"].includes(info.kind)) {
    extra = `<circle class="move-target-ring kind-${info.kind}" cx="${next.x}" cy="${next.y}" r="34"/>`;
  }
  return `<g class="move-preview kind-${info.kind}"><line class="direction-ghost" x1="${tip.x}" y1="${tip.y}" x2="${next.x}" y2="${next.y}"/>${extra}</g>`;
}

export function renderBoard(svg, state, options = {}) {
  if (!svg || !state) return;
  const opts = {
    viewPlayer: options.viewPlayer ?? 0,
    localPlayer: options.localPlayer ?? 0,
    selectedFinger: clamp(options.selectedFinger ?? 0, 0, 4),
    targeting: options.targeting || null,
    canEdit: Boolean(options.canEdit),
  };
  const grid = [];
  for (let y = 0; y < BOARD.rows; y += 1) {
    for (let x = 0; x < BOARD.cols; x += 1) {
      grid.push(`<rect class="grid-cell${(x + y) % 2 ? " alt" : ""}" x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}"/>`);
    }
  }
  const fingers = [];
  for (let player = 0; player < 2; player += 1) {
    for (let finger = 0; finger < 5; finger += 1) fingers.push(fingerMarkup(state, player, finger, opts));
  }
  const nails = state.nails.map((nail) => nailMarkup(nail, opts));
  const preview = opts.canEdit ? previewMove(state, opts.localPlayer, opts.selectedFinger) : null;
  svg.dataset.movePreview = preview?.kind || "";
  svg.dataset.movePreviewText = preview?.label || "";
  svg.innerHTML = `<title>爪将棋の盤面</title><desc>形の違う5本の指と、根元から連続して伸びる爪を表示します。</desc>${grid.join("")}<g class="fingers">${fingers.join("")}</g><g class="nails">${nails.join("")}</g>${previewMarkup(state, opts)}`;
}

export function fingerStateText(state, player, fingerIndex) {
  const nail = getNail(state, player, fingerIndex);
  if (!nail?.alive) return "退場";
  const tip = tipMaterial(nail);
  const labels = [];
  if (tip.kind === "hook") labels.push("鉤爪");
  else if (tip.kind === "sculpt") labels.push("スカルプ");
  else if (tip.sharpened) labels.push("研ぎ済み");
  if (tip.gel) labels.push("ジェル");
  if (nail.hiddenThisRound) labels.push("隠し中");
  if (!labels.length) labels.push("ふつうの爪");
  return labels.join("・");
}

export function directionForView(nail, viewPlayer) {
  return worldDirectionToView(nail, viewPlayer);
}

export function engineDirectionFromView(viewDirection, viewPlayer) {
  return viewPlayer === 1 ? -viewDirection : viewDirection;
}

export const SVG_NS = NS;