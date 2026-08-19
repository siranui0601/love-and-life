import * as base from './battle-simulator-base.mjs';
import { BATTLE_ASSUMPTIONS } from './battle-model.mjs';

export * from './battle-simulator-base.mjs';

const PLAYER_RUNTIME_VERSION = 1;
const REPEAT_LAST_SKILL = 'REPEAT_LAST_SKILL';
const REPEAT_WHILE_HIT = 'REPEAT_WHILE_HIT';
const CREATE_OWNED_FIELD = 'CREATE_OWNED_FIELD';
const CONSUME_OWNED_FIELD = 'CONSUME_OWNED_FIELD';
const GOLD_SPEND_SCALING = 'GOLD_SPEND_SCALING';
const REPEAT_WHILE_HIT_CHANCE_PCT = 30;
const REPEAT_WHILE_HIT_MAX_HITS = 20;

function mechanicRuntime(session, options = {}) {
  return session?.playerRuntimeMechanics ?? {
    version: PLAYER_RUNTIME_VERSION,
    gold: Math.max(0, Number(options.playerGold ?? options.gold ?? options.playerBuild?.gold ?? 0) || 0),
    history: { lastRepeatable: null },
    fields: [],
    weather: null,
    events: [],
  };
}

function withMechanicRuntime(session, options = {}) {
  if (session?.playerRuntimeMechanics) return session;
  return { ...session, playerRuntimeMechanics: mechanicRuntime(session, options) };
}

function mechanicEntry(skill, family) {
  return (skill?.runtimeMechanics ?? []).find((entry) => entry?.family === family) ?? null;
}

function mechanicFamily(skill, family) {
  return Boolean(mechanicEntry(skill, family));
}

function tagSet(skill) {
  if (skill?.tags instanceof Set) return skill.tags;
  if (Array.isArray(skill?.tags)) return new Set(skill.tags);
  return new Set();
}

function repeatableActiveSkill(skill) {
  if (!skill || skill.kind !== 'active') return false;
  if (skill.id === 'SKL-1139' || mechanicFamily(skill, REPEAT_LAST_SKILL)) return false;
  if (skill.costs?.hpMode === 'set_zero' || skill.costs?.hp === 'all_current') return false;
  if (skill.costs?.itemOrEquipment || skill.costs?.money === 'variable' || Number(skill.costs?.money ?? 0) > 0) return false;
  const tags = tagSet(skill);
  if (tags.has('uncopyable') || tags.has('unrepeatable') || tags.has('no_repeat')) return false;
  return !/自己犠牲|装備破壊/u.test(`${skill.originalCategory ?? ''} ${skill.category ?? ''} ${skill.description ?? ''}`);
}

function repeatSource(data, session) {
  const history = mechanicRuntime(session).history?.lastRepeatable;
  if (!history?.skillId) return null;
  const skill = data.playerSkillById.get(history.skillId);
  return repeatableActiveSkill(skill) ? { history, skill } : null;
}

function repeatEnvelope(repeater, source) {
  return {
    ...repeater,
    category: source.category,
    originalCategory: source.originalCategory,
    target: source.target,
    damage: structuredClone(source.damage),
    buffs: structuredClone(source.buffs),
    debuffs: structuredClone(source.debuffs),
    specialStates: structuredClone(source.specialStates),
    repeatSourceSkillId: source.id,
  };
}

function liveActorByInstanceId(session, instanceId) {
  return [...(session?.state?.players ?? []), ...(session?.state?.enemies ?? [])]
    .find((actor) => actor?.instanceId === instanceId && actor.alive && Number(actor.hp ?? 0) > 0) ?? null;
}

function repeatWhileHitEnvelope(skill, session, targetInstanceId = null) {
  const mechanic = mechanicEntry(skill, REPEAT_WHILE_HIT);
  if (!mechanic || skill.damage?.formula !== 'repeatWhileHit') return skill;
  const actor = (session?.state?.players ?? []).find((entry) => entry.alive && Number(entry.hp ?? 0) > 0) ?? null;
  const target = liveActorByInstanceId(session, targetInstanceId)
    ?? (session?.state?.enemies ?? []).find((entry) => entry.alive && Number(entry.hp ?? 0) > 0)
    ?? null;
  const actorAccuracy = actor ? base.actorStat(actor, 'accuracy') : 0;
  const targetEvasion = target ? base.actorStat(target, 'evasion') : 0;
  const hitChancePct = Number(mechanic.hitChancePct ?? REPEAT_WHILE_HIT_CHANCE_PCT);
  const maxHits = Math.max(1, Number(mechanic.maxHits ?? REPEAT_WHILE_HIT_MAX_HITS));
  const accuracyModifier = hitChancePct
    - Number(BATTLE_ASSUMPTIONS.baseHitChancePct ?? 90)
    - actorAccuracy
    + targetEvasion;
  const perHitMultiplier = Number(mechanic.perHitMultiplier ?? skill.damage?.perHitMultiplier ?? 0);
  return {
    ...skill,
    damage: {
      ...skill.damage,
      totalMultiplier: perHitMultiplier,
      hits: 1,
      maxHits,
      accuracyModifier,
    },
  };
}

function activeOwnedFields(session) {
  const runtime = mechanicRuntime(session);
  const turn = Number(session?.state?.turn ?? 0);
  return (runtime.fields ?? []).filter((field) => (
    field?.owner === 'player'
      && field?.kind === 'magic_circle'
      && (field.expiresAfterTurn === null || field.expiresAfterTurn === undefined || Number(field.expiresAfterTurn) >= turn)
  ));
}

function pruneExpiredFields(session) {
  const runtime = mechanicRuntime(session);
  const activeIds = new Set(activeOwnedFields(session).map((field) => field.instanceId));
  runtime.fields = (runtime.fields ?? []).filter((field) => (
    field?.owner !== 'player' || field?.kind !== 'magic_circle' || activeIds.has(field.instanceId)
  ));
  return runtime;
}

function fieldConsumptionEnvelope(skill, session) {
  const mechanic = mechanicEntry(skill, CONSUME_OWNED_FIELD);
  if (!mechanic) return { skill, consumption: null };
  const fields = activeOwnedFields(session);
  if (!fields.length) return { skill, consumption: { mechanic, fields, types: [], scale: 1 } };
  const types = [...new Set(fields.map((field) => field.type ?? 'arcane'))].sort();
  const scale = Math.min(
    Number(mechanic.maxScale ?? 2.5),
    1
      + Math.max(0, fields.length - 1) * Number(mechanic.extraFieldScale ?? 0)
      + Math.max(0, types.length - 1) * Number(mechanic.extraTypeScale ?? 0),
  );
  const baseMultiplier = Number(skill.damage?.totalMultiplier ?? skill.damage?.perHitMultiplier ?? 0);
  const activationConditions = (skill.activationConditions ?? []).filter((condition) => !(
    condition?.scope === 'battle' && condition?.path === 'ownedFieldEffectCount'
  ));
  return {
    skill: {
      ...skill,
      activationConditions,
      damage: {
        ...skill.damage,
        perHitMultiplier: Number(skill.damage?.perHitMultiplier ?? baseMultiplier) * scale,
        totalMultiplier: baseMultiplier * scale,
      },
    },
    consumption: { mechanic, fields, types, scale, baseMultiplier },
  };
}

function goldDamageMultiplier(mechanic, spend) {
  const baseMultiplier = Number(mechanic?.baseMultiplier ?? 0.55);
  const logCoefficient = Number(mechanic?.logCoefficient ?? 0.32);
  const divisor = Math.max(1, Number(mechanic?.divisor ?? 25));
  const maxMultiplier = Number(mechanic?.maxMultiplier ?? 2.8);
  return Math.min(maxMultiplier, baseMultiplier + logCoefficient * Math.log(1 + spend / divisor));
}

function goldEnvelope(skill, spend) {
  const mechanic = mechanicEntry(skill, GOLD_SPEND_SCALING);
  if (!mechanic || !Number.isInteger(spend) || spend <= 0) return { skill, gold: null };
  const multiplier = goldDamageMultiplier(mechanic, spend);
  return {
    skill: {
      ...skill,
      costs: { ...skill.costs, money: 0 },
      damage: {
        ...skill.damage,
        formula: 'fixedMultiplier',
        perHitMultiplier: multiplier,
        hits: 1,
        totalMultiplier: multiplier,
        accuracyModifier: Number(skill.damage?.accuracyModifier ?? 0) || 0,
        criticalModifier: Number(skill.damage?.criticalModifier ?? 0) || 0,
      },
    },
    gold: { mechanic, spend, multiplier },
  };
}

function runtimeData(data, session, { targetInstanceId = null, goldSpend = null } = {}) {
  const source = repeatSource(data, session);
  let consumption = null;
  let gold = null;
  let playerSkillById = null;
  for (const [id, originalSkill] of data.playerSkillById) {
    let skill = repeatWhileHitEnvelope(originalSkill, session, targetInstanceId);
    const fieldEnvelope = fieldConsumptionEnvelope(skill, session);
    skill = fieldEnvelope.skill;
    if (fieldEnvelope.consumption) consumption = fieldEnvelope.consumption;
    const moneyEnvelope = goldEnvelope(skill, goldSpend);
    skill = moneyEnvelope.skill;
    if (moneyEnvelope.gold) gold = moneyEnvelope.gold;
    if (source && mechanicFamily(skill, REPEAT_LAST_SKILL)) skill = repeatEnvelope(skill, source.skill);
    if (skill === originalSkill) continue;
    playerSkillById ??= new Map(data.playerSkillById);
    playerSkillById.set(id, skill);
  }
  return { data: playerSkillById ? { ...data, playerSkillById } : data, source, consumption, gold };
}

function playerSkillFrame(round, skillId) {
  return (round?.frames ?? []).find((frame) => (
    frame?.phase === 'action'
      && frame.actorSide === 'player'
      && frame.action?.kind === 'skill'
      && frame.action?.skillId === skillId
  )) ?? null;
}

function attachFrameEvent(output, frame, event) {
  if (!frame) return;
  const decorate = (candidate) => {
    if (!candidate || candidate.seq !== frame.seq) return;
    candidate.events = [...(candidate.events ?? []), event];
  };
  decorate(frame);
  for (const candidate of output.session?.frames ?? []) decorate(candidate);
  for (const candidate of output.session?.lastRound?.frames ?? []) decorate(candidate);
  for (const candidate of output.result?.timeline?.frames ?? []) decorate(candidate);
}

function commandDefinition(data, session, actionId) {
  return base.listInteractiveBattleCommands({ data, session })
    .find((entry) => entry.actionId === actionId) ?? null;
}

function parseSkillAction(command) {
  const actionId = String(command?.actionId ?? '');
  const match = actionId.match(/^SKILL:(SKL-\d{4})(?::GOLD:(\d+))?$/u);
  if (!match) return { actionId, skillId: null, goldSpend: null };
  const explicitSpend = command?.goldSpend ?? match[2];
  const goldSpend = explicitSpend === null || explicitSpend === undefined || explicitSpend === ''
    ? null
    : Number(explicitSpend);
  return { actionId, skillId: match[1], goldSpend };
}

function goldSpendOptions(gold) {
  if (gold <= 0) return [];
  const candidates = [1, 25, 100, 250, 500, 1000, 2500, 5000, 10000, Math.floor(gold)];
  return [...new Set(candidates.filter((value) => Number.isInteger(value) && value > 0 && value <= gold))].sort((a, b) => a - b);
}

function decorateCommand(command, data, session, transformed) {
  if (!command.skillId) return [command];
  const skill = data.playerSkillById.get(command.skillId);
  if (!skill) return [command];

  if (mechanicFamily(skill, REPEAT_LAST_SKILL) && !transformed.source) {
    return [{ ...command, available: false, disabledReason: 'no_repeatable_history', targets: [] }];
  }
  if (mechanicFamily(skill, CONSUME_OWNED_FIELD) && activeOwnedFields(session).length === 0) {
    return [{ ...command, available: false, disabledReason: 'no_owned_field', targets: [] }];
  }
  const goldMechanic = mechanicEntry(skill, GOLD_SPEND_SCALING);
  if (!goldMechanic) return [command];
  const runtime = mechanicRuntime(session);
  if (!command.available) return [command];
  const options = goldSpendOptions(Number(runtime.gold ?? 0));
  if (!options.length) return [{ ...command, available: false, disabledReason: 'insufficient_gold', targets: [] }];
  return options.map((spend) => ({
    ...command,
    actionId: `SKILL:${skill.id}:GOLD:${spend}`,
    name: `${command.name} (${spend}G)`,
    goldCost: spend,
    goldBefore: runtime.gold,
    damageMultiplier: goldDamageMultiplier(goldMechanic, spend),
  }));
}

export function beginInteractiveBattle(options) {
  const session = base.beginInteractiveBattle(options);
  session.playerRuntimeMechanics = mechanicRuntime(null, options);
  return session;
}

export function listInteractiveBattleCommands({ data, session }) {
  if (!session) return base.listInteractiveBattleCommands({ data, session });
  const runtimeSession = withMechanicRuntime(session);
  pruneExpiredFields(runtimeSession);
  const transformed = runtimeData(data, runtimeSession);
  const commands = base.listInteractiveBattleCommands({ data: transformed.data, session: runtimeSession });
  return commands.flatMap((command) => decorateCommand(command, data, runtimeSession, transformed));
}

export function resolveInteractiveBattleRound({ data, session, command }) {
  if (!session) return base.resolveInteractiveBattleRound({ data, session, command });
  const runtimeSession = withMechanicRuntime(session);
  pruneExpiredFields(runtimeSession);
  const parsed = parseSkillAction(command);
  const originalSkillId = parsed.skillId;
  const originalSkill = originalSkillId ? data.playerSkillById.get(originalSkillId) : null;
  const isRepeat = mechanicFamily(originalSkill, REPEAT_LAST_SKILL);
  const ownedFields = activeOwnedFields(runtimeSession);
  const consumesField = mechanicFamily(originalSkill, CONSUME_OWNED_FIELD);
  const goldMechanic = mechanicEntry(originalSkill, GOLD_SPEND_SCALING);

  if (isRepeat && !repeatSource(data, runtimeSession)) {
    return { ok: false, reason: 'no_repeatable_history', session };
  }
  if (consumesField && ownedFields.length === 0) {
    return { ok: false, reason: 'no_owned_field', session };
  }
  if (goldMechanic) {
    if (!Number.isInteger(parsed.goldSpend) || parsed.goldSpend <= 0) {
      return { ok: false, reason: 'gold_spend_required', session };
    }
    if (parsed.goldSpend > Number(mechanicRuntime(runtimeSession).gold ?? 0)) {
      return { ok: false, reason: 'insufficient_gold', session };
    }
  }

  const transformed = runtimeData(data, runtimeSession, {
    targetInstanceId: command?.targetInstanceId ?? null,
    goldSpend: parsed.goldSpend,
  });

  let effectiveCommand = originalSkillId
    ? { ...command, actionId: `SKILL:${originalSkillId}` }
    : command;
  if (isRepeat) {
    const definition = commandDefinition(transformed.data, runtimeSession, effectiveCommand.actionId);
    if (definition && ['single_enemy', 'single_ally'].includes(definition.target)) {
      const validTargets = definition.targets ?? [];
      const submitted = validTargets.find((target) => target.instanceId === command?.targetInstanceId);
      if (!submitted) {
        const previousTargetId = transformed.source?.history?.targetInstanceId;
        const selected = validTargets.find((target) => target.instanceId === previousTargetId) ?? validTargets[0];
        if (selected) effectiveCommand = { ...effectiveCommand, targetInstanceId: selected.instanceId };
      }
    }
  }

  const output = base.resolveInteractiveBattleRound({
    data: transformed.data,
    session: runtimeSession,
    command: effectiveCommand,
  });
  if (!output?.ok || !output.session) return output;

  const runtime = mechanicRuntime(output.session);
  output.session.playerRuntimeMechanics = runtime;
  const frame = originalSkillId ? playerSkillFrame(output.round, originalSkillId) : null;
  if (!frame) return output;

  if (goldMechanic && transformed.gold) {
    const goldBefore = Number(runtime.gold ?? 0);
    runtime.gold = goldBefore - transformed.gold.spend;
    const event = {
      type: 'player_runtime_mechanic',
      family: GOLD_SPEND_SCALING,
      skillId: originalSkillId,
      spend: transformed.gold.spend,
      goldBefore,
      goldAfter: runtime.gold,
      damageMultiplier: transformed.gold.multiplier,
    };
    runtime.events.push({ turn: output.session.state?.turn ?? null, ...event });
    attachFrameEvent(output, frame, event);
  }

  const createField = mechanicEntry(originalSkill, CREATE_OWNED_FIELD);
  if (createField) {
    const createdTurn = Number(output.session.state?.turn ?? 0);
    const durationTurns = Math.max(1, Number(createField.durationTurns ?? 1));
    const field = {
      instanceId: `PFIELD-${originalSkillId}-${createdTurn}-${runtime.fields.length + 1}`,
      owner: 'player',
      kind: createField.fieldKind ?? 'magic_circle',
      type: createField.fieldType ?? 'arcane',
      sourceSkillId: originalSkillId,
      createdTurn,
      durationTurns,
      expiresAfterTurn: createdTurn + durationTurns - 1,
    };
    runtime.fields.push(field);
    const event = { type: 'player_runtime_mechanic', family: CREATE_OWNED_FIELD, skillId: originalSkillId, field: { ...field } };
    runtime.events.push({ turn: createdTurn, ...event });
    attachFrameEvent(output, frame, event);
  }

  if (consumesField && transformed.consumption) {
    const consumedIds = new Set(transformed.consumption.fields.map((field) => field.instanceId));
    runtime.fields = runtime.fields.filter((field) => !consumedIds.has(field.instanceId));
    const event = {
      type: 'player_runtime_mechanic',
      family: CONSUME_OWNED_FIELD,
      skillId: originalSkillId,
      consumedFieldIds: [...consumedIds],
      consumedCount: consumedIds.size,
      fieldTypes: transformed.consumption.types,
      uniqueTypeCount: transformed.consumption.types.length,
      baseMultiplier: transformed.consumption.baseMultiplier,
      scale: transformed.consumption.scale,
      damageMultiplier: transformed.consumption.baseMultiplier * transformed.consumption.scale,
    };
    runtime.events.push({ turn: output.session.state?.turn ?? null, ...event });
    attachFrameEvent(output, frame, event);
  }

  if (isRepeat) {
    const event = {
      type: 'player_runtime_mechanic',
      family: REPEAT_LAST_SKILL,
      skillId: originalSkillId,
      sourceSkillId: transformed.source.skill.id,
      targetInstanceId: frame.primaryTargetInstanceId ?? null,
      sourceCostRepaid: false,
      sourceCooldownReset: false,
    };
    runtime.events.push({ turn: output.session.state?.turn ?? null, ...event });
    attachFrameEvent(output, frame, event);
    return output;
  }

  if (repeatableActiveSkill(originalSkill)) {
    runtime.history.lastRepeatable = {
      skillId: originalSkill.id,
      targetInstanceId: frame.primaryTargetInstanceId ?? null,
      turn: output.session.state?.turn ?? null,
    };
  }
  return output;
}
