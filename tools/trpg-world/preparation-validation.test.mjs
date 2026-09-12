import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {prepare,performAt,engage,decisionCounts} from './validation/action-domain.mjs';
import {DEFAULT_STRUCTURES} from '../../src/shared/trpg-world/infrastructure.js';
import fs from 'node:fs/promises';
import {PersistentWorldService,hashWorldToken} from '../../src/server/trpg/world/service.js';
import {MemoryWorldStore} from '../../src/server/trpg/world/store.js';
import {runPolicy} from './validation/journey.mjs';
function content(){return {revision:'preparation-contract',time:{scale:60,startSeconds:25200},regions:[{id:'farm',name:'村',size:160,spawn:[0,0,0],obstacles:[],portals:[],objects:[{id:'shop',kind:'shop',name:'道具店',position:[0,0,2]},{id:'teacher',kind:'trainer',name:'師匠',skills:['magic'],position:[2,0,0]},{id:'board',kind:'board',name:'掲示板',position:[-2,0,0]},{id:'inn',kind:'inn',name:'宿',position:[0,0,-2]}]}],npcs:[],events:[],causalScenarios:[],routes:[],items:[{id:'timber',name:'木材',price:65},{id:'supplies',name:'携帯食',price:5,kind:'food'},{id:'medicine',name:'傷薬',price:14,heal:45}],skills:[{id:'magic',name:'基礎魔術',goldCost:22,cost:1}],jobs:[{id:'labor',name:'荷運び',region:'farm',facilityId:'board',minutes:30,pay:45,xp:32}],equipment:[],monsters:[]};}
test('preparation discovers actual services, works for money, purchases and completes repeated lessons',()=>{
 const c=content(),r=new WorldReplay(c);assert.deepEqual(r.view().services,[]);
 const prepared=prepare(r,{items:{timber:2},skills:['magic']});assert.equal(prepared.prepared,true,JSON.stringify(prepared));assert.equal(r.state.player.inventory.timber,2);assert(r.state.player.skills.includes('magic'));assert(r.operations.some(o=>o.command?.type==='work'));assert.equal(r.operations.filter(o=>o.command?.type==='train').length,2);assert.equal(r.state.player.training.magic.lessons.length,2);assert.deepEqual(r.defects,[]);
 assert.equal(digest(replay(c,JSON.parse(JSON.stringify(r.export()))).state),digest(r.state));
});
test('personal portable meal and contextual rest use normal macro commands and preserve replay',()=>{
 const c=content(),r=new WorldReplay(c);const before=r.state.time,hunger=r.state.player.hunger;
 const eat=r.options().find(o=>o.command.type==='eat'&&!o.command.targetId);assert(eat);assert(!r.select(eat,'携帯食を食べる').error);assert.equal(r.state.time,before+900);assert(r.state.player.hunger<hunger);
 const result=performAt(r,r.view().region.objects.find(o=>o.id==='inn'),'rest');assert(!result.error);assert(r.state.time>=before+22500);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
test('unaffordable offers carry public requirements but cannot be selected as executable options',()=>{
 const c=content();c.items[0].price=100;const r=new WorldReplay(c);
 const offer=r.view().interactables.find(t=>t.id==='shop').actions.find(a=>a.itemId==='timber');assert.equal(offer.available,false);assert.equal(offer.requirements.gold,100);assert(!r.options().some(o=>o.command.type==='buy'&&o.command.itemId==='timber'));
});
test('combat controller uses offered attack windows and normal healing, never a victory command',()=>{
 const c=content();c.regions[0].spawn=[-49,0,-45];c.monsters=[{id:'rat',region:'farm',name:'野鼠',hp:35,level:1,attack:4,defense:0,speed:1,range:2.8,xp:20,gold:3,drops:[]}];const r=new WorldReplay(c);r.advance(.1);
 const target=r.view().monsters[0],first=r.options().find(o=>o.command.type==='attack');assert(first);r.select(first,'間合いから攻撃する');assert.equal(r.state.monsters[target.id].hp,35);
 const calendar=r.state.time;r.advance(.1);assert.equal(r.state.monsters[target.id].hp,35);assert.equal(r.state.time,calendar);
 const saved=r.export(),fork=replay(c,saved);const result=engage(r,target.id);assert(result.ended,JSON.stringify(result));assert.equal(r.state.monsters[target.id].hp,0);engage(fork,target.id);assert.equal(digest(fork.state),digest(r.state));assert.deepEqual(r.defects,[]);
});
test('decision counts distinguish engine operations from destination and investigation choices',()=>{
 const operations=[{kind:'command',command:{type:'resume'}},{kind:'command',command:{type:'input',x:1,z:0}},{kind:'advance',seconds:1},{kind:'command',command:{type:'input',x:0,z:0}},{kind:'command',command:{type:'interact',action:'inspect'}}];const n=decisionCounts({operations});assert.equal(n.lowLevelOperations,5);assert.equal(n.meaningfulPlayerDecisions,2);assert.equal(n.travelSegments,1);assert.equal(n.investigations,1);
});
test('two renamed structures use the same physical work commands and survive intermediate reload',()=>{
 const c=content();c.items[0].price=2;c.items.push({id:'rope',name:'縄',price:2});c.skills.push({id:'crafting',name:'工作',goldCost:2,cost:1});c.regions[0].objects.find(o=>o.id==='teacher').skills.push('crafting');
 c.events=[{id:'hazard',name:'設備の傷み',region:'farm',position:[0,0,3],startsAt:100000,deadline:200000}];
 c.structures=['shaft-a','shaft-b'].map((id,i)=>({...structuredClone(DEFAULT_STRUCTURES[0]),id,targetId:i?'pump':'shaft',region:'farm',hazardEventId:'hazard'}));
 c.regions[0].objects.push({id:'shaft',kind:'landmark',name:'支柱',position:[1,0,1]},{id:'pump',kind:'landmark',name:'排水口',position:[1,0,-1]});
 c.causalScenarios=[{eventId:'hazard',type:'infrastructure',structures:c.structures.map(s=>s.id)}];const r=new WorldReplay(c);
 assert(prepare(r,{items:{timber:10,rope:4},skills:['crafting']}).prepared);
 let intermediate;
 for(const structure of c.structures)for(const action of structure.actions){const t=r.view().region.objects.find(o=>o.id===structure.targetId);assert(!performAt(r,t,'maintain',{action:action.id}).error);if(!intermediate)intermediate=JSON.parse(JSON.stringify(r.export()));}
 assert.equal(r.state.events.hazard.status,'prevented');assert.equal(r.state.structures['shaft-a'].integrity,100);assert.equal(r.state.structures['shaft-b'].water,0);assert.deepEqual(r.defects,[]);
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));assert.equal(replay(c,intermediate).state.structures['shaft-a'].operating,false);assert.equal(replay(c,intermediate).state.events.hazard.status,'latent');
});
test('server catalog omits unexplored regions and routes, not just client map labels',async()=>{
 const c=content();c.regions.push({...c.regions[0],id:'unseen',name:'未発見の町',objects:[]});c.routes=[{id:'hidden-road',from:'farm',to:'unseen',minutes:30,modes:['foot']}];
 const service=new PersistentWorldService({content:c,store:new MemoryWorldStore(),autoStart:false});
 const response=await service.session(hashWorldToken('map-boundary'),{create:true});assert.deepEqual(response.content.regions.map(r=>r.id),['farm']);assert.deepEqual(response.content.routes,[]);assert(!JSON.stringify(response).includes('未発見の町'));await service.close();
});
test('recorded checkpoint v2 state migrates, saves, reloads and keeps calendar frozen',async()=>{
 const c=JSON.parse(await fs.readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
 const certificate=JSON.parse(await fs.readFile(new URL('./fixtures/replay/institution.json',import.meta.url),'utf8')),state=structuredClone(certificate.initialState),ownerKey=hashWorldToken('checkpoint-v2-migration'),store=new MemoryWorldStore();
 const saved={schemaVersion:2,id:'checkpoint-fixture',ownerKey,contentRevision:'world-10d-24de1ef85209',contentHash:'705e96bfa08f795647cca3b56829b23e44aac25b1d85c1151f682a32666f9908',state,advancedAtMs:1,revision:1,lastSeq:0,receipts:[]};await store.put(ownerKey,saved);
 const service=new PersistentWorldService({content:c,store,autoStart:false,now:()=>99999999});const result=await service.session(ownerKey);assert.equal(result.view.time,state.time);assert.equal(result.view.player.gold,state.player.gold);assert.equal(result.view.player.region,state.player.region);await service.close();
 const migrated=await store.get(ownerKey);assert.equal(migrated.contentMigration.from,saved.contentRevision);assert.equal(migrated.state.structures['deep-shaft'].operating,true);assert.deepEqual(migrated.state.knowledge,state.knowledge);
 const reloaded=new PersistentWorldService({content:c,store,autoStart:false,now:()=>199999999});assert.equal((await reloaded.session(ownerKey)).view.time,state.time);await reloaded.close();
});
test('aware policy follows a discovered waterway need through ordinary preparation and intervention',()=>{
 const c=content();c.items[0].price=2;c.items.push({id:'rope',name:'縄',price:2},{id:'crystal',name:'結晶',price:4});
 c.events=[{id:'stream',name:'水路の異変',region:'farm',position:[0,0,3],startsAt:100000,deadline:200000}];c.causalScenarios=[{eventId:'stream',type:'ecosystem',deviceId:'inn',affectedRegion:'farm'}];
 const outcome=runPolicy(c,'evidence-first',{seed:4,decisions:18});assert.equal(outcome.run.state.events.stream.status,'prevented',JSON.stringify(outcome.run.trace.map(t=>({selected:t.selected,result:t.result,reason:t.reason}))));assert(outcome.run.operations.some(o=>o.command?.type==='buy'));assert(outcome.run.operations.some(o=>o.command?.type==='train'));assert.deepEqual(outcome.run.defects,[]);
});
test('a downed player leaves active combat and cannot accumulate negative HP from stale attacks',()=>{
 const c=content();c.regions[0].spawn=[-49,0,-45];c.monsters=[{id:'brute',region:'farm',name:'大獣',hp:500,level:1,attack:300,defense:0,speed:1,range:2.8,xp:20,gold:3,drops:[]}];const r=new WorldReplay(c);r.advance(2);assert.equal(r.state.player.hp,0);assert.equal(r.state.player.collapse.status,'active');const at=r.state.time;r.advance(5);assert.equal(r.state.player.hp,0);assert(r.state.time>at);assert(!r.view().personalActions.some(a=>a.type==='attack'));assert.deepEqual(r.view().personalActions.map(a=>a.type),['recover']);
});
