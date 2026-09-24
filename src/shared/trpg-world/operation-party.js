import {advanceActorJourney,worldSite} from './actor-journey.js';
import {distance,followPath,hasLineOfSight} from './navigation.js';
import {rememberAction} from './relationships.js';
import {consumeResources} from './world-semantics.js';

export function releaseOperationParty(state,spec){
 for(const id of spec.memberIds||[]){const n=state.npcs[id];if(n?.operationMember===spec.id){delete n.operationMember;delete n.journeyFollowObservation;n.nextDecision=0;}}
}
export function followOperationParty(state,content,spec,actor,seconds){
 const region=content.regions.find(r=>r.id===actor.region);
 for(const id of spec.memberIds||[]){const n=state.npcs[id];if(!n||n.hp<=0||n.operationMember!==spec.id||n.region!==actor.region||n.travel||actor.travel)continue;
  if(distance(n.position,actor.position)<18&&hasLineOfSight(region,n.position,actor.position))n.journeyFollowObservation={leaderId:actor.id,region:actor.region,position:[...actor.position]};
  const seen=n.journeyFollowObservation;if(seen?.leaderId===actor.id&&seen.region===n.region)followPath(region,n,seen.position,seconds/(content.time?.scale||60)*1.8);
 }
}
export function assembleOperationParty(state,content,spec,op,actor,seconds){
 const reached=advanceActorJourney(state,content,actor,spec.assemblySiteId,seconds,spec);if(!reached.complete)return reached;
 const assembly=worldSite(content,spec.assemblySiteId),region=content.regions.find(r=>r.id===actor.region);
 op.memberReceipts||={};
 for(const id of spec.memberIds||[]){
  const member=state.npcs[id];
  if(!member||member.hp<=0||member.travel||member.region!==actor.region||distance(member.position,actor.position)>6||!hasLineOfSight(region,actor.position,member.position))continue;
  if(!op.memberReceipts[id]){
   if(member.operationMember||member.operationAssignment||member.dutyAssignment||member.captive||member.detention?.status==='held'||member.rescueAssignment||member.custodyAssignment||member.transportAssignment)continue;
   const fact=rememberAction(state,content,'deployment-order-received',{actorId:actor.id,targetId:id,payload:{assemblyId:assembly.id,destinationId:spec.targetSiteId}});
   member.knowledge.push({id:`field-instruction:${fact.id}`,kind:'instruction',text:spec.partyInstruction||'現地まで同行するよう指示を受けた。',source:{type:'told',actorId:actor.id,factId:fact.id},observedAt:state.time,disclosure:{visibility:'private'}});
   member.operationMember=spec.id;member.goal='follow-orders';delete member.plan;member.path=[];delete member.pathTarget;op.memberReceipts[id]=fact.id;
  }
 }
 followOperationParty(state,content,spec,actor,seconds);
 if(!(spec.memberIds||[]).every(id=>{const n=state.npcs[id];return n?.hp>0&&n.operationMember===spec.id&&!n.travel&&n.region===actor.region&&distance(n.position,actor.position)<4&&hasLineOfSight(region,actor.position,n.position);}))return {waiting:'actual-party-not-assembled'};
 if(!op.resourcesSpent){
  if(!consumeResources(actor.possessions,spec.requiredResources||{}))return {waiting:'equipment-or-rations-missing'};
  const fact=rememberAction(state,content,'party-provisioned',{actorId:actor.id,targetId:assembly.id,payload:{members:[...(spec.memberIds||[])],resources:spec.requiredResources||{}}});
  op.resourcesSpent={at:state.time,factId:fact.id,items:structuredClone(spec.requiredResources||{})};
  const food=spec.requiredResources?.supplies||0;for(const member of [actor,...(spec.memberIds||[]).map(id=>state.npcs[id])])member.hunger=Math.max(0,member.hunger-food*25/(1+(spec.memberIds?.length||0)));
 }
 return {complete:true};
}
