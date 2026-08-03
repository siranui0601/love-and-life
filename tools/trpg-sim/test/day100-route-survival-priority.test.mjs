import assert from "node:assert/strict";
import test from "node:test";
import { createDay100CoverageState } from "../lib/day100-player-policy.mjs";
import {
  DAY100_ROUTE_SURVIVAL_PRIORITY_INTERNALS,
  selectUrgentDay100SurvivalDecision,
} from "../lib/day100-route-survival-priority.mjs";

const model = Object.freeze({ troubles: [], adjacency: {} });

function state() {
  return createDay100CoverageState(model);
}

function save(overrides = {}) {
  return {
    world: { ended: false },
    clock: { day: 55, hour: 3, time: "03:38", absoluteMinute: 77858 },
    scene: { location: "交易都市", facilityId: "LOC_TRADE_INN", beats: [] },
    player: {
      gold: 59,
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 76.68, fatigue: 77.04 },
    },
    skills: {
      learnable: [{ id: "SKL-0001", name: "スラッシュ", spCost: 1, recommended: true }],
    },
    shop: { available: false, stock: [], rewards: [], loans: [] },
    choices: [
      { choiceId: "EAT:LOC_TRADE_INN:0", actionId: "EAT:LOC_TRADE_INN:0", type: "eat", label: "宿で食事を取る" },
      { choiceId: "LODGE:LOC_TRADE_INN:0", actionId: "LODGE:LOC_TRADE_INN:0", type: "rest", label: "潮風宿で休む" },
    ],
    movement: [],
    missions: [],
    rumors: [],
    battle: null,
    tutorial: null,
    ...overrides,
  };
}

test("空腹と疲労が限界へ近い時は取得可能スキルより公開食事actionを優先する", () => {
  const decision = selectUrgentDay100SurvivalDecision({ save: save(), model, state: state() });
  assert.equal(decision?.type, "CHOOSE");
  assert.equal(decision?.actionId, "EAT:LOC_TRADE_INN:0");
  assert.equal(decision?.payload?.choiceId, "EAT:LOC_TRADE_INN:0");
  assert.equal(decision?.category, "meal_consumed");
});

test("所持金不足時は食事拠点へ移動せず、現在地に公開されたまかない労働を選ぶ", () => {
  const current = save({
    clock: { day: 38, hour: 9, time: "09:00", absoluteMinute: 53220 },
    scene: { location: "王都", facilityId: "LOC_CAP_LOWER_INN", beats: [] },
    player: {
      gold: 0,
      freeMeals: 0,
      freeLodging: 0,
      needs: { hunger: 95.4, fatigue: 90.69 },
    },
    choices: [
      {
        choiceId: "WORK_MEAL:LOC_CAP_LOWER_INN",
        actionId: "WORK_MEAL:LOC_CAP_LOWER_INN",
        type: "work",
        label: "下層の安宿を手伝って、まかないを受け取る",
      },
      {
        choiceId: "REST_OUTDOOR:LOC_CAP_LOWER_INN",
        actionId: "REST_OUTDOOR:LOC_CAP_LOWER_INN",
        type: "rest",
        label: "現在地で安全を確かめ、短く休息する",
      },
    ],
    movement: [
      {
        moveId: "MOVE_LOCAL:LOC_CAP_MARKET",
        scope: "local",
        destination: "王都",
        destinationFacilityId: "LOC_CAP_MARKET",
        destinationFacilityName: "中央市場",
        label: "中央市場へ移動する",
      },
    ],
  });

  const decision = selectUrgentDay100SurvivalDecision({ save: current, model, state: state() });
  assert.equal(decision?.type, "CHOOSE");
  assert.equal(decision?.actionId, "WORK_MEAL:LOC_CAP_LOWER_INN");
  assert.equal(decision?.payload?.choiceId, "WORK_MEAL:LOC_CAP_LOWER_INN");
  assert.equal(decision?.category, "work");
});

test("夜間に疲労が高い時は事件移動前に公開休息actionを選ぶ", () => {
  const current = save({
    player: {
      gold: 59,
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 40, fatigue: 73.19 },
    },
    choices: [
      { choiceId: "REST_OUTDOOR:LOC_TRADE_SHIPYARD", actionId: "REST_OUTDOOR:LOC_TRADE_SHIPYARD", type: "rest", label: "船大工通りで野営する" },
    ],
  });
  const decision = selectUrgentDay100SurvivalDecision({ save: current, model, state: state() });
  assert.equal(decision?.actionId, "REST_OUTDOOR:LOC_TRADE_SHIPYARD");
  assert.equal(decision?.category, "rest");
});

test("緊急食事探索で地域越境せず、同地域の野営拠点へ退避する", () => {
  const coverage = state();
  coverage.knownMealSources.LOC_CAP_LOWER_INN = {
    facilityId: "LOC_CAP_LOWER_INN",
    hub: "王都",
    minimumPrice: 0,
  };
  const current = save({
    clock: { day: 1, hour: 22, time: "22:17", absoluteMinute: 733 },
    scene: { location: "森", facilityId: "LOC_FOREST_EDGE", beats: [] },
    player: {
      gold: 59,
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 75.28, fatigue: 57.56 },
    },
    choices: [
      { choiceId: "REST_OUTDOOR:LOC_FOREST_EDGE", actionId: "REST_OUTDOOR:LOC_FOREST_EDGE", type: "rest", label: "森の縁で野営する" },
    ],
    movement: [
      {
        moveId: "MOVE_LOCAL:LOC_FOREST_CAMP",
        scope: "local",
        destination: "森",
        destinationFacilityId: "LOC_FOREST_CAMP",
        destinationFacilityName: "森の野営地",
        label: "森の野営地へ向かう",
      },
      {
        moveId: "MOVE_REGION:王都",
        scope: "regional",
        destination: "王都",
        destinationFacilityId: "LOC_CAP_LOWER_INN",
        destinationFacilityName: "下層安宿",
        label: "王都へ向かう",
      },
    ],
  });
  const decision = selectUrgentDay100SurvivalDecision({ save: current, model, state: coverage });
  assert.equal(decision?.type, "MOVE");
  assert.equal(decision?.moveId, "MOVE_LOCAL:LOC_FOREST_CAMP");
  assert.equal(decision?.category, "meal_search_move");
});

test("健康な昼間は緊急生活判断を作らない", () => {
  const current = save({
    clock: { day: 20, hour: 14, time: "14:00", absoluteMinute: 28080 },
    player: {
      gold: 59,
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 30, fatigue: 35 },
    },
  });
  assert.equal(selectUrgentDay100SurvivalDecision({ save: current, model, state: state() }), null);
  assert.equal(DAY100_ROUTE_SURVIVAL_PRIORITY_INTERNALS.urgentSurvivalRequired(current), false);
});
