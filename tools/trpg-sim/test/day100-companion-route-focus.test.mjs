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
          progress: 0,
          required: 4,
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
          progress: 0,
          required: 6,
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

test("長期事件は一つの証拠段階が進んだら焦点を解放して期限を再比較する", () => {
  const save = saveWithGenericT11Choice();
  const t17 = save.missions.find((mission) => mission.id === "MSN-T17");
  t17.currentStep.progress = 1;
  const state = coverageState();
  state[companion.FOCUS_STATE_KEY] = "MSN-T17";
  state[companion.FOCUS_SIGNATURE_STATE_KEY] = "active:investigate:0:6";

  assert.equal(companion.focusedMissionId(save, state), null);
  assert.equal(state[companion.FOCUS_STATE_KEY], undefined);
  assert.equal(state[companion.FOCUS_SIGNATURE_STATE_KEY], undefined);
});

test("T11証人保護の連続sceneは証拠進捗が変わっても途中で焦点を外さない", () => {
  const save = saveWithGenericT11Choice();
  const t11 = save.missions.find((mission) => mission.id === "MSN-T11");
  t11.currentStep.progress = 2;
  save.choices = [
    {
      choiceId: "T11-VERA-ROOM",
      actionId: "MISSION_FLOW:T11:WITNESS_NETWORK:t11-black-lamp-shelter:ask_vera_for_room",
      missionId: "MSN-T11",
      family: "rescue",
      label: "ヴェラに部屋を借りる",
    },
  ];
  const state = coverageState();
  state[companion.FOCUS_SIGNATURE_STATE_KEY] = "active:investigate:1:4";

  assert.equal(companion.focusedMissionId(save, state), "MSN-T11");
  assert.equal(
    state[companion.FOCUS_SIGNATURE_STATE_KEY],
    companion.missionSignature(t11),
  );
});

test("T17の現地に着いて次の専用行動が無ければ王都滞在を強制しない", () => {
  const save = saveWithGenericT11Choice();
  save.clock = { day: 24, hour: 12, time: "12:00", absoluteMinute: 33840 };
  save.scene = { location: "王都", facilityId: "LOC_CAP_MAGE_TOWER", beats: [] };
  save.guidance = { missionId: "MSN-T17" };
  save.choices = [];
  save.missions.push({
    id: "MSN-T04",
    troubleId: "T04",
    title: "古代神殿の巡礼者失踪",
    kind: "special",
    status: "active",
    deadlineDay: 25,
    finalDay: 45,
    currentStep: {
      id: "investigate",
      progress: 0,
      required: 3,
      targetLocation: "古代神殿",
      targetFacilityId: "LOC_TEMPLE_ENTRANCE",
    },
  });
  save.movement = [
    {
      moveId: "MOVE_REGION:古代神殿",
      scope: "regional",
      destination: "古代神殿",
      destinationFacilityId: "LOC_TEMPLE_ENTRANCE",
      label: "古代神殿へ移動する",
    },
  ];
  const routeModel = {
    troubles: [
      ...model.troubles,
      {
        id: "T04",
        name: "古代神殿の巡礼者失踪",
        startDay: 12,
        deadlineDay: 25,
        finalDay: 45,
        primaryLocations: ["古代神殿"],
      },
    ],
    adjacency: {
      王都: [{ to: "古代神殿", hours: 3 }],
      古代神殿: [{ to: "王都", hours: 3 }],
    },
  };
  const state = coverageState();
  state[companion.FOCUS_STATE_KEY] = "MSN-T17";
  state[companion.FOCUS_SIGNATURE_STATE_KEY] = "active:investigate:0:6";

  const decision = selectDay100CompanionRouteDecision({
    save,
    model: routeModel,
    state,
  });

  assert.equal(decision.type, "MOVE");
  assert.equal(decision.moveId, "MOVE_REGION:古代神殿");
  assert.equal(decision.missionId, "MSN-T04");
});

test("T17の次地点へ移動中だけは直近の行動列を保持する", () => {
  const save = saveWithGenericT11Choice();
  save.guidance = { missionId: "MSN-T17" };
  save.choices = [];
  save.movement = [
    {
      moveId: "MOVE_LOCAL:LOC_CAP_MAGE_TOWER",
      scope: "local",
      destination: "王都",
      destinationFacilityId: "LOC_CAP_MAGE_TOWER",
      label: "魔術塔へ移動する",
    },
  ];
  const state = coverageState();
  state[companion.FOCUS_STATE_KEY] = "MSN-T17";
  state[companion.FOCUS_SIGNATURE_STATE_KEY] = "active:investigate:0:6";

  const decision = selectDay100CompanionRouteDecision({ save, model, state });
  assert.equal(decision.type, "MOVE");
  assert.equal(decision.moveId, "MOVE_LOCAL:LOC_CAP_MAGE_TOWER");
  assert.equal(decision.missionId, "MSN-T17");
});

test("食事や宿泊を挟んだら長期事件の保持を解除して再評価する", () => {
  const save = saveWithGenericT11Choice();
  save.guidance = { missionId: "MSN-T17" };
  save.player = {
    ...save.player,
    freeMeals: 0,
    needs: { hunger: 92, fatigue: 20 },
  };
  save.choices = [
    {
      choiceId: "EAT-BREAD",
      actionId: "EAT:BREAD:8",
      type: "eat",
      price: 8,
      label: "パンを食べる（8G）",
    },
  ];
  const state = coverageState();
  state[companion.FOCUS_STATE_KEY] = "MSN-T17";
  state[companion.FOCUS_SIGNATURE_STATE_KEY] = "active:investigate:0:6";

  const decision = selectDay100CompanionRouteDecision({ save, model, state });
  assert.equal(decision.actionId, "EAT:BREAD:8");
  assert.equal(state[companion.FOCUS_STATE_KEY], undefined);
  assert.equal(state[companion.FOCUS_SIGNATURE_STATE_KEY], undefined);
});