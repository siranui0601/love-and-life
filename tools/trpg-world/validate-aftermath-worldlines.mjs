import fs from 'node:fs/promises';
import {WorldReplay,replay,digest} from './validation/replay.mjs';
import {performAt,prepare,decisionCounts,secureArea} from './validation/action-domain.mjs';
import {walk,travelTo} from './validation/journey.mjs';
const content=JSON.parse(await fs.readFile(new URL('../../src/server/trpg/world/content/world-content.json',import.meta.url),'utf8'));
const kind=process.argv[2]||'mine',out=new URL('./reports/aftermath-worldlines/',import.meta.url);await fs.mkdir(out,{recursive:true});
const r=new WorldReplay(content,{seed:4}),must=result=>{if(result?.error)throw new Error(JSON.stringify(result));return result;};
const visit=(target,type,params={},reason)=>must(performAt(r,target,type,params,reason));
const object=id=>r.view().region.objects.find(o=>o.id===id);
async function speakNearby() {
 for(const npc of r.view().npcs.filter(n=>n.hp>0).slice(0,3)) {
  visit(npc,'interact',{action:'talk'},'近くにいる住民から話を聞く');
  const ask=r.options().find(o=>o.intent==='ASK_ABOUT'&&o.command.intentId.startsWith('ask:'));
  if(ask)must(r.select(ask,'相手が知っている話題について尋ねる'));
  const leave=r.options().find(o=>o.intent==='LEAVE');if(leave)must(r.select(leave,'話を終えて生活に戻る'));
  if(r.view().leads.some(l=>l.id.startsWith('lead:site:')))return true;
 }
 return false;
}
function liveCycle() {
 const inn=r.view().region.objects.find(o=>o.kind==='inn'),market=r.view().region.objects.find(o=>o.kind==='shop');
 if(!r.view().services.some(s=>s.id===market.id))visit(market,'interact',{action:'inspect'},'食料と仕事を店頭で確かめる');
 else visit(market,null,{},'知っている仕事場へ歩く');
 let job=r.options().find(o=>o.command.type==='work');
 if(!job)for(const place of r.view().region.objects.filter(o=>['job','board','trainer'].includes(o.kind))) {
  visit(place,null,{},'生活費を稼げる仕事を現地で探す');job=r.options().find(o=>o.command.type==='work');if(job)break;
 }
 if(!job)throw new Error('FIRST_MISSING_AFFORDANCE: local paid work');must(r.select(job,'仕事で食費と宿代を稼ぐ'));
 must(prepare(r,{items:{supplies:1},gold:8}));visit(inn,null,{},'仕事場から宿へ戻り、食事のできる場所へ移る');const food=r.options().find(o=>o.command.type==='eat'&&!o.command.targetId);if(!food)throw new Error('FIRST_MISSING_AFFORDANCE: safe meal');must(r.select(food,'仕事を終え、食事を取る'));
 visit(inn,'rest',{},'宿で休み、次の日の暮らしに備える');
}
let failure,split;
try {
 r.advance(.5);
 // Explicit structural travel prefix. Discovery and response below use public
 // observations only; this is not advertised as a blind inter-region planner.
 if(kind==='mine')must(travelTo(r,'dwarf'));
 if(kind==='prevention') {
  visit(object('LOC_FARM_GRANARY'),'interact',{action:'inspect'},'穀倉で危険な油を確かめる');
  const option=r.options().find(o=>o.command.type==='maintain'&&o.command.action==='remove-fuel');if(!option)throw new Error('FIRST_MISSING_AFFORDANCE: fuel cleanup');must(r.select(option,'見つけた油を片付ける'));
 } else {
  let discovered=false;
  for(let cycle=0;cycle<12&&!discovered;cycle++){liveCycle();discovered=await speakNearby();}
  if(!discovered)throw new Error('FIRST_MISSING_AFFORDANCE: spoken aftermath discovery');
  const lead=r.view().leads.find(l=>l.id.startsWith('lead:site:'));must(r.command({type:'track',leadId:lead.id}));visit(object(lead.targetId),'interact',{action:'inspect'},'聞いた話の現場を自分で調べる');
  // Plan only from the local server's available physical work. Conditions, not
  // event identities, determine what must be repaired first.
  for(let step=0;step<8;step++) {
   const target=r.view().interactables.find(t=>t.id===lead.targetId),work=target?.actions.find(a=>a.type==='maintain');if(!work)break;
   must(prepare(r,work.requirements));visit(object(lead.targetId),'maintain',{action:work.id},work.label);
  }
  must(secureArea(r));
  visit(object(lead.targetId),null,{},'周囲の危険から離れ、声を聞いた現場へ戻る');
  const patients=r.view().npcs.filter(n=>n.condition&&!n.condition.treated);
  for(const patient of patients) {
   must(prepare(r,{items:{medicine:1}}));visit(patient,'causal',{action:'tend'},'見かけた負傷者へ近づき、手当てする');visit(r.view().npcs.find(n=>n.id===patient.id),'causal',{action:'escort'},'本人が伝えた休める場所へ付き添う');
   const home=r.view().leads.find(l=>l.targetId===patient.id&&l.expectedAction==='escort-arrival');if(!home)throw new Error('FIRST_MISSING_AFFORDANCE: requested refuge');
   split??={operation:r.operations.length,state:JSON.parse(JSON.stringify(r.state))};
   must(r.command({type:'track',leadId:home.id}));must(walk(r,home.position));for(let i=0;i<45&&r.view().arrival?.status==='waiting-companion';i++)r.advance(1);
  }
  for(let cycle=0;cycle<8&&r.view().day<5;cycle++)liveCycle();
 }
 if(r.view().player.collapse?.status==='active')throw new Error('PLAYER_COLLAPSED');
}catch(error){failure=error.message;}
const record=r.export();await fs.writeFile(new URL(kind+'-replay.json',out),JSON.stringify(record));await fs.writeFile(new URL(kind+'-trace.json',out),JSON.stringify(r.trace,null,2));
const restored=replay(content,record);let restartEqual=null;
if(split){const suffix={...record,initialState:split.state,operations:record.operations.slice(split.operation)};restartEqual=digest(replay(content,suffix).state)===digest(r.state);}
const rescueDemonstrated=Object.values(r.state.structures).some(s=>s.recoveries?.length);
if(kind==='mine'&&!rescueDemonstrated)failure||='ACCEPTANCE_NOT_REACHED: no actual survivor recovery';
const result={kind,layer:'structural travel prefix, public local life/discovery/response',firstMissing:failure||null,defects:r.defects,counts:decisionCounts(record),day:r.view().day,clock:r.view().clock,hp:r.view().player.hp,replayEqual:digest(restored.state)===digest(r.state),intermediateRestartEqual:restartEqual,rescueDemonstrated,structures:r.state.structures,events:Object.fromEntries(Object.entries(r.state.events).map(([id,e])=>[id,{status:e.status,componentStatus:e.causal.componentStatus}]))};
await fs.writeFile(new URL(kind+'-summary.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failure||r.defects.length||!result.replayEqual||restartEqual===false?1:0;
