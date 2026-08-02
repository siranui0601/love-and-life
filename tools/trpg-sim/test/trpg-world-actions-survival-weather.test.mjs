import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGameView,
  createGameRuntime,
  gameStateHash,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";
import {
  buildLocalNarrativeContext,
  sanitizeNarrativeOutput,
  validateNarrativeOutput,
} from "../../../src/server/trpg/narrative-contract.js";
import { resolvePlayerAction } from "../lib/player-journey.mjs";
import { deterministicWeather } from "../lib/world-weather.mjs";

function runtimeView(runtime, data) {
  return buildGameView({
    id: "world-actions-test",
    schemaVersion: "test",
    contentRevision: data.contentRevision,
    revision: 0,
    stateHash: gameStateHash(runtime, data),
    playerName: "オレゴン",
    presentation: null,
    lastOutcome: null,
  }, runtime, data);
}

test("weather is a shared Day1-100 regional timeline rather than save-seed randomness", () => {
  const first = deterministicWeather({ day: 37, hour: 7, location: "王都" });
  const replay = deterministicWeather({ day: 37, hour: 7, location: "王都" });
  assert.deepEqual(first, replay);

  const evening = deterministicWeather({ day: 37, hour: 18, location: "王都" });
  const fortress = deterministicWeather({ day: 37, hour: 7, location: "北陵要塞" });
  assert.equal(first.block, "morning");
  assert.equal(evening.block, "evening");
  assert.notEqual(first.temperatureC, evening.temperatureC);
  assert.notEqual(first.climate, fortress.climate);
  assert.match(first.description, /王都/u);
});

test("capital map never exposes the orphanage and its future replacement at the same time", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "capital-temporal-facilities",
    profileId: "balanced",
    playerName: "時系列確認者",
    tutorial: false,
  });
  runtime.playerState.player.location = "王都";
  runtime.playerState.player.facilityId = "LOC_CAP_LOWER_INN";
  runtime.playerState.progress.travel.visitedHubs.add("王都");
  runtime.playerKnowledge.knownHubIds.add("王都");
  for (const facility of game.data.model.facilitiesByHub["王都"] ?? []) {
    runtime.playerKnowledge.knownFacilityIds.add(facility.id);
  }

  let view = runtimeView(runtime, game.data);
  assert.equal(view.movement.some((entry) => entry.destinationFacilityId === "LOC_CAP_ORPHANAGE"), true);
  assert.equal(view.movement.some((entry) => entry.destinationFacilityId === "LOC_CAP_BIG_STORE"), false);

  runtime.playerState.day = 70;
  runtime.playerState.troubles.T10.status = "failed";
  view = runtimeView(runtime, game.data);
  assert.equal(view.movement.some((entry) => entry.destinationFacilityId === "LOC_CAP_ORPHANAGE"), false);
  assert.equal(view.movement.some((entry) => entry.destinationFacilityId === "LOC_CAP_BIG_STORE"), true);
});

test("meals and lodging change hunger, fatigue, time and money authoritatively", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "survival-needs",
    profileId: "balanced",
    playerName: "旅人",
    tutorial: false,
  });
  const state = runtime.playerState;
  state.player.gold = 100;
  state.player.freeMeals = 0;
  state.player.freeLodging = 0;
  state.player.needs = { hunger: 82, fatigue: 88, lastMealMinute: 0, lastSleepMinute: 0 };

  const beforeMealMinute = state.absoluteMinute;
  const meal = resolvePlayerAction(state, game.data.model, game.data.battleData, game.data.skills, state.catalog, "balanced", {
    id: "TEST:EAT",
    type: "eat",
    minutes: 30,
    price: 8,
    nutrition: 58,
  });
  assert.equal(meal.ok, true);
  assert.equal(state.player.gold, 92);
  assert.ok(state.player.needs.hunger < 30);
  assert.equal(state.absoluteMinute, beforeMealMinute + 30);

  const beforeSleepMinute = state.absoluteMinute;
  const lodging = resolvePlayerAction(state, game.data.model, game.data.battleData, game.data.skills, state.catalog, "balanced", {
    id: "TEST:LODGE",
    type: "rest",
    lodging: true,
    minutes: 480,
    price: 28,
  });
  assert.equal(lodging.ok, true);
  assert.equal(state.player.gold, 64);
  assert.equal(state.player.needs.fatigue, 0);
  assert.equal(state.absoluteMinute, beforeSleepMinute + 480);
});

test("Gemini may invent concrete local actions while impossible destinations are rejected", () => {
  const input = {
    locale: "ja-JP",
    sceneMode: "exploration",
    action: { id: "LOOK", type: "localInvestigate", label: "周囲を見る" },
    authoritativeOutcome: { ok: true },
    authoritativeState: {
      day: 1,
      hour: 12,
      minute: 0,
      daypart: "day",
      location: "田園の村",
      locationId: "田園の村",
      facilityId: "LOC_FARM_EDGE",
      facilityName: "村外れ・見張り小屋道",
      presentNpcIds: ["NPC006"],
      npcs: [{ id: "NPC006", name: "見知らぬ青年", presence: "present", lifeStatus: "alive" }],
      player: { displayName: "オレゴン", knownFacts: [], needs: { hunger: 20, fatigue: 15 } },
      missions: [],
      localRumors: [],
      availableActionCandidates: [
        { id: "ACT-PROGRESS", label: "声の方向を確かめる", intentType: "investigate", actionType: "investigate", progressRole: "progress" },
      ],
      progressContract: { mode: "must_offer_progress", anchorCandidateIds: ["ACT-PROGRESS"] },
      continuityContract: { mode: "free", candidateIds: [] },
      choiceDiversityContract: { minimumGeneratedChoices: 2, maximumCandidateChoices: 1 },
      worldAffordances: {
        presentNpcIds: ["NPC006"],
        localFacilities: [{ id: "LOC_FARM_SQUARE", name: "村の広場", minutes: 18 }],
        regionalDestinations: [{ hub: "王都", minutes: 60 }],
        canInvestigate: true,
        canWait: true,
        canPrepare: true,
        canWork: false,
        canEat: false,
        canRest: false,
        canLodge: false,
      },
    },
  };
  const context = buildLocalNarrativeContext(input).context;
  const valid = {
    narrative: "青年が泥のついた外套で、斜面の方を気にしている。",
    choices: [
      { id: "ACT-PROGRESS", actionKind: "candidate", candidateId: "ACT-PROGRESS", label: "声がした斜面へ近づく", intentType: "investigate" },
      { id: "GEN-1", actionKind: "talk", label: "青年にここで見たものを尋ねる", intentType: "ask", targetNpcId: "NPC006", topic: "斜面の物音" },
      { id: "GEN-2", actionKind: "move_local", label: "一度村の広場へ戻る", intentType: "leave", destinationFacilityId: "LOC_FARM_SQUARE" },
    ],
    speeches: [],
    proposals: [],
  };
  assert.equal(validateNarrativeOutput(valid, context).ok, true);

  const impossible = {
    ...valid,
    choices: [valid.choices[0], valid.choices[1], { ...valid.choices[2], destinationFacilityId: "LOC_UNKNOWN" }],
  };
  const validation = validateNarrativeOutput(impossible, context);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((entry) => /local destination is not available/u.test(entry)));
  const sanitized = sanitizeNarrativeOutput(impossible, context);
  assert.equal(sanitized.choices.some((choice) => choice.destinationFacilityId === "LOC_UNKNOWN"), false);
});
