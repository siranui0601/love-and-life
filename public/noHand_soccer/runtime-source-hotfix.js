(() => {
  function install() {
    if (typeof canvas === 'undefined' || typeof state === 'undefined' || typeof draw !== 'function') {
      setTimeout(install, 40);
      return;
    }
    if (window.__noHandPlacementHotfix) return;
    window.__noHandPlacementHotfix = true;

    const resetCanvasState = () => {
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      } catch (_) {}
    };

    const originalDraw = draw;
    draw = function guardedDraw() {
      resetCanvasState();
      try {
        return originalDraw();
      } finally {
        resetCanvasState();
      }
    };

    if (typeof startCardDrag === 'function') {
      const originalStartCardDrag = startCardDrag;
      startCardDrag = function hotfixStartCardDrag(event, g) {
        if (event?.currentTarget?.setPointerCapture && event.pointerId != null) {
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
        }
        return originalStartCardDrag(event, g);
      };
    }

    if (typeof onUp === 'function' && typeof worldFromEvent === 'function') {
      const originalOnUp = onUp;
      onUp = function hotfixOnUp(event) {
        if (drag && drag.type === 'new' && event) {
          const g = state.gimmicks.find((item) => item.id === drag.id);
          const point = worldFromEvent(event);
          if (g && point.inside) {
            g.x = point.x;
            g.y = point.y;
            g.placed = true;
            state.focusGimmick = g.id;
            if (typeof saveGimmickHome === 'function') saveGimmickHome(g);
          }
        }
        return originalOnUp(event);
      };
    }
  }
  install();
})();
