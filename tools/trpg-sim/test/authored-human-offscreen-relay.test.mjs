import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_HUMAN_COMPANION_CAUSALITY_INTERNALS as relay,
} from "../../../src/server/trpg/content/authored-mission-flow-human-companion-causality.js";
import {
  AUTHORED_HUMAN_ROUTE_T04_FALCO_PROGRESS_SYNC_INTERNALS as finalLayer,
} from "../../../src/server/trpg/content/authored-mission-flow-human-route-t04-falco-progress-sync.js";

function npc(facilityId) {
  return {
    location: "田園の村",
    lifeStatus: "alive",
    presence: "present",
    position: { hubId: "田園の村", facilityId },
    facilityId,
    beliefs: {},
    knowledgeRevision: 0,
    currentGoal: "follow-routine",
    goalSince: 0,
    localTravel: null,
  };
}

function runtime() {
  return {
    playerState: {
      absoluteMinute: 7 * 1440 + 7 * 60,
      player: {
        location: "田園の村",
        facilityId: relay.SQUARE_FACILITY_ID,
        needs: { hunger: 24, fatigue: 18 },
        hunger: 24,
        fatigue: 18,
      },
      hunger: 24,
      fatigue: 18,
      missions: {
        "MSN-T03": { id: "MSN-T03", status: "active", progress: { hear: 1, investigate: 0 } },
      },
      history: [{
        type: relay.FINN_MAP_HISTORY,
        minute: 7 * 1440 + 6 * 60 + 40,
        missionId: "MSN-T03",
        troubleId: "T03",
      }],
      worldFlags: {},
      evidence: {},
      goapRequests: {},
    },
    livingWorld: {
      npcStates: {
        [relay.FINN_ID]: npc(relay.SQUARE_FACILITY_ID),
        [relay.EDA_ID]: npc(relay.SQUARE_FACILITY_ID),
        [relay.GARO_ID]: npc(relay.SQUARE_FACILITY_ID),
        [relay.JILL_ID]: npc(relay.HUNTER_HUT_FACILITY_ID),
      },
    },
  };
}

function nextAction(state, expectedLabel) {
  const before = JSON.stringify(state);
  const actions = relay.relayActions(state);
  assert.equal(JSON.stringify(state), before, "scene表示だけでruntimeを変更しない");
  assert.equal(actions?.length, 1);
  const action = actions[0];
  assert.equal(action.label, expectedLabel);
  assert.equal(action.actionId, action.id);
  assert.ok(action.label.length >= 4 && action.label.length <= 20);
  return action;
}

function execute(state, action) {
  state.playerState.absoluteMinute += Number(action.minutes ?? 0);
  const result = { ok: true };
  assert.equal(relay.consumeRelay(state, action, result), true);
  return result;
}

test("フィンの地図からNPC同士の伝言とGOAPがプレイヤー不在でも連鎖する", () => {
  const state = runtime();

  const hearEda = nextAction(state, "エダの伝言を聞く");
  const firstResult = execute(state, hearEda);

  assert.match(firstResult.summary, /プレイヤーを待たずガロへ伝え/u);
  assert.equal(
    state.livingWorld.npcStates[relay.EDA_ID].beliefs["T03-FACT-EDA-OLD-IRRIGATION-ROUTE"].sourceNpcId,
    relay.FINN_ID,
  );
  assert.deepEqual(
    state.livingWorld.npcStates[relay.GARO_ID].beliefs["T03-FACT-GARO-EDGE-ROUTE-WARNING"].path,
    [relay.FINN_ID, relay.EDA_ID, relay.GARO_ID],
  );
  assert.equal(
    state.playerState.goapRequests["GOAP-DAY8-T03-GARO-RUNNER-TO-JILL"].status,
    "active",
  );
  assert.equal(
    state.playerState.history.some((entry) => entry.type === "DAY8_T03_EDA_WARNED_GARO_OFFSCREEN"),
    true,
  );

  const goNorth = nextAction(state, "北柵へ向かう");
  const secondResult = execute(state, goNorth);

  assert.equal(state.playerState.player.facilityId, relay.NORTH_FENCE_FACILITY_ID);
  assert.match(secondResult.summary, /歩いている間に使いは狩人小屋へ届き/u);
  assert.deepEqual(
    state.livingWorld.npcStates[relay.JILL_ID].beliefs["T03-FACT-JILL-FINN-EDGE-ROUTE"].path,
    [relay.FINN_ID, relay.EDA_ID, relay.GARO_ID, relay.JILL_ID],
  );
  assert.equal(
    state.livingWorld.npcStates[relay.JILL_ID].localTravel.toFacilityId,
    relay.NORTH_FENCE_FACILITY_ID,
  );
  assert.equal(
    state.playerState.goapRequests["GOAP-DAY8-T03-GARO-RUNNER-TO-JILL"].status,
    "completed",
  );

  const restored = JSON.parse(JSON.stringify(state));
  const moveLivestock = nextAction(restored, "家畜を石囲いへ移す");
  const thirdResult = execute(restored, moveLivestock);

  assert.match(thirdResult.summary, /フィンの地図、エダの記憶、ガロの伝令/u);
  assert.equal(restored.playerState.worldFlags.t03LivestockEvacuated, true);
  assert.equal(restored.playerState.worldFlags.t03StableTracksTrampled, true);
  assert.equal(restored.playerState.worldFlags.t03NpcRelayLivestockEvacuated, true);
  assert.deepEqual(restored.t03WolfContinuity.sideChoices, ["evacuate_livestock"]);
  assert.equal(
    restored.livingWorld.npcStates[relay.JILL_ID].position.facilityId,
    relay.NORTH_FENCE_FACILITY_ID,
  );
  assert.equal(
    restored.livingWorld.npcStates[relay.JILL_ID].currentGoal,
    "mark-safe-wolf-return-corridor",
  );
  assert.equal(
    restored.playerState.goapRequests["GOAP-DAY8-T03-JILL-VERIFY-NORTH-FENCE"].status,
    "completed",
  );
  assert.equal(
    restored.playerState.history.some((entry) => entry.type === "DAY8_T03_NPC_RELAY_LIVESTOCK_EVACUATED"),
    true,
  );
  assert.equal(restored.playerState.day8T03FinnNpcRelay.selectedActionIds.length, 3);
  assert.equal(restored.playerState.day8T03FinnNpcRelay.phase, "completed");
  assert.equal(relay.relayActions(restored), null);
});

test("死亡または不在の関与NPCを手書きsceneへ出さない", () => {
  const state = runtime();
  state.livingWorld.npcStates[relay.JILL_ID].lifeStatus = "dead";
  state.livingWorld.npcStates[relay.JILL_ID].presence = "dead";
  assert.equal(relay.relayActions(state), null);
  assert.equal(state.playerState.day8T03FinnNpcRelay, undefined);
});

test("T01専用actionが空配列なら後続人徳sceneを遮断しない", () => {
  const state = {
    playerState: {
      absoluteMinute: 7 * 1440,
      player: { location: "田園の村", facilityId: relay.NORTH_FENCE_FACILITY_ID },
      missions: { "MSN-T03": { id: "MSN-T03", status: "active" } },
      history: [],
      worldFlags: {},
    },
  };
  assert.equal(finalLayer.exactT01Actions(state), null);
});
