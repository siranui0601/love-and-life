import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGameRuntimeActions,
  createGameRuntime,
  executeGameRuntimeCommand,
  TRPG_GAME_RESOLVER_VERSION,
} from "../../../src/server/trpg/game/service.js";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import { ensureWorkMarket } from "../../../src/server/trpg/resolvers/work-market-resolver.js";

function hideAllNpcs(runtime) {
  for (const state of Object.values(runtime.livingWorld.npcStates)) {
    state.presence = "absent";
    state.travel = null;
    state.localTravel = null;
    state.position = { hubId: state.location ?? "田園の村", facilityId: null };
  }
}

function placeNpc(runtime, npcId, facilityId) {
  const state = runtime.livingWorld.npcStates[npcId];
  assert.ok(state, `${npcId} must exist`);
  state.location = "田園の村";
  state.position = { hubId: "田園の村", facilityId };
  state.presence = "present";
  state.lifeStatus = "alive";
  state.travel = null;
  state.localTravel = null;
  runtime.playerState.authoritativePresentNpcIds = new Set([npcId]);
}

function setClock(runtime, { day = 1, hour = 8, minute = 0 } = {}) {
  const state = runtime.playerState;
  state.day = day;
  state.hour = hour;
  state.minute = minute;
  state.absoluteMinute = (day - 1) * 1440 + hour * 60 + minute;
  state.phaseIndex = hour < 8 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
  state.daypart = hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  state.player.needs.hunger = 15;
  state.player.needs.fatigue = 8;
}

function setup(seed = "work-market-service") {
  const data = loadTrpgGameData();
  const runtime = createGameRuntime(data, {
    seed,
    profileId: "balanced",
    playerName: "働く旅人",
    tutorial: false,
  });
  runtime.playerState.player.location = "田園の村";
  runtime.playerState.player.facilityId = "LOC_FARM_SQUARE";
  runtime.playerKnowledge.knownHubIds.add("田園の村");
  runtime.playerKnowledge.knownFacilityIds.add("LOC_FARM_SQUARE");
  runtime.playerState.troubles.T01.status = "resolved";
  runtime.playerState.missions["MSN-T01"].status = "completed";
  hideAllNpcs(runtime);
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  setClock(runtime);
  return { data, runtime };
}

function visibleWorkOffer(runtime, data) {
  return availableGameRuntimeActions(runtime, data).choices.find((entry) => entry.workOffer === true);
}

function execute(runtime, data, action) {
  return executeGameRuntimeCommand(runtime, data, {
    type: "CHOOSE",
    payload: { choiceId: action.choiceId, actionId: action.id },
  });
}

test("resolver v15 includes a serialized bounded work market", () => {
  const { runtime } = setup("work-market-version");
  assert.equal(TRPG_GAME_RESOLVER_VERSION, "trpg-player-world-v15");
  assert.equal(ensureWorkMarket(runtime).version, "work-market-v1");
});

test("a work offer becomes a confirmable job with a bounded wage", () => {
  const { data, runtime } = setup("work-market-offer");
  const offer = visibleWorkOffer(runtime, data);
  assert.ok(offer, JSON.stringify(availableGameRuntimeActions(runtime, data).choices, null, 2));
  assert.equal(offer.targetNpcId, "NPC003");
  assert.ok(offer.quotedWage >= 10 && offer.quotedWage <= 15, `wage=${offer.quotedWage}`);

  const offerResult = execute(runtime, data, offer);
  assert.equal(offerResult.outcome.ok, true);
  assert.ok(runtime.pendingWorkOffer?.offerId);
  assert.equal(runtime.pendingWorkOffer.actorNpcId, "NPC003");

  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  const confirm = availableGameRuntimeActions(runtime, data).choices.find((entry) => entry.id.startsWith("WORK_CONFIRM:"));
  assert.ok(confirm, JSON.stringify(availableGameRuntimeActions(runtime, data).choices, null, 2));
  const goldBefore = runtime.playerState.player.gold;
  const levelBefore = runtime.playerState.player.level;
  const expBefore = runtime.playerState.player.exp;
  const result = execute(runtime, data, confirm);
  assert.equal(result.outcome.ok, true);
  assert.equal(result.outcome.goldDelta, runtime.playerState.player.gold - goldBefore);
  assert.equal(result.outcome.goldDelta, offer.quotedWage);
  assert.equal(runtime.playerState.player.level, levelBefore);
  assert.equal(runtime.playerState.player.exp, expBefore);
  assert.equal(runtime.pendingWorkOffer, null);
  assert.equal(ensureWorkMarket(runtime).completed.length, 1);
  assert.equal(ensureWorkMarket(runtime).completed[0].employerId, "NPC003");
});

test("the same employer does not offer another job until the next day", () => {
  const { data, runtime } = setup("work-market-employer-limit");
  const offer = visibleWorkOffer(runtime, data);
  assert.ok(offer);
  execute(runtime, data, offer);
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  const confirm = availableGameRuntimeActions(runtime, data).choices.find((entry) => entry.id.startsWith("WORK_CONFIRM:"));
  assert.ok(confirm);
  execute(runtime, data, confirm);

  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  assert.equal(visibleWorkOffer(runtime, data), undefined);

  setClock(runtime, { day: 2, hour: 8 });
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  assert.ok(visibleWorkOffer(runtime, data));
});

test("jobs that cannot finish during business hours are not offered", () => {
  const { data, runtime } = setup("work-market-hours");
  setClock(runtime, { day: 1, hour: 17, minute: 30 });
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  assert.equal(visibleWorkOffer(runtime, data), undefined);
});

test("a stale pending offer cannot be accepted after its expiry window", () => {
  const { data, runtime } = setup("work-market-expiry");
  const offer = visibleWorkOffer(runtime, data);
  assert.ok(offer);
  execute(runtime, data, offer);
  runtime.playerState.absoluteMinute += 181;
  runtime.playerState.hour = 11;
  runtime.playerState.minute = 7;
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  const choices = availableGameRuntimeActions(runtime, data).choices;
  assert.equal(choices.some((entry) => entry.id.startsWith("WORK_CONFIRM:")), false);
  assert.equal(runtime.pendingWorkOffer, null);
});
