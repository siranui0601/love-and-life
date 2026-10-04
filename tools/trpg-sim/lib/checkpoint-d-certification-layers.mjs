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

export const LV1_AXE_STARTER_GAMEPLAY_CERT = Object.freeze({
  layer: 'GAMEPLAY_CERT',
  file: 'checkpoint-d-gameplay-cert-lv1.test.mjs',
  gameplayCert: true,
  scenario: 'current Day1 provisional Lv1 axe starter / SKL-0049 / canonical seekBattle',
  scope: 'bounded certification of the current Day1 provisional starter build; not a universal initial-weapon canonical rule',
  reason: 'production createGameRuntime provides Lv1/SP2 and current starter EQP-W-0005; learnPlayerSkill spends 1SP on canonical basic_level_up SKL-0049; generateChoiceActions/beginInteractiveBattleAction select a canonical encounter; shared battle command/runtime exposes the real player decision and observable command state; the real battle result is committed through settleInteractiveBattleAction with world clock/resources intact; the same fixed seed reproduces the same fingerprint',
  dimensions: Object.freeze({
    enemyCanonical: true,
    playerBuildLegal: true,
    acquisitionProven: true,
    skillGrantProven: true,
    equipmentLegal: true,
    productionBattle: true,
    playerVisibleUx: true,
    productionSettlement: true,
    worldStateIntegrated: true,
    boundedDeterministic: true,
  }),
  disqualifiers: Object.freeze({}),
});

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
  lv1AxeStarterGameplayCert: LV1_AXE_STARTER_GAMEPLAY_CERT,
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
