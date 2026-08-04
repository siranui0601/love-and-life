import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_INTERNALS as internals,
} from "../../../src/server/trpg/content/authored-mission-flow-t13-workshop-interlude.js";

function runtimeFixture() {
  return {
    authoredMissionFlows: {
      "forest-king-slime-world-tree-collapse": {
        flowId: "forest-king-slime-world-tree-collapse",
        evidenceOrder: ["T13-EVIDENCE-MINA-ANCHOR-PUMP-DESIGN"],
      },
    },
    playerState: {
      absoluteMinute: 2441,
      player: {
        location: "ドワーフ洞窟",
        facilityId: "LOC_DWARF_ENGINEER",
      },
      missions: {
        "MSN-T13": { status: "in_progress" },
      },
      worldFlags: {},
      history: [],
    },
  };
}

const capitalMovement = {
  id: "MOVE_REGIONAL:王都",
  type: "regionalTravel",
  family: "travel",
  movementScope: "regional",
  destinationHub: "王都",
  destinationFacilityId: "LOC_CAP_GATE",
  targetLocation: "王都",
  minutes: 180,
  label: "王都へ旅立つ",
};

test("T13工房区間は短い三択を公開し、王都移動の実actionを引き継ぐ", () => {
  const runtime = runtimeFixture();
  const actions = internals.workshopInterludeActions(runtime, {
    movementActions: [capitalMovement],
  });

  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "水をがぶ飲みする",
    "ミーナを手伝う",
    "王都へ行く",
  ]);
  for (const action of actions) {
    assert.ok([...action.label].length <= 20, action.label);
    assert.match(action.id, /^MISSION_FLOW:T13:WORKSHOP_INTERLUDE:/u);
  }
  assert.equal(actions[2].destinationHub, "王都");
  assert.equal(actions[2].destinationFacilityId, "LOC_CAP_GATE");
  assert.equal(actions[2].authoredMissionWorkshopInterludeTargetActionId, capitalMovement.id);
});

test("水をがぶ飲みすると摂取履歴の種を保存し、未選択枝を閉じる", () => {
  const runtime = runtimeFixture();
  const [drink] = internals.workshopInterludeActions(runtime, {
    movementActions: [capitalMovement],
  });
  const result = { ok: true };

  assert.equal(internals.consumeWorkshopInterlude(runtime, drink, result), true);
  const state = runtime.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopWaterInterlude;
  assert.equal(state.selectedActionId, drink.id);
  assert.equal(state.closedActionIds.length, 2);
  assert.equal(runtime.playerState.worldFlags.t13WorkshopInterludeCompleted, true);
  assert.equal(runtime.playerState.worldFlags["t13Interlude:drankWorkshopWater"], true);
  assert.equal(runtime.playerState.history.at(-1).type, "T13_WORKSHOP_WATER_DRUNK");
  assert.equal(result.speeches[0].actorId, "NPC037");
  assert.match(result.summary, /甘さ/u);
  assert.equal(internals.workshopInterludeEligible(runtime), false);
});

test("固定杭の証拠がなければ工房区間は先回りして表示されない", () => {
  const runtime = runtimeFixture();
  runtime.authoredMissionFlows["forest-king-slime-world-tree-collapse"].evidenceOrder = [];
  assert.equal(internals.workshopInterludeEligible(runtime), false);
  assert.equal(internals.workshopInterludeActions(runtime, {
    movementActions: [capitalMovement],
  }), null);
});
