import assert from "node:assert/strict";
import test from "node:test";

import { selectDay100CompanionRouteDecision } from "../lib/day100-companion-route-strategy.mjs";

function state() {
  return {
    acknowledgedIntroductionTokens: [],
    blockedDecisionKeys: {},
    recentDecisionKeys: [],
    triedStockIds: [],
    weaponTypesTried: [],
    equippedEquipmentIds: [],
    knownMealSources: {},
    failedMealSourceContexts: {},
    visitedFacilities: {},
    visitedHubs: {},
    actionCount: 0,
    trouble: {},
  };
}

test("T03 guidance中は同時表示されたT13継続枝へ横滑りしない", () => {
  const save = {
    world: { ended: false },
    battle: null,
    tutorial: null,
    clock: { day: 8, hour: 5, time: "05:00", absoluteMinute: 10380 },
    scene: { location: "田園の村", facilityId: "LOC_FARM_NORTH_FENCE", beats: [] },
    guidance: { missionId: "MSN-T03" },
    player: {
      gold: 20,
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 20, fatigue: 20 },
      inventory: { equipment: [] },
      equipment: {},
    },
    skills: { learnable: [] },
    shop: { available: false, stock: [], rewards: [], loans: [] },
    choices: [
      {
        choiceId: "T03-CHILDREN",
        actionId: "MISSION_FLOW:T03:DAY8_FIRST_HOWL:send_children_home",
        missionId: "MSN-T03",
        family: "rescue",
        label: "子どもを家へ返す",
      },
      {
        choiceId: "T13-CONTINUE",
        actionId: "MISSION_FLOW:T13:RV_CAN:ask_survivors_to_search",
        missionId: "MSN-T03",
        family: "coordination",
        label: "生存者と捜索を続ける",
      },
    ],
    movement: [],
    missions: [],
    rumors: [],
  };

  const decision = selectDay100CompanionRouteDecision({
    save,
    model: { troubles: [], adjacency: {} },
    state: state(),
  });

  assert.equal(decision.actionId, "MISSION_FLOW:T03:DAY8_FIRST_HOWL:send_children_home");
  assert.equal(decision.missionId, "MSN-T03");
});
