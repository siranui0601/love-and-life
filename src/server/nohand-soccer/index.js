import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { appendNoHandSoccerGimmickLog } from "./sheet-log.js";

const MOTOR_KINDS = [
  "launcher",
  "bumper",
  "fieldForce",
  "gravityShift",
  "split",
  "portal",
  "rail",
  "carrier",
  "flipper",
  "phase",
  "dragZone",
  "timerRelease",
];

const LEGACY_KIND_MAP = {
  kick: "launcher",
  cannon: "launcher",
  spring: "launcher",
  wind: "fieldForce",
  updraft: "fieldForce",
  vortex: "fieldForce",
  current: "fieldForce",
  antiFall: "fieldForce",
  redirect: "launcher",
  mirror: "bumper",
  curve: "fieldForce",
  oneWay: "rail",
  tether: "fieldForce",
  orbit: "fieldForce",
  catchRelease: "timerRelease",
  pendulum: "flipper",
  gravityFlip: "gravityShift",
  slow: "dragZone",
  speedFloor: "fieldForce",
};

const BODY_SHAPES = ["point", "line", "area", "fan", "gate", "rail", "carrier", "arm", "platform"];
const BODY_MOTIONS = ["none", "spin", "slide", "bob", "swing", "orbit", "pendulum"];
const TRIGGERS = ["contact", "inside", "enter", "periodic", "timer"];
const DIRECTIONS = ["angle", "up", "down", "left", "right", "radialIn", "radialOut", "tangent", "towardNextGoal", "awayFromBall"];
const EXIT_DIRECTIONS = ["angle", "towardNextGoal", "radialOut", "up", "left", "right"];
const PATH_NEED_KINDS = ["fieldForce", "gravityShift", "dragZone", "rail", "carrier", "timerRelease"];
const SHOWY_KINDS = ["launcher", "bumper", "gravityShift", "split", "portal", "flipper", "timerRelease"];

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

function normalizeKind(kind, fallback = "launcher") {
  const raw = String(kind || "").trim();
  const lower = raw.toLowerCase();
  if (MOTOR_KINDS.includes(raw)) return raw;
  if (LEGACY_KIND_MAP[raw]) return LEGACY_KIND_MAP[raw];
  if (LEGACY_KIND_MAP[lower]) return LEGACY_KIND_MAP[lower];
  if (/split|clone|分裂|分身|複製/.test(lower)) return "split";
  if (/gravity|重力/.test(lower)) return "gravityShift";
  if (/portal|warp|door|ワープ|扉|穴/.test(lower)) return "portal";
  if (/rail|track|レール|軌道/.test(lower)) return "rail";
  if (/carrier|lift|move|運|リフト|台車/.test(lower)) return "carrier";
  if (/flipper|arm|pendulum|振り子|腕|叩/.test(lower)) return "flipper";
  if (/phase|ghost|pass|透|幽霊/.test(lower)) return "phase";
  if (/slow|drag|brake|減速|抵抗/.test(lower)) return "dragZone";
  if (/catch|hold|release|掴|捕|放/.test(lower)) return "timerRelease";
  if (/bumper|mirror|bounce|反射|反発/.test(lower)) return "bumper";
  if (/force|wind|flow|vortex|tether|風|流|渦|引|押/.test(lower)) return "fieldForce";
  return fallback;
}

function needsPath(kind) {
  return PATH_NEED_KINDS.includes(kind);
}

function defaultShapeForMotors(motors) {
  if (motors.some((m) => m.kind === "rail")) return "rail";
  if (motors.some((m) => m.kind === "carrier")) return "carrier";
  if (motors.some((m) => m.kind === "flipper")) return "arm";
  if (motors.some((m) => ["portal", "phase"].includes(m.kind))) return "gate";
  if (motors.some((m) => ["fieldForce", "gravityShift", "dragZone", "split"].includes(m.kind))) return "fan";
  return "point";
}

function defaultMotionForMotors(motors) {
  if (motors.some((m) => m.kind === "flipper")) return "pendulum";
  if (motors.some((m) => m.kind === "carrier")) return "slide";
  if (motors.some((m) => m.kind === "fieldForce" && ["tangent", "radialIn"].includes(m.direction))) return "spin";
  return "none";
}

function isSolidShape(shape, motors) {
  if (["rail", "platform", "line", "carrier", "arm"].includes(shape)) return true;
  return motors.some((m) => ["bumper", "rail", "carrier", "flipper"].includes(m.kind));
}

function defaultTrigger(kind) {
  return ["fieldForce", "gravityShift", "dragZone", "carrier", "rail"].includes(kind) ? "inside" : "contact";
}

function localFallback(emojis = []) {
  const seed = hash(emojis.join("|"));
  const first = pick(["launcher", "split", "gravityShift", "bumper", "portal", "flipper"], seed);
  const second = pick(["fieldForce", "rail", "carrier", "dragZone", "timerRelease"], seed >>> 5);
  const motors = normalizeMotors([
    { kind: first, trigger: "contact", direction: "angle", power: 0.78, range: 0.58, duration: 0.55, angle: 180, count: 2, spreadAngle: 38 },
    { kind: second, trigger: "inside", direction: "towardNextGoal", power: 0.55, range: 0.62, duration: 0.8, angle: 90, count: 2, spreadAngle: 38 },
  ]);
  const shape = defaultShapeForMotors(motors);
  return {
    name: `審議中${emojis.join("")}`.slice(0, 24),
    visualLabel: pick(["装置", "細工", "仕掛け", "ゲート", "足場", "分裂", "重力"], seed >>> 8),
    flavor: `${emojis.join("")}から生まれたボール細工。`,
    shortEffect: "触れると派手に動き、次の動きへつなげる。",
    body: { shape, solid: isSolidShape(shape, motors), size: 0.68, motion: defaultMotionForMotors(motors), motionPower: 0.65 },
    motors,
    exit: { direction: "towardNextGoal", minSpeed: 7.2, afterSeconds: 0.7, label: "出口補助" },
  };
}

function normalizeMotors(rawMotors, fallbackMotors = []) {
  const source = Array.isArray(rawMotors) ? rawMotors : [];
  const normalized = source.slice(0, 5).map((motor, index) => {
    const fallback = fallbackMotors[index] || fallbackMotors[0] || { kind: "launcher", trigger: "contact", direction: "angle", power: 0.78, range: 0.58, duration: 0.55, angle: 180, count: 2, spreadAngle: 38 };
    const kind = normalizeKind(motor?.kind, fallback.kind);
    return {
      kind,
      trigger: normalizeEnum(motor?.trigger, TRIGGERS, fallback.trigger || defaultTrigger(kind)),
      direction: normalizeEnum(motor?.direction, DIRECTIONS, fallback.direction || "angle"),
      power: normalizeNumber(motor?.power, fallback.power ?? 0.78, 0.18, 1),
      range: normalizeNumber(motor?.range, fallback.range ?? 0.58, 0.15, 1),
      duration: normalizeNumber(motor?.duration, fallback.duration ?? 0.65, 0.05, 3),
      angle: normalizeNumber(motor?.angle, fallback.angle ?? 180, -360, 360),
      count: Math.round(normalizeNumber(motor?.count, fallback.count ?? 2, 2, 4)),
      spreadAngle: normalizeNumber(motor?.spreadAngle, fallback.spreadAngle ?? 38, 10, 140),
      mode: normalizeString(motor?.mode, fallback.mode || "", 16),
    };
  });

  const motors = normalized.length ? normalized : fallbackMotors;
  if (!motors.length) motors.push({ kind: "launcher", trigger: "contact", direction: "angle", power: 0.78, range: 0.55, duration: 0.45, angle: 180, count: 2, spreadAngle: 38, mode: "" });
  if (motors.length === 1) {
    motors.push({ kind: needsPath(motors[0].kind) ? "launcher" : "fieldForce", trigger: "inside", direction: "towardNextGoal", power: 0.58, range: 0.65, duration: 0.8, angle: 0, count: 2, spreadAngle: 38, mode: "exit" });
  }
  if (!motors.some((m) => SHOWY_KINDS.includes(m.kind))) {
    motors.push({ kind: "launcher", trigger: "contact", direction: "angle", power: 0.72, range: 0.5, duration: 0.45, angle: 0, count: 2, spreadAngle: 38, mode: "assist" });
  }
  return motors.slice(0, 5);
}

function normalizeExit(rawExit, motors) {
  const risky = motors.some((m) => needsPath(m.kind));
  if (!risky && rawExit == null) return null;
  return {
    direction: normalizeEnum(rawExit?.direction, EXIT_DIRECTIONS, "towardNextGoal"),
    minSpeed: normalizeNumber(rawExit?.minSpeed, 7.2, 5.8, 11),
    afterSeconds: normalizeNumber(rawExit?.afterSeconds, 0.75, 0.25, 1.8),
    label: normalizeJapanese(rawExit?.label, "出口補助", 16),
  };
}

function normalizeBody(rawBody, motors, fallbackBody) {
  const fallbackShape = fallbackBody?.shape || defaultShapeForMotors(motors);
  const shape = normalizeEnum(rawBody?.shape, BODY_SHAPES, fallbackShape);
  const motion = normalizeEnum(rawBody?.motion, BODY_MOTIONS, fallbackBody?.motion || defaultMotionForMotors(motors));
  return {
    shape,
    solid: Boolean(rawBody?.solid ?? isSolidShape(shape, motors)),
    size: normalizeNumber(rawBody?.size, fallbackBody?.size ?? 0.68, 0.35, 1),
    motion,
    motionPower: normalizeNumber(rawBody?.motionPower, fallbackBody?.motionPower ?? 0.65, 0, 1),
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
    exit: normalizeExit(raw?.exit, motors),
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
    const prompt = `絵文字3つから、ユニークで個性的な派手に動くピタゴラ装置を生成。最低2 motors。JSONのみ:{"name":"","visualLabel":"","flavor":"","shortEffect":"","body":{"shape":"point|line|area|fan|gate|rail|carrier|arm|platform","solid":false,"size":0.7,"motion":"none|spin|slide|bob|swing|orbit|pendulum","motionPower":0.7},"motors":[{"kind":"launcher|bumper|fieldForce|gravityShift|split|portal|rail|carrier|flipper|phase|dragZone|timerRelease","trigger":"contact|inside|enter|periodic|timer","direction":"angle|up|down|left|right|radialIn|radialOut|tangent|towardNextGoal|awayFromBall","power":0.8,"range":0.7,"duration":0.8,"angle":180,"count":2,"spreadAngle":38,"mode":""}],"exit":{"direction":"angle|towardNextGoal|radialOut|up|left|right","minSpeed":7,"afterSeconds":0.8,"label":""}} 絵文字:${emojis.join(" ")}`;

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
