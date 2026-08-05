import * as witness from "./authored-mission-flow-t11-witness-network.js";
import * as previous from "./authored-mission-flow-human-route-warning-wait.js";

export * from "./authored-mission-flow-t11-witness-network.js";

export const AUTHORED_T11_WITNESS_NETWORK_ENTRY_VERSION =
  "authored-t11-witness-network-entry-v1";

const PRIOR_HISTORY_PREFIXES = Object.freeze([
  "T01_AFTERCARE_",
  "DAY2_",
  "DAY8_T03_",
]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function witnessStateStarted(runtime) {
  const state = runtime?.playerState?.t11WitnessNetworkFlow;
  return Number(state?.stage ?? 0) > 0
    || array(state?.selectedActionIds).length > 0
    || state?.routePlanCompletedAtMinute != null;
}

function day1RelationshipEstablished(runtime) {
  const aftercare = runtime?.playerState?.day1T01Aftercare;
  return aftercare?.aftercareCompletedAtMinute != null
    || aftercare?.supperCompletedAtMinute != null;
}

function savedCompanionHistory(runtime) {
  return array(runtime?.playerState?.history).some((entry) => {
    const type = String(entry?.type ?? "");
    return PRIOR_HISTORY_PREFIXES.some((prefix) => type.startsWith(prefix));
  });
}

function hasPriorCompanionCausality(runtime) {
  return witnessStateStarted(runtime)
    || day1RelationshipEstablished(runtime)
    || savedCompanionHistory(runtime);
}

function containsWitnessNetworkActions(actions) {
  return array(actions).some((action) => action?.authoredT11WitnessNetworkChoice === true);
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const candidate = witness.authoredMissionFlowExclusiveActions(runtime, context);
  if (containsWitnessNetworkActions(candidate) && !hasPriorCompanionCausality(runtime)) {
    return previous.authoredMissionFlowExclusiveActions(runtime, context);
  }
  return candidate;
}

export function authoredMissionFlowGuidance(runtime) {
  const candidateActions = witness.authoredMissionFlowExclusiveActions(runtime, {});
  if (containsWitnessNetworkActions(candidateActions) && !hasPriorCompanionCausality(runtime)) {
    return previous.authoredMissionFlowGuidance(runtime);
  }
  return witness.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  return witness.applyAuthoredMissionFlowAction(runtime, action, result);
}

export const AUTHORED_T11_WITNESS_NETWORK_ENTRY_INTERNALS = Object.freeze({
  PRIOR_HISTORY_PREFIXES,
  witnessStateStarted,
  day1RelationshipEstablished,
  savedCompanionHistory,
  hasPriorCompanionCausality,
  containsWitnessNetworkActions,
});
