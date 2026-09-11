import {orderedValues} from './semantic.js';
import {playerIsLocal} from './activity.js';
// Fixed, allowlisted commands: imported spreadsheet expressions are never eval'd.
import {distance,hasLineOfSight,canOccupy} from './navigation.js';

const cache=new WeakMap();
const supported=new Set(['DAMAGE','HEAL','APPLY_MODIFIER','APPLY_DEBUFF','REMOVE_DEBUFF','MODIFY_RESOURCE','APPLY_SPECIAL_STATE','REMOVE_SPECIAL_STATE','INTERRUPT_CAST','MODIFY_FIELD','SUMMON_UNIT','COPY_LAST_ENEMY_SKILL','MODIFY_CRITICAL','MODIFY_ESCAPE','REMOVE_MODIFIER']);
const rng=state=>{state.random=(Math.imul(state.random,1664525)+1013904223)>>>0;return state.random/4294967296;};
function catalog(content){
  if(!cache.has(content))cache.set(content,{skills:new Map((content.enemySkills||[]).map(s=>[s.id,s])),actions:content.enemyActions||[]});
  return cache.get(content);
}
function contextValue(path,context){
  let current=context;
  for(const part of path.split('.')){if(!current||['__proto__','constructor','prototype'].includes(part))return undefined;current=current[part];}
  return current;
}
export function matchesCombatCondition(condition,context){
  if(!condition)return true;
  if(typeof condition!=='string'||condition.length>200)return false;
  const contains=condition.match(/^([\w.]+)\.(notContains|contains)\('([^']+)'\)$/);
  if(contains){const list=contextValue(contains[1],context);const found=Array.isArray(list)&&list.includes(contains[3]);return contains[2]==='contains'?found:!found;}
  const match=condition.match(/^([\w.]+)(?:%(\d+))?\s*(==|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?|true|false|'[^']*')$/);
  if(!match)return false;
  let left=contextValue(match[1],context);if(left===undefined)return false;if(match[2])left%=Number(match[2]);
  const raw=match[4],right=raw==='true'?true:raw==='false'?false:raw.startsWith("'")?raw.slice(1,-1):Number(raw);
  return ({'==':()=>left===right,'>=':()=>left>=right,'<=':()=>left<=right,'>':()=>left>right,'<':()=>left<right})[match[3]]();
}
function unitContext(unit){
  return {hpRatio:unit.hp/unit.maxHp,mpRatio:(unit.mp||0)/(unit.maxMp||1),modifiers:Object.fromEntries(Object.entries(unit.modifiers||{}).map(([id,m])=>[id,m.stage])),
    agilityStage:unit.modifiers?.agility?.stage||0,debuffs:Object.keys(unit.debuffs||{}),specialStates:Object.keys(unit.specialStates||{}),lastActionTag:unit.lastActionTag||'physical'};
}
export function chooseEnemyAction(state,content,monster){
  const data=catalog(content),allies=orderedValues(state.monsters).filter(m=>m.region===monster.region&&m.hp>0&&distance(m.position,monster.position)<30),self=unitContext(monster),target=unitContext(state.player);
  const context={self,target,ally:unitContext(allies.reduce((a,b)=>a.hp/a.maxHp<b.hp/b.maxHp?a:b,monster)),battle:{turn:(monster.actionsTaken||0)+1,enemyCount:1,allyCount:allies.length},history:{playerLastSkillRepeatable:true}};
  const candidates=data.actions.filter(a=>a.monsterId===monster.templateId&&matchesCombatCondition(a.condition,context)).filter(a=>{
    const s=data.skills.get(a.skillId);return s&&s.effects?.some(e=>supported.has(e.command))&&(s.mp||0)<=(monster.mp||0)&&(!a.limit||(monster.usedActions?.[a.id]||0)<a.limit);
  });
  if(!candidates.length)return {id:'basic',name:'攻撃',mp:0,cooldownSeconds:2.4,effects:[{command:'DAMAGE',multiplier:1,damageType:'physical',target:'single_enemy'}]};
  const maxPriority=Math.max(...candidates.map(a=>a.priority||0)),preferred=candidates.filter(a=>(a.priority||0)===maxPriority);
  let weight=rng(state)*preferred.reduce((sum,a)=>sum+Math.max(1,a.weight||1),0),selected=preferred[0];
  for(const action of preferred){weight-=Math.max(1,action.weight||1);if(weight<=0){selected=action;break;}}
  monster.usedActions||={};monster.usedActions[selected.id]=(monster.usedActions[selected.id]||0)+1;
  return data.skills.get(selected.skillId);
}
export function startEnemyAction(state,content,monster,template){
  const skill=chooseEnemyAction(state,content,monster),scale=1;
  monster.mp=Math.max(0,(monster.mp||0)-(skill.mp||0));monster.actionsTaken=(monster.actionsTaken||0)+1;
  monster.intent={skillId:skill.id,name:skill.name,position:[...state.player.position],resolvesAt:state.simulationTime+(template.role==='fast'?.55:template.role==='artillery'?1.4:.9)*scale,effects:skill.effects};
  monster.cooldown=Math.max(2.4,Math.min(8,skill.cooldownSeconds||2.4));
}
export function resolveEnemyAction(state,content,monster,template){
  const intent=monster.intent;if(!intent||state.simulationTime<intent.resolvesAt)return 0;
  delete monster.intent;
  const p=state.player,scale=1;
  const region=content.regions.find(r=>r.id===monster.region);
  const targetStillThere=p.region===monster.region&&playerIsLocal(state)&&distance(p.position,monster.position)<(template.range||2.8)+2&&distance(p.position,intent.position)<3&&hasLineOfSight(region,monster.position,p.position);
  let totalDamage=0;
  const criticalChance=intent.effects.find(e=>e.command==='MODIFY_CRITICAL')?.criticalChance||0;
  const critical=criticalChance&&rng(state)*100<criticalChance?1.5:1;
  for(const effect of intent.effects||[]){
    if(!supported.has(effect.command))continue;
    const friendly=['self','single_ally','all_allies','field','self_action'].includes(effect.target);
    const allies=orderedValues(state.monsters).filter(m=>m.region===monster.region&&m.hp>0&&distance(m.position,monster.position)<25);
    const target=effect.target==='single_ally'?allies.reduce((a,b)=>a.hp/a.maxHp<b.hp/b.maxHp?a:b,monster):friendly?monster:p;
    if(!friendly&&!targetStillThere)continue;
    if(effect.command==='DAMAGE'){
      const armor=(content.equipment||[]).find(e=>e.id===p.equipment.body),guard=p.guarding&&p.stamina>8?.35:1;
      const defense=(armor?.defense||0)+Math.max(-5,p.modifiers?.defense?.stage||0);
      let damage=Math.max(1,Math.round(((template.attack||8)*Math.min(2.5,effect.multiplier||1)*Math.min(3,effect.hits||1)-defense)*guard*critical));
      if(p.dodgeUntil>state.simulationTime)continue;
      const barrier=p.specialStates?.barrier;
      if(barrier){const absorbed=Math.min(barrier.capacity||0,damage);damage-=absorbed;barrier.capacity-=absorbed;}
      if(p.guarding)p.stamina=Math.max(0,p.stamina-8);
      p.hp-=damage;totalDamage+=damage;p.lastAttack=state.simulationTime;
    } else if(effect.command==='HEAL')target.hp=Math.min(target.maxHp,target.hp+Math.round(target.maxHp*Math.min(.3,effect.ratio||.15)));
    else if(effect.command==='MODIFY_RESOURCE'){const resource=effect.resource;if(['hp','mp','stamina'].includes(resource)){const maximum=target[`max${resource[0].toUpperCase()+resource.slice(1)}`]||100;target[resource]=Math.max(0,Math.min(maximum,(target[resource]||0)+(effect.amount||0)+maximum*(effect.amountRatio||0)));}}
    else if(effect.command==='APPLY_MODIFIER'){target.modifiers||={};target.modifiers[effect.modifier]={stage:Math.max(-3,Math.min(3,effect.stage||0)),expiresAt:state.simulationTime+Math.max(2,effect.durationTurns||2)*2*scale};}
    else if(effect.command==='APPLY_DEBUFF'){
      if(rng(state)*100>(effect.baseChance??100))continue;
      target.debuffs||={};target.debuffs[effect.debuffId]={expiresAt:state.simulationTime+Math.max(2,effect.durationTurns||2)*2*scale,params:effect.params||{}};
    } else if(effect.command==='REMOVE_DEBUFF')for(const id of Object.keys(target.debuffs||{}).slice(0,effect.count||1))delete target.debuffs[id];
    else if(effect.command==='APPLY_SPECIAL_STATE'){target.specialStates||={};target.specialStates[effect.stateId]={expiresAt:state.simulationTime+(effect.durationTurns?effect.durationTurns*2:10)*scale,params:effect.params||{},capacity:effect.stateId==='barrier'?Math.round(target.maxHp*.12):0};}
    else if(effect.command==='REMOVE_SPECIAL_STATE')delete target.specialStates?.[effect.stateId];
    else if(effect.command==='INTERRUPT_CAST')p.staggerUntil=state.simulationTime+scale;
    else if(effect.command==='MODIFY_FIELD'){state.fields||={};state.fields[monster.region]={id:effect.fieldEffect,expiresAt:state.simulationTime+15*scale};}
    else if(effect.command==='REMOVE_MODIFIER'){const entry=target.modifiers?.[effect.modifier];if(entry&&(effect.direction!=='negative'||entry.stage<0))delete target.modifiers[effect.modifier];}
    else if(effect.command==='MODIFY_ESCAPE'){if(rng(state)*100<35+(effect.bonus||0)){monster.fleeUntil=state.simulationTime+30*scale;monster.activity='flee';}}
    else if(effect.command==='COPY_LAST_ENEMY_SKILL'&&targetStillThere&&p.lastCombatDamage){const damage=Math.max(1,Math.round(p.lastCombatDamage*(effect.powerMultiplier||.75)));p.hp-=damage;totalDamage+=damage;}
    else if(effect.command==='SUMMON_UNIT'){
      let candidates=(content.monsters||[]).filter(m=>m.region===monster.region&&!m.boss&&!m.sourceCondition);
      if(effect.unitPool==='slime_fragment')candidates=(content.monsters||[]).filter(m=>!m.boss&&/スライム/.test(m.name));
      else if(effect.unitPool==='rift_spawn')candidates=(content.monsters||[]).filter(m=>!m.boss&&/亀裂|虚無/.test(m.name));
      else if(effect.unitPool==='same_family_minion'){const matching=candidates.filter(m=>(m.tags||[]).some(tag=>(template.tags||[]).includes(tag)));if(matching.length)candidates=matching;}
      const minion=candidates.sort((a,b)=>a.level-b.level)[0];if(!minion)continue;
      for(let i=0;i<Math.min(2,effect.count||1)&&allies.length+i<6;i++){
        const position=[monster.position[0]+(i?3:-3),0,monster.position[2]+2];if(!canOccupy(region,position))continue;
        const id=`summon:${monster.id}:${state.nextId++}`,hp=Math.min(100,Math.max(15,Math.round(minion.hp*.6)));
        state.monsters[id]={id,templateId:minion.id,region:monster.region,position:[...position],home:[...position],hp,maxHp:hp,mp:15,maxMp:15,cooldown:1,respawnAt:0,lastThreat:state.simulationTime,heading:0,activity:'attack',summoned:true,expiresAt:state.simulationTime+60*scale};
      }
    }
  }
  return totalDamage;
}
export function tickCombatEffects(state,unit,gameDelta,scale){
  for(const collection of ['modifiers','debuffs','specialStates'])for(const [id,effect] of Object.entries(unit[collection]||{})){
    if(effect.expiresAt<=state.simulationTime){delete unit[collection][id];continue;}
    if(collection==='debuffs'&&id==='poison')unit.hp=Math.max(1,unit.hp-gameDelta/scale*.6);
  }
  if(unit.id!=='player'&&unit.mp!==undefined)unit.mp=Math.min(unit.maxMp||100,unit.mp+gameDelta/scale*.15);
}
export function combatImportDiagnostics(content){
  const unsupported=new Set();for(const skill of content.enemySkills||[])for(const effect of skill.effects||[])if(!supported.has(effect.command))unsupported.add(effect.command);
  return {importedEnemySkills:(content.enemySkills||[]).length,supportedCommands:[...supported],deferredCommands:[...unsupported].sort()};
}
