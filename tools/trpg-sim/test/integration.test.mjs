import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadBattleData } from "../lib/battle-model.mjs";
import { createMatchedBuild, recommendedEncounterLevel, runBattleSuite } from "../lib/battle-suite.mjs";
import { inspectPublicCatalog } from "../lib/report.mjs";
import { loadWorldModel } from "../lib/world-model.mjs";
import { simulateWorld } from "../lib/world-simulator.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../../..");

test("tuned autonomous world remains deterministic and strictly valid", () => {
  const model = loadWorldModel();
  const options = {
    model,
    seed: "integration-tuned-world",
    tuning: { neutralMitigationProbability: 0.58, resolutionDifficultyScale: 0.6 },
  };
  const first = simulateWorld(options);
  const second = simulateWorld(options);
  assert.equal(first.invariants.ok, true);
  assert.equal(first.tickCount, 400);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.tuning.resolutionDifficultyScale, 0.6);
});

test("world tuning rejects invalid probabilities and scales", () => {
  const model = loadWorldModel();
  assert.throws(() => simulateWorld({ model, tuning: { neutralMitigationProbability: 2 } }), /between 0 and 1/);
  assert.throws(() => simulateWorld({ model, tuning: { resolutionDifficultyScale: 0 } }), /greater than 0/);
});

test("matched battle builds cover every encounter level and suite mode", async () => {
  const data = await loadBattleData();
  for (const encounter of data.encounters) {
    const level = recommendedEncounterLevel(data, encounter);
    for (const archetype of ["physical", "magic"]) {
      const build = createMatchedBuild(data, { level, archetype });
      assert.ok(build.equipmentIds.length >= 2, `${encounter.id}/${archetype} has equipment`);
      assert.ok(build.equipmentIds.every((id) => data.equipmentById.get(id).recommendedLevelMin <= level));
    }
  }
  const suite = runBattleSuite({ data, runsPerScenario: 1, partyRunsPerEncounter: 1, seed: "integration-suite" });
  assert.equal(suite.fixedRows.length, 76 * 5);
  assert.equal(suite.matchedRows.length, 76 * 2);
  assert.equal(suite.partyRows.length, 76);
  assert.equal(suite.totalBattles, 608);
});

test("broken legacy public catalog is visible to the report instead of silently accepted", () => {
  const catalog = inspectPublicCatalog(projectRoot);
  assert.equal(catalog.partCount, 8);
  assert.equal(catalog.checksumMatches, false);
  assert.equal(catalog.gzipValid, false);
});
