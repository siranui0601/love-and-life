import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTrpgGameData, resetTrpgGameDataForTests } from '../../../src/server/trpg/game/game-data.js';
import { createPlayerBuild, inferPlayerDamageType } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

function probeBuild(data, skillIds = []) {
  return createPlayerBuild(data, {
    id: 'checkpoint-b-special-state-probe',
    name: 'Checkpoint B special-state probe',
    level: 24,
    equipmentIds: [],
    skillIds,
    baseStats: {
      maxHp: 100000,
      maxMp: 1000,
      attack: 0,
      defense: 0,
      agility: 1,
      luck: 0,
      physicalPower: 1,
      magicPower: 1,
      magicResistance: 0,
      accuracy: 10000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 0,
      debuffResistance: -10000,
    },
  });
}

function forceSingleSkill(base, skillId) {
  const monsterId = 'MON-0005';
  const sourceSkill = base.monsterSkillById.get(skillId);
  assert.ok(sourceSkill, `missing canonical source skill ${skillId}`);
  const monsterSkillById = new Map(base.monsterSkillById);
  monsterSkillById.set(skillId, {
    ...sourceSkill,
    mpCost: 0,
    cooldown: 0,
    conditions: [],
  });
  const actionsByMonsterId = new Map(base.actionsByMonsterId);
  actionsByMonsterId.set(monsterId, [{
    id: `CHECKPOINT-B-BEHAVIOR:${skillId}`,
    monsterId,
    monsterName: 'runtime behavior probe',
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

function start(base, skillId, skillIds = [], maxTurns = 2) {
  const data = forceSingleSkill(base, skillId);
  let session = beginInteractiveBattle({
    data,
    monsterIds: ['MON-0005'],
    playerBuild: probeBuild(data, skillIds),
    seed: `checkpoint-b:behavior:${skillId}`,
    maxTurns,
  });
  const enemy = session.state.enemies[0];
  // Executor probes are not balance probes. Give the carrier enough HP to
  // guarantee that a qualifying player hit cannot kill it before reactions.
  enemy.maxHp = Math.max(enemy.maxHp, 100000);
  enemy.hp = enemy.maxHp;
  enemy.maxMp = 1000;
  enemy.mp = 1000;
  enemy.agility = 10000;
  enemy.accuracy = 10000;
  return { data, session };
}

function attackRound(data, session) {
  const attack = listInteractiveBattleCommands({ data, session })
    .find((command) => command.actionId === 'ATTACK' && command.available);
  assert.ok(attack, 'player ATTACK must be available');
  const result = resolveInteractiveBattleRound({
    data,
    session,
    command: { actionId: 'ATTACK', targetInstanceId: attack.targets[0]?.instanceId },
  });
  assert.equal(result.ok, true);
  return result;
}

test('MSK-0052 barrier absorbs a later authoritative hit instead of being display-only', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  const { data, session } = start(battleData, 'MSK-0052');
  const enemy = session.state.enemies[0];
  const hpBefore = enemy.hp;

  const result = attackRound(data, session);
  const resolvedEnemy = result.session.state.enemies[0];
  const barrier = resolvedEnemy.specialStates.get('barrier');

  assert.equal(resolvedEnemy.hp, hpBefore, 'barrier must prevent the low-power direct hit from reducing HP');
  assert.ok(barrier, 'barrier must remain after a low-power absorbed hit');
  assert.ok(Number(barrier.capacity) > 0, 'barrier must keep authoritative remaining capacity');
  assert.ok(Number(barrier.capacity) < resolvedEnemy.maxHp, 'barrier capacity must be a finite combat resource');
});

test('MSK-0055 regeneration produces an authoritative HP tick in the battle round', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  const { data, session } = start(battleData, 'MSK-0055');
  const enemy = session.state.enemies[0];
  enemy.hp = Math.max(1, Math.floor(enemy.maxHp * 0.40));
  const hpBefore = enemy.hp;

  const result = attackRound(data, session);
  const hpAfter = result.session.state.enemies[0].hp;
  assert.ok(hpAfter > hpBefore, `regeneration must out-heal the probe hit (${hpBefore} -> ${hpAfter})`);
});

test('MSK-0054 counter retaliates and MSK-0047 seal changes player command availability', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();

  {
    const { data, session } = start(battleData, 'MSK-0054');
    const hpBefore = session.state.players[0].hp;
    const result = attackRound(data, session);
    const playerAttack = result.round.frames.find((frame) => frame.phase === 'action' && frame.actorSide === 'player');
    assert.ok(Number(playerAttack?.damage ?? 0) > 0, 'counter probe must land a qualifying direct hit');
    assert.ok(result.session.state.players[0].hp < hpBefore, 'counter must damage the attacker after a qualifying direct hit');
  }

  {
    const magicSkill = [...battleData.playerSkills]
      .find((skill) => skill.kind === 'active' && inferPlayerDamageType(skill) === 'magic');
    assert.ok(magicSkill, 'fixture needs one canonical active magic player skill');
    const { data, session } = start(battleData, 'MSK-0047', [magicSkill.id]);
    const result = attackRound(data, session);
    const command = listInteractiveBattleCommands({ data, session: result.session })
      .find((candidate) => candidate.actionId === `SKILL:${magicSkill.id}`);
    assert.ok(command, 'sealed canonical magic skill must still be present in command list');
    assert.equal(command.available, false);
    assert.equal(command.disabledReason, 'sealed');
  }
});
