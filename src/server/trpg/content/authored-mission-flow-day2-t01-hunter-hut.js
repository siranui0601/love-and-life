import * as base from "./authored-mission-flow-day2-t01-merchant-stall.js";

export * from "./authored-mission-flow-day2-t01-merchant-stall.js";

export const AUTHORED_DAY2_T01_HUNTER_HUT_VERSION = "authored-day2-t01-hunter-hut-v1";

const MISSION_ID = "MSN-T01";
const SCENE_ID = "t01-day2-hunter-hut-after-delivery";
const LOCATION = "森";
const FACILITY_ID = "LOC_FOREST_HUNTER_HUT";
const HUNTER_ID = "NPC060";
const SOURCE_HISTORY = "DAY2_HUNTER_PARCEL_DELIVERED";

const CHOICES = Object.freeze([
  Object.freeze({
    id: "repair_snare",
    label: "罠を直す",
    family: "work",
    minutes: 24,
    summary: "ジルと古い罠の留め具を直した。獲物を捕るためではなく、狼が近づいた時だけ鈴が鳴るよう張り方を変えた。",
    speech: "締めすぎるな。獣を傷つけたいわけじゃない。ここへ来た方向だけ分かれば、村の家畜を先に動かせる。",
    worldFlag: "day2Hunter:warningSnareRepaired",
    historyType: "DAY2_HUNTER_WARNING_SNARE_REPAIRED",
    evidenceId: "T03-EVIDENCE-WARNING-SNARE-LINE",
    evidenceSource: "LOC_FOREST_HUNTER_HUT:WARNING_SNARE",
  }),
  Object.freeze({
    id: "try_wolf_whistle",
    label: "狼笛を吹く",
    family: "curiosity",
    minutes: 11,
    summary: "棚に置かれた狼笛を短く吹いた。狼の返事はなかったが、北の茂みから鳥だけが一斉に飛び立った。",
    speech: "返事がない方が厄介な時もある。鳥が逃げた場所を覚えておけ。群れが息を潜めているかもしれん。",
    worldFlag: "day2Hunter:wolfWhistleTried",
    historyType: "DAY2_HUNTER_WOLF_WHISTLE_TRIED",
    rumorSeed: "RUMOR-DAY2-NORTH-BRUSH-SILENCE",
  }),
  Object.freeze({
    id: "return_to_village",
    label: "村へ戻る",
    family: "move",
    minutes: 42,
    summary: "小包を届けたところで森を離れ、昼前の田園の村へ戻った。狼の痕跡はジルへ任せ、自分の次の行動を選び直す。",
    speech: "北の柵には近づくな。何かあれば俺が村長へ知らせる。お前は昨日の傷を増やすなよ。",
    worldFlag: "day2Hunter:returnToVillageChosen",
    historyType: "DAY2_HUNTER_RETURNED_TO_VILLAGE",
    destination: "田園の村",
    facilityId: "LOC_FARM_SQUARE",
  }),
]);

function array(value) { return Array.isArray(value) ? value : []; }
function player(runtime) { return runtime?.playerState?.player ?? runtime?.playerState ?? {}; }
function hasHistory(runtime, type) { return array(runtime?.playerState?.history).some((entry) => entry?.type === type); }

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day2T01HunterHut ??= {
    version: AUTHORED_DAY2_T01_HUNTER_HUT_VERSION,
    selectedActionId: null,
    closedActionIds: [],
    completedAtMinute: null,
  };
  const state = runtime.playerState.day2T01HunterHut;
  state.version = AUTHORED_DAY2_T01_HUNTER_HUT_VERSION;
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
    id: `MISSION_FLOW:T01:DAY2_HUNTER_HUT:${choice.id}`,
    type: "plan",
    family: choice.family,
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: HUNTER_ID,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredDay2T01HunterHutChoice: true,
    authoredDay2T01HunterHutData: choice,
  };
}

function actions(runtime) { return eligible(runtime) ? CHOICES.map(actionFor) : null; }

function consume(runtime, action, result) {
  if (!action?.authoredDay2T01HunterHutChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;
  const choice = action.authoredDay2T01HunterHutData;
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  const current = player(runtime);
  const ids = CHOICES.map((entry) => actionFor(entry).id);

  state.selectedActionId = action.id;
  state.closedActionIds = ids.filter((id) => id !== action.id);
  state.completedAtMinute = minute;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  runtime.playerState.rumorSeeds ??= {};
  runtime.playerState.worldFlags[choice.worldFlag] = true;

  if (choice.evidenceId) {
    runtime.playerState.evidence[choice.evidenceId] = {
      id: choice.evidenceId,
      source: choice.evidenceSource,
      acquiredAtMinute: minute,
    };
  }
  if (choice.rumorSeed) {
    runtime.playerState.rumorSeeds[choice.rumorSeed] = {
      id: choice.rumorSeed,
      sourceNpcId: HUNTER_ID,
      sourceFacilityId: FACILITY_ID,
      createdAtMinute: minute,
      status: "seeded",
    };
  }
  if (choice.destination) current.location = choice.destination;
  if (choice.facilityId) current.facilityId = choice.facilityId;

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
    rumorSeed: choice.rumorSeed ?? null,
    location: current.location,
    facilityId: current.facilityId,
  });

  result.summary = choice.summary;
  result.speeches = [{ actorId: HUNTER_ID, text: choice.speech, emotion: "ぶっきらぼうだが気遣う" }];
  result.evidenceId = choice.evidenceId ?? null;
  result.rumorSeed = choice.rumorSeed ?? null;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return actions(runtime) ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "小包を受け取ったジルは、軒先の狼毛を指でつまんだ",
      title: "狩人小屋の昼前",
      detail: "配達は終わった。罠を手伝う、気になる笛を試す、村へ戻る。森で過ごす理由はまだ選べる。",
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

export const AUTHORED_DAY2_T01_HUNTER_HUT_INTERNALS = Object.freeze({
  ensureState, eligible, actionFor, actions, consume, CHOICES, SCENE_ID, SOURCE_HISTORY,
});
