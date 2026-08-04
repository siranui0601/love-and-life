import * as base from "./authored-mission-flow-day8-t03-community-followthrough.js";

export * from "./authored-mission-flow-day8-t03-community-followthrough.js";

export const AUTHORED_HUMAN_COMPANION_CAUSALITY_VERSION = "authored-human-companion-causality-v2";

const SOURCE_HISTORY = "DAY2_HUNTER_LIVESTOCK_MOVED";
const APPLIED_HISTORY = "T03_EARLY_LIVESTOCK_EVACUATION_INHERITED";

function array(value) { return Array.isArray(value) ? value : []; }

function hasHistory(runtime, type) {
  return array(runtime?.playerState?.history).some((entry) => entry?.type === type);
}

function ensureT03State(runtime) {
  runtime.t03WolfContinuity ??= {
    version: "t03-wolf-continuity-v1",
    openingChoiceId: null,
    evidenceClasses: [],
    sideChoices: [],
    terminalChoiceId: null,
    selectedActionIds: [],
    sceneRevision: 0,
    startedAtMinute: Number(runtime?.playerState?.absoluteMinute ?? 0),
    lastChangedAtMinute: null,
  };
  const state = runtime.t03WolfContinuity;
  state.evidenceClasses = [...new Set(array(state.evidenceClasses).map(String))];
  state.sideChoices = [...new Set(array(state.sideChoices).map(String))];
  state.selectedActionIds = [...new Set(array(state.selectedActionIds).map(String))];
  return state;
}

function synchronizeEarlyCausality(runtime) {
  if (!hasHistory(runtime, SOURCE_HISTORY)) return false;
  const state = ensureT03State(runtime);
  if (state.sideChoices.includes("evacuate_livestock")) return false;

  state.sideChoices.push("evacuate_livestock");
  state.sceneRevision = Math.max(0, Number(state.sceneRevision ?? 0)) + 1;
  state.lastChangedAtMinute = Number(runtime?.playerState?.absoluteMinute ?? 0);

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags.t03LivestockEvacuated = true;
  runtime.playerState.worldFlags.t03StableTracksTrampled = true;
  runtime.playerState.worldFlags.t03EarlyAidInherited = true;

  if (!hasHistory(runtime, APPLIED_HISTORY)) {
    runtime.playerState.history.push({
      type: APPLIED_HISTORY,
      minute: state.lastChangedAtMinute,
      missionId: "MSN-T03",
      troubleId: "T03",
      sourceHistoryType: SOURCE_HISTORY,
      inheritedSideChoice: "evacuate_livestock",
    });
  }
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  synchronizeEarlyCausality(runtime);
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  synchronizeEarlyCausality(runtime);
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return synchronizeEarlyCausality(runtime) || changed;
}

export const AUTHORED_HUMAN_COMPANION_CAUSALITY_INTERNALS = Object.freeze({
  SOURCE_HISTORY,
  APPLIED_HISTORY,
  hasHistory,
  ensureT03State,
  synchronizeEarlyCausality,
});
