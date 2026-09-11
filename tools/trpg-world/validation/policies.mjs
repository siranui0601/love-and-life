// Policies receive this projection only. Opaque handles are resolved by the
// driver after selection; they cannot read event IDs, hidden flags or solutions.
export function observePlayer(view,options) {
 return {location:view.region.name,position:view.player.position,health:view.player.hp,gold:view.player.gold,
  knowledge:[...view.knownEvents.map(e=>e.description),...(view.notes||[]).map(n=>n.text)],
  arrivalStatus:view.arrival?.status,arrivalMessage:view.arrival?.message,arrivalAction:view.arrival?.status==='available'?options.findIndex(o=>o.command.targetId===view.arrival.targetId&&o.command.action===view.arrival.expectedAction):-1,
  conversation:!!view.conversation,actions:options.map((o,handle)=>({handle,label:o.label,target:o.targetName,kind:o.command.type,intent:o.intent,progress:o.progress})),
  leads:(view.leads||[]).filter(l=>l.region===view.region.id).map((l,handle)=>({handle,label:l.label,explanation:l.explanation,position:l.position})),
  places:view.region.objects.filter(o=>!view.player.inspections?.[o.id]).map(o=>({handle:o.id,name:o.name,kind:o.kind,position:o.position})),
  people:view.npcs.map(n=>({handle:n.id,name:n.name,activity:n.activity,position:n.position}))};
}
export function choosePolicy(name,observation,experience={people:[]}) {
 const o=observation;
 if(o.conversation){const ask=o.actions.find(a=>a.progress);return ask?{action:ask.handle,reason:'相手が今話せる、まだ聞いていない情報を聞く'}:{action:o.actions.find(a=>a.intent==='LEAVE')?.handle,reason:'新しい話を聞き終えたので会話を終える'};}
 if(name==='chaotic') {
  const action=o.actions.find(a=>a.label===(experience.posture==='lie'?'立つ':'横になる'));
  if(action){experience.posture=experience.posture==='lie'?'stand':'lie';return {action:action.handle,reason:'事件と関係なく、その場で姿勢を変える'};}
 }
 if(name==='dialogue-first') {
  const person=o.people.find(n=>!experience.people.includes(n.handle));
  if(person){const talk=o.actions.find(a=>a.kind==='interact'&&a.label==='話す'&&a.target===person.name);
   if(talk){experience.people.push(person.handle);return {action:talk.handle,reason:'まだ話していない住民から話を聞く'};}
   return {walk:person.position,reason:`見えている${person.name}へ近づく`};}
 }
 if(name!=='blind-explorer'&&name!=='chaotic') {
  if(o.arrivalAction>=0)return {action:o.arrivalAction,reason:'到着先に提示された、目的の調査を実行する'};
  if(o.arrivalStatus==='requirements-missing')return {stop:'preparation-policy-not-implemented',reason:o.arrivalMessage};
  const useful=o.actions.find(a=>a.progress);if(useful)return {action:useful.handle,reason:'公開された調査行動で、今持っていない情報を得る'};
  const lead=o.leads[0];if(lead)return {lead:lead.handle,walk:lead.position,reason:lead.explanation};
 }
 const here=o.actions.find(a=>a.kind==='interact'&&['見る','調べる'].includes(a.label));
 if(here)return {action:here.handle,reason:'目の前の場所を調べて、何があるか確かめる'};
 const place=[...o.places].sort((a,b)=>Math.hypot(a.position[0]-o.position[0],a.position[2]-o.position[2])-Math.hypot(b.position[0]-o.position[0],b.position[2]-o.position[2]))[0];
 if(place)return {walk:place.position,reason:`まだ確かめていない${place.name}へ歩く`};
 return {stop:'no-visible-frontier',reason:'現在見えている場所と話題を確かめ終えた。新しい地域や別の時刻の探索は未実施'};
}
