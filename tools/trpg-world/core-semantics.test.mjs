import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,advanceWorld,advanceMacro,applyCommand,projectWorld} from '../../src/shared/trpg-world/simulation.js';
import {migrateWorld} from '../../src/shared/trpg-world/activity.js';
import {willingToCooperate} from '../../src/shared/trpg-world/relationships.js';
import {collapse} from '../../src/shared/trpg-world/survival.js';
import {CachedNarrativeProvider,MockNarrativeProvider,narrativeEnvelope,validateNarrative} from '../../src/server/trpg/world/narrative.js';

function fixture(){return {revision:'semantics',time:{scale:60,startSeconds:25200},regions:[{id:'farm',name:'村',spawn:[0,0,0],size:160,obstacles:[],worldPosition:[0,0],portals:[],objects:[
  {id:'inn',name:'宿',kind:'inn',position:[0,0,8]}, {id:'well',name:'井戸',kind:'landmark',position:[0,0,2]},
  {id:'office',name:'役所',kind:'job',position:[0,0,3]}, {id:'orphanage',name:'孤児院',kind:'inn',position:[0,0,4]},
  {id:'river',name:'川',kind:'landmark',position:[0,0,2]}, {id:'shop',name:'店',kind:'shop',position:[0,0,3]}]},
  {id:'away',name:'遠方',spawn:[0,0,0],size:100,obstacles:[],objects:[],portals:[],worldPosition:[1,0]}],
  routes:[],items:[{id:'supplies',name:'携帯食',kind:'food',price:10},{id:'medicine',name:'薬',heal:45},{id:'timber',name:'木材'},{id:'rope',name:'縄'},{id:'crystal',name:'結晶'}],skills:[],jobs:[],equipment:[],
  npcs:[{id:'n1',name:'農夫',region:'farm',role:'農夫',home:[0,0,2],work:[0,0,2],knowledge:[{id:'public',kind:'background',text:'麦は昨日刈り取った。',disclosureTrust:0},{id:'secret',kind:'secret',text:'秘密の地図'}]},
    {id:'clerk',name:'役人',region:'farm',role:'役人',home:[0,0,3],work:[0,0,3]},
    {id:'remote',name:'遠くの人',region:'away',role:'農夫',home:[0,0,2],work:[12,0,0]}],
  monsters:[],events:[{id:'crisis',region:'farm',name:'事件',position:[50,0,50],startsAt:30000,deadline:90000,pressure:50}],causalScenarios:[]};}
const begin=(s,c)=>{s.npcs.n1.goal='work';return applyCommand(s,c,{type:'interact',targetId:'n1',action:'talk'});};
const utter=(s,c,id)=>applyCommand(s,c,{type:'converse',sessionId:s.conversation.id,turn:s.conversation.turn,intentId:id});

test('calendar pauses for reading and conversation; walking and explicit macros use their own policies',()=>{
 const c=fixture(),s=createWorld(c),start=s.time;
 applyCommand(s,c,{type:'interact',targetId:'well'});advanceWorld(s,c,30);assert.equal(s.time,start);
 applyCommand(s,c,{type:'input',x:1,z:0});assert.equal(s.input.x,0);
 applyCommand(s,c,{type:'resume'});applyCommand(s,c,{type:'input',x:0,z:1});advanceWorld(s,c,.25);assert(s.time>start);assert(s.player.position[2]>0);
 begin(s,c);const at=s.time;advanceWorld(s,c,30);assert.equal(s.time,at);
 advanceMacro(s,c,'working',3600);assert.equal(s.time,at+3600);assert.equal(s.player.activity.kind,'conversation');
 assert.equal(s.activityHistory.at(-1).worldTimePolicy,'macro');assert(!('travelling' in s.player));
});
test('conversation selects facts semantically, cannot farm XP, and preserves choices across retries',()=>{
 const c=fixture(),s=createWorld(c),xp=s.player.xp;
 const first=begin(s,c),again=begin(s,c);assert.equal(first.conversation.id,again.conversation.id);assert.deepEqual(first.conversation.choices,again.conversation.choices);
 assert(!s.knowledge.some(f=>f.id==='public'));assert(!JSON.stringify(first).includes('秘密の地図'));
 utter(s,c,'ask:public');assert(s.knowledge.some(f=>f.id==='public'));assert(!s.knowledge.some(f=>f.id==='secret'));
 assert.throws(()=>utter(s,c,'ask:secret'),{code:'INTENT_UNAVAILABLE'});assert.equal(s.player.xp,xp);assert(!('trust' in s.npcs.n1));
 s.npcs.n1.travel={to:'away'};assert.throws(()=>utter(s,c,'joke'),{code:'NPC_ABSENT'});
});
test('a gift changes possessions; keeping an actual promise changes cooperation reasons',()=>{
 const c=fixture(),s=createWorld(c);begin(s,c);assert.equal(willingToCooperate(s,s.npcs.n1),false);
 utter(s,c,'promise-supplies');applyCommand(s,c,{type:'interact',targetId:'n1',action:'help'});
 assert.equal(s.npcs.n1.possessions.supplies,1);assert.equal(s.promises[0].status,'kept');assert.equal(willingToCooperate(s,s.npcs.n1),true);
 assert(!JSON.stringify(projectWorld(s,c)).includes('"trust"'));
 assert(s.npcs.n1.memories.every(m=>s.socialFacts.some(f=>f.id===m.factId)));
});
test('normal meals consume calendar time and hunger, not instant medicine HP',()=>{
 const c=fixture(),s=createWorld(c);s.player.hp=50;s.player.hunger=70;
 assert.throws(()=>applyCommand(s,c,{type:'use',itemId:'supplies'}),{code:'FOOD_CONTEXT'});
 const time=s.time;applyCommand(s,c,{type:'eat',itemId:'supplies'});
 assert.equal(s.time,time+900);assert(s.player.hunger<40);assert.equal(s.player.hp,50);assert.equal(s.player.inventory.supplies,1);
});
test('collapse preserves location; only a living present reachable NPC can carry and treat the player',()=>{
 const c=fixture(),s=createWorld(c);s.player.hp=0;const position=[...s.player.position],start=s.time;
 collapse(s,c,'hp');assert.deepEqual(s.player.position,position);assert.equal(s.player.hp,0);
 s.npcs.n1.hp=0;s.npcs.clerk.travel={to:'away'};
 applyCommand(s,c,{type:'recover'});assert.equal(s.player.collapse.rescue,null);assert.deepEqual(s.player.position,position);
 c.npcs.find(n=>n.id==='clerk').role='医師';s.npcs.clerk.travel=null;applyCommand(s,c,{type:'recover'});
 assert.equal(s.player.collapse.status,'recovered');assert.equal(s.player.collapse.rescue.actorId,'clerk');assert(s.time>=start+7200);
 assert(s.player.hp>0);assert.equal(s.player.collapse.injury.treated,true);assert.equal(s.player.collapse.rescue.services.find(x=>x.kind==='bed').cost,8);assert(s.npcs.remote.position[0]>0);
});
test('generic pressure and retired outcome buttons cannot resolve events',()=>{
 const c=fixture(),s=createWorld(c);s.events.crisis.pressure=-10000;advanceWorld(s,c,1);
 assert.equal(s.events.crisis.status,'latent');assert.equal(s.events.crisis.legacyPressureSnapshot,-10000);
 assert(!projectWorld(s,c).interactables.some(i=>i.actions.some(a=>a.action==='intervene')));
});
test('institution documents need actual reading, submission and a physically present reviewer',()=>{
 const c=fixture();c.causalScenarios=[{eventId:'crisis',type:'institution',facilityId:'orphanage',officeId:'office',replacementId:'inn',documents:[{id:'deed',title:'寄付証書',text:'寄付による養育施設',targetId:'orphanage'}]}];
 const s=createWorld(c);
 assert.throws(()=>applyCommand(s,c,{type:'causal',targetId:'office',action:'submit:crisis'}),{code:'CAUSAL_REQUIREMENTS'});
 applyCommand(s,c,{type:'causal',targetId:'orphanage',action:'read:crisis:deed'});
 applyCommand(s,c,{type:'causal',targetId:'office',action:'submit:crisis'});
 s.npcs.clerk.travel={to:'away'};applyCommand(s,c,{type:'resume'});advanceWorld(s,c,1);assert.equal(s.events.crisis.causal.reviewed,false);
 s.npcs.clerk.travel=null;s.npcs.clerk.position=[0,0,3];advanceWorld(s,c,1);assert.equal(s.events.crisis.status,'resolved');
 assert.equal(s.events.crisis.causal.tenure,'protected');
});
test('ecosystem containment has distinct physical conditions and failure opens a later causal precondition',()=>{
 const c=fixture();c.causalScenarios=[{eventId:'crisis',type:'ecosystem',deviceId:'river',affectedRegion:'away',dependentEvents:['later']}];
 c.events.push({id:'later',region:'away',name:'後続',position:[0,0,0],startsAt:100000,deadline:150000});
 const s=createWorld(c);s.player.inventory.timber=2;s.player.inventory.crystal=1;s.player.skills.push('magic');
 applyCommand(s,c,{type:'causal',targetId:'river',action:'seal:crisis'});applyCommand(s,c,{type:'resume'});advanceWorld(s,c,1);
 assert.equal(s.events.crisis.status,'latent'); // sealing alone leaves the core in the river
 applyCommand(s,c,{type:'causal',targetId:'river',action:'divert:crisis'});applyCommand(s,c,{type:'resume'});advanceWorld(s,c,1);
 assert.equal(s.events.crisis.status,'prevented');assert.equal(s.events.crisis.causal.waterFlow,1);
 const failed=createWorld(c);advanceMacro(failed,c,'recovering',12*3600);advanceMacro(failed,c,'recovering',12*3600);
 assert.equal(failed.events.crisis.status,'failed');assert.equal(failed.regions.farm.forestBarrier,false);
 assert.equal(failed.events.later.causal.preconditions.forestPassOpen.sourceEvent,'crisis');assert.equal(failed.regions.away.habitat,'destroyed');
});
test('migration isolates numeric history and converts combat deadlines without advancing calendar',()=>{
 const c=fixture(),s=createWorld(c);s.schemaVersion=1;s.npcs.n1.trust=90;s.events.crisis.pressure=12;s.player.cooldowns.attack=s.time-30;
 const at=s.time;migrateWorld(s,c);assert.equal(s.time,at);assert.equal(s.schemaVersion,2);assert.equal(s.npcs.n1.legacyTrustSnapshot,90);assert(!('trust' in s.npcs.n1));
 assert.equal(s.player.cooldowns.attack,-.5);assert.equal(s.events.crisis.legacyPressureSnapshot,12);assert.equal(willingToCooperate(s,s.npcs.n1),false);
 const copy=structuredClone(s);migrateWorld(s,c);assert.deepEqual(s,copy);
});
test('narrative validates IDs, times out safely, caches wording and cannot mutate state',async()=>{
 const c=fixture(),s=createWorld(c),result=begin(s,c),before=structuredClone(s),request=narrativeEnvelope(s,result);
 const bad=new MockNarrativeProvider(r=>{r.worldTime=0;return {narration:'',npcUtterance:'bad',playerChoiceLabels:[],usedFactIds:['secret']};});
 const provider=new CachedNarrativeProvider(bad);const response=await provider.generate(request);
 assert(validateNarrative(response,request));assert.notEqual(response.npcUtterance,'bad');assert.equal(bad.calls,1);
 await provider.generate(request);assert.equal(bad.calls,1);assert.deepEqual(s,before);
 const timeout=new CachedNarrativeProvider(new MockNarrativeProvider(()=>new Promise(()=>{})),{timeoutMs:5});
 assert(validateNarrative(await timeout.generate(request),request));assert(!request.allowedFactIds.includes('secret'));
});
