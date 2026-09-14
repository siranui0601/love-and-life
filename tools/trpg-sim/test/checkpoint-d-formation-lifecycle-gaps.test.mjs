import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  activeMagicFormations,
  beginInteractiveBattle,
  clearFormationsOnBattleEnd,
  normalizeFormationRuntime,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

function build() {
  return createPlayerBuild(data, {
    id: 'checkpoint-d-formation-lifecycle-gap-witness',
    name: 'Formation lifecycle gap witness',
    level: 23,
    equipmentIds: ['EQP-W-0009'],
    skillIds: ['SKL-0640'],
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

function begin() {
  return beginInteractiveBattle({
    data,
    monsterIds: ['MON-0063'],
    playerBuild: build(),
    seed: 'checkpoint-d:formation:lifecycle:gaps',
    maxTurns: 20,
  });
}

function pushFormation(session, overrides = {}) {
  const formation = {
    instanceId: 'FORMATION-GAP-1',
    owner: 'player',
    kind: 'magic_circle',
    fieldKind: 'magicFormation',
    sourceSkillId: 'SKL-0640',
    sourceSkillName: '風陣',
    formationFamily: 'wind',
    remainingTurns: 2,
    enhancementLevel: 0,
    dualFormationApplied: false,
    concentrationRequired: false,
    breakable: true,
    active: true,
    ...overrides,
  };
  session.playerRuntimeMechanics.fields ??= [];
  session.playerRuntimeMechanics.fields.push(formation);
  normalizeFormationRuntime(session, data);
  return formation.instanceId;
}

test('[MECHANIC_WITNESS] same-battle wave transition preserves active Formation remainingTurns', () => {
  const session = begin();
  const id = pushFormation(session, { remainingTurns: 2 });
  const before = activeMagicFormations(session)[0];
  session.state.enemies = session.state.enemies.map((enemy, index) => ({
    ...enemy,
    instanceId: `wave2-${index}`,
    hp: enemy.maxHp,
    alive: true,
  }));
  session.status = 'active';
  normalizeFormationRuntime(session, data);
  const after = activeMagicFormations(session).find((field) => field.instanceId === id);
  assert.ok(after, 'active Formation persists across same-battle wave handoff');
  assert.equal(after.remainingTurns, before.remainingTurns, 'wave handoff does not consume or refresh remainingTurns');
});

test('[MECHANIC_WITNESS] flee clears Formation instances but does not clear generic non-Formation fields', () => {
  const session = begin();
  const id = pushFormation(session);
  session.playerRuntimeMechanics.fields.push({
    instanceId: 'GENERIC-TERRAIN-1',
    owner: 'player',
    kind: 'magic_circle',
    fieldKind: 'terrain',
    sourceSkillId: 'TEST-TERRAIN',
    remainingTurns: 99,
    active: true,
  });
  session.status = 'finished';
  session.winner = 'fled';
  const cleared = clearFormationsOnBattleEnd(session);
  assert.deepEqual(cleared.map((field) => field.instanceId), [id]);
  assert.equal(activeMagicFormations(session).length, 0);
  assert.equal((session.playerRuntimeMechanics.fields ?? []).some((field) => field.instanceId === 'GENERIC-TERRAIN-1'), true,
    'generic field lifecycle is not double-processed by Formation cleanup');
});

test('[MECHANIC_WITNESS] Formation identity survives JSON save/restore roundtrip shape', () => {
  const session = begin();
  const id = pushFormation(session, {
    remainingTurns: 4,
    enhancementLevel: 1,
    dualFormationApplied: true,
  });
  const restored = JSON.parse(JSON.stringify({
    status: 'active',
    state: { turn: session.state.turn },
    playerRuntimeMechanics: session.playerRuntimeMechanics,
  }));
  normalizeFormationRuntime(restored, data);
  const formation = activeMagicFormations(restored).find((field) => field.instanceId === id);
  assert.ok(formation);
  assert.equal(formation.sourceSkillId, 'SKL-0640');
  assert.equal(formation.formationFamily, 'wind');
  assert.equal(formation.remainingTurns, 4);
  assert.equal(formation.enhancementLevel, 1);
  assert.equal(formation.dualFormationApplied, true);
});
