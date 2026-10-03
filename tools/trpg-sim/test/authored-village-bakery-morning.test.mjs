import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_VILLAGE_BAKERY_MORNING_INTERNALS as morning,
} from "../../../src/server/trpg/content/authored-village-bakery-morning.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;

function runtime(wallMinute = 7 * 60 + 9) {
  return {
    playerState: {
      absoluteMinute: absoluteMinuteFor(3, wallMinute),
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_BAKERY",
        gold: 39,
        needs: { hunger: 0, fatigue: 5 },
      },
      worldFlags: {},
      history: [],
    },
  };
}

test("Day3 bakery morning is a route-neutral visible two-hour life activity", () => {
  const state = runtime();
  assert.equal(morning.ownEligible(state), true);
  const actions = morning.actions(state, {});
  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.id), [
    "DAILY_LIFE:DAILY_BAKERY_MORNING:sort_flour_sacks",
    "DAILY_LIFE:DAILY_BAKERY_MORNING:prepare_delivery_baskets",
    "DAILY_LIFE:DAILY_BAKERY_MORNING:help_coby_with_errands",
  ]);
  assert.ok(actions.every((action) => action.minutes === 120));
  assert.ok(actions.every((action) => action.type === "plan"));
  assert.ok(actions.every((action) => action.targetFacilityId === "LOC_FARM_BAKERY"));
  assert.equal(actions.some((action) => "virtue" in action || "route" in action), false);
});

test("sorting sacks records ordinary unpaid life and closes the one-time scene", () => {
  const state = runtime();
  const action = morning.actions(state, {})[0];
  const result = { ok: true };
  assert.equal(morning.consume(state, action, result), true);
  assert.equal(state.playerState.villageBakeryMorning.selectedActionId, action.id);
  assert.equal(state.playerState.villageBakeryMorning.closedActionIds.length, 2);
  assert.equal(state.playerState.history.at(-1).wage, 0);
  assert.equal(state.playerState.history.at(-1).actionId, action.id);
  assert.equal(state.playerState.worldFlags["day3BakeryMorning:sacksSorted"], true);
  assert.equal(state.playerState.player.gold, 39, "ordinary help must not fabricate a wage");
  assert.equal(morning.ownEligible(state), false);
});

test("the two-hour activity cannot start so late that it crosses the 10:00 morning boundary", () => {
  assert.equal(morning.ownEligible(runtime(7 * 60 + 59)), true);
  assert.equal(morning.ownEligible(runtime(8 * 60 + 1)), false);
});
