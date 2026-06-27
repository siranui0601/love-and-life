import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { appendNoHandSoccerGimmickLog } from "./sheet-log.js";

const MODES = new Set([
  "ride", "guide", "hit", "bounce", "hold", "release", "spin",
  "drop", "swing", "push", "pull", "rotate",
  "split", "warp", "gravity",
]);
const SPECIAL_MODES = new Set(["split", "warp", "gravity"]);
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
function defaultMode(index) {
  return index === 0 ? "guide" : index === 1 ? "hit" : "release";
}
function flowStep(raw = {}, index = 0, usedActors = new Set()) {
  let actors = cleanActors(raw.actors);
  if (!actors.length && Number.isInteger(Number(raw.actor))) actors = cleanActors([Number(raw.actor)]);
  if (!actors.length) actors = [index % 3];
  actors = actors.filter((actor) => !usedActors.has(actor));
  if (!actors.length) return null;
  actors.forEach((actor) => usedActors.add(actor));
  const mode = MODES.has(raw.mode) ? raw.mode : defaultMode(index);
  return defined({
    step: index,
    actors,
    pos: pair(raw.pos, DEFAULT_FLOW_POS[index] || [0, 0]),
    mode,
    to: Number.isInteger(Number(raw.to)) ? Math.max(0, Math.min(4, Number(raw.to))) : undefined,
    power: intClamp(raw.power, mode === "hit" ? 70 : 55, 15, 100),
    duration: clamp(raw.duration, mode === "hit" || mode === "split" ? 0.24 : 0.36, 0.08, 1.2),
    count: mode === "split" ? intClamp(raw.count, 2, 2, 4) : undefined,
    spread: ["split", "release"].includes(mode) ? intClamp(raw.spread, 55, 10, 100) : undefined,
    direction: Array.isArray(raw.direction) ? pair(raw.direction, [70, -35]) : undefined,
  });
}
function fallbackFlow() {
  return [
    { step: 0, actors: [0], pos: [-75, 20], mode: "guide", to: 1, power: 45, duration: 0.36 },
    { step: 1, actors: [1], pos: [0, -35], mode: "hit", to: 2, power: 70, duration: 0.24 },
    { step: 2, actors: [2], pos: [75, 20], mode: "release", direction: [70, -30], power: 58, duration: 0.22 },
  ];
}
function ensureAllActors(flow) {
  const used = new Set(flow.flatMap((step) => step.actors || []));
  const out = [...flow];
  for (let actor = 0; actor < 3; actor += 1) {
    if (!used.has(actor)) {
      out.push({ step: out.length, actors: [actor], pos: DEFAULT_FLOW_POS[actor], mode: "release", power: 45, duration: 0.18 });
    }
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
  }));
}
function normalizeTrigger(raw = {}, flow = []) {
  const step = Number.isInteger(Number(raw.step)) ? Math.max(0, Math.min(flow.length - 1, Number(raw.step))) : 0;
  return { step, radius: intClamp(raw.radius, 28, 16, 55) };
}
function layoutFromFlow(flow, emojis) {
  const rows = [];
  for (const step of flow) {
    const actors = step.actors || [];
    const offsets = actors.length === 2 ? [[-14, 0], [14, 0]] : [[0, 0]];
    actors.forEach((actor, i) => {
      rows.push({ actor, emoji: emojis[actor] || "❓", pos: [clamp(step.pos[0] + offsets[i][0], 0, -100, 100) / 100, clamp(step.pos[1] + offsets[i][1], 0, -100, 100) / 100] });
    });
  }
  return rows.sort((a, b) => a.actor - b.actor);
}
function unitsFromFlow(flow) {
  return flow.map((step) => ({ unit: step.step, actors: step.actors }));
}
function beatsFromFlow(flow) {
  return flow.map((step) => {
    const power = clamp(step.power / 100, 0.55, 0.15, 1);
    const out = defined({
      unit: step.step,
      actor: step.actors?.[0],
      mode: step.mode,
      to: step.to,
      duration: step.duration,
      power,
      count: step.mode === "split" ? step.count : undefined,
      spread: ["split", "release"].includes(step.mode) ? clamp((step.spread ?? 55) / 100, 0.55, 0.1, 1) : undefined,
      direction: Array.isArray(step.direction) ? pair(step.direction, [70, -35]).map((n) => n / 100) : undefined,
    });
    return out;
  });
}
function hashCode(input) {
  let h = 2166136261;
  for (const ch of String(input)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
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
  return {
    visualLabel: emojis.join(""),
    summary,
    trigger,
    flow,
    layout,
    units,
    beats,
    body: { shape: "point", solid: false, size: 0.7, motion: "none", motionPower: 0.5 },
    shortEffect: summary,
    conceptKey,
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
  return `${emojis.join(" ")}

こんなピタゴラ装置（3つ合わせて1つのギミック）があるとしたら、この装置に触れた落下中のボールはどんな挙動をすると思いますか？
まずは絵文字から自然に連想できる動きを考えてください。必要であれば、分裂・ワープ・重力反転等を取り入れても構わないが、それらは装置を必ず面白くできる場合に限る。

返答はJSONのみ。
AIは物理ベクトルではなく、装置の意味構造を出してください。

出力形式:
{
  "summary": "短い動きの要約",
  "trigger": { "step": 0, "radius": 28 },
  "flow": [
    { "step": 0, "actors": [0], "pos": [-70, 10], "mode": "ride", "to": 1, "power": 45, "duration": 0.35 },
    { "step": 1, "actors": [1], "pos": [0, -35], "mode": "hit", "to": 2, "power": 70, "duration": 0.25 },
    { "step": 2, "actors": [2], "pos": [70, 10], "mode": "release", "direction": [70, -30], "power": 60, "duration": 0.25 }
  ]
}

ルール:
- summaryはカード表示用。20〜35文字程度で、説明文ではなく動作の短い要約にする。
- flowは、配置・部品・発動順をまとめたもの。
- actorsは絵文字の番号。左から0,1,2。
- actors:[0,1] や actors:[1,2] のように隣り合う絵文字を1つのstepにまとめてもよい。
- actorsは全体で重複させない。
- posはギミック中心を[0,0]とした相対座標。xは右がプラス、yは下がプラス。範囲は-100〜100。
- posはボールの流れに合うように配置する。入力順ではなく、動作として自然な位置を優先する。
- trigger.stepは、ボールが最初に触れるstep。ユーザーに分かりやすい開始地点にする。
- 通常のbeatでは ride / guide / hit / bounce / hold / release / spin を優先する。
- drop / swing / push / pull / rotate は、装置側の動きが主役のときに使う。
- split / warp / gravity は特殊beatとして扱う。
- 特殊beatは、絵文字3つの意味から見て、その効果が一番自然で面白い場合だけ使う。
- power, spread, radius, duration は控えめ。
- flow以外に layout / units / beats / motion / motionIdea / shortEffect / velocity / force / path / ball / effects / motors / body / role / description / label / id / name / size / hitbox は書かない。
- JSONにない項目は追加しない。`;
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
      const output = await genWithFallback(prompt(emojis), { generationConfig: { responseMimeType: "application/json", temperature: 0.84 } });
      const raw = JSON.parse(extractFirstJsonObject(output));
      const gimmick = normalize(raw, emojis);
      await logGimmick(emojis, gimmick, "gemini-flow-structure");
      return res.json(gimmick);
    } catch (error) {
      console.warn("[noHand-soccer] flow fallback", error);
      const gimmick = { ...normalize({}, emojis), source: "fallback-flow-structure" };
      await logGimmick(emojis, gimmick, "fallback-flow-structure");
      return res.json(gimmick);
    }
  });
}
