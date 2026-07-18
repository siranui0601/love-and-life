import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBattleData } from "./battle-model.mjs";
import { loadSkills } from "./fixtures.mjs";
import {
  PLAYER_PROFILES,
  simulatePlayerJourney,
} from "./player-journey.mjs";
import {
  renderPlayerSimulationMarkdownV3Deep,
  runIntegratedPlayerSimulationSuiteV3Deep,
} from "./player-suite-v3-deep.mjs";
import { loadWorldModel } from "./world-model.mjs";
import {
  aggregateGoapExecutions,
  executeNpcGoapPlansForRun,
} from "./goap-execution-v4.mjs";
import {
  buildNarrativeScenarios,
  runGeminiNarrativeSimulationV4,
  runOptionalLiveGeminiSmokeV4,
} from "./gemini-simulation-v4.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = path.resolve(HERE, "..", "config", "player-simulation.v4.json");

export function loadPlayerSimulationConfigV4(configPath = DEFAULT_CONFIG_PATH) {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function runAuditJourneys({ model, battleData, skills, profiles, tuning, seedsPerProfile, rootSeed }) {
  const runs = [];
  for (const profile of profiles) {
    for (let index = 0; index < seedsPerProfile; index += 1) {
      runs.push(simulatePlayerJourney({
        model,
        battleData,
        skills,
        profile,
        tuning,
        seed: `${rootSeed}:v4:${profile.id}:${index}`,
        maxActions: Number(tuning.maxActions ?? 5200),
      }));
    }
  }
  return runs;
}

function v4Findings(report, targets) {
  const findings = [];
  const push = (severity, code, detail) => findings.push({ severity, code, detail });
  const goap = report.goapExecution;
  const gemini = report.geminiNarrative.protectedPipeline;
  const cacheHitRate = report.geminiNarrative.scenarios
    ? gemini.replayCacheHits / report.geminiNarrative.scenarios
    : 1;

  push(goap.completed >= targets.goapCompletedMin ? "verified" : "blocker", "V4_GOAP_EXECUTED", `施設行動完了${goap.completed}件`);
  push(goap.blocked <= targets.goapBlockedMax ? "verified" : "blocker", "V4_GOAP_REACHABILITY", `到達不能・経路なし${goap.blocked}件`);
  push(goap.overlapViolations <= targets.goapOverlapViolationMax ? "verified" : "blocker", "V4_GOAP_NO_OVERLAP", `NPC二重行動${goap.overlapViolations}件`);
  push(goap.actionAfterCancellation <= targets.goapActionAfterCancellationMax ? "verified" : "blocker", "V4_GOAP_CANCEL_AUTHORITY", `取消後に完了した行動${goap.actionAfterCancellation}件`);
  push(goap.staleCrisisCompletions <= targets.goapStaleCrisisCompletionMax ? "verified" : "blocker", "V4_GOAP_NO_STALE_CRISIS", `解決情報受信後も完了した旧危機行動${goap.staleCrisisCompletions}件`);
  push(goap.roleMismatch <= targets.goapRoleMismatchMax ? "verified" : "blocker", "V4_GOAP_ROLE_MATCH", `職種不一致計画${goap.roleMismatch}件`);
  push(goap.movementContinuityErrors <= targets.goapMovementContinuityErrorMax ? "verified" : "blocker", "V4_GOAP_MOVEMENT_CONTINUITY", `移動ログ不連続${goap.movementContinuityErrors}件`);

  push(gemini.finalInvalid <= targets.geminiFinalInvalidMax ? "verified" : "blocker", "V4_GEMINI_SCHEMA_SAFETY", `補正後の不正出力${gemini.finalInvalid}件`);
  push(gemini.replayMismatches <= targets.geminiReplayMismatchMax ? "verified" : "blocker", "V4_GEMINI_DETERMINISTIC_REPLAY", `同一入力の再生不一致${gemini.replayMismatches}件`);
  push(cacheHitRate >= targets.geminiCacheHitRateMin ? "verified" : "blocker", "V4_GEMINI_CACHE_BYPASS", `2回目AI非呼出率${(cacheHitRate * 100).toFixed(1)}%`);
  push((gemini.remoteNpcLeaks ?? 0) <= targets.geminiRemoteNpcLeakMax ? "verified" : "blocker", "V4_GEMINI_LOCAL_CONTEXT", `その場にいないNPCへの出力参照${gemini.remoteNpcLeaks ?? 0}件`);
  push(report.liveGeminiSmoke.attempted ? "verified" : "warning", "V4_GEMINI_LIVE_SMOKE", report.liveGeminiSmoke.attempted
    ? `実API ${report.liveGeminiSmoke.total}シナリオを試験`
    : "CIにGEMINI_API_KEYがないため実API試験は未実施。故障注入試験と本番接続コードは完了");
  return findings;
}

export async function runIntegratedPlayerSimulationSuiteV4(options = {}) {
  const config = options.config ?? loadPlayerSimulationConfigV4();
  const profiles = options.profiles ?? PLAYER_PROFILES;
  const rootSeed = options.rootSeed ?? "trpg-player-v4-20260718";
  const model = options.model ?? loadWorldModel();
  const battleData = options.battleData ?? await loadBattleData();
  const skills = options.skills ?? loadSkills();

  const base = await runIntegratedPlayerSimulationSuiteV3Deep({
    config,
    profiles,
    rootSeed,
    model,
    battleData,
    skills,
    seedsPerProfile: Number(options.seedsPerProfile ?? process.env.TRPG_PLAYER_V4_SEEDS ?? config.seedsPerProfile ?? 2),
    npcPlanSeedsPerProfile: 1,
  });

  const auditRuns = runAuditJourneys({
    model,
    battleData,
    skills,
    profiles,
    tuning: config.tuned,
    seedsPerProfile: Number(options.goapSeedsPerProfile ?? process.env.TRPG_GOAP_V4_SEEDS ?? config.goapSeedsPerProfile ?? 2),
    rootSeed,
  });
  const goapResults = auditRuns.map((run) => executeNpcGoapPlansForRun(run, model));
  const goapExecution = aggregateGoapExecutions(goapResults);
  const geminiNarrative = await runGeminiNarrativeSimulationV4(auditRuns, model, {
    perRun: Number(config.narrativeScenariosPerRun ?? 6),
    seed: rootSeed,
  });
  const liveScenarios = buildNarrativeScenarios(auditRuns, model, {
    perRun: Math.max(1, Math.ceil(Number(config.liveSmokeMaxScenarios ?? 8) / Math.max(1, auditRuns.length))),
  });
  const liveGeminiSmoke = await runOptionalLiveGeminiSmokeV4(liveScenarios, {
    maxScenarios: Number(config.liveSmokeMaxScenarios ?? 8),
  });

  const report = {
    ...base,
    schemaVersion: "4.0.0",
    engineVersion: "integrated-player-goap-gemini-v4",
    rootSeed,
    v4RunCounts: {
      baseBaseline: base.baseline.runs,
      baseTuned: base.tuned.runs,
      goapAndNarrativeJourneys: auditRuns.length,
      goapPlans: goapExecution.sourcePlanCount,
      narrativeScenarios: geminiNarrative.scenarios,
    },
    goapExecution,
    geminiNarrative,
    liveGeminiSmoke,
  };
  report.findings = [...base.findings, ...v4Findings(report, config.qualityTargets)];
  report.quality = {
    passed: report.findings.every((finding) => finding.severity !== "blocker"),
    blockers: report.findings.filter((finding) => finding.severity === "blocker").length,
    warnings: report.findings.filter((finding) => finding.severity === "warning").length,
  };
  return report;
}

export function renderPlayerSimulationMarkdownV4(report) {
  const base = renderPlayerSimulationMarkdownV3Deep(report)
    .replace("# TRPG（仮題）統合プレイヤーシミュレーション v3", "# TRPG（仮題）統合プレイヤーシミュレーション v4");
  const goap = report.goapExecution;
  const gemini = report.geminiNarrative;
  const protectedResult = gemini.protectedPipeline;
  const live = report.liveGeminiSmoke;
  return `${base}

## v4 GOAP実行ログ検証

v3の行動計画を、予定表だけで終わらせず、出発、街道区間、到着、施設入場、施設行動、GOAP状態更新まで実行した。

- 対象プレイヤー行程: ${report.v4RunCounts.goapAndNarrativeJourneys}
- 入力計画: ${goap.sourcePlanCount}件
- 行動開始: ${goap.started}件
- 目的地到着: ${goap.arrived}件
- 施設入場: ${goap.facilityEntries}件
- 施設行動完了: ${goap.completed}件
- 開始前取消: ${goap.cancelledBeforeStart}件
- 移動・行動中の計画変更: ${goap.cancelledInProgress}件
- 到達不能: ${goap.blocked}件
- 二重行動: ${goap.overlapViolations}件
- 取消後の行動完了: ${goap.actionAfterCancellation}件
- 解決情報受信後に残った危機行動: ${goap.staleCrisisCompletions}件
- 職種不一致: ${goap.roleMismatch}件
- 移動ログ不連続: ${goap.movementContinuityErrors}件
- 生成した実行ログ: ${goap.logEvents}件

## v4 Gemini接続・故障注入試験

使用契約モデルは \`gemini-2.5-flash-lite\`。AIは文章、3択文面、同席NPCの発言、候補提案だけを生成し、ゲーム状態を直接更新しない。

- 故障注入シナリオ: ${gemini.scenarios}件
- 旧式の緩い受入れで不正となる出力: ${gemini.rawLegacyPrompt.invalid}件
- 検証・再生成・フォールバック後の有効出力: ${protectedResult.finalValid}/${gemini.scenarios}
- 修正プロンプトで回復: ${protectedResult.repaired}件
- 決定論的フォールバック: ${protectedResult.fallbacks}件
- 却下した権限外提案: ${protectedResult.rejectedProposals}件
- 入力から除外した遠隔NPCレコード: ${protectedResult.remoteNpcRecordsRemoved}件
- 出力に残った遠隔NPC参照: ${protectedResult.remoteNpcLeaks ?? 0}件
- 2回目の同一入力でキャッシュ使用: ${protectedResult.replayCacheHits}/${gemini.scenarios}
- 同一入力の結果不一致: ${protectedResult.replayMismatches}件

同一のローカル状態、確定済み行動結果、プロンプト版、モデルが一致する場合はJSONL再生台帳から返し、Geminiを呼び出さない。戦闘・遭遇などの乱数結果は、先にサーバーresolverが確定した結果をキーへ含める。

## 実Gemini API試験

${live.attempted
    ? `- 実行済み: ${live.total}件 / モデル正常${live.valid}件 / フォールバック${live.fallback}件 / エラー${live.errors}件`
    : `- 未実施: ${live.reason}`}

CIにAPIキーがない場合も、実接続コード、JSON Schema、ローカル文脈制限、再試行、修正プロンプト、権限検証、再生キャッシュを自動試験する。本番環境では同じCLIをAPIキー付きで再実行できる。
`;
}
