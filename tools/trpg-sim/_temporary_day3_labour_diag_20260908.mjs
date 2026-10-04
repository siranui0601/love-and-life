#!/usr/bin/env node
import { authoredMissionFlowExclusiveActions, AUTHORED_MISSION_FLOW_REGISTRY_INTERNALS as reg } from '../../src/server/trpg/content/authored-mission-flow-registry.js';
import * as registryModule from '../../src/server/trpg/content/authored-mission-flow-registry.js';

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;
const state = {
  playerState: {
    absoluteMinute: absoluteMinuteFor(3, 16 * 60),
    day: 3,
    player: { location: '田園の村', facilityId: 'LOC_FARM_INN', hunger: 43, fatigue: 32, gold: 41 },
    worldFlags: {}, history: [], evidence: {}, missions: [],
  },
};
const base = registryModule;
console.log('absoluteMinute', state.playerState.absoluteMinute);
console.log('availableCanonicalLabour', reg.availableCanonicalLabour(state).map(a => ({id:a.id, minutes:a.minutes})));
console.log('publicLifeProducts', reg.publicLifeProducts(state).map(a => ({id:a.id, kind:a.canonicalWorldLifeKind})));
console.log('finalNoContext', authoredMissionFlowExclusiveActions(structuredClone(state))?.map(a => a.id));
console.log('finalProductionContext', authoredMissionFlowExclusiveActions(structuredClone(state), {movementActions:[], presentNpcs:[]})?.map(a => a.id));
