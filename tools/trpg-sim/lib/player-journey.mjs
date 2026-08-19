import * as base from './player-journey-base.mjs';

export * from './player-journey-base.mjs';

export const PLAYER_SKILL_UI_STATES = Object.freeze([
  'HIDDEN',
  'REVEALED_LOCKED',
  'LEARNABLE',
  'LEARNED',
  'EQUIPMENT_ONLY',
  'EVENT_ONLY',
]);

function permanentUiState(candidate) {
  if (candidate?.reasons?.includes('already_learned')) return 'LEARNED';
  if (candidate?.reasons?.includes('not_visible')) {
    return candidate?.acquisitionCode === 'basic_level_up' ? 'REVEALED_LOCKED' : 'HIDDEN';
  }
  if (candidate?.learnable) return 'LEARNABLE';
  return 'REVEALED_LOCKED';
}

function equippedGrantedSkillIds(state, data) {
  const ids = new Set();
  for (const equipmentId of Object.values(state?.player?.equipment ?? {})) {
    const equipment = data?.equipmentById?.get?.(equipmentId);
    for (const skillId of [equipment?.grantedSkillId, ...(equipment?.grantedSkillIds ?? [])].filter(Boolean)) ids.add(skillId);
  }
  return ids;
}

export function listLearnablePlayerSkills(state, data, skills) {
  return base.listLearnablePlayerSkills(state, data, skills).map((candidate) => ({
    ...candidate,
    state: permanentUiState(candidate),
  }));
}

export function listPlayerSkillStates(state, data, skills) {
  const permanent = new Map(listLearnablePlayerSkills(state, data, skills).map((entry) => [entry.id, entry]));
  const equipmentGranted = equippedGrantedSkillIds(state, data);
  const learned = state?.player?.skills instanceof Set ? state.player.skills : new Set(state?.player?.skills ?? []);
  const visible = state?.player?.visibleSkillIds instanceof Set ? state.player.visibleSkillIds : new Set(state?.player?.visibleSkillIds ?? []);
  const flagEligible = state?.player?.flagEligibleSkillIds instanceof Set ? state.player.flagEligibleSkillIds : new Set(state?.player?.flagEligibleSkillIds ?? []);

  return skills
    .filter((skill) => !['non_skill', 'deleted'].includes(skill.acquisitionCode))
    .map((skill) => {
      if (['basic_level_up', 'flag_unlocked'].includes(skill.acquisitionCode)) {
        const candidate = permanent.get(skill.id);
        const fallbackState = learned.has(skill.id)
          ? 'LEARNED'
          : skill.acquisitionCode === 'basic_level_up'
            ? 'REVEALED_LOCKED'
            : (visible.has(skill.id) || flagEligible.has(skill.id))
              ? 'REVEALED_LOCKED'
              : 'HIDDEN';
        return {
          ...candidate,
          id: skill.id,
          name: skill.name,
          acquisitionCode: skill.acquisitionCode,
          state: candidate?.state ?? fallbackState,
          learnable: Boolean(candidate?.learnable),
          active: learned.has(skill.id),
          persistentUnlocked: learned.has(skill.id) || visible.has(skill.id) || flagEligible.has(skill.id),
          reason: candidate?.reason ?? (fallbackState === 'HIDDEN' ? 'not_visible' : fallbackState === 'LEARNED' ? 'already_learned' : 'requirements_unmet'),
          reasons: candidate?.reasons ?? [fallbackState === 'HIDDEN' ? 'not_visible' : fallbackState === 'LEARNED' ? 'already_learned' : 'requirements_unmet'],
        };
      }
      if (skill.acquisitionCode === 'event_granted') {
        const granted = learned.has(skill.id);
        return {
          id: skill.id,
          name: skill.name,
          acquisitionCode: skill.acquisitionCode,
          state: granted ? 'LEARNED' : 'EVENT_ONLY',
          learnable: false,
          active: granted,
          persistentUnlocked: granted,
          reason: granted ? 'already_learned' : 'event_only',
          reasons: [granted ? 'already_learned' : 'event_only'],
        };
      }
      const active = equipmentGranted.has(skill.id);
      return {
        id: skill.id,
        name: skill.name,
        acquisitionCode: skill.acquisitionCode,
        state: 'EQUIPMENT_ONLY',
        learnable: false,
        active,
        persistentUnlocked: false,
        reason: active ? 'equipment_grant_active' : 'equipment_not_equipped',
        reasons: [active ? 'equipment_grant_active' : 'equipment_not_equipped'],
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function beginInteractiveBattleAction(state, model, data, skills, catalog, profileInput, action) {
  const output = base.beginInteractiveBattleAction(state, model, data, skills, catalog, profileInput, action);
  if (!output?.ok || !output.continuation?.prepared?.scaledBuild) return output;
  const gold = Math.max(0, Math.floor(Number(state?.player?.gold ?? 0)));
  output.continuation.prepared.scaledBuild = {
    ...output.continuation.prepared.scaledBuild,
    gold,
    inventory: structuredClone(state?.player?.inventory ?? {}),
  };
  output.continuation.prepared.playerGoldBeforeBattle = gold;
  return output;
}

export function settleInteractiveBattleAction(state, model, data, skills, catalog, profileInput, continuation, battleResult) {
  const runtime = battleResult?.playerRuntimeMechanics;
  const runtimeGold = Number(runtime?.gold);
  if (Number.isFinite(runtimeGold) && runtimeGold >= 0) {
    const goldBefore = Math.max(0, Number(state?.player?.gold ?? 0));
    const goldAfterCost = Math.max(0, Math.floor(runtimeGold));
    const spent = Math.max(0, goldBefore - goldAfterCost);
    state.player.gold = goldAfterCost;
    if (spent > 0) {
      state.progress.economy.goldSpent = Number(state.progress.economy.goldSpent ?? 0) + spent;
      state.history.push({ type: 'BATTLE_GOLD_SPENT', minute: state.absoluteMinute, amount: spent, goldBefore, goldAfter: goldAfterCost });
    }
  }
  if (Array.isArray(runtime?.postBattleEffects) && runtime.postBattleEffects.length) {
    state.player.timedEffects ??= [];
    for (const effect of runtime.postBattleEffects) {
      const durationMinutes = Math.max(0, Number(effect.durationHours ?? 0) * 60);
      const persisted = { ...effect, startedMinute: state.absoluteMinute, expiresMinute: state.absoluteMinute + durationMinutes };
      state.player.timedEffects.push(persisted);
      state.history.push({ type: 'BATTLE_POST_EFFECT', minute: state.absoluteMinute, effect: persisted });
    }
  }
  return base.settleInteractiveBattleAction(state, model, data, skills, catalog, profileInput, continuation, battleResult);
}
