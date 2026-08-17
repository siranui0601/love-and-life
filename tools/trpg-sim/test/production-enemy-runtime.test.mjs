import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTrpgGameData, resetTrpgGameDataForTests } from '../../../src/server/trpg/game/game-data.js';
import { createPlayerBuild } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';
import { auditEnemyActionReachability } from '../lib/enemy-action-audit.mjs';

const EXPECTED_BOSSES = [
  'MON-0007', 'MON-0015', 'MON-0016', 'MON-0017', 'MON-0018',
  'MON-0028', 'MON-0063', 'MON-0064', 'MON-0077',
];

function mechanicsProbeBuild(data, monsterId) {
  return createPlayerBuild(data, {
    id: `enemy-runtime-probe-${monsterId}`,
    name: 'Enemy runtime mechanics probe',
    level: 24,
    equipmentIds: [],
    skillIds: [],
    baseStats: {
      maxHp: 100000,
      maxMp: 1000,
      attack: 0,
      defense: 10000,
      agility: 1,
      luck: 1,
      physicalPower: 1,
      magicPower: 1,
      magicResistance: 10000,
      accuracy: 100,
      evasion: 0,
      critical: 0,
      debuffSuccess: 0,
      debuffResistance: 10000,
    },
  });
}

function runBossSmoke(data, monsterId) {
  let session = beginInteractiveBattle({
    data,
    monsterIds: [monsterId],
    playerBuild: mechanicsProbeBuild(data, monsterId),
    seed: `production-enemy-runtime-smoke:${monsterId}`,
    maxTurns: 6,
  });
  let result = null;
  while (session.status === 'active') {
    const commands = listInteractiveBattleCommands({ data, session });
    const attack = commands.find((command) => command.actionId === 'ATTACK' && command.available);
    assert.ok(attack, `${monsterId}: ATTACK must remain available to mechanics probe`);
    const resolved = resolveInteractiveBattleRound({
      data,
      session,
      command: {
        actionId: attack.actionId,
        targetInstanceId: attack.targets[0]?.instanceId,
      },
    });
    assert.equal(resolved.ok, true, `${monsterId}: interactive round must resolve`);
    session = resolved.session;
    result = resolved.result;
  }
  assert.ok(result, `${monsterId}: smoke must terminate at bounded turn cap`);
  return result;
}

test('production battle data is canonical rev20 content with boss runtime catalog attached', () => {
  resetTrpgGameDataForTests();
  const gameData = loadTrpgGameData();
  assert.deepEqual(
    {
      equipment: gameData.counts.equipment,
      stock: gameData.counts.stock,
      materialBuyback: gameData.counts.materialBuyback,
      monsters: gameData.counts.monsters,
      monsterSkills: gameData.counts.monsterSkills,
      monsterActions: gameData.counts.monsterActions,
      encounters: gameData.counts.encounters,
      skills: gameData.counts.skills,
      bosses: gameData.counts.bosses,
    },
    {
      equipment: 142,
      stock: 149,
      materialBuyback: 61,
      monsters: 77,
      monsterSkills: 96,
      monsterActions: 286,
      encounters: 76,
      skills: 1141,
      bosses: 9,
    },
  );
  assert.deepEqual([...gameData.battleData.bossByMonsterId.keys()].sort(), EXPECTED_BOSSES);
  assert.deepEqual(gameData.battleData.audit.bossesMissingCombatCatalog, []);
  assert.deepEqual(gameData.battleData.audit.bossCatalogIssues, []);
});

test('all 286 enemy actions receive a deterministic reachability classification with UNKNOWN=0', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  const audit = auditEnemyActionReachability(battleData);
  console.log(`ENEMY_ACTION_AUDIT ${JSON.stringify({ total: audit.total, unknown: audit.unknown, counts: audit.counts })}`);
  assert.equal(audit.total, 286);
  assert.equal(audit.unknown, 0);
  assert.equal(Object.values(audit.counts).reduce((sum, count) => sum + count, 0), 286);
});

test('production battle data has exactly the 14 authored enemy command families and no unresolved runtime family', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  const commandFamilies = [...new Set(battleData.monsterSkills.flatMap((skill) => skill.commands.map((command) => command.command)))].sort();
  console.log(`ENEMY_COMMAND_FAMILIES ${JSON.stringify(commandFamilies)}`);
  assert.equal(commandFamilies.length, 14);
  assert.deepEqual(battleData.audit.unknownCommands, []);
  assert.deepEqual(battleData.audit.unknownSpecialStateSemantics, []);
  assert.deepEqual(battleData.audit.unknownDebuffSemantics, []);
});

test('all 9 canonical bosses execute authored enemy skills in production battle data without corrupt fallback', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  const records = EXPECTED_BOSSES.map((monsterId) => {
    const result = runBossSmoke(battleData, monsterId);
    const enemyFrames = result.timeline.frames.filter((frame) => frame.phase === 'action' && frame.actorSide === 'enemy');
    const authoredSkillUses = enemyFrames.filter((frame) => frame.action?.kind === 'skill');
    const gimmickEvents = enemyFrames.flatMap((frame) => frame.events ?? []).filter((event) => [
      'phase_transition', 'telegraph', 'summon', 'field_change', 'copy_skill', 'escape', 'interrupt',
    ].includes(event.type));
    return {
      monsterId,
      enemySkillUses: authoredSkillUses.length,
      gimmickInteractions: gimmickEvents.length,
      candidateExhaustion: result.candidateExhaustion,
      fallbackAttacks: result.fallbackAttacks,
    };
  });
  console.log(`BOSS_RUNTIME_SMOKE ${JSON.stringify(records)}`);
  for (const record of records) {
    assert.ok(record.enemySkillUses > 0, `${record.monsterId}: authored enemy skill use must be > 0`);
    assert.equal(record.candidateExhaustion, 0, `${record.monsterId}: candidate exhaustion`);
    assert.equal(record.fallbackAttacks, 0, `${record.monsterId}: corrupt fallback`);
    assert.ok(record.gimmickInteractions > 0, `${record.monsterId}: at least one boss gimmick must be observable`);
  }
});
