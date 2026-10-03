import assert from 'node:assert/strict';
import test from 'node:test';

import * as journey from '../lib/player-journey.mjs';
import { ensurePlayerNeeds } from '../lib/player-needs.mjs';
import { RescueWorldAwareTrpgGameService } from '../../../src/server/trpg/game/rescue-world-aware-service.js';
import { MemoryTrpgSaveStore } from '../../../src/server/trpg/game/save-store.js';
import { deserializeRuntime, serializeRuntime } from '../../../src/server/trpg/game/serializer.js';
import { gameStateHash } from '../../../src/server/trpg/game/service.js';
import { syncAuthoritativePresentNpcIds } from '../../../src/server/trpg/game/presence.js';
import { RESOLVE_COLLAPSE_CHOICE_ID, RESOLVE_COLLAPSE_COMMAND } from '../../../src/server/trpg/game/collapse-aware-service.js';

const owner = 'checkpoint-d0-rescue-parity-owner';
const WORLD_PHASE_MINUTES = [0, 240, 480, 720];

function setClock(state, absoluteMinute) {
  const clock = journey.clockFromMinute(absoluteMinute);
  state.absoluteMinute = absoluteMinute;
  state.day = clock.day;
  state.hour = clock.hour;
  state.minute = clock.minute;
  state.minuteOfDay = clock.minuteOfDay;
  state.phaseIndex = clock.minuteOfDay >= 1320 || clock.minuteOfDay < 600 ? 3 : clock.minuteOfDay >= 1080 ? 2 : clock.minuteOfDay >= 840 ? 1 : 0;
  state.daypart = clock.minuteOfDay < 480 ? 'dawn' : clock.minuteOfDay < 1080 ? 'day' : clock.minuteOfDay < 1320 ? 'dusk' : 'night';
}

function defeatPending(player, gold = 500) {
  ensurePlayerNeeds(player);
  player.hpRatio = 0;
  player.mpRatio = 0.05;
  player.gold = gold;
  player.pendingDefeatSettlement = {
    version: 'battle-defeat-rescue-v1',
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

async function rescue(game, saveId) {
  const collapsed = await game.get(owner, saveId);
  assert.equal(collapsed.player.needs.collapsePending, true);
  return game.command(owner, saveId, {
    commandId: 'd0-rescue-parity',
    expectedRevision: collapsed.revision,
    type: 'CHOOSE',
    payload: { choiceId: RESOLVE_COLLAPSE_CHOICE_ID, actionId: RESOLVE_COLLAPSE_COMMAND },
  });
}

function minuteImmediatelyBeforeCanonicalDayRollover() {
  for (let minute = 0; minute < 30 * 1440; minute += 10) {
    const now = journey.clockFromMinute(minute);
    const later = journey.clockFromMinute(minute + 60);
    if (later.day > now.day) return minute;
  }
  throw new Error('canonical clock did not expose a day rollover in bounded search');
}

function latestWorldTickAtOrBefore(targetMinute) {
  let latest = -1;
  for (let day = 1; day <= 100; day += 1) {
    for (const phaseMinute of WORLD_PHASE_MINUTES) {
      const minute = (day - 1) * 1440 + phaseMinute;
      if (minute > targetMinute) return latest;
      latest = minute;
    }
  }
  return latest;
}

test('Checkpoint D-0 rescue parity: rescue elapsed minutes follow the canonical player clock across a real day rollover', async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new RescueWorldAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create(owner, { playerName: '救助時間同値', seed: 'd0-rescue-parity-rollover' });
  const startMinute = minuteImmediatelyBeforeCanonicalDayRollover();
  const startClock = journey.clockFromMinute(startMinute);

  await mutate(game, store, created.id, (runtime) => {
    defeatPending(runtime.playerState.player, 500);
    setClock(runtime.playerState, startMinute);
    runtime.playerState.player.companionNpcIds = new Set();
    // Force the existing SYSTEM_LOCAL_AID fallback without inventing rescue gameplay:
    // NPCs remain in the world engine but are ineligible rescuers.
    for (const npc of Object.values(runtime.livingWorld.npcStates)) npc.canRescue = false;
  });

  await rescue(game, created.id);
  const runtime = deserializeRuntime((await store.get(created.id)).runtimeSnapshot, game.data);
  const event = runtime.playerState.history.findLast((entry) => entry.type === 'PLAYER_RESCUED_BY_LOCAL_AID');
  assert.ok(event, 'local-aid rescue must leave its authoritative history event');
  assert.ok(Number(event.elapsedMinutes) >= 60, 'rescue must consume actual elapsed world time');

  const expectedMinute = startMinute + Number(event.elapsedMinutes);
  const expectedClock = journey.clockFromMinute(expectedMinute);
  assert.equal(runtime.playerState.absoluteMinute, expectedMinute, 'rescue uses the same absolute-minute axis as ordinary player time');
  assert.equal(runtime.playerState.day, expectedClock.day);
  assert.equal(runtime.playerState.hour, expectedClock.hour);
  assert.equal(runtime.playerState.minute, expectedClock.minute);
  assert.ok(runtime.playerState.day > startClock.day, 'the bounded rescue actually crosses the canonical day rollover');

  const expectedWorldTick = latestWorldTickAtOrBefore(expectedMinute);
  assert.equal(runtime.lastWorldTickMinute, expectedWorldTick,
    'living-world rescue ticks remain aligned to the same canonical world tick schedule');
});

test('Checkpoint D-0 rescue parity: defeat settlement remains deferred until rescue completion', async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new RescueWorldAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create(owner, { playerName: '救助精算同値', seed: 'd0-rescue-parity-settlement' });

  await mutate(game, store, created.id, (runtime) => {
    defeatPending(runtime.playerState.player, 1000);
    runtime.playerState.player.companionNpcIds = new Set();
    for (const npc of Object.values(runtime.livingWorld.npcStates)) npc.canRescue = false;
  });

  const before = await game.get(owner, created.id);
  assert.equal(before.player.hpRatio, 0, 'defeat remains incapacitated before rescue');
  assert.equal(before.player.gold, 1000, 'deferred defeat Gold loss must not commit before rescue');

  await rescue(game, created.id);
  const after = await game.get(owner, created.id);
  assert.equal(after.player.hpRatio, 0.35);
  assert.equal(after.player.mpRatio, 0.2);
  assert.equal(after.player.gold, 900, 'deferred defeat Gold loss commits at rescue completion');
});
