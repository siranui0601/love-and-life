import fs from 'node:fs/promises';
import path from 'node:path';

import * as core from './battle-core.mjs';
import { loadCanonicalBattleSnapshot } from './canonical-battle-snapshot.mjs';
import { compilePlayerSkills } from './player-skill-compiler.mjs';

export * from './battle-core.mjs';

/**
 * Canonical battle assumptions used by every public runtime entry point.
 * Monster HP/offence stored in the checked-in canonical artifact are already
 * runtime values. Hidden post-load scaling is therefore forbidden.
 */
export const BATTLE_ASSUMPTIONS = Object.freeze({
  baseHitChancePct: core.BATTLE_ASSUMPTIONS.baseHitChancePct,
  minHitChancePct: core.BATTLE_ASSUMPTIONS.minHitChancePct,
  maxHitChancePct: core.BATTLE_ASSUMPTIONS.maxHitChancePct,
  baseCriticalChancePct: core.BATTLE_ASSUMPTIONS.baseCriticalChancePct,
  minCriticalChancePct: core.BATTLE_ASSUMPTIONS.minCriticalChancePct,
  maxCriticalChancePct: core.BATTLE_ASSUMPTIONS.maxCriticalChancePct,
  criticalDamageMultiplier: core.BATTLE_ASSUMPTIONS.criticalDamageMultiplier,
  defenseCoefficient: core.BATTLE_ASSUMPTIONS.defenseCoefficient,
  modifierStageRatio: core.BATTLE_ASSUMPTIONS.modifierStageRatio,
  modifierStageFloor: core.BATTLE_ASSUMPTIONS.modifierStageFloor,
  accuracyStagePoints: core.BATTLE_ASSUMPTIONS.accuracyStagePoints,
  battleTurnLimit: core.BATTLE_ASSUMPTIONS.battleTurnLimit,
  bossBattleTurnLimit: core.BATTLE_ASSUMPTIONS.bossBattleTurnLimit,
  monsterHpScale: 1,
  monsterOffenceScale: 1,
  cooldownTick: core.BATTLE_ASSUMPTIONS.cooldownTick,
  allyCountIncludesSelf: core.BATTLE_ASSUMPTIONS.allyCountIncludesSelf,
  enemyPriorityBand: core.BATTLE_ASSUMPTIONS.enemyPriorityBand,
  enemyPriorityWeightStep: core.BATTLE_ASSUMPTIONS.enemyPriorityWeightStep,
  enemySelection: core.BATTLE_ASSUMPTIONS.enemySelection,
  cooldownRecovery: core.BATTLE_ASSUMPTIONS.cooldownRecovery,
  candidateExhaustion: core.BATTLE_ASSUMPTIONS.candidateExhaustion,
  maxEnemyCombatants: core.BATTLE_ASSUMPTIONS.maxEnemyCombatants,
});

/**
 * Infer which defensive channel a player skill uses. This is part of the
 * active battle-model public API because battle-simulator consumes it when
 * executing player-authored damage. It is intentionally independent of all
 * legacy monster scaling/actor construction.
 */
export function inferPlayerDamageType(skill) {
  if (/魔法|魔導書/.test(skill?.category ?? '')) return 'magic';
  if (/炎|氷|雷|風|光|闇|水|土|精神/.test(skill?.category ?? '')) return 'magic';
  return 'physical';
}

/**
 * A two-handed main-hand weapon occupies both hands. Rejecting an off-hand at
 * build construction keeps UI/build witnesses and production battle state on
 * the same legality rule instead of silently counting an impossible shield.
 */
export function createPlayerBuild(data, options = {}) {
  const equipment = (options.equipmentIds ?? [])
    .map((equipmentId) => data?.equipmentById?.get?.(equipmentId))
    .filter(Boolean);
  const mainHand = equipment.find((entry) => entry.slot === 'mainHand') ?? null;
  const offHand = equipment.find((entry) => entry.slot === 'offHand') ?? null;
  if (mainHand?.grip === 'twoHand' && offHand) {
    const error = new Error(`illegal_equipment_combination:two_hand_with_off_hand:${mainHand.id}:${offHand.id}`);
    error.code = 'TWO_HAND_WITH_OFF_HAND';
    error.mainHandId = mainHand.id;
    error.offHandId = offHand.id;
    throw error;
  }
  const build = core.createPlayerBuild(data, options);
  return {
    ...build,
    // Journey/resource layers may choose a current HP/MP value without ever
    // redefining the actor's actual maximum.  Preserve the constructed maxima
    // as explicit actor invariants before any journey-specific initialization.
    resourceMaxHp: Number(build.maxHp ?? 0),
    resourceMaxMp: Number(build.maxMp ?? 0),
  };
}

/**
 * Player actor construction accepts explicit current resources while keeping
 * maxHp/maxMp authoritative.  This is intentionally defined in battle-model
 * (the public production entry point) instead of mutating the archived core
 * actor factory used by historical validation code.
 */
export function createPlayerActor(build, serial = 1) {
  const actor = core.createPlayerActor(build, serial);
  const maxHp = Math.max(1, Number(build?.resourceMaxHp ?? build?.maxHp ?? actor.maxHp ?? 1));
  const maxMp = Math.max(0, Number(build?.resourceMaxMp ?? build?.maxMp ?? actor.maxMp ?? 0));
  const implicitHp = Number(build?.maxHp ?? actor.hp ?? maxHp);
  const implicitMp = Number(build?.maxMp ?? actor.mp ?? maxMp);
  const requestedHp = Number.isFinite(Number(build?.initialHp)) ? Number(build.initialHp) : implicitHp;
  const requestedMp = Number.isFinite(Number(build?.initialMp)) ? Number(build.initialMp) : implicitMp;
  actor.maxHp = maxHp;
  actor.maxMp = maxMp;
  actor.hp = Math.max(0, Math.min(maxHp, requestedHp));
  actor.mp = Math.max(0, Math.min(maxMp, requestedMp));
  actor.alive = actor.hp > 0;
  return actor;
}

function normalizeMaterialBuyback(row) {
  const dropRateText = String(row['落ちる率'] ?? '').trim();
  return {
    id: row['素材ID'],
    baseCost: Number(row['原価G'] || 0),
    buybackPrice: Number(row['買取G'] || 0),
    cheapestSource: row['最安の出典'],
    referenceLevel: Number(row['基準Lv'] || 0),
    dropRatePct: dropRateText.endsWith('%') ? Number.parseFloat(dropRateText) : Number(dropRateText || 0),
    quantity: row['個数'],
    region: row['主地域'],
    sourceCount: Number(row['出典数'] || 0),
    raw: row,
  };
}

function attachCanonicalEconomy(data, battleSnapshot) {
  const materialRows = core.tableToRecords(battleSnapshot.tabs?.['素材買取価格'] ?? [], 0);
  const materialBuyback = materialRows.map(normalizeMaterialBuyback);
  data.materialBuyback = materialBuyback;
  data.materialBuybackById = new Map(materialBuyback.map((entry) => [entry.id, entry]));
  data.assumptions = BATTLE_ASSUMPTIONS;
  data.source = battleSnapshot.source ?? null;
  data.provenance = battleSnapshot.provenance ?? null;
  return data;
}

/**
 * Command target columns describe the command envelope, but COPY_LAST_ENEMY_SKILL
 * is special: canonical MSK-0090 uses target=self because the monster itself is
 * the copier. The damage produced by the copied hostile player skill must still
 * resolve against the opposing side. Keep the source row/raw command untouched
 * and make that runtime interpretation explicit here rather than silently
 * rewriting the spreadsheet or deriving behavior from simulation results.
 */
function attachMonsterCommandSemantics(data) {
  const monsterSkills = data.monsterSkills.map((skill) => {
    let changed = false;
    const commands = (skill.commands ?? []).map((command) => {
      if (command?.command !== 'COPY_LAST_ENEMY_SKILL' || command.target !== 'self') return command;
      changed = true;
      return { ...command, target: 'single_enemy' };
    });
    return changed ? { ...skill, commands } : skill;
  });
  data.monsterSkills = monsterSkills;
  data.monsterSkillById = new Map(monsterSkills.map((skill) => [skill.id, skill]));
  return data;
}

export function buildBattleData(battleSnapshot, playerSkills = [], bossCatalog = { version: null, bosses: [] }) {
  const compiledPlayerSkills = compilePlayerSkills(playerSkills);
  const data = core.buildBattleData(battleSnapshot, compiledPlayerSkills, bossCatalog);
  return attachCanonicalEconomy(attachMonsterCommandSemantics(data), battleSnapshot);
}

async function readPlayerSkillShards(fixtureDir) {
  const shardNames = [
    'skills-0001-0300.snapshot.json',
    'skills-0301-0600.snapshot.json',
    'skills-0601-0900.snapshot.json',
    'skills-0901-1141.snapshot.json',
  ];
  const shards = await Promise.all(shardNames.map(async (name) => (
    JSON.parse(await fs.readFile(path.join(fixtureDir, name), 'utf8'))
  )));
  return compilePlayerSkills(shards.flatMap((shard) => shard.skills ?? []));
}

export async function loadBattleData(fixtureDir = core.DEFAULT_FIXTURE_DIR) {
  const canonicalFixtureDir = path.resolve(core.DEFAULT_FIXTURE_DIR);
  const requestedFixtureDir = path.resolve(fixtureDir);
  const battleSnapshot = requestedFixtureDir === canonicalFixtureDir
    ? await loadCanonicalBattleSnapshot()
    : JSON.parse(await fs.readFile(path.join(fixtureDir, 'battle.snapshot.json'), 'utf8'));
  const bossCatalog = JSON.parse(await fs.readFile(path.join(fixtureDir, 'boss-combat-catalog.json'), 'utf8'));
  const playerSkills = await readPlayerSkillShards(fixtureDir);
  return buildBattleData(battleSnapshot, playerSkills, bossCatalog);
}

/**
 * Build an enemy actor directly from canonical stats. This deliberately does
 * not call the archived pre-normalization actor factory: there must be no
 * transient 0.55 HP / 1.4 offence scaling even if a caller inspects state
 * between construction steps.
 */
export function createMonsterActor(monster, serial = 1) {
  const maxHp = Math.max(1, Math.round(Number(monster.maxHp || 0)));
  return {
    ...monster,
    maxHp,
    hp: maxHp,
    mp: Number(monster.maxMp || 0),
    physicalPower: Number(monster.physicalPower || 0),
    magicPower: Number(monster.magicPower || 0),
    instanceId: `${monster.id}#${serial}`,
    side: 'enemy',
    alive: true,
    accuracy: Number(monster.accuracy || 0),
    evasion: Number(monster.evasion || 0),
    critical: Number(monster.critical || 0),
    debuffSuccess: Number(monster.debuffSuccess || 0),
    cooldowns: new Map(),
    uses: new Map(),
    modifiers: new Map(),
    debuffs: new Map(),
    specialStates: new Map(),
    lastActionTag: null,
    lastSkillId: null,
    lastSkillRepeatable: false,
    lastSkill: null,
    escaped: false,
    pendingIntent: null,
    bossPhase: monster.boss ? 0 : 1,
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    mpSpent: 0,
    skillIds: [],
    activeWeaponTypes: new Set(),
  };
}