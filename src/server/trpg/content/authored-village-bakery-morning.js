import * as base from "./authored-village-bakery-evening.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-village-bakery-evening.js";

export const AUTHORED_VILLAGE_BAKERY_MORNING_VERSION = "authored-village-bakery-morning-v1";

// Common-world morning activity for the farm bakery. The old route ledger had
// a two-hour prose-only life block before the first paid Day3 shift. A prose
// outcome cannot advance production time, so the strict replay arrived at the
// granary before its canonical work window opened. This scene turns that blank
// time into an ordinary visible activity available to every player in the same
// Day3 bakery state. It pays no wage and grants no route score.
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_BAKERY";
const STATE_KEY = "villageBakeryMorning";
const SCENE_ID = "daily-bakery-morning";
const PAOLO_ID = "NPC059";
const COBY_ID = "NPC062";
const DAY = 3;
const OPEN_MINUTE = 7 * 60;
const CLOSE_MINUTE = 10 * 60;
const DURATION_MINUTES = 120;
const NEEDS_CALM_THRESHOLD = 70;

const CHOICES = Object.freeze([
  Object.freeze({
    id: "sort_flour_sacks",
    label: "粉袋と麻袋を数えて仕分ける",
    family: "help",
    npcId: PAOLO_ID,
    fatigue: 7,
    worldFlags: ["day3BakeryMorning:sacksSorted"],
    historyType: "DAY3_BAKERY_MORNING_SACKS_SORTED",
    summary: "朝の仕込みが一段落するまで、粉袋と空の麻袋を数え、傷んだ袋を脇へ分けた。雇い仕事ではなく、店の在庫を一緒に整えただけなので賃金は受け取っていない。二時間ほど手を動かすうち、村の朝が普段の仕事時間へ移っていった。",
    speech: Object.freeze({
      actorId: PAOLO_ID,
      text: "数だけ合えばいい。破れた袋は別にしてくれ。これは店の手伝いだから賃金は出せないけど、仕事口へ行く前の朝仕事にはなるだろ。",
      emotion: "朝の仕込みを続けながら",
    }),
  }),
  Object.freeze({
    id: "prepare_delivery_baskets",
    label: "配達籠を店ごとに分ける",
    family: "help",
    npcId: PAOLO_ID,
    fatigue: 6,
    worldFlags: ["day3BakeryMorning:deliveryBasketsPrepared"],
    historyType: "DAY3_BAKERY_MORNING_DELIVERY_BASKETS_PREPARED",
    summary: "焼き上がったパンを配達先ごとの籠へ分け、札と個数を照合した。途中で追加注文が入り何度か数え直したが、昼前の店先が落ち着く頃には籠が順番通りに並んだ。賃金の発生しない近所の手伝いとして終えた。",
    speech: Object.freeze({
      actorId: PAOLO_ID,
      text: "宿、村長宅、畑の順で札を置いてくれ。急ぐほど間違えるから、朝のうちは数を合わせる方が大事だ。",
      emotion: "忙しいが機嫌よく",
    }),
  }),
  Object.freeze({
    id: "help_coby_with_errands",
    label: "コビーの朝の使いを手伝う",
    family: "talk",
    npcId: COBY_ID,
    fatigue: 5,
    worldFlags: ["day3BakeryMorning:cobyErrandsHelped"],
    historyType: "DAY3_BAKERY_MORNING_COBY_ERRANDS_HELPED",
    summary: "コビーが頼まれた小さな使いを一緒に整理し、パン屋へ戻るたびに次の用事を確認した。遠出や事件の探索はせず、村の人が朝に何を必要としているかを聞きながら、普段の暮らしの中で二時間を過ごした。",
    speech: Object.freeze({
      actorId: COBY_ID,
      text: "先に札を見よう。ぼく、急ぐと一個忘れるんだ。終わったらパン屋に戻れば、次の分を聞けるよ。",
      emotion: "少し得意げに",
    }),
  }),
]);

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function absoluteMinute(runtime) {
  return Number(runtime?.playerState?.absoluteMinute ?? 0);
}

function currentClock(runtime) {
  return clockFromMinute(absoluteMinute(runtime));
}

function needValue(runtime, key) {
  const current = player(runtime);
  for (const candidate of [current?.needs?.[key], current?.[key], runtime?.playerState?.[key]]) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function needsAreCalm(runtime) {
  return needValue(runtime, "hunger") < NEEDS_CALM_THRESHOLD
    && needValue(runtime, "fatigue") < NEEDS_CALM_THRESHOLD;
}

function readState(runtime) {
  const value = runtime?.playerState?.[STATE_KEY];
  return value && typeof value === "object" ? value : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_VILLAGE_BAKERY_MORNING_VERSION,
    selectedActionId: null,
    closedActionIds: [],
    completedAtMinute: null,
  };
  const value = runtime.playerState[STATE_KEY];
  value.version = AUTHORED_VILLAGE_BAKERY_MORNING_VERSION;
  value.closedActionIds = arr(value.closedActionIds).map(String);
  return value;
}

function ownEligible(runtime) {
  const current = player(runtime);
  const clock = currentClock(runtime);
  return current.location === LOCATION
    && current.facilityId === FACILITY_ID
    && clock.day === DAY
    && clock.minuteOfDay >= OPEN_MINUTE
    && clock.minuteOfDay + DURATION_MINUTES <= CLOSE_MINUTE
    && needsAreCalm(runtime)
    && readState(runtime)?.completedAtMinute == null;
}

function onlyCanonicalWorldLife(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => action?.canonicalWorldLifeChoice === true);
}

function baseIsSpeaking(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (onlyCanonicalWorldLife(actions)) return false;
  if (Array.isArray(actions) && actions.length > 0) return true;
  return base.authoredMissionFlowGuidance(runtime, context) != null;
}

function eligible(runtime, context = {}) {
  return ownEligible(runtime) && !baseIsSpeaking(runtime, context);
}

function actionId(choice) {
  return `DAILY_LIFE:DAILY_BAKERY_MORNING:${choice.id}`;
}

function actionFor(choice) {
  const id = actionId(choice);
  return {
    id,
    actionId: id,
    family: choice.family,
    type: "plan",
    minutes: DURATION_MINUTES,
    label: choice.label,
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    targetNpcId: choice.npcId,
    dialogueTopic: `daily_bakery_morning_${choice.id}`,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredVillageBakeryMorningChoice: true,
    authoredVillageBakeryMorningData: choice,
  };
}

function actions(runtime, context = {}) {
  return eligible(runtime, context) ? CHOICES.map(actionFor) : null;
}

function applyNeed(target, key, delta) {
  if (!target || !delta) return;
  const current = Number(target[key]);
  if (!Number.isFinite(current)) return;
  target[key] = Math.max(0, Math.min(100, current + delta));
}

function consume(runtime, action, result) {
  if (!action?.authoredVillageBakeryMorningChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;
  const choice = action.authoredVillageBakeryMorningData;
  const minute = absoluteMinute(runtime);
  const allIds = CHOICES.map(actionId);
  state.selectedActionId = action.id;
  state.closedActionIds = allIds.filter((id) => id !== action.id);
  state.completedAtMinute = minute;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  for (const flag of arr(choice.worldFlags)) runtime.playerState.worldFlags[flag] = true;
  for (const target of [runtime.playerState, player(runtime)]) {
    applyNeed(target, "fatigue", Number(choice.fatigue ?? 0));
  }
  runtime.playerState.history.push({
    type: choice.historyType,
    minute,
    sceneId: SCENE_ID,
    actionId: action.id,
    closedActionIds: [...state.closedActionIds],
    location: LOCATION,
    facilityId: FACILITY_ID,
    targetNpcId: choice.npcId,
    wage: 0,
  });
  result.summary = choice.summary;
  result.speeches = [choice.speech];
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime, context);
  return own?.length ? own : base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  if (eligible(runtime, context)) {
    return {
      missionId: null,
      kicker: "朝の焼き上がりが落ち着き、店の奥には粉袋と配達籠が残っている",
      title: "仕事口が開くまで朝の店を手伝う",
      detail: "雇い仕事ではない。粉袋の整理、配達籠の仕分け、子どもの使いの手伝いから一つを選び、村の朝が通常の勤務時間へ移るまで過ごせる。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_VILLAGE_BAKERY_MORNING_INTERNALS = Object.freeze({
  LOCATION,
  FACILITY_ID,
  STATE_KEY,
  SCENE_ID,
  DAY,
  OPEN_MINUTE,
  CLOSE_MINUTE,
  DURATION_MINUTES,
  NEEDS_CALM_THRESHOLD,
  CHOICES,
  currentClock,
  needValue,
  needsAreCalm,
  readState,
  ensureState,
  ownEligible,
  onlyCanonicalWorldLife,
  baseIsSpeaking,
  eligible,
  actionId,
  actionFor,
  actions,
  consume,
});
