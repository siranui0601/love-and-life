import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("public/now-coding/app-v3.js", "utf8");
const entry = fs.readFileSync("public/now-coding/app.js", "utf8");
const html = fs.readFileSync("public/now-coding/index.html", "utf8");
const css = ["public/now-coding/style-v3.css", "public/now-coding/style-v4.css"].map((p) => fs.readFileSync(p, "utf8")).join("\n");

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


test("language palette exposes nested boolean and numeric reporters", () => {
  for (const key of ["cell","compare","logic","not","enemyDistance","number","var","random","math"]) {
    assert.ok(html.includes(`data-expression-preset="${key}"`));
  }
  assert.match(app, /最も近い敵との距離/);
  assert.match(app, /literalLabel/);
  assert.match(app, /application\/x-now-expression/);
});

test("test bench exposes modes optional NPC archetypes and fixed spawn", () => {
  for (const mode of ["territory","fall","cobra","splat"]) assert.ok(html.includes(`data-test-mode="${mode}"`));
  for (const type of ["straight","wall","explore","evade","chase","random","beginner","intermediate","advanced"]) assert.ok(html.includes(`value="${type}"`));
  assert.match(app, /allowSolo/);
  assert.match(app, /makeTestNpcProgram/);
  assert.match(app, /testSpawnMode/);
});
