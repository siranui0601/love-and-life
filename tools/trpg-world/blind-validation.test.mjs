import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {blindInput} from './validation/blind-run.mjs';
import {chooseBlind} from './validation/blind-policy.mjs';
import {retireDesignInspections} from '../../src/shared/trpg-world/knowledge-migration.js';

function fixture(){return {revision:'blind-contract',time:{scale:60,startSeconds:25200},regions:[{id:'farm',name:'村',size:160,spawn:[0,0,0],obstacles:[],objects:[{id:'notice',kind:'landmark',name:'掲示',position:[1,0,0]},{id:'unseen',kind:'landmark',name:'HIDDEN_SITE',position:[70,0,70]}],portals:[{id:'remote-exit',routeId:'road',to:'other',position:[70,0,-70]}]},{id:'other',name:'HIDDEN_TOWN',size:160,spawn:[0,0,0],objects:[],portals:[],obstacles:[]}],routes:[{id:'road',from:'farm',to:'other',minutes:30,modes:['foot']}],npcs:[],events:[{id:'secret',name:'HIDDEN_EVENT',description:'HIDDEN_CAUSE',region:'other',position:[0,0,0],startsAt:100000,deadline:200000}],causalScenarios:[],items:[],skills:[],jobs:[],equipment:[],monsters:[]};}
test('blind boundary omits hidden places, region graph, events and deadlines; hidden-state changes cannot alter choices',()=>{
 const c=fixture(),a=new WorldReplay(c),modified=fixture();modified.events[0].deadline=900000;modified.events[0].description='OTHER_SECRET';modified.regions[1].name='OTHER_TOWN';modified.regions[0].objects[1].position=[-70,0,-70];const b=new WorldReplay(modified);
 const x=blindInput(a.view()).observation,y=blindInput(b.view()).observation;
 assert(!JSON.stringify(x).includes('HIDDEN'));assert(!JSON.stringify(x).includes('deadline'));assert.deepEqual(x,y);assert.deepEqual(chooseBlind(x,{}),chooseBlind(y,{}));assert.equal(x.places.length,1);assert.equal(x.exits.length,0);
});
test('observed geography comes from physical walking, persists through reload, and exposes only the encountered exit',()=>{
 const c=fixture();c.regions[0].portals[0].position=[0,0,50];const r=new WorldReplay(c);assert.equal(r.view().perception.exits.length,0);
 r.command({type:'resume'});r.command({type:'input',x:0,z:1});r.advance(2);r.command({type:'input',x:0,z:0});const observation=blindInput(r.view()).observation;assert.equal(observation.exits.length,1);assert(observation.exits[0].name.includes('HIDDEN_TOWN'));assert(!('to' in observation.exits[0]));assert(!('routes' in observation));
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));const fork=r.fork();assert.deepEqual(fork.view().perception.exits,r.view().perception.exits);
});
test('10/30/60 seconds during inspection preserve blind semantic choices and calendar',()=>{
 const c=fixture(),r=new WorldReplay(c);r.command({type:'interact',targetId:'notice',action:'inspect'});const before=blindInput(r.view()).observation,time=r.state.time;
 for(const seconds of [10,30,60]){const fork=r.fork();fork.advance(seconds);assert.equal(fork.state.time,time);assert.deepEqual(blindInput(fork.view()).observation,before);}
});
test('a real conversation reports last-seen whereabouts; arriving establishes absence without revealing a remote destination',()=>{
 const c=fixture();c.npcs=[{id:'reporter',name:'住民',region:'farm',home:[1,0,0],work:[1,0,0],knowledge:[{id:'last-seen',kind:'site-observation',text:'この場所で薬を持つ人を見た。',destination:{region:'farm',targetId:'traveller',position:[1,0,0]},source:{type:'seen',observerId:'reporter'},disclosure:{visibility:'public'}}]},{id:'traveller',name:'旅人',region:'other',home:[0,0,0],work:[0,0,0]}];
 const r=new WorldReplay(c);r.advance(.5);r.command({type:'interact',targetId:'reporter',action:'talk'});const ask=r.options().find(o=>o.command.intentId==='ask:last-seen');assert(ask);r.select(ask);
 const direction=r.view().perception.directions[0];assert.equal(direction.destination.status,'not-here');assert.equal(direction.destination.region,'farm');assert(!JSON.stringify(direction).includes('other'));assert.equal(r.view().leads.filter(l=>l.targetId==='traveller').length,0);
 r.select(r.options().find(o=>o.command.intentId==='leave'));r.command({type:'resume'});r.command({type:'input',x:0,z:1});r.advance(2);r.command({type:'input',x:0,z:0});assert.equal(r.view().perception.directions[0].destination.status,'searched-absent');assert.equal(r.fork().view().perception.directions[0].destination.status,'searched-absent');assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});
test('blind action handles use semantics, not rewritten labels or conversation receipt IDs',()=>{
 const r=new WorldReplay(fixture()),a=r.view(),b=structuredClone(a);for(const t of b.interactables)for(const action of t.actions)action.label='別の言い方';
 assert.deepEqual(blindInput(a).observation.actions.map(a=>a.key),blindInput(b).observation.actions.map(a=>a.key));
 a.conversation={id:'first',turn:1,speaker:'a',choices:[{id:'ask:topic',intent:'ASK_ABOUT',family:'ask',label:'尋ねる'}]};b.conversation={...a.conversation,id:'second',turn:90};
 assert.deepEqual(blindInput(a).observation.actions.map(a=>a.key),blindInput(b).observation.actions.map(a=>a.key));
});
test('retired design inspections are archived without deleting objective history or legitimate reading',()=>{
 const c=fixture();c.regions[0].objects[0].sourceDesignNotes='T02調査';const s={player:{inspections:{notice:{at:1,text:'T02調査'},other:{at:2,text:'実際に読んだ手紙'}}},socialFacts:[{id:'objective',kind:'read'}]};
 retireDesignInspections(s,c);assert(!s.player.inspections.notice);assert.equal(s.player.inspections.other.text,'実際に読んだ手紙');assert.equal(s.legacySnapshot.invalidDesignInspections.notice.text,'T02調査');assert.deepEqual(s.socialFacts,[{id:'objective',kind:'read'}]);
});
test('an older account is not offered as a new destination after a more recent account was learned',()=>{
 const c=fixture(),report=(at,position)=>({id:'moving-person',kind:'site-observation',text:'旅人を見かけた。',observedAt:at,destination:{region:'farm',targetId:'traveller',position},source:{type:'seen'},disclosure:{visibility:'public'}});
 c.npcs=[{id:'new-witness',name:'新しい目撃者',region:'farm',home:[1,0,0],work:[1,0,0],knowledge:[report(20,[20,0,0])]},{id:'old-witness',name:'以前の目撃者',region:'farm',home:[-1,0,0],work:[-1,0,0],knowledge:[report(10,[10,0,0])]}];
 const r=new WorldReplay(c);r.advance(.5);r.command({type:'interact',targetId:'new-witness',action:'talk'});r.select(r.options().find(o=>o.command.intentId==='ask:moving-person'));r.select(r.options().find(o=>o.command.intentId==='leave'));r.command({type:'interact',targetId:'old-witness',action:'talk'});
 assert(!r.options().some(o=>o.command.intentId==='ask:moving-person'));assert.deepEqual(r.state.knowledge.find(k=>k.id==='moving-person').destination.position,[20,0,0]);assert.deepEqual(r.defects,[]);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('blind traveller uses the actual offered ferry, pays fare and advances travel time without a foot-only shortcut',()=>{
 const c=fixture();c.regions[0].portals[0].position=[1,0,0];c.routes[0].modes=['boat'];c.routes[0].costs={boat:4};const r=new WorldReplay(c),o=blindInput(r.view());
 const m={visited:o.observation.places.map(p=>p.id),attempted:o.observation.actions.filter(a=>a.type==='interact').map(a=>a.key)};
 const decision=chooseBlind(o.observation,m),command=o.bindings.get(decision.action);assert.equal(command?.type,'travel');assert.equal(command.mode,'boat');
 const gold=r.state.player.gold,time=r.state.time;assert(!r.command(command).error);assert.equal(r.state.player.region,'other');assert.equal(r.state.player.gold,gold-4);assert(r.state.time>time);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('a long river is perceived by its nearby bank rather than its distant centre; blind walking avoids the visible water',()=>{
 const c=fixture();c.regions[0].spawn=[37.4813575832,0,8.3876954656];c.regions[0].obstacles=[{id:'river',x:22,z:-39,width:9,depth:82,height:.15}];
 c.regions[0].objects=[];c.regions[0].portals=[];const r=new WorldReplay(c),o=blindInput(r.view()).observation;assert.equal(o.obstacles.length,1);
 const decision=chooseBlind(o,{bearing:4});assert(decision.walk);const [x,,z]=decision.walk;assert(!(Math.abs(x-22)<4.95&&Math.abs(z+39)<41.45));assert.deepEqual(decision,chooseBlind(o,{bearing:4}));
});
