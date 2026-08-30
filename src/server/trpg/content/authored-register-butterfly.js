import * as base from "./canonical-job-time-policy.js";

export * from "./canonical-job-time-policy.js";

export const AUTHORED_REGISTER_BUTTERFLY_VERSION = "authored-register-butterfly-v1";

const LOCATION = "田園の村";
const INN_FACILITY_ID = "LOC_FARM_INN";
const SQUARE_FACILITY_ID = "LOC_FARM_SQUARE";
const RIONA_ID = "NPC008";
const T01_MISSION_ID = "MSN-T01";
const T01_TROUBLE_ID = "T01";
const REGISTER_SOURCE_ACTION_ID = "E:LODGE:REGISTER";
const REGISTER_HISTORY = "F_INN_REGISTER_RECORD_CREATED";
const LINK_HISTORY = "F_T01_REGISTERED_RESCUER_IDENTIFIED";
const CALLBACK_HISTORY = "F_REGISTER_RUMOR_CALLBACK_HEARD";
const RECORD_PREFIX = "WORLD-RECORD:FARM-INN-REGISTER:";
const FACT_ID = "F-FACT-REGISTERED-FINN-RESCUER";
const RUMOR_ID = "RUM-F-REGISTERED-FINN-RESCUER";
const GOAP_ID = "GOAP-F-RIONA-CARRY-REGISTERED-RESCUER";
const CALLBACK_ACTION_ID = "MISSION_FLOW:F:REGISTER_CALLBACK:hear_riona";
const CALLBACK_DELAY_MINUTES = 1440;

function array(value) {
  return Array.isArray(value) ? value : [];
}

function minute(runtime) {
  return Number(runtime?.playerState?.absoluteMinute ?? 0);
}

function player(runtime) {
  return runtime?.playerState?.player ?? {};
}

function history(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.history ??= [];
  return runtime.playerState.history;
}

function hasHistory(runtime, type) {
  return array(runtime?.playerState?.history).some((entry) => entry?.type === type);
}

function ensureWorldRecords(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.worldRecords ??= {};
  return runtime.playerState.worldRecords;
}

function registeredPrologue(runtime) {
  const prologue = runtime?.checkpointEPrologue;
  return prologue?.complete === true
    && prologue?.loan?.disposition === "borrowed_registered";
}

function registerMinute(runtime) {
  const completedAt = Number(runtime?.checkpointEPrologue?.completedAtMinute);
  return Number.isFinite(completedAt) ? Math.max(0, completedAt - 45) : minute(runtime);
}

function registerRecord(runtime) {
  return Object.values(runtime?.playerState?.worldRecords ?? {})
    .find((record) => record?.type === "inn-register" && record?.facilityId === INN_FACILITY_ID) ?? null;
}

function createRegisterRecord(runtime) {
  if (!registeredPrologue(runtime)) return registerRecord(runtime);
  const existing = registerRecord(runtime);
  if (existing) return existing;
  const recordedAtMinute = registerMinute(runtime);
  const id = `${RECORD_PREFIX}${recordedAtMinute}`;
  const currentPlayer = player(runtime);
  const record = {
    id,
    type: "inn-register",
    status: "valid",
    location: LOCATION,
    facilityId: INN_FACILITY_ID,
    recordedAtMinute,
    sourceActionId: REGISTER_SOURCE_ACTION_ID,
    subject: {
      type: "player",
      id: currentPlayer.id ?? "PLAYER",
      displayName: currentPlayer.name ?? null,
    },
  };
  ensureWorldRecords(runtime)[id] = record;
  if (!hasHistory(runtime, REGISTER_HISTORY)) {
    history(runtime).push({
      type: REGISTER_HISTORY,
      minute: recordedAtMinute,
      recordId: id,
      facilityId: INN_FACILITY_ID,
      sourceActionId: REGISTER_SOURCE_ACTION_ID,
    });
  }
  return record;
}

function finnReturned(runtime) {
  return runtime?.playerState?.worldFlags?.t01FinnReturned === true
    || hasHistory(runtime, "T01_FINN_ESCORTED_TO_SQUARE");
}

function ensureLivingWorld(runtime) {
  runtime.livingWorld ??= {};
  runtime.livingWorld.npcStates ??= {};
  return runtime.livingWorld;
}

function ensureRiona(runtime) {
  const world = ensureLivingWorld(runtime);
  world.npcStates[RIONA_ID] ??= {
    location: LOCATION,
    lifeStatus: "alive",
    presence: "present",
    position: { hubId: LOCATION, facilityId: INN_FACILITY_ID },
    beliefs: {},
    knowledgeRevision: 0,
    currentGoal: "follow-routine",
    goalSince: minute(runtime) / 60,
    localTravel: null,
  };
  const state = world.npcStates[RIONA_ID];
  state.beliefs ??= {};
  state.knowledgeRevision = Number(state.knowledgeRevision ?? 0);
  return state;
}

function ensureRumorCollections(runtime) {
  runtime.playerState.rumors ??= [];
  runtime.playerState.rumorById ??= {};
  const known = runtime.playerState.player?.knownRumorIds;
  if (!(known instanceof Set)) {
    runtime.playerState.player ??= {};
    runtime.playerState.player.knownRumorIds = new Set(known ?? []);
  }
}

function ensureGoapCollections(runtime) {
  runtime.playerState.goapRequests ??= {};
}

function linkRegisteredRescuer(runtime, record) {
  if (!record || !finnReturned(runtime)) return null;
  ensureRumorCollections(runtime);
  ensureGoapCollections(runtime);
  const existingHistory = array(runtime.playerState.history).find((entry) => entry?.type === LINK_HISTORY);
  const linkedAtMinute = Number(existingHistory?.minute ?? minute(runtime));
  const riona = ensureRiona(runtime);
  const belief = {
    factId: FACT_ID,
    kind: "fact",
    text: "麦穂亭の宿帳に名を残した旅人が、行方不明だったフィンを村へ連れ帰った",
    troubleId: T01_TROUBLE_ID,
    troubleIds: [T01_TROUBLE_ID],
    confidence: 1,
    importance: 0.72,
    secret: false,
    learnedAt: linkedAtMinute / 60,
    propagationAt: linkedAtMinute / 60,
    sourceType: "document-corroboration",
    sourceRecordId: record.id,
    sourceNpcId: null,
    hopCount: 1,
    path: [`record:${record.id}`, `event:T01_FINN_ESCORTED_TO_SQUARE`, RIONA_ID],
  };
  const before = JSON.stringify(riona.beliefs[FACT_ID] ?? null);
  riona.beliefs[FACT_ID] = belief;
  if (before !== JSON.stringify(belief)) riona.knowledgeRevision += 1;
  riona.currentGoal = "carry-registered-rescuer-rumor-along-route";
  riona.goalSince = linkedAtMinute / 60;

  const rumor = runtime.playerState.rumorById[RUMOR_ID] ?? {
    id: RUMOR_ID,
    troubleId: T01_TROUBLE_ID,
    text: "麦穂亭に名を残した旅人が、フィンを連れて村へ戻ったらしい。",
    origin: LOCATION,
    originMinute: linkedAtMinute,
    importance: 0.65,
    playerOriginated: false,
    sourceNpcId: RIONA_ID,
    sourceType: "npc-rumor-carrier",
    spokenFact: "麦穂亭に名を残した旅人がフィンを連れて戻った",
    provenanceText: "宿帳と村の救助後の話が一致した",
    recipients: { [RIONA_ID]: linkedAtMinute },
  };
  if (!runtime.playerState.rumorById[RUMOR_ID]) {
    runtime.playerState.rumorById[RUMOR_ID] = rumor;
    runtime.playerState.rumors.push(rumor);
  }

  runtime.playerState.goapRequests[GOAP_ID] ??= {
    id: GOAP_ID,
    actorNpcId: RIONA_ID,
    goal: "carry-registered-rescuer-rumor-along-route",
    destination: LOCATION,
    destinationFacilityId: SQUARE_FACILITY_ID,
    status: "active",
    createdAtMinute: linkedAtMinute,
    updatedAtMinute: linkedAtMinute,
    readyAtMinute: linkedAtMinute + CALLBACK_DELAY_MINUTES,
    factId: FACT_ID,
    rumorId: RUMOR_ID,
    sourceRecordId: record.id,
  };

  if (!existingHistory) {
    history(runtime).push({
      type: LINK_HISTORY,
      minute: linkedAtMinute,
      missionId: T01_MISSION_ID,
      troubleId: T01_TROUBLE_ID,
      recordId: record.id,
      npcId: RIONA_ID,
      factId: FACT_ID,
      rumorId: RUMOR_ID,
      goapRequestId: GOAP_ID,
    });
  }
  return { record, belief, rumor, goap: runtime.playerState.goapRequests[GOAP_ID] };
}

function rionaUnavailable(runtime) {
  const state = runtime?.livingWorld?.npcStates?.[RIONA_ID];
  return state?.lifeStatus === "dead" || ["dead", "missing", "departed", "sealed", "not-yet-present"].includes(String(state?.presence ?? "present"));
}

function advanceRionaGoap(runtime) {
  const request = runtime?.playerState?.goapRequests?.[GOAP_ID];
  if (!request || request.status !== "active" || minute(runtime) < Number(request.readyAtMinute ?? Infinity)) return request ?? null;
  if (rionaUnavailable(runtime)) return request;
  request.status = "ready";
  request.updatedAtMinute = minute(runtime);
  const riona = ensureRiona(runtime);
  riona.location = LOCATION;
  riona.facilityId = SQUARE_FACILITY_ID;
  riona.position = { hubId: LOCATION, facilityId: SQUARE_FACILITY_ID };
  riona.localTravel = null;
  riona.currentGoal = "tell-registered-rescuer-rumor-when-encountered";
  riona.goalSince = minute(runtime) / 60;
  return request;
}

export function synchronizeRegisterButterfly(runtime) {
  if (!runtime?.playerState) return null;
  const record = createRegisterRecord(runtime);
  const link = linkRegisteredRescuer(runtime, record);
  advanceRionaGoap(runtime);
  return { record, link };
}

function callbackEligible(runtime) {
  synchronizeRegisterButterfly(runtime);
  if (hasHistory(runtime, CALLBACK_HISTORY)) return false;
  const request = runtime?.playerState?.goapRequests?.[GOAP_ID];
  const current = player(runtime);
  return request?.status === "ready"
    && !rionaUnavailable(runtime)
    && current.location === LOCATION
    && current.facilityId === SQUARE_FACILITY_ID;
}

function callbackAction() {
  return {
    id: CALLBACK_ACTION_ID,
    actionId: CALLBACK_ACTION_ID,
    label: "リオナの話を聞く",
    type: "conversation",
    family: "butterfly_callback",
    minutes: 8,
    targetLocation: LOCATION,
    targetFacilityId: SQUARE_FACILITY_ID,
    targetNpcId: RIONA_ID,
    troubleId: T01_TROUBLE_ID,
    authoredRegisterButterflyCallback: true,
  };
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  synchronizeRegisterButterfly(runtime);
  if (callbackEligible(runtime)) return [callbackAction()];
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  synchronizeRegisterButterfly(runtime);
  if (callbackEligible(runtime)) {
    return {
      kicker: "広場を通りかかったリオナが、あなたの顔を見て足を止めた",
      title: "旅商人が聞いた話",
      detail: "宿場を渡り歩く彼女には、村で起きたことが別の経路から届いているらしい。",
      targetLocation: LOCATION,
      targetFacilityId: SQUARE_FACILITY_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime, context);
}

function consumeCallback(runtime, action, result) {
  if (result?.ok === false || action?.authoredRegisterButterflyCallback !== true) return false;
  synchronizeRegisterButterfly(runtime);
  const request = runtime?.playerState?.goapRequests?.[GOAP_ID];
  if (!request || request.status !== "ready") return false;
  request.status = "completed";
  request.updatedAtMinute = minute(runtime);
  const riona = ensureRiona(runtime);
  riona.currentGoal = "continue-rumor-route";
  riona.goalSince = minute(runtime) / 60;
  ensureRumorCollections(runtime);
  runtime.playerState.player.knownRumorIds.add(RUMOR_ID);
  if (!hasHistory(runtime, CALLBACK_HISTORY)) {
    history(runtime).push({
      type: CALLBACK_HISTORY,
      minute: minute(runtime),
      npcId: RIONA_ID,
      factId: FACT_ID,
      rumorId: RUMOR_ID,
      goapRequestId: GOAP_ID,
      actionId: CALLBACK_ACTION_ID,
    });
  }
  result.summary = "リオナはあなたの顔を見るなり、『麦穂亭に名前を残した人でしょう。フィンを連れて戻った旅人だって、宿場でもう話になってるよ』とだけ言い、次の荷の話へ移った。";
  return true;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  if (consumeCallback(runtime, action, result)) return true;
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  synchronizeRegisterButterfly(runtime);
  return changed;
}

export const AUTHORED_REGISTER_BUTTERFLY_INTERNALS = Object.freeze({
  LOCATION,
  INN_FACILITY_ID,
  SQUARE_FACILITY_ID,
  RIONA_ID,
  REGISTER_HISTORY,
  LINK_HISTORY,
  CALLBACK_HISTORY,
  FACT_ID,
  RUMOR_ID,
  GOAP_ID,
  CALLBACK_ACTION_ID,
  CALLBACK_DELAY_MINUTES,
  registeredPrologue,
  registerRecord,
  createRegisterRecord,
  finnReturned,
  ensureRiona,
  linkRegisteredRescuer,
  advanceRionaGoap,
  callbackEligible,
  callbackAction,
  consumeCallback,
});
