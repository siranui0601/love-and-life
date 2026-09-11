import test from 'node:test';
import assert from 'node:assert/strict';
import {PersistentWorldService,hashWorldToken} from '../../src/server/trpg/world/service.js';
import {MemoryWorldStore} from '../../src/server/trpg/world/store.js';
import {createWorld,applyCommand,advanceWorld,advanceMacro} from '../../src/shared/trpg-world/simulation.js';
import {reportCrime,exchangeCrimeMemories} from '../../src/shared/trpg-world/law.js';
import {advanceMemories,testimony,hearTestimony} from '../../src/shared/trpg-world/memory.js';

function setting({seen=true}={}) {
 const region=id=>({id,name:id==='farm'?'村':'隣町',spawn:[0,0,0],size:150,obstacles:[],portals:[],objects:[{id:`inn:${id}`,kind:'inn',name:'宿',position:[0,0,2]}]});
 return {revision:'society-fixture',time:{scale:60,startSeconds:9*3600},regions:[region('farm'),region('town')],routes:[],events:[],causalScenarios:[],
  npcs:[{id:'owner',name:'箱の持ち主',role:'職人',region:'farm',home:seen?[2,0,0]:[36,0,0],work:[0,0,1]},
   {id:'officer',name:'村の衛兵',role:'衛兵',region:'farm',home:[22,0,0],work:[22,0,0]},
   {id:'other-officer',name:'隣町の衛兵',role:'衛兵',region:'town',home:[0,0,0],work:[0,0,0]}],
  items:[{id:'supplies',name:'食料',kind:'food',price:6}],skills:[],equipment:[],monsters:[],jobs:[],
  society:{authorities:[{id:'village-office',jurisdiction:'farm',officerIds:['officer']},{id:'town-office',jurisdiction:'town',officerIds:['other-officer']}],properties:[
   {id:'box',kind:'container',name:'私物箱',ownerId:'owner',custodianId:'owner',privacy:'private',region:'farm',position:[0,0,1],contents:['letter']},
   {id:'letter',kind:'document',name:'私信',ownerId:'owner',custodianId:'owner',privacy:'private',region:'farm',position:[0,0,1],parentId:'box',document:{id:'letter',title:'私信',text:'地下倉庫の鍵を明日届ける。'}}]}};
}
async function harness(content) {
 let now=1000,seq=0;const store=new MemoryWorldStore(),owner=hashWorldToken('society-test');
 let service=new PersistentWorldService({content,store,autoStart:false,now:()=>now});await service.session(owner,{create:true});
 return {command:cmd=>service.command(owner,{seq:++seq,command:cmd}),tick:async seconds=>{for(let s=0;s<seconds;s+=.5){now+=500;await service.state(owner);}},
  read:async()=>{await service.session(owner);return (await store.get(owner)).state;},reload:async()=>{await service.close();now+=86400000;service=new PersistentWorldService({content,store,autoStart:false,now:()=>now});return service.session(owner);},close:()=>service.close()};
}
const property=(h,action,targetId)=>h.command({type:'property',action,targetId});
async function open(h){await property(h,'open','box');await property(h,'look','box');}

test('worldline: unseen theft, save/reload, owner returns and discovers loss without identifying a thief',async()=>{
 const h=await harness(setting({seen:false}));await h.tick(.5);await open(h);
 const before=await h.read();const read=await property(h,'read','letter');assert.equal(read.result.document.text,'地下倉庫の鍵を明日届ける。');
 let s=await h.read();assert.equal(s.properties.letter.custodianId,'owner');assert.equal(s.properties.letter.ownerId,'owner');assert(s.knowledge.some(k=>k.kind==='document'));
 await property(h,'take','letter');s=await h.read();const theft=s.socialFacts.find(f=>f.kind==='theft');assert.equal(theft.witnesses.length,0);assert.equal(s.properties.letter.custodianId,'player');assert.equal(s.properties.letter.ownerId,'owner');
 assert(!s.npcs.owner.memories.some(m=>m.factId===theft.id));const paused=s.time;
 await h.tick(8);assert.equal((await h.read()).time,paused);await h.reload();assert.equal((await h.read()).time,paused);
 await h.command({type:'resume'});await h.tick(45);s=await h.read();assert.equal(s.propertyIncidents[0].status,'loss-discovered');assert(s.npcs.owner.beliefs.some(b=>b.claim==='missing-property'));
 assert(!s.npcs.owner.memories.some(m=>m.factId===theft.id));assert.equal(s.law.warrants.length,0);assert(s.time>before.time);await h.close();
});
test('worldline: witness reports through a searched plan, local inquiry, confession and actual restitution',async()=>{
 const h=await harness(setting());await h.tick(.5);await open(h);await property(h,'take','letter');
 let s=await h.read();const theft=s.socialFacts.find(f=>f.kind==='theft');assert(s.npcs.owner.memories.some(m=>m.factId===theft.id));
 await h.reload();await h.command({type:'resume'});await h.tick(30);s=await h.read();
 assert(s.npcs.owner.planHistory.some(p=>p.goal==='report-crime'&&p.actions.includes('approach-person')&&p.actions.includes('give-report')));
 const warrant=s.law.warrants.find(w=>w.allegedOffense==='theft');assert(warrant);assert.equal(warrant.jurisdiction,'farm');assert.equal(warrant.response,'question');
 assert(!s.npcs['other-officer'].knownWarrantIds?.length);assert(!s.npcs['other-officer'].memories.some(m=>m.factId===theft.id));
 // Walk to the known local officer. No teleport or injected accusation.
 await h.command({type:'input',x:1,z:0});await h.tick(4);await h.command({type:'input',x:0,z:0});
 // HTTP presence intentionally expires held movement; send held input on each tick.
 for(let i=0;i<24;i++){s=await h.read();if(Math.abs(s.player.position[0]-s.npcs.officer.position[0])<3)break;await h.command({type:'input',x:1,z:0});await h.tick(.5);}
 await h.command({type:'input',x:0,z:0});s=await h.read();
 assert(s.npcs.officer.confrontation);const result=await h.command({type:'interact',targetId:'officer',action:'talk'});const conv=result.result.conversation;
 assert(conv.choices.some(c=>c.intent==='BARGAIN'));assert(conv.choices.some(c=>c.intent==='THREATEN'));
 await h.command({type:'converse',sessionId:conv.id,turn:conv.turn,intentId:'law:CONFESS'});
 s=await h.read();assert(s.law.cases.some(c=>c.status==='admitted'));assert(s.socialFacts.some(f=>f.kind==='utterance'&&f.payload.semanticIntent==='CONFESS'));
 await h.close();
});
test('a report cannot manufacture knowledge and a private reader does not reveal document contents to a witness',()=>{
 const c=setting(),s=createWorld(c);advanceWorld(s,c,.5);assert.equal(reportCrime(s,c,s.npcs.owner,s.npcs.officer,'invented'),null);
 applyCommand(s,c,{type:'property',action:'open',targetId:'box'});applyCommand(s,c,{type:'property',action:'look',targetId:'box'});applyCommand(s,c,{type:'property',action:'read',targetId:'letter'});
 const fact=s.socialFacts.find(f=>f.kind==='document-read'),memory=s.npcs.owner.memories.find(m=>m.factId===fact.id);assert(memory);assert(!JSON.stringify(memory).includes('地下倉庫'));assert(!JSON.stringify(fact).includes('地下倉庫'));
 assert.equal(s.properties.letter.ownerId,'owner');assert.equal(s.properties.letter.custodianId,'owner');
 assert.throws(()=>applyCommand(s,c,{type:'property',action:'read',targetId:'unknown'}),/触れられ/);
});
test('memory loses details without erasing history; hearsay can associate a wrong suspect with known clothing',()=>{
 const c=setting(),s=createWorld(c);s.npcs.owner.memoryProfile={habits:'fleeting',interests:[],sourceHabit:'retells',sleepConsolidation:'discard-trivia'};
 s.npcs.officer.position=[8,0,0];s.npcs.officer.memoryProfile={habits:'precise',interests:['property'],sourceHabit:'careful',sleepConsolidation:'retain-salient'};
 advanceWorld(s,c,.5);applyCommand(s,c,{type:'affordance',action:'lie',targetId:'self'});const fact=s.socialFacts.find(f=>f.kind==='body-action');
 const first=s.npcs.owner.memories.find(m=>m.factId===fact.id),second=s.npcs.officer.memories.find(m=>m.factId===fact.id);assert(first&&second);
 // Advance the authoritative macro clock. Initial profiles differ; no final memory state is injected.
 advanceMacro(s,c,'sleeping',3*3600);advanceMemories(s,c);assert(s.socialFacts.some(f=>f.id===fact.id));
 const statement=testimony(s,s.npcs.officer,second);assert.equal(statement.description.actorId,null);
 const listener=s.npcs['other-officer'];listener.beliefs.push({id:'remembered-coat',claim:'recognizes-clothing',appearance:'旅装',about:'innocent'});
 const heard=hearTestimony(s,listener,s.npcs.officer,statement);assert.equal(heard.source.type,'heard');assert.equal(heard.recall.actorId,'innocent');assert.equal(heard.changes[0].beliefId,'remembered-coat');assert.equal(fact.actorId,'player');
});
