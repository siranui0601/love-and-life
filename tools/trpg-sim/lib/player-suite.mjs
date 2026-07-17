import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBattleData } from "./battle-model.mjs";
import { loadSkills } from "./fixtures.mjs";
import { loadWorldModel } from "./world-model.mjs";
import { simulateWorld } from "./world-simulator.mjs";
import {
  PLAYER_PROFILES,
  availableTravelActions,
  createInitialJourneyState,
  generateChoiceActions,
  shortestTravelPlan,
  simulatePlayerJourney,
} from "./player-journey.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = path.resolve(HERE, "..", "config", "player-simulation.v1.json");

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function quantile(values, probability) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * probability)));
  return sorted[index];
}

function summarize(values, digits = 3) {
  const clean = values.map(Number).filter(Number.isFinite);
  const round = (value) => value === null ? null : Number(Number(value).toFixed(digits));
  return {
    count: clean.length,
    mean: round(mean(clean)),
    min: clean.length ? round(Math.min(...clean)) : null,
    p10: round(quantile(clean, 0.1)),
    median: round(quantile(clean, 0.5)),
    p90: round(quantile(clean, 0.9)),
    max: clean.length ? round(Math.max(...clean)) : null,
  };
}

export function loadPlayerSimulationConfig(configPath = DEFAULT_CONFIG_PATH) {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function aggregateProfile(profile, runs) {
  const summaries = runs.map((run) => run.summary);
  return {
    profileId: profile.id,
    label: profile.label,
    runs: runs.length,
    reachedEndRate: mean(summaries.map((summary) => summary.reachedEnd ? 1 : 0)),
    level: summarize(summaries.map((summary) => summary.level)),
    firstLevelUpDay: summarize(summaries.map((summary) => summary.firstLevelUpDay ?? 101)),
    battles: summarize(summaries.map((summary) => summary.battles)),
    winRate: summarize(summaries.map((summary) => summary.winRate)),
    missionsCompleted: summarize(summaries.map((summary) => summary.missionsCompleted)),
    specialMissionsCompleted: summarize(summaries.map((summary) => summary.specialMissionsCompleted)),
    resolvedTroubles: summarize(summaries.map((summary) => Number(summary.troubleCounts.resolved ?? 0))),
    failedTroubles: summarize(summaries.map((summary) => Number(summary.troubleCounts.failed ?? 0))),
    visitedHubs: summarize(summaries.map((summary) => summary.visitedHubs)),
    walkMinutes: summarize(summaries.map((summary) => summary.walkMinutes)),
    gold: summarize(summaries.map((summary) => summary.gold)),
    learnedSkills: summarize(summaries.map((summary) => summary.learnedSkills)),
    purchases: summarize(summaries.map((summary) => summary.purchases)),
    rumorRecipients: summarize(summaries.map((summary) => summary.rumorRecipients)),
    npcReplans: summarize(summaries.map((summary) => summary.npcReplans)),
    choiceDeadEnds: summaries.reduce((sum, summary) => sum + summary.choiceDeadEnds, 0),
    travelBlocked: summaries.reduce((sum, summary) => sum + summary.travelBlocked, 0),
    replayMismatches: summaries.reduce((sum, summary) => sum + summary.replayMismatches, 0),
    shopDiagnostics: summaries.reduce((sum, summary) => sum + summary.shopDiagnostics, 0),
    terminatedByActionCap: summaries.filter((summary) => summary.terminatedByActionCap).length,
  };
}

function runMode({ mode, tuning, profiles, seedsPerProfile, model, battleData, skills, rootSeed }) {
  const byProfile = [];
  const representative = {};
  for (const profile of profiles) {
    const runs = [];
    for (let index = 0; index < seedsPerProfile; index += 1) {
      const run = simulatePlayerJourney({
        model,
        battleData,
        skills,
        profile,
        tuning,
        seed: `${rootSeed}:${mode}:${profile.id}:${index}`,
        maxActions: Number(tuning.maxActions ?? 6500),
      });
      runs.push(run);
    }
    byProfile.push(aggregateProfile(profile, runs));
    const selected = runs[Math.floor(runs.length / 2)];
    representative[profile.id] = {
      summary: selected.summary,
      recentHistory: selected.state.history.slice(-40),
      missionStates: Object.values(selected.state.missions)
        .filter((mission) => mission.status !== "locked")
        .slice(0, 40),
    };
  }
  return {
    mode,
    tuning,
    runs: profiles.length * seedsPerProfile,
    seedsPerProfile,
    profiles: byProfile,
    representative,
  };
}

function auditInitialInteraction({ model, battleData, skills, tuning, profiles }) {
  const issues = [];
  for (const profile of profiles) {
    const state = createInitialJourneyState({ model, battleData, skills, profile, tuning, seed: `audit:${profile.id}` });
    const travel = availableTravelActions(state, model);
    const reachable = model.locations
      .filter((hub) => hub !== state.player.location)
      .filter((hub) => Boolean(shortestTravelPlan(model, state, state.player.location, hub)));
    const listed = new Set(travel.map((action) => action.destination));
    const missing = reachable.filter((hub) => !listed.has(hub));
    const unexpected = travel.filter((action) => !reachable.includes(action.destination)).map((action) => action.destination);
    if (missing.length || unexpected.length) issues.push({ code: "TRAVEL_LIST_INCOMPLETE", profileId: profile.id, missing, unexpected });
    const choices = generateChoiceActions(state, model, battleData, state.catalog, profile);
    if (choices.length !== 3) issues.push({ code: "CHOICE_COUNT", profileId: profile.id, actual: choices.length });
    if (new Set(choices.map((choice) => choice.id)).size !== choices.length) issues.push({ code: "DUPLICATE_CHOICE", profileId: profile.id });
    if (choices.some((choice) => choice.type === "travel")) issues.push({ code: "TRAVEL_INSIDE_THREE_CHOICES", profileId: profile.id });
  }
  return { ok: issues.length === 0, issues };
}

function compareModes(baseline, tuned) {
  const byId = new Map(baseline.profiles.map((entry) => [entry.profileId, entry]));
  return tuned.profiles.map((entry) => {
    const previous = byId.get(entry.profileId);
    return {
      profileId: entry.profileId,
      levelMedianDelta: Number((entry.level.median - previous.level.median).toFixed(3)),
      specialResolvedMedianDelta: Number((entry.specialMissionsCompleted.median - previous.specialMissionsCompleted.median).toFixed(3)),
      winRateMedianDelta: Number((entry.winRate.median - previous.winRate.median).toFixed(3)),
      firstLevelUpMedianDayDelta: Number((entry.firstLevelUpDay.median - previous.firstLevelUpDay.median).toFixed(3)),
      travelBlockedDelta: entry.travelBlocked - previous.travelBlocked,
      choiceDeadEndDelta: entry.choiceDeadEnds - previous.choiceDeadEnds,
    };
  });
}

function qualityFindings(report, targets) {
  const findings = [];
  const profile = (id) => report.tuned.profiles.find((entry) => entry.profileId === id);
  const allProfiles = report.tuned.profiles;
  const totalRuns = report.tuned.runs;
  const reachedRate = mean(allProfiles.map((entry) => entry.reachedEndRate));
  const totalBlocked = allProfiles.reduce((sum, entry) => sum + entry.travelBlocked, 0);
  const totalDeadEnds = allProfiles.reduce((sum, entry) => sum + entry.choiceDeadEnds, 0);
  const totalReplay = allProfiles.reduce((sum, entry) => sum + entry.replayMismatches, 0);
  const totalActionCaps = allProfiles.reduce((sum, entry) => sum + entry.terminatedByActionCap, 0);
  const balanced = profile("balanced");
  const story = profile("story");
  const medianLevel = quantile(allProfiles.map((entry) => entry.level.median), 0.5);
  const firstLevel = quantile(allProfiles.map((entry) => entry.firstLevelUpDay.median), 0.5);

  findings.push({
    severity: reachedRate >= targets.reachedEndRate ? "verified" : "blocker",
    code: "DAY100_REACHABILITY",
    detail: `Day100到達率 ${(reachedRate * 100).toFixed(1)}% (${totalRuns} runs)`,
  });
  findings.push({
    severity: totalActionCaps === 0 ? "verified" : "blocker",
    code: "ACTION_CAP",
    detail: `最大行動数に達してDay100前に停止したrun ${totalActionCaps}`,
  });
  findings.push({
    severity: totalBlocked === 0 ? "verified" : "blocker",
    code: "TRAVEL_AVAILABILITY",
    detail: `到達可能なのに移動選択を生成できなかった回数 ${totalBlocked}`,
  });
  findings.push({
    severity: totalDeadEnds === 0 ? "verified" : "warning",
    code: "CHOICE_DEAD_END",
    detail: `3択候補が枯渇した回数 ${totalDeadEnds}`,
  });
  findings.push({
    severity: totalReplay === 0 ? "verified" : "blocker",
    code: "KNOWN_RESULT_DETERMINISM",
    detail: `非戦闘アクションの同一replayKey結果不一致 ${totalReplay}`,
  });
  findings.push({
    severity: medianLevel >= targets.medianLevelMin && medianLevel <= targets.medianLevelMax ? "verified" : "warning",
    code: "LEVEL_PACING",
    detail: `全プロファイルの到達Lv中央値 ${medianLevel} (target ${targets.medianLevelMin}-${targets.medianLevelMax})`,
  });
  findings.push({
    severity: firstLevel <= targets.firstLevelUpMedianDayMax ? "verified" : "warning",
    code: "FIRST_LEVEL_UP",
    detail: `初回レベルアップ日の中央値 Day${firstLevel}`,
  });
  findings.push({
    severity: story.specialMissionsCompleted.median >= targets.storyMedianSpecialResolvedMin ? "verified" : "warning",
    code: "STORY_INTERVENTION",
    detail: `事件調査型の特別ミッション解決中央値 ${story.specialMissionsCompleted.median}`,
  });
  findings.push({
    severity: balanced.winRate.median >= targets.balancedMedianWinRateMin && balanced.winRate.median <= targets.balancedMedianWinRateMax ? "verified" : "warning",
    code: "SOLO_BATTLE_RATE",
    detail: `均衡型の戦闘勝率中央値 ${(balanced.winRate.median * 100).toFixed(1)}%`,
  });
  findings.push({
    severity: report.initialInteraction.ok ? "verified" : "blocker",
    code: "INITIAL_INTERACTION",
    detail: `初期状態の移動一覧・3択監査 ${report.initialInteraction.ok ? "正常" : `${report.initialInteraction.issues.length}件`}`,
  });
  return findings;
}

export async function runIntegratedPlayerSimulationSuite(options = {}) {
  const config = options.config ?? loadPlayerSimulationConfig();
  const profiles = options.profiles ?? PLAYER_PROFILES;
  const seedsPerProfile = Number(options.seedsPerProfile ?? process.env.TRPG_PLAYER_SEEDS ?? config.seedsPerProfile ?? 12);
  const rootSeed = options.rootSeed ?? "trpg-player-v1-20260717";
  const model = options.model ?? loadWorldModel();
  const battleData = options.battleData ?? await loadBattleData();
  const skills = options.skills ?? loadSkills();
  const baselineWorld = simulateWorld({ model, seed: `${rootSeed}:no-player`, endDay: 100 });
  const initialInteraction = auditInitialInteraction({ model, battleData, skills, tuning: config.tuned, profiles });
  const baseline = runMode({ mode: "baseline", tuning: config.baseline, profiles, seedsPerProfile, model, battleData, skills, rootSeed });
  const tuned = runMode({ mode: "tuned", tuning: config.tuned, profiles, seedsPerProfile, model, battleData, skills, rootSeed });
  const report = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    engineVersion: "integrated-player-journey-v1",
    rootSeed,
    sourceCounts: {
      locations: model.locations.length,
      routes: model.routes.length,
      troubles: model.troubles.length,
      npcs: model.npcs.length,
      equipment: battleData.equipment.length,
      stock: battleData.inventory.length,
      monsters: battleData.monsters.length,
      encounters: battleData.encounters.length,
      skills: skills.length,
    },
    noPlayerReference: {
      fingerprint: baselineWorld.fingerprint,
      troubleStates: baselineWorld.summary.troubleStates,
      npcStateTicks: baselineWorld.activityCoverage.expectedStateTicks,
      invariantOk: baselineWorld.invariants.ok,
    },
    initialInteraction,
    baseline,
    tuned,
    tuningComparison: compareModes(baseline, tuned),
    qualityTargets: config.qualityTargets,
  };
  report.findings = qualityFindings(report, config.qualityTargets);
  report.quality = {
    passed: report.findings.every((finding) => finding.severity !== "blocker"),
    blockers: report.findings.filter((finding) => finding.severity === "blocker").length,
    warnings: report.findings.filter((finding) => finding.severity === "warning").length,
  };
  return report;
}

export function renderPlayerSimulationMarkdown(report) {
  const profileRows = report.tuned.profiles.map((entry) =>
    `| ${entry.label} | ${entry.level.median} | Day${entry.firstLevelUpDay.median} | ${(entry.winRate.median * 100).toFixed(1)}% | ${entry.specialMissionsCompleted.median} | ${entry.resolvedTroubles.median} | ${entry.visitedHubs.median} | ${entry.travelBlocked} |`
  ).join("\n");
  const findings = report.findings.map((finding, index) => `${index + 1}. **${finding.code}** (${finding.severity}) — ${finding.detail}`).join("\n");
  return `# TRPG（仮題）統合プレイヤーシミュレーション

- 生成: ${report.generatedAt}
- seed: \`${report.rootSeed}\`
- プレイヤーrun: baseline ${report.baseline.runs} + tuned ${report.tuned.runs}
- 参照: ${report.sourceCounts.troubles}トラブル / ${report.sourceCounts.npcs} NPC / ${report.sourceCounts.encounters}エンカウント / ${report.sourceCounts.skills}スキル
- 品質判定: ${report.quality.passed ? "PASS" : "BLOCKED"}（blocker ${report.quality.blockers}, warning ${report.quality.warnings}）

## 調整後の結果

| 方針 | 到達Lv中央値 | 初LvUP | 戦闘勝率中央値 | 特別任務 | 解決トラブル | 訪問拠点 | 移動不能 |
|---|---:|---:|---:|---:|---:|---:|---:|
${profileRows}

## 検証項目

${findings}

## 実装上の前提

- 3択とは別に、到達可能な全拠点への移動一覧を常設する。
- 会話・調査・休息・戦闘準備は分単位で時間を進める。
- 通常の購入・売却・装備変更は時間を進めない。
- 同じ完全状態と同じ非戦闘actionIdは同じ結果になる。遭遇と戦闘はaction attemptを乱数キーへ含める。
- 経験値は討伐と、常駐・特別ミッションの完了から得る。
- トラブル解決はNPC貢献値ではなく、プレイヤーミッションの段階達成と最終選択で決まる。
`;
}
