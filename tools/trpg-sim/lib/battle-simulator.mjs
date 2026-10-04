import * as current from './battle-simulator-checkpoint-d-preformation.mjs';
import {
  activeMagicFormations,
  activeOwnedMagicFormations,
  advanceFormationRoundEnd,
  applyFormationControlSuccess,
  clearFormationsOnBattleEnd,
  decorateFormationCommands,
  enrichDetonationEvent,
  formationObservationCommands,
  isMagicFormationCreatorSkillId,
  normalizeFormationRuntime,
  parseFormationControlAction,
  prepareFormationSession,
  removeLegacyControlFields,
  restoreShieldedNonFormationFields,
  sameSourceFormation,
  shieldNonFormationFieldsForDetonation,
  translateFormationControlCommand,
  validateFormationControl,
} from './player-formation-runtime.mjs';

export * from './battle-simulator-checkpoint-d-preformation.mjs';
export * from './player-formation-runtime.mjs';

function skillIdFromActionId(actionId) {
  return String(actionId ?? '').match(/^SKILL:(SKL-\d{4})(?::|$)/u)?.[1] ?? null;
}

function formationCountConditionSatisfied(condition, count) {
  const expected = Number(condition?.value);
  if (!Number.isFinite(expected)) return false;
  switch (condition?.op) {
    case 'gte': return count >= expected;
    case 'gt': return count > expected;
    case 'lte': return count <= expected;
    case 'lt': return count < expected;
    case 'eq': return count === expected;
    case 'neq': return count !== expected;
    default: return false;
  }
}

function formationAwareData(data, session) {
  const ownedCount = activeOwnedMagicFormations(session).length;
  let playerSkillById = null;
  for (const [skillId, original] of data.playerSkillById ?? []) {
    const conditions = original.activationConditions ?? [];
    if (!conditions.some((condition) => condition?.scope === 'battle' && condition?.path === 'ownedFieldEffectCount')) continue;
    const isControl = ['SKL-0653', 'SKL-0654'].includes(skillId);
    const activationConditions = conditions.filter((condition) => {
      if (!(condition?.scope === 'battle' && condition?.path === 'ownedFieldEffectCount')) return true;
      if (isControl) return false;
      return !formationCountConditionSatisfied(condition, ownedCount);
    });
    if (activationConditions.length === conditions.length) continue;
    playerSkillById ??= new Map(data.playerSkillById);
    playerSkillById.set(skillId, { ...original, activationConditions });
  }
  if (!playerSkillById) return data;
  return {
    ...data,
    playerSkillById,
    playerSkills: (data.playerSkills ?? []).map((entry) => playerSkillById.get(entry.id) ?? entry),
  };
}

function mergeFormationObservations(commands, session) {
  const observations = formationObservationCommands(session);
  if (!observations.length) return commands;
  const ids = new Set(commands.map((entry) => entry.actionId));
  return [...commands, ...observations.filter((entry) => !ids.has(entry.actionId))];
}

export function beginInteractiveBattle(options) {
  const session = current.beginInteractiveBattle(options);
  normalizeFormationRuntime(session, options.data);
  return session;
}

export function listInteractiveBattleCommands({ data, session }) {
  if (!session) return current.listInteractiveBattleCommands({ data, session });
  const prepared = prepareFormationSession(session, data);
  const effectiveData = formationAwareData(data, prepared);
  const base = current.listInteractiveBattleCommands({ data: effectiveData, session: prepared });
  const decorated = decorateFormationCommands({ data: effectiveData, session: prepared, commands: base });
  return mergeFormationObservations(decorated, prepared);
}

export function resolveInteractiveBattleRound({ data, session, command }) {
  if (!session) return current.resolveInteractiveBattleRound({ data, session, command });
  let prepared = prepareFormationSession(session, data);
  const control = parseFormationControlAction(command?.actionId);
  const submittedSkillId = skillIdFromActionId(command?.actionId);

  if (['SKL-0653', 'SKL-0654'].includes(submittedSkillId) && !control) {
    return { ok: false, reason: 'formation_control_selection_required', session };
  }
  if (submittedSkillId && isMagicFormationCreatorSkillId(submittedSkillId)) {
    const existing = sameSourceFormation(prepared, submittedSkillId);
    if (existing) return { ok: false, reason: 'formation_already_active', session };
  }
  if (control) {
    const validation = validateFormationControl(prepared, control);
    if (!validation.ok) return { ok: false, reason: validation.reason, session };
  }

  const effectiveSkillId = control?.skillId ?? submittedSkillId;
  const effectiveData = formationAwareData(data, prepared);
  const baseCommands = current.listInteractiveBattleCommands({ data: effectiveData, session: prepared });
  let effectiveCommand = command;
  if (control) {
    effectiveCommand = translateFormationControlCommand({ baseCommands, control });
    if (!effectiveCommand) return { ok: false, reason: 'formation_control_unavailable', session };
  }

  const isDetonation = effectiveSkillId === 'SKL-1108';
  const previousFormationIds = new Set(activeMagicFormations(prepared).map((field) => field.instanceId));
  const consumedBefore = isDetonation ? activeOwnedMagicFormations(prepared).map((field) => structuredClone(field)) : [];
  if (isDetonation) prepared = shieldNonFormationFieldsForDetonation(prepared);

  const output = current.resolveInteractiveBattleRound({ data: effectiveData, session: prepared, command: effectiveCommand });
  if (!output?.ok) return output?.session ? { ...output, session } : output;
  if (!output.session) return output;
  restoreShieldedNonFormationFields(output.session);
  normalizeFormationRuntime(output.session, data);
  removeLegacyControlFields(output.session);

  // Formation controls are action effects. Apply them before the common
  // round-end duration decrement so 二重陣 can rescue a 1T formation and the
  // same round still consumes one turn of the resulting duration.
  if (control) {
    const applied = applyFormationControlSuccess({ session: output.session, control });
    if (!applied.ok) return { ok: false, reason: applied.reason, session };
  }

  const expired = advanceFormationRoundEnd(output.session, previousFormationIds, data);
  if (expired.length) {
    output.session.playerRuntimeMechanics.events ??= [];
    output.session.playerRuntimeMechanics.events.push({
      turn: Number(output.session.state?.turn ?? 0),
      type: 'formation_lifecycle',
      family: 'FORMATION_EXPIRED',
      formationInstanceIds: expired.map((field) => field.instanceId),
      cancelledPendingEffects: expired
        .filter((field) => field.pendingDelayedEffect?.status === 'pending')
        .map((field) => ({ ...field.pendingDelayedEffect, formationInstanceId: field.instanceId })),
    });
  }

  if (isDetonation) {
    const canonical = enrichDetonationEvent({ session: output.session, consumedBefore });
    if (canonical) {
      const frame = (output.round?.frames ?? []).find((entry) => entry?.actorSide === 'player' && entry?.action?.skillId === 'SKL-1108');
      if (frame) {
        frame.events ??= [];
        const event = [...(output.session.playerRuntimeMechanics.events ?? [])].reverse()
          .find((entry) => entry?.family === 'CONSUME_OWNED_FIELD' && entry?.skillId === 'SKL-1108');
        const target = frame.events.find((entry) => entry?.family === 'CONSUME_OWNED_FIELD') ?? event;
        if (target) Object.assign(target, canonical);
      }
    }
  }

  const cleared = clearFormationsOnBattleEnd(output.session);
  if (cleared.length) {
    output.session.playerRuntimeMechanics.events ??= [];
    output.session.playerRuntimeMechanics.events.push({
      turn: Number(output.session.state?.turn ?? 0),
      type: 'formation_lifecycle',
      family: 'FORMATION_CLEARED_BATTLE_END',
      reason: output.session.winner === 'fled' ? 'flee' : 'battle_end',
      formationInstanceIds: cleared.map((field) => field.instanceId),
    });
  }

  if (output.session.status === 'active') {
    output.commands = listInteractiveBattleCommands({ data, session: output.session });
  }
  if (output.result) output.result.playerRuntimeMechanics = structuredClone(output.session.playerRuntimeMechanics);
  return output;
}
