import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const index = read("public/TRPG/index.html");
const uxScript = read("public/TRPG/p0-ux.js");
const uxStyle = read("public/TRPG/p0-ux.css");

test("P0 UX controller loads before the main TRPG module", () => {
  const controllerPosition = index.indexOf("/TRPG/p0-ux.js");
  const appPosition = index.indexOf("/TRPG/app.js");
  assert.ok(controllerPosition >= 0, "P0 UX controller must be loaded");
  assert.ok(appPosition >= 0, "main TRPG module must be loaded");
  assert.ok(controllerPosition < appPosition, "fetch observation must be installed before app.js starts");
  assert.match(index, /id="missionToastRegion"/u);
  assert.match(index, /\/TRPG\/p0-ux\.css/u);
});

test("P0 UX controller is valid JavaScript and exposes required player actions", () => {
  assert.doesNotThrow(() => new Function(uxScript));
  assert.match(uxScript, /window\.fetch = async/u);
  assert.match(uxScript, /ミッション発生/u);
  assert.match(uxScript, /ミッション完了/u);
  assert.match(uxScript, /フィンと村の広場へ移動する/u);
  assert.match(uxScript, /スキルを取得して捜索を続ける/u);
  assert.match(uxScript, /setChoiceSkillLock\(skillRequired\)/u);
});

test("mobile battle command panel is no longer restricted to the clipping height", () => {
  assert.match(uxStyle, /battle-command-panel:not\(\[hidden\]\)/u);
  assert.match(uxStyle, /max-height: min\(42dvh, 240px\) !important/u);
  assert.match(uxStyle, /battle-command-menu\[data-mode="root"\]/u);
  assert.match(uxStyle, /min-height: 108px/u);
});
