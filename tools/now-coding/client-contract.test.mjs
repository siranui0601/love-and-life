import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("public/now-coding/app-v3.js", "utf8");
const entry = fs.readFileSync("public/now-coding/app.js", "utf8");
const html = fs.readFileSync("public/now-coding/index.html", "utf8");
const css = ["public/now-coding/style-v3.css", "public/now-coding/style-v4.css", "public/now-coding/style-v6.css"].map((p) => fs.readFileSync(p, "utf8")).join("\n");
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
  assert.match(app, /setTimeout\(\(\)=>activate\(event\),120\)/);
  assert.match(app, /dist>5/);
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
  for (const key of ["compare","logic","not","sensor","cellState","enemyDistance","number","var","random","math"]) {
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
