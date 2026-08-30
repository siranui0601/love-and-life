import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  synchronizeRegisterButterfly,
  AUTHORED_REGISTER_BUTTERFLY_INTERNALS as butterfly,
} from "../../../src/server/trpg/content/authored-register-butterfly.js";
import { cloneSerializable } from "../../../src/server/trpg/game/serializer.js";

function runtime({ lodging = "borrowed_registered", finnReturned = false, minute = 700 } = {}) {
  const state = {
    checkpointEPrologue: { complete: true, completedAtMinute: 700, loan: { disposition: lodging } },
    playerState: {
      absoluteMinute: minute,
      player: { id: "PLAYER-TEST", name: "旅人", location: "田園の村", facilityId: "LOC_FARM_SQUARE", knownRumorIds: new Set() },
      history: [], worldFlags: finnReturned ? { t01FinnReturned: true } : {}, rumors: [], rumorById: {}, goapRequests: {},
    },
    livingWorld: { npcStates: {} },
  };
  if (finnReturned) state.playerState.history.push({ type: "T01_FINN_ESCORTED_TO_SQUARE", minute: 820, missionId: "MSN-T01", troubleId: "T01", npcId: "NPC001" });
  return state;
}

test("REGISTER creates one persistent inn record while alternative lodging does not", () => {
  const registered = runtime();
  const output = synchronizeRegisterButterfly(registered);
  assert.ok(output.record);
  assert.equal(output.record.type, "inn-register");
  assert.equal(output.record.facilityId, "LOC_FARM_INN");
  assert.equal(output.record.sourceActionId, "E:LODGE:REGISTER");
  assert.equal(output.record.recordedAtMinute, 655);
  synchronizeRegisterButterfly(registered);
  assert.equal(Object.keys(registered.playerState.worldRecords).length, 1);
  assert.equal(registered.playerState.history.filter((entry) => entry.type === butterfly.REGISTER_HISTORY).length, 1);

  for (const lodging of ["borrowed_after_lodging", "borrowed_continued"]) {
    const alternative = runtime({ lodging });
    assert.equal(synchronizeRegisterButterfly(alternative).record, null);
    assert.deepEqual(alternative.playerState.worldRecords ?? {}, {});
    assert.equal(alternative.playerState.goapRequests[butterfly.GOAP_ID], undefined);
  }
});

test("REGISTER alone cannot predict Finn rescue; actual return creates Riona belief, rumor and GOAP", () => {
  const beforeRescue = runtime();
  synchronizeRegisterButterfly(beforeRescue);
  assert.equal(beforeRescue.livingWorld.npcStates.NPC008, undefined);
  assert.equal(beforeRescue.playerState.goapRequests[butterfly.GOAP_ID], undefined);

  const rescued = runtime({ finnReturned: true, minute: 830 });
  synchronizeRegisterButterfly(rescued);
  const record = butterfly.registerRecord(rescued);
  const riona = rescued.livingWorld.npcStates.NPC008;
  assert.equal(riona.beliefs[butterfly.FACT_ID].sourceRecordId, record.id);
  assert.equal(riona.currentGoal, "carry-registered-rescuer-rumor-along-route");
  assert.ok(rescued.playerState.rumorById[butterfly.RUMOR_ID]);
  assert.equal(rescued.playerState.player.knownRumorIds.has(butterfly.RUMOR_ID), false);
  assert.equal(rescued.playerState.goapRequests[butterfly.GOAP_ID].status, "active");

  const restored = cloneSerializable(rescued);
  assert.equal(butterfly.registerRecord(restored).id, record.id);
  assert.equal(restored.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID].sourceRecordId, record.id);
  assert.equal(restored.playerState.goapRequests[butterfly.GOAP_ID].status, "active");
  assert.equal(restored.playerState.player.knownRumorIds instanceof Set, true);
});

test("Riona GOAP creates a later visible callback and hearing it completes the request", () => {
  const state = runtime({ finnReturned: true, minute: 830 });
  synchronizeRegisterButterfly(state);
  state.playerState.absoluteMinute = state.playerState.goapRequests[butterfly.GOAP_ID].readyAtMinute;
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].id, butterfly.CALLBACK_ACTION_ID);
  assert.equal(actions[0].targetNpcId, "NPC008");
  assert.equal(state.livingWorld.npcStates.NPC008.position.facilityId, "LOC_FARM_SQUARE");

  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, actions[0], result), true);
  assert.equal(state.playerState.goapRequests[butterfly.GOAP_ID].status, "completed");
  assert.equal(state.playerState.player.knownRumorIds.has(butterfly.RUMOR_ID), true);
  assert.match(result.summary, /麦穂亭に名前を残した人でしょう/);
  assert.equal(state.playerState.history.some((entry) => entry.type === butterfly.CALLBACK_HISTORY), true);
});
