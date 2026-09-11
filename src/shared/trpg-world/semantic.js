// Meaning is independent of wording, HTTP receipts, object insertion order and
// narrative provider output. These helpers do not choose or invent actions.
export function canonical(value) {
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));
 return value;
}
export const stableString=value=>JSON.stringify(canonical(value));
export const orderedValues=object=>Object.values(object||{}).sort((a,b)=>String(a.id||'').localeCompare(String(b.id||''),'en'));
const parameters=['itemId','skillId','jobId','recipeId','eventId','portalId','mode','hours','quantity','x','z','ascend','sprint','heading','active'];
export function commandForOption(option,targetId,session) {
 if(session)return {type:'converse',sessionId:session.id,turn:session.turn,intentId:option.id};
 const command={type:option.type||'interact',targetId:option.targetId||targetId,action:option.action||option.id};
 for(const key of parameters)if(option[key]!==undefined)command[key]=option[key];
 return command;
}
export function semanticIdentity(option,targetId,session) {
 const command=commandForOption(option,targetId,session);
 return stableString({verb:option.intent||command.type,action:session?option.id:command.action,target:targetId||option.targetId||'self',
  parameters:Object.fromEntries(parameters.filter(k=>command[k]!==undefined).map(k=>[k,command[k]]))});
}
export function knowledgeMeaning(fact) {
 return canonical({id:fact.id,kind:fact.kind,text:fact.text,status:fact.status,documentId:fact.documentId,belief:fact.belief&&{claim:fact.belief.claim,about:fact.belief.about,source:fact.belief.source}});
}
