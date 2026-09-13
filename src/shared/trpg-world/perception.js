import {observedDestination} from './observed-destination.js';
import {distance,hasLineOfSight} from './navigation.js';
import {playerIsLocal} from './activity.js';

// Scene meshes are needed by the renderer, but are not discovered geography.
// This server projection is the only environment input to blind policies.
export function playerPerception(state,content,view){
 const p=state.player,region=content.regions.find(r=>r.id===p.region);
 p.observedPlaces||={};p.observedExits||={};
 const conscious=p.hp>0&&playerIsLocal(state)&&p.activity?.kind!=='sleeping'&&p.activity?.kind!=='recovering';
 const visible=position=>conscious&&distance(p.position,position)<=45&&hasLineOfSight(region,p.position,position);
 for(const object of view.region.objects)if(visible(object.position))p.observedPlaces[object.id]={id:object.id,name:object.name,kind:object.kind,region:region.id,position:[...object.position],source:'seen'};
 for(const portal of region.portals||[])if(visible(portal.position)){
  // The sign at this exit identifies its endpoint, not the destination's other roads.
  p.observedExits[portal.id]={id:portal.id,name:`${content.regions.find(r=>r.id===portal.to)?.name||'隣の地域'}への街道`,kind:'portal',region:region.id,position:[...portal.position],source:'seen-road-sign'};
 }
 const places=Object.values(p.observedPlaces).filter(o=>o.region===p.region),exits=Object.values(p.observedExits).filter(o=>o.region===p.region);
 const personalKeys=['region','position','hp','maxHp','mp','maxMp','hunger','fatigue','gold','inventory','skills','sp','level','mode','activity','actionInstance','guarding','collapse','equipment'];
 const self=Object.fromEntries(personalKeys.filter(k=>p[k]!==undefined).map(k=>[k,structuredClone(p[k])]));
 // Action instances expose only the actor's own phase, never a hidden target plan.
 if(self.actionInstance)self.actionInstance={phase:self.actionInstance.phase};
 if(self.activity)self.activity={kind:self.activity.kind,worldTimePolicy:self.activity.worldTimePolicy};
 return {day:view.day,clock:view.clock,time:view.time,region:{id:region.id,name:region.name,size:region.size},self,
  places:structuredClone(places),exits:structuredClone(exits),people:structuredClone(view.npcs),monsters:structuredClone(view.monsters),
  services:structuredClone(view.services.filter(s=>s.region===p.region)),notes:structuredClone(view.notes),
  inspections:Object.entries(p.inspections||{}).filter(([id])=>places.some(o=>o.id===id)).map(([id,entry])=>({id,text:entry.text})),
  directions:state.knowledge.filter(k=>['site-observation','testimony'].includes(k.kind)&&k.destination).map(k=>({text:k.text,destination:observedDestination(state,content,k),source:structuredClone(k.source)})),
  // Local geometry may guide footsteps around walls already within sight range;
  // it contains no regional edges, future scenes or event solution positions.
  obstacles:conscious?(region.obstacles||[]).filter(o=>Math.hypot(o.x-p.position[0],o.z-p.position[2])<45).map(o=>({...o})):[]};
}
