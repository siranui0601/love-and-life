import * as route from "./authored-mission-flow-human-route-t04-t17-aftermath.js";
import * as baseline from "./authored-mission-flow-t11-witness-network-entry.js";
export * from "./authored-mission-flow-human-route-t04-t17-aftermath.js";

export const AUTHORED_HUMAN_ROUTE_CAUSALITY_GATE_VERSION = "authored-human-route-causality-gate-v1";

const CAUSAL_HISTORY_PATTERN = /^(?:T01_AFTERCARE_|DAY2_HUNTER_|DAY2_VILLAGE_|DAY8_)/u;
const CAUSAL_ACTION_PATTERN = /^MISSION_FLOW:(?:T01|T03):/u;
const RELAY_GUIDANCE_TITLES = new Set([
  "帰らない巡礼者",
  "到着した者と帰らない者",
  "ファルコが隠した三つの事実",
]);

function historyEntries(runtime) {
  return Array.isArray(runtime?.playerState?.history) ? runtime.playerState.history : [];
}

function hasStartedRelay(runtime) {
  return Number(runtime?.playerState?.humanT04PilgrimRelay?.stage ?? 0) > 0
    || Number(runtime?.playerState?.humanT04T17Aftermath?.stage ?? 0) > 0;
}

function hasCompanionCausality(runtime) {
  if (hasStartedRelay(runtime)) return true;
  return historyEntries(runtime).some((entry) => {
    const type = String(entry?.type ?? "");
    const actionId = String(entry?.actionId ?? "");
    return CAUSAL_HISTORY_PATTERN.test(type)
      || (CAUSAL_ACTION_PATTERN.test(actionId)
        && /(?:HELP|RESCUE|WATCH|HUNTER|VILLAGE|COMMUNITY|LIVESTOCK)/iu.test(actionId));
  });
}

function isRelayAction(action) {
  return Boolean(
    action?.authoredHumanT04RelayChoice
    || action?.authoredHumanT04FalcoProxy
    || action?.authoredHumanT04T17AftermathChoice,
  );
}

function containsRelayAction(actions) {
  return Array.isArray(actions) && actions.some(isRelayAction);
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = route.authoredMissionFlowExclusiveActions(runtime, context);
  if (hasCompanionCausality(runtime) || !containsRelayAction(actions)) return actions;
  return baseline.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  const guidance = route.authoredMissionFlowGuidance(runtime);
  if (hasCompanionCausality(runtime) || !RELAY_GUIDANCE_TITLES.has(String(guidance?.title ?? ""))) {
    return guidance;
  }
  return baseline.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  if (isRelayAction(actionValue) && !hasCompanionCausality(runtime)) return false;
  return route.applyAuthoredMissionFlowAction(runtime, actionValue, result);
}

export const AUTHORED_HUMAN_ROUTE_CAUSALITY_GATE_INTERNALS = Object.freeze({
  CAUSAL_HISTORY_PATTERN,
  CAUSAL_ACTION_PATTERN,
  RELAY_GUIDANCE_TITLES,
  historyEntries,
  hasStartedRelay,
  hasCompanionCausality,
  isRelayAction,
  containsRelayAction,
});