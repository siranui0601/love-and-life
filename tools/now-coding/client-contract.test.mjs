import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("public/now-coding/app-v3.js", "utf8");
const entry = fs.readFileSync("public/now-coding/app.js", "utf8");
const html = fs.readFileSync("public/now-coding/index.html", "utf8");

function htmlHasId(id) {
  return new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(html);
}

test("v3 controller is the active client entrypoint", () => {
  assert.match(entry, /import\s+["']\.\/app-v3\.js["']/);
  assert.doesNotMatch(entry, /bindEvents\s*\(/);
});

test("all fixed id selectors used by the controller exist in HTML", () => {
  const ids = new Set();
  for (const match of app.matchAll(/\$\(["']#([A-Za-z0-9_-]+)["']\)/g)) ids.add(match[1]);
  const missing = [...ids].filter((id) => !htmlHasId(id));
  assert.deepEqual(missing, [], `missing fixed DOM ids: ${missing.join(", ")}`);
});

test("single-element selector is never iterated with forEach", () => {
  assert.doesNotMatch(app, /\$\([^\n;]+\)\.forEach\s*\(/, "querySelector result must not be used as a list");
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
  assert.match(app, /socket-number/);
  assert.match(app, /socket-boolean/);
});

test("multi-mode online client participates in the server round protocol", () => {
  assert.match(app, /now:round-finished/);
  assert.match(app, /now:set-round-program/);
  assert.match(app, /now:round-prepare/);
  assert.match(app, /now:series-finished/);
});
