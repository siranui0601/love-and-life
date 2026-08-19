import * as base from './battle-simulator-base.mjs';
import { BATTLE_ASSUMPTIONS } from './battle-model.mjs';

export * from './battle-simulator-base.mjs';

const PLAYER_RUNTIME_VERSION = 1;
const REPEAT_LAST_SKILL = 'REPEAT_LAST_SKILL';
const REPEAT_WHILE_HIT = 'REPEAT_WHILE_HIT';
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

function mechanicFamily(skill, family) {
  return (skill?.runtimeMechanics ?? []).some((entry) => entry?.family === family);
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
  if (skill.costs?.itemOrEquipment) return false;
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
  if (!mechanicFamily(skill, REPEAT_WHILE_HIT) || skill.damage?.formula !== 'repeatWhileHit') return skill;
  const actor = (session?.state?.players ?? []).find((entry) => entry.alive && Number(entry.hp ?? 0) > 0) ?? null;
  const target = liveActorByInstanceId(session, targetInstanceId)
    ?? (session?.state?.enemies ?? []).find((entry) => entry.alive && Number(entry.hp ?? 0) > 0)
    ?? null;
  const actorAccuracy = actor ? base.actorStat(actor, 'accuracy') : 0;
  const targetEvasion = target ? base.actorStat(target, 'evasion') : 0;
  const accuracyModifier = REPEAT_WHILE_HIT_CHANCE_PCT
    - Number(BATTLE_ASSUMPTIONS.baseHitChancePct ?? 90)
    - actorAccuracy
    + targetEvasion;
  const perHitMultiplier = Number(skill.damage?.perHitMultiplier ?? 0);
  return {
    ...skill,
    damage: {
      ...skill.damage,
      totalMultiplier: perHitMultiplier,
      hits: 1,
      accuracyModifier,
    },
    runtimeMechanics: (skill.runtimeMechanics ?? []).map((entry) => (
      entry?.family === REPEAT_WHILE_HIT
        ? { ...entry, hitChancePct: REPEAT_WHILE_HIT_CHANCE_PCT, maxHits: REPEAT_WHILE_HIT_MAX_HITS, perHitMultiplier }
        : entry
    )),
  };
}

function runtimeData(data, session, { targetInstanceId = null } = {}) {
  const source = repeatSource(data, session);
  let playerSkillById = null;
  for (const [id, originalSkill] of data.playerSkillById) {
    let skill = repeatWhileHitEnvelope(originalSkill, session, targetInstanceId);
    if (source && mechanicFamily(skill, REPEAT_LAST_SKILL)) skill = repeatEnvelope(skill, source.skill);
    if (skill === originalSkill) continue;
    playerSkillById ??= new Map(data.playerSkillById);
    playerSkillById.set(id, skill);
  }
  return { data: playerSkillById ? { ...data, playerSkillById } : data, source };
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

export function beginInteractiveBattle(options) {
  const session = base.beginInteractiveBattle(options);
  session.playerRuntimeMechanics = mechanicRuntime(null, options);
  return session;
}

export function listInteractiveBattleCommands({ data, session }) {
  if (!session) return base.listInteractiveBattleCommands({ data, session });
  const runtimeSession = withMechanicRuntime(session);
  const transformed = runtimeData(data, runtimeSession);
  const commands = base.listInteractiveBattleCommands({ data: transformed.data, session: runtimeSession });
  if (transformed.source) return commands;
  return commands.map((command) => {
    if (!command.skillId) return command;
    const skill = data.playerSkillById.get(command.skillId);
    if (!mechanicFamily(skill, REPEAT_LAST_SKILL)) return command;
    return { ...command, available: false, disabledReason: 'no_repeatable_history', targets: [] };
  });
}

export function resolveInteractiveBattleRound({ data, session, command }) {
  if (!session) return base.resolveInteractiveBattleRound({ data, session, command });
  const runtimeSession = withMechanicRuntime(session);
  const originalActionId = String(command?.actionId ?? '');
  const originalSkillId = originalActionId.startsWith('SKILL:') ? originalActionId.slice('SKILL:'.length) : null;
  const originalSkill = originalSkillId ? data.playerSkillById.get(originalSkillId) : null;
  const isRepeat = mechanicFamily(originalSkill, REPEAT_LAST_SKILL);
  const transformed = runtimeData(data, runtimeSession, { targetInstanceId: command?.targetInstanceId ?? null });

  if (isRepeat && !transformed.source) {
    return { ok: false, reason: 'no_repeatable_history', session };
  }

  let effectiveCommand = command;
  if (isRepeat) {
    const definition = commandDefinition(transformed.data, runtimeSession, originalActionId);
    if (definition && ['single_enemy', 'single_ally'].includes(definition.target)) {
      const validTargets = definition.targets ?? [];
      const submitted = validTargets.find((target) => target.instanceId === command?.targetInstanceId);
      if (!submitted) {
        const previousTargetId = transformed.source?.history?.targetInstanceId;
        const selected = validTargets.find((target) => target.instanceId === previousTargetId) ?? validTargets[0];
        if (selected) effectiveCommand = { ...command, targetInstanceId: selected.instanceId };
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
