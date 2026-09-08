#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`${path}: expected patch anchor missing`);
  const next = source.replace(before, after);
  if (next === source) throw new Error(`${path}: patch produced no change`);
  fs.writeFileSync(path, next);
}

replaceOnce(
  'src/server/trpg/content/canonical-world-life-actions.js',
`function actionBase(id, label, minutes, extra = {}) {
  return {
    id,
    actionId: id,
    family: "life",
    type: "plan",
    label,
    minutes,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    canonicalWorldLifeChoice: true,
    ...extra,
  };
}`,
`function actionBase(id, label, minutes, extra = {}) {
  const action = {
    id,
    actionId: id,
    family: "life",
    type: "plan",
    label,
    minutes,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    canonicalWorldLifeChoice: true,
    ...extra,
  };
  // Canonical products are real facility-local actions. Expose that locality on
  // the common action shape as well as the product scope so overlay registries
  // can keep them beside unrelated authored choices without leaking a remote
  // shop/meal into the current panel.
  action.targetFacilityId ??= action.facilityId ?? action.scopeId ?? null;
  return action;
}`,
);

replaceOnce(
  'src/server/trpg/content/authored-mission-flow-registry.js',
`function mergePublicProductsBesideRoutineLife(runtime, actions) {
  if (!routinePublicLifeOnly(actions) || t01Active(runtime)) return actions;
  const products = publicLifeProducts(runtime);
  if (!products.length) return actions;
  const combined = [...products, ...actions];
  return [...new Map(combined.map((action) => [action.id, action])).values()];
}`,
`function mergePublicProductsBesideRoutineLife(runtime, actions) {
  if (!routinePublicLifeOnly(actions) || t01Active(runtime)) return actions;
  const products = publicLifeProducts(runtime);
  if (!products.length) return actions;
  const combined = [...products, ...actions];
  return [...new Map(combined.map((action) => [action.id, action])).values()];
}

function mergeLocalPublicProductsBesideAuthoredActions(runtime, actions) {
  if (!Array.isArray(actions) || actions.length === 0 || t01Active(runtime)) return actions;
  if (onlyCanonicalWorldLife(actions)) return actions;
  // A genuinely modal/owned panel may suppress ordinary life. Ordinary mission
  // progress elsewhere in the world may not make a bakery, inn, market, or
  // service counter disappear while the player is physically standing there.
  const ownsWholePanel = actions.some((action) => action?.ownsWholeChoicePanel === true
    || action?.exclusiveChoicePanel === true);
  if (ownsWholePanel) return actions;
  const products = publicLifeProducts(runtime);
  if (!products.length) return actions;
  const combined = [...products, ...actions];
  return [...new Map(combined.map((action) => [action.id, action])).values()];
}`,
);

replaceOnce(
  'src/server/trpg/content/authored-mission-flow-registry.js',
`  actions = mergePublicProductsBesideRoutineLife(runtime, actions);
  actions = ordinaryCanonicalLifeFallback(runtime, actions);`,
`  actions = mergePublicProductsBesideRoutineLife(runtime, actions);
  actions = mergeLocalPublicProductsBesideAuthoredActions(runtime, actions);
  actions = ordinaryCanonicalLifeFallback(runtime, actions);`,
);

replaceOnce(
  'src/server/trpg/content/authored-mission-flow-registry.js',
`  mergePublicProductsBesideRoutineLife,
  dailyLifeCommonChoiceCandidates,`,
`  mergePublicProductsBesideRoutineLife,
  mergeLocalPublicProductsBesideAuthoredActions,
  dailyLifeCommonChoiceCandidates,`,
);

const day3Script = `#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');

export const DAY3_NATURAL_BREAKFAST_REALIGNMENT_VERSION = 'virtue-route-v3-day3-natural-breakfast-v1';

function objects(text) {
  const matrix = parseCsv(text);
  const headers = matrix[0];
  const rows = matrix.slice(1)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
  return { headers, rows };
}

function csv(rows, headers) {
  return \`${'${headers.map(csvCell).join(\',\')}'}\\n${'${rows.map((row) => headers.map((header) => csvCell(row[header] ?? \'\')).join(\',\')).join(\'\\n\')}'}\\n\`;
}

function parsedSteps(row) {
  return row?.replacementSteps ? JSON.parse(row.replacementSteps) : [];
}

function expandedRowCount(rows, moves) {
  return rows.reduce((total, row) => total + Math.max(1, parsedSteps(row).length), 0) + moves.length;
}

function choose(actionId, facilityId) {
  return { actionId, commandType: 'CHOOSE', payload: { choiceId: actionId, actionId }, regionId: '田園の村', facilityId };
}

function move(facilityId) {
  const actionId = \`MOVE_LOCAL:${'${facilityId}'}\`;
  return { actionId, commandType: 'MOVE', payload: { moveId: actionId }, regionId: '田園の村', facilityId };
}

export function applyDay3NaturalBreakfastRealignment({ outDir = DEFAULT_OUT } = {}) {
  const mappingPath = path.join(outDir, 'virtue-route-v3-mapping.csv');
  const movesPath = path.join(outDir, 'virtue-route-v3-proposed-local-moves.json');
  const summaryPath = path.join(outDir, 'virtue-route-v3-static-summary.json');
  const { headers, rows } = objects(fs.readFileSync(mappingPath, 'utf8'));
  const movesArtifact = JSON.parse(fs.readFileSync(movesPath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const moves = Array.isArray(movesArtifact.moves) ? movesArtifact.moves : [];

  const countedBefore = expandedRowCount(rows, moves);
  if (Number(summary.expandedV3Rows) !== countedBefore) throw new Error(\`Day3 breakfast input accounting mismatch: summary=${'${summary.expandedV3Rows}'}, counted=${'${countedBefore}'}\`);
  if (!summary.day2NaturalBreakfastRealignmentVersion) throw new Error('Day3 breakfast realignment must run after Day2 natural breakfast realignment');

  const row = rows.find((entry) => entry.legacyRowId === 'VR2-D03-01');
  if (!row) throw new Error('VR2-D03-01 missing');
  const previous = parsedSteps(row).map((step) => step.actionId);
  if (previous.join('|') !== 'LIFE:BUY:ITM008') throw new Error(\`VR2-D03-01 expected post-retirement BUY-only sequence, got ${'${previous.join(\'|\')}'}\`);

  const compilerMoves = moves.filter((entry) => entry.beforeLegacyRowId === 'VR2-D03-01');
  if (compilerMoves.length !== 1 || compilerMoves[0].actionId !== 'MOVE_LOCAL:LOC_FARM_BAKERY') {
    throw new Error(\`VR2-D03-01 expected one stale Inn→Bakery compiler move, got ${'${compilerMoves.map((entry) => entry.actionId).join(\'|\')}'}\`);
  }
  moves.splice(moves.indexOf(compilerMoves[0]), 1);

  const steps = [choose('LIFE:EAT:ITM003', 'LOC_FARM_INN'), move('LOC_FARM_BAKERY')];
  Object.assign(row, {
    legacyDescription: 'Day3朝、麦穂亭で麦粥を食べてからパン屋へ歩き、村の朝仕事へ入る',
    classification: 'PLAYER_COMMAND_SEQUENCE', commandType: 'SEQUENCE', actionId: steps.at(-1).actionId, choiceId: '',
    payload: JSON.stringify({ steps }), replacementSteps: JSON.stringify(steps),
    replacementRowIds: steps.map((_, index) => \`${'${row.legacyRowId}'}:S${'${String(index + 1).padStart(2, \'0\')}'}\`).join('|'),
    resolutionMethod: 'DAY3_NATURAL_BREAKFAST_REALIGNMENT', regionId: '田園の村', facilityId: 'LOC_FARM_BAKERY', productId: 'ITM003',
    requiredState: 'Day3 after normal inn lodging; player wakes at LOC_FARM_INN and a real facility breakfast is available',
    resultingState: 'the explicit inn breakfast reduces hunger before the two-hour bakery morning block; ordinary movement then reaches the bakery without generic inventory-food consumption',
    implementationSource: 'src/server/trpg/content/canonical-world-life-actions.js + authored village daily-life production', status: 'RESOLVED_EXISTING', unresolvedReason: '',
    notes: 'replaces the obsolete buy-black-bread breakfast placeholder and removes the compiler-forced pre-breakfast move. This preserves the 06:30→07:00 meal window while making the later well-side clue reachable through normal needs.',
  });

  movesArtifact.day3NaturalBreakfastRealignmentVersion = DAY3_NATURAL_BREAKFAST_REALIGNMENT_VERSION;
  movesArtifact.day3NaturalBreakfastRemovedMoveBeforeRows = ['VR2-D03-01'];
  movesArtifact.count = moves.length;
  summary.day3NaturalBreakfastRealignmentVersion = DAY3_NATURAL_BREAKFAST_REALIGNMENT_VERSION;
  summary.day3NaturalBreakfastRealignedLegacyRows = ['VR2-D03-01'];
  summary.proposedMoveLocalInsertions = moves.length;
  summary.expandedV3Rows = expandedRowCount(rows, moves);

  fs.writeFileSync(mappingPath, csv(rows, headers));
  fs.writeFileSync(movesPath, \`${'${JSON.stringify(movesArtifact, null, 2)}'}\\n\`);
  fs.writeFileSync(summaryPath, \`${'${JSON.stringify(summary, null, 2)}'}\\n\`);
  return { version: DAY3_NATURAL_BREAKFAST_REALIGNMENT_VERSION, expandedV3Rows: summary.expandedV3Rows, moves: moves.length, actions: steps.map((step) => step.actionId) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(applyDay3NaturalBreakfastRealignment(), null, 2));
`;
fs.writeFileSync('tools/trpg-sim/realign-virtue-route-v3-day3-natural-breakfast.mjs', day3Script);

const day3Test = `import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseCsv } from '../export-virtue-route-v2-source.mjs';
import { applyDay3NaturalBreakfastRealignment } from '../realign-virtue-route-v3-day3-natural-breakfast.mjs';

const HEADERS = ['legacyRowIndex','legacyRowId','legacyDay','legacyTime','legacyDescription','legacyRuntimeAction','legacyRegion','classification','replacementRowIds','replacementSteps','resolutionMethod','commandType','choiceId','actionId','payload','regionId','facilityId','npcIds','troubleId','jobId','productId','equipmentId','materialId','skillId','requiredState','resultingState','implementationSource','status','unresolvedReason','plannedStart','plannedEnd','notes'];
const cell = (value) => { const text = String(value ?? ''); return /[\",\\n\\r]/u.test(text) ? \`\"${'${text.replaceAll(\'\"\', \'\"\"\')}'}\"\` : text; };
function row(values) { const complete = Object.fromEntries(HEADERS.map((header) => [header, ''])); Object.assign(complete, values); return HEADERS.map((header) => cell(complete[header])).join(','); }

test('Day3 realignment eats a real inn breakfast before moving to bakery morning work', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-day3-natural-'));
  const buy = { actionId:'LIFE:BUY:ITM008', commandType:'CHOOSE', payload:{choiceId:'LIFE:BUY:ITM008',actionId:'LIFE:BUY:ITM008'}, regionId:'田園の村', facilityId:'LOC_FARM_BAKERY' };
  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-mapping.csv'), [HEADERS.join(','), row({legacyRowId:'VR2-D03-01', classification:'PLAYER_COMMAND_SEQUENCE', commandType:'SEQUENCE', actionId:buy.actionId, replacementRowIds:'VR2-D03-01:S01', replacementSteps:JSON.stringify([buy]), status:'RESOLVED_EXISTING'}), ''].join('\\n'));
  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-proposed-local-moves.json'), JSON.stringify({moves:[{beforeLegacyRowId:'VR2-D03-01',actionId:'MOVE_LOCAL:LOC_FARM_BAKERY',commandType:'MOVE'}],count:1}));
  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-static-summary.json'), JSON.stringify({expandedV3Rows:2,day2NaturalBreakfastRealignmentVersion:'virtue-route-v3-day2-natural-breakfast-v3'}));
  const result = applyDay3NaturalBreakfastRealignment({outDir});
  assert.deepEqual(result.actions, ['LIFE:EAT:ITM003','MOVE_LOCAL:LOC_FARM_BAKERY']);
  assert.equal(result.expandedV3Rows, 2);
  assert.equal(result.moves, 0);
  const matrix = parseCsv(fs.readFileSync(path.join(outDir,'virtue-route-v3-mapping.csv'),'utf8'));
  const entry = Object.fromEntries(matrix[0].map((header,index)=>[header,matrix[1][index] ?? '']));
  assert.deepEqual(JSON.parse(entry.replacementSteps).map((step)=>step.actionId), ['LIFE:EAT:ITM003','MOVE_LOCAL:LOC_FARM_BAKERY']);
  const summary = JSON.parse(fs.readFileSync(path.join(outDir,'virtue-route-v3-static-summary.json'),'utf8'));
  assert.equal(summary.day3NaturalBreakfastRealignmentVersion, 'virtue-route-v3-day3-natural-breakfast-v1');
});
`;
fs.writeFileSync('tools/trpg-sim/test/virtue-route-v3-day3-natural-breakfast-realignment.test.mjs', day3Test);

replaceOnce(
  '.github/workflows/trpg-human-virtue-full-route-audit.yml',
`      - "tools/trpg-sim/realign-virtue-route-v3-day2-natural-breakfast.mjs"
      - "tools/trpg-sim/export-virtue-route-v2-source.mjs"`,
`      - "tools/trpg-sim/realign-virtue-route-v3-day2-natural-breakfast.mjs"
      - "tools/trpg-sim/realign-virtue-route-v3-day3-natural-breakfast.mjs"
      - "tools/trpg-sim/export-virtue-route-v2-source.mjs"`,
);
replaceOnce(
  '.github/workflows/trpg-human-virtue-full-route-audit.yml',
`      - name: Realign Day2 breakfast before the local merchant visit
        run: node tools/trpg-sim/realign-virtue-route-v3-day2-natural-breakfast.mjs
      - name: Validate deterministic route and build canonical Sheet ledger`,
`      - name: Realign Day2 breakfast before the local merchant visit
        run: node tools/trpg-sim/realign-virtue-route-v3-day2-natural-breakfast.mjs
      - name: Realign Day3 breakfast before bakery morning work
        run: node tools/trpg-sim/realign-virtue-route-v3-day3-natural-breakfast.mjs
      - name: Validate deterministic route and build canonical Sheet ledger`,
);

console.log('temporary live patch applied');
