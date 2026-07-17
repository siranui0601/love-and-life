import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBattleData } from "./battle-model.mjs";
import { loadSkills } from "./fixtures.mjs";
import {
  GAME_END_MINUTE,
  PLAYER_PROFILES,
  clockFromMinute,
  shortestTravelPlan,
  simulatePlayerJourney,
} from "./player-journey.mjs";
import {
  renderPlayerSimulationMarkdown,
  runIntegratedPlayerSimulationSuite,
} from "./player-suite.mjs";
import { loadWorldModel } from "./world-model.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = path.resolve(HERE, "..", "config", "player-simulation.v3.json");

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function quantile(values, probability) {
  const clean = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!clean.length) return null;
  const index = Math.min(clean.length - 1, Math.max(0, Math.floor((clean.length - 1) * probability)));
  return clean[index];
}

function summarize(values, digits = 3) {
  const clean = values.map(Number).filter(Number.isFinite);
  const round = (value) => value == null ? null : Number(Number(value).toFixed(digits));
  return {
    count: clean.length,
    mean: round(mean(clean)),
    min: clean.length ? round(Math.min(...clean)) : null,
    median: round(quantile(clean, 0.5)),
    p90: round(quantile(clean, 0.9)),
    max: clean.length ? round(Math.max(...clean)) : null,
  };
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 1;
}

export function loadPlayerSimulationConfigV3(configPath = DEFAULT_CONFIG_PATH) {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function npcHubAtMinute(npc, minute) {
  const day = clockFromMinute(minute).day;
  return day <= 1 ? npc.initialLocation : npc.home || npc.initialLocation;
}

function responseKind(npc, status) {
  const text = JSON.stringify(npc);
  if (status === "resolved") {
    if (/兵|騎士|警備|衛兵|軍/u.test(text)) return "stand_down_and_patrol";
    if (/医|治療|薬|神官/u.test(text)) return "recovery_care";
    if (/商|鍛冶|工房|職人/u.test(text)) return "recovery_supply";
    return "reassess_and_recover";
  }
  if (/医|治療|薬|神官/u.test(text)) return "medical_response";
  if (/兵|騎士|警備|衛兵|軍/u.test(text)) return "defend_or_escort";
  if (/商|鍛冶|工房|職人/u.test(text)) return "supply_response";
  if (/学者|研究|調査|司書|記録/u.test(text)) return "investigate_response";
  if (npc.disposition === "mitigate") return "evacuate_or_mitigate";
  return "observe_and_replan";
}

function rumorStatus(rumor) {
  const match = String(rumor.id ?? "").match(/RUM-T\d{2}-(resolved|critical|failed|active|suppressed)$/u);
  return match?.[1] ?? null;
}

function reachableRelevantNpcs(state, model, rumor, relatedNpcs) {
  return relatedNpcs.filter((npc) => {
    const hub = npcHubAtMinute(npc, rumor.originMinute);
    const route = shortestTravelPlan(model, state, rumor.origin, hub);
    if (!route) return false;
    const earliest = rumor.originMinute + Math.ceil(route.hours * 60) + 30;
    return earliest <= GAME_END_MINUTE;
  });
}

function auditRunNpcIntervention(run, model) {
  const state = run.state;
  const npcById = new Map(model.npcs.map((npc) => [npc.id, npc]));
  let expectedRelevant = 0;
  let receivedRelevant = 0;
  let resolvedExpected = 0;
  let resolvedReceived = 0;
  let crisisExpected = 0;
  let crisisReceived = 0;
  let expectedReplans = 0;
  let staleEscalations = 0;
  let resolutionAuthorityViolations = 0;
  const responseKinds = {};
  const perTrouble = {};

  for (const entry of state.history) {
    if (entry.type !== "TROUBLE_TRANSITION") continue;
    if (entry.to === "resolved" && entry.reason !== "player-mission-resolution") resolutionAuthorityViolations += 1;
  }

  for (const trouble of model.troubles) {
    const transitions = state.troubles[trouble.id]?.transitions ?? [];
    const resolvedAt = transitions.find((entry) => entry.to === "resolved")?.minute;
    if (resolvedAt != null) {
      staleEscalations += transitions.filter((entry) => entry.minute > resolvedAt && ["critical", "failed"].includes(entry.to)).length;
    }
  }

  for (const rumor of state.rumors) {
    const status = rumorStatus(rumor);
    if (!status || !rumor.troubleId) continue;
    const related = model.npcs.filter((npc) => npc.relatedTroubleIds?.includes(rumor.troubleId) && !/死亡/u.test(String(npc.initialStatus ?? "")));
    const expected = reachableRelevantNpcs(state, model, rumor, related);
    const recipientIds = new Set(Object.keys(rumor.recipients ?? {}));
    const received = expected.filter((npc) => recipientIds.has(npc.id));
    expectedRelevant += expected.length;
    receivedRelevant += received.length;
    expectedReplans += received.length;

    if (status === "resolved") {
      resolvedExpected += expected.length;
      resolvedReceived += received.length;
    } else if (["critical", "failed"].includes(status)) {
      crisisExpected += expected.length;
      crisisReceived += received.length;
    }

    const record = perTrouble[rumor.troubleId] ??= {
      troubleId: rumor.troubleId,
      expectedResponses: 0,
      receivedResponses: 0,
      statuses: {},
      responseKinds: {},
    };
    record.expectedResponses += expected.length;
    record.receivedResponses += received.length;
    record.statuses[status] = (record.statuses[status] ?? 0) + 1;
    for (const npc of received) {
      const kind = responseKind(npc, status);
      responseKinds[kind] = (responseKinds[kind] ?? 0) + 1;
      record.responseKinds[kind] = (record.responseKinds[kind] ?? 0) + 1;
    }
  }

  const actualReplans = Number(state.progress.rumors.npcReplans ?? 0);
  const unrelatedReplans = Math.max(0, actualReplans - expectedReplans);
  const missingReplans = Math.max(0, expectedReplans - actualReplans);
  const upstreamSuppressed = ["T15", "T18", "T19"].filter((id) => state.troubles[id]?.status === "suppressed").length;
  const mitigatedThreats = model.troubles.filter((trouble) => {
    const runtime = state.troubles[trouble.id];
    return ["critical", "failed"].includes(runtime?.status) && Number(runtime.casualtyMitigation ?? 0) > 0;
  }).length;

  return {
    profileId: run.summary.profileId,
    seed: run.summary.seed,
    relevantResponseRate: ratio(receivedRelevant, expectedRelevant),
    resolvedRumorResponseRate: ratio(resolvedReceived, resolvedExpected),
    crisisRumorResponseRate: ratio(crisisReceived, crisisExpected),
    expectedRelevant,
    receivedRelevant,
    expectedReplans,
    actualReplans,
    unrelatedReplans,
    missingReplans,
    staleEscalations,
    resolutionAuthorityViolations,
    upstreamSuppressed,
    mitigatedThreats,
    responseKinds,
    perTrouble: Object.values(perTrouble),
  };
}

function mergeCounts(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) target[key] = Number(target[key] ?? 0) + Number(value ?? 0);
}

export function auditNpcInterventionRuns(runs, model) {
  const audited = runs.map((run) => auditRunNpcIntervention(run, model));
  const responseKinds = {};
  audited.forEach((entry) => mergeCounts(responseKinds, entry.responseKinds));
  return {
    runs: audited.length,
    relevantResponseRate: summarize(audited.map((entry) => entry.relevantResponseRate)),
    resolvedRumorResponseRate: summarize(audited.map((entry) => entry.resolvedRumorResponseRate)),
    crisisRumorResponseRate: summarize(audited.map((entry) => entry.crisisRumorResponseRate)),
    expectedRelevantResponses: audited.reduce((sum, entry) => sum + entry.expectedRelevant, 0),
    receivedRelevantResponses: audited.reduce((sum, entry) => sum + entry.receivedRelevant, 0),
    unrelatedNpcReplans: audited.reduce((sum, entry) => sum + entry.unrelatedReplans, 0),
    missingNpcReplans: audited.reduce((sum, entry) => sum + entry.missingReplans, 0),
    staleEscalationsAfterResolution: audited.reduce((sum, entry) => sum + entry.staleEscalations, 0),
    resolutionAuthorityViolations: audited.reduce((sum, entry) => sum + entry.resolutionAuthorityViolations, 0),
    upstreamSuppressed: summarize(audited.map((entry) => entry.upstreamSuppressed)),
    mitigatedThreats: summarize(audited.map((entry) => entry.mitigatedThreats)),
    responseKinds,
    samples: audited.slice(0, 14),
  };
}

function skillMilestoneDay(run, ordinal) {
  const learned = run.state.history.filter((entry) => ["SKILL_LEARNED", "SKILL_GRANTED"].includes(entry.type));
  const entry = learned[ordinal - 1];
  return entry ? clockFromMinute(entry.minute).day : 101;
}

function summarizeSkillAccess(runs) {
  return {
    level: summarize(runs.map((run) => run.summary.level)),
    learnedSkills: summarize(runs.map((run) => run.summary.learnedSkills)),
    flagLearnedSkills: summarize(runs.map((run) => run.summary.flagLearnedSkills)),
    eventGrantedSkills: summarize(runs.map((run) => run.summary.eventGrantedSkills)),
    visibleSkillCount: summarize(runs.map((run) => run.summary.visibleSkillCount)),
    missionExpShare: summarize(runs.map((run) => run.summary.missionExpShare)),
    firstSkillDay: summarize(runs.map((run) => skillMilestoneDay(run, 1))),
    fifthSkillDay: summarize(runs.map((run) => skillMilestoneDay(run, 5))),
    tenthSkillDay: summarize(runs.map((run) => skillMilestoneDay(run, 10))),
    fifteenthSkillDay: summarize(runs.map((run) => skillMilestoneDay(run, 15))),
    permanentMissionsCompleted: summarize(runs.map((run) => run.summary.permanentMissionsCompleted)),
    specialMissionsCompleted: summarize(runs.map((run) => run.summary.specialMissionsCompleted)),
    battleExp: summarize(runs.map((run) => run.summary.experienceBySource.battle)),
    permanentMissionExp: summarize(runs.map((run) => run.summary.experienceBySource.permanentMission)),
    specialMissionExp: summarize(runs.map((run) => run.summary.experienceBySource.specialMission)),
  };
}

function runTunedAuditSet({ model, battleData, skills, profiles, tuning, seedsPerProfile, rootSeed }) {
  const runs = [];
  for (const profile of profiles) {
    for (let index = 0; index < seedsPerProfile; index += 1) {
      runs.push(simulatePlayerJourney({
        model,
        battleData,
        skills,
        profile,
        tuning,
        seed: `${rootSeed}:v3-audit:${profile.id}:${index}`,
        maxActions: Number(tuning.maxActions ?? 5200),
      }));
    }
  }
  return runs;
}

function v3Findings(report, targets) {
  const findings = [];
  const push = (severity, code, detail) => findings.push({ severity, code, detail });
  const missionCount = report.missionAudit.counts.permanentDefinitions;
  const activeCount = report.missionAudit.counts.initialActivePermanent;
  const learned = report.skillAccess.learnedSkills.median;
  const npc = report.npcInterventionAudit;
  push(
    missionCount >= targets.permanentMissionDefinitionsMin && missionCount <= targets.permanentMissionDefinitionsMax ? "verified" : "blocker",
    "V3_MISSION_VOLUME",
    `常駐ミッション${missionCount}件（target ${targets.permanentMissionDefinitionsMin}-${targets.permanentMissionDefinitionsMax}）`,
  );
  push(
    activeCount <= targets.initialActivePermanentMax ? "verified" : "warning",
    "V3_INITIAL_MISSION_LOAD",
    `初期同時表示${activeCount}件（上限${targets.initialActivePermanentMax}）`,
  );
  push(
    learned >= targets.learnedSkillMedianMin && learned <= targets.learnedSkillMedianMax ? "verified" : "warning",
    "V3_SKILL_ACCESS",
    `最終取得スキル中央値${learned}（target ${targets.learnedSkillMedianMin}-${targets.learnedSkillMedianMax}）`,
  );
  push(
    npc.relevantResponseRate.median >= targets.relevantNpcResponseRateMin ? "verified" : "blocker",
    "V3_NPC_RELEVANT_RESPONSE",
    `関係NPC応答率中央値${(npc.relevantResponseRate.median * 100).toFixed(1)}%`,
  );
  push(
    npc.resolvedRumorResponseRate.median >= targets.resolvedRumorResponseRateMin ? "verified" : "blocker",
    "V3_NPC_PLAYER_RESOLUTION_RESPONSE",
    `プレイヤー解決後の関係NPC応答率中央値${(npc.resolvedRumorResponseRate.median * 100).toFixed(1)}%`,
  );
  push(
    npc.crisisRumorResponseRate.median >= targets.crisisRumorResponseRateMin ? "verified" : "warning",
    "V3_NPC_CRISIS_RESPONSE",
    `危機・失敗時の関係NPC応答率中央値${(npc.crisisRumorResponseRate.median * 100).toFixed(1)}%`,
  );
  push(
    npc.staleEscalationsAfterResolution <= targets.staleEscalationAfterResolutionMax ? "verified" : "blocker",
    "V3_NO_STALE_ESCALATION",
    `解決後にcritical/failedへ戻った件数${npc.staleEscalationsAfterResolution}`,
  );
  push(
    npc.unrelatedNpcReplans <= targets.unrelatedNpcReplanMax ? "verified" : "blocker",
    "V3_NO_UNRELATED_REPLAN",
    `関係外として計上されたNPC再計画${npc.unrelatedNpcReplans}件`,
  );
  push(
    npc.resolutionAuthorityViolations <= targets.npcResolutionAuthorityViolationMax ? "verified" : "blocker",
    "V3_PLAYER_RESOLUTION_AUTHORITY",
    `プレイヤー最終対応以外のresolved遷移${npc.resolutionAuthorityViolations}件`,
  );
  return findings;
}

export async function runIntegratedPlayerSimulationSuiteV3(options = {}) {
  const config = options.config ?? loadPlayerSimulationConfigV3();
  const profiles = options.profiles ?? PLAYER_PROFILES;
  const seedsPerProfile = Number(options.seedsPerProfile ?? process.env.TRPG_PLAYER_V3_SEEDS ?? config.seedsPerProfile ?? 6);
  const rootSeed = options.rootSeed ?? "trpg-player-v3-20260718";
  const model = options.model ?? loadWorldModel();
  const battleData = options.battleData ?? await loadBattleData();
  const skills = options.skills ?? loadSkills();
  const base = await runIntegratedPlayerSimulationSuite({
    config,
    profiles,
    seedsPerProfile,
    rootSeed,
    model,
    battleData,
    skills,
  });
  const auditRuns = runTunedAuditSet({ model, battleData, skills, profiles, tuning: config.tuned, seedsPerProfile, rootSeed });
  const skillAccess = summarizeSkillAccess(auditRuns);
  const npcInterventionAudit = auditNpcInterventionRuns(auditRuns, model);
  const report = {
    ...base,
    schemaVersion: "3.0.0",
    engineVersion: "integrated-player-journey-v3-audit",
    rootSeed,
    skillAccess,
    npcInterventionAudit,
  };
  const additions = v3Findings(report, config.qualityTargets);
  report.findings = [...base.findings, ...additions];
  report.quality = {
    passed: report.findings.every((finding) => finding.severity !== "blocker"),
    blockers: report.findings.filter((finding) => finding.severity === "blocker").length,
    warnings: report.findings.filter((finding) => finding.severity === "warning").length,
  };
  return report;
}

export function renderPlayerSimulationMarkdownV3(report) {
  const base = renderPlayerSimulationMarkdown(report)
    .replace("# TRPG（仮題）統合プレイヤーシミュレーション v2", "# TRPG（仮題）統合プレイヤーシミュレーション v3");
  const skill = report.skillAccess;
  const npc = report.npcInterventionAudit;
  const responseRows = Object.entries(npc.responseKinds)
    .sort((left, right) => right[1] - left[1])
    .map(([kind, count]) => `| ${kind} | ${count} |`)
    .join("\n");
  return `${base}

## v3 ミッション・成長拡張

- 常駐ミッション: ${report.missionAudit.counts.permanentDefinitions}件、${report.missionAudit.counts.permanentChains}系列、初期表示${report.missionAudit.counts.initialActivePermanent}件。
- 常駐EXP総量: ${report.missionAudit.rewardTotals.permanentExp} / 特別EXP総量: ${report.missionAudit.rewardTotals.specialExp}
- 最終Lv中央値: ${skill.level.median}
- 最終取得スキル中央値: ${skill.learnedSkills.median}
- 5個目取得中央値: Day${skill.fifthSkillDay.median} / 10個目: Day${skill.tenthSkillDay.median} / 15個目: Day${skill.fifteenthSkillDay.median}
- ミッションEXP比率中央値: ${(skill.missionExpShare.median * 100).toFixed(1)}%
- EXP中央値: 戦闘${skill.battleExp.median} / 常駐${skill.permanentMissionExp.median} / 特別${skill.specialMissionExp.median}

## NPC介入反応監査

- 関係NPC応答率中央値: ${(npc.relevantResponseRate.median * 100).toFixed(1)}%
- プレイヤー解決後応答率中央値: ${(npc.resolvedRumorResponseRate.median * 100).toFixed(1)}%
- 危機・失敗時応答率中央値: ${(npc.crisisRumorResponseRate.median * 100).toFixed(1)}%
- 期待応答/実応答: ${npc.expectedRelevantResponses}/${npc.receivedRelevantResponses}
- 関係外再計画: ${npc.unrelatedNpcReplans}
- 解決後の再悪化: ${npc.staleEscalationsAfterResolution}
- resolved権限違反: ${npc.resolutionAuthorityViolations}
- 上流解決による後続抑止中央値: ${npc.upstreamSuppressed.median}
- 危機時にNPC軽減が入ったトラブル中央値: ${npc.mitigatedThreats.median}

| NPC反応計画 | 件数 |
|---|---:|
${responseRows || "| なし | 0 |"}
`;
}
