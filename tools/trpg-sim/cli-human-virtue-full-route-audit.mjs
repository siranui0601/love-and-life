import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv } from './export-virtue-route-v2-source.mjs';
import {
  buildCheckpointELoanCatalog,
  createCheckpointEPrologueTrpgGameService,
} from '../../src/server/trpg/game/checkpoint-e-prologue-service.js';
import { loadTrpgGameData } from '../../src/server/trpg/game/game-data.js';
import { MemoryTrpgSaveStore } from '../../src/server/trpg/game/save-store.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const REPORTS = path.join(HERE, 'reports');
const LEDGER = path.join(ROOT, 'docs/trpg/virtue-route-v3-sheet-ledger.csv');
const FINAL_DAY = 85;
const BASELINE_LOADOUT = process.env.TRPG_HV_BASELINE_LOADOUT || 'sword-shield';
const SEED = process.env.TRPG_HV_AUDIT_SEED || 'human-virtue-full-route-audit-v1';
const OWNER = `human-virtue-audit:${SEED}`;
const SAVE_CHECKPOINT_DAYS = new Set([2, 20, 50, 80, 85]);

fs.mkdirSync(REPORTS, { recursive: true });

const data = loadTrpgGameData();
const store = new MemoryTrpgSaveStore();
let game = createCheckpointEPrologueTrpgGameService({ data, store, allowCustomSeed: true, maxSavesPerOwner: 4 });
let save = null;
let commandSequence = 0;
const trace = [];
const daySummary = new Map();
const battleLogs = [];
const restoreChecks = [];
const findings = [];

function text(value) { return String(value ?? '').trim(); }
function number(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function parsePayload(value) {
  if (!value) return {};
  try { return JSON.parse(value); } catch { return {}; }
}
function ledgerRows() {
  const matrix = parseCsv(fs.readFileSync(LEDGER, 'utf8'));
  const [headers, ...body] = matrix;
  return body.filter((row) => row.some((cell) => cell !== '')).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}
function equipmentIds(publicSave) {
  return Object.values(publicSave.player?.equipment ?? {}).filter(Boolean).map((item) => item.id ?? item.equipmentId ?? item).filter(Boolean);
}
function inventoryEquipmentIds(publicSave) {
  const values = publicSave.player?.inventory?.equipment ?? [];
  return Array.isArray(values) ? values.map((item) => item.equipmentId ?? item.id).filter(Boolean) : Object.keys(values ?? {});
}
function learnedSkillIds(publicSave) {
  const learned = publicSave.skills?.learned ?? publicSave.player?.skills ?? [];
  if (Array.isArray(learned)) return learned.map((item) => item.id ?? item.skillId ?? item).filter(Boolean);
  return Object.keys(learned ?? {});
}
function hpMp(publicSave) {
  const player = publicSave.battle?.participants?.find?.((entry) => entry.side === 'player')
    ?? publicSave.player?.combat
    ?? publicSave.player?.stats
    ?? {};
  return {
    hp: number(player.hp ?? publicSave.player?.hp),
    maxHp: number(player.maxHp ?? publicSave.player?.maxHp),
    mp: number(player.mp ?? publicSave.player?.mp),
    maxMp: number(player.maxMp ?? publicSave.player?.maxMp),
  };
}
function compact(publicSave) {
  const combat = hpMp(publicSave);
  return {
    revision: publicSave.revision,
    stateHash: publicSave.stateHash ?? null,
    absoluteMinute: publicSave.clock?.absoluteMinute ?? null,
    day: publicSave.clock?.day ?? null,
    time: publicSave.clock?.time ?? null,
    region: publicSave.scene?.location ?? null,
    facilityId: publicSave.scene?.facilityId ?? null,
    gold: number(publicSave.player?.gold, 0),
    hunger: number(publicSave.player?.needs?.hunger),
    fatigue: number(publicSave.player?.needs?.fatigue),
    ...combat,
    equipment: equipmentIds(publicSave),
    inventoryEquipment: inventoryEquipmentIds(publicSave),
    skills: learnedSkillIds(publicSave),
    choices: (publicSave.choices ?? []).map((choice) => ({
      actionId: choice.actionId,
      choiceId: choice.choiceId,
      label: choice.label,
      minutes: number(choice.minutes, 0),
    })),
    movement: (publicSave.movement ?? []).map((move) => ({
      moveId: move.moveId,
      label: move.label,
      destinationFacilityId: move.destinationFacilityId ?? null,
      destination: move.destination ?? null,
      minutes: number(move.minutes, 0),
    })),
    presentNpcs: (publicSave.scene?.presentNpcs ?? []).map((npc) => ({ id: npc.id, name: npc.name, identified: npc.identified })),
    missions: (publicSave.missions ?? []).map((mission) => ({
      id: mission.id,
      troubleId: mission.troubleId ?? null,
      status: mission.status,
      stepId: mission.currentStep?.id ?? null,
      progress: mission.currentStep?.progress ?? null,
      required: mission.currentStep?.required ?? null,
    })),
    battle: publicSave.battle ? {
      id: publicSave.battle.id,
      round: publicSave.battle.round,
      status: publicSave.battle.status,
      commands: (publicSave.battle.commands ?? []).map((command) => ({
        actionId: command.actionId,
        name: command.name,
        kind: command.kind,
        available: command.available !== false,
        disabledReason: command.disabledReason ?? null,
      })),
    } : null,
    lastOutcome: publicSave.scene?.lastOutcome ?? null,
    collapseRescue: publicSave.collapseRescue ?? null,
  };
}
function updateDaySummary(entry) {
  const day = Number(entry.after?.day ?? entry.before?.day ?? 0);
  if (!day) return;
  const current = daySummary.get(day) ?? {
    day,
    start: entry.before ?? entry.after,
    end: entry.after ?? entry.before,
    actions: 0,
    battles: 0,
    waits: [],
    movement: [],
    purchases: [],
  };
  current.end = entry.after ?? current.end;
  if (entry.event === 'COMMAND') current.actions += 1;
  if (entry.event === 'BATTLE') current.battles += 1;
  if (/LIFE:(REST|WAIT)|WAIT/u.test(entry.actionId ?? '')) current.waits.push(entry.actionId);
  if ((entry.commandType ?? '') === 'MOVE') current.movement.push(entry.actionId);
  if (['SHOP_BUY', 'SHOP_SELL', 'SERVICE_BUY'].includes(entry.commandType) || /^LIFE:BUY:/u.test(entry.actionId ?? '')) current.purchases.push(entry.actionId);
  daySummary.set(day, current);
}
function record(entry) {
  trace.push(entry);
  updateDaySummary(entry);
}
async function command(type, payload, meta = {}) {
  const before = compact(save);
  const response = await game.command(OWNER, save.id, {
    commandId: `hv-audit-${++commandSequence}`,
    expectedRevision: save.revision,
    type,
    payload,
  });
  save = response.save;
  const after = compact(save);
  const accepted = after.lastOutcome?.ok !== false && after.lastOutcome?.success !== false && after.lastOutcome?.accepted !== false;
  record({ event: 'COMMAND', commandType: type, accepted, ...meta, before, after });
  if (!accepted) throw new Error(`production rejected ${type} ${meta.actionId ?? ''}: ${JSON.stringify(after.lastOutcome)}`);
  return response;
}
function visibleChoice(actionId) { return (save.choices ?? []).find((choice) => choice.actionId === actionId) ?? null; }
function visibleMove(moveId) { return (save.movement ?? []).find((move) => move.moveId === moveId) ?? null; }
function visibilitySnapshot() {
  return {
    choices: (save.choices ?? []).map((choice) => ({ actionId: choice.actionId, label: choice.label })),
    movement: (save.movement ?? []).map((move) => ({ moveId: move.moveId, label: move.label })),
    learnable: (save.skills?.learnable ?? []).map((skill) => ({ id: skill.id, name: skill.name, spCost: skill.spCost })),
    shop: (save.shop?.stock ?? []).map((stock) => ({ stockId: stock.stockId ?? stock.id, name: stock.name, price: stock.price, loanId: stock.access?.loan?.loanId ?? null })),
  };
}
async function chooseVisible(actionId, meta = {}) {
  const choice = visibleChoice(actionId);
  if (!choice) throw visibilityError(meta.row, `choice ${actionId}`);
  return command('CHOOSE', { choiceId: choice.choiceId, actionId: choice.actionId }, {
    ...meta,
    actionId: choice.actionId,
    selectedLabel: choice.label,
    visibleAlternatives: (save.choices ?? []).map((entry) => ({ actionId: entry.actionId, label: entry.label })),
  });
}
async function moveVisible(moveId, meta = {}) {
  const move = visibleMove(moveId);
  if (!move) throw visibilityError(meta.row, `movement ${moveId}`);
  return command('MOVE', { moveId: move.moveId }, {
    ...meta,
    actionId: move.moveId,
    selectedLabel: move.label,
    visibleAlternatives: (save.movement ?? []).map((entry) => ({ moveId: entry.moveId, label: entry.label })),
  });
}
function visibilityError(row, expected) {
  const err = new Error(`ROUTE_VISIBILITY_FAIL ${row?.v3RowId ?? 'E'} expected ${expected} at Day${save.clock?.day} ${save.clock?.time} ${save.scene?.facilityId}\n${JSON.stringify(visibilitySnapshot(), null, 2)}`);
  err.code = 'ROUTE_VISIBILITY_FAIL';
  err.row = row ?? null;
  return err;
}
async function chooseIndex(index, stage) {
  const choice = save.choices?.[index];
  if (!choice) throw visibilityError(null, `Checkpoint E choice index ${index} at ${stage}`);
  return command('CHOOSE', { choiceId: choice.choiceId, actionId: choice.actionId }, {
    phase: 'checkpoint-e',
    actionId: choice.actionId,
    selectedLabel: choice.label,
    visibleAlternatives: save.choices.map((entry) => ({ actionId: entry.actionId, label: entry.label })),
  });
}
async function acknowledgeIntroduction() {
  const beat = save.scene?.beats?.find((entry) => entry.introductionToken);
  if (!beat?.introductionToken) throw new Error('Checkpoint E introduction token not visible');
  await command('ACK_NPC_INTRODUCTION', { token: beat.introductionToken }, {
    phase: 'checkpoint-e', actionId: 'ACK_NPC_INTRODUCTION', introductionToken: beat.introductionToken,
  });
}
async function acknowledgeTutorial(expectedId) {
  if (!save.tutorial?.acknowledgeable || save.tutorial?.id !== expectedId) {
    throw new Error(`tutorial ${expectedId} not acknowledgeable; got ${save.tutorial?.id}`);
  }
  await command('TUTORIAL_ACK', { tutorialId: expectedId }, { phase: 'checkpoint-e', actionId: `TUTORIAL_ACK:${expectedId}` });
}
async function runCheckpointE(entryRow) {
  save = await game.create(OWNER, { playerName: '人徳ルート実通行監査', seed: SEED });
  record({ event: 'START', phase: 'checkpoint-e', after: compact(save) });
  if (save.scene?.facilityId !== 'LOC_FARM_EDGE') throw new Error(`new game did not start at LOC_FARM_EDGE: ${save.scene?.facilityId}`);
  await chooseIndex(0, 'edge_contact');
  await acknowledgeIntroduction();
  await chooseIndex(1, 'village_entry');
  await chooseIndex(2, 'hunger_offer');
  await chooseIndex(0, 'bread_eat');
  await chooseIndex(0, 'inventory_prompt');
  await acknowledgeTutorial('checkpoint-e-inventory');
  await chooseIndex(1, 'loan_offer');
  const catalog = buildCheckpointELoanCatalog(data);
  const option = catalog.options.find((entry) => entry.id === BASELINE_LOADOUT);
  if (!option) throw new Error(`unknown baseline E loadout ${BASELINE_LOADOUT}`);
  const loanId = `EINTRO:LOADOUT:${option.id}`;
  const stock = save.shop?.stock?.find((entry) => entry.access?.loan?.loanId === loanId);
  if (!stock) throw new Error(`baseline loan ${loanId} not visible in production shop`);
  await command('SHOP_BORROW', { loanId }, {
    phase: 'checkpoint-e', actionId: loanId,
    visibleAlternatives: (save.shop?.stock ?? []).map((entry) => ({ loanId: entry.access?.loan?.loanId ?? null, name: entry.name })),
  });
  for (const equipmentId of save.checkpointEPrologue?.loan?.equipmentIds ?? []) {
    if (!inventoryEquipmentIds(save).includes(equipmentId)) throw new Error(`borrowed equipment ${equipmentId} missing from inventory`);
    await command('EQUIP', { equipmentId }, { phase: 'checkpoint-e', actionId: `EQUIP:${equipmentId}` });
  }
  await acknowledgeTutorial('checkpoint-e-skills');
  await chooseIndex(0, 'fatigue_intro');
  if (save.checkpointEPrologue?.stage !== 'lodging_choice') throw new Error(`E did not reach lodging_choice: ${save.checkpointEPrologue?.stage}`);
  await chooseVisible(entryRow.actionId, { phase: 'ledger', row: entryRow, v3RowId: entryRow.v3RowId, canonicalDay: Number(entryRow.day) });
  if (!save.checkpointEPrologue?.complete) throw new Error('E:LODGE:REGISTER did not complete Checkpoint E');
  await restoreRoundTrip('after-checkpoint-e');
}
async function restoreRoundTrip(label) {
  const before = compact(save);
  game = createCheckpointEPrologueTrpgGameService({ data, store, allowCustomSeed: true, maxSavesPerOwner: 4 });
  const restored = await game.get(OWNER, save.id);
  save = restored;
  const after = compact(save);
  const keys = ['revision', 'stateHash', 'absoluteMinute', 'day', 'time', 'region', 'facilityId', 'gold', 'hunger', 'fatigue'];
  const differences = keys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  restoreChecks.push({ label, passed: differences.length === 0, differences, before, after });
  record({ event: 'RESTORE', label, accepted: differences.length === 0, before, after });
  if (differences.length) throw new Error(`save/restore mismatch at ${label}: ${differences.join(',')}`);
}
function battleCommandSnapshot(command) {
  return {
    actionId: command.actionId,
    name: command.name,
    kind: command.kind,
    available: command.available !== false,
    disabledReason: command.disabledReason ?? null,
    targets: (command.targets ?? []).map((target) => ({ instanceId: target.instanceId, side: target.side, alive: target.alive })),
  };
}
async function finishBattle(triggerRow) {
  const started = compact(save);
  const battleId = save.battle?.id;
  const turns = [];
  let guard = 0;
  while (save.battle && guard < 80) {
    guard += 1;
    const available = (save.battle.commands ?? []).filter((entry) => entry.available !== false);
    const skills = available.filter((entry) => entry.kind === 'skill');
    const action = skills[(guard - 1) % Math.max(1, skills.length)]
      ?? available.find((entry) => entry.kind === 'attack')
      ?? available.find((entry) => entry.kind === 'defend')
      ?? available.find((entry) => entry.kind === 'flee')
      ?? available[0];
    if (!action) throw new Error(`battle ${battleId} has no available action at round ${save.battle.round}`);
    const target = action.targets?.find((entry) => entry.side === 'enemy' && entry.alive !== false) ?? action.targets?.[0];
    const before = compact(save);
    await command('BATTLE_ACT', {
      battleId: save.battle.id,
      actionId: action.actionId,
      ...(target ? { targetInstanceId: target.instanceId } : {}),
    }, { phase: 'battle', actionId: action.actionId, selectedLabel: action.name, v3RowId: triggerRow?.v3RowId ?? null });
    turns.push({ round: before.battle?.round, selected: battleCommandSnapshot(action), before, after: compact(save) });
  }
  if (save.battle) throw new Error(`battle ${battleId} did not finish within 80 battle actions`);
  const ended = compact(save);
  battleLogs.push({ battleId, triggerRow: triggerRow?.v3RowId ?? null, canonicalDay: Number(triggerRow?.day ?? ended.day), started, ended, turns });
  record({ event: 'BATTLE', actionId: battleId, commandType: 'BATTLE', before: started, after: ended, turns: turns.length });
}
async function resolveCollapseIfAny(row) {
  const rescue = save.collapseRescue?.command;
  if (!rescue?.type) return;
  findings.push({ severity: 'P1', kind: 'UNPLANNED_COLLAPSE', v3RowId: row?.v3RowId ?? null, at: compact(save), message: 'Production collapse occurred during canonical route and required authoritative recovery.' });
  await command(rescue.type, rescue.payload ?? {}, { phase: 'collapse-recovery', actionId: rescue.type, v3RowId: row?.v3RowId ?? null });
}
async function executeLedgerRow(row) {
  const commandType = text(row.commandType);
  const actionId = text(row.actionId);
  const canonicalDay = Number(row.day);
  if (commandType === 'OUTCOME' || !commandType) {
    record({ event: 'OUTCOME', commandType: 'OUTCOME', actionId: null, v3RowId: row.v3RowId, canonicalDay, description: row.sourceDescription, expectedResult: row.resultingState, after: compact(save) });
    return;
  }
  await resolveCollapseIfAny(row);
  const meta = { phase: 'ledger', row, v3RowId: row.v3RowId, canonicalDay, canonicalTime: row.sourceTime, actionId };
  if (commandType === 'CHOOSE') await chooseVisible(actionId, meta);
  else if (commandType === 'MOVE') await moveVisible(actionId, meta);
  else if (commandType === 'LEARN_SKILL') {
    const skillId = text(parsePayload(row.payload).skillId || row.skillId || actionId);
    const learnable = (save.skills?.learnable ?? []).find((skill) => skill.id === skillId);
    if (!learnable) throw visibilityError(row, `learnable skill ${skillId}`);
    await command('LEARN_SKILL', { skillId }, { ...meta, selectedLabel: learnable.name, visibleAlternatives: save.skills.learnable.map((skill) => ({ id: skill.id, name: skill.name, spCost: skill.spCost })) });
  } else if (commandType === 'SHOP_BUY') {
    const stockId = text(parsePayload(row.payload).stockId || actionId);
    const stock = (save.shop?.stock ?? []).find((entry) => (entry.stockId ?? entry.id) === stockId);
    if (!stock) throw visibilityError(row, `shop stock ${stockId}`);
    await command('SHOP_BUY', { stockId }, { ...meta, selectedLabel: stock.name, visibleAlternatives: save.shop.stock.map((entry) => ({ stockId: entry.stockId ?? entry.id, name: entry.name, price: entry.price })) });
  } else if (commandType === 'EQUIP') {
    const equipmentId = text(parsePayload(row.payload).equipmentId || row.equipmentId || actionId);
    if (!inventoryEquipmentIds(save).includes(equipmentId)) throw visibilityError(row, `inventory equipment ${equipmentId}`);
    await command('EQUIP', { equipmentId }, meta);
  } else if (commandType === 'UNEQUIP') {
    const slot = text(parsePayload(row.payload).slot || actionId);
    if (!save.player?.equipment?.[slot]) throw visibilityError(row, `equipped slot ${slot}`);
    await command('UNEQUIP', { slot }, meta);
  } else if (commandType === 'SHOP_SELL') {
    const equipmentId = text(parsePayload(row.payload).equipmentId || row.equipmentId || actionId);
    if (!inventoryEquipmentIds(save).includes(equipmentId)) throw visibilityError(row, `sellable owned equipment ${equipmentId}`);
    await command('SHOP_SELL', { equipmentId }, meta);
  } else {
    throw new Error(`unsupported canonical commandType ${commandType} at ${row.v3RowId}`);
  }
  if (save.battle) await finishBattle(row);
}
async function run() {
  const rows = ledgerRows();
  if (rows.length !== 1525) throw new Error(`expected 1525 ledger rows after removing the stale Day2 bakery-to-inn move, got ${rows.length}`);
  const entryIndex = rows.findIndex((row) => row.actionId === 'E:LODGE:REGISTER');
  if (entryIndex < 0) throw new Error('post-E REGISTER entry missing from ledger');
  await runCheckpointE(rows[entryIndex]);
  let lastRestoredDay = 0;
  let processed = entryIndex + 1;
  try {
    for (; processed < rows.length; processed += 1) {
      const row = rows[processed];
      await executeLedgerRow(row);
      const currentDay = Number(save.clock?.day ?? 0);
      if (SAVE_CHECKPOINT_DAYS.has(currentDay) && currentDay !== lastRestoredDay) {
        await restoreRoundTrip(`day-${currentDay}`);
        lastRestoredDay = currentDay;
      }
    }
  } catch (error) {
    findings.push({ severity: error?.code === 'ROUTE_VISIBILITY_FAIL' ? 'P0' : 'P0', kind: error?.code ?? 'RUNTIME_ERROR', v3RowId: rows[processed]?.v3RowId ?? null, at: compact(save), message: String(error?.message ?? error) });
  }
  const final = compact(save);
  const reachedFinalLedgerRow = processed >= rows.length;
  const report = {
    schemaVersion: 'human-virtue-full-route-audit-v1',
    generatedAt: new Date().toISOString(),
    sourceCommit: process.env.GITHUB_SHA ?? null,
    seed: SEED,
    baselineLoadout: BASELINE_LOADOUT,
    canonicalRows: rows.length,
    canonicalFinalDay: FINAL_DAY,
    processedRows: Math.min(processed, rows.length),
    reachedFinalLedgerRow,
    final,
    battles: battleLogs.length,
    restoreChecks,
    findings,
    daysObserved: [...daySummary.keys()].sort((a, b) => a - b),
    passed: reachedFinalLedgerRow && Number(final.day) >= FINAL_DAY && findings.every((finding) => !['P0', 'P1'].includes(finding.severity)) && restoreChecks.every((check) => check.passed),
  };
  fs.writeFileSync(path.join(REPORTS, 'human-virtue-full-route-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(REPORTS, 'human-virtue-full-route-trace.jsonl'), `${trace.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
  fs.writeFileSync(path.join(REPORTS, 'human-virtue-full-route-battles.json'), `${JSON.stringify(battleLogs, null, 2)}\n`);
  fs.writeFileSync(path.join(REPORTS, 'human-virtue-full-route-days.json'), `${JSON.stringify([...daySummary.values()].sort((a, b) => a.day - b.day), null, 2)}\n`);
  fs.writeFileSync(path.join(REPORTS, 'human-virtue-full-route-findings.json'), `${JSON.stringify(findings, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`FULL_ROUTE_CERT=${report.passed ? 'PASS' : 'FAIL'}`);
  if (!report.passed) process.exitCode = 1;
}

await run();
