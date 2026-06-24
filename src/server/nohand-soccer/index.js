import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { appendNoHandSoccerGimmickEntry } from "../../foundation/sheets.js";

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

const EFFECT_LABELS = {
  impulse: "衝撃",
  bounce: "反発",
  flow: "流れ",
  attract: "引力",
  repel: "反力",
  lift: "浮上",
  dampen: "減速",
  curve: "曲げ",
  platform: "足場",
  rotate: "回転",
  portal: "転送",
  phase: "透過",
};

const EFFECT_SHORT = {
  impulse: "ボールを勢いよく飛ばす",
  bounce: "ボールを跳ね返す",
  flow: "範囲内のボールを流す",
  attract: "ボールを引き寄せる",
  repel: "ボールを押しのける",
  lift: "ボールを浮かせる",
  dampen: "ボールの勢いを弱める",
  curve: "ボールの軌道を曲げる",
  platform: "ボールを受け止める",
  rotate: "回転してボールを弾く",
  portal: "ボールを別地点へ逃がす",
  phase: "ボールをすり抜け気味に浮かせる",
};

const SHAPES = ["point", "line", "area", "gate", "fan", "platform"];

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

function normalizeEffectType(type, fallback = "impulse") {
  const raw = String(type || "").toLowerCase();
  if (EFFECT_TYPES.includes(raw)) return raw;
  if (/launch|kick|shoot|impulse|push|blast|発射|蹴|飛|押/.test(raw)) return "impulse";
  if (/bounce|jump|spring|反発|跳|弾/.test(raw)) return "bounce";
  if (/wind|flow|current|stream|風|流/.test(raw)) return "flow";
  if (/attract|pull|magnet|suck|吸|引|磁/.test(raw)) return "attract";
  if (/repel|away|pushout|反|退|離/.test(raw)) return "repel";
  if (/lift|float|up|cloud|浮|上|持/.test(raw)) return "lift";
  if (/slow|stop|dampen|brake|減速|止/.test(raw)) return "dampen";
  if (/curve|bend|spin|swerve|曲|偏/.test(raw)) return "curve";
  if (/platform|slope|wall|rail|line|坂|壁|板|床|レール/.test(raw)) return "platform";
  if (/rotate|turn|gear|回/.test(raw)) return "rotate";
  if (/portal|warp|teleport|door|ワープ|扉|穴/.test(raw)) return "portal";
  if (/phase|ghost|pass|透|幽/.test(raw)) return "phase";
  return fallback;
}

function normalizeShape(shape, effects) {
  const raw = String(shape || "").toLowerCase();
  if (SHAPES.includes(raw)) return raw;
  if (effects.some((effect) => effect.type === "platform" || effect.type === "rotate")) return "line";
  if (effects.some((effect) => effect.type === "portal" || effect.type === "phase")) return "gate";
  if (effects.some((effect) => ["flow", "attract", "repel", "lift", "curve", "dampen"].includes(effect.type))) return "area";
  return "point";
}

function localFallback(emojis = []) {
  const seed = hash(emojis.join("|"));
  const first = pick(EFFECT_TYPES, seed);
  const second = pick(EFFECT_TYPES.filter((type) => type !== first), seed >>> 4);
  const effects = [
    { type: first, strength: 0.55, range: 0.55, direction: "angle" },
    { type: second, strength: 0.32, range: 0.42, direction: "angle" },
  ];
  return {
    name: `審議中${emojis.join("")}`.slice(0, 24),
    flavor: `${emojis.join("")}から生まれたボール細工。`,
    visualLabel: pick(["装置", "細工", "仕掛け", "ゲート", "足場", "流れ"], seed >>> 7),
    shortEffect: `${EFFECT_SHORT[first]}＋${EFFECT_SHORT[second]}`.slice(0, 42),
    shape: normalizeShape("", effects),
    effects,
  };
}

function normalizeEffects(rawEffects, fallbackEffects) {
  const list = Array.isArray(rawEffects) ? rawEffects : [];
  const normalized = list.slice(0, 4).map((effect, index) => {
    const fallback = fallbackEffects[index] || fallbackEffects[0] || { type: "impulse", strength: 0.5, range: 0.5, direction: "angle" };
    return {
      type: normalizeEffectType(effect?.type, fallback.type),
      strength: normalizeNumber(effect?.strength, fallback.strength ?? 0.5, 0.05, 1),
      range: normalizeNumber(effect?.range, fallback.range ?? 0.5, 0.05, 1),
      direction: normalizeString(effect?.direction, fallback.direction || "angle", 18),
    };
  }).filter((effect) => effect.type);
  return normalized.length ? normalized : fallbackEffects;
}

function looksMostlyEnglish(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  const jp = (s.match(/[ぁ-んァ-ン一-龥]/g) || []).length;
  return latin >= 5 && latin > jp * 2;
}

function japaneseFallbackText(result, emojis) {
  const effectLabels = result.effects.map((effect) => EFFECT_LABELS[effect.type] || effect.type);
  const primary = result.effects[0]?.type || "impulse";
  return {
    name: `${emojis.join("")}の${effectLabels[0] || "細工"}`.slice(0, 24),
    visualLabel: result.visualLabel && !looksMostlyEnglish(result.visualLabel) ? result.visualLabel : (EFFECT_LABELS[primary] || "装置"),
    shortEffect: result.effects.map((effect) => EFFECT_SHORT[effect.type] || "ボールを動かす").join("＋").slice(0, 42),
  };
}

function normalizeResult(raw, fallback, emojis) {
  const effects = normalizeEffects(raw?.effects, fallback.effects);
  const base = {
    name: normalizeString(raw?.name, fallback.name, 24),
    flavor: normalizeString(raw?.flavor, fallback.flavor, 80),
    visualLabel: normalizeString(raw?.visualLabel, fallback.visualLabel, 12),
    shortEffect: normalizeString(raw?.shortEffect, fallback.shortEffect, 42),
    shape: normalizeShape(raw?.shape, effects),
    effects,
  };
  if (looksMostlyEnglish(base.name) || looksMostlyEnglish(base.shortEffect)) {
    const jp = japaneseFallbackText(base, emojis);
    return {
      ...base,
      name: jp.name,
      visualLabel: jp.visualLabel,
      shortEffect: jp.shortEffect,
      flavor: looksMostlyEnglish(base.flavor) ? `${emojis.join(" ")}から生まれたボール細工。` : base.flavor,
    };
  }
  return base;
}

function buildSheetDescription(emojis, result) {
  const effects = result.effects.map((effect) => EFFECT_LABELS[effect.type] || effect.type).join("＋");
  return `絵文字:${emojis.join(" ")} / ${result.name} / ${result.visualLabel} / ${effects} / ${result.shortEffect}`;
}

export function mountNoHandSoccerRoutes(app) {
  app.post("/api/nohand-soccer/gimmick", async (req, res) => {
    const emojis = Array.isArray(req.body?.emojis) ? req.body.emojis.slice(0, 3).map(String) : [];

    if (emojis.length !== 3 || emojis.some((emoji) => !emoji.trim())) {
      return res.status(400).json({ error: "emojis must contain exactly 3 items." });
    }

    const fallback = localFallback(emojis);
    const prompt = `絵文字3つから、ボールを動かすギミックを生成。必ず日本語。絵文字:${emojis.join(" ")}。JSONのみ:{"name":"","flavor":"","visualLabel":"","shortEffect":"","shape":"point|line|area|gate|fan|platform","effects":[{"type":"","strength":0.5,"range":0.5,"direction":"angle"}]}`;

    let result;
    try {
      const text = await genWithFallback(prompt, {
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.9,
        },
      });
      const parsed = JSON.parse(stripJsonFence(text));
      result = normalizeResult(parsed, fallback, emojis);
    } catch (error) {
      console.warn("[noHand-soccer] Gemini gimmick fallback", error);
      result = { ...fallback, source: "fallback" };
    }

    try {
      await appendNoHandSoccerGimmickEntry({
        description: buildSheetDescription(emojis, result),
        emojis,
        gimmick: result,
      });
    } catch (sheetError) {
      console.warn("[noHand-soccer] sheet append skipped", sheetError);
    }

    return res.json(result);
  });
}
