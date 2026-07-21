import assert from "node:assert/strict";
import test from "node:test";
import {
  facilityVisibility,
  filterVisibleFacilities,
  findExclusiveFacilityConflicts,
} from "../../../src/server/trpg/resolvers/facility-visibility-resolver.js";

const facilities = [
  { id: "LOC_CAP_ORPHANAGE", name: "白鈴孤児院" },
  { id: "LOC_CAP_BIG_STORE", name: "孤児院跡地大型店" },
  { id: "LOC_CAP_LOWER_INN", name: "下層の安宿" },
];

function state(day, status) {
  return { day, troubles: { T10: { status } } };
}

test("the orphanage is visible before T10 failure", () => {
  assert.equal(facilityVisibility("LOC_CAP_ORPHANAGE", state(80, "active")).visible, true);
  assert.equal(facilityVisibility("LOC_CAP_BIG_STORE", state(80, "active")).visible, false);
  assert.deepEqual(filterVisibleFacilities(facilities, state(80, "active")).map((facility) => facility.id), [
    "LOC_CAP_ORPHANAGE",
    "LOC_CAP_LOWER_INN",
  ]);
});

test("the site is closed between T10 failure and Day 70", () => {
  assert.equal(facilityVisibility("LOC_CAP_ORPHANAGE", state(69, "failed")).visible, false);
  assert.equal(facilityVisibility("LOC_CAP_BIG_STORE", state(69, "failed")).visible, false);
});

test("only the replacement store is visible from Day 70 after failure", () => {
  assert.equal(facilityVisibility("LOC_CAP_ORPHANAGE", state(70, "failed")).visible, false);
  assert.equal(facilityVisibility("LOC_CAP_BIG_STORE", state(70, "failed")).visible, true);
  assert.deepEqual(filterVisibleFacilities(facilities, state(70, "failed")).map((facility) => facility.id), [
    "LOC_CAP_BIG_STORE",
    "LOC_CAP_LOWER_INN",
  ]);
  assert.deepEqual(findExclusiveFacilityConflicts(facilities, state(70, "failed")), []);
});
