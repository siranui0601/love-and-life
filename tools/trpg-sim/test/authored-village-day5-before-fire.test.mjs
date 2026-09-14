import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_VILLAGE_DAY5_BEFORE_FIRE_INTERNALS as day5,
} from "../../../src/server/trpg/content/authored-village-day5-before-fire.js";
import {
  AUTHORED_T02_GRANARY_DAWN_INTERNALS as dawn,
} from "../../../src/server/trpg/content/authored-mission-flow-t02-granary-dawn.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;

function runtime(day = 5, wallMinute = 7 * 60 + 49, facilityId = "LOC_FARM_GRANARY") {
  return {
    playerState: {
      absoluteMinute: absoluteMinuteFor(day, wallMinute),
      player: {
        location: "田園の村",
        facilityId,
        gold: 24,
        needs: { hunger: 20, fatigue: 2 },
      },
      missions: [{ id: "MSN-T02", status: "active" }],
      troubles: { T02: "active" },
      history: [],
    },
  };
}

test("Day5 morning stays pre-fire: ordinary granary routine is visible while T02 dawn remains closed", () => {
  const state = runtime();
  assert.equal(dawn.withinDawnWindow(state), false, "burned-site scene must not exist on Day5 morning");
  assert.equal(dawn.activeSceneId(state), null);
  assert.equal(day5.granaryRoutineEligible(state, {}), true);

  const action = day5.actions(state, {})?.[0];
  assert.equal(action?.id, "DAILY_LIFE:DAY5_VILLAGE_ROUTINE:count_and_stack_granary_sacks");
  assert.equal(action?.minutes, 131, "07:49 ordinary work should advance naturally to the 10:00 job window");
  assert.equal(action?.authoredVillageDay5BeforeFireChoice, true);
  assert.equal(action?.missionId, undefined);
  assert.equal(action?.troubleId, undefined);

  const result = { ok: true };
  state.playerState.absoluteMinute = absoluteMinuteFor(5, 10 * 60);
  assert.equal(day5.consume(state, action, result), true);
  assert.match(result.summary, /まだ火災は起きておらず/);
  assert.equal(state.playerState.history.at(-1).troubleId, null);
  assert.equal(state.playerState.history.at(-1).wage, 0);
});

test("Day5 north-fence preparation reaches exactly 18:00 without widening the canonical watch", () => {
  const state = runtime(5, 15 * 60 + 8, "LOC_FARM_NORTH_FENCE");
  assert.equal(day5.fenceMaintenanceEligible(state, {}), true);
  const maintenance = day5.actions(state, {})?.[0];
  assert.equal(maintenance?.minutes, 90);

  state.playerState.absoluteMinute = absoluteMinuteFor(5, 16 * 60 + 38);
  assert.equal(day5.consume(state, maintenance, { ok: true }), true);
  const prep = day5.actions(state, {})?.[0];
  assert.equal(prep?.id, "DAILY_LIFE:DAY5_VILLAGE_ROUTINE:prepare_night_watch");
  assert.equal(prep?.minutes, 82);

  state.playerState.absoluteMinute = absoluteMinuteFor(5, 18 * 60);
  assert.equal(day5.consume(state, prep, { ok: true }), true);
  assert.equal(day5.watchPrepEligible(state, {}), false);
});

test("T02 dawn opens only after the corrected Day5-night boundary", () => {
  const beforeFire = runtime(5, 21 * 60 + 59);
  assert.equal(dawn.withinDawnWindow(beforeFire), false);

  const afterFire = runtime(5, 22 * 60, "LOC_FARM_GRANARY");
  assert.equal(dawn.withinDawnWindow(afterFire), true);
  assert.equal(dawn.activeSceneId(afterFire), dawn.DAWN_SCENE);

  const day6 = runtime(6, 7 * 60 + 19, "LOC_FARM_GRANARY");
  assert.equal(dawn.withinDawnWindow(day6), true);
  assert.equal(dawn.activeSceneId(day6), dawn.DAWN_SCENE);
});
