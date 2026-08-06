import * as base from "./authored-mission-flow-t13-workshop-interlude-top.js";
import {
  AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_INTERNALS as interlude,
} from "./authored-mission-flow-t13-workshop-interlude.js";

export * from "./authored-mission-flow-t13-workshop-interlude-top.js";

export const AUTHORED_MISSION_T13_WORKSHOP_AFTERTASTE_VERSION =
  "authored-mission-t13-workshop-aftertaste-v1";

const FLOW_ID = "forest-king-slime-world-tree-collapse";
const MISSION_ID = "MSN-T13";
const SCENE_ID = "t13-workshop-water-aftertaste";
const DRINK_ACTION_ID = "MISSION_FLOW:T13:WORKSHOP_INTERLUDE:drink_workshop_water";

const CHOICES = Object.freeze({
  inspect: Object.freeze({
    id: "inspect_cooling_bucket",
    label: "桶を調べる",
    minutes: 12,
    family: "investigate",
    type: "investigation",
    summary: "飲み残しを光へ透かすと、底に薄い膜が揺れた。ミーナは匙で膜をすくい、排水輪の試験水と森の粘液を別々の瓶へ封じた。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "甘いだけなら砂糖で済む。膜が戻るなら別物だ。瓶には触るな。今度は飲む前に呼べ。",
      emotion: "呆れを押し込めた集中",
    }),
    worldFlag: "t13Aftertaste:bucketSampleSealed",
    historyType: "T13_WORKSHOP_BUCKET_SAMPLE_SEALED",
  }),
  bluff: Object.freeze({
    id: "pretend_nothing_happened",
    label: "平気な顔をする",
    minutes: 5,
    family: "talk",
    type: "conversation",
    summary: "何事もなかったように頷いたが、腹が小さく鳴った。ミーナは黙って炭粉を差し出し、工房の弟子たちは『試験水を飲んでも立っていた旅人』の話を覚えた。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "平気な顔は勝手だが、倒れる場所は選べ。炉の前だけはやめろ。あと、これを飲め。今度は本当に飲み物だ。",
      emotion: "冷静な呆れとわずかな気遣い",
    }),
    worldFlag: "t13Aftertaste:workshopBravadoRumorSeed",
    historyType: "T13_WORKSHOP_BRAVADO_RUMOR_SEED",
  }),
  spit: Object.freeze({
    id: "spit_out_workshop_water",
    label: "水を吐き出す",
    minutes: 3,
    family: "prepare",
    type: "plan",
    summary: "慌てて桶の脇へ水を吐き出した。床の鉄粉が一瞬だけ青く曇り、ミーナは濡れた箇所を布ごと切り取って保管した。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "汚いが、今の色は見た。床を拭くな。布ごと切る。お前は口をすすいで座れ。",
      emotion: "驚きから即座に検証へ切り替える",
    }),
    worldFlag: "t13Aftertaste:ironDustReactionPreserved",
    historyType: "T13_WORKSHOP_IRON_DUST_REACTION_PRESERVED",
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

function freshAftertasteState() {
  return {
    version: AUTHORED_MISSION_T13_WORKSHOP_AFTERTASTE_VERSION,
    sceneId: SCENE_ID,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
  };
}

function ensureAftertasteState(flow) {
  if (!flow) return null;
  flow.workshopWaterAftertaste ??= freshAftertasteState();
  const state = flow.workshopWaterAftertaste;
  state.version = AUTHORED_MISSION_T13_WORKSHOP_AFTERTASTE_VERSION;
  state.sceneId = SCENE_ID;
  state.completedAtMinute ??= null;
  state.selectedActionId ??= null;
  state.closedActionIds = array(state.closedActionIds).map(String);
  return state;
}

function aftertasteEligible(runtime) {
  const flow = flowFor(runtime);
  if (!flow || !interlude.atEngineerWorkshop(runtime)) return false;
  const interludeState = interlude.ensureInterludeState(flow);
  if (interludeState?.selectedActionId !== DRINK_ACTION_ID) return false;
  const state = ensureAftertasteState(flow);
  return state.completedAtMinute == null;
}

function actionFor(choice) {
  return {
    id: `MISSION_FLOW:T13:WORKSHOP_AFTERTASTE:${choice.id}`,
    family: choice.family,
    type: choice.type,
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: "NPC037",
    targetNpcName: "ミーナ",
    dialogueTopic: `t13_workshop_aftertaste_${choice.id}`,
    singleTurnConversation: choice.type === "conversation",
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: "workshop_aftertaste",
    authoredMissionWorkshopAftertasteChoice: true,
    authoredMissionWorkshopAftertasteSceneId: SCENE_ID,
    authoredMissionWorkshopAftertasteChoiceId: choice.id,
    authoredMissionWorkshopAftertasteSummary: choice.summary,
    authoredMissionWorkshopAftertasteSpeech: choice.speech,
    authoredMissionWorkshopAftertasteWorldFlag: choice.worldFlag,
    authoredMissionWorkshopAftertasteHistoryType: choice.historyType,
  };
}

function aftertasteActions(runtime) {
  if (!aftertasteEligible(runtime)) return null;
  return Object.values(CHOICES).map(actionFor);
}

function consumeAftertaste(runtime, action, result) {
  if (!action?.authoredMissionWorkshopAftertasteChoice || result?.ok === false) return false;
  const flow = flowFor(runtime);
  if (!flow) return false;
  const state = ensureAftertasteState(flow);
  if (state.completedAtMinute != null) return false;

  const actionIds = Object.values(CHOICES).map((choice) =>
    `MISSION_FLOW:T13:WORKSHOP_AFTERTASTE:${choice.id}`);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = actionIds.filter((id) => id !== action.id);

  runtime.playerState ??= {};
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags.t13WorkshopAftertasteCompleted = true;
  runtime.playerState.worldFlags[action.authoredMissionWorkshopAftertasteWorldFlag] = true;
  runtime.playerState.history.push({
    type: action.authoredMissionWorkshopAftertasteHistoryType,
    minute,
    missionId: MISSION_ID,
    flowId: FLOW_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    closedActionIds: [...state.closedActionIds],
    sourceHistoryType: "T13_WORKSHOP_WATER_DRUNK",
    location: player(runtime).location ?? null,
    facilityId: player(runtime).facilityId ?? null,
  });

  result.summary = action.authoredMissionWorkshopAftertasteSummary;
  result.sceneTransition = "試験水を飲んだ直後の対応を終え、工房での次の行動へ進む";
  result.speeches = [action.authoredMissionWorkshopAftertasteSpeech];
  return true;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === FLOW_ID) ensureAftertasteState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === FLOW_ID) ensureAftertasteState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = aftertasteActions(runtime);
  if (actions) return actions;
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (aftertasteEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "口の中に甘みが残る",
      title: "試験水を飲んだ直後、どうするか",
      detail: "調べても、ごまかしても、吐き出してもよい。選んだ対応は工房の記録と噂に残る。",
      targetLocation: "ドワーフ洞窟",
      targetFacilityId: "LOC_DWARF_ENGINEER",
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consumeAftertaste(runtime, action, result) || changed;
}

export const AUTHORED_MISSION_T13_WORKSHOP_AFTERTASTE_INTERNALS = Object.freeze({
  array,
  flowFor,
  player,
  freshAftertasteState,
  ensureAftertasteState,
  aftertasteEligible,
  actionFor,
  aftertasteActions,
  consumeAftertaste,
  CHOICES,
  SCENE_ID,
  DRINK_ACTION_ID,
});
