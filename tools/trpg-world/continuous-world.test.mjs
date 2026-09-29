import test from 'node:test';
import assert from 'node:assert/strict';
import {settlements,worldRoutes,landAt,heightAt,biomeAt,canWalk,advanceWalker,walkingStart,WORLD_BOUNDS,forestTrees} from '../../src/shared/trpg-world/continuous-world.js';
const byId=new Map(settlements.map(s=>[s.id,s]));
test('one metric landmass contains all 11 actual site IDs, not 11 isolated terrain pads',()=>{
 assert.equal(byId.size,11);assert.deepEqual([...byId.keys()].sort(),['blackridge','capital','crime','dwarf','elf','farm','forest','fortress','frontier','temple','trade'].sort());
 for(const site of settlements){assert.equal(landAt(site.x,site.z),true,site.id);assert.ok(Number.isFinite(heightAt(site.x,site.z)),site.id);}
 assert.ok(WORLD_BOUNDS.maxX-WORLD_BOUNDS.minX>=2400&&WORLD_BOUNDS.maxZ-WORLD_BOUNDS.minZ>=1800);
 assert.equal(landAt(-1060,455),true,'inhabited island');assert.equal(landAt(-1060,200),false,'sea separation');
 assert.equal(biomeAt(700,-650),'volcanic');assert.equal(biomeAt(400,-40),'forest');
});
test('the capital, port, military fortress and blackridge differ in architecture and scale',()=>{
 const [capital,farm,trade,fort,black]=['capital','farm','trade','fortress','blackridge'].map(id=>byId.get(id));
 assert.ok(capital.buildings.length>farm.buildings.length*5,'capital has an actual urban fabric');
 assert.ok(black.buildings.length>farm.buildings.length*5,'blackridge remains inhabited and substantial');
 assert.ok(trade.buildings.some(b=>b.kind==='warehouse'),'harbour works, not a generic village');
 assert.ok(fort.walls.length>=8&&fort.buildings.some(b=>b.kind==='keep'),'defensible compound');
 assert.ok(capital.buildings.some(b=>b.id.endsWith('great-keep')&&b.height>40),'the castle has a real monumental keep');
 assert.ok(capital.radius>farm.radius*3);
});
test('all fifteen authored routes use canonical topology and mode distinctions',()=>{
 const expected=['dwarf:fortress','fortress:blackridge','trade:fortress','trade:dwarf','dwarf:blackridge','trade:capital','trade:temple','trade:crime','temple:frontier','farm:temple','capital:temple','capital:farm','capital:forest','forest:elf','forest:blackridge'];
 assert.equal(worldRoutes.length,15);
 for(const [i,route] of worldRoutes.entries()){
  assert.equal(route.id,'R'+String(i+1).padStart(2,'0'));
  assert.equal(route.from+':'+route.to,expected[i]);
  assert.ok(route.points.length>=3);
  assert.deepEqual(route.points[0],[byId.get(route.from).x,byId.get(route.from).z]);
  assert.deepEqual(route.points.at(-1),[byId.get(route.to).x,byId.get(route.to).z]);
 }
 assert.equal(worldRoutes.find(r=>r.id==='R08').mode,'ship');
 assert.equal(worldRoutes.find(r=>r.id==='R05').mode,'tunnel');
});
test('ordinary terrain is genuinely walkable away from roads; ocean and structures are not',()=>{
 assert.equal(canWalk([-400,0,160]),true,'unmarked hillside meadow is not a railroad barrier');
 assert.equal(canWalk([-600,0,-200]),true,'out-of-road hinterland walk');
 assert.equal(canWalk([-1060,0,200]),false,'no walking across open ocean');
 assert.ok(forestTrees.length>900,'actual inhabitable forest cover exists');
 assert.equal(canWalk([forestTrees[0].x,0,forestTrees[0].z]),false,'tree trunks share renderer/collision coordinates');
 const start=walkingStart('farm');assert.equal(canWalk(start),true);
 const next=advanceWalker(start,[1.25,.5]);assert.equal(canWalk(next),true);
 assert.ok(Math.hypot(next[0]-start[0],next[2]-start[2])<=1.36);
 assert.ok(Math.abs(next[1]-heightAt(next[0],next[2]))<.01);
});
