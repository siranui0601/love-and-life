(() => {
  function install() {
    try {
      if (typeof handleRadius === 'function' && typeof handlePos === 'function' && !handlePos.__angleMatch) {
        const radius = handleRadius;
        handlePos = function handlePosAligned(g) {
          const r = radius(g);
          const a = (g.angle || 0) * 2;
          return { x: g.x + Math.cos(a) * r, y: g.y + Math.sin(a) * r };
        };
        handlePos.__angleMatch = true;
      }
    } catch (error) {
      console.warn('[noHand] runtime postfix skipped', error);
    }
  }
  let tries = 0;
  const timer = setInterval(() => {
    install();
    tries += 1;
    if (tries > 120) clearInterval(timer);
  }, 50);
})();
