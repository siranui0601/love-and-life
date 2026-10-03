export const EXTENDED_RUNTIME_EXECUTED_FAMILIES = new Set([
  'AFTER_EFFECT','ALLY_COUNT_SCALING','CONDITIONAL_BONUS','CONFUSION_TARGET_BIAS','CONVERT_HEAL_TO_DAMAGE','CONVERT_MODIFIER','COPY_ACTION','DAMAGE_TAKEN_UP','DEBUFF_GUARD','DELAYED_ACTION','DELAYED_DEFEAT','DISADVANTAGE_SCALING','DISPEL_BUFF','EQUIPMENT_CONDITION','EQUIPMENT_SWAP','FIELD_ELEMENT_CONVERSION','FORCE_BASIC_ACTION','HEAL_OR_RESTORE','HEAL_RESTRICTION','ITEM_EFFICIENCY','LIFE_STEAL','MAGIC_SUPPRESSION','MODIFY_ACTION_ORDER','MODIFY_COOLDOWN','MODIFY_DEBUFF','MODIFY_SKILL_COST','MULTI_ACTION','NORMAL_ATTACK_MODIFIER','ON_CRITICAL_RESOURCE','ON_DAMAGE_RESOURCE','ON_KILL_BONUS','ON_KILL_RESOURCE','PASSIVE_AUTO_EVADE','PASSIVE_AUTO_GUARD','PASSIVE_COST_MODIFIER','PASSIVE_DEBUFF_MITIGATION','PASSIVE_EQUIPMENT_MODIFIER','PASSIVE_ESCAPE_MODIFIER','PASSIVE_RESOURCE_REGEN','RANGED_EVASION_BONUS','REACTION_TRIGGER','REDUCE_BARRIER','RESOURCE_DRAIN','RESOURCE_TECHNIQUE','REVEAL_INTENT','SELF_DISABLE_NEXT_ACTION','SPECIAL_STATE:modifyEscapeChance','SPREAD_DEBUFF','STANCE','STANCE_DRAWBACK','TARGET_COUNT_SCALING','TAUNT_MODIFIER','TIME_COOLDOWN','TRANSFER_DEBUFF','TRAP_FIELD_BONUS','TURN_WINDOW_BONUS','WEAPON_STYLE_BONUS',
]);

const HANDLED_SPECIAL_TYPES = new Set([
  'hpThresholdTechnique','resourceTechnique','multiHitOrNormalAttackModifier','revealIntent','passiveWeaponModifier','passiveArmorModifier','passiveShieldModifier','modifyNormalAttack','dispelBuffs','modifyNextCost','transferDebuff','onDefeatedDebuffedEnemyRestore','modifyExistingDebuff','convertModifierStages','passiveDebuffMitigation','passiveCostModifier','passiveEscapeModifier','passiveThresholdModifier','onCriticalRestoreMp','onMagicDamageRestoreMp','lifeSteal','afterEffectApply','passiveAutoGuard','passiveAutoEvade','onMagicUsedExtraAction','passiveMpRegeneration','onKillGainStages','delayedDefeat','chant','spreadDebuff','drainMpFromPoisonedTarget','counterOnMissByAccuracyDebuffedEnemy','scaleByTargetDebuffCount','gainStagesByTargetDebuffCount','lastReceivedElementVulnerability','reduceBarrier','modifyEscapeChance',
]);

const family = (skill, id) => (skill?.runtimeMechanics ?? []).find((entry) => entry?.family === id) ?? null;
const has = (skill, id) => Boolean(family(skill, id));
const special = (skill, type) => (skill?.specialStates ?? []).find((entry) => entry?.type === type) ?? null;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
const live = (actors) => (actors ?? []).filter((actor) => actor?.alive && Number(actor.hp ?? 0) > 0 && !actor.escaped);
const rank = (skill, id = null) => Math.max(1, Number((id ? family(skill, id) : null)?.rank ?? (id ? family(skill, id) : null)?.semantics?.rank ?? skill?.rank ?? 1) || 1);
const duration = (skill, id, fallback = 3) => Math.max(1, Number(family(skill, id)?.durationTurns ?? family(skill, id)?.semantics?.durationTurns ?? fallback) || fallback);
const multiplier = (skill) => Number(skill?.damage?.totalMultiplier ?? skill?.damage?.perHitMultiplier ?? 0) || 0;

function stableUnit(text) {
  let hash = 0x811c9dc5;
  for (const character of String(text)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0) / 4294967296;
}

function withMultiplier(skill, value) {
  if (!(value > 0)) return skill;
  const hits = Math.max(1, Number(skill.damage?.hits ?? 1) || 1);
  return { ...skill, damage: { ...skill.damage, formula: 'fixedMultiplier', perHitMultiplier: value / hits, hits, totalMultiplier: value } };
}

function stripHandledSpecialStates(skill) {
  const next = (skill.specialStates ?? []).filter((entry) => entry?.type !== 'provisionalRule' && !HANDLED_SPECIAL_TYPES.has(entry?.type));
  return next.length === (skill.specialStates ?? []).length ? skill : { ...skill, specialStates: next };
}

function findActor(session, instanceId) {
  return [...(session?.state?.players ?? []), ...(session?.state?.enemies ?? [])].find((actor) => actor.instanceId === instanceId) ?? null;
}

function addModifier(actor, stat, stage, turns = 3) {
  if (!actor?.modifiers) return;
  const current = actor.modifiers.get(stat);
  actor.modifiers.set(stat, {
    stage: clamp(Number(current?.stage ?? 0) + Number(stage ?? 0), -6, 6),
    duration: Math.max(Number(current?.duration ?? 0), Math.max(1, Number(turns ?? 1))),
  });
}

function restoreHp(actor, amount) {
  if (!actor || !(amount > 0)) return 0;
  const before = Number(actor.hp ?? 0);
  actor.hp = Math.min(Number(actor.maxHp ?? before), before + amount);
  if (actor.hp > 0) actor.alive = true;
  return actor.hp - before;
}

function restoreMp(actor, amount) {
  if (!actor || !(amount > 0)) return 0;
  const before = Number(actor.mp ?? 0);
  actor.mp = Math.min(Number(actor.maxMp ?? before), before + amount);
  return actor.mp - before;
}

function spendMp(actor, amount) {
  if (!actor || !(amount > 0)) return 0;
  const before = Number(actor.mp ?? 0);
  actor.mp = Math.max(0, before - amount);
  return before - actor.mp;
}

function frameEffect(frame, instanceId) {
  return (frame?.effects ?? []).find((entry) => entry.targetInstanceId === instanceId) ?? null;
}

function ensureFrameEffect(frame, actor, beforeHp = actor.hp, beforeMp = actor.mp) {
  let effect = frameEffect(frame, actor.instanceId);
  if (!effect) {
    effect = { targetInstanceId: actor.instanceId, hpBefore: beforeHp, hpAfter: actor.hp, mpBefore: beforeMp, mpAfter: actor.mp, aliveBefore: true, aliveAfter: actor.alive };
    frame.effects = [...(frame.effects ?? []), effect];
  }
  return effect;
}

function dealExtraDamage(session, frame, amount) {
  const target = findActor(session, frame?.primaryTargetInstanceId);
  if (!target?.alive || !(amount > 0)) return 0;
  const before = Number(target.hp ?? 0);
  const dealt = Math.min(before, Math.max(0, Math.round(amount)));
  target.hp = Math.max(0, before - dealt);
  if (target.hp <= 0) target.alive = false;
  target.damageTaken = Number(target.damageTaken ?? 0) + dealt;
  const source = findActor(session, frame?.actorInstanceId);
  if (source) source.damageDealt = Number(source.damageDealt ?? 0) + dealt;
  frame.damage = Number(frame.damage ?? 0) + dealt;
  const effect = ensureFrameEffect(frame, target, before, target.mp);
  effect.hpAfter = target.hp;
  effect.aliveAfter = target.alive;
  return dealt;
}

function restoreIncomingDamage(session, frame, effect, amount) {
  const target = findActor(session, effect?.targetInstanceId);
  if (!target || !(amount > 0)) return 0;
  const restored = Math.min(amount, Math.max(0, Number(effect.hpBefore ?? target.maxHp) - Number(target.hp ?? 0)));
  target.hp = Math.min(target.maxHp, Number(target.hp ?? 0) + restored);
  if (target.hp > 0) target.alive = true;
  effect.hpAfter = Math.min(Number(effect.hpBefore ?? target.hp), Number(effect.hpAfter ?? 0) + restored);
  effect.aliveAfter = target.alive;
  frame.damage = Math.max(0, Number(frame.damage ?? 0) - restored);
  const source = findActor(session, frame.actorInstanceId);
  if (source) source.damageDealt = Math.max(0, Number(source.damageDealt ?? 0) - restored);
  return restored;
}

function emit(runtime, turn, skill, events, familyId, detail = {}) {
  const event = { type: 'player_runtime_mechanic', family: familyId, skillId: skill?.id ?? null, ...detail };
  events.push(event);
  runtime.extendedEvents.push({ turn, ...event });
  return event;
}

export function ensureExtendedRuntime(runtime) {
  runtime.extendedEvents ??= [];
  runtime.delayedActions ??= [];
  runtime.delayedDefeat ??= null;
  runtime.healRestriction ??= null;
  runtime.debuffGuard ??= null;
  runtime.fieldElementConversion ??= null;
  runtime.itemEfficiency ??= 1;
  runtime.trapFieldBonus ??= 0;
  runtime.revealedIntent ??= null;
  runtime.control ??= { selfDisableNextAction: 0, escapeBonus: 0 };
  runtime.control.selfDisableNextAction ??= 0;
  runtime.control.escapeBonus ??= 0;
  runtime.passive ??= {};
  Object.assign(runtime.passive, {
    autoGuardChance: runtime.passive.autoGuardChance ?? 0,
    autoGuardReduction: runtime.passive.autoGuardReduction ?? 0,
    autoEvadeChance: runtime.passive.autoEvadeChance ?? 0,
    costScale: runtime.passive.costScale ?? 1,
    debuffMitigation: runtime.passive.debuffMitigation ?? 0,
    escapeBonus: runtime.passive.escapeBonus ?? 0,
    mpRegenPct: runtime.passive.mpRegenPct ?? 0,
    equipmentModifier: runtime.passive.equipmentModifier ?? 0,
    rangedEvadeChance: runtime.passive.rangedEvadeChance ?? 0,
    reactionTriggerRank: runtime.passive.reactionTriggerRank ?? 0,
    normalAttackScale: runtime.passive.normalAttackScale ?? 1,
    onDamageRank: runtime.passive.onDamageRank ?? 0,
    onCriticalRank: runtime.passive.onCriticalRank ?? 0,
    onKillResourceRank: runtime.passive.onKillResourceRank ?? 0,
    onKillBonusRank: runtime.passive.onKillBonusRank ?? 0,
    lifeStealRank: runtime.passive.lifeStealRank ?? 0,
  });
  runtime.equipmentRuntime ??= { durabilitySpent: {}, disabledEquipmentIds: [], consumedCosts: [] };
  runtime.equipmentRuntime.swappedOutWeaponTypes ??= [];
  return runtime;
}

function initializePassive(runtime, actor, skill) {
  const value = rank(skill);
  if (has(skill, 'PASSIVE_AUTO_GUARD')) {
    const authored = special(skill, 'passiveAutoGuard');
    runtime.passive.autoGuardChance = Math.max(runtime.passive.autoGuardChance, Number(authored?.chancePct ?? 8 + value * 4) / 100);
    runtime.passive.autoGuardReduction = Math.max(runtime.passive.autoGuardReduction, Number(authored?.damageReductionPct ?? 25 + value * 5) / 100);
  }
  if (has(skill, 'PASSIVE_AUTO_EVADE')) runtime.passive.autoEvadeChance = Math.max(runtime.passive.autoEvadeChance, 0.04 + value * 0.03);
  if (has(skill, 'PASSIVE_COST_MODIFIER')) runtime.passive.costScale = Math.min(runtime.passive.costScale, Math.max(0.5, 1 - value * 0.04));
  if (has(skill, 'PASSIVE_DEBUFF_MITIGATION')) runtime.passive.debuffMitigation = Math.max(runtime.passive.debuffMitigation, value * 0.08);
  if (has(skill, 'PASSIVE_ESCAPE_MODIFIER') || has(skill, 'SPECIAL_STATE:modifyEscapeChance')) runtime.passive.escapeBonus = Math.max(runtime.passive.escapeBonus, 0.05 + value * 0.04);
  if (has(skill, 'PASSIVE_RESOURCE_REGEN')) runtime.passive.mpRegenPct = Math.max(runtime.passive.mpRegenPct, (2 + value) / 100);
  if (has(skill, 'PASSIVE_EQUIPMENT_MODIFIER')) {
    runtime.passive.equipmentModifier = Math.max(runtime.passive.equipmentModifier, value);
    actor.attack = Number(actor.attack ?? 0) + value;
    actor.defense = Number(actor.defense ?? 0) + value;
  }
  if (has(skill, 'RANGED_EVASION_BONUS')) runtime.passive.rangedEvadeChance = Math.max(runtime.passive.rangedEvadeChance, 0.05 + value * 0.03);
  if (has(skill, 'REACTION_TRIGGER')) runtime.passive.reactionTriggerRank = Math.max(runtime.passive.reactionTriggerRank, value);
  if (has(skill, 'NORMAL_ATTACK_MODIFIER')) runtime.passive.normalAttackScale = Math.max(runtime.passive.normalAttackScale, 1 + value * 0.08);
  if (has(skill, 'ON_DAMAGE_RESOURCE')) runtime.passive.onDamageRank = Math.max(runtime.passive.onDamageRank, value);
  if (has(skill, 'ON_CRITICAL_RESOURCE')) runtime.passive.onCriticalRank = Math.max(runtime.passive.onCriticalRank, value);
  if (has(skill, 'ON_KILL_RESOURCE')) runtime.passive.onKillResourceRank = Math.max(runtime.passive.onKillResourceRank, value);
  if (has(skill, 'ON_KILL_BONUS')) runtime.passive.onKillBonusRank = Math.max(runtime.passive.onKillBonusRank, value);
  if (has(skill, 'LIFE_STEAL')) runtime.passive.lifeStealRank = Math.max(runtime.passive.lifeStealRank, value);
}

export function initializeExtendedRuntime({ data, session }) {
  const runtime = ensureExtendedRuntime(session.playerRuntimeMechanics);
  const actor = session.state?.players?.[0];
  if (!actor) return runtime;
  for (const skillId of actor.skillIds ?? []) {
    const skill = data.playerSkillById.get(skillId);
    if (!skill || !['passive', 'reaction'].includes(skill.kind)) continue;
    initializePassive(runtime, actor, skill);
  }
  return runtime;
}

function equipmentConditionReason(skill, actor, runtime) {
  const leaves = (skill.activationConditions ?? []).filter((entry) => entry?.scope === 'equipment' && entry?.path === 'activeWeaponTypes');
  if (!leaves.length) return null;
  const actual = actor?.activeWeaponTypes instanceof Set ? actor.activeWeaponTypes : new Set(actor?.activeWeaponTypes ?? []);
  for (const leaf of leaves) {
    const expected = Array.isArray(leaf.value) ? leaf.value : [leaf.value];
    if (!expected.some((value) => actual.has(value))) return expected.includes('shield') ? 'shield_required' : 'wrong_weapon';
  }
  if ((runtime.equipmentRuntime?.disabledEquipmentIds ?? []).length) return 'equipment_disabled';
  return null;
}

export function prepareExtendedSkill({ skill, session }) {
  if (!skill) return { skill, blockedReason: null, metadata: {} };
  const runtime = ensureExtendedRuntime(session.playerRuntimeMechanics);
  const actor = session.state?.players?.[0];
  const enemies = live(session.state?.enemies);
  let prepared = stripHandledSpecialStates(skill);
  const metadata = {};

  const equipmentReason = equipmentConditionReason(skill, actor, runtime);
  if (equipmentReason) return { skill: prepared, blockedReason: equipmentReason, metadata };
  if (runtime.healRestriction && (skill.specialStates ?? []).some((entry) => entry?.type === 'healHp')) return { skill: prepared, blockedReason: 'healing_restricted', metadata };

  let scale = 1;
  if (has(skill, 'CONDITIONAL_BONUS')) scale *= 1 + rank(skill, 'CONDITIONAL_BONUS') * 0.08;
  if (has(skill, 'ALLY_COUNT_SCALING')) scale *= 1 + Math.max(0, live(session.state?.players).length - 1) * 0.15;
  if (has(skill, 'TARGET_COUNT_SCALING')) scale *= 1 + Math.max(0, enemies.length - 1) * 0.12;
  if (has(skill, 'DISADVANTAGE_SCALING') && actor) scale *= 1 + (1 - Number(actor.hp ?? 0) / Math.max(1, Number(actor.maxHp ?? 1))) * 0.75;
  if (has(skill, 'TURN_WINDOW_BONUS')) scale *= Number(session.state?.turn ?? 0) <= 3 ? 1.3 : 1;
  if (has(skill, 'WEAPON_STYLE_BONUS')) scale *= (actor?.activeWeaponTypes?.size ?? 0) > 0 ? 1.2 : 1;
  if (has(skill, 'TRAP_FIELD_BONUS') && (runtime.traps?.length ?? 0) > 0) scale *= 1.15 + Number(runtime.trapFieldBonus ?? 0) * 0.05;
  if (scale !== 1 && multiplier(prepared) > 0) { prepared = withMultiplier(prepared, multiplier(prepared) * scale); metadata.damageScale = scale; }

  let costScale = Number(runtime.passive.costScale ?? 1);
  if (has(skill, 'MODIFY_SKILL_COST')) costScale *= Math.max(0.5, 1 - rank(skill, 'MODIFY_SKILL_COST') * 0.06);
  if (costScale !== 1 && prepared.costs?.mpMode === 'fixed') {
    prepared = { ...prepared, costs: { ...prepared.costs, mp: Math.max(0, Math.floor(Number(prepared.costs?.mp ?? 0) * costScale)) } };
    metadata.costScale = costScale;
  }
  if (has(skill, 'DELAYED_ACTION') && multiplier(prepared) > 0) {
    metadata.delayedMultiplier = multiplier(prepared);
    prepared = withMultiplier(prepared, 0.000001);
  }
  return { skill: prepared, blockedReason: null, metadata };
}

export function extendedSpecificUnavailableReason({ skill, session, baseReason }) {
  if (!skill || !session) return baseReason;
  const runtime = ensureExtendedRuntime(session.playerRuntimeMechanics);
  const actor = session.state?.players?.[0];
  const equipmentReason = equipmentConditionReason(skill, actor, runtime);
  if (equipmentReason) return equipmentReason;
  if (baseReason === 'conditions_not_met' && has(skill, 'CONSUME_OWNED_FIELD')) return 'field_required';
  if (baseReason === 'uses_exhausted') return 'use_limit';
  return baseReason;
}

export function applyExtendedSkillSuccess({ data, originalSkill, metadata, session, frame }) {
  if (!originalSkill || !frame) return [];
  const runtime = ensureExtendedRuntime(session.playerRuntimeMechanics);
  const actor = session.state.players[0];
  const target = findActor(session, frame.primaryTargetInstanceId);
  const turn = Number(session.state?.turn ?? 0);
  const events = [];
  const E = (familyId, detail = {}) => emit(runtime, turn, originalSkill, events, familyId, detail);
  if (metadata?.damageScale) E('CONDITIONAL_BONUS', { damageScale: metadata.damageScale });
  if (metadata?.costScale) E('MODIFY_SKILL_COST', { costScale: metadata.costScale });

  if (has(originalSkill, 'AFTER_EFFECT') && target?.alive) E('AFTER_EFFECT', { extraDamage: dealExtraDamage(session, frame, Math.max(1, frame.damage * 0.2)) });
  if (has(originalSkill, 'COPY_ACTION')) {
    const previous = (runtime.actionHistory ?? []).at(-1);
    const copiedDamage = previous?.damage > 0 ? dealExtraDamage(session, frame, previous.damage * 0.7) : 0;
    E('COPY_ACTION', { sourceSkillId: previous?.skillId ?? null, copiedDamage });
  }
  if (has(originalSkill, 'CONVERT_HEAL_TO_DAMAGE') && target?.alive) E('CONVERT_HEAL_TO_DAMAGE', { convertedDamage: dealExtraDamage(session, frame, Math.max(1, Number(actor.magicPower ?? 1) * rank(originalSkill) * 0.4)) });
  if (has(originalSkill, 'CONVERT_MODIFIER') && target?.modifiers?.size) {
    const [id, entry] = target.modifiers.entries().next().value;
    entry.stage = clamp(-Number(entry.stage ?? 0), -6, 6);
    E('CONVERT_MODIFIER', { modifierId: id, stageAfter: entry.stage });
  }
  if (has(originalSkill, 'DISPEL_BUFF') && target) { const removed = target.modifiers?.size ?? 0; target.modifiers?.clear(); E('DISPEL_BUFF', { removedModifiers: removed }); }
  if (has(originalSkill, 'DAMAGE_TAKEN_UP') && target) { addModifier(target, 'defense', -1, duration(originalSkill, 'DAMAGE_TAKEN_UP')); E('DAMAGE_TAKEN_UP', { defenseStageDelta: -1 }); }
  if (has(originalSkill, 'DEBUFF_GUARD')) { runtime.debuffGuard = { sourceSkillId: originalSkill.id, expiresAfterTurn: turn + duration(originalSkill, 'DEBUFF_GUARD') - 1 }; E('DEBUFF_GUARD', { ...runtime.debuffGuard }); }
  if (has(originalSkill, 'HEAL_RESTRICTION')) { runtime.healRestriction = { sourceSkillId: originalSkill.id, expiresAfterTurn: turn + duration(originalSkill, 'HEAL_RESTRICTION') - 1 }; E('HEAL_RESTRICTION', { ...runtime.healRestriction }); }
  if (has(originalSkill, 'CONFUSION_TARGET_BIAS') && target) { target.debuffs.set('confusion', { duration: duration(originalSkill, 'CONFUSION_TARGET_BIAS'), params: { actionFailureChance: 0.35 } }); E('CONFUSION_TARGET_BIAS', { targetInstanceId: target.instanceId }); }
  if (has(originalSkill, 'MAGIC_SUPPRESSION') && target) { target.specialStates.set('seal', { duration: duration(originalSkill, 'MAGIC_SUPPRESSION'), params: { blockedTags: ['magic'] }, sourceSkillId: originalSkill.id }); E('MAGIC_SUPPRESSION', { targetInstanceId: target.instanceId }); }
  if (has(originalSkill, 'FORCE_BASIC_ACTION') && target) { target.specialStates.set('force_basic_action', { duration: duration(originalSkill, 'FORCE_BASIC_ACTION'), sourceSkillId: originalSkill.id }); E('FORCE_BASIC_ACTION', { targetInstanceId: target.instanceId }); }
  if (has(originalSkill, 'MODIFY_ACTION_ORDER')) { addModifier(actor, 'agility', 1, duration(originalSkill, 'MODIFY_ACTION_ORDER')); E('MODIFY_ACTION_ORDER', { agilityStageDelta: 1 }); }
  if (has(originalSkill, 'STANCE')) { addModifier(actor, 'attack', 1, duration(originalSkill, 'STANCE')); E('STANCE', { attackStageDelta: 1 }); }
  if (has(originalSkill, 'STANCE_DRAWBACK')) { addModifier(actor, 'defense', -1, duration(originalSkill, 'STANCE_DRAWBACK')); E('STANCE_DRAWBACK', { defenseStageDelta: -1 }); }
  if (has(originalSkill, 'TAUNT_MODIFIER')) { actor.specialStates.set('taunt', { duration: duration(originalSkill, 'TAUNT_MODIFIER'), sourceSkillId: originalSkill.id }); E('TAUNT_MODIFIER', { active: true }); }
  if (has(originalSkill, 'REVEAL_INTENT')) { runtime.revealedIntent = live(session.state.enemies).map((enemy) => ({ instanceId: enemy.instanceId, pendingIntent: enemy.pendingIntent ?? null })); E('REVEAL_INTENT', { intents: structuredClone(runtime.revealedIntent) }); }
  if (has(originalSkill, 'SELF_DISABLE_NEXT_ACTION')) { runtime.control.selfDisableNextAction = Math.max(runtime.control.selfDisableNextAction, 1); E('SELF_DISABLE_NEXT_ACTION', { actions: 1 }); }
  if (has(originalSkill, 'DELAYED_DEFEAT')) { runtime.delayedDefeat = { sourceSkillId: originalSkill.id, charges: 1, expiresAfterTurn: turn + duration(originalSkill, 'DELAYED_DEFEAT') - 1 }; E('DELAYED_DEFEAT', { ...runtime.delayedDefeat }); }
  if (has(originalSkill, 'DELAYED_ACTION') && metadata?.delayedMultiplier) { runtime.delayedActions.push({ sourceSkillId: originalSkill.id, executeTurn: turn + 1, targetInstanceId: target?.instanceId ?? null, multiplier: metadata.delayedMultiplier }); E('DELAYED_ACTION', { executeTurn: turn + 1, multiplier: metadata.delayedMultiplier }); }
  if (has(originalSkill, 'MULTI_ACTION') && target?.alive) E('MULTI_ACTION', { extraDamage: dealExtraDamage(session, frame, Math.max(1, frame.damage * 0.5)) });
  if (has(originalSkill, 'MODIFY_COOLDOWN')) {
    const candidates = [...actor.cooldowns.entries()].filter(([id]) => id !== originalSkill.id);
    if (candidates.length) { const [id, value] = candidates.sort((a, b) => b[1] - a[1])[0]; actor.cooldowns.set(id, Math.max(0, Number(value) - 1)); E('MODIFY_COOLDOWN', { skillId: id, cooldownAfter: actor.cooldowns.get(id) }); }
    else E('MODIFY_COOLDOWN', { skillId: null, cooldownAfter: null });
  }
  if (has(originalSkill, 'TIME_COOLDOWN')) { const effect = { type: 'time_cooldown', sourceSkillId: originalSkill.id, durationHours: Math.max(1, rank(originalSkill, 'TIME_COOLDOWN')) }; runtime.postBattleEffects ??= []; runtime.postBattleEffects.push(effect); E('TIME_COOLDOWN', effect); }
  if (has(originalSkill, 'MODIFY_DEBUFF') && target?.debuffs?.size) { const [id, entry] = target.debuffs.entries().next().value; entry.duration = Number(entry.duration ?? 1) + 1; E('MODIFY_DEBUFF', { debuffId: id, durationAfter: entry.duration }); }
  if (has(originalSkill, 'SPREAD_DEBUFF') && target?.debuffs?.size) {
    const other = live(session.state.enemies).find((enemy) => enemy.instanceId !== target.instanceId);
    const [id, entry] = target.debuffs.entries().next().value;
    if (other) other.debuffs.set(id, structuredClone(entry));
    E('SPREAD_DEBUFF', { debuffId: id, targetInstanceId: other?.instanceId ?? null });
  }
  if (has(originalSkill, 'TRANSFER_DEBUFF') && actor?.debuffs?.size && target) { const [id, entry] = actor.debuffs.entries().next().value; actor.debuffs.delete(id); target.debuffs.set(id, structuredClone(entry)); E('TRANSFER_DEBUFF', { debuffId: id, targetInstanceId: target.instanceId }); }
  if (has(originalSkill, 'REDUCE_BARRIER') && target) { const barrier = target.specialStates.get('barrier'); const before = Number(barrier?.capacity ?? 0); if (barrier) { barrier.capacity = Math.max(0, before - Math.max(1, before * 0.5)); if (barrier.capacity <= 0) target.specialStates.delete('barrier'); } E('REDUCE_BARRIER', { capacityBefore: before, capacityAfter: Number(target.specialStates.get('barrier')?.capacity ?? 0) }); }
  if (has(originalSkill, 'RESOURCE_DRAIN') && target) { const drained = spendMp(target, Math.max(1, Math.round(Number(target.maxMp ?? 10) * 0.1))); E('RESOURCE_DRAIN', { drainedMp: drained, restoredMp: restoreMp(actor, drained) }); }
  if (has(originalSkill, 'RESOURCE_TECHNIQUE')) E('RESOURCE_TECHNIQUE', { restoredMp: restoreMp(actor, Math.max(1, Math.round(actor.maxMp * 0.08))) });
  if (has(originalSkill, 'HEAL_OR_RESTORE')) {
    const hpRatio = actor.hp / Math.max(1, actor.maxHp);
    if (hpRatio < 0.7) E('HEAL_OR_RESTORE', { restoredHp: restoreHp(actor, Math.max(1, Math.round(actor.maxHp * 0.12))), restoredMp: 0 });
    else E('HEAL_OR_RESTORE', { restoredHp: 0, restoredMp: restoreMp(actor, Math.max(1, Math.round(actor.maxMp * 0.12))) });
  }
  if (has(originalSkill, 'LIFE_STEAL') && frame.damage > 0) E('LIFE_STEAL', { restoredHp: restoreHp(actor, Math.max(1, Math.round(frame.damage * 0.12))) });
  if (has(originalSkill, 'ON_CRITICAL_RESOURCE') && frame.criticals > 0) E('ON_CRITICAL_RESOURCE', { restoredMp: restoreMp(actor, Math.max(1, Math.round(actor.maxMp * 0.08))) });
  if (has(originalSkill, 'ON_KILL_RESOURCE')) { const kills = (frame.effects ?? []).filter((entry) => entry.aliveBefore === true && entry.aliveAfter === false).length; E('ON_KILL_RESOURCE', { kills, restoredMp: kills ? restoreMp(actor, Math.max(1, Math.round(actor.maxMp * 0.1))) : 0 }); }
  if (has(originalSkill, 'ON_KILL_BONUS')) { const kills = (frame.effects ?? []).filter((entry) => entry.aliveBefore === true && entry.aliveAfter === false).length; if (kills) addModifier(actor, 'attack', 1, 3); E('ON_KILL_BONUS', { kills, attackStageDelta: kills ? 1 : 0 }); }
  if (has(originalSkill, 'ON_DAMAGE_RESOURCE')) E('ON_DAMAGE_RESOURCE', { armed: true });
  if (has(originalSkill, 'ITEM_EFFICIENCY')) { runtime.itemEfficiency = Math.max(runtime.itemEfficiency, 1 + rank(originalSkill, 'ITEM_EFFICIENCY') * 0.1); E('ITEM_EFFICIENCY', { scale: runtime.itemEfficiency }); }
  if (has(originalSkill, 'TRAP_FIELD_BONUS')) { runtime.trapFieldBonus = Math.max(runtime.trapFieldBonus, rank(originalSkill, 'TRAP_FIELD_BONUS')); E('TRAP_FIELD_BONUS', { rank: runtime.trapFieldBonus }); }
  if (has(originalSkill, 'EQUIPMENT_SWAP')) {
    const types = [...(actor.activeWeaponTypes ?? [])];
    runtime.equipmentRuntime.swappedOutWeaponTypes = types;
    actor.activeWeaponTypes = new Set();
    E('EQUIPMENT_SWAP', { removedWeaponTypes: types, activeWeaponTypes: [] });
  }
  if (has(originalSkill, 'FIELD_ELEMENT_CONVERSION')) { runtime.fieldElementConversion = { sourceSkillId: originalSkill.id, to: 'dry', expiresAfterTurn: turn + duration(originalSkill, 'FIELD_ELEMENT_CONVERSION') - 1 }; E('FIELD_ELEMENT_CONVERSION', { ...runtime.fieldElementConversion }); }
  if (has(originalSkill, 'EQUIPMENT_CONDITION')) E('EQUIPMENT_CONDITION', { activeWeaponTypes: [...(actor.activeWeaponTypes ?? [])] });
  if (has(originalSkill, 'NORMAL_ATTACK_MODIFIER')) { runtime.passive.normalAttackScale = Math.max(runtime.passive.normalAttackScale, 1 + rank(originalSkill, 'NORMAL_ATTACK_MODIFIER') * 0.08); E('NORMAL_ATTACK_MODIFIER', { scale: runtime.passive.normalAttackScale }); }
  if (has(originalSkill, 'REACTION_TRIGGER')) { runtime.passive.reactionTriggerRank = Math.max(runtime.passive.reactionTriggerRank, rank(originalSkill, 'REACTION_TRIGGER')); E('REACTION_TRIGGER', { rank: runtime.passive.reactionTriggerRank }); }
  if (has(originalSkill, 'RANGED_EVASION_BONUS')) { runtime.passive.rangedEvadeChance = Math.max(runtime.passive.rangedEvadeChance, 0.05 + rank(originalSkill, 'RANGED_EVASION_BONUS') * 0.03); E('RANGED_EVASION_BONUS', { chance: runtime.passive.rangedEvadeChance }); }
  if (has(originalSkill, 'PASSIVE_ESCAPE_MODIFIER') || has(originalSkill, 'SPECIAL_STATE:modifyEscapeChance')) { runtime.control.escapeBonus = Math.max(runtime.control.escapeBonus, 0.05 + rank(originalSkill) * 0.04); E(has(originalSkill, 'SPECIAL_STATE:modifyEscapeChance') ? 'SPECIAL_STATE:modifyEscapeChance' : 'PASSIVE_ESCAPE_MODIFIER', { bonus: runtime.control.escapeBonus }); }

  runtime.actionHistory ??= [];
  runtime.actionHistory.push({ skillId: originalSkill.id, turn, targetInstanceId: frame.primaryTargetInstanceId ?? null, damage: Number(frame.damage ?? 0), hits: Number(frame.hits ?? 0), criticals: Number(frame.criticals ?? 0) });
  if (runtime.actionHistory.length > 32) runtime.actionHistory.splice(0, runtime.actionHistory.length - 32);
  return events;
}

function attach(frame, event) { if (frame) frame.events = [...(frame.events ?? []), event]; }

function applyProtection(session, runtime, round) {
  const turn = Number(session.state?.turn ?? 0);
  for (const frame of round?.frames ?? []) {
    if (frame.actorSide !== 'enemy' || frame.phase !== 'action') continue;
    const effect = (frame.effects ?? []).find((entry) => Number(entry.hpBefore) > Number(entry.hpAfter) && session.state.players.some((player) => player.instanceId === entry.targetInstanceId));
    if (!effect) continue;
    const incoming = Number(effect.hpBefore) - Number(effect.hpAfter);
    if (!(incoming > 0)) continue;
    const evadeChance = clamp(Number(runtime.passive.autoEvadeChance) + Number(runtime.passive.rangedEvadeChance), 0, 0.75);
    if (evadeChance > 0 && stableUnit(`${session.seed}:${turn}:${frame.seq}:evade`) < evadeChance) {
      const restored = restoreIncomingDamage(session, frame, effect, incoming);
      const familyId = runtime.passive.autoEvadeChance > 0 ? 'PASSIVE_AUTO_EVADE' : 'RANGED_EVASION_BONUS';
      const event = { type: 'player_runtime_mechanic', family: familyId, evadedDamage: restored };
      attach(frame, event); runtime.extendedEvents.push({ turn, ...event });
      continue;
    }
    if (runtime.passive.autoGuardChance > 0 && stableUnit(`${session.seed}:${turn}:${frame.seq}:guard`) < runtime.passive.autoGuardChance) {
      const restored = restoreIncomingDamage(session, frame, effect, incoming * runtime.passive.autoGuardReduction);
      const event = { type: 'player_runtime_mechanic', family: 'PASSIVE_AUTO_GUARD', reducedDamage: restored };
      attach(frame, event); runtime.extendedEvents.push({ turn, ...event });
    }
    const remaining = Math.max(0, Number(effect.hpBefore) - Number(effect.hpAfter));
    if (remaining > 0 && runtime.passive.reactionTriggerRank > 0) {
      runtime.nextAction = { sourceSkillId: `REACTION:${frame.action?.skillId ?? frame.action?.actionId ?? 'enemy'}`, damageScale: 1 + runtime.passive.reactionTriggerRank * 0.08, mpScale: 1, duplicate: false, armedTurn: turn };
      const event = { type: 'player_runtime_mechanic', family: 'REACTION_TRIGGER', triggerDamage: remaining, armed: { ...runtime.nextAction } };
      attach(frame, event); runtime.extendedEvents.push({ turn, ...event });
    }
    if (remaining > 0 && runtime.passive.onDamageRank > 0) {
      const player = session.state.players[0];
      const event = { type: 'player_runtime_mechanic', family: 'ON_DAMAGE_RESOURCE', triggerDamage: remaining, restoredMp: restoreMp(player, Math.max(1, Math.round(player.maxMp * (0.03 + runtime.passive.onDamageRank * 0.01)))) };
      attach(frame, event); runtime.extendedEvents.push({ turn, ...event });
    }
  }
}

function applyPlayerTriggers(session, runtime, round) {
  const turn = Number(session.state?.turn ?? 0);
  const player = session.state.players[0];
  for (const frame of round?.frames ?? []) {
    if (frame.actorSide !== 'player' || frame.phase !== 'action') continue;
    if (frame.action?.kind === 'attack' && runtime.passive.normalAttackScale > 1 && Number(frame.damage) > 0) {
      const event = { type: 'player_runtime_mechanic', family: 'NORMAL_ATTACK_MODIFIER', scale: runtime.passive.normalAttackScale, extraDamage: dealExtraDamage(session, frame, frame.damage * (runtime.passive.normalAttackScale - 1)) };
      attach(frame, event); runtime.extendedEvents.push({ turn, ...event });
    }
    if (runtime.passive.lifeStealRank > 0 && Number(frame.damage) > 0) {
      const event = { type: 'player_runtime_mechanic', family: 'LIFE_STEAL', restoredHp: restoreHp(player, Math.max(1, Math.round(frame.damage * (0.05 + runtime.passive.lifeStealRank * 0.02)))) };
      attach(frame, event); runtime.extendedEvents.push({ turn, ...event });
    }
    if (runtime.passive.onCriticalRank > 0 && Number(frame.criticals) > 0) {
      const event = { type: 'player_runtime_mechanic', family: 'ON_CRITICAL_RESOURCE', restoredMp: restoreMp(player, Math.max(1, Math.round(player.maxMp * (0.03 + runtime.passive.onCriticalRank * 0.01)))) };
      attach(frame, event); runtime.extendedEvents.push({ turn, ...event });
    }
    const kills = (frame.effects ?? []).filter((entry) => entry.aliveBefore === true && entry.aliveAfter === false).length;
    if (kills && runtime.passive.onKillResourceRank > 0) {
      const event = { type: 'player_runtime_mechanic', family: 'ON_KILL_RESOURCE', kills, restoredMp: restoreMp(player, Math.max(1, Math.round(player.maxMp * (0.04 + runtime.passive.onKillResourceRank * 0.01)))) };
      attach(frame, event); runtime.extendedEvents.push({ turn, ...event });
    }
    if (kills && runtime.passive.onKillBonusRank > 0) {
      addModifier(player, 'attack', 1, 3);
      const event = { type: 'player_runtime_mechanic', family: 'ON_KILL_BONUS', kills, attackStageDelta: 1 };
      attach(frame, event); runtime.extendedEvents.push({ turn, ...event });
    }
  }
}

function applyDelayedActions(session, runtime, round) {
  const turn = Number(session.state?.turn ?? 0);
  const due = runtime.delayedActions.filter((entry) => Number(entry.executeTurn) <= turn);
  runtime.delayedActions = runtime.delayedActions.filter((entry) => Number(entry.executeTurn) > turn);
  for (const delayed of due) {
    const target = findActor(session, delayed.targetInstanceId) ?? live(session.state.enemies)[0];
    const player = session.state.players[0];
    if (!target?.alive) continue;
    const amount = Math.max(1, Math.round(Math.max(Number(player.physicalPower ?? 1), Number(player.magicPower ?? 1)) * Number(delayed.multiplier ?? 1)));
    const before = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    if (target.hp <= 0) target.alive = false;
    const event = { type: 'player_runtime_mechanic', family: 'DELAYED_ACTION', sourceSkillId: delayed.sourceSkillId, targetInstanceId: target.instanceId, damage: before - target.hp };
    runtime.extendedEvents.push({ turn, ...event });
    attach((round?.frames ?? []).find((entry) => entry.actorSide === 'player') ?? round?.frames?.at(-1), event);
  }
}

function applyDebuffProtection(session, runtime, round) {
  const player = session.state.players[0];
  const turn = Number(session.state?.turn ?? 0);
  if (runtime.debuffGuard && Number(runtime.debuffGuard.expiresAfterTurn) >= turn && player.debuffs?.size) {
    const [id] = player.debuffs.keys();
    player.debuffs.delete(id);
    const event = { type: 'player_runtime_mechanic', family: 'DEBUFF_GUARD', removedDebuffId: id };
    runtime.extendedEvents.push({ turn, ...event }); attach(round?.frames?.at(-1), event);
  } else if (runtime.passive.debuffMitigation > 0 && player.debuffs?.size) {
    for (const [id, entry] of player.debuffs) {
      if (stableUnit(`${session.seed}:${turn}:${id}:mitigate`) >= runtime.passive.debuffMitigation) continue;
      entry.duration = Math.max(0, Number(entry.duration ?? 1) - 1);
      if (entry.duration <= 0) player.debuffs.delete(id);
      const event = { type: 'player_runtime_mechanic', family: 'PASSIVE_DEBUFF_MITIGATION', debuffId: id, durationAfter: entry.duration };
      runtime.extendedEvents.push({ turn, ...event }); attach(round?.frames?.at(-1), event); break;
    }
  }
}

function applyRoundRegen(session, runtime, round) {
  const player = session.state.players[0];
  if (runtime.passive.mpRegenPct <= 0) return;
  const restored = restoreMp(player, Math.max(1, Math.round(player.maxMp * runtime.passive.mpRegenPct)));
  if (!restored) return;
  const event = { type: 'player_runtime_mechanic', family: 'PASSIVE_RESOURCE_REGEN', restoredMp: restored };
  runtime.extendedEvents.push({ turn: session.state.turn, ...event }); attach(round?.frames?.at(-1), event);
}

function applyDelayedDefeat(session, runtime, round) {
  if (!runtime.delayedDefeat) return;
  const player = session.state.players[0];
  const turn = Number(session.state?.turn ?? 0);
  if (player.alive || runtime.delayedDefeat.charges <= 0 || turn > Number(runtime.delayedDefeat.expiresAfterTurn)) return;
  player.hp = 1; player.alive = true; runtime.delayedDefeat.charges -= 1;
  const event = { type: 'player_runtime_mechanic', family: 'DELAYED_DEFEAT', sourceSkillId: runtime.delayedDefeat.sourceSkillId, hpAfter: 1 };
  runtime.extendedEvents.push({ turn, ...event }); attach(round?.frames?.at(-1), event);
}

export function applyExtendedRoundRuntime({ data, session, round }) {
  const runtime = ensureExtendedRuntime(session.playerRuntimeMechanics);
  const turn = Number(session.state?.turn ?? 0);
  if (runtime.healRestriction && Number(runtime.healRestriction.expiresAfterTurn) < turn) runtime.healRestriction = null;
  if (runtime.debuffGuard && Number(runtime.debuffGuard.expiresAfterTurn) < turn) runtime.debuffGuard = null;
  if (runtime.fieldElementConversion && Number(runtime.fieldElementConversion.expiresAfterTurn) < turn) runtime.fieldElementConversion = null;
  applyProtection(session, runtime, round);
  applyPlayerTriggers(session, runtime, round);
  applyDelayedActions(session, runtime, round);
  applyDebuffProtection(session, runtime, round);
  applyRoundRegen(session, runtime, round);
  applyDelayedDefeat(session, runtime, round);
  const playerAlive = session.state.players.some((entry) => entry.alive && entry.hp > 0);
  const enemyAlive = session.state.enemies.some((entry) => entry.alive && entry.hp > 0 && !entry.escaped);
  if (playerAlive && enemyAlive && session.winner === 'enemies') { session.winner = null; session.status = 'active'; }
  return runtime.extendedEvents;
}
