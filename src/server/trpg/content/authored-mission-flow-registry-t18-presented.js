import * as core from "./authored-mission-flow-registry-t18-final.js";
import { T18_MACHINE_COLOSSUS_PACK as P } from "./authored/missions/t18-machine-colossus.js";

export * from "./authored-mission-flow-registry-t18-final.js";

const GENERIC_SUMMARY = /^行動の結果が世界へ反映された。?$/u;
const OPENING_PRIORITY = new Map([
  ["recover_elf_root_seal", 0],
  ["inspect_dwarf_machine_fragment", 1],
  ["read_temple_activation_damage", 2],
]);

function grantLeadRouteAccess(runtime, action) {
  if (action?.authoredMissionFlowId !== P.id || !action.authoredMissionFlowLeadId) return false;
  const lead = P.investigation.leads.find((entry) =>
    entry.id === action.authoredMissionFlowLeadId);
  if (lead?.targetLocation !== "エルフの隠れ里") return false;
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags.missionRouteAccess ??= {};
  const gates = runtime.playerState.worldFlags.missionRouteAccess[P.missionId] ??= [];
  if (gates.includes("elf-access")) return false;
  gates.push("elf-access");
  runtime.playerState.routeCache = {};
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = core.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions)
    || !actions.every((action) =>
      action.authoredMissionFlowId === P.id
        && action.authoredMissionFlowKind === "opening")) return actions;
  return [...actions].sort((left, right) =>
    Number(OPENING_PRIORITY.get(left.authoredMissionFlowChoiceId) ?? 99)
      - Number(OPENING_PRIORITY.get(right.authoredMissionFlowChoiceId) ?? 99));
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = core.applyAuthoredMissionFlowAction(runtime, action, result);
  const routeAccessChanged = grantLeadRouteAccess(runtime, action);
  if (action?.authoredMissionFlowId !== P.id || result?.ok === false) {
    return changed || routeAccessChanged;
  }
  if (result?.summary && !GENERIC_SUMMARY.test(result.summary)) {
    return changed || routeAccessChanged;
  }

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
  return changed || routeAccessChanged;
}
