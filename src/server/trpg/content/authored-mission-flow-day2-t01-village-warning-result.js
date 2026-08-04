import * as base from "./authored-mission-flow-day2-t01-hunter-lunch.js";

export * from "./authored-mission-flow-day2-t01-hunter-lunch.js";

export const AUTHORED_DAY2_T01_VILLAGE_WARNING_VERSION = "authored-day2-t01-village-warning-v1";

const MISSION_ID = "MSN-T01";
const SCENE_ID = "t01-day2-village-warning-result";
const REQUEST_ID = "GOAP-DAY2-JILL-NORTH-FENCE-WARNING";
const LOCATION = "森";
const FACILITY_ID = "LOC_FOREST_HUNTER_HUT";
const HUNTER_ID = "NPC060";

const CHOICES = Object.freeze([
  Object.freeze({
    id: "help_move_livestock",
    label: "家畜を移す",
    family: "coordination",
    minutes: 42,
    summary: "村へ戻り、北柵側の家畜を内側の囲いへ移した。騒ぎにはせず、日暮れ前の備えだけを整えた。",
    speech: "大声は出すな。狼を呼ぶのも、人を怯えさせるのも同じくらい簡単だ。",
    worldFlag: "day2Hunter:livestockMoved",
    historyType: "DAY2_HUNTER_LIVESTOCK_MOVED",
    destinationLocation: "田園の村",
    destinationFacilityId: "LOC_FARM_NORTH_FENCE",
  }),
  Object.freeze({
    id: "inspect_warning_bells",
    label: "鈴を見回る",
    family: "fieldwork",
    minutes: 34,
    summary: "ジルと警戒線を一周し、北東側の鈴だけが低く鳴った跡を確かめた。足跡は薄く、群れの規模までは断定できない。",
    speech: "見えないものを大きく言うな。鳴った鈴と、鳴らなかった鈴だけ覚えておけ。",
    worldFlag: "day2Hunter:warningBellsInspected",
    historyType: "DAY2_HUNTER_WARNING_BELLS_INSPECTED",
    evidenceId: "T03-EVIDENCE-DAY2-NORTHEAST-BELL-MARK",
    evidenceSource: "LOC_FOREST_HUNTER_HUT:NORTHEAST_WARNING_LINE",
  }),
  Object.freeze({
    id: "leave_it_to_jill",
    label: "ジルに任せる",
    family: "non_intervention",
    minutes: 8,
    summary: "警告の後始末はジルに任せ、自分は別の行動へ戻ることにした。村の備えは進むが、現地の細かな変化は見届けない。",
    speech: "それでいい。全部に首を突っ込む必要はない。必要なら、次は俺から呼ぶ。",
    worldFlag: "day2Hunter:warningLeftToJill",
    historyType: "DAY2_HUNTER_WARNING_LEFT_TO_JILL",
  }),
]);

function array(value) { return Array.isArray(value) ? value : []; }
function player(runtime) { return runtime?.playerState?.player ?? runtime?.playerState ?? {}; }
function hasHistory(runtime, type) { return array(runtime?.playerState?.history).some((entry) => entry?.type === type); }

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day2T01VillageWarning ??= {
    version: AUTHORED_DAY2_T01_VILLAGE_WARNING_VERSION,
    selectedActionId: null,
    closedActionIds: [],
    completedAtMinute: null,
  };
  const state = runtime.playerState.day2T01VillageWarning;
  state.version = AUTHORED_DAY2_T01_VILLAGE_WARNING_VERSION;
  state.closedActionIds = array(state.closedActionIds).map(String);
  return state;
}

function eligible(runtime) {
  const current = player(runtime);
  const request = runtime?.playerState?.goapRequests?.[REQUEST_ID];
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  return current.location === LOCATION
    && current.facilityId === FACILITY_ID
    && hasHistory(runtime, "DAY2_HUNTER_VILLAGE_WARNING_QUEUED")
    && request?.status === "queued"
    && minute >= Number(request?.dueAtMinute ?? Number.POSITIVE_INFINITY)
    && ensureState(runtime).completedAtMinute == null;
}

function actionFor(choice) {
  return {
    id: `MISSION_FLOW:T01:DAY2_VILLAGE_WARNING:${choice.id}`,
    type: "plan",
    family: choice.family,
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: HUNTER_ID,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredDay2T01VillageWarningChoice: true,
    authoredDay2T01VillageWarningData: choice,
  };
}

function actions(runtime) { return eligible(runtime) ? CHOICES.map(actionFor) : null; }

function consume(runtime, action, result) {
  if (!action?.authoredDay2T01VillageWarningChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;

  const choice = action.authoredDay2T01VillageWarningData;
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  const current = player(runtime);
  const ids = CHOICES.map((entry) => actionFor(entry).id);

  state.selectedActionId = action.id;
  state.closedActionIds = ids.filter((id) => id !== action.id);
  state.completedAtMinute = minute;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  runtime.playerState.goapRequests ??= {};
  runtime.playerState.worldFlags[choice.worldFlag] = true;

  const request = runtime.playerState.goapRequests[REQUEST_ID];
  if (request) {
    request.status = "completed";
    request.completedAtMinute = minute;
    request.resultActionId = action.id;
  }

  if (choice.destinationLocation) current.location = choice.destinationLocation;
  if (choice.destinationFacilityId) current.facilityId = choice.destinationFacilityId;
  if (choice.evidenceId) {
    runtime.playerState.evidence[choice.evidenceId] = {
      id: choice.evidenceId,
      source: choice.evidenceSource,
      acquiredAtMinute: minute,
    };
  }

  runtime.playerState.history.push({
    type: choice.historyType,
    minute,
    missionId: MISSION_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    requestId: REQUEST_ID,
    closedActionIds: [...state.closedActionIds],
    evidenceId: choice.evidenceId ?? null,
    evidenceSource: choice.evidenceSource ?? null,
    location: current.location,
    facilityId: current.facilityId,
  });

  result.summary = choice.summary;
  result.speeches = [{ actorId: HUNTER_ID, text: choice.speech, emotion: "落ち着いて実務的" }];
  result.evidenceId = choice.evidenceId ?? null;
  result.goapRequestId = REQUEST_ID;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return actions(runtime) ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "村から戻った見回りが、家畜を内側へ寄せ始めたと伝えた",
      title: "北柵への警告、その後",
      detail: "村の備えを手伝う、鈴を確かめる、ジルへ任せる。警告の後にも選べることがある。",
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

export const AUTHORED_DAY2_T01_VILLAGE_WARNING_INTERNALS = Object.freeze({
  ensureState, eligible, actionFor, actions, consume, CHOICES, SCENE_ID, REQUEST_ID,
});
