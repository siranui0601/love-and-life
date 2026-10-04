import * as base from "./authored-mission-t02-village-resolution.js";
import {
  authoredMissionFlowExclusiveActions as coreAuthoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance as coreAuthoredMissionFlowGuidance,
} from "./authored-mission-flow-core.js";

export * from "./authored-mission-t02-village-resolution.js";

export const AUTHORED_T02_VILLAGE_RESOLUTION_CORE_FIRST_VERSION =
  "authored-t02-village-resolution-core-first-v1";

const MISSION_ID = "MSN-T02";
const FLOW_ID = "granary-arson";

function coreResolutionActions(runtime, context = {}) {
  const actions = coreAuthoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions) || actions.length !== 3) return null;
  const resolution = actions.filter((action) =>
    action?.missionId === MISSION_ID
    && action?.authoredMissionFlowId === FLOW_ID
    && ["resolution", "resolution_preparation"].includes(action?.authoredMissionFlowKind));
  return resolution.length === 3 ? actions : null;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  // The village continuity layer added a useful evidence-review scene for old
  // saves, but it must never replace the actual final policy decision. When
  // the authored core can construct all three T02 resolution surfaces, those
  // are the player's decision. The one-choice review remains only as recovery
  // for a legacy/incomplete state where the core cannot build that decision.
  return coreResolutionActions(runtime, context)
    ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  if (coreResolutionActions(runtime, context)) {
    return coreAuthoredMissionFlowGuidance(runtime, context)
      ?? base.authoredMissionFlowGuidance(runtime, context);
  }
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, selected, result) {
  return base.applyAuthoredMissionFlowAction(runtime, selected, result);
}

export const AUTHORED_T02_VILLAGE_RESOLUTION_CORE_FIRST_INTERNALS = Object.freeze({
  MISSION_ID,
  FLOW_ID,
  coreResolutionActions,
});
