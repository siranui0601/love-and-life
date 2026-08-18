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

const isMagicText = (skill) => /魔法|魔導|杖|本|炎|氷|雷|風|光|闇|水|土|精神/u.test(`${skill.category ?? ''} ${skill.originalCategory ?? ''} ${skill.description ?? ''}`);

function mechanic(family, source, params = {}) {
  return Object.freeze({ family, source, ...params });
}

function provisionalFamilies(skill, rule) {
  const text = String(rule?.description ?? skill.description ?? '');
  const rank = Math.max(1, Number(rule?.magnitudeRank ?? skill.rank ?? 1));
  const durationTurns = Math.max(1, Number(rule?.durationTurns ?? 1));
  const result = [];
  const add = (family, params = {}) => {
    if (!result.some((entry) => entry.family === family)) result.push(mechanic(family, 'provisionalRule', { rank, durationTurns, ...params }));
  };

  if (/直前.*(スキル|技|攻撃).*再現|劣化コピー|鏡写し/u.test(text)) add('COPY_ACTION');
  if (/ランダム|いずれか1判定を再判定|再判定/u.test(text)) add(/再判定/u.test(text) ? 'REROLL' : 'RANDOM_EFFECT_TABLE');
  if (/次に特定条件.*自動|自動で選択魔法|攻撃を受けるたび|回避時|敵を倒した時|被弾|最初の行動だけ/u.test(text)) add('REACTION_TRIGGER');
  if (/次の.*(攻撃|魔法|スキル)|次ターン.*(幸運|会心|魔法威力)|装填/u.test(text)) add('NEXT_ACTION_BONUS');
  if (/1ターン待機|待機し|長期詠唱|詠唱時間|予約/u.test(text)) add('DELAYED_ACTION');
  if (/影武者|単体攻撃を1回無効|分身/u.test(text)) add('SUBSTITUTE');
  if (/風域|陣|場を|属性環境|乾燥化|濃霧|聖域/u.test(text)) add('MODIFY_FIELD');
  if (/天候/u.test(text)) add('COMBAT_LOCAL_WEATHER');
  if (/消費MP.*(下|上)|MP消費.*(下|上)|消費MP.*増/u.test(text)) add('MODIFY_SKILL_COST');
  if (/戦闘CT.*短縮/u.test(text)) add('MODIFY_COOLDOWN');
  if (/行動順.*(上|下|遅)|次の行動.*遅延|行動不能/u.test(text)) add('MODIFY_ACTION_ORDER');
  if (/次の自分の回復効果を敵へのダメージ/u.test(text)) add('CONVERT_HEAL_TO_DAMAGE');
  if (/HP0でも.*行動|効果終了時に戦闘不能/u.test(text)) add('DELAYED_DEFEAT');
  if (/2回行動|追加行動/u.test(text)) add('MULTI_ACTION');
  if (/幸運.*参照|高変動/u.test(text)) add('LUCK_SCALING');
  if (/耐久|頁|ページ.*消費/u.test(text)) add('CONSUME_DURABILITY');
  if (/武器を一時使用不能|武器を捨てる/u.test(text)) add('TEMP_DISABLE_EQUIPMENT');
  if (/装備換装|武器・盾を切り替える|盾を一時外し/u.test(text)) add('EQUIPMENT_SWAP');
  if (/同じ魔法を連続|連続使用|詠唱蓄積|使用回数|3ターンごと|偶数ターン|戦闘ターン数|最初の数ターン/u.test(text)) add('HISTORY_SCALING');
  if (/強化状態を1つ解除|強化効果の持続を1ターン短縮|溜め・詠唱・命中・会心強化を1つ解除/u.test(text)) add('DISPEL_BUFF');
  if (/デバフを.*解除|全浄化/u.test(text)) add('CLEANSE_DEBUFF');
  if (/回復量|HPとMPを少量回復|MPを少量回復|超回復/u.test(text)) add('HEAL_OR_RESTORE');
  if (/封じ|成功率を下げ|命中.*下げ|攻撃.*下げ|回避.*下げ|魔法威力.*下げ|詠唱成功率.*下げ/u.test(text)) add('APPLY_DEBUFF');
  if (/命中.*上げ|会心.*上げ|威力.*上げ|全能力.*上昇|回避.*上昇|デバフ耐性.*上げ|魔法防御上昇|強化/u.test(text)) add('CONDITIONAL_BONUS');
  if (/敵単体.*(ダメージ|高威力)|敵全体.*(ダメージ|高威力)|複数回の低威力投擲|大魔法/u.test(text)) add('DAMAGE');
  if (/行動失敗/u.test(text)) add('STANCE_DRAWBACK');
  if (/狙われにく/u.test(text)) add('TAUNT_MODIFIER');
  if (/回復を受けられなく/u.test(text)) add('HEAL_RESTRICTION');
  if (/反動ダメージ/u.test(text)) add('SELF_DAMAGE');
  if (/使用効率/u.test(text)) add('ITEM_EFFICIENCY');
  if (/魔法命中.*表示|行動履歴を表示/u.test(text)) add('ANALYZE_HISTORY');
  if (/魔法系スキルの威力/u.test(text)) add('MAGIC_SUPPRESSION');
  if (/同じ対象へもう一度発動|アンコール/u.test(text)) add('REPEAT_LAST_SKILL');

  return result;
}

function structuralMechanics(skill) {
  const result = [];
  if (Number(skill.damage?.totalMultiplier ?? 0) > 0) {
    result.push(mechanic('DAMAGE', 'damage', { formula: skill.damage.formula, magic: isMagicText(skill) }));
  }
  for (const buff of skill.buffs ?? []) result.push(mechanic('APPLY_BUFF', 'buff', { type: buff.type, stat: buff.stat ?? null }));
  for (const debuff of skill.debuffs ?? []) result.push(mechanic('APPLY_DEBUFF', 'debuff', { type: debuff.type, stat: debuff.stat ?? null }));
  for (const state of skill.specialStates ?? []) {
    if (state?.type === 'provisionalRule') result.push(...provisionalFamilies(skill, state));
    else result.push(mechanic(SPECIAL_STATE_FAMILY[state?.type] ?? `SPECIAL_STATE:${state?.type ?? 'missing'}`, 'specialState', { type: state?.type ?? null }));
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
  const normalized = patch
    ? { ...skill, ...patch, learnConditions: structuralLearnConditions(skill, patch) }
    : { ...skill };
  const runtimeMechanics = structuralMechanics(normalized);
  const provisionalCount = (normalized.specialStates ?? []).filter((state) => state?.type === 'provisionalRule').length;
  const provisionalFamiliesResolved = provisionalCount === 0 || runtimeMechanics.some((entry) => entry.source === 'provisionalRule');
  return {
    ...normalized,
    runtimeMechanics,
    runtimeSemanticStatus: provisionalFamiliesResolved ? 'structured' : 'needs_semantics',
    canonicalGateOverlayApplied: Boolean(patch),
  };
}

export function compilePlayerSkills(skills) {
  return skills.map(compilePlayerSkill);
}

export function skillRuntimeCoverage(skills) {
  const compiled = compilePlayerSkills(skills);
  const unresolved = compiled.filter((skill) => skill.runtimeSemanticStatus !== 'structured').map((skill) => skill.id);
  const mechanicCounts = {};
  for (const skill of compiled) for (const entry of skill.runtimeMechanics) mechanicCounts[entry.family] = (mechanicCounts[entry.family] ?? 0) + 1;
  return {
    total: compiled.length,
    gateOverlays: compiled.filter((skill) => skill.canonicalGateOverlayApplied).map((skill) => skill.id),
    provisionalRows: compiled.filter((skill) => (skill.specialStates ?? []).some((state) => state?.type === 'provisionalRule')).map((skill) => skill.id),
    unresolved,
    mechanicCounts: Object.fromEntries(Object.entries(mechanicCounts).sort(([a], [b]) => a.localeCompare(b))),
  };
}

export const CANONICAL_PLAYER_SKILL_GATE_OVERLAY_VERSION = 'checkpoint-c-current-sheet-2026-08-19';
