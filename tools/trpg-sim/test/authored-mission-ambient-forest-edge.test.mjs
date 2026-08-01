import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_AMBIENT_FOREST_EDGE_INTERNALS,
  AUTHORED_MISSION_AMBIENT_FOREST_EDGE_VERSION,
  authoredMissionFlowExclusiveActions,
} from "../../../src/server/trpg/content/authored-mission-flow-ambient-forest-edge.js";

const {
  atCanonicalForestEdge,
  forestAmbientEligible,
  ambientGuidance,
} = AUTHORED_MISSION_AMBIENT_FOREST_EDGE_INTERNALS;

const FLOW_ID = "forest-king-slime-world-tree-collapse";
const MISSION_ID = "MSN-T13";

function runtime(location = "森", facilityId = "LOC_FOREST_EDGE") {
  return {
    playerState: {
      absoluteMinute: 43098,
      player: { location, facilityId },
      missions: {
        [MISSION_ID]: {
          status: "active",
          progress: { "MSN-T13-INVESTIGATE": 4 },
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
        deferredUntilMinute: 44000,
        evidenceIds: ["T13-EV-SEAL-CHAIN"],
      },
    },
  };
}

function context() {
  return {
    presentNpcs: [{ id: "NPC060", name: "ジル" }],
    movementActions: [
      {
        id: "MOVE_REGION:エルフの隠れ里",
        family: "travel",
        type: "travel",
        minutes: 90,
        label: "エルフの隠れ里へ旅立つ",
        movementScope: "regional",
        destinationHub: "エルフの隠れ里",
        destinationFacilityId: "LOC_FOREST_GATE",
      },
      {
        id: "MOVE_LOCAL:LOC_FOREST_CAMP",
        family: "travel",
        type: "move",
        minutes: 7,
        label: "狩人の野営地へ向かう",
        movementScope: "local",
        destinationHub: "森",
        destinationFacilityId: "LOC_FOREST_CAMP",
      },
    ],
  };
}

test("forest edge identity follows facility id, not the hub display name", () => {
  assert.equal(AUTHORED_MISSION_AMBIENT_FOREST_EDGE_VERSION, "authored-mission-ambient-forest-edge-v1");
  assert.equal(atCanonicalForestEdge(runtime("森")), true);
  assert.equal(atCanonicalForestEdge(runtime("エルフの隠れ里")), true);
  assert.equal(atCanonicalForestEdge(runtime("森", "LOC_FOREST_CAMP")), false);
});

test("the exact route-audit location now activates the handwritten continuation", () => {
  const state = runtime("森", "LOC_FOREST_EDGE");
  const flow = state.authoredMissionFlows[FLOW_ID];
  assert.equal(forestAmbientEligible(state, flow), true);
  const guidance = ambientGuidance(flow);
  assert.equal(guidance.targetFacilityId, "LOC_FOREST_EDGE");
  assert.match(guidance.title, /巡回隊/u);
});

test("the exported choice provider replaces the exact old forest loop", () => {
  const choices = authoredMissionFlowExclusiveActions(runtime("森", "LOC_FOREST_EDGE"), context());
  assert.equal(choices.length, 3);
  assert.ok(choices.every((choice) => choice.authoredMissionAmbientChoice));
  assert.ok(choices.every((choice) => choice.id.startsWith("MISSION_FLOW:T13:AMBIENT:")));
  const ids = new Set(choices.map((choice) => choice.id));
  assert.equal(ids.has("INSPECT:LOC_FOREST_EDGE:1"), false);
  assert.equal(ids.has("TALK:NPC060"), false);
  assert.equal(ids.has("REST_OUTDOOR:LOC_FOREST_EDGE"), false);
  assert.equal(ids.has("MOVE_REGION:エルフの隠れ里"), false);
  assert.match(choices[1].label, /粘液標本/u);
});

test("completed or ended T13 investigation does not hijack ordinary forest choices", () => {
  const completed = runtime();
  completed.playerState.missions[MISSION_ID].status = "completed";
  assert.equal(
    forestAmbientEligible(completed, completed.authoredMissionFlows[FLOW_ID]),
    false,
  );

  const ended = runtime();
  ended.authoredMissionFlows[FLOW_ID].ambientContinuity = {
    nextStageIndex: 10,
    selectedBranchIds: [],
    closedBranchIds: [],
    endedAtMinute: 42000,
    endingKind: "delegate",
  };
  assert.equal(
    forestAmbientEligible(ended, ended.authoredMissionFlows[FLOW_ID]),
    false,
  );
});
