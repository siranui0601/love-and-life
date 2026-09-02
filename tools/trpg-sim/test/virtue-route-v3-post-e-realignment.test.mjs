import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseCsv } from '../export-virtue-route-v2-source.mjs';
import { realignPostEArtifacts, POST_E_REALIGNMENT_VERSION } from '../realign-virtue-route-v3-post-e.mjs';
import { validateStaticRoute } from '../validate-virtue-route-v3-static.mjs';
import { buildSheetArtifacts, SHEET_EXPORT_FILES } from '../export-virtue-route-v3-sheets.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const COMPILER = path.join(ROOT, 'tools/trpg-sim/compile-virtue-route-v3.mjs');
const SOURCE = path.join(ROOT, 'docs/trpg/virtue-route-v2-source.csv');
const EVENING_ACTION = 'MISSION_FLOW:T01:EVENING_FREE_TIME:maintain_and_rest';
const MERCHANT_HELP_ACTION = 'MISSION_FLOW:T01:DAY2_MERCHANT:help_unload';
const EXPECTED_T01_ACTIONS = [
  'ACTION:MSN-T01:search:tracks',
  'ACTION:MSN-T01:search:wolf-blockade',
  'ACTION:MSN-T01:rescue',
  'ACTION:MSN-T01:escort',
  'MOVE_LOCAL:LOC_FARM_SQUARE',
  'ACTION:MSN-T01:decide',
];
const EXPECTED_DAY2_BREAKFAST_ACTIONS = [
  'LIFE:BUY:ITM008',
  'LIFE:EAT:ITM008',
  MERCHANT_HELP_ACTION,
];
const EXPECTED_DAY2_BREAKFAST_LEDGER_ACTIONS = [
  'MOVE_LOCAL:LOC_FARM_BAKERY',
  ...EXPECTED_DAY2_BREAKFAST_ACTIONS,
];

function rowObjects(text) {
  const [headers, ...matrix] = parseCsv(text);
  return matrix.filter((row) => row.some((cell) => cell !== '')).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function actionIds(row) {
  if (!row.replacementSteps) return row.actionId ? [row.actionId] : [];
  return JSON.parse(row.replacementSteps).map((step) => step.actionId);
}

test('post-E Human Virtue realignment removes stale opening assumptions and uses visible production Day1/Day2 transitions', async (t) => {
  const compileDir = await mkdtemp(path.join(os.tmpdir(), 'virtue-v3-post-e-compile-'));
  const validationDir = await mkdtemp(path.join(os.tmpdir(), 'virtue-v3-post-e-validation-'));
  const sheetDir = await mkdtemp(path.join(os.tmpdir(), 'virtue-v3-post-e-sheet-'));
  t.after(async () => Promise.all([
    rm(compileDir, { recursive: true, force: true }),
    rm(validationDir, { recursive: true, force: true }),
    rm(sheetDir, { recursive: true, force: true }),
  ]));

  execFileSync(process.execPath, [COMPILER, SOURCE, compileDir], {
    cwd: ROOT,
    env: { ...process.env, GITHUB_SHA: 'POST-E-REALIGNMENT-TEST' },
    stdio: 'pipe',
  });
  const realigned = realignPostEArtifacts({ outDir: compileDir });
  assert.equal(realigned.version, POST_E_REALIGNMENT_VERSION);
  assert.equal(realigned.mappedRows, 831);
  assert.equal(realigned.expandedV3Rows, 1526);
  assert.equal(realigned.proposedMoveLocalInsertions, 334);
  assert.deepEqual(realigned.entryActionIds, [
    'E:LODGE:REGISTER',
    'DISCOVER_LOCAL_TROUBLE:T01',
    'MOVE_LOCAL:LOC_FARM_SQUARE',
    'ACTION:MSN-T01:hear',
    'MOVE_LOCAL:LOC_FARM_EDGE',
  ]);
  assert.deepEqual(realigned.t01ActionIds, EXPECTED_T01_ACTIONS);
  assert.equal(realigned.day1EveningActionId, EVENING_ACTION);
  assert.deepEqual(realigned.day2BreakfastActionIds, EXPECTED_DAY2_BREAKFAST_ACTIONS);

  const mappingText = await readFile(path.join(compileDir, 'virtue-route-v3-mapping.csv'), 'utf8');
  const rows = rowObjects(mappingText);
  const byId = new Map(rows.map((row) => [row.legacyRowId, row]));
  assert.equal(byId.get('VR2-D01-01').classification, 'NARRATIVE_OUTCOME');
  assert.equal(byId.get('VR2-D01-01').actionId, '');
  assert.doesNotMatch(`${byId.get('VR2-D01-01').requiredState} ${byId.get('VR2-D01-01').resultingState}`, /freeStarterMeals>=|LIFE:EAT:ITM003/u);
  assert.equal(byId.get('VR2-D01-02').classification, 'NARRATIVE_OUTCOME');
  assert.equal(byId.get('VR2-D01-02').skillId, '');
  assert.doesNotMatch(`${byId.get('VR2-D01-02').requiredState} ${byId.get('VR2-D01-02').resultingState}`, /SKL-0049/u);
  assert.deepEqual(actionIds(byId.get('VR2-D01-03')), realigned.entryActionIds);
  assert.deepEqual(actionIds(byId.get('VR2-D01-05')), EXPECTED_T01_ACTIONS);
  const t01Steps = JSON.parse(byId.get('VR2-D01-05').replacementSteps);
  assert.equal(t01Steps[4].commandType, 'MOVE');
  assert.equal(t01Steps[4].facilityId, 'LOC_FARM_SQUARE');
  assert.deepEqual(t01Steps[4].payload, { moveId: 'MOVE_LOCAL:LOC_FARM_SQUARE' });
  assert.equal(t01Steps.some((step) => step.actionId === 'MISSION_FLOW:T01:HUMAN_ENTRY:RETURN_FINN_TO_SQUARE'), false);
  assert.deepEqual(actionIds(byId.get('VR2-D01-09')), [EVENING_ACTION]);
  assert.match(byId.get('VR2-D01-09').resultingState, /22:30/u);
  assert.doesNotMatch(`${byId.get('VR2-D01-09').actionId} ${byId.get('VR2-D01-09').replacementSteps}`, /LIFE:REST:270/u);
  assert.match(byId.get('VR2-D01-03').requiredState, /Checkpoint E/u);
  assert.match(byId.get('VR2-D01-05').requiredState, /shield-only/u);
  assert.doesNotMatch(byId.get('VR2-D01-05').requiredState, /SKL-0049/u);
  assert.match(byId.get('VR2-D01-07').resultingState, /no fixed starter equipment premise/u);

  const day2Breakfast = byId.get('VR2-D02-01');
  assert.deepEqual(actionIds(day2Breakfast), EXPECTED_DAY2_BREAKFAST_ACTIONS);
  const breakfastSteps = JSON.parse(day2Breakfast.replacementSteps);
  assert.equal(breakfastSteps.at(-1).commandType, 'CHOOSE');
  assert.equal(breakfastSteps.at(-1).facilityId, 'LOC_FARM_BAKERY');
  assert.deepEqual(breakfastSteps.at(-1).payload, { choiceId: MERCHANT_HELP_ACTION, actionId: MERCHANT_HELP_ACTION });
  assert.equal(day2Breakfast.facilityId, 'LOC_FARM_BAKERY');
  assert.match(day2Breakfast.requiredState, /NPC008 physically present/u);
  assert.doesNotMatch(`${day2Breakfast.replacementSteps} ${day2Breakfast.resultingState}`, /MOVE_LOCAL:LOC_FARM_INN|remote NPC interaction/u);

  const formerDuplicate = byId.get('VR2-D02-02');
  assert.equal(formerDuplicate.classification, 'NARRATIVE_OUTCOME');
  assert.equal(formerDuplicate.commandType, 'OUTCOME');
  assert.equal(formerDuplicate.actionId, '');
  assert.match(formerDuplicate.requiredState, /DAY2_MERCHANT_UNLOADING_HELPED/u);

  const moves = JSON.parse(await readFile(path.join(compileDir, 'virtue-route-v3-proposed-local-moves.json'), 'utf8'));
  assert.equal(moves.count, 334);
  assert.equal(moves.moves.some((move) => move.beforeLegacyRowId === 'VR2-D01-03'), false);
  assert.equal(moves.moves.some((move) => move.beforeLegacyRowId === 'VR2-D01-10'), false);
  assert.equal(moves.moves.some((move) => move.beforeLegacyRowId === 'VR2-D02-01' && move.toFacilityId === 'LOC_FARM_BAKERY'), true);

  const validation = validateStaticRoute({
    mappingPath: path.join(compileDir, 'virtue-route-v3-mapping.csv'),
    sourcePath: SOURCE,
    outDir: validationDir,
  });
  assert.equal(validation.result, 'PASS');
  assert.equal(validation.errorCount, 0);
  assert.equal(validation.checks.replayExecuted, false);
  assert.equal(validation.checks.combatExecuted, false);

  const sheet = buildSheetArtifacts({
    mappingPath: path.join(compileDir, 'virtue-route-v3-mapping.csv'),
    movesPath: path.join(compileDir, 'virtue-route-v3-proposed-local-moves.json'),
    ledgerPath: path.join(validationDir, 'virtue-route-v3-static-ledger.csv'),
    validationPath: path.join(validationDir, 'virtue-route-v3-static-validation.json'),
    compilerSummaryPath: path.join(compileDir, 'virtue-route-v3-static-summary.json'),
    outDir: sheetDir,
  });
  assert.equal(sheet.sheets['正規台帳_v3'].rows, 1526);
  assert.equal(sheet.moveLocalRows, 334);

  const ledgerText = await readFile(path.join(sheetDir, SHEET_EXPORT_FILES.ledger), 'utf8');
  const ledgerRows = rowObjects(ledgerText);
  assert.equal(ledgerRows[0].v3RowId, 'VR3-000001');
  assert.equal(ledgerRows.at(-1).v3RowId, 'VR3-001526');
  assert.deepEqual(ledgerRows.slice(0, 7).map((row) => row.actionId), [
    '',
    '',
    'E:LODGE:REGISTER',
    'DISCOVER_LOCAL_TROUBLE:T01',
    'MOVE_LOCAL:LOC_FARM_SQUARE',
    'ACTION:MSN-T01:hear',
    'MOVE_LOCAL:LOC_FARM_EDGE',
  ]);
  assert.deepEqual(ledgerRows.slice(8, 14).map((row) => row.actionId), EXPECTED_T01_ACTIONS);
  assert.equal(ledgerRows[12].v3RowId, 'VR3-000013');
  assert.equal(ledgerRows[12].commandType, 'MOVE');
  assert.equal(ledgerRows[12].facilityId, 'LOC_FARM_SQUARE');
  const day1Evening = ledgerRows.find((row) => row.sourceV2RowId === 'VR2-D01-09');
  assert.ok(day1Evening);
  assert.equal(day1Evening.actionId, EVENING_ACTION);
  assert.equal(day1Evening.commandType, 'CHOOSE');
  assert.notEqual(day1Evening.actionId, 'LIFE:REST:270');
  assert.equal(ledgerRows.some((row) => row.sourceV2RowId === 'VR2-D01-09' && row.actionId === 'LIFE:REST:270'), false);
  assert.equal(ledgerRows.some((row) => row.actionId === 'MISSION_FLOW:T01:HUMAN_ENTRY:RETURN_FINN_TO_SQUARE'), false);
  assert.equal(ledgerRows.some((row, index) => index < 14 && row.actionId === 'LIFE:EAT:ITM003'), false);
  assert.equal(ledgerRows.some((row, index) => index < 14 && row.actionId === 'SKL-0049'), false);
  assert.equal(ledgerRows.some((row, index) => index < 14 && row.actionId?.startsWith('TUTORIAL:')), false);

  const day1SleepRows = ledgerRows.filter((row) => row.sourceV2RowId === 'VR2-D01-10');
  assert.deepEqual(day1SleepRows.map((row) => row.actionId), ['MISSION_FLOW:T01:VILLAGE_NIGHT:sleep_at_miras']);
  const day2BreakfastRows = ledgerRows.filter((row) => row.sourceV2RowId === 'VR2-D02-01');
  assert.deepEqual(day2BreakfastRows.map((row) => row.actionId), EXPECTED_DAY2_BREAKFAST_LEDGER_ACTIONS);
  assert.equal(day2BreakfastRows[0].commandType, 'MOVE');
  assert.equal(day2BreakfastRows[0].facilityId, 'LOC_FARM_BAKERY');
  assert.equal(day2BreakfastRows.at(-1).commandType, 'CHOOSE');
  assert.equal(day2BreakfastRows.at(-1).facilityId, 'LOC_FARM_BAKERY');
  const merchantRows = ledgerRows.filter((row) => row.actionId === MERCHANT_HELP_ACTION);
  assert.equal(merchantRows.length, 1);
  assert.equal(merchantRows[0].v3RowId, 'VR3-000024');
  assert.equal(merchantRows[0].sourceV2RowId, 'VR2-D02-01');
  const duplicateTrace = ledgerRows.find((row) => row.sourceV2RowId === 'VR2-D02-02');
  assert.ok(duplicateTrace);
  assert.equal(duplicateTrace.v3RowId, 'VR3-000025');
  assert.equal(duplicateTrace.commandType, 'OUTCOME');
  assert.equal(duplicateTrace.actionId, '');
});
