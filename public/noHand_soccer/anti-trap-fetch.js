(() => {
  const originalFetch = window.fetch.bind(window);
  const LEGACY_KIND_MAP = {
    kick: 'launcher', cannon: 'launcher', spring: 'launcher', wind: 'fieldForce', updraft: 'fieldForce', vortex: 'fieldForce', current: 'fieldForce', antiFall: 'fieldForce', redirect: 'launcher', mirror: 'bumper', curve: 'fieldForce', oneWay: 'rail', tether: 'fieldForce', orbit: 'fieldForce', catchRelease: 'timerRelease', pendulum: 'flipper', gravityFlip: 'gravityShift', slow: 'dragZone', speedFloor: 'fieldForce',
  };
  const PATH_NEED = new Set(['fieldForce', 'gravityShift', 'dragZone', 'rail', 'carrier', 'timerRelease']);
  const SHOWY = new Set(['launcher', 'bumper', 'gravityShift', 'split', 'portal', 'flipper', 'timerRelease']);

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function kindOf(kind) {
    const raw = String(kind || '').trim();
    if (['launcher','bumper','fieldForce','gravityShift','split','portal','rail','carrier','flipper','phase','dragZone','timerRelease'].includes(raw)) return raw;
    return LEGACY_KIND_MAP[raw] || LEGACY_KIND_MAP[raw.toLowerCase()] || 'launcher';
  }
  function normalizeMotors(motors) {
    const list = (Array.isArray(motors) ? motors : []).slice(0, 5).map((motor) => {
      const kind = kindOf(motor.kind);
      return {
        ...motor,
        kind,
        power: clamp(Number(motor.power ?? 0.78), 0.18, 1),
        range: clamp(Number(motor.range ?? 0.58), 0.15, 1),
        duration: clamp(Number(motor.duration ?? 0.65), 0.05, 3),
        angle: clamp(Number(motor.angle ?? 180), -360, 360),
        count: Math.round(clamp(Number(motor.count ?? 2), 2, 4)),
        spreadAngle: clamp(Number(motor.spreadAngle ?? 38), 10, 140),
      };
    });
    if (!list.length) list.push({ kind: 'launcher', trigger: 'contact', direction: 'angle', power: 0.78, range: 0.55, duration: 0.45, angle: 180, count: 2, spreadAngle: 38 });
    if (!list.some((m) => SHOWY.has(m.kind))) list.push({ kind: 'launcher', trigger: 'contact', direction: 'angle', power: 0.72, range: 0.5, duration: 0.45, mode: 'assist' });
    if (list.length === 1) list.push({ kind: PATH_NEED.has(list[0].kind) ? 'launcher' : 'fieldForce', trigger: 'inside', direction: 'towardNextGoal', power: 0.58, range: 0.65, duration: 0.8, mode: 'exit' });
    return list.slice(0, 5);
  }
  function normalizeExit(exit, motors) {
    const needsExit = motors.some((m) => PATH_NEED.has(m.kind));
    if (!needsExit && !exit) return null;
    return {
      direction: ['angle','towardNextGoal','radialOut','up','left','right'].includes(exit?.direction) ? exit.direction : 'towardNextGoal',
      minSpeed: clamp(Number(exit?.minSpeed ?? 7.2), 5.8, 11),
      afterSeconds: clamp(Number(exit?.afterSeconds ?? 0.75), 0.25, 1.8),
      label: String(exit?.label || '出口補助').slice(0, 16),
    };
  }
  function normalizeGimmick(gimmick) {
    if (!gimmick || !Array.isArray(gimmick.motors)) return gimmick;
    const motors = normalizeMotors(gimmick.motors);
    return { ...gimmick, motors, exit: normalizeExit(gimmick.exit, motors) };
  }

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!String(url).includes('/api/nohand-soccer/gimmick') || !response.ok) return response;
    try {
      const data = normalizeGimmick(await response.clone().json());
      return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers: { 'Content-Type': 'application/json' } });
    } catch {
      return response;
    }
  };
})();
