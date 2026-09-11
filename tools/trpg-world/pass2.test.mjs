import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PersistentWorldService,hashWorldToken} from '../../src/server/trpg/world/service.js';
import {MemoryWorldStore} from '../../src/server/trpg/world/store.js';
import {searchPlan,planForGoal,advancePlan} from '../../src/shared/trpg-world/npc-planner.js';
import {createWorld} from '../../src/shared/trpg-world/simulation.js';
import {auditWorldContent} from './audit-content.mjs';
const content=JSON.parse(await fs.readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
const fixtureDir=new URL('./fixtures/v1/',import.meta.url);
for(const item of JSON.parse(await fs.readFile(new URL('manifest.json',fixtureDir),'utf8')))test(`real v1 migration, save, reload, deterministic continuation: ${item.sourceRevision}`,async()=>{
 const saved=JSON.parse(await fs.readFile(new URL(item.file,fixtureDir),'utf8')),store=new MemoryWorldStore();await store.put(saved.ownerKey,saved);
 let time=Date.now();const service=new PersistentWorldService({content,store,autoStart:false,now:()=>time});
 const restored=await service.session(saved.ownerKey);assert.equal(restored.view.time,saved.state.time);
 const record=await store.get(saved.ownerKey);assert.equal(record.schemaVersion,2);assert.equal(record.state.schemaVersion,2);
 assert(Object.values(record.state.npcs).every(n=>!Object.hasOwn(n,'trust')));assert(Object.values(record.state.events).every(e=>!Object.hasOwn(e,'pressure')));
 await service.close();
 const store2=new MemoryWorldStore();await store2.put(saved.ownerKey,record);
 const a=new PersistentWorldService({content,store,autoStart:false,now:()=>time}),b=new PersistentWorldService({content,store:store2,autoStart:false,now:()=>time});
 await a.session(saved.ownerKey);await b.session(saved.ownerKey);time+=500;
 const av=await a.state(saved.ownerKey),bv=await b.state(saved.ownerKey);assert.deepEqual(av,bv);assert(Number.isFinite(av.view.simulationTime));
 await a.close();await b.close();
});
function small(){return {revision:'behavior',time:{scale:60,startSeconds:25200},regions:[{id:'farm',name:'村',spawn:[0,0,0],size:100,obstacles:[],portals:[],objects:[{id:'shop',name:'店',kind:'shop',position:[0,0,2]},{id:'inn',name:'宿',kind:'inn',position:[0,0,3]}]}],routes:[],events:[],causalScenarios:[],npcs:[{id:'doctor',name:'医師',role:'医師',region:'farm',home:[1,0,0],work:[1,0,0]},{id:'guard',name:'衛兵',role:'衛兵',region:'farm',home:[-1,0,0],work:[-1,0,0]}],items:[{id:'supplies',name:'食料',kind:'food',price:6}],skills:[],equipment:[],monsters:[],jobs:[]};}
async function harness(c){let now=1000,seq=0;const store=new MemoryWorldStore(),owner=hashWorldToken('behavior-test'),service=new PersistentWorldService({content:c,store,autoStart:false,now:()=>now});await service.session(owner,{create:true});return {service,owner,store,command:cmd=>service.command(owner,{seq:++seq,command:cmd}),tick:async(seconds)=>{for(let s=0;s<seconds;s+=.5){now+=500;await service.state(owner);}},read:async()=>{await service.session(owner);return (await store.get(owner)).state;}};}

test('real service: posture creates witness interpretations without directly settling a crisis',async()=>{
 const c=small(),h=await harness(c);await h.tick(.5);const before=await h.read();await h.command({type:'affordance',action:'lie',targetId:'self'});const s=await h.read();
 assert.equal(s.socialFacts.at(-1).kind,'body-action');assert.equal(s.player.posture,'lie');assert.deepEqual(s.events,before.events);
 assert.equal(s.npcs.doctor.beliefs.at(-1).claim,'ill');assert.equal(s.npcs.guard.beliefs.at(-1).claim,'intoxicated');
 await h.tick(6);const later=await h.read();assert.equal(later.npcs.doctor.goal,'investigate-observation');await h.service.close();
});

test('real service: theft transfers money, unseen success does not reveal culprit; victim discovers loss later',async()=>{
 const c=small();c.npcs=c.npcs.slice(0,1);const h=await harness(c);await h.tick(.5);let before=await h.read(),after,incident;
 for(let tries=0;tries<64;tries++){before=await h.read();await h.command({type:'affordance',action:'pickpocket',targetId:'doctor'});after=await h.read();incident=after.propertyIncidents.at(-1);if(incident.amount>0)break;}
 assert(incident.amount>0);assert.equal(after.player.gold-before.player.gold,incident.amount);assert.equal(before.npcs.doctor.money-after.npcs.doctor.money,incident.amount);
 assert.deepEqual(after.socialFacts.find(f=>f.id===incident.factId).witnesses,[]);assert(!after.npcs.doctor.memories.some(m=>m.factId===incident.factId));
 await h.tick(31);after=await h.read();assert.equal(after.propertyIncidents.find(i=>i.id===incident.id).status,'loss-discovered');assert(!after.npcs.doctor.memories.some(m=>m.factId===incident.factId));await h.service.close();
});

test('planner searches alternatives and invalidates when a required resource disappears',()=>{
 const c=small(),s=createWorld(c),n=s.npcs.doctor;n.money=8;n.hunger=80;
 const goal={goal:'eat',target:[1,0,0]};n.plan=planForGoal(s,c,n,c.npcs[0],goal);
 assert(n.plan.steps.some(a=>a.action==='purchase-food'));assert(n.plan.steps.some(a=>a.action==='consume-food'));
 for(let i=0;n.plan?.steps[n.plan.cursor]?.action==='move'&&i<100;i++)advancePlan(s,c,n,60);
 s.regions.farm.stock=0;advancePlan(s,c,n,60);assert.equal(n.lastPlan.status,'invalidated');assert.equal(n.plan.status,'blocked');
 assert.deepEqual(searchPlan({a:false},{a:true},[{action:'do',preconditions:{a:false},effects:{a:true},cost:1}]).map(x=>x.action),['do']);
});

test('compiler audit rejects resurrected numeric relationship and pressure authority',()=>{
 assert(auditWorldContent(content).ok);const bad=structuredClone(content);bad.events[0].pressure=0;bad.npcs[0].trust=1;
 const report=auditWorldContent(bad);assert(!report.ok);assert(report.errors.some(e=>e.includes('pressure')));assert(report.errors.some(e=>e.includes('trust')));
});

test('real service: attack acceptance has no damage; hit window resolves while calendar is paused',async()=>{
 const c=small();c.npcs=[];c.regions[0].size=160;c.regions[0].spawn=[-49,0,-45];
 c.monsters=[{id:'rat',name:'野鼠',region:'farm',level:1,hp:35,attack:1,defense:0,xp:20,gold:3,role:'minion',speed:2,range:2.8,drops:[]}];
 const h=await harness(c),before=await h.read(),targetId=Object.keys(before.monsters)[0];
 const result=await h.command({type:'attack',targetId});assert.equal(result.result.phase,'windup');
 let s=await h.read();assert.equal(s.monsters[targetId].hp,before.monsters[targetId].hp);assert.equal(s.player.actionInstance.phase,'windup');
 await h.tick(.5);s=await h.read();assert.equal(s.time,before.time);assert(s.simulationTime>before.simulationTime);assert(s.monsters[targetId].hp<before.monsters[targetId].hp);assert.equal(s.player.actionInstance.resolved,true);await h.service.close();
});
test('real service: conversation waiting freezes calendar and repeated greetings confer no social reward',async()=>{
 const h=await harness(small());await h.tick(.5);const before=await h.read();
 for(let i=0;i<3;i++){await h.command({type:'interact',targetId:'doctor',action:'talk'});await h.tick(3);await h.command({type:'resume'});}
 const after=await h.read();assert.equal(after.time,before.time);assert.equal(after.player.xp,before.player.xp);assert.equal(after.promises.length,0);assert(!Object.hasOwn(after.npcs.doctor,'trust'));await h.service.close();
});
test('real service: NPC buys and eats using a persistent multi-step plan during a player macro activity',async()=>{
 const h=await harness(small());await h.command({type:'rest',targetId:'inn',hours:6});const s=await h.read();
 assert(Object.values(s.npcs).some(n=>n.planHistory?.some(p=>p.actions.includes('purchase-food')&&p.actions.includes('consume-food')&&p.actions.includes('move'))));await h.service.close();
});

test('real service: pickpocket transfers an actual medicine stack through the same property path',async()=>{
 const c=small();c.npcs=c.npcs.slice(0,1);c.npcs[0].money=0;c.npcs[0].possessions={medicine:1};const h=await harness(c);await h.tick(.5);const before=await h.read();let s;
 for(let tries=0;tries<64;tries++){await h.command({type:'affordance',action:'pickpocket',targetId:'doctor'});s=await h.read();if(s.propertyTransfers?.length)break;}
 assert.equal(s.npcs.doctor.possessions.medicine,0);assert.equal(s.player.inventory.medicine,before.player.inventory.medicine+1);assert.equal(s.player.gold,before.player.gold);
 assert.equal(s.propertyTransfers.at(-1).assetId,'medicine');assert.equal(s.worldActionHistory.at(-1).status,'completed');assert(s.worldActionHistory.at(-1).createdFactIds.length);await h.service.close();
});
test('interpretation follows knowledge and occupation, never NPC identity',async()=>{
 const {interpretationCandidates}=await import('../../src/shared/trpg-world/interpretation.js');
 const fact={id:'observed',actorId:'player',region:'farm',payload:{action:'lie',nearObjectId:'well'}};
 const npc={id:'arbitrary',beliefs:[{id:'water-report',claim:'unsafe-water',place:{region:'farm',objectId:'well'}}]};
 assert.equal(interpretationCandidates({},npc,{role:'農夫'},fact)[0].claim,'possible-water-hazard');
 npc.beliefs=[];assert.equal(interpretationCandidates({},npc,{role:'医師'},fact)[0].claim,'ill');assert.equal(interpretationCandidates({},npc,{role:'衛兵'},fact)[0].claim,'intoxicated');
});
test('relationship decisions use known attribution, relevance and request risk',async()=>{
 const {evaluateCooperation}=await import('../../src/shared/trpg-world/relationships.js');
 const c=small(),s=createWorld(c),n=s.npcs.doctor;
 const fact={id:'gift',kind:'gift',actorId:'player',targetId:n.id,payload:{neededAtReceipt:true,requested:true},at:s.time};s.socialFacts.push(fact);n.memories.push({factId:fact.id,actorId:'player',source:{type:'seen'}});
 assert(evaluateCooperation(s,n).willing);assert(!evaluateCooperation(s,n,{risk:2}).willing);assert(!evaluateCooperation(s,s.npcs.guard).willing);
 n.beliefs.push({id:'credit',claim:'credit',aboutFactId:'gift',attributedTo:'someone-else',confidence:.9,source:{type:'claimed'}});
 assert(evaluateCooperation(s,n).willing);n.memories[0].source={type:'heard'};assert(!evaluateCooperation(s,n).willing);
});
test('live narrative adapter requires explicit enable and never calls transport while disabled',async()=>{
 const {LiveNarrativeProvider}=await import('../../src/server/trpg/world/narrative.js');let calls=0;
 assert.throws(()=>new LiveNarrativeProvider({transport:async()=>{calls++;}}),/explicit enable/);assert.equal(calls,0);
});

test('a collapsed-save service continuation lets a child seek a visible capable helper and complete actual rescue plans',async()=>{
 const {collapse}=await import('../../src/shared/trpg-world/survival.js');const c=small();c.regions[0].size=160;
 c.npcs=[{id:'child',name:'子供',role:'少女',region:'farm',home:[20,0,0],work:[20,0,0]},{id:'adult',name:'医師',role:'医師',region:'farm',home:[40,0,0],work:[40,0,0]}];
 const store=new MemoryWorldStore(),owner=hashWorldToken('rescue-start');let service=new PersistentWorldService({content:c,store,autoStart:false,now:()=>1000});await service.session(owner,{create:true});await service.close();
 // Initial casualty fixture only: no rescuer, plan, position, completion or outcome is injected.
 const record=await store.get(owner);record.state.player.hp=0;collapse(record.state,c,'hp');await store.put(owner,record);
 service=new PersistentWorldService({content:c,store,autoStart:false,now:()=>1000});await service.session(owner);await service.command(owner,{seq:1,command:{type:'recover'}});await service.close();
 const s=(await store.get(owner)).state;assert.equal(s.player.collapse.status,'recovered');assert.equal(s.player.collapse.rescue.reasoning.reportedBy,'child');
 assert(s.npcs.child.planHistory.some(p=>p.goal==='helper-informed'&&p.actions.join(',')==='move,report'));assert.equal(s.npcs.adult.lastPlan.goal,'casualty-treated');assert(s.socialFacts.some(f=>f.kind==='rescue-request'&&f.actorId==='child'&&f.targetId==='adult'));
 assert(Math.hypot(s.player.position[0],s.player.position[2]-3)<2);
});
test('real service: moving out of the hit volume during windup causes a miss',async()=>{
 const c=small();c.npcs=[];c.regions[0].size=160;c.regions[0].spawn=[-46.9,0,-45];
 c.monsters=[{id:'rat',name:'野鼠',region:'farm',level:1,hp:35,attack:1,defense:0,xp:20,gold:3,role:'minion',speed:0,range:2.8,drops:[]}];
 const h=await harness(c),before=await h.read(),targetId=Object.keys(before.monsters)[0];await h.command({type:'attack',targetId});await h.command({type:'input',x:1,z:0});await h.tick(.5);const s=await h.read();assert.equal(s.monsters[targetId].hp,35);assert.equal(s.player.actionInstance.result.miss,true);await h.service.close();
});
test('saving windup and restoring JSON continues the same action without offline damage',async()=>{
 const c=small();c.npcs=[];c.regions[0].size=160;c.regions[0].spawn=[-49,0,-45];
 c.monsters=[{id:'rat',name:'野鼠',region:'farm',level:1,hp:35,attack:1,defense:0,xp:20,gold:3,role:'minion',speed:0,range:2.8,drops:[]}];
 const h=await harness(c),before=await h.read(),targetId=Object.keys(before.monsters)[0];await h.command({type:'attack',targetId});await h.service.close();
 const record=JSON.parse(JSON.stringify(await h.store.get(h.owner))),store=new MemoryWorldStore();await store.put(h.owner,record);let now=999999999;
 const service=new PersistentWorldService({content:c,store,autoStart:false,now:()=>now});await service.session(h.owner);const restored=await store.get(h.owner);assert.equal(restored.state.time,before.time);assert.equal(restored.state.monsters[targetId].hp,35);assert.equal(restored.state.player.actionInstance.phase,'windup');
 now+=500;await service.state(h.owner);await service.close();const after=(await store.get(h.owner)).state;assert(after.monsters[targetId].hp<35);assert.equal(after.player.actionInstance.id,record.state.player.actionInstance.id);
});

test('a later nearby conversation carries a witnessed interpretation to a non-witness and changes their plan',async()=>{
 const c=small();c.npcs[1].home=[25,0,0];c.npcs[1].work=[5,0,0];const h=await harness(c);await h.tick(.5);
 await h.command({type:'affordance',action:'lie',targetId:'self'});const first=await h.read();const fact=first.socialFacts.find(f=>f.kind==='body-action');assert(!fact.witnesses.includes('guard'));assert.equal(first.npcs.guard.beliefs.length,0);
 await h.tick(22);const s=await h.read(),belief=s.npcs.guard.beliefs.find(b=>b.factId===fact.id);assert(belief);assert.equal(belief.source.type,'heard');assert.equal(belief.source.actorId,'doctor');assert.equal(s.npcs.guard.goal,'investigate-observation');await h.service.close();
});
test('real service: dodge cancels windup without damage or bypassing the attack cooldown',async()=>{
 const c=small();c.npcs=[];c.regions[0].size=160;c.regions[0].spawn=[-49,0,-45];c.monsters=[{id:'rat',name:'野鼠',region:'farm',level:1,hp:35,attack:1,defense:0,xp:20,gold:3,role:'minion',speed:0,range:2.8,drops:[]}];
 const h=await harness(c),before=await h.read(),targetId=Object.keys(before.monsters)[0];await h.command({type:'attack',targetId});await h.command({type:'dodge',x:0,z:1});await h.tick(.5);
 const s=await h.read();assert.equal(s.player.lastActionInstance.phase,'cancelled');assert.equal(s.player.lastActionInstance.cancelReason,'dodge');assert.equal(s.monsters[targetId].hp,35);assert.equal(s.player.cooldowns.attack,0);await h.service.close();
});

test('legacy regional reputation is archived and cannot discount current prices',async()=>{
 const {migrateWorld}=await import('../../src/shared/trpg-world/activity.js');const {priceOf}=await import('../../src/shared/trpg-world/progression.js');const c=small(),s=createWorld(c);s.player.reputation={farm:1000};
 const price=priceOf(s,c.items[0],'farm');migrateWorld(s,c);assert.equal(priceOf(s,c.items[0],'farm'),price);assert.equal(price,6);assert(!Object.hasOwn(s.player,'reputation'));assert.equal(s.legacySnapshot.playerReputation.farm,1000);
});
