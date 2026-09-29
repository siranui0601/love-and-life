import test from 'node:test';
import assert from 'node:assert/strict';
import {
 WORLD,mainland,crimeIsland,terrain,settlements,places,routes,
 areaOf,pointInPolygon,landAreaKm2,seaAreaKm2,exportBlueprint
} from '../public/world-blueprint/geography.js';
const eq=(a,b,e=.002)=>assert.ok(Math.abs(a-b)<e,'Expected '+a+' ~= '+b);
test('whole world uses a 48 x 36 km frame and an honest coast-to-sea ratio',()=>{
 assert.equal(WORLD.areaKm2,48*36);
 eq(landAreaKm2+seaAreaKm2,WORLD.areaKm2,.001);
 assert.ok(landAreaKm2>1210&&landAreaKm2<1250,'near the planned ~1,240km² land ratio');
 assert.ok(seaAreaKm2>475&&seaAreaKm2<520);
 eq(areaOf(crimeIsland),4.5);
});
test('the Forest is exactly a 220km² terrain, NOT a tiny settlement marker',()=>{
 const forest=terrain.find(t=>t.id==='emerald-forest');
 assert.ok(forest);eq(areaOf(forest.points),220);
 assert.equal(settlements.find(s=>s.id==='forest'),undefined);
 assert.equal(places.find(s=>s.id==='forest')?.type,'terrain');
 assert.ok(pointInPolygon([35.8,17.9],forest.points));
 assert.ok(pointInPolygon([43.3,17.3],forest.points),'Elven village is inside the forest');
});
test('all ten actual settlement footprints preserve the agreed km² ratios',()=>{
 const agreed={capital:3.2,trade:1.8,blackridge:2.4,crime:.85,fortress:.40,dwarf:.12,farm:.15,temple:.35,frontier:.07,elf:.30};
 assert.equal(settlements.length,Object.keys(agreed).length);
 for(const s of settlements){
  eq(areaOf(s.points),agreed[s.id],.001);
  eq(areaOf(s.activity),s.activityKm2,.001);
  assert.ok(s.points.every(([x,y])=>x>=0&&x<=48&&y>=0&&y<=36),'footprint within frame: '+s.id);
  const ground=s.id==='crime'?crimeIsland:mainland;
  assert.ok(pointInPolygon(s.center,ground),'city placed on the actual landmass: '+s.id);
 }
 assert.ok(areaOf(settlements.find(s=>s.id==='capital').points)>areaOf(settlements.find(s=>s.id==='farm').points)*15);
 eq(areaOf(settlements.find(s=>s.id==='farm').activity),6);
});
test('the fifteen routes connect the correct sites without declaring off-road travel illegal',()=>{
 const ids=['dwarf:fortress','fortress:blackridge','trade:fortress','trade:dwarf','dwarf:blackridge','trade:capital','trade:temple','trade:crime','temple:frontier','farm:temple','capital:temple','capital:farm','capital:forest','forest:elf','forest:blackridge'];
 const placesById=new Map(places.map(s=>[s.id,s]));
 assert.equal(routes.length,15);
 for(let i=0;i<routes.length;i++){
  const r=routes[i];assert.equal(r.id,'R'+String(i+1).padStart(2,'0'));
  assert.equal(r.from+':'+r.to,ids[i]);
  assert.deepEqual(r.points[0],placesById.get(r.from).center);
  assert.deepEqual(r.points.at(-1),placesById.get(r.to).center);
  assert.ok(r.points.every(p=>p.length===2&&p.every(Number.isFinite)));
 }
 assert.equal(routes.find(r=>r.id==='R08').type,'sea');
 assert.equal(routes.find(r=>r.id==='R10').to,'temple');
});
test('geographic design is serializable and independent from runtime NPC/crisis state',()=>{
 const data=exportBlueprint();
 assert.equal(data.world.widthKm,48);assert.equal(data.world.heightKm,36);
 assert.equal(data.terrain.length,6);
 assert.ok(!JSON.stringify(data).includes('causalScenarios'));
 assert.ok(!JSON.stringify(data).includes('npcState'));
});
