import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_PUBLIC_LIFE_NETWORK_INTERNALS as network,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime(day, location, facilityId) {
  return {
    playerState: {
      day,
      absoluteMinute: (day - 1) * 1440 + 600,
      player: {
        location,
        facilityId,
        hunger: 38,
        fatigue: 24,
        needs: { hunger: 38, fatigue: 24 },
        freeMeals: 0,
      },
      hunger: 38,
      fatigue: 24,
      progress: {},
      worldFlags: {},
      history: [],
      goapRequests: {},
      missions: {},
    },
    livingWorld: { npcStates: {} },
  };
}

function choose(state, choiceId) {
  const actions = authoredMissionFlowExclusiveActions(state);
  const action = actions?.find((entry) => entry.publicLifeChoiceId === choiceId);
  assert.ok(action, `${choiceId} must be a public action`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return { action, result };
}

test("public-life scenes expose three ordinary choices with server-visible IDs", () => {
  const state = runtime(50, "王都", "LOC_CAP_ORPHANAGE");
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(authoredMissionFlowGuidance(state).title, "食料配布の連絡を作る");
  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((entry) => entry.id), [
    "PUBLIC_LIFE:CAPITAL_FOOD_RELAY:link_caregivers_directly",
    "PUBLIC_LIFE:CAPITAL_FOOD_RELAY:centralize_at_orphanage",
    "PUBLIC_LIFE:CAPITAL_FOOD_RELAY:use_market_notice",
  ]);
  assert.ok(actions.every((entry) => entry.id === entry.actionId));
  assert.ok(actions.every((entry) => entry.authoredMissionFlowExclusiveChoice));
});

test("food relay updates two NPC minds and creates inspectable GOAP work", () => {
  const state = runtime(50, "王都", "LOC_CAP_ORPHANAGE");
  const { action, result } = choose(state, "link_caregivers_directly");

  assert.equal(state.playerState.worldFlags.foodRelayContactsEstablished, true);
  assert.equal(state.playerState.worldFlags.ajinGraffitiRecordedWithoutAmplification, true);
  assert.equal(state.livingWorld.npcStates.NPC021.currentGoal, "exchange-food-counts-without-public-list");
  assert.equal(state.livingWorld.npcStates.NPC026.currentGoal, "exchange-food-counts-without-public-list");
  assert.ok(state.livingWorld.npcStates.NPC021.beliefs["PUBLIC-LIFE-FACT-FOOD-RELAY-CONTACT"]);
  assert.ok(state.livingWorld.npcStates.NPC026.beliefs["PUBLIC-LIFE-FACT-FOOD-RELAY-CONTACT"]);
  assert.equal(state.playerState.progress.petraTrust, 1);
  assert.equal(state.playerState.goapRequests[result.goapRequestId].sourceActionId, action.id);
  assert.deepEqual(state.playerState.goapRequests[result.goapRequestId].participantNpcIds, ["NPC021", "NPC026"]);
  assert.equal(result.closedActionIds.length, 2);
  assert.equal(network.ownActions(state), null);
});

test("closed alternatives remain closed after serialization", () => {
  const state = runtime(64, "王都", "LOC_CAP_MARKET");
  const { action } = choose(state, "publish_normal_prices");
  const saved = JSON.parse(JSON.stringify(state));

  assert.equal(saved.playerState.publicLifeNetwork.completedSceneIds.includes("capital-fair-supply"), true);
  assert.equal(saved.playerState.publicLifeNetwork.selectedActionIds.includes(action.id), true);
  assert.equal(saved.playerState.publicLifeNetwork.closedActionIds["capital-fair-supply"].length, 2);
  assert.equal(saved.playerState.worldFlags.publicMarketPriceBoard, true);
  assert.equal(network.ownActions(saved), null);
});

test("nonlethal preparation assigns distinct NPCs one shared public goal", () => {
  const state = runtime(72, "王都", "LOC_CAP_LOWER_INN");
  const { result } = choose(state, "delay_collective_raid");

  assert.equal(state.playerState.worldFlags.collectiveRaidDelayed, true);
  assert.equal(state.playerState.worldFlags.nonlethalShieldProcedureTrained, true);
  assert.equal(state.playerState.worldFlags.bothSidesMedicalRecoveryPlanned, true);
  for (const npcId of ["NPC024", "NPC046", "NPC026"]) {
    assert.equal(state.livingWorld.npcStates[npcId].currentGoal, "execute-nonlethal-riot-intervention");
    assert.ok(state.livingWorld.npcStates[npcId].beliefs["PUBLIC-LIFE-FACT-NONLETHAL-INTERVENTION"]);
  }
  assert.match(result.summary, /双方の負傷者/u);
});

test("network has no hidden route score or route-named state", () => {
  const source = JSON.stringify(network.SCENES);
  assert.doesNotMatch(source, /VIRTUE_ROUTE|virtueRoute|routeScore/u);
  assert.equal(network.SCENES.length, 21);
  assert.equal(network.SCENES.reduce((total, scene) => total + scene.choices.length, 0), 63);
  assert.ok(network.SCENES.every((scene) => scene.choices.length === 3));
});
