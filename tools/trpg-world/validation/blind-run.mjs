import {findPath,distance} from '../../../src/shared/trpg-world/navigation.js';
import {WorldReplay,digest,optionsFromView,replay} from './replay.mjs';
import {commandForOption,semanticIdentity} from '../../../src/shared/trpg-world/semantic.js';
import {chooseBlind} from './blind-policy.mjs';

export function blindInput(view){
 const observation=structuredClone(view.perception),bindings=new Map(),actions=[];
 const add=(option,targetId,conversation)=>{
  const command=commandForOption(option,targetId,conversation);if(!targetId&&!conversation)delete command.targetId;
  const type=conversation?'conversation':command.type,verb=String(command.action||command.intentId||option.id||'').split('/').at(-1).split(':')[0];
  const key=digest(semanticIdentity(option,conversation?.speaker||targetId,conversation)).slice(0,20);bindings.set(key,command);
  actions.push({key,type,verb,label:option.label,targetId,available:option.available!==false,renewed:option.renewed===true,requirements:structuredClone(option.requirements||{}),family:option.family,intent:option.intent?.type||option.intent,mode:command.mode,price:option.price,minutes:option.minutes,itemId:command.itemId,skillId:command.skillId});
 };
 if(view.conversation){observation.conversation={speaker:view.conversation.speaker,text:view.conversation.text};for(const a of view.conversation.choices)add(a,undefined,view.conversation);}
 else {
  for(const target of view.interactables)if(target.kind!=='event')for(const a of target.actions)add(a,target.id);
  for(const a of view.personalActions||[])add(a,a.targetId);
 }
 const alias=id=>id?'entity:'+digest(id).slice(0,16):id;
 for(const list of [observation.places,observation.people,observation.monsters,observation.exits,observation.services,observation.inspections])for(const entry of list)entry.id=alias(entry.id);
 for(const direction of observation.directions){direction.destination.targetId=alias(direction.destination.targetId);direction.source={type:direction.source?.type};}
 for(const action of actions)action.targetId=alias(action.targetId);
 observation.actions=actions;return {observation,bindings};
}
function step(run,point){
 const p=run.view().perception.self,d=distance(p.position,point);if(d<.12)return;
 run.command({type:'input',x:(point[0]-p.position[0])/d,z:(point[2]-p.position[2])/d});run.advance(Math.min(.4,d/4.2));
}
// Footstep executor receives the same current observations as the policy.
// It recomputes only local obstacle paths; no content.routes or hidden target.
function approach(run,destination){
 run.command({type:'resume'});let path=[],geometry;
 for(let n=0;n<500;n++){
  const o=run.view().perception,p=o.self;
  if(p.collapse?.status==='active')return {error:'collapsed-during-walk'};
  if(distance(p.position,destination)<.2){run.command({type:'input',x:0,z:0});return {arrived:true};}
  if(o.monsters.some(m=>m.activity==='attack'||distance(m.position,p.position)<12)){run.command({type:'input',x:0,z:0});return {interrupted:'visible-danger'};}
  const currentGeometry=JSON.stringify(o.obstacles);
  if(!path.length||geometry!==currentGeometry){path=findPath({size:o.region.size,obstacles:o.obstacles},p.position,destination);geometry=currentGeometry;}
  if(!path.length)return {error:'no-path-through-observed-geometry'};
  while(path.length&&distance(path[0],p.position)<.12)path.shift();
  const before=[...p.position];step(run,path[0]||destination);
  if(distance(run.view().perception.self.position,before)<.0001)return {error:'first-unseen-or-blocked-footstep'};
 }
 return {error:'movement-budget'};
}
export function repeatedDestinations(entries){
 // Meaningful destinations tolerate floating-point drift. In particular a
 // six-heading walking loop must not masquerade as exploration for days.
 for(let period=1;period<=8;period++){
  const recent=entries.slice(-period*3);if(recent.length!==period*3)continue;
  if(recent.every((entry,i)=>entry.decision.walk&&!entry.result?.interrupted&&distance(entry.decision.walk,recent[i%period].decision.walk)<.1))return true;
 }
 return false;
}
export function runBlind(content,{seed=17,decisions=240,untilDay=5,onProgress=()=>{},onCheckpoint=()=>{}}={}){
 const run=new WorldReplay(content,{seed}),memory={},decisionsLog=[];let stopped='decision-budget',intermediate;
 run.command({type:'resume'});run.advance(.5);
 for(let i=0;i<decisions;i++){
  const {observation,bindings}=blindInput(run.view());if(i%50===0){onProgress({i,day:observation.day,clock:observation.clock,region:observation.region.name,operations:run.operations.length});onCheckpoint({run,memory,decisionsLog});}if(observation.day>=untilDay){stopped='natural-day-boundary';break;}
  const decision=chooseBlind(JSON.parse(JSON.stringify(observation)),memory);
  let result;
  if(decision.stop){stopped=decision.stop;break;}
  if(decision.action){const command=bindings.get(decision.action);if(!command)throw new Error('Policy selected a non-offered handle');result=run.command(command,{reason:decision.reason});}
  else if(decision.resume)result=run.command({type:'resume'});
  else if(decision.seconds){run.advance(decision.seconds);result={simulationSeconds:decision.seconds};}
  else if(decision.step){step(run,decision.step);result={combatStep:true};}
  else result=approach(run,decision.walk);
  decisionsLog.push({index:run.operations.length,day:observation.day,clock:observation.clock,region:observation.region.name,decision,result});
  if(!intermediate&&run.view().day>=2)intermediate={state:JSON.parse(JSON.stringify(run.state)),memory:JSON.parse(JSON.stringify(memory)),operationIndex:run.operations.length};
  if(result?.error||run.defects.length){stopped='FIRST_BAD_DECISION';break;}
  if(repeatedDestinations(decisionsLog)){stopped='DUPLICATE_DESTINATION_LOOP';break;}
 }
 // True state is inspected ONLY after the blind decisions have ended, as an
 // evaluation report. It is never returned to chooseBlind.
 return {run,intermediate,summary:{seed,stopped,day:run.view().day,clock:run.view().clock,hp:run.view().player.hp,operations:run.operations.length,decisions:decisionsLog.length,decisionsLog,
  outcomes:Object.fromEntries(Object.entries(run.state.events).map(([id,e])=>[id,{status:e.status,components:e.causal.componentStatus}])),defects:run.defects}};
}
export function verifyBlindRecord(content,result){
 const restored=replay(content,JSON.parse(JSON.stringify(result.run.export())));return {replay:digest(restored.state)===digest(result.run.state)};
}
