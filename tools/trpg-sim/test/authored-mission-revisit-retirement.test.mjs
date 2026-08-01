import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_REVISIT_RETIREMENT_INTERNALS,
  AUTHORED_MISSION_REVISIT_RETIREMENT_VERSION,
} from "../../../src/server/trpg/content/authored-mission-flow-revisit-retirement.js";

const {
  ensureRetirementState,
  revisitTargetKey,
  filterRetiredRevisitActions,
  retireTarget,
  recordTerminalEnding,
  terminalActions,
  directInvestigationEnded,
} = AUTHORED_MISSION_REVISIT_RETIREMENT_INTERNALS;

const FLOW_ID = "forest-king-slime-world-tree-collapse";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 2880,
      worldFlags: {},
      history: [],
    },
    authoredMissionFlows: {
      [FLOW_ID]: {
        flowId: FLOW_ID,
        navigatorFocusId: "world_tree_and_recovery",
        navigatorGroupId: "core_and_ecosystem_recovery",
        selectedLeadId: "mina_slime_core_containment",
        selectedLeadAtMinute: 2800,
        evidenceIds: [],
      },
    },
  };
}

function revisitActions() {
  return [
    {
      id: "MISSION_FLOW:T13:RV:a:1:a:a:a",
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "navigator_route",
      authoredMissionFlowLeadId: "mina_slime_core_containment",
      authoredMissionRevisit: true,
      authoredMissionRevisitStage: "route",
      label: "破損した耐魔籠を作り直す",
    },
    {
      id: "MISSION_FLOW:T13:RV:b:1:b:b:b",
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "revisit_focus_redirect",
      authoredMissionFlowNavigatorFocusId: "growth_and_separation",
      authoredMissionRevisit: true,
      authoredMissionRevisitStage: "route",
      label: "流された水位杭を復元する",
    },
    {
      id: "MISSION_FLOW:T13:RV:c:1:c:c:c",
      authoredMissionFlowId: FLOW_ID,
      authoredMissionFlowKind: "revisit_focus_redirect",
      authoredMissionFlowNavigatorFocusId: "border_truth_and_survival",
      authoredMissionRevisit: true,
      authoredMissionRevisitStage: "route",
      label: "押収された水路簿を別物証から復元する",
    },
  ];
}

test("retirement state starts empty and versioned", () => {
  const flow = runtime().authoredMissionFlows[FLOW_ID];
  const state = ensureRetirementState(flow);
  assert.equal(state.version, AUTHORED_MISSION_REVISIT_RETIREMENT_VERSION);
  assert.deepEqual(state.retiredTargetKeys, []);
  assert.equal(state.endedAtMinute, null);
});

test("every handcrafted revisit target can be used only once", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const actions = revisitActions();
  assert.equal(revisitTargetKey(actions[0]), "lead:mina_slime_core_containment");
  assert.equal(retireTarget(flow, actions[0]), true);
  assert.equal(retireTarget(flow, actions[0]), false);

  const next = filterRetiredRevisitActions(flow, actions);
  assert.equal(next.length, 3);
  assert.ok(!next.some((action) =>
    revisitTargetKey(action) === "lead:mina_slime_core_containment"));
  assert.ok(next.some((action) => action.authoredMissionRevisitTerminal));
  assert.equal(new Set(next.map((action) => revisitTargetKey(action) ?? action.id)).size, 3);
});

test("duplicate target variants collapse to one actual scene, not three renamed copies", () => {
  const flow = runtime().authoredMissionFlows[FLOW_ID];
  const duplicated = [1, 2, 3].map((variant) => ({
    id: `MISSION_FLOW:T13:RV:variant:${variant}`,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowLeadId: "mina_slime_core_containment",
    authoredMissionRevisit: true,
    authoredMissionRevisitStage: "route",
    authoredMissionRevisitVariant: variant,
  }));

  const choices = filterRetiredRevisitActions(flow, duplicated);
  assert.equal(choices.length, 3);
  assert.equal(choices.filter((action) =>
    revisitTargetKey(action) === "lead:mina_slime_core_containment").length, 1);
  assert.equal(choices.filter((action) => action.authoredMissionRevisitTerminal).length, 2);
});

test("exhausted revisit scene becomes three irreversible T13 outcomes", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  for (const action of revisitActions()) retireTarget(flow, action);

  const choices = filterRetiredRevisitActions(flow, revisitActions());
  assert.deepEqual(
    choices.map((action) => action.authoredMissionRevisitTerminalKind),
    ["salvage", "delegate", "withdraw"],
  );
  assert.ok(choices.every((action) => action.id.length <= 120));
  assert.match(choices[0].label, /完全解決|物証/u);
});

test("terminal selection permanently ends direct T13 investigation", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const action = terminalActions("route")[1];
  const result = { ok: true };

  assert.equal(recordTerminalEnding(state, flow, action, result), true);
  assert.equal(directInvestigationEnded(state), true);
  assert.equal(flow.revisitRetirement.endingKind, "delegate");
  assert.equal(flow.selectedLeadId, null);
  assert.equal(state.playerState.worldFlags["t13RevisitTerminal:delegate"], true);
  assert.equal(state.playerState.worldFlags.t13DirectInvestigationEnded, true);
  assert.equal(state.playerState.history.at(-1).type, "AUTHORED_MISSION_REVISIT_TERMINAL");
  assert.match(result.summary, /担当NPC|委ね/u);
});
