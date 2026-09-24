import {distance,hasLineOfSight,followPath} from './navigation.js';
import {searchPlan,advanceActionPlan} from './npc-planner.js';
import {rememberAction} from './relationships.js';
import {observeWorkplace} from './world-semantics.js';
import {impoundShipment,shipmentSecured} from './shipments.js';
import {advanceFieldOrder} from './actor-operations.js';
import {advanceOccupancyRestitution} from './occupancy.js';

// An issued document is not an enacted site policy. The official who carries
// it must reach the semantic destination; geometry is resolved at execution.
export function advanceInstitutionalExecution(state,content,spec,process,seconds){
 if(spec.enforcement)return advanceFieldOrder(state,content,spec,process,seconds);
 const order=process.order;if(!order?.executionRequired||seconds<=0)return;
 if(spec.restoresClaims?.length&&order.execution?.evidence){advanceOccupancyRestitution(state,content,spec,order,seconds);return;}
 if(order.execution?.status==='completed')return;
 const actor=state.npcs[order.authority],region=content.regions.find(r=>r.id===spec.region),target=region?.objects.find(o=>o.id===spec.access?.targetId);
 if(!actor||!target||actor.hp<=0||actor.travel||actor.region!==spec.region)return;
 if(actor.entrapment||actor.rescueAssignment||actor.aftermathAssignment||actor.companionOf||actor.injury&&!actor.injury.treated)return;
 if(actor.institutionalAssignment&&actor.institutionalAssignment!==order.factId)return;
 if(!actor.institutionalAssignment){
  if(!actor.knowledge.some(k=>k.id===`order-copy:${order.factId}`))actor.knowledge.push({id:`order-copy:${order.factId}`,kind:'document',text:`${target.name}で、交付した現場管理命令を執行する。`,observedAt:state.time,source:{type:'read',documentId:order.factId}});
  const cargo=order.impoundShipments||[];
  const steps=searchPlan({arrived:false,enacted:false,secured:false},cargo.length?{secured:true}:{enacted:true},[
   {action:'reach-order-site',preconditions:{},effects:{arrived:true},cost:1},
   {action:'enact-site-policy',preconditions:{arrived:true},effects:{enacted:true},expectedDuration:60,cost:1},
   {action:'secure-delivered-cargo',preconditions:{arrived:true,enacted:true},effects:{secured:true},cost:1}]);
  actor.plan={id:`plan:${state.nextId++}`,goal:'enact-order',status:'active',steps,cursor:0,orderId:order.factId,createdAt:state.time};
  actor.institutionalAssignment=order.factId;order.execution={status:'in-progress',actorId:actor.id,targetId:target.id,startedAt:state.time};
 }
 if(actor.plan?.orderId!==order.factId){order.execution={...order.execution,status:'interrupted'};delete actor.institutionalAssignment;return;}
 actor.activity='命令書を携え、現場で通行と作業の扱いを改める';
 const nearby=()=>distance(actor.position,target.position)<3&&hasLineOfSight(region,actor.position,target.position);
 const cargoPending=()=>!(order.impoundShipments||[]).every(id=>shipmentSecured(state,id,order.factId));
 const status=advanceActionPlan(state,actor,seconds,{facts:()=>({arrived:nearby(),enacted:state.facilities[target.id]?.orderId===order.factId}),handlers:{
  'reach-order-site':(step,dt)=>{followPath(region,actor,target.position,dt/(content.time?.scale||60)*1.55);return step.elapsed>4*3600?{failed:'order-site-unreachable'}:{complete:nearby()};},
  'enact-site-policy':step=>{if(step.elapsed<step.expectedDuration)return {};const fact=rememberAction(state,content,'site-order-enacted',{actorId:actor.id,targetId:target.id,payload:{orderId:order.factId,closed:spec.access.closed}});
   state.facilities[target.id]={...state.facilities[target.id],closed:spec.access.closed,orderId:order.factId};
   order.execution={...order.execution,status:cargoPending()?'awaiting-cargo':'completed',at:state.time,evidence:fact.id};
   state.institutionalOrders[order.factId].execution=structuredClone(order.execution);
   observeWorkplace(state,actor,target,spec.access.closed);return {complete:true};},
  'secure-delivered-cargo':()=>{
   for(const id of order.impoundShipments||[])impoundShipment(state,content,id,order,actor,target);
   if(cargoPending())return {};
   order.execution={...order.execution,status:'completed',at:state.time,custodyReceipts:order.impoundShipments.map(id=>state.shipments[id].receiptFactId)};
   state.institutionalOrders[order.factId].execution=structuredClone(order.execution);return {complete:true};}
 }});
 if(status==='completed'||status==='invalidated'){
  if(status==='invalidated')order.execution={...order.execution,status:'failed',reason:actor.plan?.failure};
  delete actor.institutionalAssignment;delete actor.plan;actor.nextDecision=0;
 }
}
