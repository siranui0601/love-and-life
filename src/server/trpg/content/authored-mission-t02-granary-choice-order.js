import * as base from "./authored-mission-t02-granary-continuity.js";

export * from "./authored-mission-t02-granary-continuity.js";

export const AUTHORED_MISSION_T02_GRANARY_CHOICE_ORDER_VERSION = "authored-mission-t02-granary-choice-order-v1";

const {
  EVIDENCE_ORDER,
  SIDE_ORDER,
  TERMINAL_ORDER,
  ensureState,
  evidenceAction,
  sideAction,
  terminalAction,
} = base.AUTHORED_MISSION_T02_GRANARY_INTERNALS;

const SIDE_TO_CHANGED_EVIDENCE = Object.freeze({
  release_emergency_grain: "fire_origin",
  freeze_village_debt: "merchant_contract",
  post_night_watch: "hired_hand",
});

function withChoiceIds(actions) {
  return actions.slice(0, 3).map((action, index) => ({
    ...action,
    choiceId: `CHOICE-${index + 1}`,
  }));
}

function orderedEvidence(state) {
  const missing = EVIDENCE_ORDER.filter((id) => !state.evidenceClasses.includes(id));
  if (!missing.length) return [];
  const mostRecentSide = [...state.sideChoices].reverse().find((id) => {
    const changed = SIDE_TO_CHANGED_EVIDENCE[id];
    return changed && missing.includes(changed);
  });
  const priority = SIDE_TO_CHANGED_EVIDENCE[mostRecentSide] ?? null;
  const remaining = priority ? missing.filter((id) => id !== priority) : missing;
  const offset = remaining.length ? state.sceneRevision % remaining.length : 0;
  const rotated = remaining.length
    ? [...remaining.slice(offset), ...remaining.slice(0, offset)]
    : [];
  return priority ? [priority, ...rotated] : rotated;
}

function orderedT02Choices(runtime) {
  const state = ensureState(runtime);
  const evidence = orderedEvidence(state);
  const actions = evidence.slice(0, Math.min(2, evidence.length)).map((id) => evidenceAction(runtime, id));

  for (const id of SIDE_ORDER) {
    if (actions.length >= 3) break;
    if (state.sideChoices.includes(id)) continue;
    actions.push(sideAction(id));
  }
  for (const id of TERMINAL_ORDER) {
    if (actions.length >= 3) break;
    if (state.terminalChoiceId) break;
    actions.push(terminalAction(id));
  }
  return withChoiceIds(actions);
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (!actions?.length || !actions.every((action) => action.authoredT02GranaryChoice === true)) return actions;
  return orderedT02Choices(runtime);
}

export const AUTHORED_MISSION_T02_GRANARY_CHOICE_ORDER_INTERNALS = Object.freeze({
  SIDE_TO_CHANGED_EVIDENCE,
  orderedEvidence,
  orderedT02Choices,
});
