import * as base from "./authored-mission-flow-t13-workshop-aftertaste.js";
import {
  AUTHORED_MISSION_T13_WORKSHOP_AFTERTASTE_INTERNALS as aftertaste,
} from "./authored-mission-flow-t13-workshop-aftertaste.js";
import {
  AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_INTERNALS as interlude,
} from "./authored-mission-flow-t13-workshop-interlude.js";

export * from "./authored-mission-flow-t13-workshop-aftertaste.js";

export const AUTHORED_MISSION_T13_WORKSHOP_SAMPLE_CUSTODY_VERSION =
  "authored-mission-t13-workshop-sample-custody-v1";

const FLOW_ID = "forest-king-slime-world-tree-collapse";
const MISSION_ID = "MSN-T13";
const SCENE_ID = "t13-workshop-sample-custody";
const INSPECT_ACTION_ID =
  "MISSION_FLOW:T13:WORKSHOP_AFTERTASTE:inspect_cooling_bucket";
const CAPITAL_HUB = "王都";

const CHOICES = Object.freeze({
  leave: Object.freeze({
    id: "leave_sample_with_mina",
    label: "ミーナに預ける",
    minutes: 8,
    family: "talk",
    type: "conversation",
    summary: "封じた瓶をミーナへ戻した。彼女は蝋へ工房印を押し、採取時刻と桶の番号を帳面へ書き込んだ。試料は動かないが、誰がいつ封じたかを後から確かめられる形で残る。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "持ち歩けば割る。ここへ置くなら、私の印とお前の目撃が残る。あとで話が食い違っても、瓶までは嘘をつかん。",
      emotion: "実務的な信頼",
    }),
    worldFlag: "t13SampleCustody:sealedAtWorkshop",
    historyType: "T13_WORKSHOP_SAMPLE_LEFT_WITH_MINA",
    custody: "NPC037",
  }),
  capital: Object.freeze({
    id: "carry_sample_to_capital",
    label: "王都へ運ぶ",
    minutesBonus: 9,
    family: "travel",
    type: "regionalTravel",
    summary: "瓶を布と木屑で包み、工房印が見える向きで荷へ収めた。試料を王都へ運べば公的な検査や資金交渉へ使える一方、道中で割れれば元には戻らない。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "運ぶなら横にするな。門で開けろと言われても栓には触らせるな。割ったら、お前の腹の記憶だけが証拠だ。",
      emotion: "厳しい注意",
    }),
    worldFlag: "t13SampleCustody:carriedTowardCapital",
    historyType: "T13_WORKSHOP_SAMPLE_CARRIED_TO_CAPITAL",
    custody: "PLAYER",
  }),
  smell: Object.freeze({
    id: "smell_sample_stop",
    label: "栓を嗅いでみる",
    minutes: 3,
    family: "prepare",
    type: "plan",
    summary: "栓の隙間へ鼻を寄せると、甘い匂いの奥で濡れた鉄の臭いがした。直後に喉がひりつき、ミーナは瓶を取り上げて『吸い込んだ者』として記録を付け足した。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "飲んだ次は嗅ぐのか。次に舐めたら椅子へ縛る。だが、その咳は書いておく。水だけの反応じゃない。",
      emotion: "怒り半分、観察半分",
    }),
    worldFlag: "t13SampleCustody:odorExposureRecorded",
    historyType: "T13_WORKSHOP_SAMPLE_ODOR_EXPOSURE",
    custody: "NPC037",
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

function freshSampleCustodyState() {
  return {
    version: AUTHORED_MISSION_T13_WORKSHOP_SAMPLE_CUSTODY_VERSION,
    sceneId: SCENE_ID,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
    custody: null,
  };
}

function ensureSampleCustodyState(flow) {
  if (!flow) return null;
  flow.workshopSampleCustody ??= freshSampleCustodyState();
  const state = flow.workshopSampleCustody;
  state.version = AUTHORED_MISSION_T13_WORKSHOP_SAMPLE_CUSTODY_VERSION;
  state.sceneId = SCENE_ID;
  state.completedAtMinute ??= null;
  state.selectedActionId ??= null;
  state.closedActionIds = array(state.closedActionIds).map(String);
  state.custody ??= null;
  return state;
}

function sampleCustodyEligible(runtime) {
  const flow = flowFor(runtime);
  if (!flow || !interlude.atEngineerWorkshop(runtime)) return false;
  const aftertasteState = aftertaste.ensureAftertasteState(flow);
  if (aftertasteState?.selectedActionId !== INSPECT_ACTION_ID) return false;
  const state = ensureSampleCustodyState(flow);
  return state.completedAtMinute == null;
}

function capitalMovement(context) {
  return array(context?.movementActions).find((action) =>
    action?.movementScope === "regional" && action?.destinationHub === CAPITAL_HUB) ?? null;
}

function commonAction(choice, kind) {
  return {
    id: `MISSION_FLOW:T13:WORKSHOP_SAMPLE:${choice.id}`,
    family: choice.family,
    type: choice.type,
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: "NPC037",
    targetNpcName: "ミーナ",
    dialogueTopic: `t13_workshop_sample_${choice.id}`,
    singleTurnConversation: choice.type === "conversation",
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: `workshop_sample_${kind}`,
    authoredMissionWorkshopSampleChoice: true,
    authoredMissionWorkshopSampleSceneId: SCENE_ID,
    authoredMissionWorkshopSampleChoiceId: choice.id,
    authoredMissionWorkshopSampleSummary: choice.summary,
    authoredMissionWorkshopSampleSpeech: choice.speech,
    authoredMissionWorkshopSampleWorldFlag: choice.worldFlag,
    authoredMissionWorkshopSampleHistoryType: choice.historyType,
    authoredMissionWorkshopSampleCustody: choice.custody,
  };
}

function sampleCustodyActions(runtime, context = {}) {
  if (!sampleCustodyEligible(runtime)) return null;
  const leave = commonAction(CHOICES.leave, "leave");
  const smell = commonAction(CHOICES.smell, "smell");
  const movement = capitalMovement(context);
  const capital = movement
    ? {
      ...movement,
      ...commonAction(CHOICES.capital, "capital"),
      id: `MISSION_FLOW:T13:WORKSHOP_SAMPLE:${CHOICES.capital.id}`,
      type: movement.type,
      family: movement.family ?? "travel",
      minutes: Math.max(1, Number(movement.minutes ?? 0)) + CHOICES.capital.minutesBonus,
      authoredMissionWorkshopSampleTargetActionId: movement.id,
    }
    : {
      ...commonAction(CHOICES.capital, "capital"),
      minutes: 189,
      movementScope: "regional",
      destinationHub: CAPITAL_HUB,
      destinationFacilityId: "LOC_CAP_GATE",
      targetLocation: CAPITAL_HUB,
    };
  return [leave, capital, smell];
}

function consumeSampleCustody(runtime, action, result) {
  if (!action?.authoredMissionWorkshopSampleChoice || result?.ok === false) return false;
  const flow = flowFor(runtime);
  if (!flow) return false;
  const state = ensureSampleCustodyState(flow);
  if (state.completedAtMinute != null) return false;

  const actionIds = Object.values(CHOICES).map((choice) =>
    `MISSION_FLOW:T13:WORKSHOP_SAMPLE:${choice.id}`);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = actionIds.filter((id) => id !== action.id);
  state.custody = action.authoredMissionWorkshopSampleCustody;

  runtime.playerState ??= {};
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags.t13WorkshopSampleCustodyCompleted = true;
  runtime.playerState.worldFlags[action.authoredMissionWorkshopSampleWorldFlag] = true;
  runtime.playerState.history.push({
    type: action.authoredMissionWorkshopSampleHistoryType,
    minute,
    missionId: MISSION_ID,
    flowId: FLOW_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    closedActionIds: [...state.closedActionIds],
    sourceHistoryType: "T13_WORKSHOP_BUCKET_SAMPLE_SEALED",
    sampleCustody: state.custody,
    location: player(runtime).location ?? null,
    facilityId: player(runtime).facilityId ?? null,
  });

  result.summary = action.authoredMissionWorkshopSampleSummary;
  result.sceneTransition = action.authoredMissionWorkshopSampleCustody === "PLAYER"
    ? "封じた試料を携え、工房から王都へ向かう"
    : "試料の保管方法を決め、同じ三択へ戻らず工房での次行動へ進む";
  result.speeches = [action.authoredMissionWorkshopSampleSpeech];
  return true;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === FLOW_ID) ensureSampleCustodyState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === FLOW_ID) ensureSampleCustodyState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = sampleCustodyActions(runtime, context);
  if (actions) return actions;
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (sampleCustodyEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "薄い膜を封じた瓶がある",
      title: "試験水の瓶をどうするか",
      detail: "工房へ残しても、王都へ運んでも、もう一度近づいてもよい。瓶の所在と扱った者は後の記録に残る。",
      targetLocation: "ドワーフ洞窟",
      targetFacilityId: "LOC_DWARF_ENGINEER",
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consumeSampleCustody(runtime, action, result) || changed;
}

export const AUTHORED_MISSION_T13_WORKSHOP_SAMPLE_CUSTODY_INTERNALS = Object.freeze({
  array,
  flowFor,
  player,
  freshSampleCustodyState,
  ensureSampleCustodyState,
  sampleCustodyEligible,
  capitalMovement,
  commonAction,
  sampleCustodyActions,
  consumeSampleCustody,
  CHOICES,
  SCENE_ID,
  INSPECT_ACTION_ID,
});
