import {distance} from '../../../src/shared/trpg-world/navigation.js';
import {walk,travelTo} from './journey.mjs';

// Goal decomposition reads the player's inventory and inspected service notes.
// It never grants resources or queries the hidden event solution. Every leaf
// rechecks the live public offer at the actual location before executing it.
export function performAt(run,target,type,parameter={},reason='現地で提示された行動を行う') {
 if(!target)return {error:'FIRST_MISSING_AFFORDANCE',reason:'対象は今見えていない',type,parameter};
 if(target.region&&target.region!==run.view().region.id){const travel=travelTo(run,target.region);if(travel.error)return travel;}
 const moved=walk(run,target.position);if(moved.error)return moved;
 // A person can walk while being approached. Follow their observed position;
 // never the immutable coordinate captured at the beginning of the journey.
 if(run.view().npcs.some(n=>n.id===target.id))for(let attempts=0;attempts<8;attempts++) {
  const person=run.view().npcs.find(n=>n.id===target.id);if(!person)return {error:'person-no-longer-visible',target:target.name};
  if(distance(person.position,run.view().player.position)<3)break;
  const followed=walk(run,person.position);if(followed.error)return followed;
 }
 if(!type)return {arrived:true};
 const option=run.options().find(o=>o.command.targetId===target.id&&o.command.type===type&&Object.entries(parameter).every(([k,v])=>o.command[k]===v));
 if(!option)return {error:'FIRST_MISSING_AFFORDANCE',target:target.name,type,parameter,offered:run.view().interactables.find(t=>t.id===target.id)?.actions};
 return run.select(option,reason);
}
export function prepare(run,requirements,{maxDecisions=24}={}) {
 const goals=[requirements];let decisions=0;
 while(goals.length&&decisions<maxDecisions) {
  const goal=goals.at(-1),view=run.view(),p=view.player;
  const item=Object.entries(goal.items||{}).find(([id,n])=>(p.inventory[id]||0)<n),skill=(goal.skills||[]).find(id=>!p.skills.includes(id));
  if(!item&&!skill&&p.gold>=(goal.gold||0)&&p.sp>=(goal.sp||0)){goals.pop();continue;}
  if(p.sp<(goal.sp||0))return {error:'FIRST_MISSING_AFFORDANCE',reason:'技能点を得る成長行動が必要',decisions};
  const type=item?'buy':skill?'train':'work',parameter=item?{itemId:item[0]}:skill?{skillId:skill}:{};
  const known=(view.services||[]).flatMap(s=>s.offers.filter(o=>o.type===type&&Object.entries(parameter).every(([k,v])=>o[k]===v)).map(offer=>({service:s,offer})));
  const choice=known.sort((a,b)=>(a.service.region!==view.region.id)-(b.service.region!==view.region.id)||a.service.id.localeCompare(b.service.id,'en'))[0];
  if(!choice) {
   const kinds=type==='buy'?['shop','stable']:type==='train'?['trainer']:['job','board'];
   const place=view.region.objects.find(o=>kinds.includes(o.kind)&&!view.services?.some(s=>s.id===o.id));
   if(!place)return {error:'FIRST_MISSING_AFFORDANCE',reason:'必要な品や技能の入手先をまだ知らない',type,parameter,decisions};
   const result=performAt(run,place,'interact',{action:'inspect'},'必要な品や仕事を探して、店頭や掲示を確かめる');decisions++;if(result.error)return result;continue;
  }
  const needed=choice.offer.requirements||{};
  const lacking=Object.entries(needed.items||{}).some(([id,n])=>(p.inventory[id]||0)<n)||(needed.skills||[]).some(id=>!p.skills.includes(id))||p.gold<(needed.gold||0)||p.sp<(needed.sp||0);
  if(lacking){if(goals.some(g=>JSON.stringify(g)===JSON.stringify(needed)))return {error:'CYCLIC_PREPARATION_REQUIREMENTS',decisions};goals.push(needed);continue;}
  const arrived=performAt(run,choice.service,null);if(arrived.error)return arrived;
  const refresh=run.options().find(o=>o.command.targetId===choice.service.id&&o.command.type==='interact'&&o.command.action==='inspect');
  if(refresh){const result=run.select(refresh,'店頭で変わった条件を確かめ、準備を組み直す');decisions++;if(result.error)return result;continue;}
  const result=performAt(run,choice.service,type,parameter,'調べて知った入手先で、旅支度を進める');decisions++;if(result.error)return result;
 }
 return goals.length?{error:'SEARCH_LIMIT',decisions}:{prepared:true,decisions};
}
export function engage(run,targetId,{maxSeconds=60}={}) {
 run.command({type:'resume'});let elapsed=0;
 while(elapsed<maxSeconds) {
  const view=run.view(),target=view.monsters.find(m=>m.id===targetId);
  if(!target){
   // A lethal hit still has a visible recovery phase. Complete the accepted
   // temporal action before claiming the actor can begin an ordinary activity.
   if(view.player.actionInstance){run.advance(.1);elapsed+=.1;continue;}
   return {ended:true,reason:'target-no-longer-visible',seconds:elapsed};
  }
  if(view.player.collapse?.status==='active')return {error:'player-collapsed',seconds:elapsed};
  const options=run.options(),heal=options.find(o=>o.command.type==='use');
  if(view.player.hp<view.player.maxHp*.45&&heal){const result=run.select(heal,'傷が深いため、持っている傷薬を使う');if(result.error)return result;}
  else if(!view.player.guarding&&view.monsters.some(m=>m.intent)){const guard=options.find(o=>o.command.type==='defend'&&o.command.active);if(guard)run.select(guard,'敵の予備動作を見て身を守る');}
  else {const attack=options.find(o=>o.command.type==='attack'&&o.command.targetId===targetId&&o.command.skillId==='combat');
   if(attack){const result=run.select(attack,'目の前の敵へ、回復した攻撃動作を出す');if(result.error)return result;}
   else if(distance(view.player.position,target.position)>3){const d=distance(view.player.position,target.position);run.command({type:'input',x:(target.position[0]-view.player.position[0])/d,z:(target.position[2]-view.player.position[2])/d});}
  }
  if(distance(run.view().player.position,target.position)<=3)run.command({type:'input',x:0,z:0});
  run.advance(.2);elapsed+=.2;
 }
 return {error:'COMBAT_SEARCH_LIMIT',seconds:elapsed};
}
export function secureArea(run,{maxOpponents=6}={}) {
 run.command({type:'resume'});
 for(let count=0;count<maxOpponents;count++) {
  const view=run.view();if(view.player.collapse?.status==='active')return {error:'player-collapsed'};
  const threat=view.monsters.find(m=>m.activity==='attack'||distance(m.position,view.player.position)<12);
  if(!threat)return {safe:true};const result=engage(run,threat.id);if(result.error)return result;
 }
 return {error:'ENCOUNTER_SEARCH_LIMIT'};
}

export function decisionCounts(record) {
 const result={lowLevelOperations:record.operations.length,simulationAdvances:0,movementInputs:0,meaningfulPlayerDecisions:0,travelSegments:0,investigations:0,conversationTurns:0,preparationActions:0,combatActions:0,otherDecisions:0};
 let moving=false;
 for(const op of record.operations){if(op.kind==='advance'){result.simulationAdvances++;continue;}const c=op.command;
  if(c.type==='input'){result.movementInputs++;const now=!!(c.x||c.z);if(now&&!moving)result.travelSegments++;moving=now;continue;}
  if(['resume','pause'].includes(c.type))continue;
  if(c.type==='travel'){result.travelSegments++;continue;}
  if(c.type==='track')continue; // same destination decision as the following walk
  if(c.type==='converse')result.conversationTurns++;
  else if(['attack','defend','dodge'].includes(c.type))result.combatActions++;
  else if(['buy','sell','work','train','rest','eat','use','equip','craft'].includes(c.type))result.preparationActions++;
  else if(c.type==='interact'&&['inspect','review'].includes(c.action)||c.type==='causal'&&/^(read|submit)/.test(c.action))result.investigations++;
  else result.otherDecisions++;
 }
 result.meaningfulPlayerDecisions=result.travelSegments+result.investigations+result.conversationTurns+result.preparationActions+result.combatActions+result.otherDecisions;
 return result;
}
