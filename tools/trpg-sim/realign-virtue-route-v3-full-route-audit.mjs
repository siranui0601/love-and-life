#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');

export const FULL_ROUTE_AUDIT_REALIGNMENT_VERSION = 'virtue-route-v3-full-route-audit-v4';

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

function stepCount(row) {
  if (row.replacementSteps) return JSON.parse(row.replacementSteps).length;
  return 1;
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
    replacementRowIds: '',
    replacementSteps: '',
    resolutionMethod: 'FULL_ROUTE_AUDIT_REALIGNMENT',
    commandType: 'OUTCOME',
    choiceId: '',
    actionId: '',
    payload: '{}',
    facilityId: '',
    jobId: '',
    productId: '',
    equipmentId: '',
    materialId: '',
    skillId: '',
    requiredState,
    resultingState,
    implementationSource,
    status: 'OUTCOME',
    unresolvedReason: '',
    notes,
  });
}

function chooseAction(row, {
  description,
  actionId,
  facilityId,
  requiredState,
  resultingState,
  implementationSource,
  notes,
}) {
  Object.assign(row, {
    legacyDescription: description,
    classification: 'PLAYER_COMMAND',
    replacementRowIds: '',
    replacementSteps: '',
    resolutionMethod: 'FULL_ROUTE_AUDIT_REALIGNMENT',
    commandType: 'CHOOSE',
    choiceId: actionId,
    actionId,
    payload: JSON.stringify({ choiceId: actionId, actionId }),
    facilityId,
    jobId: '',
    productId: '',
    equipmentId: '',
    materialId: '',
    skillId: '',
    requiredState,
    resultingState,
    implementationSource,
    status: 'RESOLVED_EXISTING',
    unresolvedReason: '',
    notes,
  });
}

function firstSequencedMove(row) {
  if (!row?.replacementSteps) return null;
  const steps = JSON.parse(row.replacementSteps);
  const first = steps[0];
  if (!first || first.commandType !== 'MOVE' || !String(first.actionId ?? '').startsWith('MOVE_LOCAL:')) return null;
  return first;
}

export function applyFullRouteAuditRealignment({ outDir = DEFAULT_OUT } = {}) {
  const mappingPath = path.join(outDir, 'virtue-route-v3-mapping.csv');
  const movesPath = path.join(outDir, 'virtue-route-v3-proposed-local-moves.json');
  const summaryPath = path.join(outDir, 'virtue-route-v3-static-summary.json');
  const { headers, rows } = objects(fs.readFileSync(mappingPath, 'utf8'));
  const byId = new Map(rows.map((row) => [row.legacyRowId, row]));
  const movesArtifact = JSON.parse(fs.readFileSync(movesPath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

  const staleMiddayShift = byId.get('VR2-D02-05');
  if (!staleMiddayShift) throw new Error('VR2-D02-05 missing from audit candidate');
  if (staleMiddayShift.actionId !== 'WORK:FACILITY:JOB-FARM-03') {
    throw new Error(`VR2-D02-05 expected JOB-FARM-03 before audit realignment, got ${staleMiddayShift.actionId}`);
  }
  outcome(staleMiddayShift, {
    description: 'Day2の警告・見回り対応が昼まで続いたため、朝勤務の麦穂亭皿洗いはこの日は行わない',
    requiredState: 'Day2 warning/watch chain completed around early afternoon; player remains at LOC_FARM_SQUARE; JOB-FARM-03 is a canonical morning/evening shift and is not currently available',
    resultingState: 'no work shift performed; no wage fabricated; player remains at LOC_FARM_SQUARE and can continue the existing village-belonging chain',
    implementationSource: 'TRPG/仕事マスター JOB-FARM-03 + src/server/trpg/content/canonical-regional-labour.js',
    notes: 'stale route filler removed instead of inventing a midday inn shift, teleporting, or bypassing canonical work hours',
  });

  const staleLongRest = byId.get('VR2-D02-08');
  if (!staleLongRest) throw new Error('VR2-D02-08 missing from audit candidate');
  if (staleLongRest.actionId !== 'LIFE:REST:390') {
    throw new Error(`VR2-D02-08 expected LIFE:REST:390 before audit realignment, got ${staleLongRest.actionId}`);
  }
  const bakeryEveningAction = 'DAILY_LIFE:DAILY_BAKERY_EVENING:mend_gear_by_oven';
  chooseAction(staleLongRest, {
    description: 'Day2の午後、パン屋の竈脇で装備を手入れし、閉店までの普通の夕方を過ごす',
    actionId: bakeryEveningAction,
    facilityId: 'LOC_FARM_BAKERY',
    requiredState: 'Day2 15:00-22:15; LOC_FARM_BAKERY; no higher-priority authored incident scene; hunger/fatigue below calm threshold; common bakery-evening scene unused',
    resultingState: 'common-world bakery evening completed; gear maintained; ordinary conversation/closing-time life passes naturally until 22:15 without synthetic WAIT or long REST padding',
    implementationSource: 'src/server/trpg/content/authored-village-bakery-evening.js',
    notes: 'replaces legacy 390-minute generic REST with a route-neutral visible production choice available to every player in the same Day2 bakery world state; no teleport, route flag, wage, or hidden dispatch',
  });

  const staleDay3Morning = byId.get('VR2-D03-03');
  if (!staleDay3Morning) throw new Error('VR2-D03-03 missing from audit candidate');
  if (staleDay3Morning.classification !== 'NARRATIVE_OUTCOME' && staleDay3Morning.commandType !== 'OUTCOME') {
    throw new Error(`VR2-D03-03 expected prose-only outcome before audit realignment, got ${staleDay3Morning.classification}/${staleDay3Morning.commandType}`);
  }
  const bakeryMorningAction = 'DAILY_LIFE:DAILY_BAKERY_MORNING:sort_flour_sacks';
  chooseAction(staleDay3Morning, {
    description: 'Day3の朝、パン屋で粉袋と空の麻袋を数えて仕分け、通常の仕事口が開くまで村の朝仕事を手伝う',
    actionId: bakeryMorningAction,
    facilityId: 'LOC_FARM_BAKERY',
    requiredState: 'Day3 07:00-08:00 start; LOC_FARM_BAKERY; no higher-priority authored scene; hunger/fatigue below calm threshold; common bakery-morning scene unused',
    resultingState: 'two hours of ordinary unpaid village life pass through a visible production action; no wage or route score; subsequent canonical JOB-FARM-02 remains governed by its 10:00-17:00 work window',
    implementationSource: 'src/server/trpg/content/authored-village-bakery-morning.js',
    notes: 'replaces a 120-minute prose-only legacy block that strict replay could not execute; uses a route-neutral life action rather than REST/WAIT padding or an early-job bypass',
  });

  const originalMoves = Array.isArray(movesArtifact.moves) ? movesArtifact.moves : [];
  const obsoleteBeforeRows = new Set(['VR2-D02-05', 'VR2-D02-06']);
  const removedObsoleteMoves = originalMoves.filter((entry) => obsoleteBeforeRows.has(entry.beforeLegacyRowId));
  if (removedObsoleteMoves.length !== 2 || ![...obsoleteBeforeRows].every((id) => removedObsoleteMoves.some((entry) => entry.beforeLegacyRowId === id))) {
    throw new Error(`expected stale Day2 inn detour moves before D02-05/D02-06 exactly once each; got ${removedObsoleteMoves.map((entry) => entry.beforeLegacyRowId).join(', ')}`);
  }

  const redundantSequencedMoves = originalMoves.filter((entry) => {
    if (obsoleteBeforeRows.has(entry.beforeLegacyRowId)) return false;
    const first = firstSequencedMove(byId.get(entry.beforeLegacyRowId));
    return Boolean(first && first.actionId === entry.actionId);
  });
  const redundantBeforeRows = new Set(redundantSequencedMoves.map((entry) => entry.beforeLegacyRowId));

  movesArtifact.moves = originalMoves.filter((entry) => (
    !obsoleteBeforeRows.has(entry.beforeLegacyRowId)
    && !redundantBeforeRows.has(entry.beforeLegacyRowId)
  ));
  movesArtifact.count = movesArtifact.moves.length;
  movesArtifact.fullRouteAuditRealignmentVersion = FULL_ROUTE_AUDIT_REALIGNMENT_VERSION;
  movesArtifact.fullRouteAuditRemovedRedundantMoveBeforeRows = [...redundantBeforeRows];

  summary.proposedMoveLocalInsertions = movesArtifact.moves.length;
  summary.expandedV3Rows = rows.reduce((total, row) => total + Math.max(1, stepCount(row)), 0) + movesArtifact.moves.length;
  summary.fullRouteAuditRealignmentVersion = FULL_ROUTE_AUDIT_REALIGNMENT_VERSION;
  summary.fullRouteAuditRealignedLegacyRows = [
    ...(Array.isArray(summary.fullRouteAuditRealignedLegacyRows) ? summary.fullRouteAuditRealignedLegacyRows : []),
    'VR2-D02-05',
    'VR2-D02-08',
    'VR2-D03-03',
  ];
  summary.fullRouteAuditRemovedMoveBeforeRows = [...obsoleteBeforeRows];
  summary.fullRouteAuditRemovedRedundantMoveBeforeRows = [...redundantBeforeRows];

  const expectedRows = 1521 - redundantBeforeRows.size;
  if (summary.expandedV3Rows !== expectedRows) {
    throw new Error(`full-route audit realignment expected ${expectedRows} expanded rows after removing ${redundantBeforeRows.size} duplicate sequenced move(s), got ${summary.expandedV3Rows}`);
  }

  fs.writeFileSync(mappingPath, csv(rows, headers));
  fs.writeFileSync(movesPath, `${JSON.stringify(movesArtifact, null, 2)}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  return {
    version: FULL_ROUTE_AUDIT_REALIGNMENT_VERSION,
    expandedV3Rows: summary.expandedV3Rows,
    proposedMoveLocalInsertions: summary.proposedMoveLocalInsertions,
    realignedLegacyRows: [...summary.fullRouteAuditRealignedLegacyRows],
    removedMoveBeforeRows: [...obsoleteBeforeRows],
    removedRedundantMoveBeforeRows: [...redundantBeforeRows],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyFullRouteAuditRealignment(), null, 2));
}
