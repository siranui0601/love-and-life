import {followPath} from './navigation.js';

export function habitatFor(content,monster){
 return content.regions.find(r=>r.id===monster.region)?.habitats?.find(h=>h.id===monster.habitatId);
}
export function habitatActivity(state,content,monster,seconds){
 const habitat=habitatFor(content,monster);if(!habitat)return false;
 const region=content.regions.find(r=>r.id===monster.region),hour=(state.time%86400)/3600;
 const active=habitat.activeHours.some(([start,end])=>hour>=start&&hour<end);
 const rain=['rain','storm'].includes(state.weather?.[monster.region]?.type);
 const role=!active||rain?'nest':hour%4<1?'water':'food';
 const target=habitat[role];monster.activity=role==='nest'?'rest':role==='water'?'drink':'forage';
 monster.ecologicalDestination=role;
 followPath(region,monster,target,seconds/(content.time?.scale||60)*1.2);
 return true;
}
