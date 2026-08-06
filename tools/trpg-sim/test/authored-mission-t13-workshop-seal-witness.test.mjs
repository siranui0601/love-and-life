import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_MISSION_T13_WORKSHOP_SEAL_WITNESS_INTERNALS as internals,
} from "../../../src/server/trpg/content/authored-mission-flow-t13-workshop-seal-witness.js";

function runtimeFixture() {
  return {
    authoredMissionFlows: {
      "forest-king-slime-world-tree-collapse": {
        flowId: "forest-king-slime-world-tree-collapse",
        workshopSampleCustody: {
          completedAtMinute: 2462,
          selectedActionId: internals.LEFT_WITH_MINA_ACTION_ID,
          closedActionIds: [
            "MISSION_FLOW:T13:WORKSHOP_SAMPLE:carry_sample_to_capital",
            "MISSION_FLOW:T13:WORKSHOP_SAMPLE:smell_sample_stop",
          ],
          custody: "NPC037",
        },
      },
    },
    playerState: {
      absoluteMinute: 2463,
      player: {
        location: "ドワーフ洞窟",
        facilityId: "LOC_DWARF_ENGINEER",
      },
      missions: {
        "MSN-T13": { status: "in_progress" },
      },
      worldFlags: {
        t13WorkshopSampleCustodyCompleted: true,
        "t13SampleCustody:sealedAtWorkshop": true,
      },
      history: [{
        type: "T13_WORKSHOP_SAMPLE_LEFT_WITH_MINA",
        minute: 2462,
        missionId: "MSN-T13",
      }],
    },
  };
}

test("ミーナへ試料を預けた後は、記録・写生・噂の短い三択を表示する", () => {
  const runtime = runtimeFixture();
  const actions = internals.sealWitnessActions(runtime);

  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "帳面に署名する",
    "瓶を絵に描く",
    "弟子に見せびらかす",
  ]);
  for (const action of actions) {
    assert.ok([...action.label].length <= 20, action.label);
    assert.match(action.id, /^MISSION_FLOW:T13:WORKSHOP_SEAL:/u);
  }
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
});

test("帳面へ署名すると保管履歴との因果と閉じた枝を保存し、同じ三択を反復しない", () => {
  const runtime = runtimeFixture();
  const actions = internals.sealWitnessActions(runtime);
  const sign = actions.find((action) => action.label === "帳面に署名する");
  const result = { ok: true };

  assert.equal(internals.consumeSealWitness(runtime, sign, result), true);
  const state = runtime.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopSealWitness;
  assert.equal(state.selectedActionId, sign.id);
  assert.equal(state.closedActionIds.length, 2);
  assert.equal(runtime.playerState.worldFlags.t13WorkshopSealWitnessCompleted, true);
  assert.equal(runtime.playerState.worldFlags["t13SealWitness:ledgerSigned"], true);
  assert.equal(runtime.playerState.history.at(-1).type, "T13_WORKSHOP_SAMPLE_LEDGER_SIGNED");
  assert.equal(runtime.playerState.history.at(-1).sourceHistoryType, "T13_WORKSHOP_SAMPLE_LEFT_WITH_MINA");
  assert.equal(runtime.playerState.history.at(-1).sampleCustody, "NPC037");
  assert.equal(result.speeches[0].actorId, "NPC037");
  assert.match(result.summary, /立会人/u);
  assert.equal(internals.sealWitnessEligible(runtime), false);
  assert.equal(internals.sealWitnessActions(runtime), null);
});

test("瓶の写生と弟子への見せびらかしは異なる履歴と世界状態を残す", () => {
  const sketchRuntime = runtimeFixture();
  const sketch = internals.sealWitnessActions(sketchRuntime)
    .find((action) => action.label === "瓶を絵に描く");
  internals.consumeSealWitness(sketchRuntime, sketch, { ok: true });
  assert.equal(sketchRuntime.playerState.worldFlags["t13SealWitness:bottleSketchMade"], true);
  assert.equal(sketchRuntime.playerState.history.at(-1).type, "T13_WORKSHOP_SAMPLE_BOTTLE_SKETCHED");

  const boastRuntime = runtimeFixture();
  const boast = internals.sealWitnessActions(boastRuntime)
    .find((action) => action.label === "弟子に見せびらかす");
  internals.consumeSealWitness(boastRuntime, boast, { ok: true });
  assert.equal(boastRuntime.playerState.worldFlags["t13SealWitness:apprenticesAware"], true);
  assert.equal(boastRuntime.playerState.history.at(-1).type, "T13_WORKSHOP_SAMPLE_SHOWN_TO_APPRENTICES");
});

test("別の保管枝や工房離脱後には立会い三択を表示しない", () => {
  const carried = runtimeFixture();
  carried.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopSampleCustody.selectedActionId =
      "MISSION_FLOW:T13:WORKSHOP_SAMPLE:carry_sample_to_capital";
  carried.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopSampleCustody.custody = "PLAYER";
  assert.equal(internals.sealWitnessEligible(carried), false);

  const departed = runtimeFixture();
  departed.playerState.player.location = "王都";
  departed.playerState.player.facilityId = "LOC_CAP_GATE";
  assert.equal(internals.sealWitnessEligible(departed), false);
});
