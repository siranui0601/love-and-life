import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorld,advanceWorld,advanceMacro,applyCommand,projectWorld} from '../../src/shared/trpg-world/simulation.js';
import {findPath,canOccupy,distance} from '../../src/shared/trpg-world/navigation.js';
import {awardXp,LEVEL_XP,MOVEMENT} from '../../src/shared/trpg-world/progression.js';
import {matchesCombatCondition} from '../../src/shared/trpg-world/combat.js';

function fixture() {
  return {version:1,revision:'test',time:{days:10,scale:60,startSeconds:21600},
    regions:[{id:'farm',name:'村',size:160,spawn:[0,0,0],worldPosition:[0,0],obstacles:[{id:'wall',x:8,z:0,width:2,depth:12,height:4}],objects:[
      {id:'shop',kind:'shop',name:'店',position:[0,0,2]}, {id:'trainer',kind:'trainer',name:'師匠',position:[0,0,2]},
      {id:'inn',kind:'inn',name:'宿',position:[0,0,2]},{id:'work',kind:'job',name:'仕事場',position:[0,0,2]},
      {id:'proof',kind:'evidence',name:'書類',position:[0,0,2],eventId:'food',evidenceId:'food:proof'},
      {id:'forge',kind:'workshop',name:'作業台',position:[0,0,2],crafting:true},
      {id:'board',kind:'board',name:'掲示板',position:[0,0,2]},{id:'stable',kind:'stable',name:'厩舎',position:[0,0,2]}],
      portals:[{id:'exit',to:'capital',routeId:'road',position:[0,0,40],radius:3}]},
      {id:'capital',name:'王都',size:160,spawn:[0,0,0],worldPosition:[1,0],obstacles:[],objects:[],portals:[{id:'return',to:'farm',routeId:'road',position:[0,0,40],radius:3}]}],
    routes:[{id:'road',from:'farm',to:'capital',minutes:60,modes:['foot','horse','carriage','broom']}],
    npcs:[{id:'n1',name:'農夫',role:'農夫',region:'farm',home:[-6,0,0],work:[-16,0,0],secret:'not-public'},
      {id:'n2',name:'役人',role:'役人',region:'capital',home:[0,0,20],work:[0,0,0],secret:'hidden-plan'}],
    events:[{id:'food',name:'食料危機',region:'farm',position:[0,0,3],startsAt:30000,deadline:40000,pressure:50,description:'穀倉が傷んでいる。',cause:'secret-root',
      mechanisms:[{id:'supply',label:'物資を運び込む',kind:'logistics',requirements:{items:{supplies:2}},effects:{pressure:-100,setFacts:['granary-filled'],xp:100}},
        {id:'proof',label:'調査から原因を止める',kind:'information',requirements:{skills:['investigation'],evidence:['food:proof']},effects:{pressure:-100,setFacts:['saboteur-exposed'],xp:100}}],
      failureEffects:{stock:{farm:-.5},evidence:['should-not-leak']}},
      {id:'coup',name:'秘密の王都事件',region:'capital',position:[0,0,0],startsAt:32000,deadline:42000,description:'衛兵が門を閉じる。',mechanisms:[],failureEffects:{stock:{capital:-.4}}}],
    items:[{id:'supplies',name:'物資',price:10},{id:'medicine',name:'薬',price:12},{id:'timber',name:'木材',price:12},{id:'rope',name:'縄',price:8},{id:'horse',name:'馬',price:120},{id:'broom',name:'箒',price:180}],
    skills:[{id:'riding',name:'乗馬',cost:1,goldCost:10},{id:'broom',name:'箒飛行',cost:1,goldCost:10,requires:['magic']},{id:'magic',name:'魔術',cost:1,goldCost:10},{id:'crafting',name:'工作',cost:1,goldCost:0}],
    jobs:[{id:'labor',name:'荷運び',region:'farm',minutes:120,pay:35,xp:30}],
    recipes:[{id:'field-kit',name:'野営用キット',facilityIds:['forge'],requirements:{skills:['crafting'],items:{timber:1,rope:1}},outputs:{items:{supplies:3}},minutes:30,xp:24}],
    monsters:[{id:'rat',name:'野鼠',region:'farm',level:1,hp:35,attack:4,defense:0,xp:20,gold:3,role:'minion',speed:2,range:2.8,drops:[]}],equipment:[],equipmentShops:[]};
}

test('authoritative movement normalizes diagonal input and cannot tunnel through collision',()=>{
  const c=fixture(),s=createWorld(c); applyCommand(s,c,{type:'input',x:1,z:0});advanceWorld(s,c,4);
  assert(s.player.position[0]<6.6);assert(canOccupy(c.regions[0],s.player.position));
  assert.throws(()=>applyCommand(s,c,{type:'input',x:100,z:0}),{code:'INVALID_INPUT'});
  assert.throws(()=>applyCommand(s,c,{type:'input',x:NaN}),{code:'INVALID_INPUT'});
  const before=[...s.player.position];applyCommand(s,c,{type:'input',x:0,z:0,position:[70,0,70],time:999999});advanceWorld(s,c,1);assert.deepEqual(s.player.position,before);
});
test('A* navigates around walls without corner cutting',()=>{
  const c=fixture(),region=c.regions[0],path=findPath(region,[0,0,0],[16,0,0]);
  assert(path.length>=2);assert(path.some(p=>Math.abs(p[2])>6));assert(path.every(p=>canOccupy(region,p)));
});
test('whole world progresses without quests or the player learning hidden events',()=>{
  const c=fixture(),s=createWorld(c);assert(!projectWorld(s,c).knownEvents.some(e=>e.id==='coup'));
  advanceWorld(s,c,400);assert.equal(s.events.coup.status,'failed');assert(s.regions.capital.stock<1);
  const view=projectWorld(s,c),serialized=JSON.stringify(view);
  assert(!serialized.includes('秘密の王都事件'));assert(!serialized.includes('hidden-plan'));assert(!serialized.includes('secret-root'));
  assert(!s.player.evidence.includes('should-not-leak'));assert.equal(s.quests.length,0);
});
// Retired: pressure decrements used to certify two complete solutions. The
// replacement contract forbids those shortcuts; causal paths live in core-semantics.
test('material and evidence do not authorize a generic outcome selection',()=>{
 const c=fixture(),s=createWorld(c);const before=structuredClone(s);
 assert.throws(()=>applyCommand(s,c,{type:'interact',targetId:'event:food',action:'intervene',option:'supply'}),{code:'RETIRED_MECHANISM'});
 assert.deepEqual(s,before);
 applyCommand(s,c,{type:'interact',targetId:'proof'});assert(s.player.evidence.includes('food:proof'));
 assert.equal(s.events.food.status,'latent');assert(!projectWorld(s,c).interactables.some(t=>t.actions.some(a=>a.action==='intervene')));
});

test('interaction range, inventory prices, trainer prerequisites and time costs are enforced',()=>{
  const c=fixture(),s=createWorld(c);s.player.position=[50,0,0];
  assert.throws(()=>applyCommand(s,c,{type:'buy',targetId:'shop',itemId:'supplies'}),{code:'TOO_FAR'});s.player.position=[0,0,0];
  assert.throws(()=>applyCommand(s,c,{type:'buy',targetId:'shop',itemId:'supplies',quantity:-1}),{code:'INVALID_QUANTITY'});
  const gold=s.player.gold;applyCommand(s,c,{type:'buy',targetId:'shop',itemId:'supplies',quantity:2});assert.equal(s.player.gold,gold-20);assert.equal(s.player.inventory.supplies,4);
  assert.throws(()=>applyCommand(s,c,{type:'train',targetId:'trainer',skillId:'broom'}),{code:'TRAINING_REQUIREMENTS'});
  applyCommand(s,c,{type:'train',targetId:'trainer',skillId:'riding'});assert(!s.player.skills.includes('riding'));assert.equal(s.player.training.riding.mastery,.5);applyCommand(s,c,{type:'train',targetId:'trainer',skillId:'riding'});assert(s.player.skills.includes('riding'));
  assert.throws(()=>applyCommand(s,c,{type:'mount',mode:'horse'}),{code:'NEED_MOUNT'});
  const time=s.time;applyCommand(s,c,{type:'work',targetId:'work',jobId:'labor'});assert.equal(s.time,time+7200);
});
test('crafting turns hunted or purchased materials into crisis supplies at a physical workshop',()=>{
  const c=fixture(),s=createWorld(c);s.player.position=[0,0,0];s.player.skills.push('crafting');s.player.inventory.timber=1;s.player.inventory.rope=1;
  const forge=projectWorld(s,c).interactables.find(item=>item.id==='forge');assert(forge);
  const recipe=forge.actions.find(action=>action.recipeId==='field-kit');assert(recipe?.available);
  const beforeTime=s.time,beforeGold=s.player.gold;
  const result=applyCommand(s,c,{type:'craft',targetId:'forge',recipeId:'field-kit'});
  assert.equal(result.outputs.supplies,3);assert.equal(result.minutes,30);assert.equal(s.time,beforeTime+30*60);
  assert.equal(s.player.inventory.timber,0);assert.equal(s.player.inventory.rope,0);assert.equal(s.player.inventory.supplies,5);assert.equal(s.player.gold,beforeGold);
  assert.equal(s.player.mastery.crafting,1);assert(s.history.at(-1).kind==='craft');
  const after=structuredClone(s);assert.throws(()=>applyCommand(s,c,{type:'craft',targetId:'forge',recipeId:'field-kit'}),{code:'CRAFT_REQUIREMENTS'});assert.deepEqual(s,after);
  assert.throws(()=>applyCommand(s,c,{type:'craft',targetId:'shop',recipeId:'field-kit'}),{code:'NOT_WORKSHOP'});
});
test('transport requires a physical exit and owned capabilities and simulates elapsed world time',()=>{
  const c=fixture(),s=createWorld(c);assert.throws(()=>applyCommand(s,c,{type:'travel',portalId:'exit',mode:'foot'}),{code:'TOO_FAR'});
  s.player.position=[0,0,40];assert.throws(()=>applyCommand(s,c,{type:'travel',portalId:'exit',mode:'horse'}),{code:'NEED_SKILL'});
  const time=s.time;applyCommand(s,c,{type:'travel',portalId:'exit',mode:'foot'});assert.equal(s.player.region,'capital');assert.equal(s.time,time+3600);assert.equal(s.player.mode,'foot');
});
test('portal transport actions expose authoritative fare, duration and missing capability',()=>{
  const c=fixture(),s=createWorld(c);s.player.position=[0,0,40];
  let portal=projectWorld(s,c).interactables.find(item=>item.id==='exit');
  assert(portal);
  const carriage=portal.actions.find(action=>action.mode==='carriage');
  assert.equal(carriage.available,true);assert.equal(carriage.price,12);assert.equal(carriage.minutes,39);assert.match(carriage.label,/馬車で向かう · 39分 · 12G · 安定/);
  const horse=portal.actions.find(action=>action.mode==='horse');
  assert.equal(horse.available,false);assert(horse.missing.includes('乗馬'));
  s.player.gold=0;portal=projectWorld(s,c).interactables.find(item=>item.id==='exit');
  assert(portal.actions.find(action=>action.mode==='carriage').missing.includes('12G'));
  assert.throws(()=>applyCommand(s,c,{type:'travel',portalId:'exit',mode:'carriage'}),{code:'NO_GOLD'});
});
test('accepted world events project as urgent quests only when their live deadline is near',()=>{
  const c=fixture(),s=createWorld(c);
  applyCommand(s,c,{type:'accept',targetId:'board',eventId:'food'});
  let quest=projectWorld(s,c).quests[0];
  assert.equal(quest.status,'accepted');assert.equal(quest.worldStatus,'latent');assert.equal(quest.urgent,false);
  s.time=30000;advanceWorld(s,c,.1);quest=projectWorld(s,c).quests[0];
  assert.equal(quest.worldStatus,'critical');assert.equal(quest.urgent,true);assert(quest.remaining>0&&quest.remaining<6*3600);
});
test('dangerous routes create deterministic travel hazards and survival preparation avoids them',()=>{
  const c=fixture();c.routes[0].risk=1;
  const exposed=createWorld(c,{seed:999});exposed.player.position=[0,0,40];
  const incident=applyCommand(exposed,c,{type:'travel',portalId:'exit',mode:'foot'});
  assert(incident.hazard?.damage>0);assert(exposed.player.hp<100);assert(Object.keys(exposed.facts).some(id=>id.startsWith('travel-hazard:road:')));
  const prepared=createWorld(c,{seed:999});prepared.player.skills.push('survival');prepared.player.position=[0,0,40];
  const safe=applyCommand(prepared,c,{type:'travel',portalId:'exit',mode:'foot'});
  assert.equal(safe.hazard,null);assert.equal(prepared.player.hp,100);
});
test('an NPC reports last observed knowledge without receiving remote omniscient updates',()=>{
  const c=fixture(),s=createWorld(c);s.npcs.n1.position=[0,0,0];s.npcs.n1.goal='social';
  s.npcs.n1.knowledge.push({id:'event:coup',kind:'event',eventId:'coup',text:'王都の門で不穏な動きを見た。',region:'capital',status:'active',observedAt:20000,confidence:1,source:{type:'seen'}});
  s.events.coup.status='failed';applyCommand(s,c,{type:'interact',targetId:'n1',action:'talk'});applyCommand(s,c,{type:'converse',sessionId:s.conversation.id,turn:s.conversation.turn,intentId:`ask:${s.npcs.n1.knowledge[0].id}`});
  assert.equal(projectWorld(s,c).knownEvents.find(e=>e.id==='coup').status,'active');
  assert(!JSON.stringify(projectWorld(s,c).npcs).includes('knowledge'));
});
test('NPC movement, work and needs simulate outside the loaded region',()=>{
  const c=fixture(),s=createWorld(c),before=[...s.npcs.n2.position];advanceWorld(s,c,120);
  assert.notDeepEqual(s.npcs.n2.position,before);assert(s.npcs.n2.hunger>20);assert(s.npcs.n2.goal);assert.equal(s.player.region,'farm');
});
test('sleep advances crises while blocking sleeping-player observations; reload is deterministic',()=>{
  const c=fixture(),s=createWorld(c);s.knowledge=[];applyCommand(s,c,{type:'rest',targetId:'inn',hours:6});
  assert.equal(s.events.food.status,'failed');assert(!s.knowledge.some(k=>k.eventId==='food'));
  const restored=JSON.parse(JSON.stringify(s));advanceWorld(s,c,30);advanceWorld(restored,c,30);assert.deepEqual(restored,s);
});
test('combat enforces range and cooldown and grants rewards only once',()=>{
  const c=fixture(),s=createWorld(c),enemy=Object.values(s.monsters)[0];
  assert.throws(()=>applyCommand(s,c,{type:'attack',targetId:enemy.id}),{code:'ATTACK_RANGE'});s.player.position=[enemy.position[0]+1,0,enemy.position[2]];
  applyCommand(s,c,{type:'attack',targetId:enemy.id});assert.throws(()=>applyCommand(s,c,{type:'attack',targetId:enemy.id}),{code:'COOLDOWN'});
  for(let i=0;i<8&&enemy.hp>0;i++){advanceWorld(s,c,1);if(enemy.hp>0)applyCommand(s,c,{type:'attack',targetId:enemy.id});}
  assert.equal(enemy.hp,0);const xp=s.player.xp;assert.throws(()=>applyCommand(s,c,{type:'attack',targetId:enemy.id}),{code:'ENEMY_MISSING'});assert.equal(s.player.xp,xp);
});
test('ordinary rewards give steady capability growth and repeated farming diminishes',()=>{
  const c=fixture(),s=createWorld(c),start=s.player.xp;
  const first=awardXp(s,30,'encounter:rat'),repeat=awardXp(s,30,'encounter:rat');assert(first>repeat);assert(s.player.level<=2);
  assert.equal(LEVEL_XP.length,12);assert(s.player.xp>start);
});
test('enemy attacks have observable telegraphs and physical dodging or guarding changes the result',()=>{
  const c=fixture(),dodger=createWorld(c),guard=createWorld(c),standing=createWorld(c);
  for(const s of [dodger,guard,standing]){const enemy=Object.values(s.monsters)[0];s.player.position=[enemy.position[0]+1,0,enemy.position[2]];}
  advanceWorld(dodger,c,.1);assert(projectWorld(dodger,c).monsters[0].intent?.resolvesAt>dodger.simulationTime);
  applyCommand(dodger,c,{type:'dodge',x:1,z:0});advanceWorld(dodger,c,1.2);assert.equal(dodger.player.hp,100);assert(dodger.player.stamina<100);
  applyCommand(guard,c,{type:'defend',active:true});advanceWorld(guard,c,1.5);advanceWorld(standing,c,1.5);
  assert(guard.player.hp>standing.player.hp);
});
test('imported combat expressions use a closed grammar and never execute arbitrary code',()=>{
  assert(matchesCombatCondition('battle.turn%3==1',{battle:{turn:4}}));
  assert(matchesCombatCondition("target.debuffs.notContains('poison')",{target:{debuffs:[]}}));
  assert(!matchesCombatCondition('self.hpRatio<0.3; process.exit()',{self:{hpRatio:.1}}));
  assert(!matchesCombatCondition('constructor.prototype.polluted==true',{}));
});
function walkPhysical(state,content,target) {
  applyCommand(state,content,{type:'resume'});
  const regionFor=()=>content.regions.find(region=>region.id===state.player.region);
  let guard=0;
  while(distance(state.player.position,target)>.08) {
    assert(++guard<5000,'physical walk stalled');
    const path=findPath(regionFor(),state.player.position,target);
    assert(path.length,'physical walk has no route');
    for(const point of path) while(distance(state.player.position,point)>.08) {
      assert(++guard<5000,'physical walk step stalled');
      const d=distance(state.player.position,point);
      applyCommand(state,content,{type:'input',x:(point[0]-state.player.position[0])/d,z:(point[2]-state.player.position[2])/d});
      advanceWorld(state,content,Math.min(.35,d/MOVEMENT.foot.speed));
    }
  }
  applyCommand(state,content,{type:'input',x:0,z:0});
}
// Killing an opponent is a combat fact, not a rescued-person outcome.
test('defeating the production wolf cannot stand in for Finn returning to his family',async()=>{
 const c=JSON.parse(await readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
 const s=createWorld(c,{seed:19});advanceWorld(s,c,120);
 const opposition=s.monsters['opposition:lost-road'];assert(opposition);walkPhysical(s,c,opposition.position);
 for(let attempts=0;opposition.hp>0&&attempts<30;attempts++) {
   if(distance(s.player.position,opposition.position)>3.1)walkPhysical(s,c,opposition.position);
   try{applyCommand(s,c,{type:'attack',targetId:opposition.id});}catch(error){assert.equal(error.code,'COOLDOWN');}
   advanceWorld(s,c,.8);
 }
 assert.equal(opposition.hp,0);assert(s.player.evidence.includes('lost-road:threat-reduced'));
 assert(!['resolved','prevented'].includes(s.events['lost-road'].status));assert.notEqual(s.events['lost-road'].causal.phase,'reunited');
});

test('production content has complete region topology and settles every crisis during explicit macro activities',async(t)=>{
  let c;try{c=JSON.parse(await readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));}catch(error){if(error.code==='ENOENT')return t.skip('Content generation is still in progress.');throw error;}
  assert.equal(c.regions.length,11);assert(c.npcs.length>=111);assert.equal(c.events.length,8);
  const reached=new Set([c.regions[0].id]);for(let i=0;i<c.regions.length;i++)for(const r of c.routes){if(reached.has(r.from))reached.add(r.to);if(reached.has(r.to))reached.add(r.from);}assert.equal(reached.size,11);
  const s=createWorld(c);for(let i=0;i<22;i++)advanceMacro(s,c,'recovering',12*3600);assert(Object.values(s.events).every(e=>['failed','prevented','resolved'].includes(e.status)));assert(s.cycleComplete);
});
const DAY=86400;
