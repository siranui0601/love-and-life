import * as base from "./authored-mission-flow-day1-t01-village-night.js";

export * from "./authored-mission-flow-day1-t01-village-night.js";

export const AUTHORED_DAY1_T01_VILLAGE_NIGHT_CANONICAL_VERSION =
  "authored-day1-t01-village-night-canonical-v1";

const MERCHANT_NPC_ID = "NPC008";
const MORNING_SCENE_ID = "t01-day2-merchant-arrival";

function canonicalizeMerchantAction(action) {
  if (!action?.authoredDay1T01VillageNightChoice
    || action.authoredDay1T01VillageNightSceneId !== MORNING_SCENE_ID) {
    return action;
  }
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
  return Array.isArray(actions) ? actions.map(canonicalizeMerchantAction) : actions;
}

export function authoredMissionFlowGuidance(runtime) {
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  return base.applyAuthoredMissionFlowAction(
    runtime,
    canonicalizeMerchantAction(action),
    result,
  );
}

export const AUTHORED_DAY1_T01_VILLAGE_NIGHT_CANONICAL_INTERNALS = Object.freeze({
  canonicalizeMerchantAction,
  MERCHANT_NPC_ID,
  MORNING_SCENE_ID,
});
