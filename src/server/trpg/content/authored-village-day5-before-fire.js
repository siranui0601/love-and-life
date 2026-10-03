import * as base from "./authored-village-north-fence-workday.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-village-north-fence-workday.js";

export const AUTHORED_VILLAGE_DAY5_BEFORE_FIRE_VERSION = "authored-village-day5-before-fire-v1";

// The current canonical chronology places the granary arson on Day5 night.
// The legacy v2 ledger still describes a burned granary on Day5 morning, which
// would create evidence before the fire exists. These are ordinary, route-neutral
// village activities that occupy the real Day5 daytime without changing T02.
const LOCATION = "田園の村";
const DAY = 5;
const STATE_KEY = "villageDay5BeforeFire";
const GRANARY = "LOC_FARM_GRANARY";
const NORTH_FENCE = "LOC_FARM_NORTH_FENCE";
const GRANARY_TARGET_MINUTE = 10 * 60;
const NORTH_FENCE_PREP_OPEN = 14 * 60;
const WATCH_OPEN_MINUTE = 18 * 60;
const NEEDS_CALM_THRESHOLD = 72;

const ACTION = Object.freeze({
  granaryRoutine: "DAILY_LIFE:DAY5_VILLAGE_ROUTINE:count_and_stack_granary_sacks",
  fenceMaintenance: "DAILY_LIFE:DAY5_VILLAGE_ROUTINE:inspect_fence_and_lanterns",
  watchPrep: "DAILY_LIFE:DAY5_VILLAGE_ROUTINE:prepare_night_watch",
});

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function absoluteMinute(runtime) {
  return Number(runtime?.playerState?.absoluteMinute ?? 0);
}

function clock(runtime) {
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
  const state = runtime?.playerState?.[STATE_KEY];
  return state && typeof state === "object" ? state : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_VILLAGE_DAY5_BEFORE_FIRE_VERSION,
    granaryRoutineCompletedAtMinute: null,
    fenceMaintenanceCompletedAtMinute: null,
    watchPrepCompletedAtMinute: null,
  };
  runtime.playerState[STATE_KEY].version = AUTHORED_VILLAGE_DAY5_BEFORE_FIRE_VERSION;
  return runtime.playerState[STATE_KEY];
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
  return Boolean(guidance?.missionId);
}

function onDay5(runtime, facilityId) {
  const current = player(runtime);
  return current.location === LOCATION
    && current.facilityId === facilityId
    && clock(runtime).day === DAY;
}

function granaryRoutineEligible(runtime, context = {}) {
  const now = clock(runtime).minuteOfDay;
  return onDay5(runtime, GRANARY)
    && now >= 7 * 60
    && now < GRANARY_TARGET_MINUTE
    && readState(runtime)?.granaryRoutineCompletedAtMinute == null
    && needsAreCalm(runtime)
    && !baseHasHigherPriorityScene(runtime, context);
}

function fenceMaintenanceEligible(runtime, context = {}) {
  const now = clock(runtime).minuteOfDay;
  return onDay5(runtime, NORTH_FENCE)
    && now >= NORTH_FENCE_PREP_OPEN
    && now < WATCH_OPEN_MINUTE
    && readState(runtime)?.fenceMaintenanceCompletedAtMinute == null
    && needsAreCalm(runtime)
    && !baseHasHigherPriorityScene(runtime, context);
}

function watchPrepEligible(runtime, context = {}) {
  const now = clock(runtime).minuteOfDay;
  const state = readState(runtime);
  return onDay5(runtime, NORTH_FENCE)
    && now < WATCH_OPEN_MINUTE
    && state?.fenceMaintenanceCompletedAtMinute != null
    && state?.watchPrepCompletedAtMinute == null
    && needsAreCalm(runtime)
    && !baseHasHigherPriorityScene(runtime, context);
}

function minutesUntil(runtime, targetMinute) {
  return Math.max(1, targetMinute - clock(runtime).minuteOfDay);
}

function action(id, family, minutes, label, facilityId, phase) {
  return {
    id,
    actionId: id,
    family,
    type: "plan",
    minutes,
    label,
    targetLocation: LOCATION,
    targetFacilityId: facilityId,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredVillageDay5BeforeFireChoice: true,
    authoredVillageDay5BeforeFirePhase: phase,
  };
}

function actions(runtime, context = {}) {
  if (granaryRoutineEligible(runtime, context)) {
    return [action(
      ACTION.granaryRoutine,
      "work",
      minutesUntil(runtime, GRANARY_TARGET_MINUTE),
      "共同穀倉の麻袋を数え、通路を空けて積み直す",
      GRANARY,
      "granary",
    )];
  }
  if (fenceMaintenanceEligible(runtime, context)) {
    return [action(
      ACTION.fenceMaintenance,
      "help",
      Math.min(90, minutesUntil(runtime, WATCH_OPEN_MINUTE)),
      "夜警前に北柵の綱・杭・灯具を点検する",
      NORTH_FENCE,
      "fence-maintenance",
    )];
  }
  if (watchPrepEligible(runtime, context)) {
    return [action(
      ACTION.watchPrep,
      "prepare",
      minutesUntil(runtime, WATCH_OPEN_MINUTE),
      "18時の夜警交代まで灯具と引継ぎ記録を整える",
      NORTH_FENCE,
      "watch-prep",
    )];
  }
  return null;
}

function pushHistory(runtime, actionValue, type) {
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type,
    minute: absoluteMinute(runtime),
    actionId: actionValue.id,
    location: LOCATION,
    facilityId: actionValue.targetFacilityId,
    wage: 0,
    troubleId: null,
  });
}

function consume(runtime, actionValue, result) {
  if (!actionValue?.authoredVillageDay5BeforeFireChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  const minute = absoluteMinute(runtime);
  if (actionValue.authoredVillageDay5BeforeFirePhase === "granary") {
    if (state.granaryRoutineCompletedAtMinute != null) return false;
    state.granaryRoutineCompletedAtMinute = minute;
    pushHistory(runtime, actionValue, "DAY5_GRANARY_ORDINARY_ROUTINE_COMPLETED");
    result.summary = "共同穀倉で麻袋の数を確かめ、荷運びの邪魔になる袋を積み直した。まだ火災は起きておらず、事件の証拠や進行は一切発生していない。賃金の付く日雇い仕事とも別の、村の日常の手伝いだ。";
    return true;
  }
  if (actionValue.authoredVillageDay5BeforeFirePhase === "fence-maintenance") {
    if (state.fenceMaintenanceCompletedAtMinute != null) return false;
    state.fenceMaintenanceCompletedAtMinute = minute;
    pushHistory(runtime, actionValue, "DAY5_NORTH_FENCE_ORDINARY_MAINTENANCE_COMPLETED");
    result.summary = "夕方の北柵を回り、緩んだ綱と杭、夜に使う灯具を点検した。18時からの正規夜警とは別の無給の手伝いで、事件の状態は変えていない。";
    return true;
  }
  if (actionValue.authoredVillageDay5BeforeFirePhase === "watch-prep") {
    if (state.watchPrepCompletedAtMinute != null) return false;
    state.watchPrepCompletedAtMinute = minute;
    pushHistory(runtime, actionValue, "DAY5_NORTH_FENCE_WATCH_PREP_COMPLETED");
    result.summary = "日が落ちるまで灯油、火口、前番の記録を整え、18時の交代を待った。勤務時間を前倒しせず、追加の賃金も受け取っていない。";
    return true;
  }
  return false;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime, context);
  return own?.length ? own : base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  if (granaryRoutineEligible(runtime, context)) {
    return {
      missionId: null,
      kicker: "共同穀倉はまだ普段どおり動いている",
      title: "朝の荷を整える",
      detail: "麻袋を数え、通路を空ける。火災前の通常の村仕事で、事件の手掛かりを先取りしない。",
      targetLocation: LOCATION,
      targetFacilityId: GRANARY,
      actionPanel: null,
    };
  }
  if (fenceMaintenanceEligible(runtime, context) || watchPrepEligible(runtime, context)) {
    return {
      missionId: null,
      kicker: "北柵では夕方の見張り交代に向けた普段の準備が続いている",
      title: "夜警の前支度をする",
      detail: "柵と灯具を確かめ、18時の正規勤務を時間どおり始める。",
      targetLocation: LOCATION,
      targetFacilityId: NORTH_FENCE,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, actionValue, result);
  return consume(runtime, actionValue, result) || changed;
}

export const AUTHORED_VILLAGE_DAY5_BEFORE_FIRE_INTERNALS = Object.freeze({
  LOCATION,
  DAY,
  STATE_KEY,
  GRANARY,
  NORTH_FENCE,
  GRANARY_TARGET_MINUTE,
  NORTH_FENCE_PREP_OPEN,
  WATCH_OPEN_MINUTE,
  NEEDS_CALM_THRESHOLD,
  ACTION,
  clock,
  readState,
  ensureState,
  needsAreCalm,
  ordinaryBaseActions,
  baseHasHigherPriorityScene,
  onDay5,
  granaryRoutineEligible,
  fenceMaintenanceEligible,
  watchPrepEligible,
  minutesUntil,
  actions,
  consume,
});
