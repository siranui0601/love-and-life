#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');
const CANONICAL_EXPANDED_ROWS = 1521;

export const DAY7_NORTH_FENCE_REALIGNMENT_VERSION = 'virtue-route-v3-day7-north-fence-v1';

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

function commandStep(actionId, extra = {}) {
  return {
    actionId,
    commandType: 'CHOOSE',
    payload: { choiceId: actionId, actionId },
    ...extra,
  };
}

function parsedSteps(row) {
  return row?.replacementSteps ? JSON.parse(row.replacementSteps) : [];
}

function sequence(row, steps) {
  Object.assign(row, {
    classification: 'PLAYER_COMMAND_SEQUENCE',
    commandType: 'SEQUENCE',
    actionId: steps.at(-1).actionId,
    choiceId: '',
    payload: JSON.stringify({ steps }),
    replacementSteps: JSON.stringify(steps),
    replacementRowIds: steps.map((_, index) => `${row.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|'),
    resolutionMethod: 'STRICT_PLAYABILITY_REALIGNMENT',
    status: 'RESOLVED_EXISTING',
  });
}

export function applyDay7NorthFenceRealignment({ outDir = DEFAULT_OUT } = {}) {
  const mappingPath = path.join(outDir, 'virtue-route-v3-mapping.csv');
  const summaryPath = path.join(outDir, 'virtue-route-v3-static-summary.json');
  const { headers, rows } = objects(fs.readFileSync(mappingPath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const row = rows.find((entry) => entry.legacyRowId === 'VR2-D07-09');
  if (!row) throw new Error('VR2-D07-09 missing from Day7 north-fence realignment');

  const old = parsedSteps(row);
  const actual = old.map((step) => step.actionId ?? '');
  const expected = ['', 'LIFE:REST:60', 'WORK:FACILITY:JOB-FARM-04', 'LIFE:REST:30'];
  if (actual.join('|') !== expected.join('|')) {
    throw new Error(`VR2-D07-09 expected stale outcome/rest/watch/rest sequence, got ${actual.join('|')}`);
  }
  if (old[0]?.commandType !== 'OUTCOME') {
    throw new Error(`VR2-D07-09 first stale step must be OUTCOME, got ${old[0]?.commandType}`);
  }

  const maintenance = 'DAILY_LIFE:DAY7_NORTH_FENCE_WORKDAY:check_posts_and_lanterns';
  const watchPrep = 'DAILY_LIFE:DAY7_NORTH_FENCE_WORKDAY:prepare_watch_handover';
  const windDown = 'DAILY_LIFE:DAY7_NORTH_FENCE_WORKDAY:finish_watch_notes';
  sequence(row, [
    commandStep(maintenance, {
      regionId: '田園の村', facilityId: 'LOC_FARM_NORTH_FENCE', scheduledMinutes: 30,
    }),
    commandStep(watchPrep, {
      regionId: '田園の村', facilityId: 'LOC_FARM_NORTH_FENCE', scheduledEnd: '18:00',
    }),
    commandStep('WORK:FACILITY:JOB-FARM-04', {
      regionId: '田園の村', facilityId: 'LOC_FARM_NORTH_FENCE', jobId: 'JOB-FARM-04',
      scheduledStart: '18:00', scheduledEnd: '22:00',
    }),
    commandStep(windDown, {
      regionId: '田園の村', facilityId: 'LOC_FARM_NORTH_FENCE', scheduledStart: '22:00', scheduledEnd: '22:30',
    }),
  ]);

  Object.assign(row, {
    legacyDescription: 'Day7夕方は北柵で通常の手入れと夜警引継ぎを行い、18時から正規夜警、22時から勤務後記録を整理する',
    regionId: '田園の村',
    facilityId: 'LOC_FARM_NORTH_FENCE',
    requiredState: 'Day7 around 17:07 after the compiler-inserted move to LOC_FARM_NORTH_FENCE; needs below urgent survival threshold; JOB-FARM-04 remains governed by 18:00-22:00',
    resultingState: '30 minutes of ordinary fence maintenance plus visible handover preparation advance naturally to 18:00; canonical JOB-FARM-04 runs 18:00-22:00; unpaid notes finish at 22:30',
    implementationSource: 'src/server/trpg/content/authored-village-day6-north-fence-workday.js + canonical-regional-labour.js + canonical-job-time-policy.js',
    notes: 'replaces generic REST padding with ordinary route-neutral production life; 4->4 preserves the reviewed 1521-row ledger; no WAIT/REST padding, clock mutation, or widened work window',
  });

  if (Number(summary.expandedV3Rows) !== CANONICAL_EXPANDED_ROWS) {
    throw new Error(`Day7 north-fence realignment expected ${CANONICAL_EXPANDED_ROWS} rows before 4->4 patch, got ${summary.expandedV3Rows}`);
  }
  summary.day7NorthFenceRealignmentVersion = DAY7_NORTH_FENCE_REALIGNMENT_VERSION;
  summary.day7NorthFenceRealignedLegacyRows = [
    ...new Set([...(summary.day7NorthFenceRealignedLegacyRows ?? []), 'VR2-D07-09']),
  ];
  summary.expandedV3Rows = CANONICAL_EXPANDED_ROWS;

  fs.writeFileSync(mappingPath, csv(rows, headers));
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return {
    version: DAY7_NORTH_FENCE_REALIGNMENT_VERSION,
    expandedV3Rows: summary.expandedV3Rows,
    realignedLegacyRows: [...summary.day7NorthFenceRealignedLegacyRows],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyDay7NorthFenceRealignment(), null, 2));
}
