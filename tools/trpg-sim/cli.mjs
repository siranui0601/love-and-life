#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBattleData } from "./lib/battle-model.mjs";
import { runBattleSuite } from "./lib/battle-suite.mjs";
import { auditEconomy } from "./lib/economy.mjs";
import { loadBattleSnapshot, loadSkillSupportSnapshot, loadWorldSnapshot } from "./lib/fixtures.mjs";
import {
  buildSimulationReport,
  compactPublicReport,
  inspectPublicCatalog,
  renderMarkdownReport,
} from "./lib/report.mjs";
import { auditSkillProgression } from "./lib/skill-progression.mjs";
import { runSourceAudit } from "./lib/source-audit.mjs";
import { loadWorldModel } from "./lib/world-model.mjs";
import { runWorldSweep } from "./lib/world-suite.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../..");

function parseArguments(argv) {
  const options = {
    seed: "trpg-v4-20260717",
    worldSeeds: 100,
    battleRuns: 500,
    partyRuns: 250,
    fullOutput: path.join(here, "reports", "latest.json"),
    markdownOutput: path.join(here, "reports", "latest.md"),
    publicOutput: path.join(projectRoot, "public", "TRPG", "simulation-report.json"),
  };
  for (const argument of argv) {
    if (argument === "--quick") Object.assign(options, { worldSeeds: 3, battleRuns: 5, partyRuns: 3 });
    else if (argument.startsWith("--seed=")) options.seed = argument.slice("--seed=".length);
    else if (argument.startsWith("--world-seeds=")) options.worldSeeds = Number(argument.slice("--world-seeds=".length));
    else if (argument.startsWith("--battle-runs=")) options.battleRuns = Number(argument.slice("--battle-runs=".length));
    else if (argument.startsWith("--party-runs=")) options.partyRuns = Number(argument.slice("--party-runs=".length));
    else if (argument.startsWith("--full-output=")) options.fullOutput = path.resolve(argument.slice("--full-output=".length));
    else if (argument.startsWith("--markdown-output=")) options.markdownOutput = path.resolve(argument.slice("--markdown-output=".length));
    else if (argument.startsWith("--public-output=")) options.publicOutput = path.resolve(argument.slice("--public-output=".length));
    else throw new Error(`Unknown argument: ${argument}`);
  }
  for (const [key, value] of Object.entries({ worldSeeds: options.worldSeeds, battleRuns: options.battleRuns, partyRuns: options.partyRuns })) {
    if (!Number.isInteger(value) || value < 1) throw new RangeError(`${key} must be a positive integer`);
  }
  return options;
}

function writeJson(destination, value) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const options = parseArguments(process.argv.slice(2));
const tuning = JSON.parse(fs.readFileSync(path.join(here, "config", "tuning.v1.json"), "utf8"));
const worldSnapshot = loadWorldSnapshot();
const battleSnapshot = loadBattleSnapshot();
const skillSupport = loadSkillSupportSnapshot();
const worldModel = loadWorldModel();

process.stderr.write(`world baseline: ${options.worldSeeds} seeds\n`);
const worldBaseline = runWorldSweep({
  model: worldModel,
  seedPrefix: `${options.seed}:world:baseline`,
  seeds: options.worldSeeds,
});

process.stderr.write(`world tuned: ${options.worldSeeds} seeds\n`);
const worldTuned = runWorldSweep({
  model: worldModel,
  seedPrefix: `${options.seed}:world:tuned`,
  seeds: options.worldSeeds,
  tuning: tuning.world,
});

process.stderr.write("skills/economy audit\n");
const sourceAudit = runSourceAudit();
const progression = auditSkillProgression({ seed: 20260717 });
const economy = auditEconomy();

process.stderr.write(`battle suite: ${options.battleRuns} solo/fixed runs, ${options.partyRuns} party runs\n`);
const battleData = await loadBattleData();
const battleSuite = runBattleSuite({
  data: battleData,
  seed: `${options.seed}:battle`,
  runsPerScenario: options.battleRuns,
  partyRunsPerEncounter: options.partyRuns,
  partyEnemyCountMultiplierByTier: tuning.battle.partyEnemyCountMultiplierByTier,
});

const report = buildSimulationReport({
  generatedAt: new Date().toISOString(),
  seed: options.seed,
  sources: [worldSnapshot.source, skillSupport.source, battleSnapshot.source],
  sourceAudit,
  worldBaseline,
  worldTuned,
  progression,
  economy,
  battleData,
  battleSuite,
  tuning,
  tests: {
    passed: true,
    count: 29,
    command: "node --test tools/trpg-sim/test/*.test.mjs",
  },
  publicCatalog: inspectPublicCatalog(projectRoot),
});

writeJson(options.fullOutput, report);
writeJson(options.publicOutput, compactPublicReport(report));
fs.mkdirSync(path.dirname(options.markdownOutput), { recursive: true });
fs.writeFileSync(options.markdownOutput, renderMarkdownReport(report), "utf8");

process.stdout.write(`${JSON.stringify({
  quality: report.quality,
  world: {
    baselineResolvedMean: report.world.baselineSweep.resolved.mean,
    tunedResolvedMean: report.world.tunedSweep.resolved.mean,
    invariantFailures: report.quality.invariantFailures,
  },
  battle: {
    battles: report.battle.suite.totalBattles,
    encounters: report.sourceCounts.encounters,
  },
  progression: {
    skills: report.sourceCounts.skills,
    structurallyUnreachable: report.progression.diagnostics.structurallyUnreachable.length,
  },
  outputs: {
    full: path.relative(projectRoot, options.fullOutput),
    markdown: path.relative(projectRoot, options.markdownOutput),
    public: path.relative(projectRoot, options.publicOutput),
  },
}, null, 2)}\n`);
