import * as base from "./authored-mission-flow-registry-t16-final.js";
import { T17_CAPITAL_SECOND_SUMMONING_PACK as P } from "./authored/missions/t17-capital-second-summoning.js";
import * as navigation from "./authored-mission-flow-t17-runtime-navigation.js";

export * from "./authored-mission-flow-t17-runtime-navigation.js";

const F = Object.freeze;
const {
  available,
  step,
  leadById,
  ensure17,
  actionId,
  groups,
} = navigation.T17_RUNTIME_STATE_INTERNALS;
const {
  openingActions,
  navigatorFocuses,
  focusActions,
  groupActions,
  routeActions,
  evidenceAction,
  selectedLeadActions,
} = navigation.T17_RUNTIME_NAVIGATION_INTERNALS;

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
  const flow = ensure17(runtime);
  const acquired = new Set(flow.evidenceIds);
  const contract = route.readiness;
  const supporting = contract.supportingEvidenceIds ?? [];
  const openingMatches = (contract.openingChoiceIds ?? []).includes(flow.openingChoiceId);
  const core = contract.requiredEvidenceGroups ?? groups();
  const missingCoreGroups = core.filter((group) => !group.some((id) => acquired.has(id)));
  const supportCount = supporting.filter((id) => acquired.has(id)).length
    + (openingMatches ? contract.openingSupport ?? 1 : 0);
  const openingOverrideEvidenceCount = groups().length + 1;
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
  const flow = ensure17(runtime);
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
    !new Set(ensure17(runtime).evidenceIds).has(lead.discoveryId))
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
    id: "freeze_outer_circle_and_publish_order",
    label: "外円と資材搬入を凍結し、勅許撤回まで術者を退避させる",
    minutes: 58,
    summary: "外円を物理封鎖し、触媒搬入を止め、術者と下層住民を先に退避させた。儀式は戦闘を起こさず停止段階へ入った。",
    sceneTransition: "魔術塔の外円から資材門、王城の停止命令掲示、地下避難列へ場面が移る",
  }),
  F({
    id: "prepare_phase_reversal_and_preserve_matrix",
    label: "位相反転鍵を配置し、Day1対象簿と原術式を別庫へ保全する",
    minutes: 62,
    summary: "反転鍵を三点へ置き、Day1対象簿と原術式を焼却命令から外した。門を閉じる準備と証拠保全が同時に整った。",
    sceneTransition: "術式中心から反転鍵の三点、記録庫、地下隔壁の操作卓へ場面が切り替わる",
  }),
  F({
    id: "decouple_temple_and_ground_surplus",
    label: "神殿共鳴線を切り、黒嶺接地石へ余剰魔力を逃がす",
    minutes: 67,
    summary: "神殿共鳴線を召喚円から外し、余剰魔力の逃げ道を接地石へ切り替えた。巨神兵防衛線を動かさず儀式を停止した。",
    sceneTransition: "王都地下の共鳴線から古代神殿の共鳴板、黒嶺接地石、巨神兵格納区の独立監視へ場面が転換する",
  }),
]);

function interventionActions(runtime, current) {
  const day = Number(runtime.playerState.day ?? Math.floor(
    Number(runtime.playerState.absoluteMinute ?? 0) / 1440,
  ));
  if (day >= P.battle.preRitualDeadlineDay) return null;
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

function exclusive17(runtime, context = {}) {
  if (!available(runtime)) return null;
  const flow = ensure17(runtime);
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
  return exclusive17(runtime, context)
    ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowEvidenceAction(runtime) {
  const flow = available(runtime) ? ensure17(runtime) : null;
  const lead = flow ? leadById(flow.selectedLeadId) : null;
  return (lead ? evidenceAction(runtime, lead) : null)
    ?? base.authoredMissionFlowEvidenceAction(runtime);
}


export const T17_RUNTIME_CORE_INTERNALS = F({
  ...navigation.T17_RUNTIME_STATE_INTERNALS,
  navigatorFocuses,
  readiness,
  interventions: INTERVENTIONS,
});
