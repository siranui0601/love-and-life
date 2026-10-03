import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import { beginInteractiveBattle, listInteractiveBattleCommands, resolveInteractiveBattleRound } from '../lib/battle-simulator.mjs';
import { auditEquipmentCheckpointC, CHECKPOINT_C_EQUIPMENT_COUNT, CHECKPOINT_C_STOCK_COUNT } from '../lib/player-equipment-checkpoint-c.mjs';
import { syncEquipmentWorldRuntime } from '../lib/player-equipment-runtime.mjs';
import { createInitialJourneyState, resolvePlayerAction } from '../lib/player-journey.mjs';
import { loadSkills } from '../lib/fixtures.mjs';
import { loadPlayerSimulationConfig } from '../lib/player-suite.mjs';
import { loadWorldModel } from '../lib/world-model.mjs';

const data=await loadBattleData();const skills=loadSkills();const model=loadWorldModel();const config=loadPlayerSimulationConfig();
function build(equipmentIds,skillIds=[]){return createPlayerBuild(data,{id:`equipment-C-${equipmentIds.join('-')}`,name:'Checkpoint C equipment',level:20,equipmentIds,skillIds,baseStats:{maxHp:10000,maxMp:500,attack:20,defense:100,agility:100,accuracy:100,physicalPower:20,magicPower:20,magicResistance:100}});}

test('Checkpoint C equipment 142 / stock 149 have legal shape, world acquisition and no text-only semantics',()=>{
  const audit=auditEquipmentCheckpointC(data);assert.equal(audit.equipmentCount,CHECKPOINT_C_EQUIPMENT_COUNT);assert.equal(audit.stockCount,CHECKPOINT_C_STOCK_COUNT);assert.deepEqual(audit.invalidEquipment,[]);assert.deepEqual(audit.inventoryInvalidEquipmentIds,[]);assert.equal(audit.worldReachableCount,CHECKPOINT_C_EQUIPMENT_COUNT);assert.equal(audit.runtimeSemanticCount,62);console.log(`PLAYER_EQUIPMENT_C_TEXT_GAPS ${JSON.stringify(audit.unmodeledText)}`);assert.deepEqual(audit.unmodeledText,[],'passive/drawback text without an authoritative runtime representation must be implemented');
});

test('Checkpoint C rejects a two-handed main hand plus any off-hand',()=>{
  const twoHand=data.equipment.find((equipment)=>equipment.slot==='mainHand'&&equipment.grip==='twoHand');const offHand=data.equipment.find((equipment)=>equipment.slot==='offHand');assert.ok(twoHand&&offHand);assert.throws(()=>createPlayerBuild(data,{level:20,equipmentIds:[twoHand.id,offHand.id],skillIds:[]}),(error)=>error?.code==='TWO_HAND_WITH_OFF_HAND');
});

test('Checkpoint C equipment start barrier mutates authoritative battle state',()=>{
  const session=beginInteractiveBattle({data,seed:'equipment-start-barrier',monsterIds:['MON-0005'],playerBuild:build(['EQP-W-0001','EQP-A-0012']),maxTurns:4});const actor=session.state.players[0];const barrier=actor.specialStates.get('barrier');assert.ok(barrier);assert.equal(barrier.capacity,Math.round(actor.maxHp*0.08));assert.ok(session.playerRuntimeMechanics.equipmentSemantics.events.some((event)=>event.equipmentId==='EQP-A-0012'&&event.semantic==='START_BARRIER'&&event.capacity===barrier.capacity));
});

test('Checkpoint C equipment drawback adds real Encore MP cost after repeat history exists',()=>{
  let session=beginInteractiveBattle({data,seed:'equipment-encore-cost',monsterIds:['MON-0005'],playerBuild:build(['EQP-W-0001','EQP-X-0010'],['SKL-0001','SKL-1139']),maxTurns:6});const slash=listInteractiveBattleCommands({data,session}).find((command)=>command.skillId==='SKL-0001'&&command.available);assert.ok(slash);const first=resolveInteractiveBattleRound({data,session,command:{actionId:slash.actionId,targetInstanceId:slash.targets[0]?.instanceId}});assert.equal(first.ok,true);session=first.session;const encore=listInteractiveBattleCommands({data,session}).find((command)=>command.skillId==='SKL-1139'&&command.available);assert.ok(encore);assert.equal(encore.mpCost,Number(data.playerSkillById.get('SKL-1139').costs.mp??0)+4);
});

test('Checkpoint C equipment world semantics mutate Gold and expose inspection risk',()=>{
  const state=createInitialJourneyState({model,battleData:data,skills,profile:'balanced',tuning:{...config.tuned,manualSkillSelection:true},seed:'equipment-world-C'});state.player.gold=10;state.player.inventory.equipment['EQP-X-0004']=1;state.player.equipment.accessory='EQP-X-0004';const before=state.player.gold;const output=resolvePlayerAction(state,model,data,skills,state.catalog,'balanced',{id:'C:REST:EQUIPMENT',type:'rest',minutes:30,lodging:false});assert.equal(output.ok,true);assert.equal(state.player.gold,before-1,'rest drawback must spend actual journey Gold');assert.ok(state.history.some((entry)=>entry.type==='EQUIPMENT_REST_GOLD_DRAIN'&&entry.amount===1));
  state.player.inventory.equipment['EQP-W-0025']=1;state.player.equipment.mainHand='EQP-W-0025';const runtime=syncEquipmentWorldRuntime(state,data);assert.ok(runtime.saleBlockedIds.includes('EQP-W-0025'));assert.ok(runtime.inspectionRisks.some((entry)=>entry.equipmentId==='EQP-W-0025'&&entry.regions.includes('王都')));
});
