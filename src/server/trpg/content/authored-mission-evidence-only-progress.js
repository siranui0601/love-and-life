import * as base from "./authored-mission-t03-wolf-continuity.js";

export * from "./authored-mission-t03-wolf-continuity.js";

export const AUTHORED_MISSION_EVIDENCE_ONLY_PROGRESS_VERSION = "authored-mission-evidence-only-progress-v2";

const T03_MISSION_ID = "MSN-T03";

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

function t03InvestigationContract(runtime) {
  const mission = runtime?.playerState?.missions?.[T03_MISSION_ID];
  const byId = runtime?.playerState?.catalog?.byId;
  const definition = typeof byId?.get === "function"
    ? byId.get(T03_MISSION_ID)
    : byId?.[T03_MISSION_ID];
  const step = definition?.steps?.find((entry) =>
    entry.id === "investigate" || entry.type === "investigate");
  return { mission, step };
}

function t03InvestigationComplete(runtime) {
  const { mission, step } = t03InvestigationContract(runtime);
  if (!mission || !step) return false;
  return Number(mission.progress?.[step.id] ?? 0) >= Number(step.required ?? 1);
}

function syncT03EvidenceProgress(runtime, action, result) {
  if (result?.ok === false || action?.t03EvidenceClass == null) return false;
  const { mission, step } = t03InvestigationContract(runtime);
  if (!mission || !step || mission.status !== "active") return false;

  const distinctEvidenceCount = new Set(
    runtime?.t03WolfContinuity?.evidenceClasses ?? [],
  ).size;
  const required = Math.max(1, Number(step.required ?? 1));
  const current = Math.max(0, Number(mission.progress?.[step.id] ?? 0));
  const desired = Math.min(required, distinctEvidenceCount);
  if (desired <= current) return false;

  mission.progress ??= {};
  mission.progress[step.id] = desired;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "T03_EVIDENCE_PROGRESS_SYNCED",
    minute: Number(runtime?.playerState?.absoluteMinute ?? 0),
    missionId: T03_MISSION_ID,
    stepId: step.id,
    evidenceClass: action.t03EvidenceClass,
    value: desired,
  });
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions)) return actions;
  if (actions.some((action) => action?.authoredT03WolfChoice === true)
    && t03InvestigationComplete(runtime)) return null;
  return actions.map((action) =>
    shouldNotAdvanceInvestigation(action) ? withoutMissionProgress(action) : action);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  const synced = syncT03EvidenceProgress(runtime, action, result);
  return synced || changed;
}

export const AUTHORED_MISSION_EVIDENCE_ONLY_PROGRESS_INTERNALS = Object.freeze({
  T03_MISSION_ID,
  withoutMissionProgress,
  shouldNotAdvanceInvestigation,
  t03InvestigationContract,
  t03InvestigationComplete,
  syncT03EvidenceProgress,
});
