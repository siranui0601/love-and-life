import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_MISSION_FLOW_REGISTRY_INTERNALS as registry,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;

function runtimeAt(facilityId, { day = 2, wallMinute = 6 * 60 + 30, gold = 40, hunger = 66.6, fatigue = 0 } = {}) {
  return {
    playerState: {
      absoluteMinute: absoluteMinuteFor(day, wallMinute),
      day,
      player: {
        location: "田園の村",
        facilityId,
        gold,
        freeMeals: 0,
        freeLodging: 0,
        needs: { hunger, fatigue },
        hunger,
        fatigue,
      },
      missions: {
        "MSN-T01": { id: "MSN-T01", status: "completed" },
      },
      progress: {},
      worldFlags: {},
      history: [],
    },
  };
}

test("Day2 breakfast stays visible beside ordinary inn labour and sorts before sleep/work", () => {
  const runtime = runtimeAt("LOC_FARM_INN");
  const work = [{
    id: "WORK:FACILITY:JOB-FARM-03",
    actionId: "WORK:FACILITY:JOB-FARM-03",
    type: "work",
    canonicalRegionalLabourChoice: true,
  }];

  const merged = registry.mergePublicProductsBesideRoutineLife(runtime, work);
  assert.equal(merged[0].id, "LIFE:EAT:ITM003");
  assert.ok(merged.some((action) => action.id === "LIFE:EAT:ITM004"));
  assert.ok(merged.some((action) => action.id === "LIFE:SLEEP:ITM001"));
  assert.ok(merged.some((action) => action.id === "WORK:FACILITY:JOB-FARM-03"));
  assert.equal(merged.some((action) => action.canonicalWorldLifeKind === "eat_provision"), false);
});

test("bakery purchases stay visible beside ordinary bakery labour without free inventory eating", () => {
  const runtime = runtimeAt("LOC_FARM_BAKERY", { wallMinute: 12 * 60, hunger: 30 });
  const work = [{
    id: "WORK:FACILITY:JOB-FARM-BAKERY",
    actionId: "WORK:FACILITY:JOB-FARM-BAKERY",
    type: "work",
    canonicalRegionalLabourChoice: true,
  }];

  const merged = registry.mergePublicProductsBesideRoutineLife(runtime, work);
  assert.ok(merged.some((action) => action.id === "LIFE:BUY:ITM008"));
  assert.ok(merged.some((action) => action.id === "LIFE:BUY:ITM010"));
  assert.equal(merged.some((action) => action.id === "LIFE:EAT:ITM008"), false);
  assert.equal(merged.some((action) => action.id === "LIFE:EAT:ITM010"), false);
});