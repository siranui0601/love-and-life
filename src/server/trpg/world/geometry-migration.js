import {canOccupy,pathIsTraversable} from '../../../shared/trpg-world/navigation.js';

// Only called after an explicitly hash-reviewed content migration. Historical
// observations retain their original coordinates. Current bodies are moved at
// most a few metres if replaceable scenery now overlaps them; never to an inn,
// target site, another region or a route endpoint.
export function reconcileGeometry(state,content){
 const changes=[];
 for(const actor of [state.player,...Object.values(state.npcs||{}),...Object.values(state.monsters||{})]){
  const region=content.regions.find(r=>r.id===actor.region);if(!region)throw new Error('Missing geometry region');
  if(!actor.travel&&!canOccupy(region,actor.position)){
   let point;
   for(let radius=.5;radius<=8&&!point;radius+=.5)for(let i=0;i<32;i++){
    const p=[actor.position[0]+Math.cos(i*Math.PI/16)*radius,actor.position[1],actor.position[2]+Math.sin(i*Math.PI/16)*radius];
    if(canOccupy(region,p)){point=p;break;}
   }
   if(!point)throw new Error(`Geometry migration requires manual placement for ${actor.id}`);
   changes.push({actor,from:[...actor.position],to:point});
  }
 }
 for(const {actor,to} of changes)actor.position=to;
 for(const actor of Object.values(state.npcs||{}).concat(Object.values(state.monsters||{}))){
  const region=content.regions.find(r=>r.id===actor.region);
  if(!actor.travel&&!pathIsTraversable(region,actor.position,actor.path||[])){actor.path=[];delete actor.pathTarget;}
 }
 return changes.map(({actor,from,to})=>({actorId:actor.id,region:actor.region,from,to}));
}
