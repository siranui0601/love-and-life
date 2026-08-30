import * as base from "./canonical-job-time-policy.js";

export * from "./canonical-job-time-policy.js";

export const AUTHORED_REGISTER_BUTTERFLY_VERSION = "authored-register-butterfly-v2";

const LOCATION = "田園の村";
const INN_FACILITY_ID = "LOC_FARM_INN";
const SQUARE_FACILITY_ID = "LOC_FARM_SQUARE";
const RIONA_ID = "NPC008";
const RONA_ID = "NPC058";
const T01_MISSION_ID = "MSN-T01";
const T01_TROUBLE_ID = "T01";
const REGISTER_SOURCE_ACTION_ID = "E:LODGE:REGISTER";
const REGISTER_HISTORY = "F_INN_REGISTER_RECORD_CREATED";
const LINK_HISTORY = "F_T01_REGISTERED_RESCUER_IDENTIFIED";
const PROPAGATION_HISTORY = "F_T01_RESCUER_RUMOR_RONA_TO_RIONA";
const CALLBACK_HISTORY = "F_REGISTER_RUMOR_CALLBACK_HEARD";
const RECORD_PREFIX = "WORLD-RECORD:FARM-INN-REGISTER:";
const FACT_ID = "F-FACT-REGISTERED-FINN-RESCUER";
const RUMOR_ID = "RUM-F-REGISTERED-FINN-RESCUER";
const GOAP_ID = "GOAP-F-RIONA-VERIFY-REGISTERED-RESCUER";
const CALLBACK_ACTION_ID = "MISSION_FLOW:F:REGISTER_CALLBACK:hear_riona";

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
    provenance: {
      checkpoint: "E",
      lodgingChoice: "registered_stay",
      loanDisposition: "borrowed_registered",
      actionId: REGISTER_SOURCE_ACTION_ID,
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

function existingNpc(runtime, npcId) {
  return runtime?.livingWorld?.npcStates?.[npcId] ?? null;
}

function npcUnavailable(state) {
  if (!state) return true;
  return state.lifeStatus === "dead"
    || ["dead", "missing", "departed", "sealed", "not-yet-present"].includes(String(state.presence ?? "present"));
}

function npcFacility(state) {
  return state?.position?.facilityId ?? state?.facilityId ?? null;
}

function ensureKnowledgeState(state) {
  if (!state || npcUnavailable(state)) return null;
  state.beliefs ??= {};
  state.memories ??= {};
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

function learn(state, factId, memory, belief) {
  const npc = ensureKnowledgeState(state);
  if (!npc) return false;
  const before = JSON.stringify({ memory: npc.memories[factId] ?? null, belief: npc.beliefs[factId] ?? null });
  npc.memories[factId] = memory;
  npc.beliefs[factId] = belief;
  const after = JSON.stringify({ memory, belief });
  if (before !== after) npc.knowledgeRevision += 1;
  return true;
}

function linkRegisteredRescuer(runtime, record) {
  if (!record || !finnReturned(runtime)) return null;
  const rona = existingNpc(runtime, RONA_ID);
  if (npcUnavailable(rona)) return null;
  const existingHistory = array(runtime.playerState.history).find((entry) => entry?.type === LINK_HISTORY);
  const linkedAtMinute = Number(existingHistory?.minute ?? minute(runtime));
  const memory = {
    factId: FACT_ID,
    kind: "memory",
    text: "麦穂亭の宿帳の旅人と、フィンを連れて戻った旅人が同じ人物だと照合した",
    learnedAtMinute: linkedAtMinute,
    sourceType: "inn-register-corroboration",
    sourceRecordId: record.id,
    sourceNpcId: RONA_ID,
    path: [`record:${record.id}`, "event:T01_FINN_ESCORTED_TO_SQUARE", RONA_ID],
  };
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
    sourceType: "inn-register-corroboration",
    sourceRecordId: record.id,
    sourceNpcId: RONA_ID,
    hopCount: 0,
    path: [`record:${record.id}`, "event:T01_FINN_ESCORTED_TO_SQUARE", RONA_ID],
  };
  learn(rona, FACT_ID, memory, belief);
  rona.currentGoal = "keep-inn-ledger-and-village-rumors-consistent";
  rona.goalSince = linkedAtMinute / 60;

  if (!existingHistory) {
    history(runtime).push({
      type: LINK_HISTORY,
      minute: linkedAtMinute,
      missionId: T01_MISSION_ID,
      troubleId: T01_TROUBLE_ID,
      recordId: record.id,
      npcId: RONA_ID,
      factId: FACT_ID,
      sourceNpcId: RONA_ID,
    });
  }
  return { record, holderNpcId: RONA_ID, memory, belief };
}

function rionaCanHearAtInn(runtime) {
  const rona = existingNpc(runtime, RONA_ID);
  const riona = existingNpc(runtime, RIONA_ID);
  if (npcUnavailable(rona) || npcUnavailable(riona)) return false;
  return npcFacility(rona) === INN_FACILITY_ID && npcFacility(riona) === INN_FACILITY_ID;
}

function propagateRonaToRiona(runtime, record) {
  const rona = existingNpc(runtime, RONA_ID);
  if (!record || !rona?.beliefs?.[FACT_ID] || !rionaCanHearAtInn(runtime)) return null;
  ensureRumorCollections(runtime);
  ensureGoapCollections(runtime);
  const riona = existingNpc(runtime, RIONA_ID);
  const existingHistory = array(runtime.playerState.history).find((entry) => entry?.type === PROPAGATION_HISTORY);
  const heardAtMinute = Number(existingHistory?.minute ?? minute(runtime));
  const memory = {
    factId: FACT_ID,
    kind: "heard-rumor",
    text: "麦穂亭のローナから、宿帳の旅人がフィンを連れて戻ったと聞いた",
    learnedAtMinute: heardAtMinute,
    sourceType: "npc-conversation",
    sourceRecordId: record.id,
    sourceNpcId: RONA_ID,
    path: [`record:${record.id}`, "event:T01_FINN_ESCORTED_TO_SQUARE", RONA_ID, RIONA_ID],
  };
  const belief = {
    factId: FACT_ID,
    kind: "belief",
    text: "麦穂亭に名を残した旅人がフィンを連れて戻ったらしい",
    troubleId: T01_TROUBLE_ID,
    troubleIds: [T01_TROUBLE_ID],
    confidence: 0.9,
    importance: 0.65,
    secret: false,
    learnedAt: heardAtMinute / 60,
    propagationAt: heardAtMinute / 60,
    sourceType: "npc-rumor-carrier",
    sourceRecordId: record.id,
    sourceNpcId: RONA_ID,
    hopCount: 1,
    path: [`record:${record.id}`, "event:T01_FINN_ESCORTED_TO_SQUARE", RONA_ID, RIONA_ID],
  };
  learn(riona, FACT_ID, memory, belief);
  riona.currentGoal = "verify-village-rumor-before-repeating-on-trade-route";
  riona.goalSince = heardAtMinute / 60;

  const rumor = runtime.playerState.rumorById[RUMOR_ID] ?? {
    id: RUMOR_ID,
    troubleId: T01_TROUBLE_ID,
    text: "麦穂亭に名を残した旅人が、フィンを連れて村へ戻ったらしい。",
    origin: LOCATION,
    originMinute: heardAtMinute,
    importance: 0.65,
    playerOriginated: false,
    sourceNpcId: RONA_ID,
    sourceType: "innkeeper-to-merchant",
    spokenFact: "麦穂亭に名を残した旅人がフィンを連れて戻った",
    provenanceText: "ローナが宿帳と救助後の帰還を照合し、宿でリオナへ話した",
    recipients: { [RIONA_ID]: heardAtMinute },
  };
  if (!runtime.playerState.rumorById[RUMOR_ID]) {
    runtime.playerState.rumorById[RUMOR_ID] = rumor;
    runtime.playerState.rumors.push(rumor);
  }

  runtime.playerState.goapRequests[GOAP_ID] ??= {
    id: GOAP_ID,
    actorNpcId: RIONA_ID,
    goal: "verify-village-rumor-before-repeating-on-trade-route",
    reason: "merchant-rumor-credibility",
    preconditions: {
      factId: FACT_ID,
      learnedFromNpcId: RONA_ID,
      sourceRecordId: record.id,
    },
    destination: LOCATION,
    destinationFacilityId: SQUARE_FACILITY_ID,
    status: "active",
    createdAtMinute: heardAtMinute,
    updatedAtMinute: heardAtMinute,
    factId: FACT_ID,
    rumorId: RUMOR_ID,
    sourceNpcId: RONA_ID,
    sourceRecordId: record.id,
  };

  if (!existingHistory) {
    history(runtime).push({
      type: PROPAGATION_HISTORY,
      minute: heardAtMinute,
      missionId: T01_MISSION_ID,
      troubleId: T01_TROUBLE_ID,
      recordId: record.id,
      sourceNpcId: RONA_ID,
      npcId: RIONA_ID,
      factId: FACT_ID,
      rumorId: RUMOR_ID,
      goapRequestId: GOAP_ID,
    });
  }
  return { memory, belief, rumor, goap: runtime.playerState.goapRequests[GOAP_ID] };
}

function advanceRionaGoap(runtime) {
  const request = runtime?.playerState?.goapRequests?.[GOAP_ID];
  const riona = existingNpc(runtime, RIONA_ID);
  if (!request || request.status !== "active" || npcUnavailable(riona)) return request ?? null;
  // The butterfly layer never moves Riona. Her canonical merchant routine/GOAP must
  // actually bring her to the square. We only observe that ordinary world-state
  // transition and expose the conversation once its preconditions are satisfied.
  if (npcFacility(riona) !== SQUARE_FACILITY_ID) return request;
  request.status = "ready";
  request.updatedAtMinute = minute(runtime);
  request.readyReason = "canonical-route-arrived-at-village-square";
  riona.currentGoal = "ask-rescuer-before-repeating-rumor-on-trade-route";
  riona.goalSince = minute(runtime) / 60;
  return request;
}

export function synchronizeRegisterButterfly(runtime) {
  if (!runtime?.playerState) return null;
  const record = createRegisterRecord(runtime);
  const link = linkRegisteredRescuer(runtime, record);
  const propagation = propagateRonaToRiona(runtime, record);
  const goap = advanceRionaGoap(runtime);
  return { record, link, propagation, goap };
}

function callbackEligible(runtime) {
  synchronizeRegisterButterfly(runtime);
  if (hasHistory(runtime, CALLBACK_HISTORY)) return false;
  const request = runtime?.playerState?.goapRequests?.[GOAP_ID];
  const current = player(runtime);
  const riona = existingNpc(runtime, RIONA_ID);
  return request?.status === "ready"
    && !npcUnavailable(riona)
    && npcFacility(riona) === SQUARE_FACILITY_ID
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
      title: "旅商人が確かめたい噂",
      detail: "次の街へ持っていく話を間違えないため、宿で聞いた話の本人を確かめたいらしい。",
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
  const riona = existingNpc(runtime, RIONA_ID);
  if (!riona || npcUnavailable(riona)) return false;
  riona.currentGoal = "continue-rumor-route";
  riona.goalSince = minute(runtime) / 60;
  ensureRumorCollections(runtime);
  runtime.playerState.player.knownRumorIds.add(RUMOR_ID);
  if (!hasHistory(runtime, CALLBACK_HISTORY)) {
    history(runtime).push({
      type: CALLBACK_HISTORY,
      minute: minute(runtime),
      npcId: RIONA_ID,
      sourceNpcId: RONA_ID,
      factId: FACT_ID,
      rumorId: RUMOR_ID,
      goapRequestId: GOAP_ID,
      actionId: CALLBACK_ACTION_ID,
    });
  }
  result.summary = "リオナはあなたの顔を見るなり、『あなた、麦穂亭に泊まった人でしょう。ローナさんから聞いたよ。フィンを連れて戻った旅人だって？ 次の街で話す前に本人へ確かめたかったんだ』と笑った。";
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
  RONA_ID,
  REGISTER_HISTORY,
  LINK_HISTORY,
  PROPAGATION_HISTORY,
  CALLBACK_HISTORY,
  FACT_ID,
  RUMOR_ID,
  GOAP_ID,
  CALLBACK_ACTION_ID,
  registeredPrologue,
  registerRecord,
  createRegisterRecord,
  finnReturned,
  existingNpc,
  npcFacility,
  linkRegisteredRescuer,
  rionaCanHearAtInn,
  propagateRonaToRiona,
  advanceRionaGoap,
  callbackEligible,
  callbackAction,
  consumeCallback,
});
