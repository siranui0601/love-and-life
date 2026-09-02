import * as base from "./authored-mission-flow-day1-t01-square-aftercare.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-mission-flow-day1-t01-square-aftercare.js";

export const AUTHORED_DAY1_T01_VILLAGE_NIGHT_VERSION =
  "authored-day1-t01-village-night-v2";

const MISSION_ID = "MSN-T01";
const LOCATION = "田園の村";
const SQUARE_ID = "LOC_FARM_SQUARE";
const INN_ID = "LOC_FARM_INN";
const EVENING_SCENE_ID = "t01-village-evening-after-supper";
const NIGHT_SCENE_ID = "t01-village-night-after-supper";
const MORNING_SCENE_ID = "t01-day2-merchant-arrival";
const SHARE_BREAD_ACTION_ID = "MISSION_FLOW:T01:SQUARE_SUPPER:share_bread";
const EVENING_REST_ACTION_ID = "MISSION_FLOW:T01:EVENING_FREE_TIME:maintain_and_rest";
const SLEEP_ACTION_ID = "MISSION_FLOW:T01:VILLAGE_NIGHT:sleep_at_miras";
const NIGHT_START_MINUTE_OF_DAY = 22 * 60 + 30;
const MORNING_OPEN_MINUTE_OF_DAY = 6 * 60;

const EVENING_CHOICES = Object.freeze([
  Object.freeze({
    id: "maintain_and_rest",
    label: "装備を手入れし、身体を休める",
    family: "rest",
    hungerDelta: 6,
    fatigueDelta: -12,
    summary: "救出で汚れた装備を拭き、留め具を確かめてから、広場の端で身体を休めた。何かを急いで始めるのではなく、今日の傷と疲れを整えながら夜を待った。",
    speech: Object.freeze({
      actorId: "NPC004",
      text: "今日はもう十分走ったでしょう。刃も身体も、壊れる前に手入れした方がいいよ。灯りが落ちる頃には寝床も整うから。",
      emotion: "実務的な気遣い",
    }),
    worldFlag: "t01Evening:gearMaintainedAndRested",
    historyType: "T01_EVENING_GEAR_MAINTAINED_AND_RESTED",
  }),
  Object.freeze({
    id: "help_clear_square",
    label: "広場の片づけを手伝う",
    family: "work",
    hungerDelta: 8,
    fatigueDelta: 6,
    summary: "救出騒ぎで散らかった桶や縄、濡れた布を片づけた。村人の出入りが落ち着くまで手を動かし、広場がいつもの夜へ戻っていくのを見届けた。",
    speech: Object.freeze({
      actorId: "NPC003",
      text: "そこまでしてもらう義理はないが、助かる。日が落ちたら切り上げよう。明日の仕事まで今日へ詰め込む必要はない。",
      emotion: "感謝と節度",
    }),
    worldFlag: "t01Evening:squareCleared",
    historyType: "T01_EVENING_SQUARE_CLEARED",
  }),
  Object.freeze({
    id: "sit_with_villagers",
    label: "村人と火のそばで話す",
    family: "social",
    hungerDelta: 5,
    fatigueDelta: 1,
    summary: "広場の小さな火を囲み、フィンが戻ったことと、村外れの道が危険だったことを必要な範囲だけ話した。噂を煽らず、聞かれたことへ答えるうちに夜が深まった。",
    speech: Object.freeze({
      actorId: "NPC004",
      text: "戻ってきた、それだけで今日は十分な話だよ。細かいことは明るくなってから確かめればいい。",
      emotion: "落ち着いた安堵",
    }),
    worldFlag: "t01Evening:villagersSatTogether",
    historyType: "T01_EVENING_VILLAGERS_SAT_TOGETHER",
  }),
]);

const NIGHT_CHOICES = Object.freeze([
  Object.freeze({
    id: "sleep_at_miras",
    label: "ミラの家で眠る",
    family: "rest",
    minutes: 480,
    hungerDelta: -12,
    fatigueDelta: -45,
    destinationFacilityId: INN_ID,
    summary: "ミラが用意した客用の寝床へ横になった。遠慮していたフィンも、隣室から一度だけ礼を言い、そのまま眠りに落ちた。夜の村を見回れない代わりに、身体は朝まで休まった。",
    speech: Object.freeze({
      actorId: "NPC002",
      text: "立派な部屋ではありませんが、今夜くらいはここで休んでください。朝になれば行商人も来ます。必要な物があるなら、村の人として紹介します。",
      emotion: "安堵を含んだ親切",
    }),
    worldFlag: "t01Night:miraShelterAccepted",
    historyType: "T01_NIGHT_MIRA_SHELTER_ACCEPTED",
    nextSceneId: MORNING_SCENE_ID,
  }),
  Object.freeze({
    id: "help_night_watch",
    label: "夜番を手伝う",
    family: "work",
    minutes: 120,
    hungerDelta: 4,
    fatigueDelta: 12,
    destinationFacilityId: SQUARE_ID,
    summary: "村外れの灯りが消えるまで見張りを手伝った。狼そのものは現れなかったが、北側の柵に新しい泥と獣毛が残り、群れが森側からではなく畑沿いへ回っていることが分かった。",
    speech: Object.freeze({
      actorId: "NPC003",
      text: "救出した夜まで働かせるつもりはなかったが……この毛は預かろう。朝になったら猟師にも見せる。今夜のことは村務帳にも残す。",
      emotion: "驚きと警戒",
    }),
    worldFlag: "t01Night:northFenceTraceRecorded",
    historyType: "T01_NIGHT_NORTH_FENCE_TRACE_RECORDED",
    evidenceId: "T03-EVIDENCE-NORTH-FENCE-WOLF-TRACE",
    evidenceSourceId: "LOC_FARM_NORTH_FENCE:NIGHT_WATCH",
    nextSceneId: "t01-day2-watch-relief",
  }),
  Object.freeze({
    id: "talk_by_well",
    label: "井戸端で話す",
    family: "social",
    minutes: 45,
    hungerDelta: 2,
    fatigueDelta: 4,
    destinationFacilityId: SQUARE_ID,
    summary: "水を汲みに来た村人と、フィンが戻ったことだけを話した。大げさな英雄譚にはしなかったが、救助に使った細道と井戸裏の抜け道が別物だという話が自然に集まった。",
    speech: Object.freeze({
      actorId: "NPC004",
      text: "井戸の裏は近道じゃないよ。古い水路へ出るだけ。フィンが持ってた地図の線とは、たぶん違う道だと思う。",
      emotion: "知っていることを確かめる口調",
    }),
    worldFlag: "t01Night:wellPathRumorSeparated",
    historyType: "T01_NIGHT_WELL_PATH_RUMOR_SEPARATED",
    nextSceneId: "t01-day2-well-morning",
  }),
]);

const MORNING_CHOICES = Object.freeze([
  Object.freeze({
    id: "help_unload",
    label: "荷ほどきを手伝う",
    family: "work",
    minutes: 36,
    hungerDelta: 3,
    fatigueDelta: 6,
    summary: "行商人の幌馬車から、布包みと薬箱を広場へ運んだ。重い木箱の底には交易都市の荷札があり、村へ届く商品の道筋を行商人から教わった。",
    speech: Object.freeze({
      actorId: "NPC042",
      text: "朝から助かったよ。村で恩人扱いされてる旅人なら、こっちも安心して荷を任せられる。欲しい物があれば、値札だけ見るより先に用途を言いな。",
      emotion: "商売人らしい親しみ",
    }),
    worldFlag: "day2Merchant:unloadingHelped",
    historyType: "DAY2_MERCHANT_UNLOADING_HELPED",
    merchantAccess: "trusted",
  }),
  Object.freeze({
    id: "browse_goods",
    label: "品物を見る",
    family: "shop",
    minutes: 18,
    hungerDelta: 1,
    fatigueDelta: 1,
    summary: "行商人が並べた保存食、包帯、松明、中古の雨具を順に見た。所持金が少なくても、買える品と後払いを断られる品が分かるよう、価格を一つずつ確認した。",
    speech: Object.freeze({
      actorId: "NPC042",
      text: "見るだけでも構わないよ。保存食、包帯、松明は少量から売れる。雨具は中古だが、森へ入るなら濡れるよりましだ。",
      emotion: "押し売りしない実務的な口調",
    }),
    worldFlag: "day2Merchant:stockInspected",
    historyType: "DAY2_MERCHANT_STOCK_INSPECTED",
    merchantAccess: "open",
  }),
  Object.freeze({
    id: "eat_morning_porridge",
    label: "朝粥を食べる",
    family: "life",
    minutes: 22,
    hungerDelta: -18,
    fatigueDelta: -2,
    summary: "行商人の火鉢を借り、村でもらった麦と干し野菜で朝粥を作った。荷の到着を眺めながら食べたため、買物を急がずとも今日の行き先を考える余裕ができた。",
    speech: Object.freeze({
      actorId: "NPC042",
      text: "腹が減ったまま買物をすると、要らない物まで欲しくなる。食べ終わったら声をかけな。馬に水をやってる間は店を開けておくよ。",
      emotion: "旅慣れた忠告",
    }),
    worldFlag: "day2Merchant:morningPorridgeEaten",
    historyType: "DAY2_MERCHANT_MORNING_PORRIDGE_EATEN",
    merchantAccess: "open",
  }),
]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function currentClock(runtime) {
  return clockFromMinute(Number(runtime?.playerState?.absoluteMinute ?? 0));
}

function minutesUntilNight(runtime) {
  const clock = currentClock(runtime);
  if (clock.day !== 1 || clock.minuteOfDay >= NIGHT_START_MINUTE_OF_DAY) return 0;
  return NIGHT_START_MINUTE_OF_DAY - clock.minuteOfDay;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day1T01VillageNight ??= {
    version: AUTHORED_DAY1_T01_VILLAGE_NIGHT_VERSION,
    eveningCompletedAtMinute: null,
    eveningSelectedActionId: null,
    eveningClosedActionIds: [],
    nightCompletedAtMinute: null,
    nightSelectedActionId: null,
    nightClosedActionIds: [],
    morningCompletedAtMinute: null,
    morningSelectedActionId: null,
    morningClosedActionIds: [],
    nextSceneId: null,
    hungerDeltaTotal: 0,
    fatigueDeltaTotal: 0,
    merchantAccess: null,
  };
  const state = runtime.playerState.day1T01VillageNight;
  state.version = AUTHORED_DAY1_T01_VILLAGE_NIGHT_VERSION;
  state.eveningCompletedAtMinute ??= null;
  state.eveningSelectedActionId ??= null;
  state.eveningClosedActionIds = array(state.eveningClosedActionIds).map(String);
  state.nightClosedActionIds = array(state.nightClosedActionIds).map(String);
  state.morningClosedActionIds = array(state.morningClosedActionIds).map(String);
  return state;
}

function hasHistory(runtime, type) {
  return array(runtime?.playerState?.history).some((entry) => entry?.type === type);
}

function inVillage(runtime) {
  return player(runtime).location === LOCATION;
}

function eveningEligible(runtime) {
  if (!inVillage(runtime) || !hasHistory(runtime, "T01_AFTERCARE_BREAD_SHARED")) return false;
  const clock = currentClock(runtime);
  if (clock.day !== 1 || clock.minuteOfDay >= NIGHT_START_MINUTE_OF_DAY) return false;
  return ensureState(runtime).eveningCompletedAtMinute == null;
}

function nightEligible(runtime) {
  if (!inVillage(runtime) || !hasHistory(runtime, "T01_AFTERCARE_BREAD_SHARED")) return false;
  const clock = currentClock(runtime);
  if (clock.day !== 1 || clock.minuteOfDay < NIGHT_START_MINUTE_OF_DAY) return false;
  return ensureState(runtime).nightCompletedAtMinute == null;
}

function morningEligible(runtime) {
  if (!inVillage(runtime)) return false;
  const state = ensureState(runtime);
  const clock = currentClock(runtime);
  return state.nightSelectedActionId === SLEEP_ACTION_ID
    && clock.day >= 2
    && clock.minuteOfDay >= MORNING_OPEN_MINUTE_OF_DAY
    && state.morningCompletedAtMinute == null;
}

function actionFor(sceneId, choice, runtime) {
  const prefix = sceneId === EVENING_SCENE_ID
    ? "EVENING_FREE_TIME"
    : sceneId === NIGHT_SCENE_ID ? "VILLAGE_NIGHT" : "DAY2_MERCHANT";
  const minutes = sceneId === EVENING_SCENE_ID ? minutesUntilNight(runtime) : choice.minutes;
  return {
    id: `MISSION_FLOW:T01:${prefix}:${choice.id}`,
    family: choice.family,
    type: "plan",
    minutes,
    label: choice.label,
    targetNpcId: choice.speech.actorId,
    dialogueTopic: `t01_${choice.id}`,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredDay1T01VillageNightChoice: true,
    authoredDay1T01VillageNightSceneId: sceneId,
    authoredDay1T01VillageNightSummary: choice.summary,
    authoredDay1T01VillageNightSpeech: choice.speech,
    authoredDay1T01VillageNightWorldFlag: choice.worldFlag,
    authoredDay1T01VillageNightHistoryType: choice.historyType,
    authoredDay1T01VillageNightEvidenceId: choice.evidenceId ?? null,
    authoredDay1T01VillageNightEvidenceSourceId: choice.evidenceSourceId ?? null,
    authoredDay1T01VillageNightNextSceneId: choice.nextSceneId ?? (sceneId === EVENING_SCENE_ID ? NIGHT_SCENE_ID : null),
    authoredDay1T01VillageNightHungerDelta: choice.hungerDelta ?? 0,
    authoredDay1T01VillageNightFatigueDelta: choice.fatigueDelta ?? 0,
    authoredDay1T01VillageNightDestinationFacilityId: choice.destinationFacilityId ?? null,
    authoredDay1T01VillageNightMerchantAccess: choice.merchantAccess ?? null,
  };
}

function actions(runtime) {
  if (morningEligible(runtime)) return MORNING_CHOICES.map((choice) => actionFor(MORNING_SCENE_ID, choice, runtime));
  if (eveningEligible(runtime)) return EVENING_CHOICES.map((choice) => actionFor(EVENING_SCENE_ID, choice, runtime));
  if (nightEligible(runtime)) return NIGHT_CHOICES.map((choice) => actionFor(NIGHT_SCENE_ID, choice, runtime));
  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function applyLivingDelta(runtime, action) {
  const current = player(runtime);
  const hungerBefore = Number(current.hunger ?? runtime.playerState.hunger ?? 0);
  const fatigueBefore = Number(current.fatigue ?? runtime.playerState.fatigue ?? 0);
  const hungerAfter = clamp(hungerBefore + action.authoredDay1T01VillageNightHungerDelta, 0, 100);
  const fatigueAfter = clamp(fatigueBefore + action.authoredDay1T01VillageNightFatigueDelta, 0, 100);
  current.hunger = hungerAfter;
  current.fatigue = fatigueAfter;
  runtime.playerState.hunger = hungerAfter;
  runtime.playerState.fatigue = fatigueAfter;
  if (action.authoredDay1T01VillageNightDestinationFacilityId) {
    current.facilityId = action.authoredDay1T01VillageNightDestinationFacilityId;
  }
  return { hungerBefore, hungerAfter, fatigueBefore, fatigueAfter };
}

function consume(runtime, action, result) {
  if (!action?.authoredDay1T01VillageNightChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const sceneId = action.authoredDay1T01VillageNightSceneId;
  const choices = sceneId === EVENING_SCENE_ID
    ? EVENING_CHOICES
    : sceneId === NIGHT_SCENE_ID ? NIGHT_CHOICES : MORNING_CHOICES;
  const ids = choices.map((choice) => actionFor(sceneId, choice, runtime).id);
  const phase = sceneId === EVENING_SCENE_ID ? "evening" : sceneId === NIGHT_SCENE_ID ? "night" : "morning";
  const selectedKey = `${phase}SelectedActionId`;
  const completedKey = `${phase}CompletedAtMinute`;
  const closedKey = `${phase}ClosedActionIds`;
  if (state[completedKey] != null) return false;

  const living = applyLivingDelta(runtime, action);
  state[completedKey] = minute;
  state[selectedKey] = action.id;
  state[closedKey] = ids.filter((id) => id !== action.id);
  state.nextSceneId = action.authoredDay1T01VillageNightNextSceneId;
  state.hungerDeltaTotal += living.hungerAfter - living.hungerBefore;
  state.fatigueDeltaTotal += living.fatigueAfter - living.fatigueBefore;
  if (action.authoredDay1T01VillageNightMerchantAccess) {
    state.merchantAccess = action.authoredDay1T01VillageNightMerchantAccess;
  }

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  runtime.playerState.worldFlags[action.authoredDay1T01VillageNightWorldFlag] = true;
  if (state.merchantAccess) {
    runtime.playerState.worldFlags["day2Merchant:available"] = true;
    runtime.playerState.worldFlags[`day2Merchant:access:${state.merchantAccess}`] = true;
  }
  if (action.authoredDay1T01VillageNightEvidenceId) {
    runtime.playerState.evidence[action.authoredDay1T01VillageNightEvidenceId] = {
      id: action.authoredDay1T01VillageNightEvidenceId,
      sourceId: action.authoredDay1T01VillageNightEvidenceSourceId,
      acquiredAtMinute: minute,
    };
  }
  runtime.playerState.history.push({
    type: action.authoredDay1T01VillageNightHistoryType,
    minute,
    missionId: MISSION_ID,
    sceneId,
    actionId: action.id,
    closedActionIds: [...state[closedKey]],
    nextSceneId: state.nextSceneId,
    hungerBefore: living.hungerBefore,
    hungerAfter: living.hungerAfter,
    fatigueBefore: living.fatigueBefore,
    fatigueAfter: living.fatigueAfter,
    evidenceId: action.authoredDay1T01VillageNightEvidenceId,
    evidenceSourceId: action.authoredDay1T01VillageNightEvidenceSourceId,
    merchantAccess: state.merchantAccess,
    location: player(runtime).location ?? null,
    facilityId: player(runtime).facilityId ?? null,
  });

  result.summary = action.authoredDay1T01VillageNightSummary;
  result.speeches = [action.authoredDay1T01VillageNightSpeech];
  result.sceneTransition = state.nextSceneId;
  result.livingState = living;
  result.merchantAccess = state.merchantAccess;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime, context);
  return own ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (morningEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "朝靄の向こうから鈴の音と車輪の軋みが近づいてきた",
      title: "Day2の行商人",
      detail: "昨夜の約束どおり行商人が村へ着いた。荷を手伝っても、商品を見ても、先に朝食を取ってもよい。",
      targetLocation: LOCATION,
      targetFacilityId: INN_ID,
      actionPanel: null,
    };
  }
  if (eveningEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "救出騒ぎが落ち着き、村には夕方の時間が戻ってきた",
      title: "夜までどう過ごすか",
      detail: "装備と身体を整える、広場を片づける、村人と話す。事件の続きを急がず、夜までの時間を普通の暮らしとして過ごせる。",
      targetLocation: LOCATION,
      targetFacilityId: SQUARE_ID,
      actionPanel: null,
    };
  }
  if (nightEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "夜も深まり、広場の灯りが一つずつ消えていった",
      title: "救出した夜の過ごし方",
      detail: "眠る、夜番をする、井戸端へ出る。事件の後の普通の夜にも、翌日の身体と村の動きを変える選択がある。",
      targetLocation: LOCATION,
      targetFacilityId: SQUARE_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_DAY1_T01_VILLAGE_NIGHT_INTERNALS = Object.freeze({
  array,
  player,
  currentClock,
  minutesUntilNight,
  ensureState,
  hasHistory,
  inVillage,
  eveningEligible,
  nightEligible,
  morningEligible,
  actionFor,
  actions,
  clamp,
  applyLivingDelta,
  consume,
  EVENING_CHOICES,
  NIGHT_CHOICES,
  MORNING_CHOICES,
  EVENING_SCENE_ID,
  NIGHT_SCENE_ID,
  MORNING_SCENE_ID,
  SHARE_BREAD_ACTION_ID,
  EVENING_REST_ACTION_ID,
  SLEEP_ACTION_ID,
  NIGHT_START_MINUTE_OF_DAY,
  MORNING_OPEN_MINUTE_OF_DAY,
});