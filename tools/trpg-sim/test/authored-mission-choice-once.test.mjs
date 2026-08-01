import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_CHOICE_ONCE_INTERNALS,
  AUTHORED_MISSION_CHOICE_ONCE_VERSION,
} from "../../../src/server/trpg/content/authored-mission-flow-once.js";

const {
  ensureOnceState,
  transformedControl,
  guardExclusiveActions,
  applyOneShotConsequence,
} = AUTHORED_MISSION_CHOICE_ONCE_INTERNALS;

function runtime() {
  return {
    playerState: {
      absoluteMinute: 4321,
      history: [],
      worldFlags: {},
    },
    authoredMissionFlows: {
      "sample-flow": {
        flowId: "sample-flow",
        openingChoiceId: "opening-a",
        navigatorFocusId: "focus-a",
        navigatorGroupId: "group-a",
        selectedLeadId: "lead-a",
        evidenceIds: [],
      },
    },
  };
}

function choices() {
  return [
    {
      id: "MISSION_FLOW:sample-flow:NAVIGATOR_ROUTE:lead-a",
      type: "plan",
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: "sample-flow",
      authoredMissionFlowKind: "navigator_route",
      authoredMissionFlowLeadId: "lead-a",
    },
    {
      id: "MISSION_FLOW:sample-flow:RECONSIDER:lead-a",
      type: "plan",
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: "sample-flow",
      authoredMissionFlowKind: "reconsider_lead",
      authoredMissionFlowLeadId: "lead-a",
    },
    {
      id: "MISSION_FLOW:sample-flow:DEFER:sample-flow",
      type: "plan",
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: "sample-flow",
      authoredMissionFlowKind: "defer",
    },
  ];
}

test("backtracking controls become irreversible branch losses", () => {
  const flow = runtime().authoredMissionFlows["sample-flow"];
  const reconsider = transformedControl(choices()[1], flow);
  const defer = transformedControl(choices()[2], flow);

  assert.equal(reconsider.authoredMissionFlowKind, "one_shot_abandon_lead");
  assert.match(reconsider.label, /機会を手放し/u);
  assert.equal(defer.authoredMissionFlowKind, "one_shot_withdraw");
  assert.match(defer.label, /事件から手を引き/u);
});

test("a repeated authored choice set is replaced by a different consequence set", () => {
  const state = runtime();
  const first = guardExclusiveActions(state, choices());
  assert.equal(first.length, 3);
  const setId = first[0].authoredMissionFlowChoiceSetId;
  assert.ok(setId);
  assert.ok(first.every((choice) => choice.authoredMissionFlowChoiceSetId === setId));

  const once = ensureOnceState(state.authoredMissionFlows["sample-flow"]);
  once.consumedChoiceSetIds.push(setId);
  const countBeforeRead = once.repeatedSetFallbackCount;
  const second = guardExclusiveActions(state, choices());

  assert.deepEqual(
    second.map((choice) => choice.authoredMissionFlowKind),
    ["one_shot_publish_partial", "one_shot_delegate", "one_shot_withdraw"],
  );
  assert.ok(second.every((choice) => choice.authoredMissionFlowRepeatedChoiceSetId === setId));
  assert.notDeepEqual(
    second.map((choice) => choice.id),
    first.map((choice) => choice.id),
    "the complete three-choice encounter must change even when one consequence remains possible",
  );
  assert.ok(second.filter((choice) => !first.some((oldChoice) => oldChoice.id === choice.id)).length >= 2);
  assert.equal(once.repeatedSetFallbackCount, countBeforeRead, "reading choices must not mutate the save");
});

test("abandoning a lead permanently removes it from the flow", () => {
  const state = runtime();
  const first = guardExclusiveActions(state, choices());
  const action = first.find((choice) => choice.authoredMissionFlowKind === "one_shot_abandon_lead");
  const result = { ok: true };

  assert.equal(applyOneShotConsequence(state, action, result), true);
  const flow = state.authoredMissionFlows["sample-flow"];
  const once = ensureOnceState(flow);
  assert.equal(once.version, AUTHORED_MISSION_CHOICE_ONCE_VERSION);
  assert.deepEqual(once.abandonedLeadIds, ["lead-a"]);
  assert.equal(flow.selectedLeadId, null);
  assert.equal(flow.navigatorGroupId, null);
  assert.match(result.summary, /同じ人物、同じ現場、同じ三択はもう戻らない/u);
});

test("repeat fallback count changes only when a consequence is chosen", () => {
  const state = runtime();
  const first = guardExclusiveActions(state, choices());
  const setId = first[0].authoredMissionFlowChoiceSetId;
  const once = ensureOnceState(state.authoredMissionFlows["sample-flow"]);
  once.consumedChoiceSetIds.push(setId);
  const repeated = guardExclusiveActions(state, choices());
  const action = repeated.find((choice) => choice.authoredMissionFlowKind === "one_shot_delegate");
  const result = { ok: true };

  assert.equal(once.repeatedSetFallbackCount, 0);
  assert.equal(applyOneShotConsequence(state, action, result), true);
  assert.equal(once.repeatedSetFallbackCount, 1);
  assert.equal(once.delegatedAtMinute, 4321);
  assert.equal(state.playerState.worldFlags["authoredMissionDelegated:sample-flow"], true);
  assert.ok(state.playerState.history.some((entry) =>
    entry.type === "AUTHORED_MISSION_CHOICE_SET_REPEAT_BLOCKED"));
});
