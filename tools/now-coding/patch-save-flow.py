from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern: {label} in {path}")
    p.write_text(text.replace(old, new, 1))


# Track the last loaded/saved draft and named-save intent.
replace_once(
    "public/now-coding/app-v3.js",
    '  drag: null, suppressClickUntil: 0, optionalTutorial: null, tutorialFinalPassed: false, tutorialModalKey: "", pendingExpressionPreset: "", testMode: "territory", testNpcEnabled: false, testNpcType: "intermediate", testBoardShape: "square", testBoardSizeKey: "small", testRollSeed: "test-initial", testSpawnMode: "random", testSpawnActor: "me", testFixedSpawns: { me:{x:4,y:7,dir:1}, npc:{x:10,y:7,dir:3} }, testGame: null,',
    '  drag: null, suppressClickUntil: 0, optionalTutorial: null, tutorialFinalPassed: false, tutorialModalKey: "", pendingExpressionPreset: "", testMode: "territory", testNpcEnabled: false, testNpcType: "intermediate", testBoardShape: "square", testBoardSizeKey: "small", testRollSeed: "test-initial", testSpawnMode: "random", testSpawnActor: "me", testFixedSpawns: { me:{x:4,y:7,dir:1}, npc:{x:10,y:7,dir:3} }, testGame: null, draftBaseline: "", saveModalMode: "new", pendingAfterSave: null,',
    "draft save state",
)

old_draft = '''function newDraft(){state.draft={programId:"",name:"新しい駒",blocks:[]};renderWorkspace();}\nfunction openProgram(id){const p=state.programs.find(x=>x.programId===id);if(!p)return;state.draft={programId:p.programId,name:p.name,blocks:deepClone(p.blocks||[])};state.selectedProgramId=p.programId;showView("editor",true);}\n'''
new_draft = '''function draftSignature(draft=state.draft){return JSON.stringify({programId:String(draft?.programId||""),name:String(draft?.name||""),blocks:draft?.blocks||[]});}\nfunction updateSaveActions(){const existing=Boolean(state.draft?.programId);$("#saveProgramButton")?.classList.toggle("is-hidden",existing);$("#overwriteProgramButton")?.classList.toggle("is-hidden",!existing);$("#saveAsNewProgramButton")?.classList.toggle("is-hidden",!existing);}\nfunction markDraftSaved(){state.draftBaseline=draftSignature();updateSaveActions();}\nfunction isDraftDirty(){return state.draftBaseline!==draftSignature();}\nfunction newDraft(){state.draft={programId:"",name:"新しい駒",blocks:[]};markDraftSaved();renderWorkspace();}\nfunction openProgram(id){const p=state.programs.find(x=>x.programId===id);if(!p)return;state.draft={programId:p.programId,name:p.name,blocks:deepClone(p.blocks||[])};state.selectedProgramId=p.programId;markDraftSaved();showView("editor",true);}\n'''
replace_once("public/now-coding/app-v3.js", old_draft, new_draft, "draft snapshot helpers")

old_save = '''function openSave(){if(!state.user){toast("ログイン情報を取得できていません");setModal("#authModal",true);return;}if(isTutorial()&&!state.tutorialFinalPassed){toast("最後にテストを成功させてください");return;}$("#saveProgramName").value=state.draft.name==="新しい駒"?"":state.draft.name;$("#saveProgramError").textContent="";setModal("#saveProgramModal",true);}\nasync function saveDraft(){if(!state.user){$("#saveProgramError").textContent="ログイン情報を取得できていません。";return;}const name=$("#saveProgramName").value.trim();if(!name){$("#saveProgramError").textContent="駒の名前を入力してください。";return;}try{const d=await api("/api/now-coding/programs",{method:"POST",body:JSON.stringify({userTrackingId:state.user.userTrackingId,programId:state.draft.programId,name,blocks:state.draft.blocks})});const ix=state.programs.findIndex(p=>p.programId===d.program.programId);if(ix>=0)state.programs[ix]=d.program;else state.programs.unshift(d.program);state.selectedProgramId=d.program.programId;state.draft={programId:d.program.programId,name:d.program.name,blocks:deepClone(d.program.blocks)};setModal("#saveProgramModal",false);if(isTutorial())await tutorialProgress(TUTORIAL_STEPS.length,true);renderHome();renderProgramChoices();toast("駒を保存しました");showView("home",true);}catch(e){$("#saveProgramError").textContent=e.message==="program_too_large"?"コードが大きすぎます。":"保存に失敗しました。";}}\n'''
new_save = '''function canSaveDraft(){if(!state.user){toast("ログイン情報を取得できていません");setModal("#authModal",true);return false;}if(isTutorial()&&!state.tutorialFinalPassed){toast("最後にテストを成功させてください");return false;}return true;}\nfunction openNamedSave(asNew=false,afterSave=null){if(!canSaveDraft())return;state.saveModalMode=asNew?"copy":"new";state.pendingAfterSave=afterSave;$("#saveProgramName").value=asNew?"":(state.draft.name==="新しい駒"?"":state.draft.name);$("#saveProgramError").textContent="";setModal("#saveProgramModal",true);}\nfunction closeNamedSave(){state.pendingAfterSave=null;state.saveModalMode="new";setModal("#saveProgramModal",false);}\nfunction openSave(){if(state.draft.programId)return void overwriteDraft();openNamedSave(false);}\nfunction openSaveAsNew(){openNamedSave(true);}\nasync function persistDraft({programId,name,closeModal=false,afterSave=null}={}){if(!state.user)return false;try{const d=await api("/api/now-coding/programs",{method:"POST",body:JSON.stringify({userTrackingId:state.user.userTrackingId,programId:programId||"",name,blocks:state.draft.blocks})});const ix=state.programs.findIndex(p=>p.programId===d.program.programId);if(ix>=0)state.programs[ix]=d.program;else state.programs.unshift(d.program);state.selectedProgramId=d.program.programId;state.draft={programId:d.program.programId,name:d.program.name,blocks:deepClone(d.program.blocks)};markDraftSaved();const next=afterSave||state.pendingAfterSave;state.pendingAfterSave=null;state.saveModalMode="new";if(closeModal)setModal("#saveProgramModal",false);if(isTutorial())await tutorialProgress(TUTORIAL_STEPS.length,true);renderHome();renderProgramChoices();renderWorkspace();toast("駒を保存しました");if(next){next();return true;}if(isTutorial())showView("home",true);return true;}catch(e){const message=e.message==="program_too_large"?"コードが大きすぎます。":"保存に失敗しました。";if(closeModal)$("#saveProgramError").textContent=message;else toast(message);return false;}}\nasync function overwriteDraft(afterSave=null){if(!canSaveDraft())return false;if(!state.draft.programId){openNamedSave(false,afterSave);return false;}return persistDraft({programId:state.draft.programId,name:state.draft.name,afterSave});}\nasync function saveDraft(){if(!state.user){$("#saveProgramError").textContent="ログイン情報を取得できていません。";return;}const name=$("#saveProgramName").value.trim();if(!name){$("#saveProgramError").textContent="駒の名前を入力してください。";return;}const programId=state.saveModalMode==="copy"?"":(state.draft.programId||"");await persistDraft({programId,name,closeModal:true});}\nfunction discardDraftChanges(){const saved=state.draft.programId?state.programs.find(p=>p.programId===state.draft.programId):null;state.draft=saved?{programId:saved.programId,name:saved.name,blocks:deepClone(saved.blocks||[])}:{programId:"",name:"新しい駒",blocks:[]};markDraftSaved();renderWorkspace();}\nfunction requestUnsavedAction(action){if(state.view!=="editor"||!isDraftDirty()){action();return;}document.querySelectorAll(".unsaved-code-overlay").forEach(n=>n.remove());const o=document.createElement("div");o.className="expression-overlay info-overlay unsaved-code-overlay";o.innerHTML=`<div class="expression-card info-card unsaved-code-card"><small>未保存のコードがあります</small><h3>コードを保存しますか？</h3><p>コードの保存が出来ていません。<br>このページから移動してもよろしいですか？</p><div class="unsaved-code-actions"><button class="primary-button" type="button" data-save-move>保存して移動</button><button class="secondary-button" type="button" data-discard-move>保存せず移動</button><button class="text-button" type="button" data-cancel-move>キャンセル</button></div></div>`;o.querySelector("[data-save-move]").onclick=async()=>{o.remove();if(state.draft.programId)await overwriteDraft(action);else openNamedSave(false,action);};o.querySelector("[data-discard-move]").onclick=()=>{o.remove();discardDraftChanges();action();};o.querySelector("[data-cancel-move]").onclick=()=>o.remove();o.onclick=e=>{if(e.target===o)o.remove();};document.body.append(o);}\n'''
replace_once("public/now-coding/app-v3.js", old_save, new_save, "save and unsaved flow")

# Internal user navigation, new-draft replacement, logout and menu history use the unsaved guard.
replace_once(
    "public/now-coding/app-v3.js",
    'document.addEventListener("click",e=>{const go=e.target.closest("[data-go]");if(go&&!go.disabled)showView(go.dataset.go);});',
    'document.addEventListener("click",e=>{const go=e.target.closest("[data-go]");if(go&&!go.disabled){const target=go.dataset.go;if(target===state.view)return;requestUnsavedAction(()=>showView(target));}});',
    "data-go unsaved guard",
)
replace_once(
    "public/now-coding/app-v3.js",
    '$("#newProgramButton").onclick=newDraft;$("#saveProgramButton").onclick=openSave;$("#confirmSaveProgram").onclick=saveDraft;$("#cancelSaveProgram").onclick=()=>setModal("#saveProgramModal",false);',
    '$("#newProgramButton").onclick=()=>requestUnsavedAction(newDraft);$("#saveProgramButton").onclick=openSave;$("#overwriteProgramButton").onclick=()=>overwriteDraft();$("#saveAsNewProgramButton").onclick=openSaveAsNew;$("#confirmSaveProgram").onclick=saveDraft;$("#cancelSaveProgram").onclick=closeNamedSave;',
    "save button bindings",
)
replace_once(
    "public/now-coding/app-v3.js",
    '$("#logoutButton").onclick=()=>{setMenu(false);setUser(null);setModal("#authModal",true);initGoogle()};',
    '$("#logoutButton").onclick=()=>requestUnsavedAction(()=>{setMenu(false);setUser(null);setModal("#authModal",true);initGoogle()});',
    "logout unsaved guard",
)
replace_once(
    "public/now-coding/app-v3.js",
    'if(a==="history")showView("home",true);',
    'if(a==="history")requestUnsavedAction(()=>showView("home",true));',
    "history unsaved guard",
)
replace_once(
    "public/now-coding/app-v3.js",
    'async function init(){bindEvents();newDraft();renderModeRail(false);',
    'async function init(){window.addEventListener("beforeunload",e=>{if(!isDraftDirty())return;e.preventDefault();e.returnValue="";});bindEvents();newDraft();renderModeRail(false);',
    "beforeunload guard",
)

# Save controls: a new draft has one Save button; existing drafts reveal overwrite + save-as-new.
replace_once(
    "public/now-coding/index.html",
    '''          <div class="editor-actions">\n            <button id="newProgramButton" class="secondary-button compact" type="button">新規</button>\n            <button id="saveProgramButton" class="primary-button compact" type="button">保存</button>\n          </div>''',
    '''          <div class="editor-actions">\n            <button id="newProgramButton" class="secondary-button compact" type="button">新規</button>\n            <button id="saveProgramButton" class="primary-button compact" type="button">保存</button>\n            <button id="overwriteProgramButton" class="primary-button compact is-hidden" type="button">上書き保存</button>\n            <button id="saveAsNewProgramButton" class="secondary-button compact is-hidden" type="button">新規保存</button>\n          </div>''',
    "editor save buttons",
)

style = Path("public/now-coding/style-v7.css")
css = style.read_text()
addition = '''\n/* Existing-program save actions and unsaved-navigation confirmation. */\n.editor-actions{flex-wrap:wrap;justify-content:flex-end}\n.unsaved-code-card{max-width:440px}.unsaved-code-card p{line-height:1.7}.unsaved-code-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.unsaved-code-actions [data-cancel-move]{grid-column:1/-1;justify-self:center}\n@media(max-width:430px){.editor-actions{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.editor-actions .compact{min-width:0}.unsaved-code-actions{grid-template-columns:1fr}.unsaved-code-actions [data-cancel-move]{grid-column:auto;justify-self:stretch}}\n'''
if 'unsaved-code-actions' not in css:
    style.write_text(css.rstrip() + addition)

# Client contract regression coverage.
client = Path("tools/now-coding/client-contract.test.mjs")
ct = client.read_text()
append = r'''

test("existing programs expose overwrite and save-as-new without renaming overwrite", () => {
  assert.ok(htmlHasId("overwriteProgramButton"));
  assert.ok(htmlHasId("saveAsNewProgramButton"));
  assert.match(html, /id="overwriteProgramButton"[^>]*>上書き保存<\/button>/);
  assert.match(html, /id="saveAsNewProgramButton"[^>]*>新規保存<\/button>/);
  assert.match(app, /function overwriteDraft\(afterSave=null\)/);
  assert.match(app, /programId:state\.draft\.programId,name:state\.draft\.name/);
  assert.match(app, /state\.saveModalMode==="copy"\?"":/);
});

test("dirty code is guarded on internal navigation and browser unload", () => {
  assert.match(app, /function draftSignature/);
  assert.match(app, /function isDraftDirty/);
  assert.match(app, /function requestUnsavedAction/);
  assert.ok(app.includes("コードの保存が出来ていません。"));
  assert.ok(app.includes("このページから移動してもよろしいですか？"));
  for (const label of ["保存して移動","保存せず移動","キャンセル"]) assert.ok(app.includes(label));
  assert.match(app, /beforeunload/);
  assert.match(app, /e\.returnValue=""/);
  assert.match(app, /requestUnsavedAction\(\(\)=>showView\(target\)\)/);
  assert.match(app, /requestUnsavedAction\(newDraft\)/);
});
'''
if 'test("existing programs expose overwrite and save-as-new without renaming overwrite"' not in ct:
    client.write_text(ct.rstrip() + append + "\n")

print("save flow patch applied")
