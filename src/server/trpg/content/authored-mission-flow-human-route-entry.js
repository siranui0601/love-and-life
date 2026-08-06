import * as base from "./authored-mission-flow-human-companion-causality.js";
import {
  AUTHORED_DAY1_T01_SQUARE_AFTERCARE_INTERNALS as aftercare,
} from "./authored-mission-flow-day1-t01-square-aftercare.js";

export * from "./authored-mission-flow-human-companion-causality.js";

export const AUTHORED_HUMAN_ROUTE_ENTRY_VERSION = "authored-human-route-entry-v5";

const MISSION_ID = "MSN-T01";
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_SQUARE";
const EDGE_FACILITY_ID = "LOC_FARM_EDGE";
const ESCORT_ACTION_ID = "MISSION_FLOW:T01:HUMAN_ENTRY:RETURN_FINN_TO_SQUARE";

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

function t01ResolvedFlag(runtime) {
  return runtime?.playerState?.worldFlags?.t01Resolved === true
    || runtime?.worldFlags?.t01Resolved === true;
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
  return t01ResolvedFlag(runtime);
}

function canonicalFinnReturned(runtime) {
  return aftercare.hasFinnReturned(runtime)
    || t01ResolvedFlag(runtime);
}

function atVillageSquare(runtime) {
  const current = aftercare.player(runtime);
  return current.location === LOCATION && current.facilityId === FACILITY_ID;
}

function activeEscort(runtime) {
  const mission = findMission(runtime);
  const escort = runtime?.t01Escort;
  const current = aftercare.player(runtime);
  return mission?.status === "active"
    && mission?.stepId === "decide"
    && escort?.found === true
    && escort?.active === true
    && escort?.arrivedSquare !== true
    && current.location === LOCATION
    && current.facilityId === EDGE_FACILITY_ID;
}

function escortAction() {
  return {
    id: ESCORT_ACTION_ID,
    actionId: ESCORT_ACTION_ID,
    label: "フィンを広場へ送る",
    type: "plan",
    family: "rescue",
    missionId: MISSION_ID,
    troubleId: "T01",
    stepId: "decide",
    minutes: 20,
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    targetNpcId: "NPC001",
    authoredT01FinnReturnAction: true,
  };
}

function ownActions(runtime) {
  if (activeEscort(runtime)) return [escortAction()];
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
  if (activeEscort(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "負傷したフィンが、あなたの肩へ体重を預けている",
      title: "フィンを家族のもとへ連れ帰る",
      detail: "村外れから広場まで付き添い、ミラとガロへ無事を知らせる。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
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

function consumeEscortReturn(runtime, action, result) {
  if (result?.ok === false || action?.authoredT01FinnReturnAction !== true) return false;
  const escort = runtime.t01Escort;
  if (!escort?.active) return false;
  const current = aftercare.player(runtime);
  current.location = LOCATION;
  current.facilityId = FACILITY_ID;
  escort.active = false;
  escort.arrivedSquare = true;
  escort.reunited = true;
  escort.reunionBeatAtMinute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const companions = current.companionNpcIds;
  if (companions instanceof Set) companions.delete("NPC001");
  else if (Array.isArray(companions)) current.companionNpcIds = companions.filter((id) => id !== "NPC001");

  const finn = runtime?.livingWorld?.npcStates?.NPC001;
  if (finn) {
    finn.location = LOCATION;
    finn.position = { hubId: LOCATION, facilityId: FACILITY_ID };
    finn.presence = "present";
    finn.lifeStatus = finn.lifeStatus === "dead" ? "dead" : "injured";
    finn.status = "負傷・広場へ帰還";
    finn.currentGoal = "reunite-with-family";
    finn.travel = null;
    finn.localTravel = null;
  }

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags.t01FinnReturned = true;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "T01_FINN_ESCORTED_TO_SQUARE",
    minute: Number(runtime.playerState.absoluteMinute ?? 0),
    missionId: MISSION_ID,
    troubleId: "T01",
    npcId: "NPC001",
    actionId: ESCORT_ACTION_ID,
    location: LOCATION,
    facilityId: FACILITY_ID,
  });
  result.summary = "フィンの歩幅に合わせて村外れの道を戻った。広場でミラが駆け寄り、ガロは周囲を警戒しながら母子を家へ運ぶ手配を始めた。";
  return true;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  if (consumeEscortReturn(runtime, action, result)) return true;
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return aftercare.consume(runtime, action, result) || changed;
}

export const AUTHORED_HUMAN_ROUTE_ENTRY_INTERNALS = Object.freeze({
  ESCORT_ACTION_ID,
  values,
  findMission,
  t01ResolvedFlag,
  canonicalT01Completed,
  canonicalFinnReturned,
  atVillageSquare,
  activeEscort,
  escortAction,
  ownActions,
  consumeEscortReturn,
});
