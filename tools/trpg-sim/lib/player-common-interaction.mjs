import {
  isNpcLifeEligible,
  recordWorldInteractionEvent,
} from './npc-life-engine.mjs';

function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

function ensureCommonState(engine) {
  engine.interactionEvents ??= [];
  engine.knowledgeEvents ??= [];
  engine.knowledgeEventSequence = Number(engine.knowledgeEventSequence ?? engine.knowledgeEvents.length);
  engine.playerKnownFactIds ??= {};
  engine.playerTravelRumorPublications ??= [];
  return engine;
}

function playerFactSet(engine, playerId) {
  ensureCommonState(engine);
  const current = engine.playerKnownFactIds[playerId];
  if (current instanceof Set) return current;
  const normalized = new Set(current ?? []);
  engine.playerKnownFactIds[playerId] = normalized;
  return normalized;
}

function addKnowledgeEvent(engine, event) {
  ensureCommonState(engine);
  engine.knowledgeEventSequence += 1;
  const id = `K${String(engine.knowledgeEventSequence).padStart(7, '0')}`;
  const stored = { id, eventId: id, accepted: true, ...event };
  engine.knowledgeEvents.push(stored);
  return stored;
}

function npcAtLocation(state, location) {
  if (!isNpcLifeEligible(state) || state.presence !== 'present') return false;
  if (state.travel || state.localTravel) return false;
  if (location?.hubId && state.position?.hubId !== location.hubId) return false;
  if (location?.facilityId && state.position?.facilityId !== location.facilityId) return false;
  return true;
}

function addNpcRecognitionBelief(engine, npcState, {
  playerId,
  playerName,
  npcId,
  absoluteHour,
  interactionEventId,
  actionId,
}) {
  npcState.beliefs ??= {};
  npcState.memories ??= {};
  const factId = `player-recognition:${playerId}`;
  if (npcState.beliefs[factId]) return { learned: false, factId };
  const event = addKnowledgeEvent(engine, {
    type: 'player-conversation',
    npcId,
    factId,
    learnedAt: absoluteHour,
    propagationAt: absoluteHour + 4,
    sourceType: 'player',
    sourceNpcId: null,
    sourcePlayerId: playerId,
    sourceEventId: interactionEventId,
    interactionEventId,
    interactionContextType: 'facility',
    hopCount: 1,
    path: [`player:${playerId}`, npcId],
  });
  npcState.beliefs[factId] = {
    factId,
    kind: 'fact',
    text: `${playerName}本人と会話し、顔と名乗りを認識した`,
    troubleIds: [],
    confidence: 1,
    importance: 0.35,
    secret: false,
    learnedAt: absoluteHour,
    propagationAt: absoluteHour + 4,
    sourceType: 'player',
    sourceNpcId: null,
    sourcePlayerId: playerId,
    publicationMode: 'conversation-only',
    hopCount: 1,
    path: [`player:${playerId}`, npcId],
    interactionEventId,
    provenanceEventId: event.id,
  };
  npcState.knowledgeRevision = Number(npcState.knowledgeRevision ?? 0) + 1;
  npcState.memories[factId] = {
    type: 'player-recognition',
    playerId,
    playerName,
    learnedAt: absoluteHour,
    interactionEventId,
    actionId,
  };
  return { learned: true, factId };
}

/**
 * Records an explicit player/NPC conversation in the existing common world
 * interaction and knowledge ledgers. Merely sharing a facility never calls this.
 */
export function recordPlayerNpcConversation(engine, {
  playerId = 'PLAYER',
  playerName = '旅人',
  npcId,
  absoluteHour = 0,
  location = null,
  actionId = null,
} = {}) {
  if (!engine || !npcId) return { interaction: null, learned: false, factId: null, reason: 'invalid-participant' };
  ensureCommonState(engine);
  const npcState = engine.npcStates?.[npcId];
  if (!npcAtLocation(npcState, location)) {
    return { interaction: null, learned: false, factId: null, reason: 'npc-not-present' };
  }
  const stablePlayerId = String(playerId || 'PLAYER');
  const factId = `player-recognition:${stablePlayerId}`;
  const dedupeKey = `player-recognition|${stablePlayerId}|${npcId}`;
  const existing = engine.interactionEvents.find((event) => event?.dedupeKey === dedupeKey) ?? null;
  if (npcState.beliefs?.[factId]) {
    return { interaction: existing, learned: false, factId, reason: 'already-recognized' };
  }
  const interaction = recordWorldInteractionEvent(engine, {
    type: 'conversation',
    contextType: 'facility',
    speakerId: stablePlayerId,
    speakerNpcId: null,
    listenerIds: [npcId],
    audibleListenerIds: [npcId],
    acceptedListenerIds: [npcId],
    privacy: 'public',
    factId,
    topic: `${playerName}と会話した`,
    startedAt: Number(absoluteHour),
    endedAt: Number(absoluteHour),
    location,
    provenance: { actionId, sourceType: 'player-conversation' },
    dedupeKey,
  });
  if (!interaction) return { interaction: null, learned: false, factId, reason: 'interaction-not-recorded' };
  const learned = addNpcRecognitionBelief(engine, npcState, {
    playerId: stablePlayerId,
    playerName,
    npcId,
    absoluteHour: Number(absoluteHour),
    interactionEventId: interaction.id,
    actionId,
  });
  return { interaction, ...learned, reason: learned.learned ? 'recognized' : 'already-recognized' };
}

function endpointsOf(travel) {
  if (!travel) return null;
  return {
    routeId: travel.routeId ?? null,
    fromHubId: travel.fromHubId ?? travel.fromHub ?? travel.originHubId ?? travel.origin ?? null,
    toHubId: travel.toHubId ?? travel.toHub ?? travel.destinationHubId ?? travel.destinationHub ?? travel.destination ?? null,
    fromFacilityId: travel.fromFacilityId ?? travel.originFacilityId ?? null,
    toFacilityId: travel.toFacilityId ?? travel.targetFacilityId ?? travel.destinationFacilityId ?? null,
  };
}

function unorderedMatch(leftA, leftB, rightA, rightB) {
  return Boolean(leftA && leftB && rightA && rightB)
    && ((leftA === rightA && leftB === rightB) || (leftA === rightB && leftB === rightA));
}

function travelContextForNpc(state, before, after) {
  if (!isNpcLifeEligible(state)) return null;
  const local = endpointsOf(state.localTravel);
  if (before?.hubId && before.hubId === after?.hubId
    && before?.facilityId !== after?.facilityId
    && unorderedMatch(local?.fromFacilityId, local?.toFacilityId, before.facilityId, after.facilityId)) {
    return { contextType: 'passing-contact', routeId: local.routeId, travel: local };
  }
  const regional = endpointsOf(state.travel);
  if (before?.hubId !== after?.hubId
    && unorderedMatch(regional?.fromHubId, regional?.toHubId, before.hubId, after.hubId)) {
    return { contextType: 'shared-travel', routeId: regional.routeId, travel: regional };
  }
  return null;
}

function publicTravelBelief(state, absoluteHour) {
  return Object.values(state?.beliefs ?? {})
    .filter((belief) => !belief?.secret)
    .filter((belief) => belief?.publicationMode !== 'conversation-only')
    .filter((belief) => Number(belief?.propagationAt ?? belief?.learnedAt ?? 0) <= absoluteHour)
    .sort((left, right) => Number(right.importance ?? 0) - Number(left.importance ?? 0)
      || String(left.factId).localeCompare(String(right.factId), 'en'))[0] ?? null;
}

/**
 * Records only route-overlap contacts. Static co-location is deliberately ignored.
 * Rumor hearing and delayed destination publication use the same knowledge ledger;
 * the origin is never republished at the contact tick.
 */
export function recordPlayerTravelInteractions(engine, {
  playerId = 'PLAYER',
  playerName = '旅人',
  before,
  after,
  absoluteHour = 0,
  actionId = null,
} = {}) {
  if (!engine || !before || !after) return [];
  ensureCommonState(engine);
  const stablePlayerId = String(playerId || 'PLAYER');
  const known = playerFactSet(engine, stablePlayerId);
  const contacts = [];
  for (const [npcId, state] of Object.entries(engine.npcStates ?? {}).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    const context = travelContextForNpc(state, before, after);
    if (!context) continue;
    const interaction = recordWorldInteractionEvent(engine, {
      type: 'travel-contact',
      contextType: context.contextType,
      speakerId: stablePlayerId,
      listenerIds: [npcId],
      audibleListenerIds: [npcId],
      acceptedListenerIds: [npcId],
      privacy: 'public',
      topic: `${playerName}と移動中に接触した`,
      startedAt: Number(absoluteHour),
      endedAt: Number(absoluteHour),
      location: after,
      routeSegment: { routeId: context.routeId, from: before, to: after },
      provenance: { actionId, sourceType: 'player-travel' },
      dedupeKey: `player-travel|${stablePlayerId}|${npcId}|${context.routeId ?? actionId}|${Number(absoluteHour).toFixed(6)}`,
    });
    if (!interaction) continue;
    const belief = publicTravelBelief(state, Number(absoluteHour));
    let heard = null;
    let publication = null;
    if (belief && !known.has(belief.factId)) {
      known.add(belief.factId);
      heard = addKnowledgeEvent(engine, {
        type: 'travel-hear',
        npcId: stablePlayerId,
        factId: belief.factId,
        learnedAt: Number(absoluteHour),
        propagationAt: Number(absoluteHour) + 4,
        sourceType: 'npc-travel-contact',
        sourceNpcId: npcId,
        sourcePlayerId: null,
        sourceEventId: interaction.id,
        interactionEventId: interaction.id,
        interactionContextType: context.contextType,
        hopCount: Number(belief.hopCount ?? 0) + 1,
        path: [...unique(belief.path ?? [npcId]), stablePlayerId],
      });
      publication = {
        type: 'travel-rumor-publication',
        playerId: stablePlayerId,
        factId: belief.factId,
        sourceNpcId: npcId,
        learnedAt: Number(absoluteHour),
        propagationAt: Number(absoluteHour) + 4,
        origin: { ...before },
        destination: { ...after },
        interactionEventId: interaction.id,
        routeId: context.routeId,
      };
      engine.playerTravelRumorPublications.push(publication);
    }
    contacts.push({ npcId, interaction, heard, publication, contextType: context.contextType });
  }
  return contacts;
}
