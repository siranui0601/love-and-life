import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPlayableWorldAudit } from "./lib/playable-world-audit.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const report = runPlayableWorldAudit();
report.generatedAt = new Date().toISOString();
const json = `${JSON.stringify(report, null, 2)}\n`;
const runtimePath = path.join(root, "runtime-data/TRPG/playable-world-audit.json");
const publicPath = path.join(root, "public/TRPG/playable-world-audit.json");
await fs.mkdir(path.dirname(runtimePath), { recursive: true });
await fs.writeFile(runtimePath, json, "utf8");
await fs.writeFile(publicPath, json, "utf8");
console.log(JSON.stringify({
  allPassed: report.allPassed,
  deterministicReplay: report.deterministicReplay,
  findings: report.findings,
  scenarios: report.scenarios.map((scenario) => ({
    policyId: scenario.policyId,
    ok: scenario.ok,
    day: scenario.day,
    commands: scenario.commands,
    resolved: scenario.troubleCounts.resolved ?? 0,
    failed: scenario.troubleCounts.failed ?? 0,
    t01: scenario.t01,
    hash: scenario.stateHash.slice(0, 16),
  })),
  output: publicPath,
}, null, 2));
if (!report.allPassed || !report.deterministicReplay) process.exitCode = 1;
