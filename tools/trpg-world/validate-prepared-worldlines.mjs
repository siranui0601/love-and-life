import fs from 'node:fs/promises';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {walk,travelTo} from './validation/journey.mjs';
import {prepare,performAt,engage,secureArea,decisionCounts} from './validation/action-domain.mjs';
const content=JSON.parse(await fs.readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
const out=new URL('./reports/prepared-worldlines/',import.meta.url);await fs.mkdir(out,{recursive:true});
const required=result=>{if(result?.error)throw Object.assign(new Error(JSON.stringify(result)),{detail:result});return result;};
const place=(run,id)=>run.view().region.objects.find(o=>o.id===id);
const act=(run,id,type,parameters={},reason)=>required(performAt(run,place(run,id),type,parameters,reason));
async function scenario(name,play) {
 const run=new WorldReplay(content,{seed:4});run.advance(.5);let failure;
 try {await play(run);if(run.view().player.collapse?.status==='active')throw new Error('PLAYER_COLLAPSED: objective may have progressed but player still needs rescue');}catch(error){failure=error.detail||{error:error.message};}
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
if(!process.argv[2]||['rescue','life'].includes(process.argv[2]))results.push(await scenario(process.argv[2]==='life'?'life':'rescue',async run=>{
 act(run,'LOC_FARM_FIELD','interact',{action:'inspect'},'仕事場で今日できる作業を聞く');
 const job=run.options().find(o=>o.command.type==='work'&&o.command.targetId==='LOC_FARM_FIELD');if(!job)throw new Error('FIRST_MISSING_AFFORDANCE: farm work');required(run.select(job,'旅費を得るために畑仕事をする'));
 required(prepare(run,{items:{medicine:3},skills:['magic']}));
 act(run,'evidence:lost-road','interact',{action:'inspect'},'村外れで途絶えた足跡を調べる');
 run.command({type:'resume'});
 const threat=run.view().monsters.find(m=>m.id==='opposition:lost-road');if(threat)required(engage(run,threat.id));
 const searchSite=run.view().leads.find(l=>l.expectedAction==='inspect'&&l.targetId==='event:lost-road');
 if(searchSite){required(run.command({type:'track',leadId:searchSite.id}));required(walk(run,searchSite.position));const inspect=run.options().find(o=>o.command.targetId===searchSite.targetId&&o.command.action==='inspect');if(inspect)required(run.select(inspect,'足跡から分かった捜索場所を確かめる'));}
 required(secureArea(run));
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
 if(process.argv[2]==='life')for(let cycle=0;cycle<8&&run.view().day<4;cycle++) {
  required(prepare(run,{items:{supplies:1},gold:8}));
  const meal=run.options().find(o=>o.command.type==='eat'&&!o.command.targetId);if(meal)required(run.select(meal,'次の休息に備えて携帯食を食べる'));
  act(run,'LOC_FARM_INN','rest',{},'宿で眠り、翌日の暮らしに備える');
  act(run,'LOC_FARM_FIELD','work',{},'畑仕事で食事と宿代を稼ぐ');
 }
}));
if(!process.argv[2]||process.argv[2]==='mine')results.push(await scenario('mine',async run=>{
 required(travelTo(run,'dwarf'));act(run,'evidence:deep-mine','interact',{action:'inspect'},'坑道から出てきた水と岩片を調べる');act(run,'LOC_DWARF_MINE','interact',{action:'inspect'},'採掘坑道の入口で支柱と水位を調べる');
 for(const id of ['close-access','drain','shore']) {
  required(walk(run,place(run,'LOC_DWARF_MINE').position));const offer=run.view().interactables.find(t=>t.id==='LOC_DWARF_MINE').actions.find(a=>a.id===id);if(!offer)throw new Error('FIRST_MISSING_AFFORDANCE: maintenance');
  required(prepare(run,offer.requirements));act(run,'LOC_DWARF_MINE','maintain',{action:id},offer.label);
 }
 if(!['resolved','prevented'].includes(run.state.events['deep-mine'].status))throw new Error('infrastructure did not prevent collapse');
}));
await fs.writeFile(new URL(process.argv[2]?`summary-${process.argv[2]}.json`:'summary.json',out),JSON.stringify(results,null,2));
