import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_VILLAGE_NORTH_FENCE_WORKDAY_INTERNALS as fence,
} from "../../../src/server/trpg/content/authored-village-north-fence-workday.js";
import {
  CANONICAL_JOB_TIME_POLICY_INTERNALS as jobTime,
} from "../../../src/server/trpg/content/canonical-job-time-policy.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;

function runtime(wallMinute = 14 * 60 + 39) {
  return {
    playerState: {
      absoluteMinute: absoluteMinuteFor(4, wallMinute),
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_NORTH_FENCE",
        gold: 26,
        needs: { hunger: 2, fatigue: 34 },
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

test("Day4 north-fence life bridges the real 14:39 arrival to the canonical 18:00 watch without REST padding", () => {
  const state = runtime();
  assert.equal(jobTime.jobTimeAllowed(state, canonicalFenceJob), false, "14:39 must remain outside the canonical night-watch shift");
  assert.equal(fence.maintenanceEligible(state, {}), true);

  const maintenance = fence.actions(state, {})?.[0];
  assert.equal(maintenance?.id, "DAILY_LIFE:DAILY_NORTH_FENCE_WORKDAY:check_posts_and_lanterns");
  assert.equal(maintenance?.minutes, 90);
  assert.equal(maintenance?.type, "plan");
  assert.equal("route" in maintenance || "virtue" in maintenance, false);

  state.playerState.absoluteMinute = absoluteMinuteFor(4, 16 * 60 + 9);
  assert.equal(fence.consume(state, maintenance, { ok: true }), true);
  assert.equal(fence.watchPrepEligible(state, {}), true);

  const watchPrep = fence.actions(state, {})?.[0];
  assert.equal(watchPrep?.id, "DAILY_LIFE:DAILY_NORTH_FENCE_WORKDAY:prepare_watch_handover");
  assert.equal(watchPrep?.minutes, 111);

  state.playerState.absoluteMinute = absoluteMinuteFor(4, 18 * 60);
  assert.equal(fence.consume(state, watchPrep, { ok: true }), true);
  assert.equal(jobTime.jobTimeAllowed(state, canonicalFenceJob), true, "18:00-22:00 is the Sheet-backed JOB-FARM-04 window");
  assert.equal(fence.watchPrepEligible(state, {}), false);
});

test("post-watch wind-down requires the actual canonical JOB-FARM-04 shift and adds no second wage", () => {
  const state = runtime(22 * 60);
  assert.equal(fence.windDownEligible(state, {}), false, "ordinary cleanup must not claim a night-watch shift that never happened");

  state.playerState.canonicalRegionalLabour.lastDayByFacility.LOC_FARM_NORTH_FENCE = 4;
  state.playerState.canonicalRegionalLabour.shifts["JOB-FARM-04"] = 1;
  assert.equal(fence.completedNorthFenceShiftToday(state), true);
  assert.equal(fence.windDownEligible(state, {}), true);

  const action = fence.actions(state, {})?.[0];
  assert.equal(action?.id, "DAILY_LIFE:DAILY_NORTH_FENCE_WORKDAY:finish_watch_notes");
  assert.equal(action?.minutes, 30);
  const goldBefore = state.playerState.player.gold;
  const result = { ok: true };
  assert.equal(fence.consume(state, action, result), true);
  assert.equal(state.playerState.player.gold, goldBefore, "wind-down must not fabricate another wage");
  assert.equal(state.playerState.history.at(-1).wage, 0);

  state.playerState.absoluteMinute = absoluteMinuteFor(4, 22 * 60 + 30);
  assert.equal(fence.windDownEligible(state, {}), false);
});

test("north-fence bridge is Day4/common-state scoped and yields to urgent survival", () => {
  const wrongPlace = runtime();
  wrongPlace.playerState.player.facilityId = "LOC_FARM_BAKERY";
  assert.equal(fence.maintenanceEligible(wrongPlace, {}), false);

  const wrongDay = runtime();
  wrongDay.playerState.absoluteMinute = absoluteMinuteFor(5, 14 * 60 + 39);
  assert.equal(fence.maintenanceEligible(wrongDay, {}), false);

  const urgent = runtime();
  urgent.playerState.player.needs.fatigue = 80;
  assert.equal(fence.maintenanceEligible(urgent, {}), false);
});
