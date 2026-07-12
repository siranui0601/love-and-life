(() => {
  function install() {
    if (
      typeof canvas === 'undefined' ||
      typeof ctx === 'undefined' ||
      typeof state === 'undefined' ||
      typeof drawField !== 'function' ||
      typeof worldFromEvent !== 'function'
    ) {
      setTimeout(install, 40);
      return;
    }
    if (window.__noHandPlacementHotfixV1) return;
    window.__noHandPlacementHotfixV1 = true;

    function resetCanvas() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
    }

    draw = function stableDraw() {
      if (!state) return;
      fit();
      const scale = canvas.width / WORLD.w;
      const viewH = canvas.height / scale;
      state.cameraY = clamp(state.cameraY, -120, fallLine() - viewH + 120);
      resetCanvas();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(0, -state.cameraY);
      try {
        drawField(viewH);
        state.fieldEmojis.forEach(drawEmoji);
        state.goals.forEach(drawGoal);
        state.ownGoals.forEach(drawOwn);
        for (const gimmick of state.gimmicks.filter((g) => g.placed)) {
          ctx.save();
          try {
            drawGimmick(gimmick);
          } catch (error) {
            console.warn('[noHand] drawGimmick skipped', error);
          } finally {
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            ctx.setLineDash([]);
          }
        }
        state.balls.forEach(drawBall);
      } finally {
        ctx.restore();
        resetCanvas();
      }
    };

    if (typeof startCardDrag === 'function') {
      const originalStartCardDrag = startCardDrag;
      startCardDrag = function patchedStartCardDrag(event, gimmick) {
        if (event?.currentTarget?.setPointerCapture && event.pointerId != null) {
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
        }
        return originalStartCardDrag(event, gimmick);
      };
    }

    if (typeof onUp === 'function') {
      const originalOnUp = onUp;
      onUp = function patchedOnUp(event) {
        if (drag?.type === 'new' && event) {
          const gimmick = state.gimmicks.find((item) => item.id === drag.id);
          const point = worldFromEvent(event);
          if (gimmick && point.inside) {
            gimmick.x = point.x;
            gimmick.y = point.y;
            gimmick.placed = true;
            state.focusGimmick = gimmick.id;
            if (typeof saveGimmickHome === 'function') saveGimmickHome(gimmick);
          }
        }
        return originalOnUp(event);
      };
    }
  }

  install();
})();
