import * as base from "./authored-mission-flow-human-companion-causality.js";
import {
  AUTHORED_DAY1_T01_SQUARE_AFTERCARE_INTERNALS as aftercare,
} from "./authored-mission-flow-day1-t01-square-aftercare.js";

export * from "./authored-mission-flow-human-companion-causality.js";

export const AUTHORED_HUMAN_ROUTE_ENTRY_VERSION = "authored-human-route-entry-v2";

const MISSION_ID = "MSN-T01";
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_SQUARE";

function values(value) {
  if (Array.isArray(value)) return value;
  if (value instanceof Map) return [...value.values()];
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function findMission(runtime, missionId = MISSION_ID) {
  const collections = [
    runtime?.playerState?.missions,
    runtime?.missions,
    runtime?.playerState?.missionById,
    runtime?.missionById,
  ];
  for (const collection of collections) {
    if (collection instanceof Map && collection.has(missionId)) return collection.get(missionId);
    const direct = collection?.[missionId];
    if (direct) return direct;
    const found = values(collection).find((entry) => entry?.id === missionId);
    if (found) return found;
  }
  return null;
}

function canonicalT01Completed(runtime) {
  const mission = findMission(runtime);
  if (["completed", "resolved"].includes(String(mission?.status ?? ""))) return true;
  const troubleStatus = runtime?.playerState?.troubleStates?.T01?.status
    ?? runtime?.troubleStates?.T01?.status
    ?? runtime?.playerState?.troubles?.T01?.status
    ?? runtime?.troubles?.T01?.status;
  if (["completed", "resolved", "suppressed", "prevented"].includes(String(troubleStatus ?? ""))) {
    return true;
  }
  return runtime?.playerState?.worldFlags?.t01Resolved === true;
}

function canonicalFinnReturned(runtime) {
  return aftercare.hasFinnReturned(runtime);
}

function atVillageSquare(runtime) {
  const current = aftercare.player(runtime);
  return current.location === LOCATION && current.facilityId === FACILITY_ID;
}

function ownActions(runtime) {
  if (!canonicalT01Completed(runtime)
    || !canonicalFinnReturned(runtime)
    || !atVillageSquare(runtime)) return null;
  const state = aftercare.ensureState(runtime);
  if (state.aftercareSelectedActionId === aftercare.HELP_ACTION_ID
    && state.supperCompletedAtMinute == null) {
    return aftercare.SUPPER_CHOICES.map((choice) => aftercare.actionFor(
      aftercare.SUPPER_SCENE_ID,
      choice,
    ));
  }
  if (state.aftercareCompletedAtMinute == null) {
    return aftercare.AFTERCARE_CHOICES.map((choice) => aftercare.actionFor(
      aftercare.AFTERCARE_SCENE_ID,
      choice,
    ));
  }
  return null;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = ownActions(runtime);
  return own ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  const own = ownActions(runtime);
  if (own?.[0]?.authoredDay1T01AftercareSceneId === aftercare.SUPPER_SCENE_ID) {
    return {
      missionId: MISSION_ID,
      kicker: "水桶を置く頃、ミラが小さな食卓へパンを並べた",
      title: "救出後の夕食",
      detail: "食べる、フィンの話を聞く、先に休む。救助後の時間も村の次の動きを変える。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  if (own?.[0]?.authoredDay1T01AftercareSceneId === aftercare.AFTERCARE_SCENE_ID) {
    return {
      missionId: MISSION_ID,
      kicker: "フィンが家へ運ばれた後も、広場には泥と疲れが残っていた",
      title: "救出の後に何をするか",
      detail: "母子を手伝う、経路を記録する、子どもたちと過ごす。事件後の村へ関わる。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return aftercare.consume(runtime, action, result) || changed;
}

export const AUTHORED_HUMAN_ROUTE_ENTRY_INTERNALS = Object.freeze({
  values,
  findMission,
  canonicalT01Completed,
  canonicalFinnReturned,
  atVillageSquare,
  ownActions,
});
