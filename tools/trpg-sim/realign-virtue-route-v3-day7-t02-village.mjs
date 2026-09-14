#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');
const CANONICAL_EXPANDED_ROWS = 1521;

export const DAY7_T02_VILLAGE_REALIGNMENT_VERSION = 'virtue-route-v3-day7-t02-village-v1';

function objects(text) {
  const matrix = parseCsv(text);
  const headers = matrix[0];
  const rows = matrix.slice(1)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
  return { headers, rows };
}

function csv(rows, headers) {
  return `${headers.map(csvCell).join(',')}\n${rows
    .map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(','))
    .join('\n')}\n`;
}

function commandStep(actionId, commandType = 'CHOOSE', payload = null, extra = {}) {
  return {
    actionId,
    commandType,
    payload: payload ?? (commandType === 'CHOOSE'
      ? { choiceId: actionId, actionId }
      : {}),
    ...extra,
  };
}

function parsedSteps(row) {
  return row?.replacementSteps ? JSON.parse(row.replacementSteps) : [];
}

function sequence(row, steps) {
  row.classification = 'PLAYER_COMMAND_SEQUENCE';
  row.commandType = 'SEQUENCE';
  row.actionId = steps.at(-1).actionId;
  row.choiceId = '';
  row.payload = JSON.stringify({ steps });
  row.replacementSteps = JSON.stringify(steps);
  row.replacementRowIds = steps.map((_, index) => `${row.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|');
  row.resolutionMethod = 'STRICT_PLAYABILITY_REALIGNMENT';
  row.status = 'RESOLVED_EXISTING';
}

export function applyDay7T02VillageRealignment({ outDir = DEFAULT_OUT } = {}) {
  const mappingPath = path.join(outDir, 'virtue-route-v3-mapping.csv');
  const summaryPath = path.join(outDir, 'virtue-route-v3-static-summary.json');
  const { headers, rows } = objects(fs.readFileSync(mappingPath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const row = rows.find((entry) => entry.legacyRowId === 'VR2-D07-04');
  if (!row) throw new Error('VR2-D07-04 missing from Day7 T02 village realignment');

  const old = parsedSteps(row);
  const expected = [
    'MOVE_REGION:交易都市',
    'MOVE_LOCAL:LOC_TRADE_GUILD',
    'MISSION_FLOW:granary-arson:RESOLUTION:public_prosecution_and_contract_void:active',
    'MOVE_REGION:田園の村',
  ];
  const actual = old.map((step) => step.actionId ?? '');
  if (actual.join('|') !== expected.join('|')) {
    throw new Error(`VR2-D07-04 expected stale trade-guild roundtrip, got ${actual.join('|')}`);
  }
  if (old.length !== 4) throw new Error(`VR2-D07-04 expected four stale steps, got ${old.length}`);

  const steps = [
    commandStep('MOVE_LOCAL:LOC_FARM_GRANARY', 'MOVE', { moveId: 'MOVE_LOCAL:LOC_FARM_GRANARY' }, {
      regionId: '田園の村', facilityId: 'LOC_FARM_GRANARY',
    }),
    commandStep('T02_GRANARY:RESOLUTION:REVIEW_CONTRACT_AND_TESTIMONY', 'CHOOSE', null, {
      regionId: '田園の村', facilityId: 'LOC_FARM_GRANARY', scheduledMinutes: 42,
    }),
    commandStep('MISSION_FLOW:granary-arson:RESOLUTION:public_prosecution_and_contract_void:active', 'CHOOSE', null, {
      regionId: '田園の村', facilityId: 'LOC_FARM_GRANARY', scheduledMinutes: 86,
    }),
    commandStep('T02_GRANARY:RESOLUTION:RECORD_DALK_PROTECTION_AND_REBUILD', 'CHOOSE', null, {
      regionId: '田園の村', facilityId: 'LOC_FARM_GRANARY', scheduledMinutes: 13,
    }),
  ];
  sequence(row, steps);
  Object.assign(row, {
    legacyDescription: 'T02を田園の村で解決。契約書・証言・三証拠を村内で突き合わせ、収穫権を守り、ダルクの身柄保護と生活再建を条件として記録する',
    regionId: '田園の村',
    facilityId: 'LOC_FARM_GRANARY',
    requiredState: 'Day7 morning; MSN-T02 resolve step; three evidence classes verified; player remains in 田園の村',
    resultingState: 'T02 resolved in the farm village; harvest-right contract void basis fixed; Dalk protected and livelihood rebuild recorded; no player round trip to 交易都市',
    implementationSource: 'src/server/trpg/content/authored-mission-t02-village-resolution.js + authored-mission-flow-core.js',
    notes: 'live Human Virtue canonical VR2-D07-04 is 09:30-12:00 in 田園の村. Replaces the stale compiler-only six-hour Trade City round trip with four visible village production actions totaling the same reviewed expansion count; no WAIT/REST padding or clock mutation.',
  });

  if (Number(summary.expandedV3Rows) !== CANONICAL_EXPANDED_ROWS) {
    throw new Error(`Day7 T02 realignment expected ${CANONICAL_EXPANDED_ROWS} rows before 4->4 patch, got ${summary.expandedV3Rows}`);
  }
  summary.day7T02VillageRealignmentVersion = DAY7_T02_VILLAGE_REALIGNMENT_VERSION;
  summary.day7T02VillageRealignedLegacyRows = [
    ...new Set([...(summary.day7T02VillageRealignedLegacyRows ?? []), 'VR2-D07-04']),
  ];
  summary.expandedV3Rows = CANONICAL_EXPANDED_ROWS;

  fs.writeFileSync(mappingPath, csv(rows, headers));
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return {
    version: DAY7_T02_VILLAGE_REALIGNMENT_VERSION,
    expandedV3Rows: summary.expandedV3Rows,
    realignedLegacyRows: [...summary.day7T02VillageRealignedLegacyRows],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyDay7T02VillageRealignment(), null, 2));
}
