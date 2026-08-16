import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS,
} from "../../../src/server/trpg/content/canonical-public-action-policy.js";

function runtime({ day = 30, progress = {}, labour = {}, life = {} } = {}) {
  return {
    playerState: {
      day,
      progress,
      canonicalRegionalLabour: labour,
      canonicalWorldLife: life,
      player: { location: "交易都市", facilityId: "LOC_TRADE_PORT", gold: 20, needs: { hunger: 20, fatigue: 20 } },
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
