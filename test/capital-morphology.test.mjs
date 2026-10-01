import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPITAL,elevationAt} from '../public/capital-review/capital-data.js';
test('castle is the terrain and massing apex above ordinary city strata',()=>{
 const n=id=>CAPITAL.nodes.find(n=>n.id===id),castle=CAPITAL.facilities.find(f=>f.id==='LOC_CAP_CASTLE');
 assert.ok(elevationAt(...n('castle').position)>elevationAt(...n('market').position)+100);
 assert.ok(elevationAt(...n('royal_gate').position)>elevationAt(...n('market').position)+35);
 assert.ok(castle.footprintM[0]*castle.footprintM[1]>=58000);assert.equal(CAPITAL.royalParts.length,5);
});
test('dense core has substantial roof coverage and a finer grain in lower neighbourhoods',()=>{
 const ordinary=CAPITAL.buildings.filter(b=>!b.facilityId&&!b.outside),coverage=ordinary.reduce((n,b)=>n+b.widthM*b.depthM,0)/(CAPITAL.core.areaKm2*1e6);
 assert.ok(coverage>.27&&coverage<.55,coverage);
 const avg=id=>{const bs=ordinary.filter(b=>b.district===id);return bs.reduce((n,b)=>n+b.widthM*b.depthM,0)/bs.length;};
 assert.ok(avg('lower')<avg('noble'));
 assert.ok(ordinary.filter(b=>b.frontageEdgeId).length>700);
 assert.ok(ordinary.every(b=>b.roofHeightM>=4||(b.lowRoofFabric&&b.heightM<5)));
});
test('small block loops and protected courts create choices beyond principal streets',()=>{
 assert.ok(CAPITAL.urbanBlocks.length>=20);
 for(const block of CAPITAL.urbanBlocks){assert.ok(CAPITAL.nodes.some(n=>n.position===block.court));assert.ok(CAPITAL.edges.some(e=>e.points.some(p=>p===block.court)));}
});

test('outskirts are sparse roadside buildings, with no copied wall-scale district',()=>{
 assert.ok(CAPITAL.suburbBuildings.length>=15);
 assert.ok(CAPITAL.suburbBuildings.every(b=>b.outside&&b.heightM<13));
 assert.ok(CAPITAL.suburbBuildings.length<CAPITAL.buildings.length/20);
});

test('physical streets have unique IDs and major alternatives diverge in physical distance',async()=>{
 const {findAlternatives,routeOverlap}=await import('../public/capital-review/capital-routing.js');
 assert.equal(new Set(CAPITAL.edges.map(e=>e.id)).size,CAPITAL.edges.length);
 for(const gate of ['west_gate','south_gate','east_gate']){const paths=findAlternatives(gate,'market',{access:'public'});assert.ok(paths.length>=2);assert.ok(routeOverlap(paths[0],paths[1])<.74);}
});
