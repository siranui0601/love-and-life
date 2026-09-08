#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { csvCell, parseCsv } from './export-virtue-route-v2-source.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');

export const F_REGISTER_CALLBACK_REALIGNMENT_VERSION = 'virtue-route-v3-f-register-callback-v1';
const SOURCE_ROW_ID = 'VR2-D02-05';
const CALLBACK_ACTION_ID = 'MISSION_FLOW:F:REGISTER_CALLBACK:ask';

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

export function applyFRegisterCallbackRealignment({ outDir = DEFAULT_OUT } = {}) {
  const mappingPath = path.join(outDir, 'virtue-route-v3-mapping.csv');
  const { headers, rows } = objects(fs.readFileSync(mappingPath, 'utf8'));
  const row = rows.find((entry) => entry.legacyRowId === SOURCE_ROW_ID);
  if (!row) throw new Error(`${SOURCE_ROW_ID} missing from Human Virtue mapping`);
  if (row.commandType !== 'OUTCOME' || row.classification !== 'NARRATIVE_OUTCOME') {
    throw new Error(`${SOURCE_ROW_ID} must be the retired Day2 midday-shift OUTCOME before F callback realignment; got ${row.classification}/${row.commandType}/${row.actionId}`);
  }

  Object.assign(row, {
    legacyDescription: 'Day2の見回り後、宿帳とフィン救助の照合が村内の実会話でリオナへ伝わり、広場で呼び止められたため「何の話？」と尋ねる',
    classification: 'PLAYER_COMMAND',
    commandType: 'CHOOSE',
    actionId: CALLBACK_ACTION_ID,
    choiceId: CALLBACK_ACTION_ID,
    payload: JSON.stringify({ choiceId: CALLBACK_ACTION_ID, actionId: CALLBACK_ACTION_ID }),
    replacementRowIds: '',
    replacementSteps: '',
    resolutionMethod: 'F_REGISTER_CALLBACK_REALIGNMENT',
    facilityId: 'LOC_FARM_SQUARE',
    jobId: '',
    productId: '',
    equipmentId: '',
    materialId: '',
    skillId: '',
    requiredState: 'T01 resolved; canonical inn-register record exists; Rona has correlated the registered guest with Finn rescue; Rona physically met Riona and the common NPC conversation engine created the Rona→Riona share; Riona completed the existing square verification GOAP; player is at LOC_FARM_SQUARE',
    resultingState: 'the production REGISTER callback is answered exactly once; no route score/flag, teleport, hidden knowledge injection, wage, item, or resource mutation is fabricated; ordinary Day2 village life can resume immediately afterward',
    implementationSource: 'src/server/trpg/content/authored-register-butterfly.js + authored-register-butterfly-relay.js + tools/trpg-sim/lib/npc-life-engine.mjs',
    status: 'RESOLVED_EXISTING',
    unresolvedReason: '',
    notes: 'The retired impossible midday JOB-FARM-03 row is reused for a newly-live Checkpoint F causal callback. `ask` is one of the same three production-visible callback branches and is selected as the straight conversational response; the old exact action schedule is not canonical.',
  });

  fs.writeFileSync(mappingPath, csv(rows, headers));
  console.log(JSON.stringify({
    version: F_REGISTER_CALLBACK_REALIGNMENT_VERSION,
    sourceRowId: SOURCE_ROW_ID,
    actionId: CALLBACK_ACTION_ID,
    rowCount: rows.length,
  }, null, 2));
  return { rows, row };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyFRegisterCallbackRealignment();
}
