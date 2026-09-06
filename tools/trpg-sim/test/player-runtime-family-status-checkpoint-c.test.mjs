import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSkills } from '../lib/fixtures.mjs';
import { skillRuntimeCoverage } from '../lib/player-skill-compiler.mjs';
import { auditPlayerRuntimeFamilies } from '../lib/player-runtime-family-status.mjs';

test('Checkpoint C executes every emitted player mechanic family', () => {
  const coverage = skillRuntimeCoverage(loadSkills());
  const audit = auditPlayerRuntimeFamilies(coverage.mechanicCounts);
  assert.equal(audit.rows.length, Object.keys(coverage.mechanicCounts).length);
  assert.deepEqual(audit.unresolved, [], 'no emitted family may remain compiled-only, partial or unmodeled');
  assert.deepEqual(audit.partial, []);
  assert.equal(audit.summary.EXECUTED, audit.rows.length);
  assert.equal(audit.summary.COMPILED_ONLY, 0);
  assert.equal(audit.summary.PARTIAL, 0);
  assert.equal(audit.summary.UNMODELED, 0);
  for (const family of ['REPEAT_LAST_SKILL','REPEAT_WHILE_HIT','CREATE_OWNED_FIELD','CONSUME_OWNED_FIELD','GOLD_SPEND_SCALING','DELAYED_ACTION','PASSIVE_AUTO_GUARD','MODIFY_SKILL_COST','COPY_ACTION','RESOURCE_DRAIN']) {
    assert.equal(audit.rows.find((row) => row.family === family)?.status, 'EXECUTED', family);
  }
  console.log(`PLAYER_RUNTIME_FAMILY_STATUS ${JSON.stringify({ summary: audit.summary, unresolved: [], partial: [] })}`);
});
