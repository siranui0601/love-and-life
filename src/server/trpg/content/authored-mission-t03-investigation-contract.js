import * as base from "./authored-mission-evidence-only-progress.js";
import * as genericBase from "./authored-mission-t02-granary-choice-order.js";

export * from "./authored-mission-evidence-only-progress.js";

export const AUTHORED_MISSION_T03_INVESTIGATION_CONTRACT_VERSION =
  "authored-mission-t03-investigation-contract-v4";

const MISSION_ID = "MSN-T03";
const FLOW_ID = "red-fang-migration";
const REQUIRED_EVIDENCE_COUNT = 2;
const PASSIVE_CANONICAL_KINDS = new Set(["lead", "defer", "free_move"]);

function missionEntry(catalog) {
  return catalog?.special?.find((entry) => entry.id === MISSION_ID)
    ?? (typeof catalog?.byId?.get === "function" ? catalog.byId.get(MISSION_ID) : null)
    ?? null;
}

function investigationStep(mission) {
  return mission?.steps?.find((step) =>
    step.id === "investigate" || step.type === "investigate") ?? null;
}

function currentMissionStep(runtime) {
  const mission = runtime?.playerState?.missions?.[MISSION_ID];
  const definition = missionEntry(runtime?.playerState?.catalog);
  if (!mission || !definition) return null;
  return definition.steps?.find((step) =>
    Number(mission.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function independentEvidenceCount(runtime) {
  return new Set(runtime?.t03WolfContinuity?.evidenceClasses ?? []).size;
}

function investigationEvidenceSatisfied(runtime) {
  const step = investigationStep(missionEntry(runtime?.playerState?.catalog));
  const required = Math.max(
    REQUIRED_EVIDENCE_COUNT,
    Number(step?.required ?? REQUIRED_EVIDENCE_COUNT),
  );
  return independentEvidenceCount(runtime) >= required;
}

function canonicalT03Actions(runtime, context) {
  const mission = runtime?.playerState?.missions?.[MISSION_ID];
  if (mission?.status !== "active") return null;
  const actions = genericBase.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions) || actions.length === 0) return null;
  return actions.some((action) =>
    action?.missionId === MISSION_ID
      || action?.authoredMissionFlowId === FLOW_ID)
    ? actions
    : null;
}

function onlyPassiveCanonicalChoices(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) =>
      PASSIVE_CANONICAL_KINDS.has(action?.authoredMissionFlowKind));
}

function restoreInvestigationProgress(runtime, action, result) {
  if (result?.ok === false || action?.t03EvidenceClass == null) return false;
  const mission = runtime?.playerState?.missions?.[MISSION_ID];
  const step = investigationStep(missionEntry(runtime?.playerState?.catalog));
  if (!mission || !step || mission.status !== "active") return false;

  const required = Math.max(
    REQUIRED_EVIDENCE_COUNT,
    Number(step.required ?? REQUIRED_EVIDENCE_COUNT),
  );
  const desired = Math.min(required, independentEvidenceCount(runtime));
  const current = Math.max(0, Number(mission.progress?.[step.id] ?? 0));
  if (desired <= current) return false;

  mission.progress ??= {};
  mission.progress[step.id] = desired;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "T03_INVESTIGATION_PROGRESS_RESTORED",
    minute: Number(runtime.playerState.absoluteMinute ?? 0),
    missionId: MISSION_ID,
    stepId: step.id,
    evidenceClass: action.t03EvidenceClass,
    value: desired,
  });
  return true;
}

export function applyAuthoredMissionFlowCatalogOverrides(catalog) {
  const updated = base.applyAuthoredMissionFlowCatalogOverrides(catalog);
  const mission = missionEntry(updated);
  const step = investigationStep(mission);
  if (step) step.required = Math.max(REQUIRED_EVIDENCE_COUNT, Number(step.required ?? 1));
  return updated;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const canonical = canonicalT03Actions(runtime, context);
  const fallback = base.authoredMissionFlowExclusiveActions(runtime, context);
  const fallbackIsT03 = Array.isArray(fallback)
    && fallback.some((action) => action?.authoredT03WolfChoice === true);
  const actions = fallbackIsT03 && onlyPassiveCanonicalChoices(canonical)
    ? fallback
    : canonical ?? fallback;

  if (Array.isArray(actions)
    && actions.some((action) => action?.authoredT03WolfChoice === true)
    && investigationEvidenceSatisfied(runtime)) return null;
  return actions;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  const restored = restoreInvestigationProgress(runtime, action, result);
  return restored || changed;
}

export const AUTHORED_MISSION_T03_INVESTIGATION_CONTRACT_INTERNALS = Object.freeze({
  MISSION_ID,
  FLOW_ID,
  REQUIRED_EVIDENCE_COUNT,
  PASSIVE_CANONICAL_KINDS,
  missionEntry,
  investigationStep,
  currentMissionStep,
  independentEvidenceCount,
  investigationEvidenceSatisfied,
  canonicalT03Actions,
  onlyPassiveCanonicalChoices,
  restoreInvestigationProgress,
});
