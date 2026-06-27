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
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function dataSvg(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function emojiSvg(body) {
  const emojis = selectedEmojis(body);
  while (emojis.length < 3) emojis.push("❓");
  const [a, b, c] = emojis.map(escapeXml);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#000000" flood-opacity="0.45"/></filter>
  </defs>
  <g filter="url(#shadow)">
    <path d="M42 166 C74 82 182 82 214 166" fill="none" stroke="#e8ff59" stroke-width="7" stroke-linecap="round" opacity="0.84"/>
    <line x1="42" y1="166" x2="128" y2="82" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.48"/>
    <line x1="214" y1="166" x2="128" y2="82" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.48"/>
    <circle cx="42" cy="166" r="38" fill="#101820" stroke="#e8ff59" stroke-width="5" opacity="0.94"/>
    <circle cx="128" cy="82" r="42" fill="#101820" stroke="#76f0a1" stroke-width="5" opacity="0.96"/>
    <circle cx="214" cy="166" r="38" fill="#101820" stroke="#e8ff59" stroke-width="5" opacity="0.94"/>
    <circle cx="42" cy="166" r="50" fill="none" stroke="#e8ff59" stroke-width="4" stroke-dasharray="8 8" opacity="0.82"/>
    <text x="42" y="166" text-anchor="middle" dominant-baseline="central" font-size="54" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${a}</text>
    <text x="128" y="82" text-anchor="middle" dominant-baseline="central" font-size="60" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${b}</text>
    <text x="214" y="166" text-anchor="middle" dominant-baseline="central" font-size="54" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${c}</text>
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
