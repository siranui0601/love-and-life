import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceElapsed} from '../public/capital-review/capital-clock.js';
import fs from 'node:fs';
test('10 FPS and 60 FPS consume identical elapsed time and walking distance',()=>{
 for(const fps of [10,60]){let distance=0,elapsed=0;
  for(let frame=0;frame<fps*10;frame++)advanceElapsed(1/fps,dt=>{assert.ok(dt<=.05);elapsed+=dt;distance+=1.4*dt;});
  assert.ok(Math.abs(elapsed-10)<1e-9);assert.ok(Math.abs(distance-14)<1e-9);
 }
});
test('empty route invalidates the active guided walk before returning',()=>{
 const source=fs.readFileSync(new URL('../public/capital-review/review.js',import.meta.url),'utf8');
 const empty=source.slice(source.indexOf('if(!alternatives.length)'),source.indexOf('alternatives.forEach'));
 assert.match(empty,/selectedRoute=null;scene3d\?\.routeChanged\?\.\(\);return/);
});
test('committed production verification resolves its report independently of cwd',()=>{
 const script=new URL('../docs/trpg-world/qa/capital-pass-3/production/verify-public.mjs',import.meta.url);
 const report=JSON.parse(fs.readFileSync(new URL('./browser-audit.json',script)));
 assert.equal(report.routes.length,14);
 const source=fs.readFileSync(script,'utf8');assert.match(source,/new URL\('\.\/browser-audit.json',import.meta.url\)/);
});
