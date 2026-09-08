import assert from 'node:assert/strict';
import test from 'node:test';

import { battleObservationsFromSave } from '../../../public/TRPG/battle-observation-view.js';
import { createGameRuntime } from '../../../src/server/trpg/game/service.js';
import { loadTrpgGameData } from '../../../src/server/trpg/game/game-data.js';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';
import {
  LV1_AXE_STARTER_GAMEPLAY_CERT,
  assertGameplayCertDescriptor,
  checkpointDGameplayCertCount,
} from '../lib/checkpoint-d-certification-layers.mjs';
import {
  beginInteractiveBattleAction,
  clockFromMinute,
  generateChoiceActions,
  learnPlayerSkill,
  settleInteractiveBattleAction,
} from '../lib/player-journey.mjs';

const data = loadTrpgGameData();
const SKILL_ID = 'SKL-0049';
const EQUIPMENT_ID = 'EQP-W-0005';
const SEED = 'checkpoint-d:gameplay-cert:lv1-axe-starter';
const STRATEGY_HINT = /防御しろ|防御して|先に倒|最適|正解|攻略|狙え|使え/u;

function targetFor(command) {
  return command.targets?.find((entry) => entry.side === 'enemy') ?? command.targets?.[0] ?? null;
}

function resolveCommand(session, command) {
  const target = targetFor(command);
  const output = resolveInteractiveBattleRound({
    data: data.battleData,
    session,
    command: {
      actionId: command.actionId,
      ...(target ? { targetInstanceId: target.instanceId } : {}),
    },
  });
  assert.equal(output.ok, true, `${command.actionId}: ${output.reason ?? 'failed'}`);
  return output;
}

function chooseFollowUp(session) {
  const commands = listInteractiveBattleCommands({ data: data.battleData, session });
  const player = session.state.players[0];
  const hpRatio = Number(player.hp ?? 0) / Math.max(1, Number(player.maxHp ?? 1));
  if (hpRatio < 0.25) {
    const flee = commands.find((entry) => entry.actionId === 'FLEE' && entry.available !== false);
    if (flee) return flee;
  }
  return commands.find((entry) => entry.skillId === SKILL_ID && entry.available !== false)
    ?? commands.find((entry) => entry.actionId === 'ATTACK' && entry.available !== false)
    ?? commands.find((entry) => entry.actionId === 'DEFEND' && entry.available !== false)
    ?? commands.find((entry) => entry.actionId === 'FLEE' && entry.available !== false)
    ?? null;
}

function assertClockSynchronized(state) {
  const clock = clockFromMinute(state.absoluteMinute);
  assert.equal(state.day, clock.day);
  assert.equal(state.hour, clock.hour);
  assert.equal(state.minute, clock.minute);
  assert.equal(state.minuteOfDay, clock.minuteOfDay);
}

function runScenario(seed) {
  const runtime = createGameRuntime(data, {
    seed,
    profileId: 'balanced',
    playerName: 'D-cert',
    tutorial: false,
  });
  const state = runtime.playerState;

  // Legal current-Day1 provisional build. This deliberately certifies the
  // current runnable starter state and does not declare a universal starter class.
  assert.equal(state.player.level, 1);
  assert.equal(state.player.sp, 2);
  assert.equal(state.player.equipment.mainHand, EQUIPMENT_ID);
  assert.ok(Number(state.player.inventory.equipment[EQUIPMENT_ID] ?? 0) > 0);
  const equipment = data.battleData.equipmentById.get(EQUIPMENT_ID);
  assert.ok(equipment);
  assert.equal(equipment.slot, 'mainHand');
  assert.equal(equipment.weaponType, 'axe');

  const skill = data.skills.find((entry) => entry.id === SKILL_ID);
  assert.ok(skill);
  assert.equal(skill.acquisitionCode, 'basic_level_up');
  assert.equal(skill.requiredLevel, 1);
  assert.equal(skill.spCost, 1);
  assert.equal(skill.damage.totalMultiplier, 1.65);
  assert.equal(skill.damage.accuracyModifier, -8);
  assert.equal(skill.damage.criticalModifier, 10);

  const spBefore = state.player.sp;
  const learned = learnPlayerSkill(state, data.battleData, data.skills, SKILL_ID);
  assert.equal(learned.ok, true, learned.reason);
  assert.equal(spBefore - state.player.sp, 1);
  assert.equal(state.player.sp, 1);
  assert.equal(state.player.skills.has(SKILL_ID), true);
  assert.ok(state.history.some((entry) => entry.type === 'SKILL_LEARNED'
    && entry.skillId === SKILL_ID
    && entry.acquisitionCode === 'basic_level_up'
    && entry.spCost === 1
    && entry.validAtAcquisition === true));

  const minuteBeforeBattleAction = state.absoluteMinute;
  const seekBattle = generateChoiceActions(
    state,
    data.model,
    data.battleData,
    state.catalog,
    undefined,
    { limit: 12 },
  ).find((entry) => entry.type === 'seekBattle');
  assert.ok(seekBattle, 'current Day1 production choices must expose a canonical seekBattle action');

  const opening = beginInteractiveBattleAction(
    state,
    data.model,
    data.battleData,
    data.skills,
    state.catalog,
    'balanced',
    seekBattle,
  );
  assert.equal(opening.ok, true, opening.reason);
  assert.equal(state.absoluteMinute, minuteBeforeBattleAction + Number(seekBattle.minutes),
    'production seekBattle advances world time before the encounter opens');
  assertClockSynchronized(state);

  const continuation = opening.continuation;
  const build = continuation.prepared.scaledBuild;
  assert.equal(build.level, 1);
  assert.equal(build.skillIds.includes(SKILL_ID), true, 'learnPlayerSkill result reaches the production battle build');
  assert.equal(build.activeWeaponTypes.has('axe'), true);
  assert.equal(Object.values(state.player.equipment).includes(EQUIPMENT_ID), true);

  const encounter = data.battleData.encounterById.get(continuation.encounterId);
  assert.ok(encounter, `canonical encounter ${continuation.encounterId}`);
  let session = beginInteractiveBattle({
    data: data.battleData,
    encounterId: continuation.encounterId,
    playerBuild: build,
    seed: continuation.key,
  });

  assert.ok(session.state.enemies.length > 0);
  for (const enemy of session.state.enemies) {
    const canonical = data.battleData.monsterById.get(enemy.id);
    assert.ok(canonical, `canonical enemy ${enemy.id}`);
    assert.equal(enemy.maxHp, canonical.maxHp, `${enemy.id}: no enemy HP override`);
  }

  const initialCommands = listInteractiveBattleCommands({ data: data.battleData, session });
  const skillCommand = initialCommands.find((entry) => entry.skillId === SKILL_ID && entry.available !== false);
  const normalAttack = initialCommands.find((entry) => entry.actionId === 'ATTACK' && entry.available !== false);
  assert.ok(skillCommand, 'player can choose the legally acquired SKL-0049');
  assert.ok(normalAttack, 'normal attack remains a distinct alternative');
  assert.notEqual(skillCommand.actionId, normalAttack.actionId);
  assert.ok(skillCommand.name);
  assert.ok(skillCommand.description);
  assert.ok(targetFor(skillCommand), 'player-visible command includes an observable canonical target');

  const initialObservations = battleObservationsFromSave({
    battle: { status: session.status, commands: initialCommands },
  });
  for (const observation of initialObservations) {
    assert.doesNotMatch(`${observation.name} ${observation.description}`, STRATEGY_HINT,
      'Battle INFO may expose facts but must not answer the strategy question');
  }
  assert.doesNotMatch(`${skillCommand.name} ${skillCommand.description}`, STRATEGY_HINT,
    'the player-visible skill choice describes the action rather than prescribing strategy');

  const actionSequence = [];
  let output = resolveCommand(session, skillCommand);
  actionSequence.push(skillCommand.actionId);
  const firstPlayerFrame = output.round?.frames?.find((frame) => frame.actorSide === 'player' && frame.action?.skillId === SKILL_ID);
  assert.ok(firstPlayerFrame, 'SKL-0049 executes through the shared production battle engine');
  session = output.session;
  let result = output.result ?? null;

  for (let step = 0; !result && session.status === 'active' && step < 32; step += 1) {
    const command = chooseFollowUp(session);
    assert.ok(command, `bounded player policy has an action at step ${step}`);
    output = resolveCommand(session, command);
    actionSequence.push(command.actionId);
    session = output.session;
    result = output.result ?? null;
  }

  assert.ok(result, 'bounded deterministic battle must reach a production result');
  assert.ok(['players', 'fled'].includes(result.winner), `bounded Lv1 cert must settle a non-defeat result, got ${result.winner}`);

  const minuteBeforeSettlement = state.absoluteMinute;
  const metricsBeforeSettlement = state.metrics.battles;
  const goldBeforeSettlement = state.player.gold;
  const settled = settleInteractiveBattleAction(
    state,
    data.model,
    data.battleData,
    data.skills,
    state.catalog,
    'balanced',
    continuation,
    result,
  );
  assert.equal(settled.ok, true, settled.reason);
  assert.equal(state.metrics.battles, metricsBeforeSettlement + 1);
  assert.equal(state.absoluteMinute, minuteBeforeSettlement, 'battle settlement does not double-charge world time already spent by seekBattle');
  assertClockSynchronized(state);
  assert.ok(Number.isFinite(state.player.hpRatio) && state.player.hpRatio >= 0 && state.player.hpRatio <= 1);
  assert.ok(Number.isFinite(state.player.mpRatio) && state.player.mpRatio >= 0 && state.player.mpRatio <= 1);
  assert.ok(Number.isFinite(state.player.gold) && state.player.gold >= goldBeforeSettlement);
  assert.ok(state.history.some((entry) => entry.type === 'BATTLE_RESOURCES_COMMITTED'
    && ['victory', 'fled'].includes(entry.outcome)), 'production settlement commits actual remaining resources');

  const actor = result.players[0];
  const expectedHpRatio = Number(actor.hp) / Math.max(1, Number(actor.maxHp));
  const expectedMpRatio = Number(actor.maxMp) > 0 ? Number(actor.mp) / Number(actor.maxMp) : 0;
  assert.ok(Math.abs(state.player.hpRatio - expectedHpRatio) < 1e-9);
  assert.ok(Math.abs(state.player.mpRatio - expectedMpRatio) < 1e-9);

  return {
    fingerprint: {
      encounterId: continuation.encounterId,
      winner: result.winner,
      actionSequence,
      hpRatio: state.player.hpRatio,
      mpRatio: state.player.mpRatio,
      gold: state.player.gold,
      absoluteMinute: state.absoluteMinute,
      day: state.day,
      hour: state.hour,
      minute: state.minute,
    },
    playerVisibleEvidence: {
      skillActionId: skillCommand.actionId,
      skillName: skillCommand.name,
      targetInstanceId: targetFor(skillCommand)?.instanceId ?? null,
      battleInfoCount: initialObservations.length,
    },
  };
}

test('[GAMEPLAY_CERT] Lv1 current-Day1 axe starter legally learns SKL-0049 and settles a production battle with player-visible evidence', () => {
  const first = runScenario(SEED);
  const second = runScenario(SEED);
  assert.deepEqual(second.fingerprint, first.fingerprint,
    'the bounded production scenario must reproduce exactly from the same fixed seed');
  assert.deepEqual(second.playerVisibleEvidence, first.playerVisibleEvidence);

  const guard = assertGameplayCertDescriptor(LV1_AXE_STARTER_GAMEPLAY_CERT);
  assert.equal(guard.ok, true);
  assert.equal(guard.missingDimensions.length, 0);
  assert.equal(guard.activeDisqualifiers.length, 0);
  assert.equal(Object.values(guard.dimensions).every(Boolean), true);
  assert.equal(checkpointDGameplayCertCount(), 1);
});
