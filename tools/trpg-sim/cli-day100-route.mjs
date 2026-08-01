import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Day100GameRunner,
  renderDay100PlayerMarkdown,
  writeDay100PlayerArtifacts,
} from "./lib/day100-player-runner.mjs";
import {
  DAY100_ROUTE_MODES,
  selectDay100RouteDecision,
} from "./lib/day100-route-strategy.mjs";
import { writeDay100ReplayCandidateManifest } from "./lib/day100-replay-candidates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.join(HERE, "reports");
const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
const requestedMode = process.env.TRPG_DAY100_ROUTE_MODE || "deadline";
const routeMode = DAY100_ROUTE_MODES.includes(requestedMode) ? requestedMode : "deadline";
const seed = process.env.TRPG_DAY100_SEED || `trpg-day100-route-${routeMode}-v1`;
const runId = process.env.TRPG_NARRATIVE_RUN_ID || `day100-route-${routeMode}-${stamp}`;
const sourceCommit = process.env.TRPG_DAY100_SOURCE_COMMIT || process.env.GITHUB_SHA || "";
const auditFilePath = path.join(REPORTS, `day100-route-${routeMode}-${stamp}-narrative-audit.jsonl`);
process.env.TRPG_NARRATIVE_RUN_ID = runId;

class Day100RouteRunner extends Day100GameRunner {
  constructor(options = {}) {
    super(options);
    this.routeMode = options.routeMode ?? "deadline";
  }

  async step() {
    const decision = selectDay100RouteDecision({
      save: this.save,
      model: this.model,
      state: this.coverage,
      routeMode: this.routeMode,
    });
    if (!decision) {
      if (!this.save.world?.ended) this.coverage.deadEndCount += 1;
      return false;
    }
    if (decision.type === "BATTLE") {
      await this.finishBattle(decision);
      return true;
    }
    await this.command(decision.type, decision.payload ?? {}, decision);
    return true;
  }

  async run() {
    const result = await super.run();
    result.report.routeMode = this.routeMode;
    result.report.routeTrial = {
      schemaVersion: "trpg-day100-route-trial-v1",
      discovered: result.report.counts.discovered,
      engaged: result.report.counts.engaged,
      progressed: result.report.counts.progressed,
      resolved: result.report.counts.resolved,
      failed: result.report.counts.failed,
      improvementOverBaseline: result.report.counts.discovered > 6
        || result.report.counts.progressed > 1
        || result.report.counts.resolved > 1,
      allRescueCandidate: result.report.counts.resolved === result.report.counts.total,
    };
    return result;
  }
}

const runner = new Day100RouteRunner({
  playerName: process.env.TRPG_DAY100_PLAYER_NAME || `百日の旅人・${routeMode}`,
  seed,
  routeMode,
  maxActions: Number(process.env.TRPG_DAY100_MAX_ACTIONS || 4200),
  maxNarrativeCalls: Number(process.env.TRPG_DAY100_NARRATIVE_MAX || 600),
  auditFilePath,
});

const result = await runner.run();
const prefix = `day100-route-${routeMode}-latest`;
const latestReplayCandidatesPath = path.join(REPORTS, `${prefix}-replay-candidates.json`);
const stampedReplayCandidatesPath = path.join(REPORTS, `day100-route-${routeMode}-${stamp}-replay-candidates.json`);
const replayCandidates = writeDay100ReplayCandidateManifest({
  auditFilePath,
  outputFilePath: latestReplayCandidatesPath,
  runId,
  seed,
  sourceCommit,
});
writeDay100ReplayCandidateManifest({
  auditFilePath,
  outputFilePath: stampedReplayCandidatesPath,
  runId,
  seed,
  sourceCommit,
});
result.report.replayCandidates = replayCandidates.stats;

await writeDay100PlayerArtifacts(result, { reportsDirectory: REPORTS, prefix });
await writeDay100PlayerArtifacts(result, {
  reportsDirectory: REPORTS,
  prefix: `day100-route-${routeMode}-${stamp}`,
});

console.log(`# Day100 route trial: ${routeMode}\n`);
console.log(renderDay100PlayerMarkdown(result.report));
console.log(`\nTRPG_DAY100_ROUTE_MODE=${routeMode}`);
console.log(`TRPG_DAY100_ROUTE_DISCOVERED=${result.report.counts.discovered}`);
console.log(`TRPG_DAY100_ROUTE_PROGRESSED=${result.report.counts.progressed}`);
console.log(`TRPG_DAY100_ROUTE_RESOLVED=${result.report.counts.resolved}`);
console.log(`TRPG_DAY100_ROUTE_ALL_RESCUE=${result.report.routeTrial.allRescueCandidate ? "YES" : "NO"}`);

if (process.argv.includes("--strict-runtime")) {
  const runtimePassed = result.report.reachedDay100
    && result.report.deadEnds === 0
    && result.report.errors.length === 0;
  if (!runtimePassed) process.exitCode = 1;
}
