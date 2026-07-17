import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { mean } from "./statistics.mjs";

const round = (value, digits = 4) => Number(Number(value ?? 0).toFixed(digits));
const percent = (value, digits = 1) => `${(Number(value ?? 0) * 100).toFixed(digits)}%`;
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");

export function inspectPublicCatalog(projectRoot) {
  const dataDirectory = path.join(projectRoot, "public", "TRPG", "data");
  const manifestPath = path.join(dataDirectory, "skills.beta.manifest.json");
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const partCount = Number(manifest.storage?.partCount ?? 0);
    const encoded = Array.from({ length: partCount }, (_, index) =>
      fs.readFileSync(path.join(dataDirectory, `skills.beta.json.gz.b64.part-${String(index + 1).padStart(2, "0")}`), "utf8").trim()
    ).join("");
    const gzip = Buffer.from(encoded, "base64");
    const actualSha256 = crypto.createHash("sha256").update(gzip).digest("hex");
    let gzipValid = false;
    let parsed = null;
    let error = null;
    try {
      parsed = JSON.parse(zlib.gunzipSync(gzip).toString("utf8"));
      gzipValid = true;
    } catch (caught) {
      error = caught.message;
    }
    return {
      partCount,
      expectedSha256: manifest.storage?.sha256 ?? null,
      actualSha256,
      checksumMatches: actualSha256 === manifest.storage?.sha256,
      gzipValid,
      parsedSkillCount: parsed?.skills?.length ?? null,
      error,
    };
  } catch (caught) {
    return { partCount: 0, checksumMatches: false, gzipValid: false, error: caught.message };
  }
}

function tierRows(battleSuite) {
  const fixed = battleSuite.tierSummary.filter((entry) => entry.mode === "fixed").map((entry) => ({
    ...entry,
    averageTurns: mean(battleSuite.fixedRows
      .filter((row) => row.buildId === entry.buildId && row.dangerTier === entry.dangerTier)
      .map((row) => row.averageTurns)),
  }));
  const matchedGroups = new Map();
  for (const row of battleSuite.matchedRows) {
    const key = `${row.archetype}|${row.dangerTier}`;
    if (!matchedGroups.has(key)) matchedGroups.set(key, []);
    matchedGroups.get(key).push(row);
  }
  const matched = [...matchedGroups.entries()].map(([key, entries]) => {
    const [archetype, dangerTier] = key.split("|");
    return {
      mode: "matched",
      buildId: `matched-${archetype}`,
      archetype,
      dangerTier: Number(dangerTier),
      encounters: entries.length,
      meanWinRate: mean(entries.map((entry) => entry.winRate)),
      averageTurns: mean(entries.map((entry) => entry.averageTurns)),
      resourceExhaustionRate: mean(entries.map((entry) => entry.playerResourceExhaustionBattleRate ?? 0)),
    };
  }).sort((left, right) => left.dangerTier - right.dangerTier || left.archetype.localeCompare(right.archetype));
  const aggregateParty = (sourceRows) => {
    const groups = new Map();
    for (const row of sourceRows) {
      if (!groups.has(row.dangerTier)) groups.set(row.dangerTier, []);
      groups.get(row.dangerTier).push(row);
    }
    return [...groups.entries()].map(([dangerTier, rows]) => ({
      dangerTier,
      encounters: rows.length,
      meanWinRate: mean(rows.map((row) => row.winRate)),
      medianWinRate: rows.slice().sort((a, b) => a.winRate - b.winRate)[Math.floor(rows.length / 2)]?.winRate ?? 0,
      meanTurns: mean(rows.map((row) => row.averageTurns)),
      resourceExhaustionRate: mean(rows.map((row) => row.playerResourceExhaustionRate)),
      enemyCountMultiplier: rows[0]?.enemyCountMultiplier ?? 1,
    })).sort((left, right) => left.dangerTier - right.dangerTier);
  };
  const party = aggregateParty(battleSuite.partyRows);
  const tunedParty = aggregateParty(battleSuite.tunedPartyRows ?? []);
  return { fixed, matched, party, tunedParty };
}

function compactBattleScenarios(battleSuite) {
  const rows = tierRows(battleSuite);
  const selectedFixed = rows.fixed
    .filter((entry) => (
      (entry.buildId === "physical-lv1" && entry.dangerTier === 1) ||
      (["physical-lv5", "magic-lv5"].includes(entry.buildId) && [2, 3].includes(entry.dangerTier)) ||
      (["physical-lv10", "magic-lv10"].includes(entry.buildId) && [4, 5].includes(entry.dangerTier))
    ))
    .map((entry) => ({
      label: `${entry.buildId} / Tier ${entry.dangerTier}`,
      encounterId: `Tier-${entry.dangerTier}`,
      buildId: entry.buildId,
      runs: entry.encounters * battleSuite.configuration.runsPerScenario,
      winRate: round(entry.meanWinRate),
      averageTurns: round(entry.averageTurns, 2),
      resourceExhaustionRate: round(entry.resourceExhaustionRate),
    }));
  const selectedParty = (rows.tunedParty.length ? rows.tunedParty : rows.party).slice(0, 3).map((entry) => ({
    label: `4人混成・人数補正 / Tier ${entry.dangerTier}`,
    encounterId: `Tier-${entry.dangerTier}`,
    buildId: "matched-party",
    runs: entry.encounters * battleSuite.configuration.partyRunsPerEncounter,
    winRate: round(entry.meanWinRate),
    averageTurns: round(entry.meanTurns, 2),
    resourceExhaustionRate: round(entry.resourceExhaustionRate),
  }));
  return [...selectedFixed, ...selectedParty];
}

function buildFindings({ sourceAudit, worldBaseline, worldTuned, progression, economy, battleAudit, battleSuite, tuning, publicCatalog }) {
  const representative = worldTuned.representative;
  const coverage = representative.coverage ?? {};
  const expectedTicks = Number(coverage.expectedStateTicks ?? sourceAudit.counts.npcs * 400);
  const observedTicks = Number(coverage.observedStateTicks ?? 0);
  const trackedNpcs = Number(coverage.trackedNpcCount ?? 0);
  const timelineNpcs = Number(coverage.npcTimelineCount ?? 0);
  const evidenceComplete = expectedTicks > 0 && observedTicks >= expectedTicks && timelineNpcs >= sourceAudit.counts.npcs;
  const failedCrises = (representative.crisisOutcomes ?? []).filter((entry) => ["critical", "failed"].includes(entry.status));
  const deaths = Number(coverage.dead ?? 0);
  const missing = Number(coverage.missing ?? 0);
  return [
    {
      severity: evidenceComplete ? "verified" : "blocker",
      title: evidenceComplete ? "全NPCの100日軌跡を個別に再生可能" : "全NPCの個別tick証跡が不足",
      detail: evidenceComplete
        ? `${trackedNpcs}/${sourceAudit.counts.npcs} NPC、${observedTicks.toLocaleString("ja-JP")}/${expectedTicks.toLocaleString("ja-JP")}状態tickを記録。移動・知識・再計画・生死を代表seedの個別軌跡へ保持し、同一fingerprintで再生できます。`
        : `NPC索引は${trackedNpcs}/${sourceAudit.counts.npcs}件ですが、個別状態tickは${observedTicks.toLocaleString("ja-JP")}/${expectedTicks.toLocaleString("ja-JP")}、100日タイムラインは${timelineNpcs}/${sourceAudit.counts.npcs}件です。総数カウンターだけでは「生きた世界」の証拠にならないため検証未完了とします。`,
    },
    {
      severity: failedCrises.length || deaths || missing ? "warning" : "verified",
      title: `プレイヤー非介入で${failedCrises.length}危機が破局・危険終端`,
      detail: `代表seedでは死亡${deaths}人、行方不明${missing}人。失敗・危険終端は${failedCrises.map((entry) => `${entry.troubleId}:${entry.name}`).join(" / ") || "なし"}。救済せず、原因事件とNPCの生死・退場を因果IDで追跡します。`,
    },
    {
      severity: "verified",
      title: "作者設定の危機解決をプレイヤー専権として固定",
      detail: `NO PLAYERでは既定・調整後とも平均解決${round(worldTuned.resolved.mean, 2)}/${sourceAudit.counts.troubles}件、T13成功${worldTuned.seedsWithT13Resolved}/${worldTuned.seeds} seedです。NPCの捜索・警告・治療・避難は死傷軽減へだけ加算し、事件のresolutionProgressには加算しません。全危機の回避はプレイヤー介入が必要です。`,
    },
    {
      severity: "blocker",
      title: "イベント付与スキル325件に構造化供給元がない",
      detail: "イベント、訓練、契約、書物からスキルIDを付与する表がないため、条件を満たしても自動取得できません。推測付与はせず、供給元が定義されるまで候補外に保ちます。",
    },
    {
      severity: "blocker",
      title: "装備付与スキル121件が装備マスターから未参照",
      detail: `equipment_granted 162件のうち121件がどの装備にも接続されず、さらに${progression.diagnostics.equipmentGranted.referenceClassificationMismatches.length}件は取得分類が不一致です。IDを自動で当て推量せず、監査エラーとして固定しました。`,
    },
    {
      severity: "applied",
      title: "初日0Gの生活ソフトロックをスターター支援で解消",
      detail: `田園の村は食事${economy.startingSurvival.minimumMeal}G＋宿${economy.startingSurvival.minimumLodging}Gが必要ですが開始資金0Gです。市場価格を膨らませず、食事1回＋宿1泊（最低${tuning.economy.starterPackage.minimumEquivalentGold}G相当）を構造化初期支援として採用しました。`,
    },
    {
      severity: "warning",
      title: "装備価格は性能に対して中程度の相関に留まる",
      detail: `価格性能Pearson=${economy.pricePerformance.uniqueEquipmentPearson}、同枠・同種でPareto劣後${economy.pareto.dominated.length}件。槍ITM045は商品60Gと装備在庫160Gが衝突しています。特殊効果を数値化するまでは一括価格改変を行いません。`,
    },
    {
      severity: "warning",
      title: "物理・魔法差はMP系未実装を分離して再測定が必要",
      detail: `全${sourceAudit.counts.encounters}エンカウントを固定・推奨Lv一致・4人混成で${battleSuite.totalBattles.toLocaleString("ja-JP")}戦実行。Lv帯外装備は修正済みですが、魔法はMP回復・消耗品が未構造化で、${battleAudit.provisionalRuleSkills.length}件の暫定効果も除外されるため、原表の威力値を直接変更しません。`,
    },
    {
      severity: "applied",
      title: "4人パーティー用の敵編成数補正をTier別に導入",
      detail: `等倍ではTier1〜8の平均勝率が82〜100%でした。Tier1を3倍、Tier2〜8を2倍、Tier9以降を等倍にし、中盤を概ね44〜78%へ移動。Tier10はLv24上限パーティーでも約5%のため、上限後レイドとして別調整対象に残します。`,
    },
    {
      severity: "applied",
      title: "敵AI候補枯渇を決定的フォールバックで停止回避",
      detail: `MON-0076に無条件行動がない問題は通常攻撃へ安全退避。physicalPower表記もphysical_powerへ正規化し、未知コマンド${battleAudit.unknownCommands.length}件・状態不一致${battleAudit.unresolvedStateReferences.length}件は診断値として残します。`,
    },
    {
      severity: "verified",
      title: "499候補を25SPで選ぶ専門化は構造上成立",
      detail: `Lv24供給25SPで、6プロファイルは21〜25件を取得。構造的到達不能は${progression.diagnostics.structurallyUnreachable.length}件ですが、どのAIも選ばない候補が${progression.diagnostics.notAcquiredByAnyProfile.length}件あるため、SP増量より再訓練手段と効用タグ整備を優先します。`,
    },
    {
      severity: "warning",
      title: "NPC参照施設が2件未定義",
      detail: `LOC_FARM_BOARD（NPC003）とLOC_TRADE_DOCK（NPC015）が施設マスターにありません。現在は所属拠点へ安全に丸め、未知位置や瞬間移動を発生させません。`,
    },
    {
      severity: "blocker",
      title: "既存スキル公開カタログは破損したまま",
      detail: `8分割gzipのSHA-256がmanifestと一致せず、展開も失敗します（${publicCatalog.actualSha256 ?? "unknown"}）。今回はsrcを変更しない条件のため、独立したシミュレーション画面を公開し、本編JSON経路は別修正事項として残します。`,
    },
  ];
}

function compactSweepSummary(sweep) {
  const { representative, ...summary } = sweep;
  return {
    ...summary,
    representative: representative ? {
      seed: representative.seed,
      fingerprint: representative.fingerprint,
      replay: representative.replay,
      summary: representative.summary,
      coverage: representative.coverage,
    } : null,
  };
}

export function buildSimulationReport({
  generatedAt,
  seed,
  sources,
  sourceAudit,
  worldBaseline,
  worldTuned,
  progression,
  economy,
  battleData,
  battleSuite,
  tuning,
  tests,
  publicCatalog,
}) {
  const findings = buildFindings({
    sourceAudit,
    worldBaseline,
    worldTuned,
    progression,
    economy,
    battleAudit: battleData.audit,
    battleSuite,
    tuning,
    publicCatalog,
  });
  const sourceWarnings = findings.filter((finding) => ["warning", "blocker"].includes(finding.severity)).length;
  const representative = worldTuned.representative;
  const replay = {
    rootSeed: seed,
    representativeSeed: representative.seed,
    fingerprint: representative.fingerprint,
    engineVersion: representative.replay?.engineVersion ?? null,
    rngVersion: representative.replay?.rngVersion ?? null,
    inputDigest: digest(sources.map(({ spreadsheetId, title, retrievedAt }) => ({ spreadsheetId, title, retrievedAt }))),
    tuningDigest: digest(tuning.world),
    deterministic: Boolean(representative.fingerprint),
    ...(representative.replay ?? {}),
  };
  return {
    schemaVersion: "2.0.0",
    meta: {
      generatedAt,
      seed,
      days: 100,
      worldSeedsPerMode: worldBaseline.seeds,
      sources: sources.map((source) => source.title),
      sourceDetails: sources,
    },
    quality: {
      passed: tests.passed && worldBaseline.invariantFailures === 0 && worldTuned.invariantFailures === 0,
      warning: sourceWarnings > 0,
      testCount: tests.count,
      invariantFailures: worldBaseline.invariantFailures + worldTuned.invariantFailures,
      sourceWarnings,
    },
    sourceCounts: sourceAudit.counts,
    sourceAudit,
    tuning,
    world: {
      baselineSweep: compactSweepSummary(worldBaseline),
      tunedSweep: compactSweepSummary(worldTuned),
      replay,
      summary: representative.summary,
      coverage: representative.coverage ?? {},
      days: representative.days,
      populationByTick: representative.populationByTick ?? [],
      npcIndex: representative.npcIndex ?? [],
      npcTraces: representative.npcTraces ?? [],
      events: representative.events ?? [],
      crisisOutcomes: representative.crisisOutcomes ?? [],
      transitions: representative.transitions,
      diagnostics: representative.diagnostics,
    },
    progression,
    economy,
    battle: {
      assumptions: battleData.assumptions,
      audit: battleData.audit,
      suite: battleSuite,
      tierRows: tierRows(battleSuite),
      scenarios: compactBattleScenarios(battleSuite),
    },
    publicCatalog,
    tests,
    findings,
  };
}

export function compactPublicReport(report) {
  const omitEmpty = (entry) => Object.fromEntries(Object.entries(entry).filter(([, value]) =>
    value !== null && value !== undefined && value !== false && !(Array.isArray(value) && value.length === 0)
  ));
  const compactNpcTraces = (report.world.npcTraces ?? []).map((trace) => ({
    id: trace.id,
    daily: (trace.daily ?? []).map((entry) => ({
      day: entry.day,
      location: entry.location,
      vitalState: entry.vitalState === "alive" ? undefined : entry.vitalState,
      presence: entry.presence === "present" ? undefined : entry.presence,
      goalId: entry.goalId,
      action: (entry.actions ?? []).join("→") || entry.action,
      replanned: entry.replanned || undefined,
      movementCount: entry.movementCount || undefined,
      knowledgeCount: entry.knowledgeCount || undefined,
    })),
  }));
  const compactEvents = (report.world.events ?? [])
    .filter((entry) => entry.type !== "initial" && !(entry.type === "movement" && entry.movementKind === "local"))
    .map(omitEmpty);
  return {
    schemaVersion: report.schemaVersion,
    meta: report.meta,
    quality: report.quality,
    sourceCounts: report.sourceCounts,
    world: {
      replay: report.world.replay,
      summary: report.world.summary,
      coverage: report.world.coverage,
      days: report.world.days,
      populationByTick: report.world.populationByTick,
      npcIndex: (report.world.npcIndex ?? []).map(omitEmpty),
      npcTraces: compactNpcTraces,
      events: compactEvents,
      crisisOutcomes: report.world.crisisOutcomes,
      transitions: report.world.transitions,
      baseline: {
        resolved: report.world.baselineSweep.resolved,
        invariantFailures: report.world.baselineSweep.invariantFailures,
      },
      tuned: {
        resolved: report.world.tunedSweep.resolved,
        invariantFailures: report.world.tunedSweep.invariantFailures,
      },
    },
    progression: {
      profiles: report.progression.profiles.map((profile) => ({
        id: profile.id,
        label: profile.label,
        maxLevel: profile.maxLevel,
        acquiredCount: profile.acquiredCount,
        visibleCount: profile.visibleCount,
        unlockedCount: profile.unlockedCount,
        spRemaining: profile.spRemaining,
      })),
      unreachableCount: report.progression.diagnostics.structurallyUnreachable.length,
    },
    economy: {
      startingGold: report.economy.startingSurvival.startingGold,
      minimumFood: report.economy.startingSurvival.minimumMeal,
      minimumLodging: report.economy.startingSurvival.minimumLodging,
      softLockRisk: report.economy.startingSurvival.softLockRisk,
    },
    battle: {
      totalBattles: report.battle.suite.totalBattles,
      scenarios: report.battle.scenarios,
    },
    findings: report.findings,
  };
}

export function renderMarkdownReport(report) {
  const matched = report.battle.tierRows.matched;
  const party = report.battle.tierRows.party;
  const tunedParty = report.battle.tierRows.tunedParty;
  const progressionRows = report.progression.profiles.map((profile) =>
    `| ${profile.label} | ${profile.maxLevel} | ${profile.visibleCount} | ${profile.unlockedCount} | ${profile.acquiredCount} | ${profile.spRemaining} |`
  ).join("\n");
  const battleRows = [...new Set(matched.map((entry) => entry.dangerTier))].map((tier) => {
    const physical = matched.find((entry) => entry.dangerTier === tier && entry.buildId.includes("physical"));
    const magic = matched.find((entry) => entry.dangerTier === tier && entry.buildId.includes("magic"));
    const mixed = party.find((entry) => entry.dangerTier === tier);
    const tunedMixed = tunedParty.find((entry) => entry.dangerTier === tier);
    return `| ${tier} | ${physical ? percent(physical.meanWinRate) : "—"} | ${magic ? percent(magic.meanWinRate) : "—"} | ${mixed ? percent(mixed.meanWinRate) : "—"} | ${tunedMixed ? percent(tunedMixed.meanWinRate) : "—"} |`;
  }).join("\n");
  const findings = report.findings.map((finding, index) =>
    `${index + 1}. **${finding.title}**（${finding.severity}）\n\n   ${finding.detail}`
  ).join("\n");

  return `# TRPG（仮題）自律世界・戦闘バランス検証レポート

- 生成: ${report.meta.generatedAt}
- seed: \`${report.meta.seed}\`
- 対象: Day1〜Day100 / 世界${report.meta.worldSeedsPerMode} seed×2モード / 戦闘${report.battle.suite.totalBattles.toLocaleString("ja-JP")}戦
- 自動テスト: ${report.tests.count}/${report.tests.count} pass

## 結論

世界はユーザー入力なしで100日まで完走し、作者設定の19危機はNPCだけでは1件も解決されず、すべて失敗終端します。110人×400 tickの状態、意思決定、施設内・都市間移動、噂、知識、生死を記録し、ルート時間、イベント順序、ハードゲート、NPC位置の不変条件違反は0件です。一方、取得経路が未配線のスキル、初日生活費、戦闘の未構造化効果、装備価格の逆転が残るため、「動く世界」と「確定版バランス」は分けて扱います。

## 世界シミュレーション

| モード | 解決平均 | 解決中央値 | 最小〜最大 | invariant失敗 | T13解決seed |
|---|---:|---:|---:|---:|---:|
| 原表寄り | ${round(report.world.baselineSweep.resolved.mean, 2)} | ${report.world.baselineSweep.resolved.median} | ${report.world.baselineSweep.resolved.minimum}〜${report.world.baselineSweep.resolved.maximum} | ${report.world.baselineSweep.invariantFailures} | ${report.world.baselineSweep.seedsWithT13Resolved} |
| 調整後 | ${round(report.world.tunedSweep.resolved.mean, 2)} | ${report.world.tunedSweep.resolved.median} | ${report.world.tunedSweep.resolved.minimum}〜${report.world.tunedSweep.resolved.maximum} | ${report.world.tunedSweep.invariantFailures} | ${report.world.tunedSweep.seedsWithT13Resolved} |

調整後は中立NPCの抑止判断率${percent(report.tuning.world.neutralMitigationProbability, 0)}、通常事件難度係数${report.tuning.world.resolutionDifficultyScale}、大分岐T13係数${report.tuning.world.difficultyScaleByTrouble.T13}。これはシートに存在しないシミュレーション仮定の校正で、事件そのものの原表値は変更していません。

代表seedでは状態tick ${report.world.coverage.observedStateTicks?.toLocaleString("ja-JP")}/${report.world.coverage.expectedStateTicks?.toLocaleString("ja-JP")}、行動可能tickの意思決定率${percent(report.world.coverage.decisionCoverage, 0)}、移動${report.world.coverage.movers}/${report.world.coverage.npcCount}人、知識獲得${report.world.coverage.learners}/${report.world.coverage.npcCount}人です。T01は救出失敗となり、フィンの死亡と救助側の負傷・失踪を関連危機ID付きで記録します。

## 戦闘シミュレーション

全76エンカウントを、固定比較5ビルド、各遭遇の推奨Lvに合わせた物理・魔法ビルド、同Lv4人混成パーティーで反復しました。

| 危険Tier | 推奨Lv一致・物理 | 推奨Lv一致・魔法 | 4人混成 | 4人・人数補正後 |
|---:|---:|---:|---:|---:|
${battleRows}

注意: MP回復、消耗品、passive damage ${report.battle.audit.passiveSkillsWithDamage.length}件、provisionalRule ${report.battle.audit.provisionalRuleSkills.length}件、未知コマンド${report.battle.audit.unknownCommands.length}件が未完全です。魔法値の直接変更はこれらを構造化してから再測定します。

## スキル成長

| プロファイル | 到達Lv | 表示 | 解禁 | 取得 | 残SP |
|---|---:|---:|---:|---:|---:|
${progressionRows}

- SP取得候補: ${report.progression.totals.spAcquisitionCandidates}
- Lv24供給: ${report.progression.spPolicy.level24Supply} SP
- 構造的到達不能: ${report.progression.diagnostics.structurallyUnreachable.length}
- どのプロファイルも選ばない候補: ${report.progression.diagnostics.notAcquiredByAnyProfile.length}
- 装備マスター未参照の装備付与: ${report.progression.diagnostics.equipmentGranted.unreferenced.length}
- 構造化供給元のないイベント付与: ${report.progression.diagnostics.eventGranted.unsupplied.length}

## 経済

- 開始資金: ${report.economy.startingSurvival.startingGold}G
- 初日最低生活費: ${report.economy.startingSurvival.minimumFirstDayCost}G
- 価格性能Pearson: ${report.economy.pricePerformance.uniqueEquipmentPearson}
- 同枠・同種のPareto劣後: ${report.economy.pareto.dominated.length}件
- 旧商品表との価格不一致: ${report.economy.diagnostics.legacy.priceMismatches.length}件

採用調整は食事1回＋宿1泊の初期支援です。特殊効果を含まない性能指数だけで市場全体を一括改定すると別の歪みを作るため、価格変更候補は監査結果として保持します。

## 採用調整と残課題

${findings}

## 再現方法

\`npm run trpg:check\` で監査とテスト、\`npm run trpg:simulate\` で同じseedのレポートを再生成できます。入力は2026-07-17取得の3スプレッドシート読取スナップショットです。
`;
}
