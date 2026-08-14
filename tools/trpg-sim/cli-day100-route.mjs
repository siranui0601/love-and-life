import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Day100GameRunner,
  renderDay100PlayerMarkdown,
  writeDay100PlayerArtifacts,
} from "./lib/day100-player-runner.mjs";
import {
  createChoiceSetAudit,
  finalizeChoiceSetAudit,
  inspectChoiceSetBeforeSelection,
  recordChoiceSetSelection,
} from "./lib/choice-set-audit.mjs";
import { createDay100RouteGameService } from "./lib/day100-route-game-service.mjs";
import { DAY100_ROUTE_MODES } from "./lib/day100-route-strategy.mjs";
import { selectDay100RouteDecisionWithSurvival } from "./lib/day100-route-survival-priority.mjs";
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
    this.game = createDay100RouteGameService({
      store: this.store,
      narrator: this.narrator,
      allowCustomSeed: true,
      maxSavesPerOwner: 2,
    });
    this.routeMode = options.routeMode ?? "deadline";
    this.choiceSetAudit = createChoiceSetAudit();
  }

  async step() {
    const rescueCommand = this.save?.collapseRescue?.command;
    if (rescueCommand?.type) {
      await this.command(rescueCommand.type, {}, {
        type: rescueCommand.type,
        actionId: rescueCommand.type,
        reason: "authoritative-collapse-rescue",
      });
      return true;
    }
    const decision = selectDay100RouteDecisionWithSurvival({
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
    const choiceSet = decision.type === "CHOOSE"
      ? inspectChoiceSetBeforeSelection(this.choiceSetAudit, this.save)
      : { signature: null, duplicate: false };
    const response = await this.command(decision.type, decision.payload ?? {}, {
      ...decision,
      repeatedChoiceSet: choiceSet.duplicate,
      choiceSetSignature: choiceSet.signature,
    });
    if (decision.type === "CHOOSE") {
      const outcome = response.save?.scene?.lastOutcome ?? null;
      const accepted = outcome?.ok !== false
        && outcome?.success !== false
        && outcome?.accepted !== false;
      recordChoiceSetSelection(this.choiceSetAudit, choiceSet.signature, accepted, this.save);
    }
    return true;
  }

  async run() {
    const result = await super.run();
    const choiceSets = finalizeChoiceSetAudit(this.choiceSetAudit);
    result.report.routeMode = this.routeMode;
    result.report.routeTrial = {
      schemaVersion: "trpg-day100-route-trial-v2",
      discovered: result.report.counts.discovered,
      engaged: result.report.counts.engaged,
      progressed: result.report.counts.progressed,
      resolved: result.report.counts.resolved,
      failed: result.report.counts.failed,
      improvementOverBaseline: result.report.counts.discovered > 6
        || result.report.counts.progressed > 1
        || result.report.counts.resolved > 1,
      allRescueCandidate: result.report.counts.resolved === result.report.counts.total,
      choiceSets,
    };
    result.report.quality.noRepeatedChoiceSet = choiceSets.passed;
    result.report.quality.passed = Object.values(result.report.quality).every(Boolean);
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
console.log(`TRPG_DAY100_ROUTE_DUPLICATE_CHOICE_SETS=${result.report.routeTrial.choiceSets.duplicateEncounterCount}`);
// 内訳を全件から出す。**例は先頭20件しか残らないので、内訳の判断に使ってはいけない。**
for (const [family, count] of Object.entries(result.report.routeTrial.choiceSets.duplicateFamilies ?? {})) {
  console.log(`TRPG_DAY100_ROUTE_DUPLICATE_FAMILY ${String(count).padStart(5)}  ${family}`);
}
// **どちらが多いかで直し方が正反対になるので、先にこれを出す。**
//   同じ施設 → その場面の作り方が同じ札を返している
//   違う施設 → 札のIDに現在地が入っていないだけ
console.log(`TRPG_DAY100_ROUTE_DUPLICATE_SAME_FACILITY=${result.report.routeTrial.choiceSets.duplicateSameFacilityCount}`);
console.log(`TRPG_DAY100_ROUTE_DUPLICATE_CROSS_FACILITY=${result.report.routeTrial.choiceSets.duplicateCrossFacilityCount}`);
for (const [family, count] of Object.entries(result.report.routeTrial.choiceSets.duplicateCrossFacilityFamilies ?? {})) {
  console.log(`TRPG_DAY100_ROUTE_DUPLICATE_CROSS_FAMILY ${String(count).padStart(5)}  ${family}`);
}
for (const [kind, count] of Object.entries(result.report.routeTrial.choiceSets.duplicateCrossFacilityKinds ?? {})) {
  console.log(`TRPG_DAY100_ROUTE_DUPLICATE_CROSS_KIND ${String(count).padStart(5)}  ${kind}`);
}
console.log(`TRPG_DAY100_ROUTE_ALL_RESCUE=${result.report.routeTrial.allRescueCandidate ? "YES" : "NO"}`);

if (process.argv.includes("--strict-runtime")) {
  const runtimePassed = result.report.reachedDay100
    && result.report.deadEnds === 0
    && result.report.errors.length === 0
    && result.report.routeTrial.choiceSets.passed;
  if (!runtimePassed) process.exitCode = 1;
}
