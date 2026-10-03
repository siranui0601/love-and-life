import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_WEATHER_DAYPARTS,
  WEATHER_DEFINITIONS,
  WEATHER_RULESET_VERSION,
  canonicalWeatherDay,
  canonicalWeatherScheduleKey,
  canonicalWeatherSegments,
  resolveCanonicalWeather,
  resolveCanonicalWeatherAt,
} from "../../../src/server/trpg/resolvers/weather-resolver.js";
import {
  WEATHER_ALMANAC,
  WEATHER_ALMANAC_REGIONS,
} from "../../../src/server/trpg/content/weather-almanac.js";

test("canonical weather is shared by every player and playthrough", () => {
  const first = resolveCanonicalWeather({ day: 37, regionId: "王都", daypart: "evening" });
  const second = resolveCanonicalWeather({ day: 37, regionId: "王都", daypart: "evening" });
  assert.deepEqual(second, first);
  assert.equal(first.rulesetVersion, WEATHER_RULESET_VERSION);
  assert.equal(first.scheduleKey, `${WEATHER_RULESET_VERSION}|day:37|region:王都|daypart:evening`);
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
  assert.ok(Object.values(schedule).every((weather) => WEATHER_DEFINITIONS[weather.id]));
});

test("weather comes from the written almanac, not from a roll", () => {
  // Every region has a page, every page has 100 days, every day parses.
  for (const regionId of WEATHER_ALMANAC_REGIONS) {
    const page = WEATHER_ALMANAC[regionId];
    assert.equal(page.length, 100, `${regionId} must have 100 written days`);
    for (let day = 1; day <= 100; day += 1) {
      const segments = canonicalWeatherSegments({ day, regionId });
      assert.ok(segments.length >= 1, `${regionId} Day${day} must have at least one segment`);
      assert.equal(segments[0].fromHour, 0, `${regionId} Day${day} must start at 00:00`);
      for (let index = 1; index < segments.length; index += 1) {
        assert.ok(
          segments[index].fromHour > segments[index - 1].fromHour,
          `${regionId} Day${day} segments must advance in time`,
        );
        assert.notEqual(
          segments[index].id,
          segments[index - 1].id,
          `${regionId} Day${day} must not repeat the same weather across a boundary`,
        );
      }
    }
  }
});

test("a day holds together: hourly reads follow the written segments", () => {
  const segments = canonicalWeatherSegments({ day: 26, regionId: "王都" });
  for (const segment of segments) {
    assert.equal(
      resolveCanonicalWeatherAt({ day: 26, regionId: "王都", hour: segment.fromHour }).id,
      segment.id,
    );
  }
  // The hour before a boundary still belongs to the previous segment.
  const boundary = segments.find((segment) => segment.fromHour > 0);
  if (boundary) {
    const previous = segments[segments.indexOf(boundary) - 1];
    assert.equal(
      resolveCanonicalWeatherAt({ day: 26, regionId: "王都", hour: boundary.fromHour - 1 }).id,
      previous.id,
    );
  }
});

test("the almanac gives each region a distinct climate", () => {
  const counts = (regionId) => {
    const tally = {};
    for (let day = 1; day <= 100; day += 1) {
      for (const segment of canonicalWeatherSegments({ day, regionId })) {
        tally[segment.id] = (tally[segment.id] ?? 0) + 1;
      }
    }
    return tally;
  };
  // 北陵要塞 is the only region that sees real snowfall; 辺境の村 is the dry one.
  assert.ok((counts("北陵要塞").snow ?? 0) >= 10, "北陵要塞 must actually snow");
  assert.equal(counts("田園の村").snow ?? 0, 0, "田園の村 must never see snow");
  assert.ok((counts("辺境の村").dry_wind ?? 0) >= 10, "辺境の村 must have its dry wind");
  assert.ok((counts("森").fog ?? 0) >= 10, "森 must have its morning fog");
});

test("invalid days and dayparts are rejected", () => {
  assert.throws(() => canonicalWeatherScheduleKey({ day: 0, regionId: "王都", daypart: "morning" }), RangeError);
  assert.throws(() => canonicalWeatherScheduleKey({ day: 101, regionId: "王都", daypart: "morning" }), RangeError);
  assert.throws(() => canonicalWeatherScheduleKey({ day: 1, regionId: "王都", daypart: "lunch" }), RangeError);
});
