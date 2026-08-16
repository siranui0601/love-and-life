import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS,
} from "../../../src/server/trpg/content/canonical-public-action-policy.js";

function runtime({ day = 30, progress = {}, labour = {}, life = {}, gold = 20 } = {}) {
  return {
    playerState: {
      day,
      progress,
      canonicalRegionalLabour: labour,
      canonicalWorldLife: life,
      player: { location: "交易都市", facilityId: "LOC_TRADE_PORT", gold, needs: { hunger: 20, fatigue: 20 } },
    },
  };
}

test("fort labour is hidden until fort entry permit exists", () => {
  const r = runtime();
  assert.equal(CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.permittedRegionalJob(r, { canonicalRegionalJobId: "JOB-FORT-01" }), false);
  r.playerState.progress.fortEntryPermit = true;
  assert.equal(CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.permittedRegionalJob(r, { canonicalRegionalJobId: "JOB-FORT-01" }), true);
});

test("blackridge and hunter jobs do not default missing permissions to true", () => {
  const r = runtime();
  assert.equal(CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.permittedRegionalJob(r, { canonicalRegionalJobId: "JOB-BLACK-01" }), false);
  assert.equal(CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.permittedRegionalJob(r, { canonicalRegionalJobId: "JOB-FOREST-01" }), false);
  r.playerState.progress.blackridge_entry_permit = true;
  r.playerState.progress.hunterApproval = true;
  assert.equal(CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.permittedRegionalJob(r, { canonicalRegionalJobId: "JOB-BLACK-01" }), true);
  assert.equal(CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.permittedRegionalJob(r, { canonicalRegionalJobId: "JOB-FOREST-01" }), true);
});

test("port worker bed requires work on the current day, not any historical shift", () => {
  const r = runtime({ day: 12, labour: { shifts: { "JOB-TRADE-01": 9 }, lastDayByFacility: { LOC_TRADE_PORT: 11 } } });
  assert.equal(CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.sameDayPortWork(r), false);
  r.playerState.canonicalRegionalLabour.lastDayByFacility.LOC_TRADE_PORT = 12;
  assert.equal(CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.sameDayPortWork(r), true);
});

test("fort life services use the same permit gate", () => {
  const r = runtime();
  assert.equal(CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.permittedLifeAction(r, { id: "SERVICE_BUY:ITM175" }), false);
  r.playerState.progress.fort_entry_permit = true;
  assert.equal(CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.permittedLifeAction(r, { id: "SERVICE_BUY:ITM175" }), true);
});

test("canonical provision units normalize multi-day food to meal portions", () => {
  const action = CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.normalizeProvisionAction({
    id: "LIFE:BUY:ITM010",
    canonicalWorldLifeChoice: true,
    canonicalWorldLifeKind: "buy_provision",
    productId: "ITM010",
    portions: 3,
    price: 4,
  });
  assert.equal(action.portions, 9);
});

test("facility meals and paid lodging are routed through native needs actions", () => {
  const meal = CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.nativeLifeAction({
    id: "LIFE:EAT:ITM078",
    canonicalWorldLifeChoice: true,
    canonicalWorldLifeKind: "eat_meal",
    productId: "ITM078",
    price: 7,
    minutes: 30,
  });
  const sleep = CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.nativeLifeAction({
    id: "LIFE:SLEEP:ITM076",
    canonicalWorldLifeChoice: true,
    canonicalWorldLifeKind: "sleep",
    productId: "ITM076",
    price: 6,
    minutes: 480,
    lodging: true,
  });
  assert.equal(meal.type, "eat");
  assert.equal(meal.mealQuality, "hearty");
  assert.equal(sleep.type, "rest");
  assert.equal(sleep.lodging, true);
});

test("bulk provision choices are visible only when their full multiplied price is affordable", () => {
  const base = {
    id: "LIFE:BUY:ITM010",
    actionId: "LIFE:BUY:ITM010",
    canonicalWorldLifeChoice: true,
    canonicalWorldLifeKind: "buy_provision",
    productId: "ITM010",
    price: 4,
    portions: 3,
  };
  const choices = CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.bulkProvisionActions(base);
  assert.deepEqual(choices.map((entry) => [entry.id, entry.price, entry.portions]), [
    ["LIFE:BUY:ITM010", 4, 9],
    ["LIFE:BUY:ITM010:Q2", 8, 18],
    ["LIFE:BUY:ITM010:Q3", 12, 27],
  ]);

  const onlySingle = CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.filtered(choices, runtime({ gold: 7 }));
  assert.deepEqual(onlySingle.map((entry) => entry.id), ["LIFE:BUY:ITM010"]);

  const throughDouble = CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS.filtered(choices, runtime({ gold: 8 }));
  assert.deepEqual(throughDouble.map((entry) => entry.id), ["LIFE:BUY:ITM010", "LIFE:BUY:ITM010:Q2"]);
});
