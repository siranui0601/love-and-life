import * as base from "./authored-mission-flow-day2-day8-village-watch.js";
import * as preHowlBase from "./authored-mission-flow-day2-t01-village-warning-result.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-mission-flow-day2-day8-village-watch.js";

export const AUTHORED_DAY8_T03_NIGHT_VIGIL_VERSION = "authored-day8-t03-night-vigil-v5";

const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_NORTH_FENCE";
const JILL_ID = "NPC060";
const HOWL_OPEN_MINUTE = 22 * 60;

// The production clock still advances for the full duration of every choice, so
// NPCs, trouble timelines, weather and ordinary hunger/fatigue continue moving.
// A/B explicitly include seated relief periods inside that same long action;
// model those breaks as recovery after the clock charge instead of splitting the
// night into filler REST choices or pretending the player stood for six hours.
const CHOICES = Object.freeze([
  Object.freeze({
    id: "keep_written_watch_until_dawn",
    label: "記録係として夜明けまで残り、交代の合間は腰を下ろす",
    minutes: 390,
    fatigueRecovery: 30,
    worldFlag: "day8WolfWatch:playerStayedUntilDawn",
    goal: "carry-written-watch-log-to-dawn-relief",
    summary: "遠吠えの時刻、柵の傷、交代者の名を一冊へつなげた。巡回そのものは交代班へ任せ、交代が戻るたびに座って身体を休めながら記録を続けたため、夜明けには強い眠気こそ残ったが倒れず引き継げた。",
    speech: "記録はお前がつないでくれ。巡回はこっちで回す。立ち続けるな、交代が戻るまでは座って書け。",
  }),
  Object.freeze({
    id: "rotate_short_patrols",
    label: "記録ごと短い巡回へ分け、村人へ回す",
    minutes: 360,
    fatigueRecovery: 32,
    worldFlag: "day8WolfWatch:rotatingPatrolsUsed",
    goal: "rotate-night-watch-among-villagers",
    summary: "北柵、馬小屋、穀倉の巡回と記録を短く区切り、同じ者が夜通し責任を抱えない当番へ組み替えた。自分も交代の一人として休憩を挟みながら夜をつないだ。",
    speech: "一人が倒れる見張りは長続きしない。木札と帳面を一緒に渡せ。次が来るまでは座っていろ。",
  }),
  Object.freeze({
    id: "hand_watch_to_jill",
    label: "記録をジルへ渡して下がる",
    minutes: 60,
    fatigueRecovery: 0,
    worldFlag: "day8WolfWatch:jillTookDawnWatch",
    goal: "take-over-dawn-watch",
    summary: "遠吠えの記録をジルへ渡し、夜明け前の見張りは村の交代班へ任せた。",
    speech: "ここからは村の番だ。助けることと、一人で抱えることを同じにするな。",
  }),
]);

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function state(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day8T03NightVigil ??= {
    version: AUTHORED_DAY8_T03_NIGHT_VIGIL_VERSION,
    selectedActionId: null,
    closedActionIds: [],
    completedAtMinute: null,
  };
  return runtime.playerState.day8T03NightVigil;
}

function clock(runtime) {
  return clockFromMinute(Number(runtime?.playerState?.absoluteMinute ?? 0));
}

function earlyHowlPanel(runtime, actions) {
  const current = clock(runtime);
  return current.day === 8
    && current.minuteOfDay < HOWL_OPEN_MINUTE
    && Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => action?.authoredDay2Day8VillageWatchScene === "howl");
}

function eligible(runtime) {
  const current = player(runtime);
  return runtime?.playerState?.day2Day8VillageWatch?.howlCompletedAtMinute != null
    && state(runtime).completedAtMinute == null
    && current.location === LOCATION
    && current.facilityId === FACILITY_ID;
}

function actionId(choiceId) {
  return `MISSION_FLOW:T03:DAY8_NIGHT_VIGIL:${choiceId}`;
}

function actionFor(choice) {
  const id = actionId(choice.id);
  return {
    id,
    actionId: id,
    choiceId: id,
    type: "conversation",
    family: "night-vigil",
    minutes: choice.minutes,
    label: choice.label,
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    targetNpcId: JILL_ID,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredDay8T03NightVigilChoice: choice.id,
  };
}

function actions(runtime) {
  return eligible(runtime) ? CHOICES.map(actionFor) : null;
}

function applyIntraActionRecovery(runtime, choice) {
  const current = player(runtime);
  current.needs ??= {};
  const before = {
    hunger: Number(current.needs.hunger ?? current.hunger ?? 0),
    fatigue: Number(current.needs.fatigue ?? current.fatigue ?? 0),
  };
  const recovery = Math.max(0, Number(choice.fatigueRecovery ?? 0));
  const after = {
    hunger: before.hunger,
    fatigue: Math.max(0, Math.min(100, before.fatigue - recovery)),
  };
  current.needs.hunger = after.hunger;
  current.needs.fatigue = after.fatigue;
  current.hunger = after.hunger;
  current.fatigue = after.fatigue;
  runtime.playerState.hunger = after.hunger;
  runtime.playerState.fatigue = after.fatigue;
  return { before, after, fatigueRecovery: recovery };
}

function consume(runtime, action, result) {
  if (result?.ok === false || !action?.authoredDay8T03NightVigilChoice || !eligible(runtime)) return false;
  const choice = CHOICES.find((entry) => entry.id === action.authoredDay8T03NightVigilChoice);
  if (!choice || action.id !== actionId(choice.id)) return false;
  const current = state(runtime);
  const closed = CHOICES.map((entry) => actionId(entry.id)).filter((id) => id !== action.id);
  current.selectedActionId = action.id;
  current.closedActionIds = closed;
  current.completedAtMinute = Number(runtime.playerState.absoluteMinute ?? 0);
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags[choice.worldFlag] = true;
  runtime.playerState.goapRequests ??= {};
  runtime.playerState.goapRequests["GOAP-DAY8-T03-DAWN-RELIEF"] = {
    id: "GOAP-DAY8-T03-DAWN-RELIEF",
    actorNpcId: JILL_ID,
    goal: choice.goal,
    destination: FACILITY_ID,
    status: "active",
    createdAtMinute: current.completedAtMinute,
    sourceActionId: action.id,
  };
  runtime.playerState.history ??= [];
  const livingState = applyIntraActionRecovery(runtime, choice);
  runtime.playerState.history.push({
    type: "DAY8_T03_NIGHT_VIGIL_COMPLETED",
    minute: current.completedAtMinute,
    actionId: action.id,
    closedActionIds: closed,
    targetNpcId: JILL_ID,
    goapRequestId: "GOAP-DAY8-T03-DAWN-RELIEF",
    fatigueRecovery: livingState.fatigueRecovery,
    location: LOCATION,
    facilityId: FACILITY_ID,
  });
  result.summary = choice.summary;
  result.speeches = [{ actorId: JILL_ID, text: choice.speech, emotion: "眠気を押さえた実務口調" }];
  result.closedActionIds = closed;
  result.livingState = livingState;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime);
  if (own?.length) return own;
  const inherited = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (earlyHowlPanel(runtime, inherited)) {
    return preHowlBase.authoredMissionFlowExclusiveActions(runtime, context);
  }
  return inherited;
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  if (eligible(runtime)) {
    return {
      kicker: "遠吠えの向きは分かったが、夜明けまでの見張り方はまだ選べる",
      title: "北柵の夜を誰が引き受けるか",
      detail: "記録係として残る、記録ごと短い巡回へ分ける、ジルへ渡す。時間、身体負荷、残る記録が変わる。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
    };
  }
  const inherited = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (earlyHowlPanel(runtime, inherited)) {
    return preHowlBase.authoredMissionFlowGuidance(runtime, context);
  }
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  if (consume(runtime, action, result)) return true;
  return base.applyAuthoredMissionFlowAction(runtime, action, result);
}

export const AUTHORED_DAY8_T03_NIGHT_VIGIL_INTERNALS = Object.freeze({
  CHOICES,
  HOWL_OPEN_MINUTE,
  state,
  clock,
  earlyHowlPanel,
  eligible,
  actionId,
  actionFor,
  actions,
  applyIntraActionRecovery,
  consume,
});