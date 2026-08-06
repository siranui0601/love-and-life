import * as base from "./authored-mission-flow-id-contract.js";
import { T13_FOREST_KING_SLIME_WORLD_TREE_PACK as T13 } from "./authored/missions/t13-forest-king-slime-world-tree-collapse.js";

export * from "./authored-mission-flow-id-contract.js";

export const AUTHORED_MISSION_REVISIT_RETIREMENT_VERSION = "authored-mission-revisit-retirement-v1";

const FLOW_ID = T13.id;
const MISSION_ID = T13.missionId;

const TERMINAL_COPY = Object.freeze({
  focus: Object.freeze([
    Object.freeze({
      kind: "salvage",
      minutes: 75,
      label: "復元できた断片をセリエへ渡し、原因究明より下流の給水と避難を優先する",
      summary: "失われた観測と広がった噂をこれ以上追い直さず、確実に残った断片だけをセリエへ渡した。完全な原因究明と三つの救済経路は閉じるが、下流の給水と避難へ人手を回す。",
    }),
    Object.freeze({
      kind: "delegate",
      minutes: 60,
      label: "調査図と未確認箇所を森評議会へ託し、自分は別の救援へ向かう",
      summary: "何度も組み直した調査図を森評議会へ託した。以後の証拠保全と判断はセリエたちが担い、プレイヤーはこの事件の決定権を手放す。",
    }),
    Object.freeze({
      kind: "withdraw",
      minutes: 45,
      label: "原因を確定できないまま森を離れ、黒嶺疑惑と世界樹被害の進行を受け入れる",
      summary: "同じ因果線へ戻る機会は尽きた。原因未確定のまま森を離れ、黒嶺への疑念と世界樹の損傷が人々の判断を変えていく結果を受け入れる。",
    }),
  ]),
  group: Object.freeze([
    Object.freeze({
      kind: "salvage",
      minutes: 70,
      label: "残った一分類だけを正式記録にし、他の証拠分類を未確認のまま救援計画へ移る",
      summary: "移動・押収・改竄を受けた証拠分類をこれ以上往復せず、確実に残った一分類だけを正式記録にした。他の分類から届くはずだった完全救済の条件は失われる。",
    }),
    Object.freeze({
      kind: "delegate",
      minutes: 55,
      label: "未確認分類を担当NPCへ割り振り、自分は現場介入の役割から外れる",
      summary: "未確認の証拠分類を担当NPCへ割り振った。現地は動き続けるが、以後の証言取得と物証判断は彼らの責任となり、プレイヤーは選び直せない。",
    }),
    Object.freeze({
      kind: "withdraw",
      minutes: 40,
      label: "分類間の矛盾を解けないまま調査を打ち切り、誤認を残した結末へ進む",
      summary: "証拠分類の矛盾を解けないまま調査を打ち切った。残った人々は不完全な記録で動き、誤認と被害はプレイヤーの管理を離れて進む。",
    }),
  ]),
  route: Object.freeze([
    Object.freeze({
      kind: "salvage",
      minutes: 65,
      label: "回収できた物証だけを封印し、この手掛かりから完全解決へ届く道を閉じる",
      summary: "移動・破損後に回収できた物証だけを封印した。この手掛かりを再び追うことはできず、完全解決ではなく被害抑制の材料として残される。",
    }),
    Object.freeze({
      kind: "delegate",
      minutes: 50,
      label: "物証の追跡を担当NPCへ委ね、結果を待たず別の事件へ向かう",
      summary: "物証の追跡を担当NPCへ委ねた。証拠が見つかるか、改竄されるか、間に合わないかは現地の時間で決まり、プレイヤーは同じ三択へ戻れない。",
    }),
    Object.freeze({
      kind: "withdraw",
      minutes: 35,
      label: "この手掛かりを断念し、失われた証拠が戻らない結果を受け入れる",
      summary: "この手掛かりを断念した。失われた証拠も、閉じた証言機会も戻らず、残る情報だけで世界が次の判断へ進む。",
    }),
  ]),
});

function array(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(array(values).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function flowFor(runtime) {
  return runtime?.authoredMissionFlows?.[FLOW_ID] ?? null;
}

function freshRetirementState() {
  return {
    version: AUTHORED_MISSION_REVISIT_RETIREMENT_VERSION,
    retiredTargetKeys: [],
    endedAtMinute: null,
    endingKind: null,
    endingStage: null,
  };
}

function ensureRetirementState(flow) {
  if (!flow) return null;
  flow.revisitRetirement ??= freshRetirementState();
  const state = flow.revisitRetirement;
  state.version = AUTHORED_MISSION_REVISIT_RETIREMENT_VERSION;
  state.retiredTargetKeys = unique(state.retiredTargetKeys);
  state.endedAtMinute ??= null;
  state.endingKind ??= null;
  state.endingStage ??= null;
  return state;
}

function revisitTargetKey(action) {
  if (!action?.authoredMissionRevisit) return null;
  if (action.authoredMissionFlowLeadId || action.authoredMissionRevisitEvidenceLeadId) {
    return `lead:${action.authoredMissionFlowLeadId ?? action.authoredMissionRevisitEvidenceLeadId}`;
  }
  if (action.authoredMissionFlowNavigatorGroupId) {
    return `group:${action.authoredMissionFlowNavigatorGroupId}`;
  }
  if (action.authoredMissionFlowNavigatorFocusId) {
    return `focus:${action.authoredMissionFlowNavigatorFocusId}`;
  }
  return null;
}

function revisitStage(actions) {
  if (actions.some((action) => action?.authoredMissionRevisitStage === "route"
    || action?.authoredMissionFlowLeadId)) return "route";
  if (actions.some((action) => action?.authoredMissionRevisitStage === "group"
    || action?.authoredMissionFlowNavigatorGroupId)) return "group";
  return "focus";
}

function terminalAction(stage, copy, slot) {
  return {
    id: `MISSION_FLOW:T13:RV_END:${stage}:${copy.kind}:${slot}`,
    family: copy.kind === "withdraw" ? "leave" : "prepare",
    type: "plan",
    effectKind: `authored_mission_revisit_terminal_${copy.kind}`,
    minutes: copy.minutes,
    label: copy.label,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: `revisit_terminal_${copy.kind}`,
    authoredMissionRevisit: true,
    authoredMissionRevisitTerminal: true,
    authoredMissionRevisitKind: "terminal",
    authoredMissionRevisitStage: stage,
    authoredMissionRevisitTerminalKind: copy.kind,
    authoredMissionRevisitConsequence: copy,
  };
}

function terminalActions(stage) {
  return TERMINAL_COPY[stage].map((copy, index) => terminalAction(stage, copy, index + 1));
}

function filterRetiredRevisitActions(flow, actions) {
  const state = ensureRetirementState(flow);
  const stage = revisitStage(actions);
  const kept = [];
  const seenTargets = new Set();

  for (const action of actions) {
    if (!action?.authoredMissionRevisit || action.authoredMissionRevisitTerminal) continue;
    const targetKey = revisitTargetKey(action);
    if (!targetKey || state.retiredTargetKeys.includes(targetKey) || seenTargets.has(targetKey)) continue;
    seenTargets.add(targetKey);
    kept.push(action);
    if (kept.length >= 3) break;
  }

  for (const terminal of terminalActions(stage)) {
    if (kept.length >= 3) break;
    kept.push(terminal);
  }
  return kept.slice(0, 3);
}

function retireTarget(flow, action) {
  const targetKey = revisitTargetKey(action);
  if (!flow || !targetKey) return false;
  const state = ensureRetirementState(flow);
  if (state.retiredTargetKeys.includes(targetKey)) return false;
  state.retiredTargetKeys.push(targetKey);
  return true;
}

function recordTerminalEnding(runtime, flow, action, result) {
  const state = ensureRetirementState(flow);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const kind = action.authoredMissionRevisitTerminalKind;
  const stage = action.authoredMissionRevisitStage ?? "focus";
  const copy = action.authoredMissionRevisitConsequence ?? {};
  state.endedAtMinute = minute;
  state.endingKind = kind;
  state.endingStage = stage;
  flow.navigatorFocusId = null;
  flow.navigatorGroupId = null;
  flow.selectedLeadId = null;
  flow.selectedLeadAtMinute = null;
  flow.deferredUntilMinute = null;

  runtime.playerState ??= {};
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags[`t13RevisitTerminal:${kind}`] = true;
  runtime.playerState.worldFlags.t13DirectInvestigationEnded = true;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "AUTHORED_MISSION_REVISIT_TERMINAL",
    minute,
    flowId: FLOW_ID,
    missionId: MISSION_ID,
    stage,
    endingKind: kind,
    actionId: action.id,
  });
  result.summary = copy.summary
    ?? "同じ選択階層へ戻る機会は尽き、直接調査を終える結果を選んだ。";
  return true;
}

function directInvestigationEnded(runtime) {
  const flow = flowFor(runtime);
  return ensureRetirementState(flow)?.endedAtMinute != null;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === FLOW_ID) ensureRetirementState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === FLOW_ID) ensureRetirementState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const flow = flowFor(runtime);
  if (ensureRetirementState(flow)?.endedAtMinute != null) return null;
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions) || !actions.length) return actions;
  if (!actions.some((action) => action?.authoredMissionFlowId === FLOW_ID
    && action?.authoredMissionRevisit)) return actions;
  return filterRetiredRevisitActions(flow, actions);
}

export function authoredMissionFlowEvidenceAction(runtime) {
  if (directInvestigationEnded(runtime)) return null;
  return base.authoredMissionFlowEvidenceAction(runtime);
}

export function suppressGenericAuthoredMissionAction(runtime, action) {
  if (directInvestigationEnded(runtime)
    && (action?.missionId === MISSION_ID || action?.authoredMissionFlowId === FLOW_ID)) {
    return true;
  }
  return base.suppressGenericAuthoredMissionAction(runtime, action);
}

export function authoredMissionFlowGuidance(runtime) {
  const flow = flowFor(runtime);
  const retirement = ensureRetirementState(flow);
  if (retirement?.endedAtMinute != null) {
    const ending = retirement.endingKind === "delegate"
      ? "現地へ調査を委ねた"
      : retirement.endingKind === "salvage"
        ? "完全解決を諦め、残った断片を被害抑制へ回した"
        : "直接調査から撤退した";
    return {
      missionId: MISSION_ID,
      kicker: "一期一会の機会は閉じた",
      title: ending,
      detail: "同じ人物、同じ証拠、同じ三択には戻れない。その後は噂、被害段階、現地NPCの行動として世界に現れる。",
      targetLocation: null,
      targetFacilityId: null,
      actionPanel: "movement",
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const flow = flowFor(runtime);
  if (action?.authoredMissionFlowId !== FLOW_ID || !flow) {
    return base.applyAuthoredMissionFlowAction(runtime, action, result);
  }
  if (action.authoredMissionRevisitTerminal) {
    return recordTerminalEnding(runtime, flow, action, result);
  }
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok !== false && action.authoredMissionRevisit) {
    const retired = retireTarget(flow, action);
    if (retired) {
      runtime.playerState.history ??= [];
      runtime.playerState.history.push({
        type: "AUTHORED_MISSION_REVISIT_TARGET_RETIRED",
        minute: Number(runtime.playerState.absoluteMinute ?? 0),
        flowId: FLOW_ID,
        targetKey: revisitTargetKey(action),
        actionId: action.id,
      });
    }
    return changed || retired;
  }
  return changed;
}

export const AUTHORED_MISSION_REVISIT_RETIREMENT_INTERNALS = Object.freeze({
  freshRetirementState,
  ensureRetirementState,
  revisitTargetKey,
  revisitStage,
  terminalAction,
  terminalActions,
  filterRetiredRevisitActions,
  retireTarget,
  recordTerminalEnding,
  directInvestigationEnded,
  TERMINAL_COPY,
});
