function clean(value, max = 80) {
  let out = "";
  for (const ch of String(value || "")) {
    const code = ch.codePointAt(0);
    if (code >= 0xd800 && code <= 0xdfff) continue;
    out += ch;
  }
  return Array.from(out.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim()).slice(0, max).join("");
}
function escapeXml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function graphemes(value) {
  const text = clean(value, 48);
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (x) => x.segment).filter((x) => x.trim());
  }
  return Array.from(text).filter((x) => x.trim());
}
function selectedEmojis(body) {
  const source = body?.emojis || body?.visualLabel || body?.name || "❓❓❓";
  return graphemes(source).filter((x) => !/\s/.test(x)).slice(0, 3);
}
function dataSvg(svg) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
function clamp(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function actorLayout(body, emojis) {
  const fallback = [[-0.62, 0.22], [0, -0.22], [0.62, 0.22]];
  const rows = Array.isArray(body?.layout) ? body.layout : [];
  return emojis.map((emoji, actor) => {
    const row = rows.find((x) => Number(x?.actor) === actor) || {};
    const pos = Array.isArray(row.pos) ? row.pos : fallback[actor];
    return {
      actor,
      emoji,
      x: 128 + clamp(pos[0], fallback[actor][0], -1, 1) * 92,
      y: 128 + clamp(pos[1], fallback[actor][1], -1, 1) * 92,
    };
  });
}
function triggerActor(body) {
  const trigger = body?.trigger || {};
  if (Number.isInteger(Number(trigger.actor))) return Math.max(0, Math.min(2, Number(trigger.actor)));
  if (Number.isInteger(Number(trigger.unit)) && Array.isArray(body?.units)) {
    const unit = body.units.find((x) => Number(x?.unit) === Number(trigger.unit));
    const actor = Number(unit?.actors?.[0]);
    if (Number.isInteger(actor)) return Math.max(0, Math.min(2, actor));
  }
  return 0;
}
function emojiSvg(body) {
  const emojis = selectedEmojis(body);
  while (emojis.length < 3) emojis.push("❓");
  const nodes = actorLayout(body, emojis);
  const start = triggerActor(body);
  const lines = nodes.slice(0, -1).map((node, i) => {
    const next = nodes[i + 1];
    return `<line x1="${node.x.toFixed(1)}" y1="${node.y.toFixed(1)}" x2="${next.x.toFixed(1)}" y2="${next.y.toFixed(1)}" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.45"/>`;
  }).join("\n    ");
  const actors = nodes.map((node, i) => {
    const r = i === 1 ? 42 : 38;
    const stroke = i === 1 ? "#76f0a1" : "#e8ff59";
    const mark = i === start ? `<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${r + 12}" fill="none" stroke="#e8ff59" stroke-width="4" stroke-dasharray="8 8" opacity="0.82"/>` : "";
    return `${mark}<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${r}" fill="#101820" stroke="${stroke}" stroke-width="5" opacity="0.94"/><text x="${node.x.toFixed(1)}" y="${node.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${i === 1 ? 60 : 54}" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${escapeXml(node.emoji)}</text>`;
  }).join("\n    ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#000000" flood-opacity="0.45"/></filter></defs>
  <g filter="url(#shadow)">
    ${lines}
    ${actors}
  </g>
</svg>`;
}
export function mountFloodNoHandSoccerVisualRoutes(app) {
  app.post("/api/nohand-soccer/gimmick-visual", async (req, res) => {
    const visualLabel = clean(req.body?.visualLabel || req.body?.emojis || req.body?.name || "❓❓❓", 48);
    return res.json({
      visualLabel,
      conceptKey: clean(req.body?.conceptKey || visualLabel, 120),
      imageUrl: dataSvg(emojiSvg(req.body || {})),
      originalImageUrl: "",
      cached: true,
      status: "emoji-svg",
    });
  });
}
