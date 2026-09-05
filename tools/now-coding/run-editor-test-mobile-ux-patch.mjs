import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

function replaceOnce(source,from,to,label){
  const i=source.indexOf(from);
  if(i<0)throw new Error(`missing ${label}`);
  return source.slice(0,i)+to+source.slice(i+from.length);
}

const sourcePath='tools/now-coding/apply-editor-test-mobile-ux.mjs';
let source=fs.readFileSync(sourcePath,'utf8');
const bad="app=replaceRegex(app,/function runTest\\(\\)\\{.*?\\}/s,'function runTest(){startTestPlayback();}','legacy run alias');";
const good="app=replaceOnce(app,'function runTest(){if(state.testSession){resetTestSessionToCurrentDraft();startTestPlayback();return;}prepareFreshTestSession(true);}','function runTest(){startTestPlayback();}','legacy run alias');";
if(!source.includes(bad))throw new Error('missing legacy run alias patch');
source=source.replace(bad,good);
const temp='tools/now-coding/.apply-editor-test-mobile-ux.runtime.mjs';
fs.writeFileSync(temp,source);
try{await import(pathToFileURL(process.cwd()+'/'+temp).href+'?v='+Date.now());}
finally{fs.rmSync(temp,{force:true});}

const appPath='public/now-coding/app-v3.js';
let app=fs.readFileSync(appPath,'utf8');
app=replaceOnce(app,
  'function decorateMobilePaletteDragHandles(){const host=$("#mobilePaletteContent");if(!host)return;$$(`[data-add-block],[data-expression-preset],[data-recent-command]`,host).forEach(n=>{n.classList.add("mobile-draggable-command");n.setAttribute("aria-description","右端のハンドルをドラッグすると配置場所を選べます");});}',
  'function decorateMobilePaletteDragHandles(){const host=$("#mobilePaletteContent");if(!host)return;$$(`[data-add-block],[data-expression-preset],[data-recent-command]`,host).forEach(n=>{n.classList.add("mobile-draggable-command");n.setAttribute("aria-description","右端のハンドルをドラッグすると配置場所を選べます");if(!n.querySelector(".mobile-command-drag-handle")){const h=document.createElement("span");h.className="mobile-command-drag-handle";h.textContent="⠿";h.setAttribute("aria-hidden","true");n.append(h);}});}',
  'real mobile drag handles');
app=replaceOnce(app,
  'function startMobilePalettePointer(event){if(event.pointerType===\'mouse\'||event.button!==0||event.target.closest(\'select,input,[data-command-help]\'))return;const command=event.target.closest?.(\'[data-add-block],[data-expression-preset],[data-recent-command]\');if(!command)return;const rect=command.getBoundingClientRect();if(event.clientX<rect.right-50)return;const key=commandKeyFromMobileTarget(command);if(key)startTouchCommandDrag(event,key,true,true);}',
  'function startMobilePalettePointer(event){if(event.pointerType===\'mouse\'||event.button!==0||event.target.closest(\'select,input,[data-command-help]\'))return;if(!event.target.closest?.(\'.mobile-command-drag-handle\'))return;const command=event.target.closest?.(\'[data-add-block],[data-expression-preset],[data-recent-command]\');if(!command)return;event.preventDefault();const key=commandKeyFromMobileTarget(command);if(key)startTouchCommandDrag(event,key,true,true);}',
  'handle-only pointer start');
app=replaceOnce(app,
  'function testHasRerollableSettings(c=effectiveTestConfig()){return c.boardShape==="random"||c.boardSizeKey==="random"||c.spawnMode==="random"||(c.npcCount>0&&c.npcType==="random");}',
  'function testHasRerollableSettings(c=effectiveTestConfig()){return c.boardShape==="random"||c.boardSizeKey==="random"||c.spawnMode==="random"||c.spawnMode==="battle";}',
  'rerollable test settings');
fs.writeFileSync(appPath,app);

const cssPath='public/now-coding/style-v7.css';
let css=fs.readFileSync(cssPath,'utf8');
css=replaceOnce(css,
  '.mobile-palette-content .mobile-draggable-command::after{content:"⠿";position:absolute;right:5px;top:50%;transform:translateY(-50%);width:40px;height:calc(100% - 8px);display:flex;align-items:center;justify-content:center;border-left:1px solid rgba(88,230,246,.18);color:rgba(88,230,246,.82);font-size:20px;line-height:1;pointer-events:none}',
  '.mobile-command-drag-handle{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:40px;height:calc(100% - 8px);display:flex;align-items:center;justify-content:center;border-left:1px solid rgba(88,230,246,.18);color:rgba(88,230,246,.82);font-size:20px;line-height:1;touch-action:none;user-select:none;-webkit-user-select:none}',
  'mobile drag handle css');
fs.writeFileSync(cssPath,css);

const clientPath='tools/now-coding/client-contract.test.mjs';
let client=fs.readFileSync(clientPath,'utf8');
client=client.replace("assert.ok(app.includes('TEST_BASE_DELAY_MS=120'));","assert.match(app,/TEST_BASE_DELAY_MS\\s*=\\s*120/);");
client=client.replace("assert.ok(app.includes('markDraftChanged(){state.draftDirty=true;persistTutorialDraft();scheduleTestResetAfterDraftChange();}'));","assert.match(app,/function markDraftChanged\\(\\)\\{[^\\n]*scheduleTestResetAfterDraftChange\\(\\);[^\\n]*\\}/);");
client=client.replace("  assert.ok(!app.includes('if(!isTutorial()&&(c.spawnMode==\"random\"'));","  const prepareStart=app.indexOf('function prepareFreshTestSession(');\n  const prepareEnd=app.indexOf('\\nfunction finishTestFromGame',prepareStart);\n  assert.ok(prepareStart>=0&&prepareEnd>prepareStart);\n  assert.ok(!app.slice(prepareStart,prepareEnd).includes('freshSeed()'));");
client=client.replace("  assert.ok(app.includes('rect.right-50'));","  assert.ok(app.includes(\"event.target.closest?.('.mobile-command-drag-handle')\"));");
client=client.replace("  assert.ok(css.includes('.mobile-draggable-command::after'));","  assert.ok(css.includes('.mobile-command-drag-handle'));\n  assert.ok(css.includes('touch-action:none'));");
fs.writeFileSync(clientPath,client);
