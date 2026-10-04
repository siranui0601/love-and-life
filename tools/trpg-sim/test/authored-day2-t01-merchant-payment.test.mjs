import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY2_T01_MERCHANT_PAYMENT_INTERNALS as payment,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const PAYMENT_MINUTE = 1313; // Day2 07:53 on the production Day1-10:00 epoch.

function runtime({ unloadingHelped = false } = {}) {
  return {
    playerState: {
      absoluteMinute: PAYMENT_MINUTE,
      player: { location: "田園の村", facilityId: "LOC_FARM_BAKERY", hunger: 34, fatigue: 18, gold: 0 },
      gold: 0,
      inventory: {},
      missions: [{ id: "MSN-T01", troubleId: "T01", status: "completed", completedAt: 292 }],
      worldFlags: { t01Resolved: true, t01FinnReturned: true },
      history: unloadingHelped ? [{ type: "DAY2_MERCHANT_UNLOADING_HELPED" }] : [],
      evidence: {},
    },
  };
}

function choose(state, action) {
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

function reachPayment(state) {
  state.playerState.history.push({ type: "DAY2_MERCHANT_UNLOADING_HELPED" });
}

test("actual unloading history at the bakery opens a distinct Day2 merchant payment scene", () => {
  const state = runtime();
  reachPayment(state);
  const guidance = authoredMissionFlowGuidance(state);
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.equal(guidance.title, "荷ほどきの報酬");
  assert.equal(guidance.targetFacilityId, "LOC_FARM_BAKERY");
  assert.deepEqual(actions.map((action) => action.label), ["三Gを受け取る", "黒パンを二つ貰う", "王都便を頼む"]);
  assert.equal(actions.length, 3);
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  assert.ok(actions.every((action) => action.targetNpcId === "NPC008"));
  assert.ok(actions.every((action) => action.targetFacilityId === "LOC_FARM_BAKERY"));
  assert.ok(actions.every((action) => action.label.length >= 4 && action.label.length <= 20));
});

test("cash payment updates gold and closes the other branches", () => {
  const state = runtime({ unloadingHelped: true });
  const action = authoredMissionFlowExclusiveActions(state).find((entry) => entry.label === "三Gを受け取る");
  const result = choose(state, action);
  assert.equal(state.playerState.player.gold, 3);
  assert.equal(state.playerState.gold, 3);
  assert.deepEqual(result.gold, { before: 0, after: 3 });
  assert.equal(state.playerState.day2T01MerchantPayment.closedActionIds.length, 2);
  assert.equal(state.playerState.worldFlags["day2Merchant:cashWageTaken"], true);
  assert.ok(!authoredMissionFlowExclusiveActions(state)?.some((entry) => entry.authoredDay2T01MerchantPaymentChoice));
});

test("bread payment stores canonical ITM008 without changing gold", () => {
  const state = runtime({ unloadingHelped: true });
  const action = authoredMissionFlowExclusiveActions(state).find((entry) => entry.label === "黒パンを二つ貰う");
  const result = choose(state, action);
  assert.equal(state.playerState.inventory.ITM008, 2);
  assert.equal(state.playerState.gold, 0);
  assert.deepEqual(result.itemDelta, { itemId: "ITM008", count: 2 });
  assert.equal(state.playerState.worldFlags["day2Merchant:blackBreadPaymentTaken"], true);
});

test("delivery payment creates a saved available contract with Riona", () => {
  const state = runtime({ unloadingHelped: true });
  const action = authoredMissionFlowExclusiveActions(state).find((entry) => entry.label === "王都便を頼む");
  const result = choose(state, action);
  assert.equal(result.contractId, "CONTRACT-DAY2-RIONA-CAPITAL-SMALL-DELIVERY");
  assert.deepEqual(state.playerState.contracts[result.contractId], {
    id: result.contractId,
    providerNpcId: "NPC008",
    status: "available",
    createdAtMinute: PAYMENT_MINUTE,
    origin: "田園の村",
    destination: "王都",
    cargoLimit: "small",
  });
  assert.equal(state.playerState.worldFlags["day2Merchant:capitalDeliveryCredit"], true);
});

test("payment scene requires unloading history, the bakery, and cannot repeat", () => {
  const state = runtime();
  assert.equal(payment.eligible(state), false);
  state.playerState.history.push({ type: "DAY2_MERCHANT_STOCK_INSPECTED" });
  assert.equal(payment.eligible(state), false);
  state.playerState.history.push({ type: "DAY2_MERCHANT_UNLOADING_HELPED" });
  assert.equal(payment.eligible(state), true);

  state.playerState.player.facilityId = "LOC_FARM_INN";
  assert.equal(payment.eligible(state), false);
  state.playerState.player.facilityId = "LOC_FARM_BAKERY";
  assert.equal(payment.eligible(state), true);

  choose(state, payment.actionFor(payment.CHOICES[0]));
  assert.equal(payment.eligible(state), false);
});