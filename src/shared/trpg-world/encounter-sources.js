import {causalDefinitions} from './causal-events.js';
import {processHazard} from './processes.js';
import {structureSafe} from './infrastructure.js';

// An aggregate incident label cannot activate its unrelated component actors.
// Existing living entities are never deleted by these emergence predicates.
export function sourceSituation(state,content,event,sourceId){
 const current=state.events[event.id],c=current?.causal||{},started=state.time>=event.startsAt;
 const specs=(content.processes||[]).filter(s=>s.eventId===event.id&&s.sourceId===sourceId);
 const hazards=specs.map(s=>({spec:s,hazard:processHazard(state,s)})).filter(x=>x.hazard);
 if(hazards.length)return {present:hazards.some(x=>x.hazard.present),active:hazards.some(x=>state.time>=(x.spec.startsAt??event.startsAt)&&x.hazard.present),aftermath:hazards.some(x=>x.hazard.aftermath)};
 const definition=causalDefinitions(content).find(d=>d.eventId===event.id&&(d.sourceIds||event.causalSourceIds||[]).includes(sourceId));
 if(definition&&c.model!=='legacy-settled'){
  let present=false,aftermath=false;
  if(definition.type==='ecosystem'){present=c.coreInPool&&!c.coreSealed;aftermath=c.treeIntegrity<=0&&c.forestBarrier===false;}
  if(definition.type==='return-person'){present=c.phase!=='reunited'&&state.npcs[definition.personId]?.hp>0;aftermath=present&&current.status==='failed';}
  if(definition.type==='institution'){present=['disputed','displaced'].includes(c.tenure);aftermath=['evicted','displaced'].includes(c.tenure);}
  if(definition.type==='infrastructure'){
   const structures=(definition.structures||[]).map(id=>(content.structures||[]).find(s=>s.id===id)).filter(Boolean);
   present=structures.some(s=>state.structures[s.id]&&!structureSafe(state,s));
   aftermath=structures.some(s=>state.structures[s.id]?.damageAt!==undefined&&state.structures[s.id]?.recoveredAt===undefined);
  }
  return {present:!!present,active:started&&!!present,aftermath:!!aftermath};
 }
 // Explicit legacy/unmigrated fallback. A historical settled save does not
 // acquire a new hazard merely because a component was added to the compiler.
 return {present:!['resolved','prevented','failed'].includes(current?.status),active:['active','critical'].includes(current?.status),aftermath:current?.status==='failed'};
}
export function encounterSourceIds(event,template){
 return [...new Set(template.sourceCondition?.match(/T\d{2}/g)||[])].filter(id=>(event.sourceIds||[]).includes(id));
}
export function encounterEligible(state,content,event,template,{instigator=false}={}){
 const sources=encounterSourceIds(event,template);
 if(!sources.length)return instigator&&!['resolved','prevented','failed'].includes(state.events[event.id]?.status);
 const aftermath=/失敗|failed/i.test(template.sourceCondition||'');
 return sources.some(id=>sourceSituation(state,content,event,id)[aftermath?'aftermath':instigator?'present':'active']);
}
