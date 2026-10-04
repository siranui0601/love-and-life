import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SurvivalAwareTrpgGameService,
  canonicalizePersistedRuntimeRecord,
} from '../../../src/server/trpg/game/survival-aware-service.js';
import { MemoryTrpgSaveStore } from '../../../src/server/trpg/game/save-store.js';
import { deserializeRuntime, serializeRuntime } from '../../../src/server/trpg/game/serializer.js';

test('[CHECKPOINT_F_AUTHORITY] a displayed same-revision REST_OUTDOOR remains executable after runtime canonicalization changes only urgency', async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new SurvivalAwareTrpgGameService({ store, allowCustomSeed: true });
  const owner = 'f-displayed-life-authority';
  const created = await game.create(owner, { playerName: '表示authority旅人', seed: owner });
  const record = await store.get(created.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.playerState.player.location = '田園の村';
  runtime.playerState.player.facilityId = 'LOC_FARM_FIELD';
  runtime.playerState.player.freeMeals = 0;
  runtime.playerState.player.freeLodging = 0;
  runtime.playerState.player.needs.hunger = 40;
  runtime.playerState.player.needs.fatigue = 76;
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = 'stale-before-display';
  canonicalizePersistedRuntimeRecord(record, game.data);
  await store.put(record);

  const displayed = game.gameViewForRecord(record);
  const rest = displayed.choices.find((choice) => choice.actionId === 'REST_OUTDOOR:LOC_FARM_FIELD');
  assert.ok(rest, 'urgent rest must be visibly offered first');

  const persisted = deserializeRuntime(record.runtimeSnapshot, game.data);
  persisted.playerState.player.needs.fatigue = 40;
  record.runtimeSnapshot = serializeRuntime(persisted);
  record.stateHash = 'stale-after-display';
  canonicalizePersistedRuntimeRecord(record, game.data);
  await store.put(record);

  const result = await game.command(owner, created.id, {
    commandId: 'execute-displayed-rest',
    expectedRevision: record.revision,
    type: 'CHOOSE',
    payload: { choiceId: rest.choiceId, actionId: rest.actionId },
  });
  assert.equal(result.save.scene.lastOutcome?.type, 'rest');
  assert.equal(result.save.scene.lastOutcome?.minutes, 120);
  const after = deserializeRuntime((await store.get(created.id)).runtimeSnapshot, game.data);
  assert.equal(after.playerState.history.at(-1).actionId, rest.actionId);
  assert.ok(after.playerState.absoluteMinute > persisted.playerState.absoluteMinute);
});

test('[CHECKPOINT_F_AUTHORITY] a displayed life action is still rejected after the player facility changes', async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new SurvivalAwareTrpgGameService({ store, allowCustomSeed: true });
  const owner = 'f-displayed-life-facility-guard';
  const created = await game.create(owner, { playerName: '施設guard旅人', seed: owner });
  const record = await store.get(created.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.playerState.player.location = '田園の村';
  runtime.playerState.player.facilityId = 'LOC_FARM_FIELD';
  runtime.playerState.player.needs.fatigue = 76;
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = 'stale-facility-display';
  canonicalizePersistedRuntimeRecord(record, game.data);
  await store.put(record);
  const rest = game.gameViewForRecord(record).choices.find((choice) => choice.actionId === 'REST_OUTDOOR:LOC_FARM_FIELD');
  assert.ok(rest);

  const moved = deserializeRuntime(record.runtimeSnapshot, game.data);
  moved.playerState.player.facilityId = 'LOC_FARM_INN';
  record.runtimeSnapshot = serializeRuntime(moved);
  record.stateHash = 'stale-facility-moved';
  canonicalizePersistedRuntimeRecord(record, game.data);
  await store.put(record);

  await assert.rejects(
    game.command(owner, created.id, {
      commandId: 'reject-stale-facility-rest',
      expectedRevision: record.revision,
      type: 'CHOOSE',
      payload: { choiceId: rest.choiceId, actionId: rest.actionId },
    }),
    (error) => error?.code === 'choice_not_available',
  );
});
