import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY1_T01_SQUARE_AFTERCARE_INTERNALS as aftercare,
  AUTHORED_DAY1_T01_VILLAGE_NIGHT_INTERNALS as night,
  AUTHORED_DAY2_T01_MERCHANT_PAYMENT_INTERNALS as payment,
  AUTHORED_DAY2_T01_MERCHANT_STALL_INTERNALS as stall,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 780,
      player: { location: "田園の村", facilityId: "LOC_FARM_SQUARE", hunger: 34, fatigue: 58, gold: 0 },
      gold: 0,
      inventory: {},
      missions: [{ id: "MSN-T01", troubleId: "T01", status: "completed", completedAt: 780 }],
      worldFlags: { t01Resolved: true, t01FinnReturned: true },
      history: [],
      evidence: {},
      contracts: {},
    },
  };
}

function choose(state, action) {
  assert.ok(action);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

function chooseId(state, id) {
  return choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.id === id));
}

function reachStall(state) {
  chooseId(state, aftercare.HELP_ACTION_ID);
  chooseId(state, "MISSION_FLOW:T01:SQUARE_SUPPER:share_bread");
  chooseId(state, night.SLEEP_ACTION_ID);
  chooseId(state, payment.SOURCE_ACTION_ID);
  choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.label === "三Gを受け取る"));
}

test("Day1 route reaches a three-choice merchant stall after cash payment", () => {
  const state = runtime();
  reachStall(state);
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.equal(authoredMissionFlowGuidance(state).title, "行商人の朝市");
  assert.deepEqual(actions.map((action) => action.label), ["黒パンを買う", "値段を書き留める", "猟師の荷を預かる"]);
  assert.equal(actions.length, 3);
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  assert.ok(actions.every((action) => action.label.length >= 4 && action.label.length <= 20));
  assert.ok(actions.every((action) => action.targetNpcId === "NPC008"));
});

test("buying canonical black bread spends one gold and opens a distinct bread scene", () => {
  const state = runtime();
  reachStall(state);
  const result = choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.label === "黒パンを買う"));
  assert.equal(state.playerState.gold, 2);
  assert.equal(state.playerState.inventory.ITM008, 1);
  assert.equal(result.nextSceneId, "t01-day2-bread-use");
  assert.equal(authoredMissionFlowGuidance(state).title, "買った黒パン");
  assert.deepEqual(authoredMissionFlowExclusiveActions(state).map((action) => action.label), ["今ここで食べる", "街道用に包む", "フィンに渡す"]);
  assert.equal(state.playerState.day2T01MerchantStall.stall.closedActionIds.length, 2);
});

test("eating purchased bread applies authored recovery and prevents repetition", () => {
  const state = runtime();
  reachStall(state);
  choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.label === "黒パンを買う"));
  const hungerBeforeMealAction = state.playerState.player.hunger;
  choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.label === "今ここで食べる"));
  assert.equal(state.playerState.player.hunger, Math.max(0, hungerBeforeMealAction - 16));
  assert.equal(state.playerState.inventory.ITM008, 0);
  assert.equal(state.playerState.worldFlags["day2Merchant:purchasedBreadEaten"], true);
  assert.equal(stall.followupScene(state), null);
});

test("copying prices opens three distinct record and conversation outcomes", () => {
  const state = runtime();
  reachStall(state);
  choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.label === "値段を書き留める"));
  assert.equal(authoredMissionFlowGuidance(state).title, "今朝の値段");
  assert.deepEqual(authoredMissionFlowExclusiveActions(state).map((action) => action.label), ["村長に見せる", "パン屋に聞く", "紙片をしまう"]);
  choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.label === "村長に見せる"));
  assert.deepEqual(state.playerState.evidence["T02-EVIDENCE-DAY2-BASELINE-PRICES"], {
    id: "T02-EVIDENCE-DAY2-BASELINE-PRICES",
    source: "LOC_FARM_SQUARE:VILLAGE_DUTY_LEDGER",
    acquiredAtMinute: 780,
  });
});

test("hunter parcel can be delivered, delegated, or retained as an unfinished contract", () => {
  for (const [label, expectedStatus] of [["狩人小屋へ向かう", "completed"], ["村長に預ける", "delegated"], ["あとで届ける", "accepted"]]) {
    const state = runtime();
    reachStall(state);
    choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.label === "猟師の荷を預かる"));
    assert.equal(authoredMissionFlowGuidance(state).title, "猟師への小包");
    choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.label === label));
    assert.equal(state.playerState.contracts["CONTRACT-DAY2-RIONA-HUNTER-PARCEL"].status, expectedStatus);
    if (label === "狩人小屋へ向かう") {
      assert.equal(state.playerState.player.location, "森");
      assert.equal(state.playerState.player.facilityId, "LOC_FOREST_HUNTER_HUT");
      assert.equal(state.playerState.evidence["T03-EVIDENCE-HUNTER-FRESH-WOLF-TRACE"].source, "LOC_FOREST_HUNTER_HUT:EAVES");
    }
  }
});

test("stall requires saved cash-payment history and completed scenes do not repeat", () => {
  const state = runtime();
  assert.equal(stall.stallEligible(state), false);
  state.playerState.history.push({ type: "DAY2_MERCHANT_BLACK_BREAD_PAYMENT_TAKEN" });
  assert.equal(stall.stallEligible(state), false);
  state.playerState.history.push({ type: "DAY2_MERCHANT_CASH_WAGE_TAKEN" });
  assert.equal(stall.stallEligible(state), true);
  const copyPrices = stall.STALL_CHOICES.find((choice) => choice.id === "copy_prices");
  choose(state, stall.stallAction(copyPrices));
  const keepNotes = stall.FOLLOWUPS["t01-day2-price-notes"].choices.find((choice) => choice.id === "keep_notes");
  choose(state, stall.followupAction("t01-day2-price-notes", keepNotes));
  assert.equal(stall.stallEligible(state), false);
  assert.equal(stall.followupScene(state), null);
});
