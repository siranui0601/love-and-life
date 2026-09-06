import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTrpgGameData, resetTrpgGameDataForTests } from '../../../src/server/trpg/game/game-data.js';
import { createPlayerBuild } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

function playerBuild(data) {
  return createPlayerBuild(data, {
    id: 'checkpoint-b-telegraph-cancel-probe',
    name: 'Checkpoint B telegraph cancel probe',
    level: 24,
    equipmentIds: [],
    skillIds: [],
    baseStats: {
      maxHp: 100000,
      maxMp: 1000,
      attack: 0,
      defense: 100,
      agility: 1,
      luck: 0,
      physicalPower: 1,
      magicPower: 1,
      magicResistance: 100,
      accuracy: 10000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 0,
      debuffResistance: 0,
    },
  });
}

function forcedInterruptData(base) {
  const monsterId = 'MON-0005';
  const skillId = 'MSK-0086';
  const sourceSkill = base.monsterSkillById.get(skillId);
  assert.ok(sourceSkill, 'canonical interrupt skill MSK-0086 must exist');
  assert.ok(sourceSkill.commands.some((command) => command.command === 'INTERRUPT_CAST'));

  const monsterSkillById = new Map(base.monsterSkillById);
  monsterSkillById.set(skillId, {
    ...sourceSkill,
    mpCost: 0,
    cooldown: 0,
    conditions: [],
    commands: sourceSkill.commands.map((command) => (
      command.command === 'INTERRUPT_CAST' ? { ...command, baseChance: 10000 } : { ...command }
    )),
  });
  const actionsByMonsterId = new Map(base.actionsByMonsterId);
  actionsByMonsterId.set(monsterId, [{
    id: 'CHECKPOINT-B:TELEGRAPH-CANCEL',
    monsterId,
    monsterName: 'telegraph cancel probe',
    skillId,
    skillName: sourceSkill.name,
    baseWeight: 100,
    condition: null,
    priority: 999,
    usesPerBattle: null,
    cooldownOverride: 0,
    targetPolicy: 'resolver_default',
  }]);
  return { ...base, monsterSkillById, actionsByMonsterId };
}

test('INTERRUPT_CAST cancels an authoritative pending telegraph intent, not only casting state', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  const data = forcedInterruptData(battleData);
  let session = beginInteractiveBattle({
    data,
    monsterIds: ['MON-0005'],
    playerBuild: playerBuild(data),
    seed: 'checkpoint-b:telegraph-interrupt-cancel',
    maxTurns: 1,
  });

  const player = session.state.players[0];
  const enemy = session.state.enemies[0];
  player.pendingIntent = {
    actionId: 'CHECKPOINT-B:PENDING-ACTION',
    skillId: 'CHECKPOINT-B:PENDING-SKILL',
    telegraph: 'probe telegraph',
    counterplayHint: 'interrupt',
  };
  assert.equal(player.specialStates.has('casting'), false, 'probe must prove pending-intent cancellation independently of casting');
  enemy.agility = 10000;
  enemy.maxMp = 1000;
  enemy.mp = 1000;

  const attack = listInteractiveBattleCommands({ data, session })
    .find((command) => command.actionId === 'ATTACK' && command.available);
  assert.ok(attack);
  const result = resolveInteractiveBattleRound({
    data,
    session,
    command: { actionId: 'ATTACK', targetInstanceId: attack.targets[0]?.instanceId },
  });
  assert.equal(result.ok, true);

  const frame = result.round.frames.find((candidate) => (
    candidate.actorSide === 'enemy' && candidate.action?.skillId === 'MSK-0086'
  ));
  assert.ok(frame, 'canonical interrupt skill must execute through production battle resolution');
  const interrupt = (frame.events ?? []).find((event) => event.type === 'interrupt');
  assert.ok(interrupt, 'interrupt event must be emitted');
  const target = interrupt.results?.[0];
  assert.equal(target?.wasCasting, false);
  assert.equal(target?.wasTelegraphPending, true);
  assert.equal(target?.pendingActionId, 'CHECKPOINT-B:PENDING-ACTION');
  assert.equal(target?.pendingSkillId, 'CHECKPOINT-B:PENDING-SKILL');
  assert.equal(target?.succeeded, true);
  assert.equal(target?.cancelledPendingIntent, true);
  assert.equal(result.session.state.players[0].pendingIntent, null);
});
