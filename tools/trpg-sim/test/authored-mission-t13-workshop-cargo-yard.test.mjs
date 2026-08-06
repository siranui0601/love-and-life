import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_MISSION_T13_WORKSHOP_CARGO_YARD_INTERNALS as internals,
} from "../../../src/server/trpg/content/authored-mission-flow-t13-workshop-cargo-yard.js";

function runtimeFixture() {
  return {
    authoredMissionFlows: {
      "forest-king-slime-world-tree-collapse": {
        flowId: "forest-king-slime-world-tree-collapse",
        workshopNightfall: {
          completedAtMinute: 2500,
          selectedActionId: internals.FORGE_MEAL_ACTION_ID,
          closedActionIds: [
            "MISSION_FLOW:T13:WORKSHOP_NIGHTFALL:ask_apprentice_to_carry_word",
            "MISSION_FLOW:T13:WORKSHOP_NIGHTFALL:take_first_watch",
          ],
        },
      },
    },
    playerState: {
      absoluteMinute: 2501,
      player: {
        location: "ドワーフ洞窟",
        facilityId: "LOC_DWARF_ENGINEER",
      },
      missions: {
        "MSN-T13": { status: "in_progress" },
      },
      worldFlags: {
        t13WorkshopNightfallCompleted: true,
        "t13WorkshopNightfall:forgeMealShared": true,
      },
      history: [{
        type: "T13_WORKSHOP_FORGE_MEAL_SHARED",
        minute: 2500,
        missionId: "MSN-T13",
      }],
    },
  };
}

test("炉端の食事後は荷車・荷札・昼寝の短い三択を表示する", () => {
  const runtime = runtimeFixture();
  const actions = internals.cargoYardActions(runtime);

  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "荷車を押す",
    "荷札を借りる",
    "荷台で寝る",
  ]);
  for (const action of actions) {
    assert.ok([...action.label].length <= 20, action.label);
    assert.match(action.id, /^MISSION_FLOW:T13:WORKSHOP_CARGO_YARD:/u);
  }
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
});

test("荷車を押すと食事履歴から旧道の輸送痕跡へ接続し、三択を反復しない", () => {
  const runtime = runtimeFixture();
  const action = internals.cargoYardActions(runtime)
    .find((candidate) => candidate.label === "荷車を押す");
  const result = { ok: true };

  assert.equal(internals.consumeCargoYard(runtime, action, result), true);
  const state = runtime.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopCargoYard;
  assert.equal(state.selectedActionId, action.id);
  assert.equal(state.closedActionIds.length, 2);
  assert.equal(runtime.playerState.worldFlags.t13WorkshopCargoYardCompleted, true);
  assert.equal(runtime.playerState.worldFlags["t13WorkshopCargoYard:cartFreed"], true);
  assert.equal(runtime.playerState.history.at(-1).type, "T13_WORKSHOP_STUCK_CART_FREED");
  assert.equal(runtime.playerState.history.at(-1).sourceHistoryType, "T13_WORKSHOP_FORGE_MEAL_SHARED");
  assert.equal(result.speeches[0].actorId, "NPC037");
  assert.match(result.sceneTransition, /旧道/u);
  assert.equal(internals.cargoYardEligible(runtime), false);
  assert.equal(internals.cargoYardActions(runtime), null);
});

test("荷札と荷台の睡眠は異なる隠れた因果を保存する", () => {
  const tagRuntime = runtimeFixture();
  const tag = internals.cargoYardActions(tagRuntime)
    .find((action) => action.label === "荷札を借りる");
  internals.consumeCargoYard(tagRuntime, tag, { ok: true });
  assert.equal(tagRuntime.playerState.worldFlags["t13WorkshopCargoYard:cargoTagBorrowed"], true);
  assert.equal(tagRuntime.playerState.history.at(-1).type, "T13_WORKSHOP_CARGO_TAG_BORROWED");

  const sleepRuntime = runtimeFixture();
  const sleep = internals.cargoYardActions(sleepRuntime)
    .find((action) => action.label === "荷台で寝る");
  const result = { ok: true };
  internals.consumeCargoYard(sleepRuntime, sleep, result);
  assert.equal(sleepRuntime.playerState.worldFlags["t13WorkshopCargoYard:cartBedSleep"], true);
  assert.equal(sleepRuntime.playerState.history.at(-1).type, "T13_WORKSHOP_CART_BED_SLEEP");
  assert.match(result.sceneTransition, /足音/u);
});

test("食事以外の夜枝や工房離脱後には荷車三択を表示しない", () => {
  const watch = runtimeFixture();
  watch.authoredMissionFlows["forest-king-slime-world-tree-collapse"]
    .workshopNightfall.selectedActionId =
      "MISSION_FLOW:T13:WORKSHOP_NIGHTFALL:take_first_watch";
  assert.equal(internals.cargoYardEligible(watch), false);

  const departed = runtimeFixture();
  departed.playerState.player.location = "王都";
  departed.playerState.player.facilityId = "LOC_CAP_GATE";
  assert.equal(internals.cargoYardEligible(departed), false);
});
