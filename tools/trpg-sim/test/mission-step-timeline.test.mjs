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


test("T09-style timeline variants preserve prevention, two battle stages and post-deadline recovery", () => {
  const step = {
    id: "battle",
    type: "battle",
    targetLocation: "ドワーフ洞窟",
    targetFacilityId: "LOC_DWARF_MINE",
    encounterId: "ENC-0050",
    timelineVariants: [
      { minDay: 27, maxDay: 27, actionType: "investigate", encounterId: null, label: "prevent" },
      { minDay: 28, maxDay: 29, targetFacilityId: "LOC_DWARF_ENGINEER", actionType: "missionBattle", encounterId: "ENC-0049", label: "machine" },
      { minDay: 30, maxDay: 32, actionType: "missionBattle", encounterId: "ENC-0050", label: "collapse" },
      { minDay: 33, actionType: "investigate", encounterId: null, label: "recover records" },
    ],
  };

  assert.deepEqual(
    [27, 28, 31, 33].map((day) => {
      const resolved = resolveMissionStepVariant(step, day);
      return [resolved.targetFacilityId, resolved.actionType, resolved.encounterId, resolved.label];
    }),
    [
      ["LOC_DWARF_MINE", "investigate", null, "prevent"],
      ["LOC_DWARF_ENGINEER", "missionBattle", "ENC-0049", "machine"],
      ["LOC_DWARF_MINE", "missionBattle", "ENC-0050", "collapse"],
      ["LOC_DWARF_MINE", "investigate", null, "recover records"],
    ],
  );
});



test("T10-style timeline variants preserve injunction, execution stay and post-eviction household reassembly", () => {
  const step = {
    id: "battle",
    type: "battle",
    targetLocation: "王都",
    targetFacilityId: "LOC_CAP_OFFICE",
    encounterId: null,
    actionType: "investigate",
    timelineVariants: [
      { minDay: 26, maxDay: 43, targetFacilityId: "LOC_CAP_OFFICE", actionType: "investigate", encounterId: null, label: "injunction" },
      { minDay: 44, maxDay: 56, targetFacilityId: "LOC_CAP_ORPHANAGE", actionType: "investigate", encounterId: null, label: "execution stay" },
      { minDay: 57, maxDay: 69, targetFacilityId: "LOC_CAP_LOWER_INN", actionType: "investigate", encounterId: null, label: "reassemble" },
    ],
  };

  assert.deepEqual(
    [30, 50, 60].map((day) => {
      const resolved = resolveMissionStepVariant(step, day);
      return [resolved.targetFacilityId, resolved.actionType, resolved.encounterId, resolved.label];
    }),
    [
      ["LOC_CAP_OFFICE", "investigate", null, "injunction"],
      ["LOC_CAP_ORPHANAGE", "investigate", null, "execution stay"],
      ["LOC_CAP_LOWER_INN", "investigate", null, "reassemble"],
    ],
  );
});


test("T11-style timeline variants prefer an external-trouble escalation before the same-day fallback", () => {
  const step = {
    id: "battle",
    type: "battle",
    targetLocation: "王都",
    targetFacilityId: "LOC_CAP_CASTLE",
    encounterId: "ENC-0025",
    timelineVariants: [
      { minDay: 20, maxDay: 34, actionType: "investigate", encounterId: null, label: "rehearsal" },
      { minDay: 35, maxDay: 48, actionType: "missionBattle", encounterId: "ENC-0025", label: "attempt" },
      { minDay: 49, maxDay: 59, troubleId: "T14", troubleStatuses: ["critical", "failed"], actionType: "missionBattle", encounterId: "ENC-0043", label: "armed uprising" },
      { minDay: 49, maxDay: 59, actionType: "missionBattle", encounterId: "ENC-0025", label: "main assassination" },
    ],
  };

  assert.equal(resolveMissionStepVariant(step, { day: 30, troubles: {} }).label, "rehearsal");
  assert.equal(resolveMissionStepVariant(step, { day: 40, troubles: {} }).label, "attempt");
  assert.equal(resolveMissionStepVariant(step, { day: 49, troubles: { T14: { status: "active" } } }).encounterId, "ENC-0025");
  assert.equal(resolveMissionStepVariant(step, { day: 49, troubles: { T14: { status: "critical" } } }).encounterId, "ENC-0043");
  assert.equal(resolveMissionStepVariant(step, { day: 49, troubles: { T14: { status: "failed" } } }).label, "armed uprising");
  assert.equal(step.encounterId, "ENC-0025");
});

test("T12-style timeline variants keep T14 failure as the armed escalation before the same-day noncombat fallback", () => {
  const step = {
    id: "battle",
    type: "battle",
    targetLocation: "北陵要塞",
    targetFacilityId: "LOC_FORT_GATE",
    encounterId: "ENC-0055",
    timelineVariants: [
      { minDay: 30, maxDay: 38, targetFacilityId: "LOC_FORT_SUPPLY", actionType: "investigate", encounterId: null, label: "freeze staging" },
      { minDay: 39, maxDay: 45, targetFacilityId: "LOC_FORT_WALL", actionType: "missionBattle", encounterId: "ENC-0055", label: "pre-operation" },
      { minDay: 46, maxDay: 55, targetFacilityId: "LOC_FORT_GATE", actionType: "missionBattle", encounterId: "ENC-0055", label: "returning unit" },
      { minDay: 56, maxDay: 67, troubleId: "T14", troubleStatuses: ["critical", "failed"], targetFacilityId: "LOC_FORT_WALL", actionType: "missionBattle", encounterId: "ENC-0056", label: "armed front" },
      { minDay: 56, maxDay: 67, targetFacilityId: "LOC_FORT_COMMAND", actionType: "investigate", encounterId: null, label: "stay mobilization" },
    ],
  };

  assert.equal(resolveMissionStepVariant(step, { day: 34, troubles: {} }).label, "freeze staging");
  assert.equal(resolveMissionStepVariant(step, { day: 42, troubles: {} }).encounterId, "ENC-0055");
  assert.equal(resolveMissionStepVariant(step, { day: 48, troubles: {} }).label, "returning unit");
  assert.equal(resolveMissionStepVariant(step, { day: 60, troubles: { T14: { status: "active" } } }).label, "stay mobilization");
  assert.equal(resolveMissionStepVariant(step, { day: 60, troubles: { T14: { status: "critical" } } }).encounterId, "ENC-0056");
  assert.equal(resolveMissionStepVariant(step, { day: 60, troubles: { T14: { status: "failed" } } }).label, "armed front");
  assert.equal(step.encounterId, "ENC-0055");
});

test("T13-style timeline variants escalate from small slime to world-tree eater without changing the original step", () => {
  const step = {
    id: "battle",
    type: "battle",
    targetLocation: "森",
    targetFacilityId: "LOC_FOREST_RIVER",
    encounterId: "ENC-0016",
    timelineVariants: [
      { minDay: 1, maxDay: 17, targetFacilityId: "LOC_FOREST_RIVER", actionType: "missionBattle", encounterId: "ENC-0015", label: "small" },
      { minDay: 18, maxDay: 31, targetFacilityId: "LOC_FOREST_RIVER", actionType: "missionBattle", encounterId: "ENC-0016", label: "swollen" },
      { minDay: 32, maxDay: 44, targetFacilityId: "LOC_FOREST_RIVER", actionType: "missionBattle", encounterId: "ENC-0016", label: "rumor" },
      { minDay: 45, maxDay: 57, targetFacilityId: "LOC_FOREST_RIVER", actionType: "missionBattle", encounterId: "ENC-0017", label: "giant" },
      { minDay: 58, maxDay: 60, targetLocation: "エルフの隠れ里", targetFacilityId: "LOC_ELF_WORLD_TREE", actionType: "missionBattle", encounterId: "ENC-0018", label: "world-tree eater" },
    ],
  };

  assert.deepEqual(
    [10, 20, 36, 50, 59].map((day) => {
      const resolved = resolveMissionStepVariant(step, { day, troubles: {} });
      return [resolved.targetLocation, resolved.targetFacilityId, resolved.encounterId, resolved.label];
    }),
    [
      ["森", "LOC_FOREST_RIVER", "ENC-0015", "small"],
      ["森", "LOC_FOREST_RIVER", "ENC-0016", "swollen"],
      ["森", "LOC_FOREST_RIVER", "ENC-0016", "rumor"],
      ["森", "LOC_FOREST_RIVER", "ENC-0017", "giant"],
      ["エルフの隠れ里", "LOC_ELF_WORLD_TREE", "ENC-0018", "world-tree eater"],
    ],
  );
  assert.equal(step.encounterId, "ENC-0016");
  assert.equal(step.targetFacilityId, "LOC_FOREST_RIVER");
});
