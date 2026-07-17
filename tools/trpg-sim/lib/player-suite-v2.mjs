import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBattleData } from "./battle-model.mjs";
import { loadSkills } from "./fixtures.mjs";
import { loadWorldModel } from "./world-model.mjs";
import { simulateWorld } from "./world-simulator.mjs";
import { auditSkillCatalogV2 } from "./journey-v2-skills.mjs";
import {
  PLAYER_PROFILES_V2, availableLocalMovementActionsV2,
  availableRegionalMovementActionsV2, createInitialJourneyStateV2,
  generateChoiceActionsV2, simulatePlayerJourneyV2,
} from "./player-journey-v2.mjs";
import { shortestTravelPlan } from "./journey-v2-core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.resolve(HERE, "..", "config", "player-simulation.v2.json");
const mean = (values) => values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
function quantile(values, p) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))]; }
function stats(values, digits = 3) { const clean = values.map(Number).filter(Number.isFinite); const round = (value) => value == null ? null : +Number(value).toFixed(digits); return { count: clean.length, mean: round(mean(clean)), min: clean.length ? round(Math.min(...clean)) : null, p10: round(quantile(clean, .1)), median: round(quantile(clean, .5)), p90: round(quantile(clean, .9)), max: clean.length ? round(Math.max(...clean)) : null }; }

export function loadPlayerSimulationConfigV2(file = CONFIG) { return JSON.parse(fs.readFileSync(file, "utf8")); }

function aggregate(profile, runs) {
  const summaries = runs.map((run) => run.summary); const field = (name) => stats(summaries.map((summary) => summary[name]));
  return {
    profileId: profile.id, label: profile.label, runs: runs.length, reachedEndRate: mean(summaries.map((x) => x.reachedEnd ? 1 : 0)),
    level: field("level"), firstLevelUpDay: stats(summaries.map((x) => x.firstLevelUpDay ?? 101)), battles: field("battles"), winRate: field("winRate"),
    missionsCompleted: field("missionsCompleted"), permanentMissionsCompleted: field("permanentMissionsCompleted"), specialMissionsCompleted: field("specialMissionsCompleted"),
    specialMissionsDiscovered: field("specialMissionsDiscovered"), failedSpecialMissions: field("failedSpecialMissions"), activeMissionMean: field("activeMissionMean"),
    maxActiveSpecialMissions: field("maxActiveSpecialMissions"), missionExpShare: field("missionExpShare"),
    resolvedTroubles: stats(summaries.map((x) => Number(x.troubleCounts.resolved ?? 0))), failedTroubles: stats(summaries.map((x) => Number(x.troubleCounts.failed ?? 0))),
    playerResolved: field("troubleResolvedByPlayerAction"), playerFailed: field("troubleFailedByPlayerAction"), partialResolutions: field("troublePartialByPlayerAction"),
    learnedSkills: field("learnedSkills"), flagSkillsLearned: field("flagSkillsLearned"), eventGrantedSkills: field("eventGrantedSkills"), eventGrantSignals: field("eventGrantSignals"), equipmentGrantActivations: field("equipmentGrantActivations"),
    revealedSkills: field("revealedSkills"), flagUnlockedSkills: field("flagUnlockedSkills"), flagUnlockPathCount: field("flagUnlockPathCount"), localMovementActions: field("localMovementActions"), regionalMovementActions: field("regionalMovementActions"),
    visitedHubs: field("visitedHubs"), visitedFacilities: field("visitedFacilities"), movementBlocked: summaries.reduce((sum, x) => sum + x.movementBlocked, 0), movementObjectivesWaiting: field("movementObjectivesWaiting"), travelInterrupted: field("travelInterrupted"),
    choiceDeadEnds: summaries.reduce((sum, x) => sum + x.choiceDeadEnds, 0), replayMismatches: summaries.reduce((sum, x) => sum + x.replayMismatches, 0),
    skillAcquisitionViolations: summaries.reduce((sum, x) => sum + x.skillAcquisitionViolations, 0), invalidTroubleResolutions: summaries.reduce((sum, x) => sum + x.invalidTroubleResolutions, 0),
    terminatedByActionCap: summaries.filter((x) => x.terminatedByActionCap).length,
  };
}

function runMode({ mode, tuning, profiles, seeds, model, battleData, skills, rootSeed }) {
  const output = []; const representative = {};
  for (const profile of profiles) {
    const runs = [];
    for (let index = 0; index < seeds; index += 1) runs.push(simulatePlayerJourneyV2({ model, battleData, skills, profile, tuning, seed: `${rootSeed}:${mode}:${profile.id}:${index}`, maxActions: Number(tuning.maxActions ?? 6000) }));
    output.push(aggregate(profile, runs)); const selected = runs[Math.floor(runs.length / 2)];
    representative[profile.id] = { summary: selected.summary, recentHistory: selected.state.history.slice(-50), missionStates: Object.values(selected.state.missions).filter((mission) => mission.status !== "locked").slice(0, 70) };
  }
  return { mode, tuning, runs: profiles.length * seeds, seedsPerProfile: seeds, profiles: output, representative };
}

function auditInitialState({ model, battleData, skills, tuning, profiles }) {
  const issues = [];
  for (const profile of profiles) {
    const state = createInitialJourneyStateV2({ model, battleData, skills, profile, tuning, seed: `audit-v2:${profile.id}` });
    const choices = generateChoiceActionsV2(state, model, battleData, profile, () => true);
    if (choices.length !== 3 || new Set(choices.map((x) => x.id)).size !== 3) issues.push({ code: "THREE_CHOICE", profileId: profile.id });
    if (choices.some((x) => ["localTravel", "regionalTravel"].includes(x.type))) issues.push({ code: "MOVEMENT_INSIDE_CHOICES", profileId: profile.id });
    const local = availableLocalMovementActionsV2(state, model); const expectedLocal = (model.facilitiesByHub[state.player.location] ?? []).filter((x) => x.id !== state.player.facilityId).length;
    if (local.length !== expectedLocal) issues.push({ code: "LOCAL_MOVEMENT_INCOMPLETE", profileId: profile.id, expectedLocal, actual: local.length });
    const regional = availableRegionalMovementActionsV2(state, model); const listed = new Set(regional.map((x) => x.destination));
    for (const hub of model.locations) if (hub !== state.player.location && listed.has(hub) !== Boolean(shortestTravelPlan(model, state, state.player.location, hub))) issues.push({ code: "REGIONAL_MOVEMENT_INCOMPLETE", profileId: profile.id, hub });
  }
  return { ok: !issues.length, issues };
}

function findings(report, targets) {
  const all = report.tuned.profiles; const profile = (id) => all.find((x) => x.profileId === id); const scalarSum = (key) => all.reduce((sum, x) => sum + Number(x[key] ?? 0), 0); const medianSum = (key) => all.reduce((sum, x) => sum + Number(x[key]?.median ?? 0), 0);
  const medianLevel = quantile(all.map((x) => x.level.median), .5); const firstLevel = quantile(all.map((x) => x.firstLevelUpDay.median), .5); const missionShare = quantile(all.map((x) => x.missionExpShare.median), .5);
  const story = profile("story"); const fighter = profile("fighter"); const balanced = profile("balanced"); const merchant = profile("merchant"); const catalogTotal = report.tuned.representative.balanced.summary.missionCatalog.total;
  const activeMean = quantile(all.map((x) => x.activeMissionMean.median), .5); const activeSpecialMax = Math.max(...all.map((x) => x.maxActiveSpecialMissions.max));
  const flagLearningProfiles = all.filter((entry) => Number(entry.flagSkillsLearned.median ?? 0) > 0).length;
  const result = []; const add = (severity, code, detail) => result.push({ severity, code, detail });
  add(mean(all.map((x) => x.reachedEndRate)) >= targets.reachedEndRate ? "verified" : "blocker", "DAY100", `Day100到達率 ${(mean(all.map((x) => x.reachedEndRate)) * 100).toFixed(1)}%`);
  add(scalarSum("terminatedByActionCap") === 0 ? "verified" : "blocker", "ACTION_CAP", `停止run ${scalarSum("terminatedByActionCap")}`);
  add(scalarSum("movementBlocked") <= Number(targets.movementBlockedMax ?? 0) && scalarSum("choiceDeadEnds") === 0 ? "verified" : "blocker", "ACTION_ACCESS", `不正な移動不能 ${scalarSum("movementBlocked")} / アクセス待ち ${medianSum("movementObjectivesWaiting")} / 3択枯渇 ${scalarSum("choiceDeadEnds")}`);
  add(scalarSum("replayMismatches") === 0 ? "verified" : "blocker", "DETERMINISM", `不一致 ${scalarSum("replayMismatches")}`);
  add(medianLevel >= targets.medianLevelMin && medianLevel <= targets.medianLevelMax ? "verified" : "warning", "LEVEL_PACING", `Lv中央値 ${medianLevel}`);
  add(firstLevel >= targets.firstLevelUpMedianDayMin && firstLevel <= targets.firstLevelUpMedianDayMax ? "verified" : "warning", "FIRST_LEVEL", `初回LvUP Day${firstLevel}`);
  add(catalogTotal >= targets.missionCatalogMin && catalogTotal <= targets.missionCatalogMax ? "verified" : "warning", "MISSION_COUNT", `ミッション総数 ${catalogTotal}`);
  add(activeMean <= targets.activeMissionMeanMax && activeSpecialMax <= targets.maxActiveSpecialMax ? "verified" : "warning", "MISSION_LOAD", `同時進行平均 ${activeMean.toFixed(1)} / 特別最大 ${activeSpecialMax}`);
  add(missionShare >= targets.missionExpShareMin && missionShare <= targets.missionExpShareMax ? "verified" : "warning", "MISSION_EXP", `ミッションEXP比率中央値 ${(missionShare * 100).toFixed(1)}%`);
  add(story.specialMissionsCompleted.median >= targets.storySpecialResolvedMin && story.specialMissionsCompleted.median <= targets.storySpecialResolvedMax ? "verified" : "warning", "MISSION_RESOLUTION", `事件調査型解決中央値 ${story.specialMissionsCompleted.median}`);
  add(fighter.battles.median <= targets.fighterBattleMedianMax ? "verified" : "warning", "BATTLE_DENSITY", `戦闘型戦闘中央値 ${fighter.battles.median}`);
  add(merchant.regionalMovementActions.median <= targets.merchantRegionalMovementMedianMax ? "verified" : "warning", "MERCHANT_MOVEMENT_DENSITY", `商人型地域外移動中央値 ${merchant.regionalMovementActions.median}`);
  add(balanced.winRate.median >= targets.balancedWinRateMin && balanced.winRate.median <= targets.balancedWinRateMax ? "verified" : "warning", "BATTLE_BALANCE", `均衡型勝率 ${(balanced.winRate.median * 100).toFixed(1)}%`);
  add(scalarSum("skillAcquisitionViolations") === 0 && scalarSum("invalidTroubleResolutions") === 0 ? "verified" : "blocker", "STATE_AUTHORITY", `不正スキル取得 ${scalarSum("skillAcquisitionViolations")} / 不正トラブル解決 ${scalarSum("invalidTroubleResolutions")}`);
  add(medianSum("localMovementActions") > 0 && medianSum("regionalMovementActions") > 0 ? "verified" : "blocker", "MOVEMENT_COVERAGE", `地域内移動中央値合計 ${medianSum("localMovementActions")} / 地域外 ${medianSum("regionalMovementActions")}`);
  add(medianSum("flagUnlockedSkills") > 0 && flagLearningProfiles >= Number(targets.flagLearnedProfileCountMin ?? 1) && scalarSum("skillAcquisitionViolations") === 0 ? "verified" : "warning", "SKILL_FLAG_RUNTIME", `解禁済み技能中央値合計 ${medianSum("flagUnlockedSkills")} / 習得 ${medianSum("flagSkillsLearned")} / 習得方針 ${flagLearningProfiles}/${all.length}`);
  add(medianSum("eventGrantedSkills") >= Number(targets.eventGrantMedianSumMin ?? 1) && medianSum("eventGrantSignals") >= medianSum("eventGrantedSkills") ? "verified" : "warning", "SKILL_EVENT_GRANT_RUNTIME", `イベント付与 ${medianSum("eventGrantedSkills")} / 構造化付与信号 ${medianSum("eventGrantSignals")}`);
  add(medianSum("equipmentGrantActivations") > 0 ? "verified" : "warning", "SKILL_EQUIPMENT_GRANT_RUNTIME", `装備付与作動 ${medianSum("equipmentGrantActivations")}`);
  add(report.skillCatalogAudit.missingPrerequisites.length === 0 && report.skillCatalogAudit.equipmentGrantMissing.length === 0 ? "verified" : "warning", "SKILL_REFERENCE_AUDIT", `欠落前提 ${report.skillCatalogAudit.missingPrerequisites.length} / 欠落装備付与 ${report.skillCatalogAudit.equipmentGrantMissing.length}`);
  add(medianSum("playerResolved") > 0 && medianSum("failedTroubles") > 0 ? "verified" : "warning", "TROUBLE_OUTCOME_COVERAGE", `プレイヤー解決 ${medianSum("playerResolved")} / 失敗 ${medianSum("failedTroubles")}`);
  add(report.initialAudit.ok ? "verified" : "blocker", "INITIAL_AUDIT", report.initialAudit.ok ? "正常" : `${report.initialAudit.issues.length}件`);
  return result;
}

export async function runIntegratedPlayerSimulationSuiteV2(options = {}) {
  const config = options.config ?? loadPlayerSimulationConfigV2(); const profiles = options.profiles ?? PLAYER_PROFILES_V2; const seeds = Number(options.seedsPerProfile ?? process.env.TRPG_PLAYER_V2_SEEDS ?? config.seedsPerProfile ?? 8); const rootSeed = options.rootSeed ?? "trpg-player-v2-20260717";
  const model = options.model ?? loadWorldModel(); const battleData = options.battleData ?? await loadBattleData(); const skills = options.skills ?? loadSkills(); const initialAudit = auditInitialState({ model, battleData, skills, tuning: config.tuned, profiles });
  const report = { schemaVersion: "2.0.0", generatedAt: new Date().toISOString(), engineVersion: "integrated-player-journey-v2", rootSeed,
    sourceCounts: { locations: model.locations.length, facilities: model.facilities.length, routes: model.routes.length, troubles: model.troubles.length, npcs: model.npcs.length, equipment: battleData.equipment.length, monsters: battleData.monsters.length, encounters: battleData.encounters.length, skills: skills.length },
    noPlayerReference: simulateWorld({ model, seed: `${rootSeed}:no-player`, endDay: 100 }).summary.troubleStates, skillCatalogAudit: auditSkillCatalogV2(skills, battleData), initialAudit,
    baseline: runMode({ mode: "baseline", tuning: config.baseline, profiles, seeds, model, battleData, skills, rootSeed }), tuned: runMode({ mode: "tuned", tuning: config.tuned, profiles, seeds, model, battleData, skills, rootSeed }), qualityTargets: config.qualityTargets };
  report.findings = findings(report, config.qualityTargets); report.quality = { passed: report.findings.every((x) => x.severity !== "blocker"), blockers: report.findings.filter((x) => x.severity === "blocker").length, warnings: report.findings.filter((x) => x.severity === "warning").length }; return report;
}
