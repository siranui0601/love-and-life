import {orderedValues} from './semantic.js';
import {conditionHolds,consumeResources,depositDocuments,recordMilestone} from './world-semantics.js';
import {distance,followPath,hasLineOfSight} from './navigation.js';
import {rememberAction} from './relationships.js';

// Authored scenario bindings. Components below know roles and resources, not T numbers.
export const DEFAULT_CAUSAL_SCENARIOS=[
  {eventId:'lost-road',sourceIds:['T01'],type:'return-person',personId:'NPC001',familyId:'NPC002'},
  {eventId:'crown',sourceIds:['T10'],type:'institution',facilityId:'LOC_CAP_ORPHANAGE',officeId:'LOC_CAP_OFFICE',replacementId:'LOC_CAP_LOWER_INN',
    documents:[{id:'donation',targetId:'LOC_CAP_ORPHANAGE',title:'土地の寄付契約',text:'土地は孤児の養育を目的として寄付され、用途変更には審理が必要と記載されている。'},
      {id:'registry',targetId:'LOC_CAP_OFFICE',title:'土地台帳の写し',text:'土地台帳には寄付契約が登記されている。立ち退き申請にその注記がない。'},
      {id:'debt',targetId:'LOC_CAP_MARKET',title:'納品と請求の控え',text:'孤児院への納品量と請求量が一致しない。二重に計上された代金が借金へ加算されている。'}]},
  {eventId:'roots',sourceIds:['T13'],type:'ecosystem',deviceId:'LOC_FOREST_RIVER',dependentEvents:['resonance','border'],affectedRegion:'elf'},
];
export function causalDefinitions(content) {return content.causalScenarios||DEFAULT_CAUSAL_SCENARIOS.filter(s=>content.events.some(e=>e.id===s.eventId));}
export function initializeCausality(state,content) {
  state.facilities||={};state.causalObjects||={};
  for(const event of content.events||[]) {
    const current=state.events[event.id];if(!current)continue;
    if(Object.hasOwn(current,'pressure')){current.legacyPressureSnapshot=current.pressure;delete current.pressure;}
    current.causal||={milestones:[],aftermath:[],model:['resolved','prevented','failed'].includes(current.status)?'legacy-settled':'unadapted'};
  }
  for(const definition of causalDefinitions(content)) {
    const current=state.events[definition.eventId];
    if(current.causal.model!=='unadapted')continue;
    current.causal={model:definition.type,milestones:[],aftermath:[],
      ...(definition.type==='return-person'?{phase:'home',personId:definition.personId,familyId:definition.familyId}:{}),
      ...(definition.type==='institution'?{submitted:[],reviewed:false,tenure:'disputed'}:{}),
      ...(definition.type==='ecosystem'?{waterFlow:1,treeIntegrity:100,coreInPool:true,coreSealed:false,forestBarrier:true}:{}),
    };
  }
}
function settle(state,event,status,evidence) {
  const current=state.events[event.id];if(['resolved','prevented','failed'].includes(current.status))return;
  if(['resolved','prevented'].includes(status)&&event.causalSourceIds?.length&&event.sourceIds?.some(id=>!event.causalSourceIds.includes(id))) {
    current.causal.componentStatus=status;current.causal.completedSources=[...event.causalSourceIds];
    recordMilestone(state,current.causal,'component-'+status,evidence);return;
  }
  current.status=status;current.resolvedAt=state.time;recordMilestone(state,current.causal,status,evidence);
  state.facts[`${status}:${event.id}`]={at:state.time,eventId:event.id,evidence};
  // No automatic remote knowledge or quest payout. The result must be witnessed.
}
export function advanceCausality(state,content,seconds) {
  initializeCausality(state,content);
  const byId=new Map(content.events.map(e=>[e.id,e]));
  for(const definition of causalDefinitions(content)) {
    const event=byId.get(definition.eventId),current=state.events[event.id],causal=current.causal;
    if(causal.model==='legacy-settled'||['resolved','prevented'].includes(causal.componentStatus))continue;
    const region=content.regions.find(r=>r.id===event.region);
    if(definition.type==='return-person') {
      const person=state.npcs[definition.personId],family=state.npcs[definition.familyId];if(!person||!family)continue;
      if(causal.phase==='home'&&state.time>=event.startsAt&&person.hp>0) {causal.phase='excursion';person.causalAssignment=event.id;}
      if(causal.phase==='excursion') {
        person.activity='村の外を探検する';followPath(region,person,event.position,seconds/(content.time?.scale||60)*1.5);
        const predator=orderedValues(state.monsters).find(m=>m.hp>0&&m.region===person.region&&distance(m.position,person.position)<18);
        if(predator&&distance(person.position,event.position)<4) {
          person.injury={kind:'leg',treated:false,causedBy:predator.id,at:state.time};person.hp=Math.min(person.hp,35);causal.phase='injured';
          rememberAction(state,content,'injury',{actorId:person.id,payload:{predatorId:predator.id}});
        }
      }
      if(causal.phase==='injured')person.activity=person.companionOf?'支えられながら村へ戻る':'脚を負傷し、助けを待つ';
      if(person.companionOf==='player'&&state.player.region===person.region&&person.hp>0) {
        followPath(region,person,state.player.position,seconds/(content.time?.scale||60)*2.6);
        const home=content.npcs.find(n=>n.id===family.id)?.home||region.spawn;
        if(family.hp>0&&!family.travel&&family.region===person.region&&distance(person.position,family.position)<18&&hasLineOfSight(region,person.position,family.position))family.causalAssignment=`reunion:${event.id}`;
        if(family.causalAssignment===`reunion:${event.id}`){family.activity='家族を家で迎える';followPath(region,family,home,seconds/(content.time?.scale||60)*1.55);}
        if((!person.injury||person.injury.treated)&&distance(person.position,home)<6&&conditionHolds(state,content,{type:'co-located',actorId:person.id,targetId:family.id,range:3})) {
          const fact=rememberAction(state,content,'family-reunion',{actorId:person.id,targetId:family.id,payload:{escortId:'player'}});
          causal.phase='reunited';delete person.companionOf;delete person.causalAssignment;delete family.causalAssignment;
          settle(state,event,'resolved',fact.id);
        }
      }
    } else if(definition.type==='institution'&&!['resolved','prevented','failed'].includes(current.status)) {
      const office=region.objects.find(o=>o.id===definition.officeId);
      // A real clerk at work reviews the documents deposited in that office.
      const clerk=office&&orderedValues(state.npcs).find(n=>n.hp>0&&!n.travel&&n.region===event.region&&distance(n.position,office.position)<5&&
        content.npcs.some(t=>t.id===n.id&&(/役人|役所|文官|行政|官吏/.test(t.role||'')||t.workFacilityId===definition.officeId)));
      if(clerk&&conditionHolds(state,content,{type:'field',path:['events',event.id,'causal','submitted'],op:'contains-all',value:definition.documents.map(d=>d.id)})) {
        causal.reviewed=true;causal.tenure='protected';
        const fact=rememberAction(state,content,'document-review',{actorId:clerk.id,targetId:definition.facilityId,payload:{documents:[...causal.submitted]}});
        settle(state,event,'resolved',fact.id);
      }
    } else if(definition.type==='ecosystem'&&!['resolved','prevented','failed'].includes(current.status)) {
      const absorber=state.monsters[`opposition:${event.id}`];
      const absorbing=causal.coreInPool&&!causal.coreSealed;
      causal.waterFlow=absorbing?.35:1;
      if(state.time>=event.startsAt)causal.treeIntegrity=Math.max(0,causal.treeIntegrity-(absorbing?seconds/3600*2:0));
      if(conditionHolds(state,content,{all:[{type:'field',path:['events',event.id,'causal','coreInPool'],value:false},{any:[{type:'field',path:['events',event.id,'causal','coreSealed'],value:true},{type:'field',path:['monsters',`opposition:${event.id}`,'hp'],op:'lte',value:0}]}]}))settle(state,event,state.time<event.startsAt?'prevented':'resolved','water-flow-restored-and-core-contained');
      if(causal.treeIntegrity<=0)failCausality(state,content,event);
    }
  }
}
export function failCausality(state,content,event) {
  const current=state.events[event.id];if(current.status==='failed')return;
  const definition=causalDefinitions(content).find(d=>d.eventId===event.id),causal=current.causal;
  settle(state,event,'failed','deadline-or-physical-failure');
  if(['resolved','prevented'].includes(causal.componentStatus))return;
  if(definition?.type==='return-person') {
    const person=state.npcs[definition.personId];if(person&&causal.phase!=='reunited'){person.hp=0;delete person.companionOf;person.activity='倒れている';}
    causal.aftermath.push({kind:'missing-person-not-returned',at:state.time});
  } else if(definition?.type==='institution') {
    causal.tenure='evicted';state.facilities[definition.facilityId]={kind:'shop',name:'旧孤児院跡の冒険者店',status:'repurposed'};
    const region=content.regions.find(r=>r.id===event.region),destination=region.objects.find(o=>o.id===definition.replacementId);
    if(destination)for(const template of content.npcs.filter(n=>n.region===event.region&&/孤児|少年|少女/.test(n.role||''))) {
      const npc=state.npcs[template.id];if(npc?.hp>0){npc.displacedHome=[...destination.position];npc.nextDecision=0;}
    }
    causal.aftermath.push({kind:'institution-replaced',facilityId:definition.facilityId,at:state.time});
  } else if(definition?.type==='ecosystem') {
    causal.forestBarrier=false;causal.treeIntegrity=0;state.regions[event.region].forestBarrier=false;
    if(state.regions[definition.affectedRegion])state.regions[definition.affectedRegion].habitat='destroyed';
    for(const id of definition.dependentEvents||[])if(state.events[id]) {
      state.events[id].causal.preconditions||={};state.events[id].causal.preconditions.forestPassOpen={at:state.time,sourceEvent:event.id};
    }
    causal.aftermath.push({kind:'forest-pass-opened-and-seal-lost',at:state.time});
  }
}
export function causalActions(state,content,target) {
  const actions=[];
  const npc=state.npcs[target.id];
  if(npc?.injury&&!npc.injury.treated)actions.push({id:'tend',type:'causal',label:'脚の傷を手当てする · 傷薬1つ'});
  if((npc?.injury?.treated||npc?.causalAssignment&&!npc.injury)&&!npc.companionOf)actions.push({id:'escort',type:'causal',label:'身体を支えて、一緒に歩く'});
  if(npc?.companionOf)actions.push({id:'release',type:'causal',label:'ここで待っていてもらう'});
  for(const definition of causalDefinitions(content)) {
    if(definition.type==='institution') {
      for(const doc of definition.documents)if(doc.targetId===target.id&&!state.knowledge.some(k=>k.id===`document:${definition.eventId}:${doc.id}`))actions.push({id:`read:${definition.eventId}:${doc.id}`,type:'causal',label:`${doc.title}を読む`});
      if(target.id===definition.officeId&&definition.documents.some(d=>state.knowledge.some(k=>k.id===`document:${definition.eventId}:${d.id}`)&&!state.events[definition.eventId].causal.submitted.includes(d.id)))actions.push({id:`submit:${definition.eventId}`,type:'causal',label:'まだ提出していない書類の写しを窓口へ渡す'});
    }
    if(definition.type==='ecosystem'&&target.id===definition.deviceId) {
      const causal=state.events[definition.eventId].causal;
      if(causal.coreInPool)actions.push({id:`divert:${definition.eventId}`,type:'causal',label:'木材と縄で脇水路を固定する · 木材2、縄1',available:(state.player.inventory.timber||0)>=2&&(state.player.inventory.rope||0)>=1,missing:['木材2つ、縄1つ']});
      if(!causal.coreSealed)actions.push({id:`seal:${definition.eventId}`,type:'causal',label:'調律結晶で吸収核を封じる · 結晶1、基礎魔術',available:state.player.skills.includes('magic')&&(state.player.inventory.crystal||0)>=1,missing:['調律結晶1つ、基礎魔術']});
    }
  }
  return actions;
}
export function applyCausalAction(state,content,target,id) {
  const reject=message=>{throw Object.assign(new Error(message),{code:'CAUSAL_REQUIREMENTS',status:409});};
  if(!causalActions(state,content,target).some(a=>a.id===id))reject('この場所ではできません。');
  const p=state.player,npc=state.npcs[target.id];
  if(id==='tend') {if(!p.inventory.medicine)reject('傷薬が必要です。');p.inventory.medicine--;npc.injury.treated=true;rememberAction(state,content,'treatment',{targetId:npc.id});}
  else if(id==='escort')npc.companionOf='player';
  else if(id==='release')delete npc.companionOf;
  else {
    const [verb,eventId,documentId]=id.split(':'),definition=causalDefinitions(content).find(d=>d.eventId===eventId),causal=state.events[eventId].causal;
    if(verb==='read') {
      const doc=definition.documents.find(d=>d.id===documentId),factId=`document:${eventId}:${doc.id}`;
      if(!state.knowledge.some(k=>k.id===factId))state.knowledge.push({id:factId,kind:'document',documentId:doc.id,eventRef:eventId,text:doc.text,observedAt:state.time,source:{type:'read',targetId:target.id}});
      return {message:doc.text};
    }
    if(verb==='submit') {
      const copies=definition.documents.filter(d=>state.knowledge.some(k=>k.id===`document:${eventId}:${d.id}`)).map(d=>d.id);
      if(!copies.length)reject('提出する書類がありません。');causal.submitted=[...new Set([...causal.submitted,...copies])];
      const fact=rememberAction(state,content,'documents-submitted',{targetId:target.id,payload:{copies}});depositDocuments(state,{holderId:target.id,documents:copies.map(id=>`${eventId}:${id}`),sourceFactId:fact.id});
    }
    if(verb==='divert') {if(!consumeResources(p.inventory,{timber:2,rope:1}))reject('木材2つと縄1つが必要です。');causal.coreInPool=false;}
    if(verb==='seal') {if(!p.skills.includes('magic')||!consumeResources(p.inventory,{crystal:1}))reject('結晶と基礎魔術が必要です。');causal.coreSealed=true;}
    rememberAction(state,content,verb,{targetId:target.id,payload:{eventId}});
  }
  return {message:'その場で行動した。'};
}
