import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {prepare,performAt,engage,decisionCounts} from './validation/action-domain.mjs';
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
