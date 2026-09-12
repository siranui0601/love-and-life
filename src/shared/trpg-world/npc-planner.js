import {distance,followPath} from './navigation.js';
import {willingToCooperate,rememberAction} from './relationships.js';
import {stableString,orderedValues} from './semantic.js';
import {knownWorkplaceClosed} from './world-semantics.js';
const satisfies=(facts,conditions)=>Object.entries(conditions||{}).every(([k,v])=>facts[k]===v);
// Bounded uniform-cost state search. Goal selection remains the utility layer's job.
export function searchPlan(initial,goal,operators,{maxNodes=128,maxDepth=10}={}) {
 const open=[{facts:initial,steps:[],cost:0}],seen=new Map();let expanded=0;
 while(open.length&&expanded++<maxNodes){open.sort((a,b)=>a.cost-b.cost||stableString(a.steps).localeCompare(stableString(b.steps),'en'));const node=open.shift();
  if(satisfies(node.facts,goal))return node.steps;
  const key=stableString(node.facts);if((seen.get(key)??Infinity)<=node.cost)continue;seen.set(key,node.cost);
  if(node.steps.length>=maxDepth)continue;
  for(const op of [...operators].sort((a,b)=>stableString(a).localeCompare(stableString(b),'en')))if(satisfies(node.facts,op.preconditions))open.push({facts:{...node.facts,...op.effects},steps:[...node.steps,structuredClone(op)],cost:node.cost+op.cost});
 }
 return null;
}
function context(state,content,npc,template,chosen) {
 const region=content.regions.find(r=>r.id===npc.region),home=npc.displacedHome||(template.region===npc.region?template.home:region.spawn);
 const shop=region.objects.find(o=>o.kind==='shop'&&!state.facilities?.[o.id]?.closed);
 const work=template.region===npc.region?template.work:region.objects.find(o=>o.kind==='job')?.position||home;
 const locations={home,work,goal:chosen.target||home,...(shop?{shop:shop.position}:{})};
 const facts={location:Object.keys(locations).find(k=>distance(npc.position,locations[k])<2)||'elsewhere',food:(npc.possessions?.supplies||0)>0,
  money:npc.money>=4,workOpen:!knownWorkplaceClosed(npc,template.workFacilityId),stock:state.regions[npc.region].stock>.15,shop:!!shop,sated:npc.hunger<25,done:false,
  forage:/森|狩|農|野/.test(`${template.role||''} ${region.name||''}`),helper:orderedValues(state.npcs).some(n=>n.id!==npc.id&&n.hp>0&&!n.travel&&n.region===npc.region&&distance(n.position,npc.position)<5&&(n.possessions?.supplies||0)>1&&willingToCooperate(state,n,{actorId:npc.id,resourceCost:1}))};
 return {facts,locations,shop};
}
export function planForGoal(state,content,npc,template,chosen) {
 npc.possessions||={};npc.money??=8;
 const {facts,locations,shop}=context(state,content,npc,template,chosen),operators=[];
 for(const [place,position] of Object.entries(locations))operators.push({action:'move',place,position:[...position],region:npc.region,preconditions:{},effects:{location:place},cost:1+distance(npc.position,position)/20,expectedDuration:distance(npc.position,position)/1.55*(content.time?.scale||60)});
 if(chosen.goal==='eat')operators.push(
  {action:'work',preconditions:{location:'work',money:false,workOpen:true},effects:{money:true},pay:6,expectedDuration:3600,cost:6},
  {action:'purchase-food',targetId:shop?.id,preconditions:{location:'shop',shop:true,stock:true,money:true},effects:{food:true,money:false},expectedDuration:300,cost:1},
  {action:'forage',preconditions:{location:'home',forage:true},effects:{food:true},expectedDuration:2700,cost:5},
  {action:'request-food',preconditions:{helper:true},effects:{food:true},expectedDuration:600,cost:2},
  {action:'consume-food',preconditions:{food:true,location:'home'},effects:{food:false,sated:true},expectedDuration:900,cost:1});
 else operators.push({action:chosen.goal==='sleep'?'rest':chosen.goal==='work'?'work':'observe',preconditions:{location:'goal',...(chosen.goal==='work'?{workOpen:true}:{})},effects:{done:true},expectedDuration:1800,cost:1,pay:3});
 const goal=chosen.goal==='eat'?{sated:true}:{done:true};const steps=searchPlan(facts,goal,operators);
 return {id:`plan:${state.nextId++}`,goal:chosen.goal,desired:goal,region:npc.region,status:steps?'active':'blocked',steps:steps||[],cursor:0,createdAt:state.time,
  requiredKnowledge:(npc.beliefs||[]).filter(b=>!b.checkedAt&&b.place?.region===npc.region).map(b=>b.factId),locations,chosen:structuredClone(chosen),failureCondition:'precondition/resource/location changes',reasons:(npc.memories||[]).filter(m=>m.kind==='promise-kept').map(m=>m.factId)};
}
export function advancePlan(state,content,npc,seconds,execution=null) {
  if(execution)return advanceActionPlan(state,npc,seconds,execution);
 const plan=npc.plan;if(!plan)return false;
 const template=content.npcs.find(n=>n.id===npc.id);if(!template)return false;
 const invalidate=reason=>{plan.status='invalidated';plan.invalidatedAt=state.time;plan.failure=reason;npc.lastPlan=plan;npc.plan=planForGoal(state,content,npc,template,plan.chosen);npc.nextDecision=0;return false;};
 if(plan.region!==npc.region)return invalidate('region-changed');
 if(plan.status==='blocked'){if(state.time-plan.createdAt>=300)return invalidate('retry-blocked-goal');return false;}
 const step=plan.steps[plan.cursor];if(!step){npc.lastPlan={...plan,status:'completed'};delete npc.plan;npc.nextDecision=0;return true;}
 const {facts}=context(state,content,npc,template,plan.chosen);
 if(step.action!=='move') {
  // Equal physical coordinates may serve several roles; validate the requested role directly.
  const place=step.preconditions?.location;if(place&&distance(npc.position,plan.locations[place])<2)facts.location=place;
  if(!satisfies(facts,step.preconditions))return invalidate(`preconditions:${step.action}`);
 }
 const region=content.regions.find(r=>r.id===npc.region);
 if(step.action==='move') {
  const before=distance(npc.position,step.position);followPath(region,npc,step.position,seconds/(content.time?.scale||60)*(npc.goal==='flee'?3.2:1.55));
  const after=distance(npc.position,step.position);step.stalled=after>=before-.001?(step.stalled||0)+seconds:0;
  if(step.stalled>1800)return invalidate('path-unreachable');if(after<2)plan.cursor++;return false;
 }
 step.elapsed=(step.elapsed||0)+seconds;if(step.elapsed<step.expectedDuration)return true;
 if(step.action==='purchase-food'){npc.money-=4;npc.possessions.supplies=(npc.possessions.supplies||0)+1;state.regions[npc.region].stock-=.001;}
 if(step.action==='forage')npc.possessions.supplies=(npc.possessions.supplies||0)+1;
 if(step.action==='request-food'){const helper=orderedValues(state.npcs).find(n=>n.id!==npc.id&&n.hp>0&&!n.travel&&n.region===npc.region&&distance(n.position,npc.position)<5&&n.possessions?.supplies>1);if(!helper)return invalidate('helper-left');helper.possessions.supplies--;npc.possessions.supplies=(npc.possessions.supplies||0)+1;}
 if(step.action==='consume-food'){npc.possessions.supplies--;npc.hunger=Math.max(0,npc.hunger-55);}
 if(step.action==='rest')npc.fatigue=Math.max(0,npc.fatigue-12);
 if(step.action==='work'){npc.money+=step.pay||3;state.regions[npc.region].stock=Math.min(1.8,state.regions[npc.region].stock+.002);}
 if(step.action==='observe')for(const belief of npc.beliefs||[])if(!belief.checkedAt&&belief.place?.region===npc.region&&distance(npc.position,belief.place.position)<3){belief.checkedAt=state.time;rememberAction(state,content,belief.claim==='property-interference'?'crime-report':'site-inspection',{actorId:npc.id,payload:{reasonFactId:belief.factId,claim:belief.claim}});}
 plan.cursor++;if(plan.cursor>=plan.steps.length){npc.planHistory||=[];npc.planHistory.push({id:plan.id,goal:plan.goal,completedAt:state.time,actions:plan.steps.map(s=>s.action)});if(npc.planHistory.length>32)npc.planHistory.shift();npc.lastPlan={...plan,status:'completed',completedAt:state.time};npc.nextDecision=0;delete npc.plan;}
 return true;
}

// Shared executor for authored action domains (rescue, delivery, institutional work).
// It consumes the same searched precondition/effect plan representation as daily life.
export function advanceActionPlan(state,npc,seconds,{facts,handlers}) {
 const plan=npc.plan,step=plan?.steps[plan.cursor];if(!plan||plan.status!=='active')return plan?.status;
 if(!step){plan.status='completed';return plan.status;}
 if(!satisfies(facts(),step.preconditions)){plan.status='invalidated';plan.failure=`preconditions:${step.action}`;npc.nextDecision=0;return plan.status;}
 const handler=handlers[step.action];if(!handler)throw new Error(`Missing action executor: ${step.action}`);
 step.elapsed=(step.elapsed||0)+seconds;const outcome=handler(step,seconds);
 if(outcome?.failed){plan.status='invalidated';plan.failure=outcome.failed;npc.nextDecision=0;return plan.status;}
 if(outcome?.complete){plan.cursor++;if(plan.cursor>=plan.steps.length){plan.status='completed';plan.completedAt=state.time;npc.lastPlan=structuredClone(plan);npc.planHistory||=[];npc.planHistory.push({id:plan.id,goal:plan.goal,completedAt:state.time,actions:plan.steps.map(s=>s.action)});if(npc.planHistory.length>32)npc.planHistory.shift();}}
 return plan.status;
}
