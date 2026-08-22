import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

const FIELD_A = 'SKL-0639';
const FIELD_B = 'SKL-0640';
const DETONATE = 'SKL-1108';

function makeSession(seed) {
  const build = createPlayerBuild(data, {
    id: `checkpoint-d-field-${seed}`,
    name: 'Checkpoint D field detonation witness',
    level: 20,
    equipmentIds: ['EQP-W-0009'],
    skillIds: [FIELD_A, FIELD_B, DETONATE],
    baseStats: {
      maxHp: 1_000_000,
      maxMp: 2_000,
      attack: 30,
      defense: 5_000,
      agility: 10_000,
      luck: 0,
      physicalPower: 30,
      magicPower: 160,
      magicResistance: 5_000,
      accuracy: 10_000,
      evasion: 0,
      critical: 0,
      debuffSuccess: 10_000,
      debuffResistance: 5_000,
    },
  });
  const session = beginInteractiveBattle({
    data,
    monsterIds: ['MON-0005'],
    playerBuild: build,
    seed: `checkpoint-d:field:${seed}`,
    maxTurns: 8,
  });
  // Keep one ordinary production enemy alive long enough to compare setup lines.
  // Only HP is enlarged; command selection, defense, reactions and runtime semantics remain production code.
  const enemy = session.state.enemies[0];
  enemy.maxHp = Math.max(enemy.maxHp, 10_000_000);
  enemy.hp = enemy.maxHp;
  return session;
}

function commandFor(session, actionOrSkill) {
  const commands = listInteractiveBattleCommands({ data, session });
  const command = actionOrSkill.startsWith('SKL-')
    ? commands.find((entry) => entry.skillId === actionOrSkill && entry.available !== false)
    : commands.find((entry) => entry.actionId === actionOrSkill && entry.available !== false);
  assert.ok(command, `${actionOrSkill} must be an available production command`);
  const target = command.targets?.find((entry) => entry.side === 'enemy') ?? command.targets?.[0];
  return {
    actionId: command.actionId,
    ...(target ? { targetInstanceId: target.instanceId } : {}),
  };
}

function play(session, actionOrSkill) {
  const output = resolveInteractiveBattleRound({
    data,
    session,
    command: commandFor(session, actionOrSkill),
  });
  assert.equal(output.ok, true, `${actionOrSkill}: ${output.reason ?? 'unknown failure'}`);
  const frame = (output.round?.frames ?? []).find((entry) =>
    entry.actorSide === 'player' && entry.phase === 'action');
  assert.ok(frame, `${actionOrSkill}: production player frame missing`);
  return { session: output.session, frame, output };
}

function consumeEvent(frame) {
  return (frame.events ?? []).find((entry) => entry.family === 'CONSUME_OWNED_FIELD') ?? null;
}

function runLine(name, actions) {
  let session = makeSession(name);
  const initialMp = session.state.players[0].mp;
  const frames = [];
  for (const action of actions) {
    const result = play(session, action);
    session = result.session;
    frames.push(result.frame);
  }
  const damage = frames.reduce((sum, frame) => sum + Math.max(0, Number(frame.damage ?? 0)), 0);
  const burst = Math.max(0, ...frames.map((frame) => Number(frame.damage ?? 0)));
  const finalMp = session.state.players[0].mp;
  const detonationFrame = frames.find((frame) => frame.action?.skillId === DETONATE) ?? null;
  return {
    name,
    actions,
    turns: actions.length,
    damage,
    burst,
    mpSpent: initialMp - finalMp,
    remainingFields: session.playerRuntimeMechanics.fields.length,
    event: detonationFrame ? consumeEvent(detonationFrame) : null,
  };
}

test('Checkpoint D field detonation has bounded setup/payoff choices rather than a decorative field state', () => {
  const normal3 = runLine('normal-3', ['ATTACK', 'ATTACK', 'ATTACK']);
  const one = runLine('one-field', [FIELD_A, DETONATE]);
  const sameTwo = runLine('same-two', [FIELD_A, FIELD_A, DETONATE]);
  const mixedTwo = runLine('mixed-two', [FIELD_A, FIELD_B, DETONATE]);

  assert.equal(one.event?.consumedCount, 1);
  assert.equal(one.event?.uniqueTypeCount, 1);
  assert.equal(one.remainingFields, 0, 'detonation consumes the owned setup field');

  assert.equal(sameTwo.event?.consumedCount, 2, 'recasting the same formation creates a second setup stack');
  assert.equal(sameTwo.event?.uniqueTypeCount, 1, 'same-type setup is distinguished from mixed setup');
  assert.equal(sameTwo.remainingFields, 0);

  assert.equal(mixedTwo.event?.consumedCount, 2);
  assert.equal(mixedTwo.event?.uniqueTypeCount, 2, 'mixed formations must retain type identity until payoff');
  assert.equal(mixedTwo.remainingFields, 0);

  assert.ok(Number(sameTwo.event?.scale) > Number(one.event?.scale), 'a second field increases detonation payoff');
  assert.ok(Number(mixedTwo.event?.scale) > Number(sameTwo.event?.scale), 'mixed field types add authored diversity payoff');
  assert.ok(sameTwo.burst > one.burst, 'same-type two-field setup produces a larger burst than one-field setup');
  assert.ok(mixedTwo.burst > sameTwo.burst, 'mixed two-field setup produces the largest two-field burst');

  // The tactical cost is visible too: bigger payoff consumes an extra turn and MP before the burst.
  assert.equal(one.turns, 2);
  assert.equal(sameTwo.turns, 3);
  assert.equal(mixedTwo.turns, 3);
  assert.ok(sameTwo.mpSpent > one.mpSpent);
  assert.ok(mixedTwo.mpSpent > one.mpSpent);
  assert.ok(normal3.damage > 0, 'plain attacks remain a real opportunity-cost baseline');

  const report = { normal3, one, sameTwo, mixedTwo };
  console.log(`CHECKPOINT_D_FIELD_DECISION ${JSON.stringify(report)}`);
});
