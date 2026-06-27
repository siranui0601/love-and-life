(() => {
  function isPlaceholder(value) {
    const s = String(value || '');
    return !s || s.includes('要約') || s.includes('説明') || s.includes('具体的') || s.includes('接触後のボールの動き');
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

    if (typeof window.handlePos === 'function' && !window.handlePos.__visibleHandlePatched) {
      window.handleRadius = function visibleHandleRadius() { return 104; };
      window.handlePos = function visibleHandlePos(g) {
        return { x: g.x + Math.cos(g.angle) * 104, y: g.y + Math.sin(g.angle) * 104 };
      };
      window.handlePos.__visibleHandlePatched = true;
    }
  }

  let tries = 0;
  const timer = setInterval(() => {
    install();
    tries += 1;
    if (tries > 120) clearInterval(timer);
  }, 50);
})();
