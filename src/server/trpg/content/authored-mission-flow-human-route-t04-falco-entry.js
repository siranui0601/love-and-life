import * as previous from "./authored-mission-flow-human-route-causality-gate.js";
export * from "./authored-mission-flow-human-route-causality-gate.js";

export const AUTHORED_HUMAN_ROUTE_T04_FALCO_ENTRY_VERSION =
  "authored-human-route-t04-falco-entry-v1";

const FLOW_ID = "pilgrim-transfer-disappearance";
const MISSION_ID = "MSN-T04";
const STATE_KEY = "humanT04PilgrimRelay";
const FALCO_ID = "NPC053";
const ADMIN_FACILITY_ID = "LOC_TEMPLE_ADMIN";

const CHOICES = Object.freeze([
  Object.freeze({
    id: "disappearance_pattern",
    label: "列順を聞く",
    family: "observation",
    dialogueTopic: "mission_flow_t04_disappearance_pattern",
    playerUtterance: "消えた人たちは、最後にどこで確認されましたか。歩いていた順番も教えてください。",
    requiredDisclosure: "失踪者は全員、白石回廊の同じ曲がり角で列から消え、先頭と最後尾の者は異変に気づかなかった",
    factId: "T04-FACT-SAME-CORRIDOR-GAP",
    unlockedLeadIds: Object.freeze(["pilgrim_route", "corridor_resonance"]),
    minutes: 12,
    speech: "全員、白石回廊の第三曲がりだ。列の中央にいた者だけが消え、前後の者は振り返るまで気づかなかった。",
  }),
  Object.freeze({
    id: "concealed_reports",
    label: "隠蔽を問いただす",
    family: "diplomacy",
    dialogueTopic: "mission_flow_t04_concealed_reports",
    playerUtterance: "同じ場所で何人も消えたのに、なぜ回廊を閉じず、王都にも公表しなかったんですか。",
    requiredDisclosure: "ファルコは辺境の村の巡礼収入が絶えることを恐れ、失踪報告を管理棟の内部記録へ留めていた",
    factId: "T04-FACT-REPORTS-CONCEALED",
    unlockedLeadIds: Object.freeze(["concealed_records", "family_diary"]),
    minutes: 14,
    speech: "神殿を閉じれば辺境の村の宿も店も倒れる。それを恐れて内部記録へ留め、失踪者を増やした。",
  }),
  Object.freeze({
    id: "day1_anomaly",
    label: "Day1の異常を聞く",
    family: "observation",
    dialogueTopic: "mission_flow_t04_day1_anomaly",
    playerUtterance: "王都の召喚が失敗した日から、回廊や地下装置に変化はありませんでしたか。",
    requiredDisclosure: "Day1の夜から白石回廊の古代文字が淡く光り、床下の機械音と短い冷気が記録され始めた",
    factId: "T04-FACT-ACTIVE-SINCE-DAY1",
    unlockedLeadIds: Object.freeze(["corridor_resonance", "concealed_records"]),
    minutes: 13,
    speech: "Day1の夜から回廊の文字が光り、床下で歯車のような音がした。召喚との関係を認めたくなかった。",
  }),
]);

const array = (value) => Array.isArray(value) ? value : [];
const minute = (runtime) => Number(runtime?.playerState?.absoluteMinute ?? 0);

function relayState(runtime) {
  return runtime?.playerState?.[STATE_KEY] ?? null;
}

function falcoPresent(runtime, context = {}) {
  const state = runtime?.livingWorld?.npcStates?.[FALCO_ID];
  if (["dead", "missing", "captured"].includes(String(state?.lifeStatus ?? state?.presence ?? ""))) {
    return false;
  }
  return array(context.presentNpcs).some((npc) => npc?.id === FALCO_ID);
}

function eligible(runtime, context = {}) {
  const state = relayState(runtime);
  const player = runtime?.playerState?.player;
  return Number(state?.stage ?? 0) === 2
    && player?.location === "古代神殿"
    && player?.facilityId === ADMIN_FACILITY_ID
    && falcoPresent(runtime, context);
}

function actionId(choiceId) {
  return `MISSION_FLOW:T04:HUMAN_SPINE:falco:${choiceId}`;
}

function canonicalAction(choice) {
  return {
    id: `MISSION_FLOW:${FLOW_ID}:OPENING:${choice.id}`,
    actionId: `MISSION_FLOW:${FLOW_ID}:OPENING:${choice.id}`,
    family: "talk",
    type: "conversation",
    missionId: MISSION_ID,
    stepId: "hear",
    targetNpcId: FALCO_ID,
    targetNpcName: "ファルコ",
    dialogueTopic: choice.dialogueTopic,
    label: choice.label,
    playerUtterance: choice.playerUtterance,
    requiredDisclosure: choice.requiredDisclosure,
    minutes: choice.minutes,
    deferMissionConversationCompletion: true,
    singleTurnConversation: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: "opening",
    authoredMissionFlowChoiceId: choice.id,
    authoredMissionFlowFactId: choice.factId,
    authoredMissionFlowUnlockedLeadIds: [...choice.unlockedLeadIds],
  };
}

function proxyActions(runtime, context = {}) {
  if (!eligible(runtime, context)) return null;
  return CHOICES.map((choice) => ({
    ...canonicalAction(choice),
    id: actionId(choice.id),
    actionId: actionId(choice.id),
    family: choice.family,
    label: choice.label,
    authoredHumanT04FalcoEntryChoice: true,
    authoredHumanT04FalcoEntryChoiceId: choice.id,
  }));
}

function applyProxy(runtime, action, result) {
  if (result?.ok === false || !action?.authoredHumanT04FalcoEntryChoice) return false;
  const choice = CHOICES.find((entry) => entry.id === action.authoredHumanT04FalcoEntryChoiceId);
  const state = relayState(runtime);
  if (!choice || Number(state?.stage ?? 0) !== 2) return false;

  if (!previous.applyAuthoredMissionFlowAction(runtime, canonicalAction(choice), result)) return false;

  const selectedId = actionId(choice.id);
  state.stage = 3;
  state.completedAtMinute = minute(runtime);
  state.selected = array(state.selected).map(String);
  if (!state.selected.includes(selectedId)) state.selected.push(selectedId);
  state.closed = state.closed && typeof state.closed === "object" ? state.closed : {};
  state.closed.falco = CHOICES.map((entry) => actionId(entry.id))
    .filter((id) => id !== selectedId);

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags["t04Relay:falcoHearingCompleted"] = true;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "T04_RELAY_FALCO_HEARING",
    minute: minute(runtime),
    missionId: MISSION_ID,
    troubleId: "T04",
    sceneId: "t04-falco-first-hearing",
    actionId: selectedId,
    canonicalActionId: canonicalAction(choice).id,
    openingChoiceId: choice.id,
    closedActionIds: [...state.closed.falco],
  });

  result.speeches = [{
    actorId: FALCO_ID,
    text: choice.speech,
    emotion: "保身を捨てて記録を開く",
  }];
  result.sceneTransition = `t04-investigation-${choice.id}`;
  result.closedActionIds = [...state.closed.falco];
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return proxyActions(runtime, context)
    ?? previous.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  const state = relayState(runtime);
  const player = runtime?.playerState?.player;
  if (Number(state?.stage ?? 0) === 2
    && player?.location === "古代神殿"
    && player?.facilityId === ADMIN_FACILITY_ID) {
    return {
      missionId: MISSION_ID,
      kicker: "管理棟の内部記録",
      title: "ファルコが隠した三つの事実",
      detail: "列順、隠蔽、Day1からの異常。短い問いから正式なT04調査へ入る。",
      targetLocation: "古代神殿",
      targetFacilityId: ADMIN_FACILITY_ID,
      actionPanel: null,
    };
  }
  return previous.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  return applyProxy(runtime, action, result)
    || previous.applyAuthoredMissionFlowAction(runtime, action, result);
}

export const AUTHORED_HUMAN_ROUTE_T04_FALCO_ENTRY_INTERNALS = Object.freeze({
  FLOW_ID,
  MISSION_ID,
  STATE_KEY,
  FALCO_ID,
  ADMIN_FACILITY_ID,
  CHOICES,
  relayState,
  falcoPresent,
  eligible,
  actionId,
  canonicalAction,
  proxyActions,
  applyProxy,
});