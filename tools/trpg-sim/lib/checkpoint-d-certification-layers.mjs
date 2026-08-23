export const CHECKPOINT_D_CERTIFICATION_LAYERS = Object.freeze({
  fieldDetonationIsolation: Object.freeze({
    layer: 'MECHANIC_WITNESS',
    file: 'checkpoint-d-field-detonation-playability.test.mjs',
    reason: 'direct skill injection, extreme player stats and enemy HP extension isolate runtime mechanics; same-type field stacking remains DESIGN_UNDECIDED',
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
