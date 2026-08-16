#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { CANONICAL_WORLD_LIFE_INTERNALS } from '../../src/server/trpg/content/canonical-world-life-actions.js';

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
function resolvedSteps(m, steps, notes = '') {
  if (!Array.isArray(steps) || steps.length < 2) throw new Error(`multi-step mapping requires at least two commands: ${m.legacyRowId}`);
  m.classification = 'PLAYER_COMMAND_SEQUENCE';
  m.commandType = 'SEQUENCE';
  m.actionId = steps.at(-1).actionId;
  m.payload = JSON.stringify({ steps });
  m.replacementSteps = JSON.stringify(steps);
  m.replacementRowIds = steps.map((_, index) => `${m.legacyRowId}:S${String(index + 1).padStart(2, '0')}`).join('|');
  m.resolutionMethod = 'EXACT_AUTHORED';
  m.status = 'RESOLVED_EXISTING';
  m.notes = notes;
  return m;
}
function outcome(m, source, notes = '') {
  m.classification = 'COMMAND_OUTCOME'; m.status = 'OUTCOME'; m.implementationSource = source; m.notes = notes; return m;
}
function narrative(m, source, notes = '') {
  m.classification = 'NARRATIVE_OUTCOME'; m.status = 'OUTCOME'; m.implementationSource = source; m.notes = notes; return m;
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

const workFlavor = /皿洗い|麻袋|麦刈り|荷運び|荷役|棚卸|船具|帆布|厨房|炊事|薪|仕分|水汲み|掃除|図面|鉱石|仕事|労働/u;
const arrivalFlavor = /到着後|旅装を整え|宿・情報屋|街の様子|入口|着いて|到着/u;
const battleFlavor = /主要戦闘|戦闘|撃破|退け|護衛を倒|衛兵像|魔物|狼|甲虫|スライム/u;
const compositeFlavor = /救出.*(戦闘|撃破)|足跡を追い.*救出|調査.*戦闘|購入済み.*返す/u;

function exactAuthoredOverride(m) {
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
      commandStep('MOVE_REGION:田園の村', 'MOVE', { moveId: 'MOVE_REGION:田園の村' }, { regionId: '田園の村', facilityId: 'LOC_FARM_SQUARE' }),
    ], 'canonical resolution is in the forest; v3 expands travel and must reallocate legacy timing');
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
    return resolvedPlayer(m, 'LEARN_SKILL', 'LEARN_SKILL', { skillId: id });
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
    return unresolved(m, 'REST_SPLIT_REQUIRED', 'REPLACED_INVALID', `legacy rest ${minutes ?? '?'}min is not one public REST action`);
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
    return resolvedPlayer(m, 'SHOP_BUY', 'SHOP_BUY', { stockId: entry.stockId });
  }
  if (rt === 'SHOP_SELL') {
    const entry = catalog.equipmentSalesByDay[String(day)] ?? catalog.equipmentSalesByDay[day];
    if (!entry) return unresolved(m, 'MISSING_EQUIPMENT_SALE_ID');
    m.equipmentId = entry.equipmentId; m.requiredState = `${entry.equipmentId} owned, unequipped, compatible seller present`; m.resultingState = `inventory.equipment.${entry.equipmentId}-=1; gold+=quote`;
    m.implementationSource = 'tools/trpg-sim/lib/shop-runtime.mjs sellEquipment';
    return resolvedPlayer(m, 'SHOP_SELL', 'SHOP_SELL', { equipmentId: entry.equipmentId });
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
    compilerVersion: 'virtue-route-v3-static-compiler-recovery-v3', sourceHead: process.env.GITHUB_SHA ?? catalog.sourceHead,
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
