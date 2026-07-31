export const ALL_RESCUE_FINAL_WINDOW_MINUTES = 6 * 60;
export const DEFAULT_MAX_ALL_RESCUE_SIGNATURES = 6;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? "").trim();

function configuredIds(input = {}) {
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
  return {
    troubleId,
    branch: clean(branch),
    route: clean(route),
    context: clean(context),
    objectives,
    encoded: [
      troubleId,
      clean(branch) || "no-branch",
      clean(route) || "no-route",
      clean(context) || "base",
      objectives || "no-objectives",
    ].join("~"),
  };
}

export function buildAllRescueSignature(input = {}) {
  const troubleIds = configuredIds(input);
  const components = troubleIds.map((troubleId) => component(input, troubleId));
  return {
    troubleIds,
    components,
    signature: components.map((entry) => entry.encoded).join("|"),
    signedTroubleCount: components.filter((entry) => entry.branch || entry.route).length,
  };
}

export function evaluateAllRescueState(input = {}) {
  const troubleIds = configuredIds(input);
  const states = input.troubles ?? input.troubleStates ?? {};
  const resolvedSet = input.resolvedTroubleIds instanceof Set
    ? input.resolvedTroubleIds
    : new Set(input.resolvedTroubleIds ?? []);
  const resolvedTroubleIds = troubleIds.filter((id) =>
    resolvedSet.has(id) || statusOf(states, id) === "resolved");
  const missingTroubleIds = troubleIds.filter((id) => !resolvedTroubleIds.includes(id));
  const gameEndMinute = Math.max(1, finite(input.gameEndMinute, 100 * 1440));
  const finalWindowMinutes = Math.max(1,
    finite(input.finalWindowMinutes, ALL_RESCUE_FINAL_WINDOW_MINUTES));
  const earliestEligibleMinute = Math.max(0,
    finite(input.earliestEligibleMinute, gameEndMinute - finalWindowMinutes));
  const absoluteMinute = Math.max(0, finite(input.absoluteMinute));
  const allResolved = troubleIds.length > 0 && missingTroubleIds.length === 0;
  const signature = buildAllRescueSignature({ ...input, configuredTroubleIds: troubleIds });
  return {
    configuredTroubleIds: troubleIds,
    configuredTroubleCount: troubleIds.length,
    resolvedTroubleIds,
    resolvedTroubleCount: resolvedTroubleIds.length,
    missingTroubleIds,
    absoluteMinute,
    gameEndMinute,
    earliestEligibleMinute,
    finalWindowMinutes,
    allResolved,
    prematureAllRescue: allResolved && absoluteMinute < earliestEligibleMinute,
    eligibleLateFinish: allResolved
      && absoluteMinute >= earliestEligibleMinute
      && absoluteMinute <= gameEndMinute,
    afterGameEnd: allResolved && absoluteMinute > gameEndMinute,
    signature: signature.signature,
    signatureComponents: signature.components,
    signedTroubleCount: signature.signedTroubleCount,
  };
}

export function createAllRescueAudit(options = {}) {
  return {
    schemaVersion: "trpg-all-rescue-audit-v1",
    finalWindowMinutes: Math.max(1,
      finite(options.finalWindowMinutes, ALL_RESCUE_FINAL_WINDOW_MINUTES)),
    maximumAllowedSignatures: Math.max(1,
      finite(options.maximumAllowedSignatures, DEFAULT_MAX_ALL_RESCUE_SIGNATURES)),
    observations: 0,
    configuredTroubleCount: 0,
    maximumResolvedTroubleCount: 0,
    firstAllResolvedMinute: null,
    prematureAllRescueCount: 0,
    prematureSignatures: [],
    acceptedSignatures: [],
    signatureCounts: {},
    duplicateAcceptedObservations: 0,
  };
}

export function observeAllRescueState(audit, input = {}) {
  const state = evaluateAllRescueState({
    ...input,
    finalWindowMinutes: input.finalWindowMinutes ?? audit.finalWindowMinutes,
  });
  audit.observations += 1;
  audit.configuredTroubleCount = Math.max(audit.configuredTroubleCount,
    state.configuredTroubleCount);
  audit.maximumResolvedTroubleCount = Math.max(audit.maximumResolvedTroubleCount,
    state.resolvedTroubleCount);
  if (!state.allResolved) return state;
  audit.firstAllResolvedMinute = audit.firstAllResolvedMinute == null
    ? state.absoluteMinute
    : Math.min(audit.firstAllResolvedMinute, state.absoluteMinute);
  if (state.prematureAllRescue) {
    audit.prematureAllRescueCount += 1;
    if (!audit.prematureSignatures.includes(state.signature)) {
      audit.prematureSignatures.push(state.signature);
    }
  }
  if (state.eligibleLateFinish) {
    if (!audit.acceptedSignatures.includes(state.signature)) {
      audit.acceptedSignatures.push(state.signature);
    }
    audit.signatureCounts[state.signature] = finite(audit.signatureCounts[state.signature]) + 1;
    if (audit.signatureCounts[state.signature] > 1) audit.duplicateAcceptedObservations += 1;
  }
  return state;
}

export function finalizeAllRescueAudit(audit, options = {}) {
  const maximumAllowedSignatures = Math.max(1,
    finite(options.maximumAllowedSignatures, audit.maximumAllowedSignatures));
  const uniqueAcceptedSignatureCount = new Set(audit.acceptedSignatures).size;
  const routeSetWithinLimit = uniqueAcceptedSignatureCount <= maximumAllowedSignatures;
  const noPrematureAllRescue = audit.prematureAllRescueCount === 0;
  return {
    ...audit,
    maximumAllowedSignatures,
    uniqueAcceptedSignatureCount,
    routeSetWithinLimit,
    noPrematureAllRescue,
    passed: routeSetWithinLimit && noPrematureAllRescue,
  };
}
