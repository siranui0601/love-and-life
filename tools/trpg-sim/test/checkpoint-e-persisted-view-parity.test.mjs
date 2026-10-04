import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCheckpointELoanCatalog,
  createCheckpointEPrologueTrpgGameService,
} from '../../../src/server/trpg/game/checkpoint-e-prologue-service.js';
import { loadTrpgGameData } from '../../../src/server/trpg/game/game-data.js';
import { MemoryTrpgSaveStore } from '../../../src/server/trpg/game/save-store.js';
import { deserializeRuntime } from '../../../src/server/trpg/game/serializer.js';

const data = loadTrpgGameData();

function service(store) {
  return createCheckpointEPrologueTrpgGameService({ data, store, allowCustomSeed: true });
}

async function send(game, owner, save, type, payload) {
  return (await game.command(owner, save.id, {
    commandId: `e-parity:${save.revision}:${type}:${JSON.stringify(payload)}`.slice(0, 100),
    expectedRevision: save.revision,
    type,
    payload,
  })).save;
}

async function choose(game, owner, save, actionId) {
  const choice = save.choices.find((entry) => entry.actionId === actionId);
  assert.ok(choice, `${actionId} must be visible; visible=${save.choices.map((entry) => entry.actionId).join(',')}`);
  return send(game, owner, save, 'CHOOSE', { choiceId: choice.choiceId, actionId: choice.actionId });
}

async function move(game, owner, save, facilityId) {
  const movement = save.movement.find((entry) => entry.destinationFacilityId === facilityId);
  assert.ok(movement, `movement to ${facilityId} must be visible; movement=${save.movement.map((entry) => `${entry.moveId}:${entry.destinationFacilityId}`).join(',')}`);
  return send(game, owner, save, 'MOVE', { moveId: movement.moveId });
}

function projection(record, view) {
  const runtime = deserializeRuntime(record.runtimeSnapshot, data);
  return {
    stateHash: record.stateHash,
    publicStateHash: view.stateHash,
    revision: record.revision,
    publicRevision: view.revision,
    choices: view.choices.map((entry) => entry.actionId),
    movement: view.movement.map((entry) => entry.moveId),
    knownRumorIds: [...runtime.playerState.player.knownRumorIds].sort(),
    authoritativePresentNpcIds: [...(runtime.playerState.authoritativePresentNpcIds ?? [])].sort(),
    narrativeChoiceSelection: runtime.narrativeChoiceSelection ?? null,
    tutorial: runtime.tutorial ?? null,
    checkpointEComplete: runtime.checkpointEPrologue?.complete === true,
    location: runtime.playerState.player.location,
    facilityId: runtime.playerState.player.facilityId,
  };
}

async function completeE(store, owner) {
  const game = service(store);
  let save = await game.create(owner, { playerName: 'E durable parity', seed: owner });
  save = await choose(game, owner, save, 'E:EDGE:THANK');
  const intro = save.scene.beats.find((entry) => entry.actorId === 'NPC004' && entry.introductionToken);
  assert.ok(intro?.introductionToken);
  save = await send(game, owner, save, 'ACK_NPC_INTRODUCTION', { token: intro.introductionToken });
  save = await choose(game, owner, save, 'E:MOVE:WATCH');
  save = await choose(game, owner, save, 'E:BREAD:HELP');
  save = await choose(game, owner, save, 'E:EAT:QUIET');
  save = await choose(game, owner, save, 'E:INV:PLAIN');
  save = await send(game, owner, save, 'TUTORIAL_ACK', { tutorialId: 'checkpoint-e-inventory' });
  save = await choose(game, owner, save, 'E:LOAN:RECORD');
  const loadout = buildCheckpointELoanCatalog(data).options.find((entry) => entry.id === 'sword-shield');
  assert.ok(loadout);
  save = await send(game, owner, save, 'SHOP_BORROW', { loanId: 'EINTRO:LOADOUT:sword-shield' });
  for (const equipmentId of loadout.equipmentIds) save = await send(game, owner, save, 'EQUIP', { equipmentId });
  save = await send(game, owner, save, 'TUTORIAL_ACK', { tutorialId: 'checkpoint-e-skills' });
  save = await choose(game, owner, save, 'E:FATIGUE:CHECK');
  save = await choose(game, owner, save, 'E:LODGE:REGISTER');
  return { game, save };
}

test('[CHECKPOINT_E_PERSISTENCE] final public view equals durable save and fresh-service restore', async () => {
  const store = new MemoryTrpgSaveStore();
  const owner = 'checkpoint-e-durable-view-parity';
  const { save: returned } = await completeE(store, owner);
  assert.equal(returned.checkpointEPrologue.complete, true);

  const recordBeforeGet = await store.get(returned.id);
  const returnedProjection = projection(recordBeforeGet, returned);

  const fresh = service(store);
  const restored = await fresh.get(owner, returned.id);
  const recordAfterGet = await store.get(returned.id);
  const restoredProjection = projection(recordAfterGet, restored);

  console.log('[CHECKPOINT_E_DURABLE_PARITY]', JSON.stringify({ returnedProjection, restoredProjection }));
  assert.equal(recordBeforeGet.stateHash, returned.stateHash, 'command response stateHash must already be the durable stateHash');
  assert.deepEqual(returned.choices.map((entry) => entry.actionId), restored.choices.map((entry) => entry.actionId), 'final E choices must survive a fresh service restore exactly');
  assert.equal(returned.stateHash, restored.stateHash, 'final E state hash must survive restore exactly');
  assert.equal(recordBeforeGet.runtimeSnapshot, recordAfterGet.runtimeSnapshot, 'a read-only fresh get must not rewrite the just-committed Checkpoint E runtime');
});

test('[CHECKPOINT_E_PERSISTENCE] post-E T01 discovery move returns the same three choices as fresh restore', async () => {
  const store = new MemoryTrpgSaveStore();
  const owner = 'checkpoint-e-post-move-view-parity';
  const opening = await completeE(store, owner);
  let save = opening.save;

  save = await choose(opening.game, owner, save, 'DISCOVER_LOCAL_TROUBLE:T01');
  save = await move(opening.game, owner, save, 'LOC_FARM_SQUARE');
  assert.equal(save.clock.time, '11:45');

  const recordBeforeGet = await store.get(save.id);
  const returnedProjection = projection(recordBeforeGet, save);
  const fresh = service(store);
  const restored = await fresh.get(owner, save.id);
  const recordAfterGet = await store.get(save.id);
  const restoredProjection = projection(recordAfterGet, restored);

  console.log('[CHECKPOINT_E_POST_MOVE_PARITY]', JSON.stringify({ returnedProjection, restoredProjection }));
  assert.equal(recordBeforeGet.stateHash, save.stateHash, 'MOVE response must expose the durable state hash');
  assert.equal(restored.stateHash, save.stateHash, 'fresh GET must restore the exact MOVE state hash');
  assert.deepEqual(
    save.choices.map((entry) => entry.actionId),
    restored.choices.map((entry) => entry.actionId),
    'MOVE response and fresh GET must expose the same ordered three choices',
  );
  assert.equal(recordBeforeGet.runtimeSnapshot, recordAfterGet.runtimeSnapshot, 'fresh GET must not repair presentation-only state after MOVE');
});
