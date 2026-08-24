export const GAMEPLAY_CERT_REQUIRED_DIMENSIONS = Object.freeze([
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

export const GAMEPLAY_CERT_DISQUALIFIERS = Object.freeze([
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

export const CHECKPOINT_D_CERTIFICATION_LAYERS = Object.freeze({
  fieldDetonationIsolation: Object.freeze({
    layer: 'MECHANIC_WITNESS',
    file: 'checkpoint-d-field-detonation-playability.test.mjs',
    reason: 'direct skill injection, extreme player stats and enemy HP extension isolate runtime mechanics; canonical Formation now forbids same sourceSkillId duplicates while allowing same family/different sourceSkillId coexistence, so this witness is not GAMEPLAY_CERT',
    gameplayCert: false,
  }),
  fivePolicyIsolation: Object.freeze({
    layer: 'MECHANIC_WITNESS',
    file: 'checkpoint-d-policy-target-priority.test.mjs',
    reason: 'direct skill injection and extreme stats isolate command-policy behavior',
    gameplayCert: false,
  }),
  enc0076CanonicalProbe: Object.freeze({
    layer: 'CANONICAL_GAMEPLAY_PROBE',
    file: 'checkpoint-d-policy-target-priority.test.mjs',
    reason: 'canonical encounter/stats/actions/priority are preserved, but world acquisition/grant state is not reconstructed',
    gameplayCert: false,
  }),
  nineBossCounterplayIsolation: Object.freeze({
    layer: 'MECHANIC_WITNESS',
    file: 'checkpoint-d-boss-counterplay.test.mjs',
    reason: 'forced canonical action selection, priority override and extreme stats intentionally isolate boss mechanics/counterplay',
    gameplayCert: false,
  }),
});

function isActiveDisqualifier(value) {
  if (value === true) return true;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

function descriptorDimensions(descriptor) {
  return descriptor?.dimensions ?? descriptor?.certification?.dimensions ?? {};
}

function descriptorDisqualifiers(descriptor) {
  return descriptor?.disqualifiers ?? descriptor?.certification?.disqualifiers ?? {};
}

export function evaluateGameplayCertDescriptor(descriptor = {}) {
  const layer = descriptor.layer ?? descriptor.certificationLayer ?? descriptor.certification?.layer ?? null;
  const claimedGameplayCert = layer === 'GAMEPLAY_CERT' || descriptor.gameplayCert === true;
  const dimensions = descriptorDimensions(descriptor);
  const disqualifiers = descriptorDisqualifiers(descriptor);
  const missingDimensions = GAMEPLAY_CERT_REQUIRED_DIMENSIONS.filter((dimension) => dimensions[dimension] !== true);
  const activeDisqualifiers = GAMEPLAY_CERT_DISQUALIFIERS.filter((key) => isActiveDisqualifier(disqualifiers[key]));
  const ok = claimedGameplayCert && missingDimensions.length === 0 && activeDisqualifiers.length === 0;
  return {
    ok,
    gameplayCert: ok,
    claimedGameplayCert,
    layer: ok ? 'GAMEPLAY_CERT' : (layer ?? 'NOT_GAMEPLAY_CERT'),
    missingDimensions,
    activeDisqualifiers,
    dimensions: Object.fromEntries(GAMEPLAY_CERT_REQUIRED_DIMENSIONS.map((dimension) => [dimension, dimensions[dimension] === true])),
  };
}

export function assertGameplayCertDescriptor(descriptor = {}) {
  const result = evaluateGameplayCertDescriptor(descriptor);
  if (!result.ok) {
    throw new Error(`Invalid GAMEPLAY_CERT descriptor: missing=${result.missingDimensions.join(',') || 'none'} disqualifiers=${result.activeDisqualifiers.join(',') || 'none'}`);
  }
  return result;
}

export function checkpointDGameplayCertCount(registry = CHECKPOINT_D_CERTIFICATION_LAYERS) {
  return Object.values(registry).filter((entry) => evaluateGameplayCertDescriptor(entry).ok).length;
}
