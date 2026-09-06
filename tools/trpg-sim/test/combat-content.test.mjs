import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
  simulateBattle,
} from '../lib/battle-simulator.mjs';
import { buildCombatContentAudit, certifyBattleTimeline } from '../lib/combat-certification.mjs';

const data = await loadBattleData();

function observer(overrides = {}) {
  return createPlayerBuild(data, {
    id: 'combat-contract-observer',
    level: 30,
    equipmentIds: [],
    skillIds: [],
    baseStats: {
      maxHp: 100_000, maxMp: 100, attack: 0, defense: 200, agility: 1, luck: 0,
      physicalPower: 1, magicPower: 1, magicResistance: 200, accuracy: 0, evasion: 0,
      critical: 0, debuffSuccess: 0, debuffResistance: 100,
      ...overrides,
    },
  });
}

function eventTypes(result) {
  return result.timeline.frames.flatMap((frame) => frame.events ?? []).map((event) => event.type);
}

test('all canonical monster content and the nine-boss catalog pass the static runtime contract', () => {
  const audit = buildCombatContentAudit(data);
  assert.equal(audit.runtimeContract.runtimeReady, true);
  assert.equal(audit.counts.monsters, 77);
  assert.equal(audit.counts.bosses, 9);
  assert.equal(audit.counts.monsterActions, 286);
  assert.deepEqual(audit.runtimeContract.unresolvedCommands, []);
  assert.deepEqual(audit.runtimeContract.monstersWithoutUnconditionalAction, []);
  assert.ok(audit.monsters.every((monster) => monster.tacticalIdentity.length > 0));
  assert.ok(audit.bosses.every((boss) => boss.coreGimmicks.length >= 1 && boss.coreGimmicks.length <= 3));
  assert.ok(audit.bosses.every((boss) => boss.supportedBuilds.length >= 2));
});

test('taunt is a real target restriction rather than a decorative state', () => {
  const session = beginInteractiveBattle({
    data, seed: 'taunt-target-contract', monsterIds: ['MON-0005', 'MON-0039'],
    playerBuild: observer(), maxTurns: 2,
  });
  const taunter = session.state.enemies.find((enemy) => enemy.id === 'MON-0039');
  taunter.specialStates.set('taunt', { duration: 2, params: { targetPolicy: 'force_single_target' } });
  const attack = listInteractiveBattleCommands({ data, session })
    .find((command) => command.actionId === 'ATTACK');
  assert.deepEqual(attack.targets.map((target) => target.instanceId), [taunter.instanceId]);
});

test('summon, field change, phase and one-turn telegraph execute as real timeline events', () => {
  const wolf = simulateBattle({
    data, seed: 'command-events:MON-0007', monsterIds: ['MON-0007'],
    playerBuild: observer(), maxTurns: 8, captureTimeline: true,
  });
  const slime = simulateBattle({
    data, seed: 'command-events:MON-0017', monsterIds: ['MON-0017'],
    playerBuild: observer(), maxTurns: 10, captureTimeline: true,
  });
  assert.ok(eventTypes(wolf).includes('summon'));
  assert.ok(wolf.enemies.length > 1, 'summoned wolves must join server state, not only the log');
  assert.ok(eventTypes(slime).includes('field_change'));
  assert.ok(eventTypes(slime).includes('telegraph'));
  assert.ok(eventTypes(slime).includes('phase_transition'));
  assert.equal(wolf.candidateExhaustion + slime.candidateExhaustion, 0);
  assert.equal(wolf.fallbackAttacks + slime.fallbackAttacks, 0);
});

test('enemy escape and cast interruption commands reach the authoritative interactive state', () => {
  let session = beginInteractiveBattle({
    data, seed: 'enemy-escape-command', monsterIds: ['MON-0024'],
    playerBuild: observer(), maxTurns: 3,
  });
  session.state.enemies[0].hp = 1;
  let resolved = resolveInteractiveBattleRound({ data, session, command: { actionId: 'DEFEND' } });
  const escape = resolved.round.frames.flatMap((frame) => frame.events ?? []).find((event) => event.type === 'escape');
  assert.equal(escape?.succeeded, true);
  assert.equal(resolved.session.state.enemies[0].escaped, true);

  session = beginInteractiveBattle({
    data, seed: 'enemy-interrupt-command', monsterIds: ['MON-0076'],
    playerBuild: observer(), maxTurns: 3,
  });
  session.state.players[0].specialStates.set('casting', { duration: 3, params: {} });
  resolved = resolveInteractiveBattleRound({ data, session, command: { actionId: 'DEFEND' } });
  const interrupt = resolved.round.frames.flatMap((frame) => frame.events ?? []).find((event) => event.type === 'interrupt');
  assert.equal(interrupt?.results?.[0]?.wasCasting, true);
  assert.equal(interrupt?.results?.[0]?.chance, 0.65);
});

test('combat certification records choice, action diversity, repetition, statuses, resources and gimmicks', () => {
  const result = simulateBattle({
    data, seed: 'certification-contract', monsterIds: ['MON-0018'],
    playerBuild: observer(), maxTurns: 8, captureTimeline: true,
  });
  const certification = certifyBattleTimeline(result, {
    certificationId: 'CERT-CONTRACT', bossId: 'BOSS-T13-WORLD-TREE-EATER', monsterId: 'MON-0018',
  });
  assert.equal(certification.candidateExhaustion, 0);
  assert.equal(certification.fallbackAttacks, 0);
  assert.ok(certification.enemySkillUseCount > 0);
  assert.ok(certification.enemyActionVariety > 1);
  assert.ok(certification.phaseTransitions.length > 0);
  assert.ok(certification.gimmickInteractionCount > 0);
  assert.ok(Number.isInteger(certification.maximumConsecutiveEnemyAction));
});
