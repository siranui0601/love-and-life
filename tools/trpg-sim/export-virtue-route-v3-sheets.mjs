#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const DEFAULTS = Object.freeze({
  mappingPath: path.join(ROOT, 'docs/trpg/virtue-route-v3-mapping.csv'),
  movesPath: path.join(ROOT, 'docs/trpg/virtue-route-v3-proposed-local-moves.json'),
  ledgerPath: path.join(ROOT, 'docs/trpg/virtue-route-v3-static-ledger.csv'),
  validationPath: path.join(ROOT, 'docs/trpg/virtue-route-v3-static-validation.json'),
  compilerSummaryPath: path.join(ROOT, 'docs/trpg/virtue-route-v3-static-summary.json'),
  outDir: path.join(ROOT, 'docs/trpg'),
});

export const SHEET_EXPORT_FILES = Object.freeze({
  ledger: 'virtue-route-v3-sheet-ledger.csv',
  mapping: 'virtue-route-v3-sheet-v2-v3-map.csv',
  validation: 'virtue-route-v3-sheet-validation.csv',
  manifest: 'virtue-route-v3-sheet-export-manifest.json',
});

const V3_COLUMNS = Object.freeze([
  'v3RowId', 'sequence', 'sourceV2RowIndex', 'sourceV2RowId', 'sourceDescription',
  'day', 'sourceTime', 'scheduledStart', 'scheduledEnd', 'resourceBoundary',
  'classification', 'commandType', 'actionId', 'choiceId', 'regionId', 'facilityId',
  'npcIds', 'troubleId', 'jobId', 'productId', 'equipmentId', 'materialId', 'skillId',
  'payload', 'requiredState', 'resultingState', 'implementationSource', 'status', 'notes',
  'goldBefore', 'income', 'expense', 'goldAfter', 'freeMeals', 'freeLodging', 'provisions',
  'equipment', 'debt', 'level', 'expIntoLevel', 'totalExp', 'expGain', 'sp', 'skills',
  'incidentState', 'worldState',
]);

const MAP_COLUMNS = Object.freeze([
  'sourceV2RowIndex', 'sourceV2RowId', 'day', 'sourceTime', 'sourceDescription',
  'legacyRuntimeAction', 'legacyRegion', 'classification', 'resolutionMethod', 'status',
  'v3RowCount', 'v3RowIds', 'v3ActionIds', 'requiredState', 'resultingState',
  'implementationSource', 'notes',
]);

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function rowsFromCsv(text) {
  const [headers, ...matrix] = parseCsv(text);
  return matrix.filter((row) => row.some((cell) => cell !== '')).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function toCsv(rows, columns) {
  return `${columns.map(csvCell).join(',')}\n${rows
    .map((row) => columns.map((column) => csvCell(row[column] ?? '')).join(','))
    .join('\n')}\n`;
}

function replacementSteps(mapping) {
  if (mapping.replacementSteps) return JSON.parse(mapping.replacementSteps);
  if (mapping.actionId) {
    return [{
      actionId: mapping.actionId,
      commandType: mapping.commandType,
      payload: JSON.parse(mapping.payload || '{}'),
      regionId: mapping.regionId,
      facilityId: mapping.facilityId,
    }];
  }
  return [{ actionId: '', commandType: 'OUTCOME', payload: {} }];
}

function boundaryFields(ledger) {
  if (!ledger) return {};
  return Object.fromEntries([
    'goldBefore', 'income', 'expense', 'goldAfter', 'freeMeals', 'freeLodging', 'provisions',
    'equipment', 'debt', 'level', 'expIntoLevel', 'totalExp', 'expGain', 'sp', 'skills',
    'incidentState', 'worldState',
  ].map((key) => [key, ledger[key] ?? '']));
}

function v3Id(sequence) {
  return `VR3-${String(sequence).padStart(6, '0')}`;
}

function normalizeStep(mapping, step, sequence, resourceBoundary, ledger) {
  return {
    v3RowId: v3Id(sequence),
    sequence,
    sourceV2RowIndex: mapping.legacyRowIndex,
    sourceV2RowId: mapping.legacyRowId,
    sourceDescription: mapping.legacyDescription,
    day: mapping.legacyDay,
    sourceTime: mapping.legacyTime,
    scheduledStart: step.scheduledStart ?? mapping.plannedStart,
    scheduledEnd: step.scheduledEnd ?? mapping.plannedEnd,
    resourceBoundary,
    classification: mapping.classification,
    commandType: step.commandType ?? mapping.commandType,
    actionId: step.actionId ?? mapping.actionId,
    choiceId: step.payload?.choiceId ?? mapping.choiceId,
    regionId: step.regionId ?? mapping.regionId,
    facilityId: step.facilityId ?? mapping.facilityId,
    npcIds: mapping.npcIds,
    troubleId: mapping.troubleId,
    jobId: mapping.jobId,
    productId: mapping.productId,
    equipmentId: mapping.equipmentId,
    materialId: mapping.materialId,
    skillId: mapping.skillId,
    payload: JSON.stringify(step.payload ?? {}),
    requiredState: mapping.requiredState,
    resultingState: mapping.resultingState,
    implementationSource: mapping.implementationSource,
    status: mapping.status,
    notes: mapping.notes,
    ...(resourceBoundary === 'AFTER_SOURCE_ROW' ? boundaryFields(ledger) : {}),
  };
}

function moveRow(mapping, move, sequence, previousLedger) {
  return {
    v3RowId: v3Id(sequence),
    sequence,
    sourceV2RowIndex: mapping.legacyRowIndex,
    sourceV2RowId: mapping.legacyRowId,
    sourceDescription: `（挿入）${move.fromFacilityId}→${move.toFacilityId}`,
    day: mapping.legacyDay,
    sourceTime: mapping.legacyTime,
    scheduledStart: '',
    scheduledEnd: '',
    resourceBoundary: 'BEFORE_SOURCE_ROW',
    classification: 'PLAYER_COMMAND',
    commandType: move.commandType,
    actionId: move.actionId,
    choiceId: move.actionId,
    regionId: move.regionId,
    facilityId: move.toFacilityId,
    payload: JSON.stringify(move.payload ?? {}),
    requiredState: `at ${move.fromFacilityId}`,
    resultingState: `facilityId=${move.toFacilityId}`,
    implementationSource: move.source,
    status: 'RESOLVED_EXISTING',
    notes: 'deterministic MOVE_LOCAL inserted before the mapped v2 row',
    ...boundaryFields(previousLedger),
  };
}

function addValidationRows(rows, section, value) {
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (Array.isArray(entry) || (entry && typeof entry === 'object')) continue;
    rows.push({ section, key, value: entry ?? '', detail: '' });
  }
}

function validationSheetRows(validation, compilerSummary) {
  const rows = [];
  addValidationRows(rows, 'source', {
    compilerVersion: validation.compilerVersion,
    validatorVersion: validation.validatorVersion,
    sourceSpreadsheetId: validation.sourceSpreadsheetId,
    sourceSheetName: validation.sourceSheetName,
    sourceRows: validation.sourceRows,
    sourceColumns: validation.sourceColumns,
    sourceHash: validation.sourceHash,
    mappingHash: validation.mappingHash,
    result: validation.result,
    errorCount: validation.errorCount,
    expandedV3Rows: compilerSummary.expandedV3Rows,
    moveLocalRows: compilerSummary.proposedMoveLocalInsertions,
    regionalMoveRows: compilerSummary.regionalMoveRows,
  });
  addValidationRows(rows, 'checks', validation.checks);
  addValidationRows(rows, 'economy', validation.economy);
  addValidationRows(rows, 'progression', validation.progression);
  addValidationRows(rows, 'survival', validation.survival);
  addValidationRows(rows, 'equipment', {
    finalOwned: JSON.stringify(validation.equipment.finalOwned),
    finalEquipped: JSON.stringify(validation.equipment.finalEquipped),
  });
  addValidationRows(rows, 'world', {
    npcResolvedIncidentCount: validation.world.npcResolvedIncidentCount,
    publicNpcFactCount: validation.world.publicNpcFactCount,
    publicNpcGoalCount: validation.world.publicNpcGoalCount,
    trackedNpcLocationCount: validation.world.trackedNpcLocationCount,
    worldFlagCount: validation.world.worldFlagCount,
  });
  for (const [troubleId, status] of Object.entries(validation.world.incidentStates)) {
    rows.push({ section: 'incident', key: troubleId, value: status, detail: '' });
  }
  for (const transition of validation.progression.experienceTransitions ?? []) {
    rows.push({
      section: 'experience',
      key: transition.rowId,
      value: transition.gain,
      detail: JSON.stringify(transition),
    });
  }
  for (const transition of validation.equipment.transitions ?? []) {
    rows.push({
      section: 'equipmentTransition',
      key: transition.rowId,
      value: transition.type,
      detail: JSON.stringify(transition),
    });
  }
  for (const transition of validation.progression.skillTransitions ?? []) {
    rows.push({
      section: 'skillTransition',
      key: transition.rowId,
      value: transition.skillId,
      detail: JSON.stringify(transition),
    });
  }
  return rows;
}

export function buildSheetArtifacts({
  mappingPath = DEFAULTS.mappingPath,
  movesPath = DEFAULTS.movesPath,
  ledgerPath = DEFAULTS.ledgerPath,
  validationPath = DEFAULTS.validationPath,
  compilerSummaryPath = DEFAULTS.compilerSummaryPath,
  outDir = DEFAULTS.outDir,
} = {}) {
  const mappingText = fs.readFileSync(mappingPath, 'utf8');
  const movesText = fs.readFileSync(movesPath, 'utf8');
  const ledgerText = fs.readFileSync(ledgerPath, 'utf8');
  const validationText = fs.readFileSync(validationPath, 'utf8');
  const compilerSummaryText = fs.readFileSync(compilerSummaryPath, 'utf8');
  const mappings = rowsFromCsv(mappingText);
  const movesArtifact = JSON.parse(movesText);
  const legacyLedger = rowsFromCsv(ledgerText);
  const validation = JSON.parse(validationText);
  const compilerSummary = JSON.parse(compilerSummaryText);

  if (mappings.length !== 831 || legacyLedger.length !== 831) throw new Error('expected 831 mapping and ledger rows');
  if (validation.result !== 'PASS') throw new Error(`static validation is ${validation.result}`);
  if (validation.sourceHash !== compilerSummary.sourceHash || validation.sourceHash !== movesArtifact.sourceHash) {
    throw new Error('source hash mismatch across compiler artifacts');
  }
  if (validation.mappingHash !== sha256(mappingText)) throw new Error('mapping hash mismatch');

  const movesByRow = new Map();
  for (const move of movesArtifact.moves ?? []) {
    if (!movesByRow.has(move.beforeLegacyRowId)) movesByRow.set(move.beforeLegacyRowId, []);
    movesByRow.get(move.beforeLegacyRowId).push(move);
  }
  const ledgerByRow = new Map(legacyLedger.map((row) => [row.legacyRowId, row]));
  const v3Rows = [];
  const correspondence = [];
  let sequence = 0;
  let previousLedger = null;

  for (const mapping of mappings) {
    const rowIds = [];
    const actionIds = [];
    for (const move of movesByRow.get(mapping.legacyRowId) ?? []) {
      sequence += 1;
      const row = moveRow(mapping, move, sequence, previousLedger);
      v3Rows.push(row);
      rowIds.push(row.v3RowId);
      actionIds.push(row.actionId);
    }
    const expanded = replacementSteps(mapping);
    expanded.forEach((step, index) => {
      sequence += 1;
      const row = normalizeStep(
        mapping,
        step,
        sequence,
        index === expanded.length - 1 ? 'AFTER_SOURCE_ROW' : 'WITHIN_SOURCE_ROW',
        ledgerByRow.get(mapping.legacyRowId),
      );
      v3Rows.push(row);
      rowIds.push(row.v3RowId);
      if (row.actionId) actionIds.push(row.actionId);
    });
    correspondence.push({
      sourceV2RowIndex: mapping.legacyRowIndex,
      sourceV2RowId: mapping.legacyRowId,
      day: mapping.legacyDay,
      sourceTime: mapping.legacyTime,
      sourceDescription: mapping.legacyDescription,
      legacyRuntimeAction: mapping.legacyRuntimeAction,
      legacyRegion: mapping.legacyRegion,
      classification: mapping.classification,
      resolutionMethod: mapping.resolutionMethod,
      status: mapping.status,
      v3RowCount: rowIds.length,
      v3RowIds: rowIds.join('|'),
      v3ActionIds: actionIds.join('|'),
      requiredState: mapping.requiredState,
      resultingState: mapping.resultingState,
      implementationSource: mapping.implementationSource,
      notes: mapping.notes,
    });
    previousLedger = ledgerByRow.get(mapping.legacyRowId);
  }

  if (v3Rows.length !== compilerSummary.expandedV3Rows) {
    throw new Error(`expanded rows ${v3Rows.length} != ${compilerSummary.expandedV3Rows}`);
  }
  if (correspondence.some((row) => row.v3RowCount < 1 || !row.v3RowIds)) {
    throw new Error('every v2 row must map to at least one v3 row');
  }

  const validationRows = validationSheetRows(validation, compilerSummary);
  const outputs = {
    ledger: toCsv(v3Rows, V3_COLUMNS),
    mapping: toCsv(correspondence, MAP_COLUMNS),
    validation: toCsv(validationRows, ['section', 'key', 'value', 'detail']),
  };
  const manifest = {
    exporterVersion: 'virtue-route-v3-sheet-export-v1',
    generatedAt: compilerSummary.sourceFetchedAt,
    sourceSpreadsheetId: compilerSummary.sourceSpreadsheetId,
    sourceSheetName: compilerSummary.sourceSheetName,
    sourceRows: compilerSummary.sourceRowCount,
    sourceColumns: compilerSummary.sourceColumnCount,
    sourceHashAlgorithm: compilerSummary.sourceHashAlgorithm,
    sourceHash: compilerSummary.sourceHash,
    compilerVersion: compilerSummary.compilerVersion,
    validatorVersion: validation.validatorVersion,
    validationResult: validation.result,
    mappingHash: validation.mappingHash,
    destinationSpreadsheetId: compilerSummary.sourceSpreadsheetId,
    sheets: {
      '正規台帳_v3': { rows: v3Rows.length, columns: V3_COLUMNS.length, sha256: sha256(outputs.ledger) },
      'v2_v3対応表': { rows: correspondence.length, columns: MAP_COLUMNS.length, sha256: sha256(outputs.mapping) },
      '静的検証_v3': { rows: validationRows.length, columns: 4, sha256: sha256(outputs.validation) },
    },
    moveLocalRows: movesArtifact.moves.length,
    regionalMoveRows: compilerSummary.regionalMoveRows,
    unmapped: validation.checks.unmapped,
    unknown: validation.checks.unknown,
    todo: validation.checks.todo,
    partial: validation.checks.partial,
    replayExecuted: false,
    combatExecuted: false,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, SHEET_EXPORT_FILES.ledger), outputs.ledger);
  fs.writeFileSync(path.join(outDir, SHEET_EXPORT_FILES.mapping), outputs.mapping);
  fs.writeFileSync(path.join(outDir, SHEET_EXPORT_FILES.validation), outputs.validation);
  fs.writeFileSync(path.join(outDir, SHEET_EXPORT_FILES.manifest), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [outDir] = process.argv.slice(2);
  const manifest = buildSheetArtifacts({ outDir: outDir ? path.resolve(outDir) : DEFAULTS.outDir });
  console.log(JSON.stringify(manifest, null, 2));
}
