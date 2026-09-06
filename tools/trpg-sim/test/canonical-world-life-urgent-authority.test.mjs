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

function lateT02InnRuntime() {
  const state = lateInnRuntime();
  state.playerState.absoluteMinute = absoluteMinuteFor(5, 22 * 60 + 23);
  state.playerState.day = 5;
  state.playerState.hour = 22;
  state.playerState.minute = 23;
  state.playerState.player.gold = 28;
  state.playerState.player.freeLodging = 0;
  state.playerState.player.needs = { hunger: 34.37, fatigue: 53.35 };
  state.playerState.player.hunger = 34.37;
  state.playerState.player.fatigue = 53.35;
  state.playerState.missions = [
    { id: "MSN-T01", troubleId: "T01", status: "completed", stepId: null },
    { id: "MSN-T02", troubleId: "T02", status: "active", stepId: "hear", progress: 0, required: 1 },
  ];
  state.playerState.troubles = {
    T01: { status: "resolved" },
    T02: { status: "active" },
  };
  return state;
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

test("an active T02 whose hearing scene is elsewhere does not hide stable inn lodging on Day5", () => {
  const state = lateT02InnRuntime();
  const actions = authoredMissionFlowExclusiveActions(state, { presentNpcs: [], movementActions: [] });
  const ids = actions.map((action) => action.id);

  assert.ok(ids.includes("LIFE:SLEEP:ITM001"), "Day5 inn must keep the exact canonical sleep id while T02 hearing is not actionable here");
  assert.equal(actions.some((action) => String(action.id ?? "").startsWith("MISSION_FLOW:")), false,
    "a remote T02 hearing must not manufacture a local mission-owned choice panel");
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
