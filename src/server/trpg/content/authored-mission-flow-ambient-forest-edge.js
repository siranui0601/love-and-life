import * as base from "./authored-mission-flow-ambient-continuity.js";
import { T13_FOREST_KING_SLIME_WORLD_TREE_PACK as T13 } from "./authored/missions/t13-forest-king-slime-world-tree-collapse.js";

export * from "./authored-mission-flow-ambient-continuity.js";

export const AUTHORED_MISSION_AMBIENT_FOREST_EDGE_VERSION = "authored-mission-ambient-forest-edge-v1";

const FLOW_ID = T13.id;
const MISSION_ID = T13.missionId;
const FOREST_HUB = "森";
const FOREST_EDGE = "LOC_FOREST_EDGE";

const {
  ensureAmbientState,
  t13MissionActive,
  directInvestigationEnded,
  stageActions,
  terminalActions,
  AMBIENT_STAGES,
} = base.AUTHORED_MISSION_AMBIENT_CONTINUITY_INTERNALS;

function flowFor(runtime) {
  return runtime?.authoredMissionFlows?.[FLOW_ID] ?? null;
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function atCanonicalForestEdge(runtime) {
  return player(runtime).facilityId === FOREST_EDGE;
}

function forestAmbientEligible(runtime, flow) {
  if (!flow || !t13MissionActive(runtime) || !atCanonicalForestEdge(runtime)) return false;
  if (directInvestigationEnded(flow)) return false;
  return ensureAmbientState(flow)?.endedAtMinute == null;
}

function ambientGuidance(flow) {
  const state = ensureAmbientState(flow);
  const stage = AMBIENT_STAGES[state.nextStageIndex] ?? null;
  if (stage) {
    return {
      missionId: MISSION_ID,
      kicker: "再訪・世界は先へ進んでいる",
      title: stage.title,
      detail: "同じ痕跡や同じ質問には戻れない。変化した証拠、NPCの先行行動、閉じた経路を背負って三つから選ぶ。",
      targetLocation: FOREST_HUB,
      targetFacilityId: FOREST_EDGE,
      actionPanel: null,
    };
  }
  return {
    missionId: MISSION_ID,
    kicker: "森入口で得られる機会は尽きた",
    title: "完全解決を諦めるか、現地へ委ねるか、撤退するか決める",
    detail: "証拠と証言は既に移動・消失している。同じ調査を繰り返さず、不可逆な結果を選ぶ。",
    targetLocation: FOREST_HUB,
    targetFacilityId: FOREST_EDGE,
    actionPanel: null,
  };
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (authored) return authored;
  const flow = flowFor(runtime);
  if (!forestAmbientEligible(runtime, flow)) return null;
  if (base.authoredMissionFlowEvidenceAction(runtime)) return null;
  const state = ensureAmbientState(flow);
  const stage = AMBIENT_STAGES[state.nextStageIndex] ?? null;
  return stage ? stageActions(runtime, context, stage) : terminalActions();
}

export function authoredMissionFlowGuidance(runtime) {
  const flow = flowFor(runtime);
  if (forestAmbientEligible(runtime, flow)) return ambientGuidance(flow);
  return base.authoredMissionFlowGuidance(runtime);
}

export const AUTHORED_MISSION_AMBIENT_FOREST_EDGE_INTERNALS = Object.freeze({
  flowFor,
  player,
  atCanonicalForestEdge,
  forestAmbientEligible,
  ambientGuidance,
});
