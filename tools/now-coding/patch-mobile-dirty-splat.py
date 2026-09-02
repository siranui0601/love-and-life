from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern: {label} in {path}")
    p.write_text(text.replace(old, new, 1))

app = "public/now-coding/app-v3.js"

# Explicit dirty flag in addition to structural signature comparison.
replace_once(
    app,
    'testGame: null, draftBaseline: "", saveModalMode: "new", pendingAfterSave: null,',
    'testGame: null, draftBaseline: "", draftDirty: false, saveModalMode: "new", pendingAfterSave: null,',
    "dirty state",
)
replace_once(
    app,
    'function markDraftSaved(){state.draftBaseline=draftSignature();updateSaveActions();}\nfunction isDraftDirty(){return state.draftBaseline!==draftSignature();}',
    'function markDraftChanged(){state.draftDirty=true;}\nfunction markDraftSaved(){state.draftBaseline=draftSignature();state.draftDirty=false;updateSaveActions();}\nfunction isDraftDirty(){return Boolean(state.draftDirty)||state.draftBaseline!==draftSignature();}',
    "dirty helpers",
)

# Expression inputs must mutate their existing object without rebuilding parent DOM.
replace_once(
    app,
    'i.addEventListener("input",()=>{expr.value=Number(i.value)||0;change(expr,false)})',
    'i.addEventListener("input",()=>{expr.value=Number(i.value)||0;markDraftChanged()})',
    "number input focus stability",
)
replace_once(
    app,
    'i.addEventListener("input",()=>{expr.name=i.value.slice(0,40);change(expr,false)})',
    'i.addEventListener("input",()=>{expr.name=i.value.slice(0,40);markDraftChanged()})',
    "expression variable input focus stability",
)
replace_once(
    app,
    'function commitExpression(onChange,expr,rerender=true){onChange(expr);checkTutorialStructure();renderTutorial();if(rerender)renderWorkspace();}',
    'function commitExpression(onChange,expr,rerender=true){markDraftChanged();onChange(expr);checkTutorialStructure();renderTutorial();if(rerender)renderWorkspace();}',
    "expression dirty state",
)
replace_once(
    app,
    'function strong(t){const s=document.createElement("strong");s.textContent=t;return s;}function badge(t){const b=document.createElement("small");b.className="mode-badge";b.textContent=t;return b;}function branchWrap(label,seq,path){const f=document.createDocumentFragment();const l=document.createElement("div");l.className="branch-label";l.textContent=label;f.append(l,renderSequence(seq,path));return f;}function tool(text,title,fn,klass=""){const b=document.createElement("button");b.type="button";b.textContent=text;b.title=title;if(klass)b.className=klass;b.onclick=fn;return b;}function varInput(obj,key){const i=document.createElement("input");i.className="typed-input socket-variable";i.value=obj[key]||"value";i.maxLength=40;i.oninput=()=>obj[key]=i.value;return i;}',
    'function strong(t){const s=document.createElement("strong");s.textContent=t;return s;}function badge(t){const b=document.createElement("small");b.className="mode-badge";b.textContent=t;return b;}function branchWrap(label,seq,path){const f=document.createDocumentFragment();const l=document.createElement("div");l.className="branch-label";l.textContent=label;f.append(l,renderSequence(seq,path));return f;}function tool(text,title,fn,klass=""){const b=document.createElement("button");b.type="button";b.textContent=text;b.title=title;if(klass)b.className=klass;b.onclick=fn;return b;}function varInput(obj,key){const i=document.createElement("input");i.className="typed-input socket-variable";i.value=obj[key]||"value";i.maxLength=40;i.oninput=()=>{obj[key]=i.value;markDraftChanged()};return i;}',
    "block variable dirty state",
)

# Every structural edit explicitly marks the draft dirty.
replace_once(
    app,
    'function moveWithin(path,index,delta){const seq=seqByPath(path),next=index+delta;if(!seq||next<0||next>=seq.length)return;[seq[index],seq[next]]=[seq[next],seq[index]];renderWorkspace();}',
    'function moveWithin(path,index,delta){const seq=seqByPath(path),next=index+delta;if(!seq||next<0||next>=seq.length)return;[seq[index],seq[next]]=[seq[next],seq[index]];markDraftChanged();renderWorkspace();}',
    "move dirty state",
)
replace_once(
    app,
    'let at=nextIndex;if(pathKey(src.path)===pathKey(nextPath)&&src.index<at)at-=1;to.splice(Math.max(0,Math.min(at,to.length)),0,block);renderWorkspace();checkTutorialStructure();renderTutorial();}',
    'let at=nextIndex;if(pathKey(src.path)===pathKey(nextPath)&&src.index<at)at-=1;to.splice(Math.max(0,Math.min(at,to.length)),0,block);markDraftChanged();renderWorkspace();checkTutorialStructure();renderTutorial();}',
    "drop dirty state",
)
replace_once(
    app,
    'function insertBlock(path,index,block){const routed=tutorialRouteInsertion(path,index,block),seq=seqByPath(routed.path);if(!seq)return;seq.splice(Math.max(0,Math.min(routed.index,seq.length)),0,block);renderWorkspace();onTutorialAdd(block);}',
    'function insertBlock(path,index,block){const routed=tutorialRouteInsertion(path,index,block),seq=seqByPath(routed.path);if(!seq)return;seq.splice(Math.max(0,Math.min(routed.index,seq.length)),0,block);markDraftChanged();renderWorkspace();onTutorialAdd(block);}',
    "insert dirty state",
)
replace_once(
    app,
    'del=tool("削除","削除",()=>{seqByPath(path).splice(index,1);renderWorkspace()},"delete-block")',
    'del=tool("削除","削除",()=>{seqByPath(path).splice(index,1);markDraftChanged();renderWorkspace()},"delete-block")',
    "delete dirty state",
)
replace_once(
    app,
    'v=>{block.action=v;block.uiKind="turn";},"typed-select socket-enum"',
    'v=>{block.action=v;block.uiKind="turn";markDraftChanged();},"typed-select socket-enum"',
    "turn dirty state",
)

# Mobile palette visibility uses class state and sits above the primary bottom nav.
replace_once(
    app,
    'function updateMobilePaletteAvailability(){const b=$("#mobilePaletteButton");if(b)b.hidden=state.view!=="editor";}',
    'function updateMobilePaletteAvailability(){const b=$("#mobilePaletteButton");if(b)b.classList.toggle("is-hidden",state.view!=="editor");}',
    "mobile palette availability",
)

# Capture unsaved internal and real-link navigation before other click handlers can move the page.
old_bind = 'function bindEvents(){document.addEventListener("click",e=>{const go=e.target.closest("[data-go]");if(go&&!go.disabled){const target=go.dataset.go;if(target===state.view)return;requestUnsavedAction(()=>showView(target));}});'
new_bind = '''function bindEvents(){document.addEventListener("click",e=>{if(state.view!=="editor"||!isDraftDirty())return;const go=e.target.closest("[data-go]");if(go&&!go.disabled){const target=go.dataset.go;if(target===state.view)return;e.preventDefault();e.stopImmediatePropagation();requestUnsavedAction(()=>showView(target));return;}const link=e.target.closest("a[href]");if(!link||link.target==="_blank"||link.hasAttribute("download"))return;const href=link.getAttribute("href")||"";if(!href||href.startsWith("#")||href.startsWith("javascript:"))return;e.preventDefault();e.stopImmediatePropagation();requestUnsavedAction(()=>window.location.assign(link.href));},true);document.addEventListener("click",e=>{const go=e.target.closest("[data-go]");if(go&&!go.disabled){const target=go.dataset.go;if(target===state.view)return;requestUnsavedAction(()=>showView(target));}});'''
replace_once(app, old_bind, new_bind, "capture navigation guard")

# HTML: class-driven visibility, no hidden attribute that can get stuck on iOS.
replace_once(
    "public/now-coding/index.html",
    '<button id="mobilePaletteButton" class="mobile-palette-fab" type="button" aria-expanded="false" aria-controls="mobilePaletteSheet" hidden>＋ 命令を追加</button>',
    '<button id="mobilePaletteButton" class="mobile-palette-fab is-hidden" type="button" aria-expanded="false" aria-controls="mobilePaletteSheet">＋ 命令を追加</button>',
    "mobile palette button markup",
)

# CSS: place launcher above the fixed primary navigation and avoid hidden-attribute selector coupling.
style = Path("public/now-coding/style-v7.css")
css = style.read_text()
css = css.replace('.mobile-palette-fab:not([hidden]){display:flex;position:fixed;z-index:72;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));', '.mobile-palette-fab:not(.is-hidden){display:flex;position:fixed;z-index:96;left:50%;bottom:calc(86px + env(safe-area-inset-bottom));', 1)
css += '\n@media(max-width:760px){#view-editor.is-active{padding-bottom:84px}.mobile-palette-sheet{z-index:110}.mobile-palette-backdrop{z-index:109}}\n'
style.write_text(css)

# Splat: donut center hole remains movement cliff, but a shot can cross the void and resume on the far side.
modes = Path("public/now-coding/modes.js")
mt = modes.read_text()
old_attack = '''function attackCells(state, agent, range) {
  const vector = DIRECTIONS[agent.dir];
  const cells = [];
  for (let distance = 1; distance <= range; distance += 1) {
    const x = agent.x + vector.x * distance;
    const y = agent.y + vector.y * distance;
    if (out(state, x, y)) break;
    cells.push({ x, y });
  }
  return cells;
}'''
new_attack = '''function attackCells(state, agent, range) {
  const vector = DIRECTIONS[agent.dir];
  const cells = [];
  for (let distance = 1; distance <= range; distance += 1) {
    const x = agent.x + vector.x * distance;
    const y = agent.y + vector.y * distance;
    if (x < 0 || y < 0 || x >= state.size || y >= state.size) break;
    if (!isPlayableCell(state, x, y)) {
      if (state.boardShape === "donut") continue;
      break;
    }
    cells.push({ x, y });
  }
  return cells;
}'''
if old_attack not in mt:
    raise SystemExit("missing splat attackCells")
modes.write_text(mt.replace(old_attack, new_attack, 1))

# Replace old donut-shot regression with the new intended behavior.
tests = Path("tools/now-coding/engine.test.mjs")
tt = tests.read_text()
old_test = '''test("splat shots stop at donut void instead of crossing the hole", () => {
  const attack = { type: "action", action: "attack", range: literal(20) };
  const state = createGameState({ mode: "splat", seed: "donut-shot", boardShape: "donut", boardSizeKey: "small", players: [{ id: "a", program: [attack] }, { id: "b", program: [right] }], spawns: [{ x: 9, y: 0, dir: 2 }, { x: 9, y: 18, dir: 0 }] });
  state.agents[0].ink = 30;
  stepGame(state);
  assert.equal(state.agents[1].alive, true);
  assert.ok(state.effects.filter((e) => e.type === "shot").length < 18);
});'''
new_test = '''test("splat shots cross the donut center void while pieces still cannot enter it", () => {
  const attack = { type: "action", action: "attack", range: literal(20) };
  const state = createGameState({ mode: "splat", seed: "donut-shot", boardShape: "donut", boardSizeKey: "small", players: [{ id: "a", program: [attack] }, { id: "b", program: [{ type: "action", action: "turnRight" }] }], spawns: [{ x: 9, y: 0, dir: 2 }, { x: 9, y: 18, dir: 0 }] });
  state.agents[0].ink = 30;
  stepGame(state);
  assert.equal(state.agents[1].alive, false);
  const shots = state.effects.filter((e) => e.type === "shot");
  assert.ok(shots.some((e) => e.y > 11), "shot resumes after the center void");
  assert.ok(!shots.some((e) => e.x === 9 && e.y >= 7 && e.y <= 11), "void itself is not painted/effected");
});'''
if old_test not in tt:
    raise SystemExit("missing old donut shot test")
tests.write_text(tt.replace(old_test, new_test, 1))

# Client contracts for the real-device regressions.
client = Path("tools/now-coding/client-contract.test.mjs")
ct = client.read_text()
append = r'''

test("draft mutation uses explicit dirty state and capture-phase navigation guards", () => {
  assert.match(app, /draftDirty: false/);
  assert.match(app, /function markDraftChanged\(\)/);
  assert.match(app, /function isDraftDirty\(\)\{return Boolean\(state\.draftDirty\)/);
  assert.match(app, /markDraftChanged\(\);renderWorkspace\(\);onTutorialAdd/);
  assert.match(app, /e\.stopImmediatePropagation\(\);requestUnsavedAction/);
  assert.match(app, /window\.location\.assign\(link\.href\)/);
  assert.match(app, /\},true\);document\.addEventListener\("click"/);
});

test("inline expression typing preserves the focused input node", () => {
  assert.match(app, /expr\.value=Number\(i\.value\)\|\|0;markDraftChanged\(\)/);
  assert.match(app, /expr\.name=i\.value\.slice\(0,40\);markDraftChanged\(\)/);
  assert.doesNotMatch(app, /expr\.value=Number\(i\.value\)\|\|0;change\(expr,false\)/);
  assert.doesNotMatch(app, /expr\.name=i\.value\.slice\(0,40\);change\(expr,false\)/);
});

test("mobile command launcher is class-controlled and clears the bottom navigation", () => {
  assert.match(html, /id="mobilePaletteButton" class="mobile-palette-fab is-hidden"/);
  assert.doesNotMatch(html, /id="mobilePaletteButton"[^>]*\shidden(?:\s|>)/);
  assert.match(app, /classList\.toggle\("is-hidden",state\.view!=="editor"\)/);
  assert.match(css, /mobile-palette-fab:not\(\.is-hidden\)/);
  assert.match(css, /bottom:calc\(86px \+ env\(safe-area-inset-bottom\)\)/);
});
'''
if 'test("draft mutation uses explicit dirty state and capture-phase navigation guards"' not in ct:
    client.write_text(ct.rstrip() + append + "\n")

print("mobile/dirty/splat patch applied")
