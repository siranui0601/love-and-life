import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { appendNoHandSoccerGimmickLog } from "./sheet-log.js";

const DEFAULT_FLOW_POS = [[-75, 20], [0, -35], [75, 20]];
const MIN_PATH_DELTA = 15;
const MIN_PATH_SPAN = 30;

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
function intClamp(value, fallback, min, max) { return Math.round(clamp(value, fallback, min, max)); }
function pair(value, fallback = [0, 0], min = -100, max = 100) {
  const src = Array.isArray(value) ? value : fallback;
  return [clamp(src[0], fallback[0] ?? 0, min, max), clamp(src[1], fallback[1] ?? 0, min, max)];
}
function stagePoint(value, fallback = { $x: 70, $y: -30 }) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return { $x: clamp(src.$x, fallback.$x, -100, 100), $y: clamp(src.$y, fallback.$y, -100, 100) };
}
function coordPoint(value, fallback = [0, 0], preferStage = false) {
  if (value && typeof value === "object" && !Array.isArray(value) && ("$x" in value || "$y" in value)) {
    const fb = Array.isArray(fallback) ? { $x: fallback[0] || 0, $y: fallback[1] || 0 } : fallback;
    return stagePoint(value, fb);
  }
  const local = pair(value, Array.isArray(fallback) ? fallback : [fallback.$x || 0, fallback.$y || 0]);
  return preferStage ? { $x: local[0], $y: local[1] } : local;
}
function rawPoints(value, maxPoints = 6) {
  return (Array.isArray(value) ? value : []).slice(0, maxPoints).map((p) => coordPoint(p)).filter(Boolean);
}
function strengthenAxis(points, axis) {
  const indexed = points.map((p, index) => ({ p, index })).filter(({ p }) => Array.isArray(p));
  if (indexed.length <= 1) return points;
  let min = Infinity;
  let max = -Infinity;
  for (const { p } of indexed) { min = Math.min(min, p[axis]); max = Math.max(max, p[axis]); }
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return points;
  const center = (min + max) / 2;
  const scale = span < MIN_PATH_SPAN ? MIN_PATH_SPAN / span : 1;
  return points.map((p, index) => {
    if (!Array.isArray(p) || index === 0) return p;
    let value = center + (p[axis] - center) * scale;
    if (value !== 0 && Math.abs(value) < MIN_PATH_DELTA) value = Math.sign(value) * MIN_PATH_DELTA;
    const next = [...p];
    next[axis] = clamp(value, p[axis], -100, 100);
    return next;
  });
}
function visiblePoints(value, maxPoints = 6) {
  let list = rawPoints(value, maxPoints);
  if (list.length <= 1) return list;
  list = strengthenAxis(list, 0);
  list = strengthenAxis(list, 1);
  return list;
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
function normalizeBall(raw = {}) { return defined({ path: visiblePoints(raw.path) }); }
function normalizeDevice(raw = {}) {
  const path = visiblePoints(raw.path, 5);
  return defined({ path, followBall: raw.followBall === true ? true : undefined });
}
function normalizeHold(raw) {
  if (raw == null) return undefined;
  const seconds = typeof raw === "object" ? raw.seconds : raw;
  return { seconds: clamp(seconds, 0.6, 0.1, 3) };
}
function normalizeSpin(raw) {
  if (raw == null) return undefined;
  return { amount: intClamp(typeof raw === "object" ? raw.amount : raw, 60, -100, 100), seconds: clamp(typeof raw === "object" ? raw.seconds : 0.8, 0.8, 0.1, 3) };
}
function normalizeHit(raw = {}) {
  const velocity = Array.isArray(raw.velocity) ? pair(raw.velocity, [75, -30]) : Array.isArray(raw.impulse) ? pair(raw.impulse, [75, -30]) : undefined;
  return defined({ velocity, radius: intClamp(raw.radius, 30, 10, 65) });
}
function normalizeSplit(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  return defined({ count: intClamp(raw.count, 2, 2, 4), spread: intClamp(raw.spread, 55, 10, 100) });
}
function normalizeWarp(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  return coordPoint(raw.to || raw.pos || raw, { $x: 70, $y: -30 }, true);
}
function angleFromDirection(direction) {
  const [x, y] = pair(direction, [0, -100]);
  return (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
}
function normalizeGravity(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  const angle = Number.isFinite(Number(raw.angle)) ? Number(raw.angle) : angleFromDirection(raw.direction);
  return { angle: ((angle % 360) + 360) % 360, seconds: clamp(raw.seconds, 1, 0.1, 3) };
}
function normalizeContact(raw, actors, hasContactEffect) {
  if (!hasContactEffect) return undefined;
  const n = Number(raw);
  if (Number.isInteger(n) && actors.includes(n)) return n;
  return actors[0];
}
function flowStep(raw = {}, index = 0, usedActors = new Set()) {
  let actors = cleanActors(raw.actors);
  if (!actors.length && Number.isInteger(Number(raw.actor))) actors = cleanActors([Number(raw.actor)]);
  if (!actors.length) actors = [index % 3];
  actors = actors.filter((actor) => !usedActors.has(actor));
  if (!actors.length) return null;
  actors.forEach((actor) => usedActors.add(actor));
  const ball = normalizeBall(raw.ball || {});
  const hold = normalizeHold(raw.hold ?? raw.ball?.hold);
  const spin = normalizeSpin(raw.spin ?? raw.ball?.spin);
  const hit = raw.hit ? normalizeHit(raw.hit) : undefined;
  const split = normalizeSplit(raw.split);
  const warp = normalizeWarp(raw.warp);
  const gravity = normalizeGravity(raw.gravity);
  const hasContactEffect = Boolean(hold || spin || hit || split || warp || gravity);
  const step = defined({
    step: index,
    actors,
    pos: pair(raw.pos, DEFAULT_FLOW_POS[index] || [0, 0]),
    duration: clamp(raw.duration, ball?.path || raw.device ? 0.6 : 0.35, 0.08, 3),
    ball,
    device: normalizeDevice(raw.device || {}),
    contact: normalizeContact(raw.contact ?? raw.touch, actors, hasContactEffect),
    hold,
    spin,
    hit,
    split,
    warp,
    gravity,
  });
  if (!step.device && hasContactEffect) step.device = { path: [[0, 0], [0, -15], [0, 0]] };
  if (!step.ball && !step.device && !hasContactEffect) {
    step.ball = index === 0 ? { path: [[0, 0], [70, -15]] } : undefined;
    step.hit = index === 0 ? undefined : { velocity: [65, -35], radius: 30 };
    if (step.hit) step.contact = actors[0];
  }
  return step;
}
function fallbackFlow() {
  return [
    { step: 0, actors: [0], pos: [-75, 20], ball: { path: [[0, 0], [70, -20]] }, device: { followBall: true }, duration: 0.6 },
    { step: 1, actors: [1], pos: [0, -35], contact: 1, hit: { velocity: [70, -35], radius: 30 }, duration: 0.35 },
    { step: 2, actors: [2], pos: [75, 20], contact: 2, hit: { velocity: [75, -30], radius: 30 }, duration: 0.25 },
  ];
}
function ensureAllActors(flow) {
  const used = new Set(flow.flatMap((step) => step.actors || []));
  const out = [...flow];
  for (let actor = 0; actor < 3; actor += 1) {
    if (!used.has(actor)) out.push({ step: out.length, actors: [actor], pos: DEFAULT_FLOW_POS[actor], contact: actor, hit: { velocity: [55, -25], radius: 30 }, duration: 0.22 });
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
  return normalizeFlowSpacing(ensureAllActors(steps.length >= 2 ? steps : fallbackFlow()));
}
function normalizeTrigger(raw = {}, flow = []) {
  const step = Number.isInteger(Number(raw.step)) ? Math.max(0, Math.min(flow.length - 1, Number(raw.step))) : 0;
  const actorCount = flow[step]?.actors?.length || 1;
  return { step, radius: actorCount > 1 ? 46 : 38 };
}
function layoutFromFlow(flow, emojis) {
  const rows = [];
  for (const step of flow) {
    const offsets = step.actors.length === 2 ? [[-14, 0], [14, 0]] : [[0, 0]];
    step.actors.forEach((actor, i) => rows.push({ actor, emoji: emojis[actor] || "❓", pos: [clamp(step.pos[0] + offsets[i][0], 0, -100, 100) / 100, clamp(step.pos[1] + offsets[i][1], 0, -100, 100) / 100] }));
  }
  return rows.sort((a, b) => a.actor - b.actor);
}
function unitsFromFlow(flow) { return flow.map((step) => ({ unit: step.step, actors: step.actors })); }
function beatsFromFlow(flow) { return flow.map((step, index) => ({ ...step, unit: step.step, actor: step.actors?.[0], next: index === flow.length - 1 || step.split ? "terminal" : "assist" })); }
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
  return `${emojis.join("")}

こんなピタゴラ装置（3つ合わせて1つのギミック）があるとしたら、この装置に触れた落下中のボールはどんな挙動をすると思いますか？
まずは絵文字から自然に連想できる動きを考えてください。必要であれば、分裂(split), ワープ(warp), 重力向き変更(gravity)等を取り入れても構わないが、それらは装置を必ず面白くできる場合に限る。

返答はJSONのみ。

出力するJSONの形:
summary: この装置の動き方を20〜35文字で要約。summaryはこの装置で起きる動きの設計図。summaryに書いた主要な動きや効果はflow内で必ず実行する
trigger: { step }。ボールが最初に触れる開始step
flow: step配列。各stepは actors, pos, duration を持ち、必要に応じて ball / device / contact / hold / spin / hit / split / warp / gravity を持つ

使える指定:
ball.path: [[x,y], ...]。ボールを指定軌道で動かす
device.path: [[x,y], ...]。絵文字部品の動き。yを+にしていけば落下した様になる
device.followBall: true。絵文字部品がボールと一緒に動く。運ぶ・抱える・乗せる・一緒に落ちる表現に使う
contact: 絵文字番号。指定した絵文字がボールに触れたように見せ、その接触で効果を発火する
hold: { seconds }。接触後、ボールを止める
spin: { amount, seconds }。接触後、ボールに回転を加える
hit: { velocity:[x,y] }。接触後、ボールを弾く
split: { count, spread }。接触後、ボールを分裂させる
warp: { "$x":x, "$y":y }。接触後、ボールをステージ上の離れた位置へ転移させる
gravity: { angle, seconds }。接触後、指定秒数だけ重力方向を変える。0=上、90=右、180=下、270=左

ルール:
[x,y] はstep中心からの相対座標。{"$x":x,"$y":y} はステージ全体の絶対座標。どちらも-100〜100で指定する。xは右が+、yは下が+
{"$x":x,"$y":y} は ball.path / device.path / warp の中でも使える
pathで動かす軸の変化量は15以上にする。蛇行・螺旋・回り込みならx,yの両方を大きく変化させる
flowは上から順番に実行される。最後のstepが終わったら装置は終了する
durationは、そのstepでボールと絵文字が接触して効果が発火するまでの演出秒数
ball.path / device.path / device.followBall はduration中に動く
hold / spin / hit / split / warp / gravity はcontactで指定した絵文字とボールの接触後に発火する
hold / spin / hit / split / warp / gravity を使うstepでは、必ずcontactを指定する
ボールを不自然にactorへ寄せない。接触させたい場合は、device.pathやdevice.followBallで絵文字部品がボールへ近づくように見せる
3つの絵文字が装置の一部に見えるようにflowへ含める
split / warp / gravity は特殊効果。絵文字の主題から自然に連想でき、通常のpathやhitより適切になる場合だけ使う
split / warp / gravity を使う場合はsummaryにも明記し、summaryに書いた場合は対応するsplit / warp / gravityをflowに必ず入れる`;
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
      const output = await genWithFallback(prompt(emojis), { generationConfig: { responseMimeType: "application/json", temperature: 0.88 } });
      const raw = JSON.parse(extractFirstJsonObject(output));
      const gimmick = normalize(raw, emojis);
      await logGimmick(emojis, gimmick, "gemini-contact-effect-flow");
      return res.json(gimmick);
    } catch (error) {
      console.warn("[noHand-soccer] primitive flow fallback", error);
      const gimmick = { ...normalize({}, emojis), source: "fallback-primitive-flow" };
      await logGimmick(emojis, gimmick, "fallback-primitive-flow");
      return res.json(gimmick);
    }
  });
}
