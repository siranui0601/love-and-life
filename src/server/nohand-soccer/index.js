import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { appendNoHandSoccerGimmickLog } from "./sheet-log.js";

const MOTOR_KINDS = [
  "kick",
  "cannon",
  "spring",
  "wind",
  "updraft",
  "vortex",
  "current",
  "antiFall",
  "redirect",
  "mirror",
  "curve",
  "rail",
  "oneWay",
  "carrier",
  "tether",
  "orbit",
  "catchRelease",
  "pendulum",
  "portal",
  "phase",
  "gravityFlip",
  "slow",
  "speedFloor",
];

const BODY_SHAPES = ["point", "line", "area", "fan", "gate", "rail", "carrier", "arm", "platform"];
const BODY_MOTIONS = ["none", "spin", "slide", "bob", "swing", "orbit", "pendulum"];
const TRIGGERS = ["contact", "inside", "enter", "periodic", "timer"];
const DIRECTIONS = ["angle", "up", "down", "left", "right", "radialIn", "radialOut", "tangent", "towardNextGoal", "awayFromBall"];
const TRAP_RISK_KINDS = ["slow", "updraft", "vortex", "orbit", "tether", "antiFall", "gravityFlip"];
const EXIT_KINDS = ["kick", "cannon", "spring", "current", "redirect", "rail", "oneWay", "carrier", "catchRelease", "pendulum", "portal", "speedFloor"];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, n) {
  return arr[Math.abs(Number(n) || 0) % arr.length];
}

function normalizeString(value, fallback, maxLength) {
  const text = String(value || fallback || "").replace(/[\r\n\t]+/g, " ").trim();
  return text.slice(0, maxLength);
}

function normalizeJapanese(value, fallback, maxLength) {
  const text = normalizeString(value, fallback, maxLength);
  if (/[ぁ-んァ-ン一-龥]/.test(text)) return text;
  return normalizeString(fallback, "ボールの動きを変える。", maxLength);
}

function normalizeNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeEnum(value, allowed, fallback) {
  const raw = String(value || "").trim();
  return allowed.includes(raw) ? raw : fallback;
}

function normalizeKind(kind, fallback = "kick") {
  const raw = String(kind || "").toLowerCase();
  if (MOTOR_KINDS.includes(raw)) return raw;
  if (/cannon|gun|shoot|砲|大砲|射/.test(raw)) return "cannon";
  if (/spring|jump|bounce|バネ|跳|弾/.test(raw)) return "spring";
  if (/wind|fan|flow|風|扇|流/.test(raw)) return "wind";
  if (/updraft|lift|float|上昇|浮|雲/.test(raw)) return "updraft";
  if (/vortex|spin|twister|渦|竜巻/.test(raw)) return "vortex";
  if (/current|river|belt|流れ|水流|ベルト/.test(raw)) return "current";
  if (/anti.?fall|parachute|落下|傘/.test(raw)) return "antiFall";
  if (/redirect|turn|curve|曲|向き/.test(raw)) return "redirect";
  if (/mirror|reflect|反射|鏡/.test(raw)) return "mirror";
  if (/rail|track|レール|軌道/.test(raw)) return "rail";
  if (/carrier|lift|move|運|リフト|台車/.test(raw)) return "carrier";
  if (/tether|rope|string|糸|鎖|引/.test(raw)) return "tether";
  if (/orbit|circle|周|衛星/.test(raw)) return "orbit";
  if (/catch|hold|release|掴|捕|放/.test(raw)) return "catchRelease";
  if (/pendulum|swing|振り子|揺/.test(raw)) return "pendulum";
  if (/portal|warp|door|ワープ|扉|穴/.test(raw)) return "portal";
  if (/phase|ghost|pass|透|幽霊/.test(raw)) return "phase";
  if (/gravity|重力/.test(raw)) return "gravityFlip";
  if (/slow|brake|減速|ブレーキ/.test(raw)) return "slow";
  if (/speed|boost|最低速度|加速/.test(raw)) return "speedFloor";
  if (/kick|punch|push|蹴|パンチ|押/.test(raw)) return "kick";
  return fallback;
}

function defaultShapeForMotors(motors) {
  if (motors.some((m) => ["rail", "mirror", "oneWay"].includes(m.kind))) return "rail";
  if (motors.some((m) => ["carrier"].includes(m.kind))) return "carrier";
  if (motors.some((m) => ["pendulum"].includes(m.kind))) return "arm";
  if (motors.some((m) => ["portal", "phase"].includes(m.kind))) return "gate";
  if (motors.some((m) => ["wind", "updraft", "vortex", "current"].includes(m.kind))) return "fan";
  if (motors.some((m) => ["tether", "orbit", "antiFall", "slow", "speedFloor"].includes(m.kind))) return "area";
  return "point";
}

function defaultMotionForMotors(motors) {
  if (motors.some((m) => m.kind === "pendulum")) return "pendulum";
  if (motors.some((m) => m.kind === "carrier")) return "slide";
  if (motors.some((m) => m.kind === "rotate" || m.kind === "vortex" || m.kind === "orbit")) return "spin";
  return "none";
}

function isSolidShape(shape, motors) {
  if (["rail", "platform", "line", "carrier", "arm"].includes(shape)) return true;
  return motors.some((m) => ["mirror", "rail", "oneWay", "pendulum", "carrier"].includes(m.kind));
}

function localFallback(emojis = []) {
  const seed = hash(emojis.join("|"));
  const first = pick(MOTOR_KINDS, seed);
  const second = pick(MOTOR_KINDS.filter((kind) => kind !== first), seed >>> 5);
  const motors = addAntiTrapMotors([
    { kind: first, trigger: "contact", direction: "angle", power: 0.72, range: 0.58, duration: 0.35 },
    { kind: second, trigger: "inside", direction: "angle", power: 0.45, range: 0.52, duration: 0.6 },
  ]);
  const shape = defaultShapeForMotors(motors);
  return {
    name: `審議中${emojis.join("")}`.slice(0, 24),
    visualLabel: pick(["装置", "細工", "仕掛け", "ゲート", "足場", "流れ", "振り子"], seed >>> 8),
    flavor: `${emojis.join("")}から生まれたボール細工。`,
    shortEffect: "触れるとボールを次の動きへつなげる。",
    body: { shape, solid: isSolidShape(shape, motors), size: 0.65, motion: defaultMotionForMotors(motors), motionPower: 0.55 },
    motors,
  };
}

function hasTrapRisk(motors) {
  const hasRiskField = motors.some((m) => TRAP_RISK_KINDS.includes(m.kind));
  const hasInwardField = motors.some((m) => ["wind", "current"].includes(m.kind) && ["radialIn", "tangent"].includes(m.direction));
  const hasSlowWithoutRelease = motors.some((m) => m.kind === "slow") && !motors.some((m) => ["current", "speedFloor", "redirect", "kick", "cannon", "spring", "portal", "rail", "carrier", "catchRelease", "pendulum"].includes(m.kind));
  const hasExit = motors.some((m) => EXIT_KINDS.includes(m.kind) && !(m.kind === "current" && ["radialIn", "tangent"].includes(m.direction)));
  return (hasRiskField || hasInwardField || hasSlowWithoutRelease) && !hasExit;
}

function addAntiTrapMotors(motors) {
  const result = [...motors];
  if (!hasTrapRisk(result)) return result.slice(0, 5);

  const maxRange = Math.max(0.62, ...result.map((m) => Number(m.range) || 0));
  while (result.length > 3) result.pop();
  result.push({
    kind: "current",
    trigger: "inside",
    direction: "towardNextGoal",
    power: 0.78,
    range: Math.min(1, maxRange + 0.12),
    duration: 0.8,
  });
  result.push({
    kind: "speedFloor",
    trigger: "inside",
    direction: "towardNextGoal",
    power: 0.68,
    range: Math.min(1, maxRange + 0.12),
    duration: 0.8,
  });
  return result.slice(0, 5);
}

function normalizeMotors(rawMotors, fallbackMotors) {
  const source = Array.isArray(rawMotors) ? rawMotors : [];
  const normalized = source.slice(0, 5).map((motor, index) => {
    const fallback = fallbackMotors[index] || fallbackMotors[0] || { kind: "kick", trigger: "contact", direction: "angle", power: 0.7, range: 0.55, duration: 0.35 };
    return {
      kind: normalizeKind(motor?.kind, fallback.kind),
      trigger: normalizeEnum(motor?.trigger, TRIGGERS, fallback.trigger || "contact"),
      direction: normalizeEnum(motor?.direction, DIRECTIONS, fallback.direction || "angle"),
      power: normalizeNumber(motor?.power, fallback.power ?? 0.7, 0.18, 1),
      range: normalizeNumber(motor?.range, fallback.range ?? 0.55, 0.15, 1),
      duration: normalizeNumber(motor?.duration, fallback.duration ?? 0.35, 0.05, 2.5),
    };
  });

  const motors = normalized.length ? normalized : fallbackMotors;
  const hasStrongOutput = motors.some((m) => ["kick", "cannon", "spring", "redirect", "portal", "carrier", "pendulum", "rail"].includes(m.kind));
  const hasSustain = motors.some((m) => ["wind", "updraft", "vortex", "current", "tether", "orbit", "antiFall", "speedFloor"].includes(m.kind));

  if (!hasStrongOutput && !hasSustain) {
    motors.push({ kind: "speedFloor", trigger: "inside", direction: "angle", power: 0.55, range: 0.6, duration: 0.5 });
  }
  if (motors.length === 1) {
    const only = motors[0];
    const assistKind = ["kick", "cannon", "spring"].includes(only.kind) ? "updraft" : "speedFloor";
    motors.push({ kind: assistKind, trigger: "inside", direction: only.direction || "angle", power: 0.35, range: Math.max(0.45, only.range || 0.5), duration: 0.6 });
  }

  return addAntiTrapMotors(motors);
}

function normalizeBody(rawBody, motors, fallbackBody) {
  const fallbackShape = fallbackBody?.shape || defaultShapeForMotors(motors);
  let shape = normalizeEnum(rawBody?.shape, BODY_SHAPES, fallbackShape);
  const inferred = defaultShapeForMotors(motors);
  if (["line", "platform", "rail"].includes(shape) && !isSolidShape(shape, motors)) shape = inferred;
  const motion = normalizeEnum(rawBody?.motion, BODY_MOTIONS, fallbackBody?.motion || defaultMotionForMotors(motors));
  return {
    shape,
    solid: Boolean(rawBody?.solid ?? isSolidShape(shape, motors)),
    size: normalizeNumber(rawBody?.size, fallbackBody?.size ?? 0.65, 0.35, 1),
    motion,
    motionPower: normalizeNumber(rawBody?.motionPower, fallbackBody?.motionPower ?? 0.55, 0, 1),
  };
}

function normalizeResult(raw, fallback) {
  const motors = normalizeMotors(raw?.motors || raw?.effects, fallback.motors || fallback.effects || []);
  return {
    name: normalizeJapanese(raw?.name, fallback.name, 24),
    visualLabel: normalizeJapanese(raw?.visualLabel, fallback.visualLabel, 12),
    flavor: normalizeJapanese(raw?.flavor, fallback.flavor, 80),
    shortEffect: normalizeJapanese(raw?.shortEffect, fallback.shortEffect, 44),
    body: normalizeBody(raw?.body || { shape: raw?.shape }, motors, fallback.body),
    motors,
  };
}

async function logGimmickSafely({ emojis, gimmick, source }) {
  try {
    await appendNoHandSoccerGimmickLog({ emojis, gimmick, source });
  } catch (error) {
    console.warn("[noHand-soccer] sheet log skipped", error);
  }
}

export function mountNoHandSoccerRoutes(app) {
  app.post("/api/nohand-soccer/gimmick", async (req, res) => {
    const emojis = Array.isArray(req.body?.emojis) ? req.body.emojis.slice(0, 3).map(String) : [];

    if (emojis.length !== 3 || emojis.some((emoji) => !emoji.trim())) {
      return res.status(400).json({ error: "emojis must contain exactly 3 items." });
    }

    const fallback = localFallback(emojis);
    const prompt = `絵文字3つから、ボールを動かすギミックを生成。日本語で。絵文字:${emojis.join(" ")}。JSONのみ:{"name":"","visualLabel":"","flavor":"","shortEffect":"","body":{"shape":"point|line|area|fan|gate|rail|carrier|arm|platform","solid":false,"size":0.6,"motion":"none|spin|slide|bob|swing|orbit|pendulum","motionPower":0.5},"motors":[{"kind":"","trigger":"contact|inside|enter|periodic|timer","direction":"angle|up|down|left|right|radialIn|radialOut|tangent|towardNextGoal|awayFromBall","power":0.7,"range":0.6,"duration":0.5}]}`;

    try {
      const text = await genWithFallback(prompt, {
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.95,
        },
      });
      const parsed = JSON.parse(stripJsonFence(text));
      const gimmick = normalizeResult(parsed, fallback);
      await logGimmickSafely({ emojis, gimmick, source: "gemini" });
      return res.json(gimmick);
    } catch (error) {
      console.warn("[noHand-soccer] Gemini gimmick fallback", error);
      const gimmick = { ...fallback, source: "fallback" };
      await logGimmickSafely({ emojis, gimmick, source: "fallback" });
      return res.json(gimmick);
    }
  });
}
