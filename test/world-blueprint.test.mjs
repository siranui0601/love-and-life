import test from 'node:test';
import assert from 'node:assert/strict';
import {
 WORLD,REFERENCE,fromRef,toRef,mainland,crimeIsland,islets,terrain,forest,landUse,
 settlements,places,routes,waterways,alternatePaths,hazards,areaOf,pointInPolygon,
 landAreaKm2,seaAreaKm2,coast,exportBlueprint
} from '../public/world-blueprint/geography.js';

const close=(a,b,t=.03)=>assert.ok(Math.abs(a-b)<t,'Expected '+a+' to be close to '+b);
test('image coordinates preserve 4:3 world geometry without pretending the printed 200km bar is literal',()=>{
 assert.equal(WORLD.widthKm,48);assert.equal(WORLD.heightKm,36);
 assert.equal(REFERENCE.width/REFERENCE.height,4/3);
 for(const q of [[0,0],[1448,1086],[582,618],[1097,167],[1283,424]]){
  const r=toRef(fromRef(q));close(r[0],q[0],.0001);close(r[1],q[1],.0001);
 }
 close(landAreaKm2+seaAreaKm2,1728,.001);
 assert.ok(landAreaKm2>0&&seaAreaKm2>0);
 assert.equal(coast.isletAreaKm2,islets.reduce((a,p)=>a+areaOf(p),0));
});
test('forest is an expansive traversable terrain and elven community is INSIDE it, never a dot replacement',()=>{
 assert.equal(forest.kind,'biome');
 assert.ok(forest.points.length>15);
 assert.ok(areaOf(forest.points)>115,'Forest has real woodland territory');
 assert.equal(settlements.some(s=>s.id==='forest'),false);
 assert.equal(places.find(p=>p.id==='forest').type,'terrain');
 assert.ok(pointInPolygon(settlements.find(s=>s.id==='elf').center,forest.points));
});
test('city metrics come from traced footprints rather than prior hard-coded 3.2/1.8/2.4 km² targets',()=>{
 assert.equal(settlements.length,10);
 const m=new Map(settlements.map(s=>[s.id,s]));
 for(const city of settlements){
  close(city.areaKm2,areaOf(city.points),.00001);
  close(city.activityKm2,areaOf(city.activity),.00001);
  assert.ok(city.areaKm2>0);
  for(const q of city.points)assert.ok(q[0]>=0&&q[0]<=48&&q[1]>=0&&q[1]<=36,'in world '+city.id);
  const land=city.id==='crime'?crimeIsland:mainland;
  assert.ok(pointInPolygon(city.center,land),'core center located on land '+city.id);
 }
 assert.ok(m.get('capital').areaKm2>3.2);
 assert.ok(m.get('trade').areaKm2>1.8);
 assert.ok(m.get('blackridge').areaKm2>2.4);
 assert.ok(m.get('temple').areaKm2>m.get('frontier').areaKm2);
 assert.ok(m.get('farm').activityKm2>m.get('farm').areaKm2);
 assert.equal(m.get('blackridge').districts.length,5);
 assert.ok(m.get('blackridge').districts.some(d=>d.name.includes('亡命者')));
 assert.ok(m.get('capital').districts.some(d=>d.name.includes('亜人')));
});
test('sheet-based place identity: temple is a non-commercial ruin, blackridge is multi-species national capital',()=>{
 const m=new Map(settlements.map(s=>[s.id,s]));
 assert.equal(m.get('temple').type,'ruins-not-city');
 assert.equal(m.get('blackridge').type,'multi-species-capital');
 assert.ok(m.get('frontier').description.includes('巡礼'));
 assert.ok(m.get('elf').description.includes('人間向け宿'));
 assert.ok(m.get('dwarf').description.includes('地下'));
});
test('all fifteen routes have correct macro endpoints, hazards and intentional non-shortest detours',()=>{
 const ids=['dwarf:fortress','fortress:blackridge','trade:fortress','trade:dwarf','dwarf:blackridge',
 'trade:capital','trade:temple','trade:crime','temple:frontier','farm:temple','capital:temple',
 'capital:farm','capital:forest','forest:elf','forest:blackridge'];
 const loc=new Map(places.map(v=>[v.id,v]));
 assert.equal(routes.length,15);
 for(let i=0;i<routes.length;i++){
  const r=routes[i];assert.equal(r.id,'R'+String(i+1).padStart(2,'0'));
  assert.equal(r.from+':'+r.to,ids[i]);
  assert.deepEqual(r.path[0],loc.get(r.from).center);
  assert.deepEqual(r.path.at(-1),loc.get(r.to).center);
  assert.ok(r.path.length>=4,'detour waypoints '+r.id);
 }
 assert.equal(routes.find(r=>r.id==='R08').type,'sea');
 assert.equal(routes.find(r=>r.id==='R14').type,'maze-conditional');
 assert.ok(routes.find(r=>r.id==='R14').notes.includes('到達不可'));
 assert.ok(alternatePaths.some(p=>p.kind==='monster-trail'));
 assert.ok(hazards.some(h=>h.kind==='habitat'));
});
test('rivers have geographically authored courses AND width ranges separate from drawn exaggeration',()=>{
 assert.ok(waterways.length>=5);
 for(const r of waterways){assert.ok(r.path.length>=5);assert.ok(r.visualWidthPx>0);assert.ok(r.widthMeters[0]>0);}
 assert.ok(waterways.some(r=>r.id==='capital-fork'));
 assert.ok(waterways.some(r=>r.id==='elf-cascade'));
 assert.ok(landUse.some(z=>z.kind==='agricultural'));
});
test('export remains proposed design data, never overwrites live NPC/quest/save semantics',()=>{
 const json=exportBlueprint();
 assert.equal(json.status,'PROPOSED; independent from live 3D runtime');
 assert.ok(json.areaNote.includes('Perspective'));
 assert.equal(json.routes.length,15);
 assert.ok(!JSON.stringify(json).includes('npcState'));
});
