export function renderDebug(target, state) {
  const lastContact = state.lastContactTime
    ? `${state.lastContactTime.toFixed(0)} ms`
    : 'none';
  target.textContent = [
    `mode: ${state.mode}`,
    `launched: ${state.launched}`,
    `ball: (${state.ballX.toFixed(1)}, ${state.ballY.toFixed(1)})`,
    `gimmick contact: ${state.gimmickContact}`,
    `last contact time: ${lastContact}`,
    `last triggered abilities: ${state.lastTriggeredAbilities.length ? state.lastTriggeredAbilities.join(', ') : 'none'}`,
    `speed: ${state.speed.toFixed(1)} px/s`,
    `velocity: (${state.vx.toFixed(1)}, ${state.vy.toFixed(1)})`,
    `active ability: ${state.activeAbilities.join(', ') || 'none'}`,
    `last effect: ${state.lastEffect || 'none'}`,
    `warnings: ${state.warnings.length ? state.warnings.join(' / ') : 'none'}`,
    `gravityScale: ${state.gravityScale.toFixed(2)}`,
    `gravityX: ${(state.gravityX ?? 0).toFixed(1)}`,
    `gravityY: ${(state.gravityY ?? 720).toFixed(1)}`,
    `lastWarpOffset: ${state.lastWarpOffset ? `(${state.lastWarpOffset.x}, ${state.lastWarpOffset.y})` : 'none'}`,
    `lastWarpTarget: ${state.lastWarpTarget ? `(${state.lastWarpTarget.x.toFixed(1)}, ${state.lastWarpTarget.y.toFixed(1)})` : 'none'}`,
    `seed: ${state.seed}`
  ].join('\n');
}
