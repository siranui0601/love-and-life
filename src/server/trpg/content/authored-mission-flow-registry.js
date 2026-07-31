import * as base from "./authored-mission-flow-registry-t15-v2.js";
import { T15_FOREIGN_FLEET_ARRIVAL_PACK } from "./authored/missions/t15-foreign-fleet-arrival.js";

export * from "./authored-mission-flow-registry-t15-v2.js";

const T15 = T15_FOREIGN_FLEET_ARRIVAL_PACK;
const LEAD_SELECTION_KINDS = new Set([
  "navigator_route",
  "lead",
  "resolution_preparation",
  "resolution_preparation_lead",
]);

function revealSelectedT15Lead(runtime, action) {
  if (action?.authoredMissionFlowId !== T15.id
    || !LEAD_SELECTION_KINDS.has(action?.authoredMissionFlowKind)) return false;
  const lead = T15.investigation.leads.find(
    (entry) => entry.id === action.authoredMissionFlowLeadId,
  );
  if (!lead?.facilityId) return false;
  runtime.playerKnowledge ??= {};
  runtime.playerKnowledge.knownHubIds ??= new Set();
  runtime.playerKnowledge.knownFacilityIds ??= new Set();
  const hubId = lead.targetLocation ?? T15.hearing.targetLocation;
  const knewHub = runtime.playerKnowledge.knownHubIds.has(hubId);
  const knewFacility = runtime.playerKnowledge.knownFacilityIds.has(lead.facilityId);
  runtime.playerKnowledge.knownHubIds.add(hubId);
  runtime.playerKnowledge.knownFacilityIds.add(lead.facilityId);
  if (!knewHub || !knewFacility) {
    runtime.playerState.routeCache = {};
    return true;
  }
  return false;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  let changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok !== false && revealSelectedT15Lead(runtime, action)) changed = true;
  return changed;
}

export function authoredMissionFlowGuidance(runtime) {
  const guidance = base.authoredMissionFlowGuidance(runtime);
  if (guidance?.missionId !== T15.missionId) return guidance;
  const targetFacilityId = guidance.targetFacilityId ?? null;
  return {
    ...guidance,
    actionPanel: targetFacilityId
      && runtime?.playerState?.player?.facilityId !== targetFacilityId
      ? "movement"
      : null,
  };
}
