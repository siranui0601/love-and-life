import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPlayerActor,
  evaluateStructuredConditions,
  loadBattleData,
} from '../lib/battle-model.mjs';
import { beginInteractiveBattle } from '../lib/battle-simulator.mjs';
import { loadSkills } from '../lib/fixtures.mjs';
import {
  beginInteractiveBattleAction,
  createInitialJourneyState,
  generateChoiceActions,
  settleInteractiveBattleAction,
} from '../lib/player-journey.mjs';
import { loadPlayerSimulationConfig } from '../lib/player-suite.mjs';
import { loadWorldModel } from '../lib/world-model.mjs';

const model = loadWorldModel();
const battleData = await loadBattleData();
const skills = loadSkills();
const config = loadPlayerSimulationConfig();

function fresh() {
  return createInitialJourneyState({
    model,
    battleData,
    skills,
    profile: 'balanced',
    tuning: config.tuned,
    seed: 'checkpoint-d-resource-continuity',
  });
}

function beginSeekBattle(state) {
  const action = generateChoiceActions(
    state,
    model,
    battleData,
    state.catalog,
    undefined,
    { limit: 12 },
  ).find((entry) => entry.type === 'seekBattle');
  assert.ok(action, 'a canonical local seekBattle action must be available for the focused witness');
  const started = beginInteractiveBattleAction(
    state,
    model,
    battleData,
    skills,
    state.catalog,
    'balanced',
    action,
  );
  assert.equal(started.ok, true);
  return started.continuation;
}

function syntheticResult(continuation, {
  winner,
  hpRatio,
  mpRatio,
}) {
  const build = continuation.prepared.scaledBuild;
  const maxHp = Number(build.resourceMaxHp ?? build.maxHp);
  const maxMp = Number(build.resourceMaxMp ?? build.maxMp);
  return {
    encounterId: continuation.encounterId,
    winner,
    players: [{
      id: build.id,
      hp: maxHp * hpRatio,
      maxHp,
      mp: maxMp * mpRatio,
      maxMp,
      alive: hpRatio > 0,
    }],
    enemies: [],
    monsterIds: [],
    actionUsage: {},
    totalCriticals: 0,
  };
}

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) < 1e-9, `${message}: ${actual} != ${expected}`);
}

test('Checkpoint D starts battle at current HP/MP while preserving maximum resources', () => {
  const state = fresh();
  state.player.hpRatio = 0.4;
  state.player.mpRatio = 0.1;
  const continuation = beginSeekBattle(state);
  const build = continuation.prepared.scaledBuild;

  assert.equal(build.maxHp, continuation.prepared.fullBuild.maxHp);
  assert.equal(build.maxMp, continuation.prepared.fullBuild.maxMp);
  assertClose(build.initialHp, build.maxHp * 0.4, 'initial HP must be 40% of the unchanged max');
  assertClose(build.initialMp, build.maxMp * 0.1, 'initial MP must be 10% of the unchanged max');

  const session = beginInteractiveBattle({
    data: battleData,
    encounterId: continuation.encounterId,
    playerBuild: build,
    seed: continuation.key,
  });
  const actor = session.state.players[0];
  assert.equal(actor.maxHp, build.maxHp);
  assert.equal(actor.maxMp, build.maxMp);
  assertClose(actor.hp, actor.maxHp * 0.4, 'production actor HP must remain 40/100 rather than 40/40');
  assertClose(actor.mp, actor.maxMp * 0.1, 'production actor MP must remain 10/100 rather than 10/10');
});

test('Checkpoint D removes the historical 18% HP / 3% MP battle-entry floors', () => {
  const state = fresh();
  state.player.hpRatio = 0.05;
  state.player.mpRatio = 0.01;
  const continuation = beginSeekBattle(state);
  const build = continuation.prepared.scaledBuild;
  const session = beginInteractiveBattle({
    data: battleData,
    encounterId: continuation.encounterId,
    playerBuild: build,
    seed: continuation.key,
  });
  const actor = session.state.players[0];

  assertClose(actor.hp / actor.maxHp, 0.05, '5% HP must not be raised to 18%');
  assertClose(actor.mp / actor.maxMp, 0.01, '1% MP must not be raised to 3%');
});

test('victory and flee commit exact remaining HP/MP back to authoritative world state', () => {
  for (const witness of [
    { winner: 'players', hpRatio: 0.37, mpRatio: 0.09, outcome: 'victory' },
    { winner: 'fled', hpRatio: 0.52, mpRatio: 0.06, outcome: 'fled' },
  ]) {
    const state = fresh();
    state.player.hpRatio = 0.61;
    state.player.mpRatio = 0.44;
    const continuation = beginSeekBattle(state);
    const result = syntheticResult(continuation, witness);
    const settled = settleInteractiveBattleAction(
      state,
      model,
      battleData,
      skills,
      state.catalog,
      'balanced',
      continuation,
      result,
    );
    assert.equal(settled.ok, true);
    assertClose(state.player.hpRatio, witness.hpRatio, `${witness.outcome} HP remainder must persist`);
    assertClose(state.player.mpRatio, witness.mpRatio, `${witness.outcome} MP remainder must persist`);
    assert.ok(state.history.some((entry) => entry.type === 'BATTLE_RESOURCES_COMMITTED' && entry.outcome === witness.outcome));
  }
});

test('defeat defers Gold, partial recovery, time, and transport to the common rescue flow', () => {
  const state = fresh();
  state.player.gold = 1000;
  state.player.location = '田園の村';
  state.player.facilityId = 'LOC_FARM_FIELD';
  state.player.hpRatio = 0.73;
  state.player.mpRatio = 0.64;
  const origin = {
    location: state.player.location,
    facilityId: state.player.facilityId,
  };
  const continuation = beginSeekBattle(state);
  const beforeSettlementMinute = state.absoluteMinute;
  const settled = settleInteractiveBattleAction(
    state,
    model,
    battleData,
    skills,
    state.catalog,
    'balanced',
    continuation,
    syntheticResult(continuation, { winner: 'enemies', hpRatio: 0, mpRatio: 0 }),
  );

  assert.equal(settled.ok, true);
  assert.equal(settled.battle.won, false);
  assert.equal(settled.battle.fled, false);
  assertClose(state.player.hpRatio, 0, 'defeated player remains incapacitated until rescued');
  assertClose(state.player.mpRatio, 0, 'battle-end MP residue is preserved until rescue settlement');
  assert.equal(state.player.gold, 1000, 'defeat Gold loss is not charged before rescue completion');
  assert.equal(state.absoluteMinute, beforeSettlementMinute, 'defeat itself does not fabricate recovery time');
  assert.equal(state.player.location, origin.location, 'defeated player remains at the battle origin before rescue');
  assert.equal(state.player.facilityId, origin.facilityId, 'defeated player is not teleported to a safe facility before rescue');
  assert.equal(state.player.pendingDefeatSettlement?.recoveryHpRatio, 0.35);
  assert.equal(state.player.pendingDefeatSettlement?.recoveryMpRatio, 0.2);
  assert.equal(state.player.pendingDefeatSettlement?.goldLoss, 100);
  assert.ok(state.history.some((entry) => entry.type === 'BATTLE_DEFEAT_INCAPACITATED'));
  assert.equal(state.history.some((entry) => entry.type === 'BATTLE_DEFEAT_RETURN'), false);
  assert.equal(state.history.some((entry) => entry.type === 'BATTLE_DEFEAT_RECOVERY'), false);
});

test('HP0 is only a fallback block, and low-HP conditions see current/max rather than a shrunken max', () => {
  const state = fresh();
  state.player.hpRatio = 0;
  const blocked = beginInteractiveBattleAction(
    state,
    model,
    battleData,
    skills,
    state.catalog,
    'balanced',
    { id: 'SEEK_BATTLE', type: 'seekBattle', minutes: 90 },
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'battle_unavailable_incapacitated');

  const actor = createPlayerActor({
    id: 'checkpoint-d-low-hp',
    maxHp: 100,
    maxMp: 100,
    resourceMaxHp: 100,
    resourceMaxMp: 100,
    initialHp: 40,
    initialMp: 10,
    skillIds: [],
    equipmentIds: [],
    activeWeaponTypes: new Set(),
  });
  assert.equal(actor.hp, 40);
  assert.equal(actor.maxHp, 100);
  assert.equal(actor.mp, 10);
  assert.equal(actor.maxMp, 100);
  assert.equal(evaluateStructuredConditions([
    { scope: 'self', path: 'hpRatio', op: 'lte', value: 0.5 },
  ], { self: actor }), true, '40/100 must satisfy a <=50% HP condition');
  assert.equal(evaluateStructuredConditions([
    { scope: 'self', path: 'hpRatio', op: 'eq', value: 1 },
  ], { self: actor }), false, '40 current HP must not be interpreted as 40/40 full HP');

  // Max-based healing/barrier/cost runtime reads actor.maxHp.  Keeping it at
  // 100 is the invariant that prevents an injured player from shrinking every
  // maxHP-proportional mechanic to the current residue.
  assert.equal(actor.maxHp, 100);
});
