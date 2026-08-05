import assert from "node:assert/strict";
import test from "node:test";

import {
  selectDay100CompanionWorldDecision,
  DAY100_COMPANION_WORLD_INTERNALS as world,
} from "../lib/day100-companion-route-world-strategy.mjs";

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
    companionRouteFocusMissionId: "MSN-T17",
    companionRouteFocusMissionSignature: "active:investigate:0:6",
  };
}

function save(choices) {
  return {
    world: { ended: false },
    battle: null,
    tutorial: null,
    guidance: { missionId: "MSN-T04" },
    clock: { day: 12, hour: 9, time: "09:00", absoluteMinute: 16380 },
    scene: { location: "田園の村", facilityId: "LOC_FARM_SQUARE", beats: [] },
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
    choices,
    movement: [],
    missions: [],
    rumors: [],
  };
}

const model = { troubles: [], adjacency: {} };

test("過去の焦点stateを無視し、現在表示された手書き三択から選ぶ", () => {
  const coverage = state();
  const decision = selectDay100CompanionWorldDecision({
    save: save([
      {
        choiceId: "MISSION_FLOW:T04:HUMAN_SPINE:village:join_caravan",
        actionId: "MISSION_FLOW:T04:HUMAN_SPINE:village:join_caravan",
        family: "logistics",
        label: "巡礼便に加わる",
      },
      {
        choiceId: "MISSION_FLOW:T04:HUMAN_SPINE:village:visit_family",
        actionId: "MISSION_FLOW:T04:HUMAN_SPINE:village:visit_family",
        family: "social",
        label: "失踪者の家族を訪ねる",
      },
      {
        choiceId: "MISSION_FLOW:T04:HUMAN_SPINE:village:take_watch",
        actionId: "MISSION_FLOW:T04:HUMAN_SPINE:village:take_watch",
        family: "living",
        label: "村の見張りを引き継ぐ",
      },
    ]),
    model,
    state: coverage,
  });

  assert.equal(decision.actionId, "MISSION_FLOW:T04:HUMAN_SPINE:village:join_caravan");
  assert.equal(decision.missionId, "MSN-T04");
  assert.equal(coverage.companionRouteFocusMissionId, "MSN-T17");
  assert.equal(coverage.companionRouteFocusMissionSignature, "active:investigate:0:6");
});

test("戻るためだけのnavigator操作は候補にせず具体的な手書き行動を選ぶ", () => {
  const choices = [
    {
      choiceId: "MISSION_FLOW:capital-assassination-plot:NAVIGATOR_ROUTE_BACK:assassin_contract",
      actionId: "MISSION_FLOW:capital-assassination-plot:NAVIGATOR_ROUTE_BACK:assassin_contract",
      family: "coordination",
      label: "分類へ戻る",
    },
    {
      choiceId: "MISSION_FLOW:T11:WITNESS_NETWORK:t11-crow-ledger-aftermath:escort_crow",
      actionId: "MISSION_FLOW:T11:WITNESS_NETWORK:t11-crow-ledger-aftermath:escort_crow",
      family: "rescue",
      label: "クロウを連れ出す",
    },
    {
      choiceId: "MISSION_FLOW:T11:WITNESS_NETWORK:t11-crow-ledger-aftermath:copy_ledger",
      actionId: "MISSION_FLOW:T11:WITNESS_NETWORK:t11-crow-ledger-aftermath:copy_ledger",
      family: "observation",
      label: "台帳を三部に写す",
    },
  ];
  const candidates = world.candidates(save(choices), state());
  assert.ok(!candidates.some((choice) => /NAVIGATOR_ROUTE_BACK/u.test(choice.actionId)));
  assert.equal(candidates[0].label, "クロウを連れ出す");
});

test("救済放棄の選択肢は現在表示されていても選ばない", () => {
  const choices = [
    {
      choiceId: "MISSION_FLOW:T07:RV_END:salvage",
      actionId: "MISSION_FLOW:T07:RV_END:salvage",
      family: "rescue",
      label: "部分救済で終える",
    },
    {
      choiceId: "MISSION_FLOW:T07:RV_CAN:continue",
      actionId: "MISSION_FLOW:T07:RV_CAN:continue",
      family: "rescue",
      label: "救出を続ける",
    },
  ];
  const decision = selectDay100CompanionWorldDecision({ save: save(choices), model, state: state() });
  assert.equal(decision.actionId, "MISSION_FLOW:T07:RV_CAN:continue");
});