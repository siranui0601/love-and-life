import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_WEATHER_DAYPARTS,
  WEATHER_DEFINITIONS,
  WEATHER_RULESET_VERSION,
  canonicalWeatherDay,
  canonicalWeatherScheduleKey,
  resolveCanonicalWeather,
} from "../../../src/server/trpg/resolvers/weather-resolver.js";

test("canonical weather is shared by every player and playthrough", () => {
  const first = resolveCanonicalWeather({ day: 37, regionId: "王都", daypart: "evening" });
  const second = resolveCanonicalWeather({ day: 37, regionId: "王都", daypart: "evening" });
  assert.deepEqual(second, first);
  assert.equal(first.rulesetVersion, WEATHER_RULESET_VERSION);
  assert.equal(first.scheduleKey, "canonical-weather-v1|day:37|region:王都|daypart:evening");
  assert.ok(!first.scheduleKey.includes("seed"));
  assert.ok(!first.scheduleKey.includes("player"));
});

test("all Day 1-100 schedules resolve to known weather", () => {
  for (let day = 1; day <= 100; day += 1) {
    for (const daypart of CANONICAL_WEATHER_DAYPARTS) {
      const weather = resolveCanonicalWeather({ day, regionId: "田園の村", daypart });
      assert.ok(WEATHER_DEFINITIONS[weather.id], `unknown weather on Day ${day} ${daypart}`);
      assert.equal(weather.day, day);
      assert.equal(weather.regionId, "田園の村");
      assert.equal(weather.daypart, daypart);
    }
  }
});

test("daypart aliases resolve to the same canonical slot", () => {
  assert.deepEqual(
    resolveCanonicalWeather({ day: 8, regionId: "森", daypart: "dawn" }),
    resolveCanonicalWeather({ day: 8, regionId: "森", daypart: "morning" }),
  );
  assert.deepEqual(
    resolveCanonicalWeather({ day: 8, regionId: "森", daypart: "midnight" }),
    resolveCanonicalWeather({ day: 8, regionId: "森", daypart: "night" }),
  );
});

test("canonicalWeatherDay returns the four shared phase forecasts", () => {
  const schedule = canonicalWeatherDay({ day: 1, regionId: "北陵要塞" });
  assert.deepEqual(Object.keys(schedule), [...CANONICAL_WEATHER_DAYPARTS]);
  assert.ok(Object.values(schedule).some((weather) => weather.tags.includes("cold") || weather.id !== "clear"));
});

test("invalid days and dayparts are rejected", () => {
  assert.throws(() => canonicalWeatherScheduleKey({ day: 0, regionId: "王都", daypart: "morning" }), RangeError);
  assert.throws(() => canonicalWeatherScheduleKey({ day: 101, regionId: "王都", daypart: "morning" }), RangeError);
  assert.throws(() => canonicalWeatherScheduleKey({ day: 1, regionId: "王都", daypart: "lunch" }), RangeError);
});
