import {societyDefinitions} from './society-content.js';
import {distance,hasLineOfSight} from './navigation.js';
import {rememberAction} from './relationships.js';
import {setActivity} from './activity.js';
import {beginWorldAction,completeWorldAction} from './world-actions.js';
export function initializeProperty(state,content) {
 if(state.societyPropertyVersion===1)return;
 state.properties||={};
 for(const definition of societyDefinitions(content).properties)state.properties[definition.id]||={...structuredClone(definition),openedBy:[],inspectedBy:[],quantity:1};
 state.societyPropertyVersion=1;
}
function accessible(state,content,o) {
 if(!o||state.player.hp<=0||state.player.collapse?.status==='active'||state.player.actionInstance||state.player.activity?.kind==='travelling')return false;
 if(o.custodianId==='player'&&!o.parentId)return true;
 if(o.region!==state.player.region||distance(o.position,state.player.position)>4||!hasLineOfSight(content.regions.find(r=>r.id===o.region),state.player.position,o.position))return false;
 const parent=state.properties[o.parentId];return !parent||parent.openedBy.includes('player')&&parent.inspectedBy.includes('player')&&accessible(state,content,parent);
}
export function propertyActions(state,content,id) {
 const o=state.properties?.[id];if(!accessible(state,content,o))return [];
 const choice=(action,label)=>({id:`property:${action}:${id}`,type:'property',action,targetId:id,label});
 if(o.kind==='container')return o.openedBy.includes('player')?[choice('look','中を確かめる'),choice('close','閉める')]:[choice('open',o.privacy==='private'?'私物の箱を開ける':'箱を開ける')];
 const actions=[];
 if(o.document)actions.push(choice('read','文書を読む'));
 if(o.custodianId!=='player')actions.push(choice('take',o.ownerId==='player'||o.privacy==='public'?'持つ':'持ち去る'));
 else if(o.originalParentId&&accessible(state,content,state.properties[o.originalParentId]))actions.push(choice('return','元の箱へ戻す'));
 return actions;
}
export function propertyView(state,content) {
 initializeProperty(state,content);
 return Object.values(state.properties).filter(o=>accessible(state,content,o)).map(o=>({id:o.id,name:o.name,kind:o.kind,position:[...o.position],distance:o.custodianId==='player'?0:distance(o.position,state.player.position),
  held:o.custodianId==='player'&&!o.parentId,private:o.privacy==='private',ownerName:content.npcs.find(n=>n.id===o.ownerId)?.name,
  actions:propertyActions(state,content,o.id)}));
}
export function performPropertyAction(state,content,command) {
 initializeProperty(state,content);
 const choice=propertyActions(state,content,command.targetId).find(a=>a.action===command.action);
 if(!choice)throw Object.assign(new Error('ここではその物に触れられません。'),{code:'PROPERTY_INACCESSIBLE',status:409});
 const o=state.properties[command.targetId],action=beginWorldAction(state,choice),payload={ownerId:o.ownerId,assetId:o.id,private:o.privacy==='private'};
 let kind,message,document;
 if(command.action==='open'){o.openedBy.push('player');kind='container-opened';message='箱を開けた。';}
 if(command.action==='look'){if(!o.inspectedBy.includes('player'))o.inspectedBy.push('player');kind='container-inspected';message='中にある物を確かめた。';}
 if(command.action==='close'){o.openedBy=[];o.inspectedBy=[];kind='container-closed';message='箱を閉めた。';}
 if(command.action==='read') {
  kind='document-read';document={title:o.document.title,text:o.document.text};message='文書に目を通した。';
  const id=o.document.knowledgeId||`document:${o.id}`;
  if(!state.knowledge.some(k=>k.id===id))state.knowledge.push({id,kind:'document',text:o.document.text,documentId:o.document.id,propertyId:o.id,eventId:o.document.eventId,region:o.region,observedAt:state.time,source:{type:'read',objectId:o.id},confidence:1});
 }
 if(command.action==='take'||command.action==='return') {
  const taking=command.action==='take',from=o.custodianId;
  if(taking){o.originalParentId=o.parentId;o.parentId=null;o.custodianId='player';}else{o.parentId=o.originalParentId;o.custodianId=state.properties[o.parentId].custodianId;}
  kind=taking&&o.ownerId!=='player'&&o.privacy==='private'?'theft':taking?'property-taken':'property-returned';message=taking?'文書を持った。':'元の場所へ戻した。';
  state.propertyTransfers||=[];const transfer={id:`custody:${state.nextId++}`,from,to:o.custodianId,assetId:o.id,quantity:1,reason:kind,at:state.time};state.propertyTransfers.push(transfer);payload.custodyId=transfer.id;
 }
 // Observers see the reading action, never receive the text from its payload.
 const fact=rememberAction(state,content,kind,{targetId:o.id,payload});
 if(kind==='theft'){state.propertyIncidents||=[];state.propertyIncidents.push({id:`property:${state.nextId++}`,factId:fact.id,victimId:o.ownerId,assetId:o.id,amount:1,at:state.time,discoverAfter:state.time+1800,status:'undiscovered',witnessIds:fact.witnesses,location:{region:o.region,position:[...o.position]}});}
 if(kind==='property-returned')for(const i of state.propertyIncidents||[])if(i.assetId===o.id&&i.status==='undiscovered')i.status='returned-before-discovery';
 setActivity(state,'inspecting',{targetId:o.id});
 return completeWorldAction(state,action,{message,factId:fact.id,...(document?{document}:{})});
}
