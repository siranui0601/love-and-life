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

function createService(store = new MemoryTrpgSaveStore()) {
  return createCheckpointEPrologueTrpgGameService({ data, store, allowCustomSeed: true });
}

async function command(svc, owner, save, type, payload) {
  const result = await svc.command(owner, save.id, {
    commandId: `f-cert:${owner}:${save.revision}:${type}:${JSON.stringify(payload)}`,
    expectedRevision: save.revision,
    type,
    payload,
  });
  return result.save;
}

async function chooseAction(svc, owner, save, actionId) {
  const choice = save.choices.find((entry) => entry.actionId === actionId);
  assert.ok(choice, `${actionId} must be a visible production choice; visible=${save.choices.map((entry) => entry.actionId).join(',')}`);
  const next = await command(svc, owner, save, 'CHOOSE', { choiceId: choice.choiceId, actionId: choice.actionId });
  assert.equal(choice.actionId, actionId, 'the visible actionId must be the executed actionId');
  return next;
}

async function acknowledgeEda(svc, owner, save) {
  const beat = save.scene.beats.find((entry) => entry.actorId === 'NPC004' && entry.introductionToken);
  assert.ok(beat?.introductionToken, 'Eda acknowledgement must come from the visible production introduction beat');
  return command(svc, owner, save, 'ACK_NPC_INTRODUCTION', { token: beat.introductionToken });
}

async function completeCheckpointE({ lodgingActionId, loadoutId = 'sword' }) {
  const store = new MemoryTrpgSaveStore();
  const svc = createService(store);
  const owner = `f-cert-${loadoutId}-${lodgingActionId.split(':').at(-1).toLowerCase()}`;
  let save = await svc.create(owner, { playerName: 'F証明旅人', seed: owner });
  const times = [save.clock.absoluteMinute];

  assert.equal(save.scene.facilityId, 'LOC_FARM_EDGE');
  save = await chooseAction(svc, owner, save, 'E:EDGE:THANK'); times.push(save.clock.absoluteMinute);
  save = await acknowledgeEda(svc, owner, save); times.push(save.clock.absoluteMinute);
  save = await chooseAction(svc, owner, save, 'E:MOVE:WITH_EDA'); times.push(save.clock.absoluteMinute);
  save = await chooseAction(svc, owner, save, 'E:BREAD:THANK'); times.push(save.clock.absoluteMinute);
  save = await chooseAction(svc, owner, save, 'E:EAT:QUIET'); times.push(save.clock.absoluteMinute);
  save = await chooseAction(svc, owner, save, 'E:INV:PLAIN'); times.push(save.clock.absoluteMinute);
  save = await command(svc, owner, save, 'TUTORIAL_ACK', { tutorialId: 'checkpoint-e-inventory' }); times.push(save.clock.absoluteMinute);
  save = await chooseAction(svc, owner, save, 'E:LOAN:LOOK'); times.push(save.clock.absoluteMinute);

  const catalog = buildCheckpointELoanCatalog(data);
  const selected = catalog.options.find((entry) => entry.id === loadoutId);
  assert.ok(selected, `loadout ${loadoutId} must be canonical`);
  save = await command(svc, owner, save, 'SHOP_BORROW', { loanId: `EINTRO:LOADOUT:${loadoutId}` }); times.push(save.clock.absoluteMinute);
  for (const equipmentId of selected.equipmentIds) {
    save = await command(svc, owner, save, 'EQUIP', { equipmentId }); times.push(save.clock.absoluteMinute);
  }
  save = await command(svc, owner, save, 'TUTORIAL_ACK', { tutorialId: 'checkpoint-e-skills' }); times.push(save.clock.absoluteMinute);
  save = await chooseAction(svc, owner, save, 'E:FATIGUE:CHECK'); times.push(save.clock.absoluteMinute);
  save = await chooseAction(svc, owner, save, lodgingActionId); times.push(save.clock.absoluteMinute);

  assert.equal(save.checkpointEPrologue.complete, true);
  assert.equal(save.checkpointEPrologue.stage, 'free');
  for (let index = 1; index < times.length; index += 1) {
    assert.ok(times[index] >= times[index - 1], `production clock must not rewind at E step ${index}: ${times[index - 1]} -> ${times[index]}`);
  }
  const runtime = deserializeRuntime((await store.get(save.id)).runtimeSnapshot, data);
  return { store, svc, owner, save, runtime, times };
}

test('[CHECKPOINT_F_CERT] all three real lodging choices complete E and expose a natural post-E world', async () => {
  for (const lodgingActionId of ['E:LODGE:SLEEP', 'E:LODGE:REGISTER', 'E:LODGE:CONTINUE']) {
    const run = await completeCheckpointE({ lodgingActionId });
    assert.ok(run.save.choices.length > 0 || run.save.movement.length > 0, `${lodgingActionId} must return to ordinary production actions`);
    assert.equal(run.runtime.checkpointEPrologue.complete, true);
    console.log('[F_CERT_POST_E]', JSON.stringify({
      lodgingActionId,
      minute: run.save.clock.absoluteMinute,
      facilityId: run.save.scene.facilityId,
      choices: run.save.choices.map((entry) => ({ actionId: entry.actionId, label: entry.label, type: entry.type })),
      movement: run.save.movement.map((entry) => ({ moveId: entry.moveId, destinationFacilityId: entry.destinationFacilityId, destination: entry.destination })),
      missions: run.save.missions.map((entry) => ({ id: entry.id, status: entry.status, currentStep: entry.currentStep?.id ?? null })),
    }));
  }
});
