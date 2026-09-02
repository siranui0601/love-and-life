from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def swap(path, old, new, label):
    text = read(path)
    if old not in text:
        raise SystemExit(f"missing {label} in {path}")
    write(path, text.replace(old, new, 1))


def sub(path, pattern, replacement, label, flags=re.S):
    text = read(path)
    out, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"expected one {label} in {path}, got {count}")
    write(path, out)


# ---------------------------------------------------------------------------
# engine.js: shared board mask + shape-aware battle spawns
# ---------------------------------------------------------------------------
engine = "public/now-coding/engine.js"
swap(
    engine,
    'import { runProgramUntilAction } from "./vm.js";\n',
    'import { runProgramUntilAction } from "./vm.js";\nimport { createBattleSpawns, createBoardDefinition, isPlayableCell, validateSpawnList } from "./boards.js";\n',
    "engine board import",
)
swap(engine, 'export const NOW_CODING_RULE_VERSION = "territory-v4";', 'export const NOW_CODING_RULE_VERSION = "territory-v5";', "territory version")
sub(
    engine,
    r'export function createBalancedSpawns\(sizeInput, playerCountInput, random\) \{.*?\n\}\n\nfunction makeBoard',
    '''export function createBalancedSpawns(sizeInput, playerCountInput, random) {
  const boardDef = createBoardDefinition({ size: sizeInput });
  return createBattleSpawns(boardDef, playerCountInput, random);
}

function makeBoard''',
    "balanced spawn wrapper",
)
sub(
    engine,
    r'export function createTerritoryState\(\{ seed = "1", size = 21, players = \[\], maxTicks = 600, stagnationTicks = 120, spawns = null, allowSolo = false \} = \{\}\) \{.*?\n\}\n\nfunction relativeDirection',
    '''export function createTerritoryState({ seed = "1", size = 21, boardShape = null, boardSizeKey = null, players = [], maxTicks = 600, stagnationTicks = 120, spawns = null, allowSolo = false } = {}) {
  const boardDef = createBoardDefinition({ seed, size, boardShape, boardSizeKey });
  const boardSize = boardDef.size;
  const random = createSeededRandom(seed);
  const safePlayers = players.slice(0, 4);
  while (safePlayers.length < (allowSolo ? 1 : 2)) {
    const index = safePlayers.length;
    safePlayers.push({ id: `cpu-${index}`, name: `NPC ${index + 1}`, color: PLAYER_COLORS[index], program: makeNpcProgram("medium", index) });
  }
  let resolvedSpawns;
  if (Array.isArray(spawns) && spawns.length >= safePlayers.length) {
    const proposed = spawns.slice(0, safePlayers.length).map((spawn) => ({ x: Number(spawn.x), y: Number(spawn.y), dir: Number(spawn.dir) }));
    if (!validateSpawnList(boardDef, proposed, safePlayers.length)) throw new Error("invalid_spawn");
    resolvedSpawns = proposed;
  } else {
    resolvedSpawns = createBattleSpawns(boardDef, safePlayers.length, random);
  }
  const board = makeBoard(boardSize);

  const agents = safePlayers.map((player, index) => {
    const spawn = resolvedSpawns[index];
    board[spawn.y][spawn.x] = index;
    return {
      id: String(player.id ?? `p${index + 1}`),
      userTrackingId: String(player.userTrackingId || ""),
      name: String(player.name || `プレイヤー${index + 1}`),
      color: player.color || PLAYER_COLORS[index],
      programName: String(player.programName || ""),
      program: normalizeProgram(player.program),
      x: spawn.x,
      y: spawn.y,
      dir: spawn.dir,
      alive: true,
      deathReason: "",
      program: normalizeProgram(player.program),
      pc: 0,
      vars: Object.create(null),
      control: Object.create(null),
      claimed: 1,
      lastAction: "",
      lastSensor: null,
    };
  });

  return {
    mode: "territory",
    ruleVersion: NOW_CODING_RULE_VERSION,
    seed: String(seed),
    size: boardSize,
    boardShape: boardDef.shape,
    boardSizeKey: boardDef.sizeKey,
    mask: boardDef.mask.map((row) => [...row]),
    playableCount: boardDef.playableCount,
    board,
    agents,
    tick: 0,
    maxTicks: Math.max(20, Number(maxTicks) || Math.max(600, boardDef.playableCount * 2)),
    stagnationTicks: Math.max(20, Number(stagnationTicks) || 120),
    ticksSinceCapture: 0,
    random,
    finished: false,
    finishReason: "",
    spawns: resolvedSpawns.map((spawn) => ({ ...spawn })),
  };
}

function relativeDirection''',
    "territory state",
)
# Remove an accidental duplicate program field if the source had one after replacement.
text = read(engine)
text = text.replace('      programName: String(player.programName || ""),\n      program: normalizeProgram(player.program),\n      x:', '      programName: String(player.programName || ""),\n      x:', 1)
write(engine, text)
swap(
    engine,
    '  if (x < 0 || y < 0 || x >= state.size || y >= state.size) return { state: "cliff", x, y, owner: -1 };',
    '  if (!isPlayableCell(state, x, y)) return { state: "cliff", x, y, owner: -1 };',
    "territory sensor mask",
)
sub(
    engine,
    r'function allCellsClaimed\(state\) \{.*?\n\}',
    '''function allCellsClaimed(state) {
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      if (isPlayableCell(state, x, y) && state.board[y][x] < 0) return false;
    }
  }
  return true;
}''',
    "playable-only board filled",
)
swap(
    engine,
    '    if (x < 0 || y < 0 || x >= state.size || y >= state.size) return false;',
    '    if (!isPlayableCell(state, x, y)) return false;',
    "territory legal move mask",
)
swap(
    engine,
    '    if (target.x < 0 || target.y < 0 || target.x >= state.size || target.y >= state.size) {',
    '    if (!isPlayableCell(state, target.x, target.y)) {',
    "territory movement mask",
)

# ---------------------------------------------------------------------------
# modes.js: all other modes use the same mask and battle spawn definition
# ---------------------------------------------------------------------------
modes = "public/now-coding/modes.js"
swap(
    modes,
    '} from "./engine.js";\n',
    '} from "./engine.js";\nimport { createBattleSpawns, createBoardDefinition, isPlayableCell, validateSpawnList } from "./boards.js";\n',
    "modes board import",
)
swap(modes, '  cobra: "cobra-v2",\n  fall: "fall-v2",\n  splat: "splat-v2",', '  cobra: "cobra-v3",\n  fall: "fall-v3",\n  splat: "splat-v3",', "mode rule versions")
sub(
    modes,
    r'function makeAgents\(\{ players, size, seed, spawns, allowSolo = false \}\) \{.*?\n\}',
    '''function makeAgents({ players, size, seed, spawns, allowSolo = false, boardDef = null }) {
  const random = createSeededRandom(seed);
  const definition = boardDef || createBoardDefinition({ size, seed });
  const safePlayers = (Array.isArray(players) ? players : []).slice(0, 4);
  while (safePlayers.length < (allowSolo ? 1 : 2)) {
    const index = safePlayers.length;
    safePlayers.push({ id: `npc-${index}`, name: `NPC ${index + 1}`, color: PLAYER_COLORS[index], program: makeNpcProgram("medium", index) });
  }
  let resolvedSpawns;
  if (Array.isArray(spawns) && spawns.length >= safePlayers.length) {
    const proposed = spawns.slice(0, safePlayers.length).map((spawn) => ({ x: Number(spawn.x), y: Number(spawn.y), dir: Number(spawn.dir) }));
    if (!validateSpawnList(definition, proposed, safePlayers.length)) throw new Error("invalid_spawn");
    resolvedSpawns = proposed;
  } else {
    resolvedSpawns = createBattleSpawns(definition, safePlayers.length, random);
  }
  const agents = safePlayers.map((player, index) => {
    const spawn = resolvedSpawns[index];
    return {
      id: String(player.id ?? `p${index + 1}`),
      userTrackingId: String(player.userTrackingId || ""),
      name: String(player.name || `プレイヤー${index + 1}`),
      color: player.color || PLAYER_COLORS[index],
      programName: String(player.programName || ""),
      program: normalizeProgram(player.program),
      x: spawn.x,
      y: spawn.y,
      dir: spawn.dir,
      alive: true,
      deathReason: "",
      deathTick: null,
      pc: 0,
      vars: Object.create(null),
      control: Object.create(null),
      lastAction: "",
      lastSensor: null,
      ink: 0,
      maxInk: 10,
      tail: [],
      noMoveTicks: 0,
    };
  });
  return { agents, spawns: resolvedSpawns, random };
}''',
    "mode agent factory",
)
sub(
    modes,
    r'function out\(state, x, y\) \{.*?\n\}',
    '''function out(state, x, y) {
  return !isPlayableCell(state, x, y);
}''',
    "mode mask out",
)
sub(
    modes,
    r'function createCobraState\(config = \{\}\) \{.*?\n\}\n\nfunction stepCobra',
    '''function createCobraState(config = {}) {
  const seed = String(config.seed ?? "1");
  const boardDef = createBoardDefinition({ ...config, seed });
  const size = boardDef.size;
  const made = makeAgents({ players: config.players, size, seed, spawns: config.spawns, allowSolo: Boolean(config.allowSolo), boardDef });
  return {
    mode: "cobra",
    ruleVersion: MODE_RULE_VERSION.cobra,
    seed,
    size,
    boardShape: boardDef.shape,
    boardSizeKey: boardDef.sizeKey,
    mask: boardDef.mask.map((row) => [...row]),
    playableCount: boardDef.playableCount,
    board: board(size),
    agents: made.agents,
    spawns: made.spawns,
    random: made.random,
    tick: 0,
    maxTicks: Math.max(60, Number(config.maxTicks) || Math.max(600, boardDef.playableCount * 2)),
    growthEvery: Math.max(2, Number(config.growthEvery) || 5),
    finished: false,
    finishReason: "",
    effects: [],
    allowSolo: Boolean(config.allowSolo),
  };
}

function stepCobra''',
    "cobra state",
)
sub(
    modes,
    r'function createFallState\(config = \{\}\) \{.*?\n\}\n\nfunction stepFall',
    '''function createFallState(config = {}) {
  const seed = String(config.seed ?? "1");
  const boardDef = createBoardDefinition({ ...config, seed });
  const size = boardDef.size;
  const made = makeAgents({ players: config.players, size, seed, spawns: config.spawns, allowSolo: Boolean(config.allowSolo), boardDef });
  return {
    mode: "fall",
    ruleVersion: MODE_RULE_VERSION.fall,
    seed,
    size,
    boardShape: boardDef.shape,
    boardSizeKey: boardDef.sizeKey,
    mask: boardDef.mask.map((row) => [...row]),
    playableCount: boardDef.playableCount,
    board: board(size),
    agents: made.agents,
    spawns: made.spawns,
    random: made.random,
    holes: new Set(),
    tick: 0,
    maxTicks: Math.max(60, Number(config.maxTicks) || Math.max(600, boardDef.playableCount * 2)),
    finished: false,
    finishReason: "",
    effects: [],
    allowSolo: Boolean(config.allowSolo),
  };
}

function stepFall''',
    "fall state",
)
sub(
    modes,
    r'function createSplatState\(config = \{\}\) \{.*?\n\}\n\nfunction attackCells',
    '''function createSplatState(config = {}) {
  const seed = String(config.seed ?? "1");
  const boardDef = createBoardDefinition({ ...config, seed });
  const size = boardDef.size;
  const made = makeAgents({ players: config.players, size, seed, spawns: config.spawns, allowSolo: Boolean(config.allowSolo), boardDef });
  const paint = board(size);
  made.agents.forEach((agent, index) => { paint[agent.y][agent.x] = index; });
  return {
    mode: "splat",
    ruleVersion: MODE_RULE_VERSION.splat,
    seed,
    size,
    boardShape: boardDef.shape,
    boardSizeKey: boardDef.sizeKey,
    mask: boardDef.mask.map((row) => [...row]),
    playableCount: boardDef.playableCount,
    board: paint,
    agents: made.agents,
    spawns: made.spawns,
    random: made.random,
    tick: 0,
    maxTicks: Math.max(60, Number(config.maxTicks) || Math.max(500, boardDef.playableCount * 2)),
    finished: false,
    finishReason: "",
    effects: [],
    allowSolo: Boolean(config.allowSolo),
  };
}

function attackCells''',
    "splat state",
)

# ---------------------------------------------------------------------------
# index.html: grouped board selection, reroll policy, richer test spawn controls
# ---------------------------------------------------------------------------
html = "public/now-coding/index.html"
swap(html, '  <link rel="stylesheet" href="./style-v6.css" />', '  <link rel="stylesheet" href="./style-v6.css" />\n  <link rel="stylesheet" href="./style-v7.css" />', "style v7 link")
old_test = '''              <label class="test-setting-field"><span>スポーン位置</span><select id="testSpawnMode"><option value="random" selected>ランダム</option><option value="fixed">指定</option></select></label>
              <label id="testDirectionRow" class="test-setting-field is-hidden"><span>開始時の向き</span><select id="testSpawnDirection"><option value="0">上</option><option value="1" selected>右</option><option value="2">下</option><option value="3">左</option></select></label>
              <p id="testSpawnHint" class="test-spawn-hint is-hidden">指定したい開始マスを盤面上でタップしてください。</p>'''
new_test = '''              <div class="test-setting-group"><span class="test-setting-group-title">盤面</span>
                <label class="test-setting-field"><span>形</span><select id="testBoardShape"><option value="square" selected>正方形</option><option value="diamond">ひし形</option><option value="cross">十字</option><option value="donut">ドーナツ</option><option value="random">ランダム</option></select></label>
                <label class="test-setting-field"><span>サイズ</span><select id="testBoardSizeKey"><option value="small" selected>小</option><option value="large">大</option><option value="random">ランダム</option></select></label>
              </div>
              <div class="test-setting-group"><span class="test-setting-group-title">スポーン</span>
                <label class="test-setting-field"><span>配置方法</span><select id="testSpawnMode"><option value="random" selected>ランダム</option><option value="battle">対戦配置</option><option value="fixed">指定</option></select></label>
                <label id="testSpawnActorRow" class="test-setting-field test-spawn-actor-row is-hidden"><span>設定する駒</span><select id="testSpawnActor"><option value="me">あなた</option><option value="npc">NPC</option></select></label>
                <label id="testDirectionRow" class="test-setting-field is-hidden"><span>開始時の向き</span><select id="testSpawnDirection"><option value="0">上</option><option value="1" selected>右</option><option value="2">下</option><option value="3">左</option></select></label>
                <p id="testSpawnHint" class="test-spawn-hint is-hidden">指定したい開始マスを盤面上でタップしてください。</p>
              </div>'''
swap(html, old_test, new_test, "test board and spawn settings")
old_battle = '''            <label id="roundProgramChangeRow" class="switch-row is-hidden"><input id="allowRoundProgramChange" type="checkbox" /><span class="switch-ui"></span><span><strong>ラウンドごとに駒を変更できる</strong><small>次のゲーム発表後、30秒以内に駒を選べます。同じ駒を選び続けても構いません。</small></span></label>
            <div class="settings-strip settings-strip-v3">
              <label>人数<select id="playerCount"><option value="2">2人</option><option value="3">3人</option><option value="4">4人</option></select></label>
              <label>盤面<select id="boardSize"><option value="15">15 × 15</option><option value="21" selected>21 × 21</option><option value="31">31 × 31</option></select></label>
              <label>NPC<select id="npcDifficulty"><option value="weak">弱</option><option value="medium" selected>中</option><option value="strong">強</option></select></label>
              <label>Seed<input id="seedInput" placeholder="自動生成" /></label>
            </div>'''
new_battle = '''            <label id="roundProgramChangeRow" class="switch-row is-hidden"><input id="allowRoundProgramChange" type="checkbox" /><span class="switch-ui"></span><span><strong>ラウンドごとに駒を変更できる</strong><small>次のゲーム発表後、30秒以内に駒を選べます。同じ駒を選び続けても構いません。</small></span></label>
            <div class="board-config-card">
              <div class="board-config-head"><span>盤面</span><strong id="battleBoardChoiceSummary">正方形・大</strong></div>
              <div class="board-config-grid">
                <label>形<select id="boardShape"><option value="square" selected>正方形</option><option value="diamond">ひし形</option><option value="cross">十字</option><option value="donut">ドーナツ</option><option value="random">ランダム</option></select></label>
                <label>サイズ<select id="boardSizeKey"><option value="small">小</option><option value="large" selected>大</option><option value="random">ランダム</option></select></label>
                <div id="battleBoardPreview" class="board-mini-preview" aria-label="盤面プレビュー"></div>
              </div>
              <p class="board-config-note">形・サイズをランダムにした場合も、Seedから決定されます。</p>
            </div>
            <label id="roundBoardRerollRow" class="switch-row round-board-reroll-row is-hidden"><input id="rerollBoardEachRound" type="checkbox" /><span class="switch-ui"></span><span><strong>ラウンドごとに盤面を再抽選</strong><small>ランダムにした形・サイズだけを、各ラウンド開始時に引き直します。OFFならシリーズ開始時の盤面を全ラウンドで使います。</small></span></label>
            <div class="settings-strip settings-strip-v3">
              <label>人数<select id="playerCount"><option value="2">2人</option><option value="3">3人</option><option value="4">4人</option></select></label>
              <label>NPC<select id="npcDifficulty"><option value="weak">弱</option><option value="medium" selected>中</option><option value="strong">強</option></select></label>
              <label>Seed<input id="seedInput" placeholder="自動生成" /></label>
            </div>'''
swap(html, old_battle, new_battle, "npc battle board settings")
old_online = '''            <label id="onlineRoundProgramChangeRow" class="switch-row is-hidden"><input id="onlineAllowRoundProgramChange" type="checkbox" /><span class="switch-ui"></span><span><strong>ラウンドごとに駒を変更できる</strong><small>各ラウンド前に30秒の選択時間を設けます。</small></span></label>
            <div class="settings-strip online-settings">
              <label>定員<select id="onlinePlayerCount"><option value="2">2人</option><option value="3">3人</option><option value="4">4人</option></select></label>
              <label>盤面<select id="onlineBoardSize"><option value="15">15 × 15</option><option value="21" selected>21 × 21</option><option value="31">31 × 31</option></select></label>
              <label>Seed<input id="onlineSeed" placeholder="自動生成" /></label>
            </div>'''
new_online = '''            <label id="onlineRoundProgramChangeRow" class="switch-row is-hidden"><input id="onlineAllowRoundProgramChange" type="checkbox" /><span class="switch-ui"></span><span><strong>ラウンドごとに駒を変更できる</strong><small>各ラウンド前に30秒の選択時間を設けます。</small></span></label>
            <div class="board-config-card">
              <div class="board-config-head"><span>盤面</span><strong id="onlineBoardChoiceSummary">正方形・大</strong></div>
              <div class="board-config-grid">
                <label>形<select id="onlineBoardShape"><option value="square" selected>正方形</option><option value="diamond">ひし形</option><option value="cross">十字</option><option value="donut">ドーナツ</option><option value="random">ランダム</option></select></label>
                <label>サイズ<select id="onlineBoardSizeKey"><option value="small">小</option><option value="large" selected>大</option><option value="random">ランダム</option></select></label>
                <div id="onlineBoardPreview" class="board-mini-preview" aria-label="盤面プレビュー"></div>
              </div>
              <p class="board-config-note">ランダム指定もルームSeedで全参加者に同じ盤面が確定します。</p>
            </div>
            <label id="onlineRoundBoardRerollRow" class="switch-row round-board-reroll-row is-hidden"><input id="onlineRerollBoardEachRound" type="checkbox" /><span class="switch-ui"></span><span><strong>ラウンドごとに盤面を再抽選</strong><small>ランダム指定した要素だけをラウンドごとに引き直します。</small></span></label>
            <div class="settings-strip online-settings">
              <label>定員<select id="onlinePlayerCount"><option value="2">2人</option><option value="3">3人</option><option value="4">4人</option></select></label>
              <label>Seed<input id="onlineSeed" placeholder="自動生成" /></label>
            </div>'''
swap(html, old_online, new_online, "online board settings")

# ---------------------------------------------------------------------------
# app-v3.js: board UI, test spawn modes, series reroll behavior, replay metadata
# ---------------------------------------------------------------------------
app = "public/now-coding/app-v3.js"
swap(
    app,
    'import { TUTORIALS, tutorialById } from "./tutorials.js";\n',
    'import { TUTORIALS, tutorialById } from "./tutorials.js";\nimport { BOARD_SHAPE_LABELS, BOARD_SIZE_LABELS, boardChoiceLabel, createBattleSpawns, createBoardDefinition, createRandomSpawns, isPlayableCell, resolveBoardChoice, validateSpawnList } from "./boards.js";\n',
    "app board import",
)
swap(
    app,
    'drag: null, suppressClickUntil: 0, optionalTutorial: null, tutorialFinalPassed: false, tutorialModalKey: "", pendingExpressionPreset: "", testMode: "territory", testNpcEnabled: false, testNpcType: "intermediate", testSpawnMode: "random", testSpawn: {x:4,y:7,dir:1}, testGame: null,',
    'drag: null, suppressClickUntil: 0, optionalTutorial: null, tutorialFinalPassed: false, tutorialModalKey: "", pendingExpressionPreset: "", testMode: "territory", testNpcEnabled: false, testNpcType: "intermediate", testBoardShape: "square", testBoardSizeKey: "small", testRollSeed: "test-initial", testSpawnMode: "random", testSpawnActor: "me", testFixedSpawns: { me:{x:4,y:7,dir:1}, npc:{x:10,y:7,dir:3} }, testGame: null,',
    "test board state",
)
# Replay must restore the resolved board, while old records continue to work from numeric size.
swap(
    app,
    'startBattle({mode:r.mode||"territory",seed:r.seed,size:Number(r.settings?.size||21),players,spawns:r.spawn||null,maxTicks:Number(r.settings?.maxTicks||600)},true);',
    'startBattle({mode:r.mode||"territory",seed:r.seed,size:Number(r.settings?.size||21),boardShape:r.settings?.boardShape||null,boardSizeKey:r.settings?.boardSizeKey||null,players,spawns:r.spawn||null,maxTicks:Number(r.settings?.maxTicks||600)},true);',
    "replay board metadata",
)
# Insert board UI helpers before mode selection functions.
anchor = 'function selectedModeArray(online=false){return MODES.filter(m=>(online?state.onlineModes:state.selectedModes).has(m));}'
helpers = '''function boardChoiceFromControls(online=false){return{shape:$(online?"#onlineBoardShape":"#boardShape")?.value||"square",sizeKey:$(online?"#onlineBoardSizeKey":"#boardSizeKey")?.value||"large"};}
function boardChoiceHasRandom(choice){return choice.shape==="random"||choice.sizeKey==="random";}
function renderBoardMini(host,choice,seed="preview"){if(!host)return;const resolved=resolveBoardChoice({...choice,seed}),def=createBoardDefinition({boardShape:resolved.shape,boardSizeKey:resolved.sizeKey});host.innerHTML="";host.style.gridTemplateColumns=`repeat(${def.size},1fr)`;for(let y=0;y<def.size;y++)for(let x=0;x<def.size;x++){const cell=document.createElement("i");cell.className=`board-mini-cell${isPlayableCell(def,x,y)?"":" is-void"}`;host.append(cell)}}
function updateBoardConfigUI(online=false){const choice=boardChoiceFromControls(online),modes=selectedModeArray(online),multi=modes.length>1,random=boardChoiceHasRandom(choice),summary=$(online?"#onlineBoardChoiceSummary":"#battleBoardChoiceSummary"),preview=$(online?"#onlineBoardPreview":"#battleBoardPreview"),row=$(online?"#onlineRoundBoardRerollRow":"#roundBoardRerollRow");if(summary)summary.textContent=boardChoiceLabel(choice.shape,choice.sizeKey);if(row)row.classList.toggle("is-hidden",!(multi&&random));renderBoardMini(preview,choice,online?"online-preview":"battle-preview");}
function selectedModeArray(online=false){return MODES.filter(m=>(online?state.onlineModes:state.selectedModes).has(m));}'''
swap(app, anchor, helpers, "board control helpers")
# Mode changes must also refresh conditional board-reroll visibility.
old_render_rail = 'function renderModeRail(online=false){const set=online?state.onlineModes:state.selectedModes,focus=online?state.onlineFocusedMode:state.focusedMode,attr=online?"data-online-mode":"data-mode",rail=online?"#onlineModeRail":"#modeRail";$$( `[${attr}]`,$(rail)).forEach(b=>{const m=b.getAttribute(attr);b.classList.toggle("is-selected",set.has(m));b.classList.toggle("is-focused",m===focus)});const [title,text]=MODE_DESCRIPTIONS[focus];const desc=$(online?"#onlineModeDescription":"#modeDescription");if(desc)desc.innerHTML=`<strong>${title}</strong><p>${text}</p>`;const multi=set.size>1;if(!online){$("#multiModeNotice")?.classList.toggle("is-hidden",!multi);$("#roundProgramChangeRow")?.classList.toggle("is-hidden",!multi);}else $("#onlineRoundProgramChangeRow")?.classList.toggle("is-hidden",!multi);}'
new_render_rail = 'function renderModeRail(online=false){const set=online?state.onlineModes:state.selectedModes,focus=online?state.onlineFocusedMode:state.focusedMode,attr=online?"data-online-mode":"data-mode",rail=online?"#onlineModeRail":"#modeRail";$$( `[${attr}]`,$(rail)).forEach(b=>{const m=b.getAttribute(attr);b.classList.toggle("is-selected",set.has(m));b.classList.toggle("is-focused",m===focus)});const [title,text]=MODE_DESCRIPTIONS[focus];const desc=$(online?"#onlineModeDescription":"#modeDescription");if(desc)desc.innerHTML=`<strong>${title}</strong><p>${text}</p>`;const multi=set.size>1;if(!online){$("#multiModeNotice")?.classList.toggle("is-hidden",!multi);$("#roundProgramChangeRow")?.classList.toggle("is-hidden",!multi);}else $("#onlineRoundProgramChangeRow")?.classList.toggle("is-hidden",!multi);updateBoardConfigUI(online);}'
swap(app, old_render_rail, new_render_rail, "mode rail board update")
sub(
    app,
    r'function renderBattleSummary\(\)\{.*?\nfunction seededShuffle',
    '''function renderBattleSummary(){const modes=selectedModeArray(),p=state.programs.find(x=>x.programId===state.selectedProgramId),choice=boardChoiceFromControls(false),reroll=modes.length>1&&boardChoiceHasRandom(choice)&&$("#rerollBoardEachRound").checked;$("#battleSummary").innerHTML=[["形式",modes.length>1?`${modes.length}ゲーム総合戦`:"単一ゲーム"],["ゲーム",modes.map(m=>MODE_LABELS[m]).join(" / ")],["人数",`${$("#playerCount").value}人`],["盤面",`${boardChoiceLabel(choice.shape,choice.sizeKey)}${reroll?" ・ 各ラウンド再抽選":""}`],["駒",p?.name||"未選択"],["駒変更",modes.length>1&&$("#allowRoundProgramChange").checked?"各ラウンド可":"固定"],["Seed",$("#seedInput").value.trim()||"自動生成"]].map(([a,b])=>`<div class="summary-row"><span>${a}</span><strong>${esc(b)}</strong></div>`).join("");}
function seededShuffle''',
    "battle summary",
)
sub(
    app,
    r'function startNpc\(\)\{.*?\nfunction startBattle',
    '''function startNpc(){const program=state.programs.find(x=>x.programId===state.selectedProgramId);if(!program)return toast("対戦に使う駒を選んでください");const seed=$("#seedInput").value.trim()||freshSeed(),modes=selectedModeArray(),count=Number($("#playerCount").value),diff=$("#npcDifficulty").value,allow=modes.length>1&&$("#allowRoundProgramChange").checked,choice=boardChoiceFromControls(false),reroll=modes.length>1&&boardChoiceHasRandom(choice)&&$("#rerollBoardEachRound").checked,fixedBoard=reroll?null:resolveBoardChoice({...choice,seed:`${seed}:series-board`});state.series={modes:seededShuffle(modes,seed),index:0,masterSeed:seed,count,diff,allowProgramChange:allow,colors:PLAYER_COLORS.slice(0,count),results:[],currentProgramId:program.programId,boardChoice:choice,rerollBoardEachRound:reroll,fixedBoard};startSeriesRound();}
function currentSeriesBoard(s){return s.rerollBoardEachRound?resolveBoardChoice({...s.boardChoice,seed:`${s.masterSeed}:board:${s.index}`}):s.fixedBoard;}
function startSeriesRound(){const s=state.series;if(!s)return;const mode=s.modes[s.index],p=state.programs.find(x=>x.programId===s.currentProgramId)||state.programs[0],boardChoice=currentSeriesBoard(s),def=createBoardDefinition({boardShape:boardChoice.shape,boardSizeKey:boardChoice.sizeKey});showRoundReveal(mode,s.index+1,s.modes.length,()=>startBattle({mode,seed:`${s.masterSeed}:round:${s.index}`,size:def.size,boardShape:def.shape,boardSizeKey:def.sizeKey,players:makePlayers(p,s.count,s.diff,mode,s.colors),maxTicks:Math.max(500,def.playableCount*2)},false),boardChoice);}
function showRoundReveal(mode,index,total,next,boardChoice=null){const overlay=document.createElement("div"),board=boardChoice?`<em>${esc(boardChoiceLabel(boardChoice.shape,boardChoice.sizeKey))}</em>`:"";overlay.className="round-reveal";overlay.innerHTML=`<div><small>第${index}戦 / ${total}</small><span>次のゲーム</span><strong>${MODE_LABELS[mode]}</strong>${board}</div>`;document.body.append(overlay);setTimeout(()=>overlay.classList.add("is-live"),20);setTimeout(()=>{overlay.remove();next();},1900);}
function startBattle''',
    "npc series board resolution",
)
# Save resolved board details in match/replay records.
swap(
    app,
    'settings:{size:game.size,playerCount:game.agents.length,maxTicks:game.maxTicks,online,seriesId,roundIndex,totalRounds},',
    'settings:{size:game.size,boardShape:game.boardShape||"square",boardSizeKey:game.boardSizeKey||"custom",playableCount:game.playableCount||game.size*game.size,playerCount:game.agents.length,maxTicks:game.maxTicks,online,seriesId,roundIndex,totalRounds},',
    "saved match board settings",
)
swap(
    app,
    'settings:{size:game.size,seriesId,roundIndex,totalRounds},results,createdAt:new Date().toISOString()',
    'settings:{size:game.size,boardShape:game.boardShape||"square",boardSizeKey:game.boardSizeKey||"custom",seriesId,roundIndex,totalRounds},results,createdAt:new Date().toISOString()',
    "home match board settings",
)
# Board-aware rendering and void cells.
sub(
    app,
    r'function renderBoard\(el,game,previous=null\)\{.*?\nfunction stopTest',
    '''function renderBoard(el,game,previous=null){if(!el)return;const size=game.size;if(Number(el.dataset.size)!==size||el.children.length!==size*size){el.innerHTML="";el.dataset.size=String(size);el.style.gridTemplateColumns=`repeat(${size},1fr)`;for(let i=0;i<size*size;i++){const c=document.createElement("div");c.className="board-cell";c.dataset.x=String(i%size);c.dataset.y=String(Math.floor(i/size));el.append(c);}}const occupied=new Map((game.agents||[]).filter(a=>a.alive).map(a=>[`${a.x},${a.y}`,a])),tails=new Map();for(const a of(game.agents||[]))for(const t of(a.tail||[]))tails.set(`${t.x},${t.y}`,a.color);const effects=new Map((game.effects||[]).map(e=>[`${e.x},${e.y}`,e]));for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,c=el.children[i],owner=game.board?.[y]?.[x]??-1,color=owner>=0?game.agents?.[owner]?.color:"";c.className=`board-cell${color?` claim-${color}`:""}`;if(!isPlayableCell(game,x,y)){c.classList.add("is-void");c.innerHTML="";continue;}if(game.holes?.has(`${x},${y}`))c.classList.add("is-hole");if(previous&&previous[y]?.[x]!==owner&&owner>=0)c.classList.add("just-claimed");const ef=effects.get(`${x},${y}`);if(ef?.type==="shot")c.classList.add("attack-flash",`attack-${ef.color}`);c.innerHTML="";const tc=tails.get(`${x},${y}`);if(tc){const t=document.createElement("span");t.className=`tail-piece ${tc}`;c.append(t);}const a=occupied.get(`${x},${y}`);if(a){const p=document.createElement("span");p.className=`piece ${a.color} dir-${a.dir}`;c.append(p);if(state.showNames&&el.id==="battleBoard"){const label=document.createElement("span");label.className=`piece-name-label ${a.color}`;label.textContent=a.name;c.append(label);}}}}
function stopTest''',
    "board renderer mask",
)
# Replace the complete test configuration/preview block.
sub(
    app,
    r'function effectiveTestConfig\(\).*?\nfunction openCommandHelp',
    '''function effectiveTestConfig(){if(isTutorial())return{mode:"territory",npc:false,npcType:"straight",boardShape:"square",boardSizeKey:"small",rollSeed:"tutorial-board",spawnMode:"fixed",spawnActor:"me",fixedSpawns:{me:{x:4,y:7,dir:1},npc:{x:10,y:7,dir:3}}};return{mode:state.testMode,npc:state.testNpcEnabled,npcType:state.testNpcType,boardShape:state.testBoardShape,boardSizeKey:state.testBoardSizeKey,rollSeed:state.testRollSeed,spawnMode:state.testSpawnMode,spawnActor:state.testSpawnActor,fixedSpawns:deepClone(state.testFixedSpawns)};}
function resolvedTestBoard(c){return createBoardDefinition({boardShape:c.boardShape,boardSizeKey:c.boardSizeKey,seed:`${c.rollSeed}:board`});}
function fixedSpawnKeys(c){return c.npc?["me","npc"]:["me"];}
function selectedFixedSpawn(c){const key=c.npc&&c.spawnActor==="npc"?"npc":"me";return{key,spawn:c.fixedSpawns[key]};}
function testSpawns(c,count,def=resolvedTestBoard(c)){if(c.spawnMode==="random")return createRandomSpawns(def,count,`${c.rollSeed}:random-spawns`);if(c.spawnMode==="battle")return createBattleSpawns(def,count,`${c.rollSeed}:battle-spawns`);const spawns=fixedSpawnKeys(c).slice(0,count).map(key=>c.fixedSpawns[key]);return validateSpawnList(def,spawns,count)?spawns.map(s=>({...s})):null;}
function invalidateTestFixedSpawns(){const c=effectiveTestConfig(),def=resolvedTestBoard(c);for(const key of ["me","npc"]){const s=state.testFixedSpawns[key];if(s&&s.x!=null&&!isPlayableCell(def,Number(s.x),Number(s.y))){s.x=null;s.y=null;}}const a=state.testFixedSpawns.me,b=state.testFixedSpawns.npc;if(a?.x!=null&&b?.x!=null&&a.x===b.x&&a.y===b.y){b.x=null;b.y=null;}}
function previewGame(c){const def=resolvedTestBoard(c),count=c.npc?2:1,spawns=testSpawns(c,count,def),board=Array.from({length:def.size},()=>Array(def.size).fill(-1)),agents=[];const defs=[{key:"me",name:"あなた",color:"blue"},{key:"npc",name:`NPC・${testNpcLabel(c.npcType)}`,color:"red"}].slice(0,count);const previewSpawns=spawns||defs.map(d=>c.fixedSpawns[d.key]);for(const d of defs){const s=previewSpawns[defs.indexOf(d)];if(!s||s.x==null||!isPlayableCell(def,Number(s.x),Number(s.y)))continue;const index=agents.length;agents.push({id:d.key,name:d.name,color:d.color,x:Number(s.x),y:Number(s.y),dir:Number(s.dir)||0,alive:true,tail:[]});if(c.mode==="territory"||c.mode==="splat")board[Number(s.y)][Number(s.x)]=index;}return{mode:c.mode,size:def.size,boardShape:def.shape,boardSizeKey:def.sizeKey,mask:def.mask,playableCount:def.playableCount,board,agents,holes:new Set(),effects:[]};}
function renderTestPreview(){if(state.testTimer)return;const c=effectiveTestConfig(),game=previewGame(c),def=resolvedTestBoard(c);state.testGame=game;renderBoard($("#testBoard"),game);$("#testBoardMeta").textContent=`${def.size} × ${def.size} ・ ${boardChoiceLabel(def.shape,def.sizeKey)}`;}
function updateTestBenchUI(){const c=effectiveTestConfig(),def=resolvedTestBoard(c),selected=selectedFixedSpawn(c),fixed=c.spawnMode==="fixed";$$('[data-test-mode]').forEach(b=>b.classList.toggle('is-selected',b.dataset.testMode===c.mode));$("#testNpcEnabled").checked=c.npc;$("#testNpcType").value=c.npcType;$("#testBoardShape").value=c.boardShape;$("#testBoardSizeKey").value=c.boardSizeKey;$("#testSpawnMode").value=c.spawnMode;$("#testSpawnActor").value=selected.key;$("#testSpawnDirection").value=String(Number(selected.spawn?.dir)||0);$("#testNpcTypeRow").classList.toggle("is-hidden",!c.npc);$("#testSpawnActorRow").classList.toggle("is-hidden",!(fixed&&c.npc));$("#testDirectionRow").classList.toggle("is-hidden",!fixed);$("#testSpawnHint").classList.toggle("is-hidden",!fixed);if(fixed){const missing=selected.spawn?.x==null;$("#testSpawnHint").textContent=missing?`${selected.key==="npc"?"NPC":"あなた"}の開始マスを盤面上で指定してください。`:`${selected.key==="npc"?"NPC":"あなた"}：(${selected.spawn.x}, ${selected.spawn.y}) ・ 盤面タップで変更`;$("#testSpawnHint").classList.toggle("is-warning",missing);}const requested=boardChoiceLabel(c.boardShape,c.boardSizeKey),resolved=(c.boardShape==="random"||c.boardSizeKey==="random")?` → ${boardChoiceLabel(def.shape,def.sizeKey)}`:"";$("#testSettingsSummary").textContent=`${c.npc?"NPC "+testNpcLabel(c.npcType):"NPCなし"} ・ ${requested}${resolved} ・ ${c.spawnMode==="fixed"?"指定":c.spawnMode==="battle"?"対戦配置":"ランダム配置"}`;renderTestPreview();}
function setTestMode(mode){if(MODES.includes(mode)){state.testMode=mode;updateTestBenchUI();}}
function openCommandHelp''',
    "test board configuration",
)
# Replace runTest with resolved board and the three spawn policies.
sub(
    app,
    r'function runTest\(\)\{.*?\nfunction openTutorialLibrary',
    '''function runTest(){stopTest();let c=effectiveTestConfig();if(!isTutorial()&&(c.spawnMode==="random"||c.boardShape==="random"||c.boardSizeKey==="random")){state.testRollSeed=freshSeed();c=effectiveTestConfig();}const def=resolvedTestBoard(c),program=deepClone(state.draft.blocks),players=[{id:"me",name:"あなた",color:"blue",program}];if(c.npc)players.push({id:"test-npc",name:`NPC・${testNpcLabel(c.npcType)}`,color:"red",program:makeTestNpcProgram(c.mode,c.npcType,0)});const spawns=testSpawns(c,players.length,def);if(c.spawnMode==="fixed"&&!spawns){updateTestBenchUI();return toast("指定スポーンを全員分設定してください");}let game;try{game=createGameState({mode:c.mode,seed:isTutorial()?"tutorial-test-v5":state.testRollSeed,size:def.size,boardShape:def.shape,boardSizeKey:def.sizeKey,maxTicks:Number.MAX_SAFE_INTEGER,stagnationTicks:Number.MAX_SAFE_INTEGER,allowSolo:!c.npc,players,spawns});}catch(e){console.error(e);return toast("スポーン位置を確認してください");}state.testGame=game;renderBoard($("#testBoard"),game);$("#testBoardMeta").textContent=`${game.size} × ${game.size} ・ ${boardChoiceLabel(game.boardShape,game.boardSizeKey)}`;$("#testStatus").textContent=`実行中 ・ ${MODE_LABELS[c.mode]} ・ ${c.npc?testNpcLabel(c.npcType):"NPCなし"}`;const step=Number(state.profile?.tutorialStep||0);let halted=0;state.testTimer=setInterval(()=>{const prev=game.board?.map(r=>[...r]);stepGame(game);renderBoard($("#testBoard"),game,prev);const a=game.agents[0],stopped=a?.alive&&a.vm?.halted===true&&(c.mode==="territory"||c.mode==="splat");halted=stopped?halted+1:0;if(isTutorial()&&step===10&&a.alive&&game.tick>=30){stopTest();state.tutorialFinalPassed=true;$("#testStatus").textContent="成功：崖を判断して走り続けられました。駒を保存してください。";renderTutorial();return;}if(!a?.alive||game.finished||halted>=2){const reason=!a?.alive?(a.deathReason==="cliff"?"崖から落ちました":"ゲームオーバー"):halted>=2?"コードの末尾まで実行して停止しました":game.finishReason||"ゲーム終了";stopTest(`テスト終了：${reason}（${game.tick}tick）`);if(isTutorial()&&step===2&&halted>=2&&game.tick<=4)tutorialProgress(3);else if(isTutorial()&&step===4&&!a.alive&&a.deathReason==="cliff")tutorialProgress(5);}},120);}
function openTutorialLibrary''',
    "test runner board settings",
)
# Online room cards / lobby / create payload.
sub(
    app,
    r'function renderPublicRooms\(\)\{.*?\nfunction renderOnlineArea',
    '''function renderPublicRooms(){const host=$("#publicRoomList");if(!host)return;host.innerHTML="";if(!state.publicRooms.length){host.className="public-room-list empty-state";host.textContent="現在、募集中の公開ルームはありません。";return;}host.className="public-room-list";state.publicRooms.forEach(r=>{const b=document.createElement("button");b.className="public-room-card";const modes=r.modes||[r.mode||"territory"],board=r.boardShape?boardChoiceLabel(r.boardShape,r.boardSizeKey):`${r.size}×${r.size}`;b.innerHTML=`<span class="room-live-dot"></span><div><strong>${esc(r.hostName||"ルーム")}</strong><small>${modes.map(m=>MODE_LABELS[m]).join(" / ")} ・ ${esc(board)} ・ ${r.currentPlayers}/${r.playerCount}人</small></div><b>${r.roomId}</b>`;b.onclick=()=>joinRoom(r.roomId);host.append(b);});}
function renderOnlineArea''',
    "public room board summary",
)
swap(
    app,
    '$("#lobbyRuleSummary").innerHTML=`<span>${(room.settings.modes||[room.settings.mode]).map(m=>MODE_LABELS[m]).join(" / ")}</span><span>${room.settings.size} × ${room.settings.size}</span><span>定員 ${room.settings.playerCount}人</span>`;',
    '$("#lobbyRuleSummary").innerHTML=`<span>${(room.settings.modes||[room.settings.mode]).map(m=>MODE_LABELS[m]).join(" / ")}</span><span>${esc(boardChoiceLabel(room.settings.boardShape||"square",room.settings.boardSizeKey||"large"))}${room.settings.rerollBoardEachRound?" ・ 各ラウンド再抽選":""}</span><span>定員 ${room.settings.playerCount}人</span>`;',
    "online lobby board summary",
)
sub(
    app,
    r'async function createRoom\(\)\{.*?\nasync function joinRoom',
    '''async function createRoom(){try{const choice=boardChoiceFromControls(true),d=await emitSocket("now:create-room",{privateRoom:$("#privateRoom").checked,settings:{modes:selectedModeArray(true),allowRoundProgramChange:$("#onlineAllowRoundProgramChange").checked,playerCount:Number($("#onlinePlayerCount").value),boardShape:choice.shape,boardSizeKey:choice.sizeKey,rerollBoardEachRound:$("#onlineRerollBoardEachRound").checked,seed:$("#onlineSeed").value.trim(),fillWithNpc:$("#fillWithNpc").checked,npcDifficulty:$("#onlineNpcDifficulty").value}});state.onlineRoom=d.room;renderOnlineArea();}catch(e){console.error(e);toast("ルーム作成に失敗しました")}}
async function joinRoom''',
    "online create board payload",
)
# Online reveal displays the server-resolved board.
swap(
    app,
    'if(config.online?.series&&Number(config.online.roundIndex)>0)showRoundReveal(config.mode,Number(config.online.roundIndex)+1,Number(config.online.totalRounds)||1,launch);else launch();',
    'if(config.online?.series&&Number(config.online.roundIndex)>0)showRoundReveal(config.mode,Number(config.online.roundIndex)+1,Number(config.online.totalRounds)||1,launch,{shape:config.boardShape||"square",sizeKey:config.boardSizeKey||"large"});else launch();',
    "online round board reveal",
)
# Replace test/battle/online settings event cluster.
old_events = '$("#testNpcEnabled").onchange=e=>{state.testNpcEnabled=e.target.checked;updateTestBenchUI()};$("#testNpcType").onchange=e=>{state.testNpcType=e.target.value;updateTestBenchUI()};$("#testSpawnMode").onchange=e=>{state.testSpawnMode=e.target.value;updateTestBenchUI()};$("#testSpawnDirection").onchange=e=>{state.testSpawn.dir=Number(e.target.value);updateTestBenchUI()};$("#testBoard").addEventListener("click",e=>{if(isTutorial()||state.testSpawnMode!=="fixed")return;const c=e.target.closest(".board-cell");if(!c)return;state.testSpawn.x=Number(c.dataset.x);state.testSpawn.y=Number(c.dataset.y);updateTestBenchUI();toast(`開始位置：${state.testSpawn.x}, ${state.testSpawn.y}`)});updateTestBenchUI();bindSwipeRail("#modeRail");bindSwipeRail("#onlineModeRail",true);'
new_events = '$("#testNpcEnabled").onchange=e=>{state.testNpcEnabled=e.target.checked;if(!state.testNpcEnabled)state.testSpawnActor="me";updateTestBenchUI()};$("#testNpcType").onchange=e=>{state.testNpcType=e.target.value;updateTestBenchUI()};$("#testBoardShape").onchange=e=>{state.testBoardShape=e.target.value;state.testRollSeed=freshSeed();invalidateTestFixedSpawns();updateTestBenchUI()};$("#testBoardSizeKey").onchange=e=>{state.testBoardSizeKey=e.target.value;state.testRollSeed=freshSeed();invalidateTestFixedSpawns();updateTestBenchUI()};$("#testSpawnMode").onchange=e=>{state.testSpawnMode=e.target.value;state.testRollSeed=freshSeed();updateTestBenchUI()};$("#testSpawnActor").onchange=e=>{state.testSpawnActor=e.target.value;updateTestBenchUI()};$("#testSpawnDirection").onchange=e=>{const key=state.testNpcEnabled&&state.testSpawnActor==="npc"?"npc":"me";state.testFixedSpawns[key].dir=Number(e.target.value);updateTestBenchUI()};$("#testBoard").addEventListener("click",e=>{if(isTutorial()||state.testSpawnMode!=="fixed")return;const cell=e.target.closest(".board-cell");if(!cell)return;const c=effectiveTestConfig(),def=resolvedTestBoard(c),x=Number(cell.dataset.x),y=Number(cell.dataset.y);if(!isPlayableCell(def,x,y))return toast("そのマスは盤面外です");const key=state.testNpcEnabled&&state.testSpawnActor==="npc"?"npc":"me",other=key==="me"?"npc":"me";if(state.testNpcEnabled&&state.testFixedSpawns[other]?.x===x&&state.testFixedSpawns[other]?.y===y)return toast("同じマスには配置できません");state.testFixedSpawns[key].x=x;state.testFixedSpawns[key].y=y;updateTestBenchUI();toast(`${key==="npc"?"NPC":"あなた"}の開始位置：${x}, ${y}`)});for(const [shape,size,online] of [["#boardShape","#boardSizeKey",false],["#onlineBoardShape","#onlineBoardSizeKey",true]]){$(shape).onchange=()=>updateBoardConfigUI(online);$(size).onchange=()=>updateBoardConfigUI(online);}updateBoardConfigUI(false);updateBoardConfigUI(true);updateTestBenchUI();bindSwipeRail("#modeRail");bindSwipeRail("#onlineModeRail",true);'
swap(app, old_events, new_events, "board setting event bindings")

# ---------------------------------------------------------------------------
# online.js: server owns deterministic board selection for online series
# ---------------------------------------------------------------------------
online = "src/server/now-coding/online.js"
swap(
    online,
    'import { MODE_LABELS, makeModeNpcProgram } from "../../../public/now-coding/modes.js";\n',
    'import { MODE_LABELS, makeModeNpcProgram } from "../../../public/now-coding/modes.js";\nimport { BOARD_SHAPES, BOARD_SIZE_KEYS, createBoardDefinition, resolveBoardChoice } from "../../../public/now-coding/boards.js";\n',
    "online board import",
)
swap(online, 'const VALID_SIZES = new Set([15, 21, 31]);\n', 'const VALID_BOARD_SHAPES = new Set([...BOARD_SHAPES, "random"]);\nconst VALID_BOARD_SIZES = new Set([...BOARD_SIZE_KEYS, "random"]);\n', "online board valid sets")
sub(
    online,
    r'function normalizeSettings\(raw = \{\}\) \{.*?\n\}',
    '''function normalizeSettings(raw = {}) {
  const modes = normalizeModes(raw.modes || raw.mode);
  const boardShape = VALID_BOARD_SHAPES.has(raw.boardShape) ? raw.boardShape : "square";
  const boardSizeKey = VALID_BOARD_SIZES.has(raw.boardSizeKey) ? raw.boardSizeKey : "large";
  const hasRandomBoard = boardShape === "random" || boardSizeKey === "random";
  return {
    modes,
    mode: modes[0],
    playerCount: Math.max(2, Math.min(4, Number(raw.playerCount) || 2)),
    boardShape,
    boardSizeKey,
    rerollBoardEachRound: modes.length > 1 && hasRandomBoard && Boolean(raw.rerollBoardEachRound),
    seed: text(raw.seed, 128),
    fillWithNpc: Boolean(raw.fillWithNpc),
    npcDifficulty: VALID_DIFFICULTIES.has(raw.npcDifficulty) ? raw.npcDifficulty : "medium",
    allowRoundProgramChange: modes.length > 1 && Boolean(raw.allowRoundProgramChange),
  };
}''',
    "online normalize board settings",
)
sub(
    online,
    r'function modeMaxTicks\(mode, size\) \{.*?\n\}',
    '''function modeMaxTicks(mode, boardDef) {
  const cells = boardDef.playableCount;
  if (mode === "cobra" || mode === "fall") return Math.max(600, cells * 2);
  if (mode === "splat") return Math.max(500, cells * 2);
  return Math.max(420, cells * 2);
}''',
    "online mode max ticks",
)
swap(
    online,
    'return { roomId: room.id, hostName: room.members.find((m) => m.userTrackingId === room.hostId)?.username || "", modes: [...room.settings.modes], mode: room.settings.modes[0], modeLabel: room.settings.modes.map((m) => MODE_LABELS[m]).join(" / "), size: room.settings.size, playerCount: room.settings.playerCount, currentPlayers: connected, fillWithNpc: room.settings.fillWithNpc, npcDifficulty: room.settings.npcDifficulty, createdAt: room.createdAt };',
    'return { roomId: room.id, hostName: room.members.find((m) => m.userTrackingId === room.hostId)?.username || "", modes: [...room.settings.modes], mode: room.settings.modes[0], modeLabel: room.settings.modes.map((m) => MODE_LABELS[m]).join(" / "), boardShape: room.settings.boardShape, boardSizeKey: room.settings.boardSizeKey, rerollBoardEachRound: room.settings.rerollBoardEachRound, playerCount: room.settings.playerCount, currentPlayers: connected, fillWithNpc: room.settings.fillWithNpc, npcDifficulty: room.settings.npcDifficulty, createdAt: room.createdAt };',
    "public room board settings",
)
sub(
    online,
    r'function emitMatchStart\(io, room\) \{.*?\n\}',
    '''function resolvedRoomBoard(room) {
  if (!room.settings.rerollBoardEachRound) return room.fixedBoard;
  return resolveBoardChoice({ shape: room.settings.boardShape, sizeKey: room.settings.boardSizeKey, seed: `${room.masterSeed}:board:${room.currentRound}` });
}
function emitMatchStart(io, room) {
  const mode = room.roundOrder[room.currentRound];
  const players = buildPlayers(room, mode);
  const boardChoice = resolvedRoomBoard(room);
  const boardDef = createBoardDefinition({ boardShape: boardChoice.shape, boardSizeKey: boardChoice.sizeKey });
  room.status = "playing";
  room.roundFinished = new Set();
  room.roundDeadline = 0;
  touch(room);
  io.to(channel(room.id)).emit("now:match-start", {
    mode,
    seed: `${room.masterSeed}:round:${room.currentRound}`,
    size: boardDef.size,
    boardShape: boardDef.shape,
    boardSizeKey: boardDef.sizeKey,
    players,
    maxTicks: modeMaxTicks(mode, boardDef),
    online: { roomId: room.id, saveOwnerId: room.hostId, series: true, roundIndex: room.currentRound, totalRounds: room.roundOrder.length, mode, colors: players.map((p) => p.color), allowRoundProgramChange: room.settings.allowRoundProgramChange, boardShape: boardDef.shape, boardSizeKey: boardDef.sizeKey },
  });
  emitRoom(io, room);
}''',
    "online match resolved board",
)
swap(
    online,
    'assignFixedColors(room); room.masterSeed = room.settings.seed || makeSeed(); room.roundOrder = seededShuffle(room.settings.modes, room.masterSeed); room.currentRound = 0; room.startedAt = Date.now(); ack(cb, { ok: true }); emitMatchStart(io, room); io.emit("now:rooms-changed");',
    'assignFixedColors(room); room.masterSeed = room.settings.seed || makeSeed(); room.roundOrder = seededShuffle(room.settings.modes, room.masterSeed); room.fixedBoard = room.settings.rerollBoardEachRound ? null : resolveBoardChoice({ shape: room.settings.boardShape, sizeKey: room.settings.boardSizeKey, seed: `${room.masterSeed}:series-board` }); room.currentRound = 0; room.startedAt = Date.now(); ack(cb, { ok: true }); emitMatchStart(io, room); io.emit("now:rooms-changed");',
    "online series fixed board",
)

# ---------------------------------------------------------------------------
# Tests: board masks, spawn policy, client/server contracts
# ---------------------------------------------------------------------------
engine_test = "tools/now-coding/engine.test.mjs"
swap(
    engine_test,
    'import { evaluateVmExpression } from "../../public/now-coding/vm.js";\n',
    'import { evaluateVmExpression } from "../../public/now-coding/vm.js";\nimport { createBattleSpawns, createBoardDefinition, createRandomSpawns, isPlayableCell, resolveBoardChoice } from "../../public/now-coding/boards.js";\n',
    "engine test board imports",
)
append_tests = r'''

test("all eight board presets have a deterministic playable mask", () => {
  const expected = {
    "square:small": [15, 225], "square:large": [21, 441],
    "diamond:small": [21, 221], "diamond:large": [29, 421],
    "cross:small": [19, 217], "cross:large": [27, 405],
    "donut:small": [19, 216], "donut:large": [27, 420],
  };
  for (const [key, [size, count]] of Object.entries(expected)) {
    const [boardShape, boardSizeKey] = key.split(":");
    const def = createBoardDefinition({ boardShape, boardSizeKey });
    assert.equal(def.size, size, key);
    assert.equal(def.playableCount, count, key);
  }
});

test("random board choices are seed deterministic and only randomize requested dimensions", () => {
  const a = resolveBoardChoice({ shape: "random", sizeKey: "large", seed: "same" });
  const b = resolveBoardChoice({ shape: "random", sizeKey: "large", seed: "same" });
  assert.deepEqual(a, b);
  assert.equal(a.sizeKey, "large");
  const c = resolveBoardChoice({ shape: "donut", sizeKey: "random", seed: "same" });
  assert.equal(c.shape, "donut");
  assert.ok(["small", "large"].includes(c.sizeKey));
});

test("battle and random spawns always land on distinct playable cells", () => {
  for (const shape of ["square", "diamond", "cross", "donut"]) {
    for (const sizeKey of ["small", "large"]) {
      const def = createBoardDefinition({ boardShape: shape, boardSizeKey: sizeKey });
      for (const factory of [createBattleSpawns, createRandomSpawns]) {
        const spawns = factory(def, 4, `${shape}:${sizeKey}:${factory.name}`);
        assert.equal(new Set(spawns.map((s) => `${s.x},${s.y}`)).size, 4);
        for (const spawn of spawns) {
          assert.equal(isPlayableCell(def, spawn.x, spawn.y), true);
          assert.ok(spawn.dir >= 0 && spawn.dir <= 3);
        }
      }
    }
  }
});

test("diamond void is sensed as cliff and cannot be entered", () => {
  const state = createGameState({ mode: "territory", seed: "diamond-edge", boardShape: "diamond", boardSizeKey: "small", allowSolo: true, players: [{ id: "a", program: [move] }], spawns: [{ x: 10, y: 0, dir: 3 }] });
  assert.equal(senseModeCell(state, state.agents[0], "front").state, "cliff");
  stepGame(state);
  assert.equal(state.agents[0].alive, false);
  assert.equal(state.agents[0].deathReason, "cliff");
});

test("fixed spawn may use the outer edge on a square board", () => {
  const state = createGameState({ mode: "territory", seed: "edge-spawn", boardShape: "square", boardSizeKey: "small", allowSolo: true, players: [{ id: "a", program: [right] }], spawns: [{ x: 0, y: 14, dir: 0 }] });
  assert.equal(state.agents[0].x, 0);
  assert.equal(state.agents[0].y, 14);
});

test("splat shots stop at donut void instead of crossing the hole", () => {
  const attack = { type: "action", action: "attack", range: literal(20) };
  const state = createGameState({ mode: "splat", seed: "donut-shot", boardShape: "donut", boardSizeKey: "small", players: [{ id: "a", program: [attack] }, { id: "b", program: [right] }], spawns: [{ x: 9, y: 0, dir: 2 }, { x: 9, y: 18, dir: 0 }] });
  state.agents[0].ink = 30;
  stepGame(state);
  assert.equal(state.agents[1].alive, true);
  assert.ok(state.effects.filter((e) => e.type === "shot").length < 18);
});
'''
text = read(engine_test)
if 'all eight board presets have a deterministic playable mask' not in text:
    write(engine_test, text + append_tests)

client_test = "tools/now-coding/client-contract.test.mjs"
swap(
    client_test,
    'const css = ["public/now-coding/style-v3.css", "public/now-coding/style-v4.css", "public/now-coding/style-v6.css"].map((p) => fs.readFileSync(p, "utf8")).join("\\n");',
    'const css = ["public/now-coding/style-v3.css", "public/now-coding/style-v4.css", "public/now-coding/style-v6.css", "public/now-coding/style-v7.css"].map((p) => fs.readFileSync(p, "utf8")).join("\\n");\nconst online = fs.readFileSync("src/server/now-coding/online.js", "utf8");\nconst boards = fs.readFileSync("public/now-coding/boards.js", "utf8");',
    "client contract extra files",
)
append_contract = r'''

test("board variants and compact setup controls are exposed consistently", () => {
  for (const id of ["testBoardShape","testBoardSizeKey","testSpawnMode","testSpawnActor","boardShape","boardSizeKey","rerollBoardEachRound","onlineBoardShape","onlineBoardSizeKey","onlineRerollBoardEachRound"]) assert.ok(htmlHasId(id), id);
  for (const value of ["square","diamond","cross","donut","random"]) assert.ok(html.includes(`value="${value}"`));
  assert.match(html, /<option value="battle">対戦配置<\/option>/);
  assert.match(css, /\.board-cell\.is-void/);
  assert.match(css, /\.board-config-card/);
  assert.match(app, /ラウンドごとに盤面を再抽選|rerollBoardEachRound/);
  assert.match(app, /createRandomSpawns/);
  assert.match(app, /createBattleSpawns/);
  assert.doesNotMatch(app, /Math\.max\(1,Math\.min\(13,Number\(c\.spawn/);
});

test("online server resolves board selection deterministically and sends resolved board", () => {
  assert.match(online, /boardShape/);
  assert.match(online, /boardSizeKey/);
  assert.match(online, /rerollBoardEachRound/);
  assert.match(online, /resolveBoardChoice/);
  assert.match(online, /boardShape: boardDef\.shape/);
  assert.match(online, /boardSizeKey: boardDef\.sizeKey/);
  assert.match(boards, /diamond/);
  assert.match(boards, /cross/);
  assert.match(boards, /donut/);
});

test("test board fixed spawn supports both user and NPC including outer cells", () => {
  assert.match(app, /testFixedSpawns/);
  assert.match(app, /state\.testSpawnActor/);
  assert.match(app, /isPlayableCell\(def,x,y\)/);
  assert.match(app, /同じマスには配置できません/);
  assert.match(app, /Number\.MAX_SAFE_INTEGER/);
});
'''
text = read(client_test)
if 'board variants and compact setup controls are exposed consistently' not in text:
    write(client_test, text + append_contract)

# Permanent workflow: syntax check new module and surface new stylesheet.
workflow = ".github/workflows/now-coding.yml"
swap(workflow, '          node --check public/now-coding/vm.js\n', '          node --check public/now-coding/vm.js\n          node --check public/now-coding/boards.js\n', "boards syntax CI")
swap(workflow, "          grep -q 'style-v3.css' public/now-coding/index.html\n", "          grep -q 'style-v3.css' public/now-coding/index.html\n          grep -q 'style-v7.css' public/now-coding/index.html\n", "style v7 CI")

print("board variant patch applied")
