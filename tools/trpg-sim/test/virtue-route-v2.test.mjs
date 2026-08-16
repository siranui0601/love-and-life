import test from "node:test";
import assert from "node:assert/strict";

import { loadTrpgGameData, resetTrpgGameDataForTests } from "../../../src/server/trpg/game/game-data.js";
import { CANONICAL_REGIONAL_LABOUR_INTERNALS } from "../../../src/server/trpg/content/canonical-regional-labour.js";
import { createSpecialMission } from "../lib/mission-model.mjs";
import { VIRTUE_ROUTE_V2, validateVirtueRouteV2Contract } from "../lib/virtue-route-v2-contract.mjs";

test("virtue route v2 partitions exactly T01-T19 and ends naturally on Day85", () => {
  assert.equal(VIRTUE_ROUTE_V2.endingDay, 85);
  assert.equal(VIRTUE_ROUTE_V2.resolvedTroubles.length, 16);
  assert.deepEqual(VIRTUE_ROUTE_V2.suppressedTroubles, ["T15", "T18", "T19"]);
  assert.equal(VIRTUE_ROUTE_V2.skillPoints.earned - VIRTUE_ROUTE_V2.skillPoints.spent, VIRTUE_ROUTE_V2.skillPoints.remaining);
  assert.equal(VIRTUE_ROUTE_V2.finance.minimumGold, 0);
  assert.equal(VIRTUE_ROUTE_V2.finance.finalGold, 51);
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

test("regional jobs are ordinary facility work, not a virtue-only gate", () => {
  const jobs = CANONICAL_REGIONAL_LABOUR_INTERNALS.JOBS;
  for (const facilityId of ["LOC_DWARF_MARKET", "LOC_BORDER_INN", "LOC_FORT_SUPPLY", "LOC_BLACKRIDGE_MARKET"]) {
    assert.ok(Array.isArray(jobs[facilityId]), `${facilityId} must expose jobs`);
    assert.ok(jobs[facilityId].length >= 3, `${facilityId} must offer a real three-choice work set`);
    for (const entry of jobs[facilityId]) assert.match(entry[0], /^JOB-/u);
  }
});

test("representative build actually updates equipment instead of carrying starter gear to endgame", () => {
  const ids = VIRTUE_ROUTE_V2.equipment.map((entry) => entry.id);
  assert.ok(ids.includes("EQP-W-0301"));
  assert.ok(ids.includes("EQP-W-0302"));
  assert.ok(VIRTUE_ROUTE_V2.equipment.some((entry) => entry.day >= 40));
  assert.equal(VIRTUE_ROUTE_V2.skills.length, VIRTUE_ROUTE_V2.skillPoints.spent);
});
