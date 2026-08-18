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
  assert.equal(chainHit.runtimeMechanics.some((entry) => entry.family === 'REPEAT_WHILE_HIT'), true);
  assert.equal(chainHit.provisionalRuleCount, 0);
  assert.equal(chainHit.runtimeSemanticStatus, 'structured');

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
