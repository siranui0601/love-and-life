const PROVISIONAL = 'provisionalRule';

export const GENERIC_RUNTIME_EXECUTED_FAMILIES = new Set([
  'ALLOW_HP_FOR_MP', 'ANALYZE_HISTORY', 'COMBAT_LOCAL_WEATHER', 'CONSUME_DURABILITY', 'CONSUME_ITEM',
  'COUNTER', 'DUPLICATE_NEXT_ACTION', 'HISTORY_CONDITION', 'HISTORY_SCALING', 'ITEM_OR_EQUIPMENT_COST',
  'LUCK_SCALING', 'MODIFY_FIELD', 'NEXT_ACTION_BONUS', 'RANDOM_EFFECT_TABLE', 'REFLECT', 'REROLL',
  'RESOURCE_SPEND_SCALING', 'SELF_DAMAGE', 'SUBSTITUTE', 'SUMMON', 'TEMP_DISABLE_EQUIPMENT', 'TEMP_RESOURCE', 'TRAP',
]);

function mechanicEntry(skill, family) {
  return (skill?.runtimeMechanics ?? []).find((entry) => entry?.family === family) ?? null;
}
function hasFamily(skill, family) { return Boolean(mechanicEntry(skill, family)); }
function semanticRank(skill, family = null) {
  const entries = family ? [mechanicEntry(skill, family)].filter(Boolean) : (skill?.runtimeMechanics ?? []);
  for (const entry of entries) {
    const rank = Number(entry?.rank ?? entry?.semantics?.rank ?? 0);
    if (rank > 0) return rank;
  }
  return Math.max(1, Number(skill?.rank ?? 1) || 1);
}
function stableUnit(text) {
  let hash = 0x811c9dc5;
  for (const char of String(text)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0) / 4294967296;
}
function damageMultiplier(skill) { return Number(skill?.damage?.totalMultiplier ?? skill?.damage?.perHitMultiplier ?? 0) || 0; }
function withMultiplier(skill, multiplier) {
  if (!(multiplier > 0)) return skill;
  const hits = Math.max(1, Number(skill.damage?.hits ?? 1) || 1);
  return { ...skill, damage: { ...skill.damage, formula: 'fixedMultiplier', perHitMultiplier: multiplier / hits, hits, totalMultiplier: multiplier } };
}
function stripHandledSpecialStates(skill) {
  const handlesProvisional = (skill.runtimeMechanics ?? []).some((entry) => entry?.source === 'structuredRegistry');
  const handledTypes = new Set(['allowHpForMissingMp', 'summonUnit', 'fieldModifier']);
  const next = (skill.specialStates ?? []).filter((state) => !(handlesProvisional && state?.type === PROVISIONAL) && !handledTypes.has(state?.type));
  let nextSkill = next.length === (skill.specialStates ?? []).length ? skill : { ...skill, specialStates: next };
  if (skill.costs?.itemOrEquipment && (hasFamily(skill, 'ITEM_OR_EQUIPMENT_COST') || hasFamily(skill, 'CONSUME_ITEM') || hasFamily(skill, 'CONSUME_DURABILITY'))) {
    nextSkill = { ...nextSkill, costs: { ...nextSkill.costs, itemOrEquipment: null } };
  }
  return nextSkill;
}

export function ensureGenericRuntime(runtime) {
  runtime.actionHistory ??= [];
  runtime.nextAction ??= null;
  runtime.substitutes ??= [];
  runtime.summons ??= [];
  runtime.traps ??= [];
  runtime.familyStates ??= [];
  runtime.equipmentRuntime ??= { durabilitySpent: {}, disabledEquipmentIds: [], consumedCosts: [] };
  runtime.temporaryResources ??= {};
  runtime.postBattleEffects ??= [];
  runtime.weather ??= null;
  runtime.genericEvents ??= [];
  return runtime;
}

function reactionStateFromSkill(skill, type) {
  const authored = (skill.specialStates ?? []).find((state) => state?.type === type);
  if (authored) return { ...authored };
  if (!hasFamily(skill, type === 'counter' ? 'COUNTER' : 'REFLECT')) return null;
  const rank = semanticRank(skill, type === 'counter' ? 'COUNTER' : 'REFLECT');
  return type === 'counter'
    ? { type: 'counter', charges: 999, powerMultiplier: 1 + rank * 0.1 }
    : { type: 'reflect', charges: 999, powerPct: Math.min(100, 50 + rank * 10) };
}

export function initializeGenericBattleRuntime({ data, session }) {
  const runtime = ensureGenericRuntime(session.playerRuntimeMechanics);
  const actor = session.state?.players?.[0];
  if (!actor) return runtime;
  for (const skillId of actor.skillIds ?? []) {
    const skill = data.playerSkillById.get(skillId);
    if (!skill || !['passive', 'reaction'].includes(skill.kind)) continue;
    for (const type of ['counter', 'reflect']) {
      const state = reactionStateFromSkill(skill, type);
      if (!state) continue;
      actor.specialStates.set(type, {
        duration: 999,
        params: { ...state },
        ...state,
        charges: Number(state.charges ?? 999),
        sourceSkillId: skill.id,
      });
    }
    runtime.familyStates.push({ sourceSkillId: skill.id, kind: skill.kind, families: (skill.runtimeMechanics ?? []).map((entry) => entry.family), active: true });
  }
  return runtime;
}

export function prepareGenericSkill({ skill, session }) {
  if (!skill) return { skill, blockedReason: null, metadata: {} };
  const runtime = ensureGenericRuntime(session.playerRuntimeMechanics);
  const actor = session.state?.players?.[0];
  let prepared = stripHandledSpecialStates(skill);
  const metadata = {};

  const mpBridge = (skill.specialStates ?? []).find((state) => state?.type === 'allowHpForMissingMp');
  if (mpBridge && actor) {
    const requiredMp = Number(skill.costs?.mp ?? 0);
    const missingMp = Math.max(0, requiredMp - Number(actor.mp ?? 0));
    if (missingMp > 0) {
      const hpPerMissingMp = Math.max(0, Number(mpBridge.hpPerMissingMp ?? 1));
      const hpSubstituteCost = missingMp * hpPerMissingMp;
      if (Number(actor.hp ?? 0) <= hpSubstituteCost) return { skill: prepared, blockedReason: 'insufficient_hp_for_mp', metadata: { missingMp, hpSubstituteCost } };
      prepared = { ...prepared, costs: { ...prepared.costs, mp: Number(actor.mp ?? 0), mpMode: 'fixed', hp: Number(prepared.costs?.hp ?? 0) + hpSubstituteCost, hpMode: 'fixed' } };
      metadata.mpBridge = { missingMp, hpSubstituteCost, hpPerMissingMp, afterUseMaxMpDebuffStage: Number(mpBridge.afterUseMaxMpDebuffStage ?? 0), debuffDurationHours: Number(mpBridge.debuffDurationHours ?? 0) };
    }
  }

  if (actor && hasFamily(skill, 'RESOURCE_SPEND_SCALING') && !(damageMultiplier(prepared) > 0)) {
    const mode = String(skill.damage?.formula ?? '');
    const hpRatio = Number(actor.maxHp ?? 0) > 0 ? Number(actor.hp ?? 0) / Number(actor.maxHp) : 0;
    const mpRatio = Number(actor.maxMp ?? 0) > 0 ? Number(actor.mp ?? 0) / Number(actor.maxMp) : 0;
    const resourceRatio = mode === 'missingHpScaling' ? 1 - hpRatio : mode === 'currentMpScaling' ? mpRatio : hpRatio;
    const multiplier = 0.5 + 2 * Math.max(0, Math.min(1, resourceRatio));
    prepared = withMultiplier(prepared, multiplier);
    metadata.resourceScaling = { mode, resourceRatio, multiplier };
  }
  if (actor && hasFamily(skill, 'LUCK_SCALING') && !(damageMultiplier(prepared) > 0)) {
    const rank = semanticRank(skill, 'LUCK_SCALING');
    const normalizedLuck = Math.max(-50, Math.min(150, Number(actor.luck ?? 0))) / 100;
    const roll = stableUnit(`${session.seed}:${session.state?.turn ?? 0}:${skill.id}:luck`);
    const spread = 0.55 + roll * 1.1;
    const multiplier = Math.max(0.25, (0.65 + rank * 0.2 + normalizedLuck * 0.5) * spread);
    prepared = withMultiplier(prepared, multiplier);
    metadata.luckScaling = { rank, luck: Number(actor.luck ?? 0), roll, multiplier };
  }
  if (hasFamily(skill, 'HISTORY_SCALING')) {
    const previous = runtime.actionHistory.filter((entry) => entry.skillId === skill.id).length;
    const current = damageMultiplier(prepared);
    if (current > 0 && previous > 0) {
      const scale = 1 + Math.min(0.5, previous * 0.08);
      prepared = withMultiplier(prepared, current * scale);
      metadata.historyScaling = { previousUses: previous, scale };
    }
  }
  if (runtime.weather) {
    const text = `${skill.category ?? ''} ${skill.name ?? ''}`;
    let scale = 1;
    if (runtime.weather.type === 'rain') { if (/水/u.test(text)) scale *= 1.15; if (/炎|火/u.test(text)) scale *= 0.85; }
    else if (runtime.weather.type === 'wind' && /風/u.test(text)) scale *= 1.15;
    else if (runtime.weather.type === 'thunder' && /雷/u.test(text)) scale *= 1.15;
    else if (runtime.weather.type === 'night') { if (/闇/u.test(text)) scale *= 1.15; if (/光/u.test(text)) scale *= 0.9; }
    if (runtime.weather.type === 'fog') prepared = { ...prepared, damage: { ...prepared.damage, accuracyModifier: Number(prepared.damage?.accuracyModifier ?? 0) - 10 } };
    if (scale !== 1 && damageMultiplier(prepared) > 0) prepared = withMultiplier(prepared, damageMultiplier(prepared) * scale);
    if (scale !== 1 || runtime.weather.type === 'fog') metadata.weather = { type: runtime.weather.type, scale };
  }
  if (runtime.nextAction && runtime.nextAction.sourceSkillId !== skill.id) {
    const current = damageMultiplier(prepared);
    if (current > 0) prepared = withMultiplier(prepared, current * Number(runtime.nextAction.damageScale ?? 1));
    if (Number(runtime.nextAction.mpScale ?? 1) !== 1 && prepared.costs?.mpMode === 'fixed') {
      prepared = { ...prepared, costs: { ...prepared.costs, mp: Math.max(0, Math.floor(Number(prepared.costs?.mp ?? 0) * Number(runtime.nextAction.mpScale))) } };
    }
    metadata.consumeNextAction = { ...runtime.nextAction };
  }
  return { skill: prepared, blockedReason: null, metadata };
}

export function genericWeatherOptions(skill) {
  const mechanic = mechanicEntry(skill, 'COMBAT_LOCAL_WEATHER');
  if (!mechanic) return [];
  const options = mechanic.semantics?.weatherOptions ?? mechanic.weatherOptions ?? [];
  if (Array.isArray(options) && options.length) return [...new Set(options.map(String))];
  if (/夜/u.test(`${skill.name ?? ''} ${skill.description ?? ''}`)) return ['night'];
  return ['clear', 'rain', 'fog', 'wind', 'thunder'];
}

export function genericSpecificUnavailableReason({ skill, session, baseReason }) {
  if (!skill || !session) return baseReason;
  const actor = session.state?.players?.[0];
  if (!actor) return baseReason;
  const prepared = prepareGenericSkill({ skill, session });
  if (prepared.blockedReason) return prepared.blockedReason;
  if (baseReason === 'insufficient_resource') {
    const mp = Number(skill.costs?.mp ?? 0);
    if (skill.costs?.mpMode !== 'all_current' && Number(actor.mp ?? 0) < mp && !hasFamily(skill, 'ALLOW_HP_FOR_MP')) return 'insufficient_mp';
    const hp = Number(skill.costs?.hp ?? 0);
    if (skill.costs?.hpMode === 'fixed' && Number(actor.hp ?? 0) <= hp) return 'insufficient_hp';
  }
  if (baseReason === 'conditions_not_met') {
    const weaponLeaves = (skill.activationConditions ?? []).filter((condition) => condition?.scope === 'equipment' && condition?.path === 'activeWeaponTypes');
    if (weaponLeaves.length) {
      const expected = weaponLeaves.flatMap((condition) => Array.isArray(condition.value) ? condition.value : [condition.value]).filter(Boolean);
      if (expected.includes('shield')) return 'shield_required';
      return 'weapon_requirement';
    }
  }
  return baseReason;
}

export function applyGenericSkillSuccess({ originalSkill, preparedMetadata, session, frame, parsedAction = {} }) {
  if (!originalSkill || !frame) return [];
  const runtime = ensureGenericRuntime(session.playerRuntimeMechanics);
  const actor = session.state?.players?.[0];
  const turn = Number(session.state?.turn ?? 0);
  const events = [];
  const emit = (family, detail = {}) => {
    const event = { type: 'player_runtime_mechanic', family, skillId: originalSkill.id, ...detail };
    events.push(event);
    runtime.genericEvents.push({ turn, ...event });
  };

  if (preparedMetadata?.mpBridge) {
    runtime.postBattleEffects.push({ type: 'max_mp_stage', sourceSkillId: originalSkill.id, stage: preparedMetadata.mpBridge.afterUseMaxMpDebuffStage, durationHours: preparedMetadata.mpBridge.debuffDurationHours });
    emit('ALLOW_HP_FOR_MP', preparedMetadata.mpBridge);
  }
  if (preparedMetadata?.resourceScaling) emit('RESOURCE_SPEND_SCALING', preparedMetadata.resourceScaling);
  if (preparedMetadata?.luckScaling) emit('LUCK_SCALING', preparedMetadata.luckScaling);
  if (preparedMetadata?.historyScaling) emit('HISTORY_SCALING', preparedMetadata.historyScaling);
  if (preparedMetadata?.weather) emit('COMBAT_LOCAL_WEATHER', { appliedWeather: preparedMetadata.weather.type, damageScale: preparedMetadata.weather.scale });
  if (preparedMetadata?.consumeNextAction) {
    emit('NEXT_ACTION_BONUS', { consumedFromSkillId: preparedMetadata.consumeNextAction.sourceSkillId, damageScale: preparedMetadata.consumeNextAction.damageScale, mpScale: preparedMetadata.consumeNextAction.mpScale });
    runtime.nextAction = null;
  }

  const substitute = mechanicEntry(originalSkill, 'SUBSTITUTE');
  if (substitute) {
    const durationTurns = Math.max(1, Number(substitute.durationTurns ?? substitute.semantics?.durationTurns ?? 3));
    runtime.substitutes.push({ sourceSkillId: originalSkill.id, charges: 1, createdSeq: frame.seq, expiresAfterTurn: turn + durationTurns - 1, rank: semanticRank(originalSkill, 'SUBSTITUTE') });
    emit('SUBSTITUTE', { charges: 1, durationTurns });
  }
  const summonState = (originalSkill.specialStates ?? []).find((state) => state?.type === 'summonUnit');
  if (hasFamily(originalSkill, 'SUMMON') || summonState) {
    const rank = semanticRank(originalSkill, 'SUMMON');
    const powerScale = Number(summonState?.powerScale ?? Math.min(1, 0.35 + rank * 0.12));
    const durationTurns = Math.max(1, Number(summonState?.durationTurns ?? 3));
    const maxHp = Math.max(1, Math.round(Number(actor?.maxHp ?? 1) * Math.max(0.08, 0.18 * powerScale)));
    const summon = { instanceId: `PSUM-${originalSkill.id}-${turn}-${runtime.summons.length + 1}`, sourceSkillId: originalSkill.id, role: summonState?.role ?? 'as_described', powerScale, maxHp, hp: maxHp, createdSeq: frame.seq, expiresAfterTurn: turn + durationTurns - 1 };
    runtime.summons.push(summon);
    emit('SUMMON', { summon: { ...summon } });
  }
  const weatherOptions = genericWeatherOptions(originalSkill);
  if (weatherOptions.length) {
    const weatherType = parsedAction.weather ?? weatherOptions[0];
    if (weatherOptions.includes(weatherType)) {
      const durationTurns = Math.max(1, Number(mechanicEntry(originalSkill, 'COMBAT_LOCAL_WEATHER')?.durationTurns ?? mechanicEntry(originalSkill, 'COMBAT_LOCAL_WEATHER')?.semantics?.durationTurns ?? 3));
      runtime.weather = { type: weatherType, sourceSkillId: originalSkill.id, battleLocalOnly: true, worldWeatherMutation: false, expiresAfterTurn: turn + durationTurns - 1 };
      emit('COMBAT_LOCAL_WEATHER', { weather: { ...runtime.weather } });
    }
  }
  const fieldState = (originalSkill.specialStates ?? []).find((state) => state?.type === 'fieldModifier');
  if (fieldState && !hasFamily(originalSkill, 'CREATE_OWNED_FIELD')) {
    const durationTurns = Math.max(1, Number(fieldState.durationTurns ?? 3));
    const field = { instanceId: `PGENFIELD-${originalSkill.id}-${turn}-${runtime.fields.length + 1}`, owner: 'player', kind: 'field_effect', type: fieldState.field ?? fieldState.element ?? originalSkill.id, sourceSkillId: originalSkill.id, params: { ...fieldState }, expiresAfterTurn: turn + durationTurns - 1 };
    runtime.fields.push(field);
    emit('MODIFY_FIELD', { field: { ...field } });
  }
  if (hasFamily(originalSkill, 'TRAP')) {
    const trap = { instanceId: `PTRAP-${originalSkill.id}-${turn}-${runtime.traps.length + 1}`, sourceSkillId: originalSkill.id, charges: 1, rank: semanticRank(originalSkill, 'TRAP'), expiresAfterTurn: turn + 3 };
    runtime.traps.push(trap);
    emit('TRAP', { trap: { ...trap } });
  }
  if (hasFamily(originalSkill, 'NEXT_ACTION_BONUS') || hasFamily(originalSkill, 'DUPLICATE_NEXT_ACTION')) {
    const family = hasFamily(originalSkill, 'NEXT_ACTION_BONUS') ? 'NEXT_ACTION_BONUS' : 'DUPLICATE_NEXT_ACTION';
    const rank = semanticRank(originalSkill, family);
    runtime.nextAction = { sourceSkillId: originalSkill.id, damageScale: 1 + rank * 0.1, mpScale: Math.max(0.5, 1 - rank * 0.08), duplicate: family === 'DUPLICATE_NEXT_ACTION', armedTurn: turn };
    emit(family, { armed: { ...runtime.nextAction } });
  }
  if (hasFamily(originalSkill, 'SELF_DAMAGE') && actor?.alive) {
    const amount = Math.max(1, Math.round(Number(actor.maxHp ?? 1) * Math.min(0.3, 0.04 * semanticRank(originalSkill, 'SELF_DAMAGE'))));
    actor.hp = Math.max(1, Number(actor.hp ?? 1) - amount);
    emit('SELF_DAMAGE', { amount, hpAfter: actor.hp });
  }
  if (hasFamily(originalSkill, 'RANDOM_EFFECT_TABLE') || hasFamily(originalSkill, 'REROLL')) {
    const roll = stableUnit(`${session.seed}:${turn}:${originalSkill.id}:table`);
    const outcome = roll < 1 / 3 ? 'recover_mp' : roll < 2 / 3 ? 'recover_hp' : 'next_action_power';
    if (outcome === 'recover_mp' && actor) actor.mp = Math.min(actor.maxMp, actor.mp + Math.max(1, Math.round(actor.maxMp * 0.1)));
    if (outcome === 'recover_hp' && actor) actor.hp = Math.min(actor.maxHp, actor.hp + Math.max(1, Math.round(actor.maxHp * 0.1)));
    if (outcome === 'next_action_power') runtime.nextAction = { sourceSkillId: originalSkill.id, damageScale: 1.25, mpScale: 1, duplicate: false, armedTurn: turn };
    emit(hasFamily(originalSkill, 'REROLL') ? 'REROLL' : 'RANDOM_EFFECT_TABLE', { roll, outcome });
  }
  if (hasFamily(originalSkill, 'CONSUME_DURABILITY') || hasFamily(originalSkill, 'ITEM_OR_EQUIPMENT_COST') || hasFamily(originalSkill, 'CONSUME_ITEM')) {
    const key = originalSkill.costs?.itemOrEquipment ?? 'equipped_source';
    runtime.equipmentRuntime.consumedCosts.push({ sourceSkillId: originalSkill.id, cost: key, turn });
    runtime.equipmentRuntime.durabilitySpent[key] = Number(runtime.equipmentRuntime.durabilitySpent[key] ?? 0) + 1;
    emit(hasFamily(originalSkill, 'CONSUME_DURABILITY') ? 'CONSUME_DURABILITY' : hasFamily(originalSkill, 'CONSUME_ITEM') ? 'CONSUME_ITEM' : 'ITEM_OR_EQUIPMENT_COST', { cost: key, spent: 1 });
  }
  if (hasFamily(originalSkill, 'TEMP_DISABLE_EQUIPMENT')) {
    const marker = originalSkill.costs?.itemOrEquipment ?? 'equipped_source';
    if (!runtime.equipmentRuntime.disabledEquipmentIds.includes(marker)) runtime.equipmentRuntime.disabledEquipmentIds.push(marker);
    emit('TEMP_DISABLE_EQUIPMENT', { equipment: marker, restoreAfterBattle: true });
  }
  if (hasFamily(originalSkill, 'TEMP_RESOURCE')) {
    const amount = semanticRank(originalSkill, 'TEMP_RESOURCE');
    runtime.temporaryResources[originalSkill.id] = Number(runtime.temporaryResources[originalSkill.id] ?? 0) + amount;
    emit('TEMP_RESOURCE', { amount, total: runtime.temporaryResources[originalSkill.id] });
  }
  if (hasFamily(originalSkill, 'ANALYZE_HISTORY') || hasFamily(originalSkill, 'HISTORY_CONDITION')) emit(hasFamily(originalSkill, 'ANALYZE_HISTORY') ? 'ANALYZE_HISTORY' : 'HISTORY_CONDITION', { previousAction: runtime.actionHistory.at(-1) ?? null });
  runtime.actionHistory.push({ skillId: originalSkill.id, turn, targetInstanceId: frame.primaryTargetInstanceId ?? null, damage: Number(frame.damage ?? 0), hits: Number(frame.hits ?? 0) });
  if (runtime.actionHistory.length > 32) runtime.actionHistory.splice(0, runtime.actionHistory.length - 32);
  return events;
}

function addEventToFrame(frame, event) { frame.events = [...(frame.events ?? []), event]; }
function restorePlayerAfterIntercept(session, frame, effect, amount) {
  const player = session.state.players.find((entry) => entry.instanceId === effect.targetInstanceId);
  if (!player || amount <= 0) return 0;
  const restored = Math.min(amount, Math.max(0, Number(effect.hpBefore ?? player.maxHp) - Number(player.hp ?? 0)));
  player.hp = Math.min(player.maxHp, Number(player.hp ?? 0) + restored);
  if (player.hp > 0) player.alive = true;
  effect.hpAfter = Math.min(Number(effect.hpBefore ?? player.hp), Number(effect.hpAfter ?? 0) + restored);
  frame.damage = Math.max(0, Number(frame.damage ?? 0) - restored);
  const enemy = session.state.enemies.find((entry) => entry.instanceId === frame.actorInstanceId);
  if (enemy) enemy.damageDealt = Math.max(0, Number(enemy.damageDealt ?? 0) - restored);
  return restored;
}

export function applyGenericRoundProtection({ session, round }) {
  const runtime = ensureGenericRuntime(session.playerRuntimeMechanics);
  const turn = Number(session.state?.turn ?? 0);
  runtime.substitutes = runtime.substitutes.filter((entry) => Number(entry.expiresAfterTurn ?? turn) >= turn && Number(entry.charges ?? 0) > 0);
  runtime.summons = runtime.summons.filter((entry) => Number(entry.expiresAfterTurn ?? turn) >= turn && Number(entry.hp ?? 0) > 0);
  runtime.traps = runtime.traps.filter((entry) => Number(entry.expiresAfterTurn ?? turn) >= turn && Number(entry.charges ?? 0) > 0);
  if (runtime.weather && Number(runtime.weather.expiresAfterTurn ?? turn) < turn) runtime.weather = null;
  for (const frame of round?.frames ?? []) {
    if (frame.actorSide !== 'enemy' || frame.phase !== 'action') continue;
    const playerEffect = (frame.effects ?? []).find((effect) => effect.hpBefore > effect.hpAfter && session.state.players.some((player) => player.instanceId === effect.targetInstanceId));
    if (!playerEffect) continue;
    const incoming = Number(playerEffect.hpBefore) - Number(playerEffect.hpAfter);
    if (incoming <= 0) continue;
    const substitute = runtime.substitutes.find((entry) => Number(entry.createdSeq ?? 0) < Number(frame.seq ?? Infinity));
    if (substitute) {
      const restored = restorePlayerAfterIntercept(session, frame, playerEffect, incoming);
      substitute.charges -= 1;
      const event = { type: 'player_runtime_mechanic', family: 'SUBSTITUTE', sourceSkillId: substitute.sourceSkillId, interceptedDamage: restored, consumed: true };
      addEventToFrame(frame, event); runtime.genericEvents.push({ turn, ...event });
      continue;
    }
    const summon = runtime.summons.find((entry) => Number(entry.createdSeq ?? 0) < Number(frame.seq ?? Infinity));
    if (summon) {
      const absorbed = Math.min(incoming, Number(summon.hp ?? 0));
      const restored = restorePlayerAfterIntercept(session, frame, playerEffect, absorbed);
      summon.hp = Math.max(0, Number(summon.hp ?? 0) - restored);
      const event = { type: 'player_runtime_mechanic', family: 'SUMMON', sourceSkillId: summon.sourceSkillId, summonInstanceId: summon.instanceId, absorbedDamage: restored, summonHpAfter: summon.hp };
      addEventToFrame(frame, event); runtime.genericEvents.push({ turn, ...event });
    }
  }
  runtime.substitutes = runtime.substitutes.filter((entry) => entry.charges > 0);
  runtime.summons = runtime.summons.filter((entry) => entry.hp > 0);
  const alivePlayer = session.state.players.some((player) => player.alive && player.hp > 0);
  const aliveEnemy = session.state.enemies.some((enemy) => enemy.alive && enemy.hp > 0 && !enemy.escaped);
  if (alivePlayer && aliveEnemy && session.winner === 'enemies') { session.winner = null; session.status = 'active'; }
  return runtime.genericEvents;
}
