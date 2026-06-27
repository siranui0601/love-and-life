(() => {
  function genericText(value) {
    return !value || /要約|説明|具体的|接触後のボールの動き/.test(String(value));
  }

  function install() {
    let patched = false;

    if (typeof window.makeGimmickFromData === 'function' && !window.makeGimmickFromData.__emojiNamePatched) {
      const original = window.makeGimmickFromData;
      window.makeGimmickFromData = function patchedMakeGimmickFromData(data, recipe, seed) {
        const g = original(data, recipe, seed);
        const emojiName = Array.isArray(recipe) ? recipe.join('') : (g.visualLabel || g.name || '');
        if (emojiName) {
          g.name = emojiName;
          g.visualLabel = emojiName;
        }
        if (genericText(g.shortEffect) || genericText(g.motion) || genericText(g.motionIdea)) {
          const motion = `${emojiName || '装置'}に触れたボールが、落下の勢いを変えて進む。`;
          g.motion = motion;
          g.motionIdea = motion;
          g.shortEffect = motion;
        }
        return g;
      };
      window.makeGimmickFromData.__emojiNamePatched = true;
      patched = true;
    }

    if (typeof window.handlePos === 'function' && !window.handlePos.__visibleHandlePatched) {
      window.handleRadius = () => 104;
      window.handlePos = function patchedHandlePos(g) {
        return { x: g.x + Math.cos(g.angle) * 104, y: g.y + Math.sin(g.angle) * 104 };
      };
      window.handlePos.__visibleHandlePatched = true;
      patched = true;
    }

    return patched;
  }

  let tries = 0;
  const timer = setInterval(() => {
    install();
    tries += 1;
    if (tries > 120) clearInterval(timer);
  }, 50);
})();
