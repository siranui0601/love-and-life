#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');
const CANONICAL_EXPANDED_ROWS = 1521;

export const STRICT_PLAYABILITY_REALIGNMENT_VERSION = 'virtue-route-v3-strict-playability-v3';

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

function outcome(row, {
  description,
  requiredState,
  resultingState,
  implementationSource,
  notes,
}) {
  Object.assign(row, {
    legacyDescription: description,
    classification: 'NARRATIVE_OUTCOME',
    commandType: 'OUTCOME',
    actionId: '',
    choiceId: '',
    payload: '',
    replacementSteps: '',
    replacementRowIds: '',
    resolutionMethod: 'STRICT_PLAYABILITY_REALIGNMENT',
    requiredState,
    resultingState,
    implementationSource,
    status: 'OUTCOME',
    unresolvedReason: '',
    notes,
  });
}

function parsedSteps(row) {
  return row?.replacementSteps ? JSON.parse(row.replacementSteps) : [];
}

function assertActionIds(row, expected, label) {
  const actual = parsedSteps(row).map((step) => step.actionId ?? '');
  if (actual.join('|') !== expected.join('|')) {
    throw new Error(`${label} expected ${expected.join('|')}, got ${actual.join('|')}`);
  }
  return actual.length;
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

  // Day4: replace synthetic REST padding with ordinary fence life around the
  // canonical 18:00-22:00 JOB-FARM-04 shift.
  const day4FreeTime = byId.get('VR2-D04-08');
  if (!day4FreeTime) throw new Error('VR2-D04-08 missing from strict playability candidate');
  const oldSteps = parsedSteps(day4FreeTime);
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

  // Day5/Day6 T02 chronology: the legacy v2 rows still show a burned granary
  // on Day5 morning. The later canonical correction in TRPG/開発引き継ぎ fixes
  // the arson to Day5 night and the aftermath scene to Day6 dawn. Production
  // already enforces that corrected window. Keep Day5 as ordinary village life,
  // then execute the exact authored dawn/evidence chain after waking on Day6.
  const day5DawnLegacy = byId.get('VR2-D05-02');
  const day5FireEvidenceLegacy = byId.get('VR2-D05-04');
  const day5SeedWheatLegacy = byId.get('VR2-D05-05');
  const day5FreeTime = byId.get('VR2-D05-07');
  const day6Contract = byId.get('VR2-D06-02');
  const day6FreeTime = byId.get('VR2-D06-08');
  for (const [id, row] of [
    ['VR2-D05-02', day5DawnLegacy],
    ['VR2-D05-04', day5FireEvidenceLegacy],
    ['VR2-D05-05', day5SeedWheatLegacy],
    ['VR2-D05-07', day5FreeTime],
    ['VR2-D06-02', day6Contract],
    ['VR2-D06-08', day6FreeTime],
  ]) {
    if (!row) throw new Error(`${id} missing from strict playability candidate`);
  }

  assertActionIds(day5DawnLegacy, [
    'MISSION_FLOW:T02:T02_GRANARY_DAWN:rope_the_scene',
    'MISSION_FLOW:T02:T02_DAWN_SCENE_RECORD:trace_oil',
  ], 'VR2-D05-02');
  assertActionIds(day5FireEvidenceLegacy, [
    'MISSION_FLOW:granary-arson:OPENING:timeline',
    'T02_GRANARY:EVIDENCE:FIRE:OIL_TRACK',
  ], 'VR2-D05-04');
  assertActionIds(day5FreeTime, [
    'MOVE_LOCAL:LOC_FARM_INN',
    'LIFE:REST:90',
    'WORK:FACILITY:JOB-FARM-03',
    'MOVE_LOCAL:LOC_FARM_NORTH_FENCE',
    'WORK:FACILITY:JOB-FARM-04',
  ], 'VR2-D05-07');
  if (day6Contract.actionId !== 'T02_GRANARY:EVIDENCE:CONTRACT:LEDGER_GAP') {
    throw new Error(`VR2-D06-02 expected contract evidence action, got ${day6Contract.actionId}`);
  }
  assertActionIds(day6FreeTime, [
    '',
    'LIFE:REST:90',
    'WORK:FACILITY:JOB-FARM-04',
    'LIFE:REST:30',
  ], 'VR2-D06-08');
  if (parsedSteps(day6FreeTime)[0]?.commandType !== 'OUTCOME') {
    throw new Error(`VR2-D06-08 first v8 step must be satisfied schedule outcome, got ${parsedSteps(day6FreeTime)[0]?.commandType}`);
  }

  const day5GranaryRoutine = 'DAILY_LIFE:DAY5_VILLAGE_ROUTINE:count_and_stack_granary_sacks';
  const day5FenceMaintenance = 'DAILY_LIFE:DAY5_VILLAGE_ROUTINE:inspect_fence_and_lanterns';
  const day5WatchPrep = 'DAILY_LIFE:DAY5_VILLAGE_ROUTINE:prepare_night_watch';

  sequence(day5DawnLegacy, [
    commandStep(day5GranaryRoutine, {
      facilityId: 'LOC_FARM_GRANARY',
      scheduledEnd: '10:00',
    }),
  ], {
    description: 'Day5朝はまだ火災前。共同穀倉で麻袋を数え、通路を空ける通常の村仕事を手伝う',
    requiredState: 'Day5 morning before the canonical Day5-night arson; at LOC_FARM_GRANARY; no burned-site evidence exists yet',
    resultingState: 'clock advances naturally to the JOB-FARM-02 opening; no T02 evidence, progress, route flag, wage, or burned-site assumption is created',
    implementationSource: 'src/server/trpg/content/authored-village-day5-before-fire.js',
    notes: 'canonical correction: replaces obsolete pre-fire burned-granary commands; the T02 dawn choices are moved to Day6 after the actual Day5-night fire',
  });

  sequence(day5FireEvidenceLegacy, [
    commandStep('WORK:FACILITY:JOB-FARM-02', {
      facilityId: 'LOC_FARM_GRANARY',
      jobId: 'JOB-FARM-02',
      scheduledStart: '10:00',
      scheduledEnd: '13:00',
    }),
  ], {
    description: 'Day5昼は共同穀倉の正規日雇い仕事を行う。火災調査はまだ始めない',
    requiredState: 'Day5; at LOC_FARM_GRANARY; JOB-FARM-02 within its canonical work window; fire has not occurred',
    resultingState: 'canonical JOB-FARM-02 wage/time apply exactly once; T02 investigation remains untouched before the fire',
    implementationSource: 'src/server/trpg/content/canonical-regional-labour.js + canonical-job-time-policy.js',
    notes: 'one real Sheet-backed job replaces two impossible burned-site investigation commands; row-count balance is restored by the expanded Day6 dawn chain',
  });

  outcome(day5SeedWheatLegacy, {
    description: '日雇い後、残った種麦と荷札を棚へ戻し、翌日の作業に備える',
    requiredState: 'Day5 daytime; granary still intact',
    resultingState: 'ordinary work wrap-up only; no arson conclusion, evidence, trust, or mission progress is awarded',
    implementationSource: 'strict playability chronology correction',
    notes: 'legacy text shared an arson conclusion before the corrected Day5-night fire; retained as a zero-time ordinary-work outcome without adding unseen facts',
  });

  sequence(day5FreeTime, [
    commandStep(day5FenceMaintenance, { facilityId: 'LOC_FARM_NORTH_FENCE' }),
    commandStep(day5WatchPrep, {
      facilityId: 'LOC_FARM_NORTH_FENCE',
      scheduledEnd: '18:00',
    }),
    commandStep('WORK:FACILITY:JOB-FARM-04', {
      facilityId: 'LOC_FARM_NORTH_FENCE',
      jobId: 'JOB-FARM-04',
      scheduledStart: '18:00',
      scheduledEnd: '22:00',
    }),
  ], {
    description: 'Day5午後は北柵の手入れと夜警準備を行い、18時から22時まで正規夜警に入る',
    requiredState: 'Day5 afternoon; compiler-inserted move reaches LOC_FARM_NORTH_FENCE before 18:00; villageTrust>=2; needs below urgent survival threshold',
    resultingState: 'ordinary unpaid preparation advances to 18:00; canonical JOB-FARM-04 pays exactly 3G for 240 minutes and ends at the corrected arson-opening time; no generic REST padding',
    implementationSource: 'src/server/trpg/content/authored-village-day5-before-fire.js + canonical-regional-labour.js + canonical-job-time-policy.js',
    notes: 'removes internal Inn detour/REST/JOB-FARM-03 and the duplicate internal return move; the existing compiler move places the player at North Fence and D05-08 performs the real move back to the inn',
  });

  sequence(day6Contract, [
    commandStep('MISSION_FLOW:T02:T02_GRANARY_DAWN:rope_the_scene', {
      facilityId: 'LOC_FARM_GRANARY',
    }),
    commandStep('MISSION_FLOW:T02:T02_DAWN_SCENE_RECORD:trace_oil', {
      facilityId: 'LOC_FARM_GRANARY',
    }),
    commandStep('MISSION_FLOW:granary-arson:OPENING:timeline', {
      facilityId: 'LOC_FARM_GRANARY',
    }),
    commandStep('T02_GRANARY:EVIDENCE:FIRE:OIL_TRACK', {
      facilityId: 'LOC_FARM_GRANARY',
    }),
    commandStep('T02_GRANARY:EVIDENCE:CONTRACT:LEDGER_GAP', {
      facilityId: 'LOC_FARM_GRANARY',
    }),
  ], {
    description: 'Day6夜明け、昨夜の共同穀倉火災で現場を保全し、油筋を記録してからT02正規調査へ接続する',
    requiredState: 'Day6 dawn after the canonical Day5-night arson; T02 open; at LOC_FARM_GRANARY; dawn window open',
    resultingState: 'dawn scene and follow-up are consumed visibly; T02 hearing opens; fire-origin and merchant-contract evidence classes progress through production actions only',
    implementationSource: 'src/server/trpg/content/authored-mission-flow-t02-granary-dawn.js + authored-mission-t02-granary-continuity.js',
    notes: 'moves the exact two dawn actions and two fire-opening/evidence actions out of impossible Day5 morning into the corrected Day6 dawn before the pre-existing contract-evidence command',
  });

  const day6Maintenance = 'DAILY_LIFE:DAY6_NORTH_FENCE_WORKDAY:check_posts_and_lanterns';
  const day6WatchPrep = 'DAILY_LIFE:DAY6_NORTH_FENCE_WORKDAY:prepare_watch_handover';
  const day6WindDown = 'DAILY_LIFE:DAY6_NORTH_FENCE_WORKDAY:finish_watch_notes';
  sequence(day6FreeTime, [
    commandStep(day6Maintenance, { facilityId: 'LOC_FARM_NORTH_FENCE' }),
    commandStep(day6WatchPrep, { facilityId: 'LOC_FARM_NORTH_FENCE', scheduledEnd: '18:00' }),
    commandStep('WORK:FACILITY:JOB-FARM-04', {
      facilityId: 'LOC_FARM_NORTH_FENCE',
      jobId: 'JOB-FARM-04',
      scheduledStart: '18:00',
      scheduledEnd: '22:00',
    }),
    commandStep(day6WindDown, {
      facilityId: 'LOC_FARM_NORTH_FENCE',
      scheduledStart: '22:00',
      scheduledEnd: '22:30',
    }),
  ], {
    description: 'Day6午後は北柵の手入れと夜警準備を行い、18時から正規夜警、22時から勤務記録の整理をして22時30分まで過ごす',
    requiredState: 'Day6 compiler-inserted Bakery→LOC_FARM_NORTH_FENCE move completed in mid-afternoon; needs below urgent survival threshold; T02 may remain active but is defer-capable; JOB-FARM-04 remains governed by its canonical 18:00-22:00 window',
    resultingState: 'ordinary unpaid maintenance and handover preparation advance naturally to 18:00; canonical JOB-FARM-04 pays exactly 3G for 240 minutes; unpaid post-shift notes advance to 22:30; T02 remains unresolved; no WAIT or generic REST padding',
    implementationSource: 'src/server/trpg/content/authored-village-day6-north-fence-workday.js + canonical-regional-labour.js + canonical-job-time-policy.js',
    notes: 'Day6 had retained the same impossible OUTCOME + REST90 + JOB-FARM-04 + REST30 timing pattern already removed from Day4. Replace it with four visible common-world production actions without changing the reviewed 1521-row ledger.',
  });

  const realigned = [
    'VR2-D04-08',
    'VR2-D05-02',
    'VR2-D05-04',
    'VR2-D05-05',
    'VR2-D05-07',
    'VR2-D06-02',
    'VR2-D06-08',
  ];
  summary.strictPlayabilityRealignmentVersion = STRICT_PLAYABILITY_REALIGNMENT_VERSION;
  summary.strictPlayabilityRealignedLegacyRows = [
    ...new Set([
      ...(Array.isArray(summary.strictPlayabilityRealignedLegacyRows) ? summary.strictPlayabilityRealignedLegacyRows : []),
      ...realigned,
    ]),
  ];
  // D05-02: 2→1 (-1), D05-04: 2→1 (-1), D05-07: 5→3 (-2),
  // D06-02: 1→5 (+4), D06-08: 4→4 (0). Net zero; 1521 rows remain exact.
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
