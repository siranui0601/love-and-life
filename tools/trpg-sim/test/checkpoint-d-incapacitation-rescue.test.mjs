import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCollapseRescueCandidates,
  planIncapacitationRescue,
  selectCollapseRescuer,
} from '../../../src/server/trpg/resolvers/player-collapse-resolver.js';

const incident = {
  id: 'INCAP:BATTLE:1',
  status: 'pending_rescue',
  causes: ['battle_defeat'],
  atMinute: 1000,
  location: 'HUB_FIELD',
  facilityId: 'FIELD_EDGE',
};

test('Checkpoint D common rescue prefers a surviving battle companion over an unrelated reachable NPC', () => {
  const candidates = buildCollapseRescueCandidates({
    presentNpcIds: ['NPC_NEAR'],
    companionNpcIds: ['NPC_COMPANION'],
    reachableNpcIds: ['NPC_NEAR'],
    location: incident.location,
    facilityId: incident.facilityId,
    npcStates: {
      NPC_COMPANION: { playerTrust: 2, canRescue: true, rescueTravelMinutes: 15 },
      NPC_NEAR: { playerTrust: 20, canRescue: true, rescueTravelMinutes: 5 },
    },
  });
  assert.equal(selectCollapseRescuer(incident, candidates)?.id, 'NPC_COMPANION');
});

test('Checkpoint D common rescue excludes dead detained hostile incapacitated and explicit non-rescuers', () => {
  const candidates = buildCollapseRescueCandidates({
    presentNpcIds: ['DEAD', 'DETAINED', 'HOSTILE', 'DOWN', 'NO_RESCUE', 'VALID'],
    location: incident.location,
    facilityId: incident.facilityId,
    npcStates: {
      DEAD: { dead: true, canRescue: true },
      DETAINED: { detained: true, canRescue: true },
      HOSTILE: { hostile: true, canRescue: true },
      DOWN: { incapacitated: true, canRescue: true },
      NO_RESCUE: { canRescue: false },
      VALID: { canRescue: true },
    },
  });
  assert.equal(selectCollapseRescuer(incident, candidates)?.id, 'VALID');
});

test('Checkpoint D fallback rescue has explicit discovery evacuation and treatment time instead of instant teleport', () => {
  const plan = planIncapacitationRescue(incident, {
    candidates: [],
    fallbackRescuerId: 'SYSTEM_LOCAL_AID',
    fallbackWakeLocation: 'HUB_SAFE',
    fallbackWakeFacilityId: 'SAFE_INN',
    fallbackDiscoveryMinutes: 60,
    fallbackEvacuationMinutes: 120,
    treatmentRecoveryMinutes: 180,
  });
  assert.equal(plan.usedFallback, true);
  assert.equal(plan.rescuerId, 'SYSTEM_LOCAL_AID');
  assert.equal(plan.wakeLocation, 'HUB_SAFE');
  assert.equal(plan.wakeFacilityId, 'SAFE_INN');
  assert.deepEqual(
    [plan.discoveryDelayMinutes, plan.evacuationMinutes, plan.treatmentRecoveryMinutes, plan.elapsedMinutes],
    [60, 120, 180, 360],
  );
});

test('Checkpoint D rescue travel time is preserved as a first-class evacuation cost', () => {
  const near = { ...incident, id: 'INCAP:NEAR' };
  const nearPlan = planIncapacitationRescue(near, {
    candidates: [{ id: 'NPC_A', name: 'A', present: false, canReach: true, canRescue: true, alive: true, travelMinutes: 20, wakeLocation: 'SAFE', wakeFacilityId: 'INN' }],
    treatmentRecoveryMinutes: 180,
  });
  const farPlan = planIncapacitationRescue({ ...incident, id: 'INCAP:FAR' }, {
    candidates: [{ id: 'NPC_A', name: 'A', present: false, canReach: true, canRescue: true, alive: true, travelMinutes: 180, wakeLocation: 'SAFE', wakeFacilityId: 'INN' }],
    treatmentRecoveryMinutes: 180,
  });
  assert.equal(nearPlan.elapsedMinutes, 200);
  assert.equal(farPlan.elapsedMinutes, 360);
  assert.ok(farPlan.elapsedMinutes > nearPlan.elapsedMinutes);
});
