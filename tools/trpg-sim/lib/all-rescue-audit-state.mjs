import {
  ALL_RESCUE_FINAL_WINDOW_MINUTES,
  DEFAULT_MAX_ALL_RESCUE_SIGNATURES,
  buildAllRescueSignature,
  configuredIds,
  evaluateRescueOutcomes,
  finite,
} from "./all-rescue-audit-core.mjs";
import { evaluateRescueWeave } from "./all-rescue-audit-weave.mjs";

export function evaluateAllRescueState(input = {}) {
  const troubleIds = configuredIds(input);
  const outcomes = evaluateRescueOutcomes(input, troubleIds);
  const gameEndMinute = Math.max(1, finite(input.gameEndMinute, 100 * 1440));
  const finalWindowMinutes = Math.max(1,
    finite(input.finalWindowMinutes, ALL_RESCUE_FINAL_WINDOW_MINUTES));
  const earliestEligibleMinute = Math.max(0,
    finite(input.earliestEligibleMinute, gameEndMinute - finalWindowMinutes));
  const absoluteMinute = Math.max(0, finite(input.absoluteMinute));
  const allRescued = troubleIds.length > 0 && outcomes.missingTroubleIds.length === 0;
  const requireRescueWeave = input.requireRescueWeave !== false;
  const rescueWeave = evaluateRescueWeave({
    ...input,
    configuredTroubleIds: troubleIds,
    gameEndMinute,
    finalWindowMinutes,
  });
  const weaveReady = !requireRescueWeave || rescueWeave.ready;
  const signature = buildAllRescueSignature({ ...input, configuredTroubleIds: troubleIds });
  return {
    configuredTroubleIds: troubleIds,
    configuredTroubleCount: troubleIds.length,
    resolvedTroubleIds: outcomes.rescuedTroubleIds,
    rescuedTroubleIds: outcomes.rescuedTroubleIds,
    preventedTroubleIds: outcomes.preventedTroubleIds,
    resolvedTroubleCount: outcomes.rescuedTroubleIds.length,
    rescuedTroubleCount: outcomes.rescuedTroubleIds.length,
    missingTroubleIds: outcomes.missingTroubleIds,
    preventionResults: outcomes.preventionResults,
    absoluteMinute,
    gameEndMinute,
    earliestEligibleMinute,
    finalWindowMinutes,
    allResolved: allRescued,
    allRescued,
    requireRescueWeave,
    rescueWeave,
    weaveReady,
    prematureAllRescue: allRescued && absoluteMinute < earliestEligibleMinute,
    eligibleLateFinish: allRescued
      && weaveReady
      && absoluteMinute >= earliestEligibleMinute
      && absoluteMinute <= gameEndMinute,
    afterGameEnd: allRescued && absoluteMinute > gameEndMinute,
    signature: signature.signature,
    signatureComponents: signature.components,
    signedTroubleCount: signature.signedTroubleCount,
  };
}

export function createAllRescueAudit(options = {}) {
  return {
    schemaVersion: "trpg-all-rescue-audit-v2",
    finalWindowMinutes: Math.max(1,
      finite(options.finalWindowMinutes, ALL_RESCUE_FINAL_WINDOW_MINUTES)),
    maximumAllowedSignatures: Math.max(1,
      finite(options.maximumAllowedSignatures, DEFAULT_MAX_ALL_RESCUE_SIGNATURES)),
    requireRescueWeave: options.requireRescueWeave !== false,
    observations: 0,
    configuredTroubleCount: 0,
    maximumResolvedTroubleCount: 0,
    maximumRescuedTroubleCount: 0,
    firstAllResolvedMinute: null,
    prematureAllRescueCount: 0,
    incompleteWeaveCount: 0,
    prematureSignatures: [],
    incompleteWeaveSignatures: [],
    acceptedSignatures: [],
    signatureCounts: {},
    duplicateAcceptedObservations: 0,
  };
}

export function observeAllRescueState(audit, input = {}) {
  const state = evaluateAllRescueState({
    ...input,
    finalWindowMinutes: input.finalWindowMinutes ?? audit.finalWindowMinutes,
    requireRescueWeave: input.requireRescueWeave ?? audit.requireRescueWeave,
  });
  audit.observations += 1;
  audit.configuredTroubleCount = Math.max(audit.configuredTroubleCount,
    state.configuredTroubleCount);
  audit.maximumResolvedTroubleCount = Math.max(audit.maximumResolvedTroubleCount,
    state.resolvedTroubleCount);
  audit.maximumRescuedTroubleCount = Math.max(audit.maximumRescuedTroubleCount,
    state.rescuedTroubleCount);
  if (!state.allRescued) return state;
  audit.firstAllResolvedMinute = audit.firstAllResolvedMinute == null
    ? state.absoluteMinute
    : Math.min(audit.firstAllResolvedMinute, state.absoluteMinute);
  if (state.prematureAllRescue) {
    audit.prematureAllRescueCount += 1;
    if (!audit.prematureSignatures.includes(state.signature)) {
      audit.prematureSignatures.push(state.signature);
    }
  }
  if (!state.weaveReady) {
    audit.incompleteWeaveCount += 1;
    if (!audit.incompleteWeaveSignatures.includes(state.signature)) {
      audit.incompleteWeaveSignatures.push(state.signature);
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
  const noIncompleteWeaveAcceptance = audit.incompleteWeaveCount === 0;
  return {
    ...audit,
    maximumAllowedSignatures,
    uniqueAcceptedSignatureCount,
    routeSetWithinLimit,
    noPrematureAllRescue,
    noIncompleteWeaveAcceptance,
    passed: routeSetWithinLimit && noPrematureAllRescue && noIncompleteWeaveAcceptance,
  };
}
