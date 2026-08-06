import * as base from "./authored-mission-flow-ambient-forest-edge.js";
import { T13_FOREST_KING_SLIME_WORLD_TREE_PACK as T13 } from "./authored/missions/t13-forest-king-slime-world-tree-collapse.js";

export * from "./authored-mission-flow-ambient-forest-edge.js";

export const AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_VERSION = "authored-mission-t13-workshop-interlude-v1";

const FLOW_ID = T13.id;
const MISSION_ID = T13.missionId;
const DWARF_HUB = "ドワーフ洞窟";
const ENGINEER_FACILITY = "LOC_DWARF_ENGINEER";
const CAPITAL_HUB = "王都";
const REQUIRED_EVIDENCE_ID = "T13-EVIDENCE-MINA-ANCHOR-PUMP-DESIGN";
const SCENE_ID = "t13-workshop-water-break";

const CHOICES = Object.freeze({
  drink: Object.freeze({
    id: "drink_workshop_water",
    label: "水をがぶ飲みする",
    minutes: 4,
    summary: "冷却桶の横に置かれた水を一息に飲んだ。鉄のような味のあと、舌にかすかな甘さが残る。ミーナは排水輪の試験水へ粘液が混じった可能性を疑い、桶を封じた。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "待て、それは飲み水じゃ――……もう遅いか。舌に甘みが残るなら吐くな。試験水を調べる。お前の腹も観察対象だ。",
      emotion: "呆れと技師の警戒",
    }),
    worldFlag: "t13Interlude:drankWorkshopWater",
    historyType: "T13_WORKSHOP_WATER_DRUNK",
  }),
  help: Object.freeze({
    id: "help_mina_clean_up",
    label: "ミーナを手伝う",
    minutes: 18,
    summary: "床へ散った留め具を拾い、排水輪を手で回した。ミーナは固定杭の重さより、現場で装置を運び直せる人数が足りないと認め、搬送用の分解手順を図面へ書き足した。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "腕力だけなら足りてる。困るのは、泥の中で順番を忘れない手だ。四番杭から外せ。逆にすると輪が噛む。",
      emotion: "ぶっきらぼうな信頼",
    }),
    worldFlag: "t13Interlude:helpedMinaPackPump",
    historyType: "T13_WORKSHOP_PUMP_PACKING_HELPED",
  }),
  capital: Object.freeze({
    id: "leave_for_capital",
    label: "王都へ行く",
    minutesBonus: 6,
    summary: "完成した設計の写しを荷に入れ、工房を出た。森へ直行せず王都へ向かうことで、装置を作る金、運ぶ荷車、減水を戦争の口実にしない公的記録を探す道が開く。",
    speech: Object.freeze({
      actorId: "NPC037",
      text: "設計はできた。次に要るのは鉄じゃない。金と荷車と、途中で没収されない紙だ。王都へ行くなら写しを持て。原本は渡さん。",
      emotion: "現実的な忠告",
    }),
    worldFlag: "t13Interlude:leftWorkshopForCapital",
    historyType: "T13_WORKSHOP_LEFT_FOR_CAPITAL",
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

function evidenceIds(runtime, flow) {
  const mission = runtime?.playerState?.missions?.[MISSION_ID] ?? {};
  return new Set([
    ...array(flow?.evidenceOrder),
    ...array(flow?.evidenceIds),
    ...array(flow?.discoveryIds),
    ...array(mission.evidenceIds),
    ...array(mission.discoveries),
    ...array(runtime?.playerState?.evidenceIds),
  ].map(String));
}

function hasAnchorPumpEvidence(runtime, flow) {
  if (evidenceIds(runtime, flow).has(REQUIRED_EVIDENCE_ID)) return true;
  const history = array(runtime?.playerState?.history);
  return history.some((entry) =>
    entry?.discoveryId === REQUIRED_EVIDENCE_ID
    || entry?.evidenceId === REQUIRED_EVIDENCE_ID
    || entry?.factId === REQUIRED_EVIDENCE_ID);
}

function freshInterludeState() {
  return {
    version: AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_VERSION,
    sceneId: SCENE_ID,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
  };
}

function ensureInterludeState(flow) {
  if (!flow) return null;
  flow.workshopWaterInterlude ??= freshInterludeState();
  const state = flow.workshopWaterInterlude;
  state.version = AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_VERSION;
  state.sceneId = SCENE_ID;
  state.completedAtMinute ??= null;
  state.selectedActionId ??= null;
  state.closedActionIds = array(state.closedActionIds).map(String);
  return state;
}

function missionActive(runtime) {
  const status = runtime?.playerState?.missions?.[MISSION_ID]?.status;
  return ["active", "available", "in_progress"].includes(String(status ?? ""));
}

function atEngineerWorkshop(runtime) {
  const current = player(runtime);
  return current.location === DWARF_HUB && current.facilityId === ENGINEER_FACILITY;
}

function capitalMovement(context) {
  return array(context?.movementActions).find((action) =>
    action?.movementScope === "regional" && action?.destinationHub === CAPITAL_HUB) ?? null;
}

function workshopInterludeEligible(runtime) {
  const flow = flowFor(runtime);
  if (!flow || !missionActive(runtime) || !atEngineerWorkshop(runtime)) return false;
  const state = ensureInterludeState(flow);
  return state.completedAtMinute == null && hasAnchorPumpEvidence(runtime, flow);
}

function commonAction(choice, kind) {
  return {
    id: `MISSION_FLOW:T13:WORKSHOP_INTERLUDE:${choice.id}`,
    family: kind === "capital" ? "travel" : kind === "help" ? "talk" : "prepare",
    type: kind === "help" ? "conversation" : "plan",
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: kind === "help" ? "NPC037" : null,
    targetNpcName: kind === "help" ? "ミーナ" : null,
    dialogueTopic: kind === "help" ? "t13_workshop_pack_pump" : null,
    singleTurnConversation: kind === "help",
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: `workshop_interlude_${kind}`,
    authoredMissionWorkshopInterludeChoice: true,
    authoredMissionWorkshopInterludeSceneId: SCENE_ID,
    authoredMissionWorkshopInterludeChoiceId: choice.id,
    authoredMissionWorkshopInterludeSummary: choice.summary,
    authoredMissionWorkshopInterludeSpeech: choice.speech,
    authoredMissionWorkshopInterludeWorldFlag: choice.worldFlag,
    authoredMissionWorkshopInterludeHistoryType: choice.historyType,
  };
}

function workshopInterludeActions(runtime, context = {}) {
  if (!workshopInterludeEligible(runtime)) return null;
  const movement = capitalMovement(context);
  const drink = commonAction(CHOICES.drink, "drink");
  const help = commonAction(CHOICES.help, "help");
  const capital = movement
    ? {
      ...movement,
      ...commonAction(CHOICES.capital, "capital"),
      id: `MISSION_FLOW:T13:WORKSHOP_INTERLUDE:${CHOICES.capital.id}`,
      type: movement.type,
      family: movement.family ?? "travel",
      minutes: Math.max(1, Number(movement.minutes ?? 0)) + CHOICES.capital.minutesBonus,
      authoredMissionWorkshopInterludeTargetActionId: movement.id,
    }
    : {
      ...commonAction(CHOICES.capital, "capital"),
      minutes: 186,
      type: "regionalTravel",
      movementScope: "regional",
      destinationHub: CAPITAL_HUB,
      destinationFacilityId: "LOC_CAP_GATE",
      targetLocation: CAPITAL_HUB,
    };
  return [drink, help, capital];
}

function consumeWorkshopInterlude(runtime, action, result) {
  if (!action?.authoredMissionWorkshopInterludeChoice || result?.ok === false) return false;
  const flow = flowFor(runtime);
  if (!flow) return false;
  const state = ensureInterludeState(flow);
  if (state.completedAtMinute != null) return false;
  const actionIds = Object.values(CHOICES).map((choice) =>
    `MISSION_FLOW:T13:WORKSHOP_INTERLUDE:${choice.id}`);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = actionIds.filter((id) => id !== action.id);

  runtime.playerState ??= {};
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags.t13WorkshopInterludeCompleted = true;
  if (action.authoredMissionWorkshopInterludeWorldFlag) {
    runtime.playerState.worldFlags[action.authoredMissionWorkshopInterludeWorldFlag] = true;
  }
  runtime.playerState.history.push({
    type: action.authoredMissionWorkshopInterludeHistoryType,
    minute,
    missionId: MISSION_ID,
    flowId: FLOW_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    closedActionIds: [...state.closedActionIds],
    location: player(runtime).location ?? null,
    facilityId: player(runtime).facilityId ?? null,
  });

  result.summary = action.authoredMissionWorkshopInterludeSummary;
  result.sceneTransition = "工房での選択を終え、同じ三択へ戻らず次の行動へ進む";
  result.speeches = [action.authoredMissionWorkshopInterludeSpeech];
  return true;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === FLOW_ID) ensureInterludeState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === FLOW_ID) ensureInterludeState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const interlude = workshopInterludeActions(runtime, context);
  if (interlude) return interlude;
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (workshopInterludeEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "排水輪の試作が止まった",
      title: "ミーナが図面を畳む間、工房でどう過ごすか",
      detail: "水を飲んでも、作業を手伝っても、王都へ出てもよい。どれも同じ結果にはならない。",
      targetLocation: DWARF_HUB,
      targetFacilityId: ENGINEER_FACILITY,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consumeWorkshopInterlude(runtime, action, result) || changed;
}

export const AUTHORED_MISSION_T13_WORKSHOP_INTERLUDE_INTERNALS = Object.freeze({
  array,
  flowFor,
  player,
  evidenceIds,
  hasAnchorPumpEvidence,
  freshInterludeState,
  ensureInterludeState,
  missionActive,
  atEngineerWorkshop,
  capitalMovement,
  workshopInterludeEligible,
  commonAction,
  workshopInterludeActions,
  consumeWorkshopInterlude,
  CHOICES,
  SCENE_ID,
  REQUIRED_EVIDENCE_ID,
});
