import {distance,hasLineOfSight,followPath} from './navigation.js';

const indexes=new WeakMap();
export function worldSite(content,id){
 if(!indexes.has(content))indexes.set(content,new Map(content.regions.flatMap(r=>r.objects.map(o=>[o.id,{...o,region:r.id}]))));
 return indexes.get(content).get(id);
}
// An assignment carries an itinerary, not omniscient destination coordinates.
// Resolve semantic sites against the current map. Every inter-region leg
// starts at a physical portal and consumes the authored route duration.
export function advanceActorJourney(state,content,actor,targetId,seconds,{routeIds=[],modes=['foot']}={}){
 const target=worldSite(content,targetId);if(!target)return {failed:'destination-missing'};
 if(actor.travel){
  if(state.time<actor.travel.arrivesAt)return {};
  const destination=content.regions.find(r=>r.id===actor.travel.to);if(!destination)return {failed:'arrival-region-missing'};
  actor.region=destination.id;actor.position=[...(destination.spawn||[0,0,0])];actor.travel=null;actor.path=[];delete actor.pathTarget;
  // Arrival is a real route transition, never same-coordinate proximity.
  return {};
 }
 const region=content.regions.find(r=>r.id===actor.region),budget=seconds/(content.time?.scale||60)*1.55;
 const near=point=>distance(actor.position,point)<3&&hasLineOfSight(region,actor.position,point);
 if(actor.region===target.region){followPath(region,actor,target.position,budget);return {complete:near(target.position)};}
 const queue=[{region:actor.region,path:[]}],seen=new Set();let path;
 while(queue.length){const current=queue.shift();if(current.region===target.region){path=current.path;break;}
  if(seen.has(current.region))continue;seen.add(current.region);
  for(const route of content.routes.filter(r=>routeIds.includes(r.id)&&(r.from===current.region||r.to===current.region)&&r.modes.some(m=>modes.includes(m))))
   queue.push({region:route.from===current.region?route.to:route.from,path:[...current.path,route]});
 }
 if(!path?.length)return {failed:'no-known-itinerary'};
 const route=path[0],portal=region.portals.find(p=>p.routeId===route.id);if(!portal)return {failed:'departure-missing'};
 followPath(region,actor,portal.position,budget);
 if(near(portal.position)){
  actor.travel={from:actor.region,to:portal.to,routeId:route.id,mode:route.modes.find(m=>modes.includes(m)),departedAt:state.time,arrivesAt:state.time+route.minutes*60};
  actor.path=[];delete actor.pathTarget;
 }
 return {};
}
