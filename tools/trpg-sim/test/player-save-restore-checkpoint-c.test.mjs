import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameRuntime } from '../../../src/server/trpg/game/service.js';
import { loadTrpgGameData } from '../../../src/server/trpg/game/game-data.js';
import { deserializeRuntime, serializeRuntime } from '../../../src/server/trpg/game/serializer.js';
import { createPlayerBuild } from '../lib/battle-model.mjs';
import { beginInteractiveBattle, listInteractiveBattleCommands, resolveInteractiveBattleRound } from '../lib/battle-simulator.mjs';
import { eventGrantProducerManifest } from '../lib/player-skill-acquisition-checkpoint-c.mjs';
import { grantEventSkillFromProducer, listPlayerSkillStates } from '../lib/player-journey.mjs';

const data = loadTrpgGameData();
const skills = data.skills;

function firstEquipmentGrant() {
  const item = data.battleData.equipment.find((equipment) => equipment.grantedSkillId && ['body','accessory'].includes(equipment.slot))
    ?? data.battleData.equipment.find((equipment) => equipment.grantedSkillId);
  assert.ok(item, 'canonical equipment grant witness required');
  return item;
}

test('Checkpoint C production serializer round-trips progression, grants and pending battle runtime without leakage', () => {
  const runtime = createGameRuntime(data, { seed:'checkpoint-c-save', profileId:'balanced', playerName:'C-save', tutorial:false });
  const state = runtime.playerState;
  state.tuning.manualSkillSelection = true;
  state.player.sp = 13;
  state.player.gold = 777;
  state.player.skills.add('SKL-0001');
  state.progress.combat.physicalKills = 17;
  state.progress.weapon.axe.kills = 12;

  const eventEntry = eventGrantProducerManifest(skills)[0];
  assert.ok(eventEntry?.producerIds?.[0]);
  const granted = grantEventSkillFromProducer(state, data.battleData, skills, eventEntry.skillId, eventEntry.producerIds[0]);
  assert.equal(granted.ok, true);

  const equipment = firstEquipmentGrant();
  state.player.inventory.equipment[equipment.id] = 1;
  state.player.equipment[equipment.slot] = equipment.id;
  const equipmentSkillId = equipment.grantedSkillId;
  assert.equal(state.player.skills.has(equipmentSkillId), false, 'equipment grant must not become permanent before save');
  assert.equal(listPlayerSkillStates(state, data.battleData, skills).find((row) => row.id === equipmentSkillId)?.active, true);

  const equipmentIds = Object.values(state.player.equipment).filter((id) => data.battleData.equipmentById.has(id));
  const skillIds = [...new Set(['SKL-0001', eventEntry.skillId, equipmentSkillId])];
  const build = createPlayerBuild(data.battleData, { id:'checkpoint-c-save-build', level:23, equipmentIds, skillIds, baseStats:{ maxHp:10000,maxMp:500,attack:20,defense:50,agility:100,accuracy:100 } });
  let battle = beginInteractiveBattle({ data:data.battleData, seed:'checkpoint-c-save-battle', monsterIds:['MON-0005'], playerBuild:build, playerGold:state.player.gold, maxTurns:8 });
  const slash = listInteractiveBattleCommands({ data:data.battleData, session:battle }).find((command) => command.skillId === 'SKL-0001' && command.available);
  assert.ok(slash);
  const resolved = resolveInteractiveBattleRound({ data:data.battleData, session:battle, command:{ actionId:slash.actionId, targetInstanceId:slash.targets[0]?.instanceId } });
  assert.equal(resolved.ok, true);
  battle = resolved.session;
  battle.playerRuntimeMechanics.gold = 733;
  battle.playerRuntimeMechanics.weather = { type:'rain', sourceSkillId:'SKL-0797', battleLocalOnly:true, worldWeatherMutation:false };
  battle.playerRuntimeMechanics.fields.push({ instanceId:'FIELD-SAVE-1', owner:'player', kind:'magic_circle', type:'wind', createdBySkillId:'SKL-0640', expiresAfterTurn:9 });
  battle.playerRuntimeMechanics.history.lastRepeatable = { skillId:'SKL-0001', targetInstanceId:battle.state.enemies[0]?.instanceId ?? null };
  runtime.pendingBattle = { id:'BATTLE-C-SAVE', session:battle, continuation:{ prepared:{ scaledBuild:build }, encounterId:'ENC-SAVE' } };

  const learnedBefore = new Set(state.player.skills);
  const visibleBefore = new Set(state.player.visibleSkillIds);
  const eligibleBefore = new Set(state.player.flagEligibleSkillIds);
  assert.ok(visibleBefore.size > 0, 'save witness must include revealed skills');
  const encoded = serializeRuntime(runtime);
  const restored = deserializeRuntime(encoded, data);

  assert.equal(restored.playerState.player.sp, 13);
  assert.equal(restored.playerState.player.gold, 777, 'journey Gold is not silently replaced by pending battle Gold before settlement');
  assert.deepEqual(restored.playerState.player.skills, learnedBefore);
  assert.equal(restored.playerState.player.skills.has(eventEntry.skillId), true);
  assert.equal(restored.playerState.progress.events.grantedSkillIds.has(eventEntry.skillId), true);
  assert.equal(restored.playerState.player.skills.has(equipmentSkillId), false, 'equipment-only skill must not leak into learned skills after restore');
  assert.equal(listPlayerSkillStates(restored.playerState, data.battleData, skills).find((row) => row.id === equipmentSkillId)?.active, true);
  assert.equal(restored.playerState.progress.combat.physicalKills, 17);
  assert.equal(restored.playerState.progress.weapon.axe.kills, 12);
  assert.deepEqual(restored.playerState.player.visibleSkillIds, visibleBefore);
  assert.deepEqual(restored.playerState.player.flagEligibleSkillIds, eligibleBefore);

  const restoredBattle = restored.pendingBattle.session;
  assert.equal(restoredBattle.playerRuntimeMechanics.gold, 733);
  assert.equal(restoredBattle.playerRuntimeMechanics.weather.type, 'rain');
  assert.equal(restoredBattle.playerRuntimeMechanics.weather.battleLocalOnly, true);
  assert.equal(restoredBattle.playerRuntimeMechanics.fields.some((field) => field.instanceId === 'FIELD-SAVE-1'), true);
  assert.equal(restoredBattle.playerRuntimeMechanics.history.lastRepeatable.skillId, 'SKL-0001');
  assert.equal(restoredBattle.state.players[0].uses.get('SKL-0001'), battle.state.players[0].uses.get('SKL-0001'));
  assert.equal(restoredBattle.state.players[0].cooldowns.get('SKL-0001') ?? 0, battle.state.players[0].cooldowns.get('SKL-0001') ?? 0);
  assert.deepEqual(restoredBattle.state.players[0].skillIds, battle.state.players[0].skillIds);
});
