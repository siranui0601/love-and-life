import * as base from "./authored-mission-flow-registry-t17-presented.js";
import * as world from "./authored-mission-flow-t18-world.js";
import {
  T18_MACHINE_COLOSSUS_PACK as P,
  T18_CONTINUITY_CONTRACT as CONTRACT,
} from "./authored/missions/t18-machine-colossus.js";

export * from "./authored-mission-flow-t18-world.js";

const F = Object.freeze;
const {
  available,
  step,
  sourceAt,
  leadById,
  resolvedLead,
  revealLeadDestination,
  mission,
  missionDef,
  ensure18,
  navigatorFocuses,
  readiness,
  interventions: INTERVENTIONS,
} = world.T18_CORE_INTERNALS;
const {
  completeStep,
  recordDiscovery,
  evaluateBattleObjectives,
  applyResolutionEffect,
} = world.T18_WORLD_INTERNALS;

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  let changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok === false) return changed;
  if (action?.missionId === P.missionId && action?.type === "missionBattle") {
    return evaluateBattleObjectives(runtime, result?.battle ?? result, result) || changed;
  }
  if (action?.authoredMissionFlowId !== P.id) return changed;
  const flow = ensure18(runtime);
  const kind = action.authoredMissionFlowKind;
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);

  if (kind === "opening") {
    flow.openingChoiceId = action.authoredMissionFlowChoiceId;
    flow.openingSourceId = action.authoredMissionFlowOpeningSourceId;
    flow.unlockedLeadIds = [...new Set(
      action.authoredMissionFlowUnlockedLeadIds
        ?? P.investigation.leads.map((lead) => lead.id),
    )];
    if (action.authoredMissionFlowFactId) {
      flow.knownFactIds = [...new Set([...flow.knownFactIds, action.authoredMissionFlowFactId])];
    }
    completeStep(runtime, P.hearing.stepId);
    result.summary ??= "機械巨神兵の最初の因果線を確定した。";
    result.sceneTransition = action.authoredMissionFlowSceneTransition;
    changed = true;
  }
  if (kind === "navigator_focus") {
    flow.navigatorFocusId = action.authoredMissionFlowNavigatorFocusId;
    flow.navigatorGroupId = null;
    changed = true;
  }
  if (kind === "navigator_group") {
    flow.navigatorGroupId = action.authoredMissionFlowNavigatorGroupId;
    changed = true;
  }
  if (kind === "navigator_back") {
    flow.navigatorFocusId = null;
    flow.navigatorGroupId = null;
    changed = true;
  }
  if (kind === "navigator_route_back") {
    flow.navigatorGroupId = null;
    changed = true;
  }
  if (["navigator_route", "lead", "resolution_preparation_lead"].includes(kind)) {
    flow.selectedLeadId = action.authoredMissionFlowLeadId;
    changed = true;
  }
  if (kind === "evidence") {
    const lead = leadById(action.authoredMissionFlowLeadId);
    if (lead && !flow.evidenceIds.includes(lead.discoveryId)) {
      flow.evidenceIds.push(lead.discoveryId);
    }
    if (lead) recordDiscovery(runtime, lead, action);
    if (lead) {
      flow.evidenceSourceIds[lead.discoveryId] =
        action.authoredMissionFlowEvidenceSourceId;
    }
    flow.selectedLeadId = null;
    flow.navigatorFocusId = null;
    flow.navigatorGroupId = null;
    ensure18(runtime);
    changed = true;
  }
  if (kind === "reconsider_lead") {
    flow.selectedLeadId = null;
    flow.navigatorGroupId = null;
    changed = true;
  }
  if (kind === "resolution_preparation") {
    flow.resolutionPreparationRouteId = action.authoredMissionFlowResolutionRouteId;
    flow.selectedLeadId = action.authoredMissionFlowLeadId;
    changed = true;
  }
  if (kind === "intervention") {
    const intervention = INTERVENTIONS.find((entry) =>
      entry.id === action.authoredMissionFlowInterventionChoiceId);
    flow.interventionChoiceId = action.authoredMissionFlowInterventionChoiceId;
    completeStep(runtime, P.battle.stepId);
    evaluateBattleObjectives(runtime, {
      won: true,
      rounds: 0,
      encounterId: `PRE-ACTIVATION:${flow.interventionChoiceId}`,
    }, result);
    const objectiveSummary = result.summary;
    result.summary = `${intervention?.summary ?? "巨神兵を完全起動前に停止した。"} ${objectiveSummary ?? ""}`.trim();
    result.sceneTransition = intervention?.sceneTransition
      ?? action.authoredMissionFlowSceneTransition;
    changed = true;
  }
  if (kind === "resolution") {
    const route = P.resolution.choices.find((entry) =>
      entry.id === action.authoredMissionFlowResolutionRouteId);
    const state = route && readiness(runtime, route.id);
    if (state?.ready) {
      result.authoredMissionFlowResolutionContextVariantId =
        action.authoredMissionFlowResolutionContextVariantId ?? null;
      changed = applyResolutionEffect(runtime, route, flow, result) || changed;
    } else {
      result.ok = false;
      result.reason = "authored_resolution_evidence_missing";
      result.summary = "欠けている核心証拠を補う必要がある。";
      changed = true;
    }
  }
  if (kind === "defer") {
    flow.deferredUntilMinute = minute
      + Number(action.authoredMissionFlowDeferMinutes ?? 120);
    result.summary ??= P.investigation.defer.summary;
    changed = true;
  }

  revealLeadDestination(runtime, action);
  if (changed) {
    runtime.playerState.history ??= [];
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_T18_UPDATED",
      minute,
      missionId: P.missionId,
      flowKind: kind,
      openingChoiceId: flow.openingChoiceId,
      evidenceCount: flow.evidenceIds.length,
      selectedLeadId: flow.selectedLeadId,
      interventionChoiceId: flow.interventionChoiceId,
      resolutionRouteId: flow.selectedResolutionRouteId,
    });
  }
  return changed;
}

export function suppressGenericAuthoredMissionAction(runtime, action) {
  if (action?.missionId !== P.missionId) {
    return base.suppressGenericAuthoredMissionAction(runtime, action);
  }
  if (!available(runtime) || action.authoredMissionFlowId === P.id) return false;
  const flow = ensure18(runtime);
  const current = step(runtime);
  if ([P.hearing.stepId, P.investigation.stepId, P.resolution.stepId].includes(current?.id)) {
    return !flow.openingChoiceId || Boolean(flow.selectedLeadId) || Boolean(sourceAt(runtime));
  }
  if (current?.id === P.battle.stepId) {
    const day = Number(runtime.playerState.day ?? Math.floor(
      Number(runtime.playerState.absoluteMinute ?? 0) / 1440,
    ));
    return day < P.battle.fullActivationDay;
  }
  return false;
}

export function applyAuthoredMissionFlowCatalogOverrides(catalog) {
  const updated = base.applyAuthoredMissionFlowCatalogOverrides(catalog);
  const missionEntry = updated?.special?.find((entry) => entry.id === P.missionId);
  if (!missionEntry) return updated;
  for (const [section, patch] of Object.entries(P.catalogOverride)) {
    const stepId = P[section]?.stepId;
    const target = missionEntry.steps.find((entry) => entry.id === stepId);
    if (target) Object.assign(target, patch);
  }
  const battle = missionEntry.steps.find((entry) =>
    entry.id === P.battle.stepId || entry.type === "battle");
  if (battle) {
    battle.encounterId = P.battle.earlyEncounterId;
    battle.sideObjectives = CONTRACT.battleObjectives.map((objective) => ({
      id: objective.id,
      label: objective.label,
      independentOfVictory: true,
    }));
  }
  return updated;
}

export function authoredMissionFlowGuidance(runtime) {
  if (!available(runtime)) return base.authoredMissionFlowGuidance(runtime);
  const flow = ensure18(runtime);
  const current = step(runtime);
  if (!flow.openingChoiceId) {
    const source = sourceAt(runtime) ?? CONTRACT.introductionSources[0];
    return {
      missionId: P.missionId,
      ...source.guidance,
      targetLocation: source.targetLocation,
      targetFacilityId: source.targetFacilityId,
      sourceId: source.id,
      actionPanel: runtime.playerState.player.facilityId === source.targetFacilityId
        ? null
        : "movement",
    };
  }
  if (current?.id === P.investigation.stepId && flow.selectedLeadId) {
    const resolved = resolvedLead(runtime, leadById(flow.selectedLeadId));
    return {
      missionId: P.missionId,
      kicker: resolved.sourceKind === "fallback"
        ? "人物が不在でも、独立した記録と現物は残る"
        : P.investigation.selectedLeadGuidance.kicker,
      title: resolved.label,
      detail: resolved.leadNarrative,
      targetLocation: resolved.targetLocation,
      targetFacilityId: resolved.facilityId,
      actionPanel: runtime.playerState.player.facilityId === resolved.facilityId
        ? null
        : "movement",
    };
  }
  let guidance = null;
  if (current?.id === P.investigation.stepId) {
    guidance = flow.evidenceIds.length
      ? P.investigation.continuedGuidance
      : P.investigation.initialGuidance;
  } else if (current?.id === P.battle.stepId) {
    const day = Number(runtime.playerState.day ?? Math.floor(
      Number(runtime.playerState.absoluteMinute ?? 0) / 1440,
    ));
    guidance = day < P.battle.fullActivationDay
      ? P.stepGuidance.intervention
      : P.stepGuidance.battle;
  } else if (current?.id === P.resolution.stepId) {
    guidance = P.stepGuidance.resolve;
  }
  if (!guidance) return base.authoredMissionFlowGuidance(runtime);
  return {
    missionId: P.missionId,
    ...guidance,
    targetLocation: current?.targetLocation ?? P.hearing.targetLocation,
    targetFacilityId: current?.targetFacilityId ?? null,
    actionPanel: current?.targetFacilityId
      && runtime.playerState.player.facilityId !== current.targetFacilityId
      ? "movement"
      : null,
  };
}

export const T18_RUNTIME_INTERNALS = F({
  available,
  step,
  sourceAt,
  leadById,
  resolvedLead,
  revealLeadDestination,
  mission,
  missionDef,
  ensure18,
  navigatorFocuses,
  readiness,
  interventions: INTERVENTIONS,
  contract: CONTRACT,
});
