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

function seedT15ResolutionRumor(runtime, action, result) {
  if (result?.ok === false
    || action?.authoredMissionFlowId !== T15.id
    || action?.authoredMissionFlowKind !== "resolution") return false;
  const baseRoute = T15.resolution?.choices?.find(
    (entry) => entry.id === action.authoredMissionFlowResolutionRouteId,
  );
  if (!baseRoute) return false;
  const flow = base.ensureAuthoredMissionFlowState(runtime, T15.id);
  const route = base.resolveAuthoredMissionFlowExtensionChoice(
    runtime,
    baseRoute,
    action.authoredMissionFlowResolutionContextVariantId
      ?? flow?.selectedResolutionContextId
      ?? null,
  );
  const troubleStatus = result?.troubleStatusAtResolution
    ?? action.authoredMissionFlowTroubleStatus
    ?? runtime?.playerState?.troubles?.[T15.troubleId]?.status
    ?? "active";
  const factId = route.worldEffect?.factIdByTroubleStatus?.[troubleStatus]
    ?? route.worldEffect?.factId;
  const text = route.worldEffect?.textByTroubleStatus?.[troubleStatus]
    ?? route.worldEffect?.text;
  const world = runtime?.livingWorld;
  if (!world || !factId || !text) return false;

  const facilityId = route.worldEffect?.facilityId
    ?? runtime?.playerState?.player?.facilityId;
  if (!facilityId) return false;
  world.facilityRumors ??= {};
  const existingRumors = world.facilityRumors[facilityId];
  const rumorMap = existingRumors instanceof Map
    ? existingRumors
    : new Map(Object.entries(existingRumors ?? {}));
  world.facilityRumors[facilityId] = rumorMap;
  if (rumorMap.has(factId)) return false;

  world.seededTroubleFacts ??= new Set();
  world.seededTroubleFacts.add(factId);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const learnedAt = minute / 60;
  const propagationAt = learnedAt + Number(route.worldEffect?.propagationDelayHours ?? 2);
  world.knowledgeEventSequence = Number(
    world.knowledgeEventSequence ?? world.knowledgeEvents?.length ?? 0,
  ) + 1;
  const eventId = `K${String(world.knowledgeEventSequence).padStart(7, "0")}`;
  const belief = {
    factId,
    kind: "trouble",
    text,
    troubleId: T15.troubleId,
    troubleIds: [T15.troubleId],
    troubleStatus: "resolved",
    confidence: 1,
    importance: 0.95,
    secret: false,
    learnedAt,
    propagationAt,
    sourceType: "player-intervention",
    sourceNpcId: null,
    provenanceEventId: eventId,
    hopCount: 0,
    path: [`facility:${facilityId}`],
    aftermathPlans: (route.worldEffect?.aftermathPlans ?? []).map((plan) => ({
      ...plan,
      npcIds: [...(plan.npcIds ?? [])],
    })),
  };
  world.knowledgeEvents ??= [];
  world.knowledgeEvents.push({
    id: eventId,
    type: "rumor-source",
    npcId: null,
    factId,
    troubleId: T15.troubleId,
    troubleStatus: "resolved",
    learnedAt,
    propagationAt,
    sourceType: "player-intervention",
    importance: belief.importance,
    confidence: belief.confidence,
    hopCount: 0,
    path: [...belief.path],
    location: {
      hubId: runtime?.playerState?.player?.location ?? T15.hearing.targetLocation,
      facilityId,
    },
  });
  rumorMap.set(factId, {
    factId,
    belief,
    propagationAt,
    sourceNpcId: null,
    sourceEventId: eventId,
    carrierType: "player-intervention",
  });
  return true;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  let changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok !== false && revealSelectedT15Lead(runtime, action)) changed = true;
  if (seedT15ResolutionRumor(runtime, action, result)) changed = true;
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
