(() => {
  const upstreamFetch = window.fetch.bind(window);

  function isRuntimeSource(input) {
    const raw = typeof input === 'string' ? input : input?.url;
    if (!raw) return false;
    try {
      const url = new URL(raw, location.href);
      return /\/app-runtime\.js$/.test(url.pathname);
    } catch (_) {
      return String(raw).endsWith('app-runtime.js') || String(raw).includes('app-runtime.js?');
    }
  }

  function replaceOne(source, pattern, replacement, label) {
    const next = source.replace(pattern, replacement);
    if (next === source) console.warn('[noHand] placement hotfix skipped:', label);
    return next;
  }

  function stableDrawSource() {
    return `function draw() { if (!state) return; fit(); const scale = canvas.width / WORLD.w; const viewH = canvas.height / scale; state.cameraY = clamp(state.cameraY, -120, fallLine() - viewH + 120); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.setLineDash([]); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.scale(scale, scale); ctx.translate(0, -state.cameraY); try { drawField(viewH); state.fieldEmojis.forEach(drawEmoji); state.goals.forEach(drawGoal); state.ownGoals.forEach(drawOwn); for (const gimmick of state.gimmicks.filter((g) => g.placed)) { ctx.save(); try { drawGimmick(gimmick); } catch (error) { console.warn('[noHand] drawGimmick skipped', error); } finally { ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.setLineDash([]); } } state.balls.forEach(drawBall); } finally { ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.setLineDash([]); } }`;
  }

  function startCardDragSource() {
    return `function startCardDrag(event, g) { event.preventDefault(); if (event?.currentTarget?.setPointerCapture && event.pointerId != null) { try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {} } state.placing = g.id; state.focusGimmick = g.id; drag = { type: 'new', id: g.id }; showHelp(\`${'${g.visualLabel || \'装置\'}'}をコートへドラッグすると設置できます。\`); render(); }`;
  }

  function onUpSource() {
    return `function onUp(event) { if (!drag) return; if (drag.type === 'new' && event) { const placingGimmick = state.gimmicks.find((item) => item.id === drag.id); const point = worldFromEvent(event); if (placingGimmick && point.inside) { placingGimmick.x = point.x; placingGimmick.y = point.y; placingGimmick.placed = true; state.focusGimmick = placingGimmick.id; saveGimmickHome(placingGimmick); } } const g = state.gimmicks.find((item) => item.id === drag.id); if (g && g.placed) { saveGimmickHome(g); state.placing = null; state.focusGimmick = g.id; hideHelp(); setCoach('配置完了', \`${'${g.visualLabel || \'装置\'}'}：${'${g.shortEffect || \'ボールの動きを変える\'}'}\`); if (state.tutorial === 'place') { showModal('角度も変えられる', '編集もサッカーのうち', '置いたギミックに出ている黄色い「回転」ハンドルをドラッグすると角度が変わります。調整したらキックオフ！', '了解', () => closeModal()); state.tutorial = 'edit'; } } drag = null; render(); draw(); }`;
  }

  function patchSource(source) {
    let out = source;
    out = replaceOne(out, /function draw\(\) \{[^\n]+\}/, stableDrawSource(), 'draw');
    out = replaceOne(out, /function startCardDrag\(event, g\) \{[^\n]+\}/, startCardDragSource(), 'startCardDrag');
    out = replaceOne(out, /function onUp\([^)]*\) \{[^\n]+\}/, onUpSource(), 'onUp');
    return out;
  }

  window.fetch = async function placementHotfixFetch(input, init) {
    const response = await upstreamFetch(input, init);
    if (!isRuntimeSource(input)) return response;
    try {
      const source = await response.text();
      const patched = patchSource(source);
      return new Response(patched, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      console.warn('[noHand] placement hotfix failed; using upstream runtime', error);
      return response;
    }
  };
})();
