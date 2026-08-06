import * as base from "./authored-weather-ambient-continuity.js";
import {
  AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_VERSION,
  AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_INTERNALS as interlude,
} from "./authored-mission-flow-t13-workshop-interlude.js";

export * from "./authored-weather-ambient-continuity.js";
export {
  AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_VERSION,
  AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_INTERNALS,
} from "./authored-mission-flow-t13-workshop-interlude.js";

export const AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_TOP_VERSION =
  `${AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_VERSION}-top-v2`;

function array(value) {
  return Array.isArray(value) ? value : [];
}

function hasPriorCapitalVisit(runtime) {
  const state = runtime?.playerState ?? {};
  const player = state.player ?? state;
  const directCollections = [
    state.visitedLocations,
    state.knownLocations,
    state.discoveredLocations,
    player.visitedLocations,
    player.knownLocations,
    player.discoveredLocations,
  ];
  if (directCollections.some((entries) => array(entries).map(String).includes("王都"))) {
    return true;
  }
  if (state.worldFlags?.capitalArrivalGuidance?.arrivedAtMinute != null
    || state.worldFlags?.capitalVisited === true) {
    return true;
  }
  return array(state.history).some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    return [
      entry.location,
      entry.hub,
      entry.destinationHub,
      entry.targetLocation,
      entry.fromLocation,
      entry.toLocation,
    ].map(String).includes("王都");
  });
}

function workshopInterludeEligible(runtime) {
  return hasPriorCapitalVisit(runtime) && interlude.workshopInterludeEligible(runtime);
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === "forest-king-slime-world-tree-collapse") {
    interlude.ensureInterludeState(flow);
  }
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === "forest-king-slime-world-tree-collapse") {
    interlude.ensureInterludeState(flow);
  }
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  if (workshopInterludeEligible(runtime)) {
    const actions = interlude.workshopInterludeActions(runtime, context);
    if (actions) return actions;
  }
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (workshopInterludeEligible(runtime)) {
    return {
      missionId: "MSN-T13",
      kicker: "排水輪の試作が止まった",
      title: "ミーナが図面を畳む間、工房でどう過ごすか",
      detail: "水を飲んでも、作業を手伝っても、王都へ出てもよい。どれも同じ結果にはならない。",
      targetLocation: "ドワーフ洞窟",
      targetFacilityId: "LOC_DWARF_ENGINEER",
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return interlude.consumeWorkshopInterlude(runtime, action, result) || changed;
}

export const AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_TOP_INTERNALS = Object.freeze({
  array,
  hasPriorCapitalVisit,
  workshopInterludeEligible,
});
