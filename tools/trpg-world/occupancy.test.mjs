import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt} from './validation/action-domain.mjs';

function fixture(){return {revision:'occupancy-contract',time:{scale:60,startSeconds:25200},regions:[{id:'farm',name:'町',size:160,spawn:[0,0,0],obstacles:[],portals:[],objects:[
 {id:'office',name:'役所',kind:'landmark',position:[0,0,1]},{id:'original',name:'原本',kind:'landmark',position:[1,0,0]},
 {id:'home',name:'住居',kind:'landmark',position:[30,0,0]},{id:'shelter',name:'仮住居',kind:'landmark',position:[60,0,0]},{id:'inn',name:'宿',kind:'inn',position:[0,0,-2]}]}],routes:[],
 npcs:[{id:'clerk',name:'担当官',role:'役人',region:'farm',home:[0,0,1],work:[0,0,1],workFacilityId:'office'},
 {id:'resident',name:'住民',region:'farm',home:[30,0,0],work:[30,0,0],appointments:[{siteId:'home',startsAt:25200,endsAt:60000,activity:'通知の受け取り'}]},
 {id:'claimant',name:'商人',region:'farm',home:[-30,0,0],work:[-30,0,0]}],
 events:[{id:'dispute',name:'退去問題',region:'farm',position:[30,0,0],startsAt:9*3600,deadline:12*3600,sourceIds:['clearance']}],causalScenarios:[],
 processes:[{id:'review',kind:'inquiry',eventId:'dispute',sourceId:'clearance',region:'farm',targetId:'office',name:'退去指示の照合',observation:'原本を受け付けている。',initial:{},order:'restore-access',reviewers:['clerk'],documents:[{id:'registry',targetId:'original',text:'住民には引き続き住む権利がある。'}],access:{targetId:'home',closed:false},restoresClaims:['clearance']}],
 occupancyClaims:[{id:'clearance',actorId:'claimant',documentId:'vacate-paper',facilityId:'home',shelterId:'shelter',residentIds:['resident'],departAt:8*3600,noticeSeconds:120,routeIds:[],modes:['foot']}],
 items:[{id:'supplies',name:'携帯食',kind:'food',price:5}],skills:[],jobs:[],equipment:[],monsters:[]};}
const at=(r,id,type,parameter={})=>{const result=performAt(r,r.view().region.objects.find(o=>o.id===id),type,parameter);assert(!result.error,JSON.stringify(result));};
const submit=r=>{at(r,'office','process',{action:'review/inspect'});at(r,'original','interact',{action:'inspect'});at(r,'office','process',{action:'review/submit'});};
const details=r=>JSON.stringify({claim:r.state.occupancyClaims.clearance,order:r.state.processes.review?.order,npcs:Object.fromEntries(Object.entries(r.state.npcs).map(([id,n])=>[id,{position:n.position,activity:n.activity,assignment:n.institutionalAssignment,plan:n.plan}]))});

test('actual notice makes a resident walk to shelter; saved departure preserves custody, history and deterministic continuation',()=>{
 const c=fixture(),r=new WorldReplay(c);r.command({type:'resume'});
 for(let i=0;i<180&&!r.state.occupancyClaims.clearance.residents.resident;i++)r.advance(1);
 assert(r.state.occupancyClaims.clearance.residents.resident,details(r));assert(!r.state.facilities.home?.closed);
 const saved=r.fork();for(const run of [r,saved]){at(run,'inn','rest');assert.equal(run.state.occupancyClaims.clearance.residents.resident.phase,'displaced',details(run));assert(run.state.npcs.resident.displacedHome);assert(run.state.facilities.home.closed);assert.equal(run.state.events.dispute.status,'failed');assert(run.state.player.hp>0);}
 const fact=r.state.socialFacts.find(f=>f.kind==='vacate-notice');assert.equal(fact.actorId,'claimant');assert.equal(fact.targetId,'resident');
 assert(r.state.socialFacts.find(f=>f.kind==='resident-displaced').at>fact.at);assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('paper issued at the office is not prevention until an official reaches the site and claimant reads it there',()=>{
 const c=fixture(),r=new WorldReplay(c);submit(r);r.command({type:'resume'});r.advance(6);
 assert(r.state.processes.review.order);assert.notEqual(r.state.occupancyClaims.clearance.phase,'withdrawn');assert(!r.state.facilities.home?.orderId);
 at(r,'inn','rest');assert.equal(r.state.occupancyClaims.clearance.phase,'withdrawn',details(r));assert(!r.state.npcs.resident.displacedHome);assert(['prevented','resolved'].includes(r.state.events.dispute.status));
 const posting=r.state.socialFacts.find(f=>f.kind==='site-order-enacted'),reading=r.state.socialFacts.find(f=>f.kind==='claim-withdrawn');assert(reading.at>posting.at);assert.equal(reading.region,'farm');assert(Math.abs(reading.position[0]-30)<3);
 assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('late review physically reopens the place, official tells displaced resident, and return does not erase failure',()=>{
 const c=fixture(),r=new WorldReplay(c);at(r,'inn','rest');assert.equal(r.state.events.dispute.status,'failed');assert.equal(r.state.occupancyClaims.clearance.residents.resident.phase,'displaced');
 submit(r);const saved=r.fork();for(const run of [r,saved]){run.command({type:'resume'});run.advance(90);assert.equal(run.state.occupancyClaims.clearance.residents.resident.phase,'restored',details(run));assert.equal(run.state.npcs.resident.displacedHome,undefined);assert.equal(run.state.facilities.home.closed,false);assert.equal(run.state.events.dispute.status,'failed');assert(run.state.player.hp>0);}
 const permission=r.state.socialFacts.find(f=>f.kind==='return-permission-received');assert(permission);assert(Math.abs(permission.position[0]-60)<6);assert(r.state.socialFacts.find(f=>f.kind==='resident-returned').at>permission.at);
 assert.equal(r.state.facilities.home.occupierId,undefined);assert.equal(r.state.institutionalOrders[r.state.processes.review.order.factId].execution.status,'completed');
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('absent resident never receives remote notice and a new claim stays dormant in an older save',()=>{
 const c=fixture();c.npcs.find(n=>n.id==='resident').region='other';c.regions.push({id:'other',name:'別の町',size:100,spawn:[30,0,0],objects:[],obstacles:[],portals:[]});
 const r=new WorldReplay(c);at(r,'inn','rest');assert.deepEqual(r.state.occupancyClaims.clearance.residents,{});assert(!r.state.npcs.resident.knowledge.some(k=>k.id.startsWith('notice:')));assert(!r.state.facilities.home?.closed);
 const old=new WorldReplay({...c,revision:'old',occupancyClaims:[]}),restored=new WorldReplay(c,{initialState:old.state});at(restored,'inn','rest');assert(restored.state.occupancyClaims.clearance.legacyDormant);assert(!restored.state.documentCustody?.claimant);
});

test('land-tenure source uses the same physical review, posting and return chain',()=>{
 const c=fixture();c.processes=[];c.causalScenarios=[{eventId:'dispute',sourceIds:['clearance'],type:'institution',facilityId:'home',officeId:'office',replacementId:'shelter',occupancyClaim:'clearance',reviewers:['clerk'],documents:[{id:'deed',targetId:'original',title:'寄付契約',text:'住居は寄付された土地にある。'}]}];
 const r=new WorldReplay(c);at(r,'original','causal',{action:'read:dispute:deed'});at(r,'office','causal',{action:'submit:dispute'});r.command({type:'resume'});r.advance(1);
 assert(r.state.events.dispute.causal.reviewed);assert.notEqual(r.state.events.dispute.causal.tenure,'protected');at(r,'inn','rest');assert.equal(r.state.events.dispute.causal.tenure,'protected');assert.equal(r.state.occupancyClaims.clearance.phase,'withdrawn');assert.equal(digest(replay(c,r.export()).state),digest(r.state));
});

test('canonical claimants notify real residents and both orphanage and quarter displacement execute on the production map',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));
 c.time.startSeconds=6*86400+8*3600;const r=new WorldReplay(c,{seed:4});
 const inn=c.regions.find(region=>region.id==='farm').objects.find(o=>o.kind==='inn');assert(!performAt(r,inn,'rest').error);
 for(const spec of c.occupancyClaims){const claim=r.state.occupancyClaims[spec.id];assert(claim.takeoverFactId,JSON.stringify({claim,npcs:spec.residentIds.map(id=>({id,position:r.state.npcs[id].position,activity:r.state.npcs[id].activity,relocation:r.state.npcs[id].relocationAssignment})),actor:r.state.npcs[spec.actorId]}));for(const id of spec.residentIds)assert.equal(claim.residents[id].phase,'displaced');assert.equal(r.state.facilities[spec.facilityId].occupierId,spec.actorId);}
 assert(r.state.player.hp>0);assert.deepEqual(r.defects,[]);
});

test('canonical legal reading and submission preserve both residences through physically delivered orders',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));
 c.time.startSeconds=6*86400+7*3600;const r=new WorldReplay(c,{seed:4});
 const exit=r.view().region.portals.find(p=>p.to==='capital');assert(exit);assert(!performAt(r,exit).error);assert(!r.command({type:'travel',portalId:exit.id,mode:'foot'}).error);
 const institution=c.causalScenarios.find(s=>s.type==='institution'),protection=c.processes.find(s=>s.id==='civic-protection');
 for(const doc of institution.documents)at(r,doc.targetId,'causal',{action:`read:crown:${doc.id}`});
 for(const doc of protection.documents)at(r,doc.targetId,'interact',{action:'inspect'});
 at(r,institution.officeId,'causal',{action:'submit:crown'});at(r,protection.targetId,'process',{action:'civic-protection/inspect'});at(r,protection.targetId,'process',{action:'civic-protection/submit'});
 const saved=r.fork();for(const run of [r,saved]){at(run,'LOC_CAP_LOWER_INN','rest');const meal=run.options().find(o=>o.command.type==='eat'&&!o.command.targetId);assert(meal);assert(!run.select(meal,'王都で夕食を取る').error);at(run,'LOC_CAP_LOWER_INN','rest');at(run,'LOC_CAP_LOWER_INN','rest');for(const spec of c.occupancyClaims){const claim=run.state.occupancyClaims[spec.id];assert.equal(claim.phase,'withdrawn',JSON.stringify({claim,causal:run.state.events.crown.causal,order:run.state.processes['civic-protection'].order,clerk:run.state.npcs.NPC067}));assert(Object.values(claim.residents).every(e=>e.phase==='restored'),JSON.stringify({time:run.state.time,claim,clerk:{position:run.state.npcs.NPC067.position,activity:run.state.npcs.NPC067.activity,assignment:run.state.npcs.NPC067.institutionalAssignment},residents:spec.residentIds.map(id=>({id,position:run.state.npcs[id].position,activity:run.state.npcs[id].activity})),order:run.state.events.crown.causal.order,civic:run.state.processes['civic-protection'].order}));}assert.equal(run.state.events.crown.causal.tenure,'protected');assert(run.state.processes['civic-protection'].safeAt);assert(run.state.player.hp>0);}
 assert.equal(digest(r.state),digest(saved.state));assert.equal(digest(replay(c,r.export()).state),digest(r.state));assert.deepEqual(r.defects,[]);
});
