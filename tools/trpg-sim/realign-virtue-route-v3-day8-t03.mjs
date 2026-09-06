#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');
const CANONICAL_EXPANDED_ROWS = 1521;

export const DAY8_T03_REALIGNMENT_VERSION = 'virtue-route-v3-day8-t03-v2';

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/u, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/u, '')); rows.push(row); }
  return rows;
}

function csvCell(value) {
  const text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

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

function choose(actionId, extra = {}) {
  return {
    actionId,
    commandType: 'CHOOSE',
    payload: { choiceId: actionId, actionId },
    ...extra,
  };
}

function move(facilityId, extra = {}) {
  const actionId = `MOVE_LOCAL:${facilityId}`;
  return {
    actionId,
    commandType: 'MOVE',
    payload: { moveId: actionId },
    ...extra,
  };
}

function satisfiedMove(moveActionId, extra = {}) {
  return {
    actionId: '',
    commandType: 'OUTCOME',
    payload: { satisfiedByInsertedMove: moveActionId },
    ...extra,
  };
}

function parsedSteps(row) {
  return row?.replacementSteps ? JSON.parse(row.replacementSteps) : [];
}

function setSequence(row, steps, {
  facilityId,
  requiredState,
  resultingState,
  implementationSource,
  notes,
}) {
  Object.assign(row, {
    classification: 'PLAYER_COMMAND_SEQUENCE',
    commandType: 'SEQUENCE',
    choiceId: '',
    actionId: steps.at(-1).actionId,
    payload: JSON.stringify({ steps }),
    replacementSteps: JSON.stringify(steps),
    replacementRowIds: steps.map((_, index) => `${row.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|'),
    resolutionMethod: 'STRICT_PLAYABILITY_REALIGNMENT',
    regionId: '田園の村',
    facilityId,
    requiredState,
    resultingState,
    implementationSource,
    status: 'RESOLVED_EXISTING',
    unresolvedReason: '',
    notes,
  });
}

function requireMove(moves, legacyRowId, expectedActionId) {
  const matches = moves.filter((entry) => entry.beforeLegacyRowId === legacyRowId);
  if (matches.length !== 1) {
    throw new Error(`${legacyRowId} expected exactly one compiler MOVE, got ${matches.length}`);
  }
  if (matches[0].actionId !== expectedActionId) {
    throw new Error(`${legacyRowId} expected compiler MOVE ${expectedActionId}, got ${matches[0].actionId}`);
  }
  return matches[0];
}

function retargetMove(entry, facilityId) {
  entry.toFacilityId = facilityId;
  entry.actionId = `MOVE_LOCAL:${facilityId}`;
  entry.commandType = 'MOVE';
  entry.payload = { moveId: entry.actionId };
}

export function applyDay8T03Realignment({ outDir = DEFAULT_OUT } = {}) {
  const mappingPath = path.join(outDir, 'virtue-route-v3-mapping.csv');
  const movesPath = path.join(outDir, 'virtue-route-v3-proposed-local-moves.json');
  const summaryPath = path.join(outDir, 'virtue-route-v3-static-summary.json');
  const { headers, rows } = objects(fs.readFileSync(mappingPath, 'utf8'));
  const movesArtifact = JSON.parse(fs.readFileSync(movesPath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const byId = new Map(rows.map((row) => [row.legacyRowId, row]));

  if (Number(summary.expandedV3Rows) !== CANONICAL_EXPANDED_ROWS) {
    throw new Error(`Day8 T03 realignment expected ${CANONICAL_EXPANDED_ROWS} rows before 4->4 / 2->2 patch, got ${summary.expandedV3Rows}`);
  }

  const first = byId.get('VR2-D08-02');
  const second = byId.get('VR2-D08-04');
  if (!first || !second) throw new Error('Day8 T03 source rows are missing');

  const oldFirst = parsedSteps(first);
  const expectedFirst = [
    'MOVE_LOCAL:LOC_FARM_CHIEF',
    'MISSION_FLOW:red-fang-migration:OPENING:feeding_pattern',
    'MISSION_FLOW:red-fang-migration:LEAD:livestock_timeline@LOC_FARM_CHIEF',
    'MISSION_FLOW:red-fang-migration:EVIDENCE:livestock_timeline',
  ];
  if (oldFirst.map((step) => step.actionId).join('|') !== expectedFirst.join('|')) {
    throw new Error(`VR2-D08-02 stale T03 sequence changed: ${oldFirst.map((step) => step.actionId).join('|')}`);
  }

  const oldSecond = parsedSteps(second);
  const expectedSecond = [
    'MISSION_FLOW:red-fang-migration:LEAD:wound_pattern@LOC_FARM_STABLE',
    'MISSION_FLOW:red-fang-migration:EVIDENCE:wound_pattern',
  ];
  if (oldSecond.map((step) => step.actionId).join('|') !== expectedSecond.join('|')) {
    throw new Error(`VR2-D08-04 stale T03 sequence changed: ${oldSecond.map((step) => step.actionId).join('|')}`);
  }

  const moves = Array.isArray(movesArtifact.moves) ? movesArtifact.moves : [];
  const firstMove = requireMove(moves, 'VR2-D08-02', 'MOVE_LOCAL:LOC_FARM_STABLE');
  const secondMove = requireMove(moves, 'VR2-D08-04', 'MOVE_LOCAL:LOC_FARM_WELL');
  retargetMove(firstMove, 'LOC_FARM_CHIEF');
  retargetMove(secondMove, 'LOC_FARM_STABLE');

  setSequence(first, [
    satisfiedMove('MOVE_LOCAL:LOC_FARM_CHIEF', { regionId: '田園の村', facilityId: 'LOC_FARM_CHIEF' }),
    choose('T03_WOLF:OPEN:stable_bells', { regionId: '田園の村', facilityId: 'LOC_FARM_CHIEF' }),
    move('LOC_FARM_STABLE', { regionId: '田園の村', facilityId: 'LOC_FARM_STABLE' }),
    choose('T03_WOLF:EVIDENCE:APEX:SNAPPED_TREES', { regionId: '田園の村', facilityId: 'LOC_FARM_STABLE' }),
  ], {
    facilityId: 'LOC_FARM_STABLE',
    requiredState: 'T03 active on Day8; compiler MOVE arrives at LOC_FARM_CHIEF; current production T03 wolf hearing visible; sceneRevision starts at 0',
    resultingState: 'T03 opening=stable_bells; first post-opening rotation selects apex_pressure; canonical T03-EVIDENCE-APEX-PREDATOR-TRACKS recorded',
    implementationSource: 'src/server/trpg/content/authored-mission-t03-wolf-continuity.js + authored-mission-t03-investigation-contract.js',
    notes: 'the production T03 evidence list rotates by sceneRevision: after one opening revision=1 exposes apex_pressure before pack_displacement. This follows the live three-worldline surface rather than forcing the retired feeding_pattern order; inserted MOVE is retargeted; 4->4 preserves the reviewed ledger',
  });

  setSequence(second, [
    satisfiedMove('MOVE_LOCAL:LOC_FARM_STABLE', { regionId: '田園の村', facilityId: 'LOC_FARM_STABLE' }),
    choose('T03_WOLF:EVIDENCE:PACK:HOOF_TRACKS', { regionId: '田園の村', facilityId: 'LOC_FARM_STABLE' }),
  ], {
    facilityId: 'LOC_FARM_STABLE',
    requiredState: 'T03 investigation active; apex_pressure already acquired; sceneRevision=2; no prior livestock-evacuation side choice; compiler MOVE returns from breakfast to LOC_FARM_STABLE',
    resultingState: 'second independent T03 evidence class pack_displacement acquired; canonical T03-EVIDENCE-ATTACKS-MOVING-INWARD recorded; required investigation count reaches 2',
    implementationSource: 'src/server/trpg/content/authored-mission-t03-wolf-continuity.js + authored-mission-t03-investigation-contract.js',
    notes: 'after apex_pressure, revision=2 rotates pack_displacement back into the visible production pair. The old wound_pattern pair is replaced without side-choice injection; inserted MOVE is retargeted from the stale well destination; 2->2 preserves the reviewed ledger',
  });

  movesArtifact.day8T03RealignmentVersion = DAY8_T03_REALIGNMENT_VERSION;
  movesArtifact.day8T03RetargetedMoveBeforeRows = ['VR2-D08-02', 'VR2-D08-04'];
  movesArtifact.count = moves.length;

  summary.day8T03RealignmentVersion = DAY8_T03_REALIGNMENT_VERSION;
  summary.day8T03RealignedLegacyRows = ['VR2-D08-02', 'VR2-D08-04'];
  summary.expandedV3Rows = CANONICAL_EXPANDED_ROWS;

  fs.writeFileSync(mappingPath, csv(rows, headers));
  fs.writeFileSync(movesPath, `${JSON.stringify(movesArtifact, null, 2)}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  return {
    version: DAY8_T03_REALIGNMENT_VERSION,
    expandedV3Rows: summary.expandedV3Rows,
    realignedLegacyRows: [...summary.day8T03RealignedLegacyRows],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyDay8T03Realignment(), null, 2));
}
