import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { appendNoHandSoccerGimmickLog } from "./sheet-log.js";

const NEXT_VALUES = new Set(["time", "assist", "terminal"]);
const DEFAULT_FLOW_POS = [[-75, 20], [0, -35], [75, 20]];

function text(value, fallback = "", max = 180) {
  return String(value || fallback || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function fallbackSummary(emojis) { return `${emojis.join("")}が順番にボールを受け渡す`; }
function isGenericSummary(value) {
  const s = text(value, "", 120);
  return !s || /要約|説明|具体的|接触後のボールの動き/.test(s) || s.length < 6;
}
function clamp(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function intClamp(value, fallback, min, max) {
  return Math.round(clamp(value, fallback, min, max));
}
function pair(value, fallback = [0, 0], min = -100, max = 100) {
  const src = Array.isArray(value) ? value : fallback;
  return [clamp(src[0], fallback[0] ?? 0, min, max), clamp(src[1], fallback[1] ?? 0, min, max)];
}
function points(value, maxPoints = 6) {
  return (Array.isArray(value) ? value : []).filter(Array.isArray).slice(0, maxPoints).map((p) => pair(p));
}
function defined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length;
    if (typeof v === "object") return Object.keys(v).length;
    return true;
  }));
}
function cleanActors(value) {
  const raw = Array.isArray(value) ? value : [];
  const actors = [...new Set(raw.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0 && x <= 2))];
  if (actors.length > 2) return actors.slice(0, 1);
  if (actors.length === 2 && Math.abs(actors[0] - actors[1]) !== 1) return actors.slice(0, 1);
  return actors;
}
function normalizeBall(raw = {}) {
  const orbit = raw.orbit && typeof raw.orbit === "object" ? defined({
    center: pair(raw.orbit.center, [0, 0]),
    radius: intClamp(raw.orbit.radius, 38, 12, 80),
    turns: clamp(raw.orbit.turns, 1.1, 0.25, 2.5),
    exit: pair(raw.orbit.exit, [70, -25]),
    carry: intClamp(raw.orbit.carry ?? raw.carry, 60, 15, 100),
    releasePower: intClamp(raw.orbit.releasePower ?? raw.releasePower, 55, 10, 100),
  }) : undefined;
  return defined({
    path: points(raw.path),
    orbit,
    impulse: Array.isArray(raw.impulse) ? pair(raw.impulse, [60, -30]) : undefined,
    carry: raw.path ? intClamp(raw.carry, 55, 10, 100) : undefined,
    hold: intClamp(raw.hold, 0, 0, 100) || undefined,
    spin: intClamp(raw.spin, 0, -100, 100) || undefined,
    releasePower: intClamp(raw.releasePower, 0, 0, 100) || undefined,
  });
}
function normalizeDevice(raw = {}) {
  const swing = raw.swing && typeof raw.swing === "object" ? defined({
    pivot: pair(raw.swing.pivot, [0, -55]),
    angle: intClamp(raw.swing.angle, 65, -120, 120),
    length: intClamp(raw.swing.length, 58, 18, 95),
    cycles: clamp(raw.swing.cycles, 0.6, 0.2, 2.5),
  }) : undefined;
  return defined({
    path: points(raw.path, 5),
    swing,
    rotate: intClamp(raw.rotate, 0, -120, 120) || undefined,
    duration: clamp(raw.duration, 0.35, 0.08, 1.2),
  });
}
function normalizeHit(raw = {}) {
  return defined({
    radius: intClamp(raw.radius, 30, 10, 65),
    impulse: Array.isArray(raw.impulse) ? pair(raw.impulse, [75, -30]) : undefined,
    power: intClamp(raw.power, 60, 10, 100),
  });
}
function normalizeSplit(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  return defined({
    count: intClamp(raw.count, 2, 2, 4),
    spread: intClamp(raw.spread, 55, 10, 100),
    power: intClamp(raw.power, 55, 10, 100),
  });
}
function normalizeWarp(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  return defined({ to: pair(raw.to || raw.pos, [70, -30]) });
}
function normalizeGravity(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  return defined({
    direction: pair(raw.direction, [0, -100]),
    strength: intClamp(raw.strength, 60, 10, 100),
  });
}
function flowStep(raw = {}, index = 0, usedActors = new Set()) {
  let actors = cleanActors(raw.actors);
  if (!actors.length && Number.isInteger(Number(raw.actor))) actors = cleanActors([Number(raw.actor)]);
  if (!actors.length) actors = [index % 3];
  actors = actors.filter((actor) => !usedActors.has(actor));
  if (!actors.length) return null;
  actors.forEach((actor) => usedActors.add(actor));
  const step = defined({
    step: index,
    actors,
    pos: pair(raw.pos, DEFAULT_FLOW_POS[index] || [0, 0]),
    to: Number.isInteger(Number(raw.to)) ? Math.max(0, Math.min(4, Number(raw.to))) : undefined,
    duration: clamp(raw.duration, raw.device || raw.ball?.path || raw.ball?.orbit ? 0.38 : 0.26, 0.08, 1.2),
    ball: normalizeBall(raw.ball || {}),
    device: normalizeDevice(raw.device || {}),
    hit: raw.hit ? normalizeHit(raw.hit) : undefined,
    split: normalizeSplit(raw.split),
    warp: normalizeWarp(raw.warp),
    gravity: normalizeGravity(raw.gravity),
    next: NEXT_VALUES.has(raw.next) ? raw.next : undefined,
  });
  if (!step.ball && !step.device && !step.hit && !step.split && !step.warp && !step.gravity) {
    step.ball = index === 0 ? { path: [[0, 0], [70, -15]], carry: 45 } : { impulse: [65, -35], releasePower: 50 };
  }
  return step;
}
function fallbackFlow() {
  return [
    { step: 0, actors: [0], pos: [-75, 20], ball: { path: [[0, 0], [70, -20]], carry: 45 }, next: "assist", duration: 0.36 },
    { step: 1, actors: [1], pos: [0, -35], hit: { impulse: [70, -35], power: 65, radius: 30 }, next: "assist", duration: 0.24 },
    { step: 2, actors: [2], pos: [75, 20], ball: { impulse: [75, -30], releasePower: 55 }, next: "terminal", duration: 0.22 },
  ];
}
function ensureAllActors(flow) {
  const used = new Set(flow.flatMap((step) => step.actors || []));
  const out = [...flow];
  for (let actor = 0; actor < 3; actor += 1) {
    if (!used.has(actor)) out.push({ step: out.length, actors: [actor], pos: DEFAULT_FLOW_POS[actor], ball: { impulse: [55, -25], releasePower: 40 }, next: "terminal", duration: 0.18 });
  }
  return out.slice(0, 5).map((step, index) => ({ ...step, step: index }));
}
function normalizeFlowSpacing(flow) {
  if (flow.length <= 1) return flow;
  const xs = flow.map((s) => s.pos[0]);
  const ys = flow.map((s) => s.pos[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const span = Math.max(width, height);
  const scale = span < 120 ? 120 / Math.max(1, span) : span > 185 ? 185 / span : 1;
  return flow.map((step) => {
    const group = (step.actors || []).length > 1;
    const x = clamp(step.pos[0] * scale, step.pos[0], -92, 92);
    const y = clamp(step.pos[1] * scale, step.pos[1], -92, 92);
    return { ...step, pos: group ? [clamp(x, x, -82, 82), clamp(y, y, -82, 82)] : [x, y] };
  });
}
function normalizeFlow(rawFlow) {
  const used = new Set();
  const steps = (Array.isArray(rawFlow) ? rawFlow : []).slice(0, 5).map((step, index) => flowStep(step, index, used)).filter(Boolean);
  const base = ensureAllActors(steps.length >= 2 ? steps : fallbackFlow());
  const spaced = normalizeFlowSpacing(base);
  return spaced.map((step, index) => ({
    ...step,
    step: index,
    to: Number.isInteger(Number(step.to)) ? Math.max(0, Math.min(spaced.length - 1, Number(step.to))) : Math.min(index + 1, spaced.length - 1),
    next: step.next || (index === spaced.length - 1 || step.split ? "terminal" : "assist"),
  }));
}
function normalizeTrigger(raw = {}, flow = []) {
  const step = Number.isInteger(Number(raw.step)) ? Math.max(0, Math.min(flow.length - 1, Number(raw.step))) : 0;
  return { step, radius: intClamp(raw.radius, 28, 16, 55) };
}
function layoutFromFlow(flow, emojis) {
  const rows = [];
  for (const step of flow) {
    const offsets = step.actors.length === 2 ? [[-14, 0], [14, 0]] : [[0, 0]];
    step.actors.forEach((actor, i) => rows.push({
      actor,
      emoji: emojis[actor] || "❓",
      pos: [clamp(step.pos[0] + offsets[i][0], 0, -100, 100) / 100, clamp(step.pos[1] + offsets[i][1], 0, -100, 100) / 100],
    }));
  }
  return rows.sort((a, b) => a.actor - b.actor);
}
function unitsFromFlow(flow) { return flow.map((step) => ({ unit: step.step, actors: step.actors })); }
function beatsFromFlow(flow) { return flow.map((step) => ({ ...step, unit: step.step, actor: step.actors?.[0] })); }
function hashCode(input) {
  let h = 2166136261;
  for (const ch of String(input)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function normalize(raw, emojis) {
  const summary = isGenericSummary(raw?.summary || raw?.motion) ? fallbackSummary(emojis) : text(raw.summary || raw.motion, fallbackSummary(emojis), 60);
  const flow = normalizeFlow(raw?.flow);
  const trigger = normalizeTrigger(raw?.trigger || {}, flow);
  const layout = layoutFromFlow(flow, emojis);
  const units = unitsFromFlow(flow);
  const beats = beatsFromFlow(flow);
  const conceptKey = hashCode(JSON.stringify({ emojis, summary, trigger, flow }));
  return { visualLabel: emojis.join(""), summary, trigger, flow, layout, units, beats, body: { shape: "point", solid: false, size: 0.7, motion: "none", motionPower: 0.5 }, shortEffect: summary, conceptKey };
}
function extractFirstJsonObject(input) {
  const s = stripJsonFence(String(input || ""));
  const start = s.indexOf("{");
  if (start < 0) throw new SyntaxError("JSON object not found");
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) { if (escape) escape = false; else if (ch === "\\") escape = true; else if (ch === "\"") inString = false; continue; }
    if (ch === "\"") inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (depth === 0) return s.slice(start, i + 1); }
  }
  throw new SyntaxError("JSON object was not closed");
}
function prompt(emojis) {
  return `${emojis.join(" ")}

こんなピタゴラ装置（3つ合わせて1つのギミック）があるとしたら、この装置に触れた落下中のボールはどんな挙動をすると思いますか？
まずは絵文字から自然に連想できる動きを考えてください。必要であれば、分裂・ワープ・重力反転等を取り入れても構わないが、それらは装置を必ず面白くできる場合に限る。

返答はJSONのみ。
modeではなく、ball / device / hit / split / warp / gravity / next の組み合わせで、装置の意味構造と動きを直接書いてください。

出力形式:
{
  "summary": "短い動きの要約",
  "trigger": { "step": 0, "radius": 28 },
  "flow": [
    { "step": 0, "actors": [0], "pos": [-70, -20], "ball": { "impulse": [20, -45], "power": 35 }, "next": "assist", "duration": 0.2 },
    { "step": 1, "actors": [2], "pos": [0, -70], "device": { "path": [[0, -50], [0, 20]], "duration": 0.35 }, "hit": { "radius": 30, "impulse": [35, 35], "power": 55 }, "next": "assist", "duration": 0.35 },
    { "step": 2, "actors": [1], "pos": [70, 10], "device": { "swing": { "pivot": [-25, -45], "angle": 70 } }, "hit": { "impulse": [85, -35], "power": 75 }, "next": "terminal", "duration": 0.28 }
  ]
}

使える指定:
- ball.path: ボールを指定軌道で運ぶ。蛇行・波・滑り台のような動きに使う。
- ball.orbit: ボールを中心の周りに回す。渦・螺旋・回転装置に使う。
- ball.impulse: ボールを一瞬押し出す。
- ball.hold: ボールを一瞬止める。
- ball.spin: 回転を加える。
- device.path: その絵文字部品が動く軌道。落下物・押し出し・移動床に使う。
- device.swing: 支点を中心に振れる動き。鎖・ハンマー・振り子に使う。
- hit: そのstepの部品がボールに当たったように力を与える。
- split / warp / gravity: 特殊効果。絵文字3つの意味から見て、その効果が一番自然で面白い場合だけ使う。
- next: time / assist / terminal。assistは接触っぽく補正しながら必ず次へ進める。

ルール:
- summaryはカード表示用。20〜35文字程度。
- flowは、配置・部品・発動順をまとめたもの。
- actorsは絵文字番号。左から0,1,2。actors:[0,1] や actors:[1,2] のように隣り合う絵文字を1つのstepにまとめてもよい。
- actorsは全体で重複させない。
- pos / path / pivot / impulse / direction はギミック中心またはstep中心からの相対座標。範囲は-100〜100。xは右がプラス、yは下がプラス。
- posはボールの流れに合うように配置する。入力順ではなく、動作として自然な位置を優先する。
- trigger.stepは、ボールが最初に触れるstep。ユーザーに分かりやすい開始地点にする。
- 1つのflow stepで主役にする効果は1つ。補助としてhitを足すのはよい。
- splitを使うstepはnextをterminalにする。
- JSONにない項目は追加しない。mode / layout / units / beats / motion / motionIdea / shortEffect / force / motors / body / role / description / label / id / name / size / hitbox は書かない。`;
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
      await logGimmick(emojis, gimmick, "gemini-primitive-flow");
      return res.json(gimmick);
    } catch (error) {
      console.warn("[noHand-soccer] primitive flow fallback", error);
      const gimmick = { ...normalize({}, emojis), source: "fallback-primitive-flow" };
      await logGimmick(emojis, gimmick, "fallback-primitive-flow");
      return res.json(gimmick);
    }
  });
}
