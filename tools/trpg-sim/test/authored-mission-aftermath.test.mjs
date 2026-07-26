import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORED_MISSION_FLOW_PACKS,
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

test("T03 through T05 routes hand-author distinct NPC aftermath plans and direct-talk scenes", () => {
  for (const troubleId of ["T03", "T04", "T05"]) {
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
