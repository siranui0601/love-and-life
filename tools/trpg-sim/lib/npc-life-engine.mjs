/**
 * Deterministic NPC life/cognition layer for the 100-day world simulation.
 *
 * The engine deliberately shares the legacy npcStates objects.  This keeps
 * the public report compatible while adding facility positions, needs,
 * beliefs, presence/life states and a complete decision trace.
 */

const INACTIVE_PRESENCES = new Set(["dead", "missing", "departed", "sealed", "not-yet-present"]);
const FAILURE_LIKE = new Set(["critical", "failed"]);
const ACTIVE_TROUBLE_STATES = new Set(["active", "critical", "failed", "resolved"]);
const PHASE_NAMES = ["morning", "afternoon", "evening", "night"];
const LOCAL_TRAVEL_HOURS = 0.5;
const RUMOR_IMPORTANCE_THRESHOLD = 0.78;

function clamp(value, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, Number(value)));
}

function round(value, digits = 4) {
  return Number(Number(value).toFixed(digits));
}

function hash32(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mixTraceFingerprint(engine, values) {
  const payload = Array.isArray(values) ? values.join("\u0001") : String(values);
  engine.traceHashA = hash32(`${engine.traceHashA}\u0000${payload}`);
  engine.traceHashB = hash32(`${payload}\u0000${engine.traceHashB}`);
}

/** Stateless random value: unrelated NPCs never perturb one another. */
export function npcRandom(seed, npcId, day, phaseIndex, purpose, attempt = 0) {
  return hash32([seed, npcId, day, phaseIndex, purpose, attempt].join("\u0000")) / 4294967296;
}

function troubleStatus(troubleStates, id) {
  return troubleStates?.[id]?.status ?? "scheduled";
}

function failureLike(status) {
  return FAILURE_LIKE.has(status);
}

function failureAftermathActive(troubleState, time, hours = 24) {
  if (troubleState?.status !== "failed") return true;
  const terminalHour = troubleState.terminalAt?.absoluteHour;
  return Number.isFinite(terminalHour) && time.absoluteHour - terminalHour <= hours;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function ensureInteractionState(engine) {
  engine.interactionEvents ??= [];
  engine.interactionEventSequence = Number(engine.interactionEventSequence ?? engine.interactionEvents.length);
  if (!(engine.interactionDedupeKeys instanceof Set)) {
    engine.interactionDedupeKeys = new Set([
      ...(engine.interactionDedupeKeys ?? []),
      ...engine.interactionEvents.map((event) => event?.dedupeKey).filter(Boolean),
    ]);
  }
  return engine;
}

export function recordWorldInteractionEvent(engine, event = {}) {
  if (!engine) return null;
  ensureInteractionState(engine);
  const speakerId = String(event.speakerId ?? event.speakerNpcId ?? '').trim();
  const listenerIds = unique(event.listenerIds ?? event.listenerNpcIds ?? []);
  const audibleListenerIds = unique(event.audibleListenerIds ?? listenerIds);
  const acceptedListenerIds = unique(event.acceptedListenerIds ?? []);
  if (!speakerId || !audibleListenerIds.length) return null;
  const startedAt = Number(event.startedAt ?? event.absoluteHour ?? 0);
  const dedupeKey = event.dedupeKey ?? [
    event.type ?? 'conversation',
    event.contextType ?? 'facility',
    speakerId,
    audibleListenerIds.join(','),
    event.factId ?? event.topic ?? '',
    Number.isFinite(startedAt) ? startedAt.toFixed(6) : String(startedAt),
    event.location?.facilityId ?? event.location?.hubId ?? event.routeSegment?.routeId ?? '',
  ].join('|');
  if (engine.interactionDedupeKeys.has(dedupeKey)) {
    return engine.interactionEvents.find((entry) => entry?.dedupeKey === dedupeKey) ?? null;
  }
  engine.interactionEventSequence += 1;
  const id = `I${String(engine.interactionEventSequence).padStart(7, '0')}`;
  const stored = {
    id,
    eventId: id,
    type: event.type ?? 'conversation',
    contextType: event.contextType ?? 'facility',
    speakerId,
    speakerNpcId: event.speakerNpcId ?? (speakerId.startsWith('NPC') ? speakerId : null),
    listenerIds,
    listenerNpcIds: listenerIds.filter((id) => id.startsWith('NPC')),
    audibleListenerIds,
    acceptedListenerIds,
    privacy: event.privacy ?? 'public',
    factId: event.factId ?? null,
    topic: event.topic ?? null,
    startedAt,
    endedAt: Number(event.endedAt ?? startedAt),
    day: event.day ?? null,
    phaseIndex: event.phaseIndex ?? null,
    location: event.location ? { ...event.location } : null,
    routeSegment: event.routeSegment ? { ...event.routeSegment } : null,
    provenance: event.provenance ? { ...event.provenance } : null,
    dedupeKey,
  };
  engine.interactionEvents.push(stored);
  engine.interactionDedupeKeys.add(dedupeKey);
  return stored;
}

function extractTroubleIds(value) {
  return unique(String(value ?? "").match(/T\d{2}/gu) ?? []);
}

function initialPresence(initialStatus) {
  const text = String(initialStatus ?? "");
  if (/死亡/u.test(text)) return "dead";
  if (/行方不明|消息不明/u.test(text)) return "missing";
  if (/封印/u.test(text)) return "sealed";
  if (/未登場/u.test(text)) return "not-yet-present";
  return "present";
}

function lifeStatusForPresence(presence) {
  if (presence === "dead") return "dead";
  if (presence === "missing") return "missing";
  return "alive";
}

function facilityHub(model, facilityId, fallback = null) {
  return model.facilityById?.[facilityId]?.hub ?? fallback;
}

function sortedNpcs(model) {
  return [...model.npcs].sort((left, right) => left.id.localeCompare(right.id, "en"));
}

function factKey(text) {
  return `source:${hash32(text).toString(16).padStart(8, "0")}`;
}

function addKnowledgeEvent(engine, event) {
  engine.knowledgeEventSequence = Number(engine.knowledgeEventSequence ?? engine.knowledgeEvents.length) + 1;
  const id = `K${String(engine.knowledgeEventSequence).padStart(7, "0")}`;
  const offset = Number.isFinite(event.learnedAt) && event.learnedAt >= 0 ? event.learnedAt % 24 : -1;
  const derivedPhase = offset < 0 ? -1 : offset >= 12 ? 3 : offset >= 8 ? 2 : offset >= 4 ? 1 : 0;
  const enriched = {
    id,
    eventId: id,
    tick: Number.isFinite(event.learnedAt) && event.learnedAt >= 0 ? Math.floor(event.learnedAt / 24) * 4 + (event.phaseIndex ?? derivedPhase) : -1,
    propagationAt: event.propagationAt ?? event.learnedAt,
    hopCount: event.hopCount ?? (event.sourceNpcId ? 1 : 0),
    path: event.path ?? (event.sourceNpcId ? [event.sourceNpcId, event.npcId] : [event.npcId]),
    accepted: true,
    ...event,
  };
  engine.knowledgeEvents.push(enriched);
  return enriched;
}

function propagationMetadata(sourceBelief, recipientId) {
  const sourcePath = Array.isArray(sourceBelief?.path) && sourceBelief.path.length
    ? sourceBelief.path
    : [sourceBelief?.sourceNpcId ?? "unknown-source"];
  return {
    hopCount: Number(sourceBelief?.hopCount ?? 0) + 1,
    path: [...sourcePath, recipientId],
  };
}

function addBelief(engine, state, belief, event) {
  const known = state.beliefs[belief.factId];
  if (known && known.confidence >= belief.confidence && known.learnedAt <= belief.learnedAt) return false;
  const knowledgeEvent = addKnowledgeEvent(engine, {
    importance: belief.importance ?? 0.25,
    confidence: belief.confidence,
    ...event,
  });
  state.beliefs[belief.factId] = {
    importance: 0.25,
    propagationAt: belief.learnedAt,
    ...belief,
    hopCount: knowledgeEvent.hopCount,
    path: [...knowledgeEvent.path],
    provenanceEventId: knowledgeEvent.id,
  };
  state.knowledgeRevision += 1;
  return true;
}

function initialBeliefs(engine, npc, state) {
  const parsed = npc.initialKnowledge ?? {};
  const entries = [
    ...(parsed.facts ?? String(npc.knowledgeTags ?? "").split(/[,/]/u).filter(Boolean)).map((text) => ({ text, kind: "fact", secret: false })),
    ...(parsed.interests ?? []).map((text) => ({ text, kind: "interest", secret: false })),
    ...(parsed.misconceptions ?? []).map((text) => ({ text, kind: "misconception", secret: false })),
    ...(parsed.secrets ?? []).map((text) => ({ text, kind: "secret", secret: true })),
  ];
  for (const entry of entries) {
    const text = String(entry.text).trim();
    if (!text) continue;
    const factId = factKey(`${npc.id}:${entry.kind}:${text}`);
    addBelief(engine, state, {
      factId,
      kind: entry.kind,
      text,
      troubleIds: extractTroubleIds(text),
      confidence: entry.kind === "misconception" ? 0.55 : 1,
      importance: entry.kind === "secret" ? 0.65 : 0.25,
      secret: entry.secret,
      learnedAt: -1,
      propagationAt: 0,
      sourceType: "sheet",
      sourceNpcId: null,
    }, {
      type: "initial",
      npcId: npc.id,
      factId,
      learnedAt: -1,
      propagationAt: 0,
      sourceType: "sheet",
      sourceNpcId: null,
      sourceEventId: null,
    });
  }
}

function candidateFacilities(model, npc, hubId) {
  const source = unique([
    npc.mainFacilityId,
    npc.initialFacilityId,
    ...(npc.relatedFacilityIds ?? []),
  ]).filter((id) => facilityHub(model, id) === hubId);
  const allAtHub = (model.facilitiesByHub?.[hubId] ?? []).map((facility) => facility.id);
  if (source.length < 2 && allAtHub.length) {
    const offset = hash32(npc.id) % allAtHub.length;
    source.push(allAtHub[offset], allAtHub[(offset + 1) % allAtHub.length]);
  }
  return unique(source);
}

function initializeNpcState(engine, npc, state) {
  const presence = initialPresence(npc.initialStatus);
  const facilityId = npc.initialFacilityId ?? npc.mainFacilityId ?? null;
  const hubId = facilityHub(engine.model, facilityId, npc.initialLocation);
  state.location = hubId;
  state.lifeStatus = lifeStatusForPresence(presence);
  state.presence = presence;
  state.position = { hubId, facilityId };
  state.localTravel = null;
  state.health = round(82 + npcRandom(engine.seed, npc.id, 0, 0, "initial-health") * 18);
  state.needs = {
    hunger: round(8 + npcRandom(engine.seed, npc.id, 0, 0, "initial-hunger") * 18),
    fatigue: round(8 + npcRandom(engine.seed, npc.id, 0, 0, "initial-fatigue") * 18),
    stress: round(5 + npcRandom(engine.seed, npc.id, 0, 0, "initial-stress") * 12),
    social: round(10 + npcRandom(engine.seed, npc.id, 0, 0, "initial-social") * 18),
  };
  state.conditions = [];
  state.beliefs = {};
  state.interests = [...(npc.initialKnowledge?.interests ?? [])];
  state.interestTroubleIds = unique([
    ...(npc.relatedTroubleIds ?? []),
    ...extractTroubleIds(`${npc.knowledgeTags ?? ""} ${state.interests.join(" ")}`),
  ]);
  state.knowledgeRevision = 0;
  state.worldRevisionSeen = -1;
  state.currentGoal = presence === "present" ? "follow-routine" : `inactive:${presence}`;
  state.goalSince = -1;
  state.planRevision = 0;
  state.lastDecisionAt = null;
  state.lastCrisisActionAt = {};
  state.completedAftermathPlanIds = [];
  state.lastLifeTransitionAt = null;
  state.activityTicks = 0;
  state.eligibleTicks = 0;
  state.localMovementCount = 0;
  initialBeliefs(engine, npc, state);
}

export function createNpcLifeEngine({ model, seed, npcStates, departures = [] } = {}) {
  if (!model || !npcStates) throw new Error("createNpcLifeEngine requires model and npcStates");
  const engine = {
    model,
    seed: String(seed),
    npcStates,
    departures,
    npcTraces: Object.fromEntries(sortedNpcs(model).map((npc) => [npc.id, []])),
    lifeEvents: [],
    knowledgeEvents: [],
    decisionEvents: [],
    localMovementEvents: [],
    interactionEvents: [],
    interactionEventSequence: 0,
    interactionDedupeKeys: new Set(),
    lastInteractionSweepAt: null,
    knowledgeEventSequence: 0,
    decisionEventSequence: 0,
    populationByTick: [],
    facilityRumors: Object.fromEntries(model.facilities.map((facility) => [facility.id, new Map()])),
    hubRumors: Object.fromEntries(model.locations.map((hub) => [hub, new Map()])),
    seededTroubleFacts: new Set(),
    appliedFates: new Set(),
    fateEvaluatedNpcIds: new Set(),
    fateEvaluationTicks: 0,
    worldRevision: 0,
    lastTroubleStatuses: {},
    traceHashA: 0x811c9dc5,
    traceHashB: 0x9e3779b9,
  };
  for (const npc of sortedNpcs(model)) initializeNpcState(engine, npc, npcStates[npc.id]);
  return engine;
}

export function isNpcLifeEligible(state) {
  return Boolean(state) && state.lifeStatus !== "dead" && !INACTIVE_PRESENCES.has(state.presence);
}

function transitionLife(engine, npc, state, toPresence, time, cause, details = {}) {
  const fromPresence = state.presence;
  const fromLifeStatus = state.lifeStatus;
  const interruptedTravel = state.travel ? { ...state.travel } : state.localTravel ? { ...state.localTravel } : null;
  if (fromPresence === toPresence && !(toPresence === "present" && fromLifeStatus === "injured")) return false;
  state.presence = toPresence;
  state.lifeStatus = toPresence === "dead" ? "dead" : toPresence === "missing" ? "missing" : details.lifeStatus ?? "alive";
  if (INACTIVE_PRESENCES.has(toPresence)) {
    state.travel = null;
    state.localTravel = null;
  }
  state.currentGoal = `inactive:${toPresence}`;
  state.lastLifeTransitionAt = time.absoluteHour;
  engine.lifeEvents.push({
    id: `L${String(engine.lifeEvents.length + 1).padStart(6, "0")}`,
    type: toPresence === "dead" ? "death" : toPresence === "missing" ? "missing" : toPresence === "departed" ? "departure" : "presence-change",
    npcId: npc.id,
    fromPresence,
    toPresence,
    from: fromPresence,
    to: toPresence,
    fromLifeStatus,
    toLifeStatus: state.lifeStatus,
    vitalState: state.lifeStatus,
    presence: toPresence,
    day: time.day,
    phaseIndex: time.phaseIndex,
    absoluteHour: time.absoluteHour,
    location: { ...state.position },
    locationId: state.position.facilityId ?? state.position.hubId,
    cause,
    transitContext: interruptedTravel,
    ...details,
  });
  return true;
}

function troubleIdsForFate(npc) {
  return unique([...(npc.fateHints?.troubleIds ?? []), ...(npc.relatedTroubleIds ?? [])]);
}

function fateAnchorDay(engine, npc) {
  const anchors = npc.fateHints?.dayAnchors ?? [];
  if (anchors.length) return Math.min(...anchors);
  const deadlines = troubleIdsForFate(npc)
    .map((id) => engine.model.troubleById?.[id]?.deadlineDay)
    .filter(Number.isFinite);
  return deadlines.length ? Math.min(...deadlines) : 100;
}

function fateDestination(engine, npc, state) {
  const text = npc.fateHints?.sourceText ?? npc.nonInterventionFate ?? "";
  const mentioned = engine.model.locations.filter((hub) => text.includes(hub));
  return mentioned.at(-1) ?? null;
}

function fateUnresolved(npc, troubleStates) {
  const ids = troubleIdsForFate(npc);
  if (!ids.length) return true;
  return ids.some((id) => !["resolved", "suppressed"].includes(troubleStatus(troubleStates, id)));
}

function exposedToRelatedCrisis(engine, npc, state, troubleStates) {
  return troubleIdsForFate(npc).some((id) => {
    const status = troubleStatus(troubleStates, id);
    if (!failureLike(status) && status !== "active") return false;
    const trouble = engine.model.troubleById?.[id];
    return trouble?.primaryLocations?.includes(state.position.hubId);
  });
}

function evaluateFate(engine, npc, state, time, troubleStates) {
  engine.fateEvaluatedNpcIds.add(npc.id);
  engine.fateEvaluationTicks += 1;
  const key = `${npc.id}:source-fate`;
  if (engine.appliedFates.has(key) || state.lifeStatus === "dead") return;
  if (npc.id === "NPC016" && time.day >= 49 && troubleStatus(troubleStates, "T11") !== "resolved") {
    engine.appliedFates.add(key);
    transitionLife(engine, npc, state, "dead", time, "canonical-no-player-t11-assassination", {
      sourceFate: npc.nonInterventionFate,
      anchorDay: 49,
      relatedTroubleIds: ["T11"],
    });
    return;
  }
  if (npc.id === "NPC001" && time.day >= 2 && time.phaseIndex >= 3 && troubleStatus(troubleStates, "T01") !== "resolved") {
    engine.appliedFates.add(key);
    transitionLife(engine, npc, state, "dead", time, "canonical-no-player-t01-failure", {
      sourceFate: npc.nonInterventionFate,
      anchorDay: 2,
      relatedTroubleIds: ["T01"],
    });
    return;
  }
  const hints = npc.fateHints ?? { sourceText: npc.nonInterventionFate ?? "", outcomeKeywords: [] };
  const text = hints.sourceText ?? "";
  const keywords = new Set(hints.outcomeKeywords ?? []);
  const terminalHint = /死亡|戦死|行方不明|消息不明|消息不安定|精霊化|逃亡|避難先不明|退去|追放/u.test(text);
  const injuryHint = /負傷|衰弱|病状悪化|体調悪化|疲弊/u.test(text);
  if (!terminalHint && !injuryHint) return;

  const anchorDay = fateAnchorDay(engine, npc);
  if (time.day < anchorDay || !fateUnresolved(npc, troubleStates)) return;
  const relatedFailure = troubleIdsForFate(npc).some((id) => failureLike(troubleStatus(troubleStates, id)));
  const explicitDay = (hints.dayAnchors ?? []).length > 0;
  if (!explicitDay && !relatedFailure) return;

  const destination = fateDestination(engine, npc, state);
  const safeEvacuation = destination && state.position.hubId !== destination && !exposedToRelatedCrisis(engine, npc, state, troubleStates);
  if (safeEvacuation && /避難|逃亡|退去/u.test(text)) {
    engine.appliedFates.add(key);
    return;
  }

  engine.appliedFates.add(key);
  const details = { sourceFate: text, anchorDay, relatedTroubleIds: troubleIdsForFate(npc) };
  const hasDeath = keywords.has("死亡") || keywords.has("戦死") || /死亡|戦死/u.test(text);
  const hasMissing = keywords.has("行方不明") || keywords.has("消息不明") || keywords.has("消息不安定") || /行方不明|消息不明|消息不安定/u.test(text);
  if (hasDeath && hasMissing) {
    const outcome = npcRandom(engine.seed, npc.id, time.day, time.phaseIndex, "fate-death-or-missing") < 0.55 ? "dead" : "missing";
    transitionLife(engine, npc, state, outcome, time, "source-fate-anchor", details);
    return;
  }
  if (hasDeath) {
    if (/可能性/u.test(text) && npcRandom(engine.seed, npc.id, time.day, time.phaseIndex, "fate-death-chance") >= 0.55) {
      state.lifeStatus = "injured";
      state.health = Math.min(state.health, 28);
      engine.lifeEvents.push({
        id: `L${String(engine.lifeEvents.length + 1).padStart(6, "0")}`,
        npcId: npc.id,
        type: "injury",
        fromPresence: state.presence,
        toPresence: state.presence,
        fromLifeStatus: "alive",
        toLifeStatus: "injured",
        from: state.presence,
        to: "injured",
        vitalState: "injured",
        presence: state.presence,
        day: time.day,
        phaseIndex: time.phaseIndex,
        absoluteHour: time.absoluteHour,
        location: { ...state.position },
        locationId: state.position.facilityId ?? state.position.hubId,
        cause: "source-fate-injury",
        ...details,
      });
    } else transitionLife(engine, npc, state, "dead", time, "source-fate-anchor", details);
    return;
  }
  if (hasMissing || /避難先不明|消滅|精霊化/u.test(text)) {
    transitionLife(engine, npc, state, "missing", time, "source-fate-anchor", details);
    return;
  }
  if (/逃亡|退去|追放/u.test(text)) {
    transitionLife(engine, npc, state, "departed", time, "source-fate-anchor", details);
    return;
  }
  if (injuryHint) {
    state.lifeStatus = "injured";
    state.health = Math.min(state.health, 38);
    state.conditions = unique([...state.conditions, "source-fate-injury"]);
    engine.lifeEvents.push({
      id: `L${String(engine.lifeEvents.length + 1).padStart(6, "0")}`,
      npcId: npc.id,
      type: "injury",
      fromPresence: state.presence,
      toPresence: state.presence,
      fromLifeStatus: "alive",
      toLifeStatus: "injured",
      from: state.presence,
      to: "injured",
      vitalState: state.lifeStatus,
      presence: state.presence,
      day: time.day,
      phaseIndex: time.phaseIndex,
      absoluteHour: time.absoluteHour,
      location: { ...state.position },
      locationId: state.position.facilityId ?? state.position.hubId,
      cause: "source-fate-injury",
      ...details,
    });
  }
}

function maybeActivate(engine, npc, state, time, troubleStates, worldFlags) {
  if (state.presence === "not-yet-present") {
    const ready = (npc.relatedTroubleIds ?? []).some((id) => ACTIVE_TROUBLE_STATES.has(troubleStatus(troubleStates, id)));
    if (ready) transitionLife(engine, npc, state, "present", time, "related-trouble-activated");
  } else if (state.presence === "sealed") {
    const ready = Boolean(worldFlags?.colossusAwake) || failureLike(troubleStatus(troubleStates, "T18"));
    if (ready) transitionLife(engine, npc, state, "present", time, "seal-broken");
  } else if (state.presence === "missing" && state.lifeStatus === "missing") {
    const rescued = (npc.relatedTroubleIds ?? []).some((id) => troubleStatus(troubleStates, id) === "resolved");
    if (rescued) transitionLife(engine, npc, state, "present", time, "autonomous-rescue", { lifeStatus: "injured" });
  }
}

function settleLocalTravel(engine, state, time) {
  const travel = state.localTravel;
  if (!travel || travel.arriveAt > time.absoluteHour + 1e-9) return;
  state.position = { hubId: travel.hubId, facilityId: travel.toFacilityId };
  state.location = travel.hubId;
  state.localTravel = null;
  state.presence = "present";
  state.localMovementCount += 1;
  engine.localMovementEvents.push({
    npcId: state.id,
    scope: "facility",
    routeId: travel.routeId,
    hubId: travel.hubId,
    fromFacilityId: travel.fromFacilityId,
    toFacilityId: travel.toFacilityId,
    departedAt: travel.departedAt,
    arrivedAt: travel.arriveAt,
    durationHours: travel.arriveAt - travel.departedAt,
  });
}

function beliefMatchesInterest(state, belief) {
  if (belief.troubleId && state.interestTroubleIds.includes(belief.troubleId)) return true;
  const text = String(belief.text ?? "");
  return state.interests.some((interest) => String(interest).length >= 2 && text.includes(String(interest)));
}

function publishRumor(engine, hubId, belief, availableAt, sourceNpcId, carrierType) {
  const pool = engine.hubRumors[hubId];
  if (!pool || !belief || belief.kind === "interest" || belief.secret) return;
  const previous = pool.get(belief.factId);
  const candidate = {
    factId: belief.factId,
    belief: { ...belief },
    propagationAt: availableAt,
    sourceNpcId,
    sourceEventId: belief.provenanceEventId,
    carrierType,
  };
  if (!previous || availableAt < previous.propagationAt || belief.confidence > previous.belief.confidence) pool.set(belief.factId, candidate);
}

function publishFacilityRumor(engine, facilityId, belief, availableAt, carrierType = "source-facility") {
  const pool = engine.facilityRumors[facilityId];
  if (!pool || !belief || belief.kind === "interest" || belief.secret) return;
  const previous = pool.get(belief.factId);
  const candidate = {
    factId: belief.factId,
    belief: { ...belief },
    propagationAt: availableAt,
    sourceNpcId: belief.sourceNpcId ?? null,
    sourceEventId: belief.provenanceEventId,
    carrierType,
  };
  if (!previous || availableAt < previous.propagationAt || belief.confidence > previous.belief.confidence) pool.set(belief.factId, candidate);
}

function publishCarrierRumors(engine, state, hubId, time) {
  Object.values(state.beliefs)
    .filter((belief) => belief.propagationAt <= time.absoluteHour)
    .filter((belief) => !belief.secret && belief.kind !== "interest")
    .sort((left, right) => Number(right.importance ?? 0) - Number(left.importance ?? 0) || right.learnedAt - left.learnedAt)
    .slice(0, 3)
    .forEach((belief) => publishRumor(engine, hubId, belief, time.absoluteHour + 4, state.id, "route-carrier"));
}

function syncLegacyTravel(engine, state, time) {
  if (state.travel) {
    state.presence = "traveling";
    return;
  }
  if (state.localTravel) return;
  if (state.lifeStatus === "dead") state.presence = "dead";
  else if (!INACTIVE_PRESENCES.has(state.presence)) {
    if (state.location !== state.position.hubId) {
      state.position = { hubId: state.location, facilityId: null };
      publishCarrierRumors(engine, state, state.location, time);
    }
    state.presence = "present";
  }
}

function sourceFacilityForTrouble(engine, trouble) {
  if (trouble.id === "T01") {
    const finnOrigin = engine.model.facilityById?.[engine.model.npcById?.NPC001?.initialFacilityId];
    if (finnOrigin) return finnOrigin;
  }
  for (const hubId of trouble.primaryLocations) {
    const related = (engine.model.facilitiesByHub?.[hubId] ?? [])
      .filter((facility) => facility.relatedTroubleIds.includes(trouble.id))
      .slice()
      .sort((left, right) => left.sourceOrder - right.sourceOrder || left.id.localeCompare(right.id, "en"));
    if (related[0]) return related[0];
  }
  const fallbackHub = trouble.primaryLocations[0];
  return (engine.model.facilitiesByHub?.[fallbackHub] ?? [])
    .slice()
    .sort((left, right) => left.sourceOrder - right.sourceOrder || left.id.localeCompare(right.id, "en"))[0] ?? null;
}

function seedTroubleSources(engine, time, troubleStates) {
  for (const trouble of engine.model.troubles) {
    const status = troubleStatus(troubleStates, trouble.id);
    if (!ACTIVE_TROUBLE_STATES.has(status) || status === "scheduled") continue;
    const factId = `trouble:${trouble.id}:${status}`;
    if (engine.seededTroubleFacts.has(factId)) continue;
    const facility = sourceFacilityForTrouble(engine, trouble);
    if (!facility) continue;
    engine.seededTroubleFacts.add(factId);
    const importance = status === "failed" ? 1 : status === "critical" ? 0.92 : status === "active" ? 0.68 : 0.55;
    const availableAt = time.absoluteHour + 4;
    const sourceEvent = addKnowledgeEvent(engine, {
      type: "rumor-source",
      npcId: null,
      factId,
      troubleId: trouble.id,
      troubleStatus: status,
      learnedAt: time.absoluteHour,
      propagationAt: availableAt,
      sourceType: "world-source",
      sourceNpcId: null,
      sourceEventId: null,
      importance,
      confidence: 1,
      hopCount: 0,
      path: [`facility:${facility.id}`],
      location: { hubId: facility.hub, facilityId: facility.id },
    });
    publishFacilityRumor(engine, facility.id, {
      factId,
      kind: "trouble",
      text: `${trouble.id}:${status}`,
      troubleId: trouble.id,
      troubleIds: [trouble.id],
      troubleStatus: status,
      confidence: 1,
      importance,
      secret: false,
      learnedAt: time.absoluteHour,
      propagationAt: availableAt,
      sourceType: "world-source",
      sourceNpcId: null,
      provenanceEventId: sourceEvent.id,
      hopCount: 0,
      path: [...sourceEvent.path],
    }, availableAt);
  }
}

function pickupFacilityRumors(engine, time) {
  for (const npc of sortedNpcs(engine.model)) {
    const state = engine.npcStates[npc.id];
    if (state.presence !== "present" || state.lifeStatus === "dead" || !state.position.facilityId) continue;
    const pool = engine.facilityRumors[state.position.facilityId];
    if (!pool) continue;
    const candidate = [...pool.values()]
      .filter((rumor) => rumor.propagationAt <= time.absoluteHour)
      .filter((rumor) => !state.beliefs[rumor.factId])
      .filter((rumor) => beliefMatchesInterest(state, rumor.belief))
      .sort((left, right) => Number(right.belief.importance ?? 0) - Number(left.belief.importance ?? 0) || left.propagationAt - right.propagationAt || left.factId.localeCompare(right.factId, "en"))[0];
    if (!candidate) continue;
    const metadata = propagationMetadata(candidate.belief, npc.id);
    const added = addBelief(engine, state, {
      ...candidate.belief,
      confidence: round(candidate.belief.confidence * 0.92),
      learnedAt: time.absoluteHour,
      propagationAt: time.absoluteHour + 4,
      sourceType: "facility-source",
      sourceNpcId: null,
      ...metadata,
    }, {
      type: "source-pickup",
      npcId: npc.id,
      factId: candidate.factId,
      learnedAt: time.absoluteHour,
      propagationAt: time.absoluteHour + 4,
      sourceType: "facility-source",
      sourceNpcId: null,
      sourceEventId: candidate.sourceEventId,
      sourceLearnedAt: candidate.belief.learnedAt,
      troubleId: candidate.belief.troubleId ?? null,
      troubleStatus: candidate.belief.troubleStatus ?? null,
      carrierType: candidate.carrierType,
      location: { ...state.position },
      ...metadata,
    });
    if (added) publishRumor(engine, state.position.hubId, state.beliefs[candidate.factId], time.absoluteHour + 4, npc.id, "facility-to-hub");
  }
}

function pickupHubRumors(engine, time) {
  for (const npc of sortedNpcs(engine.model)) {
    const state = engine.npcStates[npc.id];
    if (state.presence !== "present" || state.lifeStatus === "dead") continue;
    const pool = engine.hubRumors[state.position.hubId];
    if (!pool) continue;
    const candidate = [...pool.values()]
      .filter((rumor) => rumor.propagationAt <= time.absoluteHour)
      .filter((rumor) => !state.beliefs[rumor.factId])
      .filter((rumor) => beliefMatchesInterest(state, rumor.belief))
      .sort((left, right) => Number(right.belief.importance ?? 0) - Number(left.belief.importance ?? 0) || left.propagationAt - right.propagationAt || left.factId.localeCompare(right.factId, "en"))[0];
    if (!candidate) continue;
    const metadata = propagationMetadata(candidate.belief, npc.id);
    const added = addBelief(engine, state, {
      ...candidate.belief,
      confidence: round(candidate.belief.confidence * 0.78),
      learnedAt: time.absoluteHour,
      propagationAt: time.absoluteHour + 4,
      sourceType: "rumor",
      sourceNpcId: candidate.sourceNpcId,
      ...metadata,
    }, {
      type: "rumor-pickup",
      npcId: npc.id,
      factId: candidate.factId,
      learnedAt: time.absoluteHour,
      propagationAt: time.absoluteHour + 4,
      sourceType: "rumor",
      sourceNpcId: candidate.sourceNpcId,
      sourceEventId: candidate.sourceEventId,
      sourceLearnedAt: candidate.belief.learnedAt,
      troubleId: candidate.belief.troubleId ?? null,
      troubleStatus: candidate.belief.troubleStatus ?? null,
      carrierType: candidate.carrierType,
      location: { ...state.position },
      ...metadata,
    });
    if (added) publishRumor(engine, state.position.hubId, state.beliefs[candidate.factId], time.absoluteHour + 4, npc.id, "hub-rumor");
  }
}

function conversationParticipantsAtFacility(engine) {
  const groups = new Map();
  for (const npc of sortedNpcs(engine.model)) {
    const state = engine.npcStates[npc.id];
    if (!isNpcLifeEligible(state) || state.presence !== 'present' || state.travel || state.localTravel) continue;
    const hubId = state.position?.hubId;
    const facilityId = state.position?.facilityId;
    if (!hubId || !facilityId) continue;
    const key = `facility:${hubId}:${facilityId}`;
    if (!groups.has(key)) groups.set(key, { key, contextType: 'facility', participants: [], location: { hubId, facilityId } });
    groups.get(key).participants.push(npc.id);
  }
  return [...groups.values()].filter((group) => group.participants.length >= 2);
}

function mobilityTravel(state) {
  return state?.travel ?? state?.localTravel ?? null;
}

function activeSharedTravelContexts(engine, time) {
  const states = sortedNpcs(engine.model)
    .map((npc) => [npc.id, engine.npcStates[npc.id]])
    .filter(([, state]) => isNpcLifeEligible(state) && mobilityTravel(state));
  const contexts = [];
  const groupedVehicles = new Map();
  for (const [npcId, state] of states) {
    const travel = mobilityTravel(state);
    const sharedId = travel?.vehicleId ?? travel?.transportUnitId ?? travel?.contactGroupId ?? null;
    if (!sharedId) continue;
    const key = `vehicle:${sharedId}`;
    if (!groupedVehicles.has(key)) groupedVehicles.set(key, {
      key,
      contextType: 'vehicle',
      participants: [],
      contactAt: time.absoluteHour,
      routeSegment: { routeId: travel.routeId ?? null, vehicleId: sharedId },
    });
    groupedVehicles.get(key).participants.push(npcId);
  }
  contexts.push(...[...groupedVehicles.values()].filter((entry) => entry.participants.length >= 2));

  for (let leftIndex = 0; leftIndex < states.length; leftIndex += 1) {
    const [leftId, leftState] = states[leftIndex];
    const left = mobilityTravel(leftState);
    if (!left?.routeId) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < states.length; rightIndex += 1) {
      const [rightId, rightState] = states[rightIndex];
      const right = mobilityTravel(rightState);
      if (!right?.routeId || left.routeId !== right.routeId) continue;
      const sameDirection = (left.from ?? left.fromFacilityId) === (right.from ?? right.fromFacilityId)
        && (left.to ?? left.toFacilityId) === (right.to ?? right.toFacilityId);
      if (!sameDirection) continue;
      if (Math.abs(Number(left.departedAt ?? 0) - Number(right.departedAt ?? 0)) > 0.1) continue;
      if ([left.vehicleId, left.transportUnitId, left.contactGroupId].some(Boolean)
        || [right.vehicleId, right.transportUnitId, right.contactGroupId].some(Boolean)) continue;
      contexts.push({
        key: `shared-travel:${left.routeId}:${[leftId, rightId].sort().join(':')}:${Math.max(Number(left.departedAt ?? 0), Number(right.departedAt ?? 0)).toFixed(4)}`,
        contextType: left.hubId && right.hubId ? 'shared-walk' : 'shared-travel',
        participants: [leftId, rightId],
        contactAt: Math.max(Number(left.departedAt ?? 0), Number(right.departedAt ?? 0)),
        routeSegment: { routeId: left.routeId, from: left.from ?? left.fromFacilityId ?? null, to: left.to ?? left.toFacilityId ?? null },
      });
    }
  }
  return contexts;
}

function crossingHour(left, right) {
  const leftDuration = Number(left.arriveAt) - Number(left.departedAt);
  const rightDuration = Number(right.arriveAt) - Number(right.departedAt);
  if (!(leftDuration > 0) || !(rightDuration > 0)) return null;
  const value = (1 + Number(left.departedAt) / leftDuration + Number(right.departedAt) / rightDuration)
    / (1 / leftDuration + 1 / rightDuration);
  const overlapStart = Math.max(Number(left.departedAt), Number(right.departedAt));
  const overlapEnd = Math.min(Number(left.arriveAt), Number(right.arriveAt));
  if (value < overlapStart - 1e-9 || value > overlapEnd + 1e-9) return null;
  return value;
}

function departureContactContexts(engine, time) {
  const contexts = [];
  const previousSweep = Number.isFinite(engine.lastInteractionSweepAt) ? engine.lastInteractionSweepAt : Number.NEGATIVE_INFINITY;
  const departures = array(engine.departures)
    .filter((entry) => entry?.npcId && entry?.routeId && Number.isFinite(Number(entry.departedAt)) && Number.isFinite(Number(entry.arriveAt)));
  for (let leftIndex = 0; leftIndex < departures.length; leftIndex += 1) {
    const left = departures[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < departures.length; rightIndex += 1) {
      const right = departures[rightIndex];
      if (left.npcId === right.npcId || left.routeId !== right.routeId) continue;
      let contactAt = null;
      let contextType = null;
      if (left.from === right.from && left.to === right.to && Math.abs(Number(left.departedAt) - Number(right.departedAt)) <= 0.1) {
        contactAt = Math.max(Number(left.departedAt), Number(right.departedAt));
        contextType = 'shared-travel';
      } else if (left.from === right.to && left.to === right.from) {
        contactAt = crossingHour(left, right);
        contextType = 'passing-contact';
      }
      if (!Number.isFinite(contactAt)) continue;
      if (contactAt < previousSweep - 1e-9 || contactAt > Number(time.absoluteHour) + 1e-9) continue;
      const leftState = engine.npcStates[left.npcId];
      const rightState = engine.npcStates[right.npcId];
      if (!isNpcLifeEligible(leftState) || !isNpcLifeEligible(rightState)) continue;
      contexts.push({
        key: `${contextType}:${left.routeId}:${[left.npcId, right.npcId].sort().join(':')}:${contactAt.toFixed(6)}`,
        contextType,
        participants: [left.npcId, right.npcId],
        contactAt,
        routeSegment: { routeId: left.routeId, from: left.from, to: left.to, crossingAt: contextType === 'passing-contact' ? contactAt : null },
      });
    }
  }
  return contexts;
}

function secretDisclosureReason(sourceState, recipientId, recipientState, belief) {
  const policy = belief?.disclosure ?? {};
  const explicitReason = String(policy.reason ?? belief?.disclosureReason ?? '').trim();
  const authorized = new Set(unique([
    ...array(policy.authorizedListenerIds),
    ...array(belief?.authorizedListenerIds),
  ]));
  if (authorized.has(recipientId)) return explicitReason || 'explicit-listener-authority';

  const trusted = new Set(unique([
    ...array(policy.trustedNpcIds),
    ...array(belief?.trustedNpcIds),
  ]));
  if (trusted.has(recipientId)) return explicitReason || 'trusted-listener';

  const workRelated = new Set(unique([
    ...array(policy.workRelationshipNpcIds),
    ...array(belief?.workRelationshipNpcIds),
  ]));
  if (workRelated.has(recipientId)) return explicitReason || 'work-relationship';

  const sharedObjective = new Set(unique([
    ...array(policy.sharedObjectiveNpcIds),
    ...array(belief?.sharedObjectiveNpcIds),
  ]));
  if (sharedObjective.has(recipientId)) return explicitReason || 'shared-objective';

  const troubleId = belief?.troubleId ?? null;
  const sourceInterested = troubleId && array(sourceState?.interestTroubleIds).includes(troubleId);
  const recipientInterested = troubleId && array(recipientState?.interestTroubleIds).includes(troubleId);
  const sharedTroubleContext = Boolean(sourceInterested && recipientInterested);
  const urgent = policy.urgency === true || belief?.urgency === true;
  if (urgent && sharedTroubleContext) return explicitReason || 'urgent-shared-trouble';
  if (explicitReason && sharedTroubleContext) return explicitReason;
  return null;
}

function willingToSpeak(engine, sourceId, sourceState, belief, time, context) {
  if (belief.secret) return true;
  const importance = Number(belief.importance ?? 0);
  const recent = Number.isFinite(Number(belief.learnedAt)) && Number(time.absoluteHour) - Number(belief.learnedAt) <= 8;
  const authoredDuty = Array.isArray(belief.aftermathPlans) && belief.aftermathPlans.length > 0;
  if (importance >= RUMOR_IMPORTANCE_THRESHOLD || authoredDuty || (recent && importance >= 0.6)) return true;
  const socialNeed = Number(sourceState.needs?.social ?? 0) / 100;
  const goal = String(sourceState.currentGoal ?? '');
  const goalBias = /social|work|aftermath|respond|assist|warn/u.test(goal) ? 0.18 : 0;
  const threshold = Math.min(0.65, 0.08 + socialNeed * 0.28 + importance * 0.22 + goalBias);
  return npcRandom(engine.seed, sourceId, time.day, time.phaseIndex, `speak:${context.key}:${belief.factId}`) < threshold;
}

function utteranceCandidates(engine, context, time) {
  const candidates = [];
  for (const sourceId of context.participants) {
    const sourceState = engine.npcStates[sourceId];
    if (!isNpcLifeEligible(sourceState)) continue;
    for (const belief of Object.values(sourceState.beliefs ?? {})) {
      if (belief.kind === 'interest' || Number(belief.propagationAt ?? Infinity) > Number(time.absoluteHour)) continue;
      const possible = context.participants
        .filter((recipientId) => recipientId !== sourceId)
        .filter((recipientId) => {
          const recipient = engine.npcStates[recipientId];
          return isNpcLifeEligible(recipient)
            && !recipient.beliefs?.[belief.factId]
            && beliefMatchesInterest(recipient, belief)
            && (!belief.secret || Boolean(secretDisclosureReason(sourceState, recipientId, recipient, belief)));
        });
      if (!possible.length || !willingToSpeak(engine, sourceId, sourceState, belief, time, context)) continue;
      let audible = context.participants.filter((recipientId) => recipientId !== sourceId);
      if (belief.secret) {
        audible = possible.slice().sort((left, right) => left.localeCompare(right, 'en')).slice(0, 1);
      }
      const accepted = audible.filter((recipientId) => possible.includes(recipientId));
      if (!accepted.length) continue;
      candidates.push({
        sourceId,
        sourceState,
        belief,
        audible,
        accepted,
        recent: Number.isFinite(Number(belief.learnedAt)) && Number(time.absoluteHour) - Number(belief.learnedAt) <= 8 ? 1 : 0,
        authoredDuty: Array.isArray(belief.aftermathPlans) && belief.aftermathPlans.length ? 1 : 0,
      });
    }
  }
  candidates.sort((left, right) =>
    right.authoredDuty - left.authoredDuty
    || right.recent - left.recent
    || Number(right.belief.importance ?? 0) - Number(left.belief.importance ?? 0)
    || Number(right.belief.learnedAt ?? -Infinity) - Number(left.belief.learnedAt ?? -Infinity)
    || npcRandom(engine.seed, left.sourceId, time.day, time.phaseIndex, `topic-order:${context.key}:${left.belief.factId}`)
      - npcRandom(engine.seed, right.sourceId, time.day, time.phaseIndex, `topic-order:${context.key}:${right.belief.factId}`)
    || left.sourceId.localeCompare(right.sourceId, 'en'));
  return candidates;
}

function applyConversationContext(engine, context, time) {
  const maxUtterances = ['facility', 'vehicle'].includes(context.contextType) ? 2 : 1;
  const selected = [];
  const usedSpeakers = new Set();
  for (const candidate of utteranceCandidates(engine, context, time)) {
    if (usedSpeakers.has(candidate.sourceId)) continue;
    selected.push(candidate);
    usedSpeakers.add(candidate.sourceId);
    if (selected.length >= maxUtterances) break;
  }
  for (const candidate of selected) {
    const sourceBelief = candidate.belief;
    const interaction = recordWorldInteractionEvent(engine, {
      type: 'conversation',
      contextType: context.contextType,
      speakerId: candidate.sourceId,
      speakerNpcId: candidate.sourceId,
      listenerIds: candidate.audible,
      audibleListenerIds: candidate.audible,
      acceptedListenerIds: candidate.accepted,
      privacy: sourceBelief.secret ? 'private' : 'public',
      factId: sourceBelief.factId,
      topic: sourceBelief.text ?? null,
      startedAt: Number(context.contactAt ?? time.absoluteHour),
      day: time.day,
      phaseIndex: time.phaseIndex,
      location: context.location ?? null,
      routeSegment: context.routeSegment ?? null,
      provenance: {
        sourceKnowledgeEventId: sourceBelief.provenanceEventId ?? null,
        sourceLearnedAt: sourceBelief.learnedAt,
        sourceType: sourceBelief.sourceType ?? null,
      },
      dedupeKey: `${context.key}|${candidate.sourceId}|${sourceBelief.factId}`,
    });
    if (!interaction) continue;
    for (const recipientId of candidate.accepted) {
      const recipientState = engine.npcStates[recipientId];
      const metadata = propagationMetadata(sourceBelief, recipientId);
      const added = addBelief(engine, recipientState, {
        ...sourceBelief,
        confidence: round(Number(sourceBelief.confidence ?? 1) * (context.contextType === 'passing-contact' ? 0.78 : 0.86)),
        learnedAt: Number(context.contactAt ?? time.absoluteHour),
        propagationAt: Number(context.contactAt ?? time.absoluteHour) + 4,
        sourceType: 'npc',
        sourceNpcId: candidate.sourceId,
        interactionEventId: interaction.id,
        interactionContextType: context.contextType,
        ...metadata,
      }, {
        type: 'share',
        npcId: recipientId,
        factId: sourceBelief.factId,
        learnedAt: Number(context.contactAt ?? time.absoluteHour),
        sourceType: 'npc',
        sourceNpcId: candidate.sourceId,
        sourceEventId: sourceBelief.provenanceEventId,
        sourceLearnedAt: sourceBelief.learnedAt,
        troubleId: sourceBelief.troubleId ?? null,
        troubleStatus: sourceBelief.troubleStatus ?? null,
        propagationAt: Number(context.contactAt ?? time.absoluteHour) + 4,
        location: context.location ?? { ...recipientState.position },
        routeSegment: context.routeSegment ?? null,
        interactionEventId: interaction.id,
        interactionContextType: context.contextType,
        ...metadata,
      });
      if (added) {
        publishRumor(engine, recipientState.position?.hubId, recipientState.beliefs[sourceBelief.factId], Number(context.contactAt ?? time.absoluteHour) + 4, recipientId, `${context.contextType}-conversation`);
      }
    }
  }
}

export function processNpcLifeInteractions(engine, time) {
  ensureInteractionState(engine);
  const contexts = [
    ...conversationParticipantsAtFacility(engine),
    ...activeSharedTravelContexts(engine, time),
    ...departureContactContexts(engine, time),
  ];
  const uniqueContexts = [...new Map(contexts.map((context) => [context.key, context])).values()]
    .sort((left, right) => left.key.localeCompare(right.key, 'en'));
  for (const context of uniqueContexts) applyConversationContext(engine, context, time);
  engine.lastInteractionSweepAt = Math.max(Number(engine.lastInteractionSweepAt ?? Number.NEGATIVE_INFINITY), Number(time.absoluteHour));
  return engine.interactionEvents;
}

function shareKnowledge(engine, time) {
  return processNpcLifeInteractions(engine, time);
}

function updateExposure(engine, npc, state, time, troubleStates) {
  if (!isNpcLifeEligible(state)) return;
  const local = engine.model.troubles.filter((trouble) =>
    trouble.primaryLocations.includes(state.position.hubId) &&
    ["active", "critical", "failed"].includes(troubleStatus(troubleStates, trouble.id)) &&
    failureAftermathActive(troubleStates[trouble.id], time)
  );
  const danger = local.reduce((sum, trouble) => {
    const status = troubleStatus(troubleStates, trouble.id);
    return sum + (status === "critical" ? 3 : status === "failed" ? 2 : 1);
  }, 0);
  state.needs.stress = clamp(state.needs.stress + danger * 1.25 - (danger === 0 ? 1.2 : 0));
  state.needs.hunger = clamp(state.needs.hunger + 7);
  state.needs.fatigue = clamp(state.needs.fatigue + (state.presence === "traveling" ? 9 : 6));
  state.needs.social = clamp(state.needs.social + 4);
  if (danger >= 3 && npcRandom(engine.seed, npc.id, time.day, time.phaseIndex, "crisis-injury") < Math.min(0.08, danger * 0.012)) {
    const damage = 4 + danger;
    state.health = clamp(state.health - damage);
    if (state.health < 50 && state.lifeStatus === "alive") {
      state.lifeStatus = "injured";
      state.conditions = unique([...state.conditions, "crisis-injury"]);
      engine.lifeEvents.push({
        id: `L${String(engine.lifeEvents.length + 1).padStart(6, "0")}`,
        npcId: npc.id,
        type: "injury",
        fromPresence: state.presence,
        toPresence: state.presence,
        fromLifeStatus: "alive",
        toLifeStatus: "injured",
        from: state.presence,
        to: "injured",
        vitalState: "injured",
        presence: state.presence,
        day: time.day,
        phaseIndex: time.phaseIndex,
        absoluteHour: time.absoluteHour,
        location: { ...state.position },
        locationId: state.position.facilityId ?? state.position.hubId,
        cause: "crisis-exposure",
        troubleIds: local.map((trouble) => trouble.id),
      });
    }
  }
  const t01Status = troubleStatus(troubleStates, "T01");
  const rescueKey = `${npc.id}:t01-rescue-exposure`;
  if (
    npc.id !== "NPC001" &&
    (npc.relatedTroubleIds ?? []).includes("T01") &&
    failureLike(t01Status) &&
    ["田園の村", "森"].includes(state.position.hubId) &&
    !engine.appliedFates.has(rescueKey)
  ) {
    engine.appliedFates.add(rescueKey);
    const mitigation = Number(troubleStates.T01?.casualtyMitigation ?? 0);
    const risk = Math.max(0.18, 0.72 - Math.min(0.35, mitigation * 0.08));
    const roll = npcRandom(engine.seed, npc.id, time.day, time.phaseIndex, "t01-rescue-casualty");
    if (roll < risk * 0.16) {
      transitionLife(engine, npc, state, "missing", time, "t01-rescue-exposure", { relatedTroubleIds: ["T01"] });
    } else if (roll < risk) {
      state.lifeStatus = "injured";
      state.health = Math.min(state.health, 24);
      state.conditions = unique([...state.conditions, "severe-rescue-injury"]);
      engine.lifeEvents.push({
        id: `L${String(engine.lifeEvents.length + 1).padStart(6, "0")}`,
        npcId: npc.id,
        type: "injury",
        fromPresence: state.presence,
        toPresence: state.presence,
        fromLifeStatus: "alive",
        toLifeStatus: "injured",
        from: "alive",
        to: "injured",
        vitalState: "injured",
        presence: state.presence,
        day: time.day,
        phaseIndex: time.phaseIndex,
        absoluteHour: time.absoluteHour,
        location: { ...state.position },
        locationId: state.position.facilityId ?? state.position.hubId,
        cause: "t01-rescue-exposure",
        relatedTroubleIds: ["T01"],
      });
    }
  }
}

function updateWorldRevision(engine, troubleStates) {
  let changed = false;
  for (const trouble of engine.model.troubles) {
    const status = troubleStatus(troubleStates, trouble.id);
    if (engine.lastTroubleStatuses[trouble.id] !== status) {
      engine.lastTroubleStatuses[trouble.id] = status;
      changed = true;
    }
  }
  if (changed) engine.worldRevision += 1;
}

export function prepareNpcLifeTick(engine, { time, troubleStates, worldFlags } = {}) {
  ensureInteractionState(engine);
  updateWorldRevision(engine, troubleStates);
  for (const npc of sortedNpcs(engine.model)) {
    const state = engine.npcStates[npc.id];
    settleLocalTravel(engine, state, time);
    syncLegacyTravel(engine, state, time);
    maybeActivate(engine, npc, state, time, troubleStates, worldFlags);
  }
  for (const npc of sortedNpcs(engine.model)) {
    evaluateFate(engine, npc, engine.npcStates[npc.id], time, troubleStates);
  }
  seedTroubleSources(engine, time, troubleStates);
  for (const npc of sortedNpcs(engine.model)) {
    updateExposure(engine, npc, engine.npcStates[npc.id], time, troubleStates);
  }
  pickupFacilityRumors(engine, time);
  pickupHubRumors(engine, time);
  shareKnowledge(engine, time);
}

function routeAllowed(route, from, to, npc, flags) {
  if (route.gate === "elf-access") {
    if (from === "エルフの隠れ里" || to !== "エルフの隠れ里") return true;
    return Boolean(flags?.worldTreeFallen || flags?.elfApproval || npc.home === "エルフの隠れ里");
  }
  if (route.gate === "blackridge-forest-access") {
    return Boolean(flags?.worldTreeFallen || flags?.blackridgePermit || ["黒嶺連合領", "エルフの隠れ里"].includes(npc.home));
  }
  return true;
}

function firstRouteToward(model, npc, fromHub, targetHub, flags) {
  if (!fromHub || !targetHub || fromHub === targetHub) return null;
  const queue = [{ hub: fromHub, cost: 0, first: null }];
  const best = new Map([[fromHub, 0]]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost || a.hub.localeCompare(b.hub, "ja"));
    const current = queue.shift();
    if (current.cost !== best.get(current.hub)) continue;
    if (current.hub === targetHub) return current.first;
    for (const route of model.routes) {
      const directions = [{ from: route.from, to: route.to }];
      if (route.bidirectional) directions.push({ from: route.to, to: route.from });
      for (const direction of directions) {
        if (direction.from !== current.hub || !routeAllowed(route, direction.from, direction.to, npc, flags)) continue;
        const nextCost = current.cost + route.hours;
        if (nextCost >= (best.get(direction.to) ?? Number.POSITIVE_INFINITY)) continue;
        best.set(direction.to, nextCost);
        queue.push({
          hub: direction.to,
          cost: nextCost,
          first: current.first ?? { route, from: direction.from, to: direction.to },
        });
      }
    }
  }
  return null;
}

function latestKnownTroubles(state) {
  const byId = new Map();
  for (const belief of Object.values(state.beliefs)) {
    if (belief.kind !== "trouble" || !belief.troubleId) continue;
    const previous = byId.get(belief.troubleId);
    if (!previous || belief.learnedAt > previous.learnedAt) byId.set(belief.troubleId, belief);
  }
  return [...byId.values()];
}

function safeHub(engine, state, known) {
  const dangerous = new Set(known.filter((belief) => failureLike(belief.troubleStatus)).flatMap((belief) => engine.model.troubleById[belief.troubleId]?.primaryLocations ?? []));
  if (!dangerous.has(state.home)) return state.home;
  return engine.model.locations.find((hub) => !dangerous.has(hub)) ?? state.home;
}

function routineTarget(engine, npc, state, time) {
  const candidates = candidateFacilities(engine.model, npc, state.position.hubId);
  if (!candidates.length) return null;
  const phaseName = PHASE_NAMES[time.phaseIndex] ?? "morning";
  const activity = String(npc.routine?.[phaseName] ?? "");
  const exact = (engine.model.facilitiesByHub?.[state.position.hubId] ?? [])
    .find((facility) => activity.includes(facility.name) || (facility.name.length >= 3 && facility.name.includes(activity)));
  if (exact) return exact.id;
  const offset = hash32(`${npc.id}:${time.day}`) % candidates.length;
  let target = candidates[(offset + time.phaseIndex) % candidates.length];
  if (target === state.position.facilityId && candidates.length > 1) target = candidates[(offset + time.phaseIndex + 1) % candidates.length];
  return target;
}

function npcMatchesAftermathPlan(npc, plan) {
  const explicitIds = plan?.npcIds ?? [];
  if (explicitIds.length && !explicitIds.includes(npc.id)) return false;
  if (plan?.relatedTroubleId && !(npc.relatedTroubleIds ?? []).includes(plan.relatedTroubleId)) return false;
  if (plan?.npcRolePattern) {
    try {
      if (!new RegExp(plan.npcRolePattern, "u").test(`${npc.occupation ?? ""} ${npc.primaryGoal ?? ""}`)) return false;
    } catch {
      return false;
    }
  }
  return explicitIds.length > 0 || Boolean(plan?.relatedTroubleId) || Boolean(plan?.npcRolePattern);
}

function authoredAftermathDecision(engine, npc, state, time) {
  state.completedAftermathPlanIds = Array.isArray(state.completedAftermathPlanIds)
    ? [...new Set(state.completedAftermathPlanIds)]
    : [];
  const completed = new Set(state.completedAftermathPlanIds);
  const candidates = [];
  for (const belief of Object.values(state.beliefs ?? {})) {
    if (belief?.kind !== "trouble" || belief.troubleStatus !== "resolved") continue;
    if (Number(belief.learnedAt ?? Infinity) > time.absoluteHour) continue;
    for (const plan of belief.aftermathPlans ?? []) {
      if (!plan?.id || completed.has(plan.id) || !npcMatchesAftermathPlan(npc, plan)) continue;
      const availableAt = Number(belief.learnedAt ?? 0) + Math.max(0, Number(plan.delayHours ?? 0));
      const expiresAt = Number.isFinite(Number(plan.expiresAfterHours))
        ? availableAt + Math.max(1, Number(plan.expiresAfterHours))
        : Number.POSITIVE_INFINITY;
      if (time.absoluteHour < availableAt || time.absoluteHour > expiresAt) continue;
      candidates.push({ belief, plan, availableAt });
    }
  }
  candidates.sort((left, right) => Number(right.belief.importance ?? 0) - Number(left.belief.importance ?? 0)
    || left.availableAt - right.availableAt
    || left.plan.id.localeCompare(right.plan.id, "en"));
  const selected = candidates[0];
  if (!selected) return null;
  const { belief, plan } = selected;
  const targetFacilityId = plan.targetFacilityId ?? null;
  const targetHub = plan.targetHub ?? facilityHub(engine.model, targetFacilityId, null);
  const base = {
    goal: `aftermath:${plan.goal ?? plan.id}`,
    troubleId: belief.troubleId ?? plan.relatedTroubleId ?? null,
    usedFactIds: [belief.factId],
    aftermathPlanId: plan.id,
    statusText: plan.statusText ?? null,
    reason: plan.reason ?? "authored-resolution-aftermath",
  };
  if (targetHub && state.position.hubId !== targetHub) {
    return { ...base, action: "travel", targetHub };
  }
  if (targetFacilityId && state.position.facilityId !== targetFacilityId) {
    return { ...base, action: "local-travel", targetFacilityId };
  }
  return { ...base, action: plan.action ?? "complete-aftermath-duty" };
}

function chooseDecision(engine, npc, state, time, troubleStates) {
  const known = latestKnownTroubles(state)
    .filter((belief) => ["active", "critical", "failed"].includes(belief.troubleStatus))
    .sort((left, right) => {
      const priority = { failed: 3, critical: 2, active: 1 };
      return priority[right.troubleStatus] - priority[left.troubleStatus] || right.learnedAt - left.learnedAt || left.troubleId.localeCompare(right.troubleId, "en");
    });
  const anchorDay = fateAnchorDay(engine, npc);
  const destination = fateDestination(engine, npc, state);
  if (destination && fateUnresolved(npc, troubleStates) && time.day >= Math.max(1, anchorDay - 5)) {
    if (state.position.hubId !== destination) return { goal: "fate-route", action: "travel", targetHub: destination, reason: "source-fate-route" };
    return { goal: "fate-route", action: "hide", targetHub: destination, reason: "source-fate-destination" };
  }

  const localDanger = known.find((belief) =>
    failureLike(belief.troubleStatus) &&
    engine.model.troubleById[belief.troubleId]?.primaryLocations.includes(state.position.hubId) &&
    failureAftermathActive(troubleStates[belief.troubleId], time)
  );
  if (localDanger && state.needs.stress >= 45) {
    return { goal: "evacuate", action: "travel", targetHub: safeHub(engine, state, known), troubleId: localDanger.troubleId, usedFactIds: [localDanger.factId], reason: "known-local-crisis" };
  }

  if (state.health < 42 || state.needs.fatigue > 82) return { goal: "recover", action: "rest", reason: "health-or-fatigue" };
  if (state.needs.hunger > 72) return { goal: "eat", action: "eat", reason: "hunger" };

  const relevant = known.find((belief) =>
    belief.troubleStatus === "active" &&
    (npc.relatedTroubleIds ?? []).includes(belief.troubleId) &&
    time.absoluteHour - Number(state.lastCrisisActionAt[belief.troubleId] ?? Number.NEGATIVE_INFINITY) >= 24
  );
  if (relevant) {
    const trouble = engine.model.troubleById[relevant.troubleId];
    const atCrisis = trouble.primaryLocations.includes(state.position.hubId);
    if (!atCrisis) {
      const targetHub = trouble.primaryLocations
        .slice()
        .sort((left, right) => left.localeCompare(right, "ja"))[0];
      return { goal: `respond:${relevant.troubleId}`, action: "travel", targetHub, troubleId: relevant.troubleId, usedFactIds: [relevant.factId], reason: "knowledge-driven-response" };
    }
    let helpfulAction = "assist-crisis";
    if (/医師|軍医|薬|治療|救護/u.test(`${npc.occupation} ${npc.primaryGoal}`)) helpfulAction = "treat-casualties";
    else if (/失踪|行方不明|家出/u.test(trouble.category) || /見つけ|救出|捜索/u.test(npc.primaryGoal)) helpfulAction = "search-crisis";
    else if (relevant.troubleStatus === "critical" || state.needs.stress >= 55) helpfulAction = "evacuate-others";
    else if (state.knowledgeRevision > (state.planKnowledgeRevision ?? 0)) helpfulAction = "warn-crisis";
    return {
      goal: `${npc.disposition === "escalate" ? "exploit" : "assist"}:${relevant.troubleId}`,
      action: npc.disposition === "escalate" ? "escalate-crisis" : helpfulAction,
      troubleId: relevant.troubleId,
      usedFactIds: [relevant.factId],
      reason: "knowledge-driven-local-action",
    };
  }

  const aftermath = authoredAftermathDecision(engine, npc, state, time);
  if (aftermath) return aftermath;

  const targetFacilityId = routineTarget(engine, npc, state, time);
  if (targetFacilityId && targetFacilityId !== state.position.facilityId) {
    return { goal: "follow-routine", action: "local-travel", targetFacilityId, reason: "routine-schedule" };
  }
  const phaseName = PHASE_NAMES[time.phaseIndex] ?? "morning";
  if (phaseName === "night") return { goal: "rest", action: "rest", reason: "night-routine" };
  if (state.needs.social > 66) return { goal: "socialize", action: "socialize", reason: "social-need" };
  return { goal: "work", action: "work", reason: "routine-duty" };
}

function startLocalTravel(engine, state, targetFacilityId, time) {
  const fromFacilityId = state.position.facilityId;
  state.localTravel = {
    routeId: `LOCAL:${state.position.hubId}:${fromFacilityId ?? "@hub"}->${targetFacilityId}`,
    hubId: state.position.hubId,
    fromFacilityId,
    toFacilityId: targetFacilityId,
    departedAt: time.absoluteHour,
    arriveAt: time.absoluteHour + LOCAL_TRAVEL_HOURS,
  };
  state.presence = "traveling";
}

function startIntercityTravel(engine, npc, state, targetHub, time, worldFlags) {
  const step = firstRouteToward(engine.model, npc, state.position.hubId, targetHub, worldFlags);
  if (!step) return false;
  state.travel = {
    routeId: step.route.id,
    from: step.from,
    to: step.to,
    departedAt: time.absoluteHour,
    arriveAt: time.absoluteHour + step.route.hours,
    target: targetHub,
  };
  state.presence = "traveling";
  state.position.facilityId = null;
  engine.departures.push({
    npcId: npc.id,
    routeId: step.route.id,
    from: step.from,
    to: step.to,
    departedAt: time.absoluteHour,
    arriveAt: time.absoluteHour + step.route.hours,
    source: "npc-life-engine",
  });
  return true;
}

function executeDecision(engine, npc, state, decision, time, worldFlags) {
  const crisisActions = [];
  let action = decision.action;
  if (action === "local-travel") {
    startLocalTravel(engine, state, decision.targetFacilityId, time);
  } else if (action === "travel") {
    if (decision.targetHub === state.position.hubId) action = "observe";
    else if (!startIntercityTravel(engine, npc, state, decision.targetHub, time, worldFlags)) action = "wait-no-route";
  } else if (action === "rest") {
    state.needs.fatigue = clamp(state.needs.fatigue - 38);
    state.needs.stress = clamp(state.needs.stress - 12);
    state.health = clamp(state.health + 5);
    if (state.lifeStatus === "injured" && state.health >= 60) state.lifeStatus = "alive";
  } else if (action === "eat") {
    state.needs.hunger = clamp(state.needs.hunger - 48);
    state.health = clamp(state.health + 1);
  } else if (action === "socialize") {
    state.needs.social = clamp(state.needs.social - 45);
    state.needs.stress = clamp(state.needs.stress - 5);
  } else if (action === "work") {
    state.needs.social = clamp(state.needs.social - 8);
    state.needs.fatigue = clamp(state.needs.fatigue + 4);
  } else if (action === "hide") {
    state.needs.stress = clamp(state.needs.stress - 3);
    state.needs.fatigue = clamp(state.needs.fatigue + 2);
  } else if (["assist-crisis", "warn-crisis", "search-crisis", "treat-casualties", "evacuate-others", "escalate-crisis"].includes(action)) {
    crisisActions.push({ npc, state, troubleId: decision.troubleId, action });
    state.lastCrisisActionAt[decision.troubleId] = time.absoluteHour;
    state.needs.stress = clamp(state.needs.stress + 2);
    if (action === "warn-crisis") {
      const belief = latestKnownTroubles(state).find((candidate) => candidate.troubleId === decision.troubleId);
      if (belief) publishRumor(engine, state.position.hubId, { ...belief, importance: Math.max(0.82, belief.importance ?? 0) }, time.absoluteHour + 4, npc.id, "warning-action");
    }
  }
  if (decision.aftermathPlanId
    && !["travel", "local-travel", "continue-travel", "wait-no-route"].includes(action)) {
    state.completedAftermathPlanIds = Array.isArray(state.completedAftermathPlanIds)
      ? [...new Set([...state.completedAftermathPlanIds, decision.aftermathPlanId])]
      : [decision.aftermathPlanId];
    state.needs.fatigue = clamp(state.needs.fatigue + 5);
    state.needs.stress = clamp(state.needs.stress - 2);
    if (decision.statusText) state.status = decision.statusText;
  }
  return { action, crisisActions };
}

function recordDecision(engine, npc, state, decision, actualAction, time, replanned) {
  engine.decisionEventSequence = Number(engine.decisionEventSequence ?? engine.decisionEvents.length) + 1;
  const id = `D${String(engine.decisionEventSequence).padStart(7, "0")}`;
  const event = {
    id,
    eventId: id,
    npcId: npc.id,
    tick: (time.day - 1) * 4 + time.phaseIndex,
    day: time.day,
    phaseIndex: time.phaseIndex,
    absoluteHour: time.absoluteHour,
    goal: state.currentGoal,
    goalId: state.currentGoal,
    currentGoal: state.currentGoal,
    action: actualAction,
    actionType: actualAction,
    reason: decision.reason,
    troubleId: decision.troubleId ?? null,
    aftermathPlanId: decision.aftermathPlanId ?? null,
    usedFactIds: [...(decision.usedFactIds ?? [])],
    targetHub: decision.targetHub ?? null,
    targetFacilityId: decision.targetFacilityId ?? null,
    position: { ...state.position },
    locationId: state.position.facilityId ?? state.position.hubId,
    lifeStatus: state.lifeStatus,
    vitalState: state.lifeStatus,
    presence: state.presence,
    replanned,
    knowledgeRevision: state.knowledgeRevision,
  };
  engine.decisionEvents.push(event);
  mixTraceFingerprint(engine, ["decision", event.npcId, event.day, event.phaseIndex, event.goal, event.action, event.reason, event.troubleId, event.aftermathPlanId, event.targetHub, event.targetFacilityId, event.usedFactIds.join(","), event.replanned]);
  state.lastDecisionAt = time.absoluteHour;
  state.activityTicks += 1;
  return event;
}

function recordTrace(engine, npc, state, time, decisionEvent = null) {
  const trace = {
    day: time.day,
    phaseIndex: time.phaseIndex,
    absoluteHour: time.absoluteHour,
    eligible: Boolean(decisionEvent),
    action: decisionEvent?.action ?? `inactive:${state.presence}`,
    goal: state.currentGoal,
    lifeStatus: state.lifeStatus,
    presence: state.presence,
    hubId: state.position.hubId,
    facilityId: state.position.facilityId,
    health: round(state.health, 2),
    hunger: round(state.needs.hunger, 2),
    fatigue: round(state.needs.fatigue, 2),
    stress: round(state.needs.stress, 2),
    beliefs: Object.keys(state.beliefs).length,
  };
  engine.npcTraces[npc.id].push(trace);
  mixTraceFingerprint(engine, ["trace", npc.id, trace.day, trace.phaseIndex, trace.eligible, trace.action, trace.goal, trace.lifeStatus, trace.presence, trace.hubId, trace.facilityId, trace.health, trace.hunger, trace.fatigue, trace.stress, trace.beliefs]);
}

function populationCounts(engine) {
  const counts = { alive: 0, injured: 0, dead: 0, missing: 0, departed: 0, sealed: 0, notYetPresent: 0, present: 0, traveling: 0 };
  for (const state of Object.values(engine.npcStates)) {
    if (state.lifeStatus === "dead") counts.dead += 1;
    else if (state.lifeStatus === "injured") counts.injured += 1;
    else if (state.lifeStatus === "missing") counts.missing += 1;
    else counts.alive += 1;
    if (state.presence === "departed") counts.departed += 1;
    else if (state.presence === "sealed") counts.sealed += 1;
    else if (state.presence === "not-yet-present") counts.notYetPresent += 1;
    else if (state.presence === "traveling") counts.traveling += 1;
    else if (state.presence === "present") counts.present += 1;
  }
  return counts;
}

function recordPopulation(engine, time) {
  engine.populationByTick.push({ day: time.day, phaseIndex: time.phaseIndex, absoluteHour: time.absoluteHour, ...populationCounts(engine) });
}

export function settleNpcLifeAtEnd(engine, { time } = {}) {
  const localMovementStart = engine.localMovementEvents.length;
  for (const npc of sortedNpcs(engine.model)) {
    const state = engine.npcStates[npc.id];
    settleLocalTravel(engine, state, time);
    syncLegacyTravel(engine, state, time);
    const trace = engine.npcTraces[npc.id]?.at(-1);
    if (!trace) continue;
    Object.assign(trace, {
      absoluteHour: time.absoluteHour,
      lifeStatus: state.lifeStatus,
      presence: state.presence,
      hubId: state.position.hubId,
      facilityId: state.position.facilityId,
      health: round(state.health, 2),
      hunger: round(state.needs.hunger, 2),
      fatigue: round(state.needs.fatigue, 2),
      stress: round(state.needs.stress, 2),
      beliefs: Object.keys(state.beliefs).length,
    });
    mixTraceFingerprint(engine, [
      "final-state",
      npc.id,
      trace.day,
      trace.phaseIndex,
      trace.lifeStatus,
      trace.presence,
      trace.hubId,
      trace.facilityId,
      trace.health,
      trace.hunger,
      trace.fatigue,
      trace.stress,
      trace.beliefs,
    ]);
  }
  const finalPopulation = { day: time.day, phaseIndex: time.phaseIndex, absoluteHour: time.absoluteHour, ...populationCounts(engine) };
  if (engine.populationByTick.length) engine.populationByTick[engine.populationByTick.length - 1] = finalPopulation;
  else engine.populationByTick.push(finalPopulation);
  return {
    localMovementsCompleted: engine.localMovementEvents.length - localMovementStart,
    population: finalPopulation,
  };
}

export function completeNpcLifeTick(engine, { time, troubleStates, worldFlags } = {}) {
  const crisisActions = [];
  for (const npc of sortedNpcs(engine.model)) {
    const state = engine.npcStates[npc.id];
    syncLegacyTravel(engine, state, time);
    if (!isNpcLifeEligible(state)) {
      recordTrace(engine, npc, state, time);
      continue;
    }
    state.eligibleTicks += 1;
    let decision;
    let actualAction;
    if (state.travel || state.localTravel) {
      decision = { goal: state.currentGoal || "travel", action: "continue-travel", reason: "in-transit" };
      actualAction = "continue-travel";
    } else {
      decision = chooseDecision(engine, npc, state, time, troubleStates);
      const replanned = state.currentGoal !== decision.goal || state.worldRevisionSeen !== engine.worldRevision || state.planKnowledgeRevision !== state.knowledgeRevision;
      if (replanned) {
        state.currentGoal = decision.goal;
        state.goalSince = time.absoluteHour;
        state.planRevision += 1;
        state.worldRevisionSeen = engine.worldRevision;
        state.planKnowledgeRevision = state.knowledgeRevision;
      }
      const executed = executeDecision(engine, npc, state, decision, time, worldFlags);
      actualAction = executed.action;
      crisisActions.push(...executed.crisisActions);
      const event = recordDecision(engine, npc, state, decision, actualAction, time, replanned);
      recordTrace(engine, npc, state, time, event);
      continue;
    }
    const event = recordDecision(engine, npc, state, decision, actualAction, time, false);
    recordTrace(engine, npc, state, time, event);
  }
  recordPopulation(engine, time);
  return crisisActions;
}

export function finalizeNpcLifeEngine(engine) {
  const states = Object.values(engine.npcStates);
  const eligibleTicks = states.reduce((sum, state) => sum + state.eligibleTicks, 0);
  const coverageByNpc = Object.fromEntries(sortedNpcs(engine.model).map((npc) => {
    const state = engine.npcStates[npc.id];
    const decisions = state.activityTicks;
    return [npc.id, {
      eligibleTicks: state.eligibleTicks,
      decisionTicks: decisions,
      coverage: state.eligibleTicks ? decisions / state.eligibleTicks : 1,
      traceTicks: engine.npcTraces[npc.id].length,
      localMovements: state.localMovementCount,
    }];
  }));
  return {
    npcTraces: engine.npcTraces,
    lifeEvents: engine.lifeEvents,
    knowledgeEvents: engine.knowledgeEvents,
    decisionEvents: engine.decisionEvents,
    localMovementEvents: engine.localMovementEvents,
    interactionEvents: engine.interactionEvents ?? [],
    populationByTick: engine.populationByTick,
    activityCoverage: {
      eligibleTicks,
      decisionTicks: engine.decisionEvents.length,
      coverage: eligibleTicks ? engine.decisionEvents.length / eligibleTicks : 1,
      npcsWithDecisions: new Set(engine.decisionEvents.map((event) => event.npcId)).size,
      npcsWithLocalMovement: new Set(engine.localMovementEvents.map((event) => event.npcId)).size,
      fateEvaluatedNpcs: engine.fateEvaluatedNpcIds.size,
      fateEvaluationTicks: engine.fateEvaluationTicks,
      fateEvaluationCoverage: engine.model.npcs.length ? engine.fateEvaluatedNpcIds.size / engine.model.npcs.length : 1,
      coverageByNpc,
    },
    traceFingerprint: `${engine.traceHashA.toString(16).padStart(8, "0")}${engine.traceHashB.toString(16).padStart(8, "0")}`,
  };
}

export function auditNpcLifeSimulation(result, model) {
  const traceCoverageViolations = [];
  const decisionCoverageViolations = [];
  const postMortemActionViolations = [];
  const postInactiveKnowledgeViolations = [];
  const knowledgeProvenanceViolations = [];
  const knowledgeCausalityViolations = [];
  const decisionKnowledgeViolations = [];
  const positionViolations = [];
  const lifeTransitionViolations = [];
  const canonicalFateViolations = [];
  const expectedTraceTicks = result.tickCount;
  for (const npc of model.npcs) {
    const traces = result.npcTraces?.[npc.id] ?? [];
    if (traces.length !== expectedTraceTicks) traceCoverageViolations.push({ npcId: npc.id, expected: expectedTraceTicks, actual: traces.length });
    const coverage = result.activityCoverage?.coverageByNpc?.[npc.id];
    if (!coverage || coverage.decisionTicks !== coverage.eligibleTicks) decisionCoverageViolations.push({ npcId: npc.id, coverage });
    for (const trace of traces) {
      if (!model.locations.includes(trace.hubId)) positionViolations.push({ npcId: npc.id, trace });
      if (trace.facilityId && model.facilityById && !model.facilityById[trace.facilityId]) positionViolations.push({ npcId: npc.id, trace, reason: "unknown-facility" });
    }
  }
  const inactiveAt = {};
  for (const event of result.lifeEvents ?? []) {
    if (!event.cause || !event.location || !Number.isFinite(event.absoluteHour)) lifeTransitionViolations.push(event);
    if (["dead", "missing", "departed"].includes(event.toPresence)) inactiveAt[event.npcId] = Math.min(inactiveAt[event.npcId] ?? Number.POSITIVE_INFINITY, event.absoluteHour);
  }
  for (const event of result.decisionEvents ?? []) {
    if (event.absoluteHour >= (inactiveAt[event.npcId] ?? Number.POSITIVE_INFINITY)) postMortemActionViolations.push(event);
  }
  const knowledgeByEventId = new Map((result.knowledgeEvents ?? []).map((event) => [event.id, event]));
  const learnedByNpcFact = new Map();
  for (const event of result.knowledgeEvents ?? []) {
    if (!event.factId || !event.sourceType || !Number.isFinite(event.propagationAt)) knowledgeProvenanceViolations.push(event);
    if (event.npcId && event.learnedAt >= (inactiveAt[event.npcId] ?? Number.POSITIVE_INFINITY)) {
      postInactiveKnowledgeViolations.push(event);
    }
    if (["share", "rumor-pickup", "source-pickup"].includes(event.type)) {
      const source = knowledgeByEventId.get(event.sourceEventId);
      if ((event.type !== "source-pickup" && !event.sourceNpcId) || !source) knowledgeProvenanceViolations.push(event);
      if (!(event.sourceLearnedAt < event.learnedAt)) knowledgeCausalityViolations.push(event);
      const expectedPath = source ? [...(source.path ?? []), event.npcId] : [];
      if (
        source && (
          event.hopCount !== Number(source.hopCount ?? 0) + 1 ||
          JSON.stringify(event.path ?? []) !== JSON.stringify(expectedPath)
        )
      ) knowledgeProvenanceViolations.push(event);
    }
    const key = `${event.npcId}:${event.factId}`;
    learnedByNpcFact.set(key, Math.min(learnedByNpcFact.get(key) ?? Number.POSITIVE_INFINITY, event.learnedAt));
  }
  for (const decision of result.decisionEvents ?? []) {
    for (const factId of decision.usedFactIds ?? []) {
      const learnedAt = learnedByNpcFact.get(`${decision.npcId}:${factId}`);
      if (!Number.isFinite(learnedAt) || learnedAt > decision.absoluteHour) decisionKnowledgeViolations.push({ decisionId: decision.id, npcId: decision.npcId, factId, learnedAt });
    }
  }
  if (result.troubleStates?.T01?.status === "failed" && !(result.lifeEvents ?? []).some((event) => event.npcId === "NPC001" && event.toPresence === "dead" && event.day === 2)) {
    canonicalFateViolations.push({ npcId: "NPC001", expected: "dead-on-day-2-after-T01-no-player-failure" });
  }
  if (result.troubleStates?.T11?.status === "failed" && !(result.lifeEvents ?? []).some((event) => event.npcId === "NPC016" && event.toPresence === "dead" && event.day === 49)) {
    canonicalFateViolations.push({ npcId: "NPC016", expected: "dead-on-day-49-after-T11-no-player-failure" });
  }
  return {
    traceCoverageViolations,
    decisionCoverageViolations,
    postMortemActionViolations,
    postInactiveKnowledgeViolations,
    knowledgeProvenanceViolations,
    knowledgeCausalityViolations,
    decisionKnowledgeViolations,
    positionViolations,
    lifeTransitionViolations,
    canonicalFateViolations,
  };
}
