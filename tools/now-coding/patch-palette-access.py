from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern: {label} in {path}")
    p.write_text(text.replace(old, new, 1))


# HTML: add a closed Recent Commands category and mobile palette controls.
replace_once(
    "public/now-coding/index.html",
    '            <div id="paletteScroll" class="palette-scroll palette-accordion">\n              <details class="palette-section" open>',
    '''            <div id="paletteScroll" class="palette-scroll palette-accordion">\n              <details id="recentPaletteSection" class="palette-section recent-palette-section">\n                <summary><span class="palette-dot recent"></span>最近使った命令</summary>\n                <div id="recentPaletteItems" class="palette-items recent-palette-items"><small class="recent-palette-empty">まだ使った命令はありません。</small></div>\n              </details>\n              <details class="palette-section" open>''',
    "recent palette section",
)

replace_once(
    "public/now-coding/index.html",
    "  </main>\n",
    '''  </main>\n\n  <button id="mobilePaletteButton" class="mobile-palette-fab" type="button" aria-expanded="false" aria-controls="mobilePaletteSheet" hidden>＋ 命令を追加</button>\n  <div id="mobilePaletteBackdrop" class="mobile-palette-backdrop" aria-hidden="true"></div>\n  <section id="mobilePaletteSheet" class="mobile-palette-sheet" aria-hidden="true" aria-label="命令を追加">\n    <div class="mobile-palette-handle" aria-hidden="true"></div>\n    <div class="mobile-palette-heading"><div><small>現在のコード位置を維持したまま</small><strong>命令を追加</strong></div><button id="mobilePaletteClose" class="icon-button" type="button" aria-label="命令パレットを閉じる">×</button></div>\n    <div id="mobilePaletteContent" class="mobile-palette-content"></div>\n  </section>\n''',
    "mobile palette controls",
)

# JS helpers: recent command history + mobile palette proxy.
anchor = 'function setModal(sel, open) { const n=$(sel); if (n) n.setAttribute("aria-hidden", open ? "false" : "true"); }\n'
helpers = r'''
const RECENT_COMMAND_LIMIT=6;
const RECENT_COMMAND_STORAGE="nowCodingRecentCommandsV1";
const RECENT_COMMAND_META={
  "block:move":["進む","action"],"block:turn":["旋回","action"],"block:attack":["攻撃","action"],
  "block:forever":["ずっと","control"],"block:while":["○○ならずっと","control"],"block:repeat":["○回 繰り返す","control"],"block:break":["ループを抜ける","control"],
  "block:if":["もし ○○ なら","condition"],"block:setVar":["変数を設定","variable"],"block:changeVar":["変数を増減","variable"],
  "expr:compare":["＜ 比較 ＞","condition"],"expr:logic":["＜ 条件 かつ/または 条件 ＞","condition"],"expr:not":["＜ 条件ではない ＞","condition"],
  "expr:sensor":["（前・左・右）","number"],"expr:cellState":["（マスの状態）","number"],"expr:enemyDistance":["最も近い敵との距離","number"],
  "expr:number":["数字","number"],"expr:var":["変数の値","number"],"expr:random":["乱数","number"],"expr:math":["計算","number"]
};
function loadRecentCommands(){try{const x=JSON.parse(localStorage.getItem(RECENT_COMMAND_STORAGE)||"[]");return Array.isArray(x)?x.filter(k=>RECENT_COMMAND_META[k]).slice(0,RECENT_COMMAND_LIMIT):[];}catch{return[];}}
function paletteCommandKey(node){if(!node)return"";if(node.dataset.addBlock)return`block:${node.dataset.addBlock}`;if(node.dataset.expressionPreset)return`expr:${node.dataset.expressionPreset}`;return"";}
function originalPaletteCommand(key){const [kind,value]=String(key).split(":");if(kind==="block")return document.querySelector(`#paletteScroll [data-add-block="${value}"]`);if(kind==="expr")return document.querySelector(`#paletteScroll [data-expression-preset="${value}"]`);return null;}
function renderRecentCommands(){const host=$("#recentPaletteItems");if(!host)return;host.innerHTML="";const list=state.recentCommands||[];if(!list.length){const e=document.createElement("small");e.className="recent-palette-empty";e.textContent="まだ使った命令はありません。";host.append(e);return;}for(const key of list){const meta=RECENT_COMMAND_META[key];if(!meta)continue;const b=document.createElement("button");b.type="button";b.className=`palette-block recent-command recent-${meta[1]}`;b.dataset.recentCommand=key;b.textContent=meta[0];host.append(b);}}
function recordRecentCommand(key){if(!RECENT_COMMAND_META[key])return;const next=[key,...(state.recentCommands||[]).filter(x=>x!==key)].slice(0,RECENT_COMMAND_LIMIT);state.recentCommands=next;try{localStorage.setItem(RECENT_COMMAND_STORAGE,JSON.stringify(next));}catch{}renderRecentCommands();}
function useRecentCommand(key){const source=originalPaletteCommand(key);if(source)source.click();}
function updateMobilePaletteAvailability(){const b=$("#mobilePaletteButton");if(b)b.hidden=state.view!=="editor";}
function buildMobilePalette(){const source=$("#paletteScroll"),host=$("#mobilePaletteContent");if(!source||!host)return;host.innerHTML="";const clone=source.cloneNode(true);clone.removeAttribute("id");clone.querySelectorAll("[id]").forEach(n=>n.removeAttribute("id"));host.append(clone);}
function setMobilePalette(open){const sheet=$("#mobilePaletteSheet"),backdrop=$("#mobilePaletteBackdrop"),button=$("#mobilePaletteButton");if(!sheet||!backdrop||!button)return;if(open){buildMobilePalette();}sheet.setAttribute("aria-hidden",open?"false":"true");backdrop.setAttribute("aria-hidden",open?"false":"true");button.setAttribute("aria-expanded",open?"true":"false");document.body.classList.toggle("mobile-palette-open",Boolean(open));}
function proxyMobilePaletteClick(event){if(event.target.closest("select"))return;const help=event.target.closest("[data-command-help]");if(help){document.querySelector(`#paletteScroll [data-command-help="${help.dataset.commandHelp}"]`)?.click();setMobilePalette(false);return;}const recent=event.target.closest("[data-recent-command]");if(recent){useRecentCommand(recent.dataset.recentCommand);setMobilePalette(false);return;}const command=event.target.closest("[data-add-block],[data-expression-preset]");if(!command)return;const key=paletteCommandKey(command),source=originalPaletteCommand(key);if(source){source.click();setMobilePalette(false);}}
function syncMobilePaletteOption(event){const control=event.target.closest("[data-palette-option]");if(!control)return;const key=control.dataset.paletteOption,source=document.querySelector(`#paletteScroll [data-palette-option="${key}"]`);if(!source)return;source.value=control.value;source.dispatchEvent(new Event("change",{bubbles:true}));}
function bindPaletteEnhancements(){state.recentCommands=loadRecentCommands();renderRecentCommands();const palette=$("#paletteScroll");if(palette){const remember=e=>{if(e.target.closest("select,[data-command-help],[data-recent-command]"))return;const command=e.target.closest("[data-add-block],[data-expression-preset]");const key=paletteCommandKey(command);if(key)recordRecentCommand(key);};palette.addEventListener("click",e=>{const recent=e.target.closest("[data-recent-command]");if(recent){e.preventDefault();e.stopPropagation();useRecentCommand(recent.dataset.recentCommand);return;}remember(e);});palette.addEventListener("dragstart",remember);}
  $("#mobilePaletteButton")?.addEventListener("click",()=>setMobilePalette(true));
  $("#mobilePaletteClose")?.addEventListener("click",()=>setMobilePalette(false));
  $("#mobilePaletteBackdrop")?.addEventListener("click",()=>setMobilePalette(false));
  $("#mobilePaletteContent")?.addEventListener("click",proxyMobilePaletteClick);
  $("#mobilePaletteContent")?.addEventListener("change",syncMobilePaletteOption);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("mobile-palette-open"))setMobilePalette(false);});
  updateMobilePaletteAvailability();
}
'''
replace_once("public/now-coding/app-v3.js", anchor, anchor + helpers, "palette enhancement helpers")

replace_once(
    "public/now-coding/app-v3.js",
    'function showView(name,force=false){',
    'function showView(name,force=false){setMobilePalette(false);',
    "close mobile palette on navigation",
)
replace_once(
    "public/now-coding/app-v3.js",
    'if(name==="editor")renderWorkspace();if(name==="battle")resetBattleSetup();renderTutorial();window.scrollTo({top:0,behavior:"smooth"});}',
    'if(name==="editor")renderWorkspace();if(name==="battle")resetBattleSetup();updateMobilePaletteAvailability();renderTutorial();window.scrollTo({top:0,behavior:"smooth"});}',
    "mobile palette view visibility",
)
replace_once(
    "public/now-coding/app-v3.js",
    'bindEvents();newDraft();renderModeRail(false);',
    'bindEvents();bindPaletteEnhancements();newDraft();renderModeRail(false);',
    "palette enhancements init",
)

# CSS: desktop sticky palette + mobile fixed launcher/bottom sheet.
style=Path("public/now-coding/style-v7.css")
css=style.read_text()
addition=r'''

/* Long-program navigation: keep commands within reach without changing code scroll position. */
@media (min-width: 761px){
  .editor-layout-v3 .block-palette{position:sticky;top:70px;align-self:start;max-height:calc(100vh - 86px);overflow:hidden}
  .editor-layout-v3 .block-palette .palette-scroll{max-height:calc(100vh - 132px);overflow-y:auto;overscroll-behavior:contain;padding-right:3px}
}
.palette-dot.recent{background:currentColor;box-shadow:0 0 10px currentColor;opacity:.78}
.recent-palette-empty{display:block;padding:9px 10px;color:var(--muted,#81909d);line-height:1.5}
.recent-command{justify-content:flex-start;text-align:left}
.recent-command.recent-action{border-color:rgba(55,211,255,.28)}
.recent-command.recent-control{border-color:rgba(171,112,255,.32)}
.recent-command.recent-condition{border-color:rgba(90,238,157,.3)}
.recent-command.recent-number{border-color:rgba(255,201,92,.3)}
.recent-command.recent-variable{border-color:rgba(255,130,190,.28)}
.mobile-palette-fab,.mobile-palette-sheet,.mobile-palette-backdrop{display:none}
@media (max-width:760px){
  .mobile-palette-fab:not([hidden]){display:flex;position:fixed;z-index:72;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);align-items:center;justify-content:center;min-width:178px;min-height:48px;padding:10px 18px;border:1px solid rgba(65,225,255,.38);border-radius:999px;background:rgba(8,16,24,.94);color:#f4fbff;font:inherit;font-weight:800;letter-spacing:.02em;box-shadow:0 12px 34px rgba(0,0,0,.48),0 0 20px rgba(55,211,255,.15);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
  .mobile-palette-fab[aria-expanded="true"]{opacity:0;pointer-events:none}
  .mobile-palette-backdrop{display:block;position:fixed;z-index:78;inset:0;background:rgba(0,0,0,.55);opacity:0;pointer-events:none;transition:opacity .18s ease}
  .mobile-palette-backdrop[aria-hidden="false"]{opacity:1;pointer-events:auto}
  .mobile-palette-sheet{display:flex;position:fixed;z-index:79;left:0;right:0;bottom:0;max-height:min(76vh,680px);flex-direction:column;padding:7px 12px calc(12px + env(safe-area-inset-bottom));border:1px solid rgba(255,255,255,.09);border-bottom:0;border-radius:22px 22px 0 0;background:rgba(8,13,19,.985);box-shadow:0 -20px 50px rgba(0,0,0,.5);transform:translateY(105%);transition:transform .22s ease;pointer-events:none}
  .mobile-palette-sheet[aria-hidden="false"]{transform:translateY(0);pointer-events:auto}
  .mobile-palette-handle{width:42px;height:4px;margin:2px auto 8px;border-radius:99px;background:rgba(255,255,255,.2)}
  .mobile-palette-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 2px 10px}.mobile-palette-heading>div{display:grid;gap:2px}.mobile-palette-heading small{color:var(--muted,#81909d);font-size:11px}.mobile-palette-heading strong{font-size:18px}.mobile-palette-heading .icon-button{flex:0 0 auto}
  .mobile-palette-content{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:4px}.mobile-palette-content .palette-scroll{display:grid;gap:8px;max-height:none;overflow:visible}.mobile-palette-content .palette-section{min-width:0}.mobile-palette-content .palette-items{grid-template-columns:1fr 1fr}.mobile-palette-content .palette-block{min-width:0}
  body.mobile-palette-open{overflow:hidden}
}
@media (prefers-reduced-motion:reduce){.mobile-palette-sheet,.mobile-palette-backdrop{transition:none}}
'''
if "Long-program navigation" not in css:
    style.write_text(css.rstrip()+addition+"\n")

# Client contract tests.
client=Path("tools/now-coding/client-contract.test.mjs")
ct=client.read_text()
tests=r'''

test("long programs keep command access available on desktop and mobile", () => {
  assert.match(css, /editor-layout-v3 \.block-palette\{position:sticky/);
  assert.ok(htmlHasId("mobilePaletteButton"));
  assert.ok(htmlHasId("mobilePaletteSheet"));
  assert.ok(htmlHasId("mobilePaletteContent"));
  assert.ok(html.includes("＋ 命令を追加"));
  assert.match(app, /function setMobilePalette\(open\)/);
  assert.match(app, /function proxyMobilePaletteClick/);
});

test("recent commands are a closed persistent palette category", () => {
  assert.match(html, /<details id="recentPaletteSection" class="palette-section recent-palette-section">/);
  assert.doesNotMatch(html, /<details id="recentPaletteSection"[^>]*\sopen(?:\s|>)/);
  assert.ok(htmlHasId("recentPaletteItems"));
  assert.ok(html.includes("最近使った命令"));
  assert.match(app, /RECENT_COMMAND_STORAGE="nowCodingRecentCommandsV1"/);
  assert.match(app, /RECENT_COMMAND_LIMIT=6/);
  assert.match(app, /function recordRecentCommand/);
  assert.match(app, /localStorage\.setItem\(RECENT_COMMAND_STORAGE/);
});

test("mobile palette proxies existing commands instead of creating a second language implementation", () => {
  assert.match(app, /function originalPaletteCommand\(key\)/);
  assert.match(app, /source\.click\(\)/);
  assert.match(app, /source\.dispatchEvent\(new Event\("change",\{bubbles:true\}\)\)/);
  assert.doesNotMatch(app, /mobileCommandFactory|createMobileBlock/);
});
'''
if 'test("long programs keep command access available on desktop and mobile"' not in ct:
    client.write_text(ct.rstrip()+tests+"\n")

print("palette access patch applied")
