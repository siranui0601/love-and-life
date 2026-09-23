import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt} from './validation/action-domain.mjs';
import {shipmentSecured} from '../../src/shared/trpg-world/shipments.js';

function fixture(){return {revision:'shipment-contract',time:{scale:60,startSeconds:25200},regions:[
 {id:'farm',name:'港町',size:160,spawn:[0,0,0],obstacles:[],portals:[{id:'out',routeId:'sea',to:'island',position:[40,0,0]}],objects:[
  {id:'office',kind:'landmark',name:'税関',position:[0,0,1]}, {id:'original',kind:'landmark',name:'申告書',position:[0,0,2]},
  {id:'inn',kind:'inn',name:'宿',position:[0,0,-2]}, {id:'warehouse',kind:'landmark',name:'倉庫',position:[32,0,0]}]},
 {id:'island',name:'島',size:160,spawn:[0,0,0],obstacles:[],portals:[{id:'back',routeId:'sea',to:'farm',position:[32,0,0]}],objects:[{id:'origin',kind:'landmark',name:'積出し所',position:[-20,0,0]}]}],
 routes:[{id:'sea',from:'farm',to:'island',minutes:60,modes:['ship']}],
 npcs:[{id:'captain',name:'船長',role:'住民',region:'island',home:[0,0,0],work:[0,0,0]},
 {id:'clerk',name:'税関係員',role:'役人',region:'farm',home:[0,0,1],work:[0,0,1],workFacilityId:'office'},
 {id:'owner',name:'荷主',region:'island',home:[-20,0,0],work:[-20,0,0]},
 {id:'receiver',name:'倉庫番',region:'farm',home:[32,0,0],work:[32,0,0]}],
 events:[{id:'incident',name:'違法搬入',region:'farm',position:[32,0,0],startsAt:100000,deadline:200000,sourceIds:['cargo']}],causalScenarios:[],
 items:[],skills:[],jobs:[],equipment:[],monsters:[],processes:[{id:'review',kind:'inquiry',eventId:'incident',sourceId:'cargo',region:'farm',targetId:'office',name:'貨物照合',observation:'書類受付。',initial:{},order:'impound',documents:[{id:'bill',targetId:'original',text:'品目が異なる。'}],reviewers:['clerk'],access:{targetId:'warehouse',closed:true},impoundShipments:['arms']}],
 shipments:[{id:'arms',name:'荷箱',ownerId:'owner',carrierId:'captain',receiverId:'receiver',originId:'origin',destinationId:'warehouse',billId:'bill',dispatchAt:25200,routeIds:['sea'],modes:['ship'],manifest:[{name:'武器の包み',assetId:'arms',quantity:6}]}]};}
const at=(r,id,type,parameter={})=>{const target=r.view().region.objects.find(o=>o.id===id);const result=performAt(r,target,type,parameter);assert(!result.error,JSON.stringify(result));};
function until(r,predicate){r.command({type:'resume'});for(let i=0;i<200&&!predicate();i++)r.advance(1);assert(predicate(),JSON.stringify(r.state.shipments));}

test('cargo needs its actual carrier, portal journey and unloading; save at sea continues the same legal custody',()=>{
 const c=fixture(),r=new WorldReplay(c),box=r.state.properties['cargo:arms'];
 r.command({type:'pause'});r.advance(30);assert.equal(r.state.shipments.arms.phase,'awaiting-carrier');
 r.command({type:'resume'});r.advance(.5);
 assert.equal(box.ownerId,'owner');assert.equal(r.state.shipments.arms.phase,'collecting');assert.equal(r.state.properties['cargo:arms'].custodianId,'owner');
 until(r,()=>!!r.state.npcs.captain.travel);
 const saved=r.fork(),departure=r.state.npcs.captain.travel;
 assert.equal(departure.routeId,'sea');assert.equal(departure.mode,'ship');assert(departure.arrivesAt-departure.departedAt===3600);
 assert.equal(r.state.properties['cargo:arms'].custodianId,'captain');assert(r.state.properties['cargo:arms'].inTransit);
 assert(!r.view().heldProperties.some(o=>o.id==='cargo:arms'));assert(!r.view().interactables.some(o=>o.id==='cargo:arms'));
 for(const run of [r,saved]){
  at(run,'inn','rest');assert.equal(run.state.shipments.arms.phase,'delivered');
  const property=run.state.properties['cargo:arms:0'];assert.equal(property.ownerId,'owner');assert.equal(property.custodianId,'receiver');assert.equal(property.quantity,6);
  assert.equal(property.region,'farm');assert.deepEqual(property.position,[32,0,0]);
  assert(run.state.npcs.captain.planHistory.some(p=>p.goal==='deliver-cargo'));
  const transfers=run.state.propertyTransfers.filter(t=>t.assetId===property.id);assert.deepEqual(transfers.map(t=>[t.from,t.to,t.quantity]),[['owner','captain',6],['captain','receiver',6]]);
 }
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));assert.deepEqual(r.defects,[]);
});

test('local customs order waits for actual cargo; physical seizure preserves title and is the resolution endpoint',()=>{
 const c=fixture();c.shipments[0].dispatchAt=9*3600;const r=new WorldReplay(c);
 at(r,'office','process',{action:'review/inspect'});at(r,'original','interact',{action:'inspect'});at(r,'office','process',{action:'review/submit'});
 r.command({type:'resume'});r.advance(30);
 assert.equal(r.state.processes.review.order.execution.status,'awaiting-cargo');assert.equal(r.state.events.incident.status,'latent');
 const saved=r.fork();for(const run of [r,saved]){
  at(run,'inn','rest');const order=run.state.processes.review.order;
  assert(shipmentSecured(run.state,'arms',order.factId),JSON.stringify({shipment:run.state.shipments.arms,plan:run.state.npcs.captain.plan,captain:run.state.npcs.captain.position,travel:run.state.npcs.captain.travel,order,clerk:run.state.npcs.clerk.position}));assert.equal(order.execution.status,'completed');assert.equal(run.state.events.incident.status,'prevented');
  assert.equal(run.state.properties['cargo:arms:0'].ownerId,'owner');
  const seizure=run.state.socialFacts.find(f=>f.kind==='cargo-impounded');assert.equal(seizure.actorId,'clerk');assert.equal(seizure.region,'farm');assert(Math.hypot(seizure.position[0]-32,seizure.position[2])<3);
 }
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('missing carrier cannot be replaced by a cargo receipt or a successful order',()=>{
 const c=fixture();c.npcs=c.npcs.filter(n=>n.id!=='captain');const r=new WorldReplay(c);
 at(r,'office','process',{action:'review/inspect'});at(r,'original','interact',{action:'inspect'});at(r,'office','process',{action:'review/submit'});at(r,'inn','rest');
 assert.equal(r.state.shipments.arms.phase,'awaiting-carrier');assert.equal(r.state.properties['cargo:arms'].custodianId,'owner');assert.equal(r.state.events.incident.status,'latent');
 assert(!r.state.npcs.captain);assert(!r.state.propertyTransfers?.length);
});

test('property stolen before loading stays stolen; neither carrier nor customs regenerates it',()=>{
 const c=fixture();c.regions[0].objects.push(c.regions[1].objects.pop());c.npcs[0].region='farm';c.shipments[0].dispatchAt=10*3600;const r=new WorldReplay(c);
 at(r,'origin',null);const box='cargo:arms',lot=box+':0';
 for(const [targetId,action] of [[box,'open'],[box,'look'],[lot,'take']])assert(!r.command({type:'property',targetId,action}).error);
 r.command({type:'resume'});r.advance(200);
 assert.equal(r.state.properties[lot].custodianId,'player');assert.equal(r.state.properties[lot].ownerId,'owner');assert.equal(r.state.properties[lot].quantity,6);
 assert.equal(r.state.shipments.arms.phase,'failed');assert.equal(r.state.shipments.arms.failure,'cargo-missing');
 assert.equal(Object.values(r.state.properties).filter(o=>o.assetId==='arms').length,1);assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('new authored cargo is dormant on old save revisions, without spawning possessions',()=>{
 const c=fixture(),old={...c,revision:'older-content',shipments:[]},r=new WorldReplay(old);
 const restored=new WorldReplay(c,{initialState:r.state});restored.command({type:'resume'});restored.advance(10);
 assert(restored.state.shipments.arms.legacyDormant);assert(!restored.state.properties['cargo:arms']);
});

test('an absent consignee cannot receive cargo at matching coordinates in another region',()=>{
 const c=fixture();c.npcs.find(n=>n.id==='receiver').region='island';const r=new WorldReplay(c);
 at(r,'inn','rest');assert.equal(r.state.shipments.arms.phase,'in-transit');assert.equal(r.state.properties['cargo:arms'].custodianId,'captain');
 assert(!r.state.socialFacts.some(f=>f.kind==='cargo-delivered'));
});

test('canonical cargo binding physically loads, crosses the authored sea route and delivers in the production map',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));
 c.time.startSeconds=c.shipments[0].dispatchAt-300;const r=new WorldReplay(c,{seed:4});
 const inn=c.regions.find(region=>region.id==='farm').objects.find(o=>o.kind==='inn');
 for(let attempts=0;attempts<3&&!['delivered','impounded'].includes(r.state.shipments['unmanifested-arms'].phase);attempts++)assert(!performAt(r,inn,'rest').error);
 const s=r.state.shipments['unmanifested-arms'];
 assert.equal(s.phase,'delivered',JSON.stringify({shipment:s,actor:r.state.npcs.NPC052.plan,position:r.state.npcs.NPC052.position,travel:r.state.npcs.NPC052.travel}));
 assert(s.deliveredAt>s.loadedAt+72*60);assert.equal(r.state.properties[s.boxId].region,'trade');assert.equal(r.state.properties[s.boxId].ownerId,'NPC048');assert.equal(r.state.properties[s.boxId].custodianId,'NPC076');
 assert.deepEqual(r.defects,[]);
});
