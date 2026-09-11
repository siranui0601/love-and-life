import {findPath,distance} from '../../../src/shared/trpg-world/navigation.js';
import {MOVEMENT} from '../../../src/shared/trpg-world/progression.js';
import {observePlayer,choosePolicy} from './policies.mjs';
import {digest,WorldReplay} from './replay.mjs';
export function walk(run,target) {
 run.command({type:'resume'});const region=run.view().region;
 const path=findPath(region,run.state.player.position,target);
 if(!path.length)return {error:'unreachable-destination',position:target};
 for(const point of path)for(let n=0;distance(run.state.player.position,point)>.12;n++) {
  if(n>=500)return {error:'movement-stall',position:run.state.player.position};
  const p=run.state.player,d=distance(p.position,point),before=[...p.position];
  const move=run.command({type:'input',x:(point[0]-p.position[0])/d,z:(point[2]-p.position[2])/d});if(move.error)return move;
  run.advance(Math.min(.4,d/MOVEMENT[p.mode].speed));
  if(distance(before,run.state.player.position)<.0001)return {error:run.state.player.collapse?'survival-collapse':'blocked-movement',position:before};
 }
 run.command({type:'input',x:0,z:0});return {arrived:true};
}
export function runPolicy(content,name,{seed=1,decisions=12,initialState}={}) {
 const run=new WorldReplay(content,{seed,initialState}),experience={people:[]};run.advance(.5);let stopped='decision-budget';
 for(let i=0;i<decisions;i++) {
  const view=run.view(),options=run.options(),observation=observePlayer(view,options),decision=choosePolicy(name,observation,experience);
  if(decision.stop){stopped=decision.stop;break;}
  if(decision.action!==undefined)run.select(options[decision.action],decision.reason);
  else if(decision.walk) {
   if(decision.lead!==undefined){const lead=(view.leads||[]).filter(l=>l.region===view.region.id)[decision.lead];run.command({type:'track',leadId:lead.id},{reason:decision.reason});}
   const start=run.operations.length,moved=walk(run,decision.walk);
   run.trace.push({index:start,selected:'physical-walk',reason:decision.reason,knowledge:observation.knowledge,available:observation.places,result:moved,next:{region:run.view().region.name,arrival:run.view().arrival,options:run.options().map(o=>o.signature)}});
   if(moved.error){run.defects.push({kind:moved.error,firstBadDecision:start});stopped=moved.error;break;}
  }
  if(run.defects.length){stopped='runtime-defect';break;}
 }
 return {name,seed,stopped,run,summary:{decisions:run.trace.length,commands:run.operations.length,discovered:run.view().knownEvents.map(e=>e.name),defects:run.defects,finalHash:digest(run.state),worldTime:run.state.time}};
}
// Exhaustive bounded search over the projected legal progress frontier. Internal
// state is used only by the goal predicate and deduplication. Travel is ordinary
// walking, never teleport or a test-only command. Budget exhaustion is UNKNOWN.
export function structuralSearch(content,initialState,goal,{maxNodes=32,maxDepth=6,estimate=()=>0}={}) {
 const first=new WorldReplay(content,{initialState}),queue=[{run:first,depth:0}],seen=new Set();let expanded=0;const rejected=[];
 while(queue.length&&expanded<maxNodes){queue.sort((a,b)=>estimate(a.run.state)-estimate(b.run.state)||a.depth-b.depth);const {run,depth}=queue.shift();expanded++;
  if(goal(run.state))return {status:'FOUND',expanded,run,rejected};if(depth>=maxDepth)continue;
  const frontier=run.options().filter(o=>o.progress);
  const branches=frontier.map(o=>({option:o}));
  for(const lead of run.view().leads||[])if(lead.region===run.state.player.region&&distance(lead.position,run.state.player.position)>4)branches.push({lead});
  for(const branch of branches) {
   const next=run.fork();
   if(branch.lead){next.command({type:'track',leadId:branch.lead.id});const result=walk(next,branch.lead.position);if(result.error){rejected.push(result);continue;}}
   else {const result=next.select(branch.option,'structural search: execute a projected legal information/physical action');if(result.error){rejected.push(result.error);continue;}}
   next.command({type:'resume'});next.advance(.5);
   const key=digest({knowledge:next.state.knowledge.map(k=>k.id).sort(),position:next.state.player.position,events:next.state.events,inventory:next.state.player.inventory});
   if(seen.has(key))continue;seen.add(key);
   // Preserve the complete input stream from the original root for replay.
   next.initialState=run.initialState;next.operations=[...run.operations,...next.operations];next.trace=[...run.trace,...next.trace];queue.push({run:next,depth:depth+1});
  }
 }
 return {status:queue.length?'SEARCH_LIMIT':'NO_PATH_IN_SEARCH_DOMAIN',expanded,rejected,scope:'projected local progress actions and known local leads; purchases/training/combat are not searched yet'};
}
export function travelTo(run,destination) {
 const queue=[{region:run.state.player.region,path:[]}],seen=new Set();let path;
 while(queue.length){const node=queue.shift();if(node.region===destination){path=node.path;break;}if(seen.has(node.region))continue;seen.add(node.region);
  for(const route of run.content.routes.filter(r=>r.from===node.region||r.to===node.region))queue.push({region:route.from===node.region?route.to:route.from,path:[...node.path,route.id]});}
 if(!path)return {error:'no-travel-network-path'};
 for(const routeId of path){const portal=run.view().region.portals.find(p=>p.routeId===routeId);const moved=walk(run,portal.position);if(moved.error)return moved;
  const option=run.options().find(o=>o.command.type==='travel'&&o.command.portalId===portal.id&&o.command.mode==='foot');if(!option)return {error:'no-legal-travel-action'};
  const result=run.select(option,'街道の出口に着いたので、歩いて次の地域へ向かう');if(result.error)return result;
 }
 return {arrived:true};
}
