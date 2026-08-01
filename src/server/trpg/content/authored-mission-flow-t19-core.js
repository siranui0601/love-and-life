import * as base from "./authored-mission-flow-registry-t18-presented.js";
import * as state from "./authored-mission-flow-t19-state.js";
import { T19_BLACKRIDGE_INVASION_PACK as P } from "./authored/missions/t19-blackridge-invasion.js";

export * from "./authored-mission-flow-t19-state.js";

const F = Object.freeze;
const {
  available,
  step,
  leadById,
  ensure19,
  evidenceGroups,
  actionId,
  openingActions,
  navigatorFocuses,
  focusActions,
  groupActions,
  routeActions,
  evidenceAction,
  selectedLeadActions,
} = state.T19_STATE_INTERNALS;

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
  const flow = ensure19(runtime);
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
  const flow = ensure19(runtime);
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
    !new Set(ensure19(runtime).evidenceIds).has(lead.discoveryId))
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
    id: "force_council_revote_before_breakthrough",
    label: "四鍵の再投票を発動し、前衛命令を正式決定まで凍結する",
    minutes: 74,
    summary: "二重命令簿と戦時投票石を公開し、評議会の再投票が終わるまで前衛・軍獣・翼斥候を停止させた。双方の使節路も確保した。",
    sceneTransition: "翼伝令の二重命令から評議場の投票石、停止旗を上げる軍営、森出口で待機する前衛へ場面が移る",
  }),
  F({
    id: "exchange_reconnaissance_and_stand_down_scouts",
    label: "森踏査図と王国配兵表を交換し、斥候線を相互に一里戻す",
    minutes: 77,
    summary: "森の軍用線、避難枝道、王都の実配兵を同時提示し、翼斥候と要塞斥候を一里ずつ後退させた。先制攻撃の誤認を崩した。",
    sceneTransition: "森の踏査図から北陵の確認旗、翼斥候の後退、王城で公開される神殿派兵表へ場面が連続する",
  }),
  F({
    id: "redeploy_forces_and_open_civilian_corridor",
    label: "王都・北陵・黒嶺前衛を同時再配置し、民間避難と停戦使節の回廊を開く",
    minutes: 82,
    summary: "王都主力と北陵機動隊を防衛線へ戻し、黒嶺前衛は森出口で停止した。亜人街と黒嶺共同宿を結ぶ民間・使節回廊を軍用路から分離した。",
    sceneTransition: "王城の再配置命令から北陵の機動隊、森出口の停止線、亜人街と黒嶺共同宿を結ぶ避難旗へ場面が転換する",
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

function exclusive19(runtime, context = {}) {
  if (!available(runtime)) return null;
  const flow = ensure19(runtime);
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
  return exclusive19(runtime, context)
    ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowEvidenceAction(runtime) {
  const flow = available(runtime) ? ensure19(runtime) : null;
  const lead = flow ? leadById(flow.selectedLeadId) : null;
  return (lead ? evidenceAction(runtime, lead) : null)
    ?? base.authoredMissionFlowEvidenceAction(runtime);
}

export const T19_CORE_INTERNALS = F({
  ...state.T19_STATE_INTERNALS,
  navigatorFocuses,
  readiness,
  interventions: INTERVENTIONS,
});
