from pathlib import Path

ROOT = Path('.')


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'missing {label}')
    return text.replace(old, new, 1)


def replace_between(text, start, end, new, label):
    i = text.find(start)
    if i < 0:
        raise RuntimeError(f'missing start {label}')
    j = text.find(end, i + len(start))
    if j < 0:
        raise RuntimeError(f'missing end {label}')
    return text[:i] + new + text[j:]

# ---------------------------------------------------------------------------
# HTML palette
# ---------------------------------------------------------------------------
index_path = ROOT / 'public/now-coding/index.html'
html = index_path.read_text()
html = replace_once(html, '  <link rel="stylesheet" href="./style-v5.css" />', '  <link rel="stylesheet" href="./style-v5.css" />\n  <link rel="stylesheet" href="./style-v6.css" />', 'style-v6 link')
html = replace_once(
    html,
    '                  <button class="palette-block action-turn" type="button" data-add-block="turn">旋回</button>',
    '''                  <div class="palette-block action-turn palette-configurable" data-add-block="turn" role="button" tabindex="0"><span>旋回</span><select data-palette-option="turn" aria-label="旋回方向"><option value="turnLeft">左</option><option value="turnRight" selected>右</option></select></div>''',
    'turn palette',
)
palette_start = '''              <details class="palette-section" open>\n                <summary><span class="palette-dot condition"></span>判断</summary>'''
palette_end = '''              <details class="palette-section">\n                <summary><span class="palette-dot variable"></span>変数</summary>'''
new_palette = '''              <details class="palette-section" open>
                <summary><span class="palette-dot condition"></span>判断</summary>
                <div class="palette-items">
                  <button class="palette-block logic-block" type="button" data-add-block="if">もし ○○ なら</button>
                  <div class="palette-block reporter-block reporter-boolean palette-expression-template" data-expression-preset="compare" role="button" tabindex="0"><span>＜（ ）</span><select data-palette-option="compareOp" aria-label="比較演算子"><option value="==" selected>＝</option><option value="!=">≠</option><option value="<">＜</option><option value=">">＞</option><option value="<=">≦</option><option value=">=">≧</option></select><span>（ ）＞</span></div>
                  <div class="palette-block reporter-block reporter-boolean palette-expression-template" data-expression-preset="logic" role="button" tabindex="0"><span>＜（条件）</span><select data-palette-option="logicOp" aria-label="論理演算子"><option value="and" selected>かつ</option><option value="or">または</option></select><span>（条件）＞</span></div>
                  <div class="palette-block reporter-block reporter-boolean palette-expression-template" data-expression-preset="not" role="button" tabindex="0"><span>＜（条件）ではない＞</span></div>
                </div>
              </details>
              <details class="palette-section" open>
                <summary><span class="palette-dot number"></span>値・計算</summary>
                <div class="palette-items">
                  <div class="palette-block reporter-block reporter-value palette-expression-template" data-expression-preset="sensor" role="button" tabindex="0"><span>（</span><select data-palette-option="sensorDirection" aria-label="見る方向"><option value="front" selected>前</option><option value="left">左</option><option value="right">右</option></select><span>）</span></div>
                  <div class="palette-block reporter-block reporter-value palette-expression-template" data-expression-preset="cellState" role="button" tabindex="0"><span>（</span><select data-palette-option="cellState" aria-label="マスの状態"><option value="unclaimed">空白</option><option value="own">自分の色</option><option value="enemy">敵の色</option><option value="cliff" selected>崖</option><option value="player">駒</option><option value="tail">尾</option></select><span>）</span></div>
                  <button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="enemyDistance">最も近い敵との距離</button>
                  <button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="number">数字</button>
                  <button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="var">変数の値</button>
                  <button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="random">乱数（○○～○○）</button>
                  <div class="palette-block reporter-block reporter-number palette-expression-template" data-expression-preset="math" role="button" tabindex="0"><span>（（ ）</span><select data-palette-option="mathOp" aria-label="算術演算子"><option value="+" selected>＋</option><option value="-">－</option><option value="*">×</option><option value="/">÷</option><option value="%">％</option></select><span>（ ））</span></div>
                </div>
              </details>
'''
html = replace_between(html, palette_start, palette_end, new_palette, 'judgement/value palette')
index_path.write_text(html)

# ---------------------------------------------------------------------------
# Client controller
# ---------------------------------------------------------------------------
app_path = ROOT / 'public/now-coding/app-v3.js'
app = app_path.read_text()
app = replace_once(app, 'const CELL_LABELS = { unclaimed: "未取得／空き", own: "自分の色", enemy: "敵の色", cliff: "崖", player: "駒", tail: "尾" };', 'const CELL_LABELS = { unclaimed: "空白", own: "自分の色", enemy: "敵の色", cliff: "崖", player: "駒", tail: "尾" };', 'cell labels')
app = replace_once(
    app,
    '  drag: null, suppressClickUntil: 0, optionalTutorial: null, tutorialFinalPassed: false, tutorialModalKey: "", pendingExpressionPreset: "", testMode: "territory", testNpcEnabled: false, testNpcType: "intermediate", testSpawnMode: "random", testSpawn: {x:4,y:7,dir:1}, testGame: null,\n};',
    '  drag: null, suppressClickUntil: 0, optionalTutorial: null, tutorialFinalPassed: false, tutorialModalKey: "", pendingExpressionPreset: "", testMode: "territory", testNpcEnabled: false, testNpcType: "intermediate", testSpawnMode: "random", testSpawn: {x:4,y:7,dir:1}, testGame: null,\n  paletteConfig: { turn: "turnRight", sensorDirection: "front", cellState: "cliff", compareOp: "==", logicOp: "and", mathOp: "+" },\n};',
    'palette config',
)

new_tutorial_core = r'''const TUTORIAL_STEPS=[
 ["コードを組んで、1位を目指せ。","自分で組んだコードが駒の頭脳になります。最初は『進む』だけから始め、最後には『前が崖なら旋回する』という判断を、部品を1つずつ組んで作ります。","始める"],
 ["まず『進む』を置く","今は『進む』だけを使います。ほかの命令は一時的に操作できません。『進む』を1つ追加してください。",""],
 ["1マスだけ進むことを確認","次はテスト実行だけを使います。『進む』しかないので、駒は1マス進んだところで停止します。",""],
 ["繰り返すには『ずっと』","『ずっと』を追加したら、いま置いた『進む』をその内側へドラッグしてください。",""],
 ["今度は止まらない","テスト実行してください。『ずっと』の中に『進む』があるので、まっすぐ進み続けて崖から落ちます。",""],
 ["まず『もし』を置く","『もし ○○ なら』を追加します。○○はまだ空欄のままです。ここへ自分で条件を組み立てていきます。",""],
 ["条件の器を入れる","判断から『＜（ ）＝（ ）＞』を選び、『もし』の空欄へ入れてください。左右はまだ空欄で大丈夫です。",""],
 ["左側に『前』を入れる","値・計算の『（前）』を選び、比較の左側の空欄へ入れます。これは『前のマスが何か』を読む値です。",""],
 ["右側に『崖』を入れる","次に『（崖）』を選び、比較の右側へ入れます。これで『＜（前）＝（崖）＞』が完成します。",""],
 ["崖なら旋回する","『旋回』を追加します。『もし』の『なら』側へ自動で入り、前が崖の時だけ向きを変えるようになります。",""],
 ["完成したコードを試す","もう一度テストし、崖を判断しながら30tick以上走り続けられることを確認します。",""],
];
function tutorialStructure(){
  const foreverIndex=state.draft.blocks.findIndex(b=>b.type==="forever");
  const forever=foreverIndex>=0?state.draft.blocks[foreverIndex]:null;
  const body=forever?.body||[];
  const moveIndex=body.findIndex(x=>x.type==="action"&&x.action==="move");
  const ifIndex=body.findIndex(x=>x.type==="if");
  const ifBlock=ifIndex>=0?body[ifIndex]:null;
  return{foreverIndex,forever,body,moveIndex,ifIndex,ifBlock,condition:ifBlock?.condition||null};
}
function tutorialFocusInfo(){
  const s=Number(state.profile?.tutorialStep||0),base=TUTORIAL_STEPS[Math.min(s,TUTORIAL_STEPS.length-1)];
  if(s===0)return{key:"0",title:base[0],text:base[1],selectors:["#tutorialNextButton"],scroll:"#tutorialCoach"};
  if(s===10&&state.tutorialFinalPassed)return{key:"10:save",title:"テスト成功。最後に保存",text:"崖を判断して30tick以上走り続けられました。『保存』を押して最初の駒を完成させてください。",selectors:["#saveProgramButton"],scroll:"#saveProgramButton"};
  if(s===3){
    const t=tutorialStructure();
    if(t.forever&&t.moveIndex<0)return{key:"3:nest",title:"『進む』を『ずっと』の中へ",text:"紫の『ずっと』を用意できました。コード欄の『進む』を押したまま、紫の内側の『ここに命令を入れる』へ移動してください。",selectors:['.typed-block[data-action="move"]',`.code-sequence[data-sequence="${t.foreverIndex}:body"]`],scroll:'.typed-block[data-action="move"]'};
  }
  const targets={
    1:['[data-add-block="move"]'],2:['#runTestButton'],3:['[data-add-block="forever"]'],4:['#runTestButton'],5:['[data-add-block="if"]'],
    6:['[data-expression-preset="compare"]','.typed-block[data-block-type="if"] .expr-condition-root'],
    7:['[data-expression-preset="sensor"]','.typed-block[data-block-type="if"] .expr-left'],
    8:['[data-expression-preset="cellState"]','.typed-block[data-block-type="if"] .expr-right'],
    9:['[data-add-block="turn"]'],10:['#runTestButton']
  };
  const selectors=targets[s]||[];return{key:String(s),title:base[0],text:base[1],selectors,scroll:selectors[0]||null};
}
'''
app = replace_between(app, 'const TUTORIAL_STEPS=[', 'async function tutorialProgress', new_tutorial_core, 'initial tutorial core')

new_tutorial_render = r'''function renderTutorial(){const c=$("#tutorialCoach");if(!c)return;if(!isTutorial()||state.view!=="editor"){c.classList.add("is-hidden");clearTutorialTargets();document.querySelectorAll(".tutorial-step-modal").forEach(n=>n.remove());return;}const s=Number(state.profile?.tutorialStep||0),info=tutorialFocusInfo(),item=TUTORIAL_STEPS[Math.min(s,TUTORIAL_STEPS.length-1)];$("#tutorialStepLabel").textContent=`${Math.min(s+1,TUTORIAL_STEPS.length)} / ${TUTORIAL_STEPS.length}`;$("#tutorialTitle").textContent=info.title||item[0];$("#tutorialText").textContent=info.text||item[1];$("#tutorialIntroDemo")?.classList.toggle("is-hidden",s!==0);const next=$("#tutorialNextButton");next.textContent=item[2]||"次の操作をしてください";next.classList.toggle("is-hidden",s!==0);next.disabled=s!==0;c.classList.remove("is-hidden");updateTutorialTargets();requestAnimationFrame(maybeShowTutorialStepModal);}
function clearTutorialTargets(){$$(".tutorial-target,.tutorial-disabled").forEach(n=>n.classList.remove("tutorial-target","tutorial-disabled"));}
function updateTutorialTargets(){clearTutorialTargets();if(!isTutorial()||state.view!=="editor")return;const info=tutorialFocusInfo();$$('#view-editor button, #view-editor select, #view-editor input, #view-editor [data-expression-preset], #view-editor [data-add-block]').forEach(n=>n.classList.add("tutorial-disabled"));for(const sel of info.selectors||[])$$(sel).forEach(n=>{n.classList.remove("tutorial-disabled");n.classList.add("tutorial-target");if(n.matches('[data-expression-preset],[data-add-block]'))n.querySelectorAll('select,input').forEach(c=>c.classList.add('tutorial-disabled'));});}
function maybeShowTutorialStepModal(){
  if(!isTutorial()||state.view!=="editor")return;const s=Number(state.profile?.tutorialStep||0);if(s===0)return;const info=tutorialFocusInfo();if(!info||state.tutorialModalKey===info.key||document.querySelector(".tutorial-step-modal"))return;state.tutorialModalKey=info.key;
  const total=TUTORIAL_STEPS.length,overlay=document.createElement("div");overlay.className="tutorial-step-modal";overlay.innerHTML=`<div class="tutorial-step-card" role="dialog" aria-modal="true" aria-labelledby="tutorialModalTitle"><small>STEP ${Math.min(s+1,total)} / ${total}</small><h2 id="tutorialModalTitle">${esc(info.title)}</h2><p>${esc(info.text)}</p><button class="primary-button" type="button">この操作をやってみる</button></div>`;
  overlay.querySelector("button").onclick=()=>{overlay.remove();setTimeout(()=>{const target=info.scroll?$(info.scroll):null;target?.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});},60)};document.body.append(overlay);
}
function tutorialRouteInsertion(path,index,block){
  if(!isTutorial())return{path,index};const s=Number(state.profile?.tutorialStep||0),t=tutorialStructure();
  if(s===5&&block.type==="if"&&t.foreverIndex>=0)return{path:[{index:t.foreverIndex,branch:"body"}],index:Math.max(0,t.moveIndex)};
  if(s===9&&block.type==="action"&&["turnLeft","turnRight"].includes(block.action)&&t.foreverIndex>=0&&t.ifIndex>=0)return{path:[{index:t.foreverIndex,branch:"body"},{index:t.ifIndex,branch:"then"}],index:0};
  return{path,index};
}

'''
app = replace_between(app, 'function renderTutorial(){', 'function newDraft(){', new_tutorial_render, 'tutorial render/route')

new_create_blocks = r'''function createBlock(type){
 const p=state.paletteConfig||{};
 if(type==="move")return{type:"action",action:"move"};
 if(type==="turn")return{type:"action",action:p.turn||"turnRight",uiKind:"turn"};
 if(type==="attack")return{type:"action",action:"attack",uiKind:"attack",range:lit(3)};
 if(type==="if")return{type:"if",condition:null,then:[],else:[]};
 if(type==="forever")return{type:"forever",body:[]};
 if(type==="while")return{type:"while",condition:null,body:[]};
 if(type==="repeat")return{type:"repeat",times:lit(3),body:[]};
 if(type==="break")return{type:"break"};
 if(type==="setVar")return{type:"set",name:"value",value:lit(0)};
 if(type==="changeVar")return{type:"change",name:"value",value:lit(1)};
 return{type:"action",action:"move"};
}

'''
app = replace_between(app, 'function defaultCondition(){', 'function seqByPath(path)', new_create_blocks, 'block defaults')

new_expression_system = r'''function literalLabel(value){if(Object.prototype.hasOwnProperty.call(CELL_LABELS,value))return CELL_LABELS[value];if(value===true)return"真";if(value===false)return"偽";return String(value);}
function exprSummary(expr){if(expr===null||expr===undefined)return"○○";if(expr.type==="literal")return literalLabel(expr.value);if(expr.type==="var")return `変数 ${expr.name||"value"}`;if(expr.type==="builtin")return expr.name==="enemyDistance"?"最も近い敵との距離":"値";if(expr.type==="sensor")return DIR_LABELS[expr.direction]||"前";if(expr.type==="random")return `乱数 ${exprSummary(expr.min)}〜${exprSummary(expr.max)}`;if(expr.type==="not")return `${exprSummary(expr.value)} ではない`;if(expr.type==="binary")return `${exprSummary(expr.left)} ${COMPARE[expr.op]||MATH[expr.op]||({and:"かつ",or:"または"})[expr.op]||expr.op} ${exprSummary(expr.right)}`;return"値";}
function exprKind(expr){if(expr===null||expr===undefined)return"empty";if(expr.type==="sensor")return"value";if(expr.type==="literal"&&typeof expr.value==="string"&&Object.prototype.hasOwnProperty.call(CELL_LABELS,expr.value))return"value";if(expr.type==="binary"&&(["and","or"].includes(expr.op)||Object.prototype.hasOwnProperty.call(COMPARE,expr.op)))return"boolean";if(expr.type==="not")return"boolean";return"number";}
function presetKind(key){if(["compare","logic","not"].includes(key))return"boolean";if(["sensor","cellState"].includes(key))return"value";return"number";}
function acceptsExpression(expected,actual){if(expected==="boolean")return actual==="boolean";if(expected==="number")return actual==="number";if(expected==="value")return actual==="value"||actual==="number";return false;}
function createExpressionPreset(key){const p=state.paletteConfig||{};if(key==="compare")return binary(p.compareOp||"==",null,null);if(key==="logic")return binary(p.logicOp||"and",null,null);if(key==="not")return{type:"not",value:null};if(key==="sensor")return sensor(p.sensorDirection||"front");if(key==="cellState")return lit(p.cellState||"cliff");if(key==="enemyDistance")return builtin("enemyDistance");if(key==="var")return{type:"var",name:"value"};if(key==="random")return{type:"random",min:null,max:null};if(key==="math")return binary(p.mathOp||"+",null,null);return lit(0);}
function clearExpressionPreset(){state.pendingExpressionPreset="";$$('.expression-preset-active').forEach(n=>n.classList.remove('expression-preset-active'));$$('.socket-accepting').forEach(n=>n.classList.remove('socket-accepting'));}
function updateExpressionTargets(){if(!state.pendingExpressionPreset)return;const actual=presetKind(state.pendingExpressionPreset);$$('.expression-target').forEach(n=>n.classList.toggle('socket-accepting',acceptsExpression(n.dataset.expected,actual)));$$('[data-expression-preset]').forEach(n=>n.classList.toggle('expression-preset-active',n.dataset.expressionPreset===state.pendingExpressionPreset));}
function applyExpressionPreset(key,expected,onChange){const actual=presetKind(key);if(!acceptsExpression(expected,actual)){toast(expected==="boolean"?"この枠には条件を入れます":expected==="number"?"この枠には数値を入れます":"この枠には値または数値を入れます");return false;}onChange(createExpressionPreset(key));clearExpressionPreset();renderWorkspace();checkTutorialStructure();renderTutorial();return true;}
function wireExpressionTarget(node,expected,onChange){node.classList.add("expression-target");node.dataset.expected=expected;node.addEventListener("dragover",e=>{if(e.dataTransfer.types.includes("application/x-now-expression")&&acceptsExpression(expected,presetKind(e.dataTransfer.getData("application/x-now-expression")||"")))e.preventDefault()});node.addEventListener("drop",e=>{const key=e.dataTransfer.getData("application/x-now-expression");if(key){e.preventDefault();e.stopPropagation();applyExpressionPreset(key,expected,onChange)}});node.addEventListener("click",e=>{if(!state.pendingExpressionPreset)return;if(e.target.closest("select,input")&&e.target!==node)return;e.preventDefault();e.stopPropagation();applyExpressionPreset(state.pendingExpressionPreset,expected,onChange)});return node;}
function emptyExpressionSlot(expected,onChange,slotClass=""){const b=document.createElement("button");b.type="button";b.className=`typed-socket socket-${expected} expression-empty ${slotClass}`.trim();b.textContent="○○";b.title="命令パレットから部品を選んで、この空欄へ入れます";wireExpressionTarget(b,expected,onChange);b.addEventListener("click",e=>{if(state.pendingExpressionPreset)return;e.preventDefault();e.stopPropagation();toast("命令パレットから入れたい部品を選んでください")});return b;}
function select(options,value,onChange,klass="typed-select"){const s=document.createElement("select");s.className=klass;for(const [v,l] of options)s.add(new Option(l,v,false,v===value));s.addEventListener("change",()=>onChange(s.value));return s;}
function commitExpression(onChange,expr,rerender=true){onChange(expr);checkTutorialStructure();renderTutorial();if(rerender)renderWorkspace();}
function expressionControl(expr,expected,onChange,slotClass=""){
 if(expr===null||expr===undefined)return emptyExpressionSlot(expected,onChange,slotClass);
 const kind=exprKind(expr),node=document.createElement("span");node.className=`expression-node expression-${kind} ${slotClass}`.trim();
 const change=(next,rerender=true)=>commitExpression(onChange,next,rerender);
 if(expr.type==="binary"&&Object.prototype.hasOwnProperty.call(COMPARE,expr.op)){
   node.classList.add("expr-compare");node.append(document.createTextNode("＜"),expressionControl(expr.left,"value",v=>{expr.left=v;change(expr)},"expr-left"),select(Object.entries(COMPARE),expr.op,v=>{expr.op=v;change(expr)},"typed-select socket-operator"),expressionControl(expr.right,"value",v=>{expr.right=v;change(expr)},"expr-right"),document.createTextNode("＞"));
 }else if(expr.type==="binary"&&["and","or"].includes(expr.op)){
   node.classList.add("expr-logic");node.append(document.createTextNode("＜"),expressionControl(expr.left,"boolean",v=>{expr.left=v;change(expr)},"expr-left"),select([["and","かつ"],["or","または"]],expr.op,v=>{expr.op=v;change(expr)},"typed-select socket-operator"),expressionControl(expr.right,"boolean",v=>{expr.right=v;change(expr)},"expr-right"),document.createTextNode("＞"));
 }else if(expr.type==="not"){
   node.classList.add("expr-not");node.append(document.createTextNode("＜"),expressionControl(expr.value,"boolean",v=>{expr.value=v;change(expr)},"expr-inner"),document.createTextNode(" ではない＞"));
 }else if(expr.type==="binary"&&Object.prototype.hasOwnProperty.call(MATH,expr.op)){
   node.classList.add("expr-math");node.append(document.createTextNode("（"),expressionControl(expr.left,"number",v=>{expr.left=v;change(expr)},"expr-left"),select(Object.entries(MATH),expr.op,v=>{expr.op=v;change(expr)},"typed-select socket-operator"),expressionControl(expr.right,"number",v=>{expr.right=v;change(expr)},"expr-right"),document.createTextNode("）"));
 }else if(expr.type==="sensor"){
   node.classList.add("expr-sensor");node.append(document.createTextNode("（"),select(Object.entries(DIR_LABELS),expr.direction||"front",v=>{expr.direction=v;change(expr)},"typed-select socket-enum"),document.createTextNode("）"));
 }else if(expr.type==="literal"&&typeof expr.value==="string"&&Object.prototype.hasOwnProperty.call(CELL_LABELS,expr.value)){
   node.classList.add("expr-cell-state");node.append(document.createTextNode("（"),select(Object.entries(CELL_LABELS),expr.value,v=>{expr.value=v;change(expr)},"typed-select socket-enum"),document.createTextNode("）"));
 }else if(expr.type==="literal"){
   const i=document.createElement("input");i.type="number";i.className="typed-input socket-number expression-number-input";i.value=Number(expr.value)||0;i.addEventListener("input",()=>{expr.value=Number(i.value)||0;change(expr,false)});node.append(document.createTextNode("（"),i,document.createTextNode("）"));
 }else if(expr.type==="var"){
   const i=document.createElement("input");i.className="typed-input socket-variable expression-var-input";i.value=expr.name||"value";i.maxLength=40;i.addEventListener("input",()=>{expr.name=i.value.slice(0,40);change(expr,false)});node.append(document.createTextNode("（変数 "),i,document.createTextNode("）"));
 }else if(expr.type==="builtin"&&expr.name==="enemyDistance"){
   node.classList.add("expr-enemy-distance");node.textContent="（最も近い敵との距離）";
 }else if(expr.type==="random"){
   node.classList.add("expr-random");node.append(document.createTextNode("（乱数 "),expressionControl(expr.min,"number",v=>{expr.min=v;change(expr)},"expr-left"),document.createTextNode(" ～ "),expressionControl(expr.max,"number",v=>{expr.max=v;change(expr)},"expr-right"),document.createTextNode("）"));
 }else{
   node.textContent=`（${exprSummary(expr)}）`;
 }
 return wireExpressionTarget(node,expected,onChange);
}

'''
app = replace_between(app, 'function literalLabel(value)', 'function renderWorkspace(){', new_expression_system, 'direct expression system')

# Render direct expression controls instead of modal sockets.
app = app.replace('socketButton(', 'expressionControl(')
app = replace_once(app, 'else if(block.type==="if"){head.append(strong("もし "),expressionControl(block.condition||defaultCondition(),"boolean",v=>block.condition=v),strong(" なら"));', 'else if(block.type==="if"){head.append(strong("もし "),expressionControl(block.condition??null,"boolean",v=>block.condition=v,"expr-condition-root"),strong(" なら"));', 'if condition render')
app = replace_once(app, 'else if(block.type==="while"){head.append(expressionControl(block.condition||defaultCondition(),"boolean",v=>block.condition=v),strong(" ならずっと"));', 'else if(block.type==="while"){head.append(expressionControl(block.condition??null,"boolean",v=>block.condition=v,"expr-condition-root"),strong(" ならずっと"));', 'while condition render')

new_tutorial_progress_bindings = r'''function onTutorialAdd(block){
  if(!isTutorial())return;
  const s=Number(state.profile?.tutorialStep||0);
  if(s===1&&block.type==="action"&&block.action==="move"){tutorialProgress(2);return;}
  checkTutorialStructure();renderTutorial();
}
function isFrontCliffCondition(expr){return expr?.type==="binary"&&expr.op==="=="&&expr.left?.type==="sensor"&&expr.left.direction==="front"&&expr.right?.type==="literal"&&expr.right.value==="cliff";}
function checkTutorialStructure(){
  if(!isTutorial())return;
  const s=Number(state.profile?.tutorialStep||0),t=tutorialStructure();
  if(s===3&&t.forever&&t.moveIndex>=0){tutorialProgress(4);return;}
  if(s===5&&t.ifIndex>=0){tutorialProgress(6);return;}
  const c=t.condition;
  if(s===6&&c?.type==="binary"&&Object.prototype.hasOwnProperty.call(COMPARE,c.op)&&c.left==null&&c.right==null){tutorialProgress(7);return;}
  if(s===7&&c?.type==="binary"&&c.left?.type==="sensor"&&c.left.direction==="front"){tutorialProgress(8);return;}
  if(s===8&&isFrontCliffCondition(c)){tutorialProgress(9);return;}
  if(s===9&&t.ifIndex>=0){const hasTurn=(t.ifBlock.then||[]).some(x=>x.type==="action"&&["turnLeft","turnRight"].includes(x.action));const hasMoveAfter=t.body.slice(t.ifIndex+1).some(x=>x.type==="action"&&x.action==="move");if(hasTurn&&hasMoveAfter)tutorialProgress(10);}
}
function bindExpressionPalette(){
  $$('[data-palette-option]').forEach(control=>{const key=control.dataset.paletteOption;if(state.paletteConfig?.[key]!=null)control.value=state.paletteConfig[key];control.addEventListener("click",e=>e.stopPropagation());control.addEventListener("pointerdown",e=>e.stopPropagation());control.addEventListener("change",e=>{if(state.paletteConfig)state.paletteConfig[key]=control.value;e.stopPropagation();});});
  $$('[data-expression-preset]').forEach(block=>{block.draggable=true;const choose=e=>{if(e?.target?.closest?.("select,input")||block.classList.contains("tutorial-disabled"))return;const key=block.dataset.expressionPreset;if(state.pendingExpressionPreset===key){clearExpressionPreset();return;}state.pendingExpressionPreset=key;updateExpressionTargets();toast("入れたい空欄をタップしてください")};block.addEventListener("click",choose);block.addEventListener("keydown",e=>{if(["Enter"," "].includes(e.key)){e.preventDefault();choose(e)}});block.addEventListener("dragstart",e=>{if(e.target.closest?.("select,input")||block.classList.contains("tutorial-disabled")){e.preventDefault();return;}e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("application/x-now-expression",block.dataset.expressionPreset)});});
}
function bindPalette(){$$('[data-add-block]').forEach(button=>{button.draggable=true;button.addEventListener("click",e=>{if(e.target.closest?.("select,input")||Date.now()<state.suppressClickUntil||button.classList.contains("tutorial-disabled"))return;insertBlock([],state.draft.blocks.length,createBlock(button.dataset.addBlock))});button.addEventListener("keydown",e=>{if(["Enter"," "].includes(e.key)&&!e.target.closest?.("select,input")){e.preventDefault();if(!button.classList.contains("tutorial-disabled"))insertBlock([],state.draft.blocks.length,createBlock(button.dataset.addBlock))}});button.addEventListener("dragstart",e=>{if(e.target.closest?.("select,input")||button.classList.contains("tutorial-disabled")){e.preventDefault();return;}e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("application/x-now-palette",button.dataset.addBlock)});button.addEventListener("contextmenu",e=>e.preventDefault());button.addEventListener("pointerdown",startTouchPaletteDrag);});}
'''
app = replace_between(app, 'function onTutorialAdd(block){', 'function startTouchPaletteDrag(event){', new_tutorial_progress_bindings, 'tutorial checks and palette bindings')
app = replace_once(app, 'function startTouchPaletteDrag(event){\n  if(event.pointerType==="mouse"||event.button!==0)return;', 'function startTouchPaletteDrag(event){\n  if(event.target.closest?.("select,input")||event.pointerType==="mouse"||event.button!==0)return;', 'touch configurable guard')
app = app.replace('step===7&&a.alive&&game.tick>=30', 'step===10&&a.alive&&game.tick>=30')
if 'defaultCondition' in app or 'openExpressionEditor' in app or 'inferExpressionEditorType' in app:
    raise RuntimeError('legacy expression modal/default condition remains')
app_path.write_text(app)

# ---------------------------------------------------------------------------
# Optional/replayable tutorials
# ---------------------------------------------------------------------------
tutorials_path = ROOT / 'public/now-coding/tutorials.js'
tuts = tutorials_path.read_text()
tuts = tuts.replace('旋回を置いた後、ブロック内の『左／右』を切り替えます。左旋回と右旋回を別々に探す必要はありません。', '旋回は命令パレットにある時点で『左／右』を選べます。置いた後も同じように切り替えられるので、左旋回と右旋回を別々に探す必要はありません。')
logic_start = '  {\n    id: "logic",'
logic_end = '  {\n    id: "variables",'
logic_block = r'''  {
    id: "logic",
    title: "条件・論理演算",
    summary: "値を比較し、＝・≠・大小比較、かつ／または／ではないを組みます。",
    view: "editor",
    steps: [
      { title: "『もし』は最初は空欄", text: "『もし ○○ なら』を置いても条件は自動では入りません。判断パレットから六角形の条件を選び、自分で○○へ差し込みます。", focus: '[data-add-block="if"]' },
      { title: "比較の器を置く", text: "『＜（ ）＝（ ）＞』は左右の値を比べる条件です。中央は ＝、≠、＜、＞、≦、≧ に切り替えられ、パレット上でも配置後でも変更できます。", focus: '[data-expression-preset="compare"]' },
      { title: "『前』も1つの値", text: "『（前）』は前方のマス状態を読みます。パレットでもコード内でも 前／左／右 を切り替えられます。比較の左側へ入れて使ってみましょう。", focus: '[data-expression-preset="sensor"]' },
      { title: "『崖』も1つの値", text: "『（崖）』はマス状態を表す値です。空白／自分の色／敵の色／崖／駒／尾から選べます。『（前）』と組み合わせれば『＜（前）＝（崖）＞』になります。", focus: '[data-expression-preset="cellState"]' },
      { title: "数字も同じ比較へ入る", text: "比較の左右には数値も入れられます。たとえば『＜（最も近い敵との距離）≦（3）＞』のようにすれば、敵が3マス以内かを判断できます。", focus: '[data-expression-preset="enemyDistance"]' },
      { title: "『かつ』『または』を入れ子にする", text: "条件の六角形の中へ別の六角形を何段でも入れられます。『かつ／または』もパレット上と配置後のどちらでも切り替えられます。", focus: '[data-expression-preset="logic"]' },
      { title: "『ではない』で反転", text: "『＜（条件）ではない＞』は中に入れた条件を反転します。条件を部品として直接組み合わせるので、『条件を組み立てる』モーダルを開く必要はありません。", focus: '[data-expression-preset="not"]' },
    ],
  },
'''
tuts = replace_between(tuts, logic_start, logic_end, logic_block, 'logic tutorial')
variables_start = '  {\n    id: "variables",'
variables_end = '  {\n    id: "loops",'
variables_block = r'''  {
    id: "variables",
    title: "値・変数・演算",
    summary: "数字、変数、敵との距離、乱数、＋－×÷％を直接入れ子にします。",
    view: "editor",
    steps: [
      { title: "数値は丸い部品", text: "数字・変数・最も近い敵との距離・乱数・計算は数値です。回数、攻撃射程、変数代入、計算の左右など、数値の空欄へ直接入れます。", focus: '[data-expression-preset="number"]' },
      { title: "敵との距離だけは直接読める", text: "『最も近い敵との距離』は、生きている敵の頭までのマンハッタン距離です。敵がいなければ -1。インク量や尾の長さなどは専用値に頼らず、必要なら自分の変数とコードで管理します。", focus: '[data-expression-preset="enemyDistance"]' },
      { title: "変数に自分で覚えさせる", text: "『変数を設定』『変数を増減』を使えば、歩数、旋回回数、攻撃回数など、自分に必要な情報を自分のコードで記録できます。", focus: '[data-add-block="setVar"]' },
      { title: "計算の左右も空欄", text: "『（（ ）＋（ ））』の左右へ別の数値を差し込みます。中央は ＋、－、×、÷、％ に切替可能で、パレット上でも配置後でも変更できます。", focus: '[data-expression-preset="math"]' },
      { title: "計算はいくらでも入れ子にできる", text: "計算の左右は数値の空欄なので、その中へさらに計算を入れられます。たとえば『A ＋ B ÷（C－3）』のような式も、括弧の構造をそのままブロックで表現できます。", focus: '[data-expression-preset="math"]' },
      { title: "乱数の範囲も式で決める", text: "乱数の最小値と最大値にも数値ブロックを入れられます。同じSeed・同じコードなら同じ乱数列になるため、対戦結果は再現できます。", focus: '[data-expression-preset="random"]' },
      { title: "数値は比較して条件にする", text: "数値だけでは『もし』の条件になりません。『＜（ ）＝（ ）＞』へ入れて、＝／≠／＜／＞／≦／≧で比較し、六角形の条件にしてから使います。", focus: '[data-expression-preset="compare"]' },
    ],
  },
'''
tuts = replace_between(tuts, variables_start, variables_end, variables_block, 'value tutorial')
tuts = tuts.replace('[data-expression-preset="cell"]', '[data-expression-preset="compare"]')
tuts = tuts.replace('『前 ＝ 敵の色』', '『＜（前）＝（敵の色）＞』').replace('『前 ＝ 未取得／空き』', '『＜（前）＝（空白）＞』').replace('『前 ＝ 崖』', '『＜（前）＝（崖）＞』')
tutorials_path.write_text(tuts)

# ---------------------------------------------------------------------------
# New UI layer
# ---------------------------------------------------------------------------
style_path = ROOT / 'public/now-coding/style-v6.css'
style_path.write_text(r'''/* Now Coding direct composable expression pass */
.palette-configurable,.palette-expression-template{display:flex!important;align-items:center;justify-content:center;gap:4px;min-width:0;cursor:pointer;user-select:none}.palette-configurable select,.palette-expression-template select{min-width:0;max-width:92px;padding:4px 20px 4px 6px;border:1px solid rgba(255,255,255,.16);background:#071019;color:inherit;font:inherit;cursor:pointer}.palette-configurable>span,.palette-expression-template>span{white-space:nowrap}.palette-expression-template.reporter-boolean{padding:7px 13px!important}.palette-expression-template.reporter-number,.palette-expression-template.reporter-value{padding:7px 10px!important}.reporter-value{color:var(--cyan)!important;background:rgba(88,230,246,.09)!important;border-radius:999px!important}.expression-node{display:inline-flex;align-items:center;justify-content:center;gap:4px;max-width:100%;min-height:30px;vertical-align:middle;box-sizing:border-box}.expression-node.expression-boolean{padding:5px 11px;color:var(--type-condition);background:var(--type-condition-bg);clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 50%,calc(100% - 8px) 100%,8px 100%,0 50%)}.expression-node.expression-number{padding:4px 8px;color:var(--type-number);background:var(--type-number-bg);border-radius:999px}.expression-node.expression-value{padding:4px 8px;color:var(--cyan);background:rgba(88,230,246,.09);border-radius:999px}.expression-node>.typed-select{max-width:110px;padding:4px 20px 4px 6px;background:#081017;color:inherit;border:1px solid rgba(255,255,255,.14)}.expression-node .typed-input{min-width:42px;max-width:86px;padding:4px 6px}.expression-var-input{max-width:100px!important}.expression-empty{min-width:48px!important;min-height:28px!important;padding:4px 8px!important;border-style:dashed!important;font-weight:800}.socket-value{color:var(--cyan)!important;border-color:rgba(88,230,246,.48)!important;background:rgba(88,230,246,.07)!important;border-radius:999px!important}.expr-compare,.expr-logic,.expr-not,.expr-math,.expr-random{flex-wrap:wrap}.typed-block .block-head{flex-wrap:wrap;row-gap:6px}.palette-configurable.tutorial-disabled select,.palette-expression-template.tutorial-disabled select{pointer-events:none;opacity:.42}@media(max-width:560px){.palette-configurable,.palette-expression-template{font-size:.66rem!important}.palette-configurable select,.palette-expression-template select{max-width:78px;font-size:.65rem;padding-right:16px}.expression-node{gap:3px;font-size:.7rem}.expression-node.expression-boolean{padding-inline:9px}.expression-node>.typed-select{max-width:88px;font-size:.68rem}.expression-node .typed-input{max-width:70px;font-size:.68rem}}
''')

# ---------------------------------------------------------------------------
# Client contract
# ---------------------------------------------------------------------------
contract_path = ROOT / 'tools/now-coding/client-contract.test.mjs'
contract = contract_path.read_text()
contract = replace_once(contract, 'const css = ["public/now-coding/style-v3.css", "public/now-coding/style-v4.css"].map((p) => fs.readFileSync(p, "utf8")).join("\\n");', 'const css = ["public/now-coding/style-v3.css", "public/now-coding/style-v4.css", "public/now-coding/style-v6.css"].map((p) => fs.readFileSync(p, "utf8")).join("\\n");\nconst tutorials = fs.readFileSync("public/now-coding/tutorials.js", "utf8");', 'contract css/tutorials')
old_palette_test = '''test("language palette exposes nested boolean and numeric reporters", () => {\n  for (const key of ["cell","compare","logic","not","enemyDistance","number","var","random","math"]) {\n    assert.ok(html.includes(`data-expression-preset="${key}"`));\n  }\n  assert.match(app, /最も近い敵との距離/);\n  assert.match(app, /literalLabel/);\n  assert.match(app, /application\\/x-now-expression/);\n});'''
new_palette_test = '''test("language palette exposes directly composable conditions and values", () => {\n  for (const key of ["compare","logic","not","sensor","cellState","enemyDistance","number","var","random","math"]) {\n    assert.ok(html.includes(`data-expression-preset="${key}"`));\n  }\n  for (const key of ["turn","sensorDirection","cellState","compareOp","logicOp","mathOp"]) assert.ok(html.includes(`data-palette-option="${key}"`));\n  assert.doesNotMatch(html, /data-expression-preset="cell"/);\n  assert.match(app, /expressionControl/);\n  assert.match(app, /application\\/x-now-expression/);\n  assert.match(app, /if\(type==="if"\)return\{type:"if",condition:null/);\n  assert.match(app, /if\(type==="while"\)return\{type:"while",condition:null/);\n});'''
contract = replace_once(contract, old_palette_test, new_palette_test, 'palette contract')
contract += r'''

test("expression builder modals and helper builtins are removed from player UI", () => {
  assert.doesNotMatch(app, /openExpressionEditor|inferExpressionEditorType|条件を組み立てる|数値を組み立てる|組み込み値/);
  assert.doesNotMatch(html, /インク|尾の長さ|連続非移動tick|組み込み値/);
  assert.doesNotMatch(tutorials, /組み込み値/);
  assert.match(app, /if\(key==="compare"\)return binary\(p\.compareOp\|\|"==",null,null\)/);
  assert.match(app, /if\(key==="math"\)return binary\(p\.mathOp\|\|"\+",null,null\)/);
  assert.match(css, /\.expression-node\.expression-boolean/);
  assert.match(html, /style-v6\.css/);
});

test("initial tutorial teaches comparison from empty sockets", () => {
  assert.match(app, /『もし ○○ なら』を追加します。○○はまだ空欄/);
  assert.match(app, /data-expression-preset=\\"compare\\"/);
  assert.match(app, /data-expression-preset=\\"sensor\\"/);
  assert.match(app, /data-expression-preset=\\"cellState\\"/);
  assert.match(app, /step===10&&a\.alive&&game\.tick>=30/);
});
'''
contract_path.write_text(contract)

print('composable expression patch applied')
