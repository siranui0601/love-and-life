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
  authoredMissionFlowGuidance,
  ensureAuthoredMissionFlowState,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const MISSION_ID = "MSN-T17";
const FLOW_ID = "capital-second-summoning";

function missionDefinition() {
  return {
    id: MISSION_ID,
    steps: [
      { id: "hear", type: "conversation", targetLocation: "王都", targetFacilityId: "LOC_CAP_LOWER_INN", required: 1 },
      { id: "investigate", type: "investigate", targetLocation: "王都", targetFacilityId: "LOC_CAP_MAGE_TOWER", required: 6 },
      { id: "battle", type: "battle", targetLocation: "王都", targetFacilityId: "LOC_CAP_MAGE_TOWER", encounterId: "ENC-0028", required: 1 },
      { id: "resolve", type: "resolve", targetLocation: "王都", targetFacilityId: "LOC_CAP_CASTLE", required: 1 },
    ],
  };
}

function runtimeAt(
  facilityId = "LOC_CAP_LOWER_INN",
  {
    location = "王都",
    day = 30,
    presences = {},
    troubleOverrides = {},
  } = {},
) {
  const definition = missionDefinition();
  const catalog = { special: [definition], byId: new Map([[definition.id, definition]]) };
  const npcStates = {};
  for (const npcId of ["NPC016", "NPC017", "NPC018", "NPC024", "NPC046", "NPC056", "NPC067"]) {
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
        knownRumorIds: new Set(["RUM-T17"]),
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
        T11: { status: "resolved" },
        T13: { status: "resolved" },
        T16: { status: "resolved" },
        T17: { status: "active" },
        T18: { status: "inactive" },
        ...troubleOverrides,
      },
      rumors: [{ id: "RUM-T17", troubleId: "T17" }],
      progress: {
        missions: {
          attemptedTroubleIds: new Set(["T17"]),
          resolvedTroubleIds: new Set(),
          completedIds: new Set(),
        },
        travel: { visitedHubs: new Set([location]) },
      },
      worldFlags: { t16ResolutionRoute: "public_retraction_and_legal_accountability" },
      routeCache: {},
      history: [],
      authoritativePresentNpcIds: new Set(),
    },
  };
}

const pack = () => AUTHORED_MISSION_FLOW_PACKS.find((entry) => entry.missionId === MISSION_ID);

test("T17 hand-authors three openings and eighteen routes across six independent causal classes", () => {
  const missionPack = pack();
  assert.ok(missionPack);
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(missionPack.investigation.requiredEvidenceCount, 6);
  assert.equal(missionPack.investigation.requiredEvidenceGroups.length, 6);
  assert.ok(missionPack.investigation.requiredEvidenceGroups.every((group) => group.length === 3));
  assert.equal(missionPack.investigation.leads.length, 18);
  assert.equal(new Set(missionPack.investigation.leads.map((lead) => lead.id)).size, 18);
  assert.equal(new Set(missionPack.investigation.leads.map((lead) => lead.discoveryId)).size, 18);
  assert.equal(missionPack.resolution.choices.length, 3);
  assert.equal(missionPack.branching.deterministicSignatureCombinationsBeforePriorState, 14_171_760);
  assert.ok(AUTHORED_MISSION_FLOW_SCENES.some((scene) =>
    scene.sceneId.startsWith(`mission-flow.${FLOW_ID}.resolution.`)));
});

test("T17 begins from three independent public records with three materially different decisions each", () => {
  const contract = AUTHORED_MISSION_CONTINUITY_CONTRACTS[FLOW_ID];
  assert.equal(contract.introductionSources.length, 3);
  for (const source of contract.introductionSources) {
    const runtime = runtimeAt(source.targetFacilityId, { location: source.targetLocation });
    assert.equal(source.choices.length, 3);
    assert.equal(new Set(source.choices.map((entry) => entry.choiceId)).size, 3);
    assert.equal(new Set(source.choices.map((entry) => entry.sceneTransition)).size, 3);
    const actions = authoredMissionFlowExclusiveActions(runtime, {
      movementActions: [],
      presentNpcs: [],
    });
    assert.equal(actions.length, 3);
    assert.ok(actions.every((action) => action.authoredMissionFlowOpeningSourceId === source.id));
    assert.ok(actions.every((action) => action.targetNpcId === null));
  }
});

test("T17 investigation progress counts causal classes, not repeated evidence volume", () => {
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

test("all 2,187 T17 opening and evidence profiles expose at most one immediate resolution", () => {
  const missionPack = pack();
  const groups = missionPack.investigation.requiredEvidenceGroups;
  const routeReadyCounts = Object.fromEntries(
    missionPack.resolution.choices.map((route) => [route.id, 0]),
  );
  let profiles = 0;
  let noneReady = 0;
  let exactlyOneReady = 0;
  let multipleReady = 0;

  for (const opening of missionPack.hearing.choices) {
    for (const a of groups[0]) for (const b of groups[1]) for (const c of groups[2]) {
      for (const d of groups[3]) for (const e of groups[4]) for (const f of groups[5]) {
        const runtime = runtimeAt();
        const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
        flow.openingChoiceId = opening.id;
        flow.evidenceIds = [a, b, c, d, e, f];
        const readyRoutes = missionPack.resolution.choices.filter((route) =>
          authoredMissionFlowExtensionResolutionReadiness(runtime, route.id).ready);
        profiles += 1;
        if (readyRoutes.length === 0) noneReady += 1;
        else if (readyRoutes.length === 1) {
          exactlyOneReady += 1;
          routeReadyCounts[readyRoutes[0].id] += 1;
        } else multipleReady += 1;
      }
    }
  }

  assert.equal(profiles, 2_187);
  assert.equal(noneReady, 1_968);
  assert.equal(exactlyOneReady, 219);
  assert.equal(multipleReady, 0);
  assert.deepEqual(Object.values(routeReadyCounts), [73, 73, 73]);
});

test("T17 named-source absences redirect to independent records without changing canonical evidence IDs", () => {
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

test("before Day41 T17 offers three noncombat shutdown interventions with scene transitions", () => {
  const runtime = runtimeAt("LOC_CAP_MAGE_TOWER", { day: 30 });
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  const missionPack = pack();
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  flow.openingChoiceId = missionPack.hearing.choices[0].id;
  flow.evidenceIds = missionPack.investigation.requiredEvidenceGroups.map((group) => group[0]);
  runtime.playerState.missions[MISSION_ID].progress.hear = 1;
  runtime.playerState.missions[MISSION_ID].progress.investigate = 6;

  const actions = authoredMissionFlowExclusiveActions(runtime, {
    movementActions: [],
    presentNpcs: [],
  });
  assert.equal(actions.length, 3);
  assert.ok(actions.every((action) => action.authoredMissionFlowKind === "intervention"));
  assert.equal(new Set(actions.map((action) => action.label)).size, 3);
  assert.equal(new Set(actions.map((action) => action.authoredMissionFlowSceneTransition)).size, 3);

  const result = { ok: true };
  applyAuthoredMissionFlowAction(runtime, actions[1], result);
  assert.equal(runtime.playerState.missions[MISSION_ID].progress.battle, 1);
  assert.equal(flow.interventionChoiceId, actions[1].authoredMissionFlowInterventionChoiceId);
  assert.match(result.sceneTransition, /魔術塔|術式|隔壁|記録/u);
  assert.match(result.summary, /副目標/u);
  assert.deepEqual(
    Object.values(flow.battleObjectiveResults).map((entry) => entry.status),
    ["success", "success", "success"],
  );
});

test("after Day41 T17 keeps ENC-0028 and evaluates evacuation, record preservation, and T18 separation independently", () => {
  const runtime = runtimeAt("LOC_CAP_MAGE_TOWER", { day: 45 });
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  const missionPack = pack();
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  flow.evidenceIds = missionPack.investigation.requiredEvidenceGroups.map((group) => group[0]);
  const result = {
    ok: true,
    battle: { won: true, rounds: 9, encounterId: "ENC-0028" },
    summary: "空殻の勇者を止めた。",
  };

  applyAuthoredMissionFlowAction(runtime, {
    type: "missionBattle",
    missionId: MISSION_ID,
    stepId: "battle",
  }, result);

  const battleStep = runtime.playerState.catalog.special[0].steps.find((entry) => entry.id === "battle");
  assert.equal(battleStep.encounterId, "ENC-0028");
  assert.deepEqual(
    battleStep.sideObjectives.map((objective) => objective.id),
    [
      "evacuate-underground-galleries",
      "preserve-day1-matrix",
      "keep-temple-defense-independent",
    ],
  );
  assert.deepEqual(
    Object.values(flow.battleObjectiveResults).map((entry) => entry.status),
    ["success", "success", "success"],
  );
  assert.match(result.summary, /副目標/u);
});

test("a resolved T17 route persists Day1 identity, T18 cause separation, a unique branch, rumor, and formal history", () => {
  const runtime = runtimeAt("LOC_CAP_CASTLE", { day: 35 });
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  const missionPack = pack();
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  flow.openingChoiceId = missionPack.hearing.choices[0].id;
  flow.openingSourceId = "lower-inn-prevention-cipher";
  flow.interventionChoiceId = "freeze_outer_circle_and_publish_order";
  flow.evidenceIds = missionPack.investigation.requiredEvidenceGroups.map((group) => group[0]);
  flow.battleObjectiveResults = {
    "evacuate-underground-galleries": { status: "success" },
    "preserve-day1-matrix": { status: "success" },
    "keep-temple-defense-independent": { status: "success" },
  };
  runtime.playerState.missions[MISSION_ID].progress.hear = 1;
  runtime.playerState.missions[MISSION_ID].progress.investigate = 6;
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
  assert.ok(runtime.playerState.worldFlags.t17ResolutionBranch);
  assert.equal(runtime.playerState.worldFlags.t17SecondSummoningStopped, true);
  assert.equal(runtime.playerState.worldFlags.t17Day1IdentityConfirmed, true);
  assert.equal(runtime.playerState.worldFlags.t17T18CauseSeparated, true);
  assert.ok(runtime.playerState.history.some((entry) =>
    entry.type === "AUTHORED_MISSION_FLOW_RESOLUTION_SELECTED"
      && entry.missionId === MISSION_ID));
  assert.ok(Object.values(runtime.livingWorld.facilityRumors).some((entry) =>
    entry instanceof Map && entry.size > 0));
  assert.match(result.sceneTransition, /王城|魔術塔|下層|神殿|黒嶺/u);
  assert.equal(authoredMissionFlowGuidance(runtime), null);
});
