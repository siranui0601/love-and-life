import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Day100GameRunner,
  renderDay100PlayerMarkdown,
  writeDay100PlayerArtifacts,
} from "./lib/day100-player-runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.join(HERE, "reports");
const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
const runId = process.env.TRPG_NARRATIVE_RUN_ID || `day100-player-${stamp}`;
process.env.TRPG_NARRATIVE_RUN_ID = runId;

const runner = new Day100GameRunner({
  playerName: process.env.TRPG_DAY100_PLAYER_NAME || "百日の旅人",
  seed: process.env.TRPG_DAY100_SEED || "trpg-day100-player-v1",
  maxActions: Number(process.env.TRPG_DAY100_MAX_ACTIONS || 4200),
  liveSampleLimit: Number(process.env.TRPG_DAY100_LIVE_MAX || 48),
  auditFilePath: path.join(REPORTS, `day100-player-${stamp}-narrative-audit.jsonl`),
});

const result = await runner.run();
await writeDay100PlayerArtifacts(result, { reportsDirectory: REPORTS, prefix: "day100-player-latest" });
await writeDay100PlayerArtifacts(result, { reportsDirectory: REPORTS, prefix: `day100-player-${stamp}` });

console.log(renderDay100PlayerMarkdown(result.report));
console.log(`\nTRPG_DAY100_PLAYER_QUALITY=${result.report.quality.passed ? "PASS" : "BLOCKED"}`);
if (process.argv.includes("--strict") && !result.report.quality.passed) process.exitCode = 1;
