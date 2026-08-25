import * as base from "./canonical-job-time-policy.js";

export * from "./canonical-job-time-policy.js";

// Ordinary life actions (meals, shopping, lodging and short rests) are public
// world actions, not an authored mission branch.  Returning them through the
// exclusive hook makes choiceActionPool stop before mission, conversation,
// investigation and work candidates are generated.  Keep genuinely authored
// / regional-labour exclusive flows, but let ordinary life choices fall back
// to the normal diverse-choice pool instead of monopolising it.
export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions)) return actions;
  const exclusive = actions.filter((action) => action?.canonicalWorldLifeChoice !== true);
  return exclusive.length ? exclusive : null;
}
