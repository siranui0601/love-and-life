(() => {
  const originalFetch = window.fetch.bind(window);
  const TRAP_RISK_KINDS = new Set(['slow', 'updraft', 'vortex', 'orbit', 'tether', 'antiFall', 'gravityFlip']);
  const EXIT_KINDS = new Set(['kick', 'cannon', 'spring', 'current', 'redirect', 'rail', 'oneWay', 'carrier', 'catchRelease', 'pendulum', 'portal', 'speedFloor']);

  function hasTrapRisk(motors) {
    const hasRiskField = motors.some((m) => TRAP_RISK_KINDS.has(m.kind));
    const hasInwardField = motors.some((m) => ['wind', 'current'].includes(m.kind) && ['radialIn', 'tangent'].includes(m.direction));
    const hasSlowWithoutRelease = motors.some((m) => m.kind === 'slow') && !motors.some((m) => ['current', 'speedFloor', 'redirect', 'kick', 'cannon', 'spring', 'portal', 'rail', 'carrier', 'catchRelease', 'pendulum'].includes(m.kind));
    const hasExit = motors.some((m) => EXIT_KINDS.has(m.kind) && !(m.kind === 'current' && ['radialIn', 'tangent'].includes(m.direction)));
    return (hasRiskField || hasInwardField || hasSlowWithoutRelease) && !hasExit;
  }

  function normalizeGimmick(gimmick) {
    if (!gimmick || !Array.isArray(gimmick.motors)) return gimmick;
    if (!hasTrapRisk(gimmick.motors)) return gimmick;
    const maxRange = Math.max(0.62, ...gimmick.motors.map((m) => Number(m.range) || 0));
    const motors = gimmick.motors.slice(0, 3);
    motors.push({ kind: 'current', trigger: 'inside', direction: 'towardNextGoal', power: 0.78, range: Math.min(1, maxRange + 0.12), duration: 0.8 });
    motors.push({ kind: 'speedFloor', trigger: 'inside', direction: 'towardNextGoal', power: 0.68, range: Math.min(1, maxRange + 0.12), duration: 0.8 });
    return { ...gimmick, motors };
  }

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!String(url).includes('/api/nohand-soccer/gimmick') || !response.ok) return response;
    try {
      const data = normalizeGimmick(await response.clone().json());
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return response;
    }
  };
})();
