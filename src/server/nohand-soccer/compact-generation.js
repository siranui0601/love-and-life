import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { appendNoHandSoccerGimmickLog } from "./sheet-log.js";

function text(value, fallback = "", max = 160) {
  return String(value || fallback || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function fallbackMotion(emojis) { return `${emojis.join("")}に触れたボールが、落下の勢いを別方向へ変えて進む。`; }
function isGenericMotion(value) {
  const s = text(value, "", 220);
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
function beat(raw = {}, index = 0) {
  const out = defined({
    duration: clamp(raw.duration ?? raw.t, index ? 0.32 : 0.18, 0.06, 1.4),
    ball: ball(raw.ball || raw),
    device: device(raw.device || raw.rig),
    effects: effects(raw.effects || raw.fx),
    branches: (Array.isArray(raw.branches) ? raw.branches : []).slice(0, 4).map((b) => defined({ ball: ball(b.ball || b) })).filter((b) => Object.keys(b).length),
  });
  return out.ball || out.device || out.effects || out.branches ? out : null;
}
function fallbackBeats() {
  return [
    { duration: 0.16, ball: { velocity: [0.1, -0.35], spin: 0.12, bounce: 0.25 } },
    { duration: 0.34, ball: { path: [[0, 0], [0.2, -0.24], [0.42, -0.44]], carry: 0.45 } },
    { duration: 0.18, ball: { velocity: [0.32, -0.55], spin: 0.16 } },
  ];
}
function normalize(raw, emojis) {
  const fallback = fallbackMotion(emojis);
  const motion = isGenericMotion(raw?.motion) ? fallback : text(raw?.motion, fallback);
  const beats = (Array.isArray(raw?.beats) ? raw.beats : []).slice(0, 5).map(beat).filter(Boolean);
  const finalBeats = beats.length >= 2 ? beats : fallbackBeats();
  const motors = legacyMotors(finalBeats);
  return {
    visualLabel: emojis.join(""),
    motion,
    motionIdea: motion,
    beats: finalBeats,
    motors,
    body: legacyBody(finalBeats),
    mainMotorKinds: [...new Set(motors.map((m) => m.kind))].slice(0, 3),
    shortEffect: motion,
    conceptKey: [emojis.join(""), motion, JSON.stringify(finalBeats)].join("|"),
  };
}
function legacyMotors(beats) {
  const has = (fn) => beats.some(fn);
  const motors = [];
  // UI表示と旧fallback用の最低限の橋渡し。beatsが存在する場合、フロントではbeatsが優先実行される。
  if (has((b) => b.ball?.hold || b.ball?.carry || b.device)) motors.push(motor("timerRelease", "angle", 0.46, 0.38, 0.28, "hold"));
  if (has((b) => Number(b.effects?.split) > 1)) motors.push(motor("split", "angle", 0.58, 0.42, 0.5, "split"));
  if (has((b) => Array.isArray(b.effects?.warp))) motors.push(motor("portal", "angle", 0.52, 0.36, 0.18, "warp"));
  if (has((b) => Array.isArray(b.effects?.gravity))) motors.push(motor("gravityShift", "angle", 0.52, 0.56, 0.9, "gravity"));
  if (has((b) => Array.isArray(b.ball?.path) && b.ball.path.length > 1)) motors.push(motor("rail", "angle", 0.5, 0.46, 0.7, "path"));
  if (has((b) => Number(b.ball?.bounce) > 0.18)) motors.push(motor("bumper", "radialOut", 0.5, 0.34, 0.18, "bounce"));
  motors.push(motor("launcher", "angle", 0.52, 0.34, 0.2, "release"));
  return motors.slice(0, 4);
}
function legacyBody(beats) {
  const moving = beats.some((b) => b.device?.swing || b.device?.rotate || b.device?.move);
  const path = beats.some((b) => Array.isArray(b.ball?.path) && b.ball.path.length > 1);
  return { shape: path ? "rail" : moving ? "carrier" : "point", solid: path || moving, size: 0.68, motion: beats.some((b) => b.device?.swing) ? "pendulum" : moving ? "slide" : "none", motionPower: 0.55 };
}
function motor(kind, direction, power, range, duration, mode) {
  return { kind, trigger: ["rail", "gravityShift"].includes(kind) ? "inside" : "contact", direction, power, range, duration, angle: 0, count: 2, spreadAngle: 34, mode };
}
function prompt(emojis) {
  return `${emojis.join(" ")}\n\nこんなピタゴラ装置（3つ合わせて1つのギミック）があるとしたら、この装置に触れた落下中のボールはどんな挙動をすると思いますか？\nまずは絵文字から自然に連想できる動きを考えてください。必要であれば、分裂・ワープ・重力反転等を取り入れても構わないが、それらは装置をより面白くできる場合に限る。\n\n次のJSONだけを返してください。\n\n{"motion":"絵文字から連想した具体的な動き","beats":[{"duration":0.2,"ball":{"velocity":[0,-0.5],"force":[0.2,-0.3],"path":[[0,0],[0.3,-0.4]],"hold":0.1,"carry":0.5,"spin":0.1,"bounce":0.3},"device":{"move":[0,-0.2],"rotate":0.2,"swing":{"pivot":[0,-0.6],"angle":0.4,"cycles":0.5}},"effects":{"split":2,"spread":0.4,"warp":[0.4,-0.6],"gravity":[-1,0],"merge":"faster"},"branches":[{"ball":{"path":[[-0.2,0],[-0.6,-0.5]],"velocity":[-0.3,-0.4],"bounce":0.5}}]}]}\n\nmotionは「要約」などの説明語ではなく、絵文字から連想したボールの具体的な動きにする。\n各beatは、duration秒の間に起きる動きを表す。\nballはボールへの作用、deviceは装置全体の動き、effectsは分裂・ワープ・重力などの特殊効果を表す。\n使わない項目は省略する。\nbeatsは3〜5個。\npath / warp / pivot は、ギミック中心を[0,0]とした-1〜1の相対座標。\nvelocity / force / gravity / move は、-1〜1の方向と強さ。\nJSONにない項目は追加しない。`;
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
      const raw = JSON.parse(stripJsonFence(await genWithFallback(prompt(emojis), { generationConfig: { responseMimeType: "application/json", temperature: 0.92 } })));
      const gimmick = normalize(raw, emojis);
      await logGimmick(emojis, gimmick, "gemini-beats");
      return res.json(gimmick);
    } catch (error) {
      console.warn("[noHand-soccer] beat fallback", error);
      const gimmick = { ...normalize({}, emojis), source: "fallback" };
      await logGimmick(emojis, gimmick, "fallback-beats");
      return res.json(gimmick);
    }
  });
}
