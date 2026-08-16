import * as base from "./canonical-world-life-actions.js";

export * from "./canonical-world-life-actions.js";

export const CANONICAL_PUBLIC_ACTION_POLICY_VERSION = "canonical-public-action-policy-v1";

function playerState(runtime) {
  return runtime?.playerState ?? {};
}

function progress(runtime) {
  return playerState(runtime).progress ?? playerState(runtime).player?.progress ?? {};
}

function currentDay(runtime) {
  return Number(playerState(runtime).day ?? 1);
}

function truthyProgress(runtime, ...keys) {
  const p = progress(runtime);
  return keys.some((key) => Boolean(p?.[key]));
}

function permittedRegionalJob(runtime, action) {
  const jobId = String(action?.canonicalRegionalJobId ?? "");
  if (!jobId) return true;

  if (jobId.startsWith("JOB-FORT-")) {
    return truthyProgress(runtime, "fortEntryPermit", "fort_entry_permit");
  }
  if (jobId === "JOB-BLACK-01" || jobId === "JOB-BLACK-03") {
    return truthyProgress(runtime, "blackridgeEntryPermit", "blackridge_entry_permit");
  }
  if (jobId === "JOB-FOREST-01") {
    return truthyProgress(runtime, "hunterApproval", "hunter_approval");
  }
  return true;
}

function sameDayPortWork(runtime) {
  const day = currentDay(runtime);
  const lifeDay = Number(playerState(runtime).canonicalWorldLife?.lastPortWorkDay ?? 0);
  const labourDay = Number(playerState(runtime).canonicalRegionalLabour?.lastDayByFacility?.LOC_TRADE_PORT ?? 0);
  return lifeDay === day || labourDay === day;
}

function permittedLifeAction(runtime, action) {
  const id = String(action?.id ?? action?.actionId ?? "");
  if (id === "LIFE:SLEEP:ITM222") return sameDayPortWork(runtime);
  if (["LIFE:SLEEP:ITM159", "LIFE:EAT:ITM160", "LIFE:EAT:ITM161", "LIFE:BUY:ITM163", "SERVICE_BUY:ITM175"].includes(id)) {
    return truthyProgress(runtime, "fortEntryPermit", "fort_entry_permit");
  }
  return true;
}

function canonicalAllowed(runtime, action) {
  return permittedRegionalJob(runtime, action) && permittedLifeAction(runtime, action);
}

function filtered(actions, runtime) {
  if (!Array.isArray(actions)) return actions;
  const kept = actions.filter((action) => canonicalAllowed(runtime, action));
  return kept.length ? kept : null;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return filtered(base.authoredMissionFlowExclusiveActions(runtime, context), runtime);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const actions = authoredMissionFlowExclusiveActions(runtime, context);
  if (!actions?.length) return null;
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  if (!canonicalAllowed(runtime, actionValue)) {
    result.ok = false;
    result.code = "canonical_prerequisite_not_met";
    result.summary = "この行動に必要な許可・当日勤務条件を満たしていない。";
    return true;
  }
  return base.applyAuthoredMissionFlowAction(runtime, actionValue, result);
}

export const CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS = Object.freeze({
  permittedRegionalJob,
  sameDayPortWork,
  permittedLifeAction,
  canonicalAllowed,
});
