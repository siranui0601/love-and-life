// Checkpoint D canonical Formation semantics (TRPG 総合設計書 §27, 2026-08-24).
// This layer intentionally owns formation identity/lifecycle only. It does not
// invent per-formation collapse effects or final SKL-1108 balance multipliers.

export const FORMATION_RUNTIME_VERSION = 'checkpoint-d-formation-v1';

export const FORMATION_FAMILY_BY_SKILL_ID = Object.freeze({
  'SKL-0637': 'fire',
  'SKL-0638': 'ice',
  'SKL-0639': 'thunder',
  'SKL-0640': 'wind',
  'SKL-0641': 'earth',
  'SKL-0642': 'water',
  'SKL-0643': 'poison',
  'SKL-0644': 'illusion',
  'SKL-0645': 'anti_magic',
  'SKL-0646': 'water',
  'SKL-0647': 'seal',
  'SKL-0648': 'holy',
  'SKL-0649': 'curse',
  'SKL-0650': 'blast',
  'SKL-0651': 'delay',
  'SKL-0652': 'mirror',
  'SKL-0656': 'fire',
  'SKL-0657': 'seal',
  'SKL-0658': 'world_tree',
});

export const FORMATION_CREATOR_SKILL_IDS = new Set(Object.keys(FORMATION_FAMILY_BY_SKILL_ID));
export const FORMATION_CONTROL_SKILL_IDS = new Set(['SKL-0653', 'SKL-0654']);

const controlActionPattern = /^FORMATION:(DOUBLE|BREAK):([^:]+)(?::(EXTEND|AMPLIFY))?$/u;

export function formationFamilyForSkillId(skillId) {
  return FORMATION_FAMILY_BY_SKILL_ID[String(skillId)] ?? null;
}

export function isMagicFormationCreatorSkillId(skillId) {
  return FORMATION_CREATOR_SKILL_IDS.has(String(skillId));
}

export function isMagicFormation(field) {
  return Boolean(field && field.fieldKind === 'magicFormation' && field.active !== false && Number(field.remainingTurns ?? 0) > 0);
}

function legacyRemainingTurns(field, turn) {
  if (Number.isFinite(Number(field.remainingTurns))) return Math.max(0, Number(field.remainingTurns));
  if (Number.isFinite(Number(field.expiresAfterTurn))) return Math.max(0, Number(field.expiresAfterTurn) - Number(turn));
  return Math.max(1, Number(field.durationTurns ?? 1));
}

export function normalizeFormationRuntime(session, data = null) {
  const runtime = session?.playerRuntimeMechanics;
  if (!runtime) return session;
  runtime.fields ??= [];
  runtime.formationVersion = FORMATION_RUNTIME_VERSION;
  const turn = Number(session?.state?.turn ?? 0);
  runtime.fields = runtime.fields.flatMap((field) => {
    const sourceSkillId = String(field?.sourceSkillId ?? '');
    // 二重陣/陣崩し are controls, never formation instances. Remove legacy
    // C-era marker objects if an older pending battle contains one.
    if (FORMATION_CONTROL_SKILL_IDS.has(sourceSkillId)) return [];
    if (!isMagicFormationCreatorSkillId(sourceSkillId)) return [field];
    const family = formationFamilyForSkillId(sourceSkillId);
    const remainingTurns = legacyRemainingTurns(field, turn);
    if (remainingTurns <= 0) return [];
    const skill = data?.playerSkillById?.get?.(sourceSkillId);
    return [{
      ...field,
      owner: field.owner ?? 'player',
      kind: field.kind ?? 'magic_circle', // compatibility with Checkpoint C storage
      fieldKind: 'magicFormation',
      sourceSkillId,
      sourceSkillName: field.sourceSkillName ?? skill?.name ?? sourceSkillId,
      formationFamily: family,
      remainingTurns,
      enhancementLevel: Math.max(0, Number(field.enhancementLevel ?? 0)),
      dualFormationApplied: Boolean(field.dualFormationApplied),
      concentrationRequired: Boolean(field.concentrationRequired ?? false),
      breakable: field.breakable !== false,
      collapseEffect: field.collapseEffect ?? null,
      pendingDelayedEffect: field.pendingDelayedEffect ?? (sourceSkillId === 'SKL-0650'
        ? { sourceSkillId, status: 'pending', trigger: 'formation_expiry' }
        : null),
      active: true,
      type: family ?? field.type ?? 'arcane',
    }];
  });
  return session;
}

export function activeMagicFormations(session, { owner = null } = {}) {
  normalizeFormationRuntime(session);
  return (session?.playerRuntimeMechanics?.fields ?? []).filter((field) => (
    isMagicFormation(field) && (owner == null || field.owner === owner)
  ));
}

export function activeOwnedMagicFormations(session) {
  return activeMagicFormations(session, { owner: 'player' });
}

export function formationByInstanceId(session, instanceId) {
  return activeMagicFormations(session).find((field) => field.instanceId === instanceId) ?? null;
}

export function sameSourceFormation(session, sourceSkillId) {
  return activeOwnedMagicFormations(session).find((field) => field.sourceSkillId === sourceSkillId) ?? null;
}

export function prepareFormationSession(session, data = null) {
  const prepared = structuredClone(session);
  normalizeFormationRuntime(prepared, data);
  return prepared;
}

export function shieldNonFormationFieldsForDetonation(session) {
  for (const field of session?.playerRuntimeMechanics?.fields ?? []) {
    if (isMagicFormation(field)) continue;
    if (field.owner !== 'player' || field.kind !== 'magic_circle') continue;
    field.__formationOriginalKind = field.kind;
    field.kind = 'non_formation';
  }
  return session;
}

export function restoreShieldedNonFormationFields(session) {
  for (const field of session?.playerRuntimeMechanics?.fields ?? []) {
    if (!field.__formationOriginalKind) continue;
    field.kind = field.__formationOriginalKind;
    delete field.__formationOriginalKind;
  }
  return session;
}

function baseFormationCommandUsable(base) {
  if (!base) return false;
  return base.available !== false || base.disabledReason === 'conditions_not_met' || base.reasonCode === 'conditions_not_met';
}

function formationLabel(field) {
  return `${field.sourceSkillName ?? field.sourceSkillId}【展開中・残り${Math.max(0, Number(field.remainingTurns ?? 0))}T${Number(field.enhancementLevel ?? 0) > 0 ? `・増幅${Number(field.enhancementLevel)}段階` : ''}】`;
}

export function decorateFormationCommands({ data, session, commands }) {
  normalizeFormationRuntime(session, data);
  const formations = activeOwnedMagicFormations(session);
  const output = [];
  for (const command of commands) {
    if (!command?.skillId) { output.push(command); continue; }
    const skillId = command.skillId;
    if (isMagicFormationCreatorSkillId(skillId)) {
      const existing = sameSourceFormation(session, skillId);
      if (!existing) { output.push(command); continue; }
      output.push({
        ...command,
        available: false,
        disabledReason: 'formation_already_active',
        reasonCode: 'formation_already_active',
        disabledDetail: `同じ陣は同時に複数展開できない（残り${existing.remainingTurns}T）`,
        targets: [],
      });
      continue;
    }
    if (skillId === 'SKL-0653') {
      if (!baseFormationCommandUsable(command)) { output.push(command); continue; }
      const eligible = formations.filter((field) => !field.dualFormationApplied);
      if (!eligible.length) {
        output.push({ ...command, available: false, disabledReason: 'formation_target_unavailable', reasonCode: 'formation_target_unavailable', disabledDetail: '二重陣をまだ使用していない自分の陣がない', targets: [] });
        continue;
      }
      for (const field of eligible) {
        output.push({ ...command, actionId: `FORMATION:DOUBLE:${field.instanceId}:EXTEND`, name: `二重陣：${field.sourceSkillName ?? field.sourceSkillId}を延長`, description: `${formationLabel(field)}を2T延長する。`, target: 'none', targets: [], formationInstanceId: field.instanceId, formationMode: 'extend' });
        output.push({ ...command, actionId: `FORMATION:DOUBLE:${field.instanceId}:AMPLIFY`, name: `二重陣：${field.sourceSkillName ?? field.sourceSkillId}を増幅`, description: `${formationLabel(field)}を1段階増幅する。`, target: 'none', targets: [], formationInstanceId: field.instanceId, formationMode: 'amplify' });
      }
      continue;
    }
    if (skillId === 'SKL-0654') {
      if (!baseFormationCommandUsable(command)) { output.push(command); continue; }
      const all = activeMagicFormations(session);
      if (!all.length) {
        output.push({ ...command, available: false, disabledReason: 'formation_target_unavailable', reasonCode: 'formation_target_unavailable', disabledDetail: '解除できる陣がない', targets: [] });
        continue;
      }
      for (const field of all) {
        const allowed = field.owner === 'player' || field.breakable === true;
        output.push({
          ...command,
          actionId: `FORMATION:BREAK:${field.instanceId}`,
          name: `陣崩し：${field.sourceSkillName ?? field.sourceSkillId}`,
          description: allowed ? `${formationLabel(field)}を解除する。` : `${formationLabel(field)}は解除できない。`,
          available: allowed,
          disabledReason: allowed ? null : 'formation_unbreakable',
          reasonCode: allowed ? null : 'formation_unbreakable',
          disabledDetail: allowed ? null : 'この陣は陣崩しでは解除できない',
          target: 'none',
          targets: [],
          formationInstanceId: field.instanceId,
        });
      }
      continue;
    }
    output.push(command);
  }
  return output;
}

export function parseFormationControlAction(actionId) {
  const match = String(actionId ?? '').match(controlActionPattern);
  if (!match) return null;
  return {
    type: match[1] === 'DOUBLE' ? 'double' : 'break',
    instanceId: match[2],
    mode: match[3] === 'EXTEND' ? 'extend' : match[3] === 'AMPLIFY' ? 'amplify' : null,
    skillId: match[1] === 'DOUBLE' ? 'SKL-0653' : 'SKL-0654',
  };
}

export function validateFormationControl(session, control) {
  if (!control) return { ok: true };
  const field = formationByInstanceId(session, control.instanceId);
  if (!field) return { ok: false, reason: 'formation_target_unavailable' };
  if (control.type === 'double') {
    if (field.owner !== 'player') return { ok: false, reason: 'formation_not_owned' };
    if (field.dualFormationApplied) return { ok: false, reason: 'formation_already_enhanced' };
    if (!['extend', 'amplify'].includes(control.mode)) return { ok: false, reason: 'formation_mode_invalid' };
  } else if (control.type === 'break') {
    if (field.owner !== 'player' && field.breakable !== true) return { ok: false, reason: 'formation_unbreakable' };
  }
  return { ok: true, field };
}

export function translateFormationControlCommand({ baseCommands, control }) {
  if (!control) return null;
  const base = baseCommands.find((command) => command.skillId === control.skillId);
  if (!base || (!baseFormationCommandUsable(base) && base.available === false)) return null;
  const target = base.targets?.[0];
  return { actionId: base.actionId, ...(target ? { targetInstanceId: target.instanceId } : {}) };
}

export function removeLegacyControlFields(session) {
  const runtime = session?.playerRuntimeMechanics;
  if (!runtime?.fields) return;
  runtime.fields = runtime.fields.filter((field) => !FORMATION_CONTROL_SKILL_IDS.has(String(field?.sourceSkillId ?? '')));
}

export function applyFormationControlSuccess({ session, control }) {
  normalizeFormationRuntime(session);
  removeLegacyControlFields(session);
  const validation = validateFormationControl(session, control);
  if (!validation.ok) return { ok: false, reason: validation.reason };
  const runtime = session.playerRuntimeMechanics;
  const field = validation.field;
  const turn = Number(session.state?.turn ?? 0);
  if (control.type === 'double') {
    if (control.mode === 'extend') field.remainingTurns += 2;
    else field.enhancementLevel = Math.max(0, Number(field.enhancementLevel ?? 0)) + 1;
    field.dualFormationApplied = true;
    field.expiresAfterTurn = turn + field.remainingTurns;
    const event = { type: 'formation_control', family: 'DOUBLE_FORMATION', skillId: 'SKL-0653', formationInstanceId: field.instanceId, mode: control.mode, remainingTurns: field.remainingTurns, enhancementLevel: field.enhancementLevel };
    runtime.events ??= [];
    runtime.events.push({ turn, ...event });
    return { ok: true, event };
  }
  const cancelledPendingEffect = field.pendingDelayedEffect?.status === 'pending' ? field.pendingDelayedEffect : null;
  runtime.fields = runtime.fields.filter((entry) => entry.instanceId !== field.instanceId);
  const event = { type: 'formation_control', family: 'BREAK_FORMATION', skillId: 'SKL-0654', formationInstanceId: field.instanceId, owner: field.owner, collapseEffect: field.collapseEffect ?? null, cancelledPendingEffect: cancelledPendingEffect ? { ...cancelledPendingEffect, status: 'cancelled' } : null };
  runtime.events ??= [];
  runtime.events.push({ turn, ...event });
  return { ok: true, event };
}

export function advanceFormationRoundEnd(session, previousFormationIds = new Set(), data = null) {
  normalizeFormationRuntime(session, data);
  const runtime = session?.playerRuntimeMechanics;
  if (!runtime?.fields) return [];
  const turn = Number(session.state?.turn ?? 0);
  const expired = [];
  runtime.fields = runtime.fields.flatMap((field) => {
    if (!isMagicFormation(field)) return [field];
    if (previousFormationIds.has(field.instanceId)) field.remainingTurns = Math.max(0, Number(field.remainingTurns) - 1);
    // New legacy fields are normalized from expiresAfterTurn-currentTurn, which
    // already represents the canonical post-round remaining count.
    field.expiresAfterTurn = turn + Number(field.remainingTurns);
    if (field.remainingTurns > 0) return [field];
    expired.push({ ...field });
    return [];
  });
  return expired;
}

export function clearFormationsOnBattleEnd(session) {
  const runtime = session?.playerRuntimeMechanics;
  if (!runtime?.fields || session?.status === 'active') return [];
  const cleared = runtime.fields.filter((field) => field?.fieldKind === 'magicFormation');
  runtime.fields = runtime.fields.filter((field) => field?.fieldKind !== 'magicFormation');
  return cleared;
}

export function enrichDetonationEvent({ session, consumedBefore }) {
  const runtime = session?.playerRuntimeMechanics;
  if (!runtime) return null;
  const consumed = consumedBefore.filter((field) => !(runtime.fields ?? []).some((entry) => entry.instanceId === field.instanceId));
  if (!consumed.length) return null;
  const families = [...new Set(consumed.map((field) => field.formationFamily).filter(Boolean))].sort();
  const cancelledPendingEffects = consumed
    .filter((field) => field.pendingDelayedEffect?.status === 'pending')
    .map((field) => ({ ...field.pendingDelayedEffect, formationInstanceId: field.instanceId, status: 'cancelled' }));
  const canonical = {
    consumedFormationIds: consumed.map((field) => field.instanceId),
    instanceCount: consumed.length,
    formationFamilies: families,
    uniqueFormationFamilyCount: families.length,
    enhancementLevels: consumed.map((field) => Number(field.enhancementLevel ?? 0)),
    cancelledPendingEffects,
  };
  const event = [...(runtime.events ?? [])].reverse().find((entry) => entry?.family === 'CONSUME_OWNED_FIELD' && entry?.skillId === 'SKL-1108');
  if (event) Object.assign(event, canonical);
  return canonical;
}

export function formationObservationCommands(session) {
  const formations = activeOwnedMagicFormations(session);
  if (!formations.length) return [];
  return [{
    actionId: 'INFO:FORMATIONS:PLAYER',
    kind: 'info',
    skillId: null,
    name: '展開中の魔法陣',
    description: formations.map(formationLabel).join(' / '),
    available: false,
    disabledReason: 'battle_info',
    disabledDetail: '観測情報（選択する行動ではない）',
    targets: [],
  }];
}

export function formationCertificationSnapshot(session) {
  return activeMagicFormations(session).map((field) => ({
    instanceId: field.instanceId,
    owner: field.owner,
    sourceSkillId: field.sourceSkillId,
    formationFamily: field.formationFamily,
    remainingTurns: field.remainingTurns,
    enhancementLevel: field.enhancementLevel,
    dualFormationApplied: field.dualFormationApplied,
    breakable: field.breakable,
    pendingDelayedEffect: field.pendingDelayedEffect,
  }));
}
