(() => {
  const nativeFetch = window.fetch.bind(window);

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
    if (next === source) console.warn('[noHand] source polish skipped:', label);
    return next;
  }

  function stableDrawSource() {
    return `function draw() { if (!state) return; fit(); const scale = canvas.width / WORLD.w; const viewH = canvas.height / scale; state.cameraY = clamp(state.cameraY, -120, fallLine() - viewH + 120); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.setLineDash([]); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.scale(scale, scale); ctx.translate(0, -state.cameraY); try { drawField(viewH); state.fieldEmojis.forEach(drawEmoji); state.goals.forEach(drawGoal); state.ownGoals.forEach(drawOwn); for (const gimmick of state.gimmicks.filter((g) => g.placed)) { ctx.save(); try { drawGimmick(gimmick); } catch (error) { console.warn('[noHand] drawGimmick skipped', error); } finally { ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.setLineDash([]); } } state.balls.forEach(drawBall); } finally { ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.setLineDash([]); } }`;
  }

  function startCardDragSource() {
    return `function startCardDrag(event, g) { event.preventDefault(); if (event && event.currentTarget && event.currentTarget.setPointerCapture && event.pointerId != null) { try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {} } state.placing = g.id; state.focusGimmick = g.id; drag = { type: 'new', id: g.id }; showHelp((g.visualLabel || '装置') + 'をコートへドラッグすると設置できます。'); render(); }`;
  }

  function onUpSource() {
    return `function onUp(event) { if (!drag) return; if (drag.type === 'new' && event) { const placingGimmick = state.gimmicks.find((item) => item.id === drag.id); const point = worldFromEvent(event); if (placingGimmick && point.inside) { placingGimmick.x = point.x; placingGimmick.y = point.y; placingGimmick.placed = true; state.focusGimmick = placingGimmick.id; saveGimmickHome(placingGimmick); } } const g = state.gimmicks.find((item) => item.id === drag.id); if (g && g.placed) { saveGimmickHome(g); state.placing = null; state.focusGimmick = g.id; hideHelp(); setCoach('配置完了', (g.visualLabel || '装置') + '：' + (g.shortEffect || 'ボールの動きを変える')); if (state.tutorial === 'place') { showModal('角度も変えられる', '編集もサッカーのうち', '置いたギミックに出ている黄色い「回転」ハンドルをドラッグすると角度が変わります。調整したらキックオフ！', '了解', () => closeModal()); state.tutorial = 'edit'; } } drag = null; render(); draw(); }`;
  }

  function polishSource(source) {
    let out = source;

    out = replaceOne(
      out,
      /function startRun\(\) \{[^\n]+\}/,
      `function startRun() { if (state.phase === 'run' || state.phase === 'between') return; state.gameover = false; state.mainDownNotice = false; resetGimmicksToHome(); state.phase = 'run'; state.runTime = 0; state.balls = [makeBall({ main: true })]; setCoach('キックオフ中', 'この1回のキックオフで、黄色いゴールを全部くぐろう。'); hideHelp(); render(); fitCameraToGoals(); }`,
      'startRun'
    );

    out = replaceOne(
      out,
      /function checkGoals\(\) \{[^\n]+\}/,
      `function bounceGoalBall(ball, goal) { const fromLeft = ball.x < goal.x; const fromTop = ball.y < goal.y; ball.vx += fromLeft ? -2.8 : 2.8; ball.vy = Math.min(ball.vy, fromTop ? -6.2 : -4.8); if (fromTop) ball.y = Math.min(ball.y, goal.y - goal.h / 2 - ball.r - 3); else ball.y = Math.max(ball.y, goal.y + goal.h / 2 + ball.r + 3); }\nfunction checkGoals() { for (const ownGoal of state.ownGoals) { if (state.balls.some((ball) => inRect(ball, ownGoal))) { ownGoalReset(); return; } } let scored = false; for (const goal of state.goals) { if (goal.done) continue; const hitter = state.balls.find((ball) => inRect(ball, goal)); if (!hitter) continue; goal.done = true; scored = true; bounceGoalBall(hitter, goal); toast(\`GOAL \${goal.label}\`); } if (scored) render(); if (state.goals.every((goal) => goal.done)) roundClearSequence(); }`,
      'checkGoals'
    );

    out = replaceOne(
      out,
      /function update\(dt\) \{[^\n]+\}/,
      `function update(dt) { if (state.phase !== 'run') return; state.runTime += dt; for (const gimmick of state.gimmicks) if (gimmick.placed) updateDeviceMotion(gimmick, dt); for (const gimmick of state.gimmicks) if (gimmick.placed) for (const ball of [...state.balls]) applyGimmick(gimmick, ball, dt); for (const ball of [...state.balls]) updateBall(ball, dt); checkCollect(); checkGoals(); const focus = mainBall() || state.balls[0]; if (focus) state.cameraY += (focus.y - canvas.height / (canvas.width / WORLD.w) * 0.45 - state.cameraY) * 0.08; const f = fallLine(); let mainFell = false; let removedClone = false; state.balls = state.balls.filter((ball) => { const dead = ball.y > f || state.runTime >= ball.expiresAt; if (!dead) return true; if (ball.main) mainFell = true; else removedClone = true; return false; }); if (mainFell) { if (state.tutorial === 'intro') { firstFallTutorial(); return; } if (state.balls.length > 0) { if (!state.mainDownNotice) { state.mainDownNotice = true; setCoach('本体が落下。分身継続中', '分身が残っている間は試技を続けます。'); render(); } } else { trialReset('本体が落下。作戦タイム', '本体も分身も残っていないので、ゴール通過はリセット。'); return; } } else if (removedClone && state.balls.length === 0) { trialReset('全ボールが落下。作戦タイム', '分身もすべて落下。次のキックオフで全ゴール通過を狙おう。'); return; } if (state.runTime > 30) trialReset('30秒ゴールなし', 'その試走は終了。ギミックの場所や角度を調整しよう。'); }`,
      'update'
    );

    out = replaceOne(out, /function draw\(\) \{[^\n]+\}/, stableDrawSource(), 'draw');
    out = replaceOne(out, /function startCardDrag\(event, g\) \{[^\n]+\}/, startCardDragSource(), 'startCardDrag');
    out = replaceOne(out, /function onUp\([^)]*\) \{[^\n]+\}/, onUpSource(), 'onUp');

    return out;
  }

  window.fetch = async function polishedFetch(input, init) {
    const response = await nativeFetch(input, init);
    if (!isRuntimeSource(input)) return response;
    try {
      const source = await response.text();
      const polished = polishSource(source);
      return new Response(polished, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      console.warn('[noHand] source polish failed; using original runtime', error);
      return response;
    }
  };
})();

(() => {
  function installCodeToolboxStability() {
    if (typeof hasCodeDevice !== 'function' || typeof compileCodeSnippet !== 'function' || typeof makeCodeApi !== 'function' || typeof bodyZone !== 'function') {
      setTimeout(installCodeToolboxStability, 40);
      return;
    }
    if (window.__noHandCodeToolboxStabilityV3) return;
    window.__noHandCodeToolboxStabilityV3 = true;

    const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const isBallLike = (ball) => ball && Number.isFinite(Number(ball.x)) && Number.isFinite(Number(ball.y));
    const pxsSafe = (value) => clamp(toFinite(value, 0) / 60, -32, 32);
    const fallbackPoint = (g, c) => {
      const b = c?.ball;
      if (isBallLike(b)) return { x: b.x, y: b.y };
      return { x: toFinite(g?.x, 0), y: toFinite(g?.y, 0) };
    };
    const normalizeEffectArgs = (args, g, c) => {
      let out;
      if (args.length === 1 && args[0] && typeof args[0] === 'object') out = { ...args[0] };
      else if (args.length >= 2 && Number.isFinite(Number(args[0])) && Number.isFinite(Number(args[1]))) {
        out = { ...(args[2] && typeof args[2] === 'object' ? args[2] : {}), x: Number(args[0]), y: Number(args[1]) };
      } else out = {};
      const p = fallbackPoint(g, c);
      if (!Number.isFinite(Number(out.x))) out.x = p.x;
      if (!Number.isFinite(Number(out.y))) out.y = p.y;
      return out;
    };

    compileCodeSnippet = function stableCompileCodeSnippet(g, slot, field) {
      const rt = g.runtime || makeRuntime();
      g.runtime = rt;
      rt.compiled = rt.compiled || {};
      const key = `stable-v3:${slot}.${field}`;
      if (rt.compiled[key]) return rt.compiled[key];
      const src = safeCode(g.code?.[slot]?.[field] || '');
      if (!src) return null;
      rt.compiled[key] = new Function('ctx', 'api', `"use strict";\nconst ball = ctx.ball;\nconst balls = ctx.balls;\nconst device = ctx.device;\nconst baseDevice = ctx.baseDevice;\nconst codeState = ctx.state;\nconst localState = ctx.state;\nif (ball && !Number.isFinite(Number(ball.angle))) ball.angle = Math.atan2(ball.vy || 0, ball.vx || 1) * 180 / Math.PI;\n${src}`);
      return rt.compiled[key];
    };

    const originalMakeCodeApi = makeCodeApi;
    makeCodeApi = function stableMakeCodeApi(g, c) {
      const api = originalMakeCodeApi(g, c);
      const body = api.body || {};
      const vec = api.vec || {};
      const addVelocityFinite = (ball, x, y, asImpulse) => {
        if (!isBallLike(ball)) return;
        const fx = toFinite(x, 0);
        const fy = toFinite(y, 0);
        if (asImpulse) { ball.vx += pxsSafe(fx); ball.vy += pxsSafe(fy); }
        else { ball.vx += fx / 60; ball.vy += fy / 60; }
      };
      const scaleVec = (v, amount = 1) => ({ x: toFinite(v?.x, 0) * toFinite(amount, 1), y: toFinite(v?.y, 0) * toFinite(amount, 1) });

      api.body = {
        ...body,
        applyForce(ball, x, y) {
          if (typeof x === 'object') { const v = scaleVec(x, y ?? 1); return addVelocityFinite(ball, v.x, v.y, false); }
          return addVelocityFinite(ball, x, y, false);
        },
        applyImpulse(ball, x, y) {
          if (typeof x === 'object') { const v = scaleVec(x, y ?? 1); return addVelocityFinite(ball, v.x, v.y, true); }
          return addVelocityFinite(ball, x, y, true);
        },
        addVelocity(ball, x, y) {
          if (typeof x === 'object') { const v = scaleVec(x, y ?? 1); return addVelocityFinite(ball, v.x, v.y, true); }
          return addVelocityFinite(ball, x, y, true);
        },
        setVelocity(ball, x, y) {
          if (!isBallLike(ball)) return;
          if (typeof x === 'object') { const v = scaleVec(x, y ?? 1); ball.vx = pxsSafe(v.x); ball.vy = pxsSafe(v.y); return; }
          ball.vx = pxsSafe(x); ball.vy = pxsSafe(y);
        },
        applyForceVec(ball, v, amount = 1) { const s = scaleVec(v, amount); addVelocityFinite(ball, s.x, s.y, false); },
        applyImpulseVec(ball, v, amount = 1) { const s = scaleVec(v, amount); addVelocityFinite(ball, s.x, s.y, true); },
        setVelocityVec(ball, v, speed = 1) {
          if (!isBallLike(ball)) return;
          const n = vec.normalize ? vec.normalize(v || { x: 1, y: 0 }, speed) : scaleVec(v || { x: 1, y: 0 }, speed);
          ball.vx = pxsSafe(n.x); ball.vy = pxsSafe(n.y);
        },
        addVelocityVec(ball, v, speed = 1) {
          const n = vec.normalize ? vec.normalize(v || { x: 1, y: 0 }, speed) : scaleVec(v || { x: 1, y: 0 }, speed);
          addVelocityFinite(ball, n.x, n.y, true);
        },
        launchToward(ball, point, speed = 720) {
          if (!isBallLike(ball) || !point) return;
          const dx = toFinite(point.x, ball.x) - ball.x;
          const dy = toFinite(point.y, ball.y) - ball.y;
          const d = Math.hypot(dx, dy) || 1;
          ball.vx = pxsSafe(dx / d * speed);
          ball.vy = pxsSafe(dy / d * speed);
        },
        setGravityVec(ball, v, ms = 900) {
          if (!isBallLike(ball)) return;
          const n = vec.normalize ? vec.normalize(v || { x: 0, y: 1 }, c.field?.gravity || 1296) : scaleVec(v || { x: 0, y: 1 }, c.field?.gravity || 1296);
          body.setGravity?.(ball, n.x, n.y, ms);
        },
      };

      const baseEffect = api.effect || {};
      api.effect = {
        ...baseEffect,
        particles(...args) { return baseEffect.particles?.(normalizeEffectArgs(args, g, c)); },
        flash(...args) { return baseEffect.flash?.(normalizeEffectArgs(args, g, c)); },
        ring(...args) { return baseEffect.ring?.(normalizeEffectArgs(args, g, c)); },
        emoji(...args) { return baseEffect.emoji?.(normalizeEffectArgs(args, g, c)); },
        text(...args) { return baseEffect.text?.(normalizeEffectArgs(args, g, c)); },
        trail(...args) {
          if (args.length >= 2 && args[0] && typeof args[1] === 'object') return baseEffect.trail?.({ ...normalizeEffectArgs([args[1]], g, c), ball: args[0] });
          return baseEffect.trail?.(normalizeEffectArgs(args, g, c));
        },
      };
      return api;
    };

    const originalBodyZone = bodyZone;
    bodyZone = function stableBodyZone(g) {
      const zone = originalBodyZone(g);
      zone.r = Math.max(zone.r || 0, (g.radius || 72) + 28);
      return zone;
    };

    drawHandle = function stableDrawHandle(g) {
      const r = Math.max(112, (g.radius || 72) + 54);
      ctx.save();
      ctx.strokeStyle = '#e8ff59';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();
      ctx.fillStyle = '#e8ff59';
      ctx.beginPath();
      ctx.arc(r, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#06150e';
      ctx.font = '900 13px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('回転', r, 0);
      ctx.restore();
    };
  }

  installCodeToolboxStability();
})();
