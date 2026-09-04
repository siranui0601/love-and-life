import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const sourcePath = 'tools/now-coding/apply-test-debug-controls.mjs';
let source = fs.readFileSync(sourcePath, 'utf8');

const oldRuntimeTail = `function runTest(){prepareFreshTestSession(true);}\`;

app=replaceRange(app,'function stopTest(message=\"\"){','function openCommandHelp(kind){',testRuntime+'\\nfunction openCommandHelp(kind){','test runtime');`;
const newRuntimeTail = `\`;

app=replaceRange(app,'function stopTest(','function openCommandHelp(',testRuntime+'\\nfunction openCommandHelp(','test runtime');`;
if (!source.includes(oldRuntimeTail)) throw new Error('missing runtime-tail patch target');
source = source.replace(oldRuntimeTail, newRuntimeTail);

const oldRunReplacement = `app=replaceRange(app,'function runTest(){','function showView(name,force=false){','function runTest(){prepareFreshTestSession(true);}\\nfunction showView(name,force=false){','runTest');`;
const newRunReplacement = `app=replaceRange(app,'function runTest(){','function showView(name,force=false){','function runTest(){if(state.testSession){resetTestSessionToCurrentDraft();startTestPlayback();return;}prepareFreshTestSession(true);}\\nfunction showView(name,force=false){','runTest');`;
if (!source.includes(oldRunReplacement)) throw new Error('missing runTest patch target');
source = source.replace(oldRunReplacement, newRunReplacement);

const oldVmAssertion = `assert.ok(vm.includes('if (statement.__debugRef) vm.lastDebugRef = statement.__debugRef'));`;
const newVmAssertion = `assert.ok(fs.readFileSync("public/now-coding/vm.js","utf8").includes('if (statement.__debugRef) vm.lastDebugRef = statement.__debugRef'));`;
if (!source.includes(oldVmAssertion)) throw new Error('missing vm assertion patch target');
source = source.replace(oldVmAssertion, newVmAssertion);

const generated = '/tmp/apply-test-debug-controls-fixed.mjs';
fs.writeFileSync(generated, source);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
