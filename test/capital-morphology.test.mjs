import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPITAL,elevationAt,terrainBaseAt,distance,distanceToLine} from '../public/capital-review/capital-data.js';
import {findAlternatives} from '../public/capital-review/capital-routing.js';
import {buildingParts} from '../public/capital-review/capital-courtyards.js';
import {buildStreetBlocks} from '../public/capital-review/capital-blocks.js';
import {benchElevation,surveyedHeightAt} from '../public/capital-review/capital-terraces.js';
import {pointInPolygon} from '../public/capital-review/capital-data.js';
test('street enclosure splits crossings into four real blocks and ignores a dead-end spur',()=>{
 const core=[[0,0],[.2,0],[.2,.2],[0,.2]],walls=core.map((p,i)=>({id:'w'+i,points:[p,core[(i+1)%4]]}));
 const edges=[{id:'east-west',points:[[0,.1],[.2,.1]]},{id:'north-south',points:[[.1,0],[.1,.2]]},{id:'dead-end',points:[[.1,.05],[.15,.05]]}];
 const blocks=buildStreetBlocks({core,walls,edges,inside:pointInPolygon});
 assert.equal(blocks.length,4);assert.ok(blocks.every(b=>Math.abs(b.areaM2-10000)<.01));
});
test('ordinary buildings occupy a surveyed street block before their footprint is accepted',()=>{
 const blocks=new Map(CAPITAL.streetBlocks.map(b=>[b.id,b]));assert.ok(blocks.size>300);
 for(const b of CAPITAL.buildings.filter(b=>b.frontage)){
  const block=blocks.get(b.blockId);assert.ok(block,b.id+' has no enclosed land parcel');
  const c=Math.cos(b.rotationRad),s=Math.sin(b.rotationRad);
  for(const [u,v]of [[-1,-1],[1,-1],[1,1],[-1,1]])assert.ok(pointInPolygon([b.position[0]+(u*b.widthM*c-v*b.depthM*s)/2000,b.position[1]+(u*b.widthM*s+v*b.depthM*c)/2000],block.polygon),b.id+' crosses its street block');
 }
});
test('bench levels contain actual flat land and continuous retaining transitions',()=>{
 assert.equal(benchElevation(36),46);assert.equal(benchElevation(55),46);
 assert.equal(benchElevation(68),78);assert.equal(benchElevation(88),78);
 for(let h=14;h<300;h+=.01)assert.ok(Math.abs(benchElevation(h+.001)-benchElevation(h))<.061,'discontinuous datum at '+h);
});
test('switchback stairs have two-metre level landings in the physical surface',()=>{
 const e={points:[[0,0],[.06,0]],streetHeightsM:[0,18],stairLayout:'contour-switchback'};
 assert.ok(surveyedHeightAt(e,[.008,0])<surveyedHeightAt(e,[.010,0]));
 assert.equal(surveyedHeightAt(e,[.010,0]),surveyedHeightAt(e,[.012,0]));
 assert.equal(surveyedHeightAt(e,[.060,0]),18);
 assert.ok(CAPITAL.edges.some(e=>e.stairLayout==='contour-switchback'));
 for(const e of CAPITAL.edges.filter(e=>e.streetHeightsM)){assert.equal(e.points.length,e.streetHeightsM.length,e.id);assert.ok(e.streetHeightsM.every(Number.isFinite),e.id);}
});
test('courtyard residents share the physical pedestrian graph and evacuate through city streets',async()=>{
 const {trafficPlans,trafficAgents}=await import('../public/capital-review/capital-traffic.js'),{obstacleAt}=await import('../public/capital-review/capital-spatial.js');
 for(const hour of [7,12,18]){const plans=trafficPlans({hour}).filter(p=>p.id.startsWith('courtyard-'));assert.equal(plans.length,3);
  for(let t=0;t<120;t+=3)for(const agent of trafficAgents(plans,t))assert.equal(obstacleAt(agent.position,{hour}),null,agent.id+' inside a mass');
 }
 const plan=trafficPlans({events:{T16:'active'}}).find(p=>p.id==='courtyard-ajin');assert.ok(plan.oneWay);assert.equal(plan.to,'inn');assert.ok(plan.route.edges.length>3);
});
test('inhabited courtyard loops are open in shared mass geometry and continuously walkable both ways',async()=>{
 const {sampleLine,moveWalker,obstacleAt}=await import('../public/capital-review/capital-spatial.js');
 assert.ok(CAPITAL.courtyards.length>=10);assert.ok(new Set(CAPITAL.courtyards.map(c=>c.district)).size>=3);
 for(const c of CAPITAL.courtyards){const b=CAPITAL.buildings.find(b=>b.id===c.parcelId);
  assert.equal(buildingParts(b).length,4);assert.equal(obstacleAt(c.position,{access:'permitted'}),null,c.id+' court is solid');
  for(const part of b.parts)assert.ok(obstacleAt(part.position,{access:'permitted'}),part.id+' wing is not solid');
  const es=c.edgeIds.map(id=>CAPITAL.edges.find(e=>e.id===id));assert.equal(es.length,3);
  const line=[...es[0].points,...es[1].points.slice(1),...es[2].points.slice(1)];
  for(const points of [line,[...line].reverse()]){let pos=points[0];for(const target of sampleLine(points,.5).slice(1)){const step=moveWalker(pos,target.map((v,i)=>(v-pos[i])*1000),{access:'public'});assert.equal(step.blocked,null,c.id+' '+step.blocked);assert.ok(distance(step.position,target)<.001);pos=step.position;}}
 }
});
test('ordinary city streets and bridge approaches never inherit terrace cliff grades',async()=>{
 const {sampleLine,edgeHeightAt}=await import('../public/capital-review/capital-surfaces.js');
 assert.equal(sampleLine([[0,0],[0,0],[.001,0]],2).length,2,'zero-length road points must not create undefined grades');
 for(const e of CAPITAL.edges.filter(e=>!['world','stairs','roof'].includes(e.class))){const points=sampleLine(e.points,2);
  for(let i=1;i<points.length;i++){const grade=Math.abs(edgeHeightAt(e,points[i])-edgeHeightAt(e,points[i-1]))/distance(points[i],points[i-1]);assert.ok(grade<=.200001,e.id+' physical grade '+grade);}
 }
});
test('surveyed plots have real street-facing doors, measured setbacks and level foundations',()=>{
 const plots=CAPITAL.buildings.filter(b=>b.frontage),roads=new Map(CAPITAL.edges.map(e=>[e.id,e]));assert.ok(plots.length>2000);
 assert.equal(new Set(CAPITAL.buildings.map(b=>b.id)).size,CAPITAL.buildings.length,'building IDs collide across repeated survey geometries');
 assert.equal(new Set(CAPITAL.frontageRows.map(r=>r.id)).size,CAPITAL.frontageRows.length,'survey row IDs collide');
 for(const b of plots){const f=b.frontage,e=roads.get(b.frontageEdgeId),dx=(f.position[0]-b.position[0])*1000,dy=(f.position[1]-b.position[1])*1000;
  assert.ok(Math.abs(dx*f.tangent[0]+dy*f.tangent[1])<.001,b.id+' door displaced along facade');
  assert.ok(Math.abs(Math.hypot(dx,dy)-b.depthM/2)<.001,b.id+' door not on facade');
  assert.ok(Math.abs(distanceToLine(f.position,e.points)-e.widthM/2-f.setbackM)<.15,b.id+' wrong setback');
  assert.ok(Math.abs(elevationAt(...b.position)-b.benchHeightM)<.001,b.id+' foundation does not match plot');
 }
});
test('street walls contain joined parcel runs rather than uniformly separated boxes',()=>{
 const buildings=new Map(CAPITAL.buildings.map(b=>[b.id,b]));let joined=0;
 for(const row of CAPITAL.frontageRows)for(let i=1;i<row.parcels.length;i++){const a=buildings.get(row.parcels[i-1]),b=buildings.get(row.parcels[i]);if(distance(a.position,b.position)-(a.widthM+b.widthM)/2<1.1)joined++;}
 assert.ok(joined>1000,'street walls need continuous surveyed frontage');
});
test('city walls have a substantial curtain and shared physical wall and gate towers',async()=>{
 const {obstacleAt}=await import('../public/capital-review/capital-spatial.js');
 assert.ok(CAPITAL.walls.every(w=>w.heightM>=30&&w.widthM>=8));assert.ok(CAPITAL.fortifications.length>60);
 for(const t of CAPITAL.fortifications)assert.equal(obstacleAt(t.position,{access:'permitted'}),'mass:'+t.id);
 for(const g of CAPITAL.gates)assert.equal(obstacleAt(g.position,{access:'permitted'}),null,g.id+' portal blocked');
});
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
 const ordinary=CAPITAL.buildings.filter(b=>!b.facilityId&&!b.outside),coverage=ordinary.flatMap(buildingParts).reduce((n,b)=>n+b.widthM*b.depthM,0)/(CAPITAL.core.areaKm2*1e6);
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
 const faces=CAPITAL.surveyedRetainingFaces.flatMap(f=>f.lines);
 const readable=faces.filter(([a,b])=>{const p=[(a[0]+b[0])/2,(a[1]+b[1])/2],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);return Math.abs(elevationAt(p[0]-dy/len*.012,p[1]+dx/len*.012)-elevationAt(p[0]+dy/len*.012,p[1]-dx/len*.012))>15;});
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
