import assert from "node:assert/strict";
import test from "node:test";

import { AUTHORED_REGISTER_BUTTERFLY_RELAY_INTERNALS as relay } from "../../../src/server/trpg/content/authored-register-butterfly-relay.js";

const FACT_ID = "F-FACT-REGISTERED-FINN-RESCUER";

function runtime({ sameFacility = false } = {}) {
  return {
    playerState: { absoluteMinute: 2431, history: [], player: { location: "田園の村", facilityId: "LOC_FARM_SQUARE" } },
    livingWorld: {
      knowledgeEvents: [],
      npcStates: {
        NPC058: {
          lifeStatus: "alive", presence: "present", location: "田園の村",
          position: { hubId: "田園の村", facilityId: "LOC_FARM_INN" },
          localTravel: null, travel: null, completedAftermathPlanIds: [],
          beliefs: { [FACT_ID]: { factId: FACT_ID, kind: "trouble", troubleStatus: "resolved", aftermathPlans: [] } },
        },
        NPC008: {
          lifeStatus: "alive", presence: "present", location: "田園の村",
          position: { hubId: "田園の村", facilityId: sameFacility ? "LOC_FARM_INN" : "LOC_FARM_CHIEF" },
          localTravel: null, travel: null, completedAftermathPlanIds: [], beliefs: {},
        },
      },
    },
  };
}

test("F relay starts a real 30-minute local travel from Rona to Riona after a command without copying knowledge", () => {
  const state = runtime();
  const playerBefore = structuredClone(state.playerState.player);
  const travel = relay.driveRelayContact(state);
  assert.ok(travel);
  assert.equal(state.livingWorld.npcStates.NPC058.presence, "traveling");
  assert.deepEqual(state.livingWorld.npcStates.NPC058.position, { hubId: "田園の村", facilityId: "LOC_FARM_INN" });
  assert.equal(travel.fromFacilityId, "LOC_FARM_INN");
  assert.equal(travel.toFacilityId, "LOC_FARM_CHIEF");
  assert.equal(travel.arriveAt - travel.departedAt, 0.5);
  assert.equal(state.livingWorld.npcStates.NPC008.beliefs[FACT_ID], undefined);
  assert.deepEqual(state.playerState.player, playerBefore);
  assert.equal(state.livingWorld.knowledgeEvents.length, 0);
  assert.equal(state.playerState.history.at(-1).type, relay.RELAY_TRAVEL_HISTORY);
});

test("F relay does not synthesize movement or a share when the two NPCs are already co-present", () => {
  const state = runtime({ sameFacility: true });
  assert.equal(relay.driveRelayContact(state), null);
  assert.equal(state.livingWorld.npcStates.NPC058.localTravel, null);
  assert.equal(state.livingWorld.npcStates.NPC008.beliefs[FACT_ID], undefined);
  assert.equal(state.livingWorld.knowledgeEvents.length, 0);
});
