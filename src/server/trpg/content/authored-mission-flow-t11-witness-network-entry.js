import * as witness from "./authored-mission-flow-t11-witness-network.js";
import * as previous from "./authored-mission-flow-human-route-warning-wait.js";

export * from "./authored-mission-flow-t11-witness-network.js";

export const AUTHORED_T11_WITNESS_NETWORK_ENTRY_VERSION =
  "authored-t11-witness-network-entry-v2";

const PRIOR_HISTORY_PREFIXES = Object.freeze([
  "T01_AFTERCARE_",
  "DAY2_",
  "DAY8_T03_",
]);

const STANDARD_FAMILY_BY_CHOICE = Object.freeze({
  escort_crow: "rescue",
  copy_ledger: "observation",
  watch_back_door: "observation",
  ask_vera_for_room: "rescue",
  send_cipher_to_kiri: "coordination",
  ask_jericho_to_freeze_horses: "logistics",
  seat_ren_with_crow: "diplomacy",
  interview_separately: "observation",
  send_ledger_without_witnesses: "non_intervention",
  trace_with_kiri: "coordination",
  verify_coded_bill: "observation",
  hide_ledger_for_now: "non_intervention",
  visit_noah: "rescue",
  read_milan_ledger: "observation",
  request_royal_schedule: "diplomacy",
  build_victor_counterline: "coordination",
  prepare_decoy_schedule: "observation",
  order_horse_records: "logistics",
  protect_witnesses_and_move_king: "rescue",
  prepare_public_testimony: "diplomacy",
  ask_ren_for_false_success: "coordination",
  attend_ren_debrief: "rescue",
  return_noah_map: "social",
  thank_vera: "social",
});

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

function normalizeWitnessActionFamilies(actions) {
  return array(actions).map((action) => {
    if (!action?.authoredT11WitnessNetworkChoice) return action;
    const family = STANDARD_FAMILY_BY_CHOICE[action.authoredT11WitnessNetworkChoiceId];
    return family ? { ...action, family } : action;
  });
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const candidate = witness.authoredMissionFlowExclusiveActions(runtime, context);
  if (containsWitnessNetworkActions(candidate) && !hasPriorCompanionCausality(runtime)) {
    return previous.authoredMissionFlowExclusiveActions(runtime, context);
  }
  return containsWitnessNetworkActions(candidate)
    ? normalizeWitnessActionFamilies(candidate)
    : candidate;
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
  STANDARD_FAMILY_BY_CHOICE,
  witnessStateStarted,
  day1RelationshipEstablished,
  savedCompanionHistory,
  hasPriorCompanionCausality,
  containsWitnessNetworkActions,
  normalizeWitnessActionFamilies,
});
