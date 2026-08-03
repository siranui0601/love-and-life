import assert from "node:assert/strict";
import test from "node:test";
import {
  applyUrgentLifeChoices,
  urgentLifeChoices,
} from "../../../src/server/trpg/game/survival-aware-service.js";

const data = Object.freeze({
  model: {
    facilityById: {
      LOC_FARM_INN: { id: "LOC_FARM_INN", name: "麦穂亭" },
      LOC_FARM_FIELD: { id: "LOC_FARM_FIELD", name: "共同畑" },
    },
  },
});

function authoredView(overrides = {}) {
  return {
    clock: { day: 5, hour: 23, time: "23:10" },
    scene: { location: "田園の村", facilityId: "LOC_FARM_INN" },
    player: {
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 82, fatigue: 78 },
    },
    choices: [
      {
        choiceId: "MISSION_FLOW:MSN-T02:OPENING:CHECK_GRANARY",
        actionId: "MISSION_FLOW:MSN-T02:OPENING:CHECK_GRANARY",
        type: "investigate",
        label: "共同穀倉へ向かう",
      },
      {
        choiceId: "MISSION_FLOW:MSN-T02:OPENING:ASK_WATCH",
        actionId: "MISSION_FLOW:MSN-T02:OPENING:ASK_WATCH",
        type: "conversation",
        label: "夜警へ聞く",
      },
      {
        choiceId: "MISSION_FLOW:MSN-T02:OPENING:TRACE_OIL",
        actionId: "MISSION_FLOW:MSN-T02:OPENING:TRACE_OIL",
        type: "investigate",
        label: "油の仕入れを追う",
      },
    ],
    ...overrides,
  };
}

test("手書きミッション画面でも緊急時は食事と宿泊を通常UIへ併記する", () => {
  const view = authoredView();
  const life = urgentLifeChoices(view, data);
  assert.deepEqual(life.map((choice) => choice.actionId), [
    "EAT:LOC_FARM_INN:0",
    "LODGE:LOC_FARM_INN:0",
  ]);

  const combined = applyUrgentLifeChoices(view, data);
  assert.equal(combined.choices.length, 5);
  assert.equal(combined.choices[0].actionId, "EAT:LOC_FARM_INN:0");
  assert.equal(combined.choices[1].actionId, "LODGE:LOC_FARM_INN:0");
  assert.equal(combined.choices[2].actionId, view.choices[0].actionId);
});

test("宿泊施設でない手書き場面では公開の短時間休息だけを併記する", () => {
  const view = authoredView({
    scene: { location: "田園の村", facilityId: "LOC_FARM_FIELD" },
    player: {
      freeMeals: 0,
      freeLodging: 0,
      needs: { hunger: 40, fatigue: 76 },
    },
  });
  const life = urgentLifeChoices(view, data);
  assert.equal(life.length, 1);
  assert.equal(life[0].actionId, "REST_OUTDOOR:LOC_FARM_FIELD");
  assert.equal(life[0].type, "rest");
});

test("健康時または手書きミッション外では既存三択を変更しない", () => {
  const healthy = authoredView({
    clock: { day: 5, hour: 14, time: "14:00" },
    player: {
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 30, fatigue: 35 },
    },
  });
  assert.strictEqual(applyUrgentLifeChoices(healthy, data), healthy);

  const ordinary = authoredView({
    choices: [{ choiceId: "INSPECT:1", actionId: "INSPECT:1", type: "investigate", label: "調べる" }],
  });
  assert.strictEqual(applyUrgentLifeChoices(ordinary, data), ordinary);
});
