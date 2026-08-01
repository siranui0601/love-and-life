import {
  AUTHORED_MISSION_CONTINUITY_CONTRACTS,
  AUTHORED_MISSION_FLOW_PACKS,
  AUTHORED_MISSION_FLOW_SCENES,
  applyAuthoredMissionFlowAction,
  applyAuthoredMissionFlowCatalogOverrides,
  authoredMissionFlowEvidenceAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowExtensionResolutionReadiness,
  ensureAuthoredMissionFlowState,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import { auditT19EvidenceProfiles } from "../../../src/server/trpg/content/authored/missions/t19-blackridge-invasion-evidence.js";

export const MISSION_ID = "MSN-T19";
export const FLOW_ID = "blackridge-forest-breakthrough-invasion";

export function missionDefinition() {
  return {
    id: MISSION_ID,
    steps: [
      { id: "hear", type: "conversation", targetLocation: "黒嶺連合᠘", targetFacilityId: "LOC_BLACKRIDGE_COUNCIL", required: 1 },
      { id: "investigate", type: "investigate", targetLocation: "黒嶺連合領", targetFacilityId: "LOC_BLACKRIDGE_COUNCIL", required: 6 },
      { id: "battle", type: "battle", targetLocation: "黒嶺連合領", targetFacilityId: "LOC_BLACKRIDGE_BARRACKS", encounterId: "ENC-0075", required: 1 },
      { id: "resolve", type: "resolve", targetLocation: "黒嶺連合領", targetFacilityId: "LOC_BLACKRIDGE_COUNCIL", required: 1 },
    ],
  };
}

export function runtimeAt(
  facilityId = "LOC_BLACKRIDGE_COUNCIL",
  {
    location = "黒嶺連合領",
    day = 63,
    presences = {},
    troubleOverrides = {},
    worldFlags = {},
  } = {},
) {
  const definition = missionDefinition();
  const catalog = { special: [definition], byId: new Map([[definition.id, definition]]) };
  const npcStates = {};
  for (const npcId of [
    "NPC016", "NPC024", "NPC026", "NPC029", "NPC039", "NPC042",
    "NPC043", "NPC044", "NPC046", "NPC047", "NPC065", "NPC069",
    "NPC090", "NPC104", "NPC105", "NPC108",
  ]) {
    const presence = presences[npcId] ?? "present";
    npcStates[npcId] = {
      lifeStatus: presence === "dead" ? "dead" : "alive",
      presence,
      position: { hubId: location, facilityId },
    };
  }
  return {
    authoredMissionFlows: {},
    narrativeMemory: { semanticFlags: {}, localFacts: [] },
    playerKnowledge: {
      knownHubIds: new Set([location]),
      knownFacilityIds: new Set([facilityId]),
    },
    livingWorld: {
      model: { npcs: [] },
      npcStates,
      facilityRumors: {},
      knowledgeEvents: [],
      seededTroubleFacts: new Set(),
    },
    playerState: {
      absoluteMinute: day * 1440,
      day,
      player: {
        location,
        facilityId,
        knownRumorIds: new Set(["RUM-T19"]),
      },
      catalog,
      missions: {
        [MISSION_ID]: {
          status: "active",
          progress: { hear: 0, investigate: 0, battle: 0, resolve: 0 },
          discoveries: [],
        },
      },
      troubles: {
        T09: { status: "resolved" },
        T11: { status: "resolved" },
        T12: { status: "resolved" },
        T13: { status: "failed" },
        T14: { status: "resolved" },
        T15: { status: "resolved" },
        T16: { status: "resolved" },
        T17: { status: "resolved" },
        T18: { status: "resolved" },
        T19: { status: "active" },
        ...troubleOverrides,
      },
      rumors: [{ id: "RUM-T19", troubleId: "T19" }],
      progress: {
        missions: {
          attemptedTroubleIds: new Set(["T19"]),
          resolvedTroubleIds: new Set(),
          completedIds: new Set(),
        },
        travel: { visitedHubs: new Set([location]) },
      },
      worldFlags: {
        worldTreeFallen: true,
        forestMazeOpen: true,
        blackridgePermit: true,
        t18CapitalMainForcePreserved: true,
        ...worldFlags,
      },
      routeCache: {},
      history: [],
      authoritativePresentNpcIds: new Set(),
    },
  };
}

export const pack = () => AUTHORED_MISSION_FLOW_PACKS.find((entry) => entry.missionId === MISSION_ID);

export function prepareCompletedInvestigation(runtime, openingIndex = 0, evidenceIndex = 0) {
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  const missionPack = pack();
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  flow.openingChoiceId = missionPack.hearing.choices[openingIndex].id;
  flow.openingSourceId = AUTHORED_MISSION_CONTINUITY_CONTRACTS[FLOW_ID].introductionSources[0].id;
  flow.unlockedLeadIds = missionPack.investigation.leads.map((lead) => lead.id);
  flow.evidenceIds = missionPack.investigation.requiredEvidenceGroups.map((group) => group[evidenceIndex]);
  runtime.playerState.missions[MISSION_ID].progress.hear = 1;
  runtime.playerState.missions[MISSION_ID].progress.investigate = 6;
  return { missionPack, flow };
}

export { auditT19EvidenceProfiles };
