import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {DEFAULT_PROCESS_STRUCTURES} from '../../src/shared/trpg-world/process-content.js';
import {runBlind} from './validation/blind-run.mjs';
import {walk} from './validation/journey.mjs';
import {prepare,performAt} from './validation/action-domain.mjs';

function fixture(){return {revision:'process-contract',time:{scale:60,startSeconds:25200},regions:[{id:'farm',name:'村',size:160,spawn:[0,0,0],obstacles:[],portals:[],objects:[{id:'shop',kind:'shop',name:'店',position:[0,0,2]},{id:'teacher',kind:'trainer',name:'師匠',skills:['crafting'],position:[2,0,0]},{id:'board',kind:'board',name:'仕事場',position:[-2,0,0]},{id:'inn',kind:'inn',name:'宿',position:[0,0,-2]},{id:'machine',kind:'landmark',name:'機械',position:[1,0,1]},{id:'office',kind:'landmark',name:'審理窓口',position:[-1,0,1]}]}],npcs:[{id:'clerk',name:'係員',region:'farm',home:[-1,0,1],work:[-1,0,1],workFacilityId:'office'}],events:[{id:'incident',name:'異変',region:'farm',position:[0,0,3],startsAt:100000,deadline:200000,sourceIds:['a','b']}],causalScenarios:[],routes:[],items:[{id:'timber',name:'木材',price:2},{id:'rope',name:'縄',price:2},{id:'supplies',name:'携帯食',price:5,kind:'food'},{id:'antidote',name:'解毒薬',price:3}],skills:[{id:'crafting',name:'工作',goldCost:2,cost:1}],jobs:[{id:'labor',name:'荷運び',region:'farm',facilityId:'board',minutes:30,pay:45,xp:32}],equipment:[],monsters:[],processes:[{id:'drive',kind:'device',eventId:'incident',sourceId:'a',region:'farm',targetId:'machine',name:'送出機',observation:'留め具に傷がある。',initial:{powered:true,integrity:40},aftermath:{closedTarget:'machine'}},{id:'fund',kind:'supply',eventId:'incident',sourceId:'b',region:'farm',targetId:'office',name:'供託所',observation:'納品簿が置いてある。',initial:{},required:{supplies:1,gold:20}}]};}
const target=(r,id)=>r.view().region.objects.find(o=>o.id===id)||r.view().npcs.find(n=>n.id===id);
const act=(r,id,action)=>{const result=performAt(r,target(r,id),'process',{action});assert(!result.error,JSON.stringify(result));};
for(const kind of ['collapse','fire'])test(`blind ordinary life discovers ${kind} aftermath, prepares, rescues and continues without outcome injection`,()=>{
 const c=fixture(),physical=structuredClone(DEFAULT_PROCESS_STRUCTURES.find(s=>s.failure.kind===kind));
 Object.assign(physical,{id:'wreck',processId:'drive',region:'farm',targetId:'machine',shelterId:'inn',hazardEventId:'incident'});
 physical.actions.find(a=>a.id==='shore').requirements={items:{timber:2},skills:['crafting']};
 c.time.startSeconds=22*3600;c.regions[0].spawn=[0,0,-20];
 c.regions[0].objects.find(o=>o.id==='inn').position=[0,0,-20];
 c.regions[0].objects.find(o=>o.id==='machine').position=[25,0,0];
 c.regions[0].obstacles=[{x:12,z:-5,width:4,depth:12}];
 c.structures=[physical];c.processes=[{...c.processes[0],structureId:'wreck'}];c.events[0].sourceIds=['a'];c.events[0].startsAt=22*3600+60;c.events[0].deadline=22*3600+120;
 c.items.push({id:'medicine',name:'傷薬',price:2});
 c.npcs=['worker','coworker','visitor'].map((id,i)=>({id,name:`現場の住人${i+1}`,role:'作業員',region:'farm',home:[25+i,0,0],work:[25+i,0,0],knowledge:[]}));
 const {run,summary}=runBlind(c,{decisions:200,untilDay:4});
 const diagnostic=()=>JSON.stringify({stop:summary.stopped,care:Object.values(run.state.npcs).map(n=>({id:n.id,care:n.care,position:n.position})),structure:run.state.structures.wreck,tail:summary.decisionsLog.slice(-5)});
 assert.equal(run.state.events.incident.status,'failed',diagnostic());
 assert.equal(run.state.npcs.worker.care?.status,'recovered',diagnostic());
 assert(Object.values(run.state.npcs).every(n=>n.care?.status==='recovered'),diagnostic());
 assert(run.operations.some(o=>o.command?.type==='buy'&&o.command.itemId==='medicine'));
 assert(run.operations.some(o=>o.command?.type==='buy'&&o.command.itemId==='timber'));
 assert(run.operations.some(o=>o.command?.type==='train'));
 assert(run.operations.some(o=>o.command?.type==='causal'&&o.command.action==='escort'));
 assert(run.state.structures.wreck.recoveries.some(r=>r.personId==='worker'));
 assert.deepEqual(run.defects,[]);assert(!['FIRST_BAD_DECISION','DUPLICATE_DESTINATION_LOOP','prepared-intent-unavailable-at-observed-location'].includes(summary.stopped),diagnostic());
 const record=run.export(),cut=record.operations.findIndex(o=>o.command?.type==='causal'&&o.command.action==='escort')+1;
 const mid=replay(c,{...record,operations:record.operations.slice(0,cut)}).fork();
 assert(Object.values(mid.state.npcs).some(n=>n.companionOf==='player'));
 assert.equal(digest(replay(c,{...record,initialState:mid.state,operations:record.operations.slice(cut)}).state),digest(run.state));
});
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

test('institutional access changes require the informed official to walk to the site and enact the order',()=>{
 const c=fixture();c.events[0].sourceIds=['a'];c.regions[0].objects.find(o=>o.id==='machine').position=[32,0,12];
 c.processes=[{id:'review',kind:'inquiry',eventId:'incident',sourceId:'a',region:'farm',targetId:'office',name:'審理',observation:'受付がある。',initial:{},order:'suspend-access',documents:[{id:'original',targetId:'shop',text:'危険な搬入の記録。'}],reviewers:['clerk'],access:{targetId:'machine',closed:true}}];
 const r=new WorldReplay(c);act(r,'office','review/inspect');assert(!performAt(r,target(r,'shop'),'interact',{action:'inspect'}).error);act(r,'office','review/submit');r.command({type:'resume'});r.advance(6);
 assert.equal(r.state.processes.review.order.status,'issued');assert.equal(r.state.processes.review.order.execution.status,'in-progress');
 assert(!r.state.facilities.machine?.closed);assert.equal(r.state.events.incident.status,'latent');
 const saved=r.fork();for(const run of [r,saved]){
  assert(!performAt(run,target(run,'inn'),'rest').error);
  const order=run.state.processes.review.order;assert.equal(order.execution.status,'completed');assert.equal(run.state.facilities.machine.orderId,order.factId);assert.equal(run.state.events.incident.status,'prevented');
  const fact=run.state.socialFacts.find(f=>f.id===order.execution.evidence);assert.equal(fact.actorId,'clerk');assert.equal(fact.targetId,'machine');
  assert(Math.hypot(fact.position[0]-32,fact.position[2]-12)<3);assert(run.state.npcs.clerk.planHistory.some(p=>p.goal==='enact-order'));
 }
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
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

test('isolating machinery prevents its powered failure while damaged supports still need ordinary restoration',()=>{
 const c=fixture(),physical=structuredClone(DEFAULT_PROCESS_STRUCTURES.find(s=>s.failure.kind==='fire'));
 Object.assign(physical,{id:'wreck',processId:'drive',region:'farm',targetId:'machine',shelterId:'inn',hazardEventId:'incident'});
 physical.actions.find(a=>a.id==='shore').requirements={items:{timber:2},skills:['crafting']};
 c.structures=[physical];c.processes=[{...c.processes[0],structureId:'wreck'}];c.events[0].sourceIds=['a'];c.events[0].startsAt=40000;c.events[0].deadline=50000;
 const r=new WorldReplay(c);act(r,'machine','drive/inspect');act(r,'machine','drive/isolate');
 for(let i=0;i<2;i++)assert(!performAt(r,target(r,'inn'),'rest').error);
 assert.equal(r.state.processes.drive.failedAt,undefined);assert.equal(r.state.structures.wreck.damageAt,undefined);
 assert.equal(r.state.structures.wreck.integrity,40);assert.equal(r.state.facilities.machine.closed,true);
 assert.equal(r.state.events.incident.status,'resolved');
 assert(prepare(r,{items:{timber:2},skills:['crafting']}).prepared);
 assert(!performAt(r,target(r,'machine'),'maintain',{action:'shore'}).error);assert.equal(r.state.structures.wreck.integrity,100);
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('process failure enters shared physical rescue and reopening without deleting the failure',()=>{
 for(const kind of ['collapse','fire']){
 const c=fixture(),physical=structuredClone(DEFAULT_PROCESS_STRUCTURES.find(s=>s.failure.kind===kind));
 Object.assign(physical,{id:'wreck',processId:'drive',region:'farm',targetId:'machine',shelterId:'inn',hazardEventId:'incident'});
 physical.actions.find(a=>a.id==='shore').requirements={items:{timber:2},skills:['crafting']};
 c.structures=[physical];c.processes=[{...c.processes[0],structureId:'wreck'}];c.events[0].sourceIds=['a'];c.events[0].startsAt=25300;c.events[0].deadline=27000;
 c.regions[0].spawn=[-40,0,0];c.regions[0].objects.find(o=>o.id==='inn').position=[-40,0,0];
 c.npcs=[{id:'worker',name:'現場の住人',role:'作業員',region:'farm',home:[1,0,1],work:[1,0,1],knowledge:[]}];
 const r=new WorldReplay(c);assert(!performAt(r,target(r,'inn'),'rest').error);assert.equal(r.state.events.incident.status,'failed');assert.equal(r.state.structures.wreck.casualties[0],'worker');assert.equal(r.state.npcs.worker.injury.kind,kind==='fire'?'burn':'crush');
 assert(prepare(r,{items:{timber:2,rope:2},skills:['crafting']}).prepared);
 if(kind==='fire')assert(!performAt(r,target(r,'machine'),'maintain',{action:'extinguish'}).error);
 for(const action of ['shore','clear-rubble'])assert(!performAt(r,target(r,'machine'),'maintain',{action}).error);
 const split=structuredClone(r.export());assert(!r.state.npcs.worker.entrapment);assert(!performAt(r,target(r,'worker'),'causal',{action:'tend'}).error);assert(!performAt(r,target(r,'worker'),'causal',{action:'escort'}).error);
 assert(!walk(r,[-40,0,0]).error);for(let i=0;i<40&&r.state.npcs.worker.care.status!=='recovered';i++)r.advance(1);
 assert.equal(r.state.npcs.worker.care.status,'recovered');assert(!performAt(r,target(r,'machine'),'maintain',{action:'reopen'}).error);assert.equal(r.state.facilities.machine.closed,false);assert.equal(r.state.events.incident.status,'failed');
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));assert.equal(replay(c,split).state.npcs.worker.care.status,'injured');
 }
});

test('a patient in another region cannot be observed through matching local coordinates',()=>{
 const c=fixture();c.regions.push({id:'away',name:'別の土地',size:160,spawn:[0,0,0],objects:[],portals:[],obstacles:[]});
 c.npcs.push({id:'patient',name:'旅人',region:'away',home:[-1,0,1],work:[-1,0,1],knowledge:[]});
 c.processes=[{id:'care',kind:'patient',eventId:'incident',sourceId:'a',region:'farm',targetId:'patient',actorId:'patient',name:'容体',observation:'薬の封が破れている。',initial:{treated:false}}];
 const r=new WorldReplay(c);r.advance(.5);assert(!r.state.npcs.clerk.knowledge.some(k=>k.id==='process-observation:care'));assert(!r.view().perception.directions.some(d=>d.destination.targetId==='patient'));
});

test('blind preparation returns to an inspected machine after real purchases and lessons',()=>{
 const c=fixture();c.processes=c.processes.slice(0,1);c.events[0].sourceIds=['a'];c.events[0].startsAt=25201;c.events[0].deadline=25202;
 c.regions[0].objects.find(o=>o.id==='shop').position=[15,0,0];c.regions[0].objects.find(o=>o.id==='teacher').position=[-15,0,0];
 const {run,summary}=runBlind(c,{decisions:100,untilDay:2});assert(run.operations.some(o=>o.command?.type==='buy'&&o.command.itemId==='timber'));assert(run.operations.some(o=>o.command?.type==='train'));
 assert.equal(run.state.processes.drive.integrity,100,JSON.stringify({stop:summary.stopped,last:summary.decisionsLog.slice(-3)}));assert.equal(run.state.events.incident.status,'failed');assert.equal(digest(replay(c,run.export()).state),digest(run.state));
});

test('an inspected work requirement stays trackable during preparation and completes at the actual destination',()=>{
 const c=fixture(),r=new WorldReplay(c);act(r,'machine','drive/inspect');const lead=r.view().leads.find(l=>l.expectedAction==='drive/repair');assert(lead);assert.deepEqual(lead.requirements.items,{timber:2});r.command({type:'track',leadId:lead.id});
 assert(prepare(r,{items:{timber:2},skills:['crafting']}).prepared);const saved=r.fork();assert.equal(saved.view().arrival.id,lead.id);assert(saved.state.player.inspections.machine.work.some(a=>a.id==='drive/repair'));
 act(r,'machine','drive/repair');assert.equal(r.view().arrival.status,'completed');assert(!r.view().leads.some(l=>l.id===lead.id));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('ordinary repeated deliveries change actual stock; completed distribution preserves receipts and closes the offer',()=>{
 const c=fixture();c.processes=[{...c.processes[1],required:{supplies:3,gold:60}}];c.events[0].sourceIds=['b'];const r=new WorldReplay(c);assert(prepare(r,{items:{supplies:3}}).prepared);act(r,'office','fund/inspect');const money=r.state.player.gold;
 for(let i=0;i<3;i++)act(r,'office','fund/deliver-gold');for(let i=0;i<3;i++)act(r,'office','fund/deliver-supplies');
 assert.equal(r.state.player.gold,money-60);assert.deepEqual(r.state.processes.fund.receipts,{gold:60,supplies:3});assert(r.state.processes.fund.distributions.includes('clerk'));assert(!r.options().some(o=>o.command.action?.startsWith('fund/deliver')));
 assert(r.state.player.inspections.office.text.includes('3/3'));assert(r.state.player.inspections.office.text.includes('60/60'));assert.equal(digest(replay(c,r.export()).state),digest(r.state));assert.deepEqual(r.defects,[]);
});

test('conditional actors emerge from their own powered source; repair cannot erase already living actors',()=>{
 const c=fixture();c.events[0]={...c.events[0],sourceIds:['T91','T92'],startsAt:25200,position:[45,0,45]};
 c.processes=[{...c.processes[0],sourceId:'T91'},{...structuredClone(c.processes[0]),id:'second',sourceId:'T92',targetId:'office',activation:{path:['processes','drive','powered'],value:false}}];
 const creature=(id,source)=>({id,region:'farm',name:'現場の生物',sourceCondition:source,hp:35,level:1,attack:4,defense:0,speed:1,range:2.8,xp:20,gold:3,drops:[]});
 c.monsters=[creature('first','T91進行中'),creature('second','T92進行中')];const r=new WorldReplay(c);r.advance(.5);
 const firstId='incident:incident:first',secondId='incident:incident:second';assert(r.state.monsters[firstId]);assert(!r.state.monsters[secondId]);
 assert(prepare(r,{items:{timber:4,rope:2},skills:['crafting']}).prepared);act(r,'machine','drive/inspect');act(r,'machine','drive/isolate');
 r.command({type:'resume'});r.advance(31);assert(r.state.monsters[secondId]);assert.equal(r.state.monsters[firstId].hp,35);
 const split=r.fork();act(r,'machine','drive/repair');act(r,'office','second/inspect');act(r,'office','second/isolate');act(r,'office','second/repair');
 assert.equal(r.state.events.incident.status,'resolved');r.command({type:'resume'});r.advance(31);
 assert.equal(r.state.monsters[firstId].hp,35);assert.equal(r.state.monsters[secondId].hp,35);assert.equal(split.state.processes.second.powered,true);
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));assert.deepEqual(r.defects,[]);
});

test('one component failure activates only its own aftermath population while another component continues',()=>{
 const c=fixture();c.events[0]={...c.events[0],sourceIds:['T91','T92'],startsAt:25200,position:[45,0,45]};
 c.processes=[{...c.processes[0],sourceId:'T91',deadline:25300},{...structuredClone(c.processes[0]),id:'second',sourceId:'T92',targetId:'office'}];
 c.monsters=['T91','T92'].map(source=>({id:source,region:'farm',name:'被害後の生物',sourceCondition:source+'失敗',hp:35,level:1,attack:4,defense:0,speed:1,range:2.8,xp:20,gold:3,drops:[]}));
 const r=new WorldReplay(c);r.command({type:'resume'});r.advance(32);
 assert(r.state.processes.drive.failedAt);assert(!r.state.processes.second.failedAt);assert.equal(r.state.events.incident.status,'active');
 assert(r.state.monsters['incident:incident:T91']);assert(!r.state.monsters['incident:incident:T92']);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
