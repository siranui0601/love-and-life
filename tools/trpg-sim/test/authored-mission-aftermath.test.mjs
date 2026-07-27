import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAuthoredMissionFlowCatalogOverrides,
  AUTHORED_MISSION_FLOW_PACKS,
  ensureAuthoredMissionFlowState,
  resolveAuthoredResolutionChoice,
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

test("T03 through T10 routes hand-author distinct NPC aftermath plans and direct-talk scenes", () => {
  for (const troubleId of ["T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10"]) {
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


test("T08 separates intrusion control, ecological explanation and accountable passage before three forest agreements", () => {
  const missionPack = pack("T08");
  assert.ok(missionPack);
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(new Set(missionPack.hearing.choices.map((choice) => choice.id)).size, 3);
  assert.deepEqual(missionPack.catalogRemoveStepIds, ["battle"]);
  assert.deepEqual(missionPack.investigation.requiredEvidenceGroups, [
    [
      "T08-EVIDENCE-INTRUDER-CAMP-CLEARED",
      "T08-EVIDENCE-ROYAL-SURVEY-ORDER-REVOKED",
      "T08-EVIDENCE-FEN-INTRUDER-TRACK-RECORD",
    ],
    [
      "T08-EVIDENCE-RIVER-MAGIC-DRAIN",
      "T08-EVIDENCE-SPIRIT-POOL-DECLINE",
      "T08-EVIDENCE-BARRIER-OVERLOAD-NOT-ATTACK",
    ],
    [
      "T08-EVIDENCE-ESCORT-ENTRY-LEDGER",
      "T08-EVIDENCE-BORDER-WAYSTATION-PROTOCOL",
    ],
  ]);
  assert.deepEqual(missionPack.resolution.choices.map((route) => route.id), [
    "limited_escort_passage",
    "joint_border_accountability",
    "joint_anomaly_expedition_corridor",
  ]);
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.contextVariants.length === 3
    && route.contextVariants.every((variant) =>
      variant.flagKey === "t07ResolutionRoute" && variant.minutes < route.minutes)));
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.worldEffect.aftermathPlans.length >= 2
    && route.worldEffect.followups.length >= 2
    && route.narrativeByTroubleStatus?.critical
    && route.worldEffect.factIdByTroubleStatus?.critical
    && route.worldEffect.textByTroubleStatus?.critical));
});

test("T08 deliberately removes the generic battle and keeps negotiation after investigation", () => {
  const catalog = {
    special: [{
      id: "MSN-T08",
      steps: [
        { id: "hear", type: "conversation", targetLocation: "森", targetFacilityId: "LOC_FOREST_CAMP", required: 1 },
        { id: "investigate", type: "investigate", targetLocation: "森", targetFacilityId: "LOC_FOREST_CAMP", required: 3 },
        { id: "battle", type: "battle", targetLocation: "エルフの隠れ里", targetFacilityId: "LOC_ELF_BARRIER_STONE", encounterId: "ENC-0065", required: 1 },
        { id: "resolve", type: "resolve", targetLocation: "森", targetFacilityId: "LOC_FOREST_CAMP", required: 1 },
      ],
    }],
  };

  applyAuthoredMissionFlowCatalogOverrides(catalog);

  assert.deepEqual(catalog.special[0].steps.map((step) => step.type), [
    "conversation",
    "investigate",
    "resolve",
  ]);
  assert.equal(catalog.special[0].steps.some((step) => step.encounterId === "ENC-0065"), false);
});

test("T07 outcomes materially shorten T08 agreements, with the liaison route preserving the narrowest all-troubles path", () => {
  const missionPack = pack("T08");
  const route = missionPack.resolution.choices.find(
    (entry) => entry.id === "joint_anomaly_expedition_corridor",
  );
  assert.ok(route);

  const base = resolveAuthoredResolutionChoice({ playerState: { worldFlags: {} } }, route);
  const independent = resolveAuthoredResolutionChoice({
    playerState: { worldFlags: { t07ResolutionRoute: "protected_independent_stay" } },
  }, route);
  const charter = resolveAuthoredResolutionChoice({
    playerState: { worldFlags: { t07ResolutionRoute: "voluntary_return_with_youth_charter" } },
  }, route);
  const liaison = resolveAuthoredResolutionChoice({
    playerState: { worldFlags: { t07ResolutionRoute: "forest_liaison_waystation" } },
  }, route);

  assert.deepEqual(
    [base.minutes, independent.minutes, charter.minutes, liaison.minutes],
    [132, 116, 101, 82],
  );
  assert.equal(liaison.id, route.id);
  assert.equal(liaison.contextId, "t07-forest-liaison");
  assert.match(liaison.label, /中立連絡所/u);
});

test("alternative evidence groups complete T08 with one valid proof from each class", () => {
  const missionPack = pack("T08");
  const mission = {
    id: "MSN-T08",
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
    "T08-EVIDENCE-ROYAL-SURVEY-ORDER-REVOKED",
    "T08-EVIDENCE-BARRIER-OVERLOAD-NOT-ATTACK",
    "T08-EVIDENCE-BORDER-WAYSTATION-PROTOCOL",
  ];
  const runtime = {
    playerState: {
      catalog,
      missions: {
        "MSN-T08": {
          status: "active",
          progress: { hear: 1, investigate: 0, resolve: 0 },
          discoveries: selectedEvidence.map((id) => ({ id })),
        },
      },
    },
  };
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  assert.deepEqual(new Set(flow.evidenceIds), new Set(selectedEvidence));
  assert.equal(runtime.playerState.missions["MSN-T08"].progress.investigate, 3);
});


test("T09 separates predicted structural danger, forced production and a viable rescue route before three mine settlements", () => {
  const missionPack = pack("T09");
  assert.ok(missionPack);
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(new Set(missionPack.hearing.choices.map((choice) => choice.id)).size, 3);
  assert.deepEqual(missionPack.investigation.requiredEvidenceGroups, [
    [
      "T09-EVIDENCE-MINA-SUPPORT-STRESS-CALCULATION",
      "T09-EVIDENCE-BROLN-INSPECTION-WARNING",
      "T09-EVIDENCE-RIKKA-CREAK-TESTIMONY",
    ],
    [
      "T09-EVIDENCE-GRAD-OVERRIDE-ORDER",
      "T09-EVIDENCE-NOTICE-WARNING-REMOVED",
      "T09-EVIDENCE-DEEP-ORE-PREMIUM-CONTRACT",
    ],
    [
      "T09-EVIDENCE-VENTILATION-SHAFT-ROUTE",
      "T09-EVIDENCE-RESCUE-JACK-ASSEMBLY",
      "T09-EVIDENCE-LOAD-BEAST-HAUL-PLAN",
    ],
  ]);
  const rescue = missionPack.catalogOverride.battle;
  assert.equal(rescue.encounterId, "ENC-0050");
  assert.deepEqual(rescue.timelineVariants.map((variant) => [
    variant.minDay,
    variant.maxDay ?? null,
    variant.targetFacilityId,
    variant.actionType,
    variant.encounterId ?? null,
  ]), [
    [27, 27, "LOC_DWARF_MINE", "investigate", null],
    [28, 29, "LOC_DWARF_ENGINEER", "missionBattle", "ENC-0049"],
    [30, 32, "LOC_DWARF_MINE", "missionBattle", "ENC-0050"],
    [33, null, "LOC_DWARF_MINE", "investigate", null],
  ]);
  assert.deepEqual(missionPack.resolution.choices.map((route) => route.id), [
    "emergency_moratorium_and_reinspection",
    "public_accountability_and_safety_council",
    "rebuild_deep_mine_and_rescue_corps",
  ]);
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.worldEffect.aftermathPlans.length >= 2
    && route.worldEffect.followups.length >= 2
    && route.summaryByTroubleStatus?.critical
    && route.narrativeByTroubleStatus?.critical
    && route.worldEffect.factIdByTroubleStatus?.critical
    && route.worldEffect.textByTroubleStatus?.critical));
});

test("T09 changes rescue from prevention to machinery and collapse battles, then preserves a post-deadline accountability path", () => {
  const catalog = {
    special: [{
      id: "MSN-T09",
      steps: [
        { id: "hear", type: "conversation", targetLocation: "ドワーフ洞窟", targetFacilityId: "LOC_DWARF_ENGINEER", required: 1 },
        { id: "investigate", type: "investigate", targetLocation: "ドワーフ洞窟", targetFacilityId: "LOC_DWARF_ENGINEER", required: 3 },
        { id: "resolve", type: "resolve", targetLocation: "ドワーフ洞窟", targetFacilityId: "LOC_DWARF_NOTICE", required: 1 },
      ],
    }],
  };

  applyAuthoredMissionFlowCatalogOverrides(catalog);

  const rescue = catalog.special[0].steps.find((step) => step.type === "battle");
  assert.ok(rescue);
  assert.equal(rescue.targetFacilityId, "LOC_DWARF_MINE");
  assert.equal(rescue.encounterId, "ENC-0050");
  assert.deepEqual(rescue.timelineVariants.map((variant) => variant.actionType), [
    "investigate",
    "missionBattle",
    "missionBattle",
    "investigate",
  ]);
});

test("T04 records and survivor knowledge shorten the T09 deep-mine reconstruction spider route", () => {
  const missionPack = pack("T09");
  const route = missionPack.resolution.choices.find(
    (entry) => entry.id === "rebuild_deep_mine_and_rescue_corps",
  );
  assert.ok(route);

  const base = resolveAuthoredResolutionChoice({ playerState: { worldFlags: {} } }, route);
  const openRecords = resolveAuthoredResolutionChoice({
    playerState: { worldFlags: { t04ResolutionRoute: "open_records_and_oversee" } },
  }, route);
  const rescuedWitnesses = resolveAuthoredResolutionChoice({
    playerState: { worldFlags: { t04ResolutionRoute: "recover_then_pause" } },
  }, route);

  assert.deepEqual([base.minutes, openRecords.minutes, rescuedWitnesses.minutes], [124, 84, 102]);
  assert.equal(openRecords.contextId, "t04-open-records-engineering");
  assert.match(openRecords.label, /古代神殿/u);
});

test("alternative evidence groups complete T09 with one valid proof from danger, responsibility and rescue access", () => {
  const missionPack = pack("T09");
  const mission = {
    id: "MSN-T09",
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
    "T09-EVIDENCE-BROLN-INSPECTION-WARNING",
    "T09-EVIDENCE-NOTICE-WARNING-REMOVED",
    "T09-EVIDENCE-RESCUE-JACK-ASSEMBLY",
  ];
  const runtime = {
    playerState: {
      catalog,
      missions: {
        "MSN-T09": {
          status: "active",
          progress: { hear: 1, investigate: 0, battle: 0, resolve: 0 },
          discoveries: selectedEvidence.map((id) => ({ id })),
        },
      },
    },
  };
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  assert.deepEqual(new Set(flow.evidenceIds), new Set(selectedEvidence));
  assert.equal(runtime.playerState.missions["MSN-T09"].progress.investigate, 3);
});



test("T10 separates protected tenure, manufactured default and coercive pressure before three orphanage outcomes", () => {
  const missionPack = pack("T10");
  assert.ok(missionPack);
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(new Set(missionPack.hearing.choices.map((choice) => choice.id)).size, 3);
  assert.deepEqual(missionPack.investigation.requiredEvidenceGroups, [
    [
      "T10-EVIDENCE-ORPHANAGE-FOUNDATION-COPY",
      "T10-EVIDENCE-DONATION-DEED-ORIGINAL",
      "T10-EVIDENCE-CONTINUOUS-USE-LAND-LEDGER",
    ],
    [
      "T10-EVIDENCE-INFLATED-REPAIR-INVOICES",
      "T10-EVIDENCE-DEBT-ASSIGNMENT-TO-ISAAC",
      "T10-EVIDENCE-BACKDATED-EVICTION-NOTICE",
    ],
    [
      "T10-EVIDENCE-LEONARDO-ISAAC-SIDE-DEAL",
      "T10-EVIDENCE-DISTORTED-GUARD-ORDER",
      "T10-EVIDENCE-WHOLE-HOUSEHOLD-RELOCATION-PLAN",
    ],
  ]);
  const intervention = missionPack.catalogOverride.battle;
  assert.equal(intervention.encounterId, null);
  assert.equal(intervention.actionType, "investigate");
  assert.deepEqual(intervention.timelineVariants.map((variant) => [
    variant.minDay,
    variant.maxDay ?? null,
    variant.targetFacilityId,
    variant.actionType,
    variant.encounterId ?? null,
  ]), [
    [26, 43, "LOC_CAP_OFFICE", "investigate", null],
    [44, 56, "LOC_CAP_ORPHANAGE", "investigate", null],
    [57, 69, "LOC_CAP_LOWER_INN", "investigate", null],
  ]);
  assert.deepEqual(missionPack.resolution.choices.map((route) => route.id), [
    "restore_donation_title_and_stay",
    "public_charitable_trust_and_audit",
    "whole_household_relocation_covenant",
  ]);
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.worldEffect.aftermathPlans.length >= 3
    && route.worldEffect.followups.length >= 3
    && route.summaryByTroubleStatus?.critical
    && route.narrativeByTroubleStatus?.critical
    && route.worldEffect.factIdByTroubleStatus?.critical
    && route.worldEffect.textByTroubleStatus?.critical));
});


test("T10 inserts a noncombat intervention that changes from injunction to execution stay and household reassembly", () => {
  const catalog = {
    special: [{
      id: "MSN-T10",
      steps: [
        { id: "hear", type: "conversation", targetLocation: "王都", targetFacilityId: "LOC_CAP_ORPHANAGE", required: 1 },
        { id: "investigate", type: "investigate", targetLocation: "王都", targetFacilityId: "LOC_CAP_ORPHANAGE", required: 3 },
        { id: "resolve", type: "resolve", targetLocation: "王都", targetFacilityId: "LOC_CAP_OFFICE", required: 1 },
      ],
    }],
  };

  applyAuthoredMissionFlowCatalogOverrides(catalog);

  const intervention = catalog.special[0].steps.find((step) => step.id === "battle");
  assert.ok(intervention);
  assert.equal(intervention.type, "battle");
  assert.equal(intervention.actionType, "investigate");
  assert.equal(intervention.encounterId, null);
  assert.ok(intervention.timelineVariants.every((variant) =>
    variant.actionType === "investigate" && variant.encounterId === null));
  assert.deepEqual(catalog.special[0].steps.map((step) => step.id), [
    "hear",
    "investigate",
    "battle",
    "resolve",
  ]);
});


test("T02 resolution shortens T10 public trust formation through stable food support", () => {
  const missionPack = pack("T10");
  const route = missionPack.resolution.choices.find(
    (entry) => entry.id === "public_charitable_trust_and_audit",
  );
  assert.ok(route);

  const base = resolveAuthoredResolutionChoice({
    playerState: { worldFlags: {}, troubles: {} },
  }, route);
  const foodProtected = resolveAuthoredResolutionChoice({
    playerState: {
      worldFlags: {},
      troubles: { T02: { status: "resolved" } },
    },
  }, route);

  assert.deepEqual([base.minutes, foodProtected.minutes], [118, 94]);
  assert.equal(foodProtected.contextId, "t02-food-cost-stabilized");
  assert.match(foodProtected.label, /田園の村/u);
});


test("T07 capital protection network shortens T10 whole-household relocation", () => {
  const missionPack = pack("T10");
  const route = missionPack.resolution.choices.find(
    (entry) => entry.id === "whole_household_relocation_covenant",
  );
  assert.ok(route);

  const base = resolveAuthoredResolutionChoice({
    playerState: { worldFlags: {}, troubles: {} },
  }, route);
  const protectedNetwork = resolveAuthoredResolutionChoice({
    playerState: {
      worldFlags: { t07ResolutionRoute: "protected_independent_stay" },
      troubles: {},
    },
  }, route);

  assert.deepEqual([base.minutes, protectedNetwork.minutes], [106, 82]);
  assert.equal(protectedNetwork.contextId, "t07-capital-protection-network");
  assert.match(protectedNetwork.label, /リュシア/u);
});


test("alternative evidence groups complete T10 with one proof from tenure, manufactured debt and coercion", () => {
  const missionPack = pack("T10");
  const mission = {
    id: "MSN-T10",
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
    "T10-EVIDENCE-DONATION-DEED-ORIGINAL",
    "T10-EVIDENCE-DEBT-ASSIGNMENT-TO-ISAAC",
    "T10-EVIDENCE-DISTORTED-GUARD-ORDER",
  ];
  const runtime = {
    playerState: {
      catalog,
      missions: {
        "MSN-T10": {
          status: "active",
          progress: { hear: 1, investigate: 0, battle: 0, resolve: 0 },
          discoveries: selectedEvidence.map((id) => ({ id })),
        },
      },
    },
  };
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  assert.deepEqual(new Set(flow.evidenceIds), new Set(selectedEvidence));
  assert.equal(runtime.playerState.missions["MSN-T10"].progress.investigate, 3);
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
