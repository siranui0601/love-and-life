import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const sourcePath = 'tools/now-coding/apply-test-debug-controls.mjs';
let source = fs.readFileSync(sourcePath, 'utf8');

function replaceOnce(sourceText, from, to, label) {
  const index = sourceText.indexOf(from);
  if (index < 0) throw new Error(`missing ${label}`);
  return sourceText.slice(0, index) + to + sourceText.slice(index + from.length);
}

// The generated runtime must not contain its own runTest because the helper
// separately replaces the legacy runTest immediately after installing runtime.
const duplicateRuntimeRun = 'function runTest(){prepareFreshTestSession(true);}';
const runtimeRunIndex = source.indexOf(duplicateRuntimeRun);
if (runtimeRunIndex < 0) throw new Error('missing duplicate runtime runTest');
source = source.slice(0, runtimeRunIndex) + source.slice(runtimeRunIndex + duplicateRuntimeRun.length);

// Broaden only the range markers. The production source is minified and small
// formatting changes around function signatures should not make this one-shot patch fail.
source = replaceOnce(
  source,
  `'function stopTest(message=""){','function openCommandHelp(kind){'`,
  `'function stopTest(','function openCommandHelp('`,
  'test runtime range markers',
);
source = replaceOnce(
  source,
  `testRuntime+'\\nfunction openCommandHelp(kind){'`,
  `testRuntime+'\\nfunction openCommandHelp('`,
  'test runtime range replacement tail',
);

// Once a test session exists, "最初から" must restart the exact same resolved
// board/spawns/session instead of rolling a new random board.
source = replaceOnce(
  source,
  `'function runTest(){prepareFreshTestSession(true);}\\nfunction showView(name,force=false){'`,
  `'function runTest(){if(state.testSession){resetTestSessionToCurrentDraft();startTestPlayback();return;}prepareFreshTestSession(true);}\\nfunction showView(name,force=false){'`,
  'runTest replacement payload',
);

// client-contract.test.mjs does not define a vm source variable; read it there
// the same way the test already reads app/html/css sources.
source = replaceOnce(
  source,
  `assert.ok(vm.includes('if (statement.__debugRef) vm.lastDebugRef = statement.__debugRef'));`,
  `assert.ok(fs.readFileSync("public/now-coding/vm.js","utf8").includes('if (statement.__debugRef) vm.lastDebugRef = statement.__debugRef'));`,
  'VM source-ref assertion',
);

const generated = '/tmp/apply-test-debug-controls-fixed.mjs';
fs.writeFileSync(generated, source);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
