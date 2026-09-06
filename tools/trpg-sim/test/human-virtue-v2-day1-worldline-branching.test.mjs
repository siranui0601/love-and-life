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
const EVENING_ACTION_IDS = Object.freeze([
  'MISSION_FLOW:T01:EVENING_FREE_TIME:maintain_and_rest',
  'MISSION_FLOW:T01:EVENING_FREE_TIME:help_clear_square',
  'MISSION_FLOW:T01:EVENING_FREE_TIME:sit_with_villagers',
]);

function createService(store) {
  return createCheckpointEPrologueTrpgGameService({ data, store, allowCustomSeed: true, maxSavesPerOwner: 4 });
}

async function command(service, owner, save, type, payload) {
  return (await service.command(owner, save.id, {
    commandId: `hv-v2-day1:${save.revision}:${type}:${JSON.stringify(payload)}`,
    expectedRevision: save.revision,
    type,
    payload,
  })).save;
}

async function choose(service, owner, save, actionId) {
  const visible = save.choices.find((entry) => entry.actionId === actionId);
  assert.ok(visible, `${actionId} must be a visible production choice; visible=${save.choices.map((entry) => entry.actionId).join(',')}`);
  return command(service, owner, save, 'CHOOSE', {
    choiceId: visible.choiceId,
    actionId: visible.actionId,
  });
}

async function move(service, owner, save, moveId) {
  const visible = save.movement.find((entry) => entry.moveId === moveId);
  assert.ok(visible, `${moveId} must be visible production movement; visible=${save.movement.map((entry) => entry.moveId).join(',')}`);
  return command(service, owner, save, 'MOVE', { moveId: visible.moveId });
}

async function acknowledgeEda(service, owner, save) {
  const beat = save.scene?.beats?.find((entry) => entry.actorId === 'NPC004' && entry.introductionToken);
  assert.ok(beat?.introductionToken);
  return command(service, owner, save, 'ACK_NPC_INTRODUCTION', { token: beat.introductionToken });
}

async function finishBattle(service, owner, save) {
  let guard = 0;
  while (save.battle && guard < 80) {
    guard += 1;
    const available = (save.battle.commands ?? []).filter((entry) => entry.available !== false);
    const selected = available.find((entry) => entry.kind === 'attack')
      ?? available.find((entry) => entry.kind === 'skill')
      ?? available.find((entry) => entry.kind === 'defend')
      ?? available[0];
    assert.ok(selected, `battle round ${guard} must expose a production action`);
    const target = selected.targets?.find((entry) => entry.side === 'enemy' && entry.alive !== false)
      ?? selected.targets?.[0]
      ?? null;
    save = await command(service, owner, save, 'BATTLE_ACT', {
      battleId: save.battle.id,
      actionId: selected.actionId,
      ...(target ? { targetInstanceId: target.instanceId } : {}),
    });
  }
  assert.equal(save.battle, null, 'Day1 T01 battle must finish before the evening branch point');
  return save;
}

async function reachDay1EveningBranchPoint() {
  const store = new MemoryTrpgSaveStore();
  const service = createService(store);
  const owner = 'hv-v2-day1-worldline-branching';
  let save = await service.create(owner, { playerName: '人徳v2分岐監査', seed: owner });

  assert.equal(save.scene.facilityId, 'LOC_FARM_EDGE');
  save = await choose(service, owner, save, 'E:EDGE:THANK');
  save = await acknowledgeEda(service, owner, save);
  save = await choose(service, owner, save, 'E:MOVE:WATCH');
  save = await choose(service, owner, save, 'E:BREAD:HELP');
  save = await choose(service, owner, save, 'E:EAT:QUIET');
  save = await choose(service, owner, save, 'E:INV:PLAIN');
  save = await command(service, owner, save, 'TUTORIAL_ACK', { tutorialId: 'checkpoint-e-inventory' });
  save = await choose(service, owner, save, 'E:LOAN:RECORD');

  const catalog = buildCheckpointELoanCatalog(data);
  const loadout = catalog.options.find((entry) => entry.id === 'sword-shield');
  assert.ok(loadout);
  save = await command(service, owner, save, 'SHOP_BORROW', { loanId: 'EINTRO:LOADOUT:sword-shield' });
  for (const equipmentId of loadout.equipmentIds) {
    save = await command(service, owner, save, 'EQUIP', { equipmentId });
  }
  save = await command(service, owner, save, 'TUTORIAL_ACK', { tutorialId: 'checkpoint-e-skills' });
  save = await choose(service, owner, save, 'E:FATIGUE:CHECK');
  save = await choose(service, owner, save, 'E:LODGE:REGISTER');

  save = await choose(service, owner, save, 'DISCOVER_LOCAL_TROUBLE:T01');
  save = await move(service, owner, save, 'MOVE_LOCAL:LOC_FARM_SQUARE');
  save = await choose(service, owner, save, 'ACTION:MSN-T01:hear');
  save = await move(service, owner, save, 'MOVE_LOCAL:LOC_FARM_EDGE');

  // The authored search surface is intentionally evidence-driven and may gain
  // new reviewed clue IDs. Follow only choices that are actually visible in the
  // production panel until the rescue step opens instead of pinning an obsolete
  // clue identifier such as search:tracks.
  for (let guard = 0; guard < 6 && !save.choices.some((entry) => entry.actionId === 'ACTION:MSN-T01:rescue'); guard += 1) {
    const search = save.choices
      .filter((entry) => String(entry.actionId ?? '').startsWith('ACTION:MSN-T01:search:'))
      .sort((left, right) => String(left.actionId).localeCompare(String(right.actionId), 'en'))[0];
    assert.ok(search, `T01 must expose a production search clue before rescue; visible=${save.choices.map((entry) => entry.actionId).join(',')}`);
    save = await choose(service, owner, save, search.actionId);
  }

  save = await choose(service, owner, save, 'ACTION:MSN-T01:rescue');
  save = await finishBattle(service, owner, save);
  save = await choose(service, owner, save, 'ACTION:MSN-T01:escort');
  save = await move(service, owner, save, 'MOVE_LOCAL:LOC_FARM_SQUARE');
  save = await choose(service, owner, save, 'ACTION:MSN-T01:decide');
  save = await choose(service, owner, save, 'MISSION_FLOW:T01:SQUARE_AFTERCARE:help_mira');
  save = await choose(service, owner, save, 'MISSION_FLOW:T01:SQUARE_SUPPER:share_bread');

  assert.equal(save.clock.day, 1);
  assert.equal(save.clock.time, '15:42');
  assert.deepEqual(save.choices.map((entry) => entry.actionId), EVENING_ACTION_IDS);
  return { owner, store, save };
}

async function forkPersistedChoice({ owner, store, save }, actionId) {
  const sourceRecord = await store.get(save.id);
  assert.ok(sourceRecord?.runtimeSnapshot, 'fork must originate from the persisted production save record');

  const forkStore = new MemoryTrpgSaveStore();
  await forkStore.put(sourceRecord);
  let forkService = createService(forkStore);
  let forkSave = await forkService.get(owner, save.id);
  assert.equal(forkSave.stateHash, save.stateHash, 'fork must begin from the exact production state hash');
  forkSave = await choose(forkService, owner, forkSave, actionId);

  const chosenRecord = await forkStore.get(forkSave.id);
  const runtime = deserializeRuntime(chosenRecord.runtimeSnapshot, data);
  const branchState = runtime.playerState.day1T01VillageNight;
  const selectedHistory = runtime.playerState.history.find((entry) => entry.actionId === actionId);
  assert.ok(selectedHistory, `${actionId} must persist a branch-specific history record`);

  // Production save/restore must preserve the divergence. Recreate the service
  // around the same store rather than carrying live runtime objects across the boundary.
  forkService = createService(forkStore);
  const restored = await forkService.get(owner, forkSave.id);
  const restoredRecord = await forkStore.get(restored.id);
  const restoredRuntime = deserializeRuntime(restoredRecord.runtimeSnapshot, data);
  const restoredHistory = restoredRuntime.playerState.history.find((entry) => entry.actionId === actionId);

  return {
    actionId,
    stateHash: restored.stateHash,
    absoluteMinute: restored.clock.absoluteMinute,
    time: restored.clock.time,
    hunger: restored.player.needs.hunger,
    fatigue: restored.player.needs.fatigue,
    selectedActionId: restoredRuntime.playerState.day1T01VillageNight.eveningSelectedActionId,
    closedActionIds: [...restoredRuntime.playerState.day1T01VillageNight.eveningClosedActionIds].sort(),
    historyType: restoredHistory?.type ?? null,
    historyActionId: restoredHistory?.actionId ?? null,
    historyMinute: Number(restoredHistory?.minute ?? -1),
    worldFlags: Object.keys(restoredRuntime.playerState.worldFlags ?? {}).filter((key) => key.startsWith('t01Evening:')).sort(),
    nextSceneId: branchState.nextSceneId,
  };
}

test('[HUMAN_VIRTUE_V2] Day1 evening is one long decision whose three branches persist as different worldlines', async () => {
  const point = await reachDay1EveningBranchPoint();
  const branches = [];
  for (const actionId of EVENING_ACTION_IDS) branches.push(await forkPersistedChoice(point, actionId));

  assert.ok(branches.every((entry) => entry.absoluteMinute === 750));
  assert.ok(branches.every((entry) => entry.time === '22:30'));
  assert.equal(new Set(branches.map((entry) => entry.selectedActionId)).size, 3);
  assert.ok(branches.every((entry) => entry.historyType != null), 'every branch must retain a persisted history event');
  assert.equal(new Set(branches.map((entry) => entry.historyActionId)).size, 3, 'persisted history must identify the three different chosen actions');
  assert.ok(branches.every((entry) => entry.historyActionId === entry.actionId), 'restored history must retain the exact selected action id');
  assert.ok(branches.every((entry) => entry.historyMinute === 750), 'branch history must be stamped at the long action completion time');
  assert.equal(new Set(branches.map((entry) => JSON.stringify(entry.worldFlags))).size, 3);
  assert.equal(new Set(branches.map((entry) => `${entry.hunger}:${entry.fatigue}`)).size, 3);
  assert.equal(new Set(branches.map((entry) => entry.stateHash)).size, 3, 'production save hashes must remain divergent after one branch and restore');

  for (const branch of branches) {
    assert.equal(branch.selectedActionId, branch.actionId);
    assert.deepEqual(branch.closedActionIds, EVENING_ACTION_IDS.filter((id) => id !== branch.actionId).sort());
    assert.equal(branch.nextSceneId, 't01-village-night-after-supper');
  }

  console.log('[HUMAN_VIRTUE_V2_DAY1_EVENING_BRANCHES]', JSON.stringify(branches));
});
