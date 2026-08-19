import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

function runtimeBuild(id, skillIds, overrides = {}, equipmentIds = ['EQP-W-0073']) {
  return createPlayerBuild(data, {
    id,
    name: `Checkpoint C ${id}`,
    level: 50,
    equipmentIds,
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

function commands(session, skillId) {
  return listInteractiveBattleCommands({ data, session }).filter((entry) => entry.skillId === skillId);
}

function command(session, skillId) {
  return commands(session, skillId)[0];
}

test('Checkpoint C REPEAT_LAST_SKILL executes Encore in authoritative interactive battle', () => {
  let session = beginInteractiveBattle({ data, seed: 'checkpoint-c-encore-runtime', monsterIds: ['MON-0077'], playerBuild: encoreBuild(), maxTurns: 8 });
  const unavailable = command(session, 'SKL-1139');
  assert.ok(unavailable);
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.disabledReason, 'no_repeatable_history');
  const sourceCommand = command(session, 'SKL-0001');
  assert.ok(sourceCommand?.available);
  const first = resolveInteractiveBattleRound({ data, session, command: { actionId: sourceCommand.actionId, targetInstanceId: sourceCommand.targets[0]?.instanceId } });
  assert.equal(first.ok, true);
  session = first.session;
  assert.equal(session.playerRuntimeMechanics.history.lastRepeatable.skillId, 'SKL-0001');
  const sourceUses = session.state.players[0].uses.get('SKL-0001');
  assert.equal(sourceUses, 1);
  const available = command(session, 'SKL-1139');
  assert.ok(available?.available);
  assert.ok(available.targets.length > 0);
  session.playerRuntimeMechanics.history.lastRepeatable.targetInstanceId = 'dead-target#999';
  const encore = data.playerSkillById.get('SKL-1139');
  const second = resolveInteractiveBattleRound({ data, session, command: { actionId: available.actionId, targetInstanceId: 'dead-target#999' } });
  assert.equal(second.ok, true);
  const encoreFrame = second.round.frames.find((frame) => frame.actorSide === 'player' && frame.action?.skillId === 'SKL-1139');
  assert.ok(encoreFrame, 'Encore must have an executed player action frame');
  const repeatEvent = (encoreFrame.events ?? []).find((event) => event.family === 'REPEAT_LAST_SKILL');
  assert.deepEqual({ family: repeatEvent?.family, sourceSkillId: repeatEvent?.sourceSkillId, sourceCostRepaid: repeatEvent?.sourceCostRepaid, sourceCooldownReset: repeatEvent?.sourceCooldownReset }, {
    family: 'REPEAT_LAST_SKILL', sourceSkillId: 'SKL-0001', sourceCostRepaid: false, sourceCooldownReset: false,
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
  const mechanic = (skill.runtimeMechanics ?? []).find((entry) => entry.family === 'REPEAT_WHILE_HIT');
  assert.deepEqual({ hitChancePct: mechanic?.hitChancePct, maxHits: mechanic?.maxHits, perHitMultiplier: mechanic?.perHitMultiplier }, { hitChancePct: 30, maxHits: 20, perHitMultiplier: 2.8 });
  const seeds = Array.from({ length: 24 }, (_, index) => `chain-${String(index).padStart(2, '0')}`);
  let witness = null;
  for (const seed of seeds) {
    const session = beginInteractiveBattle({ data, seed: `checkpoint-c-repeat-while-hit:${seed}`, monsterIds: ['MON-0077'], playerBuild: runtimeBuild('checkpoint-c-repeat-while-hit', ['SKL-1140']), maxTurns: 2 });
    const skillCommand = command(session, 'SKL-1140');
    assert.ok(skillCommand?.available, `SKL-1140 must be executable for ${seed}`);
    const output = resolveInteractiveBattleRound({ data, session, command: { actionId: skillCommand.actionId, targetInstanceId: skillCommand.targets[0]?.instanceId } });
    assert.equal(output.ok, true);
    const frame = output.round.frames.find((entry) => entry.actorSide === 'player' && entry.action?.skillId === 'SKL-1140');
    assert.ok(frame, `SKL-1140 must appear in the battle timeline for ${seed}`);
    const event = (frame.events ?? []).find((entry) => entry.family === 'REPEAT_WHILE_HIT');
    assert.ok(event, `REPEAT_WHILE_HIT event must be visible for ${seed}`);
    assert.equal(event.hits, frame.hits);
    assert.equal(event.misses, event.stoppedOnMiss ? 1 : 0);
    assert.equal(event.safetyCapReached, false, 'the semantic safety cap must not be normal termination');
    if (event.stoppedOnMiss) assert.equal(event.attempts, event.hits + 1, 'no hit attempt may occur after the terminating miss');
    if (event.stoppedOnMiss && event.hits >= 1) { witness = { output, frame, event }; break; }
  }
  assert.ok(witness, 'a deterministic fixture must demonstrate hit → repeat → miss → stop');
  const targetEffect = witness.frame.effects.find((effect) => effect.targetInstanceId === witness.frame.primaryTargetInstanceId);
  assert.ok(targetEffect, 'chain damage must mutate the authoritative target state');
  assert.equal(targetEffect.hpBefore - targetEffect.hpAfter, witness.frame.damage);
  assert.equal(witness.output.session.state.players[0].uses.get('SKL-1140'), 1, 'the whole chain is one skill activation');
  assert.equal(witness.output.session.state.players[0].mpSpent, Number(skill.costs.mp ?? 0), 'the chain pays SKL-1140 cost once');
});

test('Checkpoint C PLAYER-owned magic circles feed and are consumed by SKL-1108 Formation Explosion', () => {
  let session = beginInteractiveBattle({ data, seed: 'checkpoint-c-owned-field-runtime', monsterIds: ['MON-0077'], playerBuild: runtimeBuild('checkpoint-c-owned-field', ['SKL-0639', 'SKL-0640', 'SKL-1108'], {}, ['EQP-W-0009']), maxTurns: 8 });
  const initiallyBlocked = command(session, 'SKL-1108');
  assert.ok(initiallyBlocked);
  assert.equal(initiallyBlocked.available, false);
  assert.equal(initiallyBlocked.disabledReason, 'no_owned_field');
  for (const skillId of ['SKL-0639', 'SKL-0640']) {
    const fieldCommand = command(session, skillId);
    assert.ok(fieldCommand?.available, `${skillId} must be legal with the canonical staff witness`);
    const output = resolveInteractiveBattleRound({ data, session, command: { actionId: fieldCommand.actionId, targetInstanceId: fieldCommand.targets[0]?.instanceId } });
    assert.equal(output.ok, true);
    session = output.session;
    const frame = output.round.frames.find((entry) => entry.actorSide === 'player' && entry.action?.skillId === skillId);
    const event = (frame?.events ?? []).find((entry) => entry.family === 'CREATE_OWNED_FIELD');
    assert.ok(event, `${skillId} must create an authoritative PLAYER-owned field event`);
    assert.equal(event.field.owner, 'player');
    assert.equal(event.field.kind, 'magic_circle');
  }
  assert.equal(session.playerRuntimeMechanics.fields.length, 2);
  assert.deepEqual([...new Set(session.playerRuntimeMechanics.fields.map((field) => field.type))].sort(), ['thunder', 'wind']);
  const explosionCommand = command(session, 'SKL-1108');
  assert.ok(explosionCommand?.available, 'Formation Explosion becomes available only after an owned circle exists');
  const explosion = resolveInteractiveBattleRound({ data, session, command: { actionId: explosionCommand.actionId } });
  assert.equal(explosion.ok, true);
  const frame = explosion.round.frames.find((entry) => entry.actorSide === 'player' && entry.action?.skillId === 'SKL-1108');
  assert.ok(frame);
  const event = (frame.events ?? []).find((entry) => entry.family === 'CONSUME_OWNED_FIELD');
  assert.deepEqual({ consumedCount: event?.consumedCount, fieldTypes: event?.fieldTypes, uniqueTypeCount: event?.uniqueTypeCount, baseMultiplier: event?.baseMultiplier, scale: event?.scale }, {
    consumedCount: 2, fieldTypes: ['thunder', 'wind'], uniqueTypeCount: 2, baseMultiplier: 1.53, scale: 1.35,
  });
  assert.ok(Math.abs(event.damageMultiplier - 2.0655) < 1e-9);
  assert.equal(explosion.session.playerRuntimeMechanics.fields.length, 0, 'only after the successful explosion are owned circles consumed');
  assert.equal(explosion.session.state.players[0].uses.get('SKL-1108'), 1);
});

test('Checkpoint C SKL-1141 burns specified Gold, scales exactly, debuffs and rejects overspend', () => {
  let session = beginInteractiveBattle({ data, seed: 'checkpoint-c-gold-runtime', monsterIds: ['MON-0077'], playerGold: 1000, playerBuild: runtimeBuild('checkpoint-c-gold-burn', ['SKL-1141'], { debuffSuccess: 10_000 }), maxTurns: 4 });
  const goldCommands = commands(session, 'SKL-1141');
  assert.ok(goldCommands.some((entry) => entry.goldCost === 250 && entry.actionId === 'SKILL:SKL-1141:GOLD:250'));
  const spend250 = goldCommands.find((entry) => entry.goldCost === 250);
  const expectedMultiplier = Math.min(2.8, 0.55 + 0.32 * Math.log(1 + 250 / 25));
  assert.ok(Math.abs(spend250.damageMultiplier - expectedMultiplier) < 1e-12);
  const output = resolveInteractiveBattleRound({ data, session, command: { actionId: spend250.actionId } });
  assert.equal(output.ok, true);
  session = output.session;
  assert.equal(session.playerRuntimeMechanics.gold, 750);
  const frame = output.round.frames.find((entry) => entry.actorSide === 'player' && entry.action?.skillId === 'SKL-1141');
  assert.ok(frame);
  const event = (frame.events ?? []).find((entry) => entry.family === 'GOLD_SPEND_SCALING');
  assert.deepEqual({ spend: event?.spend, goldBefore: event?.goldBefore, goldAfter: event?.goldAfter }, { spend: 250, goldBefore: 1000, goldAfter: 750 });
  assert.ok(Math.abs(event.damageMultiplier - expectedMultiplier) < 1e-12);
  assert.equal(session.state.players[0].uses.get('SKL-1141'), 1);
  const targetEffect = frame.effects.find((effect) => effect.targetInstanceId === frame.primaryTargetInstanceId);
  assert.ok(targetEffect?.statusesAfter?.includes('modifier:accuracy:-1'), 'canonical accuracy debuff must be visible immediately in the SKL-1141 authoritative frame');
  assert.equal(Number(output.session.diagnostics?.counts?.unmodeledMoneyCost ?? 0), 0);
  const before = structuredClone(session.playerRuntimeMechanics);
  const rejected = resolveInteractiveBattleRound({ data, session, command: { actionId: 'SKILL:SKL-1141:GOLD:751' } });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'insufficient_gold');
  assert.deepEqual(session.playerRuntimeMechanics, before, 'overspend rejection must not mutate battle Gold/history/fields');
});
