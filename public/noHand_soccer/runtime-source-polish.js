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
      /function splitBall\(ball, g, motor\) \{[^\n]+\}/,
      `function splitBall(ball, g, motor) { if (state.balls.length >= 10) return; const count = Math.round(clamp(motor.count || 2, 2, 4)); const baseSpeed = Math.max(8.4, Math.hypot(ball.vx, ball.vy) * 1.08, motorPower(motor, 9.8)); const baseAngle = Math.atan2(ball.vy, ball.vx) || g.angle; const spread = (motor.spreadAngle || 44) * Math.PI / 180; const life = clamp(motor.duration || 3.8, 1.2, 6.5); for (let i = 0; i < count - 1 && state.balls.length < 10; i += 1) { const offset = (i - (count - 2) / 2) * spread; const angle = baseAngle + offset; state.balls.push(makeBall({ main: false, generation: ball.generation + 1, x: ball.x + Math.cos(angle) * 18, y: ball.y + Math.sin(angle) * 18, vx: Math.cos(angle) * baseSpeed, vy: Math.sin(angle) * baseSpeed, expiresAt: state.runTime + life })); } const selfAngle = baseAngle - spread * 0.45; ball.vx = Math.cos(selfAngle) * baseSpeed; ball.vy = Math.sin(selfAngle) * baseSpeed; toast('分裂！'); }`,
      'splitBall'
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

    out += `\n\n// Injected by runtime-source-polish.js after app-runtime-boot patches this source.\nfunction applyImpulseToward(ball, target, power) { const dx = target.x - ball.x; const dy = target.y - ball.y; const d = Math.hypot(dx, dy) || 1; const p = Number.isFinite(Number(power)) ? clamp(Number(power) / 100, 0.12, 1.2) : 0.82; const speed = 8 + p * 9.5; ball.vx = ball.vx * 0.16 + dx / d * speed; ball.vy = ball.vy * 0.16 + dy / d * speed; }\nfunction splitPrimitiveBall(g, ball, beat, actor) { const split = beat.split || {}; const count = Math.round(clamp(Number(split.count || 2), 2, 4)); if (state.balls.length >= 10) return; const speed = Math.max(9.2, Math.hypot(ball.vx, ball.vy) * 1.12, 9.8); const spread = clamp(Number(split.spread || 60), 16, 100) / 100; const origin = actorWorldPoint(g, actor); const base = Math.atan2(ball.vy, ball.vx || 1); for (let i = 1; i < count && state.balls.length < 10; i += 1) { const centered = count <= 2 ? (i === 1 ? 1 : -1) : ((i - 1) / Math.max(1, count - 2)) * 2 - 1; const angle = base + centered * spread * 0.95; state.balls.push(makeBall({ main: false, generation: ball.generation + 1, x: origin.x + Math.cos(angle) * 24, y: origin.y + Math.sin(angle) * 24, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, expiresAt: state.runTime + 6.5 })); } ball.vx *= 1.05; ball.vy *= 1.05; toast('分裂！'); }\n`;

    return out;
  }

  window.fetch = async function patchedFetch(input, init) {
    const response = await nativeFetch(input, init);
    if (!isRuntimeSource(input)) return response;
    try {
      const source = await response.text();
      const polished = polishSource(source);
      return new Response(polished, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) {
      console.warn('[noHand] source polish failed; using original runtime', error);
      return response;
    }
  };
})();
