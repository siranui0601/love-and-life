import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_EVIDENCE_ONLY_PROGRESS_INTERNALS,
  AUTHORED_MISSION_EVIDENCE_ONLY_PROGRESS_VERSION,
  authoredMissionFlowExclusiveActions,
} from "../../../src/server/trpg/content/authored-mission-evidence-only-progress.js";

const {
  shouldNotAdvanceInvestigation,
  withoutMissionProgress,
} = AUTHORED_MISSION_EVIDENCE_ONLY_PROGRESS_INTERNALS;

function t02Runtime() {
  return {
    playerState: {
      absoluteMinute: 6270,
      player: { location: "田園の村", facilityId: "LOC_FARM_GRANARY" },
      catalog: {
        byId: new Map([["MSN-T02", {
          id: "MSN-T02",
          steps: [
            { id: "hear", type: "conversation", required: 1 },
            { id: "investigate", type: "investigate", required: 3 },
            { id: "resolve", type: "resolve", required: 1 },
          ],
        }]]),
      },
      missions: {
        "MSN-T02": {
          status: "active",
          progress: { hear: 1, investigate: 0, resolve: 0 },
        },
      },
      troubles: { T02: { status: "active" } },
      worldFlags: {},
      history: [],
    },
    authoredMissionFlows: {},
  };
}

test("evidence-only progress wrapper removes step ids only from costly and terminal choices", () => {
  assert.equal(
    AUTHORED_MISSION_EVIDENCE_ONLY_PROGRESS_VERSION,
    "authored-mission-evidence-only-progress-v1",
  );

  const costly = {
    id: "T02_GRANARY:SIDE:RELEASE_GRAIN",
    missionId: "MSN-T02",
    stepId: "investigate",
    t02SideChoice: "release_emergency_grain",
  };
  const evidence = {
    id: "T02_GRANARY:EVIDENCE:FIRE:OIL_TRACK",
    missionId: "MSN-T02",
    stepId: "investigate",
    t02EvidenceClass: "fire_origin",
  };

  assert.equal(shouldNotAdvanceInvestigation(costly), true);
  assert.equal(shouldNotAdvanceInvestigation(evidence), false);
  assert.equal("stepId" in withoutMissionProgress(costly), false);
  assert.equal(withoutMissionProgress(costly).missionId, "MSN-T02");
  assert.equal(evidence.stepId, "investigate");
});

test("T02 visible set keeps evidence progress but costly rescue action cannot satisfy a truth class", () => {
  const actions = authoredMissionFlowExclusiveActions(t02Runtime(), {});
  assert.equal(actions.length, 3);

  const evidence = actions.filter((action) => action.t02EvidenceClass);
  const costly = actions.find((action) => action.t02SideChoice);
  assert.equal(evidence.length, 2);
  assert.ok(costly);
  assert.ok(evidence.every((action) => action.stepId === "investigate"));
  assert.equal("stepId" in costly, false);
  assert.equal(costly.missionId, "MSN-T02");
});

test("all T02 and T03 irreversible exits remain mission-bound without incrementing investigation", () => {
  for (const marker of [
    { t02TerminalChoice: "accept_rationed_loss" },
    { t03TerminalChoice: "indiscriminate_cull" },
    { t03SideChoice: "evacuate_livestock" },
  ]) {
    const action = { missionId: "MSN-TEST", stepId: "investigate", ...marker };
    assert.equal(shouldNotAdvanceInvestigation(action), true);
    const stripped = withoutMissionProgress(action);
    assert.equal(stripped.missionId, "MSN-TEST");
    assert.equal("stepId" in stripped, false);
  }
});
