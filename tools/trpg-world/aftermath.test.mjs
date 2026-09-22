import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt,prepare} from './validation/action-domain.mjs';
import {walk} from './validation/journey.mjs';
import {DEFAULT_STRUCTURES} from '../../src/shared/trpg-world/infrastructure.js';
import {knownWorkplaceClosed} from '../../src/shared/trpg-world/world-semantics.js';

export function aftermathFixture(kind='collapse') {
 const structure=structuredClone(DEFAULT_STRUCTURES[kind==='fire'?1:0]);Object.assign(structure,{id:'site',targetId:'site',region:'village',hazardEventId:'hazard',shelterId:'inn'});
 if(kind==='collapse')structure.initial.integrity=1;
 return {revision:'aftermath-contract',time:{scale:60,startSeconds:25200},regions:[{id:'village',name:'村',size:160,spawn:[-40,0,0],obstacles:[],portals:[],objects:[{id:'inn',kind:'inn',name:'避難先の宿',position:[-40,0,0]},{id:'site',kind:'landmark',name:'仕事場',position:[0,0,0]},{id:'shop',kind:'shop',name:'道具店',position:[-40,0,2]},{id:'teacher',kind:'trainer',name:'工房',skills:['crafting'],position:[-42,0,0]}]}],
 npcs:[{id:'worker',name:'働く人',region:'village',home:[0,0,0],work:[0,0,0],workFacilityId:'site',role:'坑夫',personality:'慎重',knowledge:[]},{id:'witness',name:'通りの人',region:'village',home:[12,0,0],work:[12,0,0],role:'記録係',knowledge:[]}],
 events:[{id:'hazard',name:'事故',region:'village',position:[0,0,0],startsAt:28800,deadline:36000}],causalScenarios:[{eventId:'hazard',type:'infrastructure',structures:['site']}],structures:[structure],routes:[],equipment:[],monsters:[],jobs:[],
 items:[{id:'timber',name:'木材',price:2},{id:'rope',name:'縄',price:2},{id:'medicine',name:'傷薬',price:2},{id:'supplies',name:'食料',price:2}],skills:[{id:'crafting',name:'工作',goldCost:2,cost:1}]};
}
const ok=result=>assert(!result?.error,JSON.stringify(result));

test('a missed return deadline preserves physical life and permits a later family reunion without erasing failure',()=>{
 for(const id of ['late-walker','overdue-traveller']){
  const c=aftermathFixture();c.structures=[];
  c.events=[{id,name:'戻らない家族',region:'village',position:[0,0,6],startsAt:25260,deadline:27000}];
  c.causalScenarios=[{eventId:id,type:'return-person',personId:'traveller',familyId:'family'}];
  c.npcs=[{id:'traveller',name:'旅の人',region:'village',home:[0,0,0],work:[0,0,0],knowledge:[]},{id:'family',name:'家族',region:'village',home:[-40,0,0],work:[-40,0,0],knowledge:[]}];
  const r=new WorldReplay(c);ok(performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest'));
  assert.equal(r.state.events[id].status,'failed');assert.equal(r.state.npcs.traveller.hp,70);
  assert(r.state.events[id].causal.aftermath.some(f=>f.kind==='missing-person-not-returned'));
  const person=r.view().npcs.find(n=>n.id==='traveller');assert(person);ok(performAt(r,person,'causal',{action:'escort'}));
  const split={operation:r.operations.length,state:structuredClone(r.state)};
  ok(walk(r,[-40,0,0]));for(let i=0;i<45&&r.state.events[id].causal.phase!=='reunited';i++)r.advance(1);
  assert.equal(r.state.events[id].causal.phase,'reunited');assert.equal(r.state.events[id].status,'failed');
  assert(r.state.socialFacts.some(f=>f.kind==='family-reunion'&&f.actorId==='traveller'));
  const wages=r.state.player.gold;ok(performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest'));assert.equal(r.state.player.gold,wages-8);
  const record=r.export();assert.equal(digest(replay(c,record).state),digest(r.state));
  assert.equal(digest(replay(c,{...record,initialState:split.state,operations:record.operations.slice(split.operation)}).state),digest(r.state));
 }
});

test('an absent recipient is identified by testimony and found in the world, not teleported home for handoff',()=>{
 const c=aftermathFixture();c.structures=[];c.time.startSeconds=28800;
 c.events=[{id:'overdue',name:'帰りを待つ家族',region:'village',position:[-30,0,6],startsAt:28860,deadline:30000}];
 c.causalScenarios=[{eventId:'overdue',type:'return-person',personId:'traveller',familyId:'family'}];
 c.npcs=[{id:'traveller',name:'旅の人',region:'village',home:[-30,0,6],work:[-30,0,6],knowledge:[]},{id:'family',name:'迎える人',region:'village',home:[-40,0,0],work:[30,0,0],knowledge:[]}];
 const r=new WorldReplay(c);ok(performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest'));
 ok(performAt(r,r.view().npcs.find(n=>n.id==='traveller'),'causal',{action:'escort'}));
 const home=r.view().leads.find(l=>l.expectedAction==='escort-arrival');assert.equal(home.recipientId,'family');assert(home.explanation.includes('迎える人'));
 ok(r.command({type:'track',leadId:home.id}));ok(walk(r,home.position));
 for(let i=0;i<45&&r.view().arrival.status==='waiting-companion';i++)r.advance(1);
 assert.equal(r.view().arrival.status,'waiting-recipient');assert(r.state.npcs.family.position[0]>10);
 assert(!Object.hasOwn(home,'recipientPosition'),'testimony must not expose the recipient current whereabouts');
 const seen=r.view().npcs.find(n=>n.id===home.recipientId);assert(seen);ok(performAt(r,seen,null));
 for(let i=0;i<45&&r.view().arrival.status!=='completed';i++)r.advance(1);
 assert.equal(r.view().arrival.status,'completed');assert.equal(r.state.events.overdue.status,'failed');
 assert(r.state.npcs.traveller.position[0]>0,'handoff occurred where family was actually found');
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
test('physical collapse: sleeping elsewhere, remembered testimony, preparation, release, treatment and actual escort; failure stays historical',()=>{
 const c=aftermathFixture(),r=new WorldReplay(c);
 ok(performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest'));
 assert.equal(r.state.events.hazard.status,'failed');assert(r.state.npcs.worker.entrapment);assert(!r.view().npcs.some(n=>n.id==='worker'));assert(!r.view().leads.some(l=>l.targetId==='site'));
 const witness=r.view().npcs.find(n=>n.id==='witness');assert(witness,'witness must physically reach shelter');ok(performAt(r,witness,'interact',{action:'talk'}));
 const ask=r.options().find(o=>o.command.intentId?.startsWith('ask:site:'));assert(ask,'known physical observation must be speakable');ok(r.select(ask,'見てきた異変について聞く'));
 assert(r.view().leads.some(l=>l.targetId==='site'));assert(r.state.knowledge.find(k=>k.kind==='site-observation').source.actorId==='witness');ok(r.command({type:'resume'}));
 ok(prepare(r,{items:{timber:5,rope:2},skills:['crafting']}));const site=r.view().region.objects.find(o=>o.id==='site');
 for(const action of ['drain','shore','clear-rubble'])ok(performAt(r,site,'maintain',{action}));
 assert(!r.state.npcs.worker.entrapment);ok(performAt(r,r.view().npcs.find(n=>n.id==='worker'),'causal',{action:'tend'}));ok(performAt(r,r.view().npcs.find(n=>n.id==='worker'),'causal',{action:'escort'}));
 const save=JSON.parse(JSON.stringify(r.state)),fork=new WorldReplay(c,{initialState:save});
 for(const run of [r,fork]){ok(walk(run,[-40,0,0]));for(let i=0;i<40&&run.state.npcs.worker.care.status!=='recovered';i++)run.advance(1);assert.equal(run.state.npcs.worker.care.status,'recovered');assert.equal(run.state.events.hazard.status,'failed');}
 assert.equal(digest(fork.state),digest(r.state));assert(r.state.structures.site.recoveries.length);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
test('the same infrastructure handles fire, evacuation, extinguishing and repair without erasing failure',()=>{
 const c=aftermathFixture('fire'),r=new WorldReplay(c);ok(performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest'));assert.equal(r.state.structures.site.fire,100);assert(r.state.npcs.witness.planHistory.some(p=>p.goal==='evacuate'));assert(r.state.socialFacts.some(f=>f.kind==='structural-damage'));
 ok(prepare(r,{items:{rope:1,timber:4},skills:['crafting']}));for(const action of ['extinguish','clear-rubble','shore'])ok(performAt(r,r.view().region.objects.find(o=>o.id==='site'),'maintain',{action}));assert.equal(r.state.structures.site.fire,0);assert.equal(r.state.structures.site.blocked,false);assert.equal(r.state.events.hazard.status,'failed');assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
test('a non-witness hears the shelter account and discloses its provenance, never hidden cause or deadline',()=>{
 const c=aftermathFixture();c.events[0].description='HIDDEN_CONSPIRACY';c.events[0].cause='PRIVATE_SOLUTION';
 c.npcs.push({id:'listener',name:'宿の人',region:'village',home:[-38,0,0],work:[-38,0,0],role:'宿主',knowledge:[]});
 const r=new WorldReplay(c);ok(performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest'));
 const account=r.state.npcs.listener.knowledge.find(k=>k.kind==='site-observation');assert(account,'a physical encounter must transmit the account');assert.equal(account.source.type,'heard');
 assert.equal(r.state.npcs.listener.memories.find(m=>m.factId===account.belief.factId).source.type,'heard');
 assert.equal(r.state.npcs.listener.memories.find(m=>m.factId===account.belief.factId).recall.appearance,null); // Ruins are not a person in imaginary travel clothes.
 ok(performAt(r,r.view().npcs.find(n=>n.id==='listener'),'interact',{action:'talk'}));const ask=r.options().find(o=>o.command.intentId?.startsWith('ask:site:'));assert(ask);ok(r.select(ask));
 assert(r.view().leads.some(l=>l.targetId==='site'));const publicData=JSON.stringify(r.view());assert(!publicData.includes('HIDDEN_CONSPIRACY'));assert(!publicData.includes('PRIVATE_SOLUTION'));assert(!r.view().knownEvents.some(e=>e.deadline!==undefined));assert(r.state.knowledge.find(k=>k.kind==='site-observation').testimony.chain.length>=2);
});
test('giving real medicine lets a knowledgeable professional search, treat and escort through the shared planner',()=>{
 const c=aftermathFixture();c.npcs[1].role='救護係';const r=new WorldReplay(c);ok(performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest'));
 ok(prepare(r,{items:{timber:5,rope:2},skills:['crafting']}));for(const action of ['drain','shore','clear-rubble'])ok(performAt(r,r.view().region.objects.find(o=>o.id==='site'),'maintain',{action}));
 assert(!r.state.npcs.witness.possessions.medicine);assert.equal(r.state.npcs.worker.care.status,'injured');
 ok(performAt(r,{id:'witness',position:[-40,0,0]},'interact',{action:'talk'}));
 let gift;for(let i=0;i<5&&!gift;i++){gift=r.options().find(o=>o.command.intentId==='offer-medicine');if(!gift){const next=r.options().find(o=>o.intent==='CHANGE_TOPIC');assert(next);ok(r.select(next));}}
 assert(gift);ok(r.select(gift,'救護係へ実際の傷薬を渡す'));const record=r.export(),fork=replay(c,record);
 for(const run of [r,fork]){ok(run.command({type:'resume'}));ok(performAt(run,run.view().region.objects.find(o=>o.id==='inn'),'rest'));assert.equal(run.state.npcs.worker.care.status,'recovered',JSON.stringify({helper:run.state.npcs.witness,patient:run.state.npcs.worker}));assert.equal(run.state.npcs.witness.possessions.medicine,0);assert(run.state.npcs.witness.planHistory.some(p=>p.goal==='aftermath-rescue'&&p.actions.includes('first-aid')));}
 assert.equal(digest(fork.state),digest(r.state));assert.equal(r.state.events.hazard.status,'failed');
});
test('a repaired and cleared workplace can reopen and pay ordinary work without erasing the disaster',()=>{
 const c=aftermathFixture('fire');c.npcs=[];c.jobs=[{id:'sort',name:'片付けと仕分け',facilityId:'site',region:'village',pay:20,minutes:30}];const r=new WorldReplay(c),site=r.view().region.objects.find(o=>o.id==='site');
 ok(performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest'));ok(performAt(r,site,null));assert(!r.options().some(o=>o.command.type==='work'));assert(!r.options().some(o=>o.command.action==='reopen'));
 ok(prepare(r,{items:{rope:1,timber:4},skills:['crafting']}));for(const action of ['extinguish','clear-rubble','shore','reopen'])ok(performAt(r,site,'maintain',{action}));
 const wage=r.state.player.gold;const job=r.options().find(o=>o.command.type==='work');assert(job);ok(r.select(job,'復旧した仕事場で働く'));assert.equal(r.state.player.gold,wage+20);assert.equal(r.state.events.hazard.status,'failed');assert.equal(r.state.facilities.site.closed,false);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
test('an evacuated worker hears the actual reopening, then returns to work instead of learning repairs remotely',()=>{
 const c=aftermathFixture('fire');c.events[0].startsAt=25200;
 c.npcs=[{id:'worker',name:'仕分け係',region:'village',home:[10,0,0],work:[10,0,0],workFacilityId:'site',role:'仕分け係',knowledge:[]}];
 const r=new WorldReplay(c),site=r.view().region.objects.find(o=>o.id==='site');
 ok(performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest'));
 assert(knownWorkplaceClosed(r.state.npcs.worker,'site'));assert(r.state.npcs.worker.displacedHome);
 ok(prepare(r,{items:{rope:1,timber:4},skills:['crafting']}));
 for(const action of ['extinguish','clear-rubble','shore','reopen'])ok(performAt(r,site,'maintain',{action}));
 assert(knownWorkplaceClosed(r.state.npcs.worker,'site'),'remote repair must not update the evacuated worker');
 ok(performAt(r,{id:'worker',position:[-40,0,0]},'interact',{action:'talk'}));
 let share;for(let i=0;i<5&&!share;i++){share=r.options().find(o=>o.intent==='SHARE_INFORMATION'&&r.state.knowledge.find(k=>`share:${k.id}`===o.command.intentId&&k.kind==='workplace-status'&&!k.closed));if(!share){const next=r.options().find(o=>o.intent==='CHANGE_TOPIC');assert(next);ok(r.select(next));}}
 assert(share);ok(r.select(share));assert(!knownWorkplaceClosed(r.state.npcs.worker,'site'));
 const heard=r.state.npcs.worker.knowledge.find(k=>k.id===share.command.intentId.slice(6));assert.equal(heard.source.type,'heard');assert.equal(heard.source.actorId,'player');
 ok(r.command({type:'resume'}));for(let i=0;i<50;i++)r.advance(1);
 assert.equal(r.state.npcs.worker.goal,'work');assert(r.state.npcs.worker.position[0]>5);assert.equal(r.state.events.hazard.status,'failed');
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('returning after a fire reveals exterior change and permits fresh inspection without remote updates',()=>{
 const c=aftermathFixture('fire');c.regions[0].spawn=[-65,0,0];c.regions[0].objects.find(o=>o.id==='inn').position=[-65,0,0];const r=new WorldReplay(c),site=r.view().region.objects.find(o=>o.id==='site');
 ok(performAt(r,site,'interact',{action:'inspect'}));assert(r.options().some(o=>o.command.targetId==='site'&&o.command.action==='review'));
 ok(performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest'));const distant=r.view().perception.places.find(o=>o.id==='site');assert.deepEqual(distant.appearance,[]);assert.equal(distant.changedSinceInspection,false);
 ok(walk(r,[-35,0,0]));const visible=r.view().perception.places.find(o=>o.id==='site');assert(visible.appearance.includes('炎と煙が上がっている'));assert.equal(visible.changedSinceInspection,true);assert(!JSON.stringify(visible).includes('deadline'));
 ok(walk(r,[0,0,0]));const fresh=r.view().interactables.find(o=>o.id==='site').actions.find(a=>a.id==='inspect');assert.equal(fresh.renewed,true);ok(r.command({type:'interact',targetId:'site',action:'inspect'}));assert(r.state.player.inspections.site.text.includes('炎と煙'));assert.equal(r.view().perception.places.find(o=>o.id==='site').changedSinceInspection,false);
 const options=r.options();for(const seconds of [10,30,60]){const fork=r.fork();fork.advance(seconds);assert.deepEqual(fork.options(),options);}
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
