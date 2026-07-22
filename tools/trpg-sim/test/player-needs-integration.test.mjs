import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGameRuntimeChoiceCandidates,
  buildGameView,
  createGameRuntime,
  gameStateHash,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";
import { resolvePlayerAction } from "../lib/player-journey.mjs";
import { PLAYER_NEEDS_VERSION } from "../lib/player-needs.mjs";

function view(runtime, data) {
  return buildGameView({
    id: "needs-integration",
    schemaVersion: "test",
    contentRevision: data.contentRevision,
    revision: 0,
    stateHash: gameStateHash(runtime, data),
    playerName: "旅人",
    presentation: null,
    lastOutcome: null,
  }, runtime, data);
}

test("new games and the public view expose the formal needs contract", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, { seed: "needs-public-view", profileId: "balanced", playerName: "旅人", tutorial: false });
  const publicView = view(runtime, game.data);
  assert.equal(runtime.playerState.player.needs.version, PLAYER_NEEDS_VERSION);
  assert.equal(publicView.player.needs.version, PLAYER_NEEDS_VERSION);
  assert.equal(publicView.player.needs.hungerLabel, "満たされている");
  assert.ok(publicView.weather.scheduleKey);
});

test("an inn exposes affordable meal and lodging actions when needs are high", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, { seed: "needs-affordances", profileId: "balanced", playerName: "旅人", tutorial: false });
  runtime.playerState.player.facilityId = "LOC_FARM_INN";
  runtime.playerState.player.gold = 100;
  runtime.playerState.player.freeMeals = 0;
  runtime.playerState.player.freeLodging = 0;
  runtime.playerState.player.needs.hunger = 82;
  runtime.playerState.player.needs.fatigue = 88;
  runtime.playerState.hour = 21;
  runtime.playerState.minuteOfDay = 1260;
  runtime.playerState.daypart = "dusk";
  runtime.playerKnowledge.knownFacilityIds.add("LOC_FARM_INN");
  const candidates = availableGameRuntimeChoiceCandidates(runtime, game.data, { limit: 9 });
  const meal = candidates.find((action) => action.type === "eat");
  const lodging = candidates.find((action) => action.type === "rest" && action.lodging === true);
  assert.ok(meal, candidates.map((entry) => entry.type + ":" + entry.label).join(" / "));
  assert.ok(lodging, candidates.map((entry) => entry.type + ":" + entry.label).join(" / "));
  assert.equal(meal.price, 4);
  assert.equal(lodging.price, 12);
});

test("meals and lodging mutate hunger fatigue time and money authoritatively", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, { seed: "needs-resolution", profileId: "balanced", playerName: "旅人", tutorial: false });
  const state = runtime.playerState;
  state.player.gold = 100;
  state.player.freeMeals = 0;
  state.player.freeLodging = 0;
  state.player.needs.hunger = 82;
  state.player.needs.fatigue = 88;
  const beforeMeal = state.absoluteMinute;
  const meal = resolvePlayerAction(state, game.data.model, game.data.battleData, game.data.skills, state.catalog, "balanced", { id: "TEST:EAT", type: "eat", minutes: 30, price: 8, nutrition: 58 });
  assert.equal(meal.ok, true);
  assert.equal(state.player.gold, 92);
  assert.ok(state.player.needs.hunger < 30);
  assert.equal(state.absoluteMinute, beforeMeal + 30);
  const beforeSleep = state.absoluteMinute;
  const rest = resolvePlayerAction(state, game.data.model, game.data.battleData, game.data.skills, state.catalog, "balanced", { id: "TEST:LODGE", type: "rest", lodging: true, minutes: 480, price: 28 });
  assert.equal(rest.ok, true);
  assert.equal(state.player.gold, 64);
  assert.equal(state.player.needs.fatigue, 0);
  assert.equal(state.absoluteMinute, beforeSleep + 480);
});

test("unaffordable paid survival actions reject without advancing time", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, { seed: "needs-insufficient-gold", profileId: "balanced", playerName: "旅人", tutorial: false });
  const state = runtime.playerState;
  state.player.gold = 0;
  state.player.freeMeals = 0;
  state.player.freeLodging = 0;
  const minute = state.absoluteMinute;
  const meal = resolvePlayerAction(state, game.data.model, game.data.battleData, game.data.skills, state.catalog, "balanced", { id: "TEST:EAT:EXPENSIVE", type: "eat", minutes: 30, price: 8 });
  assert.equal(meal.ok, false);
  assert.equal(meal.reason, "insufficient_gold_for_meal");
  assert.equal(state.absoluteMinute, minute);
  const lodging = resolvePlayerAction(state, game.data.model, game.data.battleData, game.data.skills, state.catalog, "balanced", { id: "TEST:LODGE:EXPENSIVE", type: "rest", lodging: true, minutes: 480, price: 28 });
  assert.equal(lodging.ok, false);
  assert.equal(lodging.reason, "insufficient_gold_for_lodging");
  assert.equal(state.absoluteMinute, minute);
});
