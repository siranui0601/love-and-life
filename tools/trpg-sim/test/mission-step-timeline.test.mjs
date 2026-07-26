import assert from "node:assert/strict";
import test from "node:test";
import { resolveMissionStepVariant } from "../../../src/server/trpg/content/mission-step-variant.js";

test("mission step timeline variants change destination and action without mutating the catalog step", () => {
  const step = {
    id: "rescue",
    type: "battle",
    targetLocation: "犯罪都市",
    targetFacilityId: "LOC_CRIME_SLAVE_MARKET",
    encounterId: "ENC-0042",
    label: "late rescue",
    timelineVariants: [
      { minDay: 18, maxDay: 24, targetLocation: "森", targetFacilityId: "LOC_FOREST_EDGE", actionType: "investigate", label: "early find" },
      { minDay: 25, maxDay: 30, targetLocation: "森", targetFacilityId: "LOC_FOREST_EDGE", actionType: "investigate", label: "camp rescue" },
      { minDay: 31, maxDay: 38, targetLocation: "王都", targetFacilityId: "LOC_CAP_LOWER_INN", actionType: "investigate", label: "capital rescue" },
      { minDay: 39, targetLocation: "犯罪都市", targetFacilityId: "LOC_CRIME_SLAVE_MARKET", actionType: "missionBattle", encounterId: "ENC-0042", label: "market rescue" },
    ],
  };

  assert.deepEqual(
    [20, 27, 34, 40].map((day) => {
      const resolved = resolveMissionStepVariant(step, day);
      return [resolved.targetLocation, resolved.targetFacilityId, resolved.actionType, resolved.encounterId ?? null];
    }),
    [
      ["森", "LOC_FOREST_EDGE", "investigate", "ENC-0042"],
      ["森", "LOC_FOREST_EDGE", "investigate", "ENC-0042"],
      ["王都", "LOC_CAP_LOWER_INN", "investigate", "ENC-0042"],
      ["犯罪都市", "LOC_CRIME_SLAVE_MARKET", "missionBattle", "ENC-0042"],
    ],
  );
  assert.equal(step.targetLocation, "犯罪都市");
  assert.equal(step.targetFacilityId, "LOC_CRIME_SLAVE_MARKET");
  assert.equal(step.actionType, undefined);
});

test("mission step timeline variants return the original step when no day or window matches", () => {
  const step = { id: "resolve", type: "resolve", timelineVariants: [{ minDay: 10, maxDay: 20, label: "window" }] };
  assert.equal(resolveMissionStepVariant(step, {}), step);
  assert.equal(resolveMissionStepVariant(step, 5), step);
});
