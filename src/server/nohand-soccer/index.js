import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { appendNoHandSoccerGimmickLog } from "./sheet-log.js";

const EFFECT_TYPES = [
  "impulse",
  "bounce",
  "flow",
  "attract",
  "repel",
  "lift",
  "dampen",
  "curve",
  "platform",
  "rotate",
  "portal",
  "phase",
];

const SHAPES = ["point", "line", "area", "gate", "fan", "platform"];
const ACTIVE_TYPES = ["impulse", "bounce", "flow", "attract", "repel", "lift", "curve", "rotate", "portal", "phase"];
const PITAGORA_HELPERS = ["flow", "lift", "curve", "bounce", "repel", "attract", "rotate", "portal", "phase"];
const CONTACT_TYPES = ["impulse", "bounce", "portal", "phase"];
const AREA_TYPES = ["flow", "attract", "repel", "lift", "curve", "dampen"];
const LINE_TYPES = ["platform", "rotate"];

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

function normalizeNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeJapanese(value, fallback, maxLength) {
  const text = normalizeString(value, fallback, maxLength);
  if (/[ぁ-んァ-ン一-龥]/.test(text)) return text;
  return normalizeString(fallback, "ボールの動きを変える。", maxLength);
}

function normalizeEffectType(type, fallback = "impulse") {
  const raw = String(type || "").toLowerCase();
  if (EFFECT_TYPES.includes(raw)) return raw;
  if (/launch|kick|shoot|impulse|push|blast|発射|蹴|飛|押|加速|boost|spring|バネ|jump/.test(raw)) return "impulse";
  if (/bounce|bumper|反発|跳|弾/.test(raw)) return "bounce";
  if (/wind|flow|current|stream|fan|風|流|送風/.test(raw)) return "flow";
  if (/attract|pull|magnet|suck|吸|引|磁/.test(raw)) return "attract";
  if (/repel|away|pushout|反|退|離/.test(raw)) return "repel";
  if (/lift|float|up|cloud|anti|浮|上|持|反重力/.test(raw)) return "lift";
  if (/slow|stop|dampen|brake|減速|止/.test(raw)) return "dampen";
  if (/curve|bend|spin|swerve|orbit|vortex|渦|曲|偏|旋回/.test(raw)) return "curve";
  if (/platform|slope|wall|rail|line|ramp|坂|壁|板|床|レール/.test(raw)) return "platform";
  if (/rotate|turn|gear|回/.test(raw)) return "rotate";
  if (/portal|warp|teleport|door|gate|ワープ|扉|穴/.test(raw)) return "portal";
  if (/phase|ghost|pass|透|幽/.test(raw)) return "phase";
  return fallback;
}

function effectFamily(type) {
  if (CONTACT_TYPES.includes(type)) return "contact";
  if (AREA_TYPES.includes(type)) return "area";
  if (LINE_TYPES.includes(type)) return "line";
  return "contact";
}

function minStrengthFor(type) {
  if (["impulse", "bounce", "portal", "phase"].includes(type)) return 0.86;
  if (["flow", "repel", "lift", "rotate"].includes(type)) return 0.68;
  if (["attract", "curve"].includes(type)) return 0.62;
  return 0.5;
}

function minRangeFor(type) {
  if (AREA_TYPES.includes(type)) return 0.66;
  if (LINE_TYPES.includes(type)) return 0.5;
  return 0.38;
}

function inferShape(effects) {
  if (effects.some((effect) => LINE_TYPES.includes(effect.type))) return "line";
  if (effects.some((effect) => ["portal", "phase"].includes(effect.type))) return "gate";
  if (effects.some((effect) => effect.type === "flow")) return "fan";
  if (effects.some((effect) => AREA_TYPES.includes(effect.type))) return "area";
  return "point";
}

function normalizeShape(shape, effects) {
  const raw = String(shape || "").toLowerCase();
  const inferred = inferShape(effects);
  if ((raw === "line" || raw === "platform") && inferred !== "line") return inferred;
  if (SHAPES.includes(raw)) return raw;
  return inferred;
}

function localFallback(emojis = []) {
  const seed = hash(emojis.join("|"));
  const first = pick(ACTIVE_TYPES, seed);
  const second = pick(PITAGORA_HELPERS.filter((type) => type !== first), seed >>> 5);
  const third = pick(PITAGORA_HELPERS.filter((type) => type !== first && type !== second), seed >>> 9);
  const effects = enrichEffects([
    { type: first, strength: 0.78, range: 0.58, direction: "angle" },
    { type: second, strength: 0.55, range: 0.56, direction: pick(["angle", "up", "toward", "away"], seed >>> 3) },
    { type: third, strength: 0.42, range: 0.5, direction: "angle" },
  ], seed);
  return {
    name: `審議中${emojis.join("")}`.slice(0, 24),
    flavor: `${emojis.join("")}から生まれたボール細工。`,
    visualLabel: pick(["装置", "細工", "仕掛け", "ゲート", "足場", "流れ"], seed >>> 7),
    shortEffect: describeEffects(effects),
    shape: inferShape(effects),
    effects,
  };
}

function normalizeEffects(rawEffects, fallbackEffects, seed) {
  const list = Array.isArray(rawEffects) ? rawEffects : [];
  const normalized = list.slice(0, 5).map((effect, index) => {
    const fallback = fallbackEffects[index] || fallbackEffects[0] || { type: "impulse", strength: 0.72, range: 0.55, direction: "angle" };
    return {
      type: normalizeEffectType(effect?.type, fallback.type),
      strength: normalizeNumber(effect?.strength, fallback.strength ?? 0.7, 0.05, 1),
      range: normalizeNumber(effect?.range, fallback.range ?? 0.55, 0.05, 1),
      direction: normalizeString(effect?.direction, fallback.direction || "angle", 18),
    };
  }).filter((effect) => effect.type);
  return enrichEffects(normalized.length ? normalized : fallbackEffects, seed);
}

function enrichEffects(effects, seed) {
  const seen = new Set();
  let list = effects
    .map((effect) => ({ ...effect, type: normalizeEffectType(effect.type) }))
    .filter((effect) => {
      const key = `${effectFamily(effect.type)}:${effect.type}`;
      if (seen.has(key) && effects.length > 2) return false;
      seen.add(key);
      return true;
    });

  if (!list.some((effect) => ACTIVE_TYPES.includes(effect.type))) {
    list.unshift({ type: pick(["impulse", "flow", "bounce", "repel", "lift"], seed), strength: 0.85, range: 0.6, direction: "angle" });
  }

  const families = new Set(list.map((effect) => effectFamily(effect.type)));
  while (list.length < 3 || families.size < 2) {
    const type = pick(PITAGORA_HELPERS.filter((candidate) => !list.some((effect) => effect.type === candidate)), seed >>> (list.length * 5));
    list.push({
      type,
      strength: 0.52 + ((seed >>> list.length) % 24) / 100,
      range: 0.52 + ((seed >>> (list.length + 3)) % 28) / 100,
      direction: pick(["angle", "up", "toward", "away"], seed >>> (list.length + 6)),
    });
    families.add(effectFamily(type));
  }

  return list.slice(0, 5).map((effect, index) => ({
    ...effect,
    strength: normalizeNumber(Math.max(effect.strength, minStrengthFor(effect.type)) + ((seed >>> (index + 2)) % 8) / 100, 0.78, 0.05, 1),
    range: normalizeNumber(Math.max(effect.range, minRangeFor(effect.type)) + ((seed >>> (index + 7)) % 8) / 100, 0.6, 0.05, 1),
    direction: normalizeString(effect.direction, "angle", 18),
    phase: ((seed >>> (index + 11)) % 100) / 100,
  }));
}

function describeEffects(effects) {
  const labels = {
    impulse: "強く飛ばす",
    bounce: "跳ね返す",
    flow: "流す",
    attract: "引き寄せる",
    repel: "押し返す",
    lift: "浮かせる",
    dampen: "勢いを整える",
    curve: "軌道を曲げる",
    platform: "受け止める",
    rotate: "回して弾く",
    portal: "転送する",
    phase: "すり抜け気味に浮かす",
  };
  return effects.slice(0, 3).map((effect) => labels[effect.type] || "動きを変える").join("＋");
}

function normalizeResult(raw, fallback, emojis) {
  const seed = hash(emojis.join("|"));
  const effects = normalizeEffects(raw?.effects, fallback.effects, seed);
  return {
    name: normalizeJapanese(raw?.name, fallback.name, 24),
    flavor: normalizeJapanese(raw?.flavor, fallback.flavor, 80),
    visualLabel: normalizeJapanese(raw?.visualLabel, fallback.visualLabel, 12),
    shortEffect: normalizeJapanese(raw?.shortEffect, describeEffects(effects), 42),
    shape: normalizeShape(raw?.shape, effects),
    effects,
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
    const prompt = `絵文字3つから、ボールを動かすギミックを生成。日本語で。絵文字:${emojis.join(" ")}。JSONのみ:{"name":"","flavor":"","visualLabel":"","shortEffect":"","shape":"point|line|area|gate|fan|platform","effects":[{"type":"","strength":0.5,"range":0.5,"direction":"angle"}]}`;

    try {
      const text = await genWithFallback(prompt, {
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.95,
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
