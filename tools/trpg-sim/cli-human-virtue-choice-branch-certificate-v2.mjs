import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCheckpointELoanCatalog,
  createCheckpointEPrologueTrpgGameService,
} from '../../src/server/trpg/game/checkpoint-e-prologue-service.js';
import { loadTrpgGameData } from '../../src/server/trpg/game/game-data.js';
import { MemoryTrpgSaveStore } from '../../src/server/trpg/game/save-store.js';
import { deserializeRuntime } from '../../src/server/trpg/game/serializer.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.join(HERE, 'reports');
const SEED = process.env.TRPG_HV_AUDIT_SEED || 'human-virtue-full-route-audit-v2';
const OWNER = `human-virtue-v2-branch-audit:${SEED}`;
const data = loadTrpgGameData();

fs.mkdirSync(REPORTS, { recursive: true });

function createService(store) {
  return createCheckpointEPrologueTrpgGameService({ data, store, allowCustomSeed: true, maxSavesPerOwner: 4 });
}

function setValues(value) {
  if (value instanceof Set) return [...value].map(String).sort();
  if (Array.isArray(value)) return value.map((entry) => String(entry?.id ?? entry)).sort();
  if (value && typeof value === 'object') return Object.keys(value).filter((key) => value[key]).sort();
  return [];
}

function npcPositions(runtime) {
  return Object.fromEntries(Object.entries(runtime?.livingWorld?.npcStates ?? {}).map(([id, npc]) => [id, {
    presence: npc?.presence ?? null,
    lifeStatus: npc?.lifeStatus ?? null,
    hubId: npc?.position?.hubId ?? npc?.location ?? null,
    facilityId: npc?.position?.facilityId ?? null,
  }]));
}

function missionStates(runtime) {
  const missions = runtime?.playerState?.missions;
  const list = Array.isArray(missions) ? missions : missions instanceof Map ? [...missions.values()] : Object.values(missions ?? {});
  return Object.fromEntries(list.filter(Boolean).map((mission) => [mission.id, {
    status: mission.status ?? null,
    stepId: mission.currentStepId ?? mission.currentStep?.id ?? null,
    progress: mission.currentStep?.progress ?? null,
  }]));
}

function causalSnapshot(runtime, publicSave, stateHash) {
  const player = runtime?.playerState?.player ?? {};
  const flags = Object.keys(runtime?.playerState?.worldFlags ?? {}).filter((key) => runtime.playerState.worldFlags[key] != null).sort();
  const evidence = Object.keys(runtime?.playerState?.evidence ?? {}).sort();
  return {
    stateHash,
    day: publicSave.clock?.day ?? null,
    absoluteMinute: publicSave.clock?.absoluteMinute ?? null,
    time: publicSave.clock?.time ?? null,
    location: player.location ?? null,
    facilityId: player.facilityId ?? null,
    gold: Number(player.gold ?? 0),
    hunger: Number(player.needs?.hunger ?? player.hunger ?? runtime?.playerState?.hunger ?? 0),
    fatigue: Number(player.needs?.fatigue ?? player.fatigue ?? runtime?.playerState?.fatigue ?? 0),
    knownNpcIds: setValues(runtime?.playerKnowledge?.knownNpcIds),
    knownRumorIds: setValues(player.knownRumorIds),
    flags,
    evidence,
    historyLength: Array.isArray(runtime?.playerState?.history) ? runtime.playerState.history.length : 0,
    historyTail: (runtime?.playerState?.history ?? []).slice(-12).map((entry) => ({
      type: entry?.type ?? null,
      actionId: entry?.actionId ?? null,
      trace: entry?.trace ?? null,
      evidenceId: entry?.evidenceId ?? null,
      minute: entry?.minute ?? null,
    })),
    missions: missionStates(runtime),
    npcPositions: npcPositions(runtime),
  };
}

function added(left = [], right = []) {
  const before = new Set(left);
  return right.filter((value) => !before.has(value));
}

function changedNpcPositions(before = {}, after = {}) {
  const changes = [];
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[id] ?? null) !== JSON.stringify(after[id] ?? null)) {
      changes.push({ npcId: id, before: before[id] ?? null, after: after[id] ?? null });
    }
  }
  return changes;
}

function delta(before, after) {
  return {
    elapsedMinutes: Number(after.absoluteMinute ?? 0) - Number(before.absoluteMinute ?? 0),
    location: before.location === after.location && before.facilityId === after.facilityId
      ? null
      : { before: { location: before.location, facilityId: before.facilityId }, after: { location: after.location, facilityId: after.facilityId } },
    gold: Number(after.gold ?? 0) - Number(before.gold ?? 0),
    hunger: Number(after.hunger ?? 0) - Number(before.hunger ?? 0),
    fatigue: Number(after.fatigue ?? 0) - Number(before.fatigue ?? 0),
    flagsAdded: added(before.flags, after.flags),
    evidenceAdded: added(before.evidence, after.evidence),
    knownNpcIdsAdded: added(before.knownNpcIds, after.knownNpcIds),
    knownRumorIdsAdded: added(before.knownRumorIds, after.knownRumorIds),
    historyAdded: after.historyTail.slice(Math.max(0, after.historyTail.length - Math.max(0, after.historyLength - before.historyLength))),
    npcMovement: changedNpcPositions(before.npcPositions, after.npcPositions),
    missionStateChanged: JSON.stringify(before.missions) === JSON.stringify(after.missions) ? null : { before: before.missions, after: after.missions },
  };
}

async function runtimeSnapshot(store, publicSave) {
  const record = await store.get(publicSave.id);
  if (!record?.runtimeSnapshot) throw new Error(`persisted runtime missing for ${publicSave.id}`);
  return causalSnapshot(deserializeRuntime(record.runtimeSnapshot, data), publicSave, publicSave.stateHash);
}

async function command(service, owner, save, type, payload, tag = 'main') {
  const response = await service.command(owner, save.id, {
    commandId: `hv-v2:${tag}:${save.revision}:${type}:${JSON.stringify(payload)}`.slice(0, 100),
    expectedRevision: save.revision,
    type,
    payload,
  });
  const next = response.save;
  const accepted = next.scene?.lastOutcome?.ok !== false
    && next.scene?.lastOutcome?.success !== false
    && next.scene?.lastOutcome?.accepted !== false;
  if (!accepted) throw new Error(`production rejected ${type}: ${JSON.stringify(next.scene?.lastOutcome ?? null)}`);
  return next;
}

async function plainChoose(service, owner, save, actionId, tag = 'main') {
  const visible = (save.choices ?? []).find((entry) => entry.actionId === actionId);
  if (!visible) throw new Error(`choice ${actionId} is not visible at Day${save.clock?.day} ${save.clock?.time}; visible=${(save.choices ?? []).map((entry) => entry.actionId).join(',')}`);
  return command(service, owner, save, 'CHOOSE', { choiceId: visible.choiceId, actionId: visible.actionId }, tag);
}

async function move(service, owner, save, moveId) {
  const visible = (save.movement ?? []).find((entry) => entry.moveId === moveId);
  if (!visible) throw new Error(`movement ${moveId} is not visible at Day${save.clock?.day} ${save.clock?.time}`);
  return command(service, owner, save, 'MOVE', { moveId: visible.moveId }, 'main');
}

async function forkChoice(record, owner, action) {
  const forkStore = new MemoryTrpgSaveStore();
  await forkStore.put(record);
  let forkService = createService(forkStore);
  let forkSave = await forkService.get(owner, record.id);
  const before = await runtimeSnapshot(forkStore, forkSave);
  forkSave = await plainChoose(forkService, owner, forkSave, action.actionId, `fork:${action.actionId}`);
  const after = await runtimeSnapshot(forkStore, forkSave);

  // Save/restore boundary: the branch fingerprint must survive a fresh service instance.
  forkService = createService(forkStore);
  const restored = await forkService.get(owner, forkSave.id);
  const restoredAfter = await runtimeSnapshot(forkStore, restored);
  if (restored.stateHash !== forkSave.stateHash || JSON.stringify(restoredAfter) !== JSON.stringify(after)) {
    throw new Error(`branch ${action.actionId} changed across production save/restore`);
  }
  return {
    actionId: action.actionId,
    label: action.label,
    minutesShown: Number(action.minutes ?? 0),
    stateHash: restored.stateHash,
    after: restoredAfter,
    delta: delta(before, restoredAfter),
  };
}

const choiceSets = [];
let choiceSetSequence = 0;

async function certifiedChoose(context, actionId) {
  const { store, service, owner } = context;
  const save = context.save;
  const visible = (save.choices ?? []).map((entry) => ({
    actionId: entry.actionId,
    choiceId: entry.choiceId,
    label: entry.label,
    minutes: Number(entry.minutes ?? 0),
    type: entry.type ?? null,
    intentType: entry.intentType ?? null,
  }));
  const selected = visible.find((entry) => entry.actionId === actionId);
  if (!selected) throw new Error(`canonical Human Virtue action ${actionId} is not visible`);

  const before = await runtimeSnapshot(store, save);
  const sourceRecord = await store.get(save.id);
  let forkEvidence = [];
  let branchDistinct = null;
  let historyDistinct = null;
  if (visible.length === 3) {
    for (const option of visible) forkEvidence.push(await forkChoice(sourceRecord, owner, option));
    branchDistinct = new Set(forkEvidence.map((entry) => entry.stateHash)).size === forkEvidence.length;
    historyDistinct = new Set(forkEvidence.map((entry) => JSON.stringify(entry.delta.historyAdded))).size === forkEvidence.length;
    if (!branchDistinct) throw new Error(`NO_OP_BRANCH: ${visible.map((entry) => entry.actionId).join(' / ')}`);
  }

  context.save = await plainChoose(service, owner, save, actionId, 'main');
  const after = await runtimeSnapshot(store, context.save);
  const mainDelta = delta(before, after);
  const mainFork = forkEvidence.find((entry) => entry.actionId === actionId) ?? null;
  if (mainFork && mainFork.stateHash !== context.save.stateHash) {
    throw new Error(`main and fork execution disagree for ${actionId}`);
  }

  const cert = {
    sequence: ++choiceSetSequence,
    choiceSetId: `HV2-D${before.day}-${String(before.absoluteMinute).padStart(5, '0')}-${choiceSetSequence}`,
    day: before.day,
    absoluteMinute: before.absoluteMinute,
    time: before.time,
    location: before.location,
    facilityId: before.facilityId,
    choiceCount: visible.length,
    visibleChoices: visible,
    humanVirtueSelectedActionId: actionId,
    selectedDelta: mainDelta,
    opportunityCostActionIds: visible.filter((entry) => entry.actionId !== actionId).map((entry) => entry.actionId),
    forkEvidence,
    allForkStateHashesDistinct: branchDistinct,
    allForkHistoryDeltasDistinct: historyDistinct,
    alternateBranchesLeaveHumanVirtueThread: forkEvidence.length === 3
      ? forkEvidence.filter((entry) => entry.actionId !== actionId).every((entry) => entry.stateHash !== context.save.stateHash)
      : null,
    noForcedReconvergenceAtImmediateFork: branchDistinct,
  };
  choiceSets.push(cert);
  return context.save;
}

async function acknowledgeEda(context) {
  const beat = context.save.scene?.beats?.find((entry) => entry.actorId === 'NPC004' && entry.introductionToken);
  if (!beat?.introductionToken) throw new Error('Eda introduction token is not visible');
  context.save = await command(context.service, context.owner, context.save, 'ACK_NPC_INTRODUCTION', { token: beat.introductionToken }, 'main');
}

async function finishBattle(context) {
  let guard = 0;
  while (context.save.battle && guard < 80) {
    guard += 1;
    const available = (context.save.battle.commands ?? []).filter((entry) => entry.available !== false);
    const selected = available.find((entry) => entry.kind === 'attack')
      ?? available.find((entry) => entry.kind === 'skill')
      ?? available.find((entry) => entry.kind === 'defend')
      ?? available[0];
    if (!selected) throw new Error(`T01 battle has no legal action at round ${guard}`);
    const target = selected.targets?.find((entry) => entry.side === 'enemy' && entry.alive !== false) ?? selected.targets?.[0] ?? null;
    context.save = await command(context.service, context.owner, context.save, 'BATTLE_ACT', {
      battleId: context.save.battle.id,
      actionId: selected.actionId,
      ...(target ? { targetInstanceId: target.instanceId } : {}),
    }, 'main');
  }
  if (context.save.battle) throw new Error('T01 battle did not finish inside 80 production battle commands');
}

async function run() {
  const store = new MemoryTrpgSaveStore();
  const service = createService(store);
  const context = {
    store,
    service,
    owner: OWNER,
    save: await service.create(OWNER, { playerName: '人徳v2分岐監査', seed: SEED }),
  };
  if (context.save.scene?.facilityId !== 'LOC_FARM_EDGE') throw new Error('v2 branch audit did not start from New Game LOC_FARM_EDGE');

  await certifiedChoose(context, 'E:EDGE:THANK');
  await acknowledgeEda(context);
  await certifiedChoose(context, 'E:MOVE:WATCH');
  await certifiedChoose(context, 'E:BREAD:HELP');
  await certifiedChoose(context, 'E:EAT:QUIET');
  await certifiedChoose(context, 'E:INV:PLAIN');
  context.save = await command(service, OWNER, context.save, 'TUTORIAL_ACK', { tutorialId: 'checkpoint-e-inventory' }, 'main');
  await certifiedChoose(context, 'E:LOAN:RECORD');

  const loadout = buildCheckpointELoanCatalog(data).options.find((entry) => entry.id === 'sword-shield');
  if (!loadout) throw new Error('sword-shield loadout missing');
  context.save = await command(service, OWNER, context.save, 'SHOP_BORROW', { loanId: 'EINTRO:LOADOUT:sword-shield' }, 'main');
  for (const equipmentId of loadout.equipmentIds) {
    context.save = await command(service, OWNER, context.save, 'EQUIP', { equipmentId }, 'main');
  }
  context.save = await command(service, OWNER, context.save, 'TUTORIAL_ACK', { tutorialId: 'checkpoint-e-skills' }, 'main');
  await certifiedChoose(context, 'E:FATIGUE:CHECK');
  await certifiedChoose(context, 'E:LODGE:REGISTER');

  await certifiedChoose(context, 'DISCOVER_LOCAL_TROUBLE:T01');
  context.save = await move(service, OWNER, context.save, 'MOVE_LOCAL:LOC_FARM_SQUARE');
  await certifiedChoose(context, 'ACTION:MSN-T01:hear');
  context.save = await move(service, OWNER, context.save, 'MOVE_LOCAL:LOC_FARM_EDGE');
  await certifiedChoose(context, 'ACTION:MSN-T01:search:tracks');
  await certifiedChoose(context, 'ACTION:MSN-T01:search:wolf-blockade');
  await certifiedChoose(context, 'ACTION:MSN-T01:rescue');
  await finishBattle(context);
  await certifiedChoose(context, 'ACTION:MSN-T01:escort');
  context.save = await move(service, OWNER, context.save, 'MOVE_LOCAL:LOC_FARM_SQUARE');
  await certifiedChoose(context, 'ACTION:MSN-T01:decide');
  await certifiedChoose(context, 'MISSION_FLOW:T01:SQUARE_AFTERCARE:help_mira');
  await certifiedChoose(context, 'MISSION_FLOW:T01:SQUARE_SUPPER:share_bread');
  await certifiedChoose(context, 'MISSION_FLOW:T01:EVENING_FREE_TIME:maintain_and_rest');
  await certifiedChoose(context, 'MISSION_FLOW:T01:VILLAGE_NIGHT:sleep_at_miras');

  const final = await runtimeSnapshot(store, context.save);
  const threeWay = choiceSets.filter((entry) => entry.choiceCount === 3);
  const findings = [];
  for (const entry of choiceSets) {
    if (entry.choiceCount !== 3) {
      findings.push({
        severity: 'P2',
        kind: 'NON_THREE_CHOICE_PANEL',
        choiceSetId: entry.choiceSetId,
        message: `main-route decision panel exposed ${entry.choiceCount} choices`,
      });
    }
    if (entry.choiceCount === 3 && entry.allForkStateHashesDistinct !== true) {
      findings.push({ severity: 'P1', kind: 'NO_OP_BRANCH', choiceSetId: entry.choiceSetId });
    }
  }
  const report = {
    schemaVersion: 'human-virtue-choice-branch-certificate-v2',
    generatedAt: new Date().toISOString(),
    sourceCommit: process.env.GITHUB_SHA ?? null,
    seed: SEED,
    auditCoverageStart: 'NEW_GAME',
    previousV1CoverageAccepted: false,
    through: { day: final.day, time: final.time, absoluteMinute: final.absoluteMinute },
    choiceSets,
    threeWayChoiceSets: threeWay.length,
    allThreeWayForksDistinct: threeWay.every((entry) => entry.allForkStateHashesDistinct === true),
    allThreeWayForksRestoreStable: true,
    findings,
    passed: final.day >= 2
      && threeWay.length > 0
      && threeWay.every((entry) => entry.allForkStateHashesDistinct === true)
      && findings.every((entry) => entry.severity !== 'P1'),
  };
  fs.writeFileSync(path.join(REPORTS, 'human-virtue-choice-branch-certificate-v2.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    schemaVersion: report.schemaVersion,
    through: report.through,
    choiceSets: report.choiceSets.length,
    threeWayChoiceSets: report.threeWayChoiceSets,
    findings: report.findings,
    passed: report.passed,
  }, null, 2));
  console.log(`HUMAN_VIRTUE_BRANCH_CERT_V2=${report.passed ? 'PASS' : 'FAIL'}`);
  if (!report.passed) process.exitCode = 1;
}

await run();
