import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { loadTrpgGameData, resetTrpgGameDataForTests } from "../../../src/server/trpg/game/game-data.js";
import { CANONICAL_REGIONAL_LABOUR_INTERNALS } from "../../../src/server/trpg/content/canonical-regional-labour.js";
import { CANONICAL_JOB_TIME_POLICY_INTERNALS } from "../../../src/server/trpg/content/canonical-job-time-policy.js";
import { createSpecialMission } from "../lib/mission-model.mjs";
import { VIRTUE_ROUTE_V2, validateVirtueRouteV2Contract } from "../lib/virtue-route-v2-contract.mjs";

test("virtue route v2 partitions exactly T01-T19 and ends naturally on Day85", () => {
  assert.equal(VIRTUE_ROUTE_V2.endingDay, 85);
  assert.equal(VIRTUE_ROUTE_V2.resolvedTroubles.length, 16);
  assert.deepEqual(VIRTUE_ROUTE_V2.suppressedTroubles, ["T15", "T18", "T19"]);
  assert.equal(VIRTUE_ROUTE_V2.skillPoints.earned - VIRTUE_ROUTE_V2.skillPoints.spent, VIRTUE_ROUTE_V2.skillPoints.remaining);
  assert.equal(VIRTUE_ROUTE_V2.finance.minimumGold, 0);
  assert.equal(VIRTUE_ROUTE_V2.finance.finalGold, 55);
});

test("live canonical sheet deltas are reachable through normal game data", () => {
  resetTrpgGameDataForTests();
  const gameData = loadTrpgGameData();
  assert.deepEqual(validateVirtueRouteV2Contract(gameData), []);
});

test("T13 special mission selects the Day58-60 final encounter, not an early stage slime", () => {
  resetTrpgGameDataForTests();
  const gameData = loadTrpgGameData();
  const t13 = gameData.model.troubleById.T13;
  const mission = createSpecialMission(t13, gameData.battleData, gameData.model);
  const battleSteps = mission.steps.filter((step) => step.type === "battle");
  assert.ok(battleSteps.length > 0);
  assert.ok(battleSteps.every((step) => step.encounterId === "ENC-0018"));
  assert.equal(gameData.battleData.encounterById.get("ENC-0018")?.composition?.[0]?.monsterId, "MON-0018");
});

test("all 28 canonical jobs match the Sheet-backed runtime catalog and only appear in valid work windows", () => {
  const expected = JSON.parse(readFileSync(
    new URL("../lib/virtue-route-v3-runtime-catalog.json", import.meta.url),
    "utf8",
  )).jobs;
  const jobs = CANONICAL_REGIONAL_LABOUR_INTERNALS.JOBS;
  const windows = CANONICAL_JOB_TIME_POLICY_INTERNALS.JOB_TIME_WINDOWS;
  const actualIds = Object.values(jobs).flat().map((entry) => entry[0]).sort();

  assert.equal(expected.length, 28);
  assert.deepEqual(actualIds, expected.map((entry) => entry.jobId).sort());

  for (const canonical of expected) {
    const tuple = jobs[canonical.facilityId]?.find((entry) => entry[0] === canonical.jobId);
    assert.ok(tuple, `${canonical.jobId} must exist at ${canonical.facilityId}`);
    assert.deepEqual(tuple, [
      canonical.jobId,
      canonical.label,
      canonical.minutes,
      canonical.wage,
      canonical.freeMeals,
      canonical.risk,
      ...(canonical.condition ? [canonical.condition] : []),
    ]);
    assert.deepEqual(windows[canonical.jobId], canonical.windows);

    const [validStart] = canonical.windows[0];
    const runtime = {
      playerState: {
        day: 1,
        absoluteMinute: validStart,
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
        canonicalRegionalLabour: { lastDayByFacility: {}, shifts: {} },
        player: {
          location: canonical.region,
          facilityId: canonical.facilityId,
          gold: 0,
        },
      },
    };
    const offered = CANONICAL_REGIONAL_LABOUR_INTERNALS.ownActions(runtime);
    const action = offered?.find((entry) => entry.id === `WORK:FACILITY:${canonical.jobId}`);
    assert.ok(action, `${canonical.jobId} must be an ordinary public facility action`);
    assert.equal(action.targetFacilityId, canonical.facilityId);
    assert.equal(action.minutes, canonical.minutes);
    assert.equal(action.wage, canonical.wage);
    assert.equal(CANONICAL_JOB_TIME_POLICY_INTERNALS.jobTimeAllowed(runtime, action), true);

    runtime.playerState.absoluteMinute = validStart - 1;
    assert.equal(CANONICAL_JOB_TIME_POLICY_INTERNALS.jobTimeAllowed(runtime, action), false);
    assert.equal(
      CANONICAL_JOB_TIME_POLICY_INTERNALS.filterActions(runtime, offered)
        ?.some((entry) => entry.id === action.id) ?? false,
      false,
    );
  }
});

test("representative build actually updates equipment instead of carrying starter gear to endgame", () => {
  const ids = VIRTUE_ROUTE_V2.equipment.map((entry) => entry.id);
  assert.ok(ids.includes("EQP-W-0301"));
  assert.ok(ids.includes("EQP-W-0302"));
  assert.ok(VIRTUE_ROUTE_V2.equipment.some((entry) => entry.day >= 40));
  assert.equal(VIRTUE_ROUTE_V2.skills.length, VIRTUE_ROUTE_V2.skillPoints.spent);
});
