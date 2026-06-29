export function renderDebug(target, state) {
  target.textContent = [
    `velocity: ${state.speed.toFixed(1)} px/s (${state.vx.toFixed(1)}, ${state.vy.toFixed(1)})`,
    `active ability: ${state.activeAbilities.join(', ') || 'none'}`,
    `last effect: ${state.lastEffect || 'none'}`,
    `warnings: ${state.warnings.length ? state.warnings.join(' / ') : 'none'}`,
    `gravityScale: ${state.gravityScale.toFixed(2)}`,
    `seed: ${state.seed}`
  ].join('\n');
}
