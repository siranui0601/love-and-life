import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTrpgGameData } from '../../../src/server/trpg/game/game-data.js';
import {
  createNpcLifeEngine,
  processNpcLifeInteractions,
  recordPlayerNpcConversation,
} from '../lib/npc-life-engine.mjs';

const data = loadTrpgGameData();

function engine(seed) {
  const npcStates = Object.fromEntries(data.model.npcs.map((npc) => [npc.id, { id: npc.id }]));
  return createNpcLifeEngine({ model: data.model, seed, npcStates });
}

function colocate(world, ids, facilityId = 'LOC_FARM_INN') {
  for (const id of ids) {
    const state = world.npcStates[id];
    state.lifeStatus = 'alive';
    state.presence = 'present';
    state.location = '田園の村';
    state.position = { hubId: '田園の村', facilityId };
    state.travel = null;
    state.localTravel = null;
  }
}

function belief(overrides = {}) {
  return {
    factId: 'F-COMMON-POLICY',
    kind: 'trouble',
    text: 'T01について確かめた重要情報',
    troubleId: 'T01',
    troubleIds: ['T01'],
    confidence: 1,
    importance: 0.99,
    secret: false,
    learnedAt: 0,
    propagationAt: 0,
    sourceType: 'test-source',
    sourceNpcId: 'NPC058',
    hopCount: 0,
    path: ['NPC058'],
    ...overrides,
  };
}

function sweep(world, absoluteHour = 12) {
  return processNpcLifeInteractions(world, { day: 1, phaseIndex: 1, absoluteHour });
}

test('[CHECKPOINT_F_COMMON] high importance never bypasses listener interest, while relevant T01 information can be believed', () => {
  const irrelevant = engine('f-common-irrelevant');
  colocate(irrelevant, ['NPC058', 'NPC008']);
  irrelevant.npcStates.NPC058.beliefs['F-UNRELATED'] = belief({
    factId: 'F-UNRELATED',
    text: '遠い土地の無関係な高重要度情報',
    troubleId: 'T99',
    troubleIds: ['T99'],
  });
  sweep(irrelevant);
  assert.equal(irrelevant.npcStates.NPC008.beliefs['F-UNRELATED'], undefined);

  const relevant = engine('f-common-relevant');
  colocate(relevant, ['NPC058', 'NPC008']);
  relevant.npcStates.NPC058.beliefs['F-T01-RELEVANT'] = belief({ factId: 'F-T01-RELEVANT' });
  sweep(relevant);
  assert.ok(relevant.npcStates.NPC008.beliefs['F-T01-RELEVANT']);
  assert.ok(relevant.knowledgeEvents.some((event) => event.type === 'share' && event.sourceNpcId === 'NPC058' && event.npcId === 'NPC008' && event.factId === 'F-T01-RELEVANT'));
});

test('[CHECKPOINT_F_COMMON] secret disclosure requires a real reason; work relationship alone is insufficient', () => {
  const noReason = engine('f-secret-no-reason');
  colocate(noReason, ['NPC058', 'NPC008']);
  noReason.npcStates.NPC058.beliefs['F-SECRET-NO-REASON'] = belief({
    factId: 'F-SECRET-NO-REASON',
    secret: true,
    workRelationshipNpcIds: ['NPC008'],
  });
  sweep(noReason);
  assert.equal(noReason.npcStates.NPC008.beliefs['F-SECRET-NO-REASON'], undefined);

  const authorized = engine('f-secret-authorized');
  colocate(authorized, ['NPC058', 'NPC008']);
  authorized.npcStates.NPC058.beliefs['F-SECRET-AUTHORIZED'] = belief({
    factId: 'F-SECRET-AUTHORIZED',
    secret: true,
    disclosure: {
      authorizedListenerIds: ['NPC008'],
      reason: 'shared T01 rescue verification objective',
    },
  });
  sweep(authorized);
  assert.ok(authorized.npcStates.NPC008.beliefs['F-SECRET-AUTHORIZED']);
});

test('[CHECKPOINT_F_COMMON] departureContactContexts is safe with an absent departure list', () => {
  const world = engine('f-departure-array-guard');
  world.departures = undefined;
  assert.doesNotThrow(() => sweep(world));
});

test('[CHECKPOINT_F_COMMON] the player becomes a common interaction participant only after an actual conversation and the greeting dedupes', () => {
  const world = engine('f-player-conversation');
  colocate(world, ['NPC058']);
  assert.equal(world.interactionEvents.some((event) => event.speakerId === 'PLAYER-F-CERT'), false, 'mere co-location is not a conversation');

  const first = recordPlayerNpcConversation(world, {
    playerId: 'PLAYER-F-CERT',
    playerName: 'F証明旅人',
    npcId: 'NPC058',
    absoluteHour: 12,
    location: { hubId: '田園の村', facilityId: 'LOC_FARM_INN' },
    actionId: 'TEST:VISIBLE-CONVERSATION',
  });
  assert.equal(first.learned, true);
  assert.ok(first.interaction);
  assert.ok(world.npcStates.NPC058.beliefs[first.factId]);
  assert.equal(world.npcStates.NPC058.beliefs[first.factId].sourceType, 'player');
  const interactionCount = world.interactionEvents.length;
  const knowledgeCount = world.knowledgeEvents.length;

  const duplicate = recordPlayerNpcConversation(world, {
    playerId: 'PLAYER-F-CERT',
    playerName: 'F証明旅人',
    npcId: 'NPC058',
    absoluteHour: 13,
    location: { hubId: '田園の村', facilityId: 'LOC_FARM_INN' },
    actionId: 'TEST:SECOND-CONVERSATION',
  });
  assert.equal(duplicate.learned, false);
  assert.equal(world.interactionEvents.length, interactionCount);
  assert.equal(world.knowledgeEvents.length, knowledgeCount);
});
