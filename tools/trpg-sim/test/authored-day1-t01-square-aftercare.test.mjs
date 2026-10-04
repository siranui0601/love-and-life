import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY1_T01_SQUARE_AFTERCARE_INTERNALS as internals,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime() {
  return {
    playerState: {
      day: 1,
      absoluteMinute: 780,
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_SQUARE",
        needs: { hunger: 60, fatigue: 10 },
      },
      missions: [{
        id: "MSN-T01",
        troubleId: "T01",
        status: "completed",
        completedAt: 780,
      }],
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

test("Day1 T01 rescue reaches a short three-choice aftercare scene", () => {
  const state = runtime();
  const guidance = authoredMissionFlowGuidance(state);
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(guidance.title, "救出の後に何をするか");
  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "ミラを手伝う",
    "村長に記録を渡す",
    "子どもと遊ぶ",
  ]);
  for (const action of actions) {
    assert.ok(action.label.length >= 4 && action.label.length <= 20);
    assert.ok(action.id.length <= 120);
  }
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
});

test("play_children uses canonical child NPC062 and never Eda NPC004 as the speaker", () => {
  const state = runtime();
  const playChildren = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === "MISSION_FLOW:T01:SQUARE_AFTERCARE:play_children");

  assert.ok(playChildren);
  assert.equal(playChildren.targetNpcId, "NPC062");
  assert.equal(playChildren.authoredDay1T01AftercareSpeech.actorId, "NPC062");
  assert.notEqual(playChildren.targetNpcId, "NPC004");
});

test("helping Mira closes the other branches and opens a different supper scene", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);
  const help = actions.find((action) => action.id === internals.HELP_ACTION_ID);
  const result = choose(state, help);

  const saved = state.playerState.day1T01Aftercare;
  assert.equal(saved.aftercareSelectedActionId, internals.HELP_ACTION_ID);
  assert.equal(saved.aftercareClosedActionIds.length, 2);
  assert.ok(!saved.aftercareClosedActionIds.includes(internals.HELP_ACTION_ID));
  assert.equal(saved.nextSceneId, internals.SUPPER_SCENE_ID);
  assert.equal(state.playerState.worldFlags["t01Aftercare:miraHelped"], true);
  assert.equal(result.sceneTransition, internals.SUPPER_SCENE_ID);
  assert.match(result.speeches[0].text, /フィンが目を覚ました時/u);

  const nextGuidance = authoredMissionFlowGuidance(state);
  const nextActions = authoredMissionFlowExclusiveActions(state);
  assert.equal(nextGuidance.title, "救出後の夕食");
  assert.deepEqual(nextActions.map((action) => action.label), [
    "パンをちぎる",
    "フィンに道を聞く",
    "早めに休む",
  ]);
  assert.equal(nextActions.length, 3);
});

test("the supper branches produce different state and do not repeat", () => {
  const state = runtime();
  const help = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === internals.HELP_ACTION_ID);
  choose(state, help);

  const supper = authoredMissionFlowExclusiveActions(state);
  const testimony = supper.find((action) => action.label === "フィンに道を聞く");
  const result = choose(state, testimony);

  assert.equal(state.playerState.worldFlags["t01Aftercare:finnRouteTestimony"], true);
  assert.equal(
    state.playerState.evidence["T01-EVIDENCE-FINN-ROUTE-TESTIMONY"].sourceId,
    "NPC001:POST_RESCUE_SUPPER",
  );
  assert.equal(state.playerState.day1T01Aftercare.supperClosedActionIds.length, 2);
  assert.match(result.summary, /村側へ回り込んだ/u);

  const repeated = authoredMissionFlowExclusiveActions(state);
  assert.ok(!repeated?.some((action) => action.authoredDay1T01AftercareChoice));
});

test("sharing bread is the actual zero-gold supper, not a second hidden provision", () => {
  const state = runtime();
  const help = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === internals.HELP_ACTION_ID);
  choose(state, help);

  const bread = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === "MISSION_FLOW:T01:SQUARE_SUPPER:share_bread");
  const result = choose(state, bread);

  assert.equal(state.playerState.player.needs.hunger, 2);
  assert.equal(result.meal.price, 0);
  assert.equal(result.meal.hungerReduced, 58);
  assert.equal(result.meal.source, "Mira and Finn's shared bread");
});

test("eligibility reads do not mutate the persisted runtime", () => {
  const state = runtime();
  assert.equal(state.playerState.day1T01Aftercare, undefined);

  assert.equal(internals.aftercareEligible(state), true);
  assert.equal(internals.supperEligible(state), false);
  assert.equal(state.playerState.day1T01Aftercare, undefined);
});

test("aftercare noon gate uses the canonical 10:00-based wall clock", () => {
  const state = runtime();
  state.playerState.absoluteMinute = 292;
  state.playerState.missions[0].completedAt = 292;
  assert.equal(internals.withinDay1AftercareWindow(state), true);
  assert.equal(internals.aftercareEligible(state), true);

  const beforeNoon = runtime();
  beforeNoon.playerState.absoluteMinute = 119;
  assert.equal(internals.withinDay1AftercareWindow(beforeNoon), false);

  const noon = runtime();
  noon.playerState.absoluteMinute = 120;
  assert.equal(internals.withinDay1AftercareWindow(noon), true);
});

test("the scene is absent before formal completion, before Finn returns, outside the square, or outside the Day1 aftermath window", () => {
  const before = runtime();
  before.playerState.missions[0].status = "active";
  before.playerState.missions[0].completedAt = null;
  before.playerState.worldFlags.t01Resolved = false;
  assert.equal(internals.aftercareEligible(before), false);

  const resolvedFlagOnly = runtime();
  resolvedFlagOnly.playerState.missions[0].completedAt = null;
  assert.equal(internals.aftercareEligible(resolvedFlagOnly), false);

  const returnedButUndecided = runtime();
  returnedButUndecided.playerState.missions[0].status = "active";
  returnedButUndecided.playerState.missions[0].completedAt = null;
  returnedButUndecided.playerState.worldFlags.t01Resolved = false;
  assert.equal(internals.aftercareEligible(returnedButUndecided), false);

  const notReturned = runtime();
  delete notReturned.playerState.worldFlags.t01FinnReturned;
  assert.equal(internals.aftercareEligible(notReturned), false);

  const away = runtime();
  away.playerState.player.facilityId = "LOC_FARM_INN";
  assert.equal(internals.aftercareEligible(away), false);

  const morningFixture = runtime();
  morningFixture.playerState.absoluteMinute = 60;
  assert.equal(internals.aftercareEligible(morningFixture), false);

  const day2 = runtime();
  day2.playerState.day = 2;
  day2.playerState.absoluteMinute = 1920;
  assert.equal(internals.aftercareEligible(day2), false);
});