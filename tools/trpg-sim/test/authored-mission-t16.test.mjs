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

const T16_MISSION_ID = "MSN-T16";
const T16_FLOW_ID = "capital-persecution-riot";

function t16MissionDefinition() {
  return {
    id: T16_MISSION_ID,
    steps: [
      { id: "hear", type: "conversation", targetLocation: "王都", targetFacilityId: "LOC_CAP_AJIN_QUARTER", required: 1 },
      { id: "investigate", type: "investigate", targetLocation: "王都", targetFacilityId: "LOC_CAP_AJIN_QUARTER", required: 6 },
      { id: "battle", type: "battle", targetLocation: "王都", targetFacilityId: "LOC_CAP_AJIN_QUARTER", required: 1 },
      { id: "resolve", type: "resolve", targetLocation: "王都", targetFacilityId: "LOC_CAP_OFFICE", required: 1 },
    ],
  };
}

function t16RuntimeAt(facilityId = "LOC_CAP_AJIN_QUARTER", presences = {}) {
  const mission = t16MissionDefinition();
  const catalog = { special: [mission], byId: new Map([[mission.id, mission]]) };
  const npcStates = {};
  for (const npcId of ["NPC026", "NPC068", "NPC067", "NPC024", "NPC046"]) {
    const presence = presences[npcId] ?? "present";
    npcStates[npcId] = {
      lifeStatus: presence === "dead" ? "dead" : "alive",
      presence,
      position: { hubId: "王都", facilityId },
    };
  }
  return {
    authoredMissionFlows: {},
    narrativeMemory: { semanticFlags: {}, localFacts: [] },
    playerKnowledge: {
      knownHubIds: new Set(["王都"]),
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
      absoluteMinute: 62 * 1440,
      day: 62,
      player: {
        location: "王都",
        facilityId,
        knownRumorIds: new Set(["RUM-T16"]),
      },
      catalog,
      missions: {
        [T16_MISSION_ID]: {
          status: "active",
          progress: { hear: 0, investigate: 0, battle: 0, resolve: 0 },
          discoveries: [],
        },
      },
      troubles: {
        T02: { status: "resolved" },
        T07: { status: "resolved" },
        T10: { status: "resolved" },
        T12: { status: "resolved" },
        T13: { status: "resolved" },
        T15: { status: "resolved" },
        T16: { status: "active" },
      },
      rumors: [{ id: "RUM-T16", troubleId: "T16" }],
      progress: {
        missions: {
          attemptedTroubleIds: new Set(["T16"]),
          resolvedTroubleIds: new Set(),
          completedIds: new Set(),
        },
        travel: { visitedHubs: new Set(["王都"]) },
      },
      worldFlags: {},
      routeCache: {},
      history: [],
      authoritativePresentNpcIds: new Set(),
    },
  };
}

const t16Pack = () => AUTHORED_MISSION_FLOW_PACKS.find((pack) => pack.missionId === T16_MISSION_ID);

test("T16 hand-authors three openings and eighteen scene-changing routes across six independent fact classes", () => {
  const pack = t16Pack();
  assert.ok(pack);
  assert.equal(pack.hearing.choices.length, 3);
  assert.equal(pack.investigation.requiredEvidenceGroups.length, 6);
  assert.ok(pack.investigation.requiredEvidenceGroups.every((group) => group.length === 3));
  assert.equal(pack.investigation.leads.length, 18);
  assert.equal(new Set(pack.investigation.leads.map((lead) => lead.id)).size, 18);
  assert.equal(new Set(pack.investigation.leads.map((lead) => lead.discoveryId)).size, 18);
  assert.ok(pack.investigation.leads.every((lead) => lead.facilityId && lead.destinationName));
  assert.equal(pack.resolution.choices.length, 3);
  assert.equal(pack.branching.deterministicSignatureCombinationsBeforePriorState, 4_723_920);
  assert.ok(AUTHORED_MISSION_FLOW_SCENES.some((scene) =>
    scene.sceneId.startsWith(`mission-flow.${T16_FLOW_ID}.resolution.`)));
});

test("T16 can begin from three public records and every source offers three materially different first decisions", () => {
  const contract = AUTHORED_MISSION_CONTINUITY_CONTRACTS[T16_FLOW_ID];
  assert.equal(contract.introductionSources.length, 3);
  for (const source of contract.introductionSources) {
    assert.equal(source.choices.length, 3);
    assert.equal(new Set(source.choices.map((choice) => choice.choiceId)).size, 3);
    assert.equal(new Set(source.choices.map((choice) => choice.sceneTransition)).size, 3);
    const runtime = t16RuntimeAt(source.targetFacilityId);
    const actions = authoredMissionFlowExclusiveActions(runtime, {
      movementActions: [],
      presentNpcs: [],
    });
    assert.equal(actions.length, 3);
    assert.ok(actions.every((action) =>
      action.authoredMissionFlowOpeningSourceId === source.id));
    assert.ok(actions.every((action) => action.targetNpcId === null));
  }
});

test("T16 investigation progress counts completed truth classes rather than repeated evidence volume", () => {
  const runtime = t16RuntimeAt();
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  runtime.playerState.missions[T16_MISSION_ID].progress.hear = 1;
  const pack = t16Pack();
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  flow.openingChoiceId = pack.hearing.choices[0].id;
  flow.unlockedLeadIds = pack.investigation.leads.map((lead) => lead.id);

  runtime.playerState.missions[T16_MISSION_ID].discoveries = pack.investigation.requiredEvidenceGroups[0]
    .map((id) => ({ id }));
  ensureAuthoredMissionFlowState(runtime, pack);
  assert.equal(runtime.playerState.missions[T16_MISSION_ID].progress.investigate, 1);

  runtime.playerState.missions[T16_MISSION_ID].discoveries = pack.investigation.requiredEvidenceGroups
    .map((group) => ({ id: group[0] }));
  ensureAuthoredMissionFlowState(runtime, pack);
  assert.equal(runtime.playerState.missions[T16_MISSION_ID].progress.investigate, 6);
});

test("all 2,187 T16 opening and evidence profiles expose at most one immediate resolution", () => {
  const pack = t16Pack();
  const groups = pack.investigation.requiredEvidenceGroups;
  const routeReadyCounts = Object.fromEntries(pack.resolution.choices.map((route) => [route.id, 0]));
  let profiles = 0;
  let noneReady = 0;
  let exactlyOneReady = 0;
  let multipleReady = 0;

  for (const opening of pack.hearing.choices) {
    for (const a of groups[0]) for (const b of groups[1]) for (const c of groups[2]) {
      for (const d of groups[3]) for (const e of groups[4]) for (const f of groups[5]) {
        const runtime = t16RuntimeAt();
        const flow = ensureAuthoredMissionFlowState(runtime, pack);
        flow.openingChoiceId = opening.id;
        flow.evidenceIds = [a, b, c, d, e, f];
        const readyRoutes = pack.resolution.choices.filter((route) =>
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

test("T16 substitutes independent records for every unavailable named source without changing canonical evidence IDs", () => {
  const pack = t16Pack();
  const fallbacks = AUTHORED_MISSION_CONTINUITY_CONTRACTS[T16_FLOW_ID].leadFallbacks;
  assert.equal(Object.keys(fallbacks).length, 5);
  for (const [leadId, variants] of Object.entries(fallbacks)) {
    const fallback = variants[0];
    const runtime = t16RuntimeAt(fallback.facilityId, { [fallback.primaryNpcId]: "dead" });
    runtime.playerState.missions[T16_MISSION_ID].progress.hear = 1;
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
    flow.openingChoiceId = pack.hearing.choices[0].id;
    flow.unlockedLeadIds = pack.investigation.leads.map((lead) => lead.id);
    flow.selectedLeadId = leadId;

    const evidence = authoredMissionFlowEvidenceAction(runtime);
    assert.ok(evidence, leadId);
    assert.equal(evidence.authoredMissionFlowEvidenceSourceId, fallback.id);
    assert.equal(
      evidence.discoveryId,
      pack.investigation.leads.find((lead) => lead.id === leadId).discoveryId,
    );
  }
});

test("selecting a T16 route reveals its destination and guidance explicitly opens movement", () => {
  const runtime = t16RuntimeAt();
  runtime.playerState.missions[T16_MISSION_ID].progress.hear = 1;
  const pack = t16Pack();
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  flow.openingChoiceId = pack.hearing.choices[0].id;
  const lead = pack.investigation.leads.find((entry) =>
    entry.facilityId === "LOC_CAP_NEWSPAPER");

  applyAuthoredMissionFlowAction(runtime, {
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "navigator_route",
    authoredMissionFlowLeadId: lead.id,
  }, { ok: true });

  assert.ok(runtime.playerKnowledge.knownFacilityIds.has(lead.facilityId));
  assert.equal(authoredMissionFlowGuidance(runtime).actionPanel, "movement");
});

test("T16 battle objectives persist independently from victory and keep evacuation, command capture, and diplomacy distinct", () => {
  const runtime = t16RuntimeAt();
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  const pack = t16Pack();
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  flow.evidenceIds = pack.investigation.requiredEvidenceGroups.map((group) => group[0]);
  const result = {
    ok: true,
    battle: { won: true, rounds: 9, encounterId: "T16-RIOT" },
    summary: "暴動の指揮線を止めた。",
  };

  applyAuthoredMissionFlowAction(runtime, {
    type: "missionBattle",
    missionId: T16_MISSION_ID,
    stepId: "battle",
  }, result);

  assert.deepEqual(
    Object.values(flow.battleObjectiveResults).map((entry) => entry.status),
    ["success", "success", "success"],
  );
  assert.deepEqual(
    runtime.playerState.catalog.special[0].steps.find((step) => step.id === "battle")
      .sideObjectives.map((objective) => objective.id),
    [
      "evacuate-marked-households",
      "capture-hunter-command",
      "preserve-blackridge-message-route",
    ],
  );
  assert.match(result.summary, /副目標/u);
  assert.ok(runtime.playerState.history.some((entry) =>
    entry.type === "AUTHORED_MISSION_BATTLE_OBJECTIVES_EVALUATED"));
});

test("a resolved T16 route persists a unique branch, facility rumor, and formal history for T19", () => {
  const runtime = t16RuntimeAt("LOC_CAP_OFFICE");
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  const pack = t16Pack();
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  flow.openingChoiceId = pack.hearing.choices[0].id;
  flow.evidenceIds = pack.investigation.requiredEvidenceGroups.map((group) => group[0]);
  runtime.playerState.missions[T16_MISSION_ID].progress.hear = 1;
  runtime.playerState.missions[T16_MISSION_ID].progress.investigate = 6;
  runtime.playerState.missions[T16_MISSION_ID].progress.battle = 1;

  const actions = authoredMissionFlowExclusiveActions(runtime, {
    movementActions: [],
    presentNpcs: [],
  });
  const resolution = actions.find((action) => action.authoredMissionFlowKind === "resolution");
  assert.ok(resolution);
  const result = { ok: true, troubleStatusAtResolution: "active" };
  applyAuthoredMissionFlowAction(runtime, resolution, result);

  assert.ok(flow.selectedResolutionRouteId);
  assert.ok(runtime.playerState.worldFlags.t16ResolutionBranch);
  assert.match(result.sceneTransition, /場面|街|役所|門|黒嶺/u);
  assert.ok(runtime.playerState.history.some((entry) =>
    entry.type === "AUTHORED_MISSION_FLOW_RESOLUTION_SELECTED"
      && entry.missionId === T16_MISSION_ID));
  assert.ok(Object.values(runtime.livingWorld.facilityRumors).some((entry) =>
    entry instanceof Map && entry.size > 0));
});
