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
