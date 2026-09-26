import {canOccupy} from './navigation.js';

// Route mouths, not region centres, bind both representations of a journey.
// Old saves with no route ID may only infer a unique known edge; otherwise keep
// their historical spawn behavior until their next fully specified journey.
export function arrivalPosition(content,travel){
 const region=content.regions.find(r=>r.id===travel.to);
 if(!region)throw new Error('Arrival region missing');
 const mouths=(region.portals||[]).filter(p=>travel.routeId?p.routeId===travel.routeId:p.to===travel.from);
 const point=mouths.length===1?mouths[0].position:region.spawn;
 if(!point||!canOccupy(region,point))throw new Error('Arrival mouth inaccessible');
 return [...point];
}

// A common linear reference for travellers, carriers and future physical route
// chunks. It never reveals another actor's location to a player projection.
export function journeyLocation(content,travel,time){
 if(!travel?.routeId||!Number.isFinite(travel.departedAt)||travel.arrivesAt<=travel.departedAt)return null;
 const route=content.routes.find(r=>r.id===travel.routeId);if(!route)return null;
 const elapsed=Math.max(0,Math.min(1,(time-travel.departedAt)/(travel.arrivesAt-travel.departedAt)));
 const progress=travel.from===route.from?elapsed:1-elapsed;
 const sections=route.spatial?.sections||[{id:route.id,share:1}];let start=0;
 const section=sections.find(s=>{start+=s.share;return progress<=start;})||sections.at(-1);
 return {corridorId:route.spatial?.id||route.id,sectionId:section.id,progress,mode:travel.mode};
}
