import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTHORED_MISSION_FLOW_REGISTRY_INTERNALS as registry,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtimeAt(absoluteMinute) {
  return {
    playerState: {
      absoluteMinute,
      troubles: {
        T02: { id: "T02", status: "scheduled", transitions: [] },
      },
      history: [],
    },
  };
}

const dawnAction = { authoredT02DawnChoice: true };

test("T02 dawn production action activates the canonically-started trouble exactly once", () => {
  // Day6 08:00 in the production clock where absoluteMinute=0 is Day1 10:00.
  const runtime = runtimeAt(5 * 1440 + 8 * 60 - 10 * 60);

  assert.equal(registry.syncCanonicalT02GranaryOnset(runtime, dawnAction, { ok: true }), true);
  assert.equal(runtime.playerState.troubles.T02.status, "active");
  assert.equal(runtime.playerState.troubles.T02.transitions.length, 1);
  assert.equal(runtime.playerState.troubles.T02.transitions[0].reason, "canonical-t02-dawn-onset");
  assert.equal(runtime.playerState.history.filter((entry) => entry.type === "TROUBLE_TRANSITION").length, 1);

  assert.equal(registry.syncCanonicalT02GranaryOnset(runtime, dawnAction, { ok: true }), false);
  assert.equal(runtime.playerState.troubles.T02.transitions.length, 1);
});

test("T02 onset sync cannot activate before the canonical Day5 night boundary or after a rejected action", () => {
  const beforeNight = runtimeAt(4 * 1440 + 21 * 60 + 59 - 10 * 60);
  assert.equal(registry.syncCanonicalT02GranaryOnset(beforeNight, dawnAction, { ok: true }), false);
  assert.equal(beforeNight.playerState.troubles.T02.status, "scheduled");

  const rejected = runtimeAt(5 * 1440 + 8 * 60 - 10 * 60);
  assert.equal(registry.syncCanonicalT02GranaryOnset(rejected, dawnAction, { ok: false }), false);
  assert.equal(rejected.playerState.troubles.T02.status, "scheduled");
});