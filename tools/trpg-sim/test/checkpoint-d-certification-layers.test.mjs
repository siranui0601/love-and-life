import assert from 'node:assert/strict';
import test from 'node:test';

import { CHECKPOINT_D_CERTIFICATION_LAYERS } from '../lib/checkpoint-d-certification-layers.mjs';

test('Checkpoint D-0 explicitly separates mechanic witnesses from gameplay certification', () => {
  const layers = CHECKPOINT_D_CERTIFICATION_LAYERS;
  assert.equal(layers.fieldDetonationIsolation.layer, 'MECHANIC_WITNESS');
  assert.equal(layers.fivePolicyIsolation.layer, 'MECHANIC_WITNESS');
  assert.equal(layers.nineBossCounterplayIsolation.layer, 'MECHANIC_WITNESS');
  assert.equal(layers.enc0076CanonicalProbe.layer, 'CANONICAL_GAMEPLAY_PROBE');
  assert.equal(Object.values(layers).some((entry) => entry.gameplayCert === true), false,
    'D-0 must not silently promote synthetic witnesses/probes into GAMEPLAY_CERT');
  console.log(`CHECKPOINT_D_CERTIFICATION_LAYERS ${JSON.stringify(layers)}`);
});
