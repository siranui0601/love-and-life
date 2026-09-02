from pathlib import Path
import re

APP = Path("public/now-coding/app-v3.js")
STYLE = Path("public/now-coding/style-v7.css")
TEST = Path("tools/now-coding/client-contract.test.mjs")
app = APP.read_text()


def replace_once(old, new, label):
    global app
    if old not in app:
        raise SystemExit(f"missing pattern: {label}")
    app = app.replace(old, new, 1)


def replace_between(start, end, replacement, label):
    global app
    a = app.find(start)
    if a < 0:
        raise SystemExit(f"missing start: {label}")
    b = app.find(end, a)
    if b < 0:
        raise SystemExit(f"missing end: {label}")
    app = app[:a] + replacement.rstrip() + "\n" + app[b:]


# Editor state: insertion cursor, move mode, and active block drag are UI-only.
replace_once(
    'testGame: null, draftBaseline: "", draftDirty: false, saveModalMode: "new", pendingAfterSave: null,',
    'testGame: null, draftBaseline: "", draftDirty: false, insertSequence: null, insertIndex: 0, moveSource: null, dragBlock: null, saveModalMode: "new", pendingAfterSave: null,',
    "editor ui state",
)

# Mobile palette click must not fire after a long-press drag.
replace_once(
    'function proxyMobilePaletteClick(event){if(event.target.closest("select"))return;',
    'function proxyMobilePaletteClick(event){if(Date.now()<state.suppressClickUntil||event.target.closest("select"))return;',
    "mobile click suppression",
)
replace_once(
    '  $("#mobilePaletteContent")?.addEventListener("click",proxyMobilePaletteClick);\n  $("#mobilePaletteContent")?.addEventListener("change",syncMobilePaletteOption);',
    '  $("#mobilePaletteContent")?.addEventListener("click",proxyMobilePaletteClick);\n  $("#mobilePaletteContent")?.addEventListener("pointerdown",startMobilePalettePointer);\n  $("#mobilePaletteContent")?.addEventListener("change",syncMobilePaletteOption);',
    "mobile long press binding",
)

# New/open drafts reset the insertion cursor to the end of the current root sequence.
replace_once(
    'function newDraft(){state.draft={programId:"",name:"新しい駒",blocks:[]};markDraftSaved();renderWorkspace();}',
    'function newDraft(){state.draft={programId:"",name:"新しい駒",blocks:[]};state.moveSource=null;resetInsertionCursor();markDraftSaved();renderWorkspace();}',
    "new draft cursor",
)
replace_once(
    'function openProgram(id){const p=state.programs.find(x=>x.programId===id);if(!p)return;state.draft={programId:p.programId,name:p.name,blocks:deepClone(p.blocks||[])};state.selectedProgramId=p.programId;markDraftSaved();showView("editor",true);}',
    'function openProgram(id){const p=state.programs.find(x=>x.programId===id);if(!p)return;state.draft={programId:p.programId,name:p.name,blocks:deepClone(p.blocks||[])};state.selectedProgramId=p.programId;state.moveSource=null;resetInsertionCursor();markDraftSaved();showView("editor",true);}',
    "open draft cursor",
)

# Insert robust sequence/block identity helpers immediately after pathKey.
needle = 'function pathKey(path){return path.map(p=>`${p.index}:${p.branch}`).join("/")||"root";}\n'
if needle not in app:
    raise SystemExit("missing pathKey")
helpers = r'''
const BLOCK_UI_TOKENS=new WeakMap();let BLOCK_UI_COUNTER=0;let dragScrollFrame=0,dragScrollSpeed=0;
function blockUiToken(block){if(!BLOCK_UI_TOKENS.has(block))BLOCK_UI_TOKENS.set(block,`block-${++BLOCK_UI_COUNTER}`);return BLOCK_UI_TOKENS.get(block);}
function childSequences(block){const out=[];for(const key of ["body","then","else"])if(Array.isArray(block?.[key]))out.push([key,block[key]]);return out;}
function findSequencePath(target,seq=state.draft.blocks,path=[]){if(seq===target)return path;for(let i=0;i<seq.length;i++)for(const [branch,child] of childSequences(seq[i])){const found=findSequencePath(target,child,[...path,{index:i,branch}]);if(found)return found;}return null;}
function findBlockLocation(target,seq=state.draft.blocks,path=[]){for(let i=0;i<seq.length;i++){const block=seq[i];if(block===target)return{seq,path,index:i};for(const [branch,child] of childSequences(block)){const found=findBlockLocation(target,child,[...path,{index:i,branch}]);if(found)return found;}}return null;}
function resetInsertionCursor(){state.insertSequence=state.draft.blocks;state.insertIndex=state.draft.blocks.length;}
function currentInsertionTarget(){let path=state.insertSequence?findSequencePath(state.insertSequence):null;if(!path){resetInsertionCursor();path=[];}state.insertIndex=Math.max(0,Math.min(Number(state.insertIndex)||0,state.insertSequence.length));return{seq:state.insertSequence,path,index:state.insertIndex};}
function setInsertionCursor(sequence,index,slot=null){if(!Array.isArray(sequence))return;state.insertSequence=sequence;state.insertIndex=Math.max(0,Math.min(Number(index)||0,sequence.length));$$('.insertion-slot.is-current-insert').forEach(n=>n.classList.remove('is-current-insert'));slot?.classList.add('is-current-insert');}
function sequenceInsideBlock(block,target){for(const [,child] of childSequences(block)){if(child===target)return true;for(const nested of child)if(sequenceInsideBlock(nested,target))return true;}return false;}
function canMoveBlockTo(block,targetSequence){return Array.isArray(targetSequence)&&!sequenceInsideBlock(block,targetSequence);}
function directInsertionSlot(zone,index){return[...zone.children].find(n=>n.classList?.contains('insertion-slot')&&Number(n.dataset.insertIndex)===Number(index))||null;}
function clearDragGaps(){$$('.insertion-slot.is-drag-gap').forEach(n=>n.classList.remove('is-drag-gap'));$$('.code-sequence.is-drop-target').forEach(n=>n.classList.remove('is-drop-target'));}
function dropIndexForPoint(zone,clientY){const blocks=[...zone.children].filter(n=>n.classList?.contains('typed-block'));for(const block of blocks){const r=block.getBoundingClientRect();if(clientY<r.top+r.height/2)return Number(block.dataset.blockIndex)||0;}return blocks.length;}
function activateDragGap(zone,index){clearDragGaps();if(!zone)return null;const slot=directInsertionSlot(zone,index);if(slot){zone.classList.add('is-drop-target');slot.classList.add('is-drag-gap');}return slot;}
function blockDropTargetAt(clientX,clientY,movingBlock=null){let el=document.elementFromPoint(clientX,clientY),zone=el?.closest?.('.code-sequence')||null;while(zone){const path=parseSequenceKey(zone.dataset.sequence),seq=seqByPath(path);if(seq&&(!movingBlock||canMoveBlockTo(movingBlock,seq)))return{zone,seq,path,index:dropIndexForPoint(zone,clientY)};zone=zone.parentElement?.closest?.('.code-sequence')||null;}return null;}
function updateDragAutoScroll(clientY){const top=86,bottom=window.innerHeight-132;dragScrollSpeed=clientY<top?-Math.min(18,6+(top-clientY)/5):clientY>bottom?Math.min(18,6+(clientY-bottom)/5):0;if(dragScrollSpeed&&!dragScrollFrame){const tick=()=>{if(!dragScrollSpeed){dragScrollFrame=0;return;}window.scrollBy(0,dragScrollSpeed);dragScrollFrame=requestAnimationFrame(tick)};dragScrollFrame=requestAnimationFrame(tick);}}
function stopDragAutoScroll(){dragScrollSpeed=0;if(dragScrollFrame)cancelAnimationFrame(dragScrollFrame);dragScrollFrame=0;}
function revealBlock(block,follow=true){if(!block)return;const token=blockUiToken(block);requestAnimationFrame(()=>{const node=document.querySelector(`[data-block-token="${token}"]`);if(!node)return;node.classList.add('just-moved');if(follow)node.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});setTimeout(()=>node.classList.remove('just-moved'),900);});}
function blockLabel(block){if(block?.type==='action'&&block.action==='move')return'進む';if(block?.type==='action'&&(block.uiKind==='turn'||String(block.action).startsWith('turn')))return'旋回';if(block?.type==='action'&&block.action==='attack')return'攻撃';if(block?.type==='if')return'もし ○○ なら';if(block?.type==='forever')return'ずっと';if(block?.type==='while')return'○○ならずっと';if(block?.type==='repeat')return'○回 繰り返す';if(block?.type==='set')return'変数を設定';if(block?.type==='change')return'変数を増減';if(block?.type==='break')return'ループを抜ける';return'命令';}
'''
app = app.replace(needle, needle + helpers + "\n", 1)

# Expression target click ignores the structural-edit button.
replace_once(
    'node.addEventListener("click",e=>{if(!state.pendingExpressionPreset)return;if(e.target.closest("select,input")&&e.target!==node)return;',
    'node.addEventListener("click",e=>{if(!state.pendingExpressionPreset)return;if(e.target.closest("select,input,.expression-transform-button")&&e.target!==node)return;',
    "expression transform click isolation",
)

# Replace expressionControl and add non-destructive boolean expression transformations.
replace_between(
    'function expressionControl(expr,expected,onChange,slotClass=""){',
    'function renderWorkspace()',
    r'''function expressionControl(expr,expected,onChange,slotClass=""){
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
   const i=document.createElement("input");i.type="number";i.className="typed-input socket-number expression-number-input";i.value=Number(expr.value)||0;i.addEventListener("input",()=>{expr.value=Number(i.value)||0;markDraftChanged()});node.append(document.createTextNode("（"),i,document.createTextNode("）"));
 }else if(expr.type==="var"){
   const i=document.createElement("input");i.className="typed-input socket-variable expression-var-input";i.value=expr.name||"value";i.maxLength=40;i.addEventListener("input",()=>{expr.name=i.value.slice(0,40);markDraftChanged()});node.append(document.createTextNode("（変数 "),i,document.createTextNode("）"));
 }else if(expr.type==="builtin"&&expr.name==="enemyDistance"){
   node.classList.add("expr-enemy-distance");node.textContent="（最も近い敵との距離）";
 }else if(expr.type==="random"){
   node.classList.add("expr-random");node.append(document.createTextNode("（乱数 "),expressionControl(expr.min,"number",v=>{expr.min=v;change(expr)},"expr-left"),document.createTextNode(" ～ "),expressionControl(expr.max,"number",v=>{expr.max=v;change(expr)},"expr-right"),document.createTextNode("）"));
 }else node.textContent=`（${exprSummary(expr)}）`;
 if(kind==="boolean")node.append(expressionTransformButton(expr,onChange));
 return wireExpressionTarget(node,expected,onChange);
}
function expressionTransformButton(expr,onChange){const b=document.createElement('button');b.type='button';b.className='expression-transform-button';b.textContent='式';b.title='この条件式を組み替える';b.addEventListener('pointerdown',e=>e.stopPropagation());b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openExpressionTransformMenu(expr,onChange)});return b;}
function openExpressionTransformMenu(expr,onChange){document.querySelectorAll('.expression-transform-overlay').forEach(n=>n.remove());const o=document.createElement('div');o.className='expression-overlay info-overlay expression-transform-overlay';const card=document.createElement('div');card.className='expression-card info-card expression-transform-card';card.innerHTML='<small>条件式の編集</small><h3>今の式を残したまま組み替える</h3><p>作り直さず、外側の条件だけを追加・解除できます。</p>';const actions=document.createElement('div');actions.className='expression-transform-actions';const add=(label,fn,klass='secondary-button')=>{const b=document.createElement('button');b.type='button';b.className=klass;b.textContent=label;b.onclick=()=>{const next=fn();o.remove();if(next!==undefined)commitExpression(onChange,next,true)};actions.append(b)};add('かつで広げる',()=>binary('and',deepClone(expr),null));add('またはで広げる',()=>binary('or',deepClone(expr),null));if(expr?.type==='binary'&&['and','or'].includes(expr.op)){if(expr.left!=null)add('左だけ残す',()=>deepClone(expr.left));if(expr.right!=null)add('右だけ残す',()=>deepClone(expr.right));}if(expr?.type==='not'&&expr.value!=null)add('否定を外す',()=>deepClone(expr.value));else add('否定で包む',()=>({type:'not',value:deepClone(expr)}));const cancel=document.createElement('button');cancel.type='button';cancel.className='text-button';cancel.textContent='キャンセル';cancel.onclick=()=>o.remove();actions.append(cancel);card.append(actions);o.append(card);o.onclick=e=>{if(e.target===o)o.remove()};document.body.append(o);}
''',
    "expression control",
)

# Replace the workspace/sequence/block renderer with insertion slots, move mode and follow behavior.
replace_between(
    'function renderWorkspace()',
    'function strong(t)',
    r'''function renderWorkspace(options={}){const host=$("#programWorkspace");if(!host)return;if(state.moveSource&&!findBlockLocation(state.moveSource))state.moveSource=null;currentInsertionTarget();host.innerHTML="";$("#draftNamePreview").textContent=state.draft.name||"新しい駒";if(state.moveSource){const bar=document.createElement('div');bar.className='move-mode-bar';bar.innerHTML=`<span><strong>${esc(blockLabel(state.moveSource))}</strong> の移動先を選んでください</span>`;const cancel=document.createElement('button');cancel.type='button';cancel.className='text-button';cancel.textContent='キャンセル';cancel.onclick=cancelBlockMove;bar.append(cancel);host.append(bar);}host.append(renderSequence(state.draft.blocks,[]));$("#blockCount").textContent=`${countBlocks(state.draft.blocks)} ブロック`;$("#workspaceHint").classList.toggle("is-hidden",state.draft.blocks.length>0);updateTutorialTargets();updateExpressionTargets();if(options.focusBlock)revealBlock(options.focusBlock,options.follow!==false);}
function countBlocks(seq){return(seq||[]).reduce((n,b)=>n+1+countBlocks(b.body)+countBlocks(b.then)+countBlocks(b.else),0);}
function hasBlockDragData(event){const types=Array.from(event.dataTransfer?.types||[]);return types.includes('application/x-now-palette')||types.includes('application/x-now-block');}
function createInsertionSlot(seq,path,index){const slot=document.createElement('button');slot.type='button';slot.className='insertion-slot';slot.dataset.insertIndex=String(index);slot.dataset.sequence=pathKey(path);const current=state.insertSequence===seq&&state.insertIndex===index;if(current)slot.classList.add('is-current-insert');if(state.moveSource){if(canMoveBlockTo(state.moveSource,seq)){slot.classList.add('is-move-target');slot.textContent='ここへ移動';slot.onclick=e=>{e.preventDefault();completeBlockMove(state.moveSource,seq,index)}}else{slot.classList.add('is-invalid-move-target');slot.disabled=true;}}else{slot.textContent=current?'次の命令はここに入ります':'＋';slot.onclick=e=>{e.preventDefault();setInsertionCursor(seq,index,slot)}}return slot;}
function renderSequence(seq,path){const zone=document.createElement("div");zone.className="code-sequence";zone.dataset.sequence=pathKey(path);zone.addEventListener("dragover",e=>{if(!hasBlockDragData(e))return;const moving=state.dragBlock;if(moving&&!canMoveBlockTo(moving,seq))return;e.preventDefault();e.stopPropagation();activateDragGap(zone,dropIndexForPoint(zone,e.clientY));updateDragAutoScroll(e.clientY)});zone.addEventListener("dragleave",e=>{if(!zone.contains(e.relatedTarget)){clearDragGaps();stopDragAutoScroll()}});zone.addEventListener("drop",e=>{if(!hasBlockDragData(e))return;e.preventDefault();e.stopPropagation();const gap=[...zone.children].find(n=>n.classList?.contains('is-drag-gap'));const index=gap?Number(gap.dataset.insertIndex):dropIndexForPoint(zone,e.clientY);clearDragGaps();stopDragAutoScroll();handleDrop(e,path,index)});seq.forEach((b,i)=>{zone.append(createInsertionSlot(seq,path,i),renderBlock(b,path,i))});zone.append(createInsertionSlot(seq,path,seq.length));return zone;}
function renderBlock(block,path,index){const node=document.createElement("article");const kind=["forever","while","repeat"].includes(block.type)?"control":block.type==="if"?"logic":["set","change"].includes(block.type)?"value":"action";node.className=`code-block typed-block block-${kind}`;node.draggable=true;node.dataset.blockPath=JSON.stringify(path);node.dataset.blockIndex=String(index);node.dataset.blockType=block.type;node.dataset.blockToken=blockUiToken(block);if(block.type==="action")node.dataset.action=block.action;node.classList.toggle('is-move-source',state.moveSource===block);node.addEventListener("dragstart",e=>{if(e.target.closest('button,input,select')){e.preventDefault();return;}e.stopPropagation();state.dragBlock=block;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("application/x-now-block",JSON.stringify({path,index}));node.classList.add("is-dragging")});node.addEventListener("dragend",()=>{state.dragBlock=null;node.classList.remove("is-dragging");clearDragGaps();stopDragAutoScroll()});
 const head=document.createElement("div");head.className="block-head";node.append(head);
 if(block.type==="action"&&block.action==="move")head.append(strong("進む"));
 else if(block.type==="action"&&(block.uiKind==="turn"||block.action==="turnLeft"||block.action==="turnRight")){head.append(strong("旋回"),select([["turnLeft","左"],["turnRight","右"]],block.action||"turnRight",v=>{block.action=v;block.uiKind="turn";markDraftChanged();},"typed-select socket-enum"));}
 else if(block.type==="action"&&block.action==="attack"){head.append(strong("攻撃"),document.createTextNode(" 射程 "),expressionControl(block.range||lit(3),"number",v=>block.range=v),tool("?","攻撃の説明",()=>openCommandHelp("attack"),"inline-help"));}
 else if(block.type==="break")head.append(strong("ループを抜ける"));
 else if(block.type==="set"){head.append(document.createTextNode("変数 "),varInput(block,"name"),document.createTextNode(" ＝ "),expressionControl(block.value||lit(0),"number",v=>block.value=v));}
 else if(block.type==="change"){head.append(document.createTextNode("変数 "),varInput(block,"name"),document.createTextNode(" に "),expressionControl(block.value||lit(1),"number",v=>block.value=v),document.createTextNode(" 加える"));}
 else if(block.type==="if"){head.append(strong("もし "),expressionControl(block.condition??null,"boolean",v=>block.condition=v,"expr-condition-root"),strong(" なら"));node.append(branchWrap("なら",block.then||[],[...path,{index,branch:"then"}]));const elseTitle=document.createElement("div");elseTitle.className="branch-label";elseTitle.textContent="そうでなければ";node.append(elseTitle,renderSequence(block.else||(block.else=[]),[...path,{index,branch:"else"}]));}
 else if(block.type==="forever"){head.append(strong("ずっと"));node.append(renderSequence(block.body||(block.body=[]),[...path,{index,branch:"body"}]));}
 else if(block.type==="while"){head.append(expressionControl(block.condition??null,"boolean",v=>block.condition=v,"expr-condition-root"),strong(" ならずっと"));node.append(renderSequence(block.body||(block.body=[]),[...path,{index,branch:"body"}]));}
 else if(block.type==="repeat"){head.append(expressionControl(block.times||lit(3),"number",v=>block.times=v),strong(" 回 繰り返す"));node.append(renderSequence(block.body||(block.body=[]),[...path,{index,branch:"body"}]));}
 head.addEventListener('pointerdown',e=>startTouchExistingBlockDrag(e,block));
 const tools=document.createElement("div");tools.className="block-tools";const up=tool("↑","上へ",()=>moveWithin(path,index,-1,block)),down=tool("↓","下へ",()=>moveWithin(path,index,1,block)),move=tool(state.moveSource===block?"移動取消":"移動","ネストをまたいで移動",()=>state.moveSource===block?cancelBlockMove():startBlockMove(block),"move-block"),del=tool("削除","削除",()=>requestDeleteBlock(block),"delete-block");up.disabled=index===0;down.disabled=index===seqByPath(path).length-1;tools.append(up,down,move,del);node.append(tools);return node;}
''',
    "workspace renderer",
)

# Replace move/drop/insert operations with object-identity based movement and container-delete choice.
replace_between(
    'function moveWithin(path,index,delta)',
    'function onTutorialAdd(block)',
    r'''function moveWithin(path,index,delta,blockHint=null){const seq=seqByPath(path),block=blockHint||seq?.[index],at=block?seq?.indexOf(block):-1,next=at+delta;if(!seq||at<0||next<0||next>=seq.length)return;[seq[at],seq[next]]=[seq[next],seq[at]];markDraftChanged();setInsertionCursor(seq,next+1);renderWorkspace({focusBlock:block,follow:true});}
function startBlockMove(block){if(!findBlockLocation(block))return;state.moveSource=block;renderWorkspace({focusBlock:block,follow:false});toast('移動先の「ここへ移動」をタップしてください');}
function cancelBlockMove(){const block=state.moveSource;state.moveSource=null;renderWorkspace({focusBlock:block,follow:false});}
function completeBlockMove(block,targetSequence,targetIndex){const loc=findBlockLocation(block);if(!loc||!canMoveBlockTo(block,targetSequence))return;const from=loc.seq;let at=Math.max(0,Math.min(Number(targetIndex)||0,targetSequence.length));if(from===targetSequence&&loc.index<at)at-=1;if(from===targetSequence&&at===loc.index){state.moveSource=null;setInsertionCursor(targetSequence,loc.index+1);return renderWorkspace({focusBlock:block,follow:true});}from.splice(loc.index,1);at=Math.max(0,Math.min(at,targetSequence.length));targetSequence.splice(at,0,block);state.moveSource=null;markDraftChanged();const next=findBlockLocation(block);if(next)setInsertionCursor(next.seq,next.index+1);renderWorkspace({focusBlock:block,follow:true});checkTutorialStructure();renderTutorial();}
function tutorialMoveTarget(block,targetPath,targetIndex){if(isTutorial()&&Number(state.profile?.tutorialStep||0)===3&&block?.type==='action'&&block.action==='move'){const forever=state.draft.blocks.find(b=>b.type==='forever');if(forever){return{seq:forever.body||(forever.body=[]),index:(forever.body||[]).length};}}return{seq:seqByPath(targetPath),index:targetIndex};}
function handleDrop(event,targetPath,targetIndex){const palette=event.dataTransfer.getData("application/x-now-palette"),raw=event.dataTransfer.getData("application/x-now-block");if(palette){insertBlock(targetPath,targetIndex,createBlock(palette));return;}if(!raw)return;try{const src=JSON.parse(raw),from=seqByPath(src.path),block=from?.[src.index];if(!block)return;const target=tutorialMoveTarget(block,targetPath,targetIndex);if(target.seq)completeBlockMove(block,target.seq,target.index);}catch{}}
function insertBlock(path,index,block){const routed=tutorialRouteInsertion(path,index,block),seq=seqByPath(routed.path);if(!seq)return;const at=Math.max(0,Math.min(routed.index,seq.length));seq.splice(at,0,block);markDraftChanged();setInsertionCursor(seq,at+1);renderWorkspace({focusBlock:block,follow:true});onTutorialAdd(block);}
function insertBlockAtCurrent(type){const target=currentInsertionTarget();insertBlock(target.path,target.index,createBlock(type));}
function isContainerBlock(block){return['if','forever','while','repeat'].includes(block?.type);}
function preservedChildren(block){if(block?.type==='if')return[...(block.then||[]),...(block.else||[])];return[...(block?.body||[])];}
function deleteBlockNow(block,keepChildren){const loc=findBlockLocation(block);if(!loc)return;const children=keepChildren?preservedChildren(block):[];loc.seq.splice(loc.index,1,...children);if(state.moveSource===block)state.moveSource=null;markDraftChanged();setInsertionCursor(loc.seq,loc.index+children.length);renderWorkspace({focusBlock:children[0]||null,follow:Boolean(children.length)});}
function requestDeleteBlock(block){if(!isContainerBlock(block))return deleteBlockNow(block,false);document.querySelectorAll('.block-delete-overlay').forEach(n=>n.remove());const o=document.createElement('div');o.className='expression-overlay info-overlay block-delete-overlay';const ifNote=block.type==='if'&&block.else?.length?'<p class="delete-branch-note">「なら」の中身→「そうでなければ」の中身の順で外へ出します。</p>':'';o.innerHTML=`<div class="expression-card info-card block-delete-card"><small>制御ブロックの削除</small><h3>「${esc(blockLabel(block))}」を削除します</h3><p>中にある命令を残すか、一緒に削除するか選んでください。</p>${ifNote}<div class="block-delete-actions"><button class="primary-button" type="button" data-keep>中身は残す</button><button class="secondary-button delete-with-children" type="button" data-all>中身も削除</button><button class="text-button" type="button" data-cancel>キャンセル</button></div></div>`;o.querySelector('[data-keep]').onclick=()=>{o.remove();deleteBlockNow(block,true)};o.querySelector('[data-all]').onclick=()=>{o.remove();deleteBlockNow(block,false)};o.querySelector('[data-cancel]').onclick=()=>o.remove();o.onclick=e=>{if(e.target===o)o.remove()};document.body.append(o);}
''',
    "move delete insert operations",
)

# Palette clicks now insert at the remembered cursor; add long-press/touch drag for original + mobile palettes.
replace_between(
    'function bindPalette(){',
    'function parseSequenceKey(key)',
    r'''function bindPalette(){$$('[data-add-block]').forEach(button=>{button.draggable=true;button.addEventListener("click",e=>{if(e.target.closest?.("select,input")||Date.now()<state.suppressClickUntil||button.classList.contains("tutorial-disabled"))return;insertBlockAtCurrent(button.dataset.addBlock)});button.addEventListener("keydown",e=>{if(["Enter"," "].includes(e.key)&&!e.target.closest?.("select,input")){e.preventDefault();if(!button.classList.contains("tutorial-disabled"))insertBlockAtCurrent(button.dataset.addBlock)}});button.addEventListener("dragstart",e=>{if(e.target.closest?.("select,input")||button.classList.contains("tutorial-disabled")){e.preventDefault();return;}e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("application/x-now-palette",button.dataset.addBlock)});button.addEventListener("contextmenu",e=>e.preventDefault());button.addEventListener("pointerdown",startTouchPaletteDrag);});}
function commandKeyFromMobileTarget(target){const recent=target.closest?.('[data-recent-command]');if(recent)return recent.dataset.recentCommand||'';const command=target.closest?.('[data-add-block],[data-expression-preset]');return paletteCommandKey(command);}
function startMobilePalettePointer(event){if(event.pointerType==='mouse'||event.button!==0||event.target.closest('select,input,[data-command-help]'))return;const key=commandKeyFromMobileTarget(event.target);if(key)startTouchCommandDrag(event,key,true);}
function startTouchPaletteDrag(event){if(event.target.closest?.("select,input")||event.pointerType==="mouse"||event.button!==0)return;const button=event.currentTarget;if(button.classList.contains("tutorial-disabled"))return;startTouchCommandDrag(event,`block:${button.dataset.addBlock}`,false);}
function startTouchExpressionDrag(event){if(event.target.closest?.('select,input')||event.pointerType==='mouse'||event.button!==0)return;const button=event.currentTarget;if(button.classList.contains('tutorial-disabled'))return;startTouchCommandDrag(event,`expr:${button.dataset.expressionPreset}`,false);}
function startTouchCommandDrag(event,key,fromMobile=false){if(!RECENT_COMMAND_META[key])return;const start={x:event.clientX,y:event.clientY};let point={...start},active=false,cancelled=false,ghost=null;const [kind,value]=key.split(':');const activate=()=>{if(active||cancelled)return;active=true;state.suppressClickUntil=Date.now()+700;recordRecentCommand(key);if(fromMobile)setMobilePalette(false);ghost=document.createElement('div');ghost.className='drag-ghost command-drag-ghost';ghost.textContent=RECENT_COMMAND_META[key]?.[0]||'命令';document.body.append(ghost);ghost.style.transform=`translate(${point.x+10}px,${point.y+10}px)`;document.body.classList.add('command-touch-dragging');if(kind==='expr'){clearExpressionPreset();state.pendingExpressionPreset=value;updateExpressionTargets();}};const hold=setTimeout(activate,fromMobile?190:130);const move=e=>{point={x:e.clientX,y:e.clientY};const dist=Math.hypot(point.x-start.x,point.y-start.y);if(!active){if(fromMobile&&dist>12){cancelled=true;clearTimeout(hold);return;}if(!fromMobile&&dist>6)activate();}if(!active)return;e.preventDefault();ghost.style.transform=`translate(${point.x+10}px,${point.y+10}px)`;updateDragAutoScroll(point.y);if(kind==='block'){const target=blockDropTargetAt(point.x,point.y);target?activateDragGap(target.zone,target.index):clearDragGaps();}else{$$('.touch-expression-target').forEach(n=>n.classList.remove('touch-expression-target'));const target=document.elementFromPoint(point.x,point.y)?.closest?.('.expression-target');if(target&&target.classList.contains('socket-accepting'))target.classList.add('touch-expression-target');}};const end=e=>{clearTimeout(hold);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);stopDragAutoScroll();ghost?.remove();document.body.classList.remove('command-touch-dragging');if(!active)return;if(kind==='block'){const target=blockDropTargetAt(e.clientX,e.clientY);clearDragGaps();if(target)insertBlock(target.path,target.index,createBlock(value));else toast('配置先が見つかりませんでした');}else{const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.expression-target.socket-accepting');$$('.touch-expression-target').forEach(n=>n.classList.remove('touch-expression-target'));if(target)target.click();else clearExpressionPreset();}};window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true});}
function startTouchExistingBlockDrag(event,block){if(event.pointerType==='mouse'||event.button!==0||event.target.closest('button,input,select,.expression-node'))return;const start={x:event.clientX,y:event.clientY};let point={...start},active=false,cancelled=false,ghost=null;const activate=()=>{if(active||cancelled)return;active=true;state.suppressClickUntil=Date.now()+700;state.dragBlock=block;ghost=document.createElement('div');ghost.className='drag-ghost block-touch-drag-ghost';ghost.textContent=blockLabel(block);document.body.append(ghost);ghost.style.transform=`translate(${point.x+10}px,${point.y+10}px)`;document.body.classList.add('command-touch-dragging')};const hold=setTimeout(activate,190);const move=e=>{point={x:e.clientX,y:e.clientY};const dist=Math.hypot(point.x-start.x,point.y-start.y);if(!active&&dist>12){cancelled=true;clearTimeout(hold);return;}if(!active)return;e.preventDefault();ghost.style.transform=`translate(${point.x+10}px,${point.y+10}px)`;updateDragAutoScroll(point.y);const target=blockDropTargetAt(point.x,point.y,block);target?activateDragGap(target.zone,target.index):clearDragGaps();};const end=e=>{clearTimeout(hold);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);stopDragAutoScroll();ghost?.remove();document.body.classList.remove('command-touch-dragging');state.dragBlock=null;if(!active)return;const target=blockDropTargetAt(e.clientX,e.clientY,block);clearDragGaps();if(target)completeBlockMove(block,target.seq,target.index);};window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true});}
''',
    "palette and touch drag",
)

# Expression presets outside the mobile sheet also gain touch drag.
replace_once(
    'block.addEventListener("dragstart",e=>{if(e.target.closest?.("select,input")||block.classList.contains("tutorial-disabled")){e.preventDefault();return;}e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("application/x-now-expression",block.dataset.expressionPreset)});});',
    'block.addEventListener("dragstart",e=>{if(e.target.closest?.("select,input")||block.classList.contains("tutorial-disabled")){e.preventDefault();return;}e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("application/x-now-expression",block.dataset.expressionPreset)});block.addEventListener("pointerdown",startTouchExpressionDrag);});',
    "expression touch drag",
)

APP.write_text(app)

# CSS is appended in the latest stylesheet so it wins over legacy block-tool rules.
css = STYLE.read_text()
marker = "/* editor-placement-ux-v8 */"
if marker not in css:
    css += r'''

/* editor-placement-ux-v8 */
.insertion-slot{display:flex;width:100%;height:7px;min-height:7px;margin:1px 0;padding:0;align-items:center;justify-content:center;border:1px solid transparent;border-radius:7px;background:transparent;color:transparent;font-size:10px;font-weight:800;line-height:1;opacity:.55;transition:height .14s ease,min-height .14s ease,margin .14s ease,border-color .14s ease,background .14s ease,color .14s ease,opacity .14s ease}
.insertion-slot:hover{height:18px;min-height:18px;border-color:rgba(88,230,246,.2);color:var(--muted);opacity:1}
.insertion-slot.is-current-insert{height:24px;min-height:24px;margin:3px 0;border-style:dashed;border-color:rgba(88,230,246,.38);background:rgba(88,230,246,.045);color:var(--cyan);opacity:1}
.insertion-slot.is-drag-gap{height:52px!important;min-height:52px!important;margin:7px 0!important;border:1px solid rgba(88,230,246,.72)!important;background:linear-gradient(90deg,rgba(88,230,246,.035),rgba(88,230,246,.13),rgba(88,230,246,.035))!important;color:var(--cyan)!important;opacity:1!important;box-shadow:inset 0 0 24px rgba(88,230,246,.05),0 0 18px rgba(88,230,246,.08)}
.insertion-slot.is-drag-gap::after{content:"ここで指を離すと、この隙間に入ります"}
.insertion-slot.is-move-target{height:36px;min-height:36px;margin:4px 0;border:1px dashed rgba(88,230,246,.46);background:rgba(88,230,246,.055);color:var(--cyan);opacity:1;cursor:pointer}
.insertion-slot.is-move-target:hover{height:44px;min-height:44px;background:rgba(88,230,246,.11);border-style:solid}
.insertion-slot.is-invalid-move-target{display:none}
.code-sequence.is-drop-target>.insertion-slot.is-drag-gap{animation:insertGapPulse .72s ease-in-out infinite alternate}
.move-mode-bar{position:sticky;z-index:12;top:68px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;padding:10px 12px;border:1px solid rgba(88,230,246,.42);background:rgba(7,14,20,.96);box-shadow:0 12px 28px rgba(0,0,0,.28);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#dcecf1}.move-mode-bar span{min-width:0}.move-mode-bar strong{color:var(--cyan)}
.typed-block.is-move-source{outline:2px solid rgba(88,230,246,.55);outline-offset:2px;filter:brightness(1.08)}
.block-tools{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;display:flex!important;grid-template-columns:none!important;grid-template-rows:none!important;justify-content:flex-start!important;align-items:center;flex-wrap:wrap;gap:5px;width:100%!important;max-width:100%;min-height:0!important;margin:8px 0 0!important;padding:0!important;background:transparent!important;overflow:visible!important;backdrop-filter:none!important}
.block-tools button{flex:0 0 auto!important;width:auto!important;min-width:38px;min-height:30px;padding:4px 8px!important}.block-tools .move-block{color:var(--cyan);border-color:rgba(88,230,246,.22)}
.typed-block.just-moved{animation:blockFollowFlash .85s ease-out}
.expression-transform-button{flex:0 0 auto;min-width:27px!important;min-height:24px!important;padding:2px 5px!important;border:1px solid rgba(101,227,163,.34)!important;border-radius:5px!important;background:rgba(4,12,9,.72)!important;color:#9bf0bb!important;font-size:9px!important;font-weight:900!important;line-height:1!important;clip-path:none!important;cursor:pointer}
.expression-transform-card{max-width:470px}.expression-transform-card>p{line-height:1.65;color:var(--muted)}.expression-transform-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.expression-transform-actions .text-button{grid-column:1/-1;justify-self:center}
.block-delete-card{max-width:460px}.block-delete-card>p{line-height:1.65}.delete-branch-note{padding:8px 10px;border-left:2px solid rgba(255,196,84,.48);background:rgba(255,196,84,.05);color:#d9c48f!important;font-size:.75rem}.block-delete-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.block-delete-actions [data-cancel]{grid-column:1/-1;justify-self:center}.block-delete-actions .delete-with-children{border-color:rgba(255,90,110,.28);color:#ff9cab}
.command-drag-ghost,.block-touch-drag-ghost{pointer-events:none!important;z-index:250!important;max-width:min(260px,70vw);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.touch-expression-target{outline:2px solid var(--type-condition)!important;outline-offset:3px;filter:brightness(1.35) drop-shadow(0 0 10px rgba(101,227,163,.7))}
body.command-touch-dragging{user-select:none;-webkit-user-select:none}
@keyframes insertGapPulse{to{border-color:rgba(88,230,246,1);box-shadow:inset 0 0 30px rgba(88,230,246,.09),0 0 24px rgba(88,230,246,.15)}}
@keyframes blockFollowFlash{0%{outline:2px solid rgba(88,230,246,.9);outline-offset:3px;filter:brightness(1.28)}100%{outline:2px solid transparent;outline-offset:7px;filter:brightness(1)}}
@media(max-width:760px){.insertion-slot.is-drag-gap{height:58px!important;min-height:58px!important}.insertion-slot.is-current-insert{height:27px;min-height:27px}.block-tools{justify-content:flex-start!important}.block-tools button{min-height:34px;padding-inline:9px!important}.move-mode-bar{top:60px}.expression-transform-actions,.block-delete-actions{grid-template-columns:1fr}.expression-transform-actions .text-button,.block-delete-actions [data-cancel]{grid-column:auto;justify-self:stretch}}
@media(prefers-reduced-motion:reduce){.insertion-slot,.typed-block.just-moved,.code-sequence.is-drop-target>.insertion-slot.is-drag-gap{transition:none;animation:none}}
'''
STYLE.write_text(css)

# Contract tests for the new editing model.
t = TEST.read_text()
if 'tap insertion remembers the current nested sequence' not in t:
    t += r'''

test("tap insertion remembers the current nested sequence", () => {
  assert.match(app, /insertSequence: null, insertIndex: 0/);
  assert.match(app, /function currentInsertionTarget\(\)/);
  assert.match(app, /function setInsertionCursor\(sequence,index/);
  assert.match(app, /function insertBlockAtCurrent\(type\)/);
  assert.match(app, /insertBlockAtCurrent\(button\.dataset\.addBlock\)/);
  assert.match(app, /nextの命令|次の命令はここに入ります/);
});

test("drag placement opens a real insertion gap and supports nested moves", () => {
  assert.match(app, /function activateDragGap\(zone,index\)/);
  assert.match(app, /function dropIndexForPoint\(zone,clientY\)/);
  assert.match(app, /function completeBlockMove\(block,targetSequence,targetIndex\)/);
  assert.match(app, /canMoveBlockTo\(block,targetSequence\)/);
  assert.match(css, /\.insertion-slot\.is-drag-gap\{height:52px/);
  assert.match(css, /ここで指を離すと、この隙間に入ります/);
  assert.match(app, /scrollIntoView\(\{behavior:'smooth',block:'center'/);
});

test("container deletion asks whether nested commands survive", () => {
  assert.match(app, /function requestDeleteBlock\(block\)/);
  assert.match(app, /中身は残す/);
  assert.match(app, /中身も削除/);
  assert.match(app, /function preservedChildren\(block\)/);
  assert.match(app, /block\.type==='if'/);
});

test("boolean expressions can be wrapped and collapsed without rebuilding", () => {
  assert.match(app, /かつで広げる/);
  assert.match(app, /またはで広げる/);
  assert.match(app, /左だけ残す/);
  assert.match(app, /右だけ残す/);
  assert.match(app, /否定で包む/);
  assert.match(app, /否定を外す/);
  assert.match(app, /binary\('or',deepClone\(expr\),null\)/);
});

test("mobile command sheet supports long-press drag into code", () => {
  assert.match(app, /mobilePaletteContent.*pointerdown.*startMobilePalettePointer/s);
  assert.match(app, /function startTouchCommandDrag\(event,key,fromMobile=false\)/);
  assert.match(app, /if\(fromMobile\)setMobilePalette\(false\)/);
  assert.match(app, /blockDropTargetAt\(point\.x,point\.y\)/);
  assert.match(app, /function startTouchExistingBlockDrag\(event,block\)/);
});

test("deep nesting keeps block tools left aligned and wrapping", () => {
  assert.match(css, /\.block-tools\{position:static!important/);
  assert.match(css, /justify-content:flex-start!important/);
  assert.match(css, /flex-wrap:wrap/);
  assert.match(app, /tool\(state\.moveSource===block\?"移動取消":"移動"/);
});
'''
TEST.write_text(t)

print("editor placement UX patch applied")
