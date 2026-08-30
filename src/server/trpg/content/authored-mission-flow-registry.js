import * as base from "./authored-register-butterfly.js";
import { authoredMissionFlowGuidance as coreAuthoredMissionFlowGuidance } from "./authored-mission-flow-core.js";

export * from "./authored-register-butterfly.js";

const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);

function onlyCanonicalWorldLife(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => action?.canonicalWorldLifeChoice === true);
}

function continuingOrdinaryWork(runtime) {
  return runtime?.narrativeMemory?.activityFocus?.intent === "work";
}

function t01Active(runtime) {
  return ACTIVE_MISSION_STATUSES.has(String(runtime?.playerState?.missions?.["MSN-T01"]?.status ?? ""));
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

// canonical-world-life supplies a generic "その土地の生活を選ぶ" fallback when
// rest/meal actions exist. That fallback is valid ordinary-life guidance after
// authored work is terminal, but it must not overwrite an active mission's own
// resolver. T05-T14 already have the full authored guidance contract in the
// core resolver, so reuse it rather than reconstructing labels/targets here.
// T01 is intentionally service-owned; returning null lets service.js preserve
// its rescue/escort/reunion-specific guidance. Genuine downstream authored /
// regional guidance is preserved unchanged.
export function authoredMissionFlowGuidance(runtime, context = {}) {
  const guidance = base.authoredMissionFlowGuidance(runtime, context);
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  const lifeFallback = guidance?.title === "その土地の生活を選ぶ" && onlyCanonicalWorldLife(actions);
  if (!guidance || lifeFallback) {
    const coreGuidance = coreAuthoredMissionFlowGuidance(runtime);
    if (coreGuidance) return coreGuidance;
    if (t01Active(runtime)) return null;
  }
  return guidance;
}
