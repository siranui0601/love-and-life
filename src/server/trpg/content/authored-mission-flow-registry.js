import * as base from "./authored-village-day5-before-fire.js";
import {
  authoredMissionFlowExclusiveActions as coreAuthoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance as coreAuthoredMissionFlowGuidance,
} from "./authored-mission-flow-core.js";
import { clockFromMinute } from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-village-day5-before-fire.js";

const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);
const ACTIVE_TROUBLE_STATUSES = new Set(["active", "critical"]);
const NON_PUBLIC_FACILITY_PATTERN = /隠|秘密|地下|処刑|牢|祭壇|封印|見張り小屋|裏路地/u;
const T02_KEEPER_ID = "NPC005";
const T02_GRANARY_ID = "LOC_FARM_GRANARY";
const T02_DAWN_OPENING_SCENE = "t02-granary-dawn";
const INACTIVE_NPC_PRESENCE = new Set(["dead", "missing", "departed", "sealed", "not-yet-present", "traveling"]);

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

function urgentCanonicalProducts(runtime, actions) {
  if (!urgentLifeState(runtime) || t01Active(runtime)) return null;
  const ordinaryOrEmpty = !Array.isArray(actions)
    || actions.length === 0
    || onlyAuthoredDailyLife(actions)
    || onlyCanonicalWorldLife(actions);
  if (!ordinaryOrEmpty) return null;
  const products = base.CANONICAL_WORLD_LIFE_INTERNALS?.productActions?.(runtime);
  return Array.isArray(products) && products.length > 0 ? products : null;
}

function coreMissionOwnsChoicePool(runtime, context = {}) {
  const actions = coreAuthoredMissionFlowExclusiveActions(runtime, context);
  return Array.isArray(actions) && actions.length > 0;
}

// T01 discovery is still service-owned rather than supplied by the common core
// pack chain, so it needs an explicit gate. For every core-authored mission, do
// not call the core a second time after `base` has already resolved the complete
// content chain: canonical-world-life only returns its own actions when its base
// supplied no meaningful authored panel. Re-running the core here can initialize
// flow state and manufacture a false-positive ownership result that hides public
// food/lodging even though no mission choice is actually visible in production.
function authoredMissionOwnsChoicePool(runtime) {
  return t01Active(runtime);
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

// The lower regional-labour layer deliberately keeps content-only daily-life
// callers stable unless production context is present. The top registry is the
// actual arbitration boundary, however, and some production-facing tests/calls
// reach it without movement/presence context. Reintroduce only a currently
// executable Sheet-backed job beside a pure daily-life panel, after applying the
// same canonical work-window policy. Genuine mission/exclusive scenes are never
// mixed here.
function prependAvailableCanonicalLabour(runtime, actions) {
  if (!onlyAuthoredDailyLife(actions)) return actions;
  const jobs = base.CANONICAL_REGIONAL_LABOUR_INTERNALS?.ownActions?.(runtime) ?? [];
  const allowed = jobs.filter((action) =>
    base.CANONICAL_JOB_TIME_POLICY_INTERNALS?.jobTimeAllowed?.(runtime, action) !== false);
  return allowed.length ? [...allowed, ...actions] : actions;
}

// T02 is canonically scheduled for Day5 at night. Its dawn scene is a custom
// authored production action and therefore does not pass through the generic
// journey action resolver that normally calls updateTroubles(). If the player
// legitimately executes that dawn scene after the canonical onset, keep the
// persisted trouble lifecycle in sync before the core T02 investigation pack is
// asked to build the next choice panel. This is production-state reconciliation,
// not a replay/audit shortcut: the action itself is the player's observation of
// the already-started fire, and T02 has no prerequisite gate or onset consequence.
function syncCanonicalT02GranaryOnset(runtime, action, result) {
  if (!action?.authoredT02DawnChoice || result?.ok === false) return false;
  const state = runtime?.playerState;
  const trouble = state?.troubles?.T02;
  if (!state || !trouble || trouble.status !== "scheduled") return false;
  const clock = clockFromMinute(Number(state.absoluteMinute ?? 0));
  if (clock.day < 5 || (clock.day === 5 && clock.hour < 22)) return false;
  const minute = Number(state.absoluteMinute ?? 0);
  const from = trouble.status;
  trouble.status = "active";
  trouble.activatedAt ??= minute;
  if (!Array.isArray(trouble.transitions)) trouble.transitions = [];
  trouble.transitions.push({ from, to: "active", minute, reason: "canonical-t02-dawn-onset" });
  if (Array.isArray(state.history)) {
    state.history.push({
      type: "TROUBLE_TRANSITION",
      minute,
      troubleId: "T02",
      from,
      to: "active",
      reason: "canonical-t02-dawn-onset",
    });
  }
  return true;
}

// NPC005/Toma is canonically the shared-granary keeper. The live NPC master says
// morning = granary inspection, main facility = LOC_FARM_GRANARY, and explicitly
// "T02中は穀倉前". The generic life engine currently fails to map the routine
// text "穀倉点検" to the facility name "共同穀倉" and may leave him at a fallback
// facility. Do not weaken the production presence gate. Once the cordoned-scene
// branch has finished its immediate follow-up, reconcile this already-due local
// duty so the next core hearing can only appear with the real NPC physically at
// the scene. The headcount branch intentionally says Toma is missing and is not
// touched here; inactive/dead/traveling NPCs are never revived or recalled.
function reconcileCanonicalT02GranaryKeeper(runtime, action, result) {
  if (!action?.authoredT02DawnChoice || result?.ok === false) return false;
  if (action.authoredT02DawnSceneId === T02_DAWN_OPENING_SCENE) return false;
  if (runtime?.playerState?.worldFlags?.t02DawnSceneRoped !== true) return false;
  if (!ACTIVE_MISSION_STATUSES.has(String(missionById(runtime, "MSN-T02")?.status ?? ""))) return false;
  if (!ACTIVE_TROUBLE_STATUSES.has(String(runtime?.playerState?.troubles?.T02?.status ?? ""))) return false;
  const keeper = runtime?.livingWorld?.npcStates?.[T02_KEEPER_ID];
  if (!keeper || INACTIVE_NPC_PRESENCE.has(String(keeper.presence ?? ""))) return false;
  if (["dead", "missing"].includes(String(keeper.lifeStatus ?? ""))) return false;
  if (String(keeper.presence ?? "") !== "present") return false;
  if ((keeper.position?.hubId ?? keeper.location) !== "田園の村") return false;
  if (keeper.position?.facilityId === T02_GRANARY_ID) return false;

  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const fromFacilityId = keeper.position?.facilityId ?? null;
  keeper.location = "田園の村";
  keeper.position = { hubId: "田園の村", facilityId: T02_GRANARY_ID };
  keeper.localTravel = null;
  runtime.livingWorld.localMovementEvents ??= [];
  runtime.livingWorld.localMovementEvents.push({
    npcId: T02_KEEPER_ID,
    scope: "facility",
    routeId: `CANONICAL_ROUTINE:${T02_KEEPER_ID}:T02_GRANARY`,
    hubId: "田園の村",
    fromFacilityId,
    toFacilityId: T02_GRANARY_ID,
    departedAt: minute / 60,
    arrivedAt: minute / 60,
    durationHours: 0,
    settledBy: "canonical-t02-granary-duty",
  });
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "NPC_CANONICAL_ROUTINE_RECONCILED",
    minute,
    npcId: T02_KEEPER_ID,
    fromFacilityId,
    toFacilityId: T02_GRANARY_ID,
    reason: "t02-active-granary-keeper-duty",
  });
  return true;
}

// Canonical meals, provisions, lodging and services are real public world
// surfaces. They may own the choice panel when no authored mission owns the
// current scene. Generic REST duration entries are different: exposing the
// whole REST catalogue as an exclusive panel erases ordinary conversation,
// investigation and work candidates. Keep REST in the ordinary candidate pool
// and reserve exclusivity for an actual facility product/service surface.
//
// The complete base chain already gives higher-priority authored scenes first.
// At an urgent/late life boundary, an empty base result is also authoritative:
// it means there is no authored panel at the current scene, so stable canonical
// food/lodging products must be surfaced directly instead of falling through to
// survival-aware-service's legacy dynamic EAT/LODGE/REST_OUTDOOR ids. A real
// non-ordinary authored panel still wins. T01 remains the explicit exception
// because its discovery surface is service-owned rather than the common chain.
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
  let actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  actions = prependAvailableCanonicalLabour(runtime, actions);
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
  // T02 dawn actions are also ordinary `plan` actions at the transport layer.
  // A higher generic plan consumer can report success before the dedicated dawn
  // wrapper is reached, leaving its follow-up scene/evidence state unpersisted.
  // Dispatch only the explicitly tagged dawn action at this persisted boundary;
  // this is the same narrow ownership rule used for canonical labour below.
  const dawnChanged = base.AUTHORED_T02_GRANARY_DAWN_INTERNALS?.consume?.(runtime, action, result) ?? false;

  // Canonical jobs are ordinary `plan` actions. Higher wrapper layers can
  // successfully consume a generic plan before the canonical-labour layer is
  // reached, which advances time but loses the Sheet-backed wage/shift record.
  // Dispatch the explicitly tagged canonical job at this top persisted boundary
  // first; this changes no choice arbitration and cannot affect non-job plans.
  const labourChanged = base.CANONICAL_REGIONAL_LABOUR_INTERNALS?.consume?.(runtime, action, result) ?? false;
  const changed = dawnChanged || labourChanged
    ? true
    : base.applyAuthoredMissionFlowAction(runtime, action, result);
  const t02OnsetChanged = syncCanonicalT02GranaryOnset(runtime, action, result);
  const t02KeeperChanged = reconcileCanonicalT02GranaryKeeper(runtime, action, result);
  base.AUTHORED_REGISTER_BUTTERFLY_INTERNALS.callbackEligible(runtime);
  const publicFacilitiesChanged = result?.ok === false ? false : reconcileSignedFarmFacilities(runtime);
  return publicFacilitiesChanged || t02KeeperChanged || t02OnsetChanged || changed;
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
  prependAvailableCanonicalLabour,
  coreMissionOwnsChoicePool,
  authoredMissionOwnsChoicePool,
  urgentCanonicalProducts,
  syncCanonicalT02GranaryOnset,
  reconcileCanonicalT02GranaryKeeper,
});
