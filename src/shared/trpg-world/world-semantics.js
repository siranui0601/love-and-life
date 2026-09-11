import {distance,hasLineOfSight} from './navigation.js';
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
