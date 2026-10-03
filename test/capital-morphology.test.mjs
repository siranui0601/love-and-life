import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPITAL,elevationAt,terrainBaseAt,distance,distanceToLine} from '../public/capital-review/capital-data.js';
import {findAlternatives} from '../public/capital-review/capital-routing.js';
test('selecting the same route endpoint returns a stationary route without corridor search',()=>{
 const routes=findAlternatives('market','market');
 assert.equal(routes.length,1);assert.equal(routes[0].edges.length,0);
});
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


test('every ordinary core parcel fronts an existing physical lane instead of unserviced scatter',()=>{
 const roads=new Map(CAPITAL.edges.map(e=>[e.id,e]));
 for(const b of CAPITAL.buildings.filter(b=>!b.facilityId&&!b.royalPart&&!b.outside)){
  const e=roads.get(b.frontageEdgeId);assert.ok(e,b.id+' has no street');
  assert.ok(distanceToLine(b.position,e.points)<=Math.hypot(b.widthM,b.depthM)/2+e.widthM/2+5,b.id+' too far from frontage');
 }
});
test('all neighbourhood lanes connect to the authored graph at real junctions',()=>{
 const adjacent=new Map(CAPITAL.nodes.map(n=>[n.id,[]]));for(const e of CAPITAL.edges){adjacent.get(e.from).push(e.to);adjacent.get(e.to).push(e.from);}
 const found=new Set(['market']),queue=['market'];for(let i=0;i<queue.length;i++)for(const n of adjacent.get(queue[i]))if(!found.has(n)){found.add(n);queue.push(n);}
 const lanes=CAPITAL.edges.filter(e=>e.fabric);assert.ok(lanes.length>300);
 for(const e of lanes){assert.ok(found.has(e.from)&&found.has(e.to));assert.equal(e.points[0],CAPITAL.nodes.find(n=>n.id===e.from).position);}
});
test('castle benches expose substantial local relief and the distributary stays on one river datum',()=>{
 const faces=CAPITAL.retainingFaces.flatMap(f=>f.points),centre=CAPITAL.hillCentre;
 const readable=faces.filter(p=>{const dx=p[0]-centre[0],dy=p[1]-centre[1],len=Math.hypot(dx,dy);return elevationAt(p[0]-dx/len*.012,p[1]-dy/len*.012)-elevationAt(p[0]+dx/len*.012,p[1]+dy/len*.012)>15;});
 assert.ok(readable.length>60,'terraces need exposed relief, not just endpoint height metadata');
 const water=CAPITAL.rivers[0];for(const p of water.points)assert.ok(Math.abs(terrainBaseAt(...p)-14)<.001,'river climbs the hill');
 const n=id=>CAPITAL.nodes.find(n=>n.id===id);assert.ok(elevationAt(...n('castle').position)-elevationAt(...n('market').position)>190);
});


test('royal investigation detours do not collide with duplicate checkpoints on split streets',async()=>{
 const {shortestPath,pathPolyline}=await import('../public/capital-review/capital-routing.js'),{sampleLine,moveWalker,activeBarriers}=await import('../public/capital-review/capital-spatial.js');
 for(const [event,from,to]of [['T11','market','castle'],['T17','office','mage_tower']]){
  const state={access:'permitted',events:{[event]:'active'}},route=shortestPath(from,to,state);assert.ok(route);
  const barriers=activeBarriers(state),points=sampleLine(pathPolyline(route),3);
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],result=moveWalker(a,[(b[0]-a[0])*1000,(b[1]-a[1])*1000],state,{barriers});assert.equal(result.blocked,null,event+' '+b);}
 }
});
