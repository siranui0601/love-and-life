import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_MISSION_T13_WORKSHOP_NIGHTFALL_INTERNALS as internals,
} from "../../../src/server/trpg/content/authored-mission-flow-t13-workshop-nightfall.js";

function runtimeFixture() {
  return {
    authoredMissionFlows: {
      "forest-king-slime-world-tree-collapse": {
        flowId: "forest-king-slime-world-tree-collapse",
        workshopSealWitness: {
          completedAtMinute: 2470,
          selectedActionId: internals.LEDGER_SIGNED_ACTION_ID,
          closedActionIds: [
            "MISSION_FLOW:T13:WORKSHOP_SEAL:sketch_sealed_bottle",
            "MISSION_FLOW:T13:WORKSHOP_SEAL:show_off_sealed_sample",
          ],
        },
      },
    },
    playerState: {
      absoluteMinute: 2471,
      player: {
        location: "ドワーフ洞窟",
        facilityId: "LOC_DWARF_ENGINEER",
      },
      missions: {
        "MSN-T13": { status: "in_progress" },
      },
      worldFlags: {
        t13WorkshopSealWitnessCompleted: true,
        "t13SealWitness:ledgerSigned": true,
      },
      history: [{
        type: "T13_WORKSHOP_SAMPLE_LEDGER_SIGNED",
        minute: 2470,
        missionId: "MSN-T13",
      }],
    },
  };
}

test("署名後は食事・伝言・夜番の短い三択を表示する", () => {
  const runtime = runtimeFixture();
  const actions = internals.nightfallActions(runtime);

  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "炉端で粥を食べる",
    "村へ伝言を頼む",
    "夜番を引き受ける",
  ]);
  for (const action of actions) {
    assert.ok([...action.label].length <= 20, action.label);
    assert.match(action.id, /^MISSION_FLOW:T13:WORKSHOP_NIGHTFALL:/u);
  }
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
});

test("炉端の食事は生活履歴と署名からの因果を保存し、同じ三択を反復しない", () => {
  const runtime = runtimeFixture();
  const meal = internals.nightfallActions(runtime)
    .find((action) => action.label === "炉端で粥を食べる");
  const result = { ok: true };

  assert.equal(internals.consumeNightfall(runtime, meal, result), true);
  const state = runtime.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopNightfall;
  assert.equal(state.selectedActionId, meal.id);
  assert.equal(state.closedActionIds.length, 2);
  assert.equal(runtime.playerState.worldFlags.t13WorkshopNightfallCompleted, true);
  assert.equal(runtime.playerState.worldFlags["t13WorkshopNightfall:forgeMealShared"], true);
  assert.equal(runtime.playerState.history.at(-1).type, "T13_WORKSHOP_FORGE_MEAL_SHARED");
  assert.equal(runtime.playerState.history.at(-1).sourceHistoryType, "T13_WORKSHOP_SAMPLE_LEDGER_SIGNED");
  assert.equal(runtime.playerState.history.at(-1).sampleCustody, "NPC037");
  assert.equal(result.speeches[0].actorId, "NPC037");
  assert.match(result.summary, /麦粥/u);
  assert.equal(internals.nightfallEligible(runtime), false);
  assert.equal(internals.nightfallActions(runtime), null);
});

test("村への伝言と夜番は異なる後続因果を残す", () => {
  const messageRuntime = runtimeFixture();
  const message = internals.nightfallActions(messageRuntime)
    .find((action) => action.label === "村へ伝言を頼む");
  internals.consumeNightfall(messageRuntime, message, { ok: true });
  assert.equal(messageRuntime.playerState.worldFlags["t13WorkshopNightfall:villageMessageQueued"], true);
  assert.equal(messageRuntime.playerState.history.at(-1).type, "T13_WORKSHOP_VILLAGE_MESSAGE_QUEUED");

  const watchRuntime = runtimeFixture();
  const watch = internals.nightfallActions(watchRuntime)
    .find((action) => action.label === "夜番を引き受ける");
  const result = { ok: true };
  internals.consumeNightfall(watchRuntime, watch, result);
  assert.equal(watchRuntime.playerState.worldFlags["t13WorkshopNightfall:firstWatchTaken"], true);
  assert.equal(watchRuntime.playerState.history.at(-1).type, "T13_WORKSHOP_FIRST_WATCH_TAKEN");
  assert.match(result.sceneTransition, /荷車/u);
});

test("署名していない枝や工房離脱後には夜の三択を表示しない", () => {
  const sketch = runtimeFixture();
  sketch.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopSealWitness.selectedActionId =
      "MISSION_FLOW:T13:WORKSHOP_SEAL:sketch_sealed_bottle";
  assert.equal(internals.nightfallEligible(sketch), false);

  const departed = runtimeFixture();
  departed.playerState.player.location = "王都";
  departed.playerState.player.facilityId = "LOC_CAP_GATE";
  assert.equal(internals.nightfallEligible(departed), false);
});
