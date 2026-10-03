#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');

export const DAY2_NATURAL_BREAKFAST_REALIGNMENT_VERSION = 'virtue-route-v3-day2-natural-breakfast-v3';

const DAY2_BAKERY_EVENING_OLD_ACTION = 'DAILY_LIFE:DAILY_BAKERY_EVENING:mend_gear_by_oven';
const DAY2_BAKERY_EVENING_ACTION = 'DAILY_LIFE:DAILY_BAKERY_EVENING:help_close_the_bakery';
const DAY2_OVERNIGHT_SLEEP_ACTION = 'LIFE:SLEEP:ITM001';

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
  return row?.replacementSteps ? JSON.parse(row.replacementSteps) : [];
}

function expandedRowCount(rows, moves) {
  return rows.reduce((total, row) => total + Math.max(1, parsedSteps(row).length), 0) + moves.length;
}

function choose(actionId, facilityId) {
  return {
    actionId,
    commandType: 'CHOOSE',
    payload: { choiceId: actionId, actionId },
    regionId: '田園の村',
    facilityId,
  };
}

function move(facilityId) {
  const actionId = `MOVE_LOCAL:${facilityId}`;
  return {
    actionId,
    commandType: 'MOVE',
    payload: { moveId: actionId },
    regionId: '田園の村',
    facilityId,
  };
}

function executableActionIds(row) {
  const steps = parsedSteps(row);
  return steps.length ? steps.map((step) => step.actionId) : [row.actionId].filter(Boolean);
}

export function applyDay2NaturalBreakfastRealignment({ outDir = DEFAULT_OUT } = {}) {
  const mappingPath = path.join(outDir, 'virtue-route-v3-mapping.csv');
  const movesPath = path.join(outDir, 'virtue-route-v3-proposed-local-moves.json');
  const summaryPath = path.join(outDir, 'virtue-route-v3-static-summary.json');
  const { headers, rows } = objects(fs.readFileSync(mappingPath, 'utf8'));
  const movesArtifact = JSON.parse(fs.readFileSync(movesPath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const moves = Array.isArray(movesArtifact.moves) ? movesArtifact.moves : [];

  const countedBefore = expandedRowCount(rows, moves);
  if (Number(summary.expandedV3Rows) !== countedBefore) {
    throw new Error(`Day2 breakfast input accounting mismatch: summary=${summary.expandedV3Rows}, counted=${countedBefore}`);
  }
  if (!summary.noFreeProvisionEatRealignmentVersion) {
    throw new Error('Day2 breakfast realignment must run after no-free-provision-eat realignment');
  }

  const row = rows.find((entry) => entry.legacyRowId === 'VR2-D02-01');
  if (!row) throw new Error('VR2-D02-01 missing');
  const previous = parsedSteps(row);
  if (previous.map((step) => step.actionId).join('|') !== 'LIFE:BUY:ITM008') {
    throw new Error(`VR2-D02-01 expected post-retirement BUY-only sequence, got ${previous.map((step) => step.actionId).join('|')}`);
  }

  const compilerMoves = moves.filter((entry) => entry.beforeLegacyRowId === 'VR2-D02-01');
  if (compilerMoves.length !== 1 || compilerMoves[0].actionId !== 'MOVE_LOCAL:LOC_FARM_BAKERY') {
    throw new Error(`VR2-D02-01 expected one stale Inn→Bakery compiler move, got ${compilerMoves.map((entry) => entry.actionId).join('|')}`);
  }
  moves.splice(moves.indexOf(compilerMoves[0]), 1);

  const steps = [
    choose('LIFE:EAT:ITM003', 'LOC_FARM_INN'),
    move('LOC_FARM_BAKERY'),
  ];
  Object.assign(row, {
    legacyDescription: 'Day2朝、麦穂亭で麦粥を食べてからパン屋へ歩き、現地の行商人へ会いに行く',
    classification: 'PLAYER_COMMAND_SEQUENCE',
    commandType: 'SEQUENCE',
    actionId: steps.at(-1).actionId,
    choiceId: '',
    payload: JSON.stringify({ steps }),
    replacementSteps: JSON.stringify(steps),
    replacementRowIds: steps.map((_, index) => `${row.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|'),
    resolutionMethod: 'DAY2_NATURAL_BREAKFAST_REALIGNMENT',
    regionId: '田園の村',
    facilityId: 'LOC_FARM_BAKERY',
    productId: 'ITM003',
    requiredState: 'Day2 after Mira shelter; player wakes at LOC_FARM_INN with a normal facility breakfast available; no generic inventory-food action is required',
    resultingState: 'explicit inn breakfast satisfies hunger and records a real meal; ordinary MOVE_LOCAL then reaches LOC_FARM_BAKERY where the Day2 merchant scene may begin through co-located production authority',
    implementationSource: 'src/server/trpg/content/canonical-world-life-actions.js canonical-world-life-v3 + authored-mission-flow-day1-t01-village-night-canonical.js',
    status: 'RESOLVED_EXISTING',
    unresolvedReason: '',
    notes: 'removes the compiler-forced pre-breakfast move and the obsolete buy-then-immediately-eat black-bread sequence. Breakfast happens at the inn; the player then physically walks to the bakery. Provision purchase is left to a later meaningful shopping decision.',
  });

  const eveningRow = rows.find((entry) => entry.legacyRowId === 'VR2-D02-08');
  if (!eveningRow) throw new Error('VR2-D02-08 missing');
  const previousEvening = executableActionIds(eveningRow);
  if (previousEvening.join('|') !== DAY2_BAKERY_EVENING_OLD_ACTION) {
    throw new Error(`VR2-D02-08 expected old bakery-evening branch ${DAY2_BAKERY_EVENING_OLD_ACTION}, got ${previousEvening.join('|')}`);
  }
  const eveningAction = choose(DAY2_BAKERY_EVENING_ACTION, 'LOC_FARM_BAKERY');
  Object.assign(eveningRow, {
    legacyDescription: 'Day2の午後、パン屋の閉店準備を手伝いながら普通の夕方を過ごす',
    classification: 'PLAYER_COMMAND',
    commandType: 'CHOOSE',
    actionId: DAY2_BAKERY_EVENING_ACTION,
    choiceId: DAY2_BAKERY_EVENING_ACTION,
    payload: JSON.stringify(eveningAction.payload),
    replacementSteps: JSON.stringify([eveningAction]),
    replacementRowIds: `${eveningRow.legacyRowId}:PLAYER_COMMAND`,
    resolutionMethod: 'DAY2_NATURAL_BREAKFAST_REALIGNMENT',
    regionId: '田園の村',
    facilityId: 'LOC_FARM_BAKERY',
    requiredState: 'Day2 afternoon at LOC_FARM_BAKERY; common bakery-evening scene is visible beside ordinary public products; no higher-priority incident owns the panel',
    resultingState: 'the player helps close the bakery as an ordinary common-world activity and remains in the real village timeline through the evening without synthetic WAIT or long REST padding',
    implementationSource: 'src/server/trpg/content/authored-village-bakery-evening.js + canonical public-life choice policy',
    status: 'RESOLVED_EXISTING',
    unresolvedReason: '',
    notes: 'the reviewed old branch mended gear, but current production choice selection exposes the equally route-neutral closing-help branch. The clarification does not canonize the old exact choice, so strict replay follows the actually visible ordinary-life branch without hidden state or reconvergence.',
  });

  const overnightRow = rows.find((entry) => entry.legacyRowId === 'VR2-D02-09');
  if (!overnightRow) throw new Error('VR2-D02-09 missing');
  const previousOvernight = executableActionIds(overnightRow);
  if (previousOvernight.join('|') !== DAY2_OVERNIGHT_SLEEP_ACTION) {
    throw new Error(`VR2-D02-09 expected ${DAY2_OVERNIGHT_SLEEP_ACTION}, got ${previousOvernight.join('|')}`);
  }
  const overnightSteps = [
    choose('LIFE:EAT:ITM003', 'LOC_FARM_INN'),
    choose(DAY2_OVERNIGHT_SLEEP_ACTION, 'LOC_FARM_INN'),
  ];
  Object.assign(overnightRow, {
    legacyDescription: 'Day2の閉店後、麦穂亭で温かい麦粥を食べてから素泊まりで眠る',
    classification: 'PLAYER_COMMAND_SEQUENCE',
    commandType: 'SEQUENCE',
    actionId: DAY2_OVERNIGHT_SLEEP_ACTION,
    choiceId: '',
    payload: JSON.stringify({ steps: overnightSteps }),
    replacementSteps: JSON.stringify(overnightSteps),
    replacementRowIds: overnightSteps.map((_, index) => `${overnightRow.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|'),
    resolutionMethod: 'DAY2_NATURAL_BREAKFAST_REALIGNMENT',
    regionId: '田園の村',
    facilityId: 'LOC_FARM_INN',
    productId: 'ITM001',
    requiredState: 'Day2 after the long bakery closing block; player has physically returned to LOC_FARM_INN with high hunger and enough gold for a facility meal before lodging',
    resultingState: 'the explicit inn meal resolves urgent hunger through production meal authority; only then does the player take the normal eight-hour ITM001 lodging action',
    implementationSource: 'src/server/trpg/content/canonical-world-life-actions.js + canonical public-life choice policy',
    status: 'RESOLVED_EXISTING',
    unresolvedReason: '',
    notes: 'strict production correctly refuses to prioritize sleep while hunger is urgent. The route therefore eats a real facility meal before bed instead of bypassing needs, injecting recovery, or consuming the carried black bread generically.',
  });

  movesArtifact.day2NaturalBreakfastRealignmentVersion = DAY2_NATURAL_BREAKFAST_REALIGNMENT_VERSION;
  movesArtifact.day2NaturalBreakfastRemovedMoveBeforeRows = ['VR2-D02-01'];
  movesArtifact.count = moves.length;

  summary.day2NaturalBreakfastRealignmentVersion = DAY2_NATURAL_BREAKFAST_REALIGNMENT_VERSION;
  summary.day2NaturalBreakfastRealignedLegacyRows = ['VR2-D02-01', 'VR2-D02-08', 'VR2-D02-09'];
  summary.day2BakeryEveningAction = DAY2_BAKERY_EVENING_ACTION;
  summary.day2OvernightMealAction = 'LIFE:EAT:ITM003';
  summary.proposedMoveLocalInsertions = moves.length;
  summary.expandedV3Rows = expandedRowCount(rows, moves);

  fs.writeFileSync(mappingPath, csv(rows, headers));
  fs.writeFileSync(movesPath, `${JSON.stringify(movesArtifact, null, 2)}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  return {
    version: DAY2_NATURAL_BREAKFAST_REALIGNMENT_VERSION,
    expandedV3Rows: summary.expandedV3Rows,
    moves: moves.length,
    actions: [
      ...steps.map((step) => step.actionId),
      DAY2_BAKERY_EVENING_ACTION,
      ...overnightSteps.map((step) => step.actionId),
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyDay2NaturalBreakfastRealignment(), null, 2));
}
