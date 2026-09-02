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

// Canonical world-life has already applied the public product/price, permit,
// quantity and affordability policy before its actions reach this registry.
// Do not discard that completed public-action result. The previous registry
// filter returned null for a life-only set on the assumption that service.js
// would re-inject those actions into its diverse ordinary pool; it does not.
// The result was a route-neutral production bug where a player could stand in
// a bakery with enough gold while only INSPECT/TALK/weather was actionable.
// Preserve the canonical life set here, while genuinely authored scenes and
// regional labour keep their existing exclusivity rules below.
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
  if (onlyCanonicalWorldLife(actions)) return actions;
  if (!Array.isArray(actions)) return actions;
  const exclusive = actions.filter((action) =>
    !(continuingOrdinaryWork(runtime) && action?.authoredPublicLifeNetworkChoice === true));
  return exclusive.length ? exclusive : null;
}

// Every successful production command crosses the persisted runtime boundary
// after this hook. The REGISTER butterfly previously created Riona's greeting
// only while building a read-only game view, so the three callback choices were
// visible even though the greeting interaction/history was absent from the save
// snapshot. Resolve that world observation here, while the command runtime is
// still authoritative, so the same interaction is serialized exactly once and
// survives restore before the player answers it.
export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  base.AUTHORED_REGISTER_BUTTERFLY_INTERNALS.callbackEligible(runtime);
  return changed;
}

// canonical-world-life supplies a generic "その土地の生活を選ぶ" fallback when
// rest/meal actions exist. That fallback is valid ordinary-life guidance after
// authored work is terminal, but it must not overwrite an active mission's own
// resolver. T05-T14 already have the full authored guidance contract in the
// core resolver, so reuse it rather than reconstructing labels/targets here.
// T01 is intentionally service-owned unless the currently visible production
// actions are themselves canonical world-life choices.
export function authoredMissionFlowGuidance(runtime, context = {}) {
  const guidance = base.authoredMissionFlowGuidance(runtime, context);
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (onlyCanonicalWorldLife(actions)) return guidance;
  if (!guidance) {
    const coreGuidance = coreAuthoredMissionFlowGuidance(runtime);
    if (coreGuidance) return coreGuidance;
    if (t01Active(runtime)) return null;
  }
  return guidance;
}
