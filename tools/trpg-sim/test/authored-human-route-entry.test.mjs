import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_HUMAN_ROUTE_ENTRY_INTERNALS as entry,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime(missions, { finnReturned = true } = {}) {
  return {
    playerState: {
      absoluteMinute: 222,
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_SQUARE",
      },
      missions,
      worldFlags: finnReturned ? { t01FinnReturned: true } : {},
      history: [],
      evidence: {},
    },
  };
}

function select(state, label) {
  const action = authoredMissionFlowExclusiveActions(state)
    .find((candidate) => candidate.label === label);
  assert.ok(action);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

test("正式runtimeのMap形式missionと帰還履歴からT01救出後三択を表示する", () => {
  const state = runtime(new Map([
    ["MSN-T01", { id: "MSN-T01", status: "completed" }],
  ]));

  assert.equal(entry.canonicalT01Completed(state), true);
  assert.equal(entry.canonicalFinnReturned(state), true);
  assert.equal(authoredMissionFlowGuidance(state).title, "救出の後に何をするか");
  assert.deepEqual(
    authoredMissionFlowExclusiveActions(state).map((action) => action.label),
    ["ミラを手伝う", "村長に記録を渡す", "子どもと遊ぶ"],
  );
});

test("object形式missionでも帰還履歴があれば同じ救出後三択を表示する", () => {
  const state = runtime({
    "MSN-T01": { id: "MSN-T01", status: "resolved" },
  });
  assert.equal(entry.canonicalT01Completed(state), true);
  assert.equal(entry.canonicalFinnReturned(state), true);
  assert.equal(authoredMissionFlowExclusiveActions(state).length, 3);
});

test("legacy runtime直下のt01Resolvedも成功救出の移行状態として認識する", () => {
  const state = runtime(new Map(), { finnReturned: false });
  state.worldFlags = { t01Resolved: true };
  assert.equal(entry.t01ResolvedFlag(state), true);
  assert.equal(entry.canonicalT01Completed(state), true);
  assert.equal(entry.canonicalFinnReturned(state), true);
  assert.equal(authoredMissionFlowExclusiveActions(state).length, 3);
});

test("ミラを手伝った直後は更新された夕食三択へ進む", () => {
  const state = runtime(new Map([
    ["MSN-T01", { id: "MSN-T01", status: "completed" }],
  ]));
  select(state, "ミラを手伝う");

  assert.equal(authoredMissionFlowGuidance(state).title, "救出後の夕食");
  assert.deepEqual(
    authoredMissionFlowExclusiveActions(state).map((action) => action.label),
    ["パンをちぎる", "フィンに道を聞く", "早めに休む"],
  );
  assert.equal(state.playerState.day1T01Aftercare.aftercareClosedActionIds.length, 2);
  assert.equal(state.playerState.history.at(-1).type, "T01_AFTERCARE_MIRA_HELPED");
});

test("完了扱いでもフィンが未帰還なら救出後三択を表示しない", () => {
  const state = runtime(new Map([
    ["MSN-T01", { id: "MSN-T01", status: "completed" }],
  ]), { finnReturned: false });
  assert.equal(entry.canonicalT01Completed(state), true);
  assert.equal(entry.canonicalFinnReturned(state), false);
  assert.equal(entry.ownActions(state), null);
});

test("未完了missionや別施設では救出後三択を割り込ませない", () => {
  const active = runtime(new Map([
    ["MSN-T01", { id: "MSN-T01", status: "active" }],
  ]));
  assert.equal(entry.canonicalT01Completed(active), false);
  assert.equal(entry.ownActions(active), null);

  const away = runtime(new Map([
    ["MSN-T01", { id: "MSN-T01", status: "completed" }],
  ]));
  away.playerState.player.facilityId = "LOC_FARM_EDGE";
  assert.equal(entry.ownActions(away), null);
});
