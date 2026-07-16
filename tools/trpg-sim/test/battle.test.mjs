import assert from "node:assert/strict";
import test from "node:test";

import {
  BATTLE_ASSUMPTIONS,
  calculateCriticalChance,
  calculateHitChance,
  calculateMagicDamage,
  calculatePhysicalDamage,
  createPlayerBuild,
  createSeededRng,
  effectiveAttack,
  expandEncounter,
  loadBattleData,
} from "../lib/battle-model.mjs";
import {
  createDefaultBuilds,
  runMonteCarlo,
  simulateBattle,
} from "../lib/battle-simulator.mjs";

const data = await loadBattleData();

function observerBuild() {
  return createPlayerBuild(data, {
    id: "observer",
    name: "Candidate exhaustion observer",
    level: 1,
    equipmentIds: [],
    skillIds: [],
    baseStats: {
      maxHp: 10_000,
      maxMp: 100,
      attack: 0,
      defense: 100,
      agility: 1,
      luck: 0,
      physicalPower: 1,
      magicPower: 1,
      magicResistance: 100,
      accuracy: 0,
      evasion: 0,
      critical: 0,
      debuffSuccess: 0,
      debuffResistance: 100,
    },
  });
}

test("battle fixture joins every combat table and all four skill shards", () => {
  assert.deepEqual({
    equipment: data.equipment.length,
    inventory: data.inventory.length,
    monsters: data.monsters.length,
    monsterSkills: data.monsterSkills.length,
    monsterActions: data.monsterActions.length,
    encounters: data.encounters.length,
    playerSkills: data.playerSkills.length,
  }, {
    equipment: 116,
    inventory: 123,
    monsters: 77,
    monsterSkills: 96,
    monsterActions: 285,
    encounters: 76,
    playerSkills: 1141,
  });
  assert.equal(data.loadDiagnostics.counts.invalidJson, undefined);
});

test("sheet damage formula and explicit hit/critical caps are stable", () => {
  assert.equal(effectiveAttack(20, 50), 30);
  assert.equal(calculatePhysicalDamage({
    weaponPower: 20,
    attack: 50,
    multiplier: 1.5,
    fixed: 2,
    defense: 10,
  }), 41);
  assert.equal(calculateMagicDamage({
    magicPower: 20,
    attack: 50,
    multiplier: 1.5,
    fixed: 2,
    magicResistance: 10,
  }), 41);

  assert.equal(BATTLE_ASSUMPTIONS.defenseCoefficient, 0.6);
  assert.equal(calculateHitChance({ accuracy: -999, targetEvasion: 999 }), 0.05);
  assert.equal(calculateHitChance({ accuracy: 999, targetEvasion: -999 }), 0.98);
  assert.equal(calculateCriticalChance({ critical: -999, targetLuck: 999 }), 0);
  assert.equal(calculateCriticalChance({ critical: 999, targetLuck: 0 }), 0.5);
});

test("seeded RNG and encounter party expansion are reproducible", () => {
  const first = createSeededRng("battle-seed");
  const second = createSeededRng("battle-seed");
  const third = createSeededRng("different-seed");
  const firstValues = Array.from({ length: 12 }, () => first());
  assert.deepEqual(firstValues, Array.from({ length: 12 }, () => second()));
  assert.notDeepEqual(firstValues, Array.from({ length: 12 }, () => third()));

  const partyOne = expandEncounter(data, "ENC-0001", createSeededRng(88));
  const partyTwo = expandEncounter(data, "ENC-0001", createSeededRng(88));
  assert.deepEqual(partyOne, partyTwo);
  assert.ok(partyOne.length >= 1);
  assert.ok(partyOne.every((monsterId) => data.monsterById.has(monsterId)));
});

test("battle data audit preserves actionable state and command inconsistencies", () => {
  assert.ok(data.audit.monstersWithoutUnconditionalAction.includes("MON-0076"));
  assert.deepEqual(
    [...new Set(data.audit.unresolvedStateReferences.map((entry) => entry.stateId))].sort(),
    ["bound", "mana_absorb膜", "overheat"],
  );
  assert.ok(data.audit.unresolvedModifierReferences.some((entry) => (
    entry.modifier === "physicalPower"
      && entry.normalized === "physical_power"
      && entry.normalizationResolves
  )));
  assert.ok(data.audit.unknownCommands.some((entry) => entry.command === "SUMMON_UNIT"));
  assert.ok(data.audit.unknownCommands.some((entry) => entry.command === "COPY_LAST_ENEMY_SKILL"));
  assert.equal(data.audit.passiveSkillsWithDamage.length, 25);
  assert.equal(data.audit.provisionalRuleSkills.length, 98);
  assert.equal(data.audit.contextualActiveSkills.length, 345);
});

test("the same battle seed produces the same complete result", () => {
  const build = createDefaultBuilds(data)[0];
  const options = {
    data,
    seed: "deterministic-battle",
    encounterId: "ENC-0001",
    playerBuild: build,
    maxTurns: 40,
  };
  assert.deepEqual(simulateBattle(options), simulateBattle(options));
});

test("MON-0076 candidate exhaustion is diagnosed and falls back to normal attacks", () => {
  const result = simulateBattle({
    data,
    seed: "blackridge-wing-scout-regression",
    monsterIds: ["MON-0076"],
    playerBuild: observerBuild(),
    maxTurns: 5,
  });

  assert.equal(result.winner, "draw");
  assert.equal(result.turns, 5);
  assert.equal(result.actionUsage["MSK-0016"], 1, "the turn-one-only action must not repeat");
  assert.equal(result.candidateExhaustion, 4);
  assert.equal(result.fallbackAttacks, 4);
  assert.equal(result.diagnostics.counts.candidateExhaustion, 4);
  assert.ok(result.actionUsage.__normal__ >= result.fallbackAttacks);
  assert.ok(result.players[0].alive, "fallback behavior must progress battle without crashing");
});

test("Monte Carlo reports win, turns, MP, usage and exhaustion per build", () => {
  const builds = createDefaultBuilds(data).slice(0, 2);
  assert.equal(new Set(builds.map((build) => build.level)).size, 2);
  assert.ok(builds.every((build) => build.equipmentIds.length > 0));

  const options = {
    data,
    seed: "battle-monte-carlo-regression",
    encounterId: "ENC-0001",
    builds,
    runs: 16,
    maxTurns: 50,
  };
  const first = runMonteCarlo(options);
  const second = runMonteCarlo(options);
  assert.deepEqual(first, second);
  assert.equal(first.runsPerBuild, 16);
  assert.equal(first.builds.length, 2);

  for (const report of first.builds) {
    assert.equal(report.wins + report.losses + report.draws, 16);
    assert.ok(report.winRate >= 0 && report.winRate <= 1);
    assert.ok(report.averageTurns >= 1 && report.averageTurns <= 50);
    assert.ok(report.averageMpSpent >= 0);
    assert.ok(report.averageMpRemaining >= 0);
    assert.ok(Object.keys(report.actionUsage).length > 0);
    assert.ok(report.candidateExhaustionBattleRate >= 0);
    assert.ok(report.candidateExhaustionBattleRate <= 1);
    assert.ok(report.playerResourceExhaustionBattleRate >= 0);
    assert.ok(report.playerResourceExhaustionBattleRate <= 1);
    assert.ok(Number.isFinite(report.playerResourceExhaustionEvents));
    assert.ok(Number.isFinite(report.fallbackAttacks));
  }
});
