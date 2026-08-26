import * as base from "./canonical-job-time-policy.js";

export * from "./canonical-job-time-policy.js";

const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);

function onlyCanonicalWorldLife(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => action?.canonicalWorldLifeChoice === true);
}

function continuingOrdinaryWork(runtime) {
  return runtime?.narrativeMemory?.activityFocus?.intent === "work";
}

function hasActiveMissionStep(runtime) {
  const state = runtime?.playerState;
  const definitions = [
    ...(state?.catalog?.special ?? []),
    ...(state?.catalog?.permanent ?? []),
  ];
  return definitions.some((definition) => {
    const mission = state?.missions?.[definition.id];
    if (!ACTIVE_MISSION_STATUSES.has(String(mission?.status ?? ""))) return false;
    if (!Array.isArray(definition.steps) || definition.steps.length === 0) return false;
    return definition.steps.some((step) =>
      Number(mission.progress?.[step.id] ?? 0) < Number(step.required ?? 1));
  });
}

// Ordinary life actions (meals, shopping, lodging and short rests) are public
// world actions, not an authored mission branch. Returning them through the
// exclusive hook makes choiceActionPool stop before mission, conversation,
// investigation and work candidates are generated. Keep genuinely authored
// / regional-labour exclusive flows, but let ordinary life choices fall back
// to the normal diverse-choice pool instead of monopolising it.
//
// The public-life network is normally allowed to keep its authored three-way
// scene. The one exception is an already-established ordinary-work continuity:
// after a player finishes a job, narrativeMemory.activityFocus intentionally
// promises that a valid work route remains available. A Day2 public-life scene
// must not erase that route before the bounded work market can re-evaluate the
// new day's employer/facility limits. Once the player takes a different action,
// service.js clears the work focus and the public-life scene is eligible again.
export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions)) return actions;
  const exclusive = actions.filter((action) =>
    action?.canonicalWorldLifeChoice !== true
      && !(continuingOrdinaryWork(runtime) && action?.authoredPublicLifeNetworkChoice === true));
  return exclusive.length ? exclusive : null;
}

// The same boundary applies to guidance while an actionable mission remains.
// canonical-world-life supplies a generic "その土地の生活を選ぶ" fallback when
// rest/meal actions exist. Once those actions stopped being mission-exclusive,
// allowing that fallback to remain while a mission still has an incomplete step
// made the UI guidance disagree with the actual mission choices. After the
// mission is terminal, the ordinary-life guidance is valid again and remains
// visible; this preserves the post-resolution public-life contract.
export function authoredMissionFlowGuidance(runtime, context = {}) {
  const guidance = base.authoredMissionFlowGuidance(runtime, context);
  if (!guidance) return null;
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (guidance.title === "その土地の生活を選ぶ"
    && onlyCanonicalWorldLife(actions)
    && hasActiveMissionStep(runtime)) return null;
  return guidance;
}
