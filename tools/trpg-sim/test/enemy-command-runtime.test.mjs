import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTrpgGameData, resetTrpgGameDataForTests } from '../../../src/server/trpg/game/game-data.js';
import { createPlayerBuild, inferPlayerDamageType } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const CASES = Object.freeze([
  ['DAMAGE', 'MSK-0001'],
  ['HEAL', 'MSK-0061'],
  ['APPLY_DEBUFF', 'MSK-0039'],
  ['APPLY_MODIFIER', 'MSK-0042'],
  ['APPLY_SPECIAL_STATE', 'MSK-0052'],
  ['MODIFY_CRITICAL', 'MSK-0016'],
  ['MODIFY_RESOURCE', 'MSK-0050'],
  ['MODIFY_ESCAPE', 'MSK-0084'],
  ['MODIFY_FIELD', 'MSK-0068'],
  ['REMOVE_DEBUFF', 'MSK-0035'],
  ['REMOVE_MODIFIER', 'MSK-0076'],
  ['SUMMON_UNIT', 'MSK-0057'],
  ['INTERRUPT_CAST', 'MSK-0086'],
  ['COPY_LAST_ENEMY_SKILL', 'MSK-0090'],
]);

function playerBuild(data) {
  return createPlayerBuild(data, {
    id: 'checkpoint-b-command-probe',
    name: 'Checkpoint B command probe',
    level: 24,
    equipmentIds: [],
    skillIds: [],
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

function forcedData(base, monsterId, skillId, family) {
  const sourceSkill = base.monsterSkillById.get(skillId);
  assert.ok(sourceSkill, `${family}: missing canonical source skill ${skillId}`);
  assert.ok(sourceSkill.commands.some((command) => command.command === family), `${skillId}: missing ${family}`);

  // Keep the canonical command payload. Only probabilistic gates are raised in
  // this executor fixture so CI proves the state transition rather than RNG.
  // Canonical probabilities remain covered by ordinary-enemy and boss smokes.
  const skill = {
    ...sourceSkill,
    mpCost: 0,
    cooldown: 0,
    conditions: [],
    commands: sourceSkill.commands.map((command) => {
      if (family === 'APPLY_DEBUFF' && command.command === 'APPLY_DEBUFF') return { ...command, baseChance: 10000 };
      if (family === 'INTERRUPT_CAST' && command.command === 'INTERRUPT_CAST') return { ...command, baseChance: 10000 };
      if (family === 'MODIFY_ESCAPE' && command.command === 'MODIFY_ESCAPE') return { ...command, bonus: 10000 };
      return { ...command };
    }),
  };
  const action = {
    id: `CHECKPOINT-B:${family}`,
    monsterId,
    monsterName: 'runtime command probe',
    skillId,
    skillName: sourceSkill.name,
    baseWeight: 100,
    condition: null,
    priority: 999,
    usesPerBattle: null,
    cooldownOverride: 0,
    targetPolicy: 'resolver_default',
  };
  const monsterSkillById = new Map(base.monsterSkillById);
  monsterSkillById.set(skillId, skill);
  const actionsByMonsterId = new Map(base.actionsByMonsterId);
  actionsByMonsterId.set(monsterId, [action]);
  return { ...base, monsterSkillById, actionsByMonsterId };
}

function snapshots(session) {
  const player = session.state.players[0];
  const enemy = session.state.enemies[0];
  return {
    playerHp: player.hp,
    playerMp: player.mp,
    playerDebuffs: [...player.debuffs.keys()].sort(),
    playerSpecialStates: [...player.specialStates.keys()].sort(),
    enemyHp: enemy.hp,
    enemyMp: enemy.mp,
    enemyModifiers: [...enemy.modifiers.keys()].sort(),
    enemySpecialStates: [...enemy.specialStates.keys()].sort(),
    enemyCount: session.state.enemies.length,
    fieldEffects: [...session.state.fieldEffects.entries()],
    enemyEscaped: enemy.escaped,
  };
}

function runFamily(base, family, skillId) {
  const monsterId = 'MON-0005';
  const data = forcedData(base, monsterId, skillId, family);
  let session = beginInteractiveBattle({
    data,
    monsterIds: [monsterId],
    playerBuild: playerBuild(data),
    seed: `checkpoint-b:command-runtime:${family}:${skillId}`,
    maxTurns: 1,
  });
  const player = session.state.players[0];
  const enemy = session.state.enemies[0];
  enemy.maxHp = Math.max(enemy.maxHp, 100000);
  enemy.hp = enemy.maxHp;
  enemy.maxMp = 1000;
  enemy.mp = 1000;
  enemy.agility = 10000;
  enemy.accuracy = 10000;
  enemy.debuffSuccess = 10000;

  if (family === 'HEAL') enemy.hp = Math.max(1, enemy.maxHp * 0.25);
  if (family === 'REMOVE_DEBUFF') enemy.debuffs.set('poison', { duration: 5, params: { maxHpRatio: 0.01 } });
  if (family === 'REMOVE_MODIFIER') enemy.modifiers.set('defense', { stage: -2, duration: 5 });
  if (family === 'INTERRUPT_CAST') player.specialStates.set('casting', { duration: 2, params: {} });
  if (family === 'MODIFY_ESCAPE') enemy.hp = Math.max(1, enemy.maxHp * 0.2);
  if (family === 'COPY_LAST_ENEMY_SKILL') {
    player.lastSkillRepeatable = true;
    player.lastSkillId = 'CHECKPOINT-B-PLAYER-LAST-SKILL';
    player.lastSkill = {
      id: 'CHECKPOINT-B-PLAYER-LAST-SKILL',
      category: '剣技',
      tags: ['physical'],
      costs: { hp: 0 },
      damage: { totalMultiplier: 1.5, hits: 1, accuracyModifier: 10000, criticalModifier: 0 },
    };
  }

  const before = snapshots(session);
  const commands = listInteractiveBattleCommands({ data, session });
  const attack = commands.find((command) => command.actionId === 'ATTACK' && command.available);
  assert.ok(attack, `${family}: player ATTACK must be available`);
  const resolved = resolveInteractiveBattleRound({
    data,
    session,
    command: { actionId: 'ATTACK', targetInstanceId: attack.targets[0]?.instanceId },
  });
  assert.equal(resolved.ok, true, `${family}: round resolution`);
  session = resolved.session;
  const after = snapshots(session);
  const enemyFrames = resolved.round.frames.filter((frame) => frame.phase === 'action' && frame.actorSide === 'enemy');
  const authored = enemyFrames.find((frame) => frame.action?.kind === 'skill');
  assert.ok(authored, `${family}: canonical command must execute as authored enemy skill`);
  return { data, before, after, resolved, authored };
}

test('all 14 canonical enemy command families execute through the production battle engine and change authoritative resolution state', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();
  const records = [];

  for (const [family, skillId] of CASES) {
    const { before, after, resolved, authored } = runFamily(battleData, family, skillId);
    let transitioned = false;
    let evidence = null;
    switch (family) {
      case 'DAMAGE':
        transitioned = after.playerHp < before.playerHp;
        evidence = { hpBefore: before.playerHp, hpAfter: after.playerHp };
        break;
      case 'HEAL':
        transitioned = after.enemyHp > before.enemyHp;
        evidence = { hpBefore: before.enemyHp, hpAfter: after.enemyHp };
        break;
      case 'APPLY_DEBUFF':
        transitioned = after.playerDebuffs.length > before.playerDebuffs.length;
        evidence = { before: before.playerDebuffs, after: after.playerDebuffs };
        break;
      case 'APPLY_MODIFIER':
        transitioned = resolved.session.state.players[0].modifiers.size > 0;
        evidence = { playerModifiers: [...resolved.session.state.players[0].modifiers.keys()] };
        break;
      case 'APPLY_SPECIAL_STATE':
        transitioned = after.enemySpecialStates.includes('barrier');
        evidence = { specialStates: after.enemySpecialStates };
        break;
      case 'MODIFY_CRITICAL':
        transitioned = Number(authored.damage ?? 0) > 0 && Number.isFinite(Number(authored.criticals ?? 0));
        evidence = { damage: authored.damage, criticals: authored.criticals };
        break;
      case 'MODIFY_RESOURCE':
        transitioned = after.playerMp < before.playerMp;
        evidence = { mpBefore: before.playerMp, mpAfter: after.playerMp };
        break;
      case 'MODIFY_ESCAPE':
        transitioned = after.enemyEscaped === true;
        evidence = { escaped: after.enemyEscaped, events: authored.events };
        break;
      case 'MODIFY_FIELD':
        transitioned = after.fieldEffects.length > before.fieldEffects.length;
        evidence = { fieldEffects: after.fieldEffects };
        break;
      case 'REMOVE_DEBUFF':
        transitioned = resolved.session.state.enemies[0].debuffs.size < 1;
        evidence = { remainingDebuffs: [...resolved.session.state.enemies[0].debuffs.keys()] };
        break;
      case 'REMOVE_MODIFIER':
        transitioned = !resolved.session.state.enemies[0].modifiers.has('defense');
        evidence = { remainingModifiers: [...resolved.session.state.enemies[0].modifiers.keys()] };
        break;
      case 'SUMMON_UNIT':
        transitioned = after.enemyCount > before.enemyCount;
        evidence = { countBefore: before.enemyCount, countAfter: after.enemyCount, events: authored.events };
        break;
      case 'INTERRUPT_CAST':
        transitioned = !resolved.session.state.players[0].specialStates.has('casting');
        evidence = { playerSpecialStates: [...resolved.session.state.players[0].specialStates.keys()], events: authored.events };
        break;
      case 'COPY_LAST_ENEMY_SKILL': {
        const copyEvent = (authored.events ?? []).find((event) => event.type === 'copy_skill');
        transitioned = copyEvent?.copiedSkillId === 'CHECKPOINT-B-PLAYER-LAST-SKILL' && after.playerHp < before.playerHp;
        evidence = {
          copyEvent,
          playerHpBefore: before.playerHp,
          playerHpAfter: after.playerHp,
          enemyHpBefore: before.enemyHp,
          enemyHpAfter: after.enemyHp,
        };
        break;
      }
      default:
        assert.fail(`unhandled command family ${family}`);
    }
    records.push({ family, skillId, runtimeExecuted: true, transitioned, evidence });
    assert.equal(transitioned, true, `${family}: authoritative state/resolution transition`);
  }

  console.log(`ENEMY_COMMAND_RUNTIME ${JSON.stringify(records)}`);
  assert.equal(records.length, 14);
  assert.equal(records.filter((record) => record.transitioned).length, 14);
});

test('canonical barrier, counter, regeneration and seal states have behavioral consequences beyond their state icon', () => {
  resetTrpgGameDataForTests();
  const { battleData } = loadTrpgGameData();

  {
    const { resolved } = runFamily(battleData, 'APPLY_SPECIAL_STATE', 'MSK-0052');
    const enemy = resolved.session.state.enemies[0];
    const barrier = enemy.specialStates.get('barrier');
    assert.ok(barrier?.capacity > 0, 'barrier must own runtime capacity');
  }

  {
    const { before, after, resolved } = runFamily(battleData, 'APPLY_SPECIAL_STATE', 'MSK-0054');
    const playerAttack = resolved.round.frames.find((frame) => frame.phase === 'action' && frame.actorSide === 'player');
    assert.ok(Number(playerAttack?.damage ?? 0) > 0, 'counter probe must land a qualifying direct hit');
    assert.ok(after.playerHp < before.playerHp, 'counter must react to the player hit');
  }

  {
    const { resolved } = runFamily(battleData, 'APPLY_SPECIAL_STATE', 'MSK-0055');
    assert.ok(resolved.session.state.enemies[0].specialStates.has('regeneration'));
  }

  {
    const monsterId = 'MON-0005';
    const data = forcedData(battleData, monsterId, 'MSK-0047', 'APPLY_SPECIAL_STATE');
    const magicSkill = [...data.playerSkills].find((skill) => skill.kind === 'active' && inferPlayerDamageType(skill) === 'magic');
    assert.ok(magicSkill, 'fixture needs one canonical active magic player skill');
    const build = createPlayerBuild(data, {
      id: 'seal-probe',
      name: 'seal-probe',
      level: 24,
      equipmentIds: [],
      skillIds: [magicSkill.id],
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
    let session = beginInteractiveBattle({ data, monsterIds: [monsterId], playerBuild: build, seed: 'checkpoint-b:seal', maxTurns: 2 });
    session.state.enemies[0].maxHp = Math.max(session.state.enemies[0].maxHp, 100000);
    session.state.enemies[0].hp = session.state.enemies[0].maxHp;
    session.state.enemies[0].maxMp = 1000;
    session.state.enemies[0].mp = 1000;
    session.state.enemies[0].agility = 10000;
    const attack = listInteractiveBattleCommands({ data, session }).find((command) => command.actionId === 'ATTACK');
    session = resolveInteractiveBattleRound({ data, session, command: { actionId: 'ATTACK', targetInstanceId: attack.targets[0]?.instanceId } }).session;
    const magicCommand = listInteractiveBattleCommands({ data, session }).find((command) => command.actionId === `SKILL:${magicSkill.id}`);
    assert.ok(magicCommand);
    assert.equal(magicCommand.available, false);
    assert.equal(magicCommand.disabledReason, 'sealed');
  }
});
