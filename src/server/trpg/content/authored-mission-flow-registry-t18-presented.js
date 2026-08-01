import * as core from "./authored-mission-flow-registry-t18-final.js";
import { T18_MACHINE_COLOSSUS_PACK as P } from "./authored/missions/t18-machine-colossus.js";

export * from "./authored-mission-flow-registry-t18-final.js";

const GENERIC_SUMMARY = /^行動の結果が世界へ反映された。?$/u;

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = core.applyAuthoredMissionFlowAction(runtime, action, result);
  if (action?.authoredMissionFlowId !== P.id || result?.ok === false) return changed;
  if (result?.summary && !GENERIC_SUMMARY.test(result.summary)) return changed;

  const kind = action.authoredMissionFlowKind;
  if (kind === "navigator_focus") {
    const focus = P.investigation.focuses.find((entry) =>
      entry.id === action.authoredMissionFlowNavigatorFocusId);
    if (focus) {
      result.summary = focus.narrative;
      result.sceneTransition ??= focus.sceneTransition;
    }
  } else if (kind === "navigator_group") {
    const group = P.investigation.focuses
      .flatMap((focus) => focus.groups)
      .find((entry) => entry.id === action.authoredMissionFlowNavigatorGroupId);
    if (group) {
      result.summary = `${group.label}ため、人物・公文書・現場記録の三経路を比較する。`;
    }
  } else if (kind === "navigator_route") {
    const lead = P.investigation.leads.find((entry) =>
      entry.id === action.authoredMissionFlowLeadId);
    if (lead) {
      result.summary = `場面は${lead.destinationName}へ移る。${lead.leadNarrative} 証拠を得るには現地で記録・人物・現物を照合する必要がある。`;
      result.sceneTransition ??= action.authoredMissionFlowSceneTransition
        ?? `調査の視点が${lead.destinationName}へ移る`;
    }
  } else if (kind === "navigator_back") {
    result.summary = "三つの調査方針を見直し、別の因果線から機械巨神兵を追うことにした。";
  } else if (kind === "navigator_route_back") {
    result.summary = "同じ調査方針の中で、別の事実分類へ戻って経路を選び直す。";
  } else if (kind === "reconsider_lead") {
    result.summary = "選んだ経路を保留し、未確認の証拠分類から別の手掛かりを選び直す。";
  }
  return changed;
}
