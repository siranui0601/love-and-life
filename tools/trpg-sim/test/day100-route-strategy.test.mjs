import test from "node:test";
import assert from "node:assert/strict";
import { selectDay100RouteDecision } from "../lib/day100-route-strategy.mjs";

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
    trouble: {
      T02: {
        firstRumorMinute: null,
        firstMissionMinute: null,
        finalTroubleStatus: null,
      },
    },
  };
}

function baseSave(overrides = {}) {
  return {
    world: { ended: false },
    battle: null,
    tutorial: null,
    clock: { day: 5, hour: 10, time: "10:00", absoluteMinute: 5760 },
    scene: { location: "田園の村", facilityId: "LOC_FARM_SQUARE", beats: [] },
    player: {
      gold: 40,
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 20, fatigue: 20 },
      inventory: { equipment: [] },
      equipment: {},
    },
    skills: { learnable: [] },
    shop: { available: false, stock: [], rewards: [], loans: [] },
    choices: [],
    movement: [],
    missions: [],
    rumors: [],
    ...overrides,
  };
}

const model = {
  troubles: [
    {
      id: "T02",
      name: "田園の村の共同穀倉放火",
      startDay: 5,
      deadlineDay: 18,
      finalDay: 35,
      primaryLocations: ["田園の村", "交易都市"],
    },
  ],
  adjacency: {
    "田園の村": [{ to: "交易都市", hours: 4 }],
    "交易都市": [{ to: "田園の村", hours: 4 }],
  },
};

test("active mission choice outranks repeated weapon-shop guidance", () => {
  const save = baseSave({
    choices: [
      {
        choiceId: "CHOICE-SHOP",
        actionId: "GUIDE:LOC_CAP_WEAPON_SHOP",
        label: "王都武器屋を見に行く",
      },
      {
        choiceId: "CHOICE-MISSION",
        actionId: "ACTION:MSN-T02:inspect-granary",
        missionId: "MSN-T02",
        stepId: "inspect",
        label: "焼け跡の油染みを調べる",
      },
    ],
    missions: [
      {
        id: "MSN-T02",
        troubleId: "T02",
        title: "共同穀倉放火",
        kind: "special",
        status: "active",
        deadlineDay: 18,
        finalDay: 35,
        currentStep: { id: "inspect", targetLocation: "田園の村" },
      },
    ],
  });
  const decision = selectDay100RouteDecision({
    save,
    model,
    state: coverageState(),
    routeMode: "deadline",
  });
  assert.equal(decision.type, "CHOOSE");
  assert.equal(decision.actionId, "ACTION:MSN-T02:inspect-granary");
});

test("authored navigator group is selected before wandering to another facility", () => {
  const save = baseSave({
    choices: [
      {
        choiceId: "CHOICE-BACK",
        actionId: "MISSION_FLOW:granary-fire:NAVIGATOR_BACK:origin",
        label: "前の焦点へ戻る",
      },
      {
        choiceId: "CHOICE-GROUP-A",
        actionId: "MISSION_FLOW:granary-fire:NAVIGATOR_GROUP:fire_origin",
        label: "火元と油の経路を追う",
      },
      {
        choiceId: "CHOICE-GROUP-B",
        actionId: "MISSION_FLOW:granary-fire:NAVIGATOR_GROUP:grain_diversion",
        label: "消えた穀物の行き先を追う",
      },
    ],
    movement: [
      {
        moveId: "MOVE_LOCAL:LOC_FARM_CHIEF",
        scope: "local",
        destination: "田園の村",
        destinationFacilityId: "LOC_FARM_CHIEF",
        label: "村長宅へ移動する",
      },
    ],
    missions: [
      {
        id: "MSN-T02",
        troubleId: "T02",
        title: "共同穀倉放火",
        kind: "special",
        status: "active",
        deadlineDay: 18,
        finalDay: 35,
        currentStep: {
          id: "investigate",
          targetLocation: "田園の村",
          targetFacilityId: "LOC_FARM_SQUARE",
        },
      },
    ],
  });
  const decision = selectDay100RouteDecision({
    save,
    model,
    state: coverageState(),
    routeMode: "deadline",
  });
  assert.equal(decision.type, "CHOOSE");
  assert.equal(decision.actionId, "MISSION_FLOW:granary-fire:NAVIGATOR_GROUP:fire_origin");
});

test("undiscovered trouble location outranks unrelated shop guidance", () => {
  const save = baseSave({
    scene: { location: "王都", facilityId: "LOC_CAP_SQUARE", beats: [] },
    choices: [
      {
        choiceId: "CHOICE-SHOP",
        actionId: "GUIDE:LOC_CAP_WEAPON_SHOP",
        label: "王都武器屋を見に行く",
      },
    ],
    movement: [
      {
        moveId: "MOVE_REGION:交易都市",
        scope: "regional",
        destination: "交易都市",
        label: "交易都市へ移動する",
      },
    ],
  });
  const decision = selectDay100RouteDecision({
    save,
    model,
    state: coverageState(),
    routeMode: "chain",
  });
  assert.equal(decision.type, "MOVE");
  assert.equal(decision.moveId, "MOVE_REGION:交易都市");
});

test("urgent survival still outranks route pursuit", () => {
  const save = baseSave({
    player: {
      gold: 40,
      freeMeals: 0,
      freeLodging: 1,
      needs: { hunger: 90, fatigue: 20 },
      inventory: { equipment: [] },
      equipment: {},
    },
    choices: [
      {
        choiceId: "CHOICE-MEAL",
        actionId: "EAT:BREAD:8",
        type: "eat",
        price: 8,
        label: "パンを食べる（8G）",
      },
      {
        choiceId: "CHOICE-MISSION",
        actionId: "ACTION:MSN-T02:inspect-granary",
        missionId: "MSN-T02",
        stepId: "inspect",
        label: "焼け跡の油染みを調べる",
      },
    ],
    missions: [
      {
        id: "MSN-T02",
        troubleId: "T02",
        title: "共同穀倉放火",
        kind: "special",
        status: "active",
        deadlineDay: 18,
        finalDay: 35,
        currentStep: { id: "inspect", targetLocation: "田園の村" },
      },
    ],
  });
  const decision = selectDay100RouteDecision({
    save,
    model,
    state: coverageState(),
    routeMode: "prevention",
  });
  assert.equal(decision.type, "CHOOSE");
  assert.equal(decision.actionId, "EAT:BREAD:8");
});
