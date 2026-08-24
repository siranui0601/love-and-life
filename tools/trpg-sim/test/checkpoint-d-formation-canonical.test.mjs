import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  FORMATION_CONTROL_SKILL_IDS,
  FORMATION_FAMILY_BY_SKILL_ID,
  activeMagicFormations,
  activeOwnedMagicFormations,
  beginInteractiveBattle,
  clearFormationsOnBattleEnd,
  listInteractiveBattleCommands,
  normalizeFormationRuntime,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

function witnessBuild(skillIds) {
  return createPlayerBuild(data, {
    id: 'checkpoint-d-formation-witness',
    name: 'Formation mechanic witness',
    level: 23,
    equipmentIds: ['EQP-W-0009'],
    skillIds,
    // MECHANIC_WITNESS only: durable stats prevent unrelated enemy lethality
    // from ending the isolation sequence. This is explicitly not GAMEPLAY_CERT.
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

function begin(skillIds) {
  return beginInteractiveBattle({
    data,
    // Use a durable non-sealing boss here. MON-0063's authored seal wave can
    // suppress the second setup skill and contaminate Formation isolation.
    monsterIds: ['MON-0018'],
    playerBuild: witnessBuild(skillIds),
    seed: 'checkpoint-d:formation:canonical',
    maxTurns: 20,
  });
}

function commandFor(session, selector) {
  const commands = listInteractiveBattleCommands({ data, session });
  const command = selector.startsWith('FORMATION:')
    ? commands.find((entry) => entry.actionId === selector)
    : commands.find((entry) => entry.skillId === selector && entry.available !== false);
  assert.ok(command, `available command ${selector}`);
  const target = command.targets?.[0];
  return { actionId: command.actionId, ...(target ? { targetInstanceId: target.instanceId } : {}) };
}

function resolve(session, selector) {
  const output = resolveInteractiveBattleRound({ data, session, command: commandFor(session, selector) });
  assert.equal(output.ok, true, `${selector}: ${output.reason ?? 'failed'}`);
  return output.session;
}

test('[MECHANIC_WITNESS] Formation registry separates creators from 二重陣/陣崩し controls', () => {
  for (const id of ['SKL-0637','SKL-0638','SKL-0639','SKL-0640','SKL-0641','SKL-0642','SKL-0643','SKL-0644','SKL-0645','SKL-0646','SKL-0647','SKL-0648','SKL-0649','SKL-0650','SKL-0651','SKL-0652','SKL-0656','SKL-0657','SKL-0658']) {
    assert.ok(FORMATION_FAMILY_BY_SKILL_ID[id], `${id} has explicit formationFamily`);
  }
  assert.deepEqual([...FORMATION_CONTROL_SKILL_IDS].sort(), ['SKL-0653', 'SKL-0654']);
  assert.equal(FORMATION_FAMILY_BY_SKILL_ID['SKL-0653'], undefined);
  assert.equal(FORMATION_FAMILY_BY_SKILL_ID['SKL-0654'], undefined);
  assert.equal(FORMATION_FAMILY_BY_SKILL_ID['SKL-0637'], 'fire');
  assert.equal(FORMATION_FAMILY_BY_SKILL_ID['SKL-0656'], 'fire', 'different source skills may share the same family');
});

test('[MECHANIC_WITNESS] same sourceSkillId cannot stack, refresh or replace while active', () => {
  let session = begin(['SKL-0640']);
  session = resolve(session, 'SKL-0640');
  const first = activeOwnedMagicFormations(session)[0];
  assert.ok(first);
  assert.equal(first.sourceSkillId, 'SKL-0640');
  assert.equal(first.formationFamily, 'wind');
  const snapshot = structuredClone(first);
  const command = listInteractiveBattleCommands({ data, session }).find((entry) => entry.skillId === 'SKL-0640');
  assert.equal(command.available, false);
  assert.equal(command.disabledReason, 'formation_already_active');
  const direct = resolveInteractiveBattleRound({ data, session, command: { actionId: 'SKILL:SKL-0640' } });
  assert.equal(direct.ok, false);
  assert.equal(direct.reason, 'formation_already_active');
  const after = activeOwnedMagicFormations(session)[0];
  assert.equal(after.instanceId, snapshot.instanceId);
  assert.equal(after.remainingTurns, snapshot.remainingTurns, 'recast rejection does not refresh duration');
  assert.equal(activeOwnedMagicFormations(session).length, 1, 'recast rejection does not replace/stack');
});

test('[MECHANIC_WITNESS] same formationFamily from different source skills can coexist', () => {
  let session = begin(['SKL-0637', 'SKL-0656']);
  session = resolve(session, 'SKL-0637');
  session = resolve(session, 'SKL-0656');
  const fire = activeOwnedMagicFormations(session).filter((field) => field.formationFamily === 'fire');
  assert.equal(fire.length, 2);
  assert.deepEqual(new Set(fire.map((field) => field.sourceSkillId)), new Set(['SKL-0637', 'SKL-0656']));
});

test('[MECHANIC_WITNESS] 二重陣 extends or amplifies one instance once without increasing instance count', () => {
  let session = begin(['SKL-0640', 'SKL-0641', 'SKL-0653']);
  session = resolve(session, 'SKL-0640');
  session = resolve(session, 'SKL-0641');
  const before = activeOwnedMagicFormations(session);
  assert.equal(before.length, 2);

  const wind = before.find((field) => field.sourceSkillId === 'SKL-0640');
  const extendAction = listInteractiveBattleCommands({ data, session })
    .find((entry) => entry.actionId === `FORMATION:DOUBLE:${wind.instanceId}:EXTEND`);
  assert.ok(extendAction);
  const windBefore = wind.remainingTurns;
  session = resolve(session, extendAction.actionId);
  const windAfter = activeOwnedMagicFormations(session).find((field) => field.instanceId === wind.instanceId);
  assert.ok(windAfter.dualFormationApplied);
  assert.equal(windAfter.remainingTurns, windBefore + 1,
    'one round elapsed (-1) and canonical 二重陣 extension added +2');
  assert.equal(activeOwnedMagicFormations(session).length, 2);
  const secondDirect = resolveInteractiveBattleRound({ data, session, command: { actionId: `FORMATION:DOUBLE:${wind.instanceId}:EXTEND` } });
  assert.equal(secondDirect.ok, false);
  assert.equal(secondDirect.reason, 'formation_already_enhanced');

  const earth = activeOwnedMagicFormations(session).find((field) => field.sourceSkillId === 'SKL-0641');
  const amplifyAction = listInteractiveBattleCommands({ data, session })
    .find((entry) => entry.actionId === `FORMATION:DOUBLE:${earth.instanceId}:AMPLIFY`);
  assert.ok(amplifyAction);
  session = resolve(session, amplifyAction.actionId);
  const earthAfter = activeOwnedMagicFormations(session).find((field) => field.instanceId === earth.instanceId);
  assert.equal(earthAfter.enhancementLevel, 1);
  assert.equal(earthAfter.dualFormationApplied, true);
  assert.equal(activeOwnedMagicFormations(session).length, 2);
});

test('[MECHANIC_WITNESS] 陣崩し is a learned skill action and respects unbreakable enemy formations', () => {
  let withoutBreak = begin(['SKL-0640']);
  withoutBreak = resolve(withoutBreak, 'SKL-0640');
  assert.equal(listInteractiveBattleCommands({ data, session: withoutBreak }).some((entry) => entry.actionId.startsWith('FORMATION:BREAK:')), false,
    'no free formation break exists without SKL-0654');

  let session = begin(['SKL-0640', 'SKL-0654']);
  session = resolve(session, 'SKL-0640');
  const own = activeOwnedMagicFormations(session)[0];
  const breakAction = listInteractiveBattleCommands({ data, session })
    .find((entry) => entry.actionId === `FORMATION:BREAK:${own.instanceId}` && entry.available !== false);
  assert.ok(breakAction);
  session = resolve(session, breakAction.actionId);
  assert.equal(activeOwnedMagicFormations(session).some((field) => field.instanceId === own.instanceId), false);

  // Separate the unbreakable-target witness from SKL-0654's authored 3T
  // cooldown after the successful own-formation break above.
  let enemySession = begin(['SKL-0654']);
  enemySession.playerRuntimeMechanics.fields.push({
    instanceId: 'ENEMY-UNBREAKABLE', owner: 'enemy', kind: 'magic_circle', fieldKind: 'magicFormation',
    sourceSkillId: 'SKL-0647', sourceSkillName: '敵の封印陣', formationFamily: 'seal', remainingTurns: 3,
    enhancementLevel: 0, dualFormationApplied: false, breakable: false, active: true,
  });
  const enemyBreak = listInteractiveBattleCommands({ data, session: enemySession })
    .find((entry) => entry.actionId === 'FORMATION:BREAK:ENEMY-UNBREAKABLE');
  assert.ok(enemyBreak);
  assert.equal(enemyBreak.available, false);
  assert.equal(enemyBreak.disabledReason, 'formation_unbreakable');
  const rejected = resolveInteractiveBattleRound({ data, session: enemySession, command: { actionId: enemyBreak.actionId } });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'formation_unbreakable');
});

test('[MECHANIC_WITNESS] SKL-1108 consumes only owned magicFormation and reports instance/family counts', () => {
  let session = begin(['SKL-0640', 'SKL-1108']);
  session = resolve(session, 'SKL-0640');
  const owned = activeOwnedMagicFormations(session)[0];
  session.playerRuntimeMechanics.fields.push(
    { instanceId: 'PLAYER-NONFORMATION', owner: 'player', kind: 'magic_circle', fieldKind: 'terrain', sourceSkillId: 'NON-FORMATION', remainingTurns: 99 },
    { instanceId: 'ENEMY-FORMATION', owner: 'enemy', kind: 'magic_circle', fieldKind: 'magicFormation', sourceSkillId: 'SKL-0637', sourceSkillName: '敵炎陣', formationFamily: 'fire', remainingTurns: 3, breakable: true, active: true },
    { instanceId: 'NPC-FORMATION', owner: 'npc', kind: 'magic_circle', fieldKind: 'magicFormation', sourceSkillId: 'SKL-0638', sourceSkillName: 'NPC氷陣', formationFamily: 'ice', remainingTurns: 3, breakable: true, active: true },
  );
  const lifecycleEnd = Number(session.state.turn ?? 0) + 3;
  session.playerRuntimeMechanics.traps ??= [];
  session.playerRuntimeMechanics.traps.push({ instanceId: 'TRAP-1', sourceSkillId: 'TEST-TRAP', charges: 1, rank: 1, expiresAfterTurn: lifecycleEnd });
  session.playerRuntimeMechanics.summons ??= [];
  session.playerRuntimeMechanics.summons.push({ instanceId: 'SUMMON-1', sourceSkillId: 'TEST-SUMMON', maxHp: 10, hp: 10, powerScale: 1, expiresAfterTurn: lifecycleEnd });
  session.playerRuntimeMechanics.weather = { type: 'rain', expiresAfterTurn: lifecycleEnd };

  session = resolve(session, 'SKL-1108');
  const ids = new Set((session.playerRuntimeMechanics.fields ?? []).map((field) => field.instanceId));
  assert.equal(ids.has(owned.instanceId), false);
  assert.equal(ids.has('PLAYER-NONFORMATION'), true);
  assert.equal(ids.has('ENEMY-FORMATION'), true);
  assert.equal(ids.has('NPC-FORMATION'), true);
  assert.equal(session.playerRuntimeMechanics.traps.some((entry) => entry.instanceId === 'TRAP-1'), true);
  assert.equal(session.playerRuntimeMechanics.summons.some((entry) => entry.instanceId === 'SUMMON-1'), true);
  assert.equal(session.playerRuntimeMechanics.weather.type, 'rain');
  const detonation = [...(session.playerRuntimeMechanics.events ?? [])].reverse()
    .find((entry) => entry.family === 'CONSUME_OWNED_FIELD' && entry.skillId === 'SKL-1108');
  assert.equal(detonation.instanceCount, 1);
  assert.equal(detonation.uniqueFormationFamilyCount, 1);
  assert.deepEqual(detonation.formationFamilies, ['wind']);
});

test('[MECHANIC_WITNESS] detonation cancels a pending delayed formation effect instead of double-dipping', () => {
  let session = begin(['SKL-0650', 'SKL-1108']);
  session = resolve(session, 'SKL-0650');
  const delayed = activeOwnedMagicFormations(session).find((field) => field.sourceSkillId === 'SKL-0650');
  assert.equal(delayed.pendingDelayedEffect?.status, 'pending');
  session = resolve(session, 'SKL-1108');
  const event = [...(session.playerRuntimeMechanics.events ?? [])].reverse()
    .find((entry) => entry.family === 'CONSUME_OWNED_FIELD' && entry.skillId === 'SKL-1108');
  assert.equal(event.cancelledPendingEffects.length, 1);
  assert.equal(event.cancelledPendingEffects[0].status, 'cancelled');
});

test('[MECHANIC_WITNESS] lifecycle clears formations at battle end but not merely because the caster is incapacitated', () => {
  const session = begin(['SKL-0640']);
  session.playerRuntimeMechanics.fields.push({
    instanceId: 'PERSIST-1', owner: 'player', kind: 'magic_circle', fieldKind: 'magicFormation', sourceSkillId: 'SKL-0640',
    sourceSkillName: '風陣', formationFamily: 'wind', remainingTurns: 2, enhancementLevel: 0, dualFormationApplied: false,
    concentrationRequired: false, breakable: true, active: true,
  });
  session.state.players[0].alive = false;
  session.state.players[0].hp = 0;
  normalizeFormationRuntime(session, data);
  assert.equal(activeMagicFormations(session).length, 1, 'caster incapacitation alone does not clear a normal formation');
  session.status = 'finished';
  session.winner = 'enemies';
  const cleared = clearFormationsOnBattleEnd(session);
  assert.equal(cleared.length, 1);
  assert.equal(activeMagicFormations(session).length, 0);
});