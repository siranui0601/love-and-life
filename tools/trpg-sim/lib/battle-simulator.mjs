import * as current from './battle-simulator-checkpoint-c-extended-base.mjs';
import { applyEquipmentRoundRuntime, initializeEquipmentBattleRuntime, prepareEquipmentSkill } from './player-equipment-runtime.mjs';
import { applyCheckpointCClosureSuccess, checkpointCResourceUnavailableReason, prepareCheckpointCClosureSkill } from './player-skill-runtime-checkpoint-c-closure.mjs';

export * from './battle-simulator-checkpoint-c-extended-base.mjs';

const PUBLIC_REASON = Object.freeze({
  no_owned_field: 'field_required',
  no_repeatable_history: 'missing_history',
  uses_exhausted: 'use_limit',
  weapon_requirement: 'wrong_weapon',
});

const PUBLIC_REASON_DETAIL = Object.freeze({
  insufficient_mp: 'MPが足りない',
  insufficient_hp: 'HPが足りない',
  insufficient_resource: '消費するHP・MPが足りない',
  wrong_weapon: '必要な武器種を装備していない',
  shield_required: '盾を装備している必要がある',
  cooldown: '再使用まで待つ必要がある',
  use_limit: 'この戦闘での使用回数を使い切った',
  sealed: '封印されているため使用できない',
  field_required: '必要な陣・フィールドが設置されていない',
  insufficient_gold: '支払うGoldが足りない',
  missing_history: '再演できる直前のスキル履歴がない',
  equipment_disabled: '必要な装備効果が現在無効になっている',
  invalid_target: 'このスキルを向けられる対象ではない',
  no_target: '効果を向けられる対象がいない',
  conditions_not_met: '発動条件を満たしていない',
  not_active: '戦闘中に使う技ではない',
});

const publicReason = (reason) => PUBLIC_REASON[reason] ?? reason;

export function playerFacingBattleDisabledDetail(command = {}, rawReason = null) {
  const reason = publicReason(rawReason ?? command.disabledReason ?? command.reasonCode);
  if (!reason) return null;
  const base = PUBLIC_REASON_DETAIL[reason] ?? '今はこの行動を使えない';
  if (reason === 'insufficient_mp' && Number(command.mpCost ?? 0) > 0) {
    return `${base}（必要MP ${Number(command.mpCost)}／現在 ${Number(command.currentMp ?? 0)}）`;
  }
  if (reason === 'insufficient_hp' && Number(command.hpCost ?? 0) > 0) {
    return `${base}（必要HP ${Number(command.hpCost) + 1}以上／現在 ${Number(command.currentHp ?? 0)}）`;
  }
  if (reason === 'cooldown' && Number(command.cooldownRemaining ?? 0) > 0) {
    return `${base}（あと${Number(command.cooldownRemaining)}ラウンド）`;
  }
  if (reason === 'insufficient_gold' && Number(command.goldCost ?? 0) > 0) {
    return `${base}（必要 ${Number(command.goldCost)}G）`;
  }
  return base;
}

function transformedData(data, session) {
  let playerSkillById = null;
  const blockedReasons = new Map();
  for (const [id, skill] of data.playerSkillById) {
    const closureSkill = prepareCheckpointCClosureSkill(skill);
    const prepared = prepareEquipmentSkill({ skill: closureSkill, session });
    const resourceReason = checkpointCResourceUnavailableReason({ skill: closureSkill, session });
    if (prepared.blockedReason) blockedReasons.set(id, prepared.blockedReason);
    else if (resourceReason) blockedReasons.set(id, resourceReason);
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

function decorate(command, blockedReason = null) {
  const raw = blockedReason ?? command.disabledReason;
  const disabledReason = publicReason(raw);
  const unavailable = Boolean(blockedReason) || command.available === false;
  return {
    ...command,
    available: blockedReason ? false : command.available,
    disabledReason,
    disabledDetail: unavailable ? playerFacingBattleDisabledDetail(command, raw) : command.disabledDetail ?? null,
    ...(blockedReason ? { targets: [] } : {}),
    reasonCode: disabledReason,
  };
}

function staleNoTargetCommand(session) {
  const playerAlive = (session.state?.players ?? []).some((actor) => actor.alive && Number(actor.hp ?? 0) > 0);
  const enemyAlive = (session.state?.enemies ?? []).some((actor) => actor.alive && Number(actor.hp ?? 0) > 0 && !actor.escaped);
  if (session.status === 'active' && playerAlive && !enemyAlive) {
    const command = {
      actionId: 'ATTACK',
      kind: 'attack',
      name: 'こうげき',
      target: 'single_enemy',
      available: false,
      disabledReason: 'no_target',
      reasonCode: 'no_target',
      targets: [],
    };
    return [{ ...command, disabledDetail: playerFacingBattleDisabledDetail(command) }];
  }
  return null;
}

export function beginInteractiveBattle(options) {
  const session = current.beginInteractiveBattle(options);
  initializeEquipmentBattleRuntime({ data: options.data, session });
  return session;
}

export function listInteractiveBattleCommands({ data, session }) {
  if (!session) return current.listInteractiveBattleCommands({ data, session });
  const noTarget = staleNoTargetCommand(session);
  if (noTarget) return noTarget;
  const transformed = transformedData(data, session);
  return current.listInteractiveBattleCommands({ data: transformed.data, session })
    .map((command) => decorate(command, command.skillId ? transformed.blockedReasons.get(command.skillId) : null));
}

export function resolveInteractiveBattleRound({ data, session, command }) {
  if (!session) return current.resolveInteractiveBattleRound({ data, session, command });
  const displayed = listInteractiveBattleCommands({ data, session }).find((entry) => entry.actionId === command?.actionId);
  if (displayed && !displayed.available) return { ok: false, reason: displayed.disabledReason ?? 'action_unavailable', session };
  const skillId = skillIdFromActionId(command?.actionId);
  const transformed = transformedData(data, session);
  const blockedReason = skillId ? transformed.blockedReasons.get(skillId) : null;
  if (blockedReason) return { ok: false, reason: publicReason(blockedReason), session };
  const output = current.resolveInteractiveBattleRound({ data: transformed.data, session, command });
  if (!output?.ok) {
    if (output?.reason) output.reason = publicReason(output.reason);
    return output;
  }
  if (!output.session) return output;
  if (skillId) applyCheckpointCClosureSuccess({ originalSkill: data.playerSkillById.get(skillId), session: output.session, round: output.round });
  applyEquipmentRoundRuntime({ data, session: output.session, round: output.round });
  if (output.session.status === 'active') output.commands = listInteractiveBattleCommands({ data, session: output.session });
  syncResult(output);
  return output;
}
