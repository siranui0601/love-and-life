import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_REVISIT_RETIREMENT_INTERNALS,
  AUTHORED_MISSION_TERMINAL_CLOSURE_INTERNALS,
  AUTHORED_MISSION_TERMINAL_CLOSURE_VERSION,
  applyAuthoredMissionFlowAction,
  authoredMissionFlowGuidance,
} from "../../../src/server/trpg/content/authored-mission-flow-terminal-closure.js";

const FLOW_ID = "forest-king-slime-world-tree-collapse";
const MISSION_ID = "MSN-T13";

const { terminalActions } = AUTHORED_MISSION_REVISIT_RETIREMENT_INTERNALS;
const { closePlayerMission, playerMissionClosed } = AUTHORED_MISSION_TERMINAL_CLOSURE_INTERNALS;

function runtime() {
  return {
    playerState: {
      absoluteMinute: 6240,
      missions: {
        [MISSION_ID]: {
          id: MISSION_ID,
          status: "active",
          progress: { investigate: 4 },
          completedAt: null,
          failedAt: null,
          rewardClaimed: false,
          attemptedAt: 1200,
        },
      },
      worldFlags: {},
      history: [],
    },
    authoredMissionFlows: {
      [FLOW_ID]: {
        flowId: FLOW_ID,
        navigatorFocusId: "world_tree_and_recovery",
        navigatorGroupId: null,
        selectedLeadId: null,
        selectedLeadAtMinute: null,
        deferredUntilMinute: null,
        evidenceIds: [],
      },
    },
  };
}

test("irreversible T13 exit closes only the player mission and removes stale guidance", () => {
  assert.equal(AUTHORED_MISSION_TERMINAL_CLOSURE_VERSION, "authored-mission-terminal-closure-v1");
  const state = runtime();
  const action = terminalActions("focus")[1];
  const result = { ok: true };

  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);

  const mission = state.playerState.missions[MISSION_ID];
  assert.equal(mission.status, "failed");
  assert.equal(mission.failedAt, 6240);
  assert.equal(mission.closedByPlayerAt, 6240);
  assert.equal(mission.closedByPlayerKind, "delegate");
  assert.equal(mission.closedByPlayerStage, "focus");
  assert.equal(mission.failureReason, "player_closed_t13_delegate");
  assert.equal(playerMissionClosed(state), true);
  assert.equal(state.playerState.worldFlags.t13PlayerMissionClosed, true);
  assert.equal(state.playerState.worldFlags["t13PlayerMissionClosure:delegate"], true);
  assert.equal(state.playerState.history.at(-1).type, "AUTHORED_MISSION_PLAYER_CLOSED");
  assert.equal(authoredMissionFlowGuidance(state), null);
  assert.equal(state.playerState.troubles?.T13, undefined);
});

test("mission closure is idempotent and never overwrites a completed mission", () => {
  const state = runtime();
  const action = terminalActions("route")[2];

  assert.equal(closePlayerMission(state, action), true);
  assert.equal(closePlayerMission(state, action), false);
  assert.equal(
    state.playerState.history.filter((entry) => entry.type === "AUTHORED_MISSION_PLAYER_CLOSED").length,
    1,
  );

  const completed = runtime();
  completed.playerState.missions[MISSION_ID].status = "completed";
  completed.playerState.missions[MISSION_ID].completedAt = 6000;
  assert.equal(closePlayerMission(completed, action), false);
  assert.equal(completed.playerState.missions[MISSION_ID].status, "completed");
  assert.equal(completed.playerState.missions[MISSION_ID].failedAt, null);
});
