// Providers receive only a semantic envelope, never a mutable world reference.
import {createHash} from 'node:crypto';
export const NarrativeResponseSchema={type:'object',additionalProperties:false,
  required:['narration','npcUtterance','playerChoiceLabels','usedFactIds'],properties:{
    narration:{type:'string',maxLength:2000},npcUtterance:{type:'string',maxLength:2000},
    playerChoiceLabels:{type:'array',maxItems:5,items:{type:'object',additionalProperties:false,required:['intentId','label'],properties:{intentId:{type:'string'},label:{type:'string',maxLength:160}}}},
    usedFactIds:{type:'array',items:{type:'string'}}}};
export function narrativeEnvelope(state,result) {
  const session=state.conversation,npc=session&&state.npcs[session.speaker];
  const used=new Set(session?.factsUsed||[]);
  const known=(npc?.knowledge||[]).filter(f=>used.has(f.id));
  return {sceneKind:'conversation',place:structuredClone(session?.place),worldTime:state.time,
    participants:session?.participants||[],allowedFactIds:known.map(f=>f.id),
    speakerKnownFacts:known.map(f=>({id:f.id,text:f.text,source:structuredClone(f.source)})),
    semanticIntentIds:(result.conversation?.choices||[]).map(c=>c.id),
    semanticOutcome:{npcUtterance:result.conversation?.utterance||result.message||'',choices:structuredClone(result.conversation?.choices||[])}};
}
export function validateNarrative(response,request) {
  if(!response||typeof response!=='object'||Array.isArray(response))return false;
  if(Object.keys(response).sort().join(',')!=='narration,npcUtterance,playerChoiceLabels,usedFactIds')return false;
  if(!['narration','npcUtterance'].every(k=>typeof response[k]==='string'&&response[k].length<=2000))return false;
  if(!Array.isArray(response.usedFactIds)||!response.usedFactIds.every(id=>request.allowedFactIds.includes(id)))return false;
  const choices=response.playerChoiceLabels;
  return Array.isArray(choices)&&choices.length===request.semanticIntentIds.length&&new Set(choices.map(c=>c.intentId)).size===choices.length&&choices.every(c=>
    c&&Object.keys(c).sort().join(',')==='intentId,label'&&request.semanticIntentIds.includes(c.intentId)&&typeof c.label==='string'&&c.label.length>0&&c.label.length<=160);
}
export class DeterministicTemplateProvider {
  async generate(request) {return {narration:'',npcUtterance:request.semanticOutcome.npcUtterance,
    playerChoiceLabels:request.semanticOutcome.choices.map(c=>({intentId:c.id,label:c.label})),usedFactIds:request.allowedFactIds};}
}
export class MockNarrativeProvider {
  constructor(respond){this.respond=respond;this.calls=0;}
  async generate(request){this.calls++;return this.respond(structuredClone(request));}
}
export class CachedNarrativeProvider {
  constructor(provider=new DeterministicTemplateProvider(),{timeoutMs=700,maxEntries=256}={}){this.provider=provider;this.timeoutMs=timeoutMs;this.maxEntries=maxEntries;this.cache=new Map();this.fallback=new DeterministicTemplateProvider();}
  async generate(request) {
    const key=createHash('sha256').update(JSON.stringify(request)).digest('hex');
    if(this.cache.has(key))return structuredClone(this.cache.get(key));
    let timer,response;
    try {
      response=await Promise.race([Promise.resolve().then(()=>this.provider.generate(structuredClone(request))),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Narrative timeout')),this.timeoutMs);})]);
      if(!validateNarrative(response,request))throw new Error('Invalid narrative');
    } catch {response=await this.fallback.generate(request);} finally {clearTimeout(timer);}
    if(this.cache.size>=this.maxEntries)this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key,structuredClone(response));return structuredClone(response);
  }
}

/** Inject a provider transport explicitly. Construction/default runtime never makes a request.
 * The host owns credentials and network policy; the transport receives only allowlisted semantics.
 */
export class LiveNarrativeProvider {
  constructor({transport,timeoutMs=600,enabled=false}={}) {
    if(enabled!==true)throw new Error('Live narrative requires explicit enable');
    if(typeof transport!=='function')throw new TypeError('An explicit narrative transport is required');
    this.transport=transport;this.timeoutMs=timeoutMs;
  }
  async generate(envelope) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try {
      const response=await this.transport({envelope:structuredClone(envelope),schema:structuredClone(NarrativeResponseSchema),signal:controller.signal});
      if(!validateNarrative(response,envelope))throw new Error('Invalid live narrative response');
      return structuredClone(response);
    } finally {clearTimeout(timer);}
  }
}
