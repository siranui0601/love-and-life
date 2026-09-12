import {legalChoices,speakLegal,crimeMemories} from './law.js';
import {recalled,testimony,hearTestimony} from './memory.js';
import {setActivity} from './activity.js';
import {rememberAction,willingToCooperate,initializeRelationships,deliverSupplies} from './relationships.js';
import {distance,hasLineOfSight} from './navigation.js';
import {knowledgeMeaning,stableString} from './semantic.js';

const reject=(code,message)=>{throw Object.assign(new Error(message),{code,status:409});};
export function visibleTopics(state,npc) {
  // A secret needs a specific authored disclosure permission, never a score.
  const accounts=crimeMemories(npc).map(m=>({id:`account:${m.factId}`,kind:'testimony',text:m.recall.actorId==='player'?'旅人が他人の持ち物に触れていた。事情を確かめたい。':m.recall.actorId?'見覚えのある人物が他人の持ち物に触れていた。':'旅装の人物が他人の持ち物に触れていた。顔は確かではない。',region:m.recall.region,observedAt:m.learnedAt,source:m.source,belief:{factId:m.factId}}));
  return [...accounts,...npc.knowledge].filter(f=>(!f.belief?.factId||!npc.memories.some(m=>m.factId===f.belief.factId&&m.status==='forgotten'))&&(f.kind!=='secret'&&f.disclosure?.visibility!=='private'||
    f.disclosureFactIds?.some(id=>npc.memories.some(m=>m.factId===id&&m.status!=='forgotten'))));
}
function choices(state,npc,session) {
  const legal=legalChoices(state,npc);
  const facts=visibleTopics(state,npc).filter(f=>!session.factsLearned.includes(f.id)&&!state.knowledge.some(k=>k.id===f.id&&stableString(knowledgeMeaning(k))===stableString(knowledgeMeaning(f)))).sort((a,b)=>Number(b.kind==='site-observation')-Number(a.kind==='site-observation')||a.id.localeCompare(b.id,'en'));
  const options=facts.slice(0,1).map(f=>({id:`ask:${f.id}`,family:'ask',intent:'ASK_ABOUT',factId:f.id,label:`「${f.topicLabel||f.title||f.text.slice(0,24)}${!f.topicLabel&&!f.title&&f.text.length>24?'…':''}」について聞く`,preview:f.text}));
  if(!session.history.some(h=>h.intentId==='daily-plan'))options.push({id:'daily-plan',intent:'ASK_ABOUT',family:'social',label:'今日は何をする予定か聞く'});
  if(!session.history.some(h=>h.intentId==='promise-supplies')&&!state.promises.some(p=>p.to===npc.id&&p.status==='open'))
    options.push({id:'promise-supplies',intent:'MAKE_PROMISE',family:'promise',label:'日暮れまでに生活物資を一つ届けると約束する'});
  if(options.length<4&&!session.history.some(h=>h.intentId==='joke'))options.push({id:'joke',family:'play',label:'旅先で迷った話を冗談にする'});

  const share=[...state.knowledge].sort((a,b)=>a.id.localeCompare(b.id,'en')).find(k=>!npc.knowledge.some(n=>n.id===k.id));
  if(share)options.push({id:`share:${share.id}`,intent:share.kind==='event'?'WARN':'SHARE_INFORMATION',family:'share',factId:share.id,label:share.kind==='event'?'見聞きした危険を伝える':'知っている話を伝える'});
  if(state.player.inventory.supplies>0&&npc.hunger>60)options.push({id:'offer-food',intent:'OFFER_HELP',family:'offer',label:'持っている食料を渡す'});
  if(state.player.inventory.medicine>0&&visibleTopics(state,npc).some(k=>k.kind==='site-observation'))options.push({id:'offer-medicine',intent:'OFFER_HELP',family:'medical-supplies',label:'手当てに使える傷薬を一つ渡す'});
  if(npc.possessions.supplies>0&&state.player.hunger>50)options.push({id:'request-food',intent:'REQUEST_HELP',family:'request',label:'食べ物を分けてもらえないか頼む'});
  options.push({id:'lie-health',intent:'LIE',family:'claim',label:'本当の状態とは関係なく「病気だ」と言う'});
  const limit=options.length>4?3:4,start=session.topicCursor||0;
  const visible=options.slice(start,start+limit);
  if(options.length>4)visible.push({id:'change-topic',intent:'CHANGE_TOPIC',family:'topic',label:'別の話題に移る'});
  return [...legal,...(legal.length?[]:visible),{id:'leave',intent:'LEAVE',family:'leave',label:'話を終えて立ち去る'}];
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
  return {message:session.utterance,conversation:{id:session.id,turn:session.turn,status:session.status,speaker:npc.id,
    utterance:session.utterance,choices:options.map(({preview,...option})=>option)}};
}
export function converse(state,content,command) {
  const session=state.conversation,npc=session&&state.npcs[session.speaker];
  if(!session||session.status!=='active'||session.id!==command.sessionId||command.turn!==session.turn)reject('CONVERSATION_STALE','会話を同期してください。');
  const region=content.regions.find(r=>r.id===state.player.region);
  if(!npc||npc.hp<=0||npc.travel||npc.region!==state.player.region||distance(npc.position,state.player.position)>5||!hasLineOfSight(region,npc.position,state.player.position))reject('NPC_ABSENT','相手がこの場所にいません。');
  const choice=choices(state,npc,session).find(c=>c.id===command.intentId);
  if(!choice)reject('INTENT_UNAVAILABLE','今はその話をできません。');
  const fact=rememberAction(state,content,'utterance',{targetId:npc.id,payload:{intentId:choice.id,semanticIntent:choice.intent,sessionId:session.id}});
  session.history.push({turn:session.turn,intentId:choice.id,factId:fact.id});session.turn++;
  if(choice.family==='law'){session.utterance=speakLegal(state,content,npc,choice,fact);}
  else if(choice.family==='ask') {
    const known=visibleTopics(state,npc).find(f=>f.id===choice.factId);
    session.factsUsed.push(known.id);session.factsLearned.push(known.id);
    const learned={...structuredClone(known),receivedAt:state.time,source:{type:'heard',actorId:npc.id,sessionId:session.id,previous:structuredClone(known.source)}};
    const memory=recalled(npc,known.belief?.factId||known.id);if(memory?.recall)learned.testimony=testimony(state,npc,memory);
    const old=state.knowledge.find(f=>f.id===known.id);
    if(!old)state.knowledge.push(learned);else if(old.observedAt<known.observedAt)Object.assign(old,learned);
    session.disclosures.push({factId:known.id,from:npc.id,to:'player',at:state.time});
    session.utterance=known.text;
  } else if(choice.family==='topic') {session.topicCursor=(session.topicCursor||0)+3;if(!choices(state,npc,session).some(c=>!['topic','leave'].includes(c.family)))session.topicCursor=0;session.utterance='ほかには？';}
  else if(choice.family==='share') {
    const known=state.knowledge.find(k=>k.id===choice.factId);
    npc.knowledge.push({...structuredClone(known),receivedAt:state.time,source:{type:'heard',actorId:'player',previous:structuredClone(known.source)}});
    if(known.testimony)hearTestimony(state,npc,{id:'player'},known.testimony);
    session.disclosures.push({factId:known.id,from:'player',to:npc.id,at:state.time});npc.nextDecision=0;session.utterance='分かった。自分でも気をつけて確かめよう。';
  } else if(choice.family==='medical-supplies') {state.player.inventory.medicine--;npc.possessions.medicine=(npc.possessions.medicine||0)+1;rememberAction(state,content,'gift',{targetId:npc.id,payload:{itemId:'medicine',quantity:1,purpose:'medical-response'}});npc.nextDecision=0;session.utterance='傷薬を受け取った。手当てが必要な人のために使おう。';}
  else if(choice.family==='offer') {state.player.inventory.supplies--;deliverSupplies(state,content,npc);session.utterance='今ちょうど食べ物が必要だった。受け取るよ。';}
  else if(choice.family==='request') {
    if(willingToCooperate(state,npc,{resourceCost:1,purpose:'food'})){npc.possessions.supplies--;state.player.inventory.supplies=(state.player.inventory.supplies||0)+1;rememberAction(state,content,'gift',{actorId:npc.id,targetId:'player',payload:{itemId:'supplies',quantity:1}});session.utterance='一つなら分けられる。';}
    else session.utterance='今は自分の分を手放せない。';
  } else if(choice.family==='claim') {
    npc.beliefs.push({id:`belief:${state.nextId++}`,factId:fact.id,claim:'ill',about:'player',confidence:.35,place:structuredClone(session.place),at:state.time,source:{type:'claimed',actorId:'player',sessionId:session.id}});npc.nextDecision=0;
    session.utterance='病気なのか？ 様子を見よう。';
  } else if(choice.id==='daily-plan')session.utterance=`今は${npc.activity}をしている。${willingToCooperate(state,npc)?'約束を守ってくれたことは覚えている。':''}`;
  else if(choice.id==='promise-supplies') {
    const promise={id:`promise:${state.nextId++}`,from:'player',to:npc.id,intent:'deliver-supplies',createdAt:state.time,
      deadline:Math.max(state.time+3600,Math.floor(state.time/86400)*86400+20*3600),status:'open',sourceFactId:fact.id};
    state.promises.push(promise);session.promisesMade.push(promise.id);npc.obligations.push(promise.id);
    session.utterance='それなら日暮れまで待っている。無理なら知らせてほしい。';
  } else if(choice.id==='joke')session.utterance='見慣れない道なら、曲がり角ひとつでも冒険になるね。';
  else {session.status='ended';session.utterance='話を終えた。';setActivity(state,'idle');}
  session.semanticIntents=choices(state,npc,session).map(c=>c.id);
  return conversationResult(state,content);
}
