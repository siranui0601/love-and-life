import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYER_PROFILES } from "./lib/player-journey.mjs";
import {
  renderPlayerSimulationMarkdown,
  runIntegratedPlayerSimulationSuite,
} from "./lib/player-suite.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const reportsDirectory = path.join(HERE, "reports");
const publicDirectory = path.resolve(HERE, "..", "..", "public", "TRPG");
fs.mkdirSync(reportsDirectory, { recursive: true });
fs.mkdirSync(publicDirectory, { recursive: true });

const report = await runIntegratedPlayerSimulationSuite({ profiles: PLAYER_PROFILES });
const markdown = renderPlayerSimulationMarkdown(report);
const json = `${JSON.stringify(report, null, 2)}\n`;
fs.writeFileSync(path.join(reportsDirectory, "player-v2-latest.json"), json);
fs.writeFileSync(path.join(reportsDirectory, "player-v2-latest.md"), markdown);
fs.writeFileSync(path.join(reportsDirectory, "player-latest.json"), json);
fs.writeFileSync(path.join(reportsDirectory, "player-latest.md"), markdown);
fs.writeFileSync(path.join(publicDirectory, "player-simulation-report.json"), json);
fs.writeFileSync(path.join(publicDirectory, "player-simulation-v2-report.json"), json);

console.log(markdown);
console.log(`\nPLAYER_SIM_QUALITY=${report.quality.passed ? "PASS" : "BLOCKED"}`);
if (process.argv.includes("--strict") && !report.quality.passed) process.exitCode = 1;
