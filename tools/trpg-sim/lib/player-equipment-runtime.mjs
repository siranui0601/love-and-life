const rule = (domain, type, params = {}) => Object.freeze({ domain, type, ...params });

export const EQUIPMENT_RUNTIME_RULES = Object.freeze({
  'EQP-W-0003': Object.freeze({ drawback: rule('battle','HIT_SELF_STAGE',{chance:0.03,stat:'physicalPower',stage:-1}) }),
  'EQP-W-0014': Object.freeze({ drawback: rule('battle','ESCAPE_CHANCE',{delta:-0.10}) }),
  'EQP-W-0023': Object.freeze({ passive: rule('battle','TAG_MAGIC_DAMAGE',{tags:['water','wind'],scale:1.05}) }),
  'EQP-W-0025': Object.freeze({ drawback: rule('world','INSPECTION_RISK',{regions:['王都'],saleBlocked:true,risk:'contraband_interest'}) }),
  'EQP-W-0026': Object.freeze({ drawback: rule('battle','HIT_SELF_STAGE',{chance:0.04,stat:'accuracy',stage:-1}) }),
  'EQP-W-0027': Object.freeze({ drawback: rule('world','INSPECTION_RISK',{regions:['checkpoint'],risk:'infamy_or_fine'}) }),
  'EQP-W-0028': Object.freeze({ drawback: rule('hybrid','CONFISCATION_AND_NORMAL_DELAY',{risk:'confiscation',normalActionOrderDelta:-5}) }),
  'EQP-W-0036': Object.freeze({ passive: rule('battle','TARGET_GUARD_DAMAGE',{scale:1.12}) }),
  'EQP-W-0037': Object.freeze({ drawback: rule('battle','DAMAGE_TAKEN',{scale:1.05}) }),
  'EQP-W-0042': Object.freeze({ passive: rule('battle','WEATHER_ACCURACY_MITIGATION',{points:5,weathers:['night','snow']}) }),
  'EQP-W-0045': Object.freeze({ passive: rule('battle','STRUCTURE_BARRIER_DAMAGE',{scale:1.10}) }),
  'EQP-W-0050': Object.freeze({ passive: rule('battle','REGEN_HEAL',{scale:1.08}) }),
  'EQP-W-0051': Object.freeze({ passive: rule('battle','DEBUFF_DURATION_PROC',{chance:0.10,turns:1,debuffs:['poison','paralysis','confusion']}) }),
  'EQP-W-0059': Object.freeze({ passive: rule('battle','FIELD_MP_REGEN',{tag:'waterSide',amount:1}) }),
  'EQP-W-0061': Object.freeze({ passive: rule('battle','NORMAL_ATTACK_SCALE',{scale:0.90}) }),
  'EQP-W-0062': Object.freeze({ drawback: rule('battle','ZERO_GOLD_POWER_STAGE',{stage:-1}) }),
  'EQP-W-0063': Object.freeze({ passive: rule('battle','LOW_LUCK_PHYSICAL_DAMAGE',{maxScale:1.25}) }),
  'EQP-W-0064': Object.freeze({ drawback: rule('battle','AFTER_SKILL_STAGE',{skillId:'SKL-1139',stat:'magicPower',stage:-1,durationTurns:2}) }),
  'EQP-A-0005': Object.freeze({ passive: rule('battle','TAG_DAMAGE_TAKEN',{tags:['water','wind'],scale:0.95}) }),
  'EQP-A-0006': Object.freeze({ drawback: rule('world','INSPECTION_RISK',{regions:['王都','北陵'],risk:'suspicion'}) }),
  'EQP-A-0008': Object.freeze({ drawback: rule('battle','TAG_DAMAGE_TAKEN',{tags:['ice','water'],scale:1.05}) }),
  'EQP-A-0009': Object.freeze({ passive: rule('battle','WEATHER_ORDER_IMMUNITY',{weathers:['cold','snow']}) }),
  'EQP-A-0010': Object.freeze({ passive: rule('battle','START_STAGE',{stat:'defense',stage:1,durationTurns:1}) }),
  'EQP-A-0012': Object.freeze({ passive: rule('battle','START_BARRIER',{maxHpRatio:0.08}) }),
  'EQP-A-0016': Object.freeze({ passive: rule('battle','POISON_DOT_SCALE',{scale:0.80}) }),
  'EQP-A-0017': Object.freeze({ passive: rule('battle','START_LUCK_DAY_EVADE',{luckStage:1,luckTurns:3,evadeStage:1,evadeTurns:2}) }),
  'EQP-A-0018': Object.freeze({ passive: rule('battle','AFTER_HEAL_SUBSTITUTE_DEFENSE',{stage:1,durationTurns:1}) }),
  'EQP-A-0019': Object.freeze({ drawback: rule('static','CONDITIONAL_DURABILITY_PROFILE',{condition:'durability_system_active'}) }),
  'EQP-X-0002': Object.freeze({ passive: rule('battle','ONCE_HEAL_SUBSTITUTE_SCALE',{scale:1.20,uses:1}) }),
  'EQP-X-0003': Object.freeze({ passive: rule('world','BATTLE_WIN_GOLD',{scale:1.05,cap:20}) }),
  'EQP-X-0004': Object.freeze({ passive: rule('battle','LOW_LUCK_DAMAGE',{maxScale:1.15}), drawback: rule('world','REST_GOLD_DRAIN',{amount:1,saleBlocked:true}) }),
  'EQP-X-0006': Object.freeze({ passive: rule('battle','SURVIVE_LETHAL',{charges:1,excludeSelfSacrifice:true}) }),
  'EQP-X-0007': Object.freeze({ passive: rule('battle','COOLDOWN_PROC',{minimumCooldown:3,chance:0.10,reduction:1}) }),
  'EQP-X-0008': Object.freeze({ passive: rule('battle','LOW_HP_STAGE_ONCE',{hpRatio:0.25,stat:'debuffResistance',stage:1,durationTurns:3}) }),
  'EQP-X-0010': Object.freeze({ drawback: rule('battle','SKILL_MP_SURCHARGE',{skillId:'SKL-1139',amount:4}) }),
  'EQP-X-0011': Object.freeze({ passive: rule('battle','START_ENEMY_COUNT_STAGE',{enemyCount:3,stats:['physicalPower','magicPower'],stage:1,durationTurns:2}), drawback: rule('static','CONDITION_LIMIT',{condition:'enemyCount>=3'}) }),
  'EQP-W-0066': Object.freeze({ drawback: rule('world','INSPECTION_RISK',{regions:['王都'],risk:'forbidden_weapon'}) }),
  'EQP-W-0068': Object.freeze({ passive: rule('battle','CONSTRUCT_BARRIER_BREAK',{ratio:0.15,uses:1}) }),
  'EQP-W-0072': Object.freeze({ passive: rule('battle','DAY_HEAL_FIXED',{amount:3}) }),
  'EQP-S-0010': Object.freeze({ passive: rule('battle','GUARD_COUNTER_FIXED',{chance:0.20,damage:4}), drawback: rule('world','INSPECTION_RISK',{regions:['王都'],risk:'suspected_stolen'}) }),
  'EQP-W-0201': Object.freeze({ drawback: rule('static','STAT_PROFILE',{basis:['physicalPower'],comparison:'two_hand_axe'}) }),
  'EQP-W-0202': Object.freeze({ drawback: rule('battle','CLOSE_RANGE_DISABLED',{context:'melee_engaged'}) }),
  'EQP-W-0203': Object.freeze({ drawback: rule('static','STAT_PROFILE',{basis:['physicalPower','accuracy'],note:'untempered_tip'}) }),
  'EQP-A-0201': Object.freeze({ drawback: rule('world','WEATHER_VULNERABILITY',{weather:'rain'}) }),
  'EQP-W-0204': Object.freeze({ drawback: rule('static','STAT_PROFILE',{basis:['physicalPower'],note:'light_hit'}) }),
  'EQP-A-0202': Object.freeze({ passive: rule('world','WEATHER_FATIGUE_REDUCTION',{weathers:['cold','rain'],scale:0.80}) }),
  'EQP-X-0202': Object.freeze({ passive: rule('static','STAT_PROFILE',{basis:['debuffResistance'],targetTag:'beast'}) }),
  'EQP-W-0205': Object.freeze({ drawback: rule('static','STAT_PROFILE',{basis:['physicalPower','accuracy'],note:'chipped_blade'}) }),
  'EQP-W-0206': Object.freeze({ drawback: rule('static','STAT_PROFILE',{basis:['magicPower','accuracy'],note:'loose_binding'}) }),
  'EQP-W-0207': Object.freeze({ drawback: rule('static','STAT_PROFILE',{basis:['accuracy'],condition:'wet'}) }),
  'EQP-A-0203': Object.freeze({ passive: rule('world','WORK_FATIGUE_REDUCTION',{workTag:'hauling',scale:0.80}) }),
  'EQP-W-0209': Object.freeze({ drawback: rule('static','STAT_PROFILE',{basis:['agility'],note:'restring_delay'}) }),
  'EQP-S-0202': Object.freeze({ passive: rule('world','HAZARD_DAMAGE_REDUCTION',{hazards:['rockfall','collapse'],scale:0.80}) }),
  'EQP-W-0212': Object.freeze({ drawback: rule('static','STAT_PROFILE',{basis:['accuracy'],note:'deep_rust_noise'}) }),
  'EQP-W-0213': Object.freeze({ drawback: rule('static','HANDEDNESS',{grip:'twoHand'}) }),
  'EQP-W-0301': Object.freeze({ passive: rule('static','SHIELD_COMPATIBILITY',{grip:'oneHand',contexts:['ship','narrow']}), drawback: rule('static','STAT_PROFILE',{basis:['physicalPower'],comparison:'two_hand_axe'}) }),
  'EQP-W-0302': Object.freeze({ drawback: rule('static','STAT_PROFILE',{basis:['agility'],comparison:'light_axe'}) }),
  'EQP-W-0303': Object.freeze({ drawback: rule('world','INSPECTION_RISK',{regions:['王国圏'],risk:'conspicuous_design'}) }),
});

const stableUnit = (text) => {
  let hash = 0x811c9dc5;
  for (const character of String(text)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0) / 4294967296;
};
const live = (actors) => (actors ?? []).filter((actor) => actor?.alive && Number(actor.hp ?? 0) > 0 && !actor.escaped);
const weatherType = (session) => session?.playerRuntimeMechanics?.weather?.type ?? session?.state?.world?.weather?.id ?? session?.state?.world?.weatherId ?? null;
const actorById = (session, id) => [...(session?.state?.players ?? []), ...(session?.state?.enemies ?? [])].find((actor) => actor.instanceId === id) ?? null;

export function equipmentRuntimeRulesFor(equipmentIds) {
  return (equipmentIds ?? []).flatMap((equipmentId) => Object.entries(EQUIPMENT_RUNTIME_RULES[equipmentId] ?? {}).map(([field, semantic]) => ({ equipmentId, field, ...semantic })));
}

function addStage(actor, stat, stage, durationTurns) {
  if (!actor?.modifiers) return;
  const current = actor.modifiers.get(stat);
  actor.modifiers.set(stat, { stage: Math.max(-6, Math.min(6, Number(current?.stage ?? 0) + Number(stage))), duration: Math.max(Number(current?.duration ?? 0), Number(durationTurns ?? 1)) });
}

function addBarrier(actor, ratio) {
  const capacity = Math.max(1, Math.round(actor.maxHp * ratio));
  actor.specialStates.set('barrier', { type:'barrier', stateId:'barrier', duration:99, capacity, params:{ capacityMode:'fixed', capacity } });
  return capacity;
}

function ensureRuntime(runtime) {
  runtime.equipmentSemantics ??= { version:1, rules:[], events:[], counters:{}, meleeEngaged:false };
  runtime.equipmentSemantics.rules ??= [];
  runtime.equipmentSemantics.events ??= [];
  runtime.equipmentSemantics.counters ??= {};
  return runtime.equipmentSemantics;
}

function event(runtime, turn, semantic, detail={}) {
  const entry = { type:'equipment_runtime', equipmentId:semantic.equipmentId, field:semantic.field, semantic:semantic.type, turn, ...detail };
  runtime.events.push(entry); return entry;
}

export function initializeEquipmentBattleRuntime({ data, session }) {
  const actor = session.state?.players?.[0];
  const runtime = ensureRuntime(session.playerRuntimeMechanics);
  runtime.rules = equipmentRuntimeRulesFor(actor?.equipmentIds ?? []);
  const turn = Number(session.state?.turn ?? 0);
  for (const semantic of runtime.rules) {
    if (semantic.type === 'START_STAGE') { addStage(actor, semantic.stat, semantic.stage, semantic.durationTurns); event(runtime,turn,semantic,{stat:semantic.stat,stage:semantic.stage}); }
    if (semantic.type === 'START_BARRIER') event(runtime,turn,semantic,{capacity:addBarrier(actor,semantic.maxHpRatio)});
    if (semantic.type === 'START_LUCK_DAY_EVADE') { addStage(actor,'luck',semantic.luckStage,semantic.luckTurns); if (session.state?.world?.daypart === 'day') addStage(actor,'evasion',semantic.evadeStage,semantic.evadeTurns); event(runtime,turn,semantic,{luckStage:semantic.luckStage}); }
    if (semantic.type === 'SURVIVE_LETHAL') { actor.specialStates.set(`equipment_survive:${semantic.equipmentId}`, { type:'surviveFatal', stateId:'survive_lethal', duration:99, charges:semantic.charges, equipmentId:semantic.equipmentId, excludeSelfSacrifice:true }); event(runtime,turn,semantic,{charges:semantic.charges}); }
    if (semantic.type === 'START_ENEMY_COUNT_STAGE' && live(session.state.enemies).length >= semantic.enemyCount) { for (const stat of semantic.stats) addStage(actor,stat,semantic.stage,semantic.durationTurns); event(runtime,turn,semantic,{enemyCount:live(session.state.enemies).length,stats:semantic.stats}); }
    if (semantic.type === 'ZERO_GOLD_POWER_STAGE' && Number(session.playerRuntimeMechanics?.gold ?? 0) === 0) { addStage(actor,'physicalPower',semantic.stage,99); addStage(actor,'magicPower',semantic.stage,99); event(runtime,turn,semantic,{stage:semantic.stage}); }
  }
  return runtime;
}

function lowLuckScale(actor, maxScale) {
  const luck = Number(actor?.luck ?? 0);
  if (luck >= 10) return 1;
  return 1 + (Number(maxScale)-1) * Math.max(0, Math.min(1, (10-luck)/10));
}

export function prepareEquipmentSkill({ skill, session }) {
  const actor = session.state?.players?.[0];
  const runtime = ensureRuntime(session.playerRuntimeMechanics);
  let next = skill;
  let damageScale = 1;
  let mpSurcharge = 0;
  for (const semantic of runtime.rules) {
    if (semantic.type === 'CLOSE_RANGE_DISABLED' && runtime.meleeEngaged) return { skill:next, blockedReason:'equipment_disabled', metadata:{ equipmentSemantic:semantic.type } };
    if (semantic.type === 'SKILL_MP_SURCHARGE' && skill.id === semantic.skillId) mpSurcharge += semantic.amount;
    if (semantic.type === 'LOW_LUCK_DAMAGE') damageScale *= lowLuckScale(actor,semantic.maxScale);
    if (semantic.type === 'LOW_LUCK_PHYSICAL_DAMAGE' && !/魔法|魔導|炎|氷|雷|風|光|闇|水|土|精神/u.test(skill.category ?? '')) damageScale *= lowLuckScale(actor,semantic.maxScale);
    if (semantic.type === 'TARGET_GUARD_DAMAGE') {
      const target = live(session.state.enemies)[0];
      if (target?.specialStates?.has('guard')) damageScale *= semantic.scale;
    }
    if (semantic.type === 'TAG_MAGIC_DAMAGE' && /魔法|魔導|炎|氷|雷|風|光|闇|水|土|精神/u.test(skill.category ?? '')) {
      const tags = new Set([...(session.state?.fieldTags ?? []), weatherType(session)].filter(Boolean));
      if (semantic.tags.some((tag)=>tags.has(tag))) damageScale *= semantic.scale;
    }
  }
  if (damageScale !== 1 && Number(next.damage?.totalMultiplier ?? 0) > 0) {
    const hits = Math.max(1,Number(next.damage.hits ?? 1));
    const total = Number(next.damage.totalMultiplier)*damageScale;
    next = { ...next, damage:{...next.damage,totalMultiplier:total,perHitMultiplier:total/hits} };
  }
  if (mpSurcharge) next = { ...next, costs:{...next.costs,mp:Number(next.costs?.mp ?? 0)+mpSurcharge} };
  return { skill:next, blockedReason:null, metadata:{ equipmentDamageScale:damageScale, mpSurcharge } };
}

function ensureEffect(frame, actor, beforeHp, beforeMp) {
  let effect=(frame.effects??[]).find((entry)=>entry.targetInstanceId===actor.instanceId);
  if (!effect) { effect={targetInstanceId:actor.instanceId,hpBefore:beforeHp,hpAfter:actor.hp,mpBefore:beforeMp,mpAfter:actor.mp,aliveBefore:true,aliveAfter:actor.alive}; frame.effects=[...(frame.effects??[]),effect]; }
  return effect;
}

function restoreDamage(session, frame, effect, amount) {
  const actor=actorById(session,effect.targetInstanceId); if(!actor||!(amount>0)) return 0;
  const restored=Math.min(amount,Math.max(0,Number(effect.hpBefore)-Number(actor.hp)));
  actor.hp=Math.min(actor.maxHp,actor.hp+restored); actor.alive=actor.hp>0;
  effect.hpAfter=Math.min(Number(effect.hpBefore),Number(effect.hpAfter)+restored); effect.aliveAfter=actor.alive;
  frame.damage=Math.max(0,Number(frame.damage??0)-restored); return restored;
}

function dealFixed(session, frame, target, amount) {
  if(!target?.alive||!(amount>0)) return 0; const before=target.hp; const dealt=Math.min(before,Math.round(amount));
  target.hp=Math.max(0,before-dealt); target.alive=target.hp>0; target.damageTaken=Number(target.damageTaken??0)+dealt;
  const effect=ensureEffect(frame,target,before,target.mp); effect.hpAfter=target.hp; effect.aliveAfter=target.alive; return dealt;
}

export function applyEquipmentRoundRuntime({ data, session, round }) {
  const runtime=ensureRuntime(session.playerRuntimeMechanics); const player=session.state.players[0]; const turn=Number(session.state.turn??0); const weather=weatherType(session);
  for (const frame of round?.frames ?? []) {
    if (frame.actorSide==='enemy' && frame.phase==='action') {
      const effect=(frame.effects??[]).find((entry)=>entry.targetInstanceId===player.instanceId && Number(entry.hpBefore)>Number(entry.hpAfter));
      if(effect){
        const incoming=Number(effect.hpBefore)-Number(effect.hpAfter); runtime.meleeEngaged=true;
        for(const semantic of runtime.rules){
          if(semantic.type==='DAMAGE_TAKEN' && semantic.scale>1){ const extra=Math.max(0,Math.round(incoming*(semantic.scale-1))); if(extra){ const before=player.hp; player.hp=Math.max(0,player.hp-extra); player.alive=player.hp>0; effect.hpAfter=player.hp; frame.damage=Number(frame.damage??0)+extra; event(runtime,turn,semantic,{extraDamage:before-player.hp}); } }
          if(semantic.type==='TAG_DAMAGE_TAKEN' && semantic.tags.includes(weather)){ const delta=incoming*(1-semantic.scale); if(delta>0) event(runtime,turn,semantic,{reducedDamage:restoreDamage(session,frame,effect,delta)}); else if(delta<0){const extra=Math.round(-delta);player.hp=Math.max(0,player.hp-extra);effect.hpAfter=player.hp;frame.damage+=extra;event(runtime,turn,semantic,{extraDamage:extra});} }
          if(semantic.type==='GUARD_COUNTER_FIXED' && player.specialStates?.has('guard') && stableUnit(`${session.seed}:${turn}:${frame.seq}:${semantic.equipmentId}`)<semantic.chance){ const enemy=actorById(session,frame.actorInstanceId); event(runtime,turn,semantic,{damage:dealFixed(session,frame,enemy,semantic.damage),targetInstanceId:enemy?.instanceId}); }
        }
      }
    }
    if(frame.actorSide==='player' && frame.phase==='action'){
      const skillId=frame.action?.skillId;
      for(const semantic of runtime.rules){
        if(semantic.type==='HIT_SELF_STAGE' && Number(frame.hits)>0 && stableUnit(`${session.seed}:${turn}:${frame.seq}:${semantic.equipmentId}`)<semantic.chance){addStage(player,semantic.stat,semantic.stage,99);event(runtime,turn,semantic,{stat:semantic.stat,stage:semantic.stage});}
        if(semantic.type==='AFTER_SKILL_STAGE' && skillId===semantic.skillId){addStage(player,semantic.stat,semantic.stage,semantic.durationTurns);event(runtime,turn,semantic,{stat:semantic.stat,stage:semantic.stage});}
        if(semantic.type==='COOLDOWN_PROC' && skillId){const cd=player.cooldowns.get(skillId);if(Number(cd)>=semantic.minimumCooldown&&stableUnit(`${session.seed}:${turn}:${frame.seq}:${semantic.equipmentId}`)<semantic.chance){player.cooldowns.set(skillId,Math.max(0,Number(cd)-semantic.reduction));event(runtime,turn,semantic,{skillId,cooldownAfter:player.cooldowns.get(skillId)});}}
        if(semantic.type==='DAY_HEAL_FIXED' && skillId && session.state?.world?.daypart==='day' && (frame.effects??[]).some((entry)=>Number(entry.hpAfter)>Number(entry.hpBefore))){const before=player.hp;player.hp=Math.min(player.maxHp,player.hp+semantic.amount);event(runtime,turn,semantic,{healed:player.hp-before});}
        if(semantic.type==='DEBUFF_DURATION_PROC' && skillId && stableUnit(`${session.seed}:${turn}:${frame.seq}:${semantic.equipmentId}`)<semantic.chance){const target=actorById(session,frame.primaryTargetInstanceId);const changed=[];for(const id of semantic.debuffs){const debuff=target?.debuffs?.get(id);if(debuff){debuff.duration=Number(debuff.duration??1)+semantic.turns;changed.push(id);}}if(changed.length)event(runtime,turn,semantic,{debuffIds:changed});}
        if(semantic.type==='CONSTRUCT_BARRIER_BREAK' && skillId && Number(frame.hits)>0 && !runtime.counters[`${semantic.equipmentId}:used`]){const target=actorById(session,frame.primaryTargetInstanceId);const tags=target?.tags instanceof Set?target.tags:new Set(target?.tags??[]);const barrier=target?.specialStates?.get('barrier');if(tags.has('construct')&&barrier){const before=Number(barrier.capacity??0);barrier.capacity=Math.max(0,before-before*semantic.ratio);runtime.counters[`${semantic.equipmentId}:used`]=1;event(runtime,turn,semantic,{capacityBefore:before,capacityAfter:barrier.capacity});}}
      }
    }
    if(frame.phase==='round_end'){
      for(const semantic of runtime.rules){
        if(semantic.type==='FIELD_MP_REGEN' && session.state?.fieldTags?.has(semantic.tag)){const before=player.mp;player.mp=Math.min(player.maxMp,player.mp+semantic.amount);event(runtime,turn,semantic,{restoredMp:player.mp-before});}
        if(semantic.type==='POISON_DOT_SCALE' && player.debuffs?.has('poison')){const effect=(frame.effects??[]).find((entry)=>entry.targetInstanceId===player.instanceId&&Number(entry.hpBefore)>Number(entry.hpAfter));if(effect){const incoming=Number(effect.hpBefore)-Number(effect.hpAfter);event(runtime,turn,semantic,{reducedDamage:restoreDamage(session,frame,effect,incoming*(1-semantic.scale))});}}
        if(semantic.type==='LOW_HP_STAGE_ONCE' && player.hp/player.maxHp<=semantic.hpRatio&&!runtime.counters[`${semantic.equipmentId}:used`]){addStage(player,semantic.stat,semantic.stage,semantic.durationTurns);runtime.counters[`${semantic.equipmentId}:used`]=1;event(runtime,turn,semantic,{stat:semantic.stat,stage:semantic.stage});}
      }
    }
  }
  return runtime.events;
}

function ownedIds(state){return new Set([...Object.keys(state?.player?.inventory?.equipment??{}).filter((id)=>Number(state.player.inventory.equipment[id])>0),...Object.values(state?.player?.equipment??{}).filter(Boolean)]);}
export function deriveEquipmentWorldRuntime(state,data){
  const ids=ownedIds(state);const rules=equipmentRuntimeRulesFor([...ids]);
  return {version:1,saleBlockedIds:[...new Set(rules.filter((r)=>r.saleBlocked).map((r)=>r.equipmentId))],inspectionRisks:rules.filter((r)=>r.type==='INSPECTION_RISK'||r.type==='CONFISCATION_AND_NORMAL_DELAY').map((r)=>({equipmentId:r.equipmentId,risk:r.risk,regions:r.regions??[]})),restGoldDrain:rules.filter((r)=>r.type==='REST_GOLD_DRAIN').reduce((sum,r)=>sum+Number(r.amount??0),0),weatherFatigueScale:rules.filter((r)=>r.type==='WEATHER_FATIGUE_REDUCTION'),workFatigueScale:rules.filter((r)=>r.type==='WORK_FATIGUE_REDUCTION'),hazardReductions:rules.filter((r)=>r.type==='HAZARD_DAMAGE_REDUCTION'),weatherVulnerabilities:rules.filter((r)=>r.type==='WEATHER_VULNERABILITY'),battleWinGold:rules.filter((r)=>r.type==='BATTLE_WIN_GOLD')};
}
export function syncEquipmentWorldRuntime(state,data){const runtime=deriveEquipmentWorldRuntime(state,data);state.player.equipmentWorldRuntime=runtime;return runtime;}
export function applyEquipmentWorldActionEffects({state,data,action,fatigueBefore=null}){
  const runtime=syncEquipmentWorldRuntime(state,data);const events=[];
  if(action?.type==='rest'&&runtime.restGoldDrain>0&&state.player.gold>0){const amount=Math.min(state.player.gold,runtime.restGoldDrain);state.player.gold-=amount;events.push({type:'EQUIPMENT_REST_GOLD_DRAIN',amount});}
  const weather=state.weather?.id??state.weather?.weatherId??state.weather?.tags?.[0]??null;
  if(fatigueBefore!==null&&Number(state.player.needs?.fatigue)>Number(fatigueBefore)){
    const delta=Number(state.player.needs.fatigue)-Number(fatigueBefore);let scale=1;
    for(const r of runtime.weatherFatigueScale)if(r.weathers.includes(weather))scale=Math.min(scale,r.scale);
    if(action?.type==='work'&&/haul|荷|運/u.test(String(action.id??action.label??'')))for(const r of runtime.workFatigueScale)scale=Math.min(scale,r.scale);
    if(scale<1){const reduced=delta*(1-scale);state.player.needs.fatigue=Math.max(0,state.player.needs.fatigue-reduced);events.push({type:'EQUIPMENT_FATIGUE_REDUCTION',reduced});}
  }
  if(events.length){state.history??=[];for(const e of events)state.history.push({...e,minute:state.absoluteMinute});}
  return events;
}
export function applyEquipmentBattleVictoryGold({state,data,goldBeforeSettlement}){
  const runtime=syncEquipmentWorldRuntime(state,data);const gain=Math.max(0,Number(state.player.gold)-Number(goldBeforeSettlement));if(!gain||!runtime.battleWinGold.length)return 0;
  let bonus=0;for(const r of runtime.battleWinGold)bonus+=Math.min(Number(r.cap??20),Math.floor(gain*(Number(r.scale??1)-1)));
  if(bonus>0){state.player.gold+=bonus;state.history.push({type:'EQUIPMENT_BATTLE_WIN_GOLD',minute:state.absoluteMinute,baseGain:gain,bonus});}return bonus;
}

export function equipmentSemanticFor(equipmentId,field){return EQUIPMENT_RUNTIME_RULES[equipmentId]?.[field]??null;}
