(() => {
  function install() {
    if (typeof compileCodeSnippet !== 'function' || typeof updateCodeDeviceMotion !== 'function' || typeof drawCodeDevice !== 'function' || typeof sanitizeZone !== 'function') {
      setTimeout(install, 40);
      return;
    }
    if (window.__noHandCodeToolboxStabilityInstalled) return;
    window.__noHandCodeToolboxStabilityInstalled = true;

    const TAU = Math.PI * 2;
    const toRad = (value, fallback = 0) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.abs(n) > TAU ? n * Math.PI / 180 : n;
    };
    const isBallLike = (b) => b && Number.isFinite(Number(b.x)) && Number.isFinite(Number(b.y));
    const scaleVec = (v, amount = 1) => ({ x: Number(v?.x || 0) * Number(amount || 1), y: Number(v?.y || 0) * Number(amount || 1) });

    const originalCompileCodeSnippet = compileCodeSnippet;
    compileCodeSnippet = function stableCompileCodeSnippet(g, slot, field) {
      const rt = g.runtime || makeRuntime();
      g.runtime = rt;
      rt.compiled = rt.compiled || {};
      const key = `stable:${slot}.${field}`;
      if (rt.compiled[key]) return rt.compiled[key];
      const src = safeCode(g.code?.[slot]?.[field] || '');
      if (!src) return null;
      rt.compiled[key] = new Function('ctx', 'api', `"use strict";\nconst ball = ctx.ball;\nconst balls = ctx.balls;\nconst device = ctx.device;\nconst baseDevice = ctx.baseDevice;\nconst codeState = ctx.state;\nconst localState = ctx.state;\n${src}`);
      return rt.compiled[key];
    };

    const originalMakeCodeApi = makeCodeApi;
    makeCodeApi = function stableMakeCodeApi(g, c) {
      const api = originalMakeCodeApi(g, c);
      const baseBody = api.body || {};
      const pxsStable = (v) => clamp(Number(v || 0) / 60, -32, 32);
      const applyVec = (b, v, amount = 1, impulse = false) => {
        if (!isBallLike(b)) return;
        const scaled = scaleVec(v, amount);
        if (impulse) {
          b.vx += pxsStable(scaled.x);
          b.vy += pxsStable(scaled.y);
        } else {
          b.vx += Number(scaled.x || 0) / 60;
          b.vy += Number(scaled.y || 0) / 60;
        }
      };
      api.body = {
        ...baseBody,
        applyForce(ball, x, y) {
          if (typeof x === 'object') return applyVec(ball, x, y ?? 1, false);
          return baseBody.applyForce?.(ball, x, y);
        },
        applyImpulse(ball, x, y) {
          if (typeof x === 'object') return applyVec(ball, x, y ?? 1, true);
          return baseBody.applyImpulse?.(ball, x, y);
        },
        setVelocity(ball, x, y) {
          if (!isBallLike(ball)) return;
          if (typeof x === 'object') {
            const v = scaleVec(x, y ?? 1);
            ball.vx = pxsStable(v.x);
            ball.vy = pxsStable(v.y);
            return;
          }
          return baseBody.setVelocity?.(ball, x, y);
        },
        addVelocity(ball, x, y) {
          if (typeof x === 'object') return applyVec(ball, x, y ?? 1, true);
          return baseBody.addVelocity?.(ball, x, y);
        },
        applyForceVec(ball, vec, amount = 1) { return applyVec(ball, vec, amount, false); },
        applyImpulseVec(ball, vec, amount = 1) { return applyVec(ball, vec, amount, true); },
        setVelocityVec(ball, vec, speed = 1) {
          if (!isBallLike(ball)) return;
          const v = api.vec.normalize(vec || { x: 1, y: 0 }, speed);
          ball.vx = pxsStable(v.x);
          ball.vy = pxsStable(v.y);
        },
        addVelocityVec(ball, vec, speed = 1) {
          const v = api.vec.normalize(vec || { x: 1, y: 0 }, speed);
          return applyVec(ball, v, 1, true);
        },
        launchToward(ball, point, speed = 720) {
          if (!isBallLike(ball) || !point) return;
          const v = api.vec.toward(ball, point, speed);
          ball.vx = pxsStable(v.x);
          ball.vy = pxsStable(v.y);
        },
        setGravityVec(ball, vec, ms = 900) {
          if (!isBallLike(ball)) return;
          const v = api.vec.normalize(vec || { x: 0, y: 1 }, c.field.gravity || 1296);
          return baseBody.setGravity?.(ball, v.x, v.y, ms);
        },
      };
      return api;
    };

    const originalUpdateCodeDeviceMotion = updateCodeDeviceMotion;
    updateCodeDeviceMotion = function stableUpdateCodeDeviceMotion(g, dt) {
      if (!hasCodeDevice(g)) return originalUpdateCodeDeviceMotion(g, dt);
      const before = { x: g.x, y: g.y, angle: g.angle };
      originalUpdateCodeDeviceMotion(g, dt);
      if (state.phase === 'run') {
        g.angle = toRad(g.angle, before.angle || 0);
        if (!Number.isFinite(g.x)) g.x = before.x;
        if (!Number.isFinite(g.y)) g.y = before.y;
      } else {
        g.x = g.homeX ?? g.x;
        g.y = g.homeY ?? g.y;
        g.angle = g.homeAngle ?? g.angle;
      }
    };

    const originalSanitizeZone = sanitizeZone;
    sanitizeZone = function stableSanitizeZone(z) {
      const out = originalSanitizeZone(z);
      if (!out) return out;
      const focused = state.gimmicks.find((g) => hasCodeDevice(g) && g.runtime?.lastZones?.includes(z));
      // Most generated fan zones are authored as device-local directions.
      // If they pass 180/-180, rotate that direction by the device angle.
      if (out.kind === 'fan') {
        const g = state.gimmicks.find((item) => hasCodeDevice(item) && Math.hypot((out.x || 0) - item.x, (out.y || 0) - item.y) < 260);
        if (g) out.angleDeg = Number(out.angleDeg || 0) + (g.angle || 0) * 180 / Math.PI;
      }
      return out;
    };

    const originalDrawCodeDevice = drawCodeDevice;
    drawCodeDevice = function stableDrawCodeDevice(g) {
      const previousFocus = state.focusGimmick;
      const previousPlacing = state.placing;
      if (state.phase === 'run') {
        state.focusGimmick = null;
        state.placing = null;
      }
      try {
        return originalDrawCodeDevice(g);
      } finally {
        state.focusGimmick = previousFocus;
        state.placing = previousPlacing;
      }
    };
  }
  install();
})();
