import test from "node:test";
import assert from "node:assert/strict";

import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import {
  synchronizeRegisterButterfly,
  AUTHORED_REGISTER_BUTTERFLY_INTERNALS as butterfly,
} from "../../../src/server/trpg/content/authored-register-butterfly.js";
import {
  completeNpcLifeTick,
  createNpcLifeEngine,
  prepareNpcLifeTick,
} from "../lib/npc-life-engine.mjs";

const data = loadTrpgGameData();

function canonicalRuntime() {
  const npcStates = Object.fromEntries(data.model.npcs.map((entry) => [entry.id, { id: entry.id }]));
  const livingWorld = createNpcLifeEngine({
    model: data.model,
    seed: "register-butterfly-production-life",
    npcStates,
  });
  return {
    checkpointEPrologue: {
      complete: true,
      completedAtMinute: 700,
      loan: { disposition: "borrowed_registered" },
    },
    playerState: {
      absoluteMinute: 830,
      player: {
        id: "PLAYER-F-REGISTER",
        name: "旅人",
        location: "田園の村",
        facilityId: "LOC_FARM_SQUARE",
        knownRumorIds: new Set(),
      },
      history: [{
        type: "T01_FINN_ESCORTED_TO_SQUARE",
        minute: 820,
        missionId: "MSN-T01",
        troubleId: "T01",
        npcId: "NPC001",
      }],
      worldFlags: { t01FinnReturned: true },
      rumors: [],
      rumorById: {},
      goapRequests: {},
    },
    livingWorld,
  };
}

function runTick(state, tick) {
  const day = Math.floor(tick / 4) + 1;
  const phaseIndex = tick % 4;
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

test("REGISTER correlation reaches Riona through an actual direct Lorna conversation before public relay", () => {
  const state = canonicalRuntime();
  synchronizeRegisterButterfly(state);

  for (let tick = 0; tick < 24 && !state.playerState.goapRequests?.[butterfly.GOAP_ID]; tick += 1) {
    runTick(state, tick);
  }

  const direct = state.livingWorld.knowledgeEvents.find((event) =>
    event.type === "share"
    && event.factId === butterfly.FACT_ID
    && event.sourceNpcId === "NPC058"
    && event.npcId === "NPC008"
    && event.location?.facilityId === "LOC_FARM_INN"
  );
  assert.ok(direct, "expected actual common Lorna -> Riona share at the inn");

  const priorIndirect = state.livingWorld.knowledgeEvents.find((event) =>
    event.factId === butterfly.FACT_ID
    && event.npcId === "NPC008"
    && event.id !== direct.id
    && Number(event.learnedAt) <= Number(direct.learnedAt)
  );
  assert.equal(priorIndirect, undefined, JSON.stringify(priorIndirect));

  const rionaBelief = state.livingWorld.npcStates.NPC008.beliefs[butterfly.FACT_ID];
  assert.equal(rionaBelief.sourceNpcId, "NPC058");
  assert.equal(rionaBelief.sourceRecordId, butterfly.registerRecord(state).id);
  assert.deepEqual(rionaBelief.path, [
    `record:${butterfly.registerRecord(state).id}`,
    "event:T01_FINN_ESCORTED_TO_SQUARE",
    "NPC058",
    "NPC008",
  ]);

  const request = state.playerState.goapRequests[butterfly.GOAP_ID];
  assert.ok(request, "direct share should activate the authored observation of common-world causality");
  assert.equal(request.executionAuthority, "npc-life-engine");
  assert.equal(request.plannerContract, "resolved-belief-aftermath-plan");
  assert.equal(request.preconditions.learnedFromNpcId, "NPC058");
  assert.equal(request.preconditions.sourceKnowledgeEventId, direct.id);
});
