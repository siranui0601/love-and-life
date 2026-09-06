import * as base from "./authored-village-day6-north-fence-workday.js";
import {
  authoredMissionFlowExclusiveActions as coreAuthoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance as coreAuthoredMissionFlowGuidance,
} from "./authored-mission-flow-core.js";
import { AUTHORED_MISSION_T02_GRANARY_INTERNALS } from "./authored-mission-t02-granary-continuity.js";
import { AUTHORED_MISSION_T02_GRANARY_CHOICE_ORDER_INTERNALS } from "./authored-mission-t02-granary-choice-order.js";
import { AUTHORED_T02_GRANARY_DAWN_INTERNALS } from "./authored-mission-flow-t02-granary-dawn.js";
import {
  clockFromMinute,
  generateChoiceActions,
  PLAYER_PROFILES,
} from "../../../../tools/trpg-sim/lib/player-journey.mjs";

export * from "./authored-village-day6-north-fence-workday.js";

const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);
const ACTIVE_TROUBLE_STATUSES = new Set(["active", "critical"]);
const NON_PUBLIC_FACILITY_PATTERN = /隠|秘密|地下|処刑|牢|祭壇|封印|見張り小屋|裏路地/u;
const T02_KEEPER_ID = "NPC005";
const T02_GRANARY_ID = "LOC_FARM_GRANARY";
const T02_DAWN_OPENING_SCENE = "t02-granary-dawn";
const INACTIVE_NPC_PRESENCE = new Set(["dead", "missing", "departed", "sealed", "not-yet-present", "traveling"]);
const PROFILE_BY_ID = new Map(PLAYER_PROFILES.map((profile) => [profile.id, profile]));

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

function containsAuthoredDailyLife(actions) {
  return Array.isArray(actions)
    && actions.some((action) => action?.authoredDailyLifeChoice === true);
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

function dailyLifeCommonChoiceCandidates(runtime, actions, context = {}, productionRuntime = false) {
  if (!productionRuntime || !containsAuthoredDailyLife(actions)) return actions;

  // T01's hearing/search/rescue surface has stricter co-presence and disclosure
  // rules in the common service. Daily life is deliberately the bottom layer,
  // so it must yield rather than replace those authoritative mission choices.
  if (t01Active(runtime)) return null;

  const presentNpcs = Array.isArray(context.presentNpcs) ? context.presentNpcs : [];
  const conversations = presentNpcs.slice(0, 2).map((npc) => ({
    id: `DIRECT_TALK:${npc.id}`,
    type: "conversation",
    directTalk: true,
    targetNpcId: npc.id,
    targetNpcName: npc.name ?? npc.id,
    dialogueTopic: "direct_contact",
    minutes: 5,
    label: `${npc.name ?? "近くの人"}に話しかける`,
  }));

  const movementPool = Array.isArray(context.movementActions) ? context.movementActions : [];
  const regionalMove = movementPool.find((action) => action?.movementScope === "regional") ?? null;
  const localMove = movementPool.find((action) => action?.movementScope === "local") ?? null;
  const movements = [regionalMove, localMove]
    .filter(Boolean)
    .filter((action, index, entries) => entries.findIndex((entry) => entry.id === action.id) === index);

  let seekBattle = null;
  const state = runtime?.playerState;
  const model = runtime?.livingWorld?.model;
  const battleData = state?.battleData;
  const catalog = state?.catalog;
  const profile = PROFILE_BY_ID.get(state?.profileId) ?? PROFILE_BY_ID.get("balanced");
  if (state && model && battleData && catalog && profile) {
    seekBattle = generateChoiceActions(
      state,
      model,
      battleData,
      catalog,
      profile,
      { limit: 12, fillTo: 0 },
    ).find((action) => action?.id === "SEEK_BATTLE") ?? null;
  }

  // Once village daily life is mixed with ordinary production options it is no
  // longer an exclusive scene. Keep all action-specific consume metadata, but
  // clear the selector-only exclusivity marker so conversation, battle and
  // travel can genuinely compete for the public three-choice surface.
  const commonLayerActions = actions.map((action) => ({
    ...action,
    authoredMissionFlowExclusiveChoice: false,
  }));
  const combined = [
    ...commonLayerActions,
    ...conversations,
    ...(seekBattle ? [seekBattle] : []),
    ...movements,
  ];
  return [...new Map(combined.map((action) => [action.id, action])).values()].slice(0, 9);
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

function availableCanonicalLabour(runtime) {
  const jobs = base.CANONICAL_REGIONAL_LABOUR_INTERNALS?.ownActions?.(runtime) ?? [];
  return jobs.filter((action) =>
    base.CANONICAL_JOB_TIME_POLICY_INTERNALS?.jobTimeAllowed?.(runtime, action) !== false);
}

function productionAuthoredRuntime(runtime, context = {}) {
  return runtime?.authoredMissionFlows != null
    || runtime?.livingWorld != null
    || base.CANONICAL_REGIONAL_LABOUR_INTERNALS?.productionChoiceContext?.(context) === true;
}

function prependAvailableCanonicalLabour(runtime, actions, context = {}, productionRuntime = productionAuthoredRuntime(runtime, context)) {
  if (!onlyAuthoredDailyLife(actions) || !productionRuntime) return actions;
  const allowed = availableCanonicalLabour(runtime);
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

function isCanonicalT02ContinuityPanel(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => String(action?.actionId ?? action?.id ?? "").startsWith("T02_GRANARY:"));
}

function isT02InvestigationPanel(actions) {
  return isCoreT02InvestigationPanel(actions) || isCanonicalT02ContinuityPanel(actions);
}

function canonicalT02DawnPlayed(runtime) {
  const state = runtime?.playerState?.t02GranaryDawn;
  if (!state || typeof state !== "object") return false;
  return (Array.isArray(state.selectedActionIds) && state.selectedActionIds.length > 0)
    || Object.keys(state.completedScenes ?? {}).length > 0;
}

// Keep the common T02 core's hearing/opening contract intact for ordinary
// production callers. The v3 canonical continuity is a consequence of the
// authored dawn intervention, so only a runtime that actually played that dawn
// may switch from the common investigation surface to T02_GRANARY:EVIDENCE:*.
function canonicalT02ContinuityActions(runtime, actions) {
  if (!canonicalT02DawnPlayed(runtime)) return actions;
  if (!AUTHORED_MISSION_T02_GRANARY_INTERNALS.t02InvestigationActive(runtime)) return actions;
  if (!isCoreT02InvestigationPanel(actions)) return actions;
  return AUTHORED_MISSION_T02_GRANARY_CHOICE_ORDER_INTERNALS.orderedT02Choices(runtime);
}

// After the dawn, the common T02 investigation panel explicitly contains a
// DEFER choice and its leads may point to other facilities. It must therefore
// not hide an executable real product at the player's current facility. This
// is deliberately T02-only: it is not a generic authored/generic action mix.
function localCanonicalProductsBeforeDeferredT02(runtime, actions) {
  if (!canonicalT02DawnPlayed(runtime) || !isCoreT02InvestigationPanel(actions)) return actions;
  const canDefer = actions.some((action) =>
    String(action?.actionId ?? action?.id ?? "") === "MISSION_FLOW:granary-arson:DEFER:defer");
  if (!canDefer) return actions;
  const products = base.CANONICAL_WORLD_LIFE_INTERNALS?.productActions?.(runtime) ?? [];
  return Array.isArray(products) && products.length > 0 ? products : actions;
}

// Day6's afternoon north-fence block is ordinary village time around the real
// 18:00-22:00 Sheet-backed watch. T02 remains open, but its DEFER-capable
// investigation must not erase the route-neutral maintenance/handover actions
// that make the canonical work window naturally reachable.
function localDay6NorthFenceLifeBesideT02(runtime, actions) {
  if (!canonicalT02DawnPlayed(runtime) || !isT02InvestigationPanel(actions)) return actions;
  const own = base.AUTHORED_VILLAGE_DAY6_NORTH_FENCE_WORKDAY_INTERNALS?.ownActions?.(runtime) ?? null;
  return Array.isArray(own) && own.length > 0 ? own : actions;
}

// T02 is a long-running investigation, not a modal lock. Preserve the
// three-choice UI by reserving one slot for executable local labour and keeping
// two investigation choices. This applies to both the canonical continuity
// layer and the common core panel after the dawn has genuinely been played.
function localCanonicalLabourBesideT02Continuity(runtime, actions) {
  if (!canonicalT02DawnPlayed(runtime) || !isT02InvestigationPanel(actions)) return actions;
  const jobs = availableCanonicalLabour(runtime);
  if (!jobs.length) return actions;
  return [...jobs.slice(0, 1), ...actions.slice(0, 2)];
}

// Outside the dedicated Day6 north-fence bridge, a long-running T02 inquiry
// still cannot make an otherwise available bounded public rest impossible.
function localCanonicalRestBesideT02Continuity(runtime, actions) {
  if (!canonicalT02DawnPlayed(runtime) || !isT02InvestigationPanel(actions)) return actions;
  const rests = base.CANONICAL_WORLD_LIFE_INTERNALS?.restActions?.(runtime) ?? [];
  if (!rests.length) return actions;
  const fatigue = needValue(runtime, "fatigue");
  const preferredMinutes = fatigue >= 24 ? 90 : fatigue >= 12 ? 60 : 30;
  const rest = rests.find((action) => action.id === `LIFE:REST:${preferredMinutes}`) ?? rests[0];
  return [rest, ...actions.slice(0, 2)];
}

function canonicalT02DawnAction(action) {
  const id = String(action?.actionId ?? action?.id ?? "");
  if (id.startsWith("MISSION_FLOW:T02:")) {
    for (const [sceneId, choices] of Object.entries(AUTHORED_T02_GRANARY_DAWN_INTERNALS.SCENES ?? {})) {
      for (const choice of choices ?? []) {
        if (AUTHORED_T02_GRANARY_DAWN_INTERNALS.actionIdFor(sceneId, choice) === id) {
          return AUTHORED_T02_GRANARY_DAWN_INTERNALS.actionFor(sceneId, choice);
        }
      }
    }
  }
  return action?.authoredT02DawnChoice === true ? action : null;
}

function reconcileCanonicalT02DawnFollowUp(runtime, action, changed) {
  if (!changed || !action?.authoredT02DawnChoice || !action.authoredT02DawnNextSceneId) return false;
  const state = AUTHORED_T02_GRANARY_DAWN_INTERNALS.ensureState(runtime);
  if (state.currentSceneId === action.authoredT02DawnNextSceneId) return false;
  state.currentSceneId = action.authoredT02DawnNextSceneId;
  return true;
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
  const productionRuntimeBeforeBase = productionAuthoredRuntime(runtime, context);
  let actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  actions = canonicalT02ContinuityActions(runtime, actions);
  actions = localCanonicalProductsBeforeDeferredT02(runtime, actions);
  actions = localDay6NorthFenceLifeBesideT02(runtime, actions);
  actions = localCanonicalLabourBesideT02Continuity(runtime, actions);
  actions = localCanonicalRestBesideT02Continuity(runtime, actions);
  actions = prependAvailableCanonicalLabour(runtime, actions, context, productionRuntimeBeforeBase);
  const survivalProducts = urgentCanonicalProducts(runtime, actions);
  if (survivalProducts) return survivalProducts;
  actions = dailyLifeCommonChoiceCandidates(runtime, actions, context, productionRuntimeBeforeBase);
  if (actions == null) return null;
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
  const dawnAction = canonicalT02DawnAction(action);
  const dawnChanged = dawnAction
    ? AUTHORED_T02_GRANARY_DAWN_INTERNALS.consume(runtime, dawnAction, result)
    : false;
  const dawnFollowUpChanged = reconcileCanonicalT02DawnFollowUp(runtime, dawnAction, dawnChanged);
  const day6FenceChanged = base.AUTHORED_VILLAGE_DAY6_NORTH_FENCE_WORKDAY_INTERNALS?.consume?.(runtime, action, result) ?? false;
  const labourChanged = base.CANONICAL_REGIONAL_LABOUR_INTERNALS?.consume?.(runtime, action, result) ?? false;
  const changed = dawnChanged || dawnFollowUpChanged || day6FenceChanged || labourChanged
    ? true
    : base.applyAuthoredMissionFlowAction(runtime, action, result);
  const canonicalAction = dawnAction ?? action;
  const t02OnsetChanged = syncCanonicalT02GranaryOnset(runtime, canonicalAction, result);
  const t02KeeperChanged = reconcileCanonicalT02GranaryKeeper(runtime, canonicalAction, result);
  base.AUTHORED_REGISTER_BUTTERFLY_INTERNALS.callbackEligible(runtime);
  const finalDawnFollowUpChanged = reconcileCanonicalT02DawnFollowUp(runtime, dawnAction, dawnChanged);
  const publicFacilitiesChanged = result?.ok === false ? false : reconcileSignedFarmFacilities(runtime);
  return publicFacilitiesChanged || finalDawnFollowUpChanged || t02KeeperChanged || t02OnsetChanged || changed;
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
  availableCanonicalLabour,
  productionAuthoredRuntime,
  prependAvailableCanonicalLabour,
  containsAuthoredDailyLife,
  dailyLifeCommonChoiceCandidates,
  coreMissionOwnsChoicePool,
  authoredMissionOwnsChoicePool,
  urgentCanonicalProducts,
  isCoreT02InvestigationPanel,
  isCanonicalT02ContinuityPanel,
  isT02InvestigationPanel,
  canonicalT02DawnPlayed,
  canonicalT02ContinuityActions,
  localCanonicalProductsBeforeDeferredT02,
  localDay6NorthFenceLifeBesideT02,
  localCanonicalLabourBesideT02Continuity,
  localCanonicalRestBesideT02Continuity,
  canonicalT02DawnAction,
  reconcileCanonicalT02DawnFollowUp,
  syncCanonicalT02GranaryOnset,
  reconcileCanonicalT02GranaryKeeper,
});