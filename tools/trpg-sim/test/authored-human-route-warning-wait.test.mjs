import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY2_T01_VILLAGE_WARNING_INTERNALS as warning,
  AUTHORED_HUMAN_ROUTE_WARNING_WAIT_INTERNALS as wait,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 1200,
      player: {
        location: "森",
        facilityId: "LOC_FOREST_HUNTER_HUT",
      },
      worldFlags: {},
      history: [{
        type: "DAY2_HUNTER_VILLAGE_WARNING_QUEUED",
        minute: 1180,
        missionId: "MSN-T01",
      }],
      evidence: {},
      goapRequests: {
        [warning.REQUEST_ID]: {
          id: warning.REQUEST_ID,
          actorId: "NPC060",
          status: "queued",
          dueAtMinute: 1380,
        },
      },
    },
  };
}

test("警告期限前に生活を含む待機三択を表示する", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(authoredMissionFlowGuidance(state).title, "知らせが戻るまで");
  assert.deepEqual(actions.map((action) => action.label), [
    "ジルと待つ",
    "薪を割る",
    "村へ先回りする",
  ]);
  assert.equal(actions.length, 3);
  assert.equal(actions[0].minutes, 180);
  assert.ok(actions.every((action) => action.label.length >= 4 && action.label.length <= 20));
});

test("ジルと待つと期限まで進み、既存の警告結果三択へ接続する", () => {
  const state = runtime();
  const action = authoredMissionFlowExclusiveActions(state)
    .find((candidate) => candidate.label === "ジルと待つ");
  state.playerState.absoluteMinute += action.minutes;
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);

  assert.equal(state.playerState.day2T01WarningWait.closedActionIds.length, 2);
  assert.equal(state.playerState.history.at(-1).type, "DAY2_HUNTER_WARNING_WAITED_WITH_JILL");
  assert.equal(warning.eligible(state), true);
  assert.deepEqual(
    authoredMissionFlowExclusiveActions(state).map((candidate) => candidate.label),
    ["家畜を移す", "鈴を見回る", "ジルに任せる"],
  );
});

test("村へ先回りする枝は移動先と閉じた枝を保存する", () => {
  const state = runtime();
  const action = authoredMissionFlowExclusiveActions(state)
    .find((candidate) => candidate.label === "村へ先回りする");
  state.playerState.absoluteMinute += action.minutes;
  assert.equal(applyAuthoredMissionFlowAction(state, action, { ok: true }), true);

  assert.equal(state.playerState.player.location, "田園の村");
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_NORTH_FENCE");
  assert.equal(state.playerState.day2T01WarningWait.closedActionIds.length, 2);
  assert.equal(wait.eligible(state), false);
});

test("期限到達後は待機三択を再表示せず警告結果を優先する", () => {
  const state = runtime();
  state.playerState.absoluteMinute = 1380;
  assert.equal(wait.eligible(state), false);
  assert.equal(warning.eligible(state), true);
  assert.deepEqual(
    authoredMissionFlowExclusiveActions(state).map((candidate) => candidate.label),
    ["家畜を移す", "鈴を見回る", "ジルに任せる"],
  );
});
