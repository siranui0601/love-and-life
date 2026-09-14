import assert from "node:assert/strict";
import test from "node:test";

import { runSourceAudit } from "../lib/source-audit.mjs";

const audit = runSourceAudit();

test("three spreadsheet snapshots contain every expected design row", () => {
  assert.deepEqual(audit.countMismatches, []);
  for (const repeated of Object.values(audit.duplicateIds)) {
    assert.deepEqual(repeated, []);
  }
});

test("hard foreign-key references are internally valid", () => {
  assert.deepEqual(audit.references.missingTroubleReferences, []);
  assert.deepEqual(audit.references.invalidStockEquipment, []);
  assert.deepEqual(audit.references.invalidActionMonsters, []);
  assert.deepEqual(audit.references.invalidActionSkills, []);
  assert.deepEqual(audit.references.invalidEncounterMonsters, []);
  assert.deepEqual(audit.references.invalidGrantedSkills, []);
  assert.deepEqual(audit.skills.persistedProgressPathsMissingFromDictionary, []);
});

test("known source-contract gaps remain visible instead of being silently repaired", () => {
  assert.deepEqual(
    audit.references.missingFacilityReferences.map(({ id }) => id),
    ["LOC_FARM_BOARD", "LOC_TRADE_DOCK"]
  );
  assert.ok(audit.skills.unreferencedEquipmentSkills.length >= 100);
  assert.ok(audit.skills.provisionalSkillIds.length >= 90);
  assert.ok(audit.world.chainCycles.includes("T04->T17"));
  assert.ok(audit.world.chainCycles.includes("T06->T14"));
  assert.deepEqual(audit.battle.monstersWithoutUnconditionalAction, []);
  assert.deepEqual(audit.battle.specialStateContractMismatches, []);
});
