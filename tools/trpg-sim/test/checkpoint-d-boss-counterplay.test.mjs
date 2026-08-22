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
const BOSS_IDS = [
  'MON-0007', 'MON-0015', 'MON-0016', 'MON-0017', 'MON-0018',
  'MON-0028', 'MON-0063', 'MON-0064', 'MON-0077',
];

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
      defense: 20_000,
      agility: 20_000,
      luck: 0,
      physicalPower: 35,
      magicPower: 180,
      magicResistance: 20_000,
      accuracy: 20_000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 20_000,
      debuffResistance: 20_000,
      ...overrides,
    },
  });
}

function withOnlyBossAction(monsterId, skillId, { keepCondition = false, cooldownOverride = 0 } = {}) {
  const actions = baseData.actionsByMonsterId.get(monsterId) ?? [];
  const canonical = actions.find((entry) => entry.skillId === skillId);
  assert.ok(canonical, `${monsterId} must own canonical ${skillId}`);
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

function start(data, monsterId, seed, stats = {}) {
  return beginInteractiveBattle({
    data,
    monsterIds: [monsterId],
    playerBuild: build(`D-boss-${seed}`, stats),
    seed: `checkpoint-d:boss:${seed}`,
    maxTurns: 16,
  });
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

function enemyFrame(output, skillId = null) {
  return (output.round?.frames ?? []).find((frame) =>
    frame.actorSide === 'enemy'
      && (!skillId || frame.action?.skillId === skillId)
      && frame.phase !== 'telegraph');
}

function playerFrame(output) {
  return (output.round?.frames ?? []).find((frame) => frame.actorSide === 'player' && frame.phase === 'action');
}

function special(actor, id) {
  return (actor?.specialStates ?? []).find((entry) => entry.id === id || entry.stateId === id) ?? null;
}

function modifierStage(actor, id) {
  return Number(actor?.modifiers?.get?.(id)?.stage ?? 0);
}

test('MON-0007: responding to reinforcement by cleaning up a summon reduces pack size', () => {
  const data = withOnlyBossAction('MON-0007', 'MSK-0058', { keepCondition: true });
  function line(response) {
    let session = start(data, 'MON-0007', `0007-${response}`, { physicalPower: 800, attack: 800 });
    let output = round(data, session, 'DEFEND');
    session = output.session;
    const boss = session.state.enemies.find((entry) => entry.id === 'MON-0007');
    const summons = session.state.enemies.filter((entry) => entry.alive && entry.id !== 'MON-0007');
    assert.ok(summons.length >= 1, 'pack leader must create an actual reinforcement');
    if (response === 'cleanup') {
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
  const data = withOnlyBossAction('MON-0015', 'MSK-0067');
  function line(selector) {
    let session = start(data, 'MON-0015', `0015-${selector}`);
    session.state.enemies[0].mp = 0;
    let output = round(data, session, 'DEFEND');
    session = output.session;
    assert.ok(special(session.state.enemies[0], 'magic_absorb'), 'boss must establish the authored absorb membrane');
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
  assert.ok(magic.bossMp > physical.bossMp, 'casting into magic absorb replenishes boss MP while physical damage does not');
});

test('MON-0016: a slow response lets river-drain ecology accumulate while decisive burst prevents it', () => {
  const data = withOnlyBossAction('MON-0016', 'MSK-0068', { keepCondition: true, cooldownOverride: null });
  let slow = start(data, 'MON-0016', '0016-slow');
  for (let index = 0; index < 8 && slow.status === 'active'; index += 1) slow = round(data, slow, 'DEFEND').session;
  const slowStacks = Number(slow.state.field?.effects?.river_drain?.stacks ?? slow.state.field?.river_drain ?? 0);

  const burstData = withOnlyBossAction('MON-0016', 'MSK-0068', { keepCondition: true, cooldownOverride: null });
  let burst = start(burstData, 'MON-0016', '0016-burst', { attack: 2_000_000, physicalPower: 2_000_000 });
  const burstOut = round(burstData, burst, 'ATTACK');
  burst = burstOut.session;
  const burstStacks = Number(burst.state.field?.effects?.river_drain?.stacks ?? burst.state.field?.river_drain ?? 0);

  assert.ok(slowStacks >= 1, 'slow play lets the authored river-drain state appear');
  assert.ok(burst.status !== 'active' || burst.state.enemies.every((entry) => !entry.alive || entry.hp <= 0),
    'decisive burst ends the encounter instead of letting ecology compound');
  assert.ok(slowStacks > burstStacks, 'longer fight creates more river-drain pressure than immediate resolution');
});

function telegraphResponse(monsterId, skillId, response, seed) {
  const data = withOnlyBossAction(monsterId, skillId);
  let session = start(data, monsterId, seed);
  let output = round(data, session, 'ATTACK');
  session = output.session;
  assert.ok(session.pendingIntents?.length || (output.round?.frames ?? []).some((frame) => frame.phase === 'telegraph'),
    `${monsterId}/${skillId} must expose its authored warning before execution`);
  const before = session.state.players[0].hp;
  output = round(data, session, response);
  const after = output.session.state.players[0].hp;
  assert.ok(enemyFrame(output, skillId), `${monsterId}/${skillId} must execute after telegraph`);
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

  const giantDrain = (baseData.actionsByMonsterId.get('MON-0017') ?? []).find((entry) => entry.skillId === 'MSK-0069');
  const catastropheDrain = (baseData.actionsByMonsterId.get('MON-0018') ?? []).find((entry) => entry.skillId === 'MSK-0069');
  assert.notEqual(giantDrain?.condition, catastropheDrain?.condition, 'their drain cadence is authored differently');
  assert.equal((baseData.actionsByMonsterId.get('MON-0017') ?? []).some((entry) => entry.skillId === 'MSK-0067'), false);
  assert.equal((baseData.actionsByMonsterId.get('MON-0018') ?? []).some((entry) => entry.skillId === 'MSK-0067'), true,
    'catastrophe form adds magic-absorb cycling absent from giant form');

  const absorbData = withOnlyBossAction('MON-0018', 'MSK-0067');
  let absorbSession = start(absorbData, 'MON-0018', '0018-absorb');
  absorbSession = round(absorbData, absorbSession, 'DEFEND').session;
  assert.ok(special(absorbSession.state.enemies[0], 'magic_absorb'), 'the distinct catastrophe absorb package executes in production');
});

test('MON-0028: rotating away from a repeated nuke reduces copy punishment', () => {
  const data = withOnlyBossAction('MON-0028', 'MSK-0090');
  function line(selector) {
    const session = start(data, 'MON-0028', `0028-${selector}`);
    const before = session.state.players[0].hp;
    const output = round(data, session, selector);
    const copied = (output.round?.frames ?? []).find((frame) =>
      frame.actorSide === 'enemy'
      && (frame.events ?? []).some((event) => event.type === 'copy_last_player_skill' || event.command === 'COPY_LAST_ENEMY_SKILL'));
    return { hpLost: before - output.session.state.players[0].hp, output, copied };
  }
  const spam = line(OFFENSIVE_MAGIC);
  const rotation = line(FIELD_SETUP);
  assert.ok(enemyFrame(spam.output, 'MSK-0090'));
  assert.ok(enemyFrame(rotation.output, 'MSK-0090'));
  assert.ok(spam.hpLost > rotation.hpLost,
    'leaving a damaging repeatable spell as the latest pattern is more dangerous than rotating into setup');
});

test('MON-0063: seal blocks magic without taking away the physical fallback', () => {
  const data = withOnlyBossAction('MON-0063', 'MSK-0077');
  let session = start(data, 'MON-0063', '0063-seal');
  session = round(data, session, 'ATTACK').session;
  const commands = listInteractiveBattleCommands({ data, session });
  const magic = commands.find((entry) => entry.skillId === OFFENSIVE_MAGIC);
  const attack = commands.find((entry) => entry.actionId === 'ATTACK');
  assert.ok(magic);
  assert.equal(magic.available, false);
  assert.equal(magic.reason, 'sealed');
  assert.equal(attack?.available, true, 'physical basic attack remains a readable adaptation to magic seal');
  const output = round(data, session, 'ATTACK');
  assert.equal(output.ok, true);
});

test('MON-0064: ancient cannon warning rewards guard, and overheat opens a damage window', () => {
  const ignore = telegraphResponse('MON-0064', 'MSK-0073', 'ATTACK', '0064-ignore');
  const guard = telegraphResponse('MON-0064', 'MSK-0073', 'DEFEND', '0064-guard');
  assert.ok(guard.hpLost < ignore.hpLost, 'guard must blunt the ancient cannon');

  const overheatData = withOnlyBossAction('MON-0064', 'MSK-0075');
  let session = start(overheatData, 'MON-0064', '0064-overheat', { attack: 220, physicalPower: 220 });
  let output = round(overheatData, session, 'ATTACK');
  const beforeWindow = Number(playerFrame(output)?.damage ?? 0);
  session = output.session;
  assert.ok(modifierStage(session.state.enemies[0], 'defense') < 0, 'overheat applies its authored defense penalty');
  output = round(overheatData, session, 'ATTACK');
  const inWindow = Number(playerFrame(output)?.damage ?? 0);
  assert.ok(inWindow > beforeWindow, 'the same attack hits harder during the overheat defense-down window');
});

test('MON-0077: commander counterplay is certified by the ENC-0076 target-priority witness', () => {
  assert.ok(BOSS_IDS.includes('MON-0077'));
  const order = (baseData.actionsByMonsterId.get('MON-0077') ?? []).find((entry) => entry.skillId === 'MSK-0082');
  const breakthrough = (baseData.actionsByMonsterId.get('MON-0077') ?? []).find((entry) => entry.skillId === 'MSK-0095');
  assert.ok(order, 'commander opening order exists for target-priority pressure');
  assert.ok(breakthrough, 'late breakthrough remains the authored climax threat');
});

test('Checkpoint D boss coverage stays pinned to all nine manually designed bosses', () => {
  assert.deepEqual(BOSS_IDS, [
    'MON-0007', 'MON-0015', 'MON-0016', 'MON-0017', 'MON-0018',
    'MON-0028', 'MON-0063', 'MON-0064', 'MON-0077',
  ]);
  for (const id of BOSS_IDS) assert.equal(baseData.monsterById.get(id)?.isBoss, true, `${id} must remain a canonical boss`);
});
