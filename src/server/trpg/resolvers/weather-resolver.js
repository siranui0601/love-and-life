/**
 * Canonical TRPG weather schedule.
 *
 * IMPORTANT: Weather is deliberately independent of save seed, player ID,
 * account, playthrough, and world instance. The same Day + region + daypart
 * always resolves to the same weather for every player and every loop.
 */

export const WEATHER_RULESET_VERSION = "canonical-weather-v1";

const DAYPART_ALIASES = Object.freeze({
  dawn: "morning",
  morning: "morning",
  day: "afternoon",
  noon: "afternoon",
  afternoon: "afternoon",
  dusk: "evening",
  evening: "evening",
  night: "night",
  midnight: "night",
  late_night: "night",
});

export const CANONICAL_WEATHER_DAYPARTS = Object.freeze([
  "morning",
  "afternoon",
  "evening",
  "night",
]);

export const WEATHER_DEFINITIONS = Object.freeze({
  clear: Object.freeze({
    id: "clear",
    label: "晴れ",
    tags: Object.freeze(["clear", "outdoor"]),
    travelTimeMultiplier: 1,
    encounterWeightMultiplier: 1,
    visibility: "good",
  }),
  cloudy: Object.freeze({
    id: "cloudy",
    label: "曇り",
    tags: Object.freeze(["cloudy", "outdoor"]),
    travelTimeMultiplier: 1,
    encounterWeightMultiplier: 1,
    visibility: "normal",
  }),
  light_rain: Object.freeze({
    id: "light_rain",
    label: "小雨",
    tags: Object.freeze(["rain", "wet", "outdoor"]),
    travelTimeMultiplier: 1.08,
    encounterWeightMultiplier: 0.96,
    visibility: "normal",
  }),
  rain: Object.freeze({
    id: "rain",
    label: "雨",
    tags: Object.freeze(["rain", "wet", "outdoor"]),
    travelTimeMultiplier: 1.18,
    encounterWeightMultiplier: 0.92,
    visibility: "reduced",
  }),
  fog: Object.freeze({
    id: "fog",
    label: "霧",
    tags: Object.freeze(["fog", "humid", "outdoor"]),
    travelTimeMultiplier: 1.14,
    encounterWeightMultiplier: 1.08,
    visibility: "poor",
  }),
  strong_wind: Object.freeze({
    id: "strong_wind",
    label: "強風",
    tags: Object.freeze(["wind", "outdoor"]),
    travelTimeMultiplier: 1.12,
    encounterWeightMultiplier: 0.98,
    visibility: "normal",
  }),
  snow: Object.freeze({
    id: "snow",
    label: "雪",
    tags: Object.freeze(["snow", "cold", "wet", "outdoor"]),
    travelTimeMultiplier: 1.3,
    encounterWeightMultiplier: 0.9,
    visibility: "reduced",
  }),
  storm: Object.freeze({
    id: "storm",
    label: "雷雨",
    tags: Object.freeze(["rain", "storm", "lightning", "wind", "outdoor"]),
    travelTimeMultiplier: 1.45,
    encounterWeightMultiplier: 0.82,
    visibility: "poor",
  }),
  dry_wind: Object.freeze({
    id: "dry_wind",
    label: "乾いた風",
    tags: Object.freeze(["dry", "wind", "outdoor"]),
    travelTimeMultiplier: 1.08,
    encounterWeightMultiplier: 1.02,
    visibility: "normal",
  }),
});

const GENERIC_PROFILE = Object.freeze({
  clear: 34,
  cloudy: 30,
  light_rain: 16,
  rain: 10,
  fog: 5,
  strong_wind: 4,
  storm: 1,
});

export const REGION_WEATHER_PROFILES = Object.freeze({
  "田園の村": Object.freeze({ clear: 44, cloudy: 28, light_rain: 16, rain: 7, fog: 4, strong_wind: 1 }),
  王都: Object.freeze({ clear: 34, cloudy: 34, light_rain: 15, rain: 10, fog: 4, strong_wind: 2, storm: 1 }),
  森: Object.freeze({ clear: 10, cloudy: 28, light_rain: 22, rain: 16, fog: 20, strong_wind: 2, storm: 2 }),
  交易都市: Object.freeze({ clear: 30, cloudy: 28, light_rain: 15, rain: 10, fog: 5, strong_wind: 10, storm: 2 }),
  犯罪都市: Object.freeze({ clear: 30, cloudy: 34, light_rain: 15, rain: 11, fog: 7, strong_wind: 2, storm: 1 }),
  ドワーフ洞窟: Object.freeze({ clear: 18, cloudy: 34, light_rain: 16, rain: 8, fog: 18, strong_wind: 5, storm: 1 }),
  北陵要塞: Object.freeze({ clear: 12, cloudy: 24, snow: 34, strong_wind: 20, fog: 6, storm: 4 }),
  辺境の村: Object.freeze({ clear: 40, cloudy: 20, light_rain: 8, rain: 4, strong_wind: 12, dry_wind: 15, storm: 1 }),
  古代神殿: Object.freeze({ clear: 22, cloudy: 28, light_rain: 12, rain: 8, fog: 22, strong_wind: 6, storm: 2 }),
  "エルフの隠れ里": Object.freeze({ clear: 14, cloudy: 28, light_rain: 20, rain: 13, fog: 21, strong_wind: 2, storm: 2 }),
  黒嶺連合領: Object.freeze({ clear: 24, cloudy: 28, light_rain: 10, rain: 8, fog: 6, strong_wind: 13, dry_wind: 8, storm: 3 }),
  魔王領: Object.freeze({ clear: 18, cloudy: 30, light_rain: 9, rain: 9, fog: 12, strong_wind: 10, dry_wind: 7, storm: 5 }),
});

const DAYPART_WEIGHT_BONUSES = Object.freeze({
  morning: Object.freeze({ fog: 7, clear: -3 }),
  afternoon: Object.freeze({ clear: 5, fog: -4 }),
  evening: Object.freeze({ cloudy: 3, strong_wind: 2 }),
  night: Object.freeze({ fog: 3, cloudy: 2, clear: -2 }),
});

function stableHash32(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function weightedEntries(profile, daypart) {
  const bonuses = DAYPART_WEIGHT_BONUSES[daypart] ?? {};
  return Object.entries(profile)
    .map(([id, baseWeight]) => [id, Math.max(0, Number(baseWeight) + Number(bonuses[id] ?? 0))])
    .filter(([id, weight]) => WEATHER_DEFINITIONS[id] && weight > 0);
}

function weightedPick(entries, roll) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!(total > 0)) return "clear";
  let cursor = roll * total;
  for (const [id, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return id;
  }
  return entries.at(-1)?.[0] ?? "clear";
}

export function normalizeWeatherDaypart(value) {
  const normalized = DAYPART_ALIASES[String(value ?? "").trim().toLowerCase()];
  if (!normalized) throw new RangeError(`Unsupported weather daypart: ${value}`);
  return normalized;
}

export function canonicalWeatherScheduleKey({ day, regionId, daypart }) {
  const normalizedDay = Number(day);
  if (!Number.isInteger(normalizedDay) || normalizedDay < 1 || normalizedDay > 100) {
    throw new RangeError(`Weather day must be an integer from 1 to 100: ${day}`);
  }
  const normalizedRegion = String(regionId ?? "").trim() || "UNKNOWN";
  const normalizedDaypart = normalizeWeatherDaypart(daypart);
  return `${WEATHER_RULESET_VERSION}|day:${normalizedDay}|region:${normalizedRegion}|daypart:${normalizedDaypart}`;
}

export function resolveCanonicalWeather({ day, regionId, daypart }) {
  const scheduleKey = canonicalWeatherScheduleKey({ day, regionId, daypart });
  const normalizedRegion = String(regionId ?? "").trim() || "UNKNOWN";
  const normalizedDaypart = normalizeWeatherDaypart(daypart);
  const profile = REGION_WEATHER_PROFILES[normalizedRegion] ?? GENERIC_PROFILE;
  const roll = stableHash32(scheduleKey) / 0x100000000;
  const weatherId = weightedPick(weightedEntries(profile, normalizedDaypart), roll);
  const weather = WEATHER_DEFINITIONS[weatherId] ?? WEATHER_DEFINITIONS.clear;
  return Object.freeze({
    ...weather,
    tags: [...weather.tags],
    day: Number(day),
    regionId: normalizedRegion,
    daypart: normalizedDaypart,
    scheduleKey,
    rulesetVersion: WEATHER_RULESET_VERSION,
  });
}

export function canonicalWeatherDay({ day, regionId }) {
  return Object.fromEntries(CANONICAL_WEATHER_DAYPARTS.map((daypart) => [
    daypart,
    resolveCanonicalWeather({ day, regionId, daypart }),
  ]));
}
