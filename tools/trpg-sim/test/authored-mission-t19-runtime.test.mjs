import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORED_MISSION_CONTINUITY_CONTRACTS,
  AUTHORED_MISSION_FLOW_SCENES,
  applyAuthoredMissionFlowAction,
  authoredMissionFlowEvidenceAction,
  authoredMissionFlowExclusiveActions,
  ensureAuthoredMissionFlowState,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import {
  FLOW_ID, MISSION_ID, pack, prepareCompletedInvestigation, runtimeAt,
} from "./authored-mission-t19-fixture.mjs";

test("T19 named-source absences redirect to records without changing canonical evidence IDs", () => {
  const missionPack = pack();
  const fallbacks = AUTHORED_MISSION_CONTINUITY_CONTRACTS[FLOW_ID].leadFallbacks;
  assert.equal(Object.keys(fallbacks).length, 6);
  for (const [leadId, variants] of Object.entries(fallbacks)) {
    const fallback = variants[0];
    const runtime = runtimeAt(fallback.facilityId, {
      location: fallback.targetLocation,
      presences: { [fallback.primaryNpcId]: "dead" },
    });
    runtime.playerState.missions[MISSION_ID].progress.hear = 1;
    const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
    flow.openingChoiceId = missionPack.hearing.choices[0].id;
    flow.unlockedLeadIds = missionPack.investigation.leads.map((lead) => lead.id);
    flow.selectedLeadId = leadId;

    const evidence = authoredMissionFlowEvidenceAction(runtime);
    assert.ok(evidence, leadId);
    assert.equal(evidence.authoredMissionFlowEvidenceSourceId, fallback.id);
    assert.equal(
      evidence.discoveryId,
      missionPack.investigation.leads.find((lead) => lead.id === leadId).discoveryId,
    );
  }
});

test("before Day76 T19 offers three noncombat interventions and preserves all safeguards", () => {
  const runtime = runtimeAt("LOC_BLACKRIDGE_BARRACKS", { day: 75 });
  const { flow } = prepareCompletedInvestigation(runtime);

  const actions = authoredMissionFlowExclusiveActions(runtime, {
    movementActions: [],
    presentNpcs: [],
  });
  assert.equal(actions.length, 3);
  assert.ok(actions.every((action) => action.authoredMissionFlowKind === "intervention"));
  assert.equal(new Set(actions.map((action) => action.label)).size, 3);
  assert.equal(new Set(actions.map((action) => action.authoredMissionFlowSceneTransition)).size, 3);

  const result = { ok: true };
  applyAuthoredMissionFlowAction(runtime, actions[0], result);
  assert.equal(runtime.playerState.missions[MISSION_ID].progress.battle, 1);
  assert.equal(flow.interventionChoiceId, actions[0].authoredMissionFlowInterventionChoiceId);
  assert.match(result.summary, /副目標/u);
  assert.deepEqual(
    Object.values(flow.battleObjectiveResults).map((entry) => entry.status),
    ["success", "success", "success"],
  );
});

test("Day76 and Day82 select the forest breakthrough and capital-outskirts encounters", () => {
  const runtime = runtimeAt("LOC_BLACKRIDGE_BARRACKS", { day: 82 });
  const { flow } = prepareCompletedInvestigation(runtime);
  const battleStep = runtime.playerState.catalog.special[0].steps.find((entry) => entry.id === "battle");
  assert.equal(battleStep.timelineVariants.find((entry) => entry.minDay === 76).encounterId, "ENC-0074");
  assert.equal(battleStep.timelineVariants.find((entry) => entry.minDay === 82).encounterId, "ENC-0076");
  assert.deepEqual(
    battleStep.sideObjectives.map((objective) => objective.id),
    [
      "protect-civilians-on-both-sides",
      "preserve-orders-and-messenger-proof",
      "keep-capital-and-reinforcement-corridor",
    ],
  );

  const result = {
    ok: true,
    battle: { won: true, rounds: 11, encounterId: "ENC-0076" },
    summary: "王都近郊で侵攻軍を止めた。",
  };
  applyAuthoredMissionFlowAction(runtime, {
    type: "missionBattle",
    missionId: MISSION_ID,
    stepId: "battle",
  }, result);

  assert.equal(flow.battleObjectiveResults["protect-civilians-on-both-sides"].status, "success");
  assert.equal(flow.battleObjectiveResults["preserve-orders-and-messenger-proof"].status, "success");
  assert.equal(flow.battleObjectiveResults["keep-capital-and-reinforcement-corridor"].status, "failed");
  assert.match(result.summary, /副目標/u);
});

test("a resolved T19 route persists war prevention, civilian protection, branch, rumor, and capital survival", () => {
  const runtime = runtimeAt("LOC_BLACKRIDGE_COUNCIL", { day: 75 });
  const { missionPack, flow } = prepareCompletedInvestigation(runtime, 0, 0);
  flow.interventionChoiceId = "force_council_revote_before_breakthrough";
  flow.battleObjectiveResults = {
    "protect-civilians-on-both-sides": { status: "success" },
    "preserve-orders-and-messenger-proof": { status: "success" },
    "keep-capital-and-reinforcement-corridor": { status: "success" },
  };
  runtime.playerState.missions[MISSION_ID].progress.battle = 1;

  const actions = authoredMissionFlowExclusiveActions(runtime, {
    movementActions: [],
    presentNpcs: [],
  });
  const resolution = actions.find((action) => action.authoredMissionFlowKind === "resolution");
  assert.ok(resolution);
  const result = { ok: true, troubleStatusAtResolution: "active" };
  applyAuthoredMissionFlowAction(runtime, resolution, result);

  assert.ok(flow.selectedResolutionRouteId);
  assert.ok(runtime.playerState.worldFlags.t19ResolutionBranch);
  assert.equal(runtime.playerState.worldFlags.t19WarAverted, true);
  assert.equal(runtime.playerState.worldFlags.t19CapitalSaved, true);
  assert.equal(runtime.playerState.worldFlags.t19ForestBreakthroughStopped, true);
  assert.equal(runtime.playerState.worldFlags.t19CivilianProtectionSucceeded, true);
  assert.equal(runtime.playerState.worldFlags.t19OrderProofPreserved, true);
  assert.equal(runtime.playerState.worldFlags.t19DefenseCorridorMaintained, true);
  assert.equal(runtime.narrativeMemory.semanticFlags["trouble.T19.warAverted"], true);
  assert.ok(runtime.playerState.history.some((entry) =>
    entry.type === "AUTHORED_MISSION_FLOW_RESOLUTION_SELECTED"
      && entry.missionId === MISSION_ID));
  assert.ok(Object.values(runtime.livingWorld.facilityRumors).some((entry) =>
    entry instanceof Map && entry.size > 0));
  assert.ok(AUTHORED_MISSION_FLOW_SCENES.some((scene) =>
    scene.sceneId === `mission-flow.${FLOW_ID}.resolution.${flow.selectedResolutionRouteId}.active`));
  assert.match(result.summary, /停戦|共同防衛|休戦|戦争|侵攻/u);

  const evidenceCount = new Set(flow.evidenceIds).size;
  assert.equal(evidenceCount, missionPack.investigation.requiredEvidenceGroups.length);
});
