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
  const motion = escapeXml(clean(body?.motion || body?.motionIdea || "", 42));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#00150c" flood-opacity="0.55"/></filter>
  </defs>
  <g filter="url(#shadow)">
    <path d="M42 150 C78 58 176 58 214 150 C190 218 68 218 42 150 Z" fill="#182f25" stroke="#e8ff59" stroke-width="8" opacity="0.96"/>
    <path d="M71 149 C111 120 145 120 185 149" fill="none" stroke="#76f0a1" stroke-width="10" stroke-linecap="round" opacity="0.72"/>
    <text x="75" y="133" text-anchor="middle" dominant-baseline="central" font-size="74" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${a}</text>
    <text x="128" y="107" text-anchor="middle" dominant-baseline="central" font-size="82" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${b}</text>
    <text x="181" y="133" text-anchor="middle" dominant-baseline="central" font-size="74" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${c}</text>
    <circle cx="128" cy="187" r="20" fill="#e8ff59" opacity="0.95"/>
    <path d="M116 187 L140 187 M128 175 L128 199" stroke="#06150e" stroke-width="6" stroke-linecap="round" opacity="0.65"/>
  </g>
  ${motion ? `<text x="128" y="238" text-anchor="middle" font-size="18" font-weight="800" fill="#ffffff" font-family="system-ui, sans-serif">${motion}</text>` : ""}
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
