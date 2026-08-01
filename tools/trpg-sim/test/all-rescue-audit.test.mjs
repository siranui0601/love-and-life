import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_RESCUE_FINAL_WINDOW_MINUTES,
  buildAllRescueSignature,
  createAllRescueAudit,
  evaluateAllRescueState,
  evaluateRescueWeave,
  finalizeAllRescueAudit,
  observeAllRescueState,
} from "../lib/all-rescue-audit.mjs";

const gameEndMinute = 100 * 1440;

function fullWeave(troubleIds, routeId = "thread-a") {
  const strands = [
    "early-survival",
    "cross-region-trust",
    "infrastructure-preserved",
    "capital-stability",
    "late-defense",
    "final-convergence",
  ];
  const families = [
    "choice",
    "movement",
    "economy",
    "investigation",
    "diplomacy",
    "battle-or-intervention",
  ];
  const milestones = troubleIds.map((troubleId, index) => ({
    minute: Math.round((index / Math.max(1, troubleIds.length - 1)) * (96 * 1440)),
    strandId: strands[Math.min(strands.length - 2, Math.floor(index * 5 / troubleIds.length))],
    actionFamily: families[index % families.length],
    troubleIds: [troubleId],
  }));
  for (let day = 5; day <= 95; day += 5) {
    milestones.push({
      minute: day * 1440,
      strandId: strands[Math.min(4, Math.floor(day / 20))],
      actionFamily: families[(day / 5) % families.length],
      troubleIds: [troubleIds[Math.min(troubleIds.length - 1, Math.floor(day / 5) % troubleIds.length)]],
    });
  }
  milestones.push({
    minute: gameEndMinute - 1,
    strandId: "final-convergence",
    actionFamily: "choice",
    troubleIds: [...troubleIds],
  });
  return { routeId, milestones };
}

test("all-rescue accepts only a full-campaign weave that reaches Day100's last six hours", () => {
  const troubleById = Object.fromEntries(Array.from({ length: 19 }, (_, index) => [
    `T${String(index + 1).padStart(2, "0")}`,
    {},
  ]));
  const ids = Object.keys(troubleById);
  const troubles = Object.fromEntries(ids.map((id) => [id, { status: "resolved" }]));
  const early = evaluateAllRescueState({
    troubleById,
    troubles,
    gameEndMinute,
    absoluteMinute: gameEndMinute - ALL_RESCUE_FINAL_WINDOW_MINUTES - 1,
    rescueWeave: {
      routeId: "too-short",
      milestones: fullWeave(ids).milestones.filter((entry) =>
        entry.minute <= gameEndMinute - ALL_RESCUE_FINAL_WINDOW_MINUTES - 1),
    },
  });
  assert.equal(early.configuredTroubleCount, 19);
  assert.equal(early.allRescued, true);
  assert.equal(early.prematureAllRescue, true);
  assert.equal(early.eligibleLateFinish, false);

  const late = evaluateAllRescueState({
    troubleById,
    troubles,
    gameEndMinute,
    absoluteMinute: gameEndMinute - 1,
    rescueWeave: fullWeave(ids),
  });
  assert.equal(late.rescueWeave.ready, true);
  assert.equal(late.rescueWeave.usesFullCampaign, true);
  assert.equal(late.rescueWeave.distinctDayCount >= 20, true);
  assert.equal(late.prematureAllRescue, false);
  assert.equal(late.eligibleLateFinish, true);
});

test("late crises may count as rescued by explicit causal prevention, never by suppression alone", () => {
  const ids = ["T01", "T13", "T18", "T19"];
  const base = {
    configuredTroubleIds: ids,
    troubles: {
      T01: { status: "resolved" },
      T13: { status: "resolved" },
      T18: { status: "suppressed" },
      T19: { status: "suppressed" },
    },
    worldFlags: {
      t18SuppressionPrepared: true,
      t19PeaceContingencyPrepared: true,
    },
    preventionProofs: {
      T18: {
        kind: "prevented",
        causeTroubleIds: ["T13"],
        requiredWorldFlags: ["t18SuppressionPrepared"],
        branchId: "T13:world-tree-saved",
      },
      T19: {
        kind: "prevented",
        causeTroubleIds: ["T13", "T18"],
        requiredWorldFlags: ["t19PeaceContingencyPrepared"],
        branchId: "T19:peace-contingency",
      },
    },
    absoluteMinute: gameEndMinute - 1,
    gameEndMinute,
    rescueWeave: fullWeave(ids, "prevention-thread"),
  };
  const rescued = evaluateAllRescueState(base);
  assert.equal(rescued.allRescued, true);
  assert.deepEqual(rescued.preventedTroubleIds, ["T18", "T19"]);
  assert.equal(rescued.eligibleLateFinish, true);

  const unproven = evaluateAllRescueState({
    ...base,
    preventionProofs: {},
  });
  assert.equal(unproven.allRescued, false);
  assert.deepEqual(unproven.missingTroubleIds, ["T18", "T19"]);
});

test("T19 prevention requires a peace contingency rather than only saving the world tree", () => {
  const ids = ["T13", "T18", "T19"];
  const state = evaluateAllRescueState({
    configuredTroubleIds: ids,
    troubles: {
      T13: { status: "resolved" },
      T18: { status: "suppressed" },
      T19: { status: "suppressed" },
    },
    worldFlags: { t18SuppressionPrepared: true },
    preventionProofs: {
      T18: { kind: "prevented", causeTroubleIds: ["T13"], requiredWorldFlags: ["t18SuppressionPrepared"] },
      T19: { kind: "prevented", causeTroubleIds: ["T13", "T18"], requiredWorldFlags: [] },
    },
    absoluteMinute: gameEndMinute - 1,
    gameEndMinute,
    rescueWeave: fullWeave(ids),
  });
  assert.equal(state.allRescued, false);
  assert.equal(state.preventionResults.T19.reason, "t19-prevention-requires-peace-contingency");
});

test("a newly configured future trouble automatically prevents a false complete rescue", () => {
  const ids = ["T01", "T02", "T20"];
  const state = evaluateAllRescueState({
    configuredTroubleIds: ids,
    troubles: {
      T01: { status: "resolved" },
      T02: { status: "resolved" },
      T20: { status: "active" },
    },
    absoluteMinute: gameEndMinute - 1,
    gameEndMinute,
    rescueWeave: fullWeave(ids),
  });
  assert.equal(state.allRescued, false);
  assert.deepEqual(state.missingTroubleIds, ["T20"]);
});

test("route signatures preserve branch, prevention, weave, context, and battle-objective differences", () => {
  const common = { configuredTroubleIds: ["T01", "T02"] };
  const first = buildAllRescueSignature({
    ...common,
    rescueWeave: { routeId: "thread-a" },
    worldFlags: {
      t01ResolutionBranch: "T01|route-a",
      t02ResolutionBranch: "T02|route-b",
      missionBattleObjectives: { "MSN-T02": { protect: "success" } },
    },
  });
  const second = buildAllRescueSignature({
    ...common,
    rescueWeave: { routeId: "thread-b" },
    preventionProofs: {
      T02: { kind: "prevented", causeTroubleIds: ["T01"], requiredWorldFlags: ["proof"] },
    },
    worldFlags: {
      t01ResolutionBranch: "T01|route-a",
      t02ResolutionBranch: "T02|route-c",
      missionBattleObjectives: { "MSN-T02": { protect: "failed" } },
    },
  });
  assert.notEqual(first.signature, second.signature);
});

test("weave rejects shortcuts, future milestones, missing action families, and incomplete trouble coverage", () => {
  const ids = ["T01", "T02", "T03"];
  const result = evaluateRescueWeave({
    configuredTroubleIds: ids,
    absoluteMinute: 40 * 1440,
    gameEndMinute,
    rescueWeave: {
      routeId: "fake-shortcut",
      milestones: [
        { minute: 30 * 1440, strandId: "early-survival", actionFamily: "choice", troubleIds: ["T01"] },
        { minute: gameEndMinute - 1, strandId: "final-convergence", actionFamily: "choice", troubleIds: ["T02"] },
      ],
    },
  });
  assert.equal(result.ready, false);
  assert.equal(result.futureMilestones.length, 1);
  assert.ok(result.missingActionFamilies.includes("movement"));
  assert.deepEqual(result.uncoveredTroubleIds, ["T03"]);
});

test("audit deduplicates repeats and fails on early completion, incomplete weave, or too many unique routes", () => {
  const audit = createAllRescueAudit({ maximumAllowedSignatures: 2 });
  const ids = ["T01"];
  const base = {
    configuredTroubleIds: ids,
    troubles: { T01: { status: "resolved" } },
    gameEndMinute,
  };
  observeAllRescueState(audit, {
    ...base,
    absoluteMinute: 80 * 1440,
    rescueWeave: { routeId: "early", milestones: [] },
    worldFlags: { t01ResolutionBranch: "early" },
  });
  for (const branch of ["late-a", "late-a", "late-b", "late-c"]) {
    observeAllRescueState(audit, {
      ...base,
      absoluteMinute: gameEndMinute - 1,
      rescueWeave: fullWeave(ids, branch),
      worldFlags: { t01ResolutionBranch: branch },
    });
  }
  const result = finalizeAllRescueAudit(audit);
  assert.equal(result.uniqueAcceptedSignatureCount, 3);
  assert.equal(result.duplicateAcceptedObservations, 1);
  assert.equal(result.noPrematureAllRescue, false);
  assert.equal(result.noIncompleteWeaveAcceptance, false);
  assert.equal(result.routeSetWithinLimit, false);
  assert.equal(result.passed, false);
});
