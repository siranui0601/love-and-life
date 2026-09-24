import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt} from './validation/action-domain.mjs';
function fixture(){return {revision:'deployment-contract',time:{scale:60,startSeconds:25200},regions:[
 {id:'farm',name:'要塞',size:160,spawn:[0,0,0],obstacles:[],portals:[{id:'out',routeId:'road',to:'other',position:[40,0,0]}],objects:[
 {id:'office',kind:'landmark',name:'司令部',position:[0,0,1]},{id:'original',kind:'landmark',name:'記録',position:[0,0,2]},{id:'inn',kind:'inn',name:'宿',position:[0,0,-2]},{id:'assembly',kind:'landmark',name:'兵舎',position:[8,0,0]}]},
 {id:'other',name:'隣国',size:160,spawn:[0,0,0],obstacles:[],portals:[{id:'back',routeId:'road',to:'farm',position:[40,0,0]}],objects:[{id:'post',kind:'landmark',name:'国境の門',position:[24,0,0]}]}],
 routes:[{id:'road',from:'farm',to:'other',minutes:60,modes:['foot']}],
 npcs:[{id:'officer',name:'将校',region:'farm',home:[8,0,0],work:[8,0,0],possessions:{blade:1,supplies:3}},
 {id:'soldier-a',name:'兵士',region:'farm',home:[8,0,1],work:[8,0,1]}, {id:'soldier-b',name:'古参兵',region:'farm',home:[8,0,2],work:[8,0,2]},
 {id:'resident',name:'門番',region:'other',home:[24,0,0],work:[24,0,0]},
 {id:'clerk',name:'司令官',role:'文官',region:'farm',home:[0,0,1],work:[0,0,1],workFacilityId:'office'}],
 events:[{id:'danger',name:'国境の対立',region:'farm',position:[8,0,0],startsAt:32400,deadline:150000,sourceIds:['deployment']}],causalScenarios:[],
 items:[{id:'blade',name:'剣'},{id:'supplies',name:'食料'}],skills:[],jobs:[],equipment:[],monsters:[],
 processes:[{id:'review',kind:'inquiry',eventId:'danger',sourceId:'deployment',region:'farm',targetId:'office',name:'報告の照合',observation:'報告に食い違いがある。',initial:{},order:'stand-down',reviewers:['clerk'],documents:[{id:'report',targetId:'original',text:'申告と出入りの記録が一致しない。'}],enforcement:{kind:'recall',actorId:'officer',meetingId:'post',postId:'post',protectActorId:'resident',routeIds:['road'],modes:['foot'],stoppedOperations:['deployment'],text:'出撃を中止して帰還せよ。'}}],
 actorOperations:[{id:'deployment',actorId:'officer',memberIds:['soldier-a','soldier-b'],assemblySiteId:'assembly',requiredResources:{supplies:3},targetActorId:'resident',targetSiteId:'post',intention:'隊を集めて隣国へ出撃する。',departAt:25200,searchSeconds:4*3600,routeIds:['road'],modes:['foot'],weaponItemId:'blade',windupSeconds:600,damage:30}]};}
const at=(r,id,type,parameter={})=>{const result=performAt(r,r.view().region.objects.find(o=>o.id===id),type,parameter);assert(!result.error,JSON.stringify(result));};
function until(r,predicate,max=360){r.command({type:'resume'});for(let i=0;i<max&&!predicate();i++)r.advance(1);assert(predicate(),JSON.stringify({operation:r.state.actorOperations,process:r.state.processes,npcs:Object.values(r.state.npcs).map(n=>({id:n.id,region:n.region,position:n.position,travel:n.travel,goal:n.goal}))}));}

test('deployment requires actual assembled inhabitants, received instructions and rations, then physically crosses the border',()=>{
 const c=fixture(),r=new WorldReplay(c);until(r,()=>!!r.state.npcs.officer.travel);
 assert.equal(r.state.npcs.officer.possessions.supplies,0);
 for(const id of ['soldier-a','soldier-b']){const n=r.state.npcs[id];assert(n.knowledge.some(k=>k.source.type==='told'&&k.source.actorId==='officer'));assert.equal(n.travel.leaderId,'officer');assert(Math.abs(n.position[0]-40)<4);}
 const saved=r.fork();for(const run of [r,saved]){until(run,()=>run.state.actorOperations.deployment.phase==='holding-position');assert.equal(run.state.npcs.resident.hp,40);for(const id of ['officer','soldier-a','soldier-b'])assert.equal(run.state.npcs[id].region,'other');assert(run.state.socialFacts.some(f=>f.kind==='assault'&&f.actorId==='officer'));}
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('a field recall reaches the real deployed officer and the whole party returns before the order is completed',()=>{
 const c=fixture(),r=new WorldReplay(c);until(r,()=>!!r.state.npcs.officer.travel);
 at(r,'office','process',{action:'review/inspect'});at(r,'original','interact',{action:'inspect'});at(r,'office','process',{action:'review/submit'});
 until(r,()=>r.state.processes.review.order?.deliveryFactId!==undefined);
 const order=r.state.processes.review.order;assert.equal(order.execution.status,'awaiting-return');assert.notEqual(r.state.events.danger.status,'resolved');
 assert.equal(r.state.socialFacts.find(f=>f.id===order.deliveryFactId).region,'other');
 const saved=r.fork();for(const run of [r,saved]){until(run,()=>run.state.actorOperations.deployment.phase==='withdrawn');assert.equal(run.state.processes.review.order.execution.status,'completed');for(const id of ['officer','soldier-a','soldier-b']){assert.equal(run.state.npcs[id].region,'farm');assert(!run.state.npcs[id].operationMember);}assert(['prevented','resolved'].includes(run.state.events.danger.status));}
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('missing rations or missing inhabitants block departure without spawning equipment or soldiers',()=>{
 for(const missing of ['rations','soldier']){
  const c=fixture();if(missing==='rations')delete c.npcs[0].possessions.supplies;else c.npcs=c.npcs.filter(n=>n.id!=='soldier-b');
  const r=new WorldReplay(c);r.command({type:'resume'});r.advance(120);
  assert.equal(r.state.actorOperations.deployment.phase,'assembling');assert.equal(r.state.npcs.officer.region,'farm');assert.equal(r.state.npcs.resident.hp,70);assert(!r.state.socialFacts.some(f=>f.kind==='assault'));assert.notEqual(r.state.events.danger.status,'resolved');
  if(missing==='soldier')assert(!r.state.npcs['soldier-b']);else assert(!r.state.npcs.officer.possessions.supplies);
 }
});

test('an early delivered cancellation prevents departure, while an undelivered paper cannot recall an absent officer',()=>{
 for(const early of [true,false]){
  const c=fixture();c.processes[0].enforcement.meetingId='assembly';if(early)c.actorOperations[0].departAt=32400;
  const r=new WorldReplay(c);if(!early)until(r,()=>r.state.actorOperations.deployment.phase==='holding-position');
  at(r,'office','process',{action:'review/inspect'});at(r,'original','interact',{action:'inspect'});at(r,'office','process',{action:'review/submit'});
  if(early){until(r,()=>r.state.actorOperations.deployment.phase==='withdrawn');assert.equal(r.state.npcs.officer.region,'farm');assert.equal(r.state.npcs.officer.possessions.supplies,3);assert.equal(r.state.npcs.resident.hp,70);assert.equal(r.state.events.danger.status,'prevented');}
  else {r.command({type:'resume'});r.advance(120);assert.equal(r.state.actorOperations.deployment.phase,'holding-position');assert.equal(r.state.processes.review.order.execution.status,'delivering');assert(!r.state.actorOperations.deployment.recallOrderId);assert.notEqual(r.state.events.danger.status,'resolved');}
  assert.equal(digest(replay(c,r.export()).state),digest(r.state));
 }
});

test('canonical border deployment carries the actual officer and two existing soldiers across the authored border road',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));
 c.time.startSeconds=c.actorOperations.find(o=>o.id==='disputed-sortie').departAt-600;const r=new WorldReplay(c,{seed:4});
 const inn=r.view().region.objects.find(o=>o.kind==='inn');assert(!performAt(r,inn,'rest').error);
 const op=r.state.actorOperations['disputed-sortie'];assert.equal(op.phase,'holding-position',JSON.stringify({op,officer:r.state.npcs.NPC040,guard:r.state.npcs.NPC107}));
 for(const id of ['NPC040','NPC041','NPC094'])assert.equal(r.state.npcs[id].region,'blackridge');
 assert.equal(r.state.npcs.NPC040.possessions.supplies,0);assert(op.memberReceipts.NPC041&&op.memberReceipts.NPC094);
 const attack=r.state.socialFacts.find(f=>f.id===op.resultFactId);assert.equal(attack.region,'blackridge');assert.equal(attack.targetId,'NPC107');assert(r.state.npcs.NPC107.injury);assert(!r.state.player.collapse);
});
