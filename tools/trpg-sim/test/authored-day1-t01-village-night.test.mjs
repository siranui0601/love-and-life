import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY1_T01_SQUARE_AFTERCARE_INTERNALS as aftercare,
  AUTHORED_DAY1_T01_VILLAGE_NIGHT_INTERNALS as night,
  AUTHORED_DAY1_T01_VILLAGE_NIGHT_CANONICAL_INTERNALS as canonical,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import { consumeMeal, publicPlayerNeeds } from "../lib/player-needs.mjs";

const MERCHANT_CONTEXT = Object.freeze({ presentNpcs: [{ id: "NPC008" }] });

// Production epoch: absoluteMinute=0 is Day1 10:00. T01 aftercare begins at
// absoluteMinute=292 (Day1 14:52) in the strict New Game route.
function runtime({ absoluteMinute = 292 } = {}) {
  return {
    playerState: {
      absoluteMinute,
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_SQUARE",
        hunger: 34,
        fatigue: 58,
      },
      hunger: 34,
      fatigue: 58,
      missions: [{ id: "MSN-T01", troubleId: "T01", status: "completed", completedAt: 292 }],
      worldFlags: { t01Resolved: true, t01FinnReturned: true },
      history: [],
      evidence: {},
    },
  };
}

function choose(state, action) {
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  state.playerState.absoluteMinute += Number(action.minutes ?? 0);
  return result;
}

function reachEvening(state) {
  const help = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === aftercare.HELP_ACTION_ID);
  choose(state, help);
  const bread = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === "MISSION_FLOW:T01:SQUARE_SUPPER:share_bread");
  choose(state, bread);
}

function reachNight(state) {
  reachEvening(state);
  const evening = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === night.EVENING_REST_ACTION_ID);
  assert.ok(evening);
  choose(state, evening);
}

function sleepToDay2(state) {
  reachNight(state);
  const sleep = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === night.SLEEP_ACTION_ID);
  const result = choose(state, sleep);
  return { sleep, result };
}

function eatBreakfastAtBakery(state) {
  // The live canonical merchant morning is at the bakery, not the inn. The
  // authored arrival is unlocked by the completed night plus an actual meal;
  // generic NPC scheduler placement must not make that causal scene disappear.
  state.playerState.player.facilityId = "LOC_FARM_BAKERY";
  consumeMeal(state.playerState.player, {
    minute: state.playerState.absoluteMinute + 7,
    nutrition: 58,
    quality: "standard",
  });
  state.playerState.absoluteMinute += 7;
}

test("15:42 after supper offers a natural evening scene instead of premature sleep", () => {
  const state = runtime();
  reachEvening(state);

  assert.equal(state.playerState.absoluteMinute, 342);
  const guidance = authoredMissionFlowGuidance(state);
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(guidance.title, "夜までどう過ごすか");
  assert.deepEqual(actions.map((action) => action.label), [
    "装備を手入れし、身体を休める",
    "広場の片づけを手伝う",
    "村人と火のそばで話す",
  ]);
  assert.equal(actions.some((action) => action.id === night.SLEEP_ACTION_ID), false);
  const rest = actions.find((action) => action.id === night.EVENING_REST_ACTION_ID);
  assert.equal(rest.minutes, 408);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
});

test("evening free-time action advances exactly to 22:30 and only then opens night choices", () => {
  const state = runtime();
  reachEvening(state);
  const rest = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === night.EVENING_REST_ACTION_ID);
  choose(state, rest);

  assert.equal(state.playerState.absoluteMinute, 750);
  assert.equal(night.currentClock(state).minuteOfDay, 22 * 60 + 30);
  assert.equal(state.playerState.worldFlags["t01Evening:gearMaintainedAndRested"], true);
  assert.equal(state.playerState.day1T01VillageNight.eveningClosedActionIds.length, 2);

  const guidance = authoredMissionFlowGuidance(state);
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.equal(guidance.title, "救出した夜の過ごし方");
  assert.deepEqual(actions.map((action) => action.label), [
    "ミラの家で眠る",
    "夜番を手伝う",
    "井戸端で話す",
  ]);
  assert.equal(actions.find((action) => action.id === night.SLEEP_ACTION_ID).minutes, 480);
});

test("lodging sleep crosses into Day2 with fatigue recovered, while authored merchant arrival is scheduler-independent", () => {
  const state = runtime();
  const { result } = sleepToDay2(state);

  assert.equal(state.playerState.player.facilityId, "LOC_FARM_INN");
  assert.equal(state.playerState.day1T01VillageNight.nightClosedActionIds.length, 2);
  assert.equal(result.sceneTransition, night.MORNING_SCENE_ID);
  assert.equal(night.currentClock(state).day, 2);
  assert.equal(night.currentClock(state).minuteOfDay, 6 * 60 + 30);
  assert.equal(publicPlayerNeeds(state.playerState.player).fatigue, 0);
  assert.equal(publicPlayerNeeds(state.playerState.player).lastSleepQuality, "lodging");
  assert.equal(canonical.merchantMorningStateEligible(state), false);
  assert.equal(canonical.merchantMorningEligible(state, MERCHANT_CONTEXT), false);
  assert.notEqual(authoredMissionFlowGuidance(state)?.title, "Day2の行商人");

  eatBreakfastAtBakery(state);
  assert.equal(canonical.merchantMorningStateEligible(state), true);
  assert.equal(canonical.merchantMorningEligible(state, { presentNpcs: [] }), true);
  assert.equal(canonical.merchantMorningEligible(state, MERCHANT_CONTEXT), true);

  const withoutScheduledPresence = authoredMissionFlowExclusiveActions(state, { presentNpcs: [] });
  assert.deepEqual(withoutScheduledPresence.map((action) => action.label), [
    "荷ほどきを手伝う",
    "品物を見る",
    "朝粥を食べる",
  ]);
  assert.ok(withoutScheduledPresence.every((action) => action.targetNpcId === canonical.MERCHANT_NPC_ID));
  assert.ok(withoutScheduledPresence.every((action) => action.authoredDay1T01VillageNightSpeech.actorId === "NPC008"));

  const morning = authoredMissionFlowExclusiveActions(state, MERCHANT_CONTEXT);
  assert.deepEqual(morning.map((action) => action.id), withoutScheduledPresence.map((action) => action.id));
});

test("merchant choices create different logistics and life results only after breakfast at the bakery", () => {
  const workState = runtime();
  sleepToDay2(workState);
  eatBreakfastAtBakery(workState);
  const unload = authoredMissionFlowExclusiveActions(workState, { presentNpcs: [] })
    .find((action) => action.label === "荷ほどきを手伝う");
  const unloadResult = choose(workState, unload);
  assert.equal(unloadResult.speeches[0].actorId, "NPC008");
  assert.equal(workState.playerState.worldFlags["day2Merchant:unloadingHelped"], true);
  assert.equal(workState.playerState.worldFlags["day2Merchant:access:trusted"], true);

  const foodState = runtime();
  sleepToDay2(foodState);
  eatBreakfastAtBakery(foodState);
  const porridge = authoredMissionFlowExclusiveActions(foodState, { presentNpcs: [] })
    .find((action) => action.label === "朝粥を食べる");
  choose(foodState, porridge);
  assert.equal(foodState.playerState.worldFlags["day2Merchant:morningPorridgeEaten"], true);
  assert.equal(foodState.playerState.worldFlags["day2Merchant:access:open"], true);
});

test("night watch and well talk remain distinct after the evening bridge", () => {
  const watchState = runtime();
  reachNight(watchState);
  const watch = authoredMissionFlowExclusiveActions(watchState)
    .find((action) => action.label === "夜番を手伝う");
  choose(watchState, watch);
  assert.equal(watchState.playerState.worldFlags["t01Night:northFenceTraceRecorded"], true);
  assert.equal(
    watchState.playerState.evidence["T03-EVIDENCE-NORTH-FENCE-WOLF-TRACE"].sourceId,
    "LOC_FARM_NORTH_FENCE:NIGHT_WATCH",
  );
  assert.equal(night.morningEligible(watchState), false);

  const wellState = runtime();
  reachNight(wellState);
  const well = authoredMissionFlowExclusiveActions(wellState)
    .find((action) => action.label === "井戸端で話す");
  choose(wellState, well);
  assert.equal(wellState.playerState.worldFlags["t01Night:wellPathRumorSeparated"], true);
  assert.equal(night.morningEligible(wellState), false);
});

test("night scene cannot be reached before 22:30 or without bread-sharing history", () => {
  const early = runtime();
  early.playerState.history.push({ type: "T01_AFTERCARE_BREAD_SHARED" });
  assert.equal(night.nightEligible(early), false);
  assert.equal(night.eveningEligible(early), true);

  const noBread = runtime({ absoluteMinute: 750 });
  assert.equal(night.nightEligible(noBread), false);
  assert.equal(night.eveningEligible(noBread), false);
});
