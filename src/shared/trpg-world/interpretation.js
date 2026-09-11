// Interpretation is defeasible belief, not a mutation of the underlying fact.
export function interpretationCandidates(state,npc,template,fact) {
 const text=`${template?.role||''} ${template?.personality||''}`,action=fact.payload.action;
 const body=['lie','roll','sleep-ground'].includes(action),medical=/医|薬|看護|世話/.test(text),cautious=/衛|兵|疑|慎重/.test(text);
 const previous=(npc.beliefs||[]).filter(b=>b.about===fact.actorId||b.place?.region===fact.region);
 const candidates=[{claim:body?'resting':'unusual-expression',weight:1,evidence:[fact.id]}];
 if(body){
  candidates.push({claim:'ill',weight:(medical?3:.2)+(npc.currentConcern==='illness'?2:0)+previous.filter(b=>b.claim==='ill').length*.4,evidence:[fact.id,...previous.filter(b=>b.claim==='ill').map(b=>b.id)]});
  candidates.push({claim:'intoxicated',weight:cautious?2:.1,evidence:[fact.id]});
  const water=previous.filter(b=>['unsafe-water','water-contaminated'].includes(b.claim)&&b.place?.objectId&&b.place.objectId===fact.payload.nearObjectId);
  if(water.length)candidates.push({claim:'possible-water-hazard',weight:4,evidence:[fact.id,...water.map(b=>b.id)]});
 }
 return candidates.sort((a,b)=>b.weight-a.weight||a.claim.localeCompare(b.claim));
}
const wording={'ill':'旅人が倒れたように見えた。','intoxicated':'旅人が酔っていたのかもしれない。','resting':'旅人が地面で休んでいた。','possible-water-hazard':'あの水場の近くで人が横になった。水の噂と関係があるのかもしれない。','unusual-expression':'旅人が身振りをしていた。'};
export function interpretObservation(state,content,fact) {
 for(const id of fact.witnesses){const npc=state.npcs[id],candidates=interpretationCandidates(state,npc,content.npcs.find(n=>n.id===id),fact),chosen=candidates[0];
  const belief={id:`belief:${state.nextId++}`,factId:fact.id,claim:chosen.claim,about:fact.actorId,confidence:Math.min(.7,.3+chosen.weight*.08),alternatives:candidates.slice(1).map(c=>({claim:c.claim,evidence:c.evidence})),evidence:chosen.evidence,place:{region:fact.region,position:[...fact.position],objectId:fact.payload.nearObjectId},source:{type:'interpretation',observerId:id,evidenceFactId:fact.id},at:state.time};
  npc.beliefs.push(belief);npc.knowledge.push({id:belief.id,kind:'rumor',text:wording[chosen.claim],region:fact.region,observedAt:state.time,confidence:belief.confidence,belief:structuredClone(belief),source:belief.source});npc.nextDecision=0;
 }
}
