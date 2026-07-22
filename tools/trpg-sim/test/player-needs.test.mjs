import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAYER_NEEDS_VERSION,
  advancePlayerNeeds,
  completePlayerRest,
  consumeMeal,
  createPlayerNeeds,
  ensurePlayerNeeds,
  publicPlayerNeeds,
} from "../lib/player-needs.mjs";

test("legacy hunger and fatigue state migrates without changing its visible values", () => {
  const player = {
    needs: { hunger: 82, fatigue: 88, lastMealMinute: 12, lastSleepMinute: 24 },
  };
  const needs = ensurePlayerNeeds(player);
  assert.equal(needs.version, PLAYER_NEEDS_VERSION);
  assert.equal(needs.hunger, 82);
  assert.equal(needs.fatigue, 88);
  assert.equal(player.needs, needs);
  assert.equal(needs.lastSleepQuality, "none");
});

test("the same elapsed action produces the same deterministic needs result", () => {
  const first = createPlayerNeeds();
  const second = createPlayerNeeds();
  const input = {
    minutes: 180,
    reason: "regional-move:田園の村->王都",
    daypart: "day",
    weatherTags: ["rain", "wet", "outdoor"],
    outdoors: true,
  };
  assert.deepEqual(advancePlayerNeeds(first, input), advancePlayerNeeds(second, input));
  assert.ok(first.hunger > 15);
  assert.ok(first.fatigue > 8);
});

test("work and bad-weather travel are more tiring than quiet indoor time", () => {
  const indoor = createPlayerNeeds({ hunger: 10, fatigue: 10 });
  const work = createPlayerNeeds({ hunger: 10, fatigue: 10 });
  const travel = createPlayerNeeds({ hunger: 10, fatigue: 10 });
  advancePlayerNeeds(indoor, { minutes: 120, reason: "observe", daypart: "day", outdoors: false });
  advancePlayerNeeds(work, { minutes: 120, reason: "odd-job", daypart: "day", outdoors: false });
  advancePlayerNeeds(travel, {
    minutes: 120,
    reason: "regional-move:田園の村->王都",
    daypart: "day",
    outdoors: true,
    weatherTags: ["storm", "rain", "wet"],
  });
  assert.ok(work.fatigue > indoor.fatigue);
  assert.ok(travel.fatigue > indoor.fatigue);
  assert.ok(travel.hunger > indoor.hunger);
});

test("a meal records its time and cannot reduce hunger below zero", () => {
  const needs = createPlayerNeeds({ hunger: 35 });
  const result = consumeMeal(needs, { minute: 720, nutrition: 58, quality: "hearty" });
  assert.equal(needs.hunger, 0);
  assert.equal(needs.lastMealMinute, 720);
  assert.equal(result.hungerReduced, 35);
});

test("lodging fully restores fatigue while unsafe wet camping does not", () => {
  const lodging = createPlayerNeeds({ fatigue: 88 });
  const camping = createPlayerNeeds({ fatigue: 88 });
  completePlayerRest(lodging, { minute: 960, durationMinutes: 480, lodging: true });
  const campResult = completePlayerRest(camping, {
    minute: 960,
    durationMinutes: 480,
    lodging: false,
    safety: "poor",
    weatherTags: ["rain", "wet", "cold"],
  });
  assert.equal(lodging.fatigue, 0);
  assert.ok(camping.fatigue > 30);
  assert.equal(camping.outdoorSleepCount, 1);
  assert.equal(campResult.fullyRested, false);
});

test("public need state exposes stable labels and urgency thresholds", () => {
  const normal = publicPlayerNeeds(createPlayerNeeds({ hunger: 20, fatigue: 25 }));
  const urgent = publicPlayerNeeds(createPlayerNeeds({ hunger: 85, fatigue: 20 }));
  const critical = publicPlayerNeeds(createPlayerNeeds({ hunger: 95, fatigue: 94 }));
  assert.equal(normal.urgent, false);
  assert.equal(urgent.urgent, true);
  assert.equal(critical.critical, true);
  assert.match(critical.hungerLabel, /危険/u);
  assert.match(critical.fatigueLabel, /危険/u);
});
