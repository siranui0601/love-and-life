import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_VILLAGE_DAY6_NORTH_FENCE_WORKDAY_INTERNALS as fence,
} from "../../../src/server/trpg/content/authored-village-day6-north-fence-workday.js";
import {
  CANONICAL_JOB_TIME_POLICY_INTERNALS as jobTime,
} from "../../../src/server/trpg/content/canonical-job-time-policy.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;

function runtime(wallMinute = 15 * 60 + 8) {
  return {
    playerState: {
      absoluteMinute: absoluteMinuteFor(6, wallMinute),
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_NORTH_FENCE",
        gold: 24,
        needs: { hunger: 2, fatigue: 30 },
      },
      canonicalRegionalLabour: { lastDayByFacility: {}, shifts: {} },
      worldFlags: {},
      history: [],
      missions: [],
    },
  };
}

const canonicalFenceJob = Object.freeze({
  canonicalRegionalJobId: "JOB-FARM-04",
  minutes: 240,
});

test("Day6 north-fence life advances the real 15:08 arrival to the canonical 18:00 watch without REST padding", () => {
  const state = runtime();
  assert.equal(jobTime.jobTimeAllowed(state, canonicalFenceJob), false);
  assert.equal(fence.maintenanceEligible(state), true);

  const maintenance = fence.ownActions(state)?.[0];
  assert.equal(maintenance?.id, "DAILY_LIFE:DAY6_NORTH_FENCE_WORKDAY:check_posts_and_lanterns");
  assert.equal(maintenance?.minutes, 90);
  assert.equal(String(maintenance?.id).includes("REST"), false);

  state.playerState.absoluteMinute += maintenance.minutes;
  assert.equal(fence.consume(state, maintenance, { ok: true }), true);
  assert.equal(fence.watchPrepEligible(state), true);

  const prep = fence.ownActions(state)?.[0];
  assert.equal(prep?.id, "DAILY_LIFE:DAY6_NORTH_FENCE_WORKDAY:prepare_watch_handover");
  assert.equal(prep?.minutes, 82);
  state.playerState.absoluteMinute += prep.minutes;
  assert.equal(fence.consume(state, prep, { ok: true }), true);

  assert.equal(fence.clock(state).minuteOfDay, 18 * 60);
  assert.equal(jobTime.jobTimeAllowed(state, canonicalFenceJob), true);
});

test("Day6 wind-down requires the real canonical watch and never fabricates another wage", () => {
  const state = runtime(22 * 60);
  assert.equal(fence.windDownEligible(state), false);

  state.playerState.canonicalRegionalLabour.lastDayByFacility.LOC_FARM_NORTH_FENCE = 6;
  state.playerState.canonicalRegionalLabour.shifts["JOB-FARM-04"] = 1;
  assert.equal(fence.completedShiftToday(state), true);
  assert.equal(fence.windDownEligible(state), true);

  const windDown = fence.ownActions(state)?.[0];
  assert.equal(windDown?.id, "DAILY_LIFE:DAY6_NORTH_FENCE_WORKDAY:finish_watch_notes");
  assert.equal(windDown?.minutes, 30);
  const goldBefore = state.playerState.player.gold;
  assert.equal(fence.consume(state, windDown, { ok: true }), true);
  assert.equal(state.playerState.player.gold, goldBefore);
  assert.equal(state.playerState.history.at(-1).wage, 0);
});

test("Day6 bridge is common-state scoped and yields when the body needs urgent care", () => {
  const wrongDay = runtime();
  wrongDay.playerState.absoluteMinute = absoluteMinuteFor(5, 15 * 60 + 8);
  assert.equal(fence.maintenanceEligible(wrongDay), false);

  const wrongPlace = runtime();
  wrongPlace.playerState.player.facilityId = "LOC_FARM_BAKERY";
  assert.equal(fence.maintenanceEligible(wrongPlace), false);

  const urgent = runtime();
  urgent.playerState.player.needs.fatigue = 80;
  assert.equal(fence.maintenanceEligible(urgent), false);
});
