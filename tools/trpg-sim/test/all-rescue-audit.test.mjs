import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_RESCUE_FINAL_WINDOW_MINUTES,
  buildAllRescueSignature,
  createAllRescueAudit,
  evaluateAllRescueState,
  finalizeAllRescueAudit,
  observeAllRescueState,
} from "../lib/all-rescue-audit.mjs";

test("all-rescue derives configured trouble IDs and accepts only the last six hours of Day100", () => {
  const troubleById = Object.fromEntries(Array.from({ length: 19 }, (_, index) => [
    `T${String(index + 1).padStart(2, "0")}`,
    {},
  ]));
  const troubles = Object.fromEntries(Object.keys(troubleById)
    .map((id) => [id, { status: "resolved" }]));
  const gameEndMinute = 100 * 1440;
  const early = evaluateAllRescueState({
    troubleById,
    troubles,
    gameEndMinute,
    absoluteMinute: gameEndMinute - ALL_RESCUE_FINAL_WINDOW_MINUTES - 1,
  });
  assert.equal(early.configuredTroubleCount, 19);
  assert.equal(early.allResolved, true);
  assert.equal(early.prematureAllRescue, true);
  assert.equal(early.eligibleLateFinish, false);

  const late = evaluateAllRescueState({
    troubleById,
    troubles,
    gameEndMinute,
    absoluteMinute: gameEndMinute - 1,
  });
  assert.equal(late.prematureAllRescue, false);
  assert.equal(late.eligibleLateFinish, true);
});

test("a newly configured future trouble automatically prevents a false complete rescue", () => {
  const state = evaluateAllRescueState({
    troubleById: { T01: {}, T02: {}, T20: {} },
    troubles: {
      T01: { status: "resolved" },
      T02: { status: "resolved" },
      T20: { status: "active" },
    },
    absoluteMinute: 100 * 1440 - 1,
  });
  assert.equal(state.allResolved, false);
  assert.deepEqual(state.missingTroubleIds, ["T20"]);
});

test("route signatures preserve branch, context, and battle-objective differences", () => {
  const common = { configuredTroubleIds: ["T01", "T02"] };
  const first = buildAllRescueSignature({
    ...common,
    worldFlags: {
      t01ResolutionBranch: "T01|route-a",
      t02ResolutionBranch: "T02|route-b",
      missionBattleObjectives: { "MSN-T02": { protect: "success" } },
    },
  });
  const second = buildAllRescueSignature({
    ...common,
    worldFlags: {
      t01ResolutionBranch: "T01|route-a",
      t02ResolutionBranch: "T02|route-c",
      missionBattleObjectives: { "MSN-T02": { protect: "failed" } },
    },
  });
  assert.notEqual(first.signature, second.signature);
});

test("audit deduplicates repeats and fails on early completion or too many unique routes", () => {
  const audit = createAllRescueAudit({ maximumAllowedSignatures: 2 });
  const base = {
    configuredTroubleIds: ["T01"],
    troubles: { T01: { status: "resolved" } },
    gameEndMinute: 100 * 1440,
  };
  observeAllRescueState(audit, {
    ...base,
    absoluteMinute: 80 * 1440,
    worldFlags: { t01ResolutionBranch: "early" },
  });
  for (const branch of ["late-a", "late-a", "late-b", "late-c"]) {
    observeAllRescueState(audit, {
      ...base,
      absoluteMinute: 100 * 1440 - 1,
      worldFlags: { t01ResolutionBranch: branch },
    });
  }
  const result = finalizeAllRescueAudit(audit);
  assert.equal(result.uniqueAcceptedSignatureCount, 3);
  assert.equal(result.duplicateAcceptedObservations, 1);
  assert.equal(result.noPrematureAllRescue, false);
  assert.equal(result.routeSetWithinLimit, false);
  assert.equal(result.passed, false);
});
