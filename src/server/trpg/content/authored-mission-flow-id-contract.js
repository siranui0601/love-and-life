import * as base from "./authored-mission-flow-revisit.js";

export * from "./authored-mission-flow-revisit.js";

export const AUTHORED_MISSION_REVISIT_ID_CONTRACT_VERSION = "authored-mission-revisit-id-contract-v1";
export const AUTHORED_MISSION_ACTION_ID_MAX_LENGTH = 120;

const { shortHash } = base.AUTHORED_MISSION_REVISIT_INTERNALS;

function compactRevisitAction(action) {
  if (!action?.authoredMissionRevisit) return action;
  const consequence = action.authoredMissionRevisitConsequence ?? {};
  const signature = action.authoredMissionChoiceSetSignature
    ?? consequence.signature
    ?? action.authoredMissionRevisitTargetAction?.id
    ?? action.id;
  const ordinal = Number(action.authoredMissionRevisitOrdinal ?? consequence.ordinal ?? 0);
  const kind = [
    action.authoredMissionRevisitKind ?? "revisit",
    action.authoredMissionRevisitStage ?? "none",
    action.authoredMissionRevisitVariant ?? "none",
  ].join(":");
  const target = action.authoredMissionFlowLeadId
    ?? action.authoredMissionFlowNavigatorGroupId
    ?? action.authoredMissionFlowNavigatorFocusId
    ?? action.authoredMissionRevisitEvidenceLeadId
    ?? action.authoredMissionRevisitTargetAction?.id
    ?? "none";
  const consequenceKey = consequence.consequenceKey ?? consequence.key ?? "none";
  const id = [
    "MISSION_FLOW:T13:RV",
    shortHash(signature),
    ordinal,
    shortHash(kind),
    shortHash(target),
    shortHash(consequenceKey),
  ].join(":");
  if (id.length > AUTHORED_MISSION_ACTION_ID_MAX_LENGTH) {
    throw new Error(`Authored revisit action id exceeds ${AUTHORED_MISSION_ACTION_ID_MAX_LENGTH}: ${id}`);
  }
  return { ...action, id };
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  return Array.isArray(actions) ? actions.map(compactRevisitAction) : actions;
}

export function authoredMissionFlowEvidenceAction(runtime) {
  return compactRevisitAction(base.authoredMissionFlowEvidenceAction(runtime));
}

export const AUTHORED_MISSION_REVISIT_ID_CONTRACT_INTERNALS = Object.freeze({
  compactRevisitAction,
});
