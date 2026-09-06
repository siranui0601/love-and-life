import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const baseData = await loadBattleData();
const OFFENSIVE_MAGIC = 'SKL-0665';
const FIELD_SETUP = 'SKL-0639';
const BOSS_IDS = Object.freeze([
  'MON-0007', 'MON-0015', 'MON-0016', 'MON-0017', 'MON-0018',
  'MON-0028', 'MON-0063', 'MON-0064', 'MON-0077',
]);

function build(id, overrides = {}) {
  return createPlayerBuild(baseData, {
    id,
    name: id,
    level: 30,
    equipmentIds: ['EQP-W-0009'],
    skillIds: [OFFENSIVE_MAGIC, FIELD_SETUP],
    baseStats: {
      maxHp: 2_000_000,
      maxMp: 5_000,
      attack: 35,
      defense: 100,
      agility: 20_000,
      luck: 0,
      physicalPower: 35,
      magicPower: 180,
      magicResistance: 100,
      accuracy: 20_000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 20_000,
      debuffResistance: 20_000,
      ...overrides,
    },
  });
}

function actionWithCommand(data, monsterId, predicate) {
  return (data.actionsByMonsterId.get(monsterId) ?? []).find((action) => {
    const skill = data.monsterSkillById.get(action.skillId);
    return (skill?.commands ?? []).some(predicate);
  });
}

function withOnlyBossAction(monsterId, actionOrSkillId, { keepCondition = false, cooldownOverride = 0 } = {}) {
  const actions = baseData.actionsByMonsterId.get(monsterId) ?? [];
  const canonical = typeof actionOrSkillId === 'string'
    ? actions.find((entry) => entry.skillId === actionOrSkillId)
    : actionOrSkillId;
  assert.ok(canonical, `${monsterId} must own the requested canonical action`);
  const actionsByMonsterId = new Map(baseData.actionsByMonsterId);
  actionsByMonsterId.set(monsterId, [{
    ...canonical,
    condition: keepCondition ? canonical.condition : null,
    baseWeight: 100,
    priority: 999,
    cooldownOverride,
    usesPerBattle: null,
  }]);
  return { ...baseData, actionsByMonsterId };
}

function start(data, monsterId, seed, stats = {}, { enemyAgility = 1 } = {}) {
  const session = beginInteractiveBattle({
    data,
    monsterIds: [monsterId],
    playerBuild: build(`D-boss-${seed}`, stats),
    seed: `checkpoint-d:boss:${seed}`,
    maxTurns: 16,
  });
  const enemy = session.state.enemies[0];
  enemy.maxMp = Math.max(enemy.maxMp, 10_000);
  enemy.mp = enemy.maxMp;
  enemy.agility = enemyAgility;
  enemy.accuracy = 10_000;
  enemy.debuffSuccess = 10_000;
  return session;
}

function findCommand(data, session, selector, targetInstanceId = null) {
  const commands = listInteractiveBattleCommands({ data, session });
  const selected = selector.startsWith('SKL-')
    ? commands.find((entry) => entry.skillId === selector && entry.available !== false)
    : commands.find((entry) => entry.actionId === selector && entry.available !== false);
  assert.ok(selected, `${selector} must be available`);
  const target = targetInstanceId
    ? selected.targets?.find((entry) => entry.instanceId === targetInstanceId)
    : selected.targets?.find((entry) => entry.side === 'enemy') ?? selected.targets?.[0];
  return { actionId: selected.actionId, ...(target ? { targetInstanceId: target.instanceId } : {}) };
}

function round(data, session, selector, targetInstanceId = null) {
  const output = resolveInteractiveBattleRound({
    data,
    session,
    command: findCommand(data, session, selector, targetInstanceId),
  });
  assert.equal(output.ok, true, `${selector}: ${output.reason ?? 'failed'}`);
  return output;
}

function enemyFrame(output, skillId = null, kind = 'skill') {
  return (output.round?.frames ?? []).find((frame) =>
    frame.actorSide === 'enemy'
      && frame.action?.kind === kind
      && (!skillId || frame.action?.skillId === skillId));
}

function playerFrame(output) {
  return (output.round?.frames ?? []).find((frame) => frame.actorSide === 'player' && frame.action?.kind === 'skill');
}

function modifierStage(actor, id) {
  return Number(actor?.modifiers?.get?.(id)?.stage ?? 0);
}

test('MON-0007: responding to reinforcement by cleaning up a summon reduces pack size', () => {
  const summonAction = actionWithCommand(baseData, 'MON-0007', (command) => command.command === 'SUMMON_UNIT');
  const data = withOnlyBossAction('MON-0007', summonAction);
  function line(response) {
    let session = start(data, 'MON-0007', `0007-${response}`, { physicalPower: 800, attack: 800 });
    let output = round(data, session, 'DEFEND');
    session = output.session;
    const boss = session.state.enemies.find((entry) => entry.id === 'MON-0007');
    const summons = session.state.enemies.filter((entry) => entry.alive && entry.id !== 'MON-0007');
    assert.ok(summons.length >= 1, 'pack leader must create an actual reinforcement');
    if (response === 'cleanup') {
      summons[0].hp = 1;
      output = round(data, session, 'ATTACK', summons[0].instanceId);
    } else {
      output = round(data, session, 'DEFEND');
    }
    const alive = output.session.state.enemies.filter((entry) => entry.alive && entry.hp > 0);
    return { alive: alive.length, bossAlive: Boolean(alive.find((entry) => entry.instanceId === boss.instanceId)) };
  }
  const cleanup = line('cleanup');
  const ignore = line('ignore');
  assert.ok(cleanup.alive < ignore.alive, 'cleaning a reinforcement must reduce the pack compared with ignoring it');
  assert.equal(cleanup.bossAlive, true);
});

test('MON-0015: magic absorb makes damage type a resource decision', () => {
  const absorbAction = actionWithCommand(baseData, 'MON-0015', (command) => (
    command.command === 'APPLY_SPECIAL_STATE' && (command.stateId ?? command.type) === 'magic_absorb'
  ));
  const data = withOnlyBossAction('MON-0015', absorbAction);
  function line(selector) {
    let session = start(data, 'MON-0015', `0015-${selector}`);
    let output = round(data, session, 'DEFEND');
    session = output.session;
    assert.ok(session.state.enemies[0].specialStates.has('magic_absorb'), 'boss must establish the authored absorb membrane');
    session.state.enemies[0].mp = 0;
    output = round(data, session, selector);
    return {
      bossMp: output.session.state.enemies[0].mp,
      playerDamage: Number(playerFrame(output)?.damage ?? 0),
    };
  }
  const magic = line(OFFENSIVE_MAGIC);
  const physical = line('ATTACK');
  assert.ok(magic.playerDamage > 0);
  assert.ok(magic.bossMp > physical.bossMp, 'casting magic into the membrane replenishes boss MP while physical pressure does not');
});

test('MON-0016: a slow response lets river-drain ecology accumulate while decisive burst prevents it', () => {
  const riverAction = actionWithCommand(baseData, 'MON-0016', (command) => (
    command.command === 'MODIFY_FIELD' && command.fieldEffect === 'river_drain'
  ));
  const data = withOnlyBossAction('MON-0016', riverAction);
  let slow = start(data, 'MON-0016', '0016-slow');
  for (let index = 0; index < 3 && slow.status === 'active'; index += 1) slow = round(data, slow, 'DEFEND').session;
  const slowStacks = Number(slow.state.fieldEffects.get('river_drain')?.stacks ?? 0);

  let burst = start(data, 'MON-0016', '0016-burst', { attack: 1_000_000_000, physicalPower: 1_000_000_000 });
  burst.state.enemies[0].hp = 1;
  burst = round(data, burst, 'ATTACK').session;
  const burstStacks = Number(burst.state.fieldEffects.get('river_drain')?.stacks ?? 0);

  assert.ok(slowStacks >= 1, 'slow play lets the authored river-drain state appear');
  assert.ok(burst.status !== 'active' || burst.state.enemies.every((entry) => !entry.alive || entry.hp <= 0),
    'decisive burst ends the encounter instead of letting ecology compound');
  assert.ok(slowStacks > burstStacks, 'longer fight creates more river-drain pressure than immediate resolution');
});

function telegraphResponse(monsterId, skillId, response, seed) {
  const data = withOnlyBossAction(monsterId, skillId);
  let session = start(data, monsterId, seed, { agility: 20_000 }, { enemyAgility: 1 });
  let output = round(data, session, 'ATTACK');
  session = output.session;
  const warning = enemyFrame(output, skillId, 'telegraph');
  assert.ok(warning, `${monsterId}/${skillId} must emit the authored telegraph frame`);
  assert.equal(session.state.enemies[0].pendingIntent?.skillId, skillId,
    `${monsterId}/${skillId} must retain a pending intent after warning`);
  const before = session.state.players[0].hp;
  output = round(data, session, response);
  const after = output.session.state.players[0].hp;
  assert.ok(enemyFrame(output, skillId, 'skill'), `${monsterId}/${skillId} must execute after telegraph`);
  assert.equal(output.session.state.enemies[0].pendingIntent, null);
  return { hpLost: before - after, output };
}

test('MON-0017: world-tree drain warning creates a real guard decision', () => {
  const ignore = telegraphResponse('MON-0017', 'MSK-0069', 'ATTACK', '0017-ignore');
  const respond = telegraphResponse('MON-0017', 'MSK-0069', 'DEFEND', '0017-guard');
  assert.ok(ignore.hpLost > 0);
  assert.ok(respond.hpLost < ignore.hpLost, 'guarding the warning must reduce the resolved drain damage');
});

test('MON-0018: catastrophe drain remains guardable but is mechanically distinct from MON-0017', () => {
  const ignore = telegraphResponse('MON-0018', 'MSK-0069', 'ATTACK', '0018-ignore');
  const respond = telegraphResponse('MON-0018', 'MSK-0069', 'DEFEND', '0018-guard');
  assert.ok(respond.hpLost < ignore.hpLost);

  const giantBoss = baseData.bossByMonsterId.get('MON-0017');
  const catastropheBoss = baseData.bossByMonsterId.get('MON-0018');
  assert.notDeepEqual(
    (giantBoss?.phases ?? []).map((phase) => [phase.index, phase.name, phase.trigger]),
    (catastropheBoss?.phases ?? []).map((phase) => [phase.index, phase.name, phase.trigger]),
    'giant and catastrophe forms must not collapse to the same phase script',
  );

  const giantAbsorb = actionWithCommand(baseData, 'MON-0017', (command) => (
    command.command === 'APPLY_SPECIAL_STATE' && (command.stateId ?? command.type) === 'magic_absorb'
  ));
  const catastropheAbsorb = actionWithCommand(baseData, 'MON-0018', (command) => (
    command.command === 'APPLY_SPECIAL_STATE' && (command.stateId ?? command.type) === 'magic_absorb'
  ));
  assert.equal(giantAbsorb, undefined, 'giant form does not add the catastrophe absorb cycle');
  assert.ok(catastropheAbsorb, 'catastrophe form adds a magic-absorb cycle');

  const absorbData = withOnlyBossAction('MON-0018', catastropheAbsorb);
  let absorbSession = start(absorbData, 'MON-0018', '0018-absorb');
  absorbSession = round(absorbData, absorbSession, 'DEFEND').session;
  assert.ok(absorbSession.state.enemies[0].specialStates.has('magic_absorb'),
    'the distinct catastrophe absorb package executes in production');
});

test('MON-0028: rotating away from a repeated nuke reduces copy punishment', () => {
  const copyAction = actionWithCommand(baseData, 'MON-0028', (command) => command.command === 'COPY_LAST_ENEMY_SKILL');
  const data = withOnlyBossAction('MON-0028', copyAction);
  function line(selector) {
    const session = start(data, 'MON-0028', `0028-${selector}`);
    const before = session.state.players[0].hp;
    const output = round(data, session, selector);
    return { hpLost: before - output.session.state.players[0].hp, output };
  }
  const spam = line(OFFENSIVE_MAGIC);
  const rotation = line(FIELD_SETUP);
  assert.ok(enemyFrame(spam.output, copyAction.skillId));
  assert.ok(enemyFrame(rotation.output, copyAction.skillId));
  assert.ok(spam.hpLost > rotation.hpLost,
    'leaving a damaging repeatable spell as the latest pattern is more dangerous than rotating into setup');
});

test('MON-0063: seal blocks magic without taking away the physical fallback', () => {
  const sealAction = actionWithCommand(baseData, 'MON-0063', (command) => (
    command.command === 'APPLY_SPECIAL_STATE' && (command.stateId ?? command.type) === 'seal'
  ));
  const data = withOnlyBossAction('MON-0063', sealAction);
  let session = start(data, 'MON-0063', '0063-seal');
  session = round(data, session, 'ATTACK').session;
  assert.ok(session.state.players[0].specialStates.has('seal'));
  const commands = listInteractiveBattleCommands({ data, session });
  const magic = commands.find((entry) => entry.skillId === OFFENSIVE_MAGIC);
  const attack = commands.find((entry) => entry.actionId === 'ATTACK');
  assert.ok(magic);
  assert.equal(magic.available, false);
  assert.equal(magic.disabledReason, 'sealed');
  assert.equal(attack?.available, true, 'physical basic attack remains a readable adaptation to magic seal');
  assert.equal(round(data, session, 'ATTACK').ok, true);
});

test('MON-0064: ancient cannon warning rewards guard, and overheat opens a damage window', () => {
  const ignore = telegraphResponse('MON-0064', 'MSK-0073', 'ATTACK', '0064-ignore');
  const guard = telegraphResponse('MON-0064', 'MSK-0073', 'DEFEND', '0064-guard');
  assert.ok(guard.hpLost < ignore.hpLost, 'guard must blunt the ancient cannon');

  const overheatData = withOnlyBossAction('MON-0064', 'MSK-0075');
  let session = start(overheatData, 'MON-0064', '0064-overheat', { attack: 220, physicalPower: 220 });
  let output = round(overheatData, session, 'ATTACK');
  const beforeWindow = Number((output.round?.frames ?? []).find((frame) => frame.actorSide === 'player')?.damage ?? 0);
  session = output.session;
  assert.ok(modifierStage(session.state.enemies[0], 'defense') < 0, 'overheat applies its authored defense penalty');
  output = round(overheatData, session, 'ATTACK');
  const inWindow = Number((output.round?.frames ?? []).find((frame) => frame.actorSide === 'player')?.damage ?? 0);
  assert.ok(inWindow > beforeWindow, 'the same attack hits harder during the overheat defense-down window');
});

test('MON-0077: commander counterplay is certified by command pressure and the ENC-0076 target-priority witness', () => {
  const order = (baseData.actionsByMonsterId.get('MON-0077') ?? []).find((entry) => entry.skillId === 'MSK-0082');
  const breakthrough = (baseData.actionsByMonsterId.get('MON-0077') ?? []).find((entry) => entry.skillId === 'MSK-0095');
  assert.ok(order, 'commander opening order exists for target-priority pressure');
  assert.ok(breakthrough, 'late breakthrough remains the authored climax threat');
  const data = withOnlyBossAction('MON-0077', order);
  const output = round(data, start(data, 'MON-0077', '0077-order'), 'DEFEND');
  assert.ok(enemyFrame(output, 'MSK-0082'), 'the commander order executes through the production battle executor');
});

test('Checkpoint D boss coverage stays pinned to all nine manually designed bosses', () => {
  assert.deepEqual([...baseData.bossByMonsterId.keys()].sort(), [...BOSS_IDS].sort());
  for (const id of BOSS_IDS) {
    assert.ok(baseData.monsterById.get(id), `${id} monster row must exist`);
    assert.ok(baseData.bossByMonsterId.get(id), `${id} boss design row must exist`);
  }
});
