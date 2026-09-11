import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {runPolicy,structuralSearch,travelTo,walk} from './validation/journey.mjs';
import {WorldReplay,digest,replay} from './validation/replay.mjs';
const content=JSON.parse(await fs.readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
const directory=new URL('./reports/worldline-validation/',import.meta.url);await fs.mkdir(directory,{recursive:true});
const summaries=[];
for(const name of ['blind-explorer','evidence-first','dialogue-first','chaotic']) {
 const result=runPolicy(content,name,{seed:4,decisions:10});
 await fs.writeFile(new URL(`${name}-trace.json`,directory),JSON.stringify(result.run.trace,null,2));
 await fs.writeFile(new URL(`${name}-replay.json`,directory),JSON.stringify(result.run.export()));
 summaries.push({name,stopped:result.stopped,...result.summary});console.log(JSON.stringify(summaries.at(-1)));
}
const representatives=[];
for(const definition of content.causalScenarios) {
 const preparation=new WorldReplay(content,{seed:4});preparation.advance(.5);
 const event=content.events.find(e=>e.id===definition.eventId),travel=travelTo(preparation,event.region);
 if(travel.error){representatives.push({type:definition.type,preparation:travel});continue;}
 const scene=preparation.view().region.objects.find(o=>o.kind==='evidence');
 const moved=walk(preparation,scene?.position||event.position);
 if(moved.error){representatives.push({type:definition.type,preparation:moved});continue;}
 if(scene)preparation.command({type:'interact',targetId:scene.id,action:'inspect'});
 const local=[];
 for(const name of ['evidence-first','dialogue-first']) {
  const result=runPolicy(content,name,{initialState:preparation.state,decisions:12});local.push({name,stopped:result.stopped,...result.summary});
  await fs.writeFile(new URL(`${definition.type}-${name}-trace.json`,directory),JSON.stringify(result.run.trace,null,2));
 }
 const solved=s=>['resolved','prevented'].includes(s.events[event.id].status)||['resolved','prevented'].includes(s.events[event.id].causal.componentStatus);
 const estimate=s=>definition.type==='institution'?definition.documents.filter(d=>!s.knowledge.some(k=>k.id===`document:${event.id}:${d.id}`)).length*100+(definition.documents.length-s.events[event.id].causal.submitted.length)*10:0;
 const solver=structuralSearch(content,preparation.state,solved,{maxNodes:16,maxDepth:10,estimate});
 if(solver.run){await fs.writeFile(new URL(`${definition.type}-solver-trace.json`,directory),JSON.stringify(solver.run.trace,null,2));await fs.writeFile(new URL(`${definition.type}-solver-replay.json`,directory),JSON.stringify(solver.run.export()));}
 const item={type:definition.type,discovered:preparation.view().knownEvents.map(e=>e.name),aware:local,structural:{status:solver.status,expanded:solver.expanded,rejected:solver.rejected,scope:solver.scope}};representatives.push(item);console.log(JSON.stringify(item));
}
const unimplemented=content.events.filter(e=>!e.causalSourceIds?.length||e.causalStatus==='unadapted').map(e=>({id:e.id,name:e.name,reason:'current-unimplemented-event'}));
const partial=content.events.filter(e=>e.causalSourceIds?.length&&e.sourceIds.some(id=>!e.causalSourceIds.includes(id))).map(e=>({id:e.id,name:e.name,reason:'unimplemented-components',covered:e.causalSourceIds,missing:e.sourceIds.filter(id=>!e.causalSourceIds.includes(id))}));
const report={sourceRevision:content.revision,summaries,representatives,allTroubleFeasibility:{status:unimplemented.length||partial.length?'BLOCKED_BY_UNIMPLEMENTED_CONTENT':'NOT_SEARCHED',unimplemented,partial,
 explanation:'No all-resolution certificate: runtime has no resolution transitions for these components. This is not evidence that the ten-day design is mathematically impossible.'},paidLLMCalls:0};
await fs.writeFile(new URL('summary.json',directory),JSON.stringify(report,null,2));console.log(fileURLToPath(new URL('summary.json',directory)));
