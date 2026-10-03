import * as base from "./authored-mission-flow-revisit-context.js";
import { T13_FOREST_KING_SLIME_WORLD_TREE_PACK as T13 } from "./authored/missions/t13-forest-king-slime-world-tree-collapse.js";

export * from "./authored-mission-flow-revisit-context.js";

export const AUTHORED_MISSION_REVISIT_CANONICAL_VERSION = "authored-mission-revisit-canonical-v1";

const FLOW_ID = T13.id;
const { shortHash } = base.AUTHORED_MISSION_REVISIT_INTERNALS;
const {
  revisitTargetKey,
  revisitStage,
  terminalActions,
} = base.AUTHORED_MISSION_REVISIT_CONTEXT_INTERNALS;

function array(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(array(values).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function flowFor(runtime) {
  return runtime?.authoredMissionFlows?.[FLOW_ID] ?? null;
}

function freshCanonicalState() {
  return {
    version: AUTHORED_MISSION_REVISIT_CANONICAL_VERSION,
    consumedSceneKeys: [],
  };
}

function ensureCanonicalState(flow) {
  if (!flow) return null;
  flow.revisitCanonicalState ??= freshCanonicalState();
  const state = flow.revisitCanonicalState;
  state.version = AUTHORED_MISSION_REVISIT_CANONICAL_VERSION;
  state.consumedSceneKeys = unique(state.consumedSceneKeys);
  return state;
}

function canonicalFingerprint(fingerprint) {
  const retained = new Map();
  for (const part of String(fingerprint ?? "").split("|")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator);
    const value = part.slice(separator + 1);
    if (["stage", "opening", "evidence", "progress", "trouble"].includes(key)) {
      retained.set(key, value);
    }
  }
  return ["stage", "opening", "evidence", "progress", "trouble"]
    .map((key) => `${key}=${retained.get(key) ?? ""}`)
    .join("|");
}

function canonicalSceneKey(action) {
  const targetKey = action?.authoredMissionRevisitTargetKey ?? revisitTargetKey(action);
  if (!targetKey) return null;
  const fingerprint = canonicalFingerprint(action.authoredMissionRevisitContextFingerprint);
  return `${fingerprint}|target=${targetKey}`;
}

function canonicalizeAction(action) {
  if (!action?.authoredMissionRevisit || action.authoredMissionRevisitTerminal) return action;
  const targetKey = action.authoredMissionRevisitTargetKey ?? revisitTargetKey(action);
  const sceneKey = canonicalSceneKey(action);
  if (!targetKey || !sceneKey) return action;
  const fingerprint = canonicalFingerprint(action.authoredMissionRevisitContextFingerprint);
  const variant = Math.max(1, Number(action.authoredMissionRevisitVariant ?? 1));
  return {
    ...action,
    id: `MISSION_FLOW:T13:RV_CAN:${shortHash(sceneKey)}:${shortHash(targetKey)}:${variant}`,
    authoredMissionRevisitSceneKey: sceneKey,
    authoredMissionRevisitTargetKey: targetKey,
    authoredMissionRevisitContextFingerprint: fingerprint,
  };
}

function canonicalTerminalActions(actions) {
  const stage = revisitStage(actions);
  const sourceFingerprint = actions.find((action) =>
    action?.authoredMissionRevisitContextFingerprint)?.authoredMissionRevisitContextFingerprint;
  const fingerprint = canonicalFingerprint(sourceFingerprint || `stage=${stage}`);
  return terminalActions(stage, fingerprint).map((action) => ({
    ...action,
    authoredMissionRevisitContextFingerprint: fingerprint,
  }));
}

function filterCanonicalActions(flow, actions) {
  const state = ensureCanonicalState(flow);
  const kept = [];
  const seenTargets = new Set();

  for (const source of actions) {
    if (!source?.authoredMissionRevisit || source.authoredMissionRevisitTerminal) continue;
    const action = canonicalizeAction(source);
    const targetKey = action.authoredMissionRevisitTargetKey ?? revisitTargetKey(action);
    const sceneKey = action.authoredMissionRevisitSceneKey;
    if (!targetKey || !sceneKey || seenTargets.has(targetKey)) continue;
    if (state.consumedSceneKeys.includes(sceneKey)) continue;
    seenTargets.add(targetKey);
    kept.push(action);
    if (kept.length >= 3) break;
  }

  for (const terminal of canonicalTerminalActions(actions)) {
    if (kept.length >= 3) break;
    kept.push(terminal);
  }
  // 全部が消費済みで一つも残らなかった時に空配列を返してはいけない。
  // 空配列は真値なので、この上に載る四十のモジュールも service.js も
  // 「排他的な選択肢はこれで確定」と受け取り、選択肢がゼロの画面になる。
  // ここで言うべきことが無いなら null を返し、通常の選択肢生成へ譲る。
  return kept.length > 0 ? kept.slice(0, 3) : null;
}

function consumeCanonicalScene(flow, action) {
  const sceneKey = action?.authoredMissionRevisitSceneKey;
  if (!flow || !sceneKey || action.authoredMissionRevisitTerminal) return false;
  const state = ensureCanonicalState(flow);
  if (state.consumedSceneKeys.includes(sceneKey)) return false;
  state.consumedSceneKeys.push(sceneKey);
  return true;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === FLOW_ID) ensureCanonicalState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === FLOW_ID) ensureCanonicalState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions) || !actions.length) return actions;
  if (!actions.some((action) => action?.authoredMissionFlowId === FLOW_ID
    && action?.authoredMissionRevisit)) return actions;
  return filterCanonicalActions(flowFor(runtime), actions);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok === false || action?.authoredMissionFlowId !== FLOW_ID) return changed;
  const consumed = consumeCanonicalScene(flowFor(runtime), action);
  if (consumed) {
    runtime.playerState.history ??= [];
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_REVISIT_CANONICAL_CONSUMED",
      minute: Number(runtime.playerState.absoluteMinute ?? 0),
      flowId: FLOW_ID,
      targetKey: action.authoredMissionRevisitTargetKey,
      sceneKey: action.authoredMissionRevisitSceneKey,
      actionId: action.id,
    });
  }
  return changed || consumed;
}

export const AUTHORED_MISSION_REVISIT_CANONICAL_INTERNALS = Object.freeze({
  freshCanonicalState,
  ensureCanonicalState,
  canonicalFingerprint,
  canonicalSceneKey,
  canonicalizeAction,
  canonicalTerminalActions,
  filterCanonicalActions,
  consumeCanonicalScene,
});
