#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');
const CANONICAL_EXPANDED_ROWS = 1521;

export const STRICT_PLAYABILITY_REALIGNMENT_VERSION = 'virtue-route-v3-strict-playability-v1';

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

function sequence(row, steps, {
  description,
  requiredState,
  resultingState,
  implementationSource,
  notes,
}) {
  Object.assign(row, {
    legacyDescription: description,
    classification: 'PLAYER_COMMAND_SEQUENCE',
    commandType: 'SEQUENCE',
    actionId: steps.at(-1).actionId,
    choiceId: '',
    payload: JSON.stringify({ steps }),
    replacementSteps: JSON.stringify(steps),
    replacementRowIds: steps.map((_, index) => `${row.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|'),
    resolutionMethod: 'STRICT_PLAYABILITY_REALIGNMENT',
    requiredState,
    resultingState,
    implementationSource,
    status: 'RESOLVED_EXISTING',
    unresolvedReason: '',
    notes,
  });
}

export function applyStrictPlayabilityRealignment({ outDir = DEFAULT_OUT } = {}) {
  const mappingPath = path.join(outDir, 'virtue-route-v3-mapping.csv');
  const summaryPath = path.join(outDir, 'virtue-route-v3-static-summary.json');
  const { headers, rows } = objects(fs.readFileSync(mappingPath, 'utf8'));
  const byId = new Map(rows.map((row) => [row.legacyRowId, row]));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

  if (Number(summary.expandedV3Rows) !== CANONICAL_EXPANDED_ROWS) {
    throw new Error(`strict playability expected ${CANONICAL_EXPANDED_ROWS} expanded rows before patch, got ${summary.expandedV3Rows}`);
  }

  const day4FreeTime = byId.get('VR2-D04-08');
  if (!day4FreeTime) throw new Error('VR2-D04-08 missing from strict playability candidate');
  const oldSteps = day4FreeTime.replacementSteps ? JSON.parse(day4FreeTime.replacementSteps) : [];
  if (oldSteps.length !== 4) {
    throw new Error(`VR2-D04-08 expected four v7 steps, got ${oldSteps.length}`);
  }
  const oldActionIds = oldSteps.map((step) => step.actionId ?? '');
  const expectedOldActionIds = ['', 'LIFE:REST:90', 'WORK:FACILITY:JOB-FARM-04', 'LIFE:REST:30'];
  if (oldActionIds.join('|') !== expectedOldActionIds.join('|')) {
    throw new Error(`VR2-D04-08 expected v7 outcome/rest/work/rest sequence, got ${oldActionIds.join('|')}`);
  }
  if (oldSteps[0]?.commandType !== 'OUTCOME') {
    throw new Error(`VR2-D04-08 first v7 step must be satisfied MOVE outcome, got ${oldSteps[0]?.commandType}`);
  }

  const maintenance = 'DAILY_LIFE:DAILY_NORTH_FENCE_WORKDAY:check_posts_and_lanterns';
  const watchPrep = 'DAILY_LIFE:DAILY_NORTH_FENCE_WORKDAY:prepare_watch_handover';
  const windDown = 'DAILY_LIFE:DAILY_NORTH_FENCE_WORKDAY:finish_watch_notes';
  sequence(day4FreeTime, [
    commandStep(maintenance, { facilityId: 'LOC_FARM_NORTH_FENCE' }),
    commandStep(watchPrep, { facilityId: 'LOC_FARM_NORTH_FENCE' }),
    commandStep('WORK:FACILITY:JOB-FARM-04', {
      facilityId: 'LOC_FARM_NORTH_FENCE',
      jobId: 'JOB-FARM-04',
      scheduledStart: '18:00',
      scheduledEnd: '22:00',
    }),
    commandStep(windDown, {
      facilityId: 'LOC_FARM_NORTH_FENCE',
      scheduledStart: '22:00',
      scheduledEnd: '22:30',
    }),
  ], {
    description: 'Day4午後は北柵で日常の手入れと夜警準備を行い、18時から正規の夜警勤務、22時から勤務後の記録整理をして就寝時刻まで過ごす',
    requiredState: 'Day4 compiler-inserted Bakery→LOC_FARM_NORTH_FENCE move completed around 14:39; villageTrust>=2; needs below urgent survival threshold; JOB-FARM-04 remains governed by its canonical 18:00-22:00 window',
    resultingState: 'ordinary unpaid fence maintenance and watch preparation advance naturally to 18:00; canonical JOB-FARM-04 pays exactly 3G for 240 minutes; unpaid post-shift notes advance to 22:30; no WAIT or generic REST padding',
    implementationSource: 'src/server/trpg/content/authored-village-north-fence-workday.js + canonical-regional-labour.js + canonical-job-time-policy.js',
    notes: 'replaces the v7 satisfied-MOVE outcome + REST90 + JOB-FARM-04 + REST30 sequence with four visible route-neutral production actions while preserving the reviewed 1521-row ledger and the separate compiler-inserted Bakery→North Fence movement',
  });

  summary.strictPlayabilityRealignmentVersion = STRICT_PLAYABILITY_REALIGNMENT_VERSION;
  summary.strictPlayabilityRealignedLegacyRows = [
    ...(Array.isArray(summary.strictPlayabilityRealignedLegacyRows) ? summary.strictPlayabilityRealignedLegacyRows : []),
    'VR2-D04-08',
  ];
  summary.expandedV3Rows = CANONICAL_EXPANDED_ROWS;

  fs.writeFileSync(mappingPath, csv(rows, headers));
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  return {
    version: STRICT_PLAYABILITY_REALIGNMENT_VERSION,
    expandedV3Rows: summary.expandedV3Rows,
    realignedLegacyRows: [...summary.strictPlayabilityRealignedLegacyRows],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyStrictPlayabilityRealignment(), null, 2));
}
