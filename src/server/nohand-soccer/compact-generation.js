import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { appendNoHandSoccerGimmickLog } from "./sheet-log.js";

function text(value, fallback = "", max = 180) {
  return String(value || fallback || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function fallbackMotion(emojis) { return `${emojis.join("")}に触れたボールが、3つの絵文字を順番に渡りながら落下の勢いを変える。`; }
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
function points(value) {
  return (Array.isArray(value) ? value : []).filter(Array.isArray).slice(0, 8).map((p) => pair(p));
}
function defined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length;
    if (typeof v === "object") return Object.keys(v).length;
    return true;
  }));
}
function maybeNumber(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : undefined;
}
function actorIndex(value, fallback = undefined) {
  const n = Number(value);
  return Number.isInteger(n) ? Math.max(0, Math.min(2, n)) : fallback;
}
function ball(raw = {}) {
  return defined({
    velocity: Array.isArray(raw.velocity) ? pair(raw.velocity) : undefined,
    force: Array.isArray(raw.force) ? pair(raw.force) : undefined,
    path: points(raw.path),
    hold: maybeNumber(raw.hold, 0, 0.8),
    carry: maybeNumber(raw.carry, 0, 1),
    spin: maybeNumber(raw.spin, -1, 1),
    bounce: maybeNumber(raw.bounce, 0, 1),
  });
}
function device(raw = {}) {
  const swing = raw.swing && typeof raw.swing === "object" ? defined({
    pivot: Array.isArray(raw.swing.pivot) ? pair(raw.swing.pivot) : undefined,
    angle: maybeNumber(raw.swing.angle, -1, 1),
    cycles: maybeNumber(raw.swing.cycles, 0, 3),
  }) : {};
  return defined({
    move: Array.isArray(raw.move) ? pair(raw.move) : undefined,
    rotate: maybeNumber(raw.rotate, -1, 1),
    swing,
  });
}
function effects(raw = {}) {
  return defined({
    split: maybeNumber(raw.split, 1, 4),
    spread: maybeNumber(raw.spread, 0, 1),
    warp: Array.isArray(raw.warp) ? pair(raw.warp) : undefined,
    gravity: Array.isArray(raw.gravity) ? pair(raw.gravity, [0, -1]) : undefined,
    merge: ["none", "faster", "farther", "average", "original"].includes(raw.merge) ? raw.merge : undefined,
  });
}
function branch(raw = {}) {
  return defined({
    actor: actorIndex(raw.actor),
    ball: ball(raw.ball || raw),
  });
}
function beat(raw = {}, index = 0) {
  const out = defined({
    actor: actorIndex(raw.actor, index % 3),
    duration: clamp(raw.duration ?? raw.t, index ? 0.32 : 0.18, 0.06, 1.4),
    ball: ball(raw.ball || raw),
    device: device(raw.device || raw.rig),
    effects: effects(raw.effects || raw.fx),
    branches: (Array.isArray(raw.branches) ? raw.branches : []).slice(0, 4).map(branch).filter((b) => Object.keys(b).length),
  });
  return out.ball || out.device || out.effects || out.branches ? out : null;
}
function part(raw = {}, index = 0, emojis = []) {
  return defined({
    actor: actorIndex(raw.actor, index),
    emoji: text(raw.emoji, emojis[index] || "", 16),
    role: text(raw.role || raw.action, "", 36),
  });
}
function contact(raw = {}) {
  const start = ["any", "nearestActor"].includes(raw.start) ? raw.start : "any";
  const sequence = ["fixed", "fromTouched"].includes(raw.sequence) ? raw.sequence : "fixed";
  return { start, sequence };
}
function fallbackBeats() {
  return [
    { actor: 0, duration: 0.16, ball: { velocity: [0.1, -0.35], spin: 0.12, bounce: 0.25 } },
    { actor: 1, duration: 0.34, ball: { path: [[0, 0], [0.2, -0.24], [0.42, -0.44]], carry: 0.45 } },
    { actor: 2, duration: 0.18, ball: { velocity: [0.32, -0.55], spin: 0.16 } },
  ];
}
function normalize(raw, emojis) {
  const fallback = fallbackMotion(emojis);
  const motion = isGenericMotion(raw?.motion) ? fallback : text(raw?.motion, fallback);
  const beats = (Array.isArray(raw?.beats) ? raw.beats : []).slice(0, 5).map(beat).filter(Boolean);
  const finalBeats = beats.length >= 2 ? beats : fallbackBeats();
  const motors = legacyMotors(finalBeats);
  const parts = (Array.isArray(raw?.parts) ? raw.parts : emojis.map((emoji, actor) => ({ actor, emoji }))).slice(0, 3).map((p, i) => part(p, i, emojis));
  return {
    visualLabel: emojis.join(""),
    motion,
    motionIdea: motion,
    contact: contact(raw?.contact || {}),
    parts,
    beats: finalBeats,
    motors,
    body: { shape: "point", solid: false, size: 0.7, motion: "none", motionPower: 0.5 },
    mainMotorKinds: [...new Set(motors.map((m) => m.kind))].slice(0, 3),
    shortEffect: motion,
    conceptKey: [emojis.join(""), motion, JSON.stringify(parts), JSON.stringify(finalBeats)].join("|"),
  };
}
function legacyMotors(beats) {
  const has = (fn) => beats.some(fn);
  const motors = [];
  if (has((b) => b.ball?.hold || b.ball?.carry || b.device)) motors.push(motor("timerRelease", "angle", 0.46, 0.38, 0.28, "hold"));
  if (has((b) => Number(b.effects?.split) > 1)) motors.push(motor("split", "angle", 0.58, 0.42, 0.5, "split"));
  if (has((b) => Array.isArray(b.effects?.warp))) motors.push(motor("portal", "angle", 0.52, 0.36, 0.18, "warp"));
  if (has((b) => Array.isArray(b.effects?.gravity))) motors.push(motor("gravityShift", "angle", 0.52, 0.56, 0.9, "gravity"));
  if (has((b) => Array.isArray(b.ball?.path) && b.ball.path.length > 1)) motors.push(motor("rail", "angle", 0.5, 0.46, 0.7, "path"));
  if (has((b) => Number(b.ball?.bounce) > 0.18)) motors.push(motor("bumper", "radialOut", 0.5, 0.34, 0.18, "bounce"));
  motors.push(motor("launcher", "angle", 0.52, 0.34, 0.2, "release"));
  return motors.slice(0, 4);
}
function motor(kind, direction, power, range, duration, mode) {
  return { kind, trigger: ["rail", "gravityShift"].includes(kind) ? "inside" : "contact", direction, power, range, duration, angle: 0, count: 2, spreadAngle: 34, mode };
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
  return `${emojis.join(" ")}\n\nこんなピタゴラ装置（3つ合わせて1つのギミック）があるとしたら、この装置に触れた落下中のボールはどんな挙動をすると思いますか？\nまずは絵文字から自然に連想できる動きを考えてください。必要であれば、分裂・ワープ・重力反転等を取り入れても構わないが、それらは装置をより面白くできる場合に限る。\n\n次のJSONだけを返してください。\n\n{"motion":"絵文字3つから連想した具体的な動き","contact":{"start":"any","sequence":"fixed"},"parts":[{"actor":0,"role":"左の絵文字がすること"},{"actor":1,"role":"中央の絵文字がすること"},{"actor":2,"role":"右の絵文字がすること"}],"beats":[{"actor":0,"duration":0.2,"ball":{"velocity":[0,-0.5],"force":[0.2,-0.3],"path":[[0,0],[0.3,-0.4]],"hold":0.1,"carry":0.5,"spin":0.1,"bounce":0.3},"device":{"move":[0,-0.2],"rotate":0.2,"swing":{"pivot":[0,-0.6],"angle":0.4,"cycles":0.5}},"effects":{"split":2,"spread":0.4,"warp":[0.4,-0.6],"gravity":[-1,0],"merge":"faster"},"branches":[{"actor":1,"ball":{"path":[[-0.2,0],[-0.6,-0.5]],"velocity":[-0.3,-0.4],"bounce":0.5}}]}]}\n\nmotionは「要約」などの説明語ではなく、絵文字から連想したボールの具体的な動きにする。\nactorは左から0,1,2。各beatはどの絵文字がボールに作用するかをactorで示す。\ncontact.startはanyかnearestActor。sequenceはfixedかfromTouched。迷う場合はany/fixed。\npartsには各絵文字の役割を短く書く。\n各beatはduration秒の間に起きる動きを表す。\nballはボールへの作用、deviceは装置全体の動き、effectsは分裂・ワープ・重力などの特殊効果を表す。\n使わない項目は省略する。beatsは3〜5個。\npath / warp / pivot は、そのactorの絵文字中心を[0,0]とした-1〜1の相対座標。\nvelocity / force / gravity / move は、-1〜1の方向と強さ。\nJSONにない項目は追加しない。`;
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
      const text = await genWithFallback(prompt(emojis), { generationConfig: { responseMimeType: "application/json", temperature: 0.92 } });
      const raw = JSON.parse(extractFirstJsonObject(text));
      const gimmick = normalize(raw, emojis);
      await logGimmick(emojis, gimmick, "gemini-actor-beats");
      return res.json(gimmick);
    } catch (error) {
      console.warn("[noHand-soccer] beat fallback", error);
      const gimmick = { ...normalize({}, emojis), source: "fallback" };
      await logGimmick(emojis, gimmick, "fallback-actor-beats");
      return res.json(gimmick);
    }
  });
}
