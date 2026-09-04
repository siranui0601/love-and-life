import * as base from "./authored-village-day5-before-fire.js";
import {
  authoredMissionFlowExclusiveActions as coreAuthoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance as coreAuthoredMissionFlowGuidance,
} from "./authored-mission-flow-core.js";
import { AUTHORED_MISSION_T02_GRANARY_INTERNALS } from "./authored-mission-t02-granary-continuity.js";
import { AUTHORED_MISSION_T02_GRANARY_CHOICE_ORDER_INTERNALS } from "./authored-mission-t02-granary-choice-order.js";
import { AUTHORED_T02_GRANARY_DAWN_INTERNALS } from "./authored-mission-flow-t02-granary-dawn.js";
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

function authoredMissionOwnsChoicePool(runtime) {
  return t01Active(runtime);
}

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

function prependAvailableCanonicalLabour(runtime, actions) {
  if (!onlyAuthoredDailyLife(actions)) return actions;
  const jobs = base.CANONICAL_REGIONAL_LABOUR_INTERNALS?.ownActions?.(runtime) ?? [];
  const allowed = jobs.filter((action) =>
    base.CANONICAL_JOB_TIME_POLICY_INTERNALS?.jobTimeAllowed?.(runtime, action) !== false);
  return allowed.length ? [...allowed, ...actions] : actions;
}

function isCoreT02InvestigationPanel(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => {
      const id = String(action?.actionId ?? action?.id ?? "");
      return id.startsWith("MISSION_FLOW:granary-arson:LEAD:")
        || id === "MISSION_FLOW:granary-arson:DEFER:defer";
    });
}

// Keep the common T02 core's hearing/opening contract intact for content-level
// callers. Once that opening has advanced the live mission to its investigate
// step at the shared granary, the v3 canonical ledger explicitly requires the
// dedicated T02_GRANARY:EVIDENCE:* production actions. Resolve that arbitration
// only at the persisted production registry boundary so lower modules retain
// their independent contracts and the strict route sees the canonical surface.
function canonicalT02ContinuityActions(runtime, actions) {
  if (!AUTHORED_MISSION_T02_GRANARY_INTERNALS.t02InvestigationActive(runtime)) return actions;
  if (!isCoreT02InvestigationPanel(actions)) return actions;
  return AUTHORED_MISSION_T02_GRANARY_CHOICE_ORDER_INTERNALS.orderedT02Choices(runtime);
}

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

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  let actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  actions = canonicalT02ContinuityActions(runtime, actions);
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

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const dawnChanged = AUTHORED_T02_GRANARY_DAWN_INTERNALS.consume(runtime, action, result);
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
  isCoreT02InvestigationPanel,
  canonicalT02ContinuityActions,
  syncCanonicalT02GranaryOnset,
  reconcileCanonicalT02GranaryKeeper,
});