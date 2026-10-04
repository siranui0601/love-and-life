import * as base from "./authored-mission-flow-t13-workshop-cargo-yard.js";
import { consumeMeal } from "../../../../tools/trpg-sim/lib/player-needs.mjs";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-mission-flow-t13-workshop-cargo-yard.js";

export const AUTHORED_DAY1_T01_SQUARE_AFTERCARE_VERSION =
  "authored-day1-t01-square-aftercare-v5";

const MISSION_ID = "MSN-T01";
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_SQUARE";
const AFTERCARE_SCENE_ID = "t01-square-aftercare";
const SUPPER_SCENE_ID = "t01-square-supper";
const HELP_ACTION_ID = "MISSION_FLOW:T01:SQUARE_AFTERCARE:help_mira";
const DAY1_AFTERCARE_OPEN_MINUTE = 12 * 60;
const DAY1_AFTERCARE_CLOSE_MINUTE = 24 * 60;

const AFTERCARE_CHOICES = Object.freeze([
  Object.freeze({
    id: "help_mira",
    label: "ミラを手伝う",
    family: "help",
    minutes: 26,
    summary: "フィンを寝かせる場所を整え、泥だらけの上着と水桶を運んだ。救助の熱が引いた後にも残る仕事を、一つずつ母親と片づけた。",
    speech: Object.freeze({
      actorId: "NPC002",
      text: "助けてもらったばかりなのに、こんなことまで……。フィンが目を覚ました時、あなたがまだ村にいると知ったら、きっと安心します。",
      emotion: "疲労の中の感謝",
    }),
    worldFlag: "t01Aftercare:miraHelped",
    historyType: "T01_AFTERCARE_MIRA_HELPED",
    nextSceneId: SUPPER_SCENE_ID,
  }),
  Object.freeze({
    id: "give_record",
    label: "村長に記録を渡す",
    family: "report",
    minutes: 18,
    summary: "狼の爪痕、崩れた斜面、拾った地図の位置を、ガロの村務帳へ時刻付きで書き残した。救出の記憶が、後から検証できる記録になった。",
    speech: Object.freeze({
      actorId: "NPC003",
      text: "感謝だけで済ませず、記録を残してくれるのか。次に子どもが消えた時、同じ遅れを繰り返さずに済む。村長として受け取ろう。",
      emotion: "責任を引き受ける真剣さ",
    }),
    worldFlag: "t01Aftercare:officialRecordFiled",
    historyType: "T01_AFTERCARE_OFFICIAL_RECORD_FILED",
    evidenceId: "T01-EVIDENCE-RESCUE-ROUTE-RECORD",
    evidenceSourceId: "LOC_FARM_SQUARE:VILLAGE_DUTY_LEDGER",
    nextSceneId: "t01-square-record-closed",
  }),
  Object.freeze({
    id: "play_children",
    label: "子どもと遊ぶ",
    family: "social",
    minutes: 22,
    summary: "広場に残っていた子どもたちと、石を狼に見立てた追いかけ遊びをした。笑い声の中で、見張り小屋へ続く別の細道を知っている子がいると分かった。",
    speech: Object.freeze({
      actorId: "NPC062",
      text: "フィンだけずるいよ、秘密の道を知ってたんだ。井戸の裏から行く方なら、ぼくらも途中まで行ったことある。……村長には内緒ね。",
      emotion: "興奮と少しの後ろめたさ",
    }),
    worldFlag: "t01Aftercare:childrenGameRumorSeeded",
    historyType: "T01_AFTERCARE_CHILDREN_GAME_RUMOR_SEEDED",
    nextSceneId: "t01-square-children-disperse",
  }),
]);

const SUPPER_CHOICES = Object.freeze([
  Object.freeze({
    id: "share_bread",
    label: "パンをちぎる",
    family: "life",
    minutes: 24,
    summary: "ミラが差し出した固いパンを三人で分けた。豪華ではない夕食だったが、フィンは一口ごとに顔色を取り戻した。",
    speech: Object.freeze({
      actorId: "NPC001",
      text: "狼から逃げてる時、もう母さんのパンを食べられないと思った。……半分でいいよ。あなたも食べて。",
      emotion: "安堵と遠慮",
    }),
    worldFlag: "t01Aftercare:breadShared",
    historyType: "T01_AFTERCARE_BREAD_SHARED",
  }),
  Object.freeze({
    id: "ask_finn",
    label: "フィンに道を聞く",
    family: "talk",
    minutes: 16,
    summary: "食卓でフィンから、見張り小屋へ向かった理由と、狼が森の奥ではなく村側へ回り込んだことを聞いた。",
    speech: Object.freeze({
      actorId: "NPC001",
      text: "地図の印を見たかっただけなんだ。でも狼は森から追ってきたんじゃない。先に村側の道へいて、僕を斜面へ追い込んだ。",
      emotion: "思い出す怖さと伝えたい意志",
    }),
    worldFlag: "t01Aftercare:finnRouteTestimony",
    historyType: "T01_AFTERCARE_FINN_ROUTE_TESTIMONY",
    evidenceId: "T01-EVIDENCE-FINN-ROUTE-TESTIMONY",
    evidenceSourceId: "NPC001:POST_RESCUE_SUPPER",
  }),
  Object.freeze({
    id: "rest_early",
    label: "早めに休む",
    family: "rest",
    minutes: 90,
    summary: "フィンの呼吸が落ち着いたのを見届け、広場の手伝いを切り上げた。身体を休めた分、夜の村で誰が動いたかは見ていない。",
    speech: Object.freeze({
      actorId: "NPC002",
      text: "今日はもう十分です。あなたまで倒れたら、フィンが気にします。明日の朝、顔を見せてください。",
      emotion: "気遣い",
    }),
    worldFlag: "t01Aftercare:restedAfterRescue",
    historyType: "T01_AFTERCARE_RESTED_AFTER_RESCUE",
  }),
]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function mission(runtime) {
  const missions = runtime?.playerState?.missions ?? runtime?.missions;
  if (Array.isArray(missions)) {
    return missions.find((entry) => entry?.id === MISSION_ID) ?? null;
  }
  if (missions && typeof missions === "object") {
    return missions[MISSION_ID] ?? null;
  }
  return null;
}

function isT01Completed(runtime) {
  const entry = mission(runtime);
  const completed = entry?.status === "completed" || entry?.status === "resolved";
  return completed && entry?.completedAt != null;
}

function hasFinnReturned(runtime) {
  return runtime?.playerState?.worldFlags?.t01FinnReturned === true;
}

function atVillageSquare(runtime) {
  const current = player(runtime);
  return current.location === LOCATION && current.facilityId === FACILITY_ID;
}

function withinDay1AftercareWindow(runtime) {
  const absoluteMinute = Number(runtime?.playerState?.absoluteMinute ?? -1);
  if (!Number.isFinite(absoluteMinute) || absoluteMinute < 0) return false;
  const clock = clockFromMinute(absoluteMinute);
  return clock.day === 1
    && clock.minuteOfDay >= DAY1_AFTERCARE_OPEN_MINUTE
    && clock.minuteOfDay < DAY1_AFTERCARE_CLOSE_MINUTE;
}

function readState(runtime) {
  const state = runtime?.playerState?.day1T01Aftercare;
  if (!state || typeof state !== "object") return null;
  return state;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day1T01Aftercare ??= {
    version: AUTHORED_DAY1_T01_SQUARE_AFTERCARE_VERSION,
    aftercareCompletedAtMinute: null,
    aftercareSelectedActionId: null,
    aftercareClosedActionIds: [],
    supperCompletedAtMinute: null,
    supperSelectedActionId: null,
    supperClosedActionIds: [],
    nextSceneId: null,
  };
  const state = runtime.playerState.day1T01Aftercare;
  state.version = AUTHORED_DAY1_T01_SQUARE_AFTERCARE_VERSION;
  state.aftercareClosedActionIds = array(state.aftercareClosedActionIds).map(String);
  state.supperClosedActionIds = array(state.supperClosedActionIds).map(String);
  return state;
}

function aftercareEligible(runtime) {
  if (!isT01Completed(runtime)
    || !hasFinnReturned(runtime)
    || !atVillageSquare(runtime)
    || !withinDay1AftercareWindow(runtime)) return false;
  return readState(runtime)?.aftercareCompletedAtMinute == null;
}

function supperEligible(runtime) {
  if (!isT01Completed(runtime)
    || !hasFinnReturned(runtime)
    || !atVillageSquare(runtime)
    || !withinDay1AftercareWindow(runtime)) return false;
  const state = readState(runtime);
  return state?.aftercareSelectedActionId === HELP_ACTION_ID
    && state?.supperCompletedAtMinute == null;
}

function actionFor(sceneId, choice) {
  const prefix = sceneId === AFTERCARE_SCENE_ID ? "SQUARE_AFTERCARE" : "SQUARE_SUPPER";
  return {
    id: `MISSION_FLOW:T01:${prefix}:${choice.id}`,
    family: choice.family,
    type: "plan",
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: choice.speech.actorId,
    dialogueTopic: `t01_${choice.id}`,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredDay1T01AftercareChoice: true,
    authoredDay1T01AftercareSceneId: sceneId,
    authoredDay1T01AftercareSummary: choice.summary,
    authoredDay1T01AftercareSpeech: choice.speech,
    authoredDay1T01AftercareWorldFlag: choice.worldFlag,
    authoredDay1T01AftercareHistoryType: choice.historyType,
    authoredDay1T01AftercareEvidenceId: choice.evidenceId ?? null,
    authoredDay1T01AftercareEvidenceSourceId: choice.evidenceSourceId ?? null,
    authoredDay1T01AftercareNextSceneId: choice.nextSceneId ?? null,
  };
}

function actions(runtime) {
  if (supperEligible(runtime)) return SUPPER_CHOICES.map((choice) => actionFor(SUPPER_SCENE_ID, choice));
  if (aftercareEligible(runtime)) return AFTERCARE_CHOICES.map((choice) => actionFor(AFTERCARE_SCENE_ID, choice));
  return null;
}

function consume(runtime, action, result) {
  if (!action?.authoredDay1T01AftercareChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const sceneId = action.authoredDay1T01AftercareSceneId;
  const choices = sceneId === AFTERCARE_SCENE_ID ? AFTERCARE_CHOICES : SUPPER_CHOICES;
  const ids = choices.map((choice) => actionFor(sceneId, choice).id);
  const selectedKey = sceneId === AFTERCARE_SCENE_ID
    ? "aftercareSelectedActionId" : "supperSelectedActionId";
  const completedKey = sceneId === AFTERCARE_SCENE_ID
    ? "aftercareCompletedAtMinute" : "supperCompletedAtMinute";
  const closedKey = sceneId === AFTERCARE_SCENE_ID
    ? "aftercareClosedActionIds" : "supperClosedActionIds";
  if (state[completedKey] != null) return false;

  state[completedKey] = minute;
  state[selectedKey] = action.id;
  state[closedKey] = ids.filter((id) => id !== action.id);
  state.nextSceneId = action.authoredDay1T01AftercareNextSceneId;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  runtime.playerState.worldFlags[action.authoredDay1T01AftercareWorldFlag] = true;
  if (action.id === "MISSION_FLOW:T01:SQUARE_SUPPER:share_bread") {
    const meal = consumeMeal(player(runtime), {
      minute,
      nutrition: 58,
      quality: "standard",
    });
    result.meal = {
      source: "Mira and Finn's shared bread",
      price: 0,
      quality: meal.quality,
      hungerReduced: meal.hungerReduced,
    };
  }
  if (action.authoredDay1T01AftercareEvidenceId) {
    runtime.playerState.evidence[action.authoredDay1T01AftercareEvidenceId] = {
      id: action.authoredDay1T01AftercareEvidenceId,
      sourceId: action.authoredDay1T01AftercareEvidenceSourceId,
      acquiredAtMinute: minute,
    };
  }
  runtime.playerState.history.push({
    type: action.authoredDay1T01AftercareHistoryType,
    minute,
    missionId: MISSION_ID,
    sceneId,
    actionId: action.id,
    closedActionIds: [...state[closedKey]],
    evidenceId: action.authoredDay1T01AftercareEvidenceId,
    evidenceSourceId: action.authoredDay1T01AftercareEvidenceSourceId,
    nextSceneId: state.nextSceneId,
    location: player(runtime).location ?? null,
    facilityId: player(runtime).facilityId ?? null,
  });

  result.summary = action.authoredDay1T01AftercareSummary;
  result.speeches = [action.authoredDay1T01AftercareSpeech];
  result.sceneTransition = state.nextSceneId;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime, context);
  return own ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (supperEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "水桶を置く頃、ミラが小さな食卓へパンを並べた",
      title: "救出後の夕食",
      detail: "食べても、フィンの話を聞いても、先に休んでもよい。救助の後に何を残すかで、村の記憶と翌日の動きが変わる。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  if (aftercareEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "フィンが家へ運ばれた後も、広場には泥と疲れが残っていた",
      title: "救出の後に何をするか",
      detail: "母子を手伝う、救出経路を記録する、子どもたちの輪へ戻る。どれも事件の勝敗とは別に、村の次の行動を変える。",
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

export const AUTHORED_DAY1_T01_SQUARE_AFTERCARE_INTERNALS = Object.freeze({
  array,
  player,
  mission,
  isT01Completed,
  hasFinnReturned,
  atVillageSquare,
  withinDay1AftercareWindow,
  readState,
  ensureState,
  aftercareEligible,
  supperEligible,
  actionFor,
  actions,
  consume,
  AFTERCARE_CHOICES,
  SUPPER_CHOICES,
  AFTERCARE_SCENE_ID,
  SUPPER_SCENE_ID,
  HELP_ACTION_ID,
  DAY1_AFTERCARE_OPEN_MINUTE,
  DAY1_AFTERCARE_CLOSE_MINUTE,
});