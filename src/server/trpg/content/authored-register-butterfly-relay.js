import * as base from "./authored-register-butterfly.js";

export * from "./authored-register-butterfly.js";

export const AUTHORED_REGISTER_BUTTERFLY_RELAY_VERSION = "authored-register-butterfly-relay-v5";

const {
  LOCATION,
  INN_FACILITY_ID,
  RIONA_ID,
  RONA_ID,
  FACT_ID,
  RUMOR_ID,
  GOAP_ID,
  GOAP_GOAL,
  GOAP_ACTION,
  PROPAGATION_HISTORY,
  rionaAftermathPlan,
} = base.AUTHORED_REGISTER_BUTTERFLY_INTERNALS;

const RELAY_PLAN_ID = "GOAP-F-RONA-RELAY-REGISTERED-RESCUER";
const RELAY_TRAVEL_HISTORY = "F_RONA_RELAY_CONTACT_TRAVEL_STARTED";
const LOCAL_RELAY_TRAVEL_HOURS = 0.5;

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function minute(runtime) {
  return Number(runtime?.playerState?.absoluteMinute ?? 0);
}

function state(runtime, npcId) {
  return runtime?.livingWorld?.npcStates?.[npcId] ?? null;
}

function npcFacility(npcState) {
  return npcState?.position?.facilityId ?? npcState?.facilityId ?? null;
}

function unavailable(npcState) {
  if (!npcState) return true;
  return npcState.lifeStatus === "dead"
    || ["dead", "missing", "departed", "sealed", "not-yet-present"].includes(String(npcState.presence ?? "present"));
}

function registerRecord(runtime) {
  return Object.values(runtime?.playerState?.worldRecords ?? {})
    .find((record) => record?.type === "inn-register") ?? null;
}

function relayShareEvent(runtime) {
  return arr(runtime?.livingWorld?.knowledgeEvents)
    .find((event) => event?.type === "share"
      && event?.npcId === RIONA_ID
      && event?.factId === FACT_ID
      && event?.sourceNpcId === RONA_ID) ?? null;
}

function ensureRelayPlan(runtime) {
  const lorna = state(runtime, RONA_ID);
  const riona = state(runtime, RIONA_ID);
  const belief = lorna?.beliefs?.[FACT_ID];
  if (!belief || unavailable(lorna) || unavailable(riona)) return null;
  if (riona?.beliefs?.[FACT_ID] || relayShareEvent(runtime)) return null;

  // This fact is conversation-only, so the source must physically meet Riona.
  // Keep the authored duty aimed at Riona's actual current village facility;
  // the command-side driver below starts a real localTravel instead of copying
  // knowledge, changing currentGoal, or teleporting either NPC.
  const targetHub = riona?.position?.hubId ?? riona?.location ?? LOCATION;
  const targetFacilityId = npcFacility(riona) ?? INN_FACILITY_ID;
  const relayPlan = {
    id: RELAY_PLAN_ID,
    npcIds: [RONA_ID],
    goal: "tell-riona-the-registered-rescuer-link-in-person",
    action: "share-register-link-with-riona",
    targetHub,
    targetFacilityId,
    delayHours: 0,
    statusText: "宿帳とフィン救助を照合した内容を、村内で行商人リオナへ直接伝えに向かっている",
    reason: "registered-rescuer-rumor-needs-real-physical-contact",
  };

  const plans = arr(belief.aftermathPlans);
  const existing = plans.find((plan) => plan?.id === RELAY_PLAN_ID);
  if (existing) Object.assign(existing, relayPlan);
  else belief.aftermathPlans = [...plans, relayPlan];

  // Completing a travel duty without an actual share is not disclosure. Reopen
  // it until the common physical conversation engine creates the share event.
  if (arr(lorna.completedAftermathPlanIds).includes(RELAY_PLAN_ID)
    && !relayShareEvent(runtime)) {
    lorna.completedAftermathPlanIds = arr(lorna.completedAftermathPlanIds)
      .filter((id) => id !== RELAY_PLAN_ID);
  }
  return relayPlan;
}

function driveRelayContact(runtime) {
  const relayPlan = ensureRelayPlan(runtime);
  const lorna = state(runtime, RONA_ID);
  const riona = state(runtime, RIONA_ID);
  const belief = lorna?.beliefs?.[FACT_ID];
  if (!relayPlan || !belief || unavailable(lorna) || unavailable(riona)) return null;
  if (riona?.beliefs?.[FACT_ID] || relayShareEvent(runtime)) return null;
  if (lorna.travel || riona.travel || riona.localTravel) return null;
  if (lorna.localTravel) return lorna.localTravel;
  if (String(lorna.presence ?? "present") !== "present"
    || String(riona.presence ?? "present") !== "present") return null;

  const lornaHub = lorna?.position?.hubId ?? lorna?.location ?? null;
  const rionaHub = riona?.position?.hubId ?? riona?.location ?? null;
  const fromFacilityId = npcFacility(lorna);
  const toFacilityId = npcFacility(riona);
  if (!lornaHub || lornaHub !== rionaHub || !toFacilityId || fromFacilityId === toFacilityId) return null;

  const departedAt = minute(runtime) / 60;
  const travel = {
    routeId: "LOCAL:" + lornaHub + ":" + (fromFacilityId ?? "@hub") + "->" + toFacilityId,
    hubId: lornaHub,
    fromFacilityId,
    toFacilityId,
    departedAt,
    arriveAt: departedAt + LOCAL_RELAY_TRAVEL_HOURS,
  };
  lorna.localTravel = travel;
  lorna.presence = "traveling";
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: RELAY_TRAVEL_HISTORY,
    minute: minute(runtime),
    npcId: RONA_ID,
    targetNpcId: RIONA_ID,
    factId: FACT_ID,
    relayPlanId: RELAY_PLAN_ID,
    fromFacilityId,
    toFacilityId,
    durationMinutes: LOCAL_RELAY_TRAVEL_HOURS * 60,
  });
  return travel;
}

function ensureRumorCollections(runtime) {
  runtime.playerState.rumors ??= [];
  runtime.playerState.rumorById ??= {};
  runtime.playerState.goapRequests ??= {};
}

function hasPropagationHistory(runtime) {
  return arr(runtime?.playerState?.history)
    .some((entry) => entry?.type === PROPAGATION_HISTORY);
}

function observeRelayShare(runtime) {
  const record = registerRecord(runtime);
  const share = relayShareEvent(runtime);
  const riona = state(runtime, RIONA_ID);
  const belief = riona?.beliefs?.[FACT_ID];
  if (!record || !share || !belief || unavailable(riona)) return null;
  if (belief.sourceNpcId !== RONA_ID || belief.sourceRecordId !== record.id) return null;

  ensureRumorCollections(runtime);
  riona.memories ??= {};
  const heardAtMinute = Math.round(Number(share.learnedAt ?? (minute(runtime) / 60)) * 60);
  riona.memories[FACT_ID] ??= {
    factId: FACT_ID,
    kind: "heard-rumor",
    text: "ローナから、宿帳の旅人がフィンを連れて戻ったと直接聞いた",
    learnedAtMinute: heardAtMinute,
    sourceType: "npc-conversation",
    sourceRecordId: record.id,
    sourceNpcId: RONA_ID,
    provenanceEventId: share.id,
    path: [...arr(share.path)],
  };

  const rumor = runtime.playerState.rumorById[RUMOR_ID] ?? {
    id: RUMOR_ID,
    troubleId: "T01",
    text: "麦穂亭に名を残した旅人が、フィンを連れて村へ戻ったらしい。",
    origin: LOCATION,
    originMinute: heardAtMinute,
    importance: 0.65,
    playerOriginated: false,
    sourceNpcId: RONA_ID,
    sourceType: "npc-share",
    sourceEventId: share.id,
    spokenFact: "麦穂亭に名を残した旅人がフィンを連れて戻った",
    provenanceText: "ローナが宿帳と救助後の帰還を照合し、村内でリオナへ直接話した",
    recipients: { [RIONA_ID]: heardAtMinute },
  };
  if (!runtime.playerState.rumorById[RUMOR_ID]) {
    runtime.playerState.rumorById[RUMOR_ID] = rumor;
    runtime.playerState.rumors.push(rumor);
  }

  runtime.playerState.goapRequests[GOAP_ID] ??= {
    id: GOAP_ID,
    actorNpcId: RIONA_ID,
    goal: GOAP_GOAL,
    action: GOAP_ACTION,
    reason: "merchant-rumor-credibility",
    preconditions: {
      factId: FACT_ID,
      learnedFromNpcId: RONA_ID,
      sourceRecordId: record.id,
      sourceKnowledgeEventId: share.id,
    },
    destination: LOCATION,
    destinationFacilityId: "LOC_FARM_SQUARE",
    status: "active",
    executionAuthority: "npc-life-engine",
    plannerContract: "resolved-belief-aftermath-plan",
    aftermathPlanId: GOAP_ID,
    createdAtMinute: heardAtMinute,
    updatedAtMinute: heardAtMinute,
    factId: FACT_ID,
    rumorId: RUMOR_ID,
    sourceNpcId: RONA_ID,
    sourceRecordId: record.id,
    sourceKnowledgeEventId: share.id,
  };

  const plans = arr(belief.aftermathPlans).filter((plan) => plan?.id !== RELAY_PLAN_ID);
  if (!plans.some((plan) => plan?.id === GOAP_ID)) {
    belief.aftermathPlans = [...plans, rionaAftermathPlan()];
  }

  runtime.playerState.history ??= [];
  if (!hasPropagationHistory(runtime)) {
    runtime.playerState.history.push({
      type: PROPAGATION_HISTORY,
      minute: heardAtMinute,
      missionId: "MSN-T01",
      troubleId: "T01",
      recordId: record.id,
      sourceNpcId: RONA_ID,
      npcId: RIONA_ID,
      factId: FACT_ID,
      rumorId: RUMOR_ID,
      goapRequestId: GOAP_ID,
      knowledgeEventId: share.id,
      relayPlanId: RELAY_PLAN_ID,
      relayFacilityId: share.location?.facilityId ?? null,
    });
  }
  return { record, share, belief, rumor, goap: runtime.playerState.goapRequests[GOAP_ID] };
}

export function synchronizeRegisterButterfly(runtime) {
  const baseState = base.synchronizeRegisterButterfly(runtime);
  let relayPlan = ensureRelayPlan(runtime);
  const propagation = observeRelayShare(runtime);
  const settled = base.synchronizeRegisterButterfly(runtime);

  // The base synchronizer reconstructs the source belief from the canonical
  // inn-register fact. Until a real NPC conversation has propagated the fact,
  // restore the pending physical relay duty after that reconstruction so the
  // planner still sees it on the next world tick.
  if (!propagation) relayPlan = ensureRelayPlan(runtime) ?? relayPlan;

  return {
    ...baseState,
    ...settled,
    relayPlan,
    relayPropagation: propagation,
  };
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  synchronizeRegisterButterfly(runtime);
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  ensureRelayPlan(runtime);
  return actions;
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  synchronizeRegisterButterfly(runtime);
  const guidance = base.authoredMissionFlowGuidance(runtime, context);
  ensureRelayPlan(runtime);
  return guidance;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  synchronizeRegisterButterfly(runtime);
  // Movement is command-driven only. Pure views/synchronization never move an
  // NPC, while the next normal world tick settles this 30-minute local travel
  // and lets the generic co-presence conversation engine create the real share.
  driveRelayContact(runtime);
  return changed;
}

function relayAwareCallbackEligible(runtime) {
  synchronizeRegisterButterfly(runtime);
  return base.AUTHORED_REGISTER_BUTTERFLY_INTERNALS.callbackEligible(runtime);
}

export const AUTHORED_REGISTER_BUTTERFLY_INTERNALS = Object.freeze({
  ...base.AUTHORED_REGISTER_BUTTERFLY_INTERNALS,
  callbackEligible: relayAwareCallbackEligible,
  synchronizeRegisterButterfly,
});

export const AUTHORED_REGISTER_BUTTERFLY_RELAY_INTERNALS = Object.freeze({
  RELAY_PLAN_ID,
  RELAY_TRAVEL_HISTORY,
  LOCAL_RELAY_TRAVEL_HOURS,
  relayShareEvent,
  ensureRelayPlan,
  driveRelayContact,
  observeRelayShare,
  relayAwareCallbackEligible,
});
