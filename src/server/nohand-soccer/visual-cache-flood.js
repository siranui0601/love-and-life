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
    <path d="M60 152 C86 100 170 100 196 152" fill="none" stroke="#e8ff59" stroke-width="8" stroke-linecap="round" opacity="0.86"/>
    <line x1="82" y1="146" x2="128" y2="108" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.58"/>
    <line x1="174" y1="146" x2="128" y2="108" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.58"/>
    <circle cx="82" cy="150" r="48" fill="#101820" stroke="#e8ff59" stroke-width="5" opacity="0.92"/>
    <circle cx="128" cy="108" r="52" fill="#101820" stroke="#76f0a1" stroke-width="5" opacity="0.94"/>
    <circle cx="174" cy="150" r="48" fill="#101820" stroke="#e8ff59" stroke-width="5" opacity="0.92"/>
    <text x="82" y="150" text-anchor="middle" dominant-baseline="central" font-size="62" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${a}</text>
    <text x="128" y="108" text-anchor="middle" dominant-baseline="central" font-size="68" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${b}</text>
    <text x="174" y="150" text-anchor="middle" dominant-baseline="central" font-size="62" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${c}</text>
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
