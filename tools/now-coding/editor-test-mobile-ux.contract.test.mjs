import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../../public/now-coding/index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../../public/now-coding/app-v3.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../../public/now-coding/style-v7.css", import.meta.url), "utf8");

test("editor exposes undo redo and explicit edit-mode cancel controls", () => {
  assert.match(html, /id="undoEditButton"/);
  assert.match(html, /id="redoEditButton"/);
  assert.match(html, /id="blockEditCancelButton"/);
  assert.match(app, /function\s+undoBlockEdit\s*\(/);
  assert.match(app, /function\s+redoBlockEdit\s*\(/);
  assert.match(app, /restoreSelectionScrollPosition/);
});

test("test bench exposes restart reroll and repeat controls", () => {
  assert.match(html, /id="testReturnStartButton"/);
  assert.match(html, /id="testRerollButton"/);
  assert.match(html, /id="testRunButton"/);
  assert.match(app, /function\s+rerollTestScenario\s*\(/);
  assert.match(app, /function\s+returnTestToStart\s*\(/);
});

test("mobile block palette uses an explicit drag handle and pointer capture", () => {
  assert.match(app, /block-drag-handle/);
  assert.match(app, /setPointerCapture\s*\(/);
  assert.match(app, /releasePointerCapture\s*\(/);
  assert.match(css, /\.block-drag-handle/);
});
