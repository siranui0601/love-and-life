import {distance,hasLineOfSight} from './navigation.js';
// A report names a last observed location, not a remote tracking device.
// Arrival may establish absence without revealing where the person went.
export function observedDestination(state,content,fact){
 const remembered=fact.destination,p=state.player,region=content.regions.find(r=>r.id===p.region);
 if(!remembered)return null;
 const result={...structuredClone(remembered),status:'last-observed'};
 if(!content.npcs.some(n=>n.id===remembered.targetId)||remembered.region!==p.region)return result;
 const person=state.npcs[remembered.targetId];
 const seen=person&&!person.travel&&!person.entrapment&&person.region===p.region&&distance(person.position,p.position)<90&&hasLineOfSight(region,p.position,person.position);
 if(seen)return {...result,position:[...person.position],status:'visible-now'};
 if(distance(remembered.position,p.position)<4)return {...result,status:'not-here',message:'聞いていた場所には姿が見えない。別の目撃情報を聞くか、周囲を探そう。'};
 return result;
}
