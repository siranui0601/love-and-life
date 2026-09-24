import {worldSite,advanceActorJourney} from './actor-journey.js';
import {distance,hasLineOfSight} from './navigation.js';
import {rememberAction} from './relationships.js';
import {depositDocuments,observeWorkplace} from './world-semantics.js';

const near=(content,a,b,range=6)=>a&&b&&a.hp!==0&&!a.travel&&!b.travel&&a.region===b.region&&distance(a.position,b.position)<range&&hasLineOfSight(content.regions.find(r=>r.id===a.region),a.position,b.position);
const unavailable=n=>n.captive||n.detention?.status==='held'||n.entrapment||n.injury&&!n.injury.treated||n.rescueAssignment||n.aftermathAssignment||n.custodyAssignment||n.companionOf;
export function initializeOccupancy(state,content){
 state.occupancyClaims||={};
 for(const spec of content.occupancyClaims||[])if(!state.occupancyClaims[spec.id]){
  const dormant=state.contentRevision!==content.revision;
  state.occupancyClaims[spec.id]={phase:'pending',residents:{},initializedAt:state.time,...(dormant?{legacyDormant:true}:{})};
  if(!dormant&&state.npcs[spec.actorId])depositDocuments(state,{holderId:spec.actorId,documents:[spec.documentId],sourceFactId:null});
 }
}
export function occupancyRestored(state,id){
 const claim=state.occupancyClaims?.[id];
 return claim?.legacyDormant||claim&&['withdrawn','incapacitated'].includes(claim.phase)&&Object.values(claim.residents).every(r=>r.phase==='restored');
}
function learn(state,npc,id,text,source){
 if(!npc.knowledge.some(k=>k.id===id))npc.knowledge.push({id,kind:'testimony',text,observedAt:state.time,source});
}
function freeActor(actor,id){if(actor.operationAssignment===id){delete actor.operationAssignment;delete actor.plan;actor.nextDecision=0;}}
function address(resident){if(resident.goal==='sleep'){resident.goal='listen';delete resident.plan;resident.nextDecision=0;}}
// A claim is a person's attempt to take over a place. It is not a legal title.
// Notice, departure, arrival and return each require actual local execution.
export function advanceOccupancy(state,content,seconds){
 initializeOccupancy(state,content);if(seconds<=0)return;
 for(const spec of content.occupancyClaims||[]){
  const claim=state.occupancyClaims[spec.id],actor=state.npcs[spec.actorId],site=worldSite(content,spec.facilityId),shelter=worldSite(content,spec.shelterId);
  if(claim.legacyDormant||!actor||!site||!shelter)continue;
  for(const [id,entry] of Object.entries(claim.residents)){
   const resident=state.npcs[id];if(!resident||resident.hp<=0||unavailable(resident)||!['leaving','returning'].includes(entry.phase))continue;
   resident.relocationAssignment=spec.id;resident.activity=entry.phase==='returning'?'住んでいた場所へ戻る':'持ち物を抱え、宿泊先へ向かう';
   const destination=entry.phase==='returning'?site:shelter;
   const moved=advanceActorJourney(state,content,resident,destination.id,seconds,spec);
   if(moved.complete){
    const returning=entry.phase==='returning',fact=rememberAction(state,content,returning?'resident-returned':'resident-displaced',{actorId:resident.id,targetId:destination.id,payload:{noticeFactId:entry.noticeFactId,orderId:entry.orderId}});
    entry.phase=returning?'restored':'displaced';entry.arrivalFactId=fact.id;entry.arrivedAt=state.time;
    if(returning){if(resident.displacementCause===spec.id){delete resident.displacedHome;delete resident.displacementCause;delete resident.displacementKind;}}
    else {resident.displacedHome=[...destination.position];resident.displacementCause=spec.id;resident.displacementKind='eviction';}
    delete resident.relocationAssignment;delete resident.plan;resident.nextDecision=0;
   }
  }
  if(['withdrawn','incapacitated'].includes(claim.phase)||state.time<spec.departAt)continue;
  if(actor.hp<=0||actor.detention?.status==='held'){claim.phase='incapacitated';freeActor(actor,spec.id);continue;}
  if(unavailable(actor)||actor.institutionalAssignment||actor.operationAssignment&&actor.operationAssignment!==spec.id)continue;
  if(actor.hunger>90||actor.fatigue>85){freeActor(actor,spec.id);continue;}
  if(!state.documentCustody?.[actor.id]?.some(d=>d.documentId===spec.documentId)){claim.blockedReason='notice-document-missing';continue;}
  actor.operationAssignment=spec.id;actor.activity='書類を携えて建物へ向かう';
  if(!advanceActorJourney(state,content,actor,site.id,seconds,spec).complete)continue;
  const facility=state.facilities[site.id],orderId=facility?.orderId;
  if(orderId&&facility.closed===false&&state.institutionalOrders?.[orderId]?.execution?.evidence){
   // A posted and physically enacted order is read here, not at the office.
   const fact=rememberAction(state,content,'claim-withdrawn',{actorId:actor.id,targetId:site.id,payload:{orderId}});
   learn(state,actor,`posted-order:${orderId}`,'現地で、退去指示を認めない命令書を読んだ。',{type:'read',targetId:site.id,documentId:orderId,factId:fact.id});
   claim.phase='withdrawn';claim.stopFactId=fact.id;if(facility.occupierId===actor.id)delete facility.occupierId;freeActor(actor,spec.id);continue;
  }
  claim.phase='notifying';actor.activity='入口で住民に書類を示している';
  for(const id of spec.residentIds){
   const resident=state.npcs[id];if(!near(content,actor,resident)||!near(content,resident,site,10)||resident.hp<=0||unavailable(resident))continue;
   let entry=claim.residents[id];
   if(!entry){
    address(resident);
    const fact=rememberAction(state,content,'vacate-notice',{actorId:actor.id,targetId:id,payload:{siteId:site.id,documentId:spec.documentId,shelterId:shelter.id}});
    learn(state,resident,`notice:${fact.id}`,`${site.name}から退去するよう言われ、${shelter.name}を行き先として告げられた。`,{type:'told',actorId:actor.id,factId:fact.id});
    entry=claim.residents[id]={phase:'notified',noticeFactId:fact.id,notifiedAt:state.time};
   }
   if(entry.phase==='notified'&&state.time>=entry.notifiedAt+spec.noticeSeconds){entry.phase='leaving';resident.relocationAssignment=spec.id;delete resident.plan;}
  }
  if(spec.residentIds.every(id=>claim.residents[id]?.phase==='displaced')&&!claim.takeoverFactId){
   const fact=rememberAction(state,content,'facility-occupied',{actorId:actor.id,targetId:site.id,payload:{noticeDocumentId:spec.documentId,residents:spec.residentIds}});
   claim.takeoverFactId=fact.id;claim.phase='occupied';
   // Control/closure changes; legal ownership does not.
   state.facilities[site.id]={...state.facilities[site.id],closed:true,occupierId:actor.id,occupationFactId:fact.id};
   observeWorkplace(state,actor,site,true);freeActor(actor,spec.id);
  }
 }
}

// After reopening a place, the official visits the known temporary shelter.
// Residents absent from both sites do not receive telepathic permission.
export function advanceOccupancyRestitution(state,content,spec,order,seconds){
 if(!spec.restoresClaims?.length||!order.execution?.evidence||seconds<=0)return;
 const official=state.npcs[order.authority];if(!official||official.hp<=0||unavailable(official))return;
 if(official.institutionalAssignment&&official.institutionalAssignment!==order.factId)return;
 const pending=spec.restoresClaims.filter(id=>!occupancyRestored(state,id));
 if(!pending.length){order.execution.status='completed';state.institutionalOrders[order.factId].execution=structuredClone(order.execution);freeOfficial();return;}
 order.execution.status='awaiting-residents';
 for(const id of pending){
  const binding=content.occupancyClaims.find(c=>c.id===id),claim=state.occupancyClaims[id];if(!binding||claim?.legacyDormant)continue;
  const site=worldSite(content,binding.facilityId),shelter=worldSite(content,binding.shelterId);
  const entries=Object.entries(claim.residents).filter(([,e])=>!['returning','restored'].includes(e.phase));
  if(!entries.length)continue;
  official.institutionalAssignment=order.factId;official.activity='書類を持ち、住民の滞在先を訪ねる';
  const destination=entries.some(([,e])=>e.phase==='notified')?site:shelter;
  if(!advanceActorJourney(state,content,official,destination.id,seconds,binding).complete)break;
  for(const [residentId,entry] of entries){const resident=state.npcs[residentId];if(!near(content,official,resident)||!near(content,resident,destination,8)||unavailable(resident))continue;
   address(resident);
   const fact=rememberAction(state,content,'return-permission-received',{actorId:official.id,targetId:resident.id,payload:{orderId:order.factId,siteId:site.id}});
   learn(state,resident,`return:${fact.id}`,`${site.name}へ戻れると担当者から告げられた。`,{type:'told',actorId:official.id,documentId:order.factId,factId:fact.id});
   entry.phase='returning';entry.orderId=order.factId;resident.relocationAssignment=id;delete resident.plan;
  }
  break;
 }
 if(!pending.some(id=>Object.values(state.occupancyClaims[id]?.residents||{}).some(e=>!['returning','restored'].includes(e.phase))))freeOfficial();
 function freeOfficial(){if(official.institutionalAssignment===order.factId){delete official.institutionalAssignment;delete official.plan;official.nextDecision=0;}}
 state.institutionalOrders[order.factId].execution=structuredClone(order.execution);
}
