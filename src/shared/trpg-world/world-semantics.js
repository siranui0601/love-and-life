import {distance,hasLineOfSight} from './navigation.js';
// Beliefs about access are observations, not a remote read of facility truth.
export function knownWorkplaceClosed(npc,targetId) {
 const latest=(npc.knowledge||[]).filter(k=>k.targetId===targetId&&['workplace-closure','workplace-status'].includes(k.kind)).sort((a,b)=>(a.observedAt||0)-(b.observedAt||0)).at(-1);
 return latest?.kind==='workplace-closure'||latest?.closed===true;
}
export function observeWorkplace(state,observer,target,closed) {
 const knowledge=observer.knowledge;
 const previous=[...knowledge].reverse().find(k=>k.kind==='workplace-status'&&k.targetId===target.id&&k.source?.type==='seen');
 if(previous?.closed===closed&&knownWorkplaceClosed(observer,target.id)===closed)return;
 knowledge.push({id:`workplace:${target.id}:${state.nextId++}`,kind:'workplace-status',targetId:target.id,closed,
  text:`${target.name||'仕事場'}の入口は${closed?'閉鎖されている':'開いており、仕事が再開できる'}。`,observedAt:state.time,
  source:{type:'seen',actorId:observer.id||'player',region:observer.region||state.player.region}});
 observer.nextDecision=0;
}
// Authored server predicates operate on world entities. No route or quest acceptance input.
export function conditionHolds(state,content,condition) {
 if(condition.all)return condition.all.every(c=>conditionHolds(state,content,c));
 if(condition.any)return condition.any.some(c=>conditionHolds(state,content,c));
 if(condition.type==='field') {
  let value=state;for(const key of condition.path)value=value?.[key];
  if(condition.op==='lte')return Number.isFinite(value)&&value<=condition.value;
  if(condition.op==='contains-all')return Array.isArray(value)&&condition.value.every(v=>value.includes(v));
  return value===condition.value;
 }
 if(condition.type==='co-located') {
  const a=state.npcs[condition.actorId],b=state.npcs[condition.targetId];if(!a||!b||a.hp<=0||b.hp<=0||a.travel||b.travel||a.region!==b.region)return false;
  return distance(a.position,b.position)<condition.range&&hasLineOfSight(content.regions.find(r=>r.id===a.region),a.position,b.position);
 }
 throw new Error('Unknown authored world condition');
}
export function consumeResources(inventory,requirements) {
 if(Object.entries(requirements).some(([id,count])=>!Number.isFinite(count)||count<=0||(inventory[id]||0)<count))return false;
 for(const [id,count] of Object.entries(requirements))inventory[id]-=count;return true;
}
export function depositDocuments(state,{holderId,documents,sourceFactId}) {
 state.documentCustody||={};state.documentCustody[holderId]||=[];
 for(const documentId of documents)if(!state.documentCustody[holderId].some(d=>d.documentId===documentId))state.documentCustody[holderId].push({documentId,sourceFactId,depositedAt:state.time,holderId});
 return state.documentCustody[holderId];
}
export function recordMilestone(state,owner,kind,evidence) {
 const milestone={id:`milestone:${state.nextId++}`,kind,at:state.time,evidence};owner.milestones||=[];owner.milestones.push(milestone);return milestone;
}
