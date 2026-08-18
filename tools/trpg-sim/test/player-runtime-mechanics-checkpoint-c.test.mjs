import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

function runtimeBuild(id, skillIds, overrides = {}) {
  return createPlayerBuild(data, {
    id,
    name: `Checkpoint C ${id}`,
    level: 50,
    equipmentIds: ['EQP-W-0073'],
    skillIds,
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
      ...overrides,
    },
  });
}

function encoreBuild() {
  return runtimeBuild('checkpoint-c-encore', ['SKL-0001', 'SKL-1139']);
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

test('Checkpoint C REPEAT_WHILE_HIT executes SKL-1140 until the first miss in one authoritative action', () => {
  const skill = data.playerSkillById.get('SKL-1140');
  assert.ok(skill, 'SKL-1140 must exist in the canonical player registry');
  assert.ok((skill.runtimeMechanics ?? []).some((entry) => entry.family === 'REPEAT_WHILE_HIT'));

  // These are fixed deterministic combat fixtures, not route discovery.  We
  // exercise several seeds so the test certifies both a successful repeat and
  // the terminating miss without baking the engine's PRNG internals into it.
  const seeds = [
    'chain-00', 'chain-01', 'chain-02', 'chain-03', 'chain-04', 'chain-05', 'chain-06', 'chain-07',
    'chain-08', 'chain-09', 'chain-10', 'chain-11', 'chain-12', 'chain-13', 'chain-14', 'chain-15',
    'chain-16', 'chain-17', 'chain-18', 'chain-19', 'chain-20', 'chain-21', 'chain-22', 'chain-23',
  ];
  let witness = null;

  for (const seed of seeds) {
    const session = beginInteractiveBattle({
      data,
      seed: `checkpoint-c-repeat-while-hit:${seed}`,
      monsterIds: ['MON-0077'],
      playerBuild: runtimeBuild('checkpoint-c-repeat-while-hit', ['SKL-1140']),
      maxTurns: 2,
    });
    const skillCommand = command(session, 'SKL-1140');
    assert.ok(skillCommand?.available, `SKL-1140 must be executable for ${seed}`);
    const output = resolveInteractiveBattleRound({
      data,
      session,
      command: {
        actionId: skillCommand.actionId,
        targetInstanceId: skillCommand.targets[0]?.instanceId,
      },
    });
    assert.equal(output.ok, true);
    const frame = output.round.frames.find((entry) => (
      entry.actorSide === 'player' && entry.action?.skillId === 'SKL-1140'
    ));
    assert.ok(frame, `SKL-1140 must appear in the battle timeline for ${seed}`);
    const event = (frame.events ?? []).find((entry) => entry.family === 'REPEAT_WHILE_HIT');
    assert.ok(event, `REPEAT_WHILE_HIT event must be visible for ${seed}`);
    assert.equal(event.hits, frame.hits);
    assert.equal(event.misses, event.stoppedOnMiss ? 1 : 0);
    assert.equal(event.safetyCapReached, false, 'the semantic safety cap must not be normal termination');

    if (event.stoppedOnMiss) {
      assert.equal(event.attempts, event.hits + 1, 'no hit attempt may occur after the terminating miss');
    }
    if (event.stoppedOnMiss && event.hits >= 1) {
      witness = { output, frame, event };
      break;
    }
  }

  assert.ok(witness, 'a deterministic fixture must demonstrate hit → repeat → miss → stop');
  assert.ok(witness.event.hits >= 1);
  assert.equal(witness.event.attempts, witness.event.hits + 1);
  const targetEffect = witness.frame.effects.find((effect) => effect.targetInstanceId === witness.frame.primaryTargetInstanceId);
  assert.ok(targetEffect, 'chain damage must mutate the authoritative target state');
  assert.equal(targetEffect.hpBefore - targetEffect.hpAfter, witness.frame.damage);
  const actor = witness.output.session.state.players[0];
  assert.equal(actor.uses.get('SKL-1140'), 1, 'the whole chain is one skill activation');
  assert.equal(actor.mpSpent, Number(skill.costs.mp ?? 0), 'the chain pays SKL-1140 cost once');
});
