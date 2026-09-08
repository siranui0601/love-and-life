import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseCsv } from '../export-virtue-route-v2-source.mjs';
import {
  applyDay2NaturalBreakfastRealignment,
} from '../realign-virtue-route-v3-day2-natural-breakfast.mjs';

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

test('Day2 realignment uses an inn breakfast, physical bakery move, and currently visible evening branch', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-day2-natural-'));
  const buy = {
    actionId: 'LIFE:BUY:ITM008',
    commandType: 'CHOOSE',
    payload: { choiceId: 'LIFE:BUY:ITM008', actionId: 'LIFE:BUY:ITM008' },
    regionId: '田園の村',
    facilityId: 'LOC_FARM_BAKERY',
  };
  const oldEvening = {
    actionId: 'DAILY_LIFE:DAILY_BAKERY_EVENING:mend_gear_by_oven',
    commandType: 'CHOOSE',
    payload: {
      choiceId: 'DAILY_LIFE:DAILY_BAKERY_EVENING:mend_gear_by_oven',
      actionId: 'DAILY_LIFE:DAILY_BAKERY_EVENING:mend_gear_by_oven',
    },
    regionId: '田園の村',
    facilityId: 'LOC_FARM_BAKERY',
  };
  const mapping = [
    HEADERS.join(','),
    row({
      legacyRowIndex: '11',
      legacyRowId: 'VR2-D02-01',
      classification: 'PLAYER_COMMAND_SEQUENCE',
      commandType: 'SEQUENCE',
      actionId: buy.actionId,
      replacementRowIds: 'VR2-D02-01:S01',
      replacementSteps: JSON.stringify([buy]),
      status: 'RESOLVED_EXISTING',
    }),
    row({
      legacyRowIndex: '18',
      legacyRowId: 'VR2-D02-08',
      classification: 'PLAYER_COMMAND',
      commandType: 'CHOOSE',
      choiceId: oldEvening.actionId,
      actionId: oldEvening.actionId,
      payload: JSON.stringify(oldEvening.payload),
      replacementRowIds: 'VR2-D02-08:PLAYER_COMMAND',
      replacementSteps: JSON.stringify([oldEvening]),
      status: 'RESOLVED_EXISTING',
    }),
    '',
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-mapping.csv'), mapping);
  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-proposed-local-moves.json'), JSON.stringify({
    moves: [{
      beforeLegacyRowId: 'VR2-D02-01',
      actionId: 'MOVE_LOCAL:LOC_FARM_BAKERY',
      commandType: 'MOVE',
    }],
    count: 1,
  }));
  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-static-summary.json'), JSON.stringify({
    expandedV3Rows: 3,
    noFreeProvisionEatRealignmentVersion: 'virtue-route-v3-no-free-provision-eat-v1',
  }));

  const result = applyDay2NaturalBreakfastRealignment({ outDir });
  assert.deepEqual(result, {
    version: 'virtue-route-v3-day2-natural-breakfast-v2',
    expandedV3Rows: 3,
    moves: 0,
    actions: [
      'LIFE:EAT:ITM003',
      'MOVE_LOCAL:LOC_FARM_BAKERY',
      'DAILY_LIFE:DAILY_BAKERY_EVENING:help_close_the_bakery',
    ],
  });

  const rows = readRows(path.join(outDir, 'virtue-route-v3-mapping.csv'));
  const breakfast = rows.find((entry) => entry.legacyRowId === 'VR2-D02-01');
  const evening = rows.find((entry) => entry.legacyRowId === 'VR2-D02-08');
  assert.deepEqual(JSON.parse(breakfast.replacementSteps).map((step) => step.actionId), [
    'LIFE:EAT:ITM003',
    'MOVE_LOCAL:LOC_FARM_BAKERY',
  ]);
  assert.equal(evening.actionId, 'DAILY_LIFE:DAILY_BAKERY_EVENING:help_close_the_bakery');
  assert.deepEqual(JSON.parse(evening.replacementSteps).map((step) => step.actionId), [
    'DAILY_LIFE:DAILY_BAKERY_EVENING:help_close_the_bakery',
  ]);

  const moves = JSON.parse(fs.readFileSync(path.join(outDir, 'virtue-route-v3-proposed-local-moves.json'), 'utf8'));
  assert.equal(moves.count, 0);
  assert.deepEqual(moves.moves, []);

  const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'virtue-route-v3-static-summary.json'), 'utf8'));
  assert.deepEqual(summary.day2NaturalBreakfastRealignedLegacyRows, ['VR2-D02-01', 'VR2-D02-08']);
  assert.equal(summary.day2BakeryEveningAction, 'DAILY_LIFE:DAILY_BAKERY_EVENING:help_close_the_bakery');
  assert.equal(summary.expandedV3Rows, 3);
});
