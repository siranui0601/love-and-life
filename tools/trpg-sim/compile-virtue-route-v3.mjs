#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { CANONICAL_WORLD_LIFE_INTERNALS } from '../../src/server/trpg/content/canonical-world-life-actions.js';
import { AUTHORED_MISSION_FLOW_PACKS } from '../../src/server/trpg/content/authored-mission-flow-registry-t17-final.js';
import { AUTHORED_PUBLIC_LIFE_NETWORK_INTERNALS } from '../../src/server/trpg/content/authored-public-life-network.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_INPUT = path.join(ROOT, 'docs/trpg/virtue-route-v2-source.csv');
const DEFAULT_INPUT_ARCHIVE = `${DEFAULT_INPUT}.gz.b64`;
const DEFAULT_INPUT_META = path.join(ROOT, 'docs/trpg/virtue-route-v2-source.meta.json');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');
const CATALOG_PATH = path.join(HERE, 'lib/virtue-route-v3-runtime-catalog.json');
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const runtimeProducts = [...catalog.products];
for (const [productId, tuple] of Object.entries(CANONICAL_WORLD_LIFE_INTERNALS.PRODUCTS)) {
  if (runtimeProducts.some((entry) => entry.productId === productId)) continue;
  const [region, facilityId, , label, price, kind, portions = 1, condition = null] = tuple;
  runtimeProducts.push({ productId, region, facilityId, label, price, kind, portions, condition });
}
runtimeProducts.sort((a, b) => a.productId.localeCompare(b.productId));
const runtimeRestDurations = [...CANONICAL_WORLD_LIFE_INTERNALS.REST_DURATIONS];
const authoredPackByTroubleId = new Map(
  AUTHORED_MISSION_FLOW_PACKS.map((pack) => [pack.troubleId, pack]),
);
const STATUSLESS_AUTHORED_FLOWS = new Set([
  'capital-persecution-riot',
  'capital-second-summoning',
]);
const defaultProvisionByRegion = Object.freeze({
  ...catalog.defaultProvisionByRegion,
  'エルフの隠れ里': 'ITM023',
});
const defaultLodgingByRegion = Object.freeze({
  ...catalog.defaultLodgingByRegion,
  'エルフの隠れ里': 'ITM195',
});
const FINAL_STATUSES = new Set([
  'RESOLVED_EXISTING', 'RESOLVED_NEW_GENERAL', 'RESOLVED_NEW_AUTHORED',
  'OUTCOME', 'BOOKKEEPING', 'REPLACED_INVALID',
]);
const FORBIDDEN_STATUS = /^(?:PARTIAL|NO|TODO|TBD|UNKNOWN|UNMAPPED)$/u;

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readInputCsv(input) {
  if (fs.existsSync(input)) return fs.readFileSync(input, 'utf8');
  const archive = input === DEFAULT_INPUT ? DEFAULT_INPUT_ARCHIVE : `${input}.gz.b64`;
  if (!fs.existsSync(archive)) throw new Error(`source CSV not found: ${input}`);
  const encoded = fs.readFileSync(archive, 'utf8').replace(/\s/gu, '');
  return zlib.gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
}

function sourceMetadata(input, text) {
  const sibling = input.replace(/\.csv$/u, '.meta.json');
  const metadataPath = fs.existsSync(sibling) ? sibling : input === DEFAULT_INPUT ? DEFAULT_INPUT_META : null;
  if (!metadataPath || !fs.existsSync(metadataPath)) {
    return {
      spreadsheetId: null,
      sheetName: null,
      dataRows: null,
      columns: null,
      fetchedAt: null,
      sourceHash: sha256(text),
      metadataPath: null,
    };
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const actualHash = sha256(text);
  if (metadata.sourceHashAlgorithm !== 'sha256' || metadata.sourceHash !== actualHash) {
    throw new Error(`source hash mismatch: ${actualHash} != ${metadata.sourceHash}`);
  }
  return { ...metadata, metadataPath: path.relative(ROOT, metadataPath) };
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/u, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/u, '')); rows.push(row); }
  return rows;
}

function csvCell(value) {
  const text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(','))].join('\n') + '\n';
}
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function timeMinute(value) {
  const match = /^(\d{1,2}):(\d{2})/u.exec(String(value ?? ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
function durationMinutes(start, end) {
  const a = timeMinute(start), b = timeMinute(end);
  if (a == null || b == null) return null;
  const next = /\(\+1\)/u.test(String(end)) || b < a;
  return b + (next ? 1440 : 0) - a;
}
function hhmm(minute) {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
}
function splitNpcNames(value) {
  return String(value ?? '').split(/[\/／,、;]/u).map((v) => v.trim()).filter(Boolean);
}
function troubleMissionId(troubleId) { return troubleId ? `MSN-${troubleId}` : ''; }
function baseMapping(row, index) {
  return {
    legacyRowIndex: index + 1,
    legacyRowId: row['action ID'], legacyDay: Number(row.Day), legacyTime: `${row['開始']}→${row['終了']}`,
    legacyDescription: row['行動'], legacyRuntimeAction: row['runtime action'], legacyRegion: row['場所'],
    classification: '', replacementRowIds: '', replacementSteps: '', resolutionMethod: 'RULE',
    commandType: '', choiceId: '', actionId: '', payload: '',
    regionId: row['場所'], facilityId: '', npcIds: splitNpcNames(row.NPC).join('|'), troubleId: row['事件'] || '',
    jobId: '', productId: '', equipmentId: '', materialId: '', skillId: '',
    requiredState: '', resultingState: '', implementationSource: '', status: '', unresolvedReason: '',
    plannedStart: row['開始'], plannedEnd: row['終了'], notes: '',
  };
}
function resolvedPlayer(m, actionId, commandType = 'CHOOSE', payload = null) {
  m.classification = 'PLAYER_COMMAND'; m.commandType = commandType; m.actionId = actionId;
  if (commandType === 'CHOOSE') { m.choiceId = actionId; m.payload = JSON.stringify(payload ?? { choiceId: actionId, actionId }); }
  else m.payload = JSON.stringify(payload ?? {});
  m.status = 'RESOLVED_EXISTING'; return m;
}
function commandStep(actionId, commandType = 'CHOOSE', payload = null, extra = {}) {
  const body = commandType === 'CHOOSE'
    ? payload ?? { choiceId: actionId, actionId }
    : payload ?? {};
  return { actionId, commandType, payload: body, ...extra };
}
function resolvedSteps(m, steps, notes = '', resolutionMethod = 'EXACT_AUTHORED') {
  if (!Array.isArray(steps) || steps.length < 2) throw new Error(`multi-step mapping requires at least two commands: ${m.legacyRowId}`);
  m.classification = 'PLAYER_COMMAND_SEQUENCE';
  m.commandType = 'SEQUENCE';
  m.actionId = steps.at(-1).actionId;
  m.payload = JSON.stringify({ steps });
  m.replacementSteps = JSON.stringify(steps);
  m.replacementRowIds = steps.map((_, index) => `${m.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|');
  m.resolutionMethod = resolutionMethod;
  m.status = 'RESOLVED_EXISTING';
  m.notes = notes;
  return m;
}
function authoredPack(troubleId) {
  const pack = authoredPackByTroubleId.get(troubleId);
  if (!pack) throw new Error(`authored mission pack missing for ${troubleId}`);
  return pack;
}
function authoredResolutionId(troubleId, routeId, troubleStatus = 'active') {
  const pack = authoredPack(troubleId);
  if (!pack.resolution?.choices?.some((choice) => choice.id === routeId)) {
    throw new Error(`authored resolution route missing: ${troubleId}/${routeId}`);
  }
  const suffix = STATUSLESS_AUTHORED_FLOWS.has(pack.id) ? '' : `:${troubleStatus}`;
  return `MISSION_FLOW:${pack.id}:RESOLUTION:${routeId}${suffix}`;
}
function authoredResolutionFacility(troubleId) {
  const pack = authoredPack(troubleId);
  const facilityId = pack.catalogOverride?.resolution?.targetFacilityId;
  if (!facilityId) throw new Error(`authored resolution facility missing for ${troubleId}`);
  return facilityId;
}
function authoredBattleStep(troubleId, extra = {}) {
  const pack = authoredPack(troubleId);
  if (!pack.catalogOverride?.battle && !pack.battle) {
    throw new Error(`authored battle/intervention step missing for ${troubleId}`);
  }
  return commandStep(`ACTION:${pack.missionId}:${pack.battle?.stepId ?? 'battle'}`, 'CHOOSE', null, extra);
}

function authoredOpeningStep(troubleId, choiceId, extra = {}) {
  const pack = authoredPack(troubleId);
  if (!pack.hearing?.choices?.some((choice) => choice.id === choiceId)) {
    throw new Error(`authored opening choice missing: ${troubleId}/${choiceId}`);
  }
  return commandStep(`MISSION_FLOW:${pack.id}:OPENING:${choiceId}`, 'CHOOSE', null, extra);
}

function authoredLeadAndEvidenceSteps(troubleId, leadId, origin) {
  const pack = authoredPack(troubleId);
  const lead = pack.investigation?.leads?.find((entry) => entry.id === leadId);
  if (!lead) throw new Error(`authored investigation lead missing: ${troubleId}/${leadId}`);
  const targetRegion = lead.targetLocation ?? pack.hearing.targetLocation;
  const targetFacility = lead.facilityId;
  const sameRegion = origin.regionId === targetRegion;
  const sameFacility = sameRegion && origin.facilityId === targetFacility;
  const kind = sameRegion ? 'LEAD' : 'LEAD_HUB';
  const suffix = sameFacility ? '' : `@${origin.facilityId}`;
  return {
    steps: [
      commandStep(`MISSION_FLOW:${pack.id}:${kind}:${leadId}${suffix}`, 'CHOOSE', null, {
        regionId: targetRegion,
        facilityId: targetFacility,
      }),
      commandStep(`MISSION_FLOW:${pack.id}:EVIDENCE:${leadId}`, 'CHOOSE', null, {
        regionId: targetRegion,
        facilityId: targetFacility,
      }),
    ],
    end: { regionId: targetRegion, facilityId: targetFacility },
    discoveryId: lead.discoveryId,
  };
}

function authoredInvestigationSequence(troubleId, {
  originRegion,
  originFacility,
  openingChoiceId = null,
  leadIds = [],
  returnRegion = null,
  returnFacility = null,
} = {}) {
  const pack = authoredPack(troubleId);
  let current = { regionId: originRegion, facilityId: originFacility };
  const steps = [];
  const discoveries = [];
  if (openingChoiceId) {
    const hearingRegion = pack.hearing.targetLocation;
    const hearingFacility = pack.hearing.targetFacilityId;
    if (current.regionId !== hearingRegion) {
      steps.push(moveRegionStep(hearingRegion));
      current = {
        regionId: hearingRegion,
        facilityId: catalog.defaultArrivalFacility[hearingRegion] ?? '',
      };
    }
    if (current.facilityId !== hearingFacility) {
      steps.push(moveLocalStep(hearingFacility, hearingRegion));
      current = { regionId: hearingRegion, facilityId: hearingFacility };
    }
    steps.push(authoredOpeningStep(troubleId, openingChoiceId, current));
  }
  for (const leadId of leadIds) {
    const mapped = authoredLeadAndEvidenceSteps(troubleId, leadId, current);
    steps.push(...mapped.steps);
    discoveries.push(mapped.discoveryId);
    current = mapped.end;
  }
  if (returnRegion && current.regionId !== returnRegion) {
    steps.push(moveRegionStep(returnRegion, returnFacility ?? catalog.defaultArrivalFacility[returnRegion] ?? ''));
    current = {
      regionId: returnRegion,
      facilityId: returnFacility ?? catalog.defaultArrivalFacility[returnRegion] ?? '',
    };
  }
  if (returnFacility && current.facilityId !== returnFacility) {
    steps.push(moveLocalStep(returnFacility, current.regionId));
    current = { ...current, facilityId: returnFacility };
  }
  return { steps, discoveries, end: current };
}
function moveLocalStep(facilityId, regionId) {
  const actionId = `MOVE_LOCAL:${facilityId}`;
  return commandStep(actionId, 'MOVE', { moveId: actionId }, { regionId, facilityId });
}
function moveRegionStep(regionId, facilityId = catalog.defaultArrivalFacility[regionId] ?? '') {
  const actionId = `MOVE_REGION:${regionId}`;
  return commandStep(actionId, 'MOVE', { moveId: actionId }, { regionId, facilityId });
}
function outcome(m, source, notes = '') {
  m.classification = 'COMMAND_OUTCOME';
  m.status = 'OUTCOME';
  m.implementationSource = source;
  m.notes = notes || 'the state change is emitted by the preceding command resolver and must not be executed twice';
  if (!m.resultingState) {
    if (m.legacyRuntimeAction === 'RESOLVE_MISSION') {
      m.resultingState = `${m.troubleId || 'mission'} terminal state, reward, EXP, Lv and SP persisted exactly once by the preceding mission command`;
    } else if (m.legacyRuntimeAction === 'WORLD_EVENT') {
      m.resultingState = `${m.troubleId || 'world event'} suppression/terminal state and its causal world flags persisted by the world resolver`;
    } else if (m.legacyRuntimeAction === 'COLLAPSE_RESCUE') {
      m.resultingState = 'collapse, named rescuer, treatment, elapsed time and treatment debt persisted by player-collapse-resolver';
    } else {
      m.resultingState = 'preceding command result persisted; no duplicate player command';
    }
  }
  return m;
}
function narrative(m, source, notes = '') {
  m.classification = 'NARRATIVE_OUTCOME';
  m.status = 'OUTCOME';
  m.implementationSource = source;
  m.resultingState ||= `no additional command-side mutation; continuity retained for: ${m.legacyDescription}`;
  m.notes = notes || 'this is continuity/aftermath of an adjacent implemented command, not a second player action';
  return m;
}
function unresolved(m, reason, classification = 'REPLACED_INVALID', notes = '') {
  m.classification = classification; m.status = 'UNRESOLVED'; m.unresolvedReason = reason; m.notes = notes; return m;
}
function productById(id) { return runtimeProducts.find((p) => p.productId === id); }
function inferFood(row) {
  const region = row['場所']; const cost = num(row['支出']); const desc = row['行動'];
  const candidates = runtimeProducts.filter((p) => p.region === region && ['meal','provision'].includes(p.kind));
  let chosen = candidates.find((p) => p.price === cost && (/携帯食|保存食/u.test(desc) ? p.kind === 'provision' : p.kind === 'meal'));
  if (!chosen && cost > 0) chosen = candidates.find((p) => p.price === cost);
  if (!chosen && /携帯食|保存食/u.test(desc)) chosen = productById(defaultProvisionByRegion[region]);
  if (!chosen) chosen = productById(catalog.defaultMealByRegion[region]) ?? productById(defaultProvisionByRegion[region]);
  return chosen ?? null;
}
function jobAllowedStart(job, preferred) {
  const options = [];
  for (const [from, to] of job.windows) {
    const latest = to - job.minutes;
    if (latest < from) continue;
    options.push(Math.max(from, Math.min(preferred ?? from, latest)));
  }
  return options.sort((a,b) => Math.abs(a - preferred) - Math.abs(b - preferred))[0] ?? null;
}
function assignJob(row) {
  const explicit = /\b(JOB-[A-Z]+-\d{2})\b/u.exec(row['行動'])?.[1];
  if (explicit) {
    const found = catalog.jobs.find((j) => j.jobId === explicit);
    if (found) return { ...found, start: jobAllowedStart(found, timeMinute(row['開始'])) };
  }
  const candidates = catalog.jobs.filter((j) => j.region === row['場所']);
  const preferred = timeMinute(row['開始']) ?? 720, oldWage = num(row['収入']), oldDur = durationMinutes(row['開始'], row['終了']) ?? 120;
  return candidates.map((j) => {
    const start = jobAllowedStart(j, preferred);
    if (start == null) return null;
    const conditionPenalty = j.condition ? 5 : 0;
    const score = Math.abs(j.wage - oldWage) * 12 + Math.abs(j.minutes - oldDur) / 20 + Math.abs(start - preferred) / 30 + conditionPenalty;
    return { ...j, start, score };
  }).filter(Boolean).sort((a,b) => a.score - b.score || a.jobId.localeCompare(b.jobId))[0] ?? null;
}

function splitCanonicalRest(minutes) {
  if (!Number.isFinite(minutes) || minutes < 30) return null;
  let remaining = Math.floor(minutes / 30) * 30;
  const parts = [];
  for (const duration of [...runtimeRestDurations].sort((a, b) => b - a)) {
    while (duration <= remaining) {
      parts.push(duration);
      remaining -= duration;
    }
  }
  return remaining === 0 && parts.length ? parts : null;
}

const workFlavor = /皿洗い|麻袋|麦刈り|荷運び|荷役|棚卸|船具|帆布|厨房|炊事|薪|仕分|水汲み|掃除|図面|鉱石|仕事|労働/u;
const arrivalFlavor = /到着後|旅装を整え|宿・情報屋|街の様子|入口|着いて|到着/u;
const battleFlavor = /主要戦闘|戦闘|撃破|退け|護衛を倒|衛兵像|魔物|狼|甲虫|スライム/u;
const compositeFlavor = /救出.*(戦闘|撃破)|足跡を追い.*救出|調査.*戦闘|購入済み.*返す/u;

const publicLifeSceneById = new Map(
  AUTHORED_PUBLIC_LIFE_NETWORK_INTERNALS.SCENES.map((scene) => [scene.id, scene]),
);

const EXACT_PUBLIC_LIFE_COMMAND_ROWS = Object.freeze({
  'VR2-D02-06': Object.freeze({
    sceneId: 'village-belonging', choiceId: 'accept_ordinary_place',
    requiredState: 'T01 resolved; Finn alive; at the ordinary village square on Day2-3',
    resultingState: 'villagePlaceOffered; villageTrust+=1; Mira/Finn/Eda knowledge and GOAP updated',
  }),
  'VR2-D04-02': Object.freeze({
    sceneId: 'village-safety-practice', choiceId: 'practice_and_report',
    requiredState: 'Finn/Jill alive; at LOC_FARM_NORTH_FENCE on Day4-10',
    resultingState: 'shield practice, departure notice and nonlethal T03 return plan recorded; three NPC plans updated',
  }),
  'VR2-D09-02': Object.freeze({
    sceneId: 'village-exhaustion-choice', choiceId: 'fetch_water_while_exhausted',
    requiredState: 'Day9; fatigue already critical after the Day8 watch; Eda alive and near LOC_FARM_WELL',
    resultingState: 'hunger+=8; fatigue+=22; collapse risk reached in an inspectable place; Eda first-aid GOAP active',
  }),
  'VR2-D11-07': Object.freeze({
    sceneId: 'port-working-trust', choiceId: 'compare_open_ledger',
    requiredState: 'Glenn alive; player has completed an ordinary port shift; at LOC_TRADE_PORT on Day11-19',
    resultingState: 'reputation+=1; wage ledger shared; worker blame separated from smuggling; Glenn GOAP updated',
  }),
  'VR2-D21-07': Object.freeze({
    sceneId: 'capital-orphanage-contact', choiceId: 'help_without_wage',
    requiredState: 'Matilda and Noah alive/present; at LOC_CAP_ORPHANAGE on Day21-23',
    resultingState: 'unpaid care performed; one free meal; land number copied without using children as witnesses',
  }),
  'VR2-D22-05': Object.freeze({
    sceneId: 'capital-record-request', choiceId: 'request_records_not_headline',
    requiredState: 'orphanage land number known; Petra alive/present at LOC_CAP_NEWSPAPER on Day22-24',
    resultingState: 'land archive requested; story held from print; petraTrust+=1; source-preservation GOAP active',
  }),
  'VR2-D33-08': Object.freeze({
    sceneId: 'trade-record-post', choiceId: 'send_copy_to_petra',
    requiredState: 'T04 rescue complete; Luca copy held; Glenn and Petra alive; at LOC_TRADE_INN on Day33-34',
    resultingState: 'sealed Luca copy sent separately to Petra; Glenn/Petra knowledge and delivery GOAP updated',
  }),
  'VR2-D50-04': Object.freeze({
    sceneId: 'capital-food-relay', choiceId: 'link_caregivers_directly',
    requiredState: 'Matilda and Samira alive; at LOC_CAP_ORPHANAGE on Day50-61',
    resultingState: 'food counts and shortages can pass directly; incitement graffiti recorded without amplification',
  }),
  'VR2-D54-07': Object.freeze({
    sceneId: 'trade-forest-parts-relay', choiceId: 'send_mina_parts_with_glenn',
    requiredState: 'Mina drain parts and Niv water plan known; Glenn alive; ordinary freight operating on Day54-55',
    resultingState: 'drain parts sent by ordinary freight; forest work-crew delivery roster and Glenn GOAP created',
  }),
  'VR2-D62-06': Object.freeze({
    sceneId: 'capital-shelter-distribution', choiceId: 'distribute_shelters',
    requiredState: 'T16 active; food relay contact exists; Matilda/Samira/Noah alive; Day62-65',
    resultingState: 'shelters distributed by consent; shop and child records separated; children kept off courier duty',
  }),
  'VR2-D64-02': Object.freeze({
    sceneId: 'capital-fair-supply', choiceId: 'publish_normal_prices',
    requiredState: 'T16 active; ordinary market stock and at least one human and one ajin seller available; Day64-73',
    resultingState: 'public price board, normal-price delivery and existing-stock kitchen plan active',
  }),
  'VR2-D69-04': Object.freeze({
    sceneId: 'capital-inclusive-care', choiceId: 'one_intake_with_consent',
    requiredState: 'distributed shelter plan; Matilda/Noah/Samira alive; Day69-77',
    resultingState: 'one child intake, consent-first shelter record and non-coercive Noah aftercare established',
  }),
  'VR2-D70-02': Object.freeze({
    sceneId: 'capital-factual-edition', choiceId: 'print_facts_trace_funds',
    requiredState: 'T12/T14 records and T16 paid-headline evidence preserved; Petra alive; Day70-74',
    resultingState: 'correction, ceasefire letter, price table and incitement funding diagram published with sources',
  }),
  'VR2-D72-06': Object.freeze({
    sceneId: 'capital-guard-restraint', choiceId: 'delay_collective_raid',
    requiredState: 'T16 active; Victor/Orka/Samira alive; at LOC_CAP_LOWER_INN on Day72-76',
    resultingState: 'collective raid delayed; nonlethal separation, bilateral rescue and living courier capture assigned',
  }),
  'VR2-D74-06': Object.freeze({
    sceneId: 'capital-public-hearing', choiceId: 'request_open_hearing',
    requiredState: 'king rescued in T11; T16 funding/order/false-blame evidence preserved; Day74-78',
    resultingState: 'open hearing requested; collective punishment rejected; Petra/Victor/Samira plans updated',
  }),
  'VR2-D77-05': Object.freeze({
    sceneId: 'capital-aftercare', choiceId: 'feed_listen_publish',
    requiredState: 'T16 intervention complete; Matilda/Noah/Samira/Petra alive; Day77-79',
    resultingState: 'meals and recovery separated from testimony; cited ledger edition printed; lone-hero headline rejected',
  }),
  'VR2-D80-04': Object.freeze({
    sceneId: 'capital-network-handoff', choiceId: 'keep_contacts_open',
    requiredState: 'capital aftermath documented; Matilda/Samira/Petra alive; at LOC_CAP_OFFICE on Day80',
    resultingState: 'three civilian nodes hold one another\'s contacts; network works without player; personal obligations audited',
  }),
  'VR2-D81-07': Object.freeze({
    sceneId: 'village-recommendation', choiceId: 'take_reference_not_registry',
    requiredState: 'Day9 debt repaid; Garo alive; at LOC_FARM_CHIEF on Day81',
    resultingState: 'identity reference issued without binding village registration; villageTrust+=1; Garo belief/GOAP updated',
  }),
  'VR2-D82-04': Object.freeze({
    sceneId: 'village-homecoming-practice', choiceId: 'teach_preparation',
    requiredState: 'Finn/Jill/Nene alive; at LOC_FARM_NORTH_FENCE on Day82',
    resultingState: 'Finn preparation checklist and return notice agreed; Nene receives world-tree recovery report',
  }),
  'VR2-D84-07': Object.freeze({
    sceneId: 'capital-independent-status', choiceId: 'independent_person_record',
    requiredState: 'T17 resolved; personal obligations audited; at LOC_CAP_OFFICE on Day84',
    resultingState: 'independent temporary identity issued; summoned-property status rejected in public record',
  }),
  'VR2-D85-07': Object.freeze({
    sceneId: 'village-closing-table', choiceId: 'share_letters_at_table',
    requiredState: 'homecoming complete; Eda/Finn/Mira/Garo alive; at LOC_FARM_INN on Day85',
    resultingState: 'closing meal shared; distant NPC letters read; mutual-aid work continues without the player',
  }),
});

function exactPublicLifeOverride(m) {
  const spec = EXACT_PUBLIC_LIFE_COMMAND_ROWS[m.legacyRowId];
  if (!spec) return null;
  const scene = publicLifeSceneById.get(spec.sceneId);
  const entry = scene?.choices.find((choice) => choice.id === spec.choiceId);
  if (!scene || !entry) throw new Error(`public-life action missing: ${spec.sceneId}/${spec.choiceId}`);
  const id = AUTHORED_PUBLIC_LIFE_NETWORK_INTERNALS.actionId(spec.sceneId, spec.choiceId);
  m.regionId = scene.location;
  m.facilityId = scene.facilityId;
  m.npcIds = entry.npcIds.join('|');
  m.requiredState = spec.requiredState;
  m.resultingState = spec.resultingState;
  m.implementationSource = 'src/server/trpg/content/authored-public-life-network.js';
  m.resolutionMethod = 'EXACT_AUTHORED';
  return resolvedPlayer(m, id);
}

function narrativeSpec(source, requiredState, resultingState, notes) {
  return Object.freeze({ source, requiredState, resultingState, notes });
}

const SRC = Object.freeze({
  t01Day2: 'src/server/trpg/content/authored-mission-flow-day1-t01-village-night.js through authored-mission-flow-day2-day8-village-watch.js',
  t02: 'src/server/trpg/content/authored-mission-flow-t02-granary-dawn.js + authored-mission-t02-granary-continuity.js + authored-mission-flow-core.js',
  collapse: 'src/server/trpg/resolvers/player-collapse-resolver.js + src/server/trpg/content/canonical-social-obligations.js',
  t03: 'src/server/trpg/content/authored-mission-flow-human-companion-causality.js + authored/missions/t03-red-fang-migration.js',
  labour: 'src/server/trpg/content/canonical-regional-labour.js + canonical-job-time-policy.js',
  t04: 'src/server/trpg/content/authored/missions/t04-pilgrim-transfer-disappearance.js + authored-mission-flow-human-route-t04-pilgrim-relay.js',
  t05: 'src/server/trpg/content/authored-mission-flow-core.js + authored-mission-flow-t02-to-t05-bridge.js',
  t06: 'src/server/trpg/content/authored/missions/t06-port-labor-unrest.js',
  t07: 'src/server/trpg/content/authored/missions/t07-runaway-elf-trafficking.js + authored-mission-flow-t05-to-t07-bridge.js',
  t09: 'src/server/trpg/content/authored/missions/t09-dwarf-mine-collapse.js',
  t11: 'src/server/trpg/content/authored/missions/t11-capital-assassination-plot.js + authored-mission-flow-t11-witness-network.js',
  t12: 'src/server/trpg/content/authored/missions/t12-northern-fortress-false-flag.js',
  t13: 'src/server/trpg/content/authored/missions/t13-forest-king-slime-world-tree-collapse.js',
  t14: 'src/server/trpg/content/authored/missions/t14-crime-city-arms-smuggling.js',
  t16: 'src/server/trpg/content/authored/missions/t16-capital-persecution-riot.js + authored-mission-flow-t16-runtime.js',
  publicLife: 'src/server/trpg/content/authored-public-life-network.js',
  travel: 'tools/trpg-sim/lib/player-journey.mjs availableTravelActions/arrival state',
  world: 'tools/trpg-sim/lib/player-journey.mjs trouble gates/consequences + authored mission world effects',
  equipment: 'src/server/trpg/game/service.js EQUIP/SHOP/SERVICE command outcomes',
});

const EXACT_NARRATIVE_OUTCOME_ROWS = Object.freeze({
  'VR2-D04-06': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:VILLAGE_SAFETY_PRACTICE:practice_and_report completed',
    'Finn knows the departure/return procedure and Garo/Jill hold the follow-up plan',
    'the promise is the interpersonal consequence of the earlier public safety-practice choice, not a second hidden conversation',
  ),
  'VR2-D05-05': narrativeSpec(
    SRC.t02,
    'T02 dawn scene and oil-track evidence recorded; Thoma alive at the granary',
    'remaining seed wheat is counted in the public fire record; accident hypothesis is no longer dominant',
    'the actual evidence commands are VR2-D05-02/04; this row is their granary aftermath with Thoma',
  ),
  'VR2-D06-04': narrativeSpec(
    SRC.t01Day2,
    'Day2 merchant Riona chain completed and T02 contract gap recorded',
    'the grain merchant identity can be cross-checked in the trade-city leg',
    'Riona was already encountered through a public Day2 authored scene; this row records information carried forward',
  ),
  'VR2-D06-06': narrativeSpec(
    SRC.t02,
    'T02 contract evidence acquired; hired-hand evidence still outstanding',
    'villagers preserve competing hypotheses until the third evidence class is verified',
    'no new clue or trust is awarded; it is the stated investigation policy between two real evidence commands',
  ),
  'VR2-D07-07': narrativeSpec(
    SRC.t02,
    'T02 public-prosecution resolution complete and ordinary granary labour available',
    'burned granary cleanup continues under the ordinary work roster without changing the T02 route',
    'the paid shift is carried by VR2-D07-05; this is post-resolution cleanup continuity with no invented wage',
  ),
  'VR2-D09-06': narrativeSpec(
    SRC.collapse,
    'collapse resolver selected Eda at the well and created DEBT:EDA:ITM014',
    'player wakes after treatment; herb debt remains 6G; further work is declined for the day',
    'the rescue, treatment, time loss and debt are resolver output of VR2-D09-04/05, not a voluntary second action',
  ),
  'VR2-D10-02': narrativeSpec(
    `${SRC.collapse} + ${SRC.labour}`,
    'Day9 collapse aftercare active; bakery/light-work facility available',
    'only light duties are described; no extra wage or recovery beyond canonical rows is added',
    'recovery-day flavor is bounded by the prior collapse consequence and the canonical paid work row later that day',
  ),
  'VR2-D10-07': narrativeSpec(
    `${SRC.publicLife} + ${SRC.t03}`,
    'village safety-practice choice completed; T03 evidence indicates displacement rather than predation',
    'Jill preserves a forest-facing return corridor; no plan to lure the pack through the village',
    'the policy follows already-recorded Jill/Finn/Garo plans and is realized by the later canonical T03 resolution',
  ),
  'VR2-D11-05': narrativeSpec(
    `${SRC.travel} + ${SRC.labour}`,
    'arrival in trade city complete; at the canonical inn/port labour area',
    'port geography and the real JOB-TRADE windows are known; no additional job is created',
    'this is orientation before VR2-D11-06 and the public Glenn introduction',
  ),
  'VR2-D12-04': narrativeSpec(
    SRC.t04,
    'ordinary port passengers present; T04 not yet terminal',
    'pilgrim disappearance rumor is recorded as a lead only; no T04 evidence/progress is awarded',
    'formal T04 opening and evidence remain the exact authored commands on Day32',
  ),
  'VR2-D12-06': narrativeSpec(
    SRC.labour,
    'trade-city fish-market/port work remains inside the canonical job window',
    'cheap dried-fish preparation and next-shift intent recorded with no wage, stock or provision fabricated',
    'the next paid work command remains its separate WORK:FACILITY row',
  ),
  'VR2-D13-02': narrativeSpec(
    `${SRC.labour} + ${SRC.t14}`,
    'ordinary customs paperwork available; T14 has not been formally opened',
    'an uninspected cargo mark is remembered as an unverified precursor, not canonical T14 evidence',
    'later T14 authored customs-number evidence performs the actual state change',
  ),
  'VR2-D13-04': narrativeSpec(
    SRC.t14,
    'unverified customs mark observed; warehouse exterior publicly visible',
    'matching crate is noted without seizure or T14 progress',
    'this preserves the early chronological seed while the canonical authored lead remains later and explicit',
  ),
  'VR2-D13-06': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:PORT_WORKING_TRUST:compare_open_ledger completed',
    'Glenn has explained that wage cuts came from the allocation system, not individual workers',
    'the meal is an interpersonal consequence of the public port-working choice; food cost remains its adjacent EAT row',
  ),
  'VR2-D14-02': narrativeSpec(
    SRC.labour,
    'ordinary fish-market work and later canonical paid shift available',
    'market familiarity increases narratively; no hidden wage, trust point or stock is added',
    'the actual economy remains in canonical WORK/EAT rows',
  ),
  'VR2-D14-06': narrativeSpec(
    `${SRC.t05} + ${SRC.t14}`,
    'port rumor sources present; poison and weapon investigations remain separate authored flows',
    'two rumors are filed separately and grant no evidence until their respective public actions occur',
    'this row prevents fuzzy cross-incident mapping rather than pretending either investigation completed',
  ),
  'VR2-D15-02': narrativeSpec(
    `${SRC.labour} + ${SRC.t14}`,
    'customs work available; T14 first-transaction evidence not yet verified',
    'unmarked crate is observed but not seized and grants no canonical evidence',
    'the actual Ratika/Ernesto/Simon evidence commands occur later',
  ),
  'VR2-D15-04': narrativeSpec(
    SRC.t14,
    'unmarked crate observed outside formal T14 flow',
    'ship, tag and buyer codes retained only as a precursor note; cargo remains in circulation',
    'non-seizure is intentional and does not fabricate an evidence ID',
  ),
  'VR2-D15-06': narrativeSpec(
    SRC.publicLife,
    'public port-working trust choice completed; Glenn knows the player as a worker',
    'workersNotCollectivelyBlamed remains the governing constraint for T06/T14',
    'the promise is already stored as a normal public-life world flag and Glenn goal',
  ),
  'VR2-D17-07': narrativeSpec(
    `${SRC.labour} + ${SRC.t05}`,
    'crime-city kitchen work and T05 transport-mark evidence complete',
    'Nicolas sister rumor points back to the protection branch but grants no new canonical evidence',
    'the paid shift is separate; the rumor is checked by later authored T05 actions',
  ),
  'VR2-D18-03': narrativeSpec(
    SRC.travel,
    'preceding MOVE_REGION:交易都市 succeeded',
    'arrival continuity complete; no duplicate travel time or cost',
    'the legacy row repeats the already-executed regional movement',
  ),
  'VR2-D18-05': narrativeSpec(
    SRC.t07,
    'port brokers publicly audible; T07 not yet terminal',
    'runaway-elf trafficking is recognized as a rumor only; authored T07 hearing remains uncompleted',
    'the route opens the actual T07 sale-route hearing later at the forest camp',
  ),
  'VR2-D18-07': narrativeSpec(
    SRC.t05,
    'Nicolas contact and sister rumor known; no coercive bargain made',
    'protection intent is recorded narratively; the actual protected-testimony state is applied only by T05 resolution',
    'this avoids granting resolution effects before the authored choice',
  ),
  'VR2-D19-03': narrativeSpec(
    SRC.travel,
    'preceding MOVE_REGION:田園の村 succeeded',
    'arrival inventory/notice-board check complete without a second travel action',
    'ordinary return continuity only',
  ),
  'VR2-D19-07': narrativeSpec(
    SRC.t03,
    'T03 authored evidence and the Finn→Eda→Garo→Jill relay exist',
    'livestock shelter timing is shared through the already-inspectable village GOAP chain',
    'no new NPC flag is invented; this narrates implementation already stored by the human-companion causality module',
  ),
  'VR2-D20-09': narrativeSpec(
    SRC.t03,
    'T03 battle/resolution complete and guaranteed fang sale recorded',
    'Finn helps repair the watch fence; Jill explains the sold material use without duplicating sale income',
    'post-resolution relationship scene only; material inventory remains governed by VR2-D20-08',
  ),
  'VR2-D22-02': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:CAPITAL_ORPHANAGE_CONTACT:help_without_wage selected',
    'unpaid child care and one free meal are part of the public action result',
    'the source spans the legacy introduction and next-morning helping beat; no second free meal is added',
  ),
  'VR2-D22-04': narrativeSpec(
    SRC.publicLife,
    'orphanage contact action completed',
    'orphanageLandNumberCopied is known without treating a child as a clue dispenser',
    'the following Petra action performs the independent archive request',
  ),
  'VR2-D23-05': narrativeSpec(
    `${SRC.labour} + ${SRC.t12}`,
    'ordinary freight handling available; northern-fort destination visible on public tags',
    'fort destination is remembered as a precursor only; no T12 evidence is granted',
    'formal T12 evidence remains in the authored mission flow',
  ),
  'VR2-D23-09': narrativeSpec(
    `${SRC.publicLife} + ${SRC.t06}`,
    'Glenn public working-trust choice and port allocation ledger exist',
    'wage-cut order can be compared later through the T06 wage ledger evidence',
    'the authored T06 investigation performs the actual evidence update',
  ),
  'VR2-D25-06': narrativeSpec(
    SRC.t09,
    'ordinary cargo labels visible; Mina alive; T09 not terminal',
    'machine-parts destination motivates the dwarf trip but grants no T09 evidence',
    'the exact T09 authored opening/evidence begins after arrival',
  ),
  'VR2-D26-06': narrativeSpec(
    SRC.world,
    'T09 start day reached and mine closure timeline event active',
    'mine-closure alert received; next regional move remains an explicit command',
    'world timeline disclosure only; no hidden mission resolution progress',
  ),
  'VR2-D29-06': narrativeSpec(
    `${SRC.t09} + ${SRC.equipment}`,
    'T09 rescue/resolution complete; Bronrun and Mina alive; current shield owned',
    'repair/arm-shield comparison discussed; purchase and discount both explicitly deferred',
    'no equipment, gold or favor value changes, so no shop command is emitted',
  ),
  'VR2-D31-06': narrativeSpec(
    SRC.t04,
    'Ada disappearance/world chronology exists; player at border inn',
    'missing-person list aligns the date as a lead only; T04 opening/evidence remains Day32 public actions',
    'the ledger observation does not claim canonical T04 evidence early',
  ),
  'VR2-D33-05': narrativeSpec(
    SRC.travel,
    'VR2-D33-02 and VR2-D33-04 regional moves succeeded',
    'border→temple→trade-city travel already accounted once',
    'legacy duplicate itinerary text adds no second movement',
  ),
  'VR2-D36-02': narrativeSpec(
    SRC.t05,
    'T05 sister-location and coercion evidence known; protect_nicolas_and_treat remains selectable',
    'sister protection is staged without applying T05 resolution effects early',
    'the canonical resolution later atomically records protection, testimony and treatment',
  ),
  'VR2-D37-02': narrativeSpec(
    SRC.t05,
    'bedside symptoms and antidote formula evidence already acquired; Mariel contacted',
    'symptoms rechecked with no duplicate evidence or medicine purchase',
    'medical verification is preparation for the authored battle/resolution row',
  ),
  'VR2-D37-04': narrativeSpec(
    SRC.t05,
    'Nicolas coercion, poison and serving-record evidence groups acquired',
    'evidence package assembled without inventing a fourth T05 evidence class',
    'the actual evidence IDs remain inspectable in the prior authored commands',
  ),
  'VR2-D37-06': narrativeSpec(
    `${SRC.labour} + ${SRC.t05}`,
    'ordinary port work completed and T05 evidence package ready',
    'formal manor access is scheduling continuity for the next public T05 command',
    'no separate permission token exists, so none is fabricated',
  ),
  'VR2-D38-09': narrativeSpec(
    `${SRC.publicLife} + ${SRC.t06}`,
    'Glenn working-trust record exists and T05 has been resolved without collective blame',
    'nonviolent port negotiation remains the selected T06 intent; actual route choice is later',
    'this is planning continuity, not premature T06 resolution',
  ),
  'VR2-D39-07': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:TRADE_RECORD_POST:send_copy_to_petra completed and delivery window elapsed',
    'Petra confirms custody and continues source preservation before publication',
    'the cross-region send was the public command; this is its delivery outcome',
  ),
  'VR2-D49-08': narrativeSpec(
    SRC.t11,
    'T11 public-conspiracy resolution command complete; king and witnesses alive',
    'king rescued while summon-concealment evidence remains public and unwithdrawn',
    'direct consequence of the selected authored T11 resolution route',
  ),
  'VR2-D50-02': narrativeSpec(
    `${SRC.labour} + ${SRC.t11}`,
    'T11 injury aftermath active; canonical stable/porter work available',
    'only light loading is described; no extra wage or healing is added',
    'the actual paid work and recovery resources remain their separate canonical rows',
  ),
  'VR2-D50-06': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:CAPITAL_FOOD_RELAY:link_caregivers_directly completed',
    '排斥落書きの位置と時刻を記録し、文言自体は増幅しない',
    'the chosen food-relay action stores ajinGraffitiRecordedWithoutAmplification and NPC plans',
  ),
  'VR2-D54-06': narrativeSpec(
    SRC.t13,
    'T13 elf-message and Niv water-route evidence already acquired; player rests during the regional itinerary',
    'two independent records are compared without granting a new evidence ID',
    'the canonical T13 evidence remains in its authored actions; this row is cross-checking continuity',
  ),
  'VR2-D55-07': narrativeSpec(
    `${SRC.t14} + ${SRC.t06}`,
    'T14 coordinated seizure resolution complete and T06 nonviolent labour compact active',
    'seized weapons remain evidence and cannot be reassigned to collective suppression of workers',
    'the constraint follows the two authored route effects and does not create a second resolution',
  ),
  'VR2-D56-08': narrativeSpec(
    `${SRC.labour} + ${SRC.publicLife}`,
    'forest work shift and regular-freight parts delivery completed',
    'camp cooking and next-day crew assignment continue with no extra wage or free inventory',
    'the paid work and causal delivery are already separate public commands',
  ),
  'VR2-D57-05': narrativeSpec(
    SRC.t13,
    'T13 bypass/restoration evidence acquired; battle intentionally deferred until Day58',
    'equipment, bandages and retreat route checked; no HP, item or equipment is fabricated',
    'static ledger preserves the rest/eat rows that provide actual recovery',
  ),
  'VR2-D58-09': narrativeSpec(
    SRC.t13,
    'T13 battle and sever-core resolution complete; T18/T19 suppression world events evaluated',
    'river and world-tree recovery are visible; no duplicate EXP, reward or incident change',
    'direct aftermath of the authored resolution and two explicit WORLD_EVENT rows',
  ),
  'VR2-D59-08': narrativeSpec(
    `${SRC.t06} + ${SRC.t14} + ${SRC.world}`,
    'port cooperative/smuggling watch active; T14 flow stopped; T15 gate evaluated as suppressed',
    'Glenn reports that an operating port refused the foreign contract without player-only intervention',
    'this is an NPC report of existing world effects, not a new T15 resolution action',
  ),
  'VR2-D60-09': narrativeSpec(
    `${SRC.t13} + ${SRC.labour}`,
    'T13 drain apparatus succeeded and ordinary dwarf scale-work remains available',
    'Mina/Bronrun discuss reuse as civilian drainage; no new equipment, gold or skill granted',
    'technology reuse is aftermath planning rather than an invented reward',
  ),
  'VR2-D61-07': narrativeSpec(
    `${SRC.publicLife} + ${SRC.t16}`,
    'Petra source-custody contact exists and T16 timeline is approaching its active window',
    'increased incitement notices are delivered as a warning only; T16 opening remains the Day62 public action',
    'no T16 evidence or progress is granted early',
  ),
  'VR2-D63-04': narrativeSpec(
    `${SRC.t12} + ${SRC.t14} + ${SRC.t16}`,
    'T12 absence proof and T14 buyer records preserved; T16 paid-headline evidence acquired',
    'the Blackridge weapons claim fails chronological cross-check but adds no seventh T16 evidence group',
    'the underlying canonical evidence IDs remain the source of truth',
  ),
  'VR2-D63-06': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:CAPITAL_SHELTER_DISTRIBUTION:distribute_shelters completed',
    'shop roster is preserved separately before any public rebuttal',
    'the selected public action stores shopRosterPreservedSeparately and Samira/Matilda/Noah plans',
  ),
  'VR2-D64-06': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:CAPITAL_FAIR_SUPPLY:publish_normal_prices completed',
    'first scuffle separated without collective blame; no battle reward or injury erasure',
    'the public market action explicitly stores firstScuffleSeparatedWithoutCollectiveBlame',
  ),
  'VR2-D65-04': narrativeSpec(
    SRC.publicLife,
    'fair-supply public action completed and village food remains on ordinary freight routes',
    'village food count requested without inventing a donation or instant answer',
    'the request is the stored villageFoodCountRequested outcome; later supply still uses real stock',
  ),
  'VR2-D65-06': narrativeSpec(
    SRC.publicLife,
    'distributed shelter plan completed',
    'children remain indoors and off courier duty; adult contact routes carry messages',
    'the public shelter action stores childrenKeptOffCourierDuty and named adult GOAP work',
  ),
  'VR2-D66-07': narrativeSpec(
    `${SRC.t14} + ${SRC.t16}`,
    'T14 smuggling ledger and T16 false-blame investigation records exist',
    'legal Blackridge cargo is listed separately from smuggled weapons; no cargo is reclassified by rumor',
    'document comparison outcome only; canonical evidence actions already supply the records',
  ),
  'VR2-D67-07': narrativeSpec(
    `${SRC.labour} + ${SRC.t16}`,
    'canonical newspaper work is available and T16 restriction-draft evidence acquired',
    'printing help offsets distribution work narratively; wage remains the separate canonical job row',
    'no free paper product or hidden income is created',
  ),
  'VR2-D68-04': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:CAPITAL_FAIR_SUPPLY:publish_normal_prices completed',
    'human and ajin merchants display the same public prices',
    'the selected public action stores publicMarketPriceBoard',
  ),
  'VR2-D68-06': narrativeSpec(
    SRC.publicLife,
    'fair-supply public action and public price board active',
    'food reaches the ajin quarter at ordinary price; no subsidy or free inventory invented',
    'the selected action stores ajinFoodDeliveredAtNormalPrice while economy rows retain actual costs',
  ),
  'VR2-D69-06': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:CAPITAL_INCLUSIVE_CARE:one_intake_with_consent completed',
    'Samira and Matilda share the consent-first rule; recipients retain choice over shelter and testimony',
    'the public action stores shelterConsentRecorded and updates all three NPC plans',
  ),
  'VR2-D70-04': narrativeSpec(
    `${SRC.t12} + ${SRC.publicLife}`,
    'T12 nonaggression route preserved and ordinary courier time elapsed',
    'Zaid ceasefire letter arrives through normal trade mail and is published with its timestamp',
    'the factual-edition public action stores zaidCeasefireLetterPublished; no instant teleport is assumed',
  ),
  'VR2-D70-06': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:CAPITAL_FACTUAL_EDITION:print_facts_trace_funds completed',
    'factual source list used instead of an inflammatory headline',
    'the choice stores factualHeadlineChosen and Petra citation work',
  ),
  'VR2-D71-02': narrativeSpec(
    SRC.publicLife,
    'fair-supply price board active',
    'the same sale rules apply to exclusionist customers; no trust or gold is changed outside real trades',
    'ordinary-market consequence of the selected public supply rule',
  ),
  'VR2-D71-04': narrativeSpec(
    `${SRC.t16} + ${SRC.publicLife}`,
    'T16 paid-headline ledger evidence and preserved receipt numbers available',
    'matching plate payments across districts are identified as funding evidence already held',
    'no duplicate evidence ID is minted',
  ),
  'VR2-D71-06': narrativeSpec(
    SRC.publicLife,
    'factual-edition choice completed and Petra holds the source chain',
    'payment record goes to source investigation rather than individual doxxing',
    'Petra goal is already publish-corrections-with-source-citations',
  ),
  'VR2-D72-02': narrativeSpec(
    `${SRC.labour} + ${SRC.world}`,
    'ordinary stable loading is available; T15 gate reports no foreign fleet arrival',
    'northern freight remains normal; no T15 action or reward is created',
    'work flavor and suppressed-world observation are kept separate from the paid work row',
  ),
  'VR2-D73-04': narrativeSpec(
    SRC.publicLife,
    'fair-supply and distributed-shelter public choices completed',
    'Samira, human merchants and Matilda coordinate one communal kitchen day',
    'the selected fair-supply action stores communityKitchenUsesExistingStock',
  ),
  'VR2-D73-06': narrativeSpec(
    SRC.publicLife,
    'community kitchen plan active',
    'one day is covered by existing stock and labour, not a fabricated donation or reward',
    'actual food and work economics remain in canonical inventory/job rows',
  ),
  'VR2-D74-02': narrativeSpec(
    SRC.publicLife,
    'factual-edition action completed with funding diagram data',
    'printing/diagram work continues without adding a second paid shift',
    'the public action already records incitementFundingDiagramPublished',
  ),
  'VR2-D74-04': narrativeSpec(
    `${SRC.t11} + ${SRC.t16} + ${SRC.publicLife}`,
    'T11 public inquiry records and T16 paid-headline/financial evidence preserved',
    'overlap between noble-faction money and T16 incitement is established from existing records',
    'cross-incident inference is cited to actual evidence; it is not a new actionId',
  ),
  'VR2-D75-02': narrativeSpec(
    SRC.publicLife,
    'fair-supply public rule active',
    'shops choosing to close are not blamed or stripped of stock',
    'the selected action stores closedShopsNotBlamed',
  ),
  'VR2-D75-06': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:CAPITAL_GUARD_RESTRAINT:delay_collective_raid completed',
    'shield-based nonlethal separation procedure rehearsed before battle',
    'the public action stores nonlethalShieldProcedureTrained and named NPC goals',
  ),
  'VR2-D76-04': narrativeSpec(
    `${SRC.publicLife} + ${SRC.t16}`,
    'nonlethal preparation complete and ACTION:MSN-T16:battle succeeded',
    'Orka and capital guards recover wounded from both sides; battle HP costs remain',
    'bilateral rescue is an explicit battle objective/preparation outcome, not a second combat',
  ),
  'VR2-D76-05': narrativeSpec(
    `${SRC.publicLife} + ${SRC.t16}`,
    'T16 battle succeeded with courierCaptureMustBeAlive plan active',
    'ringleader courier captured alive and funding ledger recovered',
    'the result comes from the battle objective and does not grant another battle reward',
  ),
  'VR2-D77-02': narrativeSpec(
    SRC.publicLife,
    'T16 intervention complete; capital-aftercare public action is scheduled the same day',
    'evacuee meals are part of the selected aftercare action; no wage claimed',
    'legacy preparation beat is folded into the later public command on VR2-D77-05',
  ),
  'VR2-D77-04': narrativeSpec(
    SRC.publicLife,
    'inclusive-care consent rule active; Noah alive after T16 intervention',
    'Noah receives recovery time that is not used as interrogation evidence',
    'the aftercare public command records noahGivenUnrecordedRecoveryTime',
  ),
  'VR2-D78-07': narrativeSpec(
    SRC.t16,
    'public-retraction/legal-accountability T16 resolution completed',
    'capital guard withdraws collective punishment and keeps named accountability records',
    'direct aftermath of the statusless authored T16 resolution action',
  ),
  'VR2-D79-02': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:CAPITAL_AFTERCARE:feed_listen_publish completed',
    'postwar issue credits multiple workers and rejects the lone-hero headline',
    'the selected public action stores singleHeroHeadlineRejected',
  ),
  'VR2-D79-04': narrativeSpec(
    SRC.world,
    'T15, T18 and T19 timeline gates evaluated after their causal incidents',
    'all three remain suppressed/not started; no reward or fake resolution command',
    'static validator must verify the incident prerequisites rather than rely on this prose row',
  ),
  'VR2-D79-06': narrativeSpec(
    SRC.publicLife,
    'capital aftercare documented; letters and obligation records available',
    'unpaid debt, borrowed items and promises are listed for Day80 handoff/Day81 repayment',
    'the following public handoff and debt command perform actual state changes',
  ),
  'VR2-D80-06': narrativeSpec(
    `${SRC.world} + tools/trpg-sim/validate-virtue-route-v3-static.mjs`,
    'all authored resolution and suppression commands have been statically accumulated',
    'T01-T14/T16/T17 terminal-success and T15/T18/T19 suppression are audit assertions only',
    'this row is validator output, never a player-accessible success button',
  ),
  'VR2-D81-03': narrativeSpec(
    SRC.travel,
    'preceding MOVE_REGION:田園の村 succeeded',
    'return inventory/notice-board continuity complete with no duplicate travel',
    'ordinary arrival narration',
  ),
  'VR2-D81-05': narrativeSpec(
    SRC.collapse,
    'DEBT:EDA:ITM014 remains 6G and player is at the village before VR2-D81-06',
    'Eda presents the original herb-debt record; balance is not changed yet',
    'the actual gold transfer occurs exactly once in VR2-D81-06 OBLIGATION:PAY command',
  ),
  'VR2-D82-06': narrativeSpec(
    SRC.publicLife,
    'PUBLIC_LIFE:VILLAGE_HOMECOMING_PRACTICE:teach_preparation completed',
    'Nene knows the world tree and river recovered',
    'the selected public action includes Nene as a participant and stores neneToldWorldTreeRecovered',
  ),
  'VR2-D83-07': narrativeSpec(
    `${SRC.t05} + ${SRC.t06} + ${SRC.world}`,
    'T05 protected-treatment route, T06 port compact and T15 suppression hold',
    'Nicolas sister has housing, the lord is active and no foreign fleet occupies port',
    'NPC/world aftermath report only; no duplicate mission resolution',
  ),
  'VR2-D84-05': narrativeSpec(
    `${SRC.publicLife} + ${SRC.labour}`,
    'cited aftermath edition exists and canonical newspaper work is available',
    'final printing help adds no extra wage beyond the adjacent WORK:FACILITY row',
    'publication content was selected earlier; this is ordinary press-room continuity',
  ),
  'VR2-D85-03': narrativeSpec(
    SRC.travel,
    'preceding MOVE_REGION:田園の村 succeeded',
    'final homecoming inventory/notice-board check complete with no duplicate travel',
    'ordinary arrival narration',
  ),
  'VR2-D85-05': narrativeSpec(
    SRC.equipment,
    'guard axe owned; at LOC_FARM_REPAIR before VR2-D85-06',
    'repair-shop conversation adds no durability or gold effect before the real service purchase',
    'VR2-D85-06 performs SERVICE_BUY:ITM220 exactly once',
  ),
});

function exactNarrativeOverride(m) {
  const spec = EXACT_NARRATIVE_OUTCOME_ROWS[m.legacyRowId];
  if (!spec) return null;
  m.requiredState = spec.requiredState;
  m.resultingState = spec.resultingState;
  m.resolutionMethod = 'EXACT_OUTCOME';
  return narrative(m, spec.source, spec.notes);
}

// These are not fuzzy description matches. Each entry is an authored path through the
// current public mission-flow registry. A selected lead action performs the real local or
// regional movement, and the following EVIDENCE action performs the investigation.
const EXACT_AUTHORED_INVESTIGATION_ROWS = Object.freeze({
  'VR2-D08-02': Object.freeze({
    troubleId: 'T03', originRegion: '田園の村', originFacility: 'LOC_FARM_SQUARE',
    openingChoiceId: 'feeding_pattern', leadIds: Object.freeze(['livestock_timeline']),
    requiredState: 'T03 active on/after Day8; Garo present at LOC_FARM_CHIEF',
    resultingState: 'T03 opening=feeding_pattern; T03-EVIDENCE-ATTACKS-MOVING-INWARD acquired',
    notes: 'the legacy track observation becomes the first canonical T03 hearing/evidence pair',
  }),
  'VR2-D08-04': Object.freeze({
    troubleId: 'T03', originRegion: '田園の村', originFacility: 'LOC_FARM_STABLE',
    leadIds: Object.freeze(['wound_pattern']),
    requiredState: 'T03 investigate active; wound_pattern unlocked by feeding_pattern',
    resultingState: 'T03-EVIDENCE-PANICKED-BITES acquired',
    notes: 'the fence inspection uses the canonical wound-pattern lead instead of a hidden long investigate action',
  }),
  'VR2-D19-05': Object.freeze({
    troubleId: 'T03', originRegion: '田園の村', originFacility: 'LOC_FARM_SQUARE',
    leadIds: Object.freeze(['forest_displacement']), returnRegion: '田園の村', returnFacility: 'LOC_FARM_SQUARE',
    requiredState: 'T03 investigate active; forest_displacement unlocked; regional Forest route available',
    resultingState: 'T03-EVIDENCE-APEX-PREDATOR-TRACKS acquired; returned to village for the Day20 intervention',
    notes: 'Jill preparation is the canonical forest-displacement evidence trip plus an explicit return',
  }),
  'VR2-D16-02': Object.freeze({
    troubleId: 'T05', originRegion: '交易都市', originFacility: 'LOC_TRADE_INN',
    openingChoiceId: 'symptoms_and_clock', leadIds: Object.freeze(['bedside_symptoms']),
    requiredState: 'T05 active on/after Day16; Nicolas present at LOC_TRADE_LORD_MANOR',
    resultingState: 'T05 opening=symptoms_and_clock; T05-EVIDENCE-POISONED-WINE-SYMPTOMS acquired',
    notes: 'the collapsed servant is examined through the canonical bedside-symptoms branch',
  }),
  'VR2-D16-04': Object.freeze({
    troubleId: 'T05', originRegion: '交易都市', originFacility: 'LOC_TRADE_LORD_MANOR',
    leadIds: Object.freeze(['antidote_formula']),
    requiredState: 'T05 investigate active; antidote_formula unlocked by bedside symptoms',
    resultingState: 'T05-EVIDENCE-ANTIDOTE-FORMULA acquired without purchasing an inflated cure',
    notes: 'price checking is represented by the authored apothecary formula investigation, not a fake purchase',
  }),
  'VR2-D16-06': Object.freeze({
    troubleId: 'T05', originRegion: '交易都市', originFacility: 'LOC_TRADE_PORT',
    leadIds: Object.freeze(['service_route']),
    requiredState: 'T05 investigate active; service_route unlocked; Nicolas remains a witness rather than a culprit token',
    resultingState: 'T05-EVIDENCE-NICOLAS-HANDLED-CUP acquired',
    notes: 'Nicolas\' work route is recorded through the current authored lead',
  }),
  'VR2-D34-04': Object.freeze({
    troubleId: 'T05', originRegion: '交易都市', originFacility: 'LOC_TRADE_INN',
    leadIds: Object.freeze(['warehouse_manifest']),
    requiredState: 'T05 investigate active; warehouse_manifest unlocked by the antidote/service evidence',
    resultingState: 'T05-EVIDENCE-CRIME-POISON-ROUTE acquired',
    notes: 'the changed hiding place is verified against the canonical warehouse manifest',
  }),
  'VR2-D36-06': Object.freeze({
    troubleId: 'T05', originRegion: '交易都市', originFacility: 'LOC_TRADE_PORT',
    leadIds: Object.freeze(['crime_ledger']),
    requiredState: 'T05 investigate active; crime_ledger unlocked by warehouse_manifest; Nicolas safe',
    resultingState: 'T05-EVIDENCE-CEDRIC-POISON-ORDER acquired from protected testimony and the order ledger',
    notes: 'the protected witness statement is bound to the authored order-ledger evidence',
  }),
  'VR2-D24-04': Object.freeze({
    troubleId: 'T06', originRegion: '交易都市', originFacility: 'LOC_TRADE_PORT',
    openingChoiceId: 'wage_deductions', leadIds: Object.freeze(['worker_paybooks']),
    requiredState: 'T06 active on/after Day24; Glenn present at LOC_TRADE_PORT',
    resultingState: 'T06 opening=wage_deductions; T06-EVIDENCE-REAL-WAGE-AND-INJURY-LOSS acquired',
    notes: 'the three-party complaints begin with the workers\' actual paybooks',
  }),
  'VR2-D24-06': Object.freeze({
    troubleId: 'T06', originRegion: '交易都市', originFacility: 'LOC_TRADE_PORT',
    leadIds: Object.freeze(['weapon_crates']),
    requiredState: 'T06 investigate active; weapon_crates unlocked by worker_paybooks',
    resultingState: 'T06-EVIDENCE-CRIME-WEAPON-SUPPLY acquired',
    notes: 'the armed intermediary is not chased blindly; the canonical crate trail is recorded',
  }),
  'VR2-D25-04': Object.freeze({
    troubleId: 'T06', originRegion: '交易都市', originFacility: 'LOC_TRADE_CUSTOMS',
    leadIds: Object.freeze(['guild_tariff']),
    requiredState: 'T06 investigate active; guild_tariff unlocked by worker_paybooks',
    resultingState: 'T06-EVIDENCE-GUILD-CONTRACT-MANIPULATION acquired',
    notes: 'the missing wage amount is traced through the canonical guild tariff ledger',
  }),
  'VR2-D27-07': Object.freeze({
    troubleId: 'T09', originRegion: 'ドワーフ洞窟', originFacility: 'LOC_DWARF_ENGINEER',
    openingChoiceId: 'support_warning', leadIds: Object.freeze(['mina_stress_calculation']),
    requiredState: 'T09 active on/after Day27; Mina present at LOC_DWARF_ENGINEER',
    resultingState: 'T09 opening=support_warning; T09-EVIDENCE-MINA-SUPPORT-STRESS-CALCULATION acquired',
    notes: 'the rejected work-stop request is grounded in Mina\'s authored stress calculation',
  }),
  'VR2-D28-04': Object.freeze({
    troubleId: 'T09', originRegion: 'ドワーフ洞窟', originFacility: 'LOC_DWARF_INN',
    leadIds: Object.freeze(['broln_inspection_note']),
    requiredState: 'T09 investigate active; broln_inspection_note unlocked by Mina evidence',
    resultingState: 'T09-EVIDENCE-BROLN-INSPECTION-WARNING acquired; no probabilistic beetle loot assumed',
    notes: 'the old beetle/rope composite is replaced by the canonical inspection warning needed for the rescue',
  }),
  'VR2-D28-07': Object.freeze({
    troubleId: 'T09', originRegion: 'ドワーフ洞窟', originFacility: 'LOC_DWARF_INN',
    leadIds: Object.freeze(['removed_safety_notice']),
    requiredState: 'T09 investigate active; removed_safety_notice unlocked by Broln evidence',
    resultingState: 'T09-EVIDENCE-NOTICE-WARNING-REMOVED acquired',
    notes: 'the shift-change rumor is verified against the physically removed safety notice',
  }),
  'VR2-D30-05': Object.freeze({
    troubleId: 'T12', originRegion: '北陵要塞', originFacility: 'LOC_FORT_GATE',
    openingChoiceId: 'arsenal_and_supply_chain', leadIds: Object.freeze(['henrik_supply_ledger', 'dwarf_maker_mark_mismatch']),
    requiredState: 'T12 active on/after Day30; Henrik present at LOC_FORT_COMMAND/SUPPLY path',
    resultingState: 'T12 opening=arsenal_and_supply_chain; supply ledger and maker-mark mismatch acquired',
    notes: 'the old single comparison is expanded into two existing evidence commands at the supply store',
  }),
  'VR2-D30-07': Object.freeze({
    troubleId: 'T12', originRegion: '北陵要塞', originFacility: 'LOC_FORT_SUPPLY',
    leadIds: Object.freeze(['kai_conscript_testimony']),
    requiredState: 'T12 investigate active; kai_conscript_testimony unlocked by the arsenal opening',
    resultingState: 'T12-EVIDENCE-KAI-CONSCRIPT-TESTIMONY acquired while Kai receives ordinary medical care',
    notes: 'helping Kai protects a living witness; it does not mark all fortress soldiers as enemies',
  }),
  'VR2-D42-04': Object.freeze({
    troubleId: 'T10', originRegion: '王都', originFacility: 'LOC_CAP_LOWER_INN',
    openingChoiceId: 'land_and_donation_history', leadIds: Object.freeze(['orphanage_foundation_copy', 'office_donation_deed']),
    requiredState: 'T10 active; Matilda present; original-document route still open before the Day43 intervention',
    resultingState: 'T10 opening=land_and_donation_history; foundation copy and original donation deed acquired',
    notes: 'Noah\'s box starts a two-document authored chain rather than creating an unregistered clue',
  }),
  'VR2-D42-06': Object.freeze({
    troubleId: 'T10', originRegion: '王都', originFacility: 'LOC_CAP_OFFICE',
    leadIds: Object.freeze(['continuous_use_ledger']),
    requiredState: 'T10 investigate active; continuous_use_ledger unlocked by the foundation copy',
    resultingState: 'T10-EVIDENCE-CONTINUOUS-USE-LAND-LEDGER acquired; investigate requirement complete',
    notes: 'the registry comparison is the canonical continuous-use ledger evidence',
  }),
  'VR2-D43-07': Object.freeze({
    troubleId: 'T11', originRegion: '王都', originFacility: 'LOC_CAP_LOWER_INN',
    openingChoiceId: 'street_witnesses_and_routes', leadIds: Object.freeze(['noah_alley_route_map']),
    requiredState: 'T11 active; T10 resolved with the orphanage witness network intact',
    resultingState: 'T11 opening=street_witnesses_and_routes; T11-EVIDENCE-NOAH-ALLEY-ROUTE-MAP acquired',
    notes: 'Noah and Kiri are witnesses with their own route knowledge, not boolean keys',
  }),
  'VR2-D49-03': Object.freeze({
    troubleId: 'T11', originRegion: '王都', originFacility: 'LOC_CAP_LOWER_INN',
    leadIds: Object.freeze(['milan_guard_shift_observation']),
    requiredState: 'T11 investigate active; Milan lead unlocked by the street-witness opening',
    resultingState: 'T11-EVIDENCE-MILAN-GUARD-SHIFT-OBSERVATION acquired',
    notes: 'capital arrival triage becomes the ordinary lower-inn guard-shift evidence action',
  }),
  'VR2-D17-05': Object.freeze({
    troubleId: 'T14', originRegion: '犯罪都市', originFacility: 'LOC_CRIME_BACK_INN',
    openingChoiceId: 'shipping_handoffs_and_port', leadIds: Object.freeze(['ratika_delivery_route']),
    requiredState: 'T14 active on/after Day15; Ratika present at LOC_CRIME_DOCK',
    resultingState: 'T14 opening=shipping_handoffs_and_port; T14-EVIDENCE-RATIKA-DELIVERY-ROUTE acquired',
    notes: 'the transport mark is registered through the authored dock route; no paid secret is invented',
  }),
  'VR2-D25-02': Object.freeze({
    troubleId: 'T14', originRegion: '交易都市', originFacility: 'LOC_TRADE_INN',
    leadIds: Object.freeze(['ernesto_customs_numbers']),
    requiredState: 'T14 investigate active; customs-number lead unlocked by Ratika evidence',
    resultingState: 'T14-EVIDENCE-ERNESTO-CUSTOMS-NUMBERS acquired',
    notes: 'the missing inspection date is the current customs-number evidence',
  }),
  'VR2-D44-07': Object.freeze({
    troubleId: 'T14', originRegion: '交易都市', originFacility: 'LOC_TRADE_PORT',
    leadIds: Object.freeze(['simon_hidden_crates']),
    requiredState: 'T14 investigate active; Simon crate lead unlocked by Ernesto evidence',
    resultingState: 'T14-EVIDENCE-SIMON-HIDDEN-CRATES acquired and kept separate from riot attribution',
    notes: 'the weapon record is preserved as T14 evidence rather than being used for collective blame',
  }),
  'VR2-D62-02': Object.freeze({
    troubleId: 'T16', originRegion: '王都', originFacility: 'LOC_CAP_LOWER_INN',
    openingChoiceId: 'expose_incitement_and_orders', leadIds: Object.freeze(['samira_marked_households']),
    requiredState: 'T16 active on/after Day62; Samira or the sealed petitions available at LOC_CAP_AJIN_QUARTER',
    resultingState: 'T16 opening=expose_incitement_and_orders; marked-household evidence acquired',
    notes: 'the first damage report identifies people to protect and never treats Samira as a key item',
  }),
  'VR2-D62-04': Object.freeze({
    troubleId: 'T16', originRegion: '王都', originFacility: 'LOC_CAP_AJIN_QUARTER',
    leadIds: Object.freeze(['petra_paid_headline_ledger']),
    requiredState: 'T16 investigate active; all late-game leads unlocked by the opening',
    resultingState: 'T16-EVIDENCE-PETRA-PAID-HEADLINE-LEDGER acquired',
    notes: 'printing work separates paid incitement from fact reporting through the authored ledger',
  }),
  'VR2-D64-04': Object.freeze({
    troubleId: 'T16', originRegion: '王都', originFacility: 'LOC_CAP_AJIN_QUARTER',
    leadIds: Object.freeze(['kiri_safe_alley_route']),
    requiredState: 'T16 investigate active; Kiri alive and safe-alley route available',
    resultingState: 'T16-EVIDENCE-KIRI-SAFE-ALLEY-ROUTE acquired',
    notes: 'walking the evacuation route is a real authored evidence action',
  }),
  'VR2-D67-05': Object.freeze({
    troubleId: 'T16', originRegion: '王都', originFacility: 'LOC_CAP_NEWSPAPER',
    leadIds: Object.freeze(['rash_restriction_drafts']),
    requiredState: 'T16 investigate active; office drafts accessible through the preserved T12/T14 record chain',
    resultingState: 'T16-EVIDENCE-RASH-RESTRICTION-DRAFTS acquired',
    notes: 'the legal/illegal cargo comparison is tested against the authored restriction drafts',
  }),
  'VR2-D72-04': Object.freeze({
    troubleId: 'T16', originRegion: '王都', originFacility: 'LOC_CAP_STABLE',
    leadIds: Object.freeze(['orka_courier_route']),
    requiredState: 'T16 investigate active; Orka courier route remains available',
    resultingState: 'T16-EVIDENCE-ORKA-COURIER-ROUTE acquired; mobilisation report can travel without using children',
    notes: 'Kai\'s report is carried through the authored adult courier network',
  }),
  'VR2-D75-04': Object.freeze({
    troubleId: 'T16', originRegion: '王都', originFacility: 'LOC_CAP_AJIN_QUARTER',
    leadIds: Object.freeze(['marked_door_chalk_roster']),
    requiredState: 'T16 investigate active; marked-door roster lead available before the Day76 intervention',
    resultingState: 'T16-EVIDENCE-MARKED-DOOR-CHALK-ROSTER acquired; all six resolution evidence groups represented',
    notes: 'the final evacuation order is checked against the perpetrators\' own target roster',
  }),
  'VR2-D39-05': Object.freeze({
    troubleId: 'T17', originRegion: '王都', originFacility: 'LOC_CAP_LOWER_INN',
    leadIds: Object.freeze(['king_second_summon_warrant']),
    requiredState: 'T17 investigate active; all leads unlocked by the Day10 opening',
    resultingState: 'T17-EVIDENCE-KING-SECOND-SUMMON-WARRANT acquired',
    notes: 'the newspaper delivery observation is verified against the king\'s authored warrant',
  }),
  'VR2-D40-02': Object.freeze({
    troubleId: 'T17', originRegion: '王都', originFacility: 'LOC_CAP_LOWER_INN',
    leadIds: Object.freeze(['seraphim_circle_corrections']),
    requiredState: 'T17 investigate active; Seraphim evidence lead available',
    resultingState: 'T17-EVIDENCE-SERAPHIM-CIRCLE-CORRECTIONS acquired',
    notes: 'the matching coordinate formula is the canonical circle-correction evidence',
  }),
  'VR2-D40-06': Object.freeze({
    troubleId: 'T17', originRegion: '王都', originFacility: 'LOC_CAP_MARKET',
    leadIds: Object.freeze(['phase_reversal_key']),
    requiredState: 'T17 investigate active; phase-reversal lead available; Seraphim/Lyra opposition cell intact',
    resultingState: 'T17-EVIDENCE-PHASE-REVERSAL-KEY acquired; all six resolution evidence groups represented',
    notes: 'handing over T04 proof produces the authored safe-shutdown key rather than a hidden success flag',
  }),
  'VR2-D35-05': Object.freeze({
    troubleId: 'T07', originRegion: '犯罪都市', originFacility: 'LOC_CRIME_BACK_INN',
    leadIds: Object.freeze(['crime_dock_manifest']),
    requiredState: 'T07 investigate active; sale_route opening chosen at the Forest camp; crime_dock_manifest unlocked',
    resultingState: 'T07-EVIDENCE-CRIME-DOCK-MANIFEST acquired; current transport handoff identified',
    notes: 'watch-change observation is bound to the authored crime-dock manifest lead',
  }),
  'VR2-D35-07': Object.freeze({
    troubleId: 'T07', originRegion: '犯罪都市', originFacility: 'LOC_CRIME_BACK_INN',
    leadIds: Object.freeze(['black_lamp_statement']),
    requiredState: 'T07 investigate active; black_lamp_statement unlocked by crime_dock_manifest',
    resultingState: 'T07-EVIDENCE-BLACK-LAMP-LYSIA-STATEMENT acquired; Lysia remains a speaking witness',
    notes: 'the back-alley familiarity row becomes the authored inn statement, not a generic trust point',
  }),
  'VR2-D47-07': Object.freeze({
    troubleId: 'T14', originRegion: '犯罪都市', originFacility: 'LOC_CRIME_INFO_STREET',
    leadIds: Object.freeze(['gordo_double_inventory', 'varo_all_buyer_ledger']),
    requiredState: 'T14 investigate active; Gordo inventory unlocked by Ratika evidence; buyer ledger unlocked by Gordo evidence',
    resultingState: 'T14 double inventory and all-buyer ledger acquired; coordinated-seizure readiness core group complete',
    notes: 'the armed obstruction is used to secure two current T14 records; T07 rescue combat remains the separate Day48 mission battle',
  }),
  'VR2-D52-08': Object.freeze({
    troubleId: 'T13', originRegion: 'エルフの隠れ里', originFacility: 'LOC_ELF_GUEST_BOUGH',
    leadIds: Object.freeze(['elina_world_tree_pain_rhythm', 'elina_root_diversion_rite']),
    requiredState: 'T13 investigate active; world-tree rhythm unlocked by Serie chronology; root rite unlocked by rhythm evidence',
    resultingState: 'T13 world-tree pain rhythm and root-diversion rite acquired with Serie/Elina participation',
    notes: 'the operation meeting records two distinct authored world-tree observations',
  }),
  'VR2-D53-06': Object.freeze({
    troubleId: 'T13', originRegion: '黒嶺連合領', originFacility: 'LOC_BLACKRIDGE_GATE',
    leadIds: Object.freeze(['nieve_flow_pulse_map']),
    requiredState: 'T13 investigate active; Nieve flow-pulse lead unlocked by the river-growth opening',
    resultingState: 'T13-EVIDENCE-NIEVE-FLOW-PULSE-MAP acquired',
    notes: 'the delivered T12 record opens an independent Blackridge waterway measurement',
  }),
  'VR2-D53-07': Object.freeze({
    troubleId: 'T13', originRegion: '黒嶺連合領', originFacility: 'LOC_BLACKRIDGE_WATERWAY',
    leadIds: Object.freeze(['nieve_blackridge_flow_log']),
    requiredState: 'T13 investigate active; Blackridge flow log unlocked by Nieve pulse map',
    resultingState: 'T13-EVIDENCE-NIEVE-BLACKRIDGE-FLOW-LOG acquired; Nieve proposes the core-lift method',
    notes: 'Nieve\'s plan is backed by the ordinary authored flow log rather than a bespoke route flag',
  }),
  'VR2-D56-06': Object.freeze({
    troubleId: 'T13', originRegion: '森', originFacility: 'LOC_FOREST_CAMP',
    leadIds: Object.freeze(['lucia_refuge_roster']),
    requiredState: 'T13 investigate active; Lucia refuge roster unlocked by the root-diversion evidence; T07 resolved',
    resultingState: 'T13-EVIDENCE-LUCIA-REFUGE-ROSTER acquired; delivered parts and people have an accountable handoff',
    notes: 'the shipment arrival is checked against the living refugee/escort roster',
  }),
  'VR2-D57-02': Object.freeze({
    troubleId: 'T13', originRegion: '森', originFacility: 'LOC_FOREST_CAMP',
    leadIds: Object.freeze(['nieve_dry_channel_bypass']),
    requiredState: 'T13 investigate active; dry-channel bypass unlocked by Nieve pulse evidence',
    resultingState: 'T13-EVIDENCE-NIEVE-DRY-CHANNEL-BYPASS acquired; current diverted without fabricating a device reward',
    notes: 'the riverbed test is the canonical Nieve bypass evidence',
  }),
  'VR2-D57-04': Object.freeze({
    troubleId: 'T13', originRegion: '森', originFacility: 'LOC_FOREST_RIVER',
    leadIds: Object.freeze(['sylfi_spirit_pool_restoration']),
    requiredState: 'T13 investigate active; T08 corridor open; Sylfi restoration lead unlocked by Elina evidence',
    resultingState: 'T13-EVIDENCE-SYLFI-SPIRIT-POOL-RESTORATION acquired; spirit-side load reduction prepared',
    notes: 'Serie\'s suppression work is represented by the authored spirit-pool restoration evidence',
  }),
});

function exactAuthoredInvestigationOverride(m) {
  const spec = EXACT_AUTHORED_INVESTIGATION_ROWS[m.legacyRowId];
  if (!spec) return null;
  const sequence = authoredInvestigationSequence(spec.troubleId, spec);
  m.troubleId = spec.troubleId;
  m.regionId = sequence.end.regionId;
  m.facilityId = sequence.end.facilityId;
  m.requiredState = spec.requiredState;
  m.resultingState = spec.resultingState
    ?? sequence.discoveries.map((id) => `evidence+=${id}`).join('; ');
  m.implementationSource = `src/server/trpg/content/authored/missions + authored-mission-flow-core.js (${authoredPack(spec.troubleId).id})`;
  return resolvedSteps(m, sequence.steps, spec.notes, 'EXACT_AUTHORED');
}

function exactAuthoredOverride(m) {
  const publicLife = exactPublicLifeOverride(m);
  if (publicLife) return publicLife;
  const exactNarrative = exactNarrativeOverride(m);
  if (exactNarrative) return exactNarrative;
  const investigation = exactAuthoredInvestigationOverride(m);
  if (investigation) return investigation;
  if (m.legacyRowId === 'VR2-D03-05') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_WELL';
    m.npcIds = 'NPC061';
    m.requiredState = 'Day1-40; daily wellside scene unused; Nene alive/present at LOC_FARM_WELL';
    m.resultingState = 't13EarlyWaterSignNoticed; t13RiverWatchAdvised; waterline evidence acquired';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-village-daily-life.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'DAILY_LIFE:DAILY_WELLSIDE:read_the_waterline');
  }

  if (m.legacyRowId === 'VR2-D31-07') {
    m.regionId = '辺境の村';
    m.facilityId = 'LOC_BORDER_INN';
    m.productId = 'ITM179';
    m.requiredState = 'at LOC_BORDER_INN; gold>=3; canonical provision stock available';
    m.resultingState = 'gold-=3; provisions.ITM179+=1 (one canonical portion)';
    m.implementationSource = 'src/server/trpg/content/canonical-world-life-actions.js';
    m.resolutionMethod = 'EXACT_CANONICAL';
    m.notes = 'the source has no canonical water-container product; v3 buys the real temple lunch provision and records ordinary water refill as lodging/meal continuity';
    return resolvedPlayer(m, 'LIFE:BUY:ITM179');
  }

  if (m.legacyRowId === 'VR2-D34-06') {
    m.regionId = '交易都市';
    m.facilityId = 'LOC_TRADE_LORD_MANOR';
    m.npcIds = 'NPC011';
    m.requiredState = 'T02 settled; T05 open; Mariel alive; T05 bridge unused; Day14-38';
    m.resultingState = 't05MarielContacted; poisoning pattern recorded; T05 hearing/bedside and antidote leads handed to canonical flow';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-t02-to-t05-bridge.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'MISSION_FLOW:T05:GRANARY_BRIDGE:call_at_manor');
  }

  if (m.legacyRowId === 'VR2-D41-09') {
    m.regionId = '王都';
    m.facilityId = 'LOC_CAP_LOWER_INN';
    m.equipmentId = 'EQP-S-0201';
    m.requiredState = 'EQP-S-0201 owned after STK-0134 purchase';
    m.resultingState = 'offHand=EQP-S-0201; former shield remains unequipped/sold by the preceding canonical commands';
    m.implementationSource = 'src/server/trpg/game/service.js EQUIP command';
    m.resolutionMethod = 'EXACT_CANONICAL';
    return resolvedPlayer(m, 'EQP-S-0201', 'EQUIP', { equipmentId: 'EQP-S-0201' });
  }

  if (m.legacyRowId === 'VR2-D46-10') {
    m.regionId = '交易都市';
    m.facilityId = 'LOC_TRADE_INN';
    m.equipmentId = 'EQP-W-0301';
    m.requiredState = 'EQP-W-0301 owned after STK-0201 purchase';
    m.resultingState = 'mainHand=EQP-W-0301; shield retained in offHand';
    m.implementationSource = 'src/server/trpg/game/service.js EQUIP command';
    m.resolutionMethod = 'EXACT_CANONICAL';
    return resolvedPlayer(m, 'EQP-W-0301', 'EQUIP', { equipmentId: 'EQP-W-0301' });
  }

  if (m.legacyRowId === 'VR2-D61-06') {
    m.regionId = '王都';
    m.facilityId = 'LOC_CAP_LOWER_INN';
    m.equipmentId = 'EQP-W-0302';
    m.requiredState = 'EQP-W-0302 owned after STK-0202 purchase';
    m.resultingState = 'mainHand=EQP-W-0302; Tier3 guard-axe progression active before T16';
    m.implementationSource = 'src/server/trpg/game/service.js EQUIP command';
    m.resolutionMethod = 'EXACT_CANONICAL';
    return resolvedPlayer(m, 'EQP-W-0302', 'EQUIP', { equipmentId: 'EQP-W-0302' });
  }
  if (m.legacyRowId === 'VR2-D01-03') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_SQUARE';
    m.requiredState = 'new-game tutorial at the wheat field; Eda alive and present';
    m.resultingState = 'tutorial orientation complete; MSN-T01 hearing complete; Finn disappearance known';
    m.implementationSource = 'src/server/trpg/game/service.js openingChoiceActions';
    return resolvedSteps(m, [
      commandStep('TUTORIAL:AWAKEN:BODY'),
      commandStep('TUTORIAL:CONTACT:MEMORY'),
      commandStep('TUTORIAL:ORIENT:VOICES'),
      commandStep('TUTORIAL:INQUIRY:MIRA'),
    ], 'legacy awakening/orientation composite split into four existing tutorial choices');
  }

  if (m.legacyRowId === 'VR2-D05-02') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_GRANARY';
    m.requiredState = 'T02 open; canonical Day5 22:00-Day7 00:00 dawn window; at granary/square';
    m.resultingState = 't02FloorEvidenceProtected; oil-stride evidence preserved; no casualty assumption introduced';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-t02-granary-dawn.js';
    return resolvedSteps(m, [
      commandStep('MISSION_FLOW:T02:T02_GRANARY_DAWN:rope_the_scene', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_GRANARY' }),
      commandStep('MISSION_FLOW:T02:T02_DAWN_SCENE_RECORD:trace_oil', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_GRANARY' }),
    ], 'live runtime places the fire at Day5 night/Day6 dawn; v3 shifts the obsolete Day5 morning row into that canonical window');
  }

  if (m.legacyRowId === 'VR2-D05-04') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_GRANARY';
    m.requiredState = 'T02 hearing available after the exclusive dawn scene closes; Thoma present at LOC_FARM_GRANARY';
    m.resultingState = 'T02 opening chosen; fire_origin evidence class verified; investigate progress 1/3';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-core.js + authored-mission-t02-granary-continuity.js';
    return resolvedSteps(m, [
      commandStep('MISSION_FLOW:granary-arson:OPENING:timeline', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_GRANARY' }),
      commandStep('T02_GRANARY:EVIDENCE:FIRE:OIL_TRACK', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_GRANARY' }),
    ], 'early oil/track investigation reuses the authored T02 dawn and granary evidence flows; schedule after the dawn-exclusive window');
  }

  if (m.legacyRowId === 'VR2-D06-02') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_GRANARY';
    m.requiredState = 'T02 investigate active; fire_origin evidence verified';
    m.resultingState = 'merchant_contract evidence class verified; investigate progress 2/3';
    m.implementationSource = 'src/server/trpg/content/authored-mission-t02-granary-continuity.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'T02_GRANARY:EVIDENCE:CONTRACT:LEDGER_GAP');
  }

  if (m.legacyRowId === 'VR2-D07-02') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_GRANARY';
    m.requiredState = 'T02 investigate active; fire_origin and merchant_contract evidence verified';
    m.resultingState = 'hired_hand evidence class verified; investigate progress 3/3; resolution step available';
    m.implementationSource = 'src/server/trpg/content/authored-mission-t02-granary-continuity.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'T02_GRANARY:EVIDENCE:HAND:BOOT_ASH');
  }

  if (m.legacyRowId === 'VR2-D07-04') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_SQUARE';
    m.requiredState = 'MSN-T02 resolution step; three evidence classes verified; T02 active';
    m.resultingState = 't02ResolutionRoute=public_prosecution_and_contract_void; Dalk protected; harvest contract void; T02 resolved; return to village';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-core.js';
    return resolvedSteps(m, [
      moveRegionStep('交易都市'),
      moveLocalStep(authoredResolutionFacility('T02'), '交易都市'),
      commandStep(authoredResolutionId('T02', 'public_prosecution_and_contract_void'), 'CHOOSE', null, { regionId: '交易都市', facilityId: authoredResolutionFacility('T02') }),
      moveRegionStep('田園の村'),
    ], 'canonical public hearing is at the trade guild; v3 expands the missing round trip instead of pretending it occurs in the village');
  }

  if (m.legacyRowId === 'VR2-D01-05') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_SQUARE';
    m.requiredState = 'MSN-T01 active; hearing complete; at LOC_FARM_EDGE; Finn alive';
    m.resultingState = 'two search clues; MON-0005 defeated; Finn rescued, escorted and reunited; MSN-T01 resolved';
    m.implementationSource = 'tools/trpg-sim/lib/player-journey.mjs + src/server/trpg/game/service.js + authored-mission-flow-human-route-entry.js';
    return resolvedSteps(m, [
      commandStep('ACTION:MSN-T01:search:tracks'),
      commandStep('ACTION:MSN-T01:search:wolf-blockade'),
      commandStep('ACTION:MSN-T01:rescue'),
      commandStep('ACTION:MSN-T01:escort'),
      commandStep('MISSION_FLOW:T01:HUMAN_ENTRY:RETURN_FINN_TO_SQUARE'),
      commandStep('ACTION:MSN-T01:decide'),
    ], 'legacy composite split into six existing public mission commands');
  }

  if (m.legacyRowId === 'VR2-D01-07') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_SQUARE';
    m.requiredState = 'MSN-T01 resolved; Finn returned alive; Day1 before midnight; at LOC_FARM_SQUARE';
    m.resultingState = 'Mira aftercare completed; bread shared with Finn; Day1 village-night scene available';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-day1-t01-square-aftercare.js';
    return resolvedSteps(m, [
      commandStep('MISSION_FLOW:T01:SQUARE_AFTERCARE:help_mira', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_SQUARE' }),
      commandStep('MISSION_FLOW:T01:SQUARE_SUPPER:share_bread', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_SQUARE' }),
    ], 'the handoff row now performs the existing post-rescue care and shared-supper choices that open the canonical Day2 chain');
  }

  if (m.legacyRowId === 'VR2-D01-10') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_INN';
    m.requiredState = 'T01 square supper complete via share_bread; at LOC_FARM_SQUARE';
    m.resultingState = 'time+=480; fatigue recovery; Mira shelter accepted; Day2 merchant arrival available';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-day1-t01-village-night.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    m.notes = 'the authored shelter choice is the route-specific public sleep action; runtime duration is canonical eight hours';
    return resolvedPlayer(m, 'MISSION_FLOW:T01:VILLAGE_NIGHT:sleep_at_miras');
  }

  if (m.legacyRowId === 'VR2-D02-02') {
    m.regionId = '森';
    m.facilityId = 'LOC_FOREST_HUNTER_HUT';
    m.requiredState = 'Day2 merchant arrival available after Mira shelter; Riona, then Jill, alive and present at their authored facilities';
    m.resultingState = 'gold+=3; hunter parcel delivered; warning snare repaired; village north-fence warning queued for three hours later';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-day1-t01-village-night.js through authored-mission-flow-day2-t01-hunter-lunch.js';
    m.plannedStart = '07:00';
    m.plannedEnd = '09:06';
    return resolvedSteps(m, [
      commandStep('MISSION_FLOW:T01:DAY2_MERCHANT:help_unload', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_INN' }),
      commandStep('MISSION_FLOW:T01:DAY2_MERCHANT_PAYMENT:take_three_gold', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_INN' }),
      commandStep('MISSION_FLOW:T01:DAY2_MERCHANT_STALL:take_hunter_parcel', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_INN' }),
      commandStep('MISSION_FLOW:T01:DAY2_MERCHANT_FOLLOWUP:t01-day2-hunter-parcel:leave_for_hut', 'CHOOSE', null, { regionId: '森', facilityId: 'LOC_FOREST_HUNTER_HUT' }),
      commandStep('MISSION_FLOW:T01:DAY2_HUNTER_HUT:repair_snare', 'CHOOSE', null, { regionId: '森', facilityId: 'LOC_FOREST_HUNTER_HUT' }),
      commandStep('MISSION_FLOW:T01:DAY2_HUNTER_LUNCH:send_warning', 'CHOOSE', null, { regionId: '森', facilityId: 'LOC_FOREST_HUNTER_HUT' }),
    ], 'the generic dishwashing placeholder is replaced by the existing Day2 livelihood/logistics chain; all six choices are ordinary public actions');
  }

  if (m.legacyRowId === 'VR2-D02-04') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_SQUARE';
    m.requiredState = 'DAY2_HUNTER_VILLAGE_WARNING_QUEUED; warning GOAP dueAtMinute reached; at LOC_FOREST_HUNTER_HUT';
    m.resultingState = 'north-east bell evidence recorded; shared village watch roster scheduled for Day8; player returns to village square';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-day2-t01-village-warning-result.js + authored-mission-flow-day2-day8-village-watch.js';
    m.plannedStart = '12:06';
    m.plannedEnd = '13:15';
    return resolvedSteps(m, [
      commandStep('MISSION_FLOW:T01:DAY2_VILLAGE_WARNING:inspect_warning_bells', 'CHOOSE', null, { regionId: '森', facilityId: 'LOC_FOREST_HUNTER_HUT' }),
      commandStep('MISSION_FLOW:T01:DAY2_VILLAGE_WATCH:circulate_watch_tags', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_SQUARE' }),
    ], 'warning delivery is allowed to mature before the two existing follow-up choices; the roster is the explicit prerequisite for the Day8 howl scene');
  }

  if (m.legacyRowId === 'VR2-D03-09') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_REPAIR';
    m.requiredState = 'EQP-W-0201 and EQP-S-0001 owned after STK-0124/STK-0005 purchases';
    m.resultingState = 'mainHand=EQP-W-0201; offHand=EQP-S-0001; superseded starter equipment remains ordinary owned inventory';
    m.implementationSource = 'src/server/trpg/game/service.js EQUIP command';
    return resolvedSteps(m, [
      commandStep('EQP-W-0201', 'EQUIP', { equipmentId: 'EQP-W-0201' }, { regionId: '田園の村', facilityId: 'LOC_FARM_REPAIR' }),
      commandStep('EQP-S-0001', 'EQUIP', { equipmentId: 'EQP-S-0001' }, { regionId: '田園の村', facilityId: 'LOC_FARM_REPAIR' }),
    ], 'the two purchases are equipped through real commands; the legacy Eda-loan return is not emitted because no canonical loanId exists for starter equipment');
  }

  if (m.legacyRowId === 'VR2-D08-06') {
    return narrative(m, 'src/server/trpg/content/canonical-regional-labour.js JOB-FARM-04 scheduling continuity', 'accepting the night watch is the narrative commitment; VR2-D08-09 carries the actual public job and T03 commands');
  }

  if (m.legacyRowId === 'VR2-D08-08') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_GRANARY';
    m.resultingState = 'time+=120; fatigue recovery; remaining legacy block reallocated to the 18:00 north-fence job';
    m.implementationSource = 'src/server/trpg/content/canonical-world-life-actions.js';
    m.resolutionMethod = 'DETERMINISTIC_SPLIT';
    m.plannedStart = '16:00';
    m.plannedEnd = '18:00';
    m.notes = 'legacy 390-minute free-time block shortened to 120 minutes so JOB-FARM-04 can start inside its canonical 18:00-24:00 window';
    return resolvedPlayer(m, 'LIFE:REST:120');
  }

  if (m.legacyRowId === 'VR2-D08-09') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_NORTH_FENCE';
    m.jobId = 'JOB-FARM-04';
    m.requiredState = 'villageTrust>=2; Day2 shared-watch roster complete; Day8 howl due; at LOC_FARM_GRANARY before 18:00';
    m.resultingState = 'gold+=3; four-hour paid north-fence watch complete; howl triangulated with Jill; 390m rest; breakfast served and watch/damage timing evidence recorded';
    m.implementationSource = 'src/server/trpg/content/canonical-regional-labour.js + authored-mission-flow-day2-day8-village-watch.js + authored-mission-flow-day8-t03-community-followthrough.js';
    m.plannedStart = '18:00';
    m.plannedEnd = '05:38(+1)';
    return resolvedSteps(m, [
      moveLocalStep('LOC_FARM_NORTH_FENCE', '田園の村'),
      commandStep('WORK:FACILITY:JOB-FARM-04', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_NORTH_FENCE' }),
      commandStep('MISSION_FLOW:T03:DAY8_FIRST_HOWL:call_jill_to_fence', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_NORTH_FENCE' }),
      commandStep('LIFE:REST:390', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_NORTH_FENCE' }),
      commandStep('MISSION_FLOW:T03:DAY8_COMMUNITY:serve_watch_breakfast', 'CHOOSE', null, { regionId: '田園の村', facilityId: 'LOC_FARM_NORTH_FENCE' }),
    ], 'the obsolete hidden eight-hour local investigation is replaced by the canonical paid watch, two existing authored T03 choices and public rest; 52 minutes remain scheduling slack before Day9 06:30');
  }

  if (m.legacyRowId === 'VR2-D10-04') {
    const sequence = authoredInvestigationSequence('T17', {
      originRegion: '田園の村',
      originFacility: 'LOC_FARM_SQUARE',
      openingChoiceId: 'separate_temple_causes',
      returnRegion: '田園の村',
      returnFacility: 'LOC_FARM_SQUARE',
    });
    m.regionId = sequence.end.regionId;
    m.facilityId = sequence.end.facilityId;
    m.troubleId = 'T17';
    m.requiredState = 'T17 active on/after Day10; NPC018 present at LOC_CAP_LOWER_INN; village-capital route available';
    m.resultingState = 'T17 opening=separate_temple_causes; all six current evidence groups unlocked; returned to the village';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t17-capital-second-summoning.js + authored-mission-flow-core.js';
    return resolvedSteps(m, sequence.steps, 'Riona\'s rumor triggers an ordinary same-day capital inquiry and explicit return; it does not silently complete the hearing', 'EXACT_AUTHORED');
  }

  if (m.legacyRowId === 'VR2-D20-02') {
    m.facilityId = 'LOC_FARM_EDGE';
    m.requiredState = 'MSN-T03 active; authored investigation complete; at LOC_FARM_EDGE';
    m.resultingState = 'ENC-0006 won; MAT_RED_FANG_LARGE guaranteed; battle step complete';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-core.js + tools/trpg-sim/lib/player-journey.mjs';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'ACTION:MSN-T03:battle');
  }

  if (m.legacyRowId === 'VR2-D20-04') {
    m.regionId = '田園の村';
    m.facilityId = 'LOC_FARM_SQUARE';
    m.requiredState = 'MSN-T03 active; battle complete; relocate_den evidence ready';
    m.resultingState = 't03ResolutionRoute=relocate_den; T03 resolved; player returned to village';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-core.js + tools/trpg-sim/lib/player-journey.mjs';
    return resolvedSteps(m, [
      commandStep('MOVE_REGION:森', 'MOVE', { moveId: 'MOVE_REGION:森' }, { regionId: '森', facilityId: 'LOC_FOREST_EDGE' }),
      commandStep('MOVE_LOCAL:LOC_FOREST_CAMP', 'MOVE', { moveId: 'MOVE_LOCAL:LOC_FOREST_CAMP' }, { regionId: '森', facilityId: 'LOC_FOREST_CAMP' }),
      commandStep('MISSION_FLOW:red-fang-migration:RESOLUTION:relocate_den:active', 'CHOOSE', null, { regionId: '森', facilityId: 'LOC_FOREST_CAMP' }),
      authoredOpeningStep('T07', 'sale_route', { regionId: '森', facilityId: 'LOC_FOREST_CAMP' }),
      commandStep('MOVE_REGION:田園の村', 'MOVE', { moveId: 'MOVE_REGION:田園の村' }, { regionId: '田園の村', facilityId: 'LOC_FARM_SQUARE' }),
    ], 'canonical T03 resolution is in the forest; while Serie is present, the route also performs the ordinary T07 sale-route hearing before the explicit return');
  }

  if (m.legacyRowId === 'VR2-D32-05') {
    m.facilityId = 'LOC_TEMPLE_SEALED';
    m.requiredState = 'MSN-T04 active; three authored evidence groups complete; at LOC_TEMPLE_CORRIDOR';
    m.resultingState = 'ENC-0061 won; pilgrims recovered; transfer device paused; T04 resolved';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-core.js + tools/trpg-sim/lib/player-journey.mjs';
    return resolvedSteps(m, [
      commandStep('ACTION:MSN-T04:battle', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_CORRIDOR' }),
      commandStep('MOVE_LOCAL:LOC_TEMPLE_SEALED', 'MOVE', { moveId: 'MOVE_LOCAL:LOC_TEMPLE_SEALED' }, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_SEALED' }),
      commandStep('MISSION_FLOW:pilgrim-transfer-disappearance:RESOLUTION:recover_then_pause:active', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_SEALED' }),
    ], 'legacy guard-statue composite replaced by canonical ENC-0061 battle and authored rescue resolution');
  }

  if (m.legacyRowId === 'VR2-D32-03') {
    m.regionId = '古代神殿';
    m.facilityId = 'LOC_TEMPLE_REST';
    m.requiredState = 'MSN-T04 hearing step; T04 active; Falco present at LOC_TEMPLE_ADMIN';
    m.resultingState = 'concealed reports, corridor glyph and procession-gap evidence verified; investigate progress 3/3';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-core.js + authored/missions via current final registry';
    return resolvedSteps(m, [
      moveLocalStep('LOC_TEMPLE_ADMIN', '古代神殿'),
      commandStep('MISSION_FLOW:pilgrim-transfer-disappearance:OPENING:day1_anomaly', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_ADMIN' }),
      commandStep('MISSION_FLOW:pilgrim-transfer-disappearance:LEAD:concealed_records', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_ADMIN' }),
      commandStep('MISSION_FLOW:pilgrim-transfer-disappearance:EVIDENCE:concealed_records', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_ADMIN' }),
      commandStep('MISSION_FLOW:pilgrim-transfer-disappearance:LEAD:corridor_resonance@LOC_TEMPLE_ADMIN', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_CORRIDOR' }),
      commandStep('MISSION_FLOW:pilgrim-transfer-disappearance:EVIDENCE:corridor_resonance', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_CORRIDOR' }),
      commandStep('MISSION_FLOW:pilgrim-transfer-disappearance:LEAD:pilgrim_route@LOC_TEMPLE_CORRIDOR', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_REST' }),
      commandStep('MISSION_FLOW:pilgrim-transfer-disappearance:EVIDENCE:pilgrim_route', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_REST' }),
    ], 'the two legacy clues are expanded into the three current authored evidence classes required before the rescue; all IDs are public flow actions');
  }

  if (m.legacyRowId === 'VR2-D32-10') {
    const colossus = authoredLeadAndEvidenceSteps('T17', 'colossus_seal_chronology', {
      regionId: '古代神殿',
      facilityId: 'LOC_TEMPLE_ADMIN',
    });
    m.regionId = colossus.end.regionId;
    m.facilityId = colossus.end.facilityId;
    m.troubleId = 'T17';
    m.requiredState = 'T04 resolved; human T04 relay stage>=3; T17 opening already chosen; Falco/Luca aftermath actions available';
    m.resultingState = 'T17 sealed-quarter plate, Luca arrival coordinates and colossus chronology acquired; evidence groups 3/4/5 represented';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-human-route-t04-t17-aftermath.js + authored-mission-flow-core.js';
    return resolvedSteps(m, [
      commandStep('MISSION_FLOW:T17:HUMAN_SPINE:t04-rescue-aftermath:copy_resonance_plate', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_SEALED' }),
      commandStep('MISSION_FLOW:T17:HUMAN_SPINE:t04-t17-temple-proof:ask_luca_to_map', 'CHOOSE', null, { regionId: '古代神殿', facilityId: 'LOC_TEMPLE_ADMIN' }),
      ...colossus.steps,
    ], 'T04 resolution is handed forward by two existing human-spine choices and one ordinary T17 evidence pair; the records stay inspectable and NPC-authored', 'EXACT_AUTHORED');
  }

  if (m.legacyRowId === 'VR2-D29-02') {
    m.facilityId = 'LOC_DWARF_ENGINEER';
    m.requiredState = 'MSN-T09 battle step; authored evidence complete; T09 active on Day28-29';
    m.resultingState = 'ENC-0049 won; runaway drill stopped; rescue route opened; Broln remains rescuable';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t09-dwarf-mine-collapse.js + tools/trpg-sim/lib/player-journey.mjs';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'ACTION:MSN-T09:battle');
  }

  if (m.legacyRowId === 'VR2-D29-04') {
    m.facilityId = authoredResolutionFacility('T09');
    m.requiredState = 'MSN-T09 resolution step; ENC-0049 won; T09 active';
    m.resultingState = 't09ResolutionRoute=public_accountability_and_safety_council; responsibility record public; T09 resolved';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t09-dwarf-mine-collapse.js + authored-mission-flow-core.js';
    return resolvedSteps(m, [
      moveLocalStep(authoredResolutionFacility('T09'), 'ドワーフ洞窟'),
      commandStep(authoredResolutionId('T09', 'public_accountability_and_safety_council'), 'CHOOSE', null, { regionId: 'ドワーフ洞窟', facilityId: authoredResolutionFacility('T09') }),
    ], 'rescue and public accountability are separate ordinary mission commands');
  }

  if (m.legacyRowId === 'VR2-D38-02') {
    m.regionId = '交易都市';
    m.facilityId = authoredResolutionFacility('T05');
    m.requiredState = 'MSN-T05 battle then resolution steps; antidote/poison-route/order evidence complete; T05 active';
    m.resultingState = 'ENC-0033 won; Nicolas protected; antidote administered; Cedric order proven; T05 resolved';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-core.js + tools/trpg-sim/lib/player-journey.mjs';
    return resolvedSteps(m, [
      moveLocalStep('LOC_TRADE_WAREHOUSE', '交易都市'),
      authoredBattleStep('T05', { regionId: '交易都市', facilityId: 'LOC_TRADE_WAREHOUSE' }),
      moveLocalStep(authoredResolutionFacility('T05'), '交易都市'),
      commandStep(authoredResolutionId('T05', 'protect_nicolas_and_treat'), 'CHOOSE', null, { regionId: '交易都市', facilityId: authoredResolutionFacility('T05') }),
    ], 'legacy treatment row omitted the canonical warehouse intervention; v3 retains the combat and the authored coercion-aware treatment route');
  }

  if (m.legacyRowId === 'VR2-D38-04') {
    return narrative(m, 'src/server/trpg/content/authored-mission-flow-core.js T05 resolution world effect', 'aftermath of the preceding protect_nicolas_and_treat command, not a second player command');
  }

  if (m.legacyRowId === 'VR2-D41-02') {
    m.regionId = '王都';
    m.facilityId = 'LOC_CAP_MAGE_TOWER';
    m.requiredState = 'MSN-T17 battle step; six evidence groups complete; Day41 ritual deadline reached';
    m.resultingState = 'ENC-0028 won; empty hero/ritual breach stopped; resolution step available';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t17-capital-second-summoning.js + tools/trpg-sim/lib/player-journey.mjs';
    return resolvedSteps(m, [
      moveLocalStep('LOC_CAP_MAGE_TOWER', '王都'),
      authoredBattleStep('T17', { regionId: '王都', facilityId: 'LOC_CAP_MAGE_TOWER' }),
    ], 'Day41 is the live ritual deadline, so the current runtime requires the real ENC-0028 intervention rather than a consequence-free presentation');
  }

  if (m.legacyRowId === 'VR2-D41-04') {
    m.regionId = '王都';
    m.facilityId = authoredResolutionFacility('T17');
    m.requiredState = 'MSN-T17 resolution step; ENC-0028 won; royal-public route evidence ready';
    m.resultingState = 't17ResolutionRoute=royal_public_suspension_and_living_witness; ritual safely stopped; player identity recorded; T17 resolved';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-t17-runtime-core-split.js';
    return resolvedSteps(m, [
      moveLocalStep(authoredResolutionFacility('T17'), '王都'),
      commandStep(authoredResolutionId('T17', 'royal_public_suspension_and_living_witness'), 'CHOOSE', null, { regionId: '王都', facilityId: authoredResolutionFacility('T17') }),
    ], 'T17 uses the late-game public action ID contract without an :active suffix');
  }

  if (m.legacyRowId === 'VR2-D43-02') {
    m.regionId = '王都';
    m.facilityId = 'LOC_CAP_OFFICE';
    m.requiredState = 'MSN-T10 intervention step; three evidence groups complete; Day43';
    m.resultingState = 'T10-INTERVENTION-PRELIMINARY-STAY acquired; eviction stayed; resolution step available';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t10-capital-orphanage-eviction.js + tools/trpg-sim/lib/player-journey.mjs';
    return resolvedSteps(m, [
      moveLocalStep('LOC_CAP_OFFICE', '王都'),
      authoredBattleStep('T10', { regionId: '王都', facilityId: 'LOC_CAP_OFFICE' }),
    ], 'ACTION:MSN-T10:battle is an investigate-type preliminary stay on Day43, not a fabricated combat');
  }

  if (m.legacyRowId === 'VR2-D43-04') {
    m.regionId = '王都';
    m.facilityId = authoredResolutionFacility('T10');
    m.requiredState = 'MSN-T10 resolution step; preliminary stay and original deed evidence complete';
    m.resultingState = 't10ResolutionRoute=restore_donation_title_and_stay; donation title restored; T10 resolved';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t10-capital-orphanage-eviction.js + authored-mission-flow-core.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, authoredResolutionId('T10', 'restore_donation_title_and_stay'));
  }

  if (m.legacyRowId === 'VR2-D44-05') {
    m.regionId = '交易都市';
    m.facilityId = authoredResolutionFacility('T06');
    m.requiredState = 'MSN-T06 battle then resolution steps; wage/contract/weapon evidence complete; T06 active';
    m.resultingState = 'ENC-0033 won; smuggled weapons stopped; worker cooperative and watch established; T06 resolved';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t06-port-labor-unrest.js + authored-mission-flow-core.js';
    return resolvedSteps(m, [
      moveLocalStep('LOC_TRADE_WAREHOUSE', '交易都市'),
      authoredBattleStep('T06', { regionId: '交易都市', facilityId: 'LOC_TRADE_WAREHOUSE' }),
      moveLocalStep(authoredResolutionFacility('T06'), '交易都市'),
      commandStep(authoredResolutionId('T06', 'worker_cooperative_and_smuggling_watch'), 'CHOOSE', null, { regionId: '交易都市', facilityId: authoredResolutionFacility('T06') }),
    ], 'canonical T06 final action belongs in the trade city before the Day45 departure; v3 relocates the obsolete fortress-tagged resolution');
  }

  if (m.legacyRowId === 'VR2-D45-05') {
    return narrative(m, 'src/server/trpg/content/authored/missions/t06-port-labor-unrest.js resolution aftermath', 'agreement is the already-selected worker_cooperative_and_smuggling_watch outcome from VR2-D44-05; no duplicate resolution at the fortress');
  }

  if (m.legacyRowId === 'VR2-D45-06') {
    return narrative(m, 'tools/trpg-sim/lib/player-journey.mjs regional arrival state', 'fortress arrival/equipment inspection continuity after T06; no T06 mission command exists at this facility');
  }

  if (m.legacyRowId === 'VR2-D45-09') {
    m.regionId = '北陵要塞';
    m.facilityId = authoredResolutionFacility('T12');
    m.requiredState = 'MSN-T12 battle then resolution steps; five evidence groups complete; T12 active on Day45';
    m.resultingState = 'ENC-0055 won without killing Kai; joint border inquiry/nonaggression line established; T12 resolved';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t12-northern-fortress-false-flag.js + authored-mission-flow-core.js';
    return resolvedSteps(m, [
      moveLocalStep('LOC_FORT_WALL', '北陵要塞'),
      authoredBattleStep('T12', { regionId: '北陵要塞', facilityId: 'LOC_FORT_WALL' }),
      moveLocalStep(authoredResolutionFacility('T12'), '北陵要塞'),
      commandStep(authoredResolutionId('T12', 'joint_border_inquiry_and_nonaggression_line'), 'CHOOSE', null, { regionId: '北陵要塞', facilityId: authoredResolutionFacility('T12') }),
    ], 'the current pack resolves T12 at fortress command before departure; Kai testimony is retained and the obsolete trade-city resolution is not duplicated');
  }

  if (m.legacyRowId === 'VR2-D46-05') {
    return narrative(m, 'src/server/trpg/content/authored/missions/t12-northern-fortress-false-flag.js resolution aftermath', 'evidence comparison/relay after the canonical fortress resolution at VR2-D45-09');
  }

  if (m.legacyRowId === 'VR2-D46-06') {
    return narrative(m, 'src/server/trpg/content/authored/missions/t12-northern-fortress-false-flag.js resolution aftermath + equipment shop continuity', 'post-resolution relay and deferred shopping intent; the actual purchase remains its later SHOP_BUY row');
  }

  if (m.legacyRowId === 'VR2-D48-02') {
    m.regionId = '犯罪都市';
    m.facilityId = 'LOC_CRIME_SLAVE_MARKET';
    m.requiredState = 'MSN-T07 investigate active; selected slave_market_ledger lead; at crime slave market';
    m.resultingState = 'T07-EVIDENCE-CALVAN-MARKET-LEDGER verified; rescue timing and buyer route known';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t07-runaway-elf-trafficking.js + authored-mission-flow-core.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'MISSION_FLOW:runaway-elf-trafficking:EVIDENCE:slave_market_ledger');
  }

  if (m.legacyRowId === 'VR2-D48-03') {
    m.regionId = '犯罪都市';
    m.facilityId = 'LOC_CRIME_SLAVE_MARKET';
    m.requiredState = 'MSN-T07 battle step; three evidence groups complete; Day48';
    m.resultingState = 'ENC-0042 won; Lysia freed alive; her agency preserved; resolution discussion unlocked';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t07-runaway-elf-trafficking.js + tools/trpg-sim/lib/player-journey.mjs';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'ACTION:MSN-T07:battle');
  }

  if (m.legacyRowId === 'VR2-D48-05') {
    return narrative(m, 'src/server/trpg/content/authored/missions/t07-runaway-elf-trafficking.js battle aftermath', 'ledger seizure and broker-route shutdown are rescue aftermath; live T07 route selection occurs with Lysia at the forest camp on VR2-D51-08');
  }

  if (m.legacyRowId === 'VR2-D49-03') {
    return narrative(m, 'tools/trpg-sim/lib/player-journey.mjs capital arrival state', 'capital arrival/triage continuity, not a T11 authored command');
  }

  if (m.legacyRowId === 'VR2-D49-05') {
    const royalSchedule = authoredLeadAndEvidenceSteps('T11', 'royal_schedule_copy', {
      regionId: '王都',
      facilityId: 'LOC_CAP_LOWER_INN',
    });
    m.regionId = '王都';
    m.facilityId = authoredResolutionFacility('T11');
    m.requiredState = 'MSN-T11 investigate active; Noah and Milan evidence acquired; royal_schedule_copy unlocked; T11 active on Day49';
    m.resultingState = 'ENC-0025 won; king survives; public conspiracy inquiry and guard reform selected; T11 resolved';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t11-capital-assassination-plot.js + authored-mission-flow-core.js';
    return resolvedSteps(m, [
      ...royalSchedule.steps,
      authoredBattleStep('T11', { regionId: '王都', facilityId: 'LOC_CAP_CASTLE' }),
      commandStep(authoredResolutionId('T11', 'public_conspiracy_inquiry_and_guard_reform'), 'CHOOSE', null, { regionId: '王都', facilityId: authoredResolutionFacility('T11') }),
    ], 'the final schedule evidence, assassination intervention and political disposition are three distinct public phases');
  }

  if (m.legacyRowId === 'VR2-D47-05') {
    const selected = authoredLeadAndEvidenceSteps('T07', 'slave_market_ledger', {
      regionId: '犯罪都市',
      facilityId: 'LOC_CRIME_INFO_STREET',
    });
    const leadStep = selected.steps[0];
    m.regionId = '犯罪都市';
    m.facilityId = 'LOC_CRIME_SLAVE_MARKET';
    m.troubleId = 'T07';
    m.requiredState = 'T07 investigate active; slave_market_ledger unlocked by the crime-dock/Black Lamp evidence; Kiri alive';
    m.resultingState = 'selectedLeadId=slave_market_ledger; player moved to LOC_CRIME_SLAVE_MARKET; Day48 evidence action exposed';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t07-runaway-elf-trafficking.js + authored-mission-flow-core.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    m.notes = 'this row selects and travels to the real ledger lead; VR2-D48-02 performs the separate evidence command';
    return resolvedPlayer(m, leadStep.actionId, leadStep.commandType, leadStep.payload);
  }

  if (m.legacyRowId === 'VR2-D51-06') {
    const t13 = authoredInvestigationSequence('T13', {
      originRegion: '森',
      originFacility: 'LOC_FOREST_EDGE',
      openingChoiceId: 'river_growth_and_separation',
      leadIds: ['serie_shadow_chronology'],
    });
    const t08 = authoredInvestigationSequence('T08', {
      originRegion: t13.end.regionId,
      originFacility: t13.end.facilityId,
      openingChoiceId: 'forest_anomaly',
      leadIds: ['river_magic_drain'],
    });
    m.regionId = t08.end.regionId;
    m.facilityId = t08.end.facilityId;
    m.troubleId = 'T13|T08';
    m.requiredState = 'T08/T13 active; Serie alive at the forest edge/camp; T07 rescue path preserves forest access';
    m.resultingState = 'T13 Serie chronology and T08 river-magic-drain evidence acquired; both investigations remain ordinary public flows';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t13-forest-king-slime-world-tree-collapse.js + authored/missions/t08-forest-sealing-order.js + authored-mission-flow-core.js';
    return resolvedSteps(m, [...t13.steps, ...t08.steps], 'one water-level inspection opens two distinct canonical incidents; evidence is not copied between them', 'EXACT_AUTHORED');
  }

  if (m.legacyRowId === 'VR2-D51-08') {
    m.regionId = '森';
    m.facilityId = authoredResolutionFacility('T07');
    m.requiredState = 'MSN-T07 resolution step; Lysia rescued alive and present; voluntary-return evidence ready';
    m.resultingState = 't07ResolutionRoute=voluntary_return_with_youth_charter; Lysia chooses return with rights charter; T07 resolved';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t07-runaway-elf-trafficking.js + authored-mission-flow-core.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, authoredResolutionId('T07', 'voluntary_return_with_youth_charter'));
  }

  if (m.legacyRowId === 'VR2-D52-03') {
    return narrative(m, 'src/server/trpg/content/authored/missions/t07-runaway-elf-trafficking.js voluntary-return aftermath', 'Lysia speaking to the elder is the consequence of her ordinary T07 route choice, not a second T08 resolution command');
  }

  if (m.legacyRowId === 'VR2-D52-05') {
    const evidence = authoredInvestigationSequence('T08', {
      originRegion: 'エルフの隠れ里',
      originFacility: 'LOC_ELF_GUEST_BOUGH',
      leadIds: ['spirit_pool_decline', 'barrier_overload'],
    });
    m.regionId = 'エルフの隠れ里';
    m.facilityId = 'LOC_ELF_GUEST_BOUGH';
    m.requiredState = 'MSN-T08 investigate active; river evidence acquired; spirit-pool/barrier leads unlocked; T07 voluntary return known';
    m.resultingState = 't08ResolutionRoute=joint_anomaly_expedition_corridor; forest monitoring corridor opened; T08 resolved; return to hidden village';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t08-forest-sealing-order.js + authored-mission-flow-core.js';
    return resolvedSteps(m, [
      ...evidence.steps,
      moveLocalStep(authoredResolutionFacility('T08'), '森'),
      commandStep(authoredResolutionId('T08', 'joint_anomaly_expedition_corridor'), 'CHOOSE', null, { regionId: '森', facilityId: authoredResolutionFacility('T08') }),
      moveRegionStep('エルフの隠れ里'),
    ], 'two remaining authored evidence pairs precede the forest-camp resolution; v3 then performs the explicit short return instead of inventing an elder-only action');
  }

  if (m.legacyRowId === 'VR2-D55-02') {
    m.regionId = '交易都市';
    m.facilityId = 'LOC_TRADE_WAREHOUSE';
    m.requiredState = 'MSN-T14 battle step; six evidence groups complete; Day55 first-transaction variant';
    m.resultingState = 'ENC-0033 won; cargo, receipt token and carrier secured without stopping ordinary trade';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t14-crime-city-arms-smuggling.js + tools/trpg-sim/lib/player-journey.mjs';
    return resolvedSteps(m, [
      moveLocalStep('LOC_TRADE_WAREHOUSE', '交易都市'),
      authoredBattleStep('T14', { regionId: '交易都市', facilityId: 'LOC_TRADE_WAREHOUSE' }),
    ], 'Day55 uses the live ENC-0033 warehouse timeline variant');
  }

  if (m.legacyRowId === 'VR2-D55-04') {
    m.regionId = '交易都市';
    m.facilityId = 'LOC_TRADE_PORT';
    m.requiredState = 'MSN-T14 resolution step; buyer-ledger route ready; T14 active';
    m.resultingState = 't14ResolutionRoute=coordinated_seizure_and_buyer_arrests; multi-region buyers arrested; T14 resolved; return to trade city';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t14-crime-city-arms-smuggling.js + authored-mission-flow-core.js';
    return resolvedSteps(m, [
      moveRegionStep('犯罪都市'),
      moveLocalStep(authoredResolutionFacility('T14'), '犯罪都市'),
      commandStep(authoredResolutionId('T14', 'coordinated_seizure_and_buyer_arrests'), 'CHOOSE', null, { regionId: '犯罪都市', facilityId: authoredResolutionFacility('T14') }),
      moveRegionStep('交易都市'),
    ], 'canonical coordinated seizure is chosen at crime-city information street; v3 expands the missing round trip');
  }

  if (m.legacyRowId === 'VR2-D58-02') {
    return narrative(m, 'src/server/trpg/content/authored/missions/t13-forest-king-slime-world-tree-collapse.js battle preparation aftermath', 'three-faction weakening is the accumulated result of prior evidence/preparation commands; the actual battle remains VR2-D58-04');
  }

  if (m.legacyRowId === 'VR2-D58-04') {
    m.regionId = 'エルフの隠れ里';
    m.facilityId = 'LOC_ELF_WORLD_TREE';
    m.requiredState = 'MSN-T13 battle step; six evidence groups complete; Day58 world-tree variant';
    m.resultingState = 'ENC-0018 won; king gel core separated; world-tree roots preserved; resolution step available';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t13-forest-king-slime-world-tree-collapse.js + tools/trpg-sim/lib/player-journey.mjs';
    return resolvedSteps(m, [
      moveRegionStep('エルフの隠れ里'),
      moveLocalStep('LOC_ELF_WORLD_TREE', 'エルフの隠れ里'),
      authoredBattleStep('T13', { regionId: 'エルフの隠れ里', facilityId: 'LOC_ELF_WORLD_TREE' }),
    ], 'Day58 canonical encounter is ENC-0018 at the world tree, not a generic forest fight');
  }

  if (m.legacyRowId === 'VR2-D58-05') {
    m.regionId = 'エルフの隠れ里';
    m.facilityId = authoredResolutionFacility('T13');
    m.requiredState = 'MSN-T13 resolution step; ENC-0018 won; sever-core route ready';
    m.resultingState = 't13ResolutionRoute=sever_core_restore_river_and_seal; river/world tree recover; T13 resolved';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t13-forest-king-slime-world-tree-collapse.js + authored-mission-flow-core.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, authoredResolutionId('T13', 'sever_core_restore_river_and_seal'));
  }

  if (m.legacyRowId === 'VR2-D76-02') {
    m.regionId = '王都';
    m.facilityId = 'LOC_CAP_AJIN_QUARTER';
    m.requiredState = 'MSN-T16 battle step; six evidence groups complete; residents/guards evacuation roles prepared';
    m.resultingState = 'T16 battle objectives complete without collective punishment; ringleader courier captured';
    m.implementationSource = 'src/server/trpg/content/authored/missions/t16-capital-persecution-riot.js + tools/trpg-sim/lib/player-journey.mjs';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'ACTION:MSN-T16:battle');
  }

  if (m.legacyRowId === 'VR2-D78-02') {
    m.regionId = '王都';
    m.facilityId = authoredResolutionFacility('T16');
    m.requiredState = 'MSN-T16 resolution step; six evidence groups complete; public-accountability route dominant';
    m.resultingState = 't16ResolutionRoute=public_retraction_and_legal_accountability; law/order corrections and public hearing recorded; T16 resolved';
    m.implementationSource = 'src/server/trpg/content/authored-mission-flow-t16-runtime.js';
    return resolvedSteps(m, [
      moveLocalStep(authoredResolutionFacility('T16'), '王都'),
      commandStep(authoredResolutionId('T16', 'public_retraction_and_legal_accountability'), 'CHOOSE', null, { regionId: '王都', facilityId: authoredResolutionFacility('T16') }),
    ], 'T16 uses its statusless late-game resolution ID; hearing evidence and legal accountability select the public-retraction route');
  }

  if (m.legacyRowId === 'VR2-D78-04') {
    return narrative(m, 'src/server/trpg/content/authored/missions/t16-capital-persecution-riot.js public-retraction aftermath', 'joint reopening is the civilian aftermath of the public accountability resolution, not a second route choice');
  }

  if (m.legacyRowId === 'VR2-D20-08') {
    m.facilityId = 'LOC_FARM_REPAIR';
    m.materialId = 'MAT_RED_FANG_LARGE';
    m.requiredState = 'ENC-0006 won; MAT_RED_FANG_LARGE>=1; at LOC_FARM_REPAIR';
    m.resultingState = 'MAT_RED_FANG_LARGE-=1; gold+=3';
    m.implementationSource = 'src/server/trpg/content/canonical-material-economy.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    m.notes = 'canonical guaranteed sale is 3G, replacing unsupported legacy +9G; static ledger must rebalance the 6G delta';
    return resolvedPlayer(m, 'MATERIAL_SELL:MAT_RED_FANG_LARGE:Q1');
  }

  if (m.legacyRowId === 'VR2-D28-06') {
    m.facilityId = 'LOC_DWARF_MARKET';
    m.requiredState = 'none: no guaranteed sellable material exists in the preceding route command sequence';
    m.resultingState = 'gold+=0; unsupported legacy +8G removed from the v3 ledger';
    m.implementationSource = 'src/server/trpg/content/canonical-material-economy.js + live TRPG_戦闘データマスターβ1 素材買取価格';
    m.resolutionMethod = 'EXACT_CANONICAL';
    m.notes = 'ENC-0047 could yield MAT_BEETLE_SHELL at 4G, but its 55% drop and 1-2 enemy count cannot guarantee the two shells required for +8G; no sale command is emitted';
    return narrative(m, m.implementationSource, m.notes);
  }

  if (m.legacyRowId === 'VR2-D32-09') {
    m.facilityId = 'LOC_TEMPLE_ADMIN';
    m.requiredState = 'none: Ancient Temple is not a canonical material buyer and ENC-0061 has no guaranteed sale totaling 13G';
    m.resultingState = 'gold+=0; unsupported legacy +13G removed from the v3 ledger';
    m.implementationSource = 'src/server/trpg/content/canonical-material-economy.js + live TRPG_戦闘データマスターβ1 素材買取価格';
    m.resolutionMethod = 'EXACT_CANONICAL';
    m.notes = 'MAT_TRANSFER_SHARD is a 55% 6G drop and the live buyer registry has no Ancient Temple counter; the old 13G receipt has neither valid quantity nor facility lineage';
    return narrative(m, m.implementationSource, m.notes);
  }

  if (m.legacyRowId === 'VR2-D47-06') {
    m.facilityId = 'LOC_CRIME_INFO_STREET';
    m.requiredState = 'none: no battle or guaranteed material acquisition precedes this Day47 sale';
    m.resultingState = 'gold+=0; unsupported legacy +9G removed from the v3 ledger';
    m.implementationSource = 'src/server/trpg/content/canonical-material-economy.js + live TRPG_戦闘データマスターβ1 素材買取価格';
    m.resolutionMethod = 'EXACT_CANONICAL';
    m.notes = 'the Day47 combat occurs after this row, and LOC_CRIME_INFO_STREET is not a buyer; the old +9G cannot be sourced without inventing retained loot';
    return narrative(m, m.implementationSource, m.notes);
  }

  if (m.legacyRowId === 'VR2-D58-08') {
    m.facilityId = 'LOC_FOREST_HUNTER_HUT';
    m.materialId = 'MAT_KING_GEL_CORE';
    m.requiredState = 'ENC-0018 won; MAT_KING_GEL_CORE>=1; hunterApproval; at LOC_FOREST_HUNTER_HUT';
    m.resultingState = 'MAT_KING_GEL_CORE-=1; gold+=3; MAT_WORLD_TREE_FRAGMENT retained';
    m.implementationSource = 'src/server/trpg/content/canonical-material-economy.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'MATERIAL_SELL:MAT_KING_GEL_CORE:Q1');
  }

  if (m.legacyRowId === 'VR2-D81-06') {
    m.facilityId = 'LOC_FARM_WELL';
    m.requiredState = 'DEBT:EDA:ITM014.remainingG=6; NPC004 present; gold>=6';
    m.resultingState = 'gold-=6; DEBT:EDA:ITM014.status=paid';
    m.implementationSource = 'src/server/trpg/content/canonical-social-obligations.js';
    m.resolutionMethod = 'EXACT_AUTHORED';
    return resolvedPlayer(m, 'OBLIGATION:PAY:DEBT:EDA:ITM014:FULL');
  }

  if (m.legacyRowId === 'VR2-D32-13') {
    m.regionId = '辺境の村';
    m.facilityId = 'LOC_BORDER_INN';
    m.productId = 'ITM176';
    m.requiredState = 'T04 aftermath complete; at ancient temple; gold>=3';
    m.resultingState = 'move to border village; gold-=3; sleep 480m; fatigue/HP/MP recovery';
    m.implementationSource = 'src/server/trpg/content/canonical-world-life-actions.js + tools/trpg-sim/lib/player-journey.mjs';
    return resolvedSteps(m, [
      moveRegionStep('辺境の村'),
      moveLocalStep('LOC_BORDER_INN', '辺境の村'),
      commandStep('LIFE:SLEEP:ITM176', 'CHOOSE', null, { regionId: '辺境の村', facilityId: 'LOC_BORDER_INN' }),
    ], 'the live product master has no ancient-temple lodging; v3 returns to the canonical 3G pilgrim dormitory before sleeping', 'EXACT_CANONICAL');
  }

  return null;
}

function convertRow(row, index) {
  const m = baseMapping(row, index); const rt = row['runtime action']; const day = Number(row.Day); const trouble = row['事件'] || '';
  const exact = exactAuthoredOverride(m);
  if (exact) return exact;
  if (rt === 'LEARN_SKILL') {
    const id = /SKL-\d{4}/u.exec(row['行動'])?.[0];
    if (!id) return unresolved(m, 'MISSING_SKILL_ID');
    m.skillId = id; m.requiredState = 'skill reveal/unlock conditions met; SP>=cost'; m.resultingState = `learnedSkills+=${id}; SP-=cost`;
    m.implementationSource = 'src/server/trpg/game/service.js COMMAND_TYPES.LEARN_SKILL + skill-progression';
    return resolvedPlayer(m, id, 'LEARN_SKILL', { skillId: id });
  }
  if (rt === 'WORK:FACILITY') {
    const job = assignJob(row); if (!job) return unresolved(m, 'INVALID_OLD_JOB');
    m.jobId = job.jobId; m.facilityId = job.facilityId; m.requiredState = job.condition ?? 'none';
    m.resultingState = `gold+=${job.wage}; time+=${job.minutes}${job.freeMeals ? `; freeMeals+=${job.freeMeals}` : ''}`;
    m.implementationSource = 'src/server/trpg/content/canonical-regional-labour.js + canonical-job-time-policy.js';
    m.plannedStart = hhmm(job.start); m.plannedEnd = hhmm(job.start + job.minutes);
    if (job.wage !== num(row['収入']) || job.minutes !== durationMinutes(row['開始'], row['終了'])) m.notes = `legacy work reallocated to canonical ${job.jobId}`;
    return resolvedPlayer(m, `WORK:FACILITY:${job.jobId}`);
  }
  if (rt === 'EAT') {
    const p = inferFood(row); if (!p) return unresolved(m, 'MISSING_CANONICAL_FOOD');
    m.productId = p.productId; m.facilityId = p.kind === 'meal' ? p.facilityId : '';
    m.requiredState = p.kind === 'provision' ? `canonicalWorldLife.provisions.${p.productId}>0` : `at ${p.facilityId}; gold/freeMeal sufficient`;
    m.resultingState = p.kind === 'provision' ? `provisions.${p.productId}-=1; hunger recovery` : `gold-=${p.price}; hunger recovery`;
    m.implementationSource = 'src/server/trpg/content/canonical-world-life-actions.js';
    return resolvedPlayer(m, `LIFE:EAT:${p.productId}`);
  }
  if (rt === 'REST') {
    const minutes = durationMinutes(row['開始'], row['終了']);
    if (/睡眠/u.test(row['行動'])) {
      const pid = defaultLodgingByRegion[row['場所']]; const p = productById(pid);
      if (!p) return unresolved(m, 'MISSING_LODGING_PRODUCT', 'REPLACED_INVALID', `sleep ${minutes ?? '?'}min requires REST/SLEEP split`);
      m.productId = p.productId; m.facilityId = p.facilityId; m.requiredState = p.condition ?? `at ${p.facilityId}; lodging payment/free lodging available`;
      m.resultingState = 'time+=480; fatigue/HP/MP recovery'; m.implementationSource = 'src/server/trpg/content/canonical-world-life-actions.js';
      return resolvedPlayer(m, `LIFE:SLEEP:${p.productId}`);
    }
    if (minutes != null && runtimeRestDurations.includes(minutes)) {
      m.resultingState = `time+=${minutes}; fatigue recovery`; m.implementationSource = 'src/server/trpg/content/canonical-world-life-actions.js';
      return resolvedPlayer(m, `LIFE:REST:${minutes}`);
    }
    const split = splitCanonicalRest(minutes);
    if (split) {
      const restedMinutes = split.reduce((total, value) => total + value, 0);
      const slackMinutes = minutes - restedMinutes;
      m.resultingState = `time+=${restedMinutes}; fatigue recovery`;
      m.implementationSource = 'src/server/trpg/content/canonical-world-life-actions.js';
      const note = `legacy free-time block ${minutes}min -> canonical REST ${split.join('+')}min${slackMinutes ? `; ${slackMinutes}min scheduling slack` : ''}`;
      if (split.length === 1) {
        m.notes = note;
        m.resolutionMethod = 'DETERMINISTIC_SPLIT';
        return resolvedPlayer(m, `LIFE:REST:${split[0]}`);
      }
      return resolvedSteps(m, split.map((duration) => commandStep(`LIFE:REST:${duration}`)), note, 'DETERMINISTIC_SPLIT');
    }
    return unresolved(m, 'REST_SPLIT_REQUIRED', 'REPLACED_INVALID', `legacy rest ${minutes ?? '?'}min cannot be decomposed into public REST actions`);
  }
  if (rt === 'REGIONAL_MOVE') {
    const dest = row['移動先'] || /から(.+?)へ移動/u.exec(row['行動'])?.[1] || row['場所'];
    if (!dest) return unresolved(m, 'MISSING_MOVE_TARGET');
    const actionId = `MOVE_REGION:${dest}`; m.resultingState = `region=${dest}; arrivalFacility=runtime preferred arrival`; m.implementationSource = 'tools/trpg-sim/lib/player-journey.mjs availableTravelActions';
    return resolvedPlayer(m, actionId, 'MOVE', { moveId: actionId });
  }
  if (rt === 'SHOP_BUY') {
    const name = row['行動'].replace(/を購入.*$/u, '').trim(); const entry = catalog.stockByName[name];
    if (!entry) return unresolved(m, 'MISSING_SHOP_STOCK');
    Object.assign(m, { facilityId: entry.facilityId, equipmentId: entry.equipmentId });
    m.requiredState = `stock ${entry.stockId} available; gold>=${entry.price}`; m.resultingState = `gold-=${entry.price}; inventory.equipment.${entry.equipmentId}+=1`;
    m.implementationSource = 'tools/trpg-sim/lib/shop-runtime.mjs buyEquipment';
    const explicitEquipRows = new Set(['VR2-D03-07', 'VR2-D03-08', 'VR2-D41-08', 'VR2-D46-09', 'VR2-D60-08']);
    if (explicitEquipRows.has(m.legacyRowId)) {
      return resolvedPlayer(m, entry.stockId, 'SHOP_BUY', { stockId: entry.stockId });
    }
    m.resultingState += `; equipment slot updated to ${entry.equipmentId}`;
    return resolvedSteps(m, [
      commandStep(entry.stockId, 'SHOP_BUY', { stockId: entry.stockId }),
      commandStep(entry.equipmentId, 'EQUIP', { equipmentId: entry.equipmentId }),
    ], 'purchase and equip are distinct server commands; the displayed IDs are the stockId and equipmentId resolved by service.js', 'EXACT_CANONICAL');
  }
  if (rt === 'SHOP_SELL') {
    const entry = catalog.equipmentSalesByDay[String(day)] ?? catalog.equipmentSalesByDay[day];
    if (!entry) return unresolved(m, 'MISSING_EQUIPMENT_SALE_ID');
    m.equipmentId = entry.equipmentId; m.facilityId = entry.facilityId;
    m.requiredState = `${entry.equipmentId} owned and equipped in ${entry.slot}; compatible seller at ${entry.facilityId}`;
    m.resultingState = `${entry.slot} unequipped; inventory.equipment.${entry.equipmentId}-=1; gold+=${entry.expectedPrice}`;
    m.implementationSource = 'tools/trpg-sim/lib/shop-runtime.mjs sellEquipment';
    return resolvedSteps(m, [
      commandStep(entry.slot, 'UNEQUIP', { slot: entry.slot }),
      commandStep(entry.equipmentId, 'SHOP_SELL', { equipmentId: entry.equipmentId }),
    ], 'equipped gear must be unequipped before the seller accepts it; both action IDs match service.js resolvedActionId', 'EXACT_CANONICAL');
  }
  if (rt === 'MATERIAL_SELL') return unresolved(m, 'MISSING_MATERIAL_LINEAGE', 'REPLACED_INVALID', 'must identify materialId/qty/source battle and compatible buyer');
  if (rt === 'SERVICE_BUY') {
    if (/簡易研ぎ|軽修理/u.test(row['行動'])) {
      const p = productById('ITM220'); m.productId = p.productId; m.facilityId = p.facilityId; m.requiredState = `at ${p.facilityId}; gold>=${p.price}`;
      m.resultingState = `gold-=${p.price}; repair service outcome`; m.implementationSource = 'src/server/trpg/content/canonical-world-life-actions.js';
      return resolvedPlayer(m, `SERVICE_BUY:${p.productId}`);
    }
    return unresolved(m, 'MISSING_SERVICE_PRODUCT');
  }
  if (rt === 'PAY_DEBT') return unresolved(m, 'MISSING_DEBT_RUNTIME_ID', 'REPLACED_INVALID', 'must bind to debt created by Day9 collapse outcome, then ordinary OBLIGATION:PAY:*:FULL');
  if (rt === 'COLLAPSE_RESCUE') return outcome(m, 'src/server/trpg/resolvers/player-collapse-resolver.js', 'collapse/rescuer/herb/debt are resolver outcomes, not a voluntary debt command');
  if (rt === 'WORLD_EVENT') return outcome(m, 'tools/trpg-sim/lib/player-journey.mjs trouble gates/consequences', 'T15/T18/T19 suppression is a world outcome');
  if (rt === 'RESOLVE_MISSION') return outcome(m, 'mission resolution/reward resolver', 'reward/EXP/Lv/trouble state are consequences of the preceding resolution command');
  if (rt === 'LOCAL_INVESTIGATE') return unresolved(m, 'INVALID_LONG_LOCAL_INVESTIGATE', 'REPLACED_INVALID', 'replace Day8 night with canonical JOB-FARM-04 + authored T03 progression; no 8h hidden action');
  if (rt === 'MISSION/INTERACT') {
    if (!trouble && workFlavor.test(row['行動'])) return narrative(m, 'legacy scene split', 'job-like flavor has no wage here; canonical WORK row carries the actual paid command');
    if (!trouble && arrivalFlavor.test(row['行動'])) return narrative(m, 'legacy arrival/continuity narration');
    if (trouble && compositeFlavor.test(row['行動'])) return unresolved(m, 'COMPOSITE_MISSION_ROW', 'REPLACED_INVALID', 'split investigation/movement/battle/rescue into ordinary actions');
    if (trouble && /主要戦闘/u.test(row['行動'])) {
      const id = `ACTION:${troubleMissionId(trouble)}:battle`; m.implementationSource = 'tools/trpg-sim/lib/player-journey.mjs missionActions'; m.resultingState = 'battle outcome applied by runtime';
      return resolvedPlayer(m, id);
    }
    if (trouble && battleFlavor.test(row['行動'])) return unresolved(m, 'MISSION_BATTLE_OR_AUTHORED_SPLIT', 'REPLACED_INVALID', 'description may combine evidence, battle or rescue; requires exact current mission step match');
    if (trouble) return unresolved(m, 'MISSING_AUTHORED_MISSION_MATCH', 'REPLACED_INVALID', 'match against current-head authored flow pack/bridge/revisit action');
    return unresolved(m, 'MISSING_DAILY_INTERACTION_MATCH', 'REPLACED_INVALID', 'reclassify to TALK/general action or NARRATIVE_OUTCOME');
  }
  if (rt === 'INTERACT') {
    if (/購入済み.*返す/u.test(row['行動'])) return unresolved(m, 'COMPOSITE_EQUIPMENT_INTERACTION', 'REPLACED_INVALID', 'split equip/unequip/return-loan narrative as applicable');
    if (arrivalFlavor.test(row['行動'])) return narrative(m, 'legacy arrival/continuity narration');
    return unresolved(m, 'MISSING_NPC_INTERACTION', 'REPLACED_INVALID', 'bind to TALK:<npcId> only when NPC presence/state and meaningful player choice are concrete; otherwise narrative outcome');
  }
  return unresolved(m, 'UNSUPPORTED_LEGACY_ACTION');
}

function annotateLocalMoves(mappings) {
  const moves = [];
  let prevKnown = null;
  for (const m of mappings) {
    const explicitRegional = m.actionId.startsWith('MOVE_REGION:');
    if (explicitRegional) { prevKnown = { region: m.regionId, facilityId: catalog.defaultArrivalFacility[m.regionId] ?? '' }; continue; }
    if (!m.facilityId) continue;
    if (prevKnown && prevKnown.region === m.regionId && prevKnown.facilityId && prevKnown.facilityId !== m.facilityId) {
      const id = `MOVE_LOCAL:${m.facilityId}`;
      moves.push({ beforeLegacyRowId: m.legacyRowId, regionId: m.regionId, fromFacilityId: prevKnown.facilityId, toFacilityId: m.facilityId, actionId: id, commandType: 'MOVE', payload: { moveId: id }, source: 'tools/trpg-sim/lib/player-journey.mjs availableLocalMovementActions' });
      m.replacementRowIds = `${id}|${m.legacyRowId}:ACTION`;
    } else if (!m.replacementRowIds) m.replacementRowIds = `${m.legacyRowId}:ACTION`;
    prevKnown = { region: m.regionId, facilityId: m.facilityId };
  }
  for (const m of mappings) if (!m.replacementRowIds) m.replacementRowIds = `${m.legacyRowId}:${m.classification}`;
  return moves;
}

function main() {
  const args = process.argv.slice(2); const input = args[0] ? path.resolve(args[0]) : DEFAULT_INPUT; const outDir = args[1] ? path.resolve(args[1]) : DEFAULT_OUT;
  const inputText = readInputCsv(input); const source = sourceMetadata(input, inputText);
  const matrix = parseCsv(inputText); const headers = matrix[0];
  const sourceRows = matrix.slice(1).filter((r) => r.some((c) => c !== '')).map((cells) => Object.fromEntries(headers.map((h,i) => [h, cells[i] ?? ''])));
  if (sourceRows.length !== 831) throw new Error(`expected 831 legacy rows, got ${sourceRows.length}`);
  if (source.dataRows != null && source.dataRows !== sourceRows.length) throw new Error(`metadata row count ${source.dataRows} != ${sourceRows.length}`);
  if (source.columns != null && source.columns !== headers.length) throw new Error(`metadata column count ${source.columns} != ${headers.length}`);
  const mappings = sourceRows.map(convertRow); const localMoves = annotateLocalMoves(mappings);
  const unresolvedRows = mappings.filter((m) => m.status === 'UNRESOLVED');
  const counts = (key, rows = mappings) => Object.fromEntries([...new Set(rows.map((r) => r[key] || '(blank)'))].sort().map((v) => [v, rows.filter((r) => (r[key] || '(blank)') === v).length]));
  const summary = {
    compilerVersion: 'virtue-route-v3-static-compiler-v5', sourceHead: process.env.GITHUB_SHA ?? catalog.sourceHead,
    generatedAt: source.fetchedAt ?? new Date().toISOString(),
    sourceSpreadsheetId: source.spreadsheetId, sourceSpreadsheetTitle: source.spreadsheetTitle ?? null,
    sourceSheetName: source.sheetName, sourceSheetId: source.sheetId ?? null,
    sourceRange: source.range ?? null, sourceRowCount: sourceRows.length,
    sourceColumnCount: headers.length, sourceFetchedAt: source.fetchedAt,
    sourceHashAlgorithm: 'sha256', sourceHash: source.sourceHash,
    legacyRows: sourceRows.length, mappedRows: mappings.length, autoResolvedRows: mappings.length - unresolvedRows.length, unresolvedRows: unresolvedRows.length,
    provisionalCoveragePercent: Number((((mappings.length - unresolvedRows.length) / mappings.length) * 100).toFixed(2)),
    byLegacyRuntimeAction: counts('legacyRuntimeAction'), byClassification: counts('classification'), byStatus: counts('status'),
    unresolvedByReason: counts('unresolvedReason', unresolvedRows), canonicalJobsInCatalog: catalog.jobs.length, canonicalProductsInCatalog: runtimeProducts.length,
    exactAuthoredOverrideRows: mappings.filter((m) => m.resolutionMethod === 'EXACT_AUTHORED').length,
    workRowsReallocated: mappings.filter((m) => m.jobId && /reallocated/u.test(m.notes)).length,
    proposedMoveLocalInsertions: localMoves.length,
    regionalMoveRows: mappings.filter((m) => m.actionId.startsWith('MOVE_REGION:')).length,
    forbiddenStatusRows: mappings.filter((m) => FORBIDDEN_STATUS.test(m.status)).length,
    nonFinalStatusRows: mappings.filter((m) => !FINAL_STATUSES.has(m.status)).length,
    forbiddenReplayExecuted: false,
  };
  fs.mkdirSync(outDir,{recursive:true});
  const columns = ['legacyRowIndex','legacyRowId','legacyDay','legacyTime','legacyDescription','legacyRuntimeAction','legacyRegion','classification','replacementRowIds','replacementSteps','resolutionMethod','commandType','choiceId','actionId','payload','regionId','facilityId','npcIds','troubleId','jobId','productId','equipmentId','materialId','skillId','requiredState','resultingState','implementationSource','status','unresolvedReason','plannedStart','plannedEnd','notes'];
  fs.writeFileSync(path.join(outDir,'virtue-route-v3-mapping.csv'), toCsv(mappings, columns));
  fs.writeFileSync(path.join(outDir,'virtue-route-v3-unresolved.json'), JSON.stringify({ sourceHead: summary.sourceHead, sourceHash: source.sourceHash, count: unresolvedRows.length, rows: unresolvedRows }, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir,'virtue-route-v3-static-summary.json'), JSON.stringify(summary,null,2) + '\n');
  fs.writeFileSync(path.join(outDir,'virtue-route-v3-proposed-local-moves.json'), JSON.stringify({ sourceHead: summary.sourceHead, sourceHash: source.sourceHash, count: localMoves.length, moves: localMoves },null,2) + '\n');
  console.log(JSON.stringify(summary,null,2));
}
main();
