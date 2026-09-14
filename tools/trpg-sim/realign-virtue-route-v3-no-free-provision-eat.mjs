#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');

export const NO_FREE_PROVISION_EAT_REALIGNMENT_VERSION = 'virtue-route-v3-no-free-provision-eat-v1';

const PROVISION_IDS = new Set([
  'ITM008', 'ITM010', 'ITM023', 'ITM036', 'ITM038', 'ITM072',
  'ITM082', 'ITM163', 'ITM179', 'ITM192', 'ITM205',
]);

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

function parsedSteps(row) {
  if (!row?.replacementSteps) return [];
  try {
    const value = JSON.parse(row.replacementSteps);
    return Array.isArray(value) ? value : [];
  } catch {
    throw new Error(`${row?.legacyRowId ?? 'unknown row'} has invalid replacementSteps JSON`);
  }
}

function isRetiredProvisionEat(actionId) {
  const id = String(actionId ?? '');
  if (!id.startsWith('LIFE:EAT:')) return false;
  return PROVISION_IDS.has(id.slice('LIFE:EAT:'.length));
}

function expandedRowCount(rows, moves) {
  return rows.reduce((total, row) => total + Math.max(1, parsedSteps(row).length), 0) + moves.length;
}

function appendNote(existing, note) {
  const left = String(existing ?? '').trim();
  return left ? `${left} | ${note}` : note;
}

function setRetiredOutcome(row) {
  Object.assign(row, {
    classification: 'NARRATIVE_OUTCOME',
    commandType: 'OUTCOME',
    actionId: '',
    choiceId: '',
    payload: '',
    replacementSteps: '',
    replacementRowIds: '',
    resolutionMethod: 'NO_FREE_PROVISION_EAT_REALIGNMENT',
    requiredState: appendNote(
      row.requiredState,
      'carried provisions may exist, but production exposes no generic inventory consume action',
    ),
    resultingState: 'the carried provision remains in inventory; this retired timetable meal advances no time, changes no hunger, and grants no hidden route state',
    implementationSource: 'src/server/trpg/content/canonical-world-life-actions.js canonical-world-life-v3 + tools/trpg-sim/realign-virtue-route-v3-no-free-provision-eat.mjs',
    status: 'OUTCOME',
    unresolvedReason: '',
    notes: appendNote(
      row.notes,
      '2026-09 Human Virtue clarification: arbitrary carried-food consumption was removed from production. This legacy meal is retained only as source mapping; a later explicit meal/scene choice is added only where live hunger, duration and location make eating meaningful.',
    ),
  });
}

function setFilteredSequence(row, steps) {
  if (!steps.length) {
    setRetiredOutcome(row);
    return;
  }
  Object.assign(row, {
    classification: 'PLAYER_COMMAND_SEQUENCE',
    commandType: 'SEQUENCE',
    actionId: steps.at(-1)?.actionId ?? '',
    choiceId: '',
    payload: JSON.stringify({ steps }),
    replacementSteps: JSON.stringify(steps),
    replacementRowIds: steps.map((_, index) => `${row.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|'),
    resolutionMethod: 'NO_FREE_PROVISION_EAT_REALIGNMENT',
    requiredState: appendNote(
      row.requiredState,
      'any carried provision remains inventory-only until an explicit meal/scene action consumes it',
    ),
    resultingState: 'all remaining visible production commands execute normally; retired generic provision consumption contributes no hunger recovery, time advance or route state',
    implementationSource: 'src/server/trpg/content/canonical-world-life-actions.js canonical-world-life-v3 + tools/trpg-sim/realign-virtue-route-v3-no-free-provision-eat.mjs',
    status: 'RESOLVED_EXISTING',
    unresolvedReason: '',
    notes: appendNote(
      row.notes,
      'removed the stale LIFE:EAT:<provision> sub-step. Purchase/movement/work in the same source row remains authoritative; the food itself stays carried until a contextual meal decision.',
    ),
  });
}

export function applyNoFreeProvisionEatRealignment({ outDir = DEFAULT_OUT } = {}) {
  const mappingPath = path.join(outDir, 'virtue-route-v3-mapping.csv');
  const movesPath = path.join(outDir, 'virtue-route-v3-proposed-local-moves.json');
  const summaryPath = path.join(outDir, 'virtue-route-v3-static-summary.json');
  const { headers, rows } = objects(fs.readFileSync(mappingPath, 'utf8'));
  const movesArtifact = JSON.parse(fs.readFileSync(movesPath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const moves = Array.isArray(movesArtifact.moves) ? movesArtifact.moves : [];

  const countedBefore = expandedRowCount(rows, moves);
  if (Number(summary.expandedV3Rows) !== countedBefore) {
    throw new Error(`no-free-provision-eat input accounting mismatch: summary=${summary.expandedV3Rows}, counted=${countedBefore}`);
  }

  let touchedRows = 0;
  let removedCommandCount = 0;
  let retiredOutcomeRows = 0;
  const touchedLegacyRowIds = [];

  for (const row of rows) {
    const steps = parsedSteps(row);
    const retiredSteps = steps.filter((step) => isRetiredProvisionEat(step?.actionId));

    if (retiredSteps.length > 0) {
      const remaining = steps.filter((step) => !isRetiredProvisionEat(step?.actionId));
      setFilteredSequence(row, remaining);
      touchedRows += 1;
      removedCommandCount += retiredSteps.length;
      touchedLegacyRowIds.push(row.legacyRowId);
      if (!remaining.length) retiredOutcomeRows += 1;
      continue;
    }

    if (isRetiredProvisionEat(row.actionId)) {
      setRetiredOutcome(row);
      touchedRows += 1;
      removedCommandCount += 1;
      retiredOutcomeRows += 1;
      touchedLegacyRowIds.push(row.legacyRowId);
    }
  }

  if (touchedRows === 0 || removedCommandCount === 0) {
    throw new Error('no-free-provision-eat realignment found no legacy generic provision consumption to retire');
  }

  const stillExecutable = rows.flatMap((row) => [
    row.actionId,
    ...parsedSteps(row).map((step) => step?.actionId),
  ]).filter(isRetiredProvisionEat);
  if (stillExecutable.length) {
    throw new Error(`generic carried-food actions remain executable: ${stillExecutable.slice(0, 10).join(',')}`);
  }

  summary.noFreeProvisionEatRealignmentVersion = NO_FREE_PROVISION_EAT_REALIGNMENT_VERSION;
  summary.noFreeProvisionEatTouchedRows = touchedRows;
  summary.noFreeProvisionEatRemovedCommands = removedCommandCount;
  summary.noFreeProvisionEatRetiredOutcomeRows = retiredOutcomeRows;
  summary.noFreeProvisionEatLegacyRowIds = touchedLegacyRowIds;
  summary.expandedV3Rows = expandedRowCount(rows, moves);

  fs.writeFileSync(mappingPath, csv(rows, headers));
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  return {
    version: NO_FREE_PROVISION_EAT_REALIGNMENT_VERSION,
    touchedRows,
    removedCommandCount,
    retiredOutcomeRows,
    expandedV3Rows: summary.expandedV3Rows,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyNoFreeProvisionEatRealignment(), null, 2));
}
