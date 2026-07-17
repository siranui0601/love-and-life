import { loadBattleData } from "./battle-model.mjs";
import { loadSkills } from "./fixtures.mjs";
import { PLAYER_PROFILES, simulatePlayerJourney } from "./player-journey.mjs";
import {
  renderPlayerSimulationMarkdownV3Final,
  runIntegratedPlayerSimulationSuiteV3Final,
} from "./player-suite-v3-final.mjs";
import { loadPlayerSimulationConfigV3 } from "./player-suite-v3.mjs";
import { simulateNpcInterventionPlansForRun } from "./npc-intervention-simulator-v3.mjs";
import { loadWorldModel } from "./world-model.mjs";

function runNpcPlanAuditSet({ model, battleData, skills, profiles, tuning, rootSeed, seedsPerProfile = 1 }) {
  const runs = [];
  for (const profile of profiles) {
    for (let index = 0; index < seedsPerProfile; index += 1) {
      runs.push(simulatePlayerJourney({
        model,
        battleData,
        skills,
        profile,
        tuning,
        seed: `${rootSeed}:npc-plan:${profile.id}:${index}`,
        maxActions: Number(tuning.maxActions ?? 5200),
      }));
    }
  }
  return runs;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function median(values) {
  const clean = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  return clean.length ? clean[Math.floor((clean.length - 1) * 0.5)] : null;
}

function summarize(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  return {
    count: clean.length,
    mean: Number(mean(clean).toFixed(4)),
    min: clean.length ? Math.min(...clean) : null,
    median: median(clean),
    max: clean.length ? Math.max(...clean) : null,
  };
}

function mergeCounts(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) target[key] = Number(target[key] ?? 0) + Number(value ?? 0);
}

function playerResolvedIds(run) {
  return new Set(run.state.history
    .filter((entry) => entry.type === "TROUBLE_TRANSITION" && entry.to === "resolved" && entry.reason === "player-mission-resolution")
    .map((entry) => entry.troubleId));
}

function aggregateNpcPlanResults(runs, results) {
  const planKinds = {};
  const statuses = {};
  let expectedResolutionChanges = 0;
  let crisisToResolutionChanges = 0;
  let staleCrisisPlans = 0;

  results.forEach((result, index) => {
    mergeCounts(planKinds, result.planKinds);
    mergeCounts(statuses, result.statuses);
    const resolvedIds = playerResolvedIds(runs[index]);
    const groups = new Map();
    for (const plan of result.plans) {
      if (!resolvedIds.has(plan.troubleId)) continue;
      const key = `${plan.npcId}:${plan.troubleId}`;
      const group = groups.get(key) ?? { crisis: false, resolved: false };
      if (["active", "critical", "failed"].includes(plan.status)) group.crisis = true;
      if (plan.status === "resolved") group.resolved = true;
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      if (!group.crisis) continue;
      expectedResolutionChanges += 1;
      if (group.resolved) crisisToResolutionChanges += 1;
      else staleCrisisPlans += 1;
    }
  });

  const changeRate = expectedResolutionChanges ? crisisToResolutionChanges / expectedResolutionChanges : 1;
  return {
    runs: results.length,
    totalPlans: results.reduce((sum, result) => sum + result.totalPlans, 0),
    executablePlans: results.reduce((sum, result) => sum + result.executablePlans, 0),
    executionRate: summarize(results.map((result) => result.executionRate)),
    revisions: results.reduce((sum, result) => sum + result.revisions, 0),
    crisisToResolutionChanges,
    expectedResolutionChanges,
    resolutionChangeRate: summarize(results.map(() => changeRate)),
    staleCrisisPlans,
    roleMismatchCount: results.reduce((sum, result) => sum + result.roleMismatchCount, 0),
    impossibleTravelCount: results.reduce((sum, result) => sum + result.impossibleTravelCount, 0),
    lowerPriorityIgnored: results.reduce((sum, result) => sum + result.lowerPriorityIgnored, 0),
    executedMitigation: summarize(results.map((result) => result.executedMitigation)),
    planKinds,
    statuses,
    samples: results.map((result) => ({ ...result, plans: result.plans.slice(0, 80) })),
  };
}

function deepFindings(audit, targets) {
  const findings = [];
  const push = (severity, code, detail) => findings.push({ severity, code, detail });
  const executionMin = Number(targets.npcPlanExecutionRateMin ?? 0.95);
  const changeMin = Number(targets.npcResolutionPlanChangeRateMin ?? 0.90);
  const staleMax = Number(targets.npcStaleCrisisPlanMax ?? 0);
  const mismatchMax = Number(targets.npcRoleMismatchMax ?? 0);
  const impossibleMax = Number(targets.npcImpossiblePlanMax ?? 0);
  push(audit.executionRate.median >= executionMin ? "verified" : "blocker", "V3_NPC_PLAN_EXECUTION", `期限内に実行可能なNPC計画率中央値${(audit.executionRate.median * 100).toFixed(1)}%`);
  push(audit.resolutionChangeRate.median >= changeMin ? "verified" : "blocker", "V3_NPC_PLAN_CHANGES_AFTER_PLAYER", `プレイヤー解決後に危機計画から復旧計画へ変化した率${(audit.resolutionChangeRate.median * 100).toFixed(1)}%`);
  push(audit.staleCrisisPlans <= staleMax ? "verified" : "blocker", "V3_NPC_NO_STALE_CRISIS_PLAN", `解決済み事件に残った危機計画${audit.staleCrisisPlans}件`);
  push(audit.roleMismatchCount <= mismatchMax ? "verified" : "blocker", "V3_NPC_ROLE_APPROPRIATE_PLAN", `職種・役割と不整合な対応計画${audit.roleMismatchCount}件`);
  push(audit.impossibleTravelCount <= impossibleMax ? "verified" : "blocker", "V3_NPC_PLAN_REACHABILITY", `到達不能な行動計画${audit.impossibleTravelCount}件`);
  return findings;
}

export async function runIntegratedPlayerSimulationSuiteV3Deep(options = {}) {
  const config = options.config ?? loadPlayerSimulationConfigV3();
  const profiles = options.profiles ?? PLAYER_PROFILES;
  const rootSeed = options.rootSeed ?? "trpg-player-v3-20260718";
  const model = options.model ?? loadWorldModel();
  const battleData = options.battleData ?? await loadBattleData();
  const skills = options.skills ?? loadSkills();
  const report = await runIntegratedPlayerSimulationSuiteV3Final({ ...options, config, profiles, rootSeed, model, battleData, skills });
  const planRuns = runNpcPlanAuditSet({
    model,
    battleData,
    skills,
    profiles,
    tuning: config.tuned,
    rootSeed,
    seedsPerProfile: Number(options.npcPlanSeedsPerProfile ?? process.env.TRPG_NPC_PLAN_SEEDS ?? 1),
  });
  const planResults = planRuns.map((run) => simulateNpcInterventionPlansForRun(run, model));
  report.npcPlanSimulation = aggregateNpcPlanResults(planRuns, planResults);
  report.findings.push(...deepFindings(report.npcPlanSimulation, config.qualityTargets));
  report.quality = {
    passed: report.findings.every((entry) => entry.severity !== "blocker"),
    blockers: report.findings.filter((entry) => entry.severity === "blocker").length,
    warnings: report.findings.filter((entry) => entry.severity === "warning").length,
  };
  return report;
}

export function renderPlayerSimulationMarkdownV3Deep(report) {
  const base = renderPlayerSimulationMarkdownV3Final(report);
  const audit = report.npcPlanSimulation;
  const planRows = Object.entries(audit.planKinds)
    .sort((left, right) => right[1] - left[1])
    .map(([kind, count]) => `| ${kind} | ${count} |`)
    .join("\n");
  return `${base}

## NPC行動計画リプレイ

関係NPCが噂を受信した時点から、現在地、目的地までの経路、職種、事件状態、重要度を用いて行動計画を再構成した。

- 対象run: ${audit.runs}
- 生成計画: ${audit.totalPlans}件
- 期限内実行可能: ${audit.executablePlans}件（中央値${(audit.executionRate.median * 100).toFixed(1)}%）
- 状況変化による計画改訂: ${audit.revisions}件
- 危機対応から解決後対応への変更: ${audit.crisisToResolutionChanges}/${audit.expectedResolutionChanges}件（${(audit.resolutionChangeRate.median * 100).toFixed(1)}%）
- 解決済み事件に残った危機計画: ${audit.staleCrisisPlans}件
- 職種・役割不一致: ${audit.roleMismatchCount}件
- 到達不能計画: ${audit.impossibleTravelCount}件
- 低優先度の古い情報を無視した回数: ${audit.lowerPriorityIgnored}件
- NPC行動による被害軽減寄与中央値: ${audit.executedMitigation.median}

| 実行計画 | 件数 |
|---|---:|
${planRows || "| なし | 0 |"}
`;
}
