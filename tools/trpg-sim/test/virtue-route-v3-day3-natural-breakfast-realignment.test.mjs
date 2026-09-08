import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseCsv } from '../export-virtue-route-v2-source.mjs';
import { applyDay3NaturalBreakfastRealignment } from '../realign-virtue-route-v3-day3-natural-breakfast.mjs';

const HEADERS = ['legacyRowIndex','legacyRowId','legacyDay','legacyTime','legacyDescription','legacyRuntimeAction','legacyRegion','classification','replacementRowIds','replacementSteps','resolutionMethod','commandType','choiceId','actionId','payload','regionId','facilityId','npcIds','troubleId','jobId','productId','equipmentId','materialId','skillId','requiredState','resultingState','implementationSource','status','unresolvedReason','plannedStart','plannedEnd','notes'];
const cell = (value) => { const text = String(value ?? ''); return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
function row(values) { const complete = Object.fromEntries(HEADERS.map((header) => [header, ''])); Object.assign(complete, values); return HEADERS.map((header) => cell(complete[header])).join(','); }

test('Day3 realignment eats a real inn breakfast before moving to bakery morning work', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-day3-natural-'));
  const buy = { actionId:'LIFE:BUY:ITM008', commandType:'CHOOSE', payload:{choiceId:'LIFE:BUY:ITM008',actionId:'LIFE:BUY:ITM008'}, regionId:'田園の村', facilityId:'LOC_FARM_BAKERY' };
  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-mapping.csv'), [HEADERS.join(','), row({legacyRowId:'VR2-D03-01', classification:'PLAYER_COMMAND_SEQUENCE', commandType:'SEQUENCE', actionId:buy.actionId, replacementRowIds:'VR2-D03-01:S01', replacementSteps:JSON.stringify([buy]), status:'RESOLVED_EXISTING'}), ''].join('\n'));
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
