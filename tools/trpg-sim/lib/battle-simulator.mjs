import {
  BATTLE_ASSUMPTIONS,
  DiagnosticBag,
  calculateCriticalChance,
  calculateHitChance,
  calculateMagicDamage,
  calculatePhysicalDamage,
  canonicalStat,
  createMonsterActor,
  createPlayerActor,
  createPlayerBuild,
  createSeededRng,
  evaluateActionCondition,
  evaluateStructuredConditions,
  expandEncounter,
  inferPlayerDamageType,
  weightedChoice,
} from './battle-model.mjs';

const IMPLEMENTED_PLAYER_SPECIAL_STATES = new Set([
  'barrier', 'damageReduction', 'guard', 'healHp', 'restoreMp', 'surviveFatal',
  'regeneration', 'cleanseDebuffs', 'reflect', 'manaShield', 'counter',
]);

const ACTOR_STAT_PROPERTIES = Object.freeze({
  physical_power: 'physicalPower',
  magic_power: 'magicPower',
  magic_resistance: 'magicResistance',
  debuff_resistance: 'debuffResistance',
  debuff_success: 'debuffSuccess',
});

const SPECIAL_STATE_ALIASES = Object.freeze({
  surviveFatal: 'survive_lethal',
});

function living(actors) {
  return actors.filter((actor) => actor.alive && actor.hp > 0);
}

function modifierStage(actor, stat) {
  return Number(actor.modifiers.get(canonicalStat(stat))?.stage ?? 0);
}

export function actorStat(actor, stat) {
  const canonical = canonicalStat(stat);
  const base = Number(actor[canonical] ?? actor[stat] ?? actor[ACTOR_STAT_PROPERTIES[canonical]] ?? 0);
  const stage = modifierStage(actor, canonical);
  if (['accuracy', 'evasion', 'critical', 'debuff_success', 'debuff_resistance'].includes(canonical)) {
    return base + stage * BATTLE_ASSUMPTIONS.accuracyStagePoints;
  }
  return Math.max(0, base * Math.max(0.1, 1 + stage * BATTLE_ASSUMPTIONS.modifierStageRatio));
}

function ratio(actor, resource) {
  return resource === 'hp' ? actor.hp / actor.maxHp : actor.mp / actor.maxMp;
}

function markDead(actor) {
  if (actor.hp <= 0) {
    const survive = actor.specialStates.get('survive_lethal');
    if (survive?.charges > 0) {
      survive.charges -= 1;
      actor.hp = 1;
      if (survive.charges <= 0) actor.specialStates.delete('survive_lethal');
      return;
    }
    actor.hp = 0;
    actor.alive = false;
  }
}

function barrierCapacity(effect, actor) {
  if (Number.isFinite(Number(effect.capacity))) return Number(effect.capacity);
  const formula = effect.capacityFormula ?? effect.params?.capacityFormula;
  const maxHpMatch = String(formula ?? '').match(/^maxHp\*(\d+(?:\.\d+)?)$/);
  if (maxHpMatch) return actor.maxHp * Number(maxHpMatch[1]);
  if (effect.capacityMode === 'skillScaled') return actor.maxHp * 0.18;
  return actor.maxHp * 0.1;
}

function damageReductionRatio(target) {
  let reduction = 0;
  for (const [stateId, state] of target.specialStates) {
    if (stateId === 'guard') {
      const playerGuardPct = Number(state.damageReductionPct);
      const guardReduction = state.params?.damageReduction
        ?? (Number.isFinite(playerGuardPct) ? playerGuardPct / 100 : 0.35);
      reduction = Math.max(
        reduction,
        Number(guardReduction),
      );
    }
    if (stateId === 'damageReduction') reduction = Math.max(reduction, Number(state.amountPct ?? 0) / 100);
  }
  return Math.min(0.8, reduction);
}

function applyDamage(target, rawDamage, damageType, source) {
  let damage = Math.max(1, rawDamage * (1 - damageReductionRatio(target)));
  const barrier = target.specialStates.get('barrier');
  if (barrier?.capacity > 0) {
    const absorbed = Math.min(barrier.capacity, damage);
    barrier.capacity -= absorbed;
    damage -= absorbed;
    if (barrier.capacity <= 0) target.specialStates.delete('barrier');
  }
  damage = Math.max(0, damage);
  target.hp -= damage;
  target.damageTaken += damage;
  source.damageDealt += damage;
  if (damageType === 'magic') {
    const absorb = target.specialStates.get('magic_absorb');
    if (absorb) target.mp = Math.min(target.maxMp, target.mp + damage * Number(absorb.params?.ratio ?? 0));
  }
  markDead(target);
  return damage;
}

function applyHealing(target, amount, source) {
  if (!target.alive) return 0;
  const healed = Math.max(0, Math.min(target.maxHp - target.hp, amount));
  target.hp += healed;
  source.healingDone += healed;
  return healed;
}

function setCooldownAndUse(actor, key, cooldown, usesKey = key) {
  actor.cooldowns.set(key, Math.max(0, Number(cooldown || 0)));
  actor.uses.set(usesKey, (actor.uses.get(usesKey) ?? 0) + 1);
}

function isOnCooldown(actor, key) {
  return Number(actor.cooldowns.get(key) ?? 0) > 0;
}

function targetSet(targetSpec, actor, opponents, allies, preferred, rng) {
  const liveOpponents = living(opponents);
  const liveAllies = living(allies);
  if (targetSpec === 'self') return [actor];
  if (targetSpec === 'all_enemies') return liveOpponents;
  if (targetSpec === 'all_allies') return liveAllies;
  if (targetSpec === 'all_combatants') return [...liveOpponents, ...liveAllies];
  if (targetSpec === 'single_ally') {
    return [liveAllies.slice().sort((a, b) => ratio(a, 'hp') - ratio(b, 'hp'))[0]].filter(Boolean);
  }
  if (targetSpec === 'random_enemies') {
    return liveOpponents.length ? [liveOpponents[rng.int(0, liveOpponents.length - 1)]] : [];
  }
  return [preferred?.alive ? preferred : liveOpponents[0]].filter(Boolean);
}

function battleContext(state, actor, target) {
  const allies = actor.side === 'player' ? state.players : state.enemies;
  const opponents = actor.side === 'player' ? state.enemies : state.players;
  return {
    self: actor,
    target,
    turn: state.turn,
    alliesAlive: living(allies),
    enemiesAlive: living(opponents),
    fieldTags: state.fieldTags,
    fieldEffects: state.fieldEffects,
    world: state.world,
    history: {
      playerLastSkillRepeatable: state.history.playerLastSkillRepeatable,
    },
  };
}

function canPayPlayerCost(actor, skill) {
  const costs = skill.costs ?? {};
  if (costs.mpMode === 'all_current') return actor.mp > 0;
  return actor.mp >= Number(costs.mp || 0);
}

function payPlayerCost(actor, skill, diagnostics) {
  const costs = skill.costs ?? {};
  const beforeMp = actor.mp;
  if (costs.mpMode === 'all_current') actor.mp = 0;
  else actor.mp = Math.max(0, actor.mp - Number(costs.mp || 0));
  actor.mpSpent += beforeMp - actor.mp;

  const hpCost = Number(costs.hp || 0);
  if (costs.hpMode === 'max_ratio') actor.hp -= actor.maxHp * hpCost;
  else if (costs.hpMode === 'current_ratio') actor.hp -= actor.hp * hpCost;
  else if (costs.hpMode === 'set_to_one') actor.hp = 1;
  else if (costs.hpMode === 'set_zero') actor.hp = 0;
  else actor.hp -= hpCost;
  if (costs.money && costs.money !== 0) diagnostics.add('unmodeledMoneyCost', { skillId: skill.id });
  if (costs.itemOrEquipment) diagnostics.add('unmodeledItemOrEquipmentCost', { skillId: skill.id, cost: costs.itemOrEquipment });
  markDead(actor);
}

function failureFromDebuff(actor, rng) {
  const paralysis = actor.debuffs.get('paralysis');
  if (paralysis) {
    const chance = Number(paralysis.params?.actionFailureChance ?? paralysis.params?.actionFailurePct ?? 40) / 100;
    if (rng.bool(chance)) return true;
  }
  const confusion = actor.debuffs.get('confusion');
  return Boolean(confusion && rng.bool(Number(confusion.params?.actionFailureChance ?? 25) / 100));
}

function inferPlayerUtility(skill, actor, enemies) {
  const damage = Number(skill.damage?.totalMultiplier || 0);
  const targetFactor = skill.target === 'all_enemies' ? Math.min(3, living(enemies).length) : 1;
  let utility = damage * (inferPlayerDamageType(skill) === 'magic' ? actor.magicPower : actor.physicalPower) * targetFactor;
  for (const state of skill.specialStates ?? []) {
    if (state.type === 'healHp') utility += (1 - ratio(actor, 'hp')) * actor.maxHp * 1.6;
    if (state.type === 'barrier' || state.type === 'damageReduction') utility += (1 - ratio(actor, 'hp')) * actor.maxHp * 0.6;
  }
  utility += (skill.buffs?.length ?? 0) * 8 + (skill.debuffs?.length ?? 0) * 10;
  utility -= Number(skill.costs?.mp || 0) * 0.35;
  return utility;
}

export function selectPlayerAction({ data, state, actor, rng, diagnostics }) {
  const opponents = living(state.enemies);
  const target = opponents[0];
  const skills = actor.skillIds.map((id) => data.playerSkillById.get(id)).filter(Boolean);
  const conditionEligible = skills.filter((skill) => {
    if (skill.kind !== 'active') return false;
    if (isOnCooldown(actor, skill.id)) return false;
    if (skill.cooldown?.usesPerBattle !== null && skill.cooldown?.usesPerBattle !== undefined
      && (actor.uses.get(skill.id) ?? 0) >= Number(skill.cooldown.usesPerBattle)) return false;
    return evaluateStructuredConditions(skill.activationConditions, battleContext(state, actor, target), diagnostics);
  });
  const candidates = conditionEligible.filter((skill) => canPayPlayerCost(actor, skill));
  if (!candidates.length) {
    const resourceBlocked = conditionEligible.filter((skill) => !canPayPlayerCost(actor, skill));
    if (resourceBlocked.length) {
      diagnostics.add('playerResourceExhaustion', {
        playerId: actor.id,
        turn: state.turn,
        hp: actor.hp,
        mp: actor.mp,
        blockedSkillIds: resourceBlocked.map((skill) => skill.id),
      });
    }
    return { type: 'normal', actor, target, fallback: false };
  }
  const best = candidates
    .map((skill) => ({ skill, utility: inferPlayerUtility(skill, actor, state.enemies) }))
    .sort((a, b) => b.utility - a.utility || a.skill.id.localeCompare(b.skill.id))[0];
  const normalUtility = actor.physicalPower;
  if (best.utility <= normalUtility * 0.85) return { type: 'normal', actor, target, fallback: false };
  return { type: 'playerSkill', actor, target, skill: best.skill, fallback: false };
}

export function selectEnemyAction({ data, state, actor, rng, diagnostics }) {
  const opponents = living(state.players);
  const target = opponents[0];
  const actions = data.actionsByMonsterId.get(actor.id) ?? [];
  const registries = { knownStates: new Set(data.audit.knownStates) };
  const candidates = actions.filter((action) => {
    const skill = data.monsterSkillById.get(action.skillId);
    if (!skill) {
      diagnostics.add('missingMonsterSkill', { actionId: action.id, skillId: action.skillId });
      return false;
    }
    if (actor.mp < skill.mpCost || isOnCooldown(actor, skill.id)) return false;
    if (action.usesPerBattle !== null && (actor.uses.get(action.id) ?? 0) >= action.usesPerBattle) return false;
    const context = battleContext(state, actor, target);
    if (!evaluateActionCondition(action.condition, context, diagnostics, registries)) return false;
    return evaluateStructuredConditions(skill.conditions, context, diagnostics);
  });
  if (!candidates.length) {
    diagnostics.add('candidateExhaustion', { monsterId: actor.id, turn: state.turn });
    return { type: 'normal', actor, target, fallback: true };
  }
  const action = weightedChoice(candidates, (candidate) => candidate.baseWeight, rng);
  return { type: 'monsterSkill', actor, target, action, skill: data.monsterSkillById.get(action.skillId), fallback: false };
}

function applyModifier(target, command) {
  const stat = canonicalStat(command.modifier ?? command.stat);
  const current = target.modifiers.get(stat);
  const stage = Number(command.stage ?? command.params?.stage ?? 0);
  target.modifiers.set(stat, {
    stage: Math.max(-6, Math.min(6, Number(current?.stage ?? 0) + stage)),
    duration: Number(command.durationTurns ?? current?.duration ?? 1),
  });
}

function applyDebuff(source, target, command, rng) {
  const id = command.debuffId ?? command.type;
  const baseChance = Number(command.baseChance ?? command.chancePct ?? 100);
  const individual = Number(target.individualDebuffResistance?.[id] ?? 0);
  const chance = Math.max(0.05, Math.min(0.95,
    (baseChance + actorStat(source, 'debuffSuccess') - actorStat(target, 'debuffResistance') - individual) / 100));
  if (!rng.bool(chance)) return false;
  target.debuffs.set(id, {
    duration: Number(command.durationTurns ?? 1),
    params: command.params ?? command,
    sourceId: source.instanceId,
  });
  if (command.params?.stage) applyModifier(target, { modifier: id.replace('_down', ''), stage: command.params.stage, durationTurns: command.durationTurns });
  return true;
}

function applySpecialState(target, command) {
  const rawStateId = command.stateId ?? command.type;
  const stateId = SPECIAL_STATE_ALIASES[rawStateId] ?? rawStateId;
  const rawDuration = command.durationTurns ?? command.duration;
  const numericDuration = Number(rawDuration);
  const entry = {
    duration: Number.isFinite(numericDuration) && numericDuration > 0 ? numericDuration : 1,
    params: command.params ?? {},
    ...command,
  };
  if (stateId === 'barrier') entry.capacity = barrierCapacity(command, target);
  if (stateId === 'survive_lethal') entry.charges = Number(command.params?.charges ?? command.charges ?? 1);
  target.specialStates.set(stateId, entry);
}

function executeDamageCommand({ command, skill, actor, targets, rng, criticalBonus = 0 }) {
  const damageType = command.damageType ?? 'physical';
  const hits = Math.max(1, Number(command.hits ?? 1));
  let totalDamage = 0;
  let hitCount = 0;
  let criticalCount = 0;
  for (const target of targets) {
    for (let hit = 0; hit < hits && target.alive; hit += 1) {
      const accuracy = actorStat(actor, 'accuracy') + Number(skill?.accuracy ?? 0) + Number(command.accuracy ?? 0);
      if (!rng.bool(calculateHitChance({ accuracy, targetEvasion: actorStat(target, 'evasion') }))) continue;
      hitCount += 1;
      const critical = rng.bool(calculateCriticalChance({
        critical: actorStat(actor, 'critical') + criticalBonus,
        targetLuck: actorStat(target, 'luck'),
      }));
      if (critical) criticalCount += 1;
      let damage = damageType === 'magic'
        ? calculateMagicDamage({
          magicPower: actorStat(actor, 'magicPower'), attack: actorStat(actor, 'attack'),
          multiplier: command.multiplier ?? 1, fixed: command.fixed ?? 0,
          magicResistance: actorStat(target, 'magicResistance'),
        })
        : calculatePhysicalDamage({
          weaponPower: actorStat(actor, 'physicalPower'), attack: actorStat(actor, 'attack'),
          multiplier: command.multiplier ?? 1, fixed: command.fixed ?? 0,
          defense: actorStat(target, 'defense'),
        });
      if (critical) damage *= BATTLE_ASSUMPTIONS.criticalDamageMultiplier;
      totalDamage += applyDamage(target, damage, damageType, actor);
    }
  }
  return { damage: totalDamage, hits: hitCount, criticals: criticalCount };
}

function executeMonsterSkill({ state, action, data, rng, diagnostics }) {
  const { actor, target, skill } = action;
  actor.mp -= skill.mpCost;
  actor.mpSpent += skill.mpCost;
  setCooldownAndUse(actor, skill.id, action.action.cooldownOverride ?? skill.cooldown, action.action.id);
  const opponents = actor.side === 'player' ? state.enemies : state.players;
  const allies = actor.side === 'player' ? state.players : state.enemies;
  const criticalBonus = skill.commands
    .filter((command) => command.command === 'MODIFY_CRITICAL')
    .reduce((sum, command) => sum + Number(command.criticalChance || 0), 0);
  let lastDamage = 0;
  const totals = { damage: 0, hits: 0, criticals: 0, healing: 0 };
  for (const command of skill.commands) {
    if (command.command === 'MODIFY_CRITICAL') continue;
    const targets = targetSet(command.target ?? skill.target, actor, opponents, allies, target, rng);
    switch (command.command) {
      case 'DAMAGE': {
        const result = executeDamageCommand({ command, skill, actor, targets, rng, criticalBonus });
        totals.damage += result.damage;
        totals.hits += result.hits;
        totals.criticals += result.criticals;
        lastDamage = result.damage;
        break;
      }
      case 'HEAL': {
        for (const healTarget of targets) {
          const amount = command.formula === 'damageDealtRatio'
            ? lastDamage * Number(command.ratio ?? 0)
            : command.formula === 'maxHpRatio'
              ? healTarget.maxHp * Number(command.ratio ?? 0)
              : Number(command.fixed ?? command.amount ?? 0);
          totals.healing += applyHealing(healTarget, amount, actor);
        }
        break;
      }
      case 'APPLY_DEBUFF':
        for (const debuffTarget of targets) applyDebuff(actor, debuffTarget, command, rng);
        break;
      case 'APPLY_MODIFIER':
        for (const modifierTarget of targets) applyModifier(modifierTarget, command);
        break;
      case 'APPLY_SPECIAL_STATE':
        for (const stateTarget of targets) applySpecialState(stateTarget, command);
        break;
      case 'MODIFY_RESOURCE':
        for (const resourceTarget of targets) {
          const resource = command.resource === 'hp' ? 'hp' : 'mp';
          const maximum = resource === 'hp' ? resourceTarget.maxHp : resourceTarget.maxMp;
          const change = Number(command.amount ?? 0) + maximum * Number(command.amountRatio ?? 0);
          resourceTarget[resource] = Math.max(0, Math.min(maximum, resourceTarget[resource] + change));
          if (resource === 'hp') markDead(resourceTarget);
        }
        break;
      case 'REMOVE_DEBUFF':
        for (const removeTarget of targets) {
          const first = removeTarget.debuffs.keys().next().value;
          if (first) removeTarget.debuffs.delete(first);
        }
        break;
      case 'REMOVE_MODIFIER':
        for (const removeTarget of targets) removeTarget.modifiers.delete(canonicalStat(command.modifier));
        break;
      default:
        diagnostics.add('unknownCommandFallback', { skillId: skill.id, command: command.command });
        break;
    }
  }
  actor.lastActionTag = skill.classification === '魔法' ? 'magic' : 'skill';
  actor.lastSkillId = skill.id;
  return totals;
}

function executePlayerSpecialState(effect, actor, preferredTarget, diagnostics) {
  const target = effect.target === 'single_ally' ? preferredTarget ?? actor : actor;
  switch (effect.type) {
    case 'healHp':
      return { healing: applyHealing(target, target.maxHp * Number(effect.valuePct ?? 0) / 100, actor) };
    case 'restoreMp':
      target.mp = Math.min(target.maxMp, target.mp + target.maxMp * Number(effect.valuePct ?? 0) / 100);
      return {};
    case 'cleanseDebuffs': {
      const first = target.debuffs.keys().next().value;
      if (first) target.debuffs.delete(first);
      return {};
    }
    case 'damageReduction':
    case 'barrier':
    case 'guard':
    case 'surviveFatal':
    case 'regeneration':
    case 'reflect':
    case 'manaShield':
    case 'counter':
      applySpecialState(target, effect);
      return {};
    default:
      diagnostics.add('unsupportedPlayerSpecialState', { type: effect.type });
      return {};
  }
}

function executePlayerSkill({ state, action, rng, diagnostics }) {
  const { actor, target, skill } = action;
  payPlayerCost(actor, skill, diagnostics);
  setCooldownAndUse(actor, skill.id, skill.cooldown?.battleTurns ?? 0);
  if (!actor.alive && skill.costs?.hpMode !== 'set_zero') return { damage: 0, hits: 0, criticals: 0, healing: 0 };
  const opponents = living(state.enemies);
  const allies = living(state.players);
  const targetSpec = skill.target === 'contextual' ? 'single_enemy' : skill.target;
  if (skill.target === 'contextual') diagnostics.add('contextualTargetFallback', { skillId: skill.id, fallback: targetSpec });
  const targets = targetSet(targetSpec, actor, opponents, allies, target, rng);
  const totals = { damage: 0, hits: 0, criticals: 0, healing: 0 };
  if (skill.damage?.formula !== 'none' && Number(skill.damage?.totalMultiplier || 0) > 0) {
    let multiplier = Number(skill.damage.totalMultiplier);
    if (skill.damage.formula === 'currentHpScaling') multiplier *= 0.6 + ratio(actor, 'hp') * 0.8;
    else if (skill.damage.formula === 'missingHpScaling') multiplier *= 0.6 + (1 - ratio(actor, 'hp')) * 0.8;
    else if (skill.damage.formula === 'currentMpScaling') multiplier *= 0.6 + ratio(actor, 'mp') * 0.8;
    else if (!['fixedMultiplier', 'luckScaling'].includes(skill.damage.formula)) {
      diagnostics.add('unknownPlayerDamageFormulaFallback', { skillId: skill.id, formula: skill.damage.formula });
    }
    const result = executeDamageCommand({
      command: {
        damageType: inferPlayerDamageType(skill), multiplier: multiplier / Math.max(1, Number(skill.damage.hits || 1)),
        fixed: 0, hits: Math.max(1, Number(skill.damage.hits || 1)), accuracy: Number(skill.damage.accuracyModifier || 0),
      },
      skill: { accuracy: 0 }, actor, targets, rng, criticalBonus: Number(skill.damage.criticalModifier || 0),
    });
    Object.assign(totals, result);
  }
  for (const buff of skill.buffs ?? []) {
    if (buff.type === 'statStage') applyModifier(actor, { modifier: buff.stat, stage: buff.stage, durationTurns: buff.durationTurns });
    else diagnostics.add('unsupportedPlayerBuff', { skillId: skill.id, type: buff.type });
  }
  for (const debuff of skill.debuffs ?? []) {
    for (const debuffTarget of targets) {
      if (debuff.type === 'statStage') applyModifier(debuffTarget, { modifier: debuff.stat, stage: debuff.stage, durationTurns: debuff.durationTurns });
      else applyDebuff(actor, debuffTarget, { ...debuff, debuffId: debuff.type, baseChance: debuff.chancePct ?? 100 }, rng);
    }
  }
  for (const stateEffect of skill.specialStates ?? []) {
    if (!IMPLEMENTED_PLAYER_SPECIAL_STATES.has(stateEffect.type)) {
      diagnostics.add('unsupportedPlayerSpecialState', { skillId: skill.id, type: stateEffect.type });
      continue;
    }
    const result = executePlayerSpecialState(stateEffect, actor, allies[0], diagnostics);
    totals.healing += Number(result.healing || 0);
  }
  actor.lastActionTag = inferPlayerDamageType(skill) === 'magic' ? 'magic' : 'skill';
  actor.lastSkillId = skill.id;
  actor.lastSkillRepeatable = skill.id !== 'SKL-1139' && skill.kind === 'active';
  state.history.playerLastSkillRepeatable = actor.lastSkillRepeatable;
  return totals;
}

function executeNormalAttack(action, state, rng) {
  const { actor, target } = action;
  if (!target?.alive) return { damage: 0, hits: 0, criticals: 0, healing: 0 };
  const result = executeDamageCommand({
    command: { damageType: 'physical', multiplier: 1, fixed: 0, hits: 1, accuracy: 0 },
    skill: { accuracy: 0 }, actor, targets: [target], rng, criticalBonus: 0,
  });
  actor.lastActionTag = 'physical';
  actor.lastSkillId = '__normal__';
  actor.lastSkillRepeatable = false;
  return { ...result, healing: 0 };
}

function tickDurationMap(map) {
  for (const [key, entry] of map) {
    entry.duration = Number(entry.duration ?? 1) - 1;
    if (entry.duration <= 0) map.delete(key);
  }
}

function startRound(state) {
  if (state.turn <= 1) return;
  for (const actor of [...state.players, ...state.enemies]) {
    for (const [key, value] of actor.cooldowns) {
      const next = Number(value) - 1;
      if (next <= 0) actor.cooldowns.delete(key);
      else actor.cooldowns.set(key, next);
    }
    tickDurationMap(actor.modifiers);
    tickDurationMap(actor.debuffs);
    tickDurationMap(actor.specialStates);
  }
}

function endRound(state) {
  for (const actor of living([...state.players, ...state.enemies])) {
    const poison = actor.debuffs.get('poison');
    if (poison) applyDamage(actor, Math.max(1, actor.maxHp * Number(poison.params?.maxHpRatio ?? 0.04)), 'fixed', actor);
    const regeneration = actor.specialStates.get('regeneration');
    if (regeneration) {
      const regenRatio = regeneration.params?.maxHpRatio
        ?? (Number(regeneration.maxHpPctPerTurn || 0) / 100)
        ?? 0.05;
      applyHealing(actor, actor.maxHp * Number(regenRatio || 0.05), actor);
    }
  }
}

function fieldTagsForEncounter(encounter) {
  const tags = new Set();
  const text = `${encounter?.region ?? ''} ${encounter?.route ?? ''} ${encounter?.name ?? ''}`;
  if (/川|河|水|港|海/.test(text)) tags.add('waterSide');
  if (/森|樹/.test(text)) tags.add('forest');
  if (/洞窟|坑道/.test(text)) tags.add('cave');
  return tags;
}

function initializeState(data, options, rng) {
  const builds = options.players ?? (options.playerBuild ? [options.playerBuild] : []);
  if (!builds.length) throw new Error('simulateBattle requires playerBuild or players');
  let encounter = null;
  let monsterIds = options.monsterIds;
  if (!monsterIds) {
    encounter = typeof options.encounterId === 'string' ? data.encounterById.get(options.encounterId) : options.encounter;
    if (!encounter) throw new Error(`Unknown encounter: ${options.encounterId}`);
    monsterIds = expandEncounter(data, encounter, rng);
  }
  if (!monsterIds.length) throw new Error('Encounter expanded to zero monsters');
  const serials = new Map();
  const enemies = monsterIds.map((id) => {
    const monster = data.monsterById.get(id);
    if (!monster) throw new Error(`Unknown monster: ${id}`);
    const serial = (serials.get(id) ?? 0) + 1;
    serials.set(id, serial);
    return createMonsterActor(monster, serial);
  });
  return {
    turn: 0,
    players: builds.map((build, index) => createPlayerActor(build, index + 1)),
    enemies,
    encounter,
    monsterIds,
    fieldTags: new Set(options.fieldTags ?? fieldTagsForEncounter(encounter)),
    fieldEffects: new Map(),
    world: options.world ?? {},
    history: { playerLastSkillRepeatable: false },
  };
}

function playbackStatuses(actor) {
  return [
    ...[...actor.modifiers].map(([id, entry]) => `modifier:${id}:${Number(entry?.stage ?? 0)}`),
    ...[...actor.debuffs.keys()].map((id) => `debuff:${id}`),
    ...[...actor.specialStates.keys()].map((id) => `state:${id}`),
  ].sort();
}

function playbackSnapshot(state) {
  return [...state.players, ...state.enemies].map((actor) => ({
    instanceId: actor.instanceId,
    id: actor.id,
    name: actor.name,
    side: actor.side,
    hp: actor.hp,
    maxHp: actor.maxHp,
    mp: actor.mp,
    maxMp: actor.maxMp,
    alive: actor.alive,
    statuses: playbackStatuses(actor),
  }));
}

function playbackEffects(before, after) {
  const beforeById = new Map(before.map((actor) => [actor.instanceId, actor]));
  return after.flatMap((actor) => {
    const previous = beforeById.get(actor.instanceId);
    if (!previous) return [];
    const statusesChanged = previous.statuses.length !== actor.statuses.length
      || previous.statuses.some((status, index) => status !== actor.statuses[index]);
    if (previous.hp === actor.hp
      && previous.mp === actor.mp
      && previous.alive === actor.alive
      && !statusesChanged) return [];
    return [{
      targetInstanceId: actor.instanceId,
      hpBefore: previous.hp,
      hpAfter: actor.hp,
      mpBefore: previous.mp,
      mpAfter: actor.mp,
      aliveBefore: previous.alive,
      aliveAfter: actor.alive,
      ...(statusesChanged ? {
        statusesBefore: previous.statuses,
        statusesAfter: actor.statuses,
      } : {}),
    }];
  });
}

function playbackAction(action) {
  if (action.type === 'normal') {
    return { kind: 'attack', actionId: '__normal__', skillId: null, name: 'こうげき' };
  }
  return {
    kind: 'skill',
    actionId: action.type === 'monsterSkill' ? action.action?.id ?? action.skill.id : action.skill.id,
    skillId: action.skill.id,
    name: action.skill.name ?? action.skill.id,
  };
}

export function simulateBattle(options) {
  const { data } = options;
  if (!data) throw new Error('simulateBattle requires data');
  const rng = options.rng ?? createSeededRng(options.seed ?? 'battle');
  const diagnostics = new DiagnosticBag();
  const state = initializeState(data, options, rng);
  const actionUsage = new Map();
  const maxTurns = Number(options.maxTurns ?? 100);
  let winner = 'draw';
  let fallbackAttacks = 0;
  let totalHits = 0;
  let totalCriticals = 0;
  const captureTimeline = options.captureTimeline === true;
  const initialCombatants = captureTimeline ? playbackSnapshot(state) : null;
  const frames = captureTimeline ? [] : null;
  let frameSequence = 0;

  const recordFrame = (frame, before, includeWhenEmpty = false) => {
    if (!captureTimeline) return;
    const effects = playbackEffects(before, playbackSnapshot(state));
    if (!includeWhenEmpty && effects.length === 0) return;
    frames.push({ seq: ++frameSequence, round: state.turn, ...frame, effects });
  };

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    state.turn = turn;
    const beforeRoundStart = captureTimeline ? playbackSnapshot(state) : null;
    startRound(state);
    recordFrame({ phase: 'round_start', actorInstanceId: null, actorSide: null }, beforeRoundStart);
    const actors = living([...state.players, ...state.enemies])
      .map((actor) => ({ actor, tie: rng() }))
      .sort((a, b) => actorStat(b.actor, 'agility') - actorStat(a.actor, 'agility') || a.tie - b.tie)
      .map(({ actor }) => actor);
    for (const actor of actors) {
      if (!actor.alive) continue;
      if (!living(state.players).length || !living(state.enemies).length) break;
      if (failureFromDebuff(actor, rng)) {
        diagnostics.add('actionFailureFromDebuff', { actorId: actor.id, turn });
        if (captureTimeline) {
          const snapshot = playbackSnapshot(state);
          recordFrame({
            phase: 'action',
            actorInstanceId: actor.instanceId,
            actorSide: actor.side,
            action: { kind: 'status_failure', actionId: '__status_failure__', skillId: null, name: '行動できない' },
            primaryTargetInstanceId: null,
            hits: 0,
            criticals: 0,
            damage: 0,
            healing: 0,
          }, snapshot, true);
        }
        continue;
      }
      const action = actor.side === 'player'
        ? selectPlayerAction({ data, state, actor, rng, diagnostics })
        : selectEnemyAction({ data, state, actor, rng, diagnostics });
      if (action.fallback) fallbackAttacks += 1;
      const usageId = action.type === 'normal' ? '__normal__' : action.skill.id;
      actionUsage.set(usageId, (actionUsage.get(usageId) ?? 0) + 1);
      const beforeAction = captureTimeline ? playbackSnapshot(state) : null;
      const result = action.type === 'monsterSkill'
        ? executeMonsterSkill({ state, action, data, rng, diagnostics })
        : action.type === 'playerSkill'
          ? executePlayerSkill({ state, action, rng, diagnostics })
          : executeNormalAttack(action, state, rng);
      totalHits += Number(result.hits || 0);
      totalCriticals += Number(result.criticals || 0);
      recordFrame({
        phase: 'action',
        actorInstanceId: actor.instanceId,
        actorSide: actor.side,
        action: playbackAction(action),
        primaryTargetInstanceId: action.target?.instanceId ?? null,
        hits: Number(result.hits || 0),
        criticals: Number(result.criticals || 0),
        damage: Number(result.damage || 0),
        healing: Number(result.healing || 0),
      }, beforeAction, true);
    }
    const beforeRoundEnd = captureTimeline ? playbackSnapshot(state) : null;
    endRound(state);
    recordFrame({ phase: 'round_end', actorInstanceId: null, actorSide: null }, beforeRoundEnd);
    if (!living(state.enemies).length) { winner = 'players'; break; }
    if (!living(state.players).length) { winner = 'enemies'; break; }
  }

  const diagnosticSnapshot = diagnostics.snapshot();
  return {
    seed: options.seed ?? 'battle',
    winner,
    turns: state.turn,
    encounterId: state.encounter?.id ?? null,
    monsterIds: state.monsterIds,
    players: state.players.map((actor) => ({
      id: actor.id, hp: actor.hp, maxHp: actor.maxHp, mp: actor.mp, maxMp: actor.maxMp,
      alive: actor.alive, mpSpent: actor.mpSpent, damageDealt: actor.damageDealt,
    })),
    enemies: state.enemies.map((actor) => ({ id: actor.id, hp: actor.hp, maxHp: actor.maxHp, alive: actor.alive })),
    totalPlayerMpSpent: state.players.reduce((sum, actor) => sum + actor.mpSpent, 0),
    actionUsage: Object.fromEntries([...actionUsage].sort(([a], [b]) => a.localeCompare(b))),
    totalHits,
    totalCriticals,
    fallbackAttacks,
    candidateExhaustion: diagnosticSnapshot.counts.candidateExhaustion ?? 0,
    diagnostics: diagnosticSnapshot,
    assumptions: BATTLE_ASSUMPTIONS,
    ...(captureTimeline ? {
      timeline: {
        version: 1,
        combatants: initialCombatants,
        frames,
      },
    } : {}),
  };
}

function percentile(values, probability) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * probability)];
}

function sumObject(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) target[key] = (target[key] ?? 0) + Number(value);
}

export function runMonteCarlo(options) {
  const { data } = options;
  const builds = options.builds ?? (options.playerBuild ? [options.playerBuild] : []);
  const runs = Number(options.runs ?? 100);
  if (!builds.length) throw new Error('runMonteCarlo requires builds or playerBuild');
  return {
    runsPerBuild: runs,
    encounterId: options.encounterId ?? null,
    assumptions: BATTLE_ASSUMPTIONS,
    builds: builds.map((build) => {
      const results = [];
      for (let index = 0; index < runs; index += 1) {
        results.push(simulateBattle({
          ...options,
          builds: undefined,
          runs: undefined,
          rng: undefined,
          playerBuild: build,
          seed: `${options.seed ?? 'monte-carlo'}:${build.id}:${index}`,
        }));
      }
      const turns = results.map((result) => result.turns);
      const wins = results.filter((result) => result.winner === 'players').length;
      const actionUsage = {};
      const diagnosticCounts = {};
      for (const result of results) {
        sumObject(actionUsage, result.actionUsage);
        sumObject(diagnosticCounts, result.diagnostics.counts);
      }
      const totalMp = results.reduce((sum, result) => sum + result.totalPlayerMpSpent, 0);
      const exhaustionBattles = results.filter((result) => result.candidateExhaustion > 0).length;
      const playerResourceExhaustionBattles = results
        .filter((result) => Number(result.diagnostics.counts.playerResourceExhaustion ?? 0) > 0).length;
      return {
        buildId: build.id,
        level: build.level,
        equipmentIds: build.equipmentIds,
        wins,
        losses: results.filter((result) => result.winner === 'enemies').length,
        draws: results.filter((result) => result.winner === 'draw').length,
        winRate: wins / runs,
        averageTurns: turns.reduce((sum, value) => sum + value, 0) / runs,
        medianTurns: percentile(turns, 0.5),
        p90Turns: percentile(turns, 0.9),
        averageMpSpent: totalMp / runs,
        averageMpRemaining: results.reduce((sum, result) => sum + result.players.reduce((s, player) => s + player.mp, 0), 0) / runs,
        actionUsage: Object.fromEntries(Object.entries(actionUsage).map(([id, count]) => [id, count / runs])),
        candidateExhaustionBattles: exhaustionBattles,
        candidateExhaustionBattleRate: exhaustionBattles / runs,
        candidateExhaustionEvents: diagnosticCounts.candidateExhaustion ?? 0,
        playerResourceExhaustionBattles,
        playerResourceExhaustionBattleRate: playerResourceExhaustionBattles / runs,
        playerResourceExhaustionEvents: diagnosticCounts.playerResourceExhaustion ?? 0,
        fallbackAttacks: results.reduce((sum, result) => sum + result.fallbackAttacks, 0),
        diagnostics: diagnosticCounts,
      };
    }),
  };
}

export function createDefaultBuilds(data) {
  return [
    createPlayerBuild(data, {
      id: 'physical-lv1', name: 'Lv1 physical', level: 1,
      equipmentIds: ['EQP-W-0001', 'EQP-A-0001'],
      skillIds: ['SKL-0001', 'SKL-0008'],
    }),
    createPlayerBuild(data, {
      id: 'physical-lv5', name: 'Lv5 sword and shield', level: 5,
      equipmentIds: ['EQP-W-0011', 'EQP-S-0002', 'EQP-A-0002'],
      skillIds: ['SKL-0001', 'SKL-0002', 'SKL-0003', 'SKL-0009', 'SKL-0011', 'SKL-0014'],
    }),
    createPlayerBuild(data, {
      id: 'magic-lv5', name: 'Lv5 staff mage', level: 5,
      equipmentIds: ['EQP-W-0073', 'EQP-A-0002'],
      skillIds: ['SKL-0092', 'SKL-0093', 'SKL-0094', 'SKL-0097', 'SKL-0117'],
    }),
    createPlayerBuild(data, {
      id: 'physical-lv10', name: 'Lv10 two handed', level: 10,
      equipmentIds: ['EQP-W-0013', 'EQP-A-0003'],
      skillIds: ['SKL-0001', 'SKL-0003', 'SKL-0004', 'SKL-0005', 'SKL-0035', 'SKL-0036', 'SKL-0037'],
    }),
    createPlayerBuild(data, {
      id: 'magic-lv10', name: 'Lv10 grimoire mage', level: 10,
      equipmentIds: ['EQP-W-0019', 'EQP-A-0003'],
      skillIds: ['SKL-0092', 'SKL-0094', 'SKL-0100', 'SKL-0102', 'SKL-0103', 'SKL-0117', 'SKL-0120'],
    }),
  ];
}
