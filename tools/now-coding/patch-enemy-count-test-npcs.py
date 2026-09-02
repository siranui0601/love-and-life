from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing pattern: {label}")
    return text.replace(old, new, 1)

# VM: expose the number of currently living enemies.
vm_path = Path("public/now-coding/vm.js")
vm = vm_path.read_text()
vm = replace_once(
    vm,
    'function nearestEnemyDistance(state, agent) {\n  let best = Infinity;\n  for (const other of state.agents || []) {\n    if (!other?.alive || other.id === agent.id) continue;\n    const distance = Math.abs(Number(other.x) - Number(agent.x)) + Math.abs(Number(other.y) - Number(agent.y));\n    if (distance < best) best = distance;\n  }\n  return Number.isFinite(best) ? best : -1;\n}\n',
    'function nearestEnemyDistance(state, agent) {\n  let best = Infinity;\n  for (const other of state.agents || []) {\n    if (!other?.alive || other.id === agent.id) continue;\n    const distance = Math.abs(Number(other.x) - Number(agent.x)) + Math.abs(Number(other.y) - Number(agent.y));\n    if (distance < best) best = distance;\n  }\n  return Number.isFinite(best) ? best : -1;\n}\n\nfunction aliveEnemyCount(state, agent) {\n  return (state.agents || []).filter((other) => other?.alive && other.id !== agent.id).length;\n}\n',
    "enemy count helper",
)
vm = replace_once(
    vm,
    '    if (expr.name === "enemyDistance") return nearestEnemyDistance(context.state, context.agent);\n    if (expr.name === "timer") return Math.max(0, Number(context.state?.tick || 0));',
    '    if (expr.name === "enemyDistance") return nearestEnemyDistance(context.state, context.agent);\n    if (expr.name === "enemyCount") return aliveEnemyCount(context.state, context.agent);\n    if (expr.name === "timer") return Math.max(0, Number(context.state?.tick || 0));',
    "enemy count builtin",
)
vm_path.write_text(vm)

# Client/controller.
app_path = Path("public/now-coding/app-v3.js")
app = app_path.read_text()
app = replace_once(
    app,
    'testMode: "territory", testNpcEnabled: false, testNpcType: "intermediate", testBoardShape: "square", testBoardSizeKey: "small", testRollSeed: "test-initial", testSpawnMode: "random", testSpawnActor: "me", testFixedSpawns: { me:{x:4,y:7,dir:1}, npc:{x:10,y:7,dir:3} }',
    'testMode: "territory", testNpcCount: 0, testNpcType: "intermediate", testBoardShape: "square", testBoardSizeKey: "small", testRollSeed: "test-initial", testSpawnMode: "random", testSpawnActor: "me", testFixedSpawns: { me:{x:4,y:7,dir:1}, npc1:{x:10,y:7,dir:3}, npc2:{x:7,y:4,dir:2}, npc3:{x:7,y:10,dir:0} }',
    "test state",
)
app = replace_once(
    app,
    '"expr:sensor":["（前・左・右）","number"],"expr:cellState":["（マスの状態）","number"],"expr:enemyDistance":["最も近い敵との距離","number"],"expr:timer":["タイマー","number"],',
    '"expr:sensor":["（前・左・右）","number"],"expr:cellState":["（マスの状態）","number"],"expr:enemyDistance":["最も近い敵との距離","number"],"expr:enemyCount":["敵の数","number"],"expr:timer":["タイマー","number"],',
    "recent enemy count",
)
app = replace_once(
    app,
    'if(expr.type==="builtin")return expr.name==="enemyDistance"?"最も近い敵との距離":expr.name==="timer"?"タイマー":"値";',
    'if(expr.type==="builtin")return expr.name==="enemyDistance"?"最も近い敵との距離":expr.name==="enemyCount"?"敵の数":expr.name==="timer"?"タイマー":"値";',
    "enemy count summary",
)
app = replace_once(
    app,
    '["enemyDistance","timer","ink","tailLength","noMoveTicks"].includes(expr.name)',
    '["enemyDistance","enemyCount","timer","ink","tailLength","noMoveTicks"].includes(expr.name)',
    "enemy count static kind",
)
app = replace_once(
    app,
    'if(key==="enemyDistance")return builtin("enemyDistance");if(key==="timer")return builtin("timer");',
    'if(key==="enemyDistance")return builtin("enemyDistance");if(key==="enemyCount")return builtin("enemyCount");if(key==="timer")return builtin("timer");',
    "enemy count preset",
)
app = replace_once(
    app,
    '}else if(expr.type==="builtin"&&expr.name==="enemyDistance"){\n   node.classList.add("expr-enemy-distance");node.textContent="（最も近い敵との距離）";\n }else if(expr.type==="builtin"&&expr.name==="timer"){',
    '}else if(expr.type==="builtin"&&expr.name==="enemyDistance"){\n   node.classList.add("expr-enemy-distance");node.textContent="（最も近い敵との距離）";\n }else if(expr.type==="builtin"&&expr.name==="enemyCount"){\n   node.classList.add("expr-enemy-count");node.textContent="（敵の数）";\n }else if(expr.type==="builtin"&&expr.name==="timer"){',
    "enemy count render",
)
old_test_helpers = '''function effectiveTestConfig(){if(isTutorial())return{mode:"territory",npc:false,npcType:"straight",boardShape:"square",boardSizeKey:"small",rollSeed:"tutorial-board",spawnMode:"fixed",spawnActor:"me",fixedSpawns:{me:{x:4,y:7,dir:1},npc:{x:10,y:7,dir:3}}};return{mode:state.testMode,npc:state.testNpcEnabled,npcType:state.testNpcType,boardShape:state.testBoardShape,boardSizeKey:state.testBoardSizeKey,rollSeed:state.testRollSeed,spawnMode:state.testSpawnMode,spawnActor:state.testSpawnActor,fixedSpawns:deepClone(state.testFixedSpawns)};}
function resolvedTestBoard(c){return createBoardDefinition({boardShape:c.boardShape,boardSizeKey:c.boardSizeKey,seed:`${c.rollSeed}:board`});}
function fixedSpawnKeys(c){return c.npc?["me","npc"]:["me"];}
function selectedFixedSpawn(c){const key=c.npc&&c.spawnActor==="npc"?"npc":"me";return{key,spawn:c.fixedSpawns[key]};}
function testSpawns(c,count,def=resolvedTestBoard(c)){if(c.spawnMode==="random")return createRandomSpawns(def,count,`${c.rollSeed}:random-spawns`);if(c.spawnMode==="battle")return createBattleSpawns(def,count,`${c.rollSeed}:battle-spawns`);const spawns=fixedSpawnKeys(c).slice(0,count).map(key=>c.fixedSpawns[key]);return validateSpawnList(def,spawns,count)?spawns.map(s=>({...s})):null;}
function invalidateTestFixedSpawns(){const c=effectiveTestConfig(),def=resolvedTestBoard(c);for(const key of ["me","npc"]){const s=state.testFixedSpawns[key];if(s&&s.x!=null&&!isPlayableCell(def,Number(s.x),Number(s.y))){s.x=null;s.y=null;}}const a=state.testFixedSpawns.me,b=state.testFixedSpawns.npc;if(a?.x!=null&&b?.x!=null&&a.x===b.x&&a.y===b.y){b.x=null;b.y=null;}}
function previewGame(c){const def=resolvedTestBoard(c),count=c.npc?2:1,spawns=testSpawns(c,count,def),board=Array.from({length:def.size},()=>Array(def.size).fill(-1)),agents=[];const defs=[{key:"me",name:"あなた",color:"blue"},{key:"npc",name:`NPC・${testNpcLabel(c.npcType)}`,color:"red"}].slice(0,count);const previewSpawns=spawns||defs.map(d=>c.fixedSpawns[d.key]);for(const d of defs){const s=previewSpawns[defs.indexOf(d)];if(!s||s.x==null||!isPlayableCell(def,Number(s.x),Number(s.y)))continue;const index=agents.length;agents.push({id:d.key,name:d.name,color:d.color,x:Number(s.x),y:Number(s.y),dir:Number(s.dir)||0,alive:true,tail:[]});if(c.mode==="territory"||c.mode==="splat")board[Number(s.y)][Number(s.x)]=index;}return{mode:c.mode,size:def.size,boardShape:def.shape,boardSizeKey:def.sizeKey,mask:def.mask,playableCount:def.playableCount,board,agents,holes:new Set(),effects:[]};}
'''
new_test_helpers = '''function effectiveTestConfig(){if(isTutorial())return{mode:"territory",npcCount:0,npcType:"straight",boardShape:"square",boardSizeKey:"small",rollSeed:"tutorial-board",spawnMode:"fixed",spawnActor:"me",fixedSpawns:{me:{x:4,y:7,dir:1}}};return{mode:state.testMode,npcCount:Math.max(0,Math.min(3,Number(state.testNpcCount)||0)),npcType:state.testNpcType,boardShape:state.testBoardShape,boardSizeKey:state.testBoardSizeKey,rollSeed:state.testRollSeed,spawnMode:state.testSpawnMode,spawnActor:state.testSpawnActor,fixedSpawns:deepClone(state.testFixedSpawns)};}
function resolvedTestBoard(c){return createBoardDefinition({boardShape:c.boardShape,boardSizeKey:c.boardSizeKey,seed:`${c.rollSeed}:board`});}
function testNpcKeys(c){return Array.from({length:Math.max(0,Math.min(3,Number(c.npcCount)||0))},(_,i)=>`npc${i+1}`);}
function fixedSpawnKeys(c){return["me",...testNpcKeys(c)];}
function selectedFixedSpawn(c){const keys=fixedSpawnKeys(c),key=keys.includes(c.spawnActor)?c.spawnActor:"me";return{key,spawn:c.fixedSpawns[key]};}
function testSpawns(c,count,def=resolvedTestBoard(c)){if(c.spawnMode==="random")return createRandomSpawns(def,count,`${c.rollSeed}:random-spawns`);if(c.spawnMode==="battle")return createBattleSpawns(def,count,`${c.rollSeed}:battle-spawns`);const spawns=fixedSpawnKeys(c).slice(0,count).map(key=>c.fixedSpawns[key]);return validateSpawnList(def,spawns,count)?spawns.map(s=>({...s})):null;}
function invalidateTestFixedSpawns(){const c=effectiveTestConfig(),def=resolvedTestBoard(c),seen=new Set();for(const key of fixedSpawnKeys(c)){const s=state.testFixedSpawns[key];if(!s)continue;if(s.x!=null&&!isPlayableCell(def,Number(s.x),Number(s.y))){s.x=null;s.y=null;continue;}if(s.x==null)continue;const pos=`${s.x},${s.y}`;if(seen.has(pos)){s.x=null;s.y=null;continue;}seen.add(pos);}}
function previewGame(c){const def=resolvedTestBoard(c),count=1+c.npcCount,spawns=testSpawns(c,count,def),board=Array.from({length:def.size},()=>Array(def.size).fill(-1)),agents=[];const defs=[{key:"me",name:"あなた",color:PLAYER_COLORS[0]},...testNpcKeys(c).map((key,i)=>({key,name:`NPC${i+1}・${testNpcLabel(c.npcType)}`,color:PLAYER_COLORS[i+1]}))];const previewSpawns=spawns||defs.map(d=>c.fixedSpawns[d.key]);for(const d of defs){const s=previewSpawns[defs.indexOf(d)];if(!s||s.x==null||!isPlayableCell(def,Number(s.x),Number(s.y)))continue;const index=agents.length;agents.push({id:d.key,name:d.name,color:d.color,x:Number(s.x),y:Number(s.y),dir:Number(s.dir)||0,alive:true,tail:[]});if(c.mode==="territory"||c.mode==="splat")board[Number(s.y)][Number(s.x)]=index;}return{mode:c.mode,size:def.size,boardShape:def.shape,boardSizeKey:def.sizeKey,mask:def.mask,playableCount:def.playableCount,board,agents,holes:new Set(),effects:[]};}
'''
app = replace_once(app, old_test_helpers, new_test_helpers, "test helpers")
old_update = 'function updateTestBenchUI(){const c=effectiveTestConfig(),def=resolvedTestBoard(c),selected=selectedFixedSpawn(c),fixed=c.spawnMode==="fixed";$$\'[data-test-mode]\'.forEach(b=>b.classList.toggle(\'is-selected\',b.dataset.testMode===c.mode));$("#testNpcEnabled").checked=c.npc;$("#testNpcType").value=c.npcType;'
# Handle literal source text without escaping mistakes using a smaller replacement.
app = replace_once(app, '$("#testNpcEnabled").checked=c.npc;$("#testNpcType").value=c.npcType;', '$("#testNpcCount").value=String(c.npcCount);$("#testNpcType").value=c.npcType;', "test count control")
app = replace_once(app, '$("#testNpcTypeRow").classList.toggle("is-hidden",!c.npc);$("#testSpawnActorRow").classList.toggle("is-hidden",!(fixed&&c.npc));', '$("#testNpcTypeRow").classList.toggle("is-hidden",c.npcCount===0);$("#testSpawnActorRow").classList.toggle("is-hidden",!(fixed&&c.npcCount>0));const actor=$("#testSpawnActor"),keys=fixedSpawnKeys(c);if(!keys.includes(state.testSpawnActor))state.testSpawnActor="me";actor.innerHTML="";for(const key of keys)actor.add(new Option(key==="me"?"あなた":`NPC${key.slice(3)}`,key));actor.value=selected.key;', "actor UI")
app = replace_once(app, '`${selected.key==="npc"?"NPC":"あなた"}の開始マスを盤面上で指定してください。`:`${selected.key==="npc"?"NPC":"あなた"}：(${selected.spawn.x}, ${selected.spawn.y}) ・ 盤面タップで変更`', '`${selected.key==="me"?"あなた":`NPC${selected.key.slice(3)}`}の開始マスを盤面上で指定してください。`:`${selected.key==="me"?"あなた":`NPC${selected.key.slice(3)}`}：(${selected.spawn.x}, ${selected.spawn.y}) ・ 盤面タップで変更`', "spawn hint")
app = replace_once(app, '${c.npc?"NPC "+testNpcLabel(c.npcType):"NPCなし"}', '${c.npcCount?`NPC ${c.npcCount}体・${testNpcLabel(c.npcType)}`:"NPCなし"}', "test summary")
app = replace_once(app, 'const def=resolvedTestBoard(c),program=deepClone(state.draft.blocks),players=[{id:"me",name:"あなた",color:"blue",program}];if(c.npc)players.push({id:"test-npc",name:`NPC・${testNpcLabel(c.npcType)}`,color:"red",program:makeTestNpcProgram(c.mode,c.npcType,0)});', 'const def=resolvedTestBoard(c),program=deepClone(state.draft.blocks),players=[{id:"me",name:"あなた",color:PLAYER_COLORS[0],program}];for(let i=0;i<c.npcCount;i++)players.push({id:`test-npc-${i+1}`,name:`NPC${i+1}・${testNpcLabel(c.npcType)}`,color:PLAYER_COLORS[i+1],program:makeTestNpcProgram(c.mode,c.npcType,i)});', "run test npcs")
app = replace_once(app, '${c.npc?testNpcLabel(c.npcType):"NPCなし"}', '${c.npcCount?`NPC ${c.npcCount}体・${testNpcLabel(c.npcType)}`:"NPCなし"}', "run status")
app = replace_once(app, '$("#testNpcEnabled").onchange=e=>{state.testNpcEnabled=e.target.checked;if(!state.testNpcEnabled)state.testSpawnActor="me";updateTestBenchUI()};', '$("#testNpcCount").onchange=e=>{state.testNpcCount=Math.max(0,Math.min(3,Number(e.target.value)||0));if(!fixedSpawnKeys(effectiveTestConfig()).includes(state.testSpawnActor))state.testSpawnActor="me";invalidateTestFixedSpawns();updateTestBenchUI()};', "test count bind")
app = replace_once(app, 'const key=state.testNpcEnabled&&state.testSpawnActor==="npc"?"npc":"me";state.testFixedSpawns[key].dir=Number(e.target.value);', 'const c=effectiveTestConfig(),key=fixedSpawnKeys(c).includes(state.testSpawnActor)?state.testSpawnActor:"me";state.testFixedSpawns[key].dir=Number(e.target.value);', "direction actor")
app = replace_once(app, 'const key=state.testNpcEnabled&&state.testSpawnActor==="npc"?"npc":"me",other=key==="me"?"npc":"me";if(state.testNpcEnabled&&state.testFixedSpawns[other]?.x===x&&state.testFixedSpawns[other]?.y===y)return toast("同じマスには配置できません");state.testFixedSpawns[key].x=x;state.testFixedSpawns[key].y=y;updateTestBenchUI();toast(`${key==="npc"?"NPC":"あなた"}の開始位置：${x}, ${y}`)', 'const keys=fixedSpawnKeys(c),key=keys.includes(state.testSpawnActor)?state.testSpawnActor:"me";if(keys.some(other=>other!==key&&state.testFixedSpawns[other]?.x===x&&state.testFixedSpawns[other]?.y===y))return toast("同じマスには配置できません");state.testFixedSpawns[key].x=x;state.testFixedSpawns[key].y=y;updateTestBenchUI();toast(`${key==="me"?"あなた":`NPC${key.slice(3)}`}の開始位置：${x}, ${y}`)', "board click actor")
app_path.write_text(app)

# HTML palette + test controls.
html_path = Path("public/now-coding/index.html")
html = html_path.read_text()
html = replace_once(
    html,
    '<button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="enemyDistance">最も近い敵との距離</button>\n                  <button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="timer">タイマー</button>',
    '<button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="enemyDistance">最も近い敵との距離</button>\n                  <button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="enemyCount">敵の数</button>\n                  <button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="timer">タイマー</button>',
    "enemy count palette",
)
html = replace_once(
    html,
    '<label class="test-toggle-row"><input id="testNpcEnabled" type="checkbox" /><span>動くNPCを出す</span></label>\n              <label id="testNpcTypeRow" class="test-setting-field is-hidden"><span>NPCの動き方</span>',
    '<label class="test-setting-field"><span>NPCの数</span><select id="testNpcCount"><option value="0" selected>なし</option><option value="1">1体</option><option value="2">2体</option><option value="3">3体</option></select></label>\n              <label id="testNpcTypeRow" class="test-setting-field is-hidden"><span>NPCの動き方</span>',
    "npc count html",
)
html = replace_once(
    html,
    '<select id="testSpawnActor"><option value="me">あなた</option><option value="npc">NPC</option></select>',
    '<select id="testSpawnActor"><option value="me">あなた</option></select>',
    "spawn actor html",
)
html_path.write_text(html)

# Tutorials: explain the new observation value and multi-NPC test bench.
tut_path = Path("public/now-coding/tutorials.js")
tut = tut_path.read_text()
tut = replace_once(
    tut,
    '敵との距離だけは直接読める", text: "『最も近い敵との距離』は、生きている敵の頭までのマンハッタン距離です。敵がいなければ -1。インク量や尾の長さなどは専用値に頼らず、必要なら自分の変数とコードで管理します。", focus: \'[data-expression-preset="enemyDistance"]\' },',
    '敵の数と距離を観測できる", text: "『敵の数』は現在生きている自分以外の駒の数です。『最も近い敵との距離』は、生きている敵の頭までのマンハッタン距離で、敵がいなければ -1。人数と距離を組み合わせれば、配置や盤面について自分のコードで推測する材料にもできます。インク量や尾の長さなどは専用値に頼らず、必要なら自分の変数とコードで管理します。", focus: \'[data-expression-preset="enemyCount"]\' },',
    "variables tutorial enemy count",
)
tut = replace_once(
    tut,
    '動きが安定したらテスト設定を開き、『動くNPCを出す』をONにしてみましょう。探索型や初級・中級など、相手の動き方を変えて弱点を探せます。',
    '動きが安定したらテスト設定を開き、NPCを1〜3体追加してみましょう。探索型や初級・中級など、相手の動き方と人数を変えて弱点を探せます。',
    "territory tutorial npc count",
)
tut_path.write_text(tut)

# Engine tests.
engine_test_path = Path("tools/now-coding/engine.test.mjs")
engine_test = engine_test_path.read_text()
anchor = 'test("nearest enemy distance is available as a numeric builtin and uses -1 when none survive", () => {'
idx = engine_test.find(anchor)
if idx < 0:
    raise SystemExit("missing pattern: engine enemy distance test")
insert = '''test("enemy count reports only currently living opponents", () => {\n  const state = createTerritoryState({\n    seed: "enemy-count", size: 15, maxTicks: 40,\n    players: [\n      { id: "a", program: [right] },\n      { id: "b", program: [right] },\n      { id: "c", program: [right] },\n    ],\n    spawns: [{ x: 2, y: 2, dir: 1 }, { x: 12, y: 2, dir: 3 }, { x: 7, y: 12, dir: 0 }],\n  });\n  const context = { state, agent: state.agents[0], sense: () => ({ state: "unclaimed", owner: -1 }) };\n  assert.equal(evaluateVmExpression({ type: "builtin", name: "enemyCount" }, context), 2);\n  state.agents[2].alive = false;\n  assert.equal(evaluateVmExpression({ type: "builtin", name: "enemyCount" }, context), 1);\n  state.agents[1].alive = false;\n  assert.equal(evaluateVmExpression({ type: "builtin", name: "enemyCount" }, context), 0);\n});\n\n'''
engine_test = engine_test[:idx] + insert + engine_test[idx:]
engine_test_path.write_text(engine_test)

# Client contract tests.
client_test_path = Path("tools/now-coding/client-contract.test.mjs")
client_test = client_test_path.read_text()
client_test = replace_once(
    client_test,
    '["compare","logic","not","sensor","cellState","enemyDistance","number","var","random","math"]',
    '["compare","logic","not","sensor","cellState","enemyDistance","enemyCount","number","var","random","math"]',
    "palette contract list",
)
append = '''\n\ntest("enemy count and multi-NPC test bench are exposed consistently", () => {\n  assert.ok(html.includes('data-expression-preset="enemyCount"'));\n  assert.ok(htmlHasId("testNpcCount"));\n  assert.doesNotMatch(html, /id="testNpcEnabled"/);\n  for (const count of ["0","1","2","3"]) assert.ok(html.includes(`<option value="${count}"`));\n  assert.match(app, /testNpcCount: 0/);\n  assert.match(app, /function testNpcKeys\(c\)/);\n  assert.match(app, /for\(let i=0;i<c\.npcCount;i\+\+\)players\.push/);\n  assert.match(app, /data-expression-preset=\\"enemyCount\\"|expr:enemyCount/);\n});\n'''
client_test += append
client_test_path.write_text(client_test)
