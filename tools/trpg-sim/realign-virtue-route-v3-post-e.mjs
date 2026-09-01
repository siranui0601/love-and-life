#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');

export const POST_E_REALIGNMENT_VERSION = 'virtue-route-v3-post-e-realignment-v3';

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
    facilityId,
    ...extra,
  };
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
    resolutionMethod: 'POST_E_REALIGNMENT',
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

function sequence(row, steps, {
  description,
  facilityId,
  requiredState,
  resultingState,
  implementationSource,
  notes,
}) {
  Object.assign(row, {
    legacyDescription: description,
    classification: 'PLAYER_COMMAND_SEQUENCE',
    replacementRowIds: steps.map((_, index) => `${row.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|'),
    replacementSteps: JSON.stringify(steps),
    resolutionMethod: 'POST_E_REALIGNMENT',
    commandType: 'SEQUENCE',
    choiceId: '',
    actionId: steps.at(-1).actionId,
    payload: JSON.stringify({ steps }),
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

function stepCount(row) {
  if (row.replacementSteps) return JSON.parse(row.replacementSteps).length;
  return 1;
}

function requireRow(byId, id) {
  const row = byId.get(id);
  if (!row) throw new Error(`post-E realignment row missing: ${id}`);
  return row;
}

export function realignPostEArtifacts({ outDir = DEFAULT_OUT } = {}) {
  const mappingPath = path.join(outDir, 'virtue-route-v3-mapping.csv');
  const movesPath = path.join(outDir, 'virtue-route-v3-proposed-local-moves.json');
  const summaryPath = path.join(outDir, 'virtue-route-v3-static-summary.json');
  const { headers, rows } = objects(fs.readFileSync(mappingPath, 'utf8'));
  const byId = new Map(rows.map((row) => [row.legacyRowId, row]));
  const movesArtifact = JSON.parse(fs.readFileSync(movesPath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

  outcome(requireRow(byId, 'VR2-D01-01'), {
    description: 'Checkpoint Eで黒パンITM008を食べた状態を引き継ぐ（追加のstarter mealなし）',
    requiredState: 'Checkpoint E bread/eat sequence already resolved with canonical ITM008; no legacy starter meal credit dependency',
    resultingState: 'no additional meal consumed; hunger and gold carry from the production Checkpoint E runtime',
    implementationSource: 'src/server/trpg/game/checkpoint-e-prologue-service.js CHECKPOINT_E_BREAD_ITEM_ID + eatBread',
    notes: 'replaces the obsolete pre-E starter-meal opening assumption; Human Virtue starts from the Checkpoint E production state',
  });

  outcome(requireRow(byId, 'VR2-D01-02'), {
    description: 'Checkpoint Eで選んだ借用loadout・SP状態を引き継ぐ（固定スキル取得なし）',
    requiredState: 'Checkpoint E equipment and skill panels inspected; one legal player-selected loadout may be borrowed',
    resultingState: 'no skill is forced; learnedSkills/SP and equipped loadout remain the player-selected production state',
    implementationSource: 'src/server/trpg/game/checkpoint-e-prologue-service.js buildCheckpointELoanCatalog + production skill UI',
    notes: 'removes the obsolete fixed starter-skill dependency; shield-only and every other legal Checkpoint E loadout remain valid',
  });

  const entrySteps = [
    choose('E:LODGE:REGISTER', { regionId: '田園の村', facilityId: 'LOC_FARM_INN' }),
    choose('DISCOVER_LOCAL_TROUBLE:T01', { regionId: '田園の村', facilityId: 'LOC_FARM_INN' }),
    move('LOC_FARM_SQUARE', { regionId: '田園の村' }),
    choose('ACTION:MSN-T01:hear', { regionId: '田園の村', facilityId: 'LOC_FARM_SQUARE' }),
    move('LOC_FARM_EDGE', { regionId: '田園の村' }),
  ];
  sequence(requireRow(byId, 'VR2-D01-03'), entrySteps, {
    description: 'Checkpoint Eの宿泊選択でREGISTERを選び、T01を知って村外れの捜索地点へ向かう',
    facilityId: 'LOC_FARM_EDGE',
    requiredState: 'Checkpoint E at lodging_choice in LOC_FARM_INN; Eda introduced; ITM008 eaten; legal player-selected loan loadout equipped/available',
    resultingState: 'Checkpoint E complete via REGISTER; Wheat Inn guestbook provenance exists; MSN-T01 discovered and heard through production actions; player at LOC_FARM_EDGE',
    implementationSource: 'src/server/trpg/game/checkpoint-e-prologue-service.js + src/server/trpg/game/service.js + tools/trpg-sim/lib/player-journey.mjs',
    notes: 'replaces the wheat-field awakening and legacy tutorial actions with the actual post-E production bridge; visible actionId must equal executed actionId',
  });

  outcome(requireRow(byId, 'VR2-D01-04'), {
    description: 'T01捜索前の状態確認。追加の無料昼食は仮定しない',
    requiredState: 'Checkpoint E ITM008 meal already consumed; MSN-T01 heard; player at LOC_FARM_EDGE; no implicit second free meal',
    resultingState: 'no meal consumed and no gold spent; current production hunger state carries into the T01 search',
    implementationSource: 'src/server/trpg/game/checkpoint-e-prologue-service.js + tools/trpg-sim/lib/player-needs.mjs',
    notes: 'keeps the explicit Day1 trade-off without relying on the obsolete starter-meal credit',
  });

  const t01 = requireRow(byId, 'VR2-D01-05');
  const t01Steps = JSON.parse(t01.replacementSteps || '[]').map((step) => {
    const square = ['MISSION_FLOW:T01:HUMAN_ENTRY:RETURN_FINN_TO_SQUARE', 'ACTION:MSN-T01:decide'].includes(step.actionId);
    return {
      ...step,
      regionId: '田園の村',
      facilityId: square ? 'LOC_FARM_SQUARE' : 'LOC_FARM_EDGE',
    };
  });
  if (t01Steps.length !== 6) throw new Error(`expected six preserved T01 steps, got ${t01Steps.length}`);
  t01.replacementSteps = JSON.stringify(t01Steps);
  t01.payload = JSON.stringify({ steps: t01Steps });
  t01.requiredState = 'MSN-T01 active; hearing complete; at LOC_FARM_EDGE; Finn alive; any legal Checkpoint E loadout including shield-only; no required starter skill';
  t01.resultingState = 'two search clues; actual MON-0005 battle; Finn rescued, escorted and returned to LOC_FARM_SQUARE; MSN-T01 resolved';
  t01.notes = 'existing public T01 search/rescue chain preserved after the post-E bridge; weapon-independent, no fixed starter-skill prerequisite, and per-step facility matches production runtime';

  const aftercare = requireRow(byId, 'VR2-D01-07');
  aftercare.legacyDescription = '広場でミラへ引き渡し。Checkpoint Eで選んだ借用loadoutは返却条件を保持したまま継続';
  aftercare.requiredState = 'MSN-T01 resolved; Finn returned alive; Day1 before midnight; at LOC_FARM_SQUARE; player-selected Checkpoint E loan state preserved';
  aftercare.resultingState = 'Mira aftercare completed; bread shared with Finn; Day1 village-night scene available; no fixed starter equipment premise';
  aftercare.notes = 'replaces the obsolete fixed farm-machete/padded-clothes premise while preserving the existing aftercare and supper actions';

  const originalMoves = Array.isArray(movesArtifact.moves) ? movesArtifact.moves : [];
  const moves = originalMoves.filter((entry) => entry.beforeLegacyRowId !== 'VR2-D01-03');
  if (originalMoves.length - moves.length !== 1) {
    throw new Error(`expected exactly one obsolete pre-D01-03 local move, removed ${originalMoves.length - moves.length}`);
  }
  movesArtifact.moves = moves;
  movesArtifact.count = moves.length;
  movesArtifact.postERealignmentVersion = POST_E_REALIGNMENT_VERSION;

  summary.proposedMoveLocalInsertions = moves.length;
  summary.expandedV3Rows = rows.reduce((total, row) => total + Math.max(1, stepCount(row)), 0) + moves.length;
  summary.postERealignmentVersion = POST_E_REALIGNMENT_VERSION;
  summary.postERealignedLegacyRows = ['VR2-D01-01', 'VR2-D01-02', 'VR2-D01-03', 'VR2-D01-04', 'VR2-D01-05', 'VR2-D01-07'];
  summary.postEStaleStarterDependencies = 0;
  summary.postECanonicalEntryActions = entrySteps.map((step) => step.actionId);

  if (summary.expandedV3Rows !== 1526) {
    throw new Error(`post-E realignment must preserve 1526 expanded rows, got ${summary.expandedV3Rows}`);
  }

  fs.writeFileSync(mappingPath, csv(rows, headers));
  fs.writeFileSync(movesPath, `${JSON.stringify(movesArtifact, null, 2)}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  return {
    version: POST_E_REALIGNMENT_VERSION,
    mappedRows: rows.length,
    expandedV3Rows: summary.expandedV3Rows,
    proposedMoveLocalInsertions: moves.length,
    realignedLegacyRows: [...summary.postERealignedLegacyRows],
    entryActionIds: [...summary.postECanonicalEntryActions],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
  console.log(JSON.stringify(realignPostEArtifacts({ outDir }), null, 2));
}
