import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const file=path=>readFile(new URL(path,import.meta.url),'utf8');
test('the exact production /atlas-review entry resolves all asset paths',async()=>{
 const html=await file('../public/atlas-review/index.html'),server=await file('../src/server/app.js');
 assert.match(server,/app\.get\("\/atlas-review"/);
 assert.match(html,/\/atlas-review\/main\.js/);
 assert.match(html,/babylonjs@9\.25\.0\/babylon\.js/);
 assert.match(await file('../public/atlas-review/main.js'),/\/atlas-review\/content\.json/);
});
test('public atlas manifest includes only approved 11 positions and 15 route edges',async()=>{
 const content=JSON.parse(await file('../public/atlas-review/content.json'));
 assert.equal(content.regions.length,11);
 assert.equal(content.routes.length,15);
 assert.deepEqual(Object.keys(content).sort(),['description','regions','routes','version']);
 for(const region of content.regions){
  assert.deepEqual(Object.keys(region).sort(),['id','name','worldPosition']);
  assert.equal(region.worldPosition.length,2);
  assert.ok(region.worldPosition.every(Number.isFinite));
 }
 const ids=new Set(content.regions.map(region=>region.id));
 for(const route of content.routes){
  assert.deepEqual(Object.keys(route).sort(),['from','id','modes','to']);
  assert.ok(ids.has(route.from)&&ids.has(route.to));
 }
 assert.equal(content.routes.find(route=>route.id==='R08').modes.includes('boat'),true);
 assert.ok(!JSON.stringify(content).includes('causalScenarios'));
});
