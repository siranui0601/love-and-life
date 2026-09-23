import fs from 'node:fs';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {walk,travelTo} from './validation/journey.mjs';
import {prepare,performAt,secureArea,decisionCounts} from './validation/action-domain.mjs';
import {processSafe} from '../../src/shared/trpg-world/processes.js';

// Structural feasibility candidate, deliberately separate from blind play.
// True state selects goals; every mutation goes through the normal command
// interpreter. A bounded failed itinerary is not proof of impossibility.
const content=JSON.parse(fs.readFileSync(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url)));
const name=process.argv[2]||'candidate';if(!/^[a-z-]+$/.test(name))throw new Error('Invalid candidate name');
const run=new WorldReplay(content,{seed:4}),root=new URL('./reports/all-crisis/'+name+'/',import.meta.url);fs.mkdirSync(root,{recursive:true});
const must=r=>{if(r?.error)throw Object.assign(new Error('FIRST_MISSING_AFFORDANCE'),{detail:r});return r;};
const entity=id=>{const npc=run.state.npcs[id];if(npc)return {id,region:npc.region,position:[...npc.position]};for(const region of content.regions){const o=region.objects.find(o=>o.id===id);if(o)return {...o,region:region.id};}throw new Error('Missing semantic entity '+id);};
function arrive(id){const t=entity(id);must(travelTo(run,t.region));must(performAt(run,t,null));must(secureArea(run));must(performAt(run,entity(id),null));return entity(id);}
function inspect(id){must(performAt(run,arrive(id),'interact',{action:'inspect'}));}
function ready(requirements){
 for(const kind of ['shop','trainer','board']){const place=run.view().region.objects.find(o=>o.kind===kind&&!run.view().services.some(s=>s.id===o.id));if(place)inspect(place.id);}
 must(prepare(run,requirements));
}
function action(id,type,action){arrive(id);let option=run.options().find(o=>o.command.type===type&&o.command.targetId===id&&o.command.action===action);
 if(!option){const offered=run.view().interactables.find(t=>t.id===id)?.actions.find(a=>a.type===type&&a.id===action);if(!offered)throw Object.assign(new Error('FIRST_MISSING_AFFORDANCE'),{detail:{id,type,action}});ready(offered.requirements||{});arrive(id);option=run.options().find(o=>o.command.type===type&&o.command.targetId===id&&o.command.action===action);}
 if(!option)throw Object.assign(new Error('FIRST_MISSING_AFFORDANCE'),{detail:{id,type,action,reason:'prepared action unavailable'}});must(run.select(option,'現場の通常行動を実行する'));
}
function live(){
 if(run.state.player.hunger>50){ready({items:{supplies:1}});const meal=run.options().find(o=>o.command.type==='eat'&&!o.command.targetId);if(meal)must(run.select(meal,'旅支度として食事を取る'));}
 if(run.state.player.fatigue>65){const inn=run.view().region.objects.find(o=>o.kind==='inn');if(!inn)throw new Error('NO_LOCAL_LODGING');ready({gold:8});must(performAt(run,arrive(inn.id),'rest'));}
}
const tasks=[...content.causalScenarios.map(s=>({kind:s.type,spec:s,eventId:s.eventId})),...content.processes.map(s=>({kind:'process',spec:s,eventId:s.eventId}))];
tasks.sort((a,b)=>content.events.find(e=>e.id===a.eventId).deadline-content.events.find(e=>e.id===b.eventId).deadline);
let failure,current;run.command({type:'resume'});run.advance(.5);
try{for(let taskIndex=0;taskIndex<tasks.length;taskIndex++){const task=tasks[taskIndex];current=task;const s=task.spec;live();console.log(JSON.stringify({task:s.id||s.type,eventId:s.eventId,day:run.view().day,clock:run.view().clock}));
 // A person still at home needs no rescue. Do the next real task instead of
 // waiting for a hidden timestamp or inventing a premature escort command.
 if(task.kind==='return-person'&&run.state.events[s.eventId].causal.phase==='home'){
  if(taskIndex+1>=tasks.length)throw new Error('NO_CURRENT_RESCUE_NEED');tasks.splice(taskIndex+2,0,task);continue;
 }
 if(task.kind==='process'){
  if(processSafe(run.state,s))continue;
  if(s.kind==='inquiry')for(const doc of s.documents)inspect(doc.targetId);
  arrive(s.targetId);action(s.targetId,'process',s.id+'/inspect');
  for(let count=0;count<24&&!processSafe(run.state,s);count++){
   arrive(s.targetId);const offer=run.view().interactables.find(t=>t.id===s.targetId)?.actions.find(a=>a.type==='process'&&a.id.startsWith(s.id+'/')&&!a.id.endsWith('/inspect'));
   if(offer){action(s.targetId,'process',offer.id);continue;}
   if(s.structureId){const work=run.view().interactables.find(t=>t.id===s.targetId)?.actions.find(a=>a.type==='maintain');if(work){action(s.targetId,'maintain',work.id);continue;}}
   // Issuance is not execution. Do real local work while the official acts.
   const job=content.jobs.find(j=>j.region===run.state.player.region&&j.facilityId);if(s.kind==='inquiry'&&job){must(performAt(run,arrive(job.facilityId),'work'));live();continue;}
   break;
  }
 }else if(task.kind==='infrastructure'){
  for(const id of s.structures){const physical=content.structures.find(x=>x.id===id);inspect(physical.targetId);for(const work of physical.actions){arrive(physical.targetId);if(run.view().interactables.find(t=>t.id===physical.targetId)?.actions.some(a=>a.type==='maintain'&&a.id===work.id))action(physical.targetId,'maintain',work.id);}}
 }else if(task.kind==='ecosystem'){inspect(s.deviceId);for(const verb of ['divert','seal'])action(s.deviceId,'causal',verb+':'+s.eventId);
 }else if(task.kind==='institution'){for(const doc of s.documents)action(doc.targetId,'causal',`read:${s.eventId}:${doc.id}`);action(s.officeId,'causal','submit:'+s.eventId);
 }else if(task.kind==='return-person'){
  ready({items:{medicine:3},skills:['magic']});arrive(s.personId);
  if(run.view().interactables.find(t=>t.id===s.personId)?.actions.some(a=>a.id==='tend'))action(s.personId,'causal','tend');
  action(s.personId,'causal','escort');arrive(s.familyId);run.command({type:'resume'});
  for(let seconds=0;seconds<45&&run.state.npcs[s.personId].companionOf==='player';seconds++)run.advance(1);
  if(run.state.events[s.eventId].causal.phase!=='reunited')throw new Error('FAMILY_HANDOFF_NOT_COMPLETED');
 }
 fs.writeFileSync(new URL('checkpoint.json',root),JSON.stringify({task,record:run.export(),state:run.state}));
 if(Object.values(run.state.events).some(e=>e.status==='failed'))throw new Error('CANDIDATE_MISSED_A_CAUSAL_OUTCOME');
 }}catch(error){failure={status:'NO_CERTIFICATE_FROM_THIS_CANDIDATE',task:current,error:error.message,detail:error.detail,scope:'Earliest-deadline candidate over current endpoints; no claim of physical impossibility or complete authored causal implementation.'};}
const record=run.export();fs.writeFileSync(new URL('candidate-record.json',root),JSON.stringify(record));fs.writeFileSync(new URL('candidate-state.json',root),JSON.stringify(run.state));
const summary={certificate:false,failure,day:run.view().day,clock:run.view().clock,counts:decisionCounts(run),outcomes:Object.fromEntries(Object.entries(run.state.events).map(([id,e])=>[id,{status:e.status,causal:e.causal.componentStatus}])),readiness:'PARTIAL_CONTENT_NOT_PHASE2_COMPLETE',defects:run.defects};
fs.writeFileSync(new URL('candidate-summary.json',root),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
summary.replay=digest(replay(content,record).state)===digest(run.state);fs.writeFileSync(new URL('candidate-summary.json',root),JSON.stringify(summary,null,2));console.log(JSON.stringify({replay:summary.replay}));
