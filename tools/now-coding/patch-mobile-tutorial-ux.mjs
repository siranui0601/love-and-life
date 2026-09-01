import fs from "node:fs";

const appPath = "public/now-coding/app-v3.js";
const htmlPath = "public/now-coding/index.html";
const cssPath = "public/now-coding/style-v4.css";
const testPath = "tools/now-coding/client-contract.test.mjs";

function replaceExact(src, oldText, newText, label) {
  if (!src.includes(oldText)) throw new Error(`missing anchor: ${label}`);
  return src.replace(oldText, newText);
}
function replaceRegex(src, pattern, replacement, label) {
  const next = src.replace(pattern, replacement);
  if (next === src) throw new Error(`missing regex anchor: ${label}`);
  return next;
}

let html = fs.readFileSync(htmlPath, "utf8");
html = replaceExact(
  html,
  '  <link rel="stylesheet" href="./style-v3.css" />\n',
  '  <link rel="stylesheet" href="./style-v3.css" />\n  <link rel="stylesheet" href="./style-v4.css" />\n',
  "load compatibility stylesheet"
);
html = replaceExact(html, '<div class="panel-title"><span>テスト盤</span><small>21 × 21</small></div>', '<div class="panel-title"><span>テスト盤</span><small>15 × 15</small></div>', "test board size label");
fs.writeFileSync(htmlPath, html);

let app = fs.readFileSync(appPath, "utf8");
app = replaceExact(
  app,
  'drag: null, suppressClickUntil: 0, optionalTutorial: null, tutorialFinalPassed: false,',
  'drag: null, suppressClickUntil: 0, optionalTutorial: null, tutorialFinalPassed: false, tutorialModalKey: "",',
  "tutorial modal state"
);

app = replaceRegex(
  app,
  /async function tutorialProgress\(step,done=false\)\{.*?\nfunction newDraft\(\)/s,
  `const TUTORIAL_STEPS=[
 ["コードを組んで、1位を目指せ。","自分で組んだコードが駒の頭脳になります。まずは『進む』だけの駒を作り、コードが最後まで来たら止まることを見てみましょう。","始める"],
 ["まず『進む』を置く","今は『進む』だけを使います。ほかの命令は一時的に操作できません。『進む』を1つ追加してください。",""] ,
 ["1マスだけ進むことを確認","次はテスト実行だけを使います。『進む』しかないので、駒は1マス進んだところで停止します。",""] ,
 ["繰り返すには『ずっと』","『ずっと』を追加したら、いま置いた『進む』をその内側へドラッグしてください。",""] ,
 ["今度は止まらない","テスト実行してください。『ずっと』の中に『進む』があるので、まっすぐ進み続けて崖から落ちます。",""] ,
 ["崖を見て判断する","『もし』を追加します。チュートリアル中は『ずっと』の中の正しい位置へ自動で入ります。条件は『前 が 崖』です。",""] ,
 ["崖なら旋回する","『旋回』を追加します。『もし』の『なら』側へ自動で入り、崖の手前で向きを変えます。",""] ,
 ["完成","もう一度テストし、崖を判断しながら走り続けられることを確認します。",""]
];
function tutorialStructure(){
  const foreverIndex=state.draft.blocks.findIndex(b=>b.type==="forever");
  const forever=foreverIndex>=0?state.draft.blocks[foreverIndex]:null;
  const body=forever?.body||[];
  const moveIndex=body.findIndex(x=>x.type==="action"&&x.action==="move");
  const ifIndex=body.findIndex(x=>x.type==="if"&&isFrontCliffCondition(x.condition));
  return{foreverIndex,forever,body,moveIndex,ifIndex,ifBlock:ifIndex>=0?body[ifIndex]:null};
}
function tutorialFocusInfo(){
  const s=Number(state.profile?.tutorialStep||0),base=TUTORIAL_STEPS[Math.min(s,TUTORIAL_STEPS.length-1)];
  if(s===0)return{key:"0",title:base[0],text:base[1],selectors:["#tutorialNextButton"],scroll:"#tutorialCoach"};
  if(s===7&&state.tutorialFinalPassed)return{key:"7:save",title:"テスト成功。最後に保存",text:"崖を判断して30tick以上走り続けられました。『保存』を押して最初の駒を完成させてください。",selectors:["#saveProgramButton"],scroll:"#saveProgramButton"};
  if(s===3){
    const t=tutorialStructure();
    if(t.forever&&t.moveIndex<0)return{key:"3:nest",title:"『進む』を『ずっと』の中へ",text:"紫の『ずっと』を用意できました。コード欄の『進む』を押したまま、紫の内側の『ここに命令を入れる』へ移動してください。",selectors:['.typed-block[data-action="move"]',\`.code-sequence[data-sequence="\${t.foreverIndex}:body"]\`],scroll:'.typed-block[data-action="move"]'};
  }
  const targets={1:'[data-add-block="move"]',2:'#runTestButton',3:'[data-add-block="forever"]',4:'#runTestButton',5:'[data-add-block="if"]',6:'[data-add-block="turn"]',7:'#runTestButton'};
  const sel=targets[s];return{key:String(s),title:base[0],text:base[1],selectors:sel?[sel]:[],scroll:sel};
}
async function tutorialProgress(step,done=false){if(!state.user)return;try{const d=await api("/api/now-coding/profile",{method:"PUT",body:JSON.stringify({userTrackingId:state.user.userTrackingId,tutorialStep:Math.max(Number(state.profile?.tutorialStep||0),step),tutorialDone:Boolean(done),prefs:state.profile?.prefs||{}})});state.profile=d.profile;applyTutorialGate();renderTutorial();}catch(e){console.warn(e);}}
function applyTutorialGate(){const locked=isTutorial();document.body.classList.toggle("tutorial-locked",locked);$$('[data-go="battle"], #onlineBattleTab').forEach(n=>{n.disabled=locked;n.setAttribute("aria-disabled",locked?"true":"false")});$("#firstProgramCard")?.classList.toggle("is-hidden",!locked);$("#homeEditorButton").disabled=false;$("#menuButton").disabled=false;}
function startTutorial(){newDraft();showView("editor",true);if(!state.profile)state.profile={tutorialStep:0,tutorialDone:false,prefs:{}};renderTutorial();}
function renderTutorial(){const c=$("#tutorialCoach");if(!c)return;if(!isTutorial()||state.view!=="editor"){c.classList.add("is-hidden");clearTutorialTargets();document.querySelectorAll(".tutorial-step-modal").forEach(n=>n.remove());return;}const s=Number(state.profile?.tutorialStep||0),info=tutorialFocusInfo(),item=TUTORIAL_STEPS[Math.min(s,TUTORIAL_STEPS.length-1)];$("#tutorialStepLabel").textContent=\`\${Math.min(s+1,8)} / 8\`;$("#tutorialTitle").textContent=info.title||item[0];$("#tutorialText").textContent=info.text||item[1];$("#tutorialIntroDemo")?.classList.toggle("is-hidden",s!==0);const next=$("#tutorialNextButton");next.textContent=item[2]||"次の操作をしてください";next.classList.toggle("is-hidden",s!==0);next.disabled=s!==0;c.classList.remove("is-hidden");updateTutorialTargets();requestAnimationFrame(maybeShowTutorialStepModal);}
function clearTutorialTargets(){$$(".tutorial-target,.tutorial-disabled").forEach(n=>n.classList.remove("tutorial-target","tutorial-disabled"));}
function updateTutorialTargets(){clearTutorialTargets();if(!isTutorial()||state.view!=="editor")return;const info=tutorialFocusInfo();$$('#view-editor button, #view-editor select, #view-editor input').forEach(n=>n.classList.add("tutorial-disabled"));for(const sel of info.selectors||[])$$(sel).forEach(n=>{n.classList.remove("tutorial-disabled");n.classList.add("tutorial-target")});}
function maybeShowTutorialStepModal(){
  if(!isTutorial()||state.view!=="editor")return;const s=Number(state.profile?.tutorialStep||0);if(s===0)return;const info=tutorialFocusInfo();if(!info||state.tutorialModalKey===info.key||document.querySelector(".tutorial-step-modal"))return;state.tutorialModalKey=info.key;
  const overlay=document.createElement("div");overlay.className="tutorial-step-modal";overlay.innerHTML=\`<div class="tutorial-step-card" role="dialog" aria-modal="true" aria-labelledby="tutorialModalTitle"><small>STEP \${Math.min(s+1,8)} / 8</small><h2 id="tutorialModalTitle">\${esc(info.title)}</h2><p>\${esc(info.text)}</p><button class="primary-button" type="button">この操作をやってみる</button></div>\`;
  overlay.querySelector("button").onclick=()=>{overlay.remove();setTimeout(()=>{const target=info.scroll?$(info.scroll):null;target?.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});},60)};document.body.append(overlay);
}
function tutorialRouteInsertion(path,index,block){
  if(!isTutorial())return{path,index};const s=Number(state.profile?.tutorialStep||0),t=tutorialStructure();
  if(s===5&&block.type==="if"&&t.foreverIndex>=0)return{path:[{index:t.foreverIndex,branch:"body"}],index:Math.max(0,t.moveIndex)};
  if(s===6&&block.type==="action"&&["turnLeft","turnRight"].includes(block.action)&&t.foreverIndex>=0&&t.ifIndex>=0)return{path:[{index:t.foreverIndex,branch:"body"},{index:t.ifIndex,branch:"then"}],index:0};
  return{path,index};
}

function newDraft()`,
  "guided tutorial controller"
);

app = replaceExact(
  app,
  'function renderBlock(block,path,index){const node=document.createElement("article");const kind=["forever","while","repeat"].includes(block.type)?"control":block.type==="if"?"logic":["set","change"].includes(block.type)?"value":"action";node.className=`code-block typed-block block-${kind}`;node.draggable=true;node.dataset.blockPath=JSON.stringify(path);node.dataset.blockIndex=String(index);node.addEventListener("dragstart",',
  'function renderBlock(block,path,index){const node=document.createElement("article");const kind=["forever","while","repeat"].includes(block.type)?"control":block.type==="if"?"logic":["set","change"].includes(block.type)?"value":"action";node.className=`code-block typed-block block-${kind}`;node.draggable=true;node.dataset.blockPath=JSON.stringify(path);node.dataset.blockIndex=String(index);node.dataset.blockType=block.type;if(block.type==="action")node.dataset.action=block.action;node.addEventListener("dragstart",',
  "block tutorial metadata"
);

app = replaceRegex(
  app,
  /function handleDrop\(event,targetPath,targetIndex\)\{.*?\nfunction insertBlock\(path,index,block\)\{.*?\}\nfunction onTutorialAdd\(block\)\{/s,
  `function handleDrop(event,targetPath,targetIndex){const palette=event.dataTransfer.getData("application/x-now-palette"),raw=event.dataTransfer.getData("application/x-now-block");if(palette){insertBlock(targetPath,targetIndex,createBlock(palette));return;}if(!raw)return;try{const src=JSON.parse(raw),from=seqByPath(src.path);if(!from)return;const [block]=from.splice(src.index,1);let nextPath=targetPath,nextIndex=targetIndex;if(isTutorial()&&Number(state.profile?.tutorialStep||0)===3&&block?.type==="action"&&block.action==="move"){const foreverIndex=state.draft.blocks.findIndex(b=>b.type==="forever");if(foreverIndex>=0){nextPath=[{index:foreverIndex,branch:"body"}];nextIndex=seqByPath(nextPath)?.length||0;}}const to=seqByPath(nextPath);if(!to){from.splice(Math.min(src.index,from.length),0,block);renderWorkspace();return;}let at=nextIndex;if(pathKey(src.path)===pathKey(nextPath)&&src.index<at)at-=1;to.splice(Math.max(0,Math.min(at,to.length)),0,block);renderWorkspace();checkTutorialStructure();renderTutorial();}catch{}}
function insertBlock(path,index,block){const routed=tutorialRouteInsertion(path,index,block),seq=seqByPath(routed.path);if(!seq)return;seq.splice(Math.max(0,Math.min(routed.index,seq.length)),0,block);renderWorkspace();onTutorialAdd(block);}
function onTutorialAdd(block){`,
  "tutorial-safe insertion routing"
);

app = replaceExact(
  app,
  '  if(s===1&&block.type==="action"&&block.action==="move")tutorialProgress(2);\n  checkTutorialStructure();\n}',
  '  if(s===1&&block.type==="action"&&block.action==="move"){tutorialProgress(2);return;}\n  checkTutorialStructure();\n  renderTutorial();\n}',
  "tutorial add rerender"
);

app = replaceRegex(
  app,
  /function bindPalette\(\)\{.*?\nfunction parseSequenceKey/s,
  `function bindPalette(){$$('[data-add-block]').forEach(button=>{button.draggable=true;button.addEventListener("click",()=>{if(Date.now()<state.suppressClickUntil||button.classList.contains("tutorial-disabled"))return;insertBlock([],state.draft.blocks.length,createBlock(button.dataset.addBlock))});button.addEventListener("dragstart",e=>{if(button.classList.contains("tutorial-disabled")){e.preventDefault();return;}e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("application/x-now-palette",button.dataset.addBlock)});button.addEventListener("contextmenu",e=>e.preventDefault());button.addEventListener("pointerdown",startTouchPaletteDrag);});}
function startTouchPaletteDrag(event){
  if(event.pointerType==="mouse"||event.button!==0)return;const button=event.currentTarget;if(button.classList.contains("tutorial-disabled"))return;const start={x:event.clientX,y:event.clientY};let active=false,ghost=null;
  const activate=(point)=>{if(active)return;active=true;state.suppressClickUntil=Date.now()+550;button.classList.add("is-drag-source");ghost=document.createElement("div");ghost.className="drag-ghost";ghost.textContent=button.textContent;document.body.append(ghost);ghost.style.transform=\`translate(\${point.clientX+10}px,\${point.clientY+10}px)\`;};
  const hold=setTimeout(()=>activate(event),120);
  const move=e=>{const dist=Math.hypot(e.clientX-start.x,e.clientY-start.y);if(!active&&dist>5)activate(e);if(!active)return;e.preventDefault();ghost.style.transform=\`translate(\${e.clientX+10}px,\${e.clientY+10}px)\`;const el=document.elementFromPoint(e.clientX,e.clientY)?.closest(".code-sequence");$$('.code-sequence.is-drop-target').forEach(n=>n.classList.remove("is-drop-target"));el?.classList.add("is-drop-target");};
  const end=e=>{clearTimeout(hold);button.removeEventListener("pointermove",move);button.removeEventListener("pointerup",end);button.removeEventListener("pointercancel",end);button.classList.remove("is-drag-source");ghost?.remove();$$('.code-sequence.is-drop-target').forEach(n=>n.classList.remove("is-drop-target"));if(active){const zone=document.elementFromPoint(e.clientX,e.clientY)?.closest(".code-sequence");if(zone){const path=parseSequenceKey(zone.dataset.sequence);insertBlock(path,seqByPath(path).length,createBlock(button.dataset.addBlock));}}};
  button.setPointerCapture?.(event.pointerId);button.addEventListener("pointermove",move);button.addEventListener("pointerup",end);button.addEventListener("pointercancel",end);
}
function parseSequenceKey`,
  "higher-sensitivity touch drag"
);

app = replaceExact(
  app,
  '    const a=game.agents[0];const stopped=a.alive&&a.pc>=a.program.length&&!a.vm?.frames?.length;',
  '    const a=game.agents[0];const stopped=a.alive&&a.vm?.halted===true;',
  "VM halted tutorial detection"
);
app = replaceExact(
  app,
  '      stopTest();state.tutorialFinalPassed=true;$("#testStatus").textContent="成功：崖を判断して走り続けられました。駒を保存してください。";$("#saveProgramButton").classList.add("tutorial-target");return;',
  '      stopTest();state.tutorialFinalPassed=true;$("#testStatus").textContent="成功：崖を判断して走り続けられました。駒を保存してください。";renderTutorial();return;',
  "final tutorial focus"
);
fs.writeFileSync(appPath, app);

let css = fs.readFileSync(cssPath, "utf8");
css += `\n\n/* iPhone acceptance pass: use the full editor width and make each tutorial action explicit. */\n@media(max-width:900px){\n  .editor-layout-v3>.block-palette{position:static!important;display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:12px!important;overflow:visible!important}\n  .editor-layout-v3>.block-palette .panel-title{position:static!important;width:100%!important;margin-bottom:8px}\n  .editor-layout-v3>.block-palette .palette-accordion{display:grid!important;grid-template-columns:minmax(0,1fr)!important;width:100%!important;max-width:none!important;overflow:visible!important}\n  .editor-layout-v3>.block-palette .palette-section{width:100%!important;min-width:0!important;max-width:none!important}\n  .editor-layout-v3>.block-palette .palette-items{grid-template-columns:repeat(2,minmax(0,1fr))!important;width:100%!important}\n}\n@media(max-width:560px){\n  .editor-layout-v3>.block-palette{padding:10px!important}\n  .palette-section>summary{min-height:40px;padding-inline:10px}\n  .palette-block{min-height:42px;padding:8px 10px!important}\n}\n.tutorial-disabled{opacity:.24!important;filter:grayscale(.55)!important;pointer-events:none!important}\n.tutorial-target{opacity:1!important;filter:none!important;pointer-events:auto!important;position:relative;z-index:5}\n.tutorial-step-modal{position:fixed;inset:0;z-index:18000;display:grid;place-items:center;padding:18px;background:rgba(2,6,10,.88);backdrop-filter:blur(16px)}\n.tutorial-step-card{width:min(520px,100%);padding:22px;background:linear-gradient(145deg,#0b141b,#081017);border:1px solid rgba(88,230,246,.35);box-shadow:0 28px 90px rgba(0,0,0,.62),inset 0 1px rgba(255,255,255,.04)}\n.tutorial-step-card small{display:block;margin-bottom:8px;color:var(--cyan);font-size:.68rem;letter-spacing:.14em}\n.tutorial-step-card h2{margin:0 0 10px;font-size:clamp(1.25rem,5vw,1.8rem)}\n.tutorial-step-card p{margin:0 0 18px;color:#b9c8ce;line-height:1.75}\n.tutorial-step-card .primary-button{width:100%}\n@media(prefers-reduced-motion:reduce){.tutorial-step-modal{backdrop-filter:none}}\n`;
fs.writeFileSync(cssPath, css);

let tests = fs.readFileSync(testPath, "utf8");
tests = replaceExact(
  tests,
  'test("multi-mode online client participates in the server round protocol", () => {',
  `test("mobile tutorial acceptance contract is wired", () => {\n  assert.match(html, /style-v4\\.css/);\n  assert.match(app, /a\\.vm\\?\\.halted===true/);\n  assert.match(app, /tutorial-step-modal/);\n  assert.match(app, /scrollIntoView/);\n  assert.match(app, /setTimeout\\(\\(\\)=>activate\\(event\\),120\\)/);\n  assert.match(app, /dist>5/);\n  assert.match(css, /editor-layout-v3>\\.block-palette\\{[^}]*display:block!important/);\n  assert.match(css, /\\.tutorial-disabled/);\n});\n\ntest("multi-mode online client participates in the server round protocol", () => {`,
  "mobile tutorial contract test"
);
fs.writeFileSync(testPath, tests);

console.log("patched mobile palette, touch drag and guided tutorial UX");
