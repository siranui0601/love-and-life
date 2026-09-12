import {distance,hasLineOfSight} from './navigation.js';
// Authored fallback directions, grounded in information the player acquired.
// These are leads, never a route or a promise that an absent person will spawn.
export function investigationLeads(state,content) {
 const leads=[];
 for(const fact of state.knowledge.filter(k=>k.kind==='site-observation'&&k.destination)) {
  const target=fact.destination.targetId;
  if(!state.player.inspections?.[target]||state.player.inspections[target].at<fact.observedAt)leads.push({id:`lead:${fact.id}`,targetId:target,region:fact.destination.region,position:[...fact.destination.position],expectedAction:'inspect',label:'聞いた異変の現場を確かめる',explanation:fact.text,sourceKnowledgeId:fact.id});
 }
 for(const fact of state.knowledge.filter(k=>k.kind==='testimony'&&k.destination&&k.personId))if(state.npcs[fact.personId]?.companionOf==='player')leads.push({id:`lead:${fact.id}:home`,targetId:fact.personId,region:fact.destination.region,position:[...fact.destination.position],expectedAction:'escort-arrival',label:'同行者を家族のもとへ送る',explanation:fact.text,sourceKnowledgeId:fact.id});
 for(const definition of content.causalScenarios||[]) {
  const known=state.knowledge.find(k=>k.kind==='event'&&k.eventId===definition.eventId);if(!known)continue;
  const event=content.events.find(e=>e.id===definition.eventId),region=content.regions.find(r=>r.id===event.region);
  const add=(id,targetId,action,label,explanation)=>{const target=region.objects.find(o=>o.id===targetId);if(target)leads.push({id,targetId,region:region.id,position:[...target.position],expectedAction:action,label,explanation,sourceKnowledgeId:known.id});};
  if(definition.type==='infrastructure')for(const id of definition.structures||[]) {
   const spec=(content.structures||[]).find(s=>s.id===id);if(!spec)continue;
   const inspected=state.player.inspections?.[spec.targetId];
   if(!inspected)add(`lead:${event.id}:${id}`,spec.targetId,'inspect','傷んだ設備を確かめる','現場で支柱・排水・作業の状況を確かめ、必要な準備を考える。');
   else for(const work of inspected.work||[])add(`lead:${event.id}:${id}:${work.id}`,spec.targetId,work.id,work.label,'現場で確かめた作業。資材や技能を準備して戻ろう。');
  }
  if(definition.type==='institution') {
   for(const doc of definition.documents)if(!state.knowledge.some(k=>k.id===`document:${event.id}:${doc.id}`))add(`lead:${event.id}:${doc.id}`,doc.targetId,`read:${event.id}:${doc.id}`,`${doc.title}を確かめる`,`${region.objects.find(o=>o.id===doc.targetId)?.name||'保管場所'}で原本を読む。記載内容を比べれば、申請の食い違いを確かめられる。`);
   if(definition.documents.some(d=>state.knowledge.some(k=>k.id===`document:${event.id}:${d.id}`)&&!state.events[event.id].causal.submitted.includes(d.id)))add(`lead:${event.id}:submit`,definition.officeId,`submit:${event.id}`,'役所に書類の写しを届ける','窓口に提出する。審理には係の人が実際に出勤している必要がある。');
  }
  if(definition.type==='ecosystem') {
   if(!state.player.inspections?.[definition.deviceId])add(`lead:${event.id}:water`,definition.deviceId,'inspect','上流の水路を確かめる','水の流れと吸収しているものを調べる。木材と縄による迂回か、魔術による封印を検討できる。');
   else {
    const observed=state.player.inspections[definition.deviceId].work||[];
    if(observed.some(a=>a.id===`divert:${event.id}`))add(`lead:${event.id}:divert`,definition.deviceId,`divert:${event.id}`,'脇水路を固定する','木材2つと縄1つを用意して水路へ戻る。');
    if(observed.some(a=>a.id===`seal:${event.id}`))add(`lead:${event.id}:seal`,definition.deviceId,`seal:${event.id}`,'吸収核を封じる','基礎魔術を習い、調律結晶を持って水路へ戻る。');
   }
  }
  if(definition.type==='return-person') {
   const person=state.npcs[definition.personId],visible=person&&person.hp>0&&!person.travel&&person.region===state.player.region&&distance(person.position,state.player.position)<18&&hasLineOfSight(region,state.player.position,person.position);
   if(visible&&!person.companionOf)leads.push({id:`lead:${event.id}:person`,targetId:person.id,region:person.region,position:[...person.position],expectedAction:person.injury&&!person.injury.treated?'tend':person.injury?.treated||person.causalAssignment?'escort':'talk',label:'見つけた人の様子を確かめる',explanation:'近づいて話す。負傷しているなら手当てし、一緒に家へ戻る。',sourceKnowledgeId:known.id});
   else if(!state.player.inspections?.[`event:${event.id}`])leads.push({id:`lead:${event.id}:site`,targetId:`event:${event.id}`,region:region.id,position:[...event.position],expectedAction:'inspect',label:'人の行方が気になる場所を見に行く',explanation:'現場を歩いて探す。出会えなければ、見聞きしたことを人に尋ねられる。',sourceKnowledgeId:known.id});
  }
 }
 return leads.sort((a,b)=>a.id.localeCompare(b.id,'en'));
}
export function trackLead(state,content,id) {
 const lead=investigationLeads(state,content).find(l=>l.id===id);
 if(!lead)throw Object.assign(new Error('今知っている手がかりからは、その行き先を選べません。'),{code:'LEAD_UNKNOWN',status:409});
 state.player.investigationIntent={...structuredClone(lead),trackedAt:state.time};return {message:lead.explanation};
}
export function arrivalContract(state,content,interactables) {
 const intent=state.player.investigationIntent;if(!intent)return null;
 if(state.player.region!==intent.region||distance(state.player.position,intent.position)>5)return {...intent,status:'travelling',message:intent.explanation};
 if(intent.expectedAction==='escort-arrival')return {...intent,status:state.npcs[intent.targetId]?.companionOf==='player'?'waiting-companion':'completed',message:state.npcs[intent.targetId]?.companionOf==='player'?'同行者が追いつき、家族と落ち着いて話せるまでそばで見守ろう。':'同行者を送り届けた。'};
 const opportunity=interactables.find(t=>t.id===intent.targetId)?.actions.find(a=>(a.action||a.id)===intent.expectedAction);
 if(opportunity)return {...intent,status:opportunity.available===false?'requirements-missing':'available',message:opportunity.available===false?`準備が足りない：${(opportunity.missing||[]).join('、')}`:'目的の場所に着いた。近くの対象を調べられる。'};
 const npc=content.npcs.find(n=>n.id===intent.targetId);
 const stillNeeded=investigationLeads(state,content).some(l=>l.id===intent.id);
 return {...intent,status:stillNeeded?'unavailable':'completed',message:!stillNeeded?'ここで確かめたことは手帳に残っている。':npc?'ここには相手の姿が見えない。周囲の人に話を聞くか、別の手がかりを追おう。':'今はその調査を行えない。現場の様子を確かめ、手帳の別の手がかりを見直そう。',alternatives:['journal','leave']};
}
