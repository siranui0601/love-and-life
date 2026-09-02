#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');

export const FULL_ROUTE_AUDIT_REALIGNMENT_VERSION = 'virtue-route-v3-full-route-audit-v1';

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

  const originalMoves = Array.isArray(movesArtifact.moves) ? movesArtifact.moves : [];
  const obsoleteBeforeRows = new Set(['VR2-D02-05', 'VR2-D02-06']);
  const removedMoves = originalMoves.filter((entry) => obsoleteBeforeRows.has(entry.beforeLegacyRowId));
  if (removedMoves.length !== 2 || ![...obsoleteBeforeRows].every((id) => removedMoves.some((entry) => entry.beforeLegacyRowId === id))) {
    throw new Error(`expected stale Day2 inn detour moves before D02-05/D02-06 exactly once each; got ${removedMoves.map((entry) => entry.beforeLegacyRowId).join(', ')}`);
  }
  movesArtifact.moves = originalMoves.filter((entry) => !obsoleteBeforeRows.has(entry.beforeLegacyRowId));
  movesArtifact.count = movesArtifact.moves.length;
  movesArtifact.fullRouteAuditRealignmentVersion = FULL_ROUTE_AUDIT_REALIGNMENT_VERSION;

  summary.proposedMoveLocalInsertions = movesArtifact.moves.length;
  summary.expandedV3Rows = rows.reduce((total, row) => total + Math.max(1, stepCount(row)), 0) + movesArtifact.moves.length;
  summary.fullRouteAuditRealignmentVersion = FULL_ROUTE_AUDIT_REALIGNMENT_VERSION;
  summary.fullRouteAuditRealignedLegacyRows = [
    ...(Array.isArray(summary.fullRouteAuditRealignedLegacyRows) ? summary.fullRouteAuditRealignedLegacyRows : []),
    'VR2-D02-05',
  ];
  summary.fullRouteAuditRemovedMoveBeforeRows = [...obsoleteBeforeRows];

  if (summary.expandedV3Rows !== 1521) {
    throw new Error(`full-route audit Day2 work realignment must produce 1521 expanded rows, got ${summary.expandedV3Rows}`);
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
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyFullRouteAuditRealignment(), null, 2));
}
