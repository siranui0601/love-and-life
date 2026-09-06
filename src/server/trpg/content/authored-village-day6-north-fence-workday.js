import * as base from "./authored-mission-t03-local-life.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-mission-t03-local-life.js";

export const AUTHORED_VILLAGE_DAY6_NORTH_FENCE_WORKDAY_VERSION = "authored-village-day6-north-fence-workday-v3";

// Day6, Day7 and Day8 all reach the north fence before its canonical 18:00
// watch. The ordinary work before/after the Sheet-backed shift is route-neutral
// village life: no Human Virtue flag, no clock mutation, and no generic REST
// padding. Day8 uses the same public work surface before the first wolf howl.
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_NORTH_FENCE";
const SUPPORTED_DAYS = new Set([6, 7, 8]);
const AFTERNOON_OPEN_MINUTE = 14 * 60;
const SHIFT_OPEN_MINUTE = 18 * 60;
const SHIFT_CLOSE_MINUTE = 22 * 60;
const TARGET_SLEEP_MINUTE = 22 * 60 + 30;
const NEEDS_CALM_THRESHOLD = 72;
const JOB_ID = "JOB-FARM-04";
const MAINTENANCE_MINUTES_BY_DAY = Object.freeze({ 6: 90, 7: 30, 8: 90 });

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function clock(runtime) {
  return clockFromMinute(Number(runtime?.playerState?.absoluteMinute ?? 0));
}

function currentDay(runtime) {
  return clock(runtime).day;
}

function stateKey(runtime) {
  return `villageDay${currentDay(runtime)}NorthFenceWorkday`;
}

function actionPrefix(runtime) {
  return `DAILY_LIFE:DAY${currentDay(runtime)}_NORTH_FENCE_WORKDAY`;
}

function actionIds(runtime) {
  const prefix = actionPrefix(runtime);
  return {
    maintenance: `${prefix}:check_posts_and_lanterns`,
    watchPrep: `${prefix}:prepare_watch_handover`,
    winddown: `${prefix}:finish_watch_notes`,
  };
}

function needValue(runtime, key) {
  const current = player(runtime);
  for (const candidate of [current?.needs?.[key], current?.[key], runtime?.playerState?.[key]]) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function needsAreCalm(runtime) {
  return needValue(runtime, "hunger") < NEEDS_CALM_THRESHOLD
    && needValue(runtime, "fatigue") < NEEDS_CALM_THRESHOLD;
}

function atFence(runtime) {
  const current = player(runtime);
  return current.location === LOCATION
    && current.facilityId === FACILITY_ID
    && SUPPORTED_DAYS.has(currentDay(runtime));
}

function readState(runtime) {
  const value = runtime?.playerState?.[stateKey(runtime)];
  return value && typeof value === "object" ? value : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  const key = stateKey(runtime);
  runtime.playerState[key] ??= {
    version: AUTHORED_VILLAGE_DAY6_NORTH_FENCE_WORKDAY_VERSION,
    day: currentDay(runtime),
    maintenanceCompletedAtMinute: null,
    watchPrepCompletedAtMinute: null,
    windDownCompletedAtMinute: null,
  };
  const state = runtime.playerState[key];
  state.version = AUTHORED_VILLAGE_DAY6_NORTH_FENCE_WORKDAY_VERSION;
  state.day = currentDay(runtime);
  return state;
}

function completedShiftToday(runtime) {
  const labour = runtime?.playerState?.canonicalRegionalLabour;
  return Number(labour?.lastDayByFacility?.[FACILITY_ID] ?? 0) === currentDay(runtime)
    && Number(labour?.shifts?.[JOB_ID] ?? 0) > 0;
}

function minutesUntil(runtime, targetMinute) {
  return Math.max(1, targetMinute - clock(runtime).minuteOfDay);
}

function maintenanceMinutes(runtime) {
  return Math.min(
    Number(MAINTENANCE_MINUTES_BY_DAY[currentDay(runtime)] ?? 30),
    minutesUntil(runtime, SHIFT_OPEN_MINUTE),
  );
}

function maintenanceEligible(runtime) {
  const current = clock(runtime);
  return atFence(runtime)
    && current.minuteOfDay >= AFTERNOON_OPEN_MINUTE
    && current.minuteOfDay < SHIFT_OPEN_MINUTE
    && !completedShiftToday(runtime)
    && readState(runtime)?.maintenanceCompletedAtMinute == null
    && needsAreCalm(runtime);
}

function watchPrepEligible(runtime) {
  const current = clock(runtime);
  const state = readState(runtime);
  return atFence(runtime)
    && current.minuteOfDay < SHIFT_OPEN_MINUTE
    && !completedShiftToday(runtime)
    && state?.maintenanceCompletedAtMinute != null
    && state?.watchPrepCompletedAtMinute == null
    && needsAreCalm(runtime);
}

function windDownEligible(runtime) {
  const current = clock(runtime);
  return atFence(runtime)
    && current.minuteOfDay >= SHIFT_CLOSE_MINUTE
    && current.minuteOfDay < TARGET_SLEEP_MINUTE
    && completedShiftToday(runtime)
    && readState(runtime)?.windDownCompletedAtMinute == null
    && needsAreCalm(runtime);
}

function action(id, phase, family, minutes, label) {
  return {
    id,
    actionId: id,
    family,
    type: "plan",
    minutes,
    label,
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredVillageDay6NorthFenceWorkdayChoice: true,
    authoredVillageDay6NorthFenceWorkdayPhase: phase,
    authoredVillageNorthFenceWorkdayDay: null,
  };
}

function maintenanceAction(runtime) {
  const ids = actionIds(runtime);
  return {
    ...action(
      ids.maintenance,
      "maintenance",
      "help",
      maintenanceMinutes(runtime),
      "夕方の見張り前に柵杭・綱・灯具を点検する",
    ),
    authoredVillageNorthFenceWorkdayDay: currentDay(runtime),
  };
}

function watchPrepAction(runtime) {
  const ids = actionIds(runtime);
  return {
    ...action(
      ids.watchPrep,
      "watch-prep",
      "prepare",
      minutesUntil(runtime, SHIFT_OPEN_MINUTE),
      "夜警の交代に備えて灯具と引継ぎ記録を整える",
    ),
    authoredVillageNorthFenceWorkdayDay: currentDay(runtime),
  };
}

function windDownAction(runtime) {
  const ids = actionIds(runtime);
  return {
    ...action(
      ids.winddown,
      "winddown",
      "prepare",
      minutesUntil(runtime, TARGET_SLEEP_MINUTE),
      "夜警の記録をまとめ、装備を拭いて交代を終える",
    ),
    authoredVillageNorthFenceWorkdayDay: currentDay(runtime),
  };
}

function ownActions(runtime) {
  if (maintenanceEligible(runtime)) return [maintenanceAction(runtime)];
  if (watchPrepEligible(runtime)) return [watchPrepAction(runtime)];
  if (windDownEligible(runtime)) return [windDownAction(runtime)];
  return null;
}

function ordinaryBaseActions(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((entry) => entry?.canonicalWorldLifeChoice === true
      || entry?.authoredDailyLifeChoice === true
      || entry?.authoredPublicLifeNetworkChoice === true
      || entry?.canonicalRegionalLabourChoice === true);
}

function consume(runtime, selected, result) {
  if (!selected?.authoredVillageDay6NorthFenceWorkdayChoice || result?.ok === false) return false;
  if (Number(selected.authoredVillageNorthFenceWorkdayDay) !== currentDay(runtime)) return false;
  const state = ensureState(runtime);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const phase = selected.authoredVillageDay6NorthFenceWorkdayPhase;
  if (phase === "maintenance") {
    if (state.maintenanceCompletedAtMinute != null) return false;
    state.maintenanceCompletedAtMinute = minute;
  } else if (phase === "watch-prep") {
    if (state.watchPrepCompletedAtMinute != null) return false;
    state.watchPrepCompletedAtMinute = minute;
  } else if (phase === "winddown") {
    if (state.windDownCompletedAtMinute != null) return false;
    state.windDownCompletedAtMinute = minute;
  } else return false;

  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: `DAY${currentDay(runtime)}_NORTH_FENCE_${phase.replace(/-/g, "_").toUpperCase()}_COMPLETED`,
    minute,
    actionId: selected.id,
    location: LOCATION,
    facilityId: FACILITY_ID,
    wage: 0,
  });
  result.summary = phase === "maintenance"
    ? "北柵の綱と柵杭、夕方に使う灯具を点検した。正規の夜警勤務前の普段の手伝いなので賃金は発生しない。"
    : phase === "watch-prep"
      ? "灯具と引継ぎ記録を整え、18時の夜警交代まで北柵の仕事を手伝った。"
      : "22時までの夜警記録をまとめ、灯具を戻して装備を拭き、交代を終えた。";
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  const own = ownActions(runtime);
  if (!own?.length) return authored;
  if (authored == null || ordinaryBaseActions(authored)) return own;
  return authored;
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const own = ownActions(runtime);
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (own?.length && (authored == null || ordinaryBaseActions(authored))) {
    const phase = own[0].authoredVillageDay6NorthFenceWorkdayPhase;
    return {
      missionId: null,
      kicker: "北柵では夜警の勤務時刻に合わせて、普段の手入れと交代準備が続いている",
      title: phase === "maintenance" ? "北柵を手入れする" : phase === "watch-prep" ? "夜警の交代を整える" : "夜警の記録を片づける",
      detail: "18時から22時の正規夜警は仕事マスターの時間を守り、その前後は賃金のない通常の村仕事として過ごす。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, selected, result) {
  if (consume(runtime, selected, result)) return true;
  return base.applyAuthoredMissionFlowAction(runtime, selected, result);
}

export const AUTHORED_VILLAGE_DAY6_NORTH_FENCE_WORKDAY_INTERNALS = Object.freeze({
  LOCATION,
  FACILITY_ID,
  DAY: 6,
  SUPPORTED_DAYS,
  AFTERNOON_OPEN_MINUTE,
  SHIFT_OPEN_MINUTE,
  SHIFT_CLOSE_MINUTE,
  TARGET_SLEEP_MINUTE,
  MAINTENANCE_MINUTES: 90,
  MAINTENANCE_MINUTES_BY_DAY,
  JOB_ID,
  MAINTENANCE_ACTION_ID: "DAILY_LIFE:DAY6_NORTH_FENCE_WORKDAY:check_posts_and_lanterns",
  WATCH_PREP_ACTION_ID: "DAILY_LIFE:DAY6_NORTH_FENCE_WORKDAY:prepare_watch_handover",
  WINDDOWN_ACTION_ID: "DAILY_LIFE:DAY6_NORTH_FENCE_WORKDAY:finish_watch_notes",
  clock,
  currentDay,
  stateKey,
  actionPrefix,
  actionIds,
  needValue,
  needsAreCalm,
  atFence,
  readState,
  ensureState,
  completedShiftToday,
  minutesUntil,
  maintenanceMinutes,
  maintenanceEligible,
  watchPrepEligible,
  windDownEligible,
  maintenanceAction,
  watchPrepAction,
  windDownAction,
  ownActions,
  ordinaryBaseActions,
  consume,
});