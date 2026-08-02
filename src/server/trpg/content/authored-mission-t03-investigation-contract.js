import * as base from "./authored-mission-evidence-only-progress.js";

export * from "./authored-mission-evidence-only-progress.js";

export const AUTHORED_MISSION_T03_INVESTIGATION_CONTRACT_VERSION =
  "authored-mission-t03-investigation-contract-v1";

const MISSION_ID = "MSN-T03";
const REQUIRED_EVIDENCE_COUNT = 2;

function missionEntry(catalog) {
  return catalog?.special?.find((entry) => entry.id === MISSION_ID)
    ?? (typeof catalog?.byId?.get === "function" ? catalog.byId.get(MISSION_ID) : null)
    ?? null;
}

function investigationStep(mission) {
  return mission?.steps?.find((step) =>
    step.id === "investigate" || step.type === "investigate") ?? null;
}

export function applyAuthoredMissionFlowCatalogOverrides(catalog) {
  const updated = base.applyAuthoredMissionFlowCatalogOverrides(catalog);
  const mission = missionEntry(updated);
  const step = investigationStep(mission);
  if (step) step.required = Math.max(REQUIRED_EVIDENCE_COUNT, Number(step.required ?? 1));
  return updated;
}

export const AUTHORED_MISSION_T03_INVESTIGATION_CONTRACT_INTERNALS = Object.freeze({
  MISSION_ID,
  REQUIRED_EVIDENCE_COUNT,
  missionEntry,
  investigationStep,
});
