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
      absoluteMinute: 780,
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_SQUARE",
      },
      missions: [{ id: "MSN-T01", troubleId: "T01", status: "completed" }],
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

test("the scene is absent before rescue completion, before Finn returns, or outside the village square", () => {
  const before = runtime();
  before.playerState.missions[0].status = "active";
  before.playerState.worldFlags = {};
  assert.equal(internals.aftercareEligible(before), false);

  const notReturned = runtime();
  delete notReturned.playerState.worldFlags.t01FinnReturned;
  assert.equal(internals.aftercareEligible(notReturned), false);

  const away = runtime();
  away.playerState.player.facilityId = "LOC_FARM_INN";
  assert.equal(internals.aftercareEligible(away), false);
});