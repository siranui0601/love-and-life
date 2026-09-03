import fs from "node:fs";

function patch(path, mutate) {
  const before = fs.readFileSync(path, "utf8");
  const after = mutate(before);
  if (after === before) throw new Error(`no_change:${path}`);
  fs.writeFileSync(path, after);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`missing_anchor:${label}`);
  const next = source.replace(before, after);
  if (next.includes(before)) throw new Error(`duplicate_anchor:${label}`);
  return next;
}

patch("public/now-coding/app-v3.js", (input) => {
  let source = input;

  source = replaceOnce(
    source,
    'import { TUTORIALS, tutorialById } from "./tutorials.js";\n',
    'import { TUTORIALS, tutorialById } from "./tutorials.js";\nimport { repairTutorialBlocks, tutorialExpressionSlotAllowed } from "./tutorial-recovery.js";\n',
    "tutorial-recovery-import",
  );

  source = replaceOnce(
    source,
    'draftBaseline: "", draftDirty: false, insertSequence: null, insertIndex: 0, moveSource: null, dragBlock: null, saveModalMode: "new", pendingAfterSave: null,',
    'draftBaseline: "", draftDirty: false, insertSequence: null, insertIndex: 0, moveSource: null, copySource: null, dragBlock: null, saveModalMode: "new", pendingAfterSave: null,',
    "copy-state",
  );

  source = replaceOnce(
    source,
    'const RECENT_COMMAND_STORAGE="nowCodingRecentCommandsV1";\n',
    'const RECENT_COMMAND_STORAGE="nowCodingRecentCommandsV1";\nconst TUTORIAL_DRAFT_STORAGE="nowCodingTutorialDraftV1";\n',
    "tutorial-storage-constant",
  );

  source = replaceOnce(
    source,
    'function markDraftChanged(){state.draftDirty=true;}',
    'function markDraftChanged(){state.draftDirty=true;persistTutorialDraft();}',
    "persist-on-change",
  );

  source = replaceOnce(
    source,
    'function newDraft(){state.draft={programId:"",name:"新しい駒",blocks:[]};state.moveSource=null;resetInsertionCursor();markDraftSaved();renderWorkspace();}\nfunction openProgram(id){const p=state.programs.find(x=>x.programId===id);if(!p)return;state.draft={programId:p.programId,name:p.name,blocks:deepClone(p.blocks||[])};state.selectedProgramId=p.programId;state.moveSource=null;resetInsertionCursor();markDraftSaved();showView("editor",true);}',
    'function newDraft(){state.draft={programId:"",name:"新しい駒",blocks:[]};state.moveSource=null;state.copySource=null;resetInsertionCursor();markDraftSaved();renderWorkspace();}\nfunction openProgram(id){const p=state.programs.find(x=>x.programId===id);if(!p)return;state.draft={programId:p.programId,name:p.name,blocks:deepClone(p.blocks||[])};state.selectedProgramId=p.programId;state.moveSource=null;state.copySource=null;resetInsertionCursor();markDraftSaved();showView("editor",true);}',
    "reset-placement-state",
  );

  source = replaceOnce(
    source,
    'function isTutorial(){return Boolean(state.profile&&!state.profile.tutorialDone);}\nconst TUTORIAL_STEPS=[',
    `function isTutorial(){return Boolean(state.profile&&!state.profile.tutorialDone);}\nfunction tutorialDraftStorageKey(){const id=state.user?.userTrackingId;if(!id)return"";return \`${'${TUTORIAL_DRAFT_STORAGE}:${id}'}\`;}\nfunction persistTutorialDraft(){if(!isTutorial())return;const key=tutorialDraftStorageKey();if(!key)return;try{localStorage.setItem(key,JSON.stringify({name:state.draft?.name||"新しい駒",blocks:state.draft?.blocks||[]}));}catch{}}\nfunction loadTutorialDraft(){const key=tutorialDraftStorageKey();if(!key)return null;try{const parsed=JSON.parse(localStorage.getItem(key)||"null");return parsed&&Array.isArray(parsed.blocks)?parsed:null;}catch{return null;}}\nfunction clearTutorialDraft(){const key=tutorialDraftStorageKey();if(!key)return;try{localStorage.removeItem(key);}catch{}}\nconst TUTORIAL_STEPS=[`,
    "tutorial-storage-helpers",
  );

  source = replaceOnce(
    source,
    'async function tutorialProgress(step,done=false){if(!state.user)return;try{const d=await api("/api/now-coding/profile",{method:"PUT",body:JSON.stringify({userTrackingId:state.user.userTrackingId,tutorialStep:Math.max(Number(state.profile?.tutorialStep||0),step),tutorialDone:Boolean(done),prefs:state.profile?.prefs||{}})});state.profile=d.profile;applyTutorialGate();renderTutorial();}catch(e){console.warn(e);}}',
    'async function tutorialProgress(step,done=false){if(!state.user)return;try{const d=await api("/api/now-coding/profile",{method:"PUT",body:JSON.stringify({userTrackingId:state.user.userTrackingId,tutorialStep:Math.max(Number(state.profile?.tutorialStep||0),step),tutorialDone:Boolean(done),prefs:state.profile?.prefs||{}})});state.profile=d.profile;if(done)clearTutorialDraft();else persistTutorialDraft();applyTutorialGate();renderTutorial();}catch(e){console.warn(e);}}',
    "tutorial-progress-persist",
  );

  source = replaceOnce(
    source,
    'function startTutorial(){newDraft();showView("editor",true);if(!state.profile)state.profile={tutorialStep:0,tutorialDone:false,prefs:{}};renderTutorial();}',
    'function startTutorial(){if(!state.profile)state.profile={tutorialStep:0,tutorialDone:false,prefs:{}};const step=Number(state.profile?.tutorialStep||0),cached=loadTutorialDraft(),blocks=repairTutorialBlocks(cached?.blocks||[],step);state.draft={programId:"",name:String(cached?.name||"新しい駒"),blocks};state.moveSource=null;state.copySource=null;resetInsertionCursor();state.draftBaseline=draftSignature({programId:"",name:state.draft.name,blocks:[]});state.draftDirty=blocks.length>0;updateSaveActions();persistTutorialDraft();showView("editor",true);checkTutorialStructure();renderTutorial();}',
    "tutorial-resume",
  );

  source = replaceOnce(
    source,
    'function updateExpressionTargets(){if(!state.pendingExpressionPreset)return;const actual=presetKind(state.pendingExpressionPreset);$$(\'.expression-target\').forEach(n=>n.classList.toggle(\'socket-accepting\',acceptsExpression(n.dataset.expected,actual)));$$(\'[data-expression-preset]\').forEach(n=>n.classList.toggle(\'expression-preset-active\',n.dataset.expressionPreset===state.pendingExpressionPreset));}\nfunction applyExpressionPreset(key,expected,onChange){const actual=presetKind(key);if(!acceptsExpression(expected,actual)){toast(expected==="boolean"?"この枠には条件を入れます":expected==="number"?"この枠には数値を入れます":"この枠には値（数字・文字など）を入れます");return false;}onChange(createExpressionPreset(key));clearExpressionPreset();renderWorkspace();checkTutorialStructure();renderTutorial();return true;}\nfunction wireExpressionTarget(node,expected,onChange){node.classList.add("expression-target");node.dataset.expected=expected;node.addEventListener("dragover",e=>{if(e.dataTransfer.types.includes("application/x-now-expression"))e.preventDefault()});node.addEventListener("drop",e=>{const key=e.dataTransfer.getData("application/x-now-expression");if(key){e.preventDefault();e.stopPropagation();applyExpressionPreset(key,expected,onChange)}});node.addEventListener("click",e=>{if(!state.pendingExpressionPreset)return;if(e.target.closest("select,input,.expression-transform-button")&&e.target!==node)return;e.preventDefault();e.stopPropagation();applyExpressionPreset(state.pendingExpressionPreset,expected,onChange)});return node;}',
    'function tutorialExpressionTargetRole(node){const owner=node?.closest?.(\'.typed-block[data-block-type="if"]\');if(!owner)return"other";if(node.classList.contains("expr-left"))return"left";if(node.classList.contains("expr-right"))return"right";return"other";}\nfunction tutorialAllowsExpressionTarget(key,node){return tutorialExpressionSlotAllowed(Number(state.profile?.tutorialStep||0),key,tutorialExpressionTargetRole(node));}\nfunction updateExpressionTargets(){if(!state.pendingExpressionPreset)return;const key=state.pendingExpressionPreset,actual=presetKind(key);$$(\'.expression-target\').forEach(n=>n.classList.toggle(\'socket-accepting\',acceptsExpression(n.dataset.expected,actual)&&tutorialAllowsExpressionTarget(key,n)));$$(\'[data-expression-preset]\').forEach(n=>n.classList.toggle(\'expression-preset-active\',n.dataset.expressionPreset===state.pendingExpressionPreset));}\nfunction applyExpressionPreset(key,expected,onChange,targetNode=null){const actual=presetKind(key);if(!acceptsExpression(expected,actual)){toast(expected==="boolean"?"この枠には条件を入れます":expected==="number"?"この枠には数値を入れます":"この枠には値（数字・文字など）を入れます");return false;}if(targetNode&&!tutorialAllowsExpressionTarget(key,targetNode)){toast("チュートリアルでは光っている側の空欄に入れてください");return false;}markDraftChanged();onChange(createExpressionPreset(key));clearExpressionPreset();renderWorkspace();checkTutorialStructure();renderTutorial();return true;}\nfunction wireExpressionTarget(node,expected,onChange){node.classList.add("expression-target");node.dataset.expected=expected;node.addEventListener("dragover",e=>{if(e.dataTransfer.types.includes("application/x-now-expression"))e.preventDefault()});node.addEventListener("drop",e=>{const key=e.dataTransfer.getData("application/x-now-expression");if(key){e.preventDefault();e.stopPropagation();applyExpressionPreset(key,expected,onChange,node)}});node.addEventListener("click",e=>{if(!state.pendingExpressionPreset)return;if(e.target.closest("select,input,.expression-transform-button")&&e.target!==node)return;e.preventDefault();e.stopPropagation();applyExpressionPreset(state.pendingExpressionPreset,expected,onChange,node)});return node;}',
    "tutorial-expression-target-lock",
  );

  source = replaceOnce(
    source,
    'if(state.moveSource){const bar=document.createElement(\'div\');bar.className=\'move-mode-bar\';bar.innerHTML=`<span><strong>${esc(blockLabel(state.moveSource))}</strong> の移動先を選んでください</span>`;const cancel=document.createElement(\'button\');cancel.type=\'button\';cancel.className=\'text-button\';cancel.textContent=\'キャンセル\';cancel.onclick=cancelBlockMove;bar.append(cancel);host.append(bar);}host.append(renderSequence(state.draft.blocks,[]));',
    'if(state.moveSource){const bar=document.createElement(\'div\');bar.className=\'move-mode-bar\';bar.innerHTML=`<span><strong>${esc(blockLabel(state.moveSource))}</strong> の移動先を選んでください</span>`;const cancel=document.createElement(\'button\');cancel.type=\'button\';cancel.className=\'text-button\';cancel.textContent=\'キャンセル\';cancel.onclick=cancelBlockMove;bar.append(cancel);host.append(bar);}else if(state.copySource){const bar=document.createElement(\'div\');bar.className=\'move-mode-bar copy-mode-bar\';bar.innerHTML=`<span><strong>${esc(blockLabel(state.copySource))}</strong> のコピー先を選んでください</span>`;const cancel=document.createElement(\'button\');cancel.type=\'button\';cancel.className=\'text-button\';cancel.textContent=\'キャンセル\';cancel.onclick=cancelBlockCopy;bar.append(cancel);host.append(bar);}host.append(renderSequence(state.draft.blocks,[]));',
    "copy-mode-bar",
  );

  source = replaceOnce(
    source,
    'function createInsertionSlot(seq,path,index){const slot=document.createElement(\'button\');slot.type=\'button\';slot.className=\'insertion-slot\';slot.dataset.insertIndex=String(index);slot.dataset.sequence=pathKey(path);const current=state.insertSequence===seq&&state.insertIndex===index;if(current)slot.classList.add(\'is-current-insert\');if(state.moveSource){if(canMoveBlockTo(state.moveSource,seq)){slot.classList.add(\'is-move-target\');slot.textContent=\'ここへ移動\';slot.onclick=e=>{e.preventDefault();completeBlockMove(state.moveSource,seq,index)}}else{slot.classList.add(\'is-invalid-move-target\');slot.disabled=true;}}else{slot.textContent=current?\'次の命令はここに入ります\':\'＋\';slot.onclick=e=>{e.preventDefault();setInsertionCursor(seq,index,slot)}}return slot;}',
    'function createInsertionSlot(seq,path,index){const slot=document.createElement(\'button\');slot.type=\'button\';slot.className=\'insertion-slot\';slot.dataset.insertIndex=String(index);slot.dataset.sequence=pathKey(path);const current=state.insertSequence===seq&&state.insertIndex===index;if(current)slot.classList.add(\'is-current-insert\');if(state.moveSource){if(canMoveBlockTo(state.moveSource,seq)){slot.classList.add(\'is-move-target\');slot.textContent=\'ここへ移動\';slot.onclick=e=>{e.preventDefault();completeBlockMove(state.moveSource,seq,index)}}else{slot.classList.add(\'is-invalid-move-target\');slot.disabled=true;}}else if(state.copySource){slot.classList.add(\'is-copy-target\');slot.textContent=\'ここへコピー\';slot.onclick=e=>{e.preventDefault();completeBlockCopy(seq,index)}}else{slot.textContent=current?\'次の命令はここに入ります\':\'＋\';slot.onclick=e=>{e.preventDefault();setInsertionCursor(seq,index,slot)}}return slot;}',
    "copy-insertion-slots",
  );

  source = replaceOnce(
    source,
    'const tools=document.createElement("div");tools.className="block-tools";const up=tool("↑","上へ",()=>moveWithin(path,index,-1,block)),down=tool("↓","下へ",()=>moveWithin(path,index,1,block)),move=tool(state.moveSource===block?"移動取消":"移動","ネストをまたいで移動",()=>state.moveSource===block?cancelBlockMove():startBlockMove(block),"move-block"),del=tool("削除","削除",()=>requestDeleteBlock(block),"delete-block");up.disabled=index===0;down.disabled=index===seqByPath(path).length-1;tools.append(up,down,move,del);node.append(tools);return node;}',
    'const tools=document.createElement("div");tools.className="block-tools";const up=tool("↑","上へ",()=>moveWithin(path,index,-1,block)),down=tool("↓","下へ",()=>moveWithin(path,index,1,block)),move=tool(state.moveSource===block?"移動取消":"移動","ネストをまたいで移動",()=>state.moveSource===block?cancelBlockMove():startBlockMove(block),"move-block"),copy=tool("コピー","ネストごとコピー",()=>startBlockCopy(block),"copy-block"),del=tool("削除","削除",()=>requestDeleteBlock(block),"delete-block");up.disabled=index===0;down.disabled=index===seqByPath(path).length-1;tools.append(up,down,move,copy,del);node.append(tools);return node;}',
    "copy-tool",
  );

  source = replaceOnce(
    source,
    'function startBlockMove(block){if(!findBlockLocation(block))return;state.moveSource=block;renderWorkspace({focusBlock:block,follow:false});toast(\'移動先の「ここへ移動」をタップしてください\');}\nfunction cancelBlockMove(){const block=state.moveSource;state.moveSource=null;renderWorkspace({focusBlock:block,follow:false});}',
    'function startBlockMove(block){if(!findBlockLocation(block))return;state.copySource=null;state.moveSource=block;renderWorkspace({focusBlock:block,follow:true});toast(\'移動先の「ここへ移動」をタップしてください\');}\nfunction startBlockCopy(block){if(!findBlockLocation(block))return;state.moveSource=null;state.copySource=deepClone(block);renderWorkspace({focusBlock:block,follow:true});toast(\'コピー先の「ここへコピー」をタップしてください\');}\nfunction cancelBlockMove(){const block=state.moveSource;state.moveSource=null;renderWorkspace({focusBlock:block,follow:false});}\nfunction cancelBlockCopy(){state.copySource=null;renderWorkspace();}\nfunction completeBlockCopy(targetSequence,targetIndex){if(!state.copySource||!Array.isArray(targetSequence))return;const copy=deepClone(state.copySource),at=Math.max(0,Math.min(Number(targetIndex)||0,targetSequence.length));targetSequence.splice(at,0,copy);state.copySource=null;markDraftChanged();setInsertionCursor(targetSequence,at+1);renderWorkspace({focusBlock:copy,follow:true});checkTutorialStructure();renderTutorial();}',
    "copy-functions-and-move-follow",
  );

  return source;
});

patch("public/now-coding/style-v7.css", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    '.insertion-slot.is-move-target{height:36px;min-height:36px;margin:4px 0;border:1px dashed rgba(88,230,246,.46);background:rgba(88,230,246,.055);color:var(--cyan);opacity:1;cursor:pointer}\n.insertion-slot.is-move-target:hover{height:44px;min-height:44px;background:rgba(88,230,246,.11);border-style:solid}',
    '.insertion-slot.is-move-target,.insertion-slot.is-copy-target{height:36px;min-height:36px;margin:4px 0;border:1px dashed rgba(88,230,246,.46);background:rgba(88,230,246,.055);color:var(--cyan);opacity:1;cursor:pointer}\n.insertion-slot.is-move-target:hover,.insertion-slot.is-copy-target:hover{height:44px;min-height:44px;background:rgba(88,230,246,.11);border-style:solid}',
    "copy-target-style",
  );
  source = replaceOnce(
    source,
    '.block-tools button{flex:0 0 auto!important;width:auto!important;min-width:38px;min-height:30px;padding:4px 8px!important}.block-tools .move-block{color:var(--cyan);border-color:rgba(88,230,246,.22)}',
    '.block-tools button{flex:0 0 auto!important;width:auto!important;min-width:38px;min-height:30px;padding:4px 8px!important}.block-tools .move-block,.block-tools .copy-block{color:var(--cyan);border-color:rgba(88,230,246,.22)}',
    "copy-button-style",
  );
  return source;
});

patch("tools/now-coding/client-contract.test.mjs", (input) => {
  const addition = `\n\ntest("tutorial resume restores code and prevents the highlighted expression from entering the wrong side", () => {\n  assert.match(app, /TUTORIAL_DRAFT_STORAGE="nowCodingTutorialDraftV1"/);\n  assert.match(app, /function persistTutorialDraft/);\n  assert.match(app, /function loadTutorialDraft/);\n  assert.match(app, /repairTutorialBlocks\\(cached\\?\\.blocks\\|\\|\\[\\],step\\)/);\n  assert.match(app, /tutorialExpressionSlotAllowed/);\n  assert.match(app, /tutorialAllowsExpressionTarget\\(key,n\\)/);\n  assert.match(app, /チュートリアルでは光っている側の空欄に入れてください/);\n});\n\ntest("block tools support nested copy placement and move mode follows its source immediately", () => {\n  assert.match(app, /copySource: null/);\n  assert.match(app, /copy=tool\\("コピー","ネストごとコピー"/);\n  assert.match(app, /function completeBlockCopy\\(targetSequence,targetIndex\\)/);\n  assert.match(app, /deepClone\\(state\\.copySource\\)/);\n  assert.match(app, /slot\\.textContent='ここへコピー'/);\n  assert.match(app, /function startBlockMove\\(block\\).*follow:true/s);\n  assert.match(css, /\\.insertion-slot\\.is-move-target,\\.insertion-slot\\.is-copy-target/);\n});\n`;
  if (input.includes('test("tutorial resume restores code')) throw new Error("client-tests-already-patched");
  return input + addition;
});

patch(".github/workflows/now-coding.yml", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    '          node --check public/now-coding/tutorials.js\n',
    '          node --check public/now-coding/tutorials.js\n          node --check public/now-coding/tutorial-recovery.js\n',
    "tutorial-recovery-syntax",
  );
  source = replaceOnce(
    source,
    'run: node --test tools/now-coding/engine.test.mjs tools/now-coding/client-contract.test.mjs tools/now-coding/board-spawn.test.mjs tools/now-coding/fall-timed-collapse.test.mjs',
    'run: node --test tools/now-coding/engine.test.mjs tools/now-coding/client-contract.test.mjs tools/now-coding/board-spawn.test.mjs tools/now-coding/fall-timed-collapse.test.mjs tools/now-coding/tutorial-recovery.test.mjs',
    "tutorial-recovery-ci",
  );
  return source;
});
