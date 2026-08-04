import * as base from "./authored-mission-flow-human-route-entry.js";
import {
  AUTHORED_DAY2_T01_VILLAGE_WARNING_INTERNALS as warning,
} from "./authored-mission-flow-day2-t01-village-warning-result.js";

export * from "./authored-mission-flow-human-route-entry.js";

export const AUTHORED_HUMAN_ROUTE_WARNING_WAIT_VERSION = "authored-human-route-warning-wait-v1";

const MISSION_ID = "MSN-T01";
const SCENE_ID = "t01-day2-warning-wait";
const LOCATION = "森";
const FACILITY_ID = "LOC_FOREST_HUNTER_HUT";
const HUNTER_ID = "NPC060";

const CHOICES = Object.freeze([
  Object.freeze({
    id: "wait_with_jill",
    label: "ジルと待つ",
    family: "social",
    summary: "警告を持たせた見回りが戻るまで、ジルと薄い茶を飲みながら罠鈴の音を聞いた。急いで森を駆け回らず、知らせが届く時間を待った。",
    speech: "待つのも仕事だ。焦って別の足跡を増やせば、戻った見回りの話と区別がつかなくなる。",
    historyType: "DAY2_HUNTER_WARNING_WAITED_WITH_JILL",
    worldFlag: "day2Hunter:waitedForWarningResult",
  }),
  Object.freeze({
    id: "split_firewood",
    label: "薪を割る",
    family: "work",
    fixedMinutes: 55,
    summary: "小屋裏の薪を割り、ジルが夜の見回りへ持ち出す束を作った。警告の返事を待つ間にも、暮らしと警戒の準備は進んだ。",
    speech: "節のある薪は横から叩け。力だけで割ると刃を欠く。狼相手でも同じだ。",
    historyType: "DAY2_HUNTER_WARNING_FIREWOOD_SPLIT",
    worldFlag: "day2Hunter:warningFirewoodPrepared",
  }),
  Object.freeze({
    id: "return_ahead",
    label: "村へ先回りする",
    family: "movement",
    fixedMinutes: 42,
    destinationLocation: "田園の村",
    destinationFacilityId: "LOC_FARM_NORTH_FENCE",
    summary: "見回りの帰着を待たず、北柵へ先回りした。村側で直接備えられるが、ジルが森で拾う細かな変化はその場では聞けない。",
    speech: "先に行くなら北柵へ回れ。村の真ん中で狼の話を広げるな。",
    historyType: "DAY2_HUNTER_WARNING_RETURNED_AHEAD",
    worldFlag: "day2Hunter:returnedAheadOfWarning",
  }),
]);

function array(value) { return Array.isArray(value) ? value : []; }
function player(runtime) { return runtime?.playerState?.player ?? runtime?.playerState ?? {}; }
function minute(runtime) { return Number(runtime?.playerState?.absoluteMinute ?? 0); }
function hasHistory(runtime, type) {
  return array(runtime?.playerState?.history).some((entry) => entry?.type === type);
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day2T01WarningWait ??= {
    version: AUTHORED_HUMAN_ROUTE_WARNING_WAIT_VERSION,
    selectedActionId: null,
    closedActionIds: [],
    completedAtMinute: null,
  };
  const state = runtime.playerState.day2T01WarningWait;
  state.version = AUTHORED_HUMAN_ROUTE_WARNING_WAIT_VERSION;
  state.closedActionIds = array(state.closedActionIds).map(String);
  return state;
}

function request(runtime) {
  return runtime?.playerState?.goapRequests?.[warning.REQUEST_ID] ?? null;
}

function remainingMinutes(runtime) {
  return Math.max(1, Number(request(runtime)?.dueAtMinute ?? minute(runtime) + 1) - minute(runtime));
}

function eligible(runtime) {
  const current = player(runtime);
  const pending = request(runtime);
  return current.location === LOCATION
    && current.facilityId === FACILITY_ID
    && hasHistory(runtime, "DAY2_HUNTER_VILLAGE_WARNING_QUEUED")
    && pending?.status === "queued"
    && minute(runtime) < Number(pending?.dueAtMinute ?? Number.NEGATIVE_INFINITY)
    && ensureState(runtime).completedAtMinute == null;
}

function actionFor(runtime, choice) {
  const remaining = remainingMinutes(runtime);
  return {
    id: `MISSION_FLOW:T01:DAY2_WARNING_WAIT:${choice.id}`,
    type: "plan",
    family: choice.family,
    minutes: choice.id === "wait_with_jill"
      ? remaining
      : Math.min(remaining, Number(choice.fixedMinutes ?? remaining)),
    label: choice.label,
    targetNpcId: HUNTER_ID,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredHumanRouteWarningWaitChoice: true,
    authoredHumanRouteWarningWaitData: choice,
  };
}

function actions(runtime) {
  return eligible(runtime) ? CHOICES.map((choice) => actionFor(runtime, choice)) : null;
}

function consume(runtime, action, result) {
  if (!action?.authoredHumanRouteWarningWaitChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;
  const choice = action.authoredHumanRouteWarningWaitData;
  const now = minute(runtime);
  const current = player(runtime);
  const ids = CHOICES.map((entry) => actionFor(runtime, entry).id);

  state.selectedActionId = action.id;
  state.closedActionIds = ids.filter((id) => id !== action.id);
  state.completedAtMinute = now;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags[choice.worldFlag] = true;
  if (choice.destinationLocation) current.location = choice.destinationLocation;
  if (choice.destinationFacilityId) current.facilityId = choice.destinationFacilityId;
  runtime.playerState.history.push({
    type: choice.historyType,
    minute: now,
    missionId: MISSION_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    requestId: warning.REQUEST_ID,
    closedActionIds: [...state.closedActionIds],
    location: current.location,
    facilityId: current.facilityId,
  });

  result.summary = choice.summary;
  result.speeches = [{ actorId: HUNTER_ID, text: choice.speech, emotion: "静かな実務口調" }];
  result.goapRequestId = warning.REQUEST_ID;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return actions(runtime) ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "警告を託した見回りが森道を下り、小屋には返事を待つ時間が残った",
      title: "知らせが戻るまで",
      detail: "ジルと待つ、薪を整える、村へ先回りする。待ち時間も生活と次の行動へつながる。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_HUMAN_ROUTE_WARNING_WAIT_INTERNALS = Object.freeze({
  ensureState,
  request,
  remainingMinutes,
  eligible,
  actionFor,
  actions,
  consume,
  CHOICES,
  SCENE_ID,
});
