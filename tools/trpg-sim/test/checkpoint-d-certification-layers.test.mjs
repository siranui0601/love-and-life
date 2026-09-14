import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHECKPOINT_D_CERTIFICATION_LAYERS,
  GAMEPLAY_CERT_DISQUALIFIERS,
  GAMEPLAY_CERT_REQUIRED_DIMENSIONS,
  LV1_AXE_STARTER_GAMEPLAY_CERT,
  assertGameplayCertDescriptor,
  checkpointDGameplayCertCount,
  evaluateGameplayCertDescriptor,
} from '../lib/checkpoint-d-certification-layers.mjs';

function completeDimensions() {
  return Object.fromEntries(GAMEPLAY_CERT_REQUIRED_DIMENSIONS.map((dimension) => [dimension, true]));
}

test('Checkpoint D explicitly separates mechanic witnesses from the single production GAMEPLAY_CERT', () => {
  const layers = CHECKPOINT_D_CERTIFICATION_LAYERS;
  assert.equal(layers.fieldDetonationIsolation.layer, 'MECHANIC_WITNESS');
  assert.equal(layers.fivePolicyIsolation.layer, 'MECHANIC_WITNESS');
  assert.equal(layers.nineBossCounterplayIsolation.layer, 'MECHANIC_WITNESS');
  assert.equal(layers.enc0076CanonicalProbe.layer, 'CANONICAL_GAMEPLAY_PROBE');
  assert.equal(layers.lv1AxeStarterGameplayCert, LV1_AXE_STARTER_GAMEPLAY_CERT);
  assert.equal(layers.lv1AxeStarterGameplayCert.layer, 'GAMEPLAY_CERT');
  assert.equal(Object.values(layers).filter((entry) => entry.gameplayCert === true).length, 1,
    'only the production Lv1 starter scenario is promoted to GAMEPLAY_CERT');
  assert.equal(checkpointDGameplayCertCount(layers), 1,
    'registry contains exactly one guarded GAMEPLAY_CERT');
  assert.doesNotThrow(() => assertGameplayCertDescriptor(layers.lv1AxeStarterGameplayCert));
  assert.doesNotMatch(layers.fieldDetonationIsolation.reason, /same-type field stacking remains DESIGN_UNDECIDED/u,
    'registry text must not preserve the pre-canonical same-type stacking uncertainty');
});

test('Checkpoint D GAMEPLAY_CERT guard requires all structured dimensions', () => {
  assert.deepEqual(GAMEPLAY_CERT_REQUIRED_DIMENSIONS, [
    'enemyCanonical',
    'playerBuildLegal',
    'acquisitionProven',
    'skillGrantProven',
    'equipmentLegal',
    'productionBattle',
    'playerVisibleUx',
    'productionSettlement',
    'worldStateIntegrated',
    'boundedDeterministic',
  ]);

  const result = evaluateGameplayCertDescriptor({
    layer: 'GAMEPLAY_CERT',
    dimensions: { ...completeDimensions(), skillGrantProven: false, worldStateIntegrated: undefined },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingDimensions.sort(), ['skillGrantProven', 'worldStateIntegrated'].sort());
});

test('Checkpoint D GAMEPLAY_CERT guard rejects mechanic-isolation disqualifiers from structured provenance', () => {
  assert.deepEqual(GAMEPLAY_CERT_DISQUALIFIERS, [
    'enemyStatOverride',
    'enemyHpExtension',
    'forcedEnemyAction',
    'priorityOverride',
    'arbitraryPlayerSuperstats',
    'directSkillInjection',
    'missingAcquisitionProvenance',
    'missingEventGrantProvenance',
    'missingEquipmentLegality',
    'harnessOnlySettlement',
    'noPlayerVisibleInformation',
    'noWorldTimeResourceSettlement',
  ]);

  const invalid = evaluateGameplayCertDescriptor({
    layer: 'GAMEPLAY_CERT',
    dimensions: completeDimensions(),
    disqualifiers: {
      directSkillInjection: true,
      priorityOverride: 'forced commander-first target order',
      enemyHpExtension: { reason: 'keep boss alive for witness' },
    },
  });
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.activeDisqualifiers.sort(), ['directSkillInjection', 'enemyHpExtension', 'priorityOverride'].sort());
});

test('Checkpoint D GAMEPLAY_CERT guard accepts only a complete descriptor with no disqualifier', () => {
  const valid = evaluateGameplayCertDescriptor({
    layer: 'GAMEPLAY_CERT',
    dimensions: completeDimensions(),
    disqualifiers: {},
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.gameplayCert, true);
  assert.equal(valid.layer, 'GAMEPLAY_CERT');
  assert.doesNotThrow(() => assertGameplayCertDescriptor({
    layer: 'GAMEPLAY_CERT',
    dimensions: completeDimensions(),
    disqualifiers: {},
  }));

  assert.throws(() => assertGameplayCertDescriptor({
    layer: 'GAMEPLAY_CERT',
    dimensions: completeDimensions(),
    disqualifiers: { arbitraryPlayerSuperstats: true },
  }), /arbitraryPlayerSuperstats/u);
});
