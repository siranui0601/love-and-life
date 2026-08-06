import * as base from "./authored-mission-flow-registry-t17-presented.js";
import * as state from "./authored-mission-flow-t18-state.js";
import { T18_MACHINE_COLOSSUS_PACK as P } from "./authored/missions/t18-machine-colossus.js";

export * from "./authored-mission-flow-t18-state.js";

const F = Object.freeze;
const {
  available,
  step,
  leadById,
  ensure18,
  evidenceGroups,
  actionId,
  openingActions,
  navigatorFocuses,
  focusActions,
  groupActions,
  routeActions,
  evidenceAction,
  selectedLeadActions,
} = state.T18_STATE_INTERNALS;

function variantMatches(runtime, variant) {
  if (variant.flagKey && !(runtime?.playerState?.worldFlags ?? {})[variant.flagKey]) return false;
  return !(variant.troubleConditions ?? []).some((condition) =>
    !(condition.troubleStatuses ?? []).includes(
      runtime?.playerState?.troubles?.[condition.troubleId]?.status,
    ));
}

export function resolveAuthoredMissionFlowExtensionChoice(runtime, choiceEntry, requested = null) {
  if (!P.resolution.choices.some((route) => route.id === choiceEntry?.id)) {
    return base.resolveAuthoredMissionFlowExtensionChoice(runtime, choiceEntry, requested);
  }
  const variant = requested
    ? choiceEntry.contextVariants?.find((entry) => entry.contextId === requested)
    : choiceEntry.contextVariants?.find((entry) => variantMatches(runtime, entry));
  return variant
    ? {
        ...choiceEntry,
        ...variant,
        id: choiceEntry.id,
        worldEffect: { ...choiceEntry.worldEffect, ...variant.worldEffect },
      }
    : choiceEntry;
}

function rawReadiness(runtime, route) {
  const flow = ensure18(runtime);
  const acquired = new Set(flow.evidenceIds);
  const contract = route.readiness;
  const supporting = contract.supportingEvidenceIds ?? [];
  const openingMatches = (contract.openingChoiceIds ?? []).includes(flow.openingChoiceId);
  const core = contract.requiredEvidenceGroups ?? evidenceGroups();
  const missingCoreGroups = core.filter((group) => !group.some((id) => acquired.has(id)));
  const supportCount = supporting.filter((id) => acquired.has(id)).length
    + (openingMatches ? contract.openingSupport ?? 1 : 0);
  const openingOverrideEvidenceCount = evidenceGroups().length + 1;
  const missingIds = [
    ...missingCoreGroups.flat(),
    ...supporting.filter((id) => !acquired.has(id)),
  ];
  const missingLeads = [...new Set(missingIds)]
    .map((id) => P.investigation.leads.find((lead) => lead.discoveryId === id))
    .filter(Boolean);
  return {
    routeId: route.id,
    coreReady: missingCoreGroups.length === 0,
    openingReady: openingMatches || acquired.size >= openingOverrideEvidenceCount,
    openingMatches,
    openingOverrideEvidenceCount,
    supportCount,
    minimumSupport: contract.minimumSupport,
    requiredCoreCount: core.length,
    satisfiedCoreCount: core.length - missingCoreGroups.length,
    missingCoreGroups,
    missingLeads,
    evidenceCount: acquired.size,
  };
}

function dominantRoute(runtime) {
  const flow = ensure18(runtime);
  return P.resolution.choices
    .map((route, index) => {
      const readiness = rawReadiness(runtime, route);
      return {
        route,
        readiness,
        score: readiness.supportCount
          + (readiness.openingMatches ? 2 : 0)
          + (route.readiness.supportingEvidenceIds.indexOf(flow.evidenceIds[0]) >= 0 ? 0.25 : 0),
        index,
      };
    })
    .sort((left, right) =>
      right.score - left.score || left.index - right.index)[0];
}

function readiness(runtime, routeId) {
  const route = P.resolution.choices.find((entry) => entry.id === routeId);
  if (!route) return { ready: false, missingLeads: [] };
  const state = rawReadiness(runtime, route);
  const dominant = dominantRoute(runtime);
  return {
    ...state,
    dominantRouteId: dominant.route.id,
    ready: state.coreReady
      && state.openingReady
      && state.supportCount >= state.minimumSupport
      && dominant.route.id === routeId,
  };
}

export function authoredMissionFlowExtensionResolutionReadiness(runtime, routeId) {
  return P.resolution.choices.some((route) => route.id === routeId)
    ? readiness(runtime, routeId)
    : base.authoredMissionFlowExtensionResolutionReadiness(runtime, routeId);
}

const corroborationLead = (runtime, state) =>
  state.missingLeads[0]
  ?? P.investigation.leads.find((lead) =>
    !new Set(ensure18(runtime).evidenceIds).has(lead.discoveryId))
  ?? null;

function preparationAction(runtime, route, state) {
  const lead = corroborationLead(runtime, state);
  return {
    id: actionId("RESOLUTION_PREPARATION", route.id),
    family: "prepare",
    type: "plan",
    effectKind: "prepare_authored_mission_resolution",
    missionId: P.missionId,
    stepId: P.investigation.stepId,
    missionTitle: P.title,
    missionTroubleId: P.troubleId,
    minutes: route.readiness.preparationMinutes,
    label: `${route.readiness.preparationLabel}（成立根拠${state.supportCount}/${state.minimumSupport}`
      + `・必須条件${state.satisfiedCoreCount}/${state.requiredCoreCount}`
      + `${state.openingReady ? "" : "・方針転換には七件目"}）`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: P.id,
    authoredMissionFlowKind: "resolution_preparation",
    authoredMissionFlowResolutionRouteId: route.id,
    authoredMissionFlowLeadId: lead?.id ?? null,
  };
}

function resolutionActions(runtime, current) {
  if (current.targetFacilityId
    && runtime.playerState.player.facilityId !== current.targetFacilityId) return null;
  return P.resolution.choices.map((route) => {
    const state = readiness(runtime, route.id);
    if (!state.ready) return preparationAction(runtime, route, state);
    const resolved = resolveAuthoredMissionFlowExtensionChoice(runtime, route);
    return {
      id: actionId("RESOLUTION", route.id),
      family: "help",
      type: "resolveMission",
      missionId: P.missionId,
      stepId: P.resolution.stepId,
      missionTitle: P.title,
      missionTroubleId: P.troubleId,
      minutes: resolved.minutes,
      label: resolved.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "resolution",
      authoredMissionFlowResolutionRouteId: route.id,
      authoredMissionFlowResolutionContextVariantId: resolved.contextId ?? null,
      authoredMissionFlowSceneTransition: resolved.sceneTransition,
    };
  });
}

const INTERVENTIONS = F([
  F({
    id: "rebind_root_threads_before_full_activation",
    label: "残存根糸を保守座へ先に結び、完全起動前の封印荷重を戻す",
    minutes: 72,
    summary: "残存根糸、結界片、神殿保守座を先に接続した。巨神兵は武装展開前に保守姿勢へ戻り、巡礼路の退避も完了した。",
    sceneTransition: "エルフ避難枝道の根糸編みから神殿地下の保守座、閉じる避難隔壁、消灯する巨神兵の警告灯へ場面が移る",
  }),
  F({
    id: "preinstall_governor_lock_and_cooling",
    label: "四点固定杭と三段調速錠を先付けし、炉心を保守温度へ落とす",
    minutes: 76,
    summary: "四点固定杭で姿勢補正を遅らせ、左脚へ調速錠を接続し、左右の冷却溝を開いた。機体を壊さず歩行出力を停止した。",
    sceneTransition: "神殿地盤の固定杭から左脚の調速錠、胸部冷却溝、格納区へ戻る整備子機へ場面が連続する",
  }),
  F({
    id: "isolate_march_directive_and_keep_capital_force",
    label: "王都進軍指令だけを隔離し、三者鍵を分けたまま王都主力を残す",
    minutes: 79,
    summary: "中央炉位置の誤認だけを命令板から隔離し、神殿・エルフ・ドワーフへ三者鍵を分けた。王都軍は神殿へ誤派兵されずT19防衛へ残った。",
    sceneTransition: "神殿命令板から王城の派兵撤回、三者鍵の保守卓、王都へ戻る主力部隊へ場面が転換する",
  }),
]);

function interventionActions(runtime, current) {
  const day = Number(runtime.playerState.day ?? Math.floor(
    Number(runtime.playerState.absoluteMinute ?? 0) / 1440,
  ));
  if (day >= P.battle.fullActivationDay) return null;
  if (current.targetFacilityId
    && runtime.playerState.player.facilityId !== current.targetFacilityId) return null;
  return INTERVENTIONS.map((intervention) => ({
    id: actionId("INTERVENTION", intervention.id),
    family: "help",
    type: "plan",
    missionId: P.missionId,
    stepId: P.battle.stepId,
    missionTitle: P.title,
    missionTroubleId: P.troubleId,
    minutes: intervention.minutes,
    label: intervention.label,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: P.id,
    authoredMissionFlowKind: "intervention",
    authoredMissionFlowInterventionChoiceId: intervention.id,
    authoredMissionFlowSceneTransition: intervention.sceneTransition,
  }));
}

function exclusive18(runtime, context = {}) {
  if (!available(runtime)) return null;
  const flow = ensure18(runtime);
  const currentMinute = Number(runtime.playerState.absoluteMinute ?? 0);
  if (Number(flow.deferredUntilMinute ?? 0) > currentMinute) return null;
  const current = step(runtime);
  if (!current) return null;
  const selected = selectedLeadActions(runtime, flow, context.movementActions ?? []);
  if (selected) return selected;
  const opening = openingActions(runtime);
  if (opening) return opening;
  if (current.id === P.resolution.stepId) return resolutionActions(runtime, current);
  if (current.id === P.battle.stepId) return interventionActions(runtime, current);
  if (current.id !== P.investigation.stepId || !flow.openingChoiceId) return null;
  if (!flow.navigatorFocusId) return focusActions(flow);
  if (!flow.navigatorGroupId) return groupActions(flow);
  return routeActions(flow);
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return exclusive18(runtime, context)
    ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowEvidenceAction(runtime) {
  const flow = available(runtime) ? ensure18(runtime) : null;
  const lead = flow ? leadById(flow.selectedLeadId) : null;
  return (lead ? evidenceAction(runtime, lead) : null)
    ?? base.authoredMissionFlowEvidenceAction(runtime);
}

export const T18_CORE_INTERNALS = F({
  ...state.T18_STATE_INTERNALS,
  navigatorFocuses,
  readiness,
  interventions: INTERVENTIONS,
});
