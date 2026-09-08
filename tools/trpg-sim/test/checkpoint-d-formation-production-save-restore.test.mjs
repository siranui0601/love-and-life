import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createGameRuntime } from '../../../src/server/trpg/game/service.js';
import { loadTrpgGameData } from '../../../src/server/trpg/game/game-data.js';
import { FileTrpgSaveStore } from '../../../src/server/trpg/game/save-store.js';
import { deserializeRuntime, serializeRuntime } from '../../../src/server/trpg/game/serializer.js';
import { createPlayerBuild } from '../lib/battle-model.mjs';
import {
  activeOwnedMagicFormations,
  beginInteractiveBattle,
  clearFormationsOnBattleEnd,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = loadTrpgGameData();

function witnessBuild(skillIds) {
  // PRODUCTION_SAVE_RESTORE_WITNESS only: these durable stats isolate save/resume
  // from unrelated lethality. This witness is explicitly not GAMEPLAY_CERT.
  return createPlayerBuild(data.battleData, {
    id: 'checkpoint-d-formation-production-save',
    name: 'Formation production save/restore witness',
    level: 23,
    equipmentIds: ['EQP-W-0009'],
    skillIds,
    baseStats: {
      maxHp: 100000,
      maxMp: 1000,
      attack: 40,
      defense: 10000,
      agility: 10000,
      luck: 0,
      physicalPower: 20,
      magicPower: 20,
      magicResistance: 10000,
      accuracy: 10000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 10000,
      debuffResistance: 10000,
    },
  });
}

function begin(skillIds, seed) {
  const build = witnessBuild(skillIds);
  const session = beginInteractiveBattle({
    data: data.battleData,
    monsterIds: ['MON-0018'],
    playerBuild: build,
    seed,
    maxTurns: 20,
  });
  return { build, session };
}

function availableCommand(session, selector) {
  const commands = listInteractiveBattleCommands({ data: data.battleData, session });
  const command = selector.startsWith('FORMATION:')
    ? commands.find((entry) => entry.actionId === selector && entry.available !== false)
    : commands.find((entry) => entry.skillId === selector && entry.available !== false);
  assert.ok(command, `available command ${selector}`);
  return command;
}

function resolve(session, selector) {
  const command = availableCommand(session, selector);
  const target = command.targets?.[0];
  const output = resolveInteractiveBattleRound({
    data: data.battleData,
    session,
    command: {
      actionId: command.actionId,
      ...(target ? { targetInstanceId: target.instanceId } : {}),
    },
  });
  assert.equal(output.ok, true, `${selector}: ${output.reason ?? 'failed'}`);
  return output;
}

function saveRecord(id, runtime) {
  const now = '2026-08-25T09:00:00.000Z';
  return {
    id,
    ownerHash: 'checkpoint-d-formation-save-owner',
    schemaVersion: '1.3.0-alpha',
    resolverVersion: 'trpg-player-world-v17',
    contentRevision: 'checkpoint-d',
    playerName: 'Formation save witness',
    profileId: 'balanced',
    tutorialVersion: null,
    revision: 1,
    stateHash: 'checkpoint-d-formation-save-witness',
    createdAt: now,
    updatedAt: now,
    summary: { checkpoint: 'D', witness: 'Formation production save/restore' },
    runtimeSnapshot: serializeRuntime(runtime),
    commandLog: [],
  };
}

async function productionRoundTrip(runtime, id) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'trpg-d-formation-save-'));
  try {
    const store = new FileTrpgSaveStore({ directory });
    await store.put(saveRecord(id, runtime));
    const raw = await store.get(id);
    assert.ok(raw, 'FileTrpgSaveStore must read the record it wrote');
    assert.equal(typeof raw.runtimeSnapshot, 'string');
    return deserializeRuntime(raw.runtimeSnapshot, data);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function attachPendingBattle(runtime, session, build, id) {
  runtime.pendingBattle = {
    id,
    session,
    continuation: {
      prepared: { scaledBuild: build },
      encounterId: null,
    },
  };
}

test('[PRODUCTION_SAVE_RESTORE_WITNESS] Formation survives production file write/read and resumes control/lifecycle semantics', async () => {
  const runtime = createGameRuntime(data, {
    seed: 'checkpoint-d:formation:production-save-runtime',
    profileId: 'balanced',
    playerName: 'D-save',
    tutorial: false,
  });
  const started = begin(['SKL-0640', 'SKL-0653', 'SKL-0654', 'SKL-1108'], 'checkpoint-d:formation:production-save-battle');
  let battle = started.session;

  battle = resolve(battle, 'SKL-0640').session;
  const placed = activeOwnedMagicFormations(battle).find((field) => field.sourceSkillId === 'SKL-0640');
  assert.ok(placed, 'SKL-0640 must place a real player-owned Formation');
  const amplifyAction = availableCommand(battle, `FORMATION:DOUBLE:${placed.instanceId}:AMPLIFY`);
  battle = resolve(battle, amplifyAction.actionId).session;

  const beforeSave = activeOwnedMagicFormations(battle).find((field) => field.instanceId === placed.instanceId);
  assert.ok(beforeSave);
  assert.equal(beforeSave.owner, 'player');
  assert.equal(beforeSave.fieldKind, 'magicFormation');
  assert.equal(beforeSave.sourceSkillId, 'SKL-0640');
  assert.equal(beforeSave.formationFamily, 'wind');
  assert.equal(beforeSave.enhancementLevel, 1);
  assert.equal(beforeSave.dualFormationApplied, true);
  assert.ok(beforeSave.remainingTurns > 0);

  attachPendingBattle(runtime, battle, started.build, 'BATTLE-D-FORMATION-SAVE');
  const restored = await productionRoundTrip(runtime, 'trpg-d-formation-save');
  const restoredBattle = restored.pendingBattle.session;
  const restoredField = activeOwnedMagicFormations(restoredBattle).find((field) => field.instanceId === placed.instanceId);

  assert.ok(restoredField);
  assert.equal(restoredField.owner, beforeSave.owner);
  assert.equal(restoredField.fieldKind, beforeSave.fieldKind);
  assert.equal(restoredField.sourceSkillId, beforeSave.sourceSkillId);
  assert.equal(restoredField.formationFamily, beforeSave.formationFamily);
  assert.equal(restoredField.remainingTurns, beforeSave.remainingTurns);
  assert.equal(restoredField.enhancementLevel, beforeSave.enhancementLevel);
  assert.equal(restoredField.dualFormationApplied, beforeSave.dualFormationApplied);

  const restoredCommands = listInteractiveBattleCommands({ data: data.battleData, session: restoredBattle });
  const sameSource = restoredCommands.find((entry) => entry.skillId === 'SKL-0640');
  assert.equal(sameSource?.available, false);
  assert.equal(sameSource?.disabledReason, 'formation_already_active');
  assert.equal(restoredCommands.some((entry) => entry.actionId.startsWith(`FORMATION:DOUBLE:${restoredField.instanceId}:`)), false,
    'a Formation already enhanced by 二重陣 cannot be enhanced again after restore');
  assert.ok(restoredCommands.some((entry) => entry.actionId === `FORMATION:BREAK:${restoredField.instanceId}` && entry.available !== false),
    '陣崩し target remains available after restore');
  assert.ok(restoredCommands.some((entry) => entry.skillId === 'SKL-1108' && entry.available !== false),
    '陣爆破 remains available for the restored owned Formation');

  const lifecycleFork = deserializeRuntime(serializeRuntime(restored), data).pendingBattle.session;
  const lifecycleBefore = activeOwnedMagicFormations(lifecycleFork).find((field) => field.instanceId === restoredField.instanceId).remainingTurns;
  const defend = listInteractiveBattleCommands({ data: data.battleData, session: lifecycleFork })
    .find((entry) => entry.actionId === 'DEFEND' && entry.available !== false);
  assert.ok(defend);
  const advanced = resolveInteractiveBattleRound({ data: data.battleData, session: lifecycleFork, command: { actionId: 'DEFEND' } });
  assert.equal(advanced.ok, true);
  const lifecycleAfter = activeOwnedMagicFormations(advanced.session).find((field) => field.instanceId === restoredField.instanceId);
  if (lifecycleBefore > 1) {
    assert.ok(lifecycleAfter);
    assert.equal(lifecycleAfter.remainingTurns, lifecycleBefore - 1, 'restored round-end lifecycle decrements exactly once');
  } else {
    assert.equal(lifecycleAfter, undefined, 'restored Formation expires when its final round is consumed');
  }

  const breakFork = deserializeRuntime(serializeRuntime(restored), data).pendingBattle.session;
  const breakOutput = resolve(breakFork, `FORMATION:BREAK:${restoredField.instanceId}`);
  assert.equal(activeOwnedMagicFormations(breakOutput.session).some((field) => field.instanceId === restoredField.instanceId), false);

  const detonationFork = deserializeRuntime(serializeRuntime(restored), data).pendingBattle.session;
  const detonationOutput = resolve(detonationFork, 'SKL-1108');
  assert.equal(activeOwnedMagicFormations(detonationOutput.session).some((field) => field.instanceId === restoredField.instanceId), false);

  const endFork = deserializeRuntime(serializeRuntime(restored), data).pendingBattle.session;
  endFork.status = 'finished';
  endFork.winner = 'fled';
  const cleared = clearFormationsOnBattleEnd(endFork);
  assert.ok(cleared.some((field) => field.instanceId === restoredField.instanceId));
  assert.equal(activeOwnedMagicFormations(endFork).length, 0);
});

test('[PRODUCTION_SAVE_RESTORE_WITNESS] pending delayed Formation effect survives production save and is cancelled by restored detonation', async () => {
  const runtime = createGameRuntime(data, {
    seed: 'checkpoint-d:formation:delayed-save-runtime',
    profileId: 'balanced',
    playerName: 'D-delayed-save',
    tutorial: false,
  });
  const started = begin(['SKL-0650', 'SKL-1108'], 'checkpoint-d:formation:delayed-save-battle');
  let battle = resolve(started.session, 'SKL-0650').session;
  const beforeSave = activeOwnedMagicFormations(battle).find((field) => field.sourceSkillId === 'SKL-0650');
  assert.ok(beforeSave);
  assert.equal(beforeSave.fieldKind, 'magicFormation');
  assert.equal(beforeSave.pendingDelayedEffect?.status, 'pending');

  attachPendingBattle(runtime, battle, started.build, 'BATTLE-D-FORMATION-DELAYED-SAVE');
  const restored = await productionRoundTrip(runtime, 'trpg-d-formation-delay');
  const restoredBattle = restored.pendingBattle.session;
  const restoredField = activeOwnedMagicFormations(restoredBattle).find((field) => field.instanceId === beforeSave.instanceId);
  assert.ok(restoredField);
  assert.deepEqual(restoredField.pendingDelayedEffect, beforeSave.pendingDelayedEffect);

  const output = resolve(restoredBattle, 'SKL-1108');
  const detonation = [...(output.session.playerRuntimeMechanics.events ?? [])].reverse()
    .find((entry) => entry.family === 'CONSUME_OWNED_FIELD' && entry.skillId === 'SKL-1108');
  assert.ok(detonation);
  assert.ok(detonation.cancelledPendingEffects.some((entry) => entry.formationInstanceId === beforeSave.instanceId && entry.status === 'cancelled'));
});
