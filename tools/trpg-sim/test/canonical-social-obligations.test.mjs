import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_SOCIAL_OBLIGATIONS_INTERNALS,
} from "../../../src/server/trpg/content/canonical-social-obligations.js";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 100,
      authoritativePresentNpcIds: new Set(["NPC004"]),
      player: { location: "田園の村", facilityId: "LOC_FARM_WELL", gold: 10 },
      history: [],
    },
    livingWorld: { npcStates: {} },
  };
}

test("a recorded social debt becomes a normal public payment choice only while the creditor is reachable", () => {
  const r = runtime();
  const debt = CANONICAL_SOCIAL_OBLIGATIONS_INTERNALS.registerDebt(r, {
    id: "DEBT:EDA:ITM014",
    creditorNpcId: "NPC004",
    creditorName: "エダ",
    reason: "薬草包みの立替",
    amountG: 6,
    sourceActionId: "CARE:EDA:ITM014",
  });
  assert.equal(debt.remainingG, 6);
  const choices = CANONICAL_SOCIAL_OBLIGATIONS_INTERNALS.ownActions(r);
  assert.ok(choices.some((entry) => entry.id === "OBLIGATION:PAY:DEBT:EDA:ITM014:FULL"));

  r.playerState.authoritativePresentNpcIds = new Set();
  assert.equal(CANONICAL_SOCIAL_OBLIGATIONS_INTERNALS.ownActions(r), null);
});

test("full repayment subtracts exactly the remaining debt and closes it", () => {
  const r = runtime();
  CANONICAL_SOCIAL_OBLIGATIONS_INTERNALS.registerDebt(r, {
    id: "DEBT:EDA:ITM014",
    creditorNpcId: "NPC004",
    creditorName: "エダ",
    reason: "薬草包みの立替",
    amountG: 6,
  });
  const action = CANONICAL_SOCIAL_OBLIGATIONS_INTERNALS.ownActions(r)
    .find((entry) => entry.id.endsWith(":FULL"));
  const result = { ok: true };
  assert.equal(CANONICAL_SOCIAL_OBLIGATIONS_INTERNALS.consumePayment(r, action, result), true);
  assert.equal(r.playerState.player.gold, 4);
  assert.equal(r.playerState.canonicalSocialObligations.debts["DEBT:EDA:ITM014"].remainingG, 0);
  assert.equal(r.playerState.canonicalSocialObligations.debts["DEBT:EDA:ITM014"].status, "paid");
  assert.equal(result.socialDebtPayment.paymentG, 6);
});
