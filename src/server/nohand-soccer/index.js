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

const DEVICE_TYPES = [
  "launcherPad",
  "bumper",
  "gate",
  "rail",
  "carrier",
  "fan",
  "field",
  "flipper",
  "splitter",
  "gravityDevice",
  "catcher",
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

const DEVICE_LABELS = {
  launcherPad: "射出台",
  bumper: "反発台",
  gate: "ゲート",
  rail: "レール",
  carrier: "運搬台",
  fan: "送風機",
  field: "フィールド",
  flipper: "フリッパー",
  splitter: "分裂装置",
  gravityDevice: "重力装置",
  catcher: "捕球機",
};

const EMOJI_SEMANTICS = [
  { re: /💌|✉️|📩|📨|📧|💬|📝|📜/, role: "手紙", mechanic: "投函・通過・送り出し", motif: "封筒", tags: ["love", "gate"] },
  { re: /💄|💋|💅|👄/, role: "口紅スタンプ", mechanic: "押印・滑走・押し出し", motif: "口紅スタンプ", tags: ["love", "launcher"] },
  { re: /❤️|💖|💕|💘|💝|💞|💓|🫶|🌹|💍/, role: "恋の印", mechanic: "引き寄せ・反発・受け渡し", motif: "ハート飾り", tags: ["love", "gate"] },
  { re: /👫|👬|👭|🧑‍🤝‍🧑|👨🏼‍🤝‍👨🏾|🤝|🫂/, role: "ペアアーム", mechanic: "左右対称・同期・挟み込み", motif: "左右対称のアーム", tags: ["pair", "catcher"] },
  { re: /🚀|🛫|✈️|🏹|🔫|💣|🧨|🔥|⚡/, role: "推進力", mechanic: "発射・加速・射出", motif: "ノズル", tags: ["launcher"] },
  { re: /🧲|🪝|🕳️|🌀|🌪️/, role: "吸引源", mechanic: "吸引・渦・向き変更", motif: "吸引コア", tags: ["field"] },
  { re: /🌬️|💨|🪭|🍃|🌊|🫧/, role: "流れ", mechanic: "風・水流・押し流し", motif: "送風ファン", tags: ["fan", "field"] },
  { re: /🛞|🚗|🚕|🚙|🚚|🚃|🚂|🛻|🚜/, role: "乗り物", mechanic: "運搬・移動足場", motif: "車輪つき台", tags: ["carrier"] },
  { re: /🛤️|🪜|🛝|🧵|➰|〰️/, role: "道筋", mechanic: "誘導・レール・滑走", motif: "ガイドレール", tags: ["rail"] },
  { re: /🧱|🪨|🪵|🧊|🛡️|🔘|⚙️/, role: "硬い受け皿", mechanic: "反発・支持・衝突", motif: "硬い台座", tags: ["bumper"] },
  { re: /🐸|🦘|🐰|🐱|🐶|🐯|🐵/, role: "跳ねる生き物", mechanic: "跳躍・反発", motif: "弾む台", tags: ["bumper", "launcher"] },
  { re: /👻|🪄|✨|🔮|🧪|🧬/, role: "変化の魔力", mechanic: "分裂・位相変化", motif: "魔法コア", tags: ["splitter", "field"] },
  { re: /🌕|🌙|🪐|⭐|☄️|🧭/, role: "天体", mechanic: "重力・軌道・反転", motif: "重力リング", tags: ["gravity"] },
];

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
  const text = String(value || fallback || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
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

function normalizeDeviceType(value, fallback = "launcherPad") {
  const raw = String(value || "").trim();
  if (DEVICE_TYPES.includes(raw)) return raw;
  if (/gate|portal|door|門|ゲート|扉/.test(raw)) return "gate";
  if (/rail|レール|軌道/.test(raw)) return "rail";
  if (/carrier|lift|台車|運搬|足場/.test(raw)) return "carrier";
  if (/fan|wind|風|扇/.test(raw)) return "fan";
  if (/field|zone|場|範囲/.test(raw)) return "field";
  if (/flipper|arm|腕|フリッパ/.test(raw)) return "flipper";
  if (/split|分裂/.test(raw)) return "splitter";
  if (/gravity|重力/.test(raw)) return "gravityDevice";
  if (/catch|捕|受け止め/.test(raw)) return "catcher";
  if (/bumper|反発|跳ね/.test(raw)) return "bumper";
  return fallback;
}

function normalizeArray(value, fallback = [], maxItems = 5, itemMax = 28) {
  const source = Array.isArray(value) ? value : fallback;
  return source.map((item) => normalizeJapanese(item, "", itemMax)).filter(Boolean).slice(0, maxItems);
}

function semanticForEmoji(emoji, index = 0) {
  const found = EMOJI_SEMANTICS.find((entry) => entry.re.test(emoji));
  if (found) return { emoji, role: found.role, mechanic: found.mechanic, motif: found.motif, tags: found.tags };
  const fallbacks = [
    { role: "主役素材", mechanic: "接触・反応", motif: "中央パーツ", tags: ["launcher"] },
    { role: "補助素材", mechanic: "向き調整・支え", motif: "補助アーム", tags: ["field"] },
    { role: "仕上げ素材", mechanic: "受け渡し・変化", motif: "飾りパーツ", tags: ["gate"] },
  ];
  return { emoji, ...fallbacks[index % fallbacks.length] };
}

function emojiReadingFromEmojis(emojis = []) {
  return emojis.slice(0, 3).map((emoji, index) => {
    const item = semanticForEmoji(emoji, index);
    return { emoji: item.emoji, role: item.role, mechanic: item.mechanic };
  });
}

function fullSemanticReading(emojis = []) {
  return emojis.slice(0, 3).map((emoji, index) => semanticForEmoji(emoji, index));
}

function inferDeviceTypeFromSemantics(semantics, seed) {
  const tags = semantics.flatMap((item) => item.tags || []);
  const count = (tag) => tags.filter((item) => item === tag).length;
  if (count("love") && count("pair")) return "gate";
  if (count("carrier")) return "carrier";
  if (count("rail")) return "rail";
  if (count("gravity")) return "gravityDevice";
  if (count("splitter")) return "splitter";
  if (count("fan")) return "fan";
  if (count("field") >= 2) return "field";
  if (count("catcher") || count("pair")) return "catcher";
  if (count("bumper")) return "bumper";
  if (count("launcher")) return "launcherPad";
  return pick(["launcherPad", "gate", "bumper", "field"], seed);
}

function inferDeviceTypeFromMotors(motors, fallback = "launcherPad") {
  if (motors.some((m) => m.kind === "portal" || m.kind === "phase")) return "gate";
  if (motors.some((m) => m.kind === "rail")) return "rail";
  if (motors.some((m) => m.kind === "carrier")) return "carrier";
  if (motors.some((m) => m.kind === "flipper")) return "flipper";
  if (motors.some((m) => m.kind === "split")) return "splitter";
  if (motors.some((m) => m.kind === "gravityShift")) return "gravityDevice";
  if (motors.some((m) => m.kind === "timerRelease")) return "catcher";
  if (motors.some((m) => m.kind === "fieldForce" || m.kind === "dragZone")) return "field";
  if (motors.some((m) => m.kind === "bumper")) return "bumper";
  if (motors.some((m) => m.kind === "launcher")) return "launcherPad";
  return fallback;
}

function defaultShapeForDevice(deviceType) {
  return {
    launcherPad: "point",
    bumper: "point",
    gate: "gate",
    rail: "rail",
    carrier: "carrier",
    fan: "fan",
    field: "area",
    flipper: "arm",
    splitter: "gate",
    gravityDevice: "area",
    catcher: "gate",
  }[deviceType] || "point";
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

function motorsForDeviceType(deviceType, seed) {
  const base = {
    launcherPad: [
      { kind: "launcher", trigger: "contact", direction: "angle", power: 0.78, range: 0.42, duration: 0.35, angle: 0, count: 2, spreadAngle: 34, mode: "stamp" },
      { kind: "bumper", trigger: "contact", direction: "radialOut", power: 0.38, range: 0.32, duration: 0.2, angle: 0, count: 2, spreadAngle: 28, mode: "rim" },
    ],
    bumper: [
      { kind: "bumper", trigger: "contact", direction: "radialOut", power: 0.82, range: 0.42, duration: 0.25, angle: 0, count: 2, spreadAngle: 38, mode: "bounce" },
      { kind: "launcher", trigger: "contact", direction: "angle", power: 0.44, range: 0.32, duration: 0.25, angle: 0, count: 2, spreadAngle: 30, mode: "assist" },
    ],
    gate: [
      { kind: "timerRelease", trigger: "contact", direction: "angle", power: 0.5, range: 0.34, duration: 0.24, angle: 0, count: 2, spreadAngle: 32, mode: "hold" },
      { kind: "launcher", trigger: "timer", direction: "angle", power: 0.72, range: 0.34, duration: 0.16, angle: 0, count: 2, spreadAngle: 32, mode: "release" },
    ],
    rail: [
      { kind: "rail", trigger: "inside", direction: "angle", power: 0.55, range: 0.42, duration: 0.7, angle: 0, count: 2, spreadAngle: 38, mode: "guide" },
      { kind: "launcher", trigger: "contact", direction: "angle", power: 0.42, range: 0.34, duration: 0.25, angle: 0, count: 2, spreadAngle: 28, mode: "exit" },
    ],
    carrier: [
      { kind: "carrier", trigger: "contact", direction: "angle", power: 0.45, range: 0.36, duration: 0.8, angle: 0, count: 2, spreadAngle: 30, mode: "ride" },
      { kind: "launcher", trigger: "contact", direction: "angle", power: 0.36, range: 0.28, duration: 0.22, angle: 0, count: 2, spreadAngle: 28, mode: "drop" },
    ],
    fan: [
      { kind: "fieldForce", trigger: "inside", direction: "angle", power: 0.5, range: 0.55, duration: 0.7, angle: 0, count: 2, spreadAngle: 36, mode: "wind" },
      { kind: "dragZone", trigger: "inside", direction: "angle", power: 0.22, range: 0.45, duration: 0.4, angle: 0, count: 2, spreadAngle: 30, mode: "trim" },
    ],
    field: [
      { kind: "fieldForce", trigger: "inside", direction: pick(["radialIn", "radialOut", "tangent"], seed >>> 3), power: 0.42, range: 0.58, duration: 0.8, angle: 0, count: 2, spreadAngle: 38, mode: "field" },
      { kind: "dragZone", trigger: "inside", direction: "angle", power: 0.2, range: 0.44, duration: 0.4, angle: 0, count: 2, spreadAngle: 30, mode: "stabilize" },
    ],
    flipper: [
      { kind: "flipper", trigger: "contact", direction: "angle", power: 0.7, range: 0.4, duration: 0.55, angle: 0, count: 2, spreadAngle: 34, mode: "swing" },
      { kind: "launcher", trigger: "contact", direction: "angle", power: 0.52, range: 0.34, duration: 0.25, angle: 0, count: 2, spreadAngle: 30, mode: "hit" },
    ],
    splitter: [
      { kind: "split", trigger: "contact", direction: "angle", power: 0.62, range: 0.38, duration: 1.6, angle: 0, count: 2, spreadAngle: 34, mode: "copy" },
      { kind: "launcher", trigger: "contact", direction: "angle", power: 0.5, range: 0.32, duration: 0.25, angle: 0, count: 2, spreadAngle: 30, mode: "send" },
    ],
    gravityDevice: [
      { kind: "gravityShift", trigger: "inside", direction: "angle", power: 0.55, range: 0.55, duration: 1.2, angle: pick([-90, 0, 180, 270], seed >>> 4), count: 2, spreadAngle: 38, mode: "tilt" },
      { kind: "fieldForce", trigger: "inside", direction: "angle", power: 0.22, range: 0.42, duration: 0.5, angle: 0, count: 2, spreadAngle: 30, mode: "nudge" },
    ],
    catcher: [
      { kind: "timerRelease", trigger: "contact", direction: "angle", power: 0.58, range: 0.36, duration: 0.34, angle: 0, count: 2, spreadAngle: 32, mode: "catch" },
      { kind: "launcher", trigger: "timer", direction: "angle", power: 0.66, range: 0.34, duration: 0.18, angle: 0, count: 2, spreadAngle: 30, mode: "pass" },
    ],
  }[deviceType] || [];
  return normalizeMotors(base);
}

function visualLabelFromSemantics(semantics, deviceType) {
  const roles = semantics.map((item) => item.role).filter(Boolean);
  const label = `${roles[1] || roles[0] || "絵文字"}${roles[0] || "素材"}${DEVICE_LABELS[deviceType] || "装置"}`
    .replace(/の/g, "")
    .replace(/主役素材|補助素材|仕上げ素材/g, "")
    .replace(/装置装置/g, "装置");
  return normalizeJapanese(label, `${roles[0] || "絵文字"}${DEVICE_LABELS[deviceType] || "装置"}`, 20);
}

function visualMotifsFromSemantics(semantics) {
  return [...new Set(semantics.map((item) => item.motif).filter(Boolean))].slice(0, 5);
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
    motors.push({ kind: needsPath(motors[0].kind) ? "launcher" : "fieldForce", trigger: "inside", direction: "angle", power: 0.46, range: 0.48, duration: 0.55, angle: 0, count: 2, spreadAngle: 38, mode: "assist" });
  }
  if (!motors.some((m) => SHOWY_KINDS.includes(m.kind))) {
    motors.push({ kind: "launcher", trigger: "contact", direction: "angle", power: 0.58, range: 0.4, duration: 0.35, angle: 0, count: 2, spreadAngle: 38, mode: "assist" });
  }
  return motors.slice(0, 5);
}

function normalizeExit(rawExit, motors) {
  const risky = motors.some((m) => needsPath(m.kind));
  if (!risky && rawExit == null) return null;
  return {
    direction: normalizeEnum(rawExit?.direction, EXIT_DIRECTIONS, "radialOut"),
    minSpeed: normalizeNumber(rawExit?.minSpeed, 6.2, 4.8, 9),
    afterSeconds: normalizeNumber(rawExit?.afterSeconds, 1.4, 0.8, 2.4),
    label: "救済",
  };
}

function normalizeBody(rawBody, motors, fallbackBody, deviceType) {
  const fallbackShape = fallbackBody?.shape || defaultShapeForDevice(deviceType) || defaultShapeForMotors(motors);
  const shape = normalizeEnum(rawBody?.shape, BODY_SHAPES, fallbackShape);
  const motion = normalizeEnum(rawBody?.motion, BODY_MOTIONS, fallbackBody?.motion || defaultMotionForMotors(motors));
  return {
    shape,
    solid: Boolean(isSolidShape(shape, motors) || rawBody?.solid),
    size: normalizeNumber(rawBody?.size, fallbackBody?.size ?? 0.68, 0.35, 1),
    motion,
    motionPower: normalizeNumber(rawBody?.motionPower, fallbackBody?.motionPower ?? 0.55, 0, 1),
  };
}

function motorMainKinds(motors) {
  return [...new Set(motors.map((m) => m.kind))].slice(0, 3);
}

function directionText(direction) {
  return {
    angle: "向いている方向",
    up: "上",
    down: "下",
    left: "左",
    right: "右",
    radialIn: "中心",
    radialOut: "外側",
    tangent: "回転方向",
    towardNextGoal: "次のゴール方向",
    awayFromBall: "ボールから離れる方向",
  }[direction] || "向いている方向";
}

function describeMotor(motor) {
  const target = directionText(motor.direction);
  if (motor.kind === "launcher") return `触れると${target}へ押し出す`;
  if (motor.kind === "bumper") return `触れると${target}へ跳ね返す`;
  if (motor.kind === "fieldForce") return `近くのボールを${target}へ流す`;
  if (motor.kind === "gravityShift") return "範囲内で重力の向きを変える";
  if (motor.kind === "split") return "触れるとボールを分けて送り出す";
  if (motor.kind === "portal") return `触れると別地点へ通し、${target}へ出す`;
  if (motor.kind === "rail") return "近くのボールをレールに沿わせる";
  if (motor.kind === "carrier") return "乗ったボールを足場ごと運ぶ";
  if (motor.kind === "flipper") return "動く腕で触れたボールを叩く";
  if (motor.kind === "phase") return "触れたボールを一時的にすり抜け状態にする";
  if (motor.kind === "dragZone") return "近くのボールを少し減速して整える";
  if (motor.kind === "timerRelease") return "触れたボールを一瞬受け止めて放す";
  return "ボールの動きを変える";
}

function describeMotors(motors, context = {}) {
  const parts = motorMainKinds(motors).map((kind) => describeMotor(motors.find((m) => m.kind === kind))).filter(Boolean);
  let text = parts.slice(0, 2).join("。");
  if (context.visualMotifs?.[0] && ["timerRelease", "launcher"].every((kind) => motors.some((m) => m.kind === kind))) {
    text = `${context.visualMotifs[0]}を通すように一瞬受け止め、${directionText(motors.find((m) => m.kind === "launcher")?.direction)}へ押し出す`;
  }
  return normalizeJapanese(text, "触れると向いている方向へ押し出す。", 54);
}

function conceptKeyFor({ emojis, visualLabel, deviceType, motors }) {
  return [
    emojis.join(""),
    visualLabel,
    deviceType,
    motorMainKinds(motors).join("+"),
  ].join("|");
}

function localFallback(emojis = []) {
  const seed = hash(emojis.join("|"));
  const semantics = fullSemanticReading(emojis);
  const deviceType = inferDeviceTypeFromSemantics(semantics, seed);
  const motors = motorsForDeviceType(deviceType, seed);
  const shape = defaultShapeForDevice(deviceType);
  const visualMotifs = visualMotifsFromSemantics(semantics);
  const visualLabel = visualLabelFromSemantics(semantics, deviceType);
  const motionIdea = `${visualMotifs.join("・") || "絵文字素材"}を使い、${describeMotors(motors)}。`;
  const body = { shape, solid: isSolidShape(shape, motors), size: 0.68, motion: defaultMotionForMotors(motors), motionPower: 0.6 };
  const result = {
    name: emojis.join(""),
    visualLabel,
    deviceType,
    emojiReading: emojiReadingFromEmojis(emojis),
    visualMotifs,
    motionIdea,
    flavor: `${visualMotifs.join("・") || emojis.join("")}から生まれた${DEVICE_LABELS[deviceType] || "装置"}。`,
    body,
    motors,
    exit: normalizeExit(null, motors),
  };
  result.mainMotorKinds = motorMainKinds(motors);
  result.shortEffect = describeMotors(motors, result);
  result.conceptKey = conceptKeyFor({ emojis, visualLabel, deviceType, motors });
  return result;
}

function normalizeEmojiReading(rawReading, fallbackReading, emojis) {
  const fallback = fallbackReading?.length ? fallbackReading : emojiReadingFromEmojis(emojis);
  const source = Array.isArray(rawReading) ? rawReading : fallback;
  return emojis.slice(0, 3).map((emoji, index) => {
    const item = source[index] || fallback[index] || {};
    return {
      emoji,
      role: normalizeJapanese(item.role, fallback[index]?.role || "素材", 18),
      mechanic: normalizeJapanese(item.mechanic, fallback[index]?.mechanic || "反応", 24),
    };
  });
}

function normalizeResult(raw, fallback, emojis) {
  const fallbackDevice = fallback.deviceType || inferDeviceTypeFromMotors(fallback.motors || []);
  const motors = normalizeMotors(raw?.motors || raw?.effects, fallback.motors || fallback.effects || []);
  const deviceType = normalizeDeviceType(raw?.deviceType, inferDeviceTypeFromMotors(motors, fallbackDevice));
  const body = normalizeBody(raw?.body || { shape: raw?.shape }, motors, fallback.body, deviceType);
  const emojiReading = normalizeEmojiReading(raw?.emojiReading, fallback.emojiReading, emojis);
  const visualMotifs = normalizeArray(raw?.visualMotifs, fallback.visualMotifs, 5, 18);
  const visualLabel = normalizeJapanese(raw?.visualLabel, fallback.visualLabel, 20);
  const motionIdea = normalizeJapanese(raw?.motionIdea, fallback.motionIdea, 90);
  const result = {
    name: emojis.join(""),
    visualLabel,
    deviceType,
    emojiReading,
    visualMotifs,
    motionIdea,
    flavor: normalizeJapanese(raw?.flavor, fallback.flavor, 90),
    body,
    motors,
    exit: normalizeExit(raw?.exit, motors),
  };
  result.mainMotorKinds = motorMainKinds(motors);
  result.shortEffect = describeMotors(motors, result);
  result.conceptKey = conceptKeyFor({ emojis, visualLabel, deviceType, motors });
  return result;
}

function buildPrompt(emojis, fallback) {
  return `絵文字3つから、その組み合わせだからこそ成立するピタゴラ装置を設計する。
目的: ボールを直接操作せず、装置の見た目・構造・物理効果が一致するギミックJSONを返す。
重要:
- name と shortEffect は出力しない。表示名と効果説明はシステム側で作る。
- visualLabel は「ゲート」「装置」「細工」だけの抽象語は禁止。絵文字由来の固有コンセプト名にする。
- 3つの絵文字それぞれを emojiReading に必ず反映する。
- visualMotifs は画像生成で使う見た目の要素。絵文字由来の具体物を入れる。
- motionIdea は「なぜその見た目でその動きをするのか」が分かる1文。
- deviceType と body.shape と motors は矛盾させない。
- towardNextGoal は原則使わず、プレイヤーが角度調整できる angle / radialIn / radialOut / tangent を優先する。
- 数値は控えめ。永久加速、永続生成、即クリア、スコア直接加算は禁止。

deviceType候補: ${DEVICE_TYPES.join("|")}
shape候補: ${BODY_SHAPES.join("|")}
motor kind候補: ${MOTOR_KINDS.join("|")}

返答JSON形式:
{
  "visualLabel": "例: 口紅封筒ペアゲート",
  "deviceType": "gate",
  "emojiReading": [
    {"emoji":"${emojis[0]}","role":"封筒","mechanic":"投函・通過"},
    {"emoji":"${emojis[1]}","role":"口紅スタンプ","mechanic":"押印・押し出し"},
    {"emoji":"${emojis[2]}","role":"ペアアーム","mechanic":"左右対称に挟む"}
  ],
  "visualMotifs": ["封筒","口紅スタンプ","左右対称のペアアーム"],
  "motionIdea": "中央を通るボールを一瞬受け止め、口紅スタンプを押すように前方へ押し出す。",
  "flavor": "短い雰囲気説明",
  "body": {"shape":"gate","solid":false,"size":0.7,"motion":"none","motionPower":0.5},
  "motors": [
    {"kind":"timerRelease","trigger":"contact","direction":"angle","power":0.55,"range":0.36,"duration":0.25,"angle":0,"count":2,"spreadAngle":34,"mode":"catch"},
    {"kind":"launcher","trigger":"timer","direction":"angle","power":0.7,"range":0.34,"duration":0.18,"angle":0,"count":2,"spreadAngle":34,"mode":"release"}
  ],
  "exit": null
}

参考fallback: ${JSON.stringify({ visualLabel: fallback.visualLabel, deviceType: fallback.deviceType, visualMotifs: fallback.visualMotifs, motionIdea: fallback.motionIdea })}
絵文字: ${emojis.join(" ")}`;
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
    const prompt = buildPrompt(emojis, fallback);

    try {
      const text = await genWithFallback(prompt, {
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.92,
        },
      });
      const parsed = JSON.parse(stripJsonFence(text));
      const gimmick = normalizeResult(parsed, fallback, emojis);
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
