import test from 'node:test';
import assert from 'node:assert/strict';
import {terrain,settlements,areaOf,pointInPolygon,fromRef} from '../public/world-blueprint/geography.js';
import {
 levelZones,waterDragon,initialDragonState,advanceDragonEcology,
 aidDragon,bondDragon,canRideDragon
} from '../public/world-blueprint/level-design.js';
const nearly=(a,b,e=.002)=>assert.ok(Math.abs(a-b)<e,'Expected '+a+' ≈ '+b);

test('Ancient Temple precinct is smaller than actual cities; outer pilgrimage/excavation landscape remains',()=>{
 const map=new Map(settlements.map(s=>[s.id,s]));
 const temple=map.get('temple'),capital=map.get('capital'),blackridge=map.get('blackridge');
 nearly(temple.areaKm2,areaOf(temple.points),.0001);
 assert.ok(temple.areaKm2>4&&temple.areaKm2<15,'compact recognisable Ancient Temple precinct');
 assert.ok(temple.areaKm2<capital.areaKm2/2,'temple no longer rivals Royal Capital in extent');
 assert.ok(temple.areaKm2<blackridge.areaKm2/2,'temple no longer rivals the Blackridge urban precinct');
 assert.ok(temple.activityKm2>temple.areaKm2*3,'pilgrim landscape is separate from actual ruins');
 assert.ok(pointInPolygon(fromRef([566,766]),temple.points),'old R09 temple endpoint remains inside ruins');
});
test('Southeast water dragon exists as a unique non-trouble fauna inside a dry basin',()=>{
 assert.equal(waterDragon.classification,'unique-wildlife-optional');
 assert.ok(!/^T\d/.test(waterDragon.id));
 assert.equal(waterDragon.referencePoint.length,2);
 assert.ok(waterDragon.referencePoint[0]>1100&&waterDragon.referencePoint[1]>770);
 assert.ok(pointInPolygon(waterDragon.point,terrain.find(t=>t.id==='drylands').points));
 assert.ok(pointInPolygon(waterDragon.point,waterDragon.basin));
 assert.ok(waterDragon.nonTroubleRule.includes('死'));
 assert.equal(waterDragon.resolutionPaths.length,2);
 assert.ok(waterDragon.optionalConnections.some(x=>x.id==='T13'&&x.status==='proposal'));
});
test('Level design uses observable warnings, multiple choices, and no linear minimum-level gates',()=>{
 assert.ok(levelZones.length>=8);
 assert.ok(levelZones.every(z=>z.points.length>=4&&z.reading&&z.choices));
 const ids=new Set(levelZones.map(z=>z.id));
 assert.ok(ids.has('royal-roads')&&ids.has('farm-wolf-fringe')&&ids.has('north-pass'));
 assert.ok(ids.has('forest-deep')&&ids.has('temple-sealed')&&ids.has('dry-basin'));
 assert.ok(levelZones.find(z=>z.id==='dry-basin').kind==='optional-ecology');
});
test('No contact and a declining water basin can cause individual death without touching T01–T19',()=>{
 let state=initialDragonState();
 assert.equal(state.life,'alive');assert.equal(state.ridingUnlocked,false);
 const dead=advanceDragonEcology(state,1100,{surfaceWater:'dry',prey:'none',t13Escalated:true});
 assert.equal(dead.life,'dead');assert.equal(dead.vitality,0);
 assert.equal(canRideDragon(dead,'river'),false);
 assert.equal(advanceDragonEcology(dead,8).life,'dead');
 assert.deepEqual(advanceDragonEcology(state,0),state,'paused game must not advance the dragon');
 assert.throws(()=>advanceDragonEcology(state,-1));
});
test('World-time starvation integrates consistently between batch advance and smaller steps',()=>{
 const initial=initialDragonState(),environment={surfaceWater:'scarce',prey:'scarce'};
 const combined=advanceDragonEcology(initial,315,environment);
 let stepwise=initial;
 for(let i=0;i<63;i++)stepwise=advanceDragonEcology(stepwise,5,environment);
 nearly(combined.nutrition,stepwise.nutrition,.00001);
 nearly(combined.hydration,stepwise.hydration,.00001);
 nearly(combined.vitality,stepwise.vitality,.00001);
});
test('Feeding or nonlethal domination can offer riding, but not on contact or while weakened',()=>{
 const initial=initialDragonState();
 assert.equal(bondDragon(initial,{method:'care',careVisits:2}).ridingUnlocked,false);
 assert.equal(bondDragon(initial,{method:'dominance',nonlethalVictory:true}).ridingUnlocked,false,
  'physically incapacitated starvation cannot be ignored by domination');
 const healthy=aidDragon(initial,{fishKg:16,waterLitres:100});
 assert.ok(healthy.nutrition>=60&&healthy.hydration>=55);
 const cared=bondDragon(healthy,{method:'care',careVisits:2});
 assert.equal(cared.ridingUnlocked,true);assert.equal(cared.bond,'care');
 const firstVisit=bondDragon(healthy,{method:'care',careVisits:1});
 assert.equal(firstVisit.ridingUnlocked,false);
 const forciblyPrepared=aidDragon(initial,{fishKg:6,waterLitres:25});
 const dominated=bondDragon(forciblyPrepared,{method:'dominance',nonlethalVictory:true});
 assert.equal(dominated.ridingUnlocked,true);
 assert.equal(canRideDragon(cared,'river'),true);
 assert.equal(canRideDragon(cared,'safe-coast'),true);
 assert.equal(canRideDragon(cared,'open-land-with-water'),true);
 assert.equal(canRideDragon(cared,'forest-maze'),false);
 assert.equal(canRideDragon(cared,'mountain-pass'),false);
 assert.equal(canRideDragon(cared,'underground'),false);
 assert.equal(canRideDragon({...cared,hydration:10},'river'),false);
});
