import * as base from "./authored-mission-flow-registry-t19-presented.js";

export * from "./authored-mission-flow-registry-t19-presented.js";

export const AUTHORED_MISSION_CHOICE_ONCE_VERSION = "authored-mission-choice-once-v1";

const FORWARD_KINDS = new Set([
  "opening",
  "navigator_focus",
  "navigator_group",
  "navigator_route",
  "lead",
  "evidence",
  "resolution_preparation",
  "resolution_preparation_lead",
  "intervention",
  "resolution",
]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(array(values).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function flowFor(runtime, flowId) {
  return runtime?.authoredMissionFlows?.[flowId] ?? null;
}

function freshOnceState() {
  return {
    version: AUTHORED_MISSION_CHOICE_ONCE_VERSION,
    consumedChoiceSetIds: [],
    abandonedFocusIds: [],
    abandonedGroupIds: [],
    abandonedLeadIds: [],
    withdrawnAtMinute: null,
    delegatedAtMinute: null,
    partialReportAtMinute: null,
    repeatedSetFallbackCount: 0,
  };
}

function ensureOnceState(flow) {
  if (!flow) return null;
  flow.choiceOnce ??= freshOnceState();
  const once = flow.choiceOnce;
  once.version = AUTHORED_MISSION_CHOICE_ONCE_VERSION;
  once.consumedChoiceSetIds = unique(once.consumedChoiceSetIds);
  once.abandonedFocusIds = unique(once.abandonedFocusIds);
  once.abandonedGroupIds = unique(once.abandonedGroupIds);
  once.abandonedLeadIds = unique(once.abandonedLeadIds);
  once.withdrawnAtMinute ??= null;
  once.delegatedAtMinute ??= null;
  once.partialReportAtMinute ??= null;
  once.repeatedSetFallbackCount = Number(once.repeatedSetFallbackCount ?? 0);
  return once;
}

function actionSetId(actions, flow) {
  const flowId = actions.find((action) => action?.authoredMissionFlowId)?.authoredMissionFlowId
    ?? flow?.flowId
    ?? "unknown-flow";
  const state = [
    flow?.openingChoiceId ?? "none",
    flow?.navigatorFocusId ?? "none",
    flow?.navigatorGroupId ?? "none",
    flow?.selectedLeadId ?? "none",
    array(flow?.evidenceIds).join(",") || "none",
  ].join("|");
  const ids = actions.map((action) => String(action?.id ?? "")).join(">");
  return `${flowId}|${state}|${ids}`;
}

function isAbandoned(action, once) {
  const kind = action?.authoredMissionFlowKind;
  if (kind === "navigator_focus") {
    return once.abandonedFocusIds.includes(action.authoredMissionFlowNavigatorFocusId);
  }
  if (kind === "navigator_group") {
    return once.abandonedGroupIds.includes(action.authoredMissionFlowNavigatorGroupId);
  }
  if (["navigator_route", "lead", "resolution_preparation_lead"].includes(kind)) {
    return once.abandonedLeadIds.includes(action.authoredMissionFlowLeadId);
  }
  return false;
}

function consequenceAction(flowId, kind, label, minutes, extras = {}) {
  return {
    id: `MISSION_FLOW:${flowId}:ONE_SHOT:${kind}`,
    family: kind === "WITHDRAW" ? "leave" : "prepare",
    type: "plan",
    effectKind: `authored_mission_one_shot_${kind.toLowerCase()}`,
    minutes,
    label,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: flowId,
    authoredMissionFlowKind: `one_shot_${kind.toLowerCase()}`,
    ...extras,
  };
}

function transformedControl(action, flow) {
  const flowId = action.authoredMissionFlowId;
  const kind = action.authoredMissionFlowKind;
  if (kind === "navigator_back") {
    return consequenceAction(
      flowId,
      "ABANDON_FOCUS",
      "この調査方針を捨て、残る因果線だけで事件を追う",
      Math.max(4, Number(action.minutes ?? 0)),
      { authoredMissionFlowNavigatorFocusId: action.authoredMissionFlowNavigatorFocusId ?? flow?.navigatorFocusId ?? null },
    );
  }
  if (kind === "navigator_route_back") {
    return consequenceAction(
      flowId,
      "ABANDON_GROUP",
      "この証拠分類を捨て、残る分類だけで真相へ進む",
      Math.max(4, Number(action.minutes ?? 0)),
      { authoredMissionFlowNavigatorGroupId: action.authoredMissionFlowNavigatorGroupId ?? flow?.navigatorGroupId ?? null },
    );
  }
  if (kind === "reconsider_lead") {
    return consequenceAction(
      flowId,
      "ABANDON_LEAD",
      "この手掛かりを追う機会を手放し、別の経路へ賭ける",
      Math.max(6, Number(action.minutes ?? 0)),
      { authoredMissionFlowLeadId: action.authoredMissionFlowLeadId ?? flow?.selectedLeadId ?? null },
    );
  }
  if (kind === "defer") {
    return consequenceAction(
      flowId,
      "WITHDRAW",
      "この事件から手を引き、介入しないまま世界が進む結果を受け入れる",
      Math.max(12, Number(action.minutes ?? 0)),
    );
  }
  return action;
}

function delegatedAction(flowId) {
  return consequenceAction(
    flowId,
    "DELEGATE",
    "集めた情報を現地の当事者へ託し、自分はこの事件の決定権を手放す",
    30,
  );
}

function partialReportAction(flowId) {
  return consequenceAction(
    flowId,
    "PUBLISH_PARTIAL",
    "不完全な証拠を公表し、誤認や反発も含めた結果を引き受ける",
    45,
  );
}

function withdrawAction(flowId) {
  return consequenceAction(
    flowId,
    "WITHDRAW",
    "これ以上は関与せず、残された人々と時間に結末を委ねる",
    15,
  );
}

function completeToThree(actions, flowId) {
  const result = [...actions];
  const fillers = [partialReportAction(flowId), delegatedAction(flowId), withdrawAction(flowId)];
  for (const filler of fillers) {
    if (result.length >= 3) break;
    if (!result.some((entry) => entry.id === filler.id)) result.push(filler);
  }
  return result.slice(0, 3);
}

function repeatedSetConsequences(flowId, setId) {
  return [
    partialReportAction(flowId),
    delegatedAction(flowId),
    withdrawAction(flowId),
  ].map((action) => ({
    ...action,
    authoredMissionFlowChoiceSetId: `${setId}|REPEAT`,
    authoredMissionFlowRepeatedChoiceSetId: setId,
  }));
}

function guardExclusiveActions(runtime, actions) {
  if (!Array.isArray(actions) || !actions.length) return actions;
  const flowId = actions.find((action) => action?.authoredMissionFlowId)?.authoredMissionFlowId;
  if (!flowId) return actions;
  const flow = flowFor(runtime, flowId);
  const once = ensureOnceState(flow);
  if (!flow || !once || once.withdrawnAtMinute != null || once.delegatedAtMinute != null) return null;

  const available = actions
    .filter((action) => !isAbandoned(action, once))
    .map((action) => transformedControl(action, flow));
  const completed = completeToThree(available, flowId);
  const setId = actionSetId(completed, flow);
  if (once.consumedChoiceSetIds.includes(setId)) {
    return repeatedSetConsequences(flowId, setId);
  }
  return completed.map((action) => ({
    ...action,
    authoredMissionFlowChoiceSetId: setId,
  }));
}

function recordConsumedSet(flow, action) {
  const setId = String(action?.authoredMissionFlowChoiceSetId ?? "").trim();
  if (!flow || !setId) return false;
  const once = ensureOnceState(flow);
  if (once.consumedChoiceSetIds.includes(setId)) return false;
  once.consumedChoiceSetIds.push(setId);
  return true;
}

function addHistory(runtime, action, type, details = {}) {
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type,
    minute: Number(runtime.playerState.absoluteMinute ?? 0),
    flowId: action.authoredMissionFlowId,
    choiceSetId: action.authoredMissionFlowChoiceSetId ?? null,
    actionId: action.id ?? null,
    ...details,
  });
}

function applyOneShotConsequence(runtime, action, result) {
  const flow = flowFor(runtime, action?.authoredMissionFlowId);
  if (!flow) return false;
  const once = ensureOnceState(flow);
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  const kind = action.authoredMissionFlowKind;
  if (action.authoredMissionFlowRepeatedChoiceSetId) {
    once.repeatedSetFallbackCount += 1;
    addHistory(runtime, action, "AUTHORED_MISSION_CHOICE_SET_REPEAT_BLOCKED", {
      repeatedChoiceSetId: action.authoredMissionFlowRepeatedChoiceSetId,
    });
  }
  if (kind === "one_shot_abandon_focus") {
    const id = action.authoredMissionFlowNavigatorFocusId ?? flow.navigatorFocusId;
    if (id) once.abandonedFocusIds = unique([...once.abandonedFocusIds, id]);
    flow.navigatorFocusId = null;
    flow.navigatorGroupId = null;
    flow.selectedLeadId = null;
    result.summary = "一つの調査方針を捨てた。そこから得られたはずの証拠と救済経路は、もう選び直せない。";
    addHistory(runtime, action, "AUTHORED_MISSION_FOCUS_ABANDONED", { focusId: id ?? null });
    return true;
  }
  if (kind === "one_shot_abandon_group") {
    const id = action.authoredMissionFlowNavigatorGroupId ?? flow.navigatorGroupId;
    if (id) once.abandonedGroupIds = unique([...once.abandonedGroupIds, id]);
    flow.navigatorGroupId = null;
    flow.selectedLeadId = null;
    result.summary = "一つの証拠分類を捨てた。残る証拠だけで結論へ届く道を探さなければならない。";
    addHistory(runtime, action, "AUTHORED_MISSION_GROUP_ABANDONED", { groupId: id ?? null });
    return true;
  }
  if (kind === "one_shot_abandon_lead") {
    const id = action.authoredMissionFlowLeadId ?? flow.selectedLeadId;
    if (id) once.abandonedLeadIds = unique([...once.abandonedLeadIds, id]);
    flow.selectedLeadId = null;
    flow.navigatorGroupId = null;
    result.summary = "選んだ手掛かりを追う機会を失った。同じ人物、同じ現場、同じ三択はもう戻らない。";
    addHistory(runtime, action, "AUTHORED_MISSION_LEAD_ABANDONED", { leadId: id ?? null });
    return true;
  }
  if (kind === "one_shot_publish_partial") {
    once.partialReportAtMinute = minute;
    once.withdrawnAtMinute = minute;
    runtime.playerState.worldFlags ??= {};
    runtime.playerState.worldFlags[`authoredMissionPartialReport:${flow.flowId}`] = true;
    result.summary = "不完全な証拠を公表した。正しい部分も誤った部分も社会へ広がり、事件はプレイヤーの管理を離れた。";
    addHistory(runtime, action, "AUTHORED_MISSION_PARTIAL_REPORT_PUBLISHED");
    return true;
  }
  if (kind === "one_shot_delegate") {
    once.delegatedAtMinute = minute;
    runtime.playerState.worldFlags ??= {};
    runtime.playerState.worldFlags[`authoredMissionDelegated:${flow.flowId}`] = true;
    result.summary = "事件を現地の当事者へ託した。以後の判断と結果は彼らの行動、噂、残された時間によって決まる。";
    addHistory(runtime, action, "AUTHORED_MISSION_DELEGATED");
    return true;
  }
  if (kind === "one_shot_withdraw") {
    once.withdrawnAtMinute = minute;
    runtime.playerState.worldFlags ??= {};
    runtime.playerState.worldFlags[`authoredMissionWithdrawn:${flow.flowId}`] = true;
    result.summary = "事件から手を引いた。世界は止まらず、選ばなかった救済経路も時間とともに閉じていく。";
    addHistory(runtime, action, "AUTHORED_MISSION_WITHDRAWN");
    return true;
  }
  return false;
}

function withdrawnFlowForMission(runtime, missionId) {
  const pack = base.AUTHORED_MISSION_FLOW_PACKS.find((entry) => entry.missionId === missionId);
  const flow = pack ? flowFor(runtime, pack.id) : null;
  const once = flow ? ensureOnceState(flow) : null;
  return once && (once.withdrawnAtMinute != null || once.delegatedAtMinute != null) ? flow : null;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  ensureOnceState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  ensureOnceState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return guardExclusiveActions(runtime, base.authoredMissionFlowExclusiveActions(runtime, context));
}

export function authoredMissionFlowEvidenceAction(runtime) {
  const action = base.authoredMissionFlowEvidenceAction(runtime);
  if (!action) return null;
  const flow = flowFor(runtime, action.authoredMissionFlowId);
  const once = flow ? ensureOnceState(flow) : null;
  if (once && (once.withdrawnAtMinute != null || once.delegatedAtMinute != null)) return null;
  if (once?.abandonedLeadIds.includes(action.authoredMissionFlowLeadId)) return null;
  return action;
}

export function suppressGenericAuthoredMissionAction(runtime, action) {
  if (withdrawnFlowForMission(runtime, action?.missionId)) return true;
  return base.suppressGenericAuthoredMissionAction(runtime, action);
}

export function authoredMissionFlowGuidance(runtime) {
  const guidance = base.authoredMissionFlowGuidance(runtime);
  const withdrawn = withdrawnFlowForMission(runtime, guidance?.missionId);
  if (!withdrawn) return guidance;
  const once = ensureOnceState(withdrawn);
  return {
    missionId: guidance.missionId,
    kicker: "選択済みの結果",
    title: once.delegatedAtMinute != null
      ? "この事件の判断を現地へ託した"
      : "この事件への直接介入を終えた",
    detail: "同じ三択へは戻れない。世界の噂と被害、現地の人々の行動から、その後の結果を知ることになる。",
    targetLocation: null,
    targetFacilityId: null,
    actionPanel: "movement",
  };
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const flow = flowFor(runtime, action?.authoredMissionFlowId);
  const oneShot = String(action?.authoredMissionFlowKind ?? "").startsWith("one_shot_");
  const changedByBase = oneShot ? false : base.applyAuthoredMissionFlowAction(runtime, action, result);
  const changedByOnce = applyOneShotConsequence(runtime, action, result);
  const activeFlow = flowFor(runtime, action?.authoredMissionFlowId) ?? flow;
  const consumed = recordConsumedSet(activeFlow, action);
  if (consumed) {
    addHistory(runtime, action, "AUTHORED_MISSION_CHOICE_SET_CONSUMED", {
      selectedActionId: action.id ?? null,
      forward: FORWARD_KINDS.has(action.authoredMissionFlowKind),
    });
  }
  return changedByBase || changedByOnce || consumed;
}

export const AUTHORED_MISSION_CHOICE_ONCE_INTERNALS = Object.freeze({
  freshOnceState,
  ensureOnceState,
  actionSetId,
  isAbandoned,
  transformedControl,
  completeToThree,
  repeatedSetConsequences,
  guardExclusiveActions,
  recordConsumedSet,
  applyOneShotConsequence,
});
