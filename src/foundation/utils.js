export function nowMs() { return Date.now(); }
export function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function safeJsonParse(s, fallback = null) {
  try {
    const t = String(s ?? "").trim();
    if (!t) return fallback;
    return JSON.parse(t);
  } catch {
    return fallback;
  }
}

export function clampText120(s) {
  const t = String(s ?? "");
  return t.length > 120 ? t.slice(0, 120) : t;
}

export function pad4(n) { return String(n).padStart(4, "0"); }

export function parseSlashList(cell) {
  const s = String(cell || "").trim();
  if (!s) return [];
  return s.split("/").map(x => x.trim()).filter(Boolean);
}
export function formatSlashList(arr) {
  return (arr || []).map(x => String(x).trim()).filter(Boolean).join("/");
}
export function addUnique(listArr, username) {
  const a = Array.isArray(listArr) ? listArr : [];
  if (a.includes(username)) return a;
  return [...a, username];
}
export function removeName(listArr, username) {
  return (listArr || []).filter(x => x !== username);
}
export function includesName(listArr, username) {
  return (listArr || []).includes(username);
}