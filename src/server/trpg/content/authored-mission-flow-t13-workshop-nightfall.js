import * as base from "./authored-mission-flow-t13-workshop-seal-witness.js";
import {
  AUTHORED_MISSION_T13_WORKSHOP_SEAL_WITNESS_INTERNALS as witness,
} from "./authored-mission-flow-t13-workshop-seal-witness.js";
import {
  AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_INTERNALS as interlude,
} from "./authored-mission-flow-t13-workshop-interlude.js";

export * from "./authored-mission-flow-t13-workshop-seal-witness.js";

export const AUTHORED_MISSION_T13_WORKSHOP_NIGHTFALL_VERSION =
  "authored-mission-t13-workshop-nightfall-v1";

const FLOW_ID = "forest-king-slime-world-tree-collapse";
const MISSION_ID = "MSN-T13";
const SCENE_ID = "t13-workshop-nightfall";
const LEDGER_SIGNED_ACTION_ID =
  "MISSION_FLOW:T13:WORKSHOP_SEAL:sign_sample_ledger";

const CHOICES = Object.freeze({
  meal: Object.freeze({
    id: "eat_forge_porridge",
    label: "炉端で粥を食べる",
    minutes: 24,
    family: "rest",
    type: "plan",
    summary: "弟子たちと炉端を囲み、麦粥と塩漬け茸を食べた。事件の話を急がない時間の中で、工房の夜勤表と荷車の出入りが自然に耳へ入った。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "証拠は腹を満たさん。冷める前に食え。弟子の話は半分だけ信じろ。残り半分は、明日の帳面と見比べればいい。",
      emotion: "ぶっきらぼうな気遣い",
    }),
    worldFlag: "t13WorkshopNightfall:forgeMealShared",
    historyType: "T13_WORKSHOP_FORGE_MEAL_SHARED",
  }),
  message: Object.freeze({
    id: "ask_apprentice_to_carry_word",
    label: "村へ伝言を頼む",
    minutes: 7,
    family: "talk",
    type: "conversation",
    summary: "明朝に田園の村へ向かう弟子へ、試料を封じたことだけを伝えてもらうよう頼んだ。中身を説明しすぎず、村側へ『工房に記録が残る』という事実だけが先に届く。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "伝えるのは瓶があることだけだ。甘いだの青いだのは言わせるな。噂は荷車より速い。速いものほど、止めるのが難しい。",
      emotion: "噂を警戒する実務口調",
    }),
    worldFlag: "t13WorkshopNightfall:villageMessageQueued",
    historyType: "T13_WORKSHOP_VILLAGE_MESSAGE_QUEUED",
  }),
  watch: Object.freeze({
    id: "take_first_watch",
    label: "夜番を引き受ける",
    minutes: 91,
    family: "prepare",
    type: "plan",
    summary: "工房の第一夜番を引き受け、試料棚と裏口を見張った。大きな異変はなかったが、夜半前に普段より遅い荷車が洞窟口で引き返した時刻を記録した。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "眠くなったら炉の前に立つな。棚、裏口、砂時計の順で見る。何も起きなかった時刻も書け。それが後で一番役に立つ。",
      emotion: "信頼を伴う厳しい指示",
    }),
    worldFlag: "t13WorkshopNightfall:firstWatchTaken",
    historyType: "T13_WORKSHOP_FIRST_WATCH_TAKEN",
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

function freshNightfallState() {
  return {
    version: AUTHORED_MISSION_T13_WORKSHOP_NIGHTFALL_VERSION,
    sceneId: SCENE_ID,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
  };
}

function ensureNightfallState(flow) {
  if (!flow) return null;
  flow.workshopNightfall ??= freshNightfallState();
  const state = flow.workshopNightfall;
  state.version = AUTHORED_MISSION_T13_WORKSHOP_NIGHTFALL_VERSION;
  state.sceneId = SCENE_ID;
  state.completedAtMinute ??= null;
  state.selectedActionId ??= null;
  state.closedActionIds = array(state.closedActionIds).map(String);
  return state;
}

function nightfallEligible(runtime) {
  const flow = flowFor(runtime);
  if (!flow || !interlude.atEngineerWorkshop(runtime)) return false;
  const witnessState = witness.ensureSealWitnessState(flow);
  if (witnessState?.selectedActionId !== LEDGER_SIGNED_ACTION_ID) return false;
  const state = ensureNightfallState(flow);
  return state.completedAtMinute == null;
}

function commonAction(choice) {
  return {
    id: `MISSION_FLOW:T13:WORKSHOP_NIGHTFALL:${choice.id}`,
    family: choice.family,
    type: choice.type,
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: "NPC037",
    targetNpcName: "ミーナ",
    dialogueTopic: `t13_workshop_nightfall_${choice.id}`,
    singleTurnConversation: choice.type === "conversation",
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: `workshop_nightfall_${choice.id}`,
    authoredMissionWorkshopNightfallChoice: true,
    authoredMissionWorkshopNightfallSceneId: SCENE_ID,
    authoredMissionWorkshopNightfallChoiceId: choice.id,
    authoredMissionWorkshopNightfallSummary: choice.summary,
    authoredMissionWorkshopNightfallSpeech: choice.speech,
    authoredMissionWorkshopNightfallWorldFlag: choice.worldFlag,
    authoredMissionWorkshopNightfallHistoryType: choice.historyType,
  };
}

function nightfallActions(runtime) {
  if (!nightfallEligible(runtime)) return null;
  return Object.values(CHOICES).map(commonAction);
}

function consumeNightfall(runtime, action, result) {
  if (!action?.authoredMissionWorkshopNightfallChoice || result?.ok === false) return false;
  const flow = flowFor(runtime);
  if (!flow) return false;
  const state = ensureNightfallState(flow);
  if (state.completedAtMinute != null) return false;

  const actionIds = Object.values(CHOICES).map((choice) =>
    `MISSION_FLOW:T13:WORKSHOP_NIGHTFALL:${choice.id}`);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = actionIds.filter((id) => id !== action.id);

  runtime.playerState ??= {};
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags.t13WorkshopNightfallCompleted = true;
  runtime.playerState.worldFlags[action.authoredMissionWorkshopNightfallWorldFlag] = true;
  runtime.playerState.history.push({
    type: action.authoredMissionWorkshopNightfallHistoryType,
    minute,
    missionId: MISSION_ID,
    flowId: FLOW_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    closedActionIds: [...state.closedActionIds],
    sourceHistoryType: "T13_WORKSHOP_SAMPLE_LEDGER_SIGNED",
    sampleCustody: "NPC037",
    location: player(runtime).location ?? null,
    facilityId: player(runtime).facilityId ?? null,
  });

  result.summary = action.authoredMissionWorkshopNightfallSummary;
  result.sceneTransition = action.authoredMissionWorkshopNightfallHistoryType ===
    "T13_WORKSHOP_FIRST_WATCH_TAKEN"
    ? "工房の夜番を終え、記録した荷車の時刻を次の調査へ持ち越す"
    : "工房での生活行動を終え、事件だけを連打せず次の行動へ進む";
  result.speeches = [action.authoredMissionWorkshopNightfallSpeech];
  return true;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === FLOW_ID) ensureNightfallState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === FLOW_ID) ensureNightfallState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = nightfallActions(runtime, context);
  if (actions) return actions;
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (nightfallEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "署名を終える頃には工房の夜番が始まる",
      title: "炉火が落ち着くまで、どう過ごすか",
      detail: "食事をしても、村へ事実だけを送っても、試料棚の夜番を引き受けてもよい。事件から少し離れた行動も、工房の人と記録を変える。",
      targetLocation: "ドワーフ洞窟",
      targetFacilityId: "LOC_DWARF_ENGINEER",
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consumeNightfall(runtime, action, result) || changed;
}

export const AUTHORED_MISSION_T13_WORKSHOP_NIGHTFALL_INTERNALS = Object.freeze({
  array,
  flowFor,
  player,
  freshNightfallState,
  ensureNightfallState,
  nightfallEligible,
  commonAction,
  nightfallActions,
  consumeNightfall,
  CHOICES,
  SCENE_ID,
  LEDGER_SIGNED_ACTION_ID,
});
