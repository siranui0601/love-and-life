import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_HUMAN_COMPANION_CAUSALITY_INTERNALS as causality,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import {
  AUTHORED_MISSION_T03_WOLF_INTERNALS as t03,
} from "../../../src/server/trpg/content/authored-mission-t03-wolf-continuity.js";

function runtime(withSource = true) {
  return {
    playerState: {
      absoluteMinute: 7 * 1440 + 5 * 60,
      history: withSource ? [{
        type: causality.SOURCE_HISTORY,
        minute: 960,
        missionId: "MSN-T01",
      }] : [],
      worldFlags: {},
    },
  };
}

test("Day2の家畜移動をT03の既実行行動として継承する", () => {
  const state = runtime();
  assert.equal(causality.synchronizeEarlyCausality(state), true);

  assert.deepEqual(state.t03WolfContinuity.sideChoices, ["evacuate_livestock"]);
  assert.equal(state.playerState.worldFlags.t03LivestockEvacuated, true);
  assert.equal(state.playerState.worldFlags.t03StableTracksTrampled, true);
  assert.equal(state.playerState.worldFlags.t03EarlyAidInherited, true);
  assert.equal(state.playerState.history.at(-1).type, causality.APPLIED_HISTORY);
  assert.equal(state.playerState.history.at(-1).sourceHistoryType, causality.SOURCE_HISTORY);
});

test("継承後のT03三択は家畜移動を再掲せず、変化後の物証を提示する", () => {
  const state = runtime();
  causality.synchronizeEarlyCausality(state);

  const actions = t03.investigationActions(state);
  assert.equal(
    actions.some((action) => action.t03SideChoice === "evacuate_livestock"),
    false,
  );
  const packEvidence = actions.find((action) => action.t03EvidenceClass === "pack_displacement");
  assert.ok(packEvidence);
  assert.match(packEvidence.id, /WOUND_MEASURE/u);
  assert.match(packEvidence.label, /負傷した牝馬/u);
});

test("同じ因果を二重適用せず、保存復元後も一度だけ維持する", () => {
  const state = runtime();
  assert.equal(causality.synchronizeEarlyCausality(state), true);
  assert.equal(causality.synchronizeEarlyCausality(state), false);
  assert.equal(
    state.playerState.history.filter((entry) => entry.type === causality.APPLIED_HISTORY).length,
    1,
  );
  assert.deepEqual(state.t03WolfContinuity.sideChoices, ["evacuate_livestock"]);
});

test("Day2の家畜移動履歴がなければT03状態を作らない", () => {
  const state = runtime(false);
  assert.equal(causality.synchronizeEarlyCausality(state), false);
  assert.equal(state.t03WolfContinuity, undefined);
  assert.deepEqual(state.playerState.worldFlags, {});
});
