import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt} from './validation/action-domain.mjs';
function fixture(){return {revision:'person-custody-contract',time:{scale:60,startSeconds:25200},regions:[
 {id:'farm',name:'町',size:160,spawn:[0,0,0],obstacles:[],portals:[{id:'out',routeId:'road',to:'other',position:[40,0,0]}],objects:[
 {id:'office',kind:'landmark',name:'役所',position:[0,0,1]},{id:'original',kind:'landmark',name:'原本',position:[0,0,2]},
 {id:'inn',kind:'inn',name:'宿',position:[0,0,-2]},{id:'meeting',kind:'landmark',name:'詰所',position:[8,0,0]},{id:'post',kind:'landmark',name:'市場',position:[24,0,0]}]},
 {id:'other',name:'隣町',size:160,spawn:[0,0,0],obstacles:[],portals:[{id:'back',routeId:'road',to:'farm',position:[40,0,0]}],objects:[{id:'holding',kind:'landmark',name:'倉庫',position:[24,0,0]},{id:'other-inn',kind:'inn',name:'宿屋',position:[0,0,-2]}]}],
 routes:[{id:'road',from:'farm',to:'other',minutes:60,modes:['foot']}],
 npcs:[{id:'captor',name:'運び屋',role:'住民',region:'farm',home:[24,0,1],work:[24,0,1],money:0,possessions:{rope:1}},
 {id:'person',name:'旅人',region:'farm',home:[24,0,0],work:[24,0,0]},
 {id:'guard',name:'衛兵',region:'farm',home:[8,0,0],work:[8,0,0]},
 {id:'clerk',name:'文官',role:'文官',region:'farm',home:[0,0,1],work:[0,0,1],workFacilityId:'office'}],
 events:[{id:'danger',name:'身柄引渡し',region:'farm',position:[24,0,0],startsAt:32400,deadline:150000,sourceIds:['coercion']}],causalScenarios:[],
 items:[{id:'rope',name:'縄',price:5}],skills:[],jobs:[],equipment:[],monsters:[],
 processes:[{id:'review',kind:'inquiry',eventId:'danger',sourceId:'coercion',region:'farm',targetId:'office',name:'身柄審理',observation:'同意のない契約がある。',initial:{},order:'protect-person',reviewers:['clerk'],documents:[{id:'contract',targetId:'original',text:'本人の同意がない。'}],enforcement:{actorId:'guard',meetingId:'meeting',postId:'holding',protectActorId:'person',custodySiteId:'meeting',routeIds:['road'],modes:['foot'],stoppedOperations:['seizure'],text:'本人を保護する。'}}],
 actorOperations:[{id:'seizure',kind:'seize-person',actorId:'captor',targetActorId:'person',targetSiteId:'post',holdingSiteId:'holding',intention:'無理に連れて行く。',departAt:25200,searchSeconds:4*3600,routeIds:['road'],modes:['foot'],restraintItemId:'rope',windupSeconds:60}]};}
const at=(r,id,type,parameter={})=>{const view=r.view(),target=view.region.objects.find(o=>o.id===id)||view.region.portals.find(o=>o.id===id)||view.npcs.find(n=>n.id===id);const result=performAt(r,target,type,parameter);assert(!result.error,JSON.stringify(result));};
function until(r,predicate,max=240){r.command({type:'resume'});for(let i=0;i<max&&!predicate();i++)r.advance(1);assert(predicate(),JSON.stringify({custody:r.state.personCustodies,operation:r.state.actorOperations,duties:r.state.duties,npcs:Object.values(r.state.npcs).map(n=>({id:n.id,region:n.region,position:n.position,travel:n.travel,goal:n.goal,activity:n.activity}))}));}

test('coercion consumes a real restraint; both bodies walk to the portal and share a saved journey',()=>{
 const c=fixture(),r=new WorldReplay(c);until(r,()=>!!r.state.npcs.captor.travel);
 const captive=r.state.npcs.person;assert(captive.captive);assert.equal(r.state.npcs.captor.possessions.rope,0);assert.equal(captive.travel.leaderId,'captor');assert.equal(captive.travel.departedAt,r.state.npcs.captor.travel.departedAt);
 assert(Math.abs(captive.position[0]-40)<4);assert.equal(r.state.events.danger.status,'latent');
 const saved=r.fork();for(const run of [r,saved]){
  until(run,()=>Object.values(run.state.personCustodies).some(s=>s.phase==='held'));
  assert.equal(run.state.npcs.person.region,'other');assert(Math.abs(run.state.npcs.person.position[0]-24)<4);
  const arrival=run.state.socialFacts.find(f=>f.kind==='custody-arrival');assert.equal(arrival.region,'other');assert.equal(arrival.actorId,'captor');
  assert(!run.state.npcs.person.ownerId);assert(!run.state.player.collapse);
 }
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('a delivered protection order leads to observed release, actual restraint of captor and physical detention transport',()=>{
 const c=fixture(),r=new WorldReplay(c);at(r,'office','process',{action:'review/inspect'});at(r,'original','interact',{action:'inspect'});at(r,'office','process',{action:'review/submit'});
 until(r,()=>r.state.npcs.captor.detention?.status==='held');
 assert(!r.state.npcs.person.captive);assert(r.state.npcs.person.releasedFromCustody);assert.equal(r.state.actorOperations.seizure.phase,'restrained');
 assert.equal(r.state.npcs.guard.region,'other');assert.equal(r.state.npcs.captor.region,'other');
 const saved=r.fork();for(const run of [r,saved]){
  until(run,()=>Object.values(run.state.personCustodies).some(c=>c.personId==='captor'&&c.phase==='held'));
  assert.equal(run.state.npcs.captor.region,'farm');assert(Math.abs(run.state.npcs.captor.position[0]-8)<4);
  assert(['prevented','resolved'].includes(run.state.events.danger.status));
  const release=run.state.socialFacts.find(f=>f.kind==='person-released');assert.equal(release.actorId,'guard');assert.equal(release.region,'other');
 }
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('the player can free unattended restraints and escort the actual person through an ordinary route',()=>{
 const c=fixture();c.time.startSeconds=21*3600;c.actorOperations[0].departAt=c.time.startSeconds;const r=new WorldReplay(c);
 until(r,()=>Object.values(r.state.personCustodies||{}).some(c=>c.phase==='held'));
 at(r,'out','travel',{portalId:'out',mode:'foot'});
 until(r,()=>r.state.npcs.captor.goal==='sleep');
 at(r,'person','causal',{action:'free-restraints'});assert(!r.state.npcs.person.captive);
 at(r,'person','causal',{action:'escort'});assert.equal(r.state.npcs.person.companionOf,'player');
 // Walking commands bring both participants to the exit; travel may only carry
 // the nearby companion, never the same ID at another region's coordinates.
 const exit=r.view().region.portals.find(p=>p.id==='back');
 const walk=performAt(r,exit);assert(!walk.error,JSON.stringify(walk));
 until(r,()=>Math.abs(r.state.npcs.person.position[0]-40)<4,30);
 const saved=r.fork();for(const run of [r,saved]){const result=run.command({type:'travel',portalId:'back',mode:'foot'});assert(!result.error,JSON.stringify(result));assert.equal(run.state.player.region,'farm');assert.equal(run.state.npcs.person.region,'farm');assert(!run.state.npcs.person.travel);}
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('missing itinerary leaves restrained people at their actual location, without an arrival or outcome receipt',()=>{
 const c=fixture();c.actorOperations[0].routeIds=[];const r=new WorldReplay(c);r.command({type:'resume'});r.advance(120);
 const custody=Object.values(r.state.personCustodies)[0];assert.equal(custody.phase,'conveying');assert.equal(custody.blockedReason,'no-known-itinerary');assert.equal(r.state.npcs.person.region,'farm');assert(!r.state.socialFacts.some(f=>f.kind==='custody-arrival'));assert.notEqual(r.state.events.danger.status,'resolved');
});

test('canonical trafficker finds the real person, captures and transports them through the authored connected regions',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));
 c.time.startSeconds=c.actorOperations.find(o=>o.id==='coerced-transfer').departAt-600;const r=new WorldReplay(c,{seed:4});
 const inn=r.view().region.objects.find(o=>o.kind==='inn');
 // Reciprocal road-mouth arrivals now require crossing each settlement on
 // both legs. Allow two days of real travel and the target's overnight absence;
 // the previous four-rest budget assumed arrival at every settlement centre.
 for(let i=0;i<8&&r.state.actorOperations['coerced-transfer'].phase!=='holding';i++){
  if(r.state.player.hunger>45){const meal=r.options().find(o=>o.command.type==='eat');assert(meal);assert(!r.select(meal).error);}
  assert(!performAt(r,inn,'rest').error);
 }
 const op=r.state.actorOperations['coerced-transfer'];assert.equal(op.phase,'holding',JSON.stringify({op,actor:r.state.npcs.NPC033,person:r.state.npcs.NPC027}));
 assert.equal(r.state.npcs.NPC027.region,'crime');assert.equal(r.state.npcs.NPC027.captive.custodianId,'NPC033');
 const custody=r.state.personCustodies[op.custodyId];assert(custody.arrivalFactId);assert.equal(r.state.socialFacts.find(f=>f.id===custody.restraintFactId).region,'elf');assert.equal(r.state.socialFacts.find(f=>f.id===custody.arrivalFactId).region,'crime');assert(!r.state.player.collapse);
});
