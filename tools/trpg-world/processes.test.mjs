import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {prepare,performAt} from './validation/action-domain.mjs';

function fixture(){return {revision:'process-contract',time:{scale:60,startSeconds:25200},regions:[{id:'farm',name:'村',size:160,spawn:[0,0,0],obstacles:[],portals:[],objects:[{id:'shop',kind:'shop',name:'店',position:[0,0,2]},{id:'teacher',kind:'trainer',name:'師匠',skills:['crafting'],position:[2,0,0]},{id:'board',kind:'board',name:'仕事場',position:[-2,0,0]},{id:'inn',kind:'inn',name:'宿',position:[0,0,-2]},{id:'machine',kind:'landmark',name:'機械',position:[1,0,1]},{id:'office',kind:'landmark',name:'審理窓口',position:[-1,0,1]}]}],npcs:[{id:'clerk',name:'係員',region:'farm',home:[-1,0,1],work:[-1,0,1],workFacilityId:'office'}],events:[{id:'incident',name:'異変',region:'farm',position:[0,0,3],startsAt:100000,deadline:200000,sourceIds:['a','b']}],causalScenarios:[],routes:[],items:[{id:'timber',name:'木材',price:2},{id:'rope',name:'縄',price:2},{id:'supplies',name:'携帯食',price:5,kind:'food'},{id:'antidote',name:'解毒薬',price:3}],skills:[{id:'crafting',name:'工作',goldCost:2,cost:1}],jobs:[{id:'labor',name:'荷運び',region:'farm',facilityId:'board',minutes:30,pay:45,xp:32}],equipment:[],monsters:[],processes:[{id:'drive',kind:'device',eventId:'incident',sourceId:'a',region:'farm',targetId:'machine',name:'送出機',observation:'留め具に傷がある。',initial:{powered:true,integrity:40},aftermath:{closedTarget:'machine'}},{id:'fund',kind:'supply',eventId:'incident',sourceId:'b',region:'farm',targetId:'office',name:'供託所',observation:'納品簿が置いてある。',initial:{},required:{supplies:1,gold:20}}]};}
const target=(r,id)=>r.view().region.objects.find(o=>o.id===id)||r.view().npcs.find(n=>n.id===id);
const act=(r,id,action)=>{const result=performAt(r,target(r,id),'process',{action});assert(!result.error,JSON.stringify(result));};
test('shared process work consumes actual preparations; merged sources require every endpoint; save replay is exact',()=>{
 const c=fixture(),r=new WorldReplay(c);assert(prepare(r,{items:{timber:2,rope:1,supplies:2},skills:['crafting']}).prepared);
 act(r,'machine','drive/inspect');act(r,'machine','drive/isolate');const saved=JSON.parse(JSON.stringify(r.export()));act(r,'machine','drive/repair');
 assert.equal(r.state.player.inventory.timber,0);assert.equal(r.state.processes.drive.integrity,100);assert.equal(r.state.events.incident.status,'latent');
 act(r,'office','fund/inspect');act(r,'office','fund/deliver-supplies');act(r,'office','fund/deliver-gold');assert.equal(r.state.events.incident.status,'prevented');assert.equal(r.state.processes.fund.receipts.gold,20);
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));assert.equal(replay(c,saved).state.processes.drive.integrity,40);assert.deepEqual(r.defects,[]);
});
test('failure leaves broken access that ordinary repair reopens without erasing failure history',()=>{
 const c=fixture();c.events[0].startsAt=25300;c.events[0].deadline=26000;c.events[0].sourceIds=['a'];c.processes=c.processes.slice(0,1);const r=new WorldReplay(c);
 assert(prepare(r,{items:{timber:2,rope:1},skills:['crafting']}).prepared);assert.equal(r.state.events.incident.status,'failed');assert.equal(r.state.facilities.machine.closed,true);
 act(r,'machine','drive/inspect');act(r,'machine','drive/repair');assert.equal(r.state.facilities.machine.closed,false);assert(r.state.processes.drive.recoveredAt);assert.equal(r.state.events.incident.status,'failed');assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
test('copies require actual reading and submission; institutional order requires a present living reviewer',()=>{
 const c=fixture();c.events[0].sourceIds=['a'];c.processes=[{id:'review',kind:'inquiry',eventId:'incident',sourceId:'a',region:'farm',targetId:'office',name:'審理',observation:'受付がある。',initial:{},order:'correct-ledger',documents:[{id:'original',targetId:'machine',text:'原本の記載が異なる。'}],reviewers:['clerk']}];const r=new WorldReplay(c);
 act(r,'office','review/inspect');assert(!r.options().some(o=>o.command.action==='review/submit'));assert(!performAt(r,target(r,'machine'),'interact',{action:'inspect'}).error);assert(r.state.knowledge.some(k=>k.documentId==='original'));
 act(r,'office','review/submit');assert.equal(r.state.processes.review.order,undefined);assert.equal(r.state.documentCustody.office[0].documentId,'original');r.command({type:'resume'});r.advance(6);assert.equal(r.state.processes.review.order.authority,'clerk');assert.equal(digest(replay(c,r.export()).state),digest(r.state));
 const absent=fixture();absent.events=c.events;absent.processes=c.processes;absent.npcs=[];const a=new WorldReplay(absent);act(a,'office','review/inspect');performAt(a,target(a,'machine'),'interact',{action:'inspect'});act(a,'office','review/submit');a.command({type:'resume'});a.advance(60);assert.equal(a.state.processes.review.order,undefined);
});
test('patient treatment consumes a real antidote and prevents physical poisoning, never creates a person',()=>{
 const c=fixture();c.events[0].sourceIds=['a'];c.processes=[{id:'illness',kind:'patient',eventId:'incident',sourceId:'a',region:'farm',targetId:'clerk',actorId:'clerk',name:'容体',observation:'薬が変色している。',initial:{treated:false,exposed:false}}];const r=new WorldReplay(c);assert(prepare(r,{items:{antidote:1}}).prepared);act(r,'clerk','illness/inspect');act(r,'clerk','illness/treat');assert.equal(r.state.player.inventory.antidote,0);assert.equal(r.state.processes.illness.treated,true);assert.equal(r.state.events.incident.status,'prevented');assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
test('a conditional downstream threat does not fail when its physical prerequisite was prevented',()=>{
 const c=fixture();c.events[0].startsAt=50000;c.events[0].deadline=60000;c.processes[1]={...structuredClone(c.processes[0]),id:'downstream',sourceId:'b',targetId:'office',activation:{path:['processes','drive','powered'],value:true}};
 const r=new WorldReplay(c);assert(prepare(r,{items:{timber:2,rope:1},skills:['crafting']}).prepared);act(r,'machine','drive/inspect');act(r,'machine','drive/isolate');act(r,'machine','drive/repair');assert.equal(r.state.events.incident.status,'latent');
 for(let i=0;i<2;i++)assert(!performAt(r,target(r,'inn'),'rest').error);
 assert.equal(r.state.events.incident.status,'resolved');assert.equal(r.state.processes.downstream.failedAt,undefined);assert.equal(r.state.processes.downstream.powered,true);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
