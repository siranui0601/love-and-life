import {initializeCausality} from './causal-events.js';
import {initializeRelationships} from './relationships.js';
// Calendar seconds, local seconds and combat seconds are distinct domains.
export const WORLD_SCHEMA_VERSION = 2;
export const ACTIVITY_POLICY = Object.freeze({
  idle:'continuous', walking:'continuous', running:'continuous',
  inspecting:'paused', conversation:'paused', menu:'paused', combat:'combat',
  working:'macro', crafting:'macro', training:'macro', sleeping:'macro',
  travelling:'macro', eating:'macro', collapsed:'macro', recovering:'macro',
});
export function setActivity(state, kind, details={}) {
  if (!Object.hasOwn(ACTIVITY_POLICY,kind)) throw new Error('Unknown player activity');
  state.player.activity={kind,location:{region:state.player.region,position:[...state.player.position]},
    startedAt:state.time,expectedEndAt:null,interruptibility:true,worldTimePolicy:ACTIVITY_POLICY[kind],...details};
  if (!['idle','walking','running','combat'].includes(kind)) {
    state.input={x:0,z:0,ascend:0,sprint:false,heading:state.player.heading};
    state.player.guarding=false;
  }
  return state.player.activity;
}
export function playerIsLocal(state) { return state.player.activity?.kind!=='travelling'; }
export function canMove(state) { return ['idle','walking','running','combat'].includes(state.player.activity?.kind); }
export function migrateWorld(state, content) {
  if (![1,2].includes(state.schemaVersion)) throw new Error('Unsupported world schema');
  initializeRelationships(state);initializeCausality(state,content);
  if (state.schemaVersion===2) return state;
  const scale=content.time?.scale||60, toCombat=value=>Number.isFinite(value)?(value-state.time)/scale:value;
  state.localSimulationTime=0;state.combatTime=0;
  for (const unit of [state.player,...Object.values(state.monsters||{})]) {
    for (const key of ['lastAttack','lastThreat','dodgeUntil','staggerUntil','fleeUntil','expiresAt'])
      if (unit[key]!==undefined) unit[key]=toCombat(unit[key]);
    for (const key of Object.keys(unit.cooldowns||{})) unit.cooldowns[key]=toCombat(unit.cooldowns[key]);
    if (unit.intent) unit.intent.resolvesAt=toCombat(unit.intent.resolvesAt);
    for (const kind of ['modifiers','debuffs','specialStates'])
      for (const effect of Object.values(unit[kind]||{})) effect.expiresAt=toCombat(effect.expiresAt);
  }
  for (const field of Object.values(state.fields||{})) field.expiresAt=toCombat(field.expiresAt);
  // Never infer a rescue or relationship from old numeric fields.
  state.legacySnapshot={schemaVersion:1,injuredUntil:state.player.injuredUntil??null};
  state.player.hunger??=20;state.player.fatigue??=0;delete state.player.travelling;delete state.player.injuredUntil;
  setActivity(state,'idle');state.schemaVersion=WORLD_SCHEMA_VERSION;
  return state;
}
