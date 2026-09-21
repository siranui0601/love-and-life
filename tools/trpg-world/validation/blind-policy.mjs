// No imports from simulation, content, topology, or replay. This function can
// run in a separate process with ONLY the JSON observation and its own memory.
// Edges are learned only by actually travelling, never fetched from topology.
function rememberedExit(memory,from,to){const queue=[{region:from,first:null}],seen=new Set();while(queue.length){const n=queue.shift();if(n.region===to)return n.first;if(seen.has(n.region))continue;seen.add(n.region);for(const edge of memory.roads||[])if(edge.from===n.region)queue.push({region:edge.to,first:n.first||edge.exit});}return null;}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
export function chooseBlind(o,m){
 m.visited||=[];m.asked||=[];m.attempted||=[];m.travelled||=[];
 const p=o.self,actions=o.actions,act=a=>({action:a.key,reason:a.label}),walk=t=>({walk:t.position,target:t.id,reason:`見聞きした場所へ歩く：${t.name||t.text||'現場'}`});
 m.roads||=[];if(m.departure&&m.departure.from!==p.region){m.roads.push({...m.departure,to:p.region});delete m.departure;}
 const travelVia=route=>{const offers=actions.filter(a=>a.available&&a.type==='travel'&&a.targetId===route.id),travel=offers.find(a=>a.mode==='foot')||offers.sort((a,b)=>(a.price||0)-(b.price||0)||(a.minutes||0)-(b.minutes||0))[0];if(travel){m.travelled.push(route.id);m.departure={from:p.region,exit:structuredClone(route)};return act(travel);}return dist(route.position,p.position)<1?{stop:'known-exit-without-affordable-transport'}:walk(route);};
 const ready=actions.filter(a=>a.available),find=(type,verb)=>ready.find(a=>a.type===type&&(!verb||a.verb===verb));
 const danger=o.monsters.filter(n=>n.activity==='attack'||dist(n.position,p.position)<12);
 if(p.collapse?.status==='active'){const a=find('recover');return a?act(a):{stop:'collapsed-without-current-help'};}
 if(danger.length||p.actionInstance){
  if(p.activity.worldTimePolicy==='paused')return {resume:true};
  if(p.hp<p.maxHp*.5&&find('use'))return act(find('use'));
  if(p.actionInstance)return {seconds:.2,reason:'既に始めた攻撃動作を続ける'};
  const attack=find('attack');if(attack)return act(attack);
  const enemy=danger.sort((a,b)=>dist(a.position,p.position)-dist(b.position,p.position))[0];
  if(enemy&&dist(enemy.position,p.position)>3)return {step:enemy.position,reason:'目の前の脅威へ間合いを詰める'};
  return {seconds:.2,reason:'戦闘の次の動作を待つ'};
 }
 if(o.conversation){
  const question=ready.find(a=>a.type==='conversation'&&!m.asked.includes(a.key)&&(a.family==='ask'||a.intent==='ASK_ABOUT'));
  if(question){m.asked.push(question.key);return act(question);}
  const leave=ready.find(a=>a.verb==='leave'||a.intent==='LEAVE');return leave?act(leave):{stop:'conversation-without-leave'};
 }
 const hour=Number(o.clock.split(':')[0]);
 if(p.hunger>55){const eat=find('eat');if(eat)return act(eat);m.need={items:{supplies:2}};}
 if(p.fatigue>65||hour>=22||hour<6){const rest=find('rest');if(rest)return act(rest);const inn=o.places.find(t=>t.kind==='inn');if(inn)return walk(inn);}
 // An observed injured person takes priority over wages. No hidden person list.
 const tend=find('causal','tend');if(tend)return act(tend);
 const escort=ready.find(a=>a.type==='causal'&&a.verb==='escort'&&!m.attempted.includes(a.key));if(escort){m.attempted.push(escort.key);return act(escort);}
 const home=o.directions.find(d=>/送り|家族|帰|休め/.test(d.text));if(home&&home.destination.region===p.region&&!m.visited.includes('delivery:'+home.destination.targetId)){
  if(dist(home.destination.position,p.position)>3)return walk({...home,id:home.destination.targetId,position:home.destination.position});m.visited.push('delivery:'+home.destination.targetId);
 }
 // Work on an observed problem, and decompose its publicly offered requirements.
 // One traveller's priorities: help people and fix failures, but leave intact
 // machinery alone. This may miss a preventable crisis; no hidden deadline.
 const knownDamage=o.inspections.some(i=>/燃えて|炎|崩落|閉鎖|後始末/.test(i.text));
 const job=actions.find(a=>(!m.task||m.task.key===a.key)&&!m.attempted.includes(a.key)&&(
  a.type==='process'&&a.verb!=='inspect'&&(knownDamage||a.verb==='treat'||a.verb==='submit')||
  a.type==='maintain'&&knownDamage||a.type==='causal'&&['divert','seal','submit'].includes(a.verb)));
 if(job){if(job.available){m.attempted.push(job.key);m.need=null;m.task=null;return act(job);}const target=[...o.people,...o.places].find(t=>t.id===job.targetId);if(target)m.task={key:job.key,requirements:structuredClone(job.requirements),target:{...target,region:p.region}};}
 if(m.task&&p.hunger<=55)m.need=m.task.requirements;
 if(m.need){
  const item=Object.entries(m.need.items||{}).find(([id,n])=>(p.inventory[id]||0)<n),skill=(m.need.skills||[]).find(id=>!p.skills.includes(id));
  if(p.gold<(m.need.gold||0)){const work=find('work');if(work)return act(work);const employer=o.services.find(s=>s.offers.some(a=>a.type==='work'));if(employer)return walk(employer);}
  if(item||skill){const type=item?'buy':'train',key=item?'itemId':'skillId',id=item?item[0]:skill;
   const offer=ready.find(a=>a.type===type&&a[key]===id);if(offer)return act(offer);
   const service=o.services.find(s=>s.offers.some(a=>a.type===type&&a[key]===id));
   if(service&&dist(service.position,p.position)>3)return walk(service);
   if(service){const work=find('work');if(work)return act(work);const employer=o.services.find(s=>s.offers.some(a=>a.type==='work'));if(employer)return walk(employer);}
   const unexplored=o.places.find(t=>(item?['shop','stable']:['trainer']).includes(t.kind)&&!o.services.some(s=>s.id===t.id));if(unexplored&&dist(unexplored.position,p.position)>3)return walk(unexplored);
   // Keep looking, rather than granting the missing resource or skill.
  }else m.need=null;
 }
 if(m.task&&!m.need){
  const offered=ready.find(a=>a.key===m.task.key);if(offered){m.attempted.push(offered.key);m.task=null;return act(offered);}
  if(m.task.target.region===p.region){const destination=o.people.find(n=>n.id===m.task.target.id)||m.task.target;if(dist(destination.position,p.position)>3)return walk(destination);return {stop:'prepared-intent-unavailable-at-observed-location'};}
  const exit=rememberedExit(m,p.region,m.task.target.region);if(exit)return travelVia(exit);
 }
 const inspect=ready.find(a=>a.type==='interact'&&a.verb==='inspect'&&!m.visited.includes(a.targetId));
 if(inspect){m.visited.push(inspect.targetId);return act(inspect);}
 const processInspect=ready.find(a=>a.type==='process'&&a.verb==='inspect'&&!m.attempted.includes(a.key));if(processInspect){m.attempted.push(processInspect.key);return act(processInspect);}
 const talk=ready.find(a=>a.type==='interact'&&a.verb==='talk'&&!m.attempted.includes(a.key));if(talk){m.attempted.push(talk.key);return act(talk);}
 // A modest travel reserve, not a target event day. Replenish spent wages.
 if(p.gold<150){const work=find('work');if(work)return act(work);const employer=o.services.find(s=>s.offers.some(a=>a.type==='work'));if(employer)return walk(employer);}
 const unexplored=o.places.filter(t=>!m.visited.includes(t.id)).sort((a,b)=>dist(a.position,p.position)-dist(b.position,p.position))[0];if(unexplored)return walk(unexplored);
 const heard=o.directions.find(d=>d.destination.region===p.region&&!['not-here','searched-absent'].includes(d.destination.status)&&!m.visited.includes(d.destination.targetId));if(heard)return walk({...heard,id:heard.destination.targetId,position:heard.destination.position});
 const route=o.exits.find(t=>!m.travelled.includes(t.id));if(route)return travelVia(route);
 // Explore the visible street direction, never a fetched destination graph.
 m.bearing??=0;const angle=m.bearing++*Math.PI/3,point=[p.position[0]+18*Math.sin(angle),0,p.position[2]+18*Math.cos(angle)];
 if(Math.abs(point[0])<o.region.size/2-3&&Math.abs(point[2])<o.region.size/2-3)return {walk:point,reason:'まだ歩いていない通りを見て回る'};
 const work=find('work');if(work)return act(work);return {stop:'no-known-purpose-or-safe-direction'};
}
