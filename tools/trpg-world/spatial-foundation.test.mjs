import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canOccupy,distance,findPath,findStreetPath,followPath,pathIsTraversable,hasLineOfSight} from '../../src/shared/trpg-world/navigation.js';
import {arrivalPosition,journeyLocation} from '../../src/shared/trpg-world/travel-space.js';
import {createWorld,advanceWorld} from '../../src/shared/trpg-world/simulation.js';
import {reconcileGeometry} from '../../src/server/trpg/world/geometry-migration.js';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt} from './validation/action-domain.mjs';
const content=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));

test('source semantic sites and actual entrances remain reachable after street and outskirts rebuilding',()=>{
 const source=JSON.parse(fs.readFileSync(new URL('./sources/world.json',import.meta.url)));
 for(const region of content.regions){
  const ids=source.sheets.find(s=>s.title===region.name).rows.filter(r=>/^LOC_/.test(r[0]||'')).map(r=>r[0]);
  assert.deepEqual(region.objects.filter(o=>o.source?.id?.startsWith('LOC_')).map(o=>o.id),ids);
  for(const object of region.objects)for(const point of [object.position,object.interior?.entrance].filter(Boolean)){
   assert(canOccupy(region,point),object.id);const path=findPath(region,region.spawn,point);assert(path.length,object.id);assert(pathIsTraversable(region,region.spawn,path),object.id);
  }
  for(const mouth of region.portals)assert(findPath(region,region.spawn,mouth.position).length,mouth.id);
 }
});

test('street locomotion keeps authored bends and falls back safely when a street is blocked',()=>{
 const region={size:80,obstacles:[],spatial:{stage:'street-cluster'},terrain:{paths:[{points:[[0,0,0],[0,0,20],[20,0,20]],width:4}]}};
 const path=findStreetPath(region,[0,0,0],[20,0,20]);assert(path.some(p=>p[0]===0&&p[2]===20));
 const npc={id:'resident',position:[0,0,0]};followPath(region,npc,[20,0,20],10);assert.equal(npc.position[0],0);assert(npc.position[2]>9);
 const blocked=structuredClone(region);blocked.obstacles=[{x:0,z:10,width:4,depth:2,height:5}];
 const detour=findStreetPath(blocked,[0,0,0],[20,0,20]);assert(detour.length);assert(pathIsTraversable(blocked,[0,0,0],detour));
});

test('at-grade street crossings connect without endpoint coincidence and exhausted paths can resume',()=>{
 const region={size:100,obstacles:[],spatial:{stage:'street-cluster'},terrain:{paths:[{points:[[-40,0,0],[40,0,0]]},{points:[[0,0,-40],[0,0,40]]}]}};
 const path=findStreetPath(region,[-40,0,0],[0,0,40]);
 assert(path.some(p=>distance(p,[0,0,0])<.01),'must turn at the real crossing');
 const npc={position:[-40,0,0],path:[],pathTarget:[0,0,40],pathUsesStreets:true};
 followPath(region,npc,[0,0,40],10);assert(distance(npc.position,[-40,0,0])>9);
});

test('functional districts and supply/visitor circuits bind existing facilities and remain collision-safe',()=>{
 for(const id of ['farm','capital','trade']){
  const r=content.regions.find(r=>r.id===id);assert(r.settlement);
  assert.equal(r.settlement.simulatedResidents,content.npcs.filter(n=>n.region===id).length);
  for(const f of r.settlement.flows)for(const leg of f.legs){assert(leg.metres>0);assert(pathIsTraversable(r,leg.points[0],leg.points.slice(1)),`${id}/${f.id}`);}
 }
 const cap=content.regions.find(r=>r.id==='capital');
 assert(!hasLineOfSight(cap,[0,0,40],[0,0,8]),'loading court screens the market approach');
 assert(hasLineOfSight(cap,[-16,0,25],[-16,0,8]),'the side passage reveals the next street');
 assert(findPath(cap,[0,0,40],[0,0,8]).length,'a reveal wall must not close the city');
 const forest=content.regions.find(r=>r.id==='forest');
 assert.notEqual(forest.objects.find(o=>o.id==='LOC_FOREST_RIVER').kind,'inn');
 assert.notEqual(forest.objects.find(o=>o.id==='LOC_FOREST_MONSTER_NEST').kind,'inn');
});

test('all corridor legs have reciprocal mouths and direction-independent spatial progress',()=>{
 for(const route of content.routes){
  assert.equal(route.spatial.baseline.minutes,route.sourceMinutes);
  assert.equal(route.spatial.baseline.mode,route.id==='R08'?'ship':'foot');
  const forward={from:route.from,to:route.to,routeId:route.id,departedAt:100,arrivesAt:500,mode:'foot'};
  const reverse={...forward,from:route.to,to:route.from};
  assert.equal(journeyLocation(content,forward,200).progress,.25);assert.equal(journeyLocation(content,reverse,400).progress,.25);
  assert.deepEqual(arrivalPosition(content,forward),content.regions.find(r=>r.id===route.to).portals.find(p=>p.routeId===route.id).position);
 }
});

test('ordinary new-game footsteps and travel arrive at the opposite road approach and replay across a save',()=>{
 const r=new WorldReplay(content,{seed:4}),mouth=r.view().region.portals.find(p=>p.routeId==='R12');
 assert(!performAt(r,mouth).error);assert(!r.command({type:'travel',portalId:mouth.id,mode:'foot'}).error);
 assert.equal(r.state.player.region,'capital');assert.deepEqual(r.state.player.position,arrivalPosition(content,{from:'farm',to:'capital',routeId:'R12'}));
 const saved=r.fork();for(const run of [r,saved]){run.command({type:'resume'});run.command({type:'input',x:-1,z:0});run.advance(1);run.command({type:'input',x:0,z:0});}
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(content,r.export()).state),digest(r.state));
});

test('persistent habitat residents move between authored resources while distant from the player',()=>{
 const state=createWorld(content,{seed:7}),wolf=Object.values(state.monsters).find(m=>m.templateId==='MON-0009');
 const habitat=content.regions.find(r=>r.id===wolf.region).habitats.find(h=>h.id===wolf.habitatId);
 assert.deepEqual(wolf.position,habitat.nest);assert.equal(state.player.region,'farm');
 // New-game fixtures differ only in the initial calendar, not final positions.
 const evening={...content,time:{...content.time,startSeconds:19*3600}},run=createWorld(evening,{seed:1}),before=structuredClone(run.monsters[wolf.id]);
 advanceWorld(run,evening,60);
 assert.equal(run.monsters[wolf.id].habitatId,habitat.id);assert(distance(run.monsters[wolf.id].position,before.position)>0);
 const copy=structuredClone(run);advanceWorld(run,evening,2);advanceWorld(copy,evening,2);assert.deepEqual(run,copy);
});

test('reviewed geometry migration only repairs overlapping bodies and invalid paths, never history or ownership',()=>{
 const state={player:{id:'player',region:'test',position:[0,0,0]},npcs:{n:{id:'n',region:'test',position:[6,0,0],path:[[8,0,0]],pathTarget:[8,0,0]}},monsters:{},socialFacts:[{id:'fact',position:[0,0,0]}],properties:{letter:{ownerId:'n',custodianId:'player'}}};
 const before=structuredClone(state),c={regions:[{id:'test',size:40,obstacles:[{x:0,z:0,width:2,depth:2,height:3}]}]};
 const changes=reconcileGeometry(state,c);assert.equal(changes.length,1);assert(distance(state.player.position,before.player.position)<=8);assert(canOccupy(c.regions[0],state.player.position));
 assert.deepEqual(state.npcs,before.npcs);assert.deepEqual(state.socialFacts,before.socialFacts);assert.deepEqual(state.properties,before.properties);
 assert.deepEqual(reconcileGeometry(state,c),[]);
});
