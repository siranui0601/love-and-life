#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { parseCsv, csvCell } from './export-virtue-route-v2-source.mjs';
import { CANONICAL_WORLD_LIFE_INTERNALS } from '../../src/server/trpg/content/canonical-world-life-actions.js';
import { CANONICAL_MATERIAL_ECONOMY_INTERNALS } from '../../src/server/trpg/content/canonical-material-economy.js';
import { AUTHORED_PUBLIC_LIFE_NETWORK_INTERNALS } from '../../src/server/trpg/content/authored-public-life-network.js';
import { AUTHORED_DAY2_T01_MERCHANT_PAYMENT_INTERNALS } from '../../src/server/trpg/content/authored-mission-flow-day2-t01-merchant-payment.js';
import { loadTrpgGameData } from '../../src/server/trpg/game/game-data.js';
import { applyGameplayCatalogOverrides } from '../../src/server/trpg/game/service.js';
import { createMissionCatalog, experienceToNextLevel } from './lib/mission-model.mjs';
import { createSeededRng, expandEncounter } from './lib/battle-model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_MAPPING = path.join(ROOT, 'docs/trpg/virtue-route-v3-mapping.csv');
const DEFAULT_SOURCE = path.join(ROOT, 'docs/trpg/virtue-route-v2-source.csv');
const DEFAULT_OUT = path.join(ROOT, 'docs/trpg');
const CATALOG_PATH = path.join(HERE, 'lib/virtue-route-v3-runtime-catalog.json');
const STATIC_ROUTE_SEED = 'virtue-route-v3-static-20260816';

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const jobs = new Map(catalog.jobs.map((job) => [job.jobId, job]));
const products = new Map(catalog.products.map((product) => [product.productId, product]));
for (const [productId, tuple] of Object.entries(CANONICAL_WORLD_LIFE_INTERNALS.PRODUCTS)) {
  if (products.has(productId)) continue;
  const [region, facilityId, , label, price, kind, portions = 1, condition = null] = tuple;
  products.set(productId, { productId, region, facilityId, label, price, kind, portions, condition });
}
const stock = new Map(Object.values(catalog.stockByName).map((entry) => [entry.stockId, entry]));
const materialPrices = CANONICAL_MATERIAL_ECONOMY_INTERNALS.MATERIAL_BUYBACK_G;
const gameData = loadTrpgGameData();
const missionCatalog = createMissionCatalog(gameData.model, gameData.battleData);
applyGameplayCatalogOverrides(missionCatalog);

const publicLifeChoices = new Map();
for (const scene of AUTHORED_PUBLIC_LIFE_NETWORK_INTERNALS.SCENES) {
  for (const choice of scene.choices) {
    const sceneKey = scene.id.toUpperCase().replaceAll('-', '_');
    publicLifeChoices.set(`PUBLIC_LIFE:${sceneKey}:${choice.id}`, { scene, choice });
  }
}
const merchantChoices = new Map(AUTHORED_DAY2_T01_MERCHANT_PAYMENT_INTERNALS.CHOICES
  .map((choice) => [`MISSION_FLOW:T01:DAY2_MERCHANT_PAYMENT:${choice.id}`, choice]));

function readArchived(file) {
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  const archive = `${file}.gz.b64`;
  if (!fs.existsSync(archive)) throw new Error(`required input missing: ${file}`);
  return zlib.gunzipSync(Buffer.from(fs.readFileSync(archive, 'utf8').replace(/\s/gu, ''), 'base64')).toString('utf8');
}

function objects(text) {
  const matrix = parseCsv(text);
  const headers = matrix[0];
  return matrix.slice(1).filter((row) => row.some((cell) => cell !== '')).map((cells) => Object.fromEntries(
    headers.map((header, index) => [header, cells[index] ?? '']),
  ));
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function mismatchAudit(rows) {
  return {
    sha256: sha256(JSON.stringify(rows)),
    first: rows.slice(0, 5),
    last: rows.slice(-5),
  };
}

function number(value) {
  const parsed = Number(String(value ?? '').replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function lastNumber(value, fallback = null) {
  const values = String(value ?? '').match(/-?\d+(?:\.\d+)?/gu)?.map(Number) ?? [];
  return values.length ? values.at(-1) : fallback;
}

function minute(value) {
  const match = /^(\d{1,2}):(\d{2})(?:\(\+1\))?$/u.exec(String(value ?? '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]) + (String(value).includes('(+1)') ? 1440 : 0);
}

function steps(row) {
  if (row.replacementSteps) return JSON.parse(row.replacementSteps);
  return row.actionId ? [{ actionId: row.actionId, commandType: row.commandType, payload: JSON.parse(row.payload || '{}') }] : [];
}

function parseSp(value) {
  const match = /^(\d+)\/(\d+)\/(\d+)$/u.exec(String(value ?? '').trim());
  return match ? { total: Number(match[1]), used: Number(match[2]), remaining: Number(match[3]) } : null;
}

function conditionMet(condition, state) {
  if (!condition) return true;
  if (condition === 'villageTrust>=2') return number(state.trust.villageTrust) >= 2;
  if (condition === 'reputation>=1') return number(state.trust.reputation) >= 1;
  if (condition === 'petraTrust>=1') return number(state.trust.petraTrust) >= 1;
  if (condition === 'minaTrust>=1') return number(state.trust.minaTrust) >= 1;
  if (condition === 'technicalKnowledge||minaTrust>=2') return state.flags.has('technicalKnowledge') || number(state.trust.minaTrust) >= 2;
  if (condition === 'fortEntryPermit') return state.flags.has('fortEntryPermit');
  if (condition === 'blackridgeEntryPermit') return state.flags.has('blackridgeEntryPermit');
  if (condition === 'hunterApproval') return state.flags.has('hunterApproval');
  if (condition === 'elfApproval') return state.flags.has('elfApproval');
  if (condition === 'sameDayPortWork') return state.portWorkDays.has(state.day);
  return false;
}

function itemCounts(entries) {
  return Object.fromEntries([...entries.entries()].filter(([, count]) => count !== 0).sort(([a], [b]) => a.localeCompare(b)));
}

function csv(rows, columns) {
  return `${columns.map(csvCell).join(',')}\n${rows.map((row) => columns.map((column) => csvCell(row[column] ?? '')).join(',')).join('\n')}\n`;
}

function missionAction(actionId, day) {
  const match = /^ACTION:(MSN-T\d{2}):([^:]+)/u.exec(String(actionId ?? ''));
  if (!match) return null;
  const mission = missionCatalog.byId.get(match[1]);
  const step = mission?.steps.find((entry) => entry.id === match[2]);
  if (!mission || !step) return { mission, step, variant: null, missionId: match[1], stepId: match[2] };
  const variant = step.timelineVariants?.find((entry) =>
    Number(day) >= Number(entry.minDay ?? -Infinity)
    && Number(day) <= Number(entry.maxDay ?? Infinity)) ?? step;
  return { mission, step, variant, missionId: match[1], stepId: match[2] };
}

export function validateStaticRoute({ mappingPath = DEFAULT_MAPPING, sourcePath = DEFAULT_SOURCE, outDir = DEFAULT_OUT } = {}) {
  const mappingText = readArchived(mappingPath);
  const sourceText = readArchived(sourcePath);
  const mappings = objects(mappingText);
  const sourceRows = objects(sourceText);
  const sourceById = new Map(sourceRows.map((row) => [row['action ID'], row]));
  const errors = [];
  const checks = [];
  const ledger = [];
  const state = {
    day: 1,
    gold: 0,
    minGold: 0,
    minGoldRow: 'START',
    income: 0,
    expense: 0,
    incomeBySource: {},
    expenseBySource: {},
    freeMeals: 1,
    freeLodging: 1,
    provisions: new Map(),
    equipment: new Map(),
    equipped: {},
    skills: new Set(),
    spTotal: 2,
    spUsed: 0,
    level: 1,
    exp: 0,
    totalExp: 0,
    battleExp: 0,
    missionExp: 0,
    battleIndex: 0,
    experienceTransitions: [],
    missionRewardsGranted: new Set(),
    legacyLevelMismatchRows: [],
    legacySpMismatchRows: [],
    debt: 0,
    debtStatus: 'none',
    trust: {},
    flags: new Set(),
    facts: new Set(),
    npcGoals: new Map(),
    npcLocations: new Map(),
    incidentStates: {},
    portWorkDays: new Set(),
    workDayFacility: new Map(),
    equipmentTransitions: [],
    skillTransitions: [],
    maximumHunger: 0,
    maximumFatigue: 0,
    minimumHp: 100,
    minimumMp: 100,
  };

  function fail(code, rowId, detail) {
    errors.push({ code, rowId, detail });
  }

  function addGold(amount, source, rowId) {
    const delta = number(amount);
    if (!delta) return;
    const before = state.gold;
    if (delta < 0 && before < -delta) fail('INSUFFICIENT_GOLD', rowId, `${source}: ${before}G < ${-delta}G`);
    state.gold += delta;
    if (delta > 0) {
      state.income += delta;
      state.incomeBySource[source] = number(state.incomeBySource[source]) + delta;
    } else {
      state.expense += -delta;
      state.expenseBySource[source] = number(state.expenseBySource[source]) + -delta;
    }
    if (state.gold < state.minGold) {
      state.minGold = state.gold;
      state.minGoldRow = rowId;
    }
  }

  function addExperience(amount, source, rowId, detail = {}) {
    const gain = Math.max(0, Math.round(number(amount)));
    if (!gain) return;
    const levelBefore = state.level;
    const expBefore = state.exp;
    state.exp += gain;
    state.totalExp += gain;
    if (source === 'battle') state.battleExp += gain;
    if (source === 'mission') state.missionExp += gain;
    while (state.level < 24 && state.exp >= experienceToNextLevel(state.level)) {
      state.exp -= experienceToNextLevel(state.level);
      state.level += 1;
      state.spTotal += 1;
    }
    state.experienceTransitions.push({
      rowId,
      source,
      gain,
      levelBefore,
      levelAfter: state.level,
      expBefore,
      expAfter: state.exp,
      ...detail,
    });
  }

  function creditPublicLife(actionId, rowId) {
    const found = publicLifeChoices.get(actionId);
    if (!found) return false;
    const { scene, choice } = found;
    state.freeMeals += number(choice.freeMeals);
    state.freeLodging += number(choice.freeLodging);
    for (const [key, value] of Object.entries(choice.trust ?? {})) {
      state.trust[key] = number(state.trust[key]) + number(value);
    }
    for (const flag of choice.flags ?? []) state.flags.add(flag);
    if (choice.factId) state.facts.add(choice.factId);
    for (const npcId of choice.npcIds ?? []) {
      state.npcLocations.set(npcId, `${scene.location}|${scene.facilityId}`);
      if (choice.goal) state.npcGoals.set(npcId, choice.goal);
    }
    checks.push({ type: 'PUBLIC_LIFE', rowId, actionId });
    return true;
  }

  function applyStep(step, mapping) {
    const actionId = String(step.actionId ?? '');
    const rowId = mapping.legacyRowId;
    if (!actionId) return;

    const mission = missionAction(actionId, mapping.legacyDay);
    if (mission) {
      if (!mission.mission || !mission.step) {
        fail('MISSING_RUNTIME_MISSION_ACTION', rowId, actionId);
        return;
      }
      const actionType = mission.variant?.actionType ?? mission.step.type;
      const encounterId = mission.variant?.encounterId ?? mission.step.encounterId;
      if (actionType === 'missionBattle' || (mission.step.type === 'battle' && actionType !== 'investigate')) {
        if (!encounterId || !gameData.battleData.encounterById.has(encounterId)) {
          fail('MISSING_RUNTIME_ENCOUNTER', rowId, `${actionId}:${encounterId ?? 'none'}`);
          return;
        }
        const battleKey = `${STATIC_ROUTE_SEED}:mission:${mission.missionId}:${state.battleIndex}`;
        const monsterIds = expandEncounter(
          gameData.battleData,
          encounterId,
          createSeededRng(battleKey),
        );
        const reward = monsterIds.reduce((total, monsterId) =>
          total + number(gameData.battleData.monsterById.get(monsterId)?.exp), 0);
        addExperience(reward, 'battle', rowId, {
          actionId,
          encounterId,
          battleIndex: state.battleIndex,
          monsterIds,
        });
        state.battleIndex += 1;
      }
    }

    if (creditPublicLife(actionId, rowId)) return;
    const merchant = merchantChoices.get(actionId);
    if (merchant) {
      addGold(number(merchant.goldDelta), 'authoredLivelihood', rowId);
      return;
    }

    if (actionId.startsWith('REGIONAL_ACCESS:')) {
      const keys = {
        'REGIONAL_ACCESS:DWARF:copy_rescue_drawing': 'technicalKnowledge',
        'REGIONAL_ACCESS:FORT:register_supply_pass': 'fortEntryPermit',
        'REGIONAL_ACCESS:FOREST:accept_hunter_rules': 'hunterApproval',
        'REGIONAL_ACCESS:ELF:accept_guest_bough_invitation': 'elfApproval',
        'REGIONAL_ACCESS:BLACKRIDGE:register_waterway_stay': 'blackridgeEntryPermit',
      };
      if (keys[actionId]) state.flags.add(keys[actionId]);
      return;
    }

    if (actionId.startsWith('WORK:FACILITY:')) {
      const jobId = actionId.slice('WORK:FACILITY:'.length);
      const job = jobs.get(jobId);
      if (!job) {
        fail('MISSING_JOB', rowId, jobId);
        return;
      }
      const key = `${mapping.legacyDay}|${job.facilityId}`;
      if (state.workDayFacility.has(key)) fail('DUPLICATE_JOB_FACILITY_DAY', rowId, `${key} already used by ${state.workDayFacility.get(key)}`);
      state.workDayFacility.set(key, `${rowId}:${jobId}`);
      const start = minute(step.scheduledStart ?? mapping.plannedStart);
      const end = minute(step.scheduledEnd ?? mapping.plannedEnd);
      if (start == null || !job.windows.some(([from, to]) => start >= from && start + job.minutes <= to)) {
        fail('JOB_OUTSIDE_WINDOW', rowId, `${jobId}@${step.scheduledStart ?? mapping.plannedStart}`);
      }
      if (end != null && end - start !== job.minutes) fail('JOB_DURATION_MISMATCH', rowId, `${jobId}:${end - start}!=${job.minutes}`);
      if (!conditionMet(job.condition, state)) fail('JOB_CONDITION_UNMET', rowId, `${jobId}:${job.condition}`);
      addGold(job.wage, 'work', rowId);
      state.freeMeals += number(job.freeMeals);
      if (jobId === 'JOB-TRADE-01' || jobId === 'JOB-TRADE-02') state.portWorkDays.add(Number(mapping.legacyDay));
      return;
    }

    if (actionId.startsWith('LIFE:BUY:')) {
      const productId = actionId.slice('LIFE:BUY:'.length);
      const product = products.get(productId);
      if (!product || product.kind !== 'provision') {
        fail('INVALID_PROVISION_PURCHASE', rowId, productId);
        return;
      }
      addGold(-product.price, 'food', rowId);
      state.provisions.set(productId, number(state.provisions.get(productId)) + number(product.portions || 1));
      return;
    }

    if (actionId.startsWith('LIFE:EAT:')) {
      const productId = actionId.slice('LIFE:EAT:'.length);
      const product = products.get(productId);
      if (!product) {
        fail('MISSING_PRODUCT', rowId, productId);
        return;
      }
      if (product.kind === 'provision') {
        const owned = number(state.provisions.get(productId));
        if (owned < 1) fail('PROVISION_UNDERFLOW', rowId, productId);
        state.provisions.set(productId, owned - 1);
      } else if (product.kind === 'meal') {
        if (product.price > 0 && state.freeMeals > 0) state.freeMeals -= 1;
        else addGold(-product.price, 'food', rowId);
      } else fail('INVALID_MEAL_PRODUCT', rowId, `${productId}:${product.kind}`);
      return;
    }

    if (actionId.startsWith('LIFE:SLEEP:')) {
      const productId = actionId.slice('LIFE:SLEEP:'.length);
      const product = products.get(productId);
      if (!product || !['lodging', 'camp', 'worker_lodging'].includes(product.kind)) {
        fail('INVALID_LODGING_PRODUCT', rowId, productId);
        return;
      }
      if (!conditionMet(product.condition, state)) fail('LODGING_CONDITION_UNMET', rowId, `${productId}:${product.condition}`);
      if (product.kind === 'worker_lodging' && !state.portWorkDays.has(Number(mapping.legacyDay))) {
        fail('WORKER_LODGING_WITHOUT_PORT_WORK', rowId, productId);
      }
      if (product.price > 0 && state.freeLodging > 0) state.freeLodging -= 1;
      else addGold(-product.price, 'lodging', rowId);
      return;
    }

    if (actionId.startsWith('SERVICE_BUY:')) {
      const productId = actionId.slice('SERVICE_BUY:'.length);
      const product = products.get(productId);
      if (!product || !['repair', 'treatment'].includes(product.kind)) fail('INVALID_SERVICE_PRODUCT', rowId, productId);
      else addGold(-product.price, 'service', rowId);
      return;
    }

    if (actionId.startsWith('MATERIAL_SELL:')) {
      const [, materialId, quantityText] = actionId.split(':');
      const quantity = number(String(quantityText).replace(/^Q/u, ''));
      const price = number(materialPrices[materialId]);
      if (!price || quantity < 1) fail('INVALID_MATERIAL_SALE', rowId, actionId);
      else addGold(price * quantity, 'materialSale', rowId);
      return;
    }

    if (actionId.startsWith('OBLIGATION:PAY:')) {
      if (state.debt !== 6 || state.debtStatus !== 'open') fail('DEBT_NOT_OPEN', rowId, `${state.debtStatus}:${state.debt}`);
      addGold(-state.debt, 'debt', rowId);
      state.debt = 0;
      state.debtStatus = 'paid';
      return;
    }

    if (step.commandType === 'SHOP_BUY') {
      const entry = stock.get(step.payload?.stockId ?? actionId);
      if (!entry) fail('MISSING_STOCK', rowId, actionId);
      else {
        addGold(-entry.price, 'equipmentBuy', rowId);
        state.equipment.set(entry.equipmentId, number(state.equipment.get(entry.equipmentId)) + 1);
        state.equipmentTransitions.push({ rowId, type: 'buy', equipmentId: entry.equipmentId, gold: -entry.price });
      }
      return;
    }

    if (step.commandType === 'SHOP_SELL') {
      const equipmentId = step.payload?.equipmentId ?? actionId;
      const owned = number(state.equipment.get(equipmentId));
      if (owned < 1) fail('EQUIPMENT_NOT_OWNED', rowId, equipmentId);
      const sale = catalog.equipmentSalesByDay[String(mapping.legacyDay)];
      if (!sale || sale.equipmentId !== equipmentId) fail('MISSING_EQUIPMENT_SALE_PRICE', rowId, equipmentId);
      else addGold(sale.expectedPrice, 'equipmentSale', rowId);
      state.equipment.set(equipmentId, owned - 1);
      state.equipmentTransitions.push({ rowId, type: 'sell', equipmentId, gold: number(sale?.expectedPrice) });
      return;
    }

    if (step.commandType === 'EQUIP') {
      const equipmentId = step.payload?.equipmentId ?? actionId;
      if (number(state.equipment.get(equipmentId)) < 1) fail('EQUIPMENT_NOT_OWNED', rowId, equipmentId);
      const slot = /^EQP-W-/u.test(equipmentId) ? 'mainHand' : /^EQP-S-/u.test(equipmentId) ? 'offHand' : 'body';
      state.equipped[slot] = equipmentId;
      state.equipmentTransitions.push({ rowId, type: 'equip', equipmentId, slot });
      return;
    }

    if (step.commandType === 'UNEQUIP') {
      const slot = step.payload?.slot ?? actionId;
      delete state.equipped[slot];
      state.equipmentTransitions.push({ rowId, type: 'unequip', slot });
      return;
    }

    if (step.commandType === 'LEARN_SKILL') {
      const skillId = step.payload?.skillId ?? actionId;
      if (state.spTotal - state.spUsed < 1) fail('INSUFFICIENT_SP', rowId, skillId);
      if (state.skills.has(skillId)) fail('DUPLICATE_SKILL', rowId, skillId);
      state.skills.add(skillId);
      state.spUsed += 1;
      state.skillTransitions.push({ rowId, skillId, spAfter: state.spTotal - state.spUsed });
    }
  }

  if (mappings.length !== 831 || sourceRows.length !== 831) fail('ROW_COUNT', 'SOURCE', `${mappings.length}/${sourceRows.length}`);
  if (mappings.some((row) => /^(?:UNMAPPED|UNKNOWN|TODO|PARTIAL)$/u.test(row.status))) fail('FORBIDDEN_STATUS', 'MAPPING', 'non-final row status');

  for (const mapping of mappings) {
    const source = sourceById.get(mapping.legacyRowId);
    if (!source) {
      fail('SOURCE_ROW_MISSING', mapping.legacyRowId, 'no v2 row');
      continue;
    }
    state.day = Number(mapping.legacyDay);
    const goldBefore = state.gold;
    const incomeBefore = state.income;
    const expenseBefore = state.expense;

    if (mapping.legacyRuntimeAction === 'RESOLVE_MISSION') addGold(number(source['収入']), 'mission', mapping.legacyRowId);
    if (mapping.legacyRuntimeAction === 'COLLAPSE_RESCUE') {
      state.debt = 6;
      state.debtStatus = 'open';
    }

    const authoredSp = parseSp(source['SP(累計/使用/残)']);
    for (const step of steps(mapping)) applyStep(step, mapping);

    state.maximumHunger = Math.max(state.maximumHunger, lastNumber(source['空腹前'], 0), lastNumber(source['空腹後'], 0));
    state.maximumFatigue = Math.max(state.maximumFatigue, lastNumber(source['疲労前'], 0), lastNumber(source['疲労後'], 0));
    state.minimumHp = Math.min(state.minimumHp, lastNumber(source.HP, 100));
    state.minimumMp = Math.min(state.minimumMp, lastNumber(source.MP, 100));
    for (const match of String(source['事件状態'] ?? '').matchAll(/(T\d{2})=(resolved|suppressed|failed|active|critical)/gu)) {
      if (match[2] === 'resolved' && state.incidentStates[match[1]] !== 'resolved') {
        const mission = missionCatalog.byId.get(`MSN-${match[1]}`);
        if (mission && !state.missionRewardsGranted.has(mission.id)) {
          addExperience(mission.expReward, 'mission', mapping.legacyRowId, { missionId: mission.id });
          state.missionRewardsGranted.add(mission.id);
        }
      }
      state.incidentStates[match[1]] = match[2];
    }

    const legacyLevel = number(source.Lv);
    if (legacyLevel && legacyLevel !== state.level) {
      state.legacyLevelMismatchRows.push({ rowId: mapping.legacyRowId, legacyLevel, v3Level: state.level });
    }
    if (authoredSp && (authoredSp.total !== state.spTotal
      || authoredSp.used !== state.spUsed
      || authoredSp.remaining !== state.spTotal - state.spUsed)) {
      state.legacySpMismatchRows.push({
        rowId: mapping.legacyRowId,
        legacy: `${authoredSp.total}/${authoredSp.used}/${authoredSp.remaining}`,
        v3: `${state.spTotal}/${state.spUsed}/${state.spTotal - state.spUsed}`,
      });
    }

    const npcIds = String(mapping.npcIds ?? '').split('|').filter(Boolean);
    for (const npcId of npcIds) if (mapping.facilityId) state.npcLocations.set(npcId, `${mapping.regionId}|${mapping.facilityId}`);

    ledger.push({
      legacyRowId: mapping.legacyRowId,
      day: mapping.legacyDay,
      plannedTime: `${mapping.plannedStart}->${mapping.plannedEnd}`,
      regionId: mapping.regionId,
      facilityId: mapping.facilityId,
      actionIds: steps(mapping).map((step) => step.actionId).join('|'),
      goldBefore,
      income: state.income - incomeBefore,
      expense: state.expense - expenseBefore,
      goldAfter: state.gold,
      freeMeals: state.freeMeals,
      freeLodging: state.freeLodging,
      provisions: JSON.stringify(itemCounts(state.provisions)),
      equipment: JSON.stringify(state.equipped),
      debt: state.debt,
      level: state.level,
      expIntoLevel: state.exp,
      totalExp: state.totalExp,
      expGain: state.experienceTransitions
        .filter((entry) => entry.rowId === mapping.legacyRowId)
        .reduce((total, entry) => total + entry.gain, 0),
      sp: `${state.spTotal}/${state.spUsed}/${state.spTotal - state.spUsed}`,
      skills: [...state.skills].sort().join('|'),
      incidentState: source['事件状態'] ?? '',
      worldState: source['世界状態'] ?? '',
    });
  }

  for (let index = 1; index <= 19; index += 1) {
    const troubleId = `T${String(index).padStart(2, '0')}`;
    if (!state.incidentStates[troubleId]) fail('INCIDENT_NOT_TERMINAL', troubleId, 'no final authored state');
  }
  if (Object.keys(state.incidentStates).some((id) => id === 'T20')) fail('FORBIDDEN_T20', 'T20', 'T20 must not exist');
  if (state.debt !== 0 || state.debtStatus !== 'paid') fail('DEBT_REMAINS', 'FINAL', `${state.debtStatus}:${state.debt}`);
  if ([...state.provisions.values()].some((count) => count < 0)) fail('NEGATIVE_PROVISION', 'FINAL', JSON.stringify(itemCounts(state.provisions)));

  const finalSp = state.spTotal - state.spUsed;
  const summary = {
    validatorVersion: 'virtue-route-v3-static-validator-v2',
    compilerVersion: 'virtue-route-v3-static-compiler-v6',
    sourceSpreadsheetId: '1aSLu_pSLNsFsUm42juEyOrLDmTkJd7NPOOrQNnvnMwA',
    sourceSheetName: '正規台帳',
    sourceRows: sourceRows.length,
    sourceColumns: Object.keys(sourceRows[0] ?? {}).length,
    sourceHashAlgorithm: 'sha256',
    sourceHash: sha256(sourceText),
    mappingRows: mappings.length,
    mappingHashAlgorithm: 'sha256',
    mappingHash: sha256(mappingText),
    result: errors.length ? 'FAIL' : 'PASS',
    errorCount: errors.length,
    errors,
    checks: {
      unmapped: mappings.filter((row) => row.status === 'UNMAPPED').length,
      unknown: mappings.filter((row) => row.status === 'UNKNOWN').length,
      todo: mappings.filter((row) => row.status === 'TODO').length,
      partial: mappings.filter((row) => row.status === 'PARTIAL').length,
      workCommands: state.workDayFacility.size,
      workFacilityDayDuplicates: errors.filter((entry) => entry.code === 'DUPLICATE_JOB_FACILITY_DAY').length,
      workWindowViolations: errors.filter((entry) => entry.code === 'JOB_OUTSIDE_WINDOW').length,
      workConditionViolations: errors.filter((entry) => entry.code === 'JOB_CONDITION_UNMET').length,
      provisionUnderflows: errors.filter((entry) => entry.code === 'PROVISION_UNDERFLOW').length,
      insufficientGoldRows: errors.filter((entry) => entry.code === 'INSUFFICIENT_GOLD').length,
      workerLodgingViolations: errors.filter((entry) => entry.code === 'WORKER_LODGING_WITHOUT_PORT_WORK').length,
      missingRuntimeMissionActions: errors.filter((entry) => entry.code === 'MISSING_RUNTIME_MISSION_ACTION').length,
      missingRuntimeEncounters: errors.filter((entry) => entry.code === 'MISSING_RUNTIME_ENCOUNTER').length,
      replayExecuted: false,
      combatExecuted: false,
    },
    economy: {
      startingGold: 0,
      totalIncome: state.income,
      totalExpense: state.expense,
      minimumGold: state.minGold,
      minimumGoldRow: state.minGoldRow,
      finalGold: state.gold,
      incomeBySource: state.incomeBySource,
      expenseBySource: state.expenseBySource,
      finalFreeMeals: state.freeMeals,
      finalFreeLodging: state.freeLodging,
      finalProvisionInventory: itemCounts(state.provisions),
      debtStatus: state.debtStatus,
      debtRemainingG: state.debt,
    },
    progression: {
      staticRouteSeed: STATIC_ROUTE_SEED,
      runtimeContentRevision: gameData.contentRevision,
      totalExp: state.totalExp,
      battleExp: state.battleExp,
      missionExp: state.missionExp,
      expIntoFinalLevel: state.exp,
      finalLevel: state.level,
      totalSp: state.spTotal,
      usedSp: state.spUsed,
      finalSp,
      learnedSkillCount: state.skills.size,
      learnedSkillIds: [...state.skills].sort(),
      skillTransitions: state.skillTransitions,
      experienceTransitions: state.experienceTransitions,
      legacyLevelMismatchRowCount: state.legacyLevelMismatchRows.length,
      legacySpMismatchRowCount: state.legacySpMismatchRows.length,
      legacyLevelMismatchAudit: mismatchAudit(state.legacyLevelMismatchRows),
      legacySpMismatchAudit: mismatchAudit(state.legacySpMismatchRows),
      experienceBasis: 'fixed mission rewards plus deterministic encounter composition expansion for the pinned static route seed; combat victory is the authored row outcome and combat itself is not executed here',
    },
    survival: {
      basis: 'authored numeric row boundaries; inserted economy commands are separately checked for canonical duration/window and followed by authored sleep boundaries',
      maximumHunger: state.maximumHunger,
      maximumFatigue: state.maximumFatigue,
      minimumHp: state.minimumHp,
      minimumMp: state.minimumMp,
      intendedCollapseRows: mappings.filter((row) => row.legacyRuntimeAction === 'COLLAPSE_RESCUE').map((row) => row.legacyRowId),
    },
    equipment: {
      finalOwned: itemCounts(state.equipment),
      finalEquipped: state.equipped,
      transitions: state.equipmentTransitions,
    },
    world: {
      incidentStates: Object.fromEntries(Object.entries(state.incidentStates).sort(([a], [b]) => a.localeCompare(b))),
      npcResolvedIncidentCount: sourceRows.filter((row) => row['runtime action'] === 'WORLD_EVENT' && /T\d{2}=suppressed/u.test(row['事件状態'] ?? '')).length,
      publicNpcFactCount: state.facts.size,
      publicNpcGoalCount: state.npcGoals.size,
      trackedNpcLocationCount: state.npcLocations.size,
      worldFlagCount: state.flags.size,
    },
    ledgerRows: ledger.length,
    replayExecuted: false,
    combatExecuted: false,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-static-ledger.csv'), csv(ledger, [
    'legacyRowId', 'day', 'plannedTime', 'regionId', 'facilityId', 'actionIds', 'goldBefore', 'income', 'expense', 'goldAfter',
    'freeMeals', 'freeLodging', 'provisions', 'equipment', 'debt', 'level', 'expIntoLevel', 'totalExp', 'expGain', 'sp', 'skills', 'incidentState', 'worldState',
  ]));
  fs.writeFileSync(path.join(outDir, 'virtue-route-v3-static-validation.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mappingPath, sourcePath, outDir] = process.argv.slice(2);
  const summary = validateStaticRoute({
    mappingPath: mappingPath ? path.resolve(mappingPath) : DEFAULT_MAPPING,
    sourcePath: sourcePath ? path.resolve(sourcePath) : DEFAULT_SOURCE,
    outDir: outDir ? path.resolve(outDir) : DEFAULT_OUT,
  });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.result !== 'PASS') process.exitCode = 1;
}
