(() => {
  const INIT_LF = 'let state = freshState();\nlet drag = null;\nlet modalAction = null;\nlet toastTimer = null;\nlet ballSerial = 1;';
  const INIT_CRLF = 'let state = freshState();\r\nlet drag = null;\r\nlet modalAction = null;\r\nlet toastTimer = null;\r\nlet ballSerial = 1;';
  const INIT_FIXED_LF = 'let ballSerial = 1;\nlet state = freshState();\nlet drag = null;\nlet modalAction = null;\nlet toastTimer = null;';
  const INIT_FIXED_CRLF = 'let ballSerial = 1;\r\nlet state = freshState();\r\nlet drag = null;\r\nlet modalAction = null;\r\nlet toastTimer = null;';

  function replaceRuntime(source, pattern, replacement, label) {
    const next = source.replace(pattern, replacement);
    if (next === source) throw new Error(`Runtime patch failed: ${label}`);
    return next;
  }

  function visualHelpersSource() {
    return `async function requestGeminiGimmick(recipe, fallback) { try { const response = await fetch('/api/nohand-soccer/gimmick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emojis: recipe }) }); if (!response.ok) throw new Error(\`HTTP \${response.status}\`); return await response.json(); } catch (error) { console.warn('[noHand] Gemini gimmick fallback', error); toast('AI生成が混雑中。ローカル生成で続行します。'); return fallback; } }
async function hydrateGimmickVisual(g) { const label = String(g.visualLabel || '').trim(); if (!label) { g.imageSource = 'fallback'; return g; } try { const response = await fetch('/api/nohand-soccer/gimmick-visual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visualLabel: label, shape: g.body?.shape || 'point' }) }); if (!response.ok) throw new Error(\`HTTP \${response.status}\`); const data = await response.json(); if (data?.imageUrl) { g.imageUrl = data.imageUrl; g.originalImageUrl = data.originalImageUrl || ''; g.imageSource = 'generated'; g.imageCached = Boolean(data.cached); warmGimmickImage(g.imageUrl); } else { g.imageSource = 'fallback'; } } catch (error) { console.warn('[noHand] gimmick visual fallback', error); g.imageSource = 'fallback'; } return g; }
function warmGimmickImage(url) { if (!url) return null; let entry = GIMMICK_IMAGE_CACHE.get(url); if (entry) return entry; const image = new Image(); entry = { image, ready: false, failed: false }; image.onload = () => { entry.ready = true; draw(); }; image.onerror = () => { entry.failed = true; draw(); }; image.src = url; GIMMICK_IMAGE_CACHE.set(url, entry); return entry; }
function gimmickImageEntry(g) { if (!g?.imageUrl) return null; return warmGimmickImage(g.imageUrl); }`;
  }

  function patchRuntime(source) {
    let fixed = source;
    if (fixed.includes(INIT_LF)) fixed = fixed.replace(INIT_LF, INIT_FIXED_LF);
    else if (fixed.includes(INIT_CRLF)) fixed = fixed.replace(INIT_CRLF, INIT_FIXED_CRLF);
    else console.warn('[noHand] runtime init patch did not match source.');

    fixed = replaceRuntime(
      fixed,
      /(const LEGACY_KIND_MAP = \{[^\n]+\};)/,
      `$1\nconst DEBUG_NO_HAND = new URLSearchParams(location.search).has('debugNoHand');\nconst GIMMICK_IMAGE_CACHE = new Map();`,
      'visual constants'
    );

    fixed = replaceRuntime(
      fixed,
      /async function generateGimmick\(\) \{[\s\S]*?\nfunction makeGimmickFromData/,
      `async function generateGimmick() { if (state.selected.length !== 3) { toast('絵文字を3つ選んで！'); return; } const recipe = state.selected.map((item) => item.emoji); const seed = hash(recipe.join('|')); const fallback = buildLocalGimmick(recipe, seed); const generated = await requestGeminiGimmick(recipe, fallback); const gimmick = makeGimmickFromData({ ...fallback, ...generated }, recipe, seed); gimmick.imageSource = 'loading'; hydrateGimmickVisual(gimmick).then(() => { render(); draw(); }); state.nextGimmick += 1; state.gimmicks.push(gimmick); for (const item of state.selected) { const index = state.inventory.findIndex((owned) => owned.id === item.id); if (index >= 0) state.inventory.splice(index, 1); } state.selected = []; state.placing = gimmick.id; state.focusGimmick = gimmick.id; setTab('venue'); setCoach('ギミックを設置しよう', \`${'${gimmick.visualLabel}'}：${'${gimmick.shortEffect}'}\`); showHelp(\`「${'${gimmick.name}'}」を設置できます。下のカードを押したままコートへドラッグ。\`); if (state.tutorial === 'generate') { showModal('配置しよう', '会場へ戻った！', '下のギミックカードを押したまま、コートへドラッグして離そう。設置後は本体ドラッグで移動できます。', '配置する', () => closeModal()); state.tutorial = 'place'; } render(); fitCameraToGoals(); }\nfunction makeGimmickFromData`,
      'generate visual hydration'
    );

    fixed = replaceRuntime(
      fixed,
      /function makeGimmickFromData\(data, recipe, seed\) \{[\s\S]*?\nfunction makeRuntime/,
      `function makeGimmickFromData(data, recipe, seed) { const motors = normalizeMotors(data.motors || data.effects || []); const body = normalizeBody(data.body || { shape: data.shape }, motors); const x = 450; const y = 520; const angle = (seed % 360) * Math.PI / 180; return { id: \`g${'${state.nextGimmick}'}\`, recipe, name: String(data.name || \`審議中${'${recipe.join(\'\')}'}\`).slice(0, 24), flavor: String(data.flavor || \`${'${recipe.join(\'\')}'}から生まれたボール細工。\`).slice(0, 80), visualLabel: String(data.visualLabel || '装置').slice(0, 12), shortEffect: String(data.shortEffect || summarizeMotors(motors)).slice(0, 44), body, motors, exit: normalizeExit(data.exit, motors), imageUrl: String(data.imageUrl || ''), originalImageUrl: String(data.originalImageUrl || ''), imageSource: data.imageUrl ? 'generated' : 'pending', imageCached: Boolean(data.imageCached), x, y, homeX: x, homeY: y, angle, homeAngle: angle, placed: false, runtime: makeRuntime() }; }\nfunction makeRuntime`,
      'gimmick image fields'
    );

    fixed = replaceRuntime(
      fixed,
      /function normalizeBody\(body, motors\) \{[\s\S]*?\nfunction normalizeExit/,
      `function normalizeBody(body, motors) { const inferred = defaultShapeForMotors(motors); let shape = normalizeOne(body?.shape, BODY_SHAPES, inferred); const motion = normalizeOne(body?.motion, BODY_MOTIONS, body?.motion || defaultMotionForMotors(motors)); return { shape, solid: shouldBeSolid(shape, motors) || Boolean(body?.solid), size: clamp(Number(body?.size ?? 0.65), 0.35, 1), motion, motionPower: clamp(Number(body?.motionPower ?? 0.55), 0, 1) }; }\nfunction normalizeExit`,
      'solid body normalization'
    );

    fixed = replaceRuntime(
      fixed,
      /async function requestGeminiGimmick\(recipe, fallback\) \{[\s\S]*?\nfunction normalizeMotors/,
      `${visualHelpersSource()}\nfunction normalizeMotors`,
      'visual helper functions'
    );

    fixed = replaceRuntime(
      fixed,
      /function applyExit\(g, ball, distance, dx, dy, dt\) \{[\s\S]*?\nfunction railAssist/,
      `function applyExit(g, ball, distance, dx, dy, dt) { if (!g.exit) return; const range = Math.min(Math.max(...g.motors.map(motorRange), 120), 190); const key = \`exit:${'${ball.id}'}\`; const speed = Math.hypot(ball.vx, ball.vy); if (distance > range) { delete g.runtime.inside[key]; return; } const prev = g.runtime.inside[key] || { t: 0, still: 0, x: ball.x, y: ball.y }; const moved = Math.hypot(ball.x - prev.x, ball.y - prev.y); prev.t += dt; prev.still = moved < 1.8 && speed < 1.35 ? prev.still + dt : 0; prev.x = ball.x; prev.y = ball.y; g.runtime.inside[key] = prev; const dwell = Math.max(Number(g.exit.afterSeconds || 0) + 1.6, 2.8); const trapped = prev.t >= dwell && prev.still >= 1.05 && speed < Math.max(1.15, Number(g.exit.minSpeed || 7.2) * 0.18); if (!trapped) return; const v = motorVector(g, { direction: g.exit.direction === 'angle' ? 'angle' : 'radialOut' }, dx, dy, ball); normalizeLaunch(ball, v, clamp(Number(g.exit.minSpeed || 5.2), 3.8, 5.6)); prev.t = 0; prev.still = 0; }\nfunction railAssist`,
      'strict exit rescue'
    );

    fixed = replaceRuntime(
      fixed,
      /function drawGimmick\(g\) \{[\s\S]*?\nfunction drawMotionPath/,
      `function drawGimmick(g) { const primary = g.motors[0] || { kind: 'launcher', range: 0.5 }; const meta = MOTOR_META[primary.kind] || MOTOR_META.launcher; const shape = g.body?.shape || defaultShapeForMotors(g.motors); const focused = state.focusGimmick === g.id || state.placing === g.id; const editing = state.phase !== 'run' && focused; if (editing) drawMotionPath(g, meta, true); ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.angle); if (!drawGimmickSprite(g, shape)) drawFallbackGimmickBody(g, meta, shape, editing); ctx.restore(); if (editing) { drawSelectionGuide(g, meta, shape); drawHandle(g); drawRangeHints(g, meta, true); } }\nfunction drawGimmickSprite(g, shape) { const entry = gimmickImageEntry(g); if (!entry?.ready || entry.failed) return false; const size = spriteSizeForShape(g, shape); ctx.drawImage(entry.image, -size.w / 2, -size.h / 2, size.w, size.h); return true; }\nfunction spriteSizeForShape(g, shape) { const length = bodyLength(g); if (['line','platform','rail','carrier','arm'].includes(shape)) return { w: length + 24, h: shape === 'arm' ? 82 : 72 }; if (shape === 'gate') return { w: 104, h: 136 }; if (shape === 'fan') return { w: 132, h: 112 }; if (shape === 'area') return { w: 112, h: 112 }; return { w: 92, h: 92 }; }\nfunction drawFallbackGimmickBody(g, meta, shape, editing) { ctx.strokeStyle = meta.color; ctx.fillStyle = \`${'${meta.color}'}33\`; ctx.lineWidth = 6; const length = bodyLength(g); if (shape === 'fan') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 62, -0.62, 0.62); ctx.closePath(); ctx.fill(); ctx.stroke(); if (editing) arrow(70, meta.color); } else if (shape === 'area') { ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } else if (shape === 'gate') { ctx.beginPath(); ctx.ellipse(0, 0, 38, 52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } else if (['line','platform','rail','carrier','arm'].includes(shape)) { ctx.beginPath(); ctx.moveTo(-length / 2, 0); ctx.lineTo(length / 2, 0); ctx.stroke(); if (shape === 'carrier' || shape === 'platform') { round(-length / 2, -18, length, 36, 18); ctx.fill(); ctx.stroke(); } } else { ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (editing) arrow(58, meta.color); } if (editing) { ctx.rotate(-g.angle); ctx.fillStyle = '#fff'; ctx.font = '900 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText(g.visualLabel || meta.label, 0, 64); ctx.rotate(g.angle); } }\nfunction drawSelectionGuide(g, meta, shape) { const size = spriteSizeForShape(g, shape); ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.angle); ctx.strokeStyle = meta.color; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); round(-size.w / 2, -size.h / 2, size.w, size.h, 18); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }\nfunction drawMotionPath`,
      'sprite drawing'
    );

    fixed = replaceRuntime(
      fixed,
      /function drawRangeHints\(g, meta, focused\) \{[\s\S]*?\nfunction drawHandle/,
      `function drawRangeHints(g, meta, focused) { if (!focused || state.phase === 'run') return; const fieldMotors = g.motors.filter((m) => ['fieldForce','gravityShift','dragZone','split'].includes(m.kind)); if (!fieldMotors.length && !(DEBUG_NO_HAND && g.exit)) return; const maxRange = Math.max(...fieldMotors.map(motorRange), DEBUG_NO_HAND && g.exit ? 145 : 0); ctx.save(); ctx.translate(g.x, g.y); ctx.strokeStyle = meta.color; ctx.globalAlpha = 0.16; ctx.lineWidth = 3; ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.arc(0, 0, maxRange, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); if (fieldMotors.length) { ctx.globalAlpha = 0.62; ctx.fillStyle = meta.color; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(\`${'${MOTOR_META[fieldMotors[0].kind]?.label || \'効果\'}'}範囲\`, 0, -maxRange - 10); } ctx.restore(); }\nfunction drawHandle`,
      'range hints without exit label'
    );

    fixed = replaceRuntime(
      fixed,
      /function drawHandle\(g\) \{[\s\S]*?\nfunction arrow/,
      `function drawHandle(g) { const handle = handlePos(g); const startX = g.x + Math.cos(g.angle) * 72; const startY = g.y + Math.sin(g.angle) * 72; ctx.save(); ctx.strokeStyle = 'rgba(232,255,89,.72)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(handle.x, handle.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#e8ff59'; ctx.strokeStyle = '#06150e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(handle.x, handle.y, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#06150e'; ctx.font = '900 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('回転', handle.x, handle.y); ctx.restore(); }\nfunction arrow`,
      'detached edit handle'
    );

    return fixed;
  }

  fetch('./app-runtime.js', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load runtime: ${response.status}`);
      return response.text();
    })
    .then((source) => {
      (0, eval)(patchRuntime(source));
    })
    .catch((error) => {
      console.error('[noHand] runtime boot failed', error);
      const toast = document.querySelector('#toast');
      if (toast) {
        toast.textContent = '起動エラー。ページを再読み込みしてください。';
        toast.hidden = false;
      }
    });
})();
