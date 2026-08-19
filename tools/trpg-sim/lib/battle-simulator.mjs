import * as current from './battle-simulator-checkpoint-c-base.mjs';
import {
  applyExtendedRoundRuntime,
  applyExtendedSkillSuccess,
  ensureExtendedRuntime,
  extendedSpecificUnavailableReason,
  initializeExtendedRuntime,
  prepareExtendedSkill,
} from './player-runtime-extended.mjs';

export * from './battle-simulator-checkpoint-c-base.mjs';

function skillIdFromActionId(actionId) {
  return String(actionId ?? '').match(/^SKILL:(SKL-\d{4})(?::|$)/u)?.[1] ?? null;
}

function transformedData(data, session) {
  let playerSkillById = null;
  const metadataBySkillId = new Map();
  const blockedReasons = new Map();
  for (const [id, originalSkill] of data.playerSkillById) {
    const prepared = prepareExtendedSkill({ skill: originalSkill, session });
    metadataBySkillId.set(id, prepared.metadata ?? {});
    if (prepared.blockedReason) blockedReasons.set(id, prepared.blockedReason);
    if (prepared.skill === originalSkill) continue;
    playerSkillById ??= new Map(data.playerSkillById);
    playerSkillById.set(id, prepared.skill);
  }
  if (!playerSkillById) return { data, metadataBySkillId, blockedReasons };
  return {
    data: {
      ...data,
      playerSkillById,
      playerSkills: (data.playerSkills ?? []).map((skill) => playerSkillById.get(skill.id) ?? skill),
    },
    metadataBySkillId,
    blockedReasons,
  };
}

function frameFor(round, skillId) {
  return (round?.frames ?? []).find((frame) => frame?.phase === 'action' && frame.actorSide === 'player' && frame.action?.skillId === skillId) ?? null;
}

function attachBySequence(output, frame, event) {
  if (!frame || !event) return;
  const attach = (candidate) => {
    if (!candidate || candidate.seq !== frame.seq) return;
    if (!(candidate.events ?? []).includes(event)) candidate.events = [...(candidate.events ?? []), event];
  };
  attach(frame);
  for (const candidate of output.session?.frames ?? []) attach(candidate);
  for (const candidate of output.session?.lastRound?.frames ?? []) attach(candidate);
  for (const candidate of output.result?.timeline?.frames ?? []) attach(candidate);
}

function syncFinishedResult(output) {
  if (!output?.session) return;
  if (output.session.status === 'active') {
    output.result = null;
    return;
  }
  if (!output.result) return;
  const state = output.session.state;
  output.result.winner = output.session.winner ?? output.result.winner;
  output.result.players = state.players.map((actor) => ({
    id: actor.id,
    hp: actor.hp,
    maxHp: actor.maxHp,
    mp: actor.mp,
    maxMp: actor.maxMp,
    alive: actor.alive,
    mpSpent: actor.mpSpent,
    damageDealt: actor.damageDealt,
  }));
  output.result.enemies = state.enemies.map((actor) => ({
    id: actor.id,
    hp: actor.hp,
    maxHp: actor.maxHp,
    alive: actor.alive,
    escaped: actor.escaped,
  }));
  output.result.playerRuntimeMechanics = structuredClone(output.session.playerRuntimeMechanics);
  if (output.result.timeline) output.result.timeline.frames = output.session.frames;
}

function selfDisableCommands(session) {
  const runtime = ensureExtendedRuntime(session.playerRuntimeMechanics);
  if (Number(runtime.control.selfDisableNextAction ?? 0) <= 0) return null;
  return [{
    actionId: 'WAIT:SELF_DISABLED',
    kind: 'wait',
    name: '行動不能',
    description: '前の行動の反動で、この行動は実行できない。',
    target: 'none',
    available: true,
    disabledReason: null,
    targets: [],
  }];
}

export function beginInteractiveBattle(options) {
  const session = current.beginInteractiveBattle(options);
  ensureExtendedRuntime(session.playerRuntimeMechanics);
  initializeExtendedRuntime({ data: options.data, session });
  return session;
}

export function listInteractiveBattleCommands({ data, session }) {
  if (!session) return current.listInteractiveBattleCommands({ data, session });
  ensureExtendedRuntime(session.playerRuntimeMechanics);
  const disabled = selfDisableCommands(session);
  if (disabled) return disabled;
  const transformed = transformedData(data, session);
  return current.listInteractiveBattleCommands({ data: transformed.data, session }).map((command) => {
    if (!command.skillId) return command;
    const originalSkill = data.playerSkillById.get(command.skillId);
    const blockedReason = transformed.blockedReasons.get(command.skillId);
    const disabledReason = blockedReason ?? extendedSpecificUnavailableReason({
      skill: originalSkill,
      session,
      baseReason: command.disabledReason,
    });
    return {
      ...command,
      available: blockedReason ? false : command.available,
      disabledReason,
      ...(blockedReason ? { targets: [] } : {}),
    };
  });
}

function resolveSelfDisabledRound({ data, session, command }) {
  const runtime = ensureExtendedRuntime(session.playerRuntimeMechanics);
  if (Number(runtime.control.selfDisableNextAction ?? 0) <= 0) return null;
  if (command?.actionId !== 'WAIT:SELF_DISABLED') return { ok: false, reason: 'self_disabled_next_action', session };
  const output = current.resolveInteractiveBattleRound({ data, session, command: { actionId: 'DEFEND' } });
  if (!output?.ok || !output.session) return output;
  const nextRuntime = ensureExtendedRuntime(output.session.playerRuntimeMechanics);
  nextRuntime.control.selfDisableNextAction = Math.max(0, Number(nextRuntime.control.selfDisableNextAction ?? 0) - 1);
  const frame = (output.round?.frames ?? []).find((entry) => entry.actorSide === 'player' && entry.action?.kind === 'defend');
  if (frame) {
    frame.action = { kind: 'status_failure', actionId: '__self_disabled__', skillId: null, name: '行動不能' };
    const event = { type: 'player_runtime_mechanic', family: 'SELF_DISABLE_NEXT_ACTION', consumed: true };
    frame.events = [...(frame.events ?? []), event];
    nextRuntime.extendedEvents.push({ turn: output.session.state?.turn ?? null, ...event });
  }
  applyExtendedRoundRuntime({ data, session: output.session, round: output.round });
  if (output.session.status === 'active') output.commands = listInteractiveBattleCommands({ data, session: output.session });
  syncFinishedResult(output);
  return output;
}

export function resolveInteractiveBattleRound({ data, session, command }) {
  if (!session) return current.resolveInteractiveBattleRound({ data, session, command });
  ensureExtendedRuntime(session.playerRuntimeMechanics);
  const disabledOutput = resolveSelfDisabledRound({ data, session, command });
  if (disabledOutput) return disabledOutput;

  const transformed = transformedData(data, session);
  const skillId = skillIdFromActionId(command?.actionId);
  const blockedReason = skillId ? transformed.blockedReasons.get(skillId) : null;
  if (blockedReason) return { ok: false, reason: blockedReason, session };

  const output = current.resolveInteractiveBattleRound({ data: transformed.data, session, command });
  if (!output?.ok || !output.session) return output;
  ensureExtendedRuntime(output.session.playerRuntimeMechanics);

  const originalSkill = skillId ? data.playerSkillById.get(skillId) : null;
  const frame = skillId ? frameFor(output.round, skillId) : null;
  if (originalSkill && frame) {
    const events = applyExtendedSkillSuccess({
      data,
      originalSkill,
      metadata: transformed.metadataBySkillId.get(skillId) ?? {},
      session: output.session,
      frame,
    });
    for (const event of events) attachBySequence(output, frame, event);
  }

  applyExtendedRoundRuntime({ data, session: output.session, round: output.round });
  if (output.session.status === 'active') output.commands = listInteractiveBattleCommands({ data, session: output.session });
  syncFinishedResult(output);
  return output;
}
