import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  synchronizeRegisterButterfly,
  AUTHORED_REGISTER_BUTTERFLY_INTERNALS as butterfly,
} from "../../../src/server/trpg/content/authored-register-butterfly.js";
import { cloneSerializable } from "../../../src/server/trpg/game/serializer.js";

function npc(facilityId) {
  return {
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
  if (rona) npcStates.NPC058 = npc("LOC_FARM_INN");
  if (riona) npcStates.NPC008 = npc(rionaFacilityId);
  const state = {
    checkpointEPrologue: { complete: true, completedAtMinute: 700, loan: { disposition: lodging } },
    playerState: {
      absoluteMinute: minute,
      player: { id: "PLAYER-TEST", name: "旅人", location: "田園の村", facilityId: "LOC_FARM_SQUARE", knownRumorIds: new Set() },
      history: [], worldFlags: finnReturned ? { t01FinnReturned: true } : {}, rumors: [], rumorById: {}, goapRequests: {},
    },
    livingWorld: { npcStates },
  };
  if (finnReturned) state.playerState.history.push({ type: "T01_FINN_ESCORTED_TO_SQUARE", minute: 820, missionId: "MSN-T01", troubleId: "T01", npcId: "NPC001" });
  return state;
}

test("REGISTER creates one persistent inn record with provenance while alternative lodging does not", () => {
  const registered = runtime();
  const output = synchronizeRegisterButterfly(registered);
  assert.ok(output.record);
  assert.equal(output.record.type, "inn-register");
  assert.equal(output.record.facilityId, "LOC_FARM_INN");
  assert.equal(output.record.sourceActionId, "E:LODGE:REGISTER");
  assert.equal(output.record.recordedAtMinute, 655);
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

test("T01 return links the registered rescuer to Rona first, without fabricating absent NPCs", () => {
  const beforeRescue = runtime();
  synchronizeRegisterButterfly(beforeRescue);
  assert.equal(beforeRescue.livingWorld.npcStates.NPC058.beliefs[butterfly.FACT_ID], undefined);
  assert.equal(beforeRescue.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID], undefined);

  const noRiona = runtime({ finnReturned: true, minute: 830, riona: false });
  synchronizeRegisterButterfly(noRiona);
  const record = butterfly.registerRecord(noRiona);
  const rona = noRiona.livingWorld.npcStates.NPC058;
  assert.equal(rona.beliefs[butterfly.FACT_ID].sourceRecordId, record.id);
  assert.equal(rona.beliefs[butterfly.FACT_ID].sourceNpcId, "NPC058");
  assert.equal(rona.memories[butterfly.FACT_ID].sourceRecordId, record.id);
  assert.equal(noRiona.livingWorld.npcStates.NPC008, undefined);
  assert.equal(noRiona.playerState.rumorById[butterfly.RUMOR_ID], undefined);
  assert.equal(noRiona.playerState.goapRequests[butterfly.GOAP_ID], undefined);
  assert.equal(noRiona.playerState.history.some((entry) => entry.type === butterfly.LINK_HISTORY), true);
  assert.equal(noRiona.playerState.history.some((entry) => entry.type === butterfly.PROPAGATION_HISTORY), false);
});

test("Rona tells Riona only when their ordinary routines meet at the inn", () => {
  const state = runtime({ finnReturned: true, minute: 830, rionaFacilityId: "LOC_FARM_SQUARE" });
  synchronizeRegisterButterfly(state);
  const record = butterfly.registerRecord(state);
  assert.equal(state.livingWorld.npcStates.NPC058.beliefs[butterfly.FACT_ID].sourceRecordId, record.id);
  assert.equal(state.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID], undefined);
  assert.equal(state.playerState.goapRequests[butterfly.GOAP_ID], undefined);

  const riona = state.livingWorld.npcStates.NPC008;
  riona.facilityId = "LOC_FARM_INN";
  riona.position = { hubId: "田園の村", facilityId: "LOC_FARM_INN" };
  state.playerState.absoluteMinute = 900;
  synchronizeRegisterButterfly(state);

  const belief = riona.beliefs[butterfly.FACT_ID];
  assert.equal(belief.sourceNpcId, "NPC058");
  assert.equal(belief.sourceRecordId, record.id);
  assert.deepEqual(belief.path.slice(-2), ["NPC058", "NPC008"]);
  assert.equal(riona.memories[butterfly.FACT_ID].sourceNpcId, "NPC058");
  assert.equal(riona.currentGoal, "verify-village-rumor-before-repeating-on-trade-route");
  assert.equal(state.playerState.rumorById[butterfly.RUMOR_ID].sourceNpcId, "NPC058");
  assert.equal(state.playerState.goapRequests[butterfly.GOAP_ID].preconditions.learnedFromNpcId, "NPC058");
  assert.equal(state.playerState.goapRequests[butterfly.GOAP_ID].status, "active");
  assert.equal(state.playerState.history.some((entry) => entry.type === butterfly.PROPAGATION_HISTORY), true);
  assert.equal(state.playerState.player.knownRumorIds.has(butterfly.RUMOR_ID), false);
});

test("REGISTER butterfly survives serialization with record, memory, belief, rumor and GOAP intact", () => {
  const state = runtime({ finnReturned: true, minute: 900 });
  synchronizeRegisterButterfly(state);
  const record = butterfly.registerRecord(state);
  const restored = cloneSerializable(state);
  assert.equal(butterfly.registerRecord(restored).id, record.id);
  assert.equal(restored.livingWorld.npcStates.NPC058.memories[butterfly.FACT_ID].sourceRecordId, record.id);
  assert.equal(restored.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID].sourceNpcId, "NPC058");
  assert.equal(restored.playerState.rumorById[butterfly.RUMOR_ID].sourceNpcId, "NPC058");
  assert.equal(restored.playerState.goapRequests[butterfly.GOAP_ID].status, "active");
  assert.equal(restored.playerState.player.knownRumorIds instanceof Set, true);
});

test("Riona callback requires her canonical route to bring her to the square; butterfly never teleports her", () => {
  const state = runtime({ finnReturned: true, minute: 900 });
  synchronizeRegisterButterfly(state);
  const riona = state.livingWorld.npcStates.NPC008;
  const request = state.playerState.goapRequests[butterfly.GOAP_ID];
  assert.equal(request.status, "active");
  assert.equal(butterfly.npcFacility(riona), "LOC_FARM_INN");
  assert.deepEqual(authoredMissionFlowExclusiveActions(state).filter((action) => action.id === butterfly.CALLBACK_ACTION_ID), []);
  assert.equal(butterfly.npcFacility(riona), "LOC_FARM_INN", "F synchronization must not move Riona");

  // Simulate the ordinary living-world/schedule layer moving the merchant on her route.
  riona.facilityId = "LOC_FARM_SQUARE";
  riona.position = { hubId: "田園の村", facilityId: "LOC_FARM_SQUARE" };
  state.playerState.absoluteMinute = 960;
  const actions = authoredMissionFlowExclusiveActions(state);
  const callback = actions.find((action) => action.id === butterfly.CALLBACK_ACTION_ID);
  assert.ok(callback);
  assert.equal(callback.targetNpcId, "NPC008");
  assert.equal(state.playerState.goapRequests[butterfly.GOAP_ID].status, "ready");
  assert.equal(state.playerState.goapRequests[butterfly.GOAP_ID].readyReason, "canonical-route-arrived-at-village-square");

  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, callback, result), true);
  assert.equal(state.playerState.goapRequests[butterfly.GOAP_ID].status, "completed");
  assert.equal(state.playerState.player.knownRumorIds.has(butterfly.RUMOR_ID), true);
  assert.match(result.summary, /ローナさんから聞いた/);
  assert.match(result.summary, /本人へ確かめたかった/);
  assert.equal(state.playerState.history.some((entry) => entry.type === butterfly.CALLBACK_HISTORY), true);
});

test("dead or not-yet-present information carriers do not receive butterfly state", () => {
  const state = runtime({ finnReturned: true, minute: 900 });
  state.livingWorld.npcStates.NPC008.presence = "not-yet-present";
  synchronizeRegisterButterfly(state);
  assert.equal(state.livingWorld.npcStates.NPC058.beliefs[butterfly.FACT_ID].sourceRecordId, butterfly.registerRecord(state).id);
  assert.equal(state.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID], undefined);
  assert.equal(state.playerState.goapRequests[butterfly.GOAP_ID], undefined);
});
