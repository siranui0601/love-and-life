import * as base from "./authored-mission-flow-registry-t17-presented.js";
import {
  T18_MACHINE_COLOSSUS_PACK as P,
  T18_CONTINUITY_CONTRACT as CONTRACT,
} from "./authored/missions/t18-machine-colossus.js";

export * from "./authored-mission-flow-registry-t17-presented.js";

const F = Object.freeze;
const ACTIVE = new Set(["active", "critical"]);
const MISSION_ACTIVE = new Set(["active", "available", "in_progress"]);
const ABSENT = new Set(["dead", "missing", "departed", "sealed", "not-yet-present"]);
const SELECTS_LEAD = new Set([
  "navigator_route",
  "lead",
  "resolution_preparation",
  "resolution_preparation_lead",
]);
const VERSION = "authored-mission-flow-t18-v1";

export const AUTHORED_MISSION_CONTINUITY_VERSION = "authored-mission-continuity-v5";
export const AUTHORED_MISSION_FLOW_PACKS = F([
  ...base.AUTHORED_MISSION_FLOW_PACKS.filter((pack) =>
    pack.id !== P.id && pack.missionId !== P.missionId),
  P,
]);
export const AUTHORED_MISSION_CONTINUITY_CONTRACTS = F({
  ...base.AUTHORED_MISSION_CONTINUITY_CONTRACTS,
  [P.id]: CONTRACT,
});

const missionDef = (runtime) =>
  runtime?.playerState?.catalog?.byId?.get?.(P.missionId)
  ?? runtime?.playerState?.catalog?.special?.find?.((entry) => entry.id === P.missionId);
const mission = (runtime) => runtime?.playerState?.missions?.[P.missionId];
const step = (runtime) => {
  const definition = missionDef(runtime);
  const state = mission(runtime);
  return definition?.steps?.find((entry) =>
    Number(state?.progress?.[entry.id] ?? 0) < Number(entry.required ?? 1)) ?? null;
};
const knows = (runtime) =>
  runtime?.playerState?.progress?.missions?.attemptedTroubleIds?.has?.(P.troubleId)
  || (runtime?.playerState?.rumors ?? []).some((rumor) =>
    rumor.troubleId === P.troubleId
      && runtime.playerState.player?.knownRumorIds?.has?.(rumor.id));
const available = (runtime) =>
  ACTIVE.has(runtime?.playerState?.troubles?.[P.troubleId]?.status
    ?? runtime?.playerState?.troubles?.[P.troubleId])
  && MISSION_ACTIVE.has(mission(runtime)?.status)
  && knows(runtime);
const evidenceGroups = () => [
  ...(P.investigation.requiredEvidenceIds ?? []).map((id) => [id]),
  ...(P.investigation.requiredEvidenceGroups ?? []).map((group) => [...group]),
];
const actionId = (kind, id) => `MISSION_FLOW:${P.id}:${kind}:${id}`;
const freshFlow = () => ({
  version: VERSION,
  flowId: P.id,
  openingChoiceId: null,
  openingSourceId: null,
  navigatorFocusId: null,
  navigatorGroupId: null,
  selectedLeadId: null,
  evidenceIds: [],
  evidenceSourceIds: {},
  unlockedLeadIds: [],
  knownFactIds: [],
  deferredUntilMinute: null,
  interventionChoiceId: null,
  resolutionPreparationRouteId: null,
  selectedResolutionRouteId: null,
  selectedResolutionContextId: null,
  resolutionBranchId: null,
  battleObjectiveResults: {},
});

function syncInvestigationProgress(runtime, flow) {
  const state = mission(runtime);
  const target = missionDef(runtime)?.steps?.find((entry) =>
    entry.id === P.investigation.stepId);
  if (!state?.progress || !target) return;
  const acquired = new Set(flow.evidenceIds);
  state.progress[target.id] = Math.min(
    Number(target.required ?? evidenceGroups().length),
    evidenceGroups().filter((group) => group.some((id) => acquired.has(id))).length,
  );
}

function ensure18(runtime) {
  runtime.authoredMissionFlows ??= {};
  runtime.authoredMissionFlows[P.id] ??= freshFlow();
  const flow = runtime.authoredMissionFlows[P.id];
  Object.assign(flow, { version: VERSION, flowId: P.id });
  flow.evidenceIds = [...new Set(Array.isArray(flow.evidenceIds) ? flow.evidenceIds : [])];
  flow.evidenceSourceIds = { ...(flow.evidenceSourceIds ?? {}) };
  flow.unlockedLeadIds = [...new Set(flow.unlockedLeadIds ?? [])];
  flow.knownFactIds = [...new Set(flow.knownFactIds ?? [])];
  flow.battleObjectiveResults = { ...(flow.battleObjectiveResults ?? {}) };
  const validEvidence = new Set(P.investigation.leads.map((lead) => lead.discoveryId));
  for (const discovery of mission(runtime)?.discoveries ?? []) {
    if (validEvidence.has(discovery?.id) && !flow.evidenceIds.includes(discovery.id)) {
      flow.evidenceIds.push(discovery.id);
    }
  }
  flow.evidenceIds = flow.evidenceIds.filter((id) => validEvidence.has(id));
  if (flow.openingChoiceId && !flow.unlockedLeadIds.length) {
    flow.unlockedLeadIds = P.investigation.leads.map((lead) => lead.id);
  }
  const selected = P.investigation.leads.find((lead) => lead.id === flow.selectedLeadId);
  if (!selected || flow.evidenceIds.includes(selected.discoveryId)) flow.selectedLeadId = null;
  syncInvestigationProgress(runtime, flow);
  return flow;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const id = typeof pack === "string" ? pack : pack?.id;
  if (id === P.id || pack?.missionId === P.missionId) return ensure18(runtime);
  return base.ensureAuthoredMissionFlowState(runtime, pack);
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  return missionId === P.missionId
    ? ensure18(runtime)
    : base.initializeAuthoredMissionFlowForMission(runtime, missionId);
}

const sourceAt = (runtime) => CONTRACT.introductionSources.find((source) =>
  source.targetFacilityId === runtime?.playerState?.player?.facilityId);
const leadById = (id) => P.investigation.leads.find((lead) => lead.id === id);

function npcUnavailable(runtime, npcId, facilityId) {
  const state = runtime?.livingWorld?.npcStates?.[npcId];
  if (!state) return false;
  if (state.lifeStatus === "dead" || ABSENT.has(state.presence)) return true;
  const position = state.position?.facilityId ?? state.facilityId;
  if (position) return position !== facilityId;
  const present = runtime?.playerState?.authoritativePresentNpcIds;
  return present instanceof Set
    && runtime?.playerState?.player?.facilityId === facilityId
    && !present.has(npcId);
}

function resolvedLead(runtime, lead) {
  const fallback = CONTRACT.leadFallbacks?.[lead.id]?.[0];
  if (fallback && npcUnavailable(runtime, fallback.primaryNpcId, lead.facilityId)) {
    return {
      ...lead,
      ...fallback,
      id: lead.id,
      discoveryId: lead.discoveryId,
      sourceId: fallback.id,
      sourceKind: "fallback",
    };
  }
  return { ...lead, sourceId: "primary", sourceKind: "primary" };
}

function revealLeadDestination(runtime, action) {
  if (action?.authoredMissionFlowId !== P.id
    || !SELECTS_LEAD.has(action.authoredMissionFlowKind)) return false;
  const lead = leadById(action.authoredMissionFlowLeadId);
  if (!lead) return false;
  const resolved = resolvedLead(runtime, lead);
  runtime.playerKnowledge ??= {};
  runtime.playerKnowledge.knownHubIds ??= new Set();
  runtime.playerKnowledge.knownFacilityIds ??= new Set();
  const changed = !runtime.playerKnowledge.knownHubIds.has(resolved.targetLocation)
    || !runtime.playerKnowledge.knownFacilityIds.has(resolved.facilityId);
  runtime.playerKnowledge.knownHubIds.add(resolved.targetLocation);
  runtime.playerKnowledge.knownFacilityIds.add(resolved.facilityId);
  if (changed) runtime.playerState.routeCache = {};
  return changed;
}

const deferAction = () => ({
  id: actionId("DEFER", "t18"),
  family: "leave",
  type: "plan",
  minutes: 5,
  label: P.investigation.defer.label,
  authoredMissionFlowExclusiveChoice: true,
  authoredMissionFlowId: P.id,
  authoredMissionFlowKind: "defer",
  authoredMissionFlowDeferMinutes: P.investigation.defer.deferMinutes,
});

function openingActions(runtime) {
  const flow = ensure18(runtime);
  const source = sourceAt(runtime);
  const current = step(runtime);
  if (flow.openingChoiceId || !source
    || ![P.hearing.stepId, P.investigation.stepId].includes(current?.id)) return null;
  const actions = source.choices.map((entry) => {
    const opening = P.hearing.choices.find((choiceEntry) => choiceEntry.id === entry.choiceId);
    return {
      id: `${P.id}:OPENING_SOURCE:${source.id}:${opening.id}`,
      family: "investigate",
      type: "plan",
      effectKind: "inspect_authored_mission_introduction_source",
      missionId: P.missionId,
      stepId: P.hearing.stepId,
      missionTitle: P.title,
      missionTroubleId: P.troubleId,
      targetNpcId: null,
      label: entry.label,
      playerUtterance: opening.playerUtterance,
      requiredDisclosure: entry.requiredDisclosure,
      minutes: entry.minutes,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "opening",
      authoredMissionFlowChoiceId: opening.id,
      authoredMissionFlowFactId: opening.factId,
      authoredMissionFlowUnlockedLeadIds: [...opening.unlockedLeadIds],
      authoredMissionFlowOpeningSourceId: source.id,
      authoredMissionFlowSceneTransition: entry.sceneTransition,
    };
  });
  return actions.length === 3 ? actions : null;
}

function navigatorFocuses() {
  return P.investigation.focuses.map((focus) => ({
    ...focus,
    groups: focus.groups.map((group) => ({
      ...group,
      evidenceIds: [...P.investigation.requiredEvidenceGroups[group.evidenceGroupIndex]],
    })),
  }));
}

function focusActions(flow) {
  const acquired = new Set(flow.evidenceIds);
  const preferred = P.hearing.choices.find((opening) =>
    opening.id === flow.openingChoiceId)?.preferredFocusId;
  const actions = navigatorFocuses()
    .filter((focus) => focus.groups.some((group) =>
      group.evidenceIds.some((id) => !acquired.has(id))))
    .map((focus) => ({
      id: actionId("NAVIGATOR_FOCUS", focus.id),
      family: "prepare",
      type: "plan",
      minutes: focus.minutes ?? 3,
      label: focus.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "navigator_focus",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowSceneTransition: focus.sceneTransition,
    }))
    .sort((left, right) =>
      Number(right.authoredMissionFlowNavigatorFocusId === preferred)
      - Number(left.authoredMissionFlowNavigatorFocusId === preferred));
  if (actions.length < 3) actions.push(deferAction());
  return actions.slice(0, 3).length === 3 ? actions.slice(0, 3) : null;
}

function groupActions(flow) {
  const focus = navigatorFocuses().find((entry) => entry.id === flow.navigatorFocusId);
  const acquired = new Set(flow.evidenceIds);
  if (!focus) return null;
  const actions = focus.groups
    .filter((group) => group.evidenceIds.some((id) => !acquired.has(id)))
    .map((group) => ({
      id: actionId("NAVIGATOR_GROUP", group.id),
      family: "prepare",
      type: "plan",
      minutes: 2,
      label: group.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "navigator_group",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowNavigatorGroupId: group.id,
    }));
  actions.push({
    id: actionId("NAVIGATOR_BACK", focus.id),
    family: "prepare",
    type: "plan",
    minutes: 1,
    label: "三つの調査方針へ戻る",
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: P.id,
    authoredMissionFlowKind: "navigator_back",
  });
  if (actions.length < 3) actions.push(deferAction());
  return actions.slice(0, 3);
}

function routeActions(flow) {
  const focus = navigatorFocuses().find((entry) => entry.id === flow.navigatorFocusId);
  const group = focus?.groups.find((entry) => entry.id === flow.navigatorGroupId);
  const acquired = new Set(flow.evidenceIds);
  if (!group) return null;
  const actions = group.evidenceIds
    .filter((id) => !acquired.has(id))
    .map((id) => P.investigation.leads.find((lead) => lead.discoveryId === id))
    .filter(Boolean)
    .map((lead) => ({
      id: actionId("NAVIGATOR_ROUTE", lead.id),
      family: "prepare",
      type: "plan",
      minutes: 3,
      label: lead.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "navigator_route",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowNavigatorGroupId: group.id,
      authoredMissionFlowLeadId: lead.id,
      authoredMissionFlowTargetFacilityId: lead.facilityId,
      authoredMissionFlowSceneTransition: `調査の視点が${lead.destinationName}へ移る`,
    }));
  if (actions.length < 3) {
    actions.push({
      id: actionId("NAVIGATOR_ROUTE_BACK", group.id),
      family: "prepare",
      type: "plan",
      minutes: 1,
      label: "同じ方針の別分類へ戻る",
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "navigator_route_back",
    });
  }
  if (actions.length < 3) actions.push(deferAction());
  return actions.slice(0, 3);
}

function evidenceAction(runtime, lead) {
  const resolved = resolvedLead(runtime, lead);
  const flow = ensure18(runtime);
  if (runtime?.playerState?.player?.facilityId !== resolved.facilityId
    || flow.evidenceIds.includes(lead.discoveryId)) return null;
  return {
    id: actionId(resolved.sourceKind === "fallback" ? "FALLBACK_EVIDENCE" : "EVIDENCE", lead.id),
    family: "investigate",
    type: "investigate",
    missionId: P.missionId,
    stepId: P.investigation.stepId,
    missionTitle: P.title,
    missionTroubleId: P.troubleId,
    minutes: resolved.minutes,
    label: resolved.label,
    approachId: resolved.approachId,
    discoveryId: lead.discoveryId,
    discoveryText: resolved.discoveryText,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: P.id,
    authoredMissionFlowKind: "evidence",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowEvidenceId: lead.discoveryId,
    authoredMissionFlowEvidenceSourceId: resolved.sourceId,
  };
}

function selectedLeadActions(runtime, flow, movementActions = []) {
  const lead = leadById(flow.selectedLeadId);
  if (!lead) return null;
  const resolved = resolvedLead(runtime, lead);
  const evidence = evidenceAction(runtime, lead);
  const currentHub = runtime.playerState.player.location;
  const exactLocal = movementActions.find((action) =>
    action?.movementScope === "local"
      && action.destinationFacilityId === resolved.facilityId);
  const regional = resolved.targetLocation !== currentHub
    ? movementActions.find((action) =>
      action?.movementScope === "regional"
        && action.destinationHub === resolved.targetLocation)
    : null;
  const movement = exactLocal ?? regional;
  const primary = evidence ?? (movement ? {
    ...movement,
    id: actionId(regional === movement ? "LEAD_HUB" : "LEAD", lead.id),
    label: `${resolved.targetLocation !== currentHub
      ? `${resolved.targetLocation}へ向かい、`
      : `${resolved.destinationName}へ向かい、`}${resolved.label}`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: P.id,
    authoredMissionFlowKind: "lead",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowTargetFacilityId: resolved.facilityId,
    authoredMissionFlowEvidenceSourceId: resolved.sourceId,
  } : null);
  const actions = [
    primary,
    {
      id: actionId("RECONSIDER", lead.id),
      family: "prepare",
      type: "plan",
      minutes: 4,
      label: "この経路を戻し、別の証拠分類を選ぶ",
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "reconsider_lead",
    },
    deferAction(),
  ].filter(Boolean);
  return actions.length === 3 ? actions : null;
}


export const T18_STATE_INTERNALS = F({
  available,
  step,
  sourceAt,
  leadById,
  resolvedLead,
  revealLeadDestination,
  mission,
  missionDef,
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
  deferAction,
});
