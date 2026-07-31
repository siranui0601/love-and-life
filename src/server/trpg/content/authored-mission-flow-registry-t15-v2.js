import * as base from "./authored-mission-flow-t15-v1.js";
import { T15_FOREIGN_FLEET_ARRIVAL_PACK } from "./authored/missions/t15-foreign-fleet-arrival.js";

export * from "./authored-mission-flow-t15-v1.js";

const T15 = T15_FOREIGN_FLEET_ARRIVAL_PACK;
const T15_ID = T15.id;
const T15_MISSION_ID = T15.missionId;

function missionDefinition(runtime) {
  return runtime?.playerState?.catalog?.byId?.get?.(T15_MISSION_ID)
    ?? runtime?.playerState?.catalog?.special?.find?.((entry) => entry.id === T15_MISSION_ID)
    ?? null;
}

function missionRuntime(runtime) {
  return runtime?.playerState?.missions?.[T15_MISSION_ID] ?? null;
}

function currentStep(runtime) {
  const definition = missionDefinition(runtime);
  const state = missionRuntime(runtime);
  if (!definition || !state) return null;
  return definition.steps?.find((step) =>
    Number(state.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function t15Flow(runtime) {
  return base.ensureAuthoredMissionFlowState(runtime, T15_ID);
}

function evidenceGroups() {
  return [
    ...(T15.investigation.requiredEvidenceIds ?? []).map((id) => [id]),
    ...(T15.investigation.requiredEvidenceGroups ?? []).map((group) => [...group]),
  ].filter((group) => group.length > 0);
}

function correctedReadiness(runtime, choice) {
  const readiness = choice?.readiness;
  if (!readiness) {
    return {
      ready: true,
      coreReady: true,
      openingReady: true,
      supportCount: 0,
      minimumSupport: 0,
      requiredCoreCount: 0,
      satisfiedCoreCount: 0,
      missingCoreGroups: [],
      missingLeads: [],
    };
  }
  const flow = t15Flow(runtime);
  const evidenceIds = new Set(flow?.evidenceIds ?? []);
  const supportingEvidenceIds = [...new Set(readiness.supportingEvidenceIds ?? [])];
  const evidenceSupport = supportingEvidenceIds
    .filter((evidenceId) => evidenceIds.has(evidenceId)).length;
  const openingChoiceIds = readiness.openingChoiceIds ?? [];
  const openingMatches = openingChoiceIds.length === 0
    || openingChoiceIds.includes(flow?.openingChoiceId);
  const openingSupport = openingMatches
    ? Math.max(0, Number(readiness.openingSupport ?? 1))
    : 0;
  const supportCount = evidenceSupport + openingSupport;
  const minimumSupport = Math.max(1, Number(readiness.minimumSupport ?? 1));
  const requiredCoreGroups = [
    ...(readiness.requiredEvidenceIds ?? []).map((evidenceId) => [evidenceId]),
    ...(readiness.requiredEvidenceGroups ?? []).map((group) => [...group]),
  ].filter((group) => group.length > 0);
  const missingCoreGroups = requiredCoreGroups.filter((group) =>
    !group.some((evidenceId) => evidenceIds.has(evidenceId)));
  const coreReady = missingCoreGroups.length === 0;

  // The first lead makes one final plan easier, but never permanently locks the
  // other two. A different opening can substitute only after the player has
  // collected a seventh, optional corroboration beyond the six mandatory facts.
  const openingOverrideEvidenceCount = Math.max(
    evidenceGroups().length + 1,
    Number(readiness.openingOverrideEvidenceCount ?? evidenceGroups().length + 1),
  );
  const openingReady = openingMatches || evidenceIds.size >= openingOverrideEvidenceCount;

  const leadByEvidenceId = new Map(
    T15.investigation.leads.map((lead) => [lead.discoveryId, lead]),
  );
  const prioritizedMissingEvidenceIds = [
    ...missingCoreGroups.flat(),
    ...supportingEvidenceIds.filter((evidenceId) => !evidenceIds.has(evidenceId)),
  ];
  const missingLeads = [...new Set(prioritizedMissingEvidenceIds)]
    .map((evidenceId) => leadByEvidenceId.get(evidenceId))
    .filter(Boolean);
  return {
    ready: openingReady && coreReady && supportCount >= minimumSupport,
    coreReady,
    openingReady,
    openingMatches,
    openingOverrideEvidenceCount,
    supportCount,
    minimumSupport,
    requiredCoreCount: requiredCoreGroups.length,
    satisfiedCoreCount: requiredCoreGroups.length - missingCoreGroups.length,
    missingCoreGroups,
    missingLeads,
  };
}

export function authoredMissionFlowExtensionResolutionReadiness(runtime, routeId) {
  const route = T15.resolution?.choices?.find((choice) => choice.id === routeId);
  return route ? correctedReadiness(runtime, route) : {
    ready: false,
    coreReady: false,
    openingReady: false,
    supportCount: 0,
    minimumSupport: Infinity,
    requiredCoreCount: 0,
    satisfiedCoreCount: 0,
    missingCoreGroups: [],
    missingLeads: [],
  };
}

function preferredFocusId(flow) {
  return T15.hearing.choices.find((choice) => choice.id === flow?.openingChoiceId)
    ?.preferredFocusId ?? null;
}

function reorderOpeningFocusActions(actions, flow) {
  if (!Array.isArray(actions)
    || !actions.some((action) => action?.authoredMissionFlowId === T15_ID
      && action?.authoredMissionFlowKind === "navigator_focus")) return actions;
  const preferred = preferredFocusId(flow);
  if (!preferred) return actions;
  return [...actions].sort((left, right) =>
    Number(right?.authoredMissionFlowNavigatorFocusId === preferred)
      - Number(left?.authoredMissionFlowNavigatorFocusId === preferred));
}

function preparationAction(route, readiness) {
  const lead = readiness.missingLeads[0] ?? null;
  const openingNote = readiness.openingReady
    ? ""
    : `・別導入からの転換には任意裏付け${Math.max(0, readiness.openingOverrideEvidenceCount - (readiness.evidenceCount ?? 0))}件`;
  return {
    id: `MISSION_FLOW:${T15_ID}:RESOLUTION_PREPARATION:${route.id}:${lead?.id ?? "additional-corroboration"}`,
    family: "prepare",
    type: "plan",
    effectKind: "prepare_authored_mission_resolution",
    missionId: T15_MISSION_ID,
    stepId: T15.investigation.stepId,
    missionTitle: T15.title,
    missionTroubleId: T15.troubleId,
    minutes: Math.max(1, Number(route.readiness?.preparationMinutes ?? 6)),
    label: `${route.readiness?.preparationLabel ?? `${route.label}の裏付けを補う`}（成立根拠${readiness.supportCount}/${readiness.minimumSupport}・必須条件${readiness.satisfiedCoreCount}/${readiness.requiredCoreCount}${openingNote}）`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T15_ID,
    authoredMissionFlowKind: "resolution_preparation",
    authoredMissionFlowResolutionRouteId: route.id,
    authoredMissionFlowLeadId: lead?.id ?? null,
    authoredMissionFlowResolutionSupportCount: readiness.supportCount,
    authoredMissionFlowResolutionMinimumSupport: readiness.minimumSupport,
    authoredMissionFlowResolutionCoreReady: readiness.coreReady,
    authoredMissionFlowResolutionOpeningReady: readiness.openingReady,
    authoredMissionFlowResolutionRequiredCoreCount: readiness.requiredCoreCount,
    authoredMissionFlowResolutionSatisfiedCoreCount: readiness.satisfiedCoreCount,
  };
}

function cancelPreparationAction(route) {
  return {
    id: `MISSION_FLOW:${T15_ID}:RESOLUTION_PREPARATION_CANCEL:${route.id}`,
    family: "prepare",
    type: "plan",
    effectKind: "cancel_authored_mission_resolution_preparation",
    minutes: 1,
    label: "この追加裏付けを中止し、三つの最終方針へ戻る",
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T15_ID,
    authoredMissionFlowKind: "resolution_preparation_cancel",
    authoredMissionFlowResolutionRouteId: route.id,
  };
}

function preparationLeadAction(route, lead, readiness) {
  return {
    id: `MISSION_FLOW:${T15_ID}:RESOLUTION_PREPARATION_LEAD:${route.id}:${lead.id}`,
    family: "prepare",
    type: "plan",
    effectKind: "select_authored_mission_resolution_preparation_lead",
    minutes: 2,
    label: `追加裏付け：${lead.label}`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T15_ID,
    authoredMissionFlowKind: "resolution_preparation_lead",
    authoredMissionFlowResolutionRouteId: route.id,
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowTargetFacilityId: lead.facilityId,
    authoredMissionFlowResolutionSupportCount: readiness.supportCount,
    authoredMissionFlowResolutionMinimumSupport: readiness.minimumSupport,
    authoredMissionFlowResolutionCoreReady: readiness.coreReady,
    authoredMissionFlowResolutionOpeningReady: readiness.openingReady,
  };
}

function correctedPreparationActions(runtime, flow) {
  const route = T15.resolution?.choices?.find(
    (choice) => choice.id === flow?.resolutionPreparationRouteId,
  );
  if (!route) return null;
  const readiness = correctedReadiness(runtime, route);
  if (readiness.ready) return null;
  const actions = readiness.missingLeads
    .slice(0, 2)
    .map((lead) => preparationLeadAction(route, lead, readiness));
  actions.push(cancelPreparationAction(route));
  if (actions.length < 3) {
    actions.unshift({
      ...preparationAction(route, readiness),
      id: `MISSION_FLOW:${T15_ID}:RESOLUTION_PREPARATION_REVIEW:${route.id}`,
      label: "不足している核心証拠と、別導入から転換するための追加裏付けを整理する",
      minutes: 3,
    });
  }
  return actions.slice(0, 3);
}

function correctResolutionActions(runtime, actions) {
  if (!Array.isArray(actions)) return actions;
  return actions.map((action) => {
    if (action?.authoredMissionFlowId !== T15_ID) return action;
    const route = T15.resolution?.choices?.find(
      (choice) => choice.id === action.authoredMissionFlowResolutionRouteId,
    );
    if (!route) return action;
    const readiness = correctedReadiness(runtime, route);
    return readiness.ready || action.authoredMissionFlowKind !== "resolution"
      ? action
      : preparationAction(route, readiness);
  });
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const flow = t15Flow(runtime);
  if (flow?.resolutionPreparationRouteId) {
    const corrected = correctedPreparationActions(runtime, flow);
    if (corrected?.length === 3) return corrected;
  }
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  const reordered = reorderOpeningFocusActions(actions, flow);
  return correctResolutionActions(runtime, reordered);
}

function completePublicSourceHearing(runtime, action) {
  if (!action?.authoredMissionFlowOpeningSourceId || !action?.missionId || !action?.stepId) return false;
  const mission = runtime?.playerState?.missions?.[action.missionId];
  const definition = runtime?.playerState?.catalog?.byId?.get?.(action.missionId)
    ?? runtime?.playerState?.catalog?.special?.find?.((entry) => entry.id === action.missionId);
  const step = definition?.steps?.find((entry) => entry.id === action.stepId);
  if (!mission?.progress || !step) return false;
  const required = Number(step.required ?? 1);
  if (Number(mission.progress[action.stepId] ?? 0) >= required) return false;
  mission.progress[action.stepId] = required;
  return true;
}

function applyCorrectedPreparation(runtime, action, result) {
  const route = T15.resolution?.choices?.find(
    (choice) => choice.id === action.authoredMissionFlowResolutionRouteId,
  );
  if (!route) return false;
  const readiness = correctedReadiness(runtime, route);
  const flow = t15Flow(runtime);
  if (readiness.ready) {
    flow.resolutionPreparationRouteId = null;
    result.summary = `「${route.label}」を実行するための裏付けは既に揃っている。三つの最終方針へ戻れる。`;
    return true;
  }
  const lead = readiness.missingLeads.find(
    (entry) => entry.id === action.authoredMissionFlowLeadId,
  ) ?? readiness.missingLeads[0] ?? null;
  flow.resolutionPreparationRouteId = route.id;
  flow.selectedLeadId = lead?.id ?? null;
  flow.selectedLeadAtMinute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  flow.navigatorFocusId = null;
  flow.navigatorGroupId = null;
  if (lead && !flow.unlockedLeadIds.includes(lead.id)) flow.unlockedLeadIds.push(lead.id);
  result.summary = route.readiness?.preparationSummary
    ?? `「${route.label}」を成立させるため、別系統の追加裏付けを取ることにした。`;
  return true;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  if (result?.ok !== false
    && action?.authoredMissionFlowId === T15_ID
    && action?.authoredMissionFlowKind === "resolution_preparation") {
    return applyCorrectedPreparation(runtime, action, result);
  }
  if (result?.ok !== false
    && action?.authoredMissionFlowId === T15_ID
    && action?.authoredMissionFlowKind === "resolution") {
    const readiness = authoredMissionFlowExtensionResolutionReadiness(
      runtime,
      action.authoredMissionFlowResolutionRouteId,
    );
    if (!readiness.ready) {
      action.authoredMissionFlowKind = "resolution_preparation";
      const changed = applyCorrectedPreparation(runtime, action, result);
      action.authoredMissionFlowKind = "resolution";
      result.ok = false;
      result.reason = "authored_resolution_evidence_missing";
      return changed;
    }
  }
  let changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (completePublicSourceHearing(runtime, action)) changed = true;
  return changed;
}

export function authoredMissionFlowGuidance(runtime) {
  const guidance = base.authoredMissionFlowGuidance(runtime);
  if (guidance?.missionId !== T15_MISSION_ID) return guidance;
  const flow = t15Flow(runtime);
  const route = T15.resolution?.choices?.find(
    (choice) => choice.id === flow?.resolutionPreparationRouteId,
  );
  if (!route) return guidance;
  const readiness = correctedReadiness(runtime, route);
  const openingText = readiness.openingReady
    ? ""
    : ` 最初の導入とは異なる方針へ転換するため、六分類に加えて任意の七件目を別系統から裏づける必要がある。`;
  return {
    ...guidance,
    detail: `${guidance?.detail ?? ""}${openingText}`.trim(),
  };
}
