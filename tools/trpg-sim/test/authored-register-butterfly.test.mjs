import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  synchronizeRegisterButterfly,
  AUTHORED_REGISTER_BUTTERFLY_INTERNALS as butterfly,
} from "../../../src/server/trpg/content/authored-register-butterfly.js";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import { cloneSerializable, deserializeRuntime, serializeRuntime } from "../../../src/server/trpg/game/serializer.js";
import {
  completeNpcLifeTick,
  createNpcLifeEngine,
  prepareNpcLifeTick,
} from "../lib/npc-life-engine.mjs";

const data = loadTrpgGameData();

function npc(facilityId) {
  return {
    id: "fixture",
    location: "田園の村",
    facilityId,
    lifeStatus: "alive",
    presence: "present",
    position: { hubId: "田園の村", facilityId },
    beliefs: {},
    memories: {},
    knowledgeRevision: 0,
    currentGoal: "follow-routine",
    goalSince: 0,
    completedAftermathPlanIds: [],
    localTravel: null,
  };
}

function runtime({
  lodging = "borrowed_registered",
  finnReturned = false,
  minute = 700,
  rona = true,
  riona = true,
  rionaFacilityId = "LOC_FARM_INN",
} = {}) {
  const npcStates = {};
  if (rona) npcStates.NPC058 = { ...npc("LOC_FARM_INN"), id: "NPC058" };
  if (riona) npcStates.NPC008 = { ...npc(rionaFacilityId), id: "NPC008" };
  const state = {
    checkpointEPrologue: { complete: true, completedAtMinute: 700, loan: { disposition: lodging } },
    playerState: {
      absoluteMinute: minute,
      player: { id: "PLAYER-TEST", name: "旅人", location: "田園の村", facilityId: "LOC_FARM_SQUARE", knownRumorIds: new Set() },
      history: [], worldFlags: finnReturned ? { t01FinnReturned: true } : {}, rumors: [], rumorById: {}, goapRequests: {},
    },
    livingWorld: { npcStates, decisionEvents: [], localMovementEvents: [] },
  };
  if (finnReturned) state.playerState.history.push({ type: "T01_FINN_ESCORTED_TO_SQUARE", minute: 820, missionId: "MSN-T01", troubleId: "T01", npcId: "NPC001" });
  return state;
}

function canonicalLifeRuntime({ minute = 830 } = {}) {
  const npcStates = Object.fromEntries(data.model.npcs.map((entry) => [entry.id, { id: entry.id }]));
  const livingWorld = createNpcLifeEngine({
    model: data.model,
    seed: "register-butterfly-production-life",
    npcStates,
  });
  return {
    checkpointEPrologue: { complete: true, completedAtMinute: 700, loan: { disposition: "borrowed_registered" } },
    playerState: {
      absoluteMinute: minute,
      player: { id: "PLAYER-LIFE", name: "旅人", location: "田園の村", facilityId: "LOC_FARM_SQUARE", knownRumorIds: new Set() },
      history: [{ type: "T01_FINN_ESCORTED_TO_SQUARE", minute: 820, missionId: "MSN-T01", troubleId: "T01", npcId: "NPC001" }],
      worldFlags: { t01FinnReturned: true },
      rumors: [],
      rumorById: {},
      goapRequests: {},
    },
    livingWorld,
  };
}

function runLifeTick(state, tickIndex) {
  const day = Math.floor(tickIndex / 4) + 1;
  const phaseIndex = tickIndex % 4;
  const absoluteHour = (day - 1) * 24 + phaseIndex * 6;
  const time = { day, phaseIndex, absoluteHour };
  state.playerState.absoluteMinute = absoluteHour * 60;
  prepareNpcLifeTick(state.livingWorld, {
    time,
    troubleStates: { T01: { status: "resolved" } },
    worldFlags: state.playerState.worldFlags,
  });
  synchronizeRegisterButterfly(state);
  completeNpcLifeTick(state.livingWorld, {
    time,
    troubleStates: { T01: { status: "resolved" } },
    worldFlags: state.playerState.worldFlags,
  });
  synchronizeRegisterButterfly(state);
}

function advanceUntil(state, predicate, { startTick = 0, maxTicks = 24 } = {}) {
  for (let tick = startTick; tick < startTick + maxTicks; tick += 1) {
    runLifeTick(state, tick);
    if (predicate(state)) return tick + 1;
  }
  return startTick + maxTicks;
}

function directRionaShare(state) {
  return state.livingWorld.knowledgeEvents?.find((event) =>
    event.type === "share"
    && event.npcId === "NPC008"
    && event.sourceNpcId === "NPC058"
    && event.factId === butterfly.FACT_ID
    && event.location?.facilityId === "LOC_FARM_INN"
  ) ?? null;
}

test("REGISTER creates one persistent inn record with provenance while alternative lodging does not", () => {
  const registered = runtime();
  const output = synchronizeRegisterButterfly(registered);
  assert.ok(output.record);
  assert.equal(output.record.type, "inn-register");
  assert.equal(output.record.facilityId, "LOC_FARM_INN");
  assert.equal(output.record.sourceActionId, "E:LODGE:REGISTER");
  assert.equal(output.record.recordedAtMinute, 655);
  assert.equal(output.record.recordedDay, 1);
  assert.equal(output.record.provenance.lodgingChoice, "registered_stay");
  assert.equal(output.record.provenance.loanDisposition, "borrowed_registered");
  synchronizeRegisterButterfly(registered);
  assert.equal(Object.keys(registered.playerState.worldRecords).length, 1);
  assert.equal(registered.playerState.history.filter((entry) => entry.type === butterfly.REGISTER_HISTORY).length, 1);

  for (const lodging of ["borrowed_after_lodging", "borrowed_continued"]) {
    const alternative = runtime({ lodging, finnReturned: true });
    assert.equal(synchronizeRegisterButterfly(alternative).record, null);
    assert.deepEqual(alternative.playerState.worldRecords ?? {}, {});
    assert.equal(alternative.playerState.goapRequests[butterfly.GOAP_ID], undefined);
    assert.equal(alternative.livingWorld.npcStates.NPC058.beliefs[butterfly.FACT_ID], undefined);
    assert.equal(alternative.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID], undefined);
  }
});

test("REGISTER alone never predicts Finn rescue; actual return links the registered rescuer to Lorna first", () => {
  const beforeRescue = runtime();
  synchronizeRegisterButterfly(beforeRescue);
  assert.equal(beforeRescue.livingWorld.npcStates.NPC058.beliefs[butterfly.FACT_ID], undefined);
  assert.equal(beforeRescue.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID], undefined);

  const noRiona = runtime({ finnReturned: true, minute: 830, riona: false });
  synchronizeRegisterButterfly(noRiona);
  const record = butterfly.registerRecord(noRiona);
  const lorna = noRiona.livingWorld.npcStates.NPC058;
  assert.equal(lorna.beliefs[butterfly.FACT_ID].sourceRecordId, record.id);
  assert.equal(lorna.beliefs[butterfly.FACT_ID].sourceNpcId, "NPC058");
  assert.equal(lorna.memories[butterfly.FACT_ID].sourceRecordId, record.id);
  assert.equal(noRiona.livingWorld.npcStates.NPC008, undefined);
  assert.equal(noRiona.playerState.rumorById[butterfly.RUMOR_ID], undefined);
  assert.equal(noRiona.playerState.goapRequests[butterfly.GOAP_ID], undefined);
  assert.equal(noRiona.playerState.history.some((entry) => entry.type === butterfly.LINK_HISTORY), true);
  assert.equal(noRiona.playerState.history.some((entry) => entry.type === butterfly.PROPAGATION_HISTORY), false);
});

test("Lorna-to-Riona propagation is an actual common-world share with direct provenance before GOAP activation", () => {
  const state = canonicalLifeRuntime();
  synchronizeRegisterButterfly(state);
  const nextTick = advanceUntil(state, (current) => Boolean(current.playerState.goapRequests[butterfly.GOAP_ID]));
  assert.ok(nextTick <= 24);

  const record = butterfly.registerRecord(state);
  const share = directRionaShare(state);
  assert.ok(share, "Riona must hear the correlation from Lorna through the common interaction engine");
  const belief = state.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID];
  assert.equal(belief.sourceNpcId, "NPC058");
  assert.equal(belief.sourceRecordId, record.id);
  assert.deepEqual(belief.path, [`record:${record.id}`, "event:T01_FINN_ESCORTED_TO_SQUARE", "NPC058", "NPC008"]);
  assert.equal(belief.hopCount, 1);
  assert.equal(belief.kind, "trouble");
  assert.equal(belief.troubleStatus, "resolved");
  assert.equal(belief.aftermathPlans.length, 1);
  assert.equal(belief.aftermathPlans[0].id, butterfly.GOAP_ID);
  assert.equal(belief.aftermathPlans[0].reason, "merchant-rumor-credibility");

  const request = state.playerState.goapRequests[butterfly.GOAP_ID];
  assert.equal(request.executionAuthority, "npc-life-engine");
  assert.equal(request.plannerContract, "resolved-belief-aftermath-plan");
  assert.equal(request.preconditions.learnedFromNpcId, "NPC058");
  assert.equal(request.preconditions.sourceKnowledgeEventId, share.id);
});

test("npc-life planner, not the butterfly fixture, moves Riona and completes the merchant rumor GOAP", () => {
  const state = canonicalLifeRuntime();
  synchronizeRegisterButterfly(state);
  const riona = state.livingWorld.npcStates.NPC008;
  assert.equal(riona.completedAftermathPlanIds.includes(butterfly.GOAP_ID), false);

  advanceUntil(state, (current) => current.playerState.goapRequests[butterfly.GOAP_ID]?.status === "completed", { maxTicks: 24 });

  const request = state.playerState.goapRequests[butterfly.GOAP_ID];
  assert.ok(request, "Riona must first receive the fact during ordinary life ticks");
  assert.equal(request.status, "completed");
  assert.equal(request.completionReason, "npc-life-engine-aftermath-plan-completed");
  assert.equal(request.executionEvidence?.planner, "npc-life-engine");
  assert.equal(riona.completedAftermathPlanIds.includes(butterfly.GOAP_ID), true);
  assert.equal(butterfly.npcFacility(riona), "LOC_FARM_SQUARE");
  assert.ok(directRionaShare(state), "GOAP activation must retain an actual direct Lorna-to-Riona share");

  const decisions = butterfly.matchingDecisionEvents(state);
  assert.ok(decisions.some((event) =>
    event.replanned === true
    && event.reason === "merchant-rumor-credibility"
    && event.goal === `aftermath:${butterfly.GOAP_GOAL}`
    && event.action === "local-travel"
    && event.targetFacilityId === "LOC_FARM_SQUARE"));
  assert.ok(decisions.some((event) =>
    event.reason === "merchant-rumor-credibility"
    && event.action === butterfly.GOAP_ACTION));

  const movement = butterfly.matchingMovementEvents(state).at(-1);
  assert.ok(movement, "production npc-life local movement must record Riona's arrival");
  assert.equal(movement.toFacilityId, "LOC_FARM_SQUARE");
  assert.match(movement.routeId, /^LOCAL:田園の村:/u);
  assert.equal(state.playerState.history.some((entry) =>
    entry.type === butterfly.GOAP_EXECUTION_HISTORY
    && entry.executionAuthority === "npc-life-engine"
    && entry.movementRouteId === movement.routeId), true);

  const callback = authoredMissionFlowExclusiveActions(state)
    .find((action) => action.id === butterfly.CALLBACK_ACTION_ID);
  assert.ok(callback, "callback becomes visible only after the production planner and movement authority finish");
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, callback, result), true);
  assert.equal(state.playerState.goapRequests[butterfly.GOAP_ID].status, "completed");
  assert.equal(state.playerState.player.knownRumorIds.has(butterfly.RUMOR_ID), true);
  assert.match(result.summary, /ローナさんから聞いた/);
  assert.match(result.summary, /次の街へ持っていく前に/);
  assert.match(result.summary, /裏を取ってた/);
});

test("REGISTER butterfly survives serialization while actual common interaction and planner progress continue", () => {
  const recordOnly = runtime({ finnReturned: false, minute: 700 });
  synchronizeRegisterButterfly(recordOnly);
  const restoredRecord = cloneSerializable(recordOnly);
  assert.equal(butterfly.registerRecord(restoredRecord).id, butterfly.registerRecord(recordOnly).id);
  assert.equal(restoredRecord.livingWorld.npcStates.NPC058.beliefs[butterfly.FACT_ID], undefined);

  const correlated = runtime({ finnReturned: true, minute: 830, riona: false });
  synchronizeRegisterButterfly(correlated);
  const restoredCorrelation = cloneSerializable(correlated);
  assert.equal(restoredCorrelation.livingWorld.npcStates.NPC058.memories[butterfly.FACT_ID].sourceRecordId, butterfly.registerRecord(correlated).id);

  const propagated = canonicalLifeRuntime();
  synchronizeRegisterButterfly(propagated);
  const nextTick = advanceUntil(propagated, (current) => Boolean(current.playerState.goapRequests[butterfly.GOAP_ID]));
  const share = directRionaShare(propagated);
  assert.ok(share);
  const restoredPropagation = deserializeRuntime(serializeRuntime(propagated), data);
  assert.equal(restoredPropagation.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID].sourceNpcId, "NPC058");
  assert.equal(restoredPropagation.playerState.rumorById[butterfly.RUMOR_ID].sourceNpcId, "NPC058");
  assert.equal(restoredPropagation.playerState.goapRequests[butterfly.GOAP_ID].status, "active");
  assert.equal(restoredPropagation.playerState.player.knownRumorIds instanceof Set, true);

  advanceUntil(restoredPropagation, (current) => current.playerState.goapRequests[butterfly.GOAP_ID]?.status === "completed", {
    startTick: nextTick,
    maxTicks: 24,
  });
  const restoredReady = deserializeRuntime(serializeRuntime(restoredPropagation), data);
  assert.equal(restoredReady.playerState.goapRequests[butterfly.GOAP_ID].status, "completed");
  assert.equal(restoredReady.playerState.goapRequests[butterfly.GOAP_ID].completionReason, "npc-life-engine-aftermath-plan-completed");
  assert.equal(restoredReady.livingWorld.npcStates.NPC008.completedAftermathPlanIds.includes(butterfly.GOAP_ID), true);
  assert.equal(butterfly.npcFacility(restoredReady.livingWorld.npcStates.NPC008), "LOC_FARM_SQUARE");
  assert.ok(directRionaShare(restoredReady));
});

test("dead or not-yet-present information carriers do not receive butterfly state", () => {
  const state = runtime({ finnReturned: true, minute: 900 });
  state.livingWorld.npcStates.NPC008.presence = "not-yet-present";
  synchronizeRegisterButterfly(state);
  assert.equal(state.livingWorld.npcStates.NPC058.beliefs[butterfly.FACT_ID].sourceRecordId, butterfly.registerRecord(state).id);
  assert.equal(state.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID], undefined);
  assert.equal(state.playerState.goapRequests[butterfly.GOAP_ID], undefined);
});
