import {searchPlan,advanceActionPlan} from './npc-planner.js';
import {worldSite,advanceActorJourney} from './actor-journey.js';
import {distance,hasLineOfSight} from './navigation.js';
import {rememberAction} from './relationships.js';
import {depositDocuments} from './world-semantics.js';

export function initializeShipments(state,content){
 state.shipments||={};state.properties||={};
 for(const spec of content.shipments||[]){
  if(state.shipments[spec.id])continue;
  // Historical saves keep their world; new cargo is not materialised behind
  // a restored player's back. New-game authoring supplies these possessions.
  if(state.contentRevision!==content.revision){state.shipments[spec.id]={legacyDormant:true};continue;}
  const origin=worldSite(content,spec.originId);if(!origin)continue;
  const boxId=`cargo:${spec.id}`,contents=spec.manifest.map((_,i)=>`${boxId}:${i}`);
  const common={ownerId:spec.ownerId,custodianId:spec.ownerId,region:origin.region,position:[...origin.position],privacy:'private',openedBy:[],inspectedBy:[]};
  state.properties[boxId]={...common,id:boxId,name:spec.name,kind:'container',anchorId:origin.id,contents,quantity:1};
  for(const [i,lot] of spec.manifest.entries())state.properties[contents[i]]={...structuredClone(common),...structuredClone(lot),id:contents[i],kind:'item',parentId:boxId};
  state.shipments[spec.id]={phase:'awaiting-carrier',boxId,initializedAt:state.time};
  if(state.npcs[spec.carrierId])depositDocuments(state,{holderId:spec.carrierId,documents:[spec.billId],sourceFactId:null});
 }
}
function moveCustody(state,content,spec,shipment,to,actor,kind){
 const box=state.properties[shipment.boxId],objects=[box,...box.contents.map(id=>state.properties[id]).filter(o=>o?.parentId===box.id)];
 const fact=rememberAction(state,content,kind,{actorId:actor.id,targetId:box.id,payload:{shipmentId:spec.id,from:box.custodianId,to,assets:objects.map(o=>({id:o.id,quantity:o.quantity}))}});
 state.propertyTransfers||=[];
 for(const object of objects){state.propertyTransfers.push({id:`custody:${state.nextId++}`,assetId:object.id,from:object.custodianId,to,quantity:object.quantity,reason:kind,sourceFactId:fact.id,at:state.time});object.custodianId=to;}
 return fact;
}
function locateCargo(state,shipment,holder,anchorId=null){
 const box=state.properties[shipment.boxId];
 for(const object of [box,...box.contents.map(id=>state.properties[id]).filter(o=>o?.parentId===box.id)]){
  object.region=holder.region;object.position=[...holder.position];object.inTransit=!!holder.travel;
 }
 box.anchorId=anchorId;
}
export function shipmentSecured(state,id,orderId){
 const shipment=state.shipments?.[id],box=state.properties?.[shipment?.boxId];
 return shipment?.phase==='impounded'&&shipment.orderId===orderId&&box?.custodianId===`institution:${orderId}`&&box.contents.every(id=>state.properties[id]?.parentId===box.id&&state.properties[id]?.custodianId===box.custodianId);
}
// Local execution consumes the actual delivered container. Legal ownership is
// unchanged; missing/stolen contents cannot be silently recreated by a receipt.
export function impoundShipment(state,content,id,order,official,target){
 const spec=content.shipments?.find(s=>s.id===id),shipment=state.shipments?.[id],box=state.properties?.[shipment?.boxId];
 if(!spec||!box||shipment.legacyDormant)return false;
 if(shipmentSecured(state,id,order.factId))return true;
 const carrier=state.npcs[spec.carrierId],arriving=box.custodianId===carrier?.id&&!carrier.travel&&carrier.region===official.region&&distance(carrier.position,target.position)<3;
 if(box.anchorId!==target.id&&!arriving||box.region!==official.region||official.travel||box.inTransit||distance(official.position,box.position)>=6||!hasLineOfSight(content.regions.find(r=>r.id===official.region),official.position,box.position))return false;
 if(!box.contents.every(id=>state.properties[id]?.parentId===box.id))return false;
 const fact=moveCustody(state,content,spec,shipment,`institution:${order.factId}`,official,'cargo-impounded');
 locateCargo(state,shipment,{region:official.region,position:box.position},target.id);
 shipment.phase='impounded';shipment.orderId=order.factId;shipment.impoundedAt=state.time;shipment.receiptFactId=fact.id;
 if(carrier?.transportAssignment===spec.id){delete carrier.transportAssignment;if(carrier.plan?.shipmentId===spec.id){carrier.plan.status='cancelled';carrier.lastPlan=structuredClone(carrier.plan);delete carrier.plan;}carrier.nextDecision=0;}
 return true;
}
export function advanceShipments(state,content,seconds){
 initializeShipments(state,content);if(seconds<=0)return;
 for(const spec of content.shipments||[]){
  const shipment=state.shipments[spec.id];if(shipment.legacyDormant||['delivered','impounded','failed'].includes(shipment.phase)||state.time<spec.dispatchAt)continue;
  const actor=state.npcs[spec.carrierId],origin=worldSite(content,spec.originId),destination=worldSite(content,spec.destinationId),box=state.properties[shipment.boxId];
  if(!actor||!origin||!destination||actor.hp<=0)continue;
  if(actor.rescueAssignment||actor.causalAssignment||actor.aftermathAssignment||actor.institutionalAssignment||actor.entrapment||actor.companionOf||actor.injury&&!actor.injury.treated)continue;
  if(actor.transportAssignment&&actor.transportAssignment!==spec.id)continue;
  if(!actor.transportAssignment){
   if(!state.documentCustody?.[actor.id]?.some(d=>d.documentId===spec.billId))continue;
   actor.knowledge.push({id:`bill:${spec.id}`,kind:'document',text:`${origin.name}の${spec.name}を${destination.name}へ運ぶ。`,observedAt:state.time,source:{type:'read',documentId:spec.billId},itinerary:[...spec.routeIds]});
   const steps=searchPlan({atOrigin:false,loaded:false,atDestination:false,delivered:false},{delivered:true},[
    {action:'reach-cargo',preconditions:{},effects:{atOrigin:true},cost:1},
    {action:'load-cargo',preconditions:{atOrigin:true},effects:{loaded:true},expectedDuration:300,cost:1},
    {action:'carry-cargo',preconditions:{loaded:true},effects:{atDestination:true},cost:1},
    {action:'unload-cargo',preconditions:{loaded:true,atDestination:true},effects:{delivered:true},expectedDuration:300,cost:1}]);
   actor.plan={id:`plan:${state.nextId++}`,goal:'deliver-cargo',status:'active',steps,cursor:0,shipmentId:spec.id,createdAt:state.time};actor.transportAssignment=spec.id;shipment.phase='collecting';
  }
  if(actor.plan?.shipmentId!==spec.id){shipment.phase='failed';shipment.failure='carrier-plan-interrupted';delete actor.transportAssignment;continue;}
  actor.activity='荷札を確かめ、預かった貨物を運ぶ';
  const nearby=target=>!actor.travel&&actor.region===target.region&&distance(actor.position,target.position)<3&&hasLineOfSight(content.regions.find(r=>r.id===actor.region),actor.position,target.position);
  const status=advanceActionPlan(state,actor,seconds,{facts:()=>({atOrigin:nearby(origin),atDestination:nearby(destination),loaded:box.custodianId===actor.id}),handlers:{
   'reach-cargo':(_,dt)=>advanceActorJourney(state,content,actor,origin.id,dt,spec),
   'load-cargo':step=>{
    if(state.facilities[origin.id]?.closed)return {};
    if(box.custodianId!==spec.ownerId||box.contents.some(id=>state.properties[id]?.parentId!==box.id))return {failed:'cargo-missing'};
    if(step.elapsed<step.expectedDuration)return {};
    const fact=moveCustody(state,content,spec,shipment,actor.id,actor,'cargo-loaded');shipment.phase='in-transit';shipment.loadedAt=state.time;shipment.loadingFactId=fact.id;locateCargo(state,shipment,actor);return {complete:true};},
   'carry-cargo':(_,dt)=>{const result=advanceActorJourney(state,content,actor,destination.id,dt,spec);locateCargo(state,shipment,actor);return result;},
   'unload-cargo':step=>{
    if(step.elapsed<step.expectedDuration)return {};
    const policy=state.facilities[destination.id],order=policy?.orderId&&state.institutionalOrders?.[policy.orderId];
    if(policy?.closed&&!order?.impoundShipments?.includes(spec.id))return {};
    const receiver=state.npcs[spec.receiverId];
    if(!receiver||receiver.hp<=0||receiver.travel||receiver.region!==actor.region||distance(receiver.position,actor.position)>6||!hasLineOfSight(content.regions.find(r=>r.id===actor.region),receiver.position,actor.position))return {};
    const fact=moveCustody(state,content,spec,shipment,spec.receiverId,actor,'cargo-delivered');
    locateCargo(state,shipment,destination,destination.id);shipment.phase='delivered';shipment.deliveredAt=state.time;shipment.deliveryFactId=fact.id;return {complete:true};}
  }});
  if(status==='invalidated'){shipment.phase='failed';shipment.failure=actor.plan.failure;}
  if(status==='completed'||status==='invalidated'){delete actor.transportAssignment;delete actor.plan;actor.nextDecision=0;}
 }
}
