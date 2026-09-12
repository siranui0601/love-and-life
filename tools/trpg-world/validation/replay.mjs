import {createHash} from 'node:crypto';
import {createWorld,applyCommand,advanceWorld,projectWorld} from '../../../src/shared/trpg-world/simulation.js';
import {canonical,stableString,semanticIdentity,commandForOption,knowledgeMeaning} from '../../../src/shared/trpg-world/semantic.js';

export const digest=value=>createHash('sha256').update(stableString(value)).digest('hex');
export function optionsFromView(view) {
 if(view.conversation?.status==='active')return view.conversation.choices.map(option=>({signature:semanticIdentity(option,view.conversation.speaker||'conversation',view.conversation),label:option.label,
  command:commandForOption(option,undefined,view.conversation),intent:option.intent,progress:option.family==='ask'||option.family==='share'}));
 return [...view.interactables.flatMap(target=>target.actions.filter(o=>o.available!==false).map(option=>({signature:semanticIdentity(option,target.id),label:option.label,targetName:target.name,requirements:option.requirements,
  command:commandForOption(option,target.id),progress:option.type==='maintain'||option.type==='causal'&&!['escort','release'].includes(option.id)||option.id==='inspect'&&target.kind==='evidence'}))),
  ...(view.affordances||[]).map(option=>({signature:semanticIdentity(option,'self'),label:option.label,command:commandForOption(option,'self'),progress:false})),
  ...(view.personalActions||[]).map(option=>{const command=commandForOption(option,option.targetId);if(!option.targetId)delete command.targetId;return {signature:semanticIdentity(option,option.targetId||'self'),label:option.label,command,progress:false};})].sort((a,b)=>a.signature.localeCompare(b.signature,'en'));
}
export function meaningfulState(state) {
 // Exclude prose, receipt IDs, the raw clock and audit-only utterance records.
 // Keep actual ownership, knowledge, causal conditions, actor state and plans.
 return canonical({knowledge:state.knowledge.map(knowledgeMeaning).sort((a,b)=>a.id.localeCompare(b.id,'en')),inventory:state.player.inventory,gold:state.player.gold,
  needs:{hunger:state.player.hunger,fatigue:state.player.fatigue},posture:state.player.posture,inspections:state.player.inspections,region:state.player.region,position:state.player.position,
  events:Object.fromEntries(Object.entries(state.events).map(([id,e])=>[id,{status:e.status,causal:e.causal}])),
  npcs:Object.fromEntries(Object.entries(state.npcs).map(([id,n])=>[id,{region:n.region,position:n.position,hp:n.hp,goal:n.goal,knowledge:n.knowledge.map(knowledgeMeaning),memories:n.memories,plan:n.plan,travel:n.travel}])),
  properties:state.properties,facilities:state.facilities,structures:state.structures});
}
function progressState(state) {
 return {knowledge:state.knowledge.map(knowledgeMeaning).sort((a,b)=>a.id.localeCompare(b.id,'en')),inventory:state.player.inventory,npcs:Object.fromEntries(Object.entries(state.npcs).map(([id,n])=>[id,{injury:n.injury,companionOf:n.companionOf}])),
  properties:state.properties,structures:state.structures,events:Object.fromEntries(Object.entries(state.events).map(([id,e])=>[id,{status:e.status,causal:e.causal}]))};
}
export function changedDomains(before,after) {return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>stableString(before[k])!==stableString(after[k]));}

// Developer-only transport around the exact simulation used by the service.
// Commands and elapsed active time are recorded, never wording or solver state.
// Every rejected command is transactional, matching PersistentWorldService.
export class WorldReplay {
 constructor(content,{seed=1,initialState}={}) {
  this.content=content;this.state=canonical(structuredClone(initialState||createWorld(content,{seed})));
  projectWorld(this.state,content);this.initialState=structuredClone(this.state);this.operations=[];this.trace=[];this.defects=[];
 }
 view(){return projectWorld(this.state,this.content);}
 options(){return optionsFromView(this.view());}
 command(command,{reason='explicit player command',available=this.options(),selected}={}) {
  const traced=command.type!=='input'&&command.type!=='resume';
  // Movement inputs retain the identical command, projection and state hash.
  // Do not build unused full-world narrative snapshots for untraced commands.
  const before=traced?meaningfulState(this.state):null,progress=traced?digest(progressState(this.state)):null,facts=this.state.socialFacts.length,candidate=structuredClone(this.state);
  let result,error;
  try{result=applyCommand(candidate,this.content,structuredClone(command));projectWorld(candidate,this.content);this.state=candidate;}
  catch(e){error={code:e.code||'REJECTED',message:e.message};}
  const operation={kind:'command',command:structuredClone(command),...(error?{error}:{}),after:digest(this.state)};this.operations.push(operation);
  if(traced) {
   const after=meaningfulState(this.state),entry={index:this.operations.length-1,worldTime:this.state.time,knowledge:before.knowledge,
    available:available.map(o=>({signature:o.signature,label:o.label})),selected:selected||available.find(o=>stableString(o.command)===stableString(command))?.signature||stableString(command),reason,
    result:structuredClone(result||error),createdFacts:structuredClone(this.state.socialFacts.slice(facts)),changedDomains:changedDomains(before,after),next:{knowledge:after.knowledge,events:after.events,options:this.options().map(o=>o.signature)}};
   this.trace.push(entry);
   const chosen=available.find(o=>o.signature===entry.selected);
   if(error)this.defects.push({kind:'rejected-visible-command',firstBadDecision:entry.index,error,selected:entry.selected});
   if(chosen?.progress&&!error&&digest(progressState(this.state))===progress)this.defects.push({kind:'no-progress',firstBadDecision:entry.index,selected:entry.selected});
  }
  return {result,error};
 }
 select(option,reason){return this.command(option.command,{reason,selected:option.signature});}
 advance(seconds){if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid replay duration');advanceWorld(this.state,this.content,seconds);projectWorld(this.state,this.content);this.operations.push({kind:'advance',seconds,after:digest(this.state)});}
 fork(){return new WorldReplay(this.content,{initialState:JSON.parse(JSON.stringify(this.state))});}
 export(){return {format:'trpg-semantic-replay-v1',contentHash:digest(this.content),initialState:this.initialState,operations:this.operations,finalHash:digest(this.state)};}
}
export function replay(content,record) {
 if(record.format!=='trpg-semantic-replay-v1'||record.contentHash!==digest(content))throw new Error('Replay content/version mismatch');
 const run=new WorldReplay(content,{initialState:record.initialState});
 for(const [index,op] of record.operations.entries()) {
  if(op.kind==='advance')run.advance(op.seconds);else if(op.kind==='command')run.command(op.command);else throw new Error('Unknown replay operation');
  if(digest(run.state)!==op.after)throw new Error(`Replay diverged at operation ${index}`);
 }
 return run;
}
export function temporalFork(content,initialState,command,delays=[0,10,30,60]) {
 const runs=delays.map(seconds=>{const run=new WorldReplay(content,{initialState});const before=meaningfulState(run.state);run.advance(seconds);const changes=changedDomains(before,meaningfulState(run.state));run.command(command);return {seconds,changes,signatures:run.options().map(o=>o.signature),error:run.trace.at(-1)?.result?.code};});
 return {runs,stable:runs.every(r=>stableString(r.signatures)===stableString(runs[0].signatures)),interpretation:'active seconds; calendar follows the actual activity policy, not rounded timestamps'};
}
