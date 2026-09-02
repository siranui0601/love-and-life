from pathlib import Path

APP = Path("public/now-coding/app-v3.js")
HTML = Path("public/now-coding/index.html")
STYLE = Path("public/now-coding/style-v7.css")
VM = Path("public/now-coding/vm.js")
TUTORIALS = Path("public/now-coding/tutorials.js")
ENGINE_TEST = Path("tools/now-coding/engine.test.mjs")
CLIENT_TEST = Path("tools/now-coding/client-contract.test.mjs")


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing pattern: {label}")
    return text.replace(old, new, 1)


def replace_between(text, start, end, replacement, label):
    a = text.find(start)
    if a < 0:
        raise SystemExit(f"missing start: {label}")
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f"missing end: {label}")
    return text[:a] + replacement.rstrip() + "\n" + text[b:]


# ---------------------------------------------------------------------------
# VM: timer builtin, mixed string/number +, zero-time speech statement.
# ---------------------------------------------------------------------------
vm = VM.read_text()
vm = replace_once(
    vm,
    '    if (expr.name === "enemyDistance") return nearestEnemyDistance(context.state, context.agent);\n    return 0;',
    '    if (expr.name === "enemyDistance") return nearestEnemyDistance(context.state, context.agent);\n    if (expr.name === "timer") return Math.max(0, Number(context.state?.tick || 0));\n    return 0;',
    "timer builtin",
)
vm = replace_once(
    vm,
    '      case "+": return Number(left) + Number(right);',
    '      case "+": return typeof left === "string" || typeof right === "string" ? `${String(left ?? "")}${String(right ?? "")}` : Number(left) + Number(right);',
    "string concatenation",
)
vm = replace_once(
    vm,
    '      if (statement.type === "set") {',
    '''      if (statement.type === "say") {
        const spoken = evaluateVmExpression(statement.value, context, budget);
        agent.speech = String(spoken ?? "").slice(0, 80);
        continue;
      }

      if (statement.type === "set") {''',
    "speech statement",
)
VM.write_text(vm)


# ---------------------------------------------------------------------------
# App: user terminology, palette metadata, expression type system, editor,
# speech rendering and value-expression structural editing.
# ---------------------------------------------------------------------------
app = APP.read_text()
app = replace_once(
    app,
    '  fall: ["床抜け", "2tick連続で移動しないと足元が崩れます。旋回と前進を組み合わせ、最後まで生き残ります。"],\n  cobra: ["コブラ", "毎tick必ず1マス進みます。尾や他の駒を避け、最後まで生き残った駒が勝ちます。"],',
    '  fall: ["床抜け", "タイマーが2進む間、連続で前進しないと足元が崩れます。旋回と前進を組み合わせ、最後まで生き残ります。"],\n  cobra: ["コブラ", "タイマーが1進むたびに必ず1マス進みます。尾はタイマーが5進むごとに1マス伸びます。尾や他の駒を避け、最後まで生き残った駒が勝ちます。"],',
    "mode timer terminology",
)
app = replace_once(
    app,
    '  "block:move":["進む","action"],"block:turn":["旋回","action"],"block:attack":["攻撃","action"],',
    '  "block:move":["進む","action"],"block:turn":["旋回","action"],"block:attack":["攻撃","action"],"block:say":["○○ と発言","action"],',
    "recent say metadata",
)
app = replace_once(
    app,
    '  "expr:sensor":["（前・左・右）","number"],"expr:cellState":["（マスの状態）","number"],"expr:enemyDistance":["最も近い敵との距離","number"],\n  "expr:number":["数字","number"],"expr:var":["変数の値","number"],"expr:random":["乱数","number"],"expr:math":["計算","number"]',
    '  "expr:sensor":["（前・左・右）","number"],"expr:cellState":["（マスの状態）","number"],"expr:enemyDistance":["最も近い敵との距離","number"],"expr:timer":["タイマー","number"],\n  "expr:number":["数字","number"],"expr:text":["文字","number"],"expr:var":["変数の値","number"],"expr:random":["乱数","number"],"expr:math":["計算","number"]',
    "recent timer text metadata",
)

expression_helpers = r'''function literalLabel(value){if(Object.prototype.hasOwnProperty.call(CELL_LABELS,value))return CELL_LABELS[value];if(value===true)return"真";if(value===false)return"偽";if(typeof value==="string")return `「${value}」`;return String(value);}
function exprSummary(expr){if(expr===null||expr===undefined)return"○○";if(expr.type==="literal")return literalLabel(expr.value);if(expr.type==="var")return `変数 ${expr.name||"value"}`;if(expr.type==="builtin")return expr.name==="enemyDistance"?"最も近い敵との距離":expr.name==="timer"?"タイマー":"値";if(expr.type==="sensor")return DIR_LABELS[expr.direction]||"前";if(expr.type==="random")return `乱数 ${exprSummary(expr.min)}〜${exprSummary(expr.max)}`;if(expr.type==="not")return `${exprSummary(expr.value)} ではない`;if(expr.type==="binary")return `${exprSummary(expr.left)} ${COMPARE[expr.op]||MATH[expr.op]||({and:"かつ",or:"または"})[expr.op]||expr.op} ${exprSummary(expr.right)}`;return"値";}
function staticExpressionKind(expr){if(expr===null||expr===undefined)return"unknown";if(typeof expr!=="object")return typeof expr==="number"?"number":typeof expr==="string"?"text":typeof expr==="boolean"?"boolean":"dynamic";if(expr.type==="literal"){if(typeof expr.value==="number")return"number";if(typeof expr.value==="boolean")return"boolean";if(typeof expr.value==="string")return Object.prototype.hasOwnProperty.call(CELL_LABELS,expr.value)?"state":"text";return"dynamic";}if(expr.type==="var")return"dynamic";if(expr.type==="builtin")return["enemyDistance","timer","ink","tailLength","noMoveTicks"].includes(expr.name)?"number":"dynamic";if(expr.type==="sensor"||expr.type==="sensorProperty")return"state";if(expr.type==="random")return"number";if(expr.type==="not")return"boolean";if(expr.type==="binary"){if(["and","or"].includes(expr.op)||Object.prototype.hasOwnProperty.call(COMPARE,expr.op))return"boolean";if(Object.prototype.hasOwnProperty.call(MATH,expr.op)){if(expr.op!=="+")return"number";const left=staticExpressionKind(expr.left),right=staticExpressionKind(expr.right);if([left,right].some(k=>["text","state"].includes(k)))return"text";if(left==="number"&&right==="number")return"number";return"dynamic";}}return"dynamic";}
function exprKind(expr){const kind=staticExpressionKind(expr);if(kind==="boolean")return"boolean";if(kind==="number")return"number";if(kind==="text")return"text";return"value";}
function presetKind(key){if(["compare","logic","not"].includes(key))return"boolean";if(["sensor","cellState"].includes(key))return"value";if(key==="text")return"text";if(["var","math"].includes(key))return"dynamic";return"number";}
function acceptsExpression(expected,actual){if(expected==="boolean")return actual==="boolean";if(expected==="number")return actual==="number"||actual==="dynamic";if(expected==="value")return["value","number","text","dynamic"].includes(actual);return false;}
function createExpressionPreset(key){const p=state.paletteConfig||{};if(key==="compare")return binary(p.compareOp||"==",null,null);if(key==="logic")return binary(p.logicOp||"and",null,null);if(key==="not")return{type:"not",value:null};if(key==="sensor")return sensor(p.sensorDirection||"front");if(key==="cellState")return lit(p.cellState||"cliff");if(key==="enemyDistance")return builtin("enemyDistance");if(key==="timer")return builtin("timer");if(key==="text")return lit("文字");if(key==="var")return{type:"var",name:"value"};if(key==="random")return{type:"random",min:null,max:null};if(key==="math")return binary(p.mathOp||"+",null,null);return lit(0);}
function mathOperandsAreNumeric(expr){return[expr?.left,expr?.right].every(value=>!["text","state","boolean"].includes(staticExpressionKind(value)));}
function normalizeMathOperator(expr){if(expr?.type==="binary"&&Object.prototype.hasOwnProperty.call(MATH,expr.op)&&expr.op!=="+"&&!mathOperandsAreNumeric(expr))expr.op="+";return expr;}
function comparisonSupportsOrdering(expr){return[expr?.left,expr?.right].every(value=>!["text","state","boolean"].includes(staticExpressionKind(value)));}
function normalizeCompareOperator(expr){if(expr?.type==="binary"&&Object.prototype.hasOwnProperty.call(COMPARE,expr.op)&&!["==","!="].includes(expr.op)&&!comparisonSupportsOrdering(expr))expr.op="==";return expr;}
'''
app = replace_between(app, "function literalLabel", "function clearExpressionPreset", expression_helpers, "expression type helpers")

app = replace_once(
    app,
    'function applyExpressionPreset(key,expected,onChange){const actual=presetKind(key);if(!acceptsExpression(expected,actual)){toast(expected==="boolean"?"この枠には条件を入れます":expected==="number"?"この枠には数値を入れます":"この枠には値または数値を入れます");return false;}',
    'function applyExpressionPreset(key,expected,onChange){const actual=presetKind(key);if(!acceptsExpression(expected,actual)){toast(expected==="boolean"?"この枠には条件を入れます":expected==="number"?"この枠には数値を入れます":"この枠には値（数字・文字など）を入れます");return false;}',
    "value socket message",
)

expression_ui = r'''function expressionControl(expr,expected,onChange,slotClass=""){
 if(expr===null||expr===undefined)return emptyExpressionSlot(expected,onChange,slotClass);
 const kind=exprKind(expr),node=document.createElement("span");node.className=`expression-node expression-${kind} ${slotClass}`.trim();
 const change=(next,rerender=true)=>commitExpression(onChange,next,rerender);
 if(expr.type==="binary"&&Object.prototype.hasOwnProperty.call(COMPARE,expr.op)){
   normalizeCompareOperator(expr);const setSide=(side,value)=>{expr[side]=value;normalizeCompareOperator(expr);change(expr)};const options=Object.entries(COMPARE).filter(([op])=>["==","!="].includes(op)||comparisonSupportsOrdering(expr));
   node.classList.add("expr-compare");node.append(document.createTextNode("＜"),expressionControl(expr.left,"value",v=>setSide("left",v),"expr-left"),select(options,expr.op,v=>{expr.op=v;change(expr)},"typed-select socket-operator"),expressionControl(expr.right,"value",v=>setSide("right",v),"expr-right"),document.createTextNode("＞"));
 }else if(expr.type==="binary"&&["and","or"].includes(expr.op)){
   node.classList.add("expr-logic");node.append(document.createTextNode("＜"),expressionControl(expr.left,"boolean",v=>{expr.left=v;change(expr)},"expr-left"),select([["and","かつ"],["or","または"]],expr.op,v=>{expr.op=v;change(expr)},"typed-select socket-operator"),expressionControl(expr.right,"boolean",v=>{expr.right=v;change(expr)},"expr-right"),document.createTextNode("＞"));
 }else if(expr.type==="not"){
   node.classList.add("expr-not");node.append(document.createTextNode("＜"),expressionControl(expr.value,"boolean",v=>{expr.value=v;change(expr)},"expr-inner"),document.createTextNode(" ではない＞"));
 }else if(expr.type==="binary"&&Object.prototype.hasOwnProperty.call(MATH,expr.op)){
   normalizeMathOperator(expr);const childExpected=expected==="number"||expr.op!=="+"?"number":"value";const setSide=(side,value)=>{expr[side]=value;normalizeMathOperator(expr);change(expr)};const options=Object.entries(MATH).filter(([op])=>op==="+"||mathOperandsAreNumeric(expr));
   node.classList.add("expr-math");node.append(document.createTextNode("（"),expressionControl(expr.left,childExpected,v=>setSide("left",v),"expr-left"),select(options,expr.op,v=>{expr.op=v;change(expr)},"typed-select socket-operator"),expressionControl(expr.right,childExpected,v=>setSide("right",v),"expr-right"),document.createTextNode("）"));
 }else if(expr.type==="sensor"){
   node.classList.add("expr-sensor");node.append(document.createTextNode("（"),select(Object.entries(DIR_LABELS),expr.direction||"front",v=>{expr.direction=v;change(expr)},"typed-select socket-enum"),document.createTextNode("）"));
 }else if(expr.type==="literal"&&typeof expr.value==="string"&&Object.prototype.hasOwnProperty.call(CELL_LABELS,expr.value)){
   node.classList.add("expr-cell-state");node.append(document.createTextNode("（"),select(Object.entries(CELL_LABELS),expr.value,v=>{expr.value=v;change(expr)},"typed-select socket-enum"),document.createTextNode("）"));
 }else if(expr.type==="literal"&&typeof expr.value==="string"){
   const i=document.createElement("input");i.type="text";i.className="typed-input socket-text expression-text-input";i.value=expr.value;i.maxLength=60;i.addEventListener("input",()=>{expr.value=i.value.slice(0,60);markDraftChanged()});node.classList.add("expr-text");node.append(document.createTextNode("「"),i,document.createTextNode("」"));
 }else if(expr.type==="literal"){
   const i=document.createElement("input");i.type="number";i.className="typed-input socket-number expression-number-input";i.value=Number(expr.value)||0;i.addEventListener("input",()=>{expr.value=Number(i.value)||0;markDraftChanged()});node.append(document.createTextNode("（"),i,document.createTextNode("）"));
 }else if(expr.type==="var"){
   const i=document.createElement("input");i.className="typed-input socket-variable expression-var-input";i.value=expr.name||"value";i.maxLength=40;i.addEventListener("input",()=>{expr.name=i.value.slice(0,40);markDraftChanged()});node.append(document.createTextNode("（変数 "),i,document.createTextNode("）"));
 }else if(expr.type==="builtin"&&expr.name==="enemyDistance"){
   node.classList.add("expr-enemy-distance");node.textContent="（最も近い敵との距離）";
 }else if(expr.type==="builtin"&&expr.name==="timer"){
   node.classList.add("expr-timer");node.textContent="（タイマー）";
 }else if(expr.type==="random"){
   node.classList.add("expr-random");node.append(document.createTextNode("（乱数 "),expressionControl(expr.min,"number",v=>{expr.min=v;change(expr)},"expr-left"),document.createTextNode(" ～ "),expressionControl(expr.max,"number",v=>{expr.max=v;change(expr)},"expr-right"),document.createTextNode("）"));
 }else node.textContent=`（${exprSummary(expr)}）`;
 node.append(expressionTransformButton(expr,onChange,kind));
 return wireExpressionTarget(node,expected,onChange);
}
function expressionTransformButton(expr,onChange,kind=exprKind(expr)){const b=document.createElement('button');b.type='button';b.className='expression-transform-button';b.textContent='式';b.title=kind==='boolean'?'この条件式を組み替える':'この値・計算式を組み替える';b.addEventListener('pointerdown',e=>e.stopPropagation());b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openExpressionTransformMenu(expr,onChange)});return b;}
function transformOverlay(title,subtitle){document.querySelectorAll('.expression-transform-overlay').forEach(n=>n.remove());const o=document.createElement('div');o.className='expression-overlay info-overlay expression-transform-overlay';const card=document.createElement('div');card.className='expression-card info-card expression-transform-card';card.innerHTML=`<small>${title}</small><h3>今の式を残したまま組み替える</h3><p>${subtitle}</p>`;const actions=document.createElement('div');actions.className='expression-transform-actions';card.append(actions);o.append(card);o.onclick=e=>{if(e.target===o)o.remove()};document.body.append(o);return{o,card,actions};}
function transformAction(host,label,fn,klass='secondary-button'){const b=document.createElement('button');b.type='button';b.className=klass;b.textContent=label;b.onclick=()=>{const next=fn();host.o.remove();if(next!==undefined)commitExpression(host.onChange,next,true)};host.actions.append(b);return b;}
function finishTransformMenu(host){const cancel=document.createElement('button');cancel.type='button';cancel.className='text-button';cancel.textContent='キャンセル';cancel.onclick=()=>host.o.remove();host.actions.append(cancel);}
function openExpressionTransformMenu(expr,onChange){if(exprKind(expr)==='boolean')return openBooleanTransformMenu(expr,onChange);return openValueTransformMenu(expr,onChange);}
function openBooleanTransformMenu(expr,onChange){const host=transformOverlay('条件式の編集','作り直さず、外側の条件だけを追加・解除できます。');host.onChange=onChange;transformAction(host,'かつで広げる',()=>binary('and',deepClone(expr),null));transformAction(host,'またはで広げる',()=>binary('or',deepClone(expr),null));if(expr?.type==='binary'&&['and','or'].includes(expr.op)){if(expr.left!=null)transformAction(host,'左だけ残す',()=>deepClone(expr.left));if(expr.right!=null)transformAction(host,'右だけ残す',()=>deepClone(expr.right));}if(expr?.type==='not'&&expr.value!=null)transformAction(host,'否定を外す',()=>deepClone(expr.value));else transformAction(host,'否定で包む',()=>({type:'not',value:deepClone(expr)}));finishTransformMenu(host);}
function openValueTransformMenu(expr,onChange){const host=transformOverlay('値・計算式の編集','数字や文字を残したまま、外側へ計算を足したり計算式を縮めたりできます。');host.onChange=onChange;transformAction(host,'右に ＋ で広げる',()=>binary('+',deepClone(expr),null));transformAction(host,'左に ＋ で広げる',()=>binary('+',null,deepClone(expr)));if(expr?.type==='binary'&&Object.prototype.hasOwnProperty.call(MATH,expr.op)){if(expr.left!=null)transformAction(host,'左だけ残す',()=>deepClone(expr.left));if(expr.right!=null)transformAction(host,'右だけ残す',()=>deepClone(expr.right));const numeric=mathOperandsAreNumeric(expr);for(const[op,label]of Object.entries(MATH)){if(op===expr.op||(!(op==='+')&&!numeric))continue;transformAction(host,`${label} に変更`,()=>{const next=deepClone(expr);next.op=op;return next;});}}finishTransformMenu(host);}
'''
app = replace_between(app, "function expressionControl", "function renderWorkspace", expression_ui, "expression editor UI")

app = replace_once(
    app,
    "function blockLabel(block){if(block?.type==='action'&&block.action==='move')return'進む';if(block?.type==='action'&&(block.uiKind==='turn'||String(block.action).startsWith('turn')))return'旋回';if(block?.type==='action'&&block.action==='attack')return'攻撃';if(block?.type==='if')return'もし ○○ なら';",
    "function blockLabel(block){if(block?.type==='action'&&block.action==='move')return'進む';if(block?.type==='action'&&(block.uiKind==='turn'||String(block.action).startsWith('turn')))return'旋回';if(block?.type==='action'&&block.action==='attack')return'攻撃';if(block?.type==='say')return'○○ と発言';if(block?.type==='if')return'もし ○○ なら';",
    "say block label",
)
app = replace_once(
    app,
    ' else if(block.type==="break")head.append(strong("ループを抜ける"));\n else if(block.type==="set"){head.append(document.createTextNode("変数 "),varInput(block,"name"),document.createTextNode(" ＝ "),expressionControl(block.value||lit(0),"number",v=>block.value=v));}',
    ' else if(block.type==="say"){head.append(expressionControl(block.value??null,"value",v=>block.value=v),strong(" と発言"));}\n else if(block.type==="break")head.append(strong("ループを抜ける"));\n else if(block.type==="set"){head.append(document.createTextNode("変数 "),varInput(block,"name"),document.createTextNode(" ＝ "),expressionControl(block.value??lit(0),"value",v=>block.value=v));}',
    "say render and string variables",
)
app = replace_once(
    app,
    ' if(type==="break")return{type:"break"};\n if(type==="setVar")return{type:"set",name:"value",value:lit(0)};',
    ' if(type==="break")return{type:"break"};\n if(type==="say")return{type:"say",value:null};\n if(type==="setVar")return{type:"set",name:"value",value:lit(0)};',
    "say create block",
)

old_board = 'if(a){const p=document.createElement("span");p.className=`piece ${a.color} dir-${a.dir}`;c.append(p);if(state.showNames&&el.id==="battleBoard"){const label=document.createElement("span");label.className=`piece-name-label ${a.color}`;label.textContent=a.name;c.append(label);}}'
new_board = 'if(a){const p=document.createElement("span");p.className=`piece ${a.color} dir-${a.dir}`;c.append(p);if(String(a.speech??"").length){const speech=document.createElement("span");speech.className=`piece-speech-bubble ${a.color}`;speech.textContent=String(a.speech).slice(0,80);c.append(speech);}if(state.showNames&&el.id==="battleBoard"){const label=document.createElement("span");label.className=`piece-name-label ${a.color}`;label.textContent=a.name;c.append(label);}}'
app = replace_once(app, old_board, new_board, "speech board rendering")

# Player-facing terminology: internal state remains tick for determinism/API compatibility.
app = app.replace('30tick以上走り続けられることを確認します。','タイマーが30以上になるまで走り続けられることを確認します。')
app = app.replace('崖を判断して30tick以上走り続けられました。','崖を判断してタイマーが30以上になるまで走り続けられました。')
app = app.replace('tickを消費せず、そのまま次の命令の判定へ進みます。','タイマーを消費せず、そのまま次の命令の判定へ進みます。')
app = app.replace('stopTest(`テスト終了：${reason}（${game.tick}tick）`);','stopTest(`テスト終了：${reason}（タイマー ${game.tick}）`);')
app = app.replace('function renderHud(game){$("#battleTick").textContent=`${game.tick} tick`;','function renderHud(game){$("#battleTick").textContent=String(game.tick);')
APP.write_text(app)


# ---------------------------------------------------------------------------
# HTML palette and HUD.
# ---------------------------------------------------------------------------
html = HTML.read_text()
html = replace_once(
    html,
    '<div class="palette-command-with-help"><button class="palette-block attack-block" type="button" data-add-block="attack">攻撃</button><button class="command-help" type="button" data-command-help="attack" aria-label="攻撃の説明">?</button></div>',
    '<div class="palette-command-with-help"><button class="palette-block attack-block" type="button" data-add-block="attack">攻撃</button><button class="command-help" type="button" data-command-help="attack" aria-label="攻撃の説明">?</button></div>\n                  <button class="palette-block say-block" type="button" data-add-block="say">○○ と発言</button>',
    "say palette",
)
html = replace_once(
    html,
    '<button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="enemyDistance">最も近い敵との距離</button>\n                  <button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="number">数字</button>',
    '<button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="enemyDistance">最も近い敵との距離</button>\n                  <button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="timer">タイマー</button>\n                  <button class="palette-block reporter-block reporter-number" type="button" data-expression-preset="number">数字</button>\n                  <button class="palette-block reporter-block reporter-text" type="button" data-expression-preset="text">文字</button>',
    "timer text palette",
)
html = replace_once(
    html,
    '<div><span class="hud-label">経過</span><strong id="battleTick">0 tick</strong></div>',
    '<div><span class="hud-label">タイマー</span><strong id="battleTick">0</strong></div>',
    "timer HUD",
)
HTML.write_text(html)


# ---------------------------------------------------------------------------
# CSS: text value styling, speech bubble above, tapped player name below.
# ---------------------------------------------------------------------------
style = STYLE.read_text()
style += r'''

/* timer-speech-text-v9 */
:root{--type-text:#ffad7a;--type-text-bg:rgba(181,95,43,.22)}
.palette-block.say-block{background:var(--type-action-bg);border-color:rgba(85,216,255,.28)}
.palette-block.reporter-text{background:var(--type-text-bg);border-color:rgba(255,173,122,.34);color:#ffd1b5}
.socket-text,.expression-text-input{color:var(--type-text);border:1px solid rgba(255,173,122,.48);border-radius:6px;background:var(--type-text-bg)}
.expression-text{color:var(--type-text)}
.expression-text-input{min-width:72px;max-width:min(230px,48vw);padding:4px 7px}
.expr-timer{color:var(--type-number)}
.piece-name-label{top:calc(100% + 4px)!important;bottom:auto!important;z-index:8!important}
.piece-name-label::after{top:-3px!important;bottom:auto!important;border-right:0!important;border-bottom:0!important;border-left:1px solid currentColor!important;border-top:1px solid currentColor!important;transform:translateX(-50%) rotate(45deg)!important}
.piece-speech-bubble{position:absolute;z-index:10;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);width:max-content;max-width:min(170px,42vw);padding:4px 7px;border:1px solid rgba(235,247,251,.36);border-radius:8px;background:rgba(3,7,11,.94);color:#f3fbfd;font-size:clamp(.48rem,1.65vw,.68rem);font-weight:700;line-height:1.35;text-align:left;white-space:normal;overflow-wrap:anywhere;pointer-events:none;box-shadow:0 7px 20px rgba(0,0,0,.34)}
.piece-speech-bubble::after{content:"";position:absolute;top:100%;left:50%;width:7px;height:7px;border-right:1px solid rgba(235,247,251,.36);border-bottom:1px solid rgba(235,247,251,.36);background:rgba(3,7,11,.94);transform:translate(-50%,-4px) rotate(45deg)}
@media(max-width:760px){.piece-speech-bubble{max-width:min(132px,46vw);padding:3px 5px}.expression-text-input{max-width:42vw}}
'''
STYLE.write_text(style)


# ---------------------------------------------------------------------------
# Optional tutorials: replace user-visible tick jargon and explain new values.
# ---------------------------------------------------------------------------
tutorials = TUTORIALS.read_text()
replacements = {
    "命令はタップするとコード末尾へ追加できます。ドラッグすれば『ずっと』や『もし』の内側など、好きな場所へ直接入れられます。": "命令はタップすると現在の挿入位置へ追加できます。ドラッグすれば『ずっと』や『もし』の内側など、好きな場所へ直接入れられます。",
    "数字、変数、敵との距離、乱数、＋－×÷％を直接入れ子にします。": "数字、文字、変数、タイマー、敵との距離、乱数、＋－×÷％を直接入れ子にします。",
    "数字・変数・最も近い敵との距離・乱数・計算は数値です。回数、攻撃射程、変数代入、計算の左右など、数値の空欄へ直接入れます。": "数字・タイマー・最も近い敵との距離・乱数は数値です。『文字』は文章として変数や発言に使えます。変数には数字と文字のどちらも保存できます。",
    "『変数を設定』『変数を増減』を使えば、歩数、旋回回数、攻撃回数など、自分に必要な情報を自分のコードで記録できます。": "『変数を設定』には数字だけでなく文字も保存できます。『変数を増減』は数値用です。歩数、旋回回数、モード判定名など、自分に必要な情報を自分のコードで記録できます。",
    "『（（ ）＋（ ））』の左右へ別の数値を差し込みます。中央は ＋、－、×、÷、％ に切替可能で、パレット上でも配置後でも変更できます。": "『（（ ）＋（ ））』の左右へ値を差し込みます。数字同士の＋は加算、どちらかが文字なら文章をつなぎます。数字だけの式では ＋、－、×、÷、％ に切替できます。",
    "『ずっと』の内側は繰り返されます。身体行動が1つ実行されるたびにtickが進み、次のtickでは途中の続きから実行されます。": "『ずっと』の内側は繰り返されます。身体行動が1つ実行されるたびにタイマーが進み、次のゲーム内時間では途中の続きから実行されます。",
    "条件判定そのものはtickを使いません。": "条件判定そのものはタイマーを使いません。",
    "そこへ『進む』を実行してもその場に留まりtickだけを使います。": "そこへ『進む』を実行してもその場に留まりタイマーだけが進みます。",
    "2tick連続の非移動を避け、崩れる床から生き残ります。": "タイマーが2進む間の連続非移動を避け、崩れる床から生き残ります。",
    "『進まないtick』を数える": "『進まない時間』を数える",
    "床抜けでは2tick連続で前進しないと、足元の床が崩れてゲームオーバーです。旋回は身体行動なので1tick使いますが、前進ではありません。": "床抜けではタイマーが2進む間、連続で前進しないと足元の床が崩れてゲームオーバーです。旋回は身体行動なのでタイマーが1進みますが、前進ではありません。",
    "『旋回 → 進む』なら、非移動は1tickだけなので床は崩れません。『旋回 → 旋回』のように2tick続けて前進しないと危険です。": "『旋回 → 進む』なら、前進しない時間は1だけなので床は崩れません。『旋回 → 旋回』のようにタイマーが2進む間ずっと前進しないと危険です。",
    "衝突を避けつつ2tick停止も防ぐ必要が出てきます。": "衝突を避けつつ、タイマーが2進む間の停止も防ぐ必要が出てきます。",
    "毎tick前進する身体を操り、尾と衝突を避けて生き残ります。": "タイマーが進むたび前進する身体を操り、尾と衝突を避けて生き残ります。",
    "コブラでは身体が毎tick必ず1マス進みます。": "コブラではタイマーが1進むたび、身体が必ず1マス進みます。",
    "旋回したtickにも進む": "旋回した時間にも進む",
    "向きを変えた直後、そのtickに新しい方向へ1マス進みます。": "向きを変えた直後、その同じゲーム内時間に新しい方向へ1マス進みます。",
    "尾が伸びないtickでは一番古い尾が消えます。そのtickでちょうど消える最後尾のマスへ入ることはできます。": "尾はタイマーが5進むごとに1マス伸びます。それ以外の時間では一番古い尾が消え、その時にちょうど消える最後尾のマスへ入ることはできます。",
    "必要なインクが無ければ攻撃は実行されず、tickも使わずに次の命令を判定します。": "必要なインクが無ければ攻撃は実行されず、タイマーも使わずに次の命令を判定します。",
    "攻撃せずに身体行動をしたtickはインクが1回復します。新しく塗ったマスへ移動したtickでは回復しません。": "攻撃せずに身体行動をしたゲーム内時間はインクが1回復します。新しく塗ったマスへ移動した時は回復しません。",
    "前方攻撃は実行できた時だけ1tickを使い、必要インクは『1＋射程』です。": "前方攻撃は実行できた時だけタイマーを1使い、必要インクは『1＋射程』です。",
}
for old, new in replacements.items():
    if old not in tutorials:
        raise SystemExit(f"missing tutorial phrase: {old}")
    tutorials = tutorials.replace(old, new)

needle = '      { title: "敵との距離だけは直接読める", text: "『最も近い敵との距離』は、生きている敵の頭までのマンハッタン距離です。敵がいなければ -1。インク量や尾の長さなどは専用値に頼らず、必要なら自分の変数とコードで管理します。", focus: \'[data-expression-preset="enemyDistance"]\' },\n'
addition = needle + '      { title: "タイマーを時計として使う", text: "『タイマー』はゲーム開始から進んだゲーム内時間です。どのモードでも同じ意味なので、一定時間ごとの処理や自分で尾の成長を推定する計算に使えます。", focus: \'[data-expression-preset="timer"]\' },\n      { title: "文字と発言で状態を見える化", text: "『文字』は変数へ保存でき、＋で数字や別の文字とつなげられます。『○○ と発言』はタイマーを消費せず、その値を駒の上へ表示します。次の発言で上書きされるので、コードの判断確認にも使えます。", focus: \'[data-add-block="say"]\' },\n'
tutorials = replace_once(tutorials, needle, addition, "timer speech tutorial steps")
TUTORIALS.write_text(tutorials)


# ---------------------------------------------------------------------------
# Runtime tests.
# ---------------------------------------------------------------------------
engine_test = ENGINE_TEST.read_text()
engine_test += r'''

test("timer builtin exposes the shared game clock", () => {
  const state = stateWithPrograms([move]);
  state.tick = 17;
  const value = evaluateVmExpression({ type: "builtin", name: "timer" }, {
    state,
    agent: state.agents[0],
    sense: () => ({ state: "unclaimed", owner: -1 }),
  });
  assert.equal(value, 17);
});

test("plus concatenates when either operand is text and still adds numbers", () => {
  const state = stateWithPrograms([move]);
  const context = { state, agent: state.agents[0], sense: () => ({ state: "unclaimed", owner: -1 }) };
  assert.equal(evaluateVmExpression({ type: "binary", op: "+", left: literal(2), right: literal(3) }, context), 5);
  assert.equal(evaluateVmExpression({ type: "binary", op: "+", left: literal("現在の値は"), right: literal(3) }, context), "現在の値は3");
  assert.equal(evaluateVmExpression({ type: "binary", op: "+", left: literal(3), right: literal("です") }, context), "3です");
});

test("text variables can be compared and used for branching", () => {
  const state = stateWithPrograms([
    { type: "set", name: "mode", value: literal("コブラ") },
    { type: "if", condition: { type: "binary", op: "==", left: { type: "var", name: "mode" }, right: literal("コブラ") }, then: [move], else: [right] },
  ]);
  assert.equal(decideAction(state, state.agents[0]), "move");
  assert.equal(state.agents[0].vars.mode, "コブラ");
});

test("speech is zero-time, can interpolate values with plus, and later speech overwrites it", () => {
  const state = stateWithPrograms([
    { type: "set", name: "x", value: literal(3) },
    { type: "say", value: { type: "binary", op: "+", left: { type: "binary", op: "+", left: literal("現在の値は"), right: { type: "var", name: "x" } }, right: literal("です") } },
    { type: "say", value: literal("実行中") },
    move,
  ]);
  const beforeX = state.agents[0].x;
  stepTerritory(state);
  assert.equal(state.tick, 1);
  assert.equal(state.agents[0].x, beforeX + 1);
  assert.equal(state.agents[0].speech, "実行中");
});
'''
ENGINE_TEST.write_text(engine_test)


# ---------------------------------------------------------------------------
# Client contracts.
# ---------------------------------------------------------------------------
client_test = CLIENT_TEST.read_text()
client_test += r'''

test("timer text and speech are exposed as composable language parts", () => {
  for (const key of ["timer", "text"]) assert.ok(html.includes(`data-expression-preset="${key}"`));
  assert.ok(html.includes('data-add-block="say"'));
  assert.match(app, /if\(key==="timer"\)return builtin\("timer"\)/);
  assert.match(app, /if\(key==="text"\)return lit\("文字"\)/);
  assert.match(app, /block\.type==="say"/);
  assert.match(app, /expressionControl\(block\.value\?\?null,"value"/);
  assert.match(app, /block\.type==="set"[^\n]+expressionControl\(block\.value\?\?lit\(0\),"value"/);
});

test("value and arithmetic expressions can be structurally transformed", () => {
  assert.match(app, /function openValueTransformMenu\(expr,onChange\)/);
  assert.ok(app.includes("右に ＋ で広げる"));
  assert.ok(app.includes("左に ＋ で広げる"));
  assert.ok(app.includes("左だけ残す"));
  assert.ok(app.includes("右だけ残す"));
  assert.match(app, /mathOperandsAreNumeric/);
  assert.match(app, /comparisonSupportsOrdering/);
  assert.match(app, /expression-text-input/);
});

test("battle pieces show speech above and tapped names below", () => {
  assert.match(app, /piece-speech-bubble/);
  assert.match(app, /speech\.textContent=String\(a\.speech\)\.slice\(0,80\)/);
  assert.match(css, /\.piece-speech-bubble\{[^}]*bottom:calc\(100% \+ 6px\)/);
  assert.match(css, /\.piece-name-label\{[^}]*top:calc\(100% \+ 4px\)!important;bottom:auto!important/);
});

test("player-facing game clock terminology is timer rather than tick", () => {
  assert.match(html, /<span class="hud-label">タイマー<\/span><strong id="battleTick">0<\/strong>/);
  assert.match(app, /タイマーが1進むたびに必ず1マス進みます/);
  assert.match(tutorials, /尾はタイマーが5進むごとに1マス伸びます/);
  assert.match(tutorials, /『○○ と発言』はタイマーを消費せず/);
});
'''
CLIENT_TEST.write_text(client_test)

print("timer / speech / text patch applied")
