import assert from "node:assert/strict";
import test from "node:test";

import {
  selectDay100CompanionRouteDecision,
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
  };
}

function baseSave(overrides = {}) {
  return {
    world: { ended: false },
    battle: null,
    tutorial: null,
    clock: { day: 2, hour: 11, time: "11:00", absoluteMinute: 2100 },
    scene: { location: "田園の村", facilityId: "LOC_FARM_SQUARE", beats: [] },
    guidance: { missionId: "MSN-T01" },
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
    choices: [],
    movement: [],
    missions: [],
    rumors: [],
    ...overrides,
  };
}

const model = { troubles: [], adjacency: {} };

test("Day2の共同見張りでは村人へ役割を渡す行動を優先する", () => {
  const save = baseSave({
    choices: [
      {
        choiceId: "WATCH-ROSTER",
        actionId: "MISSION_FLOW:T01:DAY2_VILLAGE_WATCH:circulate_watch_tags",
        missionId: "MSN-T01",
        family: "coordination",
        label: "当番札を回す",
      },
      {
        choiceId: "WATCH-MERCHANT",
        actionId: "MISSION_FLOW:T01:DAY2_VILLAGE_WATCH:send_notice_with_merchant",
        missionId: "MSN-T01",
        family: "logistics",
        label: "行商便に載せる",
      },
      {
        choiceId: "WATCH-QUIET",
        actionId: "MISSION_FLOW:T01:DAY2_VILLAGE_WATCH:keep_watch_quiet",
        missionId: "MSN-T01",
        family: "non_intervention",
        label: "静かに見守る",
      },
    ],
  });

  const decision = selectDay100CompanionRouteDecision({
    save,
    model,
    state: coverageState(),
  });

  assert.equal(decision.type, "CHOOSE");
  assert.equal(decision.actionId, "MISSION_FLOW:T01:DAY2_VILLAGE_WATCH:circulate_watch_tags");
  assert.equal(decision.payload.choiceId, "WATCH-ROSTER");
});

test("Day8の遠吠えでは子どもの安全確保を優先する", () => {
  const save = baseSave({
    clock: { day: 8, hour: 5, time: "05:00", absoluteMinute: 10380 },
    scene: { location: "田園の村", facilityId: "LOC_FARM_NORTH_FENCE", beats: [] },
    guidance: { missionId: "MSN-T03" },
    choices: [
      {
        choiceId: "HOWL-CHILDREN",
        actionId: "MISSION_FLOW:T03:DAY8_FIRST_HOWL:send_children_home",
        missionId: "MSN-T03",
        family: "rescue",
        label: "子どもを家へ返す",
      },
      {
        choiceId: "HOWL-JILL",
        actionId: "MISSION_FLOW:T03:DAY8_FIRST_HOWL:call_jill_to_fence",
        missionId: "MSN-T03",
        family: "coordination",
        label: "ジルを呼ぶ",
      },
      {
        choiceId: "HOWL-DARK",
        actionId: "MISSION_FLOW:T03:DAY8_FIRST_HOWL:extinguish_torches",
        missionId: "MSN-T03",
        family: "observation",
        label: "松明を消して待つ",
      },
    ],
  });

  const decision = selectDay100CompanionRouteDecision({
    save,
    model,
    state: coverageState(),
  });

  assert.equal(decision.type, "CHOOSE");
  assert.equal(decision.actionId, "MISSION_FLOW:T03:DAY8_FIRST_HOWL:send_children_home");
});

test("行動不能が迫る場合は人助けより先に食事を選ぶ", () => {
  const save = baseSave({
    player: {
      gold: 20,
      freeMeals: 0,
      freeLodging: 1,
      needs: { hunger: 90, fatigue: 20 },
      inventory: { equipment: [] },
      equipment: {},
    },
    choices: [
      {
        choiceId: "EAT-BREAD",
        actionId: "EAT:BREAD:8",
        type: "eat",
        price: 8,
        label: "パンを食べる（8G）",
      },
      {
        choiceId: "HELP-CHILD",
        actionId: "MISSION_FLOW:T03:DAY8_FIRST_HOWL:send_children_home",
        missionId: "MSN-T03",
        family: "rescue",
        label: "子どもを家へ返す",
      },
    ],
  });

  const decision = selectDay100CompanionRouteDecision({
    save,
    model,
    state: coverageState(),
  });

  assert.equal(decision.type, "CHOOSE");
  assert.equal(decision.actionId, "EAT:BREAD:8");
  assert.equal(decision.category, "meal_consumed");
});

test("T13では完全救済を失うRV_ENDより継続可能なRV_CANを選ぶ", () => {
  const save = baseSave({
    guidance: { missionId: "MSN-T03" },
    choices: [
      {
        choiceId: "T13-CONTINUE",
        actionId: "MISSION_FLOW:T13:RV_CAN:ask_survivors_to_search",
        missionId: "MSN-T03",
        family: "coordination",
        label: "生存者と捜索を続ける",
      },
      {
        choiceId: "T13-SALVAGE",
        actionId: "MISSION_FLOW:T13:RV_END:salvage",
        missionId: "MSN-T03",
        family: "logistics",
        label: "残った物資を回収する",
      },
    ],
  });

  const decision = selectDay100CompanionRouteDecision({
    save,
    model,
    state: coverageState(),
  });

  assert.equal(decision.actionId, "MISSION_FLOW:T13:RV_CAN:ask_survivors_to_search");
  assert.equal(decision.missionId, "MSN-T13");
  assert.equal(decision.payload.choiceId, "T13-CONTINUE");
});

test("完全救済を失う手書き枝しか残っていない場合は自動選択せず停止原因として露出する", () => {
  const save = baseSave({
    guidance: { missionId: "MSN-T13" },
    choices: [
      {
        choiceId: "T13-SALVAGE",
        actionId: "MISSION_FLOW:T13:RV_END:salvage",
        missionId: "MSN-T13",
        family: "logistics",
        label: "残った物資を回収する",
      },
    ],
  });

  const decision = selectDay100CompanionRouteDecision({
    save,
    model,
    state: coverageState(),
  });

  assert.equal(decision, null);
});
