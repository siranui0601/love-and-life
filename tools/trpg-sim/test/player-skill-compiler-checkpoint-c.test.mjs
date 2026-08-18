import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSkills } from '../lib/fixtures.mjs';
import { skillRuntimeCoverage } from '../lib/player-skill-compiler.mjs';

const EXPECTED_ACQUISITION_COUNTS = Object.freeze({
  basic_level_up: 63,
  flag_unlocked: 436,
  event_granted: 325,
  equipment_granted: 162,
  non_skill: 42,
  deleted: 113,
});

test('Checkpoint C source counts and provisional semantics fail closed', () => {
  const skills = loadSkills();
  assert.equal(skills.length, 1141);

  const acquisition = {};
  for (const skill of skills) {
    acquisition[skill.acquisitionCode] = Number(acquisition[skill.acquisitionCode] ?? 0) + 1;
  }
  assert.deepEqual(acquisition, EXPECTED_ACQUISITION_COUNTS);
  assert.equal(acquisition.basic_level_up + acquisition.flag_unlocked, 499);
  assert.equal(skills.length - acquisition.non_skill - acquisition.deleted, 986);

  const coverage = skillRuntimeCoverage(skills);
  assert.equal(coverage.total, 1141);
  assert.equal(coverage.gateOverlays.length, 10);
  assert.equal(coverage.provisionalRows.length, 98);

  // A description/provisionalRule may suggest a mechanic family for audit
  // grouping, but that prose is never accepted as executable semantics.
  const unresolved = new Set(coverage.unresolved);
  for (const id of coverage.provisionalRows) assert.ok(unresolved.has(id), `${id} must fail closed until structured semantics exist`);

  const encore = skills.find((skill) => skill.id === 'SKL-1139');
  assert.ok(encore);
  assert.equal(encore.damage?.formula, 'repeatLastSkill');
  assert.equal(encore.runtimeMechanics.some((entry) => entry.family === 'REPEAT_LAST_SKILL' && entry.source === 'powerMode'), true);
  assert.equal(encore.runtimeSemanticStatus, 'needs_semantics');
  assert.ok(encore.inferredProvisionalMechanics.some((entry) => entry.family === 'REPEAT_LAST_SKILL'));

  const chainHit = skills.find((skill) => skill.id === 'SKL-1140');
  assert.ok(chainHit);
  assert.equal(chainHit.damage?.formula, 'repeatWhileHit');
  assert.equal(chainHit.runtimeMechanics.some((entry) => entry.family === 'REPEAT_WHILE_HIT'), true);
  assert.equal(chainHit.provisionalRuleCount, 0);
  assert.equal(chainHit.runtimeSemanticStatus, 'structured');

  console.log(`PLAYER_SKILL_COMPILER_C ${JSON.stringify({
    acquisition,
    total: coverage.total,
    provisionalRows: coverage.provisionalRows.length,
    unresolved: coverage.unresolved.length,
    gateOverlays: coverage.gateOverlays.length,
    inferredProvisionalMechanicCounts: coverage.inferredProvisionalMechanicCounts,
  })}`);
});
