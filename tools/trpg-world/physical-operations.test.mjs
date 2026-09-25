import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt} from './validation/action-domain.mjs';
import {DEFAULT_STRUCTURES} from '../../src/shared/trpg-world/infrastructure.js';
function fixture(kind='ignite-structure'){
 const fire=kind==='ignite-structure',s=structuredClone(DEFAULT_STRUCTURES[1]);Object.assign(s,{id:'store',targetId:'site',region:'farm',hazardEventId:'hazard',shelterId:'inn',causeOperations:['attempt']});
 return {revision:'physical-attempts',time:{scale:60,startSeconds:25200},regions:[{id:'farm',name:'村',size:160,spawn:[-40,0,0],objects:[{id:'site',kind:'landmark',name:'仕事場',position:[0,0,0]},{id:'inn',kind:'inn',name:'宿',position:[-40,0,0]},{id:'shop',kind:'shop',name:'道具店',position:[-40,0,2]}],portals:[],obstacles:[]}],routes:[],
 npcs:[{id:'actor',name:'訪問者',region:'farm',home:[-40,0,1],work:[-40,0,1],money:0,possessions:{reagent:1}},{id:'patient',name:'仕事場の人',region:'farm',home:[0,0,0],work:[0,0,0],workFacilityId:'site'}],
 items:[{id:'reagent',name:'包み',kind:'material',price:1},{id:'supplies',name:'携帯食',kind:'food',price:2},{id:'antidote',name:'解毒薬',kind:'consumable',price:2}],skills:[],jobs:[],equipment:[],monsters:[],
 events:[{id:'hazard',name:'危険',region:'farm',position:[0,0,0],startsAt:8*3600,deadline:12*3600,sourceIds:['cause']}],
 causalScenarios:fire?[{eventId:'hazard',type:'infrastructure',structures:['store']}]:[],structures:fire?[s]:[],
 processes:fire?[]:[{id:'care',kind:'patient',eventId:'hazard',sourceId:'cause',region:'farm',targetId:'patient',actorId:'patient',name:'薬と容体',observation:'処方箋がある。',causeOperations:['attempt'],initial:{treated:false,exposed:false},damagePerHour:2}],
 actorOperations:[{id:'attempt',kind,actorId:'actor',targetSiteId:'site',...(fire?{structureId:'store'}:{targetActorId:'patient',patientProcessId:'care'}),intention:'渡された包みを現地で使う。',departAt:8*3600,searchSeconds:3600,routeIds:[],modes:['foot'],windupSeconds:300,requiredResources:{reagent:1}}]};
}
const at=(r,id,type,parameter={})=>{const target=r.view().region.objects.find(o=>o.id===id)||r.view().npcs.find(n=>n.id===id);const result=performAt(r,target,type,parameter);assert(!result.error,JSON.stringify(result));};

for(const kind of ['ignite-structure','administer-substance'])test(`${kind} needs actual material, presence and a saved temporal execution, never just a calendar threshold`,()=>{
 const c=fixture(kind),r=new WorldReplay(c);r.command({type:'resume'});for(let i=0;i<150&&!r.state.actorOperations.attempt.hitAt;i++)r.advance(1);
 assert(r.state.actorOperations.attempt.hitAt);assert.equal(r.state.npcs.patient.hp,70);assert(!r.state.structures.store?.fire);assert(!r.state.processes.care?.exposed);
 const saved=r.fork();for(const run of [r,saved]){at(run,'inn','rest');assert.equal(run.state.actorOperations.attempt.phase,'completed');assert.equal(run.state.npcs.actor.possessions.reagent,0);assert(run.state.npcs.patient.hp<70);assert(run.state.socialFacts.some(f=>f.actorId==='actor'&&f.kind===(kind==='ignite-structure'?'ignition':'substance-administered')));assert(run.state.player.hp>0);}
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

for(const kind of ['ignite-structure','administer-substance'])test(`ordinary pickpocket removes the actual ${kind} material and the actor abandons it without a victory action`,()=>{
 const c=fixture(kind),r=new WorldReplay(c,{seed:1});const attempt=r.command({type:'affordance',action:'pickpocket',targetId:'actor'});assert(!attempt.error);assert.equal(attempt.result.outcome,'succeeded');assert.equal(r.state.player.inventory.reagent,1);at(r,'inn','rest');
 assert.equal(r.state.actorOperations.attempt.phase,'withdrawn');assert.equal(r.state.npcs.patient.hp,70);assert(!r.state.structures.store?.fire);assert(!r.state.processes.care?.exposed);assert(['resolved','prevented'].includes(r.state.events.hazard.status));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('ordinary cleanup removes the fuel before arrival; no actor or deadline can ignite absent fuel',()=>{
 const c=fixture(),r=new WorldReplay(c);at(r,'site','maintain',{action:'remove-fuel'});at(r,'inn','rest');assert.equal(r.state.structures.store.fire,0);assert.equal(r.state.actorOperations.attempt.phase,'withdrawn');assert.equal(r.state.npcs.actor.possessions.reagent,1);assert.equal(r.state.npcs.patient.hp,70);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('an absent actor causes neither unseen ignition nor a poison injury at the deadline',()=>{
 for(const kind of ['ignite-structure','administer-substance']){const c=fixture(kind);c.npcs.find(n=>n.id==='actor').region='other';c.regions.push({id:'other',name:'遠い町',size:100,spawn:[0,0,0],objects:[],portals:[],obstacles:[]});const r=new WorldReplay(c);at(r,'inn','rest');assert.equal(r.state.npcs.patient.hp,70);assert(!r.state.processes.care?.exposed);assert(!r.state.structures.store?.damageAt);assert(!r.state.socialFacts.some(f=>['ignition','substance-administered'].includes(f.kind)));}
});

test('purchased antidote secures medication before an actual attempt; later symptoms require an exposure fact',()=>{
 const c=fixture('administer-substance'),r=new WorldReplay(c);at(r,'shop','interact',{action:'inspect'});at(r,'shop','buy',{itemId:'antidote'});at(r,'site');at(r,'patient','process',{action:'care/inspect'});at(r,'patient','process',{action:'care/treat'});at(r,'inn','rest');
 assert(r.state.processes.care.medicineSecured);assert(!r.state.processes.care.exposed);assert.equal(r.state.actorOperations.attempt.phase,'withdrawn');assert.equal(r.state.npcs.patient.hp,70);assert.equal(r.state.player.inventory.antidote,0);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('canonical arsonist and servant execute on the production map with existing people and owned resources',()=>{
 for(const id of ['grain-ignition','tainted-medication']){const c=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));c.time.startSeconds=c.actorOperations.find(o=>o.id===id).departAt-3600;const r=new WorldReplay(c,{seed:4});const inn=r.view().region.objects.find(o=>o.kind==='inn');assert(!performAt(r,inn,'rest').error);const op=r.state.actorOperations[id];assert.equal(op.phase,'completed',JSON.stringify(op));assert(r.state.socialFacts.some(f=>f.id===op.resultFactId));if(id==='grain-ignition')assert(r.state.structures['grain-store'].damageAt);else assert(r.state.processes['lord-treatment'].exposureFactId);assert(r.state.player.hp>0);}
});
