import * as base from "./authored-register-butterfly.js";

export * from "./authored-register-butterfly.js";

export const AUTHORED_REGISTER_BUTTERFLY_RELAY_VERSION = "authored-register-butterfly-relay-v4";

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

  // Lorna is the inn-side source of this fact. Chasing a roaming merchant's
  // current facility one tick late made the two NPCs perpetually miss each
  // other. The causal rendezvous is therefore Wheat Inn itself: Lorna remains
  // at the place where the guestbook evidence exists, and Riona's ordinary
  // merchant route can bring her there. The common NPC conversation engine is
  // still the only authority that creates the Rona -> Riona share.
  const targetHub = LOCATION;
  const targetFacilityId = INN_FACILITY_ID;
  const relayPlan = {
    id: RELAY_PLAN_ID,
    npcIds: [RONA_ID],
    goal: "tell-riona-the-registered-rescuer-link-in-person",
    action: "share-register-link-with-riona",
    targetHub,
    targetFacilityId,
    delayHours: 0,
    statusText: "宿帳とフィン救助を照合した内容を、麦穂亭へ立ち寄る行商人リオナへ直接伝えるため待っている",
    reason: "registered-rescuer-rumor-needs-real-contact-at-source-record",
  };

  const plans = arr(belief.aftermathPlans);
  const existing = plans.find((plan) => plan?.id === RELAY_PLAN_ID);
  if (existing) Object.assign(existing, relayPlan);
  else belief.aftermathPlans = [...plans, relayPlan];

  // Completing the authored duty while the listener is absent is not a real
  // disclosure. Re-open it and keep Lorna at the inn until a later life tick
  // places Riona there too; prepareNpcLifeTick will then create the common
  // facility conversation before either NPC chooses a new routine action.
  if (arr(lorna.completedAftermathPlanIds).includes(RELAY_PLAN_ID)
    && (npcFacility(lorna) !== targetFacilityId || npcFacility(riona) !== targetFacilityId)) {
    lorna.completedAftermathPlanIds = arr(lorna.completedAftermathPlanIds)
      .filter((id) => id !== RELAY_PLAN_ID);
  }
  return relayPlan;
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
  relayShareEvent,
  ensureRelayPlan,
  observeRelayShare,
  relayAwareCallbackEligible,
});
