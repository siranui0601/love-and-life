import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  CANONICAL_JOB_TIME_POLICY_INTERNALS as timePolicy,
  CANONICAL_REGIONAL_LABOUR_INTERNALS as labour,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const CATALOG = JSON.parse(readFileSync(
  new URL("../lib/virtue-route-v3-runtime-catalog.json", import.meta.url),
  "utf8",
)).jobs;

const TEST_DAY = 99;

function runtime(job, minuteOfDay) {
  return {
    playerState: {
      day: TEST_DAY,
      absoluteMinute: (TEST_DAY - 1) * 1440 + minuteOfDay,
      player: {
        location: job.region,
        facilityId: job.facilityId,
        gold: 0,
        hunger: 0,
        fatigue: 0,
      },
      progress: {
        villageTrust: 3,
        reputation: 2,
        petraTrust: 2,
        minaTrust: 3,
        technicalKnowledge: true,
        fortEntryPermit: true,
        blackridgeEntryPermit: true,
        hunterApproval: true,
      },
      worldFlags: { elfApproval: true },
      canonicalRegionalLabour: { lastDayByFacility: {}, shifts: {} },
      missions: [],
      troubles: {},
      history: [],
      evidence: {},
    },
  };
}

test("the runtime exposes exactly the 28 canonical jobs, including one-job facilities", () => {
  const tuples = Object.entries(labour.JOBS)
    .flatMap(([facilityId, entries]) => entries.map((entry) => ({ facilityId, entry })));

  assert.equal(CATALOG.length, 28);
  assert.equal(tuples.length, 28);
  assert.ok(Object.values(labour.JOBS).some((entries) => entries.length === 1));
  assert.ok(Object.values(labour.JOBS).some((entries) => entries.length === 2));
  assert.ok(Object.values(labour.JOBS).every((entries) => entries.length <= 2));

  for (const canonical of CATALOG) {
    const tuple = labour.JOBS[canonical.facilityId]
      ?.find((entry) => entry[0] === canonical.jobId);
    assert.deepEqual(tuple, [
      canonical.jobId,
      canonical.label,
      canonical.minutes,
      canonical.wage,
      canonical.freeMeals,
      canonical.risk,
      ...(canonical.condition ? [canonical.condition] : []),
    ]);
    assert.deepEqual(timePolicy.JOB_TIME_WINDOWS[canonical.jobId], canonical.windows);
  }
});

test("every canonical job is a public action only inside its exact work window", () => {
  for (const canonical of CATALOG) {
    const [windowStart, windowEnd] = canonical.windows[0];
    const state = runtime(canonical, windowStart);
    const actionId = `WORK:FACILITY:${canonical.jobId}`;
    const action = authoredMissionFlowExclusiveActions(state)
      ?.find((entry) => entry.id === actionId);

    assert.ok(action, `${actionId} must be public at ${windowStart}`);
    assert.equal(action.actionId, actionId);
    assert.equal(action.targetFacilityId, canonical.facilityId);
    assert.equal(action.minutes, canonical.minutes);
    assert.equal(action.wage, canonical.wage);
    assert.equal(action.canonicalRegionalFreeMeals, canonical.freeMeals);
    assert.equal(windowStart + canonical.minutes <= windowEnd, true);

    const before = runtime(canonical, windowStart - 1);
    assert.equal(
      authoredMissionFlowExclusiveActions(before)
        ?.some((entry) => entry.id === actionId) ?? false,
      false,
      `${actionId} must be hidden before its window`,
    );

    const tooLate = runtime(canonical, windowEnd - canonical.minutes + 1);
    assert.equal(
      authoredMissionFlowExclusiveActions(tooLate)
        ?.some((entry) => entry.id === actionId) ?? false,
      false,
      `${actionId} must be hidden when it cannot finish in its window`,
    );
  }
});

test("canonical requirements gate the same public job action IDs", () => {
  for (const canonical of CATALOG.filter((entry) => entry.condition)) {
    const state = runtime(canonical, canonical.windows[0][0]);
    state.playerState.progress = {};
    state.playerState.worldFlags = {};

    assert.equal(
      labour.ownActions(state)?.some((entry) => entry.id === `WORK:FACILITY:${canonical.jobId}`) ?? false,
      false,
      `${canonical.jobId} must respect ${canonical.condition}`,
    );
  }
});

test("a completed shift records the canonical job and cannot repeat at that facility that day", () => {
  const canonical = CATALOG.find((entry) => entry.jobId === "JOB-TRADE-01");
  const state = runtime(canonical, canonical.windows[0][0]);
  const action = authoredMissionFlowExclusiveActions(state)
    .find((entry) => entry.id === "WORK:FACILITY:JOB-TRADE-01");
  const result = { ok: true };

  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  assert.equal(state.playerState.canonicalRegionalLabour.shifts[canonical.jobId], 1);
  assert.equal(state.playerState.canonicalRegionalLabour.lastDayByFacility[canonical.facilityId], TEST_DAY);
  assert.equal(labour.ownActions(state), null);

  state.playerState.day = TEST_DAY + 1;
  state.playerState.absoluteMinute += 1440;
  assert.ok(labour.ownActions(state)?.some((entry) => entry.id === action.id));
});
