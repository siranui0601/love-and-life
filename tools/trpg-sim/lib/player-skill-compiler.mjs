import { PLAYER_PROVISIONAL_SEMANTICS } from './player-provisional-semantics.mjs';

const CURRENT_GATE_OVERRIDES = Object.freeze({
  'SKL-0050': { revealConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 5 }], eventUnlockConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 12 }, { scope: 'progress', path: 'combat.physicalKills', op: 'gte', value: 5 }] },
  'SKL-0051': { revealConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 8 }], eventUnlockConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 16 }, { scope: 'progress', path: 'debuffs.stat.successfulApplications', op: 'gte', value: 3 }] },
  'SKL-0052': { revealConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 4 }], eventUnlockConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 6 }, { scope: 'progress', path: 'combat.criticalHits', op: 'gte', value: 2 }] },
  'SKL-0054': { revealConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 12 }], eventUnlockConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 24 }, { scope: 'progress', path: 'debuffs.stat.successfulApplications', op: 'gte', value: 5 }] },
  'SKL-0055': { revealConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 4 }], eventUnlockConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 8 }, { scope: 'progress', path: 'combat.physicalSkillUses', op: 'gte', value: 8 }] },
  'SKL-0056': { revealConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 12 }], eventUnlockConditions: [{ scope: 'progress', path: 'weapon.axe.skillUses', op: 'gte', value: 22 }, { scope: 'progress', path: 'combat.physicalKills', op: 'gte', value: 8 }] },
  'SKL-0141': { revealConditions: [{ scope: 'progress', path: 'battles.totalCount', op: 'gte', value: 2 }], eventUnlockConditions: [{ scope: 'progress', path: 'battles.totalCount', op: 'gte', value: 3 }, { scope: 'equipment', path: 'activeWeaponTypes', op: 'containsAny', value: ['shield'] }, { scope: 'progress', path: 'combat.physicalSkillUses', op: 'gte', value: 6 }] },
  'SKL-0143': { revealConditions: [{ scope: 'progress', path: 'battles.totalCount', op: 'gte', value: 6 }], eventUnlockConditions: [{ scope: 'progress', path: 'battles.totalCount', op: 'gte', value: 8 }, { scope: 'equipment', path: 'activeWeaponTypes', op: 'containsAny', value: ['shield'] }, { scope: 'progress', path: 'combat.physicalSkillUses', op: 'gte', value: 18 }] },
  'SKL-0146': { revealConditions: [{ scope: 'progress', path: 'battles.totalCount', op: 'gte', value: 4 }], eventUnlockConditions: [{ scope: 'progress', path: 'battles.totalCount', op: 'gte', value: 6 }, { scope: 'equipment', path: 'activeWeaponTypes', op: 'containsAny', value: ['shield'] }, { scope: 'progress', path: 'combat.physicalSkillUses', op: 'gte', value: 12 }] },
  'SKL-0149': { revealConditions: [{ scope: 'progress', path: 'battles.totalCount', op: 'gte', value: 3 }], eventUnlockConditions: [{ scope: 'progress', path: 'battles.totalCount', op: 'gte', value: 5 }, { scope: 'equipment', path: 'activeWeaponTypes', op: 'containsAny', value: ['shield'] }, { scope: 'progress', path: 'combat.physicalSkillUses', op: 'gte', value: 10 }] },
});

export const PLAYER_TARGETS = new Set(['contextual', 'single_enemy', 'self', 'all_enemies', 'all_combatants', 'random_enemies', 'field', 'single_ally']);
export const PLAYER_KINDS = new Set(['active', 'passive', 'reaction', 'none']);
export const ACQUISITION_CODES = new Set(['basic_level_up', 'flag_unlocked', 'event_granted', 'equipment_granted', 'non_skill', 'deleted']);

const SPECIAL_STATE_FAMILY = Object.freeze({
  healHp: 'HEAL', restoreMp: 'RESTORE_RESOURCE', cleanDebuffs: 'CLEANSE_DEBUFF', cleanseDebuffs: 'CLEANSE_DEBUFF',
  barrier: 'BARRIER', damageReduction: 'DAMAGE_REDUCTION', guard: 'GUARD', counter: 'COUNTER', reflect: 'REFLECT',
  surviveFatal: 'SURVIVE_LETHAL', manaShield: 'MANA_SHIELD', regeneration: 'REGENERATION', substitute: 'SUBSTITUTE',
  summonUnit: 'SUMMON', placeTrap: 'TRAP', fieldModifier: 'MODIFY_FIELD', nextSkillModifier: 'NEXT_ACTION_BONUS',
  hpThresholdTechnique: 'CONDITIONAL_BONUS', resourceTechnique: 'RESOURCE_TECHNIQUE', multiHitOrNormalAttackModifier: 'NORMAL_ATTACK_MODIFIER',
  revealIntent: 'REVEAL_INTENT', passiveWeaponModifier: 'PASSIVE_EQUIPMENT_MODIFIER', passiveArmorModifier: 'PASSIVE_EQUIPMENT_MODIFIER',
  modifyNormalAttack: 'NORMAL_ATTACK_MODIFIER', dispelBuffs: 'DISPEL_BUFF', allowHpForMissingMp: 'ALLOW_HP_FOR_MP',
  modifyNextCost: 'MODIFY_SKILL_COST', transferDebuff: 'TRANSFER_DEBUFF', onDefeatedDebuffedEnemyRestore: 'ON_KILL_RESOURCE',
  modifyExistingDebuff: 'MODIFY_DEBUFF', convertModifierStages: 'CONVERT_MODIFIER', passiveDebuffMitigation: 'PASSIVE_DEBUFF_MITIGATION',
  passiveCostModifier: 'PASSIVE_COST_MODIFIER', passiveShieldModifier: 'PASSIVE_EQUIPMENT_MODIFIER', passiveEscapeModifier: 'PASSIVE_ESCAPE_MODIFIER',
  passiveThresholdModifier: 'CONDITIONAL_BONUS', onCriticalRestoreMp: 'ON_CRITICAL_RESOURCE', onMagicDamageRestoreMp: 'ON_DAMAGE_RESOURCE',
  lifeSteal: 'LIFE_STEAL', afterEffectApply: 'AFTER_EFFECT', passiveAutoGuard: 'PASSIVE_AUTO_GUARD', passiveAutoEvade: 'PASSIVE_AUTO_EVADE',
  onMagicUsedExtraAction: 'MULTI_ACTION', passiveMpRegeneration: 'PASSIVE_RESOURCE_REGEN', onKillGainStages: 'ON_KILL_BONUS', delayedDefeat: 'DELAYED_DEFEAT',
  chant: 'DELAYED_ACTION', repeatLastSkill: 'REPEAT_LAST_SKILL', duplicateNextAction: 'DUPLICATE_NEXT_ACTION', temporaryResource: 'TEMP_RESOURCE',
  applyRandomDifferentDebuff: 'RANDOM_EFFECT_TABLE', spreadDebuff: 'SPREAD_DEBUFF', drainMpFromPoisonedTarget: 'RESOURCE_DRAIN',
  counterOnMissByAccuracyDebuffedEnemy: 'REACTION_TRIGGER', scaleByTargetDebuffCount: 'CONDITIONAL_BONUS', gainStagesByTargetDebuffCount: 'CONDITIONAL_BONUS',
  lastReceivedElementVulnerability: 'REACTION_TRIGGER', reduceBarrier: 'REDUCE_BARRIER',
});

const isMagicSkill = (skill) => /魔法|魔導書|杖|本|炎|氷|雷|風|光|闇|水|土|精神/u.test(`${skill.category ?? ''} ${skill.originalCategory ?? ''}`);
const mechanic = (family, source, params = {}) => Object.freeze({ family, source, ...params });

function structuralMechanics(skill) {
  const result = [];
  if (Number(skill.damage?.totalMultiplier ?? 0) > 0) {
    result.push(mechanic('DAMAGE', 'damage', { formula: skill.damage.formula, magic: isMagicSkill(skill) }));
  }
  for (const buff of skill.buffs ?? []) result.push(mechanic('APPLY_BUFF', 'buff', { type: buff.type, stat: buff.stat ?? null }));
  for (const debuff of skill.debuffs ?? []) result.push(mechanic('APPLY_DEBUFF', 'debuff', { type: debuff.type, stat: debuff.stat ?? null }));

  let provisional = false;
  for (const state of skill.specialStates ?? []) {
    if (state?.type === 'provisionalRule') {
      provisional = true;
      continue;
    }
    result.push(mechanic(SPECIAL_STATE_FAMILY[state?.type] ?? `SPECIAL_STATE:${state?.type ?? 'missing'}`, 'specialState', { type: state?.type ?? null }));
  }
  if (provisional) {
    const semantics = PLAYER_PROVISIONAL_SEMANTICS[skill.id];
    if (semantics) {
      for (const family of semantics.families) {
        result.push(mechanic(family, 'structuredRegistry', {
          rank: semantics.rank,
          durationTurns: semantics.durationTurns,
          semantics,
        }));
      }
    }
  }

  const mode = skill.damage?.formula;
  if (mode === 'repeatLastSkill') result.push(mechanic('REPEAT_LAST_SKILL', 'powerMode'));
  if (mode === 'repeatWhileHit') result.push(mechanic('REPEAT_WHILE_HIT', 'powerMode'));
  if (mode === 'goldScaling') result.push(mechanic('GOLD_SPEND_SCALING', 'powerMode'));
  if (mode === 'luckScaling') result.push(mechanic('LUCK_SCALING', 'powerMode'));
  if (['currentHpScaling', 'missingHpScaling', 'currentMpScaling'].includes(mode)) result.push(mechanic('RESOURCE_SPEND_SCALING', 'powerMode', { mode }));
  if (skill.costs?.mpMode === 'all_current') result.push(mechanic('ALL_MP_COST', 'cost'));
  if (skill.costs?.hpMode && skill.costs.hpMode !== 'fixed') result.push(mechanic('HP_COST_MODE', 'cost', { mode: skill.costs.hpMode }));
  if (skill.costs?.money === 'variable' || Number(skill.costs?.money ?? 0) > 0) result.push(mechanic('GOLD_COST', 'cost'));
  if (skill.costs?.itemOrEquipment) result.push(mechanic('ITEM_OR_EQUIPMENT_COST', 'cost'));
  if (skill.target === 'field') result.push(mechanic('MODIFY_FIELD', 'target'));
  return result;
}

function structuralLearnConditions(skill, patch) {
  const existing = Array.isArray(skill.learnConditions) ? skill.learnConditions : [];
  const structural = existing.filter((condition) => condition?.scope === 'player' && ['level', 'skills'].includes(condition?.path));
  return structural.concat(patch.eventUnlockConditions ?? []);
}

export function compilePlayerSkill(skill) {
  const patch = CURRENT_GATE_OVERRIDES[skill?.skillId ?? skill?.id];
  const normalized = patch ? { ...skill, ...patch, learnConditions: structuralLearnConditions(skill, patch) } : { ...skill };
  const provisionalRuleCount = (normalized.specialStates ?? []).filter((state) => state?.type === 'provisionalRule').length;
  const semantics = provisionalRuleCount ? PLAYER_PROVISIONAL_SEMANTICS[normalized.id] : null;
  const runtimeMechanics = structuralMechanics(normalized);
  return {
    ...normalized,
    runtimeMechanics,
    provisionalRuleCount,
    provisionalSemanticId: semantics ? normalized.id : null,
    runtimeSemanticStatus: provisionalRuleCount === 0 || semantics ? 'structured' : 'needs_semantics',
    canonicalGateOverlayApplied: Boolean(patch),
  };
}

export function compilePlayerSkills(skills) {
  return skills.map(compilePlayerSkill);
}

export function skillRuntimeCoverage(skills) {
  const compiled = compilePlayerSkills(skills);
  const provisionalRows = compiled.filter((skill) => skill.provisionalRuleCount > 0).map((skill) => skill.id);
  const unresolved = compiled.filter((skill) => skill.runtimeSemanticStatus !== 'structured').map((skill) => skill.id);
  const mechanicCounts = {};
  for (const skill of compiled) for (const entry of skill.runtimeMechanics) mechanicCounts[entry.family] = (mechanicCounts[entry.family] ?? 0) + 1;
  return {
    total: compiled.length,
    gateOverlays: compiled.filter((skill) => skill.canonicalGateOverlayApplied).map((skill) => skill.id),
    provisionalRows,
    provisionalRegistryRows: Object.keys(PLAYER_PROVISIONAL_SEMANTICS).sort(),
    unresolved,
    mechanicCounts: Object.fromEntries(Object.entries(mechanicCounts).sort(([a], [b]) => a.localeCompare(b))),
  };
}

export const CANONICAL_PLAYER_SKILL_GATE_OVERLAY_VERSION = 'checkpoint-c-current-sheet-2026-08-19';
