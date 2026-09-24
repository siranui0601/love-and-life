import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PersistentWorldService,hashWorldToken} from '../../src/server/trpg/world/service.js';
import {FileWorldStore} from '../../src/server/trpg/world/store.js';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt} from './validation/action-domain.mjs';
const fixture=()=>({revision:'powered-transfer-contract',time:{scale:60,startSeconds:25200},regions:[{id:'farm',name:'神殿',size:160,spawn:[0,0,0],obstacles:[],portals:[],objects:[
 {id:'sender',name:'送出環',kind:'landmark',position:[0,0,8]},{id:'receiver',name:'地下区画',kind:'landmark',position:[24,0,0]},{id:'inn',name:'休憩所',kind:'inn',position:[0,0,-2]}]}],routes:[],
 npcs:[{id:'pilgrim',name:'巡礼者',region:'farm',home:[0,0,8],work:[0,0,8]}],events:[{id:'incident',name:'回廊の異変',region:'farm',position:[0,0,8],startsAt:25200,deadline:32400,sourceIds:['transfer']}],causalScenarios:[],
 items:[{id:'medicine',name:'傷薬',price:8},{id:'rope',name:'縄',price:5}],skills:[],jobs:[],equipment:[],monsters:[],processes:[{id:'device',kind:'device',eventId:'incident',sourceId:'transfer',region:'farm',targetId:'sender',name:'送出環',observation:'送出環の針が不安定だ。',initial:{powered:true,integrity:40},transfer:{destinationId:'receiver',shelterId:'inn',radius:2,windupSeconds:180,charges:1,damage:20}}]});
const at=(r,id,type,parameter={})=>{const result=performAt(r,r.view().region.objects.find(o=>o.id===id)||r.view().npcs.find(n=>n.id===id),type,parameter);assert(!result.error,JSON.stringify(result));};
function until(r,predicate,max=120){r.command({type:'resume'});for(let i=0;i<max&&!predicate();i++)r.advance(1);assert(predicate(),JSON.stringify({transfers:r.state.deviceTransfers,cases:r.state.careCases,npcs:r.state.npcs}));}

test('an actual person inside a damaged powered field is displaced after its saved active interval, not at command acceptance',()=>{
 const c=fixture(),r=new WorldReplay(c);r.command({type:'resume'});r.advance(1);assert(r.state.deviceTransfers.device.pending);assert.deepEqual(r.state.npcs.pilgrim.position,[0,0,8]);
 r.command({type:'pause'});const clock=r.state.time;r.advance(30);assert.equal(r.state.time,clock);assert.deepEqual(r.state.npcs.pilgrim.position,[0,0,8]);
 const saved=r.fork();for(const run of [r,saved]){until(run,()=>run.state.deviceTransfers.device.passages.length===1);assert.deepEqual(run.state.npcs.pilgrim.position,[24,0,0]);assert.equal(run.state.npcs.pilgrim.hp,50);assert.equal(run.state.npcs.pilgrim.care.status,'injured');assert.equal(run.state.deviceTransfers.device.charge,0);assert(!Object.keys(run.state.structures).length);assert(!run.state.player.collapse);}
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('normal isolation, actual first aid and escorted shelter arrival recover the person; isolation alone cannot erase the casualty',()=>{
 const c=fixture(),r=new WorldReplay(c);until(r,()=>r.state.deviceTransfers.device.passages.length===1);
 at(r,'sender','process',{action:'device/inspect'});at(r,'sender','process',{action:'device/isolate'});assert.equal(r.state.npcs.pilgrim.care.status,'injured');
 const medicine=r.state.player.inventory.medicine;at(r,'pilgrim','causal',{action:'tend'});assert.equal(r.state.player.inventory.medicine,medicine-1);at(r,'pilgrim','causal',{action:'escort'});
 const saved=r.fork();for(const run of [r,saved]){at(run,'inn');until(run,()=>run.state.npcs.pilgrim.care.status==='recovered');at(run,'inn','rest');assert(['resolved','prevented'].includes(run.state.events.incident.status));assert(run.state.socialFacts.some(f=>f.kind==='rescue'&&f.targetId==='pilgrim'));assert(!run.state.player.collapse);}
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('power isolated before activation prevents displacement without moving or injuring anyone',()=>{
 const c=fixture();c.processes[0].startsAt=9*3600;const r=new WorldReplay(c);at(r,'sender','process',{action:'device/inspect'});at(r,'sender','process',{action:'device/isolate'});at(r,'inn','rest');
 assert.equal(r.state.deviceTransfers.device.passages.length,0);assert.equal(r.state.npcs.pilgrim.hp,70);assert(['prevented','resolved'].includes(r.state.events.incident.status));
});

test('a doctor who arrives later can discover the actual injury and treat it without learning an unwitnessed transfer',()=>{
 const c=fixture();c.npcs.push({id:'doctor',name:'医師',role:'医師',region:'farm',home:[55,0,0],work:[24,0,0],workFacilityId:'receiver',possessions:{medicine:1}});
 const r=new WorldReplay(c);at(r,'inn','rest');assert.equal(r.state.npcs.pilgrim.care.status,'recovered');assert.equal(r.state.npcs.doctor.possessions.medicine,0);
 assert(r.state.npcs.doctor.memories.some(m=>m.kind==='injured-person'));assert(!r.state.npcs.doctor.memories.some(m=>m.kind==='powered-arrival'));assert(r.state.socialFacts.some(f=>f.kind==='rescue'&&f.actorId==='doctor'));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('unattended injury stays in the world after a missed deadline and can be rescued afterwards',()=>{
 const c=fixture(),r=new WorldReplay(c);until(r,()=>r.state.deviceTransfers.device.passages.length===1);at(r,'inn','rest');assert.equal(r.state.events.incident.status,'failed');assert.equal(r.state.npcs.pilgrim.care.status,'injured');
 at(r,'pilgrim','causal',{action:'tend'});at(r,'pilgrim','causal',{action:'escort'});at(r,'inn');until(r,()=>r.state.npcs.pilgrim.care.status==='recovered');assert.equal(r.state.events.incident.status,'failed');assert(!r.state.player.collapse);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('same coordinates in another region are not inside the sending field; newly introduced machines remain dormant on old saves',()=>{
 const c=fixture();c.regions.push({id:'other',name:'遠方',size:160,spawn:[0,0,8],obstacles:[],portals:[],objects:[]});c.npcs[0].region='other';
 const r=new WorldReplay(c);at(r,'inn','rest');assert.equal(r.state.deviceTransfers.device.passages.length,0);assert.equal(r.state.npcs.pilgrim.region,'other');
 const current=fixture(),old=structuredClone(current);old.revision='older';delete old.processes[0].transfer;
 const prior=new WorldReplay(old),restored=new WorldReplay(current,{initialState:prior.state});at(restored,'inn','rest');assert(restored.state.deviceTransfers.device.legacyDormant);assert.equal(restored.state.deviceTransfers.device.passages.length,0);assert.equal(restored.state.npcs.pilgrim.hp,70);
});

test('canonical pilgrim actually enters the corridor and is found injured at the machine receiver, without a collapse proxy',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));
 c.time.startSeconds=c.processes.find(p=>p.id==='pilgrim-transfer').startsAt-600;const r=new WorldReplay(c,{seed:4});const inn=r.view().region.objects.find(o=>o.kind==='inn');assert(!performAt(r,inn,'rest').error);
 const transfer=r.state.deviceTransfers['pilgrim-transfer'];assert.equal(transfer.passages.length,1,JSON.stringify(transfer));assert.equal(transfer.passages[0].personId,'NPC055');
 const person=r.state.npcs.NPC055,receiver=c.regions.find(reg=>reg.id==='temple').objects.find(o=>o.id==='LOC_TEMPLE_SEALED');assert.deepEqual(person.position,receiver.position);assert.equal(person.care.status,'injured');assert.equal(person.hp,50);assert.equal(r.state.structures['structure:pilgrim-transfer'].damageAt,undefined);assert(!r.state.player.collapse);
});

test('a real file save during the active field restarts with zero offline time and the same service continuation',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'trpg-transfer-')),content=fixture(),owner=hashWorldToken('transfer-restart');let nowA=1000,nowB=1000;
 const storeA=new FileWorldStore({directory:path.join(directory,'a')}),storeB=new FileWorldStore({directory:path.join(directory,'b')});
 const a=new PersistentWorldService({content,store:storeA,now:()=>nowA,autoStart:false,saveIntervalMs:0});let b;
 try{
  await a.session(owner,{create:true});await a.command(owner,{seq:1,command:{type:'resume'}});nowA+=500;await a.state(owner);await a.tick();
  const checkpoint=await storeA.get(owner);assert(checkpoint.state.deviceTransfers.device.pending);
  // Restore an exact durable backup, not a fabricated intermediate world state.
  await storeB.put(owner,checkpoint);nowB=nowA+86400000;
  b=new PersistentWorldService({content,store:storeB,now:()=>nowB,autoStart:false,saveIntervalMs:0});await b.session(owner);
  assert.equal(b.sessions.get(owner).record.state.time,checkpoint.state.time);assert.deepEqual(b.sessions.get(owner).record.state.deviceTransfers.device.pending,checkpoint.state.deviceTransfers.device.pending);
  for(let i=0;i<10;i++){nowA+=500;nowB+=500;await a.state(owner);await b.state(owner);}
  const actual=a.sessions.get(owner).record.state,restored=b.sessions.get(owner).record.state;
  assert.equal(actual.deviceTransfers.device.passages.length,1);assert.equal(actual.npcs.pilgrim.care.status,'injured');assert.equal(digest(actual),digest(restored));
 } finally {
  await a.close();if(b)await b.close();
  assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(directory).startsWith('trpg-transfer-'));fs.rmSync(directory,{recursive:true,force:true});
 }
});
