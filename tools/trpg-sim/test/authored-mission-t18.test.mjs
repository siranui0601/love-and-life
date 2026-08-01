import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORED_MISSION_CONTINUITY_CONTRACTS,
  AUTHORED_MISSION_FLOW_PACKS,
  AUTHORED_MISSION_FLOW_SCENES,
  applyAuthoredMissionFlowAction,
  applyAuthoredMissionFlowCatalogOverrides,
  authoredMissionFlowEvidenceAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowExtensionResolutionReadiness,
  ensureAuthoredMissionFlowState,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import { auditT18EvidenceProfiles } from "../../../src/server/trpg/content/authored/missions/t18-machine-colossus-evidence.js";

const MISSION_ID = "MSN-T18";
const FLOW_ID = "ancient-temple-machine-colossus";

function missionDefinition() {
  return {
    id: MISSION_ID,
    steps: [
      { id: "hear", type: "conversation", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_GATE", required: 1 },
      { id: "investigate", type: "investigate", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_ADMIN", required: 6 },
      { id: "battle", type: "battle", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_COLOSSUS", encounterId: "ENC-0063", required: 1 },
      { id: "resolve", type: "resolve", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_ADMIN", required: 1 },
    ],
  };
}

function runtimeAt(
  facilityId = "LOC_TEMPLE_GATE",
  {
    location = "古代神殿",
    day = 61,
    presences = {},
    troubleOverrides = {},
    worldFlags = {},
  } = {},
) {
  const definition = missionDefinition();
  const catalog = { special: [definition], byId: new Map([[definition.id, definition]]) };
  const npcStates = {};
  for (const npcId of [
    "NPC016", "NPC017", "NPC028", "NPC030", "NPC035", "NPC037",
    "NPC056", "NPC089", "NPC097", "NPC102",
  ]) {
    const presence = presences[npcId] ?? "present";
    npcStates[npcId] = {
      lifeStatus: presence === "dead" ? "dead" : "alive",
      presence,
      position: { hubId: location, facilityId },
    };
  }
  return {
    authoredMissionFlows: {},
    narrativeMemory: { semanticFlags: {}, localFacts: [] },
    playerKnowledge: {
      knownHubIds: new Set([location]),
      knownFacilityIds: new Set([facilityId]),
    },
    livingWorld: {
      model: { npcs: [] },
      npcStates,
      facilityRumors: {},
      knowledgeEvents: [],
      seededTroubleFacts: new Set(),
    },
    playerState: {
      absoluteMinute: day * 1440,
      day,
      player: {
        location,
        facilityId,
        knownRumorIds: new Set(["RUM-T18"]),
      },
      catalog,
      missions: {
        [MISSION_ID]: {
          status: "active",
          progress: { hear: 0, investigate: 0, battle: 0, resolve: 0 },
          discoveries: [],
        },
      },
      troubles: {
        T04: { status: "resolved" },
        T09: { status: "resolved" },
        T13: { status: "failed" },
        T17: { status: "resolved" },
        T18: { status: "active" },
        T19: { status: "inactive" },
        ...troubleOverrides,
      },
      rumors: [{ id: "RUM-T18", troubleId: "T18" }],
      progress: {
        missions: {
          attemptedTroubleIds: new Set(["T18"]),
          resolvedTroubleIds: new Set(),
          completedIds: new Set(),
        },
        travel: { visitedHubs: new Set([location]) },
      },
      worldFlags: { t17T18CauseSeparated: true, ...worldFlags },
      routeCache: {},
      history: [],
      authoritativePresentNpcIds: new Set(),
    },
  };
}

const pack = () => AUTHORED_MISSION_FLOW_PACKS.find((entry) => entry.missionId === MISSION_ID);

function prepareCompletedInvestigation(runtime, openingIndex = 0, evidenceIndex = 0) {
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  const missionPack = pack();
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  flow.openingChoiceId = missionPack.hearing.choices[openingIndex].id;
  flow.openingSourceId = AUTHORED_MISSION_CONTINUITY_CONTRACTS[FLOW_ID].introductionSources[0].id;
  flow.unlockedLeadIds = missionPack.investigation.leads.map((lead) => lead.id);
  flow.evidenceIds = missionPack.investigation.requiredEvidenceGroups.map((group) => group[evidenceIndex]);
  runtime.playerState.missions[MISSION_ID].progress.hear = 1;
  runtime.playerState.missions[MISSION_ID].progress.investigate = 6;
  return { missionPack, flow };
}

test("T18 registers three openings, eighteen routes, three resolutions, and presentation scenes", () => {
  const missionPack = pack();
  assert.ok(missionPack);
  assert.equal(missionPack.troubleId, "T18");
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(missionPack.investigation.requiredEvidenceCount, 6);
  assert.equal(missionPack.investigation.requiredEvidenceGroups.length, 6);
  assert.deepEqual(missionPack.investigation.requiredEvidenceGroups.map((group) => group.length), [3, 3, 3, 3, 3, 3]);
  assert.equal(missionPack.investigation.leads.length, 18);
  assert.equal(new Set(missionPack.investigation.leads.map((lead) => lead.id)).size, 18);
  assert.equal(new Set(missionPack.investigation.leads.map((lead) => lead.discoveryId)).size, 18);
  assert.equal(missionPack.resolution.choices.length, 3);
  assert.equal(missionPack.battle.fullActivationDay, 64);
  assert.equal(missionPack.battle.irreversibleFailureDay, 78);
  assert.ok(AUTHORED_MISSION_FLOW_SCENES.some((scene) =>
    scene.sceneId.startsWith(`mission-flow.${FLOW_ID}.resolution.`)));
});

test("T18 begins from three public records and each source offers three scene-changing decisions", () => {
  const contract = AUTHORED_MISSION_CONTINUITY_CONTRACTS[FLOW_ID];
  assert.equal(contract.introductionSources.length, 3);
  for (const source of contract.introductionSources) {
    const runtime = runtimeAt(source.targetFacilityId, { location: source.targetLocation });
    const actions = authoredMissionFlowExclusiveActions(runtime, {
      movementActions: [],
      presentNpcs: [],
    });
    assert.equal(actions.length, 3);
    assert.equal(new Set(actions.map((action) => action.authoredMissionFlowChoiceId)).size, 3);
    assert.equal(new Set(actions.map((action) => action.authoredMissionFlowSceneTransition)).size, 3);
    assert.ok(actions.every((action) => action.authoredMissionFlowOpeningSourceId === source.id));
    assert.ok(actions.every((action) => action.targetNpcId === null));
  }
});

test("T18 investigation progress counts six causal classes rather than repeated evidence volume", () => {
  const runtime = runtimeAt();
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  runtime.playerState.missions[MISSION_ID].progress.hear = 1;
  const missionPack = pack();
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  flow.openingChoiceId = missionPack.hearing.choices[0].id;
  flow.unlockedLeadIds = missionPack.investigation.leads.map((lead) => lead.id);

  runtime.playerState.missions[MISSION_ID].discoveries =
    missionPack.investigation.requiredEvidenceGroups[0].map((id) => ({ id }));
  ensureAuthoredMissionFlowState(runtime, missionPack);
  assert.equal(runtime.playerState.missions[MISSION_ID].progress.investigate, 1);

  runtime.playerState.missions[MISSION_ID].discoveries =
    missionPack.investigation.requiredEvidenceGroups.map((group) => ({ id: group[0] }));
  ensureAuthoredMissionFlowState(runtime, missionPack);
  assert.equal(runtime.playerState.missions[MISSION_ID].progress.investigate, 6);
});

test("all 2,187 T18 opening and evidence profiles expose at most one immediate resolution", () => {
  assert.deepEqual(auditT18EvidenceProfiles(), {
    profiles: 2187,
    none: 1968,
    one: 219,
    multiple: 0,
    routes: {
      elf_root_rebinding_and_temple_reseal: 73,
      dwarf_governor_lock_and_command_rewrite: 73,
      sever_march_directive_and_joint_custody: 73,
    },
  });

  const missionPack = pack();
  const groups = missionPack.investigation.requiredEvidenceGroups;
  let profiles = 0;
  let multiple = 0;
  for (const opening of missionPack.hearing.choices) {
    for (const a of groups[0]) for (const b of groups[1]) for (const c of groups[2]) {
      for (const d of groups[3]) for (const e of groups[4]) for (const f of groups[5]) {
        const runtime = runtimeAt();
        const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
        flow.openingChoiceId = opening.id;
        flow.evidenceIds = [a, b, c, d, e, f];
        const ready = missionPack.resolution.choices.filter((route) =>
          authoredMissionFlowExtensionResolutionReadiness(runtime, route.id).ready);
        profiles += 1;
        if (ready.length > 1) multiple += 1;
      }
    }
  }
  assert.equal(profiles, 2187);
  assert.equal(multiple, 0);
});

test("T18 named-source absences redirect to physical records without changing canonical evidence IDs", () => {
  const missionPack = pack();
  const fallbacks = AUTHORED_MISSION_CONTINUITY_CONTRACTS[FLOW_ID].leadFallbacks;
  assert.equal(Object.keys(fallbacks).length, 5);
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

test("before Day64 T18 offers three noncombat shutdown interventions and completes all independent safeguards", () => {
  const runtime = runtimeAt("LOC_TEMPLE_COLOSSUS", { day: 63 });
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

test("from Day64 T18 keeps ENC-0064 and evaluates evacuation, command preservation, and capital defense separately", () => {
  const runtime = runtimeAt("LOC_TEMPLE_COLOSSUS", { day: 65 });
  const { flow } = prepareCompletedInvestigation(runtime);
  const battleStep = runtime.playerState.catalog.special[0].steps.find((entry) => entry.id === "battle");
  const fullActivation = battleStep.timelineVariants.find((entry) => entry.minDay === 64);
  assert.equal(fullActivation.encounterId, "ENC-0064");
  assert.deepEqual(
    battleStep.sideObjectives.map((objective) => objective.id),
    [
      "evacuate-pilgrims-and-guards",
      "preserve-command-core-and-plates",
      "keep-capital-main-force-home",
    ],
  );

  const result = {
    ok: true,
    battle: { won: true, rounds: 11, encounterId: "ENC-0064" },
    summary: "完全起動した巨神兵を止めた。",
  };
  applyAuthoredMissionFlowAction(runtime, {
    type: "missionBattle",
    missionId: MISSION_ID,
    stepId: "battle",
  }, result);

  assert.equal(flow.battleObjectiveResults["evacuate-pilgrims-and-guards"].status, "success");
  assert.equal(flow.battleObjectiveResults["preserve-command-core-and-plates"].status, "success");
  assert.equal(flow.battleObjectiveResults["keep-capital-main-force-home"].status, "failed");
  assert.match(result.summary, /副目標/u);
});

test("a resolved T18 route persists a unique branch, world-tree cause, T17 separation, rumor, and T19 force state", () => {
  const runtime = runtimeAt("LOC_TEMPLE_ADMIN", { day: 63 });
  const { missionPack, flow } = prepareCompletedInvestigation(runtime, 1, 0);
  flow.interventionChoiceId = "rebind_root_threads_before_full_activation";
  flow.battleObjectiveResults = {
    "evacuate-pilgrims-and-guards": { status: "success" },
    "preserve-command-core-and-plates": { status: "success" },
    "keep-capital-main-force-home": { status: "success" },
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
  assert.ok(runtime.playerState.worldFlags.t18ResolutionBranch);
  assert.equal(runtime.playerState.worldFlags.t18MachineColossusStopped, true);
  assert.equal(runtime.playerState.worldFlags.t18WorldTreeSealCauseConfirmed, true);
  assert.equal(runtime.playerState.worldFlags.t18CauseSeparatedFromT17, true);
  assert.equal(runtime.playerState.worldFlags.t18CapitalMainForcePreserved, true);
  assert.equal(runtime.narrativeMemory.semanticFlags["trouble.T19.capitalMainForcePreserved"], true);
  assert.ok(runtime.playerState.history.some((entry) =>
    entry.type === "AUTHORED_MISSION_FLOW_RESOLUTION_SELECTED"
      && entry.missionId === MISSION_ID));
  assert.ok(Object.values(runtime.livingWorld.facilityRumors).some((entry) =>
    entry instanceof Map && entry.size > 0));
  assert.ok(AUTHORED_MISSION_FLOW_SCENES.some((scene) =>
    scene.sceneId === `mission-flow.${FLOW_ID}.resolution.${flow.selectedResolutionRouteId}.active`));
  assert.match(result.summary, /巨神兵|封印|保守|進軍/u);

  const evidenceCount = new Set(flow.evidenceIds).size;
  assert.equal(evidenceCount, missionPack.investigation.requiredEvidenceGroups.length);
});
