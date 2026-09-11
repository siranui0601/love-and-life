import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,advanceWorld,applyCommand,projectWorld} from '../../src/shared/trpg-world/simulation.js';
import {WorldReplay,replay,digest,temporalFork} from './validation/replay.mjs';
import {semanticIdentity} from '../../src/shared/trpg-world/semantic.js';
import {searchPlan} from '../../src/shared/trpg-world/npc-planner.js';
import {assessEvidence} from '../../src/shared/trpg-world/evidence-policy.js';

export function testContent(){return {revision:'semantic-contract',time:{scale:60,startSeconds:9*3600},regions:[{id:'farm',name:'村',spawn:[0,0,0],size:100,objects:[{id:'archive',kind:'evidence',name:'書庫',position:[0,0,2]},{id:'office',kind:'landmark',name:'役所',position:[2,0,0]}],obstacles:[],portals:[]}],npcs:[{id:'clerk',name:'書記',role:'役人',region:'farm',home:[1,0,0],work:[2,0,0],knowledge:[{id:'notice',kind:'background',text:'役所に寄付の記録がある。',disclosure:{visibility:'public'}}]}],events:[{id:'tenure',name:'土地の審理',region:'farm',position:[0,0,2],startsAt:86400,deadline:3*86400}],causalScenarios:[{eventId:'tenure',sourceIds:['source'],type:'institution',facilityId:'archive',officeId:'office',documents:[{id:'deed',title:'寄付の記録',text:'土地は養育のために寄付された。',targetId:'archive'}]}],routes:[],items:[],skills:[],equipment:[],monsters:[],jobs:[]};}
test('semantic identity ignores wording and object key order, distinguishes intent and target',()=>{
 const a={id:'water',intent:'ASK_ABOUT',label:'水は？'},b={label:'水場について聞きたい',intent:'ASK_ABOUT',id:'water'};
 assert.equal(semanticIdentity(a,'person',{}),semanticIdentity(b,'person',{}));assert.notEqual(semanticIdentity(a,'person',{}),semanticIdentity({...a,intent:'WARN'},'person',{}));assert.notEqual(semanticIdentity(a,'person',{}),semanticIdentity(a,'other',{}));
});
test('10/30/60 active seconds while reading have identical semantic choices without clock rounding',()=>{
 const c=testContent(),s=createWorld(c);advanceWorld(s,c,.5);applyCommand(s,c,{type:'pause'});
 const result=temporalFork(c,s,{type:'interact',targetId:'clerk',action:'talk'});assert(result.stable);for(const r of result.runs)assert.deepEqual(r.changes,[]);
});
test('active exploration elapsed time does not randomly reroll conversation topics',()=>{
 const c=testContent(),s=createWorld(c);advanceWorld(s,c,.5);
 const result=temporalFork(c,s,{type:'interact',targetId:'clerk',action:'talk'});assert(result.stable);
});
test('real command stream replays twice and forks through JSON save without divergence',()=>{
 const c=testContent(),run=new WorldReplay(c,{seed:7});run.advance(.5);
 run.command({type:'affordance',action:'lie',targetId:'self'});run.command({type:'interact',action:'talk',targetId:'clerk'});
 const ask=run.options().find(o=>o.command.intentId?.startsWith('ask:'));assert(ask);run.select(ask,'ask about a publicly offered topic');
 const fork=run.fork();for(const r of [run,fork]){r.command({type:'resume'});r.advance(1);r.command({type:'affordance',action:'stand',targetId:'self'});}
 assert.equal(digest(run.state),digest(fork.state));const record=JSON.parse(JSON.stringify(run.export()));assert.equal(digest(replay(c,record).state),digest(run.state));assert.equal(digest(replay(c,record).state),digest(run.state));
});
test('completed information acquisition and submission are not presented as progress again',()=>{
 const c=testContent(),r=new WorldReplay(c);r.advance(.5);
 const read=r.options().find(o=>o.command.action==='read:tenure:deed');assert(read);r.select(read,'read the visible document');assert(!r.options().some(o=>o.signature===read.signature));
 const submit=r.options().find(o=>o.command.action==='submit:tenure');assert(submit);r.select(submit,'submit the acquired copy');assert(!r.options().some(o=>o.signature===submit.signature));
 r.command({type:'resume'});r.advance(.5);assert.equal(r.state.events.tenure.status,'resolved');assert.deepEqual(r.defects,[]);
});
test('reopening a conversation does not resurrect an already answered question',()=>{
 const c=testContent(),r=new WorldReplay(c);r.advance(.5);r.command({type:'interact',action:'talk',targetId:'clerk'});r.select(r.options().find(o=>o.command.intentId==='ask:notice'),'read the public account');
 r.command({type:'resume'});r.command({type:'interact',action:'talk',targetId:'clerk'});assert(!r.options().some(o=>o.command.intentId==='ask:notice'));
});
test('planner tied operators and state object ordering have deterministic outcomes',()=>{
 const ops=[{action:'b',preconditions:{done:false},effects:{done:true},cost:1},{action:'a',preconditions:{done:false},effects:{done:true},cost:1}];assert.deepEqual(searchPlan({done:false},{done:true},ops),searchPlan({done:false},{done:true},ops.toReversed()));
 const c=testContent();c.npcs.push({...c.npcs[0],id:'other'});const a=createWorld(c),b=structuredClone(a);b.npcs=Object.fromEntries(Object.entries(b.npcs).reverse());advanceWorld(a,c,2);advanceWorld(b,c,2);assert.equal(digest(a),digest(b));
});
test('institution does not replace evidence quality with a witness count',()=>{
 const reports=Array.from({length:20},(_,i)=>({id:String(i),reporterId:String(i),statement:{basis:'seen',description:{actorId:'player'},chain:[{memoryStatus:'partial',changes:[]}]}}));
 assert.equal(assessEvidence({allegedOffense:'theft',evidence:[]},reports,'player').response,'question');
 assert.equal(assessEvidence({allegedOffense:'theft',evidence:[{type:'admission'}]},reports,'player').response,'apprehend');
});
