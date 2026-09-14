/**
 * Canonical TRPG weather.
 *
 * Weather is read out of `../content/weather-almanac.js` — a written table of all
 * 100 days for all 12 regions.  It is not rolled, not weighted, and not derived
 * from a seed: the sky over a region on a given day is the same for every
 * player, every playthrough and every replay because somebody wrote it down.
 *
 * The almanac stores a whole day as ordered segments ("cloudy;15=rain"), so a
 * day holds together — morning fog burns off into afternoon cloud, rain arrives
 * at a stated hour and passes.  The four dayparts are sampled from that day
 * rather than drawn independently, which is what previously allowed a clear
 * morning to be followed by an afternoon storm and a clear evening.
 */

import { WEATHER_ALMANAC } from "../content/weather-almanac.js";

export const WEATHER_RULESET_VERSION = "canonical-weather-almanac-v2";

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

/** Fallback for a region with no almanac page (never true for canonical regions). */
const FALLBACK_PATTERN = "cloudy";

/** The hour each daypart is read at.  A daypart is a window; this is its centre. */
export const DAYPART_SAMPLE_HOUR = Object.freeze({
  morning: 7,
  afternoon: 13,
  evening: 19,
  night: 23,
});

function almanacPattern(regionId, day) {
  const page = WEATHER_ALMANAC[regionId];
  if (!page) return FALLBACK_PATTERN;
  return page[day - 1] ?? FALLBACK_PATTERN;
}

/**
 * Splits "cloudy;15=rain" into [{ fromHour: 0, id: "cloudy" }, { fromHour: 15, id: "rain" }].
 * Unknown ids are dropped rather than silently rendered, so a typo in the table
 * surfaces as clear weather instead of an undefined read downstream.
 */
export function parseWeatherPattern(pattern) {
  const segments = [];
  String(pattern ?? "").split(";").forEach((part, index) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    if (index === 0) {
      if (WEATHER_DEFINITIONS[trimmed]) segments.push({ fromHour: 0, id: trimmed });
      return;
    }
    const [hour, id] = trimmed.split("=");
    const parsedHour = Number(hour);
    if (!WEATHER_DEFINITIONS[id] || !Number.isInteger(parsedHour)) return;
    segments.push({ fromHour: Math.max(0, Math.min(23, parsedHour)), id });
  });
  if (!segments.length || segments[0].fromHour !== 0) segments.unshift({ fromHour: 0, id: "cloudy" });
  return segments.sort((left, right) => left.fromHour - right.fromHour);
}

function weatherIdAtHour(regionId, day, hour) {
  const segments = parseWeatherPattern(almanacPattern(regionId, day));
  let current = segments[0].id;
  for (const segment of segments) {
    if (segment.fromHour <= hour) current = segment.id;
    else break;
  }
  return current;
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
  const hour = DAYPART_SAMPLE_HOUR[normalizedDaypart];
  const weatherId = weatherIdAtHour(normalizedRegion, Number(day), hour);
  const weather = WEATHER_DEFINITIONS[weatherId] ?? WEATHER_DEFINITIONS.clear;
  return Object.freeze({
    ...weather,
    tags: [...weather.tags],
    day: Number(day),
    regionId: normalizedRegion,
    daypart: normalizedDaypart,
    hour,
    scheduleKey,
    rulesetVersion: WEATHER_RULESET_VERSION,
  });
}

/**
 * Hour-precise read.  The almanac states when rain starts, so a scene at 15:00
 * can ask directly instead of rounding to a daypart.
 */
export function resolveCanonicalWeatherAt({ day, regionId, hour }) {
  const normalizedRegion = String(regionId ?? "").trim() || "UNKNOWN";
  const normalizedHour = Math.max(0, Math.min(23, Math.floor(Number(hour) || 0)));
  const normalizedDay = Number(day);
  if (!Number.isInteger(normalizedDay) || normalizedDay < 1 || normalizedDay > 100) {
    throw new RangeError(`Weather day must be an integer from 1 to 100: ${day}`);
  }
  const weather = WEATHER_DEFINITIONS[weatherIdAtHour(normalizedRegion, normalizedDay, normalizedHour)]
    ?? WEATHER_DEFINITIONS.clear;
  return Object.freeze({
    ...weather,
    tags: [...weather.tags],
    day: normalizedDay,
    regionId: normalizedRegion,
    hour: normalizedHour,
    rulesetVersion: WEATHER_RULESET_VERSION,
  });
}

/** The written day for a region: its segments, in order, with labels. */
export function canonicalWeatherSegments({ day, regionId }) {
  const normalizedRegion = String(regionId ?? "").trim() || "UNKNOWN";
  return parseWeatherPattern(almanacPattern(normalizedRegion, Number(day)))
    .map(({ fromHour, id }) => Object.freeze({
      fromHour,
      id,
      label: WEATHER_DEFINITIONS[id]?.label ?? id,
    }));
}

export function canonicalWeatherDay({ day, regionId }) {
  return Object.fromEntries(CANONICAL_WEATHER_DAYPARTS.map((daypart) => [
    daypart,
    resolveCanonicalWeather({ day, regionId, daypart }),
  ]));
}
