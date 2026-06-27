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
function flowNodes(body, emojis) {
  const fallback = [
    { step: 0, actors: [0], pos: [-75, 20] },
    { step: 1, actors: [1], pos: [0, -35] },
    { step: 2, actors: [2], pos: [75, 20] },
  ];
  const flow = Array.isArray(body?.flow) && body.flow.length ? body.flow : fallback;
  const nodes = [];
  for (const step of flow.slice(0, 5)) {
    const actors = Array.isArray(step.actors) && step.actors.length ? step.actors : [Number(step.actor ?? step.step ?? 0)];
    const pos = Array.isArray(step.pos) ? step.pos : fallback[Math.min(nodes.length, 2)].pos;
    const offsets = actors.length === 2 ? [[-13, 0], [13, 0]] : [[0, 0]];
    actors.slice(0, 2).forEach((actorRaw, i) => {
      const actor = Math.max(0, Math.min(2, Number(actorRaw) || 0));
      nodes.push({
        actor,
        step: Number(step.step ?? nodes.length),
        emoji: emojis[actor] || "❓",
        x: 128 + (clamp(pos[0], 0, -100, 100) + offsets[i][0]) * 0.92,
        y: 128 + (clamp(pos[1], 0, -100, 100) + offsets[i][1]) * 0.92,
      });
    });
  }
  return nodes.sort((a, b) => a.step - b.step || a.actor - b.actor);
}
function startStep(body) {
  const n = Number(body?.trigger?.step);
  return Number.isInteger(n) ? Math.max(0, Math.min(4, n)) : 0;
}
function emojiSvg(body) {
  const emojis = selectedEmojis(body);
  while (emojis.length < 3) emojis.push("❓");
  const nodes = flowNodes(body, emojis);
  const start = startStep(body);
  const stepCenters = [];
  for (const node of nodes) {
    if (!stepCenters[node.step]) stepCenters[node.step] = { x: 0, y: 0, n: 0 };
    stepCenters[node.step].x += node.x; stepCenters[node.step].y += node.y; stepCenters[node.step].n += 1;
  }
  stepCenters.forEach((p) => { if (p?.n) { p.x /= p.n; p.y /= p.n; } });
  const lines = stepCenters.slice(0, -1).map((node, i) => {
    const next = stepCenters.slice(i + 1).find(Boolean);
    if (!node || !next) return "";
    return `<line x1="${node.x.toFixed(1)}" y1="${node.y.toFixed(1)}" x2="${next.x.toFixed(1)}" y2="${next.y.toFixed(1)}" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.45"/>`;
  }).join("\n    ");
  const actors = nodes.map((node) => {
    const r = node.step === start ? 42 : 37;
    const stroke = node.step === start ? "#e8ff59" : "#76f0a1";
    const mark = node.step === start ? `<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${r + 14}" fill="none" stroke="#e8ff59" stroke-width="4" stroke-dasharray="8 8" opacity="0.82"/>` : "";
    return `${mark}<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${r}" fill="#101820" stroke="${stroke}" stroke-width="5" opacity="0.94"/><text x="${node.x.toFixed(1)}" y="${node.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${node.step === start ? 60 : 54}" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${escapeXml(node.emoji)}</text>`;
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
