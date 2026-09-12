import {advanceMemories,recalled,testimony,hearTestimony} from './memory.js';
import {orderedValues} from './semantic.js';
import {knownWorkplaceClosed,observeWorkplace} from './world-semantics.js';
import {knownTiming,readNotices} from './public-knowledge.js';
import {structureObservation,structureActions,startStructureWork,finishStructureWork} from './infrastructure.js';
import {investigationLeads,trackLead,arrivalContract} from './investigation.js';
import {initializeProperty,propertyView,performPropertyAction} from './private-property.js';
import {advanceSocialPlan,advanceLaw,exchangeCrimeMemories} from './law.js';
import {lessonFor,recordLesson} from './training.js';
import {affordances,performAffordance,advancePropertyDiscovery} from './affordances.js';
import {planForGoal,advancePlan} from './npc-planner.js';
import {initializeCausality, advanceCausality, failCausality, causalActions, applyCausalAction} from './causal-events.js';
import {NEEDS, collapse, advanceNeeds, advanceRescue} from './survival.js';
import {initializeRelationships, rememberAction, deliverSupplies, expirePromises, willingToCooperate} from './relationships.js';
import {beginConversation, converse, conversationResult} from './conversation.js';
import {setActivity, canMove, playerIsLocal, migrateWorld} from './activity.js';
import {canOccupy, distance, moveBody, followPath,hasLineOfSight} from './navigation.js';
import {MOVEMENT, awardXp, forceOf, priceOf} from './progression.js';
import {startEnemyAction,resolveEnemyAction,tickCombatEffects} from './combat.js';

const DAY = 86400, INTERACTION = 5, indexes = new WeakMap();
const TRAVEL_FACTOR = Object.freeze({foot:1,horse:.45,carriage:.65,broom:.3,boat:.7,ship:.5,wagon:.8,magic:.1});
const TRAVEL_LABEL = Object.freeze({foot:'徒歩',horse:'乗馬',carriage:'馬車',broom:'箒',boat:'船',wagon:'荷馬車',ship:'船',magic:'転移'});
const TRAVEL_RISK_LABEL = Object.freeze({safe:'安定',watch:'注意',danger:'危険'});
const clone = value => structuredClone(value);
const finite = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const values = orderedValues;
function fail(code,message,status=400) { const error = new Error(message); error.code = code; error.status = status; throw error; }
function index(content) {
  if (!indexes.has(content)) {
    const map = key => new Map((content[key] || []).map(item=>[item.id,item]));
    indexes.set(content,{regions:map('regions'),npcs:map('npcs'),events:map('events'),skills:map('skills'),items:map('items'),materials:map('materials'),recipes:map('recipes'),jobs:map('jobs'),routes:map('routes'),monsters:map('monsters'),equipment:map('equipment')});
  }
  return indexes.get(content);
}
function random(state) { state.random = (Math.imul(state.random,1664525) + 1013904223) >>> 0; return state.random / 4294967296; }
function hour(state) { return (state.time % DAY) / 3600; }
function log(state,text,kind='action',eventId=null) {
  const entry = {id:`h${state.nextId++}`,time:state.time,text,kind,eventId};
  state.history.push(entry); if (state.history.length > 500) state.history.splice(0,state.history.length-500);
  state.notifications.push(entry); if (state.notifications.length > 12) state.notifications.shift();
  return entry;
}
function factFor(event,current,state,source,content) {
  const structure=(content.structures||[]).find(s=>s.hazardEventId===event.id),physical=structure&&structureObservation(state,content,structure.targetId);
  return {id:`event:${event.id}`,kind:'event',eventId:event.id,text:physical?.text||event.description || event.name,region:event.region,
    status:current.status,observedAt:state.time,source,confidence:source.type==='heard'?.7:1};
}
function learnEvent(state,content,eventId,source,actor=state.player) {
  const event = index(content).events.get(eventId), current = state.events[eventId];
  if (!event || !current) return false;
  const knowledge = actor === state.player ? state.knowledge : actor.knowledge;
  const existing = knowledge.find(k=>k.eventId===eventId);
  const fact = factFor(event,current,state,source,content);
  if (!existing) {
    knowledge.push(fact);
    if (actor === state.player) { log(state,`知ったこと：${event.name}`,'knowledge',event.id); awardXp(state,12,`discover:${event.id}`); }
  } else Object.assign(existing,fact);
  if(actor===state.player&&current.status==='failed') {
    const quest=state.quests.find(q=>q.eventId===eventId&&q.status==='accepted');
    if(quest){quest.status='failed';log(state,`${event.name}の期限を過ぎたことを知った。`,'quest',eventId);}
  }
  return !existing;
}
function learnEvidence(state,id,source,text) {
  if (!id || state.player.evidence.includes(id)) return false;
  state.player.evidence.push(id);
  state.knowledge.push({id:`evidence:${id}`,kind:'evidence',evidenceId:id,text:text || '調査で手がかりを得た。',observedAt:state.time,source,confidence:1});
  awardXp(state,18,`evidence:${id}`); log(state,text || '調査で手がかりを得た。','evidence'); return true;
}
function initializeMonsters(state,content) {
  for (const region of content.regions) {
    const candidates = (content.monsters || []).filter(m=>m.region===region.id && !m.boss && !m.sourceCondition);
    for (let i=0;i<Math.min(3,candidates.length);i++) {
      const template = candidates[i], locations = [[-50,0,-45],[48,0,40],[-46,0,46],[48,0,-42]];
      let spawn = locations[i];
      if (!canOccupy(region,spawn)) spawn = locations.find(p=>canOccupy(region,p)) || [0,0,-55];
      const id = `creature:${region.id}:${i}`;
      state.monsters[id] = {id,templateId:template.id,region:region.id,position:[...spawn],home:[...spawn],hp:template.hp,maxHp:template.hp,
        activity:'roam',cooldown:0,respawnAt:0,lastThreat:0,heading:0,mp:20+template.level*3,maxMp:20+template.level*3};
    }
  }
}
function updateIncidentPopulation(state,content) {
  if(state.time<(state.nextPopulation || 0))return;
  state.nextPopulation=state.time+1800;
  for(const event of content.events || []) {
    const current=state.events[event.id];if(!current)continue;
    const settled=['resolved','prevented'].includes(current.status);
    if(settled){for(const monster of values(state.monsters))if(monster.eventId===event.id){monster.hp=0;monster.respawnAt=0;}continue;}
    // Instigators physically exist before their crisis starts, so prevention by
    // force requires winning a real encounter instead of selecting a force score.
    const opposition=index(content).monsters.get(event.opposition?.monsterId),oppositionId=`opposition:${event.id}`;
    if(opposition&&!state.monsters[oppositionId]){
      const region=index(content).regions.get(event.region),anchor=event.position||[0,0,0];
      const candidates=[[anchor[0],0,anchor[2]-12],[anchor[0]+9,0,anchor[2]-8],[-44,0,-38]];
      const position=candidates.find(p=>canOccupy(region,p));
      if(position)state.monsters[oppositionId]={id:oppositionId,templateId:opposition.id,eventId:event.id,causalRole:'instigator',region:event.region,position:[...position],home:[...position],hp:opposition.hp,maxHp:opposition.hp,activity:'roam',cooldown:0,respawnAt:0,lastThreat:0,heading:0,mp:20+opposition.level*3,maxMp:20+opposition.level*3};
    }
    if(current.status==='latent')continue;
    const sourceIds=new Set((event.sourceIds || []).map(String));
    const candidates=(content.monsters || []).filter(m=>{
      if(!m.sourceCondition)return false;
      const references=m.sourceCondition.match(/T\d{2}/g)||[];
      if(!references.some(id=>sourceIds.has(id)))return false;
      const aftermath=/失敗|failed/i.test(m.sourceCondition);
      return current.status==='failed'?aftermath:!aftermath;
    });
    for(const region of content.regions) {
      const local=candidates.filter(m=>m.region===region.id).sort((a,b)=>a.level-b.level);
      const normal=local.find(m=>!m.boss),bosses=local.filter(m=>m.boss);
      const selected=[normal,current.status==='critical'?bosses.at(-1):bosses[0]].filter(Boolean);
      const selectedBoss=selected.find(m=>m.boss);
      if(selectedBoss)for(const prior of values(state.monsters))if(prior.eventId===event.id&&prior.region===region.id&&prior.templateId!==selectedBoss.id&&index(content).monsters.get(prior.templateId)?.boss){prior.hp=0;prior.respawnAt=0;}
      for(const template of selected) {
        const id=`incident:${event.id}:${template.id}`;if(state.monsters[id])continue;
        const anchor=event.region===region.id?event.position || [0,0,0]:[30,0,-36];
        let position=[anchor[0]+12,0,anchor[2]+9];
        if(!canOccupy(region,position))position=[-44,0,-38];
        if(!canOccupy(region,position))continue;
        state.monsters[id]={id,templateId:template.id,eventId:event.id,region:region.id,position:[...position],home:[...position],hp:template.hp,maxHp:template.hp,
          activity:'roam',cooldown:0,respawnAt:0,lastThreat:0,heading:0,mp:20+template.level*3,maxMp:20+template.level*3};
      }
    }
  }
}
export function createWorld(content,{seed=1,name='旅人'}={}) {
  if (!Array.isArray(content.regions) || !content.regions.length) fail('CONTENT_INVALID','地域データがありません。',500);
  const first = index(content).regions.get('farm') || content.regions[0];
  const state = {schemaVersion:2,simulationTime:0,contentRevision:content.revision,random:(seed>>>0)||1,weatherSeed:(seed>>>0)||1,nextId:1,time:content.time?.startSeconds ?? 21600,
    player:{id:'player',name:String(name).slice(0,40),region:first.id,position:[...(first.spawn || [0,0,8])],heading:0,hp:100,maxHp:100,mp:40,maxMp:40,stamina:100,
      hunger:20,fatigue:0,gold:90,xp:0,level:1,sp:3,skills:['combat','investigation'],inventory:{supplies:2,medicine:2,rope:1},equipment:{},mode:'foot',evidence:[],mastery:{},cooldowns:{},lastAttack:-10000},
    input:{x:0,z:0,sprint:false,ascend:0,heading:0},npcs:{},events:{},monsters:{},regions:{},knowledge:[],history:[],notifications:[],facts:{},resources:{},quests:[],rewards:{},visits:[first.id],nextSocial:0,weather:{},cycleComplete:false};
  for (const region of content.regions) state.regions[region.id] = {stock:1,threat:0};
  for (const npc of content.npcs || []) state.npcs[npc.id] = {id:npc.id,region:npc.region,position:[...(npc.home || [0,0,0])],hp:70,maxHp:70,
    activity:'休息',goal:'sleep',personality:npc.personality||'',values:clone(npc.values||{}),possessions:clone(npc.possessions||{}),money:finite(npc.money,8),knowledge:(npc.knowledge || []).map((fact,i)=>typeof fact==='string'?{id:`background:${npc.id}:${i}`,kind:'background',text:fact,region:npc.region,observedAt:state.time,confidence:1,disclosure:{visibility:'private'},source:{type:'past-experience',actorId:npc.id}}:{...clone(fact),id:fact.id||`background:${npc.id}:${i}`,observedAt:fact.observedAt??state.time,confidence:fact.confidence??1,disclosure:fact.disclosure||{visibility:fact.kind==='secret'||fact.disclosureTrust>0?'private':'public'},source:fact.source||{type:'past-experience',actorId:npc.id}}).filter(f=>typeof f.text==='string'),hunger:20,fatigue:0,lastHelpDay:-1,lastTradeDay:-1,travel:null,path:[],pathTarget:null,nextDecision:0};
  for (const event of content.events || []) state.events[event.id] = {id:event.id,status:'latent',interventions:[],startedAt:null,resolvedAt:null};
  initializeRelationships(state);initializeCausality(state,content);setActivity(state,'idle');initializeMonsters(state,content); updateWeather(state,content); updateKnowledgeFromSight(state,content);
  log(state,'朝の街へ出よう。WASDで歩き、近づいてEで話す・調べる。','arrival');
  return state;
}
function updateWeather(state,content) {
  const slot = Math.floor(state.time / (6*3600));
  for (let i=0;i<content.regions.length;i++) {
    const region = content.regions[i], value = ((slot*17+i*13+((state.weatherSeed||1)%11))%23);
    state.weather[region.id] = {type:region.biome==='snow' && value>15?'snow':value>20?'storm':value>15?'rain':value>10?'cloud':'clear',wind:2+(slot+i)%8};
  }
}
function eventStart(event) { return finite(event.startsAt,DAY); }
function eventDeadline(event) { return finite(event.deadline,eventStart(event)+2*DAY); }
function applyEffects(state,content,effects={},eventId,playerAction=true) {
  const p = state.player;
  if(playerAction) p.gold = Math.max(0,p.gold+finite(effects.gold));
  for (const [region,delta] of Object.entries(effects.stock || {})) if (state.regions[region]) state.regions[region].stock = clamp(state.regions[region].stock+finite(delta),.15,3);
  for (const [region,delta] of Object.entries(effects.threat || {})) if (state.regions[region]) state.regions[region].threat = clamp(state.regions[region].threat+finite(delta),0,100);
  for (const [id,delta] of Object.entries(effects.resources || {})) state.resources[id] = finite(state.resources[id])+finite(delta);
  for (const id of effects.setFacts || []) state.facts[id] = {at:state.time,eventId};
  for (const id of effects.deaths || []) if(state.npcs[id])state.npcs[id].hp=0;
  if(playerAction) for (const id of effects.evidence || []) learnEvidence(state,id,{type:'acted',eventId},'行動の結果から新たな因果を確かめた。');
  if (playerAction&&effects.xp) awardXp(state,effects.xp,`outcome:${eventId}`);
}
function advanceEvents(state,content,gameDelta) {
  for (const event of content.events || []) {
    const current = state.events[event.id];
    if(current?.status==='failed'&&current.pendingFailureEffects) {
      applyEffects(state,content,event.failureEffects||{},event.id,false);
      const local=state.regions[event.region];if(local){local.stock=Math.max(.25,local.stock-.15);local.threat+=12;}
      state.facts[`failure:${event.id}`]={at:state.time,eventId:event.id};delete current.pendingFailureEffects;
    }
    if (!current || ['resolved','prevented','failed'].includes(current.status)) continue;
    const start = eventStart(event), deadline = eventDeadline(event);
    if (state.time >= start) {
      if (current.status==='latent') { current.status='active'; current.startedAt=start; }
      if(deadline-state.time<=6*3600)current.status='critical';
    }
    if (state.time >= deadline) {
      failCausality(state,content,event);
      applyEffects(state,content,event.failureEffects || {},event.id,false);
      delete current.pendingFailureEffects;
      const local = state.regions[event.region]; if (local) { local.stock=Math.max(.25,local.stock-.15); local.threat+=12; }
      state.facts[`failure:${event.id}`] = {at:state.time,eventId:event.id};
      // Outcome is not pushed to the player until witnessed or reported.
    }
  }
}
function updateKnowledgeFromSight(state,content) {
  const p = state.player;
  for (const event of content.events || []) {
    const current = state.events[event.id]; if (!current) continue;
    const visible = current.status!=='latent';
    const point = event.position || [0,0,0], sight = visible?36:10;
    const region=index(content).regions.get(event.region);
    if (playerIsLocal(state) && p.region===event.region && distance(p.position,point)<sight && hasLineOfSight(region,p.position,point)) learnEvent(state,content,event.id,{type:'seen',region:event.region});
    if (visible) for (const npc of values(state.npcs)) if (npc.hp>0 && !npc.travel && npc.region===event.region && distance(npc.position,point)<42 && hasLineOfSight(region,npc.position,point))
      learnEvent(state,content,event.id,{type:'seen',region:event.region},npc);
  }
}
function chooseGoal(state,content,npc,template) {
  const region = index(content).regions.get(npc.region), h = hour(state);
  const danger = values(state.monsters).find(m=>m.region===npc.region && m.hp>0 && distance(m.position,npc.position)<11 && m.activity==='attack');
  const localProblem = (content.events || []).find(e=>e.region===npc.region && ['active','critical'].includes(state.events[e.id]?.status) && npc.knowledge.some(k=>k.eventId===e.id));
  const guardian = /衛|兵|騎士|冒険|狩人/.test(template.role || '');
  const utilities = [
    {goal:'flee',utility:danger&&!guardian?120:0,target:template.home,activity:'危険から避難'},
    {goal:'defend',utility:danger&&guardian?110:0,target:danger?.position,activity:'周囲を守る'},
    {goal:'sleep',utility:h<6||h>=22?90:npc.fatigue>85?75:0,target:template.home,activity:'睡眠'},
    {goal:'eat',utility:npc.hunger>65||h>=12&&h<13?80:0,target:template.home,activity:'食事'},
    {goal:'respond',utility:localProblem&&h>=7&&h<19?(willingToCooperate(state,npc)?62:54):0,target:localProblem?.position,activity:'事件への対処'},
    {goal:'work',utility:h>=7&&h<18&&!knownWorkplaceClosed(npc,template.workFacilityId)?50:0,target:template.work,activity:template.role ? `${template.role}の仕事`:'仕事'},
    {goal:'social',utility:h>=18&&h<22?55:20,target:region?.objects?.find(o=>o.kind==='inn')?.position || template.home,activity:'会話と休憩'},
  ];
  const chosen = utilities.sort((a,b)=>b.utility-a.utility)[0];
  const belief=(npc.beliefs||[]).find(b=>!b.checkedAt&&b.place?.region===npc.region&&['ill','missing-property','property-interference','possible-water-hazard'].includes(b.claim));
  if(belief&&chosen.utility<75){chosen.goal='investigate-observation';chosen.activity='気になった場所を確かめる';chosen.target=belief.place.position;}
  const warning=npc.knowledge.find(k=>k.interpretation==='warning'&&k.relatedEventId&&k.region===npc.region&&!state.facts[`${k.relatedEventId}:warning-checked:${npc.id}`]);
  if(warning&&chosen.utility<75){const event=index(content).events.get(warning.relatedEventId);if(event){chosen.goal='inspect-warning';chosen.activity='噂の現場を確かめる';chosen.target=event.position;}}
  if(!npc.plan||npc.plan.goal!==chosen.goal||JSON.stringify(npc.goalTarget)!==JSON.stringify(chosen.target))npc.plan=planForGoal(state,content,npc,template,chosen);
  npc.goal=chosen.goal; npc.activity=chosen.activity; npc.goalTarget=[...(chosen.target || template.home || [0,0,0])];
  if (danger) npc.threatId = danger.id; else delete npc.threatId;
}
function advanceNpcs(state,content,gameDelta) {
  const idx = index(content), realDelta = gameDelta / (content.time?.scale || 60), day = Math.floor(state.time/DAY);
  for (const npc of values(state.npcs)) {
    if (npc.hp<=0) { npc.activity='倒れている'; continue; }
    npc.hunger=clamp(npc.hunger+gameDelta/DAY*75,0,100);npc.fatigue=clamp(npc.fatigue+gameDelta/DAY*60,0,100);
    if(npc.rescueAssignment||npc.causalAssignment||npc.entrapment||npc.aftermathAssignment||npc.care?.status==='injured'||npc.companionOf)continue;
    if(advanceSocialPlan(state,content,npc,gameDelta))continue;
    const original=idx.npcs.get(npc.id);if(!original)continue;let template=npc.displacedHome?{...original,home:npc.displacedHome,work:npc.displacementCause?original.work:npc.displacedHome}:{...original};
    if(npc.region!==template.region&&!npc.displacedHome){template.home=idx.regions.get(npc.region)?.spawn||[0,0,0];template.work=template.home;}
    if (npc.travel) {
      if (state.time>=npc.travel.arrivesAt) {
        npc.region=npc.travel.to; npc.position=[...(idx.regions.get(npc.region)?.spawn || [0,0,0])]; npc.travel=null; npc.path=[];npc.nextDecision=0;delete npc.plan;template={...original,home:idx.regions.get(npc.region).spawn,work:idx.regions.get(npc.region).spawn};
      } else { npc.activity='街道を旅している'; continue; }
    }
    const region = idx.regions.get(npc.region); if (!region) continue;
    const workplace=region.objects.find(o=>o.id===template.workFacilityId);
    if(workplace&&state.facilities?.[workplace.id]&&distance(npc.position,workplace.position)<12&&hasLineOfSight(region,npc.position,workplace.position))
      observeWorkplace(state,npc,workplace,!!state.facilities[workplace.id].closed);
    if (state.time>=npc.nextDecision || !npc.goalTarget) { chooseGoal(state,content,npc,template); npc.nextDecision=state.time+300; }
    advancePlan(state,content,npc,gameDelta);
    const arrived = distance(npc.position,npc.goalTarget || npc.position)<2;
    if(arrived&&npc.goal==='inspect-warning'){
      const warning=npc.knowledge.find(k=>k.interpretation==='warning'&&k.relatedEventId&&k.region===npc.region&&!state.facts[`${k.relatedEventId}:warning-checked:${npc.id}`]);
      if(warning){const eventId=warning.relatedEventId;state.facts[`${eventId}:warning-checked:${npc.id}`]={at:state.time,eventId};
        npc.knowledge.push({id:`warning-report:${eventId}:${npc.id}`,kind:'rumor',text:'妙な徴を見て現場を確かめた。念のため人を近づけず、見張りを立てることにした。',region:npc.region,relatedEventId:eventId,observedAt:state.time,confidence:.55,source:{type:'seen',actorId:npc.id}});
        const checks=Object.keys(state.facts).filter(id=>id.startsWith(`${eventId}:warning-checked:`)).length;
        if(checks>=2)state.facts[`${eventId}:public-warning`]={at:state.time,eventId};
      }
    }
    if (npc.goal==='defend' && npc.threatId) {
      const monster=state.monsters[npc.threatId]; if(monster?.hp>0 && distance(npc.position,monster.position)<3) {
        monster.hp=Math.max(0,monster.hp-realDelta*6); npc.hp=Math.max(1,npc.hp-realDelta*2); monster.lastThreat=state.simulationTime;
        if(monster.hp===0) monster.respawnAt=state.time+DAY;
      }
    }
    if(arrived&&npc.goal==='respond'&&npc.lastHelpDay!==day){
      const event=(content.events||[]).find(e=>e.region===npc.region&&distance(e.position||[0,0,0],npc.position)<4);
      if(event){rememberAction(state,content,'site-inspection',{actorId:npc.id,payload:{eventId:event.id}});npc.lastHelpDay=day;}
    }
    // Merchants physically reach an exit before departing. Their knowledge travels
    // with them and can only spread after arrival through face-to-face contact.
    if (/行商|商人|交易|運び|船長|配達/.test(template.role || '') && hour(state)>=13 && hour(state)<18 && npc.lastTradeDay!==day) {
      const route = (content.routes || []).find(r=>r.from===npc.region||r.to===npc.region);
      const portal = region.portals?.find(p=>p.routeId===route?.id);
      if (route && portal) {
        npc.goal='travel'; npc.activity='街道へ向かう'; npc.goalTarget=portal.position;
        followPath(region,npc,portal.position,realDelta*1.8);
        if(distance(npc.position,portal.position)<3) {
          npc.travel={to:route.from===npc.region?route.to:route.from,arrivesAt:state.time+finite(route.minutes,60)*60};
          npc.lastTradeDay=day; npc.path=[];
        }
      }
    }
  }
}
function socialTick(state,content) {
  if (state.time<state.nextSocial) return;
  state.nextSocial=state.time+600;
  const npcs=values(state.npcs).filter(n=>n.hp>0&&!n.travel&&n.goal!=='sleep');
  for (let i=0;i<npcs.length;i++) for (let j=i+1;j<npcs.length;j++) {
    const a=npcs[i],b=npcs[j]; if(a.region!==b.region||distance(a.position,b.position)>7||!hasLineOfSight(index(content).regions.get(a.region),a.position,b.position)) continue;
    for (const [speaker,listener] of [[a,b],[b,a]]) {
      exchangeCrimeMemories(state,speaker,listener);
      const fact=speaker.knowledge.find(k=>k.kind!=='secret'&&k.disclosure?.visibility!=='private'&&(!k.belief?.factId||!speaker.memories.some(m=>m.factId===k.belief.factId&&m.status==='forgotten'))&&!listener.knowledge.some(l=>l.id===k.id)); if(!fact) continue;
      const transmission={from:speaker.id,to:listener.id,at:state.time,region:speaker.region,position:[...speaker.position]};
      listener.knowledge.push({...clone(fact),receivedAt:state.time,transmissions:[...(fact.transmissions||[]),transmission].slice(-16),confidence:Math.max(.35,(fact.confidence??1)*.85),source:{type:'heard',actorId:speaker.id,origin:fact.source?.origin||fact.source}});
      const memory=recalled(speaker,fact.belief?.factId||fact.id);if(memory)hearTestimony(state,listener,speaker,testimony(state,speaker,memory));
      if(fact.kind==='workplace-status')listener.nextDecision=0;
      if(fact.belief&&!listener.beliefs.some(b=>b.id===fact.belief.id)){listener.beliefs.push({...clone(fact.belief),confidence:Math.max(.2,fact.belief.confidence*.85),source:{type:'heard',actorId:speaker.id,previous:clone(fact.belief.source)},receivedAt:state.time});listener.nextDecision=0;}
    }
  }
}
function advancePlayer(state,content,gameDelta) {
  const p=state.player,region=index(content).regions.get(p.region),dt=gameDelta/(content.time?.scale||60),input=state.input;
  if(!canMove(state)) return;
  const mode=MOVEMENT[p.mode] || MOVEMENT.foot;
  let speed=input.sprint&&p.stamina>5?(mode.sprint||mode.speed):mode.speed;
  if(p.guarding)speed*=.55;
  if(p.debuffs?.paralysis)speed*=.65;
  if (p.mode==='broom' && p.mp<=0) {
    let landing=[p.position[0],0,p.position[2]];
    for(let radius=2;!canOccupy(region,landing)&&radius<40;radius+=2){
      for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){const point=[p.position[0]+Math.sin(angle)*radius,0,p.position[2]+Math.cos(angle)*radius];if(canOccupy(region,point)){landing=point;break;}}
    }
    p.position=canOccupy(region,landing)?landing:[...(region.spawn||[0,0,8])];p.mode='foot';speed=MOVEMENT.foot.speed;
    log(state,'魔力が尽き、近くの安全な地面に不時着した。','travel');
  }
  const magnitude=Math.hypot(input.x,input.z), moving=magnitude>.001;
  if (moving || input.ascend && p.mode==='broom') {
    const nx=input.x/Math.max(1,magnitude),nz=input.z/Math.max(1,magnitude),before=[...p.position];
    p.position=moveBody(region,p.position,[nx*speed*dt,p.mode==='broom'?input.ascend*5*dt:0,nz*speed*dt]);
    p.heading=input.heading;
    const walked=distance(before,p.position); p.mastery.distance=finite(p.mastery.distance)+walked;
    if (input.sprint && moving) p.stamina=Math.max(0,p.stamina-dt*6);
    else p.stamina=Math.min(100,p.stamina+dt*5);
    if(p.mode==='broom') p.mp=Math.max(0,p.mp-dt*.3);
  } else p.stamina=Math.min(100,p.stamina+dt*10);
  if(p.mode!=='broom'&&state.simulationTime-p.lastAttack>10) p.mp=Math.min(p.maxMp,p.mp+dt*.18);
}
function advanceMonsters(state,content,gameDelta) {
  const idx=index(content),p=state.player,dt=gameDelta/(content.time?.scale||60);
  tickCombatEffects(state,p,dt,1);
  for(const monster of values(state.monsters)) {
    const template=idx.monsters.get(monster.templateId),region=idx.regions.get(monster.region); if(!template||!region) continue;
    if(monster.expiresAt&&state.simulationTime>=monster.expiresAt){delete state.monsters[monster.id];continue;}
    if(monster.hp<=0) {
      if(monster.respawnAt && state.time>=monster.respawnAt && (p.region!==monster.region||distance(p.position,monster.home)>35)) {
        monster.hp=monster.maxHp;monster.position=[...monster.home];monster.respawnAt=0;monster.activity='roam';
      } continue;
    }
    monster.cooldown=Math.max(0,monster.cooldown-dt);
    tickCombatEffects(state,monster,dt,1);
    resolveEnemyAction(state,content,monster,template);
    if(p.hp<=0)collapse(state,content,'hp');
    if(monster.fleeUntil>state.simulationTime){monster.activity='flee';followPath(region,monster,region.portals?.[0]?.position||monster.home,dt*3);continue;}
    const near=playerIsLocal(state)&&p.region===monster.region?distance(p.position,monster.position):Infinity;
    const night=hour(state)<6||hour(state)>20,alert=night?16:12;
    const engaged=p.hp>0&&p.collapse?.status!=='active'&&(near<alert || state.simulationTime-monster.lastThreat<6) && near<32 && p.position[1]<6 && hasLineOfSight(region,monster.position,p.position);
    if(engaged) {
      monster.activity='attack';monster.heading=Math.atan2(p.position[0]-monster.position[0],p.position[2]-monster.position[2]);
      if(near>finite(template.range,2.8)) followPath(region,monster,[p.position[0],0,p.position[2]],dt*finite(template.speed,2));
      else if(monster.cooldown<=0 && !monster.intent) startEnemyAction(state,content,monster,template);
    } else { monster.activity='roam'; if(distance(monster.position,monster.home)>1) followPath(region,monster,monster.home,dt); }
  }
}
function combatNearby(state,content) {
  const p=state.player,region=index(content).regions.get(p.region);
  if(p.actionInstance&&p.hp>0)return true;
  return playerIsLocal(state)&&p.hp>0&&values(state.monsters).some(m=>m.hp>0&&m.region===p.region&&
    distance(m.position,p.position)<(m.activity==='attack'||m.intent?32:12)&&p.position[1]<6&&hasLineOfSight(region,m.position,p.position));
}
function advanceCalendar(state,content,delta) {
  state.time+=delta;expirePromises(state);advancePropertyDiscovery(state,content);advanceCausality(state,content,delta);advanceEvents(state,content,delta);updateIncidentPopulation(state,content);
  advanceNeeds(state,content,delta);advanceNpcs(state,content,delta);advanceRescue(state,content,delta);advanceMemories(state,content);advanceLaw(state,content);socialTick(state,content);updateWeather(state,content);
  if(!state.cycleComplete&&state.time>=finite(content.time?.days,10)*DAY) {
    state.cycleComplete=true;log(state,'十日が過ぎた。変化した世界で、あなたの暮らしは続いている。','chapter');
  }
}
export function advanceWorld(state,content,realSeconds) {
  if (!Number.isFinite(realSeconds)||realSeconds<0) fail('INVALID_TIME','時間の指定が不正です。');
  migrateWorld(state,content);
  const scale=clamp(finite(content.time?.scale,60),1,600);
  if(state.player.activity.worldTimePolicy==='paused')return state;
  let remaining=realSeconds;
  while(remaining>1e-8) {
    const fighting=combatNearby(state,content);
    if(fighting&&canMove(state))setActivity(state,'combat');
    else if(!fighting&&state.player.activity.kind==='combat')setActivity(state,'idle');
    const dt=Math.min(remaining,fighting||Math.hypot(state.input.x,state.input.z)>0?.1:.5);
    state.simulationTime+=dt;
    if(!fighting)advanceCalendar(state,content,dt*scale);
    advancePlayer(state,content,dt*scale);advanceMonsters(state,content,dt*scale);advancePlayerAction(state,content);
    updateKnowledgeFromSight(state,content);remaining-=dt;
  }
  return state;
}
export function advanceMacro(state,content,kind,seconds,details={}) {
  if(!Number.isFinite(seconds)||seconds<=0||seconds>12*3600)fail('INVALID_TIME','行動時間が不正です。');
  const previous=clone(state.player.activity);
  setActivity(state,kind,{...details,expectedEndAt:state.time+seconds});
  const startedAt=state.time;let remaining=seconds;
  while(remaining>1e-7) {
    let delta=Math.min(remaining,300);
    for(const event of content.events||[])for(const boundary of [eventStart(event),eventDeadline(event)])
      if(boundary>state.time+1e-7)delta=Math.min(delta,boundary-state.time);
    advanceCalendar(state,content,delta);remaining-=delta;
    if(state.player.collapse?.status==='active'&&!['collapsed','recovering'].includes(kind))break;
  }
  state.activityHistory||=[];
  state.activityHistory.push({...clone(state.player.activity),kind,endedAt:state.time,startedAt,completed:remaining<1e-7});
  if(state.player.collapse?.status!=='active'){if(['collapsed','recovering'].includes(previous.kind))setActivity(state,'idle');else state.player.activity=previous;}zeroInput(state);
  return remaining<1e-7;
}

function targetAt(state,content,id,range=INTERACTION) {
  const region=index(content).regions.get(state.player.region);
  let target=(region.objects || []).map(o=>({...o,...state.facilities?.[o.id]})).find(o=>o.id===id), hiddenEvent=false;
  const npc=state.npcs[id],template=index(content).npcs.get(id);
    if(npc && template && npc.region===state.player.region&&!npc.travel&&!npc.entrapment) target={...template,...npc,kind:'npc'};
  if(String(id).startsWith('event:')) {
    const event=index(content).events.get(String(id).slice(6));
    if(event?.region===state.player.region) {
      // Event ids are private server data. Being able to guess an id must not
      // turn a hidden crisis into an interaction target; the player first has
      // to acquire the event through sight, reading or a local conversation.
      hiddenEvent=!state.knowledge.some(fact=>fact.kind==='event'&&fact.eventId===event.id);
      target={id,kind:'event',eventId:event.id,position:event.position || [0,0,0],name:event.name};
    }
  }
  if(!target || !target.position) fail('TARGET_MISSING','対象はこの地域にいません。',404);
  if(distance(state.player.position,target.position)>range) fail('TOO_FAR','もっと近づいてください。',409);
  if(!hasLineOfSight(region,state.player.position,target.position))fail('OBSTRUCTED','間に障害物があります。',409);
  if(hiddenEvent) fail('UNKNOWN_EVENT','まだその事件のことを知らない。',404);
  if(target.hp!==undefined&&target.hp<=0) fail('TARGET_UNAVAILABLE','今は応答できません。',409);
  return target;
}
function recordWitnesses(state,content,text,kind,misunderstanding=false) {
  const p=state.player,id=`witness:${state.nextId++}`;
  for(const npc of values(state.npcs)) if(npc.hp>0&&!npc.travel&&npc.region===p.region&&distance(npc.position,p.position)<22&&hasLineOfSight(index(content).regions.get(p.region),npc.position,p.position)) {
    npc.knowledge.push({id,kind,text:misunderstanding?'旅人が不思議な徴を示した。儀式か、警告かもしれない。':text,region:p.region,
      observedAt:state.time,source:{type:'seen',actorId:'player'},confidence:misunderstanding?.5:1});
    if(npc.knowledge.length>120) npc.knowledge.splice(0,npc.knowledge.length-120);
  }
}
function requirementsMissing(state,content,requirements={},targetNpcId) {
  const p=state.player,missing=[];
  if(p.gold<finite(requirements.gold)) missing.push(`${requirements.gold}G`);
  for(const [id,amount] of Object.entries(requirements.items || requirements.inventory || {}))
    if(finite(p.inventory[id])<finite(amount)) missing.push(`${index(content).items.get(id)?.name || index(content).materials.get(id)?.name || id} ×${amount}`);
  for(const id of requirements.skills || []) if(!p.skills.includes(id)) missing.push(index(content).skills.get(id)?.name || id);
  for(const id of requirements.evidence || []) if(!p.evidence.includes(id)) {
    const place=(content.regions||[]).flatMap(r=>r.objects||[]).find(o=>o.evidenceId===id||o.rumorEvidenceId===id);
    missing.push(place?`調査：${place.name}`:id.endsWith(':misread')?'目撃された奇妙な徴':id.endsWith(':threat-reduced')?'現場の実行勢力を実際に退ける':'関連する調査・行動の証拠');
  }
  for(const id of requirements.facts || []) if(!state.facts[id]) missing.push(id.endsWith(':public-warning')?'噂を聞いた住民たちが現場を確かめ、警戒を始める':'関連する世界の変化を確かめる');
  if(requirements.trust)missing.push('当事者との具体的な合意が必要');
  if(forceOf(p,content)<finite(requirements.force)) missing.push(`武力 ${requirements.force}`);
  return missing;
}
function travelEstimate(state,content,route,mode) {
  const capability=MOVEMENT[mode], factor=TRAVEL_FACTOR[mode] ?? .8;
  const minutes=Math.max(1,finite(route?.minutes,60)*factor);
  const cost=Math.max(0,finite(route?.costs?.[mode],finite(capability?.cost,0)));
  const risk=clamp(finite(route?.risk,0),0,1), riskKey=risk>=.2?'danger':risk>=.1?'watch':'safe';
  const missing=[];
  if(capability?.skill&&!state.player.skills.includes(capability.skill)) missing.push(index(content).skills.get(capability.skill)?.name || capability.skill);
  if(capability?.item&&!state.player.inventory[capability.item]) missing.push(`${index(content).items.get(capability.item)?.name || capability.item}を所有`);
  if(mode==='broom'&&state.weather[state.player.region]?.type==='storm') missing.push('嵐が収まること');
  if(state.player.gold<cost) missing.push(`${cost}G`);
  return {minutes,cost,risk,riskLabel:TRAVEL_RISK_LABEL[riskKey],missing,label:TRAVEL_LABEL[mode] || mode};
}
function resolveTravelHazard(state,content,route,mode,originRegion) {
  const baseRisk=clamp(finite(route?.risk,0),0,1);if(baseRisk<=0)return null;
  const modeFactor={foot:1,horse:.8,carriage:.55,broom:.4,boat:.9,ship:.65,wagon:.75,magic:.25}[mode]||1;
  const preparation=state.player.skills.includes('survival')?.55:1;
  if(random(state)>=baseRisk*modeFactor*preparation)return null;
  const damage=Math.max(2,Math.round(7+state.player.level*1.4+baseRisk*8));
  state.player.hp=Math.max(10,state.player.hp-damage);
  state.player.stamina=Math.max(0,state.player.stamina-(mode==='foot'?22:12));
  if(state.regions[originRegion])state.regions[originRegion].threat=clamp(state.regions[originRegion].threat+Math.round(baseRisk*8),0,100);
  const day=Math.floor(state.time/DAY),key=`travel-hazard:${route.id}:${day}`;
  state.facts[key]={at:state.time,routeId:route.id,mode,damage};
  const message=`${route.description||'街道'}で危険に遭遇した。${damage}の損傷を受けたが、旅を続けられる。`;
  log(state,message,'travel');
  return {damage,risk:baseRisk,mode,fact:key};
}
function itemsForShop(state,content,target) {
  const candidates=(content.items || []).filter(item=>!item.saleOnly&&(!item.regions || item.regions.includes(state.player.region)));
  const regular=candidates.filter(item=>target.kind==='stable'?['horse','broom','rope','supplies'].includes(item.id):!['horse','broom'].includes(item.id));
  const equipment=target.kind==='shop'?(content.equipmentShops || []).filter(s=>s.region===state.player.region&&s.available).map(s=>({...index(content).equipment.get(s.itemId),id:s.itemId,price:s.price,kind:'equipment'})):[];
  return [...regular,...equipment].filter((item,i,list)=>list.findIndex(x=>x.id===item.id)===i);
}
function zeroInput(state) { state.input={x:0,z:0,sprint:false,ascend:0,heading:state.player.heading}; }
function resolvePlayerHit(state,content,action) {
  const p=state.player,idx=index(content),monster=state.monsters[action.targetId],magic=action.skillId==='magic';
  const region=idx.regions.get(p.region);
  if(p.hp<=0||p.staggerUntil>state.simulationTime||!monster||monster.hp<=0||monster.region!==action.region||p.region!==action.region)return {damage:0,miss:true};
  if(distance(p.position,monster.position)>action.hitVolume.radius||!hasLineOfSight(region,p.position,monster.position))return {damage:0,miss:true};
    const template=idx.monsters.get(monster.templateId),gear=idx.equipment.get(p.equipment.mainHand);
    let damage=Math.max(2,(magic?19:12)+p.level*2+finite(magic?gear?.magic:gear?.attack)-finite(template.defense)-finite(monster.modifiers?.defense?.stage)*2);
    const barrier=monster.specialStates?.barrier;if(barrier){const absorbed=Math.min(barrier.capacity||0,damage);damage-=absorbed;barrier.capacity-=absorbed;}
    if(monster.specialStates?.survive_lethal&&damage>=monster.hp){damage=Math.max(0,monster.hp-1);delete monster.specialStates.survive_lethal;}
    p.lastCombatDamage=damage;p.lastActionTag=magic?'magic':'physical';
    monster.hp=Math.max(0,monster.hp-damage);monster.lastThreat=state.simulationTime;p.lastAttack=state.simulationTime;
    p.mastery[magic?'magic':'combat']=finite(p.mastery[magic?'magic':'combat'])+1;recordWitnesses(state,content,`${p.name}が${template.name}から街道を守った。`,'combat');
    if(monster.hp===0) {
      monster.respawnAt=monster.eventId||monster.summoned?0:state.time+DAY;const earned=awardXp(state,monster.summoned?Math.min(5,template.xp):template.xp,`combat:${template.id}`);if(!monster.summoned)p.gold+=finite(template.gold,2);
      if(monster.eventId) {
        const current=state.events[monster.eventId];

        state.facts[`defeated:${template.id}`]={at:state.time,eventId:monster.eventId};
        learnEvidence(state,`${monster.eventId}:threat-reduced`,{type:'acted',targetId:monster.id},'襲撃の実行勢力を退け、現場の脅威を退けた。');
      }
      if(!monster.summoned)for(const drop of template.drops || [])if(random(state)<finite(drop.chance)){p.inventory[drop.itemId]=finite(p.inventory[drop.itemId])+1;}
      log(state,`${template.name}を退けた。${earned}EXP。`,'combat');return {message:`${template.name}を退けた。`,damage,defeated:true,xp:earned};
    }
    return {message:`${damage}ダメージ。`,damage,defeated:false};
}
function advancePlayerAction(state,content) {
 const p=state.player,a=p.actionInstance;if(!a)return;
 const elapsed=state.simulationTime-a.startedAt;
 if(p.hp<=0||p.staggerUntil>state.simulationTime){a.phase='cancelled';p.lastActionInstance=a;delete p.actionInstance;return;}
 if(!a.resolved&&elapsed>=a.hitWindow.opensAt){a.phase='active';a.resolved=true;a.result=resolvePlayerHit(state,content,a);a.hitAt=state.simulationTime;}
 if(elapsed>=a.hitWindow.closesAt)a.phase='recovery';
 if(elapsed>=a.duration){a.phase='completed';p.lastActionInstance=a;delete p.actionInstance;}
}

export function applyCommand(state,content,command) {
  if(!command || typeof command.type!=='string') fail('INVALID_COMMAND','操作が不正です。');
  const p=state.player,idx=index(content);
  if(p.collapse?.status==='active'&&!['input','pause','resume','recover'].includes(command.type))fail('COLLAPSED','倒れています。救助を待ってください。',409);
  if(['attack','dodge','defend'].includes(command.type)&&p.activity?.worldTimePolicy==='paused')fail('ACTIVITY_PAUSED','画面を閉じて行動を再開してください。',409);
  if(command.type==='affordance')return performAffordance(state,content,command);
  if(command.type==='causal') {const target=targetAt(state,content,command.targetId);const result=applyCausalAction(state,content,target,command.action);advanceCausality(state,content,0);if(target.kind!=='npc'){p.inspections||={};p.inspections[target.id]={...p.inspections[target.id],at:state.time,work:causalActions(state,content,target)};}setActivity(state,'inspecting',{targetId:target.id});return result;}
  if(command.type==='converse')return converse(state,content,command);
  if(command.type==='resume') {if(p.collapse?.status==='active')return {message:null};if(state.conversation)state.conversation.status='ended';setActivity(state,'idle');return {message:null};}
  if(command.type==='pause') {if(p.collapse?.status!=='active')setActivity(state,'menu');return {message:null};}
  if(command.type==='property')return performPropertyAction(state,content,command);
  if(command.type==='track')return trackLead(state,content,command.leadId);
  if(command.type==='maintain') {
    const target=targetAt(state,content,command.targetId),work=startStructureWork(state,content,target.id,command.action);
    if(!advanceMacro(state,content,'crafting',work.action.minutes*60,{targetId:target.id,operation:work.action.id}))return {message:'作業を中断した。資材は現場で使った。'};
    finishStructureWork(state,content,work);advanceCausality(state,content,0);setActivity(state,'inspecting',{targetId:target.id});
    p.inspections||={};p.inspections[target.id]={at:state.time,...structureObservation(state,content,target.id)};
    return {message:p.inspections[target.id].text};
  }
  if(command.type==='recover') {if(p.collapse?.status!=='active')fail('NOT_COLLAPSED','救助待ちではありません。');for(let i=0;i<72&&p.collapse.status==='active';i++)advanceCalendar(state,content,300);return {message:p.collapse.status==='active'?'まだ救助に至っていない。':'手当てを受けて目を覚ました。'};}
  if(p.collapse?.status==='active'&&command.type!=='input')fail('COLLAPSED','倒れています。救助を待ってください。',409);
  if(command.type==='input') {
    for(const key of ['x','z','ascend','heading']) if(command[key]!==undefined && (!Number.isFinite(command[key]) || Math.abs(command[key])>(key==='heading'?1e6:1))) fail('INVALID_INPUT','移動入力が不正です。');
    if(!canMove(state))return {message:null};
    if(command.x||command.z)p.posture='stand';
    if(p.activity.kind!=='combat')setActivity(state,command.x||command.z?(command.sprint?'running':'walking'):'idle');
    state.input={x:command.x || 0,z:command.z || 0,sprint:command.sprint===true,ascend:command.ascend || 0,heading:command.heading ?? p.heading};
    return {message:null};
  }
  if(command.type==='interact') {
    const target=targetAt(state,content,command.targetId),action=command.action || (target.kind==='npc'?'talk':'inspect');
    if(action==='intervene')fail('RETIRED_MECHANISM','結果を選ぶ介入は廃止されました。現場の人や物へ働きかけてください。',409);
    if(action==='talk') return beginConversation(state,content,target);
    if(action==='help' && target.kind==='npc') {
      const npc=state.npcs[target.id],key=`help:${npc.id}:${Math.floor(state.time/DAY)}`;state.actionClaims ||= {};
      if(state.actionClaims[key]) fail('ALREADY_HELPED','今日の手伝いは十分だ。',409);
      if(!p.inventory.supplies) fail('NEED_SUPPLIES','手伝うための物資が必要です。',409);
      p.inventory.supplies--;deliverSupplies(state,content,npc);state.actionClaims[key]=true;
      recordWitnesses(state,content,`${p.name}が${target.name}へ物資を届けた。`,'aid');log(state,`${target.name}へ物資を届けた。`,'aid');return {message:'物資を手渡した。相手の持ち物に加わった。'};
    }
    if(action==='review'){setActivity(state,'inspecting',{targetId:target.id});return {message:state.player.inspections?.[target.id]?.text||target.description||`${target.name}を眺めた。`};}
    if(action!=='inspect') fail('INVALID_ACTION','この操作は使えません。');
    setActivity(state,'inspecting',{targetId:target.id});
    readNotices(state,target);
    if(target.eventId) learnEvent(state,content,target.eventId,{type:'read',region:p.region});
    if(target.evidenceId) learnEvidence(state,target.evidenceId,{type:'examined',targetId:target.id,region:p.region},target.description || `${target.name}を調べ、手がかりを得た。`);
    if(target.kind==='board') {
      // Notices are authored only for local events after their public signal.
      for(const event of content.events || []) if(event.region===p.region&&state.time>=eventStart(event)) learnEvent(state,content,event.id,{type:'read',targetId:target.id,region:p.region});
    }
    p.inspections||={};p.inspections[target.id]={at:state.time,text:target.description||`${target.name}を調べた。`,work:causalActions(state,content,target),...structureObservation(state,content,target.id)};
    if(['shop','stable','trainer','inn','board','job','workshop'].includes(target.kind)) {
      p.knownServices||={};p.knownServices[target.id]={id:target.id,name:target.name,region:p.region,position:clone(target.position),observedAt:state.time,source:{type:'examined',targetId:target.id},offers:actionsFor(state,content,target).filter(a=>['buy','work','train','rest','craft'].includes(a.type)).map(a=>clone(a))};
    }
    return {message:p.inspections[target.id].text};
  }
  if(command.type==='train') {
    const target=targetAt(state,content,command.targetId),skill=idx.skills.get(command.skillId);
    if(!skill) fail('SKILL_MISSING','技能が見つかりません。',404);
    if(target.kind!=='trainer') fail('NOT_TRAINER','訓練できる場所へ行ってください。',409);
    if(target.skills&&!target.skills.includes(skill.id)) fail('TRAINER_SPECIALTY','この師匠はその技能を教えていません。',409);
    if(p.skills.includes(skill.id)) fail('ALREADY_TRAINED','既に習得しています。',409);
    const lesson=lessonFor(skill),cost=finite(skill.cost??skill.spCost,1),gold=finite(skill.goldCost,12)/lesson.sessionsRequired;
    const missing=requirementsMissing(state,content,{skills:skill.requires || [],gold});
    for(const item of lesson.equipment)if(!p.inventory[item])missing.push(item);
    if(p.sp<cost) missing.push(`${cost}SP`);
    if(missing.length) fail('TRAINING_REQUIREMENTS',`必要：${missing.join('、')}`,409);
    p.gold-=gold;const completed=advanceMacro(state,content,'training',lesson.seconds,{targetId:target.id,skillId:skill.id});const course=recordLesson(state,skill,target,completed);if(!completed)return {message:'訓練を中断した。練習記録は残っている。'};if(course.mastery<1)return {message:`練習を終えた。習得進度 ${Math.round(course.mastery*100)}%。`};p.sp-=cost;p.skills.push(skill.id);awardXp(state,20,`training:${skill.id}`);zeroInput(state);
    log(state,`${skill.name}を習得した。できることが増えた。`,'skill');return {message:`${skill.name}を習得した。`};
  }
  if(command.type==='craft') {
    const target=targetAt(state,content,command.targetId),recipe=idx.recipes.get(command.recipeId),quantity=command.quantity ?? 1;
    if(!target.crafting)fail('NOT_WORKSHOP','工作設備のそばで作業してください。',409);
    if(!recipe)fail('RECIPE_MISSING','その製法は見つかりません。',404);
    if(recipe.facilityIds&&!recipe.facilityIds.includes(target.id))fail('RECIPE_UNAVAILABLE','この設備ではその製法を使えません。',409);
    if(!Number.isInteger(quantity)||quantity<1||quantity>5)fail('INVALID_QUANTITY','製作数は1〜5で指定してください。');
    const requirements=recipe.requirements || {},scaled={...requirements,items:Object.fromEntries(Object.entries(requirements.items || requirements.inventory || {}).map(([id,amount])=>[id,finite(amount)*quantity])),gold:finite(requirements.gold)*quantity};
    const missing=requirementsMissing(state,content,scaled);
    const outputs=recipe.outputs?.items || recipe.outputs || {};
    for(const [id,amount] of Object.entries(outputs)) if(!idx.items.has(id)) missing.push(`未知の製作品 ${id}`);
    if(missing.length)fail('CRAFT_REQUIREMENTS',`必要：${missing.join('、')}`,409);
    for(const [id,amount] of Object.entries(scaled.items || {}))p.inventory[id]=finite(p.inventory[id])-finite(amount);
    p.gold-=finite(scaled.gold);
    const duration=clamp(finite(recipe.minutes,30)*quantity,15,240);if(!advanceMacro(state,content,'crafting',duration*60,{targetId:target.id}))return {message:'製作中に倒れた。'};
    for(const [id,amount] of Object.entries(outputs))p.inventory[id]=finite(p.inventory[id])+finite(amount)*quantity;
    const earned=awardXp(state,finite(recipe.xp,24)*quantity,`craft:${recipe.id}`);
    p.mastery.crafting=finite(p.mastery.crafting)+quantity;
    if(state.regions[p.region])state.regions[p.region].stock=Math.min(2,state.regions[p.region].stock+.01*quantity);
    recordWitnesses(state,content,`${p.name}が${recipe.name}を仕上げた。`,'craft');
    log(state,`${recipe.name} ×${quantity}を製作した。${earned}EXP。`,'craft');
    return {message:`${recipe.name}を${quantity}個製作した。`,outputs:Object.fromEntries(Object.entries(outputs).map(([id,amount])=>[id,finite(amount)*quantity])),minutes:duration,xp:earned};
  }
  if(command.type==='buy') {
    const target=targetAt(state,content,command.targetId);
    if(!['shop','stable'].includes(target.kind)) fail('NOT_SHOP','店に近づいてください。',409);
    const item=itemsForShop(state,content,target).find(i=>i.id===command.itemId),quantity=command.quantity ?? 1;
    if(!item) fail('ITEM_UNAVAILABLE','この店では扱っていません。',404);
    if(!Number.isInteger(quantity)||quantity<1||quantity>99) fail('INVALID_QUANTITY','数量は1〜99で指定してください。');
    const price=priceOf(state,item,p.region)*quantity;if(p.gold<price)fail('NO_GOLD','所持金が足りません。',409);
    p.gold-=price;p.inventory[item.id]=finite(p.inventory[item.id])+quantity;
    log(state,`${item.name} ×${quantity}を${price}Gで買った。`,'purchase');return {message:`${item.name}を購入した。`,price};
  }
  if(command.type==='equip') {
    const equipment=idx.equipment.get(command.itemId);
    if(!equipment||!p.inventory[equipment.id])fail('EQUIPMENT_MISSING','持っている装備を指定してください。',409);
    p.equipment[equipment.slot]=equipment.id;log(state,`${equipment.name}を装備した。`,'equipment');return {message:`${equipment.name}を装備した。`};
  }
  if(command.type==='sell') {
    const target=targetAt(state,content,command.targetId);if(target.kind!=='shop')fail('NOT_SHOP','買い取り店に近づいてください。',409);
    const item=idx.items.get(command.itemId)||(content.materials||[]).find(i=>i.id===command.itemId)||idx.equipment.get(command.itemId),quantity=command.quantity??1;
    if(!item||!Number.isInteger(quantity)||quantity<1||quantity>99||finite(p.inventory[item.id])<quantity)fail('ITEM_MISSING','売却できる持ち物がありません。',409);
    if(Object.values(p.equipment).includes(item.id))fail('ITEM_EQUIPPED','装備中の品は売却できません。',409);
    if(['horse','broom'].includes(item.id)&&p.mode===item.id)fail('MOUNTED','乗り物から降りてください。',409);
    const market=(content.equipmentShops||[]).find(s=>s.itemId===item.id),base=item.price??market?.price??10;
    const price=Math.max(1,Math.round(base*(item.kind==='material'?1:.4)))*quantity;
    p.inventory[item.id]-=quantity;p.gold+=price;log(state,`${item.name} ×${quantity}を${price}Gで売った。`,'sale');return {message:`${price}Gで買い取ってもらった。`,price};
  }
  if(command.type==='eat') {
    const item=idx.items.get(command.itemId),target=command.targetId?targetAt(state,content,command.targetId):null;
    if(!item||!(item.kind==='food'||['food','supplies'].includes(item.id))||!p.inventory[item.id])fail('FOOD_MISSING','食事がありません。',409);
    if(target&&!['inn','camp','bench'].includes(target.kind))fail('FOOD_CONTEXT','ここでは食事をとれません。',409);
    if(!target&&(p.position[1]>1||combatNearby(state,content)))fail('UNSAFE_MEAL','食事ができる場所へ移動してください。',409);
    p.inventory[item.id]--;p.hunger=Math.max(0,p.hunger-NEEDS.mealRelief);
    if(!advanceMacro(state,content,'eating',900,{targetId:target?.id||null,context:target?.kind||'travel-ration'}))return {message:'食事中に倒れた。'};
    rememberAction(state,content,'meal',{targetId:target?.id,payload:{itemId:item.id}});
    return {message:'腰を下ろして食事をとった。15分が過ぎた。'};
  }
  if(command.type==='use') {
    const item=idx.items.get(command.itemId);if(!item||!p.inventory[item.id])fail('ITEM_MISSING','アイテムを持っていません。',409);
    if(item.kind==='food'||['food','supplies'].includes(item.id))fail('FOOD_CONTEXT','食事は宿や野営、携帯食として行ってください。',409);
    if(!['medicine'].includes(item.id)&&!item.heal)fail('NOT_CONSUMABLE','ここでは使用できません。');
    p.inventory[item.id]--;p.hp=Math.min(p.maxHp,p.hp+(item.heal||35));p.stamina=Math.min(100,p.stamina+25);
    log(state,`${item.name}を使った。`,'item');return {message:'体力を回復した。'};
  }
  if(command.type==='mount') {
    const mode=MOVEMENT[command.mode];if(!mode||!['foot','horse','broom'].includes(command.mode))fail('INVALID_MODE','その移動手段には直接乗れません。');
    if(command.mode==='foot') {
      if(p.position[1]>1)fail('LAND_FIRST','地面まで降りてください。',409);
      p.mode='foot';p.position[1]=0;return {message:'降りた。'};
    }
    if(!p.skills.includes(mode.skill))fail('NEED_SKILL',`${idx.skills.get(mode.skill)?.name || mode.skill}が必要です。`,409);
    if(!p.inventory[mode.item])fail('NEED_MOUNT','乗り物を所有していません。',409);
    if(command.mode==='broom'&&p.mp<5)fail('NO_MP','飛ぶための魔力が足りません。',409);
    p.mode=command.mode;return {message:command.mode==='horse'?'馬に乗った。':'箒に乗った。Space / Shiftで上昇・下降できる。'};
  }
  if(command.type==='travel') {
    const region=idx.regions.get(p.region),portal=region.portals?.find(o=>o.id===command.portalId);
    if(!portal)fail('PORTAL_MISSING','出口が見つかりません。',404);
    if(distance(p.position,portal.position)>finite(portal.radius,3)+1)fail('TOO_FAR','街道の出口まで歩いてください。',409);
    const route=idx.routes.get(portal.routeId),mode=command.mode || p.mode;
    if(!route||(route.from!==p.region&&route.to!==p.region)||!(route.modes||['foot']).includes(mode)||!MOVEMENT[mode])fail('TRAVEL_MODE','この街道では使えない移動手段です。',409);
    const capability=MOVEMENT[mode];
    if(capability.skill&&!p.skills.includes(capability.skill))fail('NEED_SKILL','必要な移動技能を習得していません。',409);
    if(capability.item&&!p.inventory[capability.item])fail('NEED_MOUNT','必要な乗り物を持っていません。',409);
    if(mode==='broom'&&state.weather[p.region]?.type==='storm')fail('STORM','嵐で空路が閉じています。',409);
    const estimate=travelEstimate(state,content,route,mode),cost=estimate.cost,minutes=estimate.minutes;
    if(p.gold<cost)fail('NO_GOLD','運賃が足りません。',409);
    const destination=idx.regions.get(portal.to);if(!destination)fail('DESTINATION_MISSING','行先が利用できません。',500);
    const originRegion=p.region;
    p.gold-=cost;if(!advanceMacro(state,content,'travelling',minutes*60,{routeId:route.id,destination:destination.id}))return {message:'出発地点付近で体調を崩し、旅を中断した。'};
    const hazard=resolveTravelHazard(state,content,route,mode,originRegion);
    p.region=destination.id;p.position=[...(destination.spawn||[0,0,8])];p.mode=['horse','broom'].includes(mode)?mode:'foot';
    if(!state.visits.includes(p.region)){state.visits.push(p.region);awardXp(state,35,`region:${p.region}`);}
    updateKnowledgeFromSight(state,content);log(state,`${destination.name}へ到着した。旅の間にも時間が流れた。`,'travel');
    const hazardText=hazard?` 道中で${hazard.damage}の損傷を受けた。`:'';
    return {message:`${destination.name}へ到着。${Math.round(minutes)}分、${cost}G。${hazardText}`,minutes,cost,hazard};
  }
  if(command.type==='accept') {
    const target=targetAt(state,content,command.targetId),event=idx.events.get(command.eventId),fact=state.knowledge.find(k=>k.eventId===command.eventId);
    if(!['board','npc'].includes(target.kind)||!event||event.region!==p.region||!fact)fail('QUEST_UNKNOWN','現地で事件の話を聞いてから、依頼を受けてください。',409);
    if(state.quests.some(q=>q.eventId===event.id))fail('QUEST_EXISTS','この依頼は既に記録しています。',409);
    if(['resolved','prevented','failed'].includes(state.events[event.id].status))fail('QUEST_CLOSED','この依頼は終了しています。',409);
    const quest={id:`quest:${event.id}`,eventId:event.id,name:event.name,status:'accepted',acceptedAt:state.time,reward:finite(event.reward,60)};state.quests.push(quest);
    log(state,`${event.name}の依頼を受けた。受注前から事件は進行している。`,'quest',event.id);return {message:'依頼を記録した。',quest};
  }
  if(command.type==='rest') {
    const target=targetAt(state,content,command.targetId),hours=command.hours ?? 6;
    if(target.kind!=='inn')fail('NOT_INN','宿に近づいてください。',409);
    if(!Number.isFinite(hours)||hours<.25||hours>12)fail('INVALID_HOURS','休息は15分から12時間です。');
    if(p.gold<8)fail('NO_GOLD','宿代8Gが必要です。',409);
    p.gold-=8;if(!advanceMacro(state,content,'sleeping',hours*3600,{targetId:target.id}))return {message:'休息中に体調が悪化した。'};
    p.hp=Math.min(p.maxHp,p.hp+hours*18);p.mp=Math.min(p.maxMp,p.mp+hours*12);p.stamina=100;
    log(state,`${hours}時間休んだ。宿の外では暮らしと事件が続いていた。`,'rest');return {message:'休息して回復した。'};
  }
  if(command.type==='work') {
    const target=targetAt(state,content,command.targetId),job=idx.jobs.get(command.jobId);
    if(target.closed)fail('WORKPLACE_CLOSED','仕事場は閉鎖されている。',409);
    if(!job||(job.facilityId?target.id!==job.facilityId:!['job','npc','board'].includes(target.kind)))fail('JOB_MISSING','実際の仕事場に近づいてください。',409);
    if(job.region&&job.region!==p.region)fail('JOB_REGION','その仕事は別の地域です。',409);
    const missing=requirementsMissing(state,content,job.requirements || {});if(missing.length)fail('JOB_REQUIREMENTS',`必要：${missing.join('、')}`,409);
    const duration=clamp(finite(job.minutes,120),15,240);if(!advanceMacro(state,content,'working',duration*60,{targetId:target.id}))return {message:'作業中に倒れた。'};
    const wage=finite(job.pay??job.reward??job.wage,30);p.gold+=wage;awardXp(state,finite(job.xp,30),`job:${job.id}`);state.regions[p.region].stock=Math.min(2,state.regions[p.region].stock+.025);
    rememberAction(state,content,'shared-work',{targetId:target.id,payload:{jobId:job.id}});
    p.mastery.profession=finite(p.mastery.profession)+1;recordWitnesses(state,content,`${p.name}が${job.name}を手伝った。`,'work');
    log(state,`${job.name}を終え、${wage}Gを得た。`,'work');return {message:`仕事を終えた。${wage}G。`,gold:wage};
  }
  if(command.type==='attack') {
    const monster=state.monsters[command.targetId];if(!monster||monster.region!==p.region||monster.hp<=0)fail('ENEMY_MISSING','攻撃できる敵がいません。',404);
    const magic=command.skillId==='magic';if(command.skillId&&!['combat','magic'].includes(command.skillId))fail('SKILL_UNAVAILABLE','その能力はこの戦闘では使用できません。');
    if(magic&&!p.skills.includes('magic'))fail('NEED_SKILL','魔法を習得していません。',409);
    if(p.staggerUntil>state.simulationTime)fail('STAGGERED','体勢を立て直している。',409);
    const range=magic?13:3.2;if(distance(p.position,monster.position)>range)fail('ATTACK_RANGE','敵が射程外です。',409);
    if(!hasLineOfSight(idx.regions.get(p.region),p.position,monster.position))fail('OBSTRUCTED','射線が通りません。',409);
    if(p.actionInstance)fail('COOLDOWN','攻撃動作の途中です。',409);
    if(state.simulationTime-finite(p.cooldowns.attack,-10000)<(magic?1.6:.7))fail('COOLDOWN','次の攻撃の準備中です。',409);
    if(magic&&p.mp<6)fail('NO_MP','魔力が足りません。',409);
    if(magic)p.mp-=6;
    const action={id:`action:${state.nextId++}`,actorId:'player',targetId:monster.id,region:p.region,skillId:magic?'magic':'combat',
      phase:'windup',startedAt:state.simulationTime,hitWindow:{opensAt:magic?.6:.22,closesAt:magic?.75:.34},
      hitVolume:{shape:'sphere',anchor:'actor',radius:range},duration:magic?1.6:.7,resolved:false};
    p.actionInstance=action;p.cooldowns.attack=state.simulationTime;p.lastAttack=state.simulationTime;setActivity(state,'combat');
    return {message:magic?'詠唱を始めた。':'攻撃を構えた。',actionId:action.id,phase:action.phase};
  }
  if(command.type==='defend') {p.guarding=command.active===true;return {message:null};}
  if(command.type==='dodge') {
    if(p.stamina<20)fail('NO_STAMINA','回避する余力が足りません。',409);
    if(p.dodgeUntil>state.simulationTime)fail('COOLDOWN','回避中です。',409);
    const x=finite(command.x,Math.sin(p.heading)),z=finite(command.z,Math.cos(p.heading)),length=Math.hypot(x,z);
    if(length<.01||length>1.5)fail('INVALID_INPUT','回避方向が不正です。');
    if(p.actionInstance?.phase==='windup'){p.actionInstance.phase='cancelled';p.actionInstance.cancelReason='dodge';p.actionInstance.cancelledAt=state.simulationTime;p.lastActionInstance=p.actionInstance;delete p.actionInstance;}
    p.position=moveBody(idx.regions.get(p.region),p.position,[x/length*3,0,z/length*3]);p.stamina-=20;p.dodgeUntil=state.simulationTime+.4;
    return {message:null};
  }
  fail('UNKNOWN_COMMAND','その操作は定義されていません。');
}

function actionsFor(state,content,target) {
  const actions=[],idx=index(content),p=state.player;
  if(target.kind==='npc') actions.push({id:'talk',label:'話す'},{id:'help',label:'生活物資を一つ手渡す',type:'interact'});
  else {
    const freshBoard=target.kind==='board'&&(content.events||[]).some(e=>e.region===p.region&&state.time>=eventStart(e)&&!state.knowledge.some(k=>k.eventId===e.id&&k.status===state.events[e.id].status));
    const checked=p.inspections?.[target.id]&&!freshBoard;
    actions.push({id:checked?'review':'inspect',label:checked?'確かめた内容を読み返す':target.kind==='evidence'?'調べる':'見る'});
  }
  if(['inn','camp','bench'].includes(target.kind))for(const item of content.items||[])if((item.kind==='food'||['food','supplies'].includes(item.id))&&p.inventory[item.id]>0)actions.push({id:`eat:${item.id}`,type:'eat',itemId:item.id,label:`${item.name}を食べる · 15分`});
  if(target.kind==='inn') actions.push({id:'rest',label:'6時間泊まる · 8G',type:'rest',hours:6,requirements:{gold:8},available:p.gold>=8,missing:p.gold>=8?[]:['宿代8G']});
  if(target.kind==='shop'||target.kind==='stable') for(const item of itemsForShop(state,content,target)) {const price=priceOf(state,item,p.region);actions.push({id:`buy:${item.id}`,type:'buy',itemId:item.id,label:`${item.name} · ${price}G`,price,requirements:{gold:price},available:p.gold>=price,missing:p.gold>=price?[]:[`${price}G`]});}
  if(target.kind==='shop')for(const [id,count] of Object.entries(p.inventory))if(count>0&&!Object.values(p.equipment).includes(id)){
    const item=idx.items.get(id)||(content.materials||[]).find(i=>i.id===id)||idx.equipment.get(id);
    if(item)actions.push({id:`sell:${id}`,type:'sell',itemId:id,label:`売る：${item.name}（所持 ${count}）`});
  }
  if(target.kind==='trainer') for(const skill of content.skills || []) if(!p.skills.includes(skill.id)&&(!target.skills||target.skills.includes(skill.id))) {
    const lesson=lessonFor(skill),requirements={skills:skill.requires||[],items:Object.fromEntries(lesson.equipment.map(id=>[id,1])),gold:finite(skill.goldCost,12)/lesson.sessionsRequired,sp:finite(skill.cost??skill.spCost,1)},missing=requirementsMissing(state,content,requirements);
    if(p.sp<requirements.sp)missing.push(`${requirements.sp}SP`);
    actions.push({id:`train:${skill.id}`,type:'train',skillId:skill.id,label:`${skill.name} · ${requirements.sp}SP / ${requirements.gold}G / ${lesson.seconds/60}分`,requirements,available:missing.length===0,missing});
  }
  if(target.crafting) for(const recipe of content.recipes || []) if(!recipe.facilityIds || recipe.facilityIds.includes(target.id)) {
    const missing=requirementsMissing(state,content,{...(recipe.requirements || {}),items:Object.fromEntries(Object.entries(recipe.requirements?.items || recipe.requirements?.inventory || {}).map(([id,amount])=>[id,finite(amount)]))});
    actions.push({id:`craft:${recipe.id}`,type:'craft',recipeId:recipe.id,label:`製作：${recipe.name} · ${finite(recipe.minutes,30)}分`,available:missing.length===0,missing});
  }
  for(const job of content.jobs || []) if(!target.closed&&(job.facilityId?job.facilityId===target.id:['job','board','npc'].includes(target.kind))&&(!job.region||job.region===p.region)&&(!target.jobId||target.jobId===job.id))
    {const requirements=job.requirements||{},missing=requirementsMissing(state,content,requirements);actions.push({id:`work:${job.id}`,type:'work',jobId:job.id,label:`${job.name} · ${finite(job.pay??job.reward??job.wage,30)}G`,requirements,available:missing.length===0,missing});}
  if(['board','npc'].includes(target.kind)) for(const known of state.knowledge.filter(k=>k.kind==='event'&&k.region===p.region)) {
    const event=idx.events.get(known.eventId);if(event&&!state.quests.some(q=>q.eventId===event.id)&&['active','critical','latent'].includes(state.events[event.id].status))
      actions.push({id:`accept:${event.id}`,type:'accept',eventId:event.id,label:`依頼を受ける：${event.name}`});
  }
  actions.push(...affordances(state,content,target.id));
  actions.push(...causalActions(state,content,target));
  actions.push(...structureActions(state,content,target.id));
  const remembered=p.knownServices?.[target.id],review=actions.find(a=>a.id==='review');
  const offerMeaning=offers=>JSON.stringify(offers.filter(a=>['buy','work','train','rest','craft'].includes(a.type)).map(a=>({id:a.id,type:a.type,price:a.price,requirements:a.requirements})).sort((a,b)=>a.id.localeCompare(b.id,'en')));
  if(remembered&&review&&offerMeaning(remembered.offers)!==offerMeaning(actions)){
    review.id='inspect';review.label='変わった店頭・仕事の条件を確かめる';
  }
  return actions;
}
function personalActions(state,content) {
 const p=state.player,actions=[],region=index(content).regions.get(p.region);
 if(p.collapse?.status==='active')return [{id:'recover',type:'recover',label:'救助を待つ'}];
 for(const [id,count] of Object.entries(p.inventory))if(count>0) {
  const item=index(content).items.get(id),gear=index(content).equipment.get(id);
  if(gear&&!Object.values(p.equipment).includes(id))actions.push({id:`equip:${id}`,type:'equip',itemId:id,label:`${gear.name}を装備する`});
  if(item&&(id==='medicine'||item.heal)&&p.hp<p.maxHp)actions.push({id:`use:${id}`,type:'use',itemId:id,label:`${item.name}を使う`});
  if(item&&(item.kind==='food'||['food','supplies'].includes(id))&&p.position[1]<=1&&!combatNearby(state,content))actions.push({id:`eat:${id}`,type:'eat',itemId:id,label:`${item.name}を食べる · 15分`});
 }
 if(p.activity?.worldTimePolicy==='paused')return actions;
 for(const monster of values(state.monsters))if(monster.hp>0&&monster.region===p.region&&hasLineOfSight(region,p.position,monster.position)) {
  for(const [skillId,range,cooldown] of [['combat',3.2,.7],['magic',13,1.6]])if(p.skills.includes(skillId)&&distance(p.position,monster.position)<=range&&!p.actionInstance&&!(p.staggerUntil>state.simulationTime)&&state.simulationTime-finite(p.cooldowns.attack,-10000)>=cooldown&&(skillId!=='magic'||p.mp>=6))actions.push({id:`attack:${skillId}:${monster.id}`,type:'attack',targetId:monster.id,skillId,label:skillId==='magic'?'魔法を放つ':'攻撃する'});
 }
 if(combatNearby(state,content)) {
  actions.push({id:'guard',type:'defend',active:!p.guarding,label:p.guarding?'防御を解く':'身を守る'});
  if(p.stamina>=20&&!(p.dodgeUntil>state.simulationTime))actions.push({id:'dodge',type:'dodge',x:Math.sin(p.heading+Math.PI/2),z:Math.cos(p.heading+Math.PI/2),label:'横へ回避する'});
 }
 return actions;
}
export function projectWorld(state,content) {
  initializeProperty(state,content);
  const p=state.player,idx=index(content),region=idx.regions.get(p.region);
  p.discoveredRegions||=[p.region];if(!p.discoveredRegions.includes(p.region))p.discoveredRegions.push(p.region);
  const knownIds=new Set(state.knowledge.filter(k=>k.kind==='event').map(k=>k.eventId));
  const cleanObject=o=>({id:o.id,name:o.eventId&&!knownIds.has(o.eventId)?'気になる現場':o.name,kind:o.kind,position:clone(o.position),asset:o.asset,rotation:o.rotation || 0,scale:o.scale || 1,interior:o.interior,crafting:o.crafting,buildingPosition:o.buildingPosition,width:o.width,depth:o.depth,height:o.height});
  const publicRegion={id:region.id,name:region.name,biome:region.biome,color:region.color,size:region.size,spawn:clone(region.spawn),description:region.description,worldPosition:clone(region.worldPosition),
    obstacles:clone(region.obstacles || []),terrain:clone(region.terrain || {}),objects:(region.objects || []).map(o=>cleanObject({...o,...state.facilities?.[o.id]})),portals:clone(region.portals || [])};
  const nearbyNpcs=values(state.npcs).filter(n=>n.region===p.region&&!n.travel&&!n.entrapment&&distance(n.position,p.position)<90&&hasLineOfSight(region,p.position,n.position)).map(n=>({id:n.id,name:idx.npcs.get(n.id)?.name,role:idx.npcs.get(n.id)?.role,position:clone(n.position),activity:n.activity,hp:n.hp,condition:n.injury&&['leg','burn','crush'].includes(n.injury.kind)?{kind:n.injury.kind,treated:n.injury.treated}:undefined,heading:n.path?.length?Math.atan2(n.path[0][0]-n.position[0],n.path[0][2]-n.position[2]):0}));
  const candidates=[...(region.objects || []).map(o=>({...o,...state.facilities?.[o.id]})),...nearbyNpcs.filter(n=>n.hp>0).map(n=>({...n,kind:'npc'})),...(content.events || []).filter(e=>e.region===p.region&&knownIds.has(e.id)).map(e=>({id:`event:${e.id}`,kind:'event',eventId:e.id,name:e.name,position:e.position || [0,0,0]}))];
  const interactables=candidates.filter(t=>distance(t.position,p.position)<=INTERACTION&&hasLineOfSight(region,p.position,t.position)).map(t=>({...cleanObject(t),distance:distance(t.position,p.position),actions:actionsFor(state,content,t)}));
  interactables.push(...propertyView(state,content).filter(o=>!o.held));
  for(const portal of region.portals || []) if(distance(portal.position,p.position)<=finite(portal.radius,3)+1) {
    const route=idx.routes.get(portal.routeId),destination=idx.regions.get(portal.to);
    interactables.push({id:portal.id,name:`${destination?.name || '隣の地域'}への街道`,kind:'portal',position:clone(portal.position),distance:distance(portal.position,p.position),actions:(route?.modes || ['foot']).map(mode=>{
      const estimate=travelEstimate(state,content,route||{},mode);
      const duration=Number.isInteger(estimate.minutes)?estimate.minutes:Math.round(estimate.minutes*10)/10;
      const fare=estimate.cost?`${Number.isInteger(estimate.cost)?estimate.cost:estimate.cost.toFixed(1)}G`:'無料';
      return {id:`travel:${mode}`,type:'travel',portalId:portal.id,mode,label:`${estimate.label}で向かう · ${duration}分 · ${fare} · ${estimate.riskLabel}`,available:estimate.missing.length===0,missing:estimate.missing,minutes:estimate.minutes,price:estimate.cost,risk:estimate.risk,riskLabel:estimate.riskLabel,destination:destination?.name};
    })});
  }
  const knownEvents=state.knowledge.filter(k=>k.kind==='event'&&idx.events.has(k.eventId)).map(k=>{const e=idx.events.get(k.eventId),timing=knownTiming(state,e.id);return {id:e.id,name:e.name,region:e.region,description:k.text,status:k.status==='critical'&&!Number.isFinite(timing.deadline)?'active':k.status,observedAt:k.observedAt,source:clone(k.source),...timing,position:e.region===p.region?clone(e.position):undefined};});
  const quests=state.quests.map(quest=>{
    const event=idx.events.get(quest.eventId),known=knownEvents.find(k=>k.id===quest.eventId),worldStatus=known?.status,timing=knownTiming(state,quest.eventId);
    return {id:quest.id,eventId:quest.eventId,status:quest.status,acceptedAt:quest.acceptedAt,reward:quest.reward,name:event?.name||quest.name,worldStatus,...timing,urgent:['active','critical'].includes(worldStatus)&&Number.isFinite(timing.remaining)&&timing.remaining<=6*3600};
  });
  return {schemaVersion:2,simulationTime:state.simulationTime,time:state.time,day:Math.floor(state.time/DAY)+1,clock:`${String(Math.floor(hour(state))).padStart(2,'0')}:${String(Math.floor(state.time/60)%60).padStart(2,'0')}`,
    weather:clone(state.weather[p.region]),player:{...clone(p),force:forceOf(p,content),inventoryDetails:Object.entries(p.inventory).filter(([,quantity])=>quantity>0).map(([id,quantity])=>{const item=idx.items.get(id)||(content.materials||[]).find(i=>i.id===id)||idx.equipment.get(id);return {id,name:item?.name||'採集した素材',kind:item?.kind||(idx.equipment.has(id)?'equipment':'material'),quantity,equipped:Object.values(p.equipment).includes(id)};})},region:publicRegion,npcs:nearbyNpcs,
    monsters:values(state.monsters).filter(m=>m.region===p.region&&m.hp>0&&distance(m.position,p.position)<75&&hasLineOfSight(region,p.position,m.position)).map(m=>{const t=idx.monsters.get(m.templateId);return {id:m.id,name:t?.name,position:clone(m.position),hp:m.hp,maxHp:m.maxHp,level:t?.level,role:t?.role,activity:m.activity,heading:m.heading,boss:t?.boss,intent:m.intent?{name:m.intent.name,position:clone(m.intent.position),resolvesAt:m.intent.resolvesAt}:undefined};}),
    leads:investigationLeads(state,content),arrival:arrivalContract(state,content,interactables),notes:state.knowledge.filter(k=>['document','testimony'].includes(k.kind)).map(k=>({text:k.text,kind:k.kind})),heldProperties:propertyView(state,content).filter(o=>o.held),affordances:affordances(state,content),worldObjects:values(state.worldObjects).filter(o=>!o.custodianId&&o.region===p.region&&o.quantity>0&&distance(o.position,p.position)<5).map(o=>({id:o.id,kind:o.kind,name:o.name,itemId:o.itemId,quantity:o.quantity,position:clone(o.position),actions:affordances(state,content,o.id)})),conversation:state.conversation?.status==='active'?conversationResult(state,content).conversation:undefined,interactables,knownEvents,quests,journal:clone(state.history.slice(-60)),notifications:clone(state.notifications.slice(-5)),cycleComplete:state.cycleComplete,
    personalActions:personalActions(state,content),services:clone(Object.values(p.knownServices||{})),outcomes:state.cycleComplete?{knownResolved:knownEvents.filter(e=>['prevented','resolved'].includes(e.status)).length,knownFailed:knownEvents.filter(e=>e.status==='failed').length}:undefined};
}
