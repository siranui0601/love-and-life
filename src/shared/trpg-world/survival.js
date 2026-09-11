import {searchPlan,advancePlan} from './npc-planner.js';
import {setActivity} from './activity.js';
import {distance,findPath,followPath,hasLineOfSight} from './navigation.js';
import {rememberAction,evaluateCooperation} from './relationships.js';
export const NEEDS=Object.freeze({limit:100,hungerPerDay:45,fatiguePerDay:48,sleepRecoveryPerHour:12,mealRelief:40,treatmentSeconds:7200});
export function collapse(state,content,cause) {
  if(state.player.collapse?.status==='active')return;
  const p=state.player,region=content.regions.find(r=>r.id===p.region);
  const nearby=Object.values(state.npcs).filter(n=>n.hp>0&&!n.travel&&n.region===p.region&&distance(n.position,p.position)<25&&hasLineOfSight(region,n.position,p.position));
  p.collapse={status:'active',cause,at:state.time,location:{region:p.region,position:[...p.position]},
    nearbyEntities:nearby.map(n=>n.id),witnesses:nearby.map(n=>n.id),weather:structuredClone(state.weather[p.region]),
    danger:Object.values(state.monsters).filter(m=>m.hp>0&&m.region===p.region&&distance(m.position,p.position)<15).map(m=>m.id),
    possessions:structuredClone(p.inventory),eventContext:Object.values(state.events).filter(e=>['active','critical'].includes(e.status)&&content.events.some(t=>t.id===e.id&&t.region===p.region)).map(e=>e.id),
    injury:{kind:cause==='hp'?'trauma':'exhaustion',treated:false},rescue:null};
  setActivity(state,'collapsed');rememberAction(state,content,'collapse',{payload:{cause}});
}
export function advanceNeeds(state,content,seconds) {
  const p=state.player;p.hunger??=20;p.fatigue??=0;
  if(p.collapse?.status!=='active') {
    p.hunger=Math.min(NEEDS.limit,p.hunger+seconds/86400*NEEDS.hungerPerDay);
    p.fatigue=Math.max(0,Math.min(NEEDS.limit,p.fatigue+seconds*(p.activity.kind==='sleeping'?-NEEDS.sleepRecoveryPerHour/3600:NEEDS.fatiguePerDay/86400)));
    if(p.hp<=0||p.hunger>=NEEDS.limit||p.fatigue>=NEEDS.limit)collapse(state,content,p.hp<=0?'hp':p.hunger>=NEEDS.limit?'hunger':'fatigue');
  }
}
function rescueAssessment(state,content,npc) {
 const template=content.npcs.find(t=>t.id===npc.id),role=template?.role||'',personality=template?.personality||'';
 const child=/幼児|子供|少年|少女|赤子/.test(role),capable=npc.hp>30&&npc.fatigue<85&&!child&&!npc.injury;
 const duty=/医|薬|衛|兵|農|宿|修道|神官/.test(role),compassion=/親切|慈悲|世話|温厚/.test(personality);
 const relation=evaluateCooperation(state,npc,{risk:.2,purpose:'rescue'});
 const motivation=(duty?3:0)+(compassion?2:0)+(child?2:0)+Math.max(0,relation.utility)-(npc.hunger>85?4:0)-(npc.goal==='flee'?10:0);
 return {capable,motivation,duty,compassion,child,relationshipEvidence:relation.evidence,currentActivity:npc.goal};
}
function assignRescue(state,npc,facility,reason) {
 const c=state.player.collapse;
 const operators=[
  {action:'approach-casualty',preconditions:{},effects:{atBody:true},cost:1,expectedDuration:60},
  {action:'lift',preconditions:{atBody:true,capable:true},effects:{carrying:true},cost:1,expectedDuration:0},
  {action:'transport',preconditions:{carrying:true},effects:{atFacility:true},cost:2,expectedDuration:300},
  {action:'treat',preconditions:{atFacility:true,carrying:true},effects:{treated:true},cost:2,expectedDuration:NEEDS.treatmentSeconds},
 ];
 const initial={atBody:false,capable:true,carrying:false,atFacility:false,treated:false};
 npc.plan={id:`plan:${state.nextId++}`,domain:'rescue',goal:'casualty-treated',desired:{treated:true},steps:searchPlan(initial,{treated:true},operators),cursor:0,status:'active',region:npc.region,createdAt:state.time};
 npc.rescueAssignment='player';npc.goal='rescue';npc.nextDecision=0;
 c.rescue={actorId:npc.id,facilityId:facility.id,phase:'approaching',discoveredAt:state.time,reasoning:reason,services:[],knownLocation:structuredClone(c.location),planId:npc.plan.id};
}
export function advanceRescue(state,content,seconds) {
 const p=state.player,c=p.collapse;if(c?.status!=='active')return;
 const region=content.regions.find(r=>r.id===p.region),budget=seconds/(content.time?.scale||60)*1.4;
 const eligible=n=>n.hp>0&&!n.travel&&!n.captive&&!n.causalAssignment&&n.region===p.region;
 const facility=region.objects?.find(o=>['inn','clinic'].includes(o.kind)&&!state.facilities?.[o.id]?.closed&&findPath(region,p.position,o.position).length);if(!facility)return;
 if(!c.rescue&&c.helpRequest){
  const request=c.helpRequest,witness=state.npcs[request.actorId],helper=state.npcs[request.helperId];
  if(!witness||!helper||!eligible(witness)||!eligible(helper)||!rescueAssessment(state,content,helper).capable){if(witness){delete witness.rescueAssignment;delete witness.plan;}c.helpRequest=null;return;}
  const status=advancePlan(state,content,witness,seconds,{facts:()=>({atHelper:distance(witness.position,helper.position)<3}),handlers:{
   move:step=>{witness.activity='助けを呼びに向かう';followPath(region,witness,helper.position,budget);return {complete:distance(witness.position,helper.position)<3};},
   report:()=>{if(!hasLineOfSight(region,witness.position,helper.position))return {failed:'helper-not-visible'};
    const reason=rescueAssessment(state,content,helper);if(reason.motivation<=0)return {failed:'helper-declined'};
    const fact=rememberAction(state,content,'rescue-request',{actorId:witness.id,targetId:helper.id,payload:{location:request.knownLocation}});
    helper.knowledge.push({id:fact.id,kind:'collapse-report',text:'倒れている旅人の場所を教わった。',region:p.region,observedAt:state.time,source:{type:'heard',actorId:witness.id}});
    assignRescue(state,helper,facility,{...reason,reportFactId:fact.id,reportedBy:witness.id});return {complete:true};}
  }});
  if(['completed','invalidated'].includes(status)){delete witness.rescueAssignment;delete witness.plan;c.helpRequest=null;}return;
 }
 if(!c.rescue){
  const witnesses=Object.values(state.npcs).filter(n=>eligible(n)&&!n.rescueAssignment&&n.goal!=='sleep'&&distance(n.position,p.position)<25&&hasLineOfSight(region,n.position,p.position)&&findPath(region,n.position,p.position).length);
  const adults=witnesses.map(n=>({n,reason:rescueAssessment(state,content,n)})).filter(x=>x.reason.capable&&x.reason.motivation>0&&!Object.values(state.monsters).some(m=>m.hp>0&&m.region===x.n.region&&distance(m.position,x.n.position)<10)).sort((a,b)=>b.reason.motivation-a.reason.motivation||a.n.id.localeCompare(b.n.id));
  if(adults.length)assignRescue(state,adults[0].n,facility,adults[0].reason);
  else for(const witness of witnesses){const reason=rescueAssessment(state,content,witness);if(reason.capable||reason.motivation<=0)continue;
   // A witness can ask a person they can actually see. No omniscient helper lookup.
   const helper=Object.values(state.npcs).find(n=>n.id!==witness.id&&eligible(n)&&!n.rescueAssignment&&distance(witness.position,n.position)<25&&hasLineOfSight(region,witness.position,n.position)&&findPath(region,witness.position,n.position).length&&rescueAssessment(state,content,n).capable&&rescueAssessment(state,content,n).motivation>0);
   if(!helper)continue;
   const operators=[{action:'move',preconditions:{},effects:{atHelper:true},cost:1},{action:'report',preconditions:{atHelper:true},effects:{reported:true},cost:1}];
   witness.plan={id:`plan:${state.nextId++}`,domain:'rescue-request',goal:'helper-informed',steps:searchPlan({atHelper:false,reported:false},{reported:true},operators),cursor:0,status:'active',region:witness.region,createdAt:state.time};witness.rescueAssignment='seek-helper';witness.goal='seek-help';
   c.helpRequest={actorId:witness.id,helperId:helper.id,knownLocation:structuredClone(c.location)};break;
  }
 }
 const rescue=c.rescue;if(!rescue)return;const npc=state.npcs[rescue.actorId],destination=region.objects.find(o=>o.id===rescue.facilityId);
 if(!npc||!eligible(npc)||!destination||!rescueAssessment(state,content,npc).capable){if(npc){delete npc.rescueAssignment;delete npc.plan;}c.rescue=null;return;}
 // Old in-progress rescue saves restart physical planning without charging twice.
 if(npc.plan?.domain!=='rescue'){const previous=structuredClone(rescue);assignRescue(state,npc,destination,rescue.reasoning);c.rescue={...c.rescue,...previous,planId:npc.plan.id};npc.plan.cursor=previous.phase==='treatment'?3:previous.phase==='carrying'?2:0;if(previous.phase==='treatment')npc.plan.steps[3].elapsed=Math.max(0,state.time-previous.treatmentStartedAt);return;}
 const status=advancePlan(state,content,npc,seconds,{facts:()=>({atBody:distance(npc.position,p.position)<2,capable:rescueAssessment(state,content,npc).capable,carrying:!!rescue.pickedUpAt,atFacility:distance(npc.position,destination.position)<2}),handlers:{
  'approach-casualty':()=>{npc.activity='倒れた人のもとへ向かう';followPath(region,npc,rescue.knownLocation.position,budget);return {complete:distance(npc.position,p.position)<2};},
  lift:()=>{if(c.injury.kind==='trauma'&&npc.possessions?.medicine>0){npc.possessions.medicine--;rescue.services.push({kind:'medicine',itemId:'medicine',quantity:1,providerId:npc.id,cost:content.items.find(i=>i.id==='medicine')?.price||0});}
   rescue.phase='carrying';rescue.pickedUpAt=state.time;return {complete:true};},
  transport:()=>{npc.activity='負傷者を運ぶ';followPath(region,npc,destination.position,budget);p.position=[...npc.position];if(distance(npc.position,destination.position)>=2)return {complete:false};
   rescue.phase='treatment';rescue.treatmentStartedAt=state.time;rescue.services.push({kind:'bed',providerId:destination.id,quantity:1,cost:destination.services?.bed?.price??(destination.kind==='inn'?8:0)});setActivity(state,'recovering',{expectedEndAt:state.time+NEEDS.treatmentSeconds});return {complete:true};},
  treat:step=>{if(step.elapsed<step.expectedDuration)return {complete:false};c.status='recovered';c.recoveredAt=state.time;c.injury.treated=true;
   p.hp=Math.max(30,p.hp);p.hunger=Math.min(p.hunger,40);p.fatigue=Math.min(p.fatigue,35);let paid=0;p.medicalDebts||=[];
   for(const service of rescue.services){const payment=Math.min(p.gold,service.cost);p.gold-=payment;paid+=payment;service.paid=payment;if(service.cost>payment)p.medicalDebts.push({creditor:service.providerId,facilityId:destination.id,service:service.kind,amount:service.cost-payment,at:state.time});}
   rememberAction(state,content,'rescue',{actorId:npc.id,targetId:'player',payload:{collapseAt:c.at,facilityId:destination.id,paid}});setActivity(state,'idle');return {complete:true};}
 }});
 if(status==='completed'){delete npc.rescueAssignment;delete npc.plan;}
 if(status==='invalidated'){delete npc.rescueAssignment;delete npc.plan;c.rescue=null;}
}
