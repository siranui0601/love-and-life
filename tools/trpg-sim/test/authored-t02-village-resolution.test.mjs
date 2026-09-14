import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_T02_VILLAGE_RESOLUTION_INTERNALS as t02,
  applyAuthoredMissionFlowCatalogOverrides,
} from "../../../src/server/trpg/content/authored-mission-t02-village-resolution.js";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 9000,
      player: { location: "田園の村", facilityId: "LOC_FARM_GRANARY" },
      catalog: {
        special: [{
          id: "MSN-T02",
          steps: [{ id: "resolve", type: "resolve", required: 1, targetLocation: "田園の村", targetFacilityId: "LOC_FARM_GRANARY" }],
        }],
      },
      missions: {
        "MSN-T02": { id: "MSN-T02", status: "active", progress: { resolve: 0 } },
      },
      troubles: { T02: { status: "active" } },
      history: [],
      worldFlags: {},
    },
  };
}

test("T02 resolve catalog target is corrected from Trade Guild to the canonical farm granary", () => {
  const catalog = {
    special: [{
      id: "MSN-T02",
      steps: [
        { id: "hear", type: "conversation", required: 1 },
        { id: "investigate", type: "investigate", required: 3 },
        { id: "resolve", type: "resolve", required: 1, targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_GUILD" },
      ],
    }],
  };
  const updated = applyAuthoredMissionFlowCatalogOverrides(catalog);
  const resolve = updated.special[0].steps.find((step) => step.id === "resolve");
  assert.equal(resolve.targetLocation, "田園の村");
  assert.equal(resolve.targetFacilityId, "LOC_FARM_GRANARY");
  assert.match(resolve.label, /共同穀倉/u);
});

test("Day7 village resolution exposes meaningful 42-minute review before resolution and 13-minute protection record after it", () => {
  const state = runtime();
  assert.equal(t02.resolveStepActive(state), true);
  assert.equal(t02.reviewEligible(state), true);
  const review = t02.reviewAction();
  assert.equal(review.id, "T02_GRANARY:RESOLUTION:REVIEW_CONTRACT_AND_TESTIMONY");
  assert.equal(review.minutes, 42);
  assert.equal(t02.consumeOwn(state, review, { ok: true }), true);
  assert.equal(t02.reviewEligible(state), false);

  const local = t02.ensureState(state);
  local.resolvedAtMinute = state.playerState.absoluteMinute;
  state.playerState.troubles.T02.status = "resolved";
  assert.equal(t02.recordEligible(state), true);
  const record = t02.recordAction();
  assert.equal(record.id, "T02_GRANARY:RESOLUTION:RECORD_DALK_PROTECTION_AND_REBUILD");
  assert.equal(record.minutes, 13);
  const result = { ok: true };
  assert.equal(t02.consumeOwn(state, record, result), true);
  assert.equal(state.playerState.worldFlags.t02DalkProtected, true);
  assert.equal(state.playerState.worldFlags.t02DalkLivelihoodRebuildRecorded, true);
  assert.match(result.summary, /生活再建/u);
});
