import * as base from "./authored-mission-evidence-only-progress.js";
import * as genericBase from "./authored-mission-t02-granary-choice-order.js";

export * from "./authored-mission-evidence-only-progress.js";

export const AUTHORED_MISSION_T03_INVESTIGATION_CONTRACT_VERSION =
  "authored-mission-t03-investigation-contract-v8";

const MISSION_ID = "MSN-T03";
const FLOW_ID = "red-fang-migration";
const REQUIRED_EVIDENCE_COUNT = 2;
const REQUIRED_EVIDENCE_CLASS = "apex_pressure";
const PASSIVE_CANONICAL_KINDS = new Set(["lead", "defer", "free_move"]);
const CANONICAL_EVIDENCE_BY_CLASS = Object.freeze({
  pack_displacement: "T03-EVIDENCE-ATTACKS-MOVING-INWARD",
  apex_pressure: "T03-EVIDENCE-APEX-PREDATOR-TRACKS",
  temporary_den: "T03-EVIDENCE-PANICKED-BITES",
});

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

function evidenceClasses(runtime) {
  return [...new Set(runtime?.t03WolfContinuity?.evidenceClasses ?? [])];
}

function independentEvidenceCount(runtime) {
  return evidenceClasses(runtime).length;
}

function investigationEvidenceProgress(runtime) {
  const classes = evidenceClasses(runtime);
  if (classes.length === 0) return 0;
  if (!classes.includes(REQUIRED_EVIDENCE_CLASS)) return 1;
  return Math.min(REQUIRED_EVIDENCE_COUNT, classes.length);
}

function investigationEvidenceSatisfied(runtime) {
  const step = investigationStep(missionEntry(runtime?.playerState?.catalog));
  const required = Math.max(
    REQUIRED_EVIDENCE_COUNT,
    Number(step?.required ?? REQUIRED_EVIDENCE_COUNT),
  );
  return investigationEvidenceProgress(runtime) >= required;
}

function canonicalEvidenceIds(runtime) {
  return evidenceClasses(runtime)
    .map((evidenceClass) => CANONICAL_EVIDENCE_BY_CLASS[evidenceClass])
    .filter(Boolean);
}

function syncCanonicalFlowEvidence(runtime) {
  if (!runtime?.playerState) return false;
  runtime.authoredMissionFlows ??= {};
  let flow = runtime.authoredMissionFlows[FLOW_ID] ?? null;
  if (!flow && typeof genericBase.ensureAuthoredMissionFlowState === "function") {
    flow = genericBase.ensureAuthoredMissionFlowState(runtime, FLOW_ID);
  }
  if (!flow) return false;

  let changed = false;
  const desiredEvidenceIds = canonicalEvidenceIds(runtime);
  const mergedEvidenceIds = [...new Set([
    ...(flow.evidenceIds ?? []),
    ...desiredEvidenceIds,
  ])];
  if (mergedEvidenceIds.length !== (flow.evidenceIds ?? []).length
    || mergedEvidenceIds.some((id, index) => id !== flow.evidenceIds?.[index])) {
    flow.evidenceIds = mergedEvidenceIds;
    changed = true;
  }

  if (!flow.openingChoiceId && runtime.t03WolfContinuity?.openingChoiceId) {
    flow.openingChoiceId = "legacy-completed-hearing";
    changed = true;
  }

  if (desiredEvidenceIds.length > 0) {
    if (flow.selectedLeadId != null) changed = true;
    if (flow.selectedLeadAtMinute != null) changed = true;
    if (flow.navigatorFocusId != null) changed = true;
    if (flow.navigatorGroupId != null) changed = true;
    flow.selectedLeadId = null;
    flow.selectedLeadAtMinute = null;
    flow.navigatorFocusId = null;
    flow.navigatorGroupId = null;
  }

  if (typeof genericBase.ensureAuthoredMissionFlowState === "function") {
    genericBase.ensureAuthoredMissionFlowState(runtime, FLOW_ID);
  }
  return changed;
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

function restoreInvestigationProgress(
  runtime,
  action,
  result,
  { recordHistory = true } = {},
) {
  if (result?.ok === false) return false;
  const mission = runtime?.playerState?.missions?.[MISSION_ID];
  const step = investigationStep(missionEntry(runtime?.playerState?.catalog));
  if (!mission || !step || mission.status !== "active") return false;

  const required = Math.max(
    REQUIRED_EVIDENCE_COUNT,
    Number(step.required ?? REQUIRED_EVIDENCE_COUNT),
  );
  const desired = Math.min(required, investigationEvidenceProgress(runtime));
  const current = Math.max(0, Number(mission.progress?.[step.id] ?? 0));
  if (desired <= current) return false;

  mission.progress ??= {};
  mission.progress[step.id] = desired;
  if (recordHistory) {
    runtime.playerState.history ??= [];
    runtime.playerState.history.push({
      type: "T03_INVESTIGATION_PROGRESS_RESTORED",
      minute: Number(runtime.playerState.absoluteMinute ?? 0),
      missionId: MISSION_ID,
      stepId: step.id,
      evidenceClass: action?.t03EvidenceClass ?? null,
      evidenceCount: desired,
      value: desired,
    });
  }
  return true;
}

export function reconcileAuthoredMissionFlowState(runtime) {
  const baseChanged = typeof base.reconcileAuthoredMissionFlowState === "function"
    ? base.reconcileAuthoredMissionFlowState(runtime)
    : false;
  const canonicalChanged = syncCanonicalFlowEvidence(runtime);
  const restored = restoreInvestigationProgress(
    runtime,
    null,
    { ok: true },
    { recordHistory: false },
  );
  return restored || canonicalChanged || baseChanged;
}

export function applyAuthoredMissionFlowCatalogOverrides(catalog) {
  const updated = base.applyAuthoredMissionFlowCatalogOverrides(catalog);
  const mission = missionEntry(updated);
  const step = investigationStep(mission);
  if (step) step.required = Math.max(REQUIRED_EVIDENCE_COUNT, Number(step.required ?? 1));
  return updated;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  reconcileAuthoredMissionFlowState(runtime);
  const canonical = canonicalT03Actions(runtime, context);
  const fallback = base.authoredMissionFlowExclusiveActions(runtime, context);
  reconcileAuthoredMissionFlowState(runtime);
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
  const canonicalChanged = syncCanonicalFlowEvidence(runtime);
  const restored = restoreInvestigationProgress(runtime, action, result);
  return restored || canonicalChanged || changed;
}

export const AUTHORED_MISSION_T03_INVESTIGATION_CONTRACT_INTERNALS = Object.freeze({
  MISSION_ID,
  FLOW_ID,
  REQUIRED_EVIDENCE_COUNT,
  REQUIRED_EVIDENCE_CLASS,
  PASSIVE_CANONICAL_KINDS,
  CANONICAL_EVIDENCE_BY_CLASS,
  missionEntry,
  investigationStep,
  currentMissionStep,
  evidenceClasses,
  independentEvidenceCount,
  investigationEvidenceProgress,
  investigationEvidenceSatisfied,
  canonicalEvidenceIds,
  syncCanonicalFlowEvidence,
  canonicalT03Actions,
  onlyPassiveCanonicalChoices,
  restoreInvestigationProgress,
});
