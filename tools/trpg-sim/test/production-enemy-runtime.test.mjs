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
  assert.equal(audit.total, 286);
  assert.equal(audit.unknown, 0);
  assert.equal(Object.values(audit.counts).reduce((sum, count) => sum + count, 0), 286);
});

test('production battle data has exactly the 14 authored enemy command families and no unresolved runtime family', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  const commandFamilies = new Set(battleData.monsterSkills.flatMap((skill) => skill.commands.map((command) => command.command)));
  assert.equal(commandFamilies.size, 14);
  assert.deepEqual(battleData.audit.unknownCommands, []);
  assert.deepEqual(battleData.audit.unknownSpecialStateSemantics, []);
  assert.deepEqual(battleData.audit.unknownDebuffSemantics, []);
});

test('all 9 canonical bosses execute authored enemy skills in production battle data without corrupt fallback', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  for (const monsterId of EXPECTED_BOSSES) {
    const result = runBossSmoke(battleData, monsterId);
    const enemyFrames = result.timeline.frames.filter((frame) => frame.phase === 'action' && frame.actorSide === 'enemy');
    const authoredSkillUses = enemyFrames.filter((frame) => frame.action?.kind === 'skill');
    const gimmickEvents = enemyFrames.flatMap((frame) => frame.events ?? []).filter((event) => [
      'phase_transition', 'telegraph', 'summon', 'field_change', 'copy_skill', 'escape', 'interrupt',
    ].includes(event.type));
    assert.ok(authoredSkillUses.length > 0, `${monsterId}: authored enemy skill use must be > 0`);
    assert.equal(result.candidateExhaustion, 0, `${monsterId}: candidate exhaustion`);
    assert.equal(result.fallbackAttacks, 0, `${monsterId}: corrupt fallback`);
    assert.ok(gimmickEvents.length > 0, `${monsterId}: at least one boss gimmick must be observable`);
  }
});
