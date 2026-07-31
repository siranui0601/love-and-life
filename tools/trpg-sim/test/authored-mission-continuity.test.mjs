import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORED_MISSION_CONTINUITY_CONTRACTS,
  AUTHORED_MISSION_FLOW_PACKS,
  applyAuthoredMissionFlowAction,
  applyAuthoredMissionFlowCatalogOverrides,
  authoredMissionFlowEvidenceAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowExtensionResolutionReadiness,
  ensureAuthoredMissionFlowState,
  resolveAuthoredMissionFlowExtensionChoice,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function t14MissionDefinition() {
  return {
    id: "MSN-T14",
    steps: [
      { id: "hear", type: "conversation", targetLocation: "犯罪都縂", targetFacilityId: "LOC_CRIME_DOCK", required: 1 },
      { id: "investigate", type: "investigate", targetLocation: "犯罪都市", targetFacilityId: "LOC_CRIME_DOCK", required: 6 },
      { id: "resolve", type: "resolve", targetLocation: "犯罪都市", targetFacilityId: "LOC_CRIME_INFO_STREET", required: 1 },
    ],
  };
}

function t14RuntimeAt(facilityId, { ceresPresence = "dead" } = {}) {
  const mission = t14MissionDefinition();
  const catalog = { special: [mission], byId: new Map([[mission.id, mission]]) };
  return {
    authoredMissionFlows: {},
    narrativeMemory: { semanticFlags: {} },
    playerKnowledge: { knownHubIds: new Set(), knownFacilityIds: new Set() },
    livingWorld: {
      model: { npcs: [] },
      npcStates: {
        NPC052: {
          lifeStatus: ceresPresence === "dead" ? "dead" : "alive",
          presence: ceresPresence,
          position: { hubId: "犯罪都市", facilityId: "LOC_CRIME_DOCK" },
        },
      },
    },
    playerState: {
      absoluteMinute: 0,
      day: 20,
      player: { location: facilityId === "LOC_TRADE_CUSTOMS" ? "交易都市" : "犯罪都市", facilityId },
      catalog,
      missions: {
        "MSN-T14": {
          status: "active",
          progress: { hear: 0, investigate: 0, battle: 0, resolve: 0 },
          discoveries: [],
        },
      },
      troubles: { T14: { status: "active" } },
      worldFlags: {},
      routeCache: {},
      history: [],
      authoritativePresentNpcIds: new Set(),
    },
  };
}

function t15MissionDefinition() {
  return {
    id: "MSN-T15",
    steps: [
      { id: "hear", type: "conversation", targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_CUSTOMS", required: 1 },
      { id: "investigate", type: "investigate", targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_CUSTOMS", required: 6 },
      { id: "resolve", type: "resolve", targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_GUILD", required: 1 },
    ],
  };
}

function t15RuntimeAt(facilityId = "LOC_TRADE_CUSTOMS", {
  alvarezPresence = "dead",
  glenPresence = "present",
} = {}) {
  const mission = t15MissionDefinition();
  const catalog = { special: [mission], byId: new Map([[mission.id, mission]]) };
  return {
    authoredMissionFlows: {},
    narrativeMemory: { semanticFlags: {}, localFacts: [] },
    playerKnowledge: { knownHubIds: new Set(), knownFacilityIds: new Set() },
    livingWorld: {
      model: { npcs: [] },
      npcStates: {
        NPC015: {
          lifeStatus: alvarezPresence === "dead" ? "dead" : "alive",
          presence: alvarezPresence,
          position: { hubId: "交易都市", facilityId: "LOC_TRADE_PORT" },
        },
        NPC013: {
          lifeStatus: glenPresence === "dead" ? "dead" : "alive",
          presence: glenPresence,
          position: { hubId: "交易都市", facilityId: "LOC_TRADE_PORT" },
        },
      },
    },
    playerState: {
      absoluteMinute: 0,
      day: 60,
      player: {
        location: "交易都市",
        facilityId,
        knownRumorIds: new Set(["RUM-T15"]),
      },
      catalog,
      missions: {
        "MSN-T15": {
          status: "active",
          progress: { hear: 0, investigate: 0, battle: 0, resolve: 0 },
          discoveries: [],
        },
      },
      troubles: {
        T05: { status: "resolved" },
        T06: { status: "resolved" },
        T09: { status: "resolved" },
        T14: { status: "resolved" },
        T15: { status: "active" },
      },
      rumors: [{ id: "RUM-T15", troubleId: "T15" }],
      progress: {
        missions: {
          attemptedTroubleIds: new Set(["T15"]),
          resolvedTroubleIds: new Set(),
          completedIds: new Set(),
        },
        travel: { visitedHubs: new Set(["交易都市"]) },
      },
      worldFlags: {},
      routeCache: {},
      history: [],
      authoritativePresentNpcIds: new Set(),
    },
  };
}

const t15Pack = () => AUTHORED_MISSION_FLOW_PACKS.find((pack) => pack.missionId === "MSN-T15");

test("T14 can begin from three authored information sources instead of depending on Ceres alone", () => {
  const contract = AUTHORED_MISSION_CONTINUITY_CONTRACTS["crime-city-arms-smuggling"];
  assert.equal(contract.introductionSources.length, 3);
  assert.ok(contract.introductionSources.every((source) => source.choices.length === 3));

  const runtime = t14RuntimeAt("LOC_TRADE_CUSTOMS");
  const actions = authoredMissionFlowExclusiveActions(runtime, { presentNpcs: [], movementActions: [] });
  assert.equal(actions.length, 3);
  assert.ok(actions.every((action) => action.authoredMissionFlowOpeningSourceId === "trade-customs-reissued-manifests"));
  assert.ok(actions.every((action) => action.targetNpcId === null));
  assert.match(actions[1].label, /欠番|再発行票/u);

  const chosen = actions[1];
  applyAuthoredMissionFlowAction(runtime, chosen, { ok: true, type: "plan" });
  assert.equal(runtime.playerState.missions["MSN-T14"].progress.hear, 1);
  const flow = ensureAuthoredMissionFlowState(runtime, "crime-city-arms-smuggling");
  assert.equal(flow.openingSourceId, "trade-customs-reissued-manifests");
  assert.equal(flow.openingChoiceId, "shipping_handoffs_and_port");
});

test("a dead or absent testimony source redirects the same canonical evidence to a hand-authored physical record", () => {
  const runtime = t14RuntimeAt("LOC_TRADE_CUSTOMS");
  runtime.playerState.missions["MSN-T14"].progress.hear = 1;
  const flow = ensureAuthoredMissionFlowState(runtime, "crime-city-arms-smuggling");
  flow.openingChoiceId = "shipping_handoffs_and_port";
  flow.unlockedLeadIds = ["ceres_ship_log"];
  flow.selectedLeadId = "ceres_ship_log";

  const action = authoredMissionFlowEvidenceAction(runtime);
  assert.ok(action);
  assert.equal(action.discoveryId, "T14-EVIDENCE-CERES-SHIP-LOG");
  assert.equal(action.authoredMissionFlowEvidenceSourceId, "trade-customs-sealed-ship-copy");
  assert.match(action.label, /セレス不在|船荷写し/u);

  applyAuthoredMissionFlowAction(runtime, action, { ok: true, type: "investigate" });
  assert.equal(
    flow.evidenceSourceIds["T14-EVIDENCE-CERES-SHIP-LOG"],
    "trade-customs-sealed-ship-copy",
  );
  assert.ok(flow.evidenceIds.includes("T14-EVIDENCE-CERES-SHIP-LOG"));
});

test("battle side objectives are evaluated independently from victory and persist for later branches", () => {
  const runtime = t14RuntimeAt("LOC_CRIME_WEAPON_MARKET", { ceresPresence: "present" });
  const flow = ensureAuthoredMissionFlowState(runtime, "crime-city-arms-smuggling");
  flow.evidenceIds = [
    "T14-EVIDENCE-VARO-ALL-BUYER-LEDGER",
    "T14-EVIDENCE-GLENN-ARMED-YOUTHS",
    "T14-EVIDENCE-RATIKA-DELIVERY-ROUTE",
  ];
  const result = {
    ok: true,
    type: "missionBattle",
    battle: { won: true, rounds: 8, encounterId: "ENC-0039" },
    summary: "武器市場の用心棒を退けた。",
  };

  applyAuthoredMissionFlowAction(runtime, {
    type: "missionBattle",
    missionId: "MSN-T14",
    stepId: "battle",
  }, result);

  assert.deepEqual(
    Object.values(flow.battleObjectiveResults).map((entry) => entry.status),
    ["success", "success", "success"],
  );
  assert.equal(
    runtime.playerState.worldFlags.missionBattleObjectives["MSN-T14"]["preserve-original-ledger"],
    "success",
  );
  assert.equal(
    runtime.narrativeMemory.semanticFlags["trouble.T14.battleObjective.seal-smuggling-exits"],
    "success",
  );
  assert.match(result.summary, /副目標/u);
  assert.ok(runtime.playerState.history.some((entry) =>
    entry.type === "AUTHORED_MISSION_BATTLE_OBJECTIVES_EVALUATED"));
});

test("winning without the required investigation or within the wrong tempo leaves side objectives failed", () => {
  const runtime = t14RuntimeAt("LOC_CRIME_WEAPON_MARKET", { ceresPresence: "present" });
  const flow = ensureAuthoredMissionFlowState(runtime, "crime-city-arms-smuggling");
  flow.evidenceIds = ["T14-EVIDENCE-CASSIA-MARK-COMPARISON"];
  const result = {
    ok: true,
    type: "missionBattle",
    battle: { won: true, rounds: 19, encounterId: "ENC-0039" },
  };

  applyAuthoredMissionFlowAction(runtime, {
    type: "missionBattle",
    missionId: "MSN-T14",
    stepId: "battle",
  }, result);

  assert.deepEqual(
    Object.values(flow.battleObjectiveResults).map((entry) => entry.status),
    ["failed", "failed", "failed"],
  );
  assert.match(result.summary, /未達/u);
});

test("catalog overrides expose side objectives without changing battle victory requirements", () => {
  const mission = t14MissionDefinition();
  const catalog = { special: [mission], byId: new Map([[mission.id, mission]]) };
  applyAuthoredMissionFlowCatalogOverrides(catalog);
  const battle = mission.steps.find((step) => step.type === "battle");
  assert.ok(battle);
  assert.equal(battle.required, 1);
  assert.deepEqual(battle.sideObjectives.map((objective) => objective.id), [
    "preserve-original-ledger",
    "capture-identified-buyer",
    "seal-smuggling-exits",
  ]);
  assert.ok(battle.sideObjectives.every((objective) => objective.independentOfVictory === true));
});

test("T15 hand-authors three openings and eighteen distinct routes across six mandatory fact classes", () => {
  const pack = t15Pack();
  assert.ok(pack);
  assert.equal(pack.hearing.choices.length, 3);
  assert.equal(pack.investigation.requiredEvidenceGroups.length, 6);
  assert.ok(pack.investigation.requiredEvidenceGroups.every((group) => group.length === 3));
  assert.equal(pack.investigation.leads.length, 18);
  assert.equal(new Set(pack.investigation.leads.map((lead) => lead.id)).size, 18);
  assert.equal(new Set(pack.investigation.leads.map((lead) => lead.discoveryId)).size, 18);
  assert.equal(pack.resolution.choices.length, 3);
  assert.equal(pack.branching.deterministicSignatureCombinationsBeforePriorState, 4_723_920);
});

test("T15 investigation progress counts independent fact classes rather than repeated evidence volume", () => {
  const runtime = t15RuntimeAt();
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  runtime.playerState.missions["MSN-T15"].progress.hear = 1;
  const pack = t15Pack();
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  flow.openingChoiceId = "authority_and_contract";
  flow.unlockedLeadIds = pack.investigation.leads.map((lead) => lead.id);

  runtime.playerState.missions["MSN-T15"].discoveries = pack.investigation.requiredEvidenceGroups[0]
    .map((id) => ({ id }));
  ensureAuthoredMissionFlowState(runtime, pack);
  assert.equal(runtime.playerState.missions["MSN-T15"].progress.investigate, 1);

  runtime.playerState.missions["MSN-T15"].discoveries = pack.investigation.requiredEvidenceGroups
    .map((group) => ({ id: group[0] }));
  ensureAuthoredMissionFlowState(runtime, pack);
  assert.equal(runtime.playerState.missions["MSN-T15"].progress.investigate, 6);
});

test("all 2,187 T15 opening and evidence profiles have at most one immediately valid resolution", () => {
  const pack = t15Pack();
  const groups = pack.investigation.requiredEvidenceGroups;
  let profiles = 0;
  let noneReady = 0;
  let exactlyOneReady = 0;
  let multipleReady = 0;

  for (const opening of pack.hearing.choices) {
    for (const a of groups[0]) for (const b of groups[1]) for (const c of groups[2]) {
      for (const d of groups[3]) for (const e of groups[4]) for (const f of groups[5]) {
        const runtime = t15RuntimeAt();
        const flow = ensureAuthoredMissionFlowState(runtime, pack);
        flow.openingChoiceId = opening.id;
        flow.evidenceIds = [a, b, c, d, e, f];
        const readyCount = pack.resolution.choices.filter((route) =>
          authoredMissionFlowExtensionResolutionReadiness(runtime, route.id).ready).length;
        profiles += 1;
        if (readyCount === 0) noneReady += 1;
        else if (readyCount === 1) exactlyOneReady += 1;
        else multipleReady += 1;
      }
    }
  }

  assert.equal(profiles, 2_187);
  assert.equal(noneReady, 1_890);
  assert.equal(exactlyOneReady, 297);
  assert.equal(multipleReady, 0);
});

test("T15 consumes T14 route and side-objective state instead of flattening prior choices", () => {
  const runtime = t15RuntimeAt("LOC_TRADE_GUILD");
  const pack = t15Pack();
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  flow.openingChoiceId = "cargo_and_landing";
  flow.evidenceIds = pack.investigation.requiredEvidenceGroups.map((group) => group[1]);

  runtime.playerState.worldFlags.t14ResolutionRoute = "reverse_delivery_and_turn_carriers";
  runtime.playerState.worldFlags.missionBattleObjectives = {
    "MSN-T14": { "seal-smuggling-exits": "success" },
  };

  const route = resolveAuthoredMissionFlowExtensionChoice(
    runtime,
    pack.resolution.choices.find((choice) => choice.id === "false_anchorage_and_disarm_fleet"),
  );
  assert.equal(route.contextId, "t14-reverse-delivery-foreign-order-code");
  assert.match(route.label, /T14|注文符号|隔離泊地/u);
});

test("T15 starts from three authored public sources and substitutes physical records for absent named actors", () => {
  const contract = AUTHORED_MISSION_CONTINUITY_CONTRACTS["foreign-fleet-arrival"];
  assert.equal(contract.introductionSources.length, 3);
  assert.ok(contract.introductionSources.every((source) => source.choices.length === 3));

  const runtime = t15RuntimeAt("LOC_TRADE_CUSTOMS", { alvarezPresence: "dead" });
  const opening = authoredMissionFlowExclusiveActions(runtime, { presentNpcs: [], movementActions: [] });
  assert.equal(opening.length, 3);
  assert.ok(opening.every((action) =>
    action.authoredMissionFlowOpeningSourceId === "trade-customs-altered-arrival-papers"));
  applyAuthoredMissionFlowAction(runtime, opening[2], { ok: true, type: "plan" });
  assert.equal(runtime.playerState.missions["MSN-T15"].progress.hear, 1);

  const flow = ensureAuthoredMissionFlowState(runtime, "foreign-fleet-arrival");
  assert.equal(flow.openingChoiceId, "collaborators_and_destination");
  flow.unlockedLeadIds = ["alvarez_private_terms"];
  flow.selectedLeadId = "alvarez_private_terms";

  const evidence = authoredMissionFlowEvidenceAction(runtime);
  assert.ok(evidence);
  assert.equal(evidence.discoveryId, "T15-EVIDENCE-ALVAREZ-PRIVATE-TERMS");
  assert.equal(evidence.authoredMissionFlowEvidenceSourceId, "customs-sealed-envoy-dispatch");
  assert.match(evidence.label, /アルバレス不在|使節往復書/u);
});

test("T15 battle objectives persist separately and catalog keeps encounter timeline variants", () => {
  const runtime = t15RuntimeAt("LOC_TRADE_PORT", { alvarezPresence: "present" });
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  const pack = t15Pack();
  const battleStep = runtime.playerState.catalog.special[0].steps.find((step) => step.type === "battle");
  assert.ok(battleStep);
  assert.equal(battleStep.encounterId, "ENC-0035");
  assert.equal(battleStep.timelineVariants.length, 3);
  assert.deepEqual(battleStep.sideObjectives.map((objective) => objective.id), [
    "preserve-invitation-original",
    "separate-siege-cargo",
    "prevent-mercenary-reinforcement",
  ]);

  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  flow.evidenceIds = pack.investigation.requiredEvidenceGroups.map((group) => group[0]);
  const result = {
    ok: true,
    battle: { won: true, rounds: 8, encounterId: "ENC-0035" },
    summary: "外国傭兵の上陸線を止めた。",
  };
  applyAuthoredMissionFlowAction(runtime, {
    type: "missionBattle",
    missionId: "MSN-T15",
    stepId: "battle",
  }, result);

  assert.deepEqual(
    Object.values(flow.battleObjectiveResults).map((entry) => entry.status),
    ["success", "success", "success"],
  );
  assert.match(result.summary, /副目標/u);
});
