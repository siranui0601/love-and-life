import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAuthoredMissionFlowAction,
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

test("T03 through T13 routes hand-author distinct NPC aftermath plans and direct-talk scenes", () => {
  for (const troubleId of ["T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10", "T11", "T12", "T13"]) {
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



test("T11 offers thousands of deterministic route shapes across witnesses, contracts, finance and prevention", () => {
  const missionPack = pack("T11");
  assert.ok(missionPack);
  assert.equal(missionPack.persistResolutionBranch, true);
  assert.deepEqual(missionPack.branching, {
    evidenceDimensions: 4,
    alternativesPerDimension: 3,
    evidenceProfiles: 81,
    orderingPermutationsPerProfile: 24,
    topLevelResolutions: 3,
    minimumRouteShapesBeforePriorState: 5832,
    evidenceOrderChangesContext: true,
    persistentBranchSignature: true,
    note: "三つの導入、四分類それぞれ三つの代替証拠、取得順、介入日、過去事件、三解決を組み合わせる。",
  });
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(missionPack.investigation.leads.length, 12);
  assert.deepEqual(missionPack.investigation.requiredEvidenceGroups, [
    [
      "T11-EVIDENCE-NOAH-ALLEY-ROUTE-MAP",
      "T11-EVIDENCE-MILAN-GUARD-SHIFT-OBSERVATION",
      "T11-EVIDENCE-ROYAL-SCHEDULE-COPY",
    ],
    [
      "T11-EVIDENCE-REN-CONTRACT-TOKEN",
      "T11-EVIDENCE-CROW-INTERMEDIARY-LEDGER",
      "T11-EVIDENCE-VERA-BLACK-LAMP-GUEST-REGISTER",
    ],
    [
      "T11-EVIDENCE-KIRI-PAYMENT-CHAIN",
      "T11-EVIDENCE-PETRA-PREPRINTED-COUP-PLATE",
      "T11-EVIDENCE-LEONARDO-CODED-BILL-OF-EXCHANGE",
    ],
    [
      "T11-EVIDENCE-VICTOR-COUNTER-ROUTE-PLAN",
      "T11-EVIDENCE-CASTLE-DECOY-SCHEDULE",
      "T11-EVIDENCE-JERICHO-ESCAPE-HORSE-TRACE",
    ],
  ]);
  assert.deepEqual(missionPack.catalogOverride.battle.timelineVariants.map((variant) => [
    variant.minDay,
    variant.maxDay ?? null,
    variant.troubleId ?? null,
    variant.troubleStatuses ?? null,
    variant.actionType,
    variant.encounterId ?? null,
  ]), [
    [20, 34, null, null, "investigate", null],
    [35, 48, null, null, "missionBattle", "ENC-0025"],
    [49, 59, "T14", ["critical", "failed"], "missionBattle", "ENC-0043"],
    [49, 59, null, null, "missionBattle", "ENC-0025"],
  ]);
  assert.deepEqual(missionPack.resolution.choices.map((route) => route.id), [
    "silent_counterplot_and_protect_king",
    "public_conspiracy_inquiry_and_guard_reform",
    "turn_assassin_and_trace_network",
  ]);
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.contextVariants.length >= 7
    && route.worldEffect.aftermathPlans.length >= 3
    && route.worldEffect.followups.length >= 3
    && route.summaryByTroubleStatus?.critical
    && route.narrativeByTroubleStatus?.critical));
});

test("all 81 T11 evidence profiles satisfy the four independent truth classes", () => {
  const missionPack = pack("T11");
  const groups = missionPack.investigation.requiredEvidenceGroups;
  const profiles = groups.reduce(
    (rows, group) => rows.flatMap((row) => group.map((evidenceId) => [...row, evidenceId])),
    [[]],
  );
  assert.equal(profiles.length, 81);
  assert.equal(new Set(profiles.map((profile) => profile.join("|"))).size, 81);

  for (const selectedEvidence of profiles) {
    const mission = {
      id: "MSN-T11",
      steps: [
        { id: "hear", type: "conversation", required: 1 },
        { id: "investigate", type: "investigate", required: 4 },
        { id: "battle", type: "battle", required: 1 },
        { id: "resolve", type: "resolve", required: 1 },
      ],
    };
    const catalog = { special: [mission], byId: new Map([[mission.id, mission]]) };
    applyAuthoredMissionFlowCatalogOverrides(catalog);
    const runtime = {
      playerState: {
        catalog,
        missions: {
          "MSN-T11": {
            status: "active",
            progress: { hear: 1, investigate: 0, battle: 0, resolve: 0 },
            discoveries: selectedEvidence.map((id) => ({ id })),
          },
        },
      },
    };
    const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
    assert.deepEqual(new Set(flow.evidenceIds), new Set(selectedEvidence));
    assert.equal(runtime.playerState.missions["MSN-T11"].progress.investigate, 4);
  }
});

test("T11 resolution contexts react to prior troubles, exact evidence and acquisition order", () => {
  const missionPack = pack("T11");
  const [silent, publicInquiry, turnAssassin] = missionPack.resolution.choices;
  const runtimeFor = ({ openingChoiceId, evidenceIds, worldFlags = {}, troubles = {} }) => ({
    authoredMissionFlows: {
      [missionPack.id]: { openingChoiceId, evidenceIds },
    },
    playerState: {
      worldFlags,
      troubles,
      missions: {
        "MSN-T11": { discoveries: evidenceIds.map((id) => ({ id })) },
      },
    },
  });

  const witnessFirst = runtimeFor({
    openingChoiceId: "street_witnesses_and_routes",
    evidenceIds: [
      "T11-EVIDENCE-NOAH-ALLEY-ROUTE-MAP",
      "T11-EVIDENCE-REN-CONTRACT-TOKEN",
      "T11-EVIDENCE-KIRI-PAYMENT-CHAIN",
      "T11-EVIDENCE-VICTOR-COUNTER-ROUTE-PLAN",
    ],
  });
  const witnessRoute = resolveAuthoredResolutionChoice(witnessFirst, silent);
  assert.equal(witnessRoute.contextId, "witness-first-victor-lock");
  assert.equal(witnessRoute.minutes, 68);

  const t10Quiet = runtimeFor({
    openingChoiceId: "street_witnesses_and_routes",
    evidenceIds: [
      "T11-EVIDENCE-NOAH-ALLEY-ROUTE-MAP",
      "T11-EVIDENCE-REN-CONTRACT-TOKEN",
      "T11-EVIDENCE-KIRI-PAYMENT-CHAIN",
      "T11-EVIDENCE-VICTOR-COUNTER-ROUTE-PLAN",
    ],
    worldFlags: { t10ResolutionRoute: "restore_donation_title_and_stay" },
  });
  assert.equal(resolveAuthoredResolutionChoice(t10Quiet, silent).contextId, "t10-noah-victor-quiet-net");
  assert.equal(resolveAuthoredResolutionChoice(t10Quiet, silent).minutes, 54);

  const armed = runtimeFor({
    openingChoiceId: "street_witnesses_and_routes",
    evidenceIds: [
      "T11-EVIDENCE-NOAH-ALLEY-ROUTE-MAP",
      "T11-EVIDENCE-REN-CONTRACT-TOKEN",
      "T11-EVIDENCE-KIRI-PAYMENT-CHAIN",
      "T11-EVIDENCE-VICTOR-COUNTER-ROUTE-PLAN",
    ],
    worldFlags: { t10ResolutionRoute: "restore_donation_title_and_stay" },
    troubles: { T14: { status: "failed" } },
  });
  assert.equal(resolveAuthoredResolutionChoice(armed, silent).contextId, "armed-noah-victor-counterline");
  assert.equal(resolveAuthoredResolutionChoice(armed, silent).minutes, 88);

  const financeFirst = runtimeFor({
    openingChoiceId: "noble_finance_and_royal_schedule",
    evidenceIds: [
      "T11-EVIDENCE-KIRI-PAYMENT-CHAIN",
      "T11-EVIDENCE-CROW-INTERMEDIARY-LEDGER",
      "T11-EVIDENCE-NOAH-ALLEY-ROUTE-MAP",
      "T11-EVIDENCE-VICTOR-COUNTER-ROUTE-PLAN",
    ],
  });
  assert.equal(resolveAuthoredResolutionChoice(financeFirst, publicInquiry).contextId, "finance-first-public-dossier");
  assert.equal(resolveAuthoredResolutionChoice(financeFirst, publicInquiry).minutes, 101);

  const contractFirst = runtimeFor({
    openingChoiceId: "assassin_contract_chain",
    evidenceIds: [
      "T11-EVIDENCE-REN-CONTRACT-TOKEN",
      "T11-EVIDENCE-NOAH-ALLEY-ROUTE-MAP",
      "T11-EVIDENCE-KIRI-PAYMENT-CHAIN",
      "T11-EVIDENCE-JERICHO-ESCAPE-HORSE-TRACE",
    ],
  });
  assert.equal(resolveAuthoredResolutionChoice(contractFirst, turnAssassin).contextId, "contract-first-double-agent");
  assert.equal(resolveAuthoredResolutionChoice(contractFirst, turnAssassin).minutes, 90);
});

test("T11 persists a different branch signature when the same evidence is collected in a different order", () => {
  const missionPack = pack("T11");
  const mission = {
    id: "MSN-T11",
    steps: [
      { id: "hear", type: "conversation", required: 1 },
      { id: "investigate", type: "investigate", required: 4 },
      { id: "battle", type: "battle", required: 1 },
      { id: "resolve", type: "resolve", required: 1 },
    ],
  };
  const ordered = [
    "T11-EVIDENCE-REN-CONTRACT-TOKEN",
    "T11-EVIDENCE-NOAH-ALLEY-ROUTE-MAP",
    "T11-EVIDENCE-KIRI-PAYMENT-CHAIN",
    "T11-EVIDENCE-JERICHO-ESCAPE-HORSE-TRACE",
  ];
  const execute = (evidenceIds) => {
    const catalogMission = { ...mission, steps: mission.steps.map((step) => ({ ...step })) };
    const catalog = { special: [catalogMission], byId: new Map([[catalogMission.id, catalogMission]]) };
    applyAuthoredMissionFlowCatalogOverrides(catalog);
    const runtime = {
      playerState: {
        absoluteMinute: 49 * 1440,
        catalog,
        worldFlags: {},
        troubles: { T11: { status: "active" } },
        player: { location: "王都", facilityId: "LOC_CAP_CASTLE" },
        history: [],
        missions: {
          "MSN-T11": {
            status: "active",
            progress: { hear: 1, investigate: 4, battle: 1, resolve: 0 },
            discoveries: evidenceIds.map((id) => ({ id })),
          },
        },
      },
    };
    const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
    flow.openingChoiceId = "assassin_contract_chain";
    flow.evidenceIds = [...evidenceIds];
    const result = { ok: true };
    assert.equal(applyAuthoredMissionFlowAction(runtime, {
      authoredMissionFlowId: missionPack.id,
      authoredMissionFlowKind: "resolution",
      authoredMissionFlowResolutionRouteId: "turn_assassin_and_trace_network",
      authoredMissionFlowResolutionContextVariantId: "contract-first-double-agent",
      authoredMissionFlowTroubleStatus: "active",
    }, result), true);
    assert.equal(runtime.playerState.worldFlags.t11ResolutionRoute, "turn_assassin_and_trace_network");
    assert.equal(runtime.playerState.worldFlags.t11ResolutionContext, "contract-first-double-agent");
    assert.equal(flow.selectedResolutionContextId, "contract-first-double-agent");
    assert.equal(flow.resolutionBranchId, runtime.playerState.worldFlags.t11ResolutionBranch);
    assert.deepEqual(runtime.playerState.history.at(-1).evidenceOrder, evidenceIds);
    return flow.resolutionBranchId;
  };

  const forward = execute(ordered);
  const reversed = execute([...ordered].reverse());
  assert.notEqual(forward, reversed);
  assert.match(forward, /assassin_contract_chain/u);
  assert.match(forward, /contract-first-double-agent/u);
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

test("T12 offers 262,440 deterministic route shapes across arsenal, disguise, command, absence and war preparation", () => {
  const missionPack = pack("T12");
  assert.ok(missionPack);
  assert.equal(missionPack.persistResolutionBranch, true);
  assert.deepEqual(missionPack.branching, {
    openingChoices: 3,
    evidenceDimensions: 5,
    alternativesPerDimension: 3,
    evidenceProfiles: 243,
    orderingPermutationsPerProfile: 120,
    topLevelResolutions: 3,
    minimumRouteShapesAfterOpening: 87480,
    minimumRouteShapesBeforePriorState: 262440,
    evidenceOrderChangesContext: true,
    persistentBranchSignature: true,
    note: "三つの導入、五分類それぞれ三つの代替証拠、取得順、介入日、T09/T11/T13/T14、三解決を組み合わせる。",
  });
  assert.equal(
    missionPack.branching.openingChoices
      * missionPack.branching.evidenceProfiles
      * missionPack.branching.orderingPermutationsPerProfile
      * missionPack.branching.topLevelResolutions,
    missionPack.branching.minimumRouteShapesBeforePriorState,
  );
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(missionPack.investigation.requiredEvidenceGroups.length, 5);
  assert.equal(missionPack.investigation.leads.length, 15);
  assert.deepEqual(missionPack.catalogOverride.battle.timelineVariants.map((variant) => [
    variant.minDay,
    variant.maxDay ?? null,
    variant.troubleId ?? null,
    variant.troubleStatuses ?? null,
    variant.targetFacilityId,
    variant.actionType,
    variant.encounterId ?? null,
  ]), [
    [30, 38, null, null, "LOC_FORT_SUPPLY", "investigate", null],
    [39, 45, null, null, "LOC_FORT_WALL", "missionBattle", "ENC-0055"],
    [46, 55, null, null, "LOC_FORT_GATE", "missionBattle", "ENC-0055"],
    [56, 67, "T14", ["critical", "failed"], "LOC_FORT_WALL", "missionBattle", "ENC-0056"],
    [56, 67, null, null, "LOC_FORT_COMMAND", "investigate", null],
  ]);
  assert.deepEqual(missionPack.resolution.choices.map((route) => route.id), [
    "internal_court_martial_and_command_reform",
    "joint_border_inquiry_and_nonaggression_line",
    "reverse_false_flag_and_capture_smuggling_network",
  ]);
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.contextVariants.length >= 6
    && route.worldEffect.aftermathPlans.length >= 3
    && route.worldEffect.followups.length >= 3
    && route.summaryByTroubleStatus?.critical
    && route.narrativeByTroubleStatus?.critical
    && route.worldEffect.factIdByTroubleStatus?.critical
    && route.worldEffect.textByTroubleStatus?.critical));
});

test("all 243 T12 evidence profiles satisfy the five independent false-flag truth classes", () => {
  const missionPack = pack("T12");
  const groups = missionPack.investigation.requiredEvidenceGroups;
  const profiles = groups.reduce(
    (rows, group) => rows.flatMap((row) => group.map((evidenceId) => [...row, evidenceId])),
    [[]],
  );
  assert.equal(profiles.length, 243);
  assert.equal(new Set(profiles.map((profile) => profile.join("|"))).size, 243);

  for (const selectedEvidence of profiles) {
    const mission = {
      id: "MSN-T12",
      steps: [
        { id: "hear", type: "conversation", required: 1 },
        { id: "investigate", type: "investigate", required: 5 },
        { id: "battle", type: "battle", required: 1 },
        { id: "resolve", type: "resolve", required: 1 },
      ],
    };
    const catalog = { special: [mission], byId: new Map([[mission.id, mission]]) };
    applyAuthoredMissionFlowCatalogOverrides(catalog);
    const runtime = {
      playerState: {
        catalog,
        missions: {
          "MSN-T12": {
            status: "active",
            progress: { hear: 1, investigate: 0, battle: 0, resolve: 0 },
            discoveries: selectedEvidence.map((id) => ({ id })),
          },
        },
      },
    };
    const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
    assert.deepEqual(new Set(flow.evidenceIds), new Set(selectedEvidence));
    assert.equal(runtime.playerState.missions["MSN-T12"].progress.investigate, 5);
  }
});

test("T12 resolution contexts react to prior troubles, prior routes, exact evidence and acquisition order", () => {
  const missionPack = pack("T12");
  const [internal, joint, reverse] = missionPack.resolution.choices;
  const runtimeFor = ({ openingChoiceId, evidenceIds, worldFlags = {}, troubles = {} }) => ({
    authoredMissionFlows: {
      [missionPack.id]: { openingChoiceId, evidenceIds },
    },
    playerState: {
      worldFlags,
      troubles,
      missions: {
        "MSN-T12": { discoveries: evidenceIds.map((id) => ({ id })) },
      },
    },
  });

  const rebuiltArsenal = runtimeFor({
    openingChoiceId: "arsenal_and_supply_chain",
    evidenceIds: [
      "T12-EVIDENCE-DWARF-MAKER-MARK-MISMATCH",
      "T12-EVIDENCE-HENRIK-SUPPLY-LEDGER",
      "T12-EVIDENCE-FALSE-BLACKRIDGE-WEAPON-KIT",
      "T12-EVIDENCE-MAGNUS-SEALED-ORDER",
      "T12-EVIDENCE-YURI-NO-CROSSING-TRACE",
      "T12-EVIDENCE-ROSALIND-MOBILIZATION-DRAFT",
    ],
    worldFlags: { t09ResolutionRoute: "rebuild_deep_mine_and_rescue_corps" },
  });
  assert.equal(resolveAuthoredResolutionChoice(rebuiltArsenal, internal).contextId, "t09-rebuilt-maker-mark-audit");
  assert.equal(resolveAuthoredResolutionChoice(rebuiltArsenal, internal).minutes, 68);

  const secureCommand = runtimeFor({
    openingChoiceId: "soldiers_orders_and_wounds",
    evidenceIds: [
      "T12-EVIDENCE-MAGNUS-SEALED-ORDER",
      "T12-EVIDENCE-HENRIK-SUPPLY-LEDGER",
      "T12-EVIDENCE-FALSE-BLACKRIDGE-WEAPON-KIT",
      "T12-EVIDENCE-YURI-NO-CROSSING-TRACE",
      "T12-EVIDENCE-ROSALIND-MOBILIZATION-DRAFT",
    ],
    worldFlags: { t11ResolutionRoute: "silent_counterplot_and_protect_king" },
  });
  assert.equal(resolveAuthoredResolutionChoice(secureCommand, internal).contextId, "t11-silent-secure-command-chain");
  assert.equal(resolveAuthoredResolutionChoice(secureCommand, internal).minutes, 64);

  const waterCleared = runtimeFor({
    openingChoiceId: "border_absence_and_war_motive",
    evidenceIds: [
      "T12-EVIDENCE-YURI-NO-CROSSING-TRACE",
      "T12-EVIDENCE-HENRIK-SUPPLY-LEDGER",
      "T12-EVIDENCE-FORGED-BLACKRIDGE-PASS",
      "T12-EVIDENCE-KAI-CONSCRIPT-TESTIMONY",
      "T12-EVIDENCE-ROSALIND-MOBILIZATION-DRAFT",
    ],
    troubles: { T13: { status: "resolved" } },
  });
  assert.equal(resolveAuthoredResolutionChoice(waterCleared, joint).contextId, "t13-water-misunderstanding-cleared");
  assert.equal(resolveAuthoredResolutionChoice(waterCleared, joint).minutes, 70);

  const publicCover = runtimeFor({
    openingChoiceId: "border_absence_and_war_motive",
    evidenceIds: [
      "T12-EVIDENCE-ROSALIND-MOBILIZATION-DRAFT",
      "T12-EVIDENCE-HENRIK-SUPPLY-LEDGER",
      "T12-EVIDENCE-FORGED-BLACKRIDGE-PASS",
      "T12-EVIDENCE-KAI-CONSCRIPT-TESTIMONY",
      "T12-EVIDENCE-YURI-NO-CROSSING-TRACE",
    ],
    worldFlags: { t11ResolutionRoute: "public_conspiracy_inquiry_and_guard_reform" },
  });
  assert.equal(resolveAuthoredResolutionChoice(publicCover, joint).contextId, "t11-public-inquiry-diplomatic-cover");
  assert.equal(resolveAuthoredResolutionChoice(publicCover, joint).minutes, 78);

  const portWatch = runtimeFor({
    openingChoiceId: "arsenal_and_supply_chain",
    evidenceIds: [
      "T12-EVIDENCE-MAGNUS-VARO-PURCHASE",
      "T12-EVIDENCE-HENRIK-SUPPLY-LEDGER",
      "T12-EVIDENCE-FALSE-BLACKRIDGE-WEAPON-KIT",
      "T12-EVIDENCE-KAI-CONSCRIPT-TESTIMONY",
      "T12-EVIDENCE-YURI-NO-CROSSING-TRACE",
    ],
    worldFlags: { t06ResolutionRoute: "worker_cooperative_and_smuggling_watch" },
  });
  assert.equal(resolveAuthoredResolutionChoice(portWatch, reverse).contextId, "t06-cooperative-smuggling-watch");
  assert.equal(resolveAuthoredResolutionChoice(portWatch, reverse).minutes, 72);

  const assassinMethod = runtimeFor({
    openingChoiceId: "soldiers_orders_and_wounds",
    evidenceIds: [
      "T12-EVIDENCE-KAI-CONSCRIPT-TESTIMONY",
      "T12-EVIDENCE-MAGNUS-VARO-PURCHASE",
      "T12-EVIDENCE-HENRIK-SUPPLY-LEDGER",
      "T12-EVIDENCE-FALSE-BLACKRIDGE-WEAPON-KIT",
      "T12-EVIDENCE-YURI-NO-CROSSING-TRACE",
    ],
    worldFlags: { t11ResolutionRoute: "turn_assassin_and_trace_network" },
  });
  assert.equal(resolveAuthoredResolutionChoice(assassinMethod, reverse).contextId, "t11-assassin-network-method");
  assert.equal(resolveAuthoredResolutionChoice(assassinMethod, reverse).minutes, 76);

  const armed = runtimeFor({
    openingChoiceId: "border_absence_and_war_motive",
    evidenceIds: [
      "T12-EVIDENCE-YURI-NO-CROSSING-TRACE",
      "T12-EVIDENCE-HENRIK-SUPPLY-LEDGER",
      "T12-EVIDENCE-FORGED-BLACKRIDGE-PASS",
      "T12-EVIDENCE-KAI-CONSCRIPT-TESTIMONY",
      "T12-EVIDENCE-ROSALIND-MOBILIZATION-DRAFT",
    ],
    troubles: { T14: { status: "failed" }, T13: { status: "resolved" } },
  });
  assert.equal(resolveAuthoredResolutionChoice(armed, joint).contextId, "t14-armed-emergency-border-truce");
  assert.equal(resolveAuthoredResolutionChoice(armed, joint).minutes, 154);
});

test("T12 persists a different branch signature when the same five truths are collected in a different order", () => {
  const missionPack = pack("T12");
  const mission = {
    id: "MSN-T12",
    steps: [
      { id: "hear", type: "conversation", required: 1 },
      { id: "investigate", type: "investigate", required: 5 },
      { id: "battle", type: "battle", required: 1 },
      { id: "resolve", type: "resolve", required: 1 },
    ],
  };
  const ordered = [
    "T12-EVIDENCE-KAI-CONSCRIPT-TESTIMONY",
    "T12-EVIDENCE-HENRIK-SUPPLY-LEDGER",
    "T12-EVIDENCE-FALSE-BLACKRIDGE-WEAPON-KIT",
    "T12-EVIDENCE-YURI-NO-CROSSING-TRACE",
    "T12-EVIDENCE-MAGNUS-VARO-PURCHASE",
  ];
  const execute = (evidenceIds) => {
    const catalogMission = { ...mission, steps: mission.steps.map((step) => ({ ...step })) };
    const catalog = { special: [catalogMission], byId: new Map([[catalogMission.id, catalogMission]]) };
    applyAuthoredMissionFlowCatalogOverrides(catalog);
    const runtime = {
      playerState: {
        absoluteMinute: 60 * 1440,
        catalog,
        worldFlags: {},
        troubles: { T12: { status: "active" } },
        player: { location: "北陵要塞", facilityId: "LOC_FORT_COMMAND" },
        history: [],
        missions: {
          "MSN-T12": {
            status: "active",
            progress: { hear: 1, investigate: 5, battle: 1, resolve: 0 },
            discoveries: evidenceIds.map((id) => ({ id })),
          },
        },
      },
    };
    const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
    flow.openingChoiceId = "soldiers_orders_and_wounds";
    flow.evidenceIds = [...evidenceIds];
    const result = { ok: true };
    assert.equal(applyAuthoredMissionFlowAction(runtime, {
      authoredMissionFlowId: missionPack.id,
      authoredMissionFlowKind: "resolution",
      authoredMissionFlowResolutionRouteId: "reverse_false_flag_and_capture_smuggling_network",
      authoredMissionFlowResolutionContextVariantId: "command-first-kai-reversal",
      authoredMissionFlowTroubleStatus: "active",
    }, result), true);
    assert.equal(runtime.playerState.worldFlags.t12ResolutionRoute, "reverse_false_flag_and_capture_smuggling_network");
    assert.equal(runtime.playerState.worldFlags.t12ResolutionContext, "command-first-kai-reversal");
    assert.equal(flow.resolutionBranchId, runtime.playerState.worldFlags.t12ResolutionBranch);
    assert.deepEqual(runtime.playerState.history.at(-1).evidenceOrder, evidenceIds);
    return flow.resolutionBranchId;
  };

  const forward = execute(ordered);
  const reversed = execute([...ordered].reverse());
  assert.notEqual(forward, reversed);
  assert.match(forward, /soldiers_orders_and_wounds/u);
  assert.match(forward, /command-first-kai-reversal/u);
});

test("T13 offers 4,723,920 deterministic route shapes across growth, separation, seals, innocence, survival and restoration", () => {
  const missionPack = pack("T13");
  assert.ok(missionPack);
  assert.equal(missionPack.persistResolutionBranch, true);
  assert.deepEqual(missionPack.branching, {
    openingChoices: 3,
    evidenceDimensions: 6,
    alternativesPerDimension: 3,
    evidenceProfiles: 729,
    orderingPermutationsPerProfile: 720,
    topLevelResolutions: 3,
    minimumRouteShapesAfterOpening: 1574640,
    minimumRouteShapesBeforePriorState: 4723920,
    evidenceOrderChangesContext: true,
    persistentBranchSignature: true,
    note: "三つの導入、六分類それぞれ三つの代替証拠、取得順、介入日、T07/T08/T09/T12、三解決を組み合わせる。",
  });
  assert.equal(
    missionPack.branching.openingChoices
      * missionPack.branching.evidenceProfiles
      * missionPack.branching.orderingPermutationsPerProfile
      * missionPack.branching.topLevelResolutions,
    missionPack.branching.minimumRouteShapesBeforePriorState,
  );
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(missionPack.investigation.requiredEvidenceGroups.length, 6);
  assert.equal(missionPack.investigation.leads.length, 18);
  assert.deepEqual(missionPack.catalogOverride.battle.timelineVariants.map((variant) => [
    variant.minDay,
    variant.maxDay ?? null,
    variant.targetFacilityId,
    variant.actionType,
    variant.encounterId ?? null,
  ]), [
    [1, 17, "LOC_FOREST_RIVER", "missionBattle", "ENC-0015"],
    [18, 31, "LOC_FOREST_RIVER", "missionBattle", "ENC-0016"],
    [32, 44, "LOC_FOREST_RIVER", "missionBattle", "ENC-0016"],
    [45, 57, "LOC_FOREST_RIVER", "missionBattle", "ENC-0017"],
    [58, 60, "LOC_ELF_WORLD_TREE", "missionBattle", "ENC-0018"],
  ]);
  assert.deepEqual(missionPack.resolution.choices.map((route) => route.id), [
    "sever_core_restore_river_and_seal",
    "spirit_bind_disperse_and_reseed_world_tree",
    "joint_watershed_compact_and_living_containment",
  ]);
  assert.ok(missionPack.resolution.choices.every((route) =>
    route.contextVariants.length >= 7
    && route.worldEffect.aftermathPlans.length >= 3
    && route.worldEffect.followups.length >= 3
    && route.summaryByTroubleStatus?.critical
    && route.narrativeByTroubleStatus?.critical
    && route.worldEffect.factIdByTroubleStatus?.critical
    && route.worldEffect.textByTroubleStatus?.critical));
});

test("all 729 T13 evidence profiles satisfy the six independent ecosystem and diplomacy truth classes", () => {
  const missionPack = pack("T13");
  const groups = missionPack.investigation.requiredEvidenceGroups;
  const profiles = groups.reduce(
    (rows, group) => rows.flatMap((row) => group.map((evidenceId) => [...row, evidenceId])),
    [[]],
  );
  assert.equal(profiles.length, 729);
  assert.equal(new Set(profiles.map((profile) => profile.join("|"))).size, 729);

  for (const selectedEvidence of profiles) {
    const mission = {
      id: "MSN-T13",
      steps: [
        { id: "hear", type: "conversation", required: 1 },
        { id: "investigate", type: "investigate", required: 6 },
        { id: "battle", type: "battle", required: 1 },
        { id: "resolve", type: "resolve", required: 1 },
      ],
    };
    const catalog = { special: [mission], byId: new Map([[mission.id, mission]]) };
    applyAuthoredMissionFlowCatalogOverrides(catalog);
    const runtime = {
      playerState: {
        catalog,
        missions: {
          "MSN-T13": {
            status: "active",
            progress: { hear: 1, investigate: 0, battle: 0, resolve: 0 },
            discoveries: selectedEvidence.map((id) => ({ id })),
          },
        },
      },
    };
    const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
    assert.deepEqual(new Set(flow.evidenceIds), new Set(selectedEvidence));
    assert.equal(runtime.playerState.missions["MSN-T13"].progress.investigate, 6);
  }
});

test("T13 resolution contexts react to forest access, rescue engineering, border trust, exact evidence and acquisition order", () => {
  const missionPack = pack("T13");
  const [sever, spirit, watershed] = missionPack.resolution.choices;
  const runtimeFor = ({ openingChoiceId, evidenceIds, worldFlags = {}, troubles = {} }) => ({
    authoredMissionFlows: {
      [missionPack.id]: { openingChoiceId, evidenceIds },
    },
    playerState: {
      worldFlags,
      troubles,
      missions: {
        "MSN-T13": { discoveries: evidenceIds.map((id) => ({ id })) },
      },
    },
  });

  const rescueTeam = runtimeFor({
    openingChoiceId: "river_growth_and_separation",
    evidenceIds: [
      "T13-EVIDENCE-MINA-ANCHOR-PUMP-DESIGN",
      "T13-EVIDENCE-SERIE-SHADOW-CHRONOLOGY",
      "T13-EVIDENCE-MELKIA-BARRIER-SEAL-COUPLING",
      "T13-EVIDENCE-YURI-NO-DAM-TRACE",
      "T13-EVIDENCE-EDA-WELL-RATION-PLAN",
      "T13-EVIDENCE-MINA-SLIME-CORE-CONTAINMENT",
    ],
    worldFlags: { t09ResolutionRoute: "rebuild_deep_mine_and_rescue_corps" },
  });
  assert.equal(resolveAuthoredResolutionChoice(rescueTeam, sever).contextId, "t09-rescue-corps-anchor-team");
  assert.equal(resolveAuthoredResolutionChoice(rescueTeam, sever).minutes, 62);

  const corridorRitual = runtimeFor({
    openingChoiceId: "world_tree_spirits_and_seal",
    evidenceIds: [
      "T13-EVIDENCE-ELINA-WORLD-TREE-PAIN-RHYTHM",
      "T13-EVIDENCE-ELINA-ROOT-DIVERSION-RITE",
      "T13-EVIDENCE-MELKIA-BARRIER-SEAL-COUPLING",
      "T13-EVIDENCE-NIEVE-BLACKRIDGE-FLOW-LOG",
      "T13-EVIDENCE-LUCIA-REFUGE-ROSTER",
      "T13-EVIDENCE-SYLFI-SPIRIT-POOL-RESTORATION",
    ],
    worldFlags: { t08ResolutionRoute: "joint_anomaly_expedition_corridor" },
  });
  assert.equal(resolveAuthoredResolutionChoice(corridorRitual, spirit).contextId, "t08-anomaly-corridor-spirit-team");
  assert.equal(resolveAuthoredResolutionChoice(corridorRitual, spirit).minutes, 82);

  const sharedWatershed = runtimeFor({
    openingChoiceId: "downstream_survival_and_blackridge_truth",
    evidenceIds: [
      "T13-EVIDENCE-NIEVE-FLOW-PULSE-MAP",
      "T13-EVIDENCE-NIEVE-DRY-CHANNEL-BYPASS",
      "T13-EVIDENCE-ALWEN-ANCIENT-SEAL-RECORD",
      "T13-EVIDENCE-NIEVE-BLACKRIDGE-FLOW-LOG",
      "T13-EVIDENCE-RIONA-WATER-CONVOY-ROUTE",
      "T13-EVIDENCE-NENE-RECOVERY-MARKERS",
      "T13-EVIDENCE-ZAID-WATER-RELEASE-RECORD",
    ],
    worldFlags: { t12ResolutionRoute: "joint_border_inquiry_and_nonaggression_line" },
  });
  assert.equal(resolveAuthoredResolutionChoice(sharedWatershed, watershed).contextId, "t12-joint-border-watershed-line");
  assert.equal(resolveAuthoredResolutionChoice(sharedWatershed, watershed).minutes, 88);

  const lateRoot = runtimeFor({
    openingChoiceId: "river_growth_and_separation",
    evidenceIds: [
      "T13-EVIDENCE-SERIE-SHADOW-CHRONOLOGY",
      "T13-EVIDENCE-MINA-ANCHOR-PUMP-DESIGN",
      "T13-EVIDENCE-ELINA-WORLD-TREE-PAIN-RHYTHM",
      "T13-EVIDENCE-YURI-NO-DAM-TRACE",
      "T13-EVIDENCE-LUCIA-REFUGE-ROSTER",
      "T13-EVIDENCE-MINA-SLIME-CORE-CONTAINMENT",
    ],
    troubles: { T13: { status: "critical" } },
  });
  assert.equal(resolveAuthoredResolutionChoice(lateRoot, sever).contextId, "critical-world-tree-root-operation");
  assert.equal(resolveAuthoredResolutionChoice(lateRoot, sever).minutes, 168);

  const sealFirst = runtimeFor({
    openingChoiceId: "world_tree_spirits_and_seal",
    evidenceIds: [
      "T13-EVIDENCE-MELKIA-BARRIER-SEAL-COUPLING",
      "T13-EVIDENCE-ELINA-ROOT-DIVERSION-RITE",
      "T13-EVIDENCE-ALWEN-ANCIENT-SEAL-RECORD",
      "T13-EVIDENCE-YURI-NO-DAM-TRACE",
      "T13-EVIDENCE-LUCIA-REFUGE-ROSTER",
      "T13-EVIDENCE-SYLFI-SPIRIT-POOL-RESTORATION",
    ],
  });
  assert.equal(resolveAuthoredResolutionChoice(sealFirst, spirit).contextId, "world-tree-first-three-voices");
  assert.equal(resolveAuthoredResolutionChoice(sealFirst, spirit).minutes, 96);
});

test("T13 persists a different branch signature when the same six evidence classes are collected in a different order", () => {
  const missionPack = pack("T13");
  const mission = {
    id: "MSN-T13",
    steps: [
      { id: "hear", type: "conversation", required: 1 },
      { id: "investigate", type: "investigate", required: 6 },
      { id: "battle", type: "battle", required: 1 },
      { id: "resolve", type: "resolve", required: 1 },
    ],
  };
  const ordered = [
    "T13-EVIDENCE-SERIE-SHADOW-CHRONOLOGY",
    "T13-EVIDENCE-NIEVE-DRY-CHANNEL-BYPASS",
    "T13-EVIDENCE-ELINA-WORLD-TREE-PAIN-RHYTHM",
    "T13-EVIDENCE-YURI-NO-DAM-TRACE",
    "T13-EVIDENCE-LUCIA-REFUGE-ROSTER",
    "T13-EVIDENCE-MINA-SLIME-CORE-CONTAINMENT",
  ];
  const execute = (evidenceIds) => {
    const catalogMission = { ...mission, steps: mission.steps.map((step) => ({ ...step })) };
    const catalog = { special: [catalogMission], byId: new Map([[catalogMission.id, catalogMission]]) };
    applyAuthoredMissionFlowCatalogOverrides(catalog);
    const runtime = {
      playerState: {
        absoluteMinute: 45 * 1440,
        catalog,
        worldFlags: {},
        troubles: { T13: { status: "active" } },
        player: { location: "森", facilityId: "LOC_FOREST_RIVER" },
        history: [],
        missions: {
          "MSN-T13": {
            status: "active",
            progress: { hear: 1, investigate: 6, battle: 1, resolve: 0 },
            discoveries: evidenceIds.map((id) => ({ id })),
          },
        },
      },
    };
    const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
    flow.openingChoiceId = "river_growth_and_separation";
    flow.evidenceIds = [...evidenceIds];
    const result = { ok: true };
    assert.equal(applyAuthoredMissionFlowAction(runtime, {
      authoredMissionFlowId: missionPack.id,
      authoredMissionFlowKind: "resolution",
      authoredMissionFlowResolutionRouteId: "sever_core_restore_river_and_seal",
      authoredMissionFlowResolutionContextVariantId: "dry-channel-core-catch",
      authoredMissionFlowTroubleStatus: "active",
    }, result), true);
    assert.equal(runtime.playerState.worldFlags.t13ResolutionRoute, "sever_core_restore_river_and_seal");
    assert.equal(runtime.playerState.worldFlags.t13ResolutionContext, "dry-channel-core-catch");
    assert.equal(flow.selectedResolutionContextId, "dry-channel-core-catch");
    assert.equal(flow.resolutionBranchId, runtime.playerState.worldFlags.t13ResolutionBranch);
    assert.deepEqual(runtime.playerState.history.at(-1).evidenceOrder, evidenceIds);
    return flow.resolutionBranchId;
  };

  const forward = execute(ordered);
  const reversed = execute([...ordered].reverse());
  assert.notEqual(forward, reversed);
  assert.match(forward, /river_growth_and_separation/u);
  assert.match(forward, /dry-channel-core-catch/u);
});
