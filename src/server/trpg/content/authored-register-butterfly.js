import * as base from "./canonical-job-time-policy.js";

export * from "./canonical-job-time-policy.js";

export const AUTHORED_REGISTER_BUTTERFLY_VERSION = "authored-register-butterfly-v4";

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
const GOAP_EXECUTION_HISTORY = "F_RIONA_REPUTATION_GOAP_EXECUTED";
const CALLBACK_HISTORY = "F_REGISTER_RUMOR_CALLBACK_HEARD";
const CALLBACK_GREETING_HISTORY = "F_RIONA_AMBIENT_GREETING_OBSERVED";
const RECORD_PREFIX = "WORLD-RECORD:FARM-INN-REGISTER:";
const CALLBACK_RECORD_PREFIX = "WORLD-RECORD:F-RIONA-CALLBACK:";
const FACT_ID = "F-FACT-REGISTERED-FINN-RESCUER";
const RUMOR_ID = "RUM-F-REGISTERED-FINN-RESCUER";
const GOAP_ID = "GOAP-F-RIONA-VERIFY-REGISTERED-RESCUER";
const GOAP_GOAL = "corroborate-village-reputation-before-trade-route";
const GOAP_ACTION = "corroborate-rumor-at-village-square";
const CALLBACK_ACTION_PREFIX = "MISSION_FLOW:F:REGISTER_CALLBACK:";
const CALLBACK_ACTION_IDS = Object.freeze({
  ask: `${CALLBACK_ACTION_PREFIX}ask`,
  wagon: `${CALLBACK_ACTION_PREFIX}wagon`,
  dance: `${CALLBACK_ACTION_PREFIX}dance`,
});
const CALLBACK_ACTION_ID = CALLBACK_ACTION_IDS.ask;

function array(value) {
  return Array.isArray(value) ? value : [];
}

function minute(runtime) {
  return Number(runtime?.playerState?.absoluteMinute ?? 0);
}

function dayAtMinute(value) {
  return Math.floor(Math.max(0, Number(value ?? 0)) / 1440) + 1;
}

function player(runtime) {
  return runtime?.playerState?.player ?? {};
}

function history(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.history ??= [];
  return runtime.playerState.history;
}

function historyEntry(runtime, type) {
  return array(runtime?.playerState?.history).find((entry) => entry?.type === type) ?? null;
}

function hasHistory(runtime, type) {
  return Boolean(historyEntry(runtime, type));
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
    recordedDay: dayAtMinute(recordedAtMinute),
    sourceActionId: REGISTER_SOURCE_ACTION_ID,
    subject: {
      type: "player",
      id: currentPlayer.id ?? "PLAYER",
      displayName: currentPlayer.name ?? currentPlayer.displayName ?? null,
    },
    provenance: {
      checkpoint: "E",
      lodgingChoice: "registered_stay",
      loanDisposition: "borrowed_registered",
      actionId: REGISTER_SOURCE_ACTION_ID,
      facilityId: INN_FACILITY_ID,
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

function npcAvailableForInteraction(state) {
  return Boolean(state)
    && !npcUnavailable(state)
    && state.presence === "present"
    && !state.travel
    && !state.localTravel;
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

function addKnowledgeEvent(runtime, event) {
  const world = runtime?.livingWorld;
  if (!world) return null;
  world.knowledgeEvents ??= [];
  world.knowledgeEventSequence = Number(world.knowledgeEventSequence ?? world.knowledgeEvents.length) + 1;
  const id = `K${String(world.knowledgeEventSequence).padStart(7, "0")}`;
  const stored = { id, ...event };
  world.knowledgeEvents.push(stored);
  return stored;
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

function rionaAftermathPlan() {
  return {
    id: GOAP_ID,
    npcIds: [RIONA_ID],
    goal: GOAP_GOAL,
    action: GOAP_ACTION,
    targetHub: LOCATION,
    targetFacilityId: SQUARE_FACILITY_ID,
    delayHours: 0,
    statusText: "次の街へ噂を持ち出す前に、広場で村人の反応と取引相手の評判を照合している",
    reason: "merchant-rumor-credibility",
  };
}

function lornaKnowledgeEvent(runtime) {
  return array(runtime?.livingWorld?.knowledgeEvents)
    .find((event) => event?.npcId === RONA_ID && event?.factId === FACT_ID && event?.type === "correlation") ?? null;
}

function linkRegisteredRescuer(runtime, record) {
  if (!record || !finnReturned(runtime)) return null;
  const rona = existingNpc(runtime, RONA_ID);
  if (npcUnavailable(rona)) return null;
  const existing = historyEntry(runtime, LINK_HISTORY);
  const linkedAtMinute = Number(existing?.minute ?? minute(runtime));
  const learnedAt = linkedAtMinute / 60;
  const path = [`record:${record.id}`, "event:T01_FINN_ESCORTED_TO_SQUARE", RONA_ID];
  let sourceEvent = lornaKnowledgeEvent(runtime);
  if (!sourceEvent) {
    sourceEvent = addKnowledgeEvent(runtime, {
      type: "correlation",
      npcId: RONA_ID,
      factId: FACT_ID,
      troubleId: T01_TROUBLE_ID,
      troubleStatus: "resolved",
      learnedAt,
      propagationAt: learnedAt + (1 / 60),
      sourceType: "inn-register-corroboration",
      sourceNpcId: RONA_ID,
      sourceRecordId: record.id,
      sourceEventId: null,
      importance: 0.72,
      confidence: 1,
      hopCount: 0,
      path,
      location: { hubId: LOCATION, facilityId: INN_FACILITY_ID },
    });
  }
  const memory = {
    factId: FACT_ID,
    kind: "memory",
    text: "麦穂亭の宿帳の旅人と、フィンを連れて戻った旅人が同じ人物だと照合した",
    learnedAtMinute: linkedAtMinute,
    sourceType: "inn-register-corroboration",
    sourceRecordId: record.id,
    sourceNpcId: RONA_ID,
    provenanceEventId: sourceEvent?.id ?? null,
    path,
  };
  const belief = {
    factId: FACT_ID,
    kind: "trouble",
    text: "麦穂亭の宿帳に名を残した旅人が、行方不明だったフィンを村へ連れ帰った",
    troubleId: T01_TROUBLE_ID,
    troubleIds: [T01_TROUBLE_ID],
    troubleStatus: "resolved",
    confidence: 1,
    importance: 0.72,
    secret: false,
    learnedAt,
    propagationAt: learnedAt + (1 / 60),
    sourceType: "inn-register-corroboration",
    sourceRecordId: record.id,
    sourceNpcId: RONA_ID,
    provenanceEventId: sourceEvent?.id ?? null,
    hopCount: 0,
    path,
    aftermathPlans: [rionaAftermathPlan()],
  };
  learn(rona, FACT_ID, memory, belief);

  if (!existing) {
    history(runtime).push({
      type: LINK_HISTORY,
      minute: linkedAtMinute,
      missionId: T01_MISSION_ID,
      troubleId: T01_TROUBLE_ID,
      recordId: record.id,
      npcId: RONA_ID,
      factId: FACT_ID,
      sourceNpcId: RONA_ID,
      knowledgeEventId: sourceEvent?.id ?? null,
    });
  }
  return { record, holderNpcId: RONA_ID, memory, belief, knowledgeEvent: sourceEvent };
}

function rionaCanHearAtInn(runtime) {
  const rona = existingNpc(runtime, RONA_ID);
  const riona = existingNpc(runtime, RIONA_ID);
  return npcAvailableForInteraction(rona)
    && npcAvailableForInteraction(riona)
    && npcFacility(rona) === INN_FACILITY_ID
    && npcFacility(riona) === INN_FACILITY_ID;
}

function rionaShareEvent(runtime) {
  return array(runtime?.livingWorld?.knowledgeEvents)
    .find((event) => event?.type === "share"
      && event?.npcId === RIONA_ID
      && event?.factId === FACT_ID
      && event?.sourceNpcId === RONA_ID
      && event?.location?.facilityId === INN_FACILITY_ID) ?? null;
}

function observeRonaToRiona(runtime, record) {
  const riona = existingNpc(runtime, RIONA_ID);
  const shareEvent = rionaShareEvent(runtime);
  const belief = riona?.beliefs?.[FACT_ID];
  if (!record || !belief || !shareEvent || npcUnavailable(riona)) return null;
  if (belief.sourceNpcId !== RONA_ID || belief.sourceRecordId !== record.id) return null;
  ensureRumorCollections(runtime);
  ensureGoapCollections(runtime);
  const existing = historyEntry(runtime, PROPAGATION_HISTORY);
  const heardAtMinute = Number(existing?.minute ?? Math.round(Number(shareEvent.learnedAt ?? (minute(runtime) / 60)) * 60));
  const rionaState = ensureKnowledgeState(riona);
  if (!rionaState.memories[FACT_ID]) {
    rionaState.memories[FACT_ID] = {
      factId: FACT_ID,
      kind: "heard-rumor",
      text: "麦穂亭のローナから、宿帳の旅人がフィンを連れて戻ったと聞いた",
      learnedAtMinute: heardAtMinute,
      sourceType: "npc-conversation",
      sourceRecordId: record.id,
      sourceNpcId: RONA_ID,
      provenanceEventId: shareEvent.id,
      path: [...(shareEvent.path ?? [])],
    };
  }

  const rumor = runtime.playerState.rumorById[RUMOR_ID] ?? {
    id: RUMOR_ID,
    troubleId: T01_TROUBLE_ID,
    text: "麦穂亭に名を残した旅人が、フィンを連れて村へ戻ったらしい。",
    origin: LOCATION,
    originMinute: heardAtMinute,
    importance: 0.65,
    playerOriginated: false,
    sourceNpcId: RONA_ID,
    sourceType: "npc-share",
    sourceEventId: shareEvent.id,
    spokenFact: "麦穂亭に名を残した旅人がフィンを連れて戻った",
    provenanceText: "ローナが宿帳と救助後の帰還を照合し、麦穂亭でリオナへ話した",
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
      sourceKnowledgeEventId: shareEvent.id,
    },
    destination: LOCATION,
    destinationFacilityId: SQUARE_FACILITY_ID,
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
    sourceKnowledgeEventId: shareEvent.id,
  };

  if (!existing) {
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
      knowledgeEventId: shareEvent.id,
    });
  }
  return { memory: rionaState.memories[FACT_ID], belief, rumor, goap: runtime.playerState.goapRequests[GOAP_ID], knowledgeEvent: shareEvent };
}

function matchingDecisionEvents(runtime) {
  return array(runtime?.livingWorld?.decisionEvents)
    .filter((event) => event?.npcId === RIONA_ID && event?.aftermathPlanId === GOAP_ID);
}

function matchingMovementEvents(runtime) {
  return array(runtime?.livingWorld?.localMovementEvents)
    .filter((event) => event?.npcId === RIONA_ID && event?.toFacilityId === SQUARE_FACILITY_ID);
}

function observeRionaGoap(runtime) {
  const request = runtime?.playerState?.goapRequests?.[GOAP_ID];
  const riona = existingNpc(runtime, RIONA_ID);
  if (!request || npcUnavailable(riona)) return request ?? null;
  if (request.status === "completed") return request;
  const decisions = matchingDecisionEvents(runtime);
  if (request.status === "active" && (riona.localTravel || riona.travel || decisions.some((event) => event.action === "local-travel" || event.action === "travel"))) {
    request.status = "in_progress";
    request.updatedAtMinute = minute(runtime);
  }
  const completed = array(riona.completedAftermathPlanIds).includes(GOAP_ID);
  if (!completed || npcFacility(riona) !== SQUARE_FACILITY_ID) return request;
  const movements = matchingMovementEvents(runtime);
  const completionDecision = [...decisions].reverse().find((event) => event.action === GOAP_ACTION) ?? decisions.at(-1) ?? null;
  request.status = "completed";
  request.updatedAtMinute = minute(runtime);
  request.completionReason = "npc-life-engine-aftermath-plan-completed";
  request.executionEvidence = {
    planner: "npc-life-engine",
    decisionEventId: completionDecision?.id ?? null,
    movementRouteId: movements.at(-1)?.routeId ?? null,
    movementArrivedAtHour: movements.at(-1)?.arrivedAt ?? null,
  };
  if (!hasHistory(runtime, GOAP_EXECUTION_HISTORY)) {
    history(runtime).push({
      type: GOAP_EXECUTION_HISTORY,
      minute: minute(runtime),
      npcId: RIONA_ID,
      factId: FACT_ID,
      goapRequestId: GOAP_ID,
      decisionEventId: request.executionEvidence.decisionEventId,
      movementRouteId: request.executionEvidence.movementRouteId,
      executionAuthority: "npc-life-engine",
    });
  }
  return request;
}

export function synchronizeRegisterButterfly(runtime) {
  if (!runtime?.playerState) return null;
  const record = createRegisterRecord(runtime);
  const link = linkRegisteredRescuer(runtime, record);
  const propagation = observeRonaToRiona(runtime, record);
  const goap = observeRionaGoap(runtime);
  return { record, link, propagation, goap };
}

function callbackEligible(runtime) {
  synchronizeRegisterButterfly(runtime);
  if (hasHistory(runtime, CALLBACK_HISTORY)) return false;
  const request = runtime?.playerState?.goapRequests?.[GOAP_ID];
  const current = player(runtime);
  const riona = existingNpc(runtime, RIONA_ID);
  return request?.status === "completed"
    && npcAvailableForInteraction(riona)
    && npcFacility(riona) === SQUARE_FACILITY_ID
    && current.location === LOCATION
    && current.facilityId === SQUARE_FACILITY_ID;
}

function callbackActions() {
  const common = {
    family: "butterfly_callback",
    targetLocation: LOCATION,
    targetFacilityId: SQUARE_FACILITY_ID,
    targetNpcId: RIONA_ID,
    troubleId: T01_TROUBLE_ID,
    authoredRegisterButterflyCallback: true,
  };
  return [
    {
      ...common,
      id: CALLBACK_ACTION_IDS.ask,
      actionId: CALLBACK_ACTION_IDS.ask,
      callbackBranch: "ask",
      type: "conversation",
      minutes: 4,
      label: "「何の話？」と聞き返す",
    },
    {
      ...common,
      id: CALLBACK_ACTION_IDS.wagon,
      actionId: CALLBACK_ACTION_IDS.wagon,
      callbackBranch: "wagon",
      type: "observe",
      minutes: 3,
      label: "返事の代わりに、荷車の積み荷と縄の結び目を見る",
    },
    {
      ...common,
      id: CALLBACK_ACTION_IDS.dance,
      actionId: CALLBACK_ACTION_IDS.dance,
      callbackBranch: "dance",
      type: "observe",
      minutes: 2,
      label: "なぜか二歩だけ踊り、何事もなかった顔で立ち止まる",
    },
  ];
}

function callbackAction() {
  return callbackActions()[0];
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  synchronizeRegisterButterfly(runtime);
  if (callbackEligible(runtime)) return callbackActions();
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  synchronizeRegisterButterfly(runtime);
  if (callbackEligible(runtime)) {
    return {
      kicker: "広場で品を見ていたリオナが、あなたに気づいて荷車から顔を上げた",
      title: "「ねえ。あなた、麦穂亭に泊まった人でしょう？」",
      detail: "次の街へ噂を持ち出す前に村内で裏を取り終えた行商人が、偶然居合わせたあなたへ声をかけている。どう応じるかは別の話だ。",
      targetLocation: LOCATION,
      targetFacilityId: SQUARE_FACILITY_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime, context);
}

function callbackBranchDefinition(branch) {
  return {
    ask: {
      factId: "F-FACT-PLAYER-ASKED-RIONA-ABOUT-RUMOR",
      factText: "リオナから声をかけられた旅人は、何の話かを聞き返した",
      interpretationFactId: "F-BELIEF-RIONA-PLAYER-WANTS-RUMOR-CONTEXT",
      interpretationKind: "interpretation",
      interpretationText: "旅人は、自分について流れている話の内容を確認したがっているのかもしれない",
      confidence: 0.72,
      summary: "『何の話？』と聞き返すと、リオナは『ローナさんから聞いたんだ。フィンを連れて戻った旅人だって。次の街へ持っていく前に、村でもう少し裏を取ってたところ』と答えた。",
    },
    wagon: {
      factId: "F-FACT-PLAYER-INSPECTED-RIONA-WAGON-DURING-GREETING",
      factText: "リオナから声をかけられた旅人は、返事より先に荷車の積み荷と縄の結び目を見た",
      interpretationFactId: "F-BELIEF-RIONA-PLAYER-MAY-ASSESS-TRADE-GOODS",
      interpretationKind: "interpretation",
      interpretationText: "旅人は会話より先に商品と荷造りを見るほど、商売か荷の扱いに関心があるのかもしれない",
      confidence: 0.56,
      summary: "あなたが荷車の積み方を見ていると、リオナは一瞬だけ目を細めた。『……商品を見る人なんだ。まあいいや。ローナさんから、フィンを連れて戻った旅人だって聞いたよ』と、商人らしくこちらの視線まで覚え込んだ。",
    },
    dance: {
      factId: "F-FACT-PLAYER-DANCED-DURING-RIONA-GREETING",
      factText: "リオナから声をかけられた旅人は、その場で二歩だけ踊ってから何事もなかった顔で立ち止まった",
      interpretationFactId: "F-BELIEF-RIONA-DANCE-MAY-BE-SIGNAL-OR-DEFLECTION",
      interpretationKind: "misconception",
      interpretationText: "あの二歩は冗談ではなく、話を逸らす合図か誰かへのサインだった可能性もある",
      confidence: 0.34,
      summary: "二歩だけ踊ると、リオナは完全に言葉を失った。やがて『……今の、合図？　いや、まあいいや。ローナさんから、フィンを連れて戻った旅人だって聞いたんだけど』と首を傾げた。何のために踊ったかは、彼女には分からない。",
    },
  }[branch] ?? null;
}

function coPresentWitnessNpcIds(runtime) {
  const current = player(runtime);
  return Object.entries(runtime?.livingWorld?.npcStates ?? {})
    .filter(([, state]) => npcAvailableForInteraction(state)
      && state.position?.hubId === current.location
      && npcFacility(state) === current.facilityId)
    .map(([npcId]) => npcId)
    .sort((left, right) => left.localeCompare(right, "en"));
}

function createObservableRecord(runtime, { id, factId, factText, actionId, witnessNpcIds }) {
  const currentMinute = minute(runtime);
  const record = {
    id,
    type: "observed-player-action",
    status: "observed",
    factId,
    text: factText,
    subject: { type: "player", id: player(runtime).id ?? "PLAYER", displayName: player(runtime).name ?? player(runtime).displayName ?? null },
    observedAtMinute: currentMinute,
    observedDay: dayAtMinute(currentMinute),
    location: player(runtime).location,
    facilityId: player(runtime).facilityId,
    sourceActionId: actionId,
    witnessNpcIds: [...witnessNpcIds],
    provenance: {
      sourceType: "direct-world-observation",
      actionId,
      facilityId: player(runtime).facilityId,
      observedAtMinute: currentMinute,
    },
  };
  ensureWorldRecords(runtime)[id] ??= record;
  return ensureWorldRecords(runtime)[id];
}

function recordRionaInterpretation(runtime, definition, observedRecord) {
  const riona = ensureKnowledgeState(existingNpc(runtime, RIONA_ID));
  if (!riona) return null;
  if (riona.beliefs[definition.interpretationFactId]) return riona.beliefs[definition.interpretationFactId];
  const observedAt = Number(observedRecord.observedAtMinute ?? minute(runtime)) / 60;
  const path = [`record:${observedRecord.id}`, RIONA_ID];
  const event = addKnowledgeEvent(runtime, {
    type: "direct-observation",
    npcId: RIONA_ID,
    factId: definition.interpretationFactId,
    learnedAt: observedAt,
    propagationAt: observedAt + 4,
    sourceType: "direct-observation-interpretation",
    sourceNpcId: RIONA_ID,
    sourceRecordId: observedRecord.id,
    sourceEventId: null,
    importance: 0.48,
    confidence: definition.confidence,
    hopCount: 0,
    path,
    location: { hubId: LOCATION, facilityId: SQUARE_FACILITY_ID },
  });
  const belief = {
    factId: definition.interpretationFactId,
    kind: definition.interpretationKind,
    text: definition.interpretationText,
    confidence: definition.confidence,
    importance: 0.48,
    secret: false,
    learnedAt: observedAt,
    propagationAt: observedAt + 4,
    sourceType: "direct-observation-interpretation",
    sourceNpcId: RIONA_ID,
    sourceRecordId: observedRecord.id,
    provenanceEventId: event?.id ?? null,
    observedAtMinute: observedRecord.observedAtMinute,
    facilityId: observedRecord.facilityId,
    hopCount: 0,
    path,
  };
  riona.memories[definition.interpretationFactId] = {
    factId: definition.interpretationFactId,
    kind: "observation-memory",
    text: observedRecord.text,
    learnedAtMinute: observedRecord.observedAtMinute,
    sourceType: "direct-world-observation",
    sourceNpcId: RIONA_ID,
    sourceRecordId: observedRecord.id,
    provenanceEventId: event?.id ?? null,
    path,
  };
  riona.beliefs[definition.interpretationFactId] = belief;
  riona.knowledgeRevision += 1;
  return belief;
}

function consumeCallback(runtime, action, result) {
  if (result?.ok === false || action?.authoredRegisterButterflyCallback !== true) return false;
  synchronizeRegisterButterfly(runtime);
  const request = runtime?.playerState?.goapRequests?.[GOAP_ID];
  if (request?.status !== "completed" || !callbackEligible(runtime)) return false;
  const branch = action.callbackBranch;
  const definition = callbackBranchDefinition(branch);
  if (!definition) return false;
  const riona = existingNpc(runtime, RIONA_ID);
  if (!npcAvailableForInteraction(riona)) return false;
  ensureRumorCollections(runtime);
  const witnesses = coPresentWitnessNpcIds(runtime);
  const greetingRecordId = `${CALLBACK_RECORD_PREFIX}${minute(runtime)}:greeting`;
  const greetingRecord = createObservableRecord(runtime, {
    id: greetingRecordId,
    factId: "F-FACT-RIONA-GREETED-REGISTERED-TRAVELER",
    factText: "田園の村の広場で、リオナが旅人を見つけて麦穂亭に泊まった人物かと声をかけた",
    actionId: action.id,
    witnessNpcIds: witnesses,
  });
  const responseRecordId = `${CALLBACK_RECORD_PREFIX}${minute(runtime)}:${branch}`;
  const responseRecord = createObservableRecord(runtime, {
    id: responseRecordId,
    factId: definition.factId,
    factText: definition.factText,
    actionId: action.id,
    witnessNpcIds: witnesses,
  });
  const interpretation = recordRionaInterpretation(runtime, definition, responseRecord);
  runtime.playerState.player.knownRumorIds.add(RUMOR_ID);
  if (!hasHistory(runtime, CALLBACK_GREETING_HISTORY)) {
    history(runtime).push({
      type: CALLBACK_GREETING_HISTORY,
      minute: minute(runtime),
      npcId: RIONA_ID,
      factId: greetingRecord.factId,
      recordId: greetingRecord.id,
      facilityId: SQUARE_FACILITY_ID,
      witnessNpcIds: witnesses,
    });
  }
  if (!hasHistory(runtime, CALLBACK_HISTORY)) {
    history(runtime).push({
      type: CALLBACK_HISTORY,
      minute: minute(runtime),
      npcId: RIONA_ID,
      sourceNpcId: RONA_ID,
      factId: FACT_ID,
      rumorId: RUMOR_ID,
      goapRequestId: GOAP_ID,
      actionId: action.id,
      callbackBranch: branch,
      observedRecordId: responseRecord.id,
      interpretationFactId: interpretation?.factId ?? null,
    });
  }
  result.summary = definition.summary;
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
  GOAP_EXECUTION_HISTORY,
  CALLBACK_HISTORY,
  CALLBACK_GREETING_HISTORY,
  FACT_ID,
  RUMOR_ID,
  GOAP_ID,
  GOAP_GOAL,
  GOAP_ACTION,
  CALLBACK_ACTION_ID,
  CALLBACK_ACTION_IDS,
  registeredPrologue,
  registerRecord,
  createRegisterRecord,
  finnReturned,
  existingNpc,
  npcFacility,
  npcAvailableForInteraction,
  rionaAftermathPlan,
  linkRegisteredRescuer,
  rionaCanHearAtInn,
  rionaShareEvent,
  observeRonaToRiona,
  matchingDecisionEvents,
  matchingMovementEvents,
  observeRionaGoap,
  callbackEligible,
  callbackAction,
  callbackActions,
  callbackBranchDefinition,
  consumeCallback,
});