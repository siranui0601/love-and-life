import * as previous from "./authored-mission-flow-human-route-t04-falco-entry.js";
import {
  authoredMissionFlowGuidance as t01Guidance,
  AUTHORED_HUMAN_ROUTE_ENTRY_INTERNALS as t01Entry,
} from "./authored-mission-flow-human-route-entry.js";
export * from "./authored-mission-flow-human-route-t04-falco-entry.js";

export const AUTHORED_HUMAN_ROUTE_T04_FALCO_PROGRESS_SYNC_VERSION =
  "authored-human-route-t04-falco-progress-sync-v3";

const MISSION_ID = "MSN-T04";

function mission(runtime, id) {
  const missions = runtime?.playerState?.missions;
  if (Array.isArray(missions)) return missions.find((entry) => entry?.id === id) ?? null;
  if (missions instanceof Map) return missions.get(id) ?? null;
  return missions?.[id] ?? null;
}

function exactT01Actions(runtime) {
  const actions = t01Entry.ownActions(runtime);
  return Array.isArray(actions) && actions.length > 0 ? actions : null;
}

function syncFalcoHearingProgress(runtime, action) {
  if (!action?.authoredHumanT04FalcoEntryChoice) return false;
  const target = mission(runtime, MISSION_ID);
  if (!target) return false;
  target.progress ??= {};
  target.progress.hear = Math.max(1, Number(target.progress.hear ?? 0));
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return exactT01Actions(runtime)
    ?? previous.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (exactT01Actions(runtime) != null) return t01Guidance(runtime);
  return previous.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const applied = previous.applyAuthoredMissionFlowAction(runtime, action, result);
  if (!applied) return false;
  syncFalcoHearingProgress(runtime, action);
  return true;
}

export const AUTHORED_HUMAN_ROUTE_T04_FALCO_PROGRESS_SYNC_INTERNALS = Object.freeze({
  MISSION_ID,
  mission,
  exactT01Actions,
  syncFalcoHearingProgress,
});
