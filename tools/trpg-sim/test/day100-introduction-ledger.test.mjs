import assert from "node:assert/strict";
import test from "node:test";
import {
  createDay100CoverageState,
  observeDay100Coverage,
  selectDay100Decision,
} from "../lib/day100-player-policy.mjs";

const model = {
  troubles: [],
  adjacency: {},
};

function save() {
  return {
    clock: { day: 1, hour: 10, time: "10:09", absoluteMinute: 9 },
    scene: {
      location: "田園の村",
      facilityId: "LOC_FARM_FIELD",
      beats: [{ introductionToken: "intro:NPC004:eda" }],
    },
    player: { gold: 0, needs: { hunger: 15, fatigue: 8 } },
    tutorial: null,
    battle: null,
    choices: [{ choiceId: "CHOICE-1", actionId: "WAIT", label: "少し待つ", type: "wait" }],
    movement: [],
    missions: [],
    rumors: [],
    world: { ended: false },
  };
}

test("a visible introduction beat is acknowledged only once even when the presentation remains on screen", () => {
  const state = createDay100CoverageState(model);
  const current = save();
  const first = selectDay100Decision({ save: current, model, state });
  assert.equal(first.type, "ACK_NPC_INTRODUCTION");
  assert.equal(first.payload.token, "intro:NPC004:eda");

  observeDay100Coverage(state, current, first);
  const second = selectDay100Decision({ save: current, model, state });
  assert.notEqual(second.type, "ACK_NPC_INTRODUCTION");
  assert.equal(second.actionId, "WAIT");
});
