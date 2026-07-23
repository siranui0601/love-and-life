import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY100_POLICY_INTERNALS,
  createDay100CoverageState,
  observeDay100Coverage,
  selectDay100Decision,
} from "../lib/day100-player-policy.mjs";

const model = {
  troubles: [],
  adjacency: {},
};

function save({ gold = 2, freeMeals = 0 } = {}) {
  return {
    clock: { day: 25, hour: 14, time: "14:44", absoluteMinute: 34844 },
    scene: { location: "王都", facilityId: "LOC_CAP_MARKET", beats: [] },
    player: { gold, freeMeals, freeLodging: 0, needs: { hunger: 90, fatigue: 30 } },
    tutorial: null,
    battle: null,
    choices: [
      { choiceId: "CHOICE-1", actionId: "EAT:LOC_CAP_MARKET:6", label: "下層向けの食事（6G）", type: "eat" },
      { choiceId: "CHOICE-2", actionId: "WORK_OFFER:LOC_CAP_MARKET:NPC001", label: "荷運びの仕事を尋ねる", type: "conversation" },
      { choiceId: "CHOICE-3", actionId: "WAIT", label: "少し待つ", type: "wait" },
    ],
    movement: [],
    missions: [],
    rumors: [],
    world: { ended: false },
  };
}

test("a rejected meal is counted as a rejected attempt, not as a completed meal", () => {
  const state = createDay100CoverageState(model);
  const current = save();
  observeDay100Coverage(state, current, {
    type: "CHOOSE",
    payload: { choiceId: "CHOICE-1" },
    actionId: "EAT:LOC_CAP_MARKET:6",
    key: "CHOOSE:EAT:LOC_CAP_MARKET:6",
    category: "meal_consumed",
    accepted: false,
    outcome: { ok: false, reason: "insufficient_gold" },
  });
  assert.equal(state.actionCount, 1);
  assert.equal(state.acceptedActionCount, 0);
  assert.equal(state.rejectedActionCount, 1);
  assert.equal(state.mealCount, 0);
  assert.equal(DAY100_POLICY_INTERNALS.isDecisionBlocked(state, "CHOOSE:EAT:LOC_CAP_MARKET:6", current), true);
});

test("an unaffordable or blocked meal yields to an executable work recovery", () => {
  const state = createDay100CoverageState(model);
  const current = save();
  observeDay100Coverage(state, current, {
    type: "CHOOSE",
    actionId: "EAT:LOC_CAP_MARKET:6",
    key: "CHOOSE:EAT:LOC_CAP_MARKET:6",
    category: "meal_consumed",
    accepted: false,
    outcome: { ok: false, reason: "insufficient_gold" },
  });
  const decision = selectDay100Decision({ save: current, model, state });
  assert.equal(decision.actionId, "WORK_OFFER:LOC_CAP_MARKET:NPC001");
  assert.equal(decision.category, "work");
});

test("a payment rejection is reconsidered after the player's money changes", () => {
  const state = createDay100CoverageState(model);
  const poor = save();
  observeDay100Coverage(state, poor, {
    type: "CHOOSE",
    actionId: "EAT:LOC_CAP_MARKET:6",
    key: "CHOOSE:EAT:LOC_CAP_MARKET:6",
    category: "meal_consumed",
    accepted: false,
    outcome: { ok: false, reason: "insufficient_gold" },
  });
  const funded = save({ gold: 8 });
  assert.equal(DAY100_POLICY_INTERNALS.isDecisionBlocked(state, "CHOOSE:EAT:LOC_CAP_MARKET:6", funded), false);
  assert.equal(DAY100_POLICY_INTERNALS.mealAffordable(funded.choices[0], funded), true);
  const decision = selectDay100Decision({ save: funded, model, state });
  assert.equal(decision.actionId, "EAT:LOC_CAP_MARKET:6");
  assert.equal(decision.category, "meal_consumed");
});


test("an unsuccessful meal-source visit is not repeated under the same resources", () => {
  const state = createDay100CoverageState(model);
  const current = save({ gold: 0 });
  current.choices = [{ choiceId: "CHOICE-WAIT", actionId: "WAIT", label: "待つ", type: "wait" }];
  current.movement = [{
    moveId: "MOVE_LOCAL:LOC_CAP_INN",
    destinationFacilityId: "LOC_CAP_INN",
    destinationFacilityName: "安宿",
    label: "安宿へ行く",
    scope: "local",
  }];
  const first = selectDay100Decision({ save: current, model, state });
  assert.equal(first.category, "meal_search_move");
  const arrived = structuredClone(current);
  arrived.scene.facilityId = "LOC_CAP_INN";
  arrived.movement = [{
    moveId: "MOVE_LOCAL:LOC_CAP_MARKET",
    destinationFacilityId: "LOC_CAP_MARKET",
    destinationFacilityName: "市場",
    label: "市場へ行く",
    scope: "local",
  }];
  observeDay100Coverage(state, arrived, { ...first, accepted: true, outcome: { ok: true } });
  assert.equal(DAY100_POLICY_INTERNALS.mealSourceBlocked(state, "LOC_CAP_INN", arrived), true);
  arrived.movement.push({
    moveId: "MOVE_LOCAL:LOC_CAP_INN",
    destinationFacilityId: "LOC_CAP_INN",
    destinationFacilityName: "安宿",
    label: "安宿へ戻る",
    scope: "local",
  });
  const second = selectDay100Decision({ save: arrived, model, state });
  assert.notEqual(second?.moveId, "MOVE_LOCAL:LOC_CAP_INN");
});
