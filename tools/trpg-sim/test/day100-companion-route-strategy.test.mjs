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

test("T01救出直後は子ども遊びよりミラの手伝いを選び正式な縦経路へ入る", () => {
  const save = baseSave({
    choices: [
      {
        choiceId: "AFTERCARE-HELP",
        actionId: "MISSION_FLOW:T01:SQUARE_AFTERCARE:help_mira",
        missionId: "MSN-T01",
        family: "help",
        label: "ミラを手伝う",
      },
      {
        choiceId: "AFTERCARE-RECORD",
        actionId: "MISSION_FLOW:T01:SQUARE_AFTERCARE:give_record",
        missionId: "MSN-T01",
        family: "report",
        label: "村長に記録を渡す",
      },
      {
        choiceId: "AFTERCARE-PLAY",
        actionId: "MISSION_FLOW:T01:SQUARE_AFTERCARE:play_children",
        missionId: "MSN-T01",
        family: "social",
        label: "子どもと遊ぶ",
      },
    ],
  });

  const decision = selectDay100CompanionRouteDecision({
    save,
    model,
    state: coverageState(),
  });

  assert.equal(decision.actionId, "MISSION_FLOW:T01:SQUARE_AFTERCARE:help_mira");
  assert.equal(decision.payload.choiceId, "AFTERCARE-HELP");
});

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

test("証拠経路の選択画面ではNAVIGATOR_ROUTE_BACKへ戻らず具体的な経路を選ぶ", () => {
  const save = baseSave({
    clock: { day: 25, hour: 1, time: "01:08", absoluteMinute: 34028 },
    scene: { location: "犯罪都市", facilityId: "LOC_CRIME_INFO_STREET", beats: [] },
    guidance: { missionId: "MSN-T17" },
    choices: [
      {
        choiceId: "ROUTE-TOKEN",
        actionId: "MISSION_FLOW:capital-assassination-plot:NAVIGATOR_ROUTE:assassin_contract:ren_contract_token",
        missionId: "MSN-T17",
        family: "fieldwork",
        label: "契約札を追う",
      },
      {
        choiceId: "ROUTE-LEDGER",
        actionId: "MISSION_FLOW:capital-assassination-plot:NAVIGATOR_ROUTE:assassin_contract:crow_intermediary_ledger",
        missionId: "MSN-T17",
        family: "coordination",
        label: "仲介帳簿を辿る",
      },
      {
        choiceId: "ROUTE-BACK",
        actionId: "MISSION_FLOW:capital-assassination-plot:NAVIGATOR_ROUTE_BACK:assassin_contract",
        missionId: "MSN-T17",
        family: "coordination",
        label: "分類へ戻る",
      },
    ],
  });

  const decision = selectDay100CompanionRouteDecision({
    save,
    model,
    state: coverageState(),
  });

  assert.equal(decision.type, "CHOOSE");
  assert.equal(decision.actionId, "MISSION_FLOW:capital-assassination-plot:NAVIGATOR_ROUTE:assassin_contract:crow_intermediary_ledger");
  assert.equal(decision.payload.choiceId, "ROUTE-LEDGER");
});

test("期限順が毎手番変わっても選んだ特別依頼を完了まで保持する", () => {
  const state = coverageState();
  state[companion.FOCUS_STATE_KEY] = "MSN-T10";
  const routeModel = {
    troubles: [
      {
        id: "T10",
        name: "王都孤児院の立ち退き",
        startDay: 30,
        deadlineDay: 70,
        finalDay: 90,
        primaryLocations: ["王都"],
      },
      {
        id: "T16",
        name: "王都の亜人排斥暴動",
        startDay: 50,
        deadlineDay: 69,
        finalDay: 90,
        primaryLocations: ["王都"],
      },
    ],
    adjacency: {},
  };
  const save = baseSave({
    clock: { day: 68, hour: 21, time: "21:00", absoluteMinute: 97860 },
    scene: { location: "王都", facilityId: "LOC_CAP_AJIN_QUARTER", beats: [] },
    guidance: { missionId: "MSN-T16" },
    player: {
      gold: 40,
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 20, fatigue: 20 },
      inventory: { equipment: [] },
      equipment: {},
    },
    missions: [
      {
        id: "MSN-T10",
        troubleId: "T10",
        title: "王都孤児院の立ち退き",
        kind: "special",
        status: "active",
        deadlineDay: 70,
        finalDay: 90,
        currentStep: {
          id: "investigate",
          targetLocation: "王都",
          targetFacilityId: "LOC_CAP_ORPHANAGE",
        },
      },
      {
        id: "MSN-T16",
        troubleId: "T16",
        title: "王都の亜人排斥暴動",
        kind: "special",
        status: "active",
        deadlineDay: 69,
        finalDay: 90,
        currentStep: {
          id: "investigate",
          targetLocation: "王都",
          targetFacilityId: "LOC_CAP_AJIN_QUARTER",
        },
      },
    ],
    movement: [
      {
        moveId: "MOVE_LOCAL:LOC_CAP_ORPHANAGE",
        scope: "local",
        destination: "王都",
        destinationFacilityId: "LOC_CAP_ORPHANAGE",
        label: "孤児院へ移動する",
      },
      {
        moveId: "MOVE_LOCAL:LOC_CAP_AJIN_QUARTER",
        scope: "local",
        destination: "王都",
        destinationFacilityId: "LOC_CAP_AJIN_QUARTER",
        label: "亜人街へ移動する",
      },
    ],
  });

  const decision = selectDay100CompanionRouteDecision({ save, model: routeModel, state });
  assert.equal(decision.type, "MOVE");
  assert.equal(decision.moveId, "MOVE_LOCAL:LOC_CAP_ORPHANAGE");
  assert.equal(decision.missionId, "MSN-T10");
  assert.equal(state[companion.FOCUS_STATE_KEY], "MSN-T10");
});

test("保持中の依頼が終端になれば焦点を解放する", () => {
  const state = coverageState();
  state[companion.FOCUS_STATE_KEY] = "MSN-T10";
  const save = baseSave({
    missions: [
      {
        id: "MSN-T10",
        troubleId: "T10",
        title: "王都孤児院の立ち退き",
        kind: "special",
        status: "completed",
      },
    ],
  });
  assert.equal(companion.focusedMissionId(save, state), null);
  assert.equal(state[companion.FOCUS_STATE_KEY], undefined);
});