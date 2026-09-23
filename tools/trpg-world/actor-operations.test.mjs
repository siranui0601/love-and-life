import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt} from './validation/action-domain.mjs';
function fixture(){return {revision:'actor-execution-contract',time:{scale:60,startSeconds:25200},regions:[{id:'farm',name:'町',size:160,spawn:[0,0,0],obstacles:[],portals:[],objects:[
 {id:'office',name:'役所',kind:'landmark',position:[0,0,1]}, {id:'original',name:'配達記録',kind:'landmark',position:[1,0,0]},
 {id:'meeting',name:'宿の玄関',kind:'landmark',position:[10,0,0]}, {id:'post',name:'王城',kind:'landmark',position:[32,0,0]}, {id:'inn',name:'旅人宿',kind:'inn',position:[0,0,-2]}]}],routes:[],
 npcs:[{id:'clerk',name:'文官',role:'役人',region:'farm',home:[0,0,1],work:[0,0,1],workFacilityId:'office'},
 {id:'guard',name:'衛兵',region:'farm',home:[10,0,0],work:[10,0,0]},
 {id:'resident',name:'住民',region:'farm',home:[32,0,0],work:[32,0,0]},
 {id:'attacker',name:'旅人',region:'farm',home:[-20,0,0],work:[-20,0,0],money:0,possessions:{blade:1}}],
 events:[{id:'danger',name:'襲撃の危険',region:'farm',position:[32,0,0],startsAt:32400,deadline:80000,sourceIds:['attack']}],causalScenarios:[],
 items:[{id:'blade',name:'短剣',price:20},{id:'supplies',name:'携帯食',kind:'food',price:5}],skills:[],jobs:[],equipment:[],monsters:[],
 processes:[{id:'review',kind:'inquiry',eventId:'danger',sourceId:'attack',region:'farm',targetId:'office',name:'警備照合',observation:'当番表が置かれている。',initial:{},order:'restore-guard',reviewers:['clerk'],documents:[{id:'roster',targetId:'original',text:'差し替えの記録。'}],enforcement:{actorId:'guard',meetingId:'meeting',postId:'post',protectActorId:'resident',routeIds:[],modes:['foot'],stoppedOperations:['attack'],text:'王城の住民を警護する。'}}],
 actorOperations:[{id:'attack',actorId:'attacker',targetActorId:'resident',targetSiteId:'post',intention:'王城で相手を襲うつもりだ。',departAt:9*3600,searchSeconds:4*3600,routeIds:[],modes:['foot'],weaponItemId:'blade',windupSeconds:60,damage:75}]};}
const at=(r,id,type,parameter={})=>{const result=performAt(r,r.view().region.objects.find(o=>o.id===id),type,parameter);assert(!result.error,JSON.stringify(result));};
const submit=r=>{at(r,'office','process',{action:'review/inspect'});at(r,'original','interact',{action:'inspect'});at(r,'office','process',{action:'review/submit'});};

test('written order is delivered face-to-face, guard deploys and physically intercepts a later real assault',()=>{
 const c=fixture(),r=new WorldReplay(c);submit(r);r.command({type:'resume'});r.advance(6);
 const order=r.state.processes.review.order;assert.equal(order.execution.status,'delivering');assert(!Object.keys(r.state.duties).length);assert(!r.state.npcs.guard.knowledge.some(k=>k.id===`order-copy:${order.factId}`));
 const saved=r.fork();for(const run of [r,saved]){
  at(run,'inn','rest');
  const op=run.state.actorOperations.attack;assert.equal(op.phase,'restrained',JSON.stringify({op,duties:run.state.duties,guard:run.state.npcs.guard.position,attacker:run.state.npcs.attacker.position}));
  assert.equal(run.state.npcs.resident.hp,70);assert.equal(run.state.npcs.attacker.detention.status,'held');assert.equal(run.state.npcs.attacker.detention.custodianId,'guard');
  assert.equal(run.state.events.danger.status,'resolved');
  const delivery=run.state.socialFacts.find(f=>f.kind==='field-order-delivered');assert.equal(delivery.targetId,'guard');assert(Math.abs(delivery.position[0]-10)<3);
  const stopped=run.state.socialFacts.find(f=>f.id===op.stopFactId);assert.equal(stopped.actorId,'guard');assert(stopped.at>delivery.at);assert(stopped.payload.attemptFactId);
 }
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));assert.deepEqual(r.defects,[]);
});

test('without delivered protection the actual attacker reaches the victim and harms them; life continues',()=>{
 const c=fixture(),r=new WorldReplay(c);at(r,'inn','rest');
 assert.equal(r.state.actorOperations.attack.phase,'completed');assert.equal(r.state.npcs.resident.hp,0);assert(r.state.socialFacts.some(f=>f.kind==='assault'));
 assert(!r.state.npcs.attacker.detention);assert(r.state.player.hp>0);
 const meal=r.options().find(o=>o.command.type==='eat');assert(meal);assert(!r.select(meal).error);at(r,'inn','rest');at(r,'inn','rest');
 assert.equal(r.state.events.danger.status,'failed');assert(r.state.player.hp>0);assert(!r.state.player.collapse);
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('a normal unseen pickpocket can remove an actual weapon and prevent the assault without any order',()=>{
 const c=fixture();c.npcs.find(n=>n.id==='attacker').home=[0,0,1];const r=new WorldReplay(c,{seed:1});
 const theft=r.command({type:'affordance',action:'pickpocket',targetId:'attacker'});assert(!theft.error);assert.equal(theft.result.outcome,'succeeded');
 assert.equal(r.state.player.inventory.blade,1);assert.equal(r.state.npcs.attacker.possessions.blade,0);at(r,'inn','rest');
 assert.equal(r.state.actorOperations.attack.phase,'withdrawn');assert.equal(r.state.npcs.resident.hp,70);assert.equal(r.state.processes.review.order,undefined);assert.equal(r.state.events.danger.status,'resolved');
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('issued order with no recipient cannot become a guard or protect an unseen victim',()=>{
 const c=fixture();c.npcs=c.npcs.filter(n=>n.id!=='guard');const r=new WorldReplay(c);submit(r);at(r,'inn','rest');
 assert.equal(r.state.processes.review.order.status,'issued');assert(!Object.keys(r.state.duties).length);assert.equal(r.state.npcs.resident.hp,0);assert(!r.state.npcs.guard);
});

test('saved windup has no immediate damage and continues the same later physical strike',()=>{
 const c=fixture();c.actorOperations[0].departAt=25200;c.actorOperations[0].windupSeconds=600;const r=new WorldReplay(c);
 r.command({type:'resume'});for(let i=0;i<100&&r.state.actorOperations.attack.hitAt===undefined;i++)r.advance(1);
 assert(r.state.actorOperations.attack.hitAt);assert.equal(r.state.npcs.resident.hp,70);
 const saved=r.fork();for(const run of [r,saved])run.advance(15);
 assert.equal(r.state.npcs.resident.hp,0);assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('a person who takes an ordinary route during windup cannot be struck at stale local coordinates',()=>{
 const c=fixture();c.time.startSeconds=12*3600+55*60;c.actorOperations[0].departAt=c.time.startSeconds;c.actorOperations[0].windupSeconds=1800;
 c.npcs.find(n=>n.id==='attacker').home=[32,0,1];c.npcs.find(n=>n.id==='resident').role='行商人';
 c.routes=[{id:'road',from:'farm',to:'other',minutes:60,modes:['foot']}];c.regions[0].portals=[{id:'exit',routeId:'road',to:'other',position:[40,0,0]}];
 c.regions.push({id:'other',name:'別の町',size:160,spawn:[32,0,0],objects:[],obstacles:[],portals:[{id:'back',routeId:'road',to:'farm',position:[40,0,0]}]});
 const r=new WorldReplay(c);r.command({type:'resume'});r.advance(1);assert(r.state.actorOperations.attack.hitAt);r.advance(40);
 assert(r.state.npcs.resident.travel||r.state.npcs.resident.region==='other');assert.equal(r.state.npcs.resident.hp,70);assert(!r.state.socialFacts.some(f=>f.kind==='assault'));
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('canonical attacker executes the authored physical assault at the scheduled audience, not an event death effect',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));
 c.time.startSeconds=c.actorOperations[0].departAt-600;const r=new WorldReplay(c,{seed:4});
 const inn=c.regions.find(region=>region.id==='farm').objects.find(o=>o.kind==='inn');assert(!performAt(r,inn,'rest').error);
 const op=r.state.actorOperations['palace-assault'];assert.equal(op.phase,'completed',JSON.stringify({op,attacker:r.state.npcs.NPC020.position,king:r.state.npcs.NPC016.position,activity:r.state.npcs.NPC016.activity}));
 assert.equal(r.state.npcs.NPC016.hp,0);const fact=r.state.socialFacts.find(f=>f.id===op.resultFactId);assert.equal(fact.actorId,'NPC020');assert.equal(fact.targetId,'NPC016');assert.equal(fact.payload.damage,75);
 assert(r.state.player.hp>0);assert.deepEqual(r.defects,[]);
});

test('new hostile operations stay dormant on a restored older world, retaining its real people and possessions',()=>{
 const c=fixture(),old={...c,revision:'old-world',actorOperations:[]},r=new WorldReplay(old);
 const restored=new WorldReplay(c,{initialState:r.state});restored.command({type:'resume'});restored.advance(120);
 assert(restored.state.actorOperations.attack.legacyDormant);assert.equal(restored.state.npcs.resident.hp,70);assert.equal(restored.state.npcs.attacker.possessions.blade,1);
 assert(!restored.state.npcs.attacker.knowledge.some(k=>k.id==='intention:attack'));
 assert.equal(digest(replay(c,restored.export()).state),digest(restored.state));
});
