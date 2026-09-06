import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  battleObservationCommands,
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

function build(id, skillIds = []) {
  return createPlayerBuild(data, {
    id,
    name: id,
    level: 30,
    equipmentIds: ['EQP-W-0009'],
    skillIds,
    baseStats: {
      maxHp: 1_000_000,
      maxMp: 10_000,
      attack: 30,
      defense: 100,
      agility: 20_000,
      luck: 0,
      physicalPower: 30,
      magicPower: 160,
      magicResistance: 100,
      accuracy: 20_000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 20_000,
      debuffResistance: 20_000,
    },
  });
}

function withOnlyAction(monsterId, skillId) {
  const action = (data.actionsByMonsterId.get(monsterId) ?? []).find((entry) => entry.skillId === skillId);
  assert.ok(action, `${monsterId}/${skillId} canonical action must exist`);
  const actionsByMonsterId = new Map(data.actionsByMonsterId);
  actionsByMonsterId.set(monsterId, [{ ...action, condition: null, priority: 999, baseWeight: 100, cooldownOverride: 0, usesPerBattle: null }]);
  return { ...data, actionsByMonsterId };
}

function begin(localData, monsterId, seed, skillIds = []) {
  const session = beginInteractiveBattle({
    data: localData,
    monsterIds: [monsterId],
    playerBuild: build(`D-observation-${seed}`, skillIds),
    seed: `checkpoint-d:observation:${seed}`,
    maxTurns: 8,
  });
  session.state.enemies[0].agility = 1;
  return session;
}

function act(localData, session, actionId = 'ATTACK') {
  const displayed = listInteractiveBattleCommands({ data: localData, session })
    .find((entry) => entry.actionId === actionId && entry.available !== false);
  assert.ok(displayed, `${actionId} must be available`);
  const target = displayed.targets?.find((entry) => entry.side === 'enemy') ?? displayed.targets?.[0];
  const output = resolveInteractiveBattleRound({
    data: localData,
    session,
    command: { actionId: displayed.actionId, ...(target ? { targetInstanceId: target.instanceId } : {}) },
  });
  assert.equal(output.ok, true);
  return output;
}

test('Checkpoint D exposes an enemy telegraph as factual observation without a strategy answer', () => {
  const localData = withOnlyAction('MON-0017', 'MSK-0069');
  const output = act(localData, begin(localData, 'MON-0017', 'intent'));
  const rawTelegraph = (output.round?.frames ?? []).find((frame) => frame.actorSide === 'enemy' && frame.action?.kind === 'telegraph');
  assert.ok(rawTelegraph, 'production battle still keeps its canonical telegraph frame');

  const commands = listInteractiveBattleCommands({ data: localData, session: output.session });
  const intent = commands.find((entry) => entry.actionId.startsWith('INFO:INTENT:'));
  assert.ok(intent, 'player-facing command API must carry the pending enemy intent into Game View');
  assert.equal(intent.kind, 'info');
  assert.equal(intent.available, false);
  assert.match(intent.name, /^予兆：/u);
  assert.match(intent.description, /構えている/u);
  assert.doesNotMatch(`${intent.name} ${intent.description}`, /counterplay|攻略|正解|防御しろ|中断しろ/iu,
    'observation tells the player what is visible, not what answer to choose');
});

test('Checkpoint D exposes boss phase and key barrier/counter/reflect/seal state as observations', () => {
  const session = begin(data, 'MON-0018', 'states', ['SKL-0665']);
  const boss = session.state.enemies[0];
  boss.bossPhase = 2;
  boss.specialStates.set('barrier', { capacity: 123 });
  boss.specialStates.set('counter', { charges: 1 });
  boss.specialStates.set('reflect', { charges: 1 });
  session.state.players[0].specialStates.set('seal', { params: { blockedTags: ['magic'] } });

  const observations = battleObservationCommands({ data, session });
  const phase = observations.find((entry) => entry.actionId.startsWith('INFO:PHASE:'));
  const enemyState = observations.find((entry) => entry.actionId.startsWith('INFO:STATE:'));
  const playerState = observations.find((entry) => entry.actionId.startsWith('INFO:PLAYER_STATE:'));
  assert.ok(phase);
  assert.match(phase.name, /フェーズ 2/u);
  assert.match(enemyState?.description ?? '', /障壁/u);
  assert.match(enemyState?.description ?? '', /反撃態勢/u);
  assert.match(enemyState?.description ?? '', /反射態勢/u);
  assert.match(playerState?.description ?? '', /封印/u);

  const magic = listInteractiveBattleCommands({ data, session }).find((entry) => entry.skillId === 'SKL-0665');
  assert.equal(magic?.available, false);
  assert.equal(magic?.disabledReason, 'sealed');
  assert.ok(magic?.disabledDetail, 'state display and actionable disabled reason coexist');
});

test('Checkpoint D exposes field, battle-local weather and summon count without mutating world weather', () => {
  const session = begin(data, 'MON-0007', 'environment');
  session.state.fieldEffects.set('river_drain', { stacks: 2 });
  session.playerRuntimeMechanics.weather = 'rain';
  session.state.enemies.push({
    ...structuredClone(session.state.enemies[0]),
    id: 'MON-0005',
    instanceId: 'checkpoint-d-extra-enemy',
    hp: 10,
    maxHp: 10,
    alive: true,
  });

  const observations = battleObservationCommands({ data, session });
  assert.match(observations.find((entry) => entry.actionId === 'INFO:FIELD')?.description ?? '', /river_drain ×2/u);
  assert.equal(observations.find((entry) => entry.actionId === 'INFO:WEATHER')?.description, 'rain');
  assert.match(observations.find((entry) => entry.actionId === 'INFO:REINFORCEMENTS')?.description ?? '', /1体/u);
  assert.equal(session.state.world?.weather ?? null, null, 'battle-local weather observation does not overwrite world weather');
});
