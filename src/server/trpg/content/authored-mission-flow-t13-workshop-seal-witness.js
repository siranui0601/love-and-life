import * as base from "./authored-mission-flow-t13-workshop-sample-custody.js";
import {
  AUTHORED_MISSION_T13_WORKSHOP_SAMPLE_CUSTODY_INTERNALS as custody,
} from "./authored-mission-flow-t13-workshop-sample-custody.js";
import {
  AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_INTERNALS as interlude,
} from "./authored-mission-flow-t13-workshop-interlude.js";

export * from "./authored-mission-flow-t13-workshop-sample-custody.js";

export const AUTHORED_MISSION_T13_WORKSHOP_SEAL_WITNESS_VERSION =
  "authored-mission-t13-workshop-seal-witness-v1";

const FLOW_ID = "forest-king-slime-world-tree-collapse";
const MISSION_ID = "MSN-T13";
const SCENE_ID = "t13-workshop-seal-witness";
const LEFT_WITH_MINA_ACTION_ID =
  "MISSION_FLOW:T13:WORKSHOP_SAMPLE:leave_sample_with_mina";

const CHOICES = Object.freeze({
  sign: Object.freeze({
    id: "sign_sample_ledger",
    label: "帳面に署名する",
    minutes: 5,
    family: "talk",
    type: "conversation",
    summary: "ミーナが採取時刻と桶番号を書いた欄へ、立会人として名を残した。瓶、工房印、採取記録、立会人が一続きになり、後から誰かが話を変えても記録同士を照合できる。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "読める字で書け。上手い字でなくていい。瓶を封じた時に、お前がここにいたと分かれば十分だ。",
      emotion: "厳密だが穏やか",
    }),
    worldFlag: "t13SealWitness:ledgerSigned",
    historyType: "T13_WORKSHOP_SAMPLE_LEDGER_SIGNED",
  }),
  sketch: Object.freeze({
    id: "sketch_sealed_bottle",
    label: "瓶を絵に描く",
    minutes: 9,
    family: "prepare",
    type: "plan",
    summary: "紙片へ瓶の形、蝋の欠け、工房印の向きを描き写した。絵は不格好だが、瓶が取り替えられた時に見比べられる特徴が残った。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "絵心は期待してない。蝋の欠けと印の向きだけは誤魔化すな。そこが同じ瓶かを見分ける印になる。",
      emotion: "半信半疑の実務指導",
    }),
    worldFlag: "t13SealWitness:bottleSketchMade",
    historyType: "T13_WORKSHOP_SAMPLE_BOTTLE_SKETCHED",
  }),
  boast: Object.freeze({
    id: "show_off_sealed_sample",
    label: "弟子に見せびらかす",
    minutes: 4,
    family: "talk",
    type: "conversation",
    summary: "封じた瓶を指して大げさに語ると、工房の弟子たちは笑いながらも、蝋印の瓶を勝手に動かしてはいけないと覚えた。噂は広がるが、瓶を見張る目も増える。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "英雄譚にするな。……だが全員、瓶の印は見たな。触るな、動かすな、誰かが近づいたら私を呼べ。",
      emotion: "呆れながら利用する",
    }),
    worldFlag: "t13SealWitness:apprenticesAware",
    historyType: "T13_WORKSHOP_SAMPLE_SHOWN_TO_APPRENTICES",
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

function freshSealWitnessState() {
  return {
    version: AUTHORED_MISSION_T13_WORKSHOP_SEAL_WITNESS_VERSION,
    sceneId: SCENE_ID,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
  };
}

function ensureSealWitnessState(flow) {
  if (!flow) return null;
  flow.workshopSealWitness ??= freshSealWitnessState();
  const state = flow.workshopSealWitness;
  state.version = AUTHORED_MISSION_T13_WORKSHOP_SEAL_WITNESS_VERSION;
  state.sceneId = SCENE_ID;
  state.completedAtMinute ??= null;
  state.selectedActionId ??= null;
  state.closedActionIds = array(state.closedActionIds).map(String);
  return state;
}

function sealWitnessEligible(runtime) {
  const flow = flowFor(runtime);
  if (!flow || !interlude.atEngineerWorkshop(runtime)) return false;
  const custodyState = custody.ensureSampleCustodyState(flow);
  if (custodyState?.selectedActionId !== LEFT_WITH_MINA_ACTION_ID) return false;
  if (custodyState?.custody !== "NPC037") return false;
  const state = ensureSealWitnessState(flow);
  return state.completedAtMinute == null;
}

function commonAction(choice) {
  return {
    id: `MISSION_FLOW:T13:WORKSHOP_SEAL:${choice.id}`,
    family: choice.family,
    type: choice.type,
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: "NPC037",
    targetNpcName: "ミーナ",
    dialogueTopic: `t13_workshop_seal_${choice.id}`,
    singleTurnConversation: choice.type === "conversation",
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: `workshop_seal_${choice.id}`,
    authoredMissionWorkshopSealChoice: true,
    authoredMissionWorkshopSealSceneId: SCENE_ID,
    authoredMissionWorkshopSealChoiceId: choice.id,
    authoredMissionWorkshopSealSummary: choice.summary,
    authoredMissionWorkshopSealSpeech: choice.speech,
    authoredMissionWorkshopSealWorldFlag: choice.worldFlag,
    authoredMissionWorkshopSealHistoryType: choice.historyType,
  };
}

function sealWitnessActions(runtime) {
  if (!sealWitnessEligible(runtime)) return null;
  return Object.values(CHOICES).map(commonAction);
}

function consumeSealWitness(runtime, action, result) {
  if (!action?.authoredMissionWorkshopSealChoice || result?.ok === false) return false;
  const flow = flowFor(runtime);
  if (!flow) return false;
  const state = ensureSealWitnessState(flow);
  if (state.completedAtMinute != null) return false;

  const actionIds = Object.values(CHOICES).map((choice) =>
    `MISSION_FLOW:T13:WORKSHOP_SEAL:${choice.id}`);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = actionIds.filter((id) => id !== action.id);

  runtime.playerState ??= {};
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags.t13WorkshopSealWitnessCompleted = true;
  runtime.playerState.worldFlags[action.authoredMissionWorkshopSealWorldFlag] = true;
  runtime.playerState.history.push({
    type: action.authoredMissionWorkshopSealHistoryType,
    minute,
    missionId: MISSION_ID,
    flowId: FLOW_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    closedActionIds: [...state.closedActionIds],
    sourceHistoryType: "T13_WORKSHOP_SAMPLE_LEFT_WITH_MINA",
    sampleCustody: "NPC037",
    location: player(runtime).location ?? null,
    facilityId: player(runtime).facilityId ?? null,
  });

  result.summary = action.authoredMissionWorkshopSealSummary;
  result.sceneTransition = "封印試料の立会方法を決め、瓶を工房へ残したまま次の行動へ進む";
  result.speeches = [action.authoredMissionWorkshopSealSpeech];
  return true;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === FLOW_ID) ensureSealWitnessState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === FLOW_ID) ensureSealWitnessState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = sealWitnessActions(runtime, context);
  if (actions) return actions;
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (sealWitnessEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "工房印を押した瓶が棚に置かれた",
      title: "封じた試料へ立会いを残す",
      detail: "帳面へ名を残しても、瓶の特徴を写しても、工房の弟子へ知らせてもよい。何を残すかで、後から瓶を守る方法が変わる。",
      targetLocation: "ドワーフ洞窟",
      targetFacilityId: "LOC_DWARF_ENGINEER",
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consumeSealWitness(runtime, action, result) || changed;
}

export const AUTHORED_MISSION_T13_WORKSHOP_SEAL_WITNESS_INTERNALS = Object.freeze({
  array,
  flowFor,
  player,
  freshSealWitnessState,
  ensureSealWitnessState,
  sealWitnessEligible,
  commonAction,
  sealWitnessActions,
  consumeSealWitness,
  CHOICES,
  SCENE_ID,
  LEFT_WITH_MINA_ACTION_ID,
});
