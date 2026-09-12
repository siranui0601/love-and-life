import {consumeResources,recordMilestone} from './world-semantics.js';
import {rememberAction} from './relationships.js';
export const DEFAULT_STRUCTURES=[{id:'deep-shaft',targetId:'LOC_DWARF_MINE',region:'dwarf',hazardEventId:'deep-mine',
 initial:{integrity:35,water:60,operating:true},safe:{integrity:80,water:5,operating:false},
 actions:[{id:'close-access',label:'縄で立入を止め、坑道口を閉鎖する',minutes:15,requirements:{items:{rope:1}},effects:{operating:false}},
 {id:'drain',label:'木材と縄で排水路を組む',minutes:30,requirements:{items:{timber:2,rope:1}},effects:{water:0}},
 {id:'shore',label:'傷んだ支柱を補強する',minutes:30,requirements:{items:{timber:3},skills:['crafting']},effects:{integrity:100}}]}];
export function initializeStructures(state,content) {
 state.structures||={};
 for(const spec of content.structures||[])state.structures[spec.id]||={...structuredClone(spec.initial),milestones:[]};
}
export function structureSafe(state,spec) {
 const s=state.structures?.[spec.id];return !!s&&s.integrity>=spec.safe.integrity&&s.water<=spec.safe.water&&s.operating===spec.safe.operating;
}
export function advanceStructures(state,content,seconds) {
 initializeStructures(state,content);
 for(const spec of content.structures||[]) {
  const s=state.structures[spec.id],hazard=content.events.find(e=>e.id===spec.hazardEventId);
  if(hazard&&state.time>=hazard.startsAt&&s.operating&&s.water>spec.safe.water)s.integrity=Math.max(0,s.integrity-seconds/3600*3);
  state.facilities||={};state.facilities[spec.targetId]={...state.facilities[spec.targetId],closed:!s.operating||s.integrity<=0};
 }
}
export function structureObservation(state,content,targetId) {
 const spec=(content.structures||[]).find(s=>s.targetId===targetId);if(!spec)return null;
 const s=state.structures[spec.id];return {text:`${s.operating?'作業は続いている。':'入口は閉じられ、作業は止まっている。'}${s.water>spec.safe.water?'水が溜まっている。':'排水は通っている。'}${s.integrity<spec.safe.integrity?'支柱にはひびがある。':'支柱は補強されている。'}`,work:structureActions(state,content,targetId)};
}
export function structureActions(state,content,targetId) {
 initializeStructures(state,content);const p=state.player,actions=[];
 for(const spec of content.structures||[])if(spec.targetId===targetId)for(const action of spec.actions) {
  if(Object.entries(action.effects).every(([key,value])=>state.structures[spec.id][key]===value))continue;
  const missing=[];for(const [id,n] of Object.entries(action.requirements.items||{}))if((p.inventory[id]||0)<n)missing.push(`${content.items.find(i=>i.id===id)?.name||id} ${n}個`);
  for(const id of action.requirements.skills||[])if(!p.skills.includes(id))missing.push(content.skills.find(s=>s.id===id)?.name||id);
  actions.push({id:action.id,type:'maintain',label:`${action.label} · ${action.minutes}分`,requirements:structuredClone(action.requirements),available:!missing.length,missing});
 }
 return actions;
}
// Resource reservation precedes elapsed work. Completion changes physical
// fields only; the causal evaluator separately decides any incident outcome.
export function startStructureWork(state,content,targetId,actionId) {
 const spec=(content.structures||[]).find(s=>s.targetId===targetId),action=spec?.actions.find(a=>a.id===actionId);
 if(!structureActions(state,content,targetId).some(a=>a.id===actionId&&a.available))throw Object.assign(new Error('この作業に必要な準備が整っていません。'),{code:'STRUCTURE_REQUIREMENTS',status:409});
 if(!consumeResources(state.player.inventory,action.requirements.items||{}))throw new Error('Structure resource reservation failed');
 return {spec,action};
}
export function finishStructureWork(state,content,{spec,action}) {
 const object=state.structures[spec.id];Object.assign(object,action.effects);
 const fact=rememberAction(state,content,'maintenance',{targetId:spec.targetId,payload:{action:action.id,physicalChanges:structuredClone(action.effects)}});
 recordMilestone(state,object,action.id,fact.id);advanceStructures(state,content,0);
}
