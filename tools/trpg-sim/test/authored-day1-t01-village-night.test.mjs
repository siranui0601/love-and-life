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

function runtime() {
  return {
    playerState: {
      absoluteMinute: 780,
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_SQUARE",
        hunger: 34,
        fatigue: 58,
      },
      hunger: 34,
      fatigue: 58,
      missions: [{ id: "MSN-T01", troubleId: "T01", status: "completed", completedAt: 780 }],
      worldFlags: { t01Resolved: true, t01FinnReturned: true },
      history: [],
      evidence: {},
    },
  };
}

function choose(state, action) {
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

function reachNight(state) {
  const help = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === aftercare.HELP_ACTION_ID);
  choose(state, help);
  const bread = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === "MISSION_FLOW:T01:SQUARE_SUPPER:share_bread");
  choose(state, bread);
}

test("Day1 T01 route continues from supper into a different short night scene", () => {
  const state = runtime();
  reachNight(state);

  const guidance = authoredMissionFlowGuidance(state);
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(guidance.title, "救出した夜の過ごし方");
  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "ミラの家で眠る",
    "夜番を手伝う",
    "井戸端で話す",
  ]);
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  for (const action of actions) {
    assert.ok(action.label.length >= 4 && action.label.length <= 20);
  }
});

test("sleeping changes living state, closes branches, and reaches the Day2 merchant", () => {
  const state = runtime();
  reachNight(state);

  const sleep = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === night.SLEEP_ACTION_ID);
  const result = choose(state, sleep);

  assert.equal(state.playerState.player.hunger, 22);
  assert.equal(state.playerState.player.fatigue, 13);
  assert.equal(state.playerState.hunger, 22);
  assert.equal(state.playerState.fatigue, 13);
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_INN");
  assert.equal(state.playerState.day1T01VillageNight.nightClosedActionIds.length, 2);
  assert.equal(result.sceneTransition, night.MORNING_SCENE_ID);
  assert.deepEqual(result.livingState, {
    hungerBefore: 34,
    hungerAfter: 22,
    fatigueBefore: 58,
    fatigueAfter: 13,
  });

  const guidance = authoredMissionFlowGuidance(state);
  const morning = authoredMissionFlowExclusiveActions(state);
  assert.equal(guidance.title, "Day2の行商人");
  assert.deepEqual(morning.map((action) => action.label), [
    "荷ほどきを手伝う",
    "品物を見る",
    "朝粥を食べる",
  ]);
  assert.ok(morning.every((action) => action.targetNpcId === canonical.MERCHANT_NPC_ID));
  assert.ok(morning.every((action) => action.authoredDay1T01VillageNightSpeech.actorId === "NPC008"));
});

test("merchant choices create different logistics, shopping, and life results", () => {
  const workState = runtime();
  reachNight(workState);
  choose(workState, authoredMissionFlowExclusiveActions(workState)
    .find((action) => action.id === night.SLEEP_ACTION_ID));
  const unload = authoredMissionFlowExclusiveActions(workState)
    .find((action) => action.label === "荷ほどきを手伝う");
  const unloadResult = choose(workState, unload);
  assert.equal(unloadResult.speeches[0].actorId, "NPC008");
  assert.equal(workState.playerState.worldFlags["day2Merchant:unloadingHelped"], true);
  assert.equal(workState.playerState.worldFlags["day2Merchant:access:trusted"], true);
  assert.equal(workState.playerState.day1T01VillageNight.merchantAccess, "trusted");

  const foodState = runtime();
  reachNight(foodState);
  choose(foodState, authoredMissionFlowExclusiveActions(foodState)
    .find((action) => action.id === night.SLEEP_ACTION_ID));
  const porridge = authoredMissionFlowExclusiveActions(foodState)
    .find((action) => action.label === "朝粥を食べる");
  choose(foodState, porridge);
  assert.equal(foodState.playerState.player.hunger, 4);
  assert.equal(foodState.playerState.worldFlags["day2Merchant:morningPorridgeEaten"], true);
  assert.equal(foodState.playerState.worldFlags["day2Merchant:access:open"], true);

  assert.ok(!authoredMissionFlowExclusiveActions(foodState)
    ?.some((action) => action.authoredDay1T01VillageNightChoice));
});

test("night watch and well talk preserve different hidden causes", () => {
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

test("the night scene cannot be reached without the saved bread-sharing history", () => {
  const state = runtime();
  state.playerState.history.push({
    type: "T01_AFTERCARE_FINN_ROUTE_TESTIMONY",
    actionId: "MISSION_FLOW:T01:SQUARE_SUPPER:ask_finn",
  });
  assert.equal(night.nightEligible(state), false);
});
