import * as current from './battle-simulator-checkpoint-c-extended-base.mjs';
import {
  applyEquipmentRoundRuntime,
  initializeEquipmentBattleRuntime,
  prepareEquipmentSkill,
} from './player-equipment-runtime.mjs';

export * from './battle-simulator-checkpoint-c-extended-base.mjs';

function transformedData(data, session) {
  let playerSkillById = null;
  const blockedReasons = new Map();
  for (const [id, skill] of data.playerSkillById) {
    const prepared = prepareEquipmentSkill({ skill, session });
    if (prepared.blockedReason) blockedReasons.set(id, prepared.blockedReason);
    if (prepared.skill === skill) continue;
    playerSkillById ??= new Map(data.playerSkillById);
    playerSkillById.set(id, prepared.skill);
  }
  if (!playerSkillById) return { data, blockedReasons };
  return {
    data: {
      ...data,
      playerSkillById,
      playerSkills: (data.playerSkills ?? []).map((skill) => playerSkillById.get(skill.id) ?? skill),
    },
    blockedReasons,
  };
}

function skillIdFromActionId(actionId) {
  return String(actionId ?? '').match(/^SKILL:(SKL-\d{4})(?::|$)/u)?.[1] ?? null;
}

function syncResult(output) {
  if (!output?.session || !output.result) return;
  const state = output.session.state;
  output.result.players = state.players.map((actor) => ({ id:actor.id,hp:actor.hp,maxHp:actor.maxHp,mp:actor.mp,maxMp:actor.maxMp,alive:actor.alive,mpSpent:actor.mpSpent,damageDealt:actor.damageDealt }));
  output.result.enemies = state.enemies.map((actor) => ({ id:actor.id,hp:actor.hp,maxHp:actor.maxHp,alive:actor.alive,escaped:actor.escaped }));
  output.result.playerRuntimeMechanics = structuredClone(output.session.playerRuntimeMechanics);
  if (output.result.timeline) output.result.timeline.frames = output.session.frames;
}

export function beginInteractiveBattle(options) {
  const session = current.beginInteractiveBattle(options);
  initializeEquipmentBattleRuntime({ data: options.data, session });
  return session;
}

export function listInteractiveBattleCommands({ data, session }) {
  if (!session) return current.listInteractiveBattleCommands({ data, session });
  const transformed = transformedData(data, session);
  return current.listInteractiveBattleCommands({ data: transformed.data, session }).map((command) => {
    const reason = command.skillId ? transformed.blockedReasons.get(command.skillId) : null;
    return reason ? { ...command, available:false, disabledReason:reason, targets:[] } : command;
  });
}

export function resolveInteractiveBattleRound({ data, session, command }) {
  if (!session) return current.resolveInteractiveBattleRound({ data, session, command });
  const skillId = skillIdFromActionId(command?.actionId);
  const transformed = transformedData(data, session);
  const blockedReason = skillId ? transformed.blockedReasons.get(skillId) : null;
  if (blockedReason) return { ok:false, reason:blockedReason, session };
  const output = current.resolveInteractiveBattleRound({ data: transformed.data, session, command });
  if (!output?.ok || !output.session) return output;
  applyEquipmentRoundRuntime({ data, session: output.session, round: output.round });
  if (output.session.status === 'active') output.commands = listInteractiveBattleCommands({ data, session: output.session });
  syncResult(output);
  return output;
}
