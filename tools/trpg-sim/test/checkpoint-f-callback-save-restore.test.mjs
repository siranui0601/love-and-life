import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCheckpointELoanCatalog,
  createCheckpointEPrologueTrpgGameService,
} from '../../../src/server/trpg/game/checkpoint-e-prologue-service.js';
import { TrpgGameService } from '../../../src/server/trpg/game/service.js';
import { loadTrpgGameData } from '../../../src/server/trpg/game/game-data.js';
import { MemoryTrpgSaveStore } from '../../../src/server/trpg/game/save-store.js';
import { deserializeRuntime } from '../../../src/server/trpg/game/serializer.js';

const data = loadTrpgGameData();
const CALLBACK_PREFIX = 'MISSION_FLOW:F:REGISTER_CALLBACK:';
const CALLBACK_IDS = Object.freeze([
  `${CALLBACK_PREFIX}ask`,
  `${CALLBACK_PREFIX}wagon`,
  `${CALLBACK_PREFIX}dance`,
]);
const DAY1_AFTERCARE_OPEN_MINUTE = 12 * 60;
const HUMAN_VIRTUE_BEDTIME_MINUTE = 22 * 60 + 30;

function baseService(store) {
  return new TrpgGameService({ data, store, allowCustomSeed: true });
}

function eService(store) {
  return createCheckpointEPrologueTrpgGameService({ data, store, allowCustomSeed: true });
}

async function send(service, owner, save, type, payload) {
  const result = await service.command(owner, save.id, {
    commandId: `f-callback:${save.revision}:${type}:${JSON.stringify(payload)}`,
    expectedRevision: save.revision,
    type,
    payload,
  });
  return result.save;
}

async function choose(service, owner, save, actionId) {
  const visible = save.choices.find((entry) => entry.actionId === actionId);
  assert.ok(visible, `${actionId} must be a visible production action; visible=${save.choices.map((entry) => entry.actionId).join(',')}`);
  const next = await send(service, owner, save, 'CHOOSE', {
    choiceId: visible.choiceId,
    actionId: visible.actionId,
  });
  assert.equal(visible.actionId, actionId, 'the visible actionId must be the executed actionId');
  return next;
}

async function move(service, owner, save, facilityId) {
  const visible = save.movement.find((entry) => entry.destinationFacilityId === facilityId);
  assert.ok(visible, `production movement to ${facilityId} must be visible; movement=${save.movement.map((entry) => `${entry.moveId}:${entry.destinationFacilityId}`).join(',')}`);
  return send(service, owner, save, 'MOVE', { moveId: visible.moveId });
}

async function runtime(store, save) {
  return deserializeRuntime((await store.get(save.id)).runtimeSnapshot, data);
}

function pushTime(times, save, label) {
  const minute = Number(save.clock.absoluteMinute);
  const previous = times.at(-1)?.minute ?? minute;
  assert.ok(minute >= previous, `${label} must not rewind production time: ${previous} -> ${minute}`);
  times.push({ label, minute });
}

async function completeRegisteredE(store, owner, times) {
  const service = eService(store);
  let save = await service.create(owner, { playerName: 'F callback旅人', seed: owner });
  pushTime(times, save, 'E:start');
  save = await choose(service, owner, save, 'E:EDGE:THANK'); pushTime(times, save, 'E:edge');
  const intro = save.scene.beats.find((entry) => entry.actorId === 'NPC004' && entry.introductionToken);
  assert.ok(intro?.introductionToken);
  save = await send(service, owner, save, 'ACK_NPC_INTRODUCTION', { token: intro.introductionToken }); pushTime(times, save, 'E:eda');
  save = await choose(service, owner, save, 'E:MOVE:WITH_EDA'); pushTime(times, save, 'E:move');
  save = await choose(service, owner, save, 'E:BREAD:THANK'); pushTime(times, save, 'E:bread');
  save = await choose(service, owner, save, 'E:EAT:QUIET'); pushTime(times, save, 'E:eat');
  save = await choose(service, owner, save, 'E:INV:PLAIN'); pushTime(times, save, 'E:inventory');
  save = await send(service, owner, save, 'TUTORIAL_ACK', { tutorialId: 'checkpoint-e-inventory' }); pushTime(times, save, 'E:inventory-ack');
  save = await choose(service, owner, save, 'E:LOAN:LOOK'); pushTime(times, save, 'E:loan-look');
  const loadout = buildCheckpointELoanCatalog(data).options.find((entry) => entry.id === 'sword-shield');
  assert.ok(loadout);
  save = await send(service, owner, save, 'SHOP_BORROW', { loanId: 'EINTRO:LOADOUT:sword-shield' }); pushTime(times, save, 'E:borrow');
  for (const equipmentId of loadout.equipmentIds) {
    save = await send(service, owner, save, 'EQUIP', { equipmentId }); pushTime(times, save, `E:equip:${equipmentId}`);
  }
  save = await send(service, owner, save, 'TUTORIAL_ACK', { tutorialId: 'checkpoint-e-skills' }); pushTime(times, save, 'E:skills-ack');
  save = await choose(service, owner, save, 'E:FATIGUE:CHECK'); pushTime(times, save, 'E:fatigue');
  save = await choose(service, owner, save, 'E:LODGE:REGISTER'); pushTime(times, save, 'E:register');
  assert.equal(save.checkpointEPrologue.complete, true);
  const state = await runtime(store, save);
  assert.equal(state.checkpointEPrologue.loan.disposition, 'borrowed_registered');
  return { service, save };
}

function currentT01(save) {
  return save.missions.find((entry) => entry.id === 'MSN-T01') ?? null;
}

async function finishBattle(service, store, owner, save, times) {
  let current = save;
  let rounds = 0;
  while (current.battle && rounds < 160) {
    rounds += 1;
    const persisted = await runtime(store, current);
    assert.equal(persisted.pendingBattle?.session?.state?.players?.length, 1, 'ordinary T01 battle remains player-only');
    const commands = (current.battle.commands ?? []).filter((entry) => entry.available !== false);
    const action = commands.find((entry) => entry.kind === 'attack')
      ?? commands.find((entry) => entry.kind === 'skill')
      ?? commands.find((entry) => entry.kind === 'defend')
      ?? commands[0];
    assert.ok(action, `battle round ${rounds} must expose an action`);
    const target = action.targets?.find((entry) => entry.side === 'enemy' && entry.alive !== false) ?? action.targets?.[0] ?? null;
    current = await send(service, owner, current, 'BATTLE_ACT', {
      battleId: current.battle.id,
      actionId: action.actionId,
      ...(target ? { targetInstanceId: target.instanceId } : {}),
    });
    pushTime(times, current, `T01:battle:${rounds}`);
  }
  assert.equal(current.battle, null);
  assert.ok(rounds > 0);
  return current;
}

async function completeT01(service, store, owner, save, times) {
  let current = await choose(service, owner, save, 'DISCOVER_LOCAL_TROUBLE:T01');
  pushTime(times, current, 'T01:discover');
  for (let guard = 0; guard < 40; guard += 1) {
    if (current.battle) {
      current = await finishBattle(service, store, owner, current, times);
      continue;
    }
    const mission = currentT01(current);
    const state = await runtime(store, current);
    if (['completed', 'resolved'].includes(mission?.status) && state.playerState.worldFlags?.t01FinnReturned === true) return current;
    assert.ok(mission?.currentStep, `T01 current step missing at guard ${guard}`);
    const target = mission.currentStep.targetFacilityId;
    if (target && current.scene.facilityId !== target) {
      current = await move(service, owner, current, target);
      pushTime(times, current, `T01:move:${target}`);
      continue;
    }
    const choices = current.choices.filter((entry) => entry.missionId === 'MSN-T01' && entry.stepId === mission.currentStep.id);
    const priority = {
      hear: ['ACTION:MSN-T01:hear'],
      search: ['ACTION:MSN-T01:search:tracks', 'ACTION:MSN-T01:search:wolf-blockade'],
      rescue: ['ACTION:MSN-T01:rescue'],
      escort: ['ACTION:MSN-T01:escort'],
      decide: ['ACTION:MSN-T01:decide'],
    }[mission.currentStep.id] ?? [];
    const selected = priority.map((id) => choices.find((entry) => entry.actionId === id)).find(Boolean)
      ?? [...choices].sort((a, b) => String(a.actionId).localeCompare(String(b.actionId), 'en'))[0];
    assert.ok(selected, `T01 ${mission.currentStep.id} choice missing`);
    current = await choose(service, owner, current, selected.actionId);
    pushTime(times, current, `T01:${selected.actionId}`);
  }
  assert.fail('T01 did not complete in bounded production certificate');
}

function callbackChoices(save) {
  return save.choices.filter((entry) => entry.actionId?.startsWith(CALLBACK_PREFIX));
}

function safeTimeAdvanceChoices(save) {
  return save.choices
    .filter((entry) => entry.actionId?.startsWith('LIFE:REST:')
      || entry.actionId?.startsWith('INSPECT:')
      || entry.actionId?.startsWith('WAIT:')
      || entry.actionId?.startsWith('OBSERVE:')
      || entry.actionId?.startsWith('REST_OUTDOOR:')
      || entry.actionId === 'TUTORIAL:PAUSE:PLAN')
    .filter((entry) => Number(entry.minutes ?? 0) > 0);
}

async function advanceProductionTime(service, owner, save, times, {
  untilActionId = null,
  minimumMinute = null,
  latestMinute = null,
  label,
}) {
  let current = save;
  for (let guard = 0; guard < 64; guard += 1) {
    const minute = Number(current.clock.absoluteMinute);
    const actionVisible = !untilActionId || current.choices.some((entry) => entry.actionId === untilActionId);
    const timeReached = minimumMinute == null || minute >= minimumMinute;
    if (actionVisible && timeReached) return current;

    const candidates = safeTimeAdvanceChoices(current);
    const before = minute;
    if (candidates.length) {
      const remaining = minimumMinute == null ? Infinity : Math.max(0, minimumMinute - minute);
      const withinRemaining = candidates
        .filter((entry) => Number(entry.minutes) <= remaining)
        .sort((a, b) => Number(b.minutes) - Number(a.minutes));
      const selected = withinRemaining[0]
        ?? [...candidates].sort((a, b) => Number(a.minutes) - Number(b.minutes))[0];
      current = await choose(service, owner, current, selected.actionId);
      pushTime(times, current, `time-authority:${selected.actionId}`);
    } else {
      const movements = [...current.movement]
        .filter((entry) => entry.moveId && entry.destinationFacilityId !== current.scene.facilityId)
        .sort((a, b) => String(a.moveId).localeCompare(String(b.moveId), 'en'));
      assert.ok(movements.length, `no ordinary production time action or movement while waiting for ${label}; minute=${minute}; choices=${current.choices.map((entry) => entry.actionId).join(',')}; movement=${current.movement.map((entry) => `${entry.moveId}:${entry.destinationFacilityId}`).join(',')}`);
      const toSquare = movements.find((entry) => entry.destinationFacilityId === 'LOC_FARM_SQUARE');
      const selectedMove = current.scene.facilityId !== 'LOC_FARM_SQUARE' && toSquare
        ? toSquare
        : movements[0];
      current = await send(service, owner, current, 'MOVE', { moveId: selectedMove.moveId });
      pushTime(times, current, `time-authority:${selectedMove.moveId}`);
    }
    const after = Number(current.clock.absoluteMinute);
    assert.ok(after > before, `production action must advance time while waiting for ${label}: ${before} -> ${after}`);
    if (latestMinute != null) assert.ok(after <= latestMinute, `${label} time advancement must stay inside Day1 window: ${after} > ${latestMinute}`);
  }
  assert.fail(`${label} not reached through bounded production commands; minute=${current.clock.absoluteMinute}`);
}

async function reachCallback(service, store, owner, save, times) {
  let current = save;
  const t01CompletedAtMinute = Number(current.clock.absoluteMinute);
  current = await advanceProductionTime(service, owner, current, times, {
    untilActionId: 'MISSION_FLOW:T01:SQUARE_AFTERCARE:help_mira',
    minimumMinute: DAY1_AFTERCARE_OPEN_MINUTE,
    latestMinute: 1439,
    label: 'Day1 aftercare',
  });
  const aftercareVisibleAtMinute = Number(current.clock.absoluteMinute);
  assert.ok(aftercareVisibleAtMinute >= DAY1_AFTERCARE_OPEN_MINUTE, `Day1 aftercare must obey the production noon gate; minute=${aftercareVisibleAtMinute}`);
  assert.ok(aftercareVisibleAtMinute >= t01CompletedAtMinute, 'waiting for aftercare must not rewind time');

  for (const actionId of [
    'MISSION_FLOW:T01:SQUARE_AFTERCARE:help_mira',
    'MISSION_FLOW:T01:SQUARE_SUPPER:share_bread',
  ]) {
    current = await choose(service, owner, current, actionId);
    pushTime(times, current, actionId);
  }

  current = await advanceProductionTime(service, owner, current, times, {
    untilActionId: 'MISSION_FLOW:T01:VILLAGE_NIGHT:sleep_at_miras',
    minimumMinute: HUMAN_VIRTUE_BEDTIME_MINUTE,
    latestMinute: 1439,
    label: 'Human Virtue 22:30 bedtime',
  });
  const sleepStartedAtMinute = Number(current.clock.absoluteMinute);
  assert.ok(sleepStartedAtMinute >= HUMAN_VIRTUE_BEDTIME_MINUTE && sleepStartedAtMinute < 1440);

  for (const actionId of [
    'MISSION_FLOW:T01:VILLAGE_NIGHT:sleep_at_miras',
    'MISSION_FLOW:T01:DAY2_MERCHANT:help_unload',
    'MISSION_FLOW:T01:DAY2_MERCHANT_PAYMENT:take_three_gold',
    'MISSION_FLOW:T01:DAY2_MERCHANT_STALL:take_hunter_parcel',
    'MISSION_FLOW:T01:DAY2_MERCHANT_FOLLOWUP:t01-day2-hunter-parcel:leave_with_chief',
  ]) {
    current = await choose(service, owner, current, actionId);
    pushTime(times, current, actionId);
  }

  assert.ok(current.clock.day >= 2, `callback route must pass into Day2; day=${current.clock.day}`);
  console.log('[F_CALLBACK_AFTERCARE_TIME]', JSON.stringify({
    t01CompletedAtMinute,
    aftercareOpenMinute: DAY1_AFTERCARE_OPEN_MINUTE,
    aftercareVisibleAtMinute,
    humanVirtueBedtimeMinute: HUMAN_VIRTUE_BEDTIME_MINUTE,
    sleepStartedAtMinute,
    day2Minute: current.clock.absoluteMinute,
    productionTimeAdvanceActions: times.filter((entry) => entry.label.startsWith('time-authority:')),
  }));

  for (let guard = 0; guard < 24; guard += 1) {
    const callbacks = callbackChoices(current);
    if (callbacks.length) return current;
    if (current.scene.facilityId !== 'LOC_FARM_SQUARE') {
      const toSquare = current.movement.find((entry) => entry.destinationFacilityId === 'LOC_FARM_SQUARE');
      if (toSquare) {
        current = await send(service, owner, current, 'MOVE', { moveId: toSquare.moveId });
        pushTime(times, current, 'callback:move-square');
        continue;
      }
    }
    const advances = safeTimeAdvanceChoices(current).sort((a, b) => Number(b.minutes) - Number(a.minutes));
    if (advances[0]) {
      current = await choose(service, owner, current, advances[0].actionId);
      pushTime(times, current, `callback:${advances[0].actionId}`);
      continue;
    }
    assert.fail(`no safe production time-advance action while waiting for callback; minute=${current.clock.absoluteMinute}; facility=${current.scene.facilityId}; choices=${current.choices.map((entry) => entry.actionId).join(',')}`);
  }
  const state = await runtime(store, current);
  assert.fail(`REGISTER callback did not appear; minute=${current.clock.absoluteMinute}; goap=${JSON.stringify(state.playerState.goapRequests?.['GOAP-F-RIONA-VERIFY-REGISTERED-RESCUER'] ?? null)}; riona=${JSON.stringify(state.livingWorld.npcStates.NPC008?.position ?? null)}`);
}

test('[CHECKPOINT_F_CALLBACK] production REGISTER callback survives save/restore, keeps exactly three choices, answers once and never redisplays', async () => {
  const store = new MemoryTrpgSaveStore();
  const owner = 'f-callback-production-save-restore';
  const times = [];
  const opening = await completeRegisteredE(store, owner, times);
  let service = opening.service;
  let save = await completeT01(service, store, owner, opening.save, times);
  save = await reachCallback(service, store, owner, save, times);

  let persisted = await runtime(store, save);
  const registerRecord = Object.values(persisted.playerState.worldRecords ?? {}).find((entry) => entry.type === 'inn-register');
  assert.ok(registerRecord, 'REGISTER must persist a Wheat Inn guestbook record');
  assert.ok(persisted.playerState.history.some((entry) => entry.type === 'F_T01_REGISTERED_RESCUER_IDENTIFIED'));
  const share = persisted.livingWorld.knowledgeEvents.find((entry) => entry.type === 'share' && entry.sourceNpcId === 'NPC058' && entry.npcId === 'NPC008' && entry.factId === 'F-FACT-REGISTERED-FINN-RESCUER');
  assert.ok(share, 'Riona must receive the REGISTER/T01 fact from Lorna through a real common interaction');
  assert.equal(persisted.playerState.goapRequests['GOAP-F-RIONA-VERIFY-REGISTERED-RESCUER']?.status, 'completed');
  assert.ok(persisted.livingWorld.npcStates.NPC008.completedAftermathPlanIds.includes('GOAP-F-RIONA-VERIFY-REGISTERED-RESCUER'));

  const firstChoices = callbackChoices(save);
  assert.equal(firstChoices.length, 3);
  assert.deepEqual(firstChoices.map((entry) => entry.actionId).sort(), [...CALLBACK_IDS].sort());
  assert.equal(firstChoices.find((entry) => entry.actionId.endsWith(':dance'))?.label, 'なぜか二歩だけ踊り、何事もなかった顔で立ち止まる');
  const greetingBeforeRestore = persisted.playerState.history.filter((entry) => entry.type === 'F_RIONA_AMBIENT_GREETING_OBSERVED');
  assert.equal(greetingBeforeRestore.length, 1, 'greeting must exist exactly once before restore');
  const interactionId = greetingBeforeRestore[0].interactionEventId;
  assert.ok(interactionId);

  service = baseService(store);
  save = await service.get(owner, save.id);
  const restoredChoices = callbackChoices(save);
  assert.equal(restoredChoices.length, 3);
  assert.deepEqual(restoredChoices.map((entry) => ({ actionId: entry.actionId, label: entry.label })), firstChoices.map((entry) => ({ actionId: entry.actionId, label: entry.label })));
  persisted = await runtime(store, save);
  assert.equal(persisted.playerState.history.filter((entry) => entry.type === 'F_RIONA_AMBIENT_GREETING_OBSERVED').length, 1, 'restore must not duplicate greeting history');
  assert.equal(persisted.livingWorld.interactionEvents.filter((entry) => entry.id === interactionId).length, 1, 'restore must not duplicate the common conversation event');

  save = await choose(service, owner, save, `${CALLBACK_PREFIX}ask`);
  pushTime(times, save, 'callback:ask');
  persisted = await runtime(store, save);
  assert.ok(persisted.playerState.history.some((entry) => entry.type === 'F_REGISTER_RUMOR_CALLBACK_HEARD'));
  assert.equal(callbackChoices(save).length, 0, 'answered callback must close immediately');

  service = baseService(store);
  save = await service.get(owner, save.id);
  persisted = await runtime(store, save);
  assert.equal(callbackChoices(save).length, 0, 'answered callback must remain closed after a second restore');
  assert.equal(persisted.playerState.history.filter((entry) => entry.type === 'F_RIONA_AMBIENT_GREETING_OBSERVED').length, 1);
  assert.equal(persisted.playerState.history.filter((entry) => entry.type === 'F_REGISTER_RUMOR_CALLBACK_HEARD').length, 1);

  for (let index = 1; index < times.length; index += 1) {
    assert.ok(times[index].minute >= times[index - 1].minute, `production time must be monotonic: ${times[index - 1].label}@${times[index - 1].minute} -> ${times[index].label}@${times[index].minute}`);
  }
  console.log('[F_CERT_REGISTER_CALLBACK]', JSON.stringify({
    registerRecordId: registerRecord.id,
    shareEventId: share.id,
    greetingInteractionEventId: interactionId,
    callbackActionIds: CALLBACK_IDS,
    firstMinute: times[0].minute,
    finalMinute: save.clock.absoluteMinute,
    finalDay: save.clock.day,
  }));
});
