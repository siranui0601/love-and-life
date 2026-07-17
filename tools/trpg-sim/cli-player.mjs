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

// Active crises should outrank idle small talk for profiles that intend to engage
// with the story. Once no urgent mission action is available, observation should
// beat repeatedly talking to the same local population all day.
const simulationProfiles = PLAYER_PROFILES.map((profile) => {
  const crisisStory = profile.story >= 0.55 ? 1 : profile.story;
  return Object.freeze({
    ...profile,
    story: crisisStory,
    explore: Math.max(profile.explore, crisisStory * 2.85),
  });
});

const report = await runIntegratedPlayerSimulationSuite({ profiles: simulationProfiles });
const markdown = renderPlayerSimulationMarkdown(report);
const json = `${JSON.stringify(report, null, 2)}\n`;
fs.writeFileSync(path.join(reportsDirectory, "player-latest.json"), json);
fs.writeFileSync(path.join(reportsDirectory, "player-latest.md"), markdown);
fs.writeFileSync(path.join(publicDirectory, "player-simulation-report.json"), json);

console.log(markdown);
console.log(`\nPLAYER_SIM_QUALITY=${report.quality.passed ? "PASS" : "BLOCKED"}`);
if (process.argv.includes("--strict") && !report.quality.passed) process.exitCode = 1;
