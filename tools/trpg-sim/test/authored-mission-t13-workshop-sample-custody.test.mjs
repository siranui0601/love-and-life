import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_MISSION_T13_WORKSHOP_SAMPLE_CUSTODY_INTERNALS as internals,
} from "../../../src/server/trpg/content/authored-mission-flow-t13-workshop-sample-custody.js";

function runtimeFixture() {
  return {
    authoredMissionFlows: {
      "forest-king-slime-world-tree-collapse": {
        flowId: "forest-king-slime-world-tree-collapse",
        workshopWaterInterlude: {
          completedAtMinute: 2441,
          selectedActionId: "MISSION_FLOW:T13:WORKSHOP_INTERLUDE:drink_workshop_water",
          closedActionIds: [],
        },
        workshopWaterAftertaste: {
          completedAtMinute: 2453,
          selectedActionId: internals.INSPECT_ACTION_ID,
          closedActionIds: [
            "MISSION_FLOW:T13:WORKSHOP_AFTERTASTE:pretend_nothing_happened",
            "MISSION_FLOW:T13:WORKSHOP_AFTERTASTE:spit_out_workshop_water",
          ],
        },
      },
    },
    playerState: {
      absoluteMinute: 2454,
      player: {
        location: "ドワーフ洞窟",
        facilityId: "LOC_DWARF_ENGINEER",
      },
      missions: {
        "MSN-T13": { status: "in_progress" },
      },
      worldFlags: {
        t13WorkshopAftertasteCompleted: true,
        "t13Aftertaste:bucketSampleSealed": true,
      },
      history: [{
        type: "T13_WORKSHOP_BUCKET_SAMPLE_SEALED",
        minute: 2453,
        missionId: "MSN-T13",
      }],
    },
  };
}

test("桶の試料を封じた後は、保管・移動・好奇心の短い三択を表示する", () => {
  const runtime = runtimeFixture();
  const actions = internals.sampleCustodyActions(runtime, {
    movementActions: [{
      id: "MOVE_REGIONAL:王都",
      type: "regionalTravel",
      family: "travel",
      minutes: 180,
      movementScope: "regional",
      destinationHub: "王都",
      destinationFacilityId: "LOC_CAP_GATE",
    }],
  });

  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "ミーナに預ける",
    "王都へ運ぶ",
    "栓を嗅いでみる",
  ]);
  for (const action of actions) {
    assert.ok([...action.label].length <= 20, action.label);
    assert.match(action.id, /^MISSION_FLOW:T13:WORKSHOP_SAMPLE:/u);
  }

  const capital = actions.find((action) => action.label === "王都へ運ぶ");
  assert.equal(capital.movementScope, "regional");
  assert.equal(capital.destinationHub, "王都");
  assert.equal(capital.destinationFacilityId, "LOC_CAP_GATE");
  assert.equal(capital.authoredMissionWorkshopSampleTargetActionId, "MOVE_REGIONAL:王都");
  assert.equal(capital.minutes, 189);
});

test("ミーナへ預けると採取履歴から保管履歴を保存し、同じ三択を反復しない", () => {
  const runtime = runtimeFixture();
  const actions = internals.sampleCustodyActions(runtime);
  const leave = actions.find((action) => action.label === "ミーナに預ける");
  const result = { ok: true };

  assert.equal(internals.consumeSampleCustody(runtime, leave, result), true);
  const state = runtime.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopSampleCustody;
  assert.equal(state.selectedActionId, leave.id);
  assert.equal(state.closedActionIds.length, 2);
  assert.equal(state.custody, "NPC037");
  assert.equal(runtime.playerState.worldFlags.t13WorkshopSampleCustodyCompleted, true);
  assert.equal(runtime.playerState.worldFlags["t13SampleCustody:sealedAtWorkshop"], true);
  assert.equal(runtime.playerState.history.at(-1).type, "T13_WORKSHOP_SAMPLE_LEFT_WITH_MINA");
  assert.equal(runtime.playerState.history.at(-1).sourceHistoryType, "T13_WORKSHOP_BUCKET_SAMPLE_SEALED");
  assert.equal(runtime.playerState.history.at(-1).sampleCustody, "NPC037");
  assert.equal(result.speeches[0].actorId, "NPC037");
  assert.match(result.summary, /工房印/u);
  assert.equal(internals.sampleCustodyEligible(runtime), false);
  assert.equal(internals.sampleCustodyActions(runtime), null);
});

test("桶を調べなかった枝や工房を離れた状態では試料の三択を表示しない", () => {
  const bluff = runtimeFixture();
  bluff.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopWaterAftertaste.selectedActionId =
      "MISSION_FLOW:T13:WORKSHOP_AFTERTASTE:pretend_nothing_happened";
  assert.equal(internals.sampleCustodyEligible(bluff), false);

  const departed = runtimeFixture();
  departed.playerState.player.location = "王都";
  departed.playerState.player.facilityId = "LOC_CAP_GATE";
  assert.equal(internals.sampleCustodyEligible(departed), false);
});
