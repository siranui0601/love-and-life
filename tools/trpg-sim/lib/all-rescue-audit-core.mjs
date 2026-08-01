export const ALL_RESCUE_FINAL_WINDOW_MINUTES = 6 * 60;
export const DEFAULT_MAX_ALL_RESCUE_SIGNATURES = 6;
export const ALL_RESCUE_WEAVE_VERSION = "trpg-all-rescue-weave-v2";
export const REQUIRED_RESCUE_STRANDS = Object.freeze([
  "early-survival",
  "cross-region-trust",
  "infrastructure-preserved",
  "capital-stability",
  "late-defense",
  "final-convergence",
]);
export const REQUIRED_ACTION_FAMILIES = Object.freeze([
  "choice",
  "movement",
  "economy",
  "investigation",
  "diplomacy",
  "battle-or-intervention",
]);

export const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? "").trim();
const list = (value) => value instanceof Set ? [...value] : Array.isArray(value) ? value : [];

export function configuredIds(input = {}) {
  if (Array.isArray(input.configuredTroubleIds) && input.configuredTroubleIds.length) {
    return [...new Set(input.configuredTroubleIds.map(String).filter(Boolean))].sort();
  }
  const model = input.troubleById ?? input.model?.troubleById;
  if (model && typeof model === "object") return Object.keys(model).sort();
  const states = input.troubles ?? input.troubleStates;
  return states && typeof states === "object" ? Object.keys(states).sort() : [];
}

function statusOf(states, troubleId) {
  const state = states?.[troubleId];
  return typeof state === "string" ? state : state?.status;
}

function flagAt(input, key) {
  const flags = input.worldFlags ?? {};
  const semantic = input.narrativeMemory?.semanticFlags ?? input.semanticFlags ?? {};
  return flags[key] ?? semantic[key];
}

function proofFor(input, troubleId) {
  return input.preventionProofs?.[troubleId]
    ?? input.rescueOutcomes?.[troubleId]
    ?? null;
}

function component(input, troubleId) {
  const lower = troubleId.toLowerCase();
  const flags = input.worldFlags ?? {};
  const flows = input.authoredMissionFlows ?? {};
  const flow = Object.values(flows).find((entry) => entry?.troubleId === troubleId
    || entry?.flowId === troubleId
    || clean(entry?.flowId).toLowerCase().includes(lower));
  const branch = input.resolutionBranches?.[troubleId]
    ?? flags[`${lower}ResolutionBranch`]
    ?? flow?.resolutionBranchId;
  const route = input.resolutionRoutes?.[troubleId]
    ?? flags[`${lower}ResolutionRoute`]
    ?? flow?.selectedResolutionRouteId;
  const context = input.resolutionContexts?.[troubleId]
    ?? flags[`${lower}ResolutionContext`]
    ?? flow?.selectedResolutionContextId;
  const objectiveMap = input.missionBattleObjectives?.[troubleId]
    ?? flags.missionBattleObjectives?.[`MSN-${troubleId}`];
  const objectives = objectiveMap && typeof objectiveMap === "object"
    ? Object.entries(objectiveMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([id, status]) => `${id}:${status}`).join(",")
    : "";
  const prevention = proofFor(input, troubleId);
  const preventionSignature = prevention
    ? [
        clean(prevention.kind) || "prevented",
        ...list(prevention.causeTroubleIds).map(String).sort(),
        ...list(prevention.requiredWorldFlags).map(String).sort(),
        clean(prevention.branchId),
      ].filter(Boolean).join(",")
    : "";
  return {
    troubleId,
    branch: clean(branch),
    route: clean(route),
    context: clean(context),
    objectives,
    prevention: preventionSignature,
    encoded: [
      troubleId,
      clean(branch) || "no-branch",
      clean(route) || "no-route",
      clean(context) || "base",
      objectives || "no-objectives",
      preventionSignature || "not-prevented",
    ].join("~"),
  };
}

export function buildAllRescueSignature(input = {}) {
  const troubleIds = configuredIds(input);
  const components = troubleIds.map((troubleId) => component(input, troubleId));
  const weaveId = clean(input.rescueWeave?.routeId) || "no-weave-route";
  return {
    troubleIds,
    components,
    signature: `${components.map((entry) => entry.encoded).join("|")}|WEAVE~${weaveId}`,
    signedTroubleCount: components.filter((entry) =>
      entry.branch || entry.route || entry.prevention).length,
  };
}

function validatePrevention(input, troubleId, rescuedSet) {
  const states = input.troubles ?? input.troubleStates ?? {};
  const status = statusOf(states, troubleId);
  const proof = proofFor(input, troubleId);
  if (!proof || !["prevented", "suppressed", "averted"].includes(clean(proof.kind))) {
    return { valid: false, reason: "missing-explicit-prevention-proof" };
  }
  if (!["suppressed", "prevented", "resolved"].includes(status)
    && !list(input.preventedTroubleIds).map(String).includes(troubleId)) {
    return { valid: false, reason: "trouble-state-not-prevented" };
  }
  const causes = list(proof.causeTroubleIds).map(String);
  if (!causes.length) return { valid: false, reason: "prevention-has-no-cause" };
  const missingCauses = causes.filter((id) => !rescuedSet.has(id));
  if (missingCauses.length) {
    return { valid: false, reason: "prevention-cause-not-rescued", missingCauses };
  }
  const requiredFlags = list(proof.requiredWorldFlags).map(String);
  const missingFlags = requiredFlags.filter((key) => !flagAt(input, key));
  if (missingFlags.length) {
    return { valid: false, reason: "prevention-proof-flag-missing", missingFlags };
  }
  if (["T18", "T19"].includes(troubleId) && !causes.includes("T13")) {
    return { valid: false, reason: "late-crisis-prevention-must-cite-t13" };
  }
  if (troubleId === "T19"
    && !requiredFlags.some((key) => key === "t19PeaceContingencyPrepared"
      || key === "trouble.T19.peaceContingencyPrepared")) {
    return { valid: false, reason: "t19-prevention-requires-peace-contingency" };
  }
  return { valid: true, proof };
}

export function evaluateRescueOutcomes(input, troubleIds) {
  const states = input.troubles ?? input.troubleStates ?? {};
  const explicitResolved = input.resolvedTroubleIds instanceof Set
    ? input.resolvedTroubleIds
    : new Set(input.resolvedTroubleIds ?? []);
  const rescuedSet = new Set(troubleIds.filter((id) =>
    explicitResolved.has(id) || statusOf(states, id) === "resolved"));
  const preventionResults = {};
  let changed = true;
  while (changed) {
    changed = false;
    for (const troubleId of troubleIds) {
      if (rescuedSet.has(troubleId)) continue;
      const result = validatePrevention(input, troubleId, rescuedSet);
      preventionResults[troubleId] = result;
      if (result.valid) {
        rescuedSet.add(troubleId);
        changed = true;
      }
    }
  }
  for (const troubleId of troubleIds) {
    if (!rescuedSet.has(troubleId)) {
      preventionResults[troubleId] = validatePrevention(input, troubleId, rescuedSet);
    }
  }
  return {
    rescuedTroubleIds: troubleIds.filter((id) => rescuedSet.has(id)),
    preventedTroubleIds: troubleIds.filter((id) =>
      rescuedSet.has(id) && statusOf(states, id) !== "resolved"),
    missingTroubleIds: troubleIds.filter((id) => !rescuedSet.has(id)),
    preventionResults,
  };
}
