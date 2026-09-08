import * as base from "./authored-village-bakery-morning.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-village-bakery-morning.js";

export const AUTHORED_VILLAGE_INN_WORKDAY_VERSION = "authored-village-inn-workday-v1";

// Common-world Day3 bridge around the farm inn's canonical evening shift.
// Production resolves the old equipment handoff prose much faster than the
// legacy ledger did, so a player can naturally reach the inn before the
// Sheet-backed 16:00 JOB-FARM-03 window opens. These ordinary life actions
// absorb that real clock difference without widening work hours, faking time,
// paying an invented wage, or consulting Human Virtue state.
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_INN";
const STATE_KEY = "villageInnWorkday";
const SCENE_ID = "daily-inn-workday";
const DAY = 3;
const PREP_OPEN_MINUTE = 14 * 60;
const SHIFT_OPEN_MINUTE = 16 * 60;
const WINDDOWN_OPEN_MINUTE = 18 * 60;
const TARGET_SLEEP_MINUTE = 22 * 60 + 30;
const NEEDS_CALM_THRESHOLD = 72;
const JOB_ID = "JOB-FARM-03";
const PREP_ACTION_ID = "DAILY_LIFE:DAILY_INN_WORKDAY:prepare_evening_service";
const WINDDOWN_ACTION_ID = "DAILY_LIFE:DAILY_INN_WORKDAY:wind_down_after_shift";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

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
    version: AUTHORED_VILLAGE_INN_WORKDAY_VERSION,
    prepCompletedAtMinute: null,
    windDownCompletedAtMinute: null,
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_VILLAGE_INN_WORKDAY_VERSION;
  return state;
}

function atInnOnDay3(runtime) {
  const current = player(runtime);
  return current.location === LOCATION
    && current.facilityId === FACILITY_ID
    && currentClock(runtime).day === DAY;
}

function completedInnShiftToday(runtime) {
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

function prepEligible(runtime, context = {}) {
  const clock = currentClock(runtime);
  return atInnOnDay3(runtime)
    && clock.minuteOfDay >= PREP_OPEN_MINUTE
    && clock.minuteOfDay < SHIFT_OPEN_MINUTE
    && !completedInnShiftToday(runtime)
    && readState(runtime)?.prepCompletedAtMinute == null
    && needsAreCalm(runtime)
    && !baseHasHigherPriorityScene(runtime, context);
}

function windDownEligible(runtime, context = {}) {
  const clock = currentClock(runtime);
  return atInnOnDay3(runtime)
    && clock.minuteOfDay >= WINDDOWN_OPEN_MINUTE
    && clock.minuteOfDay < TARGET_SLEEP_MINUTE
    && completedInnShiftToday(runtime)
    && readState(runtime)?.windDownCompletedAtMinute == null
    && needsAreCalm(runtime)
    && !baseHasHigherPriorityScene(runtime, context);
}

function minutesUntil(runtime, targetMinute) {
  return Math.max(1, targetMinute - currentClock(runtime).minuteOfDay);
}

function prepAction(runtime) {
  return {
    id: PREP_ACTION_ID,
    actionId: PREP_ACTION_ID,
    family: "help",
    type: "plan",
    minutes: minutesUntil(runtime, SHIFT_OPEN_MINUTE),
    label: "夕方の営業に向けて客席と台所を整える",
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredVillageInnWorkdayChoice: true,
    authoredVillageInnWorkdayPhase: "prep",
  };
}

function windDownAction(runtime) {
  return {
    id: WINDDOWN_ACTION_ID,
    actionId: WINDDOWN_ACTION_ID,
    family: "prepare",
    type: "plan",
    minutes: minutesUntil(runtime, TARGET_SLEEP_MINUTE),
    label: "皿洗いの後片づけを終え、宿で夜を過ごす",
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredVillageInnWorkdayChoice: true,
    authoredVillageInnWorkdayPhase: "winddown",
  };
}

function actions(runtime, context = {}) {
  if (prepEligible(runtime, context)) return [prepAction(runtime)];
  if (windDownEligible(runtime, context)) return [windDownAction(runtime)];
  return null;
}

function pushHistory(runtime, action, phase) {
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: phase === "prep" ? "DAY3_INN_EVENING_SERVICE_PREPARED" : "DAY3_INN_POST_SHIFT_WOUND_DOWN",
    minute: absoluteMinute(runtime),
    sceneId: SCENE_ID,
    actionId: action.id,
    location: LOCATION,
    facilityId: FACILITY_ID,
    wage: 0,
  });
}

function consume(runtime, action, result) {
  if (!action?.authoredVillageInnWorkdayChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  const minute = absoluteMinute(runtime);
  if (action.authoredVillageInnWorkdayPhase === "prep") {
    if (state.prepCompletedAtMinute != null) return false;
    state.prepCompletedAtMinute = minute;
    pushHistory(runtime, action, "prep");
    result.summary = "夕方の営業前、客席の卓を拭き、台所へ水と皿を運び、貯蔵棚の空きを整えた。雇い仕事そのものではないため賃金は受け取らず、店が夕方の皿洗いを頼める時刻になるまで普段の準備を手伝った。";
    return true;
  }
  if (action.authoredVillageInnWorkdayPhase === "winddown") {
    if (state.windDownCompletedAtMinute != null) return false;
    state.windDownCompletedAtMinute = minute;
    pushHistory(runtime, action, "winddown");
    result.summary = "二時間の皿洗いを終えたあと、濡れた布巾を干し、客席の片づけを手伝いながら食堂の話を聞いた。賃仕事はそこで終わっている。追加の賃金は受け取らず、装備を拭き、火の落ちる宿で夜更けまで普通に過ごした。";
    return true;
  }
  return false;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime, context);
  return own?.length ? own : base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  if (prepEligible(runtime, context)) {
    return {
      missionId: null,
      kicker: "夕方の客が来る前で、麦穂亭はまだ営業準備の途中だ",
      title: "夕方の皿洗いが始まるまで宿を手伝う",
      detail: "正規の皿洗い勤務は16時から。賃金の出ない営業準備を手伝いながら、その勤務時間まで普通の暮らしとして過ごせる。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  if (windDownEligible(runtime, context)) {
    return {
      missionId: null,
      kicker: "皿洗いの賃仕事は終わり、食堂には夜の客だけが残っている",
      title: "仕事の後を片づけて夜を過ごす",
      detail: "追加の勤務ではない。片づけや道具の手入れ、食堂での普通の会話をしながら、宿で眠る時刻まで過ごせる。",
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

export const AUTHORED_VILLAGE_INN_WORKDAY_INTERNALS = Object.freeze({
  LOCATION,
  FACILITY_ID,
  STATE_KEY,
  SCENE_ID,
  DAY,
  PREP_OPEN_MINUTE,
  SHIFT_OPEN_MINUTE,
  WINDDOWN_OPEN_MINUTE,
  TARGET_SLEEP_MINUTE,
  NEEDS_CALM_THRESHOLD,
  JOB_ID,
  PREP_ACTION_ID,
  WINDDOWN_ACTION_ID,
  currentClock,
  needValue,
  needsAreCalm,
  readState,
  ensureState,
  atInnOnDay3,
  completedInnShiftToday,
  ordinaryBaseActions,
  baseHasHigherPriorityScene,
  prepEligible,
  windDownEligible,
  minutesUntil,
  prepAction,
  windDownAction,
  actions,
  consume,
});
