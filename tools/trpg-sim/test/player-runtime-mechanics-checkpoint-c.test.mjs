import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

function encoreBuild() {
  return createPlayerBuild(data, {
    id: 'checkpoint-c-encore',
    name: 'Checkpoint C Encore witness',
    level: 50,
    equipmentIds: [],
    skillIds: ['SKL-0001', 'SKL-1139'],
    baseStats: {
      maxHp: 100_000,
      maxMp: 500,
      attack: 0,
      defense: 1_000,
      agility: 1_000,
      luck: 0,
      physicalPower: 1,
      magicPower: 1,
      magicResistance: 1_000,
      accuracy: 1_000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 100,
      debuffResistance: 100,
    },
  });
}

function command(session, skillId) {
  return listInteractiveBattleCommands({ data, session })
    .find((entry) => entry.skillId === skillId);
}

test('Checkpoint C REPEAT_LAST_SKILL executes Encore in authoritative interactive battle', () => {
  let session = beginInteractiveBattle({
    data,
    seed: 'checkpoint-c-encore-runtime',
    monsterIds: ['MON-0077'],
    playerBuild: encoreBuild(),
    maxTurns: 8,
  });

  const unavailable = command(session, 'SKL-1139');
  assert.ok(unavailable);
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.disabledReason, 'no_repeatable_history');

  const sourceCommand = command(session, 'SKL-0001');
  assert.ok(sourceCommand?.available);
  const first = resolveInteractiveBattleRound({
    data,
    session,
    command: {
      actionId: sourceCommand.actionId,
      targetInstanceId: sourceCommand.targets[0]?.instanceId,
    },
  });
  assert.equal(first.ok, true);
  session = first.session;
  assert.equal(session.playerRuntimeMechanics.history.lastRepeatable.skillId, 'SKL-0001');
  const sourceUses = session.state.players[0].uses.get('SKL-0001');
  assert.equal(sourceUses, 1);

  const available = command(session, 'SKL-1139');
  assert.ok(available?.available);
  assert.ok(available.targets.length > 0);

  // A stored target can disappear between the source action and Encore. The
  // runtime must reselect a current legal target instead of replaying a corpse.
  session.playerRuntimeMechanics.history.lastRepeatable.targetInstanceId = 'dead-target#999';
  const encore = data.playerSkillById.get('SKL-1139');
  const second = resolveInteractiveBattleRound({
    data,
    session,
    command: {
      actionId: available.actionId,
      targetInstanceId: 'dead-target#999',
    },
  });
  assert.equal(second.ok, true);

  const encoreFrame = second.round.frames.find((frame) => (
    frame.actorSide === 'player' && frame.action?.skillId === 'SKL-1139'
  ));
  assert.ok(encoreFrame, 'Encore must have an executed player action frame');
  const repeatEvent = (encoreFrame.events ?? []).find((event) => event.family === 'REPEAT_LAST_SKILL');
  assert.deepEqual({
    family: repeatEvent?.family,
    sourceSkillId: repeatEvent?.sourceSkillId,
    sourceCostRepaid: repeatEvent?.sourceCostRepaid,
    sourceCooldownReset: repeatEvent?.sourceCooldownReset,
  }, {
    family: 'REPEAT_LAST_SKILL',
    sourceSkillId: 'SKL-0001',
    sourceCostRepaid: false,
    sourceCooldownReset: false,
  });
  assert.notEqual(repeatEvent.targetInstanceId, 'dead-target#999');

  const playerEffect = encoreFrame.effects.find((effect) => effect.targetInstanceId === encoreFrame.actorInstanceId);
  assert.ok(playerEffect, 'Encore MP payment must be visible in authoritative effects');
  assert.equal(playerEffect.mpBefore - playerEffect.mpAfter, Number(encore.costs.mp ?? 0));

  const actor = second.session.state.players[0];
  assert.equal(actor.uses.get('SKL-0001'), sourceUses, 'source use count must not be charged twice');
  assert.equal(actor.uses.get('SKL-1139'), 1, 'Encore owns its own use/cooldown accounting');
  assert.equal(second.session.playerRuntimeMechanics.history.lastRepeatable.skillId, 'SKL-0001', 'Encore cannot recurse into itself');
  assert.ok(Number(encoreFrame.damage ?? 0) >= 0);
});
