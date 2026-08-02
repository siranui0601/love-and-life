import { T17_CAPITAL_SECOND_SUMMONING_PACK as P } from "./authored/missions/t17-capital-second-summoning.js";
import * as state from "./authored-mission-flow-t17-runtime-state.js";

export * from "./authored-mission-flow-t17-runtime-state.js";

const {
  step,
  sourceAt,
  leadById,
  resolvedLead,
  ensure17,
  actionId,
  deferAction,
} = state.T17_RUNTIME_STATE_INTERNALS;

function openingActions(runtime) {
  const flow = ensure17(runtime);
  const source = sourceAt(runtime);
  const current = step(runtime);
  if (flow.openingChoiceId || !source
    || ![P.hearing.stepId, P.investigation.stepId].includes(current?.id)) return null;
  const actions = source.choices.map((entry) => {
    const opening = P.hearing.choices.find((choiceEntry) => choiceEntry.id === entry.choiceId);
    return {
      id: `${P.id}:OPENING_SOURCE:${source.id}:${opening.id}`,
      family: "investigate",
      type: "plan",
      effectKind: "inspect_authored_mission_introduction_source",
      missionId: P.missionId,
      stepId: P.hearing.stepId,
      missionTitle: P.title,
      missionTroubleId: P.troubleId,
      targetNpcId: null,
      label: entry.label,
      playerUtterance: opening.playerUtterance,
      requiredDisclosure: entry.requiredDisclosure,
      minutes: entry.minutes,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "opening",
      authoredMissionFlowChoiceId: opening.id,
      authoredMissionFlowFactId: opening.factId,
      authoredMissionFlowUnlockedLeadIds: [...opening.unlockedLeadIds],
      authoredMissionFlowOpeningSourceId: source.id,
      authoredMissionFlowSceneTransition: entry.sceneTransition,
    };
  });
  return actions.length === 3 ? actions : null;
}

function navigatorFocuses() {
  return P.investigation.focuses.map((focus) => ({
    ...focus,
    groups: focus.groups.map((group) => ({
      ...group,
      evidenceIds: [...P.investigation.requiredEvidenceGroups[group.evidenceGroupIndex]],
    })),
  }));
}

function acceptedGroupIds(flow) {
  return new Set(Array.isArray(flow?.acceptedEvidenceGroupIds)
    ? flow.acceptedEvidenceGroupIds
    : []);
}

function groupNeedsEvidence(group, acquired, accepted = new Set()) {
  return !accepted.has(group.id)
    && group.evidenceIds.some((id) => !acquired.has(id));
}

function focusActions(flow) {
  const acquired = new Set(flow.evidenceIds);
  const accepted = acceptedGroupIds(flow);
  const preferred = P.hearing.choices.find((opening) =>
    opening.id === flow.openingChoiceId)?.preferredFocusId;
  const actions = navigatorFocuses()
    .filter((focus) => focus.groups.some((group) =>
      groupNeedsEvidence(group, acquired, accepted)))
    .map((focus) => ({
      id: actionId("NAVIGATOR_FOCUS", focus.id),
      family: "prepare",
      type: "plan",
      minutes: focus.minutes ?? 3,
      label: focus.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "navigator_focus",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowSceneTransition: focus.sceneTransition,
    }))
    .sort((left, right) =>
      Number(right.authoredMissionFlowNavigatorFocusId === preferred)
      - Number(left.authoredMissionFlowNavigatorFocusId === preferred));
  if (actions.length < 3) actions.push(deferAction());
  return actions.slice(0, 3).length === 3 ? actions.slice(0, 3) : null;
}

function groupActions(flow) {
  const focus = navigatorFocuses().find((entry) => entry.id === flow.navigatorFocusId);
  const acquired = new Set(flow.evidenceIds);
  const accepted = acceptedGroupIds(flow);
  if (!focus) return null;
  const actions = focus.groups
    .filter((group) => groupNeedsEvidence(group, acquired, accepted))
    .map((group) => ({
      id: actionId("NAVIGATOR_GROUP", group.id),
      family: "prepare",
      type: "plan",
      minutes: 2,
      label: group.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "navigator_group",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowNavigatorGroupId: group.id,
    }));
  actions.push({
    id: actionId("NAVIGATOR_BACK", focus.id),
    family: "prepare",
    type: "plan",
    minutes: 1,
    label: "三つの調査方針へ戻る",
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: P.id,
    authoredMissionFlowKind: "navigator_back",
  });
  if (actions.length < 3) actions.push(deferAction());
  return actions.slice(0, 3);
}

function routeActions(flow) {
  const focus = navigatorFocuses().find((entry) => entry.id === flow.navigatorFocusId);
  const group = focus?.groups.find((entry) => entry.id === flow.navigatorGroupId);
  const acquired = new Set(flow.evidenceIds);
  const accepted = acceptedGroupIds(flow);
  if (!group || !groupNeedsEvidence(group, acquired, accepted)) return null;
  const actions = group.evidenceIds
    .filter((id) => !acquired.has(id))
    .map((id) => P.investigation.leads.find((lead) => lead.discoveryId === id))
    .filter(Boolean)
    .map((lead) => ({
      id: actionId("NAVIGATOR_ROUTE", lead.id),
      family: "prepare",
      type: "plan",
      minutes: 3,
      label: lead.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "navigator_route",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowNavigatorGroupId: group.id,
      authoredMissionFlowLeadId: lead.id,
      authoredMissionFlowTargetFacilityId: lead.facilityId,
      authoredMissionFlowSceneTransition: `調査の視点が${lead.destinationName}へ移る`,
    }));
  const hasExistingProof = group.evidenceIds.some((id) => acquired.has(id));
  if (actions.length < 3 && hasExistingProof) {
    actions.push({
      id: actionId("NAVIGATOR_ACCEPT", group.id),
      family: "prepare",
      type: "plan",
      minutes: 4,
      label: "現在の証拠でこの因果線を確定し、別の分類へ進む",
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "navigator_accept_group",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowNavigatorGroupId: group.id,
      authoredMissionFlowSceneTransition: `${group.label}は現在の証拠で確定され、調査は別の因果線へ移る`,
    });
  }
  if (actions.length < 3) {
    actions.push({
      id: actionId("ABANDON_INVESTIGATION", group.id),
      family: "leave",
      type: "plan",
      minutes: 5,
      label: "この調査線を捨て、第二召喚の阻止から手を引く",
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "abandon_investigation",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowNavigatorGroupId: group.id,
    });
  }
  return actions.slice(0, 3);
}

function evidenceAction(runtime, lead) {
  const resolved = resolvedLead(runtime, lead);
  const flow = ensure17(runtime);
  if (runtime?.playerState?.player?.facilityId !== resolved.facilityId
    || flow.evidenceIds.includes(lead.discoveryId)) return null;
  return {
    id: actionId(resolved.sourceKind === "fallback" ? "FALLBACK_EVIDENCE" : "EVIDENCE", lead.id),
    family: "investigate",
    type: "investigate",
    missionId: P.missionId,
    stepId: P.investigation.stepId,
    missionTitle: P.title,
    missionTroubleId: P.troubleId,
    minutes: resolved.minutes,
    label: resolved.label,
    approachId: resolved.approachId,
    discoveryId: lead.discoveryId,
    discoveryText: resolved.discoveryText,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: P.id,
    authoredMissionFlowKind: "evidence",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowEvidenceId: lead.discoveryId,
    authoredMissionFlowEvidenceSourceId: resolved.sourceId,
  };
}

function selectedLeadActions(runtime, flow, movementActions = []) {
  const lead = leadById(flow.selectedLeadId);
  if (!lead) return null;
  const resolved = resolvedLead(runtime, lead);
  const evidence = evidenceAction(runtime, lead);
  const currentHub = runtime.playerState.player.location;
  const exactLocal = movementActions.find((action) =>
    action?.movementScope === "local"
      && action.destinationFacilityId === resolved.facilityId);
  const regional = resolved.targetLocation !== currentHub
    ? movementActions.find((action) =>
      action?.movementScope === "regional"
        && action.destinationHub === resolved.targetLocation)
    : null;
  const movement = exactLocal ?? regional;
  const primary = evidence ?? (movement ? {
    ...movement,
    id: actionId(regional === movement ? "LEAD_HUB" : "LEAD", lead.id),
    label: `${resolved.targetLocation !== currentHub
      ? `${resolved.targetLocation}へ向かい、`
      : `${resolved.destinationName}へ向かい、`}${resolved.label}`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: P.id,
    authoredMissionFlowKind: "lead",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowTargetFacilityId: resolved.facilityId,
    authoredMissionFlowEvidenceSourceId: resolved.sourceId,
  } : null);
  const actions = [
    primary,
    {
      id: actionId("RECONSIDER", lead.id),
      family: "prepare",
      type: "plan",
      minutes: 4,
      label: "この経路を戻し、別の証拠分類を選ぶ",
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "reconsider_lead",
    },
    deferAction(),
  ].filter(Boolean);
  return actions.length === 3 ? actions : null;
}

export const T17_RUNTIME_NAVIGATION_INTERNALS = Object.freeze({
  openingActions,
  navigatorFocuses,
  acceptedGroupIds,
  groupNeedsEvidence,
  focusActions,
  groupActions,
  routeActions,
  evidenceAction,
  selectedLeadActions,
});
