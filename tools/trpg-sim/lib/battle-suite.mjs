import { createPlayerBuild, createSeededRng, expandEncounter } from "./battle-model.mjs";
import { createDefaultBuilds, runMonteCarlo, simulateBattle } from "./battle-simulator.mjs";
import { mean, quantile } from "./statistics.mjs";

export const DEFAULT_BATTLE_SUITE = Object.freeze({
  runsPerScenario: 500,
  partyRunsPerEncounter: 250,
  maximumPlayerLevel: 24,
});

function scoreEquipment(item, archetype) {
  if (item.slot === "mainHand") {
    return archetype === "magic"
      ? item.magicPower * 5 + item.maxMp * 1.5 + item.performanceIndex
      : item.physicalPower * 5 + item.accuracy + item.critical + item.performanceIndex;
  }
  if (archetype === "magic") {
    return item.magicResistance * 3 + item.maxMp * 2 + item.defense + item.performanceIndex;
  }
  return item.defense * 3 + item.maxHp + item.magicResistance + item.performanceIndex;
}

function eligibleForLevel(item, level) {
  return item.status === "active" &&
    Number(item.recommendedLevelMin ?? 1) <= level &&
    Number(item.recommendedLevelMax ?? Infinity) >= level;
}

function bestForSlot(data, level, slot, archetype) {
  const exact = data.equipment.filter((item) => item.slot === slot && eligibleForLevel(item, level));
  const fallback = data.equipment.filter((item) => item.slot === slot && item.status === "active" && Number(item.recommendedLevelMin ?? 1) <= level);
  return (exact.length ? exact : fallback)
    .sort((left, right) => scoreEquipment(right, archetype) - scoreEquipment(left, archetype) || left.id.localeCompare(right.id))[0];
}

export function recommendedEncounterLevel(data, encounter, maximumPlayerLevel = 24) {
  const monsterLevels = encounter.composition
    .map((entry) => data.monsterById.get(entry.monsterId))
    .filter(Boolean)
    .map((monster) => Number(monster.recommendedLevelMin ?? monster.level ?? 1));
  return Math.max(1, Math.min(maximumPlayerLevel, Math.max(...monsterLevels, 1)));
}

export function createMatchedBuild(data, { level, archetype, id = `${archetype}-lv${level}` } = {}) {
  const mainHand = bestForSlot(data, level, "mainHand", archetype);
  const body = bestForSlot(data, level, "body", archetype);
  const accessory = bestForSlot(data, level, "accessory", archetype);
  const offHand = mainHand?.grip === "twoHand" ? null : bestForSlot(data, level, "offHand", archetype);
  const equipmentIds = [mainHand, offHand, body, accessory].filter(Boolean).map((item) => item.id);
  return createPlayerBuild(data, {
    id,
    name: `${archetype === "magic" ? "Magic" : "Physical"} matched Lv${level}`,
    level,
    equipmentIds,
  });
}

function aggregateBattleResults(results, runs) {
  const turns = results.map((result) => result.turns);
  const wins = results.filter((result) => result.winner === "players").length;
  const losses = results.filter((result) => result.winner === "enemies").length;
  const diagnostics = {};
  for (const result of results) {
    for (const [key, value] of Object.entries(result.diagnostics?.counts ?? {})) {
      diagnostics[key] = (diagnostics[key] ?? 0) + Number(value);
    }
  }
  return {
    runs,
    wins,
    losses,
    draws: runs - wins - losses,
    winRate: wins / runs,
    averageTurns: mean(turns),
    medianTurns: quantile(turns, 0.5),
    p90Turns: quantile(turns, 0.9),
    playerResourceExhaustionRate: results.filter((result) => Number(result.diagnostics?.counts?.playerResourceExhaustion ?? 0) > 0).length / runs,
    candidateExhaustionRate: results.filter((result) => result.candidateExhaustion > 0).length / runs,
    diagnostics,
  };
}

export function runPartyMonteCarlo({ data, encounterId, players, runs, seed, enemyCountMultiplier = 1 }) {
  const results = [];
  const encounter = data.encounterById.get(encounterId);
  for (let index = 0; index < runs; index += 1) {
    const battleSeed = `${seed}:${encounterId}:party:${index}`;
    const baseMonsterIds = expandEncounter(data, encounter, createSeededRng(`${battleSeed}:composition`));
    const monsterIds = baseMonsterIds.flatMap((monsterId) => Array.from({ length: enemyCountMultiplier }, () => monsterId));
    results.push(simulateBattle({
      data,
      encounterId: undefined,
      monsterIds,
      players,
      seed: battleSeed,
    }));
  }
  return { enemyCountMultiplier, ...aggregateBattleResults(results, runs) };
}

function scenarioRow(encounter, build, result, runs, mode = "fixed") {
  return {
    mode,
    encounterId: encounter.id,
    encounterName: encounter.name,
    region: encounter.region,
    dangerTier: encounter.dangerTier,
    buildId: result.buildId ?? build.id,
    buildName: build.name,
    level: build.level,
    archetype: build.id.includes("magic") ? "magic" : "physical",
    equipmentIds: build.equipmentIds,
    runs,
    ...result,
  };
}

export function summarizeTierMatrix(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.mode}|${row.buildId}|${row.dangerTier}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, entries]) => {
    const [mode, buildId, dangerTier] = key.split("|");
    const rates = entries.map((entry) => entry.winRate);
    return {
      mode,
      buildId,
      dangerTier: Number(dangerTier),
      encounters: entries.length,
      meanWinRate: mean(rates),
      medianWinRate: quantile(rates, 0.5),
      minimumWinRate: Math.min(...rates),
      maximumWinRate: Math.max(...rates),
      resourceExhaustionRate: mean(entries.map((entry) => Number(entry.playerResourceExhaustionBattleRate ?? entry.playerResourceExhaustionRate ?? 0))),
    };
  }).sort((left, right) => left.dangerTier - right.dangerTier || left.buildId.localeCompare(right.buildId));
}

export function runBattleSuite({
  data,
  seed = "battle-suite-20260717",
  runsPerScenario = DEFAULT_BATTLE_SUITE.runsPerScenario,
  partyRunsPerEncounter = DEFAULT_BATTLE_SUITE.partyRunsPerEncounter,
  maximumPlayerLevel = DEFAULT_BATTLE_SUITE.maximumPlayerLevel,
  partyEnemyCountMultiplierByTier = null,
} = {}) {
  if (!data) throw new Error("runBattleSuite requires battle data");
  const fixedBuilds = createDefaultBuilds(data);
  const fixedRows = [];
  const matchedRows = [];
  const partyRows = [];
  const tunedPartyRows = [];

  for (const encounter of data.encounters) {
    const fixed = runMonteCarlo({ data, encounterId: encounter.id, builds: fixedBuilds, runs: runsPerScenario, seed });
    for (const result of fixed.builds) {
      const build = fixedBuilds.find((candidate) => candidate.id === result.buildId);
      fixedRows.push(scenarioRow(encounter, build, result, runsPerScenario));
    }

    const level = recommendedEncounterLevel(data, encounter, maximumPlayerLevel);
    const physical = createMatchedBuild(data, { level, archetype: "physical", id: `matched-physical-lv${level}` });
    const magic = createMatchedBuild(data, { level, archetype: "magic", id: `matched-magic-lv${level}` });
    const matched = runMonteCarlo({ data, encounterId: encounter.id, builds: [physical, magic], runs: runsPerScenario, seed: `${seed}:matched` });
    for (const result of matched.builds) {
      const build = result.buildId === physical.id ? physical : magic;
      matchedRows.push(scenarioRow(encounter, build, result, runsPerScenario, "matched"));
    }

    const party = [physical, physical, magic, magic];
    const partyResult = runPartyMonteCarlo({ data, encounterId: encounter.id, players: party, runs: partyRunsPerEncounter, seed });
    partyRows.push({
      mode: "party",
      encounterId: encounter.id,
      encounterName: encounter.name,
      region: encounter.region,
      dangerTier: encounter.dangerTier,
      recommendedLevel: level,
      party: party.map((build) => build.id),
      ...partyResult,
    });
    if (partyEnemyCountMultiplierByTier) {
      const enemyCountMultiplier = Number(partyEnemyCountMultiplierByTier[encounter.dangerTier] ?? 1);
      const tunedPartyResult = runPartyMonteCarlo({
        data,
        encounterId: encounter.id,
        players: party,
        runs: partyRunsPerEncounter,
        seed: `${seed}:party-tuned`,
        enemyCountMultiplier,
      });
      tunedPartyRows.push({
        mode: "party-tuned",
        encounterId: encounter.id,
        encounterName: encounter.name,
        region: encounter.region,
        dangerTier: encounter.dangerTier,
        recommendedLevel: level,
        party: party.map((build) => build.id),
        ...tunedPartyResult,
      });
    }
  }

  const totalBattles = fixedRows.length * runsPerScenario + matchedRows.length * runsPerScenario +
    (partyRows.length + tunedPartyRows.length) * partyRunsPerEncounter;
  return {
    seed,
    configuration: { runsPerScenario, partyRunsPerEncounter, maximumPlayerLevel, partyEnemyCountMultiplierByTier },
    totalBattles,
    fixedBuilds: fixedBuilds.map((build) => ({
      id: build.id,
      name: build.name,
      level: build.level,
      equipmentIds: build.equipmentIds,
      skillIds: build.skillIds,
    })),
    fixedRows,
    matchedRows,
    partyRows,
    tunedPartyRows,
    tierSummary: summarizeTierMatrix([...fixedRows, ...matchedRows]),
  };
}
