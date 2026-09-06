import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSkills } from '../lib/fixtures.mjs';
import { skillRuntimeCoverage } from '../lib/player-skill-compiler.mjs';
import { PLAYER_PROVISIONAL_SEMANTICS } from '../lib/player-provisional-semantics.mjs';

const EXPECTED_ACQUISITION_COUNTS = Object.freeze({
  basic_level_up: 63,
  flag_unlocked: 436,
  event_granted: 325,
  equipment_granted: 162,
  non_skill: 42,
  deleted: 113,
});

test('Checkpoint C source counts and all provisional semantics are explicit', () => {
  const skills = loadSkills();
  assert.equal(skills.length, 1141);

  const acquisition = {};
  for (const skill of skills) acquisition[skill.acquisitionCode] = Number(acquisition[skill.acquisitionCode] ?? 0) + 1;
  assert.deepEqual(acquisition, EXPECTED_ACQUISITION_COUNTS);
  assert.equal(acquisition.basic_level_up + acquisition.flag_unlocked, 499);
  assert.equal(skills.length - acquisition.non_skill - acquisition.deleted, 986);

  const coverage = skillRuntimeCoverage(skills);
  assert.equal(coverage.total, 1141);
  assert.equal(coverage.gateOverlays.length, 10);
  assert.equal(coverage.provisionalRows.length, 98);
  assert.equal(coverage.provisionalRegistryRows.length, 98);
  assert.deepEqual([...coverage.provisionalRows].sort(), [...coverage.provisionalRegistryRows].sort());
  assert.equal(coverage.unresolved.length, 0);

  for (const id of coverage.provisionalRows) {
    const skill = skills.find((entry) => entry.id === id);
    assert.ok(PLAYER_PROVISIONAL_SEMANTICS[id], `${id}: structured registry entry required`);
    assert.equal(skill.runtimeSemanticStatus, 'structured');
    assert.equal(skill.provisionalSemanticId, id);
    assert.ok(skill.runtimeMechanics.some((entry) => entry.source === 'structuredRegistry'));
  }

  const encore = skills.find((skill) => skill.id === 'SKL-1139');
  assert.ok(encore);
  assert.equal(encore.damage?.formula, 'repeatLastSkill');
  assert.equal(encore.runtimeMechanics.some((entry) => entry.family === 'REPEAT_LAST_SKILL' && entry.source === 'structuredRegistry'), true);
  assert.equal(encore.runtimeMechanics.some((entry) => entry.family === 'REPEAT_LAST_SKILL' && entry.source === 'powerMode'), true);
  assert.equal(PLAYER_PROVISIONAL_SEMANTICS['SKL-1139'].allowRecursion, false);

  const chainHit = skills.find((skill) => skill.id === 'SKL-1140');
  assert.ok(chainHit);
  assert.equal(chainHit.damage?.formula, 'repeatWhileHit');
  assert.deepEqual(
    chainHit.runtimeMechanics.find((entry) => entry.family === 'REPEAT_WHILE_HIT'),
    {
      family: 'REPEAT_WHILE_HIT',
      source: 'powerMode',
      hitChancePct: 30,
      maxHits: 20,
      perHitMultiplier: 2.8,
    },
  );
  assert.equal(chainHit.provisionalRuleCount, 0);
  assert.equal(chainHit.runtimeSemanticStatus, 'structured');

  const thunderCircle = skills.find((skill) => skill.id === 'SKL-0639');
  assert.deepEqual(
    thunderCircle.runtimeMechanics.find((entry) => entry.family === 'CREATE_OWNED_FIELD'),
    {
      family: 'CREATE_OWNED_FIELD',
      source: 'category',
      owner: 'player',
      fieldKind: 'magic_circle',
      fieldType: 'thunder',
      durationTurns: 3,
    },
  );

  const formationExplosion = skills.find((skill) => skill.id === 'SKL-1108');
  assert.ok(formationExplosion);
  assert.deepEqual(
    formationExplosion.runtimeMechanics.find((entry) => entry.family === 'CONSUME_OWNED_FIELD'),
    {
      family: 'CONSUME_OWNED_FIELD',
      source: 'activation',
      owner: 'player',
      fieldKind: 'magic_circle',
      extraFieldScale: 0.25,
      extraTypeScale: 0.1,
      maxScale: 2.5,
    },
  );

  const goldBurn = skills.find((skill) => skill.id === 'SKL-1141');
  assert.ok(goldBurn);
  assert.equal(goldBurn.runtimeMechanics.some((entry) => entry.family === 'GOLD_COST'), true);
  assert.deepEqual(
    goldBurn.runtimeMechanics.find((entry) => entry.family === 'GOLD_SPEND_SCALING'),
    {
      family: 'GOLD_SPEND_SCALING',
      source: 'powerMode',
      baseMultiplier: 0.55,
      logCoefficient: 0.32,
      divisor: 25,
      maxMultiplier: 2.8,
    },
  );

  const weather = ['SKL-0797', 'SKL-1020'].map((id) => PLAYER_PROVISIONAL_SEMANTICS[id]);
  assert.ok(weather.every((entry) => entry.battleLocalOnly === true && entry.worldWeatherMutation === false));

  console.log(`PLAYER_SKILL_COMPILER_C ${JSON.stringify({
    acquisition,
    total: coverage.total,
    provisionalRows: coverage.provisionalRows.length,
    provisionalRegistryRows: coverage.provisionalRegistryRows.length,
    unresolved: coverage.unresolved.length,
    gateOverlays: coverage.gateOverlays.length,
    mechanicCounts: coverage.mechanicCounts,
  })}`);
});
