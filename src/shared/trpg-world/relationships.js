import {distance,hasLineOfSight} from './navigation.js';

export function initializeRelationships(state) {
  state.socialFacts||=[];state.promises||=[];
  for(const npc of Object.values(state.npcs||{})) {
    npc.memories||=[];npc.beliefs||=[];npc.possessions||={};npc.obligations||=[];
    if(Object.hasOwn(npc,'trust')) {npc.legacyTrustSnapshot=npc.trust;delete npc.trust;}
  }
}
export function rememberAction(state,content,kind,{actorId='player',targetId=null,payload={},observedBy=null}={}) {
  initializeRelationships(state);
  const actor=actorId==='player'?state.player:state.npcs[actorId];
  const region=content.regions.find(r=>r.id===actor.region);
  const witnesses=Object.values(state.npcs).filter(n=>n.hp>0&&!n.travel&&n.region===actor.region&&
    distance(n.position,actor.position)<18&&hasLineOfSight(region,n.position,actor.position)&&(!observedBy||observedBy.includes(n.id))).map(n=>n.id);
  const fact={id:`social:${state.nextId++}`,kind,actorId,targetId,payload:structuredClone(payload),
    at:state.time,region:actor.region,position:[...actor.position],witnesses};
  state.socialFacts.push(fact);
  for(const id of witnesses) {
    const npc=state.npcs[id];npc.memories.push({factId:fact.id,kind,actorId,targetId,learnedAt:state.time,source:{type:'seen',actorId}});
    npc.nextDecision=0;
  }
  return fact;
}
export function relationshipReasons(state,npc,actorId='player') {
  return (npc.memories||[]).filter(m=>m.actorId===actorId).map(m=>state.socialFacts.find(f=>f.id===m.factId)).filter(Boolean);
}
// Ephemeral decision evidence; never persisted as a universal relationship meter.
export function evaluateCooperation(state,npc,{risk=0,resourceCost=0,purpose='assistance',values={},actorId='player'}={}) {
 const history=relationshipReasons(state,npc,actorId),evidence=[];let support=0;
 for(const fact of history) {
  const memory=npc.memories.find(m=>m.factId===fact.id),confidence=memory?.source?.type==='seen'?1:.5;
  const directlyInvolved=fact.targetId===npc.id||fact.actorId===npc.id;
  if(!directlyInvolved)continue;
  let weight=0;
  if(fact.kind==='promise-kept') {
   const promise=state.promises.find(p=>p.id===fact.payload.promiseId);
   if(promise?.to===npc.id&&promise.status==='kept')weight=3;
  }
  if(fact.kind==='rescue'&&fact.targetId===npc.id)weight=4;
  if(fact.kind==='gift'&&fact.payload.neededAtReceipt)weight=1;
  if(['theft','promise-broken'].includes(fact.kind)&&fact.targetId===npc.id)weight=-4;
  if(weight){support+=weight*confidence;evidence.push({factId:fact.id,source:memory.source,reason:fact.kind,weight:weight*confidence});}
 }
 const burden=risk*3+resourceCost+(npc.hunger>80?2:0)+(npc.fatigue>80?2:0)+(npc.goal==='flee'?10:0);
 const duty=values.duty===purpose?2:0;
 return {willing:npc.hp>0&&support+duty>burden,evidence,context:{purpose,risk,resourceCost,currentGoal:npc.goal},utility:support+duty-burden};
}
export function willingToCooperate(state,npc,context) {return evaluateCooperation(state,npc,context).willing;}
export function expirePromises(state) {
  for(const promise of state.promises||[])if(promise.status==='open'&&state.time>promise.deadline) {
    promise.status='broken';const npc=state.npcs[promise.to];if(!npc)continue;
    const fact={id:`social:${state.nextId++}`,kind:'promise-broken',actorId:promise.from,targetId:promise.to,
      at:state.time,region:npc.region,position:[...npc.position],payload:{promiseId:promise.id},witnesses:[npc.id],source:{type:'inferred',promiseId:promise.id}};
    state.socialFacts.push(fact);npc.memories.push({factId:fact.id,kind:fact.kind,actorId:promise.from,targetId:npc.id,learnedAt:state.time,source:fact.source});npc.nextDecision=0;
  }
}
export function deliverSupplies(state,content,npc) {
  npc.possessions||={};npc.possessions.supplies=(npc.possessions.supplies||0)+1;
  const fact=rememberAction(state,content,'gift',{targetId:npc.id,payload:{itemId:'supplies',quantity:1,neededAtReceipt:npc.hunger>60,requested:state.promises.some(p=>p.to===npc.id&&p.status==='open')}});
  for(const promise of state.promises||[])if(promise.status==='open'&&promise.to===npc.id&&promise.intent==='deliver-supplies'&&state.time<=promise.deadline) {
    promise.status='kept';promise.fulfilledBy=fact.id;
    rememberAction(state,content,'promise-kept',{targetId:npc.id,payload:{promiseId:promise.id,evidenceFactId:fact.id}});
  }
  return fact;
}
