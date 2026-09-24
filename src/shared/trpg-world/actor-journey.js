import {distance,hasLineOfSight,followPath} from './navigation.js';

const indexes=new WeakMap();
export function worldSite(content,id){
 if(!indexes.has(content))indexes.set(content,new Map(content.regions.flatMap(r=>r.objects.map(o=>[o.id,{...o,region:r.id}]))));
 return indexes.get(content).get(id);
}
// An assignment carries an itinerary, not omniscient destination coordinates.
// Resolve semantic sites against the current map. Every inter-region leg
// starts at a physical portal and consumes the authored route duration.
export function advanceActorJourney(state,content,actor,targetId,seconds,{routeIds=[],modes=['foot'],followers=[]}={}){
 const target=worldSite(content,targetId);if(!target)return {failed:'destination-missing'};
 if(seconds<=0)return {};
 const party=followers.map(id=>state.npcs[id]);
 if(party.some(n=>!n||n.hp<=0))return {failed:'party-member-unavailable'};
 if(actor.travel){
  // Only companions who actually departed on this leg may arrive with it.
  if(party.some(n=>!n.travel||n.travel.leaderId!==actor.id||n.travel.departedAt!==actor.travel.departedAt||n.travel.routeId!==actor.travel.routeId))return {failed:'party-separated-in-transit'};
  if(state.time<actor.travel.arrivesAt)return {};
  const destination=content.regions.find(r=>r.id===actor.travel.to);if(!destination)return {failed:'arrival-region-missing'};
  for(const member of [actor,...party]){member.region=destination.id;member.position=[...(destination.spawn||[0,0,0])];member.travel=null;member.path=[];delete member.pathTarget;}
  // Arrival is a real route transition, never same-coordinate proximity.
  return {};
 }
 const region=content.regions.find(r=>r.id===actor.region),budget=seconds/(content.time?.scale||60)*1.55;
 if(party.some(n=>n.travel||n.region!==actor.region))return {failed:'party-not-present'};
 // Follow the leader's last physical position. The leader waits for stragglers;
 // an assignment must never be used to summon a person from another region.
 for(const member of party){
  if(distance(member.position,actor.position)<18&&hasLineOfSight(region,member.position,actor.position))member.journeyFollowObservation={leaderId:actor.id,region:actor.region,position:[...actor.position]};
  const seen=member.journeyFollowObservation;if(seen?.leaderId===actor.id&&seen.region===member.region)followPath(region,member,seen.position,budget*1.2);
 }
 if(party.some(n=>distance(n.position,actor.position)>4||!hasLineOfSight(region,n.position,actor.position)))return {waiting:'party-catching-up'};
 const near=point=>distance(actor.position,point)<3&&hasLineOfSight(region,actor.position,point);
 const together=point=>party.every(n=>distance(n.position,point)<4&&hasLineOfSight(region,n.position,point));
 if(actor.region===target.region){followPath(region,actor,target.position,budget);return {complete:near(target.position)&&together(target.position)};}
 const queue=[{region:actor.region,path:[]}],seen=new Set();let path;
 while(queue.length){const current=queue.shift();if(current.region===target.region){path=current.path;break;}
  if(seen.has(current.region))continue;seen.add(current.region);
  for(const route of content.routes.filter(r=>routeIds.includes(r.id)&&(r.from===current.region||r.to===current.region)&&r.modes.some(m=>modes.includes(m))))
   queue.push({region:route.from===current.region?route.to:route.from,path:[...current.path,route]});
 }
 if(!path?.length)return {failed:'no-known-itinerary'};
 const route=path[0],portal=region.portals.find(p=>p.routeId===route.id);if(!portal)return {failed:'departure-missing'};
 followPath(region,actor,portal.position,budget);
 if(near(portal.position)&&together(portal.position)){
  actor.travel={from:actor.region,to:portal.to,routeId:route.id,mode:route.modes.find(m=>modes.includes(m)),departedAt:state.time,arrivesAt:state.time+route.minutes*60};
  actor.path=[];delete actor.pathTarget;
  for(const member of party){member.travel={...actor.travel,leaderId:actor.id};member.path=[];delete member.pathTarget;}
 }
 return {};
}
