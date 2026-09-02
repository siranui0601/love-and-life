import * as base from "./authored-register-butterfly.js";
import { authoredMissionFlowGuidance as coreAuthoredMissionFlowGuidance } from "./authored-mission-flow-core.js";

export * from "./authored-register-butterfly.js";

const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);

function onlyCanonicalWorldLife(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => action?.canonicalWorldLifeChoice === true);
}

function hasDedicatedCanonicalWorldLife(actions) {
  return onlyCanonicalWorldLife(actions)
    && actions.some((action) => action?.canonicalWorldLifeKind !== "rest");
}

function continuingOrdinaryWork(runtime) {
  return runtime?.narrativeMemory?.activityFocus?.intent === "work";
}

function missionById(runtime, missionId) {
  const missions = runtime?.playerState?.missions;
  if (Array.isArray(missions)) return missions.find((mission) => mission?.id === missionId) ?? null;
  if (missions instanceof Map) return missions.get(missionId) ?? null;
  return missions?.[missionId] ?? null;
}

function t01Active(runtime) {
  return ACTIVE_MISSION_STATUSES.has(String(missionById(runtime, "MSN-T01")?.status ?? ""));
}

function authoredMissionOwnsChoicePool(runtime) {
  return t01Active(runtime) || Boolean(coreAuthoredMissionFlowGuidance(runtime));
}

// Canonical meals, provisions, lodging and services are real public world
// surfaces. They may own the choice panel when no authored mission owns the
// current scene. Generic REST duration entries are different: exposing the
// whole REST catalogue as an exclusive panel erases ordinary conversation,
// investigation and work candidates. Keep REST in the ordinary candidate pool
// and reserve exclusivity for an actual facility product/service surface.
//
// While an authored mission owns the scene, return null here so its choices are
// rendered instead of being eclipsed by meals/rest. This is state-based and
// route-neutral: players in the same world state see the same public surface.
//
// The public-life network is normally allowed to keep its authored three-way
// scene. The one exception is an already-established ordinary-work continuity:
// after a player finishes a job, narrativeMemory.activityFocus intentionally
// promises that a valid work route remains available. Once the player takes a
// different action, service.js clears the work focus and the public-life scene
// is eligible again.
export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (onlyCanonicalWorldLife(actions)) {
    if (authoredMissionOwnsChoicePool(runtime)) return null;
    return hasDedicatedCanonicalWorldLife(actions) ? actions : null;
  }
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

// canonical-world-life supplies a generic "その土地の生活を選ぶ" fallback.
// Keep that guidance for a real product/service surface, but never let a REST-
// only catalogue override authored mission guidance or the ordinary mixed pool.
export function authoredMissionFlowGuidance(runtime, context = {}) {
  const guidance = base.authoredMissionFlowGuidance(runtime, context);
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (onlyCanonicalWorldLife(actions)) {
    const coreGuidance = coreAuthoredMissionFlowGuidance(runtime);
    if (coreGuidance) return coreGuidance;
    if (t01Active(runtime)) return null;
    return hasDedicatedCanonicalWorldLife(actions) ? guidance : null;
  }
  if (!guidance) {
    const coreGuidance = coreAuthoredMissionFlowGuidance(runtime);
    if (coreGuidance) return coreGuidance;
    if (t01Active(runtime)) return null;
  }
  return guidance;
}
