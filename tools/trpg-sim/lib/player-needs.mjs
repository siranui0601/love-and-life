export const PLAYER_NEEDS_VERSION = "player-needs-v2";

export const PLAYER_NEEDS_DEFAULTS = Object.freeze({
  hunger: 15,
  fatigue: 8,
  lastMealMinute: 0,
  lastSleepMinute: 0,
  lastSleepQuality: "none",
  outdoorSleepCount: 0,
});

const HUNGER_LABELS = Object.freeze([
  Object.freeze({ maximum: 27.999, id: "satisfied", label: "満たされている" }),
  Object.freeze({ maximum: 54.999, id: "peckish", label: "少し空腹" }),
  Object.freeze({ maximum: 79.999, id: "hungry", label: "空腹" }),
  Object.freeze({ maximum: 91.999, id: "very_hungry", label: "かなり空腹" }),
  Object.freeze({ maximum: 100, id: "starving", label: "飢えが危険な状態" }),
]);

const FATIGUE_LABELS = Object.freeze([
  Object.freeze({ maximum: 27.999, id: "rested", label: "十分に動ける" }),
  Object.freeze({ maximum: 54.999, id: "tired", label: "少し疲れている" }),
  Object.freeze({ maximum: 79.999, id: "weary", label: "疲労がたまっている" }),
  Object.freeze({ maximum: 91.999, id: "exhausted", label: "かなり消耗している" }),
  Object.freeze({ maximum: 100, id: "collapse_risk", label: "倒れる危険がある" }),
]);

const REASON_ACTIVITY = Object.freeze({
  meal: Object.freeze({ hunger: 0.65, fatigue: 0.45 }),
  "inn-rest": Object.freeze({ hunger: 0.8, fatigue: 0 }),
  "outdoor-rest": Object.freeze({ hunger: 0.9, fatigue: 0.2 }),
  "camp-sleep": Object.freeze({ hunger: 0.9, fatigue: 0 }),
  "odd-job": Object.freeze({ hunger: 1.2, fatigue: 1.45 }),
  "seek-battle": Object.freeze({ hunger: 1.15, fatigue: 1.4 }),
  "mission-battle": Object.freeze({ hunger: 1.15, fatigue: 1.4 }),
});

function bounded(value, minimum = 0, maximum = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.max(minimum, Math.min(maximum, number));
}

function finiteMinute(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function labelFor(value, definitions) {
  return definitions.find((entry) => value <= entry.maximum) ?? definitions.at(-1);
}

function activityFor(reason) {
  const normalized = String(reason ?? "");
  if (REASON_ACTIVITY[normalized]) return REASON_ACTIVITY[normalized];
  if (normalized.startsWith("regional-move:")) return { hunger: 1.15, fatigue: 1.25 };
  if (normalized.startsWith("local-move:")) return { hunger: 1.05, fatigue: 1.1 };
  if (normalized.startsWith("battle:")) return { hunger: 1.15, fatigue: 1.4 };
  if (normalized.startsWith("work:")) return { hunger: 1.2, fatigue: 1.45 };
  return { hunger: 1, fatigue: 1 };
}

function weatherExposureMultiplier(tags, outdoors) {
  if (!outdoors) return 1;
  const values = tags instanceof Set ? tags : new Set(tags ?? []);
  let multiplier = 1;
  if (values.has("storm") || values.has("snow")) multiplier += 0.18;
  if (values.has("cold")) multiplier += 0.12;
  if (values.has("wet") || values.has("rain")) multiplier += 0.08;
  if (values.has("dry")) multiplier += 0.05;
  return multiplier;
}

export function createPlayerNeeds(overrides = {}) {
  return {
    version: PLAYER_NEEDS_VERSION,
    hunger: bounded(overrides.hunger ?? PLAYER_NEEDS_DEFAULTS.hunger),
    fatigue: bounded(overrides.fatigue ?? PLAYER_NEEDS_DEFAULTS.fatigue),
    lastMealMinute: finiteMinute(overrides.lastMealMinute, PLAYER_NEEDS_DEFAULTS.lastMealMinute),
    lastSleepMinute: finiteMinute(overrides.lastSleepMinute, PLAYER_NEEDS_DEFAULTS.lastSleepMinute),
    lastSleepQuality: String(overrides.lastSleepQuality ?? PLAYER_NEEDS_DEFAULTS.lastSleepQuality),
    outdoorSleepCount: Math.max(0, Math.round(Number(overrides.outdoorSleepCount ?? PLAYER_NEEDS_DEFAULTS.outdoorSleepCount) || 0)),
  };
}

export function ensurePlayerNeeds(playerOrNeeds) {
  const owner = playerOrNeeds && typeof playerOrNeeds === "object" && Object.hasOwn(playerOrNeeds, "needs")
    ? playerOrNeeds
    : null;
  const source = owner ? owner.needs : playerOrNeeds;
  const migrated = createPlayerNeeds(source ?? {});
  if (owner) {
    owner.needs = migrated;
    return owner.needs;
  }
  if (playerOrNeeds && typeof playerOrNeeds === "object") {
    Object.assign(playerOrNeeds, migrated);
    return playerOrNeeds;
  }
  return migrated;
}

export function publicPlayerNeeds(playerOrNeeds) {
  const needs = ensurePlayerNeeds(playerOrNeeds);
  const hunger = Number(needs.hunger.toFixed(2));
  const fatigue = Number(needs.fatigue.toFixed(2));
  const hungerState = labelFor(hunger, HUNGER_LABELS);
  const fatigueState = labelFor(fatigue, FATIGUE_LABELS);
  return {
    version: needs.version,
    hunger,
    fatigue,
    hungerState: hungerState.id,
    hungerLabel: hungerState.label,
    fatigueState: fatigueState.id,
    fatigueLabel: fatigueState.label,
    urgent: hunger >= 80 || fatigue >= 80,
    critical: hunger >= 92 || fatigue >= 92,
    lastMealMinute: needs.lastMealMinute,
    lastSleepMinute: needs.lastSleepMinute,
    lastSleepQuality: needs.lastSleepQuality,
  };
}

export function advancePlayerNeeds(playerOrNeeds, {
  minutes,
  reason = "time",
  daypart = "day",
  weatherTags = [],
  outdoors = false,
} = {}) {
  const needs = ensurePlayerNeeds(playerOrNeeds);
  const elapsedHours = Math.max(0, Number(minutes) || 0) / 60;
  if (!elapsedHours) return { needs, hpDrain: 0, mpDrain: 0 };
  const activity = activityFor(reason);
  const exposure = weatherExposureMultiplier(weatherTags, outdoors);
  const nightMultiplier = ["night", "late_night", "midnight"].includes(String(daypart)) ? 2 : 1;
  needs.hunger = bounded(needs.hunger + elapsedHours * 4.5 * activity.hunger * exposure);
  needs.fatigue = bounded(needs.fatigue + elapsedHours * 3.5 * activity.fatigue * nightMultiplier * exposure);
  const hpDrain = needs.hunger >= 92 ? elapsedHours * 0.012 : 0;
  const mpDrain = needs.fatigue >= 92 ? elapsedHours * 0.018 : 0;
  return { needs, hpDrain, mpDrain };
}

export function consumeMeal(playerOrNeeds, {
  minute = 0,
  nutrition = 58,
  quality = "standard",
} = {}) {
  const needs = ensurePlayerNeeds(playerOrNeeds);
  const qualityMultiplier = { poor: 0.8, standard: 1, hearty: 1.2, feast: 1.4 }[quality] ?? 1;
  const restored = Math.max(0, Number(nutrition) || 0) * qualityMultiplier;
  const before = needs.hunger;
  needs.hunger = bounded(needs.hunger - restored);
  needs.lastMealMinute = finiteMinute(minute, needs.lastMealMinute);
  return {
    needs,
    hungerReduced: Number((before - needs.hunger).toFixed(2)),
    quality,
  };
}

export function completePlayerRest(playerOrNeeds, {
  minute = 0,
  durationMinutes = 120,
  lodging = false,
  safety = "normal",
  weatherTags = [],
} = {}) {
  const needs = ensurePlayerNeeds(playerOrNeeds);
  const duration = Math.max(0, Number(durationMinutes) || 0);
  const tags = weatherTags instanceof Set ? weatherTags : new Set(weatherTags ?? []);
  const before = needs.fatigue;
  let quality = lodging ? "lodging" : duration >= 360 ? "camp" : "short_rest";
  let recovery;
  if (lodging) recovery = 100;
  else if (duration >= 360) recovery = 58;
  else recovery = Math.min(35, duration / 120 * 35);
  if (!lodging && safety === "poor") recovery *= 0.72;
  if (!lodging && (tags.has("storm") || tags.has("snow"))) recovery *= 0.72;
  else if (!lodging && (tags.has("rain") || tags.has("wet") || tags.has("cold"))) recovery *= 0.86;
  needs.fatigue = lodging ? 0 : bounded(needs.fatigue - recovery);
  needs.lastSleepMinute = finiteMinute(minute, needs.lastSleepMinute);
  needs.lastSleepQuality = quality;
  if (!lodging && duration >= 360) needs.outdoorSleepCount += 1;
  return {
    needs,
    fatigueReduced: Number((before - needs.fatigue).toFixed(2)),
    quality,
    fullyRested: needs.fatigue === 0,
  };
}

export function needsUtility(playerOrNeeds) {
  const needs = publicPlayerNeeds(playerOrNeeds);
  return {
    eat: needs.hunger * 0.22,
    rest: needs.fatigue * 0.25,
  };
}
