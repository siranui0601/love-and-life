import * as base from './player-journey-base.mjs';
import { grantEventSkillFromProducer as grantStructuredEventSkill } from './player-skill-acquisition-checkpoint-c.mjs';
import { applyEquipmentBattleVictoryGold, applyEquipmentWorldActionEffects, syncEquipmentWorldRuntime } from './player-equipment-runtime.mjs';

export * from './player-journey-base.mjs';

export const PLAYER_SKILL_UI_STATES = Object.freeze(['HIDDEN','REVEALED_LOCKED','LEARNABLE','LEARNED','EQUIPMENT_ONLY','EVENT_ONLY']);

const PHASE_MINUTE_OF_DAY = Object.freeze([600, 840, 1080, 1320]);
const TERMINAL_TROUBLE_STATES = new Set(['resolved', 'failed', 'suppressed']);

function permanentUiState(candidate) {
  if (candidate?.reasons?.includes('already_learned')) return 'LEARNED';
  if (candidate?.reasons?.includes('not_visible')) return candidate?.acquisitionCode === 'basic_level_up' ? 'REVEALED_LOCKED' : 'HIDDEN';
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

function resourceRatio(value, fallback = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
}

function exactResourceScaledBuild(prepared, state) {
  if (!prepared?.scaledBuild || !prepared?.fullBuild) return prepared?.scaledBuild;
  const hpRatio = resourceRatio(state?.player?.hpRatio, 1);
  const mpRatio = resourceRatio(state?.player?.mpRatio, 1);
  const maxHp = Math.max(1, Number(prepared.fullBuild.maxHp ?? prepared.scaledBuild.maxHp ?? 1));
  const maxMp = Math.max(0, Number(prepared.fullBuild.maxMp ?? prepared.scaledBuild.maxMp ?? 0));
  return {
    ...prepared.scaledBuild,
    maxHp,
    maxMp,
    resourceMaxHp: maxHp,
    resourceMaxMp: maxMp,
    initialHp: maxHp * hpRatio,
    initialMp: maxMp * mpRatio,
  };
}

function postBattleResourceRatios(continuation, battleResult) {
  const actor = battleResult?.players?.[0];
  const scaledBuild = continuation?.prepared?.scaledBuild;
  if (!actor || !scaledBuild) return null;
  const actorHp = Math.max(0, Number(actor.hp ?? 0));
  const actorMp = Math.max(0, Number(actor.mp ?? 0));
  const battleMaxHp = Math.max(1, Number(actor.maxHp ?? scaledBuild.resourceMaxHp ?? scaledBuild.maxHp ?? 1));
  const battleMaxMp = Math.max(0, Number(actor.maxMp ?? scaledBuild.resourceMaxMp ?? scaledBuild.maxMp ?? 0));
  return {
    hpRatio: resourceRatio(actorHp / battleMaxHp, 0),
    mpRatio: battleMaxMp > 0 ? resourceRatio(actorMp / battleMaxMp, 0) : 0,
  };
}

function canonicalMoment(day, phase) {
  const dayNumber = Math.max(1, Number(day) || 1);
  const phaseIndex = Math.max(0, Math.min(3, Number(phase) || 0));
  return Math.max(0, (dayNumber - 1) * 1440 + PHASE_MINUTE_OF_DAY[phaseIndex] - 600);
}

function transitionAnchor(trouble, transition) {
  const reason = String(transition?.reason ?? '');
  if (reason === 'scheduled-onset' || reason === 'gate-closed') {
    return canonicalMoment(trouble.startDay, trouble.startPhase);
  }
  if (reason === 'rescue-window-missed' || reason === 'deadline-missed') {
    return canonicalMoment(trouble.deadlineDay, trouble.deadlinePhase);
  }
  if (reason === 'final-deadline-missed') {
    return canonicalMoment(trouble.finalDay, trouble.finalPhase);
  }
  return null;
}

// A player action may intentionally span several hours. The action itself still
// resolves once, but canonical world transitions crossed inside that interval
// happened at their own boundary, not at the action's ending timestamp. Keep the
// state/result deterministic while restoring those exact transition timestamps.
function normalizeCrossedTroubleTransitionAnchors(state, model, beforeMinute, transitionCounts, historyLengthBefore) {
  const afterMinute = Number(state?.absoluteMinute ?? beforeMinute);
  if (!(afterMinute > beforeMinute)) return 0;
  let changed = 0;
  const newHistory = Array.isArray(state?.history) ? state.history.slice(historyLengthBefore) : [];

  for (const trouble of model?.troubles ?? []) {
    const runtime = state?.troubles?.[trouble.id];
    if (!runtime || !Array.isArray(runtime.transitions)) continue;
    const start = Math.max(0, Number(transitionCounts?.[trouble.id] ?? 0));
    for (const transition of runtime.transitions.slice(start)) {
      const anchor = transitionAnchor(trouble, transition);
      if (!Number.isFinite(anchor) || anchor <= beforeMinute || anchor > afterMinute) continue;
      if (Number(transition.minute) !== afterMinute) continue;
      transition.minute = anchor;
      if (transition.to === 'active' && Number(runtime.activatedAt) === afterMinute) runtime.activatedAt = anchor;
      if (TERMINAL_TROUBLE_STATES.has(transition.to) && Number(runtime.terminalAt) === afterMinute) runtime.terminalAt = anchor;

      const transitionHistory = newHistory.find((entry) => entry?.type === 'TROUBLE_TRANSITION'
        && entry.troubleId === trouble.id
        && entry.from === transition.from
        && entry.to === transition.to
        && entry.reason === transition.reason
        && Number(entry.minute) === afterMinute);
      if (transitionHistory) transitionHistory.minute = anchor;

      const rumorId = `RUM-${trouble.id}-${transition.to}`;
      const rumor = state?.rumorById?.[rumorId]
        ?? state?.rumors?.find?.((entry) => entry?.id === rumorId)
        ?? null;
      if (rumor && Number(rumor.originMinute) === afterMinute) rumor.originMinute = anchor;
      const rumorHistory = newHistory.find((entry) => entry?.type === 'RUMOR_PUBLISHED'
        && entry.rumorId === rumorId
        && Number(entry.minute) === afterMinute);
      if (rumorHistory) rumorHistory.minute = anchor;
      changed += 1;
    }
  }
  return changed;
}

function transitionCounts(state) {
  return Object.fromEntries(Object.entries(state?.troubles ?? {}).map(([id, runtime]) => [
    id,
    Array.isArray(runtime?.transitions) ? runtime.transitions.length : 0,
  ]));
}

export function createInitialJourneyState(options) {
  const state = base.createInitialJourneyState(options);
  syncEquipmentWorldRuntime(state, options.battleData);
  return state;
}

export function listLearnablePlayerSkills(state, data, skills) {
  return base.listLearnablePlayerSkills(state, data, skills).map((candidate) => ({ ...candidate, state: permanentUiState(candidate) }));
}

export function listPlayerSkillStates(state, data, skills) {
  syncEquipmentWorldRuntime(state, data);
  const permanent = new Map(listLearnablePlayerSkills(state, data, skills).map((entry) => [entry.id, entry]));
  const equipmentGranted = equippedGrantedSkillIds(state, data);
  const learned = state?.player?.skills instanceof Set ? state.player.skills : new Set(state?.player?.skills ?? []);
  const visible = state?.player?.visibleSkillIds instanceof Set ? state.player.visibleSkillIds : new Set(state?.player?.visibleSkillIds ?? []);
  const flagEligible = state?.player?.flagEligibleSkillIds instanceof Set ? state.player.flagEligibleSkillIds : new Set(state?.player?.flagEligibleSkillIds ?? []);
  return skills.filter((skill) => !['non_skill','deleted'].includes(skill.acquisitionCode)).map((skill) => {
    if (['basic_level_up','flag_unlocked'].includes(skill.acquisitionCode)) {
      const candidate=permanent.get(skill.id);
      const fallbackState=learned.has(skill.id)?'LEARNED':skill.acquisitionCode==='basic_level_up'?'REVEALED_LOCKED':(visible.has(skill.id)||flagEligible.has(skill.id))?'REVEALED_LOCKED':'HIDDEN';
      return {...candidate,id:skill.id,name:skill.name,acquisitionCode:skill.acquisitionCode,state:candidate?.state??fallbackState,learnable:Boolean(candidate?.learnable),active:learned.has(skill.id),persistentUnlocked:learned.has(skill.id)||visible.has(skill.id)||flagEligible.has(skill.id),reason:candidate?.reason??(fallbackState==='HIDDEN'?'not_visible':fallbackState==='LEARNED'?'already_learned':'requirements_unmet'),reasons:candidate?.reasons??[fallbackState==='HIDDEN'?'not_visible':fallbackState==='LEARNED'?'already_learned':'requirements_unmet']};
    }
    if(skill.acquisitionCode==='event_granted'){
      const granted=learned.has(skill.id);return{id:skill.id,name:skill.name,acquisitionCode:skill.acquisitionCode,state:granted?'LEARNED':'EVENT_ONLY',learnable:false,active:granted,persistentUnlocked:granted,reason:granted?'already_learned':'event_only',reasons:[granted?'already_learned':'event_only']};
    }
    const active=equipmentGranted.has(skill.id);return{id:skill.id,name:skill.name,acquisitionCode:skill.acquisitionCode,state:'EQUIPMENT_ONLY',learnable:false,active,persistentUnlocked:false,reason:active?'equipment_grant_active':'equipment_not_equipped',reasons:[active?'equipment_grant_active':'equipment_not_equipped']};
  }).sort((left,right)=>left.id.localeCompare(right.id));
}

export function grantEventSkillFromProducer(state, data, skills, skillId, producerId) {
  const result=grantStructuredEventSkill(state,skills,skillId,producerId);if(!result.ok)return result;
  if(!(state.player.visibleSkillIds instanceof Set))state.player.visibleSkillIds=new Set(state.player.visibleSkillIds??[]);state.player.visibleSkillIds.add(skillId);return result;
}

export function beginInteractiveBattleAction(state, model, data, skills, catalog, profileInput, action) {
  if (resourceRatio(state?.player?.hpRatio, 1) <= 0) {
    return {
      ok: false,
      reason: 'battle_unavailable_incapacitated',
      detail: 'HPが0です。救助または回復を受けてから戦闘へ入れます。',
    };
  }
  const output=base.beginInteractiveBattleAction(state,model,data,skills,catalog,profileInput,action);
  if(!output?.ok||!output.continuation?.prepared?.scaledBuild)return output;
  output.continuation.prepared.scaledBuild=exactResourceScaledBuild(output.continuation.prepared,state);
  const gold=Math.max(0,Math.floor(Number(state?.player?.gold??0)));
  output.continuation.prepared.scaledBuild={...output.continuation.prepared.scaledBuild,gold,inventory:structuredClone(state?.player?.inventory??{})};
  output.continuation.prepared.playerGoldBeforeBattle=gold;syncEquipmentWorldRuntime(state,data);return output;
}

export function settleInteractiveBattleAction(state, model, data, skills, catalog, profileInput, continuation, battleResult) {
  const actualResources=postBattleResourceRatios(continuation,battleResult);
  const runtime=battleResult?.playerRuntimeMechanics;const runtimeGold=Number(runtime?.gold);
  if(Number.isFinite(runtimeGold)&&runtimeGold>=0){const goldBefore=Math.max(0,Number(state?.player?.gold??0));const goldAfterCost=Math.max(0,Math.floor(runtimeGold));const spent=Math.max(0,goldBefore-goldAfterCost);state.player.gold=goldAfterCost;if(spent>0){state.progress.economy.goldSpent=Number(state.progress.economy.goldSpent??0)+spent;state.history.push({type:'BATTLE_GOLD_SPENT',minute:state.absoluteMinute,amount:spent,goldBefore,goldAfter:goldAfterCost});}}
  if(Array.isArray(runtime?.postBattleEffects)&&runtime.postBattleEffects.length){state.player.timedEffects??=[];for(const effect of runtime.postBattleEffects){const durationMinutes=Math.max(0,Number(effect.durationHours??0)*60);const persisted={...effect,startedMinute:state.absoluteMinute,expiresMinute:state.absoluteMinute+durationMinutes};state.player.timedEffects.push(persisted);state.history.push({type:'BATTLE_POST_EFFECT',minute:state.absoluteMinute,effect:persisted});}}
  const goldBeforeSettlement=Math.max(0,Number(state.player.gold??0));
  const defeatOrigin={
    location:state.player.location,
    facilityId:state.player.facilityId,
    absoluteMinute:state.absoluteMinute,
    historyLength:Array.isArray(state.history)?state.history.length:0,
  };
  const oldDefeatRecoveryMinutes=state.tuning?.defeatRecoveryMinutes;
  if(state.tuning) state.tuning.defeatRecoveryMinutes=0;
  let output;
  try { output=base.settleInteractiveBattleAction(state,model,data,skills,catalog,profileInput,continuation,battleResult); }
  finally {
    if(state.tuning){
      if(oldDefeatRecoveryMinutes===undefined) delete state.tuning.defeatRecoveryMinutes;
      else state.tuning.defeatRecoveryMinutes=oldDefeatRecoveryMinutes;
    }
  }
  if(output?.battle?.won&&actualResources){state.player.hpRatio=actualResources.hpRatio;state.player.mpRatio=actualResources.mpRatio;state.history.push({type:'BATTLE_RESOURCES_COMMITTED',minute:state.absoluteMinute,outcome:'victory',hpRatio:state.player.hpRatio,mpRatio:state.player.mpRatio});}
  else if(output?.battle?.fled&&actualResources){state.player.hpRatio=actualResources.hpRatio;state.player.mpRatio=actualResources.mpRatio;state.history.push({type:'BATTLE_RESOURCES_COMMITTED',minute:state.absoluteMinute,outcome:'fled',hpRatio:state.player.hpRatio,mpRatio:state.player.mpRatio});}
  else if(output?.battle&&!output.battle.won&&!output.battle.fled){
    const goldLoss=Math.max(0,goldBeforeSettlement-Math.max(0,Number(state.player.gold??0)));
    state.player.gold=goldBeforeSettlement;
    state.player.location=defeatOrigin.location;
    state.player.facilityId=defeatOrigin.facilityId;
    state.absoluteMinute=defeatOrigin.absoluteMinute;
    if(Array.isArray(state.history)){
      const retained=state.history.slice(defeatOrigin.historyLength).filter((entry)=>!['BATTLE_DEFEAT_RETURN','BATTLE_DEFEAT_RECOVERY'].includes(entry?.type));
      state.history.splice(defeatOrigin.historyLength,state.history.length-defeatOrigin.historyLength,...retained);
    }
    state.player.hpRatio=0;
    state.player.mpRatio=actualResources?.mpRatio ?? 0;
    state.player.pendingDefeatSettlement={
      version:'battle-defeat-rescue-v1',
      defeatedAtMinute:state.absoluteMinute,
      encounterId:continuation?.encounterId??output?.battle?.encounterId??null,
      recoveryHpRatio:0.35,
      recoveryMpRatio:0.2,
      goldLoss,
      goldBeforeLoss:goldBeforeSettlement,
    };
    state.history.push({type:'BATTLE_DEFEAT_INCAPACITATED',minute:state.absoluteMinute,location:state.player.location,facilityId:state.player.facilityId,hpRatio:0,mpRatio:state.player.mpRatio,gold:state.player.gold,pendingGoldLoss:goldLoss});
  }
  if(output?.battle?.won)applyEquipmentBattleVictoryGold({state,data,goldBeforeSettlement});
  syncEquipmentWorldRuntime(state,data);return output;
}

export function resolveMovementAction(state, model, data, skills, profileInput, action) {
  const minuteBefore=Number(state?.absoluteMinute??0);
  const historyLengthBefore=Array.isArray(state?.history)?state.history.length:0;
  const counts=transitionCounts(state);
  const output=base.resolveMovementAction(state,model,data,skills,profileInput,action);
  normalizeCrossedTroubleTransitionAnchors(state,model,minuteBefore,counts,historyLengthBefore);
  return output;
}

export function resolvePlayerAction(state, model, data, skills, catalog, profileInput, action) {
  const fatigueBefore=Number(state?.player?.needs?.fatigue??0);
  const minuteBefore=Number(state?.absoluteMinute??0);
  const historyLengthBefore=Array.isArray(state?.history)?state.history.length:0;
  const counts=transitionCounts(state);
  const output=base.resolvePlayerAction(state,model,data,skills,catalog,profileInput,action);
  normalizeCrossedTroubleTransitionAnchors(state,model,minuteBefore,counts,historyLengthBefore);
  applyEquipmentWorldActionEffects({state,data,action,fatigueBefore});
  syncEquipmentWorldRuntime(state,data);return output;
}

export const PLAYER_JOURNEY_RUNTIME_INTERNALS = Object.freeze({
  canonicalMoment,
  transitionAnchor,
  normalizeCrossedTroubleTransitionAnchors,
  transitionCounts,
});