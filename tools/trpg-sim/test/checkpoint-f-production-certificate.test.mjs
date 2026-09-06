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

// Production authority lives in the rendered choice: the certificate always sends
// back the exact choiceId/actionId pair that the service exposed to the player.
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

async function discoverT01(run) {
  const discovery = run.save.choices.find((entry) => entry.actionId === 'DISCOVER_LOCAL_TROUBLE:T01');
  assert.ok(discovery, 'the real T01 discovery action must be visible after Checkpoint E');
  run.save = await chooseAction(run.svc, run.owner, run.save, discovery.actionId);
  run.times.push(run.save.clock.absoluteMinute);
  const stored = await run.store.get(run.save.id);
  run.runtime = deserializeRuntime(stored.runtimeSnapshot, data);
  assert.ok([...run.runtime.playerState.player.knownRumorIds].some((rumorId) => run.runtime.playerState.rumorById?.[rumorId]?.troubleId === 'T01'));
  assert.ok(run.runtime.authoredMissionFlows, 'T01 discovery must initialize the authored mission flow in production state');
  return run;
}

function activeT01(save) {
  return save.missions.find((entry) => entry.id === 'MSN-T01') ?? null;
}

function t01VisibleChoice(save, stepId) {
  const candidates = save.choices.filter((entry) => entry.missionId === 'MSN-T01' && (!stepId || entry.stepId === stepId));
  const preferredByStep = {
    hear: ['ACTION:MSN-T01:hear'],
    search: ['ACTION:MSN-T01:search:tracks', 'ACTION:MSN-T01:search:wolf-blockade'],
    rescue: ['ACTION:MSN-T01:rescue'],
    escort: ['ACTION:MSN-T01:escort'],
    decide: ['ACTION:MSN-T01:decide'],
  };
  for (const actionId of preferredByStep[stepId] ?? []) {
    const visible = candidates.find((entry) => entry.actionId === actionId);
    if (visible) return visible;
  }
  return [...candidates].sort((left, right) => String(left.actionId).localeCompare(String(right.actionId), 'en'))[0] ?? null;
}

async function finishActualBattle(run) {
  let rounds = 0;
  let sawPlayerOnlySession = false;
  while (run.save.battle && rounds < 160) {
    rounds += 1;
    const stored = await run.store.get(run.save.id);
    const runtime = deserializeRuntime(stored.runtimeSnapshot, data);
    const session = runtime.pendingBattle?.session;
    assert.ok(session, 'public active battle must correspond to the persisted production battle session');
    assert.equal(session.state?.players?.length, 1, 'ordinary T01 battle must contain exactly one player combatant');
    sawPlayerOnlySession = true;
    const available = (run.save.battle.commands ?? []).filter((entry) => entry.available !== false);
    const selected = available.find((entry) => entry.kind === 'attack')
      ?? available.find((entry) => entry.kind === 'skill')
      ?? available.find((entry) => entry.kind === 'defend')
      ?? available[0];
    assert.ok(selected, `battle round ${rounds} must expose a legal production command`);
    const target = selected.targets?.find((entry) => entry.side === 'enemy' && entry.alive !== false)
      ?? selected.targets?.[0]
      ?? null;
    const before = run.save.clock.absoluteMinute;
    run.save = await command(run.svc, run.owner, run.save, 'BATTLE_ACT', {
      battleId: run.save.battle.id,
      actionId: selected.actionId,
      ...(target ? { targetInstanceId: target.instanceId } : {}),
    });
    run.times.push(run.save.clock.absoluteMinute);
    assert.ok(run.save.clock.absoluteMinute >= before, `battle round ${rounds} must not rewind production time`);
  }
  assert.equal(run.save.battle, null, 'actual T01 battle must finish');
  assert.ok(rounds > 0, 'actual T01 battle must execute at least one round');
  assert.equal(sawPlayerOnlySession, true);
  return rounds;
}

async function completeActualT01(run) {
  let battleRounds = 0;
  const executed = [];
  for (let guard = 0; guard < 40; guard += 1) {
    if (run.save.battle) {
      battleRounds += await finishActualBattle(run);
      continue;
    }

    const mission = activeT01(run.save);
    const stored = await run.store.get(run.save.id);
    run.runtime = deserializeRuntime(stored.runtimeSnapshot, data);
    const finnReturned = run.runtime.playerState.worldFlags?.t01FinnReturned === true
      || run.runtime.playerState.history.some((entry) => entry.type === 'T01_FINN_ESCORTED_TO_SQUARE');
    if (['completed', 'resolved'].includes(mission?.status) && finnReturned) {
      return { battleRounds, executed };
    }
    assert.ok(mission?.currentStep, `T01 must have a current production step before completion; status=${mission?.status}`);

    const targetFacilityId = mission.currentStep.targetFacilityId ?? null;
    if (targetFacilityId && run.save.scene.facilityId !== targetFacilityId) {
      const move = run.save.movement.find((entry) => entry.destinationFacilityId === targetFacilityId);
      assert.ok(move, `T01 ${mission.currentStep.id} must expose a real move to ${targetFacilityId}`);
      const before = run.save.clock.absoluteMinute;
      run.save = await command(run.svc, run.owner, run.save, 'MOVE', { moveId: move.moveId });
      executed.push(move.moveId);
      run.times.push(run.save.clock.absoluteMinute);
      assert.ok(run.save.clock.absoluteMinute >= before);
      continue;
    }

    const choice = t01VisibleChoice(run.save, mission.currentStep.id);
    assert.ok(choice, `T01 ${mission.currentStep.id} must expose a real mission choice; visible=${run.save.choices.map((entry) => entry.actionId).join(',')}`);
    const before = run.save.clock.absoluteMinute;
    run.save = await chooseAction(run.svc, run.owner, run.save, choice.actionId);
    executed.push(choice.actionId);
    run.times.push(run.save.clock.absoluteMinute);
    assert.ok(run.save.clock.absoluteMinute >= before);
  }
  assert.fail(`T01 did not complete inside the bounded production certificate; executed=${executed.join(' -> ')}`);
}

test('[CHECKPOINT_F_CERT] all three real lodging choices complete E and naturally enter actual T01', async () => {
  for (const lodgingActionId of ['E:LODGE:SLEEP', 'E:LODGE:REGISTER', 'E:LODGE:CONTINUE']) {
    const run = await completeCheckpointE({ lodgingActionId });
    assert.ok(run.save.choices.length > 0 || run.save.movement.length > 0, `${lodgingActionId} must return to ordinary production actions`);
    assert.equal(run.runtime.checkpointEPrologue.complete, true);
    const beforeMinute = run.save.clock.absoluteMinute;
    await discoverT01(run);
    assert.ok(run.save.clock.absoluteMinute >= beforeMinute, `${lodgingActionId} T01 discovery must not rewind time`);
    console.log('[F_CERT_T01_DISCOVERED]', JSON.stringify({
      lodgingActionId,
      minute: run.save.clock.absoluteMinute,
      facilityId: run.save.scene.facilityId,
      choices: run.save.choices.map((entry) => ({ actionId: entry.actionId, label: entry.label, type: entry.type, targetNpcId: entry.targetNpcId ?? null })),
      movement: run.save.movement.map((entry) => ({ moveId: entry.moveId, destinationFacilityId: entry.destinationFacilityId, destination: entry.destination })),
      missions: run.save.missions.map((entry) => ({ id: entry.id, status: entry.status, currentStep: entry.currentStep?.id ?? null })),
    }));
  }
});

test('[CHECKPOINT_F_CERT] shield-only goes from a real REGISTER new game through actual wolf battle, Finn rescue and common return movement', async () => {
  const run = await completeCheckpointE({ lodgingActionId: 'E:LODGE:REGISTER', loadoutId: 'shield' });
  assert.equal(run.runtime.checkpointEPrologue.loan.loadoutId, 'shield');
  assert.equal(run.runtime.playerState.player.equipment.mainHand ?? null, null, 'shield-only must not silently acquire a main-hand weapon');
  assert.ok(run.runtime.playerState.player.equipment.offHand, 'shield-only must actually equip the borrowed shield');
  await discoverT01(run);
  const certificate = await completeActualT01(run);
  const stored = await run.store.get(run.save.id);
  run.runtime = deserializeRuntime(stored.runtimeSnapshot, data);
  assert.ok(certificate.battleRounds > 0, 'T01 must have played an actual interactive battle');
  assert.equal(run.runtime.playerState.worldFlags.t01FinnReturned, true);
  assert.ok(run.runtime.playerState.history.some((entry) => entry.type === 'T01_FINN_ESCORTED_TO_SQUARE'));
  assert.equal(run.runtime.livingWorld.npcStates.NPC001.position.facilityId, 'LOC_FARM_SQUARE');
  assert.equal(run.runtime.livingWorld.npcStates.NPC001.lifeStatus === 'dead', false);
  assert.ok(certificate.executed.includes('ACTION:MSN-T01:rescue'), `actual rescue action missing: ${certificate.executed.join(' -> ')}`);
  assert.ok(certificate.executed.includes('MOVE_LOCAL:LOC_FARM_SQUARE'), `Finn must return through common local movement: ${certificate.executed.join(' -> ')}`);
  assert.equal(certificate.executed.includes('MISSION_FLOW:T01:HUMAN_ENTRY:RETURN_FINN_TO_SQUARE'), false, 'production must not bypass the common movement surface with the legacy authored return action');
  for (let index = 1; index < run.times.length; index += 1) {
    assert.ok(run.times[index] >= run.times[index - 1], `full E→T01 production clock must be monotonic at ${index}: ${run.times[index - 1]} -> ${run.times[index]}`);
  }
  console.log('[F_CERT_SHIELD_T01]', JSON.stringify({
    loadoutId: run.runtime.checkpointEPrologue.loan.loadoutId,
    battleRounds: certificate.battleRounds,
    executed: certificate.executed,
    finalMinute: run.save.clock.absoluteMinute,
    finnReturned: run.runtime.playerState.worldFlags.t01FinnReturned,
    finnFacilityId: run.runtime.livingWorld.npcStates.NPC001.position.facilityId,
    playerEquipment: run.runtime.playerState.player.equipment,
  }));
});
