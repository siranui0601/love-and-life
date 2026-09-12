import { BOARD, FINGER_NAMES, currentTip, getNail, previewMove, rootFor, segmentDefense, tipMaterial } from "./engine.js";

const CELL = 100;
const NS = "http://www.w3.org/2000/svg";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const FINGER_VISUALS = Object.freeze([
  { width: 82, height: 74, radius: 30, angle: -13, nailW: 38, nailH: 36 },
  { width: 58, height: 96, radius: 25, angle: -3, nailW: 28, nailH: 40 },
  { width: 62, height: 116, radius: 27, angle: 0, nailW: 30, nailH: 43 },
  { width: 57, height: 99, radius: 25, angle: 3, nailW: 28, nailH: 39 },
  { width: 49, height: 78, radius: 22, angle: 10, nailW: 24, nailH: 33 },
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

function nextViewPoint(nail, viewPlayer) {
  const tip = currentTip(nail);
  const dy = nail.player === 0 ? -1 : 1;
  return boardPoint({ x: tip.x + nail.direction, y: tip.y + dy }, viewPlayer);
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
  const y = onBottom ? -visual.height + 5 : -5;
  const nailY = onBottom ? -visual.height + 12 : visual.height - visual.nailH - 12;
  const rotation = onBottom ? visual.angle : -visual.angle;
  const klass = `finger-group${own ? " is-own" : ""}${own && canEdit && !captured ? " is-interactive" : ""}`;
  const data = own && canEdit && !captured ? ` data-finger="${fingerIndex}"` : "";
  if (captured) {
    const arcY = onBottom ? -8 : 8;
    return `<g class="finger-group"><path class="missing-finger" d="M ${anchor.x - visual.width / 2} ${anchor.y + arcY} Q ${anchor.x} ${anchor.y + (onBottom ? -30 : 30)} ${anchor.x + visual.width / 2} ${anchor.y + arcY}"/></g>`;
  }
  return `<g class="${klass}"${data} role="button" aria-label="${esc(FINGER_NAMES[fingerIndex])}を選ぶ" tabindex="${own && canEdit ? 0 : -1}" transform="translate(${anchor.x} ${anchor.y}) rotate(${rotation})">
    ${selected ? `<rect class="finger-select-ring" x="${-visual.width / 2 - 7}" y="${y - 7}" width="${visual.width + 14}" height="${visual.height + 14}" rx="${visual.radius + 7}"/>` : ""}
    <rect class="finger-body p${player}" x="${-visual.width / 2}" y="${y}" width="${visual.width}" height="${visual.height}" rx="${visual.radius}"/>
    <rect class="finger-nail-bed p${player}" x="${-visual.nailW / 2}" y="${nailY}" width="${visual.nailW}" height="${visual.nailH}" rx="${Math.round(visual.nailW * .42)}"/>
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
      out.push(`<circle class="hook-seed" cx="${m.x}" cy="${m.y}" r="9"/><path class="hook-seed-mark" d="M ${m.x-3} ${m.y-5} q 12 3 3 13"/>`);
    }
    if (i > 0) {
      const m = from;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const px = -dy / length * 14;
      const py = dx / length * 14;
      out.push(`<line class="material-seam" x1="${m.x - px}" y1="${m.y - py}" x2="${m.x + px}" y2="${m.y + py}"/>`);
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
    <path d="M -18 0 L 4 0 Q 28 0 22 20 Q 18 34 5 25"/>
    <circle cx="-18" cy="0" r="5"/>
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
  const p1 = { x: tip.x + ux * 21, y: tip.y + uy * 21 };
  const p2 = { x: tip.x - ux * 5 + px * 12, y: tip.y - uy * 5 + py * 12 };
  const p3 = { x: tip.x - ux * 5 - px * 12, y: tip.y - uy * 5 - py * 12 };
  return `<polygon class="sharpen-tip" points="${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}"/>`;
}

function targetMarkup(nail, points, options) {
  if (options.targeting !== "gel" || nail.player !== options.localPlayer || nail.fingerIndex !== options.selectedFinger || !options.canEdit) return "";
  return nail.path.map((_, i) => {
    const from = points[i], to = points[i + 1];
    if (!from || !to) return "";
    const m = segmentMid(from, to);
    return `<circle class="segment-target" data-segment="${i}" data-finger="${nail.fingerIndex}" cx="${m.x}" cy="${m.y}" r="25"><title>${esc(FINGER_NAMES[nail.fingerIndex])}・${i === nail.path.length - 1 ? "先端" : `根元から${i + 1}節目`}・${defenseLabel(segmentDefense(nail, i))}</title></circle>`;
  }).join("");
}

function nailMarkup(nail, options) {
  if (!nail.alive || !nail.path.length) return "";
  const points = [rootPoint(nail.player, nail.fingerIndex, options.viewPlayer), ...nail.path.map((cell) => boardPoint(cell, options.viewPlayer))];
  const attr = pointsAttr(points);
  const own = nail.player === options.localPlayer;
  const selected = own && nail.fingerIndex === options.selectedFinger;
  const hidden = nail.hiddenThisRound ? " is-hidden" : "";
  return `<g class="nail-group" data-nail="${nail.id}">
    <polyline class="nail-accent p${nail.player}" points="${attr}"/>
    ${selected ? `<polyline class="nail-selection" points="${attr}"/>` : ""}
    <polyline class="nail-outline" points="${attr}"/>
    <polyline class="nail-core p${nail.player}${hidden}" points="${attr}"/>
    ${materialMarkup(nail, points)}
    <polyline class="nail-highlight" points="${attr}"/>
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
  const classes = `move-preview kind-${info.kind}`;
  let extra = "";
  if (info.kind === "hook-cut") {
    extra = `<circle class="hook-cut-target" cx="${next.x}" cy="${next.y}" r="38"/>
      <path class="hook-cut-slash" d="M ${next.x-24} ${next.y+24} L ${next.x+24} ${next.y-24}"/>
      <text class="hook-cut-label" x="${next.x}" y="${next.y-47}" text-anchor="middle">横から切断</text>`;
  } else if (["collision","own-block","capture"].includes(info.kind)) {
    extra = `<circle class="move-target-ring kind-${info.kind}" cx="${next.x}" cy="${next.y}" r="33"/>`;
  }
  return `<g class="${classes}"><line class="direction-ghost" x1="${tip.x}" y1="${tip.y}" x2="${next.x}" y2="${next.y}"/>${extra}</g>`;
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
  svg.innerHTML = `<title>爪将棋の盤面</title><desc>10列8段。数字ではなく形の違う5本の指と、連続した爪で表示します。</desc>${grid.join("")}<g class="fingers">${fingers.join("")}</g><g class="nails">${nails.join("")}</g>${previewMarkup(state, opts)}`;
}

export function fingerStateText(state, player, fingerIndex) {
  const nail = getNail(state, player, fingerIndex);
  if (!nail?.alive) return "詰められた指";
  const tip = tipMaterial(nail);
  const labels = [];
  if (tip.kind === "hook") labels.push("鉤爪が先端");
  else if (tip.kind === "sculpt") labels.push("スカルプ先端");
  else if (tip.sharpened) labels.push("先端を研ぎ済み");
  if (tip.gel) labels.push("先端にジェル");
  if (nail.hiddenThisRound) labels.push("敵爪をすり抜け中");
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
