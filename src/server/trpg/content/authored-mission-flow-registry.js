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

function ambientFallbackAction(action) {
  const id = String(action?.id ?? action?.actionId ?? "");
  return id.startsWith("INSPECT:")
    || id.startsWith("TALK:")
    || id.startsWith("AMBIENT_WEATHER:");
}

function ambientFallbackOnly(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every(ambientFallbackAction);
}

function ordinaryWorldLifeActions(runtime) {
  const actions = base.CANONICAL_WORLD_LIFE_INTERNALS?.ownActions?.(runtime);
  return Array.isArray(actions) && actions.length ? actions : null;
}

function lifeOverridesAmbient(runtime, actions) {
  return ambientFallbackOnly(actions) && Boolean(ordinaryWorldLifeActions(runtime)?.length);
}

function ordinaryLifeGuidance(runtime) {
  return {
    kicker: "食べる・休む・泊まる・買うことも、この世界で生きる行動だ",
    title: "その土地の生活を選ぶ",
    detail: "商品・価格表の正式な食事、保存食、宿泊、修理を通常の公開行動として利用できる。",
    targetLocation: runtime?.playerState?.player?.location ?? runtime?.playerState?.location ?? null,
    targetFacilityId: runtime?.playerState?.player?.facilityId ?? runtime?.playerState?.facilityId ?? null,
  };
}

// Ordinary life actions are public world actions rather than a story branch.
// A prior filter removed them from this exclusive hook so the normal diverse
// pool could render; however the normal pool never re-injected those actions.
// That made a bakery show INSPECT/TALK/weather while hiding a purchasable loaf.
// Preserve genuinely authored / regional-labour scenes, but when the inherited
// result is only ambient fallback, let the existing canonical-world-life
// authority win. This is route-neutral: every player at the same facility with
// the same money, inventory and permits receives the same life actions.
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
  if (lifeOverridesAmbient(runtime, actions)) return ordinaryWorldLifeActions(runtime);
  if (!Array.isArray(actions)) return actions;
  const exclusive = actions.filter((action) =>
    action?.canonicalWorldLifeChoice !== true
      && !(continuingOrdinaryWork(runtime) && action?.authoredPublicLifeNetworkChoice === true));
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
// T01 is intentionally service-owned; returning null lets service.js preserve
// its rescue/escort/reunion-specific guidance. Genuine downstream authored /
// regional guidance is preserved unchanged.
export function authoredMissionFlowGuidance(runtime, context = {}) {
  const inheritedActions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (lifeOverridesAmbient(runtime, inheritedActions)) return ordinaryLifeGuidance(runtime);
  const guidance = base.authoredMissionFlowGuidance(runtime, context);
  const lifeFallback = guidance?.title === "その土地の生活を選ぶ" && onlyCanonicalWorldLife(inheritedActions);
  if (!guidance || lifeFallback) {
    const coreGuidance = coreAuthoredMissionFlowGuidance(runtime);
    if (coreGuidance) return coreGuidance;
    if (t01Active(runtime)) return null;
  }
  return guidance;
}
