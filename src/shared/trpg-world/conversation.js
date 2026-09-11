import {setActivity} from './activity.js';
import {rememberAction,willingToCooperate,initializeRelationships} from './relationships.js';
import {distance,hasLineOfSight} from './navigation.js';

const reject=(code,message)=>{throw Object.assign(new Error(message),{code,status:409});};
export function visibleTopics(state,npc) {
  // A secret needs a specific authored disclosure permission, never a score.
  return npc.knowledge.filter(f=>f.kind!=='secret'&&!(f.disclosureTrust>0)||
    f.disclosureFactIds?.some(id=>npc.memories.some(m=>m.factId===id)));
}
function choices(state,npc,session) {
  const facts=visibleTopics(state,npc).filter(f=>!session.factsLearned.includes(f.id));
  const options=facts.slice(0,1).map(f=>({id:`ask:${f.id}`,family:'ask',factId:f.id,label:`「${f.kind==='event'?'その出来事':f.kind==='background'?'この土地での暮らし':'その話'}」について聞く`,preview:f.text}));
  if(!session.history.some(h=>h.intentId==='daily-plan'))options.push({id:'daily-plan',family:'social',label:'今日は何をする予定か聞く'});
  if(!session.history.some(h=>h.intentId==='promise-supplies')&&!state.promises.some(p=>p.to===npc.id&&p.status==='open'))
    options.push({id:'promise-supplies',family:'promise',label:'日暮れまでに生活物資を一つ届けると約束する'});
  if(options.length<4&&!session.history.some(h=>h.intentId==='joke'))options.push({id:'joke',family:'play',label:'旅先で迷った話を冗談にする'});
  if(npc.money>0&&!session.history.some(h=>h.intentId==='pickpocket'))options.splice(3,0,{id:'pickpocket',family:'theft',label:'話している隙に相手の財布を掏ろうとする'});
  return [...options.slice(0,4),{id:'leave',family:'leave',label:'話を終えて立ち去る'}];
}
export function beginConversation(state,content,target) {
  initializeRelationships(state);
  const npc=state.npcs[target.id];if(!npc||npc.hp<=0||npc.travel)reject('NPC_ABSENT','ここでは話せません。');
  if(npc.goal==='sleep')return {message:`${target.name}は眠っている。`};
  if(state.conversation?.status==='active'&&state.conversation.participants.includes(npc.id))return conversationResult(state,content);
  const met=rememberAction(state,content,'conversation-started',{targetId:npc.id});
  const session={id:`conversation:${state.nextId++}`,status:'active',participants:['player',npc.id],place:{region:npc.region,position:[...npc.position]},
    startedAtWorldTime:state.time,turn:0,speaker:npc.id,listener:'player',audibleWitnesses:met.witnesses,
    topics:[],semanticIntents:[],disclosures:[],factsUsed:[],factsLearned:[],promisesMade:[],history:[],
    utterance:`${target.name}「${npc.activity}のところだ。何か用かな。」`};
  state.conversation=session;setActivity(state,'conversation',{sessionId:session.id,targetId:npc.id});
  session.semanticIntents=choices(state,npc,session).map(c=>c.id);
  return conversationResult(state,content);
}
export function conversationResult(state,content) {
  const session=state.conversation;if(!session)return {};
  const npc=state.npcs[session.speaker];
  const options=session.status==='active'?choices(state,npc,session):[];
  return {message:session.utterance,conversation:{id:session.id,turn:session.turn,status:session.status,
    utterance:session.utterance,choices:options.map(({preview,...option})=>option)}};
}
export function converse(state,content,command) {
  const session=state.conversation,npc=session&&state.npcs[session.speaker];
  if(!session||session.status!=='active'||session.id!==command.sessionId||command.turn!==session.turn)reject('CONVERSATION_STALE','会話を同期してください。');
  const region=content.regions.find(r=>r.id===state.player.region);
  if(!npc||npc.hp<=0||npc.travel||npc.region!==state.player.region||distance(npc.position,state.player.position)>5||!hasLineOfSight(region,npc.position,state.player.position))reject('NPC_ABSENT','相手がこの場所にいません。');
  const choice=choices(state,npc,session).find(c=>c.id===command.intentId);
  if(!choice)reject('INTENT_UNAVAILABLE','今はその話をできません。');
  const fact=rememberAction(state,content,'utterance',{targetId:npc.id,payload:{intentId:choice.id,sessionId:session.id}});
  session.history.push({turn:session.turn,intentId:choice.id,factId:fact.id});session.turn++;
  if(choice.family==='ask') {
    const known=visibleTopics(state,npc).find(f=>f.id===choice.factId);
    session.factsUsed.push(known.id);session.factsLearned.push(known.id);
    const learned={...structuredClone(known),receivedAt:state.time,source:{type:'heard',actorId:npc.id,sessionId:session.id,previous:structuredClone(known.source)}};
    const old=state.knowledge.find(f=>f.id===known.id);
    if(!old)state.knowledge.push(learned);else if(old.observedAt<known.observedAt)Object.assign(old,learned);
    session.disclosures.push({factId:known.id,from:npc.id,to:'player',at:state.time});
    session.utterance=known.text;
  } else if(choice.id==='daily-plan')session.utterance=`今は${npc.activity}をしている。${willingToCooperate(state,npc)?'約束を守ってくれたことは覚えている。':''}`;
  else if(choice.id==='promise-supplies') {
    const promise={id:`promise:${state.nextId++}`,from:'player',to:npc.id,intent:'deliver-supplies',createdAt:state.time,
      deadline:Math.max(state.time+3600,Math.floor(state.time/86400)*86400+20*3600),status:'open',sourceFactId:fact.id};
    state.promises.push(promise);session.promisesMade.push(promise.id);npc.obligations.push(promise.id);
    session.utterance='それなら日暮れまで待っている。無理なら知らせてほしい。';
  } else if(choice.id==='pickpocket') {
    state.random=(Math.imul(state.random,1664525)+1013904223)>>>0;
    const success=state.random/4294967296<(state.player.skills.includes('stealth')?.65:.15);
    const observers=Object.values(state.npcs).filter(n=>n.id!==npc.id&&n.hp>0&&!n.travel&&n.region===npc.region&&distance(n.position,npc.position)<8&&hasLineOfSight(region,n.position,npc.position)).map(n=>n.id);
    if(!success)observers.push(npc.id);
    const amount=success?npc.money:0;if(success){state.player.gold+=amount;npc.money=0;}
    rememberAction(state,content,success?'theft':'attempted-theft',{targetId:npc.id,payload:{owner:npc.id,amount,noticed:!success},observedBy:observers});
    session.utterance=success?'財布の重みが手に移った。周囲に気づいた人がいるかもしれない。':'手首をつかまれた。「何をしている？」';
    session.status='ended';setActivity(state,'idle');
  } else if(choice.id==='joke')session.utterance='見慣れない道なら、曲がり角ひとつでも冒険になるね。';
  else {session.status='ended';session.utterance='話を終えた。';setActivity(state,'idle');}
  session.semanticIntents=choices(state,npc,session).map(c=>c.id);
  return conversationResult(state,content);
}
