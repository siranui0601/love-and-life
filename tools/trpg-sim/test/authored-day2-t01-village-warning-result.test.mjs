import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY2_T01_VILLAGE_WARNING_INTERNALS as warning,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const WARNING_DUE_MINUTE = 1583; // Day2 12:23 after the natural Jill warning wait.

function runtime({ due = true, queued = true, history = true } = {}) {
  return {
    playerState: {
      absoluteMinute: due ? WARNING_DUE_MINUTE : WARNING_DUE_MINUTE - 1,
      player: { location: "森", facilityId: "LOC_FOREST_HUNTER_HUT", hunger: 34, fatigue: 40, gold: 42 },
      gold: 42,
      inventory: {},
      missions: [{ id: "MSN-T01", troubleId: "T01", status: "completed", completedAt: 292 }],
      worldFlags: { t01Resolved: true, t01FinnReturned: true },
      history: history ? [{ type: "DAY2_HUNTER_VILLAGE_WARNING_QUEUED" }] : [],
      evidence: {},
      contracts: {},
      goapRequests: queued ? {
        [warning.REQUEST_ID]: {
          id: warning.REQUEST_ID,
          actorNpcId: "NPC060",
          goal: "warn_village_north_fence",
          destination: "LOC_FARM_NORTH_FENCE",
          status: "queued",
          createdAtMinute: WARNING_DUE_MINUTE - 180,
          dueAtMinute: WARNING_DUE_MINUTE,
        },
      } : {},
    },
  };
}

function choose(state, action) {
  assert.ok(action);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}
function chooseLabel(state, label) { return choose(state, authoredMissionFlowExclusiveActions(state).find((a) => a.label === label)); }

function reachWarningResult(state) {
  state.playerState.absoluteMinute = WARNING_DUE_MINUTE;
}

test("queued warning at its real due time reaches the village warning follow-up", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.equal(authoredMissionFlowGuidance(state).title, "北柵への警告、その後");
  assert.deepEqual(actions.map((a) => a.label), ["家畜を移す", "鈴を見回る", "ジルに任せる"]);
  assert.equal(actions.length, 3);
  assert.equal(new Set(actions.map((a) => a.id)).size, 3);
  assert.equal(new Set(actions.map((a) => a.family)).size, 3);
  assert.ok(actions.every((a) => a.label.length >= 4 && a.label.length <= 20));
});

test("moving livestock completes the request and moves the player", () => {
  const state = runtime();
  chooseLabel(state, "家畜を移す");
  assert.equal(state.playerState.player.location, "田園の村");
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_NORTH_FENCE");
  assert.equal(state.playerState.goapRequests[warning.REQUEST_ID].status, "completed");
  assert.equal(state.playerState.day2T01VillageWarning.closedActionIds.length, 2);
  assert.equal(warning.eligible(state), false);
});

test("inspecting bells preserves evidence and source", () => {
  const state = runtime();
  chooseLabel(state, "鈴を見回る");
  assert.deepEqual(state.playerState.evidence["T03-EVIDENCE-DAY2-NORTHEAST-BELL-MARK"], {
    id: "T03-EVIDENCE-DAY2-NORTHEAST-BELL-MARK",
    source: "LOC_FOREST_HUNTER_HUT:NORTHEAST_WARNING_LINE",
    acquiredAtMinute: WARNING_DUE_MINUTE,
  });
});

test("leaving it to Jill is a valid non-intervention result", () => {
  const state = runtime();
  chooseLabel(state, "ジルに任せる");
  assert.equal(state.playerState.worldFlags["day2Hunter:warningLeftToJill"], true);
  assert.equal(state.playerState.goapRequests[warning.REQUEST_ID].status, "completed");
  assert.equal(state.playerState.history.at(-1).type, "DAY2_HUNTER_WARNING_LEFT_TO_JILL");
});

test("warning follow-up requires due time, queued request, history, and facility", () => {
  const early = runtime({ due: false });
  assert.equal(warning.eligible(early), false);
  reachWarningResult(early);
  assert.equal(warning.eligible(early), true);

  const noRequest = runtime({ queued: false });
  assert.equal(warning.eligible(noRequest), false);

  const noHistory = runtime({ history: false });
  assert.equal(warning.eligible(noHistory), false);

  const wrongPlace = runtime();
  wrongPlace.playerState.player.facilityId = "LOC_FARM_SQUARE";
  assert.equal(warning.eligible(wrongPlace), false);
});