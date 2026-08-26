import * as base from "./canonical-job-time-policy.js";

export * from "./canonical-job-time-policy.js";

function onlyCanonicalWorldLife(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => action?.canonicalWorldLifeChoice === true);
}

// Ordinary life actions (meals, shopping, lodging and short rests) are public
// world actions, not an authored mission branch. Returning them through the
// exclusive hook makes choiceActionPool stop before mission, conversation,
// investigation and work candidates are generated. Keep genuinely authored
// / regional-labour exclusive flows, but let ordinary life choices fall back
// to the normal diverse-choice pool instead of monopolising it.
export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions)) return actions;
  const exclusive = actions.filter((action) => action?.canonicalWorldLifeChoice !== true);
  return exclusive.length ? exclusive : null;
}

// The same boundary applies to guidance. canonical-world-life supplies a
// generic "その土地の生活を選ぶ" fallback when rest/meal actions exist. Once
// those actions stopped being mission-exclusive, allowing that fallback to
// remain here made the UI guidance disagree with the actual mission choices:
// T01 rescue, cross-facility authored steps and even the legacy base opening
// could all be pointed back at the current location. Return null only for the
// confirmed life-only fallback so the service's normal mission guidance can
// describe the active step. Genuine authored / regional guidance is preserved.
export function authoredMissionFlowGuidance(runtime, context = {}) {
  const guidance = base.authoredMissionFlowGuidance(runtime, context);
  if (!guidance) return null;
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (guidance.title === "その土地の生活を選ぶ" && onlyCanonicalWorldLife(actions)) return null;
  return guidance;
}
