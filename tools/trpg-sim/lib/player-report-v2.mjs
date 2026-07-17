export function renderPlayerSimulationMarkdownV2(report) {
  const rows = report.tuned.profiles.map((entry) =>
    `| ${entry.label} | ${entry.level.median} | ${entry.missionsCompleted.median} | ${entry.specialMissionsCompleted.median} | ${entry.resolvedTroubles.median} | ${entry.failedTroubles.median} | ${entry.localMovementActions.median} | ${entry.regionalMovementActions.median} | ${entry.battles.median} | ${(entry.winRate.median * 100).toFixed(1)}% | ${entry.learnedSkills.median} | ${entry.flagSkillsLearned.median} | ${entry.eventGrantedSkills.median} |`
  ).join("\n");
  const checks = report.findings.map((finding, index) => `${index + 1}. **${finding.code}**（${finding.severity}）— ${finding.detail}`).join("\n");
  const mission = report.tuned.representative.balanced.summary.missionCatalog;
  return `# TRPG（仮題）統合プレイヤーシミュレーション v2

- 生成: ${report.generatedAt}
- seed: \`${report.rootSeed}\`
- run: baseline ${report.baseline.runs} + tuned ${report.tuned.runs}
- 参照: ${report.sourceCounts.troubles}トラブル / ${report.sourceCounts.facilities}施設 / ${report.sourceCounts.encounters}エンカウント / ${report.sourceCounts.skills}スキル
- 品質判定: ${report.quality.passed ? "PASS" : "BLOCKED"}（blocker ${report.quality.blockers}, warning ${report.quality.warnings}）

## ミッション構成

- 総数 ${mission.total}（常駐 ${mission.permanent} / 特別 ${mission.special}）
- 常駐は系統別の連続段階制。前段階完了時点を次段階の起算点にし、過去実績による一括達成を防止する。
- 特別ミッションは噂または現地到達で発見し、会話・調査・支援・戦闘・最終対応を施設単位で進行する。
- 最終対応は3方式から選び、準備不足では再試行・部分対応・失敗が発生する。

## 調整後結果

| 方針 | Lv | 全任務 | 特別任務 | 解決T | 失敗T | 地域内移動 | 地域外移動 | 戦闘 | 勝率 | 習得技能 | 条件技能 | イベント技能 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows}

## 検証項目

${checks}

## スキル取得監査

- スキル総数: ${report.skillCatalogAudit.total}
- 取得方式別: \`${JSON.stringify(report.skillCatalogAudit.byCode)}\`
- 存在しない前提スキル参照: ${report.skillCatalogAudit.missingPrerequisites.length}
- 装備付与先が存在しない参照: ${report.skillCatalogAudit.equipmentGrantMissing.length}
- v2では条件解禁技能について、表示条件だけでなく eventUnlockConditions と learnConditions の双方を実行時に再検証する。
- イベント技能は grantConditions または構造化された解禁条件からのみ付与し、名称の文字列一致では付与しない。
- 装備付与技能は装備中だけ有効技能集合へ入る。
- 特別ミッション成功時は、技能名の文字列一致ではなく、grantConditions が要求する events / training / manuals / contracts / theme / world の構造化信号を発行する。
- 基礎技能を最低数取得した後は1SPを予約し、後から解禁された条件技能を取得できる余地を残す。

## 移動とトラブル

- 3択とは独立して、現在地域内の全施設と、現在状態で到達可能な全地域への移動を生成する。
- 地域内移動は分単位、地域外移動は経路時間と通行フラグを使用する。
- 現在は通行できない任務目的地は「移動不能」として連打せず、アクセス待ちとして記録し、到達可能な別任務や通常行動へ進む。
- 商人型の地域間巡回には再訪間隔を設け、店舗間を無限往復しない。
- トラブルの resolved 遷移は player-resolution:* の確定処理だけが実行できる。
- NPCの噂受信・再計画は被害軽減へ反映するが、NPCだけでは主要トラブルを解決しない。
`;
}
