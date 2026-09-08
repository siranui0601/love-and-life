import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseCsv } from '../export-virtue-route-v2-source.mjs';
import {
  buildSheetArtifacts,
  SHEET_EXPORT_FILES,
} from '../export-virtue-route-v3-sheets.mjs';
import { validateStaticRoute } from '../validate-virtue-route-v3-static.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const COMPILER = path.join(ROOT, 'tools/trpg-sim/compile-virtue-route-v3.mjs');
const SOURCE = path.join(ROOT, 'docs/trpg/virtue-route-v2-source.csv');

test('v3 Google Sheets artifacts are complete and deterministic without replay', async (t) => {
  const firstDir = await mkdtemp(path.join(os.tmpdir(), 'virtue-v3-sheet-first-'));
  const secondDir = await mkdtemp(path.join(os.tmpdir(), 'virtue-v3-sheet-second-'));
  const compileDir = await mkdtemp(path.join(os.tmpdir(), 'virtue-v3-sheet-compile-'));
  const validationDir = await mkdtemp(path.join(os.tmpdir(), 'virtue-v3-sheet-validation-'));
  t.after(async () => Promise.all([
    rm(firstDir, { recursive: true, force: true }),
    rm(secondDir, { recursive: true, force: true }),
    rm(compileDir, { recursive: true, force: true }),
    rm(validationDir, { recursive: true, force: true }),
  ]));

  execFileSync(process.execPath, [COMPILER, SOURCE, compileDir], {
    cwd: ROOT,
    env: { ...process.env, GITHUB_SHA: 'STATIC-SHEET-EXPORT-TEST' },
    stdio: 'pipe',
  });
  validateStaticRoute({
    mappingPath: path.join(compileDir, 'virtue-route-v3-mapping.csv'),
    sourcePath: SOURCE,
    outDir: validationDir,
  });
  const inputs = {
    mappingPath: path.join(compileDir, 'virtue-route-v3-mapping.csv'),
    movesPath: path.join(compileDir, 'virtue-route-v3-proposed-local-moves.json'),
    ledgerPath: path.join(validationDir, 'virtue-route-v3-static-ledger.csv'),
    validationPath: path.join(validationDir, 'virtue-route-v3-static-validation.json'),
    compilerSummaryPath: path.join(compileDir, 'virtue-route-v3-static-summary.json'),
  };
  const first = buildSheetArtifacts({ ...inputs, outDir: firstDir });
  const second = buildSheetArtifacts({ ...inputs, outDir: secondDir });

  assert.deepEqual(second, first);
  assert.equal(first.exporterVersion, 'virtue-route-v3-sheet-export-v1');
  assert.equal(first.validationResult, 'PASS');
  assert.equal(first.sourceRows, 831);
  assert.equal(first.sheets['正規台帳_v3'].rows, 1526);
  assert.equal(first.sheets['正規台帳_v3'].columns, 46);
  assert.equal(first.sheets['v2_v3対応表'].rows, 831);
  assert.equal(first.sheets['v2_v3対応表'].columns, 17);
  assert.equal(first.sheets['静的検証_v3'].rows, 149);
  assert.equal(first.sheets['静的検証_v3'].columns, 4);
  assert.equal(first.moveLocalRows, 336);
  assert.equal(first.regionalMoveRows, 50);
  assert.equal(first.unmapped, 0);
  assert.equal(first.unknown, 0);
  assert.equal(first.todo, 0);
  assert.equal(first.partial, 0);
  assert.equal(first.replayExecuted, false);
  assert.equal(first.combatExecuted, false);

  for (const file of Object.values(SHEET_EXPORT_FILES)) {
    assert.equal(
      await readFile(path.join(firstDir, file), 'utf8'),
      await readFile(path.join(secondDir, file), 'utf8'),
      `${file} must be byte-for-byte deterministic`,
    );
  }

  const ledger = parseCsv(await readFile(path.join(firstDir, SHEET_EXPORT_FILES.ledger), 'utf8'));
  assert.equal(ledger.length, 1527);
  assert.equal(ledger[0].length, 46);
  assert.equal(ledger[1][0], 'VR3-000001');
  assert.equal(ledger.at(-1)[0], 'VR3-001526');
  assert.equal(ledger.at(-1)[ledger[0].indexOf('goldAfter')], '34');
  assert.equal(ledger.at(-1)[ledger[0].indexOf('level')], '23');
  assert.equal(ledger.at(-1)[ledger[0].indexOf('totalExp')], '39656');

  const mapping = parseCsv(await readFile(path.join(firstDir, SHEET_EXPORT_FILES.mapping), 'utf8'));
  assert.equal(mapping.length, 832);
  assert.equal(mapping[0].length, 17);
  const v3CountIndex = mapping[0].indexOf('v3RowCount');
  const v3IdsIndex = mapping[0].indexOf('v3RowIds');
  assert.ok(mapping.slice(1).every((row) => Number(row[v3CountIndex]) >= 1));
  assert.ok(mapping.slice(1).every((row) => row[v3IdsIndex].startsWith('VR3-')));

  const validation = parseCsv(await readFile(path.join(firstDir, SHEET_EXPORT_FILES.validation), 'utf8'));
  assert.equal(validation.length, 150);
  const validationRows = new Map(validation.slice(1).map((row) => [`${row[0]}:${row[1]}`, row[2]]));
  assert.equal(validationRows.get('economy:finalGold'), '34');
  assert.equal(validationRows.get('progression:totalExp'), '39656');
  assert.equal(validationRows.get('progression:finalLevel'), '23');
  assert.equal(validationRows.get('checks:replayExecuted'), 'false');
  assert.equal(validationRows.get('checks:combatExecuted'), 'false');
});
