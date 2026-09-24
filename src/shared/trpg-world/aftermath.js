import {distance,hasLineOfSight,followPath} from './navigation.js';
import {observeMemory,recalled} from './memory.js';
import {orderedValues} from './semantic.js';
import {searchPlan,advanceActionPlan} from './npc-planner.js';
import {rememberAction} from './relationships.js';
import {observeWorkplace} from './world-semantics.js';

const siteOf=(content,spec)=>content.regions.find(r=>r.id===spec.region)?.objects.find(o=>o.id===spec.targetId);
const aftermathOf=(state,spec)=>spec.careCaseId?state.careCases[spec.careCaseId]:state.structures[spec.id];
const careMatches=(npc,spec)=>spec.careCaseId?npc.care?.caseId===spec.careCaseId:npc.care?.structureId===spec.id;
const sourceFact=s=>s.sourceFactId||s.damageFactId;
export function registerInjuryCase(state,content,npc,{sourceFactId,siteId,shelterId,text,kind='trauma',damage=20}){
 const region=content.regions.find(r=>r.id===npc.region),site=region?.objects.find(o=>o.id===siteId),shelter=region?.objects.find(o=>o.id===shelterId);
 if(!site||!shelter||npc.hp<=0||npc.travel)return null;
 state.careCases||={};const id=`care:${sourceFactId}`;
 const incident=state.careCases[id]||={id,region:npc.region,targetId:siteId,shelterId,sourceFactId,damageAt:state.time,incidentText:text,casualties:[],recoveries:[],blocked:false,fire:0};
 if(incident.casualties.includes(npc.id))return incident;
 npc.hp=Math.max(1,npc.hp-damage);npc.injury={kind,treated:false,at:state.time,sourceFactId};npc.care={caseId:id,destination:shelterId,status:'injured'};
 delete npc.plan;npc.goal='await-help';npc.activity='負傷し、安全な場所への助けを待っている';incident.casualties.push(npc.id);
 const observation=rememberAction(state,content,'injured-person',{actorId:npc.id,targetId:siteId,payload:{kind}});incident.observationFactId=observation.id;return incident;
}
function recoverAtShelter(state,content,s,npc,shelter,helperId) {
 if(npc.care.status==='recovered')return;
 const fact=rememberAction(state,content,'rescue',{actorId:helperId,targetId:npc.id,payload:{shelterId:shelter.id,sourceFactId:sourceFact(s)}});
 if(helperId==='player'){const account=state.knowledge.find(k=>k.id===`escort:${npc.id}`);if(account){account.completedAt=state.time;account.completionFactId=fact.id;}}
 npc.care.status='recovered';npc.care.recoveryFactId=fact.id;npc.displacedHome=[...shelter.position];npc.displacementCause=sourceFact(s);npc.hp=Math.max(npc.hp,50);delete npc.companionOf;delete npc.plan;
 s.recoveries.push({personId:npc.id,factId:fact.id,at:state.time});
}
export function damageStructure(state,content,spec) {
 const s=state.structures[spec.id],site=siteOf(content,spec);if(s.damageAt!==undefined||!spec.failure||!site)return;
 Object.assign(s,spec.failure.effects);s.damageAt=state.time;s.casualties=[];s.recoveries=[];
 state.facilities||={};state.facilities[site.id]={...state.facilities[site.id],closed:!s.operating||s.integrity<=0};
 const fact={id:`physical:${state.nextId++}`,kind:'structural-damage',actorId:null,targetId:site.id,region:spec.region,position:[...site.position],at:state.time,payload:{kind:spec.failure.kind},witnesses:[]};
 state.socialFacts.push(fact);s.damageFactId=fact.id;
 for(const n of orderedValues(state.npcs))if(n.hp>0&&!n.travel&&n.region===spec.region&&distance(n.position,site.position)<(spec.failure.exposureRange||8)&&hasLineOfSight(content.regions.find(r=>r.id===spec.region),n.position,site.position)) {
  n.injury={kind:spec.failure.kind==='fire'?'burn':'crush',treated:false,at:state.time,sourceFactId:fact.id};n.hp=Math.min(n.hp,35);
  n.care={structureId:spec.id,destination:spec.shelterId,status:'injured'};if(s.blocked&&spec.failure.traps!==false)n.entrapment={structureId:spec.id,at:state.time};
  delete n.plan;n.activity=n.entrapment?'物陰から助けを呼んでいる':'負傷し、安全な場所を探している';s.casualties.push(n.id);
 }
}
export function siteDescription(s,voices=false) {
 if(s.incidentText)return s.incidentText;
 return `${s.fire>0?'炎と煙が上がっている。':s.fuel?'床に灯油がこぼれている。':''}${s.blocked?'崩れた物が入口を塞いでいる。':''}${s.damageAt!==undefined?(s.recoveredAt!==undefined&&!s.blocked?'設備には補修の跡が残っている。':'壊れた設備と散らばった残骸がある。'):''}${voices?'奥から人の声がする。':''}`;
}
function observeSite(state,content,spec,npc) {
 const s=aftermathOf(state,spec),site=siteOf(content,spec),region=content.regions.find(r=>r.id===spec.region);
 if(!site||s.damageAt===undefined||npc.hp<=0||npc.travel||npc.goal==='sleep'||npc.region!==spec.region||distance(npc.position,site.position)>24||!hasLineOfSight(region,npc.position,site.position))return;
 const id=`site:${spec.id}:${sourceFact(s)}`,old=npc.knowledge.find(k=>k.id===id);
 if(old)return;
 const fact=state.socialFacts.find(f=>f.id===(s.observationFactId||sourceFact(s)));if(!fact)return;observeMemory(state,npc,fact,{range:distance(npc.position,site.position),template:content.npcs.find(n=>n.id===npc.id)});
 if(!spec.careCaseId)observeWorkplace(state,npc,site,!!state.facilities?.[site.id]?.closed);
 fact.witnesses.push(npc.id);
 const voices=(s.casualties||[]).some(id=>state.npcs[id]?.hp>0&&distance(state.npcs[id].position,site.position)<12);
 npc.knowledge.push({id,kind:'site-observation',topicLabel:`${site.name}で見た異変`,text:`${site.name}で、${siteDescription(s,voices)}`,destination:{region:spec.region,position:[...site.position],targetId:site.id},observedAt:state.time,source:{type:'seen',observerId:npc.id},belief:{factId:fact.id}});
 npc.nextDecision=0;
}
// An observed danger becomes a searched movement/arrival plan, not a global alarm.
function evacuate(state,content,npc,spec,seconds) {
 const s=aftermathOf(state,spec),site=siteOf(content,spec),region=content.regions.find(r=>r.id===spec.region),shelter=region.objects.find(o=>o.id===spec.shelterId);
 if(!shelter||npc.entrapment||npc.companionOf||npc.captive||npc.detention?.status==='held')return;
 const known=npc.knowledge.find(k=>k.kind==='site-observation'&&k.destination?.targetId===site.id&&(!k.belief?.factId||recalled(npc,k.belief.factId)));
 if(!known||npc.region!==spec.region||npc.travel)return;
 if(npc.aftermathAssignment&&npc.plan?.goal!=='evacuate')delete npc.aftermathAssignment;
 if(!npc.aftermathAssignment&&distance(npc.position,site.position)<24&&hasLineOfSight(region,npc.position,site.position)&&(s.fire>0||s.blocked)&&!npc.evacuationHistory?.includes(s.damageFactId)) {
  const steps=searchPlan({safe:false,arrived:false},{safe:true},[
   {action:'move-shelter',preconditions:{},effects:{arrived:true},cost:1,position:[...shelter.position]},
   {action:'take-shelter',preconditions:{arrived:true},effects:{safe:true},cost:1}]);
  npc.plan={id:`plan:${state.nextId++}`,goal:'evacuate',status:'active',steps,cursor:0,sourceKnowledgeId:known.id,createdAt:state.time};npc.aftermathAssignment=spec.id;
 }
 if(npc.aftermathAssignment!==spec.id)return;
 npc.activity='見聞きした危険から離れ、避難所へ向かう';
 const status=advanceActionPlan(state,npc,seconds,{facts:()=>({arrived:distance(npc.position,shelter.position)<3}),handlers:{
  'move-shelter':(_step,dt)=>{followPath(region,npc,shelter.position,dt/(content.time?.scale||60)*1.55);return {complete:distance(npc.position,shelter.position)<3};},
  'take-shelter':()=>{npc.evacuationHistory||=[];npc.evacuationHistory.push(s.damageFactId);npc.displacedHome=[...shelter.position];npc.displacementCause=s.damageFactId;return {complete:true};}
 }});
 if(['completed','invalidated'].includes(status)){delete npc.aftermathAssignment;delete npc.plan;}
}
function medicalSearch(state,content,helper,spec,seconds) {
 const s=aftermathOf(state,spec),region=content.regions.find(r=>r.id===spec.region),site=siteOf(content,spec),template=content.npcs.find(n=>n.id===helper.id);
 if(helper.plan?.goal!=='medical-search') {
  if(helper.captive||helper.detention?.status==='held'||helper.operationMember||helper.custodyAssignment||helper.aftermathAssignment||helper.region!==spec.region||helper.travel||helper.hp<40||helper.injury&&!helper.injury.treated||!(helper.possessions.medicine>0)||!/医師|救護|治療|衛生/.test(template?.role||''))return false;
  const known=helper.knowledge.find(k=>k.kind==='site-observation'&&k.destination.targetId===site.id&&recalled(helper,k.belief?.factId));
  if(!known||helper.medicalInspections?.[known.id])return false;
  const length=Math.max(1,distance(helper.position,site.position)),position=site.position.map((v,i)=>i===1?v:v+(helper.position[i]-v)/length*12);
  const steps=searchPlan({arrived:false,checked:false},{checked:true},[{action:'approach-site',position,preconditions:{},effects:{arrived:true},cost:1},{action:'inspect-site',preconditions:{arrived:true},effects:{checked:true},cost:1}]);
  helper.plan={id:`plan:${state.nextId++}`,goal:'medical-search',status:'active',steps,cursor:0,sourceKnowledgeId:known.id,createdAt:state.time};helper.aftermathAssignment=spec.id;
 }
 helper.activity='聞いた現場へ傷薬を持って向かう';
 const plan=helper.plan,status=advanceActionPlan(state,helper,seconds,{facts:()=>({arrived:distance(helper.position,site.position)<16&&hasLineOfSight(region,helper.position,site.position)}),handlers:{
  'approach-site':(step,dt)=>{followPath(region,helper,step.position,dt/(content.time?.scale||60)*1.55);return step.elapsed>4*3600?{failed:'site-unreachable'}:{complete:distance(helper.position,site.position)<16&&hasLineOfSight(region,helper.position,site.position)};},
  'inspect-site':()=>{helper.medicalInspections||={};helper.medicalInspections[plan.sourceKnowledgeId]=state.time;rememberAction(state,content,'site-inspection',{actorId:helper.id,targetId:site.id,payload:{sourceKnowledgeId:plan.sourceKnowledgeId}});return {complete:true};}
 }});
 // Keep the arrival owned by this plan until the next medical assessment;
 // daily work must not move the observer away between discovery and response.
 if(status==='invalidated'||status==='completed'&&plan.completedAt<state.time){delete helper.aftermathAssignment;delete helper.plan;}return true;
}
function medicalResponse(state,content,helper,spec,seconds) {
 const s=aftermathOf(state,spec),region=content.regions.find(r=>r.id===spec.region),shelter=region.objects.find(o=>o.id===spec.shelterId),template=content.npcs.find(n=>n.id===helper.id);
 if(!shelter||helper.captive||helper.detention?.status==='held'||helper.operationMember||helper.custodyAssignment||helper.region!==spec.region||helper.travel||helper.hp<40||helper.entrapment||helper.injury&&!helper.injury.treated)return false;
 if(helper.plan?.goal!=='aftermath-rescue') {
  if(helper.aftermathAssignment&&!(helper.plan?.goal==='medical-search'&&helper.plan.status==='completed')||s.blocked||s.fire>0||!(helper.possessions.medicine>0)||!/医師|救護|治療|衛生/.test(template?.role||''))return false;
  const known=helper.knowledge.find(k=>k.kind==='site-observation'&&k.destination.targetId===spec.targetId&&recalled(helper,k.belief?.factId));if(!known)return false;
  const patient=orderedValues(state.npcs).find(n=>careMatches(n,spec)&&n.care.status!=='recovered'&&!n.entrapment&&!n.captive&&n.detention?.status!=='held'&&!n.companionOf&&n.hp>0&&n.region===helper.region&&distance(n.position,helper.position)<18&&hasLineOfSight(region,n.position,helper.position));
  if(!patient)return false;
  const steps=searchPlan({near:false,treated:!!patient.injury?.treated,arrived:false,done:false,medicine:true},{done:true},[
   {action:'approach-patient',preconditions:{},effects:{near:true},cost:1},
   {action:'first-aid',preconditions:{near:true,medicine:true},effects:{treated:true},expectedDuration:300,cost:1},
   {action:'accompany',preconditions:{near:true,treated:true},effects:{arrived:true},cost:1},
   {action:'handoff',preconditions:{arrived:true},effects:{done:true},cost:1}]);
  helper.plan={id:`plan:${state.nextId++}`,goal:'aftermath-rescue',status:'active',steps,cursor:0,patientId:patient.id,sourceKnowledgeId:known.id,createdAt:state.time};helper.aftermathAssignment=spec.id;
 }
 const plan=helper.plan,patient=state.npcs[plan.patientId];
 if(!patient||patient.hp<=0||patient.entrapment||patient.region!==helper.region||patient.companionOf&&patient.companionOf!==helper.id){plan.status='invalidated';plan.failure='patient-unavailable';helper.lastPlan=structuredClone(plan);delete helper.plan;delete helper.aftermathAssignment;return false;}
 helper.activity='知っている負傷者を手当てし、安全な場所へ付き添う';
 const status=advanceActionPlan(state,helper,seconds,{facts:()=>({near:distance(helper.position,patient.position)<3,medicine:helper.possessions.medicine>0,treated:!!patient.injury?.treated,arrived:distance(helper.position,shelter.position)<4&&distance(patient.position,shelter.position)<4}),handlers:{
  'approach-patient':(_step,dt)=>{followPath(region,helper,patient.position,dt/(content.time?.scale||60)*1.55);return {complete:distance(helper.position,patient.position)<3};},
  'first-aid':step=>{if(step.elapsed<step.expectedDuration)return {};helper.possessions.medicine--;patient.injury.treated=true;rememberAction(state,content,'treatment',{actorId:helper.id,targetId:patient.id,payload:{itemId:'medicine'}});return {complete:true};},
  'accompany':(_step,dt)=>{patient.companionOf=helper.id;followPath(region,helper,shelter.position,dt/(content.time?.scale||60)*1.4);followPath(region,patient,helper.position,dt/(content.time?.scale||60)*2.4);return {complete:distance(helper.position,shelter.position)<4&&distance(patient.position,shelter.position)<4};},
  'handoff':()=>{recoverAtShelter(state,content,s,patient,shelter,helper.id);return {complete:true};}
 }});
 if(['completed','invalidated'].includes(status)){if(patient.companionOf===helper.id)delete patient.companionOf;delete helper.aftermathAssignment;delete helper.plan;}
 return true;
}
export function advanceAftermath(state,content,seconds) {
 const inhabitants=orderedValues(state.npcs);
 for(const spec of [...(content.structures||[]),...Object.values(state.careCases||{}).map(c=>({...c,careCaseId:c.id}))]) {
  const s=aftermathOf(state,spec);if(!s||s.damageAt===undefined)continue;
  for(const npc of inhabitants)if(npc.region===spec.region) {observeSite(state,content,spec,npc);if(seconds>0&&npc.hp>0&&!medicalResponse(state,content,npc,spec,seconds)&&!medicalSearch(state,content,npc,spec,seconds))evacuate(state,content,npc,spec,seconds);}
  for(const id of s.casualties||[]) {
   const npc=state.npcs[id];if(!npc||npc.hp<=0||npc.care?.status==='recovered')continue;
   if(npc.entrapment&&!s.blocked&&!(s.fire>0)){delete npc.entrapment;npc.activity='出口が開いた。手当てと付き添いを待っている';}
   if(npc.entrapment||npc.captive||npc.detention?.status==='held'||npc.travel||npc.companionOf!=='player'||npc.region!==state.player.region)continue;
   const region=content.regions.find(r=>r.id===npc.region),shelter=region.objects.find(o=>o.id===npc.care.destination);
   if(seconds>0){
    if(distance(npc.position,state.player.position)<18&&hasLineOfSight(region,npc.position,state.player.position))npc.escortObservation=[...state.player.position];
    if(npc.escortObservation)followPath(region,npc,npc.escortObservation,seconds/(content.time?.scale||60)*2.4);
   }
   if(shelter&&npc.injury?.treated&&distance(npc.position,shelter.position)<4&&distance(npc.position,state.player.position)<4&&hasLineOfSight(region,npc.position,shelter.position)&&hasLineOfSight(region,npc.position,state.player.position)) {
    recoverAtShelter(state,content,s,npc,shelter,'player');
   }
  }
  if(!s.blocked&&!(s.fire>0)&&(spec.careCaseId||s.integrity>=spec.safe.integrity)&&(s.casualties||[]).every(id=>state.npcs[id]?.care?.status==='recovered'))s.recoveredAt??=state.time;
 }
}
