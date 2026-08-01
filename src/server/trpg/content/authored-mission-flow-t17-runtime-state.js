import * as base from "./authored-mission-flow-registry-t16-final.js";
import { T17_CAPITAL_SECOND_SUMMONING_PACK as P } from "./authored/missions/t17-capital-second-summoning.js";
import { T17_CONTINUITY_CONTRACT as CONTRACT } from "./authored-mission-flow-t17-contract.js";

export * from "./authored-mission-flow-registry-t16-final.js";

const F = Object.freeze;
const ACTIVE = new Set(["active", "critical"]);
const MISSION_ACTIVE = new Set(["active", "available", "in_progress"]);
const ABSENT = new Set(["dead", "missing", "departed", "sealed", "not-yet-present"]);
const SELECTS_LEAD = new Set(["navigator_route", "lead", "resolution_preparation", "resolution_preparation_lead"]);
const VERSION = "authored-mission-flow-t17-v1";

export const AUTHORED_MISSION_CONTINUITY_VERSION = "authored-mission-continuity-v4";
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
  ?? runtime?.playerState?.catalog?.special?.find?.((mission) => mission.id === P.missionId);
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
const groups = () => [
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
  const target = missionDef(runtime)?.steps?.find((entry) => entry.id === P.investigation.stepId);
  if (!state?.progress || !target) return;
  const acquired = new Set(flow.evidenceIds);
  state.progress[target.id] = Math.min(
    Number(target.required ?? groups().length),
    groups().filter((group) => group.some((id) => acquired.has(id))).length,
  );
}

function ensure17(runtime) {
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
  if (id === P.id || pack?.missionId === P.missionId) return ensure17(runtime);
  return base.ensureAuthoredMissionFlowState(runtime, pack);
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  return missionId === P.missionId
    ? ensure17(runtime)
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
  id: actionId("DEFER", "t17"),
  family: "leave",
  type: "plan",
  minutes: 5,
  label: P.investigation.defer.label,
  authoredMissionFlowExclusiveChoice: true,
  authoredMissionFlowId: P.id,
  authoredMissionFlowKind: "defer",
  authoredMissionFlowDeferMinutes: P.investigation.defer.deferMinutes,
});


export const T17_RUNTIME_STATE_INTERNALS = F({
  available,
  step,
  sourceAt,
  leadById,
  resolvedLead,
  revealLeadDestination,
  mission,
  missionDef,
  ensure17,
  actionId,
  deferAction,
  groups,
  contract: CONTRACT,
});
