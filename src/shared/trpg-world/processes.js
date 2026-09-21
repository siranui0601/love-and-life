import {distance,hasLineOfSight} from './navigation.js';
import {consumeResources,depositDocuments,recordMilestone} from './world-semantics.js';
import {rememberAction} from './relationships.js';

// Authored bindings run through a small physical/resource/institution vocabulary.
// Neither a command nor a narrative provider can assign an event outcome.
const copy=value=>structuredClone(value);
const siteIndexes=new WeakMap();
const site=(content,id)=>{if(!siteIndexes.has(content))siteIndexes.set(content,new Map(content.regions.flatMap(r=>r.objects).map(o=>[o.id,o])));return siteIndexes.get(content).get(id);};
const error=message=>{throw Object.assign(new Error(message),{code:'PROCESS_REQUIREMENTS',status:409});};
export function initializeProcesses(state,content){
 state.processes||={};
 for(const spec of content.processes||[])if(!state.processes[spec.id])state.processes[spec.id]={...copy(spec.initial),stock:{},documents:[],milestones:[],reviewSeconds:0,initializedAt:state.time,...(state.contentRevision!==content.revision?{legacyDormant:true}:{})};
}
function allowed(state,condition){
 if(!condition)return true;
 if(condition.all)return condition.all.every(c=>allowed(state,c));
 if(condition.any)return condition.any.some(c=>allowed(state,c));
 let value=state;for(const key of condition.path)value=value?.[key];
 return condition.op==='lte'?Number.isFinite(value)&&value<=condition.value:condition.op==='gte'?Number.isFinite(value)&&value>=condition.value:value===condition.value;
}
export function processSafe(state,spec){
 const p=state.processes[spec.id];
 if(spec.kind==='device')return !p.powered&&p.integrity>=80;
 if(spec.kind==='supply')return Object.entries(spec.required).every(([id,n])=>((p.receipts||p.stock)[id]||0)>=n);
 if(spec.kind==='inquiry')return p.order?.status==='issued'&&!!state.institutionalOrders?.[p.order.factId];
 if(spec.kind==='patient')return !!p.treated&&state.npcs[spec.actorId]?.hp>0;
 return false;
}
function pointFor(state,content,spec){return spec.kind==='patient'?state.npcs[spec.actorId]:site(content,spec.targetId);}
function satisfied(state,spec,event){
 // A conditional threat which never acquired its physical prerequisite is not
 // a failed intervention. Evaluate this only at the authored review horizon;
 // a temporarily intact upstream system is not an early victory.
 return processSafe(state,spec)||!!spec.activation&&state.time>=(spec.deadline??event.deadline)&&!allowed(state,spec.activation)&&state.processes[spec.id].failedAt===undefined;
}
export function processDescription(state,spec){
 const p=state.processes[spec.id];
 const physical=spec.kind==='device'?`${p.powered?'機構へ動力が流れ続けている。':'動力線は切り離されている。'}${p.integrity<80?'固定具は傷んでいる。':'固定具は補修されている。'}`:
 spec.kind==='supply'?`保管と受領の記録：${Object.entries(spec.required).map(([id,n])=>`${spec.resourceNames?.[id]||id} ${Math.min(n,p.stock[id]||0)}/${n}`).join('、')}。`:
 spec.kind==='patient'?(state.npcs[spec.actorId]?.hp<=0?'呼吸がなく、呼びかけにも反応しない。':p.treated?'処置を受け、呼吸が落ち着いている。':p.exposed?'顔色が悪く、手足が震えている。':'飲食物の封には傷があり、異臭がする。'):
 p.order?.status==='issued'?'提出された記録の審理が終わり、是正命令が交付されている。':p.documents.length?'提出された書類は担当者の審理を待っている。':'照合する原本と証言の提出を窓口で受け付けている。';
 return `${spec.observation} ${physical}${p.failedAt!==undefined?' 被害の後始末はまだ続いている。':''}`;
}
function note(state,content,spec,observer){
 if(observer.region!==spec.region||observer.hp<=0||observer.travel)return;
 const point=pointFor(state,content,spec),region=content.regions.find(r=>r.id===spec.region);
 if(!point||observer.region!==spec.region||observer.hp<=0||observer.travel||distance(observer.position,point.position)>18||!hasLineOfSight(region,observer.position,point.position))return;
 const p=state.processes[spec.id],id=`process-observation:${spec.id}`,text=processDescription(state,spec),knowledge=observer.id==='player'?state.knowledge:observer.knowledge;
 const previous=knowledge.find(k=>k.id===id);
 if(previous?.text===text&&distance(previous.destination.position,point.position)<4)return;
 const fact={id,kind:'site-observation',topicLabel:spec.name,text,destination:{region:spec.region,targetId:spec.targetId,position:[...point.position]},observedAt:state.time,source:{type:'seen',observerId:observer.id||'player'}};
 const old=knowledge.find(k=>k.id===id);if(old)Object.assign(old,fact);else knowledge.push(fact);
 observer.nextDecision=0;
}
export function inspectProcesses(state,content,target){
 initializeProcesses(state,content);
 const specs=(content.processes||[]).filter(s=>s.targetId===target.id);
 for(const spec of specs){note(state,content,spec,state.player);state.player.processInspections||={};state.player.processInspections[spec.id]={at:state.time};}
 for(const spec of content.processes||[])for(const doc of spec.documents||[])if(doc.targetId===target.id&&!state.knowledge.some(k=>k.id===`process-document:${doc.id}`))state.knowledge.push({id:`process-document:${doc.id}`,kind:'document',documentId:doc.id,text:doc.text,observedAt:state.time,source:{type:'read',targetId:target.id}});
 const documents=(content.processes||[]).flatMap(s=>s.documents||[]).filter(d=>d.targetId===target.id).map(d=>d.text);
 return [...specs.map(s=>processDescription(state,s)),...documents].join('\n')||null;
}
function operations(state,spec){
 const p=state.processes[spec.id];
 if(spec.kind==='device')return [
  ...(p.powered?[{verb:'isolate',label:'動力弁を閉じ、送出線を切り離す',minutes:15,requirements:{items:{rope:1}}}]:[]),
  ...(p.integrity<80?[{verb:'repair',label:'傷んだ固定具を交換して補修する',minutes:30,requirements:{items:{timber:2,...(spec.magical?{crystal:1}:{})},skills:spec.magical?['magic']:['crafting']}}]:[])];
 if(spec.kind==='supply')return Object.entries(spec.required).filter(([id,n])=>(p.stock[id]||0)<n).map(([id,n])=>({verb:`deliver-${id}`,label:`${spec.resourceNames?.[id]||id}を受領窓口へ届ける`,minutes:15,requirements:id==='gold'?{gold:Math.min(n-(p.stock[id]||0),20)}:{items:{[id]:1}}}));
 if(spec.kind==='patient')return !p.treated&&state.npcs[spec.actorId]?.hp>0?[{verb:'treat',label:'本人の薬を交換し、解毒処置を行う',minutes:15,requirements:{items:{antidote:1}}}]:[];
 if(spec.kind==='inquiry')return !p.order&&spec.documents.some(d=>state.knowledge.some(k=>k.documentId===d.id)&&!p.documents.includes(d.id))?[{verb:'submit',label:'読んだ原本の写しを審理窓口へ提出する',minutes:5,requirements:{}}]:[];
 return [];
}
export function processActions(state,content,target){
 initializeProcesses(state,content);const result=[];
 for(const spec of content.processes||[])if(spec.targetId===target.id&&!state.processes[spec.id].legacyDormant){
  if(!state.player.processInspections?.[spec.id]){result.push({id:`${spec.id}/inspect`,type:'process',label:`${spec.name}の現物と記録を調べる`});continue;}
  for(const op of operations(state,spec)){
   const missing=[];for(const [id,n] of Object.entries(op.requirements.items||{}))if((state.player.inventory[id]||0)<n)missing.push(`${content.items.find(i=>i.id===id)?.name||id} ${n}`);
   for(const id of op.requirements.skills||[])if(!state.player.skills.includes(id))missing.push(content.skills.find(s=>s.id===id)?.name||id);
   if(state.player.gold<(op.requirements.gold||0))missing.push(`${op.requirements.gold}G`);
   result.push({id:`${spec.id}/${op.verb}`,type:'process',label:`${op.label} · ${op.minutes}分`,requirements:copy(op.requirements),available:!missing.length,missing});
  }
 }
 return result;
}
export function startProcessWork(state,content,target,action){
 const [id,verb]=String(action).split('/'),spec=(content.processes||[]).find(s=>s.id===id&&s.targetId===target.id);
 if(!spec||state.processes[spec.id].legacyDormant)error('この場所の作業ではありません。');
 if(verb==='inspect'){inspectProcesses(state,content,target);return {inspection:processDescription(state,spec)};}
 const op=operations(state,spec).find(o=>o.verb===verb);
 if(!op||!processActions(state,content,target).some(a=>a.id===action&&a.available!==false))error('現場を調べ、必要な準備を整えてください。');
 if(state.player.gold<(op.requirements.gold||0)||!consumeResources(state.player.inventory,op.requirements.items||{}))error('物資が足りません。');
 state.player.gold-=op.requirements.gold||0;return {spec,op};
}
export function finishProcessWork(state,content,{spec,op}){
 const p=state.processes[spec.id];
 if(op.verb==='isolate')p.powered=false;
 if(op.verb==='repair')p.integrity=100;
 if(op.verb.startsWith('deliver-')){const id=op.verb.slice(8);p.stock[id]=(p.stock[id]||0)+(id==='gold'?op.requirements.gold:1);}
 if(op.verb==='treat'){const npc=state.npcs[spec.actorId];if(!npc||npc.hp<=0){recordMilestone(state,p,'treatment-failed-patient-died');return;}p.treated=true;npc.hp=Math.max(npc.hp,40);if(npc.injury?.kind==='poison')npc.injury.treated=true;}
 const fact=rememberAction(state,content,op.verb==='submit'?'documents-submitted':'facility-work',{targetId:spec.targetId,payload:{operation:op.verb,resources:copy(op.requirements)}});
 if(op.verb==='submit'){
  const docs=spec.documents.filter(d=>state.knowledge.some(k=>k.documentId===d.id)).map(d=>d.id);
  p.documents=[...new Set([...p.documents,...docs])];depositDocuments(state,{holderId:spec.targetId,documents:docs,sourceFactId:fact.id});
 }
 recordMilestone(state,p,op.verb,fact.id);note(state,content,spec,state.player);
}
export function advanceProcesses(state,content,seconds){
 initializeProcesses(state,content);
 for(const spec of content.processes||[]){
  const p=state.processes[spec.id],event=content.events.find(e=>e.id===spec.eventId),point=pointFor(state,content,spec);
  if(!event||!point||p.legacyDormant)continue;
  const active=state.time>= (spec.startsAt??event.startsAt)&&allowed(state,spec.activation);
  if(spec.kind==='supply'&&processSafe(state,spec)&&!p.distributedAt){
   const recipients=Object.values(state.npcs).filter(n=>n.hp>0&&!n.travel&&n.region===spec.region&&distance(n.position,point.position)<8&&hasLineOfSight(content.regions.find(r=>r.id===spec.region),n.position,point.position)&&content.npcs.find(t=>t.id===n.id)?.workFacilityId===spec.targetId);
   if(recipients.length){let remaining=p.stock.gold||0;for(const n of recipients){const amount=Math.floor(remaining/(recipients.length-recipients.indexOf(n)));n.money+=amount;remaining-=amount;}
    p.distributedAt=state.time;p.distributions=recipients.map(n=>n.id);p.receipts=copy(p.stock);p.stock={};
    for(const n of recipients){const quantity=(p.receipts.supplies||0)/recipients.length;n.hunger=Math.max(0,n.hunger-quantity*25);}
    recordMilestone(state,p,'wages-and-rations-received');
   }
  }
  if(active&&spec.kind==='patient'&&!p.treated){const npc=state.npcs[spec.actorId];if(!p.exposed){p.exposed=true;npc.injury={kind:'poison',treated:false,at:state.time};npc.hp=Math.min(npc.hp,40);}npc.hp=Math.max(0,npc.hp-seconds/3600*(spec.damagePerHour||1));}
  if(spec.kind==='inquiry'&&!p.order&&spec.documents.every(d=>p.documents.includes(d.id))&&seconds>0){
   const clerk=Object.values(state.npcs).find(n=>n.hp>0&&!n.travel&&n.region===spec.region&&distance(n.position,point.position)<8&&hasLineOfSight(content.regions.find(r=>r.id===spec.region),n.position,point.position)&&((spec.reviewers||[]).includes(n.id)||content.npcs.find(t=>t.id===n.id)?.workFacilityId===spec.targetId));
   if(clerk){p.reviewSeconds+=seconds;if(p.reviewSeconds>=300){const fact=rememberAction(state,content,'institutional-order',{actorId:clerk.id,targetId:spec.targetId,payload:{documents:[...p.documents],order:spec.order}});p.order={status:'issued',kind:spec.order,authority:clerk.id,evidence:[...p.documents],at:state.time,factId:fact.id};
     state.institutionalOrders||={};state.institutionalOrders[fact.id]={...copy(p.order),jurisdiction:spec.region,targetId:spec.affectedTarget||spec.targetId};
     if(spec.access){const facility=state.facilities[spec.access.targetId]||={};facility.closed=spec.access.closed;facility.orderId=fact.id;}
     if(spec.protectedActor){const person=state.npcs[spec.protectedActor];if(person){person.legalProtection={authority:clerk.id,jurisdiction:spec.region,orderId:fact.id};}}
}}
  }
  const safe=processSafe(state,spec);
  if(safe&&p.safeAt===undefined)p.safeAt=state.time;
  if(active&&!safe&&state.time>=(spec.deadline??event.deadline)&&p.failedAt===undefined){
   p.failedAt=state.time;
   if(spec.kind==='device'){p.integrity=0;p.powered=false;}
   if(spec.aftermath?.closedTarget){state.facilities[spec.aftermath.closedTarget]={...state.facilities[spec.aftermath.closedTarget],closed:true};}
   if(spec.aftermath?.displaceTarget){const shelter=site(content,spec.aftermath.shelterId);if(shelter)for(const n of Object.values(state.npcs))if(n.hp>0&&n.region===spec.region&&distance(n.position,point.position)<18){n.displacedHome=[...shelter.position];n.nextDecision=0;}}
   p.aftermath={at:state.time,...copy(spec.aftermath||{})};
  }
  if(safe&&p.failedAt!==undefined&&!p.recoveredAt){p.recoveredAt=state.time;if(spec.aftermath?.closedTarget)state.facilities[spec.aftermath.closedTarget]={...state.facilities[spec.aftermath.closedTarget],closed:false};}
  // Observation is local. It does not identify the author of an unseen cause.
  for(const npc of Object.values(state.npcs))if(npc.goal!=='sleep')note(state,content,spec,npc);
 }
 // Source components are bookkeeping derived from world endpoints. Partial
 // success never resolves a merged crisis whose other causes still operate.
 for(const event of content.events||[]){
  const specs=(content.processes||[]).filter(s=>s.eventId===event.id);if(!specs.length)continue;
  const current=state.events[event.id];current.causal.sources||={};
  for(const spec of specs)current.causal.sources[spec.sourceId]={safe:processSafe(state,spec),failedAt:state.processes[spec.id].failedAt,recoveredAt:state.processes[spec.id].recoveredAt};
  const completed=new Set(current.causal.completedSources||[]);
  if(['resolved','prevented'].includes(current.causal.componentStatus))for(const id of event.causalSourceIds||[])completed.add(id);
  const covered=(event.sourceIds||[]).every(id=>completed.has(id)||specs.some(s=>s.sourceId===id)&&specs.filter(s=>s.sourceId===id).every(s=>satisfied(state,s,event)));
  if(covered&&!['failed','resolved','prevented'].includes(current.status)){current.status=state.time<event.startsAt?'prevented':'resolved';current.resolvedAt=state.time;recordMilestone(state,current.causal,current.status,specs.map(s=>state.processes[s.id].milestones.at(-1)?.evidence));}
 }
}
