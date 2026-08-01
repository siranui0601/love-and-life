import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_AMBIENT_CONTINUITY_INTERNALS,
  AUTHORED_MISSION_AMBIENT_CONTINUITY_VERSION,
} from "../../../src/server/trpg/content/authored-mission-flow-ambient-continuity.js";

const {
  ensureAmbientState,
  preferredMovement,
  stageActions,
  consumeAmbientBranch,
  terminalActions,
  endAmbientInvestigation,
  AMBIENT_STAGES,
} = AUTHORED_MISSION_AMBIENT_CONTINUITY_INTERNALS;

const FLOW_ID = "forest-king-slime-world-tree-collapse";
const MISSION_ID = "MSN-T13";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 7200,
      player: {
        location: "エルフの隠れ里",
        facilityId: "LOC_FOREST_EDGE",
      },
      missions: {
        [MISSION_ID]: {
          status: "active",
          progress: {
            "MSN-T13-HEAR": 1,
            "MSN-T13-INVESTIGATE": 2,
          },
        },
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
        deferredUntilMinute: 8000,
        evidenceIds: ["T13-EV-SEAL-CHAIN"],
      },
    },
  };
}

function context() {
  return {
    presentNpcs: [
      { id: "NPC060", name: "ジル" },
      { id: "NPC001", name: "セリエ" },
    ],
    movementActions: [
      {
        id: "MOVE_LOCAL:エルフの隠れ里:LOC_FOREST_CAMP",
        family: "travel",
        type: "move",
        minutes: 12,
        label: "森の野営地へ向かう",
        movementScope: "local",
        destinationHub: "エルフの隠れ里",
        destinationFacilityId: "LOC_FOREST_CAMP",
      },
      {
        id: "MOVE_REGION:田園の村",
        family: "travel",
        type: "travel",
        minutes: 80,
        label: "田園の村へ旅立つ",
        movementScope: "regional",
        destinationHub: "田園の村",
        destinationFacilityId: "LOC_FARM_WELL",
      },
    ],
  };
}

test("ambient continuity state is versioned and serializable", () => {
  const flow = runtime().authoredMissionFlows[FLOW_ID];
  const state = ensureAmbientState(flow);
  assert.equal(state.version, AUTHORED_MISSION_AMBIENT_CONTINUITY_VERSION);
  assert.equal(state.nextStageIndex, 0);
  assert.deepEqual(state.selectedBranchIds, []);
  assert.deepEqual(state.closedBranchIds, []);
  assert.doesNotThrow(() => JSON.stringify(state));
});

test("forest revisit offers three handwritten branches, not the old inspect-talk-move ids", () => {
  const state = runtime();
  const choices = stageActions(state, context(), AMBIENT_STAGES[0]);

  assert.equal(choices.length, 3);
  assert.deepEqual(
    choices.map((choice) => choice.authoredMissionAmbientBranchKind),
    ["inspect", "talk", "move"],
  );
  assert.ok(choices.every((choice) => choice.authoredMissionFlowExclusiveChoice));
  assert.ok(choices.every((choice) => choice.id.startsWith("MISSION_FLOW:T13:AMBIENT:")));
  assert.ok(!choices.some((choice) => choice.id === "DIRECT_TALK:NPC060"));
  assert.ok(!choices.some((choice) => choice.id === "INSPECT:LOC_FOREST_EDGE:1"));
  assert.ok(!choices.some((choice) => choice.id === "MOVE_LOCAL:エルフの隠れ里:LOC_FOREST_CAMP"));
  assert.match(choices[0].label, /巡回隊以前|踏み荒らされた/u);
  assert.match(choices[1].label, /誰が粘液標本を持ち出した/u);
  assert.match(choices[2].label, /移された標本より先/u);
  assert.equal(choices[1].singleTurnConversation, true);
  assert.equal(choices[1].dialogueExit, true);
});

test("choosing one branch closes the other two and permanently advances the scene", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const firstChoices = stageActions(state, context(), AMBIENT_STAGES[0]);
  const chosen = firstChoices[1];
  const result = { ok: true };

  assert.equal(consumeAmbientBranch(state, flow, chosen, result), true);
  assert.equal(flow.ambientContinuity.nextStageIndex, 1);
  assert.deepEqual(flow.ambientContinuity.selectedBranchIds, [chosen.id]);
  assert.equal(flow.ambientContinuity.closedBranchIds.length, 2);
  assert.ok(!flow.ambientContinuity.closedBranchIds.includes(chosen.id));
  assert.equal(flow.deferredUntilMinute, null);
  assert.equal(state.playerState.worldFlags["t13Ambient:sampleCustodianKnown"], true);
  assert.equal(state.playerState.history.at(-1).type, "AUTHORED_MISSION_AMBIENT_BRANCH_SELECTED");
  assert.match(result.summary, /標本|保管線/u);

  const nextChoices = stageActions(state, context(), AMBIENT_STAGES[1]);
  assert.equal(new Set(firstChoices.map((choice) => choice.id)
    .filter((id) => nextChoices.some((choice) => choice.id === id))).size, 0);
  assert.match(nextChoices[0].label, /雨/u);
});

test("repeated returns cannot cycle back after three inspections", () => {
  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const seenSets = new Set();

  for (let index = 0; index < AMBIENT_STAGES.length; index += 1) {
    const choices = stageActions(state, context(), AMBIENT_STAGES[index]);
    const signature = choices.map((choice) => choice.id).sort().join("|");
    assert.equal(seenSets.has(signature), false, `stage ${index} repeated a choice set`);
    seenSets.add(signature);
    const result = { ok: true };
    assert.equal(consumeAmbientBranch(state, flow, choices[0], result), true);
    flow.deferredUntilMinute = 9000 + index;
  }

  assert.equal(flow.ambientContinuity.nextStageIndex, AMBIENT_STAGES.length);
  assert.equal(seenSets.size, AMBIENT_STAGES.length);
  assert.ok(flow.ambientContinuity.closedBranchIds.length >= AMBIENT_STAGES.length * 2);
});

test("movement keeps resolver fields while receiving a one-use authored purpose", () => {
  const state = runtime();
  const movements = context().movementActions;
  const guidance = {
    targetLocation: "田園の村",
    targetFacilityId: "LOC_FARM_WELL",
  };
  const chosenMovement = preferredMovement({ movementActions: movements }, guidance);
  assert.equal(chosenMovement.id, "MOVE_REGION:田園の村");

  const choices = stageActions(state, {
    ...context(),
    movementActions: [movements[1]],
  }, AMBIENT_STAGES[2]);
  const move = choices[2];
  assert.equal(move.destinationHub, "田園の村");
  assert.equal(move.destinationFacilityId, "LOC_FARM_WELL");
  assert.equal(move.movementScope, "regional");
  assert.notEqual(move.id, chosenMovement.id);
  assert.match(move.label, /最初の掲示を見た証人/u);
});

test("after all handwritten scenes, only irreversible outcomes remain", () => {
  const choices = terminalActions();
  assert.equal(choices.length, 3);
  assert.deepEqual(
    choices.map((choice) => choice.authoredMissionAmbientEndingKind),
    ["salvage", "delegate", "withdraw"],
  );
  assert.ok(choices.every((choice) => choice.authoredMissionAmbientTerminal));
  assert.ok(choices.every((choice) => choice.id.length <= 120));

  const state = runtime();
  const flow = state.authoredMissionFlows[FLOW_ID];
  const result = { ok: true };
  assert.equal(endAmbientInvestigation(state, flow, choices[1], result), true);
  assert.equal(flow.ambientContinuity.endingKind, "delegate");
  assert.equal(state.playerState.worldFlags.t13DirectInvestigationEnded, true);
  assert.equal(state.playerState.worldFlags["t13AmbientEnding:delegate"], true);
  assert.equal(state.playerState.history.at(-1).type, "AUTHORED_MISSION_AMBIENT_TERMINAL");
  assert.match(result.summary, /ジル|現地NPC/u);
});
