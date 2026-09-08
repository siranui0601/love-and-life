import * as base from "./authored-village-inn-workday.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-village-inn-workday.js";

export const AUTHORED_VILLAGE_NORTH_FENCE_WORKDAY_VERSION = "authored-village-north-fence-workday-v1";

// Common-world Day4 bridge around the north fence's canonical evening watch.
// Production reaches the fence earlier than the legacy prose schedule because
// previous visible commands consume less time than the old narrative blocks.
// Use ordinary fence maintenance and watch preparation to live through that
// real afternoon instead of widening JOB-FARM-04, inserting WAIT, or padding
// the ledger with generic REST.
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_NORTH_FENCE";
const STATE_KEY = "villageNorthFenceWorkday";
const SCENE_ID = "daily-north-fence-workday";
const DAY = 4;
const AFTERNOON_OPEN_MINUTE = 14 * 60;
const SHIFT_OPEN_MINUTE = 18 * 60;
const SHIFT_CLOSE_MINUTE = 22 * 60;
const TARGET_SLEEP_MINUTE = 22 * 60 + 30;
const MAINTENANCE_MINUTES = 90;
const NEEDS_CALM_THRESHOLD = 72;
const JOB_ID = "JOB-FARM-04";
const MAINTENANCE_ACTION_ID = "DAILY_LIFE:DAILY_NORTH_FENCE_WORKDAY:check_posts_and_lanterns";
const WATCH_PREP_ACTION_ID = "DAILY_LIFE:DAILY_NORTH_FENCE_WORKDAY:prepare_watch_handover";
const WINDDOWN_ACTION_ID = "DAILY_LIFE:DAILY_NORTH_FENCE_WORKDAY:finish_watch_notes";

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function absoluteMinute(runtime) {
  return Number(runtime?.playerState?.absoluteMinute ?? 0);
}

function currentClock(runtime) {
  return clockFromMinute(absoluteMinute(runtime));
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

function readState(runtime) {
  const value = runtime?.playerState?.[STATE_KEY];
  return value && typeof value === "object" ? value : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_VILLAGE_NORTH_FENCE_WORKDAY_VERSION,
    maintenanceCompletedAtMinute: null,
    watchPrepCompletedAtMinute: null,
    windDownCompletedAtMinute: null,
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_VILLAGE_NORTH_FENCE_WORKDAY_VERSION;
  return state;
}

function atNorthFenceOnDay4(runtime) {
  const current = player(runtime);
  return current.location === LOCATION
    && current.facilityId === FACILITY_ID
    && currentClock(runtime).day === DAY;
}

function completedNorthFenceShiftToday(runtime) {
  const labour = runtime?.playerState?.canonicalRegionalLabour;
  return Number(labour?.lastDayByFacility?.[FACILITY_ID] ?? 0) === DAY
    && Number(labour?.shifts?.[JOB_ID] ?? 0) > 0;
}

function ordinaryBaseActions(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) =>
      action?.canonicalWorldLifeChoice === true
      || action?.authoredDailyLifeChoice === true
      || action?.authoredPublicLifeNetworkChoice === true);
}

function baseHasHigherPriorityScene(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (ordinaryBaseActions(actions)) return false;
  if (Array.isArray(actions) && actions.length > 0) return true;
  const guidance = base.authoredMissionFlowGuidance(runtime, context);
  if (!guidance) return false;
  return guidance?.missionId != null;
}

function maintenanceEligible(runtime, context = {}) {
  const clock = currentClock(runtime);
  return atNorthFenceOnDay4(runtime)
    && clock.minuteOfDay >= AFTERNOON_OPEN_MINUTE
    && clock.minuteOfDay < SHIFT_OPEN_MINUTE
    && !completedNorthFenceShiftToday(runtime)
    && readState(runtime)?.maintenanceCompletedAtMinute == null
    && needsAreCalm(runtime)
    && !baseHasHigherPriorityScene(runtime, context);
}

function watchPrepEligible(runtime, context = {}) {
  const clock = currentClock(runtime);
  const state = readState(runtime);
  return atNorthFenceOnDay4(runtime)
    && clock.minuteOfDay < SHIFT_OPEN_MINUTE
    && !completedNorthFenceShiftToday(runtime)
    && state?.maintenanceCompletedAtMinute != null
    && state?.watchPrepCompletedAtMinute == null
    && needsAreCalm(runtime)
    && !baseHasHigherPriorityScene(runtime, context);
}

function windDownEligible(runtime, context = {}) {
  const clock = currentClock(runtime);
  return atNorthFenceOnDay4(runtime)
    && clock.minuteOfDay >= SHIFT_CLOSE_MINUTE
    && clock.minuteOfDay < TARGET_SLEEP_MINUTE
    && completedNorthFenceShiftToday(runtime)
    && readState(runtime)?.windDownCompletedAtMinute == null
    && needsAreCalm(runtime)
    && !baseHasHigherPriorityScene(runtime, context);
}

function minutesUntil(runtime, targetMinute) {
  return Math.max(1, targetMinute - currentClock(runtime).minuteOfDay);
}

function maintenanceAction(runtime) {
  return {
    id: MAINTENANCE_ACTION_ID,
    actionId: MAINTENANCE_ACTION_ID,
    family: "help",
    type: "plan",
    minutes: Math.min(MAINTENANCE_MINUTES, minutesUntil(runtime, SHIFT_OPEN_MINUTE)),
    label: "夕方の見張り前に柵杭・綱・灯具を点検する",
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredVillageNorthFenceWorkdayChoice: true,
    authoredVillageNorthFenceWorkdayPhase: "maintenance",
  };
}

function watchPrepAction(runtime) {
  return {
    id: WATCH_PREP_ACTION_ID,
    actionId: WATCH_PREP_ACTION_ID,
    family: "prepare",
    type: "plan",
    minutes: minutesUntil(runtime, SHIFT_OPEN_MINUTE),
    label: "夜警の交代に備えて灯具と引継ぎ記録を整える",
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredVillageNorthFenceWorkdayChoice: true,
    authoredVillageNorthFenceWorkdayPhase: "watch-prep",
  };
}

function windDownAction(runtime) {
  return {
    id: WINDDOWN_ACTION_ID,
    actionId: WINDDOWN_ACTION_ID,
    family: "prepare",
    type: "plan",
    minutes: minutesUntil(runtime, TARGET_SLEEP_MINUTE),
    label: "夜警の記録をまとめ、装備を拭いて交代を終える",
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredVillageNorthFenceWorkdayChoice: true,
    authoredVillageNorthFenceWorkdayPhase: "winddown",
  };
}

function actions(runtime, context = {}) {
  if (maintenanceEligible(runtime, context)) return [maintenanceAction(runtime)];
  if (watchPrepEligible(runtime, context)) return [watchPrepAction(runtime)];
  if (windDownEligible(runtime, context)) return [windDownAction(runtime)];
  return null;
}

function pushHistory(runtime, action, phase) {
  runtime.playerState.history ??= [];
  const type = phase === "maintenance"
    ? "DAY4_NORTH_FENCE_MAINTENANCE_COMPLETED"
    : phase === "watch-prep"
      ? "DAY4_NORTH_FENCE_WATCH_PREP_COMPLETED"
      : "DAY4_NORTH_FENCE_POST_SHIFT_WOUND_DOWN";
  runtime.playerState.history.push({
    type,
    minute: absoluteMinute(runtime),
    sceneId: SCENE_ID,
    actionId: action.id,
    location: LOCATION,
    facilityId: FACILITY_ID,
    wage: 0,
  });
}

function consume(runtime, action, result) {
  if (!action?.authoredVillageNorthFenceWorkdayChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  const minute = absoluteMinute(runtime);
  if (action.authoredVillageNorthFenceWorkdayPhase === "maintenance") {
    if (state.maintenanceCompletedAtMinute != null) return false;
    state.maintenanceCompletedAtMinute = minute;
    pushHistory(runtime, action, "maintenance");
    result.summary = "北柵を歩いて緩んだ綱と柵杭を確かめ、夕方に使う灯具の煤を払った。これは正規の夜警勤務ではなく、村の普段の手伝いなので賃金は受け取っていない。";
    return true;
  }
  if (action.authoredVillageNorthFenceWorkdayPhase === "watch-prep") {
    if (state.watchPrepCompletedAtMinute != null) return false;
    state.watchPrepCompletedAtMinute = minute;
    pushHistory(runtime, action, "watch-prep");
    result.summary = "日が傾くまで、灯油と火口を確かめ、前の見張りが残した記録を読み、交代時に伝える箇所を整理した。18時からの正規夜警が始まるまで、追加の賃金なしで北柵の日常を手伝った。";
    return true;
  }
  if (action.authoredVillageNorthFenceWorkdayPhase === "winddown") {
    if (state.windDownCompletedAtMinute != null) return false;
    state.windDownCompletedAtMinute = minute;
    pushHistory(runtime, action, "winddown");
    result.summary = "四時間の夜警を終え、異常なしの記録をまとめ、借りた灯具を戻して装備の泥を拭いた。賃仕事は22時で終わっており、追加の賃金を受け取ることなく交代を済ませた。";
    return true;
  }
  return false;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime, context);
  return own?.length ? own : base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  if (maintenanceEligible(runtime, context)) {
    return {
      missionId: null,
      kicker: "夕方の夜警が始まるまで、北柵では普段の手入れが残っている",
      title: "北柵を手入れして夜警の時間を待つ",
      detail: "18時からの正規勤務とは別の村仕事として、柵杭や綱、灯具を確かめられる。賃金の出ない普通の手伝いだ。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  if (watchPrepEligible(runtime, context)) {
    return {
      missionId: null,
      kicker: "柵の手入れは終わり、日が傾いて見張りの交代時刻が近づいている",
      title: "夜警の灯具と引継ぎを整える",
      detail: "灯具と記録を整えながら18時の交代まで過ごす。勤務時間そのものを前倒しするものではない。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  if (windDownEligible(runtime, context)) {
    return {
      missionId: null,
      kicker: "夜警の賃仕事は終わり、あとは記録と道具を返して交代するだけだ",
      title: "夜警の片づけを終える",
      detail: "22時までの勤務記録をまとめ、装備を整えてから宿へ戻る。追加の勤務や賃金は発生しない。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_VILLAGE_NORTH_FENCE_WORKDAY_INTERNALS = Object.freeze({
  LOCATION,
  FACILITY_ID,
  STATE_KEY,
  SCENE_ID,
  DAY,
  AFTERNOON_OPEN_MINUTE,
  SHIFT_OPEN_MINUTE,
  SHIFT_CLOSE_MINUTE,
  TARGET_SLEEP_MINUTE,
  MAINTENANCE_MINUTES,
  NEEDS_CALM_THRESHOLD,
  JOB_ID,
  MAINTENANCE_ACTION_ID,
  WATCH_PREP_ACTION_ID,
  WINDDOWN_ACTION_ID,
  currentClock,
  needValue,
  needsAreCalm,
  readState,
  ensureState,
  atNorthFenceOnDay4,
  completedNorthFenceShiftToday,
  ordinaryBaseActions,
  baseHasHigherPriorityScene,
  maintenanceEligible,
  watchPrepEligible,
  windDownEligible,
  minutesUntil,
  maintenanceAction,
  watchPrepAction,
  windDownAction,
  actions,
  consume,
});
