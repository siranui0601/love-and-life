import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGameRuntimeActions,
  availableGameRuntimeChoiceCandidates,
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

function candidateWorkOffer(runtime, data) {
  return availableGameRuntimeChoiceCandidates(runtime, data, { limit: 12 })
    .find((entry) => entry.workOffer === true);
}

function stagePendingWorkOffer(runtime, offer) {
  runtime.pendingWorkOffer = {
    offerId: offer.workOfferId,
    day: runtime.playerState.day,
    facilityId: runtime.playerState.player.facilityId,
    actorNpcId: offer.targetNpcId,
    actorName: offer.targetNpcName,
    description: offer.workDescription,
    wage: offer.quotedWage,
    minutes: Number(offer.workDurationMinutes ?? 120),
    riskClass: offer.workRiskClass ?? "low",
    openedAtMinute: runtime.playerState.absoluteMinute,
  };
  return runtime.pendingWorkOffer;
}

function confirmAction(runtime, data) {
  return availableGameRuntimeActions(runtime, data).choices
    .find((entry) => entry.id.startsWith("WORK_CONFIRM:"));
}

function execute(runtime, data, action) {
  return executeGameRuntimeCommand(runtime, data, {
    type: "CHOOSE",
    payload: { choiceId: action.choiceId, actionId: action.id },
  });
}

test("resolver v16 includes a serialized bounded work market", () => {
  const { runtime } = setup("work-market-version");
  assert.equal(TRPG_GAME_RESOLVER_VERSION, "trpg-player-world-v16");
  assert.equal(ensureWorkMarket(runtime).version, "work-market-v1");
});

test("the broad candidate pool contains an authoritative bounded work offer", () => {
  const { data, runtime } = setup("work-market-candidate");
  const offer = candidateWorkOffer(runtime, data);
  assert.ok(offer, JSON.stringify(availableGameRuntimeChoiceCandidates(runtime, data, { limit: 12 }), null, 2));
  assert.equal(offer.targetNpcId, "NPC003");
  assert.ok(offer.workOfferId);
  assert.equal(offer.workDurationMinutes, 120);
  assert.ok(offer.quotedWage >= 10 && offer.quotedWage <= 15, `wage=${offer.quotedWage}`);
  assert.match(offer.requiredDisclosure, /所要時間は120分、報酬は\d+G/u);
});

test("a staged authoritative offer becomes confirmable and completes without granting levels", () => {
  const { data, runtime } = setup("work-market-confirm");
  const offer = candidateWorkOffer(runtime, data);
  assert.ok(offer);
  stagePendingWorkOffer(runtime, offer);
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");

  const confirm = confirmAction(runtime, data);
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

test("the same employer does not generate another offer until the next day", () => {
  const { data, runtime } = setup("work-market-employer-limit");
  const firstOffer = candidateWorkOffer(runtime, data);
  assert.ok(firstOffer);
  stagePendingWorkOffer(runtime, firstOffer);
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  const confirm = confirmAction(runtime, data);
  assert.ok(confirm);
  execute(runtime, data, confirm);

  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  assert.equal(candidateWorkOffer(runtime, data), undefined);

  setClock(runtime, { day: 2, hour: 8 });
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  assert.ok(candidateWorkOffer(runtime, data));
});

test("jobs that cannot finish during business hours are absent from the broad pool", () => {
  const { data, runtime } = setup("work-market-hours");
  setClock(runtime, { day: 1, hour: 17, minute: 30 });
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  assert.equal(candidateWorkOffer(runtime, data), undefined);
});

test("a stale pending offer is cleared instead of exposing a confirm action", () => {
  const { data, runtime } = setup("work-market-expiry");
  const offer = candidateWorkOffer(runtime, data);
  assert.ok(offer);
  stagePendingWorkOffer(runtime, offer);
  runtime.playerState.absoluteMinute += 181;
  runtime.playerState.hour = 11;
  runtime.playerState.minute = 1;
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");

  assert.equal(confirmAction(runtime, data), undefined);
  assert.equal(runtime.pendingWorkOffer, null);
});
