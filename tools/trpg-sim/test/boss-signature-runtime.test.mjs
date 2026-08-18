import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTrpgGameData, resetTrpgGameDataForTests } from '../../../src/server/trpg/game/game-data.js';
import { createPlayerBuild } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const BOSS_IDS = Object.freeze([
  'MON-0007', 'MON-0015', 'MON-0016', 'MON-0017', 'MON-0018',
  'MON-0028', 'MON-0063', 'MON-0064', 'MON-0077',
]);

function probeBuild(data, skillIds = [], agility = 1) {
  return createPlayerBuild(data, {
    id: 'checkpoint-b-boss-signature-probe',
    name: 'Checkpoint B boss signature probe',
    level: 24,
    equipmentIds: [],
    skillIds,
    baseStats: {
      maxHp: 1_000_000,
      maxMp: 10_000,
      attack: 0,
      defense: 100,
      agility,
      luck: 0,
      physicalPower: 1,
      magicPower: 1,
      magicResistance: 100,
      accuracy: 10_000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 10_000,
      debuffResistance: -10_000,
    },
  });
}

function actionWithCommand(data, monsterId, predicate) {
  return (data.actionsByMonsterId.get(monsterId) ?? []).find((action) => {
    const skill = data.monsterSkillById.get(action.skillId);
    return (skill?.commands ?? []).some(predicate);
  });
}

function forceCanonicalAction(base, monsterId, action) {
  assert.ok(action, `${monsterId}: authored signature action must exist`);
  const actionsByMonsterId = new Map(base.actionsByMonsterId);
  // Executor certification: preserve the canonical skill and command payload,
  // while isolating one authored action from selection RNG/phase conditions.
  actionsByMonsterId.set(monsterId, [{
    ...action,
    baseWeight: 100,
    priority: 999,
    condition: null,
    usesPerBattle: null,
    cooldownOverride: 0,
  }]);
  return { ...base, actionsByMonsterId };
}

function start(base, monsterId, action, { skillIds = [], playerAgility = 1, enemyAgility = 10_000 } = {}) {
  const data = forceCanonicalAction(base, monsterId, action);
  const session = beginInteractiveBattle({
    data,
    monsterIds: [monsterId],
    playerBuild: probeBuild(data, skillIds, playerAgility),
    seed: `checkpoint-b:boss-signature:${monsterId}:${action.skillId}`,
    maxTurns: 4,
  });
  const enemy = session.state.enemies[0];
  enemy.maxMp = Math.max(enemy.maxMp, 10_000);
  enemy.mp = enemy.maxMp;
  enemy.agility = enemyAgility;
  enemy.accuracy = 10_000;
  enemy.debuffSuccess = 10_000;
  return { data, session };
}

function attackCommand(data, session) {
  const command = listInteractiveBattleCommands({ data, session })
    .find((candidate) => candidate.actionId === 'ATTACK' && candidate.available);
  assert.ok(command, 'ATTACK must be available');
  return { actionId: 'ATTACK', targetInstanceId: command.targets[0]?.instanceId };
}

function skillCommand(data, session, skillId) {
  const command = listInteractiveBattleCommands({ data, session })
    .find((candidate) => candidate.actionId === `SKILL:${skillId}` && candidate.available);
  assert.ok(command, `${skillId} must be available`);
  return { actionId: command.actionId, targetInstanceId: command.targets[0]?.instanceId };
}

function resolve(data, session, command = attackCommand(data, session)) {
  const result = resolveInteractiveBattleRound({ data, session, command });
  assert.equal(result.ok, true);
  return result;
}

function enemyFrame(result, kind = 'skill') {
  return result.round.frames.find((frame) => frame.actorSide === 'enemy' && frame.action?.kind === kind);
}

function eventOf(frame, type) {
  return (frame?.events ?? []).find((event) => event?.type === type);
}

function telegraphThenExecute(base, monsterId, action) {
  const { data, session } = start(base, monsterId, action);
  const first = resolve(data, session);
  const telegraph = enemyFrame(first, 'telegraph');
  assert.ok(telegraph, `${monsterId}: signature must enter telegraph state`);
  assert.equal(first.session.state.enemies[0].pendingIntent?.skillId, action.skillId);
  const second = resolve(data, first.session);
  const execution = enemyFrame(second, 'skill');
  assert.ok(execution, `${monsterId}: telegraphed signature must execute on the following action`);
  assert.equal(execution.action.skillId, action.skillId);
  assert.equal(second.session.state.enemies[0].pendingIntent, null);
  return { data, first, second, telegraph, execution };
}

test('all nine boss catalog entries remain production-connected and telegraph is explicitly non-universal', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  assert.deepEqual([...battleData.bossByMonsterId.keys()].sort(), [...BOSS_IDS].sort());

  const policies = Object.fromEntries(BOSS_IDS.map((monsterId) => [
    monsterId,
    (battleData.bossByMonsterId.get(monsterId)?.telegraphs ?? []).map((entry) => entry.skillId),
  ]));
  assert.deepEqual(policies['MON-0007'], []);
  assert.deepEqual(policies['MON-0015'], []);
  assert.deepEqual(policies['MON-0016'], []);
  assert.ok(policies['MON-0017'].includes('MSK-0069'));
  assert.ok(policies['MON-0018'].includes('MSK-0069'));
  assert.ok(policies['MON-0028'].includes('MSK-0020'));
  assert.ok(policies['MON-0063'].includes('MSK-0073'));
  assert.ok(policies['MON-0064'].includes('MSK-0073'));
  assert.ok(policies['MON-0077'].includes('MSK-0095'));
});

test('each hand-authored boss signature changes authoritative production battle state', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  const records = [];

  // MON-0007: pack commander replenishes the pack.
  {
    const action = actionWithCommand(battleData, 'MON-0007', (command) => command.command === 'SUMMON_UNIT');
    const { data, session } = start(battleData, 'MON-0007', action);
    const before = session.state.enemies.length;
    const result = resolve(data, session);
    const frame = enemyFrame(result);
    const summon = eventOf(frame, 'summon');
    assert.ok(summon?.summoned?.length > 0, 'MON-0007 must actually summon a pack member');
    assert.ok(result.session.state.enemies.length > before);
    records.push({ monsterId: 'MON-0007', signature: 'pack_reinforcement', skillId: action.skillId, passed: true });
  }

  // MON-0015: early king slime raises the authored magic-absorption membrane.
  {
    const action = actionWithCommand(battleData, 'MON-0015', (command) => (
      command.command === 'APPLY_SPECIAL_STATE' && (command.stateId ?? command.type) === 'magic_absorb'
    ));
    const { data, session } = start(battleData, 'MON-0015', action);
    const result = resolve(data, session);
    assert.ok(result.session.state.enemies[0].specialStates.has('magic_absorb'));
    records.push({ monsterId: 'MON-0015', signature: 'magic_absorb_membrane', skillId: action.skillId, passed: true });
  }

  // MON-0016: swollen form consumes the river as an authoritative field stack.
  {
    const action = actionWithCommand(battleData, 'MON-0016', (command) => (
      command.command === 'MODIFY_FIELD' && command.fieldEffect === 'river_drain'
    ));
    const { data, session } = start(battleData, 'MON-0016', action);
    const result = resolve(data, session);
    assert.ok(Number(result.session.state.fieldEffects.get('river_drain')?.stacks ?? 0) > 0);
    records.push({ monsterId: 'MON-0016', signature: 'river_drain', skillId: action.skillId, passed: true });
  }

  // MON-0017: giant form warns, stores pending intent, then executes World-Tree Drain Life.
  {
    const action = (battleData.actionsByMonsterId.get('MON-0017') ?? []).find((candidate) => candidate.skillId === 'MSK-0069');
    const result = telegraphThenExecute(battleData, 'MON-0017', action);
    assert.ok(Number(result.execution.damage ?? 0) > 0);
    records.push({ monsterId: 'MON-0017', signature: 'telegraphed_world_tree_drain', skillId: action.skillId, passed: true });
  }

  // MON-0018: final slime form uses the same authored drain as a deliberate telegraphed resource cycle.
  {
    const action = (battleData.actionsByMonsterId.get('MON-0018') ?? []).find((candidate) => candidate.skillId === 'MSK-0069');
    const result = telegraphThenExecute(battleData, 'MON-0018', action);
    assert.ok(Number(result.execution.damage ?? 0) > 0);
    records.push({ monsterId: 'MON-0018', signature: 'telegraphed_world_tree_drain', skillId: action.skillId, passed: true });
  }

  // MON-0028: Hollow Hero copies the player's immediately preceding repeatable skill.
  {
    const action = actionWithCommand(battleData, 'MON-0028', (command) => command.command === 'COPY_LAST_ENEMY_SKILL');
    const { data, session } = start(battleData, 'MON-0028', action, {
      skillIds: ['SKL-0001'], playerAgility: 10_000, enemyAgility: 1,
    });
    const result = resolve(data, session, skillCommand(data, session, 'SKL-0001'));
    const frame = enemyFrame(result);
    const copy = eventOf(frame, 'copy_skill');
    assert.equal(copy?.copiedSkillId, 'SKL-0001');
    assert.ok(Number(frame?.damage ?? 0) > 0);
    records.push({ monsterId: 'MON-0028', signature: 'copy_last_player_skill', skillId: action.skillId, passed: true });
  }

  // MON-0063: sealed colossus can actually seal the player's magic channel.
  {
    const action = actionWithCommand(battleData, 'MON-0063', (command) => (
      command.command === 'APPLY_SPECIAL_STATE' && (command.stateId ?? command.type) === 'seal'
    ));
    const { data, session } = start(battleData, 'MON-0063', action);
    const result = resolve(data, session);
    assert.ok(result.session.state.players[0].specialStates.has('seal'));
    records.push({ monsterId: 'MON-0063', signature: 'seal_wave', skillId: action.skillId, passed: true });
  }

  // MON-0064: awakened colossus' last stand is a real survive-lethal charge, not flavor text.
  {
    const action = actionWithCommand(battleData, 'MON-0064', (command) => (
      command.command === 'APPLY_SPECIAL_STATE' && ['surviveFatal', 'survive_lethal'].includes(command.stateId ?? command.type)
    ));
    const { data, session } = start(battleData, 'MON-0064', action);
    const result = resolve(data, session);
    const state = result.session.state.enemies[0].specialStates.get('survive_lethal');
    assert.ok(Number(state?.charges ?? 0) >= 1);
    records.push({ monsterId: 'MON-0064', signature: 'last_stand_survive_lethal', skillId: action.skillId, passed: true });
  }

  // MON-0077: the captain's breakthrough order is prediction -> pending -> execution.
  {
    const action = (battleData.actionsByMonsterId.get('MON-0077') ?? []).find((candidate) => candidate.skillId === 'MSK-0095');
    const result = telegraphThenExecute(battleData, 'MON-0077', action);
    assert.ok(Number(result.execution.damage ?? 0) > 0);
    records.push({ monsterId: 'MON-0077', signature: 'telegraphed_breakthrough_order', skillId: action.skillId, passed: true });
  }

  assert.equal(records.length, 9);
  assert.equal(records.filter((record) => record.passed).length, 9);
  console.log(`BOSS_SIGNATURE_RUNTIME ${JSON.stringify(records)}`);
});
