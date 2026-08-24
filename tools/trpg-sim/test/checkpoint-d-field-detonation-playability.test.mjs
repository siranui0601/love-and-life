import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();
const CERTIFICATION_LAYER = 'MECHANIC_WITNESS';

// D-0 classification:
// - Direct skill injection and extreme stats intentionally isolate production runtime mechanics.
// - This file is NOT GAMEPLAY_CERT: acquisition/grant and canonical enemy balance are not exercised.
// - Canonical Checkpoint D forbids duplicate active instances from the same sourceSkillId.
//   Different source skills may coexist, including skills in the same formation family.
const FIELD_A = 'SKL-0639';
const FIELD_B = 'SKL-0640';
const DETONATE = 'SKL-1108';

function makeSession(seed) {
  const build = createPlayerBuild(data, {
    id: `checkpoint-d-field-${seed}`,
    name: 'Checkpoint D field detonation mechanic witness',
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
    maxTurns: 16,
  });
  const enemy = session.state.enemies[0];
  enemy.maxHp = Math.max(enemy.maxHp, 10_000_000);
  enemy.hp = enemy.maxHp;
  return session;
}

function displayedCommand(session, actionOrSkill) {
  const commands = listInteractiveBattleCommands({ data, session });
  return actionOrSkill.startsWith('SKL-')
    ? commands.find((entry) => entry.skillId === actionOrSkill)
    : commands.find((entry) => entry.actionId === actionOrSkill);
}

function commandFor(session, actionOrSkill) {
  const command = displayedCommand(session, actionOrSkill);
  assert.ok(command && command.available !== false, `${actionOrSkill} must be an available production command`);
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
  const frame = (output.round?.frames ?? []).find((entry) => entry.actorSide === 'player' && entry.phase === 'action');
  assert.ok(frame, `${actionOrSkill}: production player frame missing`);
  return { session: output.session, frame };
}

function playWhenReady(session, actionOrSkill, frames) {
  let waits = 0;
  while (true) {
    const displayed = displayedCommand(session, actionOrSkill);
    if (displayed?.available !== false) break;
    assert.equal(displayed?.disabledReason, 'cooldown', `${actionOrSkill} may only require cooldown waiting in this witness`);
    assert.ok(waits < 8, `${actionOrSkill} cooldown did not clear within the bounded witness`);
    const waited = play(session, 'DEFEND');
    session = waited.session;
    frames.push(waited.frame);
    waits += 1;
  }
  const result = play(session, actionOrSkill);
  frames.push(result.frame);
  return result.session;
}

function consumeEvent(frame) {
  return (frame.events ?? []).find((entry) => entry.family === 'CONSUME_OWNED_FIELD') ?? null;
}

function runLine(name, actions) {
  let session = makeSession(name);
  const initialMp = session.state.players[0].mp;
  const frames = [];
  for (const action of actions) session = playWhenReady(session, action, frames);
  const actionFrames = frames.filter((frame) => frame.action?.kind !== 'defend');
  const damage = actionFrames.reduce((sum, frame) => sum + Math.max(0, Number(frame.damage ?? 0)), 0);
  const burst = Math.max(0, ...actionFrames.map((frame) => Number(frame.damage ?? 0)));
  const detonationFrame = actionFrames.find((frame) => frame.action?.skillId === DETONATE) ?? null;
  return {
    name,
    requestedActions: actions,
    elapsedTurns: frames.length,
    waits: frames.length - actions.length,
    damage,
    burst,
    mpSpent: initialMp - session.state.players[0].mp,
    remainingFields: session.playerRuntimeMechanics.fields.length,
    event: detonationFrame ? consumeEvent(detonationFrame) : null,
  };
}

test('[MECHANIC_WITNESS] 陣爆破 executes one-field and mixed-type setup/payoff under canonical no-duplicate-source rules', () => {
  const normal3 = runLine('normal-3', ['ATTACK', 'ATTACK', 'ATTACK']);
  const one = runLine('one-field', [FIELD_A, DETONATE]);
  const mixedTwo = runLine('mixed-two', [FIELD_A, FIELD_B, DETONATE]);

  assert.equal(one.event?.consumedCount, 1);
  assert.equal(one.event?.uniqueTypeCount, 1);
  assert.equal(one.remainingFields, 0, 'detonation consumes the owned setup field');

  const recastSession = makeSession('same-source-recast-rejected');
  const placed = play(recastSession, FIELD_A).session;
  const recast = displayedCommand(placed, FIELD_A);
  assert.equal(recast?.available, false);
  assert.equal(recast?.disabledReason, 'formation_already_active');
  const rejected = resolveInteractiveBattleRound({ data, session: placed, command: { actionId: `SKILL:${FIELD_A}` } });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'formation_already_active');
  assert.strictEqual(rejected.session, placed, 'rejected same-source recast does not replace or clone the live session');

  assert.equal(mixedTwo.event?.consumedCount, 2);
  assert.equal(mixedTwo.event?.uniqueTypeCount, 2, 'distinct formations retain type identity until payoff');
  assert.equal(mixedTwo.remainingFields, 0);
  assert.ok(Number(mixedTwo.event?.scale) > Number(one.event?.scale), 'the runtime count/type scaling is mechanically connected');
  assert.ok(mixedTwo.burst > one.burst, 'mixed two-field setup produces a larger mechanic-isolation burst than one field');

  assert.equal(one.elapsedTurns, 2);
  assert.ok(mixedTwo.elapsedTurns >= 3);
  assert.ok(mixedTwo.mpSpent > one.mpSpent);
  assert.ok(normal3.damage > 0, 'plain attacks remain a mechanic-isolation opportunity-cost baseline');

  console.log(`CHECKPOINT_D_FIELD_MECHANIC_WITNESS ${JSON.stringify({
    certificationLayer: CERTIFICATION_LAYER,
    canonicalAcquisitionExercised: false,
    sameSourceDuplicateRule: 'FORBIDDEN_WHILE_ACTIVE',
    normal3,
    one,
    mixedTwo,
  })}`);
});
