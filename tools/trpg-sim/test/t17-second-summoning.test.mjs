import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGameRuntimeActions,
  createGameRuntime,
  executeGameRuntimeCommand,
  resolveReviewedAuthoredPresentation,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";
import { deserializeRuntime, serializeRuntime } from "../../../src/server/trpg/game/serializer.js";
import { clockFromMinute } from "../lib/player-journey.mjs";

const T17_RUMOR_ID = "TEST-T17-SECOND-SUMMONING";
const LOWER_INN_ID = "LOC_CAP_LOWER_INN";
const MAGE_TOWER_ID = "LOC_CAP_MAGE_TOWER";
const CASTLE_ID = "LOC_CAP_CASTLE";

function prepareT17Runtime(seed = "t17-authored-branch") {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed,
    profileId: "balanced",
    playerName: "召喚の旅人",
    tutorial: false,
  });
  const state = runtime.playerState;
  const startMinute = 9 * 1440;
  state.absoluteMinute = startMinute;
  Object.assign(state, clockFromMinute(startMinute));
  state.tuning.probeMode = true;
  state.tuning.disableTravelEncounters = true;
  state.player.location = "王都";
  state.player.facilityId = LOWER_INN_ID;
  state.progress.travel.visitedHubs.add("王都");
  state.progress.travel.visitedFacilities.add(LOWER_INN_ID);
  state.progress.facilities.visitedIds.add(LOWER_INN_ID);
  runtime.playerKnowledge.knownHubIds.add("王都");
  [LOWER_INN_ID, MAGE_TOWER_ID, CASTLE_ID].forEach((id) => runtime.playerKnowledge.knownFacilityIds.add(id));

  state.troubles.T17.status = "active";
  const mission = state.missions["MSN-T17"];
  mission.status = "active";
  mission.progress.hear = 0;
  mission.progress.investigate = 0;
  if ("battle" in mission.progress) mission.progress.battle = 0;
  mission.progress.resolve = 0;
  mission.discoveries = [];

  const rumor = {
    id: T17_RUMOR_ID,
    troubleId: "T17",
    text: "王都で第二召喚の準備が進んでいる",
    origin: "王都",
    originMinute: startMinute,
    importance: 1,
    recipients: {},
  };
  state.rumors.push(rumor);
  state.rumorById[rumor.id] = rumor;
  state.player.knownRumorIds.add(rumor.id);

  const layla = runtime.livingWorld.npcStates.NPC018;
  Object.assign(layla, {
    lifeStatus: "alive",
    presence: "present",
    location: "王都",
    position: { hubId: "王都", facilityId: LOWER_INN_ID },
    travel: null,
    localTravel: null,
    status: "安宿で接触相手を待っている",
    currentGoal: "warn-player-about-second-summoning",
  });
  runtime.lastWorldTickMinute = startMinute;
  return { game, runtime };
}

function choices(runtime, game) {
  return availableGameRuntimeActions(runtime, game.data).choices;
}

function choose(runtime, game, actionId) {
  const action = choices(runtime, game).find((entry) => entry.id === actionId);
  assert.ok(action, `${actionId} must be available`);
  return executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: action.choiceId },
  });
}

function acknowledgeIntroduction(runtime, game, result) {
  const token = result.resolvedAction?.introductionToken;
  if (!token) return;
  executeGameRuntimeCommand(runtime, game.data, {
    type: "ACK_NPC_INTRODUCTION",
    payload: { token },
  });
}

test("T17 opens with three authored questions that each complete only the first conversation step", () => {
  const openingIds = [
    "T17:OPENING:WHEN_WHERE",
    "T17:OPENING:WHY_ME",
    "T17:OPENING:PROOF",
  ];
  for (const openingId of openingIds) {
    const { game, runtime } = prepareT17Runtime(`t17-opening-${openingId}`);
    const available = choices(runtime, game);
    assert.deepEqual(available.map((entry) => entry.id), openingIds);
    assert.equal(new Set(available.map((entry) => entry.dialogueTopic)).size, 3);
    assert.ok(available.every((entry) =>
      entry.type === "conversation"
      && entry.targetNpcId === "NPC018"
      && entry.missionId === "MSN-T17"
      && entry.stepId === "hear"
      && entry.deferMissionConversationCompletion === true));

    const result = choose(runtime, game, openingId);
    assert.equal(result.outcome.ok, true);
    assert.equal(runtime.playerState.missions["MSN-T17"].progress.hear, 1);
    assert.equal(runtime.playerState.missions["MSN-T17"].progress.investigate, 0);
    assert.equal(runtime.t17SecondSummoning.openingChoiceId, openingId);
    assert.equal(runtime.dialogueSession, null, "the authored opening is one complete exchange");
    const presentation = resolveReviewedAuthoredPresentation(runtime, game.data, result, result.outcome);
    assert.match(presentation?.sceneId ?? "", /^t17\.opening\./u);
    assert.ok(presentation?.speeches.some((speech) => speech.actorId === "NPC018"));
    assert.equal(runtime.playerState.troubles.T17.status, "active");
  }
});

test("T17 branches from Layla to independent evidence routes and requires two different records", () => {
  const { game, runtime } = prepareT17Runtime();
  const opening = choose(runtime, game, "T17:OPENING:PROOF");
  acknowledgeIntroduction(runtime, game, opening);

  assert.deepEqual(choices(runtime, game).map((entry) => entry.id), [
    "T17:LEAD:LUCA_DOCUMENTS",
    "T17:LEAD:MAGE_DELIVERIES",
    "T17:LEAD:CASTLE_REQUISITION",
  ]);

  const lucaLead = choose(runtime, game, "T17:LEAD:LUCA_DOCUMENTS");
  assert.equal(runtime.playerState.player.facilityId, LOWER_INN_ID);
  assert.equal(runtime.t17SecondSummoning.selectedLeadId, "luca_documents");
  assert.equal(resolveReviewedAuthoredPresentation(runtime, game.data, lucaLead, lucaLead.outcome)?.sceneId,
    "t17.lead.luca_documents");

  const lucaEvidence = choose(runtime, game, "T17:EVIDENCE:LUCA_DOCUMENTS");
  assert.equal(lucaEvidence.outcome.discovery.id, "T17-EVIDENCE-LUCA-COPIED-DIAGRAM");
  assert.equal(runtime.playerState.missions["MSN-T17"].progress.investigate, 1);
  assert.equal(runtime.t17SecondSummoning.selectedLeadId, null);
  assert.deepEqual(runtime.t17SecondSummoning.evidenceIds, ["T17-EVIDENCE-LUCA-COPIED-DIAGRAM"]);
  assert.equal(resolveReviewedAuthoredPresentation(runtime, game.data, lucaEvidence, lucaEvidence.outcome)?.sceneId,
    "t17.evidence.luca_documents");

  assert.deepEqual(choices(runtime, game).map((entry) => entry.id), [
    "T17:LEAD:MAGE_DELIVERIES",
    "T17:LEAD:CASTLE_REQUISITION",
    "T17:PETITION:ONE_SOURCE",
  ]);

  const rejected = choose(runtime, game, "T17:PETITION:ONE_SOURCE");
  assert.equal(runtime.t17SecondSummoning.prematurePetitionCount, 1);
  assert.match(rejected.outcome.summary, /一系統|別の場所/u);
  assert.equal(resolveReviewedAuthoredPresentation(runtime, game.data, rejected, rejected.outcome)?.sceneId,
    "t17.petition.one_source_rejected");
  assert.deepEqual(choices(runtime, game).map((entry) => entry.id), [
    "T17:LEAD:MAGE_DELIVERIES",
    "T17:LEAD:CASTLE_REQUISITION",
    "T17:PETITION:ONE_SOURCE",
  ]);

  const mageLead = choose(runtime, game, "T17:LEAD:MAGE_DELIVERIES");
  assert.equal(runtime.playerState.player.facilityId, MAGE_TOWER_ID);
  assert.equal(runtime.t17SecondSummoning.selectedLeadId, "mage_deliveries");
  assert.equal(mageLead.resolvedAction.movementScope, "local");
  assert.equal(resolveReviewedAuthoredPresentation(runtime, game.data, mageLead, mageLead.outcome)?.sceneId,
    "t17.lead.mage_deliveries");

  const mageEvidence = choose(runtime, game, "T17:EVIDENCE:MAGE_DELIVERIES");
  assert.equal(mageEvidence.outcome.discovery.id, "T17-EVIDENCE-MAGE-DELIVERIES");
  assert.equal(runtime.playerState.missions["MSN-T17"].progress.investigate, 2);
  assert.deepEqual(new Set(runtime.t17SecondSummoning.evidenceIds), new Set([
    "T17-EVIDENCE-LUCA-COPIED-DIAGRAM",
    "T17-EVIDENCE-MAGE-DELIVERIES",
  ]));
  assert.equal(resolveReviewedAuthoredPresentation(runtime, game.data, mageEvidence, mageEvidence.outcome)?.sceneId,
    "t17.evidence.mage_deliveries");

  const nextStep = runtime.playerState.catalog.byId.get("MSN-T17").steps
    .find((step) => Number(runtime.playerState.missions["MSN-T17"].progress[step.id] ?? 0) < Number(step.required ?? 1));
  assert.notEqual(nextStep?.id, "investigate");
  assert.equal(choices(runtime, game).some((entry) => entry.missionId === "MSN-T17"), false,
    "the unreviewed confrontation must not leak through the generic mission action");
  assert.equal(runtime.playerState.troubles.T17.status, "active");

  const restored = deserializeRuntime(serializeRuntime(runtime), game.data);
  assert.deepEqual(restored.t17SecondSummoning, runtime.t17SecondSummoning);
  assert.equal(restored.playerState.missions["MSN-T17"].progress.investigate, 2);
});

test("T17 uses authoritative local movement for both the mage tower and the castle lead", () => {
  for (const [leadId, expectedFacilityId] of [
    ["T17:LEAD:MAGE_DELIVERIES", MAGE_TOWER_ID],
    ["T17:LEAD:CASTLE_REQUISITION", CASTLE_ID],
  ]) {
    const { game, runtime } = prepareT17Runtime(`t17-move-${leadId}`);
    const opening = choose(runtime, game, "T17:OPENING:WHEN_WHERE");
    acknowledgeIntroduction(runtime, game, opening);
    const action = choices(runtime, game).find((entry) => entry.id === leadId);
    assert.ok(action);
    assert.equal(action.type, "move");
    assert.equal(action.movementScope, "local");
    assert.equal(action.destinationFacilityId, expectedFacilityId);
    const result = choose(runtime, game, leadId);
    assert.equal(result.outcome.ok, true);
    assert.equal(runtime.playerState.player.facilityId, expectedFacilityId);
    assert.ok(runtime.playerState.history.some((entry) =>
      entry.type === "LOCAL_MOVE_COMPLETED" && entry.toFacilityId === expectedFacilityId));
  }
});
