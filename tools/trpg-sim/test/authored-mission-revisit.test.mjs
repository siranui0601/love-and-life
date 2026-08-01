import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_REVISIT_INTERNALS,
  AUTHORED_MISSION_REVISIT_VERSION,
} from "../../../src/server/trpg/content/authored-mission-flow-revisit.js";

const {
  ensureRevisitState,
  choiceSetSignature,
  buildRevisitActions,
  annotateChoiceSet,
  consumeSignature,
  recordRevisitConsequence,
  applyFocusRedirect,
  setPendingLeadConsequence,
  pendingLeadConsequence,
  clearPendingLeadConsequence,
} = AUTHORED_MISSION_REVISIT_INTERNALS;

const FLOW_ID = "forest-king-slime-world-tree-collapse";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 1308,
      currentLocation: "田園の村",
      currentFacilityId: "LOC_FARM_WELL",
      worldFlags: {},
      history: [],
    },
    authoredMissionFlows: {
      [FLOW_ID]: {
        flowId: FLOW_ID,
        openingChoiceId: "world_tree_spirits_and_seal",
        navigatorFocusId: null,
        navigatorGroupId: null,
        selectedLeadId: null,
        selectedLeadAtMinute: null,
        evidenceIds: [],
      },
    },
  };
}

function focusActions() {
  return [
    {
      id: `MISSION_FLOW:${FLOW_ID}:NAVIGATOR_FOCUS:world_tree_and_recovery`,
      minutes: 3,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_focus",
      authoredMissionFlowNavigatorFocusId: "world_tree_and_recovery",
    },
    {
      id: `MISSION_FLOW:${FLOW_ID}:NAVIGATOR_FOCUS:growth_and_separation`,
      minutes: 3,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_focus",
      authoredMissionFlowNavigatorFocusId: "growth_and_separation",
    },
    {
      id: `MISSION_FLOW:${FLOW_ID}:NAVIGATOR_FOCUS:border_truth_and_survival`,
      minutes: 3,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_focus",
      authoredMissionFlowNavigatorFocusId: "border_truth_and_survival",
    },
  ];
}

function groupActions() {
  return [
    {
      id: `MISSION_FLOW:${FLOW_ID}:NAVIGATOR_GROUP:world_tree_seal_chain`,
      minutes: 2,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_group",
      authoredMissionFlowNavigatorGroupId: "world_tree_seal_chain",
    },
    {
      id: `MISSION_FLOW:${FLOW_ID}:NAVIGATOR_GROUP:core_and_ecosystem_recovery`,
      minutes: 2,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_group",
      authoredMissionFlowNavigatorGroupId: "core_and_ecosystem_recovery",
    },
    {
      id: `MISSION_FLOW:${FLOW_ID}:NAVIGATOR_BACK:world_tree_and_recovery`,
      minutes: 1,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_back",
      authoredMissionFlowNavigatorFocusId: "world_tree_and_recovery",
    },
  ];
}

function routeActions() {
  return [
    {
      id: `MISSION_FLOW:${FLOW_ID}:NAVIGATOR_ROUTE:core_and_ecosystem_recovery:mina_slime_core_containment`,
      minutes: 2,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_route",
      authoredMissionFlowNavigatorGroupId: "core_and_ecosystem_recovery",
      authoredMissionFlowLeadId: "mina_slime_core_containment",
    },
    {
      id: `MISSION_FLOW:${FLOW_ID}:NAVIGATOR_ROUTE_BACK:core_and_ecosystem_recovery`,
      minutes: 1,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_route_back",
      authoredMissionFlowNavigatorGroupId: "core_and_ecosystem_recovery",
    },
    {
      id: `MISSION_FLOW:${FLOW_ID}:DEFER:defer`,
      minutes: 1,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "defer",
    },
  ];
}

test("first presentation keeps canonical actions and only records a stable signature", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const actions = focusActions();
  const signature = choiceSetSignature(actions);
  const annotated = annotateChoiceSet(actions, signature);
  const revisit = ensureRevisitState(flow);

  assert.equal(revisit.version, AUTHORED_MISSION_REVISIT_VERSION);
  assert.deepEqual(annotated.map((action) => action.id), actions.map((action) => action.id));
  assert.ok(annotated.every((action) => action.authoredMissionChoiceSetSignature === signature));
  assert.deepEqual(revisit.consumedChoiceSetSignatures, []);
});

test("a consumed T13 focus set becomes three authored consequence scenes", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const actions = focusActions();
  const signature = choiceSetSignature(actions);
  assert.equal(consumeSignature(flow, signature), true);

  const revisited = buildRevisitActions(flow, actions, signature);

  assert.equal(revisited.length, 3);
  assert.ok(revisited.every((action) => action.authoredMissionRevisit));
  assert.ok(revisited.every((action) => !actions.some((oldAction) => oldAction.id === action.id)));
  assert.ok(revisited.every((action) => action.minutes > 3));
  assert.match(revisited[0].label, /流された|移された|噂/u);
  assert.equal(new Set(revisited.map((action) => action.id)).size, 3);
});

test("group and route revisits remove back/defer loops without deleting canonical forward paths", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  flow.navigatorFocusId = "world_tree_and_recovery";

  const groupSet = groupActions();
  const groupRevisit = buildRevisitActions(flow, groupSet, choiceSetSignature(groupSet));
  assert.equal(groupRevisit.length, 3);
  assert.ok(groupRevisit.some((action) =>
    action.authoredMissionFlowNavigatorGroupId === "world_tree_seal_chain"));
  assert.ok(groupRevisit.some((action) =>
    action.authoredMissionFlowNavigatorGroupId === "core_and_ecosystem_recovery"));
  assert.ok(groupRevisit.every((action) =>
    !["navigator_back", "defer"].includes(action.authoredMissionFlowKind)));

  flow.navigatorGroupId = "core_and_ecosystem_recovery";
  const routeSet = routeActions();
  const routeRevisit = buildRevisitActions(flow, routeSet, choiceSetSignature(routeSet));
  assert.equal(routeRevisit.length, 3);
  assert.ok(routeRevisit.some((action) =>
    action.authoredMissionFlowLeadId === "mina_slime_core_containment"));
  assert.ok(routeRevisit.every((action) =>
    !["navigator_route_back", "defer"].includes(action.authoredMissionFlowKind)));
});

test("choosing a revisit changes time-bearing world state and persists the moved evidence context", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const actions = routeActions();
  const signature = choiceSetSignature(actions);
  consumeSignature(flow, signature);
  const revisitAction = buildRevisitActions(flow, actions, signature)
    .find((action) => action.authoredMissionFlowLeadId === "mina_slime_core_containment");

  const copy = revisitAction.authoredMissionRevisitConsequence;
  const record = recordRevisitConsequence(state, flow, revisitAction, copy);
  setPendingLeadConsequence(flow, "mina_slime_core_containment", revisitAction, copy);

  assert.equal(record.minute, 1308);
  assert.equal(record.location, "田園の村");
  assert.equal(state.playerState.worldFlags.t13RevisitCount, 1);
  assert.equal(state.playerState.worldFlags["t13Revisit:core_cage_cracked"], true);
  assert.equal(state.playerState.history.at(-1).type, "AUTHORED_MISSION_REVISIT_CONSEQUENCE");
  assert.equal(pendingLeadConsequence(flow, "mina_slime_core_containment").consequenceKey, "core_cage_cracked");
  clearPendingLeadConsequence(flow, "mina_slime_core_containment");
  assert.equal(pendingLeadConsequence(flow, "mina_slime_core_containment"), null);
});

test("a consequence redirect moves to a different focus while preserving every evidence route", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  flow.navigatorFocusId = "world_tree_and_recovery";
  flow.navigatorGroupId = "core_and_ecosystem_recovery";
  flow.selectedLeadId = "mina_slime_core_containment";
  flow.deferredUntilMinute = 9999;
  const action = {
    authoredMissionFlowNavigatorFocusId: "border_truth_and_survival",
  };

  assert.equal(applyFocusRedirect(flow, action), true);
  assert.equal(flow.navigatorFocusId, "border_truth_and_survival");
  assert.equal(flow.navigatorGroupId, null);
  assert.equal(flow.selectedLeadId, null);
  assert.equal(flow.deferredUntilMinute, null);
  assert.deepEqual(flow.evidenceIds, []);
});
