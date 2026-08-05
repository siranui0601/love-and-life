import assert from "node:assert/strict";
import test from "node:test";

import {
  selectDay100CompanionRouteDecision,
  DAY100_COMPANION_ROUTE_INTERNALS as companion,
} from "../lib/day100-companion-route-strategy.mjs";

function coverageState() {
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
    [companion.FOCUS_STATE_KEY]: "MSN-T11",
  };
}

function saveWithGenericT11Choice() {
  return {
    world: { ended: false },
    battle: null,
    tutorial: null,
    clock: { day: 21, hour: 5, time: "05:35", absoluteMinute: 29015 },
    scene: {
      location: "王都",
      facilityId: "LOC_CAP_LOWER_INN",
      beats: [],
    },
    guidance: { missionId: "MSN-T11" },
    player: {
      gold: 30,
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
        choiceId: "T11-CONTRACT-FOCUS",
        actionId: "MISSION_FLOW:capital-assassination-plot:NAVIGATOR_FOCUS:contract_chain",
        missionId: "MSN-T17",
        family: "coordination",
        label: "分割契約の流れを追う",
      },
    ],
    movement: [],
    missions: [
      {
        id: "MSN-T11",
        troubleId: "T11",
        title: "王都の暗殺計画",
        kind: "special",
        status: "active",
        currentStep: {
          id: "investigate",
          targetLocation: "王都",
          targetFacilityId: "LOC_CAP_LOWER_INN",
        },
      },
      {
        id: "MSN-T17",
        troubleId: "T17",
        title: "王都の第二召喚儀式",
        kind: "special",
        status: "active",
        currentStep: {
          id: "investigate",
          targetLocation: "王都",
          targetFacilityId: "LOC_CAP_MAGE_TOWER",
        },
      },
    ],
    rumors: [],
  };
}

const model = {
  troubles: [
    {
      id: "T11",
      name: "王都の暗殺計画",
      startDay: 20,
      deadlineDay: 35,
      finalDay: 55,
      primaryLocations: ["王都", "犯罪都市"],
    },
    {
      id: "T17",
      name: "王都の第二召喚儀式",
      startDay: 20,
      deadlineDay: 40,
      finalDay: 60,
      primaryLocations: ["王都"],
    },
  ],
  adjacency: {},
};

test("汎用T11 actionの誤missionIdより保持中の正式guidanceを優先する", () => {
  const state = coverageState();
  const decision = selectDay100CompanionRouteDecision({
    save: saveWithGenericT11Choice(),
    model,
    state,
  });

  assert.equal(decision.type, "CHOOSE");
  assert.equal(
    decision.actionId,
    "MISSION_FLOW:capital-assassination-plot:NAVIGATOR_FOCUS:contract_chain",
  );
  assert.equal(decision.missionId, "MSN-T11");
  assert.equal(state[companion.FOCUS_STATE_KEY], "MSN-T11");
});

test("番号付き手書きactionは表示メタデータよりaction IDの事件を優先する", () => {
  const save = saveWithGenericT11Choice();
  save.choices = [
    {
      choiceId: "T11-ESCORT-CROW",
      actionId: "MISSION_FLOW:T11:WITNESS_NETWORK:t11-crow-ledger-aftermath:escort_crow",
      missionId: "MSN-T17",
      family: "rescue",
      label: "クロウを連れ出す",
    },
  ];
  const state = coverageState();
  const decision = selectDay100CompanionRouteDecision({ save, model, state });
  assert.equal(decision.missionId, "MSN-T11");
  assert.equal(state[companion.FOCUS_STATE_KEY], "MSN-T11");
});