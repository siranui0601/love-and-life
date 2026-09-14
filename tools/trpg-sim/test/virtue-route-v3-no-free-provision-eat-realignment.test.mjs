import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseCsv } from '../export-virtue-route-v2-source.mjs';
import {
  applyNoFreeProvisionEatRealignment,
} from '../realign-virtue-route-v3-no-free-provision-eat.mjs';

const HEADERS = [
  'legacyRowIndex', 'legacyRowId', 'legacyDay', 'legacyTime', 'legacyDescription',
  'legacyRuntimeAction', 'legacyRegion', 'classification', 'replacementRowIds',
  'replacementSteps', 'resolutionMethod', 'commandType', 'choiceId', 'actionId',
  'payload', 'regionId', 'facilityId', 'npcIds', 'troubleId', 'jobId', 'productId',
  'equipmentId', 'materialId', 'skillId', 'requiredState', 'resultingState',
  'implementationSource', 'status', 'unresolvedReason', 'plannedStart', 'plannedEnd', 'notes',
];

function cell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function row(values) {
  const complete = Object.fromEntries(HEADERS.map((header) => [header, '']));
  Object.assign(complete, values);
  return HEADERS.map((header) => cell(complete[header])).join(',');
}

function readRows(file) {
  const matrix = parseCsv(fs.readFileSync(file, 'utf8'));
  const headers = matrix[0];
  return matrix.slice(1)
    .filter((cells) => cells.some(Boolean))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

test('no-free-provision realignment removes only generic carried-food EAT commands', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-no-free-eat-'));
  const mapping = [
    HEADERS.join(','),
    row({
      legacyRowIndex: '1',
      legacyRowId: 'VR2-D02-01',
      legacyDescription: '朝食として黒パンを買って食べる',
      classification: 'PLAYER_COMMAND_SEQUENCE',
      commandType: 'SEQUENCE',
      actionId: 'LIFE:EAT:ITM008',
      replacementRowIds: 'VR2-D02-01:S01|VR2-D02-01:S02',
      replacementSteps: JSON.stringify([
        { actionId: 'LIFE:BUY:ITM008', commandType: 'CHOOSE', payload: { choiceId: 'LIFE:BUY:ITM008' } },
        { actionId: 'LIFE:EAT:ITM008', commandType: 'CHOOSE', payload: { choiceId: 'LIFE:EAT:ITM008' } },
      ]),
      status: 'RESOLVED_EXISTING',
    }),
    row({
      legacyRowIndex: '2',
      legacyRowId: 'VR2-D03-04',
      legacyDescription: '携帯食を食べる',
      classification: 'PLAYER_COMMAND',
      commandType: 'CHOOSE',
      choiceId: 'LIFE:EAT:ITM023',
      actionId: 'LIFE:EAT:ITM023',
      payload: JSON.stringify({ choiceId: 'LIFE:EAT:ITM023' }),
      status: 'RESOLVED_EXISTING',
    }),
    row({
      legacyRowIndex: '3',
      legacyRowId: 'VR2-D04-01',
      legacyDescription: '宿で麦粥を食べる',
      classification: 'PLAYER_COMMAND',
      commandType: 'CHOOSE',
      choiceId: 'LIFE:EAT:ITM003',
      actionId: 'LIFE:EAT:ITM003',
      payload: JSON.stringify({ choiceId: 'LIFE:EAT:ITM003' }),
      status: 'RESOLVED_EXISTING',
    }),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-mapping.csv'), mapping);
  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-proposed-local-moves.json'), JSON.stringify({ moves: [], count: 0 }));
  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-static-summary.json'), JSON.stringify({ expandedV3Rows: 4 }));

  const result = applyNoFreeProvisionEatRealignment({ outDir });
  assert.deepEqual(result, {
    version: 'virtue-route-v3-no-free-provision-eat-v1',
    touchedRows: 2,
    removedCommandCount: 2,
    retiredOutcomeRows: 1,
    expandedV3Rows: 3,
  });

  const rows = readRows(path.join(outDir, 'virtue-route-v3-mapping.csv'));
  const breakfast = rows.find((entry) => entry.legacyRowId === 'VR2-D02-01');
  const carriedMeal = rows.find((entry) => entry.legacyRowId === 'VR2-D03-04');
  const innMeal = rows.find((entry) => entry.legacyRowId === 'VR2-D04-01');

  assert.deepEqual(JSON.parse(breakfast.replacementSteps).map((step) => step.actionId), ['LIFE:BUY:ITM008']);
  assert.equal(breakfast.actionId, 'LIFE:BUY:ITM008');
  assert.equal(carriedMeal.commandType, 'OUTCOME');
  assert.equal(carriedMeal.actionId, '');
  assert.equal(innMeal.actionId, 'LIFE:EAT:ITM003', 'facility meal actions remain explicit and executable');

  const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'virtue-route-v3-static-summary.json'), 'utf8'));
  assert.equal(summary.noFreeProvisionEatTouchedRows, 2);
  assert.equal(summary.noFreeProvisionEatRemovedCommands, 2);
  assert.equal(summary.expandedV3Rows, 3);
});
