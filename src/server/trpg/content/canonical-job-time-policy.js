import * as base from "./canonical-social-obligations.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./canonical-social-obligations.js";

export const CANONICAL_JOB_TIME_POLICY_VERSION = "canonical-job-time-policy-v2";

const JOB_TIME_WINDOWS = Object.freeze({
  "JOB-FARM-01": [[360, 1020]],
  "JOB-FARM-02": [[600, 1020]],
  "JOB-FARM-03": [[360, 600], [960, 1260]],
  "JOB-FARM-04": [[1080, 1440]],
  "JOB-TRADE-01": [[360, 720]],
  "JOB-TRADE-02": [[900, 1260]],
  "JOB-TRADE-03": [[600, 1020]],
  "JOB-TRADE-04": [[600, 1020]],
  "JOB-CAP-01": [[360, 1020]],
  "JOB-CAP-02": [[360, 720]],
  "JOB-CAP-03": [[600, 1260]],
  "JOB-CAP-04": [[600, 1020]],
  "JOB-CRIME-01": [[960, 1320]],
  "JOB-CRIME-02": [[600, 1020]],
  "JOB-DWARF-01": [[360, 1020]],
  "JOB-DWARF-02": [[600, 1020]],
  "JOB-DWARF-03": [[600, 1020]],
  "JOB-DWARF-04": [[960, 1320]],
  "JOB-BORDER-01": [[360, 720]],
  "JOB-BORDER-02": [[600, 1020]],
  "JOB-BORDER-03": [[360, 1020]],
  "JOB-FORT-01": [[600, 1020]],
  "JOB-FORT-02": [[960, 1320]],
  "JOB-FORT-03": [[360, 1020]],
  "JOB-BLACK-01": [[360, 1020]],
  "JOB-BLACK-02": [[960, 1320]],
  "JOB-BLACK-03": [[600, 1020]],
  "JOB-FOREST-01": [[360, 720]],
});

function minuteOfDay(runtime) {
  const absolute = Number(runtime?.playerState?.absoluteMinute);
  if (Number.isFinite(absolute)) {
    // Production epoch is Day1 10:00 == absoluteMinute 0. Never interpret the
    // elapsed-minute counter itself as a wall-clock minute-of-day.
    return clockFromMinute(absolute).minuteOfDay;
  }
  const hour = Math.max(0, Math.min(23, Number(runtime?.playerState?.hour ?? 0)));
  const minute = Math.max(0, Math.min(59, Number(runtime?.playerState?.minute ?? 0)));
  return hour * 60 + minute;
}

function jobTimeAllowed(runtime, action) {
  const jobId = String(action?.canonicalRegionalJobId ?? "");
  if (!jobId) return true;
  const windows = JOB_TIME_WINDOWS[jobId];
  if (!windows?.length) return false;
  const start = minuteOfDay(runtime);
  const duration = Math.max(0, Number(action.minutes ?? 0));
  const finish = start + duration;
  return windows.some(([from, to]) => start >= from && finish <= to);
}

function filterActions(runtime, actions) {
  if (!Array.isArray(actions)) return actions;
  const filtered = actions.filter((action) => jobTimeAllowed(runtime, action));
  return filtered.length ? filtered : null;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return filterActions(runtime, base.authoredMissionFlowExclusiveActions(runtime, context));
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const actions = authoredMissionFlowExclusiveActions(runtime, context);
  if (!actions?.length) return null;
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  if (actionValue?.canonicalRegionalLabourChoice && !jobTimeAllowed(runtime, actionValue)) {
    result.ok = false;
    result.code = "canonical_job_outside_time_window";
    result.summary = "この仕事の正本上の勤務時間帯ではない。";
    return true;
  }
  return base.applyAuthoredMissionFlowAction(runtime, actionValue, result);
}

export const CANONICAL_JOB_TIME_POLICY_INTERNALS = Object.freeze({
  JOB_TIME_WINDOWS,
  minuteOfDay,
  jobTimeAllowed,
  filterActions,
});