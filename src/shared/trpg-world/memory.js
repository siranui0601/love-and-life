// Objective history is never used to fill gaps in a recollection. The audit link
// remains durable; only this observer's description can be spoken or reported.
const DAY=86400;
export function memoryProfile(npc,template={}) {
  if(npc.memoryProfile)return npc.memoryProfile;
  const description=`${template.role||''} ${npc.personality||template.personality||''}`;
  return npc.memoryProfile={habits:/学者|記録|司書|書記|几帳面/.test(description)?'precise':/忘れ|のんびり|子供/.test(description)?'fleeting':'selective',
    interests:/衛兵|警備|騎士/.test(description)?['property','danger']:/医|薬|治療/.test(description)?['injury','rescue']:/商|店|会計/.test(description)?['property','trade']:['people'],
    sourceHabit:/噂|おしゃべり/.test(description)?'retells':'careful',sleepConsolidation:/忘れ|子供/.test(description)?'discard-trivia':'retain-salient'};
}
export function observeMemory(state,npc,fact,{range=0,template={}}={}) {
  memoryProfile(npc,template);
  const identified=range<=7||fact.targetId===npc.id||fact.actorId===npc.id;
  const actor=fact.actorId==='player'?state.player:state.npcs[fact.actorId];
  const property=['theft','attempted-theft','document-read','container-opened','trespass','property-loss-discovered'].includes(fact.kind);
  const personal=fact.targetId===npc.id||fact.payload.ownerId===npc.id;
  const m={factId:fact.id,kind:fact.kind,actorId:identified?fact.actorId:null,targetId:fact.targetId,learnedAt:state.time,
    source:{type:'seen',observerId:npc.id},status:'clear',repetitions:1,sleepCount:0,
    salience:{personal,emotional:['rescue','injury','threat','promise-kept'].includes(fact.kind),unusual:fact.kind==='body-action',domain:property?'property':fact.kind},
    recall:{kind:fact.kind,actorId:identified?fact.actorId:null,appearance:actor?.appearance?.clothing||'旅装',targetId:fact.targetId,
      private:fact.payload.private!==false,ownerId:fact.payload.ownerId||null,assetId:fact.payload.assetId||fact.payload.asset||null,region:fact.region,position:[...fact.position],at:fact.at},
    changes:[]};
  npc.memories.push(m);return m;
}
export function recalled(npc,factId) {const m=npc.memories?.find(m=>m.factId===factId);return m&&m.status!=='forgotten'?m:null;}
export function advanceMemories(state,content) {
  if(state.time<(state.nextMemoryTick||0))return;state.nextMemoryTick=state.time+600;
  for(const npc of Object.values(state.npcs)) {
    const profile=memoryProfile(npc,content.npcs.find(n=>n.id===npc.id));
    const asleep=npc.goal==='sleep';const slept=npc.memoryWasSleeping&&!asleep;npc.memoryWasSleeping=asleep;
    for(const m of npc.memories||[]) {
      if(!m.recall||m.status==='forgotten')continue;
      if(slept)m.sleepCount++;
      const important=m.salience.personal||m.salience.emotional||profile.interests.includes(m.salience.domain);
      const retention=(profile.habits==='precise'?6:profile.habits==='fleeting'?.6:2)*(important?4:1)*Math.min(3,m.repetitions||1);
      const age=(state.time-m.learnedAt)/DAY+(profile.sleepConsolidation==='discard-trivia'&&!important?m.sleepCount*.7:0);
      const change=(field,value,reason)=>{if(m.recall[field]!==value){m.changes.push({at:state.time,field,previous:m.recall[field],value,reason});m.recall[field]=value;}};
      if(age>retention){m.status='forgotten';m.forgottenAt=state.time;continue;}
      if(age>retention*.35&&m.status==='clear'){m.status='partial';change('at',Math.round(m.recall.at/3600)*3600,'time-detail-lost');}
      if(age>retention*.6){change('actorId',null,'identity-detail-lost');if(profile.sourceHabit==='retells')m.sourceLostAt??=state.time;}
    }
  }
}
export function testimony(state,speaker,memory) {
  if(!memory?.recall||memory.status==='forgotten')return null;
  return {originFactId:memory.factId,description:structuredClone(memory.recall),basis:memory.source.type,
    chain:[...(memory.chain||[]),{speakerId:speaker.id,at:state.time,memoryStatus:memory.status,changes:structuredClone(memory.changes||[])}]};
}
export function hearTestimony(state,listener,speaker,statement) {
  if(!statement||listener.memories.some(m=>m.factId===statement.originFactId))return null;
  const description=structuredClone(statement.description),profile=memoryProfile(listener);
  const changes=[];
  // Association is an explicit belief based on a remembered description, never
  // random reassignment of objective actor identity.
  if(!description.actorId&&description.appearance) {
    const association=(listener.beliefs||[]).find(b=>b.claim==='recognizes-clothing'&&b.appearance===description.appearance);
    if(association){description.actorId=association.about;changes.push({at:state.time,field:'actorId',previous:null,value:association.about,reason:'clothing-association',beliefId:association.id});}
  }
  if(profile.sourceHabit==='retells'&&description.at%3600){changes.push({at:state.time,field:'at',previous:description.at,value:Math.round(description.at/3600)*3600,reason:'retelling-rounds-time'});description.at=Math.round(description.at/3600)*3600;}
  const m={factId:statement.originFactId,kind:description.kind,actorId:description.actorId,targetId:description.targetId,learnedAt:state.time,
    source:{type:'heard',actorId:speaker.id},status:changes.length?'distorted':'clear',recall:description,changes,chain:structuredClone(statement.chain),repetitions:1,sleepCount:0,
    salience:{personal:description.ownerId===listener.id,emotional:false,domain:'property'}};
  listener.memories.push(m);listener.nextDecision=0;return m;
}
