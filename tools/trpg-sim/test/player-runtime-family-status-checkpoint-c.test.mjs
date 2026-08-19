import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSkills } from '../lib/fixtures.mjs';
import { skillRuntimeCoverage } from '../lib/player-skill-compiler.mjs';
import { auditPlayerRuntimeFamilies } from '../lib/player-runtime-family-status.mjs';

test('Checkpoint C classifies every emitted player mechanic family', () => {
  const coverage = skillRuntimeCoverage(loadSkills());
  const audit = auditPlayerRuntimeFamilies(coverage.mechanicCounts);
  assert.equal(audit.rows.length, Object.keys(coverage.mechanicCounts).length);
  assert.equal(audit.rows.some((row) => row.status === 'UNMODELED'), false, 'every emitted family must have an explicit classification');
  assert.equal(audit.rows.find((row) => row.family === 'REPEAT_LAST_SKILL')?.status, 'EXECUTED');
  assert.equal(audit.rows.find((row) => row.family === 'REPEAT_WHILE_HIT')?.status, 'EXECUTED');
  assert.equal(audit.rows.find((row) => row.family === 'CREATE_OWNED_FIELD')?.status, 'EXECUTED');
  assert.equal(audit.rows.find((row) => row.family === 'CONSUME_OWNED_FIELD')?.status, 'EXECUTED');
  assert.equal(audit.rows.find((row) => row.family === 'GOLD_SPEND_SCALING')?.status, 'EXECUTED');
  console.log(`PLAYER_RUNTIME_FAMILY_STATUS ${JSON.stringify({ summary: audit.summary, unresolved: audit.unresolved.map((row) => row.family), partial: audit.partial.map((row) => row.family) })}`);
});
