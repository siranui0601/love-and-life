import test from "node:test";
import assert from "node:assert/strict";
import { loadBattleData } from "../lib/battle-model.mjs";
import { loadSkills } from "../lib/fixtures.mjs";
import { experienceToNextLevel } from "../lib/mission-model.mjs";
import {
  availableTravelActions,
  createInitialJourneyState,
  generateChoiceActions,
  shortestTravelPlan,
  simulatePlayerJourney,
} from "../lib/player-journey.mjs";
import { buyEquipment, availableStockAt } from "../lib/shop-runtime.mjs";
import { loadPlayerSimulationConfig } from "../lib/player-suite.mjs";
import { loadWorldModel } from "../lib/world-model.mjs";

const model = loadWorldModel();
const battleData = await loadBattleData();
const skills = loadSkills();
const config = loadPlayerSimulationConfig();

function fresh(profile = "balanced") {
  return createInitialJourneyState({ model, battleData, skills, profile, tuning: config.tuned, seed: `test:${profile}` });
}

test("experience curve matches the design formula", () => {
  assert.equal(experienceToNextLevel(1), 100);
  assert.equal(experienceToNextLevel(2), 122);
  assert.ok(experienceToNextLevel(10) > experienceToNextLevel(9));
});

test("three choices are separate from a complete reachable travel menu", () => {
  const state = fresh();
  const choices = generateChoiceActions(state, model, battleData, state.catalog);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, 3);
  assert.equal(choices.some((choice) => choice.type === "travel"), false);

  const travel = availableTravelActions(state, model);
  const listed = new Set(travel.map((entry) => entry.destination));
  for (const destination of model.locations) {
    if (destination === state.player.location) continue;
    const route = shortestTravelPlan(model, state, state.player.location, destination);
    assert.equal(listed.has(destination), Boolean(route), destination);
  }
});

test("ordinary shop purchase advances no time", () => {
  const state = fresh();
  state.player.gold = 1000;
  const available = availableStockAt(state, battleData, state.shop);
  assert.ok(available.length > 0);
  const before = state.absoluteMinute;
  const result = buyEquipment(state, battleData, state.shop, available[0].id);
  assert.equal(result.ok, true);
  assert.equal(state.absoluteMinute, before);
});

test("same seed and profile replay to the same world fingerprint", () => {
  const options = {
    model,
    battleData,
    skills,
    profile: "story",
    tuning: config.tuned,
    seed: "determinism-smoke",
    endMinute: 3 * 1440,
    maxActions: 500,
  };
  const left = simulatePlayerJourney(options);
  const right = simulatePlayerJourney(options);
  assert.equal(left.summary.fingerprint, right.summary.fingerprint);
  assert.equal(left.summary.replayMismatches, 0);
  assert.equal(left.summary.terminatedByActionCap, false);
});

test("story profile can interact with early trouble, missions, combat, and levels", () => {
  const run = simulatePlayerJourney({
    model,
    battleData,
    skills,
    profile: "story",
    tuning: config.tuned,
    seed: "story-vertical-slice",
    endMinute: 5 * 1440,
    maxActions: 800,
  });
  assert.equal(run.summary.terminatedByActionCap, false);
  assert.ok(run.summary.actions > 0);
  assert.ok(run.summary.missionsCompleted > 0);
  assert.ok(run.summary.level >= 2);
  assert.ok(["active", "critical", "failed", "resolved"].includes(run.state.troubles.T01.status));
  assert.ok(run.summary.rumorCount > 0);
});
