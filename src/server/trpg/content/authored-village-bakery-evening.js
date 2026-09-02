import * as base from "./authored-register-butterfly.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-register-butterfly.js";

export const AUTHORED_VILLAGE_BAKERY_EVENING_VERSION = "authored-village-bakery-evening-v1";

// Common-world Day2 evening bridge for the farm village. This is deliberately
// not tied to Human Virtue state: any player who reaches the bakery with calm
// needs in the same world/time state sees the same three ordinary-life choices.
// Existing authored mission scenes always win; this layer only fills otherwise
// empty late-afternoon free time without synthetic WAIT/REST padding.
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_BAKERY";
const STATE_KEY = "villageBakeryEvening";
const SCENE_ID = "daily-bakery-evening";
const PAOLO_ID = "NPC059";
const COBY_ID = "NPC062";
const DAY = 2;
const OPEN_MINUTE = 15 * 60;
const TARGET_MINUTE = 22 * 60 + 15;
const NEEDS_CALM_THRESHOLD = 70;

const CHOICES = Object.freeze([
  Object.freeze({
    id: "mend_gear_by_oven",
    label: "竈脇で装備を手入れする",
    family: "prepare",
    npcId: PAOLO_ID,
    fatigue: -16,
    worldFlags: ["day2BakeryEvening:gearMaintained"],
    historyType: "DAY2_BAKERY_EVENING_GEAR_MAINTAINED",
    summary:
      "パン屋の仕事が落ち着くまで竈脇の隅を借り、留め具を締め直し、泥を落とし、傷んだ革を油で拭いた。合間にはパオロの片づけを少し手伝い、閉店後もしばらく道具の話をして過ごした。事件を追わない普通の夕方が、装備と身体の両方を整えていった。",
    speech: Object.freeze({
      actorId: PAOLO_ID,
      text: "そこなら灯りもあるし、油を垂らしても床が困らない。急ぐ用がない夜くらい、自分の道具を見てやりな。最後に戸板を押さえてくれれば十分だよ。",
      emotion: "閉店仕事の合間の気安さ",
    }),
  }),
  Object.freeze({
    id: "help_close_the_bakery",
    label: "パン屋の閉店準備を手伝う",
    family: "help",
    npcId: PAOLO_ID,
    fatigue: 6,
    worldFlags: ["day2BakeryEvening:closingHelped"],
    historyType: "DAY2_BAKERY_EVENING_CLOSING_HELPED",
    summary:
      "売れ残りを籠へ移し、粉袋を奥へ運び、戸板を一枚ずつはめた。賃仕事ではなく、忙しい店先に手を貸しただけだった。暗くなる頃には近所の人の出入りも減り、最後はパオロと明日の仕込みや村の暮らしについて話しながら片づけを終えた。",
    speech: Object.freeze({
      actorId: PAOLO_ID,
      text: "助かるよ。でもこれは雇い仕事じゃないからな。今度きちんと働くなら、仕事口は仕事口で頼んでくれ。今日は戸板と粉袋だけで十分だ。",
      emotion: "礼を言いつつ線引きは明確",
    }),
  }),
  Object.freeze({
    id: "walk_and_talk_with_coby",
    label: "コビーと村を歩いて話す",
    family: "talk",
    npcId: COBY_ID,
    fatigue: 2,
    worldFlags: ["day2BakeryEvening:cobyWalked"],
    historyType: "DAY2_BAKERY_EVENING_COBY_WALKED",
    summary:
      "店先に来たコビーと、パン屋の周りから夕暮れの村道を何度か行き来した。子どもの遊び場所、畑仕事の愚痴、夜になると灯りの消える家。大事件とは関係のない話を聞きながら、時々パン屋へ戻って休み、村が静かになるまで過ごした。",
    speech: Object.freeze({
      actorId: COBY_ID,
      text: "まだ寝ないなら歩こうよ。村って昼と夜でぜんぜん違うんだ。近道も教える。でも暗くなったらパン屋の灯りが見えるところまでな。",
      emotion: "遊びに誘うような親しさ",
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
  const candidates = [current?.needs?.[key], current?.[key], runtime?.playerState?.[key]];
  for (const candidate of candidates) {
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
    version: AUTHORED_VILLAGE_BAKERY_EVENING_VERSION,
    selectedActionId: null,
    closedActionIds: [],
    completedAtMinute: null,
  };
  const value = runtime.playerState[STATE_KEY];
  value.version = AUTHORED_VILLAGE_BAKERY_EVENING_VERSION;
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
    && clock.minuteOfDay < TARGET_MINUTE
    && needsAreCalm(runtime)
    && readState(runtime)?.completedAtMinute == null;
}

function baseIsSpeaking(runtime, context = {}) {
  const guidance = base.authoredMissionFlowGuidance(runtime, context);
  if (guidance) return true;
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  return Array.isArray(actions) && actions.length > 0;
}

function eligible(runtime, context = {}) {
  return ownEligible(runtime) && !baseIsSpeaking(runtime, context);
}

function remainingEveningMinutes(runtime) {
  const clock = currentClock(runtime);
  return Math.max(1, TARGET_MINUTE - clock.minuteOfDay);
}

function actionId(choice) {
  return `DAILY_LIFE:DAILY_BAKERY_EVENING:${choice.id}`;
}

function actionFor(runtime, choice) {
  const id = actionId(choice);
  return {
    id,
    actionId: id,
    family: choice.family,
    type: "plan",
    minutes: remainingEveningMinutes(runtime),
    label: choice.label,
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    targetNpcId: choice.npcId,
    dialogueTopic: `daily_bakery_evening_${choice.id}`,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredVillageBakeryEveningChoice: true,
    authoredVillageBakeryEveningData: choice,
  };
}

function actions(runtime, context = {}) {
  return eligible(runtime, context) ? CHOICES.map((choice) => actionFor(runtime, choice)) : null;
}

function applyNeed(target, key, delta) {
  if (!target || !delta) return;
  const current = Number(target[key]);
  if (!Number.isFinite(current)) return;
  target[key] = Math.max(0, Math.min(100, current + delta));
}

function consume(runtime, action, result) {
  if (!action?.authoredVillageBakeryEveningChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;

  const choice = action.authoredVillageBakeryEveningData;
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
  });

  result.summary = choice.summary;
  result.speeches = [choice.speech];
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const fromBase = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (Array.isArray(fromBase) && fromBase.length > 0) return fromBase;
  return actions(runtime, context) ?? fromBase;
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const fromBase = base.authoredMissionFlowGuidance(runtime, context);
  if (fromBase) return fromBase;
  if (!eligible(runtime, context)) return null;
  return {
    missionId: null,
    kicker: "午後の売り声が落ち着き、竈の火だけが店の奥で赤く残っている",
    title: "パン屋で夕暮れを過ごす",
    detail: "急ぐ事件がない夕方なら、装備を整えても、閉店を手伝っても、村の子と話しながら歩いてもよい。どれを選んでも、村が夜の静けさへ変わるまでを普通の暮らしとして過ごす。",
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    actionPanel: null,
  };
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_VILLAGE_BAKERY_EVENING_INTERNALS = Object.freeze({
  LOCATION,
  FACILITY_ID,
  STATE_KEY,
  SCENE_ID,
  PAOLO_ID,
  COBY_ID,
  DAY,
  OPEN_MINUTE,
  TARGET_MINUTE,
  NEEDS_CALM_THRESHOLD,
  CHOICES,
  currentClock,
  needValue,
  needsAreCalm,
  readState,
  ensureState,
  ownEligible,
  baseIsSpeaking,
  eligible,
  remainingEveningMinutes,
  actionId,
  actionFor,
  actions,
  consume,
});