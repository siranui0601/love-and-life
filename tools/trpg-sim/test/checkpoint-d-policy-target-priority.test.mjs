import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, createSeededRng, expandEncounter, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';
import { CHECKPOINT_C_LEGAL_BUILDS } from '../lib/player-legal-builds-checkpoint-c.mjs';

const data = await loadBattleData();

const FIELD_A = 'SKL-0639';
const FIELD_B = 'SKL-0640';
const DETONATE = 'SKL-1108';
const SPAM_SKILL = 'SKL-0001';
const GREEDY_SKILL = 'SKL-0665';
const POLICY_LAYER = 'MECHANIC_WITNESS';

// D-0: the five-policy harness deliberately injects skills and uses extreme stats / enemy HP
// so it can isolate command-policy behavior. It is not GAMEPLAY_CERT.
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

test('[MECHANIC_WITNESS] five policy shapes remain distinct without inventing resource cost for SKL-0001', () => {
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
  // Canonical v4: SKL-0001 スラッシュ has MP=0 and HP cost=0. Resource use is therefore
  // expected to remain zero here; making it consume MP would be a production/canonical bug.
  assert.equal(byName.get('SINGLE_SKILL_SPAM').mpSpent, 0, 'canonical zero-cost slash must stay zero-cost');
  assert.ok(byName.get('GREEDY_DAMAGE').damage > 0, 'greedy immediate damage is a functioning runtime line');
  assert.ok(byName.get('GREEDY_DAMAGE').mpSpent > 0, 'SKL-0665 is the canonical MP-consuming resource-pressure witness');
  assert.ok(byName.get('TACTICAL_ROTATION').actionDiversity >= 3, 'rotation deliberately changes actions');
  assert.equal(byName.get('TACTICAL_ROTATION').detonations, 1, 'tactical line deliberately cashes setup into payoff');
  assert.ok(byName.get('RESOURCE_AWARE').mpSpent <= byName.get('TACTICAL_ROTATION').mpSpent,
    'resource-aware policy preserves at least as much MP as the deeper rotation');
  assert.ok(byName.get('RESOURCE_AWARE').damage > 0, 'resource conservation does not collapse into doing nothing');
  assert.ok(new Set(records.map((record) => `${Math.round(record.damage)}:${Math.round(record.mpSpent)}:${record.detonations}`)).size >= 3,
    'the policies produce distinct mechanic profiles rather than one disguised policy');

  console.log(`CHECKPOINT_D_POLICY_MECHANIC_WITNESS ${JSON.stringify({ certificationLayer: POLICY_LAYER, records })}`);
});

// Forced action / extreme-stat isolation is retained only to prove that the canonical order
// action can execute through the production battle engine. It does NOT prove target priority.
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

test('[MECHANIC_WITNESS] MON-0077 号令 executes when isolated by the harness', () => {
  const localData = forceCommanderOpeningOrder();
  const playerBuild = createPlayerBuild(localData, {
    id: 'D-order-mechanic-witness',
    name: 'D order mechanic witness',
    level: 27,
    equipmentIds: ['EQP-W-0302', 'EQP-S-0001'],
    skillIds: [],
    baseStats: {
      maxHp: 10_000_000,
      maxMp: 100,
      attack: 100,
      defense: 30_000,
      agility: 1,
      luck: 0,
      physicalPower: 100,
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
    monsterIds: ['MON-0077', 'MON-0075', 'MON-0075', 'MON-0076'],
    playerBuild,
    seed: 'checkpoint-d:order-mechanic-witness',
    maxTurns: 2,
  });
  const output = resolve(session, 'DEFEND', null, localData);
  const orderFrame = (output.round?.frames ?? []).find((frame) => frame.actorSide === 'enemy' && frame.action?.skillId === 'MSK-0082');
  assert.ok(orderFrame, 'isolated canonical order must execute through production runtime');
  console.log(`CHECKPOINT_D_ORDER_MECHANIC_WITNESS ${JSON.stringify({ certificationLayer: 'MECHANIC_WITNESS', orderExecuted: true })}`);
});

function canonicalEncounterMonsterIds() {
  const encounter = data.encounterById.get('ENC-0076');
  assert.ok(encounter, 'canonical ENC-0076 must exist');
  return expandEncounter(data, encounter, createSeededRng('checkpoint-d:enc0076:canonical-composition'));
}

function canonicalProbeBuild(id) {
  const guardian = CHECKPOINT_C_LEGAL_BUILDS.find((entry) => entry.id === 'virtue-guardian-breaker');
  assert.ok(guardian, 'Checkpoint C legal Guardian/Breaker build must exist');
  // No skill is injected for this probe: target-priority is measured with the built-in ATTACK.
  // The equipment pair is the C-certified legal one-handed axe + shield pair.
  return createPlayerBuild(data, {
    id,
    name: 'ENC-0076 canonical target-priority probe',
    level: guardian.level,
    equipmentIds: guardian.equipmentIds,
    skillIds: [],
  });
}

function runCanonicalPriorityProbe(strategy) {
  const monsterIds = canonicalEncounterMonsterIds();
  let session = beginInteractiveBattle({
    data,
    monsterIds,
    playerBuild: canonicalProbeBuild(`enc0076-${strategy}`),
    seed: 'checkpoint-d:enc0076:canonical-battle',
    maxTurns: 12,
  });
  for (const enemy of session.state.enemies) {
    const canonical = data.monsterById.get(enemy.id);
    assert.equal(enemy.maxHp, canonical.maxHp, `${enemy.id} HP must remain canonical in gameplay probe`);
  }
  const playerInitialHp = session.state.players[0].hp;
  const playerInitialMp = session.state.players[0].mp;
  const enemySkillIds = [];
  const targetHistory = [];
  let rounds = 0;
  let orderCount = 0;

  while (session.status === 'active' && rounds < 12) {
    const living = session.state.enemies.filter((entry) => entry.alive && entry.hp > 0);
    if (!living.length) break;
    let preferred = null;
    if (strategy === 'commander-first') {
      preferred = living.find((entry) => entry.id === 'MON-0077') ?? living[0];
    } else {
      preferred = living.find((entry) => entry.id === 'MON-0075')
        ?? living.find((entry) => entry.id !== 'MON-0077')
        ?? living[0];
    }
    targetHistory.push(preferred.id);
    const output = resolve(session, 'ATTACK', preferred.instanceId);
    for (const frame of output.round?.frames ?? []) {
      if (frame.actorSide !== 'enemy' || !frame.action?.skillId) continue;
      enemySkillIds.push(frame.action.skillId);
      if (frame.action.skillId === 'MSK-0082') orderCount += 1;
    }
    session = output.session;
    rounds += 1;
  }

  const player = session.state.players[0];
  return {
    layer: 'CANONICAL_GAMEPLAY_PROBE',
    gameplayCert: false,
    gameplayCertBlocker: 'world acquisition/grant state is not reconstructed in this bounded probe',
    strategy,
    composition: monsterIds,
    rounds,
    winner: session.winner ?? null,
    status: session.status,
    damageTaken: Math.max(0, playerInitialHp - player.hp),
    mpSpent: Math.max(0, playerInitialMp - player.mp),
    orderCount,
    enemySkillIds,
    targetHistory,
  };
}

test('[CANONICAL_GAMEPLAY_PROBE] ENC-0076 compares target priorities without changing enemy HP, actions or priority', () => {
  const commanderFirst = runCanonicalPriorityProbe('commander-first');
  const alternativeFirst = runCanonicalPriorityProbe('alternative-first');
  assert.deepEqual(commanderFirst.composition, alternativeFirst.composition, 'both lines must use the same canonical expanded encounter');
  assert.ok(commanderFirst.rounds > 0 && alternativeFirst.rounds > 0);
  assert.equal(commanderFirst.mpSpent, 0, 'built-in ATTACK does not invent a resource cost');
  assert.equal(alternativeFirst.mpSpent, 0);
  console.log(`CHECKPOINT_D_ENC0076_CANONICAL_PROBE ${JSON.stringify({ commanderFirst, alternativeFirst })}`);
});
