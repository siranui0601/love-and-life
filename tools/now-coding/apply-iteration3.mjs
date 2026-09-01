import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value, "utf8"); }
function replaceOne(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, got ${count}`);
  return source.replace(before, after);
}
function appendOnce(source, marker, content) {
  return source.includes(marker) ? source : `${source.trimEnd()}\n\n${content.trim()}\n`;
}

// Shared interpreter: mode-specific sensors, built-in physical values, and ranged attack actions.
{
  const path = "public/now-coding/engine.js";
  let s = read(path);
  s = replaceOne(s,
    '  if (expr.type === "var") return context.agent.vars[String(expr.name || "")] ?? 0;\n  if (expr.type === "sensor") return senseCell(context.state, context.agent, expr.direction || "front").state;',
    '  if (expr.type === "var") return context.agent.vars[String(expr.name || "")] ?? 0;\n  if (expr.type === "builtin") {\n    if (expr.name === "ink") return Number(context.agent.ink || 0);\n    if (expr.name === "tailLength") return Array.isArray(context.agent.tail) ? context.agent.tail.length : 0;\n    if (expr.name === "noMoveTicks") return Number(context.agent.noMoveTicks || 0);\n    return 0;\n  }\n  if (expr.type === "sensor") return context.sense(context.state, context.agent, expr.direction || "front").state;',
    "engine sensor context");
  s = replaceOne(s,
    '  if (statement.type === "action") return ["move", "turnLeft", "turnRight"].includes(statement.action) ? statement.action : "move";',
    '  if (statement.type === "action") {\n    if (statement.action === "attack") {\n      const range = Math.max(1, Math.min(20, Math.floor(Number(evaluateExpression(statement.range ?? 1, context, budget)) || 1)));\n      return { type: "attack", range };\n    }\n    return ["move", "turnLeft", "turnRight"].includes(statement.action) ? statement.action : "move";\n  }',
    "engine attack action");
  s = replaceOne(s,
    'export function decideAction(state, agent, instructionBudget = 10000) {\n  if (!agent.alive) return "none";\n  const program = agent.program;\n  if (!program.length) return "none";\n  const budget = { count: 0, limit: instructionBudget };\n  const context = { state, agent };',
    'export function decideAction(state, agent, instructionBudget = 10000, options = {}) {\n  if (!agent.alive) return "none";\n  const program = agent.program;\n  if (!program.length) return "none";\n  const budget = { count: 0, limit: instructionBudget };\n  const context = { state, agent, sense: typeof options.sense === "function" ? options.sense : senseCell };',
    "engine decide options");
  s = replaceOne(s,
    '    const action = decideAction(state, agent);\n    actions.set(agent.id, action);\n    agent.lastAction = action;',
    '    let action = decideAction(state, agent);\n    for (let skipped = 0; skipped < 64 && typeof action === "object" && action?.type === "attack"; skipped += 1) {\n      action = decideAction(state, agent);\n    }\n    actions.set(agent.id, action);\n    agent.lastAction = action;',
    "territory zero-tick attack skip");
  write(path, s);
}

// Client integration: all modes + automatic and selectable tutorials.
{
  const path = "public/now-coding/app.js";
  let s = read(path);
  s = replaceOne(s,
    '} from "./engine.js";\n\nconst GOOGLE_CLIENT_ID',
    '} from "./engine.js";\nimport { MODE_LABELS, MODE_RULE_VERSION, createGameState, gameResults, makeModeNpcProgram, stepGame } from "./modes.js";\nimport { TUTORIALS, tutorialById } from "./tutorials.js";\n\nconst GOOGLE_CLIENT_ID',
    "app mode imports");
  s = replaceOne(s,
    'const CELL_LABELS = { unclaimed: "未取得", own: "自分の色", enemy: "敵の色／壁", cliff: "崖", player: "駒" };',
    'const CELL_LABELS = { unclaimed: "未取得／空き", own: "自分の色", enemy: "敵の色", cliff: "崖", player: "駒", ownTail: "自分の尾", enemyTail: "敵の尾" };\nconst BUILTIN_LABELS = { ink: "インク", tailLength: "尾の長さ" };',
    "app cell labels");
  s = replaceOne(s,
    '  battleKind: "npc",\n  testTimer:',
    '  battleKind: "npc",\n  selectedMode: "territory",\n  optionalTutorial: null,\n  testTimer:',
    "app state mode");
  s = replaceOne(s,
    '    updateTutorialGate();\n    connectOnline();',
    '    updateTutorialGate();\n    connectOnline();\n    if (isTutorialLocked()) requestAnimationFrame(() => startTutorial());',
    "auto tutorial");
  s = replaceOne(s,
    '      row.innerHTML = `<div><strong>${mine ? `${mine.rank}位 / ${mine.claimed}マス` : "陣取り"}</strong><br><small>${escapeHtml(formatDate(match.createdAt))} ・ Seed ${escapeHtml(match.seed)}</small></div><button class="text-button" type="button" ${isTutorialLocked() ? "disabled" : ""}>再生</button>`;',
    '      const metric = mine?.metric || (Number.isFinite(mine?.claimed) ? `${mine.claimed}マス` : Number.isFinite(mine?.colored) ? `${mine.colored}マス` : Number.isFinite(mine?.survivedTicks) ? `${mine.survivedTicks}tick 生存` : "記録あり");\n      row.innerHTML = `<div><strong>${mine ? `${mine.rank}位 / ${metric}` : (MODE_LABELS[match.mode] || "対戦")}</strong><br><small>${escapeHtml(formatDate(match.createdAt))} ・ ${escapeHtml(MODE_LABELS[match.mode] || "陣取り")} ・ Seed ${escapeHtml(match.seed)}</small></div><button class="text-button" type="button" ${isTutorialLocked() ? "disabled" : ""}>再生</button>`;',
    "home match metric");

  const tutorialRuntime = `function clearOptionalTutorialFocus() {
  $$(".lesson-target").forEach((node) => node.classList.remove("lesson-target"));
}

function openTutorialLibrary() {
  if (isTutorialLocked()) return;
  const grid = $("#tutorialLibraryGrid");
  grid.innerHTML = "";
  for (const tutorial of TUTORIALS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tutorial-library-card";
    button.innerHTML = \`<span class="tutorial-card-scan" aria-hidden="true"></span><strong>\${escapeHtml(tutorial.title)}</strong><small>\${escapeHtml(tutorial.summary)}</small>\`;
    button.addEventListener("click", () => startOptionalTutorial(tutorial.id));
    grid.appendChild(button);
  }
  setModal("#tutorialLibraryModal", true);
}

function startOptionalTutorial(id) {
  const tutorial = tutorialById(id);
  if (!tutorial) return;
  setModal("#tutorialLibraryModal", false);
  appState.optionalTutorial = { id, step: 0 };
  if (tutorial.battleKind) setBattleKind(tutorial.battleKind);
  if (tutorial.view) showView(tutorial.view, { force: true });
  if (tutorial.mode) selectBattleMode(tutorial.mode);
  renderOptionalTutorial();
}

function renderOptionalTutorial() {
  clearOptionalTutorialFocus();
  const coach = $("#optionalTutorialCoach");
  const active = appState.optionalTutorial;
  if (!coach || !active) { coach?.classList.add("is-hidden"); return; }
  const tutorial = tutorialById(active.id);
  if (!tutorial) { appState.optionalTutorial = null; coach.classList.add("is-hidden"); return; }
  const step = Math.max(0, Math.min(tutorial.steps.length - 1, Number(active.step) || 0));
  active.step = step;
  const item = tutorial.steps[step];
  $("#optionalTutorialProgress").textContent = \`\${step + 1} / \${tutorial.steps.length}\`;
  $("#optionalTutorialName").textContent = tutorial.title;
  $("#optionalTutorialTitle").textContent = item.title;
  $("#optionalTutorialText").textContent = item.text;
  $("#optionalTutorialPrev").disabled = step === 0;
  $("#optionalTutorialNext").textContent = step === tutorial.steps.length - 1 ? "完了" : "次へ";
  coach.classList.remove("is-hidden");
  if (item.focus) {
    const target = $(item.focus);
    target?.classList.add("lesson-target");
    target?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }
}

function moveOptionalTutorial(delta) {
  const active = appState.optionalTutorial;
  if (!active) return;
  const tutorial = tutorialById(active.id);
  if (!tutorial) return closeOptionalTutorial();
  const next = active.step + delta;
  if (next >= tutorial.steps.length) return closeOptionalTutorial();
  active.step = Math.max(0, next);
  renderOptionalTutorial();
}

function closeOptionalTutorial() {
  clearOptionalTutorialFocus();
  appState.optionalTutorial = null;
  $("#optionalTutorialCoach")?.classList.add("is-hidden");
}

`;
  s = replaceOne(s, 'function showView(name, { force = false } = {}) {', `${tutorialRuntime}function showView(name, { force = false } = {}) {`, "optional tutorial runtime");
  s = replaceOne(s,
    '  renderTutorialCoach();\n  window.scrollTo({ top: 0, behavior: "smooth" });',
    '  renderTutorialCoach();\n  renderOptionalTutorial();\n  window.scrollTo({ top: 0, behavior: "smooth" });',
    "show optional tutorial");

  s = replaceOne(s,
    'function createBlock(type) {\n  if (["move", "turnLeft", "turnRight"].includes(type)) return actionNode(type);',
    'function createBlock(type) {\n  if (["move", "turnLeft", "turnRight"].includes(type)) return actionNode(type);\n  if (type === "attack") return { type: "action", action: "attack", uiKind: "attack", range: literal(3) };\n  if (type === "ifBuiltin") return { type: "if", uiKind: "builtinCompare", builtinName: "ink", compareOp: ">", compareValue: 0, condition: { type: "binary", op: ">", left: { type: "builtin", name: "ink" }, right: literal(0) }, then: [actionNode("move")], else: [actionNode("turnRight")] };',
    "new blocks");
  s = replaceOne(s,
    '  if (block.type === "action") {\n    const strong = document.createElement("strong");\n    strong.textContent = ACTION_LABELS[block.action] || "進む";\n    content.appendChild(strong);\n    return content;\n  }',
    '  if (block.type === "action") {\n    if (block.action === "attack") {\n      block.uiKind = "attack";\n      content.append("前方へ 射程 ", numberInput(block.range?.value ?? 3, (v) => { block.range = literal(Math.max(1, v)); }, { min: 1, max: 20, width: "66px" }), " で攻撃");\n      return content;\n    }\n    const strong = document.createElement("strong");\n    strong.textContent = ACTION_LABELS[block.action] || "進む";\n    content.appendChild(strong);\n    return content;\n  }',
    "attack block renderer");
  s = replaceOne(s,
    '  if (block.uiKind === "variableCompare") {',
    '  if (block.uiKind === "builtinCompare") {\n    const refresh = () => { block.condition = { type: "binary", op: block.compareOp, left: { type: "builtin", name: block.builtinName }, right: literal(block.compareValue) }; };\n    content.append("もし ", selectFrom(Object.entries(BUILTIN_LABELS), block.builtinName || "ink", (v) => { block.builtinName = v; refresh(); }), " が ");\n    content.append(selectFrom(Object.entries(COMPARE_LABELS), block.compareOp || ">", (v) => { block.compareOp = v; refresh(); }));\n    content.append(numberInput(block.compareValue ?? 0, (v) => { block.compareValue = v; refresh(); }), " なら ", actionSelect(block.then?.[0]?.action || "move", (v) => { block.then = [actionNode(v)]; }), " ／ そうでなければ ", actionSelect(block.else?.[0]?.action || "turnRight", (v) => { block.else = [actionNode(v)]; }));\n    return content;\n  }\n  if (block.uiKind === "variableCompare") {',
    "builtin renderer");

  s = replaceOne(s,
    'function renderBoard(element, state, previousBoard = null) {\n  ensureBoardCells(element, state.size);\n  const cells = element.children;\n  const occupied = new Map(state.agents.filter((agent) => agent.alive).map((agent) => [`${agent.x},${agent.y}`, agent]));\n  for (let y = 0; y < state.size; y += 1) {\n    for (let x = 0; x < state.size; x += 1) {\n      const index = y * state.size + x;\n      const cell = cells[index];\n      const owner = state.board[y][x];\n      const color = owner >= 0 ? state.agents[owner]?.color : "";\n      cell.className = `board-cell${color ? ` claim-${color}` : ""}`;\n      if (previousBoard && previousBoard[y]?.[x] !== owner && owner >= 0) cell.classList.add("just-claimed");\n      cell.innerHTML = "";\n      const agent = occupied.get(`${x},${y}`);\n      if (agent) {\n        const piece = document.createElement("span");\n        piece.className = `piece ${agent.color} dir-${agent.dir}`;\n        piece.title = agent.name;\n        cell.appendChild(piece);\n      }\n    }\n  }\n}',
    'function renderBoard(element, state, previousBoard = null) {\n  ensureBoardCells(element, state.size);\n  const cells = element.children;\n  const occupied = new Map(state.agents.filter((agent) => agent.alive).map((agent) => [`${agent.x},${agent.y}`, agent]));\n  const tails = new Map();\n  for (const agent of state.agents) for (const tail of (agent.tail || [])) tails.set(`${tail.x},${tail.y}`, agent.color);\n  const effects = new Map((state.effects || []).map((effect) => [`${effect.x},${effect.y}`, effect]));\n  for (let y = 0; y < state.size; y += 1) {\n    for (let x = 0; x < state.size; x += 1) {\n      const index = y * state.size + x;\n      const cell = cells[index];\n      const owner = state.board?.[y]?.[x] ?? -1;\n      const color = owner >= 0 ? state.agents[owner]?.color : "";\n      cell.className = `board-cell${color ? ` claim-${color}` : ""}`;\n      if (state.holes?.has(`${x},${y}`)) cell.classList.add("is-hole");\n      const effect = effects.get(`${x},${y}`);\n      if (effect?.type === "shot") cell.classList.add("attack-flash", `attack-${effect.color}`);\n      if (effect?.type === "collapse") cell.classList.add("collapse-flash");\n      if (previousBoard && previousBoard[y]?.[x] !== owner && owner >= 0) cell.classList.add("just-claimed");\n      cell.innerHTML = "";\n      const tailColor = tails.get(`${x},${y}`);\n      if (tailColor) { const tail = document.createElement("span"); tail.className = `tail-piece ${tailColor}`; cell.appendChild(tail); }\n      const agent = occupied.get(`${x},${y}`);\n      if (agent) {\n        const piece = document.createElement("span");\n        piece.className = `piece ${agent.color} dir-${agent.dir}`;\n        piece.title = agent.name;\n        cell.appendChild(piece);\n      }\n    }\n  }\n}',
    "generic board renderer");

  const oldBattleFunctions = `function makeBattlePlayers(program, count, difficulty) {
  const players = [{ id: appState.user.userTrackingId, userTrackingId: appState.user.userTrackingId, name: appState.user.username, color: PLAYER_COLORS[0], program: structuredClone(program.blocks) }];
  for (let i = 1; i < count; i += 1) {
    players.push({ id: \`npc-\${difficulty}-\${i}\`, userTrackingId: "", name: \`NPC・\${NPC_LABELS[difficulty] || "中"} \${i}\`, color: PLAYER_COLORS[i], program: makeNpcProgram(difficulty, i), npcDifficulty: difficulty });
  }
  return players;
}

function renderBattleSummary() {
  const program = appState.programs.find((entry) => entry.programId === appState.selectedProgramId);
  const seed = $("#seedInput").value.trim() || "自動生成";
  const difficulty = $("#npcDifficulty").value;
  $("#battleSummary").innerHTML = [
    ["対戦方法", "NPC対戦"], ["モード", "陣取り"], ["人数", \`\${$("#playerCount").value}人\`], ["盤面", \`\${$("#boardSize").value} × \${$("#boardSize").value}\`], ["NPC", NPC_LABELS[difficulty]], ["使用する駒", program?.name || "未選択"], ["Seed", seed],
  ].map(([label, value]) => \`<div class="summary-row"><span>\${escapeHtml(label)}</span><strong>\${escapeHtml(value)}</strong></div>\`).join("");
}
`;
  const newBattleFunctions = `function selectBattleMode(mode) {
  if (!MODE_LABELS[mode]) mode = "territory";
  appState.selectedMode = mode;
  $$("[data-mode]").forEach((card) => card.classList.toggle("is-selected", card.dataset.mode === mode));
  if ($("#onlineMode")) $("#onlineMode").value = mode;
  if (appState.battleStep === 3) renderBattleSummary();
}

function makeBattlePlayers(program, count, difficulty) {
  const players = [{ id: appState.user.userTrackingId, userTrackingId: appState.user.userTrackingId, name: appState.user.username, color: PLAYER_COLORS[0], program: structuredClone(program.blocks) }];
  for (let i = 1; i < count; i += 1) {
    players.push({ id: \`npc-\${appState.selectedMode}-\${difficulty}-\${i}\`, userTrackingId: "", name: \`NPC・\${NPC_LABELS[difficulty] || "中"} \${i}\`, color: PLAYER_COLORS[i], program: makeModeNpcProgram(appState.selectedMode, difficulty, i), npcDifficulty: difficulty });
  }
  return players;
}

function renderBattleSummary() {
  const program = appState.programs.find((entry) => entry.programId === appState.selectedProgramId);
  const seed = $("#seedInput").value.trim() || "自動生成";
  const difficulty = $("#npcDifficulty").value;
  $("#battleSummary").innerHTML = [
    ["対戦方法", "NPC対戦"], ["モード", MODE_LABELS[appState.selectedMode]], ["人数", \`\${$("#playerCount").value}人\`], ["盤面", \`\${$("#boardSize").value} × \${$("#boardSize").value}\`], ["NPC", NPC_LABELS[difficulty]], ["使用する駒", program?.name || "未選択"], ["Seed", seed],
  ].map(([label, value]) => \`<div class="summary-row"><span>\${escapeHtml(label)}</span><strong>\${escapeHtml(value)}</strong></div>\`).join("");
}
`;
  s = replaceOne(s, oldBattleFunctions, newBattleFunctions, "battle mode selector");

  s = replaceOne(s,
    '  startBattle({ seed, size, players: makeBattlePlayers(program, count, difficulty), maxTicks: Math.max(420, size * size * 2) });',
    '  startBattle({ mode: appState.selectedMode, seed, size, players: makeBattlePlayers(program, count, difficulty), maxTicks: Math.max(500, size * size * 2) });',
    "start npc mode");
  s = replaceOne(s,
    '  const state = createTerritoryState({ seed: config.seed || freshSeed(), size: Number(config.size || 21), players: config.players || [], spawns: config.spawns || null, maxTicks: config.maxTicks || Math.max(420, Number(config.size || 21) ** 2 * 2), stagnationTicks: 140 });',
    '  const state = createGameState({ mode: config.mode || "territory", seed: config.seed || freshSeed(), size: Number(config.size || 21), players: config.players || [], spawns: config.spawns || null, maxTicks: config.maxTicks || Math.max(500, Number(config.size || 21) ** 2 * 2), stagnationTicks: 140 });\n  appState.selectedMode = state.mode;',
    "generic create state");
  s = replaceOne(s,
    '  appState.lastBattleConfig = replay || online ? null : { seed: state.seed, size: state.size, players: structuredClone(config.players), spawns: structuredClone(state.spawns), maxTicks: state.maxTicks };',
    '  appState.lastBattleConfig = replay || online ? null : { mode: state.mode, seed: state.seed, size: state.size, players: structuredClone(config.players), spawns: structuredClone(state.spawns), maxTicks: state.maxTicks };',
    "remember mode");
  s = replaceOne(s,
    '    stepTerritory(state);',
    '    stepGame(state);',
    "battle generic step");
  s = replaceOne(s,
    '  const results = territoryResults(state).sort((a, b) => a.rank - b.rank);\n  $("#scoreHud").innerHTML = results.map((result) => `<span class="score-chip" style="color:var(--${result.color === "blue" ? "blue-player" : result.color === "red" ? "red-player" : result.color === "yellow" ? "yellow-player" : "green-player"})"><i class="score-dot"></i>${escapeHtml(result.name)} ${result.claimed}</span>`).join("");',
    '  const results = gameResults(state).sort((a, b) => a.rank - b.rank);\n  $("#scoreHud").innerHTML = results.map((result) => `<span class="score-chip" style="color:var(--${result.color === "blue" ? "blue-player" : result.color === "red" ? "red-player" : result.color === "yellow" ? "yellow-player" : "green-player"})"><i class="score-dot"></i>${escapeHtml(result.name)} ${escapeHtml(result.metric || String(result.score ?? ""))}${Number.isFinite(result.ink) ? ` ・ Ink ${result.ink}` : ""}</span>`).join("");',
    "generic hud");
  s = replaceOne(s,
    '  const results = territoryResults(state);',
    '  const results = gameResults(state);',
    "generic finish results");
  s = replaceOne(s,
    '      body: JSON.stringify({ userTrackingId: appState.user.userTrackingId, mode: "territory", seed: state.seed, settings: { size: state.size, playerCount: state.agents.length, maxTicks: state.maxTicks, online }, participants, results, programs, spawn: state.spawns, durationTicks: state.tick, finishReason: state.finishReason, ruleVersion: NOW_CODING_RULE_VERSION }),',
    '      body: JSON.stringify({ userTrackingId: appState.user.userTrackingId, mode: state.mode, seed: state.seed, settings: { size: state.size, playerCount: state.agents.length, maxTicks: state.maxTicks, online }, participants, results, programs, spawn: state.spawns, durationTicks: state.tick, finishReason: state.finishReason, ruleVersion: MODE_RULE_VERSION[state.mode] || NOW_CODING_RULE_VERSION }),',
    "save generic mode");
  s = replaceOne(s,
    '    appState.matches.unshift({ matchId: data.matchId, replayId: data.replayId, seed: state.seed, mode: "territory", settings: { size: state.size }, participants, results, createdAt: data.createdAt });',
    '    appState.matches.unshift({ matchId: data.matchId, replayId: data.replayId, seed: state.seed, mode: state.mode, settings: { size: state.size }, participants, results, createdAt: data.createdAt });',
    "local match mode");
  s = replaceOne(s,
    '  $("#resultRows").innerHTML = results.map((result) => `<div class="result-row"><span class="place">${String(result.rank).padStart(2, "0")}</span><strong>${escapeHtml(result.name)}</strong><span>${result.claimed}マス${result.alive ? "" : "・停止"}</span></div>`).join("");',
    '  $("#resultRows").innerHTML = results.map((result) => `<div class="result-row"><span class="place">${String(result.rank).padStart(2, "0")}</span><strong>${escapeHtml(result.name)}</strong><span>${escapeHtml(result.metric || String(result.score ?? ""))}${result.alive ? "" : "・停止"}</span></div>`).join("");',
    "generic result metric");
  s = replaceOne(s,
    '    startBattle({ seed: replay.seed, size: Number(replay.settings?.size || 21), players, spawns: replay.spawn, maxTicks: Number(replay.settings?.maxTicks || 600) }, { replay: true });',
    '    startBattle({ mode: replay.mode || "territory", seed: replay.seed, size: Number(replay.settings?.size || 21), players, spawns: replay.spawn, maxTicks: Number(replay.settings?.maxTicks || 600) }, { replay: true });',
    "replay mode");
  s = replaceOne(s,
    '    card.innerHTML = `<span class="room-live-dot"></span><div><strong>${escapeHtml(room.hostName || "ルーム")}</strong><small>陣取り ・ ${room.size}×${room.size} ・ ${room.currentPlayers}/${room.playerCount}人${room.fillWithNpc ? ` ・ 空席NPC ${NPC_LABELS[room.npcDifficulty]}` : ""}</small></div><b>${escapeHtml(room.roomId)}</b>`;',
    '    card.innerHTML = `<span class="room-live-dot"></span><div><strong>${escapeHtml(room.hostName || "ルーム")}</strong><small>${escapeHtml(room.modeLabel || MODE_LABELS[room.mode] || "陣取り")} ・ ${room.size}×${room.size} ・ ${room.currentPlayers}/${room.playerCount}人${room.fillWithNpc ? ` ・ 空席NPC ${NPC_LABELS[room.npcDifficulty]}` : ""}</small></div><b>${escapeHtml(room.roomId)}</b>`;',
    "public room mode");
  s = replaceOne(s,
    '  $("#lobbyRuleSummary").innerHTML = `<span>陣取り</span><span>${room.settings.size} × ${room.settings.size}</span><span>定員 ${room.settings.playerCount}人</span><span>${room.settings.fillWithNpc ? `空席NPC：${NPC_LABELS[room.settings.npcDifficulty]}` : "NPC補充なし"}</span>`;',
    '  $("#lobbyRuleSummary").innerHTML = `<span>${escapeHtml(MODE_LABELS[room.settings.mode] || "陣取り")}</span><span>${room.settings.size} × ${room.settings.size}</span><span>定員 ${room.settings.playerCount}人</span><span>${room.settings.fillWithNpc ? `空席NPC：${NPC_LABELS[room.settings.npcDifficulty]}` : "NPC補充なし"}</span>`;',
    "lobby mode");
  s = replaceOne(s,
    '        mode: "territory",',
    '        mode: $("#onlineMode").value || "territory",',
    "online selected mode");

  s = replaceOne(s,
    '  $$('[ + "'" + 'data-battle-kind' + "'" + ']').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));',
    '  $$('[ + "'" + 'data-battle-kind' + "'" + ']').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));\n  $$("[data-mode]").forEach((button) => button.addEventListener("click", () => selectBattleMode(button.dataset.mode)));',
    "mode card events");
  s = replaceOne(s,
    '    if (action === "history") { showView("home"); toast("最近の対戦からリプレイを開けます"); }',
    '    if (action === "history") { showView("home"); toast("最近の対戦からリプレイを開けます"); }\n    if (action === "tutorials") openTutorialLibrary();',
    "tutorial menu action");
  s = replaceOne(s,
    '  bindDragAndDrop();',
    '  $("#closeTutorialLibrary").addEventListener("click", () => setModal("#tutorialLibraryModal", false));\n  $("#optionalTutorialPrev").addEventListener("click", () => moveOptionalTutorial(-1));\n  $("#optionalTutorialNext").addEventListener("click", () => moveOptionalTutorial(1));\n  $("#optionalTutorialClose").addEventListener("click", closeOptionalTutorial);\n  bindDragAndDrop();',
    "tutorial events");
  write(path, s);
}

// Unlock all mode cards, expose attack/built-ins, tutorial library, and all online modes.
{
  const path = "public/now-coding/index.html";
  let s = read(path);
  s = replaceOne(s,
    '                <button class="palette-block action-turn" type="button" draggable="true" data-add-block="turnRight">右に旋回</button>',
    '                <button class="palette-block action-turn" type="button" draggable="true" data-add-block="turnRight">右に旋回</button>\n                <button class="palette-block attack-block" type="button" draggable="true" data-add-block="attack">前方へ攻撃</button>',
    "attack palette");
  s = replaceOne(s,
    '                <button class="palette-block logic-block" type="button" draggable="true" data-add-block="ifVariable">もし 変数が…</button>',
    '                <button class="palette-block logic-block" type="button" draggable="true" data-add-block="ifVariable">もし 変数が…</button>\n                <button class="palette-block logic-block" type="button" draggable="true" data-add-block="ifBuiltin">もし インク／尾の長さが…</button>',
    "builtin palette");
  s = replaceOne(s,
    '              <button class="mode-card is-locked" type="button" disabled><span class="mode-preview cobra-preview" aria-hidden="true"></span><strong>コブラ</strong><small>常に進み続け、伸びる尾を避ける。</small><em>準備中</em></button>\n              <button class="mode-card is-locked" type="button" disabled><span class="mode-preview fall-preview" aria-hidden="true"></span><strong>床抜け</strong><small>止まりすぎると足元が崩れる。</small><em>準備中</em></button>\n              <button class="mode-card is-locked" type="button" disabled><span class="mode-preview splat-preview" aria-hidden="true"></span><strong>スプラ</strong><small>塗り替えと攻撃を両立する。</small><em>準備中</em></button>',
    '              <button class="mode-card" type="button" data-mode="cobra"><span class="mode-preview cobra-preview" aria-hidden="true"></span><strong>コブラ</strong><small>毎tick必ず進み、伸びる尾を避けて生き残る。</small></button>\n              <button class="mode-card" type="button" data-mode="fall"><span class="mode-preview fall-preview" aria-hidden="true"></span><strong>床抜け</strong><small>2tick連続で移動しないと足元が崩れる。</small></button>\n              <button class="mode-card" type="button" data-mode="splat"><span class="mode-preview splat-preview" aria-hidden="true"></span><strong>スプラ</strong><small>色を上書きし、インクを使って前方へ攻撃する。</small></button>',
    "unlock modes");
  s = replaceOne(s,
    '<label>モード<select id="onlineMode"><option value="territory">陣取り</option></select></label>',
    '<label>モード<select id="onlineMode"><option value="territory">陣取り</option><option value="cobra">コブラ</option><option value="fall">床抜け</option><option value="splat">スプラ</option></select></label>',
    "online modes");
  s = replaceOne(s,
    '<button type="button" data-menu-action="history">戦績・リプレイ</button><button type="button" data-menu-action="rules">ゲームルール</button>',
    '<button type="button" data-menu-action="history">戦績・リプレイ</button><button type="button" data-menu-action="tutorials">チュートリアル</button><button type="button" data-menu-action="rules">ゲームルール</button>',
    "tutorial drawer");
  s = replaceOne(s,
    '  <div id="toastRegion" class="toast-region" aria-live="polite"></div>',
    `  <div id="tutorialLibraryModal" class="modal-layer" aria-hidden="true">
    <div class="modal-card tutorial-library-modal" role="dialog" aria-modal="true" aria-labelledby="tutorialLibraryTitle">
      <p class="eyebrow">チュートリアル</p><h2 id="tutorialLibraryTitle">知りたいところだけ試す</h2>
      <p>初回チュートリアルをやり直す必要はありません。確認したい内容を選んで、その機能がある画面で学べます。</p>
      <div id="tutorialLibraryGrid" class="tutorial-library-grid"></div>
      <button id="closeTutorialLibrary" class="secondary-button" type="button">閉じる</button>
    </div>
  </div>
  <aside id="optionalTutorialCoach" class="optional-tutorial-coach is-hidden" aria-live="polite">
    <div class="optional-tutorial-meta"><span id="optionalTutorialProgress">1 / 1</span><b id="optionalTutorialName"></b></div>
    <strong id="optionalTutorialTitle"></strong><p id="optionalTutorialText"></p>
    <div class="optional-tutorial-actions"><button id="optionalTutorialPrev" class="text-button" type="button">戻る</button><button id="optionalTutorialClose" class="text-button" type="button">終了</button><button id="optionalTutorialNext" class="primary-button compact" type="button">次へ</button></div>
  </aside>
  <div id="toastRegion" class="toast-region" aria-live="polite"></div>`,
    "tutorial library UI");
  write(path, s);
}

// Animation and responsive polish for new mechanics/tutorial surfaces.
{
  const path = "public/now-coding/style-v2.css";
  let s = read(path);
  s = appendOnce(s, "/* iteration3-mode-and-tutorial-surfaces */", `/* iteration3-mode-and-tutorial-surfaces */
.attack-block { background: linear-gradient(90deg, #5b2030, #351923); border-color: rgba(255,82,109,.28); }
.code-block:has(.block-content:first-child) { isolation: isolate; }
.tail-piece { position:absolute; inset:22%; border:1px solid currentColor; background:currentColor; opacity:.72; box-shadow:0 0 10px currentColor; animation:tailPulse .8s ease-in-out infinite alternate; }
.tail-piece.blue { color:var(--blue-player); }.tail-piece.red { color:var(--red-player); }.tail-piece.yellow { color:var(--yellow-player); }.tail-piece.green { color:var(--green-player); }
.board-cell.is-hole { background:#030507 !important; box-shadow:inset 0 0 0 1px rgba(255,82,109,.22), inset 0 0 18px #000; }
.board-cell.is-hole::before,.board-cell.is-hole::after { content:""; position:absolute; left:18%; right:18%; top:49%; height:1px; background:rgba(255,120,130,.35); transform:rotate(31deg); }
.board-cell.is-hole::after { transform:rotate(-39deg); }
.board-cell.attack-flash { animation:attackCell .2s ease-out; z-index:2; }
.board-cell.attack-blue { --attack-color:var(--blue-player); }.board-cell.attack-red { --attack-color:var(--red-player); }.board-cell.attack-yellow { --attack-color:var(--yellow-player); }.board-cell.attack-green { --attack-color:var(--green-player); }
.board-cell.collapse-flash { animation:collapseCell .42s ease-out; }
.tutorial-library-modal { width:min(920px,96vw); max-height:min(88dvh,820px); overflow:auto; }
.tutorial-library-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:10px; margin:20px 0; }
.tutorial-library-card { position:relative; overflow:hidden; min-height:128px; padding:18px; display:flex; flex-direction:column; justify-content:flex-end; gap:7px; text-align:left; color:var(--text); border:1px solid var(--line); background:linear-gradient(145deg,rgba(19,27,37,.96),rgba(8,12,17,.96)); cursor:pointer; clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px)); transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease; }
.tutorial-library-card:hover { transform:translateY(-3px); border-color:rgba(88,230,246,.5); box-shadow:0 14px 36px rgba(0,0,0,.26),inset 0 0 30px rgba(88,230,246,.035); }
.tutorial-library-card strong,.tutorial-library-card small { position:relative; z-index:2; }.tutorial-library-card small { color:var(--muted); line-height:1.55; }
.tutorial-card-scan { position:absolute; inset:-30% 0; background:linear-gradient(100deg,transparent 42%,rgba(88,230,246,.08),transparent 58%); transform:translateX(-100%); animation:tutorialScan 5.5s ease-in-out infinite; }
.optional-tutorial-coach { position:fixed; z-index:170; right:14px; bottom:calc(var(--nav-height) + var(--safe-bottom) + 18px); width:min(430px,calc(100vw - 28px)); padding:16px; border:1px solid rgba(88,230,246,.38); background:rgba(8,13,19,.96); backdrop-filter:blur(18px); box-shadow:0 20px 70px rgba(0,0,0,.5),0 0 36px rgba(88,230,246,.07); clip-path:polygon(0 0,calc(100% - 13px) 0,100% 13px,100% 100%,13px 100%,0 calc(100% - 13px)); animation:lessonDock .36s cubic-bezier(.18,.86,.2,1) both; }
.optional-tutorial-coach::before { content:""; position:absolute; left:0; top:0; bottom:0; width:2px; background:var(--cyan); box-shadow:0 0 16px var(--cyan); }
.optional-tutorial-meta { display:flex; justify-content:space-between; gap:10px; color:var(--cyan); font-size:.68rem; margin-bottom:8px; }.optional-tutorial-coach>strong { display:block; font-size:1.05rem; }.optional-tutorial-coach p { color:#a9b6be; line-height:1.7; margin:8px 0 12px; }.optional-tutorial-actions { display:grid; grid-template-columns:auto auto 1fr; gap:10px; align-items:center; }.optional-tutorial-actions .primary-button { justify-self:end; }
.lesson-target { position:relative; z-index:4; animation:lessonTarget 1.15s ease-in-out infinite alternate !important; }
@keyframes attackCell { 0%{box-shadow:inset 0 0 0 0 var(--attack-color),0 0 0 var(--attack-color)} 45%{box-shadow:inset 0 0 18px 4px var(--attack-color),0 0 18px var(--attack-color)} 100%{box-shadow:none} }
@keyframes collapseCell { 0%{transform:scale(1);filter:brightness(2)} 55%{transform:scale(.82) rotate(2deg);filter:brightness(.35)} 100%{transform:scale(1)} }
@keyframes tailPulse { from{transform:scale(.88);opacity:.58} to{transform:scale(1);opacity:.9} }
@keyframes tutorialScan { 0%,62%{transform:translateX(-120%)} 82%,100%{transform:translateX(120%)} }
@keyframes lessonDock { from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:none} }
@keyframes lessonTarget { from{box-shadow:0 0 0 1px rgba(88,230,246,.3),0 0 8px rgba(88,230,246,.08)} to{box-shadow:0 0 0 2px rgba(88,230,246,.75),0 0 26px rgba(88,230,246,.24)} }
@media (min-width:900px){ .optional-tutorial-coach{bottom:22px;right:22px} }
@media (prefers-reduced-motion:reduce){ .tail-piece,.tutorial-card-scan,.lesson-target,.optional-tutorial-coach{animation:none!important} }
`);
  write(path, s);
}

// Extend tests and CI contracts.
{
  const path = "tools/now-coding/engine.test.mjs";
  let s = read(path);
  s = replaceOne(s,
    '} from "../../public/now-coding/engine.js";\n',
    '} from "../../public/now-coding/engine.js";\nimport { createGameState, gameResults, stepGame } from "../../public/now-coding/modes.js";\n',
    "mode test import");
  s = appendOnce(s, 'test("cobra steering still advances one cell in the same tick"', `test("cobra steering still advances one cell in the same tick", () => {
  const state = createGameState({ mode: "cobra", seed: "cobra-turn", size: 15, players: [{ id:"a", program:[right] }, { id:"b", program:[move] }], spawns:[{x:5,y:5,dir:0},{x:12,y:12,dir:2}] });
  stepGame(state);
  assert.equal(state.agents[0].dir, 1);
  assert.equal(state.agents[0].x, 6);
  assert.equal(state.agents[0].y, 5);
});

test("cobra allows entering the tail cell that disappears on this tick", () => {
  const state = createGameState({ mode: "cobra", seed: "tail-gap", size: 15, players: [{ id:"a", program:[move] }, { id:"b", program:[right] }], spawns:[{x:5,y:5,dir:1},{x:12,y:12,dir:2}], growthEvery:5 });
  state.agents[0].tail = [{x:6,y:5},{x:5,y:6}];
  stepGame(state);
  assert.equal(state.agents[0].alive, true);
  assert.equal(state.agents[0].x, 6);
  assert.equal(state.agents[0].y, 5);
});

test("floor mode eliminates a piece after two consecutive non-movement ticks", () => {
  const state = createGameState({ mode: "fall", seed: "fall", size: 15, players: [{ id:"a", program:[right,right] }, { id:"b", program:[move] }], spawns:[{x:5,y:5,dir:0},{x:12,y:12,dir:2}] });
  stepGame(state);
  assert.equal(state.agents[0].alive, true);
  stepGame(state);
  assert.equal(state.agents[0].alive, false);
  assert.equal(state.agents[0].deathReason, "floor_collapse");
  assert.equal(state.holes.has("5,5"), true);
});

test("splat starts at zero ink, recovers on existing own paint, and attack costs one plus range", () => {
  const attack = { type:"action", action:"attack", range:{ type:"literal", value:2 } };
  const state = createGameState({ mode:"splat", seed:"splat", size:15, players:[{id:"a",program:[right,attack]},{id:"b",program:[right]}], spawns:[{x:5,y:5,dir:0},{x:7,y:5,dir:2}], maxTicks:20 });
  assert.equal(state.agents[0].ink, 0);
  stepGame(state);
  assert.equal(state.agents[0].ink, 1);
  state.agents[0].ink = 5;
  state.agents[0].pc = 1;
  state.agents[0].dir = 1;
  stepGame(state);
  assert.equal(state.agents[0].ink, 2);
  assert.equal(state.agents[1].alive, false);
  assert.equal(state.agents[1].deathReason, "shot");
});

test("splat winner is based on colored area", () => {
  const state = createGameState({ mode:"splat", seed:"paint", size:15, players:[{id:"a",program:[move]},{id:"b",program:[right]}], spawns:[{x:2,y:2,dir:1},{x:12,y:12,dir:2}], maxTicks:3 });
  while (!state.finished) stepGame(state);
  const results = gameResults(state);
  assert.ok(results[0].colored >= results[1].colored);
  assert.match(results[0].metric, /マス/);
});`);
  write(path, s);
}

{
  const path = ".github/workflows/now-coding.yml";
  let s = read(path);
  s = replaceOne(s,
    '          node --check public/now-coding/engine.js\n          node --check public/now-coding/app.js',
    '          node --check public/now-coding/engine.js\n          node --check public/now-coding/modes.js\n          node --check public/now-coding/tutorials.js\n          node --check public/now-coding/app.js',
    "ci new browser modules");
  s = replaceOne(s,
    '          grep -q \'id="editAfterResultButton"\' public/now-coding/index.html',
    '          grep -q \'id="editAfterResultButton"\' public/now-coding/index.html\n          grep -q \'data-mode="cobra"\' public/now-coding/index.html\n          grep -q \'data-mode="fall"\' public/now-coding/index.html\n          grep -q \'data-mode="splat"\' public/now-coding/index.html\n          grep -q \'data-menu-action="tutorials"\' public/now-coding/index.html\n          grep -q \'id="tutorialLibraryModal"\' public/now-coding/index.html\n          grep -q \'mode: $("#onlineMode").value\' public/now-coding/app.js',
    "ci new ux contracts");
  write(path, s);
}

console.log("Now Coding iteration 3 patch applied safely.");
