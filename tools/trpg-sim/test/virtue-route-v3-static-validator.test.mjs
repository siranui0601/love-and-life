import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseCsv } from '../export-virtue-route-v2-source.mjs';
import { validateStaticRoute } from '../validate-virtue-route-v3-static.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const COMPILER = path.join(ROOT, 'tools/trpg-sim/compile-virtue-route-v3.mjs');
const SOURCE = path.join(ROOT, 'docs/trpg/virtue-route-v2-source.csv');

test('v3 static ledger proves canonical resources without replay', async (t) => {
  const compileDir = await mkdtemp(path.join(os.tmpdir(), 'virtue-v3-compile-'));
  const validationDir = await mkdtemp(path.join(os.tmpdir(), 'virtue-v3-validation-'));
  t.after(async () => Promise.all([
    rm(compileDir, { recursive: true, force: true }),
    rm(validationDir, { recursive: true, force: true }),
  ]));

  execFileSync(process.execPath, [COMPILER, SOURCE, compileDir], {
    cwd: ROOT,
    env: { ...process.env, GITHUB_SHA: 'STATIC-VALIDATOR-TEST' },
    stdio: 'pipe',
  });
  const summary = validateStaticRoute({
    mappingPath: path.join(compileDir, 'virtue-route-v3-mapping.csv'),
    sourcePath: SOURCE,
    outDir: validationDir,
  });

  assert.equal(summary.result, 'PASS');
  assert.equal(summary.errorCount, 0);
  assert.equal(summary.mappingRows, 831);
  assert.equal(summary.checks.unmapped, 0);
  assert.equal(summary.checks.unknown, 0);
  assert.equal(summary.checks.todo, 0);
  assert.equal(summary.checks.partial, 0);
  assert.equal(summary.checks.workCommands, 101);
  assert.equal(summary.checks.workFacilityDayDuplicates, 0);
  assert.equal(summary.checks.workWindowViolations, 0);
  assert.equal(summary.checks.workConditionViolations, 0);
  assert.equal(summary.checks.provisionUnderflows, 0);
  assert.equal(summary.checks.insufficientGoldRows, 0);
  assert.equal(summary.checks.workerLodgingViolations, 0);
  assert.equal(summary.checks.missingRuntimeMissionActions, 0);
  assert.equal(summary.checks.missingRuntimeEncounters, 0);
  assert.equal(summary.economy.minimumGold, 0);
  assert.equal(summary.economy.finalGold, 34);
  assert.equal(summary.economy.totalIncome, 981);
  assert.equal(summary.economy.totalExpense, 947);
  assert.deepEqual(summary.economy.finalProvisionInventory, {});
  assert.equal(summary.economy.debtStatus, 'paid');
  assert.equal(summary.progression.staticRouteSeed, 'virtue-route-v3-static-20260816');
  assert.equal(summary.progression.totalExp, 39656);
  assert.equal(summary.progression.battleExp, 37226);
  assert.equal(summary.progression.missionExp, 2430);
  assert.equal(summary.progression.expIntoFinalLevel, 4022);
  assert.equal(summary.progression.finalLevel, 23);
  assert.equal(summary.progression.totalSp, 24);
  assert.equal(summary.progression.finalSp, 13);
  assert.equal(summary.progression.learnedSkillCount, 11);
  assert.equal(summary.progression.experienceTransitions.length, 29);
  assert.ok(summary.progression.legacyLevelMismatchRowCount > 0);
  assert.deepEqual(summary.equipment.finalEquipped, {
    body: 'EQP-A-0203',
    offHand: 'EQP-S-0201',
    mainHand: 'EQP-W-0302',
  });
  assert.equal(Object.keys(summary.world.incidentStates).length, 19);
  assert.equal(summary.world.incidentStates.T15, 'suppressed');
  assert.equal(summary.world.incidentStates.T19, 'suppressed');
  assert.equal(summary.world.incidentStates.T20, undefined);
  assert.equal(summary.replayExecuted, false);
  assert.equal(summary.combatExecuted, false);

  const ledger = parseCsv(await readFile(path.join(validationDir, 'virtue-route-v3-static-ledger.csv'), 'utf8'));
  assert.equal(ledger.length, 832);
  assert.equal(ledger[0][0], 'legacyRowId');
  assert.ok(ledger[0].includes('totalExp'));
  assert.equal(ledger.at(-1)[0], 'VR2-D85-10');
});
