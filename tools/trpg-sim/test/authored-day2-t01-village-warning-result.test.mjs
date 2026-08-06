import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY1_T01_SQUARE_AFTERCARE_INTERNALS as aftercare,
  AUTHORED_DAY1_T01_VILLAGE_NIGHT_INTERNALS as night,
  AUTHORED_DAY2_T01_MERCHANT_PAYMENT_INTERNALS as payment,
  AUTHORED_DAY2_T01_VILLAGE_WARNING_INTERNALS as warning,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 780,
      player: { location: "田園の村", facilityId: "LOC_FARM_SQUARE", hunger: 34, fatigue: 58, gold: 0 },
      gold: 0,
      inventory: {},
      missions: [{ id: "MSN-T01", troubleId: "T01", status: "completed", completedAt: 780 }],
      worldFlags: { t01Resolved: true, t01FinnReturned: true },
      history: [], evidence: {}, contracts: {}, goapRequests: {},
    },
  };
}

function choose(state, action) {
  assert.ok(action);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}
function chooseId(state, id) { return choose(state, authoredMissionFlowExclusiveActions(state).find((a) => a.id === id)); }
function chooseLabel(state, label) { return choose(state, authoredMissionFlowExclusiveActions(state).find((a) => a.label === label)); }

function reachWarningResult(state) {
  chooseId(state, aftercare.HELP_ACTION_ID);
  chooseId(state, "MISSION_FLOW:T01:SQUARE_SUPPER:share_bread");
  chooseId(state, night.SLEEP_ACTION_ID);
  chooseId(state, payment.SOURCE_ACTION_ID);
  chooseLabel(state, "三Gを受け取る");
  chooseLabel(state, "猟師の荷を預かる");
  chooseLabel(state, "狩人小屋へ向かう");
  chooseLabel(state, "罠を直す");
  chooseLabel(state, "村へ知らせる");
  state.playerState.absoluteMinute = state.playerState.goapRequests[warning.REQUEST_ID].dueAtMinute;
}

test("Day1 route reaches the village warning follow-up", () => {
  const state = runtime();
  reachWarningResult(state);
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
  reachWarningResult(state);
  chooseLabel(state, "家畜を移す");
  assert.equal(state.playerState.player.location, "田園の村");
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_NORTH_FENCE");
  assert.equal(state.playerState.goapRequests[warning.REQUEST_ID].status, "completed");
  assert.equal(state.playerState.day2T01VillageWarning.closedActionIds.length, 2);
  assert.equal(warning.eligible(state), false);
});

test("inspecting bells preserves evidence and source", () => {
  const state = runtime();
  reachWarningResult(state);
  chooseLabel(state, "鈴を見回る");
  assert.deepEqual(state.playerState.evidence["T03-EVIDENCE-DAY2-NORTHEAST-BELL-MARK"], {
    id: "T03-EVIDENCE-DAY2-NORTHEAST-BELL-MARK",
    source: "LOC_FOREST_HUNTER_HUT:NORTHEAST_WARNING_LINE",
    acquiredAtMinute: 960,
  });
});

test("leaving it to Jill is a valid non-intervention result", () => {
  const state = runtime();
  reachWarningResult(state);
  chooseLabel(state, "ジルに任せる");
  assert.equal(state.playerState.worldFlags["day2Hunter:warningLeftToJill"], true);
  assert.equal(state.playerState.goapRequests[warning.REQUEST_ID].status, "completed");
  assert.equal(state.playerState.history.at(-1).type, "DAY2_HUNTER_WARNING_LEFT_TO_JILL");
});

test("warning follow-up requires due time, queued request, history, and facility", () => {
  const state = runtime();
  reachWarningResult(state);
  state.playerState.absoluteMinute -= 1;
  assert.equal(warning.eligible(state), false);
  state.playerState.absoluteMinute += 1;
  assert.equal(warning.eligible(state), true);
  state.playerState.player.facilityId = "LOC_FARM_SQUARE";
  assert.equal(warning.eligible(state), false);
});
