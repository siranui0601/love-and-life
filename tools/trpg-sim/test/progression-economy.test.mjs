import test from "node:test";
import assert from "node:assert/strict";

import {
  auditSkillProgression,
  createConditionCoverage,
  evaluatePredicate,
  skillPointSupplyForLevel,
} from "../lib/skill-progression.mjs";
import { auditEconomy, parseGold } from "../lib/economy.mjs";
import { loadCanonicalBattleSnapshotSync } from "../lib/canonical-battle-snapshot.mjs";

const predicateContext = {
  player: {
    level: 7,
    skills: ["SKL-A", "SKL-B"],
    title: "forest-ranger",
    active: true,
    retired: false,
    score: 12,
  },
};

function canonicalBattleDataRows(tabName) {
  const snapshot = loadCanonicalBattleSnapshotSync();
  const provenance = snapshot.provenance?.[tabName];
  assert.ok(provenance, `canonical battle provenance missing for ${tabName}`);
  return provenance.rowCount - 4;
}

test("generic predicate evaluator supports every required logical and leaf operator", () => {
  const leaf = (op, value, path = "score") => ({ scope: "player", path, op, value });
  const cases = [
    [leaf("eq", 12), true],
    [leaf("ne", 11), true],
    [leaf("gt", 11), true],
    [leaf("gte", 12), true],
    [leaf("lt", 13), true],
    [leaf("lte", 12), true],
    [leaf("between", [10, 12]), true],
    [{ scope: "player", path: "active", op: "isTrue" }, true],
    [{ scope: "player", path: "retired", op: "isFalse" }, true],
    [leaf("contains", "SKL-A", "skills"), true],
    [leaf("notContains", "SKL-Z", "skills"), true],
    [leaf("containsAll", ["SKL-A", "SKL-B"], "skills"), true],
    [leaf("containsAny", ["SKL-Z", "SKL-B"], "skills"), true],
    [{ all: [leaf("gte", 7, "level"), leaf("contains", "SKL-A", "skills")] }, true],
    [{ any: [leaf("lt", 1, "level"), leaf("eq", 7, "level")] }, true],
    [{ not: leaf("eq", 99, "level") }, true],
    [{ op: "all", conditions: [leaf("gte", 7, "level"), leaf("lte", 7, "level")] }, true],
    [{ op: "any", value: [leaf("eq", 1, "level"), leaf("eq", 7, "level")] }, true],
    [{ op: "not", value: leaf("eq", 1, "level") }, true],
  ];
  const coverage = createConditionCoverage();
  for (const [predicate, expected] of cases) {
    assert.equal(evaluatePredicate(predicate, predicateContext, coverage), expected);
  }
  assert.equal(evaluatePredicate([leaf("gte", 7, "level"), leaf("contains", "SKL-B", "skills")], predicateContext), true);
  assert.equal(evaluatePredicate(leaf("eq", 1, "missing.path"), predicateContext), false);
  assert.throws(
    () => evaluatePredicate(leaf("unsupported", 1), predicateContext),
    /Unsupported predicate operator/,
  );
  for (const operator of [
    "eq", "ne", "gt", "gte", "lt", "lte", "between", "isTrue", "isFalse",
    "contains", "notContains", "containsAll", "containsAny", "all", "any", "not",
  ]) {
    assert.ok(coverage.byOperator[operator], `coverage should include ${operator}`);
  }
});

test("skill progression runs six reproducible Day1-100 profiles with bounded SP", () => {
  const first = auditSkillProgression({ seed: 77 });
  const second = auditSkillProgression({ seed: 77 });
  const differentSeed = auditSkillProgression({ seed: 78 });
  assert.deepEqual(first.profiles, second.profiles);
  assert.deepEqual(first.diagnostics, second.diagnostics);
  assert.notDeepEqual(
    first.profiles.map((profile) => profile.acquiredSkillIds),
    differentSeed.profiles.map((profile) => profile.acquiredSkillIds),
  );

  assert.equal(first.totals.skills, 1141);
  assert.deepEqual(first.totals.classifications, {
    basic_level_up: 63,
    flag_unlocked: 436,
    equipment_granted: 162,
    event_granted: 325,
    deleted: 113,
    non_skill: 42,
  });
  assert.equal(first.totals.spAcquisitionCandidates, 499);
  assert.equal(first.profiles.length, 6);
  assert.equal(skillPointSupplyForLevel(1), 2);
  assert.equal(skillPointSupplyForLevel(24), 25);

  for (const profile of first.profiles) {
    assert.deepEqual(profile.milestones.map((entry) => entry.day), [1, 10, 25, 50, 75, 100]);
    assert.ok(profile.spSpent <= profile.spSupply);
    assert.equal(profile.acquiredCount, profile.spSpent, "all permanent candidates cost one SP");
  }
  const completionist = first.profiles.find((profile) => profile.id === "completionist");
  assert.equal(completionist.visibleCount, 499);
  assert.equal(completionist.unlockedCount, 499);
  assert.equal(completionist.spSupply, 25);
  assert.ok(first.conditionCoverage.evaluations > 0);
  assert.equal(first.totals.conditionPaths, 134);
  assert.equal(first.totals.dictionaryPaths, 118);
});

test("skill audit exposes missing grant supply without confusing it with prerequisite corruption", () => {
  const report = auditSkillProgression({ seed: 99 });
  assert.equal(report.diagnostics.prerequisites.missing.length, 0);
  assert.equal(report.diagnostics.prerequisites.cycles.length, 0);
  assert.equal(report.diagnostics.eventGranted.classifiedCount, 325);
  assert.equal(report.diagnostics.eventGranted.structuredSourceCount, 0);
  assert.equal(report.diagnostics.eventGranted.unsupplied.length, 325);
  assert.equal(report.diagnostics.equipmentGranted.classifiedCount, 162);
  assert.ok(report.diagnostics.equipmentGranted.unreferenced.length > 0);
  assert.ok(report.diagnostics.equipmentGranted.referenceClassificationMismatches.length > 0);
  assert.ok(report.conditionCoverage.dictionaryMissingPaths.length > 0);
});

test("economy audit joins all product, equipment, stock and monster snapshots", () => {
  const report = auditEconomy();
  const canonicalEquipment = canonicalBattleDataRows("装備性能マスター");
  const canonicalStock = canonicalBattleDataRows("店舗装備在庫");
  const canonicalMonsters = canonicalBattleDataRows("モンスター一覧");
  assert.deepEqual(report.totals, {
    products: 219,
    equipment: canonicalEquipment,
    equipmentStockRows: canonicalStock,
    stockedEquipment: canonicalEquipment,
    monsters: canonicalMonsters,
  });
  assert.equal(report.diagnostics.missingEquipmentForStock.length, 0);
  assert.equal(report.diagnostics.unstockedEquipment.length, 0);
  assert.ok(report.pricePerformance.stockPearson >= -1 && report.pricePerformance.stockPearson <= 1);
  assert.ok(report.pricePerformance.stockSpearman >= -1 && report.pricePerformance.stockSpearman <= 1);
  assert.ok(report.pareto.dominated.length > 0);
  assert.equal(report.affordability.length, 6);
  assert.equal(parseGold("1,100G"), 1100);
});

test("economy diagnostics catch the zero-gold opening and legacy price conflict", () => {
  const report = auditEconomy();
  assert.equal(report.startingSurvival.startingGold, 0);
  assert.equal(report.startingSurvival.minimumMeal, 1);
  assert.equal(report.startingSurvival.minimumLodging, 4);
  assert.equal(report.startingSurvival.minimumFirstDayCost, 5);
  assert.equal(report.startingSurvival.softLockRisk, true);
  assert.equal(report.diagnostics.legacy.linkedCount, 22);
  assert.deepEqual(report.diagnostics.legacy.priceMismatches, [
    {
      stockId: "STK-0019",
      equipmentId: "EQP-W-0016",
      itemId: "ITM045",
      itemName: "槍",
      productPrice: 60,
      equipmentStockPrice: 160,
      difference: 100,
    },
  ]);
  assert.equal(report.diagnostics.nonStructuredRules.worldProductPriceRuleCount, 186);
  assert.ok(report.diagnostics.nonStructuredRules.equipmentStockPriceRuleCount > 0);
  assert.ok(report.diagnostics.zeroPriceEquipmentSources.length > 0);
});
