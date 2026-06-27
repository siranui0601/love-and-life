(() => {
  function isPlaceholder(value) {
    const s = String(value || '');
    return !s || s.includes('要約') || s.includes('説明') || s.includes('具体的') || s.includes('接触後のボールの動き');
  }

  function handleRadius(g) {
    try {
      const shape = g?.body?.shape || (typeof window.defaultShapeForMotors === 'function' ? window.defaultShapeForMotors(g?.motors || []) : 'point');
      const size = typeof window.spriteSizeForShape === 'function' ? window.spriteSizeForShape(g, shape) : { w: 92, h: 92 };
      return Math.max(112, Math.hypot(size.w || 92, size.h || 92) * 0.58);
    } catch {
      return 112;
    }
  }

  function install() {
    if (typeof window.makeGimmickFromData === 'function' && !window.makeGimmickFromData.__emojiNamePatched) {
      const original = window.makeGimmickFromData;
      window.makeGimmickFromData = function makeGimmickFromDataWithEmojiName(data, recipe, seed) {
        const g = original(data, recipe, seed);
        const emojiName = Array.isArray(recipe) ? recipe.join('') : String(g.visualLabel || g.name || '');
        if (emojiName) {
          g.name = emojiName;
          g.visualLabel = emojiName;
        }
        if (isPlaceholder(g.shortEffect) || isPlaceholder(g.motion) || isPlaceholder(g.motionIdea)) {
          const motion = (emojiName || '装置') + 'に触れたボールが、落下の勢いを変えて進む。';
          g.motion = motion;
          g.motionIdea = motion;
          g.shortEffect = motion;
        }
        return g;
      };
      window.makeGimmickFromData.__emojiNamePatched = true;
    }

    if (typeof window.handlePos === 'function' && typeof window.drawHandle === 'function' && !window.drawHandle.__unifiedRadiusPatched) {
      window.handleRadius = handleRadius;
      window.handlePos = function unifiedHandlePos(g) {
        const r = handleRadius(g);
        return { x: g.x + Math.cos(g.angle) * r, y: g.y + Math.sin(g.angle) * r };
      };
      window.drawHandle = function unifiedDrawHandle(g) {
        const r = handleRadius(g);
        const hx = Math.cos(g.angle) * r;
        const hy = Math.sin(g.angle) * r;
        window.ctx.save();
        window.ctx.strokeStyle = '#e8ff59';
        window.ctx.lineWidth = 4;
        window.ctx.beginPath();
        window.ctx.moveTo(0, 0);
        window.ctx.lineTo(hx, hy);
        window.ctx.stroke();
        window.ctx.fillStyle = '#e8ff59';
        window.ctx.beginPath();
        window.ctx.arc(hx, hy, 18, 0, Math.PI * 2);
        window.ctx.fill();
        window.ctx.fillStyle = '#06150e';
        window.ctx.font = '900 13px system-ui';
        window.ctx.textAlign = 'center';
        window.ctx.textBaseline = 'middle';
        window.ctx.fillText('回転', hx, hy);
        window.ctx.restore();
      };
      window.drawHandle.__unifiedRadiusPatched = true;
    }
  }

  let tries = 0;
  const timer = setInterval(() => {
    install();
    tries += 1;
    if (tries > 120) clearInterval(timer);
  }, 50);
})();
