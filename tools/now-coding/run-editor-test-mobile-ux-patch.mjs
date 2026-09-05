import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const sourcePath='tools/now-coding/apply-editor-test-mobile-ux.mjs';
let source=fs.readFileSync(sourcePath,'utf8');
const bad="app=replaceRegex(app,/function runTest\\(\\)\\{.*?\\}/s,'function runTest(){startTestPlayback();}','legacy run alias');";
const good="app=replaceOnce(app,'function runTest(){if(state.testSession){resetTestSessionToCurrentDraft();startTestPlayback();return;}prepareFreshTestSession(true);}','function runTest(){startTestPlayback();}','legacy run alias');";
if(!source.includes(bad))throw new Error('missing legacy run alias patch');
source=source.replace(bad,good);
const temp='tools/now-coding/.apply-editor-test-mobile-ux.runtime.mjs';
fs.writeFileSync(temp,source);
try{await import(pathToFileURL(process.cwd()+'/'+temp).href+'?v='+Date.now());}
finally{fs.rmSync(temp,{force:true});}
