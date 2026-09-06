import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("public/now-coding/app-v3.js", "utf8");
const entry = fs.readFileSync("public/now-coding/app.js", "utf8");
const html = fs.readFileSync("public/now-coding/index.html", "utf8");
const css = ["public/now-coding/style-v3.css", "public/now-coding/style-v4.css", "public/now-coding/style-v6.css", "public/now-coding/style-v7.css"].map((p) => fs.readFileSync(p, "utf8")).join("\n");
const online = fs.readFileSync("src/server/now-coding/online.js", "utf8");
const boards = fs.readFileSync("public/now-coding/boards.js", "utf8");
const tutorials = fs.readFileSync("public/now-coding/tutorials.js", "utf8");

function htmlHasId(id) {
  return new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(html);
}

test("v3 controller is the active client entrypoint", () => {
  assert.match(entry, /import\s+["']\.\/app-v3\.js["']/);
  assert.doesNotMatch(entry, /bindEvents\s*\(/);
});

test("all fixed id selectors used by the controller exist in HTML", () => {
  const ids = new Set();
  for (const match of app.matchAll(/(?<!\$)\$\(["']#([A-Za-z0-9_-]+)["']\)/g)) ids.add(match[1]);
  const missing = [...ids].filter((id) => !htmlHasId(id));
  assert.deepEqual(missing, [], `missing fixed DOM ids: ${missing.join(", ")}`);
});

test("single-element selector helper is never directly iterated with forEach", () => {
  assert.doesNotMatch(app, /(?<!\$)\$\((?:["'`])[^"'`\n]+(?:["'`])\)\.forEach\s*\(/, "querySelector result must not be used as a list");
});

test("stored login restoration happens during init before tutorial bootstrap", () => {
  assert.match(app, /const u=storedUser\(\);setUser\(u\);if\(u\).*await bootstrap\(\)/s);
  assert.match(app, /if\(!state\.profile\.tutorialDone\)requestAnimationFrame\(startTutorial\)/);
});

test("Google, drag, menu and online entry bindings are present", () => {
  assert.match(app, /window\.addEventListener\("load",initGoogle/);
  assert.match(app, /bindPalette\(\)/);
  assert.match(app, /#openCreateRoomButton/);
  assert.match(app, /#openJoinRoomButton/);
  assert.match(app, /data-menu-action/);
});

test("tutorial locks battle but not the editor or hamburger menu", () => {
  assert.match(app, /\$\$\('\[data-go="battle"\], #onlineBattleTab'\)/);
  assert.match(app, /#homeEditorButton/);
  assert.match(app, /#menuButton/);
  assert.doesNotMatch(app, /#menuButton[^\n]{0,80}disabled\s*=\s*locked/);
});

test("typed language exposes nested control and expected visual sockets", () => {
  for (const block of ["move", "turn", "forever", "repeat", "while", "break", "if", "attack"]) {
    assert.match(html, new RegExp(`data-add-block=["']${block}["']`));
  }
  assert.match(app, /renderSequence\(block\.body/);
  assert.match(app, /renderSequence\(block\.else/);
  assert.match(app, /socket-\$\{expected\}/);
  assert.match(css, /\.socket-number/);
  assert.match(css, /\.socket-boolean/);
});

test("mobile tutorial acceptance contract is wired", () => {
  assert.match(html, /style-v4\.css/);
  assert.match(app, /a\.vm\?\.halted===true/);
  assert.match(app, /tutorial-step-modal/);
  assert.match(app, /scrollIntoView/);
  assert.match(app, /function startTouchExistingBlockDrag\(event,block\)/);
  assert.match(app, /const hold=setTimeout\(activate,190\)/);
  assert.match(app, /completeBlockMove\(block,target\.seq,target\.index\)/);
  assert.match(css, /editor-layout-v3>\.block-palette\{[^}]*display:block!important/);
  assert.match(css, /\.tutorial-disabled/);
});

test("multi-mode online client participates in the server round protocol", () => {
  assert.match(app, /now:round-finished/);
  assert.match(app, /now:set-round-program/);
  assert.match(app, /now:round-prepare/);
  assert.match(app, /now:series-finished/);
});


test("language palette exposes directly composable conditions and values", () => {
  for (const key of ["compare","logic","not","sensor","cellState","enemyDistance","enemyCount","number","var","random","math"]) {
    assert.ok(html.includes(`data-expression-preset="${key}"`));
  }
  for (const key of ["turn","sensorDirection","cellState","compareOp","logicOp","mathOp"]) assert.ok(html.includes(`data-palette-option="${key}"`));
  assert.doesNotMatch(html, /data-expression-preset="cell"/);
  assert.match(app, /expressionControl/);
  assert.match(app, /application\/x-now-expression/);
  assert.match(app, /if\(type==="if"\)return\{type:"if",condition:null/);
  assert.match(app, /if\(type==="while"\)return\{type:"while",condition:null/);
});

test("test bench exposes modes optional NPC archetypes and fixed spawn", () => {
  for (const mode of ["territory","fall","cobra","splat"]) assert.ok(html.includes(`data-test-mode="${mode}"`));
  for (const type of ["straight","wall","explore","evade","chase","random","beginner","intermediate","advanced"]) assert.ok(html.includes(`value="${type}"`));
  assert.match(app, /allowSolo/);
  assert.match(app, /makeTestNpcProgram/);
  assert.match(app, /testSpawnMode/);
});


test("final language and testbench semantics stay visible", () => {
  assert.match(app, /"%": "％"/);
  assert.doesNotMatch(html, /モード固有/);
  assert.match(html, /data-command-help="attack"/);
  assert.match(app, /renderTestPreview/);
  assert.match(app, /c\.mode==="territory"\|\|c\.mode==="splat"/);
  assert.match(app, /if\(t\.battleKind\)setBattleKind/);
});


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
  assert.ok(app.includes('data-expression-preset="compare"'));
  assert.ok(app.includes('data-expression-preset="sensor"'));
  assert.ok(app.includes('data-expression-preset="cellState"'));
  assert.match(app, /step===10&&a\.alive&&game\.tick>=30/);
  assert.match(app, /tutorialProgress\(TUTORIAL_STEPS\.length,true\)/);
});


test("direct-composition tutorial and palette polish stay aligned", () => {
  assert.match(html, /tutorialStepLabel">1 \/ 11/);
  assert.match(html, /もし &lt;（前）＝（崖）&gt;/);
  assert.doesNotMatch(tutorials, /条件を組み立てる.*モーダル/);
  assert.match(app, /e\.defaultPrevented\|\|state\.pendingExpressionPreset/);
  assert.match(app, /if\(type==="turn"\)return\{type:"action",action:p\.turn\|\|"turnRight"/);
  for (const value of ["unclaimed","own","enemy","cliff","player","tail"]) assert.ok(html.includes(`value="${value}"`));
});


test("condition insertion and territory wall rules stay visually and textually aligned", () => {
  assert.match(css, /reporter-boolean\.expression-preset-active/);
  assert.match(css, /conditionNeonPulse/);
  assert.match(css, /expression-target\[data-expected="boolean"\]\.socket-accepting/);
  assert.match(css, /conditionTargetPulse/);
  assert.match(app, /一度色が付いたマスは、自分・敵を問わず壁/);
  assert.match(tutorials, /自分・敵を問わず一度色が付いたマスは壁/);
});


test("board variants and compact setup controls are exposed consistently", () => {
  for (const id of ["testBoardShape","testBoardSizeKey","testSpawnMode","testSpawnActor","boardShape","boardSizeKey","rerollBoardEachRound","onlineBoardShape","onlineBoardSizeKey","onlineRerollBoardEachRound"]) assert.ok(htmlHasId(id), id);
  for (const value of ["square","diamond","cross","donut","random"]) assert.ok(html.includes(`value="${value}"`));
  assert.match(html, /<option value="battle">対戦配置<\/option>/);
  assert.match(css, /\.board-cell\.is-void/);
  assert.match(css, /\.board-config-card/);
  assert.match(app, /ラウンドごとに盤面を再抽選|rerollBoardEachRound/);
  assert.match(app, /createRandomSpawns/);
  assert.match(app, /createBattleSpawns/);
  assert.doesNotMatch(app, /Math\.max\(1,Math\.min\(13,Number\(c\.spawn/);
});

test("online server resolves board selection deterministically and sends resolved board", () => {
  assert.match(online, /boardShape/);
  assert.match(online, /boardSizeKey/);
  assert.match(online, /rerollBoardEachRound/);
  assert.match(online, /resolveBoardChoice/);
  assert.match(online, /boardShape: boardDef\.shape/);
  assert.match(online, /boardSizeKey: boardDef\.sizeKey/);
  assert.match(boards, /diamond/);
  assert.match(boards, /cross/);
  assert.match(boards, /donut/);
});

test("test board fixed spawn supports both user and NPC including outer cells", () => {
  assert.match(app, /testFixedSpawns/);
  assert.match(app, /state\.testSpawnActor/);
  assert.match(app, /isPlayableCell\(def,x,y\)/);
  assert.match(app, /同じマスには配置できません/);
  assert.match(app, /Number\.MAX_SAFE_INTEGER/);
});

test("mobile inputs do not trigger iOS focus zoom", () => {
  assert.match(css, /@media \(hover:none\) and \(pointer:coarse\)/);
  assert.match(css, /input,select,textarea\{font-size:16px!important\}/);
  assert.doesNotMatch(html, /maximum-scale=1|user-scalable=no/);
});

test("test battle placement keeps the preview seed until an explicit reroll", () => {
  assert.match(app, /function testHasRerollableSettings/);
  assert.match(app, /function rerollTestScenario\(\).*state\.testRollSeed=freshSeed\(\)/s);
  const start = app.indexOf("function prepareFreshTestSession");
  const end = app.indexOf("\nfunction ", start + 10);
  assert.ok(start >= 0);
  assert.ok(!app.slice(start, end < 0 ? app.length : end).includes("freshSeed()"));
});

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

test("draft mutation uses explicit dirty state and capture-phase navigation guards", () => {
  assert.match(app, /draftDirty: false/);
  assert.match(app, /function markDraftChanged\(\)/);
  assert.match(app, /function isDraftDirty\(\)\{return Boolean\(state\.draftDirty\)/);
  assert.match(app, /function insertBlock\([^\n]+markDraftChanged\(\)[^\n]+renderWorkspace\([^\n]+onTutorialAdd\(block\)/);
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
  assert.match(app, /function updateMobilePaletteAvailability\(\)\{const hidden=state\.view!=="editor"/);
  assert.match(app, /b\.classList\.toggle\("is-hidden",hidden\)/);
  assert.match(app, /dock\?\.classList\.toggle\("is-hidden",hidden\)/);
  assert.match(css, /mobile-palette-fab:not\(\.is-hidden\)/);
  assert.match(css, /bottom:calc\(86px \+ env\(safe-area-inset-bottom\)\)/);
});



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

test("mobile command sheet uses an explicit drag handle with pointer capture", () => {
  assert.match(app, /mobilePaletteContent.*pointerdown.*startMobilePalettePointer/s);
  assert.match(app, /function startTouchCommandDrag\(event,key,fromMobile=false,immediate=false\)/);
  assert.match(app, /block-drag-handle/);
  assert.match(app, /setPointerCapture/);
  assert.match(app, /releasePointerCapture/);
  assert.match(app, /nearestBlockDropTargetAt\(point\.x,point\.y\)/);
  assert.match(app, /function startTouchExistingBlockDrag\(event,block\)/);
});

test("deep nesting keeps block tools left aligned and wrapping", () => {
  assert.match(css, /\.block-tools\{position:static!important/);
  assert.match(css, /justify-content:flex-start!important/);
  assert.match(css, /flex-wrap:wrap/);
  assert.match(app, /tool\(state\.moveSource===block\?"移動取消":"移動"/);
});


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


test("enemy count and multi-NPC test bench are exposed consistently", () => {
  assert.ok(html.includes('data-expression-preset="enemyCount"'));
  assert.ok(htmlHasId("testNpcCount"));
  assert.doesNotMatch(html, /id="testNpcEnabled"/);
  for (const count of ["0","1","2","3"]) assert.ok(html.includes(`<option value="${count}"`));
  assert.match(app, /testNpcCount: 0/);
  assert.match(app, /function testNpcKeys\(c\)/);
  assert.match(app, /for\(let i=0;i<c\.npcCount;i\+\+\)players\.push/);
  assert.match(app, /data-expression-preset=\"enemyCount\"|expr:enemyCount/);
});


test("tutorial resume restores code and prevents the highlighted expression from entering the wrong side", () => {
  assert.match(app, /TUTORIAL_DRAFT_STORAGE="nowCodingTutorialDraftV1"/);
  assert.match(app, /function persistTutorialDraft/);
  assert.match(app, /function loadTutorialDraft/);
  assert.match(app, /repairTutorialBlocks\(cached\?\.blocks\|\|\[\],step\)/);
  assert.match(app, /tutorialExpressionSlotAllowed/);
  assert.match(app, /tutorialAllowsExpressionTarget\(key,n\)/);
  assert.match(app, /チュートリアルでは光っている側の空欄に入れてください/);
});

test("block tools support nested copy placement and move mode follows its source immediately", () => {
  assert.match(app, /copySource: null/);
  assert.match(app, /copy=tool\("コピー","ネストごとコピー"/);
  assert.match(app, /function completeBlockCopy\(targetSequence,targetIndex\)/);
  assert.match(app, /deepClone\(state\.copySource\)/);
  assert.match(app, /slot\.textContent='ペースト'/);
  assert.match(app, /function startBlockMove\(block\).*follow:true/s);
  assert.match(css, /\.insertion-slot\.is-move-target,\.insertion-slot\.is-copy-target/);
});


test("placement mode does not rebuild a long workspace just to show or hide destinations", () => {
  const startMove = app.match(/function startBlockMove\(block\)\{[^\n]+\}/)?.[0] || "";
  const startCopy = app.match(/function startBlockCopy\(block\)\{[^\n]+\}/)?.[0] || "";
  const cancelMove = app.match(/function cancelBlockMove\(\)\{[^\n]+\}/)?.[0] || "";
  const cancelCopy = app.match(/function cancelBlockCopy\(\)\{[^\n]+\}/)?.[0] || "";
  for (const source of [startMove,startCopy,cancelMove,cancelCopy]) {
    assert.match(source, /syncPlacementModeDom/);
    assert.doesNotMatch(source, /renderWorkspace/);
  }
  assert.match(app, /function configureInsertionSlot\(slot,seq,index\)/);
  assert.match(app, /function renderPlacementModeBar\(\)/);
  assert.match(app, /function syncPlacementModeDom\(options=\{\}\)/);
  assert.match(app, /completeBlockCopy[^\n]+renderWorkspace\(\{focusBlock:copy,follow:false\}\)/);
  assert.match(app, /completeBlockMove[^\n]+renderWorkspace\(\{focusBlock:block,follow:false\}\)/);
});

test("copy and move destination affordances do not inflate document height", () => {
  assert.match(css, /\.insertion-slot\.is-move-target,\.insertion-slot\.is-copy-target\{[^}]*height:35px[^}]*margin:-13px 0/);
  assert.match(css, /\.insertion-slot\.is-move-target:hover,\.insertion-slot\.is-copy-target:hover\{[^}]*height:35px[^}]*margin:-13px 0/);
  assert.doesNotMatch(css, /\.insertion-slot\.is-move-target,\.insertion-slot\.is-copy-target\{height:36px;min-height:36px;margin:4px 0/);
});


test("copy action transitions to paste wording", () => {
  assert.match(app, /copy=tool\("コピー"/);
  assert.match(app, /slot\.textContent='ペースト'/);
  assert.match(app, /ペースト先を選んでください/);
  assert.match(app, /コピーしました。貼り付けたい場所の「ペースト」をタップしてください/);
  assert.doesNotMatch(app, /ここへコピー|コピー先を選んでください/);
});


test("test bench exposes compact playback debugger controls", () => {
  for (const id of ["testStepBackButton","testPlayPauseButton","testStepForwardButton","testSpeedSelect","testJumpCodeButton","runTestButton"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('aria-label="1コマ戻す"'));
  assert.ok(html.includes('aria-label="1コマ進める"'));
  assert.ok(html.includes('>0.5×</option>'));
  assert.ok(html.includes('>1×</option>'));
  assert.ok(html.includes('>2×</option>'));
  assert.ok(html.includes('>4×</option>'));
  assert.ok(!html.includes('id="stopTestButton"'));
});

test("test playback can pause step rewind resume and jump only on demand", () => {
  for (const fn of ["toggleTestPlayback","pauseTestPlayback","stepTestBackward","stepTestForward","restoreLiveTestAtCurrentFrame","jumpToTestCode"]) assert.ok(app.includes(`function ${fn}`), fn);
  assert.ok(app.includes('TEST_BASE_DELAY_MS=120'));
  assert.ok(app.includes('TEST_SPEED_VALUES=new Set([0.5,1,2,4])'));
  const jumpStart=app.indexOf('function jumpToTestCode()');
  const jumpEnd=app.indexOf('function resetTestSessionToCurrentDraft()',jumpStart);
  assert.ok(jumpStart>=0&&jumpEnd>jumpStart);
  assert.ok(app.slice(jumpStart,jumpEnd).includes('scrollIntoView'));
  for (const fn of ["pauseTestPlayback","stepTestBackward","stepTestForward","markCurrentTestTerminal"]) {
    const start=app.indexOf(`function ${fn}`);
    const end=app.indexOf('\nfunction ',start+10);
    assert.ok(start>=0);
    assert.ok(!app.slice(start,end<0?app.length:end).includes('scrollIntoView'), fn);
  }
});

test("editing code resets an active test to the same initial session without warning copy", () => {
  assert.ok(app.includes('function scheduleTestResetAfterDraftChange()'));
  assert.ok(app.includes('function resetTestSessionToCurrentDraft()'));
  const markStart=app.indexOf('function markDraftChanged()');
  const markEnd=app.indexOf('\nfunction ',markStart+10);
  assert.ok(markStart>=0);
  const markBody=app.slice(markStart,markEnd<0?app.length:markEnd);
  assert.ok(markBody.includes('state.draftDirty=true'));
  assert.ok(markBody.includes('scheduleTestResetAfterDraftChange()'));
  assert.ok(app.includes('state.testSession.program=annotateTestProgram(deepClone(state.draft.blocks))'));
  assert.ok(app.includes('state.testHistory=[captureTestFrame(game)]'));
  assert.ok(!app.includes('コードが変更されました'));
  assert.ok(!app.includes('変更前のコード'));
});

test("test program carries source refs for execution-position highlighting", () => {
  assert.ok(app.includes('block.__debugRef={path:deepClone(path),index}'));
  assert.ok(app.includes('agent?.vm?.lastDebugRef'));
  assert.ok(fs.readFileSync("public/now-coding/vm.js","utf8").includes('if (statement.__debugRef) vm.lastDebugRef = statement.__debugRef'));
  assert.ok(css.includes('.typed-block.is-test-debug-current'));
  assert.ok(css.includes('.typed-block.is-test-debug-parent'));
});


test("editor mobile dock exposes undo redo and placement cancellation", () => {
  for (const id of ["mobileEditorDock","undoEditButton","redoEditButton","blockEditCancelButton"]) assert.ok(html.includes(`id="${id}"`), id);
  for (const fn of ["undoBlockEdit","redoBlockEdit","applyBlockEditSnapshot","restoreSelectionScrollPosition","updateEditorActionDock"]) assert.ok(app.includes(`function ${fn}`), fn);
  assert.ok(app.includes('document.addEventListener("keydown",handleEditorHistoryShortcut)'));
  assert.ok(app.includes('移動キャンセル'));
  assert.ok(app.includes('コピーキャンセル'));
  assert.ok(css.includes('.history-jump-highlight'));
});

test("test controls expose explicit return reroll and terminal replay", () => {
  assert.ok(html.includes('id="runTestButton"'));
  assert.ok(html.includes('id="testReturnStartButton"'));
  assert.ok(html.includes('>↺ 先頭へ</button>'));
  assert.ok(html.includes('id="testRerollButton"'));
  assert.ok(html.includes('>再抽選</button>'));
  assert.ok(app.includes('function rerollTestScenario'));
  assert.ok(app.includes('function returnTestToStart'));
  assert.ok(app.includes('terminal?"もう一度":"再生"'));
  assert.ok(app.includes('state.testPlayback="paused";renderCurrentTestFrame()'));
});

test("test setting changes invalidate the old session without silently rerolling", () => {
  assert.ok(app.includes('function invalidateTestEnvironmentForSettingsChange'));
  assert.match(app,/testBoardShape=e\.target\.value;invalidateTestFixedSpawns\(\);invalidateTestEnvironmentForSettingsChange\(\)/);
  assert.match(app,/testSpawnMode=e\.target\.value;invalidateTestEnvironmentForSettingsChange\(\)/);
  const start=app.indexOf('function prepareFreshTestSession('),end=app.indexOf('\nfunction finishTestFromGame',start);
  assert.ok(start>=0&&end>start);
  assert.ok(!app.slice(start,end).includes('freshSeed()'));
});

test("mobile palette drag uses a handle pointer capture and magnetic destination", () => {
  assert.ok(app.includes("event.target.closest?.('.block-drag-handle')"));
  assert.ok(app.includes('setPointerCapture'));
  assert.ok(app.includes('releasePointerCapture'));
  assert.ok(app.includes('nearestBlockDropTargetAt'));
  assert.ok(app.includes('lastBlockTarget'));
  assert.ok(css.includes('.block-drag-handle'));
  assert.ok(css.includes('touch-action:none'));
});
