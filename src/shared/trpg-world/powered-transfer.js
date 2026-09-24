import {worldSite} from './actor-journey.js';
import {distance,hasLineOfSight} from './navigation.js';
import {rememberAction} from './relationships.js';
import {registerInjuryCase} from './aftermath.js';

export function initializeTransfer(state,content,spec){
 if(!spec.transfer)return;
 state.deviceTransfers||={};state.deviceTransfers[spec.id]||={charge:spec.transfer.charges,pending:null,passages:[],...(state.contentRevision!==content.revision?{legacyDormant:true}:{})};
}
export function transferCasualtiesRecovered(state,spec){return (state.deviceTransfers?.[spec.id]?.passages||[]).every(p=>state.careCases?.[p.careCaseId]?.recoveredAt!==undefined);}
// This is an authored physical machine, not a travel command for a validator.
// Only a body actually in the sender's volume can be displaced, and only after
// a persisted active interval with a fresh presence/power check.
export function advancePoweredTransfer(state,content,spec,seconds){
 initializeTransfer(state,content,spec);const transfer=spec.transfer,s=state.deviceTransfers?.[spec.id];
 if(!transfer||!s||s.legacyDormant||seconds<=0)return;
 const p=state.processes[spec.id],origin=worldSite(content,spec.targetId),destination=worldSite(content,transfer.destinationId);
 const structure=spec.structureId&&state.structures[spec.structureId],damaged=(structure?.integrity??p.integrity)<80;
 if(!origin||!destination||!p.powered||!damaged||s.charge<=0){s.pending=null;return;}
 if(state.time<(spec.startsAt??content.events.find(e=>e.id===spec.eventId)?.startsAt??0))return;
 const inside=n=>n?.hp>0&&!n.travel&&!n.entrapment&&!n.captive&&n.detention?.status!=='held'&&n.region===origin.region&&distance(n.position,origin.position)<transfer.radius&&hasLineOfSight(content.regions.find(r=>r.id===origin.region),n.position,origin.position);
 if(s.pending){
  const person=state.npcs[s.pending.actorId];if(!inside(person)){s.pending=null;return;}
  if(state.time<s.pending.resolvesAt)return;
  const departure=rememberAction(state,content,'powered-departure',{actorId:person.id,targetId:origin.id,payload:{deviceId:spec.id}});
  // The target is the machine's fixed authored receiver. No person or quest
  // completion can choose it, and no survivor is generated at the other end.
  person.region=destination.region;person.position=[...destination.position];person.path=[];delete person.pathTarget;delete person.plan;delete person.companionOf;delete person.aftermathAssignment;
  const arrival=rememberAction(state,content,'powered-arrival',{actorId:person.id,targetId:destination.id,payload:{departureFactId:departure.id}});
  const care=registerInjuryCase(state,content,person,{sourceFactId:arrival.id,siteId:destination.id,shelterId:transfer.shelterId,text:'床に倒れ、脚を痛めた人がいる。',kind:'leg',damage:transfer.damage});
  s.charge--;s.passages.push({personId:person.id,departureFactId:departure.id,arrivalFactId:arrival.id,at:state.time,careCaseId:care?.id});s.pending=null;
  return;
 }
 const person=Object.values(state.npcs).find(inside);if(!person)return;
 const fact=rememberAction(state,content,'powered-field-active',{actorId:person.id,targetId:origin.id});
 s.pending={actorId:person.id,startedAt:state.time,resolvesAt:state.time+transfer.windupSeconds,fieldFactId:fact.id};
}
