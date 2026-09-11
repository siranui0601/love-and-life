// Canonical property bindings point to actual inventories. No shadow balances.
export function propertyAccount(state,id) {
 if(id==='player')return {holder:state.player,currency:'gold',inventory:state.player.inventory};
 const npc=state.npcs[id];if(!npc)return null;npc.possessions||={};return {holder:npc,currency:'money',inventory:npc.possessions};
}
export function possessions(state,id) {
 const account=propertyAccount(state,id);if(!account)return [];
 return [...(account.holder[account.currency]>0?[{kind:'currency',assetId:'gold',quantity:account.holder[account.currency]}]:[]),...Object.entries(account.inventory).filter(([,q])=>q>0).map(([assetId,quantity])=>({kind:'item',assetId,quantity}))];
}
export function transferProperty(state,{from,to,kind,assetId,quantity,reason,sourceFactId=null}) {
 const a=propertyAccount(state,from),b=propertyAccount(state,to);if(!a||!b||from===to||!Number.isSafeInteger(quantity)||quantity<=0)throw new Error('Invalid property transfer');
 if(!['currency','item'].includes(kind)||kind==='currency'&&assetId!=='gold')throw new Error('Unknown property kind');
 const source=kind==='currency'?a.holder:a.inventory,target=kind==='currency'?b.holder:b.inventory,key=kind==='currency'?a.currency:assetId,destKey=kind==='currency'?b.currency:assetId;
 if((source[key]||0)<quantity)throw new Error('Property source depleted');source[key]-=quantity;target[destKey]=(target[destKey]||0)+quantity;
 const record={id:`custody:${state.nextId++}`,from,to,kind,assetId,quantity,reason,sourceFactId,at:state.time};state.propertyTransfers||=[];state.propertyTransfers.push(record);
 // Unique documents/objects retain their legal owner while custody changes.
 if(kind==='item'&&state.worldObjects?.[assetId]){const o=state.worldObjects[assetId];o.custodianId=to;o.region=b.holder.region;o.position=[...b.holder.position];}
 return record;
}
