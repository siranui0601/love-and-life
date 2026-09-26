import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canOccupy,distance,findPath,findStreetPath,followPath,pathIsTraversable,hasLineOfSight} from '../../src/shared/trpg-world/navigation.js';
import {arrivalPosition,journeyLocation} from '../../src/shared/trpg-world/travel-space.js';
import {createWorld,advanceWorld,projectWorld} from '../../src/shared/trpg-world/simulation.js';
import {reconcileGeometry} from '../../src/server/trpg/world/geometry-migration.js';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt} from './validation/action-domain.mjs';
import {createRegion} from './region-layout.mjs';
const content=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));

test('reordering source facility rows cannot move semantic places or silently substitute a new site',()=>{
 const source=JSON.parse(fs.readFileSync(new URL('./sources/world.json',import.meta.url)));
 for(const r of content.regions){
  const sheet=source.sheets.find(s=>s.title===r.name),spec=[r.id,r.name,r.biome,r.color,r.worldPosition,r.description];
  const reordered=createRegion(spec,{...sheet,rows:[...sheet.rows].reverse()},source.sourceUrl);
  for(const site of reordered.objects.filter(o=>o.source?.id)){
   const canonical=r.objects.find(o=>o.id===site.id);assert.deepEqual(site.position,canonical.position);assert.deepEqual(site.buildingPosition,canonical.buildingPosition);
  }
  const broken=structuredClone(sheet),row=broken.rows.find(row=>/^LOC_/.test(row[0]||''));row[0]+='_RENAMED';
  assert.throws(()=>createRegion(spec,broken,source.sourceUrl),/site IDs/);
 }
});

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

test('every authored inhabitant has an explicit residence or nonresidential base with a reachable room',()=>{
 const rooms=new Set();
 for(const n of content.npcs){
  const region=content.regions.find(r=>r.id===n.region),home=region.residences.find(h=>h.id===n.residenceId);
  assert(home?.residentIds.includes(n.id),n.id);assert.equal(home.siteId,n.homeFacilityId);assert(!rooms.has(n.roomId));rooms.add(n.roomId);
  const site=region.objects.find(o=>o.id===home.siteId);assert(site);assert(canOccupy(region,n.home));
  const commute=findStreetPath(region,n.home,n.work);assert(commute.length,n.id);assert(pathIsTraversable(region,n.home,commute),n.id);
 }
 const n=id=>content.npcs.find(n=>n.id===id);
 assert.equal(n('NPC001').residenceId,n('NPC002').residenceId,'Finn lives with his mother');
 assert.equal(n('NPC016').homeFacilityId,'LOC_CAP_CASTLE','king does not live in orphanage');
 for(const id of ['NPC021','NPC022','NPC071','NPC072'])assert.equal(n(id).homeFacilityId,'LOC_CAP_ORPHANAGE');
 assert.notEqual(n('NPC064').residenceId,n('NPC015').residenceId,'innkeeper and visiting envoy are not a household');
 assert.equal(n('NPC034').residenceMode,'habitat');assert.equal(n('NPC057').residenceMode,'depot');
});

test('residents leave their authored home for work through ordinary world advancement and keep the commute across reload',()=>{
 const run=new WorldReplay(content,{seed:1}),template=content.npcs.find(n=>n.id==='NPC067');
 assert.deepEqual(run.state.npcs.NPC067.position,template.home);run.command({type:'resume'});run.advance(30);
 assert(distance(run.state.npcs.NPC067.position,template.home)>1);
 const saved=run.fork();for(const r of [run,saved]){r.advance(150);assert(distance(r.state.npcs.NPC067.position,template.work)<2);}
 assert.equal(digest(run.state),digest(saved.state));assert.equal(digest(replay(content,run.export()).state),digest(run.state));
});

test('an employed resident physically returns from work and evening rest to their own home at night',()=>{
 // Isolate the commute from a late-start crisis attack at the player's spawn.
 // This is a planner fixture, not an all-crisis survival worldline.
 const c={...content,monsters:[],time:{...content.time,startSeconds:16*3600}},r=new WorldReplay(c,{seed:1}),n=content.npcs.find(n=>n.id==='NPC067');
 r.command({type:'resume'});r.advance(60);assert(distance(r.state.npcs.NPC067.position,n.work)<2);
 const inn=r.view().region.objects.find(o=>o.id==='LOC_FARM_INN'),rest=performAt(r,inn,'rest');assert(!rest.error,JSON.stringify(rest));
 r.command({type:'resume'});r.advance(60);
 assert.equal(r.state.npcs.NPC067.goal,'sleep');assert(distance(r.state.npcs.NPC067.position,n.home)<2);
 assert.notEqual(n.homeFacilityId,'LOC_CAP_LOWER_INN');assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('street locomotion keeps authored bends and falls back safely when a street is blocked',()=>{
 const region={size:80,obstacles:[],spatial:{stage:'street-cluster'},terrain:{paths:[{points:[[0,0,0],[0,0,20],[20,0,20]],width:4}]}};
 const path=findStreetPath(region,[0,0,0],[20,0,20]);assert(path.some(p=>p[0]===0&&p[2]===20));
 const npc={id:'resident',position:[0,0,0]};followPath(region,npc,[20,0,20],10);assert.equal(npc.position[0],0);assert(npc.position[2]>9);
 const blocked=structuredClone(region);blocked.obstacles=[{x:0,z:10,width:4,depth:2,height:5}];
 const detour=findStreetPath(blocked,[0,0,0],[20,0,20]);assert(detour.length);assert(pathIsTraversable(blocked,[0,0,0],detour));
});

test('functional thresholds have usable two-way doors without exposing a whole room to the street',()=>{
 for(const region of content.regions)for(const o of region.objects.filter(o=>o.interior?.threshold)){
  const t=o.interior.threshold;
  for(const [a,b] of [[o.position,t.inside],[t.inside,o.position]]){const path=findPath(region,a,b);assert(path.length,o.id);assert(pathIsTraversable(region,a,path),o.id);}
  const wall=t.walls[0],outside=[wall.x,0,wall.z+2],inside=[wall.x,0,wall.z-2];
  assert(!hasLineOfSight(region,outside,inside),`${o.id}: solid frontage must screen its interior`);
  assert(hasLineOfSight(region,t.approach,t.inside),`${o.id}: an open door remains visible`);
 }
 const region=content.regions.find(r=>r.id==='farm'),house=region.objects.find(o=>o.id==='farm:eda-house'),t=house.interior.threshold;
 assert.equal(t.opening,1.8);assert.equal(house.buildingPosition[0]%2,-1,'door is deliberately between coarse grid columns');
 const blocked={...region,obstacles:[...region.obstacles,{id:'closed-door',x:house.buildingPosition[0],z:house.interior.entrance[2],width:t.opening,depth:.4,height:3.8}]};
 assert.equal(findPath(blocked,house.position,t.inside).length,0,'connector cannot pass a physical closure');
});

test('a house front occludes its resident in the actual player projection; signs expose only business identification',()=>{
 const state=createWorld(content,{seed:1}),region=content.regions.find(r=>r.id==='farm'),n=state.npcs.NPC004;
 const house=region.objects.find(o=>o.id==='farm:eda-house'),front=house.interior.entrance[2];
 // Initial viewing position is a perception fixture, not an executed worldline.
 state.player.position=[n.position[0],0,front+2];
 assert(!projectWorld(state,content).npcs.some(actor=>actor.id===n.id));
 const view=projectWorld(state,content),bakery=view.region.objects.find(o=>o.id==='LOC_FARM_BAKERY');
 assert.equal(bakery.signage.text,bakery.name);assert(!view.region.objects.find(o=>o.id===house.id).signage);
 assert(!('residences' in view.region));assert(!('settlement' in view.region));
 const capital=content.regions.find(r=>r.id==='capital');assert(!capital.objects.find(o=>o.id==='LOC_CAP_BIG_STORE').signage,'future land use is not a current shop sign');
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
