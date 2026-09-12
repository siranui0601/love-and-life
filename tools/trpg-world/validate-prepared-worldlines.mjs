import fs from 'node:fs/promises';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {walk,travelTo} from './validation/journey.mjs';
import {prepare,performAt,engage,decisionCounts} from './validation/action-domain.mjs';
const content=JSON.parse(await fs.readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
const out=new URL('./reports/prepared-worldlines/',import.meta.url);await fs.mkdir(out,{recursive:true});
const required=result=>{if(result?.error)throw Object.assign(new Error(JSON.stringify(result)),{detail:result});return result;};
const place=(run,id)=>run.view().region.objects.find(o=>o.id===id);
const act=(run,id,type,parameters={},reason)=>required(performAt(run,place(run,id),type,parameters,reason));
async function scenario(name,play) {
 const run=new WorldReplay(content,{seed:4});run.advance(.5);let failure;
 try {await play(run);}catch(error){failure=error.detail||{error:error.message};}
 const record=run.export();await fs.writeFile(new URL(`${name}-replay.json`,out),JSON.stringify(record));await fs.writeFile(new URL(`${name}-trace.json`,out),JSON.stringify(run.trace,null,2));
 const repeated=replay(content,JSON.parse(JSON.stringify(record)));
 const result={name,counts:decisionCounts(record),worldTime:run.state.time,day:run.view().day,health:run.view().player.hp,skills:run.view().player.skills,inventory:run.view().player.inventory,defects:run.defects,firstMissing:failure||null,replayEqual:digest(repeated.state)===digest(run.state),causal:Object.fromEntries(Object.entries(run.state.events).map(([id,e])=>[id,{status:e.status,componentStatus:e.causal.componentStatus,phase:e.causal.phase,milestones:e.causal.milestones}]))};
 console.log(JSON.stringify(result));return result;
}
const results=[];
if(!process.argv[2]||process.argv[2]==='ecology')results.push(await scenario('ecology',async run=>{
 // Travel and investigate before choosing preparation: no acquired clue injection.
 required(travelTo(run,'capital'));act(run,'LOC_CAP_MARKET','interact',{action:'inspect'},'街の市場で扱っている品を確かめる');
 required(travelTo(run,'forest'));act(run,'evidence:roots','interact',{action:'inspect'},'目に留まった現場の痕跡を調べる');act(run,'LOC_FOREST_RIVER','interact',{action:'inspect'},'水路を実際に調べる');
 for(const action of ['divert:roots','seal:roots']) {
  const offered=run.view().interactables.find(t=>t.id==='LOC_FOREST_RIVER')?.actions.find(a=>a.id===action);if(!offered)throw new Error('FIRST_MISSING_AFFORDANCE: waterway action');
  required(prepare(run,offered.requirements));if(run.view().region.id!=='forest')required(travelTo(run,'forest'));
  act(run,'LOC_FOREST_RIVER','causal',{action},'用意した資材と習った技能を、調べた水路で使う');run.command({type:'resume'});run.advance(.5);
 }
 if(!['resolved','prevented'].includes(run.state.events.roots.causal.componentStatus))throw new Error('waterway intervention did not settle the component');
}));
if(!process.argv[2]||process.argv[2]==='rescue')results.push(await scenario('rescue',async run=>{
 act(run,'LOC_FARM_FIELD','interact',{action:'inspect'},'仕事場で今日できる作業を聞く');
 const job=run.options().find(o=>o.command.type==='work'&&o.command.targetId==='LOC_FARM_FIELD');if(!job)throw new Error('FIRST_MISSING_AFFORDANCE: farm work');required(run.select(job,'旅費を得るために畑仕事をする'));
 act(run,'evidence:lost-road','interact',{action:'inspect'},'村外れで途絶えた足跡を調べる');
 run.command({type:'resume'});
 const threat=run.view().monsters.find(m=>m.id==='opposition:lost-road');if(threat)required(engage(run,threat.id));
 const person=run.view().npcs.find(n=>n.id==='NPC001');if(!person)throw new Error('FIRST_MISSING_AFFORDANCE: person not observed at search site');
 required(performAt(run,person,null));
 const treatment=run.view().interactables.find(t=>t.id===person.id)?.actions.find(a=>a.id==='tend');
 if(treatment){required(prepare(run,treatment.requirements));required(performAt(run,run.view().npcs.find(n=>n.id===person.id),'causal',{action:'tend'},'見つけた人の脚を傷薬で手当てする'));}
 required(performAt(run,run.view().npcs.find(n=>n.id===person.id),'causal',{action:'escort'},'本人と一緒に家族のもとへ歩く'));
 const home=run.view().leads.find(l=>l.expectedAction==='escort-arrival');if(!home)throw new Error('FIRST_MISSING_AFFORDANCE: escort destination');
 required(run.command({type:'track',leadId:home.id}));required(walk(run,home.position));
 // Stationary active exploration while the slower companion arrives, bounded.
 for(let seconds=0;seconds<45&&!['resolved','prevented'].includes(run.state.events['lost-road'].causal.componentStatus);seconds++)run.advance(1);
 if(run.state.events['lost-road'].causal.phase!=='reunited')throw new Error('FIRST_MISSING_AFFORDANCE: family handoff');
}));
await fs.writeFile(new URL('summary.json',out),JSON.stringify(results,null,2));
