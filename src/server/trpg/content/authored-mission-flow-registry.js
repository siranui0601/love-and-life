import * as base from "./authored-village-bakery-morning.js";
import { authoredMissionFlowGuidance as coreAuthoredMissionFlowGuidance } from "./authored-mission-flow-core.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-village-bakery-morning.js";

const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);
const NON_PUBLIC_FACILITY_PATTERN = /隠|秘密|地下|処刑|牢|祭壇|封印|見張り小屋|裏路地/u;

function onlyCanonicalWorldLife(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => action?.canonicalWorldLifeChoice === true);
}

function hasDedicatedCanonicalWorldLife(actions) {
  return onlyCanonicalWorldLife(actions)
    && actions.some((action) => action?.canonicalWorldLifeKind !== "rest");
}

function onlyAuthoredDailyLife(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => action?.authoredDailyLifeChoice === true);
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function needValue(runtime, key) {
  const current = player(runtime);
  const candidates = [current?.needs?.[key], current?.[key], runtime?.playerState?.[key]];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function urgentLifeState(runtime) {
  const clock = clockFromMinute(Number(runtime?.playerState?.absoluteMinute ?? 0));
  return needValue(runtime, "hunger") >= 72
    || needValue(runtime, "fatigue") >= 72
    || clock.hour >= 21;
}

function urgentCanonicalProducts(runtime, actions) {
  if (!onlyAuthoredDailyLife(actions) || !urgentLifeState(runtime)) return null;
  const products = base.CANONICAL_WORLD_LIFE_INTERNALS?.productActions?.(runtime);
  return Array.isArray(products) && products.length > 0 ? products : null;
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

// The village square is the ordinary public wayfinder for the farm hub. Older
// service code persisted only a five-entry hard-coded subset there, which left
// canonical public facilities such as the shared granary undiscoverable even
// though they exist in the same live world model and host ordinary Sheet-backed
// jobs. Reconcile the persisted knowledge after successful commands once the
// square is known. This mirrors the signed-public-facility rule already used on
// arrival in other towns, while retaining secret/event-only locations behind
// their existing discovery gates.
function reconcileSignedFarmFacilities(runtime) {
  const known = runtime?.playerKnowledge?.knownFacilityIds;
  if (!(known instanceof Set) || !known.has("LOC_FARM_SQUARE")) return false;
  const facilities = runtime?.livingWorld?.model?.facilitiesByHub?.["田園の村"] ?? [];
  let changed = false;
  for (const facility of facilities) {
    if (!facility?.id || NON_PUBLIC_FACILITY_PATTERN.test(`${facility.name ?? ""} ${facility.type ?? ""}`)) continue;
    if (known.has(facility.id)) continue;
    known.add(facility.id);
    changed = true;
  }
  return changed;
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
// A daily-life vignette is deliberately lower priority than survival. Once the
// clock reaches the survival layer's late-night threshold (or needs become
// urgent), a facility's canonical meal/lodging products take the panel instead
// of leaving the player trapped behind an optional one-off scene. This keeps
// stable LIFE:* ids visible without granting a route-specific escape hatch.
//
// The public-life network is normally allowed to keep its authored three-way
// scene. The one exception is an already-established ordinary-work continuity:
// after a player finishes a job, narrativeMemory.activityFocus intentionally
// promises that a valid work route remains available. Once the player takes a
// different action, service.js clears the work focus and the public-life scene
// is eligible again.
export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  const survivalProducts = urgentCanonicalProducts(runtime, actions);
  if (survivalProducts) return survivalProducts;
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
  const publicFacilitiesChanged = result?.ok === false ? false : reconcileSignedFarmFacilities(runtime);
  return publicFacilitiesChanged || changed;
}

// canonical-world-life supplies a generic "その土地の生活を選ぶ" fallback.
// REST-only actions must not monopolise the exclusive choice panel, but their
// guidance is still valid ordinary-life guidance once no authored mission owns
// the scene. Keep the old F contract here: authored/core guidance wins first,
// T01 service-owned guidance remains service-owned, otherwise preserve the
// ordinary-life guidance even when its actions will be mixed into the common
// candidate pool by service.js.
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

export const AUTHORED_MISSION_FLOW_REGISTRY_INTERNALS = Object.freeze({
  NON_PUBLIC_FACILITY_PATTERN,
  reconcileSignedFarmFacilities,
});