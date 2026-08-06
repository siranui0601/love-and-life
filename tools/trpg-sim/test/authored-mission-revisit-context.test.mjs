import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_REVISIT_CONTEXT_INTERNALS,
  AUTHORED_MISSION_REVISIT_CONTEXT_VERSION,
} from "../../../src/server/trpg/content/authored-mission-flow-revisit-context.js";

const {
  ensureContextState,
  contextFingerprint,
  sceneKeyForAction,
  filterContextRevisitActions,
  consumeContextScene,
  targetUseCount,
  recordTerminalEnding,
  directInvestigationEnded,
} = AUTHORED_MISSION_REVISIT_CONTEXT_INTERNALS;

const FLOW_ID = "forest-king-slime-world-tree-collapse";
const MISSION_ID = "MSN-T13";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 2880,
      player: {
        location: "エルフの隠れ里",
        facilityId: "LOC_FOREST_EDGE",
      },
      missions: {
        [MISSION_ID]: {
          progress: {
            "MSN-T13-HEAR": 1,
            "MSN-T13-INVESTIGATE": 1,
          },
        },
      },
      troubles: {
        T13: { status: "active" },
      },
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
        evidenceIds: ["T13-EV-SEAL-CHAIN"],
      },
    },
  };
}

function focusActions() {
  return [
    {
      id: "MISSION_FLOW:T13:RV:a:1:a:a:a",
      minutes: 21,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_focus",
      authoredMissionFlowNavigatorFocusId: "world_tree_and_recovery",
      authoredMissionRevisit: true,
      authoredMissionRevisitStage: "focus",
      authoredMissionRevisitVariant: 1,
      authoredMissionRevisitConsequence: {
        key: "root_pain_moved_markers",
        extraMinutes: 18,
        label: "根の痛みで移された結界標を追う",
        summary: "結界標が移された。",
      },
    },
    {
      id: "MISSION_FLOW:T13:RV:b:1:b:b:b",
      minutes: 21,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_focus",
      authoredMissionFlowNavigatorFocusId: "growth_and_separation",
      authoredMissionRevisit: true,
      authoredMissionRevisitStage: "focus",
      authoredMissionRevisitVariant: 1,
      authoredMissionRevisitConsequence: {
        key: "river_marks_rebuilt",
        extraMinutes: 18,
        label: "流された水位杭を復元する",
        summary: "水位杭が流された。",
      },
    },
    {
      id: "MISSION_FLOW:T13:RV:c:1:c:c:c",
      minutes: 23,
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_focus",
      authoredMissionFlowNavigatorFocusId: "border_truth_and_survival",
      authoredMissionRevisit: true,
      authoredMissionRevisitStage: "focus",
      authoredMissionRevisitVariant: 1,
      authoredMissionRevisitConsequence: {
        key: "water_rumor_spread",
        extraMinutes: 20,
        label: "広がった水攻めの噂を検証する",
        summary: "噂が広がった。",
      },
    },
  ];
}

test("context state is versioned and does not globally retire a focus", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const context = ensureContextState(flow);
  assert.equal(context.version, AUTHORED_MISSION_REVISIT_CONTEXT_VERSION);
  assert.deepEqual(context.consumedSceneKeys, []);
  assert.deepEqual(context.targetUseCounts, {});
});

test("the same target in the same evidence state is consumable only once", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const actions = focusActions();
  const firstSet = filterContextRevisitActions(state, flow, actions);
  const chosen = firstSet.find((action) =>
    action.authoredMissionFlowNavigatorFocusId === "world_tree_and_recovery");
  assert.ok(chosen);
  assert.equal(consumeContextScene(flow, chosen), true);
  assert.equal(consumeContextScene(flow, chosen), false);

  const repeatedSet = filterContextRevisitActions(state, flow, actions);
  assert.equal(repeatedSet.some((action) =>
    action.authoredMissionRevisitSceneKey === chosen.authoredMissionRevisitSceneKey), false);
  assert.equal(targetUseCount(flow, "focus:world_tree_and_recovery"), 1);
});

test("new evidence creates a new scene and advances the handwritten variant", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const actions = focusActions();
  const first = filterContextRevisitActions(state, flow, actions)
    .find((action) => action.authoredMissionFlowNavigatorFocusId === "world_tree_and_recovery");
  const firstFingerprint = contextFingerprint(state, flow, actions);
  const firstSceneKey = sceneKeyForAction(state, flow, actions, first);
  consumeContextScene(flow, first);

  flow.evidenceIds.push("T13-EV-ROOT-PAIN");
  state.playerState.missions[MISSION_ID].progress["MSN-T13-INVESTIGATE"] = 2;
  const secondSet = filterContextRevisitActions(state, flow, actions);
  const second = secondSet.find((action) =>
    action.authoredMissionFlowNavigatorFocusId === "world_tree_and_recovery");

  assert.ok(second, "the same focus must remain reachable after evidence changes");
  assert.notEqual(contextFingerprint(state, flow, actions), firstFingerprint);
  assert.notEqual(second.authoredMissionRevisitSceneKey, firstSceneKey);
  assert.equal(second.authoredMissionRevisitVariant, 2);
  assert.match(second.label, /先に現場へ着いたNPC/u);
  assert.notEqual(second.id, first.id);
});

test("three targets remain a normal three-choice focus screen", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const choices = filterContextRevisitActions(state, flow, focusActions());
  assert.equal(choices.length, 3);
  assert.ok(choices.every((action) => action.authoredMissionFlowKind === "navigator_focus"));
  assert.deepEqual(
    new Set(choices.map((action) => action.authoredMissionFlowNavigatorFocusId)),
    new Set([
      "world_tree_and_recovery",
      "growth_and_separation",
      "border_truth_and_survival",
    ]),
  );
  assert.ok(choices.every((action) => action.id.length <= 120));
});

test("an explicit terminal choice still creates an irreversible bad branch", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const actions = focusActions();
  const context = ensureContextState(flow);
  context.targetUseCounts["focus:world_tree_and_recovery"] = 3;
  context.targetUseCounts["focus:growth_and_separation"] = 3;
  context.targetUseCounts["focus:border_truth_and_survival"] = 3;
  const terminal = filterContextRevisitActions(state, flow, actions)[1];
  const result = { ok: true };

  assert.equal(terminal.authoredMissionRevisitTerminal, true);
  assert.equal(recordTerminalEnding(state, flow, terminal, result), true);
  assert.equal(directInvestigationEnded(state), true);
  assert.equal(state.playerState.worldFlags.t13DirectInvestigationEnded, true);
  assert.match(result.summary, /委ね|記録|調査/u);
});
