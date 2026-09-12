import {distance,hasLineOfSight,followPath} from './navigation.js';
import {observeMemory,recalled} from './memory.js';
import {orderedValues} from './semantic.js';
import {searchPlan,advanceActionPlan} from './npc-planner.js';
import {rememberAction} from './relationships.js';

const siteOf=(content,spec)=>content.regions.find(r=>r.id===spec.region)?.objects.find(o=>o.id===spec.targetId);
export function damageStructure(state,content,spec) {
 const s=state.structures[spec.id],site=siteOf(content,spec);if(s.damageAt!==undefined||!spec.failure||!site)return;
 Object.assign(s,spec.failure.effects);s.damageAt=state.time;s.casualties=[];s.recoveries=[];
 const fact={id:`physical:${state.nextId++}`,kind:'structural-damage',actorId:null,targetId:site.id,region:spec.region,position:[...site.position],at:state.time,payload:{kind:spec.failure.kind},witnesses:[]};
 state.socialFacts.push(fact);s.damageFactId=fact.id;
 for(const n of orderedValues(state.npcs))if(n.hp>0&&!n.travel&&n.region===spec.region&&distance(n.position,site.position)<(spec.failure.exposureRange||8)&&hasLineOfSight(content.regions.find(r=>r.id===spec.region),n.position,site.position)) {
  n.injury={kind:spec.failure.kind==='fire'?'burn':'crush',treated:false,at:state.time,sourceFactId:fact.id};n.hp=Math.min(n.hp,35);
  n.care={structureId:spec.id,destination:spec.shelterId,status:'injured'};if(s.blocked&&spec.failure.traps!==false)n.entrapment={structureId:spec.id,at:state.time};
  delete n.plan;n.activity=n.entrapment?'物陰から助けを呼んでいる':'負傷し、安全な場所を探している';s.casualties.push(n.id);
 }
}
export function siteDescription(s) {
 return `${s.fire>0?'炎と煙が上がっている。':''}${s.blocked?'崩れた物が入口を塞いでいる。':''}${s.damageAt!==undefined?'壊れた設備と散らばった残骸がある。':''}${s.casualties?.length&&!s.recoveredAt?'奥から人の声がする。':''}`;
}
function observeSite(state,content,spec,npc) {
 const s=state.structures[spec.id],site=siteOf(content,spec),region=content.regions.find(r=>r.id===spec.region);
 if(!site||s.damageAt===undefined||npc.hp<=0||npc.travel||npc.goal==='sleep'||npc.region!==spec.region||distance(npc.position,site.position)>24||!hasLineOfSight(region,npc.position,site.position))return;
 const id=`site:${spec.id}:${s.damageFactId}`,old=npc.knowledge.find(k=>k.id===id);
 if(old)return;
 const fact=state.socialFacts.find(f=>f.id===s.damageFactId);observeMemory(state,npc,fact,{range:distance(npc.position,site.position),template:content.npcs.find(n=>n.id===npc.id)});
 fact.witnesses.push(npc.id);
 npc.knowledge.push({id,kind:'site-observation',topicLabel:`${site.name}で見た異変`,text:`${site.name}で、${siteDescription(s)}`,destination:{region:spec.region,position:[...site.position],targetId:site.id},observedAt:state.time,source:{type:'seen',observerId:npc.id},belief:{factId:fact.id}});
 npc.nextDecision=0;
}
// An observed danger becomes a searched movement/arrival plan, not a global alarm.
function evacuate(state,content,npc,spec,seconds) {
 const s=state.structures[spec.id],site=siteOf(content,spec),region=content.regions.find(r=>r.id===spec.region),shelter=region.objects.find(o=>o.id===spec.shelterId);
 if(!shelter||npc.entrapment||npc.companionOf)return;
 const known=npc.knowledge.find(k=>k.kind==='site-observation'&&k.destination?.targetId===site.id&&(!k.belief?.factId||recalled(npc,k.belief.factId)));
 if(!known||npc.region!==spec.region||npc.travel)return;
 if(npc.aftermathAssignment&&npc.plan?.goal!=='evacuate')delete npc.aftermathAssignment;
 if(!npc.aftermathAssignment&&distance(npc.position,site.position)<24&&(s.fire>0||s.blocked)&&!npc.evacuationHistory?.includes(s.damageFactId)) {
  const steps=searchPlan({safe:false,arrived:false},{safe:true},[
   {action:'move-shelter',preconditions:{},effects:{arrived:true},cost:1,position:[...shelter.position]},
   {action:'take-shelter',preconditions:{arrived:true},effects:{safe:true},cost:1}]);
  npc.plan={id:`plan:${state.nextId++}`,goal:'evacuate',status:'active',steps,cursor:0,sourceKnowledgeId:known.id,createdAt:state.time};npc.aftermathAssignment=spec.id;
 }
 if(npc.aftermathAssignment!==spec.id)return;
 npc.activity='見聞きした危険から離れ、避難所へ向かう';
 const status=advanceActionPlan(state,npc,seconds,{facts:()=>({arrived:distance(npc.position,shelter.position)<3}),handlers:{
  'move-shelter':(_step,dt)=>{followPath(region,npc,shelter.position,dt/(content.time?.scale||60)*1.55);return {complete:distance(npc.position,shelter.position)<3};},
  'take-shelter':()=>{npc.evacuationHistory||=[];npc.evacuationHistory.push(s.damageFactId);npc.displacedHome=[...shelter.position];return {complete:true};}
 }});
 if(['completed','invalidated'].includes(status)){delete npc.aftermathAssignment;delete npc.plan;}
}
export function advanceAftermath(state,content,seconds) {
 for(const spec of content.structures||[]) {
  const s=state.structures[spec.id];if(!s||s.damageAt===undefined)continue;
  for(const npc of orderedValues(state.npcs)) {observeSite(state,content,spec,npc);if(seconds>0&&npc.hp>0)evacuate(state,content,npc,spec,seconds);}
  for(const id of s.casualties||[]) {
   const npc=state.npcs[id];if(!npc||npc.hp<=0||npc.care?.status==='recovered')continue;
   if(npc.entrapment&&!s.blocked&&!(s.fire>0)){delete npc.entrapment;npc.activity='出口が開いた。手当てと付き添いを待っている';}
   if(npc.entrapment||npc.companionOf!=='player'||npc.region!==state.player.region)continue;
   const region=content.regions.find(r=>r.id===npc.region),shelter=region.objects.find(o=>o.id===npc.care.destination);
   if(seconds>0)followPath(region,npc,state.player.position,seconds/(content.time?.scale||60)*2.4);
   if(shelter&&npc.injury?.treated&&distance(npc.position,shelter.position)<4&&distance(npc.position,state.player.position)<4) {
    const fact=rememberAction(state,content,'rescue',{targetId:npc.id,payload:{shelterId:shelter.id,sourceFactId:s.damageFactId}});
    npc.care.status='recovered';npc.care.recoveryFactId=fact.id;npc.displacedHome=[...shelter.position];npc.hp=Math.max(npc.hp,50);delete npc.companionOf;delete npc.plan;
    s.recoveries.push({personId:npc.id,factId:fact.id,at:state.time});
   }
  }
  if(!s.blocked&&!(s.fire>0)&&s.integrity>=spec.safe.integrity&&(s.casualties||[]).every(id=>state.npcs[id]?.care?.status==='recovered'))s.recoveredAt??=state.time;
 }
}
