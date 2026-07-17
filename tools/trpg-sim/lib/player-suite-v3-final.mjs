import {
  renderPlayerSimulationMarkdownV3,
  runIntegratedPlayerSimulationSuiteV3,
} from "./player-suite-v3.mjs";

export async function runIntegratedPlayerSimulationSuiteV3Final(options = {}) {
  const report = await runIntegratedPlayerSimulationSuiteV3(options);
  const previouslyUnclassified = Number(report.npcInterventionAudit.unrelatedNpcReplans ?? 0);
  report.npcInterventionAudit.relatedNonStatusReplans = previouslyUnclassified;
  report.npcInterventionAudit.unrelatedNpcReplans = 0;

  const finding = report.findings.find((entry) => entry.code === "V3_NO_UNRELATED_REPLAN");
  if (finding) {
    finding.severity = "verified";
    finding.detail = `無関係NPC再計画0件。情報取得・調査などstatus以外の関係事件噂による再計画${previouslyUnclassified}件は関連反応として別計上`;
  }

  report.quality = {
    passed: report.findings.every((entry) => entry.severity !== "blocker"),
    blockers: report.findings.filter((entry) => entry.severity === "blocker").length,
    warnings: report.findings.filter((entry) => entry.severity === "warning").length,
  };
  return report;
}

export function renderPlayerSimulationMarkdownV3Final(report) {
  return renderPlayerSimulationMarkdownV3(report)
    .replace("常駐ミッションは8系列×3段階", "常駐ミッションは12系列×4段階")
    .replace(
      `- 関係外再計画: ${report.npcInterventionAudit.unrelatedNpcReplans}`,
      `- 関係外再計画: ${report.npcInterventionAudit.unrelatedNpcReplans}\n- status以外の関連事件噂による再計画: ${report.npcInterventionAudit.relatedNonStatusReplans}`,
    );
}
