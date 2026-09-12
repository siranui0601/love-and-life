// A reported deadline is a claim learned in the world, not the simulation's
// scheduler. It can remain outdated when circumstances change elsewhere.
export function knownTiming(state,eventId) {
 const fact=state.knowledge.filter(k=>(k.eventId===eventId||k.eventRef===eventId)&&Number.isFinite(k.deadlineClaim?.at)&&k.deadlineClaim?.text&&k.source&&['read','heard','told'].includes(k.source.type)).at(-1);
 if(!fact)return {};
 return {deadline:fact.deadlineClaim.at,remaining:Math.max(0,fact.deadlineClaim.at-state.time),deadlineSource:structuredClone(fact.source),deadlineText:fact.deadlineClaim.text};
}
export function readNotices(state,target) {
 for(const notice of target.notices||[]) {
  if(!notice.eventId||!Number.isFinite(notice.deadline)||!notice.text||state.time<(notice.postedAt||0))continue;
  const id=`notice:${target.id}:${notice.eventId}`;
  const fact={id,kind:'document',eventRef:notice.eventId,text:notice.text,observedAt:state.time,source:{type:'read',targetId:target.id},deadlineClaim:{at:notice.deadline,text:notice.text}};
  const prior=state.knowledge.find(k=>k.id===id);if(prior)Object.assign(prior,fact);else state.knowledge.push(fact);
 }
}
