import {beginWorldAction,completeWorldAction} from './world-actions.js';
import {interpretObservation} from './interpretation.js';
import {possessions,transferProperty} from './property.js';
import {distance,hasLineOfSight} from './navigation.js';
import {rememberAction} from './relationships.js';
import {setActivity} from './activity.js';
const reject=()=>{throw Object.assign(new Error('この場所・状態ではその行動はできません。'),{code:'AFFORDANCE_UNAVAILABLE',status:409});};
const gestures={sit:'座る',lie:'横になる',stand:'立つ',crouch:'しゃがむ',roll:'地面を転がる',dance:'踊る',shout:'声を上げる'};
function local(state,content,target,range=3){const p=state.player;return target&&target.region===p.region&&!target.travel&&target.hp!==0&&distance(p.position,target.position)<=range&&hasLineOfSight(content.regions.find(r=>r.id===p.region),p.position,target.position);}
export function affordances(state,content,targetId='self') {
 const p=state.player;if(p.hp<=0||p.collapse?.status==='active'||p.activity?.kind==='travelling'||p.actionInstance)return [];
 const result=[];
 if(targetId==='self'&&p.mode==='foot'&&p.position[1]<1) {
  for(const [action,label] of Object.entries(gestures))if(action!==(p.posture||'stand'))result.push({id:`world:${action}`,type:'affordance',action,targetId:'self',label});
  for(const [itemId,quantity] of Object.entries(p.inventory||{}))if(quantity>0&&!Object.values(p.equipment).includes(itemId)&&!['horse','broom'].includes(itemId))result.push({id:`drop:${itemId}`,type:'affordance',action:'drop',itemId,targetId:'self',label:`置く：${content.items.find(i=>i.id===itemId)?.name||itemId}`});
 }
 const npc=state.npcs[targetId];
 if(local(state,content,npc)&&possessions(state,npc.id).length>0&&npc.goal!=='defend')result.push({id:'world:pickpocket',type:'affordance',action:'pickpocket',targetId,label:'懐の持ち物を掏ろうとする'});
 const object=state.worldObjects?.[targetId];
 if(local(state,content,object)&&object.quantity>0)result.push({id:'world:take',type:'affordance',action:object.ownerId==='player'?'take':'steal',targetId,label:object.ownerId==='player'?'拾う':'盗む'});
 return result;
}
function executeAffordance(state,content,command) {
 const targetId=command.targetId||'self';
 if(!affordances(state,content,targetId).some(a=>a.action===command.action&&a.itemId===command.itemId))reject();
 if(state.conversation)state.conversation.status='ended';setActivity(state,'idle');
 const p=state.player;state.worldObjects||={};state.propertyIncidents||=[];
 if(gestures[command.action]) {
  p.posture=['sit','lie','stand','crouch'].includes(command.action)?command.action:'stand';
  const nearby=content.regions.find(r=>r.id===p.region).objects.filter(o=>distance(o.position,p.position)<5).sort((a,b)=>distance(a.position,p.position)-distance(b.position,p.position))[0];
  const fact=rememberAction(state,content,'body-action',{payload:{action:command.action,nearObjectId:nearby?.id}});interpretObservation(state,content,fact);
  return {message:`${gestures[command.action]}。`,factId:fact.id};
 }
 if(command.action==='drop') {
  p.inventory[command.itemId]--;const id=`object:${state.nextId++}`;
  state.worldObjects[id]={id,kind:'possession',ownerId:'player',itemId:command.itemId,quantity:1,region:p.region,position:[...p.position]};
  return {message:'持ち物を地面へ置いた。',factId:rememberAction(state,content,'property-dropped',{targetId:id,payload:{itemId:command.itemId}}).id};
 }
 if(['take','steal'].includes(command.action)) {
  const o=state.worldObjects[targetId];o.quantity--;p.inventory[o.itemId]=(p.inventory[o.itemId]||0)+1;
  const fact=rememberAction(state,content,o.ownerId==='player'?'property-recovered':'theft',{targetId:o.id,payload:{ownerId:o.ownerId,itemId:o.itemId,quantity:1}});
  return {message:'品物を手に取った。',factId:fact.id};
 }
 const victim=state.npcs[targetId],region=content.regions.find(r=>r.id===p.region);
 state.random=(Math.imul(state.random,1664525)+1013904223)>>>0;
 const success=state.random/4294967296<(p.skills.includes('stealth')?.7:victim.goal==='sleep'?.65:.35);
 const witnesses=Object.values(state.npcs).filter(n=>n.id!==victim.id&&n.hp>0&&!n.travel&&n.goal!=='sleep'&&n.region===p.region&&distance(n.position,p.position)<5&&hasLineOfSight(region,n.position,p.position)).map(n=>n.id);
 if(!success)witnesses.push(victim.id);
 const available=possessions(state,victim.id),property=available[0];const amount=success?Math.min(property.quantity,property.kind==='currency'?8:1):0;
 const transfer=success?transferProperty(state,{from:victim.id,to:'player',kind:property.kind,assetId:property.assetId,quantity:amount,reason:'theft'}):null;
 const fact=rememberAction(state,content,success?'theft':'attempted-theft',{targetId:victim.id,payload:{ownerId:victim.id,asset:property.assetId,propertyKind:property.kind,amount,custodyId:transfer?.id},observedBy:witnesses});
 if(transfer)transfer.sourceFactId=fact.id;
 state.propertyIncidents.push({id:`property:${state.nextId++}`,factId:fact.id,victimId:victim.id,assetId:property.assetId,propertyKind:property.kind,amount,at:state.time,discoverAfter:state.time+1800,status:success?'undiscovered':'noticed',witnessIds:witnesses});
 for(const id of witnesses){const npc=state.npcs[id];npc.nextDecision=0;
   const belief={id:`belief:${state.nextId++}`,factId:fact.id,claim:'property-interference',about:'player',victimId:victim.id,confidence:1,place:{region:p.region,position:[...p.position]},at:state.time,source:{type:'seen',observerId:id}};
   npc.beliefs.push(belief);npc.knowledge.push({id:belief.id,kind:'crime-observation',text:success?'旅人が他人の持ち物を抜き取るところを見た。':'旅人が他人の財布へ手を伸ばすところを見た。',belief:structuredClone(belief),region:p.region,observedAt:state.time,confidence:1,source:belief.source});
 }
 return {message:success?'硬貨を手に移した。':'相手が手の動きに気づいた。',factId:fact.id};
}
export function advancePropertyDiscovery(state,content) {
 for(const incident of state.propertyIncidents||[])if(incident.status==='undiscovered'&&state.time>=incident.discoverAfter) {
  const victim=state.npcs[incident.victimId];if(!victim||victim.hp<=0||victim.travel||victim.goal==='sleep')continue;
  incident.status='loss-discovered';incident.discoveredAt=state.time;
  // Discovering a shortage does not reveal who took it, or the original theft fact.
  const fact=rememberAction(state,content,'property-loss-discovered',{actorId:victim.id,targetId:victim.id,payload:{asset:incident.assetId||'gold',amount:incident.amount},observedBy:[victim.id]});
  victim.knowledge.push({id:fact.id,kind:'property-loss',text:'持ち物が見当たらない。落としたのか、盗られたのか。',region:victim.region,observedAt:state.time,confidence:1,source:{type:'checked-possession',actorId:victim.id}});
  victim.beliefs.push({id:`belief:${state.nextId++}`,factId:fact.id,claim:'missing-property',place:{region:victim.region,position:[...victim.position]},at:state.time,source:{type:'checked-possession',actorId:victim.id}});victim.nextDecision=0;
 }
}

export function performAffordance(state,content,command) {
 const candidate=affordances(state,content,command.targetId||'self').find(a=>a.action===command.action&&a.itemId===command.itemId);if(!candidate)reject();
 const action=beginWorldAction(state,candidate);
 const result=executeAffordance(state,content,command);return completeWorldAction(state,action,result);
}
