import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_VILLAGE_DAY6_NORTH_FENCE_WORKDAY_INTERNALS as fence,
} from "../../../src/server/trpg/content/authored-village-day6-north-fence-workday.js";
import {
  CANONICAL_JOB_TIME_POLICY_INTERNALS as jobTime,
} from "../../../src/server/trpg/content/canonical-job-time-policy.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;

function runtime(wallMinute = 17 * 60 + 7) {
  return {
    playerState: {
      absoluteMinute: absoluteMinuteFor(7, wallMinute),
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_NORTH_FENCE",
        gold: 34,
        needs: { hunger: 2, fatigue: 34 },
      },
      canonicalRegionalLabour: { lastDayByFacility: {}, shifts: {} },
      worldFlags: {},
      history: [],
      missions: [],
    },
  };
}

const canonicalWatch = Object.freeze({ canonicalRegionalJobId: "JOB-FARM-04", minutes: 240 });

test("Day7 north-fence life advances 17:07 to the canonical 18:00 watch without REST padding", () => {
  const state = runtime();
  assert.equal(fence.currentDay(state), 7);
  assert.equal(jobTime.jobTimeAllowed(state, canonicalWatch), false);
  assert.equal(fence.maintenanceEligible(state), true);

  const maintenance = fence.maintenanceAction(state);
  assert.equal(maintenance.id, "DAILY_LIFE:DAY7_NORTH_FENCE_WORKDAY:check_posts_and_lanterns");
  assert.equal(maintenance.minutes, 30);
  state.playerState.absoluteMinute = absoluteMinuteFor(7, 17 * 60 + 37);
  assert.equal(fence.consume(state, maintenance, { ok: true }), true);

  assert.equal(fence.watchPrepEligible(state), true);
  const prep = fence.watchPrepAction(state);
  assert.equal(prep.id, "DAILY_LIFE:DAY7_NORTH_FENCE_WORKDAY:prepare_watch_handover");
  assert.equal(prep.minutes, 23);
  state.playerState.absoluteMinute = absoluteMinuteFor(7, 18 * 60);
  assert.equal(fence.consume(state, prep, { ok: true }), true);
  assert.equal(jobTime.jobTimeAllowed(state, canonicalWatch), true);
});

test("Day7 post-watch notes require the real 18:00-22:00 shift and add no wage", () => {
  const state = runtime(22 * 60);
  assert.equal(fence.windDownEligible(state), false);
  state.playerState.canonicalRegionalLabour.lastDayByFacility.LOC_FARM_NORTH_FENCE = 7;
  state.playerState.canonicalRegionalLabour.shifts["JOB-FARM-04"] = 1;
  assert.equal(fence.windDownEligible(state), true);
  const action = fence.windDownAction(state);
  assert.equal(action.id, "DAILY_LIFE:DAY7_NORTH_FENCE_WORKDAY:finish_watch_notes");
  assert.equal(action.minutes, 30);
  const gold = state.playerState.player.gold;
  assert.equal(fence.consume(state, action, { ok: true }), true);
  assert.equal(state.playerState.player.gold, gold);
  assert.equal(state.playerState.history.at(-1).wage, 0);
});
