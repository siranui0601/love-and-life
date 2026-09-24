import {worldSite,advanceActorJourney} from './actor-journey.js';
import {distance,hasLineOfSight} from './navigation.js';
import {rememberAction} from './relationships.js';

const present=(content,a,b,range=3)=>a&&b&&!a.travel&&!b.travel&&a.region===b.region&&distance(a.position,b.position)<range&&hasLineOfSight(content.regions.find(r=>r.id===a.region),a.position,b.position);
export function activeCustody(state,person){const c=state.personCustodies?.[person?.custodyId];return c&&['conveying','held'].includes(c.phase)?c:null;}
// Custody is a physical relation with provenance, never ownership of a person.
// The caller must possess the authority or restraint resource before this step.
export function restrainPerson(state,content,holder,person,{kind='detention',sourceFactId,authorityId,siteId,routeIds=[],modes=['foot']}={}){
 if(holder.hp<=0||person.hp<=0||activeCustody(state,person)||!present(content,holder,person))return null;
 person.goal='restrained';
 const fact=rememberAction(state,content,'person-restrained',{actorId:holder.id,targetId:person.id,payload:{kind,sourceFactId,authorityId}});
 state.personCustodies||={};const custody={id:fact.id,personId:person.id,holderId:holder.id,kind,authorityId,sourceFactId,restraintFactId:fact.id,siteId,routeIds:[...routeIds],modes:[...modes],phase:siteId?'conveying':'held',createdAt:state.time};
 state.personCustodies[fact.id]=custody;person.custodyId=fact.id;person.path=[];delete person.pathTarget;delete person.plan;delete person.companionOf;
 if(kind==='detention')person.detention={status:'held',custodianId:holder.id,authorityId,at:state.time,sourceFactId:fact.id};
 else person.captive={custodianId:holder.id,sourceFactId:fact.id};
 if(siteId)holder.custodyAssignment=fact.id;
 return custody;
}
export function releasePerson(state,content,person,releaser,sourceFactId){
 const custody=activeCustody(state,person);if(!custody||!present(content,releaser,person,5))return null;
 const fact=rememberAction(state,content,'person-released',{actorId:releaser.id||'player',targetId:person.id,payload:{custodyFactId:custody.id,sourceFactId}});
 custody.phase='released';custody.releasedAt=state.time;custody.releaseFactId=fact.id;
 const holder=state.npcs[custody.holderId];if(holder?.custodyAssignment===custody.id){delete holder.custodyAssignment;holder.nextDecision=0;}
 if(person.detention?.sourceFactId===custody.id)person.detention={...person.detention,status:'released',releaseFactId:fact.id};
 person.releasedFromCustody={custodyId:custody.id,releaseFactId:fact.id};
 delete person.captive;delete person.custodyId;delete person.journeyFollowObservation;person.nextDecision=0;
 return fact;
}
export function custodyActions(state,content,person){
 const custody=activeCustody(state,person);if(!custody||person.hp<=0||person.travel)return [];
 const holder=state.npcs[custody.holderId],guarded=holder?.hp>0&&(holder.goal!=='sleep'||holder.custodyAssignment||holder.operationAssignment)&&present(content,holder,person,18)&&!activeCustody(state,holder);
 return [{id:'free-restraints',type:'causal',label:'手足の拘束をほどく',available:!guarded,missing:guarded?['見張りがすぐそばで警戒している']:[]}];
}
export function advancePersonCustody(state,content,seconds){
 if(seconds<=0)return;
 for(const c of Object.values(state.personCustodies||{})){
  if(!['conveying','held'].includes(c.phase))continue;
  const person=state.npcs[c.personId],holder=state.npcs[c.holderId];if(!person||person.hp<=0)continue;
  person.activity=c.kind==='detention'?'身柄を拘束されている':'手足を縛られている';
  if(c.phase!=='conveying')continue;
  // Injured/absent custodians do not move bodies by authority alone. Restraints
  // remain physical until somebody actually removes them at the scene.
  if(!holder||holder.hp<=0||activeCustody(state,holder)){c.blockedReason='custodian-unavailable';continue;}
  holder.custodyAssignment=c.id;holder.activity='拘束した人物を連れて歩く';
  const result=advanceActorJourney(state,content,holder,c.siteId,seconds,{...c,followers:[person.id]});
  if(result.failed){c.blockedReason=result.failed;continue;}
  if(result.complete){
   const fact=rememberAction(state,content,'custody-arrival',{actorId:holder.id,targetId:person.id,payload:{siteId:c.siteId,custodyFactId:c.id,personPosition:[...person.position]}});
   c.phase='held';c.arrivedAt=state.time;c.arrivalFactId=fact.id;delete holder.custodyAssignment;holder.nextDecision=0;
   // The destination is a real known place, not a new prison spawned for this
   // incident. The custodian resumes daily needs; unattended restraint can be cut.
   const site=worldSite(content,c.siteId);holder.displacedHome=[...site.position];
  }
 }
}
