import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import { beginInteractiveBattle, listInteractiveBattleCommands, resolveInteractiveBattleRound } from '../lib/battle-simulator.mjs';

const data=await loadBattleData();
function build(skillIds,equipmentIds=['EQP-W-0001']){return createPlayerBuild(data,{id:`reason-${skillIds.join('-')}`,name:'C reason witness',level:50,equipmentIds,skillIds,baseStats:{maxHp:10000,maxMp:500,attack:20,defense:500,agility:500,luck:10,physicalPower:20,magicPower:20,magicResistance:500,accuracy:500,evasion:0,critical:0,debuffSuccess:100,debuffResistance:100}});}
function begin(skillIds,equipmentIds=['EQP-W-0001'],extra={}){return beginInteractiveBattle({data,seed:`reason:${skillIds.join(':')}`,monsterIds:['MON-0005'],playerBuild:build(skillIds,equipmentIds),maxTurns:8,...extra});}
function skillCommand(session,id){return listInteractiveBattleCommands({data,session}).find((entry)=>entry.skillId===id);}
function expectReason(session,id,reason){const command=skillCommand(session,id);assert.ok(command,`${id}: command`);assert.equal(command.available,false,`${id}: must be unavailable`);assert.equal(command.disabledReason,reason,`${id}: disabledReason`);assert.equal(command.reasonCode,reason,`${id}: reasonCode`);}
function equipmentLeaves(skill){return (skill.activationConditions??[]).filter((condition)=>condition?.scope==='equipment'&&condition?.path==='activeWeaponTypes');}

test('Checkpoint C battle API exposes concrete player unavailability reasons',()=>{
  let session=begin(['SKL-1140'],['EQP-W-0073']);session.state.players[0].mp=0;expectReason(session,'SKL-1140','insufficient_mp');

  const hpSkill=data.playerSkills.find((skill)=>skill.kind==='active'&&skill.costs?.hpMode==='fixed'&&Number(skill.costs?.hp)>0&&equipmentLeaves(skill).length===0&&(skill.activationConditions??[]).length===0);
  assert.ok(hpSkill,'canonical fixed-HP active skill required');session=begin([hpSkill.id]);session.state.players[0].hp=Number(hpSkill.costs.hp);expectReason(session,hpSkill.id,'insufficient_hp');

  session=begin(['SKL-0021'],['EQP-W-0009']);expectReason(session,'SKL-0021','wrong_weapon');

  const shieldSkill=data.playerSkills.find((skill)=>skill.kind==='active'&&equipmentLeaves(skill).some((condition)=>(Array.isArray(condition.value)?condition.value:[condition.value]).includes('shield')));
  assert.ok(shieldSkill,'canonical active shield-gated skill required');session=begin([shieldSkill.id],['EQP-W-0001']);expectReason(session,shieldSkill.id,'shield_required');

  session=begin(['SKL-0001']);session.state.players[0].cooldowns.set('SKL-0001',2);expectReason(session,'SKL-0001','cooldown');

  session=begin(['SKL-0047'],['EQP-W-0013']);session.state.players[0].uses.set('SKL-0047',Number(data.playerSkillById.get('SKL-0047').cooldown.usesPerBattle));session.state.players[0].cooldowns.delete('SKL-0047');expectReason(session,'SKL-0047','use_limit');

  session=begin(['SKL-0665'],['EQP-W-0009']);session.state.players[0].specialStates.set('seal',{duration:3,params:{blockedTags:['magic']}});expectReason(session,'SKL-0665','sealed');

  session=begin(['SKL-1108'],['EQP-W-0009']);expectReason(session,'SKL-1108','field_required');
  session=begin(['SKL-1141'],['EQP-W-0001'],{playerGold:0});expectReason(session,'SKL-1141','insufficient_gold');
  session=begin(['SKL-1139'],['EQP-W-0001']);expectReason(session,'SKL-1139','missing_history');

  session=begin(['SKL-0021'],['EQP-W-0001']);session.playerRuntimeMechanics.equipmentRuntime.disabledEquipmentIds=['EQP-W-0001'];expectReason(session,'SKL-0021','equipment_disabled');
});

test('Checkpoint C distinguishes invalid_target from no_target',()=>{
  let session=begin(['SKL-0001']);const command=skillCommand(session,'SKL-0001');assert.ok(command?.available);const invalid=resolveInteractiveBattleRound({data,session,command:{actionId:command.actionId,targetInstanceId:'missing-target#999'}});assert.equal(invalid.ok,false);assert.equal(invalid.reason,'invalid_target');
  session=begin(['SKL-0001']);for(const enemy of session.state.enemies){enemy.hp=0;enemy.alive=false;}const commands=listInteractiveBattleCommands({data,session});assert.equal(commands.length,1);assert.equal(commands[0].available,false);assert.equal(commands[0].disabledReason,'no_target');assert.equal(commands[0].reasonCode,'no_target');
});
