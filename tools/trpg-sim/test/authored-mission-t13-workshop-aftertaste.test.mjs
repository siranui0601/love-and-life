import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_MISSION_T13_WORKSHOP_AFTERTASTE_INTERNALS as internals,
} from "../../../src/server/trpg/content/authored-mission-flow-t13-workshop-aftertaste.js";

function runtimeFixture() {
  return {
    authoredMissionFlows: {
      "forest-king-slime-world-tree-collapse": {
        flowId: "forest-king-slime-world-tree-collapse",
        workshopWaterInterlude: {
          completedAtMinute: 2441,
          selectedActionId: internals.DRINK_ACTION_ID,
          closedActionIds: [
            "MISSION_FLOW:T13:WORKSHOP_INTERLUDE:help_mina_clean_up",
            "MISSION_FLOW:T13:WORKSHOP_INTERLUDE:leave_for_capital",
          ],
        },
      },
    },
    playerState: {
      absoluteMinute: 2445,
      player: {
        location: "ドワーフ洞窟",
        facilityId: "LOC_DWARF_ENGINEER",
      },
      missions: {
        "MSN-T13": { status: "in_progress" },
      },
      worldFlags: {
        t13WorkshopInterludeCompleted: true,
        "t13Interlude:drankWorkshopWater": true,
      },
      history: [{
        type: "T13_WORKSHOP_WATER_DRUNK",
        minute: 2441,
        missionId: "MSN-T13",
      }],
    },
  };
}

test("試験水を飲んだ直後は、同じ三択ではなく短い後続三択を表示する", () => {
  const runtime = runtimeFixture();
  const actions = internals.aftertasteActions(runtime);

  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "桶を調べる",
    "平気な顔をする",
    "水を吐き出す",
  ]);
  for (const action of actions) {
    assert.ok([...action.label].length <= 20, action.label);
    assert.match(action.id, /^MISSION_FLOW:T13:WORKSHOP_AFTERTASTE:/u);
  }
});

test("平気な顔をすると噂の種と閉じた枝を保存し、後続三択を反復しない", () => {
  const runtime = runtimeFixture();
  const actions = internals.aftertasteActions(runtime);
  const bluff = actions.find((action) => action.label === "平気な顔をする");
  const result = { ok: true };

  assert.equal(internals.consumeAftertaste(runtime, bluff, result), true);
  const state = runtime.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopWaterAftertaste;
  assert.equal(state.selectedActionId, bluff.id);
  assert.equal(state.closedActionIds.length, 2);
  assert.equal(runtime.playerState.worldFlags.t13WorkshopAftertasteCompleted, true);
  assert.equal(runtime.playerState.worldFlags["t13Aftertaste:workshopBravadoRumorSeed"], true);
  assert.equal(runtime.playerState.history.at(-1).type, "T13_WORKSHOP_BRAVADO_RUMOR_SEED");
  assert.equal(runtime.playerState.history.at(-1).sourceHistoryType, "T13_WORKSHOP_WATER_DRUNK");
  assert.equal(result.speeches[0].actorId, "NPC037");
  assert.match(result.summary, /弟子たち/u);
  assert.equal(internals.aftertasteEligible(runtime), false);
  assert.equal(internals.aftertasteActions(runtime), null);
});

test("水を飲まなかった枝や工房を離れた状態では後続場面を表示しない", () => {
  const helped = runtimeFixture();
  helped.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopWaterInterlude.selectedActionId =
      "MISSION_FLOW:T13:WORKSHOP_INTERLUDE:help_mina_clean_up";
  assert.equal(internals.aftertasteEligible(helped), false);

  const departed = runtimeFixture();
  departed.playerState.player.location = "王都";
  departed.playerState.player.facilityId = "LOC_CAP_GATE";
  assert.equal(internals.aftertasteEligible(departed), false);
});
