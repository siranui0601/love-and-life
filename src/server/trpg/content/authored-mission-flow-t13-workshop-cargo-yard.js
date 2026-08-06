import * as base from "./authored-mission-flow-t13-workshop-nightfall.js";
import {
  AUTHORED_MISSION_T13_WORKSHOP_NIGHTFALL_INTERNALS as nightfall,
} from "./authored-mission-flow-t13-workshop-nightfall.js";
import {
  AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_INTERNALS as interlude,
} from "./authored-mission-flow-t13-workshop-interlude.js";

export * from "./authored-mission-flow-t13-workshop-nightfall.js";

export const AUTHORED_MISSION_T13_WORKSHOP_CARGO_YARD_VERSION =
  "authored-mission-t13-workshop-cargo-yard-v1";

const FLOW_ID = "forest-king-slime-world-tree-collapse";
const MISSION_ID = "MSN-T13";
const SCENE_ID = "t13-workshop-cargo-yard";
const FORGE_MEAL_ACTION_ID =
  "MISSION_FLOW:T13:WORKSHOP_NIGHTFALL:eat_forge_porridge";

const CHOICES = Object.freeze({
  push: Object.freeze({
    id: "push_stuck_cart",
    label: "荷車を押す",
    minutes: 28,
    family: "help",
    type: "plan",
    summary: "食後、洞窟口で車輪を溝へ落とした荷車を弟子たちと押し上げた。積荷は空の鉄枠と木杭だったが、泥の付着位置から森側の旧道を通って来たことが分かった。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "腰で押せ。腕だけでやると明日使い物にならん。……よし、その泥は落とすな。どの道を通ったか、車輪の方が御者より正直だ。",
      emotion: "作業へ集中した実務口調",
    }),
    worldFlag: "t13WorkshopCargoYard:cartFreed",
    historyType: "T13_WORKSHOP_STUCK_CART_FREED",
  }),
  tag: Object.freeze({
    id: "borrow_cargo_tag",
    label: "荷札を借りる",
    minutes: 11,
    family: "investigate",
    type: "plan",
    summary: "荷台に残った古い荷札を一晩だけ借りた。表には鉄枠、裏には消しかけの森側集積所番号があり、工房の帳面と照合できる記録になった。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "持っていくなら返せ。紙切れでも帳面と組めば道筋になる。勝手に答えを書き足すなよ。",
      emotion: "証拠を扱う慎重さ",
    }),
    worldFlag: "t13WorkshopCargoYard:cargoTagBorrowed",
    historyType: "T13_WORKSHOP_CARGO_TAG_BORROWED",
  }),
  sleep: Object.freeze({
    id: "sleep_on_cart_bed",
    label: "荷台で寝る",
    minutes: 76,
    family: "rest",
    type: "plan",
    summary: "空荷の荷台へ毛布を敷き、そのまま眠った。夜半、誰かが荷車を少し動かした揺れで目を覚ましたが、足音は工房ではなく洞窟口の方へ消えた。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "寝床なら中にある。……もう寝たのか。起こすな、毛布だけ掛けろ。荷車が動いたら砂時計を見ろ。",
      emotion: "呆れと気遣い",
    }),
    worldFlag: "t13WorkshopCargoYard:cartBedSleep",
    historyType: "T13_WORKSHOP_CART_BED_SLEEP",
  }),
});

function array(value) {
  return Array.isArray(value) ? value : [];
}

function flowFor(runtime) {
  return runtime?.authoredMissionFlows?.[FLOW_ID] ?? null;
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function freshCargoYardState() {
  return {
    version: AUTHORED_MISSION_T13_WORKSHOP_CARGO_YARD_VERSION,
    sceneId: SCENE_ID,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
  };
}

function ensureCargoYardState(flow) {
  if (!flow) return null;
  flow.workshopCargoYard ??= freshCargoYardState();
  const state = flow.workshopCargoYard;
  state.version = AUTHORED_MISSION_T13_WORKSHOP_CARGO_YARD_VERSION;
  state.sceneId = SCENE_ID;
  state.completedAtMinute ??= null;
  state.selectedActionId ??= null;
  state.closedActionIds = array(state.closedActionIds).map(String);
  return state;
}

function cargoYardEligible(runtime) {
  const flow = flowFor(runtime);
  if (!flow || !interlude.atEngineerWorkshop(runtime)) return false;
  const nightfallState = nightfall.ensureNightfallState(flow);
  if (nightfallState?.selectedActionId !== FORGE_MEAL_ACTION_ID) return false;
  const state = ensureCargoYardState(flow);
  return state.completedAtMinute == null;
}

function commonAction(choice) {
  return {
    id: `MISSION_FLOW:T13:WORKSHOP_CARGO_YARD:${choice.id}`,
    family: choice.family,
    type: choice.type,
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: "NPC037",
    targetNpcName: "ミーナ",
    dialogueTopic: `t13_workshop_cargo_yard_${choice.id}`,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: `workshop_cargo_yard_${choice.id}`,
    authoredMissionWorkshopCargoYardChoice: true,
    authoredMissionWorkshopCargoYardSceneId: SCENE_ID,
    authoredMissionWorkshopCargoYardChoiceId: choice.id,
    authoredMissionWorkshopCargoYardSummary: choice.summary,
    authoredMissionWorkshopCargoYardSpeech: choice.speech,
    authoredMissionWorkshopCargoYardWorldFlag: choice.worldFlag,
    authoredMissionWorkshopCargoYardHistoryType: choice.historyType,
  };
}

function cargoYardActions(runtime) {
  if (!cargoYardEligible(runtime)) return null;
  return Object.values(CHOICES).map(commonAction);
}

function consumeCargoYard(runtime, action, result) {
  if (!action?.authoredMissionWorkshopCargoYardChoice || result?.ok === false) return false;
  const flow = flowFor(runtime);
  if (!flow) return false;
  const state = ensureCargoYardState(flow);
  if (state.completedAtMinute != null) return false;

  const actionIds = Object.values(CHOICES).map((choice) =>
    `MISSION_FLOW:T13:WORKSHOP_CARGO_YARD:${choice.id}`);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = actionIds.filter((id) => id !== action.id);

  runtime.playerState ??= {};
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags.t13WorkshopCargoYardCompleted = true;
  runtime.playerState.worldFlags[action.authoredMissionWorkshopCargoYardWorldFlag] = true;
  runtime.playerState.history.push({
    type: action.authoredMissionWorkshopCargoYardHistoryType,
    minute,
    missionId: MISSION_ID,
    flowId: FLOW_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    closedActionIds: [...state.closedActionIds],
    sourceHistoryType: "T13_WORKSHOP_FORGE_MEAL_SHARED",
    sampleCustody: "NPC037",
    location: player(runtime).location ?? null,
    facilityId: player(runtime).facilityId ?? null,
  });

  result.summary = action.authoredMissionWorkshopCargoYardSummary;
  result.sceneTransition = action.authoredMissionWorkshopCargoYardHistoryType ===
    "T13_WORKSHOP_STUCK_CART_FREED"
    ? "荷車の泥と旧道の痕跡を、森側の輸送経路へ持ち越す"
    : action.authoredMissionWorkshopCargoYardHistoryType ===
      "T13_WORKSHOP_CARGO_TAG_BORROWED"
      ? "借りた荷札を工房帳面や村の荷受記録と照合できる"
      : "荷台が動いた時刻と洞窟口へ消えた足音を記憶に残す";
  result.speeches = [action.authoredMissionWorkshopCargoYardSpeech];
  return true;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === FLOW_ID) ensureCargoYardState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === FLOW_ID) ensureCargoYardState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = cargoYardActions(runtime, context);
  if (actions) return actions;
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (cargoYardEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "粥の鍋が空になる頃、洞窟口で車輪が石へ噛んだ",
      title: "食後の荷車をどうするか",
      detail: "押しても、荷札だけ借りても、空いた荷台を寝床にしてもよい。事件とは無関係に見える食後の行動が、輸送路と工房の記録を変える。",
      targetLocation: "ドワーフ洞窟",
      targetFacilityId: "LOC_DWARF_ENGINEER",
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consumeCargoYard(runtime, action, result) || changed;
}

export const AUTHORED_MISSION_T13_WORKSHOP_CARGO_YARD_INTERNALS = Object.freeze({
  array,
  flowFor,
  player,
  freshCargoYardState,
  ensureCargoYardState,
  cargoYardEligible,
  commonAction,
  cargoYardActions,
  consumeCargoYard,
  CHOICES,
  SCENE_ID,
  FORGE_MEAL_ACTION_ID,
});
