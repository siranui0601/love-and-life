import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_FIXTURE_DIR = path.resolve(HERE, '..', 'fixtures');

/**
 * The sheet does not state the complete hit/critical formula.  These caps are
 * deliberately centralized so Monte Carlo reports can quote the assumption.
 */
export const BATTLE_ASSUMPTIONS = Object.freeze({
  baseHitChancePct: 90,
  minHitChancePct: 5,
  maxHitChancePct: 98,
  baseCriticalChancePct: 5,
  minCriticalChancePct: 0,
  maxCriticalChancePct: 50,
  criticalDamageMultiplier: 1.5,
  defenseCoefficient: 0.6,
  modifierStageRatio: 0.15,
  // A stat can be ground down, but never switched off.  Without a floor above
  // zero, a free 0-cost debuff with a one turn cooldown wins any fight given
  // enough turns: stack it to stage -6, the opponent deals a tenth of its
  // damage, and the outcome stops depending on the build.  0.4 keeps a fully
  // debuffed brute lethal, so debuffs buy time instead of buying the win.
  modifierStageFloor: 0.4,
  accuracyStagePoints: 10,
  // Fights are minutes long in the fiction.  A battle that has not resolved by
  // this many rounds is a stalemate the player walks away from, not a victory
  // earned by outlasting the other side.
  battleTurnLimit: 20,
  // Bosses are built to outlast that.  MON-0028 空殻の勇者 carries 5913 HP behind
  // 61 defence: measured, a party of four at Lv20 in tier-4 gear needs 27-39
  // rounds to put it down, and three at Lv24 need about 35.  Holding bosses to
  // the ordinary 20 makes every one of those runs a draw, which is not a
  // stalemate the player walked away from - it is a fight the rules would not
  // let them finish.  Applies when any enemy in the encounter is flagged ボス.
  bossBattleTurnLimit: 60,
  // ## 戦闘が長すぎた問題（2026-08-14）
  //
  // 実測すると、**敵がプレイヤーを殺すのに何撃要るか**が壊れていた。
  //
  //   Lv 1  10.5撃 ／ Lv 4  12.6撃 ／ Lv 9  17.3撃
  //   Lv13  14.2撃 ／ **Lv18  42.0撃** ／ Lv22   9.0撃
  //
  // 原因は二つ重なっている。
  //   ・**敵のHPは Lv4→Lv18 で6倍**（99→585）**になるのに、物理威力は2倍**（20→41）しか伸びない
  //   ・そこへ `防御 × 0.6` が固定で引かれる。プレイヤーの防御は装備で 13→110 まで伸びるので、
  //     **伸びた防御が、伸びなかった敵の手を食い潰す**
  //
  // 結果、**敵が脅威でないから、プレイヤーは何ターンでもかけられる。**
  // 時間をかけられること自体が、この設計の失敗だった。
  //
  // 直し方は二つの倍率で、どちらも正本の行そのものは書き換えない。
  //   `monsterOffenceScale` … 敵の与ダメージ。**各レベル帯で5〜7撃で殺せる**ところへ寄せた
  //   `monsterHpScale`      … 敵のHP。**倒すのに要るターンを3〜5**へ寄せた
  monsterOffenceScale: 1.4,
  monsterHpScale: 0.55,
  cooldownTick: 'start_of_round',
  allyCountIncludesSelf: true,
  // Priority is an intent signal, not decorative metadata.  Keep choices in a
  // narrow band so emergency/heal/telegraphed actions beat routine attacks,
  // while similarly important skills still vary by their authored weight.
  enemyPriorityBand: 20,
  enemyPriorityWeightStep: 10,
  enemySelection: 'filter to the highest 20-point priority band, then sample by base weight adjusted by priority',
  cooldownRecovery: 'when authored skills are temporarily unavailable, use the universal basic attack without raising candidate exhaustion',
  // Every active monster must own an unconditional authored skill action.
  // This fallback remains only as a corrupt-data guard and is certified at
  // zero occurrences for canonical content.
  candidateExhaustion: 'invalid canonical data only: a monster owns no authored action rows',
  maxEnemyCombatants: 8,
});

export const SUPPORTED_COMMANDS = new Set([
  'DAMAGE',
  'HEAL',
  'APPLY_DEBUFF',
  'APPLY_MODIFIER',
  'APPLY_SPECIAL_STATE',
  'MODIFY_CRITICAL',
  'MODIFY_RESOURCE',
  'MODIFY_ESCAPE',
  'MODIFY_FIELD',
  'REMOVE_DEBUFF',
  'REMOVE_MODIFIER',
  'SUMMON_UNIT',
  'INTERRUPT_CAST',
  'COPY_LAST_ENEMY_SKILL',
]);

export const SUPPORTED_MONSTER_SPECIAL_STATES = new Set([
  'barrier', 'casting', 'counter', 'guard', 'magic_absorb', 'reflect',
  'regeneration', 'seal', 'survive_lethal', 'taunt',
]);

export const SUPPORTED_MONSTER_DEBUFFS = new Set([
  'accuracy_down', 'agility_down', 'confusion', 'damage_taken_up', 'defense_down',
  'healing_down', 'magic_power_down', 'paralysis', 'poison',
]);

const STAT_ALIASES = Object.freeze({
  physicalPower: 'physical_power',
  magicPower: 'magic_power',
  magicResistance: 'magic_resistance',
  debuffResistance: 'debuff_resistance',
  debuffSuccess: 'debuff_success',
});

export function canonicalStat(stat) {
  return STAT_ALIASES[stat] ?? stat;
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function effectiveAttack(weaponPower, attack) {
  return Number(weaponPower || 0) * (1 + Number(attack || 0) / 100);
}

export function calculatePhysicalDamage({ weaponPower, attack, multiplier = 1, fixed = 0, defense = 0 }) {
  return Math.max(
    1,
    effectiveAttack(weaponPower, attack) * Number(multiplier || 0)
      + Number(fixed || 0)
      - Number(defense || 0) * BATTLE_ASSUMPTIONS.defenseCoefficient,
  );
}

export function calculateMagicDamage({ magicPower, attack, multiplier = 1, fixed = 0, magicResistance = 0 }) {
  return Math.max(
    1,
    effectiveAttack(magicPower, attack) * Number(multiplier || 0)
      + Number(fixed || 0)
      - Number(magicResistance || 0) * BATTLE_ASSUMPTIONS.defenseCoefficient,
  );
}

export function calculateHitChance({ accuracy = 0, targetEvasion = 0 } = {}) {
  const pct = BATTLE_ASSUMPTIONS.baseHitChancePct + Number(accuracy) - Number(targetEvasion);
  return clamp(pct, BATTLE_ASSUMPTIONS.minHitChancePct, BATTLE_ASSUMPTIONS.maxHitChancePct) / 100;
}

export function calculateCriticalChance({ critical = 0, targetLuck = 0 } = {}) {
  const pct = BATTLE_ASSUMPTIONS.baseCriticalChancePct + Number(critical) - Number(targetLuck) * 0.1;
  return clamp(pct, BATTLE_ASSUMPTIONS.minCriticalChancePct, BATTLE_ASSUMPTIONS.maxCriticalChancePct) / 100;
}

export function hashSeed(seed) {
  if (Number.isInteger(seed)) return seed >>> 0 || 0x9e3779b9;
  const text = String(seed ?? 'trpg-sim');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0 || 0x9e3779b9;
}

/** Mulberry32: compact, deterministic and adequate for repeatable simulations. */
export function createSeededRng(seed = 'trpg-sim') {
  let state = hashSeed(seed);
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  random.int = (minimum, maximum) => minimum + Math.floor(random() * (maximum - minimum + 1));
  random.bool = (probability = 0.5) => random() < probability;
  random.state = () => state >>> 0;
  return random;
}

export function weightedChoice(items, getWeight, rng) {
  const weighted = items
    .map((item) => ({ item, weight: Math.max(0, Number(getWeight(item) || 0)) }))
    .filter(({ weight }) => weight > 0);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (!weighted.length || total <= 0) return null;
  let cursor = rng() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.item;
  }
  return weighted.at(-1).item;
}

export class DiagnosticBag {
  constructor(sampleLimit = 8) {
    this.sampleLimit = sampleLimit;
    this.counts = new Map();
    this.samples = new Map();
  }

  add(code, detail = null) {
    this.counts.set(code, (this.counts.get(code) ?? 0) + 1);
    if (detail !== null) {
      const samples = this.samples.get(code) ?? [];
      if (samples.length < this.sampleLimit) samples.push(detail);
      this.samples.set(code, samples);
    }
  }

  merge(other) {
    const snapshot = other instanceof DiagnosticBag ? other.snapshot() : other;
    for (const [code, count] of Object.entries(snapshot?.counts ?? {})) {
      this.counts.set(code, (this.counts.get(code) ?? 0) + Number(count));
    }
    for (const [code, values] of Object.entries(snapshot?.samples ?? {})) {
      const current = this.samples.get(code) ?? [];
      for (const value of values) if (current.length < this.sampleLimit) current.push(value);
      this.samples.set(code, current);
    }
    return this;
  }

  snapshot() {
    return {
      counts: Object.fromEntries([...this.counts].sort(([a], [b]) => a.localeCompare(b))),
      samples: Object.fromEntries([...this.samples].sort(([a], [b]) => a.localeCompare(b))),
    };
  }
}

export function safeJson(value, fallback, diagnostics = null, detail = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    diagnostics?.add('invalidJson', { ...detail, message: error.message });
    return fallback;
  }
}

export function tableToRecords(rows, headerRow = 3) {
  const headers = rows[headerRow] ?? [];
  return rows
    .slice(headerRow + 1)
    .filter((row) => Array.isArray(row) && row.some((value) => value !== null && value !== ''))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
}

function normalizeEquipment(row) {
  return {
    id: row['装備ID'], name: row['装備名'], slot: row['装備枠'], weaponType: row['武器種'],
    grip: row['持ち方'], armorClass: row['防具分類'], tier: Number(row.Tier),
    recommendedLevelMin: Number(row['推奨Lv下限']), recommendedLevelMax: Number(row['推奨Lv上限']),
    region: row['地域系統'], physicalPower: Number(row['物理威力'] || 0), magicPower: Number(row['魔導威力'] || 0),
    defense: Number(row['防御'] || 0), magicResistance: Number(row['魔法耐性'] || 0),
    agility: Number(row['素早さ補正'] || 0), luck: Number(row['幸運補正'] || 0),
    accuracy: Number(row['命中補正'] || 0), evasion: Number(row['回避補正'] || 0),
    critical: Number(row['会心補正'] || 0), debuffSuccess: Number(row['デバフ成功補正'] || 0),
    debuffResistance: Number(row['デバフ耐性補正'] || 0), maxHp: Number(row['最大HP補正'] || 0),
    maxMp: Number(row['最大MP補正'] || 0), grantedSkillId: row['付与スキルID'], passive: row['パッシブ効果'],
    drawback: row['欠点'], sellRatio: Number(row['売却率'] || 0), performanceIndex: Number(row['性能指数'] || 0),
    status: row['状態'], raw: row,
  };
}

function normalizeMonster(row, diagnostics) {
  return {
    id: row['モンスターID'], name: row['名称'], region: row['主地域'], zone: row['出現区画'],
    level: Number(row['基準Lv']), recommendedLevelMin: Number(row['推奨Lv下限']),
    recommendedLevelMax: Number(row['推奨Lv上限']), role: row['役割'], classification: row['敵分類'],
    elite: Boolean(row['エリート']), boss: Boolean(row['ボス']), phaseGroup: row['フェーズ群'],
    tags: new Set(String(row['タグ'] ?? '').split(',').map((value) => value.trim()).filter(Boolean)),
    maxHp: Number(row.HP), maxMp: Number(row.MP), attack: Number(row['攻撃']), defense: Number(row['防御']),
    agility: Number(row['素早さ']), luck: Number(row['幸運']), physicalPower: Number(row['物理威力']),
    magicPower: Number(row['魔導威力']), magicResistance: Number(row['魔法耐性']),
    debuffResistance: Number(row['デバフ耐性']),
    individualDebuffResistance: safeJson(row['個別デバフ耐性'], {}, diagnostics, { monsterId: row['モンスターID'] }),
    exp: Number(row.EXP), goldMin: Number(row['所持G下限']), goldMax: Number(row['所持G上限']),
    drops: safeJson(row['ドロップ'], [], diagnostics, { monsterId: row['モンスターID'] }),
    appearanceCondition: row['出現条件'], aiProfile: row['AIプロファイル'], status: row['状態'], raw: row,
    description: row['説明'],
  };
}

function normalizeMonsterSkill(row, diagnostics) {
  return {
    id: row['モンスタースキルID'], name: row['名称'], classification: row['分類'], rank: Number(row['ランク']),
    mpCost: Number(row['消費MP'] || 0), cooldown: Number(row.CT || 0), target: row['対象'],
    accuracy: Number(row['命中補正'] || 0),
    conditions: safeJson(row['発動条件'], [], diagnostics, { monsterSkillId: row['モンスタースキルID'] }),
    commands: safeJson(row['効果命令'], [], diagnostics, { monsterSkillId: row['モンスタースキルID'] }),
    aiTags: new Set(String(row['AIタグ'] ?? '').split(',').map((value) => value.trim()).filter(Boolean)),
    description: row['説明'], implementationStatus: row['実装状態'], raw: row,
  };
}

function normalizeMonsterAction(row) {
  return {
    id: row['行動ID'], monsterId: row['モンスターID'], monsterName: row['モンスター名'],
    skillId: row['スキルID'], skillName: row['スキル名'], baseWeight: Number(row['基礎重み'] || 0),
    condition: row['使用条件'], priority: Number(row['優先度'] || 0),
    usesPerBattle: row['戦闘中上限'] === null ? null : Number(row['戦闘中上限']),
    cooldownOverride: row['CT上書き'] === null ? null : Number(row['CT上書き']),
    targetPolicy: row['対象方針'], notes: row['備考'], raw: row,
  };
}

function normalizeEncounter(row, diagnostics) {
  return {
    id: row['エンカウントID'], region: row['地域'], route: row['区画/ルート'], name: row['名称'],
    dangerTier: Number(row['危険Tier']), baseWeight: Number(row['基礎重み']), dayparts: row['時間帯'],
    weather: row['天候'], startDay: Number(row['開始Day']), endDay: Number(row['終了Day']),
    condition: row['出現条件'], avoidability: row['回避性'],
    composition: safeJson(row['編成'], [], diagnostics, { encounterId: row['エンカウントID'] }),
    notes: row['備考'], status: row['状態'], raw: row,
  };
}

function normalizeInventory(row) {
  return {
    id: row['在庫ID'], equipmentId: row['装備ID'], name: row['装備名'], location: row['拠点'],
    sellerId: row['施設ID'], seller: row['施設/売り手'], basePrice: Number(row['基準価格G'] || 0),
    stock: row['在庫'], initiallySold: Boolean(row['初期販売']), unlockCondition: row['解禁条件'],
    priceCondition: row['価格変動/条件'], legality: row['合法性'], regionCoefficient: Number(row['地域係数'] || 1),
    notes: row['備考'], raw: row,
  };
}

export function buildBattleData(battleSnapshot, playerSkills = [], bossCatalog = { version: null, bosses: [] }) {
  const diagnostics = new DiagnosticBag();
  const tabs = battleSnapshot.tabs ?? {};
  const equipment = tableToRecords(tabs['装備性能マスター'] ?? []).map(normalizeEquipment);
  const inventory = tableToRecords(tabs['店舗装備在庫'] ?? []).map(normalizeInventory);
  const monsters = tableToRecords(tabs['モンスター一覧'] ?? []).map((row) => normalizeMonster(row, diagnostics));
  const monsterSkills = tableToRecords(tabs['モンスタースキル'] ?? []).map((row) => normalizeMonsterSkill(row, diagnostics));
  const monsterActions = tableToRecords(tabs['モンスター行動'] ?? []).map(normalizeMonsterAction);
  const encounters = tableToRecords(tabs['地域別エンカウント'] ?? []).map((row) => normalizeEncounter(row, diagnostics));

  const data = {
    assumptions: BATTLE_ASSUMPTIONS,
    source: battleSnapshot.source,
    equipment, inventory, monsters, monsterSkills, monsterActions, encounters, playerSkills,
    bossCatalog,
    equipmentById: new Map(equipment.map((item) => [item.id, item])),
    monsterById: new Map(monsters.map((item) => [item.id, item])),
    monsterSkillById: new Map(monsterSkills.map((item) => [item.id, item])),
    encounterById: new Map(encounters.map((item) => [item.id, item])),
    playerSkillById: new Map(playerSkills.map((item) => [item.id, item])),
    bossByMonsterId: new Map((bossCatalog.bosses ?? []).map((item) => [item.monsterId, item])),
    actionsByMonsterId: new Map(),
    loadDiagnostics: diagnostics.snapshot(),
  };
  for (const action of monsterActions) {
    const actions = data.actionsByMonsterId.get(action.monsterId) ?? [];
    actions.push(action);
    data.actionsByMonsterId.set(action.monsterId, actions);
  }
  data.audit = auditBattleData(data);
  return data;
}

export async function loadBattleData(fixtureDir = DEFAULT_FIXTURE_DIR) {
  const battleSnapshot = JSON.parse(await fs.readFile(path.join(fixtureDir, 'battle.snapshot.json'), 'utf8'));
  const bossCatalog = JSON.parse(await fs.readFile(path.join(fixtureDir, 'boss-combat-catalog.json'), 'utf8'));
  const shardNames = [
    'skills-0001-0300.snapshot.json',
    'skills-0301-0600.snapshot.json',
    'skills-0601-0900.snapshot.json',
    'skills-0901-1141.snapshot.json',
  ];
  const shards = await Promise.all(shardNames.map(async (name) => JSON.parse(await fs.readFile(path.join(fixtureDir, name), 'utf8'))));
  return buildBattleData(battleSnapshot, shards.flatMap((shard) => shard.skills ?? []), bossCatalog);
}

export function auditBattleData(data) {
  const knownStates = new Set();
  const knownModifiers = new Set();
  const unknownCommands = [];
  const unknownSpecialStateSemantics = [];
  const unknownDebuffSemantics = [];
  const customHandlerSkills = [];
  for (const skill of data.monsterSkills) {
    if (skill.implementationStatus !== 'runtime_ready') customHandlerSkills.push(skill.id);
    for (const command of skill.commands) {
      if (command.stateId) knownStates.add(command.stateId);
      if (command.modifier) knownModifiers.add(command.modifier);
      if (!SUPPORTED_COMMANDS.has(command.command)) unknownCommands.push({ skillId: skill.id, command: command.command });
      if (command.command === 'APPLY_SPECIAL_STATE' && !SUPPORTED_MONSTER_SPECIAL_STATES.has(command.stateId)) {
        unknownSpecialStateSemantics.push({ skillId: skill.id, stateId: command.stateId });
      }
      if (command.command === 'APPLY_DEBUFF' && !SUPPORTED_MONSTER_DEBUFFS.has(command.debuffId)) {
        unknownDebuffSemantics.push({ skillId: skill.id, debuffId: command.debuffId });
      }
    }
  }

  const unresolvedStateReferences = [];
  const unresolvedModifierReferences = [];
  for (const action of data.monsterActions) {
    const condition = action.condition ?? '';
    const statePattern = /specialStates\.(?:notContains|contains)\('([^']+)'\)/g;
    for (const match of condition.matchAll(statePattern)) {
      if (!knownStates.has(match[1])) unresolvedStateReferences.push({ actionId: action.id, stateId: match[1] });
    }
    const modifierPattern = /modifiers\.([A-Za-z_]+)/g;
    for (const match of condition.matchAll(modifierPattern)) {
      if (!knownModifiers.has(match[1])) {
        unresolvedModifierReferences.push({
          actionId: action.id,
          modifier: match[1],
          normalized: canonicalStat(match[1]),
          normalizationResolves: knownModifiers.has(canonicalStat(match[1])),
        });
      }
    }
  }

  const monstersWithoutUnconditionalAction = data.monsters
    .filter((monster) => !(data.actionsByMonsterId.get(monster.id) ?? []).some((action) => !action.condition))
    .map((monster) => monster.id);
  const usedMonsterSkills = new Set(data.monsterActions.map((action) => action.skillId));
  const unusedMonsterSkills = data.monsterSkills.filter((skill) => !usedMonsterSkills.has(skill.id)).map((skill) => skill.id);
  const passiveSkillsWithDamage = data.playerSkills
    .filter((skill) => skill.kind === 'passive' && Number(skill.damage?.totalMultiplier || 0) > 0)
    .map((skill) => skill.id);
  const provisionalRuleSkills = data.playerSkills
    .filter((skill) => (skill.specialStates ?? []).some((state) => state.type === 'provisionalRule'))
    .map((skill) => skill.id);
  const contextualActiveSkills = data.playerSkills
    .filter((skill) => skill.kind === 'active' && skill.target === 'contextual' && skill.acquisitionCode !== 'non_skill')
    .map((skill) => skill.id);
  const bossMonsterIds = data.monsters.filter((monster) => monster.boss).map((monster) => monster.id);
  const bossesMissingCombatCatalog = bossMonsterIds.filter((id) => !data.bossByMonsterId.has(id));
  const unknownBossCatalogMonsterIds = [...data.bossByMonsterId.keys()].filter((id) => !data.monsterById.has(id));
  const bossCatalogIssues = [];
  for (const boss of data.bossCatalog.bosses ?? []) {
    const assignedSkillIds = new Set((data.actionsByMonsterId.get(boss.monsterId) ?? []).map((action) => action.skillId));
    if (!Array.isArray(boss.coreGimmicks) || boss.coreGimmicks.length < 1 || boss.coreGimmicks.length > 3) {
      bossCatalogIssues.push({ bossId: boss.bossId, issue: 'core_gimmicks_must_be_1_to_3' });
    }
    if (!Array.isArray(boss.phases) || boss.phases.length < 1) {
      bossCatalogIssues.push({ bossId: boss.bossId, issue: 'missing_phases' });
    }
    if (!Array.isArray(boss.supportedBuilds) || boss.supportedBuilds.length < 2) {
      bossCatalogIssues.push({ bossId: boss.bossId, issue: 'multiple_builds_required' });
    }
    for (const telegraph of boss.telegraphs ?? []) {
      if (!assignedSkillIds.has(telegraph.skillId)) {
        bossCatalogIssues.push({ bossId: boss.bossId, issue: 'telegraph_skill_not_assigned', skillId: telegraph.skillId });
      }
    }
  }

  return {
    knownStates: [...knownStates].sort(),
    knownModifiers: [...knownModifiers].sort(),
    unresolvedStateReferences,
    unresolvedModifierReferences,
    monstersWithoutUnconditionalAction,
    unusedMonsterSkills,
    customHandlerSkills,
    unknownCommands,
    unknownSpecialStateSemantics,
    unknownDebuffSemantics,
    passiveSkillsWithDamage,
    provisionalRuleSkills,
    contextualActiveSkills,
    bossesMissingCombatCatalog,
    unknownBossCatalogMonsterIds,
    bossCatalogIssues,
  };
}

export function createPlayerBuild(data, specification = {}) {
  const level = Number(specification.level ?? 1);
  const equipmentIds = specification.equipmentIds ?? [];
  const equipment = equipmentIds.map((id) => data.equipmentById.get(id)).filter(Boolean);
  const mainHand = equipment.find((item) => item.slot === 'mainHand');
  const sum = (key) => equipment.reduce((total, item) => total + Number(item[key] || 0), 0);
  const base = specification.baseStats ?? {};
  const defaultSkillIds = data.playerSkills
    .filter((skill) => skill.acquisitionCode === 'basic_level_up' && Number(skill.requiredLevel || Infinity) <= level)
    .map((skill) => skill.id);
  const grantedSkillIds = equipment.map((item) => item.grantedSkillId).filter(Boolean);
  const skillIds = [...new Set([...(specification.skillIds ?? defaultSkillIds), ...grantedSkillIds])];
  return {
    id: specification.id ?? `player-lv${level}`,
    name: specification.name ?? `Player Lv${level}`,
    level,
    equipmentIds,
    skillIds,
    maxHp: Math.round(Number(base.maxHp ?? 70 + level * 18) + sum('maxHp')),
    maxMp: Math.round(Number(base.maxMp ?? 25 + level * 6) + sum('maxMp')),
    attack: Number(base.attack ?? 8 + level * 3),
    defense: Number(base.defense ?? 5 + level * 2.2) + sum('defense'),
    agility: Number(base.agility ?? 8 + level * 1.8) + sum('agility'),
    luck: Number(base.luck ?? 5 + level * 0.6) + sum('luck'),
    physicalPower: Number(base.physicalPower ?? mainHand?.physicalPower ?? 10 + level),
    magicPower: Number(base.magicPower ?? mainHand?.magicPower ?? 5 + level),
    magicResistance: Number(base.magicResistance ?? 4 + level * 1.5) + sum('magicResistance'),
    accuracy: Number(base.accuracy ?? 0) + sum('accuracy'),
    evasion: Number(base.evasion ?? 0) + sum('evasion'),
    critical: Number(base.critical ?? 0) + sum('critical'),
    debuffSuccess: Number(base.debuffSuccess ?? 0) + sum('debuffSuccess'),
    debuffResistance: Number(base.debuffResistance ?? 0) + sum('debuffResistance'),
    activeWeaponTypes: new Set(equipment.map((item) => item.weaponType).filter(Boolean)),
  };
}

export function createPlayerActor(build, serial = 1) {
  return createActorState({ ...build, instanceId: `${build.id}#${serial}`, side: 'player' });
}

export function createMonsterActor(monster, serial = 1) {
  // 均衡の二倍率をここで一度だけ掛ける。**正本の行は書き換えない。**
  // （倍率の根拠は BATTLE_ASSUMPTIONS の注記。）
  const maxHp = Math.max(1, Math.round(Number(monster.maxHp || 0) * BATTLE_ASSUMPTIONS.monsterHpScale));
  const physicalPower = Number(monster.physicalPower || 0) * BATTLE_ASSUMPTIONS.monsterOffenceScale;
  const magicPower = Number(monster.magicPower || 0) * BATTLE_ASSUMPTIONS.monsterOffenceScale;
  return createActorState({
    ...monster,
    maxHp,
    hp: maxHp,
    physicalPower,
    magicPower,
    instanceId: `${monster.id}#${serial}`,
    side: 'enemy',
    accuracy: 0,
    evasion: 0,
    critical: 0,
    debuffSuccess: 0,
    skillIds: [],
    activeWeaponTypes: new Set(),
  });
}

function createActorState(source) {
  return {
    ...source,
    hp: Number(source.maxHp), mp: Number(source.maxMp), alive: true,
    cooldowns: new Map(), uses: new Map(), modifiers: new Map(), debuffs: new Map(), specialStates: new Map(),
    lastActionTag: null, lastSkillId: null, lastSkillRepeatable: false,
    escaped: false, pendingIntent: null, bossPhase: source.boss ? 0 : 1,
    damageDealt: 0, damageTaken: 0, healingDone: 0, mpSpent: 0,
  };
}

export function expandEncounter(data, encounterOrId, rng) {
  const encounter = typeof encounterOrId === 'string' ? data.encounterById.get(encounterOrId) : encounterOrId;
  if (!encounter) throw new Error(`Unknown encounter: ${encounterOrId}`);
  const monsterIds = [];
  for (const entry of encounter.composition) {
    if (!rng.bool(Number(entry.includeChance ?? 1))) continue;
    const count = rng.int(Number(entry.countMin ?? 1), Number(entry.countMax ?? entry.countMin ?? 1));
    for (let index = 0; index < count; index += 1) monsterIds.push(entry.monsterId);
  }
  return monsterIds;
}

function actorRatio(actor, resource) {
  if (!actor) return undefined;
  return resource === 'hp' ? actor.hp / actor.maxHp : actor.mp / actor.maxMp;
}

function collectionHas(actor, collection, value) {
  const target = actor?.[collection];
  if (target instanceof Map || target instanceof Set) return target.has(value);
  if (Array.isArray(target)) return target.includes(value);
  return false;
}

function modifierStage(actor, stat) {
  const entry = actor?.modifiers?.get?.(canonicalStat(stat));
  return Number(entry?.stage ?? 0);
}

function resolveStructuredPath(condition, context) {
  const { scope, path: conditionPath } = condition;
  const actor = scope === 'self' ? context.self : scope === 'target' ? context.target : null;
  if (scope === 'equipment' && conditionPath === 'activeWeaponTypes') return context.self?.activeWeaponTypes;
  if (scope === 'history' && conditionPath === 'lastSkillId') return context.self?.lastSkillId;
  if (scope === 'history' && conditionPath === 'lastSkillRepeatable') return context.self?.lastSkillRepeatable;
  if (scope === 'battle') {
    if (conditionPath === 'turn') return context.turn;
    if (conditionPath === 'enemyCount') return context.enemiesAlive?.length ?? 0;
    if (conditionPath === 'allyCount' || conditionPath === 'alliesAlive') return context.alliesAlive?.length ?? 0;
    if (conditionPath === 'ownedFieldEffectCount') return context.fieldEffects?.size ?? 0;
  }
  if (scope === 'field' && conditionPath === 'tags') return context.fieldTags ?? new Set();
  if (scope === 'world') return context.world?.[conditionPath];
  if (!actor) return undefined;
  if (conditionPath === 'hpRatio') return actorRatio(actor, 'hp');
  if (conditionPath === 'mpRatio') return actorRatio(actor, 'mp');
  if (conditionPath === 'debuffs') return actor.debuffs;
  if (conditionPath === 'specialStates') return actor.specialStates;
  if (conditionPath === 'debuffCount') return actor.debuffs?.size ?? 0;
  return actor[conditionPath];
}

function compare(left, operator, right) {
  switch (operator) {
    case 'eq': case '==': return left === right;
    case 'ne': case '!=': return left !== right;
    case 'gte': case '>=': return Number(left) >= Number(right);
    case 'lte': case '<=': return Number(left) <= Number(right);
    case 'gt': case '>': return Number(left) > Number(right);
    case 'lt': case '<': return Number(left) < Number(right);
    case 'contains': return left?.has?.(right) ?? left?.includes?.(right) ?? false;
    case 'containsAny': return Array.isArray(right) && right.some((value) => left?.has?.(value) ?? left?.includes?.(value));
    case 'isTrue': return left === true;
    default: return false;
  }
}

export function evaluateStructuredConditions(conditions, context, diagnostics = null) {
  if (!conditions?.length) return true;
  return conditions.every((condition) => {
    const left = resolveStructuredPath(condition, context);
    if (left === undefined) diagnostics?.add('unknownStructuredConditionPath', condition);
    return compare(left, condition.op, condition.value);
  });
}

function parseLiteral(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^'.*'$/.test(value)) return value.slice(1, -1);
  return Number(value);
}

function dslActor(scope, context) {
  if (scope === 'self') return context.self;
  if (scope === 'target') return context.target;
  if (scope === 'ally') {
    const options = (context.alliesAlive ?? []).filter((actor) => actor.alive && actor.instanceId !== context.self?.instanceId);
    return options.sort((a, b) => actorRatio(a, 'hp') - actorRatio(b, 'hp'))[0] ?? context.self;
  }
  return null;
}

function resolveDslPath(pathText, context, diagnostics) {
  const [scope, ...parts] = pathText.split('.');
  if (scope === 'battle') {
    if (parts[0] === 'turn') return context.turn;
    if (parts[0] === 'enemyCount') return context.enemiesAlive?.length ?? 0;
    if (parts[0] === 'allyCount') return context.alliesAlive?.length ?? 0;
  }
  if (scope === 'history' && parts[0] === 'playerLastSkillRepeatable') return Boolean(context.history?.playerLastSkillRepeatable);
  const actor = dslActor(scope, context);
  if (!actor) return undefined;
  if (parts[0] === 'hpRatio') return actorRatio(actor, 'hp');
  if (parts[0] === 'mpRatio') return actorRatio(actor, 'mp');
  if (parts[0] === 'agilityStage') return modifierStage(actor, 'agility');
  if (parts[0] === 'lastActionTag') return actor.lastActionTag;
  if (parts[0] === 'modifiers' && parts[1]) {
    const normalized = canonicalStat(parts[1]);
    if (normalized !== parts[1]) diagnostics?.add('conditionModifierAliasNormalized', { from: parts[1], to: normalized });
    return modifierStage(actor, normalized);
  }
  return undefined;
}

/** Safe parser for the finite DSL present in the action sheet; no eval is used. */
export function evaluateActionCondition(expression, context, diagnostics = null, registries = null) {
  if (!expression) return true;
  const text = String(expression).trim();
  let match = text.match(/^(self|target|ally)\.(specialStates|debuffs)\.(contains|notContains)\('([^']+)'\)$/);
  if (match) {
    const [, scope, collection, operation, value] = match;
    const actor = dslActor(scope, context);
    if (collection === 'specialStates' && registries?.knownStates && !registries.knownStates.has(value)) {
      diagnostics?.add('unresolvedStateReference', { expression: text, stateId: value });
    }
    const present = collectionHas(actor, collection, value);
    return operation === 'contains' ? present : !present;
  }

  match = text.match(/^(self|target|ally)\.(specialStates|debuffs)\.count(==|>=|<=|>|<)(\d+(?:\.\d+)?)$/);
  if (match) {
    const actor = dslActor(match[1], context);
    const count = actor?.[match[2]]?.size ?? 0;
    return compare(count, match[3], Number(match[4]));
  }

  match = text.match(/^battle\.turn%(\d+)==(\d+)$/);
  if (match) return context.turn % Number(match[1]) === Number(match[2]);

  match = text.match(/^([A-Za-z_.]+)(==|!=|>=|<=|>|<)(true|false|-?\d+(?:\.\d+)?|'.*')$/);
  if (match) {
    const left = resolveDslPath(match[1], context, diagnostics);
    if (left === undefined) {
      diagnostics?.add('unknownActionConditionPath', { expression: text, path: match[1] });
      return false;
    }
    return compare(left, match[2], parseLiteral(match[3]));
  }

  diagnostics?.add('unknownActionCondition', text);
  return false;
}

export function inferPlayerDamageType(skill) {
  if (/魔法|魔導書/.test(skill.category ?? '')) return 'magic';
  if (/炎|氷|雷|風|光|闇|水|土|精神/.test(skill.category ?? '')) return 'magic';
  return 'physical';
}
