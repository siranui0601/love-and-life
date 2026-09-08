import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_VILLAGE_INN_WORKDAY_INTERNALS as inn,
} from "../../../src/server/trpg/content/authored-village-inn-workday.js";
import {
  CANONICAL_JOB_TIME_POLICY_INTERNALS as jobTime,
} from "../../../src/server/trpg/content/canonical-job-time-policy.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;

function runtime(wallMinute = 14 * 60 + 42) {
  return {
    playerState: {
      absoluteMinute: absoluteMinuteFor(3, wallMinute),
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_INN",
        gold: 23,
        needs: { hunger: 1, fatigue: 27 },
      },
      canonicalRegionalLabour: { lastDayByFacility: {}, shifts: {} },
      worldFlags: {},
      history: [],
      missions: [],
    },
  };
}

const canonicalInnJob = Object.freeze({
  canonicalRegionalJobId: "JOB-FARM-03",
  minutes: 120,
});

test("Day3 inn prep bridges the real 14:42 arrival to the canonical 16:00 shift without widening work hours", () => {
  const state = runtime();
  assert.equal(jobTime.jobTimeAllowed(state, canonicalInnJob), false, "14:42 must remain outside the canonical evening shift");
  assert.equal(inn.prepEligible(state, {}), true);
  const action = inn.actions(state, {})?.[0];
  assert.equal(action?.id, "DAILY_LIFE:DAILY_INN_WORKDAY:prepare_evening_service");
  assert.equal(action?.minutes, 78);
  assert.equal(action?.type, "plan");
  assert.equal("route" in action || "virtue" in action, false);

  state.playerState.absoluteMinute = absoluteMinuteFor(3, 16 * 60);
  assert.equal(jobTime.jobTimeAllowed(state, canonicalInnJob), true, "16:00-18:00 is the Sheet-backed evening shift");
  assert.equal(inn.prepEligible(state, {}), false);
});

test("post-shift wind-down requires the actual canonical inn shift and reaches 22:30 without another wage", () => {
  const state = runtime(18 * 60);
  assert.equal(inn.windDownEligible(state, {}), false, "ordinary evening life must not claim a shift that never happened");

  state.playerState.canonicalRegionalLabour.lastDayByFacility.LOC_FARM_INN = 3;
  state.playerState.canonicalRegionalLabour.shifts["JOB-FARM-03"] = 1;
  assert.equal(inn.completedInnShiftToday(state), true);
  assert.equal(inn.windDownEligible(state, {}), true);

  const action = inn.actions(state, {})?.[0];
  assert.equal(action?.id, "DAILY_LIFE:DAILY_INN_WORKDAY:wind_down_after_shift");
  assert.equal(action?.minutes, 270);
  const goldBefore = state.playerState.player.gold;
  const result = { ok: true };
  assert.equal(inn.consume(state, action, result), true);
  assert.equal(state.playerState.player.gold, goldBefore, "wind-down must not fabricate a second wage");
  assert.equal(state.playerState.history.at(-1).wage, 0);

  state.playerState.absoluteMinute = absoluteMinuteFor(3, 22 * 60 + 30);
  assert.equal(inn.windDownEligible(state, {}), false);
});

test("the bridge is Day3/inn/common-state scoped and does not replace higher-priority mission scenes", () => {
  const wrongPlace = runtime();
  wrongPlace.playerState.player.facilityId = "LOC_FARM_BAKERY";
  assert.equal(inn.prepEligible(wrongPlace, {}), false);

  const urgent = runtime();
  urgent.playerState.player.needs.fatigue = 80;
  assert.equal(inn.prepEligible(urgent, {}), false);
});
