import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { appendNoHandSoccerGimmickLog } from "./sheet-log.js";

const MODES = new Set(["ride", "guide", "hit", "bounce", "hold", "release", "split", "warp", "gravity", "spin"]);

function text(value, fallback = "", max = 180) {
  return String(value || fallback || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function fallbackMotion(emojis) { return `${emojis.join("")}が順番にボールを受け渡し、落下の勢いを別方向へ変える。`; }
function isGenericMotion(value) {
  const s = text(value, "", 240);
  return !s || /要約|説明|具体的|接触後のボールの動き/.test(s) || s.length < 8;
}
function clamp(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function pair(value, fallback = [0, 0]) {
  const src = Array.isArray(value) ? value : fallback;
  return [clamp(src[0], fallback[0] ?? 0, -1, 1), clamp(src[1], fallback[1] ?? 0, -1, 1)];
}
function actorIndex(value, fallback = undefined) {
  const n = Number(value);
  return Number.isInteger(n) ? Math.max(0, Math.min(2, n)) : fallback;
}
function unitIndex(value, fallback = undefined) {
  const n = Number(value);
  return Number.isInteger(n) ? Math.max(0, Math.min(2, n)) : fallback;
}
function defined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length;
    if (typeof v === "object") return Object.keys(v).length;
    return true;
  }));
}
function layout(raw, emojis) {
  const fallback = [[-0.62, 0.22], [0, -0.22], [0.62, 0.22]];
  const rows = Array.isArray(raw) ? raw : [];
  const byActor = new Map(rows.map((row, index) => [actorIndex(row?.actor, index), row]));
  return emojis.map((emoji, actor) => {
    const row = byActor.get(actor) || {};
    return { actor, emoji, pos: pair(row.pos, fallback[actor]) };
  });
}
function units(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  const used = new Set();
  const out = [];
  for (const row of rows.slice(0, 3)) {
    const actors = (Array.isArray(row?.actors) ? row.actors : []).map((x) => actorIndex(x)).filter((x) => Number.isInteger(x));
    const unique = [...new Set(actors)].filter((x) => !used.has(x));
    if (!unique.length || unique.length > 2) continue;
    if (unique.length === 2 && Math.abs(unique[0] - unique[1]) !== 1) continue;
    unique.forEach((x) => used.add(x));
    out.push({ unit: out.length, actors: unique });
  }
  for (let actor = 0; actor < 3; actor += 1) {
    if (!used.has(actor)) out.push({ unit: out.length, actors: [actor] });
  }
  return out.slice(0, 3);
}
function trigger(raw = {}) {
  if (Number.isInteger(Number(raw.unit))) return { unit: unitIndex(raw.unit, 0), radius: clamp(raw.radius, 0.35, 0.18, 0.65) };
  return { actor: actorIndex(raw.actor, 0), radius: clamp(raw.radius, 0.35, 0.18, 0.65) };
}
function beat(raw = {}, index = 0) {
  const mode = MODES.has(raw.mode) ? raw.mode : (index === 0 ? "guide" : index === 1 ? "hit" : "release");
  const out = defined({
    actor: actorIndex(raw.actor),
    unit: unitIndex(raw.unit),
    mode,
    to: unitIndex(raw.to),
    duration: clamp(raw.duration, mode === "hit" || mode === "split" ? 0.24 : 0.38, 0.08, 1.2),
    power: clamp(raw.power, 0.55, 0.15, 1),
    count: mode === "split" ? Math.round(clamp(raw.count, 2, 2, 4)) : undefined,
    spread: ["split", "release"].includes(mode) ? clamp(raw.spread, 0.55, 0.1, 1) : undefined,
    direction: Array.isArray(raw.direction) ? pair(raw.direction, [0, -1]) : undefined,
  });
  return out;
}
function fallbackBeats() {
  return [
    { unit: 0, mode: "guide", to: 1, power: 0.45, duration: 0.36 },
    { unit: 1, mode: "hit", to: 2, power: 0.72, duration: 0.24 },
    { unit: 2, mode: "release", power: 0.55, spread: 0.35, duration: 0.22 },
  ];
}
function expandBeat(semantic, index, unitList) {
  const unit = unitIndex(semantic.unit, unitIndex(semantic.actor, index % unitList.length));
  const actor = actorIndex(semantic.actor, unitList[unit]?.actors?.[0] ?? unit % 3);
  const toUnit = unitIndex(semantic.to, Math.min(unit + 1, unitList.length - 1));
  const toActor = unitList[toUnit]?.actors?.[0] ?? ((actor + 1) % 3);
  const power = clamp(semantic.power, 0.55, 0.15, 1);
  const duration = clamp(semantic.duration, 0.32, 0.08, 1.2);
  const base = { ...semantic, unit, actor, to: toUnit, duration, power };
  if (semantic.mode === "ride" || semantic.mode === "guide") {
    return { ...base, ball: { path: [[0, 0], [0.75, -0.08]], carry: 0.35 + power * 0.35 } };
  }
  if (semantic.mode === "hit") {
    return { ...base, ball: { velocity: [0.55, -0.42], bounce: 0.18 + power * 0.42, spin: 0.08 } };
  }
  if (semantic.mode === "bounce") {
    return { ...base, ball: { velocity: [-0.35, -0.48], bounce: 0.25 + power * 0.45 } };
  }
  if (semantic.mode === "hold") {
    return { ...base, ball: { hold: 0.18 + power * 0.38 } };
  }
  if (semantic.mode === "split") {
    const count = Math.round(clamp(semantic.count, 2, 2, 4));
    const spread = clamp(semantic.spread, 0.55, 0.1, 1);
    return { ...base, effects: { split: count, spread }, branches: [{ ball: { velocity: [-spread, -0.38] } }, { ball: { velocity: [spread, -0.38] } }] };
  }
  if (semantic.mode === "warp") {
    return { ...base, effects: { warp: [0.75, -0.35] }, ball: { velocity: [0.28, -0.38] } };
  }
  if (semantic.mode === "gravity") {
    return { ...base, effects: { gravity: Array.isArray(semantic.direction) ? semantic.direction : [0, -1] } };
  }
  if (semantic.mode === "spin") {
    return { ...base, ball: { spin: power, velocity: [0.22, -0.28] } };
  }
  return { ...base, ball: { velocity: [0.35, -0.5], bounce: 0.2 } };
}
function normalize(raw, emojis) {
  const motion = isGenericMotion(raw?.motion) ? fallbackMotion(emojis) : text(raw?.motion, fallbackMotion(emojis));
  const finalLayout = layout(raw?.layout, emojis);
  const finalUnits = units(raw?.units);
  const semanticBeats = (Array.isArray(raw?.beats) ? raw.beats : []).slice(0, 5).map(beat).filter(Boolean);
  const compactBeats = (semanticBeats.length >= 2 ? semanticBeats : fallbackBeats()).map((b, index) => expandBeat(b, index, finalUnits));
  return {
    visualLabel: emojis.join(""),
    motion,
    motionIdea: motion,
    layout: finalLayout,
    units: finalUnits,
    trigger: trigger(raw?.trigger || {}),
    beats: compactBeats,
    body: { shape: "point", solid: false, size: 0.7, motion: "none", motionPower: 0.5 },
    shortEffect: motion,
    conceptKey: [emojis.join(""), motion, JSON.stringify(finalLayout), JSON.stringify(finalUnits), JSON.stringify(compactBeats)].join("|"),
  };
}
function extractFirstJsonObject(input) {
  const s = stripJsonFence(String(input || ""));
  const start = s.indexOf("{");
  if (start < 0) throw new SyntaxError("JSON object not found");
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  throw new SyntaxError("JSON object was not closed");
}
function prompt(emojis) {
  return `${emojis.join(" ")}\n\nこんなピタゴラ装置（3つ合わせて1つのギミック）があるとしたら、この装置に触れた落下中のボールはどんな挙動をすると思いますか？\nまずは絵文字から自然に連想できる動きを考えてください。必要であれば、分裂・ワープ・重力変更等を取り入れても構わないが、それらは装置をより面白くできる場合に限る。\n\n返答はJSONのみ。AIは数値の物理ベクトルではなく、装置の意味構造を出してください。\n\n形式:\n{"motion":"具体的な動き","layout":[{"actor":0,"pos":[-0.65,0.25]},{"actor":1,"pos":[0,-0.2]},{"actor":2,"pos":[0.65,0.25]}],"units":[{"unit":0,"actors":[0]},{"unit":1,"actors":[1]},{"unit":2,"actors":[2]}],"trigger":{"unit":0,"radius":0.35},"beats":[{"unit":0,"mode":"ride","to":1,"power":0.45,"duration":0.4},{"unit":1,"mode":"hit","to":2,"power":0.75,"duration":0.25},{"unit":2,"mode":"split","count":2,"spread":0.65,"power":0.55,"duration":0.25}]}\n\n重要:\n- motionは絵文字から自然に連想した具体的な動き。\n- layoutはギミック中心からの相対位置。3つの絵文字の並びを動作に合うように配置する。\n- unitsは複数絵文字を1つの部品として扱うためのまとまり。省略せず書く。\n- unitは最大3個。actorの重複は禁止。2個まとめる場合は隣り合うactorだけ: [0,1] または [1,2]。\n- triggerは開始地点。ユーザーが分かりやすいよう、最初に触れるunitかactorを指定する。\n- beatsは2〜5個。modeは ride / guide / hit / bounce / hold / release / split / warp / gravity / spin から選ぶ。\n- toは次に渡すunit番号。\n- power, spread, radius, duration は控えめ。\n- velocity / force / path / ball / effects / motors / body / role / description / label / id / name / size / hitbox は書かない。\n- JSONにない項目は追加しない。`;
}
async function logGimmick(emojis, gimmick, source) {
  try { await appendNoHandSoccerGimmickLog({ emojis, gimmick, source }); }
  catch (error) { console.warn("[noHand-soccer] compact log skipped", error); }
}
export function mountCompactNoHandSoccerRoutes(app) {
  app.post("/api/nohand-soccer/gimmick", async (req, res) => {
    const emojis = Array.isArray(req.body?.emojis) ? req.body.emojis.slice(0, 3).map(String) : [];
    if (emojis.length !== 3 || emojis.some((emoji) => !emoji.trim())) return res.status(400).json({ error: "emojis must contain exactly 3 items." });
    try {
      const output = await genWithFallback(prompt(emojis), { generationConfig: { responseMimeType: "application/json", temperature: 0.86 } });
      const raw = JSON.parse(extractFirstJsonObject(output));
      const gimmick = normalize(raw, emojis);
      await logGimmick(emojis, gimmick, "gemini-meaning-structure");
      return res.json(gimmick);
    } catch (error) {
      console.warn("[noHand-soccer] semantic fallback", error);
      const gimmick = { ...normalize({}, emojis), source: "fallback-meaning-structure" };
      await logGimmick(emojis, gimmick, "fallback-meaning-structure");
      return res.json(gimmick);
    }
  });
}
