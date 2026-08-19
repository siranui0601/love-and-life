import * as base from './battle-simulator-base.mjs';
import { BATTLE_ASSUMPTIONS } from './battle-model.mjs';
import {
  applyGenericRoundProtection,
  applyGenericSkillSuccess,
  ensureGenericRuntime,
  genericSpecificUnavailableReason,
  genericWeatherOptions,
  initializeGenericBattleRuntime,
  prepareGenericSkill,
} from './player-runtime-generic.mjs';

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
  const runtime = session?.playerRuntimeMechanics ?? {
    version: PLAYER_RUNTIME_VERSION,
    gold: Math.max(0, Number(options.playerGold ?? options.gold ?? options.playerBuild?.gold ?? 0) || 0),
    history: { lastRepeatable: null },
    fields: [],
    weather: null,
    events: [],
  };
  return ensureGenericRuntime(runtime);
}

function withMechanicRuntime(session, options = {}) {
  if (session?.playerRuntimeMechanics) {
    ensureGenericRuntime(session.playerRuntimeMechanics);
    return session;
  }
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
  const accuracyModifier = hitChancePct - Number(BATTLE_ASSUMPTIONS.baseHitChancePct ?? 90) - actorAccuracy + targetEvasion;
  const perHitMultiplier = Number(mechanic.perHitMultiplier ?? skill.damage?.perHitMultiplier ?? 0);
  return { ...skill, damage: { ...skill.damage, totalMultiplier: perHitMultiplier, hits: 1, maxHits, accuracyModifier } };
}

function activeOwnedFields(session) {
  const runtime = mechanicRuntime(session);
  const turn = Number(session?.state?.turn ?? 0);
  return (runtime.fields ?? []).filter((field) => field?.owner === 'player' && field?.kind === 'magic_circle'
    && (field.expiresAfterTurn === null || field.expiresAfterTurn === undefined || Number(field.expiresAfterTurn) >= turn));
}

function pruneExpiredFields(session) {
  const runtime = mechanicRuntime(session);
  const turn = Number(session?.state?.turn ?? 0);
  runtime.fields = (runtime.fields ?? []).filter((field) => field?.expiresAfterTurn === null || field?.expiresAfterTurn === undefined || Number(field.expiresAfterTurn) >= turn);
  return runtime;
}

function fieldConsumptionEnvelope(skill, session) {
  const mechanic = mechanicEntry(skill, CONSUME_OWNED_FIELD);
  if (!mechanic) return { skill, consumption: null };
  const fields = activeOwnedFields(session);
  if (!fields.length) return { skill, consumption: { mechanic, fields, types: [], scale: 1 } };
  const types = [...new Set(fields.map((field) => field.type ?? 'arcane'))].sort();
  const scale = Math.min(Number(mechanic.maxScale ?? 2.5), 1
    + Math.max(0, fields.length - 1) * Number(mechanic.extraFieldScale ?? 0)
    + Math.max(0, types.length - 1) * Number(mechanic.extraTypeScale ?? 0));
  const baseMultiplier = Number(skill.damage?.totalMultiplier ?? skill.damage?.perHitMultiplier ?? 0);
  const activationConditions = (skill.activationConditions ?? []).filter((condition) => !(condition?.scope === 'battle' && condition?.path === 'ownedFieldEffectCount'));
  return {
    skill: { ...skill, activationConditions, damage: { ...skill.damage, perHitMultiplier: Number(skill.damage?.perHitMultiplier ?? baseMultiplier) * scale, totalMultiplier: baseMultiplier * scale } },
    consumption: { mechanic, fields, types, scale, baseMultiplier },
  };
}

function goldDamageMultiplier(mechanic, spend) {
  return Math.min(Number(mechanic?.maxMultiplier ?? 2.8), Number(mechanic?.baseMultiplier ?? 0.55)
    + Number(mechanic?.logCoefficient ?? 0.32) * Math.log(1 + spend / Math.max(1, Number(mechanic?.divisor ?? 25))));
}

function goldEnvelope(skill, spend) {
  const mechanic = mechanicEntry(skill, GOLD_SPEND_SCALING);
  if (!mechanic || !Number.isInteger(spend) || spend <= 0) return { skill, gold: null };
  const multiplier = goldDamageMultiplier(mechanic, spend);
  return {
    skill: { ...skill, costs: { ...skill.costs, money: 0 }, damage: { ...skill.damage, formula: 'fixedMultiplier', perHitMultiplier: multiplier, hits: 1, totalMultiplier: multiplier, accuracyModifier: Number(skill.damage?.accuracyModifier ?? 0) || 0, criticalModifier: Number(skill.damage?.criticalModifier ?? 0) || 0 } },
    gold: { mechanic, spend, multiplier },
  };
}

function runtimeData(data, session, { targetInstanceId = null, goldSpend = null } = {}) {
  const source = repeatSource(data, session);
  let consumption = null;
  let gold = null;
  const genericMetadataBySkillId = new Map();
  const blockedReasons = new Map();
  let playerSkillById = null;
  for (const [id, originalSkill] of data.playerSkillById) {
    let skill = repeatWhileHitEnvelope(originalSkill, session, targetInstanceId);
    const generic = prepareGenericSkill({ skill, session });
    skill = generic.skill;
    genericMetadataBySkillId.set(id, generic.metadata ?? {});
    if (generic.blockedReason) blockedReasons.set(id, generic.blockedReason);
    const fieldEnvelope = fieldConsumptionEnvelope(skill, session);
    skill = fieldEnvelope.skill;
    if (id === 'SKL-1108' && fieldEnvelope.consumption) consumption = fieldEnvelope.consumption;
    const moneyEnvelope = goldEnvelope(skill, goldSpend);
    skill = moneyEnvelope.skill;
    if (moneyEnvelope.gold) gold = moneyEnvelope.gold;
    if (source && mechanicFamily(skill, REPEAT_LAST_SKILL)) skill = repeatEnvelope(skill, source.skill);
    if (skill === originalSkill) continue;
    playerSkillById ??= new Map(data.playerSkillById);
    playerSkillById.set(id, skill);
  }
  return { data: playerSkillById ? { ...data, playerSkillById } : data, source, consumption, gold, genericMetadataBySkillId, blockedReasons };
}

function playerSkillFrame(round, skillId) {
  return (round?.frames ?? []).find((frame) => frame?.phase === 'action' && frame.actorSide === 'player' && frame.action?.kind === 'skill' && frame.action?.skillId === skillId) ?? null;
}

function attachFrameEvent(output, frame, event) {
  if (!frame) return;
  const decorate = (candidate) => { if (candidate && candidate.seq === frame.seq) candidate.events = [...(candidate.events ?? []), event]; };
  decorate(frame);
  for (const candidate of output.session?.frames ?? []) decorate(candidate);
  for (const candidate of output.session?.lastRound?.frames ?? []) decorate(candidate);
  for (const candidate of output.result?.timeline?.frames ?? []) decorate(candidate);
}

function attachRuntimeResult(output, runtime) {
  if (output?.result) output.result.playerRuntimeMechanics = structuredClone(runtime);
}

function commandDefinition(data, session, actionId) {
  return base.listInteractiveBattleCommands({ data, session }).find((entry) => entry.actionId === actionId) ?? null;
}

function parseSkillAction(command) {
  const actionId = String(command?.actionId ?? '');
  const gold = actionId.match(/^SKILL:(SKL-\d{4}):GOLD:(\d+)$/u);
  if (gold) return { actionId, skillId: gold[1], goldSpend: Number(command?.goldSpend ?? gold[2]), weather: null };
  const weather = actionId.match(/^SKILL:(SKL-\d{4}):WEATHER:([^:]+)$/u);
  if (weather) return { actionId, skillId: weather[1], goldSpend: null, weather: String(weather[2]) };
  const plain = actionId.match(/^SKILL:(SKL-\d{4})$/u);
  return { actionId, skillId: plain?.[1] ?? null, goldSpend: null, weather: null };
}

function goldSpendOptions(gold) {
  if (gold <= 0) return [];
  return [...new Set([1, 25, 100, 250, 500, 1000, 2500, 5000, 10000, Math.floor(gold)].filter((value) => Number.isInteger(value) && value > 0 && value <= gold))].sort((a, b) => a - b);
}

function decorateCommand(command, data, session, transformed) {
  if (!command.skillId) return [command];
  const skill = data.playerSkillById.get(command.skillId);
  if (!skill) return [command];
  if (mechanicFamily(skill, REPEAT_LAST_SKILL) && !transformed.source) return [{ ...command, available: false, disabledReason: 'no_repeatable_history', targets: [] }];
  if (mechanicFamily(skill, CONSUME_OWNED_FIELD) && activeOwnedFields(session).length === 0) return [{ ...command, available: false, disabledReason: 'no_owned_field', targets: [] }];
  const blockedReason = transformed.blockedReasons.get(skill.id);
  if (blockedReason) return [{ ...command, available: false, disabledReason: blockedReason, targets: [] }];
  const specificReason = genericSpecificUnavailableReason({ skill, session, baseReason: command.disabledReason });
  let decorated = { ...command, disabledReason: specificReason };
  const goldMechanic = mechanicEntry(skill, GOLD_SPEND_SCALING);
  if (goldMechanic) {
    if (!command.available) return [decorated];
    const runtime = mechanicRuntime(session);
    const options = goldSpendOptions(Number(runtime.gold ?? 0));
    if (!options.length) return [{ ...decorated, available: false, disabledReason: 'insufficient_gold', targets: [] }];
    return options.map((spend) => ({ ...decorated, actionId: `SKILL:${skill.id}:GOLD:${spend}`, name: `${command.name} (${spend}G)`, goldCost: spend, goldBefore: runtime.gold, damageMultiplier: goldDamageMultiplier(goldMechanic, spend) }));
  }
  const weatherOptions = genericWeatherOptions(skill);
  if (weatherOptions.length && command.available) {
    return weatherOptions.map((weather) => ({ ...decorated, actionId: `SKILL:${skill.id}:WEATHER:${weather}`, name: `${command.name} (${weather})`, battleWeather: weather }));
  }
  return [decorated];
}

export function beginInteractiveBattle(options) {
  const session = base.beginInteractiveBattle(options);
  session.playerRuntimeMechanics = mechanicRuntime(null, options);
  initializeGenericBattleRuntime({ data: options.data, session });
  return session;
}

export function listInteractiveBattleCommands({ data, session }) {
  if (!session) return base.listInteractiveBattleCommands({ data, session });
  const runtimeSession = withMechanicRuntime(session);
  pruneExpiredFields(runtimeSession);
  const transformed = runtimeData(data, runtimeSession);
  return base.listInteractiveBattleCommands({ data: transformed.data, session: runtimeSession }).flatMap((command) => decorateCommand(command, data, runtimeSession, transformed));
}

export function resolveInteractiveBattleRound({ data, session, command }) {
  if (!session) return base.resolveInteractiveBattleRound({ data, session, command });
  const runtimeSession = withMechanicRuntime(session);
  pruneExpiredFields(runtimeSession);
  const parsed = parseSkillAction(command);
  const originalSkillId = parsed.skillId;
  const originalSkill = originalSkillId ? data.playerSkillById.get(originalSkillId) : null;
  const isRepeat = mechanicFamily(originalSkill, REPEAT_LAST_SKILL);
  const consumesField = mechanicFamily(originalSkill, CONSUME_OWNED_FIELD);
  const goldMechanic = mechanicEntry(originalSkill, GOLD_SPEND_SCALING);
  const weatherOptions = genericWeatherOptions(originalSkill);
  if (isRepeat && !repeatSource(data, runtimeSession)) return { ok: false, reason: 'no_repeatable_history', session };
  if (consumesField && activeOwnedFields(runtimeSession).length === 0) return { ok: false, reason: 'no_owned_field', session };
  if (goldMechanic) {
    if (!Number.isInteger(parsed.goldSpend) || parsed.goldSpend <= 0) return { ok: false, reason: 'gold_spend_required', session };
    if (parsed.goldSpend > Number(mechanicRuntime(runtimeSession).gold ?? 0)) return { ok: false, reason: 'insufficient_gold', session };
  }
  if (weatherOptions.length && (!parsed.weather || !weatherOptions.includes(parsed.weather))) return { ok: false, reason: 'weather_selection_required', session };

  const transformed = runtimeData(data, runtimeSession, { targetInstanceId: command?.targetInstanceId ?? null, goldSpend: parsed.goldSpend });
  const genericBlocked = originalSkillId ? transformed.blockedReasons.get(originalSkillId) : null;
  if (genericBlocked) return { ok: false, reason: genericBlocked, session };
  let effectiveCommand = originalSkillId ? { ...command, actionId: `SKILL:${originalSkillId}` } : command;
  if (isRepeat) {
    const definition = commandDefinition(transformed.data, runtimeSession, effectiveCommand.actionId);
    if (definition && ['single_enemy', 'single_ally'].includes(definition.target)) {
      const validTargets = definition.targets ?? [];
      const submitted = validTargets.find((target) => target.instanceId === command?.targetInstanceId);
      if (!submitted) {
        const selected = validTargets.find((target) => target.instanceId === transformed.source?.history?.targetInstanceId) ?? validTargets[0];
        if (selected) effectiveCommand = { ...effectiveCommand, targetInstanceId: selected.instanceId };
      }
    }
  }

  const output = base.resolveInteractiveBattleRound({ data: transformed.data, session: runtimeSession, command: effectiveCommand });
  if (!output?.ok || !output.session) return output;
  const runtime = mechanicRuntime(output.session);
  output.session.playerRuntimeMechanics = runtime;
  let frame = originalSkillId ? playerSkillFrame(output.round, originalSkillId) : null;

  if (frame && goldMechanic && transformed.gold) {
    const goldBefore = Number(runtime.gold ?? 0);
    runtime.gold = goldBefore - transformed.gold.spend;
    const event = { type: 'player_runtime_mechanic', family: GOLD_SPEND_SCALING, skillId: originalSkillId, spend: transformed.gold.spend, goldBefore, goldAfter: runtime.gold, damageMultiplier: transformed.gold.multiplier };
    runtime.events.push({ turn: output.session.state?.turn ?? null, ...event });
    attachFrameEvent(output, frame, event);
  }

  if (frame) {
    const createField = mechanicEntry(originalSkill, CREATE_OWNED_FIELD);
    if (createField) {
      const createdTurn = Number(output.session.state?.turn ?? 0);
      const durationTurns = Math.max(1, Number(createField.durationTurns ?? 1));
      const field = { instanceId: `PFIELD-${originalSkillId}-${createdTurn}-${runtime.fields.length + 1}`, owner: 'player', kind: createField.fieldKind ?? 'magic_circle', type: createField.fieldType ?? 'arcane', sourceSkillId: originalSkillId, createdTurn, durationTurns, expiresAfterTurn: createdTurn + durationTurns - 1 };
      runtime.fields.push(field);
      const event = { type: 'player_runtime_mechanic', family: CREATE_OWNED_FIELD, skillId: originalSkillId, field: { ...field } };
      runtime.events.push({ turn: createdTurn, ...event });
      attachFrameEvent(output, frame, event);
    }
    if (consumesField && transformed.consumption) {
      const consumedIds = new Set(transformed.consumption.fields.map((field) => field.instanceId));
      runtime.fields = runtime.fields.filter((field) => !consumedIds.has(field.instanceId));
      const event = { type: 'player_runtime_mechanic', family: CONSUME_OWNED_FIELD, skillId: originalSkillId, consumedFieldIds: [...consumedIds], consumedCount: consumedIds.size, fieldTypes: transformed.consumption.types, uniqueTypeCount: transformed.consumption.types.length, baseMultiplier: transformed.consumption.baseMultiplier, scale: transformed.consumption.scale, damageMultiplier: transformed.consumption.baseMultiplier * transformed.consumption.scale };
      runtime.events.push({ turn: output.session.state?.turn ?? null, ...event });
      attachFrameEvent(output, frame, event);
    }
    const genericEvents = applyGenericSkillSuccess({ originalSkill, preparedMetadata: transformed.genericMetadataBySkillId.get(originalSkillId), session: output.session, frame, parsedAction: parsed });
    for (const event of genericEvents) attachFrameEvent(output, frame, event);
  }

  applyGenericRoundProtection({ session: output.session, round: output.round });
  if (output.session.status === 'active' && output.result?.winner === 'enemies') output.result = null;
  if (output.session.status === 'active' && (!output.commands || output.commands.length === 0)) output.commands = listInteractiveBattleCommands({ data, session: output.session });
  frame = originalSkillId ? playerSkillFrame(output.round, originalSkillId) : frame;

  if (frame && isRepeat) {
    const event = { type: 'player_runtime_mechanic', family: REPEAT_LAST_SKILL, skillId: originalSkillId, sourceSkillId: transformed.source.skill.id, targetInstanceId: frame.primaryTargetInstanceId ?? null, sourceCostRepaid: false, sourceCooldownReset: false };
    runtime.events.push({ turn: output.session.state?.turn ?? null, ...event });
    attachFrameEvent(output, frame, event);
    attachRuntimeResult(output, runtime);
    return output;
  }
  if (frame && repeatableActiveSkill(originalSkill)) {
    runtime.history.lastRepeatable = { skillId: originalSkill.id, targetInstanceId: frame.primaryTargetInstanceId ?? null, turn: output.session.state?.turn ?? null };
  }
  attachRuntimeResult(output, runtime);
  return output;
}
