import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

const FIELD_A = 'SKL-0639';
const FIELD_B = 'SKL-0640';
const DETONATE = 'SKL-1108';
const SPAM_SKILL = 'SKL-0001';
const GREEDY_SKILL = 'SKL-0665';

function tacticalBuild(id, overrides = {}) {
  return createPlayerBuild(data, {
    id,
    name: id,
    level: 23,
    equipmentIds: ['EQP-W-0009'],
    skillIds: [FIELD_A, FIELD_B, DETONATE, SPAM_SKILL, GREEDY_SKILL],
    baseStats: {
      maxHp: 2_000_000,
      maxMp: 600,
      attack: 35,
      defense: 10_000,
      agility: 10_000,
      luck: 0,
      physicalPower: 35,
      magicPower: 180,
      magicResistance: 10_000,
      accuracy: 10_000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 10_000,
      debuffResistance: 10_000,
      ...overrides,
    },
  });
}

function command(session, selector, targetInstanceId = null, localData = data) {
  const commands = listInteractiveBattleCommands({ data: localData, session });
  const chosen = selector.startsWith('SKL-')
    ? commands.find((entry) => entry.skillId === selector && entry.available !== false)
    : commands.find((entry) => entry.actionId === selector && entry.available !== false);
  assert.ok(chosen, `${selector} must be available`);
  const target = targetInstanceId
    ? chosen.targets?.find((entry) => entry.instanceId === targetInstanceId)
    : chosen.targets?.find((entry) => entry.side === 'enemy') ?? chosen.targets?.[0];
  return {
    actionId: chosen.actionId,
    ...(target ? { targetInstanceId: target.instanceId } : {}),
  };
}

function resolve(session, selector, targetInstanceId = null, localData = data) {
  const output = resolveInteractiveBattleRound({
    data: localData,
    session,
    command: command(session, selector, targetInstanceId, localData),
  });
  assert.equal(output.ok, true, `${selector}: ${output.reason ?? 'failed'}`);
  return output;
}

function policySession(seed) {
  const session = beginInteractiveBattle({
    data,
    monsterIds: ['MON-0063'],
    playerBuild: tacticalBuild(`D-policy-${seed}`),
    seed: `checkpoint-d:policy:${seed}`,
    maxTurns: 12,
  });
  const enemy = session.state.enemies[0];
  enemy.maxHp = Math.max(enemy.maxHp, 10_000_000);
  enemy.hp = enemy.maxHp;
  return session;
}

const POLICIES = Object.freeze({
  BASIC_ONLY: () => 'ATTACK',
  SINGLE_SKILL_SPAM: () => SPAM_SKILL,
  GREEDY_DAMAGE: () => GREEDY_SKILL,
  TACTICAL_ROTATION: ({ turn }) => [FIELD_A, FIELD_B, DETONATE, 'ATTACK'][turn] ?? 'ATTACK',
  RESOURCE_AWARE: ({ turn, session }) => {
    const mpRatio = session.state.players[0].mp / session.state.players[0].maxMp;
    if (turn === 0 && mpRatio > 0.5) return FIELD_A;
    if (turn === 1 && session.playerRuntimeMechanics.fields.length > 0) return DETONATE;
    return 'ATTACK';
  },
});

function runPolicy(name) {
  let session = policySession(name);
  const initialMp = session.state.players[0].mp;
  const enemyInitialHp = session.state.enemies[0].hp;
  const actions = [];
  let detonations = 0;
  for (let turn = 0; turn < 4 && session.status === 'active'; turn += 1) {
    const preferred = POLICIES[name]({ turn, session });
    const available = listInteractiveBattleCommands({ data, session });
    const canUse = preferred.startsWith('SKL-')
      ? available.some((entry) => entry.skillId === preferred && entry.available !== false)
      : available.some((entry) => entry.actionId === preferred && entry.available !== false);
    const selected = canUse ? preferred : 'ATTACK';
    const output = resolve(session, selected);
    for (const frame of output.round?.frames ?? []) {
      if (frame.actorSide !== 'player') continue;
      if ((frame.events ?? []).some((event) => event.family === 'CONSUME_OWNED_FIELD')) detonations += 1;
    }
    actions.push(selected);
    session = output.session;
  }
  const player = session.state.players[0];
  const enemy = session.state.enemies[0];
  return {
    name,
    actions,
    actionDiversity: new Set(actions).size,
    damage: enemyInitialHp - enemy.hp,
    mpSpent: initialMp - player.mp,
    hpLost: player.maxHp - player.hp,
    fieldsRemaining: session.playerRuntimeMechanics.fields.length,
    detonations,
  };
}

test('Checkpoint D compares five hand-authored battle policies through production commands', () => {
  const records = Object.keys(POLICIES).map(runPolicy);
  const byName = new Map(records.map((record) => [record.name, record]));

  assert.deepEqual(records.map((record) => record.name), [
    'BASIC_ONLY',
    'SINGLE_SKILL_SPAM',
    'GREEDY_DAMAGE',
    'TACTICAL_ROTATION',
    'RESOURCE_AWARE',
  ]);

  assert.ok(byName.get('BASIC_ONLY').damage > 0, 'basic attacks remain a valid no-MP baseline');
  assert.equal(byName.get('BASIC_ONLY').mpSpent, 0);
  assert.deepEqual(new Set(byName.get('SINGLE_SKILL_SPAM').actions), new Set([SPAM_SKILL]),
    'single-skill policy really repeats exactly one production skill');
  assert.ok(byName.get('SINGLE_SKILL_SPAM').mpSpent > 0, 'skill spam spends a real resource');
  assert.ok(byName.get('GREEDY_DAMAGE').damage > 0, 'greedy immediate damage is a functioning production line');
  assert.ok(byName.get('TACTICAL_ROTATION').actionDiversity >= 3, 'rotation deliberately changes actions');
  assert.equal(byName.get('TACTICAL_ROTATION').detonations, 1, 'tactical line deliberately cashes setup into payoff');
  assert.ok(byName.get('RESOURCE_AWARE').mpSpent <= byName.get('TACTICAL_ROTATION').mpSpent,
    'resource-aware policy preserves at least as much MP as the deeper rotation');
  assert.ok(byName.get('RESOURCE_AWARE').damage > 0, 'resource conservation does not collapse into doing nothing');
  assert.ok(new Set(records.map((record) => `${Math.round(record.damage)}:${Math.round(record.mpSpent)}:${record.detonations}`)).size >= 3,
    'the five policies produce materially distinct damage/resource/setup profiles rather than one disguised policy');

  console.log(`CHECKPOINT_D_POLICY_COMPARISON ${JSON.stringify(records)}`);
});

function forceCommanderOpeningOrder() {
  const actions = data.actionsByMonsterId.get('MON-0077') ?? [];
  const order = actions.find((entry) => entry.skillId === 'MSK-0082');
  assert.ok(order, 'MON-0077 canonical opening order must exist');
  const actionsByMonsterId = new Map(data.actionsByMonsterId);
  actionsByMonsterId.set('MON-0077', [{
    ...order,
    condition: null,
    baseWeight: 100,
    priority: 999,
    cooldownOverride: 0,
    usesPerBattle: null,
  }]);
  return { ...data, actionsByMonsterId };
}

function targetPrioritySession(seed) {
  const localData = forceCommanderOpeningOrder();
  const playerBuild = createPlayerBuild(localData, {
    id: `D-target-${seed}`,
    name: 'Checkpoint D target priority witness',
    level: 27,
    equipmentIds: ['EQP-W-0302', 'EQP-S-0001'],
    skillIds: [],
    baseStats: {
      maxHp: 10_000_000,
      maxMp: 100,
      attack: 1_000,
      defense: 30_000,
      agility: 1_000_000,
      luck: 0,
      physicalPower: 1_000,
      magicPower: 1,
      magicResistance: 30_000,
      accuracy: 100_000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 0,
      debuffResistance: 30_000,
    },
  });
  const session = beginInteractiveBattle({
    data: localData,
    // Canonical ENC-0076 core: commander + frontliners + scout.
    monsterIds: ['MON-0077', 'MON-0075', 'MON-0075', 'MON-0076'],
    playerBuild,
    seed: `checkpoint-d:target-priority:${seed}`,
    maxTurns: 4,
  });
  return { localData, session };
}

function runPriority(firstTargetMonsterId) {
  const { localData, session } = targetPrioritySession(firstTargetMonsterId);
  const target = session.state.enemies.find((entry) => entry.id === firstTargetMonsterId && entry.alive);
  assert.ok(target, `${firstTargetMonsterId} target must exist`);
  target.hp = 1; // isolate target-priority, not DPS tuning
  const output = resolveInteractiveBattleRound({
    data: localData,
    session,
    command: command(session, 'ATTACK', target.instanceId, localData),
  });
  assert.equal(output.ok, true);
  const commander = output.session.state.enemies.find((entry) => entry.id === 'MON-0077');
  const survivors = output.session.state.enemies.filter((entry) => entry.alive && entry.hp > 0);
  const orderFrame = (output.round?.frames ?? []).find((frame) =>
    frame.actorSide === 'enemy' && frame.action?.skillId === 'MSK-0082');
  return {
    firstTargetMonsterId,
    commanderAlive: Boolean(commander?.alive && commander.hp > 0),
    orderExecuted: Boolean(orderFrame),
    orderEventCount: orderFrame?.events?.length ?? 0,
    survivorIds: survivors.map((entry) => entry.id),
  };
}

test('ENC-0076 target priority changes whether the surviving commander can issue the opening order', () => {
  const commanderFirst = runPriority('MON-0077');
  const frontlineFirst = runPriority('MON-0075');

  assert.equal(commanderFirst.commanderAlive, false, 'commander-first removes the command source before enemy initiative');
  assert.equal(commanderFirst.orderExecuted, false);

  assert.equal(frontlineFirst.commanderAlive, true);
  assert.equal(frontlineFirst.orderExecuted, true, 'ignoring the commander lets the canonical opening order resolve');
  assert.ok(frontlineFirst.survivorIds.includes('MON-0077'));

  console.log(`CHECKPOINT_D_TARGET_PRIORITY ${JSON.stringify({ commanderFirst, frontlineFirst })}`);
});
