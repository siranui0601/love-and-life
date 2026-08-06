import * as base from "./authored-mission-flow-ambient-forest-edge.js";
import { T13_FOREST_KING_SLIME_WORLD_TREE_PACK as T13 } from "./authored/missions/t13-forest-king-slime-world-tree-collapse.js";

export * from "./authored-mission-flow-ambient-forest-edge.js";

export const AUTHORED_MISSION_TERMINAL_CLOSURE_VERSION = "authored-mission-terminal-closure-v1";

const FLOW_ID = T13.id;
const MISSION_ID = T13.missionId;

function playerMission(runtime) {
  return runtime?.playerState?.missions?.[MISSION_ID] ?? null;
}

function terminalChoice(action) {
  return action?.authoredMissionFlowId === FLOW_ID
    && (action.authoredMissionRevisitTerminal === true
      || action.authoredMissionAmbientTerminal === true);
}

function playerMissionClosed(runtime) {
  const mission = playerMission(runtime);
  return mission?.closedByPlayerAt != null
    || runtime?.playerState?.worldFlags?.t13PlayerMissionClosed === true;
}

function closePlayerMission(runtime, action) {
  const mission = playerMission(runtime);
  if (!mission || mission.status === "completed") return false;

  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const kind = action.authoredMissionRevisitTerminalKind
    ?? action.authoredMissionAmbientEndingKind
    ?? "withdraw";
  const stage = action.authoredMissionRevisitStage
    ?? action.authoredMissionAmbientStageId
    ?? "investigation";
  const alreadyClosed = mission.closedByPlayerAt != null;

  mission.status = "failed";
  mission.failedAt ??= minute;
  mission.failureReason = `player_closed_t13_${kind}`;
  mission.closedByPlayerAt ??= minute;
  mission.closedByPlayerKind ??= kind;
  mission.closedByPlayerStage ??= stage;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags.t13PlayerMissionClosed = true;
  runtime.playerState.worldFlags[`t13PlayerMissionClosure:${kind}`] = true;

  if (!alreadyClosed) {
    runtime.playerState.history ??= [];
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_PLAYER_CLOSED",
      minute,
      flowId: FLOW_ID,
      missionId: MISSION_ID,
      actionId: action.id ?? null,
      endingKind: kind,
      endingStage: stage,
      missionStatus: mission.status,
    });
  }
  return !alreadyClosed;
}

export function authoredMissionFlowGuidance(runtime) {
  const guidance = base.authoredMissionFlowGuidance(runtime);
  if (playerMissionClosed(runtime) && guidance?.missionId === MISSION_ID) return null;
  return guidance;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok === false || !terminalChoice(action)) return changed;
  return closePlayerMission(runtime, action) || changed;
}

export const AUTHORED_MISSION_TERMINAL_CLOSURE_INTERNALS = Object.freeze({
  playerMission,
  terminalChoice,
  playerMissionClosed,
  closePlayerMission,
});
