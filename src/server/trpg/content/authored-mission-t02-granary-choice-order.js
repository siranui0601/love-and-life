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

function withChoiceIds(actions) {
  return actions.slice(0, 3).map((action, index) => ({
    ...action,
    choiceId: `CHOICE-${index + 1}`,
  }));
}

function orderedT02Choices(runtime) {
  const state = ensureState(runtime);
  const missing = EVIDENCE_ORDER.filter((id) => !state.evidenceClasses.includes(id));
  const offset = missing.length ? state.sceneRevision % missing.length : 0;
  const rotated = missing.length
    ? [...missing.slice(offset), ...missing.slice(0, offset)]
    : [];
  const actions = rotated.slice(0, Math.min(2, rotated.length)).map((id) => evidenceAction(runtime, id));

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
  orderedT02Choices,
});
