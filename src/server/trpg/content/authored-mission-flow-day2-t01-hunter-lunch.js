import * as base from "./authored-mission-flow-day2-t01-hunter-hut.js";

export * from "./authored-mission-flow-day2-t01-hunter-hut.js";

export const AUTHORED_DAY2_T01_HUNTER_LUNCH_VERSION = "authored-day2-t01-hunter-lunch-v1";

const MISSION_ID = "MSN-T01";
const SCENE_ID = "t01-day2-hunter-lunch-plan";
const LOCATION = "森";
const FACILITY_ID = "LOC_FOREST_HUNTER_HUT";
const HUNTER_ID = "NPC060";
const SOURCE_HISTORY = "DAY2_HUNTER_WARNING_SNARE_REPAIRED";

const CHOICES = Object.freeze([
  Object.freeze({
    id: "stir_stew",
    label: "鍋をかき混ぜる",
    family: "life",
    minutes: 16,
    hungerDelta: -14,
    fatigueDelta: -2,
    summary: "火から離れられないジルに代わり、鹿肉と根菜の鍋をかき混ぜた。働いた分だけ椀を一杯受け取り、森の昼食を済ませた。",
    speech: "焦がすなよ。塩は最後だ。狼の話ばかりして腹を空にしても、足音は追えん。",
    worldFlag: "day2Hunter:stewShared",
    historyType: "DAY2_HUNTER_STEW_SHARED",
  }),
  Object.freeze({
    id: "copy_bell_map",
    label: "鈴の位置を写す",
    family: "record",
    minutes: 18,
    summary: "警戒罠の鈴を置いた場所を、ジルの古い森図へ写した。鳴った順番から、狼が村へ近づく方向を後で比較できる。",
    speech: "印は小さくしろ。地図を落とした時、知らない奴に罠の場所まで教える必要はない。",
    worldFlag: "day2Hunter:bellMapCopied",
    historyType: "DAY2_HUNTER_BELL_MAP_COPIED",
    evidenceId: "T03-EVIDENCE-DAY2-WARNING-BELL-MAP",
    evidenceSource: "LOC_FOREST_HUNTER_HUT:HUNTER_FIELD_MAP",
  }),
  Object.freeze({
    id: "send_warning",
    label: "村へ知らせる",
    family: "coordination",
    minutes: 12,
    summary: "北の柵を避け、家畜を早めに内側へ入れるよう、ジルの短い伝言を村の見回りへ託した。",
    speech: "騒がせるな。狼が来たと言い切るな。北の柵を空けて、日暮れ前に家畜を入れろ。それだけ伝えればいい。",
    worldFlag: "day2Hunter:villageWarningQueued",
    historyType: "DAY2_HUNTER_VILLAGE_WARNING_QUEUED",
    goapRequestId: "GOAP-DAY2-JILL-NORTH-FENCE-WARNING",
  }),
]);

function array(value) { return Array.isArray(value) ? value : []; }
function player(runtime) { return runtime?.playerState?.player ?? runtime?.playerState ?? {}; }
function hasHistory(runtime, type) { return array(runtime?.playerState?.history).some((entry) => entry?.type === type); }

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day2T01HunterLunch ??= {
    version: AUTHORED_DAY2_T01_HUNTER_LUNCH_VERSION,
    selectedActionId: null,
    closedActionIds: [],
    completedAtMinute: null,
  };
  const state = runtime.playerState.day2T01HunterLunch;
  state.version = AUTHORED_DAY2_T01_HUNTER_LUNCH_VERSION;
  state.closedActionIds = array(state.closedActionIds).map(String);
  return state;
}

function eligible(runtime) {
  const current = player(runtime);
  return current.location === LOCATION
    && current.facilityId === FACILITY_ID
    && hasHistory(runtime, SOURCE_HISTORY)
    && ensureState(runtime).completedAtMinute == null;
}

function actionFor(choice) {
  return {
    id: `MISSION_FLOW:T01:DAY2_HUNTER_LUNCH:${choice.id}`,
    type: "plan",
    family: choice.family,
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: HUNTER_ID,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredDay2T01HunterLunchChoice: true,
    authoredDay2T01HunterLunchData: choice,
  };
}

function actions(runtime) { return eligible(runtime) ? CHOICES.map(actionFor) : null; }

function consume(runtime, action, result) {
  if (!action?.authoredDay2T01HunterLunchChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;

  const choice = action.authoredDay2T01HunterLunchData;
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

  if (choice.hungerDelta) current.hunger = Math.max(0, Number(current.hunger ?? 0) + choice.hungerDelta);
  if (choice.fatigueDelta) current.fatigue = Math.max(0, Number(current.fatigue ?? 0) + choice.fatigueDelta);
  if (choice.evidenceId) {
    runtime.playerState.evidence[choice.evidenceId] = {
      id: choice.evidenceId,
      source: choice.evidenceSource,
      acquiredAtMinute: minute,
    };
  }
  if (choice.goapRequestId) {
    runtime.playerState.goapRequests[choice.goapRequestId] = {
      id: choice.goapRequestId,
      actorNpcId: HUNTER_ID,
      goal: "warn_village_north_fence",
      destination: "LOC_FARM_NORTH_FENCE",
      status: "queued",
      createdAtMinute: minute,
      dueAtMinute: minute + 180,
    };
  }

  runtime.playerState.history.push({
    type: choice.historyType,
    minute,
    missionId: MISSION_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    sourceHistoryType: SOURCE_HISTORY,
    closedActionIds: [...state.closedActionIds],
    evidenceId: choice.evidenceId ?? null,
    evidenceSource: choice.evidenceSource ?? null,
    goapRequestId: choice.goapRequestId ?? null,
    location: current.location,
    facilityId: current.facilityId,
  });

  result.summary = choice.summary;
  result.speeches = [{ actorId: HUNTER_ID, text: choice.speech, emotion: "短く実務的" }];
  result.evidenceId = choice.evidenceId ?? null;
  result.goapRequestId = choice.goapRequestId ?? null;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return actions(runtime) ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "直した鈴が風に一度だけ鳴り、鍋から湯気が上がった",
      title: "狩人小屋の昼支度",
      detail: "昼を食べる、警戒線を記録する、村へ知らせる。狼を追う前にも、できることがある。",
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

export const AUTHORED_DAY2_T01_HUNTER_LUNCH_INTERNALS = Object.freeze({
  ensureState, eligible, actionFor, actions, consume, CHOICES, SCENE_ID, SOURCE_HISTORY,
});
