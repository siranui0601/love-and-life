import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY8_T03_NIGHT_VIGIL_INTERNALS as vigil,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime() {
  return {
    playerState: {
      day: 8,
      absoluteMinute: 7 * 1440 + 22 * 60 + 40,
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_NORTH_FENCE",
        hunger: 61,
        fatigue: 64,
        needs: { hunger: 61, fatigue: 64 },
      },
      day2Day8VillageWatch: {
        howlCompletedAtMinute: 7 * 1440 + 22 * 60 + 40,
      },
      worldFlags: {},
      history: [],
      goapRequests: {},
    },
  };
}

function choose(state, choiceId) {
  const action = authoredMissionFlowExclusiveActions(state)
    ?.find((entry) => entry.authoredDay8T03NightVigilChoice === choiceId);
  assert.ok(action, `${choiceId} must be visible`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return { action, result };
}

test("the Day8 howl opens three public dawn-watch choices", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.equal(authoredMissionFlowGuidance(state).title, "北柵の夜を誰が引き受けるか");
  assert.deepEqual(actions.map((entry) => entry.authoredDay8T03NightVigilChoice), [
    "keep_written_watch_until_dawn",
    "rotate_short_patrols",
    "hand_watch_to_jill",
  ]);
  assert.ok(actions.every((entry) => entry.id === entry.actionId));
});

test("staying until dawn creates real collapse pressure and inspectable Jill work", () => {
  const state = runtime();
  const { result } = choose(state, "keep_written_watch_until_dawn");
  assert.equal(state.playerState.player.needs.hunger, 75);
  assert.equal(state.playerState.player.needs.fatigue, 100);
  assert.equal(state.playerState.worldFlags["day8WolfWatch:playerStayedUntilDawn"], true);
  assert.equal(state.playerState.goapRequests["GOAP-DAY8-T03-DAWN-RELIEF"].actorNpcId, "NPC060");
  assert.equal(result.closedActionIds.length, 2);
  assert.equal(vigil.actions(state), null);
});

test("rotating or handing off preserves distinct non-collapse alternatives", () => {
  const rotated = runtime();
  choose(rotated, "rotate_short_patrols");
  assert.equal(rotated.playerState.player.needs.fatigue, 86);
  assert.equal(rotated.playerState.worldFlags["day8WolfWatch:rotatingPatrolsUsed"], true);

  const handed = runtime();
  choose(handed, "hand_watch_to_jill");
  assert.equal(handed.playerState.player.needs.fatigue, 68);
  assert.equal(handed.playerState.worldFlags["day8WolfWatch:jillTookDawnWatch"], true);
});

test("the vigil is unavailable before the howl or away from the fence", () => {
  const before = runtime();
  before.playerState.day2Day8VillageWatch.howlCompletedAtMinute = null;
  assert.equal(vigil.actions(before), null);

  const away = runtime();
  away.playerState.player.facilityId = "LOC_FARM_SQUARE";
  assert.equal(vigil.actions(away), null);
});
