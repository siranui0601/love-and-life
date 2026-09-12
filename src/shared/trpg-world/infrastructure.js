import {consumeResources,recordMilestone} from './world-semantics.js';
import {rememberAction} from './relationships.js';
import {siteDescription} from './aftermath.js';
export const DEFAULT_STRUCTURES=[{id:'deep-shaft',targetId:'LOC_DWARF_MINE',region:'dwarf',hazardEventId:'deep-mine',
 initial:{integrity:35,water:60,operating:true},safe:{integrity:80,water:5,operating:false},damagePerHour:8,shelterId:'LOC_DWARF_INN',
 failure:{kind:'collapse',exposureRange:10,effects:{integrity:0,blocked:true,operating:false}},
 actions:[{id:'close-access',label:'縄で立入を止め、坑道口を閉鎖する',minutes:15,requirements:{items:{rope:1}},effects:{operating:false}},
 {id:'drain',label:'木材と縄で排水路を組む',minutes:30,requirements:{items:{timber:2,rope:1}},effects:{water:0}},
 {id:'shore',label:'傷んだ支柱を補強する',minutes:30,requirements:{items:{timber:3},skills:['crafting']},effects:{integrity:100}},
 {id:'clear-rubble',label:'補強した入口の瓦礫を取り除く',minutes:30,when:{blocked:true,water:0,integrity:100},requirements:{items:{rope:1}},effects:{blocked:false}}]},
 {id:'grain-store',targetId:'LOC_FARM_GRANARY',region:'farm',hazardEventId:'bread-fire',shelterId:'LOC_FARM_INN',
 initial:{integrity:100,water:0,operating:true,fuel:true,fire:0},safe:{integrity:80,water:5,operating:false,fuel:false,fire:0},
 failure:{kind:'fire',traps:false,exposureRange:8,effects:{integrity:25,blocked:true,operating:false,fire:100}},
 actions:[{id:'remove-fuel',label:'漏れた灯油を拭き取り、火種を隔離する',minutes:15,when:{fire:0,fuel:true},requirements:{items:{supplies:1}},effects:{fuel:false,operating:false}},
 {id:'extinguish',label:'縄で井戸から水を汲み上げて消火する',minutes:30,when:{fire:100},requirements:{items:{rope:1}},effects:{fire:0,fuel:false}},
 {id:'clear-rubble',label:'火が消えた入口の焼け跡を片付ける',minutes:30,when:{fire:0,blocked:true},requirements:{items:{timber:1}},effects:{blocked:false}},
 {id:'shore',label:'焼けた柱を補修する',minutes:45,when:{fire:0},requirements:{items:{timber:3},skills:['crafting']},effects:{integrity:100}}]}];
export function initializeStructures(state,content) {
 state.structures||={};
 for(const spec of content.structures||[])state.structures[spec.id]||={...structuredClone(spec.initial),milestones:[]};
}
export function structureSafe(state,spec) {
 const s=state.structures?.[spec.id];return !!s&&Object.entries(spec.safe).every(([key,value])=>key==='integrity'?s[key]>=value:key==='water'?s[key]<=value:s[key]===value);
}
export function advanceStructures(state,content,seconds) {
 initializeStructures(state,content);
 for(const spec of content.structures||[]) {
  const s=state.structures[spec.id],hazard=content.events.find(e=>e.id===spec.hazardEventId);
  if(hazard&&state.time>=hazard.startsAt&&s.operating&&s.water>spec.safe.water)s.integrity=Math.max(0,s.integrity-seconds/3600*(spec.damagePerHour||3));
  if(hazard&&state.time>=hazard.startsAt&&s.fuel&&s.damageAt===undefined)s.fire=100;
  state.facilities||={};state.facilities[spec.targetId]={...state.facilities[spec.targetId],closed:!s.operating||s.integrity<=0};
 }
}
export function structureObservation(state,content,targetId) {
 const spec=(content.structures||[]).find(s=>s.targetId===targetId);if(!spec)return null;
 const s=state.structures[spec.id];return {text:`${siteDescription(s)}${s.operating?'作業は続いている。':'入口は閉じられ、作業は止まっている。'}${s.water>spec.safe.water?'水が溜まっている。':'排水は通っている。'}${s.integrity<spec.safe.integrity?'支柱にはひびがある。':'支柱は補強されている。'}`,work:structureActions(state,content,targetId)};
}
export function structureActions(state,content,targetId) {
 initializeStructures(state,content);const p=state.player,actions=[];
 for(const spec of content.structures||[])if(spec.targetId===targetId)for(const action of spec.actions) {
  if(!Object.entries(action.when||{}).every(([key,value])=>state.structures[spec.id][key]===value))continue;
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
