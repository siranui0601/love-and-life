import * as base from "./authored-mission-t03-day8-onset.js";

export * from "./authored-mission-t03-day8-onset.js";

export const AUTHORED_MISSION_T03_LOCAL_LIFE_VERSION = "authored-mission-t03-local-life-v1";

const FLOW_ID = "red-fang-migration";
const MISSION_ID = "MSN-T03";
const TROUBLE_ID = "T03";
const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);
const ACTIVE_TROUBLE_STATUSES = new Set(["active", "critical"]);

function missionById(runtime, missionId) {
  const missions = runtime?.playerState?.missions;
  if (Array.isArray(missions)) return missions.find((mission) => mission?.id === missionId) ?? null;
  if (missions instanceof Map) return missions.get(missionId) ?? null;
  return missions?.[missionId] ?? null;
}

function isT03InvestigationPanel(actions) {
  return Array.isArray(actions)
    && actions.length > 0
    && actions.every((action) => {
      const id = String(action?.actionId ?? action?.id ?? "");
      return id.startsWith(`MISSION_FLOW:${FLOW_ID}:LEAD:`)
        || id.startsWith(`MISSION_FLOW:${FLOW_ID}:LEAD_HUB:`)
        || id === `MISSION_FLOW:${FLOW_ID}:PREMATURE:act_too_soon`
        || id === `MISSION_FLOW:${FLOW_ID}:DEFER:defer`;
    });
}

function t03Investigating(runtime) {
  return ACTIVE_MISSION_STATUSES.has(String(missionById(runtime, MISSION_ID)?.status ?? ""))
    && ACTIVE_TROUBLE_STATUSES.has(String(runtime?.playerState?.troubles?.[TROUBLE_ID]?.status ?? ""));
}

// T03 spans several ordinary village blocks. The canonical Day8 ledger
// explicitly returns to the bakery for meals between investigation leads, so a
// remote-lead panel must not make a real local product inaccessible. Replace
// the panel only while an executable product exists at the current facility;
// at every other facility the authored investigation remains authoritative.
function localCanonicalProductsBesideT03(runtime, actions) {
  if (!t03Investigating(runtime) || !isT03InvestigationPanel(actions)) return actions;
  const products = base.CANONICAL_WORLD_LIFE_INTERNALS?.productActions?.(runtime) ?? [];
  return Array.isArray(products) && products.length > 0 ? products : actions;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  return localCanonicalProductsBesideT03(runtime, actions);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, selected, result) {
  return base.applyAuthoredMissionFlowAction(runtime, selected, result);
}

export const AUTHORED_MISSION_T03_LOCAL_LIFE_INTERNALS = Object.freeze({
  FLOW_ID,
  MISSION_ID,
  TROUBLE_ID,
  missionById,
  isT03InvestigationPanel,
  t03Investigating,
  localCanonicalProductsBesideT03,
});
