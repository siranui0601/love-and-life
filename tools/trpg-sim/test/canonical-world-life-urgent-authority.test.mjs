import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;

function lateInnRuntime() {
  return {
    playerState: {
      absoluteMinute: absoluteMinuteFor(2, 22 * 60 + 22),
      day: 2,
      hour: 22,
      minute: 22,
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_INN",
        gold: 41,
        freeLodging: 1,
        needs: { hunger: 32.73, fatigue: 60.19 },
        hunger: 32.73,
        fatigue: 60.19,
      },
      hunger: 32.73,
      fatigue: 60.19,
      missions: [],
      troubles: {},
      worldFlags: {},
      history: [],
      evidence: {},
    },
  };
}

test("late-night inn survival exposes the canonical stable sleep id instead of trapping the player behind the vignette", () => {
  const state = lateInnRuntime();
  const actions = authoredMissionFlowExclusiveActions(state);
  const ids = actions.map((action) => action.id);

  assert.ok(ids.includes("LIFE:SLEEP:ITM001"), "canonical village lodging must be directly visible");
  assert.ok(actions.every((action) => action.canonicalWorldLifeChoice === true),
    "late-night survival products own the authored panel once survival becomes urgent");
  assert.equal(actions.some((action) => action.authoredDailyLifeChoice === true), false,
    "the optional inn vignette must not eclipse survival after the late-night threshold");
});

test("the stable sleep action consumes the existing lodging credit without inventing a dynamic LODGE id", () => {
  const state = lateInnRuntime();
  const action = authoredMissionFlowExclusiveActions(state)
    .find((entry) => entry.id === "LIFE:SLEEP:ITM001");

  assert.ok(action);
  assert.equal(action.minutes, 480);
  assert.equal(action.canonicalWorldLifeKind, "sleep");
  assert.equal(action.price, 4);
  assert.equal(actionsHaveDynamicLodging(authoredMissionFlowExclusiveActions(state)), false);

  const goldBefore = state.playerState.player.gold;
  const fatigueBefore = state.playerState.player.needs.fatigue;
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);

  assert.equal(state.playerState.player.freeLodging, 0);
  assert.equal(state.playerState.player.gold, goldBefore, "the lodging credit pays the canonical room price");
  assert.ok(state.playerState.player.needs.fatigue < fatigueBefore, "sleep restores fatigue");
  assert.equal(state.playerState.canonicalWorldLife.sleeps.ITM001, 1);
  assert.equal(state.playerState.history.at(-1).actionId, "LIFE:SLEEP:ITM001");
  assert.equal(state.playerState.history.at(-1).freeLodgingUsed, true);
});

function actionsHaveDynamicLodging(actions) {
  return actions.some((action) => String(action.id ?? "").startsWith("LODGE:"));
}
