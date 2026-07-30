import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORED_MISSION_CONTINUITY_CONTRACTS,
  applyAuthoredMissionFlowAction,
  applyAuthoredMissionFlowCatalogOverrides,
  authoredMissionFlowEvidenceAction,
  authoredMissionFlowExclusiveActions,
  ensureAuthoredMissionFlowState,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function missionDefinition() {
  return {
    id: "MSN-T14",
    steps: [
      { id: "hear", type: "conversation", targetLocation: "犯罪都市", targetFacilityId: "LOC_CRIME_DOCK", required: 1 },
      { id: "investigate", type: "investigate", targetLocation: "犯罪都市", targetFacilityId: "LOC_CRIME_DOCK", required: 6 },
      { id: "resolve", type: "resolve", targetLocation: "犯罪都市", targetFacilityId: "LOC_CRIME_INFO_STREET", required: 1 },
    ],
  };
}

function runtimeAt(facilityId, { ceresPresence = "dead" } = {}) {
  const mission = missionDefinition();
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

test("T14 can begin from three authored information sources instead of depending on Ceres alone", () => {
  const contract = AUTHORED_MISSION_CONTINUITY_CONTRACTS["crime-city-arms-smuggling"];
  assert.equal(contract.introductionSources.length, 3);
  assert.ok(contract.introductionSources.every((source) => source.choices.length === 3));

  const runtime = runtimeAt("LOC_TRADE_CUSTOMS");
  const actions = authoredMissionFlowExclusiveActions(runtime, { presentNpcs: [], movementActions: [] });
  assert.equal(actions.length, 3);
  assert.ok(actions.every((action) => action.authoredMissionFlowOpeningSourceId === "trade-customs-reissued-manifests"));
  assert.ok(actions.every((action) => action.targetNpcId === null));
  assert.match(actions[1].label, /欠番|再発行票/u);

  const chosen = actions[1];
  runtime.playerState.missions["MSN-T14"].progress.hear = 1;
  applyAuthoredMissionFlowAction(runtime, chosen, { ok: true, type: "conversation" });
  const flow = ensureAuthoredMissionFlowState(runtime, "crime-city-arms-smuggling");
  assert.equal(flow.openingSourceId, "trade-customs-reissued-manifests");
  assert.equal(flow.openingChoiceId, "shipping_handoffs_and_port");
});

test("a dead or absent testimony source redirects the same canonical evidence to a hand-authored physical record", () => {
  const runtime = runtimeAt("LOC_TRADE_CUSTOMS");
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
  const runtime = runtimeAt("LOC_CRIME_WEAPON_MARKET", { ceresPresence: "present" });
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
  const runtime = runtimeAt("LOC_CRIME_WEAPON_MARKET", { ceresPresence: "present" });
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
  const mission = missionDefinition();
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
