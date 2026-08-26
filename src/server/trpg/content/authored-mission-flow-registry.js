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

function activeSpecialMissionStep(runtime) {
  const state = runtime?.playerState;
  const candidates = (state?.catalog?.special ?? []).flatMap((definition) => {
    const mission = state?.missions?.[definition.id];
    if (!ACTIVE_MISSION_STATUSES.has(String(mission?.status ?? ""))) return [];
    const step = (definition.steps ?? []).find((entry) =>
      Number(mission.progress?.[entry.id] ?? 0) < Number(entry.required ?? 1));
    return step ? [{ definition, mission, step }] : [];
  });
  return candidates.sort((left, right) =>
    Number(left.definition.deadlineDay ?? left.definition.finalDay ?? 999)
      - Number(right.definition.deadlineDay ?? right.definition.finalDay ?? 999)
      || String(left.definition.id).localeCompare(String(right.definition.id)))[0] ?? null;
}

function missionStepGuidance(runtime) {
  const active = activeSpecialMissionStep(runtime);
  if (!active) return null;
  const current = runtime.playerState.player ?? {};
  const { definition, step } = active;
  const targetLocation = step.targetLocation ?? definition.targetLocations?.[0] ?? current.location ?? null;
  const targetFacilityId = step.targetFacilityId ?? null;
  const requiresMovement = (targetLocation && targetLocation !== current.location)
    || (targetFacilityId && targetFacilityId !== current.facilityId);
  return {
    missionId: definition.id,
    kicker: "進行中の出来事",
    title: step.label ?? definition.title,
    detail: `「${definition.title}」の次の手掛かりへ進む。`,
    targetLocation,
    targetFacilityId,
    actionPanel: requiresMovement ? "movement" : null,
  };
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
// rest/meal actions exist. That guidance is valid after mission closure, but it
// must not replace an actionable special-mission step while the mission is still
// active. In that one life-only fallback case, derive the same minimal current
// step contract used by the public game view (mission, target, movement panel)
// instead of pointing the player back at ordinary life. Genuine authored /
// regional guidance is preserved unchanged.
export function authoredMissionFlowGuidance(runtime, context = {}) {
  const guidance = base.authoredMissionFlowGuidance(runtime, context);
  if (!guidance) return missionStepGuidance(runtime);
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (guidance.title === "その土地の生活を選ぶ" && onlyCanonicalWorldLife(actions)) {
    return missionStepGuidance(runtime) ?? guidance;
  }
  return guidance;
}
