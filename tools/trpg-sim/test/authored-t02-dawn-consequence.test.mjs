import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTHORED_MISSION_T02_GRANARY_INTERNALS as granary,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const MISSION_ID = "MSN-T02";

function runtime(worldFlags = {}) {
  return {
    playerState: {
      absoluteMinute: 6270,
      player: { location: "田園の村", facilityId: "LOC_FARM_GRANARY" },
      catalog: {
        byId: new Map([[MISSION_ID, {
          id: MISSION_ID,
          kind: "special",
          troubleId: "T02",
          steps: [
            { id: "hear", type: "conversation", required: 1 },
            { id: "investigate", type: "investigate", required: 3 },
            { id: "resolve", type: "resolve", required: 1 },
          ],
        }]]),
      },
      missions: {
        [MISSION_ID]: {
          id: MISSION_ID,
          status: "active",
          progress: { hear: 1, investigate: 0, resolve: 0 },
          completedAt: null,
          failedAt: null,
        },
      },
      troubles: { T02: { status: "active" } },
      worldFlags,
      history: [],
    },
    authoredMissionFlows: {},
  };
}

function withSideChoice(state, id) {
  granary.ensureState(state).sideChoices.push(id);
  return state;
}

test("releasing grain without a dawn cordon still costs the untrampled floor", () => {
  const state = withSideChoice(runtime(), "release_emergency_grain");
  const action = granary.evidenceAction(state, "fire_origin");

  assert.equal(action.discoveryId, "T02-EV-FIRE-SOOT-LAYER");
  assert.equal(action.minutes, 52);
});

test("a dawn cordon keeps the oil track usable even after grain is released", () => {
  const state = withSideChoice(
    runtime({ t02FloorEvidenceProtected: true }), "release_emergency_grain");
  const action = granary.evidenceAction(state, "fire_origin");

  assert.equal(action.discoveryId, "T02-EV-FIRE-CORDONED-OIL-TRACK");
  assert.equal(action.t02EvidenceClass, "fire_origin");
  assert.ok(action.minutes < 52, "the preserved scene must not cost more than the degraded one");
  assert.match(action.discoveryText, /縄の内側/);
});

test("the dawn cordon changes nothing when grain was never released", () => {
  const plain = granary.evidenceAction(runtime(), "fire_origin");
  const corded = granary.evidenceAction(runtime({ t02FloorEvidenceProtected: true }), "fire_origin");

  assert.equal(plain.discoveryId, "T02-EV-FIRE-OIL-TRACK");
  assert.equal(corded.discoveryId, "T02-EV-FIRE-OIL-TRACK");
});

test("freezing the debt after a dawn flour tally shortens the contract proof", () => {
  const withoutTally = withSideChoice(runtime(), "freeze_village_debt");
  const slow = granary.evidenceAction(withoutTally, "merchant_contract");
  assert.equal(slow.discoveryId, "T02-EV-CONTRACT-TAX-COPY");
  assert.equal(slow.minutes, 64);

  const withTally = withSideChoice(
    runtime({ t02FlourTallyMismatch: true }), "freeze_village_debt");
  const fast = granary.evidenceAction(withTally, "merchant_contract");
  assert.equal(fast.discoveryId, "T02-EV-CONTRACT-COUNTERCOPY-MATCH");
  assert.equal(fast.t02EvidenceClass, "merchant_contract");
  assert.ok(fast.minutes < slow.minutes, "the pre-counted barrels must save investigation time");
});

test("the dawn flour tally alone does not replace the intact original ledger route", () => {
  const action = granary.evidenceAction(runtime({ t02FlourTallyMismatch: true }), "merchant_contract");
  assert.equal(action.discoveryId, "T02-EV-CONTRACT-LEDGER-GAP");
});

test("every dawn-influenced variant still reports its canonical evidence class", () => {
  const cases = [
    [runtime({ t02FloorEvidenceProtected: true }), "release_emergency_grain", "fire_origin"],
    [runtime({ t02FlourTallyMismatch: true }), "freeze_village_debt", "merchant_contract"],
  ];
  for (const [state, side, evidenceClass] of cases) {
    withSideChoice(state, side);
    const action = granary.evidenceAction(state, evidenceClass);
    assert.equal(action.t02EvidenceClass, evidenceClass);
    assert.equal(action.missionId, MISSION_ID);
    assert.equal(action.stepId, "investigate");
    assert.equal(action.type, "investigate");
  }
});
