import * as base from "./authored-mission-t03-wolf-continuity.js";

export * from "./authored-mission-t03-wolf-continuity.js";

export const AUTHORED_MISSION_EVIDENCE_ONLY_PROGRESS_VERSION = "authored-mission-evidence-only-progress-v1";

function withoutMissionProgress(action) {
  if (!action) return action;
  const {
    stepId: _stepId,
    ...rest
  } = action;
  return rest;
}

function shouldNotAdvanceInvestigation(action) {
  return action?.t02SideChoice != null
    || action?.t02TerminalChoice != null
    || action?.t03SideChoice != null
    || action?.t03TerminalChoice != null;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions)) return actions;
  return actions.map((action) =>
    shouldNotAdvanceInvestigation(action) ? withoutMissionProgress(action) : action);
}

export const AUTHORED_MISSION_EVIDENCE_ONLY_PROGRESS_INTERNALS = Object.freeze({
  withoutMissionProgress,
  shouldNotAdvanceInvestigation,
});
