import * as base from "./authored-mission-flow-day1-t01-village-night.js";
import { publicPlayerNeeds } from "../../../../tools/trpg-sim/lib/player-needs.mjs";

export * from "./authored-mission-flow-day1-t01-village-night.js";

export const AUTHORED_DAY1_T01_VILLAGE_NIGHT_CANONICAL_VERSION =
  "authored-day1-t01-village-night-canonical-v4";

const MERCHANT_NPC_ID = "NPC008";
const MERCHANT_FACILITY_ID = "LOC_FARM_BAKERY";
const MORNING_SCENE_ID = "t01-day2-merchant-arrival";

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function merchantMorningStateEligible(runtime) {
  const current = player(runtime);
  const state = runtime?.playerState?.day1T01VillageNight;
  if (current.location !== "田園の村" || current.facilityId !== MERCHANT_FACILITY_ID) return false;
  if (state?.nightSelectedActionId !== base.AUTHORED_DAY1_T01_VILLAGE_NIGHT_INTERNALS.SLEEP_ACTION_ID) return false;
  if (state?.nightCompletedAtMinute == null || state?.morningCompletedAtMinute != null) return false;
  const needs = publicPlayerNeeds(current);
  return Number(needs.lastMealMinute ?? 0) > Number(state.nightCompletedAtMinute);
}

function merchantPresent(context = {}) {
  const present = Array.isArray(context.presentNpcs) ? context.presentNpcs : [];
  return present.some((entry) => (entry?.id ?? entry?.npcId) === MERCHANT_NPC_ID);
}

// The Day2 merchant arrival is an authored consequence of accepting Mira's bed
// and waking after breakfast, not a chance encounter with the generic NPC
// scheduler.  Requiring NPC008 to happen to be in presentNpcs made the scene
// disappear whenever the canonical facility catalog changed its deterministic
// scheduling order.  The authored state and the player's actual bakery
// location are the authority; canonicalizeMerchantAction still identifies the
// real merchant NPC on every visible action.
function merchantMorningEligible(runtime, _context = {}) {
  return merchantMorningStateEligible(runtime);
}

function isMorningAction(action) {
  return action?.authoredDay1T01VillageNightChoice === true
    && action?.authoredDay1T01VillageNightSceneId === MORNING_SCENE_ID;
}

function canonicalizeMerchantAction(action) {
  if (!isMorningAction(action)) return action;
  return {
    ...action,
    targetNpcId: MERCHANT_NPC_ID,
    authoredDay1T01VillageNightSpeech: {
      ...action.authoredDay1T01VillageNightSpeech,
      actorId: MERCHANT_NPC_ID,
    },
  };
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions)) return actions;
  if (actions.some(isMorningAction) && !merchantMorningEligible(runtime, context)) return null;
  return actions.map(canonicalizeMerchantAction);
}

export function authoredMissionFlowGuidance(runtime) {
  const guidance = base.authoredMissionFlowGuidance(runtime);
  if (guidance?.title === "Day2の行商人" && !merchantMorningStateEligible(runtime)) return null;
  if (guidance?.title === "Day2の行商人") {
    return {
      ...guidance,
      targetFacilityId: MERCHANT_FACILITY_ID,
      detail: "昨夜の約束どおり行商人が村へ着き、パン屋で朝の仕入れをしている。先に朝食を整えれば、その場で荷を手伝ったり商品を見たりできる。",
    };
  }
  return guidance;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  return base.applyAuthoredMissionFlowAction(
    runtime,
    canonicalizeMerchantAction(action),
    result,
  );
}

export const AUTHORED_DAY1_T01_VILLAGE_NIGHT_CANONICAL_INTERNALS = Object.freeze({
  player,
  merchantMorningStateEligible,
  merchantPresent,
  merchantMorningEligible,
  isMorningAction,
  canonicalizeMerchantAction,
  MERCHANT_NPC_ID,
  MERCHANT_FACILITY_ID,
  MORNING_SCENE_ID,
});
