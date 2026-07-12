(() => {
  function install() {
    if (typeof updateCodeDeviceMotion !== 'function' || typeof drawCodeDevice !== 'function' || typeof handlePos !== 'function') {
      setTimeout(install, 50);
      return;
    }
    if (window.__noHandCodeToolboxRuntimeFixInstalled) return;
    window.__noHandCodeToolboxRuntimeFixInstalled = true;

    const originalUpdateCodeDeviceMotion = updateCodeDeviceMotion;
    const originalDrawCodeDevice = drawCodeDevice;

    updateCodeDeviceMotion = function patchedUpdateCodeDeviceMotion(g, dt) {
      if (typeof hasCodeDevice === 'function' && hasCodeDevice(g) && state.phase !== 'run') {
        const rt = g.runtime || makeRuntime();
        g.runtime = rt;
        rt.dx = 0;
        rt.dy = 0;
        g.x = g.x ?? g.homeX;
        g.y = g.y ?? g.homeY;
        g.scaleX = g.scaleX || 1;
        g.scaleY = g.scaleY || 1;
        g.radius = g.radius || 72;
        return;
      }
      return originalUpdateCodeDeviceMotion(g, dt);
    };

    drawCodeDevice = function patchedDrawCodeDevice(g) {
      const rt = g.runtime || makeRuntime();
      g.runtime = rt;
      if (state.phase !== 'run') rt.effects = [];
      const result = originalDrawCodeDevice(g);
      if (state.phase !== 'run') rt.effects = [];
      return result;
    };

    handlePos = function patchedHandlePos(g) {
      const r = Math.max(112, (g.radius || 72) + 54);
      return {
        x: g.x + Math.cos(g.angle || 0) * r,
        y: g.y + Math.sin(g.angle || 0) * r,
      };
    };
  }

  install();
})();
