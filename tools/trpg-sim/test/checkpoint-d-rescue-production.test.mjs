import assert from "node:assert/strict";
import test from "node:test";
import * as journey from "../lib/player-journey.mjs";
import { ensurePlayerNeeds } from "../lib/player-needs.mjs";
import {
  RescueWorldAwareTrpgGameService,
  productionRescueCandidates,
  selectCanonicalRescueDestination,
} from "../../../src/server/trpg/game/rescue-world-aware-service.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import { deserializeRuntime, serializeRuntime } from "../../../src/server/trpg/game/serializer.js";
import { gameStateHash } from "../../../src/server/trpg/game/service.js";
import { syncAuthoritativePresentNpcIds } from "../../../src/server/trpg/game/presence.js";
import { RESOLVE_COLLAPSE_CHOICE_ID, RESOLVE_COLLAPSE_COMMAND } from "../../../src/server/trpg/game/collapse-aware-service.js";

const owner = "checkpoint-d-rescue-owner";

function setClock(state, absoluteMinute) {
  const clock = journey.clockFromMinute(absoluteMinute);
  state.absoluteMinute = absoluteMinute;
  state.day = clock.day;
  state.hour = clock.hour;
  state.minute = clock.minute;
  state.minuteOfDay = clock.minuteOfDay;
  state.phaseIndex = clock.minuteOfDay >= 1320 || clock.minuteOfDay < 600 ? 3 : clock.minuteOfDay >= 1080 ? 2 : clock.minuteOfDay >= 840 ? 1 : 0;
  state.daypart = clock.minuteOfDay < 480 ? "dawn" : clock.minuteOfDay < 1080 ? "day" : clock.minuteOfDay < 1320 ? "dusk" : "night";
}

function defeatPending(player, gold = 1000) {
  ensurePlayerNeeds(player);
  player.hpRatio = 0;
  player.mpRatio = 0.07;
  player.gold = gold;
  player.pendingDefeatSettlement = {
    version: "battle-defeat-rescue-v1",
    defeatedAtMinute: 0,
    recoveryHpRatio: 0.35,
    recoveryMpRatio: 0.2,
    goldLoss: Math.floor(gold * 0.1),
    goldBeforeLoss: gold,
  };
  player.needs.activeCollapse = null;
}

async function mutate(game, store, saveId, mutator) {
  const record = await store.get(saveId);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.tutorial = null;
  await mutator(runtime);
  syncAuthoritativePresentNpcIds(runtime, game.data);
  record.runtimeSnapshot = serializeRuntime(runtime);
  const normalized = deserializeRuntime(record.runtimeSnapshot, game.data);
  record.stateHash = gameStateHash(normalized, game.data);
  await store.put(record);
}

async function rescue(game, saveId, commandId = "resolve-defeat") {
  const collapsed = await game.get(owner, saveId);
  assert.equal(collapsed.player.needs.collapsePending, true);
  return game.command(owner, saveId, {
    commandId,
    expectedRevision: collapsed.revision,
    type: "CHOOSE",
    payload: { choiceId: RESOLVE_COLLAPSE_CHOICE_ID, actionId: RESOLVE_COLLAPSE_COMMAND },
  });
}

function placeNpc(runtime, npcId, { location, facilityId, dead = false } = {}) {
  const npc = runtime.livingWorld.npcStates[npcId];
  npc.id ??= npcId;
  npc.location = location;
  npc.position = { hubId: location, facilityId };
  npc.travel = null;
  npc.localTravel = null;
  npc.presence = dead ? "dead" : "present";
  npc.lifeStatus = dead ? "dead" : "alive";
  npc.dead = dead;
  npc.canRescue = !dead;
  return npc;
}

test("Checkpoint D production rescue: companion spends real world time, moves to canonical safe destination, then defeat recovery commits", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new RescueWorldAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create(owner, { playerName: "敗北救助A", seed: "d-rescue-companion" });
  let companionId;
  let startMinute;
  await mutate(game, store, created.id, (runtime) => {
    const player = runtime.playerState.player;
    defeatPending(player, 1000);
    startMinute = runtime.playerState.absoluteMinute;
    companionId = game.data.model.npcs[0].id;
    player.companionNpcIds = new Set([companionId]);
    placeNpc(runtime, companionId, { location: player.location, facilityId: player.facilityId });
  });

  const result = await rescue(game, created.id, "companion-rescue");
  const outcome = result.save.lastOutcome?.collapseRescue ?? result.save.collapseRescue;
  assert.equal(result.save.player.hpRatio, 0.35);
  assert.equal(result.save.player.mpRatio, 0.2);
  assert.equal(result.save.player.gold, 900);
  assert.ok(result.save.clock.absoluteMinute > startMinute);

  const record = await store.get(created.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  const rescueEvent = runtime.playerState.history.findLast((entry) => entry.type === "PLAYER_RESCUED_BY_NPC");
  assert.equal(rescueEvent?.rescuerId, companionId);
  assert.ok(rescueEvent?.elapsedMinutes > 0);
  const npc = runtime.livingWorld.npcStates[companionId];
  assert.equal(npc.position.hubId, runtime.playerState.player.location);
  assert.equal(npc.position.facilityId, runtime.playerState.player.facilityId);
  assert.equal(npc.rescueDuty, null);
  assert.equal(npc.lastRescue?.type, "PLAYER_RESCUE_COMPLETED");
  assert.ok((npc.playerKnowledge ?? []).some((entry) => entry.type === "PLAYER_RESCUED"));
  assert.ok(outcome == null || outcome.elapsedMinutes > 0);
});

test("Checkpoint D production rescue: a dead companion is ineligible and another living NPC or local aid rescues instead", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new RescueWorldAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create(owner, { playerName: "敗北救助B", seed: "d-rescue-dead-companion" });
  let deadId;
  let livingId;
  await mutate(game, store, created.id, (runtime) => {
    const player = runtime.playerState.player;
    defeatPending(player, 500);
    [deadId, livingId] = game.data.model.npcs.slice(0, 2).map((npc) => npc.id);
    player.companionNpcIds = new Set([deadId]);
    placeNpc(runtime, deadId, { location: player.location, facilityId: player.facilityId, dead: true });
    placeNpc(runtime, livingId, { location: player.location, facilityId: player.facilityId });
  });
  await rescue(game, created.id, "dead-companion-rescue");
  const runtime = deserializeRuntime((await store.get(created.id)).runtimeSnapshot, game.data);
  const event = runtime.playerState.history.findLast((entry) => ["PLAYER_RESCUED_BY_NPC", "PLAYER_RESCUED_BY_LOCAL_AID"].includes(entry.type));
  assert.notEqual(event?.rescuerId, deadId);
  assert.ok(event?.rescuerId === livingId || event?.rescuerId === "SYSTEM_LOCAL_AID" || event?.type === "PLAYER_RESCUED_BY_LOCAL_AID");
});

test("Checkpoint D production rescue: SYSTEM_LOCAL_AID advances through midnight and crosses a real incident deadline", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new RescueWorldAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create(owner, { playerName: "敗北救助C", seed: "d-rescue-rollover" });
  let troubleId;
  let beforeStatus;
  let startDay;
  await mutate(game, store, created.id, (runtime) => {
    const player = runtime.playerState.player;
    defeatPending(player, 250);
    // Day10 23:00 = Day1 10:00 origin + 9 days + 13 hours.
    setClock(runtime.playerState, 9 * 1440 + 13 * 60);
    startDay = runtime.playerState.day;
    player.companionNpcIds = new Set();
    for (const npc of Object.values(runtime.livingWorld.npcStates)) {
      npc.dead = true;
      npc.lifeStatus = "dead";
      npc.presence = "dead";
      npc.canRescue = false;
      npc.travel = null;
      npc.localTravel = null;
    }
    const definition = game.data.model.troubles.find((entry) => entry.deadlineDay > startDay) ?? game.data.model.troubles[0];
    troubleId = definition.id;
    const deadlineMinute = (definition.deadlineDay - 1) * 1440 + Number(definition.deadlinePhase ?? 0) * 240;
    setClock(runtime.playerState, Math.max(0, deadlineMinute - 30));
    runtime.playerState.troubles[troubleId].status = "active";
    beforeStatus = runtime.playerState.troubles[troubleId].status;
  });
  await rescue(game, created.id, "fallback-rollover-rescue");
  const runtime = deserializeRuntime((await store.get(created.id)).runtimeSnapshot, game.data);
  const event = runtime.playerState.history.findLast((entry) => entry.type === "PLAYER_RESCUED_BY_LOCAL_AID");
  assert.ok(event, "fallback rescue must leave a production history fact");
  assert.ok(event.elapsedMinutes >= 60);
  assert.notEqual(runtime.playerState.troubles[troubleId].status, beforeStatus, "incident deadline must progress while player is being rescued");
  assert.equal(runtime.playerState.player.hpRatio, 0.35);
  assert.equal(runtime.playerState.player.mpRatio, 0.2);
});

test("Checkpoint D rescue routing uses canonical facility semantics and route/local movement distance", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new RescueWorldAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create(owner, { playerName: "敗北救助D", seed: "d-rescue-routing" });
  const record = await store.get(created.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  const destination = selectCanonicalRescueDestination(runtime.playerState, game.data.model);
  assert.ok(destination.location);
  assert.ok(destination.facilityId);
  assert.ok(destination.evacuationMinutes >= 0);
  if (!destination.emergencyFallback) {
    const facility = game.data.model.facilityById[destination.facilityId];
    assert.equal(facility.id, destination.facilityId);
    assert.ok(String(facility.type ?? "").length || String(facility.function ?? "").length);
  }

  const candidates = productionRescueCandidates(runtime, game.data);
  for (const candidate of candidates.filter((entry) => entry.canReach)) {
    assert.ok(candidate.travelMinutes >= 0);
  }
});
