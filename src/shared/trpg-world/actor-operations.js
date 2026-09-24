import {worldSite,advanceActorJourney} from './actor-journey.js';
import {distance,hasLineOfSight,followPath} from './navigation.js';
import {searchPlan,advanceActionPlan} from './npc-planner.js';
import {rememberAction} from './relationships.js';
import {activeCustody,restrainPerson,releasePerson} from './person-custody.js';

const reserved=n=>n.rescueAssignment||n.aftermathAssignment||n.institutionalAssignment||n.transportAssignment||n.custodyAssignment||n.captive||n.causalAssignment||n.entrapment||n.companionOf||n.detention?.status==='held';
const canSee=(content,a,b,range)=>a&&b&&!a.travel&&!b.travel&&a.region===b.region&&distance(a.position,b.position)<range&&hasLineOfSight(content.regions.find(r=>r.id===a.region),a.position,b.position);
export function initializeActorOperations(state,content){
 state.actorOperations||={};state.duties||={};
 for(const spec of content.actorOperations||[])if(!state.actorOperations[spec.id]){
  const dormant=state.contentRevision!==content.revision;
  state.actorOperations[spec.id]={phase:'pending',initializedAt:state.time,...(dormant?{legacyDormant:true}:{})};
  const actor=state.npcs[spec.actorId];
  if(actor&&!dormant)actor.knowledge.push({id:`intention:${spec.id}`,kind:'intention',text:spec.intention,disclosure:{visibility:'private'},source:{type:'personal-intention',actorId:actor.id},observedAt:state.time});
 }
}
export function operationsStopped(state,ids){return (ids||[]).every(id=>state.actorOperations?.[id]?.legacyDormant||['restrained','withdrawn','incapacitated'].includes(state.actorOperations?.[id]?.phase));}

// Local defense does not read a hidden conspiracy. Only an observed armed
// approach/windup toward the assigned person authorizes this intervention.
function intercept(state,content,attacker,victim,operation,seconds){
 for(const duty of Object.values(state.duties)){
  const guard=state.npcs[duty.actorId];
  if(duty.kind!=='guard'||duty.protectActorId!==victim.id||!['stationed','responding'].includes(duty.phase)||!guard||guard.hp<35||guard.fatigue>85||guard.hunger>90||activeCustody(state,guard))continue;
  if(!canSee(content,guard,attacker,18)||!canSee(content,guard,victim,18))continue;
  guard.activity='目の前の襲撃を止めようとしている';
  duty.phase='responding';duty.threatId=attacker.id;
  followPath(content.regions.find(r=>r.id===guard.region),guard,attacker.position,seconds/(content.time?.scale||60)*1.8);
  if(!canSee(content,guard,attacker,3))return false;
  const fact=rememberAction(state,content,'assault-restrained',{actorId:guard.id,targetId:attacker.id,payload:{protectedActorId:victim.id,attemptFactId:operation.attemptFactId,orderId:duty.orderId}});
  if(activeCustody(state,victim)?.holderId===attacker.id&&canSee(content,guard,victim,5))releasePerson(state,content,victim,guard,fact.id);
  restrainPerson(state,content,guard,attacker,{sourceFactId:fact.id,authorityId:duty.authorityId,siteId:duty.custodySiteId,routeIds:duty.routeIds,modes:duty.modes});
  attacker.activity='襲撃を止められ、身柄を押さえられている';operation.phase='restrained';operation.stoppedAt=state.time;operation.stopFactId=fact.id;delete attacker.operationAssignment;delete attacker.plan;
  duty.responseFactId=fact.id;return true;
 }
 return false;
}
export function advanceActorOperations(state,content,seconds){
 initializeActorOperations(state,content);if(seconds<=0)return;
 for(const spec of content.actorOperations||[]){
  const op=state.actorOperations[spec.id],actor=state.npcs[spec.actorId];
  if(op.legacyDormant||['restrained','withdrawn','completed','incapacitated'].includes(op.phase)||state.time<spec.departAt||!actor)continue;
  if(actor.hp<=0){op.phase='incapacitated';op.stoppedAt=state.time;delete actor.operationAssignment;continue;}
  if(['conveying','holding'].includes(op.phase)){
   const person=state.npcs[spec.targetActorId],custody=activeCustody(state,person);
   if(!custody){op.phase='withdrawn';op.stoppedAt=state.time;delete actor.operationAssignment;continue;}
   if(canSee(content,actor,person,18))intercept(state,content,actor,person,op,seconds);
   if(op.phase!=='restrained')op.phase=custody.phase==='held'?'holding':'conveying';
   continue;
  }
  if(reserved(actor))continue;
  if(!actor.knowledge.some(k=>k.id===`intention:${spec.id}`))continue;
  const requiredItem=spec.restraintItemId||spec.weaponItemId;
  if(requiredItem&&!(actor.possessions[requiredItem]>0)){
   const fact=rememberAction(state,content,'equipment-missing',{actorId:actor.id,payload:{itemId:requiredItem}});
   op.phase='withdrawn';op.stopFactId=fact.id;op.stoppedAt=state.time;delete actor.operationAssignment;continue;
  }
  actor.operationAssignment=spec.id;actor.goal='execute-intention';
  const site=worldSite(content,spec.targetSiteId);if(!site)continue;
  if(op.phase==='pending')op.phase='approaching';
  if(op.phase==='approaching'){
   actor.activity='訪れる予定の場所へ向かう';const moved=advanceActorJourney(state,content,actor,site.id,seconds,spec);
   if(moved.complete){op.phase='searching';op.searchStartedAt=state.time;}
   if(moved.failed)op.blockedReason=moved.failed;
   continue;
  }
  const victim=state.npcs[spec.targetActorId];
  if(!victim||!canSee(content,actor,victim,18)){
   delete op.hitAt;actor.activity='現地で会う相手を探している';
   if(state.time-(op.searchStartedAt||state.time)>(spec.searchSeconds||4*3600)){
    op.phase='withdrawn';op.stoppedAt=state.time;const fact=rememberAction(state,content,'visit-abandoned',{actorId:actor.id,targetId:site.id,payload:{reason:'person-not-observed'}});op.stopFactId=fact.id;delete actor.operationAssignment;actor.nextDecision=0;
   }
   continue;
  }
  if(victim.hp<=0){op.phase='completed';delete actor.operationAssignment;continue;}
  actor.activity=spec.kind==='seize-person'?'縄を手に、相手の行く手をふさぐ':'武器を手にして相手へ詰め寄る';
  if(!op.attemptFactId){const fact=rememberAction(state,content,spec.kind==='seize-person'?'seizure-attempt':'assault-attempt',{actorId:actor.id,targetId:victim.id});op.attemptFactId=fact.id;}
  if(intercept(state,content,actor,victim,op,seconds))continue;
  if(!canSee(content,actor,victim,2.5)){
   delete op.hitAt;followPath(content.regions.find(r=>r.id===actor.region),actor,victim.position,seconds/(content.time?.scale||60)*1.65);continue;
  }
  if(op.hitAt===undefined){op.hitAt=state.time+(spec.windupSeconds||60);continue;}
  if(state.time<op.hitAt)continue;
  if(spec.kind==='seize-person'){
   const custody=restrainPerson(state,content,actor,victim,{kind:'coercion',sourceFactId:op.attemptFactId,siteId:spec.holdingSiteId,routeIds:spec.routeIds,modes:spec.modes});
   if(custody){actor.possessions[spec.restraintItemId]--;op.phase='conveying';op.custodyId=custody.id;op.resultFactId=custody.restraintFactId;delete actor.operationAssignment;}
   continue;
  }
  // Damage follows a persisted temporal attempt and a fresh physical check.
  victim.hp=Math.max(0,victim.hp-spec.damage);victim.injury={kind:'trauma',treated:false,causedBy:actor.id,at:state.time};
  const fact=rememberAction(state,content,'assault',{actorId:actor.id,targetId:victim.id,payload:{attemptFactId:op.attemptFactId,damage:spec.damage}});
  op.phase='completed';op.resultFactId=fact.id;op.completedAt=state.time;delete actor.operationAssignment;actor.nextDecision=0;
 }
}
export function advanceDuties(state,content,seconds){
 if(seconds<=0)return;
 for(const duty of Object.values(state.duties||{})){
  const actor=state.npcs[duty.actorId],site=worldSite(content,duty.postId);if(!actor||!site||actor.hp<=0||reserved(actor))continue;
  if(duty.phase==='completed')continue;
  if(duty.stoppedOperations?.length&&operationsStopped(state,duty.stoppedOperations)){
   duty.phase='completed';duty.completedAt=state.time;if(actor.dutyAssignment===duty.orderId)delete actor.dutyAssignment;actor.nextDecision=0;continue;
  }
  // Personal needs still matter. An exhausted posted actor cannot become an
  // immortal sentry; ordinary daily planning handles food and sleep off duty.
  if(actor.fatigue>85||actor.hunger>90){duty.phase='off-duty';delete actor.dutyAssignment;actor.nextDecision=0;continue;}
  if(duty.phase==='off-duty'&&(actor.fatigue>40||actor.hunger>65))continue;
  if(duty.phase==='responding'&&state.npcs[duty.threatId]?.hp>0&&state.npcs[duty.threatId]?.detention?.status!=='held')continue;
  actor.dutyAssignment=duty.orderId;actor.activity='受け取った命令に従い、現場の警備に就く';
  const reached=advanceActorJourney(state,content,actor,duty.postId,seconds,duty);
  if(reached.complete){if(duty.phase!=='stationed'){const fact=rememberAction(state,content,'guard-post-taken',{actorId:actor.id,targetId:duty.postId,payload:{orderId:duty.orderId}});duty.arrivalFactId=fact.id;duty.arrivedAt=state.time;}duty.phase='stationed';}
  else duty.phase='deploying';
 }
}
// An issuer carries their order to a known meeting site. Recipient whereabouts
// are never looked up across the map. Delivery and deployment are distinct.
export function advanceFieldOrder(state,content,spec,process,seconds){
 const order=process.order,definition=spec.enforcement;if(!order?.executionRequired||!definition||seconds<=0)return;
 const duty=state.duties?.[order.factId];
 if(duty){order.execution={...order.execution,status:['stationed','completed'].includes(duty.phase)?'completed':'awaiting-deployment',deploymentFactId:duty.arrivalFactId};state.institutionalOrders[order.factId].execution=structuredClone(order.execution);return;}
 const issuer=state.npcs[order.authority],recipient=state.npcs[definition.actorId],meeting=worldSite(content,definition.meetingId);
 if(!issuer||issuer.hp<=0||!recipient||recipient.hp<=0||!meeting||issuer.rescueAssignment||issuer.aftermathAssignment||issuer.transportAssignment||issuer.entrapment||issuer.companionOf)return;
 if(issuer.institutionalAssignment&&issuer.institutionalAssignment!==order.factId)return;
 if(!issuer.institutionalAssignment){
  issuer.institutionalAssignment=order.factId;order.execution={status:'delivering',actorId:issuer.id,recipientId:recipient.id,startedAt:state.time};
  const steps=searchPlan({atMeeting:false,delivered:false},{delivered:true},[
   {action:'reach-recipient-site',preconditions:{},effects:{atMeeting:true},cost:1},
   {action:'hand-over-order',preconditions:{atMeeting:true},effects:{delivered:true},cost:1}]);
  issuer.plan={id:`plan:${state.nextId++}`,goal:'deliver-field-order',status:'active',steps,cursor:0,orderId:order.factId,createdAt:state.time};
 }
 if(issuer.plan?.orderId!==order.factId){delete issuer.institutionalAssignment;return;}
 issuer.activity='命令書を届けるため、待ち合わせ場所へ向かう';
 const status=advanceActionPlan(state,issuer,seconds,{facts:()=>({atMeeting:issuer.region===meeting.region&&!issuer.travel&&distance(issuer.position,meeting.position)<3}),handlers:{
  'reach-recipient-site':(_,dt)=>advanceActorJourney(state,content,issuer,meeting.id,dt,definition),
  'hand-over-order':()=>{
   if(reserved(recipient)||recipient.dutyAssignment||!canSee(content,issuer,recipient,6))return {};
   const fact=rememberAction(state,content,'field-order-delivered',{actorId:issuer.id,targetId:recipient.id,payload:{orderId:order.factId,postId:definition.postId}});
   recipient.knowledge.push({id:`order-copy:${order.factId}`,kind:'document',text:definition.text,source:{type:'received-document',actorId:issuer.id,documentId:order.factId,factId:fact.id},observedAt:state.time,disclosure:{visibility:'private'}});
   state.duties[order.factId]={...structuredClone(definition),kind:'guard',orderId:order.factId,authorityId:issuer.id,phase:'deploying',deliveryFactId:fact.id,deliveredAt:state.time};
   delete recipient.plan;recipient.path=[];delete recipient.pathTarget;
   order.execution={...order.execution,status:'awaiting-deployment',deliveryFactId:fact.id};return {complete:true};}
 }});
 if(['completed','invalidated'].includes(status)){delete issuer.institutionalAssignment;delete issuer.plan;issuer.nextDecision=0;}
}
