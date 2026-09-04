import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const entry = fs.readFileSync("public/now-coding/app.js", "utf8");
const guard = fs.readFileSync("public/now-coding/editor-scroll-stability.js", "utf8");
const css = fs.readFileSync("public/now-coding/style-v8.css", "utf8");

test("editor stability guard loads before the main Now Coding app", () => {
  const guardImport = entry.indexOf('import "./editor-scroll-stability.js";');
  const appImport = entry.indexOf('import "./app-v3.js";');
  assert.ok(guardImport >= 0, "entry imports the stability guard");
  assert.ok(appImport > guardImport, "stability guard is evaluated before app-v3");
});

test("long editor smooth follow is replaced with minimal non-animated reveal", () => {
  assert.match(guard, /#programWorkspace/);
  assert.match(guard, /workspaceHeight\s*>\s*viewportHeight\s*\*\s*4/);
  assert.match(guard, /options\.behavior\s*===\s*"smooth"/);
  assert.match(guard, /window\.scrollBy\(\{\s*top:\s*delta,\s*left:\s*0,\s*behavior:\s*"auto"\s*\}\)/s);
  assert.match(guard, /rect\.bottom\s*>\s*safeBottom/);
  assert.match(guard, /rect\.top\s*<\s*safeTop/);
});

test("move and copy targets keep large touch affordances without changing flow height", () => {
  assert.match(css, /\.insertion-slot\.is-move-target[\s\S]*?height:\s*7px/);
  assert.match(css, /\.insertion-slot\.is-copy-target[\s\S]*?min-height:\s*7px/);
  assert.match(css, /\.insertion-slot\.is-move-target::after[\s\S]*?min-height:\s*32px/);
  assert.match(css, /\.insertion-slot\.is-copy-target::after/);
  assert.match(css, /content:\s*"ここへ移動"/);
  assert.match(css, /content:\s*"ここへコピー"/);
});

test("recent long-editor reveal is recorded so a following real reload can be diagnosed", () => {
  assert.match(guard, /sessionStorage\.setItem\(REVEAL_DIAGNOSTIC_KEY/);
  assert.match(guard, /performance\.getEntriesByType\?\.\("navigation"\)/);
  assert.match(guard, /navigation\?\.type\s*===\s*"reload"/);
});
