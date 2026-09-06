import fs from "node:fs";

const path = "tools/now-coding/client-contract.test.mjs";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`missing ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`ambiguous ${label}`);
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

replaceOnce(
`test("test battle placement rerolls its seed on every execution", () => {
  assert.match(app, /c\\.spawnMode==="random"\\|\\|c\\.spawnMode==="battle"\\|\\|c\\.boardShape==="random"/);
});`,
`test("test battle placement keeps the preview seed until an explicit reroll", () => {
  assert.match(app, /function testHasRerollableSettings/);
  assert.match(app, /function rerollTestScenario\\(\\).*state\\.testRollSeed=freshSeed\\(\\)/s);
  const start = app.indexOf("function prepareFreshTestSession");
  const end = app.indexOf("\\nfunction ", start + 10);
  assert.ok(start >= 0);
  assert.ok(!app.slice(start, end < 0 ? app.length : end).includes("freshSeed()"));
});`,
"battle reroll contract"
);

replaceOnce(
`  assert.match(app, /classList\\.toggle\\("is-hidden",state\\.view!=="editor"\\)/);`,
`  assert.match(app, /function updateMobilePaletteAvailability\\(\\)\\{const hidden=state\\.view!=="editor"/);
  assert.match(app, /b\\.classList\\.toggle\\("is-hidden",hidden\\)/);
  assert.match(app, /dock\\?\\.classList\\.toggle\\("is-hidden",hidden\\)/);`,
"mobile launcher visibility contract"
);

replaceOnce(
`test("mobile command sheet supports long-press drag into code", () => {
  assert.match(app, /mobilePaletteContent.*pointerdown.*startMobilePalettePointer/s);
  assert.match(app, /function startTouchCommandDrag\\(event,key,fromMobile=false\\)/);
  assert.match(app, /if\\(fromMobile\\)setMobilePalette\\(false\\)/);
  assert.match(app, /blockDropTargetAt\\(point\\.x,point\\.y\\)/);
  assert.match(app, /function startTouchExistingBlockDrag\\(event,block\\)/);
});`,
`test("mobile command sheet uses an explicit drag handle with pointer capture", () => {
  assert.match(app, /mobilePaletteContent.*pointerdown.*startMobilePalettePointer/s);
  assert.match(app, /function startTouchCommandDrag\\(event,key,fromMobile=false,immediate=false\\)/);
  assert.match(app, /block-drag-handle/);
  assert.match(app, /setPointerCapture/);
  assert.match(app, /releasePointerCapture/);
  assert.match(app, /nearestBlockDropTargetAt\\(point\\.x,point\\.y\\)/);
  assert.match(app, /function startTouchExistingBlockDrag\\(event,block\\)/);
});`,
"mobile drag contract"
);

replaceOnce(
`  assert.ok(app.includes('markDraftChanged(){state.draftDirty=true;persistTutorialDraft();scheduleTestResetAfterDraftChange();}'));`,
`  const markStart=app.indexOf('function markDraftChanged()');
  const markEnd=app.indexOf('\\nfunction ',markStart+10);
  assert.ok(markStart>=0);
  const markBody=app.slice(markStart,markEnd<0?app.length:markEnd);
  assert.ok(markBody.includes('state.draftDirty=true'));
  assert.ok(markBody.includes('scheduleTestResetAfterDraftChange()'));`,
"draft reset contract"
);

fs.writeFileSync(path, source);
