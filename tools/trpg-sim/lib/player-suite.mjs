import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBattleData } from "./battle-model.mjs";
import { loadSkills } from "./fixtures.mjs";
import { auditMissionCatalog } from "./mission-model.mjs";
import { auditSkillProgression, flattenConditionLeaves } from "./skill-progression.mjs";
import { loadWorldModel } from "./world-model.mjs";
import { simulateWorld } from "./world-simulator.mjs";
import {
  PLAYER_PROFILES,
  availableLocalMovementActions,
  availableMovementActions,
  availableTravelActions,
  createInitialJourneyState,
  generateChoiceActions,
  probeTroubleResolution,
  shortestTravelPlan,
  simulatePlayerJourney,
} from "./player-journey.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = path.resolve(HERE, "..", "config", "player-simulation.v2.json");

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function quantile(values, probability) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
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

function unionFromRuns(runs, select) {
  const values = new Set();
  for (const run of runs) for (const value of select(run) ?? []) values.add(value);
  return [...values].sort();
}

export function loadPlayerSimulationConfig(configPath = DEFAULT_CONFIG_PATH) {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function aggregateProfile(profile, runs) {
  const summaries = runs.map((run) => run.summary);
  const acquiredFlagIds = unionFromRuns(runs, (run) => run.state.history
    .filter((entry) => entry.type === "SKILL_LEARNED" && entry.acquisitionCode === "flag_unlocked")
    .map((entry) => entry.skillId));
  const eventGrantedIds = unionFromRuns(runs, (run) => [...run.state.progress.events.grantedSkillIds]);
  const finalFlagEligibleIds = unionFromRuns(runs, (run) => [...run.state.player.flagEligibleSkillIds]);
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
    permanentMissionsCompleted: summarize(summaries.map((summary) => summary.permanentMissionsCompleted)),
    specialMissionsCompleted: summarize(summaries.map((summary) => summary.specialMissionsCompleted)),
    missionExpShare: summarize(summaries.map((summary) => summary.missionExpShare)),
    maxActivePermanent: summarize(summaries.map((summary) => summary.maxActivePermanent)),
    maxActiveSpecial: summarize(summaries.map((summary) => summary.maxActiveSpecial)),
    attemptedTroubles: summarize(summaries.map((summary) => summary.attemptedTroubles)),
    resolvedTroubles: summarize(summaries.map((summary) => Number(summary.troubleCounts.resolved ?? 0))),
    failedTroubles: summarize(summaries.map((summary) => Number(summary.troubleCounts.failed ?? 0))),
    visitedHubs: summarize(summaries.map((summary) => summary.visitedHubs)),
    visitedFacilities: summarize(summaries.map((summary) => summary.visitedFacilities)),
    localMoves: summarize(summaries.map((summary) => summary.localMoves)),
    regionalMoves: summarize(summaries.map((summary) => summary.regionalMoves)),
    walkMinutes: summarize(summaries.map((summary) => summary.walkMinutes)),
    gold: summarize(summaries.map((summary) => summary.gold)),
    learnedSkills: summarize(summaries.map((summary) => summary.learnedSkills)),
    flagLearnedSkills: summarize(summaries.map((summary) => summary.flagLearnedSkills)),
    eventGrantedSkills: summarize(summaries.map((summary) => summary.eventGrantedSkills)),
    equipmentGrantedSkills: summarize(summaries.map((summary) => summary.equipmentGrantedSkills)),
    visibleSkillCount: summarize(summaries.map((summary) => summary.visibleSkillCount)),
    purchases: summarize(summaries.map((summary) => summary.purchases)),
    rumorRecipients: summarize(summaries.map((summary) => summary.rumorRecipients)),
    npcReplans: summarize(summaries.map((summary) => summary.npcReplans)),
    acquiredFlagIds,
    eventGrantedIds,
    finalFlagEligibleIds,
    resolvedTroubleIds: unionFromRuns(runs, (run) => run.summary.resolvedTroubleIds),
    failedAfterAttemptIds: unionFromRuns(runs, (run) => run.summary.failedAfterAttemptIds),
    choiceDeadEnds: summaries.reduce((sum, summary) => sum + summary.choiceDeadEnds, 0),
    movementBlocked: summaries.reduce((sum, summary) => sum + summary.movementBlocked, 0),
    travelBlocked: summaries.reduce((sum, summary) => sum + summary.travelBlocked, 0),
    replayMismatches: summaries.reduce((sum, summary) => sum + summary.replayMismatches, 0),
    skillConditionViolations: summaries.reduce((sum, summary) => sum + summary.skillConditionViolations, 0),
    shopDiagnostics: summaries.reduce((sum, summary) => sum + summary.shopDiagnostics, 0),
    terminatedByActionCap: summaries.filter((summary) => summary.terminatedByActionCap).length,
  };
}

function missionCompletionRates(runs) {
  const counts = {};
  for (const run of runs) {
    for (const missionId of run.state.progress.missions.completedIds) counts[missionId] = (counts[missionId] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort().map(([missionId, count]) => [missionId, { completedRuns: count, rate: count / runs.length }]));
}

function runMode({ mode, tuning, profiles, seedsPerProfile, model, battleData, skills, rootSeed }) {
  const byProfile = [];
  const representative = {};
  const allRuns = [];
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
        maxActions: Number(tuning.maxActions ?? 5000),
      });
      runs.push(run);
      allRuns.push(run);
    }
    byProfile.push(aggregateProfile(profile, runs));
    const selected = runs[Math.floor(runs.length / 2)];
    representative[profile.id] = {
      summary: selected.summary,
      recentHistory: selected.state.history.slice(-50),
      missionStates: Object.values(selected.state.missions).filter((mission) => mission.status !== "locked").slice(0, 50),
    };
  }
  return {
    mode,
    tuning,
    runs: profiles.length * seedsPerProfile,
    seedsPerProfile,
    profiles: byProfile,
    resolvedTroubleIds: unionFromRuns(allRuns, (run) => run.summary.resolvedTroubleIds),
    attemptedTroubleIds: unionFromRuns(allRuns, (run) => [...run.state.progress.missions.attemptedTroubleIds]),
    failedAfterAttemptIds: unionFromRuns(allRuns, (run) => run.summary.failedAfterAttemptIds),
    acquiredFlagSkillIds: unionFromRuns(allRuns, (run) => run.state.history.filter((entry) => entry.type === "SKILL_LEARNED" && entry.acquisitionCode === "flag_unlocked").map((entry) => entry.skillId)),
    eventGrantedSkillIds: unionFromRuns(allRuns, (run) => [...run.state.progress.events.grantedSkillIds]),
    equipmentGrantedSkillIds: unionFromRuns(allRuns, (run) => Object.values(run.state.player.equipment).map((id) => battleData.equipmentById.get(id)?.grantedSkillId).filter(Boolean)),
    missionCompletionRates: missionCompletionRates(allRuns),
    representative,
  };
}

function auditInitialInteraction({ model, battleData, skills, tuning, profiles }) {
  const issues = [];
  for (const profile of profiles) {
    const state = createInitialJourneyState({ model, battleData, skills, profile, tuning, seed: `audit:${profile.id}` });
    const choices = generateChoiceActions(state, model, battleData, state.catalog, profile);
    if (choices.length !== 3) issues.push({ code: "CHOICE_COUNT", profileId: profile.id, actual: choices.length });
    if (new Set(choices.map((choice) => choice.id)).size !== choices.length) issues.push({ code: "DUPLICATE_CHOICE", profileId: profile.id });
    if (choices.some((choice) => choice.type === "move" || choice.type === "travel")) issues.push({ code: "MOVEMENT_INSIDE_THREE_CHOICES", profileId: profile.id });

    const movement = availableMovementActions(state, model);
    const local = availableLocalMovementActions(state, model);
    const regional = availableTravelActions(state, model);
    const expectedLocal = (model.facilitiesByHub[state.player.location] ?? []).filter((facility) => facility.id !== state.player.facilityId);
    const missingLocal = expectedLocal.filter((facility) => !local.some((action) => action.destinationFacilityId === facility.id)).map((facility) => facility.id);
    if (missingLocal.length) issues.push({ code: "LOCAL_MOVEMENT_INCOMPLETE", profileId: profile.id, missingLocal });

    const reachable = model.locations
      .filter((hub) => hub !== state.player.location)
      .filter((hub) => Boolean(shortestTravelPlan(model, state, state.player.location, hub)));
    const listed = new Set(regional.map((action) => action.destinationHub));
    const missingRegional = reachable.filter((hub) => !listed.has(hub));
    const unexpectedRegional = regional.filter((action) => !reachable.includes(action.destinationHub)).map((action) => action.destinationHub);
    if (missingRegional.length || unexpectedRegional.length) issues.push({ code: "REGIONAL_MOVEMENT_INCOMPLETE", profileId: profile.id, missingRegional, unexpectedRegional });
    if (movement.length !== local.length + regional.length) issues.push({ code: "MOVEMENT_MENU_COUNT", profileId: profile.id });
  }
  return { ok: issues.length === 0, issues };
}

function compactSkillAudit(skills, staticAudit, tuned) {
  const flagSkills = skills.filter((skill) => skill.acquisitionCode === "flag_unlocked");
  const flagWithRealFlag = flagSkills.filter((skill) => flattenConditionLeaves(skill.eventUnlockConditions).concat(flattenConditionLeaves(skill.learnConditions))
    .some((leaf) => `${leaf.scope}.${leaf.path}` !== "player.level"));
  const eventSkills = skills.filter((skill) => skill.acquisitionCode === "event_granted");
  const eventWithStructuredGrant = eventSkills.filter((skill) => flattenConditionLeaves(skill.grantConditions).length > 0);
  const equipmentSkills = skills.filter((skill) => skill.acquisitionCode === "equipment_granted");
  return {
    definitions: {
      total: skills.length,
      flagUnlocked: flagSkills.length,
      flagUnlockedWithNonLevelCondition: flagWithRealFlag.length,
      eventGranted: eventSkills.length,
      eventGrantedWithStructuredGrant: eventWithStructuredGrant.length,
      equipmentGranted: equipmentSkills.length,
    },
    actual: {
      acquiredFlagSkillIds: tuned.acquiredFlagSkillIds,
      eventGrantedSkillIds: tuned.eventGrantedSkillIds,
      equipmentGrantedSkillIds: tuned.equipmentGrantedSkillIds,
      conditionViolations: tuned.profiles.reduce((sum, profile) => sum + profile.skillConditionViolations, 0),
    },
    static: {
      structurallyUnreachableCount: staticAudit.diagnostics.structurallyUnreachable.length,
      structurallyUnreachableSample: staticAudit.diagnostics.structurallyUnreachable.slice(0, 30),
      missingPrerequisiteCount: staticAudit.diagnostics.prerequisites.missing.length,
      prerequisiteCycleCount: staticAudit.diagnostics.prerequisites.cycles.length,
      equipmentUnreferencedCount: staticAudit.diagnostics.equipmentGranted.unreferenced.length,
      equipmentClassificationMismatchCount: staticAudit.diagnostics.equipmentGranted.referenceClassificationMismatches.length,
      eventUnsuppliedCount: staticAudit.diagnostics.eventGranted.unsupplied.length,
      dictionaryMissingPathCount: staticAudit.conditionCoverage.dictionaryMissingPaths.length,
    },
  };
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
      battleMedianDelta: Number((entry.battles.median - previous.battles.median).toFixed(3)),
      firstLevelUpMedianDayDelta: Number((entry.firstLevelUpDay.median - previous.firstLevelUpDay.median).toFixed(3)),
      movementBlockedDelta: entry.movementBlocked - previous.movementBlocked,
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
  const totalBlocked = allProfiles.reduce((sum, entry) => sum + entry.movementBlocked + entry.travelBlocked, 0);
  const totalDeadEnds = allProfiles.reduce((sum, entry) => sum + entry.choiceDeadEnds, 0);
  const totalReplay = allProfiles.reduce((sum, entry) => sum + entry.replayMismatches, 0);
  const totalActionCaps = allProfiles.reduce((sum, entry) => sum + entry.terminatedByActionCap, 0);
  const totalSkillViolations = allProfiles.reduce((sum, entry) => sum + entry.skillConditionViolations, 0);
  const balanced = profile("balanced");
  const story = profile("story");
  const fighter = profile("fighter");
  const explorer = profile("explorer");
  const medianLevel = quantile(allProfiles.map((entry) => entry.level.median), 0.5);
  const firstLevel = quantile(allProfiles.map((entry) => entry.firstLevelUpDay.median), 0.5);
  const missionExpShare = quantile(allProfiles.map((entry) => entry.missionExpShare.median), 0.5);

  const push = (severity, code, detail) => findings.push({ severity, code, detail });
  push(reachedRate >= targets.reachedEndRate ? "verified" : "blocker", "DAY100_REACHABILITY", `Day100到達率 ${(reachedRate * 100).toFixed(1)}% (${totalRuns} runs)`);
  push(totalActionCaps === 0 ? "verified" : "blocker", "ACTION_CAP", `最大行動数で停止したrun ${totalActionCaps}`);
  push(totalBlocked === 0 ? "verified" : "blocker", "MOVEMENT_AVAILABILITY", `地域内外の移動不能回数 ${totalBlocked}`);
  push(totalDeadEnds === 0 ? "verified" : "warning", "CHOICE_DEAD_END", `3択候補枯渇 ${totalDeadEnds}`);
  push(totalReplay === 0 ? "verified" : "blocker", "KNOWN_RESULT_DETERMINISM", `非戦闘replay不一致 ${totalReplay}`);
  push(report.initialInteraction.ok ? "verified" : "blocker", "INITIAL_INTERACTION", `3択・地域内外移動監査 ${report.initialInteraction.ok ? "正常" : `${report.initialInteraction.issues.length}件`}`);
  push(report.missionAudit.ok ? "verified" : "blocker", "MISSION_CATALOG", `常駐${report.missionAudit.counts.permanentDefinitions}件（初期表示${report.missionAudit.counts.initialActivePermanent}件）＋特別${report.missionAudit.counts.special}件`);
  push(report.troubleResolutionProbe.successRate >= targets.troubleProbeSuccessRate ? "verified" : "blocker", "TROUBLE_ACTION_RESOLUTION", `隔離プローブ ${report.troubleResolutionProbe.successes}/${report.troubleResolutionProbe.total}トラブル解決`);
  push(totalSkillViolations === 0 ? "verified" : "blocker", "SKILL_CONDITION_SAFETY", `取得条件不成立のスキル取得 ${totalSkillViolations}件`);
  push(medianLevel >= targets.medianLevelMin && medianLevel <= targets.medianLevelMax ? "verified" : "warning", "LEVEL_PACING", `到達Lv中央値 ${medianLevel}（target ${targets.medianLevelMin}-${targets.medianLevelMax}）`);
  push(firstLevel >= targets.firstLevelUpMedianDayMin && firstLevel <= targets.firstLevelUpMedianDayMax ? "verified" : "warning", "FIRST_LEVEL_UP", `初回LvUP中央値 Day${firstLevel}`);
  push(missionExpShare >= targets.missionExpShareMin && missionExpShare <= targets.missionExpShareMax ? "verified" : "warning", "MISSION_EXP_SHARE", `経験値に占めるミッション中央値 ${(missionExpShare * 100).toFixed(1)}%`);
  push(story.specialMissionsCompleted.median >= targets.storyMedianSpecialResolvedMin ? "verified" : "warning", "STORY_INTERVENTION", `事件調査型の特別ミッション解決中央値 ${story.specialMissionsCompleted.median}`);
  push(report.tuned.resolvedTroubleIds.length >= targets.resolvedTroubleUnionMin ? "verified" : "warning", "TROUBLE_COVERAGE", `通常プレイ群で解決されたトラブル ${report.tuned.resolvedTroubleIds.length}/${report.sourceCounts.troubles}`);
  push(balanced.winRate.median >= targets.balancedMedianWinRateMin && balanced.winRate.median <= targets.balancedMedianWinRateMax ? "verified" : "warning", "BALANCED_BATTLE_RATE", `均衡型勝率 ${(balanced.winRate.median * 100).toFixed(1)}%`);
  push(fighter.battles.median >= targets.fighterBattleMedianMin && fighter.battles.median <= targets.fighterBattleMedianMax ? "verified" : "warning", "FIGHTER_BATTLE_DENSITY", `戦闘優先型の戦闘数中央値 ${fighter.battles.median}`);
  push(explorer.localMoves.median > 0 && explorer.regionalMoves.median > 0 ? "verified" : "warning", "LOCAL_AND_REGIONAL_MOVEMENT", `探索型 地域内${explorer.localMoves.median}回・地域間${explorer.regionalMoves.median}回`);
  push(report.skillAudit.actual.acquiredFlagSkillIds.length >= targets.flagSkillAcquisitionMin ? "verified" : "warning", "FLAG_SKILL_ACQUISITION", `実プレイで取得したフラグ解禁スキル ${report.skillAudit.actual.acquiredFlagSkillIds.length}種`);
  push(report.skillAudit.actual.eventGrantedSkillIds.length >= targets.eventSkillGrantMin ? "verified" : "warning", "EVENT_SKILL_SUPPLY", `実プレイでイベント付与されたスキル ${report.skillAudit.actual.eventGrantedSkillIds.length}種`);
  return findings;
}

function runTroubleProbes({ model, battleData, skills, tuning, rootSeed }) {
  const results = model.troubles.map((trouble) => probeTroubleResolution({
    model,
    battleData,
    skills,
    troubleId: trouble.id,
    tuning,
    seed: `${rootSeed}:probe:${trouble.id}`,
  }));
  const successes = results.filter((result) => result.ok).length;
  return {
    total: results.length,
    successes,
    successRate: results.length ? successes / results.length : 0,
    failures: results.filter((result) => !result.ok),
    results,
  };
}

export async function runIntegratedPlayerSimulationSuite(options = {}) {
  const config = options.config ?? loadPlayerSimulationConfig();
  const profiles = options.profiles ?? PLAYER_PROFILES;
  const seedsPerProfile = Number(options.seedsPerProfile ?? process.env.TRPG_PLAYER_SEEDS ?? config.seedsPerProfile ?? 8);
  const rootSeed = options.rootSeed ?? "trpg-player-v2-20260717";
  const model = options.model ?? loadWorldModel();
  const battleData = options.battleData ?? await loadBattleData();
  const skills = options.skills ?? loadSkills();
  const baselineWorld = simulateWorld({ model, seed: `${rootSeed}:no-player`, endDay: 100 });
  const initialInteraction = auditInitialInteraction({ model, battleData, skills, tuning: config.tuned, profiles });
  const initialState = createInitialJourneyState({ model, battleData, skills, profile: profiles[0], tuning: config.tuned, seed: `${rootSeed}:mission-audit` });
  const missionAudit = auditMissionCatalog(initialState.catalog, model, battleData);
  const staticSkillAudit = auditSkillProgression({ skills, seed: 20260717 });
  const baseline = runMode({ mode: "baseline", tuning: config.baseline, profiles, seedsPerProfile, model, battleData, skills, rootSeed });
  const tuned = runMode({ mode: "tuned", tuning: config.tuned, profiles, seedsPerProfile, model, battleData, skills, rootSeed });
  const troubleResolutionProbe = runTroubleProbes({ model, battleData, skills, tuning: config.tuned, rootSeed });
  const skillAudit = compactSkillAudit(skills, staticSkillAudit, tuned);
  const report = {
    schemaVersion: "2.0.0",
    generatedAt: new Date().toISOString(),
    engineVersion: "integrated-player-journey-v2",
    rootSeed,
    sourceCounts: {
      locations: model.locations.length,
      facilities: model.facilities.length,
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
    missionAudit,
    skillAudit,
    troubleResolutionProbe,
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
    `| ${entry.label} | ${entry.level.median} | Day${entry.firstLevelUpDay.median} | ${entry.battles.median} | ${(entry.winRate.median * 100).toFixed(1)}% | ${entry.permanentMissionsCompleted.median} | ${entry.specialMissionsCompleted.median} | ${entry.resolvedTroubles.median} | ${entry.localMoves.median}/${entry.regionalMoves.median} | ${entry.flagLearnedSkills.median}/${entry.eventGrantedSkills.median} |`
  ).join("\n");
  const findings = report.findings.map((finding, index) => `${index + 1}. **${finding.code}**（${finding.severity}）— ${finding.detail}`).join("\n");
  const probeFailures = report.troubleResolutionProbe.failures.length
    ? report.troubleResolutionProbe.failures.map((failure) => `- ${failure.troubleId}: ${failure.reason}`).join("\n")
    : "- なし";
  return `# TRPG（仮題）統合プレイヤーシミュレーション v2

- 生成: ${report.generatedAt}
- seed: \`${report.rootSeed}\`
- プレイヤーrun: baseline ${report.baseline.runs} + tuned ${report.tuned.runs}
- 参照: ${report.sourceCounts.troubles}トラブル / ${report.sourceCounts.facilities}地域内施設 / ${report.sourceCounts.encounters}エンカウント / ${report.sourceCounts.skills}スキル
- 品質判定: ${report.quality.passed ? "PASS" : "BLOCKED"}（blocker ${report.quality.blockers}, warning ${report.quality.warnings}）

## 調整後の結果

| 方針 | 到達Lv | 初LvUP | 戦闘数 | 勝率 | 常駐任務 | 特別任務 | 解決T | 地域内/間移動 | フラグ/イベント技能 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${profileRows}

## ミッション構成

- 常駐ミッション定義: ${report.missionAudit.counts.permanentDefinitions}件、${report.missionAudit.counts.permanentChains}系列。初期に同時表示するのは${report.missionAudit.counts.initialActivePermanent}件。
- 特別ミッション: ${report.missionAudit.counts.special}件（トラブルと1対1）。
- 常駐EXP総量: ${report.missionAudit.rewardTotals.permanentExp} / 特別EXP総量: ${report.missionAudit.rewardTotals.specialExp}
- 通常プレイ群で解決されたトラブル: ${report.tuned.resolvedTroubleIds.length}/${report.sourceCounts.troubles}

## スキル取得監査

- フラグ解禁定義: ${report.skillAudit.definitions.flagUnlocked}件（Lv以外の条件を持つもの ${report.skillAudit.definitions.flagUnlockedWithNonLevelCondition}件）
- イベント付与定義: ${report.skillAudit.definitions.eventGranted}件（構造化grantConditionsあり ${report.skillAudit.definitions.eventGrantedWithStructuredGrant}件）
- 装備付与定義: ${report.skillAudit.definitions.equipmentGranted}件
- 実プレイで取得: フラグ解禁 ${report.skillAudit.actual.acquiredFlagSkillIds.length}種 / イベント付与 ${report.skillAudit.actual.eventGrantedSkillIds.length}種 / 装備付与 ${report.skillAudit.actual.equipmentGrantedSkillIds.length}種
- 条件不成立取得: ${report.skillAudit.actual.conditionViolations}件
- 静的に到達不能: ${report.skillAudit.static.structurallyUnreachableCount}件

## トラブル解決プローブ

- プレイヤー行動列だけで ${report.troubleResolutionProbe.successes}/${report.troubleResolutionProbe.total}件を解決。
- 失敗:
${probeFailures}

## 検証項目

${findings}

## 実装上の前提

- 3択とは別に、地域内施設と地域間拠点を統合した移動メニューを常設する。
- 地域内移動も分単位で進み、歩行系常駐ミッションへ加算する。
- 常駐ミッションは8系列×3段階だが、同時表示は各系列の現在段階だけとする。
- 特別ミッションは情報取得、調査、必要時の戦闘、最終対応を順に満たしたときだけトラブルを解決する。
- スキル取得はサーバーがreveal/eventUnlock/learn/grant条件を再検証し、AIは取得可否を決めない。
`;
}
