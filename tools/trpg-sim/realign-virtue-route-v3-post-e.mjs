#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');

export const POST_E_REALIGNMENT_VERSION = 'virtue-route-v3-post-e-realignment-v8';

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
    if (step.actionId === 'MISSION_FLOW:T01:HUMAN_ENTRY:RETURN_FINN_TO_SQUARE') {
      return move('LOC_FARM_SQUARE', { regionId: '田園の村' });
    }
    const square = step.actionId === 'ACTION:MSN-T01:decide';
    return {
      ...step,
      regionId: '田園の村',
      facilityId: square ? 'LOC_FARM_SQUARE' : 'LOC_FARM_EDGE',
    };
  });
  const expectedT01Actions = [
    'ACTION:MSN-T01:search:tracks',
    'ACTION:MSN-T01:search:wolf-blockade',
    'ACTION:MSN-T01:rescue',
    'ACTION:MSN-T01:escort',
    'MOVE_LOCAL:LOC_FARM_SQUARE',
    'ACTION:MSN-T01:decide',
  ];
  if (t01Steps.length !== 6) throw new Error(`expected six preserved T01 steps, got ${t01Steps.length}`);
  if (JSON.stringify(t01Steps.map((step) => step.actionId)) !== JSON.stringify(expectedT01Actions)) {
    throw new Error(`unexpected post-E T01 action sequence: ${t01Steps.map((step) => step.actionId).join(' -> ')}`);
  }
  if (t01Steps[4].commandType !== 'MOVE' || t01Steps[4].payload?.moveId !== 'MOVE_LOCAL:LOC_FARM_SQUARE') {
    throw new Error('Finn return must use ordinary production MOVE_LOCAL authority');
  }
  t01.replacementSteps = JSON.stringify(t01Steps);
  t01.payload = JSON.stringify({ steps: t01Steps });
  t01.requiredState = 'MSN-T01 active; hearing complete; at LOC_FARM_EDGE; Finn alive; any legal Checkpoint E loadout including shield-only; no required starter skill';
  t01.resultingState = 'two search clues; actual MON-0005 battle; Finn rescued, escorted and returned through ordinary MOVE_LOCAL to LOC_FARM_SQUARE; MSN-T01 resolved';
  t01.notes = 'existing public T01 search/rescue chain preserved after the post-E bridge; Finn return uses common production MOVE_LOCAL rather than the obsolete Human Virtue-only return action';

  const aftercare = requireRow(byId, 'VR2-D01-07');
  aftercare.legacyDescription = '広場でミラへ引き渡し。Checkpoint Eで選んだ借用loadoutは返却条件を保持したまま継続';
  aftercare.requiredState = 'MSN-T01 resolved; Finn returned alive; Day1 before midnight; at LOC_FARM_SQUARE; player-selected Checkpoint E loan state preserved';
  aftercare.resultingState = 'Mira aftercare completed; bread shared with Finn; Day1 evening free-time scene available; no fixed starter equipment premise';
  aftercare.notes = 'replaces the obsolete fixed farm-machete/padded-clothes premise while preserving the existing aftercare and supper actions';

  const eveningActionId = 'MISSION_FLOW:T01:EVENING_FREE_TIME:maintain_and_rest';
  sequence(requireRow(byId, 'VR2-D01-09'), [
    choose(eveningActionId, { regionId: '田園の村', facilityId: 'LOC_FARM_SQUARE' }),
  ], {
    description: '救出後の自由時間。装備を手入れし、身体を休めながら22:30まで村の夕方を過ごす',
    facilityId: 'LOC_FARM_SQUARE',
    requiredState: 'T01 aftercare and shared-bread supper complete; Day1 in 田園の村 before 22:30; production evening free-time scene visible',
    resultingState: 'production evening free-time branch consumed; equipment maintained and player rested; canonical wall clock advances naturally to 22:30 without filler WAIT loops',
    implementationSource: 'src/server/trpg/content/authored-mission-flow-day1-t01-village-night.js authored-day1-t01-village-night-v3',
    notes: 'replaces the obsolete synthetic LIFE:REST:270 row with the visible production evening scene that represents the same authored free-time/equipment-maintenance/rest block',
  });

  const day2Breakfast = requireRow(byId, 'VR2-D02-01');
  const day2BreakfastSteps = JSON.parse(day2Breakfast.replacementSteps || '[]');
  const expectedBreakfastActions = ['LIFE:BUY:ITM008', 'LIFE:EAT:ITM008'];
  if (JSON.stringify(day2BreakfastSteps.map((step) => step.actionId)) !== JSON.stringify(expectedBreakfastActions)) {
    throw new Error(`unexpected Day2 breakfast sequence before post-E bridge: ${day2BreakfastSteps.map((step) => step.actionId).join(' -> ')}`);
  }
  day2BreakfastSteps.forEach((step) => {
    step.regionId = '田園の村';
    step.facilityId = 'LOC_FARM_BAKERY';
  });
  day2Breakfast.legacyDescription = 'Day2朝食としてパン屋で黒パンITM008を購入・摂取し、その場に実在する行商人リオナとの朝の仕事へ接続する';
  day2Breakfast.classification = 'PLAYER_COMMAND_SEQUENCE';
  day2Breakfast.replacementRowIds = day2BreakfastSteps.map((_, index) => `${day2Breakfast.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|');
  day2Breakfast.replacementSteps = JSON.stringify(day2BreakfastSteps);
  day2Breakfast.resolutionMethod = 'POST_E_REALIGNMENT';
  day2Breakfast.commandType = 'SEQUENCE';
  day2Breakfast.choiceId = '';
  day2Breakfast.actionId = 'LIFE:EAT:ITM008';
  day2Breakfast.payload = JSON.stringify({ steps: day2BreakfastSteps });
  day2Breakfast.facilityId = 'LOC_FARM_BAKERY';
  day2Breakfast.requiredState = 'Day2 after Mira shelter; at LOC_FARM_BAKERY; gold>=1; canonical ITM008 stock available';
  day2Breakfast.resultingState = 'gold-=1; ITM008 purchased and consumed through canonical world-life authority; hunger recovered; player remains at LOC_FARM_BAKERY where NPC008 is present through ordinary world simulation';
  day2Breakfast.implementationSource = 'src/server/trpg/content/canonical-world-life-actions.js + src/server/trpg/content/authored-mission-flow-day1-t01-village-night-canonical.js';
  day2Breakfast.status = 'RESOLVED_EXISTING';
  day2Breakfast.unresolvedReason = '';
  day2Breakfast.notes = 'removes the stale return-to-inn move; breakfast-before-work is preserved and the next authored merchant contact happens locally at NPC008 live position';

  const merchantChain = requireRow(byId, 'VR2-D02-02');
  const merchantSteps = JSON.parse(merchantChain.replacementSteps || '[]');
  const expectedMerchantActions = [
    'MISSION_FLOW:T01:DAY2_MERCHANT:help_unload',
    'MISSION_FLOW:T01:DAY2_MERCHANT_PAYMENT:take_three_gold',
    'MISSION_FLOW:T01:DAY2_MERCHANT_STALL:take_hunter_parcel',
    'MISSION_FLOW:T01:DAY2_MERCHANT_FOLLOWUP:t01-day2-hunter-parcel:leave_for_hut',
    'MISSION_FLOW:T01:DAY2_HUNTER_HUT:repair_snare',
    'MISSION_FLOW:T01:DAY2_HUNTER_LUNCH:send_warning',
  ];
  if (JSON.stringify(merchantSteps.map((step) => step.actionId)) !== JSON.stringify(expectedMerchantActions)) {
    throw new Error(`unexpected preserved Day2 merchant chain: ${merchantSteps.map((step) => step.actionId).join(' -> ')}`);
  }
  merchantSteps[0] = {
    ...merchantSteps[0],
    regionId: '田園の村',
    facilityId: 'LOC_FARM_BAKERY',
  };
  merchantChain.replacementSteps = JSON.stringify(merchantSteps);
  merchantChain.payload = JSON.stringify({ steps: merchantSteps });
  merchantChain.requiredState = 'Day2 breakfast consumed at LOC_FARM_BAKERY; NPC008 physically present through ordinary world simulation; merchant morning scene visible';
  merchantChain.resultingState = 'merchant unloading, payment, parcel handoff, hunter-hut delivery/repair and warning chain resolved through the existing production actions';
  merchantChain.notes = 'preserves all six authored Day2 merchant/hunter commands; only the initial NPC008 contact facility is realigned from stale inn placement to the live bakery route';

  const originalMoves = Array.isArray(movesArtifact.moves) ? movesArtifact.moves : [];
  const obsoleteBeforeRows = new Set(['VR2-D01-03', 'VR2-D01-10']);
  const removedMoves = originalMoves.filter((entry) => obsoleteBeforeRows.has(entry.beforeLegacyRowId));
  const moves = originalMoves.filter((entry) => !obsoleteBeforeRows.has(entry.beforeLegacyRowId));
  if (removedMoves.length !== 2
    || !obsoleteBeforeRows.size
    || ![...obsoleteBeforeRows].every((id) => removedMoves.some((entry) => entry.beforeLegacyRowId === id))) {
    throw new Error(`expected obsolete pre-D01-03 and pre-D01-10 moves exactly once each; removed ${removedMoves.map((entry) => entry.beforeLegacyRowId).join(', ')}`);
  }
  movesArtifact.moves = moves;
  movesArtifact.count = moves.length;
  movesArtifact.postERealignmentVersion = POST_E_REALIGNMENT_VERSION;

  summary.proposedMoveLocalInsertions = moves.length;
  summary.expandedV3Rows = rows.reduce((total, row) => total + Math.max(1, stepCount(row)), 0) + moves.length;
  summary.postERealignmentVersion = POST_E_REALIGNMENT_VERSION;
  summary.postERealignedLegacyRows = ['VR2-D01-01', 'VR2-D01-02', 'VR2-D01-03', 'VR2-D01-04', 'VR2-D01-05', 'VR2-D01-07', 'VR2-D01-09', 'VR2-D02-01', 'VR2-D02-02'];
  summary.postEStaleStarterDependencies = 0;
  summary.postECanonicalEntryActions = entrySteps.map((step) => step.actionId);
  summary.postET01Actions = [...expectedT01Actions];
  summary.postEDay1EveningAction = eveningActionId;
  summary.postEDay2BreakfastActions = day2BreakfastSteps.map((step) => step.actionId);
  summary.postEDay2MerchantActions = merchantSteps.map((step) => step.actionId);

  if (summary.expandedV3Rows !== 1525) {
    throw new Error(`post-E realignment must remove exactly one stale Day2 move and produce 1525 expanded rows, got ${summary.expandedV3Rows}`);
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
    t01ActionIds: [...summary.postET01Actions],
    day1EveningActionId: summary.postEDay1EveningAction,
    day2BreakfastActionIds: [...summary.postEDay2BreakfastActions],
    day2MerchantActionIds: [...summary.postEDay2MerchantActions],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
  console.log(JSON.stringify(realignPostEArtifacts({ outDir }), null, 2));
}
