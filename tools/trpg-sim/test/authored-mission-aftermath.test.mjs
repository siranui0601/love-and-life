import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAuthoredMissionFlowCatalogOverrides,
  AUTHORED_MISSION_FLOW_PACKS,
  ensureAuthoredMissionFlowState,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import { resolveAuthoredScene } from "../../../src/server/trpg/content/authored-scene-registry.js";
import {
  completeNpcLifeTick,
  createNpcLifeEngine,
  prepareNpcLifeTick,
} from "../lib/npc-life-engine.mjs";

function pack(troubleId) {
  return AUTHORED_MISSION_FLOW_PACKS.find((entry) => entry.troubleId === troubleId);
}

test("T03 through T07 routes hand-author distinct NPC aftermath plans and direct-talk scenes", () => {
  for (const troubleId of ["T03", "T04", "T05", "T06", "T07"]) {
    const missionPack = pack(troubleId);
    assert.ok(missionPack);
    assert.equal(missionPack.resolution.choices.length, 3);
    for (const route of missionPack.resolution.choices) {
      assert.ok(route.worldEffect.aftermathPlans.length >= 2, `${troubleId}:${route.id} needs multiple aftermath actors`);
      assert.ok(route.worldEffect.followups.length >= 1, `${troubleId}:${route.id} needs authored dialogue`);
      assert.equal(new Set(route.worldEffect.aftermathPlans.map((plan) => plan.id)).size,
        route.worldEffect.aftermathPlans.length);
      const followup = route.worldEffect.followups[0];
      const scene = resolveAuthoredScene({
        action: {
          type: "conversation",
          targetNpcId: followup.npcId,
          dialogueTopic: "direct_contact",
        },
        world: { flags: { [route.worldEffect.flagKey]: route.id } },
        mission: {},
        location: {},
        outcome: {},
      });
      assert.equal(scene?.sceneId,
        `mission-flow.${missionPack.id}.followup.${route.id}.${followup.id}`);
      assert.match(scene.narrative, /。/u);
      assert.ok(scene.beats.some((beat) => beat.actorId === followup.npcId));
    }
  }
});


test("T05 requires antidote, poison route and patron order before its three political resolutions", () => {
  const missionPack = pack("T05");
  assert.ok(missionPack);
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(new Set(missionPack.hearing.choices.map((choice) => choice.id)).size, 3);
  assert.deepEqual(missionPack.investigation.requiredEvidenceIds, [
    "T05-EVIDENCE-ANTIDOTE-FORMULA",
    "T05-EVIDENCE-CRIME-POISON-ROUTE",
    "T05-EVIDENCE-CEDRIC-POISON-ORDER",
  ]);
  assert.equal(missionPack.catalogOverride.battle.encounterId, "ENC-0033");
  assert.equal(missionPack.catalogOverride.battle.targetFacilityId, "LOC_TRADE_WAREHOUSE");
  assert.deepEqual(missionPack.resolution.choices.map((route) => route.id), [
    "protect_nicolas_and_treat",
    "buy_crime_ledger_antidote",
    "royal_physician_public_indictment",
  ]);
  assert.equal(new Set(missionPack.resolution.choices
    .map((route) => route.worldEffect.factId)).size, 3);
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.worldEffect.aftermathPlans.length >= 2
    && route.worldEffect.followups.length >= 2));
});

test("an authored political conflict injects its battle between investigation and resolution", () => {
  const catalog = {
    special: [{
      id: "MSN-T05",
      steps: [
        { id: "hear", type: "conversation", targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_LORD_MANOR", required: 1 },
        { id: "investigate", type: "investigate", targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_LORD_MANOR", required: 1 },
        { id: "resolve", type: "resolve", targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_LORD_MANOR", required: 1 },
      ],
    }],
  };

  applyAuthoredMissionFlowCatalogOverrides(catalog);

  const steps = catalog.special[0].steps;
  assert.deepEqual(steps.map((step) => step.type), [
    "conversation",
    "investigate",
    "battle",
    "resolve",
  ]);
  const battle = steps[2];
  assert.equal(battle.id, "battle");
  assert.equal(battle.encounterId, "ENC-0033");
  assert.equal(battle.targetFacilityId, "LOC_TRADE_WAREHOUSE");
  assert.equal(battle.required, 1);
});


test("T06 separates labor harm, guild manipulation and criminal weapon supply before three port settlements", () => {
  const missionPack = pack("T06");
  assert.ok(missionPack);
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(new Set(missionPack.hearing.choices.map((choice) => choice.id)).size, 3);
  assert.deepEqual(missionPack.investigation.requiredEvidenceIds, [
    "T06-EVIDENCE-REAL-WAGE-AND-INJURY-LOSS",
    "T06-EVIDENCE-GUILD-CONTRACT-MANIPULATION",
    "T06-EVIDENCE-CRIME-WEAPON-SUPPLY",
  ]);
  assert.equal(missionPack.catalogOverride.battle.encounterId, "ENC-0033");
  assert.deepEqual(missionPack.catalogOverride.battle.encounterIdByTroubleStatus, {
    active: "ENC-0033",
    critical: "ENC-0034",
  });
  assert.equal(missionPack.catalogOverride.battle.targetFacilityId, "LOC_TRADE_WAREHOUSE");
  assert.deepEqual(missionPack.resolution.choices.map((route) => route.id), [
    "temporary_wage_truce",
    "lord_backed_labor_compact",
    "worker_cooperative_and_smuggling_watch",
  ]);
  assert.equal(new Set(missionPack.resolution.choices
    .map((route) => route.worldEffect.factId)).size, 3);
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.worldEffect.aftermathPlans.length >= 2
    && route.worldEffect.followups.length >= 2));
  assert.ok(missionPack.resolution.choices.slice(1).every((route) =>
    route.narrativeByTroubleStatus?.critical
    && route.worldEffect.factIdByTroubleStatus?.critical
    && route.worldEffect.textByTroubleStatus?.critical));
});

test("T06 preserves active smuggler interception and critical armed-worker escalation in one authored battle step", () => {
  const catalog = {
    special: [{
      id: "MSN-T06",
      steps: [
        { id: "hear", type: "conversation", targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_PORT", required: 1 },
        { id: "investigate", type: "investigate", targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_PORT", required: 1 },
        { id: "resolve", type: "resolve", targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_GUILD", required: 1 },
      ],
    }],
  };

  applyAuthoredMissionFlowCatalogOverrides(catalog);

  const battle = catalog.special[0].steps.find((step) => step.type === "battle");
  assert.ok(battle);
  assert.equal(battle.targetFacilityId, "LOC_TRADE_WAREHOUSE");
  assert.equal(battle.encounterId, "ENC-0033");
  assert.deepEqual(battle.encounterIdByTroubleStatus, {
    active: "ENC-0033",
    critical: "ENC-0034",
  });
  assert.match(battle.labelByTroubleStatus.active, /密輸運び屋/u);
  assert.match(battle.labelByTroubleStatus.critical, /一部労働者/u);
});



test("T07 preserves agency, deception, and trafficking-route evidence before three freedom-respecting outcomes", () => {
  const missionPack = pack("T07");
  assert.ok(missionPack);
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(new Set(missionPack.hearing.choices.map((choice) => choice.id)).size, 3);
  assert.deepEqual(missionPack.investigation.requiredEvidenceGroups, [
    [
      "T07-EVIDENCE-TIA-LETTER-VOLUNTARY-DEPARTURE",
      "T07-EVIDENCE-MAZE-DIARY-OUTSIDE-WISH",
      "T07-EVIDENCE-BLACK-LAMP-LYSIA-STATEMENT",
    ],
    [
      "T07-EVIDENCE-DAMIAN-FALSE-GUIDE-CONTRACT",
      "T07-EVIDENCE-CAPITAL-INN-BINDING-ORDER",
    ],
    [
      "T07-EVIDENCE-DAMIAN-BUYER-ROUTE",
      "T07-EVIDENCE-CRIME-DOCK-MANIFEST",
      "T07-EVIDENCE-CALVAN-MARKET-LEDGER",
    ],
  ]);
  const rescue = missionPack.catalogOverride.battle;
  assert.equal(rescue.encounterId, "ENC-0042");
  assert.deepEqual(rescue.timelineVariants.map((variant) => [
    variant.minDay,
    variant.maxDay ?? null,
    variant.targetLocation,
    variant.targetFacilityId,
    variant.actionType,
    variant.encounterId ?? null,
  ]), [
    [18, 24, "森", "LOC_FOREST_EDGE", "investigate", null],
    [25, 30, "森", "LOC_FOREST_EDGE", "investigate", null],
    [31, 38, "王都", "LOC_CAP_LOWER_INN", "investigate", null],
    [39, null, "犯罪都市", "LOC_CRIME_SLAVE_MARKET", "missionBattle", "ENC-0042"],
  ]);
  assert.deepEqual(missionPack.resolution.choices.map((route) => route.id), [
    "protected_independent_stay",
    "voluntary_return_with_youth_charter",
    "forest_liaison_waystation",
  ]);
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.worldEffect.aftermathPlans.length >= 2
    && route.worldEffect.followups.length >= 2));
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.narrativeByTroubleStatus?.critical
    && route.worldEffect.factIdByTroubleStatus?.critical
    && route.worldEffect.textByTroubleStatus?.critical));
});

test("alternative evidence groups complete T07 with one valid proof from each class", () => {
  const missionPack = pack("T07");
  const mission = {
    id: "MSN-T07",
    steps: [
      { id: "hear", type: "conversation", required: 1 },
      { id: "investigate", type: "investigate", required: 3 },
      { id: "battle", type: "battle", required: 1 },
      { id: "resolve", type: "resolve", required: 1 },
    ],
  };
  const catalog = { special: [mission], byId: new Map([[mission.id, mission]]) };
  applyAuthoredMissionFlowCatalogOverrides(catalog);
  const selectedEvidence = [
    "T07-EVIDENCE-TIA-LETTER-VOLUNTARY-DEPARTURE",
    "T07-EVIDENCE-CAPITAL-INN-BINDING-ORDER",
    "T07-EVIDENCE-CRIME-DOCK-MANIFEST",
  ];
  const runtime = {
    playerState: {
      catalog,
      missions: {
        "MSN-T07": {
          status: "active",
          progress: { hear: 1, investigate: 0, battle: 0, resolve: 0 },
          discoveries: selectedEvidence.map((id) => ({ id })),
        },
      },
    },
  };
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  assert.deepEqual(new Set(flow.evidenceIds), new Set(selectedEvidence));
  assert.equal(runtime.playerState.missions["MSN-T07"].progress.investigate, 3);
});

test("the generic NPC life engine travels, performs, and retires one authored aftermath plan", () => {
  const npc = {
    id: "NPC_TEST",
    name: "試験村長",
    initialStatus: "存命",
    initialLocation: "田園の村",
    initialFacilityId: "LOC_FARM_CHIEF",
    mainFacilityId: "LOC_FARM_CHIEF",
    relatedFacilityIds: ["LOC_FARM_CHIEF", "LOC_FARM_EDGE"],
    relatedTroubleIds: ["T03"],
    initialKnowledge: { facts: [], interests: [], misconceptions: [], secrets: [] },
    knowledgeTags: "",
    occupation: "村長",
    primaryGoal: "村を守る",
    disposition: "assist",
    routine: {},
    fateHints: { troubleIds: [], dayAnchors: [], sourceText: "", outcomeKeywords: [] },
    nonInterventionFate: "",
    home: "田園の村",
  };
  const facilities = [
    { id: "LOC_FARM_CHIEF", name: "村長宅", hub: "田園の村", relatedTroubleIds: ["T03"], sourceOrder: 1 },
    { id: "LOC_FARM_EDGE", name: "村外れ", hub: "田園の村", relatedTroubleIds: ["T03"], sourceOrder: 2 },
  ];
  const trouble = { id: "T03", category: "狼被害", primaryLocations: ["田園の村"], deadlineDay: 20 };
  const model = {
    npcs: [npc],
    npcById: { NPC_TEST: npc },
    facilities,
    facilityById: Object.fromEntries(facilities.map((entry) => [entry.id, entry])),
    facilitiesByHub: { "田園の村": facilities },
    locations: ["田園の村"],
    routes: [],
    troubles: [trouble],
    troubleById: { T03: trouble },
  };
  const npcStates = { NPC_TEST: { id: "NPC_TEST" } };
  const engine = createNpcLifeEngine({ model, seed: "aftermath-test", npcStates });
  const state = engine.npcStates.NPC_TEST;
  state.needs = { hunger: 5, fatigue: 5, stress: 10, social: 5 };
  state.beliefs["player:T03:test-aftermath"] = {
    factId: "player:T03:test-aftermath",
    kind: "trouble",
    text: "赤牙狼への対応後、村外れの境界を点検することになった",
    troubleId: "T03",
    troubleIds: ["T03"],
    troubleStatus: "resolved",
    confidence: 1,
    importance: 0.95,
    secret: false,
    learnedAt: 0,
    propagationAt: 0,
    sourceType: "player-intervention",
    sourceNpcId: null,
    provenanceEventId: "KTEST",
    hopCount: 1,
    path: ["facility:LOC_FARM_EDGE", "NPC_TEST"],
    aftermathPlans: [{
      id: "test-secure-boundary",
      npcIds: ["NPC_TEST"],
      goal: "secure-boundary",
      action: "inspect-boundary",
      targetHub: "田園の村",
      targetFacilityId: "LOC_FARM_EDGE",
      statusText: "村外れの境界を点検している",
      reason: "test-authored-aftermath",
    }],
  };
  state.knowledgeRevision += 1;
  engine.knowledgeEvents.push({
    id: "KTEST",
    eventId: "KTEST",
    type: "authored-aftermath",
    npcId: "NPC_TEST",
    factId: "player:T03:test-aftermath",
    learnedAt: 0,
    propagationAt: 0,
    sourceType: "player-intervention",
    hopCount: 1,
    path: ["facility:LOC_FARM_EDGE", "NPC_TEST"],
  });

  completeNpcLifeTick(engine, {
    time: { day: 1, phaseIndex: 0, absoluteHour: 1 },
    troubleStates: { T03: { status: "resolved" } },
    worldFlags: {},
  });
  const travelDecision = engine.decisionEvents.at(-1);
  assert.equal(travelDecision.goal, "aftermath:secure-boundary");
  assert.equal(travelDecision.action, "local-travel");
  assert.equal(travelDecision.targetFacilityId, "LOC_FARM_EDGE");
  assert.equal(travelDecision.aftermathPlanId, "test-secure-boundary");

  prepareNpcLifeTick(engine, {
    time: { day: 1, phaseIndex: 0, absoluteHour: 1.5 },
    troubleStates: { T03: { status: "resolved" } },
    worldFlags: {},
  });
  completeNpcLifeTick(engine, {
    time: { day: 1, phaseIndex: 0, absoluteHour: 1.5 },
    troubleStates: { T03: { status: "resolved" } },
    worldFlags: {},
  });
  const dutyDecision = engine.decisionEvents.at(-1);
  assert.equal(dutyDecision.action, "inspect-boundary");
  assert.equal(dutyDecision.aftermathPlanId, "test-secure-boundary");
  assert.ok(state.completedAftermathPlanIds.includes("test-secure-boundary"));
  assert.equal(state.status, "村外れの境界を点検している");

  completeNpcLifeTick(engine, {
    time: { day: 1, phaseIndex: 0, absoluteHour: 2 },
    troubleStates: { T03: { status: "resolved" } },
    worldFlags: {},
  });
  assert.notEqual(engine.decisionEvents.at(-1).aftermathPlanId, "test-secure-boundary");
});
